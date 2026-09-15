import AsyncStorage from '@react-native-async-storage/async-storage';
import { Project, updateProject } from '../../domain';
import {
  ProjectRepository,
  ProjectNotFoundError,
  DataCorruptionError,
  StorageError,
} from '../../ports';
import { ProjectMapper } from '../mappers/ProjectMapper';
import { validateProjectPersistenceDTO } from '../dtos';
import { ProjectType, ProjectStatus } from '../../domain/types';

const PROJECT_KEY_PREFIX = 'project:';
const BACKUP_KEY_PREFIX = 'projectBackup:';
const PROJECT_LIST_KEY = 'projectList';

/** RNF-006: outcome of checking (and possibly repairing) one project's stored data. */
export type IntegrityResult = 'ok' | 'restored' | 'unrecoverable' | 'not_found';

export class LocalProjectRepository implements ProjectRepository {
  async create(project: Project): Promise<void> {
    try {
      const dto = ProjectMapper.toPersistence(project);
      const json = JSON.stringify(dto);

      await AsyncStorage.setItem(`${PROJECT_KEY_PREFIX}${project.id}`, json);
      // RNF-006: seed a backup immediately so even a first-edit corruption is recoverable.
      await AsyncStorage.setItem(`${BACKUP_KEY_PREFIX}${project.id}`, json);

      const list = await this.getProjectList();
      list.push(project.id);
      await this.setProjectList(list);
    } catch (error) {
      if (error instanceof Error) {
        throw new StorageError(error.message);
      }
      throw new StorageError('Unknown error during create');
    }
  }

  async findById(id: string): Promise<Project | null> {
    try {
      const json = await AsyncStorage.getItem(`${PROJECT_KEY_PREFIX}${id}`);

      if (!json) {
        return null;
      }

      let dto: unknown;
      try {
        dto = JSON.parse(json);
      } catch {
        throw new DataCorruptionError(`Invalid JSON for project '${id}'`);
      }

      return ProjectMapper.toDomain(dto as any);
    } catch (error) {
      if (error instanceof DataCorruptionError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new StorageError(error.message);
      }
      throw new StorageError('Unknown error during findById');
    }
  }

  async findAll(): Promise<Project[]> {
    try {
      const list = await this.getProjectList();
      const projects: Project[] = [];

      for (const id of list) {
        const project = await this.findById(id);
        if (project) {
          projects.push(project);
        }
      }

      return projects;
    } catch (error) {
      if (error instanceof DataCorruptionError || error instanceof StorageError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new StorageError(error.message);
      }
      throw new StorageError('Unknown error during findAll');
    }
  }

  async findByType(type: ProjectType): Promise<Project[]> {
    const allProjects = await this.findAll();
    return allProjects.filter((p) => p.type === type);
  }

  async findByStatus(status: ProjectStatus): Promise<Project[]> {
    const allProjects = await this.findAll();
    return allProjects.filter((p) => p.status === status);
  }

  async update(project: Project): Promise<void> {
    try {
      const existing = await this.findById(project.id);
      if (!existing) {
        throw new ProjectNotFoundError(project.id);
      }

      // RNF-006: snapshot the last known-good state before overwriting it.
      const backupDto = ProjectMapper.toPersistence(existing);
      await AsyncStorage.setItem(`${BACKUP_KEY_PREFIX}${project.id}`, JSON.stringify(backupDto));

      const dto = ProjectMapper.toPersistence(project);
      const json = JSON.stringify(dto);
      await AsyncStorage.setItem(`${PROJECT_KEY_PREFIX}${project.id}`, json);
    } catch (error) {
      if (
        error instanceof ProjectNotFoundError ||
        error instanceof DataCorruptionError ||
        error instanceof StorageError
      ) {
        throw error;
      }
      if (error instanceof Error) {
        throw new StorageError(error.message);
      }
      throw new StorageError('Unknown error during update');
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${PROJECT_KEY_PREFIX}${id}`);
      await AsyncStorage.removeItem(`${BACKUP_KEY_PREFIX}${id}`);

      const list = await this.getProjectList();
      const newList = list.filter((projectId) => projectId !== id);
      await this.setProjectList(newList);
    } catch (error) {
      if (error instanceof Error) {
        throw new StorageError(error.message);
      }
      throw new StorageError('Unknown error during delete');
    }
  }

  async archive(id: string): Promise<void> {
    const project = await this.findById(id);
    if (!project) {
      throw new ProjectNotFoundError(id);
    }

    await this.update(updateProject(project, { status: 'archived' }));
  }

  async unarchive(id: string): Promise<void> {
    const project = await this.findById(id);
    if (!project) {
      throw new ProjectNotFoundError(id);
    }

    await this.update(updateProject(project, { status: 'active' }));
  }

  /**
   * RNF-006: checks one project's stored JSON is valid; if not, attempts to restore it
   * from the last backup snapshot taken before the corrupting write.
   */
  async verifyIntegrity(id: string): Promise<IntegrityResult> {
    const liveJson = await AsyncStorage.getItem(`${PROJECT_KEY_PREFIX}${id}`);
    if (!liveJson) {
      return 'not_found';
    }

    if (this.isValidPersistedJson(liveJson)) {
      return 'ok';
    }

    const backupJson = await AsyncStorage.getItem(`${BACKUP_KEY_PREFIX}${id}`);
    if (backupJson && this.isValidPersistedJson(backupJson)) {
      await AsyncStorage.setItem(`${PROJECT_KEY_PREFIX}${id}`, backupJson);
      return 'restored';
    }

    return 'unrecoverable';
  }

  /** Runs verifyIntegrity across every known project — powers the Storage screen's check. */
  async verifyAllIntegrity(): Promise<{ id: string; result: IntegrityResult }[]> {
    const list = await this.getProjectList();
    const results: { id: string; result: IntegrityResult }[] = [];
    for (const id of list) {
      results.push({ id, result: await this.verifyIntegrity(id) });
    }
    return results;
  }

  private isValidPersistedJson(json: string): boolean {
    try {
      const dto = JSON.parse(json);
      if (!validateProjectPersistenceDTO(dto)) return false;
      ProjectMapper.toDomain(dto);
      return true;
    } catch {
      return false;
    }
  }

  private async getProjectList(): Promise<string[]> {
    try {
      const json = await AsyncStorage.getItem(PROJECT_LIST_KEY);
      if (!json) {
        return [];
      }

      const list = JSON.parse(json);
      if (!Array.isArray(list)) {
        throw new DataCorruptionError('projectList is not an array');
      }

      return list;
    } catch (error) {
      if (error instanceof DataCorruptionError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new StorageError(error.message);
      }
      throw new StorageError('Unknown error reading projectList');
    }
  }

  private async setProjectList(list: string[]): Promise<void> {
    try {
      const json = JSON.stringify(list);
      await AsyncStorage.setItem(PROJECT_LIST_KEY, json);
    } catch (error) {
      if (error instanceof Error) {
        throw new StorageError(error.message);
      }
      throw new StorageError('Unknown error writing projectList');
    }
  }
}

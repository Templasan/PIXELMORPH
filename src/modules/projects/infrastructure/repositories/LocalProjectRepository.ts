import AsyncStorage from '@react-native-async-storage/async-storage';
import { Project } from '../../domain';
import {
  ProjectRepository,
  ProjectNotFoundError,
  DataCorruptionError,
  StorageError,
} from '../../ports';
import { ProjectMapper } from '../mappers/ProjectMapper';
import { ProjectType, ProjectStatus } from '../../domain/types';

const PROJECT_KEY_PREFIX = 'project:';
const PROJECT_LIST_KEY = 'projectList';

export class LocalProjectRepository implements ProjectRepository {
  async create(project: Project): Promise<void> {
    try {
      const dto = ProjectMapper.toPersistence(project);
      const json = JSON.stringify(dto);

      await AsyncStorage.setItem(`${PROJECT_KEY_PREFIX}${project.id}`, json);

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
      if (error instanceof (DataCorruptionError || StorageError)) {
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

      const dto = ProjectMapper.toPersistence(project);
      const json = JSON.stringify(dto);
      await AsyncStorage.setItem(`${PROJECT_KEY_PREFIX}${project.id}`, json);
    } catch (error) {
      if (error instanceof (ProjectNotFoundError || DataCorruptionError || StorageError)) {
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

    project.status = 'archived';
    project.updatedAt = new Date();

    await this.update(project);
  }

  async unarchive(id: string): Promise<void> {
    const project = await this.findById(id);
    if (!project) {
      throw new ProjectNotFoundError(id);
    }

    project.status = 'active';
    project.updatedAt = new Date();

    await this.update(project);
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

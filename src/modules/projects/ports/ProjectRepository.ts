import { Project } from '../domain';
import { ProjectType, ProjectStatus } from '../domain/types';

export interface ProjectRepository {
  create(project: Project): Promise<void>;

  findById(id: string): Promise<Project | null>;

  findAll(): Promise<Project[]>;

  findByType(type: ProjectType): Promise<Project[]>;

  findByStatus(status: ProjectStatus): Promise<Project[]>;

  update(project: Project): Promise<void>;

  delete(id: string): Promise<void>;

  archive(id: string): Promise<void>;

  unarchive(id: string): Promise<void>;
}

export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`Project with id '${id}' not found`);
    this.name = 'ProjectNotFoundError';
  }
}

export class DataCorruptionError extends Error {
  constructor(message: string) {
    super(`Data corruption detected: ${message}`);
    this.name = 'DataCorruptionError';
  }
}

export class StorageError extends Error {
  constructor(message: string) {
    super(`Storage error: ${message}`);
    this.name = 'StorageError';
  }
}

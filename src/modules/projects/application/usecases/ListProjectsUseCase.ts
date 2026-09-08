import { ProjectRepository } from '../../ports';
import { Project } from '../../domain';
import { ProjectType, ProjectStatus } from '../../domain/types';

export interface ListProjectsFilter {
  type?: ProjectType;
  status?: ProjectStatus;
}

export class ListProjectsUseCase {
  constructor(private repository: ProjectRepository) {}

  async execute(filter?: ListProjectsFilter): Promise<Project[]> {
    let projects = await this.repository.findAll();

    if (filter?.type) {
      projects = projects.filter((p) => p.type === filter.type);
    }

    if (filter?.status) {
      projects = projects.filter((p) => p.status === filter.status);
    }

    return projects;
  }
}

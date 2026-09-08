import { ProjectRepository } from '../../ports';
import { Project } from '../../domain';

export class GetProjectUseCase {
  constructor(private repository: ProjectRepository) {}

  async execute(id: string): Promise<Project | null> {
    return this.repository.findById(id);
  }
}

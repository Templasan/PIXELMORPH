import { ProjectRepository, ProjectNotFoundError } from '../../ports';
import { Project } from '../../domain';

export class UnarchiveProjectUseCase {
  constructor(private repository: ProjectRepository) {}

  async execute(id: string): Promise<Project> {
    const project = await this.repository.findById(id);
    if (!project) {
      throw new ProjectNotFoundError(id);
    }

    await this.repository.unarchive(id);

    const updated = await this.repository.findById(id);
    if (!updated) {
      throw new Error('Project was deleted after unarchiving');
    }

    return updated;
  }
}

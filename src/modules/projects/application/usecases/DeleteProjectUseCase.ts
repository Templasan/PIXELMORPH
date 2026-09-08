import { ProjectRepository, ProjectNotFoundError } from '../../ports';

export class DeleteProjectUseCase {
  constructor(private repository: ProjectRepository) {}

  async execute(id: string): Promise<void> {
    const project = await this.repository.findById(id);
    if (!project) {
      throw new ProjectNotFoundError(id);
    }

    await this.repository.delete(id);
  }
}

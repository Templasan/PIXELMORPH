import { ProjectRepository, ProjectNotFoundError, type MediaFileStore } from '../../ports';

export class DeleteProjectUseCase {
  constructor(
    private repository: ProjectRepository,
    private files: MediaFileStore
  ) {}

  async execute(id: string): Promise<void> {
    const project = await this.repository.findById(id);
    if (!project) {
      throw new ProjectNotFoundError(id);
    }
    await this.repository.delete(id);
    // The project is gone either way; leftover files only cost space, so don't fail on them.
    await this.files.removeProjectFiles(id).catch(() => undefined);
  }
}

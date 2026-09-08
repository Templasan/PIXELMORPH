import { ProjectRepository, ProjectNotFoundError } from '../../ports';
import { Project, removeAssetFromProject } from '../../domain';

export class RemoveMediaAssetUseCase {
  constructor(private repository: ProjectRepository) {}

  async execute(projectId: string, assetId: string): Promise<Project> {
    const project = await this.repository.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }

    const updated = removeAssetFromProject(project, assetId);
    await this.repository.update(updated);

    return updated;
  }
}

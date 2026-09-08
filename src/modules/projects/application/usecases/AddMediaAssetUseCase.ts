import { ProjectRepository, ProjectNotFoundError } from '../../ports';
import { Project, addAssetToProject, MediaAsset } from '../../domain';

export class AddMediaAssetUseCase {
  constructor(private repository: ProjectRepository) {}

  async execute(projectId: string, asset: MediaAsset): Promise<Project> {
    const project = await this.repository.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }

    const updated = addAssetToProject(project, asset);
    await this.repository.update(updated);

    return updated;
  }
}

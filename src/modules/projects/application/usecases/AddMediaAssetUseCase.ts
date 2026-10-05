import { ProjectRepository, ProjectNotFoundError, type MediaFileStore } from '../../ports';
import { Project, addAssetToProject, MediaAsset } from '../../domain';

export class AddMediaAssetUseCase {
  constructor(
    private repository: ProjectRepository,
    private files: MediaFileStore
  ) {}

  async execute(projectId: string, asset: MediaAsset): Promise<Project> {
    const project = await this.repository.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }

    // Incoming URIs usually live in the cache; the project must own a permanent copy.
    const originalUri = await this.files.persist(asset.originalUri, projectId);
    const workingUri =
      asset.workingUri === asset.originalUri
        ? originalUri
        : await this.files.persist(asset.workingUri, projectId);

    const updated = addAssetToProject(project, { ...asset, originalUri, workingUri });
    await this.repository.update(updated);

    return updated;
  }
}

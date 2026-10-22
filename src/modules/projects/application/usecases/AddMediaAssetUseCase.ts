import { ProjectRepository, ProjectNotFoundError, type MediaFileStore } from '../../ports';
import { Project, addAssetToProject, MediaAsset } from '../../domain';

/** Copies the asset's files into the project's permanent folder; returns the asset with those URIs. */
export async function persistAssetFiles(
  files: MediaFileStore,
  projectId: string,
  asset: MediaAsset
): Promise<MediaAsset> {
  // Incoming URIs usually live in the cache; the project must own a permanent copy.
  const originalUri = await files.persist(asset.originalUri, projectId);
  const workingUri =
    asset.workingUri === asset.originalUri
      ? originalUri
      : await files.persist(asset.workingUri, projectId);
  return { ...asset, originalUri, workingUri };
}

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

    const updated = addAssetToProject(
      project,
      await persistAssetFiles(this.files, projectId, asset)
    );
    await this.repository.update(updated);

    return updated;
  }
}

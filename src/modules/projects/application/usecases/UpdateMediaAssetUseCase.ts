import { ProjectRepository, ProjectNotFoundError, type MediaFileStore } from '../../ports';
import { Project, updateProjectAsset, MediaAsset } from '../../domain';

export type UpdateMediaAssetInput = Partial<
  Omit<MediaAsset, 'id' | 'type' | 'originalUri' | 'createdAt'>
>;

export class UpdateMediaAssetUseCase {
  constructor(
    private repository: ProjectRepository,
    private files: MediaFileStore
  ) {}

  async execute(
    projectId: string,
    assetId: string,
    updates: UpdateMediaAssetInput
  ): Promise<Project> {
    const project = await this.repository.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }

    // A new working file (e.g. pixels baked by the photo editor) arrives in the cache too.
    const workingUri =
      updates.workingUri && (await this.files.persist(updates.workingUri, projectId));
    const updated = updateProjectAsset(project, assetId, {
      ...updates,
      ...(workingUri && { workingUri }),
    });
    await this.repository.update(updated);

    return updated;
  }
}

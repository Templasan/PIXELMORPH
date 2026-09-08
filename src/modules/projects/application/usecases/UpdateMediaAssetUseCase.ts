import { ProjectRepository, ProjectNotFoundError } from '../../ports';
import { Project, updateProjectAsset, MediaAsset } from '../../domain';

export type UpdateMediaAssetInput = Partial<
  Omit<MediaAsset, 'id' | 'type' | 'originalUri' | 'workingUri' | 'createdAt'>
>;

export class UpdateMediaAssetUseCase {
  constructor(private repository: ProjectRepository) {}

  async execute(
    projectId: string,
    assetId: string,
    updates: UpdateMediaAssetInput
  ): Promise<Project> {
    const project = await this.repository.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }

    const updated = updateProjectAsset(project, assetId, updates);
    await this.repository.update(updated);

    return updated;
  }
}

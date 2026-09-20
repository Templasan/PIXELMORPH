import type { ProjectRepository } from '../../ports';
import { updateProjectAsset } from '../../domain';

export class ApplyAdjustmentsBatchUseCase {
  constructor(private repository: ProjectRepository) {}

  async execute(
    projectId: string,
    assetIds: string[],
    adjustments: Record<string, number>,
    onProgress?: (completed: number, total: number) => void
  ) {
    const project = await this.repository.findById(projectId);
    if (!project) throw new Error('Project not found');

    const total = assetIds.length;
    for (let i = 0; i < assetIds.length; i++) {
      const assetId = assetIds[i];
      const updated = updateProjectAsset(project, assetId, { adjustments });
      await this.repository.update(updated);
      onProgress?.(i + 1, total);
    }
  }
}

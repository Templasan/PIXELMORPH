import type { RecentAdjustmentsRepository } from '@core/ports/RecentAdjustmentsRepository';
import { createRecentAdjustment } from '../../domain/RecentAdjustment';

export function createAddRecentAdjustmentUseCase(repo: RecentAdjustmentsRepository) {
  return {
    async execute(adjustments: Record<string, number>): Promise<void> {
      const id = `recent_${Date.now()}`;
      const adjustment = createRecentAdjustment(id, adjustments);
      await repo.add(adjustment);
    },
  };
}

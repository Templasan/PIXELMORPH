import type { RecentAdjustmentsRepository } from '@core/ports/RecentAdjustmentsRepository';
import type { RecentAdjustment } from '../../domain/RecentAdjustment';

export function createListRecentAdjustmentsUseCase(repo: RecentAdjustmentsRepository) {
  return {
    async execute(limit?: number): Promise<RecentAdjustment[]> {
      return repo.list(limit);
    },
  };
}

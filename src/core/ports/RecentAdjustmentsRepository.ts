import type { RecentAdjustment } from '@modules/photo-editor/domain';

export interface RecentAdjustmentsRepository {
  add(adjustment: RecentAdjustment): Promise<void>;
  list(limit?: number): Promise<RecentAdjustment[]>;
  clear(): Promise<void>;
}

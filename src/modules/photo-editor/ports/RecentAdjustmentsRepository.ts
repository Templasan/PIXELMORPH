import type { RecentAdjustment } from '../domain';

export interface RecentAdjustmentsRepository {
  add(adjustment: RecentAdjustment): Promise<void>;
  list(limit?: number): Promise<RecentAdjustment[]>;
  clear(): Promise<void>;
}

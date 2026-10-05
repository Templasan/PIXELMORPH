import type { RecentAdjustmentsRepository } from '../ports/RecentAdjustmentsRepository';
import type { RecentAdjustment } from '../domain';
import { JsonListCache } from './JsonListCache';

const RECENT_KEY = '@pixelmorph/recent-adjustments';
const MAX_RECENT = 10;

export class AsyncStorageRecentAdjustmentsRepository implements RecentAdjustmentsRepository {
  private readonly store = new JsonListCache(RECENT_KEY);

  async add(adjustment: RecentAdjustment): Promise<void> {
    await this.store.mutate((all) => {
      // Remove duplicates (same adjustments), keep newest MAX_RECENT
      const key = JSON.stringify(adjustment.adjustments);
      const filtered = all.filter((a) => JSON.stringify(a.adjustments) !== key);
      return [adjustment, ...filtered].slice(0, MAX_RECENT);
    });
  }

  async list(limit: number = MAX_RECENT): Promise<RecentAdjustment[]> {
    return (await this.store.read())
      .map((item) => ({ ...item, timestamp: new Date(item.timestamp) }))
      .slice(0, limit);
  }

  async clear(): Promise<void> {
    await this.store.clear();
  }
}

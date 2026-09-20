import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RecentAdjustmentsRepository } from '@core/ports/RecentAdjustmentsRepository';
import type { RecentAdjustment } from '@modules/photo-editor/domain';

const RECENT_KEY = '@pixelmorph/recent-adjustments';
const MAX_RECENT = 10;

export class AsyncStorageRecentAdjustmentsRepository implements RecentAdjustmentsRepository {
  async add(adjustment: RecentAdjustment): Promise<void> {
    const all = await this.list(MAX_RECENT + 1);
    // Remove duplicates (same adjustments)
    const filtered = all.filter(
      (a) => JSON.stringify(a.adjustments) !== JSON.stringify(adjustment.adjustments)
    );
    // Keep newest MAX_RECENT
    const updated = [adjustment, ...filtered].slice(0, MAX_RECENT);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  }

  async list(limit: number = MAX_RECENT): Promise<RecentAdjustment[]> {
    const data = await AsyncStorage.getItem(RECENT_KEY);
    if (!data) return [];
    try {
      const items = JSON.parse(data) as {
        id: string;
        adjustments: Record<string, number>;
        timestamp: string;
      }[];
      return items
        .map((item) => ({
          ...item,
          timestamp: new Date(item.timestamp),
        }))
        .slice(0, limit);
    } catch {
      return [];
    }
  }

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(RECENT_KEY);
  }
}

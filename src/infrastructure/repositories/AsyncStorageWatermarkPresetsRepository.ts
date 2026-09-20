import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WatermarkPresetsRepository } from '@core/ports/WatermarkPresetsRepository';
import type { WatermarkPreset } from '@modules/photo-editor/domain/WatermarkPreset';

const WATERMARK_KEY = '@pixelmorph/watermark-presets';

export class AsyncStorageWatermarkPresetsRepository implements WatermarkPresetsRepository {
  async save(preset: WatermarkPreset): Promise<void> {
    const all = await this.list();
    const filtered = all.filter((p) => p.id !== preset.id);
    const updated = [...filtered, preset];
    await AsyncStorage.setItem(WATERMARK_KEY, JSON.stringify(updated));
  }

  async load(id: string): Promise<WatermarkPreset | null> {
    const all = await this.list();
    return all.find((p) => p.id === id) || null;
  }

  async list(): Promise<WatermarkPreset[]> {
    const data = await AsyncStorage.getItem(WATERMARK_KEY);
    if (!data) return [];
    try {
      const items = JSON.parse(data) as (WatermarkPreset & { createdAt: string })[];
      return items.map((item) => ({
        ...item,
        createdAt: new Date(item.createdAt),
      }));
    } catch {
      return [];
    }
  }

  async delete(id: string): Promise<void> {
    const all = await this.list();
    const filtered = all.filter((p) => p.id !== id);
    await AsyncStorage.setItem(WATERMARK_KEY, JSON.stringify(filtered));
  }
}

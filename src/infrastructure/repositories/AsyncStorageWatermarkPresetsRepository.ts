import type { WatermarkPresetsRepository } from '@core/ports/WatermarkPresetsRepository';
import type { WatermarkPreset } from '@modules/photo-editor/domain/WatermarkPreset';
import { JsonListCache } from './JsonListCache';

const WATERMARK_KEY = '@pixelmorph/watermark-presets';

export class AsyncStorageWatermarkPresetsRepository implements WatermarkPresetsRepository {
  private readonly store = new JsonListCache(WATERMARK_KEY);

  async save(preset: WatermarkPreset): Promise<void> {
    await this.store.mutate((all) => [...all.filter((p) => p.id !== preset.id), preset]);
  }

  async load(id: string): Promise<WatermarkPreset | null> {
    return (await this.list()).find((p) => p.id === id) || null;
  }

  async list(): Promise<WatermarkPreset[]> {
    return (await this.store.read()).map((item) => ({
      ...item,
      createdAt: new Date(item.createdAt),
    }));
  }

  async delete(id: string): Promise<void> {
    await this.store.mutate((all) => all.filter((p) => p.id !== id));
  }
}

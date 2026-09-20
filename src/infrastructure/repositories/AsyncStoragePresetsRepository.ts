import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Preset } from '@modules/photo-editor/domain/Preset';
import type { PresetsRepository } from '@core/ports/PresetsRepository';

const PRESETS_KEY = '@pixelmorph/presets';

export class AsyncStoragePresetsRepository implements PresetsRepository {
  async save(preset: Preset): Promise<void> {
    const all = await this.list();
    const idx = all.findIndex((p) => p.id === preset.id);
    if (idx >= 0) {
      all[idx] = preset;
    } else {
      all.push(preset);
    }
    await AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(all));
  }

  async load(id: string): Promise<Preset | null> {
    const all = await this.list();
    const preset = all.find((p) => p.id === id);
    if (!preset) return null;
    preset.createdAt = new Date(preset.createdAt as any);
    return preset;
  }

  async list(): Promise<Preset[]> {
    const json = await AsyncStorage.getItem(PRESETS_KEY);
    if (!json) return [];
    try {
      const presets = JSON.parse(json) as any[];
      return presets.map((p) => ({
        ...p,
        createdAt: new Date(p.createdAt),
      }));
    } catch {
      return [];
    }
  }

  async delete(id: string): Promise<void> {
    const all = await this.list();
    const filtered = all.filter((p) => p.id !== id);
    await AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(filtered));
  }
}

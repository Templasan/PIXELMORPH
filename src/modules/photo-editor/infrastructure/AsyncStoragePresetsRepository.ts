import type { Preset } from '../domain/Preset';
import type { PresetsRepository } from '../ports/PresetsRepository';
import { JsonListCache } from './JsonListCache';

const PRESETS_KEY = '@pixelmorph/presets';

export class AsyncStoragePresetsRepository implements PresetsRepository {
  private readonly store = new JsonListCache(PRESETS_KEY);

  async save(preset: Preset): Promise<void> {
    await this.store.mutate((all) => {
      const idx = all.findIndex((p) => p.id === preset.id);
      return idx >= 0 ? all.map((p, i) => (i === idx ? preset : p)) : [...all, preset];
    });
  }

  async load(id: string): Promise<Preset | null> {
    return (await this.list()).find((p) => p.id === id) ?? null;
  }

  async list(): Promise<Preset[]> {
    return (await this.store.read()).map((p) => ({ ...p, createdAt: new Date(p.createdAt) }));
  }

  async delete(id: string): Promise<void> {
    await this.store.mutate((all) => all.filter((p) => p.id !== id));
  }
}

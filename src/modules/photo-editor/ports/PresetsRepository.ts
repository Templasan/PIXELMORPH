import type { Preset } from '../domain/Preset';

export interface PresetsRepository {
  save(preset: Preset): Promise<void>;
  load(id: string): Promise<Preset | null>;
  list(): Promise<Preset[]>;
  delete(id: string): Promise<void>;
}

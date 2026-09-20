import type { Preset } from '@modules/photo-editor/domain/Preset';

export interface PresetsRepository {
  save(preset: Preset): Promise<void>;
  load(id: string): Promise<Preset | null>;
  list(): Promise<Preset[]>;
  delete(id: string): Promise<void>;
}

import type { WatermarkPreset } from '@modules/photo-editor/domain/WatermarkPreset';

export interface WatermarkPresetsRepository {
  save(preset: WatermarkPreset): Promise<void>;
  load(id: string): Promise<WatermarkPreset | null>;
  list(): Promise<WatermarkPreset[]>;
  delete(id: string): Promise<void>;
}

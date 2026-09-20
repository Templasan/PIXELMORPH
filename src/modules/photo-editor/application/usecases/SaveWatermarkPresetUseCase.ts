import type { WatermarkPresetsRepository } from '@core/ports/WatermarkPresetsRepository';
import type { Watermark } from '../../domain/Watermark';
import { createWatermarkPreset } from '../../domain/WatermarkPreset';
import type { WatermarkPreset } from '../../domain/WatermarkPreset';

export function createSaveWatermarkPresetUseCase(repo: WatermarkPresetsRepository) {
  return {
    async execute(name: string, watermark: Watermark): Promise<WatermarkPreset> {
      const id = `wm_preset_${Math.random().toString(36).substring(2, 11)}`;
      const preset = createWatermarkPreset(id, name, watermark);
      await repo.save(preset);
      return preset;
    },
  };
}

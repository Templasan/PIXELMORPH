import type { WatermarkPresetsRepository } from '../../ports/WatermarkPresetsRepository';
import type { WatermarkPreset } from '../../domain/WatermarkPreset';

export function createListWatermarkPresetsUseCase(repo: WatermarkPresetsRepository) {
  return {
    async execute(): Promise<WatermarkPreset[]> {
      return repo.list();
    },
  };
}

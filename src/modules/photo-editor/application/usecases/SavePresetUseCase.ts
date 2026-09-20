import type { PresetsRepository } from '@core/ports/PresetsRepository';
import { createPreset } from '../../domain/Preset';

function generateId() {
  return `preset_${Math.random().toString(36).substring(2, 11)}`;
}

export function createSavePresetUseCase(repo: PresetsRepository) {
  return {
    execute: async (name: string, adjustments: Record<string, number>) => {
      const preset = createPreset(generateId(), name, adjustments);
      await repo.save(preset);
      return preset;
    },
  };
}

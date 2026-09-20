import { AsyncStoragePresetsRepository } from '@infrastructure/repositories/AsyncStoragePresetsRepository';
import {
  createSavePresetUseCase,
  createListPresetsUseCase,
  createApplyBrushStrokeUseCase,
  createColorMaskUseCase,
  createFocusMaskUseCase,
  createLinearGradientMaskUseCase,
  createRadialGradientMaskUseCase,
} from './application';

export * from './spike';
export * from './domain';

type PhotoEditorModule = {
  savePreset: ReturnType<typeof createSavePresetUseCase>;
  listPresets: ReturnType<typeof createListPresetsUseCase>;
  applyBrushStroke: ReturnType<typeof createApplyBrushStrokeUseCase>;
  createColorMask: ReturnType<typeof createColorMaskUseCase>;
  createFocusMask: ReturnType<typeof createFocusMaskUseCase>;
  createLinearGradientMask: ReturnType<typeof createLinearGradientMaskUseCase>;
  createRadialGradientMask: ReturnType<typeof createRadialGradientMaskUseCase>;
};

let photoEditorModule: PhotoEditorModule | null = null;

export function createPhotoEditorModule(): PhotoEditorModule {
  if (photoEditorModule) return photoEditorModule;

  const presetsRepo = new AsyncStoragePresetsRepository();

  photoEditorModule = {
    savePreset: createSavePresetUseCase(presetsRepo),
    listPresets: createListPresetsUseCase(presetsRepo),
    applyBrushStroke: createApplyBrushStrokeUseCase(),
    createColorMask: createColorMaskUseCase(),
    createFocusMask: createFocusMaskUseCase(),
    createLinearGradientMask: createLinearGradientMaskUseCase(),
    createRadialGradientMask: createRadialGradientMaskUseCase(),
  };

  return photoEditorModule;
}

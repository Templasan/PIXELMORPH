import { AsyncStoragePresetsRepository } from '@infrastructure/repositories/AsyncStoragePresetsRepository';
import {
  createSavePresetUseCase,
  createListPresetsUseCase,
  createApplyBrushStrokeUseCase,
  createColorMaskUseCase,
  createFocusMaskUseCase,
  createLinearGradientMaskUseCase,
  createRadialGradientMaskUseCase,
  createApplyCloneStrokeUseCase,
  createApplyLiquifyStrokeUseCase,
  createComputeWatermarkRenderingUseCase,
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
  applyCloneStroke: ReturnType<typeof createApplyCloneStrokeUseCase>;
  applyLiquifyStroke: ReturnType<typeof createApplyLiquifyStrokeUseCase>;
  computeWatermarkRendering: ReturnType<typeof createComputeWatermarkRenderingUseCase>;
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
    applyCloneStroke: createApplyCloneStrokeUseCase(),
    applyLiquifyStroke: createApplyLiquifyStrokeUseCase(),
    computeWatermarkRendering: createComputeWatermarkRenderingUseCase(),
  };

  return photoEditorModule;
}

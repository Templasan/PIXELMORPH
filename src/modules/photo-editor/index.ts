import { AsyncStoragePresetsRepository } from './infrastructure/AsyncStoragePresetsRepository';
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
  createValidateQRCodeUseCase,
  createSaveWatermarkPresetUseCase,
  createListWatermarkPresetsUseCase,
} from './application';

// Core exports — domain (pure), application (hooks), infrastructure (platform adapters)
export * from './domain';
export * from './application';
export * from './infrastructure';

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
  validateQRCode: ReturnType<typeof createValidateQRCodeUseCase>;
  saveWatermarkPreset: ReturnType<typeof createSaveWatermarkPresetUseCase>;
  listWatermarkPresets: ReturnType<typeof createListWatermarkPresetsUseCase>;
};

let photoEditorModule: PhotoEditorModule | null = null;

export function createPhotoEditorModule(): PhotoEditorModule {
  if (photoEditorModule) return photoEditorModule;

  const presetsRepo = new AsyncStoragePresetsRepository();
  const {
    AsyncStorageWatermarkPresetsRepository,
  } = require('./infrastructure/AsyncStorageWatermarkPresetsRepository');
  const watermarkPresetsRepo = new AsyncStorageWatermarkPresetsRepository();

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
    validateQRCode: createValidateQRCodeUseCase(),
    saveWatermarkPreset: createSaveWatermarkPresetUseCase(watermarkPresetsRepo),
    listWatermarkPresets: createListWatermarkPresetsUseCase(watermarkPresetsRepo),
  };

  return photoEditorModule;
}

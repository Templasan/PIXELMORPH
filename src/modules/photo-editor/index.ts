import { AsyncStoragePresetsRepository } from '@infrastructure/repositories/AsyncStoragePresetsRepository';
import {
  createSavePresetUseCase,
  createListPresetsUseCase,
  createApplyBrushStrokeUseCase,
} from './application';

export * from './spike';
export * from './domain';

type PhotoEditorModule = {
  savePreset: ReturnType<typeof createSavePresetUseCase>;
  listPresets: ReturnType<typeof createListPresetsUseCase>;
  applyBrushStroke: ReturnType<typeof createApplyBrushStrokeUseCase>;
};

let photoEditorModule: PhotoEditorModule | null = null;

export function createPhotoEditorModule(): PhotoEditorModule {
  if (photoEditorModule) return photoEditorModule;

  const presetsRepo = new AsyncStoragePresetsRepository();

  photoEditorModule = {
    savePreset: createSavePresetUseCase(presetsRepo),
    listPresets: createListPresetsUseCase(presetsRepo),
    applyBrushStroke: createApplyBrushStrokeUseCase(),
  };

  return photoEditorModule;
}

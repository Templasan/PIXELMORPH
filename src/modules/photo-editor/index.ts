import { AsyncStoragePresetsRepository } from '@infrastructure/repositories/AsyncStoragePresetsRepository';
import { createSavePresetUseCase, createListPresetsUseCase } from './application';

export * from './spike';

type PhotoEditorModule = {
  savePreset: ReturnType<typeof createSavePresetUseCase>;
  listPresets: ReturnType<typeof createListPresetsUseCase>;
};

let photoEditorModule: PhotoEditorModule | null = null;

export function createPhotoEditorModule(): PhotoEditorModule {
  if (photoEditorModule) return photoEditorModule;

  const presetsRepo = new AsyncStoragePresetsRepository();

  photoEditorModule = {
    savePreset: createSavePresetUseCase(presetsRepo),
    listPresets: createListPresetsUseCase(presetsRepo),
  };

  return photoEditorModule;
}

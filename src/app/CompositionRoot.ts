import { AsyncStoragePresetsRepository } from '@infrastructure/repositories/AsyncStoragePresetsRepository';
import { AsyncStorageRecentAdjustmentsRepository } from '@infrastructure/repositories/AsyncStorageRecentAdjustmentsRepository';
import { AsyncStorageWatermarkPresetsRepository } from '@infrastructure/repositories/AsyncStorageWatermarkPresetsRepository';

import { createProjectsModule } from '@modules/projects';
import { createPhotoEditorModule } from '@modules/photo-editor';
import { VideoEditorModuleFactory } from '@modules/video-editor';

/**
 * Global composition root. Instantiates all modules and their adapters.
 * This is the single place where dependency injection happens.
 * Screens and components should only call use cases through these module instances.
 */
export const AppCompositionRoot = {
  projects: createProjectsModule(),

  photoEditor: createPhotoEditorModule(
    new AsyncStoragePresetsRepository(),
    new AsyncStorageRecentAdjustmentsRepository(),
    new AsyncStorageWatermarkPresetsRepository()
  ),

  videoEditor: VideoEditorModuleFactory.createVideoEditorModule(),
};

export type AppCompositionRootType = typeof AppCompositionRoot;

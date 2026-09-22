import { createProjectsModule } from '@modules/projects';
import { PhotoEditorModuleFactory } from '@modules/photo-editor';
import { VideoEditorModuleFactory } from '@modules/video-editor';
import { CameraModuleFactory } from '@modules/camera';
import { AudioModuleFactory } from '@modules/audio';
import { ExportModuleFactory } from '@modules/export';
import { AIModuleFactory } from '@modules/ai';
import { AsyncStoragePresetsRepository } from '@infrastructure/repositories/AsyncStoragePresetsRepository';
import { AsyncStorageRecentAdjustmentsRepository } from '@infrastructure/repositories/AsyncStorageRecentAdjustmentsRepository';
import { AsyncStorageWatermarkPresetsRepository } from '@infrastructure/repositories/AsyncStorageWatermarkPresetsRepository';

/**
 * Global composition root. Instantiates all modules and their adapters.
 * This is the single place where dependency injection happens.
 * Screens and components should only call use cases through these module instances.
 */
export const AppCompositionRoot = {
  projects: createProjectsModule(),

  photoEditor: PhotoEditorModuleFactory.createPhotoEditorModule(
    new AsyncStoragePresetsRepository(),
    new AsyncStorageRecentAdjustmentsRepository(),
    new AsyncStorageWatermarkPresetsRepository()
  ),

  camera: CameraModuleFactory.createCameraModule(),
  audio: AudioModuleFactory.createAudioModule(),
  export: ExportModuleFactory.createExportModule(),
  ai: AIModuleFactory.createAIModule(),

  videoEditor: VideoEditorModuleFactory.createVideoEditorModule(),
};

export type AppCompositionRootType = typeof AppCompositionRoot;

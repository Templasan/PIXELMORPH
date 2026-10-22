// Domain, Ports, Application, Infrastructure exports
// Legacy factory for backward compatibility
import { LocalProjectRepository } from './infrastructure/repositories/LocalProjectRepository';
import { FileSystemMediaFileStore } from './infrastructure/FileSystemMediaFileStore';
import { repairCacheMedia } from './infrastructure/repairCacheMedia';
import * as FileSystem from 'expo-file-system/legacy';
import {
  ListProjectsUseCase,
  GetProjectUseCase,
  CreateProjectUseCase,
  CreateProjectWithMediaUseCase,
  UpdateProjectUseCase,
  DeleteProjectUseCase,
  ArchiveProjectUseCase,
  UnarchiveProjectUseCase,
  AddMediaAssetUseCase,
  RemoveMediaAssetUseCase,
  UpdateMediaAssetUseCase,
  ApplyAdjustmentsBatchUseCase,
} from './application/usecases';

export * from './domain';
export * from './ports';
export * from './application';
export * from './infrastructure';

/** Composition root for the Projects module — wires the local repository to every use case. */
export function createProjectsModule() {
  const repository = new LocalProjectRepository();
  const files = new FileSystemMediaFileStore();

  return {
    repository,
    listProjects: new ListProjectsUseCase(repository),
    getProject: new GetProjectUseCase(repository),
    createProject: new CreateProjectUseCase(repository),
    /** Creates a project and copies its media first; nothing is left behind if the import fails. */
    createProjectWithMedia: new CreateProjectWithMediaUseCase(repository, files),
    updateProject: new UpdateProjectUseCase(repository, files),
    deleteProject: new DeleteProjectUseCase(repository, files),
    archiveProject: new ArchiveProjectUseCase(repository),
    unarchiveProject: new UnarchiveProjectUseCase(repository),
    addMediaAsset: new AddMediaAssetUseCase(repository, files),
    removeMediaAsset: new RemoveMediaAssetUseCase(repository),
    updateMediaAsset: new UpdateMediaAssetUseCase(repository, files),
    applyAdjustmentsBatch: new ApplyAdjustmentsBatchUseCase(repository),
    /** Copies media still referenced from the cache into permanent storage (see repairCacheMedia). */
    repairCacheMedia: () => repairCacheMedia(files, FileSystem.cacheDirectory ?? ''),
  };
}

export type ProjectsModule = ReturnType<typeof createProjectsModule>;

import { LocalProjectRepository } from './infrastructure/repositories/LocalProjectRepository';
import {
  ListProjectsUseCase,
  GetProjectUseCase,
  CreateProjectUseCase,
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

  return {
    repository,
    listProjects: new ListProjectsUseCase(repository),
    getProject: new GetProjectUseCase(repository),
    createProject: new CreateProjectUseCase(repository),
    updateProject: new UpdateProjectUseCase(repository),
    deleteProject: new DeleteProjectUseCase(repository),
    archiveProject: new ArchiveProjectUseCase(repository),
    unarchiveProject: new UnarchiveProjectUseCase(repository),
    addMediaAsset: new AddMediaAssetUseCase(repository),
    removeMediaAsset: new RemoveMediaAssetUseCase(repository),
    updateMediaAsset: new UpdateMediaAssetUseCase(repository),
    applyAdjustmentsBatch: new ApplyAdjustmentsBatchUseCase(repository),
  };
}

export type ProjectsModule = ReturnType<typeof createProjectsModule>;

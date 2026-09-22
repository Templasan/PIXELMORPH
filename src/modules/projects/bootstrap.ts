import { ProjectRepository } from './ports';
import { LocalProjectRepository } from './infrastructure';
import {
  CreateProjectUseCase,
  ListProjectsUseCase,
  GetProjectUseCase,
  UpdateProjectUseCase,
  DeleteProjectUseCase,
  ArchiveProjectUseCase,
  UnarchiveProjectUseCase,
  AddMediaAssetUseCase,
  RemoveMediaAssetUseCase,
  UpdateMediaAssetUseCase,
  ApplyAdjustmentsBatchUseCase,
} from './application/usecases';

/** Composition root for the projects module. Instantiates repositories and use cases. */
export class ProjectsModuleFactory {
  private static repository: ProjectRepository | null = null;

  static createRepository(): ProjectRepository {
    if (!this.repository) {
      this.repository = new LocalProjectRepository();
    }
    return this.repository;
  }

  static createCreateProjectUseCase(): CreateProjectUseCase {
    return new CreateProjectUseCase(this.createRepository());
  }

  static createListProjectsUseCase(): ListProjectsUseCase {
    return new ListProjectsUseCase(this.createRepository());
  }

  static createGetProjectUseCase(): GetProjectUseCase {
    return new GetProjectUseCase(this.createRepository());
  }

  static createUpdateProjectUseCase(): UpdateProjectUseCase {
    return new UpdateProjectUseCase(this.createRepository());
  }

  static createDeleteProjectUseCase(): DeleteProjectUseCase {
    return new DeleteProjectUseCase(this.createRepository());
  }

  static createArchiveProjectUseCase(): ArchiveProjectUseCase {
    return new ArchiveProjectUseCase(this.createRepository());
  }

  static createUnarchiveProjectUseCase(): UnarchiveProjectUseCase {
    return new UnarchiveProjectUseCase(this.createRepository());
  }

  static createAddMediaAssetUseCase(): AddMediaAssetUseCase {
    return new AddMediaAssetUseCase(this.createRepository());
  }

  static createRemoveMediaAssetUseCase(): RemoveMediaAssetUseCase {
    return new RemoveMediaAssetUseCase(this.createRepository());
  }

  static createUpdateMediaAssetUseCase(): UpdateMediaAssetUseCase {
    return new UpdateMediaAssetUseCase(this.createRepository());
  }

  static createApplyAdjustmentsBatchUseCase(): ApplyAdjustmentsBatchUseCase {
    return new ApplyAdjustmentsBatchUseCase(this.createRepository());
  }
}

import { ProjectRepository, type MediaFileStore } from '../../ports';
import { Project, MediaAsset, addAssetToProject, createProject } from '../../domain';
import { ProjectType } from '../../domain/types';
import { generateProjectId } from './CreateProjectUseCase';
import { persistAssetFiles } from './AddMediaAssetUseCase';

/**
 * Creates a project with its media. Every file is copied into the project's folder before the
 * project is saved; if any copy or the save fails, the project and its folder are removed and the
 * original error is rethrown. A failed import therefore leaves nothing behind.
 */
export class CreateProjectWithMediaUseCase {
  constructor(
    private repository: ProjectRepository,
    private files: MediaFileStore
  ) {}

  async execute(name: string, type: ProjectType, media: MediaAsset[]): Promise<Project> {
    const id = generateProjectId();
    try {
      let project = createProject(id, name, type);
      for (const asset of media) {
        project = addAssetToProject(project, await persistAssetFiles(this.files, id, asset));
      }
      await this.repository.create(project);
      return project;
    } catch (error) {
      // Best effort: the original error is what the caller should report.
      await this.repository.delete(id).catch(() => undefined);
      await this.files.removeProjectFiles(id).catch(() => undefined);
      throw error;
    }
  }
}

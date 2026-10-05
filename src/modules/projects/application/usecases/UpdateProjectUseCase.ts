import { ProjectRepository, ProjectNotFoundError, type MediaFileStore } from '../../ports';
import { Project, ProjectPriority, updateProject } from '../../domain';
import { ProjectStatus, ProjectType } from '../../domain/types';

export interface UpdateProjectInput {
  name?: string;
  type?: ProjectType;
  status?: ProjectStatus;
  thumbnailUri?: string;
  dueDate?: Date | null;
  priority?: ProjectPriority | null;
}

export class UpdateProjectUseCase {
  constructor(
    private repository: ProjectRepository,
    private files: MediaFileStore
  ) {}

  async execute(id: string, input: UpdateProjectInput): Promise<Project> {
    const project = await this.repository.findById(id);
    if (!project) {
      throw new ProjectNotFoundError(id);
    }

    // A thumbnail is a file the project owns (never inline base64 in the project record: it
    // bloats every list/backup and can push the value past Android's ~2 MB read limit).
    if (input.thumbnailUri?.startsWith('data:')) {
      throw new Error('UpdateProject: thumbnailUri must be a file URI, not inline data');
    }
    const thumbnailUri = input.thumbnailUri && (await this.files.persist(input.thumbnailUri, id));

    const updated = updateProject(project, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.status !== undefined && { status: input.status }),
      ...(thumbnailUri && { thumbnailUri }),
      ...(input.dueDate !== undefined && { dueDate: input.dueDate ?? undefined }),
      ...(input.priority !== undefined && { priority: input.priority ?? undefined }),
    });

    await this.repository.update(updated);

    return updated;
  }
}

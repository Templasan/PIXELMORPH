import { ProjectRepository, ProjectNotFoundError } from '../../ports';
import { Project, ProjectPriority, updateProject } from '../../domain';
import { ProjectStatus, ProjectType } from '../../domain/types';

export interface UpdateProjectInput {
  name?: string;
  type?: ProjectType;
  status?: ProjectStatus;
  thumbnailUri?: string;
  /** RF-070: deadline for a pending project reminder. Pass null to clear it. */
  dueDate?: Date | null;
  /** RF-070: reminder priority. Pass null to clear it. */
  priority?: ProjectPriority | null;
}

export class UpdateProjectUseCase {
  constructor(private repository: ProjectRepository) {}

  async execute(id: string, input: UpdateProjectInput): Promise<Project> {
    const project = await this.repository.findById(id);
    if (!project) {
      throw new ProjectNotFoundError(id);
    }

    const updated = updateProject(project, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.thumbnailUri !== undefined && { thumbnailUri: input.thumbnailUri }),
      ...(input.dueDate !== undefined && { dueDate: input.dueDate ?? undefined }),
      ...(input.priority !== undefined && { priority: input.priority ?? undefined }),
    });

    await this.repository.update(updated);

    return updated;
  }
}

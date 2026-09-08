import { ProjectRepository, ProjectNotFoundError } from '../../ports';
import { Project, updateProject } from '../../domain';

export interface UpdateProjectInput {
  name?: string;
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
    });

    await this.repository.update(updated);

    return updated;
  }
}

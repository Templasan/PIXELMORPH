import { ProjectRepository } from '../../ports';
import { Project, createProject } from '../../domain';
import { ProjectType } from '../../domain/types';

export class CreateProjectUseCase {
  constructor(private repository: ProjectRepository) {}

  async execute(name: string, type: ProjectType): Promise<Project> {
    const id = this.generateId();
    const project = createProject(id, name, type);

    await this.repository.create(project);

    return project;
  }

  private generateId(): string {
    // Simple UUID v4 generation using built-in crypto
    // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    let uuid = '';
    for (let i = 0; i < 32; i++) {
      const random = Math.floor(Math.random() * 16);
      if (i === 12) {
        uuid += '4';
      } else if (i === 16) {
        uuid += ((random & 3) | 8).toString(16);
      } else {
        uuid += random.toString(16);
      }

      if ([8, 12, 16, 20].includes(i)) {
        uuid += '-';
      }
    }
    return uuid;
  }
}

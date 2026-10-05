import { DeleteProjectUseCase } from './DeleteProjectUseCase';
import { createProject } from '../../domain/entities/Project';
import { ProjectNotFoundError } from '../../ports';
import type { Project } from '../../domain';
import type { ProjectRepository, MediaFileStore } from '../../ports';

const genId = () => `proj_${Math.random().toString(36).substr(2, 9)}`;

class MockProjectRepository implements ProjectRepository {
  private projects = new Map<string, Project>();

  async create(project: Project): Promise<void> {
    this.projects.set(project.id, project);
  }

  async findById(id: string): Promise<Project | null> {
    return this.projects.get(id) ?? null;
  }

  async findAll(): Promise<Project[]> {
    return Array.from(this.projects.values());
  }

  async findByType(type: Project['type']): Promise<Project[]> {
    return Array.from(this.projects.values()).filter((p) => p.type === type);
  }

  async findByStatus(status: Project['status']): Promise<Project[]> {
    return Array.from(this.projects.values()).filter((p) => p.status === status);
  }

  async update(project: Project): Promise<void> {
    this.projects.set(project.id, project);
  }

  async delete(id: string): Promise<void> {
    this.projects.delete(id);
  }

  async archive(id: string): Promise<void> {
    const project = this.projects.get(id);
    if (project) project.status = 'archived';
  }

  async unarchive(id: string): Promise<void> {
    const project = this.projects.get(id);
    if (project) project.status = 'active';
  }
}

describe('DeleteProjectUseCase', () => {
  let repository: MockProjectRepository;
  let useCase: DeleteProjectUseCase;
  let files: MediaFileStore;

  beforeEach(() => {
    repository = new MockProjectRepository();
    files = {
      persist: jest.fn(),
      isPersisted: jest.fn(),
      exists: jest.fn(),
      removeProjectFiles: jest.fn(async () => {}),
    };
    useCase = new DeleteProjectUseCase(repository, files);
  });

  it('should delete existing project', async () => {
    const project = createProject(genId(), 'Test', 'photo');
    await repository.create(project);

    await useCase.execute(project.id);

    const found = await repository.findById(project.id);
    expect(found).toBeNull();
  });

  it('should delete project and not affect others', async () => {
    const p1 = createProject(genId(), 'P1', 'photo');
    const p2 = createProject(genId(), 'P2', 'photo');

    await repository.create(p1);
    await repository.create(p2);

    await useCase.execute(p1.id);

    const remaining = await repository.findAll();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(p2.id);
  });

  it('should throw ProjectNotFoundError for non-existent project', async () => {
    await expect(useCase.execute('non-existent-id')).rejects.toThrow(ProjectNotFoundError);
  });

  it('should throw when deleting the same project twice', async () => {
    const project = createProject(genId(), 'Test', 'photo');
    await repository.create(project);

    await useCase.execute(project.id);
    await expect(useCase.execute(project.id)).rejects.toThrow(ProjectNotFoundError);
  });

  it('should delete from multiple projects', async () => {
    const p1 = createProject(genId(), 'P1', 'photo');
    const p2 = createProject(genId(), 'P2', 'photo');
    const p3 = createProject(genId(), 'P3', 'photo');

    await repository.create(p1);
    await repository.create(p2);
    await repository.create(p3);

    await useCase.execute(p2.id);

    const remaining = await repository.findAll();
    expect(remaining).toHaveLength(2);
    expect(remaining.map((p) => p.id).sort()).toEqual([p1.id, p3.id].sort());
  });

  it('should throw for empty ID', async () => {
    await expect(useCase.execute('')).rejects.toThrow(ProjectNotFoundError);
  });

  it('should delete project with assets', async () => {
    const project = createProject(genId(), 'Test', 'photo');
    project.assets = [
      {
        id: 'a1',
        type: 'image',
        originalUri: 'uri1',
        workingUri: 'uri1',
        metadata: { mimeType: 'image/jpeg' },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    await repository.create(project);
    await useCase.execute(project.id);

    const found = await repository.findById(project.id);
    expect(found).toBeNull();
  });
});

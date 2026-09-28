import { CreateProjectUseCase } from './CreateProjectUseCase';
import type { Project } from '../../domain';
import type { ProjectRepository } from '../../ports';

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

describe('CreateProjectUseCase', () => {
  let repository: MockProjectRepository;
  let useCase: CreateProjectUseCase;

  beforeEach(() => {
    repository = new MockProjectRepository();
    useCase = new CreateProjectUseCase(repository);
  });

  it('should create a new project', async () => {
    const result = await useCase.execute('My Project', 'photo');

    expect(result).toBeDefined();
    expect(result.name).toBe('My Project');
    expect(result.type).toBe('photo');
    expect(result.id).toBeDefined();
  });

  it('should save project to repository', async () => {
    const result = await useCase.execute('Test', 'video');
    const saved = await repository.findById(result.id);

    expect(saved).toBeDefined();
    expect(saved?.name).toBe('Test');
    expect(saved?.type).toBe('video');
  });

  it('should create photo project', async () => {
    const result = await useCase.execute('Photo Project', 'photo');
    expect(result.type).toBe('photo');
  });

  it('should create video project', async () => {
    const result = await useCase.execute('Video Project', 'video');
    expect(result.type).toBe('video');
  });

  it('should generate unique IDs', async () => {
    const p1 = await useCase.execute('P1', 'photo');
    const p2 = await useCase.execute('P2', 'photo');

    expect(p1.id).not.toBe(p2.id);
  });

  it('should create with long name', async () => {
    const longName = 'A'.repeat(500);
    const result = await useCase.execute(longName, 'photo');
    expect(result.name).toBe(longName);
  });

  it('should set active status', async () => {
    const result = await useCase.execute('Test', 'photo');
    expect(result.status).toBe('active');
  });

  it('should have created and updated timestamps', async () => {
    const result = await useCase.execute('Test', 'photo');
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
  });

  it('should persist multiple projects', async () => {
    await useCase.execute('P1', 'photo');
    await useCase.execute('P2', 'video');
    await useCase.execute('P3', 'photo');

    const all = await repository.findAll();
    expect(all).toHaveLength(3);
  });

  it('should be queryable after creation', async () => {
    const created = await useCase.execute('Queryable', 'photo');
    const found = await repository.findById(created.id);

    expect(found).toBeDefined();
    expect(found?.name).toBe('Queryable');
  });
});

import { listProjectsUseCase } from './ListProjectsUseCase';
import { createProject } from '../../domain/entities/Project';
import type { ProjectRepository } from '../../ports';

const genId = () => `proj_${Math.random().toString(36).substr(2, 9)}`;

class MockProjectRepository implements ProjectRepository {
  private projects: any[] = [];

  async save(project: any): Promise<void> {
    this.projects.push(project);
  }

  async findById(id: string): Promise<any | undefined> {
    return this.projects.find((p) => p.id === id);
  }

  async findAll(): Promise<any[]> {
    return this.projects;
  }

  async findByStatus(status?: string): Promise<any[]> {
    if (!status) return this.projects;
    return this.projects.filter((p) => p.status === status);
  }

  async delete(id: string): Promise<void> {
    this.projects = this.projects.filter((p) => p.id !== id);
  }
}

describe('ListProjectsUseCase', () => {
  let repository: MockProjectRepository;
  let useCase: ReturnType<typeof listProjectsUseCase>;

  beforeEach(() => {
    repository = new MockProjectRepository();
    useCase = listProjectsUseCase(repository);
  });

  it('should list empty projects', async () => {
    const result = await useCase.execute({ status: 'active' });
    expect(result).toEqual([]);
  });

  it('should list single project', async () => {
    const project = createProject(genId(), 'Test', 'photo');
    await repository.save(project);

    const result = await useCase.execute({ status: 'active' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Test');
  });

  it('should list multiple projects', async () => {
    const p1 = createProject(genId(), 'P1', 'photo');
    const p2 = createProject(genId(), 'P2', 'video');
    const p3 = createProject(genId(), 'P3', 'photo');

    await repository.save(p1);
    await repository.save(p2);
    await repository.save(p3);

    const result = await useCase.execute({ status: 'active' });
    expect(result).toHaveLength(3);
  });

  it('should filter by active status', async () => {
    const p1 = createProject(genId(), 'Active', 'photo');
    p1.status = 'active';
    const p2 = createProject(genId(), 'Archived', 'photo');
    p2.status = 'archived';

    await repository.save(p1);
    await repository.save(p2);

    const result = await useCase.execute({ status: 'active' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Active');
  });

  it('should filter by archived status', async () => {
    const p1 = createProject(genId(), 'Active', 'photo');
    p1.status = 'active';
    const p2 = createProject(genId(), 'Archived', 'photo');
    p2.status = 'archived';

    await repository.save(p1);
    await repository.save(p2);

    const result = await useCase.execute({ status: 'archived' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Archived');
  });

  it('should preserve project properties', async () => {
    const project = createProject(genId(), 'Test', 'photo');
    project.priority = 'high';

    await repository.save(project);

    const result = await useCase.execute({ status: 'active' });
    expect(result[0].priority).toBe('high');
  });

  it('should handle multiple calls', async () => {
    const p1 = createProject(genId(), 'P1', 'photo');
    await repository.save(p1);

    const result1 = await useCase.execute({ status: 'active' });
    expect(result1).toHaveLength(1);

    const p2 = createProject(genId(), 'P2', 'photo');
    await repository.save(p2);

    const result2 = await useCase.execute({ status: 'active' });
    expect(result2).toHaveLength(2);
  });

  it('should return new array on each call', async () => {
    const project = createProject(genId(), 'Test', 'photo');
    await repository.save(project);

    const result1 = await useCase.execute({ status: 'active' });
    const result2 = await useCase.execute({ status: 'active' });

    expect(result1).not.toBe(result2);
  });

  it('should list all types mixed', async () => {
    const photo = createProject(genId(), 'Photo', 'photo');
    const video = createProject(genId(), 'Video', 'video');

    await repository.save(photo);
    await repository.save(video);

    const result = await useCase.execute({ status: 'active' });
    expect(result).toHaveLength(2);
    expect(result.some((p) => p.type === 'photo')).toBe(true);
    expect(result.some((p) => p.type === 'video')).toBe(true);
  });
});

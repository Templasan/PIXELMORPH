import { ListProjectsUseCase } from './ListProjectsUseCase';
import { createProject } from '../../domain/entities/Project';
import type { Project } from '../../domain';
import type { ProjectRepository } from '../../ports';

const genId = () => `proj_${Math.random().toString(36).substr(2, 9)}`;

class MockProjectRepository implements ProjectRepository {
  private projects: Project[] = [];

  async create(project: Project): Promise<void> {
    this.projects.push(project);
  }

  async findById(id: string): Promise<Project | null> {
    return this.projects.find((p) => p.id === id) ?? null;
  }

  async findAll(): Promise<Project[]> {
    return [...this.projects];
  }

  async findByType(type: Project['type']): Promise<Project[]> {
    return this.projects.filter((p) => p.type === type);
  }

  async findByStatus(status: Project['status']): Promise<Project[]> {
    return this.projects.filter((p) => p.status === status);
  }

  async update(project: Project): Promise<void> {
    const index = this.projects.findIndex((p) => p.id === project.id);
    if (index !== -1) this.projects[index] = project;
  }

  async delete(id: string): Promise<void> {
    this.projects = this.projects.filter((p) => p.id !== id);
  }

  async archive(id: string): Promise<void> {
    const project = this.projects.find((p) => p.id === id);
    if (project) project.status = 'archived';
  }

  async unarchive(id: string): Promise<void> {
    const project = this.projects.find((p) => p.id === id);
    if (project) project.status = 'active';
  }
}

describe('ListProjectsUseCase', () => {
  let repository: MockProjectRepository;
  let useCase: ListProjectsUseCase;

  beforeEach(() => {
    repository = new MockProjectRepository();
    useCase = new ListProjectsUseCase(repository);
  });

  it('should list empty projects', async () => {
    const result = await useCase.execute({ status: 'active' });
    expect(result).toEqual([]);
  });

  it('should list single project', async () => {
    const project = createProject(genId(), 'Test', 'photo');
    await repository.create(project);

    const result = await useCase.execute({ status: 'active' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Test');
  });

  it('should list multiple projects', async () => {
    const p1 = createProject(genId(), 'P1', 'photo');
    const p2 = createProject(genId(), 'P2', 'video');
    const p3 = createProject(genId(), 'P3', 'photo');

    await repository.create(p1);
    await repository.create(p2);
    await repository.create(p3);

    const result = await useCase.execute({ status: 'active' });
    expect(result).toHaveLength(3);
  });

  it('should filter by active status', async () => {
    const p1 = createProject(genId(), 'Active', 'photo');
    const p2 = createProject(genId(), 'Archived', 'photo');
    p2.status = 'archived';

    await repository.create(p1);
    await repository.create(p2);

    const result = await useCase.execute({ status: 'active' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Active');
  });

  it('should filter by archived status', async () => {
    const p1 = createProject(genId(), 'Active', 'photo');
    const p2 = createProject(genId(), 'Archived', 'photo');
    p2.status = 'archived';

    await repository.create(p1);
    await repository.create(p2);

    const result = await useCase.execute({ status: 'archived' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Archived');
  });

  it('should preserve project properties', async () => {
    const project = createProject(genId(), 'Test', 'photo');
    project.priority = 'high';

    await repository.create(project);

    const result = await useCase.execute({ status: 'active' });
    expect(result[0].priority).toBe('high');
  });

  it('should handle multiple calls', async () => {
    const p1 = createProject(genId(), 'P1', 'photo');
    await repository.create(p1);

    const result1 = await useCase.execute({ status: 'active' });
    expect(result1).toHaveLength(1);

    const p2 = createProject(genId(), 'P2', 'photo');
    await repository.create(p2);

    const result2 = await useCase.execute({ status: 'active' });
    expect(result2).toHaveLength(2);
  });

  it('should list all types mixed', async () => {
    const photo = createProject(genId(), 'Photo', 'photo');
    const video = createProject(genId(), 'Video', 'video');

    await repository.create(photo);
    await repository.create(video);

    const result = await useCase.execute({ status: 'active' });
    expect(result).toHaveLength(2);
    expect(result.some((p) => p.type === 'photo')).toBe(true);
    expect(result.some((p) => p.type === 'video')).toBe(true);
  });

  it('should filter by type', async () => {
    const photo = createProject(genId(), 'Photo', 'photo');
    const video = createProject(genId(), 'Video', 'video');

    await repository.create(photo);
    await repository.create(video);

    const result = await useCase.execute({ type: 'photo' });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('photo');
  });
});

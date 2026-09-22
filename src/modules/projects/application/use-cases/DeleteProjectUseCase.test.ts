import { deleteProjectUseCase } from './DeleteProjectUseCase';
import { createProject } from '../../domain/entities/Project';
import type { ProjectRepository } from '../../ports';

const genId = () => `proj_${Math.random().toString(36).substr(2, 9)}`;

class MockProjectRepository implements ProjectRepository {
  private projects = new Map<string, any>();

  async save(project: any): Promise<void> {
    this.projects.set(project.id, project);
  }

  async findById(id: string): Promise<any | undefined> {
    return this.projects.get(id);
  }

  async findAll(): Promise<any[]> {
    return Array.from(this.projects.values());
  }

  async findByStatus(): Promise<any[]> {
    return Array.from(this.projects.values());
  }

  async delete(id: string): Promise<void> {
    this.projects.delete(id);
  }
}

describe('DeleteProjectUseCase', () => {
  let repository: MockProjectRepository;
  let useCase: ReturnType<typeof deleteProjectUseCase>;

  beforeEach(() => {
    repository = new MockProjectRepository();
    useCase = deleteProjectUseCase(repository);
  });

  it('should delete existing project', async () => {
    const project = createProject(genId(), 'Test', 'photo');
    await repository.save(project);

    await useCase.execute(project.id);

    const found = await repository.findById(project.id);
    expect(found).toBeUndefined();
  });

  it('should delete project and not affect others', async () => {
    const p1 = createProject(genId(), 'P1', 'photo');
    const p2 = createProject(genId(), 'P2', 'photo');

    await repository.save(p1);
    await repository.save(p2);

    await useCase.execute(p1.id);

    const remaining = await repository.findAll();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(p2.id);
  });

  it('should handle deleting non-existent project gracefully', async () => {
    // Should not throw
    await expect(useCase.execute('non-existent-id')).resolves.not.toThrow();
  });

  it('should allow double delete', async () => {
    const project = createProject(genId(), 'Test', 'photo');
    await repository.save(project);

    await useCase.execute(project.id);
    await expect(useCase.execute(project.id)).resolves.not.toThrow();
  });

  it('should delete from multiple projects', async () => {
    const p1 = createProject(genId(), 'P1', 'photo');
    const p2 = createProject(genId(), 'P2', 'photo');
    const p3 = createProject(genId(), 'P3', 'photo');

    await repository.save(p1);
    await repository.save(p2);
    await repository.save(p3);

    await useCase.execute(p2.id);

    const remaining = await repository.findAll();
    expect(remaining).toHaveLength(2);
    expect(remaining.map((p) => p.id)).toEqual([p1.id, p3.id]);
  });

  it('should handle empty ID', async () => {
    await expect(useCase.execute('')).resolves.not.toThrow();
  });

  it('should handle null/undefined gracefully', async () => {
    await expect(useCase.execute(null as any)).rejects.toThrow();
    await expect(useCase.execute(undefined as any)).rejects.toThrow();
  });

  it('should delete project with assets', async () => {
    const project = createProject(genId(), 'Test', 'photo');
    project.assets = [
      { id: 'a1', type: 'image', originalUri: 'uri1', workingUri: 'uri1' },
    ];

    await repository.save(project);
    await useCase.execute(project.id);

    const found = await repository.findById(project.id);
    expect(found).toBeUndefined();
  });
});

import { CreateProjectWithMediaUseCase } from './CreateProjectWithMediaUseCase';
import { createMediaAsset } from '../../domain/entities/MediaAsset';
import { createMediaMetadata } from '../../domain/entities/MediaMetadata';
import type { Project } from '../../domain';
import type { MediaFileStore, ProjectRepository } from '../../ports';

class MemoryRepo {
  projects = new Map<string, Project>();
  async create(p: Project) {
    this.projects.set(p.id, p);
  }
  async delete(id: string) {
    this.projects.delete(id);
  }
}

/** Fake media store: `folders` maps each project id to the files in its media folder. */
function fakeStore(failOn?: string) {
  const folders = new Map<string, string[]>();
  const store: MediaFileStore = {
    isPersisted: (uri) => uri.startsWith('perm://'),
    exists: async () => true,
    persist: async (uri, projectId) => {
      if (uri === failOn) throw new Error('ENOSPC: no space left on device');
      const file = `${projectId}/${uri.split('/').pop()}`;
      folders.set(projectId, [...(folders.get(projectId) ?? []), file]);
      return `perm://${file}`;
    },
    removeProjectFiles: async (projectId) => {
      folders.delete(projectId);
    },
  };
  return { store, folders };
}

const asset = (id: string, uri: string) =>
  createMediaAsset(id, 'image', uri, uri, createMediaMetadata('image/jpeg', {}));

describe('CreateProjectWithMediaUseCase', () => {
  it('persists the project with its media copied into the project folder', async () => {
    const repo = new MemoryRepo();
    const { store, folders } = fakeStore();
    const project = await new CreateProjectWithMediaUseCase(
      repo as unknown as ProjectRepository,
      store
    ).execute('Praia', 'photo', [asset('a1', 'file:///cache/a.jpg')]);

    expect(repo.projects.get(project.id)).toBe(project);
    expect(project.assets[0].originalUri).toBe(`perm://${project.id}/a.jpg`);
    expect(folders.get(project.id)).toEqual([`${project.id}/a.jpg`]);
  });

  it('a failed media copy leaves no project and no media folder', async () => {
    const repo = new MemoryRepo();
    const { store, folders } = fakeStore('file:///cache/big.mp4');
    const useCase = new CreateProjectWithMediaUseCase(repo as unknown as ProjectRepository, store);

    await expect(
      useCase.execute('Video', 'video', [
        asset('a1', 'file:///cache/first.jpg'),
        asset('a2', 'file:///cache/big.mp4'),
      ])
    ).rejects.toThrow('ENOSPC');

    expect(repo.projects.size).toBe(0);
    expect(folders.size).toBe(0);
  });

  it('a failed save leaves no media folder behind either', async () => {
    const repo = new MemoryRepo();
    repo.create = async () => {
      throw new Error('storage full');
    };
    const { store, folders } = fakeStore();

    await expect(
      new CreateProjectWithMediaUseCase(repo as unknown as ProjectRepository, store).execute(
        'Foto',
        'photo',
        [asset('a1', 'file:///cache/a.jpg')]
      )
    ).rejects.toThrow('storage full');

    expect(repo.projects.size).toBe(0);
    expect(folders.size).toBe(0);
  });
});

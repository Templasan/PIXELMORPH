import { AddMediaAssetUseCase } from './AddMediaAssetUseCase';
import { DeleteProjectUseCase } from './DeleteProjectUseCase';
import { PersistProjectMediaUseCase } from './PersistProjectMediaUseCase';
import { createProject } from '../../domain/entities/Project';
import { createMediaAsset } from '../../domain/entities/MediaAsset';
import { createMediaMetadata } from '../../domain/entities/MediaMetadata';
import type { Project } from '../../domain';
import type { MediaFileStore, ProjectRepository } from '../../ports';

// Media captured by the camera / picker / collage arrives in the cache, which Android and
// "Limpar cache" can wipe; projects must reference a permanent copy instead.

class MemoryRepo implements Pick<ProjectRepository, 'findById' | 'findAll' | 'update' | 'delete'> {
  projects = new Map<string, Project>();
  async findById(id: string) {
    return this.projects.get(id) ?? null;
  }
  async findAll() {
    return [...this.projects.values()];
  }
  async update(p: Project) {
    this.projects.set(p.id, p);
  }
  async delete(id: string) {
    this.projects.delete(id);
  }
}

/** Fake store: "permanent" URIs start with perm://; `existing` lists cache files still on disk. */
function fakeStore(existing: string[] = []) {
  const removed: string[] = [];
  const store: MediaFileStore = {
    isPersisted: (uri) => uri.startsWith('perm://'),
    exists: async (uri) => uri.startsWith('perm://') || existing.includes(uri),
    persist: async (uri, projectId) =>
      uri.startsWith('perm://') ? uri : `perm://${projectId}/${uri.split('/').pop()}`,
    removeProjectFiles: async (projectId) => {
      removed.push(projectId);
    },
  };
  return { store, removed };
}

const asset = (id: string, original: string, working = original) =>
  createMediaAsset(id, 'image', original, working, createMediaMetadata('image/jpeg', {}));

function setup(existing?: string[]) {
  const repo = new MemoryRepo();
  const project = createProject('p1', 'Foto', 'photo');
  repo.projects.set(project.id, project);
  const { store, removed } = fakeStore(existing);
  return { repo: repo as unknown as ProjectRepository & MemoryRepo, project, store, removed };
}

describe('project media persistence', () => {
  it('AddMediaAsset stores a permanent copy instead of the cache URI', async () => {
    const { repo, project, store } = setup();
    await new AddMediaAssetUseCase(repo, store).execute(
      project.id,
      asset('a1', 'file:///cache/Camera/shot.jpg')
    );
    const saved = (await repo.findById(project.id))!.assets[0];
    expect(saved.originalUri).toBe('perm://p1/shot.jpg');
    expect(saved.workingUri).toBe('perm://p1/shot.jpg');
  });

  it('AddMediaAsset copies a distinct working file separately', async () => {
    const { repo, project, store } = setup();
    await new AddMediaAssetUseCase(repo, store).execute(
      project.id,
      asset('a1', 'file:///cache/raw.dng', 'file:///cache/raw.jpg')
    );
    const saved = (await repo.findById(project.id))!.assets[0];
    expect([saved.originalUri, saved.workingUri]).toEqual([
      'perm://p1/raw.dng',
      'perm://p1/raw.jpg',
    ]);
  });

  it('DeleteProject removes the project media folder', async () => {
    const { repo, project, store, removed } = setup();
    await new DeleteProjectUseCase(repo, store).execute(project.id);
    expect(removed).toEqual(['p1']);
  });

  it('PersistProjectMedia repairs surviving cache URIs and leaves lost ones alone', async () => {
    const { repo, project, store } = setup(['file:///cache/alive.jpg']);
    await repo.update({
      ...project,
      assets: [
        asset('alive', 'file:///cache/alive.jpg'),
        asset('lost', 'file:///cache/gone.jpg'),
        asset('done', 'perm://p1/ok.jpg'),
      ],
    });
    const useCase = new PersistProjectMediaUseCase(repo, store);

    expect(await useCase.execute()).toBe(1);
    const uris = (await repo.findById('p1'))!.assets.map((a) => [a.originalUri, a.workingUri]);
    expect(uris).toEqual([
      ['perm://p1/alive.jpg', 'perm://p1/alive.jpg'],
      ['file:///cache/gone.jpg', 'file:///cache/gone.jpg'],
      ['perm://p1/ok.jpg', 'perm://p1/ok.jpg'],
    ]);
    expect(await useCase.execute()).toBe(0); // idempotent
  });
});

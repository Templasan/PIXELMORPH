import { AddMediaAssetUseCase } from './AddMediaAssetUseCase';
import { DeleteProjectUseCase } from './DeleteProjectUseCase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { findUris, repairCacheMedia } from '../../infrastructure/repairCacheMedia';
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

  it('findUris picks every distinct cache URI out of stored JSON', () => {
    const json = JSON.stringify({
      clips: [{ sourceUri: 'file:///c/a.mp4' }, { sourceUri: 'file:///c/a.mp4' }],
      other: 'file:///docs/media/p1/b.jpg',
      img: 'file:///c/ImagePicker/x y.jpg',
    });
    expect(findUris(json, 'file:///c/')).toEqual(['file:///c/a.mp4', 'file:///c/ImagePicker/x']);
  });

  it('repairCacheMedia rewrites surviving cache URIs in every per-project key, once per file', async () => {
    await AsyncStorage.clear();
    const clipTracks = { tracks: [{ clips: [{ sourceUri: 'file:///c/clip.mp4' }] }] };
    await AsyncStorage.multiSet([
      ['project:p1', JSON.stringify({ assets: [{ originalUri: 'file:///c/clip.mp4' }] })],
      ['history:p1', JSON.stringify({ past: [{ params: { from: clipTracks, to: clipTracks } }] })],
      ['layers:p1', JSON.stringify([{ uri: 'file:///c/gone.png' }])],
      ['unrelated', 'file:///c/clip.mp4'],
    ]);
    const persist = jest.fn(
      async (uri: string, projectId: string) => `perm://${projectId}/${uri.split('/').pop()}`
    );
    const store = { persist, exists: async (uri: string) => uri !== 'file:///c/gone.png' };

    expect(await repairCacheMedia(store, 'file:///c/')).toBe(2);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem('history:p1')).not.toContain('file:///c/clip.mp4');
    expect(await AsyncStorage.getItem('project:p1')).toContain('perm://p1/clip.mp4');
    expect(await AsyncStorage.getItem('layers:p1')).toContain('file:///c/gone.png'); // lost: left as is
    expect(await AsyncStorage.getItem('unrelated')).toBe('file:///c/clip.mp4');
    expect(await repairCacheMedia(store, 'file:///c/')).toBe(0); // runs once
    expect(persist).toHaveBeenCalledTimes(1);
    expect(await repairCacheMedia(store, '')).toBe(0); // no cache dir known: never match everything
  });
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalProjectRepository } from '../../src/modules/projects/infrastructure/repositories/LocalProjectRepository';
import { CreateProjectUseCase } from '../../src/modules/projects/application/usecases/CreateProjectUseCase';
import { ListProjectsUseCase } from '../../src/modules/projects/application/usecases/ListProjectsUseCase';
import { ArchiveProjectUseCase } from '../../src/modules/projects/application/usecases/ArchiveProjectUseCase';
import { UnarchiveProjectUseCase } from '../../src/modules/projects/application/usecases/UnarchiveProjectUseCase';
import { DeleteProjectUseCase } from '../../src/modules/projects/application/usecases/DeleteProjectUseCase';

const mockFiles = new Map<string, string>();
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  makeDirectoryAsync: jest.fn(async () => undefined),
  writeAsStringAsync: jest.fn(async (p: string, d: string) => {
    mockFiles.set(p, d);
  }),
  readAsStringAsync: jest.fn(async (p: string) => mockFiles.get(p)),
  getInfoAsync: jest.fn(async (p: string) => ({ exists: mockFiles.has(p) })),
  deleteAsync: jest.fn(async (p: string) => {
    mockFiles.delete(p);
  }),
}));

describe('projects flow: create -> list -> archive -> unarchive -> delete', () => {
  const repo = new LocalProjectRepository();
  const create = new CreateProjectUseCase(repo);
  const list = new ListProjectsUseCase(repo);
  const archive = new ArchiveProjectUseCase(repo);
  const unarchive = new UnarchiveProjectUseCase(repo);
  const del = new DeleteProjectUseCase(repo);

  beforeEach(async () => {
    await AsyncStorage.clear();
    mockFiles.clear();
  });

  it('runs the whole lifecycle', async () => {
    const a = await create.execute('A', 'photo');
    const b = await create.execute('B', 'video');
    expect((await list.execute()).map((p) => p.id).sort()).toEqual([a.id, b.id].sort());

    expect((await archive.execute(a.id)).status).toBe('archived');
    expect((await repo.findById(a.id))?.status).toBe('archived');
    expect((await repo.findById(b.id))?.status).toBe('active');
    expect((await unarchive.execute(a.id)).status).toBe('active');

    await del.execute(a.id);
    expect((await list.execute()).map((p) => p.id)).toEqual([b.id]);
  });

  it('delete wipes every key and the backup file of that project only', async () => {
    const a = await create.execute('A', 'photo');
    const b = await create.execute('B', 'photo');
    for (const p of [a, b]) {
      await AsyncStorage.setItem(`layers:${p.id}`, '[]');
      await AsyncStorage.setItem(`editorImages:${p.id}`, '{}');
    }
    expect(mockFiles.size).toBe(2);

    await del.execute(a.id);

    for (const k of ['project:', 'projectBackup:', 'layers:', 'editorImages:']) {
      expect(await AsyncStorage.getItem(k + a.id)).toBeNull();
      expect(await AsyncStorage.getItem(k + b.id)).not.toBeNull();
    }
    expect(mockFiles.size).toBe(1);
    expect(await repo.findById(a.id)).toBeNull();
    expect(JSON.parse((await AsyncStorage.getItem('projectList')) as string)).toEqual([b.id]);
  });
});

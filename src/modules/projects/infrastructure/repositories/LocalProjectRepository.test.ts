import AsyncStorage from '@react-native-async-storage/async-storage';
import { createProject } from '../../domain/entities/Project';
import { AUTO_BACKUP_KEY, LAST_BACKUP_KEY, LocalProjectRepository } from './LocalProjectRepository';

// In-memory stand-in for the app's document directory (the real module needs a device).
const mockFiles = new Map<string, string>();
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  makeDirectoryAsync: jest.fn(async () => undefined),
  writeAsStringAsync: jest.fn(async (path: string, data: string) => {
    mockFiles.set(path, data);
  }),
  readAsStringAsync: jest.fn(async (path: string) => mockFiles.get(path)),
  getInfoAsync: jest.fn(async (path: string) => ({ exists: mockFiles.has(path) })),
  deleteAsync: jest.fn(async (path: string) => {
    mockFiles.delete(path);
  }),
}));

describe('LocalProjectRepository backups (RNF-006)', () => {
  let repository: LocalProjectRepository;

  beforeEach(async () => {
    await AsyncStorage.clear();
    mockFiles.clear();
    repository = new LocalProjectRepository();
  });

  it('restores a corrupted project from its backup when it is opened', async () => {
    const project = createProject('p1', 'Praia', 'photo');
    await repository.create(project);
    await AsyncStorage.setItem('project:p1', '{not json');

    const opened = await repository.findById('p1');

    expect(opened?.name).toBe('Praia');
    expect(await repository.verifyIntegrity('p1')).toBe('ok');
  });

  it('reports corruption when there is no backup to restore from', async () => {
    await repository.create(createProject('p1', 'Praia', 'photo'));
    await AsyncStorage.removeItem('projectBackup:p1');
    mockFiles.clear();
    await AsyncStorage.setItem('project:p1', '{not json');

    await expect(repository.findById('p1')).rejects.toThrow();
    expect(await repository.verifyIntegrity('p1')).toBe('unrecoverable');
  });

  it('records when the last backup was written', async () => {
    await repository.create(createProject('p1', 'Praia', 'photo'));
    expect(Number(await AsyncStorage.getItem(LAST_BACKUP_KEY))).toBeGreaterThan(0);
  });

  it('stops writing backups when automatic backup is turned off', async () => {
    await AsyncStorage.setItem(AUTO_BACKUP_KEY, '0');
    await repository.create(createProject('p1', 'Praia', 'photo'));

    expect(await AsyncStorage.getItem('projectBackup:p1')).toBeNull();
    expect(await AsyncStorage.getItem(LAST_BACKUP_KEY)).toBeNull();
  });

  it('keeps a second backup copy as a file and restores from it if AsyncStorage lost its backup', async () => {
    await repository.create(createProject('p1', 'Praia', 'photo'));
    expect(mockFiles.get('file:///docs/backups/p1.json')).toBeDefined();

    await AsyncStorage.removeItem('projectBackup:p1');
    await AsyncStorage.setItem('project:p1', '{not json');

    expect(await repository.verifyIntegrity('p1')).toBe('restored');
    expect((await repository.findById('p1'))?.name).toBe('Praia');
  });

  it('removes the file backup when the project is deleted', async () => {
    await repository.create(createProject('p1', 'Praia', 'photo'));
    await repository.delete('p1');
    expect(mockFiles.size).toBe(0);
  });
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalProjectRepository } from '@modules/projects/infrastructure/repositories/LocalProjectRepository';
import { createProject } from '@modules/projects/domain';

describe('LocalProjectRepository — backup + integrity (RNF-006)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('reports "ok" for a healthy project', async () => {
    const repo = new LocalProjectRepository();
    const project = createProject('p1', 'Ensaio Praia', 'photo');
    await repo.create(project);

    expect(await repo.verifyIntegrity('p1')).toBe('ok');
  });

  it('reports "not_found" for an id that was never created', async () => {
    const repo = new LocalProjectRepository();
    expect(await repo.verifyIntegrity('ghost')).toBe('not_found');
  });

  it('restores from backup when the live copy is corrupted JSON', async () => {
    const repo = new LocalProjectRepository();
    const project = createProject('p2', 'Retrato Marina', 'photo');
    await repo.create(project);

    // Simulate a corrupting write (e.g. app killed mid-write) directly at the storage layer.
    await AsyncStorage.setItem('project:p2', '{not valid json');

    const result = await repo.verifyIntegrity('p2');
    expect(result).toBe('restored');

    // The live copy should now be readable again via the normal repository API.
    const recovered = await repo.findById('p2');
    expect(recovered?.name).toBe('Retrato Marina');
  });

  it('restores from backup when the live copy fails DTO validation', async () => {
    const repo = new LocalProjectRepository();
    const project = createProject('p3', 'Feira do Centro', 'photo');
    await repo.create(project);

    await AsyncStorage.setItem('project:p3', JSON.stringify({ version: 1, id: 'p3' }));

    expect(await repo.verifyIntegrity('p3')).toBe('restored');
    expect((await repo.findById('p3'))?.name).toBe('Feira do Centro');
  });

  it('reports "unrecoverable" when both live and backup are corrupted', async () => {
    const repo = new LocalProjectRepository();
    const project = createProject('p4', 'Trilha Serra', 'video');
    await repo.create(project);

    await AsyncStorage.setItem('project:p4', 'not json at all');
    await AsyncStorage.setItem('projectBackup:p4', 'also not json');

    expect(await repo.verifyIntegrity('p4')).toBe('unrecoverable');
  });

  it('keeps the backup one version behind after multiple updates, enabling recovery', async () => {
    const repo = new LocalProjectRepository();
    const project = createProject('p5', 'Logo Cliente', 'photo');
    await repo.create(project);

    const { updateProject } = await import('@modules/projects/domain');
    await repo.update(updateProject(project, { name: 'Logo Cliente v2' }));

    // Corrupt the live copy right after a successful update.
    await AsyncStorage.setItem('project:p5', '{ broken');

    const result = await repo.verifyIntegrity('p5');
    expect(result).toBe('restored');
    // The backup is a double-buffer one write behind: it holds the state that was live
    // right before the corrupting update, i.e. the original name, not "v2".
    expect((await repo.findById('p5'))?.name).toBe('Logo Cliente');
  });

  it('verifyAllIntegrity checks every stored project', async () => {
    const repo = new LocalProjectRepository();
    await repo.create(createProject('a', 'A', 'photo'));
    await repo.create(createProject('b', 'B', 'video'));
    await AsyncStorage.setItem('project:b', 'corrupted');
    await AsyncStorage.removeItem('projectBackup:b');

    const results = await repo.verifyAllIntegrity();
    expect(results).toEqual(
      expect.arrayContaining([
        { id: 'a', result: 'ok' },
        { id: 'b', result: 'unrecoverable' },
      ])
    );
  });
});

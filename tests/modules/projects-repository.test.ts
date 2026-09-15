import AsyncStorage from '@react-native-async-storage/async-storage';
import { createProjectsModule } from '@modules/projects';
import { ProjectNotFoundError } from '@modules/projects/ports';

describe('Projects Module — LocalProjectRepository + use cases', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('creates and lists a project end-to-end', async () => {
    const { createProject, listProjects } = createProjectsModule();

    const created = await createProject.execute('Ensaio Praia', 'photo');
    const all = await listProjects.execute();

    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(created.id);
    expect(all[0].name).toBe('Ensaio Praia');
  });

  it('archives and unarchives without mutating the caller-held reference', async () => {
    const { createProject, archiveProject, unarchiveProject, getProject } = createProjectsModule();

    const created = await createProject.execute('Viagem Litoral', 'video');
    expect(created.status).toBe('active');

    const archived = await archiveProject.execute(created.id);
    expect(archived.status).toBe('archived');
    // The object returned by createProject must remain untouched (no direct mutation).
    expect(created.status).toBe('active');

    const unarchived = await unarchiveProject.execute(created.id);
    expect(unarchived.status).toBe('active');

    const fetched = await getProject.execute(created.id);
    expect(fetched?.status).toBe('active');
  });

  it('persists dueDate and priority through update/reload (RF-070)', async () => {
    const { createProject, updateProject, getProject } = createProjectsModule();

    const created = await createProject.execute('Retrato Marina', 'photo');
    const due = new Date('2026-12-01T00:00:00.000Z');

    await updateProject.execute(created.id, { dueDate: due, priority: 'high' });

    const reloaded = await getProject.execute(created.id);
    expect(reloaded?.dueDate?.toISOString()).toBe(due.toISOString());
    expect(reloaded?.priority).toBe('high');
  });

  it('throws ProjectNotFoundError when unarchiving a missing project', async () => {
    const { unarchiveProject } = createProjectsModule();
    await expect(unarchiveProject.execute('does-not-exist')).rejects.toBeInstanceOf(
      ProjectNotFoundError
    );
  });

  it('filters by type and status via findByType/findByStatus', async () => {
    const { createProject, archiveProject, repository } = createProjectsModule();

    await createProject.execute('Foto A', 'photo');
    const video = await createProject.execute('Video A', 'video');
    await archiveProject.execute(video.id);

    const photos = await repository.findByType('photo');
    const archivedOnes = await repository.findByStatus('archived');

    expect(photos).toHaveLength(1);
    expect(archivedOnes).toHaveLength(1);
    expect(archivedOnes[0].id).toBe(video.id);
  });
});

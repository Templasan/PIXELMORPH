import {
  SyncProjectsUseCase,
  type FileInfo,
  type LocalProjectData,
  type SyncState,
} from './SyncProjectsUseCase';
import {
  CloudError,
  type CloudFileStore,
  type CloudProject,
  type CloudProjectRow,
  type CloudProjectStore,
  type CloudProjectUpsert,
} from '../../ports/ProjectCloud';

// Fakes: a shared "server" (rows and media) and one fake phone per device.

interface FakeServer {
  rows: Map<string, CloudProject>;
  files: Map<string, string>;
  offline: boolean;
  failDownloadKey: string | null;
  rejectUpsertIds: Set<string>;
  successfulUploads: string[];
  upserts: string[];
  deletions: string[];
}

function newServer(): FakeServer {
  return {
    rows: new Map(),
    files: new Map(),
    offline: false,
    failDownloadKey: null,
    rejectUpsertIds: new Set(),
    successfulUploads: [],
    upserts: [],
    deletions: [],
  };
}

class FakeCloudProjects implements CloudProjectStore {
  constructor(private readonly server: FakeServer) {}

  // `offline` only affects the media server; the project list stays reachable.
  async list(): Promise<CloudProjectRow[]> {
    return [...this.server.rows.values()].map(({ id, name, updatedAt, deletedAt }) => ({
      id,
      name,
      updatedAt,
      deletedAt,
    }));
  }

  async get(id: string): Promise<CloudProject> {
    const row = this.server.rows.get(id);
    if (!row) throw new CloudError('notFound');
    return structuredClone(row);
  }

  async upsert(row: CloudProjectUpsert): Promise<void> {
    this.server.upserts.push(row.id);
    if (this.server.rejectUpsertIds.has(row.id)) throw new CloudError('failed', 'too large');
    this.server.rows.set(row.id, { ...structuredClone(row), deletedAt: null });
  }

  async markDeleted(id: string, at: string): Promise<void> {
    this.server.deletions.push(id);
    const row = this.server.rows.get(id);
    if (row) this.server.rows.set(id, { ...row, deletedAt: at, updatedAt: at });
  }
}

interface FakeFile {
  content: string;
  size: number;
  modificationTime: number;
}

class FakePhone implements LocalProjectData {
  /** AsyncStorage stand-in. */
  storage: Record<string, string> = {};
  /** The file system stand-in: uri -> file. */
  fs = new Map<string, FakeFile>();
  writes: string[] = [];
  private states = new Map<string, SyncState>();

  private ids(): string[] {
    return JSON.parse(this.storage.projectList ?? '[]');
  }

  addProject(id: string, name: string, uris: string[], extra: Record<string, unknown> = {}) {
    const assets = uris.map((originalUri) => ({ originalUri }));
    this.storage[`project:${id}`] = JSON.stringify({ id, name, assets, ...extra });
    for (const uri of uris) {
      this.fs.set(uri, { content: `bytes:${uri}`, size: 10, modificationTime: 1000 });
    }
    const list = this.ids();
    if (!list.includes(id)) list.push(id);
    this.storage.projectList = JSON.stringify(list);
  }

  removeProject(id: string) {
    for (const key of Object.keys(this.storage)) {
      if (key === `project:${id}` || key === `layers:${id}`) delete this.storage[key];
    }
    this.storage.projectList = JSON.stringify(this.ids().filter((x) => x !== id));
  }

  async listIds(): Promise<string[]> {
    return this.ids().filter((id) => !!this.storage[`project:${id}`]);
  }

  async readBlobs(projectId: string): Promise<Record<string, string>> {
    const blobs: Record<string, string> = {};
    for (const key of Object.keys(this.storage)) {
      if (
        key === `project:${projectId}` ||
        key === `layers:${projectId}` ||
        key === `editorImages:${projectId}` ||
        key === `history:${projectId}` ||
        key.startsWith(`history:${projectId}#`)
      ) {
        blobs[key] = this.storage[key];
      }
    }
    return blobs;
  }

  async writeBlobs(projectId: string, blobs: Record<string, string>, isNew: boolean) {
    this.writes.push(projectId);
    for (const key of Object.keys(await this.readBlobs(projectId))) {
      if (!(key in blobs)) delete this.storage[key];
    }
    Object.assign(this.storage, blobs);
    if (isNew) {
      const list = this.ids();
      if (!list.includes(projectId)) list.push(projectId);
      this.storage.projectList = JSON.stringify(list);
    }
  }

  async fileInfo(uri: string): Promise<FileInfo | null> {
    const file = this.fs.get(uri);
    return file ? { exists: true, size: file.size, modificationTime: file.modificationTime } : null;
  }

  targetUri(projectId: string, key: string): string {
    return `file:///docs/cloud/${projectId}/${key}`;
  }

  async move(from: string, to: string) {
    const file = this.fs.get(from);
    if (!file) throw new Error(`no file at ${from}`);
    this.fs.delete(from);
    this.fs.set(to, file);
  }

  async remove(uri: string) {
    this.fs.delete(uri);
  }

  async loadState(userId: string): Promise<SyncState> {
    return structuredClone(this.states.get(userId) ?? { last: {}, uploaded: {}, fileKeys: {} });
  }

  async saveState(userId: string, state: SyncState) {
    this.states.set(userId, structuredClone(state));
  }
}

/** The file transfer of one phone: uploads read its file system, downloads write to it. */
class PhoneFiles implements CloudFileStore {
  constructor(
    private readonly server: FakeServer,
    private readonly phone: FakePhone
  ) {}

  async upload(projectId: string, key: string, localUri: string): Promise<void> {
    if (this.server.offline) throw new CloudError('offline');
    const file = this.phone.fs.get(localUri);
    if (!file) throw new CloudError('failed', 'missing local file');
    this.server.files.set(`${projectId}/${key}`, file.content);
    this.server.successfulUploads.push(`${projectId}/${key}`);
  }

  async download(projectId: string, key: string, toUri: string): Promise<void> {
    if (this.server.offline) throw new CloudError('offline');
    if (key === this.server.failDownloadKey) throw new CloudError('offline');
    const content = this.server.files.get(`${projectId}/${key}`);
    if (content === undefined) throw new CloudError('notFound');
    this.phone.fs.set(toUri, { content, size: content.length, modificationTime: 5000 });
  }
}

function deviceWith(server: FakeServer) {
  const phone = new FakePhone();
  const uc = new SyncProjectsUseCase(
    new FakeCloudProjects(server),
    new PhoneFiles(server, phone),
    phone
  );
  return { phone, uc };
}

async function syncOnce(uc: SyncProjectsUseCase, userId = 'u1') {
  const prepared = await uc.prepare(userId);
  return uc.run(userId, prepared, () => undefined);
}

// Server timestamps come from the clock; keep two syncs apart so their times differ.
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe('SyncProjectsUseCase', () => {
  it('first run uploads the row and the files, and reports one first-time upload', async () => {
    const server = newServer();
    const a = deviceWith(server);
    a.phone.addProject('p1', 'Viagem', ['file:///cache/photo.jpg']);

    const prepared = await a.uc.prepare('u1');
    expect(prepared.firstTimeUploadCount).toBe(1);

    const report = await a.uc.run('u1', prepared, () => undefined);
    expect(report.uploaded).toBe(1);
    expect(report.pendingUploads).toBe(0);
    expect(server.rows.get('p1')?.files).toHaveLength(1);
    expect([...server.files.values()]).toEqual(['bytes:file:///cache/photo.jpg']);
  });

  it('a second run with no changes does nothing', async () => {
    const server = newServer();
    const a = deviceWith(server);
    a.phone.addProject('p1', 'Viagem', ['file:///cache/photo.jpg']);
    await syncOnce(a.uc);

    const upsertsBefore = server.upserts.length;
    const uploadsBefore = server.successfulUploads.length;
    const report = await syncOnce(a.uc);

    expect(report).toMatchObject({
      uploaded: 0,
      downloaded: 0,
      tombstoned: 0,
      conflicts: [],
      failed: 0,
      pendingUploads: 0,
      pendingDownloads: 0,
      missingFiles: 0,
      serverOffline: false,
    });
    expect(server.upserts.length).toBe(upsertsBefore);
    expect(server.successfulUploads.length).toBe(uploadsBefore);
  });

  it('with the PC offline keeps the row and leaves files pending; a retry uploads only what is left', async () => {
    const server = newServer();
    const a = deviceWith(server);
    a.phone.addProject('p1', 'Viagem', ['file:///cache/one.jpg', 'file:///cache/two.jpg']);

    server.offline = true;
    const first = await syncOnce(a.uc);
    expect(first.uploaded).toBe(1);
    expect(first.pendingUploads).toBe(2);
    expect(first.serverOffline).toBe(true);
    expect(server.rows.has('p1')).toBe(true);

    server.offline = false;
    const second = await syncOnce(a.uc);
    expect(second.pendingUploads).toBe(0);
    expect(server.successfulUploads).toHaveLength(2);
  });

  it('a failed download writes nothing locally and cleans up its partial files', async () => {
    const server = newServer();
    const a = deviceWith(server);
    a.phone.addProject('p1', 'Viagem', ['file:///cache/one.jpg', 'file:///cache/two.jpg']);
    await syncOnce(a.uc);
    const keys = [...server.rows.get('p1')!.files.map((f) => f.key)];
    server.failDownloadKey = keys[1];

    const b = deviceWith(server);
    const report = await syncOnce(b.uc);

    expect(report.downloaded).toBe(0);
    expect(report.pendingDownloads).toBe(1);
    expect(b.phone.writes).toEqual([]);
    expect(b.phone.storage['project:p1']).toBeUndefined();
    expect(b.phone.fs.size).toBe(0);
  });

  it('a download writes the project and rewrites every file URI, including prefixes and escaped JSON', async () => {
    const server = newServer();
    const a = deviceWith(server);
    a.phone.addProject(
      'p1',
      'Viagem',
      ['file:///cache/clip.mp4', 'file:///cache/clip.mp4.frames'],
      {
        history: JSON.stringify({ clip: 'file:///cache/clip.mp4' }),
      }
    );
    await syncOnce(a.uc);

    const b = deviceWith(server);
    const report = await syncOnce(b.uc);

    expect(report.downloaded).toBe(1);
    const stored = b.phone.storage['project:p1'];
    expect(stored).not.toContain('file:///cache/');
    expect(stored).toContain('file:///docs/cloud/p1/');
    expect(b.phone.storage['projectList']).toContain('p1');
    const history = JSON.parse(JSON.parse(stored).history);
    expect(history.clip).toMatch(/^file:\/\/\/docs\/cloud\/p1\//);
  });

  it('conflicts are reported and touch nothing', async () => {
    const server = newServer();
    const a = deviceWith(server);
    a.phone.addProject('p1', 'Viagem', ['file:///cache/one.jpg']);
    await syncOnce(a.uc);

    const b = deviceWith(server);
    await syncOnce(b.uc);
    const bEdit = JSON.stringify({ id: 'p1', name: 'Viagem B', note: 'edited here' });
    b.phone.storage['project:p1'] = bEdit;

    await tick();
    a.phone.storage['project:p1'] = JSON.stringify({ id: 'p1', name: 'Viagem A', note: 'remote' });
    await syncOnce(a.uc);
    const upsertsBefore = server.upserts.length;
    const writesBefore = b.phone.writes.length;

    const prepared = await b.uc.prepare('u1');
    expect(prepared.plan.conflicts).toEqual(['p1']);
    expect(prepared.conflictNames).toEqual(['Viagem A']);
    const report = await b.uc.run('u1', prepared, () => undefined);

    expect(report.conflicts).toEqual(['Viagem A']);
    expect(server.upserts.length).toBe(upsertsBefore);
    expect(b.phone.writes.length).toBe(writesBefore);
    expect(b.phone.storage['project:p1']).toBe(bEdit);
  });

  it('a local edit after a sync uploads again', async () => {
    const server = newServer();
    const a = deviceWith(server);
    a.phone.addProject('p1', 'Viagem', ['file:///cache/one.jpg']);
    await syncOnce(a.uc);

    await tick();
    a.phone.storage['project:p1'] = JSON.stringify({ id: 'p1', name: 'Viagem', note: 'new' });
    const report = await syncOnce(a.uc);

    expect(report.uploaded).toBe(1);
    expect(server.upserts.filter((id) => id === 'p1')).toHaveLength(2);
  });

  it('state is kept per user id', async () => {
    const server = newServer();
    const a = deviceWith(server);
    a.phone.addProject('p1', 'Viagem', ['file:///cache/one.jpg']);
    await syncOnce(a.uc, 'u1');

    const prepared = await a.uc.prepare('u2');
    expect(prepared.plan.upload).toEqual([]);
    expect(prepared.plan.conflicts).toEqual(['p1']);
  });

  it('a project deleted here is marked deleted on the server and forgotten', async () => {
    const server = newServer();
    const a = deviceWith(server);
    a.phone.addProject('p1', 'Viagem', ['file:///cache/one.jpg']);
    await syncOnce(a.uc);

    a.phone.removeProject('p1');
    const report = await syncOnce(a.uc);

    expect(report.tombstoned).toBe(1);
    expect(server.deletions).toEqual(['p1']);
    const state = await a.phone.loadState('u1');
    expect(state.last.p1).toBeUndefined();
  });

  it('a remote delete never removes the local copy, and is reported once', async () => {
    const server = newServer();
    const a = deviceWith(server);
    a.phone.addProject('p1', 'Viagem', ['file:///cache/one.jpg']);
    await syncOnce(a.uc);

    await tick();
    const row = server.rows.get('p1')!;
    const at = new Date().toISOString();
    server.rows.set('p1', { ...row, deletedAt: at, updatedAt: at });
    const report = await syncOnce(a.uc);

    expect(report).toMatchObject({
      downloaded: 0,
      tombstoned: 0,
      removedElsewhere: 1,
      uploaded: 0,
    });
    expect(a.phone.storage['project:p1']).toBeDefined();
    expect((await a.phone.loadState('u1')).last.p1?.remoteUpdatedAt).toBe(at);

    const again = await syncOnce(a.uc);
    expect(again.removedElsewhere).toBe(0);
    expect(server.upserts.filter((id) => id === 'p1')).toHaveLength(1);
  });

  it('a project deleted on one device stays on the other until it is edited there; then it comes back', async () => {
    const server = newServer();
    const a = deviceWith(server);
    a.phone.addProject('p1', 'Viagem', ['file:///cache/one.jpg']);
    await syncOnce(a.uc);
    const b = deviceWith(server);
    await syncOnce(b.uc);

    await tick();
    a.phone.removeProject('p1');
    expect((await syncOnce(a.uc)).tombstoned).toBe(1);

    await tick();
    expect((await syncOnce(b.uc)).removedElsewhere).toBe(1);
    expect(await syncOnce(b.uc)).toMatchObject({ removedElsewhere: 0, uploaded: 0 });
    expect(b.phone.storage['project:p1']).toBeDefined();
    expect(server.rows.get('p1')?.deletedAt).not.toBeNull();

    // A device with no copy and no record does not bring a deleted project back.
    expect(await syncOnce(a.uc)).toMatchObject({ downloaded: 0 });

    await tick();
    b.phone.storage['project:p1'] = JSON.stringify({ id: 'p1', name: 'Viagem B' });
    expect((await syncOnce(b.uc)).uploaded).toBe(1);
    expect(server.rows.get('p1')?.deletedAt).toBeNull();

    expect((await syncOnce(a.uc)).downloaded).toBe(1);
    expect(a.phone.storage['project:p1']).toBeDefined();
  });

  it('after a download, the next run uploads no file again', async () => {
    const server = newServer();
    const a = deviceWith(server);
    a.phone.addProject('p1', 'Viagem', ['file:///cache/one.jpg', 'file:///cache/two.jpg']);
    await syncOnce(a.uc);
    const b = deviceWith(server);
    const first = await syncOnce(b.uc);
    expect(first.downloaded).toBe(1);

    const uploadsBefore = server.successfulUploads.length;
    await syncOnce(b.uc);

    expect(server.successfulUploads.length).toBe(uploadsBefore);
  });

  it('an edit after a download uploads the row with the original file keys and no file', async () => {
    const server = newServer();
    const a = deviceWith(server);
    a.phone.addProject('p1', 'Viagem', ['file:///cache/one.jpg']);
    await syncOnce(a.uc);
    const originalKeys = server.rows.get('p1')!.files.map((f) => f.key);
    const b = deviceWith(server);
    await syncOnce(b.uc);

    await tick();
    b.phone.storage['project:p1'] = JSON.stringify({
      ...JSON.parse(b.phone.storage['project:p1']),
      name: 'Viagem B',
    });
    const uploadsBefore = server.successfulUploads.length;
    const report = await syncOnce(b.uc);

    expect(report.uploaded).toBe(1);
    expect(server.rows.get('p1')!.files.map((f) => f.key)).toEqual(originalKeys);
    expect(server.successfulUploads.length).toBe(uploadsBefore);
  });

  it('a third device can download a row whose files came from a download', async () => {
    const server = newServer();
    const a = deviceWith(server);
    a.phone.addProject('p1', 'Viagem', ['file:///cache/one.jpg']);
    await syncOnce(a.uc);
    const b = deviceWith(server);
    await syncOnce(b.uc);
    await tick();
    b.phone.storage['project:p1'] = JSON.stringify({
      ...JSON.parse(b.phone.storage['project:p1']),
      name: 'Viagem B',
    });
    await syncOnce(b.uc);

    const c = deviceWith(server);
    const report = await syncOnce(c.uc);

    expect(report.downloaded).toBe(1);
    const key = server.rows.get('p1')!.files[0].key;
    expect([...c.phone.fs.keys()]).toEqual([`file:///docs/cloud/p1/${key}`]);
  });

  it('a file replaced in place uploads again under the same key', async () => {
    const server = newServer();
    const a = deviceWith(server);
    a.phone.addProject('p1', 'Viagem', ['file:///cache/one.jpg']);
    await syncOnce(a.uc);
    const key = server.rows.get('p1')!.files[0].key;

    a.phone.fs.set('file:///cache/one.jpg', {
      content: 'new bytes',
      size: 20,
      modificationTime: 2000,
    });
    await syncOnce(a.uc);

    expect(server.rows.get('p1')!.files[0].key).toBe(key);
    expect(server.files.get(`p1/${key}`)).toBe('new bytes');
  });

  it('a new baked file gets a new key', async () => {
    const server = newServer();
    const a = deviceWith(server);
    a.phone.addProject('p1', 'Viagem', ['file:///cache/one.jpg']);
    await syncOnce(a.uc);
    const oldKey = server.rows.get('p1')!.files[0].key;

    a.phone.addProject('p1', 'Viagem', ['file:///cache/one.jpg', 'file:///cache/baked.jpg']);
    a.phone.storage['project:p1'] = JSON.stringify({
      id: 'p1',
      name: 'Viagem',
      assets: [
        { originalUri: 'file:///cache/one.jpg' },
        { originalUri: 'file:///cache/baked.jpg' },
      ],
    });
    await syncOnce(a.uc);

    const keys = server.rows.get('p1')!.files.map((f) => f.key);
    expect(keys).toHaveLength(2);
    expect(keys).toContain(oldKey);
    expect(keys.find((k) => k !== oldKey)).toMatch(/^[0-9a-f]{8}-\d+\.jpg$/);
  });

  it('a payload with keys outside the project is refused and writes nothing', async () => {
    const server = newServer();
    server.rows.set('p1', {
      id: 'p1',
      name: 'Hostil',
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      payload: { blobs: { 'project:p1': '{"id":"p1","name":"Hostil"}', projectList: '["x"]' } },
      files: [],
    });
    const b = deviceWith(server);

    const report = await syncOnce(b.uc);

    expect(report.failed).toBe(1);
    expect(b.phone.writes).toEqual([]);
    expect(b.phone.storage.projectList).toBeUndefined();
  });

  it('counts missing local files and does not upload them', async () => {
    const server = newServer();
    const a = deviceWith(server);
    a.phone.addProject('p1', 'Viagem', ['file:///cache/gone.jpg']);
    a.phone.fs.clear();

    const report = await syncOnce(a.uc);

    expect(report.uploaded).toBe(1);
    expect(report.missingFiles).toBe(1);
    expect(server.successfulUploads).toEqual([]);
  });

  it('a row the server rejects is counted as failed and the run goes on', async () => {
    const server = newServer();
    server.rejectUpsertIds.add('p1');
    const a = deviceWith(server);
    a.phone.addProject('p1', 'Grande', ['file:///cache/big.mp4']);
    a.phone.addProject('p2', 'Pequeno', ['file:///cache/small.jpg']);

    const report = await syncOnce(a.uc);

    expect(report.failed).toBe(1);
    expect(report.uploaded).toBe(1);
    expect(server.rows.has('p2')).toBe(true);
  });

  it('a remote change updates the local project and rewrites its file URIs', async () => {
    const server = newServer();
    const a = deviceWith(server);
    a.phone.addProject('p1', 'Viagem', ['file:///cache/one.jpg']);
    await syncOnce(a.uc);
    const b = deviceWith(server);
    await syncOnce(b.uc);

    await tick();
    a.phone.storage['project:p1'] = JSON.stringify({
      id: 'p1',
      name: 'Viagem nova',
      assets: [{ originalUri: 'file:///cache/one.jpg' }],
    });
    await syncOnce(a.uc);

    const report = await syncOnce(b.uc);

    expect(report).toMatchObject({ downloaded: 1, conflicts: [] });
    expect(JSON.parse(b.phone.storage['project:p1']).name).toBe('Viagem nova');
    expect(b.phone.storage['project:p1']).not.toContain('file:///cache/');
    expect(b.phone.storage['project:p1']).toContain('file:///docs/cloud/p1/');
  });

  it('a shorter history from the server leaves no stale key on the phone', async () => {
    const server = newServer();
    const a = deviceWith(server);
    a.phone.addProject('p1', 'Viagem', ['file:///cache/one.jpg']);
    a.phone.storage['history:p1'] = '{"index":1}';
    a.phone.storage['history:p1#g1-0'] = '[1]';
    a.phone.storage['history:p1#g1-1'] = '[2]';
    await syncOnce(a.uc);
    const b = deviceWith(server);
    await syncOnce(b.uc);
    expect(b.phone.storage['history:p1#g1-1']).toBe('[2]');

    await tick();
    delete a.phone.storage['history:p1#g1-1'];
    a.phone.storage['history:p1'] = '{"index":0}';
    await syncOnce(a.uc);
    const report = await syncOnce(b.uc);

    expect(report.downloaded).toBe(1);
    expect(b.phone.storage['history:p1#g1-1']).toBeUndefined();
    expect(b.phone.storage['history:p1#g1-0']).toBe('[1]');
  });

  it('a local edit made between prepare and run is a conflict and touches nothing locally', async () => {
    const server = newServer();
    const a = deviceWith(server);
    a.phone.addProject('p1', 'Viagem', ['file:///cache/one.jpg']);
    await syncOnce(a.uc);
    const b = deviceWith(server);
    await syncOnce(b.uc);

    await tick();
    a.phone.storage['project:p1'] = JSON.stringify({ id: 'p1', name: 'Viagem nova' });
    await syncOnce(a.uc);

    const prepared = await b.uc.prepare('u1');
    expect(prepared.plan.download).toEqual(['p1']);
    const edited = JSON.stringify({ id: 'p1', name: 'Editado aqui' });
    b.phone.storage['project:p1'] = edited;
    const storageBefore = { ...b.phone.storage };
    const fsBefore = new Map(b.phone.fs);

    const report = await b.uc.run('u1', prepared, () => undefined);

    expect(report.conflicts).toEqual(['Viagem nova']);
    expect(report.downloaded).toBe(0);
    expect(b.phone.storage['project:p1']).toBe(edited);
    expect(b.phone.storage).toEqual(storageBefore);
    expect(b.phone.fs).toEqual(fsBefore);
  });

  it('a failed file download over a synced local copy leaves that copy untouched', async () => {
    const server = newServer();
    const a = deviceWith(server);
    a.phone.addProject('p1', 'Viagem', ['file:///cache/one.jpg', 'file:///cache/two.jpg']);
    await syncOnce(a.uc);
    const b = deviceWith(server);
    await syncOnce(b.uc);

    await tick();
    a.phone.storage['project:p1'] = JSON.stringify({
      id: 'p1',
      name: 'Viagem nova',
      assets: [{ originalUri: 'file:///cache/one.jpg' }, { originalUri: 'file:///cache/two.jpg' }],
    });
    await syncOnce(a.uc);
    server.failDownloadKey = server.rows.get('p1')!.files[1].key;
    const storageBefore = { ...b.phone.storage };
    const fsBefore = new Map(b.phone.fs);

    const report = await syncOnce(b.uc);

    expect(report.downloaded).toBe(0);
    expect(report.pendingDownloads).toBe(1);
    expect(b.phone.storage).toEqual(storageBefore);
    expect(b.phone.fs).toEqual(fsBefore);
  });

  it('after a download, the next run does nothing', async () => {
    const server = newServer();
    const a = deviceWith(server);
    a.phone.addProject('p1', 'Viagem', ['file:///cache/one.jpg']);
    await syncOnce(a.uc);
    const b = deviceWith(server);
    await syncOnce(b.uc);

    await tick();
    a.phone.storage['project:p1'] = JSON.stringify({ id: 'p1', name: 'Viagem nova' });
    await syncOnce(a.uc);
    expect((await syncOnce(b.uc)).downloaded).toBe(1);

    const upsertsBefore = server.upserts.length;
    const uploadsBefore = server.successfulUploads.length;
    const report = await syncOnce(b.uc);

    expect(report).toMatchObject({
      uploaded: 0,
      downloaded: 0,
      conflicts: [],
      failed: 0,
      pendingUploads: 0,
      pendingDownloads: 0,
    });
    expect(server.upserts.length).toBe(upsertsBefore);
    expect(server.successfulUploads.length).toBe(uploadsBefore);
  });
});

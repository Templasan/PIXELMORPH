import {
  collectFileUris,
  fileKeyOf,
  fingerprint,
  isProjectBlobKey,
  planSync,
  rewriteUris,
  type LocalSyncProject,
  type RemoteSyncProject,
  type SyncSnapshot,
} from './syncPlan';

const T1 = '2026-11-01T10:00:00.000Z';
const T2 = '2026-11-02T10:00:00.000Z';
const local = (id: string, hash = 'h1'): LocalSyncProject => ({ id, name: id, hash });
const remote = (
  id: string,
  updatedAt = T1,
  deletedAt: string | null = null
): RemoteSyncProject => ({ id, name: id, updatedAt, deletedAt });
const snap = (hash = 'h1', remoteUpdatedAt = T1): SyncSnapshot => ({ hash, remoteUpdatedAt });

describe('planSync decision table', () => {
  it('L, no R: upload', () => {
    expect(planSync([local('a')], [], {}).upload).toEqual(['a']);
  });

  it('no L, R not deleted, no S: download', () => {
    expect(planSync([], [remote('a')], {}).download).toEqual(['a']);
  });

  it('no L, R deleted: nothing, and forget if S', () => {
    const none = planSync([], [remote('a', T2, T2)], {});
    expect(none).toEqual({ upload: [], download: [], tombstone: [], forget: [], conflicts: [] });
    expect(planSync([], [remote('a', T2, T2)], { a: snap() }).forget).toEqual(['a']);
  });

  it('L, R, no S: deleted remote -> upload; live remote -> conflict', () => {
    expect(planSync([local('a')], [remote('a', T2, T2)], {}).upload).toEqual(['a']);
    expect(planSync([local('a')], [remote('a')], {}).conflicts).toEqual(['a']);
  });

  it('L, R, S, neither changed: nothing', () => {
    const plan = planSync([local('a')], [remote('a')], { a: snap() });
    expect(plan).toEqual({ upload: [], download: [], tombstone: [], forget: [], conflicts: [] });
  });

  it('L, R, S, only local changed: upload', () => {
    expect(planSync([local('a', 'h2')], [remote('a')], { a: snap() }).upload).toEqual(['a']);
  });

  it('L, R, S, only remote changed: live -> download; deleted -> forget, local kept', () => {
    expect(planSync([local('a')], [remote('a', T2)], { a: snap() }).download).toEqual(['a']);
    const gone = planSync([local('a')], [remote('a', T2, T2)], { a: snap() });
    expect(gone.forget).toEqual(['a']);
    expect(gone.download).toEqual([]);
    expect(gone.upload).toEqual([]);
  });

  it('L, R, S, both changed: conflict, unless R deleted -> upload', () => {
    expect(planSync([local('a', 'h2')], [remote('a', T2)], { a: snap() }).conflicts).toEqual(['a']);
    expect(planSync([local('a', 'h2')], [remote('a', T2, T2)], { a: snap() }).upload).toEqual([
      'a',
    ]);
  });

  it('no L, R live, S, remote unchanged: tombstone', () => {
    expect(planSync([], [remote('a')], { a: snap() }).tombstone).toEqual(['a']);
  });

  it('no L, R live, S, remote changed: conflict', () => {
    expect(planSync([], [remote('a', T2)], { a: snap() }).conflicts).toEqual(['a']);
  });

  it('no L, no R: forget if S', () => {
    expect(planSync([], [], { a: snap() }).forget).toEqual(['a']);
    expect(planSync([], [], {}).forget).toEqual([]);
  });

  it('compares server timestamps as instants, not text', () => {
    // Postgres returns "+00:00" offsets with microseconds; the same instant must not look changed.
    const serverForm = '2026-11-01T10:00:00+00:00';
    expect(planSync([local('a')], [remote('a', serverForm)], { a: snap() }).upload).toEqual([]);
    expect(planSync([local('a')], [remote('a', serverForm)], { a: snap() }).download).toEqual([]);
  });
});

describe('rewriteUris', () => {
  it('replaces every occurrence and leaves other text alone', () => {
    const map = new Map([['file:///a/1.jpg', 'file:///new/1.jpg']]);
    expect(rewriteUris('x file:///a/1.jpg y file:///a/1.jpg', map)).toBe(
      'x file:///new/1.jpg y file:///new/1.jpg'
    );
  });

  it('does not corrupt a URI that is a prefix of another one', () => {
    const map = new Map([
      ['file:///a/video.mp4', 'file:///new/short'],
      ['file:///a/video.mp4.frames', 'file:///new/long'],
    ]);
    expect(rewriteUris('["file:///a/video.mp4.frames","file:///a/video.mp4"]', map)).toBe(
      '["file:///new/long","file:///new/short"]'
    );
  });

  it('rewrites URIs inside escaped JSON held in a string', () => {
    const uri = 'file:///a/clip.mp4';
    const inner = JSON.stringify({ clips: [{ uri }] });
    const text = JSON.stringify({ history: inner });
    const map = new Map([[uri, 'file:///new/clip.mp4']]);
    const out = rewriteUris(text, map);
    expect(out).not.toContain('/a/clip.mp4');
    expect(JSON.parse(JSON.parse(out).history).clips[0].uri).toBe('file:///new/clip.mp4');
  });

  it('does not rewrite a replacement again', () => {
    const map = new Map([
      ['file:///a', 'file:///a/b'],
      ['file:///a/b', 'file:///z'],
    ]);
    expect(rewriteUris('file:///a', map)).toBe('file:///a/b');
  });
});

describe('collectFileUris', () => {
  it('returns unique file URIs and stops at quotes, backslashes and spaces', () => {
    const text = JSON.stringify({
      a: 'file:///x/1.jpg',
      b: 'file:///x/1.jpg',
      c: 'file:///x/2.png',
    });
    expect(collectFileUris(text)).toEqual(['file:///x/1.jpg', 'file:///x/2.png']);
    expect(collectFileUris('content://media/1 file:///y/z.mp4')).toEqual(['file:///y/z.mp4']);
  });

  it('finds URIs inside escaped JSON without the escaping backslash', () => {
    const text = JSON.stringify({ inner: JSON.stringify({ uri: 'file:///q/w.mov' }) });
    expect(collectFileUris(text)).toEqual(['file:///q/w.mov']);
  });
});

describe('fileKeyOf', () => {
  it('is stable, keeps a short extension and drops a long or missing one', () => {
    const key = fileKeyOf('file:///a/photo.jpg');
    expect(key).toBe(fileKeyOf('file:///a/photo.jpg'));
    expect(key).toMatch(/^[0-9a-f]{8}-\d+\.jpg$/);
    expect(fileKeyOf('file:///a/readme.abcdefghijk')).not.toMatch(/\.[a-z]+$/);
    expect(fileKeyOf('file:///a/noext')).toMatch(/^[0-9a-f]{8}-\d+$/);
  });
});

describe('fingerprint', () => {
  it('does not depend on the order of blob keys', () => {
    const a = fingerprint({ blobs: { 'project:1': '{}', 'layers:1': '[]' } });
    const b = fingerprint({ blobs: { 'layers:1': '[]', 'project:1': '{}' } });
    expect(a).toBe(b);
  });

  it('changes when any value changes', () => {
    const a = fingerprint({ blobs: { 'project:1': '{"n":1}' } });
    const b = fingerprint({ blobs: { 'project:1': '{"n":2}' } });
    expect(a).not.toBe(b);
  });
});

describe('isProjectBlobKey', () => {
  it("accepts only this project's keys, including history parts", () => {
    expect(isProjectBlobKey('p', 'project:p')).toBe(true);
    expect(isProjectBlobKey('p', 'history:p#gen.0')).toBe(true);
    expect(isProjectBlobKey('p', 'projectList')).toBe(false);
    expect(isProjectBlobKey('p', 'project:other')).toBe(false);
    expect(isProjectBlobKey('p', 'lastBackupAt')).toBe(false);
  });
});

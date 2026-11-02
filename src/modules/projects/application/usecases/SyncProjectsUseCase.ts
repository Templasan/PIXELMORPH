import {
  collectFileUris,
  fileKeyOf,
  fingerprint,
  isProjectBlobKey,
  planSync,
  rewriteUris,
  type LocalSyncProject,
  type SyncPlan,
  type SyncSnapshot,
} from '../../domain/sync/syncPlan';
import {
  CloudError,
  type CloudFile,
  type CloudFileStore,
  type CloudProject,
  type CloudProjectStore,
} from '../../ports/ProjectCloud';

export interface FileInfo {
  exists: boolean;
  size: number;
  modificationTime: number;
}

export interface SyncState {
  /** Per project: what was last synced, to tell what changed on each side. */
  last: Record<string, SyncSnapshot>;
  /** Per `projectId/key`: the size and time of a file already on the media server. */
  uploaded: Record<string, { size: number; modificationTime: number }>;
  /**
   * Per `projectId|localUri`: the server key of a file this phone got from the server. Its local
   * URI differs from the uploader's, so the key cannot be derived from it again.
   */
  fileKeys: Record<string, string>;
}

/** What the sync needs from the device's local storage and file system. */
export interface LocalProjectData {
  listIds(): Promise<string[]>;
  /** Every stored value that belongs to the project, keyed by its AsyncStorage key. */
  readBlobs(projectId: string): Promise<Record<string, string>>;
  /** `isNew` is true when the project did not exist here before, so it joins the project list. */
  writeBlobs(projectId: string, blobs: Record<string, string>, isNew: boolean): Promise<void>;
  fileInfo(uri: string): Promise<FileInfo | null>;
  targetUri(projectId: string, key: string): string;
  move(from: string, to: string): Promise<void>;
  remove(uri: string): Promise<void>;
  loadState(userId: string): Promise<SyncState>;
  saveState(userId: string, state: SyncState): Promise<void>;
}

export interface PreparedSync {
  plan: SyncPlan;
  /** Projects that would reach the server for the first time. */
  firstTimeUploadCount: number;
  /** Projects in conflict, with the names the user sees. */
  conflictNames: string[];
  /** Server time of each project in `plan.removedElsewhere`. */
  removedAt: Record<string, string>;
}

export interface SyncReport {
  uploaded: number;
  downloaded: number;
  tombstoned: number;
  removedElsewhere: number;
  conflicts: string[];
  failed: number;
  pendingUploads: number;
  pendingDownloads: number;
  missingFiles: number;
  serverOffline: boolean;
}

/** fileKeyOf output: 8 hex digits, a dash, the length, and an optional extension. */
const KEY_PATTERN = /^[0-9a-f]{8}-\d+(\.[A-Za-z0-9]{1,8})?$/;

function emptyReport(): SyncReport {
  return {
    uploaded: 0,
    downloaded: 0,
    tombstoned: 0,
    removedElsewhere: 0,
    conflicts: [],
    failed: 0,
    pendingUploads: 0,
    pendingDownloads: 0,
    missingFiles: 0,
    serverOffline: false,
  };
}

/** The server key of a local file: the one it came from the server with, else derived from its URI. */
function keyOf(id: string, uri: string, state: SyncState): string {
  return state.fileKeys[`${id}|${uri}`] ?? fileKeyOf(uri);
}

function nameOf(blobs: Record<string, string>, id: string): string {
  try {
    const dto = JSON.parse(blobs[`project:${id}`] ?? '');
    return typeof dto.name === 'string' ? dto.name : id;
  } catch {
    return id;
  }
}

/** A downloaded row is data from the server: only this project's keys and safe file keys pass. */
function isValidRemote(id: string, row: CloudProject): boolean {
  const blobs = row.payload?.blobs;
  if (!blobs || typeof blobs !== 'object' || Array.isArray(blobs)) return false;
  const keys = Object.keys(blobs);
  if (!keys.includes(`project:${id}`)) return false;
  if (!keys.every((k) => isProjectBlobKey(id, k) && typeof blobs[k] === 'string')) return false;
  if (!Array.isArray(row.files)) return false;
  return row.files.every(
    (f) =>
      !!f &&
      typeof f.key === 'string' &&
      KEY_PATTERN.test(f.key) &&
      typeof f.uri === 'string' &&
      f.uri.startsWith('file://')
  );
}

export class SyncProjectsUseCase {
  constructor(
    private readonly cloud: CloudProjectStore,
    private readonly files: CloudFileStore,
    private readonly local: LocalProjectData
  ) {}

  /** Reads both sides and plans the run. Writes nothing. */
  async prepare(userId: string): Promise<PreparedSync> {
    const state = await this.local.loadState(userId);
    const local: LocalSyncProject[] = [];
    for (const id of await this.local.listIds()) {
      const blobs = await this.local.readBlobs(id);
      if (!blobs[`project:${id}`]) continue;
      local.push({ id, name: nameOf(blobs, id), hash: fingerprint({ blobs }) });
    }
    const remote = await this.cloud.list();
    const plan = planSync(local, remote, state.last);
    const remoteById = new Map(remote.map((r) => [r.id, r]));
    const removedAt: Record<string, string> = {};
    for (const id of plan.removedElsewhere) {
      const row = remoteById.get(id);
      if (row) removedAt[id] = row.updatedAt;
    }
    return {
      plan,
      firstTimeUploadCount: plan.upload.filter((id) => !remoteById.has(id)).length,
      conflictNames: plan.conflicts.map((id) => remoteById.get(id)?.name ?? id),
      removedAt,
    };
  }

  /**
   * Carries out a prepared plan. Failures are counted in the report and the run goes on; the
   * state is saved as it goes, so an interrupted run loses nothing.
   */
  async run(
    userId: string,
    prepared: PreparedSync,
    onProgress: (done: number, total: number) => void
  ): Promise<SyncReport> {
    const { plan } = prepared;
    const state = await this.local.loadState(userId);
    const report = emptyReport();
    report.conflicts = prepared.conflictNames;
    const save = () => this.local.saveState(userId, state);
    const total = plan.upload.length + plan.tombstone.length + plan.download.length;
    let done = 0;

    // 1. Local projects to the server: the row first, files after (step 4).
    for (const id of plan.upload) {
      try {
        if (await this.sendRow(id, state)) {
          report.uploaded++;
          await save();
        }
      } catch (error) {
        this.countCloudError(error, report, 'failed');
      } finally {
        onProgress(++done, total);
      }
    }

    // 2. Projects deleted here: mark them deleted on the server. Their files stay there.
    // shortcut: server files of deleted projects stay, delete them when storage matters
    for (const id of plan.tombstone) {
      try {
        await this.cloud.markDeleted(id, new Date().toISOString());
        delete state.last[id];
        report.tombstoned++;
        await save();
      } catch (error) {
        this.countCloudError(error, report, 'failed');
      } finally {
        onProgress(++done, total);
      }
    }

    // 2b. Projects deleted on another device and kept here: the new server time is recorded so
    // the deletion is reported once. The local copy is not touched.
    for (const id of plan.removedElsewhere) {
      const snapshot = state.last[id];
      const at = prepared.removedAt[id];
      if (snapshot && at) {
        state.last[id] = { ...snapshot, remoteUpdatedAt: at };
        report.removedElsewhere++;
      }
    }
    await save();

    // 3. Projects from the server: only written when every file arrived.
    const presentNow = new Set(await this.local.listIds());
    for (const id of plan.download) {
      try {
        await this.download(id, presentNow.has(id), state, report);
        await save();
      } catch (error) {
        this.countCloudError(error, report, 'pendingDownloads');
      } finally {
        onProgress(++done, total);
      }
    }

    // 4. Files still to upload, for every local project that is not in conflict.
    const conflicting = new Set(plan.conflicts);
    let reachable = true;
    for (const id of await this.local.listIds()) {
      if (conflicting.has(id)) continue;
      reachable = await this.uploadFiles(id, state, report, reachable);
      await save();
    }

    // 5. Entries the plan says to forget.
    for (const id of plan.forget) delete state.last[id];
    await save();

    return report;
  }

  /** Sends one local project's row. Returns false when there is no local project to send. */
  private async sendRow(id: string, state: SyncState): Promise<boolean> {
    const blobs = await this.local.readBlobs(id);
    if (!blobs[`project:${id}`]) return false;
    const hash = fingerprint({ blobs });
    const files: CloudFile[] = [];
    for (const ref of await this.fileRefs(id, blobs, state)) {
      if (ref.info?.exists) files.push({ key: ref.key, uri: ref.uri, size: ref.info.size });
    }
    const updatedAt = new Date().toISOString();
    await this.cloud.upsert({ id, name: nameOf(blobs, id), payload: { blobs }, files, updatedAt });
    state.last[id] = { hash, remoteUpdatedAt: updatedAt };
    return true;
  }

  /**
   * Uploads the files of one project that the server does not have yet. Returns whether the
   * server is still reachable: once it is not, the rest of the files only count as pending.
   */
  private async uploadFiles(
    id: string,
    state: SyncState,
    report: SyncReport,
    reachable: boolean
  ): Promise<boolean> {
    const blobs = await this.local.readBlobs(id);
    let ok = reachable;
    for (const ref of await this.fileRefs(id, blobs, state)) {
      if (!ref.info?.exists) {
        report.missingFiles++;
        continue;
      }
      const { size, modificationTime } = ref.info;
      const mark = state.uploaded[`${id}/${ref.key}`];
      if (mark && mark.size === size && mark.modificationTime === modificationTime) continue;
      if (!ok) {
        report.pendingUploads++;
        continue;
      }
      try {
        await this.files.upload(id, ref.key, ref.uri);
        state.uploaded[`${id}/${ref.key}`] = { size, modificationTime };
      } catch (error) {
        this.countCloudError(error, report, 'pendingUploads');
        if (
          error instanceof CloudError &&
          (error.kind === 'offline' || error.kind === 'unauthorized')
        ) {
          ok = false;
        }
      }
    }
    return ok;
  }

  private async download(
    id: string,
    alreadyHere: boolean,
    state: SyncState,
    report: SyncReport
  ): Promise<void> {
    const row = await this.cloud.get(id);
    if (!isValidRemote(id, row)) {
      report.failed++;
      return;
    }
    if (alreadyHere) {
      // Only a copy that is exactly what was last synced may be replaced; any other local edit
      // (or a copy this device never synced) is kept and reported.
      const hash = fingerprint({ blobs: await this.local.readBlobs(id) });
      if (!state.last[id] || state.last[id].hash !== hash) {
        report.conflicts.push(row.name);
        return;
      }
    }

    const targets = row.files.map((f) => ({
      key: f.key,
      uri: f.uri,
      target: this.local.targetUri(id, f.key),
    }));
    const parts: string[] = [];
    try {
      for (const t of targets) {
        parts.push(`${t.target}.part`);
        await this.files.download(id, t.key, `${t.target}.part`);
      }
    } catch (error) {
      for (const part of parts) await this.local.remove(part);
      throw error;
    }

    for (const t of targets) await this.local.move(`${t.target}.part`, t.target);
    const rewrite = new Map(targets.map((t) => [t.uri, t.target]));
    const blobs: Record<string, string> = {};
    for (const [key, text] of Object.entries(row.payload.blobs)) {
      blobs[key] = rewriteUris(text, rewrite);
    }
    await this.local.writeBlobs(id, blobs, !alreadyHere);
    const back = await this.local.readBlobs(id);
    state.last[id] = { hash: fingerprint({ blobs: back }), remoteUpdatedAt: row.updatedAt };

    // The files are already on the server under their original keys: remember those keys and
    // their size and time, so the next run does not upload them again.
    for (const t of targets) {
      state.fileKeys[`${id}|${t.target}`] = t.key;
      const info = await this.local.fileInfo(t.target);
      if (info)
        state.uploaded[`${id}/${t.key}`] = {
          size: info.size,
          modificationTime: info.modificationTime,
        };
    }
    report.downloaded++;
  }

  private countCloudError(
    error: unknown,
    report: SyncReport,
    counter: 'failed' | 'pendingUploads' | 'pendingDownloads'
  ): void {
    if (!(error instanceof CloudError)) throw error;
    if (error.kind === 'offline') report.serverOffline = true;
    report[counter]++;
  }

  private async fileRefs(id: string, blobs: Record<string, string>, state: SyncState) {
    const uris = new Set<string>();
    for (const text of Object.values(blobs)) {
      for (const uri of collectFileUris(text)) uris.add(uri);
    }
    return Promise.all(
      [...uris].map(async (uri) => ({
        uri,
        key: keyOf(id, uri, state),
        info: await this.local.fileInfo(uri),
      }))
    );
  }
}

// Pure sync rules: no React Native or Expo imports, so Jest can test every decision.

export interface LocalSyncProject {
  id: string;
  name: string;
  hash: string;
}

export interface RemoteSyncProject {
  id: string;
  name: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SyncSnapshot {
  hash: string;
  remoteUpdatedAt: string;
}

export interface SyncPlan {
  upload: string[];
  download: string[];
  tombstone: string[];
  forget: string[];
  conflicts: string[];
  /** Deleted on another device, kept here unchanged: the local copy stays and this is reported. */
  removedElsewhere: string[];
}

/** A project's synced data: every AsyncStorage entry that belongs to it, keyed by that entry's key. */
export interface ProjectPayload {
  blobs: Record<string, string>;
}

export function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Distinct `file://` URIs in `text`. A URI ends at a quote, a backslash or whitespace. */
export function collectFileUris(text: string): string[] {
  return [...new Set(text.match(/file:\/\/[^"\\\s]+/g) ?? [])];
}

/**
 * Replaces every URI found in `map` with its mapped value. One pass over the text, longest key
 * first, so a URI that is a prefix of another one never corrupts it, and a replacement is never
 * matched again.
 */
export function rewriteUris(text: string, map: ReadonlyMap<string, string>): string {
  if (map.size === 0) return text;
  const keys = [...map.keys()].sort((a, b) => b.length - a.length);
  const escaped = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return text.replace(new RegExp(escaped.join('|'), 'g'), (match) => map.get(match) ?? match);
}

/** Server key of a local file: stable for a given URI, and it keeps the extension. */
export function fileKeyOf(uri: string): string {
  const extension = uri.match(/\.[A-Za-z0-9]{1,8}$/)?.[0] ?? '';
  return `${fnv1a(uri)}-${uri.length}${extension}`;
}

/** Fingerprint of a project's data. Blob keys are sorted, so the same data always hashes the same. */
export function fingerprint(payload: ProjectPayload): string {
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(payload.blobs).sort()) sorted[key] = payload.blobs[key];
  const json = JSON.stringify({ blobs: sorted });
  return `${fnv1a(json)}-${json.length}`;
}

/**
 * Whether an AsyncStorage key belongs to project `projectId`. A downloaded payload may only write
 * these keys, so a bad payload cannot overwrite anything else in storage.
 */
export function isProjectBlobKey(projectId: string, key: string): boolean {
  return (
    key === `project:${projectId}` ||
    key === `layers:${projectId}` ||
    key === `editorImages:${projectId}` ||
    key === `history:${projectId}` ||
    key.startsWith(`history:${projectId}#`)
  );
}

/** Server timestamps come back in a different text form, so compare instants, not strings. */
function sameInstant(a: string, b: string): boolean {
  return Date.parse(a) === Date.parse(b);
}

/**
 * Decides, for every project, what one sync run does with it. A local project with changes is
 * never deleted or overwritten here; disagreements are reported as conflicts instead.
 */
export function planSync(
  local: readonly LocalSyncProject[],
  remote: readonly RemoteSyncProject[],
  last: Readonly<Record<string, SyncSnapshot>>
): SyncPlan {
  const plan: SyncPlan = {
    upload: [],
    download: [],
    tombstone: [],
    forget: [],
    conflicts: [],
    removedElsewhere: [],
  };
  const localById = new Map(local.map((p) => [p.id, p]));
  const remoteById = new Map(remote.map((p) => [p.id, p]));
  const ids = new Set([...localById.keys(), ...remoteById.keys(), ...Object.keys(last)]);

  for (const id of ids) {
    const L = localById.get(id);
    const R = remoteById.get(id);
    const S = last[id];
    const deleted = !!R?.deletedAt;

    if (L) {
      if (!R) {
        plan.upload.push(id);
      } else if (!S) {
        (deleted ? plan.upload : plan.conflicts).push(id);
      } else {
        const localChanged = L.hash !== S.hash;
        const remoteChanged = !sameInstant(R.updatedAt, S.remoteUpdatedAt);
        if (deleted) {
          // Edited here after another device deleted it: it returns to the account (upsert
          // clears deleted_at). Untouched: the local copy stays and the deletion is reported once.
          if (localChanged) plan.upload.push(id);
          else if (remoteChanged) plan.removedElsewhere.push(id);
        } else if (localChanged && remoteChanged) {
          plan.conflicts.push(id);
        } else if (localChanged) {
          plan.upload.push(id);
        } else if (remoteChanged) {
          plan.download.push(id);
        }
      }
    } else if (!R) {
      if (S) plan.forget.push(id);
    } else if (deleted) {
      if (S) plan.forget.push(id);
    } else if (!S) {
      plan.download.push(id);
    } else if (sameInstant(R.updatedAt, S.remoteUpdatedAt)) {
      // Known and unchanged on the server, gone here: the user deleted it on this device.
      plan.tombstone.push(id);
    } else {
      plan.conflicts.push(id);
    }
  }

  return plan;
}

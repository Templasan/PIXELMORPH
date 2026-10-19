import * as FileSystem from 'expo-file-system/legacy';
import { createStore, shallowEqual, useStore } from '@core/state';
import { errorLogger } from '@core/reliability';

/**
 * 'checking' while the file is looked up; 'pending' queued; 'running' being made; 'none' when the
 * source needs no light copy (small, or outside the documents folder); 'failed' when making it
 * failed. Both 'none' and 'failed' let the editor open the original.
 */
export type PhotoProxyStatus = 'checking' | 'pending' | 'running' | 'ready' | 'none' | 'failed';

export interface PhotoProxyEntry {
  status: PhotoProxyStatus;
  /** 0..100 while running. */
  progress: number;
  /** The light copy file, once status is 'ready'. */
  uri?: string;
  /** Original pixel size, when the job that made the light copy measured it. */
  sourceWidth?: number;
  sourceHeight?: number;
}

export interface PhotoProxyResult {
  /** 'small': the source already fits PREVIEW_LONG_EDGE, so no file was written. */
  kind: 'written' | 'small';
  width: number;
  height: number;
}

export type MakePhotoProxy = (sourceUri: string, tmpUri: string) => Promise<PhotoProxyResult>;

/** Light copy state by source uri. */
export const photoProxyStore = createStore<Record<string, PhotoProxyEntry>>({});

/** Where the light copy of `uri` lives: next to it, same name with `.proxy2048.jpg`. */
export function proxyFileOf(uri: string): string {
  return `${uri.replace(/\.[^./]+$/, '')}.proxy2048.jpg`;
}

/**
 * Light copy of a source. Only sources inside the documents folder get one; anything else
 * (e.g. the cache) has no light copy and opens the original.
 */
export function photoProxyPathOf(sourceUri: string): string | null {
  const dir = FileSystem.documentDirectory;
  if (!dir || !sourceUri.startsWith(dir)) return null;
  return proxyFileOf(sourceUri);
}

interface Job {
  sourceUri: string;
  uri: string;
  tmpUri: string;
  makeProxy: MakePhotoProxy;
}

const queue: Job[] = [];
let busy = false;

function patch(sourceUri: string, entry: PhotoProxyEntry) {
  photoProxyStore.set((s) => ({ ...s, [sourceUri]: entry }));
}

/** One light copy at a time. */
function pump(): void {
  if (busy) return;
  const job = queue.shift();
  if (!job) return;
  busy = true;
  runJob(job).finally(() => {
    busy = false;
    pump();
  });
}

/** Written to a .tmp file and renamed only on success, so a killed app never leaves a half file that looks ready. */
async function runJob(job: Job): Promise<void> {
  const { sourceUri, uri, tmpUri } = job;
  patch(sourceUri, { status: 'running', progress: 0 });
  try {
    const result = await job.makeProxy(sourceUri, tmpUri);
    if (result.kind === 'small') {
      patch(sourceUri, {
        status: 'none',
        progress: 0,
        sourceWidth: result.width,
        sourceHeight: result.height,
      });
      return;
    }
    await FileSystem.deleteAsync(uri, { idempotent: true });
    await FileSystem.moveAsync({ from: tmpUri, to: uri });
    patch(sourceUri, {
      status: 'ready',
      progress: 100,
      uri,
      sourceWidth: result.width,
      sourceHeight: result.height,
    });
  } catch (error) {
    await FileSystem.deleteAsync(tmpUri, { idempotent: true }).catch(() => {});
    errorLogger.log(error, 'photoProxy.make');
    patch(sourceUri, { status: 'failed', progress: 0 });
  }
}

/**
 * Queues the light copy of `sourceUri`. An existing file from an earlier session is used as is;
 * repeated requests for one source are ignored. `makeProxy` does the decoding (kept out of this
 * file so it stays testable without Skia).
 */
export async function requestPhotoProxy(
  sourceUri: string,
  makeProxy: MakePhotoProxy
): Promise<void> {
  if (photoProxyStore.get()[sourceUri]) return;
  const uri = photoProxyPathOf(sourceUri);
  if (!uri) {
    patch(sourceUri, { status: 'none', progress: 0 });
    return;
  }
  patch(sourceUri, { status: 'checking', progress: 0 });
  const info = await FileSystem.getInfoAsync(uri).catch(() => ({ exists: false }));
  if (info.exists) {
    patch(sourceUri, { status: 'ready', progress: 100, uri });
    return;
  }
  patch(sourceUri, { status: 'pending', progress: 0 });
  queue.push({ sourceUri, uri, tmpUri: `${uri}.tmp.jpg`, makeProxy });
  pump();
}

/** Bake path: the light copy of a file the editor just wrote, so no decode is needed later. */
export function setPhotoProxyReady(
  sourceUri: string,
  proxyUri: string,
  size?: { width: number; height: number }
): void {
  patch(sourceUri, {
    status: 'ready',
    progress: 100,
    uri: proxyUri,
    sourceWidth: size?.width,
    sourceHeight: size?.height,
  });
}

export interface PhotoProxyReadiness {
  /** False while the light copy is being prepared; the editor shows its overlay then. */
  ready: boolean;
  /** What the live canvas loads: the light copy, or the original for 'none'/'failed'. Null while not ready. */
  uri: string | null;
  /** 0..100 while running. */
  progress: number;
  /** Original size, when known from the job that made the light copy. */
  sourceWidth?: number;
  sourceHeight?: number;
}

/** Pure readiness of one source. No source (no photo yet) counts as ready with nothing to show. */
export function photoProxyReadiness(
  state: Record<string, PhotoProxyEntry>,
  sourceUri: string | null
): PhotoProxyReadiness {
  if (!sourceUri) return { ready: true, uri: null, progress: 0 };
  const entry = state[sourceUri];
  const sizes = { sourceWidth: entry?.sourceWidth, sourceHeight: entry?.sourceHeight };
  if (entry?.status === 'ready') {
    return { ready: true, uri: entry.uri ?? null, progress: 100, ...sizes };
  }
  if (entry?.status === 'none' || entry?.status === 'failed') {
    return { ready: true, uri: sourceUri, progress: 0, ...sizes };
  }
  return { ready: false, uri: null, progress: entry?.status === 'running' ? entry.progress : 0 };
}

/** Editor gate: whether the light copy is ready, and which uri to draw. */
export function usePhotoProxyReady(sourceUri: string | null): PhotoProxyReadiness {
  return useStore(photoProxyStore, (state) => photoProxyReadiness(state, sourceUri), shallowEqual);
}

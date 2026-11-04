import * as FileSystem from 'expo-file-system/legacy';
import { createStore, shallowEqual, useStore } from '@core/state';
import { errorLogger } from '@core/reliability';
import { proxyKey, type ProxyVariant } from './previewTier';
import { uprightDimensions } from '@modules/device-media/uprightDimensions';
import {
  cancelVideoExport,
  exportVideo,
  probeVideo,
} from '../../../../modules/pixelmorph-video-export/src';

/** Sources whose long edge is above this get a proxy; the proxy's long edge is this. */
export const PROXY_LONG_EDGE = 1280;
export { proxyKey, type ProxyVariant };
const PROXY_BITRATE = 5_000_000;
/** Proxies keyframe every second: long gaps made seeks slow (the engine decodes from the keyframe). */
const PROXY_KEYFRAME_SECONDS = 1;

/**
 * The copy for low-end phones keyframes more often. On a Samsung A11 a jump took 315 ms at every
 * 30 frames and 219 ms at every 10, for a file of the same size.
 */
const LOW_END_KEYFRAME_SECONDS = 1 / 3;

const VARIANTS: Record<ProxyVariant, { longEdge: number; bitrate: number; keyframeSeconds: number }> = {
  '720': { longEdge: PROXY_LONG_EDGE, bitrate: PROXY_BITRATE, keyframeSeconds: PROXY_KEYFRAME_SECONDS },
  '540': { longEdge: 960, bitrate: 3_000_000, keyframeSeconds: LOW_END_KEYFRAME_SECONDS },
  '1080': { longEdge: 1920, bitrate: 10_000_000, keyframeSeconds: LOW_END_KEYFRAME_SECONDS },
};
/** How long a pause waits for the cancelled transcode to report back before carrying on. */
const SETTLE_TIMEOUT_MS = 10_000;

/**
 * 'checking' while the source is probed; 'none' when it needs no proxy (small, outside the
 * documents folder, or unreadable). Only 'pending' and 'running' are still being prepared.
 */
export type ProxyStatus = 'checking' | 'none' | 'pending' | 'running' | 'ready' | 'failed';

export interface ProxyEntry {
  status: ProxyStatus;
  /** 0..100 while running. */
  progress: number;
  /** The finished proxy file, once status is 'ready'. */
  uri?: string;
}

/** Proxy state by source uri. The preview and the editor label subscribe to it with useStore. */
export const proxyStore = createStore<Record<string, ProxyEntry>>({});

/** Output size of the 720p proxy, or null when the source is already small enough. */
export function proxyDimensions(
  width: number,
  height: number,
  variant: ProxyVariant = '720'
): { width: number; height: number } | null {
  if (!(width > 0 && height > 0)) return null;
  const edge = VARIANTS[variant].longEdge;
  const long = Math.max(width, height);
  if (long <= edge) return null;
  const scale = edge / long;
  // H.264 wants even sides; rounding to the nearest even keeps the aspect within a pixel.
  const short = 2 * Math.round((Math.min(width, height) * scale) / 2);
  return width >= height ? { width: edge, height: short } : { width: short, height: edge };
}

/**
 * The proxy sits next to its source (`<name>.proxy720.mp4`). Only sources inside the app's
 * documents folder get one; anything else plays the original.
 */
export function proxyPathOf(sourceUri: string, variant: ProxyVariant = '720'): string | null {
  const dir = FileSystem.documentDirectory;
  if (!dir || !sourceUri.startsWith(dir)) return null;
  return `${sourceUri.replace(/\.[^./]+$/, '')}.proxy${variant}.mp4`;
}

interface Job {
  sourceUri: string;
  variant: ProxyVariant;
  uri: string;
  tmpUri: string;
  width: number;
  height: number;
  durationMs: number;
}

interface Run {
  job: Job;
  cancelled: boolean;
  settled: Promise<void>;
}

const queue: Job[] = [];
let active: Run | null = null;
let paused = false;

function patch(key: string, entry: ProxyEntry) {
  proxyStore.set((s) => ({ ...s, [key]: entry }));
}

const nativePath = (uri: string) => uri.replace(/^file:\/\//, '');

/** One transcode: written to a .tmp file and renamed only when it finished, so a killed app never leaves a half proxy that looks ready. */
async function transcode(run: Run) {
  const { job } = run;
  const key = proxyKey(job.sourceUri, job.variant);
  patch(key, { status: 'running', progress: 0 });
  try {
    await exportVideo(
      {
        // Every field explicit: an omitted one reaches the native record as 0, not its default.
        clips: [
          {
            uri: job.sourceUri,
            kind: 'video',
            inMs: 0,
            outMs: job.durationMs,
            speed: 1,
            volume: 1,
            rotation: 0,
            transitionIn: '',
            transitionInMs: 0,
            transitionMode: 'out',
            startMs: 0,
          },
        ],
        audio: [],
        width: job.width,
        height: job.height,
        bitrate: VARIANTS[job.variant].bitrate,
        keyFrameIntervalSeconds: VARIANTS[job.variant].keyframeSeconds,
        outputPath: nativePath(job.tmpUri),
      },
      (progress) => patch(key, { status: 'running', progress })
    );
    await FileSystem.deleteAsync(job.uri, { idempotent: true });
    await FileSystem.moveAsync({ from: job.tmpUri, to: job.uri });
    patch(key, { status: 'ready', progress: 100, uri: job.uri });
  } catch (error) {
    await FileSystem.deleteAsync(job.tmpUri, { idempotent: true }).catch(() => {});
    if (run.cancelled) {
      // Paused for an export: this job goes back to the front and runs again on resume.
      queue.unshift(job);
      patch(key, { status: 'pending', progress: 0 });
      return;
    }
    errorLogger.log(error, 'previewProxy.transcode');
    patch(key, { status: 'failed', progress: 0 });
  }
}

/** Starts the next queued job unless one is running or the queue is paused. */
function pump() {
  if (active || paused) return;
  const job = queue.shift();
  if (!job) return;
  const run: Run = { job, cancelled: false, settled: Promise.resolve() };
  active = run;
  run.settled = transcode(run).finally(() => {
    active = null;
    pump();
  });
}

/**
 * Queues the proxy of `sourceUri` (a source with long edge above PROXY_LONG_EDGE). A finished
 * proxy file from an earlier session is used as is; repeated requests for one source are ignored.
 * `sourceWidth`/`sourceHeight` are the upright (rotation-corrected) size; `durationMs` keeps the
 * proxy the same length as the original, so source times line up.
 */
export async function requestProxy(
  sourceUri: string,
  sourceWidth: number,
  sourceHeight: number,
  durationMs: number,
  variant: ProxyVariant = '720'
): Promise<void> {
  // 'checking' is set by requestSourceProxy before the probe and must not block this request.
  const key = proxyKey(sourceUri, variant);
  const existing = proxyStore.get()[key];
  if (existing && existing.status !== 'checking') return;
  const uri = proxyPathOf(sourceUri, variant);
  const size = proxyDimensions(sourceWidth, sourceHeight, variant);
  if (!uri || !size || !(durationMs > 0)) return;
  patch(key, { status: 'pending', progress: 0 });
  const info = await FileSystem.getInfoAsync(uri).catch(() => ({ exists: false }));
  if (info.exists) {
    patch(key, { status: 'ready', progress: 100, uri });
    return;
  }
  queue.push({
    sourceUri,
    variant,
    uri,
    tmpUri: `${uri}.tmp.mp4`,
    width: size.width,
    height: size.height,
    durationMs,
  });
  pump();
}

/** Stops the running transcode (if any) and holds the queue until resumeProxies(). */
export async function pauseProxiesForExport(): Promise<void> {
  paused = true;
  const run = active;
  if (!run) return;
  run.cancelled = true;
  cancelVideoExport();
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    run.settled,
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, SETTLE_TIMEOUT_MS);
    }),
  ]);
  clearTimeout(timer);
}

export function resumeProxies(): void {
  paused = false;
  pump();
}

interface ProbedVideo {
  width: number;
  height: number;
  durationMs: number;
}

/** Upright size and duration from the file's metadata (what the editor does not know yet). */
async function probeSource(uri: string): Promise<ProbedVideo | null> {
  const probed = await probeVideo(uri).catch(() => null);
  if (!probed || !(probed.width > 0) || !(probed.height > 0) || !(probed.durationMs > 0))
    return null;
  // Metadata holds the stored (sideways) size; the rotation tag makes it upright.
  const upright = uprightDimensions(probed.width, probed.height, probed.rotation);
  return { ...upright, durationMs: probed.durationMs };
}

const probes = new Map<string, Promise<ProbedVideo | null>>();

function probeOnce(uri: string): Promise<ProbedVideo | null> {
  let probe = probes.get(uri);
  if (!probe) {
    probe = probeSource(uri);
    probes.set(uri, probe);
  }
  return probe;
}

/**
 * The copy for a low-end phone. A file above 1080p gets one 1080p copy, which the preview and the
 * export share: on a Samsung A11 it jumps in 231 ms and plays at 1.00, and making a second copy for
 * the export took another four minutes of a 4K minute. A smaller file gets the lightest one.
 */
export async function requestLowEndProxy(sourceUri: string): Promise<void> {
  const size = await probeOnce(sourceUri);
  const above = size !== null && Math.max(size.width, size.height) > VARIANTS['1080'].longEdge;
  return requestSourceProxy(sourceUri, above ? '1080' : '540');
}

/**
 * Editor entry point: reads the source's size once (cached per uri), then queues its proxy.
 * Does nothing for sources outside the documents folder.
 */
export function requestSourceProxy(
  sourceUri: string,
  variant: ProxyVariant = '720'
): Promise<void> {
  const key = proxyKey(sourceUri, variant);
  const current = () => proxyStore.get()[key]?.status;
  if (!proxyPathOf(sourceUri, variant)) {
    if (!current()) patch(key, { status: 'none', progress: 0 });
    return Promise.resolve();
  }
  if (!current()) patch(key, { status: 'checking', progress: 0 });
  return probeOnce(sourceUri)
    .then(async (size) => {
      if (size && proxyDimensions(size.width, size.height, variant)) {
        await requestProxy(sourceUri, size.width, size.height, size.durationMs, variant);
      } else if (current() === 'checking') {
        // Probe failed, or the source is already within the proxy size: nothing to transcode.
        patch(key, { status: 'none', progress: 0 });
      }
    })
    .catch((error) => {
      // Never leave 'checking' behind: the editor would wait on it forever.
      if (current() === 'checking') patch(key, { status: 'failed', progress: 0 });
      errorLogger.log(error, 'previewProxy.request');
    });
}

export interface SourcesReadiness {
  /** Every source is ready, has no proxy, or failed (the editor then plays the original). */
  ready: boolean;
  /** 0..100, averaged over the sources still being prepared; 0 while only queued or checking. */
  progress: number;
}

/** Pure readiness of `uris` in `state`. A source with no entry yet counts as still preparing. */
export function sourcesReadiness(
  state: Record<string, ProxyEntry>,
  uris: readonly string[]
): SourcesReadiness {
  let preparing = 0;
  let sum = 0;
  for (const uri of uris) {
    const entry = state[uri];
    if (entry?.status === 'ready' || entry?.status === 'none' || entry?.status === 'failed')
      continue;
    preparing += 1;
    if (entry?.status === 'running') sum += entry.progress;
  }
  return { ready: preparing === 0, progress: preparing ? sum / preparing : 0 };
}

/**
 * Export fallback: queues the 1080p copy of each source, then resolves once every copy is finished,
 * failed or not needed. The map holds only the copies that are ready (original uri → copy uri).
 */
export async function awaitExportCopies(
  uris: string[],
  onProgress: (pct: number) => void
): Promise<Record<string, string>> {
  const keys = uris.map((uri) => proxyKey(uri, '1080'));
  await Promise.all(uris.map((uri) => requestSourceProxy(uri, '1080')));
  return new Promise((resolve) => {
    const check = (): boolean => {
      const state = proxyStore.get();
      const readiness = sourcesReadiness(state, keys);
      if (!readiness.ready) {
        onProgress(readiness.progress);
        return false;
      }
      unsubscribe();
      onProgress(100);
      const map: Record<string, string> = {};
      uris.forEach((uri, i) => {
        const entry = state[keys[i]];
        if (entry?.status === 'ready' && entry.uri) map[uri] = entry.uri;
      });
      resolve(map);
      return true;
    };
    const unsubscribe = proxyStore.subscribe(() => {
      check();
    });
    check();
  });
}

/** Editor gate: whether the sources' preview copies are ready, and how far along they are. */
export function useSourcesReady(uris: readonly string[]): SourcesReadiness {
  return useStore(proxyStore, (state) => sourcesReadiness(state, uris), shallowEqual);
}

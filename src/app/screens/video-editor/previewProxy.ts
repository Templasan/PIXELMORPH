import * as FileSystem from 'expo-file-system/legacy';
import { createStore } from '@core/state';
import { errorLogger } from '@core/reliability';
import { uprightDimensions } from '@modules/device-media/uprightDimensions';
import {
  cancelVideoExport,
  exportVideo,
  probeVideo,
} from '../../../../modules/pixelmorph-video-export/src';

/** Sources whose long edge is above this get a proxy; the proxy's long edge is this. */
export const PROXY_LONG_EDGE = 1280;
const PROXY_BITRATE = 5_000_000;
/** How long a pause waits for the cancelled transcode to report back before carrying on. */
const SETTLE_TIMEOUT_MS = 10_000;

export type ProxyStatus = 'pending' | 'running' | 'ready' | 'failed';

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
  height: number
): { width: number; height: number } | null {
  if (!(width > 0 && height > 0)) return null;
  const long = Math.max(width, height);
  if (long <= PROXY_LONG_EDGE) return null;
  const scale = PROXY_LONG_EDGE / long;
  // H.264 wants even sides; rounding to the nearest even keeps the aspect within a pixel.
  const short = 2 * Math.round((Math.min(width, height) * scale) / 2);
  return width >= height
    ? { width: PROXY_LONG_EDGE, height: short }
    : { width: short, height: PROXY_LONG_EDGE };
}

/**
 * The proxy sits next to its source (`<name>.proxy720.mp4`). Only sources inside the app's
 * documents folder get one; anything else plays the original.
 */
export function proxyPathOf(sourceUri: string): string | null {
  const dir = FileSystem.documentDirectory;
  if (!dir || !sourceUri.startsWith(dir)) return null;
  return `${sourceUri.replace(/\.[^./]+$/, '')}.proxy720.mp4`;
}

interface Job {
  sourceUri: string;
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

function patch(sourceUri: string, entry: ProxyEntry) {
  proxyStore.set((s) => ({ ...s, [sourceUri]: entry }));
}

const nativePath = (uri: string) => uri.replace(/^file:\/\//, '');

/** One transcode: written to a .tmp file and renamed only when it finished, so a killed app never leaves a half proxy that looks ready. */
async function transcode(run: Run) {
  const { job } = run;
  patch(job.sourceUri, { status: 'running', progress: 0 });
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
            startMs: 0,
          },
        ],
        audio: [],
        width: job.width,
        height: job.height,
        bitrate: PROXY_BITRATE,
        outputPath: nativePath(job.tmpUri),
      },
      (progress) => patch(job.sourceUri, { status: 'running', progress })
    );
    await FileSystem.deleteAsync(job.uri, { idempotent: true });
    await FileSystem.moveAsync({ from: job.tmpUri, to: job.uri });
    patch(job.sourceUri, { status: 'ready', progress: 100, uri: job.uri });
  } catch (error) {
    await FileSystem.deleteAsync(job.tmpUri, { idempotent: true }).catch(() => {});
    if (run.cancelled) {
      // Paused for an export: this job goes back to the front and runs again on resume.
      queue.unshift(job);
      patch(job.sourceUri, { status: 'pending', progress: 0 });
      return;
    }
    errorLogger.log(error, 'previewProxy.transcode');
    patch(job.sourceUri, { status: 'failed', progress: 0 });
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
  durationMs: number
): Promise<void> {
  if (proxyStore.get()[sourceUri]) return;
  const uri = proxyPathOf(sourceUri);
  const size = proxyDimensions(sourceWidth, sourceHeight);
  if (!uri || !size || !(durationMs > 0)) return;
  patch(sourceUri, { status: 'pending', progress: 0 });
  const info = await FileSystem.getInfoAsync(uri).catch(() => ({ exists: false }));
  if (info.exists) {
    patch(sourceUri, { status: 'ready', progress: 100, uri });
    return;
  }
  queue.push({
    sourceUri,
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

/**
 * Editor entry point: reads the source's size once (cached per uri), then queues its proxy.
 * Does nothing for sources outside the documents folder.
 */
export function requestSourceProxy(sourceUri: string): Promise<void> {
  if (!proxyPathOf(sourceUri)) return Promise.resolve();
  let probe = probes.get(sourceUri);
  if (!probe) {
    probe = probeSource(sourceUri);
    probes.set(sourceUri, probe);
  }
  return probe
    .then((size) =>
      size ? requestProxy(sourceUri, size.width, size.height, size.durationMs) : undefined
    )
    .catch((error) => errorLogger.log(error, 'previewProxy.request'));
}

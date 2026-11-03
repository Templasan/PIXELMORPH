import { t } from '../i18n';
import {
  AudioBufferSource,
  canEncodeAudio,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  Quality,
  StreamTarget,
  type StreamTargetChunk,
  type VideoSample,
} from 'mediabunny';
import { opsAt, type Composition, type MediaOp } from '../domain/composition';
import { GifPalette, GifWriter, gifDelayCs } from '../domain/gifEncoder';
import { GIF_MAX_DURATION_MS } from '../domain/gifPlan';
import { frameFeatures, pickHighlights, type FrameFeatures } from '../domain/highlights';
import { adaptiveBitrate, complexityOf, frameStats, type FrameStats } from '../domain/sceneComplexity';
import type { ExportSink } from '../ports/host';
import { mixWindow } from './audio';
import { drawFrame } from './draw';
import type { MediaPool } from './media';

const FPS = 30;
/** Sound goes in windows this long, just ahead of the frames, so the muxer can interleave. */
const AUDIO_WINDOW_MS = 10_000;
const GIF_PALETTE_SAMPLES = 12;
/** RNF-013: complexity is read from at most this many frames, drawn at most this many pixels wide. */
const ANALYSIS_SAMPLES = 24;
const ANALYSIS_EDGE = 480;

/** A new file per export: an export never overwrites an earlier one. */
function exportName(ext: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `pixelmorph-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${ext}`;
}

export interface ExportRequest {
  comp: Composition;
  /** The preset's bitrate: the ceiling for the file, and the whole of it when `adaptive` is off. */
  bitrate: number;
  /** RNF-013: lower the mp4 bitrate for a simple clip (see sceneComplexity.ts). */
  adaptive?: boolean;
  /** `highlights`: an animated thumbnail of the best moments instead of the timeline itself. */
  gif?: { fps: number; maxColors: number; highlights?: boolean };
  sink: ExportSink;
  onProgress(percent: number): void;
  isCancelled(): boolean;
}

export interface ExportOutcome {
  path: string;
  bytes: number;
  durationMs: number;
  frameCount: number;
  truncated: boolean;
  /** Sources whose sound could not be decoded here and was left out. */
  silent: string[];
  /** Set when the adaptive bitrate was read and used; `bitrate` is what the encoder got. */
  smart?: { bitrate: number; presetBitrate: number; complexity: number; analysisMs: number };
}

/**
 * Frame-by-frame export of a composition with the SAME `opsAt` + `drawFrame` as the preview, on
 * its own canvas and decoder slots (prefix 'x:'), so it never disturbs the preview's.
 */
export async function exportComposition(pool: MediaPool, req: ExportRequest): Promise<ExportOutcome> {
  const { comp } = req;
  if (comp.durationMs <= 0) throw new Error(t('A linha do tempo está vazia: nada para exportar.'));
  const canvas = new OffscreenCanvas(comp.width, comp.height);
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: !!req.gif })!;
  const frameAt = async (t: number) => {
    const ops = opsAt(comp, t);
    const frames = new Map<MediaOp, VideoSample | ImageBitmap | null>();
    await Promise.all(
      ops.map(async (op) => {
        if (op.kind === 'image') frames.set(op, await pool.picture(op.uri, comp.width));
        if (op.kind !== 'video') return;
        const feed = await pool.feed(`x:${op.key}`, op.uri);
        frames.set(op, await feed.at(op.sourceTimeMs / 1000));
      })
    );
    drawFrame(ctx, comp.width, comp.height, ops, (op) => frames.get(op) ?? null);
  };
  try {
    return req.gif ? await gif(req, frameAt, ctx) : await mp4(pool, req, canvas, frameAt);
  } finally {
    pool.prune(new Set(), new Set()); // export decoders and files; the preview reopens what it needs
  }
}

async function mp4(
  pool: MediaPool,
  req: ExportRequest,
  canvas: OffscreenCanvas,
  frameAt: (t: number) => Promise<void>
): Promise<ExportOutcome> {
  const { comp, sink } = req;
  const endMs = comp.durationMs;
  const total = Math.max(1, Math.floor((endMs / 1000) * FPS));
  const smart = req.adaptive ? await smartBitrate(req, canvas, frameAt, endMs) : undefined;
  const bitrate = smart?.bitrate ?? req.bitrate;
  await sink.start(exportName('mp4'));
  let bytes = 0;
  let writes = Promise.resolve();
  const writable = new WritableStream<StreamTargetChunk>({
    write: (chunk) => {
      bytes = Math.max(bytes, chunk.position + chunk.data.byteLength);
      const data = chunk.data.slice();
      writes = writes.then(() => sink.write(chunk.position, data));
    },
  });
  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new StreamTarget(writable, { chunked: true, chunkSize: 4 * 1024 * 1024 }),
  });
  const hw = await VideoEncoder.isConfigSupported({
    codec: 'avc1.640028',
    width: comp.width,
    height: comp.height,
    bitrate,
    hardwareAcceleration: 'prefer-hardware',
  }).then(
    (r) => !!r.supported,
    () => false
  );
  // Variable bitrate only when the adaptive target is in use and the browser accepts it: a still
  // clip then really spends less. Otherwise the encoder runs exactly as before.
  const vbr =
    !!smart &&
    (await VideoEncoder.isConfigSupported({
      codec: 'avc1.640028',
      width: comp.width,
      height: comp.height,
      bitrate,
      bitrateMode: 'variable',
      hardwareAcceleration: 'prefer-hardware',
    }).then(
      (r) => !!r.supported,
      () => false
    ));
  const rate = vbr ? { quality: new Quality({ bitrate, bitrateMode: 'variable' }) } : { bitrate };
  const video = new CanvasSource(canvas, {
    codec: 'avc',
    ...rate,
    keyFrameInterval: 1,
    hardwareAcceleration: hw ? 'prefer-hardware' : 'no-preference',
  });
  output.addVideoTrack(video, { frameRate: FPS });
  const codec = !comp.audio.length
    ? null
    : (await canEncodeAudio('aac'))
      ? 'aac'
      : (await canEncodeAudio('opus'))
        ? 'opus'
        : null;
  const audio = codec ? new AudioBufferSource({ codec, bitrate: 128_000 }) : null;
  if (audio) output.addAudioTrack(audio);
  await output.start();
  let audioMs = 0;
  const silent = new Set<string>();
  const audioUpTo = async (ms: number) => {
    while (audio && audioMs < Math.min(ms, endMs)) {
      const to = Math.min(audioMs + AUDIO_WINDOW_MS, endMs);
      await audio.add(await mixWindow(comp.audio, (u) => pool.input(u), audioMs, to, (u) => silent.add(u)));
      audioMs = to;
    }
  };
  for (let f = 0; f < total; f += 1) {
    if (req.isCancelled()) {
      await output.cancel();
      await writes.catch(() => {});
      throw new Error('CANCELLED');
    }
    const t = (f * 1000) / FPS;
    await audioUpTo(t + 1);
    await frameAt(t);
    await video.add(f / FPS, 1 / FPS);
    if (f % 10 === 0) req.onProgress(Math.round((f / total) * 100));
  }
  await audioUpTo(endMs);
  await output.finalize();
  await writes;
  const path = await sink.finish();
  req.onProgress(100);
  return {
    path,
    bytes,
    durationMs: endMs,
    frameCount: total,
    truncated: false,
    silent: [...silent],
    smart,
  };
}

/**
 * RNF-013: the adaptive bitrate for this export, or undefined on any failure, which keeps the
 * preset's bitrate. The export never fails because of the read.
 */
async function smartBitrate(
  req: ExportRequest,
  canvas: OffscreenCanvas,
  frameAt: (t: number) => Promise<void>,
  endMs: number
): Promise<ExportOutcome['smart']> {
  try {
    const t0 = performance.now();
    const complexity = complexityOf(await readComplexity(canvas, frameAt, endMs));
    return {
      bitrate: adaptiveBitrate(req.bitrate, complexity),
      presetBitrate: req.bitrate,
      complexity,
      analysisMs: performance.now() - t0,
    };
  } catch {
    return undefined;
  }
}

/**
 * Up to ANALYSIS_SAMPLES frames, evenly across the export, read through the same `frameAt` the
 * encoder uses (composition, transitions, speed included). Each one is compared with the frame a
 * tick before it, for motion. Shortcut: a sample is read by seeking, so cost grows with the
 * number of seeks, not the clip length; upgrade to sequential reads if a long clip is slow.
 */
async function readComplexity(
  canvas: OffscreenCanvas,
  frameAt: (t: number) => Promise<void>,
  endMs: number
): Promise<FrameStats[]> {
  const scale = Math.min(1, ANALYSIS_EDGE / Math.max(canvas.width, canvas.height));
  const w = Math.max(1, Math.round(canvas.width * scale));
  const h = Math.max(1, Math.round(canvas.height * scale));
  const small = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true })!;
  const lumaAt = async (t: number) => {
    await frameAt(t);
    small.drawImage(canvas, 0, 0, w, h);
    const px = small.getImageData(0, 0, w, h).data;
    const luma = new Uint8ClampedArray(w * h);
    for (let i = 0; i < luma.length; i++) {
      luma[i] = (px[i * 4] * 77 + px[i * 4 + 1] * 150 + px[i * 4 + 2] * 29) >> 8;
    }
    return luma;
  };
  const stats: FrameStats[] = [];
  for (let s = 0; s < ANALYSIS_SAMPLES; s++) {
    const t = (endMs * (s + 0.5)) / ANALYSIS_SAMPLES;
    const before = await lumaAt(Math.max(0, t - 1000 / FPS));
    stats.push(frameStats(await lumaAt(t), w, h, before));
  }
  return stats;
}

/** RF-030: frames looked at across the video to find its best moments. */
const THUMBNAIL_SAMPLES = 32;
const THUMBNAIL_FRAMES = 8;
const THUMBNAIL_FRAME_CS = 45;

async function thumbnailGif(
  req: ExportRequest,
  frameAt: (t: number) => Promise<void>,
  ctx: OffscreenCanvasRenderingContext2D
): Promise<ExportOutcome> {
  const { comp, sink } = req;
  const timeOf = (s: number) => ((s + 0.5) * comp.durationMs) / THUMBNAIL_SAMPLES;
  const pixelsAt = async (t: number) => {
    if (req.isCancelled()) throw new Error('CANCELLED');
    await frameAt(t);
    return ctx.getImageData(0, 0, comp.width, comp.height).data;
  };
  const features: FrameFeatures[] = [];
  for (let s = 0; s < THUMBNAIL_SAMPLES; s += 1) {
    features.push(frameFeatures(await pixelsAt(timeOf(s)), comp.width, comp.height));
    req.onProgress(Math.round(((s + 1) / THUMBNAIL_SAMPLES) * 80));
  }
  const picked = pickHighlights(features, THUMBNAIL_FRAMES);
  const palette = new GifPalette();
  for (const s of picked) palette.addSample(await pixelsAt(timeOf(s)));
  palette.build(req.gif!.maxColors);
  const writer = new GifWriter(comp.width, comp.height, palette);
  for (const s of picked) writer.addFrame(await pixelsAt(timeOf(s)), THUMBNAIL_FRAME_CS);
  const bytes = writer.finish();
  await sink.start(exportName('gif'));
  await sink.write(0, bytes);
  const path = await sink.finish();
  req.onProgress(100);
  return {
    path,
    bytes: bytes.length,
    durationMs: picked.length * THUMBNAIL_FRAME_CS * 10,
    frameCount: picked.length,
    truncated: false,
    silent: [],
  };
}

async function gif(
  req: ExportRequest,
  frameAt: (t: number) => Promise<void>,
  ctx: OffscreenCanvasRenderingContext2D
): Promise<ExportOutcome> {
  const { comp, sink } = req;
  const { fps, maxColors } = req.gif!;
  const endMs = Math.min(comp.durationMs, GIF_MAX_DURATION_MS);
  const total = Math.max(1, Math.floor((endMs / 1000) * fps));
  const pixelsAt = async (f: number) => {
    if (req.isCancelled()) throw new Error('CANCELLED');
    await frameAt((f * 1000) / fps);
    return ctx.getImageData(0, 0, comp.width, comp.height).data;
  };
  if (req.gif!.highlights) return thumbnailGif(req, frameAt, ctx);
  const palette = new GifPalette();
  const samples = Math.min(total, GIF_PALETTE_SAMPLES);
  for (let s = 0; s < samples; s += 1) {
    palette.addSample(await pixelsAt(Math.floor((s * total) / samples)));
    req.onProgress(Math.round(((s + 1) / samples) * 10));
  }
  palette.build(maxColors);
  const writer = new GifWriter(comp.width, comp.height, palette);
  for (let f = 0; f < total; f += 1) {
    writer.addFrame(await pixelsAt(f), gifDelayCs(f, fps));
    req.onProgress(10 + Math.round(((f + 1) / total) * 85));
  }
  const bytes = writer.finish();
  await sink.start(exportName('gif'));
  await sink.write(0, bytes);
  const path = await sink.finish();
  req.onProgress(100);
  return {
    path,
    bytes: bytes.length,
    durationMs: endMs,
    frameCount: total,
    truncated: comp.durationMs > GIF_MAX_DURATION_MS,
    silent: [],
  };
}

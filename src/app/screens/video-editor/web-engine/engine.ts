import {
  ALL_FORMATS,
  BlobSource,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  StreamSource,
  StreamTarget,
  VideoSampleSink,
  type StreamTargetChunk,
} from 'mediabunny';
import {
  drawListAt,
  type DrawOp,
  type WebScene,
} from '../../../../modules/video-editor/domain/webScene';
import { Feed } from './feed';

/**
 * SPIKE web engine (runs inside a WebView). One canvas, one decoder slot per (layer, source), and
 * ONE drawing path (`drawOps`) used by live playback, seeks and the frame-by-frame export; what to
 * draw always comes from `drawListAt`.
 */

export type FileMode = 'auto' | 'xhr' | 'bridge';

export interface Host {
  readChunk(uri: string, offset: number, length: number): Promise<string>;
  getFileSize(uri: string): Promise<number>;
  startExport(): Promise<void>;
  writeExportChunk(position: number, base64: string): Promise<void>;
  finishExport(): Promise<string>;
  onMetrics(json: string): Promise<void>;
  onStatus(text: string): Promise<void>;
}

const FPS = 30;
const EXPORT_MAX_MS = 20_000;
const PLAY_MAX_MS = 30_000;
const READ_SLICE = 2 * 1024 * 1024;

type VideoOp = Extract<DrawOp, { kind: 'video' }>;

function xhrBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('GET', uri);
    x.responseType = 'blob';
    x.onload = () =>
      (x.status === 0 || x.status === 200) && x.response
        ? resolve(x.response as Blob)
        : reject(new Error(`xhr status ${x.status}`));
    x.onerror = () => reject(new Error('xhr network error (file:// blocked?)'));
    x.send();
  });
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

/** Fixed-seed PRNG so every run seeks to the same instants. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const stats = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / Math.max(1, s.length);
  return {
    mean: +mean.toFixed(1),
    p90: +(s[Math.min(s.length - 1, Math.floor(s.length * 0.9))] ?? 0).toFixed(1),
    max: +(s[s.length - 1] ?? 0).toFixed(1),
  };
};

export class Engine {
  scene: WebScene;
  appState = 'active';
  fileMode: FileMode = 'auto';
  private ctx: CanvasRenderingContext2D;
  private inputs = new Map<string, Promise<{ input: Input; method: string; ms: number }>>();
  private feeds = new Map<string, Promise<Feed>>();
  private images = new Map<string, ImageBitmap>();
  private methods: Record<string, { method: string; ms: number }> = {};
  private t = 0;
  private playing = false;
  private raf = 0;
  private busy = false;

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly host: Host,
    private readonly hud: (text: string) => void,
    scene: WebScene
  ) {
    this.scene = scene;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  // ---- sources -------------------------------------------------------------------------------

  private openInput(uri: string) {
    let p = this.inputs.get(uri);
    if (!p) {
      p = this.openInputUncached(uri);
      this.inputs.set(uri, p);
    }
    return p;
  }

  private async openInputUncached(uri: string) {
    const t0 = performance.now();
    if (this.fileMode !== 'bridge') {
      try {
        const blob = await xhrBlob(uri);
        const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
        return this.note(uri, input, 'xhr-blob', t0);
      } catch (e) {
        if (this.fileMode === 'xhr') throw e;
        this.methods[`${uri}#xhr-error`] = { method: String((e as Error).message), ms: 0 };
      }
    }
    const size = await this.host.getFileSize(uri);
    const source = new StreamSource({
      getSize: () => size,
      prefetchProfile: 'fileSystem',
      read: async (start, end) => {
        const out = new Uint8Array(end - start);
        for (let at = start; at < end; at += READ_SLICE) {
          const len = Math.min(READ_SLICE, end - at);
          out.set(b64ToBytes(await this.host.readChunk(uri, at, len)), at - start);
        }
        return out;
      },
    });
    return this.note(uri, new Input({ source, formats: ALL_FORMATS }), 'chunk-bridge', t0);
  }

  private note(uri: string, input: Input, method: string, t0: number) {
    const ms = Math.round(performance.now() - t0);
    this.methods[uri] = { method, ms };
    return { input, method, ms };
  }

  private feedFor(layer: string, uri: string): Promise<Feed> {
    const key = `${layer}|${uri}`;
    let p = this.feeds.get(key);
    if (!p) {
      p = (async () => {
        const { input } = await this.openInput(uri);
        const track = await input.getPrimaryVideoTrack();
        if (!track) throw new Error(`no video track in ${uri}`);
        return new Feed(layer, new VideoSampleSink(track));
      })();
      this.feeds.set(key, p);
    }
    return p;
  }

  /** Opens every source and the sticker images before the first frame. */
  async prepare() {
    const first = drawListAt(this.scene, 0).filter((o): o is VideoOp => o.kind === 'video');
    const all = new Set<string>([
      ...first.map((o) => o.uri),
      ...this.scene.main.clips.map((c) => c.sourceUri).filter(Boolean),
      ...this.scene.pips.map((p) => p.uri),
    ]);
    for (const uri of all) await this.openInput(uri);
    for (const s of this.scene.stickers) {
      if (!this.images.has(s.dataUri)) {
        this.images.set(s.dataUri, await createImageBitmap(await (await fetch(s.dataUri)).blob()));
      }
    }
    await this.seekTo(0);
  }

  // ---- drawing (the only drawing code) ---------------------------------------------------------

  private async feedsOf(ops: DrawOp[]) {
    const map = new Map<DrawOp, Feed>();
    for (const op of ops)
      if (op.kind === 'video') map.set(op, await this.feedFor(op.layer, op.uri));
    return map;
  }

  private drawOps(
    ops: DrawOp[],
    sampleOf: (op: VideoOp) => import('mediabunny').VideoSample | null
  ) {
    const ctx = this.ctx;
    for (const op of ops) {
      ctx.save();
      if (op.kind === 'clear') {
        ctx.fillStyle = op.color;
        ctx.fillRect(0, 0, this.scene.width, this.scene.height);
      } else if (op.kind === 'video') {
        const s = sampleOf(op);
        if (s) {
          const quarter = Math.abs(op.rotationDeg) % 180 === 90;
          const iw = quarter ? s.displayHeight : s.displayWidth;
          const ih = quarter ? s.displayWidth : s.displayHeight;
          const k = Math.min(op.rect.w / iw, op.rect.h / ih);
          const [w, h] = quarter ? [ih * k, iw * k] : [iw * k, ih * k];
          ctx.globalAlpha = op.opacity;
          ctx.translate(op.rect.x + op.rect.w / 2 + op.translateX, op.rect.y + op.rect.h / 2);
          ctx.scale(op.scale, op.scale);
          ctx.rotate((op.rotationDeg * Math.PI) / 180);
          s.draw(ctx, -w / 2, -h / 2, w, h);
        }
      } else if (op.kind === 'text') {
        ctx.globalAlpha = op.opacity;
        ctx.font = `bold ${op.fontPx}px sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillStyle = op.color;
        const w = ctx.measureText(op.text).width;
        ctx.translate(op.x + w / 2, op.y);
        ctx.scale(op.scale, op.scale);
        ctx.fillText(op.text, -w / 2, 0);
      } else {
        const img = this.images.get(op.dataUri);
        if (img) {
          ctx.globalAlpha = op.opacity;
          ctx.translate(op.x, op.y);
          ctx.rotate((op.rotationDeg * Math.PI) / 180);
          ctx.drawImage(img, -op.sizePx / 2, -op.sizePx / 2, op.sizePx, op.sizePx);
        }
      }
      ctx.restore();
    }
  }

  // ---- playback ----------------------------------------------------------------------------------

  private async renderLive(t: number, feedMap: Map<DrawOp, Feed>, ops: DrawOp[]) {
    this.drawOps(ops, (op) => {
      const feed = feedMap.get(op)!;
      const sec = op.sourceTimeMs / 1000;
      const s = feed.tick(sec);
      if (s) feed.markDrawn(s, sec);
      return s;
    });
    this.t = t;
  }

  async play() {
    if (this.playing || this.busy) return;
    this.playing = true;
    const startT = this.t >= this.scene.durationMs ? 0 : this.t;
    const endT = Math.min(this.scene.durationMs, startT + PLAY_MAX_MS);
    // Warm the decoders for the first instant so the run does not start with a stall.
    await this.seekTo(startT, false);
    for (const f of this.feeds.values()) (await f).resetCounters();
    const wall0 = performance.now();
    let frames = 0;
    let winStart = wall0;
    let winFrames = 0;
    const windows: number[] = [];
    let longest = 0;
    let prev = wall0;
    const loop = async (now: number) => {
      if (!this.playing) return;
      const t = Math.min(endT, startT + (now - wall0));
      const ops = drawListAt(this.scene, t);
      const feedMap = await this.feedsOf(ops);
      await this.renderLive(t, feedMap, ops);
      frames += 1;
      winFrames += 1;
      longest = Math.max(longest, now - prev);
      prev = now;
      if (now - winStart >= 1000) {
        windows.push((winFrames * 1000) / (now - winStart));
        this.hud(`${windows[windows.length - 1].toFixed(0)} fps  t=${(t / 1000).toFixed(1)}s`);
        winStart = now;
        winFrames = 0;
      }
      if (t >= endT) {
        await this.stopAndReport(wall0, frames, windows, longest);
        return;
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    this.stopper = () => this.stopAndReport(wall0, frames, windows, longest);
  }

  private stopper: (() => Promise<void>) | null = null;

  async pause() {
    if (this.playing) await this.stopper?.();
  }

  private async stopAndReport(wall0: number, frames: number, windows: number[], longest: number) {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    const secs = (performance.now() - wall0) / 1000;
    const layers: Record<string, unknown> = {};
    for (const p of this.feeds.values()) {
      const f = await p;
      const l = (layers[f.layer] ??= { shown: 0, late: 0, dropped: 0, restarts: 0 }) as Record<
        string,
        number
      >;
      l.shown += f.shown;
      l.late += f.late;
      l.dropped += f.dropped;
      l.restarts += f.restarts;
    }
    for (const l of Object.values(layers) as Record<string, number>[]) {
      l.shownPerSec = +(l.shown / secs).toFixed(1);
    }
    await this.host.onMetrics(
      JSON.stringify({
        section: 'playback',
        data: {
          seconds: +secs.toFixed(2),
          screenFpsAvg: +(frames / secs).toFixed(1),
          screenFpsMinWindow: +Math.min(...(windows.length ? windows : [0])).toFixed(1),
          longestFrameGapMs: +longest.toFixed(1),
          layers,
        },
      })
    );
  }

  // ---- seeking -----------------------------------------------------------------------------------

  /** Decodes and draws exactly the frame(s) of scene time `ms`; resolves when drawn. */
  async seekTo(ms: number, stop = true) {
    if (stop) await this.pause();
    const t = Math.max(0, Math.min(this.scene.durationMs, ms));
    const ops = drawListAt(this.scene, t);
    const feedMap = await this.feedsOf(ops);
    const got = new Map<DrawOp, import('mediabunny').VideoSample | null>();
    await Promise.all(
      [...feedMap].map(async ([op, feed]) => {
        got.set(op, await feed.at((op as VideoOp).sourceTimeMs / 1000));
      })
    );
    this.drawOps(ops, (op) => got.get(op) ?? null);
    this.t = t;
  }

  async seekBench(n = 20) {
    await this.pause();
    this.busy = true;
    const rnd = mulberry32(1234);
    const lat: number[] = [];
    for (let i = 0; i < n; i += 1) {
      const target = Math.floor(rnd() * this.scene.durationMs);
      const t0 = performance.now();
      await this.seekTo(target, false);
      lat.push(performance.now() - t0);
    }
    this.busy = false;
    await this.host.onMetrics(
      JSON.stringify({
        section: 'seek',
        data: { n, latencyMs: stats(lat), all: lat.map((x) => +x.toFixed(0)) },
      })
    );
  }

  // ---- export (same drawOps, not real time) ------------------------------------------------------

  async exportMp4() {
    await this.pause();
    this.busy = true;
    const endMs = Math.min(this.scene.durationMs, EXPORT_MAX_MS);
    const total = Math.floor((endMs / 1000) * FPS);
    const t0 = performance.now();
    await this.host.startExport();
    let bytes = 0;
    const writable = new WritableStream<StreamTargetChunk>({
      write: async (chunk) => {
        bytes = Math.max(bytes, chunk.position + chunk.data.byteLength);
        await this.host.writeExportChunk(chunk.position, bytesToB64(chunk.data));
      },
    });
    const output = new Output({
      format: new Mp4OutputFormat(),
      target: new StreamTarget(writable, { chunked: true, chunkSize: 4 * 1024 * 1024 }),
    });
    const source = new CanvasSource(this.canvas, {
      codec: 'avc',
      bitrate: 10_000_000,
      keyFrameInterval: 1,
      hardwareAcceleration: 'prefer-hardware',
    });
    output.addVideoTrack(source, { frameRate: FPS });
    await output.start();
    let bgFrames = 0;
    let longestPause = 0;
    let last = performance.now();
    for (let f = 0; f < total; f += 1) {
      const t = (f * 1000) / FPS;
      const ops = drawListAt(this.scene, t);
      const feedMap = await this.feedsOf(ops);
      const got = new Map<DrawOp, import('mediabunny').VideoSample | null>();
      await Promise.all(
        [...feedMap].map(async ([op, feed]) => {
          got.set(op, await feed.at((op as VideoOp).sourceTimeMs / 1000));
        })
      );
      this.drawOps(ops, (op) => got.get(op) ?? null);
      await source.add(f / FPS, 1 / FPS);
      const now = performance.now();
      longestPause = Math.max(longestPause, now - last);
      last = now;
      if (this.appState !== 'active') bgFrames += 1;
      if (f % 15 === 0) this.hud(`export ${f}/${total}`);
    }
    await output.finalize();
    const path = await this.host.finishExport();
    const ms = performance.now() - t0;
    this.busy = false;
    await this.host.onMetrics(
      JSON.stringify({
        section: 'export',
        data: {
          totalMs: Math.round(ms),
          xRealtime: +(endMs / ms).toFixed(2),
          videoSeconds: endMs / 1000,
          frames: total,
          bytes,
          framesWhileBackground: bgFrames,
          longestPauseMs: Math.round(longestPause),
          path,
          audio: 'not exported (out of scope)',
        },
      })
    );
    await this.seekTo(0, false);
  }

  fileAccessReport() {
    return this.methods;
  }

  dispose() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    for (const p of this.feeds.values()) void p.then((f) => f.dispose()).catch(() => {});
    for (const p of this.inputs.values()) void p.then((i) => i.input.dispose()).catch(() => {});
  }
}

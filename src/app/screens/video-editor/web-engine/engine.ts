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
import { BlockReader } from './blockReader';
import { createDropMonitor } from '../previewTier';

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
  /** Editor only: playhead time, about 10 times a second while playing. */
  onTime?(ms: number): Promise<void>;
  /** Editor only: JSON {type: 'env' | 'ready' | 'ended' | 'drops' | 'warn' | ...}. */
  onEvent?(json: string): Promise<void>;
}

const FPS = 30;
const EXPORT_MAX_MS = 20_000;
const PLAY_MAX_MS = 30_000;
const TIME_REPORT_MS = 100;
/** Streaming reads move 1 MiB blocks across the bridge (base64), with a small read-ahead cache. */
const STREAM_BLOCK = 1024 * 1024;

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
  private methods: Record<string, { method: string; ms: number; bytes?: number }> = {};
  private t = 0;
  private playing = false;
  private raf = 0;
  private busy = false;
  /** Sources larger than this are streamed through the bridge instead of read whole (auto mode). */
  streamAboveBytes = Infinity;
  /** Video layers that decode live while playing; the rest hold their last decoded frame. */
  maxLive = 8;
  /** Playback wraps inside this range (scene ms) instead of ending. */
  loop: { startMs: number; endMs: number } | null = null;
  private origin = { wall0: 0, startT: 0 };
  private drops = createDropMonitor();
  private seekWanted: number | null = null;
  private draining: Promise<void> | null = null;

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
    const size = this.fileMode === 'xhr' ? 0 : await this.host.getFileSize(uri).catch(() => 0);
    const stream =
      this.fileMode === 'bridge' || (this.fileMode === 'auto' && size > this.streamAboveBytes);
    if (!stream) {
      try {
        const blob = await xhrBlob(uri);
        const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
        return this.note(uri, input, 'xhr-blob', t0, blob.size);
      } catch (e) {
        if (this.fileMode === 'xhr') throw e;
        this.methods[`${uri}#xhr-error`] = { method: String((e as Error).message), ms: 0 };
      }
    }
    const reader = new BlockReader({
      size,
      blockSize: STREAM_BLOCK,
      fetchBlock: async (offset, length) =>
        b64ToBytes(await this.host.readChunk(uri, offset, length)),
    });
    const source = new StreamSource({
      getSize: () => size,
      prefetchProfile: 'fileSystem',
      read: (start, end) => reader.read(start, end),
    });
    return this.note(uri, new Input({ source, formats: ALL_FORMATS }), 'chunk-bridge', t0, size);
  }

  private note(uri: string, input: Input, method: string, t0: number, bytes = 0) {
    const ms = Math.round(performance.now() - t0);
    this.methods[uri] = { method, ms, bytes };
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
  async prepare(eager = true) {
    const all = this.sourceUris();
    if (eager) for (const uri of all) await this.openInput(uri);
    for (const s of this.scene.stickers) {
      if (!this.images.has(s.dataUri)) {
        this.images.set(s.dataUri, await createImageBitmap(await (await fetch(s.dataUri)).blob()));
      }
    }
    await this.seekTo(this.t);
    // The editor opens the rest in the background so a later clip does not stall playback.
    if (!eager) for (const uri of all) void this.openInput(uri).catch(() => {});
  }

  private sourceUris(): Set<string> {
    const first = drawListAt(this.scene, this.t).filter((o): o is VideoOp => o.kind === 'video');
    return new Set<string>([
      ...first.map((o) => o.uri),
      ...this.scene.main.clips.map((c) => c.sourceUri).filter(Boolean),
      ...this.scene.pips.map((p) => p.uri),
    ]);
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
    let live = 0;
    const now = performance.now();
    let hit = false;
    this.drawOps(ops, (op) => {
      const feed = feedMap.get(op)!;
      // Layers beyond the cap keep their last decoded frame (no decoding while playing).
      if (live++ >= this.maxLive) return feed.cur;
      const sec = op.sourceTimeMs / 1000;
      const droppedBefore = feed.dropped;
      const s = feed.tick(sec);
      if (s) feed.markDrawn(s, sec);
      const bad = (!s || sec - s.timestamp > 0.1 ? 1 : 0) + (feed.dropped - droppedBefore);
      hit = this.drops.sample(now, bad > 0 ? 1 : 0) || hit;
      return s;
    });
    this.t = t;
    if (hit) void this.host.onEvent?.(JSON.stringify({ type: 'drops' }));
  }

  // ---- editor playback (the engine owns the clock) -------------------------------------------

  /** Plays from the playhead until the end (or around `loop`), reporting time to the host. */
  async playLive() {
    if (this.playing || this.busy) return;
    this.playing = true;
    await this.draining; // a pending scrub lands first, so we start where the user left it
    const startT = this.t >= this.scene.durationMs ? 0 : this.t;
    let lastReport = 0;
    const finish = async (ended: boolean) => {
      this.playing = false;
      cancelAnimationFrame(this.raf);
      this.stopper = null;
      await this.host.onTime?.(Math.round(this.t));
      if (ended) await this.host.onEvent?.(JSON.stringify({ type: 'ended' }));
    };
    this.stopper = () => finish(false);
    // Warm the decoders for the first instant so the run does not start with a stall.
    await this.seekTo(startT, false);
    if (!this.playing) return;
    this.origin = { wall0: performance.now(), startT };
    this.drops.reset();
    const loop = async (now: number) => {
      if (!this.playing) return;
      let t = this.origin.startT + (now - this.origin.wall0);
      const end = this.loop
        ? Math.min(this.loop.endMs, this.scene.durationMs)
        : this.scene.durationMs;
      if (t >= end) {
        if (!this.loop) {
          this.t = end;
          await finish(true);
          return;
        }
        t = this.loop.startMs;
        this.origin = { wall0: now, startT: t };
      }
      const ops = drawListAt(this.scene, t);
      const feedMap = await this.feedsOf(ops);
      if (!this.playing) return;
      await this.renderLive(t, feedMap, ops);
      if (now - lastReport >= TIME_REPORT_MS) {
        lastReport = now;
        void this.host.onTime?.(Math.round(t));
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Moves the playhead: keeps playing from there, or draws that frame (latest request wins). */
  seek(ms: number) {
    const t = Math.max(0, Math.min(this.scene.durationMs, ms));
    if (this.playing) {
      this.origin = { wall0: performance.now(), startT: t };
      return Promise.resolve();
    }
    this.seekWanted = t;
    this.draining ??= this.drain();
    return this.draining;
  }

  /** Coalesced seeks: while one decodes, newer requests replace each other; only the last runs. */
  private async drain() {
    try {
      while (this.seekWanted !== null) {
        const ms = this.seekWanted;
        this.seekWanted = null;
        this.prune();
        try {
          await this.seekTo(ms, false);
        } catch (e) {
          void this.host.onEvent?.(JSON.stringify({ type: 'warn', message: String(e) }));
        }
      }
    } finally {
      this.draining = null;
    }
  }

  /** New timeline: redraw the current frame without losing the playhead. */
  setScene(scene: WebScene) {
    this.scene = scene;
    this.drops.reset();
    this.t = Math.min(this.t, scene.durationMs);
    if (this.playing) {
      void Promise.all([...this.sourceUris()].map((u) => this.openInput(u).catch(() => {})));
      return Promise.resolve();
    }
    return this.seek(this.t);
  }

  /** Releases decoders and files of sources the scene no longer uses (only while idle). */
  private prune() {
    if (this.playing) return;
    const keep = this.sourceUris();
    for (const [key, p] of this.feeds) {
      if (keep.has(key.slice(key.indexOf('|') + 1))) continue;
      this.feeds.delete(key);
      void p.then((f) => f.dispose()).catch(() => {});
    }
    for (const [uri, p] of this.inputs) {
      if (keep.has(uri)) continue;
      this.inputs.delete(uri);
      void p.then((i) => i.input.dispose()).catch(() => {});
    }
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
        got.set(op, await feed.seek((op as VideoOp).sourceTimeMs / 1000));
      })
    );
    this.drawOps(ops, (op) => got.get(op) ?? null);
    this.t = t;
  }

  async seekBench(n = 20) {
    await this.pause();
    if (this.busy) return;
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
    if (this.busy) return;
    this.busy = true;
    const endMs = Math.min(this.scene.durationMs, EXPORT_MAX_MS);
    const total = Math.floor((endMs / 1000) * FPS);
    const t0 = performance.now();
    await this.host.startExport();
    let bytes = 0;
    let writeMs = 0;
    // Chunks cross the bridge in the background: awaiting each write stalled the encode loop.
    let writes = Promise.resolve();
    const writable = new WritableStream<StreamTargetChunk>({
      write: (chunk) => {
        bytes = Math.max(bytes, chunk.position + chunk.data.byteLength);
        const b64 = bytesToB64(chunk.data);
        writes = writes.then(async () => {
          const w0 = performance.now();
          await this.host.writeExportChunk(chunk.position, b64);
          writeMs += performance.now() - w0;
        });
      },
    });
    const output = new Output({
      format: new Mp4OutputFormat(),
      target: new StreamTarget(writable, { chunked: true, chunkSize: 4 * 1024 * 1024 }),
    });
    // The emulator has no hardware encoder: fall back to software and say so in the metrics.
    const hw = await VideoEncoder.isConfigSupported({
      codec: 'avc1.640028',
      width: 1920,
      height: 1080,
      bitrate: 10_000_000,
      hardwareAcceleration: 'prefer-hardware',
    }).then(
      (r) => !!r.supported,
      () => false
    );
    const source = new CanvasSource(this.canvas, {
      codec: 'avc',
      bitrate: 10_000_000,
      keyFrameInterval: 1,
      hardwareAcceleration: hw ? 'prefer-hardware' : 'no-preference',
    });
    output.addVideoTrack(source, { frameRate: FPS });
    await output.start();
    let bgFrames = 0;
    let longestPause = 0;
    let last = performance.now();
    let decodeMs = 0;
    let drawMs = 0;
    let encodeMs = 0;
    for (let f = 0; f < total; f += 1) {
      const t = (f * 1000) / FPS;
      const ops = drawListAt(this.scene, t);
      const feedMap = await this.feedsOf(ops);
      const got = new Map<DrawOp, import('mediabunny').VideoSample | null>();
      const d0 = performance.now();
      await Promise.all(
        [...feedMap].map(async ([op, feed]) => {
          got.set(op, await feed.at((op as VideoOp).sourceTimeMs / 1000));
        })
      );
      const d1 = performance.now();
      this.drawOps(ops, (op) => got.get(op) ?? null);
      const d2 = performance.now();
      await source.add(f / FPS, 1 / FPS);
      const now = performance.now();
      decodeMs += d1 - d0;
      drawMs += d2 - d1;
      encodeMs += now - d2;
      longestPause = Math.max(longestPause, now - last);
      last = now;
      if (this.appState !== 'active') bgFrames += 1;
      if (f % 15 === 0) this.hud(`export ${f}/${total}`);
    }
    await output.finalize();
    await writes;
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
          // Where the time went: decode (3 layers), canvas draw, encoder add, bridge writes (overlapped).
          splitMs: {
            decode: Math.round(decodeMs),
            draw: Math.round(drawMs),
            encode: Math.round(encodeMs),
            write: Math.round(writeMs),
          },
          path,
          hardwareEncoder: hw,
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

import {
  ALL_FORMATS,
  AudioBufferSource,
  BlobSource,
  canEncodeAudio,
  CanvasSource,
  EncodedPacketSink,
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
import { AudioMixer, mixWindow } from './audio';
import { encode as encodeGif } from 'modern-gif';
import { GIF_MAX_DURATION_MS } from '../../../../modules/video-editor/domain/gifPlan';

/**
 * SPIKE web engine (runs inside a WebView). One canvas, one decoder slot per (layer, source), and
 * ONE drawing path (`drawOps`) used by live playback, seeks and the frame-by-frame export; what to
 * draw always comes from `drawListAt`.
 */

export type FileMode = 'auto' | 'xhr' | 'bridge';

export interface Host {
  readChunk(uri: string, offset: number, length: number): Promise<string>;
  getFileSize(uri: string): Promise<number>;
  /** `ext`: 'mp4' (default) or 'gif'. */
  startExport(ext?: string): Promise<void>;
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
/** Export mixes sound in windows of this length (bounded memory, interleaved with the frames). */
const AUDIO_WINDOW_MS = 10_000;
/** Decoded timeline pictures kept at once (see loadBitmap). */
const MAX_BITMAPS = 12;
/** While playing, pictures this far ahead start decoding so a photo is ready when it shows. */
const PICTURE_LEAD_MS = 600;
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

export interface ExportJob {
  scene: WebScene;
  bitrate: number;
  /** Set for an animated GIF instead of an mp4 (the scene is already at the GIF's size). */
  gif?: { fps: number; maxColors: number };
  onProgress(pct: number): void;
  isCancelled(): boolean;
}

export interface ExportResult {
  path: string;
  bytes: number;
  durationMs: number;
  /** GIF only. */
  frameCount?: number;
  truncated?: boolean;
}

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
  private audio = new AudioMixer((uri) => this.openInput(uri).then((i) => i.input));
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
    // Through the coalescer: a scene swap during prepare must not dispose what this seek reads.
    await this.seek(this.t);
    // The editor opens the rest in the background so a later clip does not stall playback.
    if (!eager) for (const uri of all) void this.openInput(uri).catch(() => {});
    if (!eager) void this.probeSources(all);
  }

  private probed = new Set<string>();

  /** Reports what each source really is (size, first keyframes) so a proxy can be checked on device. */
  private async probeSources(uris: Iterable<string>) {
    for (const uri of uris) {
      if (this.probed.has(uri)) continue;
      this.probed.add(uri);
      try {
        const { input, method, ms } = await this.openInput(uri);
        const track = await input.getPrimaryVideoTrack();
        if (!track) continue;
        const sink = new EncodedPacketSink(track);
        const keys: number[] = [];
        let p = await sink.getFirstPacket();
        while (p && keys.length < 6) {
          keys.push(+p.timestamp.toFixed(2));
          p = await sink.getNextKeyPacket(p);
        }
        await this.host.onEvent?.(
          JSON.stringify({
            type: 'probe',
            uri,
            width: await track.getCodedWidth(),
            height: await track.getCodedHeight(),
            keyframes: keys,
            method,
            openMs: ms,
          })
        );
      } catch {
        /* a probe is only a diagnostic */
      }
    }
  }

  private sourceUris(): Set<string> {
    const first = drawListAt(this.scene, this.t).filter((o): o is VideoOp => o.kind === 'video');
    return new Set<string>([
      ...first.map((o) => o.uri),
      // Pictures are decoded on demand (loadBitmap), never opened as media.
      ...this.scene.main.clips
        .filter((c) => c.kind !== 'image')
        .map((c) => c.sourceUri)
        .filter(Boolean),
      ...this.scene.pips.map((p) => p.uri),
    ]);
  }

  // ---- drawing (the only drawing code) ---------------------------------------------------------

  /** `prefix` gives the export its own decoders, so it does not disturb the preview's. */
  private async feedsOf(ops: DrawOp[], prefix = '') {
    const map = new Map<DrawOp, Feed>();
    for (const op of ops)
      if (op.kind === 'video') map.set(op, await this.feedFor(prefix + op.layer, op.uri));
    return map;
  }

  private drawOps(
    ops: DrawOp[],
    sampleOf: (op: VideoOp) => import('mediabunny').VideoSample | null,
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D = this.ctx,
    size: Pick<WebScene, 'width' | 'height' | 'fit'> = this.scene
  ) {
    for (const op of ops) {
      ctx.save();
      if (op.kind === 'clear') {
        ctx.fillStyle = op.color;
        ctx.fillRect(0, 0, size.width, size.height);
      } else if (op.kind === 'video' || op.kind === 'image') {
        const s = op.kind === 'video' ? sampleOf(op) : null;
        const bm = op.kind === 'image' ? this.bitmapFor(op.uri, size.width) : null;
        const sw = s ? s.displayWidth : bm?.width;
        const sh = s ? s.displayHeight : bm?.height;
        if (sw && sh) {
          const quarter = Math.abs(op.rotationDeg) % 180 === 90;
          const iw = quarter ? sh : sw;
          const ih = quarter ? sw : sh;
          // The main sequence fills the frame when asked (export presets crop like the native
          // exporter); other layers always fit inside their box.
          const fill = size.fit === 'cover' && (op.layer === 'main' || op.layer === 'out');
          const k = (fill ? Math.max : Math.min)(op.rect.w / iw, op.rect.h / ih);
          const [w, h] = quarter ? [ih * k, iw * k] : [iw * k, ih * k];
          ctx.globalAlpha = op.opacity;
          ctx.translate(op.rect.x + op.rect.w / 2 + op.translateX, op.rect.y + op.rect.h / 2);
          ctx.scale(op.scale, op.scale);
          ctx.rotate((op.rotationDeg * Math.PI) / 180);
          if (s) s.draw(ctx, -w / 2, -h / 2, w, h);
          else if (bm) ctx.drawImage(bm, -w / 2, -h / 2, w, h);
        }
      } else if (op.kind === 'caption') {
        ctx.globalAlpha = op.opacity;
        ctx.font = `bold ${op.fontPx}px ${op.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.translate(op.cx, op.cy);
        ctx.scale(op.scale, op.scale);
        const lines = op.text.split('\n');
        const lineH = op.fontPx * 1.2;
        lines.forEach((line, i) => {
          const y = (i - (lines.length - 1) / 2) * lineH;
          if (op.shadow) {
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = op.fontPx * 0.12;
            ctx.shadowOffsetY = op.fontPx * 0.04;
          }
          if (op.strokePx > 0) {
            ctx.lineWidth = op.strokePx * 2; // half of a centred stroke is hidden under the fill
            ctx.strokeStyle = op.strokeColor;
            ctx.strokeText(line, 0, y);
            ctx.shadowColor = 'transparent'; // one shadow, cast by the outline
          }
          ctx.fillStyle = op.color;
          ctx.fillText(line, 0, y);
          ctx.shadowColor = 'transparent';
        });
      } else if (op.kind === 'tint') {
        ctx.globalAlpha = op.opacity;
        ctx.fillStyle = op.color;
        ctx.fillRect(0, 0, size.width, size.height);
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

  // ---- pictures on the timeline ---------------------------------------------------------------

  /**
   * Decoded pictures, most recently used last. Each is decoded at the canvas width (a 48 MP photo
   * never sits whole in memory) and only the last MAX_BITMAPS stay: a stop-motion has dozens.
   */
  private bitmaps = new Map<string, Promise<ImageBitmap | null>>();
  private bitmapReady = new Map<string, ImageBitmap>();

  private loadBitmap(uri: string, width: number): Promise<ImageBitmap | null> {
    const key = `${width}|${uri}`;
    let p = this.bitmaps.get(key);
    if (p) {
      this.bitmaps.delete(key);
      this.bitmaps.set(key, p);
      return p;
    }
    p = xhrBlob(uri)
      .then((blob) => createImageBitmap(blob, { resizeWidth: width, resizeQuality: 'high' }))
      .then(
        (bm) => {
          if (this.bitmaps.has(key)) this.bitmapReady.set(key, bm);
          else bm.close(); // evicted while decoding
          return bm;
        },
        () => null
      );
    this.bitmaps.set(key, p);
    while (this.bitmaps.size > MAX_BITMAPS) {
      const oldest = this.bitmaps.keys().next().value as string;
      this.bitmaps.delete(oldest);
      this.bitmapReady.get(oldest)?.close();
      this.bitmapReady.delete(oldest);
    }
    return p;
  }

  /** The picture if decoded; otherwise starts decoding it and the frame shows black for now. */
  private bitmapFor(uri: string, width: number): ImageBitmap | null {
    const bm = this.bitmapReady.get(`${width}|${uri}`);
    if (!bm) void this.loadBitmap(uri, width);
    return bm ?? null;
  }

  /** Waits for the pictures `ops` draw (seek, export: the frame must be complete). */
  private async picturesOf(ops: DrawOp[], width: number) {
    await Promise.all(
      ops.filter((o) => o.kind === 'image').map((o) => this.loadBitmap(o.uri, width))
    );
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
      this.audio.stop();
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
    this.startAudio(startT);
    this.drops.reset();
    const loop = async (now: number) => {
      if (!this.playing) return;
      // The audio clock leads when it runs (picture follows sound); the wall clock otherwise.
      let t = this.audio.timeMs() ?? this.origin.startT + (now - this.origin.wall0);
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
        this.startAudio(t);
      }
      const ops = drawListAt(this.scene, t);
      for (const o of drawListAt(this.scene, t + PICTURE_LEAD_MS)) {
        if (o.kind === 'image') void this.loadBitmap(o.uri, this.scene.width);
      }
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
      this.startAudio(t);
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
    void this.probeSources(this.sourceUris());
    if (this.playing) {
      void Promise.all([...this.sourceUris()].map((u) => this.openInput(u).catch(() => {})));
      this.origin = { wall0: performance.now(), startT: this.t };
      this.startAudio(this.t);
      return Promise.resolve();
    }
    return this.seek(this.t);
  }

  /** (Re)starts the sound from `t`: play, seek while playing, loop wrap, new timeline. */
  private startAudio(t: number) {
    const end = this.loop
      ? Math.min(this.loop.endMs, this.scene.durationMs)
      : this.scene.durationMs;
    void this.audio.start(this.scene.audio, t, end);
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
    await Promise.all([
      ...[...feedMap].map(async ([op, feed]) => {
        got.set(op, await feed.seek((op as VideoOp).sourceTimeMs / 1000));
      }),
      this.picturesOf(ops, this.scene.width),
    ]);
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

  /**
   * Encodes a scene to an mp4 that the host writes. With `job` (the editor's export): that scene
   * (originals at the preset size) on its own canvas and decoders, whole length, progress and
   * cancel. Without (the bench): the preview's scene and canvas, first 20 s.
   */
  async exportMp4(job?: ExportJob): Promise<ExportResult | null> {
    await this.pause();
    if (this.busy) return null;
    this.busy = true;
    const prefix = job ? 'x:' : '';
    try {
      return await (job?.gif ? this.encodeGif(job, prefix) : this.encode(job, prefix));
    } finally {
      this.busy = false;
      if (job) {
        for (const [key, p] of this.feeds) {
          if (!key.startsWith(prefix)) continue;
          this.feeds.delete(key);
          void p.then((f) => f.dispose()).catch(() => {});
        }
        this.prune(); // closes the originals the preview does not read
      }
    }
  }

  /**
   * Animated GIF: the same drawOps per frame (text, tint, pictures, transitions included), then
   * quantised and LZW-encoded in the page by modern-gif. Capped at GIF_MAX_DURATION_MS.
   */
  private async encodeGif(job: ExportJob, prefix: string): Promise<ExportResult> {
    const { scene } = job;
    const { fps, maxColors } = job.gif!;
    const endMs = Math.min(scene.durationMs, GIF_MAX_DURATION_MS);
    const total = Math.max(1, Math.floor((endMs / 1000) * fps));
    const canvas = new OffscreenCanvas(scene.width, scene.height);
    const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true })!;
    const frames: { data: Uint8ClampedArray<ArrayBuffer>; delay: number }[] = [];
    for (let f = 0; f < total; f += 1) {
      if (job.isCancelled()) throw new Error('CANCELLED');
      const t = (f * 1000) / fps;
      const ops = drawListAt(scene, t);
      await this.picturesOf(ops, scene.width);
      const feedMap = await this.feedsOf(ops, prefix);
      const got = new Map<DrawOp, import('mediabunny').VideoSample | null>();
      await Promise.all(
        [...feedMap].map(async ([op, feed]) => {
          got.set(op, await feed.at((op as VideoOp).sourceTimeMs / 1000));
        })
      );
      this.drawOps(ops, (op) => got.get(op) ?? null, ctx, scene);
      const { data } = ctx.getImageData(0, 0, scene.width, scene.height);
      frames.push({ data: new Uint8ClampedArray(data), delay: 1000 / fps });
      job.onProgress(Math.round(((f + 1) / total) * 90));
    }
    const bytes = new Uint8Array(
      await encodeGif({ width: scene.width, height: scene.height, frames, maxColors })
    );
    job.onProgress(97);
    await this.host.startExport('gif');
    const CHUNK = 4 * 1024 * 1024;
    for (let at = 0; at < bytes.length; at += CHUNK) {
      await this.host.writeExportChunk(at, bytesToB64(bytes.subarray(at, at + CHUNK)));
    }
    const path = await this.host.finishExport();
    return {
      path,
      bytes: bytes.length,
      durationMs: endMs,
      frameCount: total,
      truncated: scene.durationMs > GIF_MAX_DURATION_MS,
    };
  }

  private async encode(job: ExportJob | undefined, prefix: string): Promise<ExportResult> {
    const scene = job?.scene ?? this.scene;
    const endMs = job ? scene.durationMs : Math.min(scene.durationMs, EXPORT_MAX_MS);
    const total = Math.floor((endMs / 1000) * FPS);
    const canvas = job ? new OffscreenCanvas(scene.width, scene.height) : this.canvas;
    const ctx = job ? canvas.getContext('2d', { alpha: false })! : this.ctx;
    const bitrate = job?.bitrate ?? 10_000_000;
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
      width: scene.width,
      height: scene.height,
      bitrate,
      hardwareAcceleration: 'prefer-hardware',
    }).then(
      (r) => !!r.supported,
      () => false
    );
    const source = new CanvasSource(canvas, {
      codec: 'avc',
      bitrate,
      keyFrameInterval: 1,
      hardwareAcceleration: hw ? 'prefer-hardware' : 'no-preference',
    });
    output.addVideoTrack(source, { frameRate: FPS });
    // AAC where the WebView can encode it, Opus (also valid in MP4) otherwise; no track if silent.
    const audioCodec = !scene.audio.length
      ? null
      : (await canEncodeAudio('aac'))
        ? 'aac'
        : (await canEncodeAudio('opus'))
          ? 'opus'
          : null;
    const audioSource = audioCodec
      ? new AudioBufferSource({ codec: audioCodec, bitrate: 128_000 })
      : null;
    if (audioSource) output.addAudioTrack(audioSource);
    await output.start();
    // Sound goes in AUDIO_WINDOW_MS windows just ahead of the frames, so the muxer interleaves
    // both tracks instead of holding the whole video while it waits for audio.
    let audioMs = 0;
    let audioMixMs = 0;
    const addAudioUpTo = async (ms: number) => {
      while (audioSource && audioMs < Math.min(ms, endMs)) {
        const to = Math.min(audioMs + AUDIO_WINDOW_MS, endMs);
        const a0 = performance.now();
        await audioSource.add(
          await mixWindow(scene.audio, (u) => this.openInput(u).then((i) => i.input), audioMs, to)
        );
        audioMixMs += performance.now() - a0;
        audioMs = to;
      }
    };
    let bgFrames = 0;
    let longestPause = 0;
    let last = performance.now();
    let decodeMs = 0;
    let drawMs = 0;
    let encodeMs = 0;
    for (let f = 0; f < total; f += 1) {
      if (job?.isCancelled()) {
        await output.cancel();
        await writes.catch(() => {});
        throw new Error('CANCELLED');
      }
      const t = (f * 1000) / FPS;
      await addAudioUpTo(t + 1);
      const ops = drawListAt(scene, t);
      await this.picturesOf(ops, scene.width);
      const feedMap = await this.feedsOf(ops, prefix);
      const got = new Map<DrawOp, import('mediabunny').VideoSample | null>();
      const d0 = performance.now();
      await Promise.all(
        [...feedMap].map(async ([op, feed]) => {
          got.set(op, await feed.at((op as VideoOp).sourceTimeMs / 1000));
        })
      );
      const d1 = performance.now();
      this.drawOps(ops, (op) => got.get(op) ?? null, ctx, scene);
      const d2 = performance.now();
      await source.add(f / FPS, 1 / FPS);
      const now = performance.now();
      decodeMs += d1 - d0;
      drawMs += d2 - d1;
      encodeMs += now - d2;
      longestPause = Math.max(longestPause, now - last);
      last = now;
      if (this.appState !== 'active') bgFrames += 1;
      if (f % 15 === 0) {
        this.hud(`export ${f}/${total}`);
        job?.onProgress(Math.round((f / total) * 100));
      }
    }
    await addAudioUpTo(endMs);
    await output.finalize();
    await writes;
    const path = await this.host.finishExport();
    const ms = performance.now() - t0;
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
            audioMix: Math.round(audioMixMs),
          },
          path,
          hardwareEncoder: hw,
          audio: audioCodec ?? (scene.audio.length ? 'no encoder' : 'silent'),
        },
      })
    );
    if (!job) await this.seekTo(0, false);
    return { path, bytes, durationMs: endMs };
  }

  fileAccessReport() {
    return this.methods;
  }

  dispose() {
    this.playing = false;
    this.audio.dispose();
    cancelAnimationFrame(this.raf);
    for (const p of this.feeds.values()) void p.then((f) => f.dispose()).catch(() => {});
    for (const p of this.inputs.values()) void p.then((i) => i.input.dispose()).catch(() => {});
  }
}

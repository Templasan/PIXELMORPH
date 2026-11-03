import type { VideoSample } from 'mediabunny';
import {
  liveLayerCap,
  liveLayerKeys,
  mediaAround,
  opsAt,
  type Box,
  type Composition,
  type MediaOp,
} from '../domain/composition';
import { AudioMixer } from './audio';
import { drawFrame } from './draw';
import type { Feed } from './feed';
import type { MediaPool } from './media';

/** Diagnostics of one displayed frame (see Player.tick). Costs are main-thread ms. */
export interface FrameInfo {
  t: number;
  drawn: string[];
  late: string[];
  held: boolean;
  /** Since the previous displayed frame (wall clock). */
  intervalMs: number;
  /** Working out the frame (opsAt) and preparing upcoming clips. */
  planMs: number;
  /** Taking decoded frames from the decoders (never waits). */
  decodeMs: number;
  drawMs: number;
  /** Open decoder slots, open files, decoded pictures. */
  feeds: number;
  inputs: number;
  pictures: number;
}

export interface PlayerEvents {
  /** The playhead, on every change: seeks immediately, every displayed frame while playing. */
  onTime(ms: number): void;
  onPlaying(playing: boolean): void;
  onError(message: string): void;
  /** How many video layers hold their frame while playing, to keep the rest fluid. */
  onFrozenLayers?(count: number): void;
  /** A frame reached the canvas; `Player.boxes` now says where its clips are. */
  onDrawn?(): void;
  /** Diagnostics: every displayed frame while playing (time, layers drawn, layers late). */
  onFrame?(info: FrameInfo): void;
}

/** Clips starting this soon get their decoder opened and positioned before they show. */
const PREPARE_AHEAD_MS = 1500;
/** Pictures decoded ahead at most: a fast stop-motion would push the next ones out of the cache. */
const PICTURES_AHEAD = 8;
/** A layer whose frame is late keeps the previous picture on screen for at most this long. */
const MAX_HOLD_MS = 400;
/** Decoders of clips that left the window are closed this often while playing. */
const PRUNE_EVERY_MS = 1000;

/**
 * The preview. It is the ONLY owner of the playhead: the editor asks it to play, pause and seek,
 * and shows whatever time it reports. While playing, the sound's clock leads (the picture follows
 * it); paused, the time is exactly the last requested one.
 */
export class Player {
  /** Where each clip was last drawn, in frame pixels. */
  readonly boxes = new Map<string, Box>();
  private readonly liveCap = liveLayerCap((navigator as { deviceMemory?: number }).deviceMemory);
  private frozen = 0;
  private comp: Composition;
  private t = 0;
  private playing = false;
  private raf = 0;
  private wall = { at: 0, t: 0 };
  private audio: AudioMixer;
  private ctx: CanvasRenderingContext2D;
  private stillWanted: number | null = null;
  private stillRun: Promise<void> | null = null;
  private primed = new Set<string>();
  private heldSince = 0;
  /** While playing, time never goes back: the wall clock leads until the sound starts, then the
   * sound's clock (which starts a little later, at its own anchor) takes over without a step back. */
  private floor = 0;
  private lastPrune = 0;
  private lastFrameAt = 0;
  /** What the canvas shows now (see signature); '' forces the next live frame to draw. */
  private lastSig = '';
  private frameIds = new WeakMap<object, number>();
  private nextFrameId = 1;

  /** Everything that decides the picture: each layer's decoded frame and placement, each text. */
  private signature(
    ops: ReturnType<typeof opsAt>,
    frames: Map<MediaOp, VideoSample | ImageBitmap | null>
  ): string {
    const parts: string[] = [];
    for (const op of ops) {
      if (op.kind === 'clear') continue;
      if (op.kind === 'caption') {
        parts.push(
          `c${op.text}|${op.cx.toFixed(1)}|${op.cy.toFixed(1)}|${op.opacity.toFixed(3)}|${op.scale.toFixed(3)}`
        );
        continue;
      }
      const f = frames.get(op);
      let id = 0;
      if (f) {
        id = this.frameIds.get(f) ?? 0;
        if (!id) this.frameIds.set(f, (id = this.nextFrameId++));
      }
      parts.push(
        `${op.key}|${id}|${op.opacity.toFixed(3)}|${op.translateX.toFixed(1)}|${op.scale.toFixed(3)}|${op.rect.x},${op.rect.y},${op.rect.w},${op.rect.h}|${op.brightness}|${op.rotationDeg}|${op.fit}`
      );
    }
    return parts.join(';');
  }
  loop: { startMs: number; endMs: number } | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly pool: MediaPool,
    private readonly events: PlayerEvents,
    comp: Composition
  ) {
    this.comp = comp;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.audio = new AudioMixer((uri) => pool.input(uri));
    this.resize();
    this.drawStill(0);
  }

  get time() {
    return this.t;
  }

  get isPlaying() {
    return this.playing;
  }

  get composition() {
    return this.comp;
  }

  private resize() {
    if (this.canvas.width !== this.comp.width) this.canvas.width = this.comp.width;
    if (this.canvas.height !== this.comp.height) this.canvas.height = this.comp.height;
  }

  /** A new timeline: keeps the playhead (clamped) and shows the new frame. */
  setComposition(comp: Composition) {
    this.comp = comp;
    this.lastSig = '';
    this.resize();
    this.primed.clear();
    const t = Math.min(this.t, comp.durationMs);
    if (t !== this.t) this.setTime(t);
    if (this.playing) {
      this.anchorAt(this.t);
    } else {
      this.drawStill(this.t);
    }
  }

  private setTime(ms: number) {
    this.t = ms;
    this.events.onTime(ms);
  }

  private endMs() {
    return this.loop ? Math.min(this.loop.endMs, this.comp.durationMs) : this.comp.durationMs;
  }

  // ---- transport -------------------------------------------------------------------------------

  async play() {
    if (this.playing || this.comp.durationMs <= 0) return;
    if (this.t >= this.endMs() - 1) this.setTime(this.loop?.startMs ?? 0);
    this.playing = true;
    this.events.onPlaying(true);
    // Start on an exact, complete frame (and decoders warmed at it) instead of a black one.
    await this.drawStill(this.t);
    if (!this.playing) return;
    this.anchorAt(this.t);
    this.raf = requestAnimationFrame(this.tick);
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.audio.stop();
    this.setFrozen(0);
    this.events.onPlaying(false);
    this.events.onTime(this.t);
    this.drawStill(this.t);
  }

  toggle() {
    if (this.playing) this.pause();
    else void this.play();
  }

  /** Seek that resolves when the exact frame is on screen (diagnostics, tests). */
  seekAndWait(ms: number): Promise<void> {
    this.seek(ms);
    return this.stillRun ?? Promise.resolve();
  }

  /** Moves the playhead now; the picture follows as soon as it is decoded (latest request wins). */
  seek(ms: number) {
    const t = Math.max(0, Math.min(this.comp.durationMs, ms));
    this.setTime(t);
    this.primed.clear();
    if (this.playing) this.anchorAt(t);
    else void this.drawStill(t);
  }

  private anchorAt(t: number) {
    this.lastFrameAt = 0;
    this.lastSig = '';
    this.wall = { at: performance.now(), t };
    this.floor = t;
    this.heldSince = 0;
    void this.audio.start(this.comp.audio, t, this.endMs());
  }

  // ---- live playback ---------------------------------------------------------------------------

  private tick = (now: number) => {
    if (!this.playing) return;
    let t = Math.max(this.floor, this.audio.timeMs() ?? this.wall.t + (now - this.wall.at));
    this.floor = t;
    const end = this.endMs();
    if (t >= end) {
      if (this.loop) {
        t = this.loop.startMs;
        this.setTime(t);
        this.anchorAt(t);
      } else {
        this.setTime(end);
        this.pause();
        return;
      }
    }
    const c0 = performance.now();
    this.prepareAround(t);
    const ops = opsAt(this.comp, t);
    const c1 = performance.now();
    const frames = new Map<MediaOp, VideoSample | ImageBitmap | null>();
    const late: string[] = [];
    const live = liveLayerKeys(ops, this.liveCap);
    this.setFrozen(ops.filter((o) => o.kind === 'video' && !live.has(o.key)).length);
    for (const op of ops) {
      if (op.kind !== 'video' && op.kind !== 'image') continue;
      const frame = this.liveFrame(op, live.has(op.key));
      if (!frame) late.push(op.key);
      frames.set(op, frame);
    }
    // A late layer would flash out of the picture: keep the last complete frame a little longer.
    const c2 = performance.now();
    const held = late.length > 0 && (this.heldSince === 0 || now - this.heldSince < MAX_HOLD_MS);
    if (held) {
      if (this.heldSince === 0) this.heldSince = now;
    } else {
      this.heldSince = 0;
      // A 30 fps video on a 120 Hz screen: redraw only when something on screen changed.
      const sig = this.signature(ops, frames);
      if (sig !== this.lastSig) {
        this.lastSig = sig;
        drawFrame(this.ctx, this.comp.width, this.comp.height, ops, (op) => frames.get(op) ?? null, this.boxes);
        this.events.onDrawn?.();
      }
    }
    const c3 = performance.now();
    if (this.events.onFrame) {
      this.events.onFrame({
        t,
        drawn: [...frames.keys()].filter((op) => frames.get(op)).map((op) => op.key),
        late,
        held,
        intervalMs: this.lastFrameAt ? now - this.lastFrameAt : 0,
        planMs: c1 - c0,
        decodeMs: c2 - c1,
        drawMs: c3 - c2,
        ...this.pool.stats(),
      });
    }
    this.lastFrameAt = now;
    this.setTime(t);
    if (now - this.lastPrune > PRUNE_EVERY_MS) {
      this.lastPrune = now;
      this.prune(t);
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  private setFrozen(count: number) {
    if (count === this.frozen) return;
    this.frozen = count;
    this.events.onFrozenLayers?.(count);
  }

  private liveFrame(op: MediaOp, decoding: boolean): VideoSample | ImageBitmap | null {
    if (op.kind === 'image') return this.pool.pictureNow(op.uri, this.comp.width);
    const feed = this.pool.liveFeed(op.key, op.uri);
    if (!feed) {
      void this.pool.feedReady(op.key, op.uri).catch((e) => this.fail(e));
      return null;
    }
    return !decoding && feed.cur ? feed.cur : feed.tick(op.sourceTimeMs / 1000);
  }

  /** Opens and positions the decoders of clips about to show, once per clip and playhead jump. */
  private prepareAround(t: number) {
    let pictures = 0;
    for (const op of mediaAround(this.comp, t, PREPARE_AHEAD_MS)) {
      if (op.kind === 'image' && ++pictures > PICTURES_AHEAD) continue;
      if (this.primed.has(op.key)) continue;
      this.primed.add(op.key);
      if (op.kind === 'image') {
        void this.pool.picture(op.uri, this.comp.width);
        continue;
      }
      void this.pool
        .feedReady(op.key, op.uri)
        .then((feed) => (feed.primed ? undefined : feed.restart(op.sourceTimeMs / 1000)))
        .catch((e) => this.fail(e));
    }
  }

  private prune(t: number) {
    const keep = new Set(
      mediaAround(this.comp, t, PREPARE_AHEAD_MS).map((o) => `${o.key}|${o.uri}`)
    );
    const uris = new Set<string>([
      ...this.comp.layers.flatMap((l) => l.clips.map((c) => c.sourceUri)),
      ...this.comp.audio.map((a) => a.uri),
    ]);
    this.pool.prune(keep, uris);
    for (const key of [...this.primed]) {
      if (![...keep].some((k) => k.startsWith(`${key}|`))) this.primed.delete(key);
    }
  }

  // ---- exact frames (paused, seeks) ------------------------------------------------------------

  /** Draws exactly the frame at `t` with every layer decoded (coalesced: the newest wins). */
  private drawStill(t: number): Promise<void> {
    this.stillWanted = t;
    this.stillRun ??= this.runStills();
    return this.stillRun;
  }

  private async runStills() {
    try {
      while (this.stillWanted !== null) {
        const t = this.stillWanted;
        this.stillWanted = null;
        if (!this.playing) this.prune(t);
        // Parked at the very end (the video is end-exclusive): show its last frame, not black.
        const d = this.comp.durationMs;
        const ops = opsAt(this.comp, d > 0 && t >= d ? d - 1 : t);
        const frames = new Map<MediaOp, VideoSample | ImageBitmap | null>();
        await Promise.all(
          ops.map(async (op) => {
            if (op.kind === 'image')
              frames.set(op, await this.pool.picture(op.uri, this.comp.width));
            if (op.kind !== 'video') return;
            const feed: Feed = await this.pool.feedReady(op.key, op.uri);
            frames.set(op, await feed.seek(op.sourceTimeMs / 1000));
          })
        );
        // A newer request arrived while decoding: draw that one instead of a stale frame.
        if (this.stillWanted !== null) continue;
        drawFrame(this.ctx, this.comp.width, this.comp.height, ops, (op) => frames.get(op) ?? null, this.boxes);
        this.events.onDrawn?.();
      }
    } catch (e) {
      this.fail(e);
    } finally {
      this.stillRun = null;
    }
  }

  private fail(e: unknown) {
    this.events.onError(String((e as Error)?.message ?? e));
  }

  /** Stops this player; the media pool belongs to the session and stays open. */
  dispose() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.audio.dispose();
  }
}

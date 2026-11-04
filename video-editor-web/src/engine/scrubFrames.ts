import { CanvasSink } from 'mediabunny';
import { frameBytesOf, nearestIndex, scrubTimes } from '../domain/scrubPlan';
import type { MediaPool } from './media';

type Frame = HTMLCanvasElement | OffscreenCanvas;

interface Reserve {
  times: number[];
  frames: Frame[];
  bytes: number;
}

/**
 * Small frames of each video kept in memory, made while nothing plays, so a jump shows one at once
 * (see domain/scrubPlan.ts). A file past the budget loses its oldest reserve, and a file with none
 * simply jumps as before.
 */
export class ScrubFrames {
  private reserves = new Map<string, Reserve>();
  private queue: string[] = [];
  private running = false;
  private disposed = false;
  /** Last made, for diagnostics. */
  lastJob: { uri: string; frames: number; ms: number } | null = null;

  constructor(
    private readonly pool: MediaPool,
    private readonly busy: () => boolean,
    private readonly budget: { bytes: number; shortEdge: number }
  ) {}

  /** These are the files on the timeline now: reserves for them are made, and others may go. */
  want(uris: readonly string[]) {
    for (const uri of uris) {
      const done = this.reserves.get(uri);
      if ((!done || done.frames.length < done.times.length) && !this.queue.includes(uri)) this.queue.push(uri);
    }
    for (const uri of [...this.reserves.keys()]) {
      if (!uris.includes(uri)) this.drop(uri);
    }
    void this.run();
  }

  /** The kept frame nearest to a moment of the file, or null when there is none yet. */
  nearest(uri: string, sourceMs: number): Frame | null {
    const reserve = this.reserves.get(uri);
    if (!reserve) return null;
    const at = nearestIndex(reserve.times.slice(0, reserve.frames.length), sourceMs / 1000);
    return at < 0 ? null : reserve.frames[at];
  }

  get bytes() {
    let total = 0;
    for (const r of this.reserves.values()) total += r.bytes;
    return total;
  }

  dispose() {
    this.disposed = true;
    this.queue = [];
    for (const uri of [...this.reserves.keys()]) this.drop(uri);
  }

  private drop(uri: string) {
    this.reserves.delete(uri);
  }

  private async run() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length && !this.disposed) {
        while (this.busy() && !this.disposed) await new Promise((r) => setTimeout(r, 250));
        const uri = this.queue.shift();
        if (uri) await this.make(uri);
      }
    } finally {
      this.running = false;
    }
  }

  private async make(uri: string) {
    const began = performance.now();
    await this.pool
      .withPinned(uri, async () => {
        const track = await (await this.pool.input(uri)).getPrimaryVideoTrack();
        if (!track) return;
        const portrait = track.displayHeight > track.displayWidth;
        const shape = portrait ? { width: this.budget.shortEdge } : { height: this.budget.shortEdge };
        const scale = this.budget.shortEdge / Math.min(track.displayWidth, track.displayHeight);
        const frameBytes = frameBytesOf(track.displayWidth * scale, track.displayHeight * scale);
        const times = scrubTimes((await track.getDurationFromMetadata()) ?? (await track.computeDuration()), frameBytes, this.budget.bytes);
        const reserve = this.reserves.get(uri) ?? { times, frames: [], bytes: 0 };
        this.reserves.set(uri, reserve);
        const sink = new CanvasSink(track, { ...shape, fit: 'contain' });
        for await (const wrapped of sink.canvasesAtTimestamps(reserve.times.slice(reserve.frames.length))) {
          if (this.disposed || !this.reserves.has(uri)) return;
          if (!wrapped) break;
          reserve.frames.push(wrapped.canvas);
          reserve.bytes += frameBytes;
          this.keepWithinBudget(uri);
          if (this.busy()) {
            // A phone has few hardware decoders, and a jump or playback needs one more than this does.
            // Leaving the loop closes this one; the rest of the file is made afterwards.
            this.queue.unshift(uri);
            return;
          }
        }
        this.lastJob = { uri, frames: reserve.frames.length, ms: Math.round(performance.now() - began) };
      })
      .catch(() => {}); // a file that cannot be decoded here simply has no reserve
  }

  private keepWithinBudget(keep: string) {
    for (const uri of [...this.reserves.keys()]) {
      if (this.bytes <= this.budget.bytes) return;
      if (uri !== keep) this.drop(uri);
    }
  }
}

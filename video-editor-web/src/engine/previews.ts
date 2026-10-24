import { AudioBufferSink, CanvasSink } from 'mediabunny';
import type { MediaPool } from './media';

/** Thumbnail height in px (the width follows the video's shape, capped). */
export const THUMB_H = 40;
/** Peaks per second of a waveform (one max-abs value per bucket, all channels mixed). */
export const PEAKS_PER_SECOND = 100;
const MAX_THUMBS = 600;

/** Steps a thumbnail strip may use, in seconds; the strip picks the first ≥ its spacing. */
const STEPS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60];
export function thumbStep(spacingSeconds: number): number {
  return STEPS.find((s) => s >= spacingSeconds) ?? 60;
}

type Thumb = HTMLCanvasElement | OffscreenCanvas;
type Job = { uri: string; times: number[] } | { uri: string; peaks: true };

/**
 * Timeline thumbnails and waveforms. Work runs one job at a time and waits while the preview
 * plays (the preview's decoders come first); results are cached and announced through
 * `subscribe`. Ideas from omnitool's filmstrip/waveform (MIT), reimplemented.
 */
export class MediaPreviews {
  private thumbs = new Map<string, Thumb>(); // `${uri}|${time}`, most recent last
  private peaks = new Map<string, Float32Array | 'pending' | 'none'>();
  private wanted = new Map<string, Set<number>>();
  private queue: Job[] = [];
  private running = false;
  private subs = new Set<() => void>();

  constructor(
    private readonly pool: MediaPool,
    private readonly busy: () => boolean
  ) {}

  subscribe(cb: () => void) {
    this.subs.add(cb);
    return () => {
      this.subs.delete(cb);
    };
  }

  private changed() {
    this.subs.forEach((cb) => cb());
  }

  /** The thumbnail of `uri` at `time` (seconds on a step grid) if made; otherwise asks for it. */
  thumb(uri: string, time: number): Thumb | null {
    const key = `${uri}|${time}`;
    const t = this.thumbs.get(key);
    if (t) {
      this.thumbs.delete(key);
      this.thumbs.set(key, t);
      return t;
    }
    let set = this.wanted.get(uri);
    if (!set) {
      set = new Set();
      this.wanted.set(uri, set);
    }
    if (!set.has(time)) {
      set.add(time);
      this.enqueueThumbs(uri);
    }
    return null;
  }

  private pictures = new Map<string, ImageBitmap | 'pending' | 'none'>();

  /** A small copy of a picture file (image clips), decoded once. */
  picture(uri: string): ImageBitmap | null {
    const p = this.pictures.get(uri);
    if (p instanceof ImageBitmap) return p;
    if (!p) {
      this.pictures.set(uri, 'pending');
      fetch(uri)
        .then((r) => r.blob())
        .then((b) => createImageBitmap(b, { resizeHeight: THUMB_H * 2, resizeQuality: 'medium' }))
        .then(
          (bm) => this.pictures.set(uri, bm),
          () => this.pictures.set(uri, 'none')
        )
        .finally(() => this.changed());
    }
    return null;
  }

  /** The waveform peaks of `uri` if computed; otherwise starts computing them. */
  waveform(uri: string): Float32Array | null {
    const p = this.peaks.get(uri);
    if (p instanceof Float32Array) return p;
    if (!p) {
      this.peaks.set(uri, 'pending');
      this.queue.push({ uri, peaks: true });
      void this.run();
    }
    return null;
  }

  private enqueueThumbs(uri: string) {
    // One batch per file: requests arriving while it waits join it.
    if (this.queue.some((j) => j.uri === uri && 'times' in j)) return;
    this.queue.push({ uri, times: [] });
    void this.run();
  }

  private async run() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length) {
        while (this.busy()) await new Promise((r) => setTimeout(r, 250));
        const job = this.queue.shift()!;
        if ('peaks' in job) await this.makePeaks(job.uri);
        else await this.makeThumbs(job.uri);
        this.changed();
      }
    } finally {
      this.running = false;
    }
  }

  private async makeThumbs(uri: string) {
    const set = this.wanted.get(uri);
    if (!set?.size) return;
    const times = [...set].sort((a, b) => a - b);
    set.clear();
    await this.pool
      .withPinned(uri, async () => {
        const track = await (await this.pool.input(uri)).getPrimaryVideoTrack();
        if (!track) return;
        const sink = new CanvasSink(track, { height: THUMB_H, fit: 'contain' });
        let i = 0;
        for await (const wrapped of sink.canvasesAtTimestamps(times)) {
          const time = times[i++];
          if (wrapped) this.thumbs.set(`${uri}|${time}`, wrapped.canvas);
          if (this.busy()) {
            // The preview started playing: hand the rest back and stop decoding.
            times.slice(i).forEach((t) => set.add(t));
            if (set.size) this.enqueueThumbs(uri);
            break;
          }
        }
      })
      .catch(() => {}); // a file without decodable video simply has no thumbnails
    while (this.thumbs.size > MAX_THUMBS) this.thumbs.delete(this.thumbs.keys().next().value!);
  }

  private async makePeaks(uri: string) {
    try {
      const out = await this.pool.withPinned(uri, async () => {
        const input = await this.pool.input(uri);
        const track = await input.getPrimaryAudioTrack();
        if (!track) return null;
        const duration = await input.computeDuration();
        const peaks = new Float32Array(Math.max(1, Math.ceil(duration * PEAKS_PER_SECOND)));
        for await (const { buffer, timestamp } of new AudioBufferSink(track).buffers()) {
          const rate = buffer.sampleRate;
          const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) =>
            buffer.getChannelData(c)
          );
          for (let i = 0; i < buffer.length; i += 1) {
            const bucket = Math.floor((timestamp + i / rate) * PEAKS_PER_SECOND);
            if (bucket < 0 || bucket >= peaks.length) continue;
            let v = 0;
            for (const ch of channels) v = Math.max(v, Math.abs(ch[i]));
            if (v > peaks[bucket]) peaks[bucket] = v;
          }
          await new Promise((r) => setTimeout(r)); // stay responsive on long files
        }
        return peaks;
      });
      this.peaks.set(uri, out ?? 'none');
    } catch {
      this.peaks.set(uri, 'none');
    }
  }
}

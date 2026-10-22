import type { VideoSample, VideoSampleSink } from 'mediabunny';

/**
 * SPIKE: one decoder slot (one layer reading one source). Keeps the sample on screen (`cur`) plus up
 * to two decoded ahead (`q`) and restarts the sample iterator when the requested time jumps.
 * `tick` never waits (live preview); `at`/`restart` wait (seek, export).
 */
export class Feed {
  cur: VideoSample | null = null;
  private q: VideoSample[] = [];
  private it: AsyncGenerator<VideoSample, void, unknown> | null = null;
  private pend: Promise<void> | null = null;
  private busy: Promise<void> | null = null;
  private done = false;
  private epoch = 0;
  private lastDrawn: VideoSample | null = null;
  shown = 0;
  late = 0;
  dropped = 0;
  restarts = 0;

  constructor(
    readonly layer: string,
    private readonly sink: VideoSampleSink
  ) {}

  resetCounters() {
    this.shown = 0;
    this.late = 0;
    this.dropped = 0;
    this.restarts = 0;
  }

  async restart(sec: number): Promise<void> {
    this.restarts += 1;
    const my = ++this.epoch;
    this.releaseAll();
    const it = this.sink.samples(Math.max(0, sec));
    this.it = it;
    this.done = false;
    const first = await it.next();
    if (my !== this.epoch) {
      if (!first.done) first.value.close();
      return;
    }
    if (first.done) this.done = true;
    else this.cur = first.value;
  }

  private releaseAll() {
    this.cur?.close();
    this.q.forEach((s) => s.close());
    this.cur = null;
    this.q = [];
    this.lastDrawn = null;
    this.pend = null;
    void this.it?.return(undefined)?.catch(() => {});
    this.it = null;
  }

  private needsRestart(sec: number): boolean {
    if (!this.it) return true;
    if (!this.cur) return false; // first sample still on its way (or an empty stream)
    if (sec < this.cur.timestamp - 0.05) return true;
    const ahead = this.q.length ? this.q[this.q.length - 1].timestamp : this.cur.timestamp;
    return !this.done && !this.pend && sec - ahead > 0.5;
  }

  private fill() {
    if (this.pend || this.done || !this.it || this.q.length >= 2) return;
    const my = this.epoch;
    const pend = this.it.next().then((r) => {
      if (my !== this.epoch) {
        if (!r.done) r.value.close();
        return;
      }
      this.pend = null;
      if (r.done) this.done = true;
      else this.q.push(r.value);
    });
    this.pend = pend;
  }

  /** Live preview: never waits. Returns the newest decoded sample at or before `sec`. */
  tick(sec: number): VideoSample | null {
    if (this.busy) return this.cur;
    if (this.needsRestart(sec)) {
      this.busy = this.restart(sec).finally(() => {
        this.busy = null;
      });
      return this.cur;
    }
    let moved = 0;
    while (this.q.length && this.q[0].timestamp <= sec) {
      this.cur?.close();
      this.cur = this.q.shift() ?? null;
      moved += 1;
    }
    if (moved > 1) this.dropped += moved - 1;
    this.fill();
    return this.cur;
  }

  /** Seek / export: waits until the sample at `sec` is decoded. */
  async at(sec: number): Promise<VideoSample | null> {
    await this.busy;
    if (this.needsRestart(sec)) await this.restart(sec);
    for (;;) {
      if (!this.q.length) {
        this.fill();
        await this.pend;
        if (!this.q.length) break; // end of stream
      }
      if (this.q[0].timestamp > sec) break;
      this.cur?.close();
      this.cur = this.q.shift() ?? null;
    }
    this.fill();
    return this.cur;
  }

  /** Counts a frame actually drawn this display frame (for per-layer fps / late stats). */
  markDrawn(sample: VideoSample, sec: number) {
    if (sample !== this.lastDrawn) {
      this.shown += 1;
      this.lastDrawn = sample;
    }
    if (sec - sample.timestamp > 0.1) this.late += 1;
  }

  dispose() {
    this.epoch += 1;
    this.releaseAll();
  }
}

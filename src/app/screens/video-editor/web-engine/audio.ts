import { AudioBufferSink, type Input } from 'mediabunny';
import { spanGainAt, type AudioSpan } from '../../../../modules/video-editor/domain/webScene';

/** Headroom between "play" and the first scheduled sample, so the first chunk is not late. */
const LEAD_S = 0.15;
/** The live mixer decodes at most this far ahead of what is playing. */
const AHEAD_S = 2;
const OUT_RATE = 48_000;

type OpenInput = (uri: string) => Promise<Input>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Schedules the part of `span` that falls in [fromMs, toMs) of the finished video on `ctx`.
 * `whenOf(ms)` maps finished-video time to the context's clock. One chunk (~20 ms of decoded
 * audio) gets one gain, the span's gain at the chunk's middle: fades step at that rate.
 */
async function scheduleSpan(
  ctx: BaseAudioContext,
  span: AudioSpan,
  input: Input,
  fromMs: number,
  toMs: number,
  whenOf: (ms: number) => number,
  live: { alive: () => boolean; track?: Set<AudioBufferSourceNode> } | null
): Promise<void> {
  const track = await input.getPrimaryAudioTrack();
  if (!track) return; // a silent clip (e.g. a screen recording)
  const outFrom = Math.max(fromMs, span.startMs);
  const outTo = Math.min(toMs, span.startMs + span.outputMs);
  if (outTo <= outFrom) return;
  const srcFrom = (span.inMs + (outFrom - span.startMs) * span.speed) / 1000;
  const srcTo = (span.inMs + (outTo - span.startMs) * span.speed) / 1000;
  const outOf = (srcS: number) => span.startMs + (srcS * 1000 - span.inMs) / span.speed;

  for await (const { buffer, timestamp } of new AudioBufferSink(track).buffers(srcFrom, srcTo)) {
    if (live && !live.alive()) return;
    if (live) {
      while (whenOf(outOf(timestamp)) - ctx.currentTime > AHEAD_S) {
        await sleep(200);
        if (!live.alive()) return;
      }
    }
    // Cut the chunk to [srcFrom, srcTo) and to what has not already played (buffer seconds).
    let offset = Math.max(0, srcFrom - timestamp);
    const end = Math.min(buffer.duration, srcTo - timestamp);
    let at = whenOf(outOf(timestamp + offset));
    if (live && at < ctx.currentTime) {
      offset += (ctx.currentTime - at) * span.speed;
      at = ctx.currentTime;
    }
    if (end - offset <= 0) continue;
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.playbackRate.value = span.speed;
    const gain = ctx.createGain();
    gain.gain.value = spanGainAt(span, outOf(timestamp + (offset + end) / 2));
    node.connect(gain).connect(ctx.destination);
    node.start(at, offset, end - offset);
    if (live?.track) {
      live.track.add(node);
      node.onended = () => live.track?.delete(node);
    }
  }
}

/**
 * Live sound for the preview. While it plays, its clock is THE clock of the engine: the picture
 * follows the audio, so the two cannot drift apart.
 */
export class AudioMixer {
  private ctx: AudioContext | null = null;
  private epoch = 0;
  private nodes = new Set<AudioBufferSourceNode>();
  private anchor: { ctxS: number; ms: number } | null = null;

  constructor(private readonly openInput: OpenInput) {}

  /** Finished-video time by the audio clock, or null when it is not running. */
  timeMs(): number | null {
    if (!this.ctx || !this.anchor || this.ctx.state !== 'running') return null;
    return this.anchor.ms + Math.max(0, this.ctx.currentTime - this.anchor.ctxS) * 1000;
  }

  /** (Re)starts the sound of `spans` from finished-video time `fromMs`. */
  async start(spans: readonly AudioSpan[], fromMs: number, toMs: number): Promise<void> {
    this.halt();
    const my = this.epoch;
    this.ctx ??= new AudioContext({ latencyHint: 'playback' });
    if (this.ctx.state !== 'running') await this.ctx.resume().catch(() => {});
    if (my !== this.epoch) return;
    const ctx = this.ctx;
    const anchor = { ctxS: ctx.currentTime + LEAD_S, ms: fromMs };
    this.anchor = anchor;
    const live = { alive: () => my === this.epoch, track: this.nodes };
    const whenOf = (ms: number) => anchor.ctxS + (ms - anchor.ms) / 1000;
    for (const span of spans) {
      if (span.startMs + span.outputMs <= fromMs || span.startMs >= toMs) continue;
      void this.openInput(span.uri)
        .then((input) => scheduleSpan(ctx, span, input, fromMs, toMs, whenOf, live))
        .catch(() => {}); // a source without readable audio stays silent, the picture goes on
    }
  }

  /** Silences and releases the audio device (an open context keeps it running, costing battery). */
  stop() {
    this.halt();
    if (this.ctx?.state === 'running') void this.ctx.suspend().catch(() => {});
  }

  private halt() {
    this.epoch += 1;
    this.anchor = null;
    for (const node of this.nodes) {
      try {
        node.stop();
      } catch {
        // not started yet
      }
    }
    this.nodes.clear();
  }

  dispose() {
    this.stop();
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}

/** The mixed sound of [fromMs, toMs) of the finished video, stereo 48 kHz (export). */
export async function mixWindow(
  spans: readonly AudioSpan[],
  openInput: OpenInput,
  fromMs: number,
  toMs: number
): Promise<AudioBuffer> {
  const frames = Math.max(1, Math.round(((toMs - fromMs) / 1000) * OUT_RATE));
  const ctx = new OfflineAudioContext(2, frames, OUT_RATE);
  const whenOf = (ms: number) => (ms - fromMs) / 1000;
  await Promise.all(
    spans
      .filter((s) => s.startMs < toMs && s.startMs + s.outputMs > fromMs)
      .map(async (s) => scheduleSpan(ctx, s, await openInput(s.uri), fromMs, toMs, whenOf, null))
  );
  return ctx.startRendering();
}

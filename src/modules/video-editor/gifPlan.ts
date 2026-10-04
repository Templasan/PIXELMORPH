import type { ExportPlan } from './exportPlan';

/**
 * RF-061: which instants of the timeline become GIF frames. Pure (no native imports) so it is
 * testable in Jest; the Skia/native work lives in the screen-side exporter.
 */

export const GIF_FPS_OPTIONS = [5, 10, 15] as const;
export const GIF_COLOR_OPTIONS = [32, 64, 128, 256] as const;
export const GIF_WIDTH_OPTIONS = [240, 360, 480] as const;
/** A GIF is a short loop: longer timelines are cut here instead of producing a huge file. */
export const GIF_MAX_DURATION_MS = 15_000;

export interface GifFrame {
  sourceUri: string;
  /** Instant of the source file to grab, in ms. */
  sourceTimeMs: number;
  /** How long this frame stays on screen, in ms. */
  delayMs: number;
}

export interface GifPlan {
  frames: GifFrame[];
  /** True when the timeline was longer than GIF_MAX_DURATION_MS and got cut. */
  truncated: boolean;
}

export function planGifFrames(
  plan: ExportPlan,
  fps: number,
  maxDurationMs: number = GIF_MAX_DURATION_MS
): GifPlan {
  const step = 1000 / fps;
  const frames: GifFrame[] = [];
  let clipStart = 0;
  let truncated = false;

  for (const clip of plan.clips) {
    const length = clip.kind === 'still' ? clip.holdMs : (clip.outMs - clip.inMs) / clip.speed;
    if (length <= 0) continue;

    for (let t = 0; t < length; t += step) {
      if (clipStart + t >= maxDurationMs) {
        truncated = true;
        return { frames, truncated };
      }
      frames.push({
        sourceUri: clip.sourceUri,
        sourceTimeMs: clip.kind === 'still' ? clip.stillTimeMs : clip.inMs + t * clip.speed,
        delayMs: Math.round(step),
      });
    }
    clipStart += length;
  }
  return { frames, truncated };
}

/** Smallest even-sided size that fits `maxWidth`, keeping the source aspect ratio. */
export function gifSize(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number
): { width: number; height: number } {
  const w = Math.min(maxWidth, sourceWidth || maxWidth);
  const h = Math.max(1, Math.round(((sourceHeight || sourceWidth || w) / (sourceWidth || w)) * w));
  return { width: w, height: h };
}

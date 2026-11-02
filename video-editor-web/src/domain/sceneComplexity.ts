/**
 * RNF-013: how much detail and motion a clip has, read from a few sampled frames, and the bitrate
 * that deserves. One bitrate covers the whole exported file, so this is content-adaptive per
 * export, not per scene: a busy section sets the bitrate for the whole file.
 */

/** Per frame, both in 0..1 of the luma range: 0 flat and still, ~1 pure noise. */
export interface FrameStats {
  /** Mean absolute difference between neighbouring pixels, horizontal plus vertical. */
  spatial: number;
  /** Mean absolute difference from the previous frame (0 when there is none). */
  temporal: number;
}

/** A frame whose detail+motion reaches this is treated as fully busy. Tuned by measurement (README). */
const BUSY = 0.25;
/** The smallest bitrate, as a share of the preset: a flat clip never drops below it. */
const FLOOR = 0.45;

/**
 * `luma` is w*h values, row by row. `prev` is the frame before it, for the temporal part; without
 * it (the first sample) the temporal part is 0.
 */
export function frameStats(luma: Uint8ClampedArray, w: number, h: number, prev?: Uint8ClampedArray): FrameStats {
  const n = w * h;
  if (n === 0) return { spatial: 0, temporal: 0 };
  let gradient = 0;
  let change = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x + 1 < w) gradient += Math.abs(luma[i + 1] - luma[i]);
      if (y + 1 < h) gradient += Math.abs(luma[i + w] - luma[i]);
      if (prev) change += Math.abs(luma[i] - prev[i]);
    }
  }
  return { spatial: gradient / n / 255, temporal: prev ? change / n / 255 : 0 };
}

/**
 * How busy the clip is, 0..1. Each frame counts detail plus motion, and the 90th percentile of
 * those sets it, not the mean: a busy section that covers a tenth of the sampled frames or more
 * still raises the bitrate, where a mean would hide it under the still parts. Nothing read gives
 * 1, so the preset's bitrate is kept.
 */
export function complexityOf(stats: readonly FrameStats[]): number {
  if (!stats.length) return 1;
  const values = stats.map((s) => s.spatial + s.temporal).sort((a, b) => a - b);
  const p90 = values[Math.min(values.length - 1, Math.ceil(values.length * 0.9) - 1)];
  return Math.min(1, Math.max(0, p90 / BUSY));
}

/**
 * The bitrate for a clip of this complexity: from 45% of the preset (still) up to the preset
 * itself (busy), rounded up to whole bits per second. Never above the preset.
 */
export function adaptiveBitrate(presetBitrate: number, complexity: number): number {
  const c = Number.isFinite(complexity) ? Math.min(1, Math.max(0, complexity)) : 1;
  return Math.min(presetBitrate, Math.ceil(presetBitrate * (FLOOR + (1 - FLOOR) * c)));
}

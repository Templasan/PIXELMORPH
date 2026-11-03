/**
 * RF-030: the moments that best stand for a video, for its animated thumbnail. A frame counts for
 * what it shows (detail, not a black or flat frame) and for how much it differs from the one
 * before (a new scene). Chosen frames keep their distance, so one busy scene does not fill it.
 */
const BINS = 32;

export interface FrameFeatures {
  /** Share of pixels per brightness range. */
  histogram: Float32Array;
  /** Mean difference between neighbouring pixels, 0..1. */
  detail: number;
}

export function frameFeatures(rgba: Uint8ClampedArray, width: number, height: number): FrameFeatures {
  const histogram = new Float32Array(BINS);
  let detail = 0;
  let n = 0;
  // Every fourth pixel in each direction: thumbnails do not need more.
  const stride = 4;
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 4;
      const luma = 0.3 * rgba[i] + 0.59 * rgba[i + 1] + 0.11 * rgba[i + 2];
      histogram[Math.min(BINS - 1, Math.floor((luma / 256) * BINS))] += 1;
      if (x + stride < width) {
        const j = i + stride * 4;
        detail += Math.abs(luma - (0.3 * rgba[j] + 0.59 * rgba[j + 1] + 0.11 * rgba[j + 2])) / 255;
      }
      n += 1;
    }
  }
  for (let b = 0; b < BINS; b += 1) histogram[b] /= Math.max(1, n);
  return { histogram, detail: detail / Math.max(1, n) };
}

const change = (a: FrameFeatures, b: FrameFeatures) => {
  let sum = 0;
  for (let i = 0; i < BINS; i += 1) sum += Math.abs(a.histogram[i] - b.histogram[i]);
  return sum / 2;
};

/** Below this a frame is flat: a fade, a black frame or a blank wall says nothing about the video. */
const FLAT = 0.004;
/** A new scene counts this much against a frame's detail. */
const CHANGE_WEIGHT = 0.25;

/** Indexes of up to `count` frames, in the order of the video. */
export function pickHighlights(frames: readonly FrameFeatures[], count: number): number[] {
  const scored = frames.map((f, i) => ({
    i,
    score: f.detail < FLAT ? -1 : f.detail + (i > 0 ? change(frames[i - 1], f) * CHANGE_WEIGHT : 0),
  }));
  const gap = Math.max(1, Math.floor(frames.length / (count * 2)));
  const chosen: number[] = [];
  for (const { i, score } of [...scored].sort((a, b) => b.score - a.score || a.i - b.i)) {
    if (chosen.length === count) break;
    if (score < 0) continue;
    if (chosen.every((c) => Math.abs(c - i) >= gap)) chosen.push(i);
  }
  // A video that is all flat still needs a thumbnail.
  if (chosen.length === 0 && frames.length > 0) chosen.push(0);
  return chosen.sort((a, b) => a - b);
}

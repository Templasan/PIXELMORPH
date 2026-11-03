/**
 * RF-062: how two neighbouring photos line up. Every overlap and vertical shift in range is tried
 * on small grey copies, and the one where the shared area matches best wins, by normalized cross
 * correlation, which ignores a difference in exposure between the two shots. Pure.
 */
export interface GreyPicture {
  width: number;
  height: number;
  /** One value per pixel, row by row. */
  data: Uint8ClampedArray;
}

export interface PairAlignment {
  /** Share of the right photo's width that lies over the left one. */
  overlap: number;
  /** Where the right photo sits relative to the left, as a share of the height (down is positive). */
  offsetY: number;
  /** How well the shared area matches, -1..1. */
  score: number;
}

const MIN_OVERLAP = 0.05;
const MAX_OVERLAP = 0.6;
const MAX_SHIFT = 0.2;
/** Below this the photos do not really share anything: a guess would look worse than none. */
export const MIN_ALIGN_SCORE = 0.6;
/** Every other pixel is plenty on a copy this small, and four times quicker. */
const STRIDE = 2;

function correlation(a: GreyPicture, b: GreyPicture, overlapPx: number, shiftPx: number): number {
  const ax0 = a.width - overlapPx;
  const y0 = Math.max(0, shiftPx);
  const y1 = Math.min(a.height, b.height + shiftPx);
  let n = 0;
  let sa = 0;
  let sb = 0;
  let saa = 0;
  let sbb = 0;
  let sab = 0;
  for (let y = y0; y < y1; y += STRIDE) {
    const rowA = y * a.width + ax0;
    const rowB = (y - shiftPx) * b.width;
    for (let x = 0; x < overlapPx; x += STRIDE) {
      const va = a.data[rowA + x];
      const vb = b.data[rowB + x];
      n += 1;
      sa += va;
      sb += vb;
      saa += va * va;
      sbb += vb * vb;
      sab += va * vb;
    }
  }
  if (n < 16) return -1;
  const varA = saa - (sa * sa) / n;
  const varB = sbb - (sb * sb) / n;
  // A flat area matches anything, so it says nothing.
  if (varA < n || varB < n) return -1;
  return (sab - (sa * sb) / n) / Math.sqrt(varA * varB);
}

/** Pictures of the same height. Null when no alignment is good enough to trust. */
export function alignPair(a: GreyPicture, b: GreyPicture): PairAlignment | null {
  let best: PairAlignment = { overlap: 0, offsetY: 0, score: -1 };
  const smallest = Math.min(a.width, b.width);
  const from = Math.max(4, Math.round(MIN_OVERLAP * smallest));
  const to = Math.round(MAX_OVERLAP * smallest);
  const shift = Math.round(MAX_SHIFT * a.height);
  for (let overlapPx = from; overlapPx <= to; overlapPx += 1) {
    for (let shiftPx = -shift; shiftPx <= shift; shiftPx += 1) {
      const score = correlation(a, b, overlapPx, shiftPx);
      if (score > best.score) best = { overlap: overlapPx / b.width, offsetY: shiftPx / a.height, score };
    }
  }
  return best.score >= MIN_ALIGN_SCORE ? best : null;
}

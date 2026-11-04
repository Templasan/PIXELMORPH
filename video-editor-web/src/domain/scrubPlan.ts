/**
 * What makes a jump on the timeline feel instant: frames ready in memory, shown at once while the
 * exact one is decoded. The decoder cannot be that fast on a phone (a third of a second on a Samsung
 * A11, with a new decoder per jump), so the picture does not wait for it. Pure planning only.
 */
const MIN_STEP_S = 1;
const BYTES_PER_PIXEL = 4;

/** How much memory the reserve may use, and how sharp it is: memory is what a low-end phone lacks. */
export function scrubBudget(lowEnd: boolean) {
  return lowEnd ? { bytes: 40 * 1024 * 1024, shortEdge: 180 } : { bytes: 150 * 1024 * 1024, shortEdge: 360 };
}

/** The moments to keep for a file: as often as the proxies have a full frame, within the budget. */
export function scrubTimes(durationS: number, frameBytes: number, budgetBytes: number): number[] {
  if (!(durationS > 0) || frameBytes <= 0) return [];
  const most = Math.max(1, Math.floor(budgetBytes / frameBytes));
  const step = Math.max(MIN_STEP_S, durationS / most);
  const out: number[] = [];
  for (let t = 0; t < durationS && out.length < most; t += step) out.push(t);
  return out;
}

export const frameBytesOf = (width: number, height: number) => Math.ceil(width) * Math.ceil(height) * BYTES_PER_PIXEL;

/** The index of the moment nearest to `at` in sorted `times`; -1 when there are none. */
export function nearestIndex(times: readonly number[], at: number): number {
  if (times.length === 0) return -1;
  let lo = 0;
  let hi = times.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= at) lo = mid;
    else hi = mid;
  }
  return Math.abs(times[hi] - at) < Math.abs(times[lo] - at) ? hi : lo;
}

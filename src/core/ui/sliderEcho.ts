/** Pure slider logic (no React/reanimated) so it can be unit-tested. */

export function toPct(value: number, min: number, max: number): number {
  'worklet';
  return max === min ? 0 : ((value - min) / (max - min)) * 100;
}

/** Touch x -> clamped, step-snapped value. */
export function snapValue(
  x: number,
  trackWidth: number,
  min: number,
  max: number,
  step: number
): number {
  'worklet';
  const ratio = Math.min(1, Math.max(0, x / trackWidth));
  const snapped = Math.round((min + ratio * (max - min)) / step) * step;
  // 17 * 0.05 is 0.8500000000000001: drop the float noise so labels and stored values are clean.
  return Math.min(max, Math.max(min, Math.round(snapped * 1e6) / 1e6));
}

/** After a release, an echo of an emitted value this late is taken as a real change (an undo). */
export const ECHO_WINDOW_MS = 1000;

/**
 * Tracks values emitted via onChange so late parent echoes of older values don't yank the
 * thumb backwards (the rollback), while genuinely external values still apply.
 *
 * Echoes arrive in emission order (the parent renders its state in order), so an echo of
 * emitted[k] means emitted[0..k] can no longer arrive: they are dropped. Whatever is left after
 * release is still in flight and keeps being treated as an echo — when the app is busy those
 * renders land after the release, and accepting them was the rollback. A value still pending
 * ECHO_WINDOW_MS after release is applied, so a parent that never echoes (or an undo to an
 * intermediate value) is not ignored forever.
 */
export function createEchoTracker(initial: number, now: () => number = Date.now) {
  let latest = initial;
  let start = initial;
  let emitted: number[] = [];
  let releasedAt: number | null = null;
  return {
    begin() {
      start = latest;
      emitted = [];
      releasedAt = null;
    },
    emit(v: number) {
      latest = v;
      emitted.push(v);
    },
    /** Parent passed `v` as the value prop. apply=false means it is a stale echo. */
    onPropValue(v: number): { apply: boolean } {
      const k = emitted.lastIndexOf(v);
      const expired = releasedAt !== null && now() - releasedAt > ECHO_WINDOW_MS;
      if (k >= 0 && !expired) {
        emitted = emitted.slice(k + 1);
        // The final value echoed: nothing older can still arrive.
        if (v === latest) emitted = [];
        return { apply: false };
      }
      emitted = [];
      latest = v;
      return { apply: true };
    },
    /** Gesture ended: the in-flight echoes stay recognised for ECHO_WINDOW_MS. */
    complete(): { value: number; from: number } {
      releasedAt = now();
      return { value: latest, from: start };
    },
    get latest() {
      return latest;
    },
    get pending() {
      return emitted.length;
    },
  };
}

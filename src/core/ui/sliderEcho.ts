/** Pure slider logic (no React/reanimated) so it can be unit-tested. */

export function toPct(value: number, min: number, max: number): number {
  'worklet';
  return max === min ? 0 : ((value - min) / (max - min)) * 100;
}

/** Touch x -> clamped, step-snapped value. */
export function snapValue(x: number, trackWidth: number, min: number, max: number, step: number): number {
  'worklet';
  const ratio = Math.min(1, Math.max(0, x / trackWidth));
  return Math.min(max, Math.max(min, Math.round((min + ratio * (max - min)) / step) * step));
}

/**
 * Tracks values emitted via onChange so late parent echoes of older values don't yank the
 * thumb backwards (the rollback), while genuinely external values still apply.
 */
export function createEchoTracker(initial: number) {
  let latest = initial;
  let start = initial;
  const emitted = new Set<number>();
  return {
    begin() {
      start = latest;
      emitted.clear();
    },
    emit(v: number) {
      latest = v;
      emitted.add(v);
    },
    /** Parent passed `v` as the value prop. apply=false means it is a stale echo. */
    onPropValue(v: number): { apply: boolean } {
      if (emitted.has(v)) {
        if (v === latest) emitted.clear();
        return { apply: false };
      }
      latest = v;
      return { apply: true };
    },
    /** Gesture ended. Keeps only the final value so a parent that never echoes it back can't
     * make a later external change (undo) to an older emitted value look like a stale echo. */
    complete(): { value: number; from: number } {
      emitted.clear();
      emitted.add(latest);
      return { value: latest, from: start };
    },
    get latest() {
      return latest;
    },
    get pending() {
      return emitted.size;
    },
  };
}

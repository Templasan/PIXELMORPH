/**
 * RF-035: where the review loop plays. With a clip selected it repeats that clip's own span on
 * the timeline (between its start and end markers); with nothing selected, the whole timeline.
 */
export function loopBounds(
  selected: { startMs: number; endMs: number } | null,
  totalDurationMs: number
): { startMs: number; endMs: number } {
  if (selected && selected.endMs > selected.startMs) return selected;
  return { startMs: 0, endMs: totalDurationMs };
}

/** Next playhead position after `stepMs`; wraps inside the loop range when looping. */
export function advancePlayhead(
  currentMs: number,
  stepMs: number,
  totalDurationMs: number,
  loop: { startMs: number; endMs: number } | null
): { timeMs: number; ended: boolean } {
  const next = currentMs + stepMs;
  if (loop) {
    // Outside the range (e.g. the user scrubbed away) the loop does not trap the playhead.
    const inside = currentMs >= loop.startMs && currentMs < loop.endMs;
    if (inside && next >= loop.endMs) return { timeMs: loop.startMs, ended: false };
  }
  if (next >= totalDurationMs) return { timeMs: totalDurationMs, ended: true };
  return { timeMs: next, ended: false };
}

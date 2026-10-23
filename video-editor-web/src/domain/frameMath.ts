/** RF-013: frame-accurate navigation math, shared by the frame-step buttons and timecode display. */

export const DEFAULT_FPS = 30;

export function msToFrame(ms: number, fps: number = DEFAULT_FPS): number {
  return Math.round((ms / 1000) * fps);
}

export function frameToMs(frame: number, fps: number = DEFAULT_FPS): number {
  return (frame / fps) * 1000;
}

/** Steps exactly one frame forward/back, clamped to the clip/track's own duration. */
export function stepFrameMs(
  currentMs: number,
  direction: 1 | -1,
  maxMs: number,
  fps: number = DEFAULT_FPS
): number {
  const frameMs = 1000 / fps;
  const next = currentMs + direction * frameMs;
  return Math.max(0, Math.min(next, maxMs));
}

export function formatTimecode(ms: number, fps: number = DEFAULT_FPS): string {
  const totalSeconds = ms / 1000;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const f = Math.floor((totalSeconds % 1) * fps);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}

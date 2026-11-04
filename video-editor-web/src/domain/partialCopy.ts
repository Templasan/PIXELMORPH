import { clipEndMs, type Track } from './Track';

/** A copy still being written: readable up to `progress` percent of the source. */
export interface PartialCopy {
  file: string;
  progress: number;
}

/** The copy writes in fragments, so the last seconds of its progress are not readable yet. */
const UNREADABLE_TAIL_MS = 3000;

export const readableMs = (durationMs: number, progress: number) =>
  Math.max(0, (durationMs * progress) / 100 - UNREADABLE_TAIL_MS);

/** Whether time `t` shows a part of a clip that its copy in progress has not reached yet. */
export function pastPartialCopy(tracks: readonly Track[], t: number, partial: Record<string, PartialCopy>): boolean {
  for (const track of tracks) {
    if (!track.visible) continue;
    for (const clip of track.clips) {
      const copy = partial[clip.sourceUri];
      if (!copy || t < clip.startMs || t >= clipEndMs(clip)) continue;
      const sourceMs = clip.inPointMs + (t - clip.startMs) * (clip.speed || 1);
      if (sourceMs >= readableMs(clip.sourceDurationMs, copy.progress)) return true;
    }
  }
  return false;
}

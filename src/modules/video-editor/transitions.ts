/** RF-032: transitions attached at the junction between two adjacent clips on a track. */

import { type Clip, type Track, type TransitionSpec, clipDurationMs } from './Track';

export const TRANSITION_TYPES = ['fade', 'slide', 'zoom', 'wipe'] as const;
export type TransitionType = (typeof TRANSITION_TYPES)[number];

export const TRANSITION_LABELS: Record<TransitionType, string> = {
  fade: 'Desvanecimento',
  slide: 'Deslize',
  zoom: 'Zoom',
  wipe: 'Wipe',
};

export const DEFAULT_TRANSITION_MS = 500;

/**
 * A transition can never outlast either clip it sits between — otherwise one side would
 * finish "fading" before it has even started playing.
 */
export function clampTransitionDurationMs(
  durationMs: number,
  previousClip: Clip,
  clip: Clip
): number {
  const maxAllowed = Math.min(clipDurationMs(previousClip), clipDurationMs(clip)) / 2;
  return Math.max(0, Math.min(durationMs, maxAllowed));
}

export function setTransition(
  tracks: Track[],
  trackId: string,
  clipId: string,
  transition: TransitionSpec | undefined
): Track[] {
  return tracks.map((t) =>
    t.id === trackId
      ? {
          ...t,
          clips: t.clips.map((c) => (c.id === clipId ? { ...c, transitionIn: transition } : c)),
        }
      : t
  );
}

/** The clip immediately before this one on the same track, if any — the transition's other side. */
export function previousClipOf(track: Track, clip: Clip): Clip | null {
  const sorted = [...track.clips].sort((a, b) => a.startMs - b.startMs);
  const index = sorted.findIndex((c) => c.id === clip.id);
  return index > 0 ? sorted[index - 1] : null;
}

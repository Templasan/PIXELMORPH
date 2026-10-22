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
 * finish "fading" before it has even started playing. Lengths are the ones actually shown.
 */
export function clampTransitionMs(
  durationMs: number,
  previousMs: number,
  currentMs: number
): number {
  return Math.max(0, Math.min(durationMs, previousMs / 2, currentMs / 2));
}

export function clampTransitionDurationMs(
  durationMs: number,
  previousClip: Clip,
  clip: Clip
): number {
  return clampTransitionMs(durationMs, clipDurationMs(previousClip), clipDurationMs(clip));
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

export type TransitionMode = 'out' | 'in';

/** "Entrada" only exists for slide and wipe; anything else (or no mode) plays as "Saída". */
export function effectiveMode(type: TransitionType, mode?: TransitionMode): TransitionMode {
  return mode === 'in' && (type === 'slide' || type === 'wipe') ? 'in' : 'out';
}

export interface LayerTransform {
  opacity: number;
  translateX: number;
  scale: number;
}

/**
 * Where each layer sits at `progress` (0..1) of a transition; `width` is the frame width in any
 * unit (translateX comes back in it). The export (PixelMorphVideoExportModule.kt) does the same:
 * the outgoing frame leaves (fade: opacity; slide: left; zoom: grows to 130% while fading;
 * wipe: right) over the live incoming clip; in "in" mode the incoming clip also moves in from
 * the side the outgoing frame is pushed towards, with no overlap.
 */
export function transitionTransforms(
  type: TransitionType,
  mode: TransitionMode,
  progress: number,
  width: number
): { outgoing: LayerTransform; incoming: LayerTransform } {
  const p = Math.min(1, Math.max(0, progress));
  const outgoing: LayerTransform = { opacity: 1, translateX: 0, scale: 1 };
  const incoming: LayerTransform = { opacity: 1, translateX: 0, scale: 1 };
  if (type === 'slide' || type === 'wipe') {
    const dir = type === 'slide' ? -1 : 1; // slide leaves to the left, wipe to the right
    outgoing.translateX = dir * width * p;
    if (effectiveMode(type, mode) === 'in') incoming.translateX = -dir * width * (1 - p);
  } else {
    outgoing.opacity = 1 - p;
    if (type === 'zoom') outgoing.scale = 1 + 0.3 * p;
  }
  return { outgoing, incoming };
}

/** The clip immediately before this one on the same track, if any — the transition's other side. */
export function previousClipOf(track: Track, clip: Clip): Clip | null {
  const sorted = [...track.clips].sort((a, b) => a.startMs - b.startMs);
  const index = sorted.findIndex((c) => c.id === clip.id);
  return index > 0 ? sorted[index - 1] : null;
}

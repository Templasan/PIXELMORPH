/**
 * RF-036: background audio track — volume plus a linear fade in/out at the clip's edges.
 * Pure math (same split as transitions.ts) so it's unit-testable.
 */

import { type Clip, clipDurationMs } from './Track';

export const DEFAULT_FADE_MS = 1000;

/** A fade can never outlast the clip itself — same reasoning as clampTransitionDurationMs. */
export function clampFadeMs(fadeMs: number, clip: Clip): number {
  const maxAllowed = clipDurationMs(clip);
  return Math.max(0, Math.min(fadeMs, maxAllowed));
}

/** Effective playback volume (0..1) at `offsetMs` into the clip, applying fade in/out. */
export function volumeAtOffset(clip: Clip, offsetMs: number): number {
  const duration = clipDurationMs(clip);
  const base = (clip.volume ?? 100) / 100;
  const fadeIn = clip.fadeInMs ?? 0;
  const fadeOut = clip.fadeOutMs ?? 0;

  let factor = 1;
  if (fadeIn > 0 && offsetMs < fadeIn) {
    factor = Math.min(factor, offsetMs / fadeIn);
  }
  if (fadeOut > 0 && offsetMs > duration - fadeOut) {
    factor = Math.min(factor, (duration - offsetMs) / fadeOut);
  }
  return base * Math.max(0, Math.min(1, factor));
}

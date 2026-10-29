import { createClip, type Clip } from './Track';
import { DEFAULT_TRANSITION_MS, clampTransitionMs, type TransitionType } from './transitions';

export const TIMELAPSE_SECONDS = { min: 0.1, max: 2, step: 0.1 } as const;

/**
 * RF-023: photos as consecutive clips, `stepMs` each, from `startMs`. The optional transition sits
 * at the start of every photo but the first, clamped like any other transition (half a photo).
 */
export function timelapseClips(
  photos: readonly { name: string; uri: string }[],
  opts: { startMs: number; stepMs: number; color: string; transition?: TransitionType }
): Clip[] {
  const transitionMs = clampTransitionMs(DEFAULT_TRANSITION_MS, opts.stepMs, opts.stepMs);
  return photos.map((p, i) => ({
    ...createClip({
      name: p.name,
      sourceUri: p.uri,
      color: opts.color,
      startMs: opts.startMs + i * opts.stepMs,
      sourceDurationMs: opts.stepMs,
    }),
    ...(opts.transition && i > 0
      ? { transitionIn: { type: opts.transition, durationMs: transitionMs } }
      : {}),
  }));
}

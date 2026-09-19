/**
 * RF-005: a real (if intentionally simple) multi-track timeline data model. Clips on a
 * track are non-overlapping and ordered by `startMs`; the timeline itself has no
 * "current playback frame" concept baked in — VideoEditorScreen owns that as UI state.
 */

export type TrackKind = 'video' | 'image' | 'text' | 'audio';

export interface TransitionSpec {
  type: 'fade' | 'slide' | 'zoom' | 'wipe';
  durationMs: number;
}

export interface Clip {
  id: string;
  name: string;
  sourceUri: string;
  color: string;
  startMs: number; // position on the track
  inPointMs: number; // trim in-point within the source asset
  outPointMs: number; // trim out-point within the source asset
  sourceDurationMs: number; // total duration of the source asset — trim's outer clamp
  /** RF-032: a transition from the previous clip on this track into this one. */
  transitionIn?: TransitionSpec;
  /** RF-077: true for a freeze-frame segment inserted by insertFreezeFrame(). */
  frozen?: boolean;
  /** RF-077: for a frozen clip, how long the held frame plays — its on-track duration
   *  isn't derived from outPointMs-inPointMs since it replays a single source instant. */
  holdMs?: number;
  /** RF-013: a point color correction (brightness, -100..100) applied to this clip only. */
  colorCorrection?: number;
}

export interface Track {
  id: string;
  name: string;
  kind: TrackKind;
  visible: boolean;
  locked: boolean;
  clips: Clip[];
}

export function clipDurationMs(clip: Clip): number {
  if (clip.frozen) return clip.holdMs ?? 0;
  return clip.outPointMs - clip.inPointMs;
}

export function clipEndMs(clip: Clip): number {
  return clip.startMs + clipDurationMs(clip);
}

let clipCounter = 0;
export function createClipId(): string {
  clipCounter += 1;
  return `clip_${Date.now()}_${clipCounter}`;
}

let trackCounter = 0;
export function createTrackId(): string {
  trackCounter += 1;
  return `track_${Date.now()}_${trackCounter}`;
}

export function createClip(partial: {
  name: string;
  sourceUri: string;
  color: string;
  startMs: number;
  sourceDurationMs: number;
  inPointMs?: number;
  outPointMs?: number;
}): Clip {
  return {
    id: createClipId(),
    name: partial.name,
    sourceUri: partial.sourceUri,
    color: partial.color,
    startMs: partial.startMs,
    inPointMs: partial.inPointMs ?? 0,
    outPointMs: partial.outPointMs ?? partial.sourceDurationMs,
    sourceDurationMs: partial.sourceDurationMs,
  };
}

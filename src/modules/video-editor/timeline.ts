/**
 * RF-005/RF-035/RF-013: pure timeline math — moving, trimming and splitting clips.
 * Every function here takes and returns a new `Track[]` (never mutates), which is what
 * lets VideoEditorScreen wire these straight into its undo/redo history like every other
 * editor screen in this app.
 */

import {
  type Clip,
  type Track,
  clipDurationMs,
  clipEndMs,
  createClipId,
  createTrackId,
} from './Track';

/** No clip may end up shorter than this — protects trims/splits from degenerating to nothing. */
export const MIN_CLIP_DURATION_MS = 200;

export function trackDurationMs(track: Track): number {
  return track.clips.reduce((max, c) => Math.max(max, clipEndMs(c)), 0);
}

export function timelineDurationMs(tracks: Track[]): number {
  return tracks.reduce((max, t) => Math.max(max, trackDurationMs(t)), 0);
}

function sortedClips(track: Track): Clip[] {
  return [...track.clips].sort((a, b) => a.startMs - b.startMs);
}

function replaceTrack(tracks: Track[], trackId: string, clips: Clip[]): Track[] {
  return tracks.map((t) => (t.id === trackId ? { ...t, clips } : t));
}

function findTrackAndClip(
  tracks: Track[],
  trackId: string,
  clipId: string
): { track: Track; clip: Clip } | null {
  const track = tracks.find((t) => t.id === trackId);
  const clip = track?.clips.find((c) => c.id === clipId);
  return track && clip ? { track, clip } : null;
}

/**
 * RF-005: reposition a clip (drag), clamped so it never overlaps its neighbors on the
 * same track. Dragging a clip past a neighbor's start effectively reorders them, since
 * ordering is derived from `startMs` — no separate "index" to keep in sync.
 */
export function moveClip(
  tracks: Track[],
  trackId: string,
  clipId: string,
  desiredStartMs: number
): Track[] {
  const found = findTrackAndClip(tracks, trackId, clipId);
  if (!found) return tracks;
  const { track, clip } = found;
  const duration = clipDurationMs(clip);
  const others = sortedClips(track).filter((c) => c.id !== clipId);

  let start = Math.max(0, desiredStartMs);
  // Resolve overlaps by snapping to whichever side of the blocking clip is closer to where
  // the drag wanted to land. A long drag can cross several clips, so this repeats until
  // settled (bounded by the number of other clips on the track).
  for (let pass = 0; pass < others.length + 1; pass++) {
    const blocker = others.find((c) => start < clipEndMs(c) && start + duration > c.startMs);
    if (!blocker) break;
    const beforeStart = Math.max(0, blocker.startMs - duration);
    const afterStart = clipEndMs(blocker);
    start =
      Math.abs(desiredStartMs - beforeStart) <= Math.abs(desiredStartMs - afterStart)
        ? beforeStart
        : afterStart;
  }

  const nextClips = track.clips.map((c) => (c.id === clipId ? { ...c, startMs: start } : c));
  return replaceTrack(tracks, trackId, nextClips);
}

/** RF-035: drag the clip's in-point, keeping its out-point (and therefore end time) fixed. */
export function trimClipIn(
  tracks: Track[],
  trackId: string,
  clipId: string,
  newInPointMs: number
): Track[] {
  const found = findTrackAndClip(tracks, trackId, clipId);
  if (!found) return tracks;
  const { track, clip } = found;
  const others = sortedClips(track).filter((c) => c.id !== clipId);
  const prevClip = [...others].filter((c) => clipEndMs(c) <= clip.startMs).pop();

  const maxIn = clip.outPointMs - MIN_CLIP_DURATION_MS;
  const clampedIn = Math.max(0, Math.min(newInPointMs, maxIn));
  const durationDelta = clampedIn - clip.inPointMs;
  let newStart = clip.startMs + durationDelta;
  const lowerBound = prevClip ? clipEndMs(prevClip) : 0;
  newStart = Math.max(lowerBound, newStart);
  // Re-derive the actual in-point from the clamped start so duration math stays consistent.
  const actualIn = clip.inPointMs + (newStart - clip.startMs);

  const nextClips = track.clips.map((c) =>
    c.id === clipId ? { ...c, startMs: newStart, inPointMs: actualIn } : c
  );
  return replaceTrack(tracks, trackId, nextClips);
}

/** RF-035: drag the clip's out-point, keeping its in-point (and start time) fixed. */
export function trimClipOut(
  tracks: Track[],
  trackId: string,
  clipId: string,
  newOutPointMs: number
): Track[] {
  const found = findTrackAndClip(tracks, trackId, clipId);
  if (!found) return tracks;
  const { track, clip } = found;
  const others = sortedClips(track).filter((c) => c.id !== clipId);
  const nextClip = others.find((c) => c.startMs >= clip.startMs);

  const minOut = clip.inPointMs + MIN_CLIP_DURATION_MS;
  let clampedOut = Math.max(minOut, Math.min(newOutPointMs, clip.sourceDurationMs));
  if (nextClip) {
    const maxDuration = nextClip.startMs - clip.startMs;
    clampedOut = Math.min(clampedOut, clip.inPointMs + maxDuration);
  }

  const nextClips = track.clips.map((c) =>
    c.id === clipId ? { ...c, outPointMs: clampedOut } : c
  );
  return replaceTrack(tracks, trackId, nextClips);
}

/**
 * RF-013/RF-035: split one clip into two at a given on-track timestamp. Both halves keep
 * the same source, just different in/out ranges — genuinely non-destructive.
 */
export function splitClipAtMs(
  tracks: Track[],
  trackId: string,
  clipId: string,
  atMs: number
): Track[] {
  const found = findTrackAndClip(tracks, trackId, clipId);
  if (!found) return tracks;
  const { track, clip } = found;
  const end = clipEndMs(clip);
  if (atMs <= clip.startMs + MIN_CLIP_DURATION_MS || atMs >= end - MIN_CLIP_DURATION_MS) {
    return tracks; // too close to either edge to leave two valid clips
  }

  const splitSourceMs = clip.inPointMs + (atMs - clip.startMs);
  const first: Clip = { ...clip, outPointMs: splitSourceMs };
  const second: Clip = {
    ...clip,
    id: createClipId(),
    startMs: atMs,
    inPointMs: splitSourceMs,
    transitionIn: undefined,
  };

  const nextClips = track.clips.flatMap((c) => (c.id === clipId ? [first, second] : [c]));
  return replaceTrack(tracks, trackId, nextClips);
}

/** RF-058: append a new clip immediately after the last one on the track (no gaps). */
export function appendClip(tracks: Track[], trackId: string, clip: Omit<Clip, 'startMs'>): Track[] {
  const track = tracks.find((t) => t.id === trackId);
  if (!track) return tracks;
  const startMs = trackDurationMs(track);
  return replaceTrack(tracks, trackId, [...track.clips, { ...clip, startMs }]);
}

export function removeClip(tracks: Track[], trackId: string, clipId: string): Track[] {
  const track = tracks.find((t) => t.id === trackId);
  if (!track) return tracks;
  return replaceTrack(
    tracks,
    trackId,
    track.clips.filter((c) => c.id !== clipId)
  );
}

/**
 * RF-023: a time-lapse is just a real image track — each photo becomes a short still clip,
 * played back-to-back at `photoDurationMs` each. Reuses the same Clip/Track model (and so
 * the same trim/reorder/speed/transition tools) instead of a bespoke time-lapse pipeline.
 */
export function buildTimelapseTrack(
  images: { uri: string; name: string }[],
  photoDurationMs: number,
  color: string
): Track {
  let startMs = 0;
  const clips: Clip[] = images.map((img, i) => {
    const clip: Clip = {
      id: createClipId(),
      name: img.name || `Foto ${i + 1}`,
      sourceUri: img.uri,
      color,
      startMs,
      inPointMs: 0,
      outPointMs: photoDurationMs,
      sourceDurationMs: photoDurationMs,
    };
    startMs += photoDurationMs;
    return clip;
  });

  return {
    id: createTrackId(),
    name: 'Time-lapse',
    kind: 'image',
    visible: true,
    locked: false,
    clips,
  };
}

export function findClip(tracks: Track[], clipId: string): { track: Track; clip: Clip } | null {
  for (const track of tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return { track, clip };
  }
  return null;
}

/**
 * "Ripple" edit: shift every clip on the track that starts at/after `afterMs` by `deltaMs`
 * (positive closes a gap left by a shorter clip, negative opens one for a longer clip) — the
 * classic ripple-trim behavior toggled by the timeline's Ripple tool.
 */
export function rippleShiftAfter(
  tracks: Track[],
  trackId: string,
  afterMs: number,
  deltaMs: number
): Track[] {
  if (deltaMs === 0) return tracks;
  return tracks.map((t) =>
    t.id === trackId
      ? {
          ...t,
          clips: t.clips.map((c) =>
            c.startMs >= afterMs - 1e-6 ? { ...c, startMs: Math.max(0, c.startMs + deltaMs) } : c
          ),
        }
      : t
  );
}

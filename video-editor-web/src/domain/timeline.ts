/**
 * RF-005/RF-035/RF-013: pure timeline math — moving, trimming and splitting clips.
 * Every function here takes and returns a new `Track[]` (never mutates), which is what
 * lets VideoEditorScreen wire these straight into its undo/redo history like every other
 * editor screen in this app.
 */

import { t } from '../i18n';
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

  // The free stretches of the track (between the other clips, and after the last one): the clip
  // lands in the one where it fits closest to where the drag wanted it.
  const gaps: { from: number; to: number }[] = [];
  let cursor = 0;
  for (const c of others) {
    if (c.startMs - cursor >= duration - 1e-6) gaps.push({ from: cursor, to: c.startMs });
    cursor = Math.max(cursor, clipEndMs(c));
  }
  gaps.push({ from: cursor, to: Infinity });
  let start = cursor;
  let best = Infinity;
  for (const g of gaps) {
    const at = Math.max(g.from, Math.min(desiredStartMs, g.to - duration));
    const dist = Math.abs(at - desiredStartMs);
    if (dist < best) {
      best = dist;
      start = at;
    }
  }

  const nextClips = track.clips.map((c) => (c.id === clipId ? { ...c, startMs: start } : c));
  return replaceTrack(tracks, trackId, nextClips);
}

/**
 * RF-058 with Ripple on: reorder by dragging. The clip leaves its place (the clips after it close
 * the gap) and goes where its middle is dropped: into a free stretch that fits it, or before the
 * first clip whose middle lies after its own, pushing that clip and the rest right by what it
 * needs. Nothing overlaps and the clips keep their order otherwise.
 */
export function rippleMove(
  tracks: Track[],
  trackId: string,
  clipId: string,
  desiredStartMs: number
): Track[] {
  const found = findTrackAndClip(tracks, trackId, clipId);
  if (!found) return tracks;
  const moving = found.clip;
  const duration = clipDurationMs(moving);
  const closed = rippleDelete(tracks, trackId, clipId);
  const others = sortedClips(closed.find((t) => t.id === trackId)!);
  const middle = Math.max(0, desiredStartMs) + duration / 2;
  const next = others.find((c) => c.startMs + clipDurationMs(c) / 2 > middle);
  const prevEnd = others
    .filter((c) => !next || c.startMs < next.startMs)
    .reduce((end, c) => Math.max(end, clipEndMs(c)), 0);
  const start = next
    ? Math.max(prevEnd, Math.min(Math.max(0, desiredStartMs), next.startMs))
    : Math.max(prevEnd, desiredStartMs);
  const pushed = next ? rippleShiftAfter(closed, trackId, next.startMs, Math.max(0, start + duration - next.startMs)) : closed;
  return pushed.map((t) => (t.id === trackId ? { ...t, clips: [...t.clips, { ...moving, startMs: start }] } : t));
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

  // In/out points are source ms; positions are timeline ms; `speed` converts (source per timeline).
  const speed = clip.speed ?? 1;
  const maxIn = clip.outPointMs - MIN_CLIP_DURATION_MS * speed;
  const clampedIn = Math.max(0, Math.min(newInPointMs, maxIn));
  let newStart = clip.startMs + (clampedIn - clip.inPointMs) / speed;
  const lowerBound = prevClip ? clipEndMs(prevClip) : 0;
  newStart = Math.max(lowerBound, newStart);
  // Re-derive the actual in-point from the clamped start so duration math stays consistent
  // (floored at 0: the round trip through speed can land a hair below it).
  const actualIn = Math.max(0, clip.inPointMs + (newStart - clip.startMs) * speed);

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

  const speed = clip.speed ?? 1;
  const minOut = clip.inPointMs + MIN_CLIP_DURATION_MS * speed;
  let clampedOut = Math.max(minOut, Math.min(newOutPointMs, clip.sourceDurationMs));
  if (nextClip) {
    const maxDuration = nextClip.startMs - clip.startMs;
    clampedOut = Math.min(clampedOut, clip.inPointMs + maxDuration * speed);
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

  if (clip.frozen) {
    // A held frame splits its hold time; both halves keep showing the same instant.
    const firstHold: Clip = { ...clip, holdMs: atMs - clip.startMs };
    const secondHold: Clip = {
      ...clip,
      id: createClipId(),
      startMs: atMs,
      holdMs: end - atMs,
      transitionIn: undefined,
    };
    return replaceTrack(
      tracks,
      trackId,
      track.clips.flatMap((c) => (c.id === clipId ? [firstHold, secondHold] : [c]))
    );
  }
  const splitSourceMs = clip.inPointMs + (atMs - clip.startMs) * (clip.speed ?? 1);
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
  const clampedDuration = Math.max(MIN_CLIP_DURATION_MS, photoDurationMs);
  let startMs = 0;
  const clips: Clip[] = images.map((img, i) => {
    const clip: Clip = {
      id: createClipId(),
      name: img.name || t('Foto {n}', { n: i + 1 }),
      sourceUri: img.uri,
      color,
      startMs,
      inPointMs: 0,
      outPointMs: clampedDuration,
      sourceDurationMs: clampedDuration,
    };
    startMs += clampedDuration;
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

/**
 * US-14 / RF-005: every timeline has a track for still images (V1 video, IMG image, TXT text,
 * A1 audio). Projects saved before it existed get an empty one right after their last video
 * track; a timeline that already has one is returned untouched.
 */
export function ensureImageTrack(tracks: Track[]): Track[] {
  if (tracks.some((t) => t.kind === 'image')) return tracks;
  const imageTrack: Track = {
    id: 'img',
    name: 'IMG',
    kind: 'image',
    visible: true,
    locked: false,
    clips: [],
  };
  let at = 0;
  tracks.forEach((t, i) => {
    if (t.kind === 'video') at = i + 1;
  });
  return [...tracks.slice(0, at), imageTrack, ...tracks.slice(at)];
}

/**
 * RF-049: sets a clip's speed. That changes its length on the track, so every later clip on the
 * same track moves by the difference (push/pull): none overlap, gaps between them are kept.
 */
export function setClipSpeed(
  tracks: Track[],
  trackId: string,
  clipId: string,
  speed: number
): Track[] {
  const found = findClip(tracks, clipId);
  if (!found || found.track.id !== trackId) return tracks;
  // Too fast would leave a clip shorter than the minimum a clip can be.
  speed = Math.min(speed, (found.clip.outPointMs - found.clip.inPointMs) / MIN_CLIP_DURATION_MS);
  const oldEnd = clipEndMs(found.clip);
  const delta = clipEndMs({ ...found.clip, speed }) - oldEnd;
  const changed = tracks.map((t) =>
    t.id === trackId
      ? { ...t, clips: t.clips.map((c) => (c.id === clipId ? { ...c, speed } : c)) }
      : t
  );
  return rippleShiftAfter(changed, trackId, oldEnd, delta);
}

/** The clip shown at `timeMs`: the topmost visible video/image track wins (later track = higher layer). */
export function topClipAt(tracks: readonly Track[], timeMs: number): Clip | null {
  const media = tracks.filter((t) => (t.kind === 'video' || t.kind === 'image') && t.visible);
  // Lookup is end-exclusive; at/after the very end hold the last frame instead of going black.
  const end = media.reduce((max, t) => Math.max(max, trackDurationMs(t)), 0);
  const at = end > 0 && timeMs === end ? end - 0.001 : timeMs;
  for (let i = media.length - 1; i >= 0; i -= 1) {
    const clip = media[i].clips.find((c) => at >= c.startMs && at < clipEndMs(c));
    if (clip) return clip;
  }
  return null;
}

/**
 * Ripple trims (Vegas "auto ripple" on the edited track): the clip keeps its start, its length
 * changes, and every clip after it on the track moves by the same amount (gaps between them
 * kept). It can grow into the next clip's place, pushing it, unlike a plain trim.
 */
export function rippleTrim(
  tracks: Track[],
  trackId: string,
  clipId: string,
  edge: 'in' | 'out',
  pointMs: number
): Track[] {
  const found = findTrackAndClip(tracks, trackId, clipId);
  if (!found || found.clip.frozen) return tracks;
  const { clip } = found;
  const speed = clip.speed ?? 1;
  const minLen = MIN_CLIP_DURATION_MS * speed;
  const next =
    edge === 'out'
      ? { ...clip, outPointMs: Math.max(clip.inPointMs + minLen, Math.min(pointMs, clip.sourceDurationMs)) }
      : { ...clip, inPointMs: Math.max(0, Math.min(pointMs, clip.outPointMs - minLen)) };
  const oldEnd = clipEndMs(clip);
  const delta = clipEndMs(next) - oldEnd;
  return tracks.map((t) =>
    t.id === trackId
      ? {
          ...t,
          clips: t.clips.map((c) =>
            c.id === clipId
              ? next
              : c.startMs >= oldEnd - 1e-6
                ? { ...c, startMs: Math.max(0, c.startMs + delta) }
                : c
          ),
        }
      : t
  );
}

/** Ripple delete: removes the clip and moves what came after it on its track back by its length. */
export function rippleDelete(tracks: Track[], trackId: string, clipId: string): Track[] {
  const found = findTrackAndClip(tracks, trackId, clipId);
  if (!found) return tracks;
  const end = clipEndMs(found.clip);
  return rippleShiftAfter(removeClip(tracks, trackId, clipId), trackId, end, -clipDurationMs(found.clip));
}

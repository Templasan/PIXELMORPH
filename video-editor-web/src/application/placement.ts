import { clipEndMs, type Track } from '../domain/Track';
import { addPictureTrack } from '../domain/timeline';
import { createTrackId } from '../domain/Track';

const isFree = (track: Track, startMs: number, durationMs: number) =>
  track.clips.every((c) => startMs + durationMs <= c.startMs || startMs >= clipEndMs(c));

const isSound = (kind: Track['kind']) => kind === 'audio';

function addSoundTrack(tracks: Track[]): { tracks: Track[]; trackId: string } {
  const n = tracks.filter((t) => isSound(t.kind)).length + 1;
  const track: Track = { id: createTrackId(), name: `A${n}`, kind: 'audio', visible: true, locked: false, clips: [] };
  return { tracks: [...tracks, track], trackId: track.id };
}

/** A track over everything there is: the top one if it is still empty, else a new one. */
export function newLayer(tracks: Track[]): { tracks: Track[]; trackId: string } {
  const top = tracks.filter((t) => !isSound(t.kind)).at(-1);
  if (top && !top.locked && top.clips.length === 0) return { tracks, trackId: top.id };
  const trackId = createTrackId();
  return { tracks: addPictureTrack(tracks, trackId), trackId };
}

/**
 * Where a picture, text or sound added at the playhead goes. Sound: any sound track with room.
 * A picture: the highest track, as long as nothing above it plays over that stretch and would
 * cover it; otherwise a new track on top. Either way the clip starts exactly at the playhead.
 */
export function placeAtPlayhead(
  tracks: Track[],
  kind: Track['kind'],
  atMs: number,
  durationMs: number
): { tracks: Track[]; trackId: string } {
  if (isSound(kind)) {
    const free = tracks.find((t) => isSound(t.kind) && !t.locked && isFree(t, atMs, durationMs));
    return free ? { tracks, trackId: free.id } : addSoundTrack(tracks);
  }
  for (const t of [...tracks].reverse()) {
    if (isSound(t.kind)) continue;
    if (!isFree(t, atMs, durationMs)) break;
    if (!t.locked) return { tracks, trackId: t.id };
  }
  return newLayer(tracks);
}

/** The main video track (the first one), created when there is none. */
export function mainTrack(tracks: Track[]): { tracks: Track[]; trackId: string } {
  const found = tracks.find((t) => t.kind === 'video' && !t.locked);
  return found ? { tracks, trackId: found.id } : newLayer(tracks);
}

/** First free start at or after `atMs` on the track where `durationMs` fits. */
export function freeStart(track: Track, atMs: number, durationMs: number): number {
  let start = atMs;
  for (const c of [...track.clips].sort((a, b) => a.startMs - b.startMs)) {
    if (start + durationMs <= c.startMs) break;
    if (start < clipEndMs(c)) start = clipEndMs(c);
  }
  return start;
}

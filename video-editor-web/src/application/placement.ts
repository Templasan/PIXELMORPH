import { clipEndMs, createTrackId, type Track } from '../domain/Track';

const BASE_NAMES: Record<Track['kind'], string> = { video: 'V', image: 'IMG', text: 'TXT', audio: 'A' };

function newTrack(tracks: Track[], kind: Track['kind']): Track {
  const n = tracks.filter((t) => t.kind === kind).length + 1;
  const base = BASE_NAMES[kind];
  return {
    id: createTrackId(),
    name: kind === 'video' || kind === 'audio' ? `${base}${n}` : n > 1 ? `${base} ${n}` : base,
    kind,
    visible: true,
    locked: false,
    clips: [],
  };
}

const isFree = (track: Track, startMs: number, durationMs: number) =>
  track.clips.every((c) => startMs + durationMs <= c.startMs || startMs >= clipEndMs(c));

/**
 * Where a picture, text or sound added at the playhead goes: the first track of its kind with
 * room there; when all are busy, a new track of that kind right above the last one (so the clip
 * starts exactly at the playhead instead of being pushed to the end).
 */
export function placeAtPlayhead(
  tracks: Track[],
  kind: Track['kind'],
  atMs: number,
  durationMs: number
): { tracks: Track[]; trackId: string } {
  const free = tracks.find((t) => t.kind === kind && !t.locked && isFree(t, atMs, durationMs));
  if (free) return { tracks, trackId: free.id };
  const track = newTrack(tracks, kind);
  let at = tracks.length;
  tracks.forEach((t, i) => {
    if (t.kind === kind) at = i + 1;
  });
  return { tracks: [...tracks.slice(0, at), track, ...tracks.slice(at)], trackId: track.id };
}

/** The main video track (the first one), created when there is none. */
export function mainTrack(tracks: Track[]): { tracks: Track[]; trackId: string } {
  const found = tracks.find((t) => t.kind === 'video');
  if (found) return { tracks, trackId: found.id };
  const track = newTrack(tracks, 'video');
  return { tracks: [track, ...tracks], trackId: track.id };
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

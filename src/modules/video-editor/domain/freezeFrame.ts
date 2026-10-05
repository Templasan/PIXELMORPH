/**
 * RF-077: hold a specific frame static for a few seconds before playback resumes. Splits
 * the clip at the chosen instant and inserts a zero-motion segment between the two halves,
 * pushing every later clip on the track (and any clip on another track that starts after
 * the freeze point) back by the hold duration — the timeline stays continuous.
 */

import { type Track, clipEndMs, createClipId } from './Track';
import { splitClipAtMs, MIN_CLIP_DURATION_MS } from './timeline';

export function insertFreezeFrame(
  tracks: Track[],
  trackId: string,
  clipId: string,
  atMs: number,
  holdMs: number
): Track[] {
  const afterSplit = splitClipAtMs(tracks, trackId, clipId, atMs);
  if (afterSplit === tracks) return tracks; // split rejected (too close to a clip edge)

  const track = afterSplit.find((t) => t.id === trackId);
  if (!track) return tracks;
  const firstHalf = track.clips.find((c) => c.id === clipId);
  if (!firstHalf) return tracks;
  const splitPointMs = clipEndMs(firstHalf);

  const frozenClip = {
    id: createClipId(),
    name: `${firstHalf.name} (congelado)`,
    sourceUri: firstHalf.sourceUri,
    color: firstHalf.color,
    startMs: splitPointMs,
    inPointMs: firstHalf.outPointMs,
    outPointMs: firstHalf.outPointMs,
    sourceDurationMs: firstHalf.sourceDurationMs,
    frozen: true,
    holdMs: Math.max(MIN_CLIP_DURATION_MS, holdMs),
  };

  return afterSplit.map((t) => {
    if (t.id !== trackId) {
      // Ripple every clip on other tracks that starts at/after the freeze point too, so
      // parallel tracks (text, audio) stay in sync with the now-longer video track.
      return {
        ...t,
        clips: t.clips.map((c) =>
          c.startMs >= splitPointMs ? { ...c, startMs: c.startMs + frozenClip.holdMs! } : c
        ),
      };
    }
    return {
      ...t,
      clips: [
        ...t.clips.map((c) =>
          c.startMs >= splitPointMs ? { ...c, startMs: c.startMs + frozenClip.holdMs! } : c
        ),
        frozenClip,
      ],
    };
  });
}

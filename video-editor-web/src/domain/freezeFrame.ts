/**
 * RF-077: hold a specific frame static for a few seconds before playback resumes. Splits
 * the clip at the chosen instant and inserts a zero-motion segment between the two halves,
 * pushing every later clip on the SAME track back by the hold duration, like a speed change.
 * Other tracks stay where they are: moving only the clips that start after the freeze point
 * left a photo or song that spans it out of step with the rest.
 */

import { t } from '../i18n';
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
    name: t('{name} (congelado)', { name: firstHalf.name }),
    sourceUri: firstHalf.sourceUri,
    color: firstHalf.color,
    startMs: splitPointMs,
    inPointMs: firstHalf.outPointMs,
    outPointMs: firstHalf.outPointMs,
    sourceDurationMs: firstHalf.sourceDurationMs,
    frozen: true,
    holdMs: Math.max(MIN_CLIP_DURATION_MS, holdMs),
  };

  return afterSplit.map((t) =>
    t.id !== trackId
      ? t
      : {
          ...t,
          clips: [
            ...t.clips.map((c) =>
              c.startMs >= splitPointMs ? { ...c, startMs: c.startMs + frozenClip.holdMs! } : c
            ),
            frozenClip,
          ],
        }
  );
}

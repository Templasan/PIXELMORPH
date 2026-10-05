/**
 * RF-049: smooth speed change. A clip only has one `speed`, so a ramp is built lazily as N short
 * consecutive clips (same source, consecutive in/out ranges) whose speeds step linearly between
 * the clip's speed and the target. Export-compatible: it just sees ordinary clips.
 */
import { type Clip, type Track, clipEndMs, createClipId } from './Track';
import { MIN_CLIP_DURATION_MS, rippleShiftAfter } from './timeline';

export const SPEED_RAMP_STEPS = 4;

/**
 * Ramps the first (`start`) or last (`end`) `rampMs` of on-track time between the clip's current
 * speed and `targetSpeed`. Later clips on the track shift by the duration change. Returns the
 * same tracks when the clip is frozen/missing or the stretch is too short to split.
 */
export function applySpeedRamp(
  tracks: Track[],
  trackId: string,
  clipId: string,
  targetSpeed: number,
  rampMs: number,
  edge: 'start' | 'end',
  steps: number = SPEED_RAMP_STEPS
): Track[] {
  const track = tracks.find((t) => t.id === trackId);
  const clip = track?.clips.find((c) => c.id === clipId);
  if (!track || !clip || clip.frozen) return tracks;

  const s0 = clip.speed ?? 1;
  if (s0 === targetSpeed) return tracks;
  const srcLen = clip.outPointMs - clip.inPointMs;
  if (srcLen <= 0 || rampMs <= 0) return tracks;
  const span = Math.max(0, Math.min(
    (rampMs * (s0 + targetSpeed)) / 2,
    srcLen - MIN_CLIP_DURATION_MS * s0 // remainder must stay a valid clip
  ));
  if (span / steps < MIN_CLIP_DURATION_MS * Math.max(s0, targetSpeed)) return tracks;

  const chunk = span / steps;
  const rampSegs = Array.from({ length: steps }, (_, i) => {
    const k = edge === 'end' ? i : steps - 1 - i;
    return { len: chunk, speed: s0 + ((targetSpeed - s0) * (k + 0.5)) / steps };
  });
  const rest = { len: srcLen - span, speed: s0 };
  const segs = edge === 'end' ? [rest, ...rampSegs] : [...rampSegs, rest];

  let src = clip.inPointMs;
  let start = clip.startMs;
  const pieces: Clip[] = segs.map((seg, i) => {
    const piece: Clip = {
      ...clip,
      id: i === 0 ? clip.id : createClipId(),
      transitionIn: i === 0 ? clip.transitionIn : undefined,
      startMs: start,
      inPointMs: src,
      outPointMs: src + seg.len,
      speed: seg.speed,
    };
    src += seg.len;
    start = clipEndMs(piece);
    return piece;
  });

  const shifted = rippleShiftAfter(tracks, trackId, clipEndMs(clip), start - clipEndMs(clip));
  return shifted.map((t) =>
    t.id === trackId ? { ...t, clips: t.clips.flatMap((c) => (c.id === clipId ? pieces : [c])) } : t
  );
}

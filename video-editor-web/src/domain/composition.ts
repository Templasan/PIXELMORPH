import { clipDurationMs, clipEndMs, clipMedia, type Clip, type Track, type TrackBlend } from './Track';
import { clampTransitionMs, effectiveMode, transitionTransforms } from './transitions';
import { captionAt, type TextAlign } from './textCaption';
import type { AudioSpan } from './webScene';

/**
 * What the finished video shows at an instant, as layers drawn bottom to top. ONE answer for the
 * live preview, seeks and the export (they all call `opsAt`), so they cannot disagree. Pure.
 *
 * Rules:
 *  - Every visible track that is not for sound is a layer, whatever it holds (videos, pictures,
 *    texts); a track later in the list is drawn above an earlier one. Sound tracks draw nothing.
 *  - A clip shows from its start (inclusive) to its end (exclusive). Empty time on the bottom
 *    media track is black; on upper tracks it is transparent (the layers below show through).
 *  - A clip covers the frame (fitted inside, keeping its shape) unless it has a PiP box. A `cover`
 *    composition (a social preset of another shape) crops every clip to fill the frame instead.
 *  - A transition into a clip plays during the clip's first `durationMs`, only when the previous
 *    clip on the same track ends where this one starts. The outgoing clip keeps playing during it
 *    (it reads past its out point while the source has frames, then holds its last frame).
 *  - A layer's look is its track's opacity times its clip's; its clip's blend, else its track's.
 *  - Sound: every visible video clip's own audio plus every audio-track clip, all mixed.
 *  - The video lasts until its last picture (video, photo or text) ends; sound past it is cut.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where a clip landed in the frame, before a text's turn (`rotation`) about its centre. */
export interface Box extends Rect {
  rotation: number;
  /** Height / width of the whole turned picture, cropped parts included; none for a text. */
  aspect?: number;
}

export interface MediaOp {
  kind: 'video' | 'image';
  /**
   * Stable per clip: one decoder slot each, so clips never share or swap frames. The outgoing
   * side of a transition is the same clip carrying on, so it keeps its slot (no decoder opens at
   * the junction).
   */
  key: string;
  clipId: string;
  /** 'out': the previous clip still showing during a transition into the next one. */
  role: 'in' | 'out';
  uri: string;
  /** Video only: the source instant to show. */
  sourceTimeMs: number;
  rect: Rect;
  fit: 'contain' | 'cover';
  /** PiP window: `rect.w` is the width, the height follows the picture; placed at rect.x/y. */
  window: boolean;
  opacity: number;
  translateX: number;
  scale: number;
  rotationDeg: number;
  /** Canvas brightness factor (1 = unchanged), from the clip's colour correction. */
  brightness: number;
  blend: TrackBlend;
}

export interface CaptionOp {
  kind: 'caption';
  clipId: string;
  text: string;
  /** All of the text, while `text` may be what a typewriter has shown so far. */
  content: string;
  cx: number;
  cy: number;
  offsetY: number;
  fontPx: number;
  fontFamily: string;
  color: string;
  strokeColor: string;
  strokePx: number;
  shadow: boolean;
  scale: number;
  opacity: number;
  blend: TrackBlend;
  align: TextAlign;
  rotationDeg: number;
}

export type CompositionOp = { kind: 'clear'; color: string } | MediaOp | CaptionOp;

interface MediaLayer {
  trackId: string;
  kind: Track['kind'];
  /** 0..1 */
  opacity: number;
  blend: TrackBlend;
  /** Sorted by start. */
  clips: Clip[];
}

export interface Composition {
  width: number;
  height: number;
  /** Every picture fills the frame (cropped), not only the clips marked `fill`. */
  cover: boolean;
  durationMs: number;
  layers: MediaLayer[];
  audio: AudioSpan[];
}

export interface CompositionOptions {
  width?: number;
  height?: number;
  cover?: boolean;
  /** The file to decode for a clip's source (a preview proxy); default: the source itself. */
  mapUri?: (sourceUri: string) => string;
}

/** Last frame a video clip may show: just before its out point (that instant is the next clip's). */
const FRAME_EPSILON_MS = 1;

/**
 * The video ends with its last picture (video, photo or text): a song longer than the video is
 * cut there. A timeline with only sound lasts as long as the sound.
 */
export function compositionDurationMs(tracks: readonly Track[]): number {
  let picture = 0;
  let sound = 0;
  for (const t of tracks) {
    if (!t.visible) continue;
    for (const c of t.clips) {
      if (t.kind === 'audio') sound = Math.max(sound, clipEndMs(c));
      else picture = Math.max(picture, clipEndMs(c));
    }
  }
  return picture > 0 ? picture : sound;
}

export function buildComposition(
  tracks: readonly Track[],
  opts: CompositionOptions = {}
): Composition {
  const map = opts.mapUri ?? ((u: string) => u);
  const visible = tracks.filter((t) => t.visible);
  const layers: MediaLayer[] = visible
    .filter((t) => t.kind !== 'audio')
    .map((t) => ({
      trackId: t.id,
      kind: t.kind,
      opacity: (t.opacity ?? 100) / 100,
      blend: t.blend ?? 'source-over',
      clips: [...t.clips]
        .sort((a, b) => a.startMs - b.startMs)
        .map((c) => ({ ...c, sourceUri: map(c.sourceUri) })),
    }));
  return {
    width: opts.width ?? 1920,
    height: opts.height ?? 1080,
    cover: opts.cover ?? false,
    durationMs: compositionDurationMs(tracks),
    layers,
    // Sound is read from the originals: a proxy may have none or a different codec.
    audio: audioSpans(visible),
  };
}

function audioSpans(tracks: readonly Track[]): AudioSpan[] {
  const spans: AudioSpan[] = [];
  for (const t of tracks) {
    for (const c of t.clips) {
      const media = clipMedia(t, c);
      if (c.frozen || (media !== 'video' && media !== 'audio')) continue;
      const volume = (c.volume ?? 100) / 100;
      const outputMs = clipDurationMs(c);
      if (volume <= 0 || outputMs <= 0) continue;
      spans.push({
        uri: c.sourceUri,
        startMs: c.startMs,
        outputMs,
        inMs: c.inPointMs,
        speed: c.speed ?? 1,
        volume,
        fadeInMs: Math.max(0, Math.min(c.fadeInMs ?? 0, outputMs)),
        fadeOutMs: Math.max(0, Math.min(c.fadeOutMs ?? 0, outputMs)),
      });
    }
  }
  return spans.sort((a, b) => a.startMs - b.startMs);
}

/** The clip of `clips` (sorted) showing at `t`, end-exclusive. */
function clipAt(clips: readonly Clip[], t: number): number {
  for (let i = clips.length - 1; i >= 0; i -= 1) {
    const c = clips[i];
    if (t >= c.startMs && t < clipEndMs(c)) return i;
  }
  return -1;
}

/** Source instant of `clip` at timeline time `t` (may run past the out point for a transition). */
function sourceTimeOf(clip: Clip, t: number): number {
  if (clip.frozen) return clip.inPointMs;
  const raw = clip.inPointMs + (t - clip.startMs) * (clip.speed ?? 1);
  return Math.max(0, Math.min(raw, clip.sourceDurationMs - FRAME_EPSILON_MS));
}

function rectOf(clip: Clip, w: number, h: number): Rect {
  if (clip.pipPosition && clip.pipSize) {
    return {
      x: clip.pipPosition.x * w,
      y: clip.pipPosition.y * h,
      w: clip.pipSize.width * w,
      h: clip.pipSize.height * h,
    };
  }
  return { x: 0, y: 0, w, h };
}

function mediaOp(
  c: Composition,
  layer: MediaLayer,
  clip: Clip,
  t: number,
  role: 'in' | 'out',
  transform: { opacity: number; translateX: number; scale: number }
): MediaOp {
  const cc = clip.colorCorrection ?? 0;
  const image = clipMedia(layer, clip) === 'image';
  return {
    kind: image ? 'image' : 'video',
    key: `${layer.trackId}:${clip.id}`,
    clipId: clip.id,
    role,
    uri: clip.sourceUri,
    sourceTimeMs: image ? 0 : role === 'out' ? sourceTimeOf(clip, t) : clampIn(clip, t),
    rect: rectOf(clip, c.width, c.height),
    fit: c.cover || clip.fill ? 'cover' : 'contain',
    window: !!clip.pipSize,
    opacity: transform.opacity * layer.opacity * ((clip.opacity ?? 100) / 100),
    translateX: transform.translateX,
    scale: transform.scale,
    rotationDeg: clip.rotation ?? 0,
    brightness: 1 + Math.max(-100, Math.min(100, cc)) / 200,
    blend: clip.blend ?? layer.blend,
  };
}

/** Inside its own span a clip never shows a frame past its out point. */
function clampIn(clip: Clip, t: number): number {
  if (clip.frozen) return clip.inPointMs;
  const s = sourceTimeOf(clip, t);
  return Math.min(s, clip.outPointMs - FRAME_EPSILON_MS);
}

const NO_TRANSFORM = { opacity: 1, translateX: 0, scale: 1 };

/** Every draw op at timeline time `t`, bottom to top. */
export function opsAt(c: Composition, t: number): CompositionOp[] {
  const ops: CompositionOp[] = [{ kind: 'clear', color: '#000000' }];
  if (t < 0 || t >= c.durationMs) return ops;
  for (const layer of c.layers) {
    const i = clipAt(layer.clips, t);
    if (i < 0) continue;
    const clip = layer.clips[i];
    if (clip.text) {
      const st = captionAt(clip.text, clip.startMs, clipDurationMs(clip), t, c.width, c.height);
      if (!st) continue;
      ops.push({
        kind: 'caption',
        clipId: clip.id,
        ...st,
        opacity: st.opacity * layer.opacity * ((clip.opacity ?? 100) / 100),
        content: clip.text.content,
        fontFamily: clip.text.fontFamily,
        color: clip.text.color,
        strokeColor: clip.text.strokeColor,
        strokePx: clip.text.strokeWidth * st.fontPx,
        shadow: clip.text.shadow,
        blend: clip.blend ?? layer.blend,
        align: clip.text.align ?? 'center',
        rotationDeg: clip.text.rotation ?? 0,
      });
      continue;
    }
    const prev = layer.clips[i - 1];
    const spec = clip.transitionIn;
    if (spec && prev && !prev.text && Math.abs(clipEndMs(prev) - clip.startMs) < 1) {
      const d = clampTransitionMs(spec.durationMs, clipDurationMs(prev), clipDurationMs(clip));
      if (d > 0 && t < clip.startMs + d) {
        const mode = effectiveMode(spec.type, spec.mode);
        const tf = transitionTransforms(spec.type, mode, (t - clip.startMs) / d, c.width);
        ops.push(mediaOp(c, layer, clip, t, 'in', tf.incoming));
        ops.push(mediaOp(c, layer, prev, t, 'out', tf.outgoing));
        continue;
      }
    }
    ops.push(mediaOp(c, layer, clip, t, 'in', NO_TRANSFORM));
  }
  return ops;
}

/**
 * The media that must be ready around `t`: what shows now plus what starts within `aheadMs`
 * (so decoders open and seek before a clip appears, instead of the clip popping in late).
 */
export function mediaAround(c: Composition, t: number, aheadMs: number): MediaOp[] {
  const seen = new Map<string, MediaOp>();
  const at = (time: number) => {
    for (const op of opsAt(c, time)) {
      if ((op.kind === 'video' || op.kind === 'image') && !seen.has(op.key)) seen.set(op.key, op);
    }
  };
  at(t);
  for (const layer of c.layers) {
    for (const clip of layer.clips) {
      if (clip.startMs > t && clip.startMs <= t + aheadMs) at(clip.startMs);
    }
  }
  return [...seen.values()];
}

/** Video layers a device decodes at once while playing, by its memory (a coarse bucket, in GB). */
export function liveLayerCap(deviceMemoryGb: number | undefined): number {
  if (deviceMemoryGb === undefined) return 4;
  return deviceMemoryGb <= 3 ? 2 : deviceMemoryGb <= 6 ? 4 : 8;
}

/**
 * The video layers that keep decoding while playing when there are more than `cap`: the biggest
 * on screen (a frozen background shows most), the upper one on a tie. The others hold their frame
 * until the playback stops. Only the preview does this: the export always decodes every layer.
 */
export function liveLayerKeys(ops: readonly CompositionOp[], cap: number): Set<string> {
  const videos = ops.filter((o): o is MediaOp => o.kind === 'video');
  const ranked = videos
    .map((op, i) => ({ op, i }))
    .sort((a, b) => b.op.rect.w * b.op.rect.h - a.op.rect.w * a.op.rect.h || b.i - a.i);
  return new Set(ranked.slice(0, cap).map(({ op }) => op.key));
}

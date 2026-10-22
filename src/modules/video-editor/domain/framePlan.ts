import { clipDurationMs, type Clip, type Track } from './Track';
import { clampTransitionMs } from './transitions';

/**
 * ONE answer to "what is on screen at time t", shared by the live preview and the mp4 export so
 * they cannot drift apart. Pure (no native imports) so it is testable in Jest.
 *
 * Rules (the export's, which the preview now follows):
 *  - Only visible video and image tracks count; where tracks overlap in time the topmost track
 *    (later in the list) wins, a clip hidden in the middle is split around the one on top.
 *  - Gaps are REAL: empty time between clips (or before the first one) is a black "gap" piece,
 *    in the preview and in the mp4 alike; time after the last clip is not part of the video.
 *    Every piece sits at its timeline position, so the playhead time is the timeline time.
 *  - A transition into a piece never outlasts half of either neighbouring piece (the lengths
 *    that are actually shown) and never shortens the video; none plays across a gap.
 */

export interface PlannedClip {
  /**
   * "video": a range of the source file. "still": one frame of a video held for `holdMs`.
   * "image": the source file is a picture (image track), shown for `holdMs`.
   * "gap": empty time, black for `holdMs` (no source).
   */
  kind: 'video' | 'still' | 'image' | 'gap';
  /** The editor clip this piece comes from (a clip can yield several pieces). */
  clipId: string;
  sourceUri: string;
  inMs: number;
  outMs: number;
  /** For "still": the instant of the source to freeze, in ms. */
  stillTimeMs: number;
  holdMs: number;
  speed: number;
  /** Gain of the clip's own audio, 0..1. */
  volume: number;
  rotation: number;
  /** How the clip begins ('' = plain cut) and for how long, in finished-video ms. */
  transitionIn: '' | 'fade' | 'slide' | 'zoom' | 'wipe';
  transitionInMs: number;
  /** The frame of the previous clip that is laid over this one while the transition plays. */
  transitionFrom: {
    sourceUri: string;
    timeMs: number;
    rotation: number;
    /** The source is a picture already: use it as is instead of extracting a video frame. */
    image: boolean;
  } | null;
  /** Length of this clip in the finished video. */
  outputMs: number;
  /** Where this clip starts in the finished video. */
  startMs: number;
}

/** A transition at the junction into a clip; used to describe the export to the user. */
export interface PlannedTransition {
  type: 'fade' | 'slide' | 'zoom' | 'wipe';
  /** Where the incoming clip starts on the finished video. */
  atMs: number;
  durationMs: number;
}

export interface SequencePlan {
  clips: PlannedClip[];
  transitions: PlannedTransition[];
  /** Length of the finished video. */
  durationMs: number;
}

/** Spans shorter than this are float noise between clip edges. */
const MIN_SPAN_MS = 1;

interface Segment {
  /** null: a gap. */
  clip: Clip | null;
  image: boolean;
  startMs: number;
  endMs: number;
}

/** The visible clip at `atMs`: topmost track wins, then the latest-starting clip on it. */
function clipOnTop(layers: { image: boolean; clips: Clip[] }[], atMs: number) {
  for (let i = layers.length - 1; i >= 0; i -= 1) {
    const { clips, image } = layers[i];
    for (let j = clips.length - 1; j >= 0; j -= 1) {
      const c = clips[j];
      if (atMs >= c.startMs && atMs < c.startMs + clipDurationMs(c)) return { clip: c, image };
    }
  }
  return null;
}

function toSegments(tracks: readonly Track[]): Segment[] {
  const layers = tracks
    .filter((t) => (t.kind === 'video' || t.kind === 'image') && t.visible && t.clips.length > 0)
    .map((t) => ({
      image: t.kind === 'image',
      clips: [...t.clips].sort((a, b) => a.startMs - b.startMs),
    }));
  const cuts = new Set<number>();
  for (const { clips } of layers) {
    for (const c of clips) {
      cuts.add(c.startMs);
      cuts.add(c.startMs + clipDurationMs(c));
    }
  }
  if (cuts.size > 0) cuts.add(0); // time before the first clip is a (leading) gap
  const points = [...cuts].sort((a, b) => a - b);
  const segments: Segment[] = [];
  for (let i = 0; i + 1 < points.length; i += 1) {
    const [a, b] = [points[i], points[i + 1]];
    if (b - a < MIN_SPAN_MS) continue;
    const hit = clipOnTop(layers, (a + b) / 2) ?? { clip: null, image: false };
    const last = segments[segments.length - 1];
    if (last && last.clip === hit.clip && a - last.endMs < MIN_SPAN_MS) last.endMs = b;
    else segments.push({ ...hit, startMs: a, endMs: b });
  }
  return segments;
}

function toPlanned({ clip, image, startMs, endMs }: Segment): PlannedClip {
  const length = endMs - startMs;
  if (!clip) {
    return {
      kind: 'gap',
      clipId: '',
      sourceUri: '',
      inMs: 0,
      outMs: 0,
      stillTimeMs: 0,
      holdMs: length,
      speed: 1,
      volume: 1,
      rotation: 0,
      transitionIn: '',
      transitionInMs: 0,
      transitionFrom: null,
      outputMs: length,
      startMs: 0,
    };
  }
  const base = {
    clipId: clip.id,
    sourceUri: clip.sourceUri,
    rotation: clip.rotation ?? 0,
    transitionIn: '' as const,
    transitionInMs: 0,
    transitionFrom: null,
    outputMs: length,
    startMs: 0,
  };
  if (image || clip.frozen) {
    return {
      ...base,
      kind: image ? 'image' : 'still',
      inMs: 0,
      outMs: 0,
      stillTimeMs: image ? 0 : clip.inPointMs,
      holdMs: length,
      speed: 1,
      volume: 1,
    };
  }
  const speed = clip.speed ?? 1;
  const atHead = startMs - clip.startMs < MIN_SPAN_MS;
  const atTail = clip.startMs + clipDurationMs(clip) - endMs < MIN_SPAN_MS;
  const inMs = atHead ? clip.inPointMs : clip.inPointMs + (startMs - clip.startMs) * speed;
  return {
    ...base,
    kind: 'video',
    inMs,
    outMs: atTail ? clip.outPointMs : inMs + length * speed,
    stillTimeMs: 0,
    holdMs: 0,
    speed,
    volume: (clip.volume ?? 100) / 100,
  };
}

/** The finished video: the visible media laid back to back, with transitions resolved. */
export function planSequence(tracks: readonly Track[]): SequencePlan {
  const kept = toSegments(tracks)
    .map((segment) => ({ segment, piece: toPlanned(segment) }))
    .filter(({ piece }) => piece.kind !== 'video' || piece.outMs > piece.inMs);
  const clips = kept.map(({ piece }) => piece);
  const transitions: PlannedTransition[] = [];
  let atMs = 0;
  kept.forEach(({ segment }, index) => {
    const piece = clips[index];
    piece.startMs = atMs;
    const spec = segment.clip?.transitionIn;
    const out = clips[index - 1];
    const isHead = !!segment.clip && segment.startMs - segment.clip.startMs < MIN_SPAN_MS;
    if (out && out.kind !== 'gap' && spec && isHead) {
      const durationMs = clampTransitionMs(spec.durationMs, out.outputMs, piece.outputMs);
      if (durationMs > 0) {
        transitions.push({ type: spec.type, atMs, durationMs });
        piece.transitionIn = spec.type;
        piece.transitionInMs = durationMs;
        piece.transitionFrom = {
          sourceUri: out.sourceUri,
          // A still holds its own instant; a video leaves on (almost) its last frame.
          timeMs: out.kind === 'video' ? Math.max(out.inMs, out.outMs - 50) : out.stillTimeMs,
          rotation: out.rotation,
          image: out.kind === 'image',
        };
      }
    }
    atMs += piece.outputMs;
  });
  return { clips, transitions, durationMs: atMs };
}

export interface FrameTransition {
  type: 'fade' | 'slide' | 'zoom' | 'wipe';
  /** 0 (just started: only the outgoing frame) .. 1 (done: only the incoming clip). */
  progress: number;
  from: NonNullable<PlannedClip['transitionFrom']>;
}

export interface Frame {
  piece: PlannedClip;
  index: number;
  /** Position inside `piece.sourceUri` to show, in ms (a still/image has a fixed one). */
  sourceTimeMs: number;
  transition: FrameTransition | null;
}

/** Source-file position at `timeMs` of the finished video, inside `piece`. */
export function sourceTimeIn(piece: PlannedClip, timeMs: number): number {
  if (piece.kind === 'still') return piece.stillTimeMs;
  if (piece.kind === 'image' || piece.kind === 'gap') return 0;
  return Math.min(piece.outMs, piece.inMs + (timeMs - piece.startMs) * piece.speed);
}

/** What is on screen at `timeMs`. The very end holds the last frame; past it, nothing. */
export function frameAt(plan: SequencePlan, timeMs: number): Frame | null {
  const { clips, durationMs } = plan;
  if (clips.length === 0 || timeMs < 0 || timeMs > durationMs) return null;
  let index = clips.findIndex((c) => timeMs >= c.startMs && timeMs < c.startMs + c.outputMs);
  if (index < 0) index = clips.length - 1; // timeMs === durationMs
  const piece = clips[index];
  const into = timeMs - piece.startMs;
  const transition =
    piece.transitionIn && piece.transitionFrom && into < piece.transitionInMs
      ? {
          type: piece.transitionIn,
          progress: Math.max(0, into) / piece.transitionInMs,
          from: piece.transitionFrom,
        }
      : null;
  return { piece, index, sourceTimeMs: sourceTimeIn(piece, timeMs), transition };
}

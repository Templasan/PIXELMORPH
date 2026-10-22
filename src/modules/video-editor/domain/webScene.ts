import type { Track } from './Track';
import { frameAt, planSequence, type SequencePlan } from './framePlan';
import { planExport, type PlannedAudio } from './exportPlan';
import { transitionTransforms } from './transitions';

/**
 * SPIKE: a serialisable scene + ONE pure function (`drawListAt`) that says what to draw at an
 * instant. The web engine uses it for the live preview AND for the frame-by-frame export, so the
 * two cannot drift. No DOM / RN / Skia imports.
 */

export interface Keyframe {
  tMs: number;
  v: number;
  /** Ease the segment that ENDS at this key ("out" = cubic ease-out). Default linear. */
  ease?: 'out';
}

export interface PipLayer {
  id: string;
  uri: string;
  /** Destination box in canvas px; the video is fitted ("contain") inside it. */
  rect: Rect;
  opacity: number;
  /** Source time at scene time 0; the source loops when it runs out. */
  sourceOffsetMs: number;
  sourceDurationMs: number;
}

export interface TextLayer {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  fontPx: number;
  color: string;
  /** Keyframes are relative to startMs. y is fixed. */
  y: number;
  x: Keyframe[];
  scale: Keyframe[];
}

export interface StickerLayer {
  id: string;
  dataUri: string;
  startMs: number;
  endMs: number;
  sizePx: number;
  /** Keyframes are relative to startMs. */
  x: Keyframe[];
  y: Keyframe[];
  rotationDeg: Keyframe[];
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A stretch of sound on the finished video: a clip's own audio or an audio-track clip. */
export interface AudioSpan {
  uri: string;
  /** Where it starts on the finished video, ms. */
  startMs: number;
  /** Its length on the finished video, ms. */
  outputMs: number;
  /** Where it starts in the source file, ms. */
  inMs: number;
  /** Source ms per finished-video ms (a 2x clip plays its sound twice as fast). */
  speed: number;
  /** 0..1 */
  volume: number;
  fadeInMs: number;
  fadeOutMs: number;
}

/** The sound of the finished video: each video piece's own audio, then the audio-track clips. */
export function audioSpansOf(
  main: SequencePlan,
  tracksAudio: readonly PlannedAudio[]
): AudioSpan[] {
  const own = main.clips
    .filter((p) => p.kind === 'video' && p.volume > 0)
    .map((p) => ({
      uri: p.sourceUri,
      startMs: p.startMs,
      outputMs: p.outputMs,
      inMs: p.inMs,
      speed: p.speed,
      volume: p.volume,
      fadeInMs: 0,
      fadeOutMs: 0,
    }));
  const music = tracksAudio.map((a) => ({
    uri: a.sourceUri,
    startMs: a.startMs,
    outputMs: a.outMs - a.inMs,
    inMs: a.inMs,
    speed: 1,
    volume: a.volume,
    fadeInMs: a.fadeInMs,
    fadeOutMs: a.fadeOutMs,
  }));
  return [...own, ...music].filter((s) => s.outputMs > 0);
}

/** Gain of `span` at finished-video time `tMs`: its volume with linear fades, 0 outside it. */
export function spanGainAt(span: AudioSpan, tMs: number): number {
  const into = tMs - span.startMs;
  const left = span.startMs + span.outputMs - tMs;
  if (into < 0 || left < 0) return 0;
  let gain = span.volume;
  if (span.fadeInMs > 0 && into < span.fadeInMs) gain *= into / span.fadeInMs;
  if (span.fadeOutMs > 0 && left < span.fadeOutMs) gain *= left / span.fadeOutMs;
  return gain;
}

export interface WebScene {
  width: number;
  height: number;
  /** 'cover': the main sequence fills the frame, cropping (export presets); default fits inside. */
  fit?: 'contain' | 'cover';
  durationMs: number;
  main: SequencePlan;
  audio: AudioSpan[];
  pips: PipLayer[];
  texts: TextLayer[];
  stickers: StickerLayer[];
}

export type DrawOp =
  | { kind: 'clear'; color: string }
  | {
      kind: 'video';
      /** Decoder slot: 'main', 'out' (frozen outgoing transition frame), 'pip1'... */
      layer: string;
      uri: string;
      sourceTimeMs: number;
      rect: Rect;
      opacity: number;
      translateX: number;
      scale: number;
      rotationDeg: number;
    }
  | {
      kind: 'text';
      text: string;
      x: number;
      y: number;
      fontPx: number;
      color: string;
      scale: number;
      opacity: number;
    }
  | {
      kind: 'sticker';
      dataUri: string;
      x: number;
      y: number;
      sizePx: number;
      rotationDeg: number;
      opacity: number;
    };

export interface SpikeSceneOptions {
  stickerDataUri: string;
  width?: number;
  height?: number;
}

/** Linear (optionally eased) value of a keyframe list at `tMs`; clamps outside the range. */
export function sampleKeyframes(keys: readonly Keyframe[], tMs: number): number {
  if (keys.length === 0) return 0;
  if (tMs <= keys[0].tMs) return keys[0].v;
  for (let i = 1; i < keys.length; i += 1) {
    const b = keys[i];
    if (tMs <= b.tMs) {
      const a = keys[i - 1];
      const span = b.tMs - a.tMs;
      let u = span <= 0 ? 1 : (tMs - a.tMs) / span;
      if (b.ease === 'out') u = 1 - (1 - u) ** 3;
      return a.v + (b.v - a.v) * u;
    }
  }
  return keys[keys.length - 1].v;
}

const SLIDE_IN_MS = 600;

export interface EditorSceneOptions {
  width?: number;
  height?: number;
  fit?: 'contain' | 'cover';
  /** Swaps a clip's source for the file the preview should decode (a proxy); default: as is. */
  mapUri?: (sourceUri: string) => string;
}

/**
 * The editor's scene: the main sequence only (`planSequence`), no PiP/text/sticker extras.
 * Image-track pieces are not drawn yet (stage 2 of docs/video-engine-migration.md).
 */
export function buildEditorScene(
  tracks: readonly Track[],
  opts: EditorSceneOptions = {}
): WebScene {
  const { mapUri } = opts;
  const mapped = mapUri
    ? tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => ({ ...c, sourceUri: mapUri(c.sourceUri) })),
      }))
    : tracks;
  const { audio, ...main } = planExport(mapped);
  return {
    width: opts.width ?? 1920,
    height: opts.height ?? 1080,
    fit: opts.fit,
    durationMs: main.durationMs,
    main,
    audio: audioSpansOf(main, audio),
    pips: [],
    texts: [],
    stickers: [],
  };
}

export function buildSpikeScene(tracks: readonly Track[], opts: SpikeSceneOptions): WebScene {
  const width = opts.width ?? 1920;
  const height = opts.height ?? 1080;
  const main = planSequence(tracks);
  const durationMs = main.durationMs;

  // The project's own source files feed the PiP layers (first two; reuse the first if only one).
  const sources = tracks
    .filter((t) => t.kind === 'video')
    .flatMap((t) => t.clips)
    .filter((c) => !c.frozen);
  const first = sources[0];
  const second = sources[1] ?? first;
  const boxW = Math.round(width * 0.3);
  const boxH = Math.round(height * 0.3);
  const margin = 48;
  const pips: PipLayer[] = first
    ? [
        {
          id: 'pip1',
          uri: first.sourceUri,
          rect: { x: width - boxW - margin, y: margin, w: boxW, h: boxH },
          opacity: 1,
          sourceOffsetMs: 0,
          sourceDurationMs: first.sourceDurationMs,
        },
        {
          id: 'pip2',
          uri: second.sourceUri,
          rect: { x: width - boxW - margin, y: height - boxH - margin, w: boxW, h: boxH },
          opacity: 0.7,
          sourceOffsetMs: 5000,
          sourceDurationMs: second.sourceDurationMs,
        },
      ]
    : [];

  const life = Math.max(durationMs, SLIDE_IN_MS);
  const texts: TextLayer[] = [
    {
      id: 'title',
      text: 'PixelMorph',
      startMs: 0,
      endMs: life,
      fontPx: 120,
      color: '#ffffff',
      y: height * 0.5,
      x: [
        { tMs: 0, v: -700 },
        { tMs: SLIDE_IN_MS, v: 80, ease: 'out' },
      ],
      scale: [
        { tMs: 0, v: 1 },
        { tMs: life, v: 1.2 },
      ],
    },
  ];
  const stickers: StickerLayer[] = [
    {
      id: 'sticker',
      dataUri: opts.stickerDataUri,
      startMs: 0,
      endMs: life,
      sizePx: 220,
      x: [
        { tMs: 0, v: 200 },
        { tMs: life / 2, v: width / 2 },
        { tMs: life, v: width - 400 },
      ],
      y: [
        { tMs: 0, v: height - 200 },
        { tMs: life / 2, v: height / 2 + 250 },
        { tMs: life, v: height - 200 },
      ],
      rotationDeg: [
        { tMs: 0, v: 0 },
        { tMs: life, v: 360 },
      ],
    },
  ];
  return { width, height, durationMs, main, audio: audioSpansOf(main, []), pips, texts, stickers };
}

/** Every draw op for scene time `timeMs`, bottom to top. Pure: same input, same output. */
export function drawListAt(scene: WebScene, timeMs: number): DrawOp[] {
  const { width, height } = scene;
  const full: Rect = { x: 0, y: 0, w: width, h: height };
  const ops: DrawOp[] = [{ kind: 'clear', color: '#000000' }];

  const frame = frameAt(scene.main, timeMs);
  if (frame && (frame.piece.kind === 'video' || frame.piece.kind === 'still')) {
    const rotationDeg = frame.piece.rotation;
    const incomingBase = {
      kind: 'video' as const,
      layer: 'main',
      uri: frame.piece.sourceUri,
      sourceTimeMs: frame.sourceTimeMs,
      rect: full,
      rotationDeg,
    };
    if (frame.transition) {
      const { type, mode, progress, from } = frame.transition;
      const { outgoing, incoming } = transitionTransforms(type, mode, progress, width);
      ops.push({ ...incomingBase, ...flat(incoming) });
      if (!from.image) {
        ops.push({
          kind: 'video',
          layer: 'out',
          uri: from.sourceUri,
          sourceTimeMs: from.timeMs,
          rect: full,
          rotationDeg: from.rotation,
          ...flat(outgoing),
        });
      }
    } else {
      ops.push({ ...incomingBase, opacity: 1, translateX: 0, scale: 1 });
    }
  }

  for (const p of scene.pips) {
    if (timeMs < 0 || timeMs > scene.durationMs) break;
    ops.push({
      kind: 'video',
      layer: p.id,
      uri: p.uri,
      sourceTimeMs: (p.sourceOffsetMs + timeMs) % Math.max(1, p.sourceDurationMs),
      rect: p.rect,
      opacity: p.opacity,
      translateX: 0,
      scale: 1,
      rotationDeg: 0,
    });
  }

  for (const t of scene.texts) {
    if (timeMs < t.startMs || timeMs > t.endMs) continue;
    const local = timeMs - t.startMs;
    ops.push({
      kind: 'text',
      text: t.text,
      x: sampleKeyframes(t.x, local),
      y: t.y,
      fontPx: t.fontPx,
      color: t.color,
      scale: sampleKeyframes(t.scale, local),
      opacity: 1,
    });
  }

  for (const s of scene.stickers) {
    if (timeMs < s.startMs || timeMs > s.endMs) continue;
    const local = timeMs - s.startMs;
    ops.push({
      kind: 'sticker',
      dataUri: s.dataUri,
      x: sampleKeyframes(s.x, local),
      y: sampleKeyframes(s.y, local),
      sizePx: s.sizePx,
      rotationDeg: sampleKeyframes(s.rotationDeg, local),
      opacity: 1,
    });
  }
  return ops;
}

function flat(t: { opacity: number; translateX: number; scale: number }) {
  return { opacity: t.opacity, translateX: t.translateX, scale: t.scale };
}

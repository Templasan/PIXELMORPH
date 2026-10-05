import { clampFadeMs } from './audio';
import { clipDurationMs, type Clip, type Track } from './Track';

/**
 * US-16/US-30: turns the editor timeline into the ordered list of pieces the native exporter
 * stitches together. Pure (no native imports) so it can be tested in Jest.
 */

export interface PlannedClip {
  /** "video": a range of the source file. "still": one frame of it held for `holdMs`. */
  kind: 'video' | 'still';
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
  transitionFrom: { sourceUri: string; timeMs: number; rotation: number } | null;
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

/** RF-036: a background-audio clip mixed under the video's own sound. */
export interface PlannedAudio {
  sourceUri: string;
  inMs: number;
  outMs: number;
  /** Where it starts in the finished video. */
  startMs: number;
  /** 0..1 */
  volume: number;
  fadeInMs: number;
  fadeOutMs: number;
}

export interface ExportPlan {
  clips: PlannedClip[];
  /** Audio-track clips, in time order, non-overlapping, cut to the video's length. */
  audio: PlannedAudio[];
  transitions: PlannedTransition[];
  /** Length of the finished video. */
  durationMs: number;
}

/** First visible video track's clips in time order. Gaps are closed; other tracks are ignored. */
export function planExport(tracks: readonly Track[]): ExportPlan {
  const track = tracks.find((t) => t.kind === 'video' && t.visible && t.clips.length > 0);
  if (!track) return { clips: [], audio: [], transitions: [], durationMs: 0 };

  const ordered = [...track.clips].sort((a, b) => a.startMs - b.startMs);
  const planned = ordered.map((clip) => ({ clip, piece: toPlanned(clip) }));
  const kept = planned.filter(({ piece }) => piece.holdMs > 0 || piece.outMs > piece.inMs);
  const clips = kept.map(({ piece }) => piece);

  const transitions: PlannedTransition[] = [];
  let atMs = 0;
  kept.forEach(({ clip }, index) => {
    const length = clipDurationMs(clip);
    clips[index].startMs = atMs;
    const previous = kept[index - 1];
    if (previous && clip.transitionIn) {
      // Same rule the editor applies: never longer than half of either neighbouring clip.
      const durationMs = Math.min(
        clip.transitionIn.durationMs,
        clipDurationMs(previous.clip) / 2,
        length / 2
      );
      if (durationMs > 0) {
        const type = clip.transitionIn.type;
        transitions.push({ type, atMs, durationMs });
        clips[index].transitionIn = type;
        clips[index].transitionInMs = durationMs;
        const out = clips[index - 1];
        clips[index].transitionFrom = {
          sourceUri: out.sourceUri,
          // A still holds its own instant; a video leaves on (almost) its last frame.
          timeMs: out.kind === 'still' ? out.stillTimeMs : Math.max(out.inMs, out.outMs - 50),
          rotation: out.rotation,
        };
      }
    }
    atMs += length;
  });

  return { clips, audio: planAudio(tracks, atMs), transitions, durationMs: atMs };
}

function planAudio(tracks: readonly Track[], videoMs: number): PlannedAudio[] {
  const out: PlannedAudio[] = [];
  const ordered = tracks
    .filter((t) => t.kind === 'audio' && t.visible)
    .flatMap((t) => t.clips)
    .sort((a, b) => a.startMs - b.startMs);
  let cursor = 0; // one sequence plays one clip at a time: an overlap starts when the last ends
  for (const clip of ordered) {
    const startMs = Math.max(clip.startMs, cursor);
    const lengthMs = Math.min(clipDurationMs(clip) - (startMs - clip.startMs), videoMs - startMs);
    if (lengthMs <= 0) continue;
    const inMs = clip.inPointMs + (startMs - clip.startMs);
    out.push({
      sourceUri: clip.sourceUri,
      inMs,
      outMs: inMs + lengthMs,
      startMs,
      volume: (clip.volume ?? 100) / 100,
      fadeInMs: clampFadeMs(clip.fadeInMs ?? 0, clip),
      fadeOutMs: clampFadeMs(clip.fadeOutMs ?? 0, clip),
    });
    cursor = startMs + lengthMs;
  }
  return out;
}

const NO_TRANSITION = {
  transitionIn: '' as const,
  transitionInMs: 0,
  transitionFrom: null,
  startMs: 0,
};

function toPlanned(clip: Clip): PlannedClip {
  const rotation = clip.rotation ?? 0;
  if (clip.frozen) {
    return {
      kind: 'still',
      sourceUri: clip.sourceUri,
      inMs: 0,
      outMs: 0,
      stillTimeMs: clip.inPointMs,
      holdMs: clip.holdMs ?? clipDurationMs(clip),
      speed: 1,
      volume: 1,
      rotation,
      ...NO_TRANSITION,
      outputMs: clip.holdMs ?? clipDurationMs(clip),
    };
  }
  return {
    kind: 'video',
    sourceUri: clip.sourceUri,
    inMs: clip.inPointMs,
    outMs: clip.outPointMs,
    stillTimeMs: 0,
    holdMs: 0,
    speed: clip.speed ?? 1,
    volume: (clip.volume ?? 100) / 100,
    rotation,
    ...NO_TRANSITION,
    outputMs: clipDurationMs(clip),
  };
}

/** RF-017: social presets for video — real target resolutions and bitrates, never upscaled. */
export interface VideoPreset {
  name: string;
  width: number;
  height: number;
  bitrate: number; // bits per second
}

export const VIDEO_PRESETS: readonly VideoPreset[] = [
  { name: 'Instagram Reels', width: 1080, height: 1920, bitrate: 6_000_000 },
  { name: 'TikTok', width: 1080, height: 1920, bitrate: 6_000_000 },
  { name: 'YouTube Full HD', width: 1920, height: 1080, bitrate: 8_000_000 },
  { name: 'YouTube Shorts', width: 1080, height: 1920, bitrate: 6_000_000 },
  { name: 'WhatsApp 720p', width: 1280, height: 720, bitrate: 2_500_000 },
];

/**
 * "Original" size/bitrate for a source of `width`x`height`: keeps the shape, caps the long edge
 * at 1920 (Full HD) so a 4K clip does not blow past what a phone encoder handles in time, and
 * picks ~0.1 bit per pixel per frame at 30 fps.
 */
export function originalPreset(width: number, height: number): VideoPreset {
  const longEdge = Math.max(width, height) || 1920;
  const scale = Math.min(1, 1920 / longEdge);
  const w = even(Math.round((width || 1080) * scale));
  const h = even(Math.round((height || 1920) * scale));
  return { name: 'Original', width: w, height: h, bitrate: Math.round(w * h * 30 * 0.1) };
}

function even(n: number): number {
  return n % 2 === 0 ? n : n + 1;
}

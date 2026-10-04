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
  rotation: number;
}

/** A transition into a clip: the previous clip's last frame is laid over the new clip's start. */
export interface PlannedTransition {
  type: 'fade' | 'slide' | 'zoom' | 'wipe';
  /** Where the incoming clip starts on the finished video. */
  atMs: number;
  durationMs: number;
  /** Frame of the outgoing clip to hold while it fades/slides away. */
  outgoingUri: string;
  outgoingTimeMs: number;
  outgoingRotation: number;
}

export interface ExportPlan {
  clips: PlannedClip[];
  transitions: PlannedTransition[];
  /** Length of the finished video. */
  durationMs: number;
}

/** First visible video track's clips in time order. Gaps are closed; other tracks are ignored. */
export function planExport(tracks: readonly Track[]): ExportPlan {
  const track = tracks.find((t) => t.kind === 'video' && t.visible && t.clips.length > 0);
  if (!track) return { clips: [], transitions: [], durationMs: 0 };

  const ordered = [...track.clips].sort((a, b) => a.startMs - b.startMs);
  const planned = ordered.map((clip) => ({ clip, piece: toPlanned(clip) }));
  const kept = planned.filter(({ piece }) => piece.holdMs > 0 || piece.outMs > piece.inMs);
  const clips = kept.map(({ piece }) => piece);

  const transitions: PlannedTransition[] = [];
  let atMs = 0;
  kept.forEach(({ clip }, index) => {
    const length = clipDurationMs(clip);
    const previous = kept[index - 1]?.clip;
    if (previous && clip.transitionIn) {
      // Same rule the editor applies: never longer than half of either neighbouring clip.
      const durationMs = Math.min(
        clip.transitionIn.durationMs,
        clipDurationMs(previous) / 2,
        length / 2
      );
      if (durationMs > 0) {
        transitions.push({
          type: clip.transitionIn.type,
          atMs,
          durationMs,
          outgoingUri: previous.sourceUri,
          // A frame just before the end (the very last instant can be past the final frame).
          outgoingTimeMs: Math.max(0, previous.outPointMs - 40),
          outgoingRotation: previous.rotation ?? 0,
        });
      }
    }
    atMs += length;
  });

  return { clips, transitions, durationMs: atMs };
}

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
      rotation,
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
    rotation,
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

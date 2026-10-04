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

export interface ExportPlan {
  clips: PlannedClip[];
  /** Length of the finished video. */
  durationMs: number;
}

/** First visible video track's clips in time order. Gaps are closed; other tracks are ignored. */
export function planExport(tracks: readonly Track[]): ExportPlan {
  const track = tracks.find((t) => t.kind === 'video' && t.visible && t.clips.length > 0);
  if (!track) return { clips: [], durationMs: 0 };

  const ordered = [...track.clips].sort((a, b) => a.startMs - b.startMs);
  const clips = ordered.map(toPlanned).filter((c) => c.holdMs > 0 || c.outMs > c.inMs);
  const durationMs = ordered.reduce((sum, clip) => sum + clipDurationMs(clip), 0);
  return { clips, durationMs };
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

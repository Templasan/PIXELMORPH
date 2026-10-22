import { clipDurationMs, type Track } from './Track';
import { planSequence, type SequencePlan } from './framePlan';

/**
 * US-16/US-30: turns the editor timeline into the ordered list of pieces the native exporter
 * stitches together. Pure (no native imports) so it can be tested in Jest.
 */

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

export interface ExportPlan extends SequencePlan {
  /** Audio-track clips, in time order, non-overlapping, cut to the video's length. */
  audio: PlannedAudio[];
}

/**
 * The timeline's visible video and image tracks as one sequence (see framePlan.ts for the
 * rules: topmost track wins, gaps closed) plus the audio-track clips mixed under it.
 */
export function planExport(tracks: readonly Track[]): ExportPlan {
  const sequence = planSequence(tracks);
  return { ...sequence, audio: planAudio(tracks, sequence.durationMs) };
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
      // Against the length actually played (trimmed, cut to the video), not the whole clip.
      fadeInMs: Math.max(0, Math.min(clip.fadeInMs ?? 0, lengthMs)),
      fadeOutMs: Math.max(0, Math.min(clip.fadeOutMs ?? 0, lengthMs)),
    });
    cursor = startMs + lengthMs;
  }
  return out;
}

/** RF-017: social presets for video — real target resolutions and bitrates; a source with another shape is scaled to fill the frame and cropped. */
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

import type { ProjectFormat } from '../ports/host';
import type { VideoPreset } from './exportPlan';

/**
 * RF-017: social presets for the export. Each one is built at its own size and bitrate; a
 * project of another shape is cropped (centre) to fill that frame, never letterboxed.
 */
export interface SocialPreset extends VideoPreset {
  label: string;
  /** The shape the preset is built for. */
  format: ProjectFormat;
}

export const SOCIAL_PRESETS: readonly SocialPreset[] = [
  { label: 'Reels / TikTok / Shorts', name: 'Reels', width: 1080, height: 1920, bitrate: 8_000_000, format: '9:16' },
  { label: 'Instagram Feed', name: 'Feed', width: 1080, height: 1080, bitrate: 6_000_000, format: '1:1' },
  { label: 'YouTube', name: 'YouTube', width: 1920, height: 1080, bitrate: 10_000_000, format: '16:9' },
];

/** The frame a preset exports; `cover` when the project's shape differs from the preset's. */
export function presetFrame(preset: SocialPreset, format: ProjectFormat) {
  return { width: preset.width, height: preset.height, cover: preset.format !== format };
}

import { describe, expect, it } from 'vitest';
import { SOCIAL_PRESETS, presetFrame } from '../src/domain/exportPreset';

describe('social export presets (RF-017)', () => {
  const reels = SOCIAL_PRESETS[0];
  const feed = SOCIAL_PRESETS[1];

  it('exports at the preset size, cropping only when the project has another shape', () => {
    expect(presetFrame(reels, '9:16')).toEqual({ width: 1080, height: 1920, cover: false });
    expect(presetFrame(reels, '16:9')).toEqual({ width: 1080, height: 1920, cover: true });
    expect(presetFrame(feed, '1:1')).toEqual({ width: 1080, height: 1080, cover: false });
  });

  it('gives every preset an even size and a bitrate in the 6-10 Mbps range', () => {
    for (const p of SOCIAL_PRESETS) {
      expect(p.width % 2).toBe(0);
      expect(p.height % 2).toBe(0);
      expect(p.bitrate).toBeGreaterThanOrEqual(6_000_000);
      expect(p.bitrate).toBeLessThanOrEqual(10_000_000);
    }
  });
});

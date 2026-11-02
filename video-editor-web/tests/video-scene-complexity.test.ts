import { describe, expect, it } from 'vitest';
import { adaptiveBitrate, complexityOf, frameStats, type FrameStats } from '../src/domain/sceneComplexity';

const W = 64;
const H = 48;

/** A frame of `amp` random luma around 128: amp 0 is flat, 255 is full noise. Seeded, so repeatable. */
function frame(amp: number, seed: number): Uint8ClampedArray {
  let s = seed;
  const out = new Uint8ClampedArray(W * H);
  for (let i = 0; i < out.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out[i] = 128 + ((s / 0x7fffffff) * 2 - 1) * (amp / 2);
  }
  return out;
}

/** Per-frame stats for a clip: each frame compared with the one before (the first has no past). */
function clip(amps: number[]): FrameStats[] {
  const stats: FrameStats[] = [];
  let prev: Uint8ClampedArray | undefined;
  amps.forEach((amp, i) => {
    const f = frame(amp, i + 1);
    stats.push(frameStats(f, W, H, prev));
    prev = f;
  });
  return stats;
}

describe('frameStats', () => {
  it('reads a flat, still frame as 0', () => {
    const flat = new Uint8ClampedArray(W * H).fill(90);
    expect(frameStats(flat, W, H, flat)).toEqual({ spatial: 0, temporal: 0 });
  });

  it('reads noise near 1 (about two thirds spatial, one third temporal)', () => {
    const s = frameStats(frame(255, 7), W, H, frame(255, 8));
    expect(s.spatial).toBeGreaterThan(0.6);
    expect(s.spatial).toBeLessThan(0.75);
    expect(s.temporal).toBeGreaterThan(0.28);
    expect(s.temporal).toBeLessThan(0.38);
  });

  it('has no temporal part for the first frame', () => {
    expect(frameStats(frame(255, 3), W, H).temporal).toBe(0);
  });
});

describe('complexityOf', () => {
  it('is near 0 for flat, still frames', () => {
    expect(complexityOf(clip(new Array(24).fill(0)))).toBeLessThan(0.01);
  });

  it('is near 1 for noise', () => {
    expect(complexityOf(clip(new Array(24).fill(255)))).toBeGreaterThan(0.95);
  });

  it('reads detail below the quiet level as still and detail at the busy level as full', () => {
    expect(complexityOf([{ spatial: 0.005, temporal: 0 }])).toBe(0);
    expect(complexityOf([{ spatial: 0.015, temporal: 0 }])).toBe(1);
  });

  it('scores a mostly static clip with a busy section high', () => {
    const amps = [...new Array(18).fill(0), ...new Array(6).fill(255)];
    expect(complexityOf(clip(amps))).toBeGreaterThan(0.95);
  });

  it('is monotonic in how busy the frames are', () => {
    const levels = [0, 8, 32, 96, 255].map((amp) => complexityOf(clip(new Array(24).fill(amp))));
    for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
    expect(levels[levels.length - 1]).toBeGreaterThan(levels[0]);
  });

  it('keeps the preset when nothing was read', () => {
    expect(complexityOf([])).toBe(1);
  });
});

describe('adaptiveBitrate', () => {
  const preset = 6_000_000;

  it('keeps the preset for a busy clip and never goes above it', () => {
    expect(adaptiveBitrate(preset, 1)).toBe(preset);
    expect(adaptiveBitrate(preset, 2)).toBe(preset);
    for (let c = 0; c <= 1; c += 0.05) expect(adaptiveBitrate(preset, c)).toBeLessThanOrEqual(preset);
  });

  it('never goes below 55% of the preset', () => {
    // Float rounding of 0.55 * preset can add one bit under ceil, hence not toBe.
    expect(adaptiveBitrate(preset, 0)).toBeCloseTo(3_300_000, -1);
    expect(adaptiveBitrate(preset, -1)).toBeCloseTo(3_300_000, -1);
    for (const p of [2_500_001, 8_000_003, 1]) {
      expect(adaptiveBitrate(p, 0)).toBeGreaterThanOrEqual(0.55 * p);
    }
  });

  it('is whole bits and grows with complexity', () => {
    let last = 0;
    for (let c = 0; c <= 1; c += 0.1) {
      const b = adaptiveBitrate(preset, c);
      expect(Number.isInteger(b)).toBe(true);
      expect(b).toBeGreaterThanOrEqual(last);
      last = b;
    }
  });
});

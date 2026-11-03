import { frameFeatures, pickHighlights, type FrameFeatures } from '../src/domain/highlights';

const frame = (detail: number, level = 0): FrameFeatures => {
  const histogram = new Float32Array(32);
  histogram[level] = 1;
  return { histogram, detail };
};

describe('frameFeatures', () => {
  const w = 40;
  const h = 40;
  const of = (at: (x: number, y: number) => number) => {
    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y += 1)
      for (let x = 0; x < w; x += 1) {
        const v = at(x, y);
        rgba.set([v, v, v, 255], (y * w + x) * 4);
      }
    return frameFeatures(rgba, w, h);
  };

  it('a black frame has no detail, a pattern has', () => {
    expect(of(() => 0).detail).toBe(0);
    expect(of((x) => (x % 8 < 4 ? 0 : 255)).detail).toBeGreaterThan(0.1);
  });

  it('the histogram adds up to one', () => {
    expect(of((x) => x * 6).histogram.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
});

describe('pickHighlights', () => {
  it('skips black frames and keeps the order of the video', () => {
    const picked = pickHighlights([frame(0), frame(0.2, 4), frame(0), frame(0.1, 9), frame(0)], 2);
    expect(picked).toEqual([1, 3]);
  });

  it('a new scene beats more of the same', () => {
    const frames = [frame(0.1, 3), frame(0.1, 3), frame(0.1, 3), frame(0.1, 20), frame(0.1, 20), frame(0.1, 20)];
    expect(pickHighlights(frames, 1)).toEqual([3]);
  });

  it('keeps its distance, so one busy scene does not fill the thumbnail', () => {
    const frames = Array.from({ length: 32 }, (_, i) => frame(i >= 10 && i < 14 ? 0.5 : 0.02, i >> 2));
    const picked = pickHighlights(frames, 4);
    expect(picked).toHaveLength(4);
    for (let i = 1; i < picked.length; i += 1) expect(picked[i] - picked[i - 1]).toBeGreaterThanOrEqual(4);
  });

  it('an all-black video still has a thumbnail, and an empty one has none', () => {
    expect(pickHighlights([frame(0), frame(0)], 3)).toEqual([0]);
    expect(pickHighlights([], 3)).toEqual([]);
  });
});

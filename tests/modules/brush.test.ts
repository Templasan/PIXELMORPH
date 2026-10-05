import { brushTip, pressureWidth } from '../../src/modules/photo-editor/domain/layers/Layer';

describe('brushTip (RF-033 brush shapes)', () => {
  it('maps each shape to a distinct cap/join and defaults to round', () => {
    expect(brushTip('round')).toEqual({ cap: 'round', join: 'round' });
    expect(brushTip('square')).toEqual({ cap: 'square', join: 'miter' });
    expect(brushTip('flat')).toEqual({ cap: 'butt', join: 'bevel' });
    expect(brushTip(undefined)).toEqual({ cap: 'round', join: 'round' });
  });
});

describe('pressureWidth (RF-033 stylus)', () => {
  it('keeps the base width for a finger (no pressure samples)', () => {
    expect(pressureWidth(8, [])).toBe(8);
  });

  it('draws at the base width for a medium press, thinner for light, thicker for hard', () => {
    expect(pressureWidth(10, [0.5, 0.5])).toBeCloseTo(10);
    expect(pressureWidth(10, [0.1])).toBeLessThan(10);
    expect(pressureWidth(10, [1])).toBeGreaterThan(10);
  });

  it('ignores non-finite or zero samples and clamps above 1', () => {
    expect(pressureWidth(10, [0, NaN])).toBe(10);
    expect(pressureWidth(10, [5])).toBeCloseTo(pressureWidth(10, [1]));
  });
});

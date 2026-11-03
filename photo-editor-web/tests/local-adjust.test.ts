import {
  colorMaskAlpha,
  createFocusAdjust,
  createLocalAdjust,
  linearMaskEnds,
  localFilter,
} from '../src/domain/layers';

describe('colour mask', () => {
  const red = [200, 30, 30] as const;

  it('takes the picked colour whole and leaves far colours out', () => {
    expect(colorMaskAlpha(200, 30, 30, red, 10)).toBe(1);
    expect(colorMaskAlpha(30, 200, 30, red, 10)).toBe(0);
  });

  it('a wider tolerance takes more, and the edge fades instead of cutting', () => {
    const near = [170, 60, 60] as const;
    expect(colorMaskAlpha(...near, red, 30)).toBeGreaterThan(colorMaskAlpha(...near, red, 5));
    const faded = colorMaskAlpha(180, 50, 50, red, 3);
    expect(faded).toBeGreaterThan(0);
    expect(faded).toBeLessThan(1);
  });
});

describe('linear mask', () => {
  it('runs along its angle, centred on its point', () => {
    const { from, to } = linearMaskEnds({ ...createLocalAdjust('linear'), angle: 0, feather: 0.5, x: 0.5, y: 0.5 }, 100, 100);
    expect(from.y).toBeCloseTo(50);
    expect(to.y).toBeCloseTo(50);
    expect((from.x + to.x) / 2).toBeCloseTo(50);
    expect(to.x).toBeGreaterThan(from.x);
  });
});

describe('the change', () => {
  it('is neutral by default, and blur scales with the output', () => {
    const l = createLocalAdjust('brush');
    expect(localFilter(l, 2)).toBe('brightness(1) contrast(1) saturate(1)');
    expect(localFilter({ ...l, blur: 3 }, 2)).toContain('blur(6px)');
  });

  it('selective focus blurs everything but its centre', () => {
    const f = createFocusAdjust();
    expect(f.mask).toBe('radial');
    expect(f.invert).toBe(true);
    expect(f.blur).toBeGreaterThan(0);
  });
});

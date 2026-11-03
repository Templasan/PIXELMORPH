import { looksLike360, sourceUv, sphereMatrix, type SphereView } from '../src/domain/sphere';

const view = (extra: Partial<SphereView> = {}): SphereView => ({ yaw: 0, pitch: 0, roll: 0, flat: false, fov: 90, ...extra });

describe('the 360 view', () => {
  it('with no turn, every point reads from itself', () => {
    for (const [u, v] of [[0.5, 0.5], [0.25, 0.3], [0.8, 0.7]]) {
      const [su, sv] = sourceUv(u, v, view());
      expect(su).toBeCloseTo(u);
      expect(sv).toBeCloseTo(v);
    }
  });

  it('a yaw slides the picture around the sphere and wraps', () => {
    const [su, sv] = sourceUv(0.5, 0.5, view({ yaw: 90 }));
    expect(su).toBeCloseTo(0.75);
    expect(sv).toBeCloseTo(0.5);
    expect(sourceUv(0.5, 0.5, view({ yaw: 180 }))[0] % 1).toBeCloseTo(0);
  });

  it('a pitch looks up or down, and the turn is a true rotation', () => {
    expect(sourceUv(0.5, 0.5, view({ pitch: 45 }))[1]).toBeCloseTo(0.25);
    const m = sphereMatrix({ yaw: 33, pitch: -20, roll: 71 });
    const dot = (a: number, b: number) => m[a] * m[b] + m[a + 1] * m[b + 1] + m[a + 2] * m[b + 2];
    expect(dot(0, 0)).toBeCloseTo(1);
    expect(dot(0, 3)).toBeCloseTo(0);
    expect(dot(3, 6)).toBeCloseTo(0);
  });

  it('a flat cut looks straight at its centre and widens with its field of view', () => {
    expect(sourceUv(0.5, 0.5, view({ flat: true }))).toEqual([0.5, 0.5]);
    const narrow = sourceUv(1, 0.5, view({ flat: true, fov: 60 }))[0];
    const wide = sourceUv(1, 0.5, view({ flat: true, fov: 90 }))[0];
    expect(narrow).toBeCloseTo(0.5 + 30 / 360);
    expect(wide).toBeCloseTo(0.5 + 45 / 360);
  });

  it('offers itself for 2:1 video only', () => {
    expect(looksLike360(3840, 1920)).toBe(true);
    expect(looksLike360(1920, 1080)).toBe(false);
  });
});

import { autoEyeMix, eyeMix, eyeRects } from '../src/domain/stereoscopic/StereoscopicDetection';

describe('stereo view', () => {
  it('a level device sits between the eyes, and a full tilt reaches each one', () => {
    expect(eyeMix(0)).toBe(0.5);
    expect(eyeMix(-15)).toBe(0);
    expect(eyeMix(15)).toBe(1);
    expect(eyeMix(90)).toBe(1);
  });

  it('the automatic swing stays between the eyes', () => {
    for (let ms = 0; ms < 5000; ms += 137) {
      expect(autoEyeMix(ms)).toBeGreaterThanOrEqual(0);
      expect(autoEyeMix(ms)).toBeLessThanOrEqual(1);
    }
  });

  it('splits each format into its two views, and refuses one with no separate views', () => {
    expect(eyeRects('side-by-side', 2000, 1000)).toEqual({
      left: { x: 0, y: 0, w: 1000, h: 1000 },
      right: { x: 1000, y: 0, w: 1000, h: 1000 },
    });
    expect(eyeRects('over-under', 1000, 2000)!.right.y).toBe(1000);
    expect(eyeRects('anaglyph', 1000, 1000)).toBeNull();
  });
});

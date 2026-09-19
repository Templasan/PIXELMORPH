import {
  applyAgingRGB,
  vignetteFactor,
  toRetroUniforms,
  DEFAULT_RETRO,
  DEFAULT_OVERLAY_TEXTURE,
  frameThicknessPx,
  frameRadiusPx,
  lensReflectionSpots,
  blendModeAt,
  BLEND_MODES,
} from '@modules/photo-editor/effects';

describe('applyAgingRGB', () => {
  it('leaves the pixel untouched when blend is 0', () => {
    expect(applyAgingRGB(0.5, 0.6, 0.2, 1, 0)).toEqual([0.5, 0.6, 0.2]);
  });

  it('pulls a saturated color toward sepia as amount/blend increase', () => {
    const [r, , b] = applyAgingRGB(0.1, 0.1, 0.9, 1, 1);
    // Sepia tint is warm — red/green should end up higher than the original blue-heavy pixel's blue.
    expect(r).toBeGreaterThan(0.1);
    expect(b).toBeLessThan(0.9);
  });

  it('stays within [0,1]', () => {
    const [r, g, b] = applyAgingRGB(1, 1, 1, 1, 1);
    for (const v of [r, g, b]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('vignetteFactor', () => {
  it('is 1 (no darkening) at the exact center', () => {
    expect(vignetteFactor({ x: 170, y: 113.5 }, 340, 227, 1)).toBeCloseTo(1, 3);
  });

  it('darkens progressively toward the corners', () => {
    const nearCenter = vignetteFactor({ x: 200, y: 130 }, 340, 227, 1);
    const corner = vignetteFactor({ x: 0, y: 0 }, 340, 227, 1);
    expect(corner).toBeLessThan(nearCenter);
    expect(corner).toBeLessThan(1);
  });

  it('amount=0 never darkens', () => {
    expect(vignetteFactor({ x: 0, y: 0 }, 340, 227, 0)).toBe(1);
  });
});

describe('toRetroUniforms', () => {
  it('scales 0..100 sliders down to the shader-facing 0..1 range', () => {
    const u = toRetroUniforms(
      { aging: 50, agingBlend: 100, grain: 20, grainBlend: 80, vignette: 40, vignetteBlend: 100 },
      { type: 2, intensity: 60, opacity: 30 },
      340,
      227
    );
    expect(u.retroAging).toBeCloseTo(0.5);
    expect(u.retroGrain).toBeCloseTo(0.2);
    expect(u.retroVignette).toBeCloseTo(0.4);
    expect(u.overlayType).toBe(2);
    expect(u.overlayOpacity).toBeCloseTo(0.3);
    expect(u.frameWidth).toBe(340);
    expect(u.frameHeight).toBe(227);
  });

  it('defaults are a full no-op (0 amount everywhere, overlay inactive)', () => {
    const u = toRetroUniforms(DEFAULT_RETRO, DEFAULT_OVERLAY_TEXTURE, 340, 227);
    expect(u.retroAging).toBe(0);
    expect(u.retroGrain).toBe(0);
    expect(u.retroVignette).toBe(0);
    expect(u.overlayType).toBe(0);
  });
});

describe('frameThicknessPx / frameRadiusPx', () => {
  it('thickness scales with the canvas short side and the 0..100 slider', () => {
    expect(frameThicknessPx(0, 227)).toBe(0);
    expect(frameThicknessPx(100, 227)).toBeCloseTo(227 * 0.12);
    expect(frameThicknessPx(50, 227)).toBeCloseTo((227 * 0.12) / 2);
  });

  it('radius grows with both the slider and the border thickness', () => {
    const thin = frameRadiusPx(50, 5);
    const thick = frameRadiusPx(50, 20);
    expect(thick).toBeGreaterThan(thin);
    expect(frameRadiusPx(0, 20)).toBe(0);
  });
});

describe('lensReflectionSpots', () => {
  it('places spots past the center, continuing the light->center line', () => {
    const spots = lensReflectionSpots({ x: 300, y: 50 }, { x: 170, y: 113.5 }, 3);
    expect(spots).toHaveLength(3);
    // Every spot should be further from the light than the center is (they overshoot it).
    const distLightToCenter = Math.hypot(170 - 300, 113.5 - 50);
    for (const s of spots) {
      const distLightToSpot = Math.hypot(s.x - 300, s.y - 50);
      expect(distLightToSpot).toBeGreaterThan(distLightToCenter);
    }
  });

  it('shrinks and fades spots further along the line', () => {
    const spots = lensReflectionSpots({ x: 300, y: 50 }, { x: 170, y: 113.5 }, 4);
    for (let i = 1; i < spots.length; i++) {
      expect(spots[i].radius).toBeLessThan(spots[i - 1].radius);
      expect(spots[i].opacity).toBeLessThan(spots[i - 1].opacity);
    }
  });
});

describe('blendModeAt', () => {
  it('maps an index to the matching Skia blend-mode name', () => {
    expect(blendModeAt(0)).toBe('multiply');
    expect(blendModeAt(1)).toBe('screen');
    expect(blendModeAt(2)).toBe('overlay');
  });

  it('clamps out-of-range indices', () => {
    expect(blendModeAt(-5)).toBe(BLEND_MODES[0]);
    expect(blendModeAt(99)).toBe(BLEND_MODES[BLEND_MODES.length - 1]);
  });
});

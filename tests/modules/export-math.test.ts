import {
  formatBytes,
  searchQualityForTargetSize,
  coverFitRect,
  scaleToFit,
  SOCIAL_PRESETS,
  SIZE_PRESETS,
} from '@modules/export/exportMath';

describe('formatBytes', () => {
  it('formats bytes, KB, and MB at sensible breakpoints', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.00 MB');
  });
});

describe('searchQualityForTargetSize', () => {
  // A monotonic fake encoder: higher quality -> larger output, roughly linear.
  const sizeAt = (q: number) => q * 1000;

  it('returns maxQuality when it already fits under the target', () => {
    expect(searchQualityForTargetSize(999999, sizeAt)).toBe(100);
  });

  it('returns minQuality when nothing fits', () => {
    expect(searchQualityForTargetSize(1, sizeAt)).toBe(20);
  });

  it('finds a quality whose real size is under the target and higher qualities are not', () => {
    const target = 55000; // sizeAt(55) = 55000
    const quality = searchQualityForTargetSize(target, sizeAt);
    expect(sizeAt(quality)).toBeLessThanOrEqual(target);
    expect(sizeAt(quality + 1)).toBeGreaterThan(target);
  });

  it('respects custom min/max quality bounds', () => {
    expect(searchQualityForTargetSize(1, sizeAt, 40, 90)).toBe(40);
    expect(searchQualityForTargetSize(999999, sizeAt, 40, 90)).toBe(90);
  });
});

describe('coverFitRect', () => {
  it('fills the target exactly when aspect ratios match', () => {
    const rect = coverFitRect(1000, 1000, 500, 500);
    expect(rect).toEqual({ x: 0, y: 0, width: 500, height: 500 });
  });

  it('crops symmetrically (centered) when the source is wider than the target', () => {
    const rect = coverFitRect(2000, 1000, 500, 500);
    // Scale = max(500/2000, 500/1000) = 0.5 -> drawn 1000x500, centered vertically... actually
    // horizontally offset since width(1000) > target width(500).
    expect(rect.width).toBeCloseTo(1000);
    expect(rect.height).toBeCloseTo(500);
    expect(rect.x).toBeCloseTo(-250);
    expect(rect.y).toBeCloseTo(0);
  });

  it('never leaves gaps — drawn rect always covers the full target', () => {
    const rect = coverFitRect(300, 900, 400, 400);
    expect(rect.width).toBeGreaterThanOrEqual(400);
    expect(rect.height).toBeGreaterThanOrEqual(400);
  });
});

describe('scaleToFit', () => {
  it('leaves the image untouched for "Original" (null maxLongEdge)', () => {
    expect(scaleToFit(4000, 3000, null)).toEqual({ width: 4000, height: 3000 });
  });

  it('never upscales an image already smaller than the target', () => {
    expect(scaleToFit(800, 600, 1920)).toEqual({ width: 800, height: 600 });
  });

  it('scales the long edge down to the target, preserving aspect ratio', () => {
    const result = scaleToFit(4000, 2000, 2000);
    expect(result.width).toBe(2000);
    expect(result.height).toBe(1000);
  });

  it('uses the taller edge as "long" for portrait images', () => {
    const result = scaleToFit(1000, 4000, 2000);
    expect(result.height).toBe(2000);
    expect(result.width).toBe(500);
  });
});

describe('SIZE_PRESETS', () => {
  it('includes Original with no resize and named presets with positive edges', () => {
    const original = SIZE_PRESETS.find((p) => p.name === 'Original');
    expect(original?.maxLongEdge).toBeNull();
    for (const p of SIZE_PRESETS.filter((x) => x.name !== 'Original')) {
      expect(p.maxLongEdge).toBeGreaterThan(0);
    }
  });
});

describe('SOCIAL_PRESETS', () => {
  it('every preset has positive real dimensions', () => {
    expect(SOCIAL_PRESETS.length).toBeGreaterThan(0);
    for (const p of SOCIAL_PRESETS) {
      expect(p.width).toBeGreaterThan(0);
      expect(p.height).toBeGreaterThan(0);
      expect(p.name.length).toBeGreaterThan(0);
    }
  });
});

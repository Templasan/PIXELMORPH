/**
 * RF-071: Stereoscopic photo detection via filename patterns and aspect ratio heuristics.
 * Matches common stereo formats: side-by-side, anaglyph, interlaced.
 */

export interface StereoscopicInfo {
  isStereoscopic: boolean;
  format?: 'side-by-side' | 'anaglyph' | 'interlaced' | 'over-under';
}

const STEREO_KEYWORDS = /stereo|3d|side-by-side|anaglyph|interlaced|cross-eye|parallel/i;

export function detectStereoscopicFromUri(uri: string): StereoscopicInfo {
  const filename = uri.split('/').pop()?.toLowerCase() || '';

  // Keyword-based detection
  if (STEREO_KEYWORDS.test(filename)) {
    if (/anaglyph/.test(filename)) {
      return { isStereoscopic: true, format: 'anaglyph' };
    }
    if (/side|parallel|cross/.test(filename)) {
      return { isStereoscopic: true, format: 'side-by-side' };
    }
    if (/interlaced|interleaved/.test(filename)) {
      return { isStereoscopic: true, format: 'interlaced' };
    }
    return { isStereoscopic: true, format: 'side-by-side' };
  }

  return { isStereoscopic: false };
}

export function detectStereoscopicFromDimensions(width: number, height: number): StereoscopicInfo {
  const aspect = width / height;

  // Side-by-side: ~2:1 aspect ratio
  if (aspect > 1.8 && aspect < 2.2) {
    return { isStereoscopic: true, format: 'side-by-side' };
  }

  // Over-under: ~0.5:1 aspect ratio
  if (aspect > 0.45 && aspect < 0.55) {
    return { isStereoscopic: true, format: 'over-under' };
  }

  return { isStereoscopic: false };
}

/** The device tilt, in degrees, that takes the view all the way from one eye to the other. */
const FULL_TILT_DEG = 15;

/** RF-071: how far between the left (0) and right (1) eye the view is, for a sideways tilt. */
export function eyeMix(tiltDeg: number): number {
  return Math.max(0, Math.min(1, 0.5 + tiltDeg / (2 * FULL_TILT_DEG)));
}

/** The same swing with no sensor, `ms` into it: slow, or it looks like a flicker. */
export function autoEyeMix(ms: number): number {
  return 0.5 + 0.5 * Math.sin(ms / 500);
}

/** Which part of the picture holds each eye. Null for a format that has no two separate views. */
export function eyeRects(format: StereoscopicInfo['format'], width: number, height: number) {
  if (format === 'side-by-side') {
    const w = Math.floor(width / 2);
    return { left: { x: 0, y: 0, w, h: height }, right: { x: w, y: 0, w, h: height } };
  }
  if (format === 'over-under') {
    const h = Math.floor(height / 2);
    return { left: { x: 0, y: 0, w: width, h }, right: { x: 0, y: h, w: width, h } };
  }
  return null;
}

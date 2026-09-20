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

export function detectStereoscopicFromDimensions(
  width: number,
  height: number
): StereoscopicInfo {
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

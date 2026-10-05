/**
 * RF-021: 360° video detection via filename patterns and EXIF projection metadata.
 */

export interface SphericalInfo {
  isSpherical: boolean;
  projection?: 'equirectangular' | 'cubemap' | 'fisheye';
}

const SPHERICAL_KEYWORDS = /360|spherical|equirectangular|omnidirectional|immersive/i;

export function detectSphericalFromUri(uri: string): SphericalInfo {
  const filename = uri.split('/').pop()?.toLowerCase() || '';

  // Keyword-based detection
  if (SPHERICAL_KEYWORDS.test(filename)) {
    if (/equirect/.test(filename)) {
      return { isSpherical: true, projection: 'equirectangular' };
    }
    if (/cubemap|cube/.test(filename)) {
      return { isSpherical: true, projection: 'cubemap' };
    }
    if (/fisheye/.test(filename)) {
      return { isSpherical: true, projection: 'fisheye' };
    }
    // Default to equirectangular (most common)
    return { isSpherical: true, projection: 'equirectangular' };
  }

  return { isSpherical: false };
}

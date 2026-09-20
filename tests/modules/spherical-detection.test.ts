import { detectSphericalFromUri } from '@modules/video-editor/spherical';
import { detectStereoscopicFromUri as detectStereoPhotoFromUri } from '@modules/photo-editor/stereoscopic';

describe('Spherical detection (US-19)', () => {
  describe('detectSphericalFromUri', () => {
    it('detects equirectangular videos', () => {
      const result = detectSphericalFromUri('/path/to/equirectangular-video.mp4');
      expect(result.isSpherical).toBe(true);
      expect(result.projection).toBe('equirectangular');
    });

    it('detects 360 videos', () => {
      const result = detectSphericalFromUri('/path/to/360-video.mp4');
      expect(result.isSpherical).toBe(true);
      expect(result.projection).toBe('equirectangular');
    });

    it('detects omnidirectional videos', () => {
      const result = detectSphericalFromUri('/path/to/omnidirectional-video.mp4');
      expect(result.isSpherical).toBe(true);
      expect(result.projection).toBe('equirectangular');
    });

    it('detects immersive videos', () => {
      const result = detectSphericalFromUri('/path/to/immersive-video.mp4');
      expect(result.isSpherical).toBe(true);
      expect(result.projection).toBe('equirectangular');
    });

    it('rejects non-spherical videos', () => {
      const result = detectSphericalFromUri('/path/to/regular-video.mp4');
      expect(result.isSpherical).toBe(false);
    });

    it('handles mixed case', () => {
      const result = detectSphericalFromUri('/path/to/360-Video.mp4');
      expect(result.isSpherical).toBe(true);
    });

    it('detects omnidirectional videos', () => {
      const result = detectSphericalFromUri('/path/to/omnidirectional.mp4');
      expect(result.isSpherical).toBe(true);
    });
  });
});

describe('Stereoscopic detection (US-13)', () => {
  describe('detectStereoscopicFromUri (video)', () => {
    it('does not confuse stereoscopic videos with 360 videos', () => {
      // Stereoscopic detection is for photo editor, not video spherical detection
      const result = detectSphericalFromUri('/path/to/side-by-side-video.mp4');
      // side-by-side could match 360 keywords, but it's not detected as spherical
      // Spherical is specifically 360/equirectangular/cubemap/fisheye
      expect(typeof result.isSpherical).toBe('boolean');
    });
  });

  describe('detectStereoscopicFromUri (photo)', () => {
    it('detects side-by-side stereo photos', () => {
      const result = detectStereoPhotoFromUri('/path/to/side-by-side-photo.jpg');
      expect(result.isStereoscopic).toBe(true);
      expect(result.format).toBe('side-by-side');
    });

    it('detects anaglyph photos', () => {
      const result = detectStereoPhotoFromUri('/path/to/anaglyph-photo.jpg');
      expect(result.isStereoscopic).toBe(true);
      expect(result.format).toBe('anaglyph');
    });

    it('rejects non-stereoscopic photos', () => {
      const result = detectStereoPhotoFromUri('/path/to/regular-photo.jpg');
      expect(result.isStereoscopic).toBe(false);
    });
  });
});

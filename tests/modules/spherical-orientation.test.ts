import { createClip, setSphericalOrientation } from '@modules/video-editor';

describe('Spherical orientation (US-19)', () => {
  describe('setSphericalOrientation', () => {
    it('sets all three orientation angles', () => {
      const clip = createClip({
        name: 'Test 360 Video',
        sourceUri: 'file:///path/to/360-video.mp4',
        color: '#FF0000',
        startMs: 0,
        sourceDurationMs: 10000,
      });

      const updated = setSphericalOrientation(clip, 45, 90, -30);

      expect(updated.sphericalPitch).toBe(45);
      expect(updated.sphericalYaw).toBe(90);
      expect(updated.sphericalRoll).toBe(-30);
    });

    it('clamps pitch to -90..90', () => {
      const clip = createClip({
        name: 'Test',
        sourceUri: 'file:///360.mp4',
        color: '#FF0000',
        startMs: 0,
        sourceDurationMs: 10000,
      });

      const updated = setSphericalOrientation(clip, 150, 0, 0);
      expect(updated.sphericalPitch).toBe(90);

      const updated2 = setSphericalOrientation(clip, -150, 0, 0);
      expect(updated2.sphericalPitch).toBe(-90);
    });

    it('clamps yaw to -180..180', () => {
      const clip = createClip({
        name: 'Test',
        sourceUri: 'file:///360.mp4',
        color: '#FF0000',
        startMs: 0,
        sourceDurationMs: 10000,
      });

      const updated = setSphericalOrientation(clip, 0, 270, 0);
      expect(updated.sphericalYaw).toBe(180);

      const updated2 = setSphericalOrientation(clip, 0, -270, 0);
      expect(updated2.sphericalYaw).toBe(-180);
    });

    it('clamps roll to -180..180', () => {
      const clip = createClip({
        name: 'Test',
        sourceUri: 'file:///360.mp4',
        color: '#FF0000',
        startMs: 0,
        sourceDurationMs: 10000,
      });

      const updated = setSphericalOrientation(clip, 0, 0, 360);
      expect(updated.sphericalRoll).toBe(180);

      const updated2 = setSphericalOrientation(clip, 0, 0, -360);
      expect(updated2.sphericalRoll).toBe(-180);
    });

    it('preserves other clip properties', () => {
      const clip = createClip({
        name: 'Test 360 Video',
        sourceUri: 'file:///path/to/360-video.mp4',
        color: '#FF0000',
        startMs: 5000,
        sourceDurationMs: 10000,
        inPointMs: 1000,
        outPointMs: 9000,
      });

      const updated = setSphericalOrientation(clip, 30, 60, -10);

      expect(updated.name).toBe('Test 360 Video');
      expect(updated.sourceUri).toBe('file:///path/to/360-video.mp4');
      expect(updated.color).toBe('#FF0000');
      expect(updated.startMs).toBe(5000);
      expect(updated.inPointMs).toBe(1000);
      expect(updated.outPointMs).toBe(9000);
      expect(updated.sphericalPitch).toBe(30);
      expect(updated.sphericalYaw).toBe(60);
      expect(updated.sphericalRoll).toBe(-10);
    });

    it('allows zero orientation', () => {
      const clip = createClip({
        name: 'Test',
        sourceUri: 'file:///360.mp4',
        color: '#FF0000',
        startMs: 0,
        sourceDurationMs: 10000,
      });

      const updated = setSphericalOrientation(clip, 0, 0, 0);
      expect(updated.sphericalPitch).toBe(0);
      expect(updated.sphericalYaw).toBe(0);
      expect(updated.sphericalRoll).toBe(0);
    });

    it('allows extreme valid values', () => {
      const clip = createClip({
        name: 'Test',
        sourceUri: 'file:///360.mp4',
        color: '#FF0000',
        startMs: 0,
        sourceDurationMs: 10000,
      });

      const updated = setSphericalOrientation(clip, -90, -180, -180);
      expect(updated.sphericalPitch).toBe(-90);
      expect(updated.sphericalYaw).toBe(-180);
      expect(updated.sphericalRoll).toBe(-180);

      const updated2 = setSphericalOrientation(clip, 90, 180, 180);
      expect(updated2.sphericalPitch).toBe(90);
      expect(updated2.sphericalYaw).toBe(180);
      expect(updated2.sphericalRoll).toBe(180);
    });
  });
});

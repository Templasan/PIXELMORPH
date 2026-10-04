import { createClip, rotateClip } from '../../src/modules/video-editor/Track';

describe('rotateClip (RF-078)', () => {
  const clip = createClip({
    name: 'Praia',
    sourceUri: 'file:///v.mp4',
    color: '#fff',
    startMs: 0,
    sourceDurationMs: 10_000,
  });

  it('starts unrotated and turns clockwise in quarter steps', () => {
    expect(clip.rotation).toBeUndefined();
    const once = rotateClip(clip, 90);
    expect(once.rotation).toBe(90);
    expect(rotateClip(once, 90).rotation).toBe(180);
  });

  it('wraps around 360 in both directions', () => {
    expect(rotateClip(rotateClip(clip, 270), 90).rotation).toBe(0);
    expect(rotateClip(clip, -90).rotation).toBe(270);
  });

  it('does not touch the original clip', () => {
    rotateClip(clip, 90);
    expect(clip.rotation).toBeUndefined();
  });
});

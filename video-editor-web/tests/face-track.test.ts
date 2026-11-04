import { poseAt, trackFaces, type DetectedFace } from '../src/domain/faceTrack';

const face = (x: number, y = 0.3, w = 0.2): DetectedFace => ({
  x,
  y,
  w,
  h: w,
  leftEye: { x: x + 0.05, y: y + 0.05 },
  rightEye: { x: x + 0.15, y: y + 0.05 },
  mouthLeft: { x: x + 0.05, y: y + 0.15 },
  mouthRight: { x: x + 0.15, y: y + 0.15 },
  mouthBottom: null,
});

describe('trackFaces', () => {
  it('keeps two moving faces apart, even when listed the other way round', () => {
    const tracks = trackFaces(
      [
        { ms: 0, faces: [face(0.1), face(0.6)] },
        { ms: 500, faces: [face(0.65), face(0.15)] },
        { ms: 1000, faces: [face(0.2), face(0.7)] },
      ],
      500
    );
    expect(tracks).toHaveLength(2);
    const left = tracks.find((t) => t.poses[0].x === 0.1)!;
    expect(left.poses.map((p) => p.x)).toEqual([0.1, 0.15, 0.2]);
    expect(tracks.find((t) => t !== left)!.poses.map((p) => p.x)).toEqual([0.6, 0.65, 0.7]);
  });

  it('survives a few samples without the face, not a long absence', () => {
    const blink = trackFaces([{ ms: 0, faces: [face(0.1)] }, { ms: 500, faces: [] }, { ms: 1000, faces: [face(0.1)] }], 500);
    expect(blink).toHaveLength(1);
    const gone = trackFaces([{ ms: 0, faces: [face(0.1)] }, { ms: 500, faces: [face(0.1)] }, { ms: 9000, faces: [face(0.1)] }, { ms: 9500, faces: [face(0.1)] }], 500);
    expect(gone).toHaveLength(2);
  });

  it('drops what was seen only once, and a far jump is another face', () => {
    expect(trackFaces([{ ms: 0, faces: [face(0.1)] }], 500)).toEqual([]);
    expect(trackFaces([{ ms: 0, faces: [face(0.05)] }, { ms: 500, faces: [face(0.7)] }], 500)).toEqual([]);
  });

  it('starts gently, and puts the largest face first', () => {
    const [big] = trackFaces(
      [
        { ms: 0, faces: [face(0.1, 0.3, 0.1), face(0.6, 0.3, 0.3)] },
        { ms: 500, faces: [face(0.1, 0.3, 0.1), face(0.6, 0.3, 0.3)] },
      ],
      500
    );
    expect(big.poses[0].w).toBe(0.3);
    expect([big.smooth, big.eyes, big.tone]).toEqual([35, 0, 0]);
  });
});

describe('poseAt', () => {
  const [track] = trackFaces([{ ms: 1000, faces: [face(0.1)] }, { ms: 2000, faces: [face(0.25)] }], 1000);
  it('moves between samples', () => {
    const p = poseAt(track.poses, 1500)!;
    expect(p.x).toBeCloseTo(0.175);
    expect(p.leftEye!.x).toBeCloseTo(0.225);
    expect(p.mouth!.w).toBeCloseTo(0.1);
  });
  it('is nowhere before the first sample or after the last', () => {
    expect(poseAt(track.poses, 999)).toBeNull();
    expect(poseAt(track.poses, 2001)).toBeNull();
    expect(poseAt(track.poses, 2000)!.x).toBeCloseTo(0.25);
  });
});

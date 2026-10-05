import { snapToGuides } from '@modules/photo-editor/geometry';

describe('snapToGuides', () => {
  it('snaps to the horizontal/vertical center when within the threshold', () => {
    const result = snapToGuides(0.51, 0.49, 0.02);
    expect(result).toMatchObject({ x: 0.5, y: 0.5, snappedX: true, snappedY: true });
  });

  it('snaps only the axis that is within range', () => {
    const result = snapToGuides(0.51, 0.2, 0.02);
    expect(result).toMatchObject({ x: 0.5, y: 0.2, snappedX: true, snappedY: false });
    expect(result.guideY).toBeNull();
  });

  it('leaves the position untouched when outside the threshold', () => {
    const result = snapToGuides(0.2, 0.8, 0.02);
    expect(result).toMatchObject({ x: 0.2, y: 0.8, snappedX: false, snappedY: false });
  });

  it('snaps to the nearest extra target (other layers) and reports the guide', () => {
    const result = snapToGuides(0.31, 0.7, 0.02, { x: [0.3, 0.9], y: [0.71] });
    expect(result).toMatchObject({ x: 0.3, y: 0.71, guideX: 0.3, guideY: 0.71 });
  });

  it('picks the closest target when several are in range', () => {
    const result = snapToGuides(0.495, 0.1, 0.02, { x: [0.48], y: [] });
    expect(result.x).toBe(0.5);
  });
});

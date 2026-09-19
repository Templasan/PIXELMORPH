import { snapToGuides } from '@modules/photo-editor/geometry';

describe('snapToGuides', () => {
  it('snaps to the horizontal/vertical center when within the threshold', () => {
    const result = snapToGuides(0.51, 0.49, 0.02);
    expect(result).toEqual({ x: 0.5, y: 0.5, snappedX: true, snappedY: true });
  });

  it('snaps only the axis that is within range', () => {
    const result = snapToGuides(0.51, 0.2, 0.02);
    expect(result).toEqual({ x: 0.5, y: 0.2, snappedX: true, snappedY: false });
  });

  it('leaves the position untouched when outside the threshold', () => {
    const result = snapToGuides(0.2, 0.8, 0.02);
    expect(result).toEqual({ x: 0.2, y: 0.8, snappedX: false, snappedY: false });
  });
});

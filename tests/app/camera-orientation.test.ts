import { quarterTurnsOf } from '../../src/app/screens/camera/cameraFormat';

test('turns a captured picture upright by its orientation', () => {
  expect(quarterTurnsOf('up')).toBe(0);
  expect(quarterTurnsOf('right')).toBe(1);
  expect(quarterTurnsOf('down')).toBe(2);
  expect(quarterTurnsOf('left')).toBe(3);
});

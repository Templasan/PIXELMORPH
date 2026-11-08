import { sizeFromExif } from '../../src/app/screens/camera/cameraFormat';

test('swaps the size only for sideways EXIF orientations', () => {
  expect(sizeFromExif(4096, 3072, 6)).toEqual({ width: 3072, height: 4096 });
  expect(sizeFromExif(4096, 3072, '8')).toEqual({ width: 3072, height: 4096 });
  expect(sizeFromExif(4096, 3072, 1)).toEqual({ width: 4096, height: 3072 });
  expect(sizeFromExif(4096, 3072, 3)).toEqual({ width: 4096, height: 3072 });
  expect(sizeFromExif(4096, 3072, undefined)).toEqual({ width: 4096, height: 3072 });
});

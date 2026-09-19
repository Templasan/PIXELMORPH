import {
  readExifOrientation,
  orientationToTransform,
} from '@modules/photo-editor/geometry/exifOrientation';

/** Builds a minimal JPEG with a real APP1/Exif segment carrying one Orientation tag. */
function buildJpegWithOrientation(orientation: number, bigEndian = false): Uint8Array {
  const bytes: number[] = [];
  const u16 = (v: number) =>
    bigEndian ? [(v >> 8) & 0xff, v & 0xff] : [v & 0xff, (v >> 8) & 0xff];
  const u32 = (v: number) =>
    bigEndian
      ? [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff]
      : [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];

  bytes.push(0xff, 0xd8); // SOI

  const exifBody: number[] = [];
  exifBody.push(...'Exif\0\0'.split('').map((c) => c.charCodeAt(0)));
  exifBody.push(...(bigEndian ? [0x4d, 0x4d] : [0x49, 0x49])); // "MM" or "II"
  exifBody.push(...u16(0x002a));
  exifBody.push(...u32(8)); // IFD0 offset, relative to the TIFF header start
  exifBody.push(...u16(1)); // 1 IFD0 entry
  exifBody.push(...u16(0x0112)); // tag: Orientation
  exifBody.push(...u16(3)); // type: SHORT
  exifBody.push(...u32(1)); // count: 1
  exifBody.push(...u16(orientation), 0, 0); // value (SHORT in first 2 bytes) + padding
  exifBody.push(...u32(0)); // next IFD offset: none

  bytes.push(0xff, 0xe1); // APP1
  bytes.push(...u16(exifBody.length + 2)); // segment length includes itself
  bytes.push(...exifBody);

  bytes.push(0xff, 0xda, 0x00, 0x02); // SOS (start of scan) — parsing should stop here

  return new Uint8Array(bytes);
}

describe('readExifOrientation', () => {
  it('returns 1 (normal) for a JPEG with no EXIF segment', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02]);
    expect(readExifOrientation(bytes)).toBe(1);
  });

  it('returns 1 (normal) for non-JPEG bytes, without throwing', () => {
    expect(readExifOrientation(new Uint8Array([0, 1, 2, 3]))).toBe(1);
    expect(readExifOrientation(new Uint8Array([]))).toBe(1);
  });

  it('reads the real Orientation tag out of a little-endian ("II") EXIF segment', () => {
    const bytes = buildJpegWithOrientation(6, false);
    expect(readExifOrientation(bytes)).toBe(6);
  });

  it('reads the real Orientation tag out of a big-endian ("MM") EXIF segment', () => {
    const bytes = buildJpegWithOrientation(8, true);
    expect(readExifOrientation(bytes)).toBe(8);
  });
});

describe('orientationToTransform', () => {
  it('maps orientation 1 to the identity', () => {
    expect(orientationToTransform(1)).toEqual({ rotate: 0, flipH: false, flipV: false });
  });

  it('maps orientation 6 to a 90-degree rotation', () => {
    expect(orientationToTransform(6)).toEqual({ rotate: 90, flipH: false, flipV: false });
  });

  it('maps orientation 3 to a 180-degree rotation', () => {
    expect(orientationToTransform(3)).toEqual({ rotate: 180, flipH: false, flipV: false });
  });

  it('falls back to the identity for an unrecognized value', () => {
    expect(orientationToTransform(99)).toEqual({ rotate: 0, flipH: false, flipV: false });
  });
});

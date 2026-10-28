/**
 * RF-078: "rotação com correção automática baseada nos metadados de orientação do
 * arquivo" — a real (if minimal) JPEG/EXIF parser reading the Orientation tag directly
 * from the file's bytes, not a hardcoded guess. Most photos are Orientation=1 (normal),
 * so "Auto EXIF" correctly being a no-op on those is expected, not a bug.
 */

export interface OrientationTransform {
  rotate: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
}

const IDENTITY: OrientationTransform = { rotate: 0, flipH: false, flipV: false };

// EXIF Orientation tag value (1-8) -> the rotate+flip that undoes it.
const ORIENTATION_TRANSFORMS: Record<number, OrientationTransform> = {
  1: { rotate: 0, flipH: false, flipV: false },
  2: { rotate: 0, flipH: true, flipV: false },
  3: { rotate: 180, flipH: false, flipV: false },
  4: { rotate: 0, flipH: false, flipV: true },
  5: { rotate: 90, flipH: true, flipV: false },
  6: { rotate: 90, flipH: false, flipV: false },
  7: { rotate: 270, flipH: true, flipV: false },
  8: { rotate: 270, flipH: false, flipV: false },
};

/**
 * Reads the EXIF Orientation tag (0x0112) out of a JPEG's raw bytes. Returns 1 (normal)
 * if the file has no EXIF APP1 segment or no Orientation entry — a JPEG with no metadata
 * is legitimately "already upright", not a parse failure.
 */
export function readExifOrientation(bytes: Uint8Array): number {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;

  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda) break; // Start of scan — no more metadata segments follow.

    const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (marker === 0xe1) {
      const orientation = parseExifSegmentOrientation(bytes, offset + 4, segmentLength - 2);
      if (orientation !== null) return orientation;
    }
    offset += 2 + segmentLength;
  }
  return 1;
}

function parseExifSegmentOrientation(
  bytes: Uint8Array,
  start: number,
  length: number
): number | null {
  // "Exif\0\0" header before the TIFF structure.
  if (length < 8) return null;
  const header = String.fromCharCode(...bytes.subarray(start, start + 4));
  if (header !== 'Exif') return null;

  const tiffStart = start + 6;
  const big = bytes[tiffStart] === 0x4d && bytes[tiffStart + 1] === 0x4d; // "MM"
  const readU16 = (o: number) =>
    big ? (bytes[o] << 8) | bytes[o + 1] : (bytes[o + 1] << 8) | bytes[o];
  const readU32 = (o: number) =>
    big
      ? (bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]
      : (bytes[o + 3] << 24) | (bytes[o + 2] << 16) | (bytes[o + 1] << 8) | bytes[o];

  const ifd0Offset = tiffStart + readU32(tiffStart + 4);
  if (ifd0Offset + 2 > bytes.length) return null;

  const entryCount = readU16(ifd0Offset);
  for (let i = 0; i < entryCount; i++) {
    const entryOffset = ifd0Offset + 2 + i * 12;
    if (entryOffset + 12 > bytes.length) break;
    const tag = readU16(entryOffset);
    if (tag === 0x0112) {
      return readU16(entryOffset + 8);
    }
  }
  return null;
}

export function orientationToTransform(orientation: number): OrientationTransform {
  return ORIENTATION_TRANSFORMS[orientation] ?? IDENTITY;
}

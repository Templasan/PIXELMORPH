/**
 * Pure byte-level helpers for exported images: writes the DPI into a JPEG (JFIF APP0) or PNG
 * (pHYs chunk) and encodes base64. Deliberately Skia-free so it runs under Jest.
 */

const JFIF_MAX_DENSITY = 65535;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JFIF_TAG = [0x4a, 0x46, 0x49, 0x46, 0x00]; // "JFIF" + NUL

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out +=
      B64[(n >> 18) & 63] +
      B64[(n >> 12) & 63] +
      (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') +
      (i + 2 < bytes.length ? B64[n & 63] : '=');
  }
  return out;
}

function u16(bytes: Uint8Array, at: number): number {
  return (bytes[at] << 8) | bytes[at + 1];
}

function u32(bytes: Uint8Array, at: number): number {
  return ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
}

function writeU16(bytes: Uint8Array, at: number, value: number): void {
  bytes[at] = (value >>> 8) & 0xff;
  bytes[at + 1] = value & 0xff;
}

function writeU32(bytes: Uint8Array, at: number, value: number): void {
  bytes[at] = (value >>> 24) & 0xff;
  bytes[at + 1] = (value >>> 16) & 0xff;
  bytes[at + 2] = (value >>> 8) & 0xff;
  bytes[at + 3] = value & 0xff;
}

function hasJfifTag(bytes: Uint8Array): boolean {
  return JFIF_TAG.every((b, i) => bytes[6 + i] === b);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** Returns a copy of the JPEG whose JFIF density is `dpi` (units = dots per inch). */
export function setJpegDpi(jpeg: Uint8Array, dpi: number): Uint8Array {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('setJpegDpi: not a JPEG');
  const density = Math.min(JFIF_MAX_DENSITY, Math.max(1, Math.round(dpi)));

  if (jpeg.length >= 20 && jpeg[2] === 0xff && jpeg[3] === 0xe0 && hasJfifTag(jpeg)) {
    const out = jpeg.slice();
    out[13] = 1; // units: dots per inch
    writeU16(out, 14, density);
    writeU16(out, 16, density);
    return out;
  }

  // No JFIF header yet: insert a standard 18-byte APP0 directly after SOI, where JFIF requires it.
  const app0 = new Uint8Array(18);
  app0.set([0xff, 0xe0, 0x00, 0x10], 0);
  app0.set(JFIF_TAG, 4);
  app0.set([0x01, 0x01, 0x01], 9); // version 1.01, units: dpi
  writeU16(app0, 12, density);
  writeU16(app0, 14, density);
  return concat([jpeg.subarray(0, 2), app0, jpeg.subarray(2)]);
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  writeU32(chunk, 0, data.length);
  for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i);
  chunk.set(data, 8);
  writeU32(chunk, 8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  return chunk;
}

/** Returns a copy of the PNG with its pHYs chunk set to `dpi`, placed right after IHDR. */
export function setPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  if (!PNG_SIGNATURE.every((b, i) => png[i] === b)) throw new Error('setPngDpi: not a PNG');
  const pixelsPerMetre = Math.round(Math.max(1, dpi) / 0.0254);
  const phys = new Uint8Array(9);
  writeU32(phys, 0, pixelsPerMetre);
  writeU32(phys, 4, pixelsPerMetre);
  phys[8] = 1; // unit: metre

  const parts: Uint8Array[] = [png.subarray(0, 8)];
  let at = 8;
  while (at < png.length) {
    if (at + 12 > png.length) throw new Error('setPngDpi: truncated chunk');
    const end = at + 12 + u32(png, at);
    if (end > png.length) throw new Error('setPngDpi: truncated chunk');
    const type = String.fromCharCode(png[at + 4], png[at + 5], png[at + 6], png[at + 7]);
    if (type !== 'pHYs') parts.push(png.subarray(at, end));
    if (type === 'IHDR') parts.push(pngChunk('pHYs', phys));
    at = end;
  }
  return concat(parts);
}

/** Reads back the DPI a JPEG declares in its JFIF header, or null when it has none. */
export function readJpegDpi(jpeg: Uint8Array): { x: number; y: number; units: number } | null {
  if (jpeg.length < 20 || !hasJfifTag(jpeg)) return null;
  return { units: jpeg[13], x: u16(jpeg, 14), y: u16(jpeg, 16) };
}

/** Reads back the pHYs chunk of a PNG (pixels per metre), or null when it has none. */
export function readPngPhys(png: Uint8Array): { x: number; y: number; unit: number } | null {
  let at = 8;
  while (at + 12 <= png.length) {
    const type = String.fromCharCode(png[at + 4], png[at + 5], png[at + 6], png[at + 7]);
    if (type === 'pHYs') {
      return { x: u32(png, at + 8), y: u32(png, at + 12), unit: png[at + 16] };
    }
    at += 12 + u32(png, at);
  }
  return null;
}

/**
 * RF-051 and RF-073: colour for print and other screens. Pure, works on RGBA bytes in place.
 * The print proof uses typical offset ink colours: a simulation to judge a picture, not a
 * calibrated profile of a press.
 */
export type ExportColorSpace = 'srgb' | 'display-p3' | 'adobe-rgb';

export const COLOR_SPACES: readonly { id: ExportColorSpace; name: string }[] = [
  { id: 'srgb', name: 'sRGB' },
  { id: 'display-p3', name: 'DCI-P3' },
  { id: 'adobe-rgb', name: 'Adobe RGB' },
];

const INKS = {
  c: [0, 174, 239],
  m: [236, 0, 140],
  y: [255, 242, 0],
  k: [35, 31, 32],
} as const;

/** RF-073: how the picture would print: converted to four inks, then laid on white paper. */
export function proofCmyk(rgba: Uint8ClampedArray) {
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i] / 255;
    const g = rgba[i + 1] / 255;
    const b = rgba[i + 2] / 255;
    const k = 1 - Math.max(r, g, b);
    const rest = 1 - k || 1;
    const c = (1 - r - k) / rest;
    const m = (1 - g - k) / rest;
    const y = (1 - b - k) / rest;
    for (let ch = 0; ch < 3; ch += 1) {
      rgba[i + ch] =
        255 *
        (1 - c * (1 - INKS.c[ch] / 255)) *
        (1 - m * (1 - INKS.m[ch] / 255)) *
        (1 - y * (1 - INKS.y[ch] / 255)) *
        (1 - k * (1 - INKS.k[ch] / 255));
    }
  }
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const ADOBE_GAMMA = 2.19921875;

/** RF-051: sRGB values to Adobe RGB (1998) values, same colours. */
export function srgbToAdobeRgb(rgba: Uint8ClampedArray) {
  for (let i = 0; i < rgba.length; i += 4) {
    const r = toLinear(rgba[i] / 255);
    const g = toLinear(rgba[i + 1] / 255);
    const b = toLinear(rgba[i + 2] / 255);
    const encode = (v: number) => 255 * Math.max(0, Math.min(1, v)) ** (1 / ADOBE_GAMMA);
    rgba[i] = encode(0.7152 * r + 0.2848 * g);
    rgba[i + 1] = encode(g);
    rgba[i + 2] = encode(0.0412 * g + 0.9588 * b);
  }
}

function fixed(v: number): number[] {
  const n = Math.round(v * 65536);
  return [(n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const be32 = (n: number) => [(n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255];

/** A minimal matrix ICC profile (v2) for Adobe RGB (1998), so other apps read the colours right. */
export function adobeRgbProfile(): Uint8Array {
  const xyz = (x: number, y: number, z: number) => [...ascii('XYZ '), 0, 0, 0, 0, ...fixed(x), ...fixed(y), ...fixed(z)];
  const curve = [...ascii('curv'), 0, 0, 0, 0, 0, 0, 0, 1, Math.floor(ADOBE_GAMMA), Math.round((ADOBE_GAMMA % 1) * 256)];
  const text = (s: string) => [...ascii('text'), 0, 0, 0, 0, ...ascii(s), 0];
  const desc = (s: string) => [
    ...ascii('desc'), 0, 0, 0, 0, ...be32(s.length + 1), ...ascii(s), 0,
    ...new Array<number>(4 + 4 + 2 + 1 + 67).fill(0),
  ];
  const tags: [string, number[]][] = [
    ['desc', desc('Adobe RGB (1998) compatible')],
    ['cprt', text('Public domain')],
    ['wtpt', xyz(0.9642, 1, 0.8249)],
    ['rXYZ', xyz(0.60974, 0.31111, 0.01947)],
    ['gXYZ', xyz(0.20528, 0.62567, 0.06087)],
    ['bXYZ', xyz(0.14919, 0.06322, 0.74457)],
    ['rTRC', curve],
    ['gTRC', curve],
    ['bTRC', curve],
  ];
  const tableSize = 4 + tags.length * 12;
  let offset = 128 + tableSize;
  const table: number[] = [...be32(tags.length)];
  const bodies: number[] = [];
  for (const [sig, body] of tags) {
    const padded = [...body, ...new Array<number>((4 - (body.length % 4)) % 4).fill(0)];
    table.push(...ascii(sig), ...be32(offset), ...be32(body.length));
    bodies.push(...padded);
    offset += padded.length;
  }
  const header = new Array<number>(128).fill(0);
  header.splice(0, 4, ...be32(offset));
  header.splice(8, 4, 0x02, 0x40, 0, 0);
  header.splice(12, 12, ...ascii('mntrRGB XYZ '));
  header.splice(36, 4, ...ascii('acsp'));
  header.splice(68, 12, ...fixed(0.9642), ...fixed(1), ...fixed(0.8249));
  return Uint8Array.from([...header, ...table, ...bodies]);
}

const JPEG_ICC_TAG = [...ascii('ICC_PROFILE'), 0, 1, 1];

/** Puts an ICC profile in a JPEG, in one APP2 segment, replacing any it already has. */
export function setJpegIcc(jpeg: Uint8Array, profile: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [jpeg.subarray(0, 2)];
  const size = 2 + JPEG_ICC_TAG.length + profile.length;
  const segment = Uint8Array.from([0xff, 0xe2, (size >> 8) & 255, size & 255, ...JPEG_ICC_TAG, ...profile]);
  let at = 2;
  let placed = false;
  // Walks the segments up to the image data, which is copied whole.
  while (at + 4 <= jpeg.length && jpeg[at] === 0xff && jpeg[at + 1] !== 0xda) {
    const end = at + 2 + ((jpeg[at + 2] << 8) | jpeg[at + 3]);
    const tag = String.fromCharCode(...jpeg.subarray(at + 4, at + 15));
    const isIcc = jpeg[at + 1] === 0xe2 && tag === 'ICC_PROFILE';
    // Right after APP0 or APP1: a reader expects those first.
    if (!placed && jpeg[at + 1] !== 0xe0 && jpeg[at + 1] !== 0xe1) {
      parts.push(segment);
      placed = true;
    }
    if (!isIcc) parts.push(jpeg.subarray(at, end));
    at = end;
  }
  if (!placed) parts.push(segment);
  parts.push(jpeg.subarray(at));
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let w = 0;
  for (const part of parts) {
    out.set(part, w);
    w += part.length;
  }
  return out;
}

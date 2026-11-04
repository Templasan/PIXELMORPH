/**
 * RF-040: writes a Photoshop file, layers included. Pure bytes, so it can be tested without a
 * canvas. Each layer is RGBA pixels with its own place, opacity and blend; RLE keeps the size down.
 */
export interface PsdLayer {
  name: string;
  left: number;
  top: number;
  width: number;
  height: number;
  /** width * height * 4 bytes. */
  rgba: Uint8ClampedArray;
  /** 0..255 */
  opacity: number;
  /** A canvas composite operation; unknown ones are written as normal. */
  blend: string;
  /** Shows only inside the layer below. */
  clip: boolean;
  visible: boolean;
  /** A layer mask covering the whole picture, read from the alpha of these RGBA pixels. */
  mask?: Uint8ClampedArray;
}

const BLEND_KEYS: Record<string, string> = {
  'source-over': 'norm',
  multiply: 'mul ',
  screen: 'scrn',
  overlay: 'over',
  'soft-light': 'sLit',
  darken: 'dark',
  lighten: 'lite',
  difference: 'diff',
};

class Writer {
  private chunks: Uint8Array[] = [];
  length = 0;
  bytes(b: Uint8Array) {
    this.chunks.push(b);
    this.length += b.length;
    return this;
  }
  u8(v: number) {
    return this.bytes(Uint8Array.of(v & 255));
  }
  u16(v: number) {
    return this.bytes(Uint8Array.of((v >> 8) & 255, v & 255));
  }
  u32(v: number) {
    return this.bytes(Uint8Array.of((v >>> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255));
  }
  ascii(s: string) {
    return this.bytes(Uint8Array.from(s, (c) => c.charCodeAt(0)));
  }
  concat(): Uint8Array {
    const out = new Uint8Array(this.length);
    let at = 0;
    for (const c of this.chunks) {
      out.set(c, at);
      at += c.length;
    }
    return out;
  }
}

/** PackBits, the RLE Photoshop reads. */
function packBits(row: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < row.length) {
    let run = 1;
    while (i + run < row.length && run < 128 && row[i + run] === row[i]) run += 1;
    if (run >= 2) {
      out.push(257 - run, row[i]);
      i += run;
      continue;
    }
    const start = i;
    i += 1;
    while (i < row.length && i - start < 128 && !(i + 1 < row.length && row[i] === row[i + 1])) i += 1;
    out.push(i - start - 1);
    for (let k = start; k < i; k += 1) out.push(row[k]);
  }
  return Uint8Array.from(out);
}

/** One channel: rows' compressed lengths, then the rows. */
function rleChannel(rgba: Uint8ClampedArray, width: number, height: number, channel: number): { table: Writer; rows: Writer } {
  const table = new Writer();
  const rows = new Writer();
  const row = new Uint8Array(width);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) row[x] = rgba[(y * width + x) * 4 + channel];
    const packed = packBits(row);
    table.u16(packed.length);
    rows.bytes(packed);
  }
  return { table, rows };
}

function pascalName(name: string): Uint8Array {
  // MacRoman in the original format: anything else is replaced rather than garbled.
  const safe = Array.from(name.slice(0, 31), (c) => (c.charCodeAt(0) < 128 ? c.charCodeAt(0) : 63));
  const pad = (4 - ((safe.length + 1) % 4)) % 4;
  return Uint8Array.from([safe.length, ...safe, ...new Array<number>(pad).fill(0)]);
}

/** Layers bottom first. `composite` is the finished picture, shown by anything that skips layers. */
export function encodePsd(
  width: number,
  height: number,
  layers: readonly PsdLayer[],
  composite: Uint8ClampedArray,
  dpi: number
): Uint8Array {
  const out = new Writer();
  out.ascii('8BPS').u16(1).bytes(new Uint8Array(6)).u16(3).u32(height).u32(width).u16(8).u16(3);
  out.u32(0); // no colour mode data

  // Image resources: the print resolution (0x03ED), fixed-point dots per inch.
  const resources = new Writer();
  resources.ascii('8BIM').u16(0x03ed).u16(0).u32(16);
  resources.u32(dpi * 65536).u16(1).u16(1).u32(dpi * 65536).u16(1).u16(1);
  out.u32(resources.length).bytes(resources.concat());

  const records = new Writer();
  const data = new Writer();
  for (const l of layers) {
    const channels = [
      { id: -1, index: 3 },
      { id: 0, index: 0 },
      { id: 1, index: 1 },
      { id: 2, index: 2 },
    ].map(({ id, index }) => {
      const { table, rows } = rleChannel(l.rgba, l.width, l.height, index);
      return { id, table, rows };
    });
    if (l.mask) {
      const { table, rows } = rleChannel(l.mask, width, height, 3);
      channels.push({ id: -2, table, rows });
    }
    records.u32(l.top).u32(l.left).u32(l.top + l.height).u32(l.left + l.width).u16(channels.length);
    for (const c of channels) {
      records.u16(c.id & 0xffff).u32(2 + c.table.length + c.rows.length);
      data.u16(1).bytes(c.table.concat()).bytes(c.rows.concat());
    }
    const name = pascalName(l.name);
    records.ascii('8BIM').ascii(BLEND_KEYS[l.blend] ?? 'norm').u8(l.opacity).u8(l.clip ? 1 : 0).u8(l.visible ? 0 : 2).u8(0);
    // Extra data: the mask's box, what lies outside it (hidden), flags and padding; then blending ranges.
    if (l.mask) {
      records.u32(8 + 20 + name.length).u32(20).u32(0).u32(0).u32(height).u32(width).u8(0).u8(0).u8(0).u8(0);
      records.u32(0).bytes(name);
    } else {
      records.u32(8 + name.length).u32(0).u32(0).bytes(name);
    }
  }
  const info = new Writer();
  info.u16(layers.length).bytes(records.concat()).bytes(data.concat());
  if (info.length % 2) info.u8(0);
  out.u32(info.length + 8).u32(info.length).bytes(info.concat()).u32(0);

  // The finished picture, compressed as one block: every row of R, then G, then B.
  const tables = new Writer();
  const rows = new Writer();
  for (let c = 0; c < 3; c += 1) {
    const channel = rleChannel(composite, width, height, c);
    tables.bytes(channel.table.concat());
    rows.bytes(channel.rows.concat());
  }
  out.u16(1).bytes(tables.concat()).bytes(rows.concat());
  return out.concat();
}

/** The smallest box holding a layer's visible pixels; null when it has none. */
export function opaqueBounds(rgba: Uint8ClampedArray, width: number, height: number) {
  let x0 = width;
  let y0 = height;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (rgba[(y * width + x) * 4 + 3] === 0) continue;
      if (x < x0) x0 = x;
      if (x >= x1) x1 = x + 1;
      if (y < y0) y0 = y;
      if (y >= y1) y1 = y + 1;
    }
  }
  return x1 > x0 ? { left: x0, top: y0, width: x1 - x0, height: y1 - y0 } : null;
}

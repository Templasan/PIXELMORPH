/**
 * RF-061: a streaming GIF89a writer. The palette comes from a few sample frames
 * (`GifPalette.addSample` then `build`), then every frame is mapped to that palette and LZW-encoded
 * as soon as it is drawn, so only the compressed bytes are kept — not every RGBA frame (a 15 s
 * 480×853 GIF at 15 fps was ~370 MB of frames before encoding). Pure: no DOM, no Skia.
 */

const BINS = 1 << 15; // 5 bits per channel

function binOf(r: number, g: number, b: number): number {
  return ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
}

interface Box {
  bins: number[];
  count: number;
}

/** Median-cut palette over a 15-bit colour histogram. */
export class GifPalette {
  private readonly histogram = new Uint32Array(BINS);
  /** RGB triplets, `colors.length / 3` entries (<= maxColors). */
  colors = new Uint8Array(0);
  private lookup = new Int16Array(0);

  /** `rgba`: canvas ImageData bytes. */
  addSample(rgba: Uint8ClampedArray | Uint8Array): void {
    for (let i = 0; i < rgba.length; i += 4) {
      this.histogram[binOf(rgba[i], rgba[i + 1], rgba[i + 2])] += 1;
    }
  }

  build(maxColors: number): void {
    const used: number[] = [];
    for (let bin = 0; bin < BINS; bin += 1) if (this.histogram[bin]) used.push(bin);
    if (used.length === 0) used.push(0);
    const boxes: Box[] = [{ bins: used, count: this.countOf(used) }];
    while (boxes.length < maxColors) {
      // Split the box with the most pixels that still has more than one colour.
      let pick = -1;
      for (let i = 0; i < boxes.length; i += 1) {
        if (boxes[i].bins.length > 1 && (pick < 0 || boxes[i].count > boxes[pick].count)) pick = i;
      }
      if (pick < 0) break;
      const [a, b] = this.split(boxes[pick]);
      boxes.splice(pick, 1, a, b);
    }
    this.colors = new Uint8Array(boxes.length * 3);
    boxes.forEach((box, i) => {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (const bin of box.bins) {
        const w = this.histogram[bin] || 1;
        r += (((bin >> 10) & 31) * 8 + 4) * w;
        g += (((bin >> 5) & 31) * 8 + 4) * w;
        b += ((bin & 31) * 8 + 4) * w;
        n += w;
      }
      this.colors[i * 3] = Math.round(r / n);
      this.colors[i * 3 + 1] = Math.round(g / n);
      this.colors[i * 3 + 2] = Math.round(b / n);
    });
    this.lookup = new Int16Array(BINS).fill(-1);
  }

  /** Palette index of a colour (nearest entry, cached per 15-bit bin). */
  indexOf(r: number, g: number, b: number): number {
    const bin = binOf(r, g, b);
    let index = this.lookup[bin];
    if (index < 0) {
      let best = Infinity;
      for (let i = 0; i < this.colors.length / 3; i += 1) {
        const dr = this.colors[i * 3] - r;
        const dg = this.colors[i * 3 + 1] - g;
        const db = this.colors[i * 3 + 2] - b;
        const d = dr * dr + dg * dg + db * db;
        if (d < best) {
          best = d;
          index = i;
        }
      }
      this.lookup[bin] = index;
    }
    return index;
  }

  private countOf(bins: number[]): number {
    let n = 0;
    for (const bin of bins) n += this.histogram[bin];
    return n;
  }

  /** Splits along the widest channel at the pixel-weighted median. */
  private split(box: Box): [Box, Box] {
    const shifts = [10, 5, 0];
    let channel = 0;
    let widest = -1;
    for (const shift of shifts) {
      let lo = 31;
      let hi = 0;
      for (const bin of box.bins) {
        const v = (bin >> shift) & 31;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      if (hi - lo > widest) {
        widest = hi - lo;
        channel = shift;
      }
    }
    const sorted = [...box.bins].sort((x, y) => ((x >> channel) & 31) - ((y >> channel) & 31));
    let acc = 0;
    let cut = 1;
    for (; cut < sorted.length; cut += 1) {
      acc += this.histogram[sorted[cut - 1]];
      if (acc >= box.count / 2) break;
    }
    cut = Math.min(Math.max(cut, 1), sorted.length - 1);
    const left = sorted.slice(0, cut);
    const right = sorted.slice(cut);
    return [
      { bins: left, count: this.countOf(left) },
      { bins: right, count: this.countOf(right) },
    ];
  }
}

/** Growable byte buffer. */
class Bytes {
  buf = new Uint8Array(1 << 16);
  length = 0;

  push(byte: number): void {
    if (this.length === this.buf.length) {
      const next = new Uint8Array(this.buf.length * 2);
      next.set(this.buf);
      this.buf = next;
    }
    this.buf[this.length++] = byte;
  }

  pushAll(bytes: ArrayLike<number>): void {
    for (let i = 0; i < bytes.length; i += 1) this.push(bytes[i]);
  }

  u16(value: number): void {
    this.push(value & 0xff);
    this.push((value >> 8) & 0xff);
  }

  take(): Uint8Array {
    return this.buf.slice(0, this.length);
  }
}

const MIN_CODE_SIZE = 8; // the colour table always has 256 entries

/** GIF LZW of 8-bit indices, wrapped in 255-byte sub-blocks (including the terminator). */
export function lzwEncode(indices: Uint8Array): Uint8Array {
  const clear = 1 << MIN_CODE_SIZE;
  const eoi = clear + 1;
  // Dictionary keyed by (prefix code << 8 | byte); a stamp per reset avoids refilling it.
  const codes = new Int32Array(4096 << 8);
  const stamps = new Int32Array(4096 << 8);
  let stamp = 1;
  let nextCode = eoi + 1;
  let codeSize = MIN_CODE_SIZE + 1;

  const data = new Bytes();
  let cur = 0;
  let bits = 0;
  const emit = (code: number) => {
    cur |= code << bits;
    bits += codeSize;
    while (bits >= 8) {
      data.push(cur & 0xff);
      cur >>>= 8;
      bits -= 8;
    }
  };

  emit(clear);
  if (indices.length > 0) {
    let prefix = indices[0];
    for (let i = 1; i < indices.length; i += 1) {
      const k = indices[i];
      const key = (prefix << 8) | k;
      if (stamps[key] === stamp) {
        prefix = codes[key];
        continue;
      }
      emit(prefix);
      if (nextCode === 4096) {
        emit(clear);
        nextCode = eoi + 1;
        codeSize = MIN_CODE_SIZE + 1;
        stamp += 1;
      } else {
        if (nextCode >= 1 << codeSize) codeSize += 1;
        stamps[key] = stamp;
        codes[key] = nextCode++;
      }
      prefix = k;
    }
    emit(prefix);
  }
  emit(eoi);
  if (bits > 0) data.push(cur & 0xff);

  const raw = data.take();
  const out = new Bytes();
  for (let at = 0; at < raw.length; at += 255) {
    const n = Math.min(255, raw.length - at);
    out.push(n);
    out.pushAll(raw.subarray(at, at + n));
  }
  out.push(0);
  return out.take();
}

/** Writes a looping GIF frame by frame; `finish()` returns the file. */
export class GifWriter {
  private readonly out = new Bytes();
  private frames = 0;
  private readonly indices: Uint8Array;

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly palette: GifPalette
  ) {
    this.indices = new Uint8Array(width * height);
    const o = this.out;
    o.pushAll([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // GIF89a
    o.u16(width);
    o.u16(height);
    o.push(0xf7); // global colour table, 8 bits per channel, 256 entries
    o.push(0); // background colour index
    o.push(0); // pixel aspect ratio
    const table = new Uint8Array(256 * 3);
    table.set(palette.colors.subarray(0, Math.min(palette.colors.length, table.length)));
    o.pushAll(table);
    // NETSCAPE2.0: loop forever.
    o.pushAll([0x21, 0xff, 0x0b]);
    o.pushAll([0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30]);
    o.pushAll([0x03, 0x01, 0x00, 0x00, 0x00]);
  }

  /** `rgba`: width × height canvas pixels; `delayCs`: how long it shows, in 1/100 s. */
  addFrame(rgba: Uint8ClampedArray | Uint8Array, delayCs: number): void {
    for (let p = 0, i = 0; p < this.indices.length; p += 1, i += 4) {
      this.indices[p] = this.palette.indexOf(rgba[i], rgba[i + 1], rgba[i + 2]);
    }
    const o = this.out;
    o.pushAll([0x21, 0xf9, 0x04, 0x00]); // graphic control: no transparency, no disposal
    o.u16(Math.max(2, Math.round(delayCs)));
    o.pushAll([0x00, 0x00]);
    o.push(0x2c); // image descriptor, full frame, no local table
    o.u16(0);
    o.u16(0);
    o.u16(this.width);
    o.u16(this.height);
    o.push(0);
    o.push(MIN_CODE_SIZE);
    o.pushAll(lzwEncode(this.indices));
    this.frames += 1;
  }

  get frameCount(): number {
    return this.frames;
  }

  finish(): Uint8Array {
    this.out.push(0x3b);
    return this.out.take();
  }
}

/**
 * Delay of frame `f` in 1/100 s at `fps`, rounded so the total stays exact (15 fps alternates
 * 7 and 6 instead of always 7, which would play 5% slow).
 */
export function gifDelayCs(f: number, fps: number): number {
  return Math.round(((f + 1) * 100) / fps) - Math.round((f * 100) / fps);
}

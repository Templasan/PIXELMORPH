/**
 * RF-055: fills an area from the texture around it, with no model. The hole is filled from its
 * edge inward: each pixel takes the colour of the known place whose surroundings look most like
 * its own. Good for small objects on grass, sky, walls; large holes in busy scenes will show it.
 */
const PATCH = 3; // half a side: a 7x7 window around each pixel
const CANDIDATES = 160;

/** Repeatable: removing the same area twice gives the same picture. */
function randomizer(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

/** Fills `rgba` in place where `hole` is non-zero. Returns the pixels it could not fill. */
export function fillHole(rgba: Uint8ClampedArray, width: number, height: number, hole: Uint8Array): number {
  const known = new Uint8Array(width * height);
  const sources: number[] = [];
  let left = 0;
  for (let i = 0; i < known.length; i += 1) {
    known[i] = hole[i] ? 0 : 1;
    if (hole[i]) left += 1;
    else sources.push(i);
  }
  if (sources.length === 0) return left;
  const random = randomizer(width * 31 + height + left);

  const edgeOf = () => {
    const edge: number[] = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        if (known[i]) continue;
        if ((x > 0 && known[i - 1]) || (x < width - 1 && known[i + 1]) || (y > 0 && known[i - width]) || (y < height - 1 && known[i + width])) {
          edge.push(i);
        }
      }
    }
    return edge;
  };

  const cost = (target: number, source: number, limit: number) => {
    const tx = target % width;
    const ty = (target - tx) / width;
    const sx = source % width;
    const sy = (source - sx) / width;
    let sum = 0;
    let n = 0;
    for (let dy = -PATCH; dy <= PATCH; dy += 1) {
      const a = ty + dy;
      const b = sy + dy;
      if (a < 0 || a >= height || b < 0 || b >= height) continue;
      for (let dx = -PATCH; dx <= PATCH; dx += 1) {
        const c = tx + dx;
        const d = sx + dx;
        if (c < 0 || c >= width || d < 0 || d >= width) continue;
        const ta = a * width + c;
        const sa = b * width + d;
        if (!known[ta] || !known[sa]) continue;
        const r = rgba[ta * 4] - rgba[sa * 4];
        const g = rgba[ta * 4 + 1] - rgba[sa * 4 + 1];
        const bl = rgba[ta * 4 + 2] - rgba[sa * 4 + 2];
        sum += r * r + g * g + bl * bl;
        n += 1;
      }
    }
    if (n === 0) return Infinity;
    const mean = sum / n;
    return mean < limit ? mean : Infinity;
  };

  for (let edge = edgeOf(); edge.length > 0 && left > 0; edge = edgeOf()) {
    for (const target of edge) {
      const tx = target % width;
      const ty = (target - tx) / width;
      let best = -1;
      let bestCost = Infinity;
      for (let c = 0; c < CANDIDATES; c += 1) {
        // Half near the pixel, where the texture is likeliest to continue, half from anywhere.
        let source: number;
        if (c % 2 === 0) {
          const reach = 8 + c;
          const sx = tx + Math.round((random() - 0.5) * 2 * reach);
          const sy = ty + Math.round((random() - 0.5) * 2 * reach);
          if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;
          source = sy * width + sx;
          if (!known[source]) continue;
        } else {
          source = sources[Math.floor(random() * sources.length)];
        }
        const k = cost(target, source, bestCost);
        if (k < bestCost) {
          bestCost = k;
          best = source;
        }
      }
      if (best < 0) best = sources[Math.floor(random() * sources.length)];
      rgba.set(rgba.subarray(best * 4, best * 4 + 3), target * 4);
      rgba[target * 4 + 3] = 255;
      known[target] = 1;
      left -= 1;
    }
  }
  return left;
}

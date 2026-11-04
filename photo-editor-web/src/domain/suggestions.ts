/**
 * US-26: suggestions read from the picture's pixels, with no model. Pure: RGBA pixels in, plain
 * numbers out. Recognising what a photo shows (RF-034) needs a model and is not here.
 */

export type Rgb = readonly [number, number, number];

export interface Crop {
  /** Normalized to the picture: left, top, width, height. */
  x: number;
  y: number;
  w: number;
  h: number;
}

const toHex = ([r, g, b]: Rgb) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

/** RF-010: the dominant colours, most common first, by splitting the pixels' colour box in halves. */
export function dominantColors(rgba: Uint8ClampedArray, count = 5): string[] {
  const pixels: number[][] = [];
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] > 127) pixels.push([rgba[i], rgba[i + 1], rgba[i + 2]]);
  }
  if (pixels.length === 0) return [];
  let boxes = [pixels];
  while (boxes.length < count) {
    let widest = -1;
    let channel = 0;
    let split = -1;
    boxes.forEach((box, b) => {
      if (box.length < 2) return;
      for (let c = 0; c < 3; c += 1) {
        const values = box.map((p) => p[c]);
        const range = Math.max(...values) - Math.min(...values);
        if (range > widest) {
          widest = range;
          channel = c;
          split = b;
        }
      }
    });
    if (split < 0 || widest <= 0) break;
    const sorted = [...boxes[split]].sort((a, b) => a[channel] - b[channel]);
    // At the middle of the range, not of the pixels: a colour filling most of the picture stays pure.
    const middle = (sorted[0][channel] + sorted[sorted.length - 1][channel]) / 2;
    const mid = sorted.findIndex((p) => p[channel] > middle);
    boxes = [...boxes.slice(0, split), sorted.slice(0, mid), sorted.slice(mid), ...boxes.slice(split + 1)];
  }
  const merged = new Map<string, number>();
  for (const box of boxes) {
    const mean: Rgb = [0, 1, 2].map((c) => box.reduce((sum, p) => sum + p[c], 0) / box.length) as unknown as Rgb;
    const hex = toHex(mean);
    merged.set(hex, (merged.get(hex) ?? 0) + box.length);
  }
  return [...merged.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex);
}

function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function fromHsl(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return 255 * (l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return toHex([f(0), f(8), f(4)]);
}

/** RF-010: colours that go with `hex`, by turning its hue on the colour wheel. */
export function harmonies(hex: string): { name: string; colors: string[] }[] {
  const [h, s, l] = toHsl(hex);
  const turn = (deg: number) => fromHsl((h + deg + 360) % 360, s, l);
  return [
    { name: 'Complementar', colors: [hex, turn(180)] },
    { name: 'Análoga', colors: [turn(-30), hex, turn(30)] },
    { name: 'Tríade', colors: [hex, turn(120), turn(240)] },
  ];
}

/** Where the eye goes, per cell: how much a pixel differs from its neighbours. */
export function saliencyMap(rgba: Uint8ClampedArray, w: number, h: number): Float32Array {
  const luma = new Float32Array(w * h);
  for (let i = 0; i < luma.length; i += 1) {
    luma[i] = 0.3 * rgba[i * 4] + 0.59 * rgba[i * 4 + 1] + 0.11 * rgba[i * 4 + 2];
  }
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      out[i] = Math.abs(luma[i + 1] - luma[i - 1]) + Math.abs(luma[i + w] - luma[i - w]);
    }
  }
  return out;
}

const THIRDS = [1 / 3, 2 / 3];
const GOLDEN = [0.382, 0.618];
const ASPECTS = [
  { name: '1:1', ratio: 1 },
  { name: '4:5', ratio: 4 / 5 },
  { name: '3:2', ratio: 3 / 2 },
  { name: '16:9', ratio: 16 / 9 },
];
const SCALES = [1, 0.85, 0.7];
const POSITIONS = [0, 0.25, 0.5, 0.75, 1];
/** A crop must keep this share of what draws the eye, or it is cutting out the subject. */
const MIN_KEPT = 0.6;

export interface CropSuggestion extends Crop {
  aspect: string;
  rule: 'Terços' | 'Proporção áurea' | 'Linhas de convergência';
}

/**
 * RF-042: crops that put what draws the eye on the thirds or the golden section, best first, one
 * per aspect. Nothing is suggested for a picture with no detail.
 */
export function suggestCrops(saliency: Float32Array, w: number, h: number, pictureAspect: number): CropSuggestion[] {
  const total = saliency.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return [];
  const best = new Map<string, { crop: CropSuggestion; score: number }>();
  for (const aspect of ASPECTS) {
    for (const scale of SCALES) {
      // Normalized sizes: an aspect wider than the picture spends its full width, and so on.
      const relative = aspect.ratio / pictureAspect;
      const cw = (relative >= 1 ? 1 : relative) * scale;
      const ch = (relative >= 1 ? 1 / relative : 1) * scale;
      for (const px of POSITIONS) {
        for (const py of POSITIONS) {
          const x = (1 - cw) * px;
          const y = (1 - ch) * py;
          let kept = 0;
          let mx = 0;
          let my = 0;
          const x1 = Math.floor(x * w);
          const x2 = Math.ceil((x + cw) * w);
          const y1 = Math.floor(y * h);
          const y2 = Math.ceil((y + ch) * h);
          for (let row = y1; row < y2 && row < h; row += 1) {
            for (let col = x1; col < x2 && col < w; col += 1) {
              const v = saliency[row * w + col];
              kept += v;
              mx += v * ((col + 0.5) / w - x) / cw;
              my += v * ((row + 0.5) / h - y) / ch;
            }
          }
          if (kept / total < MIN_KEPT) continue;
          mx /= kept;
          my /= kept;
          const off = (lines: number[]) =>
            Math.min(...lines.map((a) => Math.abs(mx - a))) + Math.min(...lines.map((b) => Math.abs(my - b)));
          const thirds = off(THIRDS);
          const golden = off(GOLDEN);
          const score = Math.min(thirds, golden) - (kept / total) * 0.2;
          const seen = best.get(aspect.name);
          if (!seen || score < seen.score) {
            best.set(aspect.name, {
              score,
              crop: { x, y, w: cw, h: ch, aspect: aspect.name, rule: thirds <= golden ? 'Terços' : 'Proporção áurea' },
            });
          }
        }
      }
    }
  }
  return [...best.values()].sort((a, b) => a.score - b.score).map((b) => b.crop);
}

/** Weaker edges than this are texture, not lines. */
const MIN_EDGE = 120;
/** Lines this close to level or upright are frames and horizons: they do not lead anywhere. */
const SKIP_NEAR_AXIS = (8 * Math.PI) / 180;
const VP_GRID = 32;
/** How near a line must pass to a grid point to count for it, in grid cells: the point may be off-centre. */
const VP_REACH = 0.75;
const ANGLE_BINS = 12;
/** A real meeting point takes this share of the slanted edges, from this many different directions. */
const MIN_VP_SHARE = 0.2;
const MIN_VP_DIRECTIONS = 3;

/**
 * RF-042: where the picture's lines meet, if they do, normalized to the picture. Each strong slanted
 * edge votes for the points its line passes through; lines from several directions must agree.
 */
export function vanishingPoint(rgba: Uint8ClampedArray, w: number, h: number): { x: number; y: number } | null {
  const luma = new Float32Array(w * h);
  for (let i = 0; i < luma.length; i += 1) {
    luma[i] = 0.3 * rgba[i * 4] + 0.59 * rgba[i * 4 + 1] + 0.11 * rgba[i * 4 + 2];
  }
  const edges: { x: number; y: number; dx: number; dy: number; angle: number }[] = [];
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      // Sobel: the wider look gives a truer direction, and direction is all these votes rest on.
      const gx = luma[i - w + 1] + 2 * luma[i + 1] + luma[i + w + 1] - luma[i - w - 1] - 2 * luma[i - 1] - luma[i + w - 1];
      const gy = luma[i + w - 1] + 2 * luma[i + w] + luma[i + w + 1] - luma[i - w - 1] - 2 * luma[i - w] - luma[i - w + 1];
      const size = Math.hypot(gx, gy);
      if (size < MIN_EDGE) continue;
      // The line runs across the gradient.
      const dx = -gy / size;
      const dy = gx / size;
      const angle = ((Math.atan2(dy, dx) % Math.PI) + Math.PI) % Math.PI;
      const fromAxis = Math.min(angle, Math.abs(angle - Math.PI / 2), Math.PI - angle);
      if (fromAxis < SKIP_NEAR_AXIS) continue;
      edges.push({ x, y, dx, dy, angle });
    }
  }
  if (edges.length < (w * h) / 200) return null;
  const reach = (VP_REACH * Math.max(w, h)) / VP_GRID;
  let best: { x: number; y: number; votes: number; directions: number } | null = null;
  for (let row = 0; row < VP_GRID; row += 1) {
    for (let col = 0; col < VP_GRID; col += 1) {
      const px = ((col + 0.5) / VP_GRID) * w;
      const py = ((row + 0.5) / VP_GRID) * h;
      const bins = new Array<number>(ANGLE_BINS).fill(0);
      let votes = 0;
      for (const e of edges) {
        if (Math.abs((px - e.x) * e.dy - (py - e.y) * e.dx) > reach) continue;
        votes += 1;
        bins[Math.min(ANGLE_BINS - 1, Math.floor((e.angle / Math.PI) * ANGLE_BINS))] += 1;
      }
      if (best && votes <= best.votes) continue;
      best = { x: px / w, y: py / h, votes, directions: bins.filter((b) => b >= votes * 0.08 && b > 0).length };
    }
  }
  if (!best || best.votes < edges.length * MIN_VP_SHARE || best.directions < MIN_VP_DIRECTIONS) return null;
  return { x: best.x, y: best.y };
}

/** RF-042: the crop that puts where the lines meet on a third, with the rule for it. */
export function convergenceCrop(point: { x: number; y: number }, pictureAspect: number): CropSuggestion | null {
  let best: { crop: CropSuggestion; off: number } | null = null;
  for (const aspect of ASPECTS) {
    for (const scale of SCALES) {
      const relative = aspect.ratio / pictureAspect;
      const cw = (relative >= 1 ? 1 : relative) * scale;
      const ch = (relative >= 1 ? 1 / relative : 1) * scale;
      for (const tx of THIRDS) {
        for (const ty of THIRDS) {
          const x = Math.max(0, Math.min(1 - cw, point.x - tx * cw));
          const y = Math.max(0, Math.min(1 - ch, point.y - ty * ch));
          const off = Math.hypot((point.x - x) / cw - tx, (point.y - y) / ch - ty);
          // Ties keep the larger crop: the first scale tried.
          if (!best || off < best.off - 1e-3) {
            best = { off, crop: { x, y, w: cw, h: ch, aspect: aspect.name, rule: 'Linhas de convergência' } };
          }
        }
      }
    }
  }
  return best && best.off < 0.05 ? best.crop : null;
}

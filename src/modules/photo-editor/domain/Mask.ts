export interface Mask {
  id: string;
  width: number;
  height: number;
  data: Uint8Array; // R channel only, 0-255 opacity per pixel
  createdAt: Date;
}

export function createMask(id: string, width: number, height: number): Mask {
  return {
    id,
    width,
    height,
    data: new Uint8Array(width * height),
    createdAt: new Date(),
  };
}

export function getMaskPixel(mask: Mask, x: number, y: number): number {
  if (x < 0 || x >= mask.width || y < 0 || y >= mask.height) return 0;
  return mask.data[y * mask.width + x];
}

export function setMaskPixel(mask: Mask, x: number, y: number, value: number): void {
  if (x < 0 || x >= mask.width || y < 0 || y >= mask.height) return;
  const idx = y * mask.width + x;
  const clamped = Math.max(0, Math.min(255, Math.round(value)));
  mask.data[idx] = clamped;
}

export function drawBrushStroke(
  mask: Mask,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  hardness: number,
  strength: number
): void {
  // Bresenham line + circular brush with falloff
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = (dx > dy ? dx : -dy) / 2;

  let x = x0,
    y = y0;

  while (true) {
    // Paint at current line point
    paintBrushCircle(mask, x, y, radius, hardness, strength);

    if (x === x1 && y === y1) break;
    const e2 = err;
    if (e2 > -dx) {
      err -= dy;
      x += sx;
    }
    if (e2 < dy) {
      err += dx;
      y += sy;
    }
  }
}

function paintBrushCircle(
  mask: Mask,
  cx: number,
  cy: number,
  radius: number,
  hardness: number,
  strength: number
): void {
  const radiusSq = radius * radius;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const distSq = dx * dx + dy * dy;
      if (distSq > radiusSq) continue;

      const dist = Math.sqrt(distSq);
      let falloff = 1.0;
      if (hardness < 100) {
        const softEdge = radius * (1 - hardness / 100);
        if (dist > softEdge) {
          falloff = 1 - (dist - softEdge) / (radius - softEdge);
        }
      }

      const x = cx + dx;
      const y = cy + dy;
      const current = getMaskPixel(mask, x, y);
      const delta = strength * falloff * 255;
      const next = current + delta;
      setMaskPixel(mask, x, y, next);
    }
  }
}

export function eraseBrushStroke(
  mask: Mask,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  hardness: number,
  strength: number
): void {
  // Same as draw but subtracts
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = (dx > dy ? dx : -dy) / 2;

  let x = x0,
    y = y0;

  while (true) {
    eraseBrushCircle(mask, x, y, radius, hardness, strength);

    if (x === x1 && y === y1) break;
    const e2 = err;
    if (e2 > -dx) {
      err -= dy;
      x += sx;
    }
    if (e2 < dy) {
      err += dx;
      y += sy;
    }
  }
}

function eraseBrushCircle(
  mask: Mask,
  cx: number,
  cy: number,
  radius: number,
  hardness: number,
  strength: number
): void {
  const radiusSq = radius * radius;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const distSq = dx * dx + dy * dy;
      if (distSq > radiusSq) continue;

      const dist = Math.sqrt(distSq);
      let falloff = 1.0;
      if (hardness < 100) {
        const softEdge = radius * (1 - hardness / 100);
        if (dist > softEdge) {
          falloff = 1 - (dist - softEdge) / (radius - softEdge);
        }
      }

      const x = cx + dx;
      const y = cy + dy;
      const current = getMaskPixel(mask, x, y);
      const delta = strength * falloff * 255;
      const next = current - delta;
      setMaskPixel(mask, x, y, next);
    }
  }
}

export function clearMask(mask: Mask): void {
  mask.data.fill(0);
}

export function invertMask(mask: Mask): void {
  for (let i = 0; i < mask.data.length; i++) {
    mask.data[i] = 255 - mask.data[i];
  }
}

export interface CloneOrigin {
  x: number;
  y: number;
}

export function createCloneOrigin(x: number, y: number): CloneOrigin {
  return { x, y };
}

export function applyCloneStroke(
  targetPixels: Uint8Array,
  targetWidth: number,
  targetHeight: number,
  sourcePixels: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  origin: CloneOrigin,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  hardness: number,
  strength: number
): void {
  // Bresenham line + circular brush
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = (dx > dy ? dx : -dy) / 2;

  let x = x0,
    y = y0;
  const offsetX = x0 - origin.x;
  const offsetY = y0 - origin.y;

  while (true) {
    cloneBrushCircle(
      targetPixels,
      targetWidth,
      targetHeight,
      sourcePixels,
      sourceWidth,
      sourceHeight,
      x,
      y,
      offsetX,
      offsetY,
      radius,
      hardness,
      strength
    );

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

function cloneBrushCircle(
  targetPixels: Uint8Array,
  targetWidth: number,
  targetHeight: number,
  sourcePixels: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  cx: number,
  cy: number,
  offsetX: number,
  offsetY: number,
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

      const tx = cx + dx;
      const ty = cy + dy;
      const sx = Math.round(offsetX + dx);
      const sy = Math.round(offsetY + dy);

      // Clamp to bounds
      if (tx < 0 || tx >= targetWidth || ty < 0 || ty >= targetHeight) continue;
      if (sx < 0 || sx >= sourceWidth || sy < 0 || sy >= sourceHeight) continue;

      const tIdx = (ty * targetWidth + tx) * 4;
      const sIdx = (sy * sourceWidth + sx) * 4;

      // Copy source RGBA to target with falloff blend
      const blend = strength * falloff;
      targetPixels[tIdx] = Math.round(
        targetPixels[tIdx] * (1 - blend) + sourcePixels[sIdx] * blend
      );
      targetPixels[tIdx + 1] = Math.round(
        targetPixels[tIdx + 1] * (1 - blend) + sourcePixels[sIdx + 1] * blend
      );
      targetPixels[tIdx + 2] = Math.round(
        targetPixels[tIdx + 2] * (1 - blend) + sourcePixels[sIdx + 2] * blend
      );
      targetPixels[tIdx + 3] = Math.round(
        targetPixels[tIdx + 3] * (1 - blend) + sourcePixels[sIdx + 3] * blend
      );
    }
  }
}

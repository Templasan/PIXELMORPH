export type LiquifyMode = 'push' | 'pull' | 'rotate';

export interface LiquifyStroke {
  x: number;
  y: number;
  mode: LiquifyMode;
  radius: number;
  intensity: number;
}

export function createLiquifyStroke(
  x: number,
  y: number,
  mode: LiquifyMode,
  radius: number,
  intensity: number
): LiquifyStroke {
  return { x, y, mode, radius, intensity };
}

export function applyLiquifyStroke(
  pixels: Uint8Array,
  width: number,
  height: number,
  stroke: LiquifyStroke
): Uint8Array {
  // Create a copy to read from
  const source = new Uint8Array(pixels);
  const result = new Uint8Array(pixels);

  const radiusSq = stroke.radius * stroke.radius;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - stroke.x;
      const dy = y - stroke.y;
      const distSq = dx * dx + dy * dy;

      if (distSq > radiusSq) continue;

      const dist = Math.sqrt(distSq);
      const falloff = 1 - dist / stroke.radius; // Linear falloff

      // Compute displacement based on mode
      let sampleX = x;
      let sampleY = y;

      if (stroke.mode === 'push') {
        // Push outward from center
        const norm = dist > 0 ? 1 / dist : 0;
        const displaceAmount = stroke.intensity * falloff;
        sampleX -= (dx * norm * displaceAmount) | 0;
        sampleY -= (dy * norm * displaceAmount) | 0;
      } else if (stroke.mode === 'pull') {
        // Pull toward center
        const norm = dist > 0 ? 1 / dist : 0;
        const displaceAmount = stroke.intensity * falloff;
        sampleX += (dx * norm * displaceAmount) | 0;
        sampleY += (dy * norm * displaceAmount) | 0;
      } else if (stroke.mode === 'rotate') {
        // Rotate around center
        const angle = (stroke.intensity * falloff * Math.PI) / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const rotX = dx * cos - dy * sin;
        const rotY = dx * sin + dy * cos;
        sampleX = stroke.x + Math.round(rotX);
        sampleY = stroke.y + Math.round(rotY);
      }

      // Clamp to bounds
      sampleX = Math.max(0, Math.min(width - 1, sampleX));
      sampleY = Math.max(0, Math.min(height - 1, sampleY));

      // Copy RGBA from displaced position
      const srcIdx = (sampleY * width + sampleX) * 4;
      const dstIdx = (y * width + x) * 4;
      result[dstIdx] = source[srcIdx];
      result[dstIdx + 1] = source[srcIdx + 1];
      result[dstIdx + 2] = source[srcIdx + 2];
      result[dstIdx + 3] = source[srcIdx + 3];
    }
  }

  return result;
}

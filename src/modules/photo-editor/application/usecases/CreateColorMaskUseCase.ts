import { createMask, setMaskPixel, type Mask } from '../../domain/Mask';

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const maxc = Math.max(r, g, b);
  const minc = Math.min(r, g, b);
  const l = (maxc + minc) / 2;
  const d = maxc - minc;
  if (d < 0.0001) return [0, 0, l];

  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (r >= g && r >= b) {
    h = ((g - b) / d) % 6;
  } else if (g >= b) {
    h = (b - r) / d + 2;
  } else {
    h = (r - g) / d + 4;
  }
  h /= 6;
  if (h < 0) h += 1;
  return [h, s, l];
}

export function createColorMaskUseCase() {
  return {
    execute(
      width: number,
      height: number,
      pixelData: Uint8Array,
      sampleX: number,
      sampleY: number,
      tolerancePercent: number
    ): Mask {
      const mask = createMask('mask_color', width, height);

      // Get sample color at (sampleX, sampleY) in RGBA format
      const sampleIdx = (Math.round(sampleY) * width + Math.round(sampleX)) * 4;
      const sampleR = pixelData[sampleIdx] / 255;
      const sampleG = pixelData[sampleIdx + 1] / 255;
      const sampleB = pixelData[sampleIdx + 2] / 255;

      const [sampleH, ,] = rgbToHsl(sampleR, sampleG, sampleB);
      const tolerance = (tolerancePercent / 100) * 0.25; // 0.02..0.27 range like selective color

      // Build mask based on hue distance
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const r = pixelData[idx] / 255;
          const g = pixelData[idx + 1] / 255;
          const b = pixelData[idx + 2] / 255;

          const [h, ,] = rgbToHsl(r, g, b);
          let hueDist = Math.abs(h - sampleH);
          hueDist = Math.min(hueDist, 1 - hueDist);

          // Smooth falloff: 1.0 inside tolerance, 0.0 outside
          const edge0 = tolerance * 0.5;
          const edge1 = Math.max(tolerance, 0.001);
          const t = Math.max(0, Math.min(1, (hueDist - edge0) / (edge1 - edge0)));
          const smooth = t * t * (3 - 2 * t); // smoothstep
          const strength = 1 - smooth;

          const maskValue = Math.round(strength * 255);
          setMaskPixel(mask, x, y, maskValue);
        }
      }

      return mask;
    },
  };
}

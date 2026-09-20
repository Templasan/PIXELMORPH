import { createMask, setMaskPixel, type Mask } from '../../domain/Mask';

export function createFocusMaskUseCase() {
  return {
    execute(
      width: number,
      height: number,
      focusX: number,
      focusY: number,
      focusRadius: number
    ): Mask {
      const mask = createMask('mask_focus', width, height);

      const softEdgeRadius = focusRadius * 0.5;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - focusX;
          const dy = y - focusY;
          const distSq = dx * dx + dy * dy;
          const dist = Math.sqrt(distSq);

          // Inside focus: sharp (high mask value = keep adjustments)
          // Outside focus: blur (low mask value = remove adjustments = show original)
          let strength: number;
          if (dist <= softEdgeRadius) {
            strength = 1.0; // Full sharpness inside soft edge
          } else if (dist <= focusRadius) {
            // Smooth falloff from soft edge to outer radius
            const edgeRange = focusRadius - softEdgeRadius;
            const t = (dist - softEdgeRadius) / edgeRange;
            const smoothed = t * t * (3 - 2 * t); // smoothstep
            strength = 1 - smoothed;
          } else {
            // Blur radius: smooth fadeout beyond focus radius
            const blurDistance = dist - focusRadius;
            const maxBlurDistance = Math.max(width, height) * 0.2;
            const blurT = Math.min(1, blurDistance / maxBlurDistance);
            strength = Math.max(0, 1 - blurT);
          }

          const maskValue = Math.round(strength * 255);
          setMaskPixel(mask, x, y, maskValue);
        }
      }

      return mask;
    },
  };
}

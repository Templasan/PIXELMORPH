import { createMask, setMaskPixel, type Mask } from '../../domain/Mask';

export function createLinearGradientMaskUseCase() {
  return {
    execute(
      width: number,
      height: number,
      startX: number,
      startY: number,
      endX: number,
      endY: number
    ): Mask {
      const mask = createMask('mask_linear_gradient', width, height);

      // Direction vector (normalized)
      const dx = endX - startX;
      const dy = endY - startY;
      const len = Math.sqrt(dx * dx + dy * dy);
      const dirX = len > 0 ? dx / len : 1;
      const dirY = len > 0 ? dy / len : 0;

      // Distance from start to end defines gradient range
      const gradientLength = len || Math.max(width, height);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const px = x - startX;
          const py = y - startY;

          // Project point onto gradient line
          const projection = px * dirX + py * dirY;

          // Clamp to [0, gradientLength]
          const t = Math.max(0, Math.min(1, projection / gradientLength));

          const maskValue = Math.round(t * 255);
          setMaskPixel(mask, x, y, maskValue);
        }
      }

      return mask;
    },
  };
}

export function createRadialGradientMaskUseCase() {
  return {
    execute(
      width: number,
      height: number,
      centerX: number,
      centerY: number,
      innerRadius: number,
      outerRadius: number
    ): Mask {
      const mask = createMask('mask_radial_gradient', width, height);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - centerX;
          const dy = y - centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          let strength: number;
          if (dist <= innerRadius) {
            strength = 1.0; // Full effect inside inner radius
          } else if (dist <= outerRadius) {
            // Linear falloff between inner and outer radius
            const range = outerRadius - innerRadius;
            const t = (dist - innerRadius) / range;
            strength = 1.0 - t;
          } else {
            strength = 0.0; // No effect outside outer radius
          }

          const maskValue = Math.round(strength * 255);
          setMaskPixel(mask, x, y, maskValue);
        }
      }

      return mask;
    },
  };
}

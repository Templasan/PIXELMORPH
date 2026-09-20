import { drawBrushStroke, eraseBrushStroke, type Mask } from '../../domain/Mask';

export function createApplyBrushStrokeUseCase() {
  return {
    execute(
      mask: Mask,
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      radius: number,
      hardness: number,
      strength: number,
      erase: boolean = false
    ): Mask {
      if (erase) {
        eraseBrushStroke(mask, x0, y0, x1, y1, radius, hardness, strength);
      } else {
        drawBrushStroke(mask, x0, y0, x1, y1, radius, hardness, strength);
      }
      return mask;
    },
  };
}

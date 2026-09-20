import { applyCloneStroke, type CloneOrigin } from '../../domain/CloneStamp';

export function createApplyCloneStrokeUseCase() {
  return {
    execute(
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
      applyCloneStroke(
        targetPixels,
        targetWidth,
        targetHeight,
        sourcePixels,
        sourceWidth,
        sourceHeight,
        origin,
        x0,
        y0,
        x1,
        y1,
        radius,
        hardness,
        strength
      );
    },
  };
}

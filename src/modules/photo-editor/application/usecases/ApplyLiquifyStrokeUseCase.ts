import { applyLiquifyStroke, type LiquifyStroke } from '../../domain/Liquify';

export function createApplyLiquifyStrokeUseCase() {
  return {
    execute(pixels: Uint8Array, width: number, height: number, stroke: LiquifyStroke): Uint8Array {
      return applyLiquifyStroke(pixels, width, height, stroke);
    },
  };
}

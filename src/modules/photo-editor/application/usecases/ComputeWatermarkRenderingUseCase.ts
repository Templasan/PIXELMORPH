import type { Watermark } from '../../domain/Watermark';

export interface WatermarkRenderingInfo {
  text: string;
  x: number; // absolute pixels
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  opacity: number;
  rotation: number;
}

export function createComputeWatermarkRenderingUseCase() {
  return {
    execute(
      watermark: Watermark,
      canvasWidth: number,
      canvasHeight: number
    ): WatermarkRenderingInfo {
      return {
        text: watermark.text,
        x: watermark.x * canvasWidth,
        y: watermark.y * canvasHeight,
        fontSize: watermark.fontSize * watermark.scale,
        fontFamily: watermark.fontFamily,
        color: watermark.color,
        opacity: watermark.opacity,
        rotation: watermark.rotation,
      };
    },
  };
}

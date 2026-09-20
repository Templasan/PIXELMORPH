import type { Watermark } from './Watermark';

export interface WatermarkPreset {
  id: string;
  name: string;
  watermark: Watermark;
  createdAt: Date;
}

export function createWatermarkPreset(
  id: string,
  name: string,
  watermark: Watermark
): WatermarkPreset {
  return {
    id,
    name,
    watermark,
    createdAt: new Date(),
  };
}

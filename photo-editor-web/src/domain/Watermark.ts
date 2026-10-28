export interface Watermark {
  id: string;
  text: string;
  x: number; // 0..1 (relative position)
  y: number; // 0..1
  scale: number; // 0.1..5.0
  rotation: number; // degrees
  opacity: number; // 0..1
  fontSize: number; // 12..120 (base size)
  fontFamily: string; // e.g., 'sans-serif'
  color: string; // hex color
  createdAt: Date;
}

export function createWatermark(
  id: string,
  text: string,
  x: number = 0.5,
  y: number = 0.5
): Watermark {
  return {
    id,
    text,
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
    scale: 1.0,
    rotation: 0,
    opacity: 0.7,
    fontSize: 32,
    fontFamily: 'sans-serif',
    color: '#FFFFFF',
    createdAt: new Date(),
  };
}

export function updateWatermark(watermark: Watermark, updates: Partial<Watermark>): Watermark {
  return {
    ...watermark,
    ...updates,
    x: Math.max(0, Math.min(1, updates.x ?? watermark.x)),
    y: Math.max(0, Math.min(1, updates.y ?? watermark.y)),
    scale: Math.max(0.1, Math.min(5, updates.scale ?? watermark.scale)),
    opacity: Math.max(0, Math.min(1, updates.opacity ?? watermark.opacity)),
    fontSize: Math.max(12, Math.min(120, updates.fontSize ?? watermark.fontSize)),
  };
}

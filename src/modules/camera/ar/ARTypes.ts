/**
 * RF-024: Augmented Reality anchor system (MVP: screen-space anchoring with gyro tracking).
 * Not true surface detection, but simulates AR placement + camera movement response.
 */

export type ARAnchorType = 'text' | 'circle' | 'square' | 'triangle';

export interface ARAnchor {
  id: string;
  type: ARAnchorType;
  x: number; // 0..1 relative to screen
  y: number; // 0..1 relative to screen
  scale: number; // 0.5..2
  rotation: number; // 0..360 degrees
  color: string;
  text?: string; // for text anchors
  visible: boolean;
}

export interface ARSession {
  anchors: ARAnchor[];
  gyroOffsetX: number; // horizontal tilt offset
  gyroOffsetY: number; // vertical tilt offset
  enabled: boolean;
}

export function createARAnchor(type: ARAnchorType, x: number, y: number): ARAnchor {
  return {
    id: `anchor_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    type,
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
    scale: 1,
    rotation: 0,
    color: '#3A8FDE',
    visible: true,
  };
}

export function updateARPosition(
  anchor: ARAnchor,
  x: number,
  y: number
): ARAnchor {
  return {
    ...anchor,
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
  };
}

export function updateARAppearance(
  anchor: ARAnchor,
  scale: number,
  rotation: number,
  color: string
): ARAnchor {
  return {
    ...anchor,
    scale: Math.max(0.5, Math.min(2, scale)),
    rotation: rotation % 360,
    color,
  };
}

/**
 * RF-011: pure collage layout math — cell rects as fractions of the canvas, deliberately
 * Skia-free so it's unit-testable (same split as exportMath.ts/colorAdjustments.ts).
 */

export interface CollageCell {
  x: number; // normalized 0..1
  y: number;
  width: number;
  height: number;
}

export interface CollageLayout {
  id: string;
  label: string;
  cells: CollageCell[];
}

export const COLLAGE_LAYOUTS: CollageLayout[] = [
  {
    id: '2-side',
    label: '2 lado a lado',
    cells: [
      { x: 0, y: 0, width: 0.5, height: 1 },
      { x: 0.5, y: 0, width: 0.5, height: 1 },
    ],
  },
  {
    id: '2-stack',
    label: '2 empilhadas',
    cells: [
      { x: 0, y: 0, width: 1, height: 0.5 },
      { x: 0, y: 0.5, width: 1, height: 0.5 },
    ],
  },
  {
    id: '3-grid',
    label: '3 fotos',
    cells: [
      { x: 0, y: 0, width: 0.5, height: 1 },
      { x: 0.5, y: 0, width: 0.5, height: 0.5 },
      { x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
    ],
  },
  {
    id: '4-grid',
    label: '4 em grade',
    cells: [
      { x: 0, y: 0, width: 0.5, height: 0.5 },
      { x: 0.5, y: 0, width: 0.5, height: 0.5 },
      { x: 0, y: 0.5, width: 0.5, height: 0.5 },
      { x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
    ],
  },
];

/** A cell's rect in output pixels, inset by half the spacing on every edge. */
export function cellPixelRect(
  cell: CollageCell,
  canvasWidth: number,
  canvasHeight: number,
  spacing: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: cell.x * canvasWidth + spacing / 2,
    y: cell.y * canvasHeight + spacing / 2,
    width: cell.width * canvasWidth - spacing,
    height: cell.height * canvasHeight - spacing,
  };
}

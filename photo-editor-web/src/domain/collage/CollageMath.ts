/**
 * RF-011: pure collage layout math — cell rects as fractions of the canvas, deliberately
 * Skia-free so it's unit-testable (same split as exportMath.ts/colorAdjustments.ts).
 */

import { coverFitRect } from '../export/exportMath';

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

/**
 * RF-011: where a photo sits inside its cell, per axis from -1 to 1. 0 is centred (the cover
 * default); -1 and 1 put the photo's far and near edge on the cell's edge. Never past them, so the
 * cell is always covered.
 */
export interface CellPan {
  x: number;
  y: number;
}

export const CENTRED_PAN: CellPan = { x: 0, y: 0 };

const clampUnit = (v: number) => Math.min(1, Math.max(-1, v));

/** How far the cover-fitted photo overhangs the cell on each axis (0 when it fits exactly). */
function spareOf(pic: { width: number; height: number }, cell: { width: number; height: number }) {
  const fit = coverFitRect(pic.width, pic.height, cell.width, cell.height);
  return { x: Math.max(0, fit.width - cell.width), y: Math.max(0, fit.height - cell.height) };
}

/** The photo's rect inside its cell (cell-local origin), cover-fitted and panned. */
export function coverPlacement(
  pic: { width: number; height: number },
  cell: { width: number; height: number },
  pan: CellPan
): { x: number; y: number; width: number; height: number } {
  const fit = coverFitRect(pic.width, pic.height, cell.width, cell.height);
  const spare = spareOf(pic, cell);
  return {
    x: -spare.x / 2 + (clampUnit(pan.x) * spare.x) / 2,
    y: -spare.y / 2 + (clampUnit(pan.y) * spare.y) / 2,
    width: fit.width,
    height: fit.height,
  };
}

/**
 * The pan after dragging the photo by (dx, dy) cell pixels: the photo follows the pointer and
 * stops at the cell's edge. An axis the photo does not overhang keeps its pan.
 */
export function panByDrag(
  pic: { width: number; height: number },
  cell: { width: number; height: number },
  pan: CellPan,
  dx: number,
  dy: number
): CellPan {
  const spare = spareOf(pic, cell);
  const step = (value: number, delta: number, room: number) =>
    room > 0 ? clampUnit(value + (2 * delta) / room) : clampUnit(value);
  return { x: step(pan.x, dx, spare.x), y: step(pan.y, dy, spare.y) };
}

/** RF-011 "Personalizado": rows x columns cells of equal size (each count clamped to 1..4). */
export const CUSTOM_GRID_MAX = 4;

export function gridLayout(rows: number, cols: number): CollageLayout {
  const r = Math.min(CUSTOM_GRID_MAX, Math.max(1, Math.round(rows)));
  const c = Math.min(CUSTOM_GRID_MAX, Math.max(1, Math.round(cols)));
  const cells: CollageCell[] = [];
  for (let row = 0; row < r; row++) {
    for (let col = 0; col < c; col++) {
      cells.push({ x: col / c, y: row / r, width: 1 / c, height: 1 / r });
    }
  }
  return { id: `grid-${r}x${c}`, label: 'Personalizado', cells };
}

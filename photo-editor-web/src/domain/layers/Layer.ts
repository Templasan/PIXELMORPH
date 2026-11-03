/**
 * RF-002/RF-052/RF-033: a real (if intentionally small) non-destructive layer stack.
 * "Fundo" and "Ajustes" are fixed layers the editor already has real content for;
 * "paint" layers hold vector brush strokes — never rasterized into the photo, so hiding,
 * deleting, or reordering one is genuinely reversible (the original pixels are untouched).
 */

import { t } from '../../i18n';
import type { LocalAdjust } from './LocalAdjust';
import type { WarpSample } from './Warp';
export type LayerKind = 'background' | 'adjustments' | 'paint' | 'text' | 'shape' | 'image' | 'local' | 'liquify' | 'art';

/** RF-050: painted looks, made by filters on the picture; opacity is their intensity. */
export type ArtStyle = 'watercolor' | 'oil' | 'charcoal';

export const ART_STYLES: readonly { id: ArtStyle; name: string }[] = [
  { id: 'watercolor', name: 'Aquarela' },
  { id: 'oil', name: 'Óleo' },
  { id: 'charcoal', name: 'Carvão' },
];

/** How the lines of a text line up with each other. */
export type TextAlign = 'left' | 'center' | 'right';

/** How a layer mixes with what is under it; each id is a canvas composite operation. */
export type LayerBlend =
  | 'source-over'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'soft-light'
  | 'darken'
  | 'lighten'
  | 'difference';

export const LAYER_BLENDS: readonly { id: LayerBlend; name: string }[] = [
  { id: 'source-over', name: 'Normal' },
  { id: 'multiply', name: 'Multiplicar' },
  { id: 'screen', name: 'Tela' },
  { id: 'overlay', name: 'Sobrepor' },
  { id: 'soft-light', name: 'Luz suave' },
  { id: 'darken', name: 'Escurecer' },
  { id: 'lighten', name: 'Clarear' },
  { id: 'difference', name: 'Diferença' },
];

/** RF-033: brush tip — round (soft ends), square (square ends, sharp corners), flat (cut ends). */
export type BrushShape = 'round' | 'square' | 'flat';

export const BRUSH_SHAPES: readonly { id: BrushShape; glyph: string; name: string }[] = [
  { id: 'round', glyph: '●', name: 'Pincel redondo' },
  { id: 'square', glyph: '■', name: 'Pincel quadrado' },
  { id: 'flat', glyph: '▬', name: 'Pincel reto' },
];

/** Skia stroke cap/join that draws each brush tip. */
export function brushTip(shape: BrushShape | undefined): {
  cap: 'round' | 'square' | 'butt';
  join: 'round' | 'miter' | 'bevel';
} {
  if (shape === 'square') return { cap: 'square', join: 'miter' };
  if (shape === 'flat') return { cap: 'butt', join: 'bevel' };
  return { cap: 'round', join: 'round' };
}

/**
 * RF-033: stroke width for a stylus. `pressures` are the 0..1 samples gathered while drawing
 * (empty for a finger or a pen that reports none); the average maps to 0.3x..1.7x the base
 * width, so a medium press (0.5) draws at the base width.
 */
export function pressureWidth(baseWidth: number, pressures: readonly number[]): number {
  const valid = pressures.filter((p) => Number.isFinite(p) && p > 0);
  if (valid.length === 0) return baseWidth;
  const average = valid.reduce((a, b) => a + b, 0) / valid.length;
  return baseWidth * (0.3 + 1.4 * Math.min(1, average));
}

export interface PaintStroke {
  id: string;
  path: string; // SVG path data, e.g. "M10,10 L12,14 L15,20"
  color: string;
  width: number;
  opacity: number; // 0..1
  shape?: BrushShape; // defaults to 'round'
}

/**
 * RF-008: a real overlaid text element — font family, color, shadow and outline all render
 * for real on the Skia canvas (and so survive export), not just in a preview drawer.
 * entrada/saida are the entry/exit timing (0..100%) a video export would use to animate it;
 * the photo editor has no timeline to play that back on, so they're stored but only consumed
 * once a caller has one (see VideoEditorScreen).
 */
export interface TextElement {
  content: string;
  x: number; // normalized 0..1, center point
  y: number;
  fontSize: number;
  fontFamily: string; // a system font family name, e.g. 'sans-serif-condensed'
  color: string;
  shadow: boolean;
  strokeColor: string;
  strokeWidth: number; // 0 = no outline
  entrada: number; // 0..100
  saida: number; // 0..100
  rotation?: number; // degrees
  align?: TextAlign; // defaults to 'center'
}

/** RF-044: a real vector shape overlay — circle, rectangle, line or arrow. */
export type ShapeKind = 'circle' | 'rect' | 'arrow' | 'line';

export interface ShapeElement {
  kind: ShapeKind;
  x: number; // normalized 0..1, center point
  y: number;
  size: number; // normalized 0..1, half-extent relative to canvas width
  color: string;
  strokeWidth: number;
  rotation?: number; // degrees
}

/** A picture stacked over the photo; its pixels stay in their own file. */
export interface ImageElement {
  uri: string;
  x: number; // normalized 0..1, center point
  y: number;
  size: number; // width as a fraction of the canvas width
  aspect: number; // width / height of the picture
  rotation?: number; // degrees
  qr?: string; // RF-066: what the picture says, when it is a generated QR code
}

export interface EditorLayer {
  id: string;
  name: string;
  kind: LayerKind;
  visible: boolean;
  opacity: number; // 0..100
  locked: boolean;
  blend?: LayerBlend; // defaults to 'source-over'
  clip?: boolean; // shows only where the layer below it has pixels
  strokes?: PaintStroke[]; // only present (and meaningful) for kind === 'paint'
  text?: TextElement; // only present (and meaningful) for kind === 'text'
  shape?: ShapeElement; // only present (and meaningful) for kind === 'shape'
  image?: ImageElement; // only present (and meaningful) for kind === 'image'
  local?: LocalAdjust; // only present (and meaningful) for kind === 'local'
  warp?: WarpSample[]; // only present (and meaningful) for kind === 'liquify'
  art?: ArtStyle; // only present (and meaningful) for kind === 'art'
}

let strokeCounter = 0;
export function createStrokeId(): string {
  strokeCounter += 1;
  return `stroke_${Date.now()}_${strokeCounter}`;
}

let layerCounter = 0;
export function createLayerId(): string {
  layerCounter += 1;
  return `layer_${Date.now()}_${layerCounter}`;
}

export function createPaintLayer(name: string): EditorLayer {
  return {
    id: createLayerId(),
    name,
    kind: 'paint',
    visible: true,
    opacity: 100,
    locked: false,
    strokes: [],
  };
}

export interface TextLayerOptions {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  shadow?: boolean;
  strokeColor?: string;
  strokeWidth?: number;
  entrada?: number;
  saida?: number;
  align?: TextAlign;
}

export function createTextLayer(
  name: string,
  content: string,
  options: TextLayerOptions = {}
): EditorLayer {
  return {
    id: createLayerId(),
    name,
    kind: 'text',
    visible: true,
    opacity: 100,
    locked: false,
    text: {
      content,
      x: 0.5,
      y: 0.5,
      fontSize: options.fontSize ?? 28,
      fontFamily: options.fontFamily ?? 'sans-serif',
      color: options.color ?? '#FFFFFF',
      shadow: options.shadow ?? false,
      strokeColor: options.strokeColor ?? '#000000',
      // White text needs a dark outline to stay readable on light photos.
      strokeWidth: options.strokeWidth ?? 2,
      entrada: options.entrada ?? 0,
      saida: options.saida ?? 100,
      align: options.align ?? 'center',
    },
  };
}

export interface ShapeLayerOptions {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function createShapeLayer(
  name: string,
  kind: ShapeKind,
  options: ShapeLayerOptions = {}
): EditorLayer {
  return {
    id: createLayerId(),
    name,
    kind: 'shape',
    visible: true,
    opacity: 100,
    locked: false,
    shape: {
      kind,
      x: 0.5,
      y: 0.5,
      size: options.size ?? 0.15,
      color: options.color ?? '#FFFFFF',
      strokeWidth: options.strokeWidth ?? 4,
    },
  };
}

export function createLocalLayer(name: string, local: LocalAdjust): EditorLayer {
  return { id: createLayerId(), name, kind: 'local', visible: true, opacity: 100, locked: false, local };
}

export function createArtLayer(name: string, art: ArtStyle): EditorLayer {
  return { id: createLayerId(), name, kind: 'art', visible: true, opacity: 100, locked: false, art };
}

export function createLiquifyLayer(name: string): EditorLayer {
  return { id: createLayerId(), name, kind: 'liquify', visible: true, opacity: 100, locked: false, warp: [] };
}

/** A picture layer filling at most `fill` of a canvas of `canvasAspect` (width / height). */
export function createImageLayer(
  name: string,
  uri: string,
  aspect: number,
  canvasAspect: number,
  fill = 0.7
): EditorLayer {
  return {
    id: createLayerId(),
    name,
    kind: 'image',
    visible: true,
    opacity: 100,
    locked: false,
    image: { uri, x: 0.5, y: 0.5, size: fill * Math.min(1, aspect / canvasAspect), aspect },
  };
}

/** Where a copy lands relative to its original, so it can be seen. */
const COPY_OFFSET = 0.03;

/** RF-052: duplicate — a deep copy so editing the copy never touches the original strokes. */
export function duplicateLayer(layer: EditorLayer): EditorLayer {
  const copy: EditorLayer = {
    ...layer,
    id: createLayerId(),
    name: t('{name} (cópia)', { name: layer.name }),
    strokes: layer.strokes?.map((s) => ({ ...s, id: createStrokeId() })),
  };
  const el = elementOf(layer);
  return el ? patchElement(copy, { x: el.x + COPY_OFFSET, y: el.y + COPY_OFFSET }) : copy;
}

/** Fixed at the bottom of the stack: everything else may be reordered, copied and deleted. */
export function isFixedLayer(layer: EditorLayer): boolean {
  return layer.kind === 'background' || layer.kind === 'adjustments';
}

export interface LayerGroup {
  base: EditorLayer;
  /** The layers that show only inside the base, bottom first. */
  clipped: EditorLayer[];
}

/**
 * What to draw, bottom to top: each visible layer with the layers clipped to it. A clipped layer
 * follows its base: it hides with it. Over a fixed layer (nothing to clip to) it draws as usual.
 */
export function layerGroups(layers: readonly EditorLayer[]): LayerGroup[] {
  const groups: LayerGroup[] = [];
  let current: LayerGroup | null = null;
  for (const layer of layers) {
    if (layer.clip && current && !isFixedLayer(current.base)) {
      if (layer.visible) current.clipped.push(layer);
      continue;
    }
    current = { base: layer, clipped: [] };
    if (layer.visible) groups.push(current);
  }
  return groups;
}

/** What a layer places on the picture (text, shape or image); null for the others. */
export function elementOf(layer: EditorLayer): TextElement | ShapeElement | ImageElement | null {
  return layer.text ?? layer.shape ?? layer.image ?? null;
}

export function patchElement(
  layer: EditorLayer,
  patch: { x?: number; y?: number; rotation?: number }
): EditorLayer {
  if (layer.text) return { ...layer, text: { ...layer.text, ...patch } };
  if (layer.shape) return { ...layer, shape: { ...layer.shape, ...patch } };
  if (layer.image) return { ...layer, image: { ...layer.image, ...patch } };
  return layer;
}

/** Resizes a placed layer by `factor` from `start` (its state when the gesture began). */
export function scaleElement(start: EditorLayer, factor: number): EditorLayer {
  if (start.text) {
    const fontSize = Math.max(6, Math.min(240, start.text.fontSize * factor));
    return { ...start, text: { ...start.text, fontSize } };
  }
  if (start.shape) {
    const size = Math.max(0.01, Math.min(1, start.shape.size * factor));
    return { ...start, shape: { ...start.shape, size } };
  }
  if (start.image) {
    const size = Math.max(0.03, Math.min(4, start.image.size * factor));
    return { ...start, image: { ...start.image, size } };
  }
  return start;
}

/** Moves a layer to `toIndex` of the stack (later = on top), never below the fixed layers. */
export function reorderLayer(layers: EditorLayer[], id: string, toIndex: number): EditorLayer[] {
  const from = layers.findIndex((l) => l.id === id);
  if (from < 0 || isFixedLayer(layers[from])) return layers;
  const floor = layers.filter(isFixedLayer).length;
  const to = Math.max(floor, Math.min(layers.length - 1, toIndex));
  if (to === from) return layers;
  const rest = layers.filter((l) => l.id !== id);
  return [...rest.slice(0, to), layers[from], ...rest.slice(to)];
}

/** RF-044: builds a right-pointing arrow (shaft + head) as an SVG path, in pixel space. */
export function arrowPath(cx: number, cy: number, halfLength: number): string {
  const x1 = cx - halfLength;
  const x2 = cx + halfLength;
  const head = Math.max(halfLength * 0.4, 6);
  return `M${x1},${cy} L${x2},${cy} M${x2},${cy} L${x2 - head},${cy - head} M${x2},${cy} L${x2 - head},${cy + head}`;
}

/**
 * RF-052: merge every visible, unlocked paint layer into the first one, in stacking order.
 * Non-paint layers (background/adjustments) are never merged — they aren't stroke stacks.
 */
export function mergeVisiblePaintLayers(layers: EditorLayer[]): EditorLayer[] {
  const mergeable = layers.filter((l) => l.kind === 'paint' && l.visible && !l.locked);
  if (mergeable.length < 2) return layers;

  const [target, ...rest] = mergeable;
  const restIds = new Set(rest.map((l) => l.id));
  const mergedStrokes = mergeable.flatMap((l) => l.strokes ?? []);

  return layers
    .filter((l) => !restIds.has(l.id))
    .map((l) => (l.id === target.id ? { ...l, strokes: mergedStrokes } : l));
}

/** SVG path data for a freehand stroke (straight segments between the captured points). */
export function pointsToPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return `M${first.x},${first.y} ${rest.map((p) => `L${p.x},${p.y}`).join(' ')}`;
}

/** RF-008: the Elementos ▸ Texto form — creates a text layer, or edits the selected one. */
export interface TextDraft {
  content: string;
  fontFamily: string;
  color: string;
  shadow: boolean;
  strokeColor: string;
  strokeWidth: number;
  entrada: number;
  saida: number;
  align: TextAlign;
}

/** RF-044: the Elementos ▸ Formas form — same create-or-edit pattern as text. */
export interface ShapeDraft {
  kind: ShapeKind;
  color: string;
  strokeWidth: number;
}

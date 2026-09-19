/**
 * RF-002/RF-052/RF-033: a real (if intentionally small) non-destructive layer stack.
 * "Fundo" and "Ajustes" are fixed layers the editor already has real content for;
 * "paint" layers hold vector brush strokes — never rasterized into the photo, so hiding,
 * deleting, or reordering one is genuinely reversible (the original pixels are untouched).
 */

export type LayerKind = 'background' | 'adjustments' | 'paint' | 'text' | 'shape';

export interface PaintStroke {
  id: string;
  path: string; // SVG path data, e.g. "M10,10 L12,14 L15,20"
  color: string;
  width: number;
  opacity: number; // 0..1
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
}

export interface EditorLayer {
  id: string;
  name: string;
  kind: LayerKind;
  visible: boolean;
  opacity: number; // 0..100
  locked: boolean;
  strokes?: PaintStroke[]; // only present (and meaningful) for kind === 'paint'
  text?: TextElement; // only present (and meaningful) for kind === 'text'
  shape?: ShapeElement; // only present (and meaningful) for kind === 'shape'
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
      strokeWidth: options.strokeWidth ?? 0,
      entrada: options.entrada ?? 0,
      saida: options.saida ?? 100,
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

/** RF-052: duplicate — a deep copy so editing the copy never touches the original strokes. */
export function duplicateLayer(layer: EditorLayer): EditorLayer {
  return {
    ...layer,
    id: createLayerId(),
    name: `${layer.name} (cópia)`,
    strokes: layer.strokes?.map((s) => ({ ...s, id: createStrokeId() })),
  };
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

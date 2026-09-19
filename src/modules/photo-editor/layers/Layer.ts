/**
 * RF-002/RF-052/RF-033: a real (if intentionally small) non-destructive layer stack.
 * "Fundo" and "Ajustes" are fixed layers the editor already has real content for;
 * "paint" layers hold vector brush strokes — never rasterized into the photo, so hiding,
 * deleting, or reordering one is genuinely reversible (the original pixels are untouched).
 */

export type LayerKind = 'background' | 'adjustments' | 'paint';

export interface PaintStroke {
  id: string;
  path: string; // SVG path data, e.g. "M10,10 L12,14 L15,20"
  color: string;
  width: number;
  opacity: number; // 0..1
}

export interface EditorLayer {
  id: string;
  name: string;
  kind: LayerKind;
  visible: boolean;
  opacity: number; // 0..100
  locked: boolean;
  strokes?: PaintStroke[]; // only present (and meaningful) for kind === 'paint'
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

/** RF-052: duplicate — a deep copy so editing the copy never touches the original strokes. */
export function duplicateLayer(layer: EditorLayer): EditorLayer {
  return {
    ...layer,
    id: createLayerId(),
    name: `${layer.name} (cópia)`,
    strokes: layer.strokes?.map((s) => ({ ...s, id: createStrokeId() })),
  };
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

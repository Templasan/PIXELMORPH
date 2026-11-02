/**
 * "Distribuir igualmente": spaces the text and shape layers evenly along one axis. Pure, so the
 * result depends only on the layers' positions, not on their order in the stack.
 */

import type { EditorLayer } from './Layer';

export type DistributeAxis = 'horizontal' | 'vertical';

/** The layers that have a position to move: visible, unlocked text and shape layers. */
export function movableLayers(layers: readonly EditorLayer[]): EditorLayer[] {
  return layers.filter((l) => (l.text || l.shape) && l.visible && !l.locked);
}

/**
 * Keeps the outermost two positioned layers where they are (by centre on the axis) and spaces the
 * rest evenly between them. The other axis, the stack order and every other layer stay as they
 * are. With fewer than three positioned layers the input is returned unchanged.
 */
export function distributeLayers(layers: EditorLayer[], axis: DistributeAxis): EditorLayer[] {
  const movable = movableLayers(layers);
  if (movable.length < 3) return layers;
  const key = axis === 'horizontal' ? 'x' : 'y';
  const at = (l: EditorLayer) => (l.text ?? l.shape)!;
  // Ties on the centre are broken by id, so the outcome never depends on the array order.
  const sorted = [...movable].sort(
    (a, b) => at(a)[key] - at(b)[key] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
  const first = at(sorted[0])[key];
  const last = at(sorted[sorted.length - 1])[key];
  const step = (last - first) / (sorted.length - 1);
  const target = new Map(
    sorted.map((l, i) => [l.id, i === 0 ? first : i === sorted.length - 1 ? last : first + step * i])
  );
  return layers.map((l) => {
    const value = target.get(l.id);
    if (value === undefined) return l;
    return l.text ? { ...l, text: { ...l.text, [key]: value } } : { ...l, shape: { ...l.shape!, [key]: value } };
  });
}

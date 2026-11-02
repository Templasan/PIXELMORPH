import { createPaintLayer, createShapeLayer, createTextLayer, distributeLayers, type EditorLayer } from '../src/domain/layers';

/** A text layer centred at (x, y). */
function text(id: string, x: number, y: number, visible = true): EditorLayer {
  const l = createTextLayer(id, id);
  return { ...l, id, visible, text: { ...l.text!, x, y } };
}

/** A shape layer centred at (x, y). */
function shape(id: string, x: number, y: number): EditorLayer {
  const l = createShapeLayer(id, 'circle');
  return { ...l, id, shape: { ...l.shape!, x, y } };
}

const centre = (layers: EditorLayer[], id: string) => {
  const l = layers.find((x) => x.id === id)!;
  return { x: (l.text ?? l.shape)!.x, y: (l.text ?? l.shape)!.y };
};

describe('distributeLayers', () => {
  it('spaces the middle layers evenly, keeping the outermost two on the axis', () => {
    const layers = [text('a', 0.1, 0.5), text('b', 0.2, 0.5), text('c', 0.3, 0.5), text('d', 0.9, 0.5)];
    const out = distributeLayers(layers, 'horizontal');
    expect(centre(out, 'a').x).toBeCloseTo(0.1, 9);
    expect(centre(out, 'b').x).toBeCloseTo(0.1 + 0.8 / 3, 9);
    expect(centre(out, 'c').x).toBeCloseTo(0.1 + (2 * 0.8) / 3, 9);
    expect(centre(out, 'd').x).toBe(0.9);
  });

  it('uses the centre on the vertical axis and leaves x alone', () => {
    const layers = [text('a', 0.3, 0.0), text('b', 0.7, 0.4), text('c', 0.1, 0.5), text('d', 0.6, 1.0)];
    const out = distributeLayers(layers, 'vertical');
    expect(centre(out, 'b').y).toBeCloseTo(1 / 3, 9);
    expect(centre(out, 'c').y).toBeCloseTo(2 / 3, 9);
    expect(centre(out, 'a').y).toBe(0);
    expect(centre(out, 'd').y).toBe(1);
    expect(centre(out, 'b').x).toBe(0.7);
    expect(centre(out, 'c').x).toBe(0.1);
  });

  it('gives the same result whatever the array order', () => {
    const base = [shape('p', 0.8, 0.2), text('q', 0.1, 0.2), shape('r', 0.35, 0.9), text('s', 0.5, 0.4)];
    const a = distributeLayers(base, 'horizontal');
    const b = distributeLayers([...base].reverse(), 'horizontal');
    for (const id of ['p', 'q', 'r', 's']) expect(centre(b, id)).toEqual(centre(a, id));
  });

  it('leaves the input unchanged with fewer than three positioned layers', () => {
    const two = [text('a', 0.1, 0.1), text('b', 0.9, 0.9)];
    expect(distributeLayers(two, 'horizontal')).toBe(two);
    const oneShape = [text('a', 0.1, 0.1), text('b', 0.5, 0.5), createPaintLayer('paint')];
    expect(distributeLayers(oneShape, 'vertical')).toBe(oneShape);
  });

  it('keeps an already even row where it is', () => {
    const layers = [text('a', 0.2, 0.5), text('b', 0.4, 0.5), text('c', 0.6, 0.5)];
    const out = distributeLayers(layers, 'horizontal');
    expect(centre(out, 'b').x).toBeCloseTo(0.4, 9);
  });

  it('touches only visible text and shape layers, and keeps painting and hidden layers as they were', () => {
    const paint = createPaintLayer('paint');
    const hidden = text('hidden', 0.5, 0.05, false);
    const layers = [paint, text('a', 0.0, 0.3), hidden, text('b', 0.45, 0.3), shape('c', 1.0, 0.3)];
    const out = distributeLayers(layers, 'horizontal');
    expect(out.find((l) => l.id === paint.id)).toBe(paint);
    expect(out.find((l) => l.id === 'hidden')).toBe(hidden);
    expect(centre(out, 'b').x).toBeCloseTo(0.5, 9);
    expect(out.map((l) => l.id)).toEqual(layers.map((l) => l.id));
  });

  it('keeps locked layers where they are and spaces the rest around them', () => {
    const lockedEnd = { ...text('a', 0.0, 0.5), locked: true };
    const layers = [lockedEnd, text('b', 0.2, 0.5), text('c', 0.3, 0.5), text('d', 0.9, 0.5)];
    const out = distributeLayers(layers, 'horizontal');
    expect(out.find((l) => l.id === 'a')).toBe(lockedEnd);
    expect(centre(out, 'b').x).toBe(0.2);
    expect(centre(out, 'c').x).toBeCloseTo(0.55, 9);
    expect(centre(out, 'd').x).toBe(0.9);
  });

  it('leaves the input unchanged when locking leaves fewer than three movable layers', () => {
    const locked = { ...text('b', 0.5, 0.5), locked: true };
    const layers = [text('a', 0.1, 0.5), locked, text('c', 0.9, 0.5)];
    expect(distributeLayers(layers, 'horizontal')).toBe(layers);
  });
});

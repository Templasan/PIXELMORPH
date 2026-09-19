import {
  arrowPath,
  createPaintLayer,
  createShapeLayer,
  createTextLayer,
  duplicateLayer,
  mergeVisiblePaintLayers,
  type EditorLayer,
} from '@modules/photo-editor/layers';

describe('createShapeLayer', () => {
  it('centers a new shape with sane defaults', () => {
    const layer = createShapeLayer('Círculo 1', 'circle');
    expect(layer.kind).toBe('shape');
    expect(layer.shape?.kind).toBe('circle');
    expect(layer.shape?.x).toBe(0.5);
    expect(layer.shape?.y).toBe(0.5);
    expect(layer.shape?.strokeWidth).toBe(4);
  });

  it('applies the given style options over the defaults', () => {
    const layer = createShapeLayer('Seta 1', 'arrow', { color: '#00FF00', strokeWidth: 8 });
    expect(layer.shape?.color).toBe('#00FF00');
    expect(layer.shape?.strokeWidth).toBe(8);
  });
});

describe('arrowPath', () => {
  it('draws a shaft from tail to head plus two head strokes', () => {
    const path = arrowPath(100, 50, 20);
    // shaft + two head lines = 3 "M" (moveTo) subpaths
    expect(path.match(/M/g)).toHaveLength(3);
    expect(path).toContain('M80,50 L120,50');
  });
});

describe('createTextLayer', () => {
  it('centers new text with sane defaults', () => {
    const layer = createTextLayer('Texto 1', 'Oi mundo');
    expect(layer.kind).toBe('text');
    expect(layer.text?.content).toBe('Oi mundo');
    expect(layer.text?.x).toBe(0.5);
    expect(layer.text?.y).toBe(0.5);
    expect(layer.text?.shadow).toBe(false);
    expect(layer.text?.strokeWidth).toBe(0);
  });

  it('applies the given style options over the defaults', () => {
    const layer = createTextLayer('Texto 1', 'Oi', {
      fontFamily: 'serif',
      color: '#FF0000',
      shadow: true,
      strokeWidth: 3,
    });
    expect(layer.text?.fontFamily).toBe('serif');
    expect(layer.text?.color).toBe('#FF0000');
    expect(layer.text?.shadow).toBe(true);
    expect(layer.text?.strokeWidth).toBe(3);
  });
});

describe('createPaintLayer', () => {
  it('starts visible, unlocked, at full opacity, with no strokes', () => {
    const layer = createPaintLayer('Pintura 1');
    expect(layer.kind).toBe('paint');
    expect(layer.visible).toBe(true);
    expect(layer.locked).toBe(false);
    expect(layer.opacity).toBe(100);
    expect(layer.strokes).toEqual([]);
  });

  it('gives every layer a unique id', () => {
    const a = createPaintLayer('A');
    const b = createPaintLayer('B');
    expect(a.id).not.toBe(b.id);
  });
});

describe('duplicateLayer', () => {
  it('copies strokes without sharing references (editing the copy leaves the original intact)', () => {
    const original = createPaintLayer('Pintura 1');
    original.strokes = [{ id: 's1', path: 'M0,0 L10,10', color: 'red', width: 4, opacity: 1 }];

    const copy = duplicateLayer(original);
    expect(copy.id).not.toBe(original.id);
    expect(copy.strokes).not.toBe(original.strokes);
    expect(copy.strokes?.[0].id).not.toBe(original.strokes[0].id);

    // Mutating the copy's stroke list must not affect the original.
    copy.strokes?.push({ id: 's2', path: 'M1,1 L2,2', color: 'blue', width: 2, opacity: 1 });
    expect(original.strokes).toHaveLength(1);
  });

  it('names the copy distinctly', () => {
    const original = createPaintLayer('Pintura 1');
    expect(duplicateLayer(original).name).toBe('Pintura 1 (cópia)');
  });
});

describe('mergeVisiblePaintLayers', () => {
  function paintLayer(overrides: Partial<EditorLayer>): EditorLayer {
    return { ...createPaintLayer('P'), ...overrides };
  }

  it('combines strokes from every visible, unlocked paint layer into the first one', () => {
    const a = paintLayer({
      id: 'a',
      strokes: [{ id: 's1', path: 'M0,0', color: 'red', width: 1, opacity: 1 }],
    });
    const b = paintLayer({
      id: 'b',
      strokes: [{ id: 's2', path: 'M1,1', color: 'blue', width: 1, opacity: 1 }],
    });
    const result = mergeVisiblePaintLayers([a, b]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
    expect(result[0].strokes?.map((s) => s.id)).toEqual(['s1', 's2']);
  });

  it('leaves hidden or locked paint layers out of the merge', () => {
    const a = paintLayer({
      id: 'a',
      strokes: [{ id: 's1', path: 'M0,0', color: 'red', width: 1, opacity: 1 }],
    });
    const hidden = paintLayer({
      id: 'b',
      visible: false,
      strokes: [{ id: 's2', path: 'M1,1', color: 'blue', width: 1, opacity: 1 }],
    });
    const locked = paintLayer({
      id: 'c',
      locked: true,
      strokes: [{ id: 's3', path: 'M2,2', color: 'green', width: 1, opacity: 1 }],
    });

    const result = mergeVisiblePaintLayers([a, hidden, locked]);

    expect(result).toHaveLength(3); // nothing merged — only one eligible layer
    expect(result.find((l) => l.id === 'a')?.strokes?.map((s) => s.id)).toEqual(['s1']);
  });

  it('never touches the background or adjustments layers', () => {
    const background: EditorLayer = {
      id: 'bg',
      name: 'Fundo',
      kind: 'background',
      visible: true,
      opacity: 100,
      locked: true,
    };
    const a = paintLayer({
      id: 'a',
      strokes: [{ id: 's1', path: 'M0,0', color: 'red', width: 1, opacity: 1 }],
    });
    const b = paintLayer({
      id: 'b',
      strokes: [{ id: 's2', path: 'M1,1', color: 'blue', width: 1, opacity: 1 }],
    });

    const result = mergeVisiblePaintLayers([background, a, b]);

    expect(result.some((l) => l.id === 'bg')).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('is a no-op with fewer than two mergeable paint layers', () => {
    const a = paintLayer({ id: 'a' });
    const result = mergeVisiblePaintLayers([a]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });
});

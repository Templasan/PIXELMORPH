import {
  arrowPath,
  createArtLayer,
  createImageLayer,
  createPaintLayer,
  createShapeLayer,
  createTextLayer,
  duplicateLayer,
  layerGroups,
  mergeVisiblePaintLayers,
  reorderLayer,
  scaleElement,
  type EditorLayer,
} from '../src/domain/layers';

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
    // White text gets a dark outline by default so it reads on light photos.
    expect(layer.text?.strokeWidth).toBe(2);
    expect(layer.text?.strokeColor).toBe('#000000');
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

describe('stacking', () => {
  const stack = () => {
    const fixed = (id: string, kind: 'background' | 'adjustments') =>
      ({ id, name: id, kind, visible: true, opacity: 100, locked: false }) as const;
    return [fixed('fundo', 'background'), fixed('ajustes', 'adjustments'), createPaintLayer('a'), createPaintLayer('b'), createPaintLayer('c')];
  };

  it('reorders above the fixed layers only', () => {
    const ls = stack();
    const [, , a, b, c] = ls;
    expect(reorderLayer(ls, c.id, 2).map((l) => l.id)).toEqual(['fundo', 'ajustes', c.id, a.id, b.id]);
    expect(reorderLayer(ls, a.id, 99).map((l) => l.id)).toEqual(['fundo', 'ajustes', b.id, c.id, a.id]);
    expect(reorderLayer(ls, c.id, 0).map((l) => l.id)).toEqual(['fundo', 'ajustes', c.id, a.id, b.id]);
    expect(reorderLayer(ls, 'fundo', 3)).toBe(ls);
    expect(reorderLayer(ls, a.id, 2)).toBe(ls);
  });

  it('fits a picture layer inside the canvas whatever its shape', () => {
    expect(createImageLayer('w', 'u', 2, 1).image!.size).toBeCloseTo(0.7);
    // A tall picture on a wide canvas: limited by the canvas height.
    const tall = createImageLayer('t', 'u', 0.5, 2).image!;
    expect((tall.size * 2) / tall.aspect).toBeCloseTo(0.7);
  });

  it('resizes each kind from its own measure and keeps it in range', () => {
    const text = createTextLayer('t', 'x', { fontSize: 20 });
    expect(scaleElement(text, 2).text!.fontSize).toBe(40);
    expect(scaleElement(text, 1000).text!.fontSize).toBe(240);
    const shape = createShapeLayer('s', 'rect', { size: 0.1 });
    expect(scaleElement(shape, 2).shape!.size).toBeCloseTo(0.2);
    const image = createImageLayer('i', 'u', 1, 1);
    expect(scaleElement(image, 0).image!.size).toBe(0.03);
  });

  it('a copy of a placed layer lands beside the original and is a new layer', () => {
    const image = createImageLayer('i', 'u', 1, 1);
    const copy = duplicateLayer(image);
    expect(copy.id).not.toBe(image.id);
    expect(copy.image!.x).toBeGreaterThan(image.image!.x);
    expect(image.image!.x).toBe(0.5);
  });
});

describe('clipping', () => {
  const fixed = { id: 'fundo', name: 'f', kind: 'background', visible: true, opacity: 100, locked: false } as const;
  const paint = (name: string, extra: Partial<EditorLayer> = {}) => ({ ...createPaintLayer(name), ...extra });

  it('groups clipped layers on the layer below them', () => {
    const a = paint('a');
    const b = paint('b', { clip: true });
    const c = paint('c', { clip: true });
    const d = paint('d');
    const groups = layerGroups([fixed, a, b, c, d]);
    expect(groups.map((g) => [g.base.name, g.clipped.map((l) => l.name)])).toEqual([
      ['f', []],
      ['a', ['b', 'c']],
      ['d', []],
    ]);
  });

  it('a clipped layer hides with its base, and when it is hidden the base stays', () => {
    const a = paint('a', { visible: false });
    const b = paint('b', { clip: true });
    expect(layerGroups([a, b])).toEqual([]);
    const shown = paint('a');
    const off = paint('b', { clip: true, visible: false });
    expect(layerGroups([shown, off])).toEqual([{ base: shown, clipped: [] }]);
  });

  it('over a fixed layer there is nothing to clip to: it draws as usual', () => {
    const b = paint('b', { clip: true });
    expect(layerGroups([fixed, b]).map((g) => g.base.name)).toEqual(['f', 'b']);
  });
});

describe('artistic filters', () => {
  it('are layers with a style, at full intensity', () => {
    const l = createArtLayer('Óleo', 'oil');
    expect(l.kind).toBe('art');
    expect(l.art).toBe('oil');
    expect(l.opacity).toBe(100);
  });
});

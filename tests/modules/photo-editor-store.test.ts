import {
  createPhotoEditorStore,
  type AdjustmentsHistory,
} from '@modules/photo-editor/application/photoEditorStore';
import { DEFAULT_ADJUSTMENTS } from '@modules/photo-editor/domain/adjustments';

// Characterization of PhotoEditorScreen's editing behaviour (US-04/05/08/RF-027), now owned by
// the store: live slider values, one undo entry per release, edits made before the history
// loads survive the replay, bake resets clear their fields' history, strokes land on the
// selected layer.

function fakeHistory() {
  const past: { type: string; params: { from: unknown; to: unknown } }[] = [];
  const future: typeof past = [];
  const cleared: string[][] = [];
  const history: AdjustmentsHistory = {
    push: (type, from, to) => {
      past.push({ type, params: { from, to } });
      future.length = 0;
    },
    undo: () => {
      const op = past.pop();
      if (op) future.unshift(op);
      return op;
    },
    redo: () => {
      const op = future.shift();
      if (op) past.push(op);
      return op;
    },
    clearFields: (types) => {
      cleared.push([...types]);
    },
  };
  return { history, past, cleared };
}

function setup() {
  const { history, past, cleared } = fakeHistory();
  const editor = createPhotoEditorStore(history);
  return { editor, past, cleared, state: () => editor.store.get() };
}

describe('photo editor store', () => {
  it('a slider drag is live values plus exactly one undo entry on release', () => {
    const { editor, past, state } = setup();
    editor.setField('saturacao', 10);
    editor.setField('saturacao', 30);
    expect(state().adjustments.saturacao).toBe(30);
    expect(past).toHaveLength(0);
    editor.commitField('saturacao', 40, 0);
    expect(past).toEqual([{ type: 'saturacao', params: { from: 0, to: 40 } }]);
  });

  it('releasing on the starting value records nothing', () => {
    const { editor, past } = setup();
    editor.setField('exposicao', 20);
    editor.commitField('exposicao', 0, 0);
    expect(past).toHaveLength(0);
  });

  it('undo and redo restore the field', () => {
    const { editor, state } = setup();
    editor.commitField('temperatura', 25, 0);
    editor.undo();
    expect(state().adjustments.temperatura).toBe(0);
    editor.redo();
    expect(state().adjustments.temperatura).toBe(25);
  });

  it('edits made before the history finished loading win over the replay', () => {
    const { editor, state } = setup();
    editor.setField('matiz', 15);
    editor.hydrateAdjustments({ ...DEFAULT_ADJUSTMENTS, matiz: 5, vibracao: 8 });
    expect(state().adjustments.matiz).toBe(15);
    expect(state().adjustments.vibracao).toBe(8);
  });

  it('bake reset puts the fields back to neutral and clears their undo entries', () => {
    const { editor, cleared, state } = setup();
    editor.commitField('saturacao', 50, 0);
    editor.commitField('rotation90', 90, 0);
    editor.resetFields(['saturacao']);
    expect(state().adjustments.saturacao).toBe(DEFAULT_ADJUSTMENTS.saturacao);
    expect(state().adjustments.rotation90).toBe(90);
    expect(cleared).toEqual([['saturacao']]);
  });

  it('tools toggle, and the shortcut cycles through the toolbar order', () => {
    const { editor, state } = setup();
    editor.toggleTool('ajustes');
    expect(state().activeTool).toBe('ajustes');
    editor.toggleTool('ajustes');
    expect(state().activeTool).toBeNull();
    editor.nextTool(['a', 'b', 'c']);
    expect(state().activeTool).toBe('a');
    editor.nextTool(['a', 'b', 'c']);
    editor.nextTool(['a', 'b', 'c']);
    editor.nextTool(['a', 'b', 'c']);
    expect(state().activeTool).toBe('a');
  });

  it('a stroke with 2+ points is appended to the selected paint layer with the brush settings', () => {
    const { editor, state } = setup();
    const paint = state().layers.find((l) => l.kind === 'paint')!;
    editor.selectLayer(paint.id);
    editor.setBrush({ color: '#00FF00', size: 12, opacity: 50 });
    editor.appendStrokePoint(1, 1);
    editor.appendStrokePoint(5, 5);
    editor.commitStroke();
    const strokes = state().layers.find((l) => l.id === paint.id)!.strokes!;
    expect(strokes).toHaveLength(1);
    expect(strokes[0]).toMatchObject({ path: 'M1,1 L5,5', color: '#00FF00', opacity: 0.5 });
    expect(state().currentStroke).toEqual([]);
  });

  it('a single tap (1 point) leaves no stroke', () => {
    const { editor, state } = setup();
    const paint = state().layers.find((l) => l.kind === 'paint')!;
    editor.selectLayer(paint.id);
    editor.appendStrokePoint(3, 3);
    editor.commitStroke();
    expect(state().layers.find((l) => l.id === paint.id)!.strokes ?? []).toHaveLength(0);
  });

  it('hydrating saved layers keeps the selection only if that layer still exists', () => {
    const { editor, state } = setup();
    editor.selectLayer('gone');
    editor.hydrateLayers(state().layers.slice(0, 2));
    expect(state().selectedLayerId).toBe('fundo');
  });

  it('adding layers selects the last one added', () => {
    const { editor, state } = setup();
    const extra = { ...state().layers[2], id: 'x1' };
    const extra2 = { ...state().layers[2], id: 'x2' };
    editor.addLayers([extra, extra2]);
    expect(state().selectedLayerId).toBe('x2');
  });
});

describe('photo editor store — Elementos (text, shapes, memes, stickers)', () => {
  it('submitting text creates a layer, selects it, and loads it back into the form', () => {
    const { editor, state } = setup();
    editor.setTextDraft({ content: 'Olá', color: '#FF0000' });
    editor.submitText();
    const text = state().layers.find((l) => l.kind === 'text')!;
    expect(text.text).toMatchObject({ content: 'Olá', color: '#FF0000' });
    expect(state().selectedLayerId).toBe(text.id);
  });

  it('with a text layer selected, submit restyles it in place (same position, no new layer)', () => {
    const { editor, state } = setup();
    editor.setTextDraft({ content: 'A' });
    editor.submitText();
    const id = state().selectedLayerId;
    const before = state().layers.find((l) => l.id === id)!.text!;
    editor.setTextDraft({ content: 'B', color: '#00FF00' });
    editor.submitText();
    const texts = state().layers.filter((l) => l.kind === 'text');
    expect(texts).toHaveLength(1);
    expect(texts[0].text).toMatchObject({
      content: 'B',
      color: '#00FF00',
      x: before.x,
      y: before.y,
    });
  });

  it('empty text is ignored', () => {
    const { editor, state } = setup();
    editor.setTextDraft({ content: '   ' });
    editor.submitText();
    expect(state().layers.some((l) => l.kind === 'text')).toBe(false);
  });

  it('selecting a layer loads its style into the form; the draft survives otherwise', () => {
    const { editor, state } = setup();
    editor.setTextDraft({ content: 'Primeiro', color: '#111111' });
    editor.submitText();
    const first = state().selectedLayerId;
    editor.selectLayer('fundo');
    editor.setTextDraft({ content: 'rascunho' });
    expect(state().textDraft.content).toBe('rascunho');
    editor.selectLayer(first);
    expect(state().textDraft).toMatchObject({ content: 'Primeiro', color: '#111111' });
  });

  it('shape form edits apply live to the selected shape', () => {
    const { editor, state } = setup();
    editor.setShapeDraft({ kind: 'arrow' });
    editor.submitShape();
    const id = state().selectedLayerId;
    expect(state().layers.find((l) => l.id === id)!.name).toBe('Seta 1');
    editor.setShapeDraft({ color: '#FF0000' });
    expect(state().layers.find((l) => l.id === id)!.shape!.color).toBe('#FF0000');
  });

  it('a meme adds top and bottom text layers; a sticker adds one', () => {
    const { editor, state } = setup();
    editor.submitMeme('cima', 'baixo');
    const memes = state().layers.filter((l) => l.name.startsWith('Meme'));
    expect(memes.map((l) => l.text!.y)).toEqual([0.12, 0.88]);
    editor.addSticker('🔥');
    expect(state().layers.find((l) => l.id === state().selectedLayerId)!.text!.content).toBe('🔥');
  });
});

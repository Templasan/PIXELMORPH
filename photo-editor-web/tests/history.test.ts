import { createHistory, replay } from '../src/application/history';

describe('history', () => {
  it('undoes and redoes in order and replays to the last values', () => {
    const { log, state } = createHistory();
    log.push('saturacao', 0, 10);
    log.push('saturacao', 10, 20);
    log.push('exposicao', 0, 1);
    expect(log.undo()?.type).toBe('exposicao');
    expect(log.undo()?.params).toEqual({ from: 10, to: 20 });
    expect(log.redo()?.params).toEqual({ from: 10, to: 20 });
    expect(replay({ saturacao: 0, exposicao: 0 }, state.get().done)).toEqual({ saturacao: 20, exposicao: 0 });
    log.push('matiz', 0, 5); // a new edit drops the redo stack
    expect(state.get().undone).toEqual([]);
    expect(state.get().done.every((op) => op.id && op.timestamp)).toBe(true);
  });

  it('forgets cleared fields', () => {
    const { log, state } = createHistory();
    log.push('perspX0', 0, 0.1);
    log.push('saturacao', 0, 10);
    log.clearFields(['perspX0']);
    expect(state.get().done.map((o) => o.type)).toEqual(['saturacao']);
  });
});

describe('presets in the log', () => {
  it('replays a preset as all its fields at once', () => {
    const { log, state } = createHistory();
    log.push('preset', { saturacao: 0, retroGrain: 0 }, { saturacao: 30, retroGrain: 50 });
    expect(replay({ saturacao: 0, retroGrain: 0, exposicao: 0 }, state.get().done)).toEqual({
      saturacao: 30,
      retroGrain: 50,
      exposicao: 0,
    });
  });
});

describe('a long session', () => {
  it('layer steps never push adjustments out, so reopening keeps them', () => {
    const { log, state } = createHistory();
    log.push('exposure', 0, 40);
    for (let i = 0; i < 500; i += 1) log.push('layers', [], []);
    expect(state.get().done.filter((op) => op.type === 'exposure')).toHaveLength(1);
    expect(state.get().done.filter((op) => op.type === 'layers')).toHaveLength(200);
  });

  it('many adjustments drop only steps a later one overwrites', () => {
    const { log, state } = createHistory();
    log.push('contrast', 0, 25);
    for (let i = 0; i < 300; i += 1) log.push('exposure', i, i + 1);
    const out = replay({ contrast: 0, exposure: 0 }, state.get().done);
    expect(out).toEqual({ contrast: 25, exposure: 300 });
    expect(state.get().done).toHaveLength(200);
  });
});

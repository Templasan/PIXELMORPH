import { createHistory } from '../src/application/history';

describe('undo history saved with the project', () => {
  it('comes back after a restore, keeping the newest 50 steps', () => {
    const a = createHistory();
    for (let i = 0; i < 60; i += 1) a.history.push('tracks', i, i + 1);
    a.history.undo();
    const saved = JSON.parse(JSON.stringify(a.snapshot()));
    expect(saved.done).toHaveLength(50);
    expect(saved.undone).toHaveLength(1);

    const b = createHistory();
    b.restore(saved);
    expect(b.state.get()).toEqual({ canUndo: true, canRedo: true });
    expect(b.history.redo()?.params.to).toBe(60);
    expect(b.history.undo()?.params.from).toBe(59);
  });
});

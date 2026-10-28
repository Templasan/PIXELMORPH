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

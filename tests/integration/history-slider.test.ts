import { HistoryStore } from '../../src/core/history/HistoryStore';
import { createOperation } from '../../src/core/history/Operation';

const init = { brilho: 0, contraste: 0 };

describe('history: slider commits (from/to)', () => {
  it('undo/redo return the right from/to and reconstruct matches', () => {
    const h = new HistoryStore();
    h.push(createOperation('brilho', 0, 30));
    h.push(createOperation('brilho', 30, 50));
    h.push(createOperation('contraste', 0, 10));
    expect(h.reconstructState(init)).toEqual({ brilho: 50, contraste: 10 });

    expect(h.undo()?.params.from).toBe(0);
    expect(h.reconstructState(init)).toEqual({ brilho: 50, contraste: 0 });
    expect(h.undo()?.params.from).toBe(30);
    expect(h.reconstructState(init).brilho).toBe(30);
    expect(h.redo()?.params.to).toBe(50);
    expect(h.reconstructState(init).brilho).toBe(50);
  });

  it('a drag that returns to its start value keeps the true `from` (rollback regression)', () => {
    const h = new HistoryStore();
    h.push(createOperation('brilho', 0, 40));
    h.push(createOperation('brilho', 40, 40));
    expect(h.reconstructState(init).brilho).toBe(40);
    expect(h.undo()?.params).toMatchObject({ from: 40, to: 40 });
    expect(h.reconstructState(init).brilho).toBe(40);
    h.undo();
    expect(h.reconstructState(init).brilho).toBe(0);
  });

  it('a new push after undo drops the redo branch', () => {
    const h = new HistoryStore();
    h.push(createOperation('brilho', 0, 10));
    h.undo();
    h.push(createOperation('brilho', 0, 20));
    expect(h.canRedo).toBe(false);
    expect(h.reconstructState(init).brilho).toBe(20);
  });
});

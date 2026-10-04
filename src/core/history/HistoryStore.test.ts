import { HistoryStore } from './HistoryStore';
import { createOperation } from './Operation';

describe('HistoryStore (RF-027)', () => {
  it('has no cap: thousands of operations can all be undone and redone', () => {
    const store = new HistoryStore();
    for (let i = 0; i < 5000; i++) store.push(createOperation('brilho', i, i + 1));

    let undone = 0;
    while (store.undo()) undone++;
    expect(undone).toBe(5000);

    let redone = 0;
    while (store.redo()) redone++;
    expect(redone).toBe(5000);
  });

  it('survives a snapshot round trip (what persistence between sessions relies on)', () => {
    const store = new HistoryStore();
    store.push(createOperation('brilho', 0, 10));
    store.push(createOperation('contraste', 0, 20));
    store.undo();

    const restored = new HistoryStore(JSON.parse(JSON.stringify(store.toSnapshot())));
    expect(restored.log).toHaveLength(1);
    expect(restored.canRedo).toBe(true);
    expect(restored.reconstructState({ brilho: 0, contraste: 0 })).toEqual({
      brilho: 10,
      contraste: 0,
    });
  });
});

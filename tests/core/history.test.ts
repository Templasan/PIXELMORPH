import { HistoryStore } from '@core/history/HistoryStore';
import { createOperation } from '@core/history/Operation';
import { LocalHistoryRepository } from '@core/history/LocalHistoryRepository';

describe('HistoryStore — unlimited undo/redo (RF-027)', () => {
  it('starts with nothing to undo or redo', () => {
    const store = new HistoryStore();
    expect(store.canUndo).toBe(false);
    expect(store.canRedo).toBe(false);
  });

  it('pushes operations and allows undo/redo to move the pointer', () => {
    const store = new HistoryStore();
    store.push(createOperation('temperatura', 0, 10));
    store.push(createOperation('temperatura', 10, 25));

    expect(store.canUndo).toBe(true);
    expect(store.log).toHaveLength(2);

    const undone = store.undo();
    expect(undone?.params.to).toBe(25);
    expect(store.canRedo).toBe(true);
    expect(store.log).toHaveLength(1);

    const redone = store.redo();
    expect(redone?.params.to).toBe(25);
    expect(store.canRedo).toBe(false);
  });

  it('discards redo history once a new operation is pushed after an undo', () => {
    const store = new HistoryStore();
    store.push(createOperation('exposicao', 0, 1));
    store.push(createOperation('exposicao', 1, 2));
    store.undo();
    expect(store.canRedo).toBe(true);

    store.push(createOperation('exposicao', 1, 3));
    expect(store.canRedo).toBe(false);
    expect(store.log.map((op) => op.params.to)).toEqual([1, 3]);
  });

  it('has no depth limit (RF-027: "desfazer ... a qualquer momento")', () => {
    const store = new HistoryStore();
    for (let i = 0; i < 500; i++) {
      store.push(createOperation('saturacao', i, i + 1));
    }
    expect(store.log).toHaveLength(500);
    for (let i = 0; i < 500; i++) {
      expect(store.undo()).toBeDefined();
    }
    expect(store.canUndo).toBe(false);
    expect(store.canRedo).toBe(true);
  });

  it('reconstructState replays the log to rebuild current field values', () => {
    const store = new HistoryStore();
    store.push(createOperation('temperatura', 0, 10));
    store.push(createOperation('saturacao', 0, -20));
    store.push(createOperation('temperatura', 10, 30));

    const state = store.reconstructState({ temperatura: 0, saturacao: 0, exposicao: 0 });
    expect(state).toEqual({ temperatura: 30, saturacao: -20, exposicao: 0 });
  });

  it('round-trips through a snapshot (what gets persisted)', () => {
    const store = new HistoryStore();
    store.push(createOperation('matiz', 0, 5));
    store.undo();

    const snapshot = store.toSnapshot();
    const restored = new HistoryStore(snapshot);
    expect(restored.canUndo).toBe(false);
    expect(restored.canRedo).toBe(true);
    expect(restored.redo()?.params.to).toBe(5);
  });
});

describe('LocalHistoryRepository — persistence (RNF-005 autosave + RF-027 survives reopen)', () => {
  it('returns null when nothing was ever saved for a session', async () => {
    const repo = new LocalHistoryRepository();
    expect(await repo.load('project-without-history')).toBeNull();
  });

  it('persists and reloads a snapshot for the same session id', async () => {
    const repo = new LocalHistoryRepository();
    const store = new HistoryStore();
    store.push(createOperation('temperatura', 0, 15));

    await repo.save('project-1', store.toSnapshot());

    const reloaded = await repo.load('project-1');
    expect(reloaded).not.toBeNull();

    const reopened = new HistoryStore(reloaded ?? undefined);
    expect(reopened.log).toHaveLength(1);
    expect(reopened.log[0].params.to).toBe(15);
  });

  it('clears a session history', async () => {
    const repo = new LocalHistoryRepository();
    await repo.save('project-2', { past: [createOperation('exposicao', 0, 1)], future: [] });
    await repo.clear('project-2');
    expect(await repo.load('project-2')).toBeNull();
  });
});

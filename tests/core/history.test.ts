import { HistoryStore } from '@core/history/HistoryStore';
import { createOperation } from '@core/history/Operation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalHistoryRepository, HISTORY_PART_CHARS } from '@core/history/LocalHistoryRepository';

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

describe('LocalHistoryRepository — large logs are stored in parts', () => {
  /** A video-editor-like log: every op carries a whole timeline as from/to. */
  function bigSnapshot(ops: number) {
    const timeline = {
      tracks: [{ id: 'v1', clips: [{ sourceUri: 'file:///m/' + 'x'.repeat(3000) }] }],
    };
    return {
      past: Array.from({ length: ops }, (_, i) =>
        createOperation<object>('tracks', timeline, { ...timeline, i })
      ),
      future: [],
    };
  }

  beforeEach(() => AsyncStorage.clear());

  it('round-trips a log far bigger than one value, with no stored value above the part size', async () => {
    const repo = new LocalHistoryRepository();
    const snapshot = bigSnapshot(400); // ~2.4 MB of JSON
    await repo.save('p1', snapshot);

    const keys = [...(await AsyncStorage.getAllKeys())];
    const values = await AsyncStorage.multiGet(keys);
    for (const [, v] of values)
      expect((v as string).length).toBeLessThanOrEqual(HISTORY_PART_CHARS);
    expect(keys.filter((k) => k.startsWith('history:p1#')).length).toBeGreaterThan(1);
    expect(await repo.load('p1')).toEqual(JSON.parse(JSON.stringify(snapshot)));
  });

  it('shrinking back to a small log removes the parts; a small log is a single value', async () => {
    const repo = new LocalHistoryRepository();
    await repo.save('p1', bigSnapshot(400));
    await repo.save('p1', { past: [], future: [] });
    expect(
      (await AsyncStorage.getAllKeys()).filter((k: string) => k.startsWith('history:p1#'))
    ).toEqual([]);
    expect(await repo.load('p1')).toEqual({ past: [], future: [] });
  });

  it('a new save replaces the previous generation of parts', async () => {
    const repo = new LocalHistoryRepository();
    await repo.save('p1', bigSnapshot(400));
    const first = (await AsyncStorage.getAllKeys()).filter((k: string) =>
      k.startsWith('history:p1#')
    );
    await repo.save('p1', bigSnapshot(401));
    const second = (await AsyncStorage.getAllKeys()).filter((k: string) =>
      k.startsWith('history:p1#')
    );
    expect(second.some((k: string) => first.includes(k))).toBe(false);
    expect((await repo.load('p1'))!.past).toHaveLength(401);
  });

  it('loads a log saved in the old single-value format', async () => {
    await AsyncStorage.setItem(
      'history:old',
      JSON.stringify({ past: [createOperation('a', 1, 2)], future: [] })
    );
    expect((await new LocalHistoryRepository().load('old'))!.past).toHaveLength(1);
  });

  it('a missing part means an unreadable log (fresh start), not a crash', async () => {
    const repo = new LocalHistoryRepository();
    await repo.save('p1', bigSnapshot(400));
    const part = (await AsyncStorage.getAllKeys()).find((k: string) => k.startsWith('history:p1#'));
    await AsyncStorage.removeItem(part!);
    expect(await repo.load('p1')).toBeNull();
  });

  it('clear removes the index and every part', async () => {
    const repo = new LocalHistoryRepository();
    await repo.save('p1', bigSnapshot(400));
    await repo.clear('p1');
    expect(
      (await AsyncStorage.getAllKeys()).filter((k: string) => k.startsWith('history:p1'))
    ).toEqual([]);
  });
});

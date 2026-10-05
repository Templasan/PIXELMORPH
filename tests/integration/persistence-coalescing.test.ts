import AsyncStorage from '@react-native-async-storage/async-storage';
import { DebouncedSaver } from '../../src/core/history/DebouncedSaver';
import { HistoryStore } from '../../src/core/history/HistoryStore';
import { LocalHistoryRepository } from '../../src/core/history/LocalHistoryRepository';
import { createOperation } from '../../src/core/history/Operation';
import { AsyncStoragePresetsRepository } from '../../src/infrastructure/repositories/AsyncStoragePresetsRepository';
import { AsyncStorageRecentAdjustmentsRepository } from '../../src/infrastructure/repositories/AsyncStorageRecentAdjustmentsRepository';
import { AsyncStorageWatermarkPresetsRepository } from '../../src/infrastructure/repositories/AsyncStorageWatermarkPresetsRepository';

describe('DebouncedSaver', () => {
  const setItem = AsyncStorage.setItem as unknown as jest.Mock;
  beforeEach(async () => {
    jest.useFakeTimers();
    await AsyncStorage.clear();
    setItem.mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const setup = () => {
    const store = new HistoryStore();
    const repo = new LocalHistoryRepository();
    const saver = new DebouncedSaver(repo, 500);
    const edit = (n: number) => {
      store.push(createOperation('x', n - 1, n));
      saver.schedule('s1', () => store.toSnapshot());
    };
    return { store, repo, saver, edit };
  };

  it('coalesces N pushes into a single save of the latest state', async () => {
    const { repo, saver, edit } = setup();
    for (let i = 1; i <= 20; i++) edit(i);
    expect(setItem).not.toHaveBeenCalled();
    jest.advanceTimersByTime(500);
    await saver.flush(); // no-op: the timer already flushed
    expect(setItem).toHaveBeenCalledTimes(1);
    expect((await repo.load('s1'))!.past).toHaveLength(20);
  });

  it('flush (unmount/background) persists the last edit without waiting', async () => {
    const { repo, saver, edit } = setup();
    edit(1);
    edit(2);
    await saver.flush();
    expect(setItem).toHaveBeenCalledTimes(1);
    expect((await repo.load('s1'))!.past).toHaveLength(2);
    jest.advanceTimersByTime(1000);
    expect(setItem).toHaveBeenCalledTimes(1); // timer was cancelled
  });

  it('does not drop a pending save when the session changes', async () => {
    const { repo, saver, store } = setup();
    store.push(createOperation('x', 0, 1));
    saver.schedule('a', () => store.toSnapshot());
    saver.schedule('b', () => store.toSnapshot());
    await saver.flush();
    expect(await repo.load('a')).not.toBeNull();
    expect(await repo.load('b')).not.toBeNull();
  });
});

describe('AsyncStorage repositories: concurrent writes', () => {
  beforeEach(() => AsyncStorage.clear());

  it('presets: parallel saves keep every item', async () => {
    const repo = new AsyncStoragePresetsRepository();
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        repo.save({ id: `p${i}`, name: `n${i}`, createdAt: new Date() } as any)
      )
    );
    expect(await repo.list()).toHaveLength(10);
    await Promise.all([
      repo.delete('p0'),
      repo.delete('p1'),
      repo.save({ id: 'z', createdAt: new Date() } as any),
    ]);
    expect((await repo.list()).map((p) => p.id).sort()).toEqual(
      ['p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'z']
    );
    expect(await new AsyncStoragePresetsRepository().list()).toHaveLength(9);
    expect((await repo.load('z'))!.createdAt).toBeInstanceOf(Date);
  });

  it('watermark presets: parallel saves keep every item', async () => {
    const repo = new AsyncStorageWatermarkPresetsRepository();
    await Promise.all(
      Array.from({ length: 8 }, (_, i) => repo.save({ id: `w${i}`, createdAt: new Date() } as any))
    );
    expect(await new AsyncStorageWatermarkPresetsRepository().list()).toHaveLength(8);
  });

  it('recent adjustments: parallel adds keep the newest 10, dedupe, clear works', async () => {
    const repo = new AsyncStorageRecentAdjustmentsRepository();
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        repo.add({ id: `r${i}`, adjustments: { b: i }, timestamp: new Date() } as any)
      )
    );
    const list = await repo.list();
    expect(list).toHaveLength(10);
    expect(list[0].id).toBe('r11');
    await repo.add({ id: 'dup', adjustments: { b: 11 }, timestamp: new Date() } as any);
    expect((await repo.list())[0].id).toBe('dup');
    expect(await repo.list()).toHaveLength(10);
    await repo.clear();
    expect(await repo.list()).toEqual([]);
  });
});

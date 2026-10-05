import AsyncStorage from '@react-native-async-storage/async-storage';
import { DebouncedSaver, bindAppStateFlush } from '../../src/core/history/DebouncedSaver';
import { JsonListCache } from '../../src/infrastructure/repositories/JsonListCache';

describe('JsonListCache invalidation', () => {
  beforeEach(() => AsyncStorage.clear());

  it('does not serve stale data after storage is wiped and invalidated', async () => {
    const c = new JsonListCache('k1');
    await c.mutate(() => [{ a: 1 }]);
    await AsyncStorage.clear();
    expect(await c.read()).toEqual([{ a: 1 }]); // stale until invalidated
    await JsonListCache.invalidate('k1');
    expect(await c.read()).toEqual([]);
  });

  it('invalidateAll reloads every cache from storage', async () => {
    const a = new JsonListCache('ka');
    const b = new JsonListCache('kb');
    await a.mutate(() => [1]);
    await b.mutate(() => [2]);
    await AsyncStorage.setItem('ka', '[9]');
    await AsyncStorage.removeItem('kb');
    await JsonListCache.invalidateAll();
    expect(await a.read()).toEqual([9]);
    expect(await b.read()).toEqual([]);
  });
});

describe('DebouncedSaver orchestration', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  const snap = () => ({}) as any;

  it('flushes on app background/inactive but not on active, and unsubscribes', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const saver = new DebouncedSaver({ save }, 500);
    let cb: (s: string) => void = () => {};
    const remove = jest.fn();
    const unbind = bindAppStateFlush(saver, {
      addEventListener: (_t, f) => ((cb = f), { remove }),
    });
    saver.schedule('s', snap);
    cb('active');
    expect(save).not.toHaveBeenCalled();
    cb('background');
    expect(save).toHaveBeenCalledTimes(1);
    unbind();
    expect(remove).toHaveBeenCalled();
  });

  it('flushes the old session when the session changes', () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const saver = new DebouncedSaver({ save }, 500);
    saver.schedule('a', snap);
    saver.schedule('b', snap);
    expect(save).toHaveBeenCalledWith('a', expect.anything());
    jest.advanceTimersByTime(500);
    expect(save).toHaveBeenCalledWith('b', expect.anything());
  });

  it('keeps the pending save and retries after a failed save', async () => {
    const save = jest.fn().mockRejectedValueOnce(new Error('disk')).mockResolvedValue(undefined);
    const saver = new DebouncedSaver({ save }, 100);
    saver.schedule('s', snap);
    await saver.flush();
    expect(save).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(500);
    expect(save).toHaveBeenCalledTimes(2);
  });
});

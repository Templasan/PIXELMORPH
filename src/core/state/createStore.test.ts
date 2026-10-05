import { createSelection, createStore, shallowEqual } from './createStore';

// Store get/set/subscribe semantics are covered through the time store in
// tests/integration/time-store.test.ts, which is built on createStore.

describe('createSelection', () => {
  const store = createStore({ a: 1, b: { x: 1 }, list: [1, 2] });

  it('keeps the same reference while the selected slice is equal', () => {
    const select = createSelection(store);
    const pick = (s: { a: number; list: number[] }) => ({ a: s.a, n: s.list.length });
    const first = select(pick, shallowEqual);
    store.set((s) => ({ ...s, b: { x: 2 } })); // unrelated field
    expect(select(pick, shallowEqual)).toBe(first);
    store.set((s) => ({ ...s, a: 2 }));
    const next = select(pick, shallowEqual);
    expect(next).not.toBe(first);
    expect(next).toEqual({ a: 2, n: 2 });
  });

  it('is stable across calls with an unchanged state (no useSyncExternalStore loop)', () => {
    const select = createSelection(store);
    const pick = (s: { list: number[] }) => s.list.map((v) => v * 2);
    expect(select(pick, shallowEqual)).toBe(select(pick, shallowEqual));
  });

  it('recomputes when the selector itself changes (e.g. it closes over a prop)', () => {
    const select = createSelection(store);
    expect(select((s) => s.a, Object.is)).toBe(store.get().a);
    expect(select((s) => s.b.x, Object.is)).toBe(store.get().b.x);
  });
});

describe('shallowEqual', () => {
  it('compares one level deep', () => {
    expect(shallowEqual({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toBe(true);
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(shallowEqual({ a: {} }, { a: {} })).toBe(false);
    expect(shallowEqual([1, 2], [1, 2])).toBe(true);
    expect(shallowEqual(null, null)).toBe(true);
    expect(shallowEqual(null, {})).toBe(false);
  });
});

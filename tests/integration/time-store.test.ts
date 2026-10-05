import { createTimeStore } from '../../src/app/screens/video-editor/timeStore';

describe('timeStore', () => {
  it('get/set and updater form', () => {
    const s = createTimeStore(5);
    expect(s.get()).toBe(5);
    s.set(10);
    s.set((p) => p + 2);
    expect(s.get()).toBe(12);
  });

  it('notifies only on change', () => {
    const s = createTimeStore(0);
    const cb = jest.fn();
    s.subscribe(cb);
    s.set(0);
    s.set((p) => p);
    expect(cb).not.toHaveBeenCalled();
    s.set(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops notifications, other subscribers keep working', () => {
    const s = createTimeStore();
    const a = jest.fn();
    const b = jest.fn();
    const off = s.subscribe(a);
    s.subscribe(b);
    off();
    off();
    s.set(3);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('subscribers see the new value when notified', () => {
    const s = createTimeStore();
    let seen = -1;
    s.subscribe(() => (seen = s.get()));
    s.set(7);
    expect(seen).toBe(7);
  });
});

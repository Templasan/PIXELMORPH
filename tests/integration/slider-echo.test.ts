import { createEchoTracker, snapValue, toPct } from '../../src/core/ui/sliderEcho';

describe('sliderEcho', () => {
  it('late echo of intermediate value does not regress the thumb', () => {
    const t = createEchoTracker(0);
    t.begin();
    t.emit(10); t.emit(20); t.emit(30);
    expect(t.onPropValue(10).apply).toBe(false);
    expect(t.onPropValue(20).apply).toBe(false);
    expect(t.latest).toBe(30);
    expect(t.onPropValue(30).apply).toBe(false);
    expect(t.pending).toBe(0); // cleared when last emitted echoes
  });

  it('external value (reset/undo/preset) is applied', () => {
    const t = createEchoTracker(0);
    expect(t.onPropValue(50)).toEqual({ apply: true });
    expect(t.latest).toBe(50);
  });

  it('next gesture clears the set; from is the latest before the gesture', () => {
    const t = createEchoTracker(5);
    t.begin(); t.emit(10); t.emit(20);
    expect(t.complete()).toEqual({ value: 20, from: 5 });
    t.begin();
    expect(t.pending).toBe(0);
    t.emit(7); t.emit(20); // drag returns to...
    expect(t.complete()).toEqual({ value: 20, from: 20 });
  });

  it('drag that returns to the initial value delivers correct from', () => {
    const t = createEchoTracker(5);
    t.begin(); t.emit(15); t.emit(5);
    expect(t.complete()).toEqual({ value: 5, from: 5 });
  });

  it('parent never echoes: undo to an intermediate value after the gesture applies', () => {
    const t = createEchoTracker(0);
    t.begin(); t.emit(10); t.emit(20); t.complete();
    expect(t.onPropValue(10).apply).toBe(true);
    expect(t.latest).toBe(10);
  });

  it('parent coercing the value: coerced value applies', () => {
    const t = createEchoTracker(0);
    t.begin(); t.emit(5);
    expect(t.onPropValue(4).apply).toBe(true);
    expect(t.latest).toBe(4);
  });

  it('snap/clamp/pct', () => {
    expect(snapValue(50, 100, 0, 10, 1)).toBe(5);
    expect(snapValue(-20, 100, 0, 10, 1)).toBe(0);
    expect(snapValue(500, 100, 0, 10, 2)).toBe(10);
    expect(toPct(5, 0, 10)).toBe(50);
    expect(toPct(1, 3, 3)).toBe(0);
  });
});

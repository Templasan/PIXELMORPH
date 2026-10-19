import { createEchoTracker, ECHO_WINDOW_MS, snapValue, toPct } from '../../src/core/ui/sliderEcho';

describe('sliderEcho', () => {
  it('late echo of intermediate value does not regress the thumb', () => {
    const t = createEchoTracker(0);
    t.begin();
    t.emit(10);
    t.emit(20);
    t.emit(30);
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
    t.begin();
    t.emit(10);
    t.emit(20);
    expect(t.complete()).toEqual({ value: 20, from: 5 });
    t.begin();
    expect(t.pending).toBe(0);
    t.emit(7);
    t.emit(20); // drag returns to...
    expect(t.complete()).toEqual({ value: 20, from: 20 });
  });

  it('drag that returns to the initial value delivers correct from', () => {
    const t = createEchoTracker(5);
    t.begin();
    t.emit(15);
    t.emit(5);
    expect(t.complete()).toEqual({ value: 5, from: 5 });
  });

  it('late echo of an intermediate value AFTER release does not roll the thumb back', () => {
    let clock = 0;
    const t = createEchoTracker(10, () => clock);
    t.begin();
    t.emit(13);
    t.emit(16);
    t.complete();
    clock = 200; // a busy JS thread renders the old intermediate value after the release
    expect(t.onPropValue(13).apply).toBe(false);
    expect(t.onPropValue(16).apply).toBe(false);
    expect(t.latest).toBe(16);
    expect(t.pending).toBe(0);
  });

  it('an echo drops the values emitted before it (they can no longer arrive)', () => {
    const t = createEchoTracker(0);
    t.begin();
    t.emit(1);
    t.emit(2);
    t.emit(3);
    expect(t.onPropValue(2).apply).toBe(false);
    expect(t.pending).toBe(1);
    expect(t.onPropValue(1).apply).toBe(true); // older than an echo seen: a real change
  });

  it('parent never echoes: undo to an intermediate value after the window applies', () => {
    let clock = 0;
    const t = createEchoTracker(0, () => clock);
    t.begin();
    t.emit(10);
    t.emit(20);
    t.complete();
    clock = ECHO_WINDOW_MS + 1;
    expect(t.onPropValue(10).apply).toBe(true);
    expect(t.latest).toBe(10);
  });

  it('undo to the value before the gesture applies right away', () => {
    const t = createEchoTracker(5);
    t.begin();
    t.emit(10);
    t.emit(20);
    t.complete();
    expect(t.onPropValue(20).apply).toBe(false);
    expect(t.onPropValue(5).apply).toBe(true);
  });

  it('parent coercing the value: coerced value applies', () => {
    const t = createEchoTracker(0);
    t.begin();
    t.emit(5);
    expect(t.onPropValue(4).apply).toBe(true);
    expect(t.latest).toBe(4);
  });

  it('snap/clamp/pct', () => {
    expect(snapValue(50, 100, 0, 10, 1)).toBe(5);
    expect(snapValue(-20, 100, 0, 10, 1)).toBe(0);
    expect(snapValue(500, 100, 0, 10, 2)).toBe(10);
    expect(snapValue(85, 100, 0, 1, 0.05)).toBe(0.85);
    expect(toPct(5, 0, 10)).toBe(50);
    expect(toPct(1, 3, 3)).toBe(0);
  });
});

import { frameBytesOf, nearestIndex, scrubBudget, scrubTimes } from '../src/domain/scrubPlan';

describe('scrubTimes', () => {
  it('keeps one frame a second while the budget allows', () => {
    expect(scrubTimes(4, 100, 10000)).toEqual([0, 1, 2, 3]);
  });

  it('spreads out over a long file and never passes the budget', () => {
    const budget = 1000;
    const times = scrubTimes(1000, 100, budget);
    expect(times.length).toBeLessThanOrEqual(budget / 100);
    expect(times[1] - times[0]).toBe(100);
    expect(times.at(-1)).toBeLessThan(1000);
  });

  it('asks for nothing when there is nothing to show', () => {
    expect(scrubTimes(0, 100, 1000)).toEqual([]);
    expect(scrubTimes(10, 0, 1000)).toEqual([]);
  });

  it('keeps at least one frame on a tight budget', () => {
    expect(scrubTimes(10, 5000, 1000)).toEqual([0]);
  });
});

describe('nearestIndex', () => {
  const times = [0, 1, 2, 5];
  it('finds the nearest moment on either side', () => {
    expect(nearestIndex(times, 0.4)).toBe(0);
    expect(nearestIndex(times, 0.6)).toBe(1);
    expect(nearestIndex(times, 3.9)).toBe(3);
  });
  it('holds at the ends and copes with no frames', () => {
    expect(nearestIndex(times, -3)).toBe(0);
    expect(nearestIndex(times, 99)).toBe(3);
    expect(nearestIndex([], 1)).toBe(-1);
    expect(nearestIndex([7], 1)).toBe(0);
  });
});

describe('scrubBudget', () => {
  it('asks less of a low-end phone', () => {
    expect(scrubBudget(true).bytes).toBeLessThan(scrubBudget(false).bytes);
    expect(scrubBudget(true).shortEdge).toBeLessThan(scrubBudget(false).shortEdge);
  });
  it('fits about three minutes in the low-end budget', () => {
    const { bytes, shortEdge } = scrubBudget(true);
    const frame = frameBytesOf(shortEdge, (shortEdge * 16) / 9);
    expect(scrubTimes(180, frame, bytes)).toHaveLength(180);
  });
});

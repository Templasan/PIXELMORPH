import {
  formatElapsed,
  nextFlash,
  nextOnion,
  nextStopFps,
  nextTimer,
  nextTorch,
  timerLabel,
} from '../../src/app/screens/camera/cameraFormat';

describe('camera control cycles', () => {
  it('cycles photo flash OFF → AUTO → ON', () => {
    expect(nextFlash('off')).toBe('auto');
    expect(nextFlash('auto')).toBe('on');
    expect(nextFlash('on')).toBe('off');
  });

  it('toggles the torch between ON and OFF only', () => {
    expect(nextTorch('off')).toBe('on');
    expect(nextTorch('on')).toBe('off');
    expect(nextTorch('auto')).toBe('on');
  });

  it('cycles the timer OFF → 3 s → 10 s, and starts over from an unknown value', () => {
    expect(nextTimer(0)).toBe(3);
    expect(nextTimer(3)).toBe(10);
    expect(nextTimer(10)).toBe(0);
    expect(nextTimer(7)).toBe(0);
    expect(timerLabel(0)).toBe('OFF');
    expect(timerLabel(3)).toBe('3 s');
  });

  it('cycles stop-motion fps 4 → 6 → 8 → 12 → 4', () => {
    expect(nextStopFps(4)).toBe(6);
    expect(nextStopFps(6)).toBe(8);
    expect(nextStopFps(8)).toBe(12);
    expect(nextStopFps(12)).toBe(4);
  });

  it('cycles the onion skin 0 → 25 → 40 → 60 → 0', () => {
    expect(nextOnion(0)).toBe(25);
    expect(nextOnion(25)).toBe(40);
    expect(nextOnion(40)).toBe(60);
    expect(nextOnion(60)).toBe(0);
  });
});

describe('formatElapsed', () => {
  it('formats the recording clock as mm:ss', () => {
    expect(formatElapsed(0)).toBe('00:00');
    expect(formatElapsed(5)).toBe('00:05');
    expect(formatElapsed(65)).toBe('01:05');
    expect(formatElapsed(3599)).toBe('59:59');
  });

  it('floors fractions and never goes negative', () => {
    expect(formatElapsed(1.9)).toBe('00:01');
    expect(formatElapsed(-3)).toBe('00:00');
  });
});

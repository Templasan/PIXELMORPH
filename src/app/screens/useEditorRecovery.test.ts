jest.mock('react-native', () => ({ Alert: { alert: jest.fn() } }));
jest.mock('@core/i18n', () => ({ t: (s: string) => s }));

import { shouldGiveUp } from './useEditorRecovery';

describe('shouldGiveUp', () => {
  it('tries again after the first loss, and after a long time', () => {
    expect(shouldGiveUp(null, 1000)).toBe(false);
    expect(shouldGiveUp(1000, 1000 + 31_000)).toBe(false);
  });
  it('gives up when it dies again soon, so it cannot loop', () => {
    expect(shouldGiveUp(1000, 1000 + 5000)).toBe(true);
  });
});

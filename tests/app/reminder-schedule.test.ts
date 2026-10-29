import { reminderTimes } from '../../src/app/screens/projects/reminderSchedule';

describe('reminderTimes', () => {
  const now = new Date(2026, 9, 28, 12, 0);

  it('rings at 9:00 on the due day', () => {
    const t = reminderTimes(new Date(2026, 9, 30, 18, 0), 'medium', now);
    expect(t.map((d) => d.toString())).toEqual([new Date(2026, 9, 30, 9, 0).toString()]);
  });

  it('high priority also rings the day before', () => {
    const t = reminderTimes(new Date(2026, 9, 30), 'high', now);
    expect(t.map((d) => d.getDate())).toEqual([29, 30]);
  });

  it('drops times already past', () => {
    expect(reminderTimes(new Date(2026, 9, 28), 'medium', now)).toEqual([]);
    expect(reminderTimes(new Date(2026, 9, 29), 'high', now).map((d) => d.getDate())).toEqual([29]);
  });
});

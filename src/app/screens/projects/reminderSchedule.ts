import type { ProjectPriority } from '@modules/projects';

/** Reminders ring at this hour (local time). */
const REMINDER_HOUR = 9;

/**
 * RF-070: when a project's reminder rings — 9:00 on its due day, and for high priority also 9:00
 * the day before. Times already past are dropped (a project saved late on its due day gets none).
 */
export function reminderTimes(
  dueDate: Date,
  priority: ProjectPriority | null | undefined,
  now: Date
): Date[] {
  const onDay = new Date(dueDate);
  onDay.setHours(REMINDER_HOUR, 0, 0, 0);
  const times = [onDay];
  if (priority === 'high') {
    const dayBefore = new Date(onDay);
    dayBefore.setDate(dayBefore.getDate() - 1);
    times.unshift(dayBefore);
  }
  return times.filter((t) => t.getTime() > now.getTime());
}

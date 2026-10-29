// RF-070: the project reminders as local notifications (expo-notifications). Kept apart from
// reminderSchedule.ts so the timing stays testable without the native module.
import * as Notifications from 'expo-notifications';
import type { Project } from '@modules/projects';
import { errorLogger } from '@core/reliability';
import { reminderTimes } from './reminderSchedule';

const idOf = (projectId: string, i: number) => `reminder-${projectId}-${i}`;

/** Removes whatever was scheduled for the project (both possible reminders). */
export async function cancelProjectReminders(projectId: string): Promise<void> {
  await Promise.all(
    [0, 1].map((i) =>
      Notifications.cancelScheduledNotificationAsync(idOf(projectId, i)).catch(() => {})
    )
  );
}

/**
 * Schedules the project's reminders from its due date and priority, replacing earlier ones.
 * Asks for the notification permission the first time; without it nothing is scheduled.
 */
export async function scheduleProjectReminders(project: Project): Promise<void> {
  await cancelProjectReminders(project.id);
  if (!project.dueDate) return;
  const times = reminderTimes(project.dueDate, project.priority, new Date());
  if (times.length === 0) return;
  try {
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return;
    await Promise.all(
      times.map((date, i) =>
        Notifications.scheduleNotificationAsync({
          identifier: idOf(project.id, i),
          content: {
            title: 'Projeto pendente',
            body:
              i === times.length - 1
                ? `"${project.name}" vence hoje.`
                : `"${project.name}" vence amanhã.`,
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
        })
      )
    );
  } catch (error) {
    errorLogger.log(error, 'projectReminders.schedule');
  }
}

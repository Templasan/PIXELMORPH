import * as FileSystem from 'expo-file-system/legacy';
import { MEDIA_DIR_NAME } from '@core/reliability/storageUsage';

/** Whether the timeline the video editor saved for this project holds any clip. */
export async function timelineHasClips(projectId: string): Promise<boolean> {
  try {
    const file = `${FileSystem.documentDirectory}${MEDIA_DIR_NAME}/${projectId}/timeline.json`;
    if (!(await FileSystem.getInfoAsync(file)).exists) return false;
    const saved = JSON.parse(await FileSystem.readAsStringAsync(file)) as {
      tracks?: { clips?: unknown[] }[];
    };
    return (saved.tracks ?? []).some((track) => (track.clips?.length ?? 0) > 0);
  } catch {
    // Unreadable is not proof of empty: keep the project rather than lose someone's work.
    return true;
  }
}

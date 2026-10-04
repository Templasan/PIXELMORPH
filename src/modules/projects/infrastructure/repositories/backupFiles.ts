import * as FileSystem from 'expo-file-system/legacy';
import { BACKUPS_DIR_NAME } from '@core/reliability/storageUsage';

/**
 * RNF-006: second copy of each project's backup, as a plain file in the app's private
 * document folder. Lives outside AsyncStorage so a damaged AsyncStorage database can't take
 * the live project and its backup down together.
 */
function backupPath(id: string): string {
  return `${FileSystem.documentDirectory}${BACKUPS_DIR_NAME}/${id}.json`;
}

export async function writeBackupFile(id: string, json: string): Promise<void> {
  await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}${BACKUPS_DIR_NAME}`, {
    intermediates: true,
  });
  await FileSystem.writeAsStringAsync(backupPath(id), json);
}

export async function readBackupFile(id: string): Promise<string | null> {
  const info = await FileSystem.getInfoAsync(backupPath(id));
  return info.exists ? FileSystem.readAsStringAsync(backupPath(id)) : null;
}

export async function deleteBackupFile(id: string): Promise<void> {
  await FileSystem.deleteAsync(backupPath(id), { idempotent: true });
}

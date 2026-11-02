import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { historyPartKeys } from '@core/history/LocalHistoryRepository';
import { MEDIA_DIR_NAME } from '@core/reliability/storageUsage';
import { fnv1a } from '../../domain/sync/syncPlan';
import type {
  FileInfo,
  LocalProjectData,
  SyncState,
} from '../../application/usecases/SyncProjectsUseCase';

/** Same key as LocalProjectRepository's project list: a JSON array of project ids. */
const PROJECT_LIST_KEY = 'projectList';
const stateKey = (userId: string) => `sync:${userId}`;

async function readList(): Promise<string[]> {
  const json = await AsyncStorage.getItem(PROJECT_LIST_KEY);
  if (!json) return [];
  const list: unknown = JSON.parse(json);
  return Array.isArray(list) ? (list as string[]) : [];
}

/** This phone's AsyncStorage and file system, as the sync use case sees them. */
export class LocalProjectStorage implements LocalProjectData {
  async listIds(): Promise<string[]> {
    const ids = await readList();
    if (!ids.length) return [];
    const pairs = await AsyncStorage.multiGet(ids.map((id) => `project:${id}`));
    return ids.filter((_, i) => pairs[i][1] != null);
  }

  async readBlobs(projectId: string): Promise<Record<string, string>> {
    const keys = [
      `project:${projectId}`,
      `layers:${projectId}`,
      `editorImages:${projectId}`,
      `history:${projectId}`,
      ...(await historyPartKeys(projectId)),
    ];
    const blobs: Record<string, string> = {};
    for (const [key, value] of await AsyncStorage.multiGet(keys)) {
      if (value != null) blobs[key] = value;
    }
    return blobs;
  }

  async writeBlobs(projectId: string, blobs: Record<string, string>, isNew: boolean) {
    // Keys the new data no longer has (a shorter history, say) must not survive the write.
    const stale = Object.keys(await this.readBlobs(projectId)).filter((key) => !(key in blobs));
    if (stale.length) await AsyncStorage.multiRemove(stale);
    await AsyncStorage.multiSet(Object.entries(blobs));
    if (!isNew) return;
    const list = await readList();
    if (!list.includes(projectId)) {
      list.push(projectId);
      await AsyncStorage.setItem(PROJECT_LIST_KEY, JSON.stringify(list));
    }
  }

  async fileInfo(uri: string): Promise<FileInfo | null> {
    const info = await FileSystem.getInfoAsync(uri).catch(() => null);
    if (!info?.exists) return null;
    return { exists: true, size: info.size, modificationTime: info.modificationTime };
  }

  // shortcut: downloaded media is not removed when its project is deleted here; add a sweep when storage matters
  targetUri(projectId: string, key: string): string {
    return `${FileSystem.documentDirectory ?? ''}${MEDIA_DIR_NAME}/cloud/${fnv1a(projectId)}/${key}`;
  }

  async move(from: string, to: string): Promise<void> {
    await FileSystem.makeDirectoryAsync(to.slice(0, to.lastIndexOf('/')), { intermediates: true });
    await FileSystem.deleteAsync(to, { idempotent: true });
    await FileSystem.moveAsync({ from, to });
  }

  async remove(uri: string): Promise<void> {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }

  async loadState(userId: string): Promise<SyncState> {
    const json = await AsyncStorage.getItem(stateKey(userId));
    const empty: SyncState = { last: {}, uploaded: {}, fileKeys: {} };
    if (!json) return empty;
    try {
      // Older saved state has no fileKeys: missing maps load as empty.
      const state = JSON.parse(json) as Partial<SyncState>;
      return {
        last: state.last ?? {},
        uploaded: state.uploaded ?? {},
        fileKeys: state.fileKeys ?? {},
      };
    } catch {
      // A damaged state only costs conflicts on the next run; it cannot delete or overwrite anything.
      return empty;
    }
  }

  async saveState(userId: string, state: SyncState): Promise<void> {
    await AsyncStorage.setItem(stateKey(userId), JSON.stringify(state));
  }
}

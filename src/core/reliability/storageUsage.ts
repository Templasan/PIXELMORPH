import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { byteLength, errorLogger } from './ErrorLogger';

/** Folder (inside the app's private document directory) that holds the file-based project backups. */
export const BACKUPS_DIR_NAME = 'backups';

// Not re-exported from ./index: it pulls in expo-file-system, which Jest can't load.

export interface StorageUsage {
  projectsBytes: number;
  historyBytes: number;
  backupsBytes: number;
  logBytes: number;
  cacheBytes: number;
  usedBytes: number;
  totalDiskBytes: number;
  freeDiskBytes: number;
}

async function bytesOfKeysWithPrefix(prefix: string): Promise<number> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(prefix));
  const pairs = await AsyncStorage.multiGet(keys);
  return pairs.reduce((sum, [, value]) => sum + (value ? byteLength(value) : 0), 0);
}

async function directoryBytes(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri).catch(() => null);
  if (!info || !info.exists) return 0;
  if (!info.isDirectory) return info.size;
  const names = await FileSystem.readDirectoryAsync(uri).catch(() => [] as string[]);
  const sizes = await Promise.all(
    names.map((name) => directoryBytes(`${uri.replace(/\/$/, '')}/${name}`))
  );
  return sizes.reduce((a, b) => a + b, 0);
}

/** RNF-006/RNF-017 diagnostics: what the app actually stores, measured rather than assumed. */
export async function getStorageUsage(): Promise<StorageUsage> {
  const [
    projectsBytes,
    historyBytes,
    backupKeysBytes,
    backupFilesBytes,
    logBytes,
    cacheBytes,
    totalDisk,
    freeDisk,
  ] = await Promise.all([
    Promise.all([bytesOfKeysWithPrefix('project:'), bytesOfKeysWithPrefix('layers:')]).then(
      ([a, b]) => a + b
    ),
    bytesOfKeysWithPrefix('history:'),
    bytesOfKeysWithPrefix('projectBackup:'),
    FileSystem.documentDirectory
      ? directoryBytes(`${FileSystem.documentDirectory}${BACKUPS_DIR_NAME}`)
      : Promise.resolve(0),
    errorLogger.getSizeBytes(),
    FileSystem.cacheDirectory ? directoryBytes(FileSystem.cacheDirectory) : Promise.resolve(0),
    FileSystem.getTotalDiskCapacityAsync().catch(() => 0),
    FileSystem.getFreeDiskStorageAsync().catch(() => 0),
  ]);
  const backupsBytes = backupKeysBytes + backupFilesBytes;
  return {
    projectsBytes,
    historyBytes,
    backupsBytes,
    logBytes,
    cacheBytes,
    usedBytes: projectsBytes + historyBytes + backupsBytes + logBytes + cacheBytes,
    totalDiskBytes: totalDisk,
    freeDiskBytes: freeDisk,
  };
}

/** Deletes everything in the app's cache directory (preview renders, picked/cached images). */
export async function clearCache(): Promise<void> {
  const dir = FileSystem.cacheDirectory;
  if (!dir) return;
  const names = await FileSystem.readDirectoryAsync(dir).catch(() => [] as string[]);
  await Promise.all(
    names.map((name) =>
      FileSystem.deleteAsync(`${dir}${name}`, { idempotent: true }).catch(() => undefined)
    )
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

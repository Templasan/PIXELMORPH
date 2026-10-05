import * as FileSystem from 'expo-file-system/legacy';
import { MEDIA_DIR_NAME } from '@core/reliability/storageUsage';
import type { MediaFileStore } from '../ports/MediaFileStore';

/** Project media under the app's private documents folder: `media/<projectId>/<file>`. */
export class FileSystemMediaFileStore implements MediaFileStore {
  private root = `${FileSystem.documentDirectory}${MEDIA_DIR_NAME}/`;

  isPersisted(uri: string): boolean {
    return uri.startsWith(this.root);
  }

  async exists(uri: string): Promise<boolean> {
    const info = await FileSystem.getInfoAsync(uri).catch(() => null);
    return !!info?.exists;
  }

  async persist(uri: string, projectId: string): Promise<string> {
    if (this.isPersisted(uri)) return uri;
    const dir = `${this.root}${projectId}/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const extension = uri.split('?')[0].match(/\.(\w{2,5})$/)?.[1] ?? 'bin';
    const destination = `${dir}${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`;
    // Copy, not move: callers may still show the source (e.g. the camera's last-capture thumb).
    await FileSystem.copyAsync({ from: uri, to: destination });
    return destination;
  }

  async removeProjectFiles(projectId: string): Promise<void> {
    await FileSystem.deleteAsync(`${this.root}${projectId}/`, { idempotent: true });
  }
}

import type { MediaFileStore } from '../ports/MediaFileStore';

/** Web design preview only (docs/web-preview.md): sample media stays where it is. */
export class FileSystemMediaFileStore implements MediaFileStore {
  async persist(uri: string): Promise<string> {
    return uri;
  }

  isPersisted(): boolean {
    return true;
  }

  async exists(): Promise<boolean> {
    return true;
  }

  async removeProjectFiles(): Promise<void> {}
}

/**
 * Port: where a project's media files live. Capture/import hands the app URIs in the cache
 * (camera, image picker, rendered collages), which Android and "Limpar cache" may delete at any
 * time; a project must only ever reference files from this store.
 */
export interface MediaFileStore {
  /** Returns a permanent URI for `uri` owned by `projectId` (copying it if needed). */
  persist(uri: string, projectId: string): Promise<string>;
  /** True when `uri` already points inside the permanent store. */
  isPersisted(uri: string): boolean;
  /** Whether the file behind `uri` still exists. */
  exists(uri: string): Promise<boolean>;
  /** Deletes every file owned by `projectId`. */
  removeProjectFiles(projectId: string): Promise<void>;
}

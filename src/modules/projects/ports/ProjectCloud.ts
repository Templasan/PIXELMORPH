import type { ProjectPayload } from '../domain/sync/syncPlan';

/**
 * offline: could not connect, or the service answered 503.
 * unauthorized: no session, or the service answered 401.
 * forbidden: signed in, but the account may not use the service (403). Signing in again does not help.
 * notFound: the row or file does not exist (404).
 * failed: anything else, such as a rejected row.
 */
export type CloudErrorKind = 'offline' | 'unauthorized' | 'forbidden' | 'notFound' | 'failed';

export class CloudError extends Error {
  constructor(
    readonly kind: CloudErrorKind,
    message?: string
  ) {
    super(message ?? kind);
    this.name = 'CloudError';
  }
}

export interface CloudProjectRow {
  id: string;
  name: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CloudFile {
  key: string;
  uri: string;
  size: number;
}

export interface CloudProject extends CloudProjectRow {
  payload: ProjectPayload;
  files: CloudFile[];
}

export interface CloudProjectUpsert {
  id: string;
  name: string;
  payload: ProjectPayload;
  files: CloudFile[];
  updatedAt: string;
}

/** The synced project list. Rows are per user; the user id is never passed in by the app. */
export interface CloudProjectStore {
  /** Rows without payload, for planning. */
  list(): Promise<CloudProjectRow[]>;
  get(id: string): Promise<CloudProject>;
  upsert(row: CloudProjectUpsert): Promise<void>;
  markDeleted(id: string, at: string): Promise<void>;
}

/** The media files of synced projects. `key` identifies a file within its project. */
export interface CloudFileStore {
  upload(projectId: string, key: string, localUri: string): Promise<void>;
  download(projectId: string, key: string, toUri: string): Promise<void>;
}

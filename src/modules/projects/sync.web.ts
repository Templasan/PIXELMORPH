import { previewState } from '@/web-preview/state';
import type { SyncProjectsUseCase, SyncReport } from './application/usecases/SyncProjectsUseCase';

const EMPTY: SyncReport = {
  uploaded: 0,
  downloaded: 0,
  tombstoned: 0,
  removedElsewhere: 0,
  conflicts: [],
  failed: 0,
  pendingUploads: 0,
  pendingDownloads: 0,
  missingFiles: 0,
  missingProjects: [],
  filesUploaded: 0,
  filesDownloaded: 0,
  serverOffline: false,
  serverForbidden: false,
};

/** Web design preview only (docs/web-preview.md): canned results picked in the side panel. */
export function createProjectSync(): SyncProjectsUseCase {
  const fake = {
    async prepare() {
      const conflict = previewState.get().syncResult === 'conflict';
      return {
        plan: {
          upload: [],
          download: [],
          tombstone: [],
          forget: [],
          conflicts: [],
          removedElsewhere: [],
        },
        firstTimeUploadCount: 0,
        conflicts: conflict ? [{ id: 'preview-photo-1', name: 'Praia' }] : [],
        removedAt: {},
      };
    },
    async run(): Promise<SyncReport> {
      switch (previewState.get().syncResult) {
        case 'sent':
          return { ...EMPTY, uploaded: 3, downloaded: 1, filesUploaded: 5, filesDownloaded: 2 };
        case 'offline':
          return { ...EMPTY, uploaded: 1, pendingUploads: 4, serverOffline: true };
        default:
          return EMPTY;
      }
    },
    async resolveConflict() {
      return { ...EMPTY, uploaded: 1 };
    },
  };
  return fake as unknown as SyncProjectsUseCase;
}

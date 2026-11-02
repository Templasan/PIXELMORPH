import { SyncProjectsUseCase } from './application/usecases/SyncProjectsUseCase';
import { SupabaseProjectCloud } from './infrastructure/sync/SupabaseProjectCloud';
import { MediaServerFiles } from './infrastructure/sync/MediaServerFiles';
import { LocalProjectStorage } from './infrastructure/sync/LocalProjectData';

/**
 * Cloud sync (stage 2). Kept out of index.ts so Jest suites that import the projects module do
 * not load the Supabase client.
 */
export function createProjectSync(): SyncProjectsUseCase {
  return new SyncProjectsUseCase(
    new SupabaseProjectCloud(),
    new MediaServerFiles(),
    new LocalProjectStorage()
  );
}

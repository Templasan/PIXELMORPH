import { supabase } from '@core/infrastructure/supabase';
import type { ProjectPayload } from '../../domain/sync/syncPlan';
import {
  CloudError,
  type CloudErrorKind,
  type CloudFile,
  type CloudProject,
  type CloudProjectRow,
  type CloudProjectStore,
  type CloudProjectUpsert,
} from '../../ports/ProjectCloud';

const TABLE = 'project_sync';

/** Columns as the table stores them (snake_case). */
interface ListRow {
  project_id: string;
  name: string;
  updated_at: string;
  deleted_at: string | null;
}

interface FullRow extends ListRow {
  payload: ProjectPayload;
  files: CloudFile[];
}

interface QueryResult<T> {
  data: T | null;
  error: { message: string } | null;
  status: number;
}

/** A failed query with no status never got an answer from the server. */
function kindOfStatus(status: number | undefined): CloudErrorKind {
  if (!status || status === 503) return 'offline';
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 404) return 'notFound';
  return 'failed';
}

async function call<T>(query: PromiseLike<QueryResult<T>>): Promise<T | null> {
  const result = await query.then(
    (r) => r,
    () => {
      throw new CloudError('offline');
    }
  );
  if (result.error) throw new CloudError(kindOfStatus(result.status), result.error.message);
  return result.data;
}

/**
 * The synced project list in Supabase (table project_sync). Row level security keeps each user to
 * their own rows; the user id is filled in by the database, never sent by the app.
 */
export class SupabaseProjectCloud implements CloudProjectStore {
  async list(): Promise<CloudProjectRow[]> {
    const rows = await call<ListRow[]>(
      supabase.from(TABLE).select('project_id,name,updated_at,deleted_at')
    );
    return (rows ?? []).map((r) => ({
      id: r.project_id,
      name: r.name,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at,
    }));
  }

  async get(id: string): Promise<CloudProject> {
    const row = await call<FullRow>(
      supabase
        .from(TABLE)
        .select('project_id,name,payload,files,updated_at,deleted_at')
        .eq('project_id', id)
        .maybeSingle()
    );
    if (!row) throw new CloudError('notFound');
    return {
      id: row.project_id,
      name: row.name,
      payload: row.payload,
      files: row.files,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  }

  async upsert(row: CloudProjectUpsert): Promise<void> {
    await call<null>(
      supabase.from(TABLE).upsert({
        project_id: row.id,
        name: row.name,
        payload: row.payload,
        files: row.files,
        updated_at: row.updatedAt,
        deleted_at: null,
      })
    );
  }

  async markDeleted(id: string, at: string): Promise<void> {
    // updated_at moves too, so other devices see the change in their next plan.
    await call<null>(
      supabase.from(TABLE).update({ deleted_at: at, updated_at: at }).eq('project_id', id)
    );
  }
}

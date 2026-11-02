import * as FileSystem from 'expo-file-system/legacy';
import { CONFIG } from '@core/infrastructure/config';
import { supabase } from '@core/infrastructure/supabase';
import { CloudError, type CloudErrorKind, type CloudFileStore } from '../../ports/ProjectCloud';

function fileUrl(projectId: string, key: string): string {
  return `${CONFIG.mediaServerUrl}/files/${encodeURIComponent(projectId)}/${encodeURIComponent(key)}`;
}

/** A fresh token on every call: the media server checks it with Supabase each time. */
async function authorization(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new CloudError('unauthorized');
  return { Authorization: `Bearer ${token}` };
}

// 507 (quota) and anything else is 'failed': that one file is refused, the rest are still tried.
function kindOfStatus(status: number): CloudErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'notFound';
  if (status === 503) return 'offline';
  return 'failed';
}

/** The owner's media server (media-server/). A request that never answers means the PC is off. */
export class MediaServerFiles implements CloudFileStore {
  async upload(projectId: string, key: string, localUri: string): Promise<void> {
    const headers = await authorization();
    const res = await FileSystem.uploadAsync(fileUrl(projectId, key), localUri, {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers,
    }).catch(() => {
      throw new CloudError('offline');
    });
    if (res.status < 200 || res.status > 299) {
      throw new CloudError(kindOfStatus(res.status), `HTTP ${res.status}`);
    }
  }

  async download(projectId: string, key: string, toUri: string): Promise<void> {
    const headers = await authorization();
    await FileSystem.makeDirectoryAsync(toUri.slice(0, toUri.lastIndexOf('/')), {
      intermediates: true,
    });
    const res = await FileSystem.downloadAsync(fileUrl(projectId, key), toUri, { headers }).catch(
      () => {
        throw new CloudError('offline');
      }
    );
    if (res.status !== 200) {
      await FileSystem.deleteAsync(toUri, { idempotent: true });
      throw new CloudError(kindOfStatus(res.status), `HTTP ${res.status}`);
    }
  }
}

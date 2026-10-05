import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MediaFileStore } from '../ports/MediaFileStore';

/**
 * Per-project values that can hold media URIs: the project itself, its undo history (the video
 * timeline lives there, clip URIs included), photo layers and effect images. All keyed by
 * project id.
 */
const PROJECT_KEYS = /^(project|history|layers|editorImages):(.+)$/;

/** Distinct URIs in `text` that start with `prefix` (a URI ends at a quote, backslash or space). */
export function findUris(text: string, prefix: string): string[] {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...new Set(text.match(new RegExp(`${escaped}[^"\\\\\\s]+`, 'g')) ?? [])];
}

/**
 * One-time repair for data saved before media was persisted: every cache URI still referenced by
 * a project's stored values is copied into the project's permanent media folder (when the file
 * still exists) and rewritten in place. Files the system already purged cannot be recovered and
 * are left as they are. Idempotent. Returns how many references were rewritten.
 */
export async function repairCacheMedia(
  files: Pick<MediaFileStore, 'persist' | 'exists'>,
  cachePrefix: string
): Promise<number> {
  if (!cachePrefix) return 0;
  let rewritten = 0;
  // The same file is often referenced from several keys of one project: copy it once.
  const copies = new Map<string, string>();
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => PROJECT_KEYS.test(k));
  for (const key of keys) {
    const projectId = key.match(PROJECT_KEYS)![2];
    const json = await AsyncStorage.getItem(key);
    if (!json) continue;
    let next = json;
    for (const uri of findUris(json, cachePrefix)) {
      const id = `${projectId}
${uri}`;
      if (!copies.has(id)) {
        if (!(await files.exists(uri))) continue;
        copies.set(id, await files.persist(uri, projectId));
      }
      next = next.split(uri).join(copies.get(id)!);
      rewritten++;
    }
    if (next !== json) await AsyncStorage.setItem(key, next);
  }
  return rewritten;
}

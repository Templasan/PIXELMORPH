import { useEffect } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { createStore, useStore } from '@core/state';
import { errorLogger } from '@core/reliability';
import { MEDIA_DIR_NAME } from '@core/reliability/storageUsage';
import type { Project } from '@modules/projects';
import { primaryAsset } from './projectFormat';

/** Card thumbnails are made by cardThumbMaker.ts (Skia / native). Kept injected so this file stays testable. */
export type MakeCardThumb = (sourceUri: string, tmpUri: string) => Promise<void>;

export type CardThumbStatus = 'pending' | 'ready' | 'failed';

/** Thumb state by thumb file path. */
export const cardThumbStore = createStore<Record<string, CardThumbStatus>>({});

/** What the thumb is made from: the last export when there is one, else the primary asset's working copy. */
export function cardThumbSourceOf(project: Project): string | null {
  const asset = primaryAsset(project);
  return project.thumbnailUri ?? (asset?.workingUri || asset?.originalUri) ?? null;
}

/**
 * `media/<projectId>/card-<source name>.jpg`. The source name is in the file name, so a new export
 * or bake gets a new thumb. It sits in the project's media folder, so deleting the project removes it.
 */
export function cardThumbPathOf(project: Project): string | null {
  const dir = FileSystem.documentDirectory;
  const source = cardThumbSourceOf(project);
  if (!dir || !source) return null;
  const name = source
    .split(/[?#]/)[0]
    .split('/')
    .pop()
    ?.replace(/\.[^.]+$/, '');
  if (!name) return null;
  return `${dir}${MEDIA_DIR_NAME}/${project.id}/card-${name}.jpg`;
}

interface Job {
  path: string;
  source: string;
  make: MakeCardThumb;
}

const queue: Job[] = [];
let busy = false;

function patch(path: string, status: CardThumbStatus) {
  cardThumbStore.set((s) => ({ ...s, [path]: status }));
}

/** One thumb at a time, so the grid never decodes several large photos at once. */
function pump(): void {
  if (busy) return;
  const job = queue.shift();
  if (!job) return;
  busy = true;
  runJob(job).finally(() => {
    busy = false;
    pump();
  });
}

/** Written to a .tmp file and renamed only on success, so a killed app never leaves a half file that looks ready. */
async function runJob({ path, source, make }: Job): Promise<void> {
  const tmpUri = `${path}.tmp.jpg`;
  try {
    await FileSystem.makeDirectoryAsync(path.slice(0, path.lastIndexOf('/')), {
      intermediates: true,
    });
    await make(source, tmpUri);
    await FileSystem.deleteAsync(path, { idempotent: true });
    await FileSystem.moveAsync({ from: tmpUri, to: path });
    patch(path, 'ready');
  } catch (error) {
    await FileSystem.deleteAsync(tmpUri, { idempotent: true }).catch(() => {});
    errorLogger.log(error, 'cardThumb.make');
    patch(path, 'failed');
  }
}

/**
 * Queues the card thumb of `project`. An existing file from an earlier session counts as ready;
 * repeated requests are ignored. Never throws: a failure only marks the thumb 'failed'.
 */
export async function requestCardThumb(project: Project, make: MakeCardThumb): Promise<void> {
  const path = cardThumbPathOf(project);
  const source = cardThumbSourceOf(project);
  if (!path || !source) return;
  if (cardThumbStore.get()[path]) return;
  patch(path, 'pending');
  const info = await FileSystem.getInfoAsync(path).catch(() => ({ exists: false }));
  if (info.exists) {
    patch(path, 'ready');
    return;
  }
  queue.push({ path, source, make });
  pump();
}

/** The thumb file, once it is ready; null while it is being made (show the placeholder). */
export function useCardThumb(project: Project, make: MakeCardThumb): string | null {
  const path = cardThumbPathOf(project);
  const status = useStore(cardThumbStore, (s) => (path ? s[path] : undefined));
  useEffect(() => {
    requestCardThumb(project, make);
  }, [project, make]);
  return path && status === 'ready' ? path : null;
}

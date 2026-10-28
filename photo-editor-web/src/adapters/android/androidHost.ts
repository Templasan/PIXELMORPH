import type { EditorHost, PictureRef, SavedPhoto } from '../../ports/host';
import { call } from './bridge';

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Bridge messages stay small: an export goes over in pieces this big. */
const CHUNK = 512 * 1024;

/**
 * The editor inside the Android app's WebView: every host service is a bridge call answered by
 * the app (its projects, gallery picker and the export to the gallery).
 */
export function createAndroidHost(): EditorHost {
  return {
    loadProject: () => call<SavedPhoto | null>('loadProject'),
    saveProject: (project) => call<void>('saveProject', project),
    pickPicture: () => call<PictureRef | null>('pickPicture'),
    exportSink() {
      return {
        start: (fileName) => call<void>('exportStart', fileName),
        async write(position, bytes) {
          for (let i = 0; i < bytes.length; i += CHUNK) {
            await call<void>('exportWrite', position + i, toBase64(bytes.subarray(i, i + CHUNK)));
          }
        },
        finish: () => call<string>('exportFinish'),
      };
    },
    close() {
      void call('close');
    },
  };
}

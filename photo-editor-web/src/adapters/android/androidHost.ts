import type { BakedPhoto, EditorHost, PictureRef, PresetRef, WatermarkRef, SavedPhoto } from '../../ports/host';
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
    listPresets: () => call<PresetRef[]>('listPresets'),
    segmentSubject: (uri) => call<PictureRef>('segmentSubject', uri),
    listWatermarks: () => call<WatermarkRef[]>('listWatermarks'),
    saveWatermark: (watermark) => call<void>('saveWatermark', watermark),
    deleteWatermark: (id) => call<void>('deleteWatermark', id),
    listPhotoProjects: () => call<{ id: string; name: string }[]>('listPhotoProjects'),
    applyLookTo: (ids, look) => call<number>('applyLookTo', ids, look),
    savePreset: (name, adjustments) => call<void>('savePreset', name, adjustments),
    exportSink() {
      return {
        start: (fileName, options) => call<void>('exportStart', fileName, options?.heicQuality ?? null),
        async write(position, bytes) {
          for (let i = 0; i < bytes.length; i += CHUNK) {
            await call<void>('exportWrite', position + i, toBase64(bytes.subarray(i, i + CHUNK)));
          }
        },
        finish: () => call<string>('exportFinish'),
      };
    },
    newProject(name, width, height) {
      return {
        start: () => call<void>('newProjectStart'),
        async write(position, bytes) {
          for (let i = 0; i < bytes.length; i += CHUNK) {
            await call<void>('newProjectWrite', position + i, toBase64(bytes.subarray(i, i + CHUNK)));
          }
        },
        finish: async () => {
          await call<string>('newProjectFinish', name, width, height);
        },
      };
    },
    photoSink() {
      return {
        start: () => call<void>('bakeStart'),
        async write(position, bytes) {
          for (let i = 0; i < bytes.length; i += CHUNK) {
            await call<void>('bakeWrite', position + i, toBase64(bytes.subarray(i, i + CHUNK)));
          }
        },
        finish: () => call<BakedPhoto>('bakeFinish'),
      };
    },
    close() {
      void call('close');
    },
  };
}

import type { EditorHost, MediaItem, SavedProject } from '../../ports/host';
import { call, onEvent } from './bridge';

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/** Above this a source streams in blocks through the bridge instead of being read whole. */
const STREAM_ABOVE_BYTES = 1024 * 1024 * 1024;

/**
 * The editor inside the Android app's WebView: every host service is a bridge call answered by
 * the app (its gallery picker, project store, file reader and export to the gallery).
 */
export function createAndroidHost(): EditorHost {
  return {
    pickMedia: (kind, multiple) => call<MediaItem[]>('pickMedia', kind, multiple ?? false),
    pickIsFinal: true,
    loadProject: () => call<SavedProject | null>('loadProject'),
    saveProject: (project) => call<void>('saveProject', project),
    exportSink() {
      let writes = Promise.resolve();
      return {
        start: (fileName) => call<void>('exportStart', fileName),
        write(position, bytes) {
          const b64 = toBase64(bytes);
          writes = writes.then(() => call<void>('exportWrite', position, b64));
          return writes;
        },
        async finish() {
          await writes;
          return call<string>('exportFinish');
        },
      };
    },
    fileReader: {
      getFileSize: (uri) => call<number>('getFileSize', uri),
      readChunk: async (uri, offset, length) =>
        fromBase64(await call<string>('readChunk', uri, offset, length)),
    },
    streamAboveBytes: STREAM_ABOVE_BYTES,
    close() {
      void call('close');
    },
    wantPreviewSources(uris) {
      void call('wantPreviewSources', uris).catch(() => {});
    },
    onPreviewSources(listener) {
      onEvent('previewSources', (e) => listener(e.map as Record<string, string>));
    },
  };
}

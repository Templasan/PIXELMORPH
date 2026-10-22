import { File, FileMode, type FileHandle } from 'expo-file-system';

/**
 * RN side of the engine's streaming reads (expo-file-system handle, base64 over the DOM bridge).
 * Sources up to STREAM_ABOVE_BYTES are read whole by XHR inside the WebView instead.
 */
export const STREAM_ABOVE_BYTES = 64 * 1024 * 1024;

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function createFileHost() {
  const handles = new Map<string, FileHandle>();
  return {
    async readChunk(uri: string, offset: number, length: number) {
      let h = handles.get(uri);
      if (!h) {
        h = new File(uri).open(FileMode.ReadOnly);
        handles.set(uri, h);
      }
      h.offset = offset;
      return toBase64(h.readBytes(length));
    },
    async getFileSize(uri: string) {
      return new File(uri).size ?? 0;
    },
    close() {
      handles.forEach((h) => h.close());
      handles.clear();
    },
  };
}

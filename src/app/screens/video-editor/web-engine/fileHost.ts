import { File, FileMode, type FileHandle } from 'expo-file-system';

/**
 * Sources up to this size are read whole by XHR inside the WebView (Blob), larger ones stream
 * through the bridge. Emulator numbers (docs/video-engine-migration.md): XHR opened a 300 MB file
 * in ~1 s and kept the renderer at ~190 MB; the chunk bridge ran the renderer to 322 MB at open
 * and 1.2 GB after a seek run, and opened a 40 MB file slower to seek (0.88 s vs 0.70 s mean).
 * So XHR is the default and the bridge is the fallback when XHR fails (blocked or no space for
 * the Blob copy); 1 GiB is where a whole-file Blob copy stops being sane.
 */
export const STREAM_ABOVE_BYTES = 1024 * 1024 * 1024;

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

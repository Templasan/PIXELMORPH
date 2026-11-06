import { File, FileMode, Paths, type FileHandle } from 'expo-file-system';

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

/** Bytes a base64 string decodes to. */
export function base64Bytes(b64: string): number {
  return (b64.length * 3) / 4 - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function createFileHost() {
  const handles = new Map<string, FileHandle>();
  let exporting: { file: File; handle: FileHandle; end: number } | null = null;
  return {
    /** The engine's export writes here: the app cache, like the native exporter's output. */
    async startExport(ext = 'mp4') {
      const file = new File(Paths.cache, `pixelmorph_export_${Date.now()}.${ext}`);
      file.create({ overwrite: true });
      exporting = { file, handle: file.open(FileMode.WriteOnly), end: 0 };
    },
    async writeExportChunk(position: number, b64: string) {
      if (!exporting) throw new Error('export not started');
      // An append is decoded natively: decoding byte by byte in JS took ~8 s for a 32 MB photo.
      if (position === exporting.end) {
        exporting.file.write(b64, { encoding: 'base64', append: true });
      } else {
        exporting.handle.offset = position;
        exporting.handle.writeBytes(fromBase64(b64));
      }
      exporting.end = Math.max(exporting.end, position + base64Bytes(b64));
    },
    async finishExport() {
      if (!exporting) throw new Error('export not started');
      const { file, handle } = exporting;
      exporting = null;
      handle.close();
      return file.uri;
    },
    /** A cancelled or failed export leaves no partial file behind. */
    abortExport() {
      if (!exporting) return;
      const { file, handle } = exporting;
      exporting = null;
      handle.close();
      try {
        file.delete();
      } catch {
        // already gone
      }
    },
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
      this.abortExport();
    },
  };
}

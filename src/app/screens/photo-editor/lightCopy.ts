// The web photo editor's light copy: made once per photo with Skia, so opening a photo never
// decodes the full file again.
import * as FileSystem from 'expo-file-system/legacy';
import { encodeImage } from '@modules/export';
import { PREVIEW_LONG_EDGE } from './resolution';
import { downscaleToLongEdge, loadFullImage } from './photoProxySkia';

const DECODE_TIMEOUT_MS = 30_000;

export interface LightCopy {
  uri: string;
  /** The original's upright size. */
  width: number;
  height: number;
}

/** `<name>.preview.jpg` next to `uri` (+ `.json` with the original's size), made once. */
export async function lightCopyOf(uri: string): Promise<LightCopy> {
  const base = uri.replace(/\.[^./]+$/, '');
  const copy = `${base}.preview.jpg`;
  const meta = `${base}.preview.json`;
  if (
    (await FileSystem.getInfoAsync(copy)).exists &&
    (await FileSystem.getInfoAsync(meta)).exists
  ) {
    const size = JSON.parse(await FileSystem.readAsStringAsync(meta)) as Omit<LightCopy, 'uri'>;
    return { uri: copy, ...size };
  }
  // A missing file makes Skia wait forever: say so at once (old projects can point at the cache).
  if (!(await FileSystem.getInfoAsync(uri)).exists) {
    throw new Error('O arquivo desta foto não existe mais no aparelho.');
  }
  // Skia decodes upright (EXIF applied), like the WebView reads the original. A file it cannot
  // read (e.g. some RAW) has been seen to hang Skia.Data.fromURI: give up instead of waiting forever.
  const image = await Promise.race([
    loadFullImage(uri),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), DECODE_TIMEOUT_MS)),
  ]);
  if (!image) throw new Error('Não foi possível abrir esta foto (formato não suportado).');
  try {
    const width = image.width();
    const height = image.height();
    const light = downscaleToLongEdge(image, PREVIEW_LONG_EDGE);
    const { base64 } = encodeImage(light, 'JPEG', 90);
    if (light !== image) light.dispose();
    // Written under a temporary name and moved: a killed app never leaves a half file.
    await FileSystem.writeAsStringAsync(`${copy}.tmp`, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await FileSystem.writeAsStringAsync(meta, JSON.stringify({ width, height }));
    await FileSystem.moveAsync({ from: `${copy}.tmp`, to: copy });
    return { uri: copy, width, height };
  } finally {
    image.dispose();
  }
}

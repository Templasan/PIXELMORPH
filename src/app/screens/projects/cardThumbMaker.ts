// Makes the card thumb file. Skia / native side; the queue and store live in cardThumb.ts.
import * as FileSystem from 'expo-file-system/legacy';
import { encodeImage } from '@modules/export';
import { extractFrame } from '../../../../modules/pixelmorph-video-export/src';
import { photoProxyPathOf } from '../photo-editor/photoProxy';
import { proxyPathOf } from '../video-editor/previewProxy';
import { downscaleToLongEdge, loadFullImage } from '../photo-editor/photoProxySkia';
import type { MakeCardThumb } from './cardThumb';

const CARD_THUMB_EDGE = 384;
const VIDEO_FILE = /\.(mp4|mov|m4v|3gp|webm|mkv)$/i;

/** Video: a native frame at 0 ms (from the 720p copy when it exists). Photo: the light copy when it exists (much cheaper), else the original. */
export const makeCardThumb: MakeCardThumb = async (sourceUri, tmpUri) => {
  if (VIDEO_FILE.test(sourceUri.split(/[?#]/)[0])) {
    // The 720p preview copy, when it exists, is far cheaper to decode than a 4K original.
    const proxy = proxyPathOf(sourceUri);
    const useProxy = proxy !== null && (await FileSystem.getInfoAsync(proxy)).exists;
    const frame = await extractFrame(useProxy && proxy ? proxy : sourceUri, 0, CARD_THUMB_EDGE);
    await FileSystem.copyAsync({ from: frame.uri, to: tmpUri });
    await FileSystem.deleteAsync(frame.uri, { idempotent: true }).catch(() => {});
    return;
  }
  const proxy = photoProxyPathOf(sourceUri);
  const hasProxy = proxy !== null && (await FileSystem.getInfoAsync(proxy)).exists;
  const image = await loadFullImage(hasProxy && proxy ? proxy : sourceUri);
  if (!image) throw new Error(`Não foi possível decodificar a imagem: ${sourceUri}`);
  const light = downscaleToLongEdge(image, CARD_THUMB_EDGE);
  try {
    const { base64 } = encodeImage(light, 'JPEG', 80);
    await FileSystem.writeAsStringAsync(tmpUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } finally {
    if (light !== image) light.dispose();
    image.dispose();
  }
};

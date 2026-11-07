// Makes the card thumb file. Skia / native side; the queue and store live in cardThumb.ts.
import * as FileSystem from 'expo-file-system/legacy';
import { encodeImage } from '@modules/export';
import { extractFrame } from '../../../../modules/pixelmorph-video-export/src';
import { lightCopyNamesOf } from '../photo-editor/resolution';
import { proxyPathOf } from '../video-editor/previewProxy';
import { downscaleToLongEdge, loadFullImage } from '../photo-editor/photoProxySkia';
import type { MakeCardThumb } from './cardThumb';

const CARD_THUMB_EDGE = 384;
const VIDEO_FILE = /\.(mp4|mov|m4v|3gp|webm|mkv)$/i;

/** Recordings often open on black, so the thumb looks a little further in. */
const VIDEO_FRAME_MS = 500;

/** Video: a native frame near the start (from the 720p copy when it exists). Photo: the light copy when it exists (much cheaper), else the original. */
export const makeCardThumb: MakeCardThumb = async (sourceUri, tmpUri) => {
  if (VIDEO_FILE.test(sourceUri.split(/[?#]/)[0])) {
    // The 720p preview copy, when it exists, is far cheaper to decode than a 4K original.
    const proxy = proxyPathOf(sourceUri);
    const useProxy = proxy !== null && (await FileSystem.getInfoAsync(proxy)).exists;
    const video = useProxy && proxy ? proxy : sourceUri;
    // A clip shorter than that has no frame there.
    const frame = await extractFrame(video, VIDEO_FRAME_MS, CARD_THUMB_EDGE).catch(() =>
      extractFrame(video, 0, CARD_THUMB_EDGE)
    );
    await FileSystem.copyAsync({ from: frame.uri, to: tmpUri });
    await FileSystem.deleteAsync(frame.uri, { idempotent: true }).catch(() => {});
    return;
  }
  // The editor's light copy (any quality) when it exists: decoding a 50 MP original takes seconds.
  let source = sourceUri;
  for (const edge of [1080, 1600, 2048]) {
    const { copy } = lightCopyNamesOf(sourceUri, edge);
    if ((await FileSystem.getInfoAsync(copy)).exists) {
      source = copy;
      break;
    }
  }
  const image = await loadFullImage(source);
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

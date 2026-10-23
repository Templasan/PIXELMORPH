import * as FileSystem from 'expo-file-system/legacy';
import type { SkImage } from '@shopify/react-native-skia';
import { base64ToBytes, encodeImage, type EncodedImage } from '@modules/export';
import { writeImageToCache } from '@modules/device-media';
import { encodeHeic, heicSupported } from '../../../../modules/pixelmorph-video-export/src';

export { heicSupported };

/**
 * RF-057: HEIC through the native encoder (Android 9+). Skia cannot write HEIC, so the image goes
 * out as a quality-100 JPEG first and the platform encoder re-encodes it at `quality`. `preview`
 * is that JPEG: HEIC is not displayable everywhere, the sheet and the project thumbnail use it.
 */
export async function encodeHeicImage(
  image: SkImage,
  quality: number
): Promise<{ heic: EncodedImage; preview: EncodedImage }> {
  const preview = encodeImage(image, 'JPEG', 100);
  const jpegUri = await writeImageToCache(preview.base64, 'JPEG');
  const heicUri = jpegUri.replace(/\.jpg$/, '.heic');
  try {
    await encodeHeic(jpegUri, heicUri, quality);
    const base64 = await FileSystem.readAsStringAsync(heicUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return {
      heic: { ...preview, format: 'HEIC', quality, base64, bytes: base64ToBytes(base64) },
      preview,
    };
  } finally {
    await FileSystem.deleteAsync(jpegUri, { idempotent: true }).catch(() => {});
    await FileSystem.deleteAsync(heicUri, { idempotent: true }).catch(() => {});
  }
}

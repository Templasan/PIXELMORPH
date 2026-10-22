import * as FileSystem from 'expo-file-system/legacy';
import { ImageFormat, Skia } from '@shopify/react-native-skia';

const SIZE = 16;

/**
 * A small black JPEG (cached on disk once) used for empty timeline time: the exporter scales a
 * picture to fill the frame, so a tiny black one covers any output size.
 */
export async function blackFrameUri(): Promise<string> {
  const uri = `${FileSystem.cacheDirectory}pixelmorph_black_${SIZE}.jpg`;
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) return uri;
  const surface = Skia.Surface.Make(SIZE, SIZE);
  if (!surface) throw new Error('Não foi possível gerar o quadro preto.');
  surface.getCanvas().drawColor(Skia.Color('black'));
  surface.flush();
  const base64 = surface.makeImageSnapshot().encodeToBase64(ImageFormat.JPEG, 90);
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return uri;
}

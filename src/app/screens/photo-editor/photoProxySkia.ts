// Skia side of the light copy: decodes, downscales and writes files. Kept apart from
// photoProxy.ts so that file stays importable under Jest.
import * as FileSystem from 'expo-file-system/legacy';
import { FilterMode, MipmapMode, Skia, type SkImage } from '@shopify/react-native-skia';
import { encodeImage } from '@modules/export';
import { fitLongEdgeOf, PREVIEW_LONG_EDGE } from './resolution';
import type { PhotoProxyResult } from './photoProxy';

/** Smaller copy of `image` for the live canvas, long edge at most `maxLongEdge`. Returns `image`
 * itself when it is already small enough or the surface cannot be made. */
export function downscaleToLongEdge(image: SkImage, maxLongEdge: number): SkImage {
  const srcW = image.width();
  const srcH = image.height();
  const { width, height } = fitLongEdgeOf(srcW, srcH, maxLongEdge);
  if (width === srcW && height === srcH) return image;
  const surface = Skia.Surface.Make(width, height);
  if (!surface) return image;
  surface
    .getCanvas()
    .drawImageRectOptions(
      image,
      Skia.XYWHRect(0, 0, srcW, srcH),
      Skia.XYWHRect(0, 0, width, height),
      FilterMode.Linear,
      MipmapMode.Linear
    );
  surface.flush();
  return surface.makeImageSnapshot();
}

/**
 * Decodes the whole file. Callers that need the pixels (export, bakes) load it on demand and
 * dispose it afterwards. Orientation: Skia decodes the stored pixels, exactly as useImage does,
 * and the light copy is made from that same decode, so both draw identically.
 */
export async function loadFullImage(uri: string): Promise<SkImage | null> {
  const data = await Skia.Data.fromURI(uri);
  return Skia.Image.MakeImageFromEncoded(data);
}

/** Downscales `image` to the light size and writes it as JPEG (quality 90) to `outUri`. */
export async function writeLightCopy(image: SkImage, outUri: string): Promise<void> {
  const light = downscaleToLongEdge(image, PREVIEW_LONG_EDGE);
  try {
    const { base64 } = encodeImage(light, 'JPEG', 90);
    await FileSystem.writeAsStringAsync(outUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } finally {
    if (light !== image) light.dispose();
  }
}

/** photoProxy.ts `MakePhotoProxy`: decodes the source once, writes the light copy to `tmpUri`. */
export async function makePhotoProxy(sourceUri: string, tmpUri: string): Promise<PhotoProxyResult> {
  const image = await loadFullImage(sourceUri);
  if (!image) throw new Error(`Não foi possível decodificar a imagem: ${sourceUri}`);
  try {
    const width = image.width();
    const height = image.height();
    if (Math.max(width, height) <= PREVIEW_LONG_EDGE) return { kind: 'small', width, height };
    await writeLightCopy(image, tmpUri);
    return { kind: 'written', width, height };
  } finally {
    image.dispose();
  }
}

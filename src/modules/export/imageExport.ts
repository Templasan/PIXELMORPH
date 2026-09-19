/**
 * RF-057/RNF-013: real image export — encodes an actual Skia canvas snapshot to
 * JPEG/PNG/WebP bytes (Skia's own encoder, already bundled with react-native-skia, so no
 * new dependency). The pure search/geometry math lives in exportMath.ts so it can be unit
 * tested; this file is the thin Skia-touching adapter around it.
 */

import { Skia, ImageFormat, type SkImage } from '@shopify/react-native-skia';
import {
  type ImageExportFormat,
  searchQualityForTargetSize,
  coverFitRect,
  scaleToFit,
} from './exportMath';

export * from './exportMath';

function toSkiaFormat(format: ImageExportFormat): ImageFormat {
  switch (format) {
    case 'JPEG':
      return ImageFormat.JPEG;
    case 'PNG':
      return ImageFormat.PNG;
    case 'WebP':
      return ImageFormat.WEBP;
  }
}

export interface EncodedImage {
  bytes: Uint8Array;
  base64: string;
  format: ImageExportFormat;
  quality: number;
  width: number;
  height: number;
}

export function encodeImage(
  image: SkImage,
  format: ImageExportFormat,
  quality: number
): EncodedImage {
  const fmt = toSkiaFormat(format);
  const q = Math.max(1, Math.min(100, Math.round(quality)));
  return {
    bytes: image.encodeToBytes(fmt, q),
    base64: image.encodeToBase64(fmt, q),
    format,
    quality: q,
    width: image.width(),
    height: image.height(),
  };
}

/** RNF-013: "smart" compression against the encoder's real output size, not an estimate. */
export function encodeToTargetSize(
  image: SkImage,
  format: ImageExportFormat,
  targetBytes: number,
  minQuality = 20,
  maxQuality = 100
): EncodedImage {
  const quality = searchQualityForTargetSize(
    targetBytes,
    (q) => encodeImage(image, format, q).bytes.length,
    minQuality,
    maxQuality
  );
  return encodeImage(image, format, quality);
}

/** RF-017: "Tamanho" chips — scales the whole image down to fit, no cropping. */
export function resizeImageToFit(image: SkImage, maxLongEdge: number | null): SkImage {
  const { width, height } = scaleToFit(image.width(), image.height(), maxLongEdge);
  if (width === image.width() && height === image.height()) return image;

  const surface = Skia.Surface.Make(width, height);
  if (!surface) return image;
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  canvas.drawImageRect(
    image,
    { x: 0, y: 0, width: image.width(), height: image.height() },
    { x: 0, y: 0, width, height },
    paint
  );
  surface.flush();
  return surface.makeImageSnapshot();
}

/** Real GPU/CPU-composited resize (used for social-media presets) — "cover" fit, center-cropped. */
export function resizeImageCover(
  image: SkImage,
  targetWidth: number,
  targetHeight: number
): SkImage {
  const surface = Skia.Surface.Make(targetWidth, targetHeight);
  if (!surface) return image;

  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  paint.setAntiAlias(true);

  const rect = coverFitRect(image.width(), image.height(), targetWidth, targetHeight);
  canvas.drawImageRect(
    image,
    { x: 0, y: 0, width: image.width(), height: image.height() },
    rect,
    paint
  );
  surface.flush();
  return surface.makeImageSnapshot();
}

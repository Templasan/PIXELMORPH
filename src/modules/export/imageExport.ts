/**
 * RF-057/RNF-013: real image export — encodes an actual Skia canvas snapshot to
 * JPEG/PNG/WebP bytes (Skia's own encoder, already bundled with react-native-skia, so no
 * new dependency). The pure search/geometry math lives in exportMath.ts so it can be unit
 * tested; this file is the thin Skia-touching adapter around it.
 */

import { Skia, BlurStyle, ImageFormat, matchFont, type SkImage } from '@shopify/react-native-skia';
import {
  type ImageExportFormat,
  searchQualityForTargetSize,
  coverFitRect,
  scaleToFit,
  watermarkFontSize,
  watermarkShadow,
  layoutWatermark,
} from './exportMath';
import { bytesToBase64, setJpegDpi, setPngDpi } from './exportBytes';

export * from './exportMath';
export * from './exportBytes';

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

/** Writes the DPI into an encoded JPEG/PNG (WebP has no density field, so it is returned as is). */
export function applyDpi(encoded: EncodedImage, dpi: number): EncodedImage {
  if (encoded.format === 'WebP') return encoded;
  const bytes =
    encoded.format === 'PNG' ? setPngDpi(encoded.bytes, dpi) : setJpegDpi(encoded.bytes, dpi);
  return { ...encoded, bytes, base64: bytesToBase64(bytes) };
}

export interface WatermarkOptions {
  text: string;
  color: string;
  /** 0..1 */
  opacity: number;
  /** 3x3 grid cell, 0 (top-left) to 8 (bottom-right). */
  position: number;
  /** The tab's size slider, 5..80. */
  size: number;
  rotation: number;
}

/** Composites the watermark text onto the image with the same placement as the tab preview. */
export function drawWatermark(image: SkImage, options: WatermarkOptions): SkImage {
  const width = image.width();
  const height = image.height();
  const surface = Skia.Surface.Make(width, height);
  if (!surface) return image;

  const canvas = surface.getCanvas();
  canvas.drawImage(image, 0, 0);
  const fontSize = watermarkFontSize(width, options.size);
  const font = matchFont({ fontFamily: 'sans-serif', fontSize, fontWeight: 'normal' });
  const place = layoutWatermark(
    width,
    height,
    font.measureText(options.text).width,
    fontSize,
    options.position
  );
  const paint = Skia.Paint();
  paint.setColor(Skia.Color(options.color));
  paint.setAlphaf(options.opacity);
  // Black, blurred, offset copy under the text, so the white reads on light backgrounds too.
  const { offset, blur, alpha } = watermarkShadow(fontSize);
  const shadow = Skia.Paint();
  shadow.setColor(Skia.Color('black'));
  shadow.setAlphaf(alpha * options.opacity);
  shadow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, blur, false));
  canvas.save();
  canvas.rotate(options.rotation, place.pivotX, place.pivotY);
  canvas.drawText(options.text, place.x + offset, place.baselineY + offset, shadow, font);
  canvas.drawText(options.text, place.x, place.baselineY, paint, font);
  canvas.restore();
  surface.flush();
  return surface.makeImageSnapshot();
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

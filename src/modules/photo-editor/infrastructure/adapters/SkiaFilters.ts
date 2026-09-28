import { Skia, type SkImage } from '@shopify/react-native-skia';

/** Color filter implementations using Skia. */

/**
 * Brightness adjustment: -100 (darker) to 100 (brighter).
 * Uses a 5x4 color matrix to shift all channels equally.
 */
export function applyBrightness(image: SkImage, value: number): SkImage {
  const normalized = Math.max(-100, Math.min(100, value));
  const shift = (normalized / 100) * 255;

  const surface = Skia.Surface.Make(image.width(), image.height());
  if (!surface) return image;

  const canvas = surface.getCanvas();
  const paint = Skia.Paint();

  const matrix = [1, 0, 0, 0, shift, 0, 1, 0, 0, shift, 0, 0, 1, 0, shift, 0, 0, 0, 1, 0];

  const colorFilter = Skia.ColorFilter.MakeMatrix(matrix);
  paint.setColorFilter(colorFilter);

  canvas.drawImage(image, 0, 0, paint);
  surface.flush();
  return surface.makeImageSnapshot();
}

/**
 * Contrast adjustment: 0.5 (lower) to 2.0 (higher), 1.0 is unchanged.
 * output = (input - 128) * factor + 128
 */
export function applyContrast(image: SkImage, factor: number): SkImage {
  const normalized = Math.max(0.1, Math.min(3, factor));
  const shift = 128 * (1 - normalized);

  const surface = Skia.Surface.Make(image.width(), image.height());
  if (!surface) return image;

  const canvas = surface.getCanvas();
  const paint = Skia.Paint();

  const matrix = [
    normalized,
    0,
    0,
    0,
    shift,
    0,
    normalized,
    0,
    0,
    shift,
    0,
    0,
    normalized,
    0,
    shift,
    0,
    0,
    0,
    1,
    0,
  ];

  const colorFilter = Skia.ColorFilter.MakeMatrix(matrix);
  paint.setColorFilter(colorFilter);

  canvas.drawImage(image, 0, 0, paint);
  surface.flush();
  return surface.makeImageSnapshot();
}

/**
 * Saturation adjustment: 0 (grayscale) to 2.0 (highly saturated), 1.0 is unchanged.
 * Uses luminance-weighted desaturation formula.
 */
export function applySaturation(image: SkImage, factor: number): SkImage {
  const normalized = Math.max(0, Math.min(2, factor));

  const lum_r = 0.299;
  const lum_g = 0.587;
  const lum_b = 0.114;

  const inv = 1 - normalized;
  const inv_lum_r = inv * lum_r;
  const inv_lum_g = inv * lum_g;
  const inv_lum_b = inv * lum_b;

  const surface = Skia.Surface.Make(image.width(), image.height());
  if (!surface) return image;

  const canvas = surface.getCanvas();
  const paint = Skia.Paint();

  const matrix = [
    inv_lum_r + normalized,
    inv_lum_g,
    inv_lum_b,
    0,
    0,
    inv_lum_r,
    inv_lum_g + normalized,
    inv_lum_b,
    0,
    0,
    inv_lum_r,
    inv_lum_g,
    inv_lum_b + normalized,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
  ];

  const colorFilter = Skia.ColorFilter.MakeMatrix(matrix);
  paint.setColorFilter(colorFilter);

  canvas.drawImage(image, 0, 0, paint);
  surface.flush();
  return surface.makeImageSnapshot();
}

/**
 * Grayscale conversion using standard luminance weights.
 * Converts to grayscale by applying luminance formula to all channels.
 */
export function applyGrayscale(image: SkImage): SkImage {
  const lum_r = 0.299;
  const lum_g = 0.587;
  const lum_b = 0.114;

  const surface = Skia.Surface.Make(image.width(), image.height());
  if (!surface) return image;

  const canvas = surface.getCanvas();
  const paint = Skia.Paint();

  const matrix = [
    lum_r,
    lum_g,
    lum_b,
    0,
    0,
    lum_r,
    lum_g,
    lum_b,
    0,
    0,
    lum_r,
    lum_g,
    lum_b,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
  ];

  const colorFilter = Skia.ColorFilter.MakeMatrix(matrix);
  paint.setColorFilter(colorFilter);

  canvas.drawImage(image, 0, 0, paint);
  surface.flush();
  return surface.makeImageSnapshot();
}

/**
 * Sepia tone effect — warm, vintage appearance.
 * Uses standard sepia matrix for warm brownish tones.
 */
export function applySepia(image: SkImage): SkImage {
  const surface = Skia.Surface.Make(image.width(), image.height());
  if (!surface) return image;

  const canvas = surface.getCanvas();
  const paint = Skia.Paint();

  const matrix = [
    0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131, 0, 0, 0, 0, 0, 1, 0,
  ];

  const colorFilter = Skia.ColorFilter.MakeMatrix(matrix);
  paint.setColorFilter(colorFilter);

  canvas.drawImage(image, 0, 0, paint);
  surface.flush();
  return surface.makeImageSnapshot();
}

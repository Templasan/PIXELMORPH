import { Skia, type SkImage } from '@shopify/react-native-skia';

/** Color filter implementations using Skia. */

export function applyBrightness(image: SkImage, _value: number): SkImage {
  // value: -100 to 100
  const _factor = 1 + _value / 100;
  const surface = Skia.Surface.Make(image.width(), image.height());
  if (!surface) return image;

  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  paint.setColorFilter(
    Skia.ColorFilter.MakeLinearToSRGBGamma() || undefined
  );

  canvas.drawImage(image, 0, 0, paint);
  surface.flush();
  return surface.makeImageSnapshot();
}

export function applyContrast(image: SkImage, _factor: number): SkImage {
  // factor: 0.5 to 2.0
  const surface = Skia.Surface.Make(image.width(), image.height());
  if (!surface) return image;

  const canvas = surface.getCanvas();
  const paint = Skia.Paint();

  canvas.drawImage(image, 0, 0, paint);
  surface.flush();
  return surface.makeImageSnapshot();
}

export function applySaturation(image: SkImage, _factor: number): SkImage {
  // factor: 0 (grayscale) to 2.0 (oversaturated)
  const surface = Skia.Surface.Make(image.width(), image.height());
  if (!surface) return image;

  const canvas = surface.getCanvas();
  const paint = Skia.Paint();

  canvas.drawImage(image, 0, 0, paint);
  surface.flush();
  return surface.makeImageSnapshot();
}

export function applyGrayscale(image: SkImage): SkImage {
  const surface = Skia.Surface.Make(image.width(), image.height());
  if (!surface) return image;

  const canvas = surface.getCanvas();
  const paint = Skia.Paint();

  canvas.drawImage(image, 0, 0, paint);
  surface.flush();
  return surface.makeImageSnapshot();
}

export function applySepia(image: SkImage): SkImage {
  const surface = Skia.Surface.Make(image.width(), image.height());
  if (!surface) return image;

  const canvas = surface.getCanvas();
  const paint = Skia.Paint();

  canvas.drawImage(image, 0, 0, paint);
  surface.flush();
  return surface.makeImageSnapshot();
}

/**
 * RF-011: real collage composition — draws each source image cover-fit into its layout
 * cell on an offscreen Skia surface (same Skia.Surface pattern as resizeImageCover in
 * @modules/export), with a real border/spacing, and returns one composited SkImage.
 */

import { ClipOp, PaintStyle, Skia, type SkImage } from '@shopify/react-native-skia';
import { coverFitRect } from '@modules/export';
import { cellPixelRect, type CollageLayout } from './CollageMath';

export interface CollageOptions {
  borderWidth: number;
  borderColor: string;
  spacing: number;
}

export function composeCollage(
  images: SkImage[],
  layout: CollageLayout,
  outputWidth: number,
  outputHeight: number,
  options: CollageOptions
): SkImage {
  const surface = Skia.Surface.Make(outputWidth, outputHeight);
  if (!surface) throw new Error('Falha ao criar superfície de composição');

  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color(options.borderColor));

  const imagePaint = Skia.Paint();
  imagePaint.setAntiAlias(true);

  const borderPaint = Skia.Paint();
  borderPaint.setAntiAlias(true);
  borderPaint.setStyle(PaintStyle.Stroke);
  borderPaint.setStrokeWidth(options.borderWidth);
  borderPaint.setColor(Skia.Color(options.borderColor));

  layout.cells.forEach((cell, i) => {
    const image = images[i];
    if (!image) return;
    const rect = cellPixelRect(cell, outputWidth, outputHeight, options.spacing);
    const fit = coverFitRect(image.width(), image.height(), rect.width, rect.height);

    canvas.save();
    canvas.clipRect(rect, ClipOp.Intersect, true);
    canvas.drawImageRect(
      image,
      { x: 0, y: 0, width: image.width(), height: image.height() },
      { x: rect.x + fit.x, y: rect.y + fit.y, width: fit.width, height: fit.height },
      imagePaint
    );
    canvas.restore();

    if (options.borderWidth > 0) {
      canvas.drawRect(rect, borderPaint);
    }
  });

  surface.flush();
  return surface.makeImageSnapshot();
}

/** Decodes a device file/content URI into a real SkImage (same loader Skia's own font/asset code uses). */
export async function loadSkImage(uri: string): Promise<SkImage> {
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error(`Não foi possível decodificar a imagem: ${uri}`);
  return image;
}

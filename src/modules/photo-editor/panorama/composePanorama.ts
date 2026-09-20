import { Skia, type SkImage } from '@shopify/react-native-skia';
import type { PanoramaImage, PanoramaCompositionOptions } from './Panorama';

export function composePanorama(
  images: PanoramaImage[],
  options: PanoramaCompositionOptions
): SkImage {
  if (images.length === 0) throw new Error('Sem imagens para panorama');
  if (images.length === 1) return images[0].image;

  // Calcular dimensões totais
  let totalWidth = 0;
  let maxHeight = options.outputHeight;

  images.forEach((img, i) => {
    if (i === 0) {
      totalWidth += img.image.width();
    } else {
      totalWidth += img.offsetX;
    }
  });

  const surface = Skia.Surface.Make(totalWidth, maxHeight);
  if (!surface) throw new Error('Falha ao criar superfície panorama');

  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('rgba(0,0,0,0)'));

  const paint = Skia.Paint();
  paint.setAntiAlias(true);

  let xPos = 0;

  images.forEach((item, i) => {
    const img = item.image;
    const overlapW = options.overlapWidth;

    // Calcular altura para manter aspect ratio
    const ratio = img.height() / img.width();
    const drawHeight = maxHeight;
    const drawWidth = Math.round(drawHeight / ratio);

    const srcRect = {
      x: 0,
      y: 0,
      width: img.width(),
      height: img.height(),
    };

    const dstRect = {
      x: xPos,
      y: 0,
      width: drawWidth,
      height: drawHeight,
    };

    // Blending na sobreposição
    if (i > 0 && overlapW > 0) {
      const blendPaint = Skia.Paint();
      blendPaint.setAlphaf(0.5); // Alpha blend 50%
      canvas.drawImageRect(img, srcRect, dstRect, blendPaint);
    } else {
      canvas.drawImageRect(img, srcRect, dstRect, paint);
    }

    // Posição para próxima imagem (com overlap)
    if (i < images.length - 1) {
      xPos += drawWidth - (i === 0 ? 0 : options.overlapWidth);
    } else {
      xPos += drawWidth;
    }
  });

  surface.flush();
  const stitched = surface.makeImageSnapshot();

  if (!stitched) throw new Error('Falha ao criar snapshot panorama');
  return stitched;
}

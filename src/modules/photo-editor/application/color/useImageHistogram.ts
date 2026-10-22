import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlphaType,
  ColorType,
  FilterMode,
  MipmapMode,
  Skia,
  TileMode,
  processUniforms,
  type SkImage,
  type SkRuntimeEffect,
  type SkSurface,
} from '@shopify/react-native-skia';
import type { FullAdjustmentUniforms } from '../../domain/color/colorAdjustments';

export interface RGBHistogram {
  r: number[];
  g: number[];
  b: number[];
}

const HISTOGRAM_BINS = 40;
/**
 * The histogram is computed from a downscaled copy (longest side this many px): the shape of a
 * 40-bin histogram does not need more than a few tens of thousands of samples.
 */
const SAMPLE_MAX_SIDE_PX = 128; // ~12k samples: 40 bins keep their shape, binning runs every tick

/** `image` scaled to fit SAMPLE_MAX_SIDE_PX (or the original if smaller). */
function makeSample(image: SkImage): SkImage {
  const scale = Math.min(1, SAMPLE_MAX_SIDE_PX / Math.max(image.width(), image.height()));
  if (scale >= 1) return image;
  const width = Math.max(1, Math.round(image.width() * scale));
  const height = Math.max(1, Math.round(image.height() * scale));
  const surface = Skia.Surface.Make(width, height);
  if (!surface) return image;
  surface
    .getCanvas()
    .drawImageRect(
      image,
      Skia.XYWHRect(0, 0, image.width(), image.height()),
      Skia.XYWHRect(0, 0, width, height),
      Skia.Paint()
    );
  surface.flush();
  return surface.makeImageSnapshot();
}

function emptyHistogram(): RGBHistogram {
  return {
    r: new Array(HISTOGRAM_BINS).fill(0),
    g: new Array(HISTOGRAM_BINS).fill(0),
    b: new Array(HISTOGRAM_BINS).fill(0),
  };
}

/**
 * RF-047: live RGB histogram, updated on every slider movement. The sample is run through the
 * same adjustments shader the canvas uses, on the GPU, and only the binning is done in JS. The
 * old CPU mirror of the shader math cost ~26 ms per update even under V8 (several times that on
 * Hermes), on the JS thread, on every tick.
 */
export function useImageHistogram(image: SkImage | null, effect: SkRuntimeEffect | null) {
  const sampleRef = useRef<SkImage | null>(null);
  const surfaceRef = useRef<SkSurface | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    sampleRef.current = null;
    surfaceRef.current = null;
    setReady(false);
    if (!image) return;
    const sample = makeSample(image);
    sampleRef.current = sample;
    surfaceRef.current =
      Skia.Surface.MakeOffscreen(sample.width(), sample.height()) ??
      Skia.Surface.Make(sample.width(), sample.height());
    setReady(!!surfaceRef.current);
  }, [image]);

  const compute = useCallback(
    (uniforms: FullAdjustmentUniforms): RGBHistogram => {
      const sample = sampleRef.current;
      const surface = surfaceRef.current;
      if (!sample || !surface || !effect) return emptyHistogram();

      const w = sample.width();
      const h = sample.height();
      const imageShader = sample.makeShaderOptions(
        TileMode.Clamp,
        TileMode.Clamp,
        FilterMode.Linear,
        MipmapMode.None
      );
      // Same children as the live canvas: the SKSL declares `image` and `maskImage`.
      const shader = effect.makeShaderWithChildren(
        processUniforms(effect, uniforms as unknown as Record<string, number | number[]>),
        [imageShader, imageShader]
      );
      const paint = Skia.Paint();
      paint.setShader(shader);
      const canvas = surface.getCanvas();
      canvas.drawRect(Skia.XYWHRect(0, 0, w, h), paint);
      surface.flush();
      const data = surface.makeImageSnapshot().readPixels(0, 0, {
        width: w,
        height: h,
        colorType: ColorType.RGBA_8888,
        alphaType: AlphaType.Unpremul,
      });
      if (!(data instanceof Uint8Array)) return emptyHistogram();

      const rBins = new Array(HISTOGRAM_BINS).fill(0);
      const gBins = new Array(HISTOGRAM_BINS).fill(0);
      const bBins = new Array(HISTOGRAM_BINS).fill(0);
      // 256 levels -> 40 bins without a division per channel.
      const toBin = (v: number) => (v * HISTOGRAM_BINS) >> 8;
      for (let i = 0; i + 3 < data.length; i += 4) {
        rBins[toBin(data[i])]++;
        gBins[toBin(data[i + 1])]++;
        bBins[toBin(data[i + 2])]++;
      }

      let max = 1;
      for (let j = 0; j < HISTOGRAM_BINS; j++) {
        max = Math.max(max, rBins[j], gBins[j], bBins[j]);
      }
      return {
        r: rBins.map((v) => v / max),
        g: gBins.map((v) => v / max),
        b: bBins.map((v) => v / max),
      };
    },
    [effect]
  );

  // Stable identity: callers memoize on this object, and a fresh literal per render made them
  // recompute the whole histogram on every render of the editor.
  return useMemo(() => ({ ready, compute }), [ready, compute]);
}

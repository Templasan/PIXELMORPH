import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlphaType, ColorType, Skia, type SkImage } from '@shopify/react-native-skia';
import {
  applyFullAdjustmentsRGB,
  type FullAdjustmentUniforms,
} from '../../domain/color/colorAdjustments';

export interface RGBHistogram {
  r: number[];
  g: number[];
  b: number[];
}

const HISTOGRAM_BINS = 40;
/**
 * The histogram is computed from a downscaled copy (longest side this many px), read back once:
 * a full-resolution readPixels of a phone photo is ~10 MB on the JS thread, and the shape of a
 * 40-bin histogram does not need more than a few tens of thousands of samples.
 */
const SAMPLE_MAX_SIDE_PX = 192;

/** RGBA pixels of `image` scaled to fit SAMPLE_MAX_SIDE_PX (or the original if smaller). */
function readSamplePixels(image: SkImage): Uint8Array | null {
  const scale = Math.min(1, SAMPLE_MAX_SIDE_PX / Math.max(image.width(), image.height()));
  const width = Math.max(1, Math.round(image.width() * scale));
  const height = Math.max(1, Math.round(image.height() * scale));
  let source = image;
  if (scale < 1) {
    const surface = Skia.Surface.Make(width, height);
    if (surface) {
      surface
        .getCanvas()
        .drawImageRect(
          image,
          Skia.XYWHRect(0, 0, image.width(), image.height()),
          Skia.XYWHRect(0, 0, width, height),
          Skia.Paint()
        );
      surface.flush();
      source = surface.makeImageSnapshot();
    }
  }
  const pixels = source.readPixels(0, 0, {
    width: source.width(),
    height: source.height(),
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  return pixels instanceof Uint8Array ? pixels : null;
}

function emptyHistogram(): RGBHistogram {
  return {
    r: new Array(HISTOGRAM_BINS).fill(0),
    g: new Array(HISTOGRAM_BINS).fill(0),
    b: new Array(HISTOGRAM_BINS).fill(0),
  };
}

/**
 * RF-047: live RGB histogram. Reads the decoded image's raw pixels once (cached in a ref),
 * then re-derives the histogram on the CPU by re-applying the same adjustment math the
 * GPU shader uses (see colorAdjustments.ts) — avoids reading the rendered GPU frame back
 * on every slider tick.
 */
export function useImageHistogram(image: SkImage | null) {
  const bufferRef = useRef<Uint8Array | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    bufferRef.current = null;
    setReady(false);
    if (!image) return;

    const pixels = readSamplePixels(image);
    if (pixels) {
      bufferRef.current = pixels;
      setReady(true);
    }
  }, [image]);

  const compute = useCallback((uniforms: FullAdjustmentUniforms): RGBHistogram => {
    const data = bufferRef.current;
    if (!data) return emptyHistogram();

    const rBins = new Array(HISTOGRAM_BINS).fill(0);
    const gBins = new Array(HISTOGRAM_BINS).fill(0);
    const bBins = new Array(HISTOGRAM_BINS).fill(0);
    const stride = 4; // every pixel of the downscaled sample

    for (let i = 0; i + 3 < data.length; i += stride) {
      const [r, g, b] = applyFullAdjustmentsRGB(
        data[i] / 255,
        data[i + 1] / 255,
        data[i + 2] / 255,
        uniforms
      );
      rBins[Math.min(HISTOGRAM_BINS - 1, Math.floor(r * HISTOGRAM_BINS))]++;
      gBins[Math.min(HISTOGRAM_BINS - 1, Math.floor(g * HISTOGRAM_BINS))]++;
      bBins[Math.min(HISTOGRAM_BINS - 1, Math.floor(b * HISTOGRAM_BINS))]++;
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
  }, []);

  // Stable identity: callers memoize on this object, and a fresh literal per render made them
  // recompute the whole histogram on every render of the editor.
  return useMemo(() => ({ ready, compute }), [ready, compute]);
}

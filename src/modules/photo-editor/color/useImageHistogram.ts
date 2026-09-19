import { useCallback, useEffect, useRef, useState } from 'react';
import { AlphaType, ColorType, type SkImage } from '@shopify/react-native-skia';
import { applyFullAdjustmentsRGB, type FullAdjustmentUniforms } from './colorAdjustments';

export interface RGBHistogram {
  r: number[];
  g: number[];
  b: number[];
}

const HISTOGRAM_BINS = 40;
// Every 8th pixel is plenty to approximate a photo histogram's shape and keeps the
// recompute (run on the JS thread on every slider tick) well under a frame budget.
const SAMPLE_STRIDE_PX = 8;

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

    const width = image.width();
    const height = image.height();
    const pixels = image.readPixels(0, 0, {
      width,
      height,
      colorType: ColorType.RGBA_8888,
      alphaType: AlphaType.Unpremul,
    });

    if (pixels instanceof Uint8Array) {
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
    const stride = 4 * SAMPLE_STRIDE_PX;

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

    const max = Math.max(1, ...rBins, ...gBins, ...bBins);
    return {
      r: rBins.map((v) => v / max),
      g: gBins.map((v) => v / max),
      b: bBins.map((v) => v / max),
    };
  }, []);

  return { ready, compute };
}

import * as FileSystem from 'expo-file-system/legacy';
import { AlphaType, ColorType } from '@shopify/react-native-skia';
import { encode } from 'modern-gif';
import { extractFrame } from '../../../../modules/pixelmorph-video-export/src';
import { resizeImageCover } from '@modules/export';
import { loadSkImage } from '@modules/photo-editor/collage/composeCollage';
import { gifSize, planGifFrames, type ExportPlan } from '@modules/video-editor';

export interface GifOptions {
  fps: number;
  maxColors: number;
  maxWidth: number;
  sourceWidth: number;
  sourceHeight: number;
}

export interface GifResult {
  uri: string;
  sizeBytes: number;
  frameCount: number;
  width: number;
  height: number;
  truncated: boolean;
}

function toBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * RF-061: animated GIF of the timeline. Frames are grabbed from the source files, scaled with
 * Skia, quantised and LZW-encoded in JS by modern-gif (no native encoder involved).
 * `onProgress` gets 0..100; `isCancelled` is polled between frames.
 */
export async function exportGif(
  plan: ExportPlan,
  options: GifOptions,
  onProgress: (percent: number) => void,
  isCancelled: () => boolean
): Promise<GifResult> {
  const { frames: planned, truncated } = planGifFrames(plan, options.fps);
  if (planned.length === 0) throw new Error('Não há quadros para o GIF.');

  const { width, height } = gifSize(options.sourceWidth, options.sourceHeight, options.maxWidth);
  const frames: { data: Uint8ClampedArray<ArrayBuffer>; delay: number }[] = [];

  // Frames that repeat the same source instant (freeze frames) are decoded once.
  let lastKey = '';
  let lastPixels: Uint8ClampedArray<ArrayBuffer> | null = null;

  for (let i = 0; i < planned.length; i++) {
    if (isCancelled()) throw new Error('CANCELLED');
    const frame = planned[i];
    const key = `${frame.sourceUri}@${Math.round(frame.sourceTimeMs)}`;
    if (key !== lastKey || !lastPixels) {
      const thumb = await extractFrame(frame.sourceUri, frame.sourceTimeMs, options.maxWidth * 2);
      const source = await loadSkImage(thumb.uri);
      const scaled = resizeImageCover(source, width, height);
      const pixels = scaled.readPixels(0, 0, {
        width,
        height,
        colorType: ColorType.RGBA_8888,
        alphaType: AlphaType.Unpremul,
      });
      if (!(pixels instanceof Uint8Array)) throw new Error('Não foi possível ler o quadro.');
      // A fresh ArrayBuffer-backed copy: Skia hands back a view over native memory.
      const copy = new Uint8ClampedArray(new ArrayBuffer(pixels.length));
      copy.set(pixels);
      lastPixels = copy;
      lastKey = key;
    }
    frames.push({ data: lastPixels, delay: frame.delayMs });
    onProgress(Math.round(((i + 1) / planned.length) * 90));
  }

  const buffer = await encode({ width, height, frames, maxColors: options.maxColors });
  onProgress(97);

  const bytes = new Uint8Array(buffer);
  const uri = `${FileSystem.cacheDirectory}pixelmorph_export_${Date.now()}.gif`;
  await FileSystem.writeAsStringAsync(uri, toBase64(bytes), {
    encoding: FileSystem.EncodingType.Base64,
  });
  onProgress(100);
  return { uri, sizeBytes: bytes.length, frameCount: frames.length, width, height, truncated };
}

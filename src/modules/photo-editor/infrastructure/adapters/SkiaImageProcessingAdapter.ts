import { ImageProcessingPort } from '../../ports';

/** Adapter for Skia-based image processing. ponytail: stub until implementation. */
export class SkiaImageProcessingAdapter implements ImageProcessingPort {
  async resize(imageUri: string, width: number, height: number): Promise<string> {
    console.warn(`[Skia] resize: ${width}x${height}`);
    return imageUri;
  }

  async rotate(imageUri: string, degrees: number): Promise<string> {
    console.warn(`[Skia] rotate: ${degrees}°`);
    return imageUri;
  }

  async crop(imageUri: string, x: number, y: number, width: number, height: number): Promise<string> {
    console.warn(`[Skia] crop: (${x},${y}) ${width}x${height}`);
    return imageUri;
  }

  async mirror(imageUri: string, horizontal: boolean): Promise<string> {
    console.warn(`[Skia] mirror: ${horizontal ? 'horizontal' : 'vertical'}`);
    return imageUri;
  }
}

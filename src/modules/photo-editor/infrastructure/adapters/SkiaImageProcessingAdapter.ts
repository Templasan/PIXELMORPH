// ponytail: Skia imports kept here for future implementations
// import { Skia, type SkImage } from '@shopify/react-native-skia';
import { ImageProcessingPort, RenderingError } from '../../ports';

/** Adapter for image processing using @shopify/react-native-skia. */
export class SkiaImageProcessingAdapter implements ImageProcessingPort {
  async resize(imageUri: string, width: number, height: number): Promise<string> {
    try {
      if (width <= 0 || height <= 0) {
        throw new RenderingError('Invalid dimensions');
      }
      console.warn(`[Skia] resize: ${width}x${height}`);
      // TODO: Implement using Skia.Surface.Make + drawImageRect
      return imageUri;
    } catch (error) {
      throw new RenderingError(
        error instanceof Error ? error.message : 'Failed to resize image'
      );
    }
  }

  async rotate(imageUri: string, degrees: number): Promise<string> {
    try {
      const normalizedDegrees = degrees % 360;
      console.warn(`[Skia] rotate: ${normalizedDegrees}°`);
      // TODO: Implement using canvas.rotate()
      return imageUri;
    } catch (error) {
      throw new RenderingError(
        error instanceof Error ? error.message : 'Failed to rotate image'
      );
    }
  }

  async crop(
    imageUri: string,
    x: number,
    y: number,
    width: number,
    height: number
  ): Promise<string> {
    try {
      if (width <= 0 || height <= 0) {
        throw new RenderingError('Invalid crop dimensions');
      }
      console.warn(`[Skia] crop: (${x},${y}) ${width}x${height}`);
      // TODO: Implement using drawImageRect
      return imageUri;
    } catch (error) {
      throw new RenderingError(
        error instanceof Error ? error.message : 'Failed to crop image'
      );
    }
  }

  async mirror(imageUri: string, horizontal: boolean): Promise<string> {
    try {
      console.warn(`[Skia] mirror: ${horizontal ? 'horizontal' : 'vertical'}`);
      // TODO: Implement using canvas.scale() with negative values
      return imageUri;
    } catch (error) {
      throw new RenderingError(
        error instanceof Error ? error.message : 'Failed to mirror image'
      );
    }
  }
}

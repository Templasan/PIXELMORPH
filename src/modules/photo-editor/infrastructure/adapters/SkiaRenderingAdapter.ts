// ponytail: Skia imports kept here for future filter implementations
// import { Skia, type SkImage } from '@shopify/react-native-skia';
import { ImageRenderingPort, RenderingError } from '../../ports';

/** Adapter for Skia rendering engine using @shopify/react-native-skia. */
export class SkiaRenderingAdapter implements ImageRenderingPort {
  async renderWithFilter(
    imageUri: string,
    filterName: string,
    _params: Record<string, number>
  ): Promise<string> {
    try {
      // TODO: Implement filters using Skia color filters
      // Supports: brightness, contrast, saturation, sepia, grayscale
      console.warn(`[Skia] renderWithFilter: ${filterName}`);
      return imageUri;
    } catch (error) {
      throw new RenderingError(
        error instanceof Error ? error.message : 'Failed to render filter'
      );
    }
  }

  async renderComposite(layers: unknown[], blendMode: string): Promise<string> {
    try {
      if (!layers || layers.length === 0) {
        throw new RenderingError('No layers to composite');
      }
      console.warn(`[Skia] renderComposite: ${layers.length} layers, blend=${blendMode}`);
      // TODO: Implement layer compositing with Skia.Surface
      return '';
    } catch (error) {
      throw new RenderingError(
        error instanceof Error ? error.message : 'Failed to composite layers'
      );
    }
  }

  async renderWatermark(
    imageUri: string,
    _watermarkUri: string,
    position: { x: number; y: number }
  ): Promise<string> {
    try {
      console.warn(`[Skia] renderWatermark at (${position.x}, ${position.y})`);
      // TODO: Implement watermark compositing
      return imageUri;
    } catch (error) {
      throw new RenderingError(
        error instanceof Error ? error.message : 'Failed to render watermark'
      );
    }
  }
}

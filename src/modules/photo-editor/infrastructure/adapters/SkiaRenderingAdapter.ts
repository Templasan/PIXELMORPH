import { ImageRenderingPort } from '../../ports';

/** Adapter for Skia rendering engine. ponytail: stub until Skia integration complete. */
export class SkiaRenderingAdapter implements ImageRenderingPort {
  async renderWithFilter(
    imageUri: string,
    filterName: string,
    params: Record<string, number>
  ): Promise<string> {
    // TODO: Integrate with @shopify/react-native-skia
    console.warn(`[Skia] renderWithFilter: ${filterName}`, params);
    return imageUri;
  }

  async renderComposite(layers: unknown[], blendMode: string): Promise<string> {
    // TODO: Render layers with blend mode
    console.warn(`[Skia] renderComposite with ${layers.length} layers, blend=${blendMode}`);
    return '';
  }

  async renderWatermark(
    imageUri: string,
    _watermarkUri: string,
    position: { x: number; y: number }
  ): Promise<string> {
    // TODO: Composite watermark onto image
    console.warn(`[Skia] renderWatermark at (${position.x}, ${position.y})`);
    return imageUri;
  }
}

/** Abstraction for rendering images (Skia, Canvas, etc). */
export interface ImageRenderingPort {
  renderWithFilter(
    imageUri: string,
    filterName: string,
    params: Record<string, number>
  ): Promise<string>;
  renderComposite(layers: unknown[], blendMode: string): Promise<string>;
  renderWatermark(
    imageUri: string,
    watermarkUri: string,
    position: { x: number; y: number }
  ): Promise<string>;
}

/** Abstraction for image processing (resizing, rotating, etc). */
export interface ImageProcessingPort {
  resize(imageUri: string, width: number, height: number): Promise<string>;
  rotate(imageUri: string, degrees: number): Promise<string>;
  crop(imageUri: string, x: number, y: number, width: number, height: number): Promise<string>;
  mirror(imageUri: string, horizontal: boolean): Promise<string>;
}

/** Abstraction for exporting images. */
export interface ImageExportPort {
  exportAsJPEG(imageUri: string, quality: number, path: string): Promise<void>;
  exportAsPNG(imageUri: string, path: string): Promise<void>;
}

/** Error types for photo-editor. */
export class PhotoEditorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhotoEditorError';
  }
}

export class RenderingError extends PhotoEditorError {
  constructor(message: string) {
    super(`Rendering error: ${message}`);
    this.name = 'RenderingError';
  }
}

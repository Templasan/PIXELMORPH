import { ImageExportPort } from '../../ports';

/** Adapter for image export. ponytail: stub until implementation. */
export class ImageExportAdapter implements ImageExportPort {
  async exportAsJPEG(_imageUri: string, quality: number, path: string): Promise<void> {
    console.warn(`[Export] JPEG: quality=${quality}, path=${path}`);
    // TODO: Use expo-file-system or native export
  }

  async exportAsPNG(_imageUri: string, path: string): Promise<void> {
    console.warn(`[Export] PNG: path=${path}`);
    // TODO: Use expo-file-system or native export
  }
}

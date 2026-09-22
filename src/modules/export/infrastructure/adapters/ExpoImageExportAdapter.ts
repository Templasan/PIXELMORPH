import { ImageExportPort } from '../../ports';
import { ImageExportOptions, ExportResult } from '../../domain';

/** Adapter for image export using expo-file-system. ponytail: stub until integration. */
export class ExpoImageExportAdapter implements ImageExportPort {
  async exportImage(
    _imageUri: string,
    options: ImageExportOptions,
    _outputPath: string
  ): Promise<ExportResult> {
    console.warn(`[Export] Image: format=${options.format}, quality=${options.quality}`);
    // TODO: Use expo-file-system to save
    return {
      uri: '',
      mimeType: `image/${options.format}`,
      fileSizeBytes: 0,
      metadata: {},
    };
  }
}

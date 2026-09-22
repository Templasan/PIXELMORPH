import { ExpoImageExportAdapter, FFmpegVideoExportAdapter, ExpoShareAdapter } from './infrastructure';
import { ImageExportPort, VideoExportPort, SharePort } from './ports';

/** Composition root for export module. */
export class ExportModuleFactory {
  private static imageExportAdapter: ImageExportPort | null = null;
  private static videoExportAdapter: VideoExportPort | null = null;
  private static shareAdapter: SharePort | null = null;

  static createImageExportAdapter(): ImageExportPort {
    if (!this.imageExportAdapter) {
      this.imageExportAdapter = new ExpoImageExportAdapter();
    }
    return this.imageExportAdapter;
  }

  static createVideoExportAdapter(): VideoExportPort {
    if (!this.videoExportAdapter) {
      this.videoExportAdapter = new FFmpegVideoExportAdapter();
    }
    return this.videoExportAdapter;
  }

  static createShareAdapter(): SharePort {
    if (!this.shareAdapter) {
      this.shareAdapter = new ExpoShareAdapter();
    }
    return this.shareAdapter;
  }

  static createExportModule() {
    return {
      imageExportAdapter: this.createImageExportAdapter(),
      videoExportAdapter: this.createVideoExportAdapter(),
      shareAdapter: this.createShareAdapter(),
    };
  }
}

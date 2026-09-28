import {
  PresetsRepository,
  RecentAdjustmentsRepository,
  WatermarkPresetsRepository,
} from '@core/ports';
import {
  createSavePresetUseCase,
  createListPresetsUseCase,
  createApplyBrushStrokeUseCase,
  createAddRecentAdjustmentUseCase,
  createListRecentAdjustmentsUseCase,
  createSaveWatermarkPresetUseCase,
  createListWatermarkPresetsUseCase,
  createComputeWatermarkRenderingUseCase,
} from './application/usecases';
import {
  SkiaRenderingAdapter,
  SkiaImageProcessingAdapter,
  ImageExportAdapter,
} from './infrastructure';
import { ImageRenderingPort, ImageProcessingPort, ImageExportPort } from './ports';

/** Composition root for photo-editor module. */
export class PhotoEditorModuleFactory {
  private static renderingAdapter: ImageRenderingPort | null = null;
  private static processingAdapter: ImageProcessingPort | null = null;
  private static exportAdapter: ImageExportPort | null = null;

  static createRenderingAdapter(): ImageRenderingPort {
    if (!this.renderingAdapter) {
      this.renderingAdapter = new SkiaRenderingAdapter();
    }
    return this.renderingAdapter;
  }

  static createProcessingAdapter(): ImageProcessingPort {
    if (!this.processingAdapter) {
      this.processingAdapter = new SkiaImageProcessingAdapter();
    }
    return this.processingAdapter;
  }

  static createExportAdapter(): ImageExportPort {
    if (!this.exportAdapter) {
      this.exportAdapter = new ImageExportAdapter();
    }
    return this.exportAdapter;
  }

  static createPhotoEditorModule(
    presetsRepo: PresetsRepository,
    recentAdjustmentsRepo: RecentAdjustmentsRepository,
    watermarkPresetsRepo: WatermarkPresetsRepository
  ) {
    const renderingAdapter = this.createRenderingAdapter();
    const processingAdapter = this.createProcessingAdapter();
    const exportAdapter = this.createExportAdapter();

    return {
      // Adapters
      renderingAdapter,
      processingAdapter,
      exportAdapter,

      // Use cases
      savePreset: createSavePresetUseCase(presetsRepo),
      listPresets: createListPresetsUseCase(presetsRepo),
      addRecentAdjustment: createAddRecentAdjustmentUseCase(recentAdjustmentsRepo),
      listRecentAdjustments: createListRecentAdjustmentsUseCase(recentAdjustmentsRepo),
      saveWatermarkPreset: createSaveWatermarkPresetUseCase(watermarkPresetsRepo),
      listWatermarkPresets: createListWatermarkPresetsUseCase(watermarkPresetsRepo),
      computeWatermarkRendering: createComputeWatermarkRenderingUseCase(),
      applyBrushStroke: createApplyBrushStrokeUseCase(),
    };
  }
}

/** AI task type. */
export type AITaskType = 'background-removal' | 'object-detection' | 'face-detection' | 'style-transfer' | 'upscaling';

/** AI processing location. */
export type ProcessingLocation = 'local' | 'remote' | 'auto';

/** AI inference input. */
export interface AIInferenceInput {
  taskType: AITaskType;
  imageUri: string;
  parameters?: Record<string, unknown>;
  location?: ProcessingLocation;
}

/** AI inference result. */
export interface AIInferenceResult {
  taskType: AITaskType;
  outputUri?: string; // for image output
  mask?: Uint8Array; // for segmentation
  detections?: AIDetection[];
  confidence: number; // 0-1
  processingTimeMs: number;
}

/** Detected object/face. */
export interface AIDetection {
  type: 'face' | 'object';
  label: string;
  confidence: number;
  bounds: { x: number; y: number; width: number; height: number };
  landmarks?: Array<{ x: number; y: number }>;
}

/** AI model. */
export interface AIModel {
  id: string;
  name: string;
  version: string;
  taskType: AITaskType;
  location: ProcessingLocation;
  sizeBytes: number;
  lastUpdated: number;
}

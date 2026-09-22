import { AIInferenceInput, AIInferenceResult, AIModel } from '../domain';

/** Abstraction for local AI inference. */
export interface LocalAIPort {
  listModels(): Promise<AIModel[]>;
  downloadModel(modelId: string): Promise<void>;
  runInference(input: AIInferenceInput): Promise<AIInferenceResult>;
}

/** Abstraction for remote AI inference. */
export interface RemoteAIPort {
  runInference(input: AIInferenceInput): Promise<AIInferenceResult>;
}

/** Abstraction for AI model management. */
export interface AIModelManagementPort {
  listAvailableModels(): Promise<AIModel[]>;
  downloadModel(modelId: string): Promise<void>;
  deleteModel(modelId: string): Promise<void>;
  getModelStatus(modelId: string): Promise<'available' | 'downloading' | 'not-downloaded'>;
}

/** AI errors. */
export class AIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIError';
  }
}

export class InferenceError extends AIError {
  constructor(taskType: string, message: string) {
    super(`Inference error (${taskType}): ${message}`);
    this.name = 'InferenceError';
  }
}

export class ModelNotFoundError extends AIError {
  constructor(modelId: string) {
    super(`Model not found: ${modelId}`);
    this.name = 'ModelNotFoundError';
  }
}

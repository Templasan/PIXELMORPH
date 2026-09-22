import { LocalAIPort } from '../../ports';
import { AIInferenceInput, AIInferenceResult, AIModel } from '../../domain';

/** Adapter for ML Kit local AI. ponytail: stub until ML Kit integration. */
export class MLKitAIAdapter implements LocalAIPort {
  async listModels(): Promise<AIModel[]> {
    console.warn('[MLKit] listModels');
    return [];
  }

  async downloadModel(_modelId: string): Promise<void> {
    console.warn('[MLKit] downloadModel');
    // TODO: Download ML Kit model
  }

  async runInference(_input: AIInferenceInput): Promise<AIInferenceResult> {
    console.warn(`[MLKit] runInference: ${_input.taskType}`);
    // TODO: Run ML Kit inference
    return {
      taskType: _input.taskType,
      confidence: 0,
      processingTimeMs: 0,
    };
  }
}

import { RemoteAIPort } from '../../ports';
import { AIInferenceInput, AIInferenceResult } from '../../domain';

/** Adapter for remote AI inference via API. ponytail: stub until backend API integration. */
export class RemoteAIAdapter implements RemoteAIPort {
  async runInference(_input: AIInferenceInput): Promise<AIInferenceResult> {
    console.warn(`[Remote] runInference: ${_input.taskType}`);
    // TODO: Call remote API for inference
    return {
      taskType: _input.taskType,
      confidence: 0,
      processingTimeMs: 0,
    };
  }
}

import { AIModelManagementPort } from '../../ports';
import { AIModel } from '../../domain';

/** Adapter for AI model management and caching. ponytail: stub until storage integration. */
export class AIModelCacheAdapter implements AIModelManagementPort {
  async listAvailableModels(): Promise<AIModel[]> {
    console.warn('[ModelCache] listAvailableModels');
    // TODO: Query available models from backend
    return [];
  }

  async downloadModel(_modelId: string): Promise<void> {
    console.warn('[ModelCache] downloadModel');
    // TODO: Download to local cache
  }

  async deleteModel(_modelId: string): Promise<void> {
    console.warn('[ModelCache] deleteModel');
    // TODO: Delete from cache
  }

  async getModelStatus(
    _modelId: string
  ): Promise<'available' | 'downloading' | 'not-downloaded'> {
    console.warn('[ModelCache] getModelStatus');
    return 'not-downloaded';
  }
}

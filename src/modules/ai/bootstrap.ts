import { MLKitAIAdapter, RemoteAIAdapter, AIModelCacheAdapter } from './infrastructure';
import { LocalAIPort, RemoteAIPort, AIModelManagementPort } from './ports';

/** Composition root for AI module. */
export class AIModuleFactory {
  private static localAIAdapter: LocalAIPort | null = null;
  private static remoteAIAdapter: RemoteAIPort | null = null;
  private static modelCacheAdapter: AIModelManagementPort | null = null;

  static createLocalAIAdapter(): LocalAIPort {
    if (!this.localAIAdapter) {
      this.localAIAdapter = new MLKitAIAdapter();
    }
    return this.localAIAdapter;
  }

  static createRemoteAIAdapter(): RemoteAIPort {
    if (!this.remoteAIAdapter) {
      this.remoteAIAdapter = new RemoteAIAdapter();
    }
    return this.remoteAIAdapter;
  }

  static createModelCacheAdapter(): AIModelManagementPort {
    if (!this.modelCacheAdapter) {
      this.modelCacheAdapter = new AIModelCacheAdapter();
    }
    return this.modelCacheAdapter;
  }

  static createAIModule() {
    return {
      localAIAdapter: this.createLocalAIAdapter(),
      remoteAIAdapter: this.createRemoteAIAdapter(),
      modelCacheAdapter: this.createModelCacheAdapter(),
    };
  }
}

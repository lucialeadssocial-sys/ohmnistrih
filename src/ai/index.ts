/**
 * Local AI Layer Central Orchestrator
 * Lazily loads and manages local AI providers without affecting initial application startup time.
 */

import { localSpeechProvider } from './providers/LocalSpeechProvider';
import { localVADProvider } from './providers/LocalVADProvider';
import { localVisionProvider } from './providers/LocalVisionProvider';
import { localTTSProvider } from './providers/LocalTTSProvider';
import { localEmbeddingProvider } from './providers/LocalEmbeddingProvider';

export * from './types/ai';
export * from './cache/aiCache';
export * from './providers/LocalSpeechProvider';
export * from './providers/LocalVADProvider';
export * from './providers/LocalVisionProvider';
export * from './providers/LocalTTSProvider';
export * from './providers/LocalEmbeddingProvider';

export class LocalAIManager {
  private static instance: LocalAIManager | null = null;

  public speech = localSpeechProvider;
  public vad = localVADProvider;
  public vision = localVisionProvider;
  public tts = localTTSProvider;
  public embedding = localEmbeddingProvider;

  private constructor() {}

  public static getInstance(): LocalAIManager {
    if (!LocalAIManager.instance) {
      LocalAIManager.instance = new LocalAIManager();
    }
    return LocalAIManager.instance;
  }

  /**
   * Unloads all AI models from memory to free up VRAM/RAM.
   */
  public async unloadAllModels(): Promise<void> {
    await Promise.all([
      this.speech.unloadModel(),
      this.vad.unloadModel(),
      this.vision.unloadModel(),
      this.tts.unloadModel(),
      this.embedding.unloadModel()
    ]);
  }
}

export const localAIManager = LocalAIManager.getInstance();

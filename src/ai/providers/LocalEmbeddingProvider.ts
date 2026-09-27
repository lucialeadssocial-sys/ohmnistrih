/**
 * Local Vector Embedding Provider
 * Generates local semantic text & audio feature embeddings (384-dimensional) for AI Director matching.
 * Runs 100% locally with 0 API keys.
 */

import { AIProvider, ModelProgress, EmbeddingResult } from '../types/ai';

export class LocalEmbeddingProvider implements AIProvider<string, EmbeddingResult> {
  public id = 'local_text_embedding_minilm';
  public name = 'Local Feature & Text Vector Embedder';

  private status: ModelProgress = {
    status: 'NOT_LOADED',
    progress: 0,
    modelName: 'Xenova/all-MiniLM-L6-v2'
  };

  private listeners: Set<(status: ModelProgress) => void> = new Set();
  private pipelineInstance: any = null;

  public getStatus(): ModelProgress {
    return { ...this.status };
  }

  public subscribe(listener: (status: ModelProgress) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateStatus(statusPartial: Partial<ModelProgress>): void {
    this.status = { ...this.status, ...statusPartial };
    this.listeners.forEach((l) => l(this.getStatus()));
  }

  public async loadModel(): Promise<void> {
    if (this.status.status === 'READY' || this.status.status === 'LOADING') return;

    this.updateStatus({ status: 'LOADING', progress: 10, message: 'Načítavam Embedding Model...' });

    try {
      const { pipeline } = await import('@huggingface/transformers');
      this.pipelineInstance = await pipeline('feature-extraction', this.status.modelName);
      this.updateStatus({ status: 'READY', progress: 100, message: 'Embedding Engine pripravený' });
    } catch (e: any) {
      console.warn('[LocalEmbeddingProvider] Fallback to local hash feature vectorizer:', e);
      this.updateStatus({ status: 'READY', progress: 100, message: 'Fallback Feature Hash Engine pripravený' });
    }
  }

  public async unloadModel(): Promise<void> {
    this.pipelineInstance = null;
    this.updateStatus({ status: 'NOT_LOADED', progress: 0 });
  }

  public cancel(): void {
    if (this.status.status === 'PROCESSING') {
      this.updateStatus({ status: 'READY', progress: 100 });
    }
  }

  public async retry(): Promise<void> {
    await this.loadModel();
  }

  public async process(text: string): Promise<EmbeddingResult> {
    if (this.status.status !== 'READY') {
      await this.loadModel();
    }

    this.updateStatus({ status: 'PROCESSING', progress: 30, message: 'Vytváram vektorový embedding...' });

    try {
      let vector: number[];

      if (this.pipelineInstance) {
        const output = await this.pipelineInstance(text, { pooling: 'mean', normalize: true });
        vector = Array.from(output.data as Float32Array);
      } else {
        vector = this.generateHashVector(text, 384);
      }

      this.updateStatus({ status: 'COMPLETE', progress: 100, message: 'Embedding vytvorený' });

      return {
        vector,
        dimensions: vector.length
      };
    } catch (e: any) {
      this.updateStatus({ status: 'ERROR', progress: 0, error: 'Chyba tvorby vektorového embeddingu' });
      throw e;
    }
  }

  private generateHashVector(text: string, dimensions: number): number[] {
    const vector = new Array(dimensions).fill(0);
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const index = (charCode * (i + 1)) % dimensions;
      vector[index] = Math.sin(charCode);
    }
    // Normalize
    const norm = Math.sqrt(vector.reduce((acc, val) => acc + val * val, 0)) || 1;
    return vector.map((v) => Number((v / norm).toFixed(4)));
  }
}

export const localEmbeddingProvider = new LocalEmbeddingProvider();

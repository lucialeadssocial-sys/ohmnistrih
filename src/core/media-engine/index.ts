/**
 * Media Engine 1.0 - Core Orchestrator
 */

import { 
  MediaWorkerRequest, 
  MediaWorkerResponse, 
  MediaMetadata, 
  MediaWorkerMessageType 
} from './types';

export class MediaEngine {
  private static instance: MediaEngine | null = null;
  private worker: Worker | null = null;
  private jobCallbacks: Map<string, { 
    resolve: (value: any) => void, 
    reject: (reason: any) => void,
    onProgress?: (progress: number) => void
  }> = new Map();

  private thumbnailCache: Map<string, string> = new Map();
  private waveformCache: Map<string, number[]> = new Map();
  private readonly MAX_THUMBNAIL_CACHE = 100;
  private readonly MAX_WAVEFORM_CACHE = 50;

  private constructor() {
    // Lazy worker initialization on first job
  }

  public static getInstance(): MediaEngine {
    if (!MediaEngine.instance) {
      MediaEngine.instance = new MediaEngine();
    }
    return MediaEngine.instance;
  }

  private getWorker(): Worker | null {
    if (!this.worker && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('./media.worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = this.handleWorkerMessage.bind(this);
        this.worker.onerror = (err) => {
          console.error('[MediaEngine] Worker error:', err);
        };
      } catch (e) {
        console.error('[MediaEngine] Worker instantiation failed:', e);
        return null;
      }
    }
    return this.worker;
  }

  private handleWorkerMessage(e: MessageEvent<MediaWorkerResponse>) {
    const { jobId, status, result, error, progress } = e.data;
    const callbacks = this.jobCallbacks.get(jobId);

    if (!callbacks) return;

    if (status === 'success') {
      callbacks.resolve(result);
      this.jobCallbacks.delete(jobId);
    } else if (status === 'error') {
      callbacks.reject(new Error(error || 'Unknown worker error'));
      this.jobCallbacks.delete(jobId);
    } else if (status === 'cancelled') {
      callbacks.reject(new Error('Job cancelled'));
      this.jobCallbacks.delete(jobId);
    } else if (progress !== undefined && callbacks.onProgress) {
      callbacks.onProgress(progress);
    }
  }

  private postToWorker(type: MediaWorkerMessageType, payload: any, onProgress?: (p: number) => void): Promise<any> {
    return new Promise((resolve, reject) => {
      const worker = this.getWorker();
      if (!worker) {
        reject(new Error('Worker not available'));
        return;
      }

      const jobId = `job_${crypto.randomUUID()}`;
      this.jobCallbacks.set(jobId, { resolve, reject, onProgress });

      worker.postMessage({ jobId, type, payload });
    });
  }

  /**
   * High-level API
   */

  public async ping(): Promise<{ ready: boolean; engine: string; version: string }> {
    return this.postToWorker('PING', {});
  }

  public async getMetadata(file: File | string): Promise<MediaMetadata> {
    return this.postToWorker('GET_METADATA', { file });
  }

  public async getFrameAtTime(file: File | string, timestamp: number): Promise<ImageBitmap | null> {
    return this.postToWorker('DECODE_FRAME', { file, timestamp });
  }

  public async getThumbnail(assetId: string, file: File | string, timestamp: number): Promise<string> {
    const cacheKey = `${assetId}_${timestamp.toFixed(2)}`;
    if (this.thumbnailCache.has(cacheKey)) {
      return this.thumbnailCache.get(cacheKey)!;
    }

    const result = await this.postToWorker('GENERATE_THUMBNAIL', { file, timestamp });
    if (result && result.thumbnail) {
      if (this.thumbnailCache.size >= this.MAX_THUMBNAIL_CACHE) {
        const firstKey = this.thumbnailCache.keys().next().value;
        if (firstKey) this.thumbnailCache.delete(firstKey);
      }
      this.thumbnailCache.set(cacheKey, result.thumbnail);
      return result.thumbnail;
    }
    
    return ''; // Fallback
  }

  public async getWaveform(assetId: string, file: File | string): Promise<number[]> {
    if (this.waveformCache.has(assetId)) {
      return this.waveformCache.get(assetId)!;
    }

    const result = await this.postToWorker('GENERATE_WAVEFORM', { file });
    if (result && result.peaks) {
      if (this.waveformCache.size >= this.MAX_WAVEFORM_CACHE) {
        const firstKey = this.waveformCache.keys().next().value;
        if (firstKey) this.waveformCache.delete(firstKey);
      }
      this.waveformCache.set(assetId, result.peaks);
      return result.peaks;
    }

    return [];
  }

  public cancelJob(jobId: string) {
    const worker = this.getWorker();
    if (worker) {
      worker.postMessage({ jobId: `cancel_${crypto.randomUUID()}`, type: 'CANCEL_JOB', payload: { targetJobId: jobId } });
    }
  }

  public async dispose(): Promise<void> {
    this.thumbnailCache.clear();
    this.waveformCache.clear();
    if (this.worker) {
      try {
        await this.postToWorker('DISPOSE', {});
      } catch {
        // non-blocking
      }
      try {
        this.worker.terminate();
      } catch {
        // ignore
      }
      this.worker = null;
    }
  }
}

export const mediaEngineV1 = MediaEngine.getInstance();

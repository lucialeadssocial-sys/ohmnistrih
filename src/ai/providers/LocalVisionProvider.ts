/**
 * Local Vision & Scene Boundary Provider
 * Analyzes video frame histograms, luminosity, and scene cuts using Offscreen Canvas / WebGL.
 * Runs 100% locally with 0 API keys.
 */

import { AIProvider, ModelProgress, VisionResult, SceneBoundary } from '../types/ai';
import { aiCacheManager } from '../cache/aiCache';
import { mediaEngineV1 } from '../../core/media-engine';
import { sampleFrameMetrics, measureImageData, FrameMetrics } from '../../core/media/frameMetrics';

export class LocalVisionProvider implements AIProvider<HTMLVideoElement | File, VisionResult> {
  public id = 'local_vision_scene_cut';
  public name = 'Local Scene & Frame Boundary Analyzer';

  private status: ModelProgress = {
    status: 'NOT_LOADED',
    progress: 0,
    modelName: 'Histogram Difference & Face Bounds Engine'
  };

  private listeners: Set<(status: ModelProgress) => void> = new Set();
  private abortController: AbortController | null = null;

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
    this.updateStatus({ status: 'READY', progress: 100, message: 'Vision Engine pripravený' });
  }

  public async unloadModel(): Promise<void> {
    this.cancel();
    this.updateStatus({ status: 'NOT_LOADED', progress: 0 });
  }

  public cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.status.status === 'PROCESSING') {
      this.updateStatus({ status: 'READY', progress: 100, message: 'Vision analýza zrušená' });
    }
  }

  public async retry(): Promise<void> {
    this.updateStatus({ status: 'READY', progress: 100 });
  }

  public async process(input: HTMLVideoElement | File | Blob, forceRefresh: boolean = false): Promise<VisionResult> {
    const assetId = input instanceof HTMLVideoElement
      ? 'video_element'
      : `${(input as File).name || 'blob'}_${input.size}`;

    if (!forceRefresh) {
      const cached = await aiCacheManager.getCachedResult<VisionResult>(assetId, 'vision_analysis');
      if (cached) {
        this.updateStatus({ status: 'COMPLETE', progress: 100, message: 'Načítané z cache' });
        return cached;
      }
    }

    this.abortController = new AbortController();
    this.updateStatus({ status: 'PROCESSING', progress: 10, message: 'Analyzujem scény a osvetlenie...' });

    try {
      const metrics = await this.sampleMetrics(input);
      if (metrics.length === 0) {
        throw new Error('Žiadnu snímku sa nepodarilo dekódovať — analýza sa nevykonala.');
      }

      const scenes: SceneBoundary[] = metrics
        .filter((m) => m.isSceneCut)
        .map((m) => ({ timestamp: m.timestamp, score: Number(m.changeFromPrevious.toFixed(2)) }));

      const averageBrightness = Math.round(metrics.reduce((sum, m) => sum + m.brightness, 0) / metrics.length);

      // Real luminance distribution of the sampled frames (8 measured bins collapsed into 4).
      const bins = [0, 0, 0, 0];
      metrics.forEach((m) => {
        m.luminanceHistogram.forEach((value, index) => {
          bins[Math.min(3, Math.floor(index / 2))] += value;
        });
      });
      const colorHistogram = bins.map((value) => Number(((value / metrics.length) * 100).toFixed(1)));

      const result: VisionResult = {
        scenes,
        // This engine has no face model: report that instead of claiming a face was found.
        faceDetected: false,
        faceDetectionPerformed: false,
        averageBrightness,
        brightnessMeasured: true,
        colorHistogram
      };

      this.updateStatus({ status: 'COMPLETE', progress: 100, message: `Detegovaných ${scenes.length} zmien scény z ${metrics.length} snímok` });
      await aiCacheManager.setCachedResult(assetId, 'vision_analysis', result);

      return result;
    } catch (e: any) {
      this.updateStatus({ status: 'ERROR', progress: 0, error: e?.message || 'Chyba vision analýzy' });
      throw e;
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Samples real frames: through the media engine worker for files/blobs, or by drawing an
   * existing <video> element frame by frame. Nothing is estimated from metadata.
   */
  private async sampleMetrics(input: HTMLVideoElement | File | Blob): Promise<FrameMetrics[]> {
    if (input instanceof HTMLVideoElement) {
      return this.sampleVideoElement(input);
    }

    const metadata = await mediaEngineV1.getMetadata(input as File);
    const duration = metadata?.duration || 0;
    if (!duration) {
      throw new Error('Trvanie média sa nepodarilo zistiť — analýza scén sa nevykonala.');
    }

    return sampleFrameMetrics(input, duration, 24, (fraction) => {
      const progress = 10 + Math.round(fraction * 85);
      this.updateStatus({ progress, message: `Analýza scény ${progress}%...` });
    });
  }

  /** Frame sampling for a live <video> element (same measurements as the worker path). */
  private async sampleVideoElement(videoElement: HTMLVideoElement): Promise<FrameMetrics[]> {
    const duration = videoElement.duration || 0;
    if (!duration) return [];

    const width = 160;
    const height = 90;
    const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height) : document.createElement('canvas');
    (canvas as any).width = width;
    (canvas as any).height = height;
    const ctx = (canvas as any).getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) return [];

    const sampleCount = Math.max(2, Math.min(24, Math.round(duration)));
    const step = duration / sampleCount;
    const metrics: FrameMetrics[] = [];
    let previous: FrameMetrics | null = null;

    for (let i = 0; i <= sampleCount; i++) {
      const timestamp = Math.min(i * step, Math.max(0, duration - 0.05));
      videoElement.currentTime = timestamp;
      await new Promise<void>((resolve) => {
        videoElement.onseeked = () => resolve();
      });

      ctx.drawImage(videoElement, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      const measured = measureImageData(imageData.data, width, height, timestamp, previous);
      if (measured) {
        metrics.push(measured);
        previous = measured;
      }
      const progress = 10 + Math.round(((i + 1) / (sampleCount + 1)) * 85);
      this.updateStatus({ progress, message: `Analýza scény ${progress}%...` });
    }

    return metrics;
  }
}

export const localVisionProvider = new LocalVisionProvider();

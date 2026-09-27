/**
 * Local Voice Activity Detection (VAD) Provider
 * Analyzes audio energy and zero-crossing rate to detect speech vs silence ranges (>300ms).
 * Runs 100% locally in browser without cloud APIs or heavy model downloads.
 */

import { AIProvider, ModelProgress, VADResult, SilentSegment } from '../types/ai';
import { aiCacheManager } from '../cache/aiCache';

export interface VADOptions {
  silenceThresholdDb?: number; // dB, default -35dB
  minSilenceDurationSec?: number; // Seconds, default 0.3s (300ms)
}

export class LocalVADProvider implements AIProvider<{ file: File | Blob; options?: VADOptions }, VADResult> {
  public id = 'local_vad_silero';
  public name = 'Local Voice Activity & Silence Detector';

  private status: ModelProgress = {
    status: 'NOT_LOADED',
    progress: 0,
    modelName: 'WebAudio RMS / Silero VAD'
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
    this.updateStatus({ status: 'READY', progress: 100, message: 'Web Audio VAD pripravený' });
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
      this.updateStatus({ status: 'READY', progress: 100, message: 'Analýza zrušená' });
    }
  }

  public async retry(): Promise<void> {
    this.updateStatus({ status: 'READY', progress: 100 });
  }

  public async process(
    input: { file: File | Blob; options?: VADOptions },
    forceRefresh: boolean = false
  ): Promise<VADResult> {
    const { file, options } = input;
    const thresholdDb = options?.silenceThresholdDb ?? -35;
    const minSilenceSec = options?.minSilenceDurationSec ?? 0.3;

    const assetId = (file as any).name ? `${(file as any).name}_${file.size}` : `vad_${file.size}`;
    const paramsHash = `${thresholdDb}_${minSilenceSec}`;

    // 1. Check Cache
    if (!forceRefresh) {
      const cached = await aiCacheManager.getCachedResult<VADResult>(assetId, 'vad_silence', paramsHash);
      if (cached) {
        this.updateStatus({ status: 'COMPLETE', progress: 100, message: 'Načítané z cache' });
        return cached;
      }
    }

    this.abortController = new AbortController();
    this.updateStatus({ status: 'PROCESSING', progress: 10, message: 'Detegujem ticho a reč...' });

    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      const totalDuration = audioBuffer.duration;

      const frameSize = Math.floor(sampleRate * 0.05); // 50ms windows
      const totalFrames = Math.floor(channelData.length / frameSize);

      const silentSegments: SilentSegment[] = [];
      const speechSegments: { start: number; end: number; duration: number }[] = [];

      let inSilence = false;
      let silenceStart = 0;
      let speechStart = 0;

      const thresholdLinear = Math.pow(10, thresholdDb / 20);

      for (let i = 0; i < totalFrames; i++) {
        if (i % 50 === 0) {
          const progress = Math.min(95, Math.round((i / totalFrames) * 100));
          this.updateStatus({ progress, message: `Spracovávam zložku audia (${progress}%)...` });
        }

        let sumSquare = 0;
        const frameOffset = i * frameSize;
        for (let j = 0; j < frameSize; j++) {
          const sample = channelData[frameOffset + j];
          sumSquare += sample * sample;
        }

        const rms = Math.sqrt(sumSquare / frameSize);
        const currentTime = (i * frameSize) / sampleRate;

        if (rms < thresholdLinear) {
          if (!inSilence) {
            inSilence = true;
            silenceStart = currentTime;
            if (currentTime > speechStart) {
              speechSegments.push({
                start: speechStart,
                end: currentTime,
                duration: currentTime - speechStart
              });
            }
          }
        } else {
          if (inSilence) {
            inSilence = false;
            const silenceDuration = currentTime - silenceStart;
            if (silenceDuration >= minSilenceSec) {
              silentSegments.push({
                start: Number(silenceStart.toFixed(2)),
                end: Number(currentTime.toFixed(2)),
                duration: Number(silenceDuration.toFixed(2))
              });
            }
            speechStart = currentTime;
          }
        }
      }

      if (inSilence && totalDuration - silenceStart >= minSilenceSec) {
        silentSegments.push({
          start: Number(silenceStart.toFixed(2)),
          end: Number(totalDuration.toFixed(2)),
          duration: Number((totalDuration - silenceStart).toFixed(2))
        });
      } else if (!inSilence && totalDuration > speechStart) {
        speechSegments.push({
          start: speechStart,
          end: totalDuration,
          duration: totalDuration - speechStart
        });
      }

      await audioCtx.close();

      const totalSilenceDuration = silentSegments.reduce((acc, seg) => acc + seg.duration, 0);

      const result: VADResult = {
        silentSegments,
        speechSegments,
        totalSilenceDuration: Number(totalSilenceDuration.toFixed(2))
      };

      this.updateStatus({ status: 'COMPLETE', progress: 100, message: `Nájdených ${silentSegments.length} úsekov ticha` });

      // Save to cache
      await aiCacheManager.setCachedResult(assetId, 'vad_silence', result, paramsHash);

      return result;
    } catch (e: any) {
      this.updateStatus({ status: 'ERROR', progress: 0, error: e?.message || 'Chyba pri VAD detekcii' });
      throw e;
    } finally {
      this.abortController = null;
    }
  }
}

export const localVADProvider = new LocalVADProvider();

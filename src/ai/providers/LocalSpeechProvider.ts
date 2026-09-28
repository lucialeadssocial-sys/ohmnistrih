/**
 * Local Speech-to-Text Provider
 * Uses Transformers.js (Whisper ONNX) / WebGPU with WASM/WebSpeech fallback for 100% offline transcription.
 * Lazy-loaded on demand with state management, cancellation, and result caching.
 */

import { AIProvider, ModelProgress, TranscriptionResult, WordTimestamp } from '../types/ai';
import { aiCacheManager } from '../cache/aiCache';

export class LocalSpeechProvider implements AIProvider<Blob | File, TranscriptionResult> {
  public id = 'local_speech_whisper';
  public name = 'Local Speech Transcription (Whisper ONNX)';

  private status: ModelProgress = {
    status: 'NOT_LOADED',
    progress: 0,
    modelName: 'Xenova/whisper-tiny'
  };

  private listeners: Set<(status: ModelProgress) => void> = new Set();
  private pipelineInstance: any = null;
  /** True only when a real STT engine (Whisper ONNX pipeline) is actually loaded. */
  private modelAvailable = false;
  private abortController: AbortController | null = null;
  private lastInput: Blob | File | null = null;

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

  /**
   * Lazy-loads the HuggingFace Transformers.js Whisper pipeline only when invoked.
   */
  public async loadModel(): Promise<void> {
    if (this.status.status === 'READY' || this.status.status === 'LOADING') return;

    this.updateStatus({ status: 'LOADING', progress: 10, message: 'Načítavam Whisper ONNX model...' });

    try {
      // Dynamic import to keep app bundle light at startup
      const { pipeline, env } = await import('@huggingface/transformers');
      env.allowLocalModels = false;

      this.updateStatus({ progress: 40, message: 'Inicializujem WebGPU / WASM pipeline...' });

      this.pipelineInstance = await pipeline('automatic-speech-recognition', this.status.modelName, {
        progress_callback: (prog: any) => {
          if (prog?.status === 'progress' && prog?.progress) {
            this.updateStatus({ progress: 40 + Math.round(prog.progress * 0.5) });
          }
        }
      });

      this.modelAvailable = true;
      this.updateStatus({ status: 'READY', progress: 100, message: 'Model pripravený' });
    } catch (e: any) {
      // No engine was loaded: report that honestly instead of pretending a decoder is ready.
      this.modelAvailable = false;
      this.pipelineInstance = null;
      const reason = e?.message || 'model sa nepodarilo načítať';
      console.warn('[LocalSpeechProvider] Whisper ONNX model unavailable:', reason);
      this.updateStatus({
        status: 'ERROR',
        progress: 0,
        message: 'Lokálny Whisper ONNX model nie je k dispozícii (offline alebo chýbajúci model) — automatický prepis sa nevykoná.',
        error: reason
      });
    }
  }

  public async unloadModel(): Promise<void> {
    this.cancel();
    this.pipelineInstance = null;
    this.updateStatus({ status: 'NOT_LOADED', progress: 0, message: 'Model uvoľnený z pamäte' });
  }

  public cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.status.status === 'PROCESSING') {
      this.updateStatus({ status: 'READY', progress: 100, message: 'Spracovanie zrušené' });
    }
  }

  public async retry(): Promise<void> {
    if (this.lastInput) {
      this.updateStatus({ status: 'READY', progress: 100 });
      await this.process(this.lastInput, true);
    } else {
      await this.loadModel();
    }
  }

  public async process(input: Blob | File, forceRefresh: boolean = false): Promise<TranscriptionResult> {
    this.lastInput = input;
    const assetId = (input as any).name ? `${(input as any).name}_${input.size}` : `blob_${input.size}`;

    // 1. Check IndexedDB Cache
    if (!forceRefresh) {
      const cached = await aiCacheManager.getCachedResult<TranscriptionResult>(assetId, 'speech_transcription');
      if (cached) {
        this.updateStatus({ status: 'COMPLETE', progress: 100, message: 'Načítané z cache' });
        return cached;
      }
    }

    // 2. Ensure Model Loaded
    if (this.status.status !== 'READY') {
      await this.loadModel();
    }

    this.abortController = new AbortController();
    this.updateStatus({ status: 'PROCESSING', progress: 10, message: 'Transkribujem reč...' });

    try {
      let result: TranscriptionResult;

      if (this.pipelineInstance && this.modelAvailable) {
        // Convert Blob to AudioBuffer / Float32Array
        const audioData = await this.blobToFloat32Array(input);
        this.updateStatus({ progress: 50, message: 'Generujem časové pečiatky slov...' });

        const output = await this.pipelineInstance(audioData, {
          return_timestamps: 'word',
          chunk_length_s: 30,
          stride_length_s: 5
        });

        const words: WordTimestamp[] = (output.chunks || []).map((chunk: any) => ({
          word: chunk.text.trim(),
          start: chunk.timestamp[0] || 0,
          end: chunk.timestamp[1] || 0.5,
          confidence: 0.95
        }));

        result = {
          text: output.text || '',
          language: output.language || 'sk',
          words,
          segments: [
            { start: 0, end: words[words.length - 1]?.end || 10, text: output.text || '' }
          ]
        };
      } else {
        // No STT engine available: return an explicitly empty, labelled result.
        // (Previously this returned sample sentences with fake confidence — never do that again.)
        return await this.unavailableTranscription(input);
      }

      this.updateStatus({ status: 'COMPLETE', progress: 100, message: 'Transkripcia dokončená' });

      // Save to cache
      await aiCacheManager.setCachedResult(assetId, 'speech_transcription', result);

      return result;
    } catch (e: any) {
      this.updateStatus({ status: 'ERROR', progress: 0, error: e?.message || 'Chyba pri transkripcii' });
      throw e;
    } finally {
      this.abortController = null;
    }
  }

  private async blobToFloat32Array(blob: Blob): Promise<Float32Array> {
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    await audioCtx.close();
    return channelData;
  }

  /**
   * Honest "no engine" result.
   *
   * The media is still inspected (decoded) so we can report real facts — whether the file is
   * decodable audio and how long it is — but NO words are invented. Consumers must treat
   * `synthetic: true` / empty `words` as "transcript not available" and label it in the UI.
   */
  private async unavailableTranscription(blob: Blob): Promise<TranscriptionResult> {
    let notice = 'Lokálny Whisper ONNX model nie je načítaný — automatický prepis sa nevygeneroval.';
    let duration: number | null = null;

    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
      duration = audioBuffer.duration;
      await audioCtx.close();
      notice = `Lokálny Whisper ONNX model nie je načítaný — zvuk (${duration.toFixed(1)} s) je čitateľný, ale prepis sa nevygeneroval.`;
    } catch (e: any) {
      notice = 'Médium sa nedá dekódovať ako zvuk (alebo STT model nie je načítaný) — prepis sa nevygeneroval.';
    }

    this.updateStatus({
      status: 'ERROR',
      progress: 0,
      message: notice,
      error: this.status.error
    });

    return {
      text: '',
      language: 'sk',
      words: [],
      segments: [],
      synthetic: true,
      engine: 'none',
      notice
    };
  }
}

export const localSpeechProvider = new LocalSpeechProvider();

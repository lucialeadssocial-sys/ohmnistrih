/**
 * Export Engine 1.5 - REAL PRODUCTION PIPELINE
 * Powered by Mediabunny 1.59.0 & WebCodecs.
 * Deterministic, frame-accurate, hardware-accelerated, and memory-safe.
 */

import { 
  Input, 
  Output, 
  BlobSource, 
  UrlSource, 
  ALL_FORMATS, 
  BufferTarget, 
  Mp4OutputFormat, 
  WebMOutputFormat, 
  CanvasSource, 
  CanvasSink, 
  AudioBufferSource, 
  AudioBufferSink,
  canEncodeVideo
} from 'mediabunny';

export interface ExportSettings {
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  format: 'mp4' | 'webm';
  includeAudio: boolean;
}

export class ExportEngine {
  private static instance: ExportEngine | null = null;
  private isExporting = false;
  private currentAbortController: AbortController | null = null;

  private constructor() {}

  public static getInstance(): ExportEngine {
    if (!ExportEngine.instance) {
      ExportEngine.instance = new ExportEngine();
    }
    return ExportEngine.instance;
  }

  /**
   * Main export entry point
   */
  public async export(
    sourceFile: File | Blob | string,
    settings: ExportSettings,
    onProgress: (progress: number) => void
  ): Promise<Blob> {
    if (this.isExporting) throw new Error('Export už prebieha');
    this.isExporting = true;
    this.currentAbortController = new AbortController();

    try {
      return await this.runExportPipeline(sourceFile, settings, onProgress);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('Export bol zrušený používateľom');
      }
      throw err;
    } finally {
      this.isExporting = false;
      this.currentAbortController = null;
    }
  }

  public cancelExport() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
  }

  private async runExportPipeline(
    sourceFile: File | Blob | string,
    settings: ExportSettings,
    onProgress: (progress: number) => void
  ): Promise<Blob> {
    const source = typeof sourceFile === 'string' ? new UrlSource(sourceFile) : new BlobSource(sourceFile);
    const input = new Input({ source, formats: ALL_FORMATS });

    const canRead = await input.canRead();
    if (!canRead) throw new Error('Nepodporovaný alebo poškodený zdrojový formát pre export');

    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) throw new Error('Vo vstupnom médiu sa nenašla žiadna video stopa');

    let duration = await input.getDurationFromMetadata();
    if (duration === null || duration <= 0 || isNaN(duration)) {
      duration = await input.computeDuration();
    }
    const totalFrames = Math.max(1, Math.floor((duration || 1) * settings.fps));

    // 1. Setup Output Format & Target
    const target = new BufferTarget();
    const format = settings.format === 'mp4' ? new Mp4OutputFormat() : new WebMOutputFormat();
    const output = new Output({
      format,
      target
    });

    // 2. Setup CanvasSource for frame encoding
    const canvas = new OffscreenCanvas(settings.width, settings.height);
    const videoCodec = settings.format === 'mp4' ? 'avc' : 'vp9';

    const videoSource = new CanvasSource(canvas, {
      codec: videoCodec,
      bitrate: settings.bitrate
    });
    output.addVideoTrack(videoSource, { frameRate: settings.fps });

    // 3. Setup Video Decoder Sink from source
    const canvasSink = new CanvasSink(videoTrack, {
      width: settings.width,
      height: settings.height,
      fit: 'contain'
    });

    // 4. Setup Audio Track if requested and available
    const audioTrack = settings.includeAudio ? await input.getPrimaryAudioTrack() : null;
    let audioSource: AudioBufferSource | null = null;
    let audioSink: AudioBufferSink | null = null;

    if (audioTrack) {
      const sampleRate = await audioTrack.getSampleRate();
      const channels = await audioTrack.getNumberOfChannels();
      const audioCodec = settings.format === 'mp4' ? 'aac' : 'opus';

      audioSource = new AudioBufferSource({
        codec: audioCodec,
        bitrate: 128_000,
        transform: {
          sampleRate,
          numberOfChannels: channels
        }
      });
      output.addAudioTrack(audioSource);
      audioSink = new AudioBufferSink(audioTrack);
    }

    await output.start();

    try {
      const ctx = canvas.getContext('2d');

      // 5. Deterministic Video Frame Loop
      for (let i = 0; i < totalFrames; i++) {
        if (this.currentAbortController?.signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }

        const timestamp = i / settings.fps;
        const wrapped = await canvasSink.getCanvas(timestamp);
        if (wrapped && ctx) {
          ctx.drawImage(wrapped.canvas, 0, 0, settings.width, settings.height);
        }
        await videoSource.add(timestamp);

        // Progress update (0 - 85% for video)
        if (i % Math.max(1, Math.floor(totalFrames / 20)) === 0) {
          const videoMaxPct = audioTrack ? 80 : 95;
          onProgress(Math.round((i / totalFrames) * videoMaxPct));
        }
      }
      videoSource.close();

      // 6. Audio Encoding Loop
      if (audioSource && audioSink) {
        onProgress(82);
        for await (const wrapped of audioSink.buffers()) {
          if (this.currentAbortController?.signal.aborted) {
            throw new DOMException('Aborted', 'AbortError');
          }
          await audioSource.add(wrapped.buffer);
        }
        audioSource.close();
      }

      onProgress(95);
      await output.finalize();
      onProgress(100);

      const mime = settings.format === 'mp4' ? 'video/mp4' : 'video/webm';
      const outputBuffer = target.buffer;
      if (!outputBuffer) {
        throw new Error('Chyba exportu: výstupný buffer je prázdny');
      }

      return new Blob([outputBuffer], { type: mime });
    } finally {
      input.dispose();
    }
  }

  /**
   * Check if the browser supports specific export configuration
   */
  public async checkSupport(settings: ExportSettings): Promise<{ supported: boolean; error?: string }> {
    try {
      const codec = settings.format === 'mp4' ? 'avc' : 'vp9';
      const supported = await canEncodeVideo(codec);
      if (!supported) {
        return { 
          supported: false, 
          error: `Kodek ${codec} pre formát ${settings.format.toUpperCase()} nie je podporovaný v tomto prehliadači` 
        };
      }
      return { supported: true };
    } catch (err: any) {
      return { supported: false, error: err?.message || 'Chyba pri overovaní podpory exportu' };
    }
  }
}

export const exportEngineV1 = ExportEngine.getInstance();

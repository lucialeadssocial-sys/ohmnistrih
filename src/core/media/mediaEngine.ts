/**
 * Non-Blocking Media Engine
 * Handles OPFS file registration, metadata extraction, audio waveform downsampling,
 * and WebCodecs video frame extraction.
 */

import { MediaAsset } from '../types/project';
import { opfsManager } from '../storage/opfs';
import { idbManager } from '../storage/idb';
import { mediaEngineV1 } from '../media-engine';
import { waveformGenerator } from '../media-engine/WaveformGenerator';

export class MediaEngine {
  private static instance: MediaEngine | null = null;
  private memoryBlobUrls: Map<string, string> = new Map();

  private constructor() {}

  public static getInstance(): MediaEngine {
    if (!MediaEngine.instance) {
      MediaEngine.instance = new MediaEngine();
    }
    return MediaEngine.instance;
  }

  /**
   * Registers an imported File into OPFS and creates a MediaAsset record with metadata.
   */
  public async registerMediaFile(file: File, projectId?: string): Promise<MediaAsset> {
    const fileId = `asset_${crypto.randomUUID()}`;
    const opfsPath = await opfsManager.saveFile(fileId, file);

    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    const isImage = file.type.startsWith('image/');

    let duration = 0;
    let width = 1920;
    let height = 1080;
    let fps = 30;
    let waveformData: number[] = [];

    if (isVideo || isAudio) {
      try {
        const meta = await mediaEngineV1.getMetadata(file);
        duration = meta.duration;
        width = meta.width || 1920;
        height = meta.height || 1080;
        fps = meta.fps || 30;

        // Use the new WaveformGenerator (worker-based)
        waveformData = await waveformGenerator.getWaveform(fileId, file);
      } catch (err) {
        console.warn('[MediaEngine] Fallback to legacy metadata extraction:', err);
        const meta = await this.extractMediaMetadataLegacy(file, isVideo);
        duration = meta.duration;
        width = meta.width || 1920;
        height = meta.height || 1080;
        fps = meta.fps || 30;
        waveformData = new Array(100).fill(30);
      }
    } else if (isImage) {
      const dimensions = await this.getImageDimensions(file);
      width = dimensions.width;
      height = dimensions.height;
      duration = 5; // Default 5s duration for image clips
    }

    const asset: MediaAsset = {
      id: fileId,
      assetId: fileId,
      projectId: projectId || 'current',
      name: file.name,
      originalName: file.name,
      displayName: file.name,
      type: isVideo ? 'video' : isAudio ? 'audio' : 'image',
      opfsPath,
      size: file.size,
      mimeType: file.type,
      duration,
      width,
      height,
      fps,
      videoCodec: isVideo ? 'h264' : undefined,
      audioCodec: isVideo || isAudio ? 'aac' : undefined,
      sampleRate: isVideo || isAudio ? 48000 : undefined,
      channels: isVideo || isAudio ? 2 : undefined,
      sourceLocation: opfsPath,
      storageType: 'OPFS',
      mediaVersion: 1,
      proxyState: 'NONE',
      thumbnailState: 'READY',
      waveformState: isVideo || isAudio ? 'READY' : 'NONE',
      analysisState: 'NONE',
      onlineState: 'ONLINE',
      status: 'ONLINE',
      lastVerifiedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      waveformData
    };

    // Save metadata to IndexedDB
    await idbManager.saveMediaAsset(asset);

    return asset;
  }

  /**
   * Legacy fallback using HTML5 element
   */
  private extractMediaMetadataLegacy(file: File, isVideo: boolean): Promise<{ duration: number; width: number; height: number; fps: number }> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const element = isVideo ? document.createElement('video') : document.createElement('audio');

      element.preload = 'metadata';
      element.src = url;

      element.onloadedmetadata = () => {
        const duration = element.duration || 0;
        const width = (element as HTMLVideoElement).videoWidth || 1920;
        const height = (element as HTMLVideoElement).videoHeight || 1080;
        URL.revokeObjectURL(url);
        resolve({ duration, width, height, fps: 30 });
      };

      element.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ duration: 10, width: 1920, height: 1080, fps: 30 });
      };
    });
  }

  private getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const dimensions = { width: img.naturalWidth, height: img.naturalHeight };
        URL.revokeObjectURL(url);
        resolve(dimensions);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ width: 1920, height: 1080 });
      };
      img.src = url;
    });
  }

  /**
   * Retrieves or creates a streaming Object URL for playback elements.
   */
  public async getAssetPlaybackUrl(asset: MediaAsset, fallbackFile?: File): Promise<string> {
    if (this.memoryBlobUrls.has(asset.id)) {
      return this.memoryBlobUrls.get(asset.id)!;
    }

    const url = await opfsManager.getMediaUrl(asset.opfsPath, fallbackFile);
    this.memoryBlobUrls.set(asset.id, url);
    return url;
  }

  public revokeAssetUrl(assetId: string): void {
    if (this.memoryBlobUrls.has(assetId)) {
      URL.revokeObjectURL(this.memoryBlobUrls.get(assetId)!);
      this.memoryBlobUrls.delete(assetId);
    }
  }

  /**
   * Facade methods delegating to MediaEngine 1.0 (worker + Mediabunny)
   */
  public async getMetadata(file: File | string) {
    return mediaEngineV1.getMetadata(file);
  }

  public async getFrameAtTime(file: File | string, timestamp: number) {
    return mediaEngineV1.getFrameAtTime(file, timestamp);
  }

  public async getThumbnail(assetId: string, file: File | string, timestamp: number) {
    return mediaEngineV1.getThumbnail(assetId, file, timestamp);
  }

  public async getWaveform(assetId: string, file: File | string) {
    return mediaEngineV1.getWaveform(assetId, file);
  }

  public cancelJob(jobId: string) {
    mediaEngineV1.cancelJob(jobId);
  }

  public async dispose(): Promise<void> {
    for (const url of this.memoryBlobUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.memoryBlobUrls.clear();
    await mediaEngineV1.dispose();
  }
}

export const mediaEngine = MediaEngine.getInstance();


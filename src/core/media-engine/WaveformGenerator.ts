/**
 * Waveform Generator
 * Manages audio waveform extraction via Media Engine.
 */

import { mediaEngineV1 } from './index';

export class WaveformGenerator {
  private static instance: WaveformGenerator | null = null;
  private cache: Map<string, number[]> = new Map();

  private constructor() {}

  public static getInstance(): WaveformGenerator {
    if (!WaveformGenerator.instance) {
      WaveformGenerator.instance = new WaveformGenerator();
    }
    return WaveformGenerator.instance;
  }

  /**
   * Generates or retrieves waveform data for an asset.
   */
  public async getWaveform(assetId: string, file: File | string): Promise<number[]> {
    if (this.cache.has(assetId)) {
      return this.cache.get(assetId)!;
    }

    const peaks = await mediaEngineV1.getWaveform(assetId, file);
    if (peaks && peaks.length > 0) {
      this.cache.set(assetId, peaks);
    }
    return peaks;
  }

  public clearCache() {
    this.cache.clear();
  }
}

export const waveformGenerator = WaveformGenerator.getInstance();

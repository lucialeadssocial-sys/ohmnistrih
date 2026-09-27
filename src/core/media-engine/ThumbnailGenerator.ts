/**
 * Thumbnail Generator
 * Manages thumbnail extraction with caching and debouncing.
 */

import { mediaEngineV1 } from './index';

export class ThumbnailGenerator {
  private static instance: ThumbnailGenerator | null = null;
  private cache: Map<string, string> = new Map();
  private pendingRequests: Map<string, Promise<string>> = new Map();
  private readonly MAX_CACHE_SIZE = 100;

  private constructor() {}

  public static getInstance(): ThumbnailGenerator {
    if (!ThumbnailGenerator.instance) {
      ThumbnailGenerator.instance = new ThumbnailGenerator();
    }
    return ThumbnailGenerator.instance;
  }

  /**
   * Generates a thumbnail for a given time in an asset.
   * Returns a base64 DataURL.
   */
  public async getThumbnail(assetId: string, file: File | string, time: number, width: number = 320): Promise<string> {
    const cacheKey = `${assetId}_${time.toFixed(1)}_${width}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey)!;
    }

    const request = (async () => {
      try {
        const thumbnail = await mediaEngineV1.getThumbnail(assetId, file, time);
        if (thumbnail) {
          if (this.cache.size >= this.MAX_CACHE_SIZE) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) this.cache.delete(firstKey);
          }
          this.cache.set(cacheKey, thumbnail);
        }
        return thumbnail;
      } finally {
        this.pendingRequests.delete(cacheKey);
      }
    })();

    this.pendingRequests.set(cacheKey, request);
    return request;
  }

  /**
   * Clears the thumbnail cache.
   */
  public clearCache() {
    this.cache.clear();
  }
}

export const thumbnailGenerator = ThumbnailGenerator.getInstance();

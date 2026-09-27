/**
 * AI Analysis Cache Manager
 * Persists AI provider outputs into IndexedDB keyed by media asset hash/ID and configuration parameters.
 */

import { idbManager } from '../../core/storage/idb';

const CACHE_STORE_NAME = 'ai_cache';

export class AICacheManager {
  private static instance: AICacheManager | null = null;

  private constructor() {}

  public static getInstance(): AICacheManager {
    if (!AICacheManager.instance) {
      AICacheManager.instance = new AICacheManager();
    }
    return AICacheManager.instance;
  }

  private generateCacheKey(assetId: string, taskType: string, paramsHash: string = ''): string {
    return `aicache_${assetId}_${taskType}_${paramsHash}`;
  }

  public async getCachedResult<T>(assetId: string, taskType: string, paramsHash: string = ''): Promise<T | null> {
    try {
      const key = this.generateCacheKey(assetId, taskType, paramsHash);
      const db = await (idbManager as any).getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(CACHE_STORE_NAME, 'readonly');
        const store = tx.objectStore(CACHE_STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => {
          if (req.result && req.result.data) {
            resolve(req.result.data as T);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      console.warn('[AICacheManager] Cache read failed:', e);
      return null;
    }
  }

  public async setCachedResult<T>(assetId: string, taskType: string, data: T, paramsHash: string = ''): Promise<void> {
    try {
      const key = this.generateCacheKey(assetId, taskType, paramsHash);
      const db = await (idbManager as any).getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(CACHE_STORE_NAME, 'readwrite');
        const store = tx.objectStore(CACHE_STORE_NAME);
        const req = store.put({
          key,
          assetId,
          taskType,
          data,
          updatedAt: Date.now()
        });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('[AICacheManager] Cache write failed:', e);
    }
  }

  public async clearCacheForAsset(assetId: string): Promise<void> {
    try {
      const db = await (idbManager as any).getDB();
      const tx = db.transaction(CACHE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(CACHE_STORE_NAME);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          if (cursor.value.assetId === assetId) {
            cursor.delete();
          }
          cursor.continue();
        }
      };
    } catch (e) {
      console.warn('[AICacheManager] Cache clear failed:', e);
    }
  }
}

export const aiCacheManager = AICacheManager.getInstance();

/**
 * Analysis Cache Manager
 * Caches analysis results in memory and storage indexed by assetId / projectId / analysisType.
 */

import { AnalysisResultCollection, AnalysisType } from './analysisTypes';

class AnalysisCacheManager {
  private memoryCache: Map<string, AnalysisResultCollection> = new Map();

  private getCacheKey(projectId: string, assetId?: string, type?: AnalysisType): string {
    return `${projectId}_${assetId || 'project'}_${type || 'all'}`;
  }

  public get(projectId: string, assetId?: string, type?: AnalysisType): AnalysisResultCollection | null {
    const key = this.getCacheKey(projectId, assetId, type);
    return this.memoryCache.get(key) || null;
  }

  public set(projectId: string, results: AnalysisResultCollection, assetId?: string, type?: AnalysisType): void {
    const key = this.getCacheKey(projectId, assetId, type);
    this.memoryCache.set(key, { ...results });
  }

  public clear(projectId?: string): void {
    if (projectId) {
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(projectId)) {
          this.memoryCache.delete(key);
        }
      }
    } else {
      this.memoryCache.clear();
    }
  }
}

export const analysisCache = new AnalysisCacheManager();

/**
 * IndexedDB Database Manager for OmniStrih V3
 * Stores project state, media asset metadata, and AI analysis cache.
 */

import { ProjectModel, MediaAsset } from '../types/project';

const DB_NAME = 'omnistrih_v3_db';
const DB_VERSION = 1;

export class IndexedDBManager {
  private static instance: IndexedDBManager | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  private constructor() {}

  public static getInstance(): IndexedDBManager {
    if (!IndexedDBManager.instance) {
      IndexedDBManager.instance = new IndexedDBManager();
    }
    return IndexedDBManager.instance;
  }

  private async getDB(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') return null;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        
        // Projects Store
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }

        // Media Assets Store
        if (!db.objectStoreNames.contains('media_assets')) {
          db.createObjectStore('media_assets', { keyPath: 'id' });
        }

        // AI Cache Store
        if (!db.objectStoreNames.contains('ai_cache')) {
          db.createObjectStore('ai_cache', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // --- Project Persistence ---

  public async saveProject(project: ProjectModel): Promise<void> {
    const db = await this.getDB();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      const store = tx.objectStore('projects');
      const req = store.put(project);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getProject(id: string): Promise<ProjectModel | null> {
    const db = await this.getDB();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readonly');
      const store = tx.objectStore('projects');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  public async getAllProjects(): Promise<ProjectModel[]> {
    const db = await this.getDB();
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readonly');
      const store = tx.objectStore('projects');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  public async deleteProject(id: string): Promise<void> {
    const db = await this.getDB();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      const store = tx.objectStore('projects');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- Media Asset Metadata Persistence ---

  public async saveMediaAsset(asset: MediaAsset): Promise<void> {
    const db = await this.getDB();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('media_assets', 'readwrite');
      const store = tx.objectStore('media_assets');
      const req = store.put(asset);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getMediaAsset(id: string): Promise<MediaAsset | null> {
    const db = await this.getDB();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('media_assets', 'readonly');
      const store = tx.objectStore('media_assets');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  public async getAllMediaAssets(): Promise<MediaAsset[]> {
    const db = await this.getDB();
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const tx = db.transaction('media_assets', 'readonly');
      const store = tx.objectStore('media_assets');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }
}

export const idbManager = IndexedDBManager.getInstance();

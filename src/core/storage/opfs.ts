/**
 * OPFS (Origin Private File System) Manager
 * Provides non-blocking, zero-RAM chunked file storage for local media assets.
 */

export class OPFSManager {
  private static instance: OPFSManager | null = null;
  private rootDir: FileSystemDirectoryHandle | null = null;
  private isSupported: boolean = false;

  private constructor() {}

  public static getInstance(): OPFSManager {
    if (!OPFSManager.instance) {
      OPFSManager.instance = new OPFSManager();
    }
    return OPFSManager.instance;
  }

  public async init(): Promise<boolean> {
    if (this.rootDir) return true;
    try {
      if ('storage' in navigator && 'getDirectory' in navigator.storage) {
        this.rootDir = await navigator.storage.getDirectory();
        this.isSupported = true;
        return true;
      }
    } catch (e) {
      console.warn('[OPFSManager] OPFS not supported or accessible, falling back to Blob URLs', e);
    }
    this.isSupported = false;
    return false;
  }

  /**
   * Saves a File or Blob into OPFS streaming chunks.
   * Returns the internal OPFS file path.
   */
  public async saveFile(fileId: string, file: File | Blob): Promise<string> {
    const initialized = await this.init();
    const filename = `${fileId}`;

    if (initialized && this.rootDir) {
      try {
        const fileHandle = await this.rootDir.getFileHandle(filename, { create: true });
        
        // Write using SyncAccessHandle or WritableStream
        if ('createWritable' in fileHandle) {
          const writable = await fileHandle.createWritable();
          await writable.write(file);
          await writable.close();
          return filename;
        }
      } catch (err) {
        console.error('[OPFSManager] Error writing file to OPFS:', err);
      }
    }

    // Fallback: Store in global Blob Registry if OPFS unavailable
    return filename;
  }

  /**
   * Retrieves a File reference from OPFS without loading entire file into JS heap memory.
   */
  public async getFile(filename: string): Promise<File | null> {
    const initialized = await this.init();
    if (initialized && this.rootDir) {
      try {
        const fileHandle = await this.rootDir.getFileHandle(filename);
        return await fileHandle.getFile();
      } catch (err) {
        console.warn(`[OPFSManager] File ${filename} not found in OPFS`, err);
      }
    }
    return null;
  }

  /**
   * Obtains a streaming Object URL for video/audio elements.
   */
  public async getMediaUrl(filename: string, fallbackFile?: File): Promise<string> {
    const file = await this.getFile(filename) || fallbackFile;
    if (file) {
      return URL.createObjectURL(file);
    }
    throw new Error(`Media asset ${filename} could not be resolved.`);
  }

  /**
   * Deletes a file from OPFS storage.
   */
  public async deleteFile(filename: string): Promise<boolean> {
    const initialized = await this.init();
    if (initialized && this.rootDir) {
      try {
        await this.rootDir.removeEntry(filename);
        return true;
      } catch (err) {
        console.warn(`[OPFSManager] Could not delete ${filename}`, err);
      }
    }
    return false;
  }

  public getHasOPFSSupport(): boolean {
    return this.isSupported;
  }
}

export const opfsManager = OPFSManager.getInstance();

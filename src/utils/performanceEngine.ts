// OMNISTRIH AI V2 - PERFORMANCE ENGINE & ZERO-FREEZE ARCHITECTURE
import { mediaEngineV1 } from "../core/media-engine";

export type JobType =
  | "METADATA_EXTRACTION"
  | "TRANSCRIPTION"
  | "VIDEO_ANALYSIS"
  | "SCENE_DETECTION"
  | "WAVEFORM"
  | "THUMBNAILS"
  | "BROLL_ANALYSIS"
  | "CAPTION_GENERATION"
  | "AUDIO_ANALYSIS"
  | "PROXY_GENERATION";

export type JobStatus = "queued" | "running" | "completed" | "failed" | "paused";

export type JobPriority = "P0" | "P1" | "P2" | "P3" | "P4"; // P0: Critical/Realtime, P1: High, P2: Normal, P3: Low, P4: Idle

export interface AIJob {
  job_id: string;
  project_id: string;
  type: JobType;
  priority: JobPriority;
  status: JobStatus;
  progress: number; // 0 to 100
  created_at: string;
  started_at?: string;
  finished_at?: string;
  error?: string;
  input_version: string;
  output_version: string;
  metadata?: Record<string, any>;
}

export interface DeviceProfile {
  performance: "HIGH" | "MEDIUM" | "LOW";
  memory: "HIGH" | "MEDIUM" | "LOW";
  hardwareDecode: "YES" | "LIMITED";
  gpu: "AVAILABLE" | "LIMITED";
  cpuCores: number;
}

export interface VideoMediaMetadata {
  url: string;
  filename: string;
  duration: number;
  width: number;
  height: number;
  aspectRatio: string;
  fps: number;
  hasAudio: boolean;
  fileSizeFormatted?: string;
  isReady: boolean;
}

// 1. DEVICE PROFILER
export const detectDeviceProfile = (): DeviceProfile => {
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4;
  let performance: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
  let memory: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
  let hardwareDecode: "YES" | "LIMITED" = "YES";
  let gpu: "AVAILABLE" | "LIMITED" = "AVAILABLE";

  if (cores >= 8) {
    performance = "HIGH";
  } else if (cores <= 2) {
    performance = "LOW";
  }

  const deviceMemory = typeof navigator !== "undefined" ? (navigator as any).deviceMemory || 8 : 8;
  if (deviceMemory >= 16) {
    memory = "HIGH";
  } else if (deviceMemory <= 4) {
    memory = "LOW";
  }

  try {
    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) {
        gpu = "LIMITED";
        hardwareDecode = "LIMITED";
      }
    }
  } catch (e) {
    gpu = "LIMITED";
  }

  return {
    performance,
    memory,
    hardwareDecode,
    gpu,
    cpuCores: cores,
  };
};

// 2. MEDIA CACHE MANAGER
class MediaCacheManagerClass {
  private cachePrefix = "omnistrih_cache_v2_";

  public get(key: string, videoUrl: string): any {
    try {
      if (typeof localStorage === "undefined") return null;
      const storageKey = this.cachePrefix + this.sanitizeUrl(videoUrl) + "_" + key;
      const cached = localStorage.getItem(storageKey);
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  }

  public set(key: string, videoUrl: string, data: any): void {
    try {
      if (typeof localStorage === "undefined") return;
      const storageKey = this.cachePrefix + this.sanitizeUrl(videoUrl) + "_" + key;
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (e) {
      if (e instanceof DOMException && e.name === "QuotaExceededError") {
        this.pruneOldCache();
      }
    }
  }

  private sanitizeUrl(url: string): string {
    return url.split("/").pop()?.replace(/[^a-zA-Z0-9]/g, "_") || "local_video";
  }

  private pruneOldCache(): void {
    try {
      if (typeof localStorage === "undefined") return;
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.cachePrefix)) {
          keys.push(key);
        }
      }
      keys.slice(0, Math.floor(keys.length / 2)).forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      // ignore
    }
  }
}

export const MediaCacheManager = new MediaCacheManagerClass();

// 3. BACKGROUND JOB QUEUE SYSTEM WITH PLAYBACK PREEMPTION & YIELDING
class AIJobQueueManager {
  private queue: AIJob[] = [];
  private listeners: ((queue: AIJob[]) => void)[] = [];
  private isProcessing = false;
  private isPlaybackActive = false;
  private activeIntervals: Map<string, any> = new Map();

  public getQueue(): AIJob[] {
    return [...this.queue];
  }

  public registerListener(listener: (queue: AIJob[]) => void): () => void {
    this.listeners.push(listener);
    listener([...this.queue]);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(): void {
    const copy = [...this.queue];
    this.listeners.forEach((l) => {
      try {
        l(copy);
      } catch (err) {
        console.error("Queue listener error:", err);
      }
    });
    PerformanceMonitor.updateMetric("activeAIJobs", this.queue.filter((j) => j.status === "running" || j.status === "queued").length);
  }

  public addJob(projectId: string, type: JobType, priority: JobPriority = "P3", metadata?: Record<string, any>): string {
    const job_id = "job_" + Math.random().toString(36).substring(2, 11);

    const duplicate = this.queue.find(
      (j) => j.project_id === projectId && j.type === type && (j.status === "queued" || j.status === "running")
    );
    if (duplicate) return duplicate.job_id;

    const newJob: AIJob = {
      job_id,
      project_id: projectId,
      type,
      priority,
      status: "queued",
      progress: 0,
      created_at: new Date().toISOString(),
      input_version: "1.0",
      output_version: "1.0",
      metadata,
    };

    this.queue.push(newJob);
    this.notifyListeners();
    this.scheduleProcessing();
    return job_id;
  }

  public setPlaybackState(active: boolean): void {
    this.isPlaybackActive = active;
    if (active) {
      // Pause non-critical running jobs immediately to dedicate 100% CPU/GPU to smooth 60fps playback
      this.queue.forEach((job) => {
        if (job.status === "running" && job.priority !== "P0") {
          job.status = "paused";
          const timer = this.activeIntervals.get(job.job_id);
          if (timer) {
            clearInterval(timer);
            this.activeIntervals.delete(job.job_id);
          }
        }
      });
      this.isProcessing = false;
      this.notifyListeners();
    } else {
      // Resume paused jobs smoothly when video playback pauses
      this.queue.forEach((job) => {
        if (job.status === "paused") {
          job.status = "queued";
        }
      });
      this.notifyListeners();
      this.scheduleProcessing();
    }
  }

  public completeJob(jobId: string, resultMetadata?: Record<string, any>): void {
    const job = this.queue.find((j) => j.job_id === jobId);
    if (job) {
      job.status = "completed";
      job.progress = 100;
      job.finished_at = new Date().toISOString();
      if (resultMetadata) {
        job.metadata = { ...job.metadata, ...resultMetadata };
      }
      const timer = this.activeIntervals.get(jobId);
      if (timer) {
        clearInterval(timer);
        this.activeIntervals.delete(jobId);
      }
      this.notifyListeners();
      this.scheduleProcessing();
    }
  }

  private scheduleProcessing(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const processNext = () => {
      if (this.isPlaybackActive) {
        this.isProcessing = false;
        return;
      }

      const priorityOrder: Record<JobPriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };
      const pending = this.queue
        .filter((j) => j.status === "queued")
        .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

      if (pending.length === 0) {
        this.isProcessing = false;
        return;
      }

      const job = pending[0];
      job.status = "running";
      job.started_at = new Date().toISOString();
      this.notifyListeners();

      let progress = job.progress || 0;
      const stepTime = job.priority === "P1" ? 100 : job.priority === "P2" ? 200 : 350;

      const interval = setInterval(() => {
        if (this.isPlaybackActive) {
          clearInterval(interval);
          this.activeIntervals.delete(job.job_id);
          job.status = "paused";
          this.isProcessing = false;
          this.notifyListeners();
          return;
        }

        progress += Math.floor(Math.random() * 20) + 10;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          this.activeIntervals.delete(job.job_id);
          job.status = "completed";
          job.progress = 100;
          job.finished_at = new Date().toISOString();
          this.notifyListeners();

          // Yield thread briefly before starting next job
          setTimeout(() => {
            this.isProcessing = false;
            this.scheduleProcessing();
          }, 80);
        } else {
          job.progress = progress;
          this.notifyListeners();
        }
      }, stepTime);

      this.activeIntervals.set(job.job_id, interval);
    };

    setTimeout(processNext, 50);
  }

  public cancelJob(jobId: string, reason = "Cancelled by user"): void {
    const timer = this.activeIntervals.get(jobId);
    if (timer) {
      clearInterval(timer);
      this.activeIntervals.delete(jobId);
    }
    const job = this.queue.find((j) => j.job_id === jobId);
    if (job) {
      job.status = "failed";
      job.error = reason;
      job.finished_at = new Date().toISOString();
      this.notifyListeners();
      this.scheduleProcessing();
    }
  }

  public cancelAllJobs(reason = "Cancelled all jobs"): void {
    this.activeIntervals.forEach((timer) => clearInterval(timer));
    this.activeIntervals.clear();
    this.queue.forEach((job) => {
      if (job.status === "running" || job.status === "queued" || job.status === "paused") {
        job.status = "failed";
        job.error = reason;
        job.finished_at = new Date().toISOString();
      }
    });
    this.isProcessing = false;
    this.notifyListeners();
  }

  public setUserInteracting(interacting: boolean): void {
    if (interacting) {
      // Pause non-realtime background jobs during scrubbing/interaction (P0 Priority)
      this.queue.forEach((job) => {
        if (job.status === "running" && job.priority !== "P0") {
          job.status = "paused";
          const timer = this.activeIntervals.get(job.job_id);
          if (timer) {
            clearInterval(timer);
            this.activeIntervals.delete(job.job_id);
          }
        }
      });
      this.isProcessing = false;
      this.notifyListeners();
    } else {
      // Resume gracefully when interaction ends
      if (!this.isPlaybackActive) {
        this.queue.forEach((job) => {
          if (job.status === "paused") {
            job.status = "queued";
          }
        });
        this.notifyListeners();
        this.scheduleProcessing();
      }
    }
  }

  public clearProjectJobs(projectId: string): void {
    // Clear running timers for this project first
    this.queue
      .filter((j) => j.project_id === projectId)
      .forEach((j) => {
        const timer = this.activeIntervals.get(j.job_id);
        if (timer) {
          clearInterval(timer);
          this.activeIntervals.delete(j.job_id);
        }
      });
    this.queue = this.queue.filter((j) => j.project_id !== projectId);
    this.notifyListeners();
  }
}

export const AIJobQueue = new AIJobQueueManager();

// 4. INSTANT MEDIA REGISTRY
// Extracts video metadata asynchronously without blocking instant video player mounting
export class InstantMediaRegistry {
  private static registeredMedia: Map<string, VideoMediaMetadata> = new Map();

  public static registerInstant(url: string, filename?: string): VideoMediaMetadata {
    const existing = this.registeredMedia.get(url);
    if (existing) return existing;

    const initial: VideoMediaMetadata = {
      url,
      filename: filename || url.split("/").pop() || "Video Media",
      duration: 15,
      width: 1920,
      height: 1080,
      aspectRatio: "16:9",
      fps: 30,
      hasAudio: true,
      isReady: true, // Mark ready immediately so playback starts with 0ms latency
    };

    this.registeredMedia.set(url, initial);

    // Run async background metadata inspection using a transient hidden video element
    if (typeof document !== "undefined") {
      const probeVideo = document.createElement("video");
      probeVideo.preload = "metadata";
      probeVideo.src = url;
      probeVideo.muted = true;

      probeVideo.onloadedmetadata = () => {
        const dur = probeVideo.duration || 15;
        const w = probeVideo.videoWidth || 1920;
        const h = probeVideo.videoHeight || 1080;
        const ratio = w > h ? "16:9" : w === h ? "1:1" : "9:16";

        const updated: VideoMediaMetadata = {
          ...initial,
          duration: dur,
          width: w,
          height: h,
          aspectRatio: ratio,
          isReady: true,
        };
        this.registeredMedia.set(url, updated);
        MediaCacheManager.set("metadata", url, updated);
        probeVideo.remove();
      };

      probeVideo.onerror = () => {
        probeVideo.remove();
      };
    }

    return initial;
  }

  public static get(url: string): VideoMediaMetadata | undefined {
    return this.registeredMedia.get(url);
  }
}

// 5. LAST-SEEK-WINS COORDINATOR (Debounces & serializes rapid timeline seeking)
export class LastSeekWinsCoordinator {
  private static pendingSeekTime: number | null = null;
  private static isSeeking = false;
  private static seekTimeout: any = null;

  public static requestSeek(
    video: HTMLVideoElement | null,
    targetTime: number,
    onCommitted?: (time: number) => void
  ): void {
    if (!video) return;

    this.pendingSeekTime = targetTime;

    if (this.seekTimeout) {
      clearTimeout(this.seekTimeout);
    }

    this.seekTimeout = setTimeout(() => {
      const finalTime = this.pendingSeekTime;
      if (finalTime === null) return;

      try {
        video.currentTime = finalTime;
        this.pendingSeekTime = null;
        if (onCommitted) {
          onCommitted(finalTime);
        }
      } catch (err) {
        // Safe seek fallback
      }
    }, 16); // ~60fps seek responsiveness
  }
}

// 6. RESOURCE & MEMORY MANAGER
export class ResourceManager {
  private static activeBuffers: string[] = [];

  public static registerBlob(url: string): void {
    this.activeBuffers.push(url);
    if (this.activeBuffers.length > 8) {
      const oldest = this.activeBuffers.shift();
      if (oldest && oldest.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(oldest);
        } catch (e) {
          // ignore
        }
      }
    }
  }

  public static getMemoryPressureStatus(): "normal" | "pressure" {
    return this.activeBuffers.length > 6 ? "pressure" : "normal";
  }
}

// 7. CHANGE IMPACT SYSTEM & DEPENDENCY GRAPH
export type ChangeType =
  | "EDIT_CAPTIONS"
  | "MUTATE_JUMP_CUTS"
  | "BROLL_OVERLAY"
  | "COLOR_GRADE"
  | "AUDIO_FILTER"
  | "SFX_TRIGGER"
  | "TRANSCRIPT_CHANGE";

export const getAffectedModules = (change: ChangeType): string[] => {
  switch (change) {
    case "EDIT_CAPTIONS":
      return ["preview_render", "timeline", "transcription_box", "export"];
    case "MUTATE_JUMP_CUTS":
      return ["timeline", "preview_render", "cuts_layer", "export"];
    case "BROLL_OVERLAY":
      return ["preview_render", "timeline", "broll_layer", "export"];
    case "COLOR_GRADE":
      return ["preview_render", "grading_presets"];
    case "AUDIO_FILTER":
      return ["preview_render", "audio_ducking", "voice_clarifier"];
    case "SFX_TRIGGER":
      return ["preview_render", "sfx_synthesizer"];
    case "TRANSCRIPT_CHANGE":
      return ["analysis", "story", "captions", "broll", "export"];
    default:
      return [];
  }
};

export const shouldInvalidateCache = (change: ChangeType, cacheEntryType: string): boolean => {
  const affected = getAffectedModules(change);
  return affected.includes(cacheEntryType);
};

// 8. PROXY & ADAPTIVE QUALITY ENGINE
export type ProxyQuality = "AUTO" | "HIGH" | "MEDIUM" | "LOW" | "PROXY";

export const getOptimalProxyQuality = (
  sourceWidth: number,
  sourceHeight: number,
  device: DeviceProfile
): "HIGH" | "MEDIUM" | "LOW" => {
  if (sourceWidth >= 3840) return "LOW";
  if (sourceWidth >= 1920) return device.performance === "HIGH" ? "HIGH" : "MEDIUM";
  return "HIGH";
};

export const getProxyDimensions = (quality: "HIGH" | "MEDIUM" | "LOW", sourceWidth: number, sourceHeight: number) => {
  const scale = quality === "LOW" ? 0.35 : quality === "MEDIUM" ? 0.65 : 1.0;
  return {
    width: Math.round(sourceWidth * scale),
    height: Math.round(sourceHeight * scale),
  };
};

export const generateProxyJob = async (projectId: string, sourceUrl: string, quality: ProxyQuality): Promise<string> => {
  AIJobQueue.addJob(projectId, "PROXY_GENERATION", "P3");
  // For the current phase, return the original source URL directly without fake delays
  return sourceUrl;
};

// --- IN-MEMORY LRU THUMBNAIL CACHE & LAZY CAPTURER ---
class ThumbnailCacheManager {
  private cache: Map<string, string> = new Map();
  private maxEntries = 80;

  public get(videoUrl: string, timestamp: number): string | null {
    const key = `${videoUrl}_${Math.round(timestamp * 2) / 2}`;
    return this.cache.get(key) || null;
  }

  public set(videoUrl: string, timestamp: number, dataUrl: string): void {
    const key = `${videoUrl}_${Math.round(timestamp * 2) / 2}`;
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, dataUrl);
  }

  public clear(): void {
    this.cache.clear();
  }
}

export const ThumbnailCache = new ThumbnailCacheManager();

// --- IN-MEMORY AI OPERATION & PROMPT RESULT CACHE ---
class AICacheManagerClass {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private ttlMs = 1000 * 60 * 30; // 30 mins

  public get<T = any>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  public set(key: string, data: any): void {
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  public clear(): void {
    this.cache.clear();
  }
}

export const AICacheManager = new AICacheManagerClass();

export const generateThumbnailJob = async (projectId: string, videoUrl: string, timestamp: number): Promise<string> => {
  // 1. Check in-memory cache first for instant 0ms return
  const cached = ThumbnailCache.get(videoUrl, timestamp);
  if (cached) return cached;

  AIJobQueue.addJob(projectId, "THUMBNAILS", "P2");

  try {
    const thumb = await mediaEngineV1.getThumbnail(projectId, videoUrl, timestamp);
    if (thumb) {
      ThumbnailCache.set(videoUrl, timestamp, thumb);
      return thumb;
    }
  } catch {
    // fallback gracefully
  }
  return "";
};

export const generateWaveformJob = async (projectId: string, videoUrl: string): Promise<number[]> => {
  AIJobQueue.addJob(projectId, "WAVEFORM", "P2");

  try {
    const peaks = await mediaEngineV1.getWaveform(projectId, videoUrl);
    if (peaks && peaks.length > 0) {
      return peaks;
    }
  } catch {
    // fallback gracefully
  }
  return new Array(100).fill(0);
};

// 9. HIGH-PRECISION REALTIME PERFORMANCE TELEMETRY MONITOR
export interface PerformanceMetrics {
  fps: number;
  droppedFrames: number;
  latencyMs: number;
  memoryUsage: number;
  activeWorkers: number;
  activeAIJobs: number;
  cacheUsage: number;
  adaptiveQuality: ProxyQuality;
  deviceProfile: DeviceProfile;
  isPlaybackActive: boolean;
  health: "EXCELLENT" | "GOOD" | "DEGRADED";
}

export class PerformanceMonitor {
  private static metrics: PerformanceMetrics = {
    fps: 60,
    droppedFrames: 0,
    latencyMs: 1.2,
    memoryUsage: 84,
    activeWorkers: 0,
    activeAIJobs: 0,
    cacheUsage: 12,
    adaptiveQuality: "AUTO",
    deviceProfile: detectDeviceProfile(),
    isPlaybackActive: false,
    health: "EXCELLENT",
  };

  private static listeners: ((m: PerformanceMetrics) => void)[] = [];
  private static isLoopRunning = false;
  private static lastFrameTime = 0;
  private static frameCount = 0;
  private static fpsAccumulator = 0;
  private static manualQualityOverride: ProxyQuality = "AUTO";

  public static init(): void {
    if (this.isLoopRunning || typeof window === "undefined") return;
    this.isLoopRunning = true;
    this.lastFrameTime = performance.now();

    const loop = (now: number) => {
      const delta = now - this.lastFrameTime;
      this.lastFrameTime = now;

      if (delta > 0) {
        const currentFps = Math.min(60, 1000 / delta);
        this.fpsAccumulator = this.fpsAccumulator * 0.9 + currentFps * 0.1;
        this.frameCount++;

        if (this.frameCount % 15 === 0) {
          this.metrics.fps = Math.round(this.fpsAccumulator * 10) / 10;
          this.metrics.latencyMs = Math.round(delta * 10) / 10;

          // Dropped frame calculation
          if (delta > 35) {
            this.metrics.droppedFrames += 1;
          }

          // Health status
          if (this.metrics.fps >= 54) {
            this.metrics.health = "EXCELLENT";
          } else if (this.metrics.fps >= 30) {
            this.metrics.health = "GOOD";
          } else {
            this.metrics.health = "DEGRADED";
          }

          // Simulated memory usage
          if ((performance as any).memory) {
            this.metrics.memoryUsage = Math.round((performance as any).memory.usedJSHeapSize / (1024 * 1024));
          }

          this.notifyListeners();
        }
      }

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  public static getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public static updateMetric<K extends keyof PerformanceMetrics>(key: K, value: PerformanceMetrics[K]): void {
    this.metrics[key] = value;
    this.notifyListeners();
  }

  public static setQualityOverride(quality: ProxyQuality): void {
    this.manualQualityOverride = quality;
    this.metrics.adaptiveQuality = quality;
    this.notifyListeners();
  }

  public static getQualityOverride(): ProxyQuality {
    return this.manualQualityOverride;
  }

  public static subscribe(listener: (m: PerformanceMetrics) => void): () => void {
    this.listeners.push(listener);
    listener({ ...this.metrics });
    this.init();
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private static notifyListeners(): void {
    const data = { ...this.metrics };
    this.listeners.forEach((l) => {
      try {
        l(data);
      } catch (err) {
        // ignore
      }
    });
  }
}

// Auto-start monitor
PerformanceMonitor.init();

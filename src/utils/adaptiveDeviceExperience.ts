// OMNISTRIH AI V2 - PHASE 10: ADAPTIVE DEVICE EXPERIENCE ENGINE
// Provides device classification, performance profiling, real-time telemetry adaptation,
// and layout/interaction adaptation without modifying RAW media or EDL rules.

import { PerformanceMonitor, PerformanceMetrics } from "./performanceEngine";

export type DeviceClass = "MOBILE" | "TABLET" | "DESKTOP";
export type PerformanceProfile = "HIGH" | "STANDARD" | "LOW";

export type CompositeProfile =
  | "MOBILE_HIGH"
  | "MOBILE_STANDARD"
  | "MOBILE_LOW"
  | "TABLET_HIGH"
  | "TABLET_STANDARD"
  | "DESKTOP_STANDARD"
  | "DESKTOP_HIGH";

export type PreviewQuality = "HIGH" | "MEDIUM" | "LOW";
export type WaveformDensity = "HIGH_DETAIL" | "REDUCED_DETAIL" | "MINIMAL_DETAIL";
export type ThumbnailDensity = "FULL" | "MODERATE" | "SPARSE";
export type LayoutMode = "MOBILE_STACK" | "TABLET_HYBRID" | "DESKTOP_PRO";
export type InteractionMode = "TOUCH" | "MOUSE" | "HYBRID";
export type ScreenOrientation = "portrait" | "landscape";

export interface DeviceCapabilities {
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  maxTouchPoints: number;
  hasTouch: boolean;
  hasCoarsePointer: boolean;
  hasHover: boolean;
  hardwareConcurrency: number;
  deviceMemoryGbs: number;
  webCodecsAvailable: boolean;
  orientation: ScreenOrientation;
  connectionType?: string;
}

export interface AdaptiveDeviceState {
  deviceClass: DeviceClass;
  performanceProfile: PerformanceProfile;
  compositeProfile: CompositeProfile;
  previewQuality: PreviewQuality;
  waveformDensity: WaveformDensity;
  thumbnailDensity: ThumbnailDensity;
  layoutMode: LayoutMode;
  interactionMode: InteractionMode;
  isTouchDevice: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isMobileSafeMode: boolean;
  orientation: ScreenOrientation;
  capabilities: DeviceCapabilities;
  telemetry: PerformanceMetrics;
}

// 1. CAPABILITY DETECTOR
export const detectCapabilities = (): DeviceCapabilities => {
  const isServer = typeof window === "undefined";

  const viewportWidth = isServer ? 1280 : window.innerWidth;
  const viewportHeight = isServer ? 800 : window.innerHeight;
  const devicePixelRatio = isServer ? 1 : window.devicePixelRatio || 1;

  const maxTouchPoints = isServer ? 0 : navigator.maxTouchPoints || 0;
  const hasTouch = maxTouchPoints > 0 || (typeof window !== "undefined" && "ontouchstart" in window);

  let hasCoarsePointer = false;
  let hasHover = true;

  if (!isServer && window.matchMedia) {
    hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
    hasHover = window.matchMedia("(hover: hover)").matches;
  }

  const hardwareConcurrency = isServer ? 4 : navigator.hardwareConcurrency || 4;
  const deviceMemoryGbs = isServer ? 8 : (navigator as any).deviceMemory || 8;
  const webCodecsAvailable = !isServer && typeof (window as any).VideoDecoder !== "undefined";

  const orientation: ScreenOrientation =
    viewportWidth < viewportHeight ? "portrait" : "landscape";

  const connectionType =
    !isServer && (navigator as any).connection
      ? (navigator as any).connection.effectiveType
      : "4g";

  return {
    viewportWidth,
    viewportHeight,
    devicePixelRatio,
    maxTouchPoints,
    hasTouch,
    hasCoarsePointer,
    hasHover,
    hardwareConcurrency,
    deviceMemoryGbs,
    webCodecsAvailable,
    orientation,
    connectionType,
  };
};

// 2. DEVICE CLASSIFIER
export const classifyDevice = (caps: DeviceCapabilities): DeviceClass => {
  const { viewportWidth, hasTouch, hasCoarsePointer, hasHover } = caps;

  // Touch-first or small screen <= 768px -> MOBILE
  if (viewportWidth < 640 || (viewportWidth <= 820 && hasTouch && hasCoarsePointer && !hasHover)) {
    return "MOBILE";
  }

  // Tablet: 640px to 1080px with touch or hybrid pointer
  if (viewportWidth <= 1080 && (hasTouch || hasCoarsePointer)) {
    return "TABLET";
  }

  // Large desktop viewports
  if (viewportWidth > 1080 && hasHover) {
    return "DESKTOP";
  }

  // Fallback based on width
  if (viewportWidth <= 768) return "MOBILE";
  if (viewportWidth <= 1024) return "TABLET";
  return "DESKTOP";
};

// 3. PERFORMANCE PROFILER
export const computeInitialPerformanceProfile = (
  caps: DeviceCapabilities,
  deviceClass: DeviceClass
): PerformanceProfile => {
  const { hardwareConcurrency, deviceMemoryGbs } = caps;

  if (deviceClass === "MOBILE") {
    if (hardwareConcurrency >= 8 && deviceMemoryGbs >= 6) return "HIGH";
    if (hardwareConcurrency >= 4 && deviceMemoryGbs >= 3) return "STANDARD";
    return "LOW";
  }

  if (deviceClass === "TABLET") {
    if (hardwareConcurrency >= 8 && deviceMemoryGbs >= 6) return "HIGH";
    return "STANDARD";
  }

  // DESKTOP
  if (hardwareConcurrency >= 8 && deviceMemoryGbs >= 8) return "HIGH";
  if (hardwareConcurrency >= 4) return "STANDARD";
  return "LOW";
};

// 4. ADAPTIVE DEVICE EXPERIENCE MANAGER
class AdaptiveDeviceExperienceEngine {
  private caps: DeviceCapabilities;
  private deviceClass: DeviceClass;
  private performanceProfile: PerformanceProfile;
  private isMobileSafeMode: boolean = false;
  private listeners: ((state: AdaptiveDeviceState) => void)[] = [];
  private lastAdaptTime = 0;
  private degradedFrameCount = 0;
  private stableFrameCount = 0;

  constructor() {
    this.caps = detectCapabilities();
    this.deviceClass = classifyDevice(this.caps);
    this.performanceProfile = computeInitialPerformanceProfile(this.caps, this.deviceClass);

    this.initListeners();
  }

  private initListeners() {
    if (typeof window === "undefined") return;

    window.addEventListener("resize", () => {
      this.caps = detectCapabilities();
      const newClass = classifyDevice(this.caps);
      if (newClass !== this.deviceClass) {
        this.deviceClass = newClass;
        this.performanceProfile = computeInitialPerformanceProfile(this.caps, this.deviceClass);
      }
      this.notify();
    });

    window.addEventListener("orientationchange", () => {
      setTimeout(() => {
        this.caps = detectCapabilities();
        this.notify();
      }, 100);
    });

    // Subscribe to PerformanceMonitor telemetry for real-time hysteresis adaptation
    PerformanceMonitor.subscribe((metrics) => {
      this.evaluateRealtimeAdaptation(metrics);
    });
  }

  private evaluateRealtimeAdaptation(metrics: PerformanceMetrics) {
    const now = performance.now();
    // Debounce adaptation every 3 seconds to avoid flickering
    if (now - this.lastAdaptTime < 3000) return;

    let changed = false;

    if (metrics.fps < 28 || metrics.droppedFrames > 8 || metrics.health === "DEGRADED") {
      this.degradedFrameCount++;
      this.stableFrameCount = 0;

      if (this.degradedFrameCount >= 2) {
        if (this.performanceProfile === "HIGH") {
          this.performanceProfile = "STANDARD";
          changed = true;
        } else if (this.performanceProfile === "STANDARD") {
          this.performanceProfile = "LOW";
          this.isMobileSafeMode = true;
          changed = true;
        }
        this.degradedFrameCount = 0;
        this.lastAdaptTime = now;
      }
    } else if (metrics.fps >= 52 && metrics.health === "EXCELLENT") {
      this.stableFrameCount++;
      this.degradedFrameCount = 0;

      if (this.stableFrameCount >= 4) {
        if (this.performanceProfile === "LOW" && !this.isMobileSafeMode) {
          this.performanceProfile = "STANDARD";
          changed = true;
        } else if (this.performanceProfile === "STANDARD" && this.deviceClass !== "MOBILE") {
          this.performanceProfile = "HIGH";
          changed = true;
        }
        this.stableFrameCount = 0;
        this.lastAdaptTime = now;
      }
    }

    if (changed) {
      this.notify();
    }
  }

  public setMobileSafeMode(enabled: boolean) {
    this.isMobileSafeMode = enabled;
    if (enabled) {
      this.performanceProfile = "LOW";
    }
    this.notify();
  }

  public getState(): AdaptiveDeviceState {
    const caps = this.caps;
    const deviceClass = this.deviceClass;
    const profile = this.performanceProfile;
    const isSafe = this.isMobileSafeMode;

    const compositeProfile: CompositeProfile =
      deviceClass === "MOBILE"
        ? profile === "HIGH" ? "MOBILE_HIGH" : profile === "STANDARD" ? "MOBILE_STANDARD" : "MOBILE_LOW"
        : deviceClass === "TABLET"
        ? profile === "HIGH" ? "TABLET_HIGH" : "TABLET_STANDARD"
        : profile === "HIGH" ? "DESKTOP_HIGH" : "DESKTOP_STANDARD";

    const previewQuality: PreviewQuality =
      isSafe || profile === "LOW" ? "LOW" : profile === "STANDARD" ? "MEDIUM" : "HIGH";

    const waveformDensity: WaveformDensity =
      profile === "LOW" || isSafe ? "MINIMAL_DETAIL" : profile === "STANDARD" ? "REDUCED_DETAIL" : "HIGH_DETAIL";

    const thumbnailDensity: ThumbnailDensity =
      profile === "LOW" || isSafe ? "SPARSE" : profile === "STANDARD" ? "MODERATE" : "FULL";

    const layoutMode: LayoutMode =
      deviceClass === "MOBILE" ? "MOBILE_STACK" : deviceClass === "TABLET" ? "TABLET_HYBRID" : "DESKTOP_PRO";

    const interactionMode: InteractionMode =
      caps.hasTouch && caps.hasHover ? "HYBRID" : caps.hasTouch ? "TOUCH" : "MOUSE";

    return {
      deviceClass,
      performanceProfile: profile,
      compositeProfile,
      previewQuality,
      waveformDensity,
      thumbnailDensity,
      layoutMode,
      interactionMode,
      isTouchDevice: caps.hasTouch,
      isMobile: deviceClass === "MOBILE",
      isTablet: deviceClass === "TABLET",
      isDesktop: deviceClass === "DESKTOP",
      isMobileSafeMode: isSafe,
      orientation: caps.orientation,
      capabilities: caps,
      telemetry: PerformanceMonitor.getMetrics(),
    };
  }

  public subscribe(listener: (state: AdaptiveDeviceState) => void): () => void {
    this.listeners.push(listener);
    listener(this.getState());
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach(l => {
      try {
        l(state);
      } catch (e) {
        // ignore
      }
    });
  }
}

export const AdaptiveDeviceExperience = new AdaptiveDeviceExperienceEngine();

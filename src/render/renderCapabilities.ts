import { RenderPlan } from "../types/renderEngine";

export interface RenderCapabilities {
  hasWebCodecs: boolean;
  hasVideoEncoder: boolean;
  hasVideoDecoder: boolean;
  hasOffscreenCanvas: boolean;
  hasAudioContext: boolean;
  supportsH264: boolean;
  supportsVP9: boolean;
  supportsOpus: boolean;
}

export interface RenderProgressInfo {
  status: 
    | "QUEUED"
    | "PREPARING"
    | "DECODING"
    | "RENDERING_VIDEO"
    | "RENDERING_AUDIO"
    | "ENCODING"
    | "MUXING"
    | "QC"
    | "COMPLETED"
    | "CANCELLED"
    | "FAILED";
  currentFrame: number;
  totalFrames: number;
  percentage: number;
  elapsedSeconds: number;
  estimatedRemainingSeconds: number;
  renderFps: number;
  backendUsed: "OFFLINE_WEBCODECS" | "REALTIME_CANVAS_FALLBACK";
}

export interface RenderArtifact {
  id: string;
  projectId: string;
  renderPlanId: string;
  edlVersion: number;
  dnaVersion: number;
  backend: string;
  container: string;
  videoCodec: string;
  audioCodec: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  fileSize: string;
  blobUrl: string;
  createdAt: string;
  qcStatus: "PASSED" | "FAILED" | "NOT_RUN";
}

export async function detectRenderCapabilities(): Promise<RenderCapabilities> {
  const hasWebCodecs = typeof window !== "undefined" && "VideoEncoder" in window && "VideoDecoder" in window;
  const hasVideoEncoder = typeof window !== "undefined" && "VideoEncoder" in window;
  const hasVideoDecoder = typeof window !== "undefined" && "VideoDecoder" in window;
  const hasOffscreenCanvas = typeof window !== "undefined" && "OffscreenCanvas" in window;
  const hasAudioContext = typeof window !== "undefined" && ("AudioContext" in window || "webkitAudioContext" in window);

  let supportsH264 = false;
  let supportsVP9 = false;
  let supportsOpus = true;

  if (hasVideoEncoder) {
    try {
      const h264Support = await (window as any).VideoEncoder.isConfigSupported({
        codec: "avc1.42001f",
        width: 1920,
        height: 1080,
        bitrate: 5_000_000,
        framerate: 30,
      });
      supportsH264 = h264Support.supported;
    } catch {
      supportsH264 = false;
    }

    try {
      const vp9Support = await (window as any).VideoEncoder.isConfigSupported({
        codec: "vp09.00.10.08",
        width: 1920,
        height: 1080,
        bitrate: 5_000_000,
        framerate: 30,
      });
      supportsVP9 = vp9Support.supported;
    } catch {
      supportsVP9 = false;
    }
  }

  return {
    hasWebCodecs,
    hasVideoEncoder,
    hasVideoDecoder,
    hasOffscreenCanvas,
    hasAudioContext,
    supportsH264,
    supportsVP9,
    supportsOpus,
  };
}

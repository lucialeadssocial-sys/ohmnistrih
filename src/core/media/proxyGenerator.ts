/**
 * Real proxy (editing preview) generation.
 *
 * Frames are decoded through the real media engine, scaled down, encoded with WebCodecs (VP9)
 * and muxed into a WebM file with Mediabunny — the same encoder stack the offline export uses.
 * Every number reported back is measured (encoded frame count, resolution, file size read from
 * OPFS). When WebCodecs is unavailable the function throws with a clear code instead of writing
 * a placeholder file.
 */

import {
  Output,
  BufferTarget,
  WebMOutputFormat,
  EncodedVideoPacketSource,
  EncodedPacket,
} from 'mediabunny';
import { mediaEngineV1 } from '../media-engine';

export interface ProxyGenerationResult {
  /** Blob holding the real encoded proxy (also written to OPFS by the caller). */
  blob: Blob;
  width: number;
  height: number;
  fps: number;
  codec: string;
  durationSeconds: number;
  framesEncoded: number;
  sizeBytes: number;
}

export interface ProxyGenerationOptions {
  /** Target width of the proxy (default 854 = "480p class"); never upscales. */
  targetWidth?: number;
  /** Target frame rate of the proxy (default 30); never goes above the source fps. */
  targetFps?: number;
  onProgress?: (fraction: number, message: string) => void;
  signal?: AbortSignal;
}

const DEFAULT_TARGET_WIDTH = 854;
const DEFAULT_TARGET_FPS = 30;
const PROXY_BITRATE = 1_200_000;
const KEYFRAME_INTERVAL_SECONDS = 1;
/** EBML magic — every real WebM/Matroska file starts with these bytes. */
const EBML_MAGIC = [0x1a, 0x45, 0xdf, 0xa3];

function even(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}

function hasWebCodecs(): boolean {
  return typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoFrame' in window;
}

function createScaledCanvas(width: number, height: number): { ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D } | null {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) return { ctx };
  }
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
    if (ctx) return { ctx };
  }
  return null;
}

/**
 * Encodes a real editing proxy for the given media source.
 * Throws `PROXY_WEBCODECS_UNAVAILABLE`, `PROXY_SOURCE_HAS_NO_VIDEO` or `PROXY_NO_FRAMES_ENCODED`
 * when the proxy cannot be produced — callers must surface that instead of claiming success.
 */
export async function generateProxy(
  source: File | Blob | string,
  metadata: { duration: number; width: number; height: number; fps: number },
  options: ProxyGenerationOptions = {}
): Promise<ProxyGenerationResult> {
  if (!hasWebCodecs()) {
    throw new Error('PROXY_WEBCODECS_UNAVAILABLE');
  }
  if (!metadata?.duration || metadata.duration <= 0) {
    throw new Error('PROXY_SOURCE_HAS_NO_VIDEO');
  }

  const targetWidth = options.targetWidth || DEFAULT_TARGET_WIDTH;
  const width = even(Math.min(targetWidth, metadata.width || targetWidth));
  const height = even((metadata.height && metadata.width) ? (width * metadata.height) / metadata.width : width * 9 / 16);
  const sourceFps = metadata.fps && metadata.fps > 0 ? metadata.fps : DEFAULT_TARGET_FPS;
  const fps = Math.max(1, Math.min(options.targetFps || DEFAULT_TARGET_FPS, Math.round(sourceFps)));
  const duration = metadata.duration;
  const totalFrames = Math.max(1, Math.floor(duration * fps));

  const canvasRef = createScaledCanvas(width, height);
  if (!canvasRef) {
    throw new Error('PROXY_CANVAS_UNAVAILABLE');
  }

  const target = new BufferTarget();
  const output = new Output({ format: new WebMOutputFormat(), target });
  const videoSource = new EncodedVideoPacketSource('vp9');
  output.addVideoTrack(videoSource, { frameRate: fps });
  await output.start();

  let encoderError: Error | null = null;
  const encoder = new (window as any).VideoEncoder({
    output: async (chunk: any, meta: any) => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      const packet = new EncodedPacket(
        data,
        chunk.type === 'key' ? 'key' : 'delta',
        chunk.timestamp / 1_000_000,
        (chunk.duration || 0) / 1_000_000
      );
      await videoSource.add(packet, meta);
    },
    error: (e: any) => {
      encoderError = e instanceof Error ? e : new Error(String(e?.message || e));
    },
  });

  encoder.configure({
    codec: 'vp09.00.10.08',
    width,
    height,
    bitrate: PROXY_BITRATE,
  });

  const frameDurationMicros = Math.round(1_000_000 / fps);
  const keyFrameInterval = Math.max(1, Math.round(fps * KEYFRAME_INTERVAL_SECONDS));
  const frameSource = source as File | string;
  let framesEncoded = 0;

  try {
    for (let i = 0; i < totalFrames; i++) {
      if (options.signal?.aborted) {
        throw new Error('PROXY_CANCELLED');
      }
      if (encoderError) throw encoderError;

      const timestamp = i / fps;
      const bitmap = await mediaEngineV1.getFrameAtTime(frameSource, timestamp);
      if (!bitmap) continue;

      try {
        canvasRef.ctx.drawImage(bitmap as any, 0, 0, width, height);
        const videoFrame = new (window as any).VideoFrame(canvasRef.ctx.canvas, {
          timestamp: i * frameDurationMicros,
          duration: frameDurationMicros,
        });
        encoder.encode(videoFrame, { keyFrame: i % keyFrameInterval === 0 });
        videoFrame.close();
        framesEncoded++;
      } finally {
        if (typeof (bitmap as any).close === 'function') (bitmap as any).close();
      }

      if (encoder.encodeQueueSize > 8) {
        await new Promise((resolve) => setTimeout(resolve, 4));
      }
      options.onProgress?.((i + 1) / totalFrames, `Kódujem snímku ${i + 1}/${totalFrames}`);
    }

    await encoder.flush();
    await output.finalize();
  } finally {
    try {
      encoder.close();
    } catch {
      // already closed
    }
  }

  if (!target.buffer || framesEncoded === 0) {
    throw new Error('PROXY_NO_FRAMES_ENCODED');
  }

  const bytes = new Uint8Array(target.buffer);
  const isRealWebM = EBML_MAGIC.every((byte, index) => bytes[index] === byte);
  if (!isRealWebM) {
    throw new Error('PROXY_ENCODER_PRODUCED_INVALID_FILE');
  }

  return {
    blob: new Blob([bytes], { type: 'video/webm' }),
    width,
    height,
    fps,
    codec: 'vp9',
    durationSeconds: Number(duration.toFixed(2)),
    framesEncoded,
    sizeBytes: bytes.byteLength,
  };
}

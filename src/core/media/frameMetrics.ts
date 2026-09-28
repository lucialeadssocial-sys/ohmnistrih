/**
 * Real frame measurement for the media analysis pipeline.
 *
 * Frames are decoded through the real MediaEngine worker (Mediabunny CanvasSink) and measured
 * on a canvas: mean luminance, Laplacian variance (sharpness), normalised RGBA means and an
 * 8-bin luminance histogram. Nothing here is estimated from metadata — if a frame cannot be
 * decoded the caller gets `null` and must report the metric as "not measured".
 */

import { mediaEngineV1 } from '../media-engine';

export interface FrameMetrics {
  timestamp: number;
  /** Mean luminance of the decoded frame, 0-255. */
  brightness: number;
  /** 0-100 sharpness score derived from the Laplacian variance (log-scaled). */
  blurScore: number;
  /** Raw Laplacian variance — the underlying measurement behind `blurScore`. */
  laplacianVariance: number;
  /** Normalised RGBA means (0-1) of the frame. */
  colorVector: [number, number, number, number];
  /** 8-bin normalised luminance histogram (sums to 1). */
  luminanceHistogram: number[];
  /** Mean absolute RGB difference (0-1) against the previously sampled frame. */
  changeFromPrevious: number;
  /** True when `changeFromPrevious` is above {@link CUT_DETECTION_THRESHOLD}. */
  isSceneCut: boolean;
}

/** Pixel-difference threshold above which two consecutive samples count as a cut. */
export const CUT_DETECTION_THRESHOLD = 0.22;
/** Sharpness score mapped from Laplacian variance: below this the frame is treated as soft. */
export const BLUR_SCORE_THRESHOLD = 50;
/** Luminance below which a frame is treated as very dark. */
export const DARK_LUMINANCE_THRESHOLD = 50;
/** Laplacian variance that maps to a sharpness score of 100. */
const LAPLACIAN_VARIANCE_AT_SCORE_100 = 1200;
const ANALYSIS_WIDTH = 160;
const ANALYSIS_HEIGHT = Math.round(ANALYSIS_WIDTH * 9 / 16);

function createAnalysisCanvas(width: number, height: number): { canvas: any; ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null } {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    return { canvas, ctx: canvas.getContext('2d') as any };
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return { canvas, ctx: canvas.getContext('2d') };
  }
  return { canvas: null, ctx: null };
}

/**
 * Decodes a single frame through the real media engine and measures it.
 * Returns `null` when the frame cannot be decoded (missing media, unsupported codec, audio-only).
 */
export async function measureFrame(
  source: File | Blob | string,
  timestamp: number,
  previous?: FrameMetrics | null
): Promise<FrameMetrics | null> {
  const bitmap = await mediaEngineV1.getFrameAtTime(source as File | string, timestamp);
  if (!bitmap) return null;

  try {
    const sourceWidth = bitmap.width || ANALYSIS_WIDTH;
    const sourceHeight = bitmap.height || ANALYSIS_HEIGHT;
    const width = Math.max(2, Math.min(ANALYSIS_WIDTH, sourceWidth));
    const height = Math.max(2, Math.round(width / (sourceWidth / sourceHeight) || ANALYSIS_HEIGHT));

    const { ctx } = createAnalysisCanvas(width, height);
    if (!ctx) return null;

    ctx.drawImage(bitmap as any, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);
    return measureImageData(data, width, height, timestamp, previous);
  } finally {
    if (typeof (bitmap as any).close === 'function') {
      (bitmap as any).close();
    }
  }
}

/**
 * Samples up to `maxSamples` evenly spaced frames of the media and returns the metrics of every
 * frame that could really be decoded (order preserved, undecodable frames are skipped).
 */
export async function sampleFrameMetrics(
  source: File | Blob | string,
  duration: number,
  maxSamples: number = 24,
  onProgress?: (fraction: number) => void
): Promise<FrameMetrics[]> {
  if (!duration || duration <= 0) return [];

  const sampleCount = Math.max(2, Math.min(maxSamples, Math.round(duration)));
  const step = duration / sampleCount;
  const metrics: FrameMetrics[] = [];
  let previous: FrameMetrics | null = null;

  for (let i = 0; i <= sampleCount; i++) {
    const timestamp = Math.min(Math.max(0, i * step), Math.max(0, duration - 0.05));
    const measured = await measureFrame(source, timestamp, previous);
    if (measured) {
      metrics.push(measured);
      previous = measured;
    }
    onProgress?.(Math.min(1, (i + 1) / (sampleCount + 1)));
  }

  return metrics;
}

/**
 * Computes the frame metrics from raw RGBA pixels (shared by the worker-backed frame decode and
 * the <video> element sampling path).
 */
export function measureImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  timestamp: number,
  previous?: FrameMetrics | null
): FrameMetrics | null {
  const pixelCount = width * height;
  if (!pixelCount || data.length < pixelCount * 4) return null;

  const luminance = new Float32Array(pixelCount);
  const histogram = new Array(8).fill(0);
  let sumR = 0, sumG = 0, sumB = 0, sumA = 0;

  for (let i = 0; i < pixelCount; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const a = data[i * 4 + 3];
    sumR += r; sumG += g; sumB += b; sumA += a;

    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luminance[i] = luma;
    histogram[Math.min(7, Math.floor(luma / 32))]++;
  }

  let luminanceSum = 0;
  for (let i = 0; i < pixelCount; i++) luminanceSum += luminance[i];
  const brightness = luminanceSum / pixelCount;

  // Laplacian variance (4-neighbour stencil) — standard focus/sharpness measure.
  let lapSum = 0, lapSquareSum = 0, lapCount = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const lap = 4 * luminance[idx] - luminance[idx - 1] - luminance[idx + 1] - luminance[idx - width] - luminance[idx + width];
      lapSum += lap;
      lapSquareSum += lap * lap;
      lapCount++;
    }
  }
  const lapMean = lapCount ? lapSum / lapCount : 0;
  const laplacianVariance = lapCount ? Math.max(0, lapSquareSum / lapCount - lapMean * lapMean) : 0;
  const blurScore = Math.max(0, Math.min(100, Math.round((Math.log10(1 + laplacianVariance) / Math.log10(1 + LAPLACIAN_VARIANCE_AT_SCORE_100)) * 100)));

  let changeFromPrevious = 0;
  if (previous && previous.colorVector) {
    // The previous sample's colour means are the reference for the change score.
    const prevR = previous.colorVector[0] * 255;
    const prevG = previous.colorVector[1] * 255;
    const prevB = previous.colorVector[2] * 255;
    const currentR = sumR / pixelCount;
    const currentG = sumG / pixelCount;
    const currentB = sumB / pixelCount;
    changeFromPrevious = (Math.abs(currentR - prevR) + Math.abs(currentG - prevG) + Math.abs(currentB - prevB)) / (3 * 255);
  }

  return {
    timestamp: Number(timestamp.toFixed(2)),
    brightness: Math.round(brightness),
    blurScore,
    laplacianVariance: Number(laplacianVariance.toFixed(1)),
    colorVector: [
      Number((sumR / (pixelCount * 255)).toFixed(4)),
      Number((sumG / (pixelCount * 255)).toFixed(4)),
      Number((sumB / (pixelCount * 255)).toFixed(4)),
      Number((sumA / (pixelCount * 255)).toFixed(4)),
    ],
    luminanceHistogram: histogram.map(count => Number((count / pixelCount).toFixed(4))),
    changeFromPrevious: Number(changeFromPrevious.toFixed(4)),
    isSceneCut: changeFromPrevious >= CUT_DETECTION_THRESHOLD,
  };
}

/** Luminance-histogram intersection (0-1): 1 means identical brightness distribution. */
export function histogramSimilarity(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let intersection = 0;
  for (let i = 0; i < a.length; i++) intersection += Math.min(a[i], b[i]);
  return Math.max(0, Math.min(1, intersection));
}

export const DUPLICATE_SIMILARITY_THRESHOLD = 0.92;

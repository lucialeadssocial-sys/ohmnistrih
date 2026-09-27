/**
 * Media Worker 1.5 - Real Mediabunny Worker
 * Handles heavy media operations off the main thread:
 * - Metadata & track probing
 * - Keyframe-aware frame decoding & thumbnail extraction
 * - Streaming audio waveform extraction without RAM bloat
 * - Zero Math.random() simulations
 */

import { 
  Input, 
  BlobSource, 
  UrlSource, 
  ALL_FORMATS, 
  CanvasSink, 
  AudioBufferSink 
} from 'mediabunny';
import { 
  MediaWorkerRequest, 
  MediaWorkerResponse, 
  MediaMetadata 
} from './types';

const activeJobs = new Set<string>();
const inputCache = new Map<string, { input: Input; timestamp: number }>();

function createSource(file: File | Blob | string) {
  if (typeof file === 'string') {
    return new UrlSource(file);
  }
  return new BlobSource(file);
}

async function getInput(file: File | Blob | string): Promise<Input> {
  const cacheKey = typeof file === 'string' 
    ? file 
    : `${(file as File).name || 'blob'}_${file.size}`;

  if (inputCache.has(cacheKey)) {
    const cached = inputCache.get(cacheKey)!;
    cached.timestamp = Date.now();
    return cached.input;
  }

  const source = createSource(file);
  const input = new Input({ source, formats: ALL_FORMATS });

  // LRU cache limit (max 3 open inputs to prevent memory leaks)
  if (inputCache.size >= 3) {
    let oldestKey = '';
    let oldestTime = Infinity;
    for (const [key, val] of inputCache.entries()) {
      if (val.timestamp < oldestTime) {
        oldestTime = val.timestamp;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      try {
        inputCache.get(oldestKey)?.input.dispose();
      } catch {
        // ignore dispose errors
      }
      inputCache.delete(oldestKey);
    }
  }

  inputCache.set(cacheKey, { input, timestamp: Date.now() });
  return input;
}

self.onmessage = async (e: MessageEvent<MediaWorkerRequest>) => {
  const { jobId, type, payload } = e.data;
  activeJobs.add(jobId);

  try {
    switch (type) {
      case 'INIT':
      case 'PING':
      case 'INIT_DECODER':
        sendResponse(jobId, 'success', { ready: true, engine: 'mediabunny', version: '1.59.0' });
        break;
      case 'GET_METADATA':
        await handleGetMetadata(jobId, payload);
        break;
      case 'DECODE_FRAME':
      case 'GET_FRAME_AT':
        await handleDecodeFrame(jobId, payload);
        break;
      case 'GENERATE_THUMBNAIL':
        await handleGenerateThumbnail(jobId, payload);
        break;
      case 'GENERATE_WAVEFORM':
        await handleGenerateWaveform(jobId, payload);
        break;
      case 'CANCEL_JOB':
        handleCancelJob(payload?.targetJobId || jobId);
        break;
      case 'DISPOSE':
        handleDispose();
        sendResponse(jobId, 'success', { disposed: true });
        break;
      default:
        sendResponse(jobId, 'error', null, `Neznámy typ požiadavky pre Media Worker: ${type}`);
    }
  } catch (err: any) {
    console.error(`[MediaWorker] Chyba pri úlohe ${jobId} (${type}):`, err);
    sendResponse(jobId, 'error', null, err?.message || 'Neznáma chyba workeru');
  } finally {
    activeJobs.delete(jobId);
  }
};

function sendResponse(
  jobId: string, 
  status: MediaWorkerResponse['status'], 
  result?: any, 
  error?: string, 
  progress?: number
) {
  self.postMessage({ jobId, status, result, error, progress });
}

function handleCancelJob(targetJobId: string) {
  activeJobs.delete(targetJobId);
}

function handleDispose() {
  for (const { input } of inputCache.values()) {
    try {
      input.dispose();
    } catch {
      // ignore
    }
  }
  inputCache.clear();
  activeJobs.clear();
}

/**
 * Metadata extraction via Mediabunny
 */
async function handleGetMetadata(jobId: string, payload: { file: File | Blob | string }) {
  try {
    const input = await getInput(payload.file);
    const canRead = await input.canRead();
    if (!canRead) {
      sendResponse(jobId, 'error', null, 'Nepodporovaný alebo poškodený formát média');
      return;
    }

    let duration = await input.getDurationFromMetadata();
    if (duration === null || duration <= 0 || isNaN(duration)) {
      duration = await input.computeDuration();
    }

    const videoTrack = await input.getPrimaryVideoTrack();
    const audioTrack = await input.getPrimaryAudioTrack();

    let width = 0;
    let height = 0;
    let fps = 30;

    if (videoTrack) {
      width = await videoTrack.getDisplayWidth();
      height = await videoTrack.getDisplayHeight();
      try {
        const metrics = await videoTrack.computeFrameRateMetrics();
        fps = metrics?.bestGuessFrameRate || 30;
      } catch {
        fps = 30;
      }
    }

    let sampleRate: number | undefined;
    let channels: number | undefined;

    if (audioTrack) {
      sampleRate = await audioTrack.getSampleRate();
      channels = await audioTrack.getNumberOfChannels();
    }

    const metadata: MediaMetadata = {
      duration: duration || 0,
      width,
      height,
      fps,
      hasAudio: !!audioTrack,
      hasVideo: !!videoTrack,
      sampleRate,
      channels
    };

    sendResponse(jobId, 'success', metadata);
  } catch (err: any) {
    sendResponse(jobId, 'error', null, `Extrakcia metadát zlyhala: ${err?.message || err}`);
  }
}

/**
 * Frame Extraction via Mediabunny
 */
async function handleDecodeFrame(
  jobId: string, 
  payload: { file: File | Blob | string; timestamp: number; width?: number; height?: number }
) {
  const { file, timestamp } = payload;
  try {
    const input = await getInput(file);
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) {
      sendResponse(jobId, 'error', null, 'Video stopa sa v súbore nenašla');
      return;
    }

    const canvasSink = new CanvasSink(videoTrack, {
      width: payload.width,
      height: payload.height
    });

    const wrapped = await canvasSink.getCanvas(timestamp);
    if (!wrapped || !wrapped.canvas) {
      sendResponse(jobId, 'error', null, `Nepodarilo sa dekódovať snímku v čase ${timestamp}s`);
      return;
    }

    if (!activeJobs.has(jobId)) {
      sendResponse(jobId, 'cancelled');
      return;
    }

    const bitmap = await createImageBitmap(wrapped.canvas);
    (self as any).postMessage({ jobId, status: 'success', result: bitmap }, [bitmap]);
    return bitmap;
  } catch (err: any) {
    sendResponse(jobId, 'error', null, `Dekódovanie snímky zlyhalo: ${err?.message || err}`);
  }
}

/**
 * Real Thumbnail Generation via Mediabunny CanvasSink
 */
async function handleGenerateThumbnail(
  jobId: string, 
  payload: { file: File | Blob | string; timestamp: number; width?: number; height?: number }
) {
  const { file, timestamp } = payload;
  const width = payload.width || 320;
  const height = payload.height || 180;

  try {
    const input = await getInput(file);
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) {
      sendResponse(jobId, 'error', null, 'Video stopa sa v súbore nenašla');
      return;
    }

    const canvasSink = new CanvasSink(videoTrack, {
      width,
      height,
      fit: 'contain'
    });

    const wrapped = await canvasSink.getCanvas(timestamp);
    if (!wrapped || !wrapped.canvas) {
      sendResponse(jobId, 'error', null, 'Náhľad nie je dostupný');
      return;
    }

    if (!activeJobs.has(jobId)) {
      sendResponse(jobId, 'cancelled');
      return;
    }

    const blob = await (wrapped.canvas as OffscreenCanvas).convertToBlob({ 
      type: 'image/jpeg', 
      quality: 0.75 
    });

    const reader = new FileReader();
    reader.onloadend = () => {
      sendResponse(jobId, 'success', { thumbnail: reader.result, timestamp });
    };
    reader.readAsDataURL(blob);
  } catch (err: any) {
    sendResponse(jobId, 'error', null, `Generovanie náhľadu zlyhalo: ${err?.message || err}`);
  }
}

/**
 * Real Streaming Waveform Generation via Mediabunny AudioBufferSink
 * Reads audio in chunks without loading entire file to RAM.
 */
async function handleGenerateWaveform(
  jobId: string, 
  payload: { file: File | Blob | string; samplesCount?: number }
) {
  const { file, samplesCount = 100 } = payload;
  try {
    const input = await getInput(file);
    const audioTrack = await input.getPrimaryAudioTrack();
    if (!audioTrack) {
      sendResponse(jobId, 'success', { peaks: new Array(samplesCount).fill(0) });
      return;
    }

    let duration = await input.getDurationFromMetadata();
    if (duration === null || duration <= 0) {
      duration = await input.computeDuration();
    }

    const peaks = new Array(samplesCount).fill(0);
    const audioSink = new AudioBufferSink(audioTrack);

    let processedBuffers = 0;
    for await (const wrapped of audioSink.buffers()) {
      if (!activeJobs.has(jobId)) {
        sendResponse(jobId, 'cancelled');
        return;
      }

      const audioBuffer = wrapped.buffer;
      const channelData = audioBuffer.getChannelData(0);
      const bufferTimestamp = wrapped.timestamp;

      // Downsample into peaks buckets
      const step = Math.max(1, Math.floor(channelData.length / 32));
      for (let i = 0; i < channelData.length; i += step) {
        const sampleTime = bufferTimestamp + (i / audioBuffer.sampleRate);
        const peakIdx = Math.min(samplesCount - 1, Math.floor((sampleTime / (duration || 1)) * samplesCount));
        if (peakIdx >= 0 && peakIdx < samplesCount) {
          const absVal = Math.abs(channelData[i]);
          const scaled = Math.round(absVal * 100);
          if (scaled > peaks[peakIdx]) {
            peaks[peakIdx] = scaled;
          }
        }
      }

      processedBuffers++;
      if (processedBuffers % 20 === 0 && duration > 0) {
        const progress = Math.min(95, Math.round((bufferTimestamp / duration) * 100));
        sendResponse(jobId, 'running', null, undefined, progress);
      }
    }

    sendResponse(jobId, 'success', { peaks });
  } catch (err: any) {
    sendResponse(jobId, 'error', null, `Generovanie waveformu zlyhalo: ${err?.message || err}`);
  }
}

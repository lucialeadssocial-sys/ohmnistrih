/**
 * Audio extraction for real speech transcription.
 *
 * Decodes the media through the Web Audio API, measures its real RMS (so "no speech" is decided
 * from the signal, not guessed) and returns 16 kHz mono 16-bit PCM WAV as base64 — the format the
 * server sends to the transcription model. Returns `hasAudio: false` when the media cannot be
 * decoded or is effectively silent; callers must report that instead of inventing a transcript.
 */

export interface ExtractedAudio {
  base64: string;
  duration: number;
  rms: number;
  hasAudio: boolean;
  /** Why extraction failed, when it did. */
  error?: string;
}

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

/** Builds a mono 16-bit PCM WAV container from Float32 samples. */
export function encodeWavFromPcm(pcm: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcm.length * 2, true);
  writeString(view, 8, 'WAVE');

  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);

  writeString(view, 36, 'data');
  view.setUint32(40, pcm.length * 2, true);

  let offset = 44;
  for (let i = 0; i < pcm.length; i++) {
    const sample = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000; // avoid huge intermediate strings
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)) as unknown as number[]);
  }
  return btoa(binary);
}

/** RMS of the signal — used to decide whether there is any audio at all. */
export function computeRms(samples: Float32Array, maxProbes: number = 10000): number {
  if (!samples.length) return 0;
  const step = Math.max(1, Math.floor(samples.length / maxProbes));
  let sumSquares = 0;
  let count = 0;
  for (let i = 0; i < samples.length; i += step) {
    sumSquares += samples[i] * samples[i];
    count++;
  }
  return Math.sqrt(sumSquares / (count || 1));
}

/** Extracts 16 kHz mono WAV from a media URL (blob URL, OPFS media URL or remote URL). */
export async function extractWavFromVideoUrl(videoUrl: string): Promise<ExtractedAudio> {
  if (!videoUrl) {
    return { base64: '', duration: 0, rms: 0, hasAudio: false, error: 'Médium nie je k dispozícii.' };
  }

  try {
    const response = await fetch(videoUrl);
    const arrayBuffer = await response.arrayBuffer();

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioCtx();

    let decodedBuffer: AudioBuffer;
    try {
      decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    } catch (e: any) {
      await audioCtx.close();
      console.warn('Could not decode audio data directly from arrayBuffer:', e);
      return { base64: '', duration: 0, rms: 0, hasAudio: false, error: 'Médium sa nedá dekódovať ako zvuk.' };
    }

    const duration = decodedBuffer.duration;
    const rawData = decodedBuffer.getChannelData(0);
    const rms = computeRms(rawData);

    if (rms < 0.0001 || rawData.length === 0) {
      await audioCtx.close();
      return { base64: '', duration, rms, hasAudio: false, error: 'Zvuková stopa je prázdna alebo tichá.' };
    }

    // Resample to 16 kHz mono, which is what the transcription model expects.
    const targetRate = 16000;
    const offlineCtx = new OfflineAudioContext(1, Math.ceil(duration * targetRate), targetRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = decodedBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    const resampledBuffer = await offlineCtx.startRendering();
    const pcmData = resampledBuffer.getChannelData(0);
    const wavBuffer = encodeWavFromPcm(pcmData, targetRate);
    await audioCtx.close();

    return {
      base64: arrayBufferToBase64(wavBuffer),
      duration,
      rms,
      hasAudio: true,
    };
  } catch (err: any) {
    console.error('Audio extraction failed:', err);
    return { base64: '', duration: 0, rms: 0, hasAudio: false, error: err?.message || 'Extrakcia audia zlyhala.' };
  }
}

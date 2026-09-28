/**
 * Loudness measurement (ITU-R BS.1770-4 / EBU R128).
 *
 * Implements the K-weighting filter chain (high-shelf + RLB high-pass), 400 ms blocks with 75 %
 * overlap, absolute (-70 LUFS) and relative (-10 LU) gating, plus a 4× oversampled true-peak
 * estimate. Everything is computed from the real samples of the given audio — no estimates from
 * metadata and no placeholder numbers.
 *
 * Pure maths on Float32Array channels, so it runs in a worker, in the browser or in Node.
 */

export interface LoudnessMeasurement {
  /** Gated integrated loudness in LUFS; null when no block passed the gating thresholds. */
  integratedLufs: number | null;
  /** Loudest 400 ms block (momentary), LUFS. */
  maxMomentaryLufs: number | null;
  /** Loudest 3 s window (short-term), LUFS. */
  maxShortTermLufs: number | null;
  /** Sample peak in dBFS (no oversampling). */
  samplePeakDbfs: number;
  /** True-peak estimate in dBFS using 4× linear oversampling. */
  truePeakDbfs: number;
  /** How many 400 ms blocks were above the absolute gate (i.e. really measured). */
  measuredBlocks: number;
  /** Total number of 400 ms blocks in the signal. */
  totalBlocks: number;
}

const ABSOLUTE_GATE_LUFS = -70;
const RELATIVE_GATE_LU = -10;
const BLOCK_SECONDS = 0.4;
const OVERLAP_FACTOR = 4; // 75 % overlap
const AUDIO_OFFSET_DB = -0.691; // BS.1770 channel weighting offset

/** Coefficients of the BS.1770-4 K-weighting filters (RBJ form, 48 kHz reference values). */
export const K_WEIGHTING = {
  highShelf: { frequency: 1681.974450955533, gainDb: 3.999843853973347, q: 0.7071752369554196 },
  highPass: { frequency: 38.13547087602444, q: 0.5003270373238773 },
};

interface BiquadCoefficients {
  b0: number; b1: number; b2: number; a1: number; a2: number;
}

function biquadHighShelf(frequency: number, q: number, gainDb: number, sampleRate: number): BiquadCoefficients {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * frequency) / sampleRate;
  const cosW0 = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const sqrtA = Math.sqrt(A);

  const b0 = A * ((A + 1) + (A - 1) * cosW0 + 2 * sqrtA * alpha);
  const b1 = -2 * A * ((A - 1) + (A + 1) * cosW0);
  const b2 = A * ((A + 1) + (A - 1) * cosW0 - 2 * sqrtA * alpha);
  const a0 = (A + 1) - (A - 1) * cosW0 + 2 * sqrtA * alpha;
  const a1 = 2 * ((A - 1) - (A + 1) * cosW0);
  const a2 = (A + 1) - (A - 1) * cosW0 - 2 * sqrtA * alpha;

  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function biquadHighPass(frequency: number, q: number, sampleRate: number): BiquadCoefficients {
  const w0 = (2 * Math.PI * frequency) / sampleRate;
  const cosW0 = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);

  const b0 = (1 + cosW0) / 2;
  const b1 = -(1 + cosW0);
  const b2 = (1 + cosW0) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosW0;
  const a2 = 1 - alpha;

  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function applyBiquad(samples: Float32Array, coefficients: BiquadCoefficients): Float32Array {
  const { b0, b1, b2, a1, a2 } = coefficients;
  const out = new Float32Array(samples.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;

  for (let i = 0; i < samples.length; i++) {
    const x0 = samples[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y0;
    x2 = x1; x1 = x0;
    y2 = y1; y1 = y0;
  }

  return out;
}

/** Applies the K-weighting filter chain to one channel (returns a new array). */
export function kWeightChannel(samples: Float32Array, sampleRate: number): Float32Array {
  const shouldered = applyBiquad(
    samples,
    biquadHighShelf(K_WEIGHTING.highShelf.frequency, K_WEIGHTING.highShelf.q, K_WEIGHTING.highShelf.gainDb, sampleRate)
  );
  return applyBiquad(shouldered, biquadHighPass(K_WEIGHTING.highPass.frequency, K_WEIGHTING.highPass.q, sampleRate));
}

function meanSquare(samples: Float32Array, start: number, length: number): number {
  let sum = 0;
  const end = Math.min(samples.length, start + length);
  const count = Math.max(1, end - start);
  for (let i = start; i < end; i++) {
    sum += samples[i] * samples[i];
  }
  return sum / count;
}

function loudnessFromMeanSquare(weightedMeanSquareSum: number): number {
  return AUDIO_OFFSET_DB + 10 * Math.log10(Math.max(weightedMeanSquareSum, 1e-12));
}

/**
 * Measures loudness of a real audio signal.
 *
 * @param channels One Float32Array per channel (L, R, …).
 * @param sampleRate Sample rate of the signal in Hz.
 */
export function measureLoudness(channels: Float32Array[], sampleRate: number): LoudnessMeasurement {
  const usableChannels = channels.filter(c => c && c.length > 0);
  if (usableChannels.length === 0 || sampleRate <= 0) {
    return {
      integratedLufs: null,
      maxMomentaryLufs: null,
      maxShortTermLufs: null,
      samplePeakDbfs: -Infinity,
      truePeakDbfs: -Infinity,
      measuredBlocks: 0,
      totalBlocks: 0,
    };
  }

  const weighted = usableChannels.map(channel => kWeightChannel(channel, sampleRate));

  // --- Sample peak and 4x oversampled true peak (linear interpolation) ---
  let samplePeak = 0;
  let truePeak = 0;
  for (const channel of usableChannels) {
    for (let i = 0; i < channel.length; i++) {
      const value = Math.abs(channel[i]);
      if (value > samplePeak) samplePeak = value;
      if (value > truePeak) truePeak = value;
    }
  }
  for (const channel of usableChannels) {
    for (let i = 0; i < channel.length - 1; i++) {
      const a = channel[i];
      const b = channel[i + 1];
      for (let s = 1; s < 4; s++) {
        const interpolated = Math.abs(a + ((b - a) * s) / 4);
        if (interpolated > truePeak) truePeak = interpolated;
      }
    }
  }

  // --- 400 ms blocks with 75 % overlap ---
  const blockLength = Math.round(BLOCK_SECONDS * sampleRate);
  const hop = Math.max(1, Math.round(blockLength / OVERLAP_FACTOR));
  const signalLength = Math.min(...weighted.map(c => c.length));
  const totalBlocks = signalLength >= blockLength ? Math.floor((signalLength - blockLength) / hop) + 1 : 0;

  const blockLoudness: number[] = [];
  for (let start = 0; start + blockLength <= signalLength; start += hop) {
    let channelSum = 0;
    for (const channel of weighted) {
      channelSum += meanSquare(channel, start, blockLength);
    }
    blockLoudness.push(loudnessFromMeanSquare(channelSum));
  }

  // --- Gating: absolute, then relative (-10 LU below the gated mean) ---
  const aboveAbsolute = blockLoudness
    .map((loudness, index) => ({ loudness, index }))
    .filter(b => b.loudness >= ABSOLUTE_GATE_LUFS);

  let integrated: number | null = null;
  if (aboveAbsolute.length > 0) {
    const absoluteMeanPower = aboveAbsolute.reduce((sum, b) => sum + Math.pow(10, b.loudness / 10), 0) / aboveAbsolute.length;
    const relativeGate = loudnessFromMeanSquare(absoluteMeanPower) + RELATIVE_GATE_LU;
    const aboveRelative = aboveAbsolute.filter(b => b.loudness >= relativeGate);
    if (aboveRelative.length > 0) {
      const gatedPower = aboveRelative.reduce((sum, b) => sum + Math.pow(10, b.loudness / 10), 0) / aboveRelative.length;
      integrated = Number(loudnessFromMeanSquare(gatedPower).toFixed(2));
    }
  }

  // --- Short-term (3 s sliding window) maximum ---
  const shortTermLength = Math.round(3 * sampleRate);
  let maxShortTerm: number | null = null;
  if (signalLength >= shortTermLength) {
    for (let start = 0; start + shortTermLength <= signalLength; start += hop) {
      let channelSum = 0;
      for (const channel of weighted) {
        channelSum += meanSquare(channel, start, shortTermLength);
      }
      const value = loudnessFromMeanSquare(channelSum);
      if (maxShortTerm === null || value > maxShortTerm) maxShortTerm = value;
    }
  }

  const maxMomentary = blockLoudness.length ? Math.max(...blockLoudness) : null;

  return {
    integratedLufs: integrated,
    maxMomentaryLufs: maxMomentary === null ? null : Number(maxMomentary.toFixed(2)),
    maxShortTermLufs: maxShortTerm === null ? null : Number(maxShortTerm.toFixed(2)),
    samplePeakDbfs: samplePeak > 0 ? Number((20 * Math.log10(samplePeak)).toFixed(2)) : -Infinity,
    truePeakDbfs: truePeak > 0 ? Number((20 * Math.log10(truePeak)).toFixed(2)) : -Infinity,
    measuredBlocks: aboveAbsolute.length,
    totalBlocks,
  };
}

/**
 * Gain (in dB) that brings `measuredLufs` to `targetLufs`, capped so the true peak stays under
 * `truePeakCeilingDb`. Returns null when the measurement is not available.
 */
export function normalizationGainDb(
  measuredLufs: number | null,
  targetLufs: number,
  truePeakDbfs: number,
  truePeakCeilingDb: number
): number | null {
  if (measuredLufs === null || !Number.isFinite(measuredLufs)) return null;

  const loudnessGain = targetLufs - measuredLufs;
  if (!Number.isFinite(truePeakDbfs)) return Number(loudnessGain.toFixed(2));

  const peakHeadroom = truePeakCeilingDb - truePeakDbfs;
  return Number(Math.min(loudnessGain, peakHeadroom).toFixed(2));
}

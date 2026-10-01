/**
 * Streaming, local audio measurements for source media.
 *
 * - Integrated loudness follows the BS.1770 K-weighting + 400 ms / 100 ms
 *   gated-block calculation for mono/stereo PCM.
 * - RMS low-energy ranges are 50 ms windows across every channel. They are an
 *   energy heuristic, NOT speech recognition or a voice-activity model.
 * - Sample peak is measured from decoded samples. True peak is deliberately
 *   not claimed; that requires oversampling.
 *
 * This module has no browser or MediaBunny dependency so it can be unit-tested
 * deterministically and fed incrementally by the existing media worker.
 */

export interface AudioRange {
  start: number;
  end: number;
  duration: number;
}

export interface AudioMeasurementOptions {
  /** RMS level below which a 50 ms frame is considered low-energy. */
  silenceThresholdDbfs?: number;
  /** Minimum duration for a reported low-energy interval. */
  minimumSilenceDurationSec?: number;
}

export interface AudioMeasurement {
  /** Duration of decoded PCM samples; source/container duration can differ slightly. */
  durationSec: number;
  sampleRate: number;
  channels: number;
  /** ITU-R BS.1770 / EBU R128 integrated loudness; null means unavailable. */
  integratedLufs: number | null;
  integratedLufsUnavailableReason: string | null;
  /** Unweighted mean-square level (the quantity comparable to volumedetect mean_volume). */
  meanRmsDbfs: number | null;
  /** Peak of decoded PCM samples; this is not a true-peak measurement. */
  samplePeakDbfs: number | null;
  samplePeakMethod: "decoded-sample-peak";
  /** True peak is intentionally not inferred from sample peak. */
  truePeakDbtp: null;
  truePeakStatus: "NOT_MEASURED";
  /** RMS-threshold low-energy intervals; not semantic silence or speech intervals. */
  lowEnergyRanges: AudioRange[];
  totalLowEnergyDurationSec: number;
  silenceThresholdDbfs: number;
  minimumSilenceDurationSec: number;
  loudnessStandard: "ITU-R BS.1770-4 / EBU R128";
  loudnessBlockDurationSec: 0.4;
  loudnessBlockStepSec: 0.1;
}

interface BiquadCoefficients {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

class Biquad {
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  public constructor(private readonly c: BiquadCoefficients) {}

  public process(x: number): number {
    const y = this.c.b0 * x + this.c.b1 * this.x1 + this.c.b2 * this.x2 - this.c.a1 * this.y1 - this.c.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/** BS.1770 pre-filter coefficients (high shelf), calculated for the input rate. */
function kWeightingShelf(sampleRate: number): BiquadCoefficients {
  const frequency = 1681.974450955533;
  const gainDb = 3.999843853973347;
  const k = Math.tan((Math.PI * frequency) / sampleRate);
  const vh = 10 ** (gainDb / 20);
  const vb = vh ** 0.4996667741545416;
  const sqrt2 = Math.SQRT2;
  const denominator = 1 + sqrt2 * k + k * k;

  return {
    b0: (vh + vb * sqrt2 * k + k * k) / denominator,
    b1: (2 * (k * k - vh)) / denominator,
    b2: (vh - vb * sqrt2 * k + k * k) / denominator,
    a1: (2 * (k * k - 1)) / denominator,
    a2: (1 - sqrt2 * k + k * k) / denominator,
  };
}

/** BS.1770 RLB high-pass coefficients, calculated for the input rate. */
function kWeightingHighPass(sampleRate: number): BiquadCoefficients {
  const frequency = 38.13547087602444;
  const q = 0.5003270373238773;
  const k = Math.tan((Math.PI * frequency) / sampleRate);
  const denominator = 1 + k / q + k * k;

  return {
    b0: 1 / denominator,
    b1: -2 / denominator,
    b2: 1 / denominator,
    a1: (2 * (k * k - 1)) / denominator,
    a2: (1 - k / q + k * k) / denominator,
  };
}

function dbFromPower(power: number): number | null {
  return power > 0 && Number.isFinite(power) ? 10 * Math.log10(power) : null;
}

function dbFromAmplitude(amplitude: number): number | null {
  return amplitude > 0 && Number.isFinite(amplitude) ? 20 * Math.log10(amplitude) : null;
}

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

/**
 * Incremental analyzer: callers can feed decoded chunks and release them
 * immediately. It never retains PCM samples; only filter state, a 400 ms ring
 * buffer per channel, and the small list of loudness-block energies are kept.
 */
export class AudioMeasurementAccumulator {
  private readonly sampleRate: number;
  private readonly channelCount: number;
  private readonly silenceThresholdDbfs: number;
  private readonly minimumSilenceDurationSec: number;
  private readonly silenceThresholdLinear: number;
  private readonly frameSize: number;
  private readonly loudnessWindowSize: number;
  private readonly loudnessHopSize: number;
  private readonly loudnessUnavailableReason: string | null;
  private readonly shelves: Biquad[] = [];
  private readonly highPasses: Biquad[] = [];
  private readonly loudnessRings: Float64Array[] = [];
  private readonly loudnessSums: number[] = [];
  private readonly frameSquareSums: number[];
  private readonly loudnessBlockEnergies: number[] = [];
  private readonly lowEnergyRanges: AudioRange[] = [];

  private totalSamples = 0;
  private rawSquareSum = 0;
  private rawSampleCount = 0;
  private samplePeak = 0;
  private frameSamples = 0;
  private frameStartSample = 0;
  private lowEnergyStartSample: number | null = null;
  private totalLowEnergyDurationSec = 0;
  private result: AudioMeasurement | null = null;

  public constructor(sampleRate: number, channelCount: number, options: AudioMeasurementOptions = {}) {
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) throw new Error("Audio sample rate must be a positive number.");
    if (!Number.isInteger(channelCount) || channelCount < 1) throw new Error("Audio channel count must be a positive integer.");

    this.sampleRate = sampleRate;
    this.channelCount = channelCount;
    this.silenceThresholdDbfs = options.silenceThresholdDbfs ?? -35;
    this.minimumSilenceDurationSec = options.minimumSilenceDurationSec ?? 0.3;
    if (!Number.isFinite(this.silenceThresholdDbfs) || this.silenceThresholdDbfs > 0 || this.silenceThresholdDbfs < -120) {
      throw new Error("silenceThresholdDbfs must be between -120 and 0 dBFS.");
    }
    if (!Number.isFinite(this.minimumSilenceDurationSec) || this.minimumSilenceDurationSec < 0) {
      throw new Error("minimumSilenceDurationSec must be a non-negative number.");
    }

    this.silenceThresholdLinear = 10 ** (this.silenceThresholdDbfs / 20);
    this.frameSize = Math.max(1, Math.round(sampleRate * 0.05));
    this.loudnessWindowSize = Math.max(1, Math.round(sampleRate * 0.4));
    this.loudnessHopSize = Math.max(1, Math.round(sampleRate * 0.1));
    this.frameSquareSums = new Array(channelCount).fill(0);

    if (channelCount > 2) {
      this.loudnessUnavailableReason = "Integrated LUFS is not calculated for more than two channels because the source channel layout/roles are not supplied.";
    } else if (sampleRate < 8000 || sampleRate > 192000) {
      this.loudnessUnavailableReason = "Integrated LUFS is unavailable outside the supported 8–192 kHz sample-rate range.";
    } else {
      this.loudnessUnavailableReason = null;
      const shelf = kWeightingShelf(sampleRate);
      const highPass = kWeightingHighPass(sampleRate);
      for (let channel = 0; channel < channelCount; channel += 1) {
        this.shelves.push(new Biquad(shelf));
        this.highPasses.push(new Biquad(highPass));
        this.loudnessRings.push(new Float64Array(this.loudnessWindowSize));
        this.loudnessSums.push(0);
      }
    }
  }

  /** Add one decoded planar audio chunk (one Float32Array/array-like per channel). */
  public addPlanarChunk(channels: readonly ArrayLike<number>[]): void {
    if (this.result) throw new Error("Cannot add audio after finalize().");
    if (channels.length !== this.channelCount) throw new Error("Audio channel count changed between decoded chunks.");
    const length = channels[0]?.length ?? 0;
    if (channels.some((channel) => channel.length !== length)) throw new Error("Planar audio channels must have equal lengths.");

    for (let sampleIndex = 0; sampleIndex < length; sampleIndex += 1) {
      let maxChannelFramePower = 0;
      let sumRawSquares = 0;
      let peak = 0;

      for (let channel = 0; channel < this.channelCount; channel += 1) {
        const raw = Number(channels[channel][sampleIndex]);
        const sample = Number.isFinite(raw) ? raw : 0;
        const absolute = Math.abs(sample);
        if (absolute > peak) peak = absolute;
        sumRawSquares += sample * sample;
        this.frameSquareSums[channel] += sample * sample;

        if (this.loudnessUnavailableReason === null) {
          const weighted = this.highPasses[channel].process(this.shelves[channel].process(sample));
          const square = weighted * weighted;
          const ring = this.loudnessRings[channel];
          const ringIndex = this.totalSamples % this.loudnessWindowSize;
          if (this.totalSamples >= this.loudnessWindowSize) this.loudnessSums[channel] -= ring[ringIndex];
          ring[ringIndex] = square;
          this.loudnessSums[channel] += square;
        }
      }

      if (peak > this.samplePeak) this.samplePeak = peak;
      this.rawSquareSum += sumRawSquares;
      this.rawSampleCount += this.channelCount;
      this.totalSamples += 1;
      this.frameSamples += 1;

      if (this.loudnessUnavailableReason === null && this.totalSamples >= this.loudnessWindowSize) {
        const samplesAfterFirstWindow = this.totalSamples - this.loudnessWindowSize;
        if (samplesAfterFirstWindow % this.loudnessHopSize === 0) {
          let weightedEnergy = 0;
          for (let channel = 0; channel < this.channelCount; channel += 1) weightedEnergy += this.loudnessSums[channel];
          this.loudnessBlockEnergies.push(weightedEnergy / this.loudnessWindowSize);
        }
      }

      if (this.frameSamples === this.frameSize) {
        for (let channel = 0; channel < this.channelCount; channel += 1) {
          maxChannelFramePower = Math.max(maxChannelFramePower, this.frameSquareSums[channel] / this.frameSamples);
          this.frameSquareSums[channel] = 0;
        }
        this.finishEnergyFrame(Math.sqrt(maxChannelFramePower), this.frameStartSample, this.totalSamples);
      }
    }
  }

  private finishEnergyFrame(rms: number, startSample: number, endSample: number): void {
    const isLowEnergy = rms < this.silenceThresholdLinear;
    if (isLowEnergy) {
      if (this.lowEnergyStartSample === null) this.lowEnergyStartSample = startSample;
    } else if (this.lowEnergyStartSample !== null) {
      this.recordLowEnergyRange(this.lowEnergyStartSample, startSample);
      this.lowEnergyStartSample = null;
    }
    this.frameStartSample = endSample;
    this.frameSamples = 0;
  }

  private recordLowEnergyRange(startSample: number, endSample: number): void {
    const duration = (endSample - startSample) / this.sampleRate;
    if (duration + 1e-9 < this.minimumSilenceDurationSec) return;
    const start = startSample / this.sampleRate;
    const end = endSample / this.sampleRate;
    const range = { start: round3(start), end: round3(end), duration: round3(end - start) };
    this.lowEnergyRanges.push(range);
    this.totalLowEnergyDurationSec += end - start;
  }

  private integratedLoudness(): { value: number | null; reason: string | null } {
    if (this.loudnessUnavailableReason) return { value: null, reason: this.loudnessUnavailableReason };
    if (this.loudnessBlockEnergies.length === 0) {
      return { value: null, reason: "Integrated LUFS needs at least one complete 400 ms analysis block." };
    }

    const toLufs = (energy: number): number => energy > 0 ? -0.691 + 10 * Math.log10(energy) : Number.NEGATIVE_INFINITY;
    const absoluteGateEnergies = this.loudnessBlockEnergies.filter((energy) => toLufs(energy) >= -70);
    if (absoluteGateEnergies.length === 0) {
      return { value: null, reason: "No complete loudness block exceeds the BS.1770 absolute gate of −70 LUFS." };
    }

    const meanEnergy = absoluteGateEnergies.reduce((sum, energy) => sum + energy, 0) / absoluteGateEnergies.length;
    const relativeGateLufs = toLufs(meanEnergy) - 10;
    const gatedEnergies = absoluteGateEnergies.filter((energy) => toLufs(energy) >= relativeGateLufs);
    if (gatedEnergies.length === 0) return { value: null, reason: "No loudness blocks remain after the BS.1770 relative gate." };

    const gatedMean = gatedEnergies.reduce((sum, energy) => sum + energy, 0) / gatedEnergies.length;
    return { value: round3(toLufs(gatedMean)), reason: null };
  }

  /** Finalize once; the returned object is JSON-safe and contains no PCM buffer. */
  public finalize(): AudioMeasurement {
    if (this.result) return this.result;

    if (this.frameSamples > 0) {
      let maxChannelFramePower = 0;
      for (let channel = 0; channel < this.channelCount; channel += 1) {
        maxChannelFramePower = Math.max(maxChannelFramePower, this.frameSquareSums[channel] / this.frameSamples);
        this.frameSquareSums[channel] = 0;
      }
      this.finishEnergyFrame(Math.sqrt(maxChannelFramePower), this.frameStartSample, this.totalSamples);
    }
    if (this.lowEnergyStartSample !== null) {
      this.recordLowEnergyRange(this.lowEnergyStartSample, this.totalSamples);
      this.lowEnergyStartSample = null;
    }

    const loudness = this.integratedLoudness();
    this.result = {
      durationSec: round3(this.totalSamples / this.sampleRate),
      sampleRate: this.sampleRate,
      channels: this.channelCount,
      integratedLufs: loudness.value,
      integratedLufsUnavailableReason: loudness.reason,
      meanRmsDbfs: dbFromPower(this.rawSampleCount > 0 ? this.rawSquareSum / this.rawSampleCount : 0),
      samplePeakDbfs: dbFromAmplitude(this.samplePeak),
      samplePeakMethod: "decoded-sample-peak",
      truePeakDbtp: null,
      truePeakStatus: "NOT_MEASURED",
      lowEnergyRanges: [...this.lowEnergyRanges],
      totalLowEnergyDurationSec: round3(this.totalLowEnergyDurationSec),
      silenceThresholdDbfs: this.silenceThresholdDbfs,
      minimumSilenceDurationSec: this.minimumSilenceDurationSec,
      loudnessStandard: "ITU-R BS.1770-4 / EBU R128",
      loudnessBlockDurationSec: 0.4,
      loudnessBlockStepSec: 0.1,
    };
    return this.result;
  }
}

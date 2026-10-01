import { describe, expect, test } from "bun:test";
import { AudioMeasurementAccumulator } from "../src/core/media/audioMeasurement";

function tone(sampleRate: number, durationSec: number, amplitude = 0.1, frequency = 1000): Float32Array {
  const samples = new Float32Array(Math.round(sampleRate * durationSec));
  for (let i = 0; i < samples.length; i += 1) samples[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  return samples;
}

function analyze(samples: Float32Array, sampleRate = 48000, chunkSize = samples.length) {
  const analyzer = new AudioMeasurementAccumulator(sampleRate, 1);
  for (let start = 0; start < samples.length; start += chunkSize) {
    analyzer.addPlanarChunk([samples.subarray(start, Math.min(samples.length, start + chunkSize))]);
  }
  return analyzer.finalize();
}

describe("streaming source-audio measurement", () => {
  test("measures mono integrated LUFS using gated 400 ms blocks and sample peak", () => {
    const measurement = analyze(tone(48000, 2, 0.1));
    expect(measurement.integratedLufs).not.toBeNull();
    // A 1 kHz sine at -20 dBFS sample amplitude is approximately -23.0 LUFS after K-weighting.
    expect(measurement.integratedLufs!).toBeGreaterThan(-23.3);
    expect(measurement.integratedLufs!).toBeLessThan(-22.8);
    expect(measurement.samplePeakDbfs!).toBeCloseTo(-20, 1);
    expect(measurement.truePeakStatus).toBe("NOT_MEASURED");
    expect(measurement.truePeakDbtp).toBeNull();
  });

  test("finds RMS low-energy intervals without calling them speech", () => {
    const sr = 24000;
    const first = tone(sr, 1, 0.1);
    const quiet = new Float32Array(sr / 2);
    const last = tone(sr, 1, 0.1);
    const joined = new Float32Array(first.length + quiet.length + last.length);
    joined.set(first, 0);
    joined.set(quiet, first.length);
    joined.set(last, first.length + quiet.length);

    const result = analyze(joined, sr, 4093);
    expect(result.lowEnergyRanges).toHaveLength(1);
    expect(result.lowEnergyRanges[0].start).toBe(1);
    expect(result.lowEnergyRanges[0].end).toBe(1.5);
    expect(result.totalLowEnergyDurationSec).toBe(0.5);
  });

  test("is deterministic across decoded chunk boundaries", () => {
    const pcm = tone(24000, 2.25, 0.17, 440);
    const oneChunk = analyze(pcm, 24000);
    const manyChunks = analyze(pcm, 24000, 997);
    expect(manyChunks).toEqual(oneChunk);
  });

  test("digital silence is not assigned a made-up dB value or LUFS", () => {
    const result = analyze(new Float32Array(48000), 48000, 701);
    expect(result.integratedLufs).toBeNull();
    expect(result.integratedLufsUnavailableReason).toContain("absolute gate");
    expect(result.meanRmsDbfs).toBeNull();
    expect(result.samplePeakDbfs).toBeNull();
    expect(result.lowEnergyRanges).toEqual([{ start: 0, end: 1, duration: 1 }]);
  });

  test("does not guess channel weighting when a decoded layout has more than two channels", () => {
    const sr = 24000;
    const left = tone(sr, 1, 0.1);
    const channels = [left, new Float32Array(left.length), new Float32Array(left.length)];
    const analyzer = new AudioMeasurementAccumulator(sr, 3);
    analyzer.addPlanarChunk(channels);
    const result = analyzer.finalize();
    expect(result.integratedLufs).toBeNull();
    expect(result.integratedLufsUnavailableReason).toContain("channel layout");
    expect(result.samplePeakDbfs).toBeCloseTo(-20, 1);
  });

  test("preserves decoded sample overs above 0 dBFS and does not call them true peak", () => {
    const samples = new Float32Array(48000).fill(1.04);
    const result = analyze(samples);
    expect(result.samplePeakDbfs!).toBeGreaterThan(0);
    expect(result.truePeakDbtp).toBeNull();
    expect(result.truePeakStatus).toBe("NOT_MEASURED");
  });
});

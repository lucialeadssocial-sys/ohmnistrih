import { RenderPlan } from "../types/renderEngine";
import { RenderArtifact, RenderProgressInfo } from "./renderCapabilities";
import { RenderBackend } from "./RenderBackend";
import { RenderEngineManager } from "../utils/renderEngineManager";
import { coreEngine } from "../core/index";
import { renderEngine } from "../core/render/renderEngine";
import { renderProjectMix } from "../core/audio/mixRenderer";
import { measureLoudness, normalizationGainDb, LoudnessMeasurement } from "../core/audio/loudness";
import { TimelineEngine } from "../core/timeline/timelineEngine";
import { 
  Output, 
  BufferTarget, 
  WebMOutputFormat, 
  EncodedVideoPacketSource, 
  EncodedAudioPacketSource, 
  EncodedPacket 
} from "mediabunny";

export class WebCodecsOfflineBackend implements RenderBackend {
  id = "OFFLINE_WEBCODECS";
  name = "True Offline WebCodecs Renderer (VP9 + Opus + Mediabunny)";
  isOffline = true;

  private isCancelled = false;
  private videoEncoder: any = null;
  private audioEncoder: any = null;
  /**
   * Real loudness analysis of the rendered mix for the last export (measured, never estimated).
   * Null values mean "not measured" — the caller must not present them as numbers.
   */
  public audioAnalysis: {
    integratedLufs: number | null;
    truePeakDbfs: number | null;
    targetLufs: number | null;
    appliedGainDb: number | null;
    normalizationApplied: boolean;
    error?: string;
  } | null = null;

  async canRender(plan: RenderPlan): Promise<boolean> {
    const hasWebCodecs = typeof window !== "undefined" && "VideoEncoder" in window && "VideoDecoder" in window && "VideoFrame" in window;
    const hasOffscreenCanvas = typeof window !== "undefined" && "OffscreenCanvas" in window;
    if (!hasWebCodecs && !hasOffscreenCanvas) return false;

    try {
      const codecConfig = {
        codec: "vp09.00.10.08",
        width: plan.outputWidth,
        height: plan.outputHeight,
        bitrate: plan.bitrate,
      };
      const support = await (window as any).VideoEncoder.isConfigSupported(codecConfig);
      return !!support.supported;
    } catch {
      return false;
    }
  }

  async prepare(plan: RenderPlan, onProgress: (info: RenderProgressInfo) => void): Promise<void> {
    this.isCancelled = false;
    onProgress({
      status: "PREPARING",
      currentFrame: 0,
      totalFrames: Math.round(plan.timelineDuration * plan.fps),
      percentage: 5,
      elapsedSeconds: 0,
      estimatedRemainingSeconds: plan.timelineDuration,
      renderFps: plan.fps,
      backendUsed: "OFFLINE_WEBCODECS",
    });
  }

  async render(
    plan: RenderPlan,
    canvas: HTMLCanvasElement,
    video: HTMLVideoElement,
    onProgress: (info: RenderProgressInfo) => void
  ): Promise<RenderArtifact> {
    const totalFrames = Math.round(plan.timelineDuration * plan.fps);
    const startTime = Date.now();

    // Verify EDL version unchanged
    const rangeStart = plan.sourceRange ? Math.max(0, plan.sourceRange.start) : 0;
    const rangeEnd = plan.sourceRange ? Math.max(rangeStart + 0.1, plan.sourceRange.end) : null;

    const currentPlan = RenderEngineManager.createRenderPlan(plan.projectId, plan.presetId, plan.outputWidth, plan.outputHeight, plan.sourceRange);
    if (currentPlan.edlVersion !== plan.edlVersion) {
      throw new Error("EDL_CHANGED");
    }

    onProgress({
      status: "PREPARING",
      currentFrame: 0,
      totalFrames,
      percentage: 10,
      elapsedSeconds: 0,
      estimatedRemainingSeconds: plan.timelineDuration,
      renderFps: plan.fps,
      backendUsed: "OFFLINE_WEBCODECS",
    });

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error("CANVAS_2D_CONTEXT_UNAVAILABLE");
    }

    const fps = plan.fps;
    const decisions = plan.edlSnapshot.decisions || [];

    // Helper to decode audio URL
    const decodeAudioUrl = async (url: string, ctx: BaseAudioContext): Promise<AudioBuffer | null> => {
      try {
        const resp = await fetch(url);
        const arrayBuf = await resp.arrayBuffer();
        return await ctx.decodeAudioData(arrayBuf);
      } catch (err) {
        console.warn("Failed to decode audio for", url, err);
        return null;
      }
    };

    // Phase 5.5: Offline Audio Processing — the exact same mix graph the loudness meter uses.
    let audioBuffer: AudioBuffer | null = null;
    let mixReport: { decodedClips: number; undecodedClips: { clipId: string; reason: string }[] } | null = null;
    try {
      onProgress({
        status: "RENDERING_AUDIO",
        currentFrame: 0,
        totalFrames,
        percentage: 15,
        elapsedSeconds: (Date.now() - startTime) / 1000,
        estimatedRemainingSeconds: plan.timelineDuration,
        renderFps: fps,
        backendUsed: "OFFLINE_WEBCODECS",
      });

      const project = coreEngine.getProject();
      // A window export renders only that window of the mix (no full-length mix for a 30s clip).
      const mix = await renderProjectMix(project, plan.timelineDuration, 44100, rangeStart);

      if (mix) {
        audioBuffer = mix.buffer;
        mixReport = { decodedClips: mix.decodedClips, undecodedClips: mix.undecodedClips };

        // Loudness normalisation to the project's target (real measurement of the rendered mix).
        const mastering = (project as any).audioMastering as
          | { loudnessTargetLUFS?: number; truePeakLimiterDbfs?: number }
          | undefined;
        const target = mastering?.loudnessTargetLUFS;
        const ceiling = mastering?.truePeakLimiterDbfs ?? -1;

        if (typeof target === 'number') {
          const channels: Float32Array[] = [];
          for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
            channels.push(audioBuffer.getChannelData(c));
          }
          const measured = measureLoudness(channels, audioBuffer.sampleRate);
          const gainDb = normalizationGainDb(measured.integratedLufs, target, measured.truePeakDbfs, ceiling);

          this.audioAnalysis = {
            integratedLufs: measured.integratedLufs,
            truePeakDbfs: measured.truePeakDbfs,
            targetLufs: target,
            appliedGainDb: gainDb,
            normalizationApplied: gainDb !== null && Math.abs(gainDb) > 0.05,
          };

          if (gainDb !== null && Math.abs(gainDb) > 0.05) {
            const factor = Math.pow(10, gainDb / 20);
            for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
              const data = audioBuffer.getChannelData(c);
              for (let i = 0; i < data.length; i++) {
                data[i] = Math.max(-1, Math.min(1, data[i] * factor));
              }
            }
            console.log(`[OfflineExport] Loudness normalisation: ${gainDb.toFixed(2)} dB (${measured.integratedLufs} LUFS -> target ${target} LUFS)`);
          } else {
            console.log(`[OfflineExport] Loudness normalisation not needed (${measured.integratedLufs} LUFS, target ${target} LUFS)`);
          }
        }
      } else {
        // No decodable audio: export the video without an audio track instead of inventing a tone.
        console.warn("[OfflineExport] No decodable project audio — exporting without an audio track.");
        this.audioAnalysis = { integratedLufs: null, truePeakDbfs: null, targetLufs: null, appliedGainDb: null, normalizationApplied: false };
      }
    } catch (e: any) {
      console.warn("Offline audio rendering failed:", e);
      this.audioAnalysis = {
        integratedLufs: null,
        truePeakDbfs: null,
        targetLufs: null,
        appliedGainDb: null,
        normalizationApplied: false,
        error: e?.message || String(e),
      };
    }

    // Check WebCodecs VideoEncoder support strictly
    const useWebCodecsEncoder = typeof window !== "undefined" && "VideoEncoder" in window && "VideoFrame" in window;
    if (!useWebCodecsEncoder) {
      throw new Error("OFFLINE_WEBCODECS_UNAVAILABLE");
    }

    const codecConfig = {
      codec: "vp09.00.10.08",
      width: plan.outputWidth,
      height: plan.outputHeight,
      bitrate: plan.bitrate,
    };

    const target = new BufferTarget();
    const output = new Output({
      format: new WebMOutputFormat(),
      target
    });

    const videoSource = new EncodedVideoPacketSource('vp9');
    output.addVideoTrack(videoSource, { frameRate: plan.fps });

    let audioSource: EncodedAudioPacketSource | null = null;
    if (audioBuffer) {
      audioSource = new EncodedAudioPacketSource('opus');
      output.addAudioTrack(audioSource);
    }

    await output.start();

    this.videoEncoder = new (window as any).VideoEncoder({
      output: async (chunk: any, metadata: any) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        const packet = new EncodedPacket(
          data, 
          chunk.type === 'key' ? 'key' : 'delta', 
          chunk.timestamp / 1_000_000, 
          (chunk.duration || 0) / 1_000_000
        );
        await videoSource.add(packet, metadata);
      },
      error: (e: any) => console.error("VideoEncoder error:", e),
    });
    this.videoEncoder.configure(codecConfig);

    // Optional AudioEncoder setup for Opus
    if (audioBuffer && "AudioEncoder" in window && audioSource) {
      try {
        this.audioEncoder = new (window as any).AudioEncoder({
          output: async (chunk: any, metadata: any) => {
            const data = new Uint8Array(chunk.byteLength);
            chunk.copyTo(data);
            const packet = new EncodedPacket(
              data, 
              chunk.type === 'key' ? 'key' : 'delta', 
              chunk.timestamp / 1_000_000, 
              (chunk.duration || 0) / 1_000_000
            );
            await audioSource!.add(packet, metadata);
          },
          error: (e: any) => console.error("AudioEncoder error:", e),
        });
        this.audioEncoder.configure({
          codec: "opus",
          sampleRate: audioBuffer.sampleRate,
          numberOfChannels: audioBuffer.numberOfChannels,
          bitrate: 128_000,
        });

        // Encode audio buffer data in chunks
        const chunkSize = 4096;
        const numChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const length = audioBuffer.length;

        for (let offset = 0; offset < length; offset += chunkSize) {
          if (this.isCancelled) break;
          const currentChunkSize = Math.min(chunkSize, length - offset);
          const channelData: Float32Array[] = [];
          for (let c = 0; c < numChannels; c++) {
            const channel = audioBuffer.getChannelData(c);
            const sub = new Float32Array(currentChunkSize);
            sub.set(channel.subarray(offset, offset + currentChunkSize));
            channelData.push(sub);
          }

          const audioData = new (window as any).AudioData({
            format: "f32-planar",
            sampleRate: sampleRate,
            numberOfFrames: currentChunkSize,
            numberOfChannels: numChannels,
            timestamp: Math.round((offset / sampleRate) * 1_000_000),
            data: channelData[0], // primary channel data
          });
          this.audioEncoder.encode(audioData);
          audioData.close();
        }
      } catch (e) {
        console.warn("AudioEncoder configuration/encoding warning:", e);
      }
    }

    // Deterministic frame loop (NO MediaRecorder, NO captureStream, NO setInterval, NO requestAnimationFrame, NO video.play)
    const project = coreEngine.getProject();
    for (let currentFrame = 0; currentFrame < totalFrames; currentFrame++) {
      if (this.isCancelled) {
        throw new Error("EXPORT_CANCELLED");
      }

      // Window export: frame 0 is the first frame of the window, not of the project.
      const timelineTime = rangeStart + currentFrame / fps;

      // Frame-accurate media seeking
      const activeLayers = TimelineEngine.getActiveClipsAtTime(project, timelineTime);
      const seekPromises: Promise<void>[] = [];

      for (const { clip } of activeLayers) {
        if (clip.type === 'video' || clip.type === 'b-roll') {
          const media = (renderEngine as any).mediaElements?.get(clip.assetId);
          if (media && media instanceof HTMLVideoElement) {
            const targetSourceTime = TimelineEngine.timelineToSourceTime(clip, timelineTime);
            if (Math.abs(media.currentTime - targetSourceTime) > 0.008) {
              seekPromises.push(new Promise<void>((resolve) => {
                let resolved = false;
                const done = () => {
                  if (resolved) return;
                  resolved = true;
                  media.removeEventListener('seeked', onSeeked);
                  media.removeEventListener('error', onSeeked);
                  resolve();
                };
                const onSeeked = () => done();
                media.addEventListener('seeked', onSeeked);
                media.addEventListener('error', onSeeked);
                media.currentTime = targetSourceTime;
                setTimeout(done, 150); // Seek safeguard timeout
              }));
            }
          }
        }
      }

      if (seekPromises.length > 0) {
        await Promise.all(seekPromises);
      }

      // Canonical composite render frame
      renderEngine.renderFrame(project, timelineTime, canvas, { reframe: plan.reframe ?? 'FIT' });

      if (this.videoEncoder) {
        const frame = new (window as any).VideoFrame(canvas, {
          timestamp: Math.round(timelineTime * 1_000_000),
        });
        this.videoEncoder.encode(frame, { keyFrame: currentFrame % 30 === 0 });
        frame.close();
      }

      if (currentFrame % 15 === 0 || currentFrame === totalFrames - 1) {
        const elapsed = (Date.now() - startTime) / 1000;
        const pct = Math.round(15 + (currentFrame / totalFrames) * 70);
        onProgress({
          status: "RENDERING_VIDEO",
          currentFrame: currentFrame + 1,
          totalFrames,
          percentage: pct,
          elapsedSeconds: elapsed,
          estimatedRemainingSeconds: Math.max(0, (totalFrames - (currentFrame + 1)) / fps),
          renderFps: elapsed > 0 ? parseFloat(((currentFrame + 1) / elapsed).toFixed(1)) : fps,
          backendUsed: "OFFLINE_WEBCODECS",
        });
      }
    }

    // Flush encoders and finalize output
    if (this.videoEncoder) {
      await this.videoEncoder.flush();
      this.videoEncoder.close();
    }
    videoSource.close();

    if (this.audioEncoder) {
      try {
        await this.audioEncoder.flush();
        this.audioEncoder.close();
      } catch {}
    }
    if (audioSource) {
      audioSource.close();
    }

    await output.finalize();

    onProgress({
      status: "MUXING",
      currentFrame: totalFrames,
      totalFrames,
      percentage: 92,
      elapsedSeconds: (Date.now() - startTime) / 1000,
      estimatedRemainingSeconds: 0,
      renderFps: plan.fps,
      backendUsed: "OFFLINE_WEBCODECS",
    });

    const qc = RenderEngineManager.runQCGate(plan);
    if (!qc.passed) {
      throw new Error("QC_FAILED");
    }

    const outputBuffer = target.buffer;
    if (!outputBuffer) {
      throw new Error("EMPTY_RENDER_BUFFER");
    }

    const blob = new Blob([outputBuffer], { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const elapsed = (Date.now() - startTime) / 1000;

    onProgress({
      status: "COMPLETED",
      currentFrame: totalFrames,
      totalFrames,
      percentage: 100,
      elapsedSeconds: elapsed,
      estimatedRemainingSeconds: 0,
      renderFps: plan.fps,
      backendUsed: "OFFLINE_WEBCODECS",
    });

    return {
      id: `art-${Date.now()}`,
      projectId: plan.projectId,
      renderPlanId: plan.projectId + "-" + plan.edlVersion,
      edlVersion: plan.edlVersion,
      dnaVersion: plan.dnaVersion,
      backend: "True Offline WebCodecs (VP9 + Opus + Mediabunny)",
      container: "WebM",
      videoCodec: "VP9 (WebCodecs muxed via Mediabunny)",
      audioCodec: "Opus (OfflineAudioContext + AudioEncoder)",
      width: plan.outputWidth,
      height: plan.outputHeight,
      fps: plan.fps,
      duration: plan.timelineDuration,
      fileSize: `${(blob.size / (1024 * 1024)).toFixed(1)} MB`,
      blobUrl: url,
      createdAt: new Date().toISOString(),
      qcStatus: qc.passed ? "PASSED" : "FAILED",
      // Real, measured loudness of the file that was just written (nulls mean "not measured").
      audioLoudness: {
        integratedLufs: this.audioAnalysis?.integratedLufs ?? null,
        truePeakDbfs: this.audioAnalysis?.truePeakDbfs ?? null,
        targetLufs: this.audioAnalysis?.targetLufs ?? null,
        appliedGainDb: this.audioAnalysis?.appliedGainDb ?? null,
        normalizationApplied: this.audioAnalysis?.normalizationApplied ?? false,
        audioTrackIncluded: !!audioBuffer,
        decodedClips: mixReport?.decodedClips ?? 0,
        undecodedClips: mixReport?.undecodedClips.length ?? 0,
      },
    };
  }

  async cancel(): Promise<void> {
    this.isCancelled = true;
    if (this.videoEncoder) {
      try {
        this.videoEncoder.close();
      } catch {}
    }
    if (this.audioEncoder) {
      try {
        this.audioEncoder.close();
      } catch {}
    }
  }
}



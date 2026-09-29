import { RenderPlan } from "../types/renderEngine";
import { projectToOutputMapping, mapXToOutput, mapYToOutput, OutputMapping } from "../core/captions/captionPlan";
import { RenderArtifact, RenderProgressInfo } from "./renderCapabilities";
import { RenderBackend } from "./RenderBackend";
import { RenderEngineManager } from "../utils/renderEngineManager";
import { coreEngine } from "../core/index";
import { ensureProjectMediaElements, MediaLinkReport } from "../core/render/mediaElements";

export class RealtimeCanvasBackend implements RenderBackend {
  id = "REALTIME_CANVAS_FALLBACK";
  name = "Realtime Browser Canvas + MediaRecorder Fallback";
  isOffline = false;

  private isCancelled = false;
  private mediaRecorder: MediaRecorder | null = null;
  private checkInterval: any = null;
  private drawRaf: number | null = null;

  /**
   * Paints the real media element into the output canvas on every animation frame.
   *
   * Without this the recorder captured an untouched (hidden) canvas, so the fallback export
   * produced a blank video that was still reported as COMPLETED. Caption/text clips are
   * composited from the canonical project so preview and output stay consistent.
   */
  private startFrameDrawing(plan: RenderPlan, canvas: HTMLCanvasElement, video: HTMLVideoElement): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = plan.outputWidth;
    canvas.height = plan.outputHeight;

    const draw = () => {
      this.drawRaf = null;
      if (this.isCancelled) return;

      const w = canvas.width;
      const h = canvas.height;

      try {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, w, h);

        // Same geometry as the offline compositor: the project frame is mapped into the export
        // canvas with COVER, so a vertical export is filled instead of letterboxed and the caption
        // placement stays the measured one.
        const projectSettings = coreEngine.getProject().settings;
        const mapping = projectToOutputMapping(
          { width: projectSettings.width, height: projectSettings.height },
          { width: w, height: h }
        );

        const vw = video.videoWidth || w;
        const vh = video.videoHeight || h;
        const scale = Math.max(w / vw, h / vh);
        const dw = vw * scale;
        const dh = vh * scale;
        ctx.drawImage(video, (w - dw) / 2, (h - dh) / 2, dw, dh);

        this.drawActiveTextClips(ctx, video.currentTime, mapping);
      } catch (err) {
        // A draw failure must not abort a recording that is otherwise producing frames.
        console.warn("[RealtimeBackend] frame draw skipped:", err);
      }

      this.drawRaf = requestAnimationFrame(draw);
    };

    this.drawRaf = requestAnimationFrame(draw);
  }

  /**
   * Composites active caption/text clips from the canonical project onto the canvas.
   *
   * Clip geometry lives in project pixels; the mapping is the same one the compositor uses, so the
   * fallback draws captions where the offline render puts them.
   */
  private drawActiveTextClips(ctx: CanvasRenderingContext2D, time: number, mapping: OutputMapping): void {
    const project = coreEngine.getProject();
    // Text/caption clips can live on caption tracks or on video tracks — take them by clip type.
    const clips = project.tracks
      .flatMap(t => t.clips)
      .filter(c => c.type === "caption" || c.type === "text");

    for (const clip of clips) {
      const start = clip.timelineStart ?? clip.start ?? 0;
      const end = start + clip.duration;
      if (time < start || time >= end) continue;

      const cfg = clip.textConfig;
      if (!cfg?.content) continue;

      const h = mapping.outputHeight;
      const fontSize = (cfg.fontSize || Math.round(h * 0.06)) * mapping.scale;
      const x = mapXToOutput(mapping, (coreEngine.getProject().settings.width / 2) + (clip.positionX || 0));
      const y = mapYToOutput(mapping, (coreEngine.getProject().settings.height / 2) + (clip.positionY || 0));

      ctx.save();
      ctx.font = `${cfg.fontWeight || "bold"} ${fontSize}px ${cfg.fontFamily || "Inter, sans-serif"}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (cfg.backgroundColor) {
        const metrics = ctx.measureText(cfg.content);
        const padX = fontSize * 0.4;
        const padY = fontSize * 0.25;
        ctx.fillStyle = cfg.backgroundColor;
        ctx.fillRect(
          x - metrics.width / 2 - padX,
          y - fontSize / 2 - padY,
          metrics.width + padX * 2,
          fontSize + padY * 2
        );
      }

      if (cfg.strokeColor && cfg.strokeWidth) {
        ctx.lineWidth = cfg.strokeWidth;
        ctx.strokeStyle = cfg.strokeColor;
        ctx.strokeText(cfg.content, x, y);
      }

      ctx.fillStyle = cfg.color || "#ffffff";
      ctx.fillText(cfg.content, x, y);
      ctx.restore();
    }
  }

  private stopFrameDrawing(): void {
    if (this.drawRaf !== null) {
      cancelAnimationFrame(this.drawRaf);
      this.drawRaf = null;
    }
  }

  async canRender(_plan: RenderPlan): Promise<boolean> {
    return typeof window !== "undefined" && typeof MediaRecorder !== "undefined";
  }

  /** What the last prepare() really linked / failed to link (never an assumption). */
  private mediaLinkReport: MediaLinkReport | null = null;

  getMediaLinkReport(): MediaLinkReport | null {
    return this.mediaLinkReport;
  }

  async prepare(plan: RenderPlan, onProgress: (info: RenderProgressInfo) => void): Promise<void> {
    this.isCancelled = false;

    // The compositor draws DOM elements and the mixer decodes their URL — link the canonical
    // project's media before any frame is rendered, and refuse to "succeed" with missing picture.
    const project = coreEngine.getProject();
    const linkReport = await ensureProjectMediaElements(project);
    this.mediaLinkReport = linkReport;
    const visualMissing = project.tracks
      .filter(track => track.type === 'video' || track.type === 'b-roll')
      .flatMap(track => track.clips)
      .filter(clip => (clip.type === 'video' || clip.type === 'image') && clip.assetId)
      .map(clip => clip.assetId as string)
      .filter(assetId => linkReport.failed.some(failure => failure.assetId === assetId));
    if (visualMissing.length > 0) {
      const names = linkReport.failed
        .filter(failure => visualMissing.includes(failure.assetId))
        .map(failure => failure.name)
        .join(', ');
      throw new Error(`MEDIA_NOT_LINKED: ${names}`);
    }

    onProgress({
      status: "PREPARING",
      currentFrame: 0,
      totalFrames: Math.round(plan.timelineDuration * plan.fps),
      percentage: 5,
      elapsedSeconds: 0,
      estimatedRemainingSeconds: plan.timelineDuration,
      renderFps: plan.fps,
      backendUsed: "REALTIME_CANVAS_FALLBACK",
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
    const rangeStart = plan.sourceRange ? Math.max(0, plan.sourceRange.start) : 0;
    const rangeEnd = plan.sourceRange
      ? Math.max(rangeStart + 0.1, plan.sourceRange.end)
      : (plan.timelineDuration || 15);

    // Verify EDL version unchanged
    const currentPlan = RenderEngineManager.createRenderPlan(plan.projectId, plan.presetId, plan.outputWidth, plan.outputHeight, plan.sourceRange);
    if (currentPlan.edlVersion !== plan.edlVersion) {
      throw new Error("EDL_CHANGED");
    }

    onProgress({
      status: "RENDERING_VIDEO",
      currentFrame: 0,
      totalFrames,
      percentage: 10,
      elapsedSeconds: 0,
      estimatedRemainingSeconds: plan.timelineDuration,
      renderFps: plan.fps,
      backendUsed: "REALTIME_CANVAS_FALLBACK",
    });

    // Window export starts at the window, not at the beginning of the project.
    video.currentTime = rangeStart;
    await video.play();

    // The recorder must capture real pixels — start compositing before captureStream().
    this.startFrameDrawing(plan, canvas, video);

    const stream = canvas.captureStream(plan.fps);
    try {
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaElementSource(video);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      source.connect(audioCtx.destination);
      const audioTrack = dest.stream.getAudioTracks()[0];
      if (audioTrack) {
        stream.addTrack(audioTrack);
      }
    } catch {
      // audio stream fallback
    }

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";

    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: plan.bitrate,
    });

    const recordedChunks: Blob[] = [];
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error("ENCODE_FAILED"));
        return;
      }

      this.mediaRecorder.onstop = () => {
        this.stopFrameDrawing();
        if (this.isCancelled) {
          reject(new Error("EXPORT_CANCELLED"));
          return;
        }

        onProgress({
          status: "MUXING",
          currentFrame: totalFrames,
          totalFrames,
          percentage: 85,
          elapsedSeconds: (Date.now() - startTime) / 1000,
          estimatedRemainingSeconds: 0,
          renderFps: plan.fps,
          backendUsed: "REALTIME_CANVAS_FALLBACK",
        });

        setTimeout(() => {
          onProgress({
            status: "QC",
            currentFrame: totalFrames,
            totalFrames,
            percentage: 95,
            elapsedSeconds: (Date.now() - startTime) / 1000,
            estimatedRemainingSeconds: 0,
            renderFps: plan.fps,
            backendUsed: "REALTIME_CANVAS_FALLBACK",
          });

          const qc = RenderEngineManager.runQCGate(plan);
          if (!qc.passed) {
            reject(new Error("QC_FAILED"));
            return;
          }

          const blob = new Blob(recordedChunks, { type: "video/webm" });
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
            backendUsed: "REALTIME_CANVAS_FALLBACK",
          });

          resolve({
            id: `art-${Date.now()}`,
            projectId: plan.projectId,
            renderPlanId: plan.projectId + "-" + plan.edlVersion,
            edlVersion: plan.edlVersion,
            dnaVersion: plan.dnaVersion,
            backend: "Realtime Browser Canvas + MediaRecorder",
            container: "WebM",
            videoCodec: "VP9/VP8",
            audioCodec: "Opus",
            width: plan.outputWidth,
            height: plan.outputHeight,
            fps: plan.fps,
            duration: plan.timelineDuration,
            fileSize: `${(blob.size / (1024 * 1024)).toFixed(1)} MB`,
            blobUrl: url,
            createdAt: new Date().toISOString(),
            qcStatus: qc.passed ? "PASSED" : "FAILED",
          });
        }, 500);
      };

      this.mediaRecorder.start(250);

      this.checkInterval = setInterval(() => {
        if (this.isCancelled) {
          clearInterval(this.checkInterval);
          this.stopFrameDrawing();
          if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
            this.mediaRecorder.stop();
          }
          video.pause();
          reject(new Error("EXPORT_CANCELLED"));
          return;
        }

        const currentTime = video.currentTime;
        const curFrame = Math.min(totalFrames, Math.round((currentTime - rangeStart) * plan.fps));
        const windowPosition = Math.max(0, currentTime - rangeStart);
        const pct = Math.min(80, Math.round(15 + (windowPosition / (plan.timelineDuration || 15)) * 65));
        const elapsed = (Date.now() - startTime) / 1000;
        const fpsReal = elapsed > 0 ? curFrame / elapsed : plan.fps;

        onProgress({
          status: "RENDERING_VIDEO",
          currentFrame: curFrame,
          totalFrames,
          percentage: pct,
          elapsedSeconds: elapsed,
          estimatedRemainingSeconds: Math.max(0, (plan.timelineDuration - windowPosition)),
          renderFps: parseFloat(fpsReal.toFixed(1)),
          backendUsed: "REALTIME_CANVAS_FALLBACK",
        });

        if (video.ended || currentTime >= rangeEnd - 0.2) {
          clearInterval(this.checkInterval);
          this.stopFrameDrawing();
          if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
            this.mediaRecorder.stop();
          }
          video.pause();
        }
      }, 200);
    });
  }

  async cancel(): Promise<void> {
    this.isCancelled = true;
    this.stopFrameDrawing();
    if (this.checkInterval) clearInterval(this.checkInterval);
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
  }
}

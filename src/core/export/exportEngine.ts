/**
 * Hardware-Accelerated Export Engine
 * Encodes project video frame-by-frame offline using WebCodecs & Mediabunny.
 */

import { ProjectModel } from '../types/project';
import { TimelineEngine } from '../timeline/timelineEngine';
import { renderEngine } from '../render/renderEngine';
import { Output, BufferTarget, WebMOutputFormat, CanvasSource } from 'mediabunny';

export interface ExportProgress {
  currentFrame: number;
  totalFrames: number;
  percentage: number; // 0 to 100
  fps: number;
  estimatedTimeRemainingSec: number;
  isComplete: boolean;
  error?: string;
}

export type ExportProgressListener = (progress: ExportProgress) => void;

export class ExportEngine {
  private isExporting: boolean = false;
  private shouldCancel: boolean = false;

  /**
   * Performs offscreen frame-by-frame rendering and WebCodecs encoding.
   */
  public async exportProject(
    project: ProjectModel,
    onProgress: ExportProgressListener
  ): Promise<Blob> {
    if (this.isExporting) {
      throw new Error('An export is already in progress.');
    }

    this.isExporting = true;
    this.shouldCancel = false;

    const { width, height, fps } = project.settings;
    const duration = TimelineEngine.calculateProjectDuration(project);
    const totalFrames = Math.ceil(duration * fps);

    // Create Offscreen canvas for background rendering
    const offscreenCanvas = new OffscreenCanvas(width, height);
    const canvas2d = offscreenCanvas as unknown as HTMLCanvasElement;

    // WebM Muxer target via Mediabunny
    const target = new BufferTarget();
    const output = new Output({
      format: new WebMOutputFormat(),
      target
    });

    const videoSource = new CanvasSource(offscreenCanvas, {
      codec: 'vp9',
      bitrate: 8_000_000
    });
    output.addVideoTrack(videoSource, { frameRate: fps });

    await output.start();

    const startTime = performance.now();

    try {
      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        if (this.shouldCancel) {
          videoSource.close();
          await output.finalize();
          this.isExporting = false;
          throw new Error('Export cancelled by user.');
        }

        const currentTime = frameIndex / fps;

        // Render frame onto offscreen canvas
        renderEngine.renderFrame(project, currentTime, canvas2d);

        // Feed canvas frame to Mediabunny CanvasSource
        await videoSource.add(currentTime);

        // Report Progress
        const elapsedMs = performance.now() - startTime;
        const currentFps = ((frameIndex + 1) / (elapsedMs / 1000)) || fps;
        const remainingFrames = totalFrames - (frameIndex + 1);
        const estTimeSec = Math.ceil(remainingFrames / currentFps);

        onProgress({
          currentFrame: frameIndex + 1,
          totalFrames,
          percentage: Math.min(100, Math.round(((frameIndex + 1) / totalFrames) * 100)),
          fps: Math.round(currentFps),
          estimatedTimeRemainingSec: Math.max(0, estTimeSec),
          isComplete: false
        });

        // Yield event loop to prevent UI freezing
        if (frameIndex % 5 === 0) {
          await new Promise(r => setTimeout(r, 0));
        }
      }

      videoSource.close();
      await output.finalize();

      this.isExporting = false;

      onProgress({
        currentFrame: totalFrames,
        totalFrames,
        percentage: 100,
        fps: 30,
        estimatedTimeRemainingSec: 0,
        isComplete: true
      });

      const buffer = target.buffer;
      if (!buffer) throw new Error('Export buffer is empty.');

      const blob = new Blob([buffer], { type: 'video/webm' });
      return blob;
    } catch (err) {
      this.isExporting = false;
      throw err;
    }
  }

  public cancelExport(): void {
    if (this.isExporting) {
      this.shouldCancel = true;
    }
  }

  public getIsExporting(): boolean {
    return this.isExporting;
  }
}

export const exportEngine = new ExportEngine();

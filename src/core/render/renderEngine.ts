/**
 * Non-Destructive Compositor & Render Engine
 * Renders multi-track video, image, text, caption, and filter layers onto a target Canvas.
 */

import { ProjectModel, ClipModel } from '../types/project';
import { TimelineEngine } from '../timeline/timelineEngine';

export class RenderEngine {
  private static instance: RenderEngine | null = null;
  private mediaElements: Map<string, HTMLVideoElement | HTMLImageElement> = new Map();

  private constructor() {}

  public static getInstance(): RenderEngine {
    if (!RenderEngine.instance) {
      RenderEngine.instance = new RenderEngine();
    }
    return RenderEngine.instance;
  }

  /**
   * Registers a media DOM element source for canvas drawing.
   */
  public registerMediaElement(assetId: string, element: HTMLVideoElement | HTMLImageElement): void {
    this.mediaElements.set(assetId, element);
  }

  /**
   * Main non-destructive composite render loop.
   * Renders the project frame at playhead Time `t` on target Canvas.
   */
  public renderFrame(
    project: ProjectModel,
    currentTime: number,
    canvas: HTMLCanvasElement
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height, backgroundColor } = project.settings;

    // Synchronize canvas buffer resolution
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    // 1. Draw Background
    ctx.fillStyle = backgroundColor || '#000000';
    ctx.fillRect(0, 0, width, height);

    // 2. Get active clips at time `t` ordered by track z-index
    const activeLayers = TimelineEngine.getActiveClipsAtTime(project, currentTime);

    // 3. Render layers
    for (const { clip } of activeLayers) {
      ctx.save();

      const clipTimeOffset = (currentTime - clip.start) * clip.speed;

      // Compute keyframe animated values
      const scale = TimelineEngine.interpolateKeyframeValue(
        clip.keyframes,
        'scale',
        clipTimeOffset,
        clip.scale
      ) / 100;

      const opacity = TimelineEngine.interpolateKeyframeValue(
        clip.keyframes,
        'opacity',
        clipTimeOffset,
        clip.opacity
      ) / 100;

      const positionX = TimelineEngine.interpolateKeyframeValue(
        clip.keyframes,
        'positionX',
        clipTimeOffset,
        clip.positionX
      );

      const positionY = TimelineEngine.interpolateKeyframeValue(
        clip.keyframes,
        'positionY',
        clipTimeOffset,
        clip.positionY
      );

      const rotation = TimelineEngine.interpolateKeyframeValue(
        clip.keyframes,
        'rotation',
        clipTimeOffset,
        clip.rotation
      );

      ctx.globalAlpha = opacity;

      // Translate to Canvas Center + Offset
      const centerX = width / 2 + positionX;
      const centerY = height / 2 + positionY;

      ctx.translate(centerX, centerY);
      if (rotation !== 0) {
        ctx.rotate((rotation * Math.PI) / 180);
      }
      ctx.scale(scale, scale);

      // Render Clip Content according to Type
      if (clip.type === 'video' || clip.type === 'b-roll' || clip.type === 'image') {
        this.renderMediaClip(ctx, clip, width, height);
      } else if (clip.type === 'text' || clip.type === 'caption') {
        this.renderTextClip(ctx, clip, width, height);
      }

      ctx.restore();
    }
  }

  private renderMediaClip(
    ctx: CanvasRenderingContext2D,
    clip: ClipModel,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    if (!clip.assetId) return;
    const media = this.mediaElements.get(clip.assetId);
    if (!media) return;

    let mediaWidth = canvasWidth;
    let mediaHeight = canvasHeight;

    if (media instanceof HTMLVideoElement) {
      mediaWidth = media.videoWidth || canvasWidth;
      mediaHeight = media.videoHeight || canvasHeight;
    } else if (media instanceof HTMLImageElement) {
      mediaWidth = media.naturalWidth || canvasWidth;
      mediaHeight = media.naturalHeight || canvasHeight;
    }

    // Apply Filters if defined
    if (clip.filter && clip.filter !== 'NONE') {
      ctx.filter = this.getCanvasFilterCSS(clip.filter);
    }

    // Draw centered
    ctx.drawImage(media, -mediaWidth / 2, -mediaHeight / 2, mediaWidth, mediaHeight);

    // Reset filter
    ctx.filter = 'none';
  }

  private renderTextClip(
    ctx: CanvasRenderingContext2D,
    clip: ClipModel,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    if (!clip.textConfig) return;

    const { content, fontFamily, fontSize, color, strokeColor, strokeWidth, backgroundColor } = clip.textConfig;

    ctx.font = `${clip.textConfig.fontWeight || 'bold'} ${fontSize}px ${fontFamily || 'Inter, sans-serif'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textMetrics = ctx.measureText(content);
    const textWidth = textMetrics.width;
    const textHeight = fontSize * 1.2;

    // Draw Background
    if (backgroundColor) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(-textWidth / 2 - 12, -textHeight / 2 - 6, textWidth + 24, textHeight + 12);
    }

    // Draw Stroke
    if (strokeColor && strokeWidth) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.strokeText(content, 0, 0);
    }

    // Draw Text Fill
    ctx.fillStyle = color || '#ffffff';
    ctx.fillText(content, 0, 0);
  }

  private getCanvasFilterCSS(filter: string): string {
    switch (filter) {
      case 'TEAL_ORANGE':
        return 'contrast(120%) saturate(130%) hue-rotate(-10deg)';
      case 'CINEMATIC':
        return 'contrast(110%) brightness(95%) saturate(85%)';
      case 'VINTAGE':
        return 'sepia(40%) contrast(100%) brightness(90%)';
      case 'BW':
        return 'grayscale(100%) contrast(120%)';
      case 'WARM':
        return 'sepia(20%) saturate(120%)';
      case 'COOL':
        return 'hue-rotate(15deg) saturate(110%)';
      default:
        return 'none';
    }
  }
}

export const renderEngine = RenderEngine.getInstance();

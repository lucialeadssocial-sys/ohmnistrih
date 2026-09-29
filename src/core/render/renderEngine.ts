/**
 * Non-Destructive Compositor & Render Engine
 * Renders multi-track video, image, text, caption, and filter layers onto a target Canvas.
 */

import { ProjectModel, ClipModel } from '../types/project';
import { computeReframeTransform, ReframeMode } from './reframe';
import { SubjectSample, subjectAt, subjectInMedia } from '../vision/subjectTrack';
import { TimelineEngine } from '../timeline/timelineEngine';
import { computeClipTransitionState } from './transitionMath';
import { projectToOutputMapping } from '../captions/captionPlan';

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
  /** Reframe mode of the frame currently being rendered (set by renderFrame). */
  private activeReframe: ReframeMode = 'FIT';
  /** Whether the measured subject track may move the crop (user-controlled). */
  private activeTrackSubject = true;
  /** Measured subject sample that belongs to the layer being drawn (null = no measurement). */
  private activeSubject: SubjectSample | null = null;

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
    canvas: HTMLCanvasElement,
    options?: {
      reframe?: ReframeMode;
      trackSubject?: boolean;
      /** Export frame. The project composition is mapped into it with COVER (used by 9:16 exports). */
      output?: { width: number; height: number };
    }
  ): void {
    // COVER fills the output frame (used by the social/vertical exports); FIT keeps the legacy
    // native-size drawing. Nothing here tracks a face — see core/render/reframe.ts.
    this.activeReframe = options?.reframe ?? 'FIT';
    // Measured faces only move the crop while the user wants auto-reframe.
    this.activeTrackSubject = options?.trackSubject !== false;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height, backgroundColor } = project.settings;

    // The export may ask for a different frame (9:16 Short) than the project composition. In that
    // case the canvas is the export size and the whole project frame is mapped into it with COVER —
    // the same mapping the caption placement maths uses, so a measured placement is the real one.
    const output = options?.output && options.output.width > 0 && options.output.height > 0
      ? { width: options.output.width, height: options.output.height }
      : null;
    const mapping = output ? projectToOutputMapping({ width, height }, output) : null;
    const targetWidth = output ? output.width : width;
    const targetHeight = output ? output.height : height;

    // Synchronize canvas buffer resolution
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    // 1. Draw Background
    ctx.fillStyle = backgroundColor || '#000000';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    if (mapping) {
      ctx.save();
      ctx.translate(mapping.offsetX, mapping.offsetY);
      ctx.scale(mapping.scale, mapping.scale);
    }

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

      // Real transition state of this clip at this instant (fade / wipe / slide / zoom).
      // Previously clip.transitions was stored and editable but never affected a rendered pixel.
      const transitionState = computeClipTransitionState(clip, currentTime, width);

      ctx.globalAlpha = Math.min(1, Math.max(0, opacity * transitionState.alpha));

      // Wipe masks are applied in canvas space, before the clip transform.
      if (transitionState.reveal) {
        const visibleWidth = width * transitionState.reveal.progress;
        ctx.beginPath();
        if (transitionState.reveal.from === 'left') {
          ctx.rect(0, 0, visibleWidth, height);
        } else {
          ctx.rect(width - visibleWidth, 0, visibleWidth, height);
        }
        ctx.clip();
      }

      // Translate to Canvas Center + Offset
      const centerX = width / 2 + positionX + transitionState.offsetX;
      const centerY = height / 2 + positionY + transitionState.offsetY;

      ctx.translate(centerX, centerY);
      if (rotation !== 0) {
        ctx.rotate((rotation * Math.PI) / 180);
      }
      ctx.scale(scale * transitionState.scaleMultiplier, scale * transitionState.scaleMultiplier);

      // Measured subject for this layer (only when the editor has not framed the shot manually).
      const subjectSamples = project.analysisResults?.subjectTrack ?? [];
      this.activeSubject = null;
      if (this.activeTrackSubject && subjectSamples.length > 0 && positionX === 0 && positionY === 0) {
        this.activeSubject = subjectAt(subjectSamples, currentTime);
      }

      // Render Clip Content according to Type
      if (clip.type === 'video' || clip.type === 'b-roll' || clip.type === 'image') {
        this.renderMediaClip(ctx, clip, width, height);
      } else if (clip.type === 'text' || clip.type === 'caption') {
        this.renderTextClip(ctx, clip, width, height);
      }

      ctx.restore();
    }

    // Leave the canvas in the export frame (the composition transform was only for drawing).
    if (mapping) {
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

    // Fill the output frame when the export asks for it (uniform scale, aspect ratio preserved).
    // A measured subject sample shifts the crop so the speaker stays inside the visible area.
    const measuredSubject = this.activeSubject ? subjectInMedia(this.activeSubject, mediaWidth, mediaHeight) : null;
    const reframe = computeReframeTransform(mediaWidth, mediaHeight, canvasWidth, canvasHeight, this.activeReframe, {
      subject: measuredSubject,
    });
    if (reframe.scale !== 1) {
      ctx.scale(reframe.scale, reframe.scale);
    }
    if (reframe.offsetX !== 0 || reframe.offsetY !== 0) {
      ctx.translate(reframe.offsetX, reframe.offsetY);
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

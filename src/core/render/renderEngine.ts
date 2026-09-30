/**
 * Non-Destructive Compositor & Render Engine
 * Renders multi-track video, image, text, caption, and filter layers onto a target Canvas.
 */

import { ProjectModel, ClipModel } from '../types/project';
import { TimelineEngine } from '../timeline/timelineEngine';
import { buildCanonicalFramePlan, CanonicalLayer } from './canonicalFrame';

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

    // 2. Canonical plán snímky — JEDINÉ miesto, ktoré rozhoduje, čo sa kreslí.
    //    Náhľad aj export idú cez túto funkciu, takže sa nemôžu rozísť.
    const plan = buildCanonicalFramePlan(project, currentTime);

    // 3. Render layers (zdola nahor, presne v poradí z plánu)
    for (const layer of plan.layers) {
      const clip = findClipById(project, layer.clipId);
      if (!clip) continue;

      ctx.save();

      ctx.globalAlpha = layer.opacity / 100;

      // Translate to Canvas Center + Offset
      const centerX = width / 2 + layer.positionX;
      const centerY = height / 2 + layer.positionY;

      ctx.translate(centerX, centerY);
      if (layer.rotation !== 0) {
        ctx.rotate((layer.rotation * Math.PI) / 180);
      }
      ctx.scale(layer.scale / 100, layer.scale / 100);

      // Render Clip Content according to Type (obsah aj hodnoty berie z canonical plánu)
      if (layer.kind === 'media') {
        this.renderMediaClip(ctx, clip, width, height);
      } else if (layer.kind === 'text') {
        this.renderTextClip(ctx, clip, layer, width, height);
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
    layer: CanonicalLayer,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    if (!clip?.textConfig) return;

    // Obsah berie z canonical plánu — aby náhľad aj export kreslili to isté.
    const content = layer.text ?? clip.textConfig.content;
    if (!content) return;

    const { fontFamily, fontSize, color, strokeColor, strokeWidth, backgroundColor } = clip.textConfig;

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

/** Nájde klip podľa id v celom projekte (plán nesie len identifikátory). */
export function findClipById(project: ProjectModel, clipId: string): ClipModel | null {
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (clip.id === clipId) return clip;
    }
  }
  return null;
}

export const renderEngine = RenderEngine.getInstance();

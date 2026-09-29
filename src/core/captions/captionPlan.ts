import { ClipModel, ProjectModel, CaptionStyleConfig } from '../types/project';

/**
 * Caption planning for exports — pure maths, no DOM, no rendering.
 *
 * The renderer burns caption clips that exist on the canonical caption track, so everything here
 * works on the canonical project: which captions fall inside a Shorts window, where a caption
 * really sits on the output frame, and whether it falls into the area that social platforms cover
 * with their own UI.
 *
 * The safe-zone boundaries are documented CONVENTIONS of the platforms (the UI overlay zones), not
 * a measurement of a specific app version — the findings say so.
 */

export interface CaptionWindowItem {
  id: string;
  start: number;
  end: number;
  text: string;
  /** Length of the caption clip inside the exported window (seconds). */
  visibleSeconds: number;
  /** True when the caption starts before the window and is already on screen at the first frame. */
  startedBeforeWindow: boolean;
}

export interface CaptionWindowSummary {
  items: CaptionWindowItem[];
  /** Distinct caption texts in playback order. */
  texts: string[];
  /** Total seconds of the window covered by captions (clamped to the window). */
  coveredSeconds: number;
  windowSeconds: number;
  /** coveredSeconds / windowSeconds, rounded to 2 decimals (0 when the window is empty). */
  coverage: number;
  /** Seconds of the window with no caption on screen. */
  silentSeconds: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const round4 = (value: number) => Math.round(value * 10000) / 10000;
const clipStart = (clip: { timelineStart?: number; start?: number }) => clip.timelineStart ?? clip.start ?? 0;

export function captionClips(project: ProjectModel): ClipModel[] {
  return project.tracks
    .filter(track => track.type === 'caption' || track.type === 'video' || track.type === 'b-roll' || track.type === 'adjustment')
    .flatMap(track => track.clips)
    .filter(clip => clip.type === 'caption' || Boolean(clip.textConfig && clip.type === 'text'));
}

/** Captions that are visible at any moment inside [start, end], with the time they really cover. */
export function captionClipsInWindow(project: ProjectModel, start: number, end: number): CaptionWindowSummary {
  const windowSeconds = Math.max(0, end - start);
  const items: CaptionWindowItem[] = [];

  for (const clip of captionClips(project)) {
    const clipFrom = clipStart(clip);
    const clipTo = clipFrom + clip.duration;
    if (clipTo <= start || clipFrom >= end) continue;

    const visibleFrom = Math.max(clipFrom, start);
    const visibleTo = Math.min(clipTo, end);
    const text = (clip.textConfig?.content ?? '').trim();
    items.push({
      id: clip.id,
      start: round2(clipFrom),
      end: round2(clipTo),
      text,
      visibleSeconds: round2(Math.max(0, visibleTo - visibleFrom)),
      startedBeforeWindow: clipFrom < start,
    });
  }

  items.sort((a, b) => a.start - b.start);
  const coveredSeconds = round2(items.reduce((sum, item) => sum + item.visibleSeconds, 0));
  return {
    items,
    texts: items.map(item => item.text).filter(Boolean),
    coveredSeconds,
    windowSeconds: round2(windowSeconds),
    coverage: windowSeconds > 0 ? round2(coveredSeconds / windowSeconds) : 0,
    silentSeconds: round2(Math.max(0, windowSeconds - coveredSeconds)),
  };
}

/**
 * Where a caption really lands on the output frame.
 *
 * The renderer draws text centred on `canvasHeight / 2 + positionY` with a text box of about
 * `fontSize * 1.2` (plus 12 px when a background bar is drawn). That is what this measures.
 */
export interface CaptionPlacement {
  clipId: string;
  text: string;
  /** Measured box in output pixels. */
  boxTop: number;
  boxBottom: number;
  boxHeight: number;
  anchorY: number;
  fontSize: number;
  /** Safe area of the given canvas (documented platform convention). */
  safeTop: number;
  safeBottom: number;
  /** True when the whole box sits inside the safe area. */
  insideSafeZone: boolean;
  violations: ('BELOW_UI_ZONE' | 'ABOVE_SAFE_TOP')[];
  /** True for vertical (9:16-style) canvases, where platform UI overlays sit at the bottom. */
  verticalCanvas: boolean;
}

/** Documented convention for vertical social video (TikTok / Reels / Shorts UI overlays). */
export const VERTICAL_SAFE_ZONE = { top: 0.06, bottom: 0.86 };
/** Landscape deliverables (YouTube) keep a much smaller margin: no per-frame UI overlay. */
export const LANDSCAPE_SAFE_ZONE = { top: 0.04, bottom: 0.96 };

export function evaluateCaptionPlacement(
  clip: ClipModel,
  canvasWidth: number,
  canvasHeight: number
): CaptionPlacement | null {
  const text = clip.textConfig;
  if (!text || !text.content || text.content.trim().length === 0) return null;
  if (!(canvasHeight > 0) || !(canvasWidth > 0)) return null;

  const fontSize = text.fontSize;
  if (!Number.isFinite(fontSize) || fontSize <= 0) return null;

  const anchorY = canvasHeight / 2 + (clip.positionY ?? 0);
  const padding = text.backgroundColor ? 6 : 0;
  const half = (fontSize * 1.2) / 2 + padding;

  return evaluateCaptionBox(
    clip.id,
    text.content,
    anchorY - half,
    anchorY + half,
    canvasWidth,
    canvasHeight,
    fontSize,
    round2(anchorY)
  );
}

/** Vertical/horizontal safe-area evaluation of an already computed text box (output pixels). */
function evaluateCaptionBox(
  clipId: string,
  text: string,
  boxTop: number,
  boxBottom: number,
  canvasWidth: number,
  canvasHeight: number,
  fontSize: number,
  anchorY: number
): CaptionPlacement {
  const verticalCanvas = canvasHeight > canvasWidth;
  const zone = verticalCanvas ? VERTICAL_SAFE_ZONE : LANDSCAPE_SAFE_ZONE;
  const safeTop = round2(canvasHeight * zone.top);
  const safeBottom = round2(canvasHeight * zone.bottom);

  const violations: CaptionPlacement['violations'] = [];
  if (boxBottom > safeBottom) violations.push('BELOW_UI_ZONE');
  if (boxTop < safeTop) violations.push('ABOVE_SAFE_TOP');

  return {
    clipId,
    text,
    boxTop: round2(boxTop),
    boxBottom: round2(boxBottom),
    boxHeight: round2(boxBottom - boxTop),
    anchorY: round2(anchorY),
    fontSize,
    safeTop,
    safeBottom,
    insideSafeZone: violations.length === 0,
    violations,
    verticalCanvas,
  };
}

/**
 * Project canvas → export canvas mapping.
 *
 * The renderer composes the project frame (its own settings) and then maps it into the export
 * canvas with COVER: a uniform scale plus a centred crop. This is the same function the renderer
 * uses, so the placement measured here is the placement that really ends up in the file.
 */
export interface OutputMapping {
  scale: number;
  offsetX: number;
  offsetY: number;
  outputWidth: number;
  outputHeight: number;
}

export function projectToOutputMapping(
  projectCanvas: { width: number; height: number },
  outputCanvas: { width: number; height: number }
): OutputMapping {
  const projectWidth = projectCanvas.width > 0 ? projectCanvas.width : 1;
  const projectHeight = projectCanvas.height > 0 ? projectCanvas.height : 1;
  const outputWidth = outputCanvas.width > 0 ? outputCanvas.width : 1;
  const outputHeight = outputCanvas.height > 0 ? outputCanvas.height : 1;
  const scale = Math.max(outputWidth / projectWidth, outputHeight / projectHeight);
  return {
    scale: round4(scale),
    offsetX: round2((outputWidth - projectWidth * scale) / 2),
    offsetY: round2((outputHeight - projectHeight * scale) / 2),
    outputWidth,
    outputHeight,
  };
}

/** Maps a project-space Y into export pixels. */
export const mapYToOutput = (mapping: OutputMapping, projectY: number) => round2(projectY * mapping.scale + mapping.offsetY);

/** Maps a project-space X into export pixels. */
export const mapXToOutput = (mapping: OutputMapping, projectX: number) => round2(projectX * mapping.scale + mapping.offsetX);

/** Inverse of {@link mapYToOutput} — used to place a caption safely in both frames. */
export const mapYToProject = (mapping: OutputMapping, outputY: number) => (outputY - mapping.offsetY) / mapping.scale;

/** The same caption box, measured in the exported frame (what the viewer really sees). */
export function placementInOutput(
  placement: CaptionPlacement,
  mapping: OutputMapping
): CaptionPlacement & {
  outputWidth: number;
  outputHeight: number;
  scale: number;
  /** Where the caption centre lands horizontally in the export (exact, no text measurement). */
  anchorXInOutput: number;
} {
  const boxTop = mapYToOutput(mapping, placement.boxTop);
  const boxBottom = mapYToOutput(mapping, placement.boxBottom);
  const anchorY = mapYToOutput(mapping, placement.anchorY);
  const evaluated = evaluateCaptionBox(
    placement.clipId,
    placement.text,
    boxTop,
    boxBottom,
    mapping.outputWidth,
    mapping.outputHeight,
    round2(placement.fontSize * mapping.scale),
    anchorY
  );
  return {
    ...evaluated,
    outputWidth: mapping.outputWidth,
    outputHeight: mapping.outputHeight,
    scale: mapping.scale,
    anchorXInOutput: mapXToOutput(mapping, 0),
  };
}

/** Placements of the project measured in the export frame (optionally only some clips). */
export function captionPlacementsInOutput(
  project: ProjectModel,
  outputCanvas: { width: number; height: number },
  clipIds?: string[]
): (CaptionPlacement & { outputWidth: number; outputHeight: number; scale: number; anchorXInOutput: number })[] {
  const projectCanvas = {
    width: project.settings?.width || 1080,
    height: project.settings?.height || 1920,
  };
  const mapping = projectToOutputMapping(projectCanvas, outputCanvas);
  return captionClips(project)
    .filter(clip => !clipIds || clipIds.includes(clip.id))
    .map(clip => evaluateCaptionPlacement(clip, projectCanvas.width, projectCanvas.height))
    .filter((placement): placement is CaptionPlacement => placement !== null)
    .map(placement => placementInOutput(placement, mapping));
}

/** All caption placements of the project, in playback order. */
export function captionPlacements(project: ProjectModel, canvasWidth: number, canvasHeight: number): CaptionPlacement[] {
  return captionClips(project)
    .slice()
    .sort((a, b) => clipStart(a) - clipStart(b))
    .map(clip => evaluateCaptionPlacement(clip, canvasWidth, canvasHeight))
    .filter((placement): placement is CaptionPlacement => placement !== null);
}

/** Maps the caption studio's style to the canonical caption style (documented defaults kept). */
/**
 * Legibility floor for burned captions: 3 % of the output height. The same constant is used by the
 * quality check (a caption the app itself writes must never be flagged by the app's own QC), so the
 * renderer and the check can never drift apart.
 */
export const MIN_CAPTION_FONT_RATIO = 0.03;

/** Upper bound so a studio value cannot produce a caption that covers the frame. */
export const MAX_CAPTION_FONT_RATIO = 0.12;

/** Margin kept between the caption edge and the UI zone when a position is requested (output px). */
export const CAPTION_ZONE_MARGIN = 24;

/**
 * Offset from the canvas centre for a requested position, so the text box stays inside the safe area.
 *
 * The renderer draws text centred at `canvasHeight / 2 + positionY`; returning the offset here means
 * the studio's "top / middle / bottom" choice becomes a real, safe placement instead of being lost.
 */
export function captionPositionYFor(
  position: 'top' | 'middle' | 'bottom' | undefined,
  canvasHeight: number,
  fontSize: number,
  hasBackground = true,
  canvasWidth?: number,
  /** Export canvas the project is cropped to (a vertical Short). The placement is then chosen so
   *  the caption stays inside the safe area of BOTH the project frame and the exported file. */
  outputCanvas?: { width: number; height: number }
): number {
  const zone = canvasWidth !== undefined && canvasWidth > canvasHeight ? LANDSCAPE_SAFE_ZONE : VERTICAL_SAFE_ZONE;
  const half = (fontSize * 1.2) / 2 + (hasBackground ? 6 : 0);

  // Allowed range for the text anchor in project pixels.
  let minAnchor = canvasHeight * zone.top + half + CAPTION_ZONE_MARGIN;
  let maxAnchor = canvasHeight * zone.bottom - half - CAPTION_ZONE_MARGIN;

  if (outputCanvas && canvasWidth !== undefined) {
    const mapping = projectToOutputMapping({ width: canvasWidth, height: canvasHeight }, outputCanvas);
    const outputZone = outputCanvas.height > outputCanvas.width ? VERTICAL_SAFE_ZONE : LANDSCAPE_SAFE_ZONE;
    const halfInOutput = half * mapping.scale;
    const outMin = outputCanvas.height * outputZone.top + halfInOutput + CAPTION_ZONE_MARGIN;
    const outMax = outputCanvas.height * outputZone.bottom - halfInOutput - CAPTION_ZONE_MARGIN;
    // Inverse map the export range into project pixels and intersect with the project range.
    minAnchor = Math.max(minAnchor, mapYToProject(mapping, outMin));
    maxAnchor = Math.min(maxAnchor, mapYToProject(mapping, outMax));
  }

  if (position === 'bottom') {
    const anchor = Number.isFinite(maxAnchor) ? maxAnchor : canvasHeight * zone.bottom - half - CAPTION_ZONE_MARGIN;
    return Math.round(anchor - canvasHeight / 2);
  }
  if (position === 'top') {
    const anchor = Number.isFinite(minAnchor) ? minAnchor : canvasHeight * zone.top + half + CAPTION_ZONE_MARGIN;
    return Math.round(anchor - canvasHeight / 2);
  }
  const middle = canvasHeight / 2;
  const clamped = Math.min(Math.max(middle, minAnchor), maxAnchor);
  return Math.round((Number.isFinite(clamped) ? clamped : middle) - canvasHeight / 2);
}

export function toCaptionStyleConfig(style: Partial<CaptionStyleConfig> | undefined, canvasHeight: number): Partial<CaptionStyleConfig> {
  if (!style) return {};
  // The studio works with its own scale; the renderer works in output pixels. A vertical export is
  // taller than the editor preview, so the caption font has to follow the canvas or it would be
  // unreadably small in the exported file.
  const scale = canvasHeight > 0 ? canvasHeight / 1920 : 1;
  if (!style.fontSize) return { ...style };
  const scaled = style.fontSize * Math.max(0.5, Math.min(2, scale));
  const floor = canvasHeight * MIN_CAPTION_FONT_RATIO;
  const ceiling = canvasHeight * MAX_CAPTION_FONT_RATIO;
  // The studio font size is a design size; the export gets output pixels and never drops below the
  // legibility floor (the same rule the quality check applies). A fractional floor rounds UP so the
  // written caption is never a fraction of a pixel under the rule.
  const clamped = Math.max(floor, Math.min(ceiling, scaled));
  return {
    ...style,
    fontSize: clamped <= floor ? Math.ceil(floor) : Math.round(clamped),
  };
}

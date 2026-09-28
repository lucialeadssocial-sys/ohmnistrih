/**
 * Reframe for social renders.
 *
 * A long-form 16:9 source rendered into a 9:16 canvas used to be drawn at its native size in the
 * middle of the frame (big black bars). COVER scales the media uniformly until the frame is filled
 * and lets the excess overflow — the aspect ratio is never distorted (single uniform scale).
 *
 * What this is NOT: face/subject detection. This module never looks at pixels and never guesses a
 * position — it only consumes a subject point that a real detector measured (core/vision/subjectTrack.ts).
 * Without such a measurement the crop stays centred.
 */

export type ReframeMode = 'FIT' | 'COVER';

export interface ReframeOptions {
  /**
   * Measured subject centre in media pixels (from a real detector — see core/vision/subjectTrack.ts).
   * When present, the crop is shifted so this point stays inside the visible area with a margin.
   * When absent, the crop stays centred.
   */
  subject?: { x: number; y: number } | null;
  /** Free space kept around the subject inside the crop (0..0.4 of the visible area). Default 0.15. */
  margin?: number;
}

export interface ReframeTransform {
  mode: ReframeMode;
  /** Uniform scale applied on top of the clip transform. 1 = draw at native size (legacy FIT). */
  scale: number;
  mediaWidth: number;
  mediaHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  /** True when COVER really had to scale to fill the frame. */
  fillsFrame: boolean;
  /** True when the media had to be enlarged (source smaller than the canvas). */
  upscaled: boolean;
  /** Horizontal shift of the crop inside the media, in media pixels (0 = centred). */
  offsetX: number;
  /** Vertical shift of the crop inside the media, in media pixels (0 = centred). */
  offsetY: number;
  /** True only when a measured subject was supplied and the crop followed it. */
  subjectTracked: boolean;
  noteSk: string;
  noteEn: string;
}

const round4 = (value: number) => Math.round(value * 10000) / 10000;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * Shifts the visible crop so a measured subject stays inside it.
 *
 * Pure translation only: the scale never changes, the crop never leaves the media, and the margin
 * is given up (instead of pushing the crop out of bounds) when it does not fit.
 */
function subjectOffset(
  subject: { x: number; y: number },
  mediaLength: number,
  visibleLength: number,
  axis: 'x' | 'y',
  margin: number
): number {
  const subjectPoint = axis === 'x' ? subject.x : subject.y;
  const defaultCentre = mediaLength / 2;
  const half = visibleLength / 2;
  const free = margin * visibleLength;
  const low = subjectPoint - half + free;
  const high = subjectPoint + half - free;
  const preferred = low <= high ? clamp(defaultCentre, low, high) : subjectPoint;
  // The crop must stay inside the media: the visible area may not start before 0 or end after the media.
  const bounded = clamp(preferred, half, mediaLength - half);
  return round4(bounded - defaultCentre);
}

export function computeReframeTransform(
  mediaWidth: number,
  mediaHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  mode: ReframeMode = 'COVER',
  options: ReframeOptions = {}
): ReframeTransform {
  const valid =
    Number.isFinite(mediaWidth) && mediaWidth > 0 &&
    Number.isFinite(mediaHeight) && mediaHeight > 0 &&
    Number.isFinite(canvasWidth) && canvasWidth > 0 &&
    Number.isFinite(canvasHeight) && canvasHeight > 0;

  if (!valid) {
    return {
      mode,
      scale: 1,
      mediaWidth,
      mediaHeight,
      canvasWidth,
      canvasHeight,
      fillsFrame: false,
      upscaled: false,
      offsetX: 0,
      offsetY: 0,
      subjectTracked: false,
      noteSk: 'Rozmery média alebo plátna nie sú k dispozícii — kreslí sa v pôvodnej veľkosti.',
      noteEn: 'Media or canvas dimensions are unavailable — drawn at the native size.',
    };
  }

  if (mode === 'FIT') {
    return {
      mode,
      scale: 1,
      mediaWidth,
      mediaHeight,
      canvasWidth,
      canvasHeight,
      fillsFrame: false,
      upscaled: false,
      offsetX: 0,
      offsetY: 0,
      subjectTracked: false,
      noteSk: 'FIT: médium sa kreslí v pôvodnej veľkosti (môže ostať čierny pruh).',
      noteEn: 'FIT: the media is drawn at its native size (black bars may remain).',
    };
  }

  // Round first: the renderer applies `reframe.scale`, so the crop maths must use the very same
  // number — otherwise the visible window would differ from the one the offsets were computed for.
  const scale = round4(Math.max(canvasWidth / mediaWidth, canvasHeight / mediaHeight));
  const visibleWidth = canvasWidth / scale;
  const visibleHeight = canvasHeight / scale;
  const margin = clamp(options.margin ?? 0.15, 0, 0.4);
  const candidate = options.subject ?? null;
  // A half-broken measurement is not a measurement: without finite coordinates there is nothing to
  // follow, so the crop stays centred rather than guessing where the subject might be.
  const subject =
    candidate && Number.isFinite(candidate.x) && Number.isFinite(candidate.y) ? candidate : null;

  let offsetX = 0;
  let offsetY = 0;
  if (subject) {
    offsetX = subjectOffset(subject, mediaWidth, visibleWidth, 'x', margin);
    offsetY = subjectOffset(subject, mediaHeight, visibleHeight, 'y', margin);
  }

  return {
    mode,
    scale,
    mediaWidth,
    mediaHeight,
    canvasWidth,
    canvasHeight,
    // COVER always leaves the frame filled: both dimensions reach (or exceed) the canvas.
    fillsFrame: mediaWidth * scale >= canvasWidth - 0.5 && mediaHeight * scale >= canvasHeight - 0.5,
    upscaled: scale > 1.0001,
    offsetX,
    offsetY,
    subjectTracked: subject !== null,
    noteSk:
      `COVER: jednotné zväčšenie ${round4(scale)}× vyplní rám ${canvasWidth}×${canvasHeight} bez zdeformovania pomeru strán` +
      (scale > 1.0001 ? ' (zdroj je menší než plátno, preto sa zväčšuje).' : ' (prebytok sa odreže).') +
      (subject
        ? ` Meraný subjekt na [${round4(subject.x)}; ${round4(subject.y)}] px je držaný v zábere (posun ${offsetX}; ${offsetY} px, rezerva ${Math.round(margin * 100)} %).`
        : ' Bez meranej pozície subjektu — záber ostáva vystredený.'),
    noteEn:
      `COVER: a uniform ${round4(scale)}× scale fills the ${canvasWidth}×${canvasHeight} frame without distorting the aspect ratio` +
      (scale > 1.0001 ? ' (the source is smaller than the canvas, so it is enlarged).' : ' (the excess is cropped).') +
      (subject
        ? ` The measured subject at [${round4(subject.x)}; ${round4(subject.y)}] px is kept in frame (shift ${offsetX}; ${offsetY} px, ${Math.round(margin * 100)} % margin).`
        : ' No measured subject position — the frame stays centred.'),
  };
}

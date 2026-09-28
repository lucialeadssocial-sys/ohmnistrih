/**
 * Reframe for social renders.
 *
 * A long-form 16:9 source rendered into a 9:16 canvas used to be drawn at its native size in the
 * middle of the frame (big black bars). COVER scales the media uniformly until the frame is filled
 * and lets the excess overflow — the aspect ratio is never distorted (single uniform scale).
 *
 * What this is NOT: face/subject tracking. COVER keeps the media centred; there is no detection of
 * where the speaker is, so the module never claims to "auto-reframe to the face".
 */

export type ReframeMode = 'FIT' | 'COVER';

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
  noteSk: string;
  noteEn: string;
}

const round4 = (value: number) => Math.round(value * 10000) / 10000;

export function computeReframeTransform(
  mediaWidth: number,
  mediaHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  mode: ReframeMode = 'COVER'
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
      noteSk: 'FIT: médium sa kreslí v pôvodnej veľkosti (môže ostať čierny pruh).',
      noteEn: 'FIT: the media is drawn at its native size (black bars may remain).',
    };
  }

  const scale = Math.max(canvasWidth / mediaWidth, canvasHeight / mediaHeight);
  return {
    mode,
    scale: round4(scale),
    mediaWidth,
    mediaHeight,
    canvasWidth,
    canvasHeight,
    // COVER always leaves the frame filled: both dimensions reach (or exceed) the canvas.
    fillsFrame: mediaWidth * scale >= canvasWidth - 0.5 && mediaHeight * scale >= canvasHeight - 0.5,
    upscaled: scale > 1.0001,
    noteSk:
      `COVER: jednotné zväčšenie ${round4(scale)}× vyplní rám ${canvasWidth}×${canvasHeight} bez zdeformovania pomeru strán` +
      (scale > 1.0001 ? ' (zdroj je menší než plátno, preto sa zväčšuje).' : ' (prebytok sa odreže).'),
    noteEn:
      `COVER: a uniform ${round4(scale)}× scale fills the ${canvasWidth}×${canvasHeight} frame without distorting the aspect ratio` +
      (scale > 1.0001 ? ' (the source is smaller than the canvas, so it is enlarged).' : ' (the excess is cropped).'),
  };
}

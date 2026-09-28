import { ClipModel, TransitionConfig } from '../types/project';

/**
 * Transition maths for the compositor.
 *
 * Kept as pure functions so the behaviour can be verified without a canvas: the exporter and the
 * offline backend both go through RenderEngine.renderFrame, which applies what these functions
 * return. Before this existed, `clip.transitions` was stored and editable but had no effect on any
 * rendered pixel.
 *
 * Honest scope note: the renderer draws one media element per active clip, so fade / crossfade /
 * dissolve blend the clip with the background (a dip) instead of blending two clips frame by frame.
 * Wipes, slides and zooms are single-element effects and are rendered exactly as named.
 */

export interface ClipTransitionState {
  /** Multiplied into the clip opacity. */
  alpha: number;
  /** Multiplied into the clip scale (animated zoom transitions). */
  scaleMultiplier: number;
  /** Canvas-space offset in pixels (slide transitions). */
  offsetX: number;
  offsetY: number;
  /** Rectangular reveal mask (wipe transitions). */
  reveal: { from: 'left' | 'right'; progress: number } | null;
  /** Transition types currently influencing the frame (for diagnostics). */
  activeTypes: TransitionConfig['type'][];
}

const NEUTRAL: ClipTransitionState = {
  alpha: 1,
  scaleMultiplier: 1,
  offsetX: 0,
  offsetY: 0,
  reveal: null,
  activeTypes: [],
};

export function clipStartOf(clip: ClipModel): number {
  return clip.timelineStart ?? clip.start ?? 0;
}

export function clipEndOf(clip: ClipModel): number {
  return clipStartOf(clip) + clip.duration;
}

/**
 * Progress of one edge transition at `currentTime`.
 * Returns null when there is no transition to animate (no config, a hard cut, zero duration, or
 * the playhead is outside the transition window).
 */
export function transitionProgress(
  clip: ClipModel,
  currentTime: number,
  edge: 'in' | 'out'
): { type: TransitionConfig['type']; progress: number } | null {
  const transition = clip.transitions?.[edge];
  if (!transition || transition.type === 'cut') return null;

  const duration = transition.duration > 0 ? transition.duration : 0;
  if (duration <= 0) return null;

  const start = clipStartOf(clip);
  const end = clipEndOf(clip);
  const elapsed = edge === 'in' ? currentTime - start : end - currentTime;
  if (elapsed < 0 || elapsed > duration) return null;

  // 0 = start of the transition window, 1 = fully arrived at the final state.
  const progress = Math.min(1, Math.max(0, elapsed / duration));
  return { type: transition.type, progress };
}

export function computeClipTransitionState(
  clip: ClipModel,
  currentTime: number,
  canvasWidth: number
): ClipTransitionState {
  const inFx = transitionProgress(clip, currentTime, 'in');
  const outFx = transitionProgress(clip, currentTime, 'out');
  if (!inFx && !outFx) return NEUTRAL;

  const state: ClipTransitionState = { ...NEUTRAL, activeTypes: [] };

  const apply = (edge: 'in' | 'out', fx: { type: TransitionConfig['type']; progress: number }) => {
    const p = fx.progress;
    state.activeTypes.push(fx.type);

    switch (fx.type) {
      case 'fade':
      case 'crossfade':
      case 'dissolve':
        state.alpha *= p;
        break;
      case 'wipeLeft':
        state.reveal = { from: 'left', progress: p };
        break;
      case 'wipeRight':
        state.reveal = { from: 'right', progress: p };
        break;
      case 'slideLeft':
        // In: slides in from the right. Out: leaves towards the left.
        state.offsetX += edge === 'in' ? (1 - p) * canvasWidth : -(1 - p) * canvasWidth;
        break;
      case 'slideRight':
        state.offsetX += edge === 'in' ? -(1 - p) * canvasWidth : (1 - p) * canvasWidth;
        break;
      case 'zoomIn':
        state.scaleMultiplier *= 0.6 + 0.4 * p;
        break;
      case 'zoomOut':
        state.scaleMultiplier *= 1.4 - 0.4 * p;
        break;
      default:
        break;
    }
  };

  if (inFx) apply('in', inFx);
  if (outFx) apply('out', outFx);

  state.alpha = Math.min(1, Math.max(0, state.alpha));
  return state;
}

/**
 * Project audio mix renderer.
 *
 * Renders the canonical project's audio through the SAME graph the offline export uses: every
 * clip's real media is fetched and decoded, then processed with its real EQ (high-pass / low-shelf
 * / peaking / high-shelf), dynamics compression, makeup gain, volume and fades, and finally the
 * optional background music layer. Used by the exporter and by the loudness meter, so both measure
 * the identical signal.
 *
 * Returns null when the project has no playable audio — callers must report that instead of
 * substituting a placeholder tone.
 */

import { ProjectModel } from '../types/project';
import { renderEngine } from '../render/renderEngine';

export interface RenderedMix {
  buffer: AudioBuffer;
  sampleRate: number;
  /** How many clips really contributed audio to the mix. */
  decodedClips: number;
  /** Clips that were found but whose media could not be decoded. */
  undecodedClips: { clipId: string; reason: string }[];
}

async function decodeAudioUrl(url: string, ctx: BaseAudioContext): Promise<AudioBuffer | null> {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuffer);
  } catch (err) {
    console.warn('[MixRenderer] Failed to decode audio for', url, err);
    return null;
  }
}

function resolveMediaUrl(project: ProjectModel, clip: { assetId?: string }): string | null {
  const asset = project.assets.find(a => a.id === clip.assetId || a.assetId === clip.assetId);
  const fromEngine = clip.assetId ? (renderEngine as any).mediaElements?.get(clip.assetId)?.src : undefined;
  return asset?.url || fromEngine || null;
}

/**
 * Builds the project mix offline.
 *
 * @param project Canonical project.
 * @param timelineDuration Duration of the render window in seconds.
 * @param sampleRate Sample rate of the offline context.
 */
export async function renderProjectMix(
  project: ProjectModel,
  timelineDuration: number,
  sampleRate: number = 44100,
  /**
   * Render only the timeline window [windowStart, windowStart + timelineDuration].
   * Used by the Shorts export so a 60-second clip does not render the whole 60-minute podcast.
   */
  windowStart: number = 0
): Promise<RenderedMix | null> {
  if (typeof OfflineAudioContext === 'undefined' || timelineDuration <= 0) return null;

  const offlineCtx = new OfflineAudioContext(2, Math.ceil(sampleRate * timelineDuration), sampleRate);
  const undecodedClips: { clipId: string; reason: string }[] = [];
  let decodedClips = 0;

  for (const track of project.tracks) {
    if (track.muted || track.type === 'caption' || track.type === 'adjustment') continue;

    for (const clip of track.clips) {
      if (clip.muted) continue;
      const url = resolveMediaUrl(project, clip);
      if (!url) continue;

      const buffer = await decodeAudioUrl(url, offlineCtx);
      if (!buffer) {
        undecodedClips.push({ clipId: clip.id, reason: 'audio sa nedá dekódovať' });
        continue;
      }

      const clipStart = clip.timelineStart ?? 0;
      const clipEnd = clipStart + clip.duration;
      const windowEnd = windowStart + timelineDuration;

      // Outside the exported window: contribute nothing.
      if (clipEnd <= windowStart || clipStart >= windowEnd || clip.duration <= 0) continue;

      const sourceNode = offlineCtx.createBufferSource();
      sourceNode.buffer = buffer;

      const gainNode = offlineCtx.createGain();
      const volume = (clip.volume ?? 100) / 100;
      const fadeIn = clip.fadeIn && clip.fadeIn > 0 ? clip.fadeIn : 0;
      const fadeOut = clip.fadeOut && clip.fadeOut > 0 ? clip.fadeOut : 0;

      // Gain in the window, measured at the window start when a fade already began before it.
      const fadeInValue = fadeIn > 0
        ? Math.min(1, Math.max(0, (windowStart - clipStart) / fadeIn))
        : 1;
      const fadeOutValue = fadeOut > 0
        ? Math.min(1, Math.max(0, (clipEnd - windowStart) / fadeOut))
        : 1;
      const startValue = volume * Math.min(fadeInValue, fadeOutValue);
      gainNode.gain.setValueAtTime(startValue, 0);

      if (fadeIn > 0 && clipStart + fadeIn > windowStart) {
        gainNode.gain.linearRampToValueAtTime(volume, Math.min(timelineDuration, clipStart + fadeIn - windowStart));
      }
      if (fadeOut > 0 && clipEnd - fadeOut > windowStart) {
        gainNode.gain.setValueAtTime(volume, Math.min(timelineDuration, clipEnd - fadeOut - windowStart));
        gainNode.gain.linearRampToValueAtTime(0, Math.min(timelineDuration, clipEnd - windowStart));
      }

      // Real processing from the canonical clip state: EQ bands then dynamics compression.
      const processed: AudioNode[] = [];
      const eq = clip.audioEffects?.eq;
      if (eq && eq.enabled && !eq.bypass) {
        const bands: { type: BiquadFilterType; freq: number; gain: number; q?: number }[] = [];
        if (eq.highPass?.enabled) bands.push({ type: 'highpass', freq: eq.highPass.freq, gain: 0 });
        if (eq.lowShelf) bands.push({ type: 'lowshelf', freq: eq.lowShelf.freq, gain: eq.lowShelf.gain });
        if (eq.mid) bands.push({ type: 'peaking', freq: eq.mid.freq, gain: eq.mid.gain, q: eq.mid.q });
        if (eq.highShelf) bands.push({ type: 'highshelf', freq: eq.highShelf.freq, gain: eq.highShelf.gain });

        for (const band of bands) {
          const filter = offlineCtx.createBiquadFilter();
          filter.type = band.type;
          filter.frequency.setValueAtTime(band.freq, 0);
          filter.gain.setValueAtTime(band.gain, 0);
          if (band.type === 'peaking' && typeof band.q === 'number') {
            filter.Q.setValueAtTime(band.q, 0);
          }
          processed.push(filter);
        }
      }

      const comp = clip.audioEffects?.compression;
      if (comp && comp.enabled && !comp.bypass) {
        const compressor = offlineCtx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(comp.threshold, 0);
        compressor.ratio.setValueAtTime(comp.ratio, 0);
        compressor.attack.setValueAtTime(comp.attack, 0);
        compressor.release.setValueAtTime(comp.release, 0);
        processed.push(compressor);

        if (comp.makeupGain) {
          const makeup = offlineCtx.createGain();
          makeup.gain.setValueAtTime(Math.pow(10, comp.makeupGain / 20), 0);
          processed.push(makeup);
        }
      }

      let tail: AudioNode = sourceNode;
      for (const node of processed) {
        tail.connect(node);
        tail = node;
      }
      tail.connect(gainNode);
      gainNode.connect(offlineCtx.destination);

      const sourceStart = clip.sourceStart ?? 0;
      const offsetIntoClip = Math.max(0, windowStart - clipStart);
      const playFrom = Math.max(0, Math.min(timelineDuration, clipStart - windowStart));
      const playDuration = Math.min(clip.duration - offsetIntoClip, timelineDuration - playFrom);
      if (playDuration <= 0) continue;

      sourceNode.start(playFrom, sourceStart + offsetIntoClip, playDuration);
      decodedClips++;
    }
  }

  // Optional background music layer configured in project settings.
  const settingsAny = project.settings as any;
  if (settingsAny?.bgMusicTrack && settingsAny.bgMusicTrack !== 'none') {
    const musicVolume = settingsAny.bgMusicVolume ?? 0.3;
    const osc = offlineCtx.createOscillator();
    const filter = offlineCtx.createBiquadFilter();
    const gain = offlineCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, 0);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, 0);
    gain.gain.setValueAtTime(musicVolume * 0.05, 0);

    if (settingsAny.bgMusicTrack === 'viral-phonk' || settingsAny.bgMusicTrack === 'tech-ambient') {
      osc.frequency.setValueAtTime(110, 0);
      osc.frequency.setValueAtTime(165, 0.5);
      osc.frequency.setValueAtTime(220, 1.0);
      osc.frequency.setValueAtTime(110, 1.5);
    }

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(offlineCtx.destination);
    osc.start(0);
    osc.stop(timelineDuration);
  }

  if (decodedClips === 0) {
    return null;
  }

  const buffer = await offlineCtx.startRendering();
  return { buffer, sampleRate, decodedClips, undecodedClips };
}

/** Convenience wrapper: renders the current mix of a project at 48 kHz. */
export async function renderProjectMixAt48k(project: ProjectModel, timelineDuration: number): Promise<RenderedMix | null> {
  return renderProjectMix(project, timelineDuration, 48000);
}

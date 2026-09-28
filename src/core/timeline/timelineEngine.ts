/**
 * Timeline Engine
 * Pure math and non-destructive calculations for timeline tracks, clips, snapping, ripple, trimming, and keyframes.
 */

import { ProjectModel, ClipModel, TrackModel, Keyframe, TranscriptModel, CaptionStyleConfig, createCanonicalClip } from '../types/project';

export interface SnappingPoint {
  time: number;
  type: 'clip_start' | 'clip_end' | 'playhead' | 'sequence_start' | 'marker' | 'in_point' | 'out_point' | 'grid';
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class TimelineEngine {
  /**
   * Computes current total project duration based on furthest clip end time.
   */
  public static calculateProjectDuration(project: ProjectModel): number {
    let maxEnd = 10; // Minimum 10 seconds default canvas
    for (const track of project.tracks) {
      for (const clip of track.clips) {
        const timelineStart = clip.timelineStart ?? clip.start ?? 0;
        const end = timelineStart + clip.duration;
        if (end > maxEnd) {
          maxEnd = end;
        }
      }
    }
    return Math.ceil(maxEnd);
  }

  /**
   * Converts timeline time position to source media time position.
   * Deterministic equation: sourceTime = sourceStart + ((timelineTime - timelineStart) * speed)
   */
  public static timelineToSourceTime(clip: ClipModel, timelineTime: number): number {
    const timelineStart = clip.timelineStart ?? clip.start ?? 0;
    const sourceStart = clip.sourceStart ?? clip.offset ?? 0;
    const speed = clip.speed ?? 1.0;
    const timeWithinClip = timelineTime - timelineStart;
    return sourceStart + (timeWithinClip * speed);
  }

  /**
   * Converts source media time position to timeline time position.
   * Deterministic equation: timelineTime = timelineStart + ((sourceTime - sourceStart) / speed)
   */
  public static sourceToTimelineTime(clip: ClipModel, sourceTime: number): number {
    const timelineStart = clip.timelineStart ?? clip.start ?? 0;
    const sourceStart = clip.sourceStart ?? clip.offset ?? 0;
    const speed = clip.speed ?? 1.0;
    const sourceOffset = sourceTime - sourceStart;
    return timelineStart + (sourceOffset / speed);
  }

  /**
   * Finds all clips active at time t on a specific track or across all tracks.
   */
  public static getActiveClipsAtTime(project: ProjectModel, time: number): { track: TrackModel; clip: ClipModel }[] {
    const active: { track: TrackModel; clip: ClipModel }[] = [];

    for (const track of project.tracks) {
      if (track.muted || !track.visible) continue;

      for (const clip of track.clips) {
        const timelineStart = clip.timelineStart ?? clip.start ?? 0;
        if (time >= timelineStart && time < timelineStart + clip.duration) {
          active.push({ track, clip });
        }
      }
    }

    // Sort by track order (higher order rendered on top)
    return active.sort((a, b) => a.track.order - b.track.order);
  }

  /**
   * Splits a clip at a given timeline position deterministically.
   * 
   * Example:
   * Raw video: 0-60s
   * Clip: sourceStart=18, sourceEnd=32, timelineStart=0, duration=14
   * Split at timeline 7s:
   * Left Clip A:  source 18 -> 25, timeline 0 -> 7, duration 7
   * Right Clip B: source 25 -> 32, timeline 7 -> 14, duration 7
   */
  public static splitClip(clip: ClipModel, splitTimelineTime: number): { leftClip: ClipModel; rightClip: ClipModel } | null {
    const timelineStart = clip.timelineStart ?? clip.start ?? 0;
    const timelineEnd = timelineStart + clip.duration;
    const sourceStart = clip.sourceStart ?? clip.offset ?? 0;
    const speed = clip.speed ?? 1.0;

    if (splitTimelineTime <= timelineStart || splitTimelineTime >= timelineEnd) {
      return null; // Invalid split point outside clip boundaries
    }

    const leftDuration = splitTimelineTime - timelineStart;
    const rightDuration = clip.duration - leftDuration;

    if (leftDuration <= 0.001 || rightDuration <= 0.001) {
      return null;
    }

    const leftSourceEnd = sourceStart + (leftDuration * speed);
    const rightSourceStart = leftSourceEnd;
    const rightSourceEnd = clip.sourceEnd ?? (sourceStart + (clip.duration * speed));

    // Distribute keyframes
    const leftKeyframes: Keyframe[] = [];
    const rightKeyframes: Keyframe[] = [];

    for (const kf of clip.keyframes) {
      if (kf.timeOffset <= leftDuration) {
        leftKeyframes.push({ ...kf });
      } else {
        rightKeyframes.push({
          ...kf,
          id: crypto.randomUUID(),
          timeOffset: kf.timeOffset - leftDuration
        });
      }
    }

    const leftClip = createCanonicalClip({
      ...clip,
      sourceStart,
      sourceEnd: leftSourceEnd,
      timelineStart,
      duration: leftDuration,
      keyframes: leftKeyframes
    });

    const rightClip = createCanonicalClip({
      ...clip,
      id: crypto.randomUUID(),
      sourceStart: rightSourceStart,
      sourceEnd: rightSourceEnd,
      timelineStart: splitTimelineTime,
      duration: rightDuration,
      keyframes: rightKeyframes
    });

    return { leftClip, rightClip };
  }

  /**
   * Trims a clip from left (in-point) or right (out-point).
   * 
   * Trim left:
   * - deltaSeconds > 0: shortens clip from left, advances timelineStart & sourceStart
   * - deltaSeconds < 0: extends clip to left if source media allows
   * 
   * Trim right:
   * - deltaSeconds > 0: extends clip to right
   * - deltaSeconds < 0: shortens clip from right, reduces sourceEnd & duration
   */
  public static trimClip(
    clip: ClipModel,
    edge: 'left' | 'right',
    deltaSeconds: number,
    minDuration: number = 0.05
  ): ClipModel | null {
    const timelineStart = clip.timelineStart ?? clip.start ?? 0;
    const sourceStart = clip.sourceStart ?? clip.offset ?? 0;
    const sourceEnd = clip.sourceEnd ?? (sourceStart + clip.duration * (clip.speed ?? 1.0));
    const speed = clip.speed ?? 1.0;

    if (edge === 'left') {
      const newDuration = clip.duration - deltaSeconds;
      const newTimelineStart = timelineStart + deltaSeconds;
      const newSourceStart = sourceStart + (deltaSeconds * speed);

      if (newDuration < minDuration || newTimelineStart < 0 || newSourceStart < 0 || newSourceStart >= sourceEnd) {
        return null;
      }

      // Re-offset keyframes
      const updatedKeyframes: Keyframe[] = (clip.keyframes || [])
        .map(kf => ({
          ...kf,
          timeOffset: kf.timeOffset - deltaSeconds
        }))
        .filter(kf => kf.timeOffset >= 0 && kf.timeOffset <= newDuration);

      return createCanonicalClip({
        ...clip,
        sourceStart: newSourceStart,
        sourceEnd,
        timelineStart: newTimelineStart,
        duration: newDuration,
        keyframes: updatedKeyframes
      });
    } else {
      // Trim right
      const newDuration = clip.duration + deltaSeconds;
      const newSourceEnd = sourceStart + (newDuration * speed);

      if (newDuration < minDuration || newSourceEnd <= sourceStart) {
        return null;
      }

      // Filter out keyframes beyond new duration
      const updatedKeyframes: Keyframe[] = (clip.keyframes || [])
        .filter(kf => kf.timeOffset <= newDuration);

      return createCanonicalClip({
        ...clip,
        sourceStart,
        sourceEnd: newSourceEnd,
        timelineStart,
        duration: newDuration,
        keyframes: updatedKeyframes
      });
    }
  }

  /**
   * Moves a clip along the timeline and/or to another track.
   * Non-destructive: source timing remains strictly unchanged.
   */
  public static moveClip(clip: ClipModel, newTimelineStart: number, newTrackId?: string): ClipModel {
    const safeStart = Math.max(0, newTimelineStart);
    return createCanonicalClip({
      ...clip,
      timelineStart: safeStart,
      start: safeStart,
      trackId: newTrackId || clip.trackId
    });
  }

  /**
   * Ripple shifts subsequent clips on a track by deltaSeconds from a given timeline point.
   */
  public static rippleTrackClips(track: TrackModel, fromTimelineTime: number, deltaSeconds: number): TrackModel {
    const updatedClips = track.clips.map(clip => {
      const clipStart = clip.timelineStart ?? clip.start ?? 0;
      if (clipStart >= fromTimelineTime) {
        const newStart = Math.max(0, clipStart + deltaSeconds);
        return createCanonicalClip({
          ...clip,
          timelineStart: newStart,
          start: newStart
        });
      }
      return clip;
    });

    return {
      ...track,
      clips: updatedClips
    };
  }

  /**
   * Snapping logic: returns nearest snap target time within tolerance threshold.
   */
  public static getSnappedTime(
    project: ProjectModel,
    targetTime: number,
    excludeClipId?: string,
    snapThreshold: number = 0.08
  ): { time: number; snapped: boolean; point?: SnappingPoint } {
    const snapPoints: SnappingPoint[] = [
      { time: 0, type: 'sequence_start' },
      { time: project.playheadTime ?? 0, type: 'playhead' }
    ];

    if (project.inPoint !== undefined && project.inPoint !== null) {
      snapPoints.push({ time: project.inPoint, type: 'in_point' });
    }
    if (project.outPoint !== undefined && project.outPoint !== null) {
      snapPoints.push({ time: project.outPoint, type: 'out_point' });
    }

    if (project.markers) {
      for (const m of project.markers) {
        snapPoints.push({ time: m.time, type: 'marker' });
      }
    }

    for (const track of project.tracks) {
      for (const clip of track.clips) {
        if (clip.id === excludeClipId) continue;
        const timelineStart = clip.timelineStart ?? clip.start ?? 0;
        snapPoints.push({ time: timelineStart, type: 'clip_start' });
        snapPoints.push({ time: timelineStart + clip.duration, type: 'clip_end' });
      }
    }

    let closestPoint: SnappingPoint | undefined = undefined;
    let minDiff = snapThreshold;

    for (const pt of snapPoints) {
      const diff = Math.abs(pt.time - targetTime);
      if (diff <= minDiff) {
        minDiff = diff;
        closestPoint = pt;
      }
    }

    if (closestPoint) {
      return { time: closestPoint.time, snapped: true, point: closestPoint };
    }

    return { time: targetTime, snapped: false };
  }

  /**
   * Performs an Insert Edit:
   * Inserts a clip into the target track at insertTime, rippling existing/subsequent clips to the right.
   */
  public static insertEdit(
    project: ProjectModel,
    targetTrackId: string,
    clipToInsert: ClipModel,
    insertTime: number
  ): ProjectModel {
    const targetTrack = project.tracks.find(t => t.id === targetTrackId);
    if (!targetTrack) return project;

    const insertDuration = clipToInsert.duration;
    const canonicalInsert = createCanonicalClip({
      ...clipToInsert,
      trackId: targetTrackId,
      timelineStart: insertTime
    });

    const updatedTracks = project.tracks.map(track => {
      if (track.id !== targetTrackId) return track;

      const newClips: ClipModel[] = [];

      for (const clip of track.clips) {
        const cStart = clip.timelineStart ?? clip.start ?? 0;
        const cEnd = cStart + clip.duration;

        if (cEnd <= insertTime) {
          // Clip is completely before insertion point
          newClips.push(clip);
        } else if (cStart >= insertTime) {
          // Clip is at or after insertion point -> shift right by insertDuration
          const newStart = cStart + insertDuration;
          newClips.push(createCanonicalClip({
            ...clip,
            timelineStart: newStart,
            start: newStart
          }));
        } else {
          // Clip crosses the insertion point -> split into left and right, then shift right part
          const splitRes = TimelineEngine.splitClip(clip, insertTime);
          if (splitRes) {
            newClips.push(splitRes.leftClip);
            const shiftedRight = createCanonicalClip({
              ...splitRes.rightClip,
              timelineStart: splitRes.rightClip.timelineStart + insertDuration,
              start: splitRes.rightClip.timelineStart + insertDuration
            });
            newClips.push(shiftedRight);
          } else {
            newClips.push(clip);
          }
        }
      }

      newClips.push(canonicalInsert);
      // Sort clips by timelineStart
      newClips.sort((a, b) => (a.timelineStart ?? a.start ?? 0) - (b.timelineStart ?? b.start ?? 0));

      return {
        ...track,
        clips: newClips
      };
    });

    return { ...project, tracks: updatedTracks };
  }

  /**
   * Performs an Overwrite Edit:
   * Overwrites the timeline range [atTime, atTime + duration] on targetTrackId with clipToInsert.
   */
  public static overwriteEdit(
    project: ProjectModel,
    targetTrackId: string,
    clipToInsert: ClipModel,
    atTime: number
  ): ProjectModel {
    const targetTrack = project.tracks.find(t => t.id === targetTrackId);
    if (!targetTrack) return project;

    const overwriteDuration = clipToInsert.duration;
    const overwriteEnd = atTime + overwriteDuration;

    const canonicalInsert = createCanonicalClip({
      ...clipToInsert,
      trackId: targetTrackId,
      timelineStart: atTime
    });

    const updatedTracks = project.tracks.map(track => {
      if (track.id !== targetTrackId) return track;

      const newClips: ClipModel[] = [];

      for (const clip of track.clips) {
        const cStart = clip.timelineStart ?? clip.start ?? 0;
        const cEnd = cStart + clip.duration;

        if (cEnd <= atTime || cStart >= overwriteEnd) {
          // Completely outside overwrite window
          newClips.push(clip);
        } else if (cStart >= atTime && cEnd <= overwriteEnd) {
          // Completely swallowed by overwrite -> omit (deleted)
          continue;
        } else if (cStart < atTime && cEnd > overwriteEnd) {
          // Clip spans across entire overwrite -> punch a hole (split into left and right pieces)
          const leftDuration = atTime - cStart;
          const rightStart = overwriteEnd;
          const rightDuration = cEnd - overwriteEnd;

          const leftClip = createCanonicalClip({
            ...clip,
            duration: leftDuration,
            sourceEnd: (clip.sourceStart ?? 0) + (leftDuration * (clip.speed ?? 1.0))
          });

          const rightSourceStart = (clip.sourceStart ?? 0) + ((rightStart - cStart) * (clip.speed ?? 1.0));
          const rightClip = createCanonicalClip({
            ...clip,
            id: crypto.randomUUID(),
            timelineStart: rightStart,
            sourceStart: rightSourceStart,
            duration: rightDuration
          });

          newClips.push(leftClip, rightClip);
        } else if (cStart < atTime && cEnd > atTime) {
          // Overwrite overlaps end of clip -> trim clip right side
          const trimmed = TimelineEngine.trimClip(clip, 'right', atTime - cEnd);
          if (trimmed) newClips.push(trimmed);
        } else if (cStart < overwriteEnd && cEnd > overwriteEnd) {
          // Overwrite overlaps start of clip -> trim clip left side
          const trimmed = TimelineEngine.trimClip(clip, 'left', overwriteEnd - cStart);
          if (trimmed) newClips.push(trimmed);
        }
      }

      newClips.push(canonicalInsert);
      newClips.sort((a, b) => (a.timelineStart ?? a.start ?? 0) - (b.timelineStart ?? b.start ?? 0));

      return {
        ...track,
        clips: newClips
      };
    });

    return { ...project, tracks: updatedTracks };
  }

  /**
   * Calculates frame step position based on exact FPS.
   */
  public static frameStep(
    currentTime: number,
    direction: 'forward' | 'backward',
    fps: number = 30,
    stepFrames: number = 1,
    duration?: number
  ): number {
    const validFps = fps > 0 ? fps : 30;
    const frameDuration = 1 / validFps;
    const delta = (direction === 'forward' ? 1 : -1) * stepFrames * frameDuration;
    const target = currentTime + delta;
    const min = 0;
    const max = duration !== undefined && duration > 0 ? duration : Number.MAX_SAFE_INTEGER;
    const clamped = Math.max(min, Math.min(max, target));
    return Math.round(clamped * 1000000) / 1000000;
  }

  /**
   * Computes J/K/L standard editing transport speeds:
   * J: -1x, -2x, -4x, -8x
   * K: 0x (pause)
   * L: +1x, +2x, +4x, +8x
   */
  public static calculateJklSpeed(currentSpeed: number, key: 'J' | 'K' | 'L'): number {
    if (key === 'K') return 0;
    if (key === 'L') {
      if (currentSpeed <= 0) return 1;
      if (currentSpeed === 1) return 2;
      if (currentSpeed === 2) return 4;
      return 8;
    }
    if (key === 'J') {
      if (currentSpeed >= 0) return -1;
      if (currentSpeed === -1) return -2;
      if (currentSpeed === -2) return -4;
      return -8;
    }
    return 0;
  }

  /**
   * Computes keyframe property value at clip offset time using linear or custom easing.
   */
  public static interpolateKeyframeValue(
    keyframes: Keyframe[],
    parameter: Keyframe['parameter'],
    clipOffsetTime: number,
    defaultValue: number
  ): number {
    const paramKeyframes = keyframes
      .filter(kf => kf.parameter === parameter)
      .sort((a, b) => a.timeOffset - b.timeOffset);

    if (paramKeyframes.length === 0) return defaultValue;
    if (clipOffsetTime <= paramKeyframes[0].timeOffset) return paramKeyframes[0].value;
    if (clipOffsetTime >= paramKeyframes[paramKeyframes.length - 1].timeOffset) {
      return paramKeyframes[paramKeyframes.length - 1].value;
    }

    // Find bounding keyframes
    for (let i = 0; i < paramKeyframes.length - 1; i++) {
      const kf1 = paramKeyframes[i];
      const kf2 = paramKeyframes[i + 1];

      if (clipOffsetTime >= kf1.timeOffset && clipOffsetTime <= kf2.timeOffset) {
        const range = kf2.timeOffset - kf1.timeOffset;
        const progress = range > 0 ? (clipOffsetTime - kf1.timeOffset) / range : 0;
        return kf1.value + (kf2.value - kf1.value) * progress;
      }
    }

    return defaultValue;
  }

  /**
   * Slip Edit:
   * Shifts the media content (sourceStart & sourceEnd) forward/backward without changing
   * the clip's position on the timeline (timelineStart) or its duration.
   */
  public static slipClip(clip: ClipModel, deltaSeconds: number, maxSourceDuration?: number): ClipModel | null {
    const speed = clip.speed ?? 1.0;
    const currentSourceStart = clip.sourceStart ?? clip.offset ?? 0;
    const currentSourceEnd = clip.sourceEnd ?? (currentSourceStart + clip.duration * speed);
    const sourceDelta = deltaSeconds * speed;

    const newSourceStart = currentSourceStart + sourceDelta;
    const newSourceEnd = currentSourceEnd + sourceDelta;

    if (newSourceStart < 0) {
      return null; // Cannot slip before beginning of source media
    }

    if (maxSourceDuration !== undefined && maxSourceDuration > 0 && newSourceEnd > maxSourceDuration + 0.001) {
      return null; // Cannot slip beyond end of source media
    }

    return createCanonicalClip({
      ...clip,
      sourceStart: newSourceStart,
      sourceEnd: newSourceEnd
    });
  }

  /**
   * Slide Edit:
   * Moves a clip along the timeline (changing its timelineStart), keeping its duration and source timing intact,
   * while adjusting the out-point of the preceding clip and the in-point of the succeeding clip.
   */
  public static slideClip(track: TrackModel, clipId: string, deltaSeconds: number): TrackModel | null {
    const clips = [...track.clips].sort((a, b) => (a.timelineStart ?? a.start ?? 0) - (b.timelineStart ?? b.start ?? 0));
    const targetIdx = clips.findIndex(c => c.id === clipId);
    if (targetIdx === -1) return null;

    const targetClip = clips[targetIdx];
    const prevClip = targetIdx > 0 ? clips[targetIdx - 1] : null;
    const nextClip = targetIdx < clips.length - 1 ? clips[targetIdx + 1] : null;

    const currentStart = targetClip.timelineStart ?? targetClip.start ?? 0;
    const newStart = currentStart + deltaSeconds;
    if (newStart < 0) return null;

    let updatedPrev = prevClip;
    let updatedNext = nextClip;

    if (deltaSeconds > 0) {
      // Sliding right: extend prevClip right, shorten nextClip left
      if (prevClip) {
        const trimmedPrev = TimelineEngine.trimClip(prevClip, 'right', deltaSeconds);
        if (!trimmedPrev) return null;
        updatedPrev = trimmedPrev;
      }
      if (nextClip) {
        const trimmedNext = TimelineEngine.trimClip(nextClip, 'left', deltaSeconds);
        if (!trimmedNext) return null;
        updatedNext = trimmedNext;
      }
    } else if (deltaSeconds < 0) {
      // Sliding left: shorten prevClip right, extend nextClip left
      const absDelta = Math.abs(deltaSeconds);
      if (prevClip) {
        const trimmedPrev = TimelineEngine.trimClip(prevClip, 'right', -absDelta);
        if (!trimmedPrev) return null;
        updatedPrev = trimmedPrev;
      }
      if (nextClip) {
        const trimmedNext = TimelineEngine.trimClip(nextClip, 'left', -absDelta);
        if (!trimmedNext) return null;
        updatedNext = trimmedNext;
      }
    }

    const updatedTarget = createCanonicalClip({
      ...targetClip,
      timelineStart: newStart,
      start: newStart
    });

    const updatedClips = clips.map((c, idx) => {
      if (idx === targetIdx) return updatedTarget;
      if (prevClip && idx === targetIdx - 1) return updatedPrev!;
      if (nextClip && idx === targetIdx + 1) return updatedNext!;
      return c;
    });

    return {
      ...track,
      clips: updatedClips
    };
  }

  /**
   * Roll edit: moves the cut point between two adjacent clips on the same track.
   *
   * `clipId` + `edge` identify the cut:
   *  - edge 'in'  → clipId is the RIGHT clip; the cut before its in point is rolled
   *  - edge 'out' → clipId is the LEFT clip; the cut after its out point is rolled
   *
   * Positive `deltaSeconds` moves the cut later (left clip grows, right clip shrinks), negative
   * moves it earlier. The total timeline length never changes because both clips are trimmed by
   * the same amount. Returns null when the roll is not possible (not adjacent, no source material,
   * minimum duration) — callers must report that instead of pretending the edit happened.
   */
  public static rollClip(
    track: TrackModel,
    clipId: string,
    edge: 'in' | 'out',
    deltaSeconds: number,
    minDuration: number = 0.05
  ): TrackModel | null {
    const clips = [...track.clips].sort((a, b) => (a.timelineStart ?? a.start ?? 0) - (b.timelineStart ?? b.start ?? 0));
    const targetIdx = clips.findIndex(c => c.id === clipId);
    if (targetIdx === -1 || clips.length < 2) return null;

    const rightIdx = edge === 'in' ? targetIdx : targetIdx + 1;
    const leftIdx = rightIdx - 1;
    if (leftIdx < 0 || rightIdx > clips.length - 1) return null;

    const leftClip = clips[leftIdx];
    const rightClip = clips[rightIdx];

    // The two clips must really share the cut point on the same track.
    const leftEnd = (leftClip.timelineStart ?? leftClip.start ?? 0) + leftClip.duration;
    const rightStart = rightClip.timelineStart ?? rightClip.start ?? 0;
    if (Math.abs(leftEnd - rightStart) > 0.001) return null;

    // Roll by trimming both sides with the canonical trim math (signed delta moves the cut).
    const trimmedLeft = TimelineEngine.trimClip(leftClip, 'right', deltaSeconds, minDuration);
    if (!trimmedLeft) return null;

    const trimmedRight = TimelineEngine.trimClip(rightClip, 'left', deltaSeconds, minDuration);
    if (!trimmedRight) return null;

    const updatedClips = clips.map((c, idx) => {
      if (idx === leftIdx) return trimmedLeft;
      if (idx === rightIdx) return trimmedRight;
      return c;
    });

    return { ...track, clips: updatedClips };
  }

  /**
   * Ripple Trim Head (Q shortcut):
   * Trims the beginning of the clip to the playhead and ripples subsequent clips left.
   */
  public static rippleTrimHead(track: TrackModel, clipId: string, playheadTime: number): TrackModel | null {
    const targetClip = track.clips.find(c => c.id === clipId);
    if (!targetClip) return null;

    const cStart = targetClip.timelineStart ?? targetClip.start ?? 0;
    const cEnd = cStart + targetClip.duration;

    if (playheadTime <= cStart || playheadTime >= cEnd - 0.05) {
      return null;
    }

    const deltaSeconds = playheadTime - cStart;
    const trimmed = TimelineEngine.trimClip(targetClip, 'left', deltaSeconds);
    if (!trimmed) return null;

    // Reposition trimmed clip to original start and shift all subsequent clips left by deltaSeconds
    const repositioned = createCanonicalClip({
      ...trimmed,
      timelineStart: cStart,
      start: cStart
    });

    const updatedClips = track.clips.map(c => {
      if (c.id === clipId) return repositioned;
      const otherStart = c.timelineStart ?? c.start ?? 0;
      if (otherStart >= cEnd - 0.001) {
        const newStart = Math.max(0, otherStart - deltaSeconds);
        return createCanonicalClip({ ...c, timelineStart: newStart, start: newStart });
      }
      return c;
    });

    return {
      ...track,
      clips: updatedClips
    };
  }

  /**
   * Ripple Trim Tail (W shortcut):
   * Trims the end of the clip to the playhead and ripples subsequent clips left.
   */
  public static rippleTrimTail(track: TrackModel, clipId: string, playheadTime: number): TrackModel | null {
    const targetClip = track.clips.find(c => c.id === clipId);
    if (!targetClip) return null;

    const cStart = targetClip.timelineStart ?? targetClip.start ?? 0;
    const cEnd = cStart + targetClip.duration;

    if (playheadTime <= cStart + 0.05 || playheadTime >= cEnd) {
      return null;
    }

    const deltaSeconds = playheadTime - cEnd; // negative value
    const trimmed = TimelineEngine.trimClip(targetClip, 'right', deltaSeconds);
    if (!trimmed) return null;

    const shiftAmount = Math.abs(deltaSeconds);
    const updatedClips = track.clips.map(c => {
      if (c.id === clipId) return trimmed;
      const otherStart = c.timelineStart ?? c.start ?? 0;
      if (otherStart >= cEnd - 0.001) {
        const newStart = Math.max(0, otherStart - shiftAmount);
        return createCanonicalClip({ ...c, timelineStart: newStart, start: newStart });
      }
      return c;
    });

    return {
      ...track,
      clips: updatedClips
    };
  }

  /**
   * Splits an audio-video clip into linked video clip and detached audio clip (L/J cut split).
   */
  public static splitAudioVideo(clip: ClipModel, audioTrackId: string): { videoClip: ClipModel; audioClip: ClipModel } {
    const audioClipId = `audio_${crypto.randomUUID()}`;
    const videoClip = createCanonicalClip({
      ...clip,
      linkedClipId: audioClipId
    });

    const audioClip = createCanonicalClip({
      ...clip,
      id: audioClipId,
      trackId: audioTrackId,
      type: 'audio',
      name: `${clip.name} (Audio)`,
      linkedClipId: clip.id
    });

    return { videoClip, audioClip };
  }

  /**
   * Centralized Timeline Validation
   */
  public static validateClip(clip: ClipModel, trackExists: boolean = true): ValidationResult {
    const errors: string[] = [];

    if (!clip.id || clip.id.trim() === '') {
      errors.push('Clip ID must not be empty');
    }
    if (!trackExists) {
      errors.push(`Track ID ${clip.trackId} does not exist in project`);
    }
    if (clip.duration <= 0) {
      errors.push(`Clip duration must be > 0 (got ${clip.duration})`);
    }
    const sourceStart = clip.sourceStart ?? clip.offset ?? 0;
    const sourceEnd = clip.sourceEnd ?? (sourceStart + clip.duration * (clip.speed ?? 1.0));
    if (sourceEnd < sourceStart) {
      errors.push(`Clip sourceEnd (${sourceEnd}) cannot be less than sourceStart (${sourceStart})`);
    }
    const timelineStart = clip.timelineStart ?? clip.start ?? 0;
    if (timelineStart < 0) {
      errors.push(`Clip timelineStart (${timelineStart}) cannot be negative`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  public static validateProject(project: ProjectModel): ValidationResult {
    const errors: string[] = [];
    const trackIds = new Set<string>();
    const clipIds = new Set<string>();

    if (!project.id || project.id.trim() === '') {
      errors.push('Project ID must not be empty');
    }

    for (const track of project.tracks) {
      if (trackIds.has(track.id)) {
        errors.push(`Duplicate track ID found: ${track.id}`);
      }
      trackIds.add(track.id);

      for (const clip of track.clips) {
        if (clipIds.has(clip.id)) {
          errors.push(`Duplicate clip ID found: ${clip.id}`);
        }
        clipIds.add(clip.id);

        const clipValidation = this.validateClip(clip, true);
        if (!clipValidation.valid) {
          errors.push(...clipValidation.errors.map(err => `Clip ${clip.id}: ${err}`));
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculates effective audio gain factor at a given timeOffset (seconds from clip start)
   * incorporating volume, track/clip gain, fadeIn, fadeOut, and volume keyframes.
   */
  public static calculateAudioGain(clip: ClipModel, timeOffset: number): number {
    const baseVol = (clip.volume ?? 100) / 100;
    const clipGain = clip.gain ?? 1.0;
    let fadeMultiplier = 1.0;

    const fadeIn = clip.fadeIn ?? 0;
    if (fadeIn > 0 && timeOffset < fadeIn) {
      fadeMultiplier *= (timeOffset / fadeIn);
    }

    const fadeOut = clip.fadeOut ?? 0;
    const duration = clip.duration;
    if (fadeOut > 0 && timeOffset > (duration - fadeOut)) {
      const timeRemaining = duration - timeOffset;
      fadeMultiplier *= Math.max(0, timeRemaining / fadeOut);
    }

    const keyframeVolume = TimelineEngine.interpolateKeyframeValue(clip.keyframes, 'volume', timeOffset, 100);
    const keyframeMultiplier = keyframeVolume / 100;

    return Math.max(0, Math.min(2.0, baseVol * clipGain * fadeMultiplier * keyframeMultiplier));
  }

  /**
   * Converts a TranscriptModel into an array of canonical Caption ClipModels.
   */
  public static generateCaptionsFromTranscript(
    transcript: TranscriptModel,
    trackId: string,
    styleConfig?: Partial<CaptionStyleConfig>
  ): ClipModel[] {
    const captionClips: ClipModel[] = [];
    const defaultConfig: CaptionStyleConfig = {
      font: 'Inter, sans-serif',
      fontSize: 24,
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.8)',
      alignment: 'center',
      position: 'bottom',
      maxCharsPerLine: 42,
      maxLines: 2,
      preset: 'clean',
      ...styleConfig
    };

    for (const seg of transcript.segments) {
      const duration = Math.max(0.5, seg.end - seg.start);
      const captionClip = createCanonicalClip({
        id: `caption_${crypto.randomUUID()}`,
        trackId,
        type: 'caption',
        name: `Titulok: ${seg.text.slice(0, 20)}...`,
        timelineStart: seg.start,
        sourceStart: 0,
        sourceEnd: duration,
        duration,
        textConfig: {
          content: seg.text,
          fontFamily: defaultConfig.font,
          fontSize: defaultConfig.fontSize,
          color: defaultConfig.color,
          backgroundColor: defaultConfig.backgroundColor,
          textAlign: defaultConfig.alignment,
          fontWeight: 'bold'
        },
        captionStyle: defaultConfig
      });
      captionClips.push(captionClip);
    }

    return captionClips;
  }
}

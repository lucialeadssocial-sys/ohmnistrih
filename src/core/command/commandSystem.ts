/**
 * Command System & Undo/Redo Engine
 * Encapsulates all non-destructive timeline mutations.
 * Provides transactional execute/undo/redo stacks, strict validation, and event subscriptions.
 */

import { ProjectModel, ClipModel, TrackModel, MarkerModel, ProjectSettings, Keyframe, TranscriptModel, CaptionStyleConfig, ColorCorrectionConfig, TransitionConfig, ProjectNote, EditDecision, ReviewComment, ReviewState, ProjectVersion, ExportPreset, LearningRecord, createCanonicalClip, EQConfig, CompressionConfig } from '../types/project';
import { TimelineEngine } from '../timeline/timelineEngine';

export interface Command {
  id: string;
  description: string;
  timestamp: number;
  execute(project: ProjectModel): ProjectModel;
  undo(project: ProjectModel): ProjectModel;
}

export type CommandListener = (project: ProjectModel, lastCommand?: Command) => void;

export class CommandManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private snapshotProject: ProjectModel | null = null;
  private maxHistorySize: number = 100;
  private currentProject: ProjectModel;
  private listeners: Set<CommandListener> = new Set();

  constructor(initialProject: ProjectModel) {
    this.currentProject = initialProject;
  }

  public getProject(): ProjectModel {
    return this.currentProject;
  }

  public setProject(project: ProjectModel): void {
    this.currentProject = project;
    this.notifyListeners();
  }

  public subscribe(listener: CommandListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(lastCommand?: Command): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentProject, lastCommand);
      } catch (err) {
        console.error('[CommandManager] Listener error:', err);
      }
    });
  }

  /**
   * Executes a command non-destructively, adds it to undo stack, and clears redo stack.
   */
  public executeCommand(command: Command): boolean {
    const nextProject = command.execute(this.currentProject);
    
    // Check if command made a valid mutation
    if (nextProject === this.currentProject) {
      console.warn(`[CommandManager] Command "${command.description}" was rejected or produced no change.`);
      return false;
    }

    // Validate project schema
    const validation = TimelineEngine.validateProject(nextProject);
    if (!validation.valid) {
      console.error(`[CommandManager] Command "${command.description}" produced invalid state:`, validation.errors);
      return false;
    }

    this.currentProject = { ...nextProject, updatedAt: Date.now() };
    
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }
    this.redoStack = []; // Clear redo on new action
    
    this.notifyListeners(command);
    return true;
  }

  public undo(): boolean {
    if (this.undoStack.length === 0) return false;
    
    const command = this.undoStack.pop()!;
    this.currentProject = command.undo(this.currentProject);
    this.currentProject = { ...this.currentProject, updatedAt: Date.now() };
    
    this.redoStack.push(command);
    this.notifyListeners(command);
    return true;
  }

  public redo(): boolean {
    if (this.redoStack.length === 0) return false;
    
    const command = this.redoStack.pop()!;
    this.currentProject = command.execute(this.currentProject);
    this.currentProject = { ...this.currentProject, updatedAt: Date.now() };
    
    this.undoStack.push(command);
    this.notifyListeners(command);
    return true;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public getUndoHistory(): string[] {
    return this.undoStack.map(c => c.description);
  }

  public getRedoHistory(): string[] {
    return this.redoStack.map(c => c.description);
  }

  public snapshot(): void {
    // Perform deep copy to ensure isolation of the snapshot
    this.snapshotProject = JSON.parse(JSON.stringify(this.currentProject));
  }

  public rollback(): boolean {
    if (!this.snapshotProject) return false;
    this.currentProject = this.snapshotProject;
    this.snapshotProject = null;
    this.notifyListeners();
    return true;
  }
}

export class SetEQCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  description = "Set Audio EQ";
  private previousConfig: EQConfig | null = null;
  private hadPreviousConfig = false;

  constructor(private clipId: string, private config: EQConfig) {}

  execute(project: ProjectModel): ProjectModel {
    const clip = this.findClip(project, this.clipId);
    // Reject (no history entry) when the target clip does not exist.
    if (!clip) return project;

    this.hadPreviousConfig = !!clip.audioEffects?.eq;
    this.previousConfig = clip.audioEffects?.eq
      ? (JSON.parse(JSON.stringify(clip.audioEffects.eq)) as EQConfig)
      : null;

    // Rebuild the clip immutably so the previous project state is not mutated in place.
    return {
      ...project,
      tracks: project.tracks.map(track => ({
        ...track,
        clips: track.clips.map(c =>
          c.id === this.clipId
            ? { ...c, audioEffects: { ...(c.audioEffects || {}), eq: this.config } }
            : c
        ),
      })),
    };
  }

  undo(project: ProjectModel): ProjectModel {
    const clip = this.findClip(project, this.clipId);
    if (!clip) return project;

    return {
      ...project,
      tracks: project.tracks.map(track => ({
        ...track,
        clips: track.clips.map(c => {
          if (c.id !== this.clipId) return c;
          const audioEffects = { ...(c.audioEffects || {}) };
          if (this.hadPreviousConfig && this.previousConfig) {
            audioEffects.eq = this.previousConfig;
          } else {
            delete audioEffects.eq;
          }
          return { ...c, audioEffects };
        }),
      })),
    };
  }

  private findClip(project: ProjectModel, id: string) { return project.tracks.flatMap(t => t.clips).find(c => c.id === id); }
}

export class SetCompressionCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  description = "Set Audio Compression";
  private previousConfig: CompressionConfig | null = null;
  private hadPreviousConfig = false;

  constructor(private clipId: string, private config: CompressionConfig) {}

  execute(project: ProjectModel): ProjectModel {
    const clip = this.findClip(project, this.clipId);
    // Reject (no history entry) when the target clip does not exist.
    if (!clip) return project;

    this.hadPreviousConfig = !!clip.audioEffects?.compression;
    this.previousConfig = clip.audioEffects?.compression
      ? (JSON.parse(JSON.stringify(clip.audioEffects.compression)) as CompressionConfig)
      : null;

    return {
      ...project,
      tracks: project.tracks.map(track => ({
        ...track,
        clips: track.clips.map(c =>
          c.id === this.clipId
            ? { ...c, audioEffects: { ...(c.audioEffects || {}), compression: this.config } }
            : c
        ),
      })),
    };
  }

  undo(project: ProjectModel): ProjectModel {
    const clip = this.findClip(project, this.clipId);
    if (!clip) return project;

    return {
      ...project,
      tracks: project.tracks.map(track => ({
        ...track,
        clips: track.clips.map(c => {
          if (c.id !== this.clipId) return c;
          const audioEffects = { ...(c.audioEffects || {}) };
          if (this.hadPreviousConfig && this.previousConfig) {
            audioEffects.compression = this.previousConfig;
          } else {
            delete audioEffects.compression;
          }
          return { ...c, audioEffects };
        }),
      })),
    };
  }

  private findClip(project: ProjectModel, id: string) { return project.tracks.flatMap(t => t.clips).find(c => c.id === id); }
}

/**
 * Command: Add Clip
 */
export class AddClipCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private canonicalClip: ClipModel;
  
  constructor(
    public description: string,
    private trackId: string,
    clip: Partial<ClipModel> & { id: string; trackId: string; name: string; type: any },
    private ripple: boolean = false
  ) {
    this.canonicalClip = createCanonicalClip({ ...clip, trackId });
  }

  execute(project: ProjectModel): ProjectModel {
    const targetTrack = project.tracks.find(t => t.id === this.trackId);
    if (!targetTrack) return project;

    const updatedTracks = project.tracks.map(track => {
      if (track.id === this.trackId) {
        let clips = [...track.clips, this.canonicalClip];
        if (this.ripple) {
          const insertTime = this.canonicalClip.timelineStart;
          const shiftAmount = this.canonicalClip.duration;
          clips = track.clips.map(c => {
            const cStart = c.timelineStart ?? c.start ?? 0;
            if (cStart >= insertTime && c.id !== this.canonicalClip.id) {
              const newStart = cStart + shiftAmount;
              return createCanonicalClip({ ...c, timelineStart: newStart, start: newStart });
            }
            return c;
          });
          clips.push(this.canonicalClip);
        }
        return {
          ...track,
          clips
        };
      }
      return track;
    });

    return { ...project, tracks: updatedTracks };
  }

  undo(project: ProjectModel): ProjectModel {
    const updatedTracks = project.tracks.map(track => {
      if (track.id === this.trackId) {
        let clips = track.clips.filter(c => c.id !== this.canonicalClip.id);
        if (this.ripple) {
          const insertTime = this.canonicalClip.timelineStart;
          const shiftAmount = this.canonicalClip.duration;
          clips = clips.map(c => {
            const cStart = c.timelineStart ?? c.start ?? 0;
            if (cStart >= insertTime + shiftAmount) {
              const newStart = Math.max(0, cStart - shiftAmount);
              return createCanonicalClip({ ...c, timelineStart: newStart, start: newStart });
            }
            return c;
          });
        }
        return {
          ...track,
          clips
        };
      }
      return track;
    });

    return { ...project, tracks: updatedTracks };
  }
}

/**
 * Command: Remove Clip (with optional Ripple Delete)
 */
export class RemoveClipCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private removedClip: ClipModel | null = null;
  private trackId: string = '';
  private prevTrackClips: ClipModel[] = [];

  constructor(
    public description: string,
    private clipId: string,
    private ripple: boolean = false
  ) {}

  execute(project: ProjectModel): ProjectModel {
    let targetClip: ClipModel | null = null;
    let targetTrackId = '';

    for (const track of project.tracks) {
      const found = track.clips.find(c => c.id === this.clipId);
      if (found) {
        targetClip = found;
        targetTrackId = track.id;
        this.prevTrackClips = [...track.clips];
        break;
      }
    }

    if (!targetClip) return project;

    this.removedClip = targetClip;
    this.trackId = targetTrackId;

    const updatedTracks = project.tracks.map(track => {
      if (track.id === targetTrackId) {
        let remaining = track.clips.filter(c => c.id !== this.clipId);
        if (this.ripple && targetClip) {
          const removedStart = targetClip.timelineStart ?? targetClip.start ?? 0;
          const shiftAmount = targetClip.duration;
          remaining = remaining.map(c => {
            const cStart = c.timelineStart ?? c.start ?? 0;
            if (cStart >= removedStart) {
              const newStart = Math.max(0, cStart - shiftAmount);
              return createCanonicalClip({ ...c, timelineStart: newStart, start: newStart });
            }
            return c;
          });
        }
        return {
          ...track,
          clips: remaining
        };
      }
      return track;
    });

    return { ...project, tracks: updatedTracks };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!this.removedClip || !this.trackId) return project;

    const updatedTracks = project.tracks.map(track => {
      if (track.id === this.trackId) {
        return {
          ...track,
          clips: [...this.prevTrackClips]
        };
      }
      return track;
    });

    return { ...project, tracks: updatedTracks };
  }
}

/**
 * Command: Split Clip (Deterministic source/timeline split)
 */
export class SplitClipCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private originalClip: ClipModel | null = null;
  private leftClip: ClipModel | null = null;
  private rightClip: ClipModel | null = null;
  private targetTrackId: string = '';

  constructor(
    public description: string,
    private clipId: string,
    private splitTimelineTime: number
  ) {}

  execute(project: ProjectModel): ProjectModel {
    let foundClip: ClipModel | null = null;
    let foundTrackId = '';

    for (const track of project.tracks) {
      const c = track.clips.find(clip => clip.id === this.clipId);
      if (c) {
        foundClip = c;
        foundTrackId = track.id;
        break;
      }
    }

    if (!foundClip) return project;

    const splitResult = TimelineEngine.splitClip(foundClip, this.splitTimelineTime);
    if (!splitResult) {
      return project; // Invalid split point outside clip boundaries
    }

    this.originalClip = foundClip;
    this.targetTrackId = foundTrackId;
    this.leftClip = splitResult.leftClip;
    this.rightClip = splitResult.rightClip;

    const updatedTracks = project.tracks.map(track => {
      if (track.id === foundTrackId) {
        const remainingClips = track.clips.filter(c => c.id !== this.clipId);
        return {
          ...track,
          clips: [...remainingClips, this.leftClip!, this.rightClip!]
        };
      }
      return track;
    });

    return { ...project, tracks: updatedTracks };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!this.originalClip || !this.targetTrackId || !this.leftClip || !this.rightClip) {
      return project;
    }

    const updatedTracks = project.tracks.map(track => {
      if (track.id === this.targetTrackId) {
        const filteredClips = track.clips.filter(
          c => c.id !== this.leftClip!.id && c.id !== this.rightClip!.id
        );
        return {
          ...track,
          clips: [...filteredClips, this.originalClip!]
        };
      }
      return track;
    });

    return { ...project, tracks: updatedTracks };
  }
}

/**
 * Command: Trim Clip (Left or Right, with optional Ripple)
 */
export class TrimClipCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevClip: ClipModel | null = null;
  private prevTrackClips: ClipModel[] = [];
  private targetTrackId: string = '';

  constructor(
    public description: string,
    private clipId: string,
    private edge: 'left' | 'right',
    private deltaSeconds: number,
    private ripple: boolean = false
  ) {}

  execute(project: ProjectModel): ProjectModel {
    let foundClip: ClipModel | null = null;
    let foundTrackId = '';

    for (const track of project.tracks) {
      const c = track.clips.find(clip => clip.id === this.clipId);
      if (c) {
        foundClip = c;
        foundTrackId = track.id;
        this.prevTrackClips = [...track.clips];
        break;
      }
    }

    if (!foundClip) return project;

    const trimmedClip = TimelineEngine.trimClip(foundClip, this.edge, this.deltaSeconds);
    if (!trimmedClip) {
      return project; // Invalid trim rejected
    }

    this.prevClip = foundClip;
    this.targetTrackId = foundTrackId;

    const updatedTracks = project.tracks.map(track => {
      if (track.id === foundTrackId) {
        let clips = track.clips.map(c => (c.id === this.clipId ? trimmedClip : c));

        if (this.ripple) {
          // If ripple is enabled, shift subsequent clips
          const shiftAmount = trimmedClip.duration - foundClip!.duration;
          const originalEnd = (foundClip!.timelineStart ?? foundClip!.start ?? 0) + foundClip!.duration;

          clips = clips.map(c => {
            if (c.id === this.clipId) return c;
            const cStart = c.timelineStart ?? c.start ?? 0;
            if (cStart >= originalEnd - 0.001) {
              const newStart = Math.max(0, cStart + shiftAmount);
              return createCanonicalClip({ ...c, timelineStart: newStart, start: newStart });
            }
            return c;
          });
        }

        return {
          ...track,
          clips
        };
      }
      return track;
    });

    return { ...project, tracks: updatedTracks };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!this.prevClip || !this.targetTrackId) return project;

    const updatedTracks = project.tracks.map(track => {
      if (track.id === this.targetTrackId) {
        return {
          ...track,
          clips: [...this.prevTrackClips]
        };
      }
      return track;
    });

    return { ...project, tracks: updatedTracks };
  }
}

/**
 * Command: Move Clip Position / Track
 */
export class MoveClipCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevStart: number = 0;
  private prevTrackId: string = '';

  constructor(
    public description: string,
    private clipId: string,
    private newStart: number,
    private newTrackId?: string
  ) {}

  execute(project: ProjectModel): ProjectModel {
    let movedClip: ClipModel | null = null;
    let originalTrackId = '';

    // Find and remove from original track
    const tracksWithoutClip = project.tracks.map(track => {
      const c = track.clips.find(clip => clip.id === this.clipId);
      if (c) {
        movedClip = { ...c };
        originalTrackId = track.id;
        return {
          ...track,
          clips: track.clips.filter(clip => clip.id !== this.clipId)
        };
      }
      return track;
    });

    if (!movedClip) return project;

    this.prevStart = (movedClip as ClipModel).timelineStart ?? (movedClip as ClipModel).start ?? 0;
    this.prevTrackId = originalTrackId;

    const targetTrackId = this.newTrackId || originalTrackId;

    // Add to target track with updated timeline start time
    const updatedTracks = tracksWithoutClip.map(track => {
      if (track.id === targetTrackId) {
        const updatedClip = TimelineEngine.moveClip(movedClip!, this.newStart, targetTrackId);
        return {
          ...track,
          clips: [...track.clips, updatedClip]
        };
      }
      return track;
    });

    return { ...project, tracks: updatedTracks };
  }

  undo(project: ProjectModel): ProjectModel {
    let movedClip: ClipModel | null = null;

    const tracksWithoutClip = project.tracks.map(track => {
      const c = track.clips.find(clip => clip.id === this.clipId);
      if (c) {
        movedClip = { ...c };
        return {
          ...track,
          clips: track.clips.filter(clip => clip.id !== this.clipId)
        };
      }
      return track;
    });

    if (!movedClip) return project;

    const updatedTracks = tracksWithoutClip.map(track => {
      if (track.id === this.prevTrackId) {
        const restoredClip = TimelineEngine.moveClip(movedClip!, this.prevStart, this.prevTrackId);
        return {
          ...track,
          clips: [...track.clips, restoredClip]
        };
      }
      return track;
    });

    return { ...project, tracks: updatedTracks };
  }
}

/**
 * Command: Update Clip Props
 */
export class UpdateClipPropsCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevClip: ClipModel | null = null;

  constructor(
    public description: string,
    private clipId: string,
    private updates: Partial<ClipModel>
  ) {}

  execute(project: ProjectModel): ProjectModel {
    let foundPrev: ClipModel | null = null;

    const updatedTracks = project.tracks.map(track => {
      const c = track.clips.find(clip => clip.id === this.clipId);
      if (c) {
        foundPrev = { ...c };
        return {
          ...track,
          clips: track.clips.map(clip => {
            if (clip.id === this.clipId) {
              return createCanonicalClip({ ...clip, ...this.updates });
            }
            return clip;
          })
        };
      }
      return track;
    });

    if (!foundPrev) return project;

    this.prevClip = foundPrev;
    return { ...project, tracks: updatedTracks };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!this.prevClip) return project;

    const updatedTracks = project.tracks.map(track => {
      const c = track.clips.find(clip => clip.id === this.clipId);
      if (c) {
        return {
          ...track,
          clips: track.clips.map(clip => {
            if (clip.id === this.clipId) {
              return { ...this.prevClip! };
            }
            return clip;
          })
        };
      }
      return track;
    });

    return { ...project, tracks: updatedTracks };
  }
}

/**
 * Command: Update Track Properties (Mute, Lock, Solo, Visible)
 */
export class UpdateTrackPropsCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevTrack: TrackModel | null = null;

  constructor(
    public description: string,
    private trackId: string,
    private updates: Partial<TrackModel>
  ) {}

  execute(project: ProjectModel): ProjectModel {
    let foundPrev: TrackModel | null = null;

    const updatedTracks = project.tracks.map(track => {
      if (track.id === this.trackId) {
        foundPrev = { ...track };
        return { ...track, ...this.updates };
      }
      return track;
    });

    if (!foundPrev) return project;

    this.prevTrack = foundPrev;
    return { ...project, tracks: updatedTracks };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!this.prevTrack) return project;

    const updatedTracks = project.tracks.map(track => {
      if (track.id === this.trackId) {
        return { ...this.prevTrack! };
      }
      return track;
    });

    return { ...project, tracks: updatedTracks };
  }
}

/**
 * Command: Update Project Settings
 */
export class UpdateProjectSettingsCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevSettings: ProjectSettings | null = null;

  constructor(
    public description: string,
    private newSettings: Partial<ProjectSettings>
  ) {}

  execute(project: ProjectModel): ProjectModel {
    this.prevSettings = { ...project.settings };
    return {
      ...project,
      settings: { ...project.settings, ...this.newSettings }
    };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!this.prevSettings) return project;
    return {
      ...project,
      settings: this.prevSettings
    };
  }
}

/**
 * Command: Insert Edit (Ripples subsequent clips on target track)
 */
export class InsertEditCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevTracks: TrackModel[] = [];

  constructor(
    public description: string,
    private targetTrackId: string,
    private clipToInsert: ClipModel,
    private atTimelineTime: number
  ) {}

  execute(project: ProjectModel): ProjectModel {
    this.prevTracks = project.tracks.map(t => ({ ...t, clips: [...t.clips] }));
    return TimelineEngine.insertEdit(project, this.targetTrackId, this.clipToInsert, this.atTimelineTime);
  }

  undo(project: ProjectModel): ProjectModel {
    if (this.prevTracks.length === 0) return project;
    return { ...project, tracks: this.prevTracks };
  }
}

/**
 * Command: Overwrite Edit (Replaces underlying range without rippling subsequent clips)
 */
export class OverwriteEditCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevTracks: TrackModel[] = [];

  constructor(
    public description: string,
    private targetTrackId: string,
    private clipToInsert: ClipModel,
    private atTimelineTime: number
  ) {}

  execute(project: ProjectModel): ProjectModel {
    this.prevTracks = project.tracks.map(t => ({ ...t, clips: [...t.clips] }));
    return TimelineEngine.overwriteEdit(project, this.targetTrackId, this.clipToInsert, this.atTimelineTime);
  }

  undo(project: ProjectModel): ProjectModel {
    if (this.prevTracks.length === 0) return project;
    return { ...project, tracks: this.prevTracks };
  }
}

/**
 * Command: Add Marker
 */
export class AddMarkerCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();

  constructor(
    public description: string,
    private marker: MarkerModel
  ) {}

  execute(project: ProjectModel): ProjectModel {
    const existing = project.markers || [];
    return {
      ...project,
      markers: [...existing.filter(m => m.id !== this.marker.id), this.marker]
    };
  }

  undo(project: ProjectModel): ProjectModel {
    const existing = project.markers || [];
    return {
      ...project,
      markers: existing.filter(m => m.id !== this.marker.id)
    };
  }
}

/**
 * Command: Remove Marker
 */
export class RemoveMarkerCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private removedMarker: MarkerModel | null = null;

  constructor(
    public description: string,
    private markerId: string
  ) {}

  execute(project: ProjectModel): ProjectModel {
    const existing = project.markers || [];
    this.removedMarker = existing.find(m => m.id === this.markerId) || null;
    return {
      ...project,
      markers: existing.filter(m => m.id !== this.markerId)
    };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!this.removedMarker) return project;
    const existing = project.markers || [];
    return {
      ...project,
      markers: [...existing, this.removedMarker]
    };
  }
}

/**
 * Command: Set In / Out Points
 */
export class SetInOutPointsCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevIn: number | null | undefined = undefined;
  private prevOut: number | null | undefined = undefined;

  constructor(
    public description: string,
    private inPoint: number | null,
    private outPoint: number | null
  ) {}

  execute(project: ProjectModel): ProjectModel {
    this.prevIn = project.inPoint;
    this.prevOut = project.outPoint;
    return {
      ...project,
      inPoint: this.inPoint,
      outPoint: this.outPoint
    };
  }

  undo(project: ProjectModel): ProjectModel {
    return {
      ...project,
      inPoint: this.prevIn,
      outPoint: this.prevOut
    };
  }
}

/**
 * Command: Slip Clip (Shifts source media in/out without altering timeline position or duration)
 */
export class SlipClipCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevClip: ClipModel | null = null;
  private targetTrackId: string = '';

  constructor(
    public description: string,
    private clipId: string,
    private deltaSeconds: number,
    private maxSourceDuration?: number
  ) {}

  execute(project: ProjectModel): ProjectModel {
    let foundClip: ClipModel | null = null;
    let foundTrackId = '';

    for (const track of project.tracks) {
      const c = track.clips.find(clip => clip.id === this.clipId);
      if (c) {
        foundClip = c;
        foundTrackId = track.id;
        break;
      }
    }

    if (!foundClip) return project;

    const slipped = TimelineEngine.slipClip(foundClip, this.deltaSeconds, this.maxSourceDuration);
    if (!slipped) return project;

    this.prevClip = foundClip;
    this.targetTrackId = foundTrackId;

    const updatedTracks = project.tracks.map(track => {
      if (track.id === foundTrackId) {
        return {
          ...track,
          clips: track.clips.map(c => (c.id === this.clipId ? slipped : c))
        };
      }
      return track;
    });

    return { ...project, tracks: updatedTracks };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!this.prevClip || !this.targetTrackId) return project;

    const updatedTracks = project.tracks.map(track => {
      if (track.id === this.targetTrackId) {
        return {
          ...track,
          clips: track.clips.map(c => (c.id === this.clipId ? this.prevClip! : c))
        };
      }
      return track;
    });

    return { ...project, tracks: updatedTracks };
  }
}

/**
 * Command: Slide Clip (Moves clip along timeline and adjusts adjacent clips)
 */
export class SlideClipCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevTrackClips: ClipModel[] = [];
  private targetTrackId: string = '';

  constructor(
    public description: string,
    private clipId: string,
    private deltaSeconds: number
  ) {}

  execute(project: ProjectModel): ProjectModel {
    const track = project.tracks.find(t => t.clips.some(c => c.id === this.clipId));
    if (!track) return project;

    const updatedTrack = TimelineEngine.slideClip(track, this.clipId, this.deltaSeconds);
    if (!updatedTrack) return project;

    this.prevTrackClips = [...track.clips];
    this.targetTrackId = track.id;

    const updatedTracks = project.tracks.map(t => (t.id === track.id ? updatedTrack : t));
    return { ...project, tracks: updatedTracks };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!this.targetTrackId || this.prevTrackClips.length === 0) return project;

    const updatedTracks = project.tracks.map(t => {
      if (t.id === this.targetTrackId) {
        return {
          ...t,
          clips: [...this.prevTrackClips]
        };
      }
      return t;
    });

    return { ...project, tracks: updatedTracks };
  }
}

/**
 * Command: Ripple Trim Head (Q key shortcut)
 */
export class RippleTrimHeadCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevTrackClips: ClipModel[] = [];
  private targetTrackId: string = '';

  constructor(
    public description: string,
    private clipId: string,
    private playheadTime: number
  ) {}

  execute(project: ProjectModel): ProjectModel {
    const track = project.tracks.find(t => t.clips.some(c => c.id === this.clipId));
    if (!track) return project;

    const updatedTrack = TimelineEngine.rippleTrimHead(track, this.clipId, this.playheadTime);
    if (!updatedTrack) return project;

    this.prevTrackClips = [...track.clips];
    this.targetTrackId = track.id;

    const updatedTracks = project.tracks.map(t => (t.id === track.id ? updatedTrack : t));
    return { ...project, tracks: updatedTracks };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!this.targetTrackId || this.prevTrackClips.length === 0) return project;

    const updatedTracks = project.tracks.map(t => {
      if (t.id === this.targetTrackId) {
        return { ...t, clips: [...this.prevTrackClips] };
      }
      return t;
    });

    return { ...project, tracks: updatedTracks };
  }
}

/**
 * Command: Ripple Trim Tail (W key shortcut)
 */
export class RippleTrimTailCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevTrackClips: ClipModel[] = [];
  private targetTrackId: string = '';

  constructor(
    public description: string,
    private clipId: string,
    private playheadTime: number
  ) {}

  execute(project: ProjectModel): ProjectModel {
    const track = project.tracks.find(t => t.clips.some(c => c.id === this.clipId));
    if (!track) return project;

    const updatedTrack = TimelineEngine.rippleTrimTail(track, this.clipId, this.playheadTime);
    if (!updatedTrack) return project;

    this.prevTrackClips = [...track.clips];
    this.targetTrackId = track.id;

    const updatedTracks = project.tracks.map(t => (t.id === track.id ? updatedTrack : t));
    return { ...project, tracks: updatedTracks };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!this.targetTrackId || this.prevTrackClips.length === 0) return project;

    const updatedTracks = project.tracks.map(t => {
      if (t.id === this.targetTrackId) {
        return { ...t, clips: [...this.prevTrackClips] };
      }
      return t;
    });

    return { ...project, tracks: updatedTracks };
  }
}

/**
 * Command: Split Audio & Video (L/J cut split into linked independent tracks)
 */
export class RollClipCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevTrackClips: ClipModel[] = [];
  private targetTrackId: string = '';

  constructor(
    public description: string,
    private clipId: string,
    private edge: 'in' | 'out',
    private deltaSeconds: number
  ) {}

  execute(project: ProjectModel): ProjectModel {
    const track = project.tracks.find(t => t.clips.some(c => c.id === this.clipId));
    if (!track) return project;

    const updatedTrack = TimelineEngine.rollClip(track, this.clipId, this.edge, this.deltaSeconds);
    if (!updatedTrack) return project;

    this.prevTrackClips = [...track.clips];
    this.targetTrackId = track.id;

    return {
      ...project,
      tracks: project.tracks.map(t => (t.id === track.id ? updatedTrack : t))
    };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!this.targetTrackId || this.prevTrackClips.length === 0) return project;

    return {
      ...project,
      tracks: project.tracks.map(t =>
        t.id === this.targetTrackId ? { ...t, clips: [...this.prevTrackClips] } : t
      )
    };
  }
}

export class SplitAudioVideoCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevVideoClip: ClipModel | null = null;
  private videoTrackId: string = '';
  private audioTrackId: string = '';
  private createdAudioClipId: string = '';

  constructor(
    public description: string,
    private clipId: string,
    private targetAudioTrackId: string
  ) {}

  execute(project: ProjectModel): ProjectModel {
    let sourceClip: ClipModel | null = null;
    let vTrackId = '';

    for (const t of project.tracks) {
      const found = t.clips.find(c => c.id === this.clipId);
      if (found) {
        sourceClip = found;
        vTrackId = t.id;
        break;
      }
    }

    if (!sourceClip) return project;

    const splitRes = TimelineEngine.splitAudioVideo(sourceClip, this.targetAudioTrackId);
    this.prevVideoClip = sourceClip;
    this.videoTrackId = vTrackId;
    this.audioTrackId = this.targetAudioTrackId;
    this.createdAudioClipId = splitRes.audioClip.id;

    const updatedTracks = project.tracks.map(track => {
      if (track.id === vTrackId) {
        return {
          ...track,
          clips: track.clips.map(c => (c.id === this.clipId ? splitRes.videoClip : c))
        };
      }
      if (track.id === this.targetAudioTrackId) {
        return {
          ...track,
          clips: [...track.clips, splitRes.audioClip]
        };
      }
      return track;
    });

    return { ...project, tracks: updatedTracks };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!this.prevVideoClip) return project;

    const updatedTracks = project.tracks.map(track => {
      if (track.id === this.videoTrackId) {
        return {
          ...track,
          clips: track.clips.map(c => (c.id === this.clipId ? this.prevVideoClip! : c))
        };
      }
      if (track.id === this.audioTrackId) {
        return {
          ...track,
          clips: track.clips.filter(c => c.id !== this.createdAudioClipId)
        };
      }
      return track;
    });

    return { ...project, tracks: updatedTracks };
  }
}

/**
 * Command: Set Audio Fade In / Fade Out
 */
export class SetAudioFadeCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevClip: ClipModel | null = null;

  constructor(
    public description: string,
    private clipId: string,
    private fadeIn?: number,
    private fadeOut?: number
  ) {}

  execute(project: ProjectModel): ProjectModel {
    let found = false;
    const updatedTracks = project.tracks.map(track => {
      const clip = track.clips.find(c => c.id === this.clipId);
      if (clip) {
        found = true;
        this.prevClip = { ...clip };
        return {
          ...track,
          clips: track.clips.map(c => {
            if (c.id === this.clipId) {
              return createCanonicalClip({
                ...c,
                fadeIn: this.fadeIn !== undefined ? this.fadeIn : c.fadeIn,
                fadeOut: this.fadeOut !== undefined ? this.fadeOut : c.fadeOut
              });
            }
            return c;
          })
        };
      }
      return track;
    });

    if (!found) return project;
    return { ...project, tracks: updatedTracks };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!this.prevClip) return project;
    const updatedTracks = project.tracks.map(track => {
      const clip = track.clips.find(c => c.id === this.clipId);
      if (clip) {
        return {
          ...track,
          clips: track.clips.map(c => (c.id === this.clipId ? { ...this.prevClip! } : c))
        };
      }
      return track;
    });
    return { ...project, tracks: updatedTracks };
  }
}

/**
 * Command: Set Audio Keyframe
 */
export class SetAudioKeyframeCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevKeyframes: Keyframe[] = [];
  private targetClipId: string = '';

  constructor(
    public description: string,
    private clipId: string,
    private keyframe: Keyframe
  ) {}

  execute(project: ProjectModel): ProjectModel {
    let found = false;
    const updatedTracks = project.tracks.map(track => {
      const clip = track.clips.find(c => c.id === this.clipId);
      if (clip) {
        found = true;
        this.targetClipId = clip.id;
        this.prevKeyframes = [...clip.keyframes];
        const newKeyframes = [...clip.keyframes.filter(k => k.id !== this.keyframe.id), this.keyframe].sort((a, b) => (a.timeOffset ?? 0) - (b.timeOffset ?? 0));
        return {
          ...track,
          clips: track.clips.map(c => (c.id === this.clipId ? createCanonicalClip({ ...c, keyframes: newKeyframes }) : c))
        };
      }
      return track;
    });

    if (!found) return project;
    return { ...project, tracks: updatedTracks };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!this.targetClipId) return project;
    const updatedTracks = project.tracks.map(track => {
      const clip = track.clips.find(c => c.id === this.targetClipId);
      if (clip) {
        return {
          ...track,
          clips: track.clips.map(c => (c.id === this.targetClipId ? createCanonicalClip({ ...c, keyframes: [...this.prevKeyframes] }) : c))
        };
      }
      return track;
    });
    return { ...project, tracks: updatedTracks };
  }
}

/**
 * Command: Update Keyframe
 */
export class UpdateKeyframeCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevKeyframes: Keyframe[] = [];
  private targetClipId: string = '';

  constructor(
    public description: string,
    private clipId: string,
    private keyframe: Keyframe
  ) {}

  execute(project: ProjectModel): ProjectModel {
    let found = false;
    const updatedTracks = project.tracks.map(track => {
      const clip = track.clips.find(c => c.id === this.clipId);
      if (clip) {
        found = true;
        this.targetClipId = clip.id;
        this.prevKeyframes = [...clip.keyframes];
        // Replace or add
        const newKeyframes = [...clip.keyframes.filter(k => k.id !== this.keyframe.id), this.keyframe].sort((a, b) => a.timeOffset - b.timeOffset);
        return {
          ...track,
          clips: track.clips.map(c => (c.id === this.clipId ? { ...c, keyframes: newKeyframes } : c))
        };
      }
      return track;
    });

    if (!found) return project;
    return { ...project, tracks: updatedTracks };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!this.targetClipId) return project;
    const updatedTracks = project.tracks.map(track => {
      const clip = track.clips.find(c => c.id === this.targetClipId);
      if (clip) {
        return {
          ...track,
          clips: track.clips.map(c => (c.id === this.targetClipId ? { ...c, keyframes: [...this.prevKeyframes] } : c))
        };
      }
      return track;
    });
    return { ...project, tracks: updatedTracks };
  }
}

/**
 * Command: Remove Keyframe
 */
export class RemoveKeyframeCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevKeyframes: Keyframe[] = [];
  private targetClipId: string = '';

  constructor(
    public description: string,
    private clipId: string,
    private keyframeId: string
  ) {}

  execute(project: ProjectModel): ProjectModel {
    let found = false;
    const updatedTracks = project.tracks.map(track => {
      const clip = track.clips.find(c => c.id === this.clipId);
      if (clip) {
        found = true;
        this.targetClipId = clip.id;
        this.prevKeyframes = [...clip.keyframes];
        const newKeyframes = clip.keyframes.filter(k => k.id !== this.keyframeId);
        return {
          ...track,
          clips: track.clips.map(c => (c.id === this.clipId ? { ...c, keyframes: newKeyframes } : c))
        };
      }
      return track;
    });

    if (!found) return project;
    return { ...project, tracks: updatedTracks };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!this.targetClipId) return project;
    const updatedTracks = project.tracks.map(track => {
      const clip = track.clips.find(c => c.id === this.targetClipId);
      if (clip) {
        return {
          ...track,
          clips: track.clips.map(c => (c.id === this.targetClipId ? { ...c, keyframes: [...this.prevKeyframes] } : c))
        };
      }
      return track;
    });
    return { ...project, tracks: updatedTracks };
  }
}

/**
 * Command: Update Transcript
 */
export class UpdateTranscriptCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevTranscript: TranscriptModel | undefined = undefined;

  constructor(
    public description: string,
    private newTranscript: TranscriptModel
  ) {}

  execute(project: ProjectModel): ProjectModel {
    this.prevTranscript = project.transcript ? { ...project.transcript } : undefined;
    return {
      ...project,
      transcript: this.newTranscript
    };
  }

  undo(project: ProjectModel): ProjectModel {
    return {
      ...project,
      transcript: this.prevTranscript
    };
  }
}

/**
 * Command: Generate Captions from Transcript
 */
export class GenerateCaptionsCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevTrackClips: ClipModel[] = [];
  private captionTrackId: string = '';

  constructor(
    public description: string,
    private transcript: TranscriptModel,
    private targetCaptionTrackId: string,
    private styleConfig?: Partial<CaptionStyleConfig>
  ) {}

  execute(project: ProjectModel): ProjectModel {
    const track = project.tracks.find(t => t.id === this.targetCaptionTrackId);
    if (!track) return project;

    this.prevTrackClips = [...track.clips];
    this.captionTrackId = track.id;

    const newCaptions = TimelineEngine.generateCaptionsFromTranscript(this.transcript, this.targetCaptionTrackId, this.styleConfig);

    const updatedTracks = project.tracks.map(t => {
      if (t.id === this.targetCaptionTrackId) {
        return {
          ...t,
          clips: [...t.clips, ...newCaptions]
        };
      }
      return t;
    });

    return { ...project, tracks: updatedTracks };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!this.captionTrackId) return project;

    const updatedTracks = project.tracks.map(t => {
      if (t.id === this.captionTrackId) {
        return {
          ...t,
          clips: [...this.prevTrackClips]
        };
      }
      return t;
    });

    return { ...project, tracks: updatedTracks };
  }
}

/**
 * Command: Replace generated captions
 *
 * The older GenerateCaptionsCommand APPENDS to the caption track, so generating twice duplicated
 * every caption. This one replaces exactly the generated caption clips based on the given
 * transcript and leaves text clips the editor placed by hand untouched. Undo restores the previous
 * clips of the track.
 */
export class ReplaceGeneratedCaptionsCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevTrackClips: ClipModel[] = [];
  private captionTrackId: string = '';
  private keptManualIds: string[] = [];

  constructor(
    public description: string,
    private transcript: TranscriptModel,
    private targetCaptionTrackId: string,
    private styleConfig?: Partial<CaptionStyleConfig>,
    /** Output canvas; keeps the requested caption position inside the safe area. */
    private canvas?: { width: number; height: number },
    /** Export canvas the project is cropped to (a vertical Short). */
    private outputCanvas?: { width: number; height: number }
  ) {}

  execute(project: ProjectModel): ProjectModel {
    const track = project.tracks.find(t => t.id === this.targetCaptionTrackId);
    if (!track) return project;

    this.prevTrackClips = [...track.clips];
    this.captionTrackId = track.id;

    const generated = TimelineEngine.generateCaptionsFromTranscript(
      this.transcript,
      this.targetCaptionTrackId,
      this.styleConfig,
      this.canvas,
      this.outputCanvas
    );
    // Caption clips that came from a transcript are replaced; hand-placed text clips stay.
    const kept = track.clips.filter(clip => clip.type !== 'caption');
    this.keptManualIds = kept.map(clip => clip.id);

    const updatedTracks = project.tracks.map(t =>
      t.id === this.captionTrackId ? { ...t, clips: [...kept, ...generated] } : t
    );

    return { ...project, tracks: updatedTracks };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!this.captionTrackId) return project;
    const updatedTracks = project.tracks.map(t =>
      t.id === this.captionTrackId ? { ...t, clips: [...this.prevTrackClips] } : t
    );
    return { ...project, tracks: updatedTracks };
  }

  /** Ids of the clips that were left in place (manual text clips). */
  get preservedClipIds(): string[] {
    return [...this.keptManualIds];
  }
}

/**
 * Command: Set Transform (Position, Scale, Rotation, Opacity, Anchor)
 */
export class SetTransformCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevClip: ClipModel | null = null;

  constructor(
    public description: string,
    private clipId: string,
    private transformProps: { scale?: number; scaleX?: number; scaleY?: number; positionX?: number; positionY?: number; rotation?: number; opacity?: number; anchorX?: number; anchorY?: number }
  ) {}

  execute(project: ProjectModel): ProjectModel {
    let found = false;
    const updatedTracks = project.tracks.map(track => {
      const clip = track.clips.find(c => c.id === this.clipId);
      if (clip) {
        found = true;
        this.prevClip = { ...clip };
        return {
          ...track,
          clips: track.clips.map(c => {
            if (c.id === this.clipId) {
              return createCanonicalClip({
                ...c,
                scale: this.transformProps.scale !== undefined ? this.transformProps.scale : c.scale,
                scaleX: this.transformProps.scaleX !== undefined ? this.transformProps.scaleX : c.scaleX,
                scaleY: this.transformProps.scaleY !== undefined ? this.transformProps.scaleY : c.scaleY,
                positionX: this.transformProps.positionX !== undefined ? this.transformProps.positionX : c.positionX,
                positionY: this.transformProps.positionY !== undefined ? this.transformProps.positionY : c.positionY,
                rotation: this.transformProps.rotation !== undefined ? this.transformProps.rotation : c.rotation,
                opacity: this.transformProps.opacity !== undefined ? this.transformProps.opacity : c.opacity,
                anchorX: this.transformProps.anchorX !== undefined ? this.transformProps.anchorX : c.anchorX,
                anchorY: this.transformProps.anchorY !== undefined ? this.transformProps.anchorY : c.anchorY,
                transform: {
                  scale: this.transformProps.scale !== undefined ? this.transformProps.scale : (c.transform?.scale ?? c.scale),
                  positionX: this.transformProps.positionX !== undefined ? this.transformProps.positionX : c.positionX,
                  positionY: this.transformProps.positionY !== undefined ? this.transformProps.positionY : c.positionY,
                  rotation: this.transformProps.rotation !== undefined ? this.transformProps.rotation : c.rotation,
                  opacity: this.transformProps.opacity !== undefined ? this.transformProps.opacity : c.opacity
                }
              });
            }
            return c;
          })
        };
      }
      return track;
    });

    if (!found) return project;
    return { ...project, tracks: updatedTracks };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!this.prevClip) return project;
    const updatedTracks = project.tracks.map(track => {
      const clip = track.clips.find(c => c.id === this.clipId);
      if (clip) {
        return {
          ...track,
          clips: track.clips.map(c => (c.id === this.clipId ? { ...this.prevClip! } : c))
        };
      }
      return track;
    });
    return { ...project, tracks: updatedTracks };
  }
}

/**
 * Command: Set Color Correction
 */
export class SetColorCorrectionCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevClip: ClipModel | null = null;

  constructor(
    public description: string,
    private clipId: string,
    private colorCorrection: ColorCorrectionConfig
  ) {}

  execute(project: ProjectModel): ProjectModel {
    let found = false;
    const updatedTracks = project.tracks.map(track => {
      const clip = track.clips.find(c => c.id === this.clipId);
      if (clip) {
        found = true;
        this.prevClip = { ...clip };
        return {
          ...track,
          clips: track.clips.map(c => {
            if (c.id === this.clipId) {
              return createCanonicalClip({
                ...c,
                colorCorrection: { ...this.colorCorrection }
              });
            }
            return c;
          })
        };
      }
      return track;
    });

    if (!found) return project;
    return { ...project, tracks: updatedTracks };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!this.prevClip) return project;
    const updatedTracks = project.tracks.map(track => {
      const clip = track.clips.find(c => c.id === this.clipId);
      if (clip) {
        return {
          ...track,
          clips: track.clips.map(c => (c.id === this.clipId ? { ...this.prevClip! } : c))
        };
      }
      return track;
    });
    return { ...project, tracks: updatedTracks };
  }
}

/**
 * Command: Set Transition
 */
export class SetTransitionCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevClip: ClipModel | null = null;

  constructor(
    public description: string,
    private clipId: string,
    private edge: 'in' | 'out',
    private transition: TransitionConfig
  ) {}

  execute(project: ProjectModel): ProjectModel {
    let found = false;
    const updatedTracks = project.tracks.map(track => {
      const clip = track.clips.find(c => c.id === this.clipId);
      if (clip) {
        found = true;
        this.prevClip = { ...clip };
        return {
          ...track,
          clips: track.clips.map(c => {
            if (c.id === this.clipId) {
              const transitions = c.transitions ? { ...c.transitions } : {};
              if (this.edge === 'in') transitions.in = this.transition;
              else transitions.out = this.transition;
              return createCanonicalClip({
                ...c,
                transitions
              });
            }
            return c;
          })
        };
      }
      return track;
    });

    if (!found) return project;
    return { ...project, tracks: updatedTracks };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!this.prevClip) return project;
    const updatedTracks = project.tracks.map(track => {
      const clip = track.clips.find(c => c.id === this.clipId);
      if (clip) {
        return {
          ...track,
          clips: track.clips.map(c => (c.id === this.clipId ? { ...this.prevClip! } : c))
        };
      }
      return track;
    });
    return { ...project, tracks: updatedTracks };
  }
}

/**
 * Command: Add / Update Project Note
 */
export class AddProjectNoteCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevNote: ProjectNote | null = null;

  constructor(
    public description: string,
    private note: ProjectNote
  ) {}

  execute(project: ProjectModel): ProjectModel {
    const existing = project.notes?.find(n => n.id === this.note.id);
    if (existing) {
      this.prevNote = { ...existing };
    }
    const filtered = (project.notes || []).filter(n => n.id !== this.note.id);
    return {
      ...project,
      notes: [...filtered, this.note]
    };
  }

  undo(project: ProjectModel): ProjectModel {
    if (this.prevNote) {
      return {
        ...project,
        notes: (project.notes || []).map(n => n.id === this.prevNote!.id ? this.prevNote! : n)
      };
    } else {
      return {
        ...project,
        notes: (project.notes || []).filter(n => n.id !== this.note.id)
      };
    }
  }
}

/**
 * Command: Remove Project Note
 */
export class RemoveProjectNoteCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private removedNote: ProjectNote | null = null;

  constructor(
    public description: string,
    private noteId: string
  ) {}

  execute(project: ProjectModel): ProjectModel {
    const target = project.notes?.find(n => n.id === this.noteId);
    if (!target) return project;
    this.removedNote = { ...target };
    return {
      ...project,
      notes: (project.notes || []).filter(n => n.id !== this.noteId)
    };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!this.removedNote) return project;
    return {
      ...project,
      notes: [...(project.notes || []), this.removedNote]
    };
  }
}

/**
 * Command: Create AI Edit Decision
 */
export class CreateEditDecisionCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();

  constructor(
    public description: string,
    private decision: EditDecision
  ) {}

  execute(project: ProjectModel): ProjectModel {
    const existing = project.editDecisions || [];
    return {
      ...project,
      editDecisions: [...existing.filter(d => d.id !== this.decision.id), this.decision]
    };
  }

  undo(project: ProjectModel): ProjectModel {
    return {
      ...project,
      editDecisions: (project.editDecisions || []).filter(d => d.id !== this.decision.id)
    };
  }
}

/**
 * Command: Update Edit Decision Status
 */
export class UpdateEditDecisionStatusCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevStatus: EditDecision['status'] | null = null;

  constructor(
    public description: string,
    private decisionId: string,
    private newStatus: EditDecision['status']
  ) {}

  execute(project: ProjectModel): ProjectModel {
    const target = project.editDecisions?.find(d => d.id === this.decisionId);
    if (!target) return project;
    this.prevStatus = target.status;
    return {
      ...project,
      editDecisions: (project.editDecisions || []).map(d => 
        d.id === this.decisionId ? { ...d, status: this.newStatus } : d
      )
    };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!this.prevStatus) return project;
    return {
      ...project,
      editDecisions: (project.editDecisions || []).map(d => 
        d.id === this.decisionId ? { ...d, status: this.prevStatus! } : d
      )
    };
  }
}

/**
 * Command: Add Review Comment
 */
export class AddReviewCommentCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();

  constructor(
    public description: string,
    private comment: ReviewComment
  ) {}

  execute(project: ProjectModel): ProjectModel {
    const currentReview = project.reviewState || { status: 'draft', comments: [] };
    return {
      ...project,
      reviewState: {
        ...currentReview,
        comments: [...currentReview.comments.filter(c => c.id !== this.comment.id), this.comment]
      }
    };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!project.reviewState) return project;
    return {
      ...project,
      reviewState: {
        ...project.reviewState,
        comments: project.reviewState.comments.filter(c => c.id !== this.comment.id)
      }
    };
  }
}

/**
 * Command: Resolve Review Comment
 */
export class ResolveReviewCommentCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevStatus: ReviewComment['status'] | null = null;

  constructor(
    public description: string,
    private commentId: string,
    private status: 'open' | 'resolved' = 'resolved'
  ) {}

  execute(project: ProjectModel): ProjectModel {
    if (!project.reviewState) return project;
    const comment = project.reviewState.comments.find(c => c.id === this.commentId);
    if (!comment) return project;
    this.prevStatus = comment.status;
    return {
      ...project,
      reviewState: {
        ...project.reviewState,
        comments: project.reviewState.comments.map(c => 
          c.id === this.commentId ? { ...c, status: this.status } : c
        )
      }
    };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!project.reviewState || !this.prevStatus) return project;
    return {
      ...project,
      reviewState: {
        ...project.reviewState,
        comments: project.reviewState.comments.map(c => 
          c.id === this.commentId ? { ...c, status: this.prevStatus! } : c
        )
      }
    };
  }
}

/**
 * Command: Set Review Status
 */
export class SetReviewStatusCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevReviewState: ReviewState | null = null;

  constructor(
    public description: string,
    private status: ReviewState['status'],
    private lockedForExport: boolean = false
  ) {}

  execute(project: ProjectModel): ProjectModel {
    this.prevReviewState = project.reviewState ? { ...project.reviewState } : { status: 'draft', comments: [] };
    return {
      ...project,
      reviewState: {
        ...this.prevReviewState,
        status: this.status,
        lockedForExport: this.lockedForExport
      }
    };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!this.prevReviewState) return project;
    return {
      ...project,
      reviewState: { ...this.prevReviewState }
    };
  }
}

/**
 * Command: Create Project Version Snapshot
 */
export class CreateProjectVersionCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();

  constructor(
    public description: string,
    private label: string,
    private versionDescription: string
  ) {}

  execute(project: ProjectModel): ProjectModel {
    const existingVersions = project.versions || [];
    const nextVersionNum = existingVersions.length + 1;
    const newVersion: ProjectVersion = {
      id: `ver_${crypto.randomUUID()}`,
      versionNumber: nextVersionNum,
      label: this.label,
      createdAt: Date.now(),
      description: this.versionDescription,
      snapshot: JSON.parse(JSON.stringify(project))
    };
    return {
      ...project,
      versions: [...existingVersions, newVersion]
    };
  }

  undo(project: ProjectModel): ProjectModel {
    const existing = project.versions || [];
    if (existing.length === 0) return project;
    return {
      ...project,
      versions: existing.slice(0, existing.length - 1)
    };
  }
}

/**
 * Command: Restore Project Version Snapshot
 */
export class RestoreProjectVersionCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private previousStateSnapshot: ProjectModel | null = null;

  constructor(
    public description: string,
    private versionId: string
  ) {}

  execute(project: ProjectModel): ProjectModel {
    const versionObj = project.versions?.find(v => v.id === this.versionId);
    if (!versionObj || !versionObj.snapshot) return project;
    this.previousStateSnapshot = JSON.parse(JSON.stringify(project));
    
    return {
      ...(versionObj.snapshot as ProjectModel),
      versions: project.versions
    };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!this.previousStateSnapshot) return project;
    return {
      ...this.previousStateSnapshot
    };
  }
}

/**
 * Command: Sync Multicam Group
 */
export class SyncMulticamCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevState: { tracks: TrackModel[]; multicamGroups?: any[] } | null = null;

  constructor(
    public description: string,
    private clipIds: string[],
    private groupName: string,
    private syncMethod: 'waveform' | 'timecode' | 'manual' = 'manual',
    /** Real per-angle offsets in seconds, keyed by asset id. Missing entries stay at 0. */
    private angleOffsets: Record<string, number> = {},
    /** Whether the offsets were derived from analysis (true) or left to manual alignment. */
    private syncVerified: boolean = false
  ) {}

  execute(project: ProjectModel): ProjectModel {
    this.prevState = { tracks: JSON.parse(JSON.stringify(project.tracks)), multicamGroups: project.multicamGroups ? [...project.multicamGroups] : [] };
    
    const group: any = {
      id: `mcg_${crypto.randomUUID()}`,
      name: this.groupName,
      angles: [],
      syncMethod: this.syncMethod,
      syncVerified: this.syncVerified
    };

    const updatedTracks = project.tracks.map(track => {
      return {
        ...track,
        clips: track.clips.map(clip => {
          if (this.clipIds.includes(clip.id)) {
            const angleId = `angle_${crypto.randomUUID()}`;
            group.angles.push({
              id: angleId,
              assetId: clip.assetId!,
              name: clip.name,
              offset: this.angleOffsets[clip.assetId!] ?? 0
            });
            return {
              ...clip,
              multicamGroupId: group.id,
              multicamAngleId: angleId
            };
          }
          return clip;
        })
      };
    });

    return {
      ...project,
      tracks: updatedTracks,
      multicamGroups: [...(project.multicamGroups || []), group]
    };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!this.prevState) return project;
    return {
      ...project,
      tracks: this.prevState.tracks,
      multicamGroups: this.prevState.multicamGroups
    };
  }
}

/**
 * Command: Switch Multicam Angle
 * This splits the clip at switchTime and changes the angle for the resulting clip.
 */
export class SwitchMulticamAngleCommand implements Command {
  public id = crypto.randomUUID();
  public timestamp = Date.now();
  private prevTracks: TrackModel[] | null = null;

  constructor(
    public description: string,
    private clipId: string,
    private targetAngleId: string,
    private switchTime: number
  ) {}

  execute(project: ProjectModel): ProjectModel {
    this.prevTracks = JSON.parse(JSON.stringify(project.tracks));
    
    let targetClip: ClipModel | null = null;
    let targetTrackId = '';

    for (const track of project.tracks) {
      const found = track.clips.find(c => c.id === this.clipId);
      if (found) {
        targetClip = found;
        targetTrackId = track.id;
        break;
      }
    }

    if (!targetClip || !targetClip.multicamGroupId) return project;

    const group = project.multicamGroups?.find(g => g.id === targetClip!.multicamGroupId);
    const angle = group?.angles.find(a => a.id === this.targetAngleId);
    if (!angle) return project;

    // 1. Split clip at switchTime
    const splitResult = TimelineEngine.splitClip(targetClip, this.switchTime);
    if (!splitResult) {
      // If we can't split (e.g. at start), just change the angle of the existing clip
      const updatedTracks = project.tracks.map(t => {
        if (t.id === targetTrackId) {
          return {
            ...t,
            clips: t.clips.map(c => {
              if (c.id === this.clipId) {
                return { ...c, multicamAngleId: this.targetAngleId, assetId: angle.assetId, name: angle.name };
              }
              return c;
            })
          };
        }
        return t;
      });
      return { ...project, tracks: updatedTracks };
    }

    // 2. Change angle of the right clip
    const rightClipUpdated = {
      ...splitResult.rightClip,
      multicamAngleId: this.targetAngleId,
      assetId: angle.assetId,
      name: angle.name
    };

    const updatedTracks = project.tracks.map(track => {
      if (track.id === targetTrackId) {
        const remaining = track.clips.filter(c => c.id !== this.clipId);
        return {
          ...track,
          clips: [...remaining, splitResult.leftClip, rightClipUpdated]
        };
      }
      return track;
    });

    return { ...project, tracks: updatedTracks };
  }

  undo(project: ProjectModel): ProjectModel {
    if (!this.prevTracks) return project;
    return { ...project, tracks: this.prevTracks };
  }
}





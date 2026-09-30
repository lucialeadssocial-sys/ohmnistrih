/**
 * Core Engine Central Orchestrator & React Hooks
 * Connects Storage, Media, Command System, Timeline, Render, and Export Engines.
 */

import { useState, useEffect } from 'react';
import { ProjectModel, ClipModel, TrackModel, MediaAsset, ProjectSettings, MarkerModel, Keyframe, TranscriptModel, CaptionStyleConfig, ColorCorrectionConfig, TransitionConfig, createCanonicalClip } from './types/project';
import {
  CommandManager,
  AddClipCommand,
  RemoveClipCommand,
  SplitClipCommand,
  TrimClipCommand,
  MoveClipCommand,
  UpdateClipPropsCommand,
  UpdateTrackPropsCommand,
  UpdateProjectSettingsCommand,
  InsertEditCommand,
  OverwriteEditCommand,
  AddMarkerCommand,
  RemoveMarkerCommand,
  SetInOutPointsCommand,
  SlipClipCommand,
  SlideClipCommand,
  RippleTrimHeadCommand,
  RippleTrimTailCommand,
  SplitAudioVideoCommand,
  SetAudioFadeCommand,
  SetAudioKeyframeCommand,
  UpdateTranscriptCommand,
  GenerateCaptionsCommand,
  SetTransformCommand,
  SetColorCorrectionCommand,
  SetTransitionCommand,
  AddProjectNoteCommand,
  RemoveProjectNoteCommand,
  CreateEditDecisionCommand,
  UpdateEditDecisionStatusCommand,
  AddReviewCommentCommand,
  ResolveReviewCommentCommand,
  SetReviewStatusCommand,
  CreateProjectVersionCommand,
  RestoreProjectVersionCommand,
  SyncMulticamCommand,
  SwitchMulticamAngleCommand
} from './command/commandSystem';
import { mediaEngine } from './media/mediaEngine';
import { idbManager } from './storage/idb';
import { renderEngine } from './render/renderEngine';
import { exportEngine } from './export/exportEngine';
import { keyboardManager } from './input/keyboardManager';

export * from './types/project';
export * from './command/commandSystem';
export * from './storage/opfs';
export * from './storage/idb';
export * from './media/mediaEngine';
export * from './timeline/timelineEngine';
export * from './render/renderEngine';
export * from './export/exportEngine';
export * from './input/keyboardManager';
export * from './ai';

import { analysisEngine } from './ai/analysisEngine';
import { directorEngine } from './ai/directorEngine';
import { AnalysisType, AnalysisResultCollection, EditingInsight, DirectorPlan, EditComparison } from './ai/analysisTypes';

// Default initial project factory with canonical tracks
export function createInitialProject(title: string = 'Môj Nový Projekt'): ProjectModel {
  const tracks = [
    { id: 'track_adjustment', type: 'adjustment' as const, name: 'Efekty', order: 4, muted: false, locked: false, visible: true, clips: [] },
    { id: 'track_caption', type: 'caption' as const, name: 'Titulky', order: 3, muted: false, locked: false, visible: true, clips: [] },
    { id: 'track_broll', type: 'b-roll' as const, name: 'B-Roll & Overlays', order: 2, muted: false, locked: false, visible: true, clips: [] },
    { id: 'track_video', type: 'video' as const, name: 'Hlavné Video', order: 1, muted: false, locked: false, visible: true, clips: [] },
    { id: 'track_audio', type: 'audio' as const, name: 'Zvuk & Hudba', order: 0, muted: false, locked: false, visible: true, clips: [] }
  ];

  return {
    id: `proj_${crypto.randomUUID()}`,
    version: 3,
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    playheadTime: 0,
    settings: {
      aspectRatio: '16:9',
      width: 1920,
      height: 1080,
      fps: 30,
      backgroundColor: '#0a0a0c',
      sampleRate: 48000
    },
    assets: [],
    tracks,
    sequence: {
      id: `seq_${crypto.randomUUID()}`,
      name: 'Main Sequence',
      duration: 10,
      videoTracks: tracks.filter(t => (t.type as string) !== 'audio'),
      audioTracks: tracks.filter(t => t.type === 'audio')
    },
    markers: [],
    notes: [],
    editDecisions: [],
    reviewState: {
      status: 'draft',
      comments: [],
      lockedForExport: false
    },
    versions: [],
    exportPresets: [
      {
        id: 'preset_yt_1080p',
        name: 'YouTube Full HD (1080p)',
        format: 'mp4',
        resolution: { width: 1920, height: 1080 },
        fps: 30,
        bitrateKbps: 12000,
        codec: 'h264',
        presetType: 'youtube'
      },
      {
        id: 'preset_tiktok_916',
        name: 'TikTok / Shorts / Reels (9:16)',
        format: 'mp4',
        resolution: { width: 1080, height: 1920 },
        fps: 30,
        bitrateKbps: 8000,
        codec: 'h264',
        presetType: 'tiktok'
      },
      {
        id: 'preset_broadcast_prores',
        name: 'Broadcast Master (ProRes/High Bitrate)',
        format: 'mp4',
        resolution: { width: 1920, height: 1080 },
        fps: 30,
        bitrateKbps: 35000,
        codec: 'h264',
        presetType: 'broadcast'
      },
      {
        id: 'preset_audio_master',
        name: 'Audio Export (AAC/320kbps)',
        format: 'audio_only',
        resolution: { width: 0, height: 0 },
        fps: 0,
        bitrateKbps: 320,
        codec: 'aac',
        presetType: 'custom'
      }
    ],
    learningHistory: [],
    autosaveState: {
      status: 'saved',
      lastSavedAt: Date.now()
    }
  };
}

export class CoreEngine {
  private static instance: CoreEngine | null = null;
  public commandManager: CommandManager;
  private saveTimeout: any = null;

  private constructor() {
    this.commandManager = new CommandManager(createInitialProject());
  }

  public static getInstance(): CoreEngine {
    if (!CoreEngine.instance) {
      CoreEngine.instance = new CoreEngine();
    }
    return CoreEngine.instance;
  }

  public getProject(): ProjectModel {
    return this.commandManager.getProject();
  }

  public async loadProject(projectId: string): Promise<ProjectModel> {
    const loaded = await idbManager.getProject(projectId);
    if (loaded) {
      this.commandManager.setProject(loaded);
      return loaded;
    }
    const newProj = createInitialProject();
    await idbManager.saveProject(newProj);
    this.commandManager.setProject(newProj);
    return newProj;
  }

  public async saveCurrentProject(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(async () => {
      await idbManager.saveProject(this.getProject());
    }, 250);
  }

  // --- Core Commands Wrappers (Used by UI & AI Director alike) ---

  public async importMediaFile(file: File, targetTrackType: 'video' | 'b-roll' | 'audio' = 'video'): Promise<ClipModel> {
    const asset = await mediaEngine.registerMediaFile(file);
    const project = this.getProject();

    // Find or target track
    const targetTrack = project.tracks.find(t => t.type === targetTrackType) || project.tracks[0];

    // Find latest clip end time on track for placement
    let startTime = 0;
    for (const clip of targetTrack.clips) {
      const clipStart = clip.timelineStart ?? clip.start ?? 0;
      if (clipStart + clip.duration > startTime) {
        startTime = clipStart + clip.duration;
      }
    }

    const duration = asset.duration || 5;

    const newClip = createCanonicalClip({
      id: `clip_${crypto.randomUUID()}`,
      trackId: targetTrack.id,
      assetId: asset.id,
      type: asset.type === 'video' ? 'video' : asset.type === 'audio' ? 'audio' : 'image',
      name: asset.name,
      sourceStart: 0,
      sourceEnd: duration,
      timelineStart: startTime,
      duration,
      speed: 1.0,
      volume: 100,
      scale: 100,
      opacity: 100,
      positionX: 0,
      positionY: 0,
      rotation: 0,
      filter: 'NONE',
      keyframes: []
    });

    // Update assets list in project
    const updatedAssets = [...project.assets.filter(a => a.id !== asset.id), asset];
    this.commandManager.setProject({ ...project, assets: updatedAssets });

    // Execute Add Clip Command
    this.commandManager.executeCommand(new AddClipCommand(`Importované ${file.name}`, targetTrack.id, newClip));
    await this.saveCurrentProject();

    return newClip;
  }

  public addClip(trackId: string, clip: ClipModel, ripple: boolean = false): boolean {
    const success = this.commandManager.executeCommand(
      new AddClipCommand(`Pridaný klip ${clip.name}`, trackId, clip, ripple)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public splitSelectedClip(clipId: string, splitTime: number): boolean {
    const success = this.commandManager.executeCommand(
      new SplitClipCommand(`Rozdelený klip v čase ${splitTime.toFixed(2)}s`, clipId, splitTime)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public trimClip(clipId: string, edge: 'left' | 'right', deltaSeconds: number, ripple: boolean = false): boolean {
    const success = this.commandManager.executeCommand(
      new TrimClipCommand(`Orezaný klip (${edge === 'left' ? 'začiatok' : 'koniec'})`, clipId, edge, deltaSeconds, ripple)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public moveClip(clipId: string, newStart: number, newTrackId?: string): boolean {
    const success = this.commandManager.executeCommand(
      new MoveClipCommand(`Presunutý klip na ${newStart.toFixed(2)}s`, clipId, newStart, newTrackId)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public removeClip(clipId: string, ripple: boolean = false): boolean {
    const success = this.commandManager.executeCommand(
      new RemoveClipCommand(`Odstránený klip`, clipId, ripple)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public updateClipProps(clipId: string, props: Partial<ClipModel>): boolean {
    const success = this.commandManager.executeCommand(
      new UpdateClipPropsCommand(`Úprava vlastností klipu`, clipId, props)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public updateTrackProps(trackId: string, props: Partial<TrackModel>): boolean {
    const success = this.commandManager.executeCommand(
      new UpdateTrackPropsCommand(`Úprava stopy`, trackId, props)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public updateProjectSettings(settings: Partial<ProjectSettings>): boolean {
    const success = this.commandManager.executeCommand(
      new UpdateProjectSettingsCommand(`Zmena nastavení projektu`, settings)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public insertEdit(targetTrackId: string, clip: ClipModel, atTime: number): boolean {
    const success = this.commandManager.executeCommand(
      new InsertEditCommand(`Insert Edit (${clip.name})`, targetTrackId, clip, atTime)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public overwriteEdit(targetTrackId: string, clip: ClipModel, atTime: number): boolean {
    const success = this.commandManager.executeCommand(
      new OverwriteEditCommand(`Overwrite Edit (${clip.name})`, targetTrackId, clip, atTime)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public addMarker(marker: MarkerModel): boolean {
    const success = this.commandManager.executeCommand(
      new AddMarkerCommand(`Pridaný marker: ${marker.label}`, marker)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public removeMarker(markerId: string): boolean {
    const success = this.commandManager.executeCommand(
      new RemoveMarkerCommand(`Odstránený marker`, markerId)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public setInOutPoints(inPoint: number | null, outPoint: number | null): boolean {
    const success = this.commandManager.executeCommand(
      new SetInOutPointsCommand(`Nastavenie In/Out bodov`, inPoint, outPoint)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public slipClip(clipId: string, deltaSeconds: number, maxSourceDuration?: number): boolean {
    const success = this.commandManager.executeCommand(
      new SlipClipCommand(`Slip Edit (${deltaSeconds > 0 ? '+' : ''}${deltaSeconds.toFixed(2)}s)`, clipId, deltaSeconds, maxSourceDuration)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public slideClip(clipId: string, deltaSeconds: number): boolean {
    const success = this.commandManager.executeCommand(
      new SlideClipCommand(`Slide Edit (${deltaSeconds > 0 ? '+' : ''}${deltaSeconds.toFixed(2)}s)`, clipId, deltaSeconds)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public rippleTrimHead(clipId: string, playheadTime: number): boolean {
    const success = this.commandManager.executeCommand(
      new RippleTrimHeadCommand(`Ripple Trim Head k playheadu (${playheadTime.toFixed(2)}s)`, clipId, playheadTime)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public rippleTrimTail(clipId: string, playheadTime: number): boolean {
    const success = this.commandManager.executeCommand(
      new RippleTrimTailCommand(`Ripple Trim Tail k playheadu (${playheadTime.toFixed(2)}s)`, clipId, playheadTime)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public splitAudioVideo(clipId: string, targetAudioTrackId: string): boolean {
    const success = this.commandManager.executeCommand(
      new SplitAudioVideoCommand(`Rozdelenie Audia a Videa do samostatných stôp`, clipId, targetAudioTrackId)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public setAudioFade(clipId: string, fadeIn?: number, fadeOut?: number): boolean {
    const success = this.commandManager.executeCommand(
      new SetAudioFadeCommand(`Nastavenie audio fade`, clipId, fadeIn, fadeOut)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public setAudioKeyframe(clipId: string, keyframe: Keyframe): boolean {
    const success = this.commandManager.executeCommand(
      new SetAudioKeyframeCommand(`Pridanie/úprava audio keyframe`, clipId, keyframe)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public updateTranscript(transcript: TranscriptModel): boolean {
    const success = this.commandManager.executeCommand(
      new UpdateTranscriptCommand(`Aktualizácia transkriptu`, transcript)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public generateCaptions(transcript: TranscriptModel, targetCaptionTrackId: string, styleConfig?: Partial<CaptionStyleConfig>): boolean {
    const success = this.commandManager.executeCommand(
      new GenerateCaptionsCommand(`Generovanie titulkov z transkriptu`, transcript, targetCaptionTrackId, styleConfig)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  /**
   * Vráti poslednú zmenu cez existujúci `CommandManager.undo()`.
   *
   * Používa to Apply Style Studia: keď sa zmena vykonala, ale nepodarilo sa zapísať
   * rozhodnutie, zmena sa vráti — v projekte tak neostane zmena bez záznamu.
   */
  public undoLastCommand(): boolean {
    return this.undo();
  }

  public setTransform(clipId: string, transformProps: { scale?: number; scaleX?: number; scaleY?: number; positionX?: number; positionY?: number; rotation?: number; opacity?: number; anchorX?: number; anchorY?: number }): boolean {
    const success = this.commandManager.executeCommand(
      new SetTransformCommand(`Úprava transformácie clipu`, clipId, transformProps)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public setColorCorrection(clipId: string, colorCorrection: ColorCorrectionConfig): boolean {
    const success = this.commandManager.executeCommand(
      new SetColorCorrectionCommand(`Úprava farieb clipu`, clipId, colorCorrection)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public setTransition(clipId: string, edge: 'in' | 'out', transition: TransitionConfig): boolean {
    const success = this.commandManager.executeCommand(
      new SetTransitionCommand(`Nastavenie prechodu clipu`, clipId, edge, transition)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public addProjectNote(note: any): boolean {
    const success = this.commandManager.executeCommand(
      new AddProjectNoteCommand(`Pridanie poznámky do projektu`, note)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public removeProjectNote(noteId: string): boolean {
    const success = this.commandManager.executeCommand(
      new RemoveProjectNoteCommand(`Odstránenie poznámky`, noteId)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public createEditDecision(decision: any): boolean {
    const success = this.commandManager.executeCommand(
      new CreateEditDecisionCommand(`Vytvorenie AI strihového rozhodnutia`, decision)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public updateEditDecisionStatus(decisionId: string, status: 'proposed' | 'accepted' | 'rejected' | 'applied'): boolean {
    const success = this.commandManager.executeCommand(
      new UpdateEditDecisionStatusCommand(`Zmena stavu rozhodnutia: ${status}`, decisionId, status)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public addReviewComment(comment: any): boolean {
    const success = this.commandManager.executeCommand(
      new AddReviewCommentCommand(`Pridanie pripomienky do review`, comment)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public resolveReviewComment(commentId: string, status: 'open' | 'resolved' = 'resolved'): boolean {
    const success = this.commandManager.executeCommand(
      new ResolveReviewCommentCommand(`Vyriešenie pripomienky`, commentId, status)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public setReviewStatus(status: 'draft' | 'in_review' | 'changes_requested' | 'approved', lockedForExport: boolean = false): boolean {
    const success = this.commandManager.executeCommand(
      new SetReviewStatusCommand(`Zmena stavu schválenia: ${status}`, status, lockedForExport)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public createProjectVersion(label: string, description: string): boolean {
    const success = this.commandManager.executeCommand(
      new CreateProjectVersionCommand(`Vytvorenie verzie: ${label}`, label, description)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public restoreProjectVersion(versionId: string): boolean {
    const success = this.commandManager.executeCommand(
      new RestoreProjectVersionCommand(`Obnovenie verzie z histórie`, versionId)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public syncMulticam(clipIds: string[], groupName: string, syncMethod: 'waveform' | 'timecode' | 'manual' = 'manual'): boolean {
    const success = this.commandManager.executeCommand(
      new SyncMulticamCommand(`Vytvorený Multicam Group: ${groupName}`, clipIds, groupName, syncMethod)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public switchMulticamAngle(clipId: string, targetAngleId: string, switchTime: number): boolean {
    const success = this.commandManager.executeCommand(
      new SwitchMulticamAngleCommand(`Prestrihnutie na uhol: ${targetAngleId}`, clipId, targetAngleId, switchTime)
    );
    if (success) this.saveCurrentProject();
    return success;
  }

  public async runProjectAnalysis(
    types: AnalysisType[] = ['metadata', 'transcript', 'audio', 'silence', 'shots', 'scenes', 'content', 'editing'],
    assetId?: string,
    onProgress?: (progress: number) => void
  ): Promise<AnalysisResultCollection> {
    const currentProj = this.getProject();
    const results = await analysisEngine.runAnalysis(currentProj, types, assetId, (prog) => {
      if (onProgress) onProgress(prog);
    });

    // Attach results to current project in memory
    const updatedProject: ProjectModel = {
      ...currentProj,
      analysisResults: results
    };
    this.commandManager.setProject(updatedProject);
    this.saveCurrentProject();

    return results;
  }

  public cancelAnalysisJob(jobId: string): void {
    analysisEngine.cancelJob(jobId);
  }

  public convertInsightToEditDecision(insight: EditingInsight): boolean {
    const decision = analysisEngine.convertInsightToEditDecision(insight);
    return this.createEditDecision(decision);
  }

  public generateDirectorPlan(
    targetPlatform: 'TikTok' | 'Instagram Reels' | 'YouTube Shorts' | 'YouTube Long-form' | 'UGC Ads' | 'General' = 'TikTok',
    objectives: any[] = ['Retention', 'Education']
  ): DirectorPlan {
    const currentProj = this.getProject();
    const plan = directorEngine.generateDirectorPlan(currentProj, targetPlatform, objectives);
    
    // Store generated plan on project
    const updatedProject: ProjectModel = {
      ...currentProj,
      directorPlan: plan
    };
    this.commandManager.setProject(updatedProject);
    this.saveCurrentProject();

    return plan;
  }

  public safeBatchApplyDirectorPlan(plan: DirectorPlan, acceptedDecisionIds: string[]): { success: boolean; appliedCount: number; snapshotVersionId?: string; error?: string } {
    const result = directorEngine.safeBatchApply(this.commandManager, plan, acceptedDecisionIds);
    if (result.success) {
      this.saveCurrentProject();
    }
    return result;
  }

  public compareUserAndAiEdits(plan?: DirectorPlan): EditComparison[] {
    const currentProj = this.getProject();
    const activePlan = plan || currentProj.directorPlan || directorEngine.generateDirectorPlan(currentProj);
    return directorEngine.compareUserAndAiEdits(currentProj, activePlan);
  }

  public undo(): boolean {
    const res = this.commandManager.undo();
    if (res) this.saveCurrentProject();
    return res;
  }

  public redo(): boolean {
    const res = this.commandManager.redo();
    if (res) this.saveCurrentProject();
    return res;
  }
}

export const coreEngine = CoreEngine.getInstance();

// --- REACT HOOK FOR REACTIVE STATE SUBSCRIPTION (Only updates when timeline edits occur) ---

export function useCoreProject(): {
  project: ProjectModel;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
} {
  const [project, setProject] = useState<ProjectModel>(() => coreEngine.getProject());
  const [canUndo, setCanUndo] = useState<boolean>(() => coreEngine.commandManager.canUndo());
  const [canRedo, setCanRedo] = useState<boolean>(() => coreEngine.commandManager.canRedo());

  useEffect(() => {
    const unsubscribe = coreEngine.commandManager.subscribe((updatedProject) => {
      setProject(updatedProject);
      setCanUndo(coreEngine.commandManager.canUndo());
      setCanRedo(coreEngine.commandManager.canRedo());
    });
    return unsubscribe;
  }, []);

  return {
    project,
    canUndo,
    canRedo,
    undo: () => coreEngine.undo(),
    redo: () => coreEngine.redo()
  };
}

/**
 * Core Engine Central Orchestrator & React Hooks
 * Connects Storage, Media, Command System, Timeline, Render, and Export Engines.
 */

import { useState, useEffect } from 'react';
import { ProjectModel, ClipModel, TrackModel, MediaAsset, ProjectSettings, MarkerModel, Keyframe, TranscriptModel, CaptionStyleConfig, ColorCorrectionConfig, TransitionConfig, ProjectAudioMastering, createCanonicalClip } from './types/project';
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
  SwitchMulticamAngleCommand, RollClipCommand} from './command/commandSystem';
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
import type { SubjectSample } from './vision/subjectTrack';
import { directorEngine } from './ai/directorEngine';
import { ShortsEngineResult, buildShortsProposals } from './ai/shortsEngine';
import { editingBrain } from './ai/editingBrain';
import { AnalysisType, AnalysisResultCollection, EditingInsight, DirectorPlan, DirectorDecisionItem, EditComparison, DirectorProposedAction } from './ai/analysisTypes';
import { REVIEW_KIND_MAP, ReviewQueueItem, LearnedRule, buildReviewQueue, buildLearnedRules, isActionExecutable } from './ai/reviewQueue';
import { DirectorMode, DirectorQuality, ReadinessSummary, buildReadinessSummary, DIRECTOR_MODES } from './ai/directorModes';
import { QualityCheckReport, runQualityCheck } from './ai/qualityCheck';
import type { EditingPreference } from './types/project';

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

  /**
   * Loads a project and makes it current. When nothing is stored under `projectId`, a new empty
   * project is created **with that exact id** (and saved under it) — otherwise the caller's link
   * would point at an id that never exists in storage.
   */
  public async loadProject(projectId: string): Promise<ProjectModel> {
    const loaded = await idbManager.getProject(projectId);
    if (loaded) {
      this.commandManager.setProject(loaded);
      return loaded;
    }
    const newProj: ProjectModel = { ...createInitialProject(), id: projectId };
    await idbManager.saveProject(newProj);
    this.commandManager.setProject(newProj);
    console.log(`[CoreEngine] Žiadny uložený projekt pre "${projectId}" — vytvorený nový prázdny projekt s týmto ID.`);
    return newProj;
  }

  /**
   * Opens a STORED project without creating anything. Returns null when the id is unknown, so the
   * UI can decide what to do instead of silently replacing the open timeline with an empty one.
   */
  public async openStoredProject(projectId: string): Promise<ProjectModel | null> {
    const stored = await idbManager.getProject(projectId);
    if (!stored) return null;
    this.commandManager.setProject(stored);
    return stored;
  }

  /**
   * Renames the current in-memory project to a concrete id and saves it.
   *
   * Used when a UI project has no stored canonical project yet: adopting the id keeps the open
   * timeline AND makes the first save land under the linked id, so the project is reopened next time.
   */
  public adoptProjectId(projectId: string, title?: string): ProjectModel {
    const current = this.getProject();
    const adopted: ProjectModel = {
      ...current,
      id: projectId,
      title: title || current.title,
      updatedAt: Date.now(),
    };
    this.commandManager.setProject(adopted);
    void this.saveCurrentProject();
    return adopted;
  }

  /** Creates a brand-new empty canonical project with a specific id (explicit user action). */
  public startFreshProject(projectId: string, title?: string): ProjectModel {
    const fresh: ProjectModel = { ...createInitialProject(title), id: projectId };
    this.commandManager.setProject(fresh);
    void this.saveCurrentProject();
    return fresh;
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

  /**
   * Roll edit: moves the cut point between two adjacent clips by `deltaSeconds` (signed).
   * Returns false when the roll is not possible (clips not adjacent / no source material).
   */
  public rollClip(clipId: string, edge: 'in' | 'out', deltaSeconds: number): boolean {
    const success = this.commandManager.executeCommand(
      new RollClipCommand(`Roll strih o ${deltaSeconds.toFixed(2)}s`, clipId, edge, deltaSeconds)
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

    if (success && (status === 'accepted' || status === 'rejected')) {
      // Learn from the real user decision: this is what fills the Editing Brain.
      const project = this.getProject();
      const decision = (project.editDecisions || []).find(d => d.id === decisionId);
      const category = decision ? CoreEngine.preferenceCategoryForDecisionType(decision.type) : null;
      if (category) {
        this.observePreference(
          status === 'accepted' ? 'ACCEPTED' : 'REJECTED',
          category,
          `AI návrh (${decision?.type}) ${status === 'accepted' ? 'prijatý' : 'zamietnutý'}`
        );
      }
    }

    if (success) this.saveCurrentProject();
    return success;
  }

  /** Maps a canonical edit decision type to an Editing Brain preference category. */
  private static preferenceCategoryForDecisionType(type: string): EditingPreference['category'] | null {
    switch (type) {
      case 'cut': return 'CUTTING';
      case 'b_roll': return 'BROLL';
      case 'audio_duck': return 'AUDIO';
      case 'transition': return 'TRANSITIONS';
      case 'pacing': return 'PACING';
      case 'color': return 'COLOR';
      default: return null;
    }
  }

  /**
   * Writes an observation into the canonical project's Editing Brain preferences.
   * Kept separate from the Command System on purpose: learned preferences are evidence about
   * the user, not an editorial change, so they must not appear in undo/redo history.
   */
  private observePreference(
    action: 'ACCEPTED' | 'MODIFIED' | 'REJECTED' | 'MANUAL',
    category: EditingPreference['category'],
    detail?: string
  ): void {
    const project = this.getProject();
    const preferences = editingBrain.observeAction(project, action, category, 'PROJECT', detail);
    this.commandManager.setProject({ ...project, editingPreferences: preferences });
    this.saveCurrentProject();
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

  public syncMulticam(
    clipIds: string[],
    groupName: string,
    syncMethod: 'waveform' | 'timecode' | 'manual' = 'manual',
    angleOffsets: Record<string, number> = {},
    syncVerified: boolean = false
  ): boolean {
    const success = this.commandManager.executeCommand(
      new SyncMulticamCommand(`Vytvorený Multicam Group: ${groupName}`, clipIds, groupName, syncMethod, angleOffsets, syncVerified)
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

  /**
   * Stores the project-level audio mastering targets (loudness target, true-peak ceiling).
   * These are measurement targets, not editorial edits, so they are written without an undo entry.
   */
  public setAudioMastering(mastering: Partial<ProjectAudioMastering>): boolean {
    if (!mastering || typeof mastering.loudnessTargetLUFS !== 'number') return false;
    const project = this.getProject();
    this.commandManager.setProject({
      ...project,
      audioMastering: {
        ...(project.audioMastering || {}),
        ...mastering,
        updatedAt: Date.now(),
      } as ProjectAudioMastering,
    });
    this.saveCurrentProject();
    return true;
  }

  public getAudioMastering(): ProjectAudioMastering | undefined {
    return this.getProject().audioMastering;
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

  /**
   * Stores MEASURED subject positions (real face detection, see core/vision/subjectTrack.ts) on
   * the canonical project so the renderer can keep the speaker in frame during a COVER reframe.
   *
   * Nothing is invented here: an empty array clears the track and the reframe goes back to centred.
   * Returns how many samples are stored afterwards.
   */
  public recordSubjectTrack(samples: SubjectSample[], options: { replace?: boolean } = {}): number {
    const currentProj = this.getProject();
    const existing = currentProj.analysisResults?.subjectTrack ?? [];
    const replace = options.replace ?? true;

    let merged: SubjectSample[];
    if (replace) {
      merged = samples.slice();
    } else {
      const byTime = new Map<number, SubjectSample>();
      for (const sample of [...existing, ...samples]) byTime.set(sample.time, sample);
      merged = [...byTime.values()].sort((a, b) => a.time - b.time);
    }

    const analysis = currentProj.analysisResults ?? {
      projectId: currentProj.id,
      timestamp: Date.now(),
    };

    this.commandManager.setProject({
      ...currentProj,
      analysisResults: { ...analysis, projectId: analysis.projectId || currentProj.id, subjectTrack: merged },
    });
    this.saveCurrentProject();
    return merged.length;
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
    objectives: any[] = ['Retention', 'Education'],
    mode?: DirectorMode,
    quality?: DirectorQuality
  ): DirectorPlan {
    const currentProj = this.getProject();
    const plan = directorEngine.generateDirectorPlan(currentProj, targetPlatform, objectives, { mode, quality });
    
    // Store generated plan on project
    const updatedProject: ProjectModel = {
      ...currentProj,
      directorPlan: plan
    };
    this.commandManager.setProject(updatedProject);
    this.saveCurrentProject();

    return plan;
  }

  public safeBatchApplyDirectorPlan(
    plan: DirectorPlan,
    acceptedDecisionIds: string[]
  ): { success: boolean; appliedCount: number; skippedCount: number; skipped: { id: string; reason: string }[]; snapshotVersionId?: string; error?: string } {
    const result = directorEngine.safeBatchApply(this.commandManager, plan, acceptedDecisionIds);

    if (result.success && result.appliedCount > 0) {
      // Learn from what the user really did with this plan: accepted decisions are evidence of
      // agreement, the decisions left out of the batch are evidence of rejection.
      this.observePlanDecisions(plan, acceptedDecisionIds);
      this.saveCurrentProject();
    }
    return result;
  }

  /**
   * Applies a batch of Director decisions that were produced OUTSIDE the stored Director plan
   * (e.g. the visual storyboard) through the canonical Command System.
   *
   * The decisions are wrapped in a transient plan (never stored on the project, so the user's real
   * Director plan is not overwritten), validated and applied with a snapshot. Only the decisions
   * that were really applied are learned as accepted — decisions the engine cannot execute are
   * reported back to the caller instead of being counted as agreement.
   */
  public applyDirectorDecisions(
    decisions: DirectorDecisionItem[],
    title = 'AI vizuálny plán'
  ): { success: boolean; appliedCount: number; skippedCount: number; skipped: { id: string; reason: string }[]; snapshotVersionId?: string; error?: string } {
    const project = this.getProject();
    if (decisions.length === 0) {
      return { success: false, appliedCount: 0, skippedCount: 0, skipped: [], error: 'Plán neobsahuje žiadne rozhodnutia.' };
    }

    const plan: DirectorPlan = {
      id: `plan_transient_${crypto.randomUUID()}`,
      projectId: project.id,
      title,
      targetPlatform: 'General',
      targetFormat: '9:16',
      objectives: [],
      audience: '—',
      contentSummary: `${title}: ${decisions.length} rozhodnutí z vizuálneho plánu.`,
      strategies: {},
      decisions,
      analysisReferences: project.analysisResults ? [project.analysisResults.projectId] : [],
      insightReferences: [],
      knowledgeReferences: [],
      confidence: decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length,
      unresolvedAmbiguities: [],
      createdAt: Date.now(),
      analysisVersion: 2,
      directorVersion: 1,
    };

    const result = directorEngine.safeBatchApply(this.commandManager, plan, decisions.map(d => d.id));

    if (result.success && result.appliedCount > 0) {
      const skippedIds = new Set(result.skipped.map(sk => sk.id));
      const appliedIds = decisions.map(d => d.id).filter(id => !skippedIds.has(id));
      const appliedPlan: DirectorPlan = { ...plan, decisions: decisions.filter(d => appliedIds.includes(d.id)) };
      this.observePlanDecisions(appliedPlan, appliedIds);
      this.saveCurrentProject();
    }

    return result;
  }

  private observePlanDecisions(plan: DirectorPlan, acceptedDecisionIds: string[]): void {
    const accepted = new Set(acceptedDecisionIds);
    const perCategory = new Map<EditingPreference['category'], { accepted: number; rejected: number }>();

    for (const decision of plan.decisions) {
      const kind = (decision.proposedAction as DirectorProposedAction | undefined)?.kind;
      const category = kind ? CoreEngine.preferenceCategoryForProposedAction(kind) : null;
      if (!category || !decision.proposedAction) continue;

      // A decision the user already decided on (e.g. taken over with „Skúsim sama") is NOT
      // re-counted in this batch: one user action must produce exactly one observation.
      if (decision.status !== 'proposed' && decision.status !== 'needs-review') continue;

      const entry = perCategory.get(category) || { accepted: 0, rejected: 0 };
      if (accepted.has(decision.id)) entry.accepted++;
      else entry.rejected++;
      perCategory.set(category, entry);
    }

    perCategory.forEach((counts, category) => {
      // Net outcome per category is what the Director should learn from.
      if (counts.accepted > 0 && counts.accepted >= counts.rejected) {
        this.observePreference('ACCEPTED', category, `AI plán: ${counts.accepted}/${counts.accepted + counts.rejected} návrhov prijatých`);
      }
      if (counts.rejected > 0 && counts.rejected > counts.accepted) {
        this.observePreference('REJECTED', category, `AI plán: ${counts.rejected}/${counts.accepted + counts.rejected} návrhov zamietnutých`);
      }
    });
  }

  /** Maps a Director proposed action kind to an Editing Brain preference category. */
  private static preferenceCategoryForProposedAction(kind: DirectorProposedAction['kind']): EditingPreference['category'] | null {
    // Single source of truth: see core/ai/reviewQueue.ts (REVIEW_KIND_MAP).
    return REVIEW_KIND_MAP[kind]?.preference ?? null;
  }

  // --- SMART REVIEW QUEUE (OS Hub) ---

  /** Real review queue built from the project's AI Director plan. Empty when there is no plan. */
  public listReviewQueue(): ReviewQueueItem[] {
    return buildReviewQueue(this.getProject());
  }

  /** Learned Editing Brain rules of the canonical project (empty until something was observed). */
  public listLearnedRules(): LearnedRule[] {
    return buildLearnedRules(this.getProject());
  }

  /** Enables/disables one learned rule. A disabled rule is ignored by the Director. */
  public setPreferenceEnabled(preferenceId: string, enabled: boolean): boolean {
    const project = this.getProject();
    const preferences = project.editingPreferences || [];
    if (!preferences.some(p => p.id === preferenceId)) return false;

    this.commandManager.setProject({
      ...project,
      editingPreferences: preferences.map(p => (p.id === preferenceId ? { ...p, enabled, updatedAt: Date.now() } : p)),
      updatedAt: Date.now(),
    });
    void this.saveCurrentProject();
    return true;
  }

  /** Stores the review outcome on the plan decision itself (the review trail). */
  private setPlanDecisionStatus(decisionId: string, status: DirectorDecisionItem['status']): boolean {
    const project = this.getProject();
    const plan = project.directorPlan;
    if (!plan) return false;

    let found = false;
    const decisions = plan.decisions.map(decision => {
      if (decision.id !== decisionId) return decision;
      found = true;
      return { ...decision, status };
    });
    if (!found) return false;

    this.commandManager.setProject({
      ...project,
      directorPlan: { ...plan, decisions },
      updatedAt: Date.now(),
    });
    void this.saveCurrentProject();
    return true;
  }

  /**
   * Accept or reject one item of the Smart Review Queue.
   *
   * ACCEPT: when the proposed action is executable it is applied through the canonical Command
   * System (undoable, with a version snapshot) — otherwise the decision is only recorded, and the
   * caller is told that the change stays manual. REJECT: nothing is touched.
   *
   * Both outcomes are single observations of the Editing Brain, so the Director learns from the
   * review queue exactly like it does from a batch apply.
   */
  public decideOnReviewItem(
    decisionId: string,
    status: 'ACCEPTED' | 'REJECTED'
  ): { ok: boolean; applied: boolean; reason: string } {
    const plan = this.getProject().directorPlan;
    const decision = plan?.decisions.find(d => d.id === decisionId);
    if (!plan || !decision) {
      return { ok: false, applied: false, reason: 'Rozhodnutie sa v uloženom AI pláne nenašlo.' };
    }

    const kind = decision.proposedAction?.kind;
    let applied = false;
    let reason = status === 'REJECTED' ? 'Zamietnuté — materiál zostal nezmenený.' : '';

    if (status === 'ACCEPTED') {
      if (!kind) {
        return { ok: false, applied: false, reason: 'Rozhodnutie nemá štruktúrovanú akciu, nedá sa vykonať.' };
      }
      if (!isActionExecutable(kind)) {
        reason = 'Odporúčanie nie je automaticky vykonateľné — uložené ako schválený manuálny krok.';
      } else {
        const result = directorEngine.safeBatchApply(this.commandManager, plan, [decisionId]);
        if (result.success && result.appliedCount > 0) {
          applied = true;
          reason = 'Zmena bola aplikovaná do projektu (dá sa vrátiť cez Undo).';
        } else {
          const skipReason = result.skipped?.[0]?.reason || result.error || 'Neznámy dôvod.';
          this.setPlanDecisionStatus(decisionId, decision.status);
          return { ok: false, applied: false, reason: `Nepodarilo sa aplikovať: ${skipReason}` };
        }
      }
    }

    this.setPlanDecisionStatus(decisionId, status === 'ACCEPTED' ? 'accepted' : 'rejected');

    // One real observation per reviewed item (never a fabricated pattern match).
    const category = kind ? CoreEngine.preferenceCategoryForProposedAction(kind) : null;
    if (category) {
      this.observePreference(
        status,
        category,
        `Review front: návrh ${kind} ${status === 'ACCEPTED' ? 'prijatý' : 'zamietnutý'}`
      );
    }

    return { ok: true, applied, reason };
  }

  /**
   * RAW → READY summary of the current plan: measured counts from the project/plan plus one
   * clearly-labelled time estimate (the formula travels with the number).
   */
  public getReadinessSummary(plan?: DirectorPlan): ReadinessSummary {
    const project = this.getProject();
    return buildReadinessSummary(project, plan || project.directorPlan);
  }

  /**
   * Long-form → Shorts: proposals built from measured hooks and the real end of the material.
   * Empty when nothing was measured — the UI states that instead of inventing moments.
   */
  public getShortsProposals(options?: { maxHooks?: number; windows?: number[] }): ShortsEngineResult {
    return buildShortsProposals(this.getProject(), options);
  }

  /**
   * Quality Check pred finálom — measured checks over the canonical project with an honest list of
   * what could NOT be measured in this run (see core/ai/qualityCheck.ts).
   */
  public runQualityCheck(): QualityCheckReport {
    return runQualityCheck(this.getProject());
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

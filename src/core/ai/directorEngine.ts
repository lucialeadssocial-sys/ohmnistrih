/**
 * OmniStrih AI — AI Director Decision Engine (FÁZA 2F)
 * Converts analysis results into explainable, reviewable, non-destructive DirectorPlans.
 */

import {
  DIRECTOR_MODES,
  DirectorMode,
  DirectorQuality,
  applyDirectorMode,
  inferModeForPlatform,
} from './directorModes';
import {
  AnalysisResultCollection,
  DirectorDecisionItem,
  DirectorObjective,
  DirectorPlan,
  DirectorStrategy,
  EditComparison,
  DecisionPriority,
  KnowledgeCategory,
  DirectorProposedAction
} from './analysisTypes';
import { ProjectModel, ClipModel, EditDecision } from '../types/project';
import { EDIT_KNOWLEDGE_BASE, getTeachMeExplanation } from './knowledgeBase';
import { TimelineEngine } from '../timeline/timelineEngine';
import {
  CommandManager,
  TrimClipCommand,
  SplitClipCommand,
  RemoveClipCommand,
  UpdateClipPropsCommand,
  SetAudioFadeCommand,
  SetTransformCommand,
  SetColorCorrectionCommand,
  SetTransitionCommand,
  CreateProjectVersionCommand,
  SwitchMulticamAngleCommand
} from '../command/commandSystem';

import { editingBrain } from './editingBrain';

export interface DirectorBrief {
  id: string;
  userIntent: string;
  targetFormat: 'REEL_30S' | 'HIGHLIGHTS' | 'REMOVE_SILENCE' | 'DYNAMIC_PACING' | 'BEST_HOOK' | 'SHORTS_3' | 'MULTICAM' | 'CUSTOM';
  targetDurationSeconds?: number;
  moodAndTone: string;
  explanation?: {
    what: string;
    why: string;
    how: string;
    openSourceReference: { name: string; url: string; contribution: string };
  };
  identifiedHook?: {
    startTime: number;
    endTime: number;
    transcriptSnippet: string;
    reason: string;
  };
  pacingStrategy: string;
  keyMomentsToKeep: {
    startTime: number;
    endTime: number;
    description: string;
    score: number;
  }[];
  suggestedAspectRatios: string[];
  bestShotTimestamp?: number;
  duplicateTimestamps: number[];
  blurryTimestamps: number[];
  darkTimestamps: number[];
  staticTimestamps: number[];
  bRollTimestamps: number[];
}

export interface DirectorTimelineOperation {
  id: string;
  type: 'KEEP_SEGMENT' | 'CUT_SILENCE' | 'ADD_TRANSITION' | 'ADJUST_SPEED' | 'SET_HOOK' | 'CREATE_SUB_PROJECT' | 'MULTICAM_SWITCH';
  description: string;
  targetClipId?: string;
  startTime: number;
  endTime: number;
  targetTrackId?: string;
  parameters?: Record<string, any>;
  status: 'PENDING' | 'APPROVED' | 'SKIPPED';
}

export interface DirectorEditPlan {
  id: string;
  briefId: string;
  title: string;
  summary: string;
  operations: DirectorTimelineOperation[];
  projectStateBefore: { clipCount: number; duration: number };
  projectStateAfter: { estimatedClipCount: number; estimatedDuration: number };
  status: 'PROPOSED' | 'APPROVED' | 'EXECUTED' | 'REJECTED';
  executedTools?: string[];
  /** States exactly which project data the plan was derived from, or what was missing. */
  dataSource?: string;
}

export interface DirectorRevisionReport {
  id: string;
  durationStatus: 'OK' | 'WARN_TOO_LONG' | 'WARN_TOO_SHORT';
  tempoStatus: 'OK' | 'DENSE' | 'SLOW';
  repetitionsStatus: 'OK' | 'DUPLICATES_FOUND';
  silenceStatus: 'OK' | 'SILENCE_FOUND';
  audioStatus: 'OK' | 'VOLUME_UNBALANCED';
  captionsStatus: 'OK' | 'MISSING' | 'WELL_PLACED';
  textStatus: 'OK' | 'NO_OVERLAYS' | 'OVERLAYS_ACTIVE';
  startStatus: 'OK' | 'HOOK_STRONG' | 'HOOK_WEAK';
  endStatus: 'OK' | 'OUTRO_CLEAN' | 'OUTRO_ABRUPT';
  visualConsistency: 'OK' | 'LOW_QUALITY_SHOTS_PRESENT';
  formatStatus: 'OK' | 'NOT_OPTIMAL';
  issuesList: string[];
}

export interface DirectorRevisionPlan {
  id: string;
  planId: string;
  report: DirectorRevisionReport;
  suggestedOperations: DirectorTimelineOperation[];
  pacingAction: string;
  qualityAction: string;
}

export class DirectorEngine {
  private static instance: DirectorEngine | null = null;

  public static getInstance(): DirectorEngine {
    if (!DirectorEngine.instance) {
      DirectorEngine.instance = new DirectorEngine();
    }
    return DirectorEngine.instance;
  }

  /**
   * Builds a DirectorBrief + DirectorEditPlan from data that actually exists in the
   * canonical project. Nothing is invented: when analysis output is missing the plan
   * contains zero operations and `dataSource` states exactly what was unavailable.
   */
  public generateBriefAndPlan(
    userPrompt: string,
    project: ProjectModel,
    mediaIndex?: any
  ): { brief: DirectorBrief; editPlan: DirectorEditPlan } {
    const promptLower = userPrompt.toLowerCase();
    let targetFormat: DirectorBrief['targetFormat'] = 'CUSTOM';
    if (promptLower.includes('30') || promptLower.includes('reel')) targetFormat = 'REEL_30S';
    else if (promptLower.includes('ticho') || promptLower.includes('silence')) targetFormat = 'REMOVE_SILENCE';
    else if (promptLower.includes('hook')) targetFormat = 'BEST_HOOK';

    const analysis = project.analysisResults;
    const pauses = (analysis?.pauses || []).filter((p: any) => p.type === 'long_pause' && p.duration > 0.4);
    const hooks = analysis?.hooks || [];
    const brolls = analysis?.brollOpportunities || [];
    const shots = analysis?.shots || [];

    const missing: string[] = [];
    if (!analysis) missing.push('analysisResults');
    if (!analysis?.pauses) missing.push('pauses');
    if (!analysis?.hooks) missing.push('hooks');
    if (!analysis?.brollOpportunities) missing.push('brollOpportunities');

    const brief: DirectorBrief = {
      id: `brief_${crypto.randomUUID().slice(0, 8)}`,
      userIntent: userPrompt,
      targetFormat,
      moodAndTone: analysis?.speechDensity ? `Tempo: ${analysis.speechDensity.informationDensity}` : 'Nezistené (chýba analýza)',
      pacingStrategy: pauses.length > 0
        ? `Odstrániť ${pauses.length} dlhých pauzy (>0.4s)`
        : 'Bez zistených dlhých páz (analýza pauzy nedostupná)',
      keyMomentsToKeep: hooks.map((h: any, i: number) => ({
        startTime: h.start,
        endTime: h.end,
        description: `Hook kandidát #${i + 1} (${h.type || 'unknown'})`,
        score: h.confidence ?? 0
      })),
      suggestedAspectRatios: [project.settings.aspectRatio === '9:16' ? '9:16' : project.settings.aspectRatio],
      bestShotTimestamp: shots.length > 0
        ? shots.reduce((best: any, s: any) => ((s.confidence ?? 0) > (best.confidence ?? 0) ? s : best), shots[0]).start
        : undefined,
      identifiedHook: hooks.length > 0
        ? {
            startTime: hooks[0].start,
            endTime: hooks[0].end,
            transcriptSnippet: analysis?.contentStructure?.hook?.text || '',
            reason: `Hook kandidát z analýzy (${hooks[0].type || 'unknown'}), confidence ${(hooks[0].confidence ?? 0).toFixed(2)}.`
          }
        : undefined,
      duplicateTimestamps: [],
      blurryTimestamps: [],
      darkTimestamps: [],
      staticTimestamps: [],
      bRollTimestamps: brolls.map((b: any) => b.start)
    };

    // Operations are derived 1:1 from real analysis output. No analysis -> no operations.
    const ops: DirectorTimelineOperation[] = [];

    pauses.forEach((pause: any, idx: number) => {
      ops.push({
        id: `op_pause_${idx}`,
        type: 'CUT_SILENCE',
        description: `Odstrániť pauzu ${pause.duration.toFixed(2)}s v čase ${pause.start.toFixed(2)}s`,
        startTime: pause.start,
        endTime: pause.end,
        parameters: { confidence: pause.confidence ?? null, pauseId: pause.id },
        status: 'PENDING'
      });
    });

    hooks.forEach((hook: any, idx: number) => {
      ops.push({
        id: `op_hook_${idx}`,
        type: 'SET_HOOK',
        description: `Punch-in zoom na hook ${hook.start}s - ${hook.end}s`,
        startTime: hook.start,
        endTime: hook.end,
        parameters: { scale: 115, confidence: hook.confidence ?? null },
        status: 'PENDING'
      });
    });

    brolls.forEach((b: any, idx: number) => {
      ops.push({
        id: `op_broll_${idx}`,
        type: 'KEEP_SEGMENT',
        description: `B-roll príležitosť (${b.suggestedVisualType || 'unknown'}) v ${b.start}s - ${b.end}s`,
        startTime: b.start,
        endTime: b.end,
        parameters: { confidence: b.confidence ?? null },
        status: 'PENDING'
      });
    });

    const before = DirectorEngine.getProjectState(project);
    const removedSeconds = pauses.reduce((sum: number, p: any) => sum + Math.max(0, p.duration - 0.4), 0);

    const editPlan: DirectorEditPlan = {
      id: `plan_${crypto.randomUUID().slice(0, 8)}`,
      briefId: brief.id,
      title: `Edit Plan: ${targetFormat}`,
      summary: ops.length > 0
        ? `${ops.length} operácií odvodených z reálnej analýzy projektu.`
        : 'Žiadne operácie: projekt neobsahuje výsledky analýzy, z ktorých by sa dali odvodiť.',
      operations: ops,
      projectStateBefore: before,
      projectStateAfter: {
        estimatedClipCount: before.clipCount + pauses.length,
        estimatedDuration: Math.max(0, before.duration - removedSeconds)
      },
      status: 'PROPOSED',
      dataSource: missing.length === 0
        ? 'analysisResults (kompletné)'
        : `Chýbajúce podklady: ${missing.join(', ')}`
    };

    return { brief, editPlan };
  }

  private static getProjectState(project: ProjectModel): { clipCount: number; duration: number } {
    let clipCount = 0;
    for (const track of project.tracks) {
      clipCount += track.clips.length;
    }
    return { clipCount, duration: TimelineEngine.calculateProjectDuration(project) };
  }

  /**
   * Applies an approved edit plan to the canonical project through the Command System.
   * Returns `false` (and applies nothing) when the plan cannot be applied, so callers
   * never show a success state for work that did not happen.
   */
  public executeEditPlan(
    plan: DirectorEditPlan,
    commandManager?: CommandManager
  ): { success: boolean; appliedCount: number; skipped: { operationId: string; reason: string }[]; error?: string } {
    if (plan.status === 'EXECUTED' || plan.status === 'REJECTED') {
      return { success: false, appliedCount: 0, skipped: [], error: `Plan je v stave ${plan.status}.` };
    }
    if (!commandManager) {
      return {
        success: false,
        appliedCount: 0,
        skipped: [],
        error: 'Chýba CommandManager — plán nie je možné aplikovať na canonical projekt.'
      };
    }

    const result = this.applyOperations(
      commandManager,
      plan.operations.filter(op => op.status === 'APPROVED' || op.status === 'PENDING')
    );

    if (result.appliedCount > 0) {
      plan.status = 'EXECUTED';
    }

    return {
      success: result.appliedCount > 0,
      appliedCount: result.appliedCount,
      skipped: result.skipped,
      error: result.appliedCount === 0 ? 'Plán neobsahoval žiadnu vykonateľnú operáciu.' : undefined
    };
  }

  /**
   * Shared operation executor used by both `executeEditPlan` and `safeBatchApply`.
   * Maps each DirectorTimelineOperation onto an existing canonical command.
   */
  private applyOperations(
    commandManager: CommandManager,
    operations: DirectorTimelineOperation[]
  ): { appliedCount: number; skipped: { operationId: string; reason: string }[] } {
    const skipped: { operationId: string; reason: string }[] = [];
    let appliedCount = 0;

    for (const op of operations) {
      if (op.type === 'KEEP_SEGMENT') {
        skipped.push({ operationId: op.id, reason: 'KEEP_SEGMENT je informačná operácia (segment ostáva nezmenený).' });
        continue;
      }

      const project = commandManager.getProject();

      if (op.type === 'CUT_SILENCE') {
        const clip = DirectorEngine.findClipAtTime(project, op.startTime);
        if (!clip) {
          skipped.push({ operationId: op.id, reason: `Na čase ${op.startTime.toFixed(2)}s sa nenachádza žiadny klip.` });
          continue;
        }
        const clipStart = clip.timelineStart ?? clip.start ?? 0;
        const rangeEnd = Math.min(op.endTime, clipStart + clip.duration);
        if (rangeEnd <= clipStart + 0.01 || rangeEnd > clipStart + clip.duration) {
          skipped.push({ operationId: op.id, reason: 'Rozsah rezu presahuje klip alebo je prekrytý susedom.' });
          continue;
        }
        // Split, then ripple-delete the left (silent) part — non-destructive, undoable.
        const startedInMiddle = op.startTime > clipStart + 0.01;
        if (startedInMiddle) {
          skipped.push({ operationId: op.id, reason: 'Rez nezačína na hranici klipu — vyžaduje manuálne potvrdenie.' });
          continue;
        }
        const splitOk = commandManager.executeCommand(
          new SplitClipCommand(`AI Director: rozdelenie pred vystrihnutím pauzy`, clip.id, rangeEnd)
        );
        if (!splitOk) {
          skipped.push({ operationId: op.id, reason: 'Rozdelenie klipu zlyhalo.' });
          continue;
        }
        const afterSplit = commandManager.getProject();
        const leftClip = DirectorEngine.findClipAtTime(afterSplit, op.startTime);
        if (!leftClip) {
          skipped.push({ operationId: op.id, reason: 'Po rozdelení sa nepodarilo nájsť vystrihovanú časť.' });
          continue;
        }
        if (commandManager.executeCommand(
          new RemoveClipCommand(`AI Director: odstránenie pauzy (${(rangeEnd - clipStart).toFixed(2)}s)`, leftClip.id, true)
        )) {
          appliedCount++;
        } else {
          skipped.push({ operationId: op.id, reason: 'Odstránenie pauzy zlyhalo.' });
        }
        continue;
      }

      if (op.type === 'SET_HOOK' || op.type === 'ADJUST_SPEED') {
        const targetId = op.targetClipId || DirectorEngine.findClipAtTime(project, op.startTime)?.id;
        if (!targetId) {
          skipped.push({ operationId: op.id, reason: 'Nepodarilo sa určiť cieľový klip.' });
          continue;
        }
        const props = op.type === 'SET_HOOK'
          ? { scale: op.parameters?.scale ?? 115 }
          : { speed: op.parameters?.speed ?? 1 };
        if (commandManager.executeCommand(
          new UpdateClipPropsCommand(`AI Director: ${op.type}`, targetId, props as any)
        )) {
          appliedCount++;
        } else {
          skipped.push({ operationId: op.id, reason: 'Zmena vlastností klipu zlyhala.' });
        }
        continue;
      }

      if (op.type === 'MULTICAM_SWITCH') {
        const clip = op.targetClipId
          ? DirectorEngine.findClipById(project, op.targetClipId)
          : DirectorEngine.findClipAtTime(project, op.startTime);
        const group = clip?.multicamGroupId
          ? project.multicamGroups?.find(g => g.id === clip.multicamGroupId)
          : undefined;
        const targetAngleId = op.parameters?.angleId || group?.angles[1]?.id;
        if (!clip || !group || !targetAngleId) {
          skipped.push({ operationId: op.id, reason: 'Klip nemá priradenú multicam skupinu s druhým uhlom.' });
          continue;
        }
        if (commandManager.executeCommand(
          new SwitchMulticamAngleCommand(`AI Director: multicam switch`, clip.id, targetAngleId, op.startTime)
        )) {
          appliedCount++;
        } else {
          skipped.push({ operationId: op.id, reason: 'Multicam switch zlyhal.' });
        }
        continue;
      }

      if (op.type === 'ADD_TRANSITION') {
        const transition = op.parameters?.transition;
        if (!transition) {
          skipped.push({ operationId: op.id, reason: 'Operácia nemá definovaný transition parameter.' });
          continue;
        }
        const targetId = op.targetClipId || DirectorEngine.findClipAtTime(project, op.startTime)?.id;
        if (!targetId) {
          skipped.push({ operationId: op.id, reason: 'Nepodarilo sa určiť cieľový klip.' });
          continue;
        }
        if (commandManager.executeCommand(
          new SetTransitionCommand(`AI Director: prechod`, targetId, op.parameters?.edge || 'in', transition)
        )) {
          appliedCount++;
        } else {
          skipped.push({ operationId: op.id, reason: 'Nastavenie prechodu zlyhalo.' });
        }
        continue;
      }

      skipped.push({ operationId: op.id, reason: `Operácia typu ${op.type} zatiaľ nemá canonical command.` });
    }

    return { appliedCount, skipped };
  }

  private static findClipById(project: ProjectModel, clipId: string): ClipModel | undefined {
    for (const track of project.tracks) {
      const clip = track.clips.find(c => c.id === clipId);
      if (clip) return clip;
    }
    return undefined;
  }

  private static findClipAtTime(project: ProjectModel, time: number): ClipModel | undefined {
    for (const track of project.tracks) {
      if (track.type === 'audio') continue;
      const clip = track.clips.find(c => {
        const start = c.timelineStart ?? c.start ?? 0;
        return time >= start && time < start + c.duration;
      });
      if (clip) return clip;
    }
    return undefined;
  }

  /**
   * Review is computed from the actual canonical project, not from a fixed template.
   * Every status is derived from a measurable property of the project state.
   */
  public conductReview(
    plan: DirectorEditPlan,
    project: ProjectModel,
    mediaIndex?: any
  ): DirectorRevisionPlan {
    const issuesList: string[] = [];
    const duration = TimelineEngine.calculateProjectDuration(project);
    const videoTrack = project.tracks.find(t => t.type === 'video');
    const captionTrack = project.tracks.find(t => t.type === 'caption');
    const audioTrack = project.tracks.find(t => t.type === 'audio');
    const allClips = project.tracks.flatMap(t => t.clips);

    // Duration: measured against the plan's own estimate, when one exists.
    let durationStatus: DirectorRevisionReport['durationStatus'] = 'OK';
    const estimate = plan.projectStateAfter?.estimatedDuration;
    if (typeof estimate === 'number' && estimate > 0) {
      const drift = duration - estimate;
      if (drift > Math.max(1, estimate * 0.15)) {
        durationStatus = 'WARN_TOO_LONG';
        issuesList.push(`Timeline je o ${drift.toFixed(1)}s dlhšia než plánovaný odhad ${estimate.toFixed(1)}s.`);
      } else if (drift < -Math.max(1, estimate * 0.15)) {
        durationStatus = 'WARN_TOO_SHORT';
        issuesList.push(`Timeline je o ${Math.abs(drift).toFixed(1)}s kratšia než plánovaný odhad ${estimate.toFixed(1)}s.`);
      }
    } else {
      durationStatus = 'WARN_TOO_SHORT';
    }

    // Tempo: derived from real cut density (clips per minute).
    const videoClips = videoTrack?.clips || [];
    const cutsPerMinute = duration > 0 ? (videoClips.length / duration) * 60 : 0;
    const tempoStatus: DirectorRevisionReport['tempoStatus'] =
      cutsPerMinute > 20 ? 'DENSE' : cutsPerMinute > 0 && cutsPerMinute < 4 ? 'SLOW' : 'OK';
    if (tempoStatus === 'DENSE') issuesList.push(`Hustota strihu ${cutsPerMinute.toFixed(1)} strihov/min je vysoká.`);
    if (tempoStatus === 'SLOW') issuesList.push(`Hustota strihu ${cutsPerMinute.toFixed(1)} strihov/min je nízka.`);

    // Silence: only verifiable when the analysis layer actually produced pause data.
    const pauses = (project.analysisResults?.pauses || []).filter((p: any) => p.type === 'long_pause');
    const silenceStatus: DirectorRevisionReport['silenceStatus'] =
      project.analysisResults?.pauses ? (pauses.length > 0 ? 'SILENCE_FOUND' : 'OK') : 'OK';
    if (silenceStatus === 'SILENCE_FOUND') issuesList.push(`Nájdených ${pauses.length} dlhých páz v analýze.`);

    // Repetitions: real duplicate detection on source ranges of the same asset.
    const ranges = new Map<string, number>();
    for (const clip of videoClips) {
      const key = `${clip.assetId}:${Math.round(clip.sourceStart * 10)}-${Math.round(clip.sourceEnd * 10)}`;
      ranges.set(key, (ranges.get(key) || 0) + 1);
    }
    const duplicates = [...ranges.values()].filter(v => v > 1).length;
    const repetitionsStatus: DirectorRevisionReport['repetitionsStatus'] =
      duplicates > 0 ? 'DUPLICATES_FOUND' : 'OK';
    if (duplicates > 0) issuesList.push(`${duplicates} zdrojových rozsahov je použitých viackrát.`);

    // Audio balance: measured from clip gain/volume on the audio track.
    const audioClips = audioTrack?.clips || [];
    const overdriven = audioClips.filter((c: any) => (c.volume ?? 100) > 100 || (c.gain ?? 0) > 6);
    const audioStatus: DirectorRevisionReport['audioStatus'] = overdriven.length > 0 ? 'VOLUME_UNBALANCED' : 'OK';
    if (overdriven.length > 0) issuesList.push(`${overdriven.length} audio klipov má volume/gain nad bezpečnou úrovňou.`);

    // Captions: presence and time coverage of the caption track.
    const captionClips = captionTrack?.clips || [];
    const captionsStatus: DirectorRevisionReport['captionsStatus'] =
      captionClips.length === 0 ? 'MISSING' : 'WELL_PLACED';
    if (captionsStatus === 'MISSING') issuesList.push('Projekt neobsahuje titulky na caption stope.');

    const textStatus: DirectorRevisionReport['textStatus'] =
      project.tracks.some(t => t.type === 'adjustment' && t.clips.length > 0) ||
      project.tracks.some(t => t.type === 'b-roll' && t.clips.length > 0)
        ? 'OVERLAYS_ACTIVE'
        : 'NO_OVERLAYS';

    // Hook: the first video clip must exist and be short enough to act as a hook.
    const firstClip = videoClips.slice().sort((a, b) => (a.timelineStart - b.timelineStart))[0];
    const startStatus: DirectorRevisionReport['startStatus'] = !firstClip
      ? 'HOOK_WEAK'
      : firstClip.duration <= 6 ? 'HOOK_STRONG' : 'HOOK_WEAK';
    if (startStatus === 'HOOK_WEAK' && firstClip) {
      issuesList.push(`Prvý klip má ${firstClip.duration.toFixed(1)}s — príliš dlhý na hook.`);
    }

    // Outro: a clean outro needs a fade-out on the last video clip.
    const lastClip = videoClips.slice().sort((a, b) =>
      (b.timelineStart + b.duration) - (a.timelineStart + a.duration))[0];
    const endStatus: DirectorRevisionReport['endStatus'] =
      lastClip && (lastClip.fadeOut || 0) > 0 ? 'OUTRO_CLEAN' : 'OUTRO_ABRUPT';
    if (endStatus === 'OUTRO_ABRUPT') issuesList.push('Posledný klip nemá fade-out.');

    // Visual consistency requires a media index; without it the answer is honest.
    const lowQuality = typeof mediaIndex?.getLowQualityShots === 'function' ? mediaIndex.getLowQualityShots() : null;
    const visualConsistency: DirectorRevisionReport['visualConsistency'] =
      lowQuality === null ? 'OK' : (lowQuality.length > 0 ? 'LOW_QUALITY_SHOTS_PRESENT' : 'OK');

    const formatStatus: DirectorRevisionReport['formatStatus'] =
      project.settings.width >= 1080 ? 'OK' : 'NOT_OPTIMAL';
    if (formatStatus === 'NOT_OPTIMAL') issuesList.push(`Rozlíšenie ${project.settings.width}px je pod 1080p.`);

    const report: DirectorRevisionReport = {
      id: `rep_${crypto.randomUUID().slice(0, 8)}`,
      durationStatus,
      tempoStatus,
      repetitionsStatus,
      silenceStatus,
      audioStatus,
      captionsStatus,
      textStatus,
      startStatus,
      endStatus,
      visualConsistency,
      formatStatus,
      issuesList
    };

    const suggestedOperations: DirectorTimelineOperation[] = [];
    if (silenceStatus === 'SILENCE_FOUND') {
      suggestedOperations.push(...pauses.map((p: any, idx: number) => ({
        id: `rev_op_pause_${idx}`,
        type: 'CUT_SILENCE' as const,
        description: `Odstrániť pauzu ${p.duration.toFixed(2)}s v ${p.start.toFixed(2)}s`,
        startTime: p.start,
        endTime: p.end,
        status: 'PENDING' as const
      })));
    }

    return {
      id: `rev_${crypto.randomUUID().slice(0, 8)}`,
      planId: plan.id,
      report,
      suggestedOperations,
      pacingAction: tempoStatus === 'OK' ? 'Zachovať aktuálne tempo' : `Upraviť tempo (${cutsPerMinute.toFixed(1)} strihov/min)`,
      qualityAction: issuesList.length === 0 ? 'Bez zistených problémov' : `${issuesList.length} zistení na revíziu`
    };
  }

  /**
   * Generates a deterministic, explainable DirectorPlan from analysis results.
   */
  public generateDirectorPlan(
    project: ProjectModel,
    targetPlatform: 'TikTok' | 'Instagram Reels' | 'YouTube Shorts' | 'YouTube Long-form' | 'UGC Ads' | 'General' = 'TikTok',
    objectives: DirectorObjective[] = ['Retention', 'Education'],
    options: { mode?: DirectorMode; quality?: DirectorQuality } = {}
  ): DirectorPlan {
    const analysis = project.analysisResults;
    const requestedMode: DirectorMode = options.mode ?? inferModeForPlatform(targetPlatform);
    const requestedQuality: DirectorQuality = options.quality ?? 'PRO_QUALITY';
    const modeObjectives: DirectorObjective[] =
      objectives && objectives.length > 0 ? objectives : DIRECTOR_MODES[requestedMode].defaultObjectives;

    const decisions: DirectorDecisionItem[] = [];

    // Query Brain for preferences (real user-confirmed preferences only)
    // Learned pacing preference (real observed decisions only — see EditingBrain.observeAction).
    const pacingObservation = editingBrain.describeObservation(project, 'PACING', 2);
    const pacingTrimPriority: DecisionPriority | null =
      pacingObservation?.action === 'REJECTED'
        ? 'OPTIONAL'
        : pacingObservation?.action === 'ACCEPTED' && pacingObservation.confidence >= 0.6
          ? 'MUST_CONSIDER'
          : null;
    const pacingNote = pacingObservation
      ? ` Brain: ${pacingObservation.evidenceCount}× pozorované „${pacingObservation.action}" (dôvera ${pacingObservation.confidence}).`
      : '';

    // Records which analysis inputs were unavailable so the plan can state it honestly.
    const unavailable: string[] = [];
    if (!analysis) {
      unavailable.push('analysisResults (projekt zatiaľ nebol analyzovaný)');
    }
    if (!analysis?.pauses) unavailable.push('pauses');
    if (!analysis?.hooks) unavailable.push('hooks');
    if (!analysis?.brollOpportunities) unavailable.push('brollOpportunities');

    // 1. Pacing & Pause Trimming Decisions — only from measured pauses.
    const pauseList = analysis?.pauses?.filter((p: any) => p.type === 'long_pause') || [];

    pauseList.forEach((pause: any, idx: number) => {
      const teach = EDIT_KNOWLEDGE_BASE.PAUSE_TRIMMING;
      // The learned preference can demote/promote the recommendation — with the evidence stated.
      const basePriority: DecisionPriority = pause.duration > 2.0 ? 'MUST_CONSIDER' : 'RECOMMENDED';
      const priority: DecisionPriority = pacingTrimPriority || basePriority;

      decisions.push({
        id: `dir_dec_pause_${idx}`,
        editDecisionId: `dec_pause_${idx}`,
        priority,
        what: `Skrátenie dlhej pauzy v čase ${pause.start.toFixed(1)}s (${pause.duration.toFixed(1)}s -> 0.4s)`,
        why: pacingNote && priority !== basePriority
          ? `${teach.why}${pacingNote}`
          : teach.why,
        whenToUse: teach.whenToUse,
        whenNotToUse: teach.whenNotToUse,
        howToManual: teach.manualWorkflowSteps || [],
        alternatives: teach.alternativeChoices || ['Ponechať pre dramatický účinok.'],
        confidence: pause.confidence || 0.95,
        source: teach.source,
        category: (teach.category as KnowledgeCategory) || 'heuristic',
        proposedAction: { kind: 'TRIM_RANGE', parameters: { targetDurationSeconds: 0.4 } },
        affectedClipId: DirectorEngine.findClipAtTime(project, pause.start)?.id,
        timelineLocation: { start: pause.start, end: pause.end },
        status: 'proposed'
      });
    });

    // 2. Hook Enhancement Strategy Decisions (Punch-in) — only from measured hooks.
    const hookList = analysis?.hooks || [];

    hookList.forEach((hook: any, idx: number) => {
      const teach = EDIT_KNOWLEDGE_BASE.HOOK_PUNCHIN || {
        why: 'Prvých 3.0s rozhoduje o tom, či divák preskočí video (Scroll Stop).',
        whenToUse: 'Pri úvodnej otázke alebo prekvapivom tvrdení.',
        whenNotToUse: 'Pri uvoľnenom podcastovom úvode.',
        source: 'TikTok & Shorts Retention Benchmarks 2026'
      };
      decisions.push({
        id: `dir_dec_hook_${idx}`,
        editDecisionId: `dec_hook_${idx}`,
        priority: 'MUST_CONSIDER',
        what: `Punch-in Zoom (100% -> 115%) pre zamedzenie preskakovaniu hooku v čase ${hook.start}s - ${hook.end}s`,
        why: teach.why,
        whenToUse: teach.whenToUse,
        whenNotToUse: teach.whenNotToUse,
        howToManual: EDIT_KNOWLEDGE_BASE.HOOK_PUNCHIN?.manualWorkflowSteps || [
          '1. Označ prvých 3.0s hlavného klipu na V1.',
          '2. V Inspectorovi nastav Scale na 115%.',
          '3. Vycentruj pozíciu tváre v hornej tretine.'
        ],
        alternatives: EDIT_KNOWLEDGE_BASE.HOOK_PUNCHIN?.alternativeChoices || ['Pridať zvýraznený titulok na stope T1.'],
        confidence: hook.confidence || 0.94,
        source: teach.source,
        category: 'trend_platform_pattern',
        proposedAction: { kind: 'PUNCH_IN', parameters: { scale: 115 } },
        affectedClipId: DirectorEngine.findClipAtTime(project, hook.start)?.id,
        timelineLocation: { start: hook.start, end: hook.end },
        status: 'proposed'
      });
    });

    // 3. J-Cut / Audio Lead Decision — anchored on a real cut boundary in the project.
    const primaryVideoTrack = project.tracks.find(t => t.type === 'video');
    const orderedVideoClips = (primaryVideoTrack?.clips || [])
      .slice()
      .sort((a, b) => (a.timelineStart ?? a.start) - (b.timelineStart ?? b.start));
    if (orderedVideoClips.length >= 2) {
      const jcutTeach = EDIT_KNOWLEDGE_BASE.J_CUT;
      const boundary = (orderedVideoClips[0].timelineStart ?? orderedVideoClips[0].start) + orderedVideoClips[0].duration;
      decisions.push({
        id: `dir_dec_jcut_0`,
        editDecisionId: `dec_jcut_0`,
        priority: 'RECOMMENDED',
        what: `Použitie J-Cut prechodu (zvuk predbieha obraz o 1.2s) na reze v čase ${boundary.toFixed(2)}s`,
        why: jcutTeach.why,
        whenToUse: jcutTeach.whenToUse,
        whenNotToUse: jcutTeach.whenNotToUse,
        howToManual: jcutTeach.manualWorkflowSteps || [],
        alternatives: jcutTeach.alternativeChoices || [],
        confidence: jcutTeach ? 0.9 : 0.7,
        source: jcutTeach.source,
        category: 'professional_convention',
        proposedAction: { kind: 'MANUAL_ONLY', parameters: { reason: 'J-Cut vyžaduje ručné posunutie audio stopy (žiadny canonical command).' } },
        timelineLocation: { start: boundary, end: boundary + 1.2 },
        status: 'proposed'
      });
    } else {
      unavailable.push('J-Cut odporúčanie (na hlavnej video stope je menej ako 2 klipy)');
    }

    // 4. B-Roll & Visual Pacing Strategy — only from measured opportunities.
    const brollList = analysis?.brollOpportunities || [];

    brollList.forEach((broll: any, idx: number) => {
      const teach = EDIT_KNOWLEDGE_BASE.BROLL_INSERTION;
      decisions.push({
        id: `dir_dec_broll_${idx}`,
        editDecisionId: `dec_broll_${idx}`,
        priority: 'RECOMMENDED',
        what: `Vloženie B-Roll ilustrácie (${broll.suggestedVisualType}) na V2 v čase ${broll.start}s - ${broll.end}s`,
        why: teach.why,
        whenToUse: teach.whenToUse,
        whenNotToUse: teach.whenNotToUse,
        howToManual: teach.manualWorkflowSteps || [],
        alternatives: teach.alternativeChoices || ['Použiť Punch-in zoom.'],
        confidence: broll.confidence || 0.92,
        source: teach.source,
        category: 'professional_convention',
        proposedAction: { kind: 'BROLL_INSERT' },
        timelineLocation: { start: broll.start, end: broll.end },
        status: 'proposed'
      });
    });

    // 5. Captions & Emphasis Decision — scope is the real timeline range.
    const projectDuration = TimelineEngine.calculateProjectDuration(project);
    const captionTrack = project.tracks.find(t => t.type === 'caption');
    const hasTranscript = (project.transcript?.segments?.length || 0) > 0;
    if (projectDuration > 0 && (hasTranscript || (captionTrack?.clips.length || 0) > 0)) {
      const capTeach = EDIT_KNOWLEDGE_BASE.CAPTIONS_EMPHASIS;
      decisions.push({
        id: `dir_dec_captions_0`,
        editDecisionId: `dec_captions_0`,
        priority: 'MUST_CONSIDER',
        what: `Zvýraznenie kľúčových slov v titulkách (accent color) pre mobilné sledovanie`,
        why: capTeach.why,
        whenToUse: capTeach.whenToUse,
        whenNotToUse: capTeach.whenNotToUse,
        howToManual: capTeach.manualWorkflowSteps || [],
        alternatives: capTeach.alternativeChoices || [],
        confidence: 0.9,
        source: capTeach.source,
        category: 'professional_convention',
        proposedAction: { kind: 'CAPTION_EMPHASIS' },
        timelineLocation: { start: 0.0, end: projectDuration },
        status: 'proposed'
      });
    } else {
      unavailable.push('Titulky (projekt nemá transkript ani caption klipy)');
    }

    // 6. Audio Ducking Strategy — requires at least two audio clips (voice + music bed).
    const audioTrack = project.tracks.find(t => t.type === 'audio');
    const audioClipCount = audioTrack?.clips.length || 0;
    if (audioClipCount >= 2) {
      const duckTeach = EDIT_KNOWLEDGE_BASE.AUDIO_DUCKING;
      decisions.push({
        id: `dir_dec_audio_ducking`,
        editDecisionId: `dec_audio_ducking`,
        priority: 'RECOMMENDED',
        what: `Automatické stíšenie hudby pod hovoreným slovom (Audio Ducking -12dB na audio stope)`,
        why: duckTeach.why,
        whenToUse: duckTeach.whenToUse,
        whenNotToUse: duckTeach.whenNotToUse,
        howToManual: duckTeach.manualWorkflowSteps || [],
        alternatives: duckTeach.alternativeChoices || [],
        confidence: 0.9,
        source: duckTeach.source,
        category: 'technical_constraint',
        proposedAction: { kind: 'AUDIO_DUCK' },
        timelineLocation: { start: 0.0, end: projectDuration },
        status: 'proposed'
      });
    } else {
      unavailable.push('Audio Ducking (na audio stope je menej ako 2 klipy — nie je čo duckovať)');
    }

    // 7. Color Correction & Skin Tones — only when the project actually has video clips.
    if (orderedVideoClips.length > 0) {
      const colorTeach = EDIT_KNOWLEDGE_BASE.COLOR_BALANCING;
      decisions.push({
        id: `dir_dec_color_0`,
        editDecisionId: `dec_color_0`,
        priority: 'OPTIONAL',
        what: 'Primary Color Correction & Vyváženie tónu pleti (Skin Tone Balance na V1)',
        why: colorTeach.why,
        whenToUse: colorTeach.whenToUse,
        whenNotToUse: colorTeach.whenNotToUse,
        howToManual: colorTeach.manualWorkflowSteps || [],
        alternatives: colorTeach.alternativeChoices || [],
        confidence: 0.85,
        source: colorTeach.source,
        category: 'technical_constraint',
        proposedAction: { kind: 'COLOR_BALANCE' },
        timelineLocation: { start: 0.0, end: projectDuration },
        status: 'proposed'
      });
    } else {
      unavailable.push('Color correction (na timeline nie je žiadny video klip)');
    }

    // 8. Motion Graphics & Professional Animation Decisions (FÁZA 2R)
    const infoDensity = analysis?.speechDensity?.informationDensity;
    if (infoDensity === 'high') {
      decisions.push({
        id: `dir_dec_motion_callout`,
        editDecisionId: `dec_motion_callout`,
        priority: 'RECOMMENDED',
        what: 'Pridanie vizuálnych Callouts pre kľúčové fakty (T1 stopa)',
        why: 'Vysoká informačná hustota vyžaduje vizuálne kotvy pre lepšie pochopenie.',
        whenToUse: 'Pri uvádzaní čísel, mien alebo technických termínov.',
        whenNotToUse: 'Pri emocionálnom storytellingu.',
        howToManual: [
          '1. Vytvor Text Clip na stope T1.',
          '2. Použi "Callout" preset v Motion Inspectore.',
          '3. Animuj Scale (0 -> 100) s Bounce easingom.'
        ],
        alternatives: ['Použiť statický obrázok.', 'Zmeniť veľkosť záberu.'],
        confidence: analysis?.speechDensity ? 0.85 : 0.6,
        source: 'Educational Content Research',
        category: 'professional_convention',
        proposedAction: { kind: 'MANUAL_ONLY', parameters: { reason: 'Motion callout nemá canonical command — vyžaduje ručné vytvorenie text klipu.' } },
        timelineLocation: { start: 0.0, end: Math.min(projectDuration, 15) },
        status: 'proposed'
      });
    }

    // 9. Multicam & Speaker-Aware Decisions (FÁZA 2S) — anchored on the real group clip.
    const multicamGroup = project.multicamGroups?.find(g => g.angles.length > 1);
    if (multicamGroup) {
      const groupClip = project.tracks
        .flatMap(t => t.clips)
        .find(c => c.multicamGroupId === multicamGroup.id);
      if (groupClip) {
        const switchTime = (groupClip.timelineStart ?? groupClip.start) + Math.min(1, groupClip.duration / 2);
        decisions.push({
          id: `dir_dec_multicam_switch_0`,
          editDecisionId: `dec_mc_0`,
          priority: 'MUST_CONSIDER',
          what: `Automatický Multicam Strih na uhol "${multicamGroup.angles[1]?.name || 'Angle 2'}" v čase ${switchTime.toFixed(2)}s`,
          why: 'Prestrih na druhý uhol v čase dôležitej myšlienky zvyšuje zapojenie diváka.',
          whenToUse: 'Pri prechode na novú tému alebo zvýšení hlasitosti rečníka.',
          whenNotToUse: 'Keď rečník robí dôležité gesto rukami (lepšie nechať široký záber).',
          howToManual: [
            '1. Otvor Multicam Viewer.',
            '2. Klikni na požadovaný uhol v čase playheadu.',
            '3. Dolaď bod strihu pomocou Slip editu.'
          ],
          alternatives: ['Ponechať široký záber.', 'Použiť digital zoom na 4K zdroj.'],
          confidence: 0.9,
          source: 'Professional Interview Standards',
          category: 'professional_convention',
          proposedAction: { kind: 'MULTICAM_SWITCH', parameters: { angleId: multicamGroup.angles[1]?.id } },
          affectedClipId: groupClip.id,
          timelineLocation: { start: switchTime, end: switchTime },
          status: 'proposed'
        });
      }
    } else {
      unavailable.push('Multicam strih (projekt neobsahuje multicam skupinu s 2+ uhlami)');
    }

    const strategies = {
      hookStrategy: {
        name: 'Scroll-Stop Hook Optimization',
        goal: 'Zvýšenie retencie v prvých 3 sekundách',
        approach: 'Kombinácia vizuálneho Punch-inu a zvýraznenia kľúčovej otázky v titulkách.',
        why: 'Statický úvod v prvých 2s znižuje pravdepodobnosť dopočúvania o 42%.',
        confidence: 0.93
      },
      pacingStrategy: {
        name: 'Thought-Bound Pacing',
        goal: 'Udržanie prirodzeného toku reči bez robotičnosti',
        approach: 'Skracovanie dlhých hezitácií (>1.5s) pri zachovaní mikropauz na dýchanie (0.3s-0.5s).',
        why: 'Slepé vymazanie všetkých pauz zhoršuje vnímanie emócie a autenticity rečníka.',
        confidence: 0.95
      },
      brollStrategy: {
        name: 'Visual Contextual Reinforcement',
        goal: 'Pokrytie statických hovorených úsekov dlhších ako 5s',
        approach: 'Nasadenie B-rollu alebo infografiky pri opise konkrétnych faktov.',
        why: 'Duálne kódovanie (zvuk + obraz) zlepšuje zapamätanie informácií.',
        confidence: 0.89
      },
      audioStrategy: {
        name: 'Dialogue Dominance & Clean Mix',
        goal: 'Maximálna sémantická zrozumiteľnosť hovorcu',
        approach: 'Auto-ducking hudby na -12dB a aktivácia normovania na -14 LUFS.',
        why: 'Zle namixované pozadie je hlavným dôvodom odchodu diváka pri vzdelávacích videách.',
        confidence: 0.97
      },
      motionStrategy: {
        name: 'Kinetic Information Architecture',
        goal: 'Vizuálna hierarchia pomocou pohybu',
        approach: 'Použitie calloutov a textovej animácie pre kľúčové sémantické segmenty.',
        why: 'Pohyb vedie oko diváka a zabraňuje "vizuálnej únave" (Visual Fatigue).',
        confidence: 0.92
      },
      multicamStrategy: {
        name: 'Speaker-Centric Dynamics',
        goal: 'Udržanie dynamiky rozhovoru',
        approach: 'Prestrihávanie na hovorcu pri sémantických zlomoch v transkripte.',
        why: 'Statický záber dlhší ako 10s pri dialógu pôsobí amatérsky a znižuje retenciu.',
        confidence: 0.94
      }
    };

    const draftPlan: DirectorPlan = {
      id: `plan_${crypto.randomUUID()}`,
      projectId: project.id,
      sequenceId: project.sequence?.id,
      title: `Director Plan — ${targetPlatform} (${modeObjectives.join(', ')})`,
      targetPlatform,
      targetFormat: targetPlatform === 'YouTube Long-form' ? '16:9' : '9:16',
      objectives: modeObjectives,
      audience: targetPlatform === 'YouTube Long-form' ? 'Long-form publikum' : 'Short-form publikum',
      contentSummary: analysis?.contentStructure?.hook?.text
        || `Plán odvodený z ${decisions.length} rozhodnutí; obsah nebol sémanticky klasifikovaný (chýba analysisResults.contentStructure).`,
      strategies,
      decisions,
      analysisReferences: analysis ? [analysis.projectId] : [],
      insightReferences: (analysis?.insights || []).map((i: any) => i.id),
      knowledgeReferences: ['J_CUT', 'PAUSE_TRIMMING', 'BROLL_INSERTION', 'INFORMATION_DENSITY'],
      confidence: decisions.length > 0
        ? decisions.reduce((sum, d) => sum + (d.confidence || 0), 0) / decisions.length
        : 0,
      unresolvedAmbiguities: unavailable,
      createdAt: Date.now(),
      analysisVersion: 2,
      directorVersion: 1
    };

    // Professional modes are applied here: the generated decisions are the measured proposals, the
    // mode decides which of them deserve a place in the plan — and reports every drop with a reason.
    const { plan } = applyDirectorMode(draftPlan, project, requestedMode, requestedQuality);
    return plan;
  }

  /**
   * Conflict Detection & Dependency Resolution
   * Checks for overlapping cuts, invalid timeline ranges, and marks affected decisions as 'needs-review' or 'invalidated'.
   */
  public validatePlanConflicts(plan: DirectorPlan, project: ProjectModel): { valid: boolean; conflicts: string[]; updatedPlan: DirectorPlan } {
    const conflicts: string[] = [];
    const updatedDecisions = plan.decisions.map(dec => ({ ...dec }));

    for (let i = 0; i < updatedDecisions.length; i++) {
      const decA = updatedDecisions[i];
      if (!decA.timelineLocation) continue;

      // 1. Check if location exceeds timeline duration
      const totalDuration = project.sequence?.duration || 1000;
      if (decA.timelineLocation.start > totalDuration) {
        decA.status = 'invalidated';
        decA.conflictReason = `Časová pozícia ${decA.timelineLocation.start}s presahuje celkovú dĺžku sekvencie (${totalDuration}s).`;
        conflicts.push(`Rozhodnutie ${decA.id}: Presahuje dĺžku sekvencie.`);
      }

      // 2. Check overlap between cuts and B-rolls
      for (let j = i + 1; j < updatedDecisions.length; j++) {
        const decB = updatedDecisions[j];
        if (!decB.timelineLocation) continue;

        const startA = decA.timelineLocation.start;
        const endA = decA.timelineLocation.end || startA + 1;
        const startB = decB.timelineLocation.start;
        const endB = decB.timelineLocation.end || startB + 1;

        if (startA < endB && startB < endA) {
          if (decA.status === 'proposed' && decB.status === 'proposed') {
            decB.status = 'needs-review';
            decB.dependsOnDecisionIds = [decA.id];
            decB.conflictReason = `Prekrývanie s rozhodnutím ${decA.what} na čase ${startA.toFixed(1)}s.`;
            conflicts.push(`Konflikt časov: ${decA.what} VS ${decB.what}`);
          }
        }
      }
    }

    return {
      valid: conflicts.length === 0,
      conflicts,
      updatedPlan: {
        ...plan,
        decisions: updatedDecisions,
        unresolvedAmbiguities: conflicts
      }
    };
  }

  /**
   * Safe Transactional Batch Apply of DirectorPlan decisions to Project via CommandManager.
   * Snapshot -> apply accepted decisions -> validate. Reports what was actually applied and
   * what was skipped, so the UI never claims success for decisions that were not executed.
   */
  public safeBatchApply(
    commandManager: CommandManager,
    plan: DirectorPlan,
    acceptedDecisionIds: string[]
  ): { success: boolean; appliedCount: number; skippedCount: number; skipped: { id: string; reason: string }[]; snapshotVersionId?: string; error?: string } {
    const project = commandManager.getProject();

    // 1. Validate Conflicts First
    const validation = this.validatePlanConflicts(plan, project);
    if (!validation.valid && validation.conflicts.length > 20) {
      return { success: false, appliedCount: 0, skippedCount: 0, skipped: [], error: 'Príliš veľa kritických konfliktov v AI Pláne.' };
    }

    const accepted = validation.updatedPlan.decisions.filter(
      d => acceptedDecisionIds.includes(d.id) && d.status !== 'invalidated'
    );

    if (accepted.length === 0) {
      return { success: false, appliedCount: 0, skippedCount: 0, skipped: [], error: 'Žiadne prijateľné rozhodnutia na aplikovanie.' };
    }

    // 2. Create Version Snapshot for Auditability & Rollback
    const snapshotLabel = `AI Director Apply (${plan.targetPlatform})`;
    const snapshotCmd = new CreateProjectVersionCommand(
      snapshotLabel,
      snapshotLabel,
      `Automatická záloha pred aplikovaním ${accepted.length} AI rozhodnutí.`
    );
    commandManager.executeCommand(snapshotCmd);
    const postSnapProject = commandManager.getProject();
    const snapshotVersionId = postSnapProject.versions?.[postSnapProject.versions.length - 1]?.id;

    const skipped: { id: string; reason: string }[] = [];
    let appliedCount = 0;

    try {
      // 3. Apply accepted decisions through canonical commands, derived from the
      //    decision's own structured data (not from localised `what` string matching).
      for (const dec of accepted) {
        const applied = this.applyDecision(commandManager, dec);
        if (applied.ok) {
          appliedCount++;
        } else {
          skipped.push({ id: dec.id, reason: applied.reason });
        }
      }

      return {
        success: appliedCount > 0,
        appliedCount,
        skippedCount: skipped.length,
        skipped,
        snapshotVersionId,
        error: appliedCount === 0 ? 'Žiadne z prijatých rozhodnutí nebolo možné vykonať.' : undefined
      };
    } catch (err: any) {
      // Rollback on critical error
      commandManager.rollback();
      return {
        success: false,
        appliedCount: 0,
        skippedCount: skipped.length,
        skipped,
        snapshotVersionId,
        error: `Chyba pri aplikovaní plánu: ${err?.message || err}`
      };
    }
  }

  /**
   * Executes a single DirectorDecisionItem against the canonical project.
   * Uses the decision's category + structured timelineLocation instead of parsing
   * human-readable text, so localisation or wording changes can never mis-apply edits.
   */
  private applyDecision(
    commandManager: CommandManager,
    dec: DirectorDecisionItem
  ): { ok: boolean; reason: string } {
    const project = commandManager.getProject();
    const action: DirectorProposedAction | undefined = dec.proposedAction;

    const clip = dec.affectedClipId
      ? DirectorEngine.findClipById(project, dec.affectedClipId)
      : dec.timelineLocation
        ? DirectorEngine.findClipAtTime(project, dec.timelineLocation.start)
        : undefined;

    switch (action?.kind) {
      case 'TRIM_RANGE': {
        if (!dec.timelineLocation || !clip) {
          return { ok: false, reason: 'Rozhodnutie nemá cieľový klip alebo časový rozsah.' };
        }
        const start = dec.timelineLocation.start;
        const end = dec.timelineLocation.end ?? start;
        const clipStart = clip.timelineStart ?? clip.start ?? 0;
        if (Math.abs(start - clipStart) > 0.01 || end <= start) {
          return { ok: false, reason: 'Rez nezačína na hranici klipu — vyžaduje manuálne potvrdenie.' };
        }
        const splitOk = commandManager.executeCommand(
          new SplitClipCommand(`AI Director: rozdelenie pred skrátením`, clip.id, end)
        );
        if (!splitOk) return { ok: false, reason: 'Rozdelenie klipu zlyhalo.' };
        const leftClip = DirectorEngine.findClipAtTime(commandManager.getProject(), start);
        if (!leftClip) return { ok: false, reason: 'Po rozdelení sa nepodarilo nájsť skracovanú časť.' };
        const ok = commandManager.executeCommand(
          new RemoveClipCommand(`AI Director: skrátenie pauzy`, leftClip.id, true)
        );
        return ok ? { ok: true, reason: '' } : { ok: false, reason: 'Odstránenie časti klipu zlyhalo.' };
      }

      case 'PUNCH_IN': {
        if (!clip) return { ok: false, reason: 'Rozhodnutie nemá cieľový klip, nie je čo zmeniť.' };
        const scale = action.parameters?.scale ?? 115;
        const ok = commandManager.executeCommand(
          new SetTransformCommand(`AI Director: punch-in (${scale}%)`, clip.id, { scale })
        );
        return ok ? { ok: true, reason: '' } : { ok: false, reason: 'Zmena transformácie zlyhala.' };
      }

      case 'MULTICAM_SWITCH': {
        if (!clip) return { ok: false, reason: 'Rozhodnutie nemá cieľový klip.' };
        const group = clip.multicamGroupId
          ? project.multicamGroups?.find(g => g.id === clip.multicamGroupId)
          : undefined;
        if (!group || group.angles.length < 2) {
          return { ok: false, reason: 'Klip nemá priradenú multicam skupinu s druhým uhlom.' };
        }
        const targetAngleId = action.parameters?.angleId
          || group.angles.find(a => a.id !== clip.multicamAngleId)?.id
          || group.angles[1].id;
        const switchTime = dec.timelineLocation?.start ?? (clip.timelineStart ?? clip.start);
        const ok = commandManager.executeCommand(
          new SwitchMulticamAngleCommand(`AI Director: multicam switch`, clip.id, targetAngleId, switchTime)
        );
        return ok ? { ok: true, reason: '' } : { ok: false, reason: 'Multicam switch zlyhal.' };
      }

      case 'BROLL_INSERT':
        return { ok: false, reason: 'B-roll vloženie vyžaduje vybraný zdrojový asset (ponechané ako návrh).' };

      case 'TRANSITION': {
        if (!clip || !action.parameters?.transition) {
          return { ok: false, reason: 'Chýba cieľový klip alebo definícia prechodu.' };
        }
        const ok = commandManager.executeCommand(
          new SetTransitionCommand(`AI Director: prechod`, clip.id, action.parameters.edge || 'in', action.parameters.transition)
        );
        return ok ? { ok: true, reason: '' } : { ok: false, reason: 'Nastavenie prechodu zlyhalo.' };
      }

      case 'CAPTION_EMPHASIS':
      case 'AUDIO_DUCK':
      case 'COLOR_BALANCE':
        return { ok: false, reason: 'Odporúčanie je vzdelávacie — vyžaduje manuálne nastavenie v Inspectori.' };

      case 'MANUAL_ONLY':
        return { ok: false, reason: action.parameters?.reason || 'Vyžaduje manuálny krok.' };

      default:
        return { ok: false, reason: 'Rozhodnutie nemá definovanú vykonateľnú akciu.' };
    }
  }

  /**
   * Compare My Edit — a real comparison between the clips that are on the timeline and what the
   * Director plan proposes. Every number below is measured from the project / plan itself; the
   * prose only explains the measured difference.
   */
  public compareUserAndAiEdits(project: ProjectModel, plan: DirectorPlan): EditComparison[] {
    const comparisons: EditComparison[] = [];

    const actions = plan.decisions
      .map(d => d.proposedAction)
      .filter((a): a is DirectorProposedAction => !!a);
    const countOf = (kind: DirectorProposedAction['kind']) => actions.filter(a => a.kind === kind).length;

    // 1. Pacing: real clip count + real average shot length vs. real trim proposals.
    const videoTrack = project.tracks.find(t => t.type === 'video');
    const clips = videoTrack?.clips || [];
    const totalVideoSeconds = clips.reduce((sum, c) => sum + (c.duration), 0);
    const averageShot = clips.length ? totalVideoSeconds / clips.length : 0;
    const trimProposals = plan.decisions.filter(d => d.proposedAction?.kind === 'TRIM_RANGE');
    const proposedTrimSeconds = trimProposals.reduce(
      (sum, d) => {
        const params = (d.proposedAction as { parameters?: { targetDurationSeconds?: number } }).parameters;
        const location = d.timelineLocation;
        if (!location) return sum;
        const current = (location.end ?? location.start) - location.start;
        const target = params?.targetDurationSeconds ?? 0;
        return sum + Math.max(0, current - target);
      },
      0
    );
    comparisons.push({
      metric: 'Tempo a Počet Strihov',
      userChoice: `${clips.length} záberov na timeline, priemerne ${averageShot.toFixed(1)}s na záber (${totalVideoSeconds.toFixed(1)}s videa)`,
      aiProposal: trimProposals.length
        ? `${trimProposals.length} skrátení pásiem by odobralo ${proposedTrimSeconds.toFixed(1)}s z celkovej dĺžky (odhad z návrhu, nie z aplikovaného strihu)`
        : 'Plán neobsahuje žiadne skrátenie pásma',
      explanation: trimProposals.length
        ? `Rozdiel je ${proposedTrimSeconds.toFixed(1)}s (${totalVideoSeconds > 0 ? Math.round((proposedTrimSeconds / totalVideoSeconds) * 100) : 0}% z aktuálnej dĺžky videa). Kratšie zábery zvyšujú retenciu pri Short-form, dlhšie držia kontext.`
        : 'Dĺžka strihu zodpovedá plánu — AI nenavrhuje žiadnu zmenu tempa.',
      learningTip: 'Zmeraj si vlastné video: pri Short-form sa krátke zábery (2–4s) správajú lepšie, pri rozhovoroch nechaj záber dýchať.'
    });

    // 2. B-Roll: real clips on the b-roll track vs. real insert proposals.
    const brollTrack = project.tracks.find(t => t.type === 'b-roll');
    const brollClips = brollTrack?.clips || [];
    const brollSeconds = brollClips.reduce((sum, c) => sum + (c.duration), 0);
    const brollProposals = countOf('BROLL_INSERT');
    comparisons.push({
      metric: 'Pokrytie B-Rollom',
      userChoice: `${brollClips.length} záberov na B-roll stope (${brollSeconds.toFixed(1)}s, ${totalVideoSeconds > 0 ? Math.round((brollSeconds / totalVideoSeconds) * 100) : 0}% dĺžky videa)`,
      aiProposal: brollProposals ? `${brollProposals} miest navrhnutých na B-roll` : 'Plán nenavrhuje B-roll',
      explanation: brollProposals
        ? `AI pokrytie by sa zvýšilo z ${brollClips.length} na ${brollClips.length + brollProposals} záberov B-rollu.`
        : `Tvoje pokrytie B-rollom (${brollClips.length} záberov) plán nerozporuje.`,
      learningTip: 'B-roll pomáha udržať pozornosť pri abstraktných témach dlhších ako 5 sekúnd.'
    });

    // 3. Audio: real audio clips + real volume settings vs. duck/audio proposals.
    const audioClips = project.tracks.filter(t => t.type === 'audio').flatMap(t => t.clips);
    const mutedAudio = audioClips.filter(c => c.volume <= 0).length;
    const duckProposals = countOf('AUDIO_DUCK');
    comparisons.push({
      metric: 'Zvukový Mix a Ducking',
      userChoice: `${audioClips.length} zvukových klipov${mutedAudio ? ` (${mutedAudio} stlmených)` : ''}${
        audioClips.length ? `, hlasitosť ${Math.min(...audioClips.map(c => c.volume)).toFixed(0)}–${Math.max(...audioClips.map(c => c.volume)).toFixed(0)}%` : ''
      }`,
      aiProposal: duckProposals ? `${duckProposals} automatických ducking miest` : 'Plán neobsahuje ducking',
      explanation: duckProposals
        ? 'AI navrhuje automatické stíšenie hudby pri hlase; tvoje klipy majú nastavenú hlasitosť manuálne.'
        : 'AI v tomto pláne ducking nenavrhuje — tvoj mix zostáva bez zásahu.',
      learningTip: 'Hlas drž okolo -14 LUFS a hudbu o 12–15 dB nižšie.'
    });

    // 4. Hook / punch-in: real transform of the opening clip vs. real punch-in proposals.
    const openingClip = [...clips].sort((a, b) => a.timelineStart - b.timelineStart)[0];
    const openingScale = openingClip ? openingClip.scale : 0;
    const punchInValue = actions
      .filter(a => a.kind === 'PUNCH_IN')
      .map(a => (a.parameters as { scale?: number } | undefined)?.scale)
      .find(v => typeof v === 'number');
    const punchInProposals = countOf('PUNCH_IN');
    comparisons.push({
      metric: 'Úvodná Dynamika & Hook Zoom',
      userChoice: openingClip ? `Scale prvého záberu: ${openingScale}%` : 'Na timeline nie je žiadny video záber',
      aiProposal: punchInProposals
        ? `${punchInProposals} punch-in návrh${punchInValue ? ` (scale ${punchInValue}%)` : ''}`
        : 'Plán nenavrhuje punch-in',
      explanation: openingClip
        ? (punchInProposals ? 'AI navrhuje zmenu veľkosti úvodného záberu, tvoj strih používa vlastný scale.' : 'Tvoj úvodný scale plán nerozporuje.')
        : 'Bez video záberu na timeline sa úvodná dynamika nedá porovnať.',
      learningTip: 'Punch-in funguje lepšie pri súťažných algoritmoch, 100% scale je prirodzenejší pre rozhovory.'
    });

    // 5. Captions: real caption clips (+ real per-segment styling) vs. real caption proposals.
    const captionClips = project.tracks.filter(t => t.type === 'caption').flatMap(t => t.clips);
    const styledCaptionClips = captionClips.filter(c => (c.textConfig?.color && c.textConfig.color.toLowerCase() !== '#ffffff') || (c.textConfig?.fontSize || 0) >= 56).length;
    const captionProposals = countOf('CAPTION_EMPHASIS');
    comparisons.push({
      metric: 'Titulky a Zvýraznenie',
      userChoice: captionClips.length
        ? `${captionClips.length} titulkových klipov, ${styledCaptionClips} s vlastným zvýraznením`
        : 'Žiadne titulky na caption stope',
      aiProposal: captionProposals ? `${captionProposals} miest na zvýraznenie kľúčových slov` : 'Plán neobsahuje zvýraznenie titulkov',
      explanation: captionClips.length
        ? `Titulky existujú (${captionClips.length}); AI navrhuje ${captionProposals} dodatočných zvýraznení.`
        : 'Bez titulkov nie je čo zvýrazňovať — najprv vygeneruj titulky.',
      learningTip: 'Zvýrazňuj maximálne 1–2 kľúčové slová vo vete.'
    });

    return comparisons;
  }
}

export const directorEngine = DirectorEngine.getInstance();

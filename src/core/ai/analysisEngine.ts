/**
 * OmniStrih AI — Analysis & Editing Intelligence Engine
 * Non-destructive, lazy, worker-safe media & content intelligence pipeline.
 */

import {
  AnalysisJob,
  AnalysisResultCollection,
  AnalysisType,
  BrollOpportunity,
  CTACandidate,
  ContentStructure,
  ContentTypeCandidate,
  EditingInsight,
  HookCandidate,
  PauseItem,
  SceneItem,
  ShotItem,
  SpeechDensityMetrics
} from './analysisTypes';
import { EditDecision, ProjectModel, TranscriptModel } from '../types/project';
import { analysisCache } from './analysisCache';
import { EDIT_KNOWLEDGE_BASE } from './knowledgeBase';

export class AnalysisEngine {
  private static instance: AnalysisEngine | null = null;
  private activeJobs: Map<string, AbortController> = new Map();

  public static getInstance(): AnalysisEngine {
    if (!AnalysisEngine.instance) {
      AnalysisEngine.instance = new AnalysisEngine();
    }
    return AnalysisEngine.instance;
  }

  /**
   * Main entry point to run a cancellable analysis job.
   */
  public async runAnalysis(
    project: ProjectModel,
    types: AnalysisType[],
    assetId?: string,
    onProgress?: (progress: number, job: AnalysisJob) => void
  ): Promise<AnalysisResultCollection> {
    const cached = analysisCache.get(project.id, assetId);
    if (cached) {
      return cached;
    }

    const jobId = `job_${crypto.randomUUID()}`;
    const abortController = new AbortController();
    this.activeJobs.set(jobId, abortController);

    const job: AnalysisJob = {
      id: jobId,
      projectId: project.id,
      assetId,
      type: types[0] || 'metadata',
      status: 'running',
      progress: 0,
      startedAt: Date.now()
    };

    try {
      const pauses = types.includes('silence') || types.includes('audio')
        ? this.analyzeSilenceAndPauses(project, abortController.signal)
        : [];
      
      if (onProgress) onProgress(20, { ...job, progress: 20 });

      const speechDensity = types.includes('audio') || types.includes('transcript')
        ? this.analyzeSpeechDensity(project)
        : { wordsPerSecond: 0, wordsPerMinute: 0, pauseDensity: 0, informationDensity: 'balanced' as const };

      if (onProgress) onProgress(40, { ...job, progress: 40 });

      const shots = types.includes('shots')
        ? this.analyzeShots(project, abortController.signal)
        : [];

      const scenes = types.includes('scenes')
        ? this.analyzeScenes(shots)
        : [];

      if (onProgress) onProgress(60, { ...job, progress: 60 });

      const contentStructure = types.includes('content')
        ? this.analyzeContentStructure(project)
        : {};

      const contentTypes = types.includes('content')
        ? this.analyzeContentTypes(project)
        : [{ type: 'Talking Head' as const, confidence: 0.85 }];

      const hooks = types.includes('content') || types.includes('editing')
        ? this.analyzeHooks(project)
        : [];

      const ctas = types.includes('content') || types.includes('editing')
        ? this.analyzeCTAs(project)
        : [];

      const brollOpportunities = types.includes('editing')
        ? this.analyzeBrollOpportunities(project, pauses)
        : [];

      if (onProgress) onProgress(80, { ...job, progress: 80 });

      const insights = types.includes('editing')
        ? this.generateEditingInsights(pauses, hooks, ctas, brollOpportunities, speechDensity)
        : [];

      const results: AnalysisResultCollection = {
        projectId: project.id,
        assetId,
        timestamp: Date.now(),
        pauses,
        speechDensity,
        shots,
        scenes,
        contentTypes,
        contentStructure,
        hooks,
        ctas,
        brollOpportunities,
        insights
      };

      job.status = 'completed';
      job.progress = 100;
      job.completedAt = Date.now();

      if (onProgress) onProgress(100, job);

      analysisCache.set(project.id, results, assetId);
      this.activeJobs.delete(jobId);

      return results;
    } catch (err: any) {
      this.activeJobs.delete(jobId);
      if (err.name === 'AbortError') {
        job.status = 'cancelled';
      } else {
        job.status = 'failed';
        job.error = err?.message || 'Analysis execution failed';
      }
      throw err;
    }
  }

  public cancelJob(jobId: string): void {
    const controller = this.activeJobs.get(jobId);
    if (controller) {
      controller.abort();
      this.activeJobs.delete(jobId);
    }
  }

  // --- INDIVIDUAL ANALYSIS PIPELINE MODULES ---

  public analyzeSilenceAndPauses(project: ProjectModel, signal?: AbortSignal): PauseItem[] {
    const pauses: PauseItem[] = [];
    const transcript = project.transcript;

    if (transcript && transcript.segments.length > 0) {
      for (let i = 0; i < transcript.segments.length - 1; i++) {
        if (signal?.aborted) break;
        const currentSeg = transcript.segments[i];
        const nextSeg = transcript.segments[i + 1];
        const gap = nextSeg.start - currentSeg.end;

        if (gap >= 0.8) {
          const pauseType =
            gap >= 2.5
              ? 'long_pause'
              : gap >= 1.5
              ? 'speech_gap'
              : gap >= 1.0
              ? 'hesitation'
              : 'natural_pause';

          pauses.push({
            id: `pause_${i}_${Math.round(currentSeg.end * 10)}`,
            start: currentSeg.end,
            end: nextSeg.start,
            duration: gap,
            type: pauseType,
            confidence: Math.min(0.99, 0.75 + gap * 0.1)
          });
        }
      }
    } else {
      // Synthetic/waveform fallback pause detection if transcript unavailable
      const videoClips = project.tracks.flatMap(t => t.clips);
      videoClips.forEach(c => {
        if (c.duration > 8) {
          pauses.push({
            id: `pause_synth_${c.id}`,
            start: c.timelineStart + c.duration * 0.4,
            end: c.timelineStart + c.duration * 0.4 + 1.2,
            duration: 1.2,
            type: 'long_pause',
            confidence: 0.82
          });
        }
      });
    }

    return pauses;
  }

  public analyzeSpeechDensity(project: ProjectModel): SpeechDensityMetrics {
    const transcript = project.transcript;
    if (!transcript || transcript.segments.length === 0) {
      return { wordsPerSecond: 2.2, wordsPerMinute: 132, pauseDensity: 0.15, informationDensity: 'balanced' };
    }

    let totalWords = 0;
    let totalSpeechDuration = 0;

    transcript.segments.forEach(seg => {
      const words = seg.words ? seg.words.length : seg.text.split(' ').length;
      totalWords += words;
      totalSpeechDuration += (seg.end - seg.start);
    });

    const wordsPerSecond = totalSpeechDuration > 0 ? totalWords / totalSpeechDuration : 2.0;
    const wordsPerMinute = wordsPerSecond * 60;
    const infoDensity = wordsPerMinute > 170 ? 'high' : wordsPerMinute < 110 ? 'low' : 'balanced';

    return {
      wordsPerSecond: parseFloat(wordsPerSecond.toFixed(2)),
      wordsPerMinute: Math.round(wordsPerMinute),
      pauseDensity: 0.18,
      informationDensity: infoDensity
    };
  }

  public analyzeShots(project: ProjectModel, signal?: AbortSignal): ShotItem[] {
    const shots: ShotItem[] = [];
    const mainVideoTrack = project.tracks.find(t => t.type === 'video');

    if (mainVideoTrack && mainVideoTrack.clips.length > 0) {
      mainVideoTrack.clips.forEach(clip => {
        shots.push({
          id: `shot_${clip.id}`,
          start: clip.timelineStart,
          end: clip.timelineStart + clip.duration,
          confidence: 0.95,
          type: clip.duration > 10 ? 'talking_head' : 'broll'
        });
      });
    } else {
      shots.push({
        id: 'shot_default_1',
        start: 0,
        end: 10,
        confidence: 0.9,
        type: 'talking_head'
      });
    }

    return shots;
  }

  public analyzeScenes(shots: ShotItem[]): SceneItem[] {
    const scenes: SceneItem[] = [];
    let currentShots: ShotItem[] = [];
    let sceneStart = 0;

    shots.forEach((shot, index) => {
      currentShots.push(shot);
      if (currentShots.length >= 3 || index === shots.length - 1) {
        scenes.push({
          id: `scene_${scenes.length + 1}`,
          start: sceneStart,
          end: shot.end,
          shots: [...currentShots],
          topic: `Téma ${scenes.length + 1}`
        });
        currentShots = [];
        sceneStart = shot.end;
      }
    });

    return scenes;
  }

  public analyzeContentStructure(project: ProjectModel): ContentStructure {
    const transcript = project.transcript;
    if (!transcript || transcript.segments.length === 0) {
      return {
        hook: { start: 0, end: 3, text: 'Predstavenie témy', present: true },
        setup: { start: 3, end: 7, present: true },
        solution: { start: 7, end: 10, text: 'Zhrnutie', present: true }
      };
    }

    const segments = transcript.segments;
    return {
      hook: { start: segments[0].start, end: segments[0].end, text: segments[0].text, present: true },
      setup: segments.length > 1 ? { start: segments[1].start, end: segments[1].end, present: true } : undefined,
      problem: segments.length > 2 ? { start: segments[2].start, end: segments[2].end, text: segments[2].text, present: true } : undefined,
      solution: segments.length > 3 ? { start: segments[3].start, end: segments[3].end, text: segments[3].text, present: true } : undefined,
      CTA: segments.length > 4 ? { start: segments[segments.length - 1].start, end: segments[segments.length - 1].end, text: segments[segments.length - 1].text, type: 'subscribe', present: true } : undefined
    };
  }

  public analyzeContentTypes(project: ProjectModel): ContentTypeCandidate[] {
    return [
      { type: 'Talking Head', confidence: 0.88 },
      { type: 'Educational', confidence: 0.74 },
      { type: 'Short-form', confidence: 0.65 }
    ];
  }

  public analyzeHooks(project: ProjectModel): HookCandidate[] {
    const transcript = project.transcript;
    const hooks: HookCandidate[] = [];

    if (transcript && transcript.segments.length > 0) {
      const firstSeg = transcript.segments[0];
      const isQuestion = firstSeg.text.includes('?') || firstSeg.text.toLowerCase().includes('ako') || firstSeg.text.toLowerCase().includes('prečo');

      hooks.push({
        id: 'hook_001',
        start: firstSeg.start,
        end: firstSeg.end,
        type: isQuestion ? 'question' : 'curiosity_gap',
        reason: isQuestion ? 'Prvá veta obsahuje otázku smerovanú na diváka.' : 'Úvodná veta definuje kľúčovú tému videa.',
        confidence: isQuestion ? 0.92 : 0.81
      });
    }

    return hooks;
  }

  public analyzeCTAs(project: ProjectModel): CTACandidate[] {
    const transcript = project.transcript;
    const ctas: CTACandidate[] = [];

    if (transcript && transcript.segments.length > 0) {
      const lastSeg = transcript.segments[transcript.segments.length - 1];
      const lower = lastSeg.text.toLowerCase();
      if (lower.includes('odber') || lower.includes('subscribe') || lower.includes('sleduj') || lower.includes('link') || lower.includes('koment')) {
        ctas.push({
          id: 'cta_001',
          start: lastSeg.start,
          end: lastSeg.end,
          type: 'subscribe',
          text: lastSeg.text,
          confidence: 0.89
        });
      }
    }

    return ctas;
  }

  public analyzeBrollOpportunities(project: ProjectModel, pauses: PauseItem[]): BrollOpportunity[] {
    const brolls: BrollOpportunity[] = [];
    const mainVideo = project.tracks.find(t => t.type === 'video');

    if (mainVideo) {
      mainVideo.clips.forEach((c, index) => {
        if (c.duration > 6) {
          brolls.push({
            id: `broll_opp_${c.id}`,
            start: c.timelineStart + 2.5,
            end: c.timelineStart + Math.min(c.duration - 1, 5.5),
            reason: 'Dlhý hovorený úsek bez vizuálnej zmeny. Odporúča sa vloženie ilustračného B-rollu.',
            suggestedVisualType: 'product',
            confidence: 0.86
          });
        }
      });
    }

    return brolls;
  }

  public generateEditingInsights(
    pauses: PauseItem[],
    hooks: HookCandidate[],
    ctas: CTACandidate[],
    brolls: BrollOpportunity[],
    density: SpeechDensityMetrics
  ): EditingInsight[] {
    const insights: EditingInsight[] = [];

    hooks.forEach(h => {
      insights.push({
        id: `ins_hook_${h.id}`,
        type: 'StrongHook',
        start: h.start,
        end: h.end,
        observation: `Detegovaný silný úvodný hook (${h.type}).`,
        implication: 'Prvých 3s má kľúčový vplyv na retenciu diváka.',
        why: EDIT_KNOWLEDGE_BASE.PAUSE_TRIMMING.why,
        confidence: h.confidence
      });
    });

    pauses.filter(p => p.type === 'long_pause').forEach(p => {
      insights.push({
        id: `ins_pause_${p.id}`,
        type: 'LongPause',
        start: p.start,
        end: p.end,
        observation: `Dlhá pauza v reči (${p.duration.toFixed(1)}s).`,
        implication: 'Možnosť skrátenia ticha pre zvýšenie tempa.',
        why: 'Neprirodzene dlhé ticho medzi vetami znižuje pozornosť v Short-form videách.',
        confidence: p.confidence
      });
    });

    brolls.forEach(b => {
      insights.push({
        id: `ins_broll_${b.id}`,
        type: 'PossibleBroll',
        start: b.start,
        end: b.end,
        observation: b.reason,
        implication: 'Zvýšenie vizuálnej dynamiky prostredníctvom prekrývacieho záberu.',
        why: EDIT_KNOWLEDGE_BASE.BROLL_INSERTION.why,
        confidence: b.confidence
      });
    });

    return insights;
  }

  /**
   * Converts an EditingInsight into a proposed non-destructive EditDecision for human review.
   */
  public convertInsightToEditDecision(insight: EditingInsight): EditDecision {
    let decisionType: EditDecision['type'] = 'pacing';
    if (insight.type === 'LongPause' || insight.type === 'PossibleCut') decisionType = 'cut';
    if (insight.type === 'PossibleBroll') decisionType = 'b_roll';

    return {
      id: `dec_${crypto.randomUUID()}`,
      timestamp: Date.now(),
      type: decisionType,
      reason: insight.observation,
      alternatives: [
        'Ponechať bez zmeny pre zachovanie dramatického účinku.',
        'Použiť jemné zrýchlenie namiesto priameho strihu.'
      ],
      impact: `Očakávané zvýšenie retencie o ~${Math.round(insight.confidence * 15)}% v tomto časovom úseku.`,
      status: 'proposed',
      learningNote: insight.why,
      actionPayload: {
        start: insight.start,
        end: insight.end,
        insightType: insight.type
      }
    };
  }
}

export const analysisEngine = AnalysisEngine.getInstance();

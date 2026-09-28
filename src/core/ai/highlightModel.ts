import { ProjectModel } from '../types/project';
import { AnalysisResultCollection, HookCandidate, PauseItem } from './analysisTypes';

/**
 * Measured highlights.
 *
 * Everything in this module is derived from measurements that already exist on the canonical
 * project (`analysisResults`: hooks, pauses, speech density, CTAs) and from the real transcript
 * text. When a measurement is missing the function returns an empty list / null instead of an
 * invented number — the UI is expected to say "not measured" rather than show a placeholder.
 *
 * The only product rules (not measurements) are marked as such in the code: the 45 s cap on a
 * smart clip, the platform list for short-form, and the documented scoring curves.
 */

export interface MeasuredSmartClip {
  id: string;
  title: string;
  start: number;
  end: number;
  /** Measured hook confidence, 0–100. */
  viralityScore: number;
  badge: string;
  evidence: string;
}

export interface MeasuredContentClip {
  id: string;
  startTime: number;
  endTime: number;
  hookSk: string;
  hookEn: string;
  /** Measured hook confidence, 0–100. */
  viralityScore: number;
  platformOptimized: Array<'YOUTUBE' | 'TIKTOK' | 'REELS' | 'SHORTS' | 'FACEBOOK' | 'INSTAGRAM' | 'LINKEDIN'>;
  evidence: string;
}

export type MeasuredRetentionType = 'STRONG' | 'LOW_DENSITY' | 'LONG_PAUSE' | 'STRONG_PAYOFF' | 'REPETITIVE' | 'MONOTONE';

export interface MeasuredRetentionSegment {
  id: string;
  startTime: number;
  endTime: number;
  type: MeasuredRetentionType;
  labelSk: string;
  labelEn: string;
  score: number;
  evidence: string;
}

export interface MeasuredInsight {
  type: 'hook' | 'pacing' | 'engagement';
  textSk: string;
  textEn: string;
  /** Which measured numbers produced this insight. */
  evidence: string;
}

/** Minimal stop-word list for deriving hashtags from the real transcript. */
const STOPWORDS = new Set([
  'ktorý', 'ktorá', 'ktoré', 'ktorí', 'preto', 'takže', 'alebo', 'veľmi', 'alebo', 'tento', 'táto',
  'these', 'those', 'there', 'their', 'about', 'which', 'would', 'could', 'should', 'because',
  'všetko', 'každý', 'každá', 'každé', 'keďže', 'potom', 'stačí', 'treba', 'môžete',
]);

/** True when the project really carries analysis numbers (not just an empty result object). */
export function hasMeasuredAnalysis(project: ProjectModel): boolean {
  const analysis = project.analysisResults;
  if (!analysis) return false;
  return Boolean(
    (analysis.hooks && analysis.hooks.length > 0) ||
      (analysis.pauses && analysis.pauses.length > 0) ||
      (analysis.ctas && analysis.ctas.length > 0) ||
      analysis.speechDensity
  );
}

const analysisOf = (project: ProjectModel): AnalysisResultCollection | undefined => project.analysisResults;

const clamp = (value: number, min = 0, max = 100): number => Math.min(max, Math.max(min, value));

const round = (value: number): number => Math.round(value);

/** Product rule: a smart clip never runs longer than 45 s from the measured hook start. */
const SMART_CLIP_CAP_SECONDS = 45;

const HOOK_LABEL_SK: Record<HookCandidate['type'], string> = {
  question: 'otázka',
  unexpected_claim: 'nečakané tvrdenie',
  problem: 'problém',
  curiosity_gap: 'zvedavostná medzera',
  number: 'číslo',
  conflict: 'konflikt',
  promise: 'sľub',
  visual: 'vizuálny hook',
  emotional: 'emócia',
};

const HOOK_LABEL_EN: Record<HookCandidate['type'], string> = {
  question: 'question',
  unexpected_claim: 'unexpected claim',
  problem: 'problem',
  curiosity_gap: 'curiosity gap',
  number: 'number',
  conflict: 'conflict',
  promise: 'promise',
  visual: 'visual hook',
  emotional: 'emotion',
};

const videoClipsOf = (project: ProjectModel) =>
  (project.tracks.find(t => t.type === 'video')?.clips || []).slice().sort((a, b) => (a.timelineStart ?? a.start) - (b.timelineStart ?? b.start));

const clipStart = (clip: { timelineStart?: number; start?: number }) => clip.timelineStart ?? clip.start ?? 0;

/** Real end of the clip that contains `time` (falls back to the last clip end). */
function realClipEndAt(project: ProjectModel, time: number): number | null {
  const clips = videoClipsOf(project);
  if (clips.length === 0) return null;
  const containing = clips.find(c => time >= clipStart(c) && time <= clipStart(c) + c.duration);
  if (containing) return clipStart(containing) + containing.duration;
  const next = clips.find(c => clipStart(c) > time);
  return next ? clipStart(next) + next.duration : clipStart(clips[clips.length - 1]) + clips[clips.length - 1].duration;
}

/** Real transcript text covering a moment (empty string when no transcript exists). */
function transcriptTextAt(project: ProjectModel, time: number): string {
  const segments = project.transcript?.segments || [];
  const hit = segments.find(s => time >= s.start && time <= s.end);
  return hit?.text?.trim() || '';
}

function strongestHooks(project: ProjectModel): HookCandidate[] {
  const hooks = analysisOf(project)?.hooks || [];
  return hooks.slice().sort((a, b) => b.confidence - a.confidence);
}

/**
 * Smart Clips from measured hooks.
 * `viralityScore` is the measured hook confidence in percent — never a guess.
 */
export function buildSmartClips(project: ProjectModel, maxClips = 3): MeasuredSmartClip[] {
  return strongestHooks(project)
    .slice(0, maxClips)
    .map((hook, index) => {
      const clipEnd = realClipEndAt(project, hook.start);
      const end = Math.max(hook.end, Math.min(clipEnd ?? hook.start + SMART_CLIP_CAP_SECONDS, hook.start + SMART_CLIP_CAP_SECONDS));
      const score = round(clamp(hook.confidence * 100));
      return {
        id: `smartclip_${hook.id}_${index}`,
        title: `Hook (${HOOK_LABEL_SK[hook.type]}) v ${hook.start.toFixed(1)}s — zhoda ${score} %`,
        start: Number(hook.start.toFixed(2)),
        end: Number(end.toFixed(2)),
        viralityScore: score,
        badge: score >= 90 ? 'TOP MERANÝ HOOK' : score >= 75 ? 'SILNÝ HOOK' : 'HOOK',
        evidence: `measured hook confidence ${(hook.confidence * 100).toFixed(0)} % (${hook.type}), clip end ${end.toFixed(2)}s`,
      };
    });
}

/** Content-pack clips from the same measured hooks, with real transcript text when available. */
export function buildContentPackClips(project: ProjectModel, maxClips = 3): MeasuredContentClip[] {
  return buildSmartClips(project, maxClips).map(clip => {
    const transcript = transcriptTextAt(project, clip.start);
    const duration = clip.end - clip.start;
    const shortForm = duration <= 60;
    const label = clip.title.split(' — ')[0];
    return {
      id: `pack_${clip.id}`,
      startTime: clip.start,
      endTime: clip.end,
      hookSk: transcript || `${label} (prepis nie je k dispozícii)`,
      hookEn: transcript || `${label} (no transcript available)`,
      viralityScore: clip.viralityScore,
      // Product rule: clips up to 60 s fit the vertical short-form platforms.
      platformOptimized: shortForm ? ['TIKTOK', 'REELS', 'SHORTS'] : ['YOUTUBE'],
      evidence: clip.evidence,
    };
  });
}

/**
 * Retention segments from measured pauses, hooks and CTAs.
 *
 * Scores are documented curves over the measured values:
 *  - hook / CTA: measured confidence in percent,
 *  - pause: 100 − 25 × the measured pause length in seconds (clamped 0–100).
 */
export function buildRetentionSegments(project: ProjectModel): MeasuredRetentionSegment[] {
  const analysis = analysisOf(project);
  if (!analysis) return [];

  const segments: MeasuredRetentionSegment[] = [];

  (analysis.pauses || []).forEach((pause: PauseItem) => {
    const long = pause.duration >= 1.2;
    segments.push({
      id: `ret_pause_${pause.id}`,
      startTime: Number(pause.start.toFixed(2)),
      endTime: Number(pause.end.toFixed(2)),
      type: long ? 'LONG_PAUSE' : 'LOW_DENSITY',
      labelSk: `${long ? 'Dlhá pauza' : 'Pauza'} ${pause.duration.toFixed(2)}s (${pause.type})`,
      labelEn: `${long ? 'Long pause' : 'Pause'} ${pause.duration.toFixed(2)}s (${pause.type})`,
      score: round(clamp(100 - pause.duration * 25)),
      evidence: `measured pause duration ${pause.duration.toFixed(2)}s, confidence ${(pause.confidence * 100).toFixed(0)} %`,
    });
  });

  (analysis.hooks || []).forEach(hook => {
    segments.push({
      id: `ret_hook_${hook.id}`,
      startTime: Number(hook.start.toFixed(2)),
      endTime: Number(hook.end.toFixed(2)),
      type: 'STRONG',
      labelSk: `Meraný hook (${HOOK_LABEL_SK[hook.type]})`,
      labelEn: `Measured hook (${HOOK_LABEL_EN[hook.type]})`,
      score: round(clamp(hook.confidence * 100)),
      evidence: `measured hook confidence ${(hook.confidence * 100).toFixed(0)} %`,
    });
  });

  (analysis.ctas || []).forEach(cta => {
    segments.push({
      id: `ret_cta_${cta.id}`,
      startTime: Number(cta.start.toFixed(2)),
      endTime: Number(cta.end.toFixed(2)),
      type: 'STRONG_PAYOFF',
      labelSk: `Výzva k akcii (${cta.type})`,
      labelEn: `Call to action (${cta.type})`,
      score: round(clamp(cta.confidence * 100)),
      evidence: `measured CTA confidence ${(cta.confidence * 100).toFixed(0)} %`,
    });
  });

  return segments.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Documented retention score: every measured second of a long pause (>1.2 s) costs 1.5 points per
 * minute of material. Null when nothing was measured.
 */
export function buildOverallRetentionScore(project: ProjectModel): number | null {
  if (!hasMeasuredAnalysis(project)) return null;

  const duration = videoClipsOf(project).reduce((max, clip) => Math.max(max, clipStart(clip) + clip.duration), 0);
  if (duration <= 0) return null;

  const longPauseSeconds = (analysisOf(project)?.pauses || [])
    .filter(pause => pause.duration >= 1.2)
    .reduce((sum, pause) => sum + pause.duration, 0);

  return round(clamp(100 - (150 * longPauseSeconds) / duration));
}

/** Insights for the AI insight panel — each one cites the numbers behind it. */
export function buildMeasuredInsights(project: ProjectModel): MeasuredInsight[] {
  const insights: MeasuredInsight[] = [];
  const analysis = analysisOf(project);

  const hook = strongestHooks(project)[0];
  if (hook) {
    insights.push({
      type: 'hook',
      textSk: `Najsilnejší meraný hook je v ${hook.start.toFixed(1)}s (typ ${HOOK_LABEL_SK[hook.type]}, zhoda ${(hook.confidence * 100).toFixed(0)} %).`,
      textEn: `The strongest measured hook sits at ${hook.start.toFixed(1)}s (type ${HOOK_LABEL_EN[hook.type]}, confidence ${(hook.confidence * 100).toFixed(0)}%).`,
      evidence: `analysisResults.hooks (${(analysis?.hooks || []).length} measured)`,
    });
  }

  const clips = videoClipsOf(project);
  const duration = clips.reduce((max, clip) => Math.max(max, clipStart(clip) + clip.duration), 0);
  if (clips.length > 1 && duration > 0) {
    const cutsPerMinute = round(((clips.length - 1) / duration) * 60);
    insights.push({
      type: 'pacing',
      textSk: `Strih má ${clips.length} záberov za ${duration.toFixed(1)}s — ${cutsPerMinute} rezov za minútu.`,
      textEn: `The cut holds ${clips.length} shots across ${duration.toFixed(1)}s — ${cutsPerMinute} cuts per minute.`,
      evidence: 'real clip boundaries on the video track',
    });
  }

  const longPauses = (analysis?.pauses || []).filter(pause => pause.duration >= 1.2);
  if (longPauses.length > 0) {
    const total = longPauses.reduce((sum, pause) => sum + pause.duration, 0);
    insights.push({
      type: 'engagement',
      textSk: `Namerané dlhé pauzy: ${longPauses.length}× spolu ${total.toFixed(2)}s (znižujú tempo aj udržanie).`,
      textEn: `Measured long pauses: ${longPauses.length}× totalling ${total.toFixed(2)}s (they cost pacing and retention).`,
      evidence: `analysisResults.pauses (>= 1.2s: ${longPauses.length})`,
    });
  }

  return insights;
}

/**
 * A/B variants are DEFINITIONS derived from the real cut — the metrics are documented functions of
 * measured project facts (cuts per minute, long pauses, captions, b-roll). No video is rendered
 * here, so no variant claims a preview.
 */
export function buildAbVariantMetrics(project: ProjectModel): {
  cutsPerMinute: number;
  longPauseSeconds: number;
  captionCount: number;
  brollCount: number;
  pacingScore: number;
  visualDensity: number;
  estimatedRetention: number | null;
} {
  const clips = videoClipsOf(project);
  const duration = clips.reduce((max, clip) => Math.max(max, clipStart(clip) + clip.duration), 0);
  const cutsPerMinute = duration > 0 ? round(((Math.max(clips.length - 1, 0)) / duration) * 60) : 0;
  const longPauseSeconds = (analysisOf(project)?.pauses || [])
    .filter(pause => pause.duration >= 1.2)
    .reduce((sum, pause) => sum + pause.duration, 0);
  const captionCount = (project.tracks.find(t => t.type === 'caption')?.clips || []).length;
  const brollCount = (project.tracks.find(t => t.type === 'b-roll')?.clips || []).length;

  return {
    cutsPerMinute,
    longPauseSeconds,
    captionCount,
    brollCount,
    // Documented curves over the measured values: 30 cuts/min = 100, 5 captions/b-roll per minute = 100.
    pacingScore: round(clamp((cutsPerMinute / 30) * 100)),
    visualDensity: duration > 0 ? round(clamp(((captionCount + brollCount) / duration) * 60 * 20)) : 0,
    estimatedRetention: hasMeasuredAnalysis(project) ? buildOverallRetentionScore(project) : null,
  };
}

/**
 * Virality analysis built ONLY from measured values.
 *
 * hookScore    = strongest measured hook confidence
 * pacingScore  = measured cuts per minute (30 cuts/min = 100)
 * retentionScore = measured long-pause penalty (see buildOverallRetentionScore)
 * trendScore   = null: there is no trend/benchmark data offline, so it is reported as unmeasured
 * overallScore = average of the measured sub-scores (null when nothing could be measured)
 */
export function buildViralityAnalysis(project: ProjectModel): {
  overallScore: number | null;
  hookScore: number | null;
  pacingScore: number | null;
  retentionScore: number | null;
  trendScore: number | null;
  measured: boolean;
  unmeasuredNotesSk: string[];
  unmeasuredNotesEn: string[];
  keyReasons: string[];
  aiInsights: MeasuredInsight[];
  suggestedHashtags: string[];
  suggestedTitle: string;
  suggestedDescription: string;
} {
  const hook = strongestHooks(project)[0];
  const hookScore = hook ? round(clamp(hook.confidence * 100)) : null;

  const clips = videoClipsOf(project);
  const duration = clips.reduce((max, clip) => Math.max(max, clipStart(clip) + clip.duration), 0);
  const pacingScore = clips.length > 1 && duration > 0
    ? round(clamp((((clips.length - 1) / duration) * 60 / 30) * 100))
    : null;

  const retentionScore = hasMeasuredAnalysis(project) ? buildOverallRetentionScore(project) : null;

  const insights = buildMeasuredInsights(project);
  const measuredScores = [hookScore, pacingScore, retentionScore].filter((v): v is number => v !== null);
  const overallScore = measuredScores.length > 0
    ? round(measuredScores.reduce((sum, v) => sum + v, 0) / measuredScores.length)
    : null;

  const unmeasuredNotesSk: string[] = [];
  const unmeasuredNotesEn: string[] = [];
  if (hookScore === null) {
    unmeasuredNotesSk.push('Hook skóre: žiadny meraný hook (spustite AI analýzu projektu).');
    unmeasuredNotesEn.push('Hook score: no measured hook (run project analysis).');
  }
  if (pacingScore === null) {
    unmeasuredNotesSk.push('Tempo: na video stope nie sú aspoň dva zábery.');
    unmeasuredNotesEn.push('Pacing: fewer than two shots on the video track.');
  }
  if (retentionScore === null) {
    unmeasuredNotesSk.push('Udržanie: chýbajú merané pauzy/hooky/CTA.');
    unmeasuredNotesEn.push('Retention: no measured pauses/hooks/CTAs.');
  }
  unmeasuredNotesSk.push('Trend skóre: bez online trendových dát ho nemožno zmerať.');
  unmeasuredNotesEn.push('Trend score: cannot be measured offline without trend data.');

  return {
    overallScore,
    hookScore,
    pacingScore,
    retentionScore,
    trendScore: null,
    measured: measuredScores.length > 0,
    unmeasuredNotesSk,
    unmeasuredNotesEn,
    keyReasons: insights.map(i => i.textSk),
    aiInsights: insights,
    // No invented hashtags or marketing copy: hashtags come from the real transcript keywords,
    // the title is the real project title and the description only states measured facts.
    suggestedHashtags: Array.from(
      new Set(
        (project.transcript?.segments || [])
          .flatMap(segment => segment.text.toLowerCase().match(/[\p{L}\p{N}]{5,}/gu) || [])
          .filter(word => !STOPWORDS.has(word))
      )
    )
      .slice(0, 5)
      .map(word => `#${word.replace(/[^\p{L}\p{N}]/gu, '')}`),
    suggestedTitle: project.title,
    suggestedDescription: insights.length > 0
      ? `${project.title} — ${insights.map(i => i.textSk).join(' ')}`
      : `${project.title} — zatiaľ bez meraných poznatkov (spustite AI analýzu projektu).`,
  };
}

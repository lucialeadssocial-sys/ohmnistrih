import { ProjectModel } from '../types/project';
import {
  DecisionPriority,
  DirectorObjective,
  DirectorPlan,
  DirectorProposedAction,
} from './analysisTypes';
import { buildSmartClips, hasMeasuredAnalysis } from './highlightModel';

/**
 * Professional Director modes.
 *
 * A mode does not invent new edits — it decides which of the measured decisions deserve a place in
 * the plan, and PRO_QUALITY deliberately keeps fewer, stronger interventions ("Professional
 * Portfolio Edit": the result should look hand-cut, not auto-cut).
 *
 * Every rule below is a documented product rule and every dropped decision is reported with its
 * reason, so nothing disappears silently.
 */

export type DirectorMode = 'SOCIAL' | 'ADS' | 'STORY' | 'YOUTUBE' | 'PODCAST' | 'CORPORATE' | 'CUSTOM';
export type DirectorQuality = 'STANDARD' | 'PRO_QUALITY';

export interface DirectorModeConfig {
  id: DirectorMode;
  labelSk: string;
  labelEn: string;
  goalSk: string;
  goalEn: string;
  /** Objectives used when the caller does not pick any. */
  defaultObjectives: DirectorObjective[];
  /** Product rule: how many interventions per minute of material this mode allows. */
  maxDecisionsPerMinute: number;
  /** Product rule: minimum spacing between two decisions of the same kind. */
  minSpacingSeconds: number;
  minConfidence: number;
  /** Kinds this mode prefers — they win the budget race, they are never forced. */
  prefers: DirectorProposedAction['kind'][];
  /** Kinds this mode considers noise — they lose the budget race when it is tight. */
  avoids: DirectorProposedAction['kind'][];
}

export const DIRECTOR_MODES: Record<DirectorMode, DirectorModeConfig> = {
  SOCIAL: {
    id: 'SOCIAL',
    labelSk: 'Social / Short-form (retention-first)',
    labelEn: 'Social / Short-form (retention-first)',
    goalSk: 'Udržať pozornosť: silný hook, dynamické tempo, jasné titulky.',
    goalEn: 'Hold attention: strong hook, dynamic pacing, legible captions.',
    defaultObjectives: ['Retention', 'Short-form'],
    maxDecisionsPerMinute: 6,
    minSpacingSeconds: 5,
    minConfidence: 0.6,
    prefers: ['PUNCH_IN', 'CAPTION_EMPHASIS', 'BROLL_INSERT', 'TRANSITION'],
    avoids: [],
  },
  ADS: {
    id: 'ADS',
    labelSk: 'Reklama / Performance (conversion-first)',
    labelEn: 'Ads / Performance (conversion-first)',
    goalSk: 'Hook → problém → riešenie → dôkaz → CTA, bez hluchých miest.',
    goalEn: 'Hook → problem → solution → proof → CTA, no dead air.',
    defaultObjectives: ['Conversion', 'Advertisement', 'UGC'],
    maxDecisionsPerMinute: 8,
    minSpacingSeconds: 4,
    minConfidence: 0.65,
    prefers: ['CAPTION_EMPHASIS', 'AUDIO_DUCK', 'BROLL_INSERT'],
    avoids: [],
  },
  STORY: {
    id: 'STORY',
    labelSk: 'Story / Cinematic (dramaturgia-first)',
    labelEn: 'Story / Cinematic (narrative-first)',
    goalSk: 'Nechať scénam dýchať, zásahy len tam, kde nesú význam.',
    goalEn: 'Let scenes breathe; intervene only where it carries meaning.',
    defaultObjectives: ['Storytelling', 'Entertainment'],
    maxDecisionsPerMinute: 3,
    minSpacingSeconds: 12,
    minConfidence: 0.7,
    prefers: ['BROLL_INSERT', 'TRANSITION', 'COLOR_BALANCE'],
    avoids: ['PUNCH_IN'],
  },
  YOUTUBE: {
    id: 'YOUTUBE',
    labelSk: 'YouTube / Long-form',
    labelEn: 'YouTube / Long-form',
    goalSk: 'Dlhá kontinuita, kapitoly, B-roll a titulky bez rozbitia tempa.',
    goalEn: 'Long continuity, chapters, B-roll and captions without breaking pace.',
    defaultObjectives: ['YouTube', 'Long-form', 'Education'],
    maxDecisionsPerMinute: 2,
    minSpacingSeconds: 20,
    minConfidence: 0.7,
    prefers: ['BROLL_INSERT', 'CAPTION_EMPHASIS'],
    avoids: ['PUNCH_IN'],
  },
  PODCAST: {
    id: 'PODCAST',
    labelSk: 'Podcast / Talking head',
    labelEn: 'Podcast / Talking head',
    goalSk: 'Čistý a prirodzený strih: ticho a zakopnutia preč, reč nechať plynúť.',
    goalEn: 'Clean, natural cut: remove silence and stumbles, let speech flow.',
    defaultObjectives: ['Long-form', 'Education'],
    maxDecisionsPerMinute: 4,
    minSpacingSeconds: 8,
    minConfidence: 0.6,
    prefers: ['TRIM_RANGE', 'MULTICAM_SWITCH'],
    avoids: ['PUNCH_IN'],
  },
  CORPORATE: {
    id: 'CORPORATE',
    labelSk: 'Corporate / Brand',
    labelEn: 'Corporate / Brand',
    goalSk: 'Čistý profesionálny výsledok a konzistentný vizuál značky.',
    goalEn: 'Clean professional result with consistent brand visuals.',
    defaultObjectives: ['Education', 'Product Demo'],
    maxDecisionsPerMinute: 3,
    minSpacingSeconds: 12,
    minConfidence: 0.7,
    prefers: ['COLOR_BALANCE', 'CAPTION_EMPHASIS', 'AUDIO_DUCK'],
    avoids: [],
  },
  CUSTOM: {
    id: 'CUSTOM',
    labelSk: 'Vlastný režim',
    labelEn: 'Custom mode',
    goalSk: 'Bez dodatočných obmedzení — platia len pravidlá kvality.',
    goalEn: 'No extra constraints — only the quality rules apply.',
    defaultObjectives: [],
    maxDecisionsPerMinute: 10,
    minSpacingSeconds: 3,
    minConfidence: 0.5,
    prefers: [],
    avoids: [],
  },
};

export const QUALITY_RULES: Record<DirectorQuality, { minConfidence: number; maxDecisionsPerMinute: number; noteSk: string; noteEn: string }> = {
  STANDARD: {
    minConfidence: 0.6,
    maxDecisionsPerMinute: 8,
    noteSk: 'Štandardná kvalita: pomocník použije všetky dostatočne isté merané návrhy.',
    noteEn: 'Standard quality: applies every measured proposal with sufficient confidence.',
  },
  PRO_QUALITY: {
    minConfidence: 0.8,
    maxDecisionsPerMinute: 2,
    noteSk: 'Professional Portfolio Edit: menej, ale silnejších zásahov — strih má pôsobiť ručne robený.',
    noteEn: 'Professional Portfolio Edit: fewer, stronger interventions — the cut should look hand-made.',
  },
};

export interface DroppedDecision {
  id: string;
  kind: DirectorProposedAction['kind'] | 'NONE';
  priority: DecisionPriority;
  reasonSk: string;
  reasonEn: string;
}

const PRIORITY_ORDER: Record<DecisionPriority, number> = {
  MUST_CONSIDER: 0,
  RECOMMENDED: 1,
  OPTIONAL: 2,
};

const startOf = (decision: { timelineLocation?: { start: number } }): number | null =>
  typeof decision.timelineLocation?.start === 'number' ? decision.timelineLocation.start : null;

/** Infers the most fitting mode from the target platform (used when the caller does not choose). */
export function inferModeForPlatform(platform: DirectorPlan['targetPlatform']): DirectorMode {
  switch (platform) {
    case 'TikTok':
    case 'Instagram Reels':
    case 'YouTube Shorts':
      return 'SOCIAL';
    case 'UGC Ads':
      return 'ADS';
    case 'YouTube Long-form':
      return 'YOUTUBE';
    default:
      return 'STORY';
  }
}

/**
 * Filters the generated plan according to a mode + quality level.
 *
 * Deterministic and explainable: sorting is priority → mode preference → confidence, and every
 * decision that does not make it into the plan is returned with the rule that removed it.
 */
export function applyDirectorMode(
  plan: DirectorPlan,
  project: ProjectModel,
  mode: DirectorMode,
  quality: DirectorQuality
): { plan: DirectorPlan; dropped: DroppedDecision[] } {
  const config = DIRECTOR_MODES[mode];
  const qualityRule = QUALITY_RULES[quality];

  const minConfidence = Math.max(config.minConfidence, qualityRule.minConfidence);
  const maxPerMinute = Math.min(config.maxDecisionsPerMinute, qualityRule.maxDecisionsPerMinute);

  const videoClips = project.tracks.filter(t => t.type === 'video').flatMap(t => t.clips);
  const duration = videoClips.reduce((max, clip) => {
    const start = clip.timelineStart ?? clip.start ?? 0;
    return Math.max(max, start + clip.duration);
  }, 0);

  const dropped: DroppedDecision[] = [];
  const drop = (
    decision: DirectorPlan['decisions'][number],
    reasonSk: string,
    reasonEn: string
  ) => {
    dropped.push({
      id: decision.id,
      kind: decision.proposedAction?.kind ?? 'NONE',
      priority: decision.priority,
      reasonSk,
      reasonEn,
    });
  };

  // Mode preference changes the ORDER, never the honesty of the output.
  const ordered = plan.decisions
    .map(decision => {
      const kind = decision.proposedAction?.kind;
      const modeBonus = kind && config.prefers.includes(kind) ? -1 : kind && config.avoids.includes(kind) ? 1 : 0;
      return { decision, modeBonus };
    })
    .sort((a, b) => {
      const priority = PRIORITY_ORDER[a.decision.priority] - PRIORITY_ORDER[b.decision.priority];
      if (priority !== 0) return priority;
      if (a.modeBonus !== b.modeBonus) return a.modeBonus - b.modeBonus;
      return b.decision.confidence - a.decision.confidence;
    });

  const kept: DirectorPlan['decisions'] = [];
  const perMinuteCount = new Map<number, number>();
  const lastKeptAtForKind = new Map<string, number>();

  for (const { decision } of ordered) {
    const kind = decision.proposedAction?.kind;
    const anchor = startOf(decision);

    // 0. Guidance is not an intervention: without an executable action (or with MANUAL_ONLY) the
    //    decision changes nothing on the timeline, so it never competes for the mode budget and it
    //    is always kept — this is the "senior editor beside you" layer (Dôvod / Čo sa učíš).
    const isGuidance = !decision.proposedAction || decision.proposedAction.kind === 'MANUAL_ONLY';
    if (isGuidance) {
      kept.push(decision);
      continue;
    }

    // 1. Every decision must be anchored in the real timeline or on a real clip.
    if (anchor === null && !decision.affectedClipId) {
      drop(decision, 'Režim: rozhodnutie nie je ukotvené v timeline ani na klip.', 'Mode: the decision is not anchored in the timeline or on a clip.');
      continue;
    }

    // 2. Confidence floor of mode + quality.
    if (decision.confidence < minConfidence) {
      drop(
        decision,
        `Režim ${mode}/${quality}: istota ${(decision.confidence * 100).toFixed(0)} % je pod prahom ${(minConfidence * 100).toFixed(0)} %.`,
        `Mode ${mode}/${quality}: confidence ${(decision.confidence * 100).toFixed(0)}% is below the ${(minConfidence * 100).toFixed(0)}% floor.`
      );
      continue;
    }

    // 3. Spacing between two decisions of the same kind (no machine-gun edits).
    if (anchor !== null && kind) {
      const last = lastKeptAtForKind.get(kind);
      if (last !== undefined && Math.abs(anchor - last) < config.minSpacingSeconds) {
        drop(
          decision,
          `Režim ${mode}: dva zásahy typu ${kind} bližšie než ${config.minSpacingSeconds}s od seba.`,
          `Mode ${mode}: two ${kind} interventions closer than ${config.minSpacingSeconds}s apart.`
        );
        continue;
      }
    }

    // 4. Budget per minute of material.
    if (duration > 0 && anchor !== null) {
      const minute = Math.floor(anchor / 60);
      const used = perMinuteCount.get(minute) ?? 0;
      if (used >= maxPerMinute) {
        drop(
          decision,
          `Režim ${mode}/${quality}: limit ${maxPerMinute} zásahov na minútu je vyčerpaný.`,
          `Mode ${mode}/${quality}: the ${maxPerMinute} interventions-per-minute limit is used up.`
        );
        continue;
      }
      perMinuteCount.set(minute, used + 1);
    }

    if (anchor !== null && kind) lastKeptAtKindSet(lastKeptAtForKind, kind, anchor);
    kept.push(decision);
  }

  const modeNotesSk = [
    config.goalSk,
    qualityRule.noteSk,
    duration > 0
      ? `Platí: prah istoty ${(minConfidence * 100).toFixed(0)} %, max ${maxPerMinute} zásahov/min, odstup ${config.minSpacingSeconds}s pre rovnaký typ.`
      : 'Bez dĺžky materiálu sa limit na minútu nedá uplatniť — platí iba prah istoty a odstup.',
    `Manuálne návody (MANUAL_ONLY) a vysvetlenia sa nikdy nevyhadzujú — nemenia timeline, takže nekonkurujú limitu zásahov.`,
  ];
  const modeNotesEn = [
    config.goalEn,
    qualityRule.noteEn,
    duration > 0
      ? `Applied: ${(minConfidence * 100).toFixed(0)}% confidence floor, max ${maxPerMinute} interventions/min, ${config.minSpacingSeconds}s spacing for the same kind.`
      : 'Without material duration the per-minute limit cannot apply — only the confidence floor and spacing do.',
    'Manual-only guidance and explanations are never dropped — they do not change the timeline, so they do not compete for the intervention budget.',
  ];

  return {
    plan: { ...plan, decisions: kept, mode, quality, modeNotesSk, modeNotesEn, droppedDecisions: dropped },
    dropped,
  };
}

function lastKeptAtKindSet(map: Map<string, number>, kind: string, at: number): void {
  map.set(kind, at);
}

export interface ReadinessSummary {
  durationSeconds: number;
  clipCount: number;
  analysisMeasured: boolean;
  decisions: number;
  trims: number;
  trimmedSeconds: number;
  punchIns: number;
  captions: number;
  broll: number;
  transitions: number;
  audio: number;
  hooksMeasured: number;
  shortsProposals: number;
  /** ESTIMATE (documented formula), never a measurement. */
  estimatedManualMinutes: number;
  estimateBasisSk: string;
  estimateBasisEn: string;
}

/**
 * RAW → READY summary.
 *
 * Counts and seconds are measured from the project/plan. The manual-time figure is an ESTIMATE with
 * the formula stated next to it (0.5 min per intervention + 4 s per trimmed second + 5 s per clip
 * for organising footage) — it is never presented as a measurement.
 */
export function buildReadinessSummary(project: ProjectModel, plan: DirectorPlan | undefined): ReadinessSummary {
  const videoTracks = project.tracks.filter(t => t.type === 'video');
  const clips = videoTracks.flatMap(t => t.clips);
  const durationSeconds = clips.reduce((max, clip) => {
    const start = clip.timelineStart ?? clip.start ?? 0;
    return Math.max(max, start + clip.duration);
  }, 0);
  const clipCount = project.tracks.reduce((sum, t) => sum + t.clips.length, 0);

  const decisions = plan?.decisions ?? [];
  const byKind = (kind: DirectorProposedAction['kind']) =>
    decisions.filter(d => d.proposedAction?.kind === kind).length;

  const trims = decisions.filter(d => d.proposedAction?.kind === 'TRIM_RANGE');
  const trimmedSeconds = trims.reduce((sum, d) => {
    const start = d.timelineLocation?.start ?? 0;
    const end = d.timelineLocation?.end ?? start;
    return sum + Math.max(0, end - start);
  }, 0);

  const hooksMeasured = (project.analysisResults?.hooks || []).length;
  const shortsProposals = hooksMeasured > 0 ? buildSmartClips(project, 5).length : 0;

  const estimatedManualSeconds =
    decisions.length * 30 + trimmedSeconds * 4 + clipCount * 5;
  const estimatedManualMinutes = Math.round((estimatedManualSeconds / 60) * 10) / 10;

  return {
    durationSeconds: Math.round(durationSeconds * 10) / 10,
    clipCount,
    analysisMeasured: hasMeasuredAnalysis(project),
    decisions: decisions.length,
    trims: trims.length,
    trimmedSeconds: Math.round(trimmedSeconds * 10) / 10,
    punchIns: byKind('PUNCH_IN'),
    captions: byKind('CAPTION_EMPHASIS'),
    broll: byKind('BROLL_INSERT'),
    transitions: byKind('TRANSITION'),
    audio: byKind('AUDIO_DUCK'),
    hooksMeasured,
    shortsProposals,
    estimatedManualMinutes,
    estimateBasisSk: 'Odhad: 0,5 min na zásah + 4 s na skrátenú sekundu + 5 s na klip (organizácia materiálu). Nie je to meranie času.',
    estimateBasisEn: 'Estimate: 0.5 min per intervention + 4 s per trimmed second + 5 s per clip (footage organisation). This is not a measured duration.',
  };
}

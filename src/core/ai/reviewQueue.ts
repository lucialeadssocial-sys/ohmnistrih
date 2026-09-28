import { EditingPreference, ProjectModel } from '../types/project';
import { DirectorDecisionItem, DirectorProposedAction } from './analysisTypes';

/**
 * The Smart Review Queue.
 *
 * Everything in this module is derived from the project's own AI Director plan and from the
 * Editing Brain's observed preferences — there is no canned review item and no invented score.
 * When the project has no plan (or no observations yet) the queue / rule list is simply empty and
 * the UI is expected to say so instead of showing placeholder rows.
 */

export type ReviewCategory =
  | 'CUT'
  | 'CAPTION'
  | 'ZOOM'
  | 'BROLL'
  | 'AUDIO'
  | 'MULTICAM'
  | 'TRANSITION'
  | 'COLOR';

export type ReviewRiskLevel = 'SAFE' | 'MODERATE' | 'CRITICAL';

export interface ReviewQueueItem {
  /** Director plan decision id — the id used to accept/reject this item. */
  id: string;
  kind: DirectorProposedAction['kind'];
  category: ReviewCategory;
  confidence: number;
  riskLevel: ReviewRiskLevel;
  priority: DirectorDecisionItem['priority'];
  titleSk: string;
  titleEn: string;
  whySk: string;
  whyEn: string;
  /** Confidence of the learned preference for this category (undefined = nothing learned yet). */
  patternMatch?: number;
  evidenceCount?: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  /** True when accepting this item can really be applied by the Director executor. */
  executable: boolean;
  timelineLocation?: { start: number; end?: number };
}

export interface LearnedRule {
  id: string;
  ruleSk: string;
  ruleEn: string;
  category: string;
  occurrences: number;
  confidence: number;
  isActive: boolean;
  createdAt: string;
}

/** Review category + Editing Brain preference category of every proposed action kind. */
export const REVIEW_KIND_MAP: Record<
  DirectorProposedAction['kind'],
  { category: ReviewCategory; preference: EditingPreference['category'] | null }
> = {
  PUNCH_IN: { category: 'ZOOM', preference: 'MOTION' },
  TRIM_RANGE: { category: 'CUT', preference: 'PACING' },
  MULTICAM_SWITCH: { category: 'MULTICAM', preference: 'CUTTING' },
  BROLL_INSERT: { category: 'BROLL', preference: 'BROLL' },
  CAPTION_EMPHASIS: { category: 'CAPTION', preference: 'CAPTIONS' },
  AUDIO_DUCK: { category: 'AUDIO', preference: 'AUDIO' },
  COLOR_BALANCE: { category: 'COLOR', preference: 'COLOR' },
  TRANSITION: { category: 'TRANSITION', preference: 'TRANSITIONS' },
  // Education only: nothing to execute and nothing to learn about executed edits.
  MANUAL_ONLY: { category: 'CUT', preference: null },
};

/**
 * Action kinds the Director executor can really apply through canonical commands.
 * Kept in sync with DirectorEngine.applyDecision — anything not listed there is educational and
 * stays a proposal, which the review UI states explicitly.
 */
export const EXECUTABLE_ACTION_KINDS: readonly DirectorProposedAction['kind'][] = [
  'TRIM_RANGE',
  'PUNCH_IN',
  'MULTICAM_SWITCH',
  'TRANSITION',
];

export function isActionExecutable(kind: string): boolean {
  return (EXECUTABLE_ACTION_KINDS as readonly string[]).includes(kind);
}

const CATEGORY_SK: Record<string, string> = {
  PACING: 'Tempo a pauzy',
  CUTTING: 'Strih',
  PAUSES: 'Pauzy',
  BROLL: 'B-roll',
  CAPTIONS: 'Titulky',
  AUDIO: 'Zvuk',
  MUSIC: 'Hudba',
  SFX: 'Zvukové efekty',
  MOTION: 'Pohyb a zoom',
  COLOR: 'Farba',
  TRANSITIONS: 'Prechody',
  STORY: 'Rozprávanie',
  THUMBNAILS: 'Miniatúry',
  EXPORT: 'Export',
};

const CATEGORY_EN: Record<string, string> = {
  PACING: 'Pacing & pauses',
  CUTTING: 'Cutting',
  PAUSES: 'Pauses',
  BROLL: 'B-roll',
  CAPTIONS: 'Captions',
  AUDIO: 'Audio',
  MUSIC: 'Music',
  SFX: 'Sound effects',
  MOTION: 'Motion & zoom',
  COLOR: 'Color',
  TRANSITIONS: 'Transitions',
  STORY: 'Storytelling',
  THUMBNAILS: 'Thumbnails',
  EXPORT: 'Export',
};

const VALUE_SK: Record<string, string> = {
  ACCEPTED: 'prijímané',
  REJECTED: 'zamietané',
  MODIFIED: 'upravované ručne',
  MANUAL: 'robíte manuálne',
};

const VALUE_EN: Record<string, string> = {
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  MODIFIED: 'modified manually',
  MANUAL: 'done manually',
};

const at = (seconds?: number): string =>
  typeof seconds === 'number' && Number.isFinite(seconds) ? `${seconds.toFixed(1)}s` : 'neznámy čas';

/** Slovak title built from the structured action, with the real parameters from the plan. */
function describeActionSk(decision: DirectorDecisionItem): string {
  const start = decision.timelineLocation?.start;
  const action = decision.proposedAction;

  switch (action?.kind) {
    case 'PUNCH_IN': {
      const scale = action.parameters?.scale ?? 115;
      return `Punch-in zoom ${scale}% v čase ${at(start)}`;
    }
    case 'TRIM_RANGE': {
      const target = action.parameters?.targetDurationSeconds ?? 0.4;
      return `Skrátenie pauzy na ${target}s v čase ${at(start)}`;
    }
    case 'MULTICAM_SWITCH':
      return `Rez na druhý uhol kamery v čase ${at(start)}`;
    case 'BROLL_INSERT':
      return `Vloženie B-rollu v čase ${at(start)}`;
    case 'CAPTION_EMPHASIS':
      return `Zvýraznenie titulku v čase ${at(start)}`;
    case 'AUDIO_DUCK':
      return `Stíšenie hudby pod hlas v čase ${at(start)}`;
    case 'COLOR_BALANCE':
      return `Zjednotenie farieb záberu v čase ${at(start)}`;
    case 'TRANSITION':
      return `Prechod na reze v čase ${at(start)}`;
    case 'MANUAL_ONLY':
      return action.parameters?.reason || 'Manuálny krok';
    default:
      // Unknown kind: fall back to the engine's own wording instead of inventing a title.
      return decision.what;
  }
}

/** English title describing the same structured action (the engine's copy itself is Slovak). */
function describeActionEn(decision: DirectorDecisionItem): string {
  const start = decision.timelineLocation?.start;
  const action = decision.proposedAction;

  switch (action?.kind) {
    case 'PUNCH_IN': {
      const scale = action.parameters?.scale ?? 115;
      return `Punch-in zoom ${scale}% at ${at(start)}`;
    }
    case 'TRIM_RANGE': {
      const target = action.parameters?.targetDurationSeconds ?? 0.4;
      return `Trim pause to ${target}s at ${at(start)}`;
    }
    case 'MULTICAM_SWITCH':
      return `Switch to the second camera angle at ${at(start)}`;
    case 'BROLL_INSERT':
      return `Insert B-roll at ${at(start)}`;
    case 'CAPTION_EMPHASIS':
      return `Emphasise the caption at ${at(start)}`;
    case 'AUDIO_DUCK':
      return `Duck the music under the voice at ${at(start)}`;
    case 'COLOR_BALANCE':
      return `Match the shot colour at ${at(start)}`;
    case 'TRANSITION':
      return `Add a transition at the cut at ${at(start)}`;
    case 'MANUAL_ONLY':
      return action.parameters?.reason || 'Manual step';
    default:
      return decision.what;
  }
}

/**
 * Risk level of a review row.
 *
 * Derived from the Director's own priority scale (MUST_CONSIDER / RECOMMENDED / OPTIONAL) — it is
 * a display of how much attention the engine asks for, not a computed probability.
 */
function reviewRisk(decision: DirectorDecisionItem): ReviewRiskLevel {
  if (decision.priority === 'MUST_CONSIDER') return 'CRITICAL';
  if (decision.priority === 'RECOMMENDED') return 'MODERATE';
  return 'SAFE';
}

function reviewStatus(decision: DirectorDecisionItem): ReviewQueueItem['status'] {
  if (decision.status === 'rejected') return 'REJECTED';
  if (decision.status === 'proposed' || decision.status === 'needs-review') return 'PENDING';
  return 'ACCEPTED';
}

/**
 * Builds the review queue from the project's Director plan.
 * Decisions without an executable/structured action and invalidated decisions are excluded.
 */
export function buildReviewQueue(project: ProjectModel): ReviewQueueItem[] {
  const plan = project.directorPlan;
  if (!plan) return [];

  const preferences = project.editingPreferences || [];

  return plan.decisions
    .filter(decision => !!decision.proposedAction && decision.status !== 'invalidated')
    .map(decision => {
      const kind = decision.proposedAction!.kind;
      const mapping = REVIEW_KIND_MAP[kind];
      const preference = mapping?.preference
        ? preferences.find(p => p.category === mapping.preference && p.context === 'PROJECT')
        : undefined;

      return {
        id: decision.id,
        kind,
        category: mapping?.category ?? 'CUT',
        confidence: decision.confidence,
        riskLevel: reviewRisk(decision),
        priority: decision.priority,
        titleSk: describeActionSk(decision),
        titleEn: describeActionEn(decision),
        whySk: decision.why,
        // The engine's prose is Slovak; for the English UI report the real facts behind it.
        whyEn: `Priority ${decision.priority} · confidence ${(decision.confidence * 100).toFixed(0)}%${decision.source ? ` · source: ${decision.source}` : ''}`,
        patternMatch: preference ? Math.round(preference.confidence * 100) : undefined,
        evidenceCount: preference?.evidenceCount,
        status: reviewStatus(decision),
        executable: isActionExecutable(kind),
        timelineLocation: decision.timelineLocation,
      };
    });
}

/** Turns the Editing Brain's observed preferences into readable memory rules. */
export function buildLearnedRules(project: ProjectModel): LearnedRule[] {
  return (project.editingPreferences || [])
    .filter(preference => preference.evidenceCount > 0)
    .slice()
    .sort((a, b) => b.evidenceCount - a.evidenceCount || b.updatedAt - a.updatedAt)
    .map(preference => ({
      id: preference.id,
      category: preference.category,
      ruleSk: `${CATEGORY_SK[preference.category] || preference.category}: AI návrhy ${VALUE_SK[preference.value] || preference.value} — ${preference.evidenceCount}× pozorované, istota ${Math.round(preference.confidence * 100)}%.`,
      ruleEn: `${CATEGORY_EN[preference.category] || preference.category}: proposals ${VALUE_EN[preference.value] || preference.value} — ${preference.evidenceCount} observations, confidence ${Math.round(preference.confidence * 100)}%.`,
      occurrences: preference.evidenceCount,
      confidence: preference.confidence,
      isActive: preference.enabled,
      createdAt: new Date(preference.createdAt).toISOString(),
    }));
}

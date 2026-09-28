/**
 * OmniStrih AI — FÁZA 2E Analysis & Editing Intelligence Types
 * Defines data contracts for non-destructive media & content intelligence.
 */

import type { SubjectSample } from '../vision/subjectTrack';

export type AnalysisType =
  | 'metadata'
  | 'transcript'
  | 'audio'
  | 'silence'
  | 'shots'
  | 'scenes'
  | 'content'
  | 'editing'
  // Extensible future analysis types
  | 'emotion'
  | 'visualQuality'
  | 'brand'
  | 'retention'
  | 'performance';

export type JobStatus = 'queued' | 'running' | 'completed' | 'cancelled' | 'failed';

export interface AnalysisJob {
  id: string;
  projectId: string;
  assetId?: string;
  type: AnalysisType;
  status: JobStatus;
  progress: number; // 0 - 100
  startedAt?: number;
  completedAt?: number;
  error?: string;
  resultReference?: string;
}

export interface PauseItem {
  id: string;
  start: number;
  end: number;
  duration: number;
  type: 'natural_pause' | 'long_pause' | 'hesitation' | 'speech_gap';
  confidence: number;
}

export interface SpeechDensityMetrics {
  wordsPerSecond: number;
  wordsPerMinute: number;
  pauseDensity: number; // 0.0 - 1.0
  informationDensity: 'low' | 'balanced' | 'high';
}

export interface ShotItem {
  id: string;
  start: number;
  end: number;
  confidence: number;
  type?: 'talking_head' | 'wide' | 'close_up' | 'screen' | 'product' | 'broll' | 'unknown';
}

export interface SceneItem {
  id: string;
  start: number;
  end: number;
  shots: ShotItem[];
  topic?: string;
}

export interface ContentStructureSegment {
  start: number;
  end: number;
  text?: string;
  present: boolean;
  type?: string;
}

export interface ContentStructure {
  hook?: ContentStructureSegment;
  setup?: ContentStructureSegment;
  problem?: ContentStructureSegment;
  value?: ContentStructureSegment;
  proof?: ContentStructureSegment;
  solution?: ContentStructureSegment;
  transitions?: ContentStructureSegment[];
  CTA?: ContentStructureSegment;
  ending?: ContentStructureSegment;
}

export interface ContentTypeCandidate {
  type:
    | 'Talking Head'
    | 'UGC'
    | 'Ad'
    | 'Educational'
    | 'Tutorial'
    | 'Podcast'
    | 'Interview'
    | 'Storytelling'
    | 'Vlog'
    | 'Product Demo'
    | 'Corporate'
    | 'Testimonial'
    | 'Gaming'
    | 'Short-form'
    | 'Long-form'
    | 'Unknown';
  confidence: number;
}

export interface HookCandidate {
  id: string;
  start: number;
  end: number;
  type:
    | 'question'
    | 'unexpected_claim'
    | 'problem'
    | 'curiosity_gap'
    | 'number'
    | 'conflict'
    | 'promise'
    | 'visual'
    | 'emotional';
  reason: string;
  confidence: number;
}

export interface CTACandidate {
  id: string;
  start: number;
  end: number;
  type: 'follow' | 'subscribe' | 'comment' | 'buy' | 'visit' | 'download' | 'contact' | 'share';
  text: string;
  confidence: number;
}

export interface BrollOpportunity {
  id: string;
  start: number;
  end: number;
  reason: string;
  suggestedVisualType: 'product' | 'location' | 'illustration' | 'screen_demo' | 'text_callout';
  confidence: number;
}

export interface EditingInsight {
  id: string;
  type:
    | 'StrongHook'
    | 'LongPause'
    | 'TopicChange'
    | 'HighInformationDensity'
    | 'PossibleCut'
    | 'PossibleBroll'
    | 'CTA'
    | 'AudioIssue'
    | 'PacingChange'
    | 'VisualChange';
  start?: number;
  end?: number;
  observation: string;
  implication: string;
  why: string;
  confidence: number;
}

export interface CreativePattern {
  id: string;
  type: 'Trend' | 'Evergreen' | 'Emerging' | 'Saturated';
  platform: 'TikTok' | 'Instagram' | 'YouTube' | 'YouTube Shorts' | 'Facebook' | 'General';
  region: 'GLOBAL' | 'SK' | 'BOTH';
  contentType: string;
  description: string;
  signal: string;
  principle: string;
  confidence: number;
  source: string;
  observedAt: number;
}

export type KnowledgeCategory =
  | 'technical_constraint'
  | 'professional_convention'
  | 'heuristic'
  | 'creative_choice'
  | 'trend_platform_pattern'
  | 'uncertainty';

export type DirectorObjective =
  | 'Retention'
  | 'Education'
  | 'Conversion'
  | 'Storytelling'
  | 'Entertainment'
  | 'Product Demo'
  | 'Personal Brand'
  | 'UGC'
  | 'Advertisement'
  | 'YouTube'
  | 'Short-form'
  | 'Long-form'
  | 'Podcast'
  | 'Corporate'
  | 'Tutorial';

export type DecisionPriority = 'MUST_CONSIDER' | 'RECOMMENDED' | 'OPTIONAL';

/**
 * The concrete, machine-readable edit a decision proposes.
 * Kept separate from the human-readable `what`/`why` text so the executor never has to
 * parse localised copy to know which canonical command to run.
 */
export type DirectorProposedAction =
  | { kind: 'PUNCH_IN'; parameters?: { scale?: number } }
  | { kind: 'TRIM_RANGE'; parameters?: { targetDurationSeconds?: number } }
  | { kind: 'MULTICAM_SWITCH'; parameters?: { angleId?: string } }
  | { kind: 'BROLL_INSERT'; parameters?: { assetId?: string } }
  | { kind: 'CAPTION_EMPHASIS' }
  | { kind: 'AUDIO_DUCK' }
  | { kind: 'COLOR_BALANCE' }
  | { kind: 'TRANSITION'; parameters?: { edge?: 'in' | 'out'; transition?: any } }
  | { kind: 'MANUAL_ONLY'; parameters?: { reason?: string } };

export interface DirectorDecisionItem {
  id: string;
  editDecisionId: string;
  priority: DecisionPriority;
  what: string;
  why: string;
  whenToUse: string;
  whenNotToUse: string;
  howToManual: string[]; // Step-by-step manual workflow
  alternatives: string[];
  confidence: number;
  source: string;
  category: KnowledgeCategory;
  /** Canonical edit this decision proposes. Absent for pure education/awareness items. */
  proposedAction?: DirectorProposedAction;
  affectedClipId?: string;
  timelineLocation?: { start: number; end?: number };
  status: 'proposed' | 'accepted' | 'modified' | 'rejected' | 'applied' | 'needs-review' | 'invalidated';
  dependsOnDecisionIds?: string[];
  conflictReason?: string;
}

export interface DirectorStrategy {
  name: string;
  goal: string;
  approach: string;
  why: string;
  confidence: number;
}

export interface DirectorPlan {
  id: string;
  projectId: string;
  sequenceId?: string;
  title: string;
  targetPlatform: 'TikTok' | 'Instagram Reels' | 'YouTube Shorts' | 'YouTube Long-form' | 'UGC Ads' | 'General';
  targetFormat: '9:16' | '16:9' | '1:1' | '4:5';
  objectives: DirectorObjective[];
  audience: string;
  contentSummary: string;

  strategies: {
    hookStrategy?: DirectorStrategy;
    pacingStrategy?: DirectorStrategy;
    structureStrategy?: DirectorStrategy;
    shotStrategy?: DirectorStrategy;
    brollStrategy?: DirectorStrategy;
    captionStrategy?: DirectorStrategy;
    audioStrategy?: DirectorStrategy;
    musicStrategy?: DirectorStrategy;
    sfxStrategy?: DirectorStrategy;
    transitionStrategy?: DirectorStrategy;
    colorStrategy?: DirectorStrategy;
    motionStrategy?: DirectorStrategy;
    multicamStrategy?: DirectorStrategy;
    ctaStrategy?: DirectorStrategy;
  };

  decisions: DirectorDecisionItem[];
  analysisReferences: string[];
  insightReferences: string[];
  knowledgeReferences: string[];

  confidence: number;
  unresolvedAmbiguities: string[];

  createdAt: number;
  analysisVersion: number;
  directorVersion: number;

  /** Professional mode + quality level the plan was filtered with (see ai/directorModes.ts). */
  mode?: 'SOCIAL' | 'ADS' | 'STORY' | 'YOUTUBE' | 'PODCAST' | 'CORPORATE' | 'CUSTOM';
  quality?: 'STANDARD' | 'PRO_QUALITY';
  modeNotesSk?: string[];
  modeNotesEn?: string[];
  /** Decisions that the mode/quality rules removed, each with the rule that removed it. */
  droppedDecisions?: { id: string; kind: string; priority: DecisionPriority; reasonSk: string; reasonEn: string }[];
}

export interface TeachMeExplanation {
  topic: string;
  principle: string;
  context: string;
  explanation: string;
  why: string;
  whenToUse: string;
  whenNotToUse: string;
  example: string;
  antiPattern: string;
  source: string;
  sourceType: 'academic' | 'industry_standard' | 'editorial_guideline' | 'platform_best_practice';
  region: 'GLOBAL' | 'SK' | 'BOTH';
  platformTarget: string;
  confidence: number;
  category?: KnowledgeCategory;
  manualWorkflowSteps?: string[];
  alternativeChoices?: string[];
}

export interface AnalysisResultCollection {
  assetId?: string;
  projectId: string;
  timestamp: number;
  pauses?: PauseItem[];
  speechDensity?: SpeechDensityMetrics;
  shots?: ShotItem[];
  scenes?: SceneItem[];
  contentTypes?: ContentTypeCandidate[];
  contentStructure?: ContentStructure;
  hooks?: HookCandidate[];
  ctas?: CTACandidate[];
  brollOpportunities?: BrollOpportunity[];
  insights?: EditingInsight[];
  /**
   * Measured subject positions from a real face detector (see core/vision/subjectTrack.ts).
   * Empty or absent means nothing was measured — the reframe then stays centred.
   */
  subjectTrack?: SubjectSample[];
}

export interface EditComparison {
  metric: string;
  userChoice: string;
  aiProposal: string;
  explanation: string;
  learningTip: string;
}

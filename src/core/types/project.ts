/**
 * Core Data Models for OmniStrih V3 Video Editor
 * Strictly serializable, non-destructive, immutable project schemas.
 */

// Style Studio (krok 1–3): doplnkový detail vizuálneho rozhodnutia.
// Import je **len typ** — nevzniká runtime závislosť ani druhý model.
import type { StyleDecisionDetail } from "../style/styleDecisionTypes";

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5' | '21:9';
export type TrackType = 'video' | 'b-roll' | 'audio' | 'sfx' | 'caption' | 'adjustment';
export type ClipType = 'video' | 'audio' | 'image' | 'text' | 'b-roll' | 'caption' | 'adjustment';

export type KeyframeParameter =
  | 'scale' | 'scaleX' | 'scaleY' | 'opacity' | 'volume' | 'pan'
  | 'positionX' | 'positionY' | 'rotation' | 'anchorX' | 'anchorY'
  | 'exposure' | 'brightness' | 'contrast' | 'saturation' | 'temperature' | 'tint';

export type EasingFunction = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'hold';

export interface Keyframe {
  id: string;
  timeOffset: number;
  parameter: KeyframeParameter;
  value: number;
  easing?: EasingFunction;
}

export interface ColorCorrectionConfig {
  exposure: number; brightness: number; contrast: number; saturation: number;
  temperature: number; tint: number; highlights: number; shadows: number;
  whites: number; blacks: number; lutPreset?: string; lutIntensity?: number;
}

export interface LearningExplanationModel {
  what: string; why: string; when: string; how: string; category: string;
}

/**
 * Časovanie jedného slova v titulku — **relatívne k začiatku klipu** (klip sa dá
 * presúvať po osi, takže absolútny čas by po presune klamal). Vzniká z reálneho
 * prepisu; keď chýba, nič sa nedomýšľa a zvýrazňovanie sa vypne.
 */
export interface TextWordTiming {
  word: string;
  start: number;
  end: number;
}

export interface TextConfig {
  content: string; fontFamily: string; fontSize: number; color: string;
  backgroundColor?: string; strokeColor?: string; strokeWidth?: number;
  textAlign: 'left' | 'center' | 'right'; fontWeight?: 'normal' | 'bold' | '800';
  lineHeight?: number;
  /**
   * Časovanie slov z prepisu (relatívne k začiatku klipu). Keď je prítomné,
   * náhľad zvýrazní hovorené slovo a vypálenie titulkov zvýrazňuje po slovách.
   */
  words?: TextWordTiming[];
}

export interface MaskConfig {
  type: 'NONE' | 'RECTANGLE' | 'CIRCLE' | 'LINEAR';
  feather: number; size: number; positionX?: number; positionY?: number;
}

export interface CropConfig {
  top: number; bottom: number; left: number; right: number;
}

export interface TransformConfig {
  scale: number; positionX: number; positionY: number; rotation: number; opacity: number;
}

export interface TransitionConfig {
  /**
   * Typ prechodu. Prvá časť je pôvodný canonical slovník; druhá časť (krok 25)
   * sú typy, ktoré používa rozhranie „Prechody“ a ktoré vieme vykresliť do
   * videa cez ffmpeg `xfade`. Kinematické efekty (glitch, otras kamery…) tu
   * zámerne NIE sú — tie sa vykresliť nedajú a appka to povie.
   */
  type:
    | 'cut' | 'fade' | 'crossfade' | 'dissolve' | 'wipeLeft' | 'wipeRight' | 'zoomIn' | 'zoomOut' | 'slideLeft' | 'slideRight'
    | 'slide_up' | 'slide_down' | 'slide_up_left' | 'flash_white' | 'flash_black' | 'iris_circle' | 'film_burn';
  duration: number;
}

export interface ClipTransitions { in?: TransitionConfig; out?: TransitionConfig; }
export interface ClipEffect { id: string; type: string; enabled: boolean; params: Record<string, any>; }

export interface MarkerModel {
  id: string; time: number; label: string; color?: string; notes?: string;
  category?: 'comment' | 'chapter' | 'todo' | 'cut' | 'review' | 'ai_suggestion';
  type?: 'comment' | 'todo' | 'chapter' | 'review' | 'ai_suggestion';
  clipId?: string; completed?: boolean; author?: string;
}

export interface ProjectNote {
  id: string; title: string; content: string;
  category: 'idea' | 'script' | 'feedback' | 'ai_insight';
  timecode?: number; createdAt: number; updatedAt: number;
}

/**
 * Druh zásahu. Prvé hodnoty sú pôvodné; `talking_head | typography | motion |
 * composition` pridalo Style Studio (krok 1–3) — je to **ten istý záznam**,
 * len iný druh zásahu, aby nevznikol druhý model rozhodnutí.
 */
export type EditDecisionType =
  | 'cut'
  | 'b_roll'
  | 'audio_duck'
  | 'transition'
  | 'pacing'
  | 'color'
  | 'talking_head'
  | 'typography'
  | 'motion'
  | 'composition';

export interface EditDecision {
  id: string; timestamp: number;
  type: EditDecisionType;
  reason: string; alternatives?: string[]; impact: string;
  status: 'proposed' | 'accepted' | 'rejected' | 'applied';
  learningNote?: string; clipId?: string; actionPayload?: Record<string, any>;
  /**
   * Style Studio: WHAT / WHEN / WHY / WHEN NOT / ALTERNATIVE / CONFIDENCE.
   * Nepovinné — existujúce rozhodnutia (cut, b_roll…) fungujú presne ako predtým.
   */
  style?: StyleDecisionDetail;
}

export interface ReviewComment {
  id: string; timecode: number; text: string;
  author: 'user' | 'ai_director' | 'client';
  status: 'open' | 'resolved'; clipId?: string; createdAt: number;
}

export interface ReviewState {
  status: 'draft' | 'in_review' | 'changes_requested' | 'approved';
  comments: ReviewComment[]; lockedForExport?: boolean;
}

export interface ProjectVersion {
  id: string; versionNumber: number; label: string; createdAt: number;
  description: string; snapshot: Partial<ProjectModel>;
}

export interface ExportPreset {
  id: string; name: string; format: 'mp4' | 'webm' | 'prores' | 'audio_only';
  resolution: { width: number; height: number }; fps: number;
  bitrateKbps: number; codec: string;
  presetType: 'youtube' | 'tiktok' | 'instagram_reels' | 'broadcast' | 'archive' | 'custom';
}

export interface LearningRecord {
  id: string; topic: string; timestamp: number;
  masteryLevel: 'beginner' | 'intermediate' | 'pro';
  explanationViewed: boolean; actionTaken: string;
}

export interface TranscriptWord {
  id: string; start: number; end: number; text: string; confidence?: number;
}

export interface TranscriptSegment {
  id: string; start: number; end: number; text: string; speaker?: string; words?: TranscriptWord[];
}

export interface TranscriptModel {
  id: string; language?: string; segments: TranscriptSegment[];
}

export type CaptionPresetStyle = 'clean' | 'bold' | 'social' | 'minimal' | 'kinetic';

export interface CaptionStyleConfig {
  font: string; fontSize: number; color: string; backgroundColor?: string;
  outlineColor?: string; outlineWidth?: number; alignment: 'left' | 'center' | 'right';
  position: 'top' | 'middle' | 'bottom'; maxCharsPerLine: number;
  maxLines: number; uppercase?: boolean; preset: CaptionPresetStyle;
}

export interface EQConfig {
  enabled: boolean;
  lowShelf: { freq: number; gain: number };
  mid: { freq: number; gain: number; q: number };
  highShelf: { freq: number; gain: number };
  bypass: boolean;
}

export interface CompressionConfig {
  enabled: boolean;
  threshold: number; ratio: number; attack: number;
  release: number; makeupGain: number; bypass: boolean;
}

export interface DeEsserConfig {
  enabled: boolean; threshold: number; freq: number; bypass: boolean;
}

export interface NoiseReductionConfig {
  enabled: boolean; strength: 'LIGHT' | 'MEDIUM' | 'STRONG'; bypass: boolean;
}

export interface HistogramData { luminance: number[]; r: number[]; g: number[]; b: number[]; }
export interface WaveformData { rows: number[][]; }

export interface MulticamAngle {
  id: string;
  assetId: string;
  name: string;
  offset: number; // Offset relative to the group start
}

export interface MulticamGroup {
  id: string;
  name: string;
  angles: MulticamAngle[];
  syncMethod: 'waveform' | 'timecode' | 'manual';
}

export interface ClipModel {
  id: string; trackId: string; assetId?: string; type: ClipType; name: string;
  sourceStart: number; sourceEnd: number; timelineStart: number; duration: number;
  start: number; offset: number;
  speed: number; volume: number; pan?: number; muted?: boolean;
  gain?: number; fadeIn?: number; fadeOut?: number; crossfade?: number;
  scale: number; scaleX?: number; scaleY?: number; opacity: number;
  positionX: number; positionY: number; rotation: number;
  anchorX?: number; anchorY?: number;
  crop?: CropConfig; transform?: TransformConfig;
  colorCorrection?: ColorCorrectionConfig;
  learningMeta?: LearningExplanationModel;
  effects?: ClipEffect[];
  transitions?: ClipTransitions;
  linkedClipId?: string; linkedGroupId?: string;
  filter?: 'NONE' | 'TEAL_ORANGE' | 'CINEMATIC' | 'VINTAGE' | 'BW' | 'WARM' | 'COOL';
  textConfig?: TextConfig; maskConfig?: MaskConfig; captionStyle?: CaptionStyleConfig;
  keyframes: Keyframe[];
  multicamGroupId?: string;
  multicamAngleId?: string;
  audioEffects?: {
    eq?: EQConfig; compression?: CompressionConfig;
    deEsser?: DeEsserConfig; noiseReduction?: NoiseReductionConfig;
  };
  colorAnalysis?: {
    histogram?: HistogramData; waveform?: WaveformData; lastAnalyzedAt: number;
  };
}

export interface TrackModel {
  id: string; type: TrackType; name: string; order: number;
  muted: boolean; locked: boolean; visible: boolean; solo?: boolean;
  gain?: number; pan?: number; clips: ClipModel[];
}

export interface SequenceModel {
  id: string; name: string; duration: number;
  videoTracks: TrackModel[]; audioTracks: TrackModel[];
  markers?: MarkerModel[]; inPoint?: number | null; outPoint?: number | null;
}

export interface MediaAsset {
  id: string; assetId?: string; projectId?: string; name: string;
  originalName?: string; displayName?: string; type: 'video' | 'audio' | 'image';
  opfsPath: string; url?: string; size: number; mimeType: string; duration: number;
  width: number; height: number; fps: number; videoCodec?: string; audioCodec?: string;
  sampleRate?: number; channels?: number; waveformData?: number[];
  sourceLocation?: string; storageType?: 'OPFS' | 'LOCAL' | 'REMOTE';
  mediaVersion?: number; proxyState?: 'NONE' | 'GENERATING' | 'READY' | 'ERROR';
  proxyAssetId?: string; thumbnailState?: 'NONE' | 'GENERATING' | 'READY' | 'ERROR';
  waveformState?: 'NONE' | 'GENERATING' | 'READY' | 'ERROR';
  analysisState?: 'NONE' | 'GENERATING' | 'READY' | 'ERROR';
  onlineState?: 'ONLINE' | 'OFFLINE' | 'MISSING' | 'IMPORTING' | 'PROCESSING' | 'PROXY_AVAILABLE' | 'PROXY_ONLY' | 'ERROR';
  status?: 'ONLINE' | 'OFFLINE' | 'MISSING' | 'IMPORTING' | 'PROCESSING' | 'PROXY_AVAILABLE' | 'PROXY_ONLY' | 'ERROR';
  lastVerifiedAt?: number; createdAt: number; updatedAt?: number;
  inPoint?: number | null; outPoint?: number | null;
}

import { AnalysisResultCollection, DirectorPlan } from '../ai/analysisTypes';

export interface ProjectSettings {
  aspectRatio: AspectRatio; width: number; height: number;
  fps: number; backgroundColor: string; sampleRate: number;
}

export interface BrandKit {
  id: string; name: string; logoUrl?: string;
  colors: { primary: string; secondary: string; accent: string };
  typography: { heading: string; body: string };
  captionStyle: CaptionStyleConfig;
  ctaStyle: { backgroundColor: string; textColor: string };
}

export type ProjectStatus = 'DRAFT' | 'EDITING' | 'INTERNAL_REVIEW' | 'CLIENT_REVIEW' | 'REVISION' | 'APPROVED' | 'EXPORTED' | 'DELIVERED' | 'ARCHIVED';

export interface ProductionMetadata {
  clientName: string; projectType: string; deadline: number;
  status: ProjectStatus; brandKitId?: string;
  notes: { internal: string[]; client: string[] };
}

export interface EditingPreference {
  id: string;
  category: 'PACING' | 'CUTTING' | 'PAUSES' | 'BROLL' | 'CAPTIONS' | 'AUDIO' | 'MUSIC' | 'SFX' | 'MOTION' | 'COLOR' | 'TRANSITIONS' | 'STORY' | 'THUMBNAILS' | 'EXPORT';
  value: string; confidence: number; evidenceCount: number;
  context: 'GLOBAL' | 'PROJECT' | 'PLATFORM' | 'BRAND';
  source: 'OBSERVED' | 'CONFIRMED' | 'LEARNED_PRINCIPLE';
  createdAt: number; updatedAt: number; enabled: boolean; notes?: string;
}

export interface ProjectModel {
  id: string; version: number; title: string; production?: ProductionMetadata;
  createdAt: number; updatedAt: number; settings: ProjectSettings;
  tracks: TrackModel[]; sequence?: SequenceModel; assets: MediaAsset[];
  playheadTime: number; markers?: MarkerModel[]; inPoint?: number | null;
  outPoint?: number | null; transcript?: TranscriptModel; notes?: ProjectNote[];
  editDecisions?: EditDecision[]; reviewState?: ReviewState;
  versions?: ProjectVersion[]; exportPresets?: ExportPreset[];
  learningHistory?: LearningRecord[];
  autosaveState?: { status: 'saved' | 'saving' | 'dirty' | 'error'; lastSavedAt?: number };
  analysisResults?: AnalysisResultCollection;
  directorPlan?: DirectorPlan;
  editingPreferences?: EditingPreference[];
  multicamGroups?: MulticamGroup[];
}

export function createCanonicalClip(clip: Partial<ClipModel> & { id: string; trackId: string; name: string; type: ClipType }): ClipModel {
  const speed = clip.speed ?? 1.0;
  const timelineStart = clip.timelineStart ?? clip.start ?? 0;
  const sourceStart = clip.sourceStart ?? clip.offset ?? 0;
  let duration = clip.duration;
  let sourceEnd = clip.sourceEnd;

  if (duration !== undefined && duration > 0) {
    if (sourceEnd === undefined) sourceEnd = sourceStart + (duration * speed);
  } else if (sourceEnd !== undefined && sourceEnd > sourceStart) {
    duration = (sourceEnd - sourceStart) / speed;
  } else {
    duration = 5.0;
    sourceEnd = sourceStart + (duration * speed);
  }

  return {
    id: clip.id, trackId: clip.trackId, assetId: clip.assetId,
    type: clip.type, name: clip.name, sourceStart, sourceEnd,
    timelineStart, duration, start: timelineStart, offset: sourceStart,
    speed, volume: clip.volume ?? 100, pan: clip.pan ?? 0,
    muted: clip.muted ?? false, gain: clip.gain ?? 1.0,
    fadeIn: clip.fadeIn ?? 0, fadeOut: clip.fadeOut ?? 0,
    crossfade: clip.crossfade ?? 0, scale: clip.scale ?? 100,
    scaleX: clip.scaleX ?? 1.0, scaleY: clip.scaleY ?? 1.0,
    opacity: clip.opacity ?? 100, positionX: clip.positionX ?? 0,
    positionY: clip.positionY ?? 0, rotation: clip.rotation ?? 0,
    anchorX: clip.anchorX ?? 0.5, anchorY: clip.anchorY ?? 0.5,
    crop: clip.crop,
    transform: clip.transform ?? {
      scale: clip.scale ?? 100, positionX: clip.positionX ?? 0,
      positionY: clip.positionY ?? 0, rotation: clip.rotation ?? 0,
      opacity: clip.opacity ?? 100,
    },
    colorCorrection: clip.colorCorrection ?? {
      exposure: 0, brightness: 0, contrast: 0, saturation: 100,
      temperature: 6500, tint: 0, highlights: 0, shadows: 0,
      whites: 0, blacks: 0, lutIntensity: 0
    },
    learningMeta: clip.learningMeta,
    effects: clip.effects ?? [], transitions: clip.transitions,
    linkedClipId: clip.linkedClipId, filter: clip.filter ?? 'NONE',
    textConfig: clip.textConfig, maskConfig: clip.maskConfig,
    captionStyle: clip.captionStyle, keyframes: clip.keyframes ?? [],
    multicamGroupId: clip.multicamGroupId,
    multicamAngleId: clip.multicamAngleId
  };
}

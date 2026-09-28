export type SelectionType = 
  | 'NONE' 
  | 'PROJECT' 
  | 'VIDEO_CLIP' 
  | 'AUDIO_CLIP' 
  | 'CAPTION' 
  | 'BROLL' 
  | 'IMAGE' 
  | 'VISUAL_ELEMENT' 
  | 'EFFECT' 
  | 'TRANSITION' 
  | 'TIME_RANGE';

export type ToolCategory = 
  | "EDIT"
  | "CLEANUP"
  | "VIDEO"
  | "VISUAL"
  | "COLOR"
  | "AUDIO"
  | "CAPTIONS"
  | "B-ROLL"
  | "AI"
  | "PRIVACY"
  | "SOCIAL"
  | "AUTO"
  | "EXPORT"
  | "QC"
  | "ALL";

export type ToolActionType = 
  | "OPEN_TOOL"
  | "OPEN_PANEL"
  | "EXECUTE_ACTION"
  | "NAVIGATE"
  | "OPEN_INSPECTOR";

export interface ToolDefinition {
  id: string;
  nameSk: string;
  nameEn: string;
  descSk: string;
  descEn: string;
  category: ToolCategory;
  icon: any;
  availability: "LOCAL" | "FREE" | "AI PROVIDER" | "REQUIRES API" | "NOT AVAILABLE";
  confidence?: number;
  classification?: "deterministic" | "AI";
  rationaleSk?: string;
  rationaleEn?: string;
  codeVerified?: boolean;
  runtimeVerified?: boolean;
  edlVerified?: boolean;
  renderVerified?: boolean;
  outputVerified?: boolean;
  status?: "VERIFIED" | "PARTIAL" | "FAILED" | "NOT VERIFIED" | "NOT APPLICABLE";
  keywords?: string[];
  shortcut?: string;
  requiresSelection?: boolean;
  availableOn?: SelectionType[];
  actionType?: ToolActionType;
  tabId?: string; // If action is to switch tab
  whyAvailableSk?: string;
  whyAvailableEn?: string;
}

export interface MediaReference {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  sourceType: "local" | "remote";
  objectUrl?: string;
  status: "registering" | "ready" | "processing" | "error";
}

export type VideoAspectRatio = "9:16" | "16:9" | "1:1" | "4:5";

export interface Suggestion {
  id: string;
  type: "CUT" | "CAPTION" | "BROLL" | "AUDIO";
  descriptionSk: string;
  descriptionEn: string;
  confidence: number;
  rationale: { action: string; reason: string };
  status: "pending" | "applied" | "rejected";
  appliedAt?: string;
}

export type AIBudgetMode = "FREE" | "FREE_ONLY" | "ECONOMY" | "BALANCED" | "QUALITY" | "BEST_QUALITY" | "MAXIMUM";

export type PipelineStepType = 
  | "IMPORT" 
  | "LOCAL_ANALYSIS" 
  | "TRANSCRIPTION" 
  | "AI_ANALYSIS" 
  | "STORY" 
  | "JUMP_CUT" 
  | "AUDIO" 
  | "CAPTIONS" 
  | "BROLL" 
  | "ZOOMS" 
  | "REFRAME" 
  | "QC" 
  | "HUMAN_REVIEW";

export interface PipelineStep {
  type: PipelineStepType;
  status: "pending" | "running" | "completed" | "failed" | "waiting_for_human";
  priority: "P0" | "P1" | "P2" | "P3";
  result?: any;
}

export interface Pipeline {
  id: string;
  projectId: string;
  steps: PipelineStep[];
  currentStepIndex: number;
}

export type AIProvider = "GEMINI_FLASH" | "GEMINI_PRO" | "LOCAL" | "MANUAL";

export interface AIResourceState {
  provider: AIProvider;
  status: "available" | "limited" | "unavailable";
  requestsUsed: number;
  requestLimit: number;
  tokensUsed: number;
  tokenLimit: number;
}

export interface AIRoutingDecision {
  provider: AIProvider;
  reason: string;
  isCached?: boolean;
  credentialId?: string;
  model?: string;
  quotaScope?: QuotaScope;
  isSharedQuota?: boolean;
}

export interface Command {
  id: string;
  type: string;
  execute: () => void;
  undo: () => void;
  timestamp: string;
}

export interface WordTiming {
  word: string;
  start: number; // in seconds
  end: number;
  highlight?: boolean; // Submagic colored emphasis
}

export interface CaptionSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  emoji?: string;
  words: WordTiming[];
}

export type CaptionStyle =
  | "HORMOZI"       // Viral high-impact with keyword emphasis
  | "MINIMAL_CLEAN" // Modern, readable, elegant
  | "CINEMATIC"     // Film-style, subtle animations
  | "SOCIAL_POP"    // Dynamic, bouncy, colorful
  | "COLLAGE"       // Torn-paper, tactile, scrapbook
  | "CUSTOM"        // User-defined
  | "submagic-viral"
  | "omnistrih-torn-paper"
  | "hormozi-punch"
  | "mrbeast-pop"
  | "cyber-neon"
  | "clean-minimal";

export type CaptionEmphasisType = 
  | "KEYWORD" 
  | "NUMBER" 
  | "EMOTION" 
  | "CONTRAST" 
  | "QUESTION" 
  | "WARNING" 
  | "RESULT" 
  | "CTA";

export type CaptionAnimation = 
  | "FADE" 
  | "POP" 
  | "BOUNCE" 
  | "SCALE" 
  | "SLIDE_UP" 
  | "SLIDE_DOWN" 
  | "WORD_HIGHLIGHT" 
  | "TYPE_ON" 
  | "NONE";

export interface WordTiming {
  word: string;
  start: number; // in seconds
  end: number;
  confidence?: number;
  speaker?: string;
  emphasis?: CaptionEmphasisType;
  color?: string;
}

export interface CaptionSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  words: WordTiming[];
  emoji?: string;
  style?: CaptionStyle;
  position?: { x: number; y: number; anchor: "top" | "center" | "bottom" | "auto" };
  animation?: CaptionAnimation;
  isLocked?: boolean;
  confidence?: number;
}

export interface CaptionProject {
  id: string;
  sourceVideoId: string;
  language: "sk" | "en" | "mixed";
  translatedLanguage?: "sk" | "en";
  segments: CaptionSegment[];
  globalStyle: {
    fontFamily: string;
    fontSize: number;
    color: string;
    outlineColor: string;
    outlineWidth: number;
    shadowEnabled: boolean;
    backgroundColor: string;
    backgroundOpacity: number;
    borderRadius: number;
    animation: CaptionAnimation;
    style: CaptionStyle;
    position: "top" | "center" | "bottom" | "auto";
    wordsPerCaption: number | "auto";
    maxLines: number;
    case: "uppercase" | "normal" | "capitalize";
  };
  qualityChecks: {
    id: string;
    type: "ERROR" | "WARNING" | "OK";
    messageSk: string;
    messageEn: string;
    segmentId?: string;
  }[];
}

export type BRollSource = "STOCK" | "AI_GENERATED" | "SCREENSHOT" | "GRAPHIC" | "ZOOM_FX" | "USER_UPLOAD";

export interface BRollItem {
  id: string;
  start: number;
  end: number;
  type: BRollSource;
  titleSk: string;
  titleEn: string;
  promptSk?: string;
  promptEn?: string;
  status: "SUGGESTED" | "APPROVED" | "REJECTED";
  thumbnail?: string;
  reasonSk: string;
  reasonEn: string;
  keywords?: string[];
  sourceSentenceSk?: string;
  sourceSentenceEn?: string;
}

export interface BrollProject {
  id: string;
  sourceVideoId: string;
  items: BRollItem[];
  isApplied: boolean;
  density: "Subtle" | "Balanced" | "Dynamic";
  isAnalyzed: boolean;
}

export type TranslationMode = "LITERAL" | "NATURAL";

export interface TranslatedSegment {
  id: string;
  sourceId: string; // Original segment ID
  text: string;
  timingAdjusted: boolean;
  lipSyncConfidence: number;
}

export interface VoiceoverSettings {
  id: string;
  language: "sk" | "en";
  voiceId: string;
  pitch: number;
  speed: number;
  emotion: "neutral" | "excited" | "serious" | "friendly";
  isGenerated: boolean;
}

export interface BilingualProject {
  id: string;
  sourceLanguage: "sk" | "en";
  targetLanguage: "sk" | "en";
  mode: TranslationMode;
  translatedTranscript: TranslatedSegment[];
  voiceover: VoiceoverSettings;
  isSynced: boolean;
  accuracyScore: number;
}

export type AudioPreset = "PODCAST" | "YOUTUBE" | "TIKTOK" | "REEL" | "CINEMATIC" | "VOICEOVER";

export interface AudioProcessingSettings {
  noiseRemoval: number; // 0-100
  echoRemoval: number;
  humRemoval: number;
  voiceEnhancement: number;
  loudnessNormalization: boolean;
  breathControl: number;
  clippingRepair: boolean;
  musicDucking: {
    enabled: boolean;
    strength: number;
  };
  mix: {
    voice: number;
    music: number;
    sfx: number;
  };
  preset: AudioPreset;
}

export interface AudioProject {
  id: string;
  sourceVideoId: string;
  settings: AudioProcessingSettings;
  isProcessed: boolean;
  artifactsRemoved: {
    breaths: number;
    clicks: number;
    backgroundNoiseDb: number;
  };
}

export interface BeatMarker {
  id: string;
  time: number;
  intensity: number; // 0-1
  type: "KICK" | "SNARE" | "DROP" | "TRANSITION";
}

export interface BeatSyncSettings {
  snapIntensity: number; // 0-100
  autoZoomOnBeat: boolean;
  autoSFXOnBeat: boolean;
  syncTransitions: boolean;
}

export interface BeatSyncProject {
  id: string;
  sourceVideoId: string;
  musicTrackId: string;
  bpm: number;
  markers: BeatMarker[];
  settings: BeatSyncSettings;
  isAnalyzed: boolean;
  lastSyncedAt?: string;
}

export type AttentionObjectType = "FACE" | "PRODUCT" | "TEXT" | "SCREEN" | "GESTURE" | "OTHER";

export interface AttentionPoint {
  id: string;
  time: number;
  type: AttentionObjectType;
  confidence: number;
  box: { x: number; y: number; width: number; height: number };
  labelSk: string;
  labelEn: string;
}

export interface AttentionSuggestion {
  id: string;
  startTime: number;
  endTime: number;
  type: "CROP" | "ZOOM" | "PAN" | "HIGHLIGHT" | "BLUR_BG";
  targetId: string; // ID of the AttentionPoint
  descriptionSk: string;
  descriptionEn: string;
  applied: boolean;
}

export interface VisualAttentionProject {
  id: string;
  sourceVideoId: string;
  points: AttentionPoint[];
  suggestions: AttentionSuggestion[];
  isAnalyzed: boolean;
  heatmapEnabled: boolean;
}

export interface SmartCleanupMask {
  id: string;
  target: "MICROPHONE" | "TRIPOD" | "PEOPLE" | "WATERMARK" | "SUBTITLES" | "FACE" | "LICENSE_PLATE" | "OBJECT" | "BACKGROUND";
  mode: "ERASE" | "BLUR";
  startTime: number;
  endTime: number;
  isTracking: boolean;
  confidence: number;
  box?: { x: number; y: number; width: number; height: number };
  points?: { x: number; y: number }[];
  status: "DETECTED" | "CLEANED" | "FAILED";
}

export interface SmartCleanupProject {
  id: string;
  sourceVideoId: string;
  masks: SmartCleanupMask[];
  isAnalyzed: boolean;
  globalSettings: {
    blurIntensity: number;
    inpaintingQuality: "NORMAL" | "HIGH";
  };
}

export type ExportPlatform = "YOUTUBE" | "TIKTOK" | "REELS" | "SHORTS" | "FACEBOOK" | "INSTAGRAM" | "LINKEDIN";
export type ExportAspectRatio = "16:9" | "9:16" | "1:1" | "4:5";

export interface PlatformExportConfig {
  id: string;
  platform: ExportPlatform;
  aspectRatio: ExportAspectRatio;
  isEnabled: boolean;
  aiCompositionEnabled: boolean; // Smart reframing
  quality: "1080p" | "4K";
  status: "PENDING" | "PROCESSING" | "PAUSED" | "COMPLETED" | "FAILED";
  progress: number;
  isPaused?: boolean;
  estimatedSecondsRemaining?: number;
}

export interface MultiExportProject {
  id: string;
  sourceVideoId: string;
  configs: PlatformExportConfig[];
  isExporting: boolean;
}

export interface SocialAsset {
  id: string;
  platform: "TIKTOK" | "REELS" | "SHORTS" | "LINKEDIN" | "TWITTER";
  type: "VIDEO" | "POST" | "THREAD";
  titleSk: string;
  titleEn: string;
  contentSk: string;
  contentEn: string;
  hashtags: string[];
  ctaSk: string;
  ctaEn: string;
}

export interface ContentClip {
  id: string;
  startTime: number;
  endTime: number;
  hookSk: string;
  hookEn: string;
  viralityScore: number;
  platformOptimized: ExportPlatform[];
}

export interface ContentPack {
  id: string;
  sourceVideoId: string;
  clips: ContentClip[];
  assets: SocialAsset[];
  marketingData: {
    ytTitleSk: string;
    ytTitleEn: string;
    ytDescriptionSk: string;
    ytDescriptionEn: string;
    thumbnailTextSk: string;
    thumbnailTextEn: string;
  };
  isGenerated: boolean;
}

export interface RetentionSegment {
  id: string;
  startTime: number;
  endTime: number;
  type: "STRONG" | "LOW_DENSITY" | "LONG_PAUSE" | "STRONG_PAYOFF" | "REPETITIVE" | "MONOTONE";
  labelSk: string;
  labelEn: string;
  score: number; // 0-100
}

export interface RetentionProject {
  id: string;
  sourceVideoId: string;
  segments: RetentionSegment[];
  overallScore: number;
  isAnalyzed: boolean;
}

export interface ABVersion {
  id: string;
  name: string;
  descriptionSk: string;
  descriptionEn: string;
  style: "FAST_CUTS" | "NATURAL" | "HEAVY_CAPTIONS" | "MINIMALIST" | "CINEMATIC";
  status: "READY" | "GENERATING" | "COMPLETED";
  previewUrl?: string;
  metrics?: {
    estimatedRetention: number;
    pacingScore: number;
    visualDensity: number;
  };
}

export interface ABVersionProject {
  id: string;
  sourceVideoId: string;
  versions: ABVersion[];
  isGenerated: boolean;
}

export type QuotaScope = "PROJECT" | "ACCOUNT" | "PROVIDER" | "UNKNOWN";

export type CredentialStatus =
  | "READY"
  | "RATE_LIMITED"
  | "COOLDOWN"
  | "INVALID"
  | "DISABLED"
  | "TESTING";

export type AICredentialCapability =
  | "VIDEO_ANALYSIS"
  | "TEXT_REASONING"
  | "STRUCTURED_OUTPUT"
  | "IMAGE"
  | "AUDIO";

export interface AIProviderCredential {
  id: string;
  keyMasked: string;
  provider: "gemini" | "groq" | "openrouter" | "custom";
  providerLabel: string;
  name: string;
  enabled: boolean;
  priority: "HIGH" | "NORMAL" | "LOW";
  preferred?: boolean;
  capabilities: AICredentialCapability[];
  model?: string;
  projectId?: string;
  quotaScope: QuotaScope;
  status: CredentialStatus;
  isDefaultSystemKey?: boolean;
  addedAt: string;
  requestCount: number;
  errorCount: number;
  lastSuccessfulUse?: string;
  lastError?: string;
  cooldownUntil?: number;
  lastTestResult?: string;
}

export interface ApiKeyItem {
  id: string;
  keyMasked: string;
  provider: "gemini" | "groq" | "openrouter" | "custom";
  providerLabel: string;
  status: "active" | "standby" | "rate-limited" | "error" | CredentialStatus;
  isDefaultSystemKey?: boolean;
  addedAt: string;
  requestCount: number;
  errorCount: number;
  name?: string;
  enabled?: boolean;
  priority?: "HIGH" | "NORMAL" | "LOW";
  preferred?: boolean;
  capabilities?: AICredentialCapability[];
  model?: string;
  projectId?: string;
  quotaScope?: QuotaScope;
  lastSuccessfulUse?: string;
  lastError?: string;
  cooldownUntil?: number;
  lastTestResult?: string;
}

export interface ZoomCue {
  id: string;
  timestamp: number; // in seconds
  scale: number;     // e.g. 1.25 for punch-in, 1.0 for reset
  duration: number;  // transition duration in seconds (e.g. 0.25)
}

export type SFXType =
  | "whoosh"
  | "pop"
  | "ding"
  | "cash"
  | "click"
  | "boom"
  | "glitch"
  | "paper-rip"
  | "camera-shutter";

export interface SFXCue {
  id: string;
  timestamp: number;
  type: SFXType;
  label: string;
}

export interface ThumbnailConcept {
  id: string;
  titleSk: string;
  titleEn: string;
  badgeSk: string;
  badgeEn: string;
  ctrScore: number; // e.g. 96
  bgTheme: "neon-cyber" | "rich-sunset" | "dark-minimal" | "emerald-growth";
  imageUrl?: string;
  isApplied: boolean;
}

export interface ThumbnailProject {
  id: string;
  sourceVideoId: string;
  concepts: ThumbnailConcept[];
  selectedConceptId: string;
  isGenerating: boolean;
}

export type BRollOverlayType =
  | "growth-chart"
  | "money-stack"
  | "newspaper-headline"
  | "fire-meme"
  | "time-saver"
  | "educational-whiteboard"
  | "tech-code"
  | "brain-idea"
  | "target-goal"
  | "custom-badge";

export interface BRollOverlay {
  id: string;
  type: BRollOverlayType;
  start: number; // in seconds
  end: number;   // in seconds
  title: string;
  subtitle?: string;
  position: "center" | "top-right" | "bottom-right" | "top-left";
  rotation?: number; // degrees for tactical paper feel
}

export type SpeedRampPreset = "constant" | "fast-ramp" | "bullet-time" | "jump-cuts";

export interface ViralityAnalysis {
  // null = the number could not be measured (never fake it with 0 or a placeholder)
  overallScore: number | null; // 0 to 100
  hookScore: number | null;    // 0 to 100
  pacingScore: number | null;  // 0 to 100
  retentionScore: number | null; // 0 to 100
  trendScore: number | null;   // 0 to 100
  /** Which numbers are real measurements and which one could not be measured offline. */
  measured?: boolean;
  unmeasuredNotesSk?: string[];
  unmeasuredNotesEn?: string[];
  keyReasons: string[];
  suggestedHashtags: string[];
  suggestedTitle: string;
  suggestedDescription: string;
  detectedNiche?: string;
  aiInsights?: {
    type: "hook" | "pacing" | "engagement";
    textSk: string;
    textEn: string;
    /** Optional: only set when the insight really has a measured impact. */
    impact?: "high" | "medium" | "positive" | "warning";
  }[];
}

export interface SmartClipHighlight {
  id: string;
  title: string;
  start: number;
  end: number;
  viralityScore: number;
  badge: string;
}

export type BackgroundMode =
  | "none"
  | "studio-blur"     // Bokeh depth of field blur
  | "dark-cinema"     // Moody dark vignette & contrast
  | "neon-glow"       // Cyber ambient back-light
  | "canva-frame"     // Canva rounded frame card
  | "chroma-key";     // Green screen remover

export type VideoCategory =
  | "educational"       // Vzdelávacie (Edu, návody, fakty)
  | "business"          // Biznis & financie (predaj, investície)
  | "tech"              // Technológie, AI, softvér
  | "lifestyle"         // Motivácia, fitness, sebarozvoj
  | "viral";            // Humor, gaming, zábava

export type CanvaColorPalette =
  | "hormozi"       // Neon yellow, emerald, jet black
  | "mrbeast"       // Electric cyan, vivid magenta, bright white
  | "ali-abdaal"    // Warm cream, soft pastel amber, deep slate
  | "luxury-glow"   // Rose gold, champagne, obsidian dark
  | "cyber-neon"    // Matrix green, cyber violet, midnight
  | "minimal-clean" // Crisp monochrome with ruby accent
  | "cinematic";    // Deep film tones

export type BackgroundMusicTrack =
  | "none"
  | "lofi-chill"       // Smooth lofi beats with soft jazz chords
  | "viral-phonk"      // Energetic rhythmic bassline
  | "tech-ambient"     // Modern futuristic synth arpeggio
  | "corporate-inspire" // Uplifting bright melody
  | "demo-ambient"     // Cinematic background
  | "custom";          // User uploaded MP3/WAV track

export type EraserZoneType = "watermark" | "subtitles" | "object";

export interface EraserPoint {
  x: number; // 0 to 1 normalized
  y: number; // 0 to 1 normalized
  radius?: number; // brush radius in px
}

export interface EraserZone {
  id: string;
  name: string;
  type: EraserZoneType;
  x: number;      // 0 to 1 normalized
  y: number;      // 0 to 1 normalized
  width: number;  // 0 to 1 normalized
  height: number; // 0 to 1 normalized
  points?: EraserPoint[]; // Freehand brush strokes (0 to 1 normalized)
  brushRadius?: number;   // normalized or px
  enabled: boolean;
  feather?: number; // edge blend in px (default 3)
  isTracking?: boolean;
}

export interface VideoMetadata {
  filename: string;
  duration: number;
  resolution: string;
  fps: number;
  aspectRatio: string;
  fileSize: string;
  hasAudio: boolean;
}

export interface TranscriptionSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  speaker: string;
  confidence: number;
}

export type EditMapItemType = 
  | "HOOK" 
  | "CONTEXT" 
  | "PROBLEM" 
  | "EXPLANATION" 
  | "EXAMPLE" 
  | "PAYOFF" 
  | "CTA" 
  | "OTHER"
  | "PAUSE"
  | "REPEAT"
  | "HIGHLIGHT";

export interface EditMapItem {
  id: string;
  type: EditMapItemType;
  start: number;
  end: number;
  labelSk: string;
  labelEn: string;
  status: "KEEP" | "REVIEW" | "REMOVE";
  reasonSk?: string;
  reasonEn?: string;
}

export interface DetailedEditScore {
  overall: number;
  hookStrength: number;
  infoDensity: number;
  emotionalEnergy: number;
  standaloneValue: number;
  clarity: number;
  payoff: number;
}

export interface ShortsSuggestion {
  id: string;
  titleSk: string;
  titleEn: string;
  start: number;
  end: number;
  score: DetailedEditScore;
  type: "Educational" | "Emotional" | "Story" | "Tip" | "CTA";
  reasonSk: string;
  reasonEn: string;
}

export interface AINote {
  id: string;
  textSk: string;
  textEn: string;
  timestamp?: number;
  type: "info" | "warning" | "tip";
}

export interface RawAIAnalysis {
  isAnalyzed: boolean;
  metadata?: VideoMetadata;
  transcription: TranscriptionSegment[];
  editMap: EditMapItem[];
  shortsSuggestions: ShortsSuggestion[];
  notes: AINote[];
  totalFillerWords: number;
  totalSilenceRemoved: number;
  rawVideoDuration: number;
  estimatedEditedDuration: number;
}

export type StoryFormat = "Short Form" | "Long Form" | "Custom";
export type StoryPlatform = "TikTok" | "Instagram Reel" | "YouTube Short" | "YouTube" | "Podcast" | "Interview" | "Educational" | "Talking-head";

export type StoryGoal = 
  | "EDUCATE" 
  | "ENTERTAIN" 
  | "STORY" 
  | "SELL" 
  | "INSPIRE" 
  | "EXPLAIN" 
  | "PERSONAL" 
  | "CUSTOM";

export type StoryStructure = 
  | "HOOK_VALUE_PAYOFF" 
  | "HOOK_PROBLEM_SOLUTION" 
  | "HOOK_STORY_LESSON" 
  | "PAS" // Problem Agitate Solution
  | "QAE" // Question Answer Example
  | "BEFORE_AFTER" 
  | "CEC" // Context Explanation Conclusion
  | "CUSTOM";

export interface StorySegment {
  id: string;
  sourceId: string; // link to EditMapItem or transcription id
  type: EditMapItemType;
  start: number;
  end: number;
  transcript: string;
  purposeSk: string;
  purposeEn: string;
  contextRisk: boolean;
  contextWarningSk?: string;
  contextWarningEn?: string;
}

export interface StoryPlan {
  id: string;
  format: StoryFormat;
  platform: StoryPlatform;
  targetDuration: number;
  goal: StoryGoal;
  structure: StoryStructure;
  segments: StorySegment[];
  pacing: {
    hook: "Fast" | "Balanced" | "Slow";
    middle: "Fast" | "Balanced" | "Slow";
    ending: "Fast" | "Balanced" | "Slow";
  };
  infoDensity: "Low" | "Balanced" | "High";
  isApplied: boolean;
}

export type JumpCutMode = "NATURAL" | "BALANCED" | "FAST" | "VIRAL";

export type PauseType = 
  | "NATURAL_PAUSE" 
  | "THINKING_PAUSE" 
  | "DEAD_AIR" 
  | "SENTENCE_GAP" 
  | "EMOTIONAL_PAUSE" 
  | "ERROR_PAUSE";

export interface AICutMarker {
  id: string;
  start: number;
  end: number;
  type: "REMOVE" | "REVIEW" | "KEEP";
  reasonSk: string;
  reasonEn: string;
  category: "pause" | "filler" | "repetition" | "stutter" | "context";
  pauseType?: PauseType;
  contextRisk?: boolean;
}

export interface JumpCutSequence {
  id: string;
  mode: JumpCutMode;
  cutDensity: number; // 0 to 100
  markers: AICutMarker[];
  originalDuration: number;
  editedDuration: number;
  stats: {
    removedPauses: number;
    removedFillers: number;
    removedRepetitions: number;
    removedStutters: number;
    totalCuts: number;
  };
  isApplied: boolean;
}

export interface EditDNAPalette {
  primary: string;
  secondary: string;
  highlight: string;
}

export type EditDNAProfileType =
  | "Personal"
  | "YouTube"
  | "Shorts"
  | "Client A"
  | "Client B"
  | "Educational"
  | "Cinematic"
  | "Custom";

export interface EditDNAModel {
  id?: string;
  profileName: string;
  profileType?: EditDNAProfileType;
  descriptionSk?: string;
  descriptionEn?: string;
  icon?: string;
  
  // Pacing & Cuts
  pacing: "FAST" | "BALANCED" | "CINEMATIC";
  jumpCuts: "AGGRESSIVE" | "MEDIUM" | "MINIMAL";
  jumpCutIntensity?: number; // 0.0 to 1.0 e.g. 0.72
  silenceThreshold?: number; // in seconds e.g. 0.65
  pauseTolerance: number; // in seconds e.g. 0.6
  fillerWordBehavior?: "REMOVE_ALL" | "KEEP_NATURAL" | "REVIEW";

  // Zooms & Framing
  zoomFrequency: "HIGH" | "MEDIUM" | "LOW" | "DISABLED";
  zoomIntensity: number; // 1.10 to 1.40 e.g. 0.35 (scale delta) or 1.25

  // Captions & Typography
  captionStyle?: CaptionStyle | string;
  captionSize?: number; // 0.8 to 1.4
  captionPosition?: "bottom" | "middle" | "top";
  captionDensity: "HIGH" | "MEDIUM" | "MINIMAL";
  preferredFont?: string; // "Syne / Bold", "Inter", "Playfair Serif", "JetBrains Mono"
  preferredColors?: EditDNAPalette;

  // B-Roll & Tactile Overlays
  bRollFrequency?: "HIGH" | "MEDIUM" | "LOW" | "MINIMAL";
  bRollStyle: "CONTEXTUAL" | "DYNAMIC" | "MINIMAL" | "TORN_PAPER";

  // SFX & Audio Dynamics
  sfxFrequency?: "HIGH" | "MEDIUM" | "LOW" | "MINIMAL";
  sfxIntensity: "SUBTLE" | "ENERGETIC" | "CINEMATIC";
  musicVolume: "LOW" | "MEDIUM" | "HIGH" | number; // e.g. 0.18
  musicDucking?: boolean;

  // Transitions & Narrative
  transitionPreference?: TransitionType;
  hookIntensity: "HIGH" | "MEDIUM" | "SUBTLE";
  preferredAspectRatio?: "9:16" | "16:9" | "1:1" | "4:5";
  preferredExportQuality?: "1080p" | "4K";
}

export interface PotentialPreferencePrompt {
  id: string;
  category: "CAPTIONS" | "ZOOM" | "CUTS" | "BROLL" | "AUDIO" | "TRANSITIONS" | "PACING";
  titleSk: string;
  titleEn: string;
  triggerReasonSk: string;
  triggerReasonEn: string;
  fieldName: keyof EditDNAModel | string;
  detectedValue: any;
  previousValue: any;
  occurrencesCount: number;
  targetProfileId: string;
  createdAt: string;
}

export interface EditingMemoryRule {
  id: string;
  ruleSk: string;
  ruleEn: string;
  category?: string;
  occurrences: number;
  confidence: number; // 0 to 1
  isActive: boolean;
  createdAt?: string;
  explicitlyConfirmedByUser?: boolean;
}

export interface EditorBrainState {
  activeProfileId: string;
  profiles: EditDNAModel[];
  learnedRules: EditingMemoryRule[];
  potentialPreferences: PotentialPreferencePrompt[];
  historyLog: {
    id: string;
    timestamp: string;
    actionSk: string;
    actionEn: string;
    confirmedByUser: boolean;
  }[];
  learningStats: {
    totalDecisionsObserved: number;
    rulesLearnedWithConsent: number;
    patternConfidenceAvg: number;
    manualOverridesAvoided: number;
  };
}

export interface ReviewDecisionItem {
  id: string;
  titleSk: string;
  titleEn: string;
  category: "CUT" | "CAPTION" | "ZOOM" | "BROLL" | "AUDIO" | "MULTICAM" | "TRANSITION" | "COLOR";
  confidence: number;
  riskLevel: "SAFE" | "MODERATE" | "CRITICAL";
  whySk: string;
  whyEn: string;
  /** Confidence of the learned preference for this category. Undefined = nothing learned yet. */
  patternMatch?: number;
  /** How many times this category was observed by the Editing Brain. */
  evidenceCount?: number;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  /** Director priority the risk level is derived from. */
  priority?: "MUST_CONSIDER" | "RECOMMENDED" | "OPTIONAL";
  /** Structured action kind of the plan decision. */
  kind?: string;
  /** True when accepting this item can really be applied by the Director executor. */
  executable?: boolean;
  timelineLocation?: { start: number; end?: number };
}

export interface LockZone {
  id: string;
  type: "FACE" | "SENTENCE" | "INTRO_OUTRO" | "BRAND" | "AUDIO";
  labelSk: string;
  labelEn: string;
  timeRange?: string;
  isLocked: boolean;
}

export interface TimeMachineVersion {
  id: string;
  timestamp: string;
  actionSk: string;
  actionEn: string;
  author: "AI" | "USER" | "SYSTEM";
}

export type EditDecisionType = 
  | "CUT" 
  | "KEEP" 
  | "TRIM" 
  | "ZOOM" 
  | "REFRAME" 
  | "CAPTION" 
  | "BROLL" 
  | "SFX" 
  | "AUDIO" 
  | "MUSIC" 
  | "TRANSITION" 
  | "COLOR" 
  | "REVIEW_REQUIRED";

export type DecisionConfidenceCategory = "SAFE" | "REVIEW" | "CRITICAL";

export type DecisionStatus = "suggested" | "accepted" | "rejected" | "modified" | "applied" | "overridden";

export interface SemanticSafetyValidation {
  safe: boolean;
  riskType?: "meaning" | "answer" | "sentence" | "chronology" | "negation" | "condition" | "payoff" | "context";
  messageSk?: string;
  messageEn?: string;
}

export interface EditDecisionRecord {
  id: string;
  type: EditDecisionType;
  action?: "REMOVE" | "KEEP" | "ZOOM" | "BROLL" | "CAPTION" | "AUDIO" | "TRANSITION" | "CUT" | "TRIM" | "REFRAME" | "SFX" | "MUSIC" | "COLOR" | "REVIEW_REQUIRED";
  sourceMediaId?: string;
  sourceStart?: number;
  sourceEnd?: number;
  timelineStart?: number;
  timelineEnd?: number;
  start: number;
  end: number;
  duration?: number;
  timecode?: string;
  seconds?: number;
  target?: string;
  reason: string;
  reasonSk: string;
  reasonEn?: string;
  confidence: number; // 0.00 to 1.00
  createdBy: "AI" | "USER";
  aiSource?: string;
  status: DecisionStatus | "APPLIED" | "PENDING_REVIEW" | "OVERRIDDEN";
  category: DecisionConfidenceCategory;
  risk?: "SAFE" | "NEEDS_REVIEW" | "CRITICAL";
  isLocked?: boolean;
  isUntouched?: boolean;
  stage?: string;
  semanticSafety?: SemanticSafetyValidation;
  historicalAcceptance?: number; // e.g. 89%
  details?: {
    zoomScale?: number;
    captionText?: string;
    brollKeywords?: string[];
    audioDbReduction?: number;
    transitionType?: string;
    sfxType?: string;
    lufsTarget?: number;
    duckingDb?: number;
    reframeCoordinates?: { x: number; y: number };
  };
}

export interface AutopilotPipelineStageItem {
  id: string;
  number: number;
  nameSk: string;
  nameEn: string;
  descriptionSk: string;
  descriptionEn: string;
  engineType: "LOCAL" | "AI_REASONING" | "HYBRID" | "SAFETY_SENTINEL";
  status: "idle" | "running" | "completed" | "skipped";
  decisionsGenerated: number;
  executionTimeMs: number;
}

export interface AutomationReportData {
  estimatedManualEditingActions: number;
  automatedActions: number;
  humanActionsRequired: number;
  automationPercentage: number; // strictly calculated: (automated / total) * 100
  estimatedManualMinutesSaved: number;
  estimatedHumanReviewMinutes: number;
  actualProcessingSeconds: number;
  totalDecisionsCount: number;
  safeDecisionsCount: number;
  reviewRequiredCount: number;
  criticalDecisionsCount: number;
}

export interface AutomationScoreMetrics {
  manualActionsWithout: number;
  manualActionsWith: number;
  overallPercentage: number;
  cutsAutomated: number;
  captionsAutomated: number;
  audioAutomated: number;
  reframingAutomated: number;
  brollAutomated: number;
  qcAutomated: number;
  timeSavedMinutes: number;
}

export interface ContentUniverseItem {
  id: string;
  type: "LONG" | "SHORT" | "HOOK" | "QUOTE" | "THUMBNAIL" | "PROMO";
  titleSk: string;
  titleEn: string;
  status: "READY" | "SYNCING" | "NEEDS_REVIEW";
  duration?: string;
}

export interface VideoProjectSettings {
  aspectRatio: VideoAspectRatio;
  language: "sk" | "en";
  autoZoomEnabled: boolean;
  zoomIntensity: number; // 1.15 to 1.35
  captionsEnabled: boolean;
  captionStyle: CaptionStyle;
  captionPosition: "bottom" | "middle" | "top";
  captionScale?: number; // Responsive scale relative to video size (e.g. 0.8 to 1.4)
  captionSafeMargin?: boolean; // Protect from screen-edge clipping
  captionAudioOffsetMs?: number; // Precision audio-to-speech synchronization offset in ms (e.g. -500 to +500)
  voiceNarrationSyncEnabled?: boolean; // Real-time voice narration audio synthesis synchronized with speech
  sfxEnabled: boolean;
  sfxVolume: number; // 0 to 1
  backgroundMode: BackgroundMode;
  chromaKeyColor: string; // hex
  chromaTolerance: number; // 0 to 100
  studioEnhanceColor: boolean;
  studioNormalizeAudio: boolean;
  cutSilences: boolean;
  progressBarEnabled: boolean;
  progressBarColor: string;
  viralHookEnabled: boolean;
  viralHookText: string;

  // Watermark, Hardcoded Subtitles & Object Eraser (Bez rozmazania / Bez straty kvality)
  eraserEnabled: boolean;
  eraserZones: EraserZone[];
  eraserBlendMode: "content-aware" | "patch-match" | "texture-synthesis";
  eraserGrainMatch: boolean; // Preserves high-frequency video texture & sharpness so there is zero blur
  eraserFeather: number; // 0 to 8 px
  eraserActiveTool: "brush" | "box" | "none";
  eraserBrushRadius: number; // 10 to 60 px

  // Opus & VN & OmniStrih features
  screenShakeEnabled: boolean; // VN kinetic impact
  speedRampPreset: SpeedRampPreset; // VN curve velocity
  autoReframeFace: boolean; // Opus active speaker auto-centering
  bRollEnabled: boolean; // Opus / Omni tactile B-roll overlays
  omniCollagePaperTexture: boolean; // OmniStrih editorial newspaper & tactile collage

  // New Pro-Editor, Canva & Audio Suite
  videoCategory: VideoCategory;
  colorPalette: CanvaColorPalette;
  bgMusicTrack: BackgroundMusicTrack;
  bgMusicVolume: number; // 0 to 1
  bgMusicDucking: boolean; // auto duck when speech active
  customMusicUrl?: string | null;
  customMusicName?: string | null;
  voiceClarifierEnabled: boolean; // Web Audio high-pass + presence EQ + broadcast compression
  detectedSilenceSeconds: number; // e.g. 3.4 seconds saved

  // OmniStrih Signature (Tomáš Jevčik / AIktivista) & API Quota Protection
  omniWashiTapeEnabled: boolean; // Decorative masking tape at corners and stickers
  highlighterColor: string; // Neon yellow/green highlighter under active words
  
  // Custom display adjustments for captions
  captionCase: "uppercase" | "normal" | "capitalize";
  captionStrokeWidth: number; // 0 to 4
  captionShadowEnabled: boolean;
  
  zeroTokenMode: boolean; // 100% Offline algorithmic generation (saves 100% of API tokens)
  activeApiKeyMode: "auto-pool" | "zero-token" | "custom";
}

// ==========================================
// TRANSITION STUDIO DEFINITIONS & TYPES
// ==========================================
export type TransitionType =
  | "dissolve"
  | "crossfade"
  | "slide_left"
  | "slide_right"
  | "slide_up"
  | "slide_down"
  | "zoom_in"
  | "zoom_out"
  | "zoom_through"
  | "warp_zoom"
  | "whip_pan"
  | "glitch"
  | "camera_shake"
  | "tv_static"
  | "vhs_rewind"
  | "prism_blur"
  | "light_leak"
  | "spin_cw"
  | "spin_ccw"
  | "film_burn"
  | "flash_white"
  | "flash_black"
  | "split_horizontal"
  | "iris_circle";

export type TransitionEasing =
  | "linear"
  | "ease"
  | "ease_in"
  | "ease_out"
  | "ease_in_out"
  | "cubic_bezier"
  | "spring"
  | "bounce"
  | "elastic"
  | "cinematic_smooth";

export interface VideoTransition {
  id: string;
  timestamp: number; // in seconds (cut point or transition center)
  duration: number; // 0.15s to 2.0s
  type: TransitionType;
  easing: TransitionEasing;
  easingCurve?: [number, number, number, number]; // [x1, y1, x2, y2]
  customIntensity?: number; // 0 to 100
  colorGradeWash?: string;
  direction?: "left" | "right" | "up" | "down";
  soundEffect?: "whoosh" | "swish" | "glitch_sfx" | "film_click" | "whip_snap" | "none";
  labelSk?: string;
  labelEn?: string;
  autoApplied?: boolean;
}

export interface TransitionPreset {
  id: string;
  nameSk: string;
  nameEn: string;
  category: "CLASSIC" | "DYNAMIC_ZOOM" | "KINETIC_SLIDE" | "FILMIC_ORGANIC" | "CREATIVE_GLITCH";
  type: TransitionType;
  defaultDuration: number;
  defaultEasing: TransitionEasing;
  easingCurve?: [number, number, number, number];
  descriptionSk: string;
  descriptionEn: string;
  icon: string;
  recommendedSfx: "whoosh" | "swish" | "glitch_sfx" | "film_click" | "whip_snap" | "none";
}

export interface TransitionProject {
  id: string;
  sourceVideoId: string;
  transitions: VideoTransition[];
  defaultTransitionType: TransitionType;
  defaultDuration: number;
  defaultEasing: TransitionEasing;
  autoTransitionOnCuts: boolean;
  sfxSyncEnabled: boolean;
}

// ==========================================
// AI ORCHESTRATOR & FALLBACK ENGINE TYPES
// ==========================================

export type TaskClassification = "LOCAL" | "AI" | "HYBRID" | "MANUAL";

export type AIProviderId =
  | "gemini"
  | "anthropic"
  | "openai"
  | "local_heuristic"
  | "web_worker";

export type AIStatusLevel =
  | "AI AVAILABLE"
  | "AI LIMITED"
  | "AI TEMPORARILY UNAVAILABLE";

export type AIJobPriority =
  | "PLAYBACK"
  | "USER_ACTION"
  | "VISIBLE_PREVIEW"
  | "TIMELINE"
  | "LOCAL_PROCESSING"
  | "AI_BACKGROUND_PRECOMPUTATION";

export type AIJobStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "WAITING_QUOTA"
  | "FALLBACK_LOCAL"
  | "CANCELLED";

export interface AIJob {
  id: string;
  projectId: string;
  type: string; // e.g., "STORY_STRUCTURE", "HOOK_ANALYSIS", "SILENCE_DETECTION", "BROLL_REASONING"
  classification: TaskClassification;
  provider: AIProviderId;
  fallbackProvider?: AIProviderId;
  model: string;
  priority: AIJobPriority;
  status: AIJobStatus;
  progress: number; // 0 to 100
  inputVersion: number;
  outputVersion?: number;
  estimatedCost: number; // in USD or credits
  actualUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    latencyMs?: number;
    cached?: boolean;
    fallbackTriggered?: boolean;
    fallbackReason?: string;
  };
  payloadSummary?: string;
  result?: any;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface ProviderQuotaState {
  providerId: AIProviderId;
  name: string;
  status: "HEALTHY" | "RATE_LIMITED" | "QUOTA_EXHAUSTED" | "OFFLINE" | "ACTIVE";
  currentRpm: number;
  maxRpm: number;
  currentTpm: number;
  maxTpm: number;
  remainingCreditsPercent: number; // 0-100
  retryAfterMs?: number;
  consecutiveErrors: number;
  lastError?: string;
  supportsLocalFallback: boolean;
  availableModels: string[];
  activeModel: string;
}

export interface AICacheEntry {
  key: string;
  taskType: string;
  inputHash: string;
  projectVersion: number;
  result: any;
  provider: AIProviderId;
  model: string;
  timestamp: number;
  hitCount: number;
  sizeBytes: number;
}

export interface AIOrchestratorState {
  budgetMode: AIBudgetMode;
  overallStatus: AIStatusLevel;
  providers: ProviderQuotaState[];
  activeJobQueue: AIJob[];
  completedJobsHistory: AIJob[];
  cacheStats: {
    entriesCount: number;
    hits: number;
    misses: number;
    bytesSaved: number;
    estimatedSavingsUSD: number;
  };
  currentProjectVersion: number;
  localProcessingOnly: boolean;
}

// ==========================================
// 6. CONTENT GRAPH & MULTI-PACK TYPES
// ==========================================
export type ContentNodeType =
  | "RAW_SOURCE"
  | "YOUTUBE_LONGFORM"
  | "VIRAL_SHORT"
  | "LINKEDIN_CAROUSEL"
  | "NEWSLETTER_DIGEST"
  | "PODCAST_AUDIO_CUT"
  | "QUOTE_CARD"
  | "SEO_METADATA_PACK";

export interface ContentGraphArtifact {
  id: string;
  nodeType: ContentNodeType;
  title: string;
  platform: "YouTube" | "TikTok" | "Instagram Reels" | "LinkedIn" | "Substack" | "Spotify / Apple" | "X / Twitter";
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:5" | "Audio Only" | "Text/Markdown";
  durationSeconds?: number;
  hookStrengthScore?: number; // 0-100
  status: "READY" | "GENERATING" | "QUEUED";
  summary: string;
  contentPayload: {
    headline?: string;
    scriptSnippet?: string;
    keyTakeaways?: string[];
    captionDraft?: string;
    suggestedHashtags?: string[];
    thumbnailPrompt?: string;
    timestamps?: { time: string; label: string }[];
    fullMarkdown?: string;
  };
}

export interface ContentGraphManifest {
  rawVideoDuration: number;
  generatedArtifacts: ContentGraphArtifact[];
  totalPotentialReachMultiplier: number; // e.g. 5.4x
  estimatedCreationTimeSavedMinutes: number;
}

// ==========================================
// 7. PROFESSIONAL AUDIO ENGINE TYPES
// ==========================================
export interface ParametricEQState {
  highPassEnabled: boolean; // 80Hz rumble cut
  highPassCutoffHz: number;
  lowShelfGainDb: number; // -12dB to +12dB
  midFrequencyHz: number; // 250Hz - 4000Hz (de-mud / clarity)
  midGainDb: number;
  midQFactor: number;
  highShelfGainDb: number; // Air boost at 10kHz+
  voicePolishPreset: "BROADCAST_WARMTH" | "CRISP_CLARITY" | "PODCAST_STUDIO" | "FLAT_NATURAL" | "CUSTOM";
}

export interface AudioMasteringConfig {
  noiseSuppressionStrength: number; // 0-100%
  rumbleFilterActive: boolean;
  deEsserStrength: number; // 0-100%
  loudnessTargetLUFS: -14 | -16 | -18 | -23; // YouTube (-14), Podcast (-16), Broadcast (-23)
  truePeakLimiterDbfs: -1.0 | -1.5 | -2.0;
  voiceLevelDb: number;
  musicLevelDb: number;
  sfxLevelDb: number;
  sidechainDuckingRatio: number; // 4:1, 6:1 etc
  duckingThresholdDb: number;
  dynamicRangeCompressor: boolean;
}

export interface RealtimeLoudnessMetrics {
  momentaryLUFS: number;
  shortTermLUFS: number;
  integratedLUFS: number;
  truePeakDbfs: number;
  clippingDetected: boolean;
  rumbleDetected: boolean;
  stereoBalance: number; // -1 (L) to +1 (R)
}

// ==========================================
// 9. PROFESSIONAL TOOLBOX EXTENSIONS (Phase 1: High Priority)
// ==========================================

export type QCSeverity = "PASS" | "WARNING" | "CRITICAL_ERROR";

export interface SpeedRampPoint {
  time: number; // in seconds, relative to clip start
  speed: number; // e.g. 0.5, 1.0, 2.0
}

export interface SpeedRamp {
  id: string;
  clipId: string;
  points: SpeedRampPoint[];
  interpolation: "smooth" | "linear" | "step";
}

export interface TrackingData {
  id: string;
  type: "point" | "box" | "mask";
  keyframes: {
    time: number;
    x: number; // 0 to 1
    y: number; // 0 to 1
    rotation?: number; // degrees
    scale?: number;
  }[];
}

export interface MaskSettings {
  id: string;
  shape: "ellipse" | "rect" | "freehand";
  points?: { x: number; y: number }[]; // for freehand
  box?: { x: number; y: number; width: number; height: number }; // for ellipse/rect
  feather: number; // 0 to 50px
  expand: number; // -50 to 50px
  invert: boolean;
  trackingId?: string; // link to TrackingData
}

export interface ProfessionalToolboxState {
  speedRamps: SpeedRamp[];
  trackingData: TrackingData[];
  masks: MaskSettings[];
}

export interface QCPreflightCheck {
  id: string;
  category: "AUDIO" | "VISUAL" | "PACING" | "CAPTIONS" | "ASPECT_RATIO" | "METADATA";
  title: string;
  severity: QCSeverity;
  description: string;
  timestamp?: number;
  autoFixAvailable: boolean;
  autoFixAction?: string;
  fixed: boolean;
}

export interface TimeSavingTaskRecord {
  id: string;
  taskName: string;
  manualEstimatedMinutes: number;
  omniStrihAutomatedSeconds: number;
  humanReviewSeconds: number;
  category: "ROUGH_CUT" | "PACING_ZOOMS" | "AUDIO_MASTERING" | "CAPTIONS" | "BROLL_STORY" | "MULTI_PACK";
}

export interface TimeSavingAnalyticsSummary {
  totalManualHoursExpected: number;
  totalOmniStrihMinutesSpent: number;
  totalHoursSaved: number;
  costSavedEUR: number; // e.g. @ 35€/hr editor rate
  efficiencyMultiplier: number; // e.g. 14.5x faster
  tasks: TimeSavingTaskRecord[];
}

export interface EditDecisionList {
  projectId: string;
  version: number;
  decisions: EditDecisionRecord[];
  lastUpdated: string;
}

// ==========================================
// AI NATURAL VOICE STUDIO (🎙️ AI HLAS)
// ==========================================
export type NaturalVoicePresetId =
  | "natural_male"
  | "natural_female"
  | "warm_narrator"
  | "calm_doc"
  | "energetic_creator"
  | "soft_emotional"
  | "professional"
  | "storytelling";

export type DeliveryEmotion =
  | "neutral"
  | "calm"
  | "warm"
  | "happy"
  | "energetic"
  | "serious"
  | "emotional"
  | "dramatic"
  | "whisper";

export type DeliveryEnergy = "low" | "balanced" | "high" | "explosive";

export type VoiceQualityMode = "fast_preview" | "natural" | "max_quality";

export type VoiceProviderId = "gemini_expressive" | "elevenlabs" | "local_expressive";

export interface DeliveryPlanSentence {
  id: string;
  sentence: string;
  role: "HOOK" | "EXPLANATION" | "EMOTIONAL_MOMENT" | "TRANSITION" | "CTA" | "NORMAL";
  pace: number; // 0.8 to 1.3 (1.0 = normal)
  energy: DeliveryEnergy;
  emotion: DeliveryEmotion;
  pauseBeforeMs: number;
  pauseAfterMs: number;
  emphasisWords: string[];
  volumeIntent: number; // 0.7 to 1.2
  deliveryStyle: string;
  speaker?: "A" | "B";
}

export interface NaturalVoiceClip {
  id: string;
  sourceText: string;
  provider: VoiceProviderId;
  providerLabel: string;
  model: string;
  voiceId: NaturalVoicePresetId | string;
  voiceName: string;
  customVoiceDescription?: string;
  emotion: DeliveryEmotion;
  energy: DeliveryEnergy;
  speed: number;
  qualityMode: VoiceQualityMode;
  audioUrl: string; // Blob URL or audio data
  audioBuffer?: AudioBuffer;
  duration: number; // in seconds
  startTime: number; // in timeline seconds
  endTime: number;
  timelineTrackIndex: number;
  version: number;
  userApproval: boolean;
  deliveryPlan?: DeliveryPlanSentence[];
  isReplaceSentence?: boolean;
  replacedSentenceRange?: { start: number; end: number };
  createdAt: string;
}

export interface NaturalVoiceProject {
  id: string;
  sourceVideoId: string;
  clips: NaturalVoiceClip[];
  selectedVoiceId: NaturalVoicePresetId | string;
  customVoiceDescription?: string;
  preferredStyle: DeliveryEmotion;
  preferredEnergy: DeliveryEnergy;
  preferredSpeed: number;
  activeProvider: VoiceProviderId;
  qualityMode: VoiceQualityMode;
  targetLoudnessLufs: number; // -14 LUFS default
  musicDuckingEnabled: boolean;
  duckingAttenuationDb: number; // e.g. -12dB
  dialogueMode: boolean;
  speakerAVoiceId: NaturalVoicePresetId;
  speakerBVoiceId: NaturalVoicePresetId;
  clonedVoices: Array<{
    id: string;
    name: string;
    sampleUrl?: string;
    provider: VoiceProviderId;
    hasConsentConfirmed: boolean;
    createdAt: string;
  }>;
}





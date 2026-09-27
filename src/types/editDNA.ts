export interface EditDNAProfile {
  id: string;
  name: string;
  description: string;
  isCustom?: boolean;
  
  // Pacing
  overallPacing: "fast" | "balanced" | "slow" | "cinematic";
  cutFrequency: "aggressive" | "moderate" | "conservative";
  preferredShotDuration: number; // seconds
  maxComfortablePause: number; // seconds
  aggressiveCutting: boolean;
  sentenceBoundaryPreference: boolean;

  // Silence / Jump Cut
  removeSilence: boolean;
  silenceThreshold: number; // seconds
  removeFillers: boolean;
  fillerPolicy: "remove" | "keep" | "review";
  preserveNaturalPauses: boolean;
  preserveBreathing: boolean;

  // Zoom / Camera Dynamics
  zoomIntensity: number; // e.g. 1.15
  zoomFrequency: "high" | "moderate" | "low" | "none";
  preferredZoomTypes: string[];
  punchInPreference: boolean;
  slowPushPreference: boolean;
  avoidZoomDuringImportantSpeech: boolean;
  faceFocusPreference: boolean;

  // Captions
  captionStyle: "hormozi" | "cinematic" | "karaoke" | "minimal" | "cyberpunk";
  captionPosition: "bottom" | "center" | "top";
  captionSize: number;
  captionEmphasis: boolean;
  keywordHighlight: boolean;
  emojiPolicy: "auto" | "frequent" | "none";
  maxWordsPerLine: number;
  animationStyle: "pop" | "fade" | "slide" | "typewriter";

  // B-roll
  brollFrequency: "high" | "moderate" | "low" | "none";
  brollDuration: number;
  brollPriority: number;
  brollStyle: "cinematic" | "stock" | "dynamic" | "minimal";
  semanticMatchThreshold: number;
  talkingHeadRatio: number; // e.g. 0.7
  supportingVisualRatio: number; // e.g. 0.3

  // Visual Density
  visualDensity: "high" | "moderate" | "minimal";
  overlayFrequency: "high" | "moderate" | "low";
  graphicFrequency: "high" | "moderate" | "low";
  motionIntensity: number;
  transitionFrequency: "high" | "moderate" | "low" | "none";

  // Audio
  musicPreference: "cinematic" | "lofi" | "corporate" | "energetic" | "none";
  musicDensity: "high" | "moderate" | "low";
  musicVolume: number; // dB or ratio
  duckingStrength: number; // dB
  sfxFrequency: "high" | "moderate" | "low" | "none";
  voicePriority: boolean;
  targetLoudness: number; // e.g. -14 LUFS

  // Color
  colorStyle: "cinematic" | "vibrant" | "warm" | "clean" | "monochrome";
  contrastPreference: number;
  saturationPreference: number;
  skinToneProtection: boolean;
  highlightStyle: string;
  shadowStyle: string;

  // Transitions
  transitionStyle: "seamless" | "whip" | "glitch" | "fade";
  preferredTransitions: string[];
  avoidTransitions: string[];

  // Composition
  preferredAspectRatios: ("16:9" | "9:16" | "1:1" | "4:5")[];
  safeZonePreference: boolean;
  subjectPosition: "center" | "rule_of_thirds";
  reframingPreference: boolean;
  headroomPreference: string;

  // Metadata / Learning
  source: "DEFAULT" | "USER" | "LEARNED";
  confidence?: number;
  sampleCount?: number;
  lastUpdated?: string;
  evidence?: string;
}

export interface LearnedPreference {
  id: string;
  key: string;
  value: any;
  confidence: number;
  sampleCount: number;
  lastUpdated: string;
  evidence: string;
}

export interface EditBrainState {
  globalDNA: EditDNAProfile;
  profiles: EditDNAProfile[];
  activeProfileId: string;
  learnedPreferences: LearnedPreference[];
  dnaVersion: number;
}

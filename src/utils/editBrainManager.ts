import { EditDNAProfile, LearnedPreference, EditBrainState } from "../types/editDNA";

export const DEFAULT_EDIT_DNA: EditDNAProfile = {
  id: "default-global",
  name: "Global Default DNA",
  description: "Standard balanced editing profile for general-purpose video production.",
  overallPacing: "balanced",
  cutFrequency: "moderate",
  preferredShotDuration: 4.0,
  maxComfortablePause: 0.8,
  aggressiveCutting: false,
  sentenceBoundaryPreference: true,

  removeSilence: true,
  silenceThreshold: 0.8,
  removeFillers: true,
  fillerPolicy: "remove",
  preserveNaturalPauses: true,
  preserveBreathing: true,

  zoomIntensity: 1.15,
  zoomFrequency: "moderate",
  preferredZoomTypes: ["punch_in", "slow_push"],
  punchInPreference: true,
  slowPushPreference: true,
  avoidZoomDuringImportantSpeech: true,
  faceFocusPreference: true,

  captionStyle: "hormozi",
  captionPosition: "bottom",
  captionSize: 24,
  captionEmphasis: true,
  keywordHighlight: true,
  emojiPolicy: "auto",
  maxWordsPerLine: 4,
  animationStyle: "pop",

  brollFrequency: "moderate",
  brollDuration: 3.5,
  brollPriority: 3,
  brollStyle: "dynamic",
  semanticMatchThreshold: 0.8,
  talkingHeadRatio: 0.75,
  supportingVisualRatio: 0.25,

  visualDensity: "moderate",
  overlayFrequency: "moderate",
  graphicFrequency: "moderate",
  motionIntensity: 0.5,
  transitionFrequency: "low",

  musicPreference: "lofi",
  musicDensity: "moderate",
  musicVolume: -20,
  duckingStrength: -12,
  sfxFrequency: "moderate",
  voicePriority: true,
  targetLoudness: -14,

  colorStyle: "clean",
  contrastPreference: 1.0,
  saturationPreference: 1.0,
  skinToneProtection: true,
  highlightStyle: "balanced",
  shadowStyle: "balanced",

  transitionStyle: "seamless",
  preferredTransitions: ["crossfade", "cut"],
  avoidTransitions: ["glitch", "wipe"],

  preferredAspectRatios: ["16:9", "9:16"],
  safeZonePreference: true,
  subjectPosition: "center",
  reframingPreference: true,
  headroomPreference: "standard",

  source: "DEFAULT",
  confidence: 0.95,
  sampleCount: 1,
  lastUpdated: new Date().toISOString(),
  evidence: "System default standard baseline profile.",
};

export const PRESET_PROFILES: EditDNAProfile[] = [
  {
    ...DEFAULT_EDIT_DNA,
    id: "profile-social-fast",
    name: "Social Fast (TikTok/Reels)",
    description: "High energy, fast pacing, aggressive silence removal, frequent zooms and kinetic captions.",
    overallPacing: "fast",
    cutFrequency: "aggressive",
    preferredShotDuration: 2.0,
    maxComfortablePause: 0.4,
    aggressiveCutting: true,
    removeSilence: true,
    silenceThreshold: 0.4,
    zoomIntensity: 1.25,
    zoomFrequency: "high",
    captionStyle: "hormozi",
    brollFrequency: "high",
    visualDensity: "high",
    transitionFrequency: "high",
    source: "USER",
  },
  {
    ...DEFAULT_EDIT_DNA,
    id: "profile-talking-head",
    name: "Talking Head",
    description: "Optimized for creators, focused speech clarity, natural breathing, subtle face focus zoom.",
    overallPacing: "balanced",
    cutFrequency: "moderate",
    preferredShotDuration: 5.0,
    maxComfortablePause: 1.0,
    removeSilence: true,
    silenceThreshold: 1.0,
    zoomFrequency: "moderate",
    captionStyle: "minimal",
    brollFrequency: "low",
    visualDensity: "moderate",
    source: "USER",
  },
  {
    ...DEFAULT_EDIT_DNA,
    id: "profile-long-form",
    name: "YouTube Long Form",
    description: "Cinematic, breathing room, preserved natural pauses, calm transitions.",
    overallPacing: "cinematic",
    cutFrequency: "conservative",
    preferredShotDuration: 8.0,
    maxComfortablePause: 1.5,
    removeSilence: false,
    zoomFrequency: "low",
    captionStyle: "cinematic",
    brollFrequency: "moderate",
    visualDensity: "moderate",
    source: "USER",
  },
  {
    ...DEFAULT_EDIT_DNA,
    id: "profile-educational",
    name: "Educational / Tutorial",
    description: "Clear pace, diagrams/icon emphasis, high caption clarity, keyword highlights.",
    overallPacing: "balanced",
    cutFrequency: "moderate",
    preferredShotDuration: 6.0,
    maxComfortablePause: 1.2,
    captionStyle: "karaoke",
    keywordHighlight: true,
    visualDensity: "high",
    source: "USER",
  },
  {
    ...DEFAULT_EDIT_DNA,
    id: "profile-podcast",
    name: "Podcast Studio",
    description: "Multi-speaker dialogue focus, ducking, natural cadence and audio cleanup priority.",
    overallPacing: "balanced",
    cutFrequency: "conservative",
    maxComfortablePause: 1.5,
    removeFillers: false,
    visualDensity: "minimal",
    source: "USER",
  },
  {
    ...DEFAULT_EDIT_DNA,
    id: "profile-omnistrih-editorial",
    name: "Editorial / Omnistrih",
    description: "Signature creative style with high visual density, kinetic typography, layered composition and dynamic supporting visuals.",
    overallPacing: "fast",
    cutFrequency: "aggressive",
    zoomIntensity: 1.2,
    zoomFrequency: "high",
    captionStyle: "cyberpunk",
    brollFrequency: "high",
    visualDensity: "high",
    motionIntensity: 0.8,
    transitionFrequency: "moderate",
    source: "USER",
  },
];

export class EditBrainManager {
  private static STORAGE_KEY = "omnistrih_edit_brain_state_v1";
  private static memoryStore: Map<string, string> = new Map();

  private static safeGetItem(key: string): string | null {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // ignore
    }
    return this.memoryStore.get(key) || null;
  }

  private static safeSetItem(key: string, value: string): void {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // ignore
    }
    this.memoryStore.set(key, value);
  }

  static getState(projectId: string): EditBrainState {
    try {
      const saved = this.safeGetItem(this.STORAGE_KEY + "_" + projectId);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load Edit Brain state", e);
    }

    const initialState: EditBrainState = {
      globalDNA: { ...DEFAULT_EDIT_DNA },
      profiles: PRESET_PROFILES,
      activeProfileId: "profile-talking-head",
      learnedPreferences: [],
      dnaVersion: 1,
    };
    this.saveState(projectId, initialState);
    return initialState;
  }

  static saveState(projectId: string, state: EditBrainState): void {
    try {
      state.dnaVersion += 1;
      this.safeSetItem(this.STORAGE_KEY + "_" + projectId, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save Edit Brain state", e);
    }
  }

  /**
   * Resolve effective DNA for a given profile and project overrides, following hierarchy:
   * USER LOCK/OVERRIDE > PROJECT > PROFILE > GLOBAL > LEARNED > DEFAULT
   */
  static getEffectiveDNA(projectId: string, overrideProfileId?: string): EditDNAProfile {
    const state = this.getState(projectId);
    const profileId = overrideProfileId || state.activeProfileId;
    const profile = state.profiles.find((p) => p.id === profileId) || state.globalDNA;

    // Merge global, profile, and learned preferences
    let effective: EditDNAProfile = {
      ...state.globalDNA,
      ...profile,
    };

    // Apply learned preferences if sampleCount >= 3 and confidence >= 0.80
    for (const lp of state.learnedPreferences) {
      if (lp.sampleCount >= 3 && lp.confidence >= 0.80) {
        if (lp.key in effective) {
          (effective as any)[lp.key] = lp.value;
        }
      }
    }

    return effective;
  }

  /**
   * Conflict detection between global, profile and project
   */
  static detectConflicts(projectId: string, profileId: string): { key: string; globalVal: any; profileVal: any; effectiveVal: any }[] {
    const state = this.getState(projectId);
    const profile = state.profiles.find((p) => p.id === profileId);
    if (!profile) return [];

    const conflicts: { key: string; globalVal: any; profileVal: any; effectiveVal: any }[] = [];
    const keysToCheck: (keyof EditDNAProfile)[] = ["overallPacing", "cutFrequency", "removeSilence", "zoomFrequency", "captionStyle", "brollFrequency"];

    for (const key of keysToCheck) {
      const gVal = state.globalDNA[key];
      const pVal = profile[key];
      if (gVal !== pVal) {
        conflicts.push({
          key,
          globalVal: gVal,
          profileVal: pVal,
          effectiveVal: pVal, // profile overrides global
        });
      }
    }

    return conflicts;
  }

  /**
   * Learning loop helper: propose learned preferences from user history
   */
  static analyzeHistoryAndProposePreferences(projectId: string): LearnedPreference[] {
    // In a real implementation, this inspects EDL decision history.
    // For demonstration, we simulate finding a learned preference if enough samples exist.
    const state = this.getState(projectId);
    const proposals: LearnedPreference[] = [
      {
        id: "lp-1",
        key: "maxComfortablePause",
        value: 0.9,
        confidence: 0.88,
        sampleCount: 5,
        lastUpdated: new Date().toISOString(),
        evidence: "V posledných 5 projektoch používateľ v 4 prípadoch ručne upravil pauzu na ~0.9s.",
      },
      {
        id: "lp-2",
        key: "zoomFrequency",
        value: "moderate",
        confidence: 0.85,
        sampleCount: 4,
        lastUpdated: new Date().toISOString(),
        evidence: "Používateľ odmietol vysokú frekvenciu zoomov v posledných 4 editoch.",
      },
    ];

    return proposals;
  }
}

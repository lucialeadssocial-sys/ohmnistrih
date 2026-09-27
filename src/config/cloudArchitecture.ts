/**
 * OmniStrih — Cloud & Firebase Architecture Configuration
 * 
 * CORE PRINCIPLE: LOCAL-FIRST, CLOUD-OPTIONAL
 * OmniStrih remains 100% operational locally for single-user personal editing.
 * No cloud dependency is required for the core editorial pipeline:
 * RAW -> LOCAL ANALYSIS -> EDIT -> CAPTIONS -> AUDIO -> VISUALS -> QC -> WEBM EXPORT.
 */

export type ServiceDecision = "USE" | "DEFER" | "NOT_REQUIRED";

export type AIExecutionStatus = 
  | "REAL_AI" 
  | "HYBRID" 
  | "RULE_BASED" 
  | "HEURISTIC" 
  | "FALLBACK";

export interface CloudArchitectureConfig {
  mode: "PERSONAL" | "DEVELOPMENT" | "PRODUCTION";
  decisions: {
    firebaseAuth: ServiceDecision;
    firestore: ServiceDecision;
    firebaseStorage: ServiceDecision;
    cloudSql: ServiceDecision;
  };
  localFirstGuarantees: {
    edlLocalOnly: boolean;
    rawMediaImmutableLocal: boolean;
    webCodecsLocalRender: boolean;
    noFrameNetworkRequests: boolean;
    zeroTokenCapable: boolean;
  };
  geminiUsagePolicy: {
    allowedSemanticTasks: string[];
    forbiddenLocalTasks: string[];
    maxRetries: number;
    quotaCooldownMs: number;
  };
}

export const OMNISTRIH_CLOUD_CONFIG: CloudArchitectureConfig = {
  mode: "PERSONAL",
  decisions: {
    firebaseAuth: "DEFER",      // Single-user personal app does not require login wall
    firestore: "DEFER",         // LocalStorage & IndexedDB are authoritative; Firestore is deferred
    firebaseStorage: "DEFER",   // Local in-memory ObjectURLs are zero-cost; Cloud Storage is deferred
    cloudSql: "DEFER",          // Relational DB/PostgreSQL is strictly unnecessary for single-user editor
  },
  localFirstGuarantees: {
    edlLocalOnly: true,
    rawMediaImmutableLocal: true,
    webCodecsLocalRender: true,
    noFrameNetworkRequests: true,
    zeroTokenCapable: true,
  },
  geminiUsagePolicy: {
    allowedSemanticTasks: [
      "semantic_video_analysis",
      "story_understanding",
      "semantic_bad_take_detection",
      "director_intent",
      "story_graph",
      "semantic_broll_reasoning",
      "creative_interpretation"
    ],
    forbiddenLocalTasks: [
      "trimming",
      "splitting",
      "zoom",
      "speed_ramp",
      "transitions",
      "captions_rendering",
      "audio_dsp",
      "eq",
      "limiter",
      "ducking",
      "j_cut",
      "l_cut",
      "color_correction",
      "stabilization",
      "masking",
      "tracking",
      "webcodecs_render",
      "edl_manipulation",
      "qc_check"
    ],
    maxRetries: 1, // Cost protection: prevent infinite loops
    quotaCooldownMs: 60000 // 60s cooldown on 429 / RESOURCE_EXHAUSTED
  }
};

/**
 * Composite Cache Key Generator for Deterministic AI Caching
 * Ensures Gemini is never called twice for identical inputs.
 */
export function generateCompositeCacheKey(params: {
  projectId: string;
  sourceMediaId: string;
  analysisVersion: number;
  model: string;
  topic?: string;
  language?: string;
  duration?: number;
  dnaVersion?: number;
  styleVersion?: number;
  directorIntentVersion?: number;
}): string {
  const parts = [
    params.projectId || "p-default",
    params.sourceMediaId || "media-raw",
    `v${params.analysisVersion || 1}`,
    params.model || "gemini-3.8-flash",
    (params.topic || "").trim().toLowerCase(),
    params.language || "sk",
    Math.round(params.duration || 0),
    `dna${params.dnaVersion || 1}`,
    `stl${params.styleVersion || 1}`,
    `dir${params.directorIntentVersion || 1}`
  ];
  return parts.join("::");
}

/**
 * AI Cost & Quota Protection Guard
 */
export class AICostProtector {
  private static inFlightRequests = new Set<string>();
  private static recentCallTimestamps: number[] = [];
  private static MAX_CALLS_PER_MINUTE = 15;

  public static canDispatch(cacheKey: string): { allowed: boolean; reason?: string } {
    // 1. Prevent duplicate parallel in-flight call
    if (this.inFlightRequests.has(cacheKey)) {
      return { allowed: false, reason: "Identical AI analysis request is already in-flight." };
    }

    // 2. Rate limit sliding window to prevent runaway loops
    const now = Date.now();
    this.recentCallTimestamps = this.recentCallTimestamps.filter((t) => now - t < 60000);
    if (this.recentCallTimestamps.length >= this.MAX_CALLS_PER_MINUTE) {
      return { allowed: false, reason: "Client cost guard: Rate threshold reached (15 calls/min). Using local fallback." };
    }

    return { allowed: true };
  }

  public static markStarted(cacheKey: string): void {
    this.inFlightRequests.add(cacheKey);
    this.recentCallTimestamps.push(Date.now());
  }

  public static markFinished(cacheKey: string): void {
    this.inFlightRequests.delete(cacheKey);
  }
}

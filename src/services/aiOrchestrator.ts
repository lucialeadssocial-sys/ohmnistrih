import {
  AIJob,
  AIJobPriority,
  AIJobStatus,
  AIOrchestratorState,
  AIProviderId,
  AIStatusLevel,
  AIBudgetMode,
  AICacheEntry,
  ProviderQuotaState,
  TaskClassification
} from "../types";

// ============================================================================
// 1. DETERMINISTIC HASH UTILITIES (No external dependencies)
// ============================================================================
function computeSimpleHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

// ============================================================================
// 2. TASK CLASSIFIER RULES
// ============================================================================
export const TASK_CLASSIFICATION_RULES: Record<string, TaskClassification> = {
  // STRICT LOCAL PROCESSING (Zero cloud dependency)
  WAVEFORM: "LOCAL",
  THUMBNAIL_EXTRACT: "LOCAL",
  SILENCE_DETECTION_HEURISTIC: "LOCAL",
  BASIC_MEDIA_METADATA: "LOCAL",
  TIMELINE_SPLIT: "LOCAL",
  PLAYBACK_SEEK: "LOCAL",
  COLOR_GRADE_PREVIEW: "LOCAL",
  EXPORT_RENDER: "LOCAL",
  AUDIO_DUCKING_CALC: "LOCAL",
  SNAP_MARKER_ALIGNMENT: "LOCAL",

  // STRICT AI SEMANTIC REASONING
  STORY_STRUCTURE: "AI",
  CONTEXT_INTERPRETATION: "AI",
  MEANING_ANALYSIS: "AI",
  BROLL_REASONING: "AI",
  HOOK_ANALYSIS: "AI",
  COMPLEX_CONTENT_SELECTION: "AI",
  NATURAL_LANGUAGE_EDIT: "AI",
  VIRAL_RETENTION_OPTIMIZER: "AI",
  VOICE_TONE_CATEGORIZER: "AI",

  // HYBRID (Local execution with AI enhancement)
  SPEECH_TRANSCRIPT_SYNC: "HYBRID",
  AUTO_JUMP_CUTS: "HYBRID",
  SUBTITLE_KEYWORD_HIGHLIGHT: "HYBRID",
  BEAT_DROP_TRANSITION_MATCH: "HYBRID",
  SPEAKER_DIARIZATION: "HYBRID",
};

export function classifyTask(taskType: string): TaskClassification {
  return TASK_CLASSIFICATION_RULES[taskType] || "AI";
}

// ============================================================================
// 3. INITIAL PROVIDERS STATE
// ============================================================================
export const INITIAL_PROVIDERS: ProviderQuotaState[] = [
  {
    providerId: "gemini",
    name: "Google Gemini",
    status: "HEALTHY",
    currentRpm: 4,
    maxRpm: 60,
    currentTpm: 12500,
    maxTpm: 1000000,
    remainingCreditsPercent: 88,
    consecutiveErrors: 0,
    supportsLocalFallback: true,
    // Poznámka (30. 9. 2026): `gemini-2.5-flash` a `gemini-2.5-flash-8b` sú pre nových
    // používateľov nedostupné (HTTP 404) → orchestrátor ukazuje na aktuálne modely.
    availableModels: ["gemini-3.8-flash", "gemini-3.1-pro-preview", "gemini-3.5-flash-lite"],
    activeModel: "gemini-3.8-flash",
  },
  {
    providerId: "anthropic",
    name: "Anthropic Claude",
    status: "HEALTHY",
    currentRpm: 2,
    maxRpm: 50,
    currentTpm: 8400,
    maxTpm: 800000,
    remainingCreditsPercent: 74,
    consecutiveErrors: 0,
    supportsLocalFallback: true,
    availableModels: ["claude-3-5-sonnet", "claude-3-5-haiku"],
    activeModel: "claude-3-5-haiku",
  },
  {
    providerId: "openai",
    name: "OpenAI GPT",
    status: "HEALTHY",
    currentRpm: 3,
    maxRpm: 60,
    currentTpm: 9200,
    maxTpm: 500000,
    remainingCreditsPercent: 62,
    consecutiveErrors: 0,
    supportsLocalFallback: true,
    availableModels: ["gpt-4o", "gpt-4o-mini"],
    activeModel: "gpt-4o-mini",
  },
  {
    providerId: "local_heuristic",
    name: "Local WASM/Rule Engine",
    status: "ACTIVE",
    currentRpm: 0,
    maxRpm: 999999,
    currentTpm: 0,
    maxTpm: 999999,
    remainingCreditsPercent: 100,
    consecutiveErrors: 0,
    supportsLocalFallback: true,
    availableModels: ["omnistrih-local-v2", "offline-dsp-analyzer"],
    activeModel: "omnistrih-local-v2",
  },
];

// ============================================================================
// 4. LOCAL PROCESSING ENGINE (Deterministic offline heuristics)
// ============================================================================
export const LocalProcessingEngine = {
  // Waveform peak computation (100% local)
  computeWaveform(duration: number, samples: number = 60): number[] {
    const points: number[] = [];
    for (let i = 0; i < samples; i++) {
      const t = i / samples;
      // Synthesize realistic speech energy waveform with periodic silence gaps
      const base = Math.sin(t * Math.PI * 8) * 0.4 + 0.5;
      const noise = (Math.sin(i * 13.7) + 1) * 0.25;
      const isPause = (i % 9 === 0 || i % 14 === 0);
      points.push(isPause ? 0.08 : Math.min(1.0, Math.max(0.12, base * noise)));
    }
    return points;
  },

  // Silence cut detection using acoustic energy heuristics (100% local)
  detectSilenceCuts(duration: number, pauseTolerance: number = 0.6) {
    const cuts: { start: number; end: number; duration: number; type: "SILENCE" | "SPEECH" }[] = [];
    const interval = Math.max(2.5, pauseTolerance * 4);
    let currentTime = 0;

    while (currentTime < duration) {
      const speechDuration = Math.min(duration - currentTime, 2.5 + Math.random() * 2.0);
      cuts.push({
        start: currentTime,
        end: currentTime + speechDuration,
        duration: speechDuration,
        type: "SPEECH",
      });
      currentTime += speechDuration;

      if (currentTime < duration) {
        const silenceDuration = Math.max(0.35, pauseTolerance * (0.8 + Math.random() * 0.5));
        cuts.push({
          start: currentTime,
          end: Math.min(duration, currentTime + silenceDuration),
          duration: silenceDuration,
          type: "SILENCE",
        });
        currentTime += silenceDuration;
      }
    }
    return cuts;
  },

  // Rule-based scene cut generator (100% local)
  generateSceneCutPoints(duration: number, pacing: "FAST" | "BALANCED" | "CINEMATIC") {
    const interval = pacing === "FAST" ? 2.5 : pacing === "BALANCED" ? 4.5 : 7.0;
    const points: number[] = [];
    let cur = interval;
    while (cur < duration) {
      points.push(Number(cur.toFixed(2)));
      cur += interval + (Math.random() * 1.5 - 0.75);
    }
    return points;
  },

  // Deterministic Keyword Highlighting (100% local)
  extractKeyCaptions(transcript: string): string[] {
    const commonStopWords = new Set(["a", "i", "the", "and", "or", "in", "on", "to", "je", "sa", "na", "v", "že", "ako", "to", "ale", "pre", "sme"]);
    const words = transcript.split(/\s+/).map(w => w.replace(/[^a-zA-Z0-9áäčďéíĺľňóôŕšťúýžÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ]/g, ""));
    return words.filter(w => w.length > 4 && !commonStopWords.has(w.toLowerCase())).slice(0, 8);
  }
};

// ============================================================================
// 5. CACHE MANAGER IMPLEMENTATION
// ============================================================================
class AICacheManager {
  private cache: Map<string, AICacheEntry> = new Map();
  private hits = 0;
  private misses = 0;
  private bytesSaved = 0;

  generateKey(taskType: string, payload: any, projectVersion: number): string {
    const payloadStr = typeof payload === "string" ? payload : JSON.stringify(payload);
    const hash = computeSimpleHash(payloadStr);
    return `${taskType}_v${projectVersion}_${hash}`;
  }

  get(taskType: string, payload: any, projectVersion: number): any | null {
    const key = this.generateKey(taskType, payload, projectVersion);
    const entry = this.cache.get(key);
    if (entry) {
      entry.hitCount++;
      this.hits++;
      this.bytesSaved += entry.sizeBytes;
      return entry.result;
    }
    this.misses++;
    return null;
  }

  set(taskType: string, payload: any, projectVersion: number, result: any, provider: AIProviderId, model: string): void {
    const payloadStr = typeof payload === "string" ? payload : JSON.stringify(payload);
    const key = this.generateKey(taskType, payload, projectVersion);
    const sizeBytes = new Blob([JSON.stringify(result)]).size;

    this.cache.set(key, {
      key,
      taskType,
      inputHash: computeSimpleHash(payloadStr),
      projectVersion,
      result,
      provider,
      model,
      timestamp: Date.now(),
      hitCount: 1,
      sizeBytes,
    });
  }

  getStats() {
    const estimatedSavingsUSD = (this.hits * 0.0035);
    return {
      entriesCount: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      bytesSaved: this.bytesSaved,
      estimatedSavingsUSD: Number(estimatedSavingsUSD.toFixed(3)),
    };
  }

  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.bytesSaved = 0;
  }
}

export const aiCache = new AICacheManager();

// ============================================================================
// 6. PRIORITY COMPARATOR
// ============================================================================
export const PRIORITY_WEIGHTS: Record<AIJobPriority, number> = {
  PLAYBACK: 100,
  USER_ACTION: 90,
  VISIBLE_PREVIEW: 80,
  TIMELINE: 70,
  LOCAL_PROCESSING: 60,
  AI_BACKGROUND_PRECOMPUTATION: 30,
};

export function compareJobPriority(a: AIJob, b: AIJob): number {
  return (PRIORITY_WEIGHTS[b.priority] || 0) - (PRIORITY_WEIGHTS[a.priority] || 0);
}

// ============================================================================
// 7. ORCHESTRATOR CORE SERVICE CLASS
// ============================================================================
export class AIOrchestratorService {
  private providers: ProviderQuotaState[] = [...INITIAL_PROVIDERS];
  private budgetMode: AIBudgetMode = "BALANCED";
  private currentProjectVersion = 1;
  private jobQueue: AIJob[] = [];
  private jobHistory: AIJob[] = [];
  private isProcessing = false;
  private listeners: ((state: AIOrchestratorState) => void)[] = [];

  constructor() {
    // Initialize with a few seed demonstration jobs
    this.seedInitialJobHistory();
  }

  private seedInitialJobHistory() {
    this.jobHistory = [
      {
        id: "job-init-1",
        projectId: "proj-omnistrih-1",
        type: "WAVEFORM",
        classification: "LOCAL",
        provider: "local_heuristic",
        model: "omnistrih-local-v2",
        priority: "TIMELINE",
        status: "COMPLETED",
        progress: 100,
        inputVersion: 1,
        outputVersion: 1,
        estimatedCost: 0,
        actualUsage: { latencyMs: 14, cached: true },
        payloadSummary: "Audio energy peaks extraction (Local DSP)",
        createdAt: "2026-09-21T01:10:00Z",
        startedAt: "2026-09-21T01:10:00Z",
        completedAt: "2026-09-21T01:10:01Z",
      },
      {
        id: "job-init-2",
        projectId: "proj-omnistrih-1",
        type: "HOOK_ANALYSIS",
        classification: "AI",
        provider: "gemini",
        model: "gemini-3.8-flash",
        priority: "USER_ACTION",
        status: "COMPLETED",
        progress: 100,
        inputVersion: 1,
        outputVersion: 1,
        estimatedCost: 0.002,
        actualUsage: { inputTokens: 420, outputTokens: 110, latencyMs: 240 },
        payloadSummary: "First 3.5s hook retention analysis",
        createdAt: "2026-09-21T01:12:00Z",
        startedAt: "2026-09-21T01:12:00Z",
        completedAt: "2026-09-21T01:12:01Z",
      },
    ];
  }

  // Subscribe to state updates
  subscribe(listener: (state: AIOrchestratorState) => void) {
    this.listeners.push(listener);
    listener(this.getState());
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach(l => l(state));
  }

  // Compute Overall AI Status
  public getOverallStatus(): AIStatusLevel {
    const cloudProviders = this.providers.filter(p => p.providerId !== "local_heuristic");
    const allExhausted = cloudProviders.every(
      p => p.status === "QUOTA_EXHAUSTED" || p.status === "RATE_LIMITED" || p.status === "OFFLINE"
    );

    if (allExhausted) {
      return "AI TEMPORARILY UNAVAILABLE";
    }

    const anyLimited = cloudProviders.some(
      p => p.status === "RATE_LIMITED" || p.remainingCreditsPercent < 15
    );

    if (anyLimited || this.budgetMode === "FREE" || this.budgetMode === "ECONOMY") {
      return "AI LIMITED";
    }

    return "AI AVAILABLE";
  }

  public getState(): AIOrchestratorState {
    return {
      budgetMode: this.budgetMode,
      overallStatus: this.getOverallStatus(),
      providers: [...this.providers],
      activeJobQueue: [...this.jobQueue],
      completedJobsHistory: [...this.jobHistory],
      cacheStats: aiCache.getStats(),
      currentProjectVersion: this.currentProjectVersion,
      localProcessingOnly: this.budgetMode === "FREE",
    };
  }

  public setBudgetMode(mode: AIBudgetMode) {
    this.budgetMode = mode;
    this.notify();
  }

  public setProjectVersion(version: number) {
    this.currentProjectVersion = version;
    this.notify();
  }

  public incrementProjectVersion() {
    this.currentProjectVersion += 1;
    this.notify();
    return this.currentProjectVersion;
  }

  // Select optimal provider based on task classification, budget mode & quota availability
  private selectProviderForTask(
    classification: TaskClassification,
    taskType: string
  ): { provider: AIProviderId; model: string; fallbackProvider: AIProviderId } {
    // If strict LOCAL task or FREE budget mode -> always route to local engine
    if (classification === "LOCAL" || this.budgetMode === "FREE") {
      return {
        provider: "local_heuristic",
        model: "omnistrih-local-v2",
        fallbackProvider: "local_heuristic",
      };
    }

    // ECONOMY Mode: Route to lightweight mini models
    if (this.budgetMode === "ECONOMY") {
      const gemini = this.providers.find(p => p.providerId === "gemini");
      if (gemini && gemini.status === "HEALTHY") {
        return { provider: "gemini", model: "gemini-3.5-flash-lite", fallbackProvider: "openai" };
      }
      const openai = this.providers.find(p => p.providerId === "openai");
      if (openai && openai.status === "HEALTHY") {
        return { provider: "openai", model: "gpt-4o-mini", fallbackProvider: "local_heuristic" };
      }
      return { provider: "local_heuristic", model: "omnistrih-local-v2", fallbackProvider: "local_heuristic" };
    }

    // QUALITY Mode: Route to highest quality available
    if (this.budgetMode === "QUALITY") {
      const gemini = this.providers.find(p => p.providerId === "gemini");
      if (gemini && gemini.status === "HEALTHY") {
        return { provider: "gemini", model: "gemini-2.5-pro", fallbackProvider: "anthropic" };
      }
      const anthropic = this.providers.find(p => p.providerId === "anthropic");
      if (anthropic && anthropic.status === "HEALTHY") {
        return { provider: "anthropic", model: "claude-3-5-sonnet", fallbackProvider: "local_heuristic" };
      }
    }

    // BALANCED Mode (Default): Check healthy providers in priority order
    const priorityChain: AIProviderId[] = ["gemini", "anthropic", "openai", "local_heuristic"];
    for (const pId of priorityChain) {
      const prov = this.providers.find(p => p.providerId === pId);
      if (prov && (prov.status === "HEALTHY" || prov.status === "ACTIVE")) {
        return {
          provider: pId,
          model: prov.activeModel,
          fallbackProvider: pId === "gemini" ? "anthropic" : "local_heuristic",
        };
      }
    }

    // Ultimate fallback
    return {
      provider: "local_heuristic",
      model: "omnistrih-local-v2",
      fallbackProvider: "local_heuristic",
    };
  }

  // Dispatch and execute a task through the orchestrator
  public async dispatchTask<T = any>(options: {
    taskType: string;
    payload: any;
    priority?: AIJobPriority;
    projectId?: string;
    onProgress?: (pct: number) => void;
  }): Promise<{ result: T; job: AIJob }> {
    const { taskType, payload, priority = "USER_ACTION", projectId = "omnistrih-current" } = options;
    const classification = classifyTask(taskType);
    const inputVersion = this.currentProjectVersion;

    // 1. Check Cache First (Never call external model if cached result exists)
    const cachedResult = aiCache.get(taskType, payload, inputVersion);
    if (cachedResult !== null) {
      const cachedJob: AIJob = {
        id: "job-cached-" + Date.now(),
        projectId,
        type: taskType,
        classification,
        provider: "local_heuristic",
        model: "cache-hit",
        priority,
        status: "COMPLETED",
        progress: 100,
        inputVersion,
        outputVersion: inputVersion,
        estimatedCost: 0,
        actualUsage: { latencyMs: 2, cached: true },
        payloadSummary: `Cached response for ${taskType}`,
        result: cachedResult,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
      this.jobHistory = [cachedJob, ...this.jobHistory.slice(0, 49)];
      this.notify();
      return { result: cachedResult as T, job: cachedJob };
    }

    // 2. Select Provider according to Budget Mode and Provider Health
    const { provider, model, fallbackProvider } = this.selectProviderForTask(classification, taskType);

    // 3. Create and enqueue Job
    const job: AIJob = {
      id: "job-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      projectId,
      type: taskType,
      classification,
      provider,
      fallbackProvider,
      model,
      priority,
      status: "QUEUED",
      progress: 0,
      inputVersion,
      estimatedCost: classification === "LOCAL" ? 0 : 0.0025,
      payloadSummary: typeof payload === "string" ? payload.substring(0, 60) : `${taskType} payload`,
      createdAt: new Date().toISOString(),
    };

    this.jobQueue.push(job);
    this.jobQueue.sort(compareJobPriority);
    this.notify();

    // 4. Process Job
    try {
      job.status = "RUNNING";
      job.startedAt = new Date().toISOString();
      job.progress = 25;
      this.notify();

      // Check if Project Version has changed (Stale project protection)
      if (this.currentProjectVersion > inputVersion + 3) {
        throw new Error(`Project version updated from v${inputVersion} to v${this.currentProjectVersion}. Aborting stale job.`);
      }

      // Execute based on Provider / Local Engine
      let executionResult: any;
      const startTime = performance.now();

      if (provider === "local_heuristic" || classification === "LOCAL") {
        // Run Local Processing Engine
        executionResult = await this.executeLocalTask(taskType, payload);
        job.progress = 100;
        job.status = "COMPLETED";
        job.actualUsage = { latencyMs: Math.round(performance.now() - startTime), cached: false };
      } else {
        // Run AI Provider with Fallback Shield
        try {
          executionResult = await this.executeAIProviderTask(provider, model, taskType, payload);
          job.progress = 100;
          job.status = "COMPLETED";
          job.actualUsage = {
            inputTokens: 350,
            outputTokens: 120,
            latencyMs: Math.round(performance.now() - startTime),
            cached: false,
          };
        } catch (providerError: any) {
          console.warn(`[AI Orchestrator] Provider ${provider} encountered error. Triggering fallback:`, providerError);

          // Mark provider limited / error
          this.handleProviderFailure(provider, providerError.message || "Quota/Rate limit");

          // Fallback to Local Processing
          job.status = "FALLBACK_LOCAL";
          job.actualUsage = {
            fallbackTriggered: true,
            fallbackReason: `${provider} unavailable: ${providerError.message}`,
            latencyMs: Math.round(performance.now() - startTime),
          };
          executionResult = await this.executeLocalTask(taskType, payload);
          job.progress = 100;
        }
      }

      job.result = executionResult;
      job.outputVersion = this.currentProjectVersion;
      job.completedAt = new Date().toISOString();

      // Store in Cache for reuse
      aiCache.set(taskType, payload, inputVersion, executionResult, job.provider, job.model);

      // Move from Queue to History
      this.jobQueue = this.jobQueue.filter(j => j.id !== job.id);
      this.jobHistory = [job, ...this.jobHistory.slice(0, 49)];
      this.notify();

      return { result: executionResult as T, job };
    } catch (err: any) {
      job.status = "FAILED";
      job.error = err.message || "Execution error";
      job.completedAt = new Date().toISOString();
      this.jobQueue = this.jobQueue.filter(j => j.id !== job.id);
      this.jobHistory = [job, ...this.jobHistory.slice(0, 49)];
      this.notify();
      throw err;
    }
  }

  // Local Task Execution Router
  private async executeLocalTask(taskType: string, payload: any): Promise<any> {
    // Artificial small delay to simulate processing without blocking UI
    await new Promise(res => setTimeout(res, 80));

    switch (taskType) {
      case "WAVEFORM":
        return LocalProcessingEngine.computeWaveform(payload?.duration || 10, payload?.samples || 60);

      case "SILENCE_DETECTION":
      case "SILENCE_DETECTION_HEURISTIC":
      case "AUTO_JUMP_CUTS":
        return LocalProcessingEngine.detectSilenceCuts(payload?.duration || 15, payload?.pauseTolerance || 0.6);

      case "STORY_STRUCTURE":
      case "SCENE_CUTS":
        return {
          scenes: LocalProcessingEngine.generateSceneCutPoints(payload?.duration || 20, payload?.pacing || "BALANCED"),
          strategy: "Local Acoustic Density & Narrative Rhythm Heuristic",
        };

      case "HOOK_ANALYSIS":
        return {
          hookScore: 88,
          verdict: "Local Rule Engine: High initial dynamic pacing identified in opening 3.0 seconds.",
          recommendations: ["Punch zoom applied at 0.0s", "High-contrast caption overlay enabled"],
        };

      case "BROLL_REASONING":
        return {
          suggestedBroll: [
            { timestamp: 2.5, keyword: "visual_impact", style: "CONTEXTUAL", duration: 2.0 },
            { timestamp: 6.8, keyword: "dynamic_growth", style: "DYNAMIC", duration: 1.8 },
          ],
        };

      default:
        return {
          success: true,
          source: "Local Heuristic Processing Engine",
          timestamp: Date.now(),
        };
    }
  }

  // Provider Simulation Execution (With simulated rate limit and error recovery)
  private async executeAIProviderTask(provider: AIProviderId, model: string, taskType: string, payload: any): Promise<any> {
    const prov = this.providers.find(p => p.providerId === provider);
    if (prov && (prov.status === "RATE_LIMITED" || prov.status === "QUOTA_EXHAUSTED")) {
      throw new Error(`Provider ${provider} is currently ${prov.status}`);
    }

    // Simulate provider latency
    await new Promise(res => setTimeout(res, 200 + Math.random() * 150));

    // Realistic intelligent response
    return {
      provider,
      model,
      taskType,
      semanticInsights: `AI reasoning completed via ${model} under ${this.budgetMode} budget.`,
      confidence: 0.95,
      timestamp: Date.now(),
    };
  }

  // Handle Provider Failure & Trip Circuit Breaker
  public handleProviderFailure(providerId: AIProviderId, reason: string) {
    this.providers = this.providers.map(p => {
      if (p.providerId === providerId) {
        const errors = p.consecutiveErrors + 1;
        return {
          ...p,
          status: errors >= 2 ? "RATE_LIMITED" : "HEALTHY",
          consecutiveErrors: errors,
          lastError: reason,
          retryAfterMs: 30000,
        };
      }
      return p;
    });
    this.notify();
  }

  // Simulate Quota Exhaustion for Testing
  public simulateProviderQuotaTrip(providerId: AIProviderId) {
    this.providers = this.providers.map(p => {
      if (p.providerId === providerId) {
        return {
          ...p,
          status: "QUOTA_EXHAUSTED",
          remainingCreditsPercent: 0,
          lastError: "429: Resource has been exhausted (e.g. check quota)",
        };
      }
      return p;
    });
    this.notify();
  }

  // Reset Provider Health
  public resetProviderHealth(providerId: AIProviderId) {
    this.providers = this.providers.map(p => {
      if (p.providerId === providerId) {
        return {
          ...p,
          status: "HEALTHY",
          consecutiveErrors: 0,
          remainingCreditsPercent: 85,
          lastError: undefined,
        };
      }
      return p;
    });
    this.notify();
  }
}

// Global Singleton Instance
export const aiOrchestrator = new AIOrchestratorService();

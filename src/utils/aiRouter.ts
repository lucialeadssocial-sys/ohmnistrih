// src/utils/aiRouter.ts
import { AIProvider, AIResourceState, AIRoutingDecision, AIBudgetMode, AICredentialCapability } from "../types";
import { AuthManager } from "./authManager";
import { AICredentialManager } from "./credentialManager";

class AIOrchestratorClass {
  private budgetMode: AIBudgetMode = "BALANCED";
  private cache: Map<string, any> = new Map();

  private resources: Record<AIProvider, AIResourceState> = {
    GEMINI_FLASH: { provider: "GEMINI_FLASH", status: "available", requestsUsed: 0, requestLimit: 100, tokensUsed: 0, tokenLimit: 100000 },
    GEMINI_PRO: { provider: "GEMINI_PRO", status: "available", requestsUsed: 0, requestLimit: 50, tokensUsed: 0, tokenLimit: 50000 },
    LOCAL: { provider: "LOCAL", status: "available", requestsUsed: 0, requestLimit: 99999, tokensUsed: 0, tokenLimit: 99999 },
    MANUAL: { provider: "MANUAL", status: "available", requestsUsed: 0, requestLimit: 99999, tokensUsed: 0, tokenLimit: 99999 },
  };

  public setBudgetMode(mode: AIBudgetMode) {
    this.budgetMode = mode;
    console.log(`[BudgetBrain] Mode set to: ${mode}`);
  }

  public getBudgetMode(): AIBudgetMode {
    return this.budgetMode;
  }

  public routeTask(taskType: string, taskInput?: any): AIRoutingDecision {
    // 1. TOKEN SAVER: Check Cache First
    const cacheKey = `${taskType}_${JSON.stringify(taskInput)}`;
    if (this.cache.has(cacheKey)) {
      return { provider: "LOCAL", reason: "Result served from cache", isCached: true };
    }

    // 2. DETERMINISTIC FIRST: Never spend AI if local can do it
    const localTasks = [
      "IMPORT",
      "LOCAL_ANALYSIS",
      "THUMBNAILS",
      "WAVEFORM",
      "AUDIO_NORMALIZATION",
      "SILENCE_DETECTION",
      "LOCAL_TRANSCRIBE",
      "CUT_MARKERS_LOCAL",
    ];
    if (localTasks.includes(taskType)) {
      return { provider: "LOCAL", reason: "Deterministic local processing preferred" };
    }

    // 3. BUDGET BRAIN: Apply budget constraints
    if (this.budgetMode === "FREE_ONLY") {
      return { provider: "LOCAL", reason: "Budget constrained to Free Only" };
    }

    // 4. Map task type to capability
    let reqCapability: AICredentialCapability = "VIDEO_ANALYSIS";
    if (["TRANSCRIPTION", "AUDIO", "SPEECH_TO_TEXT"].includes(taskType)) {
      reqCapability = "AUDIO";
    } else if (["STORY_PLAN", "REASONING", "SCRIPT_GEN"].includes(taskType)) {
      reqCapability = "TEXT_REASONING";
    } else if (["THUMBNAIL_GEN", "IMAGE_OVERLAY"].includes(taskType)) {
      reqCapability = "IMAGE";
    }

    // Economy mode check for non-essential tasks
    if (this.budgetMode === "ECONOMY" && ["BROLL", "ZOOMS", "SFX_SUGGESTION"].includes(taskType)) {
      return { provider: "LOCAL", reason: "Economy mode: Skipping non-essential AI" };
    }

    // 5. Select best available credential
    const isGeminiAvailable = this.resources.GEMINI_FLASH.status === "available";
    const bestCred = isGeminiAvailable
      ? AICredentialManager.selectBestCredential({
          capability: reqCapability,
        })
      : null;

    if (bestCred) {
      const isShared = bestCred.projectId ? AICredentialManager.isProjectShared(bestCred.projectId) : false;
      return {
        provider: "GEMINI_FLASH",
        reason: `Routed to credential: ${bestCred.name} (${bestCred.model || "gemini-3.8-flash"})`,
        credentialId: bestCred.id,
        model: bestCred.model,
        quotaScope: bestCred.quotaScope,
        isSharedQuota: isShared,
      };
    }

    // 6. DETERMINISTIC LOCAL FALLBACK (never fail user or halt editing)
    return {
      provider: "LOCAL",
      reason: "No AI credential available or quota in cooldown — deterministic local fallback",
    };
  }

  public updateQuota(provider: AIProvider, used: number) {
    this.resources[provider].requestsUsed += used;
    if (this.resources[provider].requestsUsed >= this.resources[provider].requestLimit) {
      this.resources[provider].status = "limited";
    }
  }

  public markProviderAsExhausted(provider: AIProvider) {
    this.resources[provider].status = "limited";
    console.warn(`[Resilience] Provider ${provider} marked as exhausted.`);
  }

  public addToCache(taskType: string, taskInput: any, result: any) {
    const cacheKey = `${taskType}_${JSON.stringify(taskInput)}`;
    this.cache.set(cacheKey, result);
  }

  public clearCache() {
    this.cache.clear();
  }
}

export const AIOrchestrator = new AIOrchestratorClass();

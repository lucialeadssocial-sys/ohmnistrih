// src/utils/credentialManager.ts
import { AIProviderCredential, AICredentialCapability, CredentialStatus, QuotaScope } from "../types";

export interface TestCredentialResult {
  valid: boolean;
  status: CredentialStatus | string;
  message: string;
  quotaState?: string;
  provider?: string;
}

export interface SharedProjectSummary {
  projectId: string;
  credentialCount: number;
  isSharedQuota: boolean;
  status: "ok" | "rate-limited" | "cooldown";
  note?: string;
}

class AICredentialManagerClass {
  private credentials: AIProviderCredential[] = [];
  private secretsStore: Map<string, string> = new Map(); // Server-like in-memory secret store for testing/local
  private isInitialized = false;

  // Stav spojenia s backendom – aby UI vedelo rozlíšiť "nemám kľúče"
  // od "server nebeží" (predtým sa obe tvári­li rovnako – prázdny zoznam).
  private backendStatus: "unknown" | "ok" | "offline" = "unknown";
  private backendError: string | null = null;

  constructor() {
    // Zámerne sa NEseeduje žiadny credential.
    // V staršej verzii tu vznikala falošná položka „Systémový Google Gemini Kľúč“
    // s vymysleným kľúčom (AIzaSyDefaultSystemEnvKeySecret0000). V UI sa tvárila
    // ako funkčný Gemini kľúč, ale každý test aj AI volanie museli zlyhať.
    // Reálne kľúče sa načítajú z backendu cez initFromBackend(); ak prostredie
    // definuje GEMINI_API_KEY, backend pridá skutočný systémový kľúč.
  }

  public getBackendStatus(): "unknown" | "ok" | "offline" {
    return this.backendStatus;
  }

  public getBackendError(): string | null {
    return this.backendError;
  }

  public maskSecret(secret: string): string {
    if (!secret || typeof secret !== "string") return "••••••••";
    const trimmed = secret.trim();
    if (trimmed.length < 10) return "••••••••";
    return `${trimmed.slice(0, 7)}...${trimmed.slice(-4)}`;
  }

  public async initFromBackend(): Promise<void> {
    if (typeof window === "undefined") {
      this.isInitialized = true;
      return;
    }
    try {
      const res = await fetch("/api/keys");
      if (!res.ok) {
        this.backendStatus = "offline";
        this.backendError = `Server odpovedal HTTP ${res.status}.`;
        return;
      }
      const json = await res.json();
      if (json.success && Array.isArray(json.keys)) {
        this.credentials = json.keys.map((k: any) => this.normalizeBackendKey(k));
        this.backendStatus = "ok";
        this.backendError = null;
      } else {
        this.backendStatus = "offline";
        this.backendError = "Server vrátil neočakávanú odpoveď.";
      }
    } catch (err: any) {
      // Backend nebeží (napr. po reštarte prostredia) – už žiadny falošný kľúč,
      // len jasná informácia pre UI.
      this.backendStatus = "offline";
      this.backendError = err?.message || "Server neodpovedá.";
    } finally {
      this.isInitialized = true;
    }
  }

  private normalizeBackendKey(backendKey: any): AIProviderCredential {
    let status: CredentialStatus = "READY";
    if (!backendKey.enabled) {
      status = "DISABLED";
    } else if (backendKey.status === "rate-limited") {
      status = "COOLDOWN";
    } else if (backendKey.status === "error") {
      status = "INVALID";
    }

    return {
      id: backendKey.id,
      name: backendKey.name || "AI Credential",
      keyMasked: backendKey.keyMasked || this.maskSecret(backendKey.key || ""),
      provider: backendKey.provider || "gemini",
      providerLabel: backendKey.providerLabel || "Google Gemini",
      enabled: backendKey.enabled !== false,
      priority: backendKey.priority || "NORMAL",
      preferred: !!backendKey.preferred,
      capabilities: backendKey.capabilities || ["VIDEO_ANALYSIS", "TEXT_REASONING", "STRUCTURED_OUTPUT", "IMAGE", "AUDIO"],
      model: backendKey.model || "gemini-3.8-flash",
      projectId: backendKey.projectId || "gcp-project-default",
      quotaScope: backendKey.quotaScope || "PROJECT",
      status,
      isDefaultSystemKey: !!backendKey.isDefaultSystemKey,
      addedAt: backendKey.addedAt || new Date().toISOString(),
      requestCount: backendKey.requestCount || 0,
      errorCount: backendKey.errorCount || 0,
      lastSuccessfulUse: backendKey.lastSuccessfulUse,
      lastError: backendKey.lastError,
      lastTestResult: backendKey.lastTestResult,
    };
  }

  public getCredentials(): AIProviderCredential[] {
    const now = Date.now();
    // Auto-restore cooldowns
    this.credentials.forEach((c) => {
      if (c.status === "COOLDOWN" && c.cooldownUntil && now > c.cooldownUntil) {
        c.status = c.enabled ? "READY" : "DISABLED";
        c.cooldownUntil = undefined;
      }
    });
    return [...this.credentials];
  }

  public getCredentialById(id: string): AIProviderCredential | null {
    return this.credentials.find((c) => c.id === id) || null;
  }

  public async addCredential(params: {
    key: string;
    name?: string;
    provider?: "gemini" | "groq" | "openrouter" | "custom";
    capabilities?: AICredentialCapability[];
    model?: string;
    priority?: "HIGH" | "NORMAL" | "LOW";
    preferred?: boolean;
    projectId?: string;
    quotaScope?: QuotaScope;
  }): Promise<AIProviderCredential> {
    if (!params.key || params.key.trim().length < 8) {
      throw new Error("Neplatný kľúč. Minimálna dĺžka je 8 znakov.");
    }
    const rawKey = params.key.trim();
    const masked = this.maskSecret(rawKey);

    // Call backend if available in browser
    if (typeof window !== "undefined") {
      try {
        const res = await fetch("/api/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.key) {
            const normalized = this.normalizeBackendKey(data.key);
            this.credentials.push(normalized);
            this.secretsStore.set(normalized.id, rawKey);
            return normalized;
          }
        }
      } catch {
        // Fall back to local in-memory operation
      }
    }

    const newId = `key-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newCred: AIProviderCredential = {
      id: newId,
      name: params.name || `Gemini Credential ${this.credentials.length + 1}`,
      keyMasked: masked,
      provider: params.provider || "gemini",
      providerLabel: params.provider === "groq" ? "Groq Cloud" : "Google Gemini",
      enabled: true,
      priority: params.priority || "NORMAL",
      preferred: !!params.preferred,
      capabilities: params.capabilities || ["VIDEO_ANALYSIS", "TEXT_REASONING", "STRUCTURED_OUTPUT", "IMAGE", "AUDIO"],
      model: params.model || "gemini-3.8-flash",
      projectId: params.projectId || `gcp-project-${Math.random().toString(36).substring(2, 7)}`,
      quotaScope: params.quotaScope || "PROJECT",
      status: "READY",
      isDefaultSystemKey: false,
      addedAt: new Date().toISOString(),
      requestCount: 0,
      errorCount: 0,
    };

    this.credentials.push(newCred);
    this.secretsStore.set(newId, rawKey);
    return newCred;
  }

  public async removeCredential(id: string): Promise<boolean> {
    const cred = this.credentials.find((c) => c.id === id);
    if (!cred) return false;
    if (cred.isDefaultSystemKey) {
      throw new Error("Systémový kľúč nie je možné odstrániť.");
    }

    if (typeof window !== "undefined") {
      try {
        await fetch(`/api/keys/${id}`, { method: "DELETE" });
      } catch {
        // Local in-memory sync
      }
    }

    this.credentials = this.credentials.filter((c) => c.id !== id);
    this.secretsStore.delete(id);
    return true;
  }

  public async toggleCredential(id: string, enabled: boolean): Promise<boolean> {
    const cred = this.credentials.find((c) => c.id === id);
    if (!cred) return false;

    cred.enabled = enabled;
    cred.status = enabled ? "READY" : "DISABLED";

    if (typeof window !== "undefined") {
      try {
        await fetch(`/api/keys/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        });
      } catch {
        // Local in-memory sync
      }
    }

    return true;
  }

  public async updateCredential(id: string, updates: Partial<AIProviderCredential>): Promise<boolean> {
    const cred = this.credentials.find((c) => c.id === id);
    if (!cred) return false;

    Object.assign(cred, updates);
    if (typeof updates.enabled === "boolean") {
      cred.status = updates.enabled ? "READY" : "DISABLED";
    }

    if (typeof window !== "undefined") {
      try {
        await fetch(`/api/keys/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
      } catch {
        // Local in-memory sync
      }
    }

    return true;
  }

  public async testCredential(keyOrId: string): Promise<TestCredentialResult> {
    if (!keyOrId) {
      return { valid: false, status: "INVALID", message: "Kľúč je prázdny." };
    }

    // In browser, test via backend endpoint
    if (typeof window !== "undefined") {
      try {
        const isId = this.credentials.some((c) => c.id === keyOrId);
        const payload = isId ? { id: keyOrId } : { key: keyOrId };
        const res = await fetch("/api/keys/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        return {
          valid: !!data.valid,
          status: data.status || (data.valid ? "READY" : "INVALID"),
          message: data.message || data.error || "Odpoveď testu",
          quotaState: data.quotaState,
          provider: data.provider,
        };
      } catch (err: any) {
        return { valid: false, status: "ERROR", message: err.message };
      }
    }

    // Test environment simulation / local validation
    const trimmed = keyOrId.trim();
    if (trimmed.length < 8 || trimmed.includes("invalid") || trimmed.includes("revoked") || trimmed.includes("bad_key")) {
      return {
        valid: false,
        status: "INVALID",
        message: "Neplatný formát API kľúča alebo zamietnutý autorizačný token.",
      };
    }

    if (trimmed.includes("quota_exhausted") || trimmed.includes("rate_limited")) {
      return {
        valid: false,
        status: "RATE_LIMITED",
        quotaState: "EXHAUSTED",
        message: "Kvóta pre tento projekt je vyčerpaná (429 RESOURCE_EXHAUSTED).",
      };
    }

    return {
      valid: true,
      status: "READY",
      message: "API kľúč je platný a pripravený na použitie.",
    };
  }

  /**
   * Selects best available valid AI credential based on:
   * - Enabled & not in cooldown
   * - Supporting requested capability
   * - Supporting requested model
   * - Respecting priority & preferred flag
   * - Avoiding projects already marked as exhausted
   */
  public selectBestCredential(options?: {
    capability?: AICredentialCapability;
    model?: string;
    excludeProjectId?: string;
  }): AIProviderCredential | null {
    const now = Date.now();
    const candidatePool = this.getCredentials().filter((c) => {
      if (!c.enabled) return false;
      if (c.status === "DISABLED" || c.status === "INVALID") return false;
      if (c.status === "COOLDOWN" && c.cooldownUntil && now <= c.cooldownUntil) return false;
      if (c.status === "RATE_LIMITED") return false;
      if (options?.excludeProjectId && c.projectId === options.excludeProjectId) return false;
      if (options?.capability && c.capabilities && !c.capabilities.includes(options.capability)) return false;
      if (options?.model && c.model && c.model !== options.model) return false;
      return true;
    });

    if (candidatePool.length === 0) return null;

    // Sort: Preferred first, then user keys over default system key, then HIGH -> NORMAL -> LOW, then wear leveling
    return candidatePool.sort((a, b) => {
      if (a.preferred && !b.preferred) return -1;
      if (!a.preferred && b.preferred) return 1;

      if (!a.isDefaultSystemKey && b.isDefaultSystemKey) return -1;
      if (a.isDefaultSystemKey && !b.isDefaultSystemKey) return 1;

      const prioRank = { HIGH: 3, NORMAL: 2, LOW: 1 };
      const rankA = prioRank[a.priority] || 2;
      const rankB = prioRank[b.priority] || 2;
      if (rankB !== rankA) return rankB - rankA;

      return a.requestCount - b.requestCount;
    })[0];
  }

  /**
   * Safe failover & shared quota handler:
   * When a credential hits a quota limit (429 / RESOURCE_EXHAUSTED):
   * Marks ALL credentials under the same Google Cloud Project ID as in cooldown.
   * NEVER switches to another key in the same project!
   */
  public handleQuotaExhausted(credentialId: string, errorReason?: string): void {
    const cred = this.credentials.find((c) => c.id === credentialId);
    if (!cred) return;

    const cooldownTime = Date.now() + 60000; // 60s cooldown
    cred.status = "COOLDOWN";
    cred.cooldownUntil = cooldownTime;
    cred.lastError = errorReason || "Quota exceeded (429)";

    // Project-level quota awareness
    if (cred.projectId && cred.quotaScope === "PROJECT") {
      this.credentials.forEach((other) => {
        if (other.id !== cred.id && other.projectId === cred.projectId) {
          other.status = "COOLDOWN";
          other.cooldownUntil = cooldownTime;
          other.lastError = `Zdieľaná kvóta projektu (${cred.projectId}) je dočasne vyčerpaná.`;
        }
      });
    }
  }

  public isProjectShared(projectId: string): boolean {
    if (!projectId) return false;
    return this.credentials.filter((c) => c.projectId === projectId).length > 1;
  }

  public getSharedProjects(): SharedProjectSummary[] {
    const projectMap = new Map<string, { count: number; inCooldown: number }>();
    this.credentials.forEach((c) => {
      const pId = c.projectId || "unassigned";
      const cur = projectMap.get(pId) || { count: 0, inCooldown: 0 };
      cur.count++;
      if (c.status === "COOLDOWN" || c.status === "RATE_LIMITED") cur.inCooldown++;
      projectMap.set(pId, cur);
    });

    return Array.from(projectMap.entries()).map(([projectId, data]) => ({
      projectId,
      credentialCount: data.count,
      isSharedQuota: data.count > 1,
      status: data.inCooldown > 0 ? "cooldown" : "ok",
      note: data.count > 1 ? "Zdieľaná projektová kvóta (Shared Project Quota)" : "Samostatná kvóta",
    }));
  }

  public hasAvailableCredential(capability?: AICredentialCapability): boolean {
    return this.selectBestCredential({ capability }) !== null;
  }

  public recordSuccess(credentialId: string): void {
    const cred = this.credentials.find((c) => c.id === credentialId);
    if (cred) {
      cred.requestCount++;
      cred.lastSuccessfulUse = new Date().toISOString();
      cred.status = "READY";
    }
  }

  public resetAllForTesting(): void {
    this.credentials = [];
    this.secretsStore.clear();
  }
}

export const AICredentialManager = new AICredentialManagerClass();

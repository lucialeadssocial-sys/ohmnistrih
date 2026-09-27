// src/utils/AICredentialManagerVerificationSuite.ts
import { AICredentialManager } from "./credentialManager";
import { AIOrchestrator } from "./aiRouter";

// Polyfill localStorage in test/Node environments if needed
if (typeof globalThis.localStorage === "undefined") {
  const memStore = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => memStore.get(k) || null,
    setItem: (k: string, v: string) => {
      memStore.set(k, String(v));
    },
    removeItem: (k: string) => {
      memStore.delete(k);
    },
    clear: () => {
      memStore.clear();
    },
    key: (i: number) => Array.from(memStore.keys())[i] || null,
    length: 0,
  };
}

export interface CredentialTestResult {
  id: number;
  name: string;
  category: "Security" | "MultiKey" | "Routing" | "SharedQuota" | "Failover" | "Resilience";
  status: "PASS" | "FAIL";
  details: string;
}

export interface CredentialVerificationSummary {
  total: number;
  passed: number;
  failed: number;
  status: "VERIFIED" | "PARTIAL" | "FAILED";
  results: CredentialTestResult[];
}

export async function runAICredentialManagerVerificationSuite(): Promise<CredentialVerificationSummary> {
  const results: CredentialTestResult[] = [];

  const record = (
    id: number,
    name: string,
    category: CredentialTestResult["category"],
    passed: boolean,
    details: string
  ) => {
    results.push({
      id,
      name,
      category,
      status: passed ? "PASS" : "FAIL",
      details,
    });
  };

  try {
    // Reset state for deterministic testing
    AICredentialManager.resetAllForTesting();
    AIOrchestrator.clearCache();
    AIOrchestrator.setBudgetMode("BALANCED");

    // 1. Security & Key Masking Test
    const rawSecret = "AIzaSyB345678901234567890abcdef";
    const masked = AICredentialManager.maskSecret(rawSecret);
    const pass1 = masked === "AIzaSyB...cdef" && !masked.includes("45678901234567890");
    record(
      1,
      "Key Masking & Secret Leakage Prevention",
      "Security",
      pass1,
      `Masked format verified: '${masked}'. Raw secret is strictly shielded.`
    );

    // 2. Multi-Key Credential Registration
    const credAlpha1 = await AICredentialManager.addCredential({
      key: "AIzaSyAlphaKey1Secret9999",
      name: "Project Alpha Primary Key",
      projectId: "gcp-project-alpha",
      priority: "HIGH",
      preferred: true,
      model: "gemini-3.8-flash",
      capabilities: ["VIDEO_ANALYSIS", "TEXT_REASONING", "STRUCTURED_OUTPUT"],
      quotaScope: "PROJECT",
    });

    const credAlpha2 = await AICredentialManager.addCredential({
      key: "AIzaSyAlphaKey2Secret8888",
      name: "Project Alpha Secondary Key",
      projectId: "gcp-project-alpha",
      priority: "NORMAL",
      preferred: false,
      model: "gemini-3.8-flash",
      capabilities: ["VIDEO_ANALYSIS", "AUDIO"],
      quotaScope: "PROJECT",
    });

    const credBeta1 = await AICredentialManager.addCredential({
      key: "AIzaSyBetaKey1Secret7777",
      name: "Project Beta Independent Key",
      projectId: "gcp-project-beta",
      priority: "NORMAL",
      preferred: false,
      model: "gemini-3.8-pro",
      capabilities: ["VIDEO_ANALYSIS", "AUDIO", "TEXT_REASONING"],
      quotaScope: "PROJECT",
    });

    const allCreds = AICredentialManager.getCredentials();
    const pass2 = allCreds.length >= 4 && allCreds.some((c) => c.id === credAlpha1.id);
    record(
      2,
      "Multi-Credential Pool Registration",
      "MultiKey",
      pass2,
      `Successfully registered multiple user credentials with metadata. Total count: ${allCreds.length}.`
    );

    // 3. Shared Project Quota Detection
    const sharedProjects = AICredentialManager.getSharedProjects();
    const alphaShared = sharedProjects.find((p) => p.projectId === "gcp-project-alpha");
    const betaShared = sharedProjects.find((p) => p.projectId === "gcp-project-beta");

    const pass3 =
      alphaShared !== undefined &&
      alphaShared.isSharedQuota === true &&
      alphaShared.credentialCount === 2 &&
      betaShared !== undefined &&
      betaShared.isSharedQuota === false;

    record(
      3,
      "GCP Shared Project Quota Detection",
      "SharedQuota",
      pass3,
      `Project 'gcp-project-alpha' correctly recognized as shared quota (2 keys). Project 'gcp-project-beta' is single quota.`
    );

    // 4. Deterministic Local First Routing
    const localDecision = AIOrchestrator.routeTask("LOCAL_ANALYSIS", { videoId: "test-vid" });
    const pass4 = localDecision.provider === "LOCAL" && localDecision.reason.includes("Deterministic");
    record(
      4,
      "Deterministic-First Routing Guard",
      "Routing",
      pass4,
      `Local tasks ('LOCAL_ANALYSIS') routed to 'LOCAL' provider without touching AI quota.`
    );

    // 5. Token Saver Cache Test
    AIOrchestrator.addToCache("VIDEO_ANALYSIS", { videoId: "cached-vid" }, { transcript: "cached transcript" });
    const cacheDecision = AIOrchestrator.routeTask("VIDEO_ANALYSIS", { videoId: "cached-vid" });
    const pass5 = cacheDecision.provider === "LOCAL" && cacheDecision.isCached === true;
    record(
      5,
      "Token Saver Cache Bypass",
      "Routing",
      pass5,
      `Cached task served from cache (provider: LOCAL, isCached: true) with zero API consumption.`
    );

    // 6. Capability & Priority Matching
    // credAlpha1 is preferred: true, priority: HIGH, has VIDEO_ANALYSIS
    const aiDecision = AIOrchestrator.routeTask("VIDEO_ANALYSIS", { videoId: "new-vid" });
    const pass6 = aiDecision.provider === "GEMINI_FLASH" && aiDecision.credentialId === credAlpha1.id;
    record(
      6,
      "Capability & Priority-Based Selection",
      "Routing",
      pass6,
      `Task 'VIDEO_ANALYSIS' correctly routed to preferred credential '${credAlpha1.name}'.`
    );

    // 7. Specialized Audio Capability Routing
    // credAlpha1 does NOT have AUDIO capability; credAlpha2 and credBeta1 DO
    const audioDecision = AIOrchestrator.routeTask("TRANSCRIPTION", { audioTrack: 1 });
    const pass7 =
      audioDecision.provider === "GEMINI_FLASH" &&
      (audioDecision.credentialId === credAlpha2.id || audioDecision.credentialId === credBeta1.id);
    record(
      7,
      "Specialized Audio Capability Routing",
      "Routing",
      pass7,
      `Audio task correctly routed to credential possessing AUDIO capability.`
    );

    // 8. Safe Failover & Shared Project Quota Enforcement (The Golden Rule)
    // When credAlpha1 hits 429 quota exhaustion:
    // credAlpha2 (same projectId: 'gcp-project-alpha') MUST ALSO be put on cooldown!
    // The system MUST NOT rotatively spam credAlpha2!
    AICredentialManager.handleQuotaExhausted(credAlpha1.id, "RESOURCE_EXHAUSTED (429)");

    const refreshedAlpha1 = AICredentialManager.getCredentialById(credAlpha1.id);
    const refreshedAlpha2 = AICredentialManager.getCredentialById(credAlpha2.id);

    const pass8 = Boolean(
      refreshedAlpha1?.status === "COOLDOWN" &&
      refreshedAlpha2?.status === "COOLDOWN" &&
      refreshedAlpha2?.lastError?.includes("Zdieľaná kvóta projektu")
    );

    record(
      8,
      "Shared Project Quota Cooldown Enforcement",
      "SharedQuota",
      pass8,
      `When credAlpha1 hit 429, credAlpha2 in the same project was placed in cooldown. No quota evasion occurs.`
    );

    // 9. Independent Project Failover
    // Now that Project Alpha is in cooldown, the orchestrator should route to Project Beta!
    const failoverDecision = AIOrchestrator.routeTask("VIDEO_ANALYSIS", { videoId: "next-vid" });
    const pass9 =
      failoverDecision.provider === "GEMINI_FLASH" && failoverDecision.credentialId === credBeta1.id;
    record(
      9,
      "Cross-Project Safe Failover",
      "Failover",
      pass9,
      `With Project Alpha in cooldown, orchestrator seamlessly failed over to independent Project Beta.`
    );

    // 10. Graceful Local Fallback when All AI is Exhausted
    // Mark Project Beta in cooldown as well
    AICredentialManager.handleQuotaExhausted(credBeta1.id, "RESOURCE_EXHAUSTED (429)");
    const defaultSystem = AICredentialManager.getCredentialById("system-key-default");
    if (defaultSystem) {
      AICredentialManager.handleQuotaExhausted(defaultSystem.id, "System key quota exhausted");
    }

    const exhaustedDecision = AIOrchestrator.routeTask("VIDEO_ANALYSIS", { videoId: "final-vid" });
    const pass10 =
      exhaustedDecision.provider === "LOCAL" &&
      exhaustedDecision.reason.includes("deterministic local fallback");

    record(
      10,
      "All-AI Exhausted Deterministic Local Fallback",
      "Resilience",
      pass10,
      `When all AI credentials hit cooldown, system smoothly falls back to LOCAL deterministic engine without failing.`
    );

    // 11. Credential Disabling & Toggle Control
    AICredentialManager.resetAllForTesting();
    const testCred = await AICredentialManager.addCredential({
      key: "AIzaSyTestToggleSecret0000",
      name: "Toggle Test Key",
      projectId: "gcp-project-toggle",
      priority: "HIGH",
      capabilities: ["VIDEO_ANALYSIS"],
    });

    await AICredentialManager.toggleCredential(testCred.id, false);
    const candidate = AICredentialManager.selectBestCredential({ capability: "VIDEO_ANALYSIS" });
    const pass11 = candidate?.id !== testCred.id;
    record(
      11,
      "Credential Toggle & State Invalidation",
      "MultiKey",
      pass11,
      `Disabled credential is immediately removed from the active candidate pool.`
    );

    // 12. Budget Brain FREE_ONLY Enforcement
    AIOrchestrator.setBudgetMode("FREE_ONLY");
    const freeOnlyDecision = AIOrchestrator.routeTask("VIDEO_ANALYSIS", { videoId: "budget-vid" });
    const pass12 = freeOnlyDecision.provider === "LOCAL" && freeOnlyDecision.reason.includes("Free Only");
    record(
      12,
      "Zero-Token / Free-Only Mode Immunity",
      "Resilience",
      pass12,
      `Budget mode 'FREE_ONLY' forces 100% deterministic local execution, consuming 0 AI tokens.`
    );
  } catch (err: any) {
    record(99, "Suite Runtime Exception", "Resilience", false, `Exception during execution: ${err.message}`);
  }

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const status = failed === 0 ? "VERIFIED" : passed > 0 ? "PARTIAL" : "FAILED";

  return {
    total: results.length,
    passed,
    failed,
    status,
    results,
  };
}

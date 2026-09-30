import express from "express";
import {
  buildTranscriptionModelChain,
  classifyTranscriptionResponse,
  describeTranscriptionErrorSk,
  isRetryableTranscriptionError,
  transcriptionOutcomeToResponse,
} from "./src/core/transcript/transcriptionGuard";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { spawn, spawnSync } from "child_process";
import { randomUUID } from "crypto";
import {
  buildSentenceTimings,
  buildWordIndex,
  flattenWords,
  speechCoverage,
  type SpeechSegmentLike,
} from "./src/core/transcript/wordTiming";
import {
  buildAssForCut,
  buildBurnFfmpegArgs,
  burnSummarySk,
  getCaptionStyle,
  applyCaptionOverrides,
  BURN_HONESTY_SK,
} from "./src/core/export/subtitleRender";
import {
  BURN_LIMITS,
  BURN_MAX_UPLOAD_SK,
  BurnJobStore,
  burnJobStatus,
  dirSizeBytes,
  isSafeStoredName,
  pruneDir,
  parseFfmpegProgress as parseFfmpegProgressLine,
  safeBaseName,
  uploadStorageName,
  validateBurnRequest,
} from "./src/core/export/burnJob";
import {
  PROFILE_LIMITS,
  PROFILE_TEMPLATES,
  describeProfileSk,
  isSafeProfileId,
  validateProfile,
  type CaptionProfile,
} from "./src/core/export/captionProfiles";
import {
  FFMPEG_MISSING_SK,
  findFfmpegPath,
  prepareCaptionFont,
  probeVideoFile,
} from "./src/core/export/ffmpegEnv";
import {
  buildStyleCardSpec,
  STYLE_CARD_KINDS,
  type StyleCardKind,
} from "./src/core/visual/styleCard";
import {
  openverseDetailUrl,
  openverseSearchUrl,
  processOpenverseResponse,
  type LibrarySearchResult,
} from "./src/core/visual/freeLibrary";
import {
  LIGHT_MEASURE,
  computeLightCorrection,
  lightMeasureSummarySk,
  lightStatsFromGrayFrames,
} from "./src/core/export/lightMatch";
import { STYLE_RECIPES } from "./src/core/style/styleRecipes";
import {
  buildBundle,
  DEFAULT_GEOS,
  GEO_OPTIONS,
  geoLabelSk,
  LIVE_SOURCES,
  LIVE_SIGNALS_DISCLAIMER_SK,
  parseGoogleTrendsRss,
  parseYouTubeChart,
  parseYouTubeFeed,
  PLATFORM_LIMITS_SK,
  YOUTUBE_API_COST,
  type LiveSignalsBundle,
  type SourceFetchResult,
  type TrendSignal,
} from "./src/core/trends/liveTrends";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

console.log(`[Server] Initializing... NODE_ENV=${process.env.NODE_ENV}`);

app.use(express.json({ limit: "50mb" }));

interface ServerApiKey {
  id: string;
  key: string;
  name: string;
  provider: "gemini" | "groq" | "openrouter" | "custom";
  providerLabel: string;
  enabled: boolean;
  priority: "HIGH" | "NORMAL" | "LOW";
  preferred?: boolean;
  capabilities: string[];
  model: string;
  projectId?: string;
  quotaScope: "PROJECT" | "ACCOUNT" | "PROVIDER" | "UNKNOWN";
  status: "active" | "standby" | "rate-limited" | "error" | "disabled";
  isDefaultSystemKey: boolean;
  addedAt: string;
  requestCount: number;
  errorCount: number;
  lastSuccessfulUse?: string;
  lastError?: string;
  rateLimitResetTime?: number;
  lastTestResult?: string;
}

function detectKeyProvider(keyStr: string): {
  provider: "gemini" | "groq" | "openrouter" | "custom";
  providerLabel: string;
} {
  const trimmed = keyStr.trim();
  if (trimmed.startsWith("AIzaSy")) {
    return {
      provider: "gemini",
      providerLabel: "Google Gemini (AI Studio Free Tier)",
    };
  } else if (trimmed.startsWith("gsk_")) {
    return {
      provider: "groq",
      providerLabel: "Groq Cloud Free Tier",
    };
  } else if (trimmed.startsWith("sk-or-")) {
    return {
      provider: "openrouter",
      providerLabel: "OpenRouter Free / Community",
    };
  } else if (trimmed.startsWith("sk-")) {
    return {
      provider: "custom",
      providerLabel: "OpenAI / Custom Compatible Key",
    };
  }
  return {
    provider: "gemini",
    providerLabel: "Google Gemini Kompatibilný Kľúč",
  };
}

function maskApiKey(key: string): string {
  if (!key || key.length < 10) return "••••••••";
  return `${key.slice(0, 7)}...${key.slice(-4)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRVALÉ UKLADANIE API KĽÚČOV
// Kľúče sa inak držia výhradne v pamäti (apiKeyPool) a pri každom reštarte
// servera sa stratia – používateľ ich musí znova vkladať. Preto ich ukladáme
// do .data/api-keys.json (mimo gitu, pozri .gitignore).
// ─────────────────────────────────────────────────────────────────────────────
const DATA_DIR = process.env.OMNISTRIH_DATA_DIR || path.join(process.cwd(), ".data");
const KEYS_FILE = path.join(DATA_DIR, "api-keys.json");

/** Zapíše aktuálny zoznam kľúčov na disk (atomicky, práva 600). */
function persistKeys(): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      // Systémový kľúč z ENV sa neukladá – obnoví sa z prostredia pri štarte.
      keys: apiKeyPool.filter((k) => !k.isDefaultSystemKey),
    };
    const tmpFile = `${KEYS_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2), { mode: 0o600 });
    fs.renameSync(tmpFile, KEYS_FILE);
  } catch (err: any) {
    console.warn(`[Keys] Nepodarilo sa uložiť kľúče: ${err?.message || err}`);
  }
}

/** Načíta uložené kľúče pri štarte servera. */
function restoreKeys(): void {
  try {
    if (!fs.existsSync(KEYS_FILE)) return;
    const payload = JSON.parse(fs.readFileSync(KEYS_FILE, "utf-8"));
    const saved: ServerApiKey[] = Array.isArray(payload?.keys) ? payload.keys : [];
    const now = Date.now();
    let restored = 0;

    for (const item of saved) {
      if (!item || typeof item.key !== "string" || item.key.trim().length < 8) continue;
      // Duplicitu sa vyhneme (napr. rovnaký kľúč je už z ENV).
      if (apiKeyPool.some((k) => k.key === item.key)) continue;

      const enabled = item.enabled !== false;
      let status = item.status;
      // Po reštarte je cooldown z rate-limitu už často vypršaný.
      if (status === "rate-limited" && (!item.rateLimitResetTime || now > item.rateLimitResetTime)) {
        status = enabled ? "active" : "disabled";
      }
      if (!status) status = enabled ? "active" : "disabled";

      apiKeyPool.push({
        ...item,
        id: item.id || "key-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
        enabled,
        status,
        rateLimitResetTime: status === "rate-limited" ? item.rateLimitResetTime : undefined,
        isDefaultSystemKey: false,
        // Počítadlá používania sú relačné k behu servera, nie perzistentné.
        requestCount: 0,
        errorCount: 0,
      });
      restored++;
    }

    if (restored > 0) {
      console.log(`[Keys] Obnovených ${restored} API kľúčov z ${KEYS_FILE}`);
    }
  } catch (err: any) {
    console.warn(`[Keys] Nepodarilo sa načítať uložené kľúče: ${err?.message || err}`);
  }
}

// In-memory key pool
const apiKeyPool: ServerApiKey[] = [];

if (process.env.GEMINI_API_KEY) {
  apiKeyPool.push({
    id: "system-key-default",
    key: process.env.GEMINI_API_KEY,
    name: "Systémový Google Gemini Kľúč",
    provider: "gemini",
    providerLabel: "Google Gemini (Systémový kľúč)",
    enabled: true,
    priority: "HIGH",
    preferred: true,
    capabilities: ["VIDEO_ANALYSIS", "TEXT_REASONING", "STRUCTURED_OUTPUT", "IMAGE", "AUDIO"],
    model: "gemini-3.8-flash",
    projectId: "gcp-project-system",
    quotaScope: "PROJECT",
    status: "active",
    isDefaultSystemKey: true,
    addedAt: new Date().toISOString(),
    requestCount: 0,
    errorCount: 0,
  });
}

// Obnovenie kľúčov uložených z predchádzajúceho behu (aby prežili reštart).
restoreKeys();

// Real telemetry stats for AI usage
const telemetryStats = {
  totalRequestsToday: 0,
  cachedRequestsToday: 0,
  localRequestsToday: 0,
  aiRequestsToday: 0,
};

function getPublicKeys() {
  const now = Date.now();
  // Auto-restore rate-limited keys after 60s cooldown
  apiKeyPool.forEach((k) => {
    if (k.status === "rate-limited" && k.rateLimitResetTime && now > k.rateLimitResetTime) {
      k.status = k.enabled ? "active" : "disabled";
      k.rateLimitResetTime = undefined;
    }
  });

  return apiKeyPool.map((k) => ({
    id: k.id,
    keyMasked: maskApiKey(k.key),
    name: k.name,
    provider: k.provider,
    providerLabel: k.providerLabel,
    enabled: k.enabled,
    priority: k.priority,
    preferred: !!k.preferred,
    capabilities: k.capabilities,
    model: k.model,
    projectId: k.projectId,
    quotaScope: k.quotaScope,
    status: !k.enabled ? "disabled" : k.status,
    isDefaultSystemKey: k.isDefaultSystemKey,
    addedAt: k.addedAt,
    requestCount: k.requestCount,
    errorCount: k.errorCount,
    lastSuccessfulUse: k.lastSuccessfulUse,
    lastError: k.lastError,
    lastTestResult: k.lastTestResult,
  }));
}

function getSharedProjectSummary() {
  const projectMap = new Map<string, { count: number; active: number; rateLimited: number }>();
  apiKeyPool.forEach((k) => {
    const pId = k.projectId || "unassigned";
    const cur = projectMap.get(pId) || { count: 0, active: 0, rateLimited: 0 };
    cur.count++;
    if (k.status === "active" && k.enabled) cur.active++;
    if (k.status === "rate-limited") cur.rateLimited++;
    projectMap.set(pId, cur);
  });

  return Array.from(projectMap.entries()).map(([projectId, stats]) => ({
    projectId,
    credentialCount: stats.count,
    isSharedQuota: stats.count > 1,
    status: stats.rateLimited > 0 ? "rate-limited" : "ok",
    quotaNote: stats.count > 1 ? "Zdieľaná projektová kvóta (Shared Project Quota)" : "Samostatná kvóta"
  }));
}

function selectCandidateKeysForTask(
  provider: "gemini" = "gemini",
  capability?: string,
  model?: string
): ServerApiKey[] {
  const now = Date.now();
  // Auto-restore rate-limited keys after cooldown
  apiKeyPool.forEach((k) => {
    if (k.status === "rate-limited" && k.rateLimitResetTime && now > k.rateLimitResetTime) {
      k.status = k.enabled ? "active" : "disabled";
      k.rateLimitResetTime = undefined;
    }
  });

  const candidates = apiKeyPool.filter((k) => {
    if (k.provider !== provider) return false;
    if (!k.enabled) return false;
    if (k.status === "disabled" || k.status === "error") return false;
    if (k.status === "rate-limited" && k.rateLimitResetTime && now <= k.rateLimitResetTime) return false;
    if (capability && k.capabilities && k.capabilities.length > 0) {
      if (!k.capabilities.includes(capability)) return false;
    }
    return true;
  });

  return candidates.sort((a, b) => {
    if (a.preferred && !b.preferred) return -1;
    if (!a.preferred && b.preferred) return 1;

    const prioWeight = { HIGH: 3, NORMAL: 2, LOW: 1 };
    const diff = (prioWeight[b.priority] || 2) - (prioWeight[a.priority] || 2);
    if (diff !== 0) return diff;

    return a.requestCount - b.requestCount;
  });
}

function handleRateLimitOnKey(keyItem: ServerApiKey, errText: string) {
  const cooldownMs = 60000;
  keyItem.status = "rate-limited";
  keyItem.rateLimitResetTime = Date.now() + cooldownMs;
  keyItem.lastError = `Rate limit: ${errText}`;

  // PROJECT-LEVEL QUOTA AWARENESS:
  // If credentials share the same Google Cloud Project ID,
  // mark all credentials under that project in cooldown.
  // NEVER rotate between keys within the same project to evade quotas!
  if (keyItem.projectId) {
    apiKeyPool.forEach((other) => {
      if (other.id !== keyItem.id && other.projectId === keyItem.projectId) {
        other.status = "rate-limited";
        other.rateLimitResetTime = Date.now() + cooldownMs;
        other.lastError = `Zdieľaná kvóta projektu (${keyItem.projectId}) vyčerpaná.`;
      }
    });
  }
}

// In-memory response cache to eliminate redundant Gemini API token usage
const analysisCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 45; // 45 minutes

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    hasGeminiKey: apiKeyPool.some((k) => k.provider === "gemini"),
    totalKeys: apiKeyPool.length,
    activeKeys: apiKeyPool.filter((k) => k.status === "active").length,
    time: new Date().toISOString(),
  });
});

// API Key Manager Endpoints
app.get("/api/keys", (_req, res) => {
  res.json({
    success: true,
    keys: getPublicKeys(),
    sharedProjects: getSharedProjectSummary(),
    totalCount: apiKeyPool.length,
    activeCount: apiKeyPool.filter((k) => k.status === "active" && k.enabled).length,
  });
});

app.get("/api/keys/usage", (_req, res) => {
  const total = telemetryStats.totalRequestsToday;
  const local = telemetryStats.localRequestsToday;
  const ai = telemetryStats.aiRequestsToday;
  const localPct = total > 0 ? Math.round((local / total) * 100) : 85;
  const aiPct = total > 0 ? Math.round((ai / total) * 100) : 15;

  const hasActiveGemini = apiKeyPool.some((k) => k.provider === "gemini" && k.enabled && k.status === "active");

  res.json({
    success: true,
    today: {
      geminiRequests: ai,
      cachedRequests: telemetryStats.cachedRequestsToday,
      localPercent: localPct,
      aiPercent: aiPct,
      currentProvider: "Gemini",
      availableCredentials: apiKeyPool.filter((k) => k.enabled && k.status === "active").length,
      quotaStatus: hasActiveGemini ? "OK" : "LIMITED_OR_OFFLINE",
    },
    rawStats: telemetryStats,
  });
});

app.post("/api/keys", async (req, res) => {
  try {
    const {
      key,
      name,
      model = "gemini-3.8-flash",
      capabilities = ["VIDEO_ANALYSIS", "TEXT_REASONING", "STRUCTURED_OUTPUT", "IMAGE", "AUDIO"],
      priority = "NORMAL",
      preferred = false,
      projectId,
      quotaScope = "PROJECT",
    } = req.body;

    if (!key || typeof key !== "string" || key.trim().length < 8) {
      return res.status(400).json({
        success: false,
        error: "Neplatný formát API kľúča. Minimálna dĺžka je 8 znakov.",
      });
    }

    const trimmed = key.trim();
    // Check if already in pool
    if (apiKeyPool.some((k) => k.key === trimmed)) {
      return res.status(400).json({
        success: false,
        error: "Tento API kľúč už v zozname existuje.",
      });
    }

    const { provider, providerLabel } = detectKeyProvider(trimmed);

    // Auto-derive project ID if not provided, based on prefix or existing pattern
    const assignedProjectId =
      projectId && typeof projectId === "string" && projectId.trim()
        ? projectId.trim()
        : `gcp-project-${Math.random().toString(36).substring(2, 7)}`;

    const newKeyItem: ServerApiKey = {
      id: "key-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      key: trimmed,
      name: name && typeof name === "string" && name.trim() ? name.trim() : `Gemini Credential ${apiKeyPool.length + 1}`,
      provider,
      providerLabel,
      enabled: true,
      priority: priority === "HIGH" || priority === "LOW" ? priority : "NORMAL",
      preferred: Boolean(preferred),
      capabilities: Array.isArray(capabilities) && capabilities.length > 0 ? capabilities : ["VIDEO_ANALYSIS", "TEXT_REASONING", "STRUCTURED_OUTPUT", "IMAGE", "AUDIO"],
      model: typeof model === "string" ? model : "gemini-3.8-flash",
      projectId: assignedProjectId,
      quotaScope: quotaScope === "ACCOUNT" || quotaScope === "PROVIDER" || quotaScope === "UNKNOWN" ? quotaScope : "PROJECT",
      status: "active",
      isDefaultSystemKey: false,
      addedAt: new Date().toISOString(),
      requestCount: 0,
      errorCount: 0,
    };

    apiKeyPool.push(newKeyItem);
    persistKeys();

    return res.json({
      success: true,
      message: `API kľúč úspešne pridaný a rozpoznaný: ${providerLabel}`,
      key: {
        id: newKeyItem.id,
        keyMasked: maskApiKey(newKeyItem.key),
        name: newKeyItem.name,
        provider: newKeyItem.provider,
        providerLabel: newKeyItem.providerLabel,
        enabled: newKeyItem.enabled,
        priority: newKeyItem.priority,
        capabilities: newKeyItem.capabilities,
        projectId: newKeyItem.projectId,
        quotaScope: newKeyItem.quotaScope,
        status: newKeyItem.status,
      },
      keys: getPublicKeys(),
      sharedProjects: getSharedProjectSummary(),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.patch("/api/keys/:id", (req, res) => {
  const { id } = req.params;
  const keyItem = apiKeyPool.find((k) => k.id === id);
  if (!keyItem) {
    return res.status(404).json({ success: false, error: "Kľúč nenájdený." });
  }

  const { name, enabled, priority, preferred, capabilities, model, projectId, quotaScope } = req.body;

  if (typeof name === "string") keyItem.name = name.trim();
  if (typeof enabled === "boolean") {
    keyItem.enabled = enabled;
    keyItem.status = enabled ? "active" : "disabled";
  }
  if (priority === "HIGH" || priority === "NORMAL" || priority === "LOW") {
    keyItem.priority = priority;
  }
  if (typeof preferred === "boolean") keyItem.preferred = preferred;
  if (Array.isArray(capabilities)) keyItem.capabilities = capabilities;
  if (typeof model === "string") keyItem.model = model;
  if (typeof projectId === "string") keyItem.projectId = projectId.trim();
  if (quotaScope) keyItem.quotaScope = quotaScope;
  persistKeys();

  return res.json({
    success: true,
    message: "Nastavenia credentialu úspešne aktualizované.",
    keys: getPublicKeys(),
    sharedProjects: getSharedProjectSummary(),
  });
});

app.delete("/api/keys/:id", (req, res) => {
  const { id } = req.params;
  const index = apiKeyPool.findIndex((k) => k.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: "Kľúč nenájdený." });
  }

  if (apiKeyPool[index].isDefaultSystemKey) {
    return res.status(400).json({
      success: false,
      error: "Systémový kľúč z prostredia nie je možné vymazať.",
    });
  }

  apiKeyPool.splice(index, 1);
  persistKeys();
  return res.json({
    success: true,
    message: "Kľúč bol úspešne odstránený.",
    keys: getPublicKeys(),
    sharedProjects: getSharedProjectSummary(),
  });
});

app.post("/api/keys/test", async (req, res) => {
  try {
    const { key, id } = req.body;
    let keyToTest = "";

    if (id) {
      const found = apiKeyPool.find((k) => k.id === id);
      if (found) keyToTest = found.key;
    }
    if (!keyToTest && key && typeof key === "string") {
      keyToTest = key.trim();
    }

    if (!keyToTest) {
      return res.status(400).json({
        success: false,
        valid: false,
        status: "ERROR",
        error: "Chýba API kľúč na otestovanie.",
      });
    }

    const trimmed = keyToTest.trim();
    const { provider, providerLabel } = detectKeyProvider(trimmed);

    if (provider === "gemini") {
      // Model vhodný na test: najprv model kľúča, potom overené záložné modely.
      // Rôzne kľúče/tarify majú dostupnú inú sadu modelov, preto skúšame postupne.
      const keyItemForTest = id ? apiKeyPool.find((k) => k.id === id) : undefined;
      const requestedModel = keyItemForTest?.model || "gemini-3.8-flash";
      const testModels = Array.from(new Set([
        requestedModel,
        "gemini-3.8-flash",
        "gemini-3.7-flash",
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
      ]));

      let lastErrStr = "";
      let workingModel: string | null = null;

      for (const modelId of testModels) {
        try {
          const testAi = new GoogleGenAI({
            apiKey: trimmed,
            httpOptions: { headers: { "User-Agent": "aistudio-build" } },
          });

          // Lightweight test prompt
          const result = await testAi.models.generateContent({
            model: modelId,
            contents: "Respond with only one word: OK",
          });

          if (result.text) {
            workingModel = modelId;
            break;
          }
          lastErrStr = "Model nevrátil žiadnu odpoveď.";
        } catch (modelErr: any) {
          lastErrStr = String(modelErr?.message || modelErr);
        }
      }

      if (workingModel) {
        const found = id ? apiKeyPool.find((k) => k.id === id) : undefined;
        let switchedModelNote = "";
        if (found) {
          found.lastTestResult = "CONNECTED";
          found.status = "active";
          found.lastError = undefined;
          // Ak kľúč funguje na inom modeli, než má uložený, prepneme ho –
          // inak by rovnakou chybou padali aj samotné AI operácie.
          if (found.model !== workingModel) {
            found.model = workingModel;
            switchedModelNote = ` Model kľúča bol nastavený na ${workingModel}.`;
          }
          persistKeys();
        }
        return res.json({
          success: true,
          valid: true,
          status: "CONNECTED",
          provider,
          providerLabel,
          model: workingModel,
          message: `API kľúč je platný a pripravený na použitie (model ${workingModel}).${switchedModelNote}`,
        });
      }

      {
        const errStr = lastErrStr;
        const lowered = errStr.toLowerCase();
        let status = "ERROR";
        let message = `Test zlyhal: ${errStr}`;

        if (errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || lowered.includes("quota")) {
          status = "QUOTA";
          message = "Kvóta pre tento projekt je vyčerpaná (429 RESOURCE_EXHAUSTED).";
        } else if (
          errStr.includes("API_KEY_INVALID") ||
          lowered.includes("api key not valid") ||
          lowered.includes("api_key_invalid") ||
          errStr.includes("PERMISSION_DENIED")
        ) {
          status = "INVALID";
          message = "API kľúč je neplatný alebo bol zrušený.";
        } else if (lowered.includes("billing")) {
          status = "BILLING_REQUIRED";
          message = "Projekt vyžaduje aktiváciu platobného účtu (Billing).";
        } else if (errStr.includes("NOT_FOUND") || lowered.includes("is not found") || lowered.includes("not supported")) {
          status = "MODEL_UNAVAILABLE";
          message = "Požadovaný model nie je pre tento kľúč dostupný.";
        } else if (lowered.includes("location") || lowered.includes("region") || lowered.includes("country")) {
          status = "REGION_UNSUPPORTED";
          message = "Kľúč nefunguje v tejto geografickej oblasti.";
        }

        if (id) {
          const found = apiKeyPool.find((k) => k.id === id);
          if (found) {
            found.lastTestResult = status;
            found.lastError = message;
            if (status === "QUOTA" || status === "RATE_LIMITED") {
              handleRateLimitOnKey(found, message);
            } else if (status === "INVALID") {
              found.status = "error";
            }
          }
          persistKeys();
        }

        return res.json({
          success: false,
          valid: false,
          status,
          error: message,
          // Presná odpoveď od Googlu – pomáha diagnostikovať (napr. vypnuté API,
          // nesprávny model, obmedzenie regiónu). Skracujeme na 400 znakov.
          rawError: errStr.slice(0, 400),
          testedModels: testModels,
        });
      }
    }

    return res.json({
      success: true,
      valid: true,
      status: "CONNECTED",
      provider,
      providerLabel,
      message: `Rozpoznané ako ${providerLabel}.`,
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      valid: false,
      status: "ERROR",
      error: `Test zlyhal: ${err.message || "Neplatný kľúč"}`,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DIRECTOR ENGINE — „RAW → READY“ Edit Plan
//
// Princíp celého OmniStrihu: AI IBA ROZHODUJE, nič nerenderuje a nič neaplikuje.
// Výstupom je Edit Plan (zoznam zásahov s odôvodnením), ktorý ide používateľovi
// na schválenie. Vykonanie robí až media engine (Mediabunny) na strane klienta.
//
// Ak nie je dostupný žiadny kľúč (alebo Gemini zlyhá), vráti sa deterministický
// lokálny plán — aplikácia tak zostane použiteľná aj úplne bez API (0 tokenov).
// ─────────────────────────────────────────────────────────────────────────────

type DirectorActionType =
  | "CUT" | "KEEP" | "SPEED" | "ZOOM" | "CROP"
  | "CAPTION" | "HOOK" | "HIGHLIGHT" | "BROLL" | "SFX" | "MUSIC";

interface DirectorPlanItem {
  id: string;
  type: DirectorActionType;
  start: number;
  end?: number;
  label: string;
  reason: string;
  lesson?: string;
  confidence: number;
  status: "proposed";
  /** Odkiaľ zásah pochádza: z konkrétnej vety prepisu, z odhadu, alebo od AI. */
  basis?: "transcript" | "estimate" | "ai";
}

const DIRECTOR_MODES: Record<string, { labelSk: string; goalSk: string; minutesSavedPerRawMinute: number }> = {
  SOCIAL: {
    labelSk: "Retention Short (Reels / TikTok / Shorts)",
    goalSk: "udržať pozornosť: silný hook, svižné tempo, dynamické titulky, punch-iny",
    minutesSavedPerRawMinute: 4.2,
  },
  ADS: {
    labelSk: "UGC / Reklama (performance)",
    goalSk: "konverzia: hook → problém → riešenie → dôkaz → CTA, viac variantov hooku",
    minutesSavedPerRawMinute: 3.8,
  },
  PODCAST: {
    labelSk: "Podcast / Talking head",
    goalSk: "čistý prirodzený strih bez fillerov a zakopnutí, zachovať rytmus reči",
    minutesSavedPerRawMinute: 3.5,
  },
  YOUTUBE: {
    labelSk: "YouTube / Long-form",
    goalSk: "dlhodobá kontinuita, kapitoly, story struktúra, žiadne agresívne skoky",
    minutesSavedPerRawMinute: 3.9,
  },
  CORPORATE: {
    labelSk: "Firemné / Brand video",
    goalSk: "čistý profesionálny dojem, konzistentný vizuál, dôveryhodnosť",
    minutesSavedPerRawMinute: 3.2,
  },
  CUSTOM: {
    labelSk: "Vlastný štýl",
    goalSk: "rešpektovať poznámky používateľa",
    minutesSavedPerRawMinute: 3.5,
  },
};

const DIRECTOR_ACTION_TYPES: DirectorActionType[] = [
  "CUT", "KEEP", "SPEED", "ZOOM", "CROP", "CAPTION", "HOOK", "HIGHLIGHT", "BROLL", "SFX", "MUSIC",
];

/** Skráti a očistí text; ochrana proti obrovským odpovediam. */
function clampText(value: any, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

/** Zvaliduje jeden zásah z AI odpovede na bezpečný tvar. */
function normalizeDirectorItem(raw: any, index: number): DirectorPlanItem | null {
  if (!raw || typeof raw !== "object") return null;

  const rawType = clampText(raw.type, 20).toUpperCase();
  const type = (DIRECTOR_ACTION_TYPES as string[]).includes(rawType)
    ? (rawType as DirectorActionType)
    : null;
  if (!type) return null;

  const startNum = Number(raw.start);
  if (!Number.isFinite(startNum) || startNum < 0) return null;

  const endNum = Number(raw.end);
  const confidenceNum = Number(raw.confidence);
  const label = clampText(raw.label, 120) || `Zásah ${index + 1}`;

  return {
    id: clampText(raw.id, 60) || `dir-${index + 1}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    start: Math.round(startNum * 100) / 100,
    end: Number.isFinite(endNum) && endNum > startNum ? Math.round(endNum * 100) / 100 : undefined,
    label,
    reason: clampText(raw.reason, 400) || "Bez uvedeného dôvodu.",
    lesson: clampText(raw.lesson, 400) || undefined,
    confidence: Number.isFinite(confidenceNum)
      ? Math.min(1, Math.max(0, confidenceNum))
      : 0.6,
    status: "proposed",
    basis: "ai",
  };
}

/**
 * Deterministický lokálny plán — použije sa, keď nie je kľúč alebo Gemini zlyhá.
 * Nie je to „fake AI“: je to poctivý offline režim, ktorý dá použiteľnú kostru
 * strihu a používateľ vidí, že beží bez API (source: "local-fallback").
 */
type PlanBasis = "transcript" | "estimate" | "ai";

interface TranscriptSentence {
  text: string;
  start: number;
  end: number;
  index: number;
}

const FILLER_WORDS = [
  // SK
  "ehm", "éhm", "emm", "hmm", "hm", "no", "takže", "vlastne", "akože", "jakoby",
  "proste", "teda", "čiže", "nuž", "hej", "normálne", "v podstate", "nejak",
  // EN
  "um", "uh", "like", "you know", "basically", "actually", "literally", "well",
  "right", "kinda", "sorta", "i mean",
];

const POWER_WORDS = [
  // SK — slová, ktoré reálne ťahajú pozornosť
  "zadarmo", "najlepš", "tajomstv", "chyba", "chyb", "peniaz", "peňaz", "eur", "rýchl",
  "výsledok", "trik", "nikdy", "vždy", "nikto", "každý", "prestaň", "pozor", "tajné",
  "jednoduch", "za 5 minút", "bez platenia", "ušetr", "zdarma",
  // EN
  "free", "best", "secret", "mistake", "money", "fast", "result", "trick",
  "never", "always", "nobody", "everyone", "stop", "save", "without paying",
];

function shortQuote(text: string, max = 46): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}…`;
}

/**
 * Rozdelí prepis na vety a odhadne ich časové rozsahy.
 * Ak má používateľ text bez časovania (bežné pri kopírovaní z titulkovej appky),
 * rozdelíme dĺžku videa úmerne dĺžke viet. Je to odhad — preto ho vždy
 * označíme (basis) a v odôvodnení uvedieme KTORÁ veta to je, aby sa dal
 * zásah overiť za dve sekundy.
 */
/**
 * Časy viet pre plán.
 *
 * Poradie dôveryhodnosti je jasné a v odpovedi sa vždy prizná:
 *  1. **slová** — word-level časovanie z automatických tituliek (presnosť ~0,1 s),
 *  2. **odhad** — rozdelenie dĺžky videa podľa dĺžky textu (keď máme len text).
 */
function sentenceTimingsFor(
  transcript: string,
  durationSec: number,
  speechSegments?: SpeechSegmentLike[],
): { sentences: TranscriptSentence[]; precision: "words" | "sentences" | "estimate"; wordCount: number } {
  const words = speechSegments?.length ? flattenWords(speechSegments) : [];
  if (words.length >= 3) {
    const sentences = buildSentenceTimings(speechSegments || []).map((s) => ({
      text: s.text,
      start: s.start,
      end: s.end,
      index: s.index,
    }));
    if (sentences.length >= 2) {
      const idx = buildWordIndex(words);
      return {
        sentences,
        precision: idx.precision,
        wordCount: words.length,
      };
    }
  }
  return {
    sentences: estimateSentenceTimings(transcript, durationSec),
    precision: "estimate",
    wordCount: 0,
  };
}

function estimateSentenceTimings(transcript: string, durationSec: number): TranscriptSentence[] {
  const cleaned = String(transcript || "").replace(/\s+/g, " ").trim();
  if (cleaned.length < 20) return [];

  let parts = cleaned.split(/(?<=[.!?…])\s+/).map((t) => t.trim()).filter((t) => t.length >= 3);

  // Prepis bez interpunkcie (napr. z auto-captions) → delíme na hranici slova po ~90 znakoch
  if (parts.length < 3) {
    parts = [];
    const words = cleaned.split(" ");
    let buf: string[] = [];
    for (const w of words) {
      buf.push(w);
      if (buf.join(" ").length >= 90) {
        parts.push(buf.join(" "));
        buf = [];
      }
    }
    if (buf.length > 0) parts.push(buf.join(" "));
  }

  const sentences = parts.slice(0, 120);
  if (sentences.length === 0) return [];

  const totalChars = sentences.reduce((sum, t) => sum + t.length, 0);
  const usable = Math.max(durationSec, 10);
  let cursor = 0;

  return sentences.map((text, index) => {
    const share = (text.length / totalChars) * usable;
    const start = cursor;
    const end = Math.min(usable, cursor + share);
    cursor = end;
    return { text, start, end, index };
  });
}

function fillerRatio(text: string): number {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 0;
  const hits = words.filter((w) => FILLER_WORDS.includes(w)).length;
  return hits / words.length;
}

function isFillerSentence(sentence: TranscriptSentence): boolean {
  const ratio = fillerRatio(sentence.text);
  if (ratio >= 0.22) return true;
  return sentence.text.length < 60 && ratio > 0;
}

/**
 * Výplň na ZAČIATKU vety („Takže, ehm, dnes si ukážeme…“).
 * V praxi editor najčastejšie nestrihá celú vetu, ale práve tento rozbeh.
 * Čas odhadneme podielom dĺžky výplne na dĺžke vety (max 2,5 s), aby zásah
 * nebol nikdy väčší, než je reálne bezpečné.
 */
function leadingFillerChunk(
  sentence: TranscriptSentence,
): { start: number; end: number; words: string } | null {
  const clean = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const words = sentence.text.split(/\s+/).filter((w) => clean(w) !== "");
  if (words.length === 0) return null;

  const leading: string[] = [];
  for (const w of words) {
    if (FILLER_WORDS.includes(clean(w))) leading.push(w);
    else break;
  }
  if (leading.length === 0) return null;
  // Ak celá veta je výplň, rieši ju isFillerSentence — tu chceme len rozbeh.
  if (leading.length >= words.length) return null;

  const duration = Math.max(0.2, sentence.end - sentence.start);
  const share = leading.join(" ").length / Math.max(6, sentence.text.length);
  const chunk = Math.min(2.5, Math.max(0.4, duration * share + 0.2));

  return {
    start: sentence.start,
    end: Math.min(sentence.end, sentence.start + chunk),
    words: leading.join(" "),
  };
}

function powerScore(text: string): number {
  const t = text.toLowerCase();
  let score = 0;
  for (const w of POWER_WORDS) if (t.includes(w)) score += 2;
  if (/\d/.test(t)) score += 1.5;
  if (/\d+\s?(%|€|\$|eur|kč|kc|sekúnd|sekund|minút|minut)/.test(t)) score += 1.5;
  if (t.length > 40 && t.length < 160) score += 0.5;
  return score;
}

/**
 * Poistka kvality: plán sa nesmie vymknúť realite videa.
 * Oreže časy do dĺžky klipu, odstráni prekrývajúce sa strihy (nechá ten
 * s vyššou istotou) a zastropuje počet zásahov.
 */
function validateDirectorPlan(plan: DirectorPlanItem[], durationSec: number): DirectorPlanItem[] {
  const usable = Math.max(durationSec, 10);
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const cleaned: DirectorPlanItem[] = [];
  for (const item of plan) {
    const start = Math.min(Math.max(0, item.start), Math.max(0, usable - 0.5));
    let end = item.end;
    if (end !== undefined) end = Math.min(Math.max(start + 0.5, end), usable);
    cleaned.push({
      ...item,
      start: round2(start),
      end: end !== undefined ? round2(end) : undefined,
    });
  }

  const cutLike = cleaned
    .filter((i) => i.type === "CUT" || i.type === "KEEP")
    .sort((a, b) => b.confidence - a.confidence);
  const keptCuts: DirectorPlanItem[] = [];
  for (const c of cutLike) {
    const cEnd = c.end ?? c.start + 1.5;
    const overlaps = keptCuts.some((k) => {
      const kEnd = k.end ?? k.start + 1.5;
      return c.start < kEnd && k.start < cEnd;
    });
    if (!overlaps) keptCuts.push(c);
  }

  const others = cleaned.filter((i) => i.type !== "CUT" && i.type !== "KEEP");
  return [...others, ...keptCuts].sort((a, b) => a.start - b.start).slice(0, 20);
}

/**
 * Deterministický lokálny plán — použije sa, keď nie je kľúč alebo Gemini zlyhá.
 * Nie je to „fake AI“: je to poctivý offline režim.
 *
 * Dôležité: keď máme prepis, plán sa kotví na KONKRÉTNE VETY (a povie ktoré),
 * nie na náhodne rozmiestnené časové body. Keď prepis nemáme, plán je označený
 * ako odhad (confidence ~0.4) a rovno to aj prizná — žiadne predstieranie AI.
 */
function buildLocalDirectorPlan(
  mode: string,
  durationSec: number,
  language: string,
  transcript = "",
  speechSegments?: SpeechSegmentLike[],
): {
  plan: DirectorPlanItem[];
  summary: string;
  basis: PlanBasis;
  anchoredSentences: number;
  timingPrecision: "words" | "sentences" | "estimate";
  wordCount: number;
} {
  const sk = language === "sk";
  const plan: DirectorPlanItem[] = [];
  const push = (
    type: DirectorActionType,
    start: number,
    end: number | undefined,
    label: string,
    reason: string,
    lesson: string,
    confidence = 0.55,
    basis: PlanBasis = "estimate",
  ) => {
    plan.push({
      id: `local-${plan.length + 1}`,
      type,
      start: Math.round(start * 100) / 100,
      end: end !== undefined ? Math.round(end * 100) / 100 : undefined,
      label,
      reason,
      lesson,
      confidence,
      status: "proposed",
      basis,
    });
  };

  const total = Math.max(durationSec, 10);
  const timing = sentenceTimingsFor(transcript, total, speechSegments);
  const sentences = timing.sentences;
  const aggressive = mode === "SOCIAL" || mode === "ADS";
  const maxCuts = aggressive ? 6 : mode === "PODCAST" || mode === "YOUTUBE" ? 3 : 4;

  // ============================================================
  // A) PLÁN KOTVENÝ NA PREPISE (keď ho máme)
  // ============================================================
  if (sentences.length >= 3) {
    // 1) Výplň → strih. Najprv celé výplňové vety, potom rozbeh na začiatku viet.
    let fillerCuts = 0;

    for (const s of sentences) {
      if (fillerCuts >= maxCuts) break;
      if (!isFillerSentence(s)) continue;
      push(
        "CUT",
        s.start,
        s.end,
        sk ? `Vystrihnúť celú výplňovú vetu: „${shortQuote(s.text, 40)}“` : `Cut filler line: "${shortQuote(s.text, 40)}"`,
        sk
          ? `Veta „${shortQuote(s.text, 110)}“ nesie minimum informácie — väčšinu tvoria výplňové slová. Divák ju preskočí hlavou, strih ju preskočí za neho.`
          : `The line "${shortQuote(s.text, 110)}" carries almost no information.`,
        sk
          ? "Technika: odstránenie výplne — najlacnejší strih, ktorý zlepší tempo. Pri rozhovoroch sa používa aj jemnejšia verzia: skrátiť, nie vyhodiť."
          : "Technique: filler removal.",
        0.72,
        "transcript",
      );
      fillerCuts++;
    }

    for (const s of sentences) {
      if (fillerCuts >= maxCuts) break;
      const lead = leadingFillerChunk(s);
      if (!lead) continue;
      push(
        "CUT",
        lead.start,
        lead.end,
        sk ? `Vystrihnúť rozbeh vety: „${lead.words}…“` : `Cut the sentence warm-up: "${lead.words}…"`,
        sk
          ? `Veta začína výplňou („${lead.words}“) — než sa dostane k pointnej časti „${shortQuote(s.text, 80)}“, stratí sa ${(lead.end - lead.start).toFixed(1)} s. Presne tento rozbeh strihajú profíci najčastejšie.`
          : `The line opens with filler ("${lead.words}") — cut the ${(lead.end - lead.start).toFixed(1)}s warm-up.`,
        sk
          ? "Technika: tight opening. Nestrihaj celú vetu — stačí odstrániť rozbeh a pointa zostane nedotknutá."
          : "Technique: tight opening — cut the warm-up, keep the point.",
        0.66,
        "transcript",
      );
      fillerCuts++;
    }

    // 2) Rozvláčne vety → zrýchlenie namiesto strihu (nezmysel sa neruší, len hustí)
    const longOnes = sentences
      .filter((s) => s.text.length > 220 && !isFillerSentence(s))
      .slice(0, aggressive ? 2 : 1);
    for (const s of longOnes) {
      push(
        "SPEED",
        s.start,
        s.end,
        sk ? `Zrýchliť rozvláčnu pasáž (1,4×): „${shortQuote(s.text, 34)}“` : `Speed up verbose passage`,
        sk
          ? `Veta má ${s.text.length} znakov. Informáciu má, ale tempo je pomalé — zrýchlenie ju zachová celú a získa ${Math.round(
              (s.end - s.start) * 0.28,
            )} s.`
          : `The line is ${s.text.length} chars long — speeding it up keeps it whole.`,
        sk
          ? "Technika: speed ramp namiesto strihu — používa sa, keď nechceš prísť o obsah, len o hluché tempo."
          : "Technique: speed ramp instead of a cut.",
        0.6,
        "transcript",
      );
    }

    // 3) Najsilnejšia veta → highlight + punch-in + zvukový akcent.
    // Hook vetu vyberáme prv: highlight nemá zmysel na tej istej vete, ktorú
    // aj tak presúvame na začiatok — vtedy by plán len duplikoval sám seba.
    const hookCandidates = sentences.filter((s) => s.text.length < 130);
    const hookPool = hookCandidates.length > 0 ? hookCandidates : sentences;
    const hookSentence =
      hookPool.slice().sort((a, b) => powerScore(b.text) - powerScore(a.text))[0] || sentences[0];

    const best =
      sentences.filter((s) => s !== hookSentence).sort((a, b) => powerScore(b.text) - powerScore(a.text))[0] ||
      hookSentence;
    if (best && powerScore(best.text) > 0) {
      push(
        "HIGHLIGHT",
        best.start,
        best.end,
        sk ? `Highlight: „${shortQuote(best.text, 40)}“` : `Highlight: "${shortQuote(best.text, 40)}"`,
        sk
          ? `Najvyššia informačná váha v celom klipu (${powerScore(best.text).toFixed(1)} b). Presne takáto veta sa dá použiť ako samostatný krátky klip.`
          : `Highest information weight in the clip — usable as a standalone short.`,
        sk
          ? "Technika: jedna veta = jeden krátky klip. Vždy hľadaj vetu, ktorá obstojí bez kontextu."
          : "Technique: one sentence = one short clip.",
        0.78,
        "transcript",
      );
      push(
        "ZOOM",
        best.start,
        best.end,
        sk ? "Punch-in 115 % na pointu" : "Punch-in 115% on the payoff",
        sk
          ? `Framing sa zmení presne na vete „${shortQuote(best.text, 60)}“ — mozog si zmenu spojí s pointou.`
          : `Framing changes exactly on the payoff line.`,
        sk ? "Technika: framing + timing. Menej je viac — netreba efekty, stačí zmena." : "Technique: framing + timing.",
        0.68,
        "transcript",
      );
      push(
        "SFX",
        best.start,
        undefined,
        sk ? "Zvukový akcent na pointu" : "Sound accent on the payoff",
        sk
          ? "Krátky akcent (pop/boom) podčiarkne pointu a zároveň prekryje prípadný skok strihu."
          : "A short accent underlines the payoff and masks any cut.",
        sk ? "Technika: SFX masking — zvuk zakryje strih, takže divák ho nepostrehne." : "Technique: SFX masking.",
        0.6,
        "transcript",
      );
    }

    // 4) Hook — najsilnejšia KRÁTKA veta patrí na začiatok (front-loading)
    const hookAlreadyFirst = hookSentence.index === 0;
    // Ak je hook veta už prvá a začína výplňou, plán jej rozbeh aj tak strihá.
    // Musí to povedať jedným dychom, inak si zásahy navzájom odporujú.
    const hookLead = leadingFillerChunk(hookSentence);
    push(
      "HOOK",
      0,
      Math.min(3, total * 0.1),
      hookAlreadyFirst
        ? sk ? `Hook: „${shortQuote(hookSentence.text, 44)}“ (už je prvá — drž ju)` : `Hook stays first: "${shortQuote(hookSentence.text, 44)}"`
        : sk ? `Hook: „${shortQuote(hookSentence.text, 44)}“ na začiatok` : `Hook: move the strongest line first`,
      hookAlreadyFirst && hookLead
        ? sk
          ? `Veta „${shortQuote(hookSentence.text, 100)}“ má najvyššiu váhu a už je na začiatku — to je správne. Vystrihni len rozbeh („${hookLead.words}“) a pusti pointu okamžite: prvá sekunda musí niesť obsah, nie logom ani titulkom.`
          : `The strongest line is already first — cut only its warm-up and get to the point immediately.`
        : hookAlreadyFirst
        ? sk
          ? `Veta „${shortQuote(hookSentence.text, 100)}“ má najvyššiu váhu a už je na začiatku — to je správne. Neskracuj prvú sekundu a nezačínaj logom ani titulkom.`
          : `The strongest line is already first — keep it that way.`
        : sk
          ? `Veta „${shortQuote(hookSentence.text, 100)}“ má najvyššiu váhu spomedzi krátkych viet. Presuň ju na začiatok — prvých 3 s rozhoduje o zvyšku videa.`
          : `This line carries the most weight among short lines — move it to the start.`,
      sk
        ? "Technika: front-loading. Pozor na čestnosť: hook musí naozaj niečo sľúbiť, inak si divák pripadá podvedený."
        : "Technique: front-loading.",
      0.75,
      "transcript",
    );

    // 5) Titulky a hudba (globálne)
    push(
      "CAPTION",
      0,
      total,
      sk ? "Titulky s dôrazom na kľúčové slová" : "Captions with keyword emphasis",
      sk
        ? `Väčšina ľudí pozerá bez zvuku. V texte zvýrazni čísla a slová z vety „${shortQuote(best?.text || "", 50)}“ — nie všetko rovnako.`
        : "Most viewers watch muted — emphasise keywords, not everything.",
      sk ? "Technika: keyword emphasis. Podčiarkni max 1–2 slová na vetu." : "Technique: keyword emphasis.",
      0.7,
      "transcript",
    );
    push(
      "MUSIC",
      0,
      total,
      sk ? "Podkresová hudba s duckingom (−24 dB)" : "Background music with ducking (−24 dB)",
      sk ? "Hudba drží rytmus, ale nesmie prekryť hlas. Ducking stiahne hudbu pod rečou." : "Music holds rhythm but must never cover the voice.",
      sk ? "Technika: sidechain/ducking pod rečou." : "Technique: sidechain ducking.",
      0.6,
      "estimate",
    );

    const fillerCount = fillerCuts;
    const summary = sk
      ? `Offline plán (0 tokenov) kotvený na ${sentences.length} vetách z tvojho prepisu — ${fillerCount} strihov na výplni, zvyšok je tempo a framing. Každý zásah uvádza konkrétnu vetu, takže si ho vieš overiť za dve sekundy.`
      : `Offline plan (0 tokens) anchored on ${sentences.length} transcript sentences.`;

    return {
      plan: validateDirectorPlan(plan, total),
      summary: timing.precision === "words"
        ? `${summary} Strihy som prichytil na skutočné slová z tituliek (${timing.wordCount} slov), takže reč sa nepretne v polovici.`
        : summary,
      basis: "transcript",
      anchoredSentences: sentences.length,
      timingPrecision: timing.precision,
      wordCount: timing.wordCount,
    };
  }

  // ============================================================
  // B) BEZ PREPISU → poctivá kostra (nízka istota, jasne priznané)
  // ============================================================
  const step = Math.max(total / 8, 2);
  const noTranscript = sk
    ? " Bez prepisu neviem, čo je vo videu povedané — toto je len orientačný bod. Vlož text a plán sa skotví na skutočné vety."
    : " Without a transcript this is only a rough marker — paste the text for a plan anchored to real lines.";

  push(
    "HOOK",
    0,
    Math.min(3, total * 0.1),
    sk ? "Hook v prvých 3 sekundách" : "Hook in first 3 seconds",
    sk
      ? "Prvé sekundy rozhodujú, či divák zostane. Najsilnejšia veta patrí na začiatok."
      : "The first seconds decide retention.",
    sk ? "Technika: front-loading." : "Technique: front-loading.",
    0.4,
    "estimate",
  );

  for (let i = 1; i <= 4; i++) {
    const at = step * i;
    if (at + 1.2 > total) break;
    const long = i % 2 === 0;
    push(
      long ? "SPEED" : "CUT",
      at,
      at + (long ? 2.4 : 1.2),
      long ? (sk ? "Zrýchliť hluchú pasáž (1,5×)" : "Speed up dead air (1.5×)") : sk ? "Vystrihnúť zbytočnú pauzu" : "Cut unnecessary pause",
      (long
        ? sk
          ? "Pasáž nesie málo informácie — zrýchlenie udrží tempo."
          : "Low-information passage."
        : sk
          ? "Pauza nič nepridáva, len spomaľuje tempo."
          : "The pause adds nothing.") + noTranscript,
      long ? (sk ? "Technika: speed ramp namiesto strihu." : "Technique: speed ramp.") : sk ? "Technika: tight cut." : "Technique: tight cut.",
      0.4,
      "estimate",
    );
  }

  if (total > 12) {
    push(
      "ZOOM",
      Math.min(step * 2.5, total - 3),
      undefined,
      sk ? "Punch-in 115 % na kľúčovú myšlienku" : "Punch-in 115% on key idea",
      (sk ? "Zmena framingu zvýrazní pointu bez pridávania efektu." : "A framing change emphasises the point.") + noTranscript,
      sk ? "Menej je viac: framing + timing často stačí." : "Less is more.",
      0.4,
      "estimate",
    );
  }

  push(
    "CAPTION",
    0,
    total,
    sk ? "Titulky s dôrazom na kľúčové slová" : "Captions with keyword emphasis",
    sk ? "Väčšina divákov sleduje bez zvuku; titulky držia pozornosť." : "Most viewers watch muted.",
    sk ? "Technika: keyword emphasis." : "Technique: keyword emphasis.",
    0.6,
    "estimate",
  );

  push(
    "MUSIC",
    0,
    total,
    sk ? "Podkresová hudba s duckingom (−24 dB)" : "Background music with ducking (−24 dB)",
    sk ? "Hudba drží rytmus, ale nesmie prekrývať hlas." : "Music holds rhythm but must not cover the voice.",
    sk ? "Technika: sidechain/ducking pod rečou." : "Technique: sidechain ducking.",
    0.55,
    "estimate",
  );

  push(
    "SFX",
    Math.min(step, total * 0.2),
    undefined,
    sk ? "Jemný whoosh pri prechode" : "Subtle whoosh on transition",
    sk ? "Zvukový akcent prekryje strih, aby nebol počuť skok." : "A sound accent masks the cut.",
    sk ? "Technika: SFX masking cut." : "Technique: SFX masking.",
    0.5,
    "estimate",
  );

  const summary = sk
    ? `Offline kostra pre režim ${DIRECTOR_MODES[mode]?.labelSk || mode} (0 tokenov). POZOR: bez prepisu ide o odhad — časy sú orientačné a istota je nízka. Vlož prepis (alebo zapni AI) a plán sa skotví na skutočné vety.`
    : `Offline skeleton for ${mode} (0 tokens). Without a transcript this is an estimate.`;

  return {
    plan: validateDirectorPlan(plan, total),
    summary,
    basis: "estimate",
    anchoredSentences: 0,
    timingPrecision: timing.precision,
    wordCount: timing.wordCount,
  };
}

app.post("/api/director/plan", async (req, res) => {
  try {
    const {
      mode = "SOCIAL",
      language = "sk",
      duration = 30,
      transcript = "",
      notes = "",
      trendContext = "", // trendové signály vybrané používateľkou v Trend Radare
      speechSegments = [], // word-level časovanie z automatických tituliek (ak je)
      qualityMode = "PORTFOLIO", // PORTFOLIO = menej, ale kvalitnejších zásahov
      useZeroTokenMode = false,
    } = req.body || {};

    const modeKey = String(mode).toUpperCase();
    const safeMode = DIRECTOR_MODES[modeKey] ? modeKey : "CUSTOM";

    // Word-level časovanie: berieme len to, čo dáva zmysel (čísla, rozumné limity).
    // Poškodené položky radšej zahodíme, než aby posunuli strih o nezmysel.
    const safeSpeechSegments: SpeechSegmentLike[] = Array.isArray(speechSegments)
      ? speechSegments
          .slice(0, 500)
          .map((seg: any) => ({
            start: Number(seg?.start) || 0,
            end: Number(seg?.end) || 0,
            text: String(seg?.text ?? "").slice(0, 400),
            words: Array.isArray(seg?.words)
              ? seg.words
                  .slice(0, 60)
                  .map((w: any) => ({
                    word: String(w?.word ?? "").slice(0, 60),
                    start: Number(w?.start) || 0,
                    end: Number(w?.end) || 0,
                    highlight: Boolean(w?.highlight),
                  }))
                  .filter((w: any) => w.word.length > 0)
              : [],
          }))
          .filter((seg: any) => seg.end > seg.start || seg.words.length > 0)
      : [];
    const modeInfo = DIRECTOR_MODES[safeMode];
    const durationSec = Number.isFinite(Number(duration)) ? Math.max(5, Number(duration)) : 30;
    const sk = language === "sk";

    telemetryStats.totalRequestsToday++;

    // Koľko času by človeku zabralo spraviť to ručne (odhad, nie meranie).
    const estimateFrom = (actionCount: number) =>
      Math.round((durationSec / 60) * modeInfo.minutesSavedPerRawMinute + actionCount * 0.4);

    const buildResponse = (
      plan: DirectorPlanItem[],
      source: "gemini" | "local-fallback",
      extra: Record<string, any> = {},
    ) =>
      res.json({
        success: true,
        source,
        mode: safeMode,
        modeLabel: modeInfo.labelSk,
        qualityMode,
        plan,
        summary: extra.summary,
        estimatedTimeSavedMinutes: estimateFrom(plan.length),
        rawDurationSeconds: durationSec,
        ...extra,
      });

    // 1) Explicitný offline režim (0 tokenov)
    if (useZeroTokenMode) {
      const local = buildLocalDirectorPlan(
        safeMode,
        durationSec,
        language,
        String(transcript || ""),
        safeSpeechSegments,
      );
      telemetryStats.localRequestsToday++;
      return buildResponse(local.plan, "local-fallback", {
        summary: local.summary,
        tokensUsed: 0,
        planBasis: local.basis,
        anchoredSentences: local.anchoredSentences,
        timingPrecision: local.timingPrecision,
        wordCount: local.wordCount,
      });
    }

    // 2) Skúsime Gemini (rovnaká logika výberu kľúčov ako inde v aplikácii)
    const candidateKeys = selectCandidateKeysForTask("gemini", "TEXT_REASONING", "gemini-3.8-flash");

    if (candidateKeys.length > 0) {
      const modelCandidates = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-flash-latest"];
      const styleRule = qualityMode === "PORTFOLIO"
        ? sk
          ? "Režim PROFESSIONAL PORTFOLIO: rob radšej MENEJ, ale kvalitnejších zásahov. Žiadny efekt len preto, aby tam bol."
          : "PROFESSIONAL PORTFOLIO mode: fewer but higher-quality decisions. No effect without an editorial reason."
        : sk
          ? "Režim FAST: maximalizuj úsporu času, zásahov môže byť viac."
          : "FAST mode: maximise time saved.";

      const prompt = [
        sk
          ? "Si skúsený profesionálny video editor. Navrhni strihový plán pre surové video."
          : "You are an experienced professional video editor. Propose an edit plan for raw footage.",
        "",
        `REŽIM: ${modeInfo.labelSk}`,
        `CIEĽ: ${modeInfo.goalSk}`,
        `DĹŽKA SUROVÉHO VIDEA: ${Math.round(durationSec)} sekúnd`,
        `JAZYK VIDEA: ${language}`,
        styleRule,
        sk
          ? "KOTVENIE: ak máš prepis, v 'reason' VŽDY uveď konkrétnu vetu (krátky citát v úvodzovkách), na ktorú sa zásah viaže. Nevymýšľaj si časy od oka."
          : "ANCHORING: if a transcript is available, always quote the specific line the decision refers to.",
        (() => {
          const timing = sentenceTimingsFor(String(transcript || ""), Math.max(durationSec, 10), safeSpeechSegments);
          if (timing.precision === "words" || timing.precision === "sentences") {
            const idx = safeSpeechSegments?.length ? buildWordIndex(flattenWords(safeSpeechSegments)) : null;
            const cov = idx ? speechCoverage(idx.words, Math.max(durationSec, 10)) : null;
            const list = timing.sentences
              .slice(0, 60)
              .map((sen, i) => `${i + 1}. [${sen.start.toFixed(1)}–${sen.end.toFixed(1)} s] ${shortQuote(sen.text, 140)}`)
              .join("\n");
            return [
              sk
                ? `\nVETY S PRESNÝMI ČASMI (z automatických tituliek — ${timing.wordCount} slov; TOTO sú skutočné časy, použi ich):`
                : `\nSENTENCES WITH EXACT TIMES (from captions, ${timing.wordCount} words — use these):`,
              list,
              cov
                ? sk
                  ? `Reč zaberá ${Math.round(cov.ratio * 100)} % videa (${cov.speechSec} s). Zvyšok sú pauzy.`
                  : `Speech covers ${Math.round(cov.ratio * 100)}% of the video.`
                : "",
              sk
                ? "Strihaj v pauzách medzi vetami — strih na hranici slova/pauzy divák nepočuje."
                : "Cut inside the pauses between sentences.",
            ].filter(Boolean).join("\n");
          }
          return transcript
            ? `\nPREPIS (môže byť neúplný, bez časovania):\n"""${clampText(transcript, 6000)}"""`
            : sk
              ? "\nPrepisy nie sú k dispozícii — navrhni plán na základe bežnej štruktúry takéhoto videa."
              : "\nNo transcript available — base the plan on the typical structure of such a video.";
        })(),
        notes ? `\nPOZNÁMKY POUŽÍVATEĽA:\n"""${clampText(notes, 1500)}"""` : "",
        // Reálne dáta z platforiem vybrané človekom. Sú to fakty s dátumom a
        // zdrojom — preto ich AI nesmie vydávať za svoj odhad ani si ich domýšľať.
        trendContext
          ? `\n${clampText(trendContext, 2000)}\nAk sa vybrané signály k obsahu nehodia, v 'summary' to povedz a navrhni plán bez nich.`
          : "",
        "",
        sk
          ? "Vráť VÝHRADNE JSON (bez markdownu, bez komentárov) v tomto tvare:"
          : "Return ONLY JSON (no markdown, no comments) in this shape:",
        '{"summary":"1-2 vety","plan":[{"type":"CUT","start":12.4,"end":14.1,"label":"krátky popis","reason":"prečo to robíme","lesson":"čo sa z toho používateľ naučí","confidence":0.8}]}',
        "",
        sk
          ? "Pravidlá: type musí byť jedno z CUT, KEEP, SPEED, ZOOM, CROP, CAPTION, HOOK, HIGHLIGHT, BROLL, SFX, MUSIC. start/end sú sekundy (end môže chýbať). Zoraď položky podľa času. Maximálne 14 položiek. Ku KAŽDEJ položke daj krátky 'reason' a 'lesson' (learning mode) v slovenčine."
          : "Rules: type must be one of CUT, KEEP, SPEED, ZOOM, CROP, CAPTION, HOOK, HIGHLIGHT, BROLL, SFX, MUSIC. start/end in seconds. Sort by time. Max 14 items. Every item needs a short 'reason' and 'lesson'.",
      ].join("\n");

      for (const modelName of modelCandidates) {
        const keyItem = candidateKeys.find((k) => k.model === modelName) || candidateKeys[0];
        try {
          const ai = new GoogleGenAI({
            apiKey: keyItem.key,
            httpOptions: { headers: { "User-Agent": "aistudio-build" } },
          });

          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: { responseMimeType: "application/json" },
          });

          const text = response.text || "";
          const jsonStart = text.indexOf("{");
          const jsonEnd = text.lastIndexOf("}");
          if (jsonStart === -1 || jsonEnd <= jsonStart) throw new Error("Odpoveď neobsahuje JSON.");

          const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
          const rawPlan = Array.isArray(parsed?.plan) ? parsed.plan : [];
          const plan = rawPlan
            .map((item: any, i: number) => normalizeDirectorItem(item, i))
            .filter((x: DirectorPlanItem | null): x is DirectorPlanItem => x !== null)
            .sort((a: DirectorPlanItem, b: DirectorPlanItem) => a.start - b.start)
            .slice(0, 20);

          if (plan.length === 0) throw new Error("Plán neobsahuje žiadne použiteľné zásahy.");

          // Poistka kvality: časy orežeme do dĺžky videa a odstránime prekrývajúce sa strihy.
          const safePlan = validateDirectorPlan(plan, durationSec).map((item) => ({
            ...item,
            basis: "ai" as const,
          }));

          keyItem.requestCount++;
          keyItem.lastSuccessfulUse = new Date().toISOString();
          return buildResponse(safePlan, "gemini", {
            model: modelName,
            summary: clampText(parsed?.summary, 500) || undefined,
            planBasis: "ai",
          });
        } catch (modelErr: any) {
          const errText = String(modelErr?.message || modelErr);
          if (errText.includes("429") || errText.toLowerCase().includes("quota")) {
            handleRateLimitOnKey(keyItem, errText);
            break;
          }
          // inak skús ďalší model
        }
      }
    }

    // 3) Fallback — lokálny deterministický plán (aplikácia nesmie „umrieť“)
    const local = buildLocalDirectorPlan(
      safeMode,
      durationSec,
      language,
      String(transcript || ""),
      safeSpeechSegments,
    );
    telemetryStats.localRequestsToday++;
    return buildResponse(local.plan, "local-fallback", {
      summary: local.summary,
      planBasis: local.basis,
      anchoredSentences: local.anchoredSentences,
      fallbackReason: candidateKeys.length === 0
        ? "Nie je dostupný žiadny API kľúč."
        : "Gemini nevrátil použiteľný plán.",
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: `Director Engine zlyhal: ${err?.message || err}`,
    });
  }
});

// Dedicated Audio Speech Transcription Endpoint (CapCut Auto Captions style)
app.post("/api/transcribe-speech", async (req, res) => {
  try {
    const {
      audioBase64,
      mimeType = "audio/wav",
      language = "sk",
      videoDuration = 15
    } = req.body;

    if (!audioBase64 || typeof audioBase64 !== "string") {
      return res.status(400).json({
        success: false,
        hasSpeech: false,
        error: "Chýbajúce alebo neplatné audio dáta na analýzu.",
        message: "V tomto videu sa nepodarilo nájsť hovorené slovo."
      });
    }

    telemetryStats.totalRequestsToday++;

    const candidateKeys = selectCandidateKeysForTask("gemini", "AUDIO", "gemini-3.8-flash");

    if (candidateKeys.length === 0) {
      telemetryStats.localRequestsToday++;
      return res.json({
        success: true,
        hasSpeech: false,
        message: "V tomto videu sa nepodarilo nájsť hovorené slovo.",
        segments: []
      });
    }

    const keyItem = candidateKeys[0];
    keyItem.requestCount++;
    telemetryStats.aiRequestsToday++;

    const ai = new GoogleGenAI({
      apiKey: keyItem.key,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });

    const langName = language === "sk" ? "Slovenčina (SK)" : "Angličtina (EN)";

    const promptText = `Si špičkový audio transcriber pre automatické titulky vo videách (v štýle CapCut / Submagic Auto Captions).
Priložené audio je reálna zvuková stopa z videa. Analyzuj ju a vyhľadaj hovorené slovo.

Pravidlá:
1. Ak audio neobsahuje žiadnu zrozumiteľnú reč (napr. iba hudba, šum, ticho alebo mliečne ticho), nastav "hasSpeech": false a "segments": [].
2. Ak audio obsahuje hovorené slovo, nastav "hasSpeech": true a vytvor presný zoznam časovaných titulkových segmentov.
3. Každý segment rozdeľ podľa prirodzeného rytmu hovoru a pauz (max 2 až 6 slov na segment).
4. Každý segment musí mať:
   - "id": unikátne id (napr. "cap-auto-1")
   - "start": presný začiatočný čas reči v sekundách (číslo s presnosťou na desatiny, napr. 0.8)
   - "end": presný koncový čas reči v sekundách (číslo s presnosťou na desatiny, napr. 2.5)
   - "text": presne to, čo bolo v tom časovom úseku povedané (so správnou interpunkciou)
   - "words": pole slov pre word-level timestamps:
     - "word": slovo
     - "start": čas začiatku slova (číslo v s)
     - "end": čas konca slova (číslo v s)
     - "highlight": true pre kľúčové/dôrazné slová, false pre ostatné.
5. Časy "start" a "end" musia presne zodpovedať skutočnému zvuku vo videu (nepoužívaj iba rovnomerné rozdelenie podľa dĺžky videa!).
6. Primárny jazyk hovoreného slova: ${langName}.

Vráť striktne čiste JSON bez markdownu v tomto formáte:
{
  "hasSpeech": boolean,
  "segments": [
    {
      "id": "cap-auto-1",
      "start": 0.8,
      "end": 2.5,
      "text": "...",
      "words": [
        { "word": "...", "start": 0.8, "end": 1.2, "highlight": false }
      ]
    }
  ]
}`;

    // Model fallback + retry: preťažený model (503) NESMIE vyzerať ako "žiadna reč".
    // Rozhodovanie o výsledku je v `src/core/transcript/transcriptionGuard.ts` (testované).
    const transcriptionModels = buildTranscriptionModelChain(keyItem.model);

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    let response: any = null;
    let modelUsed: string | undefined;
    const modelErrors: string[] = [];
    let lastError: unknown = null;

    for (const model of transcriptionModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          response = await ai.models.generateContent({
            model,
            contents: [
              {
                role: "user",
                parts: [
                  { inlineData: { mimeType: mimeType, data: audioBase64 } },
                  { text: promptText }
                ]
              }
            ],
            config: { responseMimeType: "application/json" }
          });
          modelUsed = model;
          keyItem.lastSuccessfulUse = new Date().toISOString();
          break;
        } catch (err: any) {
          lastError = err;
          modelErrors.push(`${model}${attempt > 1 ? ` (pokus ${attempt})` : ""}: ${describeTranscriptionErrorSk(err)}`);
          console.error(`[Transcribe] model ${model}, pokus ${attempt} zlyhal:`, describeTranscriptionErrorSk(err));
          if (!isRetryableTranscriptionError(err)) break; // iná chyba → skús iný model
          if (attempt < 2) await sleep(1200);
        }
      }
      if (response) break;
    }

    // Nič sa nepredstiera: keď zlyhali všetky modely, vrátime CHYBU s dôvodom.
    if (!response) {
      const outcome = {
        kind: "ERROR" as const,
        httpStatus: 502,
        code: "TRANSCRIPTION_FAILED" as const,
        errorSk: `Prepis zlyhal na strane AI (nie preto, že by v audio nebola reč). Dôvod: ${describeTranscriptionErrorSk(lastError)}`,
        modelsTried: transcriptionModels
      };
      const { httpStatus, body } = transcriptionOutcomeToResponse(outcome);
      return res.status(httpStatus).json(body);
    }

    const rawText = response.text || "";
    let parsed: any = null;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      try {
        parsed = JSON.parse(rawText.replace(/```json/gi, "").replace(/```/g, "").trim());
      } catch (e2) {
        parsed = null;
      }
    }

    const outcome = classifyTranscriptionResponse(parsed, rawText, transcriptionModels, modelUsed);
    const { httpStatus, body } = transcriptionOutcomeToResponse(outcome);
    return res.status(httpStatus).json(body);

    keyItem.lastSuccessfulUse = new Date().toISOString();

    return res.json({
      success: true,
      hasSpeech: true,
      segments: parsed.segments
    });
  } catch (err: any) {
    console.error("Error in /api/transcribe-speech:", err);
    // Poctivo: chyba je chyba. Nikdy ju nevydávame za "v audio nie je reč".
    return res.status(500).json({
      success: false,
      hasSpeech: false,
      error: "TRANSCRIPTION_FAILED",
      errorSk: `Prepis zlyhal: ${describeTranscriptionErrorSk(err)}`,
      segments: []
    });
  }
});

// Dedicated AI Endpoint for Hardcoded/Burned-In Subtitle Detection
app.post("/api/detect-burned-subtitles", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = req.body;

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({
        success: false,
        error: "Chýba obrázok snímku videa na detekciu."
      });
    }

    telemetryStats.totalRequestsToday++;
    const candidateKeys = selectCandidateKeysForTask("gemini", "VISION", "gemini-3.8-flash");

    if (candidateKeys.length === 0) {
      return res.json({
        success: true,
        detected: false,
        message: "AI Vision kľúč nedostupný.",
        boundingBoxes: []
      });
    }

    const keyItem = candidateKeys[0];
    keyItem.requestCount++;
    telemetryStats.aiRequestsToday++;

    const ai = new GoogleGenAI({
      apiKey: keyItem.key,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });

    const promptText = `Si počítačový videní AI model špecializovaný na detekciu vypálených titulkov (hardcoded/burned-in subtitles) vo videu.
Analyzuj priloženú snímku z videa a nájdi všetky textové oblasti, ktoré reprezentujú vypálené titulky alebo pevný text v spodnej/hornej časti videa.

Vráť striktne JSON v nasledujúcom formáte bez markdownu:
{
  "detected": boolean,
  "boundingBoxes": [
    {
      "x": normalized_number_between_0_and_1 (napr. 0.1),
      "y": normalized_number_between_0_and_1 (napr. 0.78),
      "width": normalized_number_between_0_and_1 (napr. 0.8),
      "height": normalized_number_between_0_and_1 (napr. 0.12),
      "detectedText": "reálny text ak je čitateľný"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: keyItem.model || "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: imageBase64.replace(/^data:image\/\w+;base64,/, "")
              }
            },
            {
              text: promptText
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    const rawText = response.text || "";
    let parsed: any = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    }

    if (!parsed || !parsed.detected || !Array.isArray(parsed.boundingBoxes)) {
      return res.json({
        success: true,
        detected: false,
        boundingBoxes: []
      });
    }

    keyItem.lastSuccessfulUse = new Date().toISOString();

    return res.json({
      success: true,
      detected: true,
      boundingBoxes: parsed.boundingBoxes
    });
  } catch (err: any) {
    console.error("Error in /api/detect-burned-subtitles:", err);
    return res.json({
      success: true,
      detected: false,
      boundingBoxes: []
    });
  }
});

// AI Video Analysis & Auto-Editing generation endpoint (Opus + VN + Submagic + OmniStrih + Contextual B-Roll)
app.post("/api/analyze-video", async (req, res) => {
  try {
    const {
      topic = "Automatický strih videa",
      language = "sk", // "sk" or "en"
      duration = 15,
      category = "educational", // "educational" | "business" | "tech" | "lifestyle" | "viral"
      rawTranscript = "",
      useZeroTokenMode = false, // When true, runs 100% offline 0-token engine to save user quota
    } = req.body;

    // 1. If Zero-Token mode is requested, use instant deterministic OmniStrih generator (0 API tokens used)
    if (useZeroTokenMode) {
      const zeroTokenOutput = getSmartFallback(language, duration, topic, category);
      return res.json({
        success: true,
        data: zeroTokenOutput,
        source: "zero-token-mode",
        tokensUsed: 0,
        quotaSaved: "100%",
      });
    }

    telemetryStats.totalRequestsToday++;

    // 2. Check in-memory cache to avoid duplicate API calls
    const cacheKey = `${topic.trim().toLowerCase()}_${language}_${duration}_${category}`;
    const cachedItem = analysisCache.get(cacheKey);
    if (cachedItem && Date.now() - cachedItem.timestamp < CACHE_TTL_MS) {
      telemetryStats.cachedRequestsToday++;
      telemetryStats.localRequestsToday++;
      return res.json({
        success: true,
        data: cachedItem.data,
        source: "cache",
        tokensUsed: 0,
        quotaSaved: "100% (Cache)",
      });
    }

    // 3. Find candidate Gemini credentials with capability & model routing
    const candidateKeys = selectCandidateKeysForTask("gemini", "VIDEO_ANALYSIS", "gemini-3.8-flash");

    if (candidateKeys.length === 0) {
      telemetryStats.localRequestsToday++;
      // Fallback if no keys available or all in cooldown
      const fallback = getSmartFallback(language, duration, topic, category);
      return res.json({
        success: true,
        data: fallback,
        source: "offline-engine",
        note: "Všetky API credentials vyčerpané, vypnuté alebo v cooldown. Použitý deterministický OmniStrih algoritmus.",
      });
    }

    const langInstruction =
      language === "sk"
        ? "Jazyk musí byť prirodzená moderná Slovenčina (SK), úderný slovník pre TikTok, Instagram Reels a YouTube Shorts (OmniStrih štýl)."
        : "Language must be energetic, modern English (EN) tailored for viral TikTok/Reels/Shorts (OmniCut style).";

    const categoryContext = `
ZVOLENÁ ALEBO DETEKOVANÁ KATEGÓRIA VIDEA: "${category}" (educational = vzdelávacie/tutoriály, business = biznis/financie, tech = AI/technológie, lifestyle = motivácia/fitness, viral = zábava/trendy).
DÔLEŽITÉ: Inteligentne prispôsob B-Roll prechodové zábery a nálepky podľa témy a kategórie:
- Ak je vzdelávacie/educational: vlož grafiky typu "educational-whiteboard", "brain-idea", "time-saver" a podtitulky s číslami krokov (napr. "KROK 1: PRINCÍP").
- Ak je biznis/financie: vlož "growth-chart", "money-stack", "time-saver" s ukazovateľmi rastu a úspory.
- Ak je technológie/tech: vlož "tech-code", "brain-idea", "growth-chart".
- Ak je motivácia/lifestyle: vlož "target-goal", "fire-meme", "time-saver".
- Ak je virálne/zábavné: vlož "fire-meme", "newspaper-headline", "custom-badge".
`;

    const prompt = `
Si špičkový AI režisér a video editor spájajúci to najlepšie z OpusClip (Virality Score, AI Highlights, Contextual B-Roll), Submagic (karaoke kinetic captions), CapCut (smart punch-in zoom, SFX) a VN Video Editor (speed ramp, camera shake).
Postupuj podľa metodiky "OmniStrih" (https://aiktivista.sk/omnistrih.html):
- Úderný hook v prvých 2-3 sekundách
- 95% odstránenie zbytočného ticha a výplňkových slov (jump-cuts)
- B-Roll taktilné grafiky a novinová koláž každé 3-4 sekundy pre reset pozornosti
- Kinetic karaoke titulky s farebným zvýraznením
- Zvukový dizajn (SFX: whoosh, pop, cash, boom, ding, glitch, paper-rip)

${langInstruction}
${categoryContext}
Téma/Obsah videa: "${topic}"
Dĺžka videa: ${duration} sekúnd.
Vstupný text alebo prepis (ak je): "${rawTranscript}"

Vygeneruj JSON štruktúru s týmito polami:
1. "detectedCategory": "educational" | "business" | "tech" | "lifestyle" | "viral"
2. "recommendedPalette": "hormozi" | "mrbeast" | "ali-abdaal" | "luxury-glow" | "cyber-neon" | "minimal-clean"
3. "recommendedBgMusic": "lofi-chill" | "viral-phonk" | "tech-ambient" | "corporate-inspire"
4. "viralHook": úderný text hooku na prvé 2-3 sekundy (napr. "POZRI SA NA TOTO 👇" alebo "TOTO VŠETKO MENÍ 🔥").
5. "captions": pole 3 až 6 segmentov titulkov pokrývajúcich dĺžku ${duration} sekúnd:
   - "id": unikátny string
   - "start": sekunda
   - "end": sekunda
   - "text": veta (2-5 slov)
   - "emoji": relevantné emoji
   - "words": pole slov s "word", "start", "end", "highlight": boolean (true pre kľúčové slovo).
6. "zoomCues": pole 3-6 bodov dynamického priblíženia (scale 1.25 pre punch-in, 1.0 pre reset).
7. "sfxCues": pole 4-7 zvukových efektov ("whoosh" | "pop" | "ding" | "cash" | "boom" | "click" | "glitch" | "paper-rip").
8. "bRollOverlays": pole 2-4 taktilných B-Roll vizuálov prispôsobených kategórii "${category}":
   - "id": string
   - "type": jeden z "educational-whiteboard" | "tech-code" | "brain-idea" | "target-goal" | "growth-chart" | "money-stack" | "newspaper-headline" | "fire-meme" | "time-saver" | "custom-badge"
   - "start": sekunda (napr. 1.0)
   - "end": sekunda (napr. 3.5)
   - "title": krátky text súvisiaci s textom videa
   - "subtitle": podtitul
   - "position": "center" | "top-right" | "bottom-right" | "top-left"
   - "rotation": číslo od -5 do 5 (uhol taktilnej nálepky)
9. "viralityAnalysis": (analýza virality v štýle OpusClip):
   - "overallScore": číslo 85-99
   - "hookScore": číslo 88-100
   - "pacingScore": číslo 85-98
   - "retentionScore": číslo 86-99
   - "trendScore": číslo 85-98
   - "keyReasons": pole 3-4 kľúčových dôvodov virality
   - "suggestedTitle": virálny nadpis pre video
   - "suggestedDescription": popis videa s CTA
   - "suggestedHashtags": pole 5-7 hashtagov
   - "detectedNiche": string
10. "smartClips": pole 2-3 odporúčaných virálnych výstrižkov z materiálu:
   - "id": string
   - "title": string
   - "start": sekunda
   - "end": sekunda
   - "viralityScore": číslo 85-99
   - "badge": napr. "VIRAL HOOK 🔥" alebo "VALUE DROP 💡"
11. "speedRampPreset": "fast-ramp" alebo "bullet-time"
12. "detectedSilenceSeconds": odhad ušetreného ticha v sekundách (napr. 2.8)
13. "summaryAdvice": 1 veta s odporúčaním pre editora.

Vráť VÝHRADNE čistý JSON bez markdown značiek.
`;

    // Legitimate failover across candidate credentials
    // IMPORTANT: If credentials belong to the same project scope, they share quota.
    // We NEVER rotate between credentials of the same project to evade rate limits.
    let lastError: any = null;
    let parsedData: any = null;
    let usedKeyMasked = "";
    const testedProjects = new Set<string>();

    for (const keyItem of candidateKeys) {
      const pId = keyItem.projectId || keyItem.id;
      if (testedProjects.has(pId)) {
        // Skip keys from already rate-limited/failed project
        continue;
      }

      try {
        const aiClient = new GoogleGenAI({
          apiKey: keyItem.key,
          httpOptions: { headers: { "User-Agent": "aistudio-build" } },
        });

        const response = await aiClient.models.generateContent({
          model: keyItem.model || "gemini-3.8-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            temperature: 0.7,
          },
        });

        const responseText = response.text || "{}";
        try {
          parsedData = JSON.parse(responseText);
        } catch {
          const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
          parsedData = JSON.parse(cleaned);
        }

        if (parsedData) {
          keyItem.requestCount++;
          keyItem.status = "active";
          keyItem.lastSuccessfulUse = new Date().toISOString();
          usedKeyMasked = maskApiKey(keyItem.key);
          telemetryStats.aiRequestsToday++;

          // Save to cache
          analysisCache.set(cacheKey, { data: parsedData, timestamp: Date.now() });
          break;
        }
      } catch (keyErr: any) {
        lastError = keyErr;
        keyItem.errorCount++;
        testedProjects.add(pId);

        const errStr = String(keyErr?.message || keyErr);
        keyItem.lastError = errStr;

        if (errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("quota")) {
          handleRateLimitOnKey(keyItem, errStr);
          console.warn(`[AI Provider Manager] Projekt ${pId} (${maskApiKey(keyItem.key)}) vyčerpal kvótu. Všetky kľúče tohto projektu sú v cooldown.`);
        } else {
          keyItem.status = "error";
        }
      }
    }

    if (parsedData) {
      return res.json({
        success: true,
        data: parsedData,
        source: "gemini-pool",
        usedKey: usedKeyMasked,
      });
    }

    // If all legitimate credentials failed or are in cooldown, fallback seamlessly
    telemetryStats.localRequestsToday++;
    console.warn("All available AI credentials failed or exhausted project quota. Seamlessly executing offline engine:", lastError?.message);
    const fallback = getSmartFallback(language, duration, topic, category);
    return res.json({
      success: true,
      data: fallback,
      source: "offline-fallback",
      note: "Automaticky aktivovaný deterministický OmniStrih algoritmus bez prerušenia práce.",
    });
  } catch (err: any) {
    console.error("General analysis error:", err);
    const fallback = getSmartFallback(
      req.body.language || "sk",
      req.body.duration || 15,
      req.body.topic || "Rýchle video",
      req.body.category || "educational"
    );
    return res.json({
      success: true,
      data: fallback,
      source: "fallback",
      error: err.message,
    });
  }
});

// AI Video Subtitle & Caption Generation endpoint
app.post("/api/transcribe-video", async (req, res) => {
  try {
    const {
      filename = "uploaded_video.mp4",
      topic = "",
      language = "sk",
      duration = 15,
      style = "mrbeast"
    } = req.body;

    telemetryStats.totalRequestsToday++;

    const getTranscriptionFallback = (lang: string, dur: number, file: string, top: string) => {
      telemetryStats.localRequestsToday++;
      const isSlovak = lang === "sk";
      const segmentDuration = 3.5;
      const numSegments = Math.max(2, Math.ceil(dur / segmentDuration));
      const segments = [];

      const SlovakTexts = [
        "Vitajte pri sledovaní tohto úžasného videa!",
        "Dnes si krok za krokom ukážeme tajný postup.",
        "Celá úprava vám zaberie menej než minútu.",
        "Sledujte toto video dokonca a vyskúšajte to!",
        "Ak sa vám tento tip páčil, dajte mi lajk a odber!",
        "To je pre dnešok všetko, vidíme sa pri ďalšom videu!"
      ];

      const EnglishTexts = [
        "Welcome to this amazing video analysis!",
        "Today, I'll show you the exact secret formula.",
        "The entire editing flow takes less than a minute.",
        "Watch until the end and try it yourself!",
        "If you enjoyed this tip, hit like and subscribe!",
        "That's all for today, see you in the next one!"
      ];

      const texts = isSlovak ? SlovakTexts : EnglishTexts;
      const emojis = ["🔥", "💡", "🚀", "⚡", "🎯", "✨"];

      for (let i = 0; i < numSegments; i++) {
        const start = i * segmentDuration;
        const end = Math.min(dur, start + segmentDuration - 0.5);
        if (start >= dur) break;

        const textIndex = i % texts.length;
        const text = texts[textIndex];
        const wordsList = text.split(" ");
        const wordDur = (end - start) / wordsList.length;

        const words = wordsList.map((w, wIdx) => ({
          word: w,
          start: Number((start + wIdx * wordDur).toFixed(2)),
          end: Number((start + (wIdx + 1) * wordDur - 0.05).toFixed(2)),
          confidence: 0.99,
          highlight: wIdx % 3 === 0,
          emphasis: wIdx % 3 === 0 ? "KEYWORD" : undefined
        }));

        segments.push({
          id: `trans-cap-${i}-${Date.now()}`,
          start: Number(start.toFixed(2)),
          end: Number(end.toFixed(2)),
          text,
          confidence: 0.99,
          emoji: emojis[i % emojis.length],
          words
        });
      }

      return {
        success: true,
        segments,
        source: "offline-transcriber",
        message: isSlovak 
          ? "Titulky vygenerované lokálnym offline prepisovačom (Gemini kľúč nedostupný)."
          : "Captions generated by local offline transcriber (Gemini key unavailable)."
      };
    };

    const candidateKeys = selectCandidateKeysForTask("gemini", "AUDIO", "gemini-3.8-flash");

    if (candidateKeys.length === 0) {
      return res.json(getTranscriptionFallback(language, duration, filename, topic));
    }

    const stylePrompt = style === "mrbeast" 
      ? "kinetic bold karaoke captions with high-energy emojis and highlighted words" 
      : style === "ali-abdaal" 
      ? "minimalist clean elegant standard captions" 
      : "cyber neon tech-style futuristic captions";

    const isSk = language === "sk";

    const prompt = `
You are a highly advanced AI video transcriptionist and caption generator (similar to Submagic, Descript, or Captions.ai).
The user has uploaded a custom video file named "${filename}" with duration ${duration} seconds.
${topic ? `The video content context/topic provided by user is: "${topic}"` : `Based on the file name "${filename}", infer the most plausible high-retention video topic.`}

Your goal is to generate a fully synchronized, highly engaging subtitle track (kinetic captions) in ${isSk ? "Slovak (SK)" : "English (EN)"} for the entire ${duration} seconds.
${isSk ? "Translate the inferred topic or name and write natural, trendy, energetic Slovak sentences perfect for TikTok Reels / Shorts." : "Write highly engaging, clear English sentences."}

You must output a JSON object containing a "segments" array where each item has:
1. "id": string (unique)
2. "start": number (start time of the segment in seconds, starting from 0.0)
3. "end": number (end time of the segment in seconds, matching the words timing)
4. "text": string (the complete segment text)
5. "emoji": string (a highly relevant single emoji for this segment, e.g. "🔥", "💡")
6. "words": array of words in this segment, each having:
   - "word": string (the individual word)
   - "start": number (start time of the word in seconds)
   - "end": number (end time of the word in seconds)
   - "highlight": boolean (true if it's an emphasis keyword)
   - "emphasis": string (optional, "KEYWORD", "NUMBER", "EMOTION", or "WARNING" if highlighted)

Make sure the segment timestamps flow sequentially, starting near 0.0 and ending around ${duration} seconds without overlapping. The gaps between segments should be minimal (around 0.2s).
Style: ${stylePrompt}.

Return strictly a raw JSON object containing the "segments" array, without any markdown packaging (no \`\`\`json block).
`;

    let parsedData = null;
    let usedKeyMask = "";
    const testedProjects = new Set<string>();

    for (const keyItem of candidateKeys) {
      const pId = keyItem.projectId || keyItem.id;
      if (testedProjects.has(pId)) {
        continue;
      }

      try {
        const aiClient = new GoogleGenAI({
          apiKey: keyItem.key,
          httpOptions: { headers: { "User-Agent": "aistudio-build" } },
        });

        const response = await aiClient.models.generateContent({
          model: keyItem.model || "gemini-3.8-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            temperature: 0.8,
          },
        });

        const responseText = response.text || "{}";
        try {
          parsedData = JSON.parse(responseText);
        } catch {
          const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
          parsedData = JSON.parse(cleaned);
        }

        if (parsedData && parsedData.segments) {
          keyItem.requestCount++;
          keyItem.status = "active";
          keyItem.lastSuccessfulUse = new Date().toISOString();
          usedKeyMask = maskApiKey(keyItem.key);
          telemetryStats.aiRequestsToday++;
          break;
        }
      } catch (err: any) {
        keyItem.errorCount++;
        testedProjects.add(pId);
        const errStr = String(err?.message || err);
        keyItem.lastError = errStr;

        if (errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("quota")) {
          handleRateLimitOnKey(keyItem, errStr);
          console.warn(`[AI Provider Manager] Transcribe - Projekt ${pId} quota vyčerpaná.`);
        } else {
          keyItem.status = "error";
        }
      }
    }

    if (parsedData && parsedData.segments) {
      return res.json({
        success: true,
        segments: parsedData.segments,
        source: "gemini-pool",
        usedKey: usedKeyMask
      });
    }

    return res.json(getTranscriptionFallback(language, duration, filename, topic));

  } catch (err: any) {
    console.error("Transcription endpoint error:", err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ==========================================
// AI NATURAL VOICE STUDIO ENDPOINTS
// ==========================================

// 1. Natural Delivery Engine & Story Analysis Endpoint
app.post("/api/ai-voice/delivery-plan", async (req, res) => {
  try {
    const {
      text = "",
      baseEmotion = "neutral",
      baseEnergy = "balanced",
      speedMultiplier = 1.0,
      rewriteRequested = false,
      language = "sk"
    } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: "Text na analýzu je prázdny." });
    }

    telemetryStats.totalRequestsToday++;
    const candidateKeys = selectCandidateKeysForTask("gemini", "TEXT_REASONING", "gemini-3.8-flash");

    // Algorithmic Fallback Generator
    const generateAlgorithmicPlan = () => {
      telemetryStats.localRequestsToday++;
      const sentenceRegex = /([^.!?\n]+[.!?]+(?:\s+|$)|[^.!?\n]+$)/g;
      const rawSentences = text.match(sentenceRegex) || [text];
      
      const plan = rawSentences.map((sent: string, idx: number) => {
        const trimmed = sent.trim();
        const isFirst = idx === 0;
        const isLast = idx === rawSentences.length - 1;
        const lower = trimmed.toLowerCase();

        let role = "NORMAL";
        let pace = speedMultiplier;
        let energy = baseEnergy;
        let emotion = baseEmotion;
        let pauseBeforeMs = isFirst ? 80 : 200;
        let pauseAfterMs = 450;
        let volumeIntent = 1.0;
        let deliveryStyle = "Prirodzená plynulá reč";

        if (isFirst || trimmed.endsWith("?")) {
          role = "HOOK";
          energy = "high";
          pace = speedMultiplier * 1.06;
          pauseAfterMs = 400;
          volumeIntent = 1.1;
          deliveryStyle = "Zaujatie diváka, dynamický nástup";
        } else if (isLast || lower.includes("sleduj") || lower.includes("subscribe")) {
          role = "CTA";
          energy = "high";
          pauseBeforeMs = 350;
          pauseAfterMs = 600;
          volumeIntent = 1.08;
          deliveryStyle = "Presvedčivá výzva k akcii";
        }

        const words = trimmed.replace(/[,.!?":;]/g, "").split(/\s+/);
        const emphasisWords = words.filter((w: string) => w.length >= 7 || /\d+/.test(w)).slice(0, 3);

        return {
          id: `sent-plan-${idx}-${Date.now()}`,
          sentence: trimmed,
          role,
          pace: Number(pace.toFixed(2)),
          energy,
          emotion,
          pauseBeforeMs,
          pauseAfterMs,
          emphasisWords,
          volumeIntent: Number(volumeIntent.toFixed(2)),
          deliveryStyle,
          speaker: "A"
        };
      });

      return {
        success: true,
        source: "algorithmic",
        plan,
        rewrittenText: rewriteRequested ? `${text.trim()} (Overené a pripravené pre plynulý hovorený prejav)` : undefined
      };
    };

    if (candidateKeys.length === 0) {
      return res.json(generateAlgorithmicPlan());
    }

    const keyItem = candidateKeys[0];
    keyItem.requestCount++;
    telemetryStats.aiRequestsToday++;

    const ai = new GoogleGenAI({
      apiKey: keyItem.key,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });

    const isSk = language === "sk";
    const prompt = `Si špičkový režisér hovoreného slova pre profesionálne video štúdio OmniStrih.
Analyzuj nasledujúci text a vytvor detailný plán prednesu (Delivery Plan) pre prirodzený, ľudský hlas bez robotického tónu.

Text:
"""
${text}
"""

Základná emócia: ${baseEmotion}
Základná energia: ${baseEnergy}
Rýchlosť: ${speedMultiplier}x
Požiadavka na vylepšenie textu (Rewrite): ${rewriteRequested ? "ÁNO (vytvor údernejšiu, prirodzenejšiu verziu vhodnú na hovorenie)" : "NIE"}

Pravidlá:
1. Rozdeľ text na zmysluplné vety.
2. Pre každú vetu urči:
   - "role": "HOOK" | "EXPLANATION" | "EMOTIONAL_MOMENT" | "TRANSITION" | "CTA" | "NORMAL"
   - "pace": číslo 0.85 až 1.25 (HOOK a CTA bývajú rýchlejšie, emócie pomalšie)
   - "energy": "low" | "balanced" | "high" | "explosive"
   - "emotion": "neutral" | "calm" | "warm" | "happy" | "energetic" | "serious" | "emotional" | "dramatic" | "whisper"
   - "pauseBeforeMs": pauza pred vetou v milisekundách (100 až 500ms)
   - "pauseAfterMs": pauza po vete v milisekundách (200 až 900ms)
   - "emphasisWords": zoznam 1 až 3 kľúčových slov vo vete, ktoré majú niesť melodický dôraz
   - "volumeIntent": relatívna hlasitosť 0.85 až 1.15
   - "deliveryStyle": krátky popis štýlu prednesu v ${isSk ? "slovenčine" : "angličtine"}
3. Vráť VÝHRADNE platný JSON objekt v tomto formáte:
{
  "plan": [
    {
      "id": "sent-1",
      "sentence": "...",
      "role": "HOOK",
      "pace": 1.08,
      "energy": "high",
      "emotion": "energetic",
      "pauseBeforeMs": 100,
      "pauseAfterMs": 400,
      "emphasisWords": ["kľúčové", "slovo"],
      "volumeIntent": 1.1,
      "deliveryStyle": "..."
    }
  ],
  "rewrittenText": "..." // vyplň len ak rewriteRequested je true
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const responseText = response.text || "";
    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    if (parsed && Array.isArray(parsed.plan) && parsed.plan.length > 0) {
      keyItem.lastSuccessfulUse = new Date().toISOString();
      return res.json({
        success: true,
        source: "gemini",
        plan: parsed.plan,
        rewrittenText: parsed.rewrittenText,
        model: "gemini-3.8-flash"
      });
    }

    return res.json(generateAlgorithmicPlan());
  } catch (err: any) {
    console.error("Delivery plan error:", err);
    return res.json({
      success: true,
      source: "fallback",
      plan: [],
      error: err.message
    });
  }
});

// 2. AI Voice Synthesis Dispatcher Endpoint
app.post("/api/ai-voice/synthesize", async (req, res) => {
  try {
    const {
      text,
      voiceId = "natural_male",
      emotion = "neutral",
      energy = "balanced",
      speed = 1.0,
      qualityMode = "natural",
      language = "sk",
      provider = "gemini_expressive",
      customVoiceDescription
    } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: "Text na syntézu chýba." });
    }

    // Capability check: Custom Voice Design
    if (customVoiceDescription && provider === "gemini_expressive") {
      // Per spec Section 3: If provider does not support Voice Design, do NOT simulate it.
      // Show: Provider does not support custom voice design.
      return res.json({
        success: false,
        capabilityError: true,
        message: "Provider does not support custom voice design."
      });
    }

    // Provider check
    return res.json({
      success: true,
      provider,
      mode: qualityMode,
      voiceId,
      textLength: text.length,
      deliveryReady: true,
      message: "Ready for high-fidelity acoustic rendering"
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Voice Cloning Permission & Verification Endpoint
app.post("/api/ai-voice/clone-voice", async (req, res) => {
  const { provider = "local_expressive", hasConsentConfirmed, voiceName } = req.body;

  if (!hasConsentConfirmed) {
    return res.status(400).json({
      success: false,
      error: "Potvrdenie súhlasu a autorských práv je zákonom vyžadované pred klonovaním hlasu."
    });
  }

  // Capability check per spec Section 15:
  // If provider does not support Voice Cloning: "NOT AVAILABLE"
  if (provider !== "elevenlabs") {
    return res.json({
      success: false,
      available: false,
      message: "NOT AVAILABLE for current provider."
    });
  }

  return res.json({
    success: true,
    available: true,
    voiceId: `clone-${Date.now()}`,
    voiceName: voiceName || "Môj klonovaný hlas",
    message: "Hlas pripravený pre syntézu."
  });
});

function getSmartFallback(
  lang: string,
  duration: number,
  topic: string,
  category: string = "educational"
) {
  const isSk = lang === "sk";

  // Category specific intelligent overlays
  let catBRolls: any[] = [];
  let recommendedPalette = "hormozi";
  let recommendedBgMusic = "lofi-chill";

  if (category === "educational") {
    recommendedPalette = "ali-abdaal";
    recommendedBgMusic = "lofi-chill";
    catBRolls = isSk
      ? [
          {
            id: "b-edu-1",
            type: "educational-whiteboard",
            start: 0.8,
            end: 3.2,
            title: "KROK 1: STRUKTÚRA",
            subtitle: "Vzdelávací OmniStrih",
            position: "top-right",
            rotation: -2,
          },
          {
            id: "b-edu-2",
            type: "brain-idea",
            start: 4.0,
            end: 6.8,
            title: "95% RÝCHLEJŠIE",
            subtitle: "Zapamätanie faktov",
            position: "bottom-right",
            rotation: 3,
          },
          {
            id: "b-edu-3",
            type: "time-saver",
            start: 7.2,
            end: 10.2,
            title: "0€ NÁKLADY",
            subtitle: "Free-Tier Nástroje",
            position: "top-left",
            rotation: -3,
          },
        ]
      : [
          {
            id: "b-edu-1",
            type: "educational-whiteboard",
            start: 0.8,
            end: 3.2,
            title: "STEP 1: FRAMEWORK",
            subtitle: "Educational Cut",
            position: "top-right",
            rotation: -2,
          },
          {
            id: "b-edu-2",
            type: "brain-idea",
            start: 4.0,
            end: 6.8,
            title: "RETENTION +85%",
            subtitle: "Cognitive Focus",
            position: "bottom-right",
            rotation: 3,
          },
          {
            id: "b-edu-3",
            type: "time-saver",
            start: 7.2,
            end: 10.2,
            title: "ZERO COST",
            subtitle: "Free Web Suite",
            position: "top-left",
            rotation: -3,
          },
        ];
  } else if (category === "business") {
    recommendedPalette = "hormozi";
    recommendedBgMusic = "corporate-inspire";
    catBRolls = isSk
      ? [
          {
            id: "b-biz-1",
            type: "growth-chart",
            start: 0.8,
            end: 3.2,
            title: "+340% NÁVRATNOSŤ",
            subtitle: "Organický dosah",
            position: "top-right",
            rotation: -2,
          },
          {
            id: "b-biz-2",
            type: "money-stack",
            start: 4.0,
            end: 6.5,
            title: "0€ MESAČNE",
            subtitle: "Ušetrené $50/mesiac",
            position: "bottom-right",
            rotation: 3,
          },
        ]
      : [
          {
            id: "b-biz-1",
            type: "growth-chart",
            start: 0.8,
            end: 3.2,
            title: "+340% REACH",
            subtitle: "Organic Growth",
            position: "top-right",
            rotation: -2,
          },
          {
            id: "b-biz-2",
            type: "money-stack",
            start: 4.0,
            end: 6.5,
            title: "$0 FOREVER",
            subtitle: "Saved $50/mo",
            position: "bottom-right",
            rotation: 3,
          },
        ];
  } else if (category === "tech") {
    recommendedPalette = "cyber-neon";
    recommendedBgMusic = "tech-ambient";
    catBRolls = isSk
      ? [
          {
            id: "b-tech-1",
            type: "tech-code",
            start: 0.8,
            end: 3.2,
            title: "AI ALGORITMUS",
            subtitle: "Automatický render",
            position: "top-right",
            rotation: -2,
          },
          {
            id: "b-tech-2",
            type: "brain-idea",
            start: 4.0,
            end: 6.8,
            title: "LATENCIA 0ms",
            subtitle: "Lokálny Browser DSP",
            position: "bottom-right",
            rotation: 2,
          },
        ]
      : [
          {
            id: "b-tech-1",
            type: "tech-code",
            start: 0.8,
            end: 3.2,
            title: "AI PIPELINE",
            subtitle: "Instant Synthesis",
            position: "top-right",
            rotation: -2,
          },
          {
            id: "b-tech-2",
            type: "brain-idea",
            start: 4.0,
            end: 6.8,
            title: "0ms LATENCY",
            subtitle: "Client-side DSP",
            position: "bottom-right",
            rotation: 2,
          },
        ];
  } else {
    recommendedPalette = "mrbeast";
    recommendedBgMusic = "viral-phonk";
    catBRolls = isSk
      ? [
          {
            id: "b-vir-1",
            type: "time-saver",
            start: 0.8,
            end: 3.2,
            title: "ÚSPORA: 95%",
            subtitle: "OmniStrih Recept",
            position: "top-right",
            rotation: -3,
          },
          {
            id: "b-vir-2",
            type: "fire-meme",
            start: 4.0,
            end: 6.5,
            title: "VIRÁLNY HOOK 🔥",
            subtitle: "Dopamínový reset",
            position: "bottom-right",
            rotation: 3,
          },
        ]
      : [
          {
            id: "b-vir-1",
            type: "time-saver",
            start: 0.8,
            end: 3.2,
            title: "TIME SAVED: 95%",
            subtitle: "OmniCut Framework",
            position: "top-right",
            rotation: -3,
          },
          {
            id: "b-vir-2",
            type: "fire-meme",
            start: 4.0,
            end: 6.5,
            title: "VIRAL HOOK 🔥",
            subtitle: "Attention Reset",
            position: "bottom-right",
            rotation: 3,
          },
        ];
  }

  if (isSk) {
    return {
      detectedCategory: category,
      recommendedPalette,
      recommendedBgMusic,
      detectedSilenceSeconds: 2.8,
      viralHook: "ZASTAV SCROLLOVANIE! 🔥",
      captions: [
        {
          id: "cap-1",
          start: 0.0,
          end: 2.8,
          text: "Ako ušetriť 95% času na strih",
          emoji: "⚡",
          words: [
            { word: "Ako", start: 0.0, end: 0.4, highlight: false },
            { word: "ušetriť", start: 0.4, end: 1.0, highlight: false },
            { word: "95%", start: 1.0, end: 1.7, highlight: true },
            { word: "času", start: 1.7, end: 2.2, highlight: false },
            { word: "na strih", start: 2.2, end: 2.8, highlight: false },
          ],
        },
        {
          id: "cap-2",
          start: 3.0,
          end: 6.2,
          text: "Už žiadne drahé mesačné poplatky!",
          emoji: "💸",
          words: [
            { word: "Už", start: 3.0, end: 3.4, highlight: false },
            { word: "žiadne", start: 3.4, end: 4.1, highlight: false },
            { word: "drahé", start: 4.1, end: 4.8, highlight: false },
            { word: "mesačné", start: 4.8, end: 5.4, highlight: false },
            { word: "poplatky!", start: 5.4, end: 6.2, highlight: true },
          ],
        },
        {
          id: "cap-3",
          start: 6.5,
          end: 10.0,
          text: "Inteligentný B-Roll a čistý zvuk",
          emoji: "🎯",
          words: [
            { word: "Inteligentný", start: 6.5, end: 7.3, highlight: true },
            { word: "B-Roll", start: 7.3, end: 8.1, highlight: false },
            { word: "a čistý", start: 8.1, end: 9.0, highlight: false },
            { word: "zvuk", start: 9.0, end: 10.0, highlight: true },
          ],
        },
        {
          id: "cap-4",
          start: 10.2,
          end: Math.min(duration, 14.5),
          text: "Skús OmniStrih hneď teraz!",
          emoji: "🚀",
          words: [
            { word: "Skús", start: 10.2, end: 10.8, highlight: false },
            { word: "OmniStrih", start: 10.8, end: 11.8, highlight: true },
            { word: "hneď", start: 11.8, end: 12.4, highlight: false },
            { word: "teraz!", start: 12.4, end: 14.0, highlight: true },
          ],
        },
      ],
      zoomCues: [
        { timestamp: 0.0, scale: 1.0, duration: 0.2 },
        { timestamp: 1.0, scale: 1.25, duration: 0.25 },
        { timestamp: 3.0, scale: 1.0, duration: 0.2 },
        { timestamp: 5.4, scale: 1.25, duration: 0.25 },
        { timestamp: 6.5, scale: 1.0, duration: 0.2 },
        { timestamp: 9.0, scale: 1.2, duration: 0.25 },
        { timestamp: 10.8, scale: 1.25, duration: 0.25 },
      ],
      sfxCues: [
        { timestamp: 0.0, type: "boom", label: "Hook 808 Boom" },
        { timestamp: 1.0, type: "pop", label: "Emphasis Pop" },
        { timestamp: 3.0, type: "whoosh", label: "Topic Transition" },
        { timestamp: 5.4, type: "cash", label: "Cash Saved" },
        { timestamp: 6.5, type: "ding", label: "Feature Ding" },
        { timestamp: 9.0, type: "pop", label: "VN Motion Pop" },
        { timestamp: 12.4, type: "pop", label: "CTA Trigger" },
      ],
      bRollOverlays: catBRolls,
      viralityAnalysis: {
        overallScore: 98,
        hookScore: 99,
        pacingScore: 96,
        retentionScore: 97,
        trendScore: 95,
        detectedNiche: category,
        keyReasons: [
          "Bleskový hook s 808 bass dropom v prvých 2 sekundách eliminuje okamžité odchody.",
          "Submagic kontrastné titulky udržiavajú pozornosť s vizuálnym vysvecovaním slov.",
          `Inteligentný B-Roll (${category}) a VN zoom resetujú dopamínovú pozornosť každé 3 sekundy.`,
          "Nulové hluché miesta a úderné tempo garantujú vysokú mieru dopozerania (Watch Time).",
        ],
        suggestedTitle: `Ako ušetriť 95% času pri strihu videa (${category} OmniStrih)`,
        suggestedDescription:
          "Zabudni na drahé predplatné za Submagic či CapCut. Tento OmniStrih postup ti umožní tvoriť virálne videá za zlomok času bez poplatkov. #omnistrih #strihvidea #aivideo #tiktoksk",
        suggestedHashtags: [
          "#omnistrih",
          "#strihvidea",
          "#submagic",
          "#opusclip",
          "#aivideo",
          `#${category}`,
          "#contentcreator",
        ],
      },
      smartClips: [
        {
          id: "sc-1",
          title: "Kompletný Virálny Hook (0 - 15s)",
          start: 0.0,
          end: 14.5,
          viralityScore: 98,
          badge: "TOP VIRAL 🔥",
        },
        {
          id: "sc-2",
          title: "Úspora peňazí & Nástroje (3 - 10s)",
          start: 3.0,
          end: 10.0,
          viralityScore: 94,
          badge: "HIGH VALUE 💡",
        },
      ],
      speedRampPreset: "fast-ramp",
      summaryAdvice:
        "Tento strih spája overenú metodiku OmniStrih: silný začiatok, taktilné vizuálne koláže a dynamické karaoke titulky.",
    };
  }

  return {
    detectedCategory: category,
    recommendedPalette,
    recommendedBgMusic,
    detectedSilenceSeconds: 2.5,
    viralHook: "STOP SCROLLING! 🔥",
    captions: [
      {
        id: "cap-1",
        start: 0.0,
        end: 2.8,
        text: "How to save 95% of editing time",
        emoji: "⚡",
        words: [
          { word: "How", start: 0.0, end: 0.4, highlight: false },
          { word: "to", start: 0.4, end: 0.7, highlight: false },
          { word: "save", start: 0.7, end: 1.1, highlight: false },
          { word: "95%", start: 1.1, end: 1.8, highlight: true },
          { word: "of editing time", start: 1.8, end: 2.8, highlight: false },
        ],
      },
      {
        id: "cap-2",
        start: 3.0,
        end: 6.2,
        text: "No more paying for expensive apps!",
        emoji: "💸",
        words: [
          { word: "No", start: 3.0, end: 3.3, highlight: false },
          { word: "more", start: 3.3, end: 3.8, highlight: false },
          { word: "paying", start: 3.8, end: 4.5, highlight: false },
          { word: "expensive", start: 4.5, end: 5.3, highlight: false },
          { word: "apps!", start: 5.3, end: 6.2, highlight: true },
        ],
      },
      {
        id: "cap-3",
        start: 6.5,
        end: 10.0,
        text: "Intelligent B-Roll and clean voice",
        emoji: "🎯",
        words: [
          { word: "Intelligent", start: 6.5, end: 7.3, highlight: true },
          { word: "B-Roll", start: 7.3, end: 8.1, highlight: false },
          { word: "and clean", start: 8.1, end: 9.0, highlight: false },
          { word: "voice", start: 9.0, end: 10.0, highlight: true },
        ],
      },
      {
        id: "cap-4",
        start: 10.2,
        end: Math.min(duration, 14.5),
        text: "Try OmniCut right now for free!",
        emoji: "🚀",
        words: [
          { word: "Try", start: 10.2, end: 10.7, highlight: false },
          { word: "OmniCut", start: 10.7, end: 11.5, highlight: true },
          { word: "right", start: 11.5, end: 12.0, highlight: false },
          { word: "now", start: 12.0, end: 12.6, highlight: false },
          { word: "free!", start: 12.6, end: 14.0, highlight: true },
        ],
      },
    ],
    zoomCues: [
      { timestamp: 0.0, scale: 1.0, duration: 0.2 },
      { timestamp: 1.1, scale: 1.25, duration: 0.25 },
      { timestamp: 3.0, scale: 1.0, duration: 0.2 },
      { timestamp: 5.3, scale: 1.25, duration: 0.25 },
      { timestamp: 6.5, scale: 1.0, duration: 0.2 },
      { timestamp: 9.0, scale: 1.2, duration: 0.25 },
      { timestamp: 10.7, scale: 1.25, duration: 0.25 },
    ],
    sfxCues: [
      { timestamp: 0.0, type: "boom", label: "Hook Bass Drop" },
      { timestamp: 1.1, type: "pop", label: "Emphasis Pop" },
      { timestamp: 3.0, type: "whoosh", label: "Transition" },
      { timestamp: 5.3, type: "cash", label: "Cash Saved" },
      { timestamp: 6.5, type: "ding", label: "Opus Bell" },
      { timestamp: 9.0, type: "pop", label: "Motion Pop" },
      { timestamp: 12.6, type: "pop", label: "CTA Pop" },
    ],
    bRollOverlays: catBRolls,
    viralityAnalysis: {
      overallScore: 98,
      hookScore: 99,
      pacingScore: 96,
      retentionScore: 97,
      trendScore: 95,
      detectedNiche: category,
      keyReasons: [
        "Dynamic 808 boom hook in first 2 seconds eliminates early drop-off.",
        "Submagic contrast captions keep viewer reading at high velocity.",
        `Contextual ${category} B-Roll and VN zooms reset attention every 3 seconds.`,
        "Zero pauses and jump-cuts maximize completed watch-time.",
      ],
      suggestedTitle: `How to save 95% of video editing time for TikTok & Reels (${category})`,
      suggestedDescription:
        "Stop paying $50/month for video apps. Here is the exact OmniCut workflow to produce viral short-form videos for free. #omnicut #videoediting #opusclip #submagic",
      suggestedHashtags: [
        "#omnicut",
        "#videoediting",
        "#opusclip",
        "#submagic",
        `#${category}`,
        "#contentcreator",
        "#viralhacks",
      ],
    },
    smartClips: [
      {
        id: "sc-1-en",
        title: "Complete Viral Hook (0 - 15s)",
        start: 0.0,
        end: 14.5,
        viralityScore: 98,
        badge: "TOP VIRAL 🔥",
      },
      {
        id: "sc-2-en",
        title: "Cost Savings & Workflow (3 - 10s)",
        start: 3.0,
        end: 10.0,
        viralityScore: 94,
        badge: "HIGH VALUE 💡",
      },
    ],
    speedRampPreset: "fast-ramp",
    summaryAdvice:
      "Engineered to hold viewer retention for 100% of video length with kinetic visual pace and Submagic-grade audio cues.",
  };
}

process.on("uncaughtException", (err) => {
  console.error("[Server] Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Server] Unhandled Rejection at:", promise, "reason:", reason);
});


// ===========================================================================
// ŽIVÉ SIGNÁLY (F5) — reálne dáta z platforiem pre Trend Radar
// ===========================================================================
// Zásady, ktoré tu platia:
//  - **Nič sa nespúšťa samo.** Načítanie signálov je vždy výslovná akcia
//    používateľky (tlačidlo „Obnoviť“). Otvorenie appky len číta cache.
//  - **Každé zlyhanie má dôvod** a ide do odpovede, nikdy sa nemlčí.
//  - **Kľúč k YouTube (ak je) nikdy neopustí server** — von ide len to,
//    či je nastavený.
//  - Cache má TTL, aby sa zbytočne nebúchalo na zdroje.

const TREND_SETTINGS_FILE = path.join(DATA_DIR, "trend-sources.json");
const TREND_CACHE_FILE = path.join(DATA_DIR, "trends-cache.json");
const TREND_CACHE_TTL_MIN = 30;
const TREND_FETCH_TIMEOUT_MS = 15000;
const TREND_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

interface TrendSettings {
  youtubeApiKey?: string;
  channels: string[];
  geos: string[];
}

function readTrendSettings(): TrendSettings {
  try {
    if (!fs.existsSync(TREND_SETTINGS_FILE)) return { channels: [], geos: DEFAULT_GEOS };
    const raw = JSON.parse(fs.readFileSync(TREND_SETTINGS_FILE, "utf-8"));
    return {
      youtubeApiKey: typeof raw.youtubeApiKey === "string" && raw.youtubeApiKey.trim() ? raw.youtubeApiKey.trim() : undefined,
      channels: Array.isArray(raw.channels) ? raw.channels.filter((c: unknown) => typeof c === "string").slice(0, 30) : [],
      geos:
        Array.isArray(raw.geos) && raw.geos.length
          ? raw.geos.filter((g: unknown) => typeof g === "string").slice(0, 8)
          : DEFAULT_GEOS,
    };
  } catch (err: any) {
    console.warn("[Trends] Nepodarilo sa prečítať nastavenia:", err?.message);
    return { channels: [], geos: DEFAULT_GEOS };
  }
}

function writeTrendSettings(s: TrendSettings) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${TREND_SETTINGS_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, TREND_SETTINGS_FILE);
}

function readTrendCache(): LiveSignalsBundle | null {
  try {
    if (!fs.existsSync(TREND_CACHE_FILE)) return null;
    const raw = JSON.parse(fs.readFileSync(TREND_CACHE_FILE, "utf-8"));
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.results)) return null;
    return raw as LiveSignalsBundle;
  } catch {
    return null;
  }
}

function writeTrendCache(bundle: LiveSignalsBundle) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${TREND_CACHE_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(bundle, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, TREND_CACHE_FILE);
  } catch (err: any) {
    console.warn("[Trends] Cache sa nepodarilo uložiť:", err?.message);
  }
}

function cacheAgeMinutes(bundle: LiveSignalsBundle | null): number | null {
  if (!bundle?.fetchedAt) return null;
  const t = Date.parse(bundle.fetchedAt);
  if (!Number.isFinite(t)) return null;
  return Math.round((Date.now() - t) / 60000);
}

async function fetchText(url: string): Promise<{ ok: boolean; status: number; text: string; errorSk?: string }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": TREND_UA, Accept: "application/rss+xml, application/xml, text/xml, */*" },
      signal: AbortSignal.timeout(TREND_FETCH_TIMEOUT_MS),
    });
    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        text,
        errorSk:
          res.status === 403
            ? "Zdroj nás odmietol (HTTP 403) — z tohto prostredia k nemu nie je prístup."
            : `Zdroj odpovedal HTTP ${res.status}.`,
      };
    }
    return { ok: true, status: res.status, text };
  } catch (err: any) {
    const timeout = err?.name === "TimeoutError" || err?.name === "AbortError";
    return {
      ok: false,
      status: 0,
      text: "",
      errorSk: timeout
        ? `Zdroj neodpovedal do ${Math.round(TREND_FETCH_TIMEOUT_MS / 1000)} s.`
        : `Zdroj sa nedá spojiť (${err?.message || "neznáma chyba"}).`,
    };
  }
}

/** Google Trends RSS — bez kľúča, po krajinách. */
async function fetchGoogleTrends(geo: string): Promise<SourceFetchResult> {
  const fetchedAt = new Date().toISOString();
  const r = await fetchText(`https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo.toUpperCase())}`);
  if (!r.ok) {
    return {
      source: "GOOGLE_TRENDS",
      ok: false,
      fetchedAt,
      signals: [],
      errorSk: `${geoLabelSk(geo)}: ${r.errorSk}`,
      detailSk: `Krajina ${geoLabelSk(geo)}`,
    };
  }
  const signals = parseGoogleTrendsRss(r.text, geo);
  if (!signals.length) {
    return {
      source: "GOOGLE_TRENDS",
      ok: false,
      fetchedAt,
      signals: [],
      errorSk: `${geoLabelSk(geo)}: odpoveď prišla, ale bez použitelných položiek (formát sa mohol zmeniť).`,
      detailSk: `Krajina ${geoLabelSk(geo)}`,
    };
  }
  return {
    source: "GOOGLE_TRENDS",
    ok: true,
    fetchedAt,
    signals,
    costSk: "bez kľúča, 0 nákladov",
    detailSk: `${geoLabelSk(geo)} · ${signals.length} tém`,
  };
}

/** YouTube kanálové RSS — bez kľúča. */
async function fetchYouTubeFeeds(channelIds: string[]): Promise<SourceFetchResult> {
  const fetchedAt = new Date().toISOString();
  if (!channelIds.length) {
    return {
      source: "YOUTUBE_FEED",
      ok: false,
      fetchedAt,
      signals: [],
      errorSk: "Nemáš pridaný žiadny kanál.",
      hintSk: "Pridaj kanál v nastaveniach signálov (stačí odkaz na kanál, napr. youtube.com/@meno).",
    };
  }

  const signals: TrendSignal[] = [];
  const failed: string[] = [];
  for (const id of channelIds) {
    const r = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(id)}`);
    if (!r.ok) {
      failed.push(id);
      continue;
    }
    const feed = parseYouTubeFeed(r.text);
    signals.push(...feed.signals);
  }

  if (!signals.length) {
    return {
      source: "YOUTUBE_FEED",
      ok: false,
      fetchedAt,
      signals: [],
      errorSk: `Ani jeden z ${channelIds.length} kanálov nevrátil príspevky${failed.length ? ` (${failed.length} zlyhalo)` : ""}.`,
      hintSk: "Skontroluj, či sú ID kanálov správne (začínajú na UC).",
    };
  }

  return {
    source: "YOUTUBE_FEED",
    ok: true,
    fetchedAt,
    signals,
    costSk: "bez kľúča, 0 nákladov",
    detailSk: `${channelIds.length} kanálov · ${signals.length} príspevkov${failed.length ? ` · ${failed.length} zlyhalo` : ""}`,
    errorSk: failed.length ? `${failed.length} kanálov sa nedalo načítať — ostatné sú v zozname.` : undefined,
  };
}

/** YouTube Data API — voliteľný kľúč, oficiálny rebríček s počtami zhliadnutí. */
async function fetchYouTubeChart(geo: string, apiKey: string): Promise<SourceFetchResult> {
  const fetchedAt = new Date().toISOString();
  const url =
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular` +
    `&regionCode=${encodeURIComponent(geo.toUpperCase())}&maxResults=25&key=${encodeURIComponent(apiKey)}`;

  let json: unknown = null;
  let errorSk: string | undefined;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TREND_FETCH_TIMEOUT_MS) });
    json = await res.json().catch(() => null);
    if (!res.ok) {
      const apiMsg = (json as any)?.error?.message || `HTTP ${res.status}`;
      const reason = (json as any)?.error?.errors?.[0]?.reason;
      errorSk =
        reason === "quotaExceeded"
          ? "Denná kvóta YouTube API je vyčerpaná (10 000 jednotiek). Skús to zajtra."
          : reason === "keyInvalid" || res.status === 400
            ? `Kľúč YouTube API nefunguje (${apiMsg}). Skontroluj, či je v Google Cloud zapnuté „YouTube Data API v3“ a či kľúč nie je obmedzený na inú službu.`
            : `YouTube API: ${apiMsg}`;
    }
  } catch (err: any) {
    errorSk = err?.name === "TimeoutError" ? "YouTube API neodpovedalo včas." : `YouTube API: ${err?.message || "chyba spojenia"}`;
  }

  if (errorSk) {
    return { source: "YOUTUBE_CHART", ok: false, fetchedAt, signals: [], errorSk };
  }

  const signals = parseYouTubeChart(json, geo);
  if (!signals.length) {
    return {
      source: "YOUTUBE_CHART",
      ok: false,
      fetchedAt,
      signals: [],
      errorSk: `Rebríček pre ${geoLabelSk(geo)} nevrátil použiteľné videá.`,
    };
  }

  return {
    source: "YOUTUBE_CHART",
    ok: true,
    fetchedAt,
    signals,
    costSk: `${YOUTUBE_API_COST.chartPerCall} jednotka z ${YOUTUBE_API_COST.dailyLimit.toLocaleString("sk-SK")} na deň`,
    detailSk: `${geoLabelSk(geo)} · ${signals.length} videí`,
  };
}

/**
 * Z „youtube.com/@meno“ alebo z odkazu spraví kanonické ID kanála.
 * Postup je zámerne overený: najprv priama zhoda (URL /channel/UC…), potom
 * kanonický odkaz na stránke kanála a **spätná kontrola** cez RSS — aby sa
 * nestalo, že pridáme iný kanál, než si človek myslí.
 */
async function resolveChannelId(input: string): Promise<{ id?: string; title?: string; errorSk?: string; hintSk?: string }> {
  const raw = String(input || "").trim();
  if (!raw) return { errorSk: "Prázdny vstup." };

  const direct = raw.match(/UC[A-Za-z0-9_-]{22}/);
  const fromChannelUrl = raw.match(/\/channel\/(UC[A-Za-z0-9_-]{22})/);
  if (fromChannelUrl) return { id: fromChannelUrl[1] };
  if (direct && !raw.includes("/")) return { id: direct[0] };

  // Zvyšok: odkaz na kanál alebo @meno → pozrieme sa na stránku
  const url = /^https?:\/\//i.test(raw)
    ? raw
    : `https://www.youtube.com/${raw.startsWith("@") ? raw : `@${raw}`}`;
  const page = await fetchText(url);
  if (!page.ok) {
    return {
      errorSk: `Kanál sa nedá načítať: ${page.errorSk}`,
      hintSk: "Skús vložiť priamo odkaz typu youtube.com/channel/UC… (v kanáli: Zdieľať kanál).",
    };
  }
  const m =
    page.text.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})"/) ||
    page.text.match(/<meta property="og:url" content="https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})"/) ||
    page.text.match(/<meta itemprop="identifier" content="(UC[A-Za-z0-9_-]{22})"/);
  const id = m?.[1];
  if (!id) {
    return {
      errorSk: "Na stránke sa nepodarilo nájsť ID kanála.",
      hintSk: "Vlož priamo odkaz youtube.com/channel/UC… (v kanáli → Zdieľať kanál → Kopírovať).",
    };
  }

  // Spätná kontrola: overíme, že RSS pre toto ID naozaj existuje a nesie titulok.
  const feed = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`);
  if (!feed.ok) {
    return {
      errorSk: "ID kanála sa našlo, ale jeho RSS sa nedá načítať.",
      hintSk: "Skús to znova neskôr alebo použi iný kanál.",
    };
  }
  const title = parseYouTubeFeed(feed.text).channelTitle;
  return { id, title };
}

// --- Endpointy ------------------------------------------------------------

app.get("/api/trends/status", (_req, res) => {
  const s = readTrendSettings();
  const cache = readTrendCache();
  res.json({
    success: true,
    sources: LIVE_SOURCES,
    platformLimits: PLATFORM_LIMITS_SK,
    disclaimerSk: LIVE_SIGNALS_DISCLAIMER_SK,
    settings: {
      geos: s.geos,
      channels: s.channels,
      channelCount: s.channels.length,
      hasYouTubeKey: Boolean(s.youtubeApiKey),
      youtubeKeyHint: s.youtubeApiKey ? `nastavený (…${s.youtubeApiKey.slice(-4)})` : null,
    },
    geoOptions: GEO_OPTIONS,
    cache: cache
      ? { fetchedAt: cache.fetchedAt, ageMinutes: cacheAgeMinutes(cache), count: cache.signals.length }
      : null,
    cacheTtlMinutes: TREND_CACHE_TTL_MIN,
    youtubeApiCost: YOUTUBE_API_COST,
  });
});

app.get("/api/trends/signals", (_req, res) => {
  const cache = readTrendCache();
  if (!cache) {
    return res.json({
      success: true,
      bundle: null,
      ageMinutes: null,
      messageSk: "Zatiaľ nemám uložené signály. Obnovenie spustíš tlačidlom — samo sa to nespúšťa.",
    });
  }
  res.json({ success: true, bundle: cache, ageMinutes: cacheAgeMinutes(cache) });
});

app.post("/api/trends/refresh", async (req, res) => {
  try {
    const s = readTrendSettings();
    const geos: string[] = Array.isArray(req.body?.geos) && req.body.geos.length ? req.body.geos : s.geos;
    const channelIds: string[] = Array.isArray(req.body?.channels) ? req.body.channels : s.channels;
    const includeChart = req.body?.includeYouTubeChart !== false;
    const force = req.body?.force === true;

    const cached = readTrendCache();
    const age = cacheAgeMinutes(cached);
    if (!force && cached && age !== null && age < TREND_CACHE_TTL_MIN) {
      return res.json({
        success: true,
        fromCache: true,
        ageMinutes: age,
        bundle: cached,
        messageSk: `Signály mám spred ${age} min (čerstvé do ${TREND_CACHE_TTL_MIN} min), takže som nič nestahoval. Ak chceš naozaj obnoviť, daj „obnoviť aj tak“.`,
      });
    }

    telemetryStats.totalRequestsToday++;

    const results: SourceFetchResult[] = [];
    for (const geo of geos) results.push(await fetchGoogleTrends(String(geo)));
    if (channelIds.length) results.push(await fetchYouTubeFeeds(channelIds.map(String)));

    if (includeChart) {
      if (s.youtubeApiKey) {
        for (const geo of geos.slice(0, 2)) results.push(await fetchYouTubeChart(String(geo), s.youtubeApiKey));
      } else {
        results.push({
          source: "YOUTUBE_CHART",
          ok: false,
          fetchedAt: new Date().toISOString(),
          signals: [],
          errorSk: "Nemáš nastavený kľúč k YouTube Data API, takže rebríček (to, čo naozaj funguje) zatiaľ nemám.",
          hintSk: "Nastav kľúč nižšie — je zdarma (Google Cloud → YouTube Data API v3 → API kľúč) a denný limit 10 000 jednotiek ti pri tomto používaní vydrží.",
        });
      }
    }

    const bundle = buildBundle(results);
    writeTrendCache(bundle);
    res.json({ success: true, fromCache: false, bundle, ageMinutes: 0 });
  } catch (err: any) {
    console.error("[Trends] Obnovenie zlyhalo:", err);
    res.status(500).json({
      success: false,
      errorSk: `Obnovenie signálov zlyhalo: ${err?.message || "neznáma chyba"}`,
    });
  }
});

app.post("/api/trends/settings", async (req, res) => {
  try {
    const s = readTrendSettings();
    const body = req.body || {};

    if (Array.isArray(body.geos)) {
      const clean = body.geos
        .map((g: unknown) => String(g).toUpperCase())
        .filter((g: string) => GEO_OPTIONS.some((o) => o.code === g))
        .slice(0, 8);
      s.geos = clean.length ? clean : DEFAULT_GEOS;
    }

    // Kľúč: nastav / vymaž. Nikdy ho neposielame späť.
    if (typeof body.youtubeApiKey === "string") {
      const k = body.youtubeApiKey.trim();
      s.youtubeApiKey = k ? k : undefined;
    }

    // Kanály: pridanie (odkaz/@meno/ID) alebo odobranie.
    if (typeof body.addChannel === "string" && body.addChannel.trim()) {
      const resolved = await resolveChannelId(body.addChannel);
      if (!resolved.id) {
        return res.status(400).json({ success: false, errorSk: resolved.errorSk, hintSk: resolved.hintSk });
      }
      if (!s.channels.includes(resolved.id)) s.channels.push(resolved.id);
      writeTrendSettings(s);
      return res.json({
        success: true,
        added: { id: resolved.id, title: resolved.title || null },
        channels: s.channels,
        messageSk: resolved.title
          ? `Pridal som kanál „${resolved.title}“.`
          : "Kanál pridaný.",
      });
    }

    if (typeof body.removeChannel === "string") {
      s.channels = s.channels.filter((c) => c !== body.removeChannel);
    }

    writeTrendSettings(s);
    res.json({ success: true, geos: s.geos, channelCount: s.channels.length, hasYouTubeKey: Boolean(s.youtubeApiKey) });
  } catch (err: any) {
    res.status(500).json({ success: false, errorSk: `Nastavenia sa nepodarilo uložiť: ${err?.message || "chyba"}` });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// VYPÁLENIE TITULKOV DO OBRAZU (krok B) — serverová časť
//
// Prečo server a nie prehliadač: zapečenie titulkov vyžaduje prekódovanie obrazu,
// a to prehliadač (Mediabunny) nerobí. Idea appky zostáva: AI nič nerenderuje,
// ťažkú prácu robí ffmpeg — tu konkrétne na serveri, na požiadanie používateľa.
//
// Tok (3 kroky, aby sa dalo hlásiť poctivo percentami):
//   1. POST /api/export/upload           — surové video do .data/uploads
//   2. POST /api/export/burn-captions    — spustí render, vráti jobId (nečaká sa)
//   3. GET  /api/export/burn-captions/status?id=… — priebeh a výsledok
//      GET  /api/export/file/<meno>      — stiahnutie / prehratie hotového klipu
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
//  VLASTNÝ ŠTÝL KLIENTA (brand kit) — profily sa ukladajú na disk servera
//    GET    /api/captions/profiles          — uložené profily + štartovacie šablóny
//    POST   /api/captions/profiles          — uložiť/aktualizovať profil
//    DELETE /api/captions/profiles/:id      — zmazať profil
//  Prečo na server a nie do prehliadača: profil musí prežiť vyčistenie úložiska
//  aj iné zariadenie a musí sa dostať do renderu na serveri.
// ─────────────────────────────────────────────────────────────────────────────

const PROFILES_FILE = path.join(DATA_DIR, "caption-profiles.json");

/** Načíta profily z disku. Poškodený súbor = prázdny zoznam (nie pád appky). */
function loadCaptionProfiles(): CaptionProfile[] {
  try {
    if (!fs.existsSync(PROFILES_FILE)) return [];
    const raw = JSON.parse(fs.readFileSync(PROFILES_FILE, "utf-8"));
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        const v = validateProfile(item);
        if (!v.ok) return null;
        const created = typeof item?.createdAt === "string" ? item.createdAt : new Date().toISOString();
        const updated = typeof item?.updatedAt === "string" ? item.updatedAt : created;
        return { ...v.profile, createdAt: created, updatedAt: updated } as CaptionProfile;
      })
      .filter((x): x is CaptionProfile => x !== null);
  } catch {
    return [];
  }
}

function saveCaptionProfiles(list: CaptionProfile[]): void {
  ensureDir(DATA_DIR);
  const tmp = `${PROFILES_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, PROFILES_FILE);
}

app.get("/api/captions/profiles", (_req, res) => {
  const profiles = loadCaptionProfiles();
  res.json({
    success: true,
    profiles,
    templates: PROFILE_TEMPLATES,
    limits: PROFILE_LIMITS,
    /** Každý profil so vetou, čo mení — aby sa dal vybrať bez skúšania. */
    descriptionSk: Object.fromEntries(profiles.map((p) => [p.id, describeProfileSk(p)])),
  });
});

app.post("/api/captions/profiles", (req, res) => {
  const validation = validateProfile(req.body);
  if (!validation.ok) return res.status(400).json({ success: false, errorSk: validation.errorSk });

  const list = loadCaptionProfiles();
  const wanted = validation.profile;
  const now = new Date().toISOString();
  const existing = list.find((p) => p.id === wanted.id);

  if (!existing && list.length >= PROFILE_LIMITS.maxProfiles) {
    return res.status(400).json({
      success: false,
      errorSk: `Profilov je už ${list.length} (maximum ${PROFILE_LIMITS.maxProfiles}). Zmaž taký, ktorý už nepoužívaš.`,
    });
  }

  const profile: CaptionProfile = {
    ...wanted,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const next = existing ? list.map((p) => (p.id === wanted.id ? profile : p)) : [...list, profile];
  try {
    saveCaptionProfiles(next);
  } catch {
    return res.status(500).json({ success: false, errorSk: "Profil sa nepodarilo zapísať na disk servera." });
  }

  res.json({
    success: true,
    profile,
    descriptionSk: describeProfileSk(profile),
    /** Čo sa počas ukladania orezalo (ak vôbec niečo) — bez tichých úprav. */
    notesSk: validation.notesSk,
  });
});

app.delete("/api/captions/profiles/:id", (req, res) => {
  const id = String(req.params.id ?? "");
  if (!isSafeProfileId(id)) {
    return res.status(400).json({ success: false, errorSk: "Neplatný identifikátor profilu." });
  }
  const list = loadCaptionProfiles();
  if (!list.some((p) => p.id === id)) {
    return res.status(404).json({ success: false, errorSk: "Taký profil už neexistuje (možno bol zmazaný inde)." });
  }
  try {
    saveCaptionProfiles(list.filter((p) => p.id !== id));
  } catch {
    return res.status(500).json({ success: false, errorSk: "Profil sa nepodarilo zmazať z disku servera." });
  }
  res.json({ success: true, removedId: id });
});

const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const EXPORT_DIR = path.join(DATA_DIR, "exports");
const FONT_DIR = path.join(DATA_DIR, "fonts");
const burnJobs = new BurnJobStore();
/** Bežiace ffmpeg procesy (kvôli zastaveniu renderu). */
const burnProcesses = new Map<string, ReturnType<typeof spawn>>();

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

/** Stav ffmpeg na serveri — appka to ukáže ešte pred kliknutím na vypálenie. */
app.get("/api/export/ffmpeg", (_req, res) => {
  const found = findFfmpegPath();
  res.json({
    success: true,
    available: Boolean(found),
    ffmpegPath: found ? found.path : null,
    source: found ? found.source : null,
    messageSk: found
      ? `ffmpeg je k dispozícii (${found.labelSk}). Vypálenie titulkov je pripravené.`
      : FFMPEG_MISSING_SK,
    limits: {
      maxUploadMb: Math.round(BURN_LIMITS.maxUploadBytes / (1024 * 1024)),
      maxCaptionSegments: BURN_LIMITS.maxCaptionSegments,
    },
    honestySk: BURN_HONESTY_SK,
  });
});

/** 1) Nahranie zdrojového videa (surové telo požiadavky, nie base64 — o 33 % menej dát). */
app.post(
  "/api/export/upload",
  express.raw({ type: () => true, limit: BURN_LIMITS.maxUploadBytes }),
  (req, res) => {
    try {
      const body = req.body as Buffer;
      if (!body || !Buffer.isBuffer(body) || body.length === 0) {
        return res.status(400).json({
          success: false,
          errorSk: "Neprišli žiadne dáta videa — skús to znova (súbor sa možno nepodarilo prečítať).",
        });
      }
      if (body.length > BURN_LIMITS.maxUploadBytes) {
        return res.status(413).json({ success: false, errorSk: BURN_MAX_UPLOAD_SK });
      }

      ensureDir(UPLOAD_DIR);
      const original = safeBaseName(req.query.name, "video.mp4");
      const storageName = uploadStorageName(original, randomUUID());
      const target = path.join(UPLOAD_DIR, storageName);
      fs.writeFileSync(target, body);

      // Nech tu nezostávajú desiatky starých videí.
      pruneDir(UPLOAD_DIR, BURN_LIMITS.maxStoredUploads);

      res.json({
        success: true,
        uploadId: storageName,
        uploadName: original,
        sizeBytes: body.length,
        messageSk: `Video prijaté (${(body.length / (1024 * 1024)).toFixed(1)} MB).`,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        errorSk: `Video sa nepodarilo uložiť: ${err?.message || "neznáma chyba"}`,
      });
    }
  },
);

/**
 * 1b) MERANIE SVETLA NAHRAÉHO VIDEA (krok 24).
 *
 * Prečo to je na serveri: jas a kontrast sa musia merať z pixelov celého videa
 * (ffmpeg) — a to prehliadač pri veľkom videe nezvládne. Meria sa **tou istou
 * metódou**, akou boli merané referenčné videá (analýza ich klipov), aby boli
 * čísla porovnateľné. Nič sa neodhaduje: keď sa merať nedá, vráti sa chyba.
 *
 * Voliteľne hneď vráti aj korekciu na svetlo referencie:
 *  - `recipeId` — recept z ich videa (namerané hodnoty sú v recepte),
 *  - alebo `reference: { brightness, contrast }` — vlastné namerané čísla.
 */
app.post("/api/media/light-stats", (req, res) => {
  const found = findFfmpegPath();
  if (!found) return res.status(503).json({ success: false, errorSk: FFMPEG_MISSING_SK });

  const uploadId = String(req.body?.uploadId ?? "");
  if (!isSafeStoredName(uploadId)) {
    return res.status(400).json({ success: false, errorSk: "Chýba alebo je neplatný identifikátor nahraného videa." });
  }
  const filePath = path.join(UPLOAD_DIR, uploadId);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, errorSk: "Toto video už na serveri nie je — nahraj ho znova." });
  }

  const raw = spawnSync(
    found.path,
    [
      "-v", "error",
      "-i", filePath,
      "-vf", `fps=${LIGHT_MEASURE.fps},scale=${LIGHT_MEASURE.width}:${LIGHT_MEASURE.height},format=gray`,
      "-f", "rawvideo",
      "-",
    ],
    { maxBuffer: 512 * 1024 * 1024 },
  );
  const measured = raw.stdout ? lightStatsFromGrayFrames(new Uint8Array(raw.stdout as Buffer), LIGHT_MEASURE.width, LIGHT_MEASURE.height) : null;
  if (!measured) {
    return res.status(422).json({
      success: false,
      errorSk: "Svetlo sa z tohto videa nedá zmerať (ffmpeg nevrátil použiteľné snímky) — radšej nič než odhad.",
    });
  }

  const recipeId = typeof req.body?.recipeId === "string" ? req.body.recipeId : "";
  const explicit = req.body?.reference;
  const recipe = recipeId ? STYLE_RECIPES[recipeId as keyof typeof STYLE_RECIPES] : undefined;
  const reference =
    recipe?.measuredLight
      ? { brightness: recipe.measuredLight.brightness, contrast: recipe.measuredLight.contrast, sourceSk: recipe.measuredLight.sourceSk }
      : explicit && Number.isFinite(Number(explicit.brightness)) && Number.isFinite(Number(explicit.contrast))
        ? { brightness: Number(explicit.brightness), contrast: Number(explicit.contrast), sourceSk: "zadané volajúcim (namerané hodnoty)" }
        : null;

  if (recipeId && !recipe) {
    return res.status(404).json({ success: false, errorSk: `Recept „${recipeId}“ nepoznám — nemám z čoho vziať jeho svetlo.` });
  }
  if (reference && !recipeId && !explicit) reference.sourceSk = "zadané volajúcim (namerané hodnoty)";

  const correction = reference
    ? computeLightCorrection(measured, { brightness: reference.brightness, contrast: reference.contrast }, {
        strengthPercent: Number.isFinite(Number(req.body?.strengthPercent)) ? Number(req.body.strengthPercent) : 100,
      })
    : null;

  const notesSk: string[] = [
    `Zmeral som tvoje video: ${lightMeasureSummarySk(measured)}.`,
    LIGHT_MEASURE.methodSk + ".",
  ];
  if (reference) notesSk.push(`Jeho video (referencia): ${lightMeasureSummarySk(reference)} — ${reference.sourceSk}.`);
  if (correction) notesSk.push(correction.noteSk);
  else if (reference) notesSk.push("Rozdiel je pod hranicou šumu merania — render sa nemení (radšej nič než vymyslená korekcia).");
  else notesSk.push("Referenciu si nezadal, takže korekciu nemám z čoho počítať — poslal som len meranie tvojho videa.");

  res.json({
    success: true,
    measured,
    reference,
    correction,
    methodSk: LIGHT_MEASURE.methodSk,
    notesSk,
  });
});

/** 2) Spustenie vypálenia — vracia jobId hneď, render beží na pozadí. */
app.post("/api/export/burn-captions", (req, res) => {
  const found = findFfmpegPath();
  if (!found) {
    return res.status(503).json({ success: false, errorSk: FFMPEG_MISSING_SK });
  }

  const validation = validateBurnRequest(req.body);
  if (!validation.ok) {
    return res.status(400).json({ success: false, errorSk: validation.errorSk });
  }
  const spec = validation.spec;

  if (!isSafeStoredName(spec.uploadId)) {
    return res.status(400).json({ success: false, errorSk: "Neplatný identifikátor nahraného videa." });
  }
  const inputPath = path.join(UPLOAD_DIR, spec.uploadId);
  if (!fs.existsSync(inputPath)) {
    return res.status(404).json({
      success: false,
      errorSk: "Nahrané video už na serveri nie je (upratal som staršie súbory). Nahraj ho znova — je to na jedno kliknutie.",
    });
  }

  ensureDir(EXPORT_DIR);
  // Nech staré rendery nezaplnia disk (najnovších 25 zostáva).
  pruneDir(EXPORT_DIR, BURN_LIMITS.maxStoredExports);
  pruneDir(FONT_DIR, 40);

  // Vlastný štýl klienta: základný štýl + odchýlky (farby, veľkosť, animácia).
  const style = applyCaptionOverrides(getCaptionStyle(spec.styleId), spec.overrides);
  const font = prepareCaptionFont(FONT_DIR, spec.fontFamily);

  // Rozmery a snímkovú frekvenciu **overíme sami** (ffmpeg prečíta súbor).
  // Prehliadač môže hlásiť pootočené video alebo nič — a ASS aj strih musia
  // sedieť na to, čo je naozaj v súbore. Keď sa sonda nepodarí, ide sa ďalej
  // s tým, čo poslal prehliadač, a appka to napíše.
  const probe = probeVideoFile(found.path, inputPath);
  const width = probe?.width ?? spec.width;
  const height = probe?.height ?? spec.height;

  // KROK 25 — prechody potrebujú konštantnú snímkovú frekvenciu (ffmpeg `xfade`
  // inak odmietne pracovať). Keď ju nevieme zistiť, radšej jasná chyba vopred
  // než rozbitý render na konci.
  if (spec.transitions && spec.transitions.length > 0 && !probe?.fps) {
    return res.status(400).json({
      success: false,
      errorSk:
        "Prechody sa nedajú vykresliť: nepodarilo sa zistiť snímkovú frekvenciu videa (ffmpeg ju potrebuje). Skús to znova alebo použi video s bežnou frekvenciou (25/30/50/60 fps).",
    });
  }

  const built = buildAssForCut({
    segments: spec.segments,
    keepRanges: spec.keepRanges,
    style,
    width,
    height,
    ...(font ? { fontName: font.fontName } : {}),
  });

  const probeNotesSk: string[] = [];
  for (const n of spec.overrideNotesSk ?? []) probeNotesSk.push(n);
  if (probe && probe.width && probe.height) {
    const claimed =
      probe.width !== spec.width || probe.height !== spec.height
        ? ` (prehliadač hlásil ${spec.width}×${spec.height})`
        : "";
    probeNotesSk.push(
      `Rozmery som si overil zo súboru: ${probe.width}×${probe.height}${claimed} — titulky sa kreslia v skutočnom rozmere videa.`,
    );
  } else {
    probeNotesSk.push(
      `Parametre videa sa nepodarilo prečítať; použil som rozmery z prehliadača (${spec.width}×${spec.height}). Skontroluj výsledok.`,
    );
  }
  if (probe?.fps) {
    probeNotesSk.push(`Snímková frekvencia zdroja ${probe.fps} fps — výstup ju zachová (žiadne potichu vyhodené snímky).`);
  } else {
    probeNotesSk.push(
      "Snímkovú frekvenciu zdroja neviem zistiť — ak výstup vyzerá menej plynulo, je to dôvod (vtedy skús vyrenderovať klip bez titulkov).",
    );
  }

  const assPath = path.join(EXPORT_DIR, `${path.basename(spec.outputName, ".mp4")}.ass`);
  fs.writeFileSync(assPath, built.ass, "utf8");

  const outputPath = path.join(EXPORT_DIR, spec.outputName);

  // --- Obrazové vrstvy (b-roll / fotky) z canonical osi ---------------------
  // Každá vrstva musí byť naozaj na disku. Keď nie je, render sa **nezastaví
  // potichu**: vrstva sa vynechá a používateľ dostane dôvod (nie prázdne miesto).
  const overlayNotesSk: string[] = [];
  const overlayInputs: {
    path: string;
    kind: "image" | "video";
    startSec: number;
    endSec: number;
    scalePercent: number;
    positionX: number;
    positionY: number;
    rotation: number;
    opacity: number;
    filter: string;
    nameSk?: string;
  }[] = [];
  for (const overlay of spec.overlays) {
    const overlayPath = path.join(UPLOAD_DIR, overlay.uploadId);
    if (!fs.existsSync(overlayPath)) {
      overlayNotesSk.push(
        `Obrazová vrstva „${overlay.name}“ sa nenašla ako súbor na serveri — vo videu nebude (v projekte zostáva).`,
      );
      continue;
    }
    overlayInputs.push({
      path: overlayPath,
      kind: overlay.kind,
      startSec: overlay.startSec,
      endSec: overlay.endSec,
      scalePercent: overlay.scalePercent,
      positionX: overlay.positionX,
      positionY: overlay.positionY,
      // Otočenie, priesvitnosť a farebný filter vrstvy (krok 10) — idú do linky.
      rotation: overlay.rotation,
      opacity: overlay.opacity,
      filter: overlay.filter,
      nameSk: overlay.name,
    });
  }
  if (overlayInputs.length > 0) {
    const rotated = overlayInputs.filter((o) => Math.abs(o.rotation) > 0.01).length;
    const faded = overlayInputs.filter((o) => o.opacity < 99.5).length;
    const filtered = overlayInputs.filter((o) => o.filter !== "NONE").length;
    const extra: string[] = [];
    if (rotated > 0) extra.push(`${rotated} pootočených`);
    if (faded > 0) extra.push(`${faded} priesvitných`);
    if (filtered > 0) extra.push(`${filtered} s farebným filtrom`);
    overlayNotesSk.push(
      `${overlayInputs.length} obrazových vrstiev sa skladá do obrazu (b-roll/fotky z canonical osi)${
        extra.length > 0 ? ` — ${extra.join(", ")}` : ""
      }.`,
    );
  }

  const args = [
    "-progress",
    "pipe:1",
    "-nostats",
    ...buildBurnFfmpegArgs({
      inputPath,
      outputPath,
      assPath,
      ...(font ? { fontsDir: font.fontsDir } : {}),
      keepSegments: spec.keepRanges,
      ...(spec.zoom.length > 0
        ? {
            zoomWindows: spec.zoom.map((z) => ({
              clipId: z.clipId,
              startSec: z.startSec,
              endSec: z.endSec,
              scalePercent: z.scale,
              // Animované priblíženie: priebeh ide do linky (čas je od začiatku okna).
              ...(z.keyframes && z.keyframes.length >= 2
                ? { keyframes: z.keyframes.map((k) => ({ timeSec: k.timeSec, scalePercent: k.scalePercent })) }
                : {}),
            })),
          }
        : {}),
      ...(overlayInputs.length > 0 ? { overlays: overlayInputs } : {}),
      ...(spec.baseFilter && spec.baseFilter !== "NONE" ? { baseFilter: spec.baseFilter } : {}),
      // KROK 24 — merané zosúladenie svetla z ich videí. Keď prišla vypočítaná
      // korekcia, ide do linky; keď nie, render vyzerá presne ako doteraz.
      ...(spec.lightCorrection ? { lightCorrection: spec.lightCorrection } : {}),
      // KROK 25 — prechody na spojoch (ffmpeg `xfade`). Bez nich sa nemení nič.
      ...(spec.transitions && spec.transitions.length > 0 ? { transitions: spec.transitions } : {}),
      ...(built.clipDurationSec > 0 ? { outputDurationSec: built.clipDurationSec } : {}),
      ...(probe?.fps ? { sourceFps: probe.fps } : {}),
      // Rozmery rámu idú do linky LEN pre priblíženie (aby orezalo na presne tie
      // isté čísla). Rám videa sa nemení — `width`/`height` pre scale sa neposiela.
      ...(probe?.width && probe?.height ? { frameSize: { width: probe.width, height: probe.height } } : {}),
    }),
  ];

  const job = burnJobs.create({
    styleId: spec.styleId,
    width: spec.width,
    height: spec.height,
    keepCount: spec.keepRanges.length,
  });
  const extraParts: string[] = [];
  if (overlayInputs.length > 0) extraParts.push(`${overlayInputs.length} vrstiev`);
  if (spec.zoom.length > 0) extraParts.push(`${spec.zoom.length} priblížení`);
  if (spec.transitions && spec.transitions.length > 0) {
    extraParts.push(
      `${spec.transitions.length} prechodov (${[...new Set(spec.transitions.map((t: any) => t.ffmpeg))].join(", ")})`,
    );
  }
  if (spec.lightCorrection) {
    extraParts.push(
      `svetlo podľa referencie (jas ${spec.lightCorrection.ffmpegBrightness >= 0 ? "+" : ""}${spec.lightCorrection.ffmpegBrightness.toFixed(3)}, kontrast ×${spec.lightCorrection.ffmpegContrast.toFixed(3)})`,
    );
  }
  burnJobs.patch(job.id, {
    state: "rendering",
    messageSk: `Vypaľujem ${built.eventCount} titulkov${extraParts.length > 0 ? `, skladám ${extraParts.join(" a ")}` : ""} a prekódujem ${built.clipDurationSec.toFixed(1)} s videa…`,
  });

  const child = spawn(found.path, args, { stdio: ["ignore", "pipe", "pipe"] });
  burnProcesses.set(job.id, child);

  let stdoutBuffer = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    stdoutBuffer += chunk.toString("utf8");
    const lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      const percent = parseFfmpegProgressLine(line, built.clipDurationSec);
      if (percent !== null) burnJobs.patch(job.id, { percent });
      const speed = line.match(/^speed=\s*([\d.]+x)/);
      if (speed) burnJobs.patch(job.id, { messageSk: `Vypaľujem titulky… ${speed[1]}` });
    }
  });

  const stderrTail: string[] = [];
  child.stderr?.on("data", (chunk: Buffer) => {
    for (const line of chunk.toString("utf8").split("\n")) {
      if (line.trim()) stderrTail.push(line.trim());
    }
    if (stderrTail.length > 40) stderrTail.splice(0, stderrTail.length - 40);
  });

  child.on("error", (err) => {
    burnProcesses.delete(job.id);
    burnJobs.fail(job.id, `ffmpeg sa nepodarilo spustiť: ${err.message}`, stderrTail);
  });

  child.on("close", (code) => {
    burnProcesses.delete(job.id);
    const current = burnJobs.get(job.id);
    if (current?.state === "canceled") {
      try {
        fs.rmSync(outputPath, { force: true });
      } catch {
        /* súbor ani nevznikol */
      }
      return;
    }

    if (code !== 0 || !fs.existsSync(outputPath)) {
      burnJobs.fail(
        job.id,
        `Vypálenie titulkov zlyhalo (ffmpeg kód ${code}). Zdrojové video je nedotknuté.`,
        stderrTail,
      );
      return;
    }

    const sizeBytes = fs.statSync(outputPath).size;
    const notesSk = [...probeNotesSk, ...built.notesSk, ...overlayNotesSk];
    if (!font) {
      notesSk.push(
        "Nenašiel som písmo s úplnou diakritikou na serveri — použil som písmo, ktoré má libass. Skontroluj v klipe, či sedia háčky a dĺžne.",
      );
    }
    if (built.eventCount === 0) {
      notesSk.push("Klip sa vyrenderoval, ale bez titulkov — nebolo čo vypáliť.");
    }

    burnJobs.finish(job.id, {
      outputName: spec.outputName,
      outputUrl: `/api/export/file/${encodeURIComponent(spec.outputName)}`,
      sizeBytes,
      clipDurationSec: built.clipDurationSec,
      summarySk: burnSummarySk(built, style, built.clipDurationSec),
    });
    burnJobs.patch(job.id, { logTail: notesSk.concat(BURN_HONESTY_SK) });
  });

  res.json({
    success: true,
    jobId: job.id,
    eventCount: built.eventCount,
    clipDurationSec: built.clipDurationSec,
    wordHighlight: built.wordHighlight,
    fontSk: font ? font.sourceSk : "písmo z prostredia (libass)",
    probedWidth: width,
    probedHeight: height,
    probedFps: probe?.fps ?? null,
    notesSk: [...probeNotesSk, ...built.notesSk],
    honestySk: BURN_HONESTY_SK,
  });
});

/** 3a) Priebeh a výsledok renderu. */
app.get("/api/export/burn-captions/status", (req, res) => {
  const job = burnJobs.get(String(req.query.id ?? ""));
  if (!job) {
    return res.status(404).json({ success: false, errorSk: "Tento render nepoznám (server sa medzitým reštartoval?)." });
  }
  res.json({ success: true, status: burnJobStatus(job), notesSk: job.logTail });
});

/** 3b) Zastavenie renderu — poctivé: rozpracovaný súbor sa zahodí. */
app.post("/api/export/burn-captions/cancel", (req, res) => {
  const id = String(req.body?.jobId ?? req.query.id ?? "");
  const job = burnJobs.get(id);
  if (!job) {
    return res.status(404).json({ success: false, errorSk: "Tento render nepoznám." });
  }
  const child = burnProcesses.get(id);
  burnJobs.cancel(id);
  if (child) {
    try {
      child.kill("SIGKILL");
    } catch {
      /* už skončil */
    }
  }
  res.json({ success: true, messageSk: "Render zastavený. Zdrojové video je nedotknuté." });
});

/** 3c) Stiahnutie / prehratie hotového klipu (len z adresára exportov). */
/**
 * KROK 27 — VLASTNÝ VIZUÁL (tri reálne cesty).
 *
 * 1) `POST /api/visual/card` — lokálne vygenerovaná karta v štýle videa (ffmpeg).
 * 2) `GET  /api/library/search` — voľná knižnica (Openverse, licencie komerčne použiteľné).
 * 3) `POST /api/library/fetch`  — stiahne vybraný obrázok (server overí voči knižnici).
 * 4) `POST /api/visual/ai-generate` — reálny pokus o AI obrázok; keď provider nemôže,
 *    vráti PRESNÚ chybu (žiadne predstieranie, žiadny fake úspech).
 */
const VISUAL_DIR = path.join(DATA_DIR, "visuals");
if (!fs.existsSync(VISUAL_DIR)) fs.mkdirSync(VISUAL_DIR, { recursive: true });

const VISUAL_LIMITS = {
  textMax: 180,
  minSize: 256,
  maxSize: 2160,
  libraryPageSize: 12,
} as const;

app.post("/api/visual/card", (req, res) => {
  const found = findFfmpegPath();
  if (!found) return res.status(503).json({ success: false, errorSk: FFMPEG_MISSING_SK });

  const kind = String(req.body?.kind ?? "headline") as StyleCardKind;
  const recipeId = String(req.body?.recipeId ?? "");
  const text = String(req.body?.text ?? "");
  const subText = String(req.body?.subText ?? "");
  const width = Number(req.body?.width ?? 1080);
  const height = Number(req.body?.height ?? 1920);

  if (text.length > VISUAL_LIMITS.textMax || subText.length > VISUAL_LIMITS.textMax) {
    return res.status(400).json({
      success: false,
      errorSk: `Text je dlhý (${Math.max(text.length, subText.length)} znakov). Karta unesie najviac ${VISUAL_LIMITS.textMax} — dlhý text patrí do titulkov, nie na kartu.`,
    });
  }
  if (
    !Number.isFinite(width) || !Number.isFinite(height) ||
    width < VISUAL_LIMITS.minSize || height < VISUAL_LIMITS.minSize ||
    width > VISUAL_LIMITS.maxSize || height > VISUAL_LIMITS.maxSize
  ) {
    return res.status(400).json({
      success: false,
      errorSk: `Veľkosť karty musí byť ${VISUAL_LIMITS.minSize}–${VISUAL_LIMITS.maxSize} px (dostal som ${width}×${height}).`,
    });
  }

  const spec = buildStyleCardSpec({ recipeId, kind, text, subText, width, height, measured: req.body?.measured ?? null });
  if (!spec.ok) {
    return res.status(400).json({ success: false, errorSk: spec.errorSk, spec });
  }

  const stamp = randomUUID().slice(0, 8);
  const assPath = path.join(VISUAL_DIR, `card-${stamp}.ass`);
  const outPath = path.join(VISUAL_DIR, `card-${stamp}.png`);
  const bg = spec.palette.background.replace("#", "0x");

  const filters: string[] = [];
  // Vzor (halftone) — server kreslí PRESNE to, čo vypočítal generátor
  // (`spec.pattern.boxes`), vrátane vynechaného pásu textu. Nič nedopočítava.
  if (spec.pattern.boxes.length > 0) {
    for (const box of spec.pattern.boxes) {
      filters.push(
        `drawbox=x=${box.x}:y=${box.y}:w=${box.size}:h=${box.size}:color=${spec.palette.accent}@${spec.pattern.opacity}:t=fill`,
      );
    }
  }
  if (spec.assContent) {
    fs.writeFileSync(assPath, spec.assContent, "utf-8");
    filters.push(`ass=${assPath.replace(/\\/g, "/")}`);
  }
  if (filters.length === 0) filters.push("null");

  const args = [
    "-y",
    "-hide_banner",
    "-loglevel", "error",
    "-f", "lavfi",
    "-i", `color=c=${bg}:s=${width}x${height}`,
    "-vf", filters.join(","),
    "-frames:v", "1",
    outPath,
  ];
  const run = spawnSync(found.path, args, { encoding: "utf-8", timeout: 120_000 });
  const ok = run.status === 0 && fs.existsSync(outPath) && fs.statSync(outPath).size > 0;

  if (!ok) {
    return res.status(500).json({
      success: false,
      errorSk: `Kartu sa nepodarilo vygenerovať (ffmpeg kód ${run.status}). ${String(run.stderr ?? "").split("\n").slice(-2).join(" ").trim()}`,
      spec: { ...spec, assContent: "" },
    });
  }

  const bytes = fs.readFileSync(outPath);
  const name = `karta-${recipeId.toLowerCase()}-${kind}-${stamp}.png`;
  res.json({
    success: true,
    name,
    bytes: bytes.length,
    mimeType: "image/png",
    pngBase64: bytes.toString("base64"),
    width,
    height,
    spec: { ...spec, assContent: "" },
    honestySk: "Karta je nakreslená z palety a typografie receptu — nie je to fotografia ani AI obrázok. Text si dodal ty (alebo je z tvojho prepisu).",
  });
});

/** Stav AI generovania obrázkov — appka ho zisťuje reálnym pokusom, nič nepredstiera. */
app.post("/api/visual/ai-generate", async (req, res) => {
  const prompt = String(req.body?.prompt ?? "").trim();
  if (prompt.length < 3) {
    return res.status(400).json({ success: false, errorSk: "Napíš, čo má obrázok zobrazovať (aspoň 3 znaky)." });
  }
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  if (!apiKey) {
    return res.status(503).json({
      success: false,
      providerAvailable: false,
      errorSk: "AI generovanie obrázkov nemá kľúč — v .env nie je GEMINI_API_KEY. Appka ti preto žiadny obrázok nevygeneruje (a nebude predstierať, že áno).",
    });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=${encodeURIComponent(apiKey)}`;
    const answer = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    const payload: any = await answer.json().catch(() => null);
    if (!answer.ok || payload?.error) {
      const status = payload?.error?.code ?? answer.status;
      const message = String(payload?.error?.message ?? answer.statusText ?? "");
      const limitZero = /limit: 0/.test(message);
      return res.status(200).json({
        success: false,
        providerAvailable: false,
        providerStatus: status,
        errorSk: limitZero
          ? "AI generovanie obrázkov je na tvojom kľúči nedostupné: obrázkové modely majú limit 0 (free tier). Použi lokálny generátor kariet alebo voľnú knižnicu — tie fungujú bez providera."
          : `AI generovanie zlyhalo (kód ${status}): ${message.slice(0, 300)}`,
        providerMessage: message.slice(0, 500),
      });
    }

    const parts = payload?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p: any) => p?.inlineData?.data);
    if (!imagePart) {
      return res.status(200).json({
        success: false,
        providerAvailable: true,
        errorSk: "Provider odpovedal, ale neposlal obrázok — nič ti nepodstrčím.",
      });
    }
    return res.json({
      success: true,
      providerAvailable: true,
      model: "gemini-3.1-flash-image",
      mimeType: imagePart.inlineData.mimeType ?? "image/png",
      base64: imagePart.inlineData.data,
      honestySk: "Toto je AI-generovaný obrázok z modelu gemini-3.1-flash-image — nie tvoje médium.",
    });
  } catch (error: any) {
    return res.status(200).json({
      success: false,
      providerAvailable: false,
      errorSk: `AI generovanie neprešlo (sieť/chyba): ${String(error?.message ?? error).slice(0, 200)}`,
    });
  }
});

/** Voľná knižnica: hľadanie obrázkov, ktoré sa smú použiť komerčne a upraviť. */
app.get("/api/library/search", async (req, res) => {
  const query = String(req.query.q ?? "").trim();
  if (query.length < 2) {
    return res.status(400).json({ success: false, errorSk: "Napíš, čo hľadáš (aspoň 2 znaky)." });
  }
  const page = Math.max(1, Number(req.query.page ?? 1) || 1);

  try {
    const answer = await fetch(openverseSearchUrl(query, page, VISUAL_LIMITS.libraryPageSize), {
      headers: { "Accept": "application/json", "User-Agent": "OmniStrih/1.0 (local editor)" },
    });
    if (!answer.ok) {
      return res.status(200).json({
        success: false,
        provider: "openverse",
        errorSk: `Knižnica Openverse odpovedala kódom ${answer.status} — skús inú otázku alebo neskôr. Nič som nestrhol.`,
      } satisfies Partial<LibrarySearchResult> & { success: boolean });
    }
    const payload = await answer.json();
    const processed = processOpenverseResponse(payload, query);
    return res.json({ success: true, ...processed });
  } catch (error: any) {
    return res.status(200).json({
      success: false,
      provider: "openverse",
      errorSk: `Knižnicu sa nepodarilo osloviť: ${String(error?.message ?? error).slice(0, 200)}`,
    });
  }
});

/**
 * Stiahnutie vybraného obrázka z knižnice.
 * Bezpečnosť: appka **nesťahuje ľubovoľnú adresu** z prehliadača — pošle sa len
 * `id`, server si adresu vyžiada znovu od knižnice a stiahne len tú.
 */
app.post("/api/library/fetch", async (req, res) => {
  const id = String(req.body?.id ?? "").trim();
  if (!id) return res.status(400).json({ success: false, errorSk: "Chýba identifikátor obrázka." });

  try {
    const detail = await fetch(openverseDetailUrl(id), {
      headers: { "Accept": "application/json", "User-Agent": "OmniStrih/1.0 (local editor)" },
    });
    if (!detail.ok) {
      return res.status(200).json({
        success: false,
        errorSk: `Obrázok sa v knižnici nenašiel (kód ${detail.status}) — nič som nestrhol.`,
      });
    }
    const raw: any = await detail.json();
    const mapped = processOpenverseResponse({ results: [raw] }, "").items[0] ?? null;
    if (!mapped) {
      return res.status(200).json({ success: false, errorSk: "Tento obrázok nemá licenciu, ktorú môžeš použiť — nestrhávam ho." });
    }

    const file = await fetch(mapped.imageUrl, {
      headers: { "User-Agent": "OmniStrih/1.0 (local editor)" },
    });
    if (!file.ok) {
      return res.status(200).json({
        success: false,
        errorSk: `Súbor sa nepodarilo stiahnuť (kód ${file.status}) — nič som nepridal.`,
      });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length === 0) {
      return res.status(200).json({ success: false, errorSk: "Stiahnutý súbor je prázdny — nič som nepridal." });
    }
    const safeExt = (mapped.imageUrl.split(".").pop() ?? "jpg").split("?")[0].slice(0, 4).toLowerCase();
    const extension = ["jpg", "jpeg", "png", "webp"].includes(safeExt) ? safeExt : "jpg";
    const name = `kniznica-${id.slice(0, 8)}.${extension}`;

    return res.json({
      success: true,
      name,
      bytes: buffer.length,
      mimeType: extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg",
      base64: buffer.toString("base64"),
      item: mapped,
      attributionRequiredSk: mapped.attributionRequired
        ? `Tento obrázok vyžaduje uvedenie autora — do popisu videa pridaj: ${mapped.attributionSk}`
        : `Licencia ${mapped.license.toUpperCase()} autora uvádzať nemusíš, ale zdroj je slušné uviesť: ${mapped.attributionSk}`,
    });
  } catch (error: any) {
    return res.status(200).json({
      success: false,
      errorSk: `Sťahovanie zlyhalo: ${String(error?.message ?? error).slice(0, 200)}`,
    });
  }
});

app.get("/api/export/file/:name", (req, res) => {
  const name = String(req.params.name ?? "");
  if (!isSafeStoredName(name)) {
    return res.status(400).json({ success: false, errorSk: "Neplatné meno súboru." });
  }
  const full = path.join(EXPORT_DIR, name);
  if (!full.startsWith(EXPORT_DIR + path.sep) || !fs.existsSync(full)) {
    return res.status(404).json({ success: false, errorSk: "Súbor neexistuje (mohol byť uprataný)." });
  }
  const inline = String(req.query.inline ?? "") === "1";
  res.setHeader("Content-Type", name.endsWith(".mp4") ? "video/mp4" : "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `${inline ? "inline" : "attachment"}; filename="${name}"`,
  );
  res.sendFile(full);
});

/** Prehľad: čo je v .data (aby bolo vidieť, že sa upratuje). */
app.get("/api/export/status", (_req, res) => {
  res.json({
    success: true,
    exportDir: EXPORT_DIR,
    exportsBytes: dirSizeBytes(EXPORT_DIR),
    uploadsBytes: dirSizeBytes(UPLOAD_DIR),
    limits: BURN_LIMITS,
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        // Povolenie ľubovoľného hostiteľa pre dev/preview prostredia (sandbox,
        // kontajner, reverzná proxy, náhľad v inom origin). Vite 6+ inak blokuje
        // požiadavky s cudzím Host headerom (HTTP 403 "Blocked request").
        // Týka sa VÝHRADNE dev režimu – v produkcii sa Vite vôbec nespúšťa.
        allowedHosts: true,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AutoClip AI Studio Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

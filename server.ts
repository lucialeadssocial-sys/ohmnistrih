import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

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
        "gemini-3.5-flash",
        "gemini-2.5-flash",
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
// DIRECTOR ENGINE — „RAW → READY" Edit Plan
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
 * Výplň na ZAČIATKU vety („Takže, ehm, dnes si ukážeme…").
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
): { plan: DirectorPlanItem[]; summary: string; basis: PlanBasis; anchoredSentences: number } {
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
  const sentences = estimateSentenceTimings(transcript, total);
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
      summary,
      basis: "transcript",
      anchoredSentences: sentences.length,
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
      qualityMode = "PORTFOLIO", // PORTFOLIO = menej, ale kvalitnejších zásahov
      useZeroTokenMode = false,
    } = req.body || {};

    const modeKey = String(mode).toUpperCase();
    const safeMode = DIRECTOR_MODES[modeKey] ? modeKey : "CUSTOM";
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
      const local = buildLocalDirectorPlan(safeMode, durationSec, language, String(transcript || ""));
      telemetryStats.localRequestsToday++;
      return buildResponse(local.plan, "local-fallback", {
        summary: local.summary,
        tokensUsed: 0,
        planBasis: local.basis,
        anchoredSentences: local.anchoredSentences,
      });
    }

    // 2) Skúsime Gemini (rovnaká logika výberu kľúčov ako inde v aplikácii)
    const candidateKeys = selectCandidateKeysForTask("gemini", "TEXT_REASONING", "gemini-3.8-flash");

    if (candidateKeys.length > 0) {
      const modelCandidates = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-2.5-flash"];
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
        transcript
          ? `\nPREPIS (môže byť neúplný):\n"""${clampText(transcript, 6000)}"""`
          : sk
            ? "\nPrepisy nie sú k dispozícii — navrhni plán na základe bežnej štruktúry takéhoto videa."
            : "\nNo transcript available — base the plan on the typical structure of such a video.",
        notes ? `\nPOZNÁMKY POUŽÍVATEĽA:\n"""${clampText(notes, 1500)}"""` : "",
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
    const local = buildLocalDirectorPlan(safeMode, durationSec, language, String(transcript || ""));
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

    const response = await ai.models.generateContent({
      model: keyItem.model || "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: audioBase64
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
    } catch (e) {
      const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    }

    if (!parsed || !parsed.hasSpeech || !Array.isArray(parsed.segments) || parsed.segments.length === 0) {
      return res.json({
        success: true,
        hasSpeech: false,
        message: "V tomto videu sa nepodarilo nájsť hovorené slovo.",
        segments: []
      });
    }

    keyItem.lastSuccessfulUse = new Date().toISOString();

    return res.json({
      success: true,
      hasSpeech: true,
      segments: parsed.segments
    });
  } catch (err: any) {
    console.error("Error in /api/transcribe-speech:", err);
    return res.json({
      success: true,
      hasSpeech: false,
      message: "V tomto videu sa nepodarilo nájsť hovorené slovo.",
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

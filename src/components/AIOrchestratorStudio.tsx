import React, { useState, useEffect } from "react";
import {
  Brain,
  Zap,
  ShieldCheck,
  Server,
  Database,
  Cpu,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Sliders,
  DollarSign,
  Activity,
  Trash2,
  HardDrive,
  Info
} from "lucide-react";
import {
  AIBudgetMode,
  AIJob,
  AIOrchestratorState,
  AIProviderId,
  AIStatusLevel,
  TaskClassification
} from "../types";
import {
  aiOrchestrator,
  aiCache,
  TASK_CLASSIFICATION_RULES,
  PRIORITY_WEIGHTS
} from "../services/aiOrchestrator";

interface AIOrchestratorStudioProps {
  language: "sk" | "en";
  showToast: (msg: string, type?: "success" | "info" | "warning") => void;
  projectVersion?: number;
  onIncrementVersion?: () => void;
}

export const AIOrchestratorStudio: React.FC<AIOrchestratorStudioProps> = ({
  language,
  showToast,
  projectVersion = 1,
  onIncrementVersion,
}) => {
  const isSk = language === "sk";
  const [orchestratorState, setOrchestratorState] = useState<AIOrchestratorState>(() =>
    aiOrchestrator.getState()
  );
  const [activeTab, setActiveTab] = useState<"overview" | "queue" | "matrix" | "cache" | "simulation">("overview");
  const [simulatingTaskType, setSimulatingTaskType] = useState<string>("HOOK_ANALYSIS");
  const [isExecutingSim, setIsExecutingSim] = useState(false);

  useEffect(() => {
    const unsubscribe = aiOrchestrator.subscribe((state) => {
      setOrchestratorState(state);
    });
    return () => unsubscribe();
  }, []);

  const handleBudgetChange = (mode: AIBudgetMode) => {
    aiOrchestrator.setBudgetMode(mode);
    showToast(
      isSk ? `AI rozpočet nastavený na: ${mode}` : `AI Budget Mode set to: ${mode}`,
      "info"
    );
  };

  const handleSimulateTask = async () => {
    setIsExecutingSim(true);
    try {
      const res = await aiOrchestrator.dispatchTask({
        taskType: simulatingTaskType,
        payload: {
          testTimestamp: Date.now(),
          context: "Simulated video segment",
          duration: 15.0,
        },
        priority: "USER_ACTION",
        projectId: "omnistrih-demo",
      });

      if (res.job.status === "FALLBACK_LOCAL") {
        // The local fallback has no real DSP: its payloads are marked synthetic, so say so instead
        // of reporting a completed measurement.
        showToast(
          isSk
            ? `Úloha obslúžená LOKÁLNYM FALLBACKOM (poskytovateľ bol limitovaný) — výsledok je označený ako syntetické demo dáta, nie meranie média.`
            : `Task served by the LOCAL FALLBACK (provider was rate limited) — the result is marked synthetic demo data, not a media measurement.`,
          "warning"
        );
      } else {
        showToast(
          isSk
            ? `Úloha úspešne dokončená cez ${res.job.provider} (${res.job.model})`
            : `Task completed via ${res.job.provider} (${res.job.model})`,
          "success"
        );
      }
    } catch (err: any) {
      showToast(err.message || "Execution error", "warning");
    } finally {
      setIsExecutingSim(false);
    }
  };

  const getStatusBadge = (status: AIStatusLevel) => {
    switch (status) {
      case "AI AVAILABLE":
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {isSk ? "AI DOSTUPNÉ (100% Prevádzka)" : "AI AVAILABLE (100% Operational)"}
          </div>
        );
      case "AI LIMITED":
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            {isSk ? "AI OBMEDZENÉ (Ekonomický režim / Kvóty)" : "AI LIMITED (Economy mode / Quota active)"}
          </div>
        );
      case "AI TEMPORARILY UNAVAILABLE":
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            {isSk ? "AI DOČASNE NEDOSTUPNÉ (100% Lokálny Autonómny Režim)" : "AI TEMPORARILY UNAVAILABLE (100% Local Fallback Mode)"}
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 text-neutral-100">
      {/* Top Banner: Status + Project Versioning */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-neutral-950 border border-neutral-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                {isSk ? "AI Orchestrator & Multi-Provider Fallback Engine" : "AI Orchestrator & Multi-Provider Fallback Engine"}
              </h2>
              <p className="text-xs text-neutral-400">
                {isSk
                  ? "Agnostický manažér AI modelov: Nikdy nezastaví strih pri výpadku API ani pri vyčerpaní kvóty."
                  : "Provider-agnostic AI orchestrator: Editor never halts when API limits or network errors occur."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {getStatusBadge(orchestratorState.overallStatus)}

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-800/80 border border-neutral-700 text-xs font-mono">
            <Layers className="w-3.5 h-3.5 text-neutral-400" />
            <span className="text-neutral-400">{isSk ? "Verzia projektu:" : "Project Ver:"}</span>
            <span className="font-bold text-cyan-400">v{orchestratorState.currentProjectVersion}</span>
            {onIncrementVersion && (
              <button
                onClick={() => {
                  onIncrementVersion();
                  aiOrchestrator.incrementProjectVersion();
                  showToast(isSk ? "Verzia projektu zvýšená" : "Project version incremented", "info");
                }}
                title={isSk ? "Zvýšiť verziu projektu (Ochrana pred neplatnými AI výsledkami)" : "Increment version (Stale AI guard)"}
                className="ml-1 p-1 hover:bg-neutral-700 rounded text-neutral-300 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* AI Budget Mode Selector */}
      <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-neutral-200">
              {isSk ? "AI Budget Režim (Optimalizácia nákladov & inteligencie)" : "AI Budget Mode (Cost & Intelligence Optimization)"}
            </h3>
          </div>
          <span className="text-xs text-neutral-400">
            {isSk ? "Aktuálne:" : "Active:"} <strong className="text-cyan-400 font-mono">{orchestratorState.budgetMode}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              id: "FREE",
              title: "FREE",
              badge: "0.00 €",
              badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
              descSk: "100% Lokálny WASM engine + voľne dostupné lokálne heuristiky. Žiadne platené API.",
              descEn: "100% Local WASM engine + free heuristics. Zero paid API calls.",
            },
            {
              id: "ECONOMY",
              title: "ECONOMY",
              badge: "Ultra-Low",
              badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/30",
              descSk: "AI volané len keď prináša vysokú sémantickú hodnotu (Gemini Flash 8B, GPT-4o-mini).",
              descEn: "AI used only when high value added (Gemini Flash 8B, GPT-4o-mini).",
            },
            {
              id: "BALANCED",
              title: "BALANCED",
              badge: "Recommended",
              badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
              descSk: "Optimálny pomer kvality strihu a rýchlosti (Gemini 2.5 Flash, Claude 3.5 Haiku).",
              descEn: "Optimal editing quality & fast response (Gemini 2.5 Flash, Claude Haiku).",
            },
            {
              id: "QUALITY",
              title: "QUALITY",
              badge: "Max Reasoning",
              badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/30",
              descSk: "Najpokročilejšie uvažovacie modely pre komplexné príbehy (Gemini 2.5 Pro, Claude Sonnet).",
              descEn: "Highest-grade reasoning models for complex narratives (Gemini 2.5 Pro, Claude Sonnet).",
            },
          ].map((mode) => {
            const isSelected = orchestratorState.budgetMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => handleBudgetChange(mode.id as AIBudgetMode)}
                className={`text-left p-4 rounded-xl border transition-all duration-200 relative ${
                  isSelected
                    ? "bg-neutral-800 border-cyan-500 ring-1 ring-cyan-500/50 shadow-lg shadow-cyan-500/10"
                    : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/40"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-bold text-sm ${isSelected ? "text-cyan-400" : "text-neutral-200"}`}>
                    {mode.title}
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${mode.badgeColor}`}>
                    {mode.badge}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  {isSk ? mode.descSk : mode.descEn}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-3 overflow-x-auto">
        {[
          { id: "overview", label: isSk ? "Poskytovatelia & Kvóty" : "Providers & Quotas", icon: Server },
          { id: "matrix", label: isSk ? "Klasifikácia úloh (LOKÁL vs AI)" : "Task Classification Matrix", icon: Layers },
          { id: "queue", label: isSk ? "Fronta úloh & Priority" : "Job Queue & Priority", icon: Activity },
          { id: "cache", label: isSk ? "Cache & Úspora tokenov" : "Cache & Savings", icon: Database },
          { id: "simulation", label: isSk ? "Test výpadku a Fallbacku" : "Failure & Fallback Simulator", icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                isActive
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                  : "bg-neutral-900 text-neutral-400 border border-neutral-800 hover:text-neutral-200 hover:bg-neutral-800"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: 1. OVERVIEW (Providers & Quotas) */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {orchestratorState.providers.map((provider) => {
              const isLocal = provider.providerId === "local_heuristic";
              const isRateLimited = provider.status === "RATE_LIMITED" || provider.status === "QUOTA_EXHAUSTED";

              return (
                <div
                  key={provider.providerId}
                  className={`p-4 rounded-2xl border transition-all ${
                    isRateLimited
                      ? "bg-rose-950/20 border-rose-800/60"
                      : isLocal
                      ? "bg-emerald-950/10 border-emerald-800/40"
                      : "bg-neutral-900 border-neutral-800"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {isLocal ? (
                        <HardDrive className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Server className="w-4 h-4 text-cyan-400" />
                      )}
                      <span className="font-bold text-sm text-neutral-200">{provider.name}</span>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        provider.status === "HEALTHY" || provider.status === "ACTIVE"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                      }`}
                    >
                      {provider.status}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-neutral-400">
                      <span>{isSk ? "Aktívny model:" : "Active model:"}</span>
                      <span className="font-mono text-neutral-200">{provider.activeModel}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-neutral-400">
                        <span>{isSk ? "Zostávajúci kredit:" : "Remaining credits:"}</span>
                        <span className="font-mono text-cyan-400">
                          {isLocal ? "∞ (Neobmedzené)" : `${provider.remainingCreditsPercent}%`}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            isLocal
                              ? "bg-emerald-400"
                              : provider.remainingCreditsPercent > 30
                              ? "bg-cyan-400"
                              : "bg-rose-400"
                          }`}
                          style={{ width: `${provider.remainingCreditsPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between text-neutral-400 pt-1">
                      <span>RPM / TPM:</span>
                      <span className="font-mono text-neutral-300">
                        {isLocal ? "N/A (Offline)" : `${provider.currentRpm} / ${provider.currentTpm}tpm`}
                      </span>
                    </div>

                    {provider.lastError && (
                      <div className="p-2 rounded-lg bg-rose-900/30 border border-rose-800/40 text-[11px] text-rose-300 mt-2">
                        <strong>Chyba:</strong> {provider.lastError}
                      </div>
                    )}

                    <div className="pt-2 flex items-center justify-between border-t border-neutral-800">
                      <span className="text-[10px] text-neutral-500">
                        {isLocal ? "Zero latency" : "Auto-Fallback Ready"}
                      </span>
                      {!isLocal && (
                        <button
                          onClick={() => {
                            if (isRateLimited) {
                              aiOrchestrator.resetProviderHealth(provider.providerId);
                              showToast(isSk ? "Poskytovateľ obnovený" : "Provider reset", "success");
                            } else {
                              aiOrchestrator.simulateProviderQuotaTrip(provider.providerId);
                              showToast(isSk ? "Simulované vyčerpanie kvóty 429" : "Simulated 429 quota exhaustion", "warning");
                            }
                          }}
                          className={`text-[10px] px-2 py-1 rounded transition-colors ${
                            isRateLimited
                              ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                              : "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                          }`}
                        >
                          {isRateLimited ? (isSk ? "Resetovať" : "Reset") : (isSk ? "Simulovať 429" : "Simulate 429")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 rounded-2xl bg-neutral-900/50 border border-neutral-800 flex items-start gap-3">
            <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="text-xs text-neutral-300 space-y-1">
              <strong className="text-neutral-100">
                {isSk ? "Garancia kontinuity strihu (Zero-Halting Architecture):" : "Editing Continuity Guarantee (Zero-Halting Architecture):"}
              </strong>
              <p className="text-neutral-400 leading-relaxed">
                {isSk
                  ? "Ak ktorýkoľvek poskytovateľ (Gemini, Claude, OpenAI) vráti Rate Limit 429 alebo vyčerpá kvótu, OmniStrih nepadne. Úlohy sa automaticky prepoja na záložného poskytovateľa alebo na lokálny WASM engine. Prehrávanie, strih na časovej osi, generovanie vĺn a render videa pokračujú 100% autonómne."
                  : "If any AI provider hits a 429 rate limit or quota exhaustion, OmniStrih does not halt: tasks reroute to backup providers. Tasks without a real local implementation return labelled synthetic demo data (never a fake measurement), and playback, manual editing and export keep working offline."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 2. TASK CLASSIFICATION MATRIX */}
      {activeTab === "matrix" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800">
            <h3 className="text-sm font-semibold text-neutral-200 mb-2">
              {isSk ? "Matica smerovania úloh (Smerovanie bez zbytočného míňania tokenov)" : "Task Routing Matrix (Zero Unnecessary Token Waste)"}
            </h3>
            <p className="text-xs text-neutral-400 mb-4">
              {isSk
                ? "Každá požiadavka je pred spustením klasifikovaná. Lokálne technické operácie nikdy neposielajú dáta na externé servery."
                : "Every request is classified prior to execution. Local deterministic operations never send data to external APIs."}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* LOCAL Category */}
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase">
                  <HardDrive className="w-4 h-4" />
                  <span>LOCAL (100% Offline WASM)</span>
                </div>
                <div className="space-y-1.5 text-xs text-neutral-300">
                  {[
                    "WAVEFORM (Audio Peaks Extraction)",
                    "THUMBNAIL_EXTRACT (Canvas Frame Grab)",
                    "SILENCE_DETECTION (Energy Threshold)",
                    "BASIC_MEDIA_METADATA (Duration/FPS)",
                    "TIMELINE_SPLIT (Split & Ripple Cuts)",
                    "PLAYBACK_SEEK (Instant scrubbing)",
                    "EXPORT_RENDER (WebCodecs / Canvas)",
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 py-1 px-2 rounded bg-neutral-900/60 border border-emerald-900/30 font-mono text-[11px]">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-amber-400/90 leading-relaxed pt-1">
                  {isSk
                    ? "Poznámka: lokálny fallback pre waveform / silence / scene úlohy nemeria médium — vracia označené syntetické demo dáta. Reálne merania robí media-engine (Web Audio dekódovanie) a analýza projektu."
                    : "Note: the local fallback for waveform / silence / scene tasks does not measure the media — it returns labelled synthetic demo data. Real measurements come from the media engine (Web Audio decoding) and the project analysis."}
                </p>
              </div>

              {/* AI Category */}
              <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-800/40 space-y-3">
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase">
                  <Brain className="w-4 h-4" />
                  <span>AI (Semantic Reasoning)</span>
                </div>
                <div className="space-y-1.5 text-xs text-neutral-300">
                  {[
                    "STORY_STRUCTURE (Narrative Flow)",
                    "CONTEXT_INTERPRETATION (Humor/Mood)",
                    "MEANING_ANALYSIS (Deep Content)",
                    "BROLL_REASONING (Semantic Footage Match)",
                    "HOOK_ANALYSIS (Viral 3s Scoring)",
                    "NATURAL_LANGUAGE_EDIT (Prompt to Cut)",
                    "VOICE_TONE_CATEGORIZER (Energy Style)",
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 py-1 px-2 rounded bg-neutral-900/60 border border-cyan-900/30 font-mono text-[11px]">
                      <Sparkles className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* HYBRID Category */}
              <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-800/40 space-y-3">
                <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase">
                  <Cpu className="w-4 h-4" />
                  <span>HYBRID (Local + AI Polish)</span>
                </div>
                <div className="space-y-1.5 text-xs text-neutral-300">
                  {[
                    "SPEECH_TRANSCRIPT_SYNC (Local VAD + AI)",
                    "AUTO_JUMP_CUTS (Local Pauses + AI Flow)",
                    "SUBTITLE_HIGHLIGHT (Local Token + AI Score)",
                    "BEAT_DROP_TRANSITION (Local FFT + AI Vibe)",
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 py-1 px-2 rounded bg-neutral-900/60 border border-purple-900/30 font-mono text-[11px]">
                      <RefreshCw className="w-3 h-3 text-purple-400 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 3. JOB QUEUE & PRIORITY */}
      {activeTab === "queue" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-neutral-200">
                  {isSk ? "Prioritná Fronta Úloh (Execution Engine)" : "Job Queue & Priority Execution"}
                </h3>
                <p className="text-xs text-neutral-400">
                  {isSk
                    ? "Prioritný rebríček zaručuje, že prehrávanie a akcie používateľa majú okamžitú prednosť pred AI prepočítačmi na pozadí."
                    : "Priority ranking ensures playback and user interactions strictly preempt background AI computation."}
                </p>
              </div>
              <span className="text-xs font-mono text-cyan-400 bg-cyan-950/50 px-2.5 py-1 rounded-lg border border-cyan-800/40">
                {orchestratorState.activeJobQueue.length} {isSk ? "čakajúcich úloh" : "active jobs"}
              </span>
            </div>

            {/* Priority Hierarchy Visual Bar */}
            <div className="flex items-center gap-1 overflow-x-auto py-2 text-[10px] font-mono">
              {[
                { name: "PLAYBACK", weight: "P1 (100)" },
                { name: "USER ACTION", weight: "P2 (90)" },
                { name: "VISIBLE PREVIEW", weight: "P3 (80)" },
                { name: "TIMELINE", weight: "P4 (70)" },
                { name: "LOCAL PROCESSING", weight: "P5 (60)" },
                { name: "AI PRECOMPUTATION", weight: "P6 (30)" },
              ].map((p, idx) => (
                <div key={idx} className="flex items-center gap-1 shrink-0">
                  <span className="px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-neutral-300">
                    {p.name} <strong className="text-cyan-400">{p.weight}</strong>
                  </span>
                  {idx < 5 && <ArrowRight className="w-3 h-3 text-neutral-600" />}
                </div>
              ))}
            </div>

            {/* History and Active Queue List */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-semibold text-neutral-400">
                {isSk ? "Nedávne a bežiace úlohy:" : "Recent and running jobs:"}
              </h4>
              <div className="divide-y divide-neutral-800 rounded-xl bg-neutral-950 border border-neutral-800 overflow-hidden max-h-80 overflow-y-auto">
                {orchestratorState.completedJobsHistory.concat(orchestratorState.activeJobQueue).map((job) => {
                  const isFallback = job.status === "FALLBACK_LOCAL" || job.actualUsage?.fallbackTriggered;
                  return (
                    <div key={job.id} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-neutral-900/60 transition-colors">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-1.5 rounded-lg border ${
                            job.classification === "LOCAL"
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                              : "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                          }`}
                        >
                          {job.classification === "LOCAL" ? <HardDrive className="w-4 h-4" /> : <Brain className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-neutral-200">{job.type}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono">
                              v{job.inputVersion}
                            </span>
                            {isFallback && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                                Fallback Local
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-neutral-400">{job.payloadSummary || job.id}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <div className="font-mono text-neutral-300">
                            {job.provider} <span className="text-neutral-500">({job.model})</span>
                          </div>
                          <div className="text-[10px] text-neutral-500">
                            {job.actualUsage?.latencyMs ? `${job.actualUsage.latencyMs}ms` : "In progress"} • {job.priority}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-mono px-2 py-1 rounded-full border ${
                            job.status === "COMPLETED"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : job.status === "RUNNING"
                              ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30 animate-pulse"
                              : job.status === "FALLBACK_LOCAL"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {job.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 4. CACHE & SAVINGS */}
      {activeTab === "cache" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800">
              <div className="flex items-center justify-between text-neutral-400 mb-1">
                <span className="text-xs">{isSk ? "Uložené záznamy:" : "Cache entries:"}</span>
                <Database className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-bold text-neutral-100 font-mono">
                {orchestratorState.cacheStats.entriesCount}
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">
                {isSk ? "Deterministické hashe kontextu" : "Deterministic payload hashes"}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800">
              <div className="flex items-center justify-between text-neutral-400 mb-1">
                <span className="text-xs">{isSk ? "Úspešné cache zásahy:" : "Cache hits:"}</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400 font-mono">
                {orchestratorState.cacheStats.hits}
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">
                {isSk ? "0ms odozva, 0 tokenov" : "0ms latency, 0 tokens"}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800">
              <div className="flex items-center justify-between text-neutral-400 mb-1">
                <span className="text-xs">{isSk ? "Ušetrené bajty:" : "Bytes saved:"}</span>
                <HardDrive className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-neutral-100 font-mono">
                {(orchestratorState.cacheStats.bytesSaved / 1024).toFixed(1)} KB
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">
                {isSk ? "Ušetrená šírka pásma" : "Saved network bandwidth"}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800">
              <div className="flex items-center justify-between text-neutral-400 mb-1">
                <span className="text-xs">{isSk ? "Finančná úspora:" : "Estimated savings:"}</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400 font-mono">
                ${orchestratorState.cacheStats.estimatedSavingsUSD.toFixed(3)}
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">
                {isSk ? "Ušetrené na API volaniach" : "Saved on API invocations"}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-neutral-200">
                {isSk ? "Ochrana pred neplatnými AI výsledkami (Stale Project Guard):" : "Stale Project Version Guard:"}
              </h4>
              <p className="text-xs text-neutral-400">
                {isSk
                  ? `Aktuálna verzia projektu je v${orchestratorState.currentProjectVersion}. Ak používateľ zmení video (posunie strih), staré AI výsledky sa neaplikujú.`
                  : `Current version is v${orchestratorState.currentProjectVersion}. Stale background AI computations for older versions are never applied automatically.`}
              </p>
            </div>
            <button
              onClick={() => {
                aiCache.clear();
                showToast(isSk ? "Cache vyčistená" : "Cache cleared", "info");
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {isSk ? "Vyčistiť cache" : "Clear Cache"}
            </button>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 5. SIMULATION & TESTING */}
      {activeTab === "simulation" && (
        <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-200">
              {isSk ? "Interaktívny simulátor záťažového testu a Fallbacku" : "Interactive Fallback & Load Simulator"}
            </h3>
            <p className="text-xs text-neutral-400">
              {isSk
                ? "Overte, že OmniStrih okamžite a bez pádu prepína medzi vzdialenou AI a lokálnym WASM enginom pri výpadku siete alebo vyčerpaní kvóty 429."
                : "Verify that OmniStrih seamlessly falls back between cloud AI and local WASM heuristics without ever crashing or blocking the user."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={simulatingTaskType}
              onChange={(e) => setSimulatingTaskType(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 font-mono"
            >
              <option value="HOOK_ANALYSIS">HOOK_ANALYSIS (Semantic AI)</option>
              <option value="STORY_STRUCTURE">STORY_STRUCTURE (Narrative AI)</option>
              <option value="SILENCE_DETECTION_HEURISTIC">SILENCE_DETECTION (Local Heuristic)</option>
              <option value="WAVEFORM">WAVEFORM (100% Local DSP)</option>
              <option value="BROLL_REASONING">BROLL_REASONING (Semantic Footage)</option>
            </select>

            <button
              onClick={handleSimulateTask}
              disabled={isExecutingSim}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-lg shadow-cyan-600/20"
            >
              {isExecutingSim ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              {isSk ? "Spustiť úlohu cez Orchestrator" : "Dispatch Job via Orchestrator"}
            </button>

            <button
              onClick={() => {
                orchestratorState.providers.forEach((p) => {
                  if (p.providerId !== "local_heuristic") {
                    aiOrchestrator.simulateProviderQuotaTrip(p.providerId);
                  }
                });
                showToast(
                  isSk
                    ? "Všetci vzdialení AI poskytovatelia boli vyčerpaní (429)! OmniStrih prechádza do 100% Lokálneho Režimu."
                    : "All remote providers tripped to 429 quota limit! OmniStrih enters 100% Local Autonomous Mode.",
                  "warning"
                );
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {isSk ? "Simulovať výpadok všetkých AI poskytovateľov" : "Simulate Outage of All AI Providers"}
            </button>

            <button
              onClick={() => {
                orchestratorState.providers.forEach((p) => {
                  if (p.providerId !== "local_heuristic") {
                    aiOrchestrator.resetProviderHealth(p.providerId);
                  }
                });
                showToast(
                  isSk ? "Všetci AI poskytovatelia boli obnovení do stavu HEALTHY" : "All AI providers restored to HEALTHY status",
                  "success"
                );
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isSk ? "Obnoviť všetkých poskytovateľov" : "Reset All Providers"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

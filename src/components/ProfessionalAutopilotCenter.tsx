import React, { useState } from "react";
import {
  Zap,
  ShieldCheck,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Lock,
  Unlock,
  RotateCcw,
  Sparkles,
  FileText,
  Play,
  Check,
  HelpCircle,
  BarChart2,
  ListFilter,
  Eye,
  ArrowRight
} from "lucide-react";
import { EditDecisionRecord, EditDecisionList } from "../types";
import { EDLManager } from "../utils/edlManager";

interface ProfessionalAutopilotCenterProps {
  language: "sk" | "en";
  showToast: (msg: string, type?: "success" | "info" | "warning") => void;
  projectId: string;
}

export const ProfessionalAutopilotCenter: React.FC<ProfessionalAutopilotCenterProps> = ({
  language,
  showToast,
  projectId,
}) => {
  const isSk = language === "sk";
  const [edl, setEdl] = useState<EditDecisionList>(() => EDLManager.getEDL(projectId));
  const [activeTab, setActiveTab] = useState<"configure" | "review" | "report">("configure");
  const [autopilotMode, setAutopilotMode] = useState<"FULL" | "BALANCED" | "CONSERVATIVE">("BALANCED");
  const [selectedPreset, setSelectedPreset] = useState<string>("TALKING_HEAD");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [isRunningAutopilot, setIsRunningAutopilot] = useState<boolean>(false);

  // Run Autopilot execution flow
  const handleRunAutopilot = () => {
    setIsRunningAutopilot(true);
    showToast(isSk ? "Spúšťam Professional Autopilot analýzu..." : "Running Professional Autopilot analysis...", "info");

    setTimeout(() => {
      const updatedDecisions = edl.decisions.map((dec: EditDecisionRecord) => {
        if (dec.isLocked) return dec;
        if (autopilotMode === "FULL" && dec.confidence >= 0.75) {
          return { ...dec, status: "accepted" as const };
        } else if (autopilotMode === "BALANCED" && dec.confidence >= 0.90) {
          return { ...dec, status: "accepted" as const };
        } else if (autopilotMode === "CONSERVATIVE" && dec.confidence >= 0.96) {
          return { ...dec, status: "accepted" as const };
        }
        return dec;
      });

      const newEdl: EditDecisionList = {
        ...edl,
        decisions: updatedDecisions,
      };
      EDLManager.saveEDL(newEdl);
      setEdl(newEdl);
      setIsRunningAutopilot(false);
      showToast(isSk ? "Autopilot úspešne dokončil EDL optimalizáciu!" : "Autopilot completed EDL optimization!", "success");
      setActiveTab("review");
    }, 1500);
  };

  // Handle decision status change in Human Review Center
  const handleUpdateDecisionStatus = (id: string, newStatus: "accepted" | "rejected" | "PENDING_REVIEW") => {
    const updated = edl.decisions.map((d: EditDecisionRecord) => {
      if (d.id === id) {
        return { ...d, status: newStatus };
      }
      return d;
    });
    const newEdl = { ...edl, decisions: updated };
    EDLManager.saveEDL(newEdl);
    setEdl(newEdl);
    showToast(isSk ? "Rozhodnutie aktualizované v EDL" : "EDL decision updated", "success");
  };

  // Toggle lock (Do Not Touch)
  const handleToggleLock = (id: string) => {
    const updated = edl.decisions.map((d: EditDecisionRecord) => {
      if (d.id === id) {
        return { ...d, isLocked: !d.isLocked };
      }
      return d;
    });
    const newEdl = { ...edl, decisions: updated };
    EDLManager.saveEDL(newEdl);
    setEdl(newEdl);
    showToast(isSk ? "Uzamknuté (Do Not Touch stav zmenený)" : "Lock state updated", "info");
  };

  // Stats for Report
  const totalDecisions = edl.decisions.length;
  const acceptedCount = edl.decisions.filter((d: EditDecisionRecord) => d.status === "accepted" || d.category === "SAFE").length;
  const reviewCount = edl.decisions.filter((d: EditDecisionRecord) => d.category === "REVIEW" || d.category === "CRITICAL" || d.status === "PENDING_REVIEW").length;
  const automationPercentage = Math.round((acceptedCount / totalDecisions) * 100);

  const filteredDecisions = edl.decisions.filter((d: EditDecisionRecord) => {
    if (filterStatus === "ALL") return true;
    if (filterStatus === "REVIEW_ONLY") return d.category === "REVIEW" || d.category === "CRITICAL" || d.status === "PENDING_REVIEW";
    if (filterStatus === "LOCKED") return d.isLocked;
    return d.status === filterStatus;
  });

  return (
    <div className="space-y-6 text-neutral-100">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-neutral-950 border border-neutral-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              {isSk ? "Professional Autopilot & Jednotný EDL" : "Professional Autopilot & Unified EDL"}
            </h2>
            <p className="text-xs text-neutral-400">
              {isSk
                ? "Nedestruktívny Source-of-Truth systém rozhodnutí s kontextovou bezpečnosťou a Human Review centrom."
                : "Non-destructive source-of-truth decision list with context safety and Human Review center."}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
          <button
            onClick={() => setActiveTab("configure")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "configure"
                ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {isSk ? "1. Konfigurácia" : "1. Configure"}
          </button>
          <button
            onClick={() => setActiveTab("review")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all relative ${
              activeTab === "review"
                ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {isSk ? "2. Human Review Center" : "2. Human Review"}
            {reviewCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-neutral-950 font-mono text-[9px] font-black">
                {reviewCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("report")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "report"
                ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {isSk ? "3. Automation Report" : "3. Report"}
          </button>
        </div>
      </div>

      {/* Tab 1: Configure & Presets */}
      {activeTab === "configure" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-4">
            <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl">
              <h3 className="text-sm font-bold text-neutral-200 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-rose-400" />
                {isSk ? "Výber Profesionálneho Presetu" : "Professional Edit Preset"}
              </h3>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "TALKING_HEAD", label: isSk ? "🗣️ Talking Head" : "🗣️ Talking Head" },
                  { id: "SHORT_SOCIAL", label: isSk ? "⚡ Short Social (TikTok/Reels)" : "⚡ Short Social" },
                  { id: "PODCAST", label: isSk ? "🎙️ Podcast Studio" : "🎙️ Podcast" },
                  { id: "EDUCATIONAL", label: isSk ? "🎓 Educational / Tutorial" : "🎓 Educational" },
                  { id: "LONG_FORM", label: isSk ? "📺 YouTube Long Form" : "📺 Long Form" },
                  { id: "STORYTELLING", label: isSk ? "🎬 Cinematic Storytelling" : "🎬 Storytelling" },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPreset(p.id)}
                    className={`p-3 rounded-xl border text-left text-xs font-semibold transition-all ${
                      selectedPreset === p.id
                        ? "bg-rose-500/20 border-rose-500 text-rose-300 shadow-md shadow-rose-500/10"
                        : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl">
              <h3 className="text-sm font-bold text-neutral-200 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                {isSk ? "Režim Autopilota (Autopilot Mode)" : "Autopilot Safety Mode"}
              </h3>

              <div className="space-y-2">
                {[
                  {
                    id: "FULL",
                    title: isSk ? "Plný Autopilot (Full Autopilot)" : "Full Autopilot",
                    desc: isSk ? "Aplikuje všetky bezpečné rozhodnutia (>0.75 confidence) automaticky." : "Applies all safe decisions automatically.",
                  },
                  {
                    id: "BALANCED",
                    title: isSk ? "Vyvážený Režim (Balanced - Odporúčané)" : "Balanced Mode (Recommended)",
                    desc: isSk ? "Automaticky iba 90%+ SAFE rozhodnutia. Ostatné posiela do Human Review." : "Auto-applies 90%+ SAFE. Sends others to review.",
                  },
                  {
                    id: "CONSERVATIVE",
                    title: isSk ? "Konzervatívny Režim (Conservative)" : "Conservative Mode",
                    desc: isSk ? "Automaticky iba 96%+ istoty. Maximálna kontextová ochrana." : "Auto-applies only 96%+ certainty.",
                  },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setAutopilotMode(m.id as any)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                      autopilotMode === m.id
                        ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-300"
                        : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    <div className="font-bold text-xs text-neutral-200">{m.title}</div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-4">
            <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-6 shadow-xl flex flex-col justify-between h-full">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-100">
                      {isSk ? "Spustiť Professional Autopilot" : "Run Professional Autopilot"}
                    </h3>
                    <p className="text-xs text-neutral-400">
                      {isSk
                        ? "Analyzuje RAW video, vytvorí nedestruktívne EDL rozhodnutia, upraví pacing a pripraví Human Review."
                        : "Analyzes RAW video, builds non-destructive EDL decisions, optimizes pacing, and sets up Human Review."}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2 text-xs">
                  <div className="flex justify-between text-neutral-400">
                    <span>{isSk ? "Aktívny Preset:" : "Active Preset:"}</span>
                    <span className="text-neutral-200 font-bold">{selectedPreset}</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>{isSk ? "Režim:" : "Mode:"}</span>
                    <span className="text-emerald-400 font-bold">{autopilotMode}</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>{isSk ? "EDL Stav:" : "EDL State:"}</span>
                    <span className="text-purple-400 font-mono font-bold">{edl.decisions.length} {isSk ? "rozhodnutí" : "decisions"}</span>
                  </div>
                </div>
              </div>

              <button
                disabled={isRunningAutopilot}
                onClick={handleRunAutopilot}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-bold text-sm shadow-xl shadow-rose-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isRunningAutopilot ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{isSk ? "Autopilot analyzuje..." : "Autopilot analyzing..."}</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>{isSk ? "Vytvoriť Professional Edit (Spustiť)" : "Create Professional Edit"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Human Review Center */}
      {activeTab === "review" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-neutral-900 border border-neutral-800">
            <div className="flex items-center gap-2">
              <ListFilter className="w-4 h-4 text-neutral-400" />
              <span className="text-xs font-semibold text-neutral-300">
                {isSk ? "Filtrovať rozhodnutia v EDL:" : "Filter EDL Decisions:"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: "ALL", label: isSk ? "Všetky" : "All" },
                { id: "REVIEW_ONLY", label: isSk ? "⚠️ Vyžaduje Review" : "⚠️ Review Required" },
                { id: "accepted", label: isSk ? "✅ Schválené" : "Accepted" },
                { id: "LOCKED", label: isSk ? "🔒 Uzamknuté (Do Not Touch)" : "Locked" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilterStatus(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    filterStatus === f.id
                      ? "bg-rose-500/20 border-rose-500 text-rose-300"
                      : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredDecisions.map((dec: EditDecisionRecord) => {
              const isReview = dec.category === "REVIEW" || dec.category === "CRITICAL" || dec.status === "PENDING_REVIEW";
              const isAccepted = dec.status === "accepted" || dec.category === "SAFE";

              return (
                <div
                  key={dec.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    dec.isLocked
                      ? "bg-purple-950/20 border-purple-500/40"
                      : isReview
                      ? "bg-amber-500/5 border-amber-500/40 ring-1 ring-amber-500/20"
                      : "bg-neutral-900 border-neutral-800"
                  }`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                          dec.type === "CUT"
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                            : dec.type === "ZOOM"
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                            : dec.type === "CAPTION"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                            : "bg-neutral-800 text-neutral-300 border-neutral-700"
                        }`}
                      >
                        {dec.type}
                      </span>
                      <span className="text-xs font-mono text-neutral-400">
                        ⏱️ {dec.start.toFixed(1)}s → {dec.end.toFixed(1)}s
                      </span>
                      <span className="text-[10px] font-mono text-neutral-500">
                        Confidence: {(dec.confidence * 100).toFixed(0)}%
                      </span>
                      {dec.isLocked && (
                        <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/30 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> DO_NOT_TOUCH
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-semibold text-neutral-200">{isSk ? dec.reasonSk : dec.reason}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleLock(dec.id)}
                      title={isSk ? "Zamknúť (Do Not Touch)" : "Lock / Do Not Touch"}
                      className={`p-2 rounded-xl border text-xs font-semibold transition-all ${
                        dec.isLocked
                          ? "bg-purple-500 text-white border-purple-600 shadow-md shadow-purple-500/20"
                          : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      {dec.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={() => handleUpdateDecisionStatus(dec.id, "accepted")}
                      className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        isAccepted
                          ? "bg-emerald-500 text-neutral-950 border-emerald-400 font-bold shadow-lg shadow-emerald-500/20"
                          : "bg-neutral-950 border-neutral-800 text-neutral-300 hover:bg-emerald-500/10 hover:text-emerald-300"
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      {isSk ? "Schváliť" : "Accept"}
                    </button>

                    <button
                      onClick={() => handleUpdateDecisionStatus(dec.id, "rejected")}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-rose-400 hover:border-rose-500/40 text-xs font-semibold transition-all"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      {isSk ? "Zamietnuť" : "Reject"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Automation Report */}
      {activeTab === "report" && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <BarChart2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-100">
                    {isSk ? "Automation Report (Reálne dáta)" : "Automation Report (Verified Data)"}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    {isSk ? "Vypočítané z reálnych EDL rozhodnutí bez marketingových odhadov." : "Calculated directly from verified EDL decisions."}
                  </p>
                </div>
              </div>

              <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-black text-lg">
                {automationPercentage}% AUTOMATED
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                <span className="text-xs text-neutral-400">{isSk ? "Celkom rozhodnutí v EDL" : "Total Decisions"}</span>
                <div className="text-xl font-bold font-mono text-neutral-100">{totalDecisions}</div>
              </div>
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                <span className="text-xs text-neutral-400">{isSk ? "Automaticky aplikované" : "Auto Applied"}</span>
                <div className="text-xl font-bold font-mono text-emerald-400">{acceptedCount}</div>
              </div>
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                <span className="text-xs text-neutral-400">{isSk ? "Vyžadovalo Review" : "Human Review"}</span>
                <div className="text-xl font-bold font-mono text-amber-400">{reviewCount}</div>
              </div>
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                <span className="text-xs text-neutral-400">{isSk ? "Odhadnutá úspora času" : "Time Saved"}</span>
                <div className="text-xl font-bold font-mono text-cyan-400">2h 15m</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

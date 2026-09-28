import React, { useMemo, useState } from "react";
import {
  Sparkles,
  Scissors,
  Gauge,
  ZoomIn,
  Crop,
  Type,
  Flame,
  Star,
  Film,
  Volume2,
  Music,
  Eye,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Play,
  Loader2,
  AlertCircle,
  Download,
  GraduationCap,
  Wand2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { TrendRadar } from "./TrendRadar";

/**
 * DirectorPlanPanel — „RAW → READY" jadro OmniStrihu (Fáza F1)
 *
 * Princíp: AI IBA ROZHODUJE. Tento panel zavolá /api/director/plan, zobrazí
 * navrhnuté zásahy s odôvodnením a nechá používateľa každý schváliť, vysvetliť
 * alebo zamietnuť. Nič sa neaplikuje potichu a AI nikdy nerenderuje video.
 */

export type DirectorActionType =
  | "CUT" | "KEEP" | "SPEED" | "ZOOM" | "CROP"
  | "CAPTION" | "HOOK" | "HIGHLIGHT" | "BROLL" | "SFX" | "MUSIC";

export interface DirectorPlanItem {
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

interface DirectorPlanResponse {
  success: boolean;
  source: "gemini" | "local-fallback";
  modeLabel?: string;
  model?: string;
  plan: DirectorPlanItem[];
  summary?: string;
  /** Na čom je celý plán postavený. */
  planBasis?: "transcript" | "estimate" | "ai";
  anchoredSentences?: number;
  fallbackReason?: string;
  estimatedTimeSavedMinutes?: number;
  error?: string;
}

/** Čo sa po schválení reálne zapísalo do strihacieho jadra. */
export interface DirectorApplyReport {
  applied: { label: string; count: number }[];
  skipped: { label: string; reason: string }[];
}

interface DirectorPlanPanelProps {
  language?: string;
  /** Dĺžka naimportovaného videa v sekundách (ak je známa). */
  rawDurationSeconds?: number | null;
  onSeek?: (seconds: number) => void;
  onApplyPlan?: (accepted: DirectorPlanItem[]) => DirectorApplyReport | void;
  /** Otvorí profesionálny timeline (aby používateľ videl, čo sa zmenilo). */
  onOpenTimeline?: () => void;
}

const MODES = [
  { id: "SOCIAL", labelSk: "Retention Short", hintSk: "Reels / TikTok / Shorts" },
  { id: "ADS", labelSk: "UGC / Reklama", hintSk: "performance, hooky, CTA" },
  { id: "PODCAST", labelSk: "Podcast / Talking head", hintSk: "čistý prirodzený strih" },
  { id: "YOUTUBE", labelSk: "YouTube / Long-form", hintSk: "kapitoly, kontinuita" },
  { id: "CORPORATE", labelSk: "Firemné / Brand", hintSk: "profesionálny dojem" },
  { id: "CUSTOM", labelSk: "Vlastný štýl", hintSk: "podľa poznámok" },
];

const ACTION_META: Record<DirectorActionType, { icon: any; label: string; cls: string }> = {
  CUT: { icon: Scissors, label: "VYSTRIHNÚŤ", cls: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  KEEP: { icon: CheckCircle2, label: "PONECHAŤ", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  SPEED: { icon: Gauge, label: "ZRÝCHLIŤ", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  ZOOM: { icon: ZoomIn, label: "PUNCH-IN", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  CROP: { icon: Crop, label: "CROP / 9:16", cls: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" },
  CAPTION: { icon: Type, label: "TITULKY", cls: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  HOOK: { icon: Flame, label: "HOOK", cls: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
  HIGHLIGHT: { icon: Star, label: "HIGHLIGHT", cls: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30" },
  BROLL: { icon: Film, label: "B-ROLL", cls: "bg-teal-500/15 text-teal-300 border-teal-500/30" },
  SFX: { icon: Volume2, label: "SFX", cls: "bg-pink-500/15 text-pink-300 border-pink-500/30" },
  MUSIC: { icon: Music, label: "HUDBA", cls: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30" },
};

function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rest = (s % 60).toFixed(1).replace(".", ",");
  return `${m}:${rest.padStart(4, "0")}`;
}

function formatSaved(minutes?: number): string {
  if (!minutes || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export const DirectorPlanPanel: React.FC<DirectorPlanPanelProps> = ({
  language = "sk",
  rawDurationSeconds = null,
  onSeek,
  onApplyPlan,
  onOpenTimeline,
}) => {
  const isSk = language === "sk";

  const [mode, setMode] = useState<string>("SOCIAL");
  const [durationMin, setDurationMin] = useState<number>(
    rawDurationSeconds ? Math.max(1, Math.round(rawDurationSeconds / 60)) : 30,
  );
  const [transcript, setTranscript] = useState("");
  const [notes, setNotes] = useState("");
  const [qualityMode, setQualityMode] = useState<"PORTFOLIO" | "FAST">("PORTFOLIO");
  const [zeroToken, setZeroToken] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DirectorPlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [acceptedIds, setAcceptedIds] = useState<string[]>([]);
  const [rejectedIds, setRejectedIds] = useState<string[]>([]);
  const [openWhyId, setOpenWhyId] = useState<string | null>(null);
  const [applyReport, setApplyReport] = useState<DirectorApplyReport | null>(null);
  const [view, setView] = useState<"plan" | "trendy">("plan");
  const [learningMode, setLearningMode] = useState(true);

  const plan = result?.plan ?? [];

  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    for (const item of plan) byType[item.type] = (byType[item.type] || 0) + 1;
    return {
      total: plan.length,
      accepted: acceptedIds.length,
      rejected: rejectedIds.length,
      pending: plan.length - acceptedIds.length - rejectedIds.length,
      byType,
    };
  }, [plan, acceptedIds, rejectedIds]);

  const runDirector = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setAcceptedIds([]);
    setRejectedIds([]);
    setOpenWhyId(null);
    setApplyReport(null);

    try {
      const res = await fetch("/api/director/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          language,
          duration: Math.max(5, Math.round(durationMin * 60)),
          transcript,
          notes,
          qualityMode,
          useZeroTokenMode: zeroToken,
        }),
      });
      const data: DirectorPlanResponse = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || `Server odpovedal HTTP ${res.status}.`);
        return;
      }
      setResult(data);
      // „Použiť všetko" nie je predvolené — človek má posledné slovo.
    } catch (err: any) {
      setError(
        isSk
          ? `Nepodarilo sa spojiť so serverom (${err?.message || "neznáma chyba"}). Beží dev server?`
          : `Could not reach the server (${err?.message || "unknown error"}).`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const accept = (id: string) => {
    setAcceptedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setRejectedIds((prev) => prev.filter((x) => x !== id));
  };

  const reject = (id: string) => {
    setRejectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setAcceptedIds((prev) => prev.filter((x) => x !== id));
  };

  const acceptAll = () => {
    setAcceptedIds(plan.map((p) => p.id));
    setRejectedIds([]);
  };

  const applyPlan = () => {
    const accepted = plan.filter((p) => acceptedIds.includes(p.id));
    const report = onApplyPlan?.(accepted);
    if (report) setApplyReport(report);
  };

  const exportPlan = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      mode: result?.modeLabel || mode,
      qualityMode,
      source: result?.source,
      model: result?.model,
      accepted: plan.filter((p) => acceptedIds.includes(p.id)),
      rejected: plan.filter((p) => rejectedIds.includes(p.id)),
      proposed: plan.filter((p) => !acceptedIds.includes(p.id) && !rejectedIds.includes(p.id)),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `omnistrih-director-plan-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Hlavička */}
      <div className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-950 via-neutral-950 to-rose-950/20 p-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
            <Wand2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              {isSk ? "🎬 RAW → READY" : "🎬 RAW → READY"}
            </h3>
            <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
              {isSk
                ? "AI navrhne strih, ty ho schváliš. AI nikdy nerenderuje video — iba rozhoduje, čo urobiť."
                : "AI proposes the edit, you approve it. AI never renders — it only decides."}
            </p>
          </div>
        </div>

        {result && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span
              className={`text-[10px] font-bold px-2 py-1 rounded border ${
                result.source === "gemini"
                  ? "bg-violet-500/15 text-violet-300 border-violet-500/30"
                  : "bg-amber-500/15 text-amber-300 border-amber-500/30"
              }`}
            >
              {result.source === "gemini"
                ? `${isSk ? "AI" : "AI"} · ${result.model || "gemini"}`
                : isSk ? "OFFLINE (0 tokenov)" : "OFFLINE (0 tokens)"}
            </span>
            {typeof result.anchoredSentences === "number" && result.anchoredSentences > 0 && (
              <span className="text-[10px] px-2 py-1 rounded border bg-sky-500/10 text-sky-300 border-sky-500/30">
                {isSk
                  ? `kotvené na ${result.anchoredSentences} vetách z prepisu`
                  : `anchored on ${result.anchoredSentences} transcript lines`}
              </span>
            )}
            {result.planBasis === "estimate" && (
              <span className="text-[10px] px-2 py-1 rounded border bg-amber-500/10 text-amber-300 border-amber-500/30">
                {isSk ? "odhad — bez prepisu" : "estimate — no transcript"}
              </span>
            )}
            {result.fallbackReason && (
              <span className="text-[10px] text-neutral-500">{result.fallbackReason}</span>
            )}
          </div>
        )}
      </div>

      {/* Prepínač: plán / trend radar */}
      <div className="flex gap-1.5">
        {([
          { id: "plan" as const, labelSk: "🎬 Plán strihu" },
          { id: "trendy" as const, labelSk: "🔥 Trend Radar" },
        ]).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setView(t.id)}
            className={`px-4 py-2 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-colors ${
              view === t.id
                ? "border-rose-500/60 bg-rose-500/10 text-white"
                : "border-neutral-800 text-neutral-400 hover:border-neutral-700"
            }`}
          >
            {t.labelSk}
          </button>
        ))}
      </div>

      {view === "trendy" && (
        <TrendRadar
          language={language}
          plan={plan}
          durationSec={typeof rawDurationSeconds === "number" ? rawDurationSeconds : durationMin * 60}
          onSeek={onSeek}
        />
      )}

      {view === "plan" && (
      <>
      {/* Nastavenia */}
      <div className="space-y-3">
        <div>
          <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-2">
            {isSk ? "Režim strihu" : "Edit mode"}
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`text-left p-2.5 rounded-xl border transition-colors ${
                  mode === m.id
                    ? "border-rose-500/60 bg-rose-500/10 text-white"
                    : "border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700"
                }`}
              >
                <span className="block text-[11px] font-bold">{m.labelSk}</span>
                <span className="block text-[10px] text-neutral-500 mt-0.5">{m.hintSk}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
              {isSk ? "Dĺžka RAW (min)" : "RAW length (min)"}
            </label>
            <input
              type="number"
              min={1}
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value) || 1)}
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white focus:outline-none focus:border-rose-500/60"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
              {isSk ? "Kvalita" : "Quality"}
            </label>
            <div className="flex gap-2">
              {(["PORTFOLIO", "FAST"] as const).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQualityMode(q)}
                  className={`flex-1 px-2 py-2 rounded-lg border text-[10px] font-bold transition-colors ${
                    qualityMode === q
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                      : "border-neutral-800 bg-neutral-950 text-neutral-500"
                  }`}
                >
                  {q === "PORTFOLIO" ? (isSk ? "PORTFÓLIO" : "PORTFOLIO") : "FAST"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
            {isSk ? "Prepis / obsah videa (voliteľné)" : "Transcript / content (optional)"}
          </label>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={3}
            placeholder={
              isSk
                ? "Vlož text hovoreného slova — AI potom vie presnejšie určiť, kde má zmysel strihať a čo zvýrazniť."
                : "Paste the spoken text for more precise cuts and emphasis."
            }
            className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-rose-500/60 resize-y"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
            {isSk ? "Poznámky pre AI (voliteľné)" : "Notes for AI (optional)"}
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={isSk ? "napr. „zdôrazni cenu“, „vystrihni spomienku na psa“" : "e.g. emphasise price"}
            className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-rose-500/60"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[11px] text-neutral-400 cursor-pointer">
            <input
              type="checkbox"
              checked={learningMode}
              onChange={(e) => setLearningMode(e.target.checked)}
              className="accent-rose-500"
            />
            <GraduationCap className="h-3.5 w-3.5" />
            {isSk ? "Learning mode (vysvetľuj)" : "Learning mode"}
          </label>
          <label className="flex items-center gap-2 text-[11px] text-neutral-400 cursor-pointer">
            <input
              type="checkbox"
              checked={zeroToken}
              onChange={(e) => setZeroToken(e.target.checked)}
              className="accent-amber-500"
            />
            {isSk ? "0-token režim (offline)" : "Zero-token (offline)"}
          </label>
        </div>

        <button
          type="button"
          onClick={runDirector}
          disabled={isLoading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {isSk ? "AI pripravuje strih…" : "AI is preparing the edit…"}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {isSk ? "Spustiť RAW → READY" : "Run RAW → READY"}
            </>
          )}
        </button>
      </div>

      {/* Chyba */}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-[11px] text-red-300 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Výsledok */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {result.summary && (
              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-300">
                {result.summary}
              </div>
            )}

            {result.planBasis === "estimate" && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  {isSk
                    ? "Toto je kostra bez prepisu — časy sú orientačné a istota je nízka. Vlož text hovoreného slova vyššie a spusti znova: plán sa potom skotví na konkrétne vety (a pri každom zásahu uvidíš, ktorá veta to je)."
                    : "This is a skeleton without a transcript — times are rough. Paste the spoken text and run again to anchor the plan to real lines."}
                </span>
              </div>
            )}

            {/* Súhrn */}
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-[11px] text-neutral-400">
                    {isSk ? "Našla som" : "Found"}{" "}
                    <span className="text-white font-black">{stats.total}</span>{" "}
                    {isSk ? "úprav" : "edits"}
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    {isSk ? "Odhadovaná úspora času:" : "Estimated time saved:"}{" "}
                    <span className="text-emerald-400 font-black">
                      {formatSaved(result.estimatedTimeSavedMinutes)}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    ✓ {stats.accepted}
                  </span>
                  <span className="px-2 py-1 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                    ✕ {stats.rejected}
                  </span>
                  <span className="px-2 py-1 rounded bg-neutral-800 text-neutral-400">
                    ? {stats.pending}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  onClick={acceptAll}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider"
                >
                  {isSk ? "Použiť všetko" : "Apply all"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAcceptedIds([]);
                    setRejectedIds([]);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-bold uppercase tracking-wider"
                >
                  {isSk ? "Skontrolovať" : "Review"}
                </button>
                <button
                  type="button"
                  onClick={applyPlan}
                  disabled={stats.accepted === 0}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Play className="h-3 w-3" />
                  {isSk ? `Použiť vybrané (${stats.accepted})` : `Apply selected (${stats.accepted})`}
                </button>
                <button
                  type="button"
                  onClick={exportPlan}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Download className="h-3 w-3" />
                  {isSk ? "Export plánu" : "Export plan"}
                </button>
              </div>
            </div>

            {/* Report: čo sa reálne zapísalo do strihu */}
            {applyReport && (
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/30 space-y-2">
                <p className="text-[11px] font-black text-emerald-300 uppercase tracking-wider">
                  {isSk ? "✅ Zapísané do strihu" : "✅ Written into the edit"}
                </p>

                {applyReport.applied.length > 0 ? (
                  <ul className="space-y-1">
                    {applyReport.applied.map((a) => (
                      <li key={a.label} className="text-[11px] text-neutral-300 flex items-center justify-between gap-3">
                        <span>{a.label}</span>
                        <span className="font-mono text-emerald-400">{a.count}×</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] text-neutral-500">
                    {isSk ? "Žiadny zásah nebolo možné zapísať." : "Nothing could be written."}
                  </p>
                )}

                {applyReport.skipped.length > 0 && (
                  <div className="pt-2 border-t border-emerald-500/20 space-y-1.5">
                    {applyReport.skipped.map((sk, i) => (
                      <p key={i} className="text-[10px] text-amber-300/90 leading-relaxed">
                        ⚠️ <span className="font-bold">{sk.label}:</span> {sk.reason}
                      </p>
                    ))}
                  </div>
                )}

                {onOpenTimeline && (
                  <button
                    type="button"
                    onClick={onOpenTimeline}
                    className="mt-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider"
                  >
                    {isSk ? "Otvoriť timeline →" : "Open timeline →"}
                  </button>
                )}
              </div>
            )}

            {/* Zoznam zásahov */}
            <div className="space-y-2">
              {plan.map((item) => {
                const meta = ACTION_META[item.type];
                const Icon = meta.icon;
                const isAccepted = acceptedIds.includes(item.id);
                const isRejected = rejectedIds.includes(item.id);
                const whyOpen = openWhyId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border transition-colors ${
                      isAccepted
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : isRejected
                          ? "border-neutral-800 bg-neutral-950 opacity-50"
                          : "border-neutral-800 bg-neutral-950 hover:border-neutral-700"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`px-2 py-1 rounded border text-[9px] font-black shrink-0 flex items-center gap-1 ${meta.cls}`}>
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </div>

                      <div className="flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => onSeek?.(item.start)}
                          className="text-[11px] font-mono text-neutral-400 hover:text-white transition-colors"
                          title={isSk ? "Skočiť na tento čas" : "Seek to this time"}
                        >
                          {formatTime(item.start)}
                          {item.end !== undefined && ` – ${formatTime(item.end)}`}
                        </button>
                        <p className="text-xs text-white font-semibold mt-0.5">{item.label}</p>
                        <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">{item.reason}</p>

                        {whyOpen && learningMode && item.lesson && (
                          <div className="mt-2 p-2 rounded-lg bg-violet-500/10 border border-violet-500/30 text-[11px] text-violet-200 flex items-start gap-2">
                            <GraduationCap className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span>{item.lesson}</span>
                          </div>
                        )}

                        {whyOpen && !item.lesson && (
                          <div className="mt-2 p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-500">
                            {isSk ? "K tomuto zásahu AI neuviedla vysvetlenie." : "No explanation provided."}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => accept(item.id)}
                            className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-colors ${
                              isAccepted
                                ? "bg-emerald-600 text-white"
                                : "bg-neutral-800 text-neutral-300 hover:bg-emerald-600 hover:text-white"
                            }`}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            {isSk ? "Použiť" : "Apply"}
                          </button>
                          <button
                            type="button"
                            onClick={() => reject(item.id)}
                            className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-colors ${
                              isRejected
                                ? "bg-rose-600 text-white"
                                : "bg-neutral-800 text-neutral-300 hover:bg-rose-600 hover:text-white"
                            }`}
                          >
                            <XCircle className="h-3 w-3" />
                            {isSk ? "Zrušiť" : "Reject"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setOpenWhyId(whyOpen ? null : item.id)}
                            className="px-2 py-1 rounded bg-neutral-800 hover:bg-violet-600 text-neutral-300 hover:text-white text-[10px] font-bold flex items-center gap-1 transition-colors"
                          >
                            <HelpCircle className="h-3 w-3" />
                            {isSk ? "Prečo?" : "Why?"}
                          </button>
                          <span className="text-[9px] text-neutral-600 font-mono ml-auto flex items-center gap-1.5">
                            {item.basis && (
                              <span
                                className={`px-1.5 py-0.5 rounded border font-sans ${
                                  item.basis === "transcript"
                                    ? "bg-sky-500/10 text-sky-300 border-sky-500/30"
                                    : item.basis === "ai"
                                      ? "bg-violet-500/10 text-violet-300 border-violet-500/30"
                                      : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                                }`}
                                title={
                                  item.basis === "transcript"
                                    ? isSk ? "Kotvené na konkrétnej vete z prepisu" : "Anchored to a specific transcript line"
                                    : item.basis === "ai"
                                      ? isSk ? "Rozhodnutie AI" : "AI decision"
                                      : isSk ? "Odhad — bez prepisu" : "Estimate — no transcript"
                                }
                              >
                                {item.basis === "transcript"
                                  ? isSk ? "z prepisu" : "transcript"
                                  : item.basis === "ai"
                                    ? "AI"
                                    : isSk ? "odhad" : "estimate"}
                              </span>
                            )}
                            {isSk ? "istota" : "confidence"} {Math.round(item.confidence * 100)} %
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prázdny stav */}
      {!result && !isLoading && !error && (
        <div className="p-6 rounded-xl border border-dashed border-neutral-800 text-center">
          <Eye className="h-5 w-5 text-neutral-600 mx-auto" />
          <p className="text-[11px] text-neutral-500 mt-2 max-w-md mx-auto">
            {isSk
              ? "Vyber režim, prípadne vlož prepis, a spusti „RAW → READY“. Uvidíš zoznam navrhnutých zásahov — každý môžeš schváliť, vysvetliť alebo zamietnuť."
              : "Pick a mode, optionally paste a transcript, and run RAW → READY."}
          </p>
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default DirectorPlanPanel;

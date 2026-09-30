import React, { useMemo, useState } from "react";
import {
  Palette,
  Sparkles,
  Type as TypeIcon,
  Film,
  Image as ImageIcon,
  Mic,
  ShieldCheck,
  Play,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Copy,
  ChevronDown,
  ChevronRight,
  Pencil,
  AlertTriangle,
  Info,
  Wand2,
  Eye,
  Layers,
  Loader2,
  Ban,
} from "lucide-react";
import type { SpeechSegmentLike } from "../core/transcript/wordTiming";
import { buildStylePlan, type StylePlan } from "../core/style/styleIntelligence";
import { customRecipeFromBrief, getStyleRecipe, type StylePresetId, type StyleRecipe } from "../core/style/styleRecipes";
import { DEFAULT_STYLE_CONTROLS, type StyleControls } from "../core/style/styleDecisionTypes";
import { CanonicalExportPanel } from "./CanonicalExportPanel";
import type { ProjectModel } from "../core/types/project";
import {
  styleApplyCanRunSk,
  styleApplyReportTextSk,
  type StyleApplyReport,
  type StyleDecisionEdit,
  type StyleRollbackReport,
} from "../core/style/styleApply";
import {
  applyNoticeSk,
  applySectionNoticeSk,
  confidenceViewSk,
  consideredRowsSk,
  controlValueLabelSk,
  controlViewsSk,
  decisionRowsSk,
  emptyPlanMessageSk,
  formatRangeSk,
  generatedVisualsNoticeSk,
  kindFilterRowsSk,
  marksNoticeSk,
  missingDataNoticeSk,
  planAsTextSk,
  planBadgesSk,
  planTotalsSk,
  ratioExplanationSk,
  recipeOptionsSk,
  supportingMediaNoticeSk,
  transcriptGateSk,
  unavailableSignalsSk,
  type DecisionStatus,
} from "../core/style/styleStudioView";

/**
 * STYLE STUDIO (krok 4) — obrazovka nad hotovým deterministickým enginom (kroky 1–3).
 *
 * Čo to JE: výber receptu + ovládače + **plán s dôvodmi** (WHAT / WHEN / WHY /
 * WHEN NOT / ALTERNATIVE / CONFIDENCE).
 * Čo to NIE JE: žiadny Apply. Obrazovka **nemeni** canonical timeline, nič neukladá
 * a nič negeneruje (žiadny AI provider). Všetko, čo vidíš, je návrh z reálneho prepisu.
 */

export interface StyleStudioPanelProps {
  language?: "sk" | "en";
  /** Reálne titulky z projektu (najlepšie s časovaním po slovách). Žiadne demo dáta. */
  segments: SpeechSegmentLike[];
  /** Je v projekte nahrané video? (kvôli zneniu hlášok) */
  hasVideo?: boolean;
  /** Koľko podporných médií má používateľ reálne k dispozícii (0 = nemá). */
  availableSupportingVisuals?: number;
  onSeek?: (sec: number) => void;
  onOpenCaptions?: () => void;
  showToast?: (message: string) => void;
  /**
   * Hotový plán (napr. z testov alebo statického náhľadu). Predvolene `null` —
   * obrazovka si **nič nevymýšľa**, plán vznikne len kliknutím z reálneho prepisu.
   */
  initialPlan?: StylePlan | null;
  /**
   * APPLY (krok 5–6): skutočná zmena projektu cez existujúci CommandManager.
   * Bez tohto callbacku obrazovka **neaplikuje nič** a len to povie (statický náhľad).
   */
  /**
   * Apply. `decisionIds` = prijaté rozhodnutia, `edits` = hodnoty, ktoré si v Review
   * prepísal (Accept / Edit / Reject). Aplikujú sa len tie; nič sa nedomýšľa.
   */
  onApplyStylePlan?: (plan: StylePlan, decisionIds: string[], edits: Record<string, StyleDecisionEdit>) => StyleApplyReport | null;
  /** Rollback na verziu vytvorenú pred aplikovaním (presne pôvodný stav). */
  onRollbackStyleApply?: (report: StyleApplyReport) => StyleRollbackReport | null;
  /** Hotový report z aplikovania (pre statický náhľad a testy). */
  initialApplyReport?: StyleApplyReport | null;
  /**
   * KROK 7 — canonical náhľad a export. Bez tohto objektu obrazovka náhľad
   * ani export nezobrazí (statický náhľad nič nepredstiera).
   */
  canonicalPreviewProps?: {
    project?: ProjectModel | null;
    getProject?: () => ProjectModel | null;
    subscribeToCanonical?: (onChange: () => void) => () => void;
    currentTime: number;
    mediaUrl?: string | null;
    getSourceBlob?: () => Promise<Blob | null>;
    getAssetBlob?: (assetId: string, name: string) => Promise<Blob | null>;
  } | null;
}

const TONE_CLASS: Record<string, string> = {
  ok: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  warn: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  info: "bg-neutral-800 text-neutral-300 border-neutral-700",
  danger: "bg-rose-500/10 text-rose-300 border-rose-500/30",
};

function Badge({ label, tone }: { label: string; tone: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase tracking-wide ${TONE_CLASS[tone] ?? TONE_CLASS.info}`}>
      {label}
    </span>
  );
}

export function StyleStudioPanel({
  language = "sk",
  segments,
  hasVideo = false,
  availableSupportingVisuals,
  onSeek,
  onOpenCaptions,
  showToast,
  initialPlan = null,
  onApplyStylePlan,
  onRollbackStyleApply,
  initialApplyReport = null,
  canonicalPreviewProps = null,
}: StyleStudioPanelProps) {
  const isSk = language === "sk";

  const [recipeId, setRecipeId] = useState<StylePresetId>("EDITORIAL_COLLAGE");
  const [controls, setControls] = useState<StyleControls>({ ...DEFAULT_STYLE_CONTROLS });
  const [brief, setBrief] = useState<string>("");
  const [customPreview, setCustomPreview] = useState<ReturnType<typeof customRecipeFromBrief> | null>(null);
  const [plan, setPlan] = useState<StylePlan | null>(initialPlan);
  const [marks, setMarks] = useState<Record<string, DecisionStatus>>({});
  // Review: hodnoty, ktoré človek prepísal (krok 16). Prázdne = nič sa needituje.
  const [edits, setEdits] = useState<Record<string, StyleDecisionEdit>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showConsidered, setShowConsidered] = useState(false);
  const [computing, setComputing] = useState(false);
  const [consent, setConsent] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyReport, setApplyReport] = useState<StyleApplyReport | null>(initialApplyReport);
  const [rollbackReport, setRollbackReport] = useState<StyleRollbackReport | null>(null);

  const wordCount = useMemo(
    () => segments.reduce((sum, s) => sum + (Array.isArray(s.words) ? s.words.length : 0), 0),
    [segments],
  );

  const gate = useMemo(() => transcriptGateSk(segments.length, wordCount, hasVideo), [segments.length, wordCount, hasVideo]);
  const recipeOptions = useMemo(() => recipeOptionsSk(), []);
  const controlViews = useMemo(() => controlViewsSk(), []);

  const activeRecipe: StyleRecipe = useMemo(() => {
    if (recipeId === "CUSTOM") return customPreview?.recipe ?? getStyleRecipe("CUSTOM");
    return getStyleRecipe(recipeId);
  }, [recipeId, customPreview]);

  /** Výpočet je lokálny a rýchly (deterministický engine, žiadne API). */
  const compute = () => {
    if (!gate.ready) return;
    setComputing(true);
    // malé odloženie, aby tlačidlo stihlo ukázať stav (výpočet sám je okamžitý)
    setTimeout(() => {
      const next = buildStylePlan({
        segments,
        recipe: activeRecipe,
        durationSec: segments.reduce((max, s) => Math.max(max, Number(s.end) || 0), 0),
        controls,
        availableSupportingVisuals,
      });
      setPlan(next);
      setMarks({});
      setComputing(false);
      setKindFilter(null);
    }, 30);
  };

  const rows = useMemo(() => (plan ? decisionRowsSk(plan, marks) : []), [plan, marks]);
  const visibleRows = useMemo(
    () => (kindFilter ? rows.filter((r) => r.kind === kindFilter) : rows),
    [rows, kindFilter],
  );
  const considered = useMemo(() => (plan ? consideredRowsSk(plan) : []), [plan]);
  const totals = useMemo(() => (plan ? planTotalsSk(plan) : []), [plan]);
  const badges = useMemo(() => (plan ? planBadgesSk(plan, marks) : []), [plan, marks]);
  const ratioInfo = useMemo(() => (plan ? ratioExplanationSk(plan) : null), [plan]);
  const missingNotice = useMemo(() => (plan ? missingDataNoticeSk(plan) : null), [plan]);
  const emptyMessage = useMemo(() => emptyPlanMessageSk(plan), [plan]);
  const filters = useMemo(() => (plan ? kindFilterRowsSk(plan) : []), [plan]);
  const unavailable = useMemo(() => unavailableSignalsSk(), []);

  const setControl = <K extends keyof StyleControls>(key: K, value: StyleControls[K]) => {
    setControls((prev) => ({ ...prev, [key]: value }));
  };

  const mark = (id: string, status: DecisionStatus) => {
    setMarks((prev) => ({ ...prev, [id]: prev[id] === status ? "proposed" : status }));
  };

  const selectedIds = useMemo(
    () => rows.filter((r) => marks[r.id] === "accepted").map((r) => r.id),
    [rows, marks],
  );
  const gateApply = useMemo(() => styleApplyCanRunSk(plan, selectedIds.length, consent), [plan, selectedIds.length, consent]);

  const runApply = (ids: string[]) => {
    if (!plan || !onApplyStylePlan) return;
    setApplying(true);
    try {
      const report = onApplyStylePlan(plan, ids, edits);
      setApplyReport(report);
      setRollbackReport(null);
      if (report?.ok) {
        showToast?.(
          isSk
            ? `✅ Aplikované: ${report.appliedCount} zmenené, ${report.honoredCount} dodržané, ${report.skippedCount} nevykonané. Verzia na vrátenie: ${report.snapshotVersionId?.slice(0, 10) ?? "—"}`
            : `✅ Applied.`,
        );
      } else if (report) {
        showToast?.(isSk ? `⛔ Neaplikované: ${report.errorSk}` : "⛔ Not applied.");
      }
    } finally {
      setApplying(false);
    }
  };

  const runRollback = () => {
    if (!applyReport || !onRollbackStyleApply) return;
    const res = onRollbackStyleApply(applyReport);
    setRollbackReport(res);
    showToast?.(
      res?.ok
        ? isSk
          ? res.restoredExactly
            ? "↩️ Vrátené presne do stavu pred aplikovaním."
            : "↩️ Verzia obnovená, ale stav sa líši — skontroluj to."
          : "↩️ Rollback zlyhal."
        : "↩️ Rollback nedostupný.",
    );
  };

  const copyApplyReport = async () => {
    if (!applyReport) return;
    try {
      await navigator.clipboard.writeText(styleApplyReportTextSk(applyReport));
      showToast?.(isSk ? "📋 Report z aplikovania skopírovaný." : "📋 Report copied.");
    } catch {
      showToast?.(isSk ? "Kopírovanie nedostupné." : "Clipboard unavailable.");
    }
  };

  const copyPlan = async () => {
    if (!plan) return;
    const text = planAsTextSk(plan);
    try {
      await navigator.clipboard.writeText(text);
      showToast?.(isSk ? "📋 Plán skopírovaný ako text (do videa sa nič nezapísalo)." : "📋 Plan copied as text.");
    } catch {
      showToast?.(isSk ? "Kopírovanie nedostupné — text plánu je v poznámkach nižšie." : "Clipboard unavailable.");
    }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-neutral-950/40">
      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {/* Hlavička */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 border border-rose-500/30 flex items-center justify-center">
                <Palette className="w-5 h-5 text-rose-300" />
              </div>
              <div>
                <h2 className="text-sm font-black text-white uppercase tracking-wide">
                  {isSk ? "Style Studio — vizuálny štýl" : "Style Studio — visual style"}
                </h2>
                <p className="text-[11px] text-neutral-400">
                  {isSk
                    ? "Recept → analýza reči → plán s dôvodmi. Bez AI providera, bez zmien v projekte."
                    : "Recipe → speech analysis → plan with reasons. No AI provider, no project changes."}
                </p>
              </div>
            </div>
            {plan && (
              <div className="flex flex-wrap items-center gap-1.5">
                {badges.map((b) => (
                  <Badge key={b.labelSk} label={b.labelSk} tone={b.tone} />
                ))}
              </div>
            )}
          </div>

          {/* Viditeľná poctivosť */}
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-100/90">{applyNoticeSk()}</p>
            </div>
            <div className="flex items-start gap-2 rounded-xl border border-neutral-800 bg-neutral-900/60 p-2.5">
              <Info className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-neutral-400">
                {generatedVisualsNoticeSk()} {supportingMediaNoticeSk(availableSupportingVisuals)}
              </p>
            </div>
          </div>
        </div>

        {/* Brána: mám dáta? */}
        <div className={`rounded-2xl border p-4 ${gate.ready ? "border-neutral-800 bg-neutral-900/60" : "border-rose-500/30 bg-rose-500/5"}`}>
          <div className="flex items-start gap-3">
            {gate.ready ? (
              <ShieldCheck className="w-5 h-5 text-emerald-300 mt-0.5 shrink-0" />
            ) : (
              <Ban className="w-5 h-5 text-rose-300 mt-0.5 shrink-0" />
            )}
            <div className="space-y-1">
              <p className="text-xs font-bold text-white">{gate.titleSk}</p>
              <p className="text-[11px] text-neutral-400 leading-relaxed">{gate.bodySk}</p>
              <div className="pt-1 space-y-0.5">
                <p className="text-[10px] font-bold uppercase text-neutral-500">
                  {isSk ? "Tieto dáta appka nemá (preto podľa nich nerozhodujem)" : "Signals not available"}
                </p>
                {unavailable.map((u) => (
                  <p key={u} className="text-[10px] text-neutral-500">
                    – {u}
                  </p>
                ))}
              </div>
              {!gate.ready && gate.actionSk && onOpenCaptions && (
                <button
                  onClick={onOpenCaptions}
                  className="mt-2 px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-[11px] font-bold"
                >
                  {gate.actionSk}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Recepty */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-neutral-400" />
            <h3 className="text-xs font-black text-white uppercase tracking-wide">
              {isSk ? "1. Recept (štýl, ktorý chceš)" : "1. Recipe"}
            </h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {recipeOptions.map((r) => (
              <button
                key={r.id}
                onClick={() => setRecipeId(r.id)}
                className={`text-left p-2.5 rounded-xl border transition-all ${
                  recipeId === r.id
                    ? "border-rose-500/60 bg-rose-500/10"
                    : "border-neutral-800 bg-neutral-900/60 hover:border-neutral-700"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black text-white">{r.labelSk}</span>
                  <span className="text-[9px] font-bold text-neutral-500 uppercase">{r.id}</span>
                </div>
                <p className="text-[10px] text-neutral-400 mt-1 leading-snug">{r.purposeSk}</p>
                <p className="text-[10px] text-neutral-500 mt-1.5 font-mono">{r.ratioSk}</p>
                <p className="text-[9px] text-neutral-500 mt-1">{r.summarySk}</p>
              </button>
            ))}
          </div>

          {recipeId === "CUSTOM" && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 space-y-2">
              <label className="text-[11px] font-bold text-neutral-300">
                {isSk ? "Popíš štýl vlastnými slovami (prekladám deterministicky, nič nedomýšľam)" : "Describe the style"}
              </label>
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={2}
                placeholder={isSk ? "napr. editorial koláž, stop motion 12 fps, halftone, farby #0A3D91 a #FFC400" : "e.g. editorial collage, stop motion 12 fps"}
                className="w-full rounded-xl bg-neutral-950 border border-neutral-800 p-2 text-[11px] text-neutral-200 outline-none focus:border-rose-500/50"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setCustomPreview(customRecipeFromBrief(brief))}
                  className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-[11px] font-bold flex items-center gap-1.5"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  {isSk ? "Preložiť brief na nastavenia" : "Translate brief"}
                </button>
                {customPreview && (
                  <span className="text-[10px] text-neutral-400">
                    {isSk ? "Rozpoznané" : "Recognized"}: {customPreview.recognized.length}
                    {customPreview.unrecognizedSk.length > 0 &&
                      ` · ${isSk ? "nerozpoznané" : "unrecognized"}: ${customPreview.unrecognizedSk.slice(0, 6).join(", ")}`}
                  </span>
                )}
              </div>
              {customPreview && (
                <div className="space-y-1">
                  <p className="text-[10px] text-neutral-300">{customPreview.noteSk}</p>
                  <div className="flex flex-wrap gap-1">
                    {customPreview.recognized.map((m) => (
                      <Badge key={m.keyword + m.meaningSk} label={m.meaningSk} tone="ok" />
                    ))}
                    {customPreview.unrecognizedSk.slice(0, 8).map((w) => (
                      <Badge key={w} label={`? ${w}`} tone="warn" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ovládače */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <TypeIcon className="w-4 h-4 text-neutral-400" />
            <h3 className="text-xs font-black text-white uppercase tracking-wide">
              {isSk ? "2. Ovládače (ty rozhoduješ, engine poslúcha)" : "2. Controls"}
            </h3>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {controlViews.map((view) => (
              <div key={view.key} className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-white">{view.labelSk}</span>
                  <span className="text-[10px] font-mono text-neutral-400">{controlValueLabelSk(view, controls)}</span>
                </div>

                {view.kind === "segmented" && (
                  <div className="flex flex-wrap gap-1.5">
                    {view.options.map((o) => {
                      const active = String(controls[view.key]) === o.value;
                      return (
                        <button
                          key={o.value}
                          onClick={() => setControl(view.key, o.value as never)}
                          title={o.hintSk}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                            active
                              ? "border-rose-500/60 bg-rose-500/15 text-white"
                              : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white"
                          }`}
                        >
                          {o.labelSk}
                        </button>
                      );
                    })}
                  </div>
                )}

                {view.kind === "slider" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={view.min * 100}
                        max={view.max * 100}
                        step={view.step * 100}
                        value={Math.round((controls.talkingHeadRatio ?? 0.5) * 100)}
                        disabled={controls.talkingHeadRatio === null}
                        onChange={(e) => setControl("talkingHeadRatio", Number(e.target.value) / 100)}
                        className="flex-1 accent-rose-500"
                      />
                      <button
                        onClick={() => setControl("talkingHeadRatio", controls.talkingHeadRatio === null ? 0.5 : null)}
                        className="px-2 py-1 rounded-lg border border-neutral-800 text-[10px] font-bold text-neutral-300 hover:text-white flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        {controls.talkingHeadRatio === null ? view.autoLabelSk : "auto"}
                      </button>
                    </div>
                  </div>
                )}

                {view.kind === "protected" && (
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      {view.lockedSk}
                    </span>
                  </div>
                )}

                <p className="text-[10px] text-neutral-500 leading-snug">{view.hintSk}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap pt-1">
            <button
              onClick={compute}
              disabled={!gate.ready || computing}
              className={`px-4 py-2 rounded-xl text-[11px] font-black flex items-center gap-2 ${
                !gate.ready
                  ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                  : "bg-rose-500 hover:bg-rose-400 text-white"
              }`}
            >
              {computing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {isSk ? "Vypočítať návrh (lokálne, bez AI)" : "Compute plan (local, no AI)"}
            </button>
            {plan && (
              <>
                <button
                  onClick={copyPlan}
                  className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-[11px] font-bold flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {isSk ? "Skopírovať plán ako text" : "Copy plan as text"}
                </button>
                <button
                  onClick={compute}
                  className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-[11px] font-bold flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {isSk ? "Prepočítať" : "Recompute"}
                </button>
                <span className="text-[10px] text-neutral-500">
                  {marksNoticeSk()}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Plán */}
        {plan && (
          <>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-neutral-400" />
                <h3 className="text-xs font-black text-white uppercase tracking-wide">
                  {isSk ? "3. Plán — čo, kedy, prečo (a kedy nie)" : "3. Plan"}
                </h3>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {totals.map((t) => (
                  <div key={t.labelSk} className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-2.5">
                    <p className="text-[10px] uppercase tracking-wide text-neutral-500 font-bold">{t.labelSk}</p>
                    <p className="text-[11px] text-neutral-200 mt-0.5">{t.valueSk}</p>
                  </div>
                ))}
              </div>

              {ratioInfo && (
                <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3 space-y-1">
                  <p className="text-[11px] font-bold text-white">{ratioInfo.headlineSk}</p>
                  {ratioInfo.linesSk.map((l) => (
                    <p key={l} className="text-[10px] text-neutral-400">
                      • {l}
                    </p>
                  ))}
                </div>
              )}

              <div className="space-y-1">
                {plan.notesSk.map((n) => (
                  <p key={n} className="text-[10px] text-neutral-400">
                    • {n}
                  </p>
                ))}
                {missingNotice && <p className="text-[10px] text-amber-300/90">• {missingNotice}</p>}
                {emptyMessage && <p className="text-[11px] text-amber-300">{emptyMessage}</p>}
              </div>

              {filters.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    onClick={() => setKindFilter(null)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                      kindFilter === null ? "border-rose-500/60 bg-rose-500/15 text-white" : "border-neutral-800 text-neutral-400"
                    }`}
                  >
                    {isSk ? `Všetko (${rows.length})` : `All (${rows.length})`}
                  </button>
                  {filters.map((f) => (
                    <button
                      key={f.kind}
                      onClick={() => setKindFilter(f.kind)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                        kindFilter === f.kind
                          ? "border-rose-500/60 bg-rose-500/15 text-white"
                          : "border-neutral-800 text-neutral-400 hover:text-white"
                      }`}
                    >
                      {f.emoji} {f.labelSk} ({f.count})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Rozhodnutia */}
            <div className="space-y-2">
              {visibleRows.map((r) => {
                const conf = confidenceViewSk(r.confidencePct / 100);
                const isOpen = expanded[r.id] ?? false;
                return (
                  <div key={r.id} className={`rounded-2xl border bg-neutral-900/60 ${r.accentClass}`}>
                    <div className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-black ${r.accentClass}`}>
                            {r.kindEmoji} {r.kindLabelSk}
                          </span>
                          <span className="text-[10px] font-mono text-neutral-300">{r.whenLabelSk}</span>
                          <span className="text-[10px] text-neutral-500">{r.targetLabelSk}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge label={conf.labelSk} tone={conf.tone} />
                          <Badge label={r.statusSk} tone={r.statusTone} />
                        </div>
                      </div>

                      <p className="text-[11px] text-white font-bold leading-snug">{r.whatSk}</p>
                      <p className="text-[11px] text-neutral-300 leading-snug">
                        <span className="font-bold text-neutral-400">PREČO: </span>
                        {r.whySk}
                      </p>

                      {r.textSk && (
                        <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-2">
                          <p className="text-[10px] text-fuchsia-200/80 font-bold uppercase">Text v obraze (doslovne z vety)</p>
                          <p className="text-[12px] text-white font-black">{r.textSk}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {onSeek && (
                          <button
                            onClick={() => onSeek(r.startSec)}
                            className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-[10px] font-bold flex items-center gap-1"
                            title={isSk ? "Presunie prehrávač na túto vetu (nič nemení)" : "Seek"}
                          >
                            <Play className="w-3 h-3" />
                            {isSk ? "Skontrolovať v obraze" : "Check in player"}
                          </button>
                        )}
                        <button
                          onClick={() => mark(r.id, "accepted")}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                            marks[r.id] === "accepted" ? "bg-emerald-500 text-white" : "bg-neutral-800 hover:bg-neutral-700 text-emerald-300"
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {isSk ? "Súhlasím" : "Accept"}
                        </button>
                        <button
                          onClick={() => mark(r.id, "rejected")}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                            marks[r.id] === "rejected" ? "bg-rose-500 text-white" : "bg-neutral-800 hover:bg-neutral-700 text-rose-300"
                          }`}
                        >
                          <XCircle className="w-3 h-3" />
                          {isSk ? "Zamietnuť" : "Reject"}
                        </button>
                        <button
                          onClick={() => setEditingId((prev) => (prev === r.id ? null : r.id))}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                            edits[r.id] ? "bg-sky-500 text-white" : "bg-neutral-800 hover:bg-neutral-700 text-sky-300"
                          }`}
                          title={
                            isSk
                              ? "Upraví hodnoty pred aplikovaním (text, priblíženie, pohyb). Čas sa needituje — pochádza z reálneho prepisu."
                              : "Edit values before apply."
                          }
                        >
                          <Pencil className="w-3 h-3" />
                          {edits[r.id] ? (isSk ? "Upravené" : "Edited") : isSk ? "Upraviť" : "Edit"}
                        </button>
                        <button
                          onClick={() => setExpanded((prev) => ({ ...prev, [r.id]: !isOpen }))}
                          className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-bold flex items-center gap-1"
                        >
                          {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          {isSk ? "Detaily a dôkazy" : "Details"}
                        </button>
                      </div>


                      {editingId === r.id && (
                        <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 space-y-2">
                          <p className="text-[10px] font-black uppercase text-sky-300">
                            {isSk ? "Upraviť pred aplikovaním" : "Edit before apply"}
                          </p>
                          <p className="text-[10px] text-neutral-400">
                            {isSk
                              ? "Zmení sa len to, čo tu prepíšeš. Čas (kedy) sa needituje — pochádza z reálneho prepisu, nie z odhadu."
                              : "Only what you change here is applied."}
                          </p>
                          {r.kind === "typography" && (
                            <label className="block">
                              <span className="text-[10px] text-neutral-300 font-bold">{isSk ? "Text v obraze" : "On-screen text"}</span>
                              <input
                                type="text"
                                value={edits[r.id]?.typographyText ?? r.textSk ?? ""}
                                onChange={(e) => setEdits((prev) => ({ ...prev, [r.id]: { ...prev[r.id], typographyText: e.target.value } }))}
                                className="mt-1 w-full rounded-lg bg-neutral-900 border border-neutral-700 px-2 py-1.5 text-[11px] text-white"
                              />
                            </label>
                          )}
                          {r.kind === "motion" && (
                            <label className="block">
                              <span className="text-[10px] text-neutral-300 font-bold">
                                {isSk ? "Priblíženie (%)" : "Punch-in (%)"}
                              </span>
                              <input
                                type="number"
                                min={100}
                                max={160}
                                step={1}
                                value={Math.round((edits[r.id]?.punchInScale ?? 1.12) * 100)}
                                onChange={(e) =>
                                  setEdits((prev) => ({
                                    ...prev,
                                    [r.id]: { ...prev[r.id], punchInScale: Number(e.target.value) / 100 },
                                  }))
                                }
                                className="mt-1 w-28 rounded-lg bg-neutral-900 border border-neutral-700 px-2 py-1.5 text-[11px] text-white"
                              />
                              <span className="ml-2 text-[10px] text-neutral-500">{isSk ? "rozsah 100–160 %" : "range 100–160 %"}</span>
                            </label>
                          )}
                          {r.kind === "supporting_visual" && (
                            <label className="block">
                              <span className="text-[10px] text-neutral-300 font-bold">{isSk ? "Typ prvku (len z existujúcich médií)" : "Element type"}</span>
                              <select
                                value={edits[r.id]?.elementType ?? "existing_media"}
                                onChange={(e) =>
                                  setEdits((prev) => ({
                                    ...prev,
                                    [r.id]: { ...prev[r.id], elementType: e.target.value as StyleDecisionEdit["elementType"] },
                                  }))
                                }
                                className="mt-1 w-full rounded-lg bg-neutral-900 border border-neutral-700 px-2 py-1.5 text-[11px] text-white"
                              >
                                <option value="existing_media">{isSk ? "Existujúce médium" : "Existing media"}</option>
                                <option value="photo">{isSk ? "Fotografia (z tvojich médií)" : "Photo"}</option>
                                <option value="diagram">{isSk ? "Diagram (z tvojich médií)" : "Diagram"}</option>
                                <option value="illustration">{isSk ? "Ilustrácia (z tvojich médií)" : "Illustration"}</option>
                              </select>
                              <span className="text-[10px] text-amber-300/80">
                                {isSk
                                  ? "Generované obrázky sa nedajú vybrať — appka nemá provider a nič nepredstiera."
                                  : "Generated visuals unavailable (no provider)."}
                              </span>
                            </label>
                          )}
                          <label className="block">
                            <span className="text-[10px] text-neutral-300 font-bold">{isSk ? "Tvoja poznámka (nepovinná)" : "Your note"}</span>
                            <input
                              type="text"
                              value={edits[r.id]?.noteSk ?? ""}
                              onChange={(e) => setEdits((prev) => ({ ...prev, [r.id]: { ...prev[r.id], noteSk: e.target.value } }))}
                              className="mt-1 w-full rounded-lg bg-neutral-900 border border-neutral-700 px-2 py-1.5 text-[11px] text-white"
                            />
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                mark(r.id, "accepted");
                                setEditingId(null);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold"
                            >
                              {isSk ? "Uložiť a prijať" : "Save & accept"}
                            </button>
                            <button
                              onClick={() => {
                                setEdits((prev) => {
                                  const next = { ...prev };
                                  delete next[r.id];
                                  return next;
                                });
                                setEditingId(null);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-bold"
                            >
                              {isSk ? "Zrušiť úpravu" : "Discard edit"}
                            </button>
                          </div>
                        </div>
                      )}

                      {isOpen && (
                        <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3 space-y-2">
                          <p className="text-[11px] text-neutral-300">
                            <span className="font-bold text-amber-300">KEDY NIE: </span>
                            {r.whenNotSk || "—"}
                          </p>
                          <p className="text-[11px] text-neutral-300">
                            <span className="font-bold text-sky-300">ALTERNATÍVA: </span>
                            {r.alternativeSk || "—"}
                          </p>
                          {r.evidenceSk.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold uppercase text-neutral-500">Na čom to stojí</p>
                              <ul className="mt-0.5 space-y-0.5">
                                {r.evidenceSk.map((e) => (
                                  <li key={e} className="text-[10px] text-neutral-400">
                                    – {e}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {r.signalsSk.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {r.signalsSk.map((s) => (
                                <span key={s} className="px-1.5 py-0.5 rounded-md bg-neutral-800 text-[9px] font-mono text-neutral-400">
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {visibleRows.length === 0 && (
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 text-[11px] text-neutral-400">
                  {isSk ? "V tomto filtri nie sú žiadne rozhodnutia." : "No decisions in this filter."}
                </div>
              )}
            </div>

            {/* 4. Apply (krok 5–6) */}
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-neutral-400" />
                <h3 className="text-xs font-black text-white uppercase tracking-wide">
                  {isSk ? "4. Aplikovať do projektu (snapshot → CommandManager)" : "4. Apply"}
                </h3>
              </div>

              {!onApplyStylePlan ? (
                <p className="text-[11px] text-amber-300/90">{applySectionNoticeSk(false)}</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setMarks(Object.fromEntries(rows.map((r) => [r.id, "accepted" as DecisionStatus])))}
                      className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-[11px] font-bold"
                    >
                      {isSk ? `Vybrať všetky (${rows.length})` : "Select all"}
                    </button>
                    <button
                      onClick={() => setMarks({})}
                      className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-bold"
                    >
                      {isSk ? "Zrušiť označenie" : "Clear"}
                    </button>
                    <span className="text-[10px] text-neutral-400">
                      {isSk ? "Vybrané na aplikovanie" : "Selected"}: <b className="text-white">{selectedIds.length}</b> / {rows.length}
                    </span>
                  </div>

                  <label className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-0.5 accent-rose-500"
                    />
                    <span className="text-[11px] text-amber-100/90">
                      {isSk
                        ? "Rozumiem: aplikovaním sa zmení projekt (pribudnú klipy/markery a rozhodnutia). Najprv vznikne verzia, takže sa to dá vrátiť."
                        : "I understand: applying changes the project."}
                    </span>
                  </label>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => runApply(selectedIds)}
                      disabled={!gateApply.ready || applying}
                      className={`px-4 py-2 rounded-xl text-[11px] font-black flex items-center gap-2 ${
                        gateApply.ready ? "bg-rose-500 hover:bg-rose-400 text-white" : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                      }`}
                    >
                      {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      {isSk ? "Aplikovať vybrané" : "Apply selected"}
                    </button>
                    {applyReport && (
                      <>
                        <button
                          onClick={copyApplyReport}
                          className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-[11px] font-bold flex items-center gap-1.5"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          {isSk ? "Skopírovať report" : "Copy report"}
                        </button>
                        {onRollbackStyleApply && applyReport.snapshotVersionId && (
                          <button
                            onClick={runRollback}
                            className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-amber-300 text-[11px] font-bold flex items-center gap-1.5"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            {isSk ? "Vrátiť späť (rollback)" : "Rollback"}
                          </button>
                        )}
                      </>
                    )}
                    {!gateApply.ready && (
                      <span className="text-[10px] text-neutral-500">{gateApply.reasonSk}</span>
                    )}
                  </div>

                  {applyReport && (
                    <div className={`rounded-xl border p-3 space-y-2 ${applyReport.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/40 bg-rose-500/10"}`}>
                      <p className="text-[11px] font-bold text-white">
                        {applyReport.ok
                          ? isSk
                            ? `Aplikované: ${applyReport.appliedCount} · dodržané: ${applyReport.honoredCount} · nevykonané: ${applyReport.skippedCount}`
                            : "Applied"
                          : `⛔ ${applyReport.errorSk}`}
                      </p>
                      {applyReport.ok && (
                        <div className="grid gap-1 sm:grid-cols-2 text-[10px] text-neutral-300">
                          <p>• {isSk ? "Časová os zmenená" : "Timeline changed"}: <b>{applyReport.timelineChanged ? (isSk ? "áno" : "yes") : isSk ? "nie" : "no"}</b></p>
                          <p>• {isSk ? "Verzia pred zmenou" : "Snapshot"}: <b className="font-mono">{applyReport.snapshotVersionId?.slice(0, 14)}</b></p>
                          <p>
                            • {isSk ? "Klipy pred → po" : "Clips"}: {applyReport.before.videoClips}/{applyReport.before.brollClips}/{applyReport.before.captionClips} → {applyReport.after.videoClips}/{applyReport.after.brollClips}/{applyReport.after.captionClips}
                          </p>
                          <p>• {isSk ? "Markery" : "Markers"}: {applyReport.before.markers} → {applyReport.after.markers}</p>
                          <p className={applyReport.audioPreserved ? "text-emerald-300" : "text-rose-300"}>
                            • {isSk ? "Audio" : "Audio"}: {applyReport.audioPreserved ? "NEDOTKNUTÉ" : "ZMENA"}
                          </p>
                          <p>• {isSk ? "Provider" : "Provider"}: {applyReport.provider === "NONE" ? (isSk ? "žiadny (lokálne)" : "none") : applyReport.provider}</p>
                        </div>
                      )}
                      {applyReport.ok && (
                        <div className="space-y-1 max-h-56 overflow-y-auto custom-scrollbar">
                          {applyReport.steps.map((st) => (
                            <div key={st.decisionId} className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-2">
                              <p className="text-[10px] font-bold text-neutral-300">
                                {st.status === "APPLIED" ? "✅" : st.status === "HONORED" ? "🛡️" : "⏭️"} {st.kind} — {st.statusLabelSk}
                              </p>
                              <p className="text-[10px] text-neutral-400">{st.whatSk}</p>
                              {st.status !== "APPLIED" && <p className="text-[10px] text-neutral-500">{st.reasonSk}</p>}
                              {st.alreadyApplied && <p className="text-[10px] text-emerald-300/80">{isSk ? "efekt v projekte už existoval z predošlého aplikovania" : "already applied"}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                      {rollbackReport && (
                        <p className={`text-[11px] font-bold ${rollbackReport.restoredExactly ? "text-emerald-300" : "text-amber-300"}`}>
                          {rollbackReport.ok
                            ? rollbackReport.restoredExactly
                              ? isSk
                                ? "↩️ Vrátené presne do stavu pred aplikovaním (obrazy, markery aj rozhodnutia)."
                                : "↩️ Restored exactly."
                              : isSk
                                ? "↩️ Verzia obnovená, ale stav sa líši — skontroluj to."
                                : "↩️ Restored, but state differs."
                            : `⛔ ${rollbackReport.errorSk}`}
                        </p>
                      )}
                    </div>
                  )}

                  <p className="text-[10px] text-neutral-500">{applySectionNoticeSk(true)}</p>
                </>
              )}
            </div>

            {/* Canonical náhľad + export (krok 7) — jedna os pre náhľad aj export */}
            {canonicalPreviewProps && (
              <CanonicalExportPanel
                language={language}
                project={canonicalPreviewProps.project ?? null}
                getProject={canonicalPreviewProps.getProject}
                subscribeToCanonical={canonicalPreviewProps.subscribeToCanonical}
                currentTime={canonicalPreviewProps.currentTime}
                mediaUrl={canonicalPreviewProps.mediaUrl}
                getSourceBlob={canonicalPreviewProps.getSourceBlob}
                getAssetBlob={canonicalPreviewProps.getAssetBlob}
                showToast={showToast}
                // KROK 24 — z vybraného štýlu berieme NAMERANÉ svetlo jeho videa.
                styleRecipeId={recipeId}
                referenceLight={
                  activeRecipe.measuredLight
                    ? {
                        brightness: activeRecipe.measuredLight.brightness,
                        contrast: activeRecipe.measuredLight.contrast,
                        sourceSk: activeRecipe.measuredLight.sourceSk,
                      }
                    : null
                }
              />
            )}

            {/* Čo engine zvážil a nevybral */}
            {considered.length > 0 && (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-2">
                <button
                  onClick={() => setShowConsidered((v) => !v)}
                  className="flex items-center gap-2 text-xs font-black text-white uppercase tracking-wide"
                >
                  {showConsidered ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  {isSk ? `Čo som zvážil a nevybral (${considered.length})` : `Considered but not chosen (${considered.length})`}
                </button>
                {showConsidered && (
                  <div className="space-y-1.5">
                    {considered.map((c, i) => (
                      <div key={`${c.kindLabelSk}-${i}`} className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-2.5">
                        <p className="text-[10px] font-bold text-neutral-400">
                          {c.emoji} {c.kindLabelSk} · {isSk ? "skóre" : "score"} {c.scoreLabelSk}
                        </p>
                        <p className="text-[10px] text-neutral-400 mt-0.5">{c.reasonSk}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Päta */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-2">
          <p className="text-[11px] text-neutral-300 font-bold flex items-center gap-2">
            <Info className="w-4 h-4 text-neutral-400" />
            {isSk ? "Čo tu (zatiaľ) NIE JE" : "What is NOT here yet"}
          </p>
          <ul className="text-[10px] text-neutral-400 space-y-1">
            <li>• {isSk ? "Náhľad videa s aplikovanými zmenami a export z tej istej časovej osi → krok 7 (dnes neexistuje jeden render path pre preview aj export)." : "Preview/export from the same timeline → step 7."}</li>
            <li>• {isSk ? "Hromadné schvaľovanie a review workflow pre klienta → krok 7." : "Review workflow → step 7."}</li>
            <li>• {isSk ? "Generované vizuály a analýza referenčného obrázka → PROVIDER UNAVAILABLE, kým nie je reálny provider." : "Generated visuals → PROVIDER UNAVAILABLE."}</li>
            <li>• {isSk ? "Ručné doladenie časov jednotlivých rozhodnutí → príde s napojením na timeline." : "Manual fine-tuning → with timeline wiring."}</li>
          </ul>
          <div className="flex items-center gap-2 pt-1">
            <Film className="w-3.5 h-3.5 text-neutral-500" />
            <ImageIcon className="w-3.5 h-3.5 text-neutral-500" />
            <Mic className="w-3.5 h-3.5 text-neutral-500" />
            <span className="text-[10px] text-neutral-500">
              {isSk
                ? "Obraz, médiá aj zvuk zostávajú v tvojich rukách — tento krok nič nemení."
                : "Picture, media and audio stay untouched."}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StyleStudioPanel;

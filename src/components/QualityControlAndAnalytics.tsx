/**
 * QC — KONTROLA KVALITY (poctivo)
 *
 * Tento panel NIKDY nezobrazí „PASS“, ktorý nemá meranie.
 * Zdroj pravdy je canonical časová os (`coreEngine.getProject()`), ktorá sa meria
 * modulom `src/core/qc/qcMeasure.ts`. Kontroly, ktoré meranie nemajú, sú
 * `NOT_VERIFIED` — s dôvodom, prečo meranie chýba.
 *
 * História: pôvodná verzia tohto panelu obsahovala simuláciu („stress test“,
 * ktorý nastavil všetko na PASS, vymyslené hodnoty LUFS, vymyslené snímky
 * a súbor 742 s / 154,8 MB). To bolo odstránené — pozri
 * `docs/CREATIVE_DIRECTOR_INTELLIGENCE_REPORT.md`, časť B a R.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  CheckCheck,
  ClipboardList,
  Clock,
  Compass,
  Eye,
  Film,
  Headphones,
  HelpCircle,
  Info,
  LayoutGrid,
  Lock,
  Ruler,
  Scissors,
  ShieldAlert,
  Sliders,
  Type as TypeIcon,
} from "lucide-react";
import { INITIAL_QC_GATE_CHECKS, QCGateCheck } from "../data/qcGateChecksData";
import { QcMeasurement, QcVerdict, measureProject, measurementSummary, verdictForCheck } from "../core/qc/qcMeasure";
import type { ProjectModel } from "../core/types/project";

interface Props {
  language: "sk" | "en";
  showToast: (msg: string, type?: "success" | "info" | "warning") => void;
  /** Canonical projekt — jediný zdroj pravdy pre meranie. */
  getProject?: () => ProjectModel | null;
  /** Cieľová platforma pre kontrolu dĺžky (default Instagram Reels). */
  platform?: string;
}

const STATUS_STYLE: Record<string, string> = {
  PASS: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  WARNING: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  REVIEW: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  FAIL: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  NOT_VERIFIED: "bg-neutral-700/40 text-neutral-300 border-neutral-600/40",
};

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  STORY: <Compass className="h-4 w-4" />,
  PACING: <Activity className="h-4 w-4" />,
  AUDIO: <Headphones className="h-4 w-4" />,
  CAPTIONS: <TypeIcon className="h-4 w-4" />,
  VISUALS: <Film className="h-4 w-4" />,
  NATURALNESS: <Sliders className="h-4 w-4" />,
  PLATFORM: <LayoutGrid className="h-4 w-4" />,
  INTEGRITY: <Lock className="h-4 w-4" />,
  RESTRAINT: <Award className="h-4 w-4" />,
};

function fmt(n: number | null | undefined, digits = 2, suffix = ""): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}${suffix}`;
}

export const QualityControlAndAnalytics: React.FC<Props> = ({ language, showToast, getProject, platform = "Instagram Reels" }) => {
  const isSk = language === "sk";
  const [measurement, setMeasurement] = useState<QcMeasurement | null>(null);
  const [verdicts, setVerdicts] = useState<Record<string, QcVerdict>>({});
  const [isMeasuring, setIsMeasuring] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const runMeasurement = useCallback(() => {
    setIsMeasuring(true);
    try {
      const project = getProject ? getProject() : null;
      const m = measureProject(project);
      const next: Record<string, QcVerdict> = {};
      for (const check of INITIAL_QC_GATE_CHECKS) {
        next[check.id] = verdictForCheck(check.id, m, { platform });
      }
      setMeasurement(m);
      setVerdicts(next);
      showToast(
        m.ok
          ? isSk
            ? `📏 Zmerané z canonical osi: ${m.clipCount} klipov, ${m.cutCount} strihov.`
            : `📏 Measured from canonical timeline: ${m.clipCount} clips, ${m.cutCount} cuts.`
          : isSk
            ? "ℹ️ Nie je čo merať — časová os je prázdna."
            : "ℹ️ Nothing to measure — the timeline is empty.",
        m.ok ? "success" : "info",
      );
    } finally {
      setIsMeasuring(false);
    }
  }, [getProject, isSk, platform, showToast]);

  useEffect(() => {
    runMeasurement();
    // Meranie pri otvorení panela je len čítanie canonical osi — nič sa nemení.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(
    () => measurementSummary(
      INITIAL_QC_GATE_CHECKS.map((c) => c.id),
      measurement ?? measureProject(null),
      { platform },
    ),
    [measurement, platform],
  );

  const filteredChecks: QCGateCheck[] = useMemo(() => {
    return INITIAL_QC_GATE_CHECKS.filter((check) => {
      const v = verdicts[check.id];
      const status = v?.status ?? "NOT_VERIFIED";
      if (categoryFilter !== "ALL" && check.category !== categoryFilter) return false;
      if (statusFilter !== "ALL" && status !== statusFilter) return false;
      if (searchTerm.trim().length > 0) {
        const q = searchTerm.trim().toLowerCase();
        const hay = `${check.id} ${check.titleSk} ${check.titleEn} ${v?.evidenceSk ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [categoryFilter, searchTerm, statusFilter, verdicts]);

  const m = measurement;

  return (
    <div className="space-y-6 text-neutral-100" id="omnistrih-qc-measured">
      {/* HLAVIČKA */}
      <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <ClipboardList className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight">
                {isSk ? "Kontrola kvality — merané z časovej osi" : "Quality control — measured from the timeline"}
              </h3>
              <p className="text-xs text-neutral-400 mt-1 max-w-2xl leading-relaxed">
                {isSk
                  ? "Každá kontrola musí povedať, odkiaľ má dôkaz. Kontroly bez merania sú NOT VERIFIED — nikdy sa nezobrazia ako PASS. Tento panel nemení časovú os."
                  : "Every check must state where its evidence comes from. Checks without measurement are NOT VERIFIED — never shown as PASS. This panel does not change the timeline."}
              </p>
            </div>
          </div>
          <button
            onClick={runMeasurement}
            disabled={isMeasuring}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2"
            data-testid="qc-measure-button"
          >
            <Ruler className="h-4 w-4" />
            {isMeasuring ? (isSk ? "MERIAM…" : "MEASURING…") : isSk ? "ZMERAŤ ZNOVA" : "MEASURE AGAIN"}
          </button>
        </div>

        <div className="mt-4 p-3 rounded-2xl bg-neutral-950/60 border border-neutral-800 text-[11px] text-neutral-400">
          {m?.ok ? (
            <span>
              {isSk ? "Zmerané z canonical osi" : "Measured from canonical timeline"} · {m.projectId || "—"} ·{" "}
              {fmt(m.timelineDurationSec, 2, " s")} · {m.clipCount} {isSk ? "klipov" : "clips"} ·{" "}
              {isSk ? "aktualizované" : "updated"} {m.projectUpdatedAt > 0 ? new Date(m.projectUpdatedAt).toLocaleTimeString() : "—"}
            </span>
          ) : (
            <span className="text-amber-300">
              {isSk ? "Nie je čo merať: " : "Nothing to measure: "}
              {isSk ? m?.reasonSk ?? "" : m?.reasonEn ?? ""}
            </span>
          )}
        </div>
      </div>

      {/* SÚHRN */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: isSk ? "Merané" : "Measured", value: summary.measured, tone: "text-sky-300" },
          { label: "PASS", value: summary.pass, tone: "text-emerald-300" },
          { label: "WARNING/REVIEW", value: summary.warning, tone: "text-amber-300" },
          { label: "FAIL", value: summary.fail, tone: "text-rose-300" },
          { label: "NOT VERIFIED", value: summary.notVerified, tone: "text-neutral-300" },
        ].map((card) => (
          <div key={card.label} className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{card.label}</p>
            <p className={`text-2xl font-black ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ZMERANÉ HODNOTY */}
      <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="h-5 w-5 text-sky-400" />
          <span className="text-[11px] font-black uppercase tracking-widest">
            {isSk ? "Zmerané hodnoty (canonical os)" : "Measured values (canonical timeline)"}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-[11px]">
          {[
            { k: isSk ? "Klipy na osi" : "Clips on timeline", v: m?.ok ? `${m.clipCount}` : "—" },
            { k: isSk ? "Dĺžka osi" : "Timeline duration", v: m?.ok ? fmt(m.timelineDurationSec, 2, " s") : "—" },
            { k: isSk ? "Strihy" : "Cuts", v: m?.ok ? `${m.cutCount}` : "—" },
            { k: isSk ? "Strihov / min" : "Cuts / min", v: m?.ok ? fmt(m.cutsPerMinute, 1) : "—" },
            { k: isSk ? "Medián záberu" : "Median shot", v: m?.ok ? fmt(m.medianShotSec, 2, " s") : "—" },
            { k: isSk ? "Priemer záberu" : "Mean shot", v: m?.ok ? fmt(m.meanShotSec, 2, " s") : "—" },
            { k: isSk ? "Zábery pod 1,5 s" : "Shots under 1.5 s", v: m?.ok ? `${m.shotsUnder1_5s}` : "—" },
            { k: isSk ? "Video klipy" : "Video clips", v: m?.ok ? `${m.videoClipCount}` : "—" },
            { k: isSk ? "B-roll klipy" : "B-roll clips", v: m?.ok ? `${m.brollClipCount}` : "—" },
            { k: isSk ? "Pokrytie obrazom" : "Picture coverage", v: m?.ok ? `${Math.round(m.videoCoverageShare * 100)} %` : "—" },
            { k: isSk ? "Prechody na osi" : "Transitions", v: m?.ok ? `${m.transitionCount}` : "—" },
            { k: isSk ? "Kolízie na stope" : "Track collisions", v: m?.ok ? `${m.overlapCount}` : "—" },
            { k: isSk ? "Titulky" : "Captions", v: m?.ok ? `${m.captionSegmentCount}` : "—" },
            { k: isSk ? "Najdlhšia medzera bez titulku" : "Longest caption gap", v: m?.ok ? fmt(m.longestCaptionGapSec, 2, " s") : "—" },
            { k: isSk ? "Zvukové stopy" : "Audio tracks", v: m?.ok ? `${m.audioTrackCount}` : "—" },
            { k: isSk ? "Stlmené zvukové klipy" : "Muted audio clips", v: m?.ok ? `${m.mutedAudioClipCount}` : "—" },
            { k: isSk ? "Vety v prepise" : "Transcript sentences", v: m?.ok ? `${m.transcriptSegmentCount}` : "—" },
            { k: isSk ? "Slová s časmi" : "Timed words", v: m?.ok ? `${m.transcriptWordCount}` : "—" },
            { k: isSk ? "Najdlhšia medzera medzi slovami" : "Longest word gap", v: m?.ok ? fmt(m.longestWordGapSec, 2, " s") : "—" },
            { k: isSk ? "Formát" : "Format", v: m?.ok ? `${m.aspect ?? "—"}${m.fps ? ` @ ${m.fps} fps` : ""}` : "—" },
          ].map((row) => (
            <div key={row.k} className="flex items-center justify-between gap-3 border-b border-neutral-800/60 pb-1">
              <span className="text-neutral-500">{row.k}</span>
              <span className="font-mono font-bold text-neutral-200">{row.v}</span>
            </div>
          ))}
        </div>
        {m?.ok && m.missingAssets.length > 0 && (
          <p className="mt-4 text-[11px] text-rose-300">
            {isSk ? "Médiá použité na osi, ktoré v projekte nie sú: " : "Assets used on the timeline but missing from the project: "}
            {m.missingAssets.join(", ")}
          </p>
        )}
        {m?.ok && m.densitySeries.length > 0 && (
          <div className="mt-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">
              {isSk ? "Hustota strihu pozdĺž osi (merané)" : "Cut density along the timeline (measured)"}
            </p>
            <div className="flex items-end gap-1 h-16">
              {m.densitySeries.map((p) => {
                const max = Math.max(1, ...m.densitySeries.map((x) => x.cuts));
                return (
                  <div key={p.t} className="flex-1 bg-sky-500/50 rounded-t" style={{ height: `${Math.max(4, (p.cuts / max) * 100)}%` }} title={`${p.t.toFixed(1)} s · ${p.cuts} strihov`} />
                );
              })}
            </div>
            <p className="text-[10px] text-neutral-500 mt-1">
              {isSk
                ? "Toto je meranie strihov v čase — NIE predpoveď retencie diváka."
                : "This is a measurement of cuts over time — NOT a prediction of viewer retention."}
            </p>
          </div>
        )}
      </div>

      {/* FILTRE */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={isSk ? "Hľadať v kontrolách…" : "Search checks…"}
          className="px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-200 w-56"
        />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs">
          <option value="ALL">{isSk ? "Všetky kategórie" : "All categories"}</option>
          {["STORY", "PACING", "AUDIO", "CAPTIONS", "VISUALS", "NATURALNESS", "PLATFORM", "INTEGRITY", "RESTRAINT"].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs">
          <option value="ALL">{isSk ? "Všetky stavy" : "All statuses"}</option>
          {["PASS", "WARNING", "REVIEW", "FAIL", "NOT_VERIFIED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="text-[11px] text-neutral-500">
          {filteredChecks.length} / {INITIAL_QC_GATE_CHECKS.length}
        </span>
      </div>

      {/* KONTROLY */}
      <div className="space-y-2">
        {filteredChecks.map((check) => {
          const v = verdicts[check.id];
          const status = v?.status ?? "NOT_VERIFIED";
          const measuredHere = v?.evidenceSource === "measured";
          return (
            <div key={check.id} className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-400">
                    {CATEGORY_ICON[check.category] ?? <HelpCircle className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-neutral-200">
                      {check.id} · {isSk ? check.titleSk : check.titleEn}
                    </p>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-0.5">
                      {check.category} · {check.severity} ·{" "}
                      {measuredHere ? (isSk ? "dôkaz: meranie" : "evidence: measured") : isSk ? "dôkaz: žiadny" : "evidence: none"}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider ${STATUS_STYLE[status]}`}>
                  {status}
                </span>
              </div>
              <p className="mt-3 text-[11px] text-neutral-300 leading-relaxed">
                {isSk ? v?.evidenceSk ?? "" : v?.evidenceEn ?? ""}
              </p>
              <p className={`mt-1 text-[11px] leading-relaxed ${measuredHere ? "text-neutral-500" : "text-neutral-500 italic"}`}>
                {isSk ? v?.reasonSk ?? "" : v?.reasonEn ?? ""}
              </p>
            </div>
          );
        })}
        {filteredChecks.length === 0 && (
          <p className="text-xs text-neutral-500 italic">{isSk ? "Žiadna kontrola nezodpovedá filtru." : "No check matches the filter."}</p>
        )}
      </div>

      {/* ČO SA NEMERIA + REÁLNE DÔKAZY INDE */}
      <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-400" />
          <span className="text-[11px] font-black uppercase tracking-widest">
            {isSk ? "Čo tento panel NEOVERUJE" : "What this panel does NOT verify"}
          </span>
        </div>
        <ul className="text-[11px] text-neutral-400 space-y-1 leading-relaxed list-disc pl-5">
          {(isSk
            ? [
                "Hlasitosť zvuku (LUFS), špičky a ducking hudby — chýba meranie zvuku.",
                "Ako vyzerá hotové video (snímky, kontajner, kodeky) — to overuje exportná linka, nie tento panel.",
                "Zámery kamery, čistota záberov, emocionálny oblúk a odborný posudok — bez merania by to bol vymyslený verdikt.",
                "Relevancia B-rollu (či sa vizuál hodí k vete) — dnes sa merajú len počty a pokrytie.",
              ]
            : [
                "Audio loudness (LUFS), peaks and music ducking — audio measurement is missing.",
                "What the finished video looks like (frames, container, codecs) — that is verified by the export line, not this panel.",
                "Camera intent, clean takes, emotional arc — without measurement any verdict would be invented.",
                "B-roll relevance (whether the visual fits the sentence) — only counts and coverage are measured today.",
              ]
          ).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800 text-[11px] text-neutral-400 leading-relaxed">
          <p className="font-bold text-neutral-300 mb-1">{isSk ? "Kde sú skutočné dôkazy" : "Where the real evidence lives"}</p>
          <p>
            {isSk
              ? "Skutočný export a jeho meranie robia dôkazové nástroje v repozitári: tools/verify-canonical-export.ts, tools/verify-style-to-timeline.ts, tools/verify-goal-to-timeline.ts, tools/verify-own-visual.ts, tools/verify-transitions.ts, tools/verify-light-match.ts. Tie pracujú s reálnym videom a zapisujú namerané hodnoty."
              : "Real export and its measurement are done by the repository's proof tools: tools/verify-canonical-export.ts, tools/verify-style-to-timeline.ts, tools/verify-goal-to-timeline.ts, tools/verify-own-visual.ts, tools/verify-transitions.ts, tools/verify-light-match.ts. They work with real video and record measured values."}
          </p>
        </div>
      </div>

      {/* POZNÁMKA O PÔVODE */}
      <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800 flex items-start gap-3">
        <Info className="h-4 w-4 text-neutral-500 mt-0.5" />
        <p className="text-[11px] text-neutral-500 leading-relaxed">
          {isSk
            ? "Táto verzia nahradila pôvodnú simuláciu („stress test“). Simulácia nastavovala všetky kontroly na PASS a vypisovala vymyslené hodnoty (742 s, 154,8 MB, -14 LUFS). Také tvrdenie sa už v OmniStrihu nesmie objaviť."
            : "This version replaced the original simulation (“stress test”). The simulation set every check to PASS and printed invented values (742 s, 154.8 MB, -14 LUFS). Such a claim must never appear in OmniStrih again."}
        </p>
      </div>

      <div className="flex items-center gap-2 text-[10px] text-neutral-600 uppercase tracking-widest">
        <CheckCheck className="h-3 w-3" />
        {isSk ? "Panel nemení canonical stav" : "This panel does not change canonical state"}
        <Eye className="h-3 w-3 ml-3" />
        {isSk ? "Meranie je deterministické" : "Measurement is deterministic"}
        <Clock className="h-3 w-3 ml-3" />
        {isSk ? "Meranie sa spúšťa ručne" : "Measurement runs on demand"}
        <Scissors className="h-3 w-3 ml-3" />
        {isSk ? "Žiadny auto-fix" : "No auto-fix"}
        <AlertTriangle className="h-3 w-3 ml-3" />
        {isSk ? "Bez merania = NOT VERIFIED" : "No measurement = NOT VERIFIED"}
      </div>
    </div>
  );
};

export default QualityControlAndAnalytics;

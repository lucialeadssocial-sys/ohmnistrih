import React, { useMemo, useState } from "react";
import type { SpeechSegmentLike } from "../core/transcript/wordTiming";
import {
  Play,
  Square,
  Download,
  Gauge,
  Scissors,
  AlertCircle,
  Info,
  Sparkles,
  Clock,
  Film,
  Wand2,
  Clapperboard,
  Target,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import {
  buildRetentionEdl,
  edlDuration,
  edlSummarySk,
  edlToClipSpecs,
  mmss,
  type RetentionEdl,
  type RetentionPlanItemLike,
} from "../core/retention/retentionEngine";
import {
  smartCutRender,
  smartCutSummarySk,
  smartCutFileName,
  SmartCutCanceledError,
  type SmartCutProgress,
  type SmartCutResult,
} from "../core/export/smartCutRenderer";
import { BurnCaptionsPanel } from "./BurnCaptionsPanel";

/** Platformy pre krátky klip — prevzaté z knižnice trendov, aby limity sedeli. */
const TARGETS = [
  { id: "TIKTOK", labelSk: "TikTok", minSeconds: 7, maxSeconds: 90 },
  { id: "REELS", labelSk: "Instagram Reels", minSeconds: 7, maxSeconds: 120 },
  { id: "SHORTS", labelSk: "YouTube Shorts", minSeconds: 10, maxSeconds: 180 },
  { id: "ADS", labelSk: "Reklama / UGC", minSeconds: 6, maxSeconds: 30 },
];

interface RetentionShortPanelProps {
  language?: string;
  /** Schválené zásahy (presne to, čo používateľ potvrdil). */
  acceptedItems: RetentionPlanItemLike[];
  durationSec: number;
  mode?: string;
  /** Spustí náhľad v prehrávači — preskakuje vystrihnuté úseky. */
  onPreviewEdl?: (edl: RetentionEdl | null) => void;
  isPreviewing?: boolean;
  onSeek?: (seconds: number) => void;
  /**
   * Vráti zdrojové video ako Blob (pôvodný súbor alebo blob URL).
   * Bez neho sa render nedá spustiť — a panel to rovno povie.
   */
  getSourceBlob?: () => Promise<Blob | null>;
  /** Titulky s word-level časovaním — strihy sa prichytia na hranice slov. */
  speechSegments?: SpeechSegmentLike[];
}

const LEVEL_STYLE = {
  info: { cls: "bg-sky-500/10 border-sky-500/30 text-sky-200", icon: Info },
  warn: { cls: "bg-amber-500/10 border-amber-500/30 text-amber-200", icon: AlertCircle },
  stop: { cls: "bg-rose-500/10 border-rose-500/30 text-rose-200", icon: AlertCircle },
} as const;

export const RetentionShortPanel: React.FC<RetentionShortPanelProps> = ({
  language = "sk",
  acceptedItems,
  durationSec,
  mode = "SOCIAL",
  onPreviewEdl,
  isPreviewing = false,
  onSeek,
  getSourceBlob,
  speechSegments,
}) => {
  const isSk = language === "sk";
  const [targetId, setTargetId] = useState("REELS");
  const [edl, setEdl] = useState<RetentionEdl | null>(null);
  const [render, setRender] = useState<{ isRunning: boolean; progress: SmartCutProgress | null; result: SmartCutResult | null; error: string | null }>({
    isRunning: false,
    progress: null,
    result: null,
    error: null,
  });
  const cancelRef = React.useRef(false);

  const target = TARGETS.find((t) => t.id === targetId) || TARGETS[1];

  const cutCount = useMemo(
    () => acceptedItems.filter((i) => i.type === "CUT").length,
    [acceptedItems],
  );

  const build = () => {
    const built = buildRetentionEdl({
      plan: acceptedItems,
      durationSec,
      platform: target,
      mode,
      // Ak máme word-level časovanie z tituliek, strihy sa prichytia na hranice
      // slov — reč sa nepretne v polovici. Keď nie je, strih funguje ako doteraz.
      speechSegments,
    });
    setEdl(built);
  };

  const stopPreview = () => {
    onPreviewEdl?.(null);
  };

  /** Zloží hotový súbor z EDL (kopírovaním packetov, bez prekódovania). */
  const renderClip = async () => {
    if (!edl) return;
    if (!getSourceBlob) {
      setRender((r) => ({
        ...r,
        error: isSk
          ? "Nemám prístup k zdrojovému videu. Nahraj video znova a skús to."
          : "No access to the source video.",
      }));
      return;
    }

    cancelRef.current = false;
    setRender({ isRunning: true, progress: null, result: null, error: null });

    try {
      const source = await getSourceBlob();
      if (!source) {
        throw new Error(
          isSk
            ? "Zdrojové video sa nepodarilo načítať (súbor už nie je v prehliadači)."
            : "Could not load the source video.",
        );
      }

      const result = await smartCutRender({
        source,
        segments: edl.segments.map((seg) => ({
          sourceStart: seg.sourceStart,
          sourceEnd: seg.sourceEnd,
          timelineStart: seg.timelineStart,
          duration: seg.duration,
          label: seg.label,
        })),
        onProgress: (p) => setRender((r) => ({ ...r, progress: p })),
        shouldCancel: () => cancelRef.current,
      });

      setRender({ isRunning: false, progress: null, result, error: null });

      const a = document.createElement("a");
      a.href = URL.createObjectURL(result.blob);
      a.download = smartCutFileName(result.container, edl.platformLabelSk);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      const canceled = err instanceof SmartCutCanceledError;
      setRender({
        isRunning: false,
        progress: null,
        result: null,
        error: canceled
          ? isSk ? "Render som zastavil. Nič sa nezmenilo." : "Render canceled."
          : err?.message || (isSk ? "Render zlyhal." : "Render failed."),
      });
    }
  };

  const downloadEdl = () => {
    if (!edl) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      engine: "omnistrih-retention-edl-v1",
      ...edl,
      clipSpecs: edlToClipSpecs(edl),
      note: "EDL = zoznam zachovaných úsekov (sourceStart/sourceEnd) + časy na výslednej osi. Render ho vie spracovať ako klipy timeline.",
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `omnistrih-EDL-${edl.platform}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-950 to-rose-950/10 p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] font-black text-white uppercase tracking-wider">
              {isSk ? "⚡ RETENTION SHORT" : "⚡ RETENTION SHORT"}
            </p>
            <p className="text-[10px] text-neutral-400 mt-0.5">
              {isSk
                ? "Z tvojich schválených zásahov postavím konkrétny strih. Najprv ho prehráš v náhľade — bez renderovania."
                : "Turn approved edits into a concrete cut, previewed without rendering."}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
            {isSk ? "Formát" : "Format"}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {TARGETS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTargetId(t.id)}
                className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold transition-colors ${
                  targetId === t.id
                    ? "border-rose-500/60 bg-rose-500/10 text-white"
                    : "border-neutral-800 text-neutral-400 hover:border-neutral-700"
                }`}
                title={`${t.minSeconds}–${t.maxSeconds} s`}
              >
                {t.labelSk}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={build}
            disabled={acceptedItems.length === 0}
            className="px-3 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 disabled:opacity-40 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"
          >
            <Wand2 className="h-3.5 w-3.5" />
            {isSk ? "Postaviť strih" : "Build the cut"}
          </button>

          {edl && (
            <>
              {isPreviewing ? (
                <button
                  type="button"
                  onClick={stopPreview}
                  className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Square className="h-3.5 w-3.5" />
                  {isSk ? "Zastaviť náhľad" : "Stop preview"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onPreviewEdl?.(edl);
                    onSeek?.(edl.segments[0]?.sourceStart ?? 0);
                  }}
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Play className="h-3.5 w-3.5" />
                  {isSk ? "Prehrať náhľad klipu" : "Preview the clip"}
                </button>
              )}
              <button
                type="button"
                onClick={downloadEdl}
                className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                EDL (JSON)
              </button>

              {render.isRunning ? (
                <button
                  type="button"
                  onClick={() => {
                    cancelRef.current = true;
                  }}
                  className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-rose-600 text-neutral-200 hover:text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Square className="h-3.5 w-3.5" />
                  {isSk ? "Zastaviť render" : "Cancel render"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={renderClip}
                  className="px-3 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Clapperboard className="h-3.5 w-3.5" />
                  {isSk ? "Vyrenderovať klip" : "Render the clip"}
                </button>
              )}
            </>
          )}
        </div>

        {acceptedItems.length === 0 && (
          <p className="text-[10px] text-neutral-500 mt-2">
            {isSk
              ? "Najprv označ zásahy v pláne (alebo „Použiť všetko“) — potom tu postavím strih."
              : "Select edits in the plan first."}
          </p>
        )}
        {acceptedItems.length > 0 && cutCount === 0 && (
          <p className="text-[10px] text-amber-300/90 mt-2">
            {isSk
              ? "V tvojom výbere nie sú žiadne CUT zásahy — klip by bol rovnako dlhý ako RAW. (Titulky, zoom či hudba strih neskracujú.)"
              : "No CUT edits selected — the clip would stay as long as the RAW."}
          </p>
        )}
      </div>

      {edl && (
        <>
          {/* Súhrn */}
          <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[11px] text-neutral-400">
                  {isSk ? "Výsledný klip" : "Resulting clip"}{" "}
                  <span className="text-white font-black">{mmss(edlDuration(edl))}</span>{" "}
                  <span className="text-neutral-500">
                    {isSk ? `z pôvodných ${mmss(edl.sourceDurationSec)}` : `of ${mmss(edl.sourceDurationSec)}`}
                  </span>
                </p>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  {isSk ? "Vystrihnutých" : "Removed"}{" "}
                  <span className="text-rose-300 font-bold">{edl.removedSeconds.toFixed(1)} s</span>{" "}
                  ({Math.round(edl.removedShare * 100)} %) ·{" "}
                  {isSk ? "úsekov" : "segments"}{" "}
                  <span className="text-sky-300 font-bold">{edl.stats.keptSegments}</span> ·{" "}
                  {isSk ? "strihov za minútu" : "cuts/min"}{" "}
                  <span className="text-neutral-300 font-mono">{edl.stats.cutsPerMinute}</span>
                </p>
              </div>
              <span
                className={`text-[10px] px-2 py-1 rounded border ${
                  edl.basis === "transcript"
                    ? "bg-sky-500/10 text-sky-300 border-sky-500/30"
                    : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                }`}
              >
                {edl.basis === "transcript"
                  ? isSk ? "kotvené na prepise" : "anchored"
                  : isSk ? "časy sú odhad" : "estimated times"}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-2 leading-relaxed">{edlSummarySk(edl)}</p>
          </div>

          {/* Upozornenia */}
          {edl.warnings.length > 0 && (
            <div className="space-y-1.5">
              {edl.warnings.map((w, i) => {
                const style = LEVEL_STYLE[w.level];
                const Icon = style.icon;
                return (
                  <div key={i} className={`p-2.5 rounded-xl border text-[11px] flex items-start gap-2 ${style.cls}`}>
                    <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      <span className="font-bold">{w.text}</span>
                      {w.hint && <span className="block opacity-80 mt-0.5">{w.hint}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

                    {/* PRESNOSŤ ČASOVANIA — poctivo, na čom strih stojí */}
          {edl && (
            <div
              className={`p-3 rounded-xl border text-[11px] flex items-start gap-2 ${
                edl.timingPrecision === "words"
                  ? "bg-emerald-500/5 border-emerald-500/25 text-emerald-200"
                  : "bg-neutral-800/40 border-neutral-700 text-neutral-300"
              }`}
            >
              <Target className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  {edl.timingPrecision === "words"
                    ? isSk
                      ? "Časy sú presné na slová (z automatických tituliek)"
                      : "Word-accurate timing (from captions)"
                    : edl.timingPrecision === "sentences"
                      ? isSk
                        ? "Časy viet sú z tituliek, ale bez časovania slov"
                        : "Sentence timing from captions"
                      : isSk
                        ? "Časy sú odhad z dĺžky textu"
                        : "Times are estimated from text length"}
                </p>
                <p className="opacity-80 mt-0.5">
                  {edl.timingPrecision === "words"
                    ? isSk
                      ? "Strihy sa prichytávajú na hranice slov a do páuz — divák strih nepočuje."
                      : "Cuts snap to word boundaries and pauses."
                    : isSk
                      ? "Pre presné strihy spusti v záložke Titulky „Automatické titulky“ — časovanie slov sa potom použije aj tu."
                      : "Generate auto captions to get word-accurate cuts."}
                </p>
                {edl.wordSnap.snappedCount > 0 && (
                  <div className="mt-2 pt-2 border-t border-current/20 space-y-1">
                    <p className="font-bold">
                      {isSk
                        ? `Posuny kvôli hraniciam slov: ${edl.wordSnap.snappedCount} (najviac ${edl.wordSnap.maxShiftSec.toFixed(2)} s)`
                        : `${edl.wordSnap.snappedCount} word-boundary shifts (max ${edl.wordSnap.maxShiftSec.toFixed(2)}s)`}
                    </p>
                    {edl.wordSnap.reports.slice(0, 6).map((r, i) => (
                      <p key={i} className="opacity-80 leading-relaxed">
                        • {r}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

{/* RENDER: priebeh a výsledok */}
          {render.isRunning && (
            <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/30">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 text-violet-300 animate-spin" />
                <p className="text-[11px] font-bold text-violet-200">
                  {render.progress?.messageSk || (isSk ? "Pripravujem render…" : "Preparing…")}
                </p>
              </div>
              <div className="mt-2 h-1.5 rounded bg-neutral-800 overflow-hidden">
                <div
                  className="h-full bg-violet-500 transition-all"
                  style={{ width: `${render.progress?.percent ?? 2}%` }}
                />
              </div>
              <p className="text-[10px] text-neutral-400 mt-2">
                {isSk
                  ? "Skladám klip kopírovaním packetov — bez prekódovania, takže kvalita zostáva pôvodná a render je rádovo rýchlejší."
                  : "Copying packets — no re-encode."}
                {render.progress
                  ? ` · ${render.progress.copiedVideoPackets} obrazových, ${render.progress.copiedAudioPackets} zvukových packetov`
                  : ""}
              </p>
            </div>
          )}

          {render.error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-200 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{render.error}</span>
            </div>
          )}

          {render.result && (
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/30 space-y-2">
              <p className="text-[11px] font-black text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {isSk ? "Klip je hotový a stiahnutý" : "Clip rendered and downloaded"}
              </p>
              <p className="text-[11px] text-neutral-300">{smartCutSummarySk(render.result)}</p>
              <p className="text-[10px] text-neutral-500">
                {isSk
                  ? `Skopírované packety: ${render.result.copiedVideoPackets} obraz · ${render.result.copiedAudioPackets} zvuk. Bez prekódovania = bez straty kvality.`
                  : `${render.result.copiedVideoPackets} video / ${render.result.copiedAudioPackets} audio packets copied.`}
              </p>
              {render.result.warnings.length > 0 && (
                <div className="pt-2 border-t border-emerald-500/20 space-y-1.5">
                  {render.result.warnings.map((w, i) => (
                    <p key={i} className="text-[10px] text-amber-300/90 leading-relaxed">
                      ⚠️ <span className="font-bold">{w.text}</span>
                      {w.hint && <span className="block opacity-80 mt-0.5">{w.hint}</span>}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VYPÁLENIE TITULKOV DO OBRAZU (krok B) — ten istý klip, ale s titulkami
              zapečenými v obraze. Beží na serveri (ffmpeg), lebo prekódovanie obrazu
              prehliadač nevie. */}
          <BurnCaptionsPanel
            language={language}
            speechSegments={speechSegments}
            keepRanges={edl.segments.map((seg) => ({ start: seg.sourceStart, end: seg.sourceEnd }))}
            durationSec={edlDuration(edl)}
            getSourceBlob={getSourceBlob}
            // Formát a tempo klipu — z nich poradca odvodí, ktorý štýl titulkov sedí.
            platform={target.id}
            cutCount={edl.stats.keptSegments > 0 ? edl.stats.keptSegments - 1 : 0}
          />

          {/* Časová os výsledku */}
          <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800">
            <p className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Film className="h-3.5 w-3.5" />
              {isSk ? "Ako bude klip vyzerať" : "Clip structure"}
            </p>
            <div className="flex h-6 w-full rounded overflow-hidden border border-neutral-800">
              {edl.segments.map((seg, idx) => (
                <div
                  key={seg.id}
                  title={`${seg.label}: ${mmss(seg.sourceStart)}–${mmss(seg.sourceEnd)}`}
                  onClick={() => onSeek?.(seg.sourceStart)}
                  className={`h-full cursor-pointer border-r border-neutral-900 last:border-r-0 ${
                    seg.movedForHook
                      ? "bg-rose-500/50"
                      : idx % 2 === 0
                        ? "bg-sky-500/40"
                        : "bg-sky-500/25"
                  }`}
                  style={{ width: `${(seg.duration / Math.max(0.01, edl.totalDurationSec)) * 100}%` }}
                />
              ))}
            </div>
            <div className="mt-2 space-y-1">
              {edl.segments.map((seg) => (
                <div key={seg.id} className="flex items-center justify-between gap-3 text-[10px]">
                  <button
                    type="button"
                    onClick={() => onSeek?.(seg.sourceStart)}
                    className="text-neutral-400 hover:text-white font-mono transition-colors"
                  >
                    {mmss(seg.timelineStart)} ← {mmss(seg.sourceStart)}–{mmss(seg.sourceEnd)}
                  </button>
                  <span className="text-neutral-500 truncate">
                    {seg.movedForHook ? (isSk ? "hook presunutý na začiatok" : "hook moved first") : seg.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Čo vypadlo */}
          {(edl.removedRanges.length > 0 || edl.droppedForLength.length > 0) && (
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800">
              <p className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Scissors className="h-3.5 w-3.5" />
                {isSk ? "Čo vypadlo a prečo" : "What was removed and why"}
              </p>
              <div className="space-y-1.5">
                {[...edl.removedRanges, ...edl.droppedForLength].slice(0, 8).map((r, i) => (
                  <div key={i} className="text-[10px]">
                    <button
                      type="button"
                      onClick={() => onSeek?.(r.start)}
                      className="text-rose-300 hover:text-rose-200 font-mono transition-colors"
                    >
                      {mmss(r.start)}–{mmss(r.end)} ({r.seconds.toFixed(1)} s)
                    </button>
                    <span className="text-neutral-400 ml-2">{r.label}</span>
                    <p className="text-neutral-500 mt-0.5 leading-relaxed">{r.reason}</p>
                  </div>
                ))}
                {edl.removedRanges.length + edl.droppedForLength.length > 8 && (
                  <p className="text-[10px] text-neutral-600">
                    {isSk
                      ? `… a ďalších ${edl.removedRanges.length + edl.droppedForLength.length - 8} strihov (celý zoznam je v EDL JSON).`
                      : `…and more (full list in EDL JSON).`}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-start gap-2">
            <Clock className="h-3.5 w-3.5 text-neutral-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-neutral-500 leading-relaxed">
              {isSk
                ? "Náhľad prehráva klip tak, že vystrihnuté úseky preskočí — takže vidíš výsledok okamžite, bez renderovania. EDL sa dá odovzdať renderu alebo inému strihu (DaVinci/Premiere) ako zoznam klipov."
                : "Preview skips removed ranges, so you see the result instantly without rendering."}
            </p>
          </div>
        </>
      )}

      {!edl && (
        <div className="p-6 rounded-xl border border-dashed border-neutral-800 text-center">
          <Gauge className="h-5 w-5 text-neutral-600 mx-auto" />
          <p className="text-[11px] text-neutral-500 mt-2 max-w-md mx-auto">
            {isSk
              ? "Vyber formát a klikni „Postaviť strih“. Uvidíš presné úseky, ktoré zostanú, koľko sekúnd vypadne a prečo — a rovno si to prehráš."
              : "Pick a format and build the cut."}
          </p>
        </div>
      )}
    </div>
  );
};

export default RetentionShortPanel;

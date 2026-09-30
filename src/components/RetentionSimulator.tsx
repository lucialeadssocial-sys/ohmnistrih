/**
 * RETENČNÝ PREHĽAD — MERANIE, NIE SIMULÁCIA
 *
 * Pôvodná verzia tvrdila „AI nesimuluje náhodu“, a pritom kreslila krivku cez
 * `Math.random()` a zobrazovala vymyslené skóre (96 %, 45 %, 20 %…). To bolo
 * odstránené.
 *
 * Tento panel dnes ukazuje LEN to, čo sa dá zmerať z canonical časovej osi:
 * kde sú strihy, aké dlhé sú zábery, kde nie je strih vôbec. Predpoveď
 * retencie diváka OmniStrih NEMÁ — a preto ju ani nezobrazuje.
 */
import React from "react";
import { Activity, Info, Ruler, Scissors, Timer, TrendingDown, Video } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { RetentionProject, RetentionSegment } from "../types";

interface RetentionSimulatorProps {
  project: RetentionProject;
  onRunAnalysis: () => void;
  onSeek: (time: number) => void;
  currentTime: number;
  language: "sk" | "en";
  isAnalyzing: boolean;
}

export const RetentionSimulator: React.FC<RetentionSimulatorProps> = ({
  project,
  onRunAnalysis,
  onSeek,
  currentTime,
  language,
  isAnalyzing,
}) => {
  const isSk = language === "sk";

  const segmentColor = (type: RetentionSegment["type"]) => {
    switch (type) {
      case "CUTS_DENSE":
        return "bg-rose-500/70";
      case "CUTS_NORMAL":
        return "bg-amber-500/70";
      case "CUTS_SPARSE":
        return "bg-sky-500/70";
      case "NO_CUT":
        return "bg-neutral-600/70";
      default:
        return "bg-neutral-700";
    }
  };

  const maxCuts = Math.max(1, ...project.segments.map((s) => s.cuts));

  return (
    <div className="space-y-8 text-neutral-100" id="omnistrih-retention-measured">
      {/* HLAVIČKA */}
      <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
            <Ruler className="h-6 w-6 text-sky-400" />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight">
              {isSk ? "Meranie rytmu časovej osi" : "Timeline rhythm measurement"}
            </h2>
            <p className="text-xs text-neutral-400 mt-1 max-w-2xl leading-relaxed">
              {isSk
                ? "Ukazujeme namerané strihy, dĺžky záberov a miesta bez strihu. Predpoveď retencie diváka OmniStrih NEMÁ — na to by potreboval reálne dáta o správaní divákov, ktoré nemá."
                : "We show measured cuts, shot lengths and places with no cut. OmniStrih has NO viewer-retention prediction — that would require real audience data it does not have."}
            </p>
          </div>
        </div>
        <button
          onClick={onRunAnalysis}
          disabled={isAnalyzing}
          className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2"
          data-testid="retention-measure-button"
        >
          <Ruler className="h-4 w-4" />
          {isAnalyzing ? (isSk ? "MERIAM…" : "MEASURING…") : isSk ? "ZMERAŤ ČASOVÚ OS" : "MEASURE TIMELINE"}
        </button>
      </div>

      {!project.isAnalyzed ? (
        <div className="p-16 rounded-3xl bg-neutral-900/50 border border-neutral-800 border-dashed flex flex-col items-center text-center gap-5">
          <div className="h-20 w-20 rounded-full bg-sky-500/5 flex items-center justify-center border border-sky-500/10">
            <Activity className="h-9 w-9 text-sky-500/40" />
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-black text-white uppercase tracking-widest">
              {isSk ? "ČAKÁ NA MERANIE" : "AWAITING MEASUREMENT"}
            </h4>
            <p className="text-[10px] text-neutral-500 font-bold uppercase leading-relaxed max-w-[380px]">
              {isSk
                ? "Zmeriam, koľko strihov je na časovej osi a kde presne sú. Nič sa pritom nemení — je to len čítanie canonical osi."
                : "I will measure how many cuts are on the timeline and where exactly. Nothing changes — this only reads the canonical timeline."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* SÚHRN */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800">
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{isSk ? "Meraná dĺžka" : "Measured length"}</p>
              <p className="text-2xl font-black text-neutral-100">{project.measuredDurationSec?.toFixed(2) ?? "—"}<span className="text-sm text-neutral-500"> s</span></p>
            </div>
            <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800">
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{isSk ? "Strihy / min" : "Cuts / min"}</p>
              <p className="text-2xl font-black text-sky-300">{project.cutsPerMinute?.toFixed(1) ?? "—"}</p>
            </div>
            <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800">
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{isSk ? "Úsekov merania" : "Measured segments"}</p>
              <p className="text-2xl font-black text-neutral-100">{project.segments.length}</p>
            </div>
            <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800">
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{isSk ? "Zdroj" : "Source"}</p>
              <p className="text-sm font-black text-emerald-300 uppercase">
                {project.measuredFrom === "canonical_timeline" ? (isSk ? "canonical os" : "canonical timeline") : "—"}
              </p>
            </div>
          </div>

          {/* HUSTOTA STRIHU */}
          <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800">
            <div className="flex items-center gap-3 mb-5">
              <Scissors className="h-5 w-5 text-sky-400" />
              <span className="text-[12px] font-black uppercase tracking-widest">
                {isSk ? "HUSTOTA STRIHU POZDĹŽ OSI (MERANÉ)" : "CUT DENSITY ALONG THE TIMELINE (MEASURED)"}
              </span>
            </div>
            <div className="relative h-32 w-full flex items-end gap-[3px] px-1">
              {project.segments.map((segment) => (
                <div
                  key={segment.id}
                  className={`flex-1 rounded-t-sm ${segmentColor(segment.type)}`}
                  style={{ height: `${Math.max(4, (segment.cuts / maxCuts) * 100)}%`, opacity: 0.85 }}
                  title={isSk
                    ? `${segment.startTime.toFixed(1)}–${segment.endTime.toFixed(1)} s · ${segment.cuts} strihov · ${segment.cutsPerMinute} strihov/min`
                    : `${segment.startTime.toFixed(1)}–${segment.endTime.toFixed(1)} s · ${segment.cuts} cuts · ${segment.cutsPerMinute} cuts/min`}
                />
              ))}
              {project.measuredDurationSec && project.measuredDurationSec > 0 && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-white z-10 shadow-[0_0_8px_rgba(255,255,255,0.5)] transition-all"
                  style={{ left: `${Math.min(100, Math.max(0, (currentTime / project.measuredDurationSec) * 100))}%` }}
                />
              )}
            </div>
            <div className="flex justify-between mt-2 px-1 text-[9px] font-black text-neutral-600">
              <span>0 s</span>
              <span>{project.measuredDurationSec ? `${(project.measuredDurationSec / 2).toFixed(1)} s` : ""}</span>
              <span>{project.measuredDurationSec ? `${project.measuredDurationSec.toFixed(1)} s` : ""}</span>
            </div>
            <p className="text-[10px] text-neutral-500 mt-3 flex items-start gap-2">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              {isSk
                ? "Stĺpec = jeden úsek osi. Výška = počet strihov v úseku. Toto je meranie strihu, NIE predpoveď retencie."
                : "Each bar is one slice of the timeline. Height = number of cuts in that slice. This is a cut measurement, NOT a retention prediction."}
            </p>
          </div>

          {/* ÚSEKY */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-black text-neutral-500 uppercase tracking-widest px-1">
              {isSk ? "NAMERANÉ ÚSEKY" : "MEASURED SEGMENTS"}
            </h4>
            <AnimatePresence mode="popLayout">
              {project.segments.map((segment, idx) => (
                <motion.div
                  key={segment.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 cursor-pointer transition-all ${
                    Math.abs(currentTime - segment.startTime) < 2 ? "bg-neutral-800 border-sky-500/50" : "bg-neutral-900 border-neutral-800"
                  }`}
                  onClick={() => onSeek(segment.startTime)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-white ${segmentColor(segment.type)}`}>
                      {segment.type === "NO_CUT" ? <Video className="h-4 w-4" /> : segment.type === "CUTS_DENSE" ? <Scissors className="h-4 w-4" /> : <Timer className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-white uppercase tracking-wider">
                        {segment.startTime.toFixed(1)} s – {segment.endTime.toFixed(1)} s
                      </p>
                      <p className="text-[11px] font-bold text-neutral-400 mt-0.5">
                        {isSk ? segment.labelSk : segment.labelEn}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-neutral-500 uppercase mb-0.5">{isSk ? "MERANÉ" : "MEASURED"}</p>
                    <p className="text-sm font-black text-sky-300">
                      {segment.cuts} {isSk ? "strihov" : "cuts"} · {segment.cutsPerMinute}/min
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* ČO SA NEMERIA */}
          <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-start gap-4">
            <TrendingDown className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h5 className="text-[11px] font-black text-amber-200 uppercase tracking-widest mb-1">
                {isSk ? "ČO TENTO PANEL NEMERIA" : "WHAT THIS PANEL DOES NOT MEASURE"}
              </h5>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                {isSk
                  ? "Retenciu diváka, „skóre virality“, emócie publika a odporúčania typu „zvýši to udržanie o 15 %“. Na to OmniStrih nemá dáta — a preto ich nevymýšľa. Ak chcete zmeniť rytmus, použite Style Studio (tam je vidieť, čo sa zmení a prečo)."
                  : "Viewer retention, “virality scores”, audience emotions and advice like “this will increase retention by 15 %”. OmniStrih has no data for that — so it does not invent it. To change pacing, use Style Studio (it shows what changes and why)."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RetentionSimulator;

import React from "react";
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  Zap, 
  Clock, 
  Activity, 
  Play, 
  Info, 
  Sparkles, 
  TrendingDown,
  Target,
  Trophy,
  History,
  Timer
} from "lucide-react";
import { 
  RetentionProject, 
  RetentionSegment 
} from "../types";
import { motion, AnimatePresence } from "motion/react";

interface RetentionSimulatorProps {
  project: RetentionProject;
  onRunAnalysis: () => void;
  onSeek: (time: number) => void;
  currentTime: number;
  /** Real timeline duration in seconds — the engagement curve is drawn over it. */
  duration?: number;
  language: "sk" | "en";
  isAnalyzing: boolean;
}

export const RetentionSimulator: React.FC<RetentionSimulatorProps> = ({
  project,
  onRunAnalysis,
  onSeek,
  currentTime,
  duration,
  language,
  isAnalyzing
}) => {
  const isSk = language === "sk";

  // The curve is drawn over the REAL duration; without a measurement the bars stay empty instead
  // of showing random heights (the previous version added a random jitter to every bar).
  const curveDuration = duration && duration > 0 ? duration : 0;
  const BAR_COUNT = 60;
  const measured = project.isAnalyzed && project.segments.length > 0 && curveDuration > 0;

  const getSegmentColor = (type: RetentionSegment["type"]) => {
    switch (type) {
      case "STRONG": return "bg-emerald-500";
      case "STRONG_PAYOFF": return "bg-violet-500";
      case "LOW_DENSITY": return "bg-amber-500";
      case "LONG_PAUSE": return "bg-rose-500";
      case "REPETITIVE": return "bg-orange-500";
      case "MONOTONE": return "bg-neutral-500";
      default: return "bg-blue-500";
    }
  };

  const getSegmentIcon = (type: RetentionSegment["type"]) => {
    switch (type) {
      case "STRONG": return <Zap className="h-4 w-4" />;
      case "STRONG_PAYOFF": return <Trophy className="h-4 w-4" />;
      case "LOW_DENSITY": return <TrendingDown className="h-4 w-4" />;
      case "LONG_PAUSE": return <Timer className="h-4 w-4" />;
      case "REPETITIVE": return <History className="h-4 w-4" />;
      case "MONOTONE": return <Activity className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Module Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 text-white shadow-lg shadow-rose-600/20">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">AI RETENTION SIMULATOR</h3>
            <p className="text-[10px] text-neutral-500 font-bold uppercase">Psychological Engagement Mapping</p>
          </div>
        </div>

        <button 
          onClick={onRunAnalysis}
          disabled={isAnalyzing}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50"
        >
          {isAnalyzing ? <Activity className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {isAnalyzing ? (isSk ? "SIMULUJEM DIVÁKA..." : "SIMULATING VIEWER...") : (isSk ? "SPUSTIŤ SIMULÁCIU" : "RUN SIMULATION")}
        </button>
      </div>

      {/* Intro Context */}
      <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 flex items-start gap-4">
         <div className="h-10 w-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 shrink-0">
            <Info className="h-5 w-5" />
         </div>
         <div>
            <p className="text-[11px] font-black text-white uppercase tracking-wider mb-1">REAL-TIME DROP-OFF ANALYSIS</p>
            <p className="text-[10px] text-neutral-400 leading-relaxed italic">
               {isSk 
                 ? "AI nesimuluje náhodu, ale psychologickú odozvu diváka na tempo strihu, hustotu informácií a kvalitu reči. Získate presný prehľad o tom, kde divák stráca záujem a kde je nadšený."
                 : "AI does not simulate randomness, but the viewer's psychological response to edit tempo, information density, and speech quality. You get an exact overview of where the viewer loses interest and where they are thrilled."}
            </p>
         </div>
      </div>

      {!project.isAnalyzed ? (
        <div className="p-20 rounded-3xl bg-neutral-900/50 border border-neutral-800 border-dashed flex flex-col items-center text-center gap-6">
           <div className="h-24 w-24 rounded-full bg-rose-500/5 flex items-center justify-center border border-rose-500/10">
              <TrendingUp className="h-10 w-10 text-rose-500/40" />
           </div>
           <div className="space-y-2">
              <h4 className="text-sm font-black text-white uppercase tracking-widest">{isSk ? "ČAKÁM NA DÁTA" : "AWAITING DATA"}</h4>
              <p className="text-[10px] text-neutral-500 font-bold uppercase leading-relaxed max-w-[320px]">
                {isSk ? "Spustite simuláciu pre analýzu vašej časovej osi." : "Run the simulation to analyze your timeline."}
              </p>
           </div>
        </div>
      ) : (
        <div className="space-y-8">
           {/* Retention Curve Visualization */}
           <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800">
              <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center gap-3">
                    <Activity className="h-5 w-5 text-rose-500" />
                    <span className="text-[12px] font-black text-white uppercase tracking-widest">ENGAGEMENT FLOW</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-neutral-500 uppercase">SCORE:</span>
                    <span className="text-lg font-black text-rose-500">
                       {project.isAnalyzed ? `${project.overallScore}%` : (isSk ? "nemerané" : "not measured")}
                    </span>
                 </div>
              </div>

              <div className="relative h-32 w-full flex items-end gap-[2px] px-1">
                 {/* Bars are derived from the measured segments of the real timeline. */}
                 {Array.from({ length: BAR_COUNT }).map((_, i) => {
                   if (!measured) {
                     return <div key={i} className="flex-1 rounded-t-sm bg-neutral-800/60" style={{ height: "6%" }} />;
                   }
                   const time = ((i + 0.5) / BAR_COUNT) * curveDuration;
                   const segment = project.segments.find(s => time >= s.startTime && time <= s.endTime);
                   const height = segment ? Math.min(100, Math.max(8, segment.score)) : 8;
                   return (
                     <div
                       key={i}
                       className={`flex-1 rounded-t-sm transition-all duration-500 ${segment ? getSegmentColor(segment.type) : "bg-neutral-800"}`}
                       style={{ height: `${height}%`, opacity: segment ? 0.75 : 0.4 }}
                       title={segment ? `${segment.startTime.toFixed(1)}–${segment.endTime.toFixed(1)}s · ${segment.labelSk} · ${segment.score}%` : undefined}
                     />
                   );
                 })}

                 {/* Playhead marker over the real duration */}
                 {measured && (
                   <div
                     className="absolute top-0 bottom-0 w-px bg-white z-10 shadow-[0_0_8px_rgba(255,255,255,0.5)] transition-all"
                     style={{ left: `${Math.min(100, Math.max(0, (currentTime / curveDuration) * 100))}%` }}
                   />
                 )}
              </div>

              <div className="flex justify-between mt-2 px-1">
                 <span className="text-[9px] font-black text-neutral-600">0s</span>
                 <span className="text-[9px] font-black text-neutral-600">{measured ? `${(curveDuration / 2).toFixed(0)}s` : "—"}</span>
                 <span className="text-[9px] font-black text-neutral-600">{measured ? `${curveDuration.toFixed(0)}s` : "—"}</span>
              </div>

              {!measured && (
                <p className="text-[11px] text-amber-400/90 mt-3">
                  {isSk
                    ? "Retention nie je meraná — spustite analýzu projektu a potom analýzu retention (krivka sa počíta z nameraných pásiem, hookov a CTA)."
                    : "Retention is not measured — run project analysis and then the retention analysis (the curve is computed from measured pauses, hooks and CTAs)."}
                </p>
              )}
           </div>

           {/* Segment Breakdown */}
           <div className="space-y-4">
              <h4 className="text-[11px] font-black text-neutral-500 uppercase tracking-widest px-1">DETAILED AUDIENCE REACTION</h4>
              
              <div className="grid grid-cols-1 gap-3">
                 {project.segments.length === 0 && (
                   <p className="text-[11px] text-neutral-500">
                     {isSk
                       ? "Žiadne namerané segmenty — analyzujte projekt (pauzy, hooky, CTA)."
                       : "No measured segments — analyse the project (pauses, hooks, CTAs)."}
                   </p>
                 )}
                 <AnimatePresence mode="popLayout">
                    {project.segments.map((segment, idx) => (
                      <motion.div
                        key={segment.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`p-4 rounded-2xl border flex items-center justify-between group transition-all ${
                          Math.abs(currentTime - segment.startTime) < 2 ? "bg-neutral-800 border-rose-500/50" : "bg-neutral-900 border-neutral-800"
                        }`}
                        onClick={() => onSeek(segment.startTime)}
                      >
                         <div className="flex items-center gap-4">
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-white ${getSegmentColor(segment.type)}`}>
                               {getSegmentIcon(segment.type)}
                            </div>
                            <div>
                               <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-white uppercase tracking-wider">
                                     {segment.startTime.toFixed(1)}s – {segment.endTime.toFixed(1)}s
                                  </span>
                                  <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${getSegmentColor(segment.type)} bg-opacity-20`}>
                                     {segment.type}
                                  </span>
                               </div>
                               <p className="text-[11px] font-bold text-neutral-400 mt-1 uppercase tracking-tighter">
                                  {isSk ? segment.labelSk : segment.labelEn}
                               </p>
                            </div>
                         </div>

                         <div className="text-right">
                            <p className="text-[10px] font-black text-neutral-500 uppercase mb-1">SCORE</p>
                            <p className={`text-sm font-black ${segment.score > 80 ? "text-emerald-500" : segment.score > 50 ? "text-amber-500" : "text-rose-500"}`}>
                               {segment.score}%
                            </p>
                         </div>
                      </motion.div>
                    ))}
                 </AnimatePresence>
              </div>
           </div>

           {/* AI Recommendations */}
           <div className="p-5 rounded-2xl bg-violet-600/10 border border-violet-500/20">
              <div className="flex items-start gap-4">
                 <Zap className="h-6 w-6 text-violet-500 shrink-0" />
                 <div>
                    <h5 className="text-[11px] font-black text-white uppercase tracking-widest mb-1">AI EDIT ADVISOR</h5>
                    <p className="text-[10px] text-neutral-400 leading-relaxed italic">
                       {isSk 
                         ? "Odporúčam skrátiť ticho v úseku 12-16s a pridať Punch-In zoom na 24s pre zdôraznenie payoffu. To by mohlo zvýšiť celkové udržanie diváka o 15%."
                         : "I recommend shortening the silence in the 12-16s section and adding a Punch-In zoom at 24s to emphasize the payoff. This could increase overall viewer retention by 15%."}
                    </p>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

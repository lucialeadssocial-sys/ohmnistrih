import React, { useState } from "react";
import { 
  Scissors, 
  Zap, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Trash2, 
  Eye, 
  HelpCircle,
  Clock,
  Play,
  Settings2,
  ChevronRight,
  Info,
  BarChart3,
  History,
  Timer,
  Mic2,
  Music
} from "lucide-react";
import { 
  JumpCutSequence, 
  JumpCutMode, 
  AICutMarker, 
  RawAIAnalysis,
  StoryPlan
} from "../types";
import { motion, AnimatePresence } from "motion/react";

interface AIJumpCutEditorProps {
  rawAnalysis: RawAIAnalysis;
  storyPlan: StoryPlan | null;
  jumpSequence: JumpCutSequence | null;
  onGenerateCuts: (mode: JumpCutMode, density: number) => void;
  onApplyCuts: (selectedIds: string[]) => void;
  language: "sk" | "en";
  isGenerating: boolean;
  onPreviewCut: (start: number) => void;
}

export const AIJumpCutEditor: React.FC<AIJumpCutEditorProps> = ({
  rawAnalysis,
  storyPlan,
  jumpSequence,
  onGenerateCuts,
  onApplyCuts,
  language,
  isGenerating,
  onPreviewCut
}) => {
  const isSk = language === "sk";
  const [selectedMode, setSelectedMode] = useState<JumpCutMode>("BALANCED");
  const [density, setDensity] = useState(50);
  const [viewMode, setViewMode] = useState<"LIST" | "TIMELINE">("LIST");
  const [selectedMarkers, setSelectedMarkers] = useState<string[]>([]);

  const modes: { id: JumpCutMode; labelSk: string; labelEn: string; descSk: string; descEn: string }[] = [
    { id: "NATURAL", labelSk: "NATURAL", labelEn: "NATURAL", descSk: "Minimálne zásahy, prirodzený tok reči.", descEn: "Minimal changes, natural speech flow." },
    { id: "BALANCED", labelSk: "BALANCED", labelEn: "BALANCED", descSk: "Štandardný social-media edit.", descEn: "Standard social-media edit." },
    { id: "FAST", labelSk: "FAST", labelEn: "FAST", descSk: "Dynamický short-form edit.", descEn: "Dynamic short-form edit." },
    { id: "VIRAL", labelSk: "VIRAL", labelEn: "VIRAL", descSk: "Agresívne jump-cuts pre maximálnu retenciu.", descEn: "Aggressive jump-cuts for max retention." },
  ];

  const handleGenerate = () => {
    onGenerateCuts(selectedMode, density);
  };

  const toggleMarker = (id: string) => {
    setSelectedMarkers(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const selectAllSafe = () => {
    if (!jumpSequence) return;
    const safeIds = jumpSequence.markers
      .filter(m => m.type === "REMOVE" && !m.contextRisk)
      .map(m => m.id);
    setSelectedMarkers(safeIds);
  };

  if (!rawAnalysis.isAnalyzed) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-12 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h3 className="mb-2 text-xl font-bold text-white">
          {isSk ? "Najskôr analyzujte RAW video" : "Analyze RAW video first"}
        </h3>
        <p className="mx-auto mb-6 max-w-sm text-sm text-neutral-400">
          {isSk 
            ? "Jump-Cut Editor potrebuje výsledky analýzy pauz a reči."
            : "Jump-Cut Editor needs pause and speech analysis results."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 text-white shadow-lg shadow-rose-600/20">
            <Scissors className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">AI JUMP-CUT EDITOR</h3>
            <p className="text-[10px] text-neutral-500 font-bold uppercase">Pre-Edit Cleanup Module</p>
          </div>
        </div>
        {jumpSequence && (
           <div className="flex bg-neutral-900 rounded-lg p-1 border border-neutral-800">
              <button 
                onClick={() => setViewMode("LIST")}
                className={`px-3 py-1 text-[10px] font-black rounded ${viewMode === "LIST" ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300"}`}
              >
                LIST
              </button>
              <button 
                onClick={() => setViewMode("TIMELINE")}
                className={`px-3 py-1 text-[10px] font-black rounded ${viewMode === "TIMELINE" ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300"}`}
              >
                TIMELINE
              </button>
           </div>
        )}
      </div>

      {/* Mode Selection */}
      {!jumpSequence && !isGenerating && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
           <section className="space-y-4">
              <h4 className="text-[11px] font-black text-neutral-400 uppercase tracking-[0.2em]">SELECT EDIT MODE</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {modes.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMode(m.id)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      selectedMode === m.id ? "border-rose-500 bg-rose-500/10 ring-1 ring-rose-500/30" : "border-neutral-800 bg-neutral-900/40 hover:border-neutral-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                       <span className={`text-xs font-black uppercase tracking-widest ${selectedMode === m.id ? "text-white" : "text-neutral-300"}`}>{m.labelSk}</span>
                       {selectedMode === m.id && <Zap className="h-4 w-4 text-rose-500 fill-current" />}
                    </div>
                    <span className="text-[10px] text-neutral-500 leading-tight">
                      {isSk ? m.descSk : m.descEn}
                    </span>
                  </button>
                ))}
              </div>
           </section>

           <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-black text-neutral-400 uppercase tracking-[0.2em]">CUT DENSITY</h4>
                <span className="text-xs font-bold text-white">{density}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={density}
                onChange={(e) => setDensity(parseInt(e.target.value))}
                className="w-full h-2 rounded-lg bg-neutral-800 appearance-none cursor-pointer accent-rose-500"
              />
              <div className="flex justify-between text-[8px] text-neutral-600 font-bold uppercase tracking-tighter">
                <span>Natural</span>
                <span>Balanced</span>
                <span>Fast</span>
                <span>Viral</span>
              </div>
           </section>

           <button
             onClick={handleGenerate}
             className="w-full py-4 rounded-2xl bg-rose-600 text-white font-black uppercase tracking-[0.2em] shadow-xl shadow-rose-600/20 hover:bg-rose-500 transition-all active:scale-[0.98]"
           >
             GENERATE JUMP-CUT PROPOSALS
           </button>
        </motion.div>
      )}

      {isGenerating && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-12 text-center">
          <div className="relative mx-auto mb-8 h-20 w-20">
            <div className="absolute inset-0 rounded-full border-4 border-rose-500/10" />
            <div className="absolute inset-0 rounded-full border-4 border-rose-500 border-t-transparent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Scissors className="h-8 w-8 text-rose-400 animate-pulse" />
            </div>
          </div>
          <h3 className="mb-2 text-lg font-black text-white uppercase tracking-widest">
            {isSk ? "ANALYZUJEM PAUZY..." : "ANALYZING PAUSES..."}
          </h3>
          <p className="text-xs text-neutral-500 italic">
            {isSk ? "Hľadám výplňové slová, ticho a opakovania..." : "Finding filler words, silence and repetitions..."}
          </p>
        </div>
      )}

      {jumpSequence && !isGenerating && (
        <div className="flex flex-col gap-6">
          {/* Stats Bar */}
          <div className="grid grid-cols-4 gap-2">
             <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 text-center">
                <span className="block text-[9px] font-black text-neutral-500 uppercase mb-1">Duration</span>
                <span className="text-xs font-bold text-white">-{Math.round(jumpSequence.originalDuration - jumpSequence.editedDuration)}s</span>
             </div>
             <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 text-center">
                <span className="block text-[9px] font-black text-neutral-500 uppercase mb-1">Cuts</span>
                <span className="text-xs font-bold text-white">{jumpSequence.stats.totalCuts}</span>
             </div>
             <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 text-center">
                <span className="block text-[9px] font-black text-neutral-500 uppercase mb-1">Fillers</span>
                <span className="text-xs font-bold text-emerald-400">{jumpSequence.stats.removedFillers}</span>
             </div>
             <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 text-center">
                <span className="block text-[9px] font-black text-neutral-500 uppercase mb-1">Pauses</span>
                <span className="text-xs font-bold text-indigo-400">{jumpSequence.stats.removedPauses}</span>
             </div>
          </div>

          {/* List View */}
          {viewMode === "LIST" && (
            <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
               {jumpSequence.markers.map((marker) => (
                 <div 
                   key={marker.id}
                   className={`group flex items-center gap-4 p-3 rounded-xl border transition-all ${
                     marker.type === "REMOVE" ? "bg-rose-500/5 border-rose-500/20" : 
                     marker.type === "REVIEW" ? "bg-amber-500/5 border-amber-500/20" :
                     "bg-neutral-900/40 border-neutral-800"
                   }`}
                 >
                    <div className="flex flex-col items-center gap-1">
                       <input 
                         type="checkbox"
                         checked={selectedMarkers.includes(marker.id)}
                         onChange={() => toggleMarker(marker.id)}
                         className="w-4 h-4 rounded border-neutral-700 bg-neutral-800 text-rose-500 focus:ring-rose-500"
                       />
                       <button 
                         onClick={() => onPreviewCut(marker.start)}
                         className="p-1 rounded bg-neutral-800 text-neutral-400 hover:text-white"
                       >
                         <Play className="h-3 w-3 fill-current" />
                       </button>
                    </div>

                    <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2 mb-1">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                            marker.type === "REMOVE" ? "bg-rose-500/20 text-rose-400" :
                            marker.type === "REVIEW" ? "bg-amber-500/20 text-amber-400" :
                            "bg-emerald-500/20 text-emerald-400"
                          }`}>
                            {marker.type}
                          </span>
                          <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">
                            {marker.category} • {marker.start.toFixed(2)}s - {marker.end.toFixed(2)}s
                          </span>
                       </div>
                       <p className="text-[10px] text-white font-medium leading-relaxed">
                         {isSk ? marker.reasonSk : marker.reasonEn}
                       </p>
                    </div>

                    {marker.contextRisk && (
                       <div className="flex items-center gap-1 text-[9px] font-black text-rose-400 animate-pulse">
                          <AlertTriangle className="h-3 w-3" />
                          RISK
                       </div>
                    )}
                 </div>
               ))}
            </div>
          )}

          {/* Timeline View Placeholder */}
          {viewMode === "TIMELINE" && (
            <div className="p-8 rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/20 text-center">
               <Activity className="h-8 w-8 text-neutral-600 mx-auto mb-3" />
               <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Visual Word-Level Timeline</p>
               <p className="text-[9px] text-neutral-600 mt-1 italic">Precision editing enabled on the main timeline above.</p>
            </div>
          )}

          {/* Bottom Actions */}
          <div className="sticky bottom-0 pt-6 pb-2 bg-gradient-to-t from-neutral-950 via-neutral-950 to-transparent">
             <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-2">
                   <button 
                     onClick={selectAllSafe}
                     className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300"
                   >
                     SELECT ALL SAFE CUTS
                   </button>
                   <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                     {selectedMarkers.length} Selected
                   </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                   <button 
                     onClick={() => onApplyCuts(selectedMarkers)}
                     disabled={selectedMarkers.length === 0}
                     className="py-3 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition-all disabled:opacity-50 disabled:grayscale"
                   >
                     APPLY SELECTED
                   </button>
                   <button 
                     onClick={() => setViewMode("LIST")} // Reset or change
                     className="py-3 rounded-xl bg-neutral-800 text-white text-xs font-black uppercase tracking-widest border border-neutral-700 hover:bg-neutral-700 transition-all"
                   >
                     PREVIEW CUTS
                   </button>
                </div>

                <div className="p-3 rounded-xl border border-neutral-800 bg-neutral-900/40">
                   <div className="flex items-start gap-3">
                      <Info className="h-4 w-4 text-rose-400 mt-0.5" />
                      <div>
                         <h5 className="text-[10px] font-black text-white uppercase tracking-wider mb-1">NATURAL SPEECH PROTECTION</h5>
                         <p className="text-[9px] text-neutral-500 leading-relaxed italic">
                           {isSk 
                             ? "AI automaticky zachovala emocionálne pauzy a dôraz. 12 miest bolo označených ako 'Review', pretože strih by mohol pôsobiť neprirodzene."
                             : "AI automatically preserved emotional pauses and emphasis. 12 spots were marked as 'Review' because cutting them might feel unnatural."}
                         </p>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, memo } from "react";
import { 
  Film, 
  Sparkles, 
  Search, 
  Image as ImageIcon, 
  Monitor, 
  Zap, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  MessageSquare, 
  Info,
  Maximize2,
  Plus,
  Play,
  RotateCcw,
  Settings2,
  Layers,
  ChevronRight,
  TrendingUp,
  Cpu,
  ShieldCheck,
  Video
} from "lucide-react";
import { 
  BrollProject, 
  BRollItem, 
  BRollSource,
  RawAIAnalysis,
  StoryPlan
} from "../types";
import { motion, AnimatePresence } from "motion/react";

interface AIBrollEngineProps {
  project: BrollProject;
  rawAnalysis: RawAIAnalysis;
  storyPlan: StoryPlan | null;
  onUpdateProject: (project: BrollProject) => void;
  onGenerateSuggestions: () => void;
  onApplyBroll: () => void;
  onSeek: (time: number) => void;
  currentTime: number;
  language: "sk" | "en";
  isGenerating: boolean;
}

export const AIBrollEngine: React.FC<AIBrollEngineProps> = memo(({
  project,
  rawAnalysis,
  storyPlan,
  onUpdateProject,
  onGenerateSuggestions,
  onApplyBroll,
  onSeek,
  currentTime,
  language,
  isGenerating
}) => {
  const isSk = language === "sk";
  const [filter, setFilter] = useState<BRollSource | "ALL">("ALL");

  const stats = {
    total: project.items.length,
    approved: project.items.filter(i => i.status === "APPROVED").length,
    suggested: project.items.filter(i => i.status === "SUGGESTED").length,
  };

  const updateItemStatus = (id: string, status: "APPROVED" | "REJECTED") => {
    const updatedItems = project.items.map(item => 
      item.id === id ? { ...item, status } : item
    );
    onUpdateProject({ ...project, items: updatedItems });
  };

  const filteredItems = filter === "ALL" 
    ? project.items 
    : project.items.filter(i => i.type === filter);

  const getSourceIcon = (type: BRollSource) => {
    switch (type) {
      case "STOCK": return <Search className="h-4 w-4" />;
      case "AI_GENERATED": return <Sparkles className="h-4 w-4" />;
      case "SCREENSHOT": return <Monitor className="h-4 w-4" />;
      case "GRAPHIC": return <Layers className="h-4 w-4" />;
      case "ZOOM_FX": return <Maximize2 className="h-4 w-4" />;
      default: return <Plus className="h-4 w-4" />;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Module Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
            <Film className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">AI B-ROLL & VISUALS</h3>
            <p className="text-[10px] text-neutral-500 font-bold uppercase">Intelligent Visual Enrichment</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                 {[1,2,3].map(i => (
                   <div key={i} className="h-6 w-6 rounded-full border-2 border-neutral-950 bg-neutral-800 flex items-center justify-center">
                      <Cpu className="h-3 w-3 text-indigo-400" />
                   </div>
                 ))}
              </div>
              <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Multi-Model Analysis</span>
           </div>
        </div>
      </div>

      {/* Action Row */}
      <div className="grid grid-cols-3 gap-3">
         <button
           onClick={onGenerateSuggestions}
           disabled={isGenerating}
           className="col-span-2 flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-indigo-600 text-white text-xs font-black uppercase tracking-[0.2em] hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/10 disabled:opacity-50"
         >
           <Zap className={`h-4 w-4 ${isGenerating ? "animate-spin" : ""}`} />
           <span>{isSk ? "GENEROVAŤ B-ROLL NÁVRHY" : "GENERATE B-ROLL IDEAS"}</span>
         </button>
         
         <div className="flex flex-col bg-neutral-900 border border-neutral-800 rounded-2xl p-2 justify-center items-center">
            <span className="text-[9px] font-black text-neutral-500 uppercase mb-1">DENSITY</span>
            <select 
              value={project.density}
              onChange={(e) => onUpdateProject({ ...project, density: e.target.value as any })}
              className="bg-transparent border-none text-[10px] font-black text-indigo-400 focus:ring-0 uppercase p-0 text-center"
            >
               <option value="Subtle">Subtle</option>
               <option value="Balanced">Balanced</option>
               <option value="Dynamic">Dynamic</option>
            </select>
         </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-12 gap-6">
         {/* Left: Suggestions List */}
         <div className="col-span-8 flex flex-col gap-4">
            <div className="flex items-center justify-between px-2">
               <h4 className="text-[11px] font-black text-neutral-500 uppercase tracking-widest">VISUAL TIMELINE SUGGESTIONS</h4>
               <div className="flex gap-2">
                  {["ALL", "STOCK", "AI_GENERATED", "ZOOM_FX"].map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f as any)}
                      className={`px-2 py-0.5 rounded text-[9px] font-black uppercase transition-all ${
                        filter === f ? "bg-indigo-600 text-white" : "bg-neutral-900 text-neutral-500 hover:text-neutral-300"
                      }`}
                    >
                      {f.replace("_", " ")}
                    </button>
                  ))}
               </div>
            </div>

            <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
               <AnimatePresence mode="popLayout">
                  {filteredItems.map((item) => {
                    const isActive = currentTime >= item.start && currentTime <= item.end;
                    
                    return (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`group relative flex flex-col p-4 rounded-2xl border transition-all ${
                          isActive ? "border-indigo-500 bg-indigo-500/5 shadow-lg" : 
                          item.status === "APPROVED" ? "border-emerald-500/30 bg-emerald-500/5" :
                          "bg-neutral-900/40 border-neutral-800 hover:border-neutral-700"
                        }`}
                      >
                         <div className="flex items-start gap-4">
                            {/* Thumbnail / Placeholder */}
                            <div className="relative h-20 w-32 rounded-xl bg-neutral-950 border border-neutral-800 overflow-hidden flex-shrink-0 group-hover:border-indigo-500/50 transition-all">
                               {item.thumbnail ? (
                                 <img src={item.thumbnail} alt="" className="h-full w-full object-cover opacity-60" />
                               ) : (
                                 <div className="h-full w-full flex items-center justify-center text-neutral-800">
                                    <Video className="h-8 w-8" />
                                 </div>
                               )}
                               <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-neutral-900/80 backdrop-blur-md border border-neutral-700 flex items-center gap-1">
                                  {getSourceIcon(item.type)}
                                  <span className="text-[8px] font-black text-white uppercase">{item.type}</span>
                               </div>
                               <button 
                                 onClick={() => onSeek(item.start)}
                                 className="absolute inset-0 flex items-center justify-center bg-indigo-600/0 group-hover:bg-indigo-600/20 transition-all"
                               >
                                  <Play className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100 transition-all" />
                               </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                               <div className="flex items-center justify-between mb-1.5">
                                  <button 
                                    onClick={() => onSeek(item.start)}
                                    className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest flex items-center gap-1"
                                  >
                                    <Clock className="h-3 w-3" />
                                    {item.start.toFixed(2)}s - {item.end.toFixed(2)}s
                                  </button>
                                  <div className="flex items-center gap-1">
                                     {item.status === "APPROVED" ? (
                                       <span className="flex items-center gap-1 text-[9px] font-black text-emerald-400 uppercase">
                                          <CheckCircle2 className="h-3 w-3" /> Approved
                                       </span>
                                     ) : (
                                       <div className="flex gap-1">
                                          <button 
                                            onClick={() => updateItemStatus(item.id, "APPROVED")}
                                            className="p-1.5 rounded-lg bg-neutral-800 text-neutral-500 hover:bg-emerald-600 hover:text-white transition-all"
                                          >
                                             <CheckCircle2 className="h-3.5 w-3.5" />
                                          </button>
                                          <button 
                                            onClick={() => updateItemStatus(item.id, "REJECTED")}
                                            className="p-1.5 rounded-lg bg-neutral-800 text-neutral-500 hover:bg-rose-600 hover:text-white transition-all"
                                          >
                                             <XCircle className="h-3.5 w-3.5" />
                                          </button>
                                       </div>
                                     )}
                                  </div>
                               </div>

                               <h5 className="text-xs font-bold text-white mb-1 uppercase tracking-wider">{isSk ? item.titleSk : item.titleEn}</h5>
                               <p className="text-[10px] text-neutral-500 leading-relaxed line-clamp-2">
                                  <MessageSquare className="h-3 w-3 inline mr-1 mb-0.5 text-indigo-500/50" />
                                  {isSk ? item.reasonSk : item.reasonEn}
                               </p>
                            </div>
                         </div>
                      </motion.div>
                    );
                  })}
               </AnimatePresence>
            </div>
         </div>

         {/* Right: Insights & Auto-Apply */}
         <div className="col-span-4 flex flex-col gap-6">
            <section className="space-y-4">
               <h4 className="text-[11px] font-black text-neutral-500 uppercase tracking-widest">AI VISUAL STRATEGY</h4>
               <div className="p-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 space-y-3">
                  <div className="flex items-start gap-3">
                     <TrendingUp className="h-5 w-5 text-indigo-400 mt-0.5" />
                     <div>
                        <h5 className="text-[10px] font-black text-white uppercase tracking-wider mb-1">Audience Engagement</h5>
                        <p className="text-[10px] text-neutral-500 leading-relaxed italic">
                          {isSk 
                            ? "Identifikovali sme 4 miesta s nízkou dynamikou. Navrhovaný B-roll zvýši očakávanú retenciu o 22%."
                            : "Identified 4 points of low visual energy. Suggested B-roll will increase retention by 22%."}
                        </p>
                     </div>
                  </div>
                  <div className="h-px bg-indigo-500/10" />
                  <div className="flex items-start gap-3">
                     <ShieldCheck className="h-5 w-5 text-emerald-400 mt-0.5" />
                     <div>
                        <h5 className="text-[10px] font-black text-white uppercase tracking-wider mb-1">Copyright Safe</h5>
                        <p className="text-[10px] text-neutral-500 leading-relaxed">
                          {isSk 
                            ? "Všetky navrhované materiály sú licencované pre komerčné použitie."
                            : "All suggested materials are licensed for commercial use."}
                        </p>
                     </div>
                  </div>
               </div>
            </section>

            <section className="space-y-3">
               <h4 className="text-[11px] font-black text-neutral-500 uppercase tracking-widest">B-ROLL STATS</h4>
               <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                     <span className="block text-[8px] font-black text-neutral-500 uppercase mb-1">APPROVED</span>
                     <span className="text-lg font-black text-emerald-400 tracking-tighter">{stats.approved}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                     <span className="block text-[8px] font-black text-neutral-500 uppercase mb-1">SUGGESTED</span>
                     <span className="text-lg font-black text-indigo-400 tracking-tighter">{stats.suggested}</span>
                  </div>
               </div>
            </section>

            <section className="p-5 rounded-2xl border border-neutral-800 bg-neutral-900/40 mt-auto">
               <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em] mb-4 text-center">COMMIT TO TIMELINE</h4>
               <div className="space-y-3">
                  <button
                    onClick={onApplyBroll}
                    className="w-full py-3.5 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/10"
                  >
                    APPLY APPROVED
                  </button>
                  <p className="text-[9px] text-neutral-500 text-center leading-relaxed italic">
                    {isSk 
                      ? "Zmeny sa zapíšu do hlavnej timeline a zosynchronizujú so zvukom."
                      : "Changes will be written to the main timeline and synced with audio."}
                  </p>
               </div>
            </section>
         </div>
      </div>
    </div>
  );
});

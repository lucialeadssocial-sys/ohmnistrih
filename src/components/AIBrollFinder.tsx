import React, { useState } from "react";
import { 
  Film, 
  Search, 
  Sparkles, 
  Image as ImageIcon, 
  Video, 
  Clock, 
  Plus, 
  Check, 
  Layers, 
  Zap, 
  Wand2, 
  Monitor, 
  Smartphone,
  ChevronRight,
  Info,
  Library,
  Cpu,
  History,
  Tag
} from "lucide-react";
import { 
  BrollProject, 
  BRollItem, 
  BRollSource,
  RawAIAnalysis
} from "../types";
import { motion, AnimatePresence } from "motion/react";

interface AIBrollFinderProps {
  project: BrollProject;
  rawAnalysis: RawAIAnalysis;
  onUpdateProject: (project: BrollProject) => void;
  onGenerateSuggestions: () => void;
  language: "sk" | "en";
  isAnalyzing: boolean;
}

export const AIBrollFinder: React.FC<AIBrollFinderProps> = ({
  project,
  rawAnalysis,
  onUpdateProject,
  onGenerateSuggestions,
  language,
  isAnalyzing
}) => {
  const isSk = language === "sk";
  const [selectedSource, setSelectedSource] = useState<BRollSource>("STOCK");

  const approveItem = (id: string) => {
    onUpdateProject({
      ...project,
      items: project.items.map(item => item.id === id ? { ...item, status: "APPROVED" } : item)
    });
  };

  const changeSource = (id: string, source: BRollSource) => {
    onUpdateProject({
      ...project,
      items: project.items.map(item => item.id === id ? { ...item, type: source } : item)
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Module Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500 text-white shadow-lg shadow-cyan-500/20">
            <Film className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">AI B-ROLL FINDER</h3>
            <p className="text-[10px] text-neutral-500 font-bold uppercase">Semantic Visual Mapping</p>
          </div>
        </div>

        <button 
          onClick={onGenerateSuggestions}
          disabled={isAnalyzing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-cyan-600/20 disabled:opacity-50"
        >
          <Sparkles className={`h-3.5 w-3.5 ${isAnalyzing ? "animate-spin" : ""}`} />
          {isAnalyzing ? (isSk ? "SKENUJEM TEXT..." : "SCANNING TEXT...") : (isSk ? "NÁJSŤ B-ROLLY" : "FIND B-ROLLS")}
        </button>
      </div>

      {/* Intro Context */}
      <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-start gap-3">
         <Info className="h-4 w-4 text-cyan-500 mt-0.5" />
         <p className="text-[10px] text-neutral-400 leading-relaxed italic">
           {isSk 
             ? "AI analyzuje každú vetu transcriptu a hľadá vizuálne metafory. Napr. pri slove 'scrolling' navrhne detailný záber na smartfón, ktorý presne kopíruje dĺžku vety."
             : "AI analyzes every sentence of the transcript searching for visual metaphors. E.g., for the word 'scrolling', it suggests a close-up of a smartphone that exactly matches the sentence duration."}
         </p>
      </div>

      {/* Suggested Items List */}
      <div className="space-y-4">
         <div className="flex items-center justify-between px-1">
            <h4 className="text-[11px] font-black text-neutral-500 uppercase tracking-widest">SEMANTIC SUGGESTIONS</h4>
            <span className="text-[9px] font-black text-cyan-400 uppercase bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
              {project.items.length} clips found
            </span>
         </div>

         <div className="space-y-3">
            {project.items.map((item, idx) => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`p-4 rounded-2xl border transition-all ${
                  item.status === "APPROVED" ? "bg-emerald-500/5 border-emerald-500/30" : "bg-neutral-900 border-neutral-800"
                }`}
              >
                 <div className="flex flex-col md:flex-row gap-4">
                    {/* Visual Preview / Thumbnail */}
                    <div className="relative w-full md:w-40 h-24 rounded-xl bg-black border border-neutral-800 overflow-hidden group">
                       {item.thumbnail ? (
                         <img src={item.thumbnail} alt="" className="w-full h-full object-cover opacity-60" />
                       ) : (
                         <div className="w-full h-full flex flex-col items-center justify-center text-neutral-700 bg-neutral-950">
                            <ImageIcon className="h-6 w-6 mb-1" />
                            <span className="text-[8px] font-black uppercase">Preview Pending</span>
                         </div>
                       )}
                       <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                       <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-cyan-400" />
                          <span className="text-[10px] font-bold text-white">{(item.end - item.start).toFixed(1)}s</span>
                       </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-3">
                       <div>
                          <div className="flex items-center gap-2 mb-1">
                             <div className="px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-[8px] font-black text-cyan-400 uppercase">
                                {isSk ? "ZDROJOVÁ VETA" : "SOURCE SENTENCE"}
                             </div>
                             <span className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">TIMING: {item.start}s - {item.end}s</span>
                          </div>
                          <p className="text-xs font-bold text-white italic leading-relaxed">
                             "{isSk ? item.sourceSentenceSk : item.sourceSentenceEn}"
                          </p>
                       </div>

                       <div className="flex flex-wrap gap-2">
                          {item.keywords?.map(kw => (
                            <span key={kw} className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-neutral-800 border border-neutral-700 text-[9px] font-black text-neutral-400 uppercase">
                               <Tag className="h-2.5 w-2.5" /> {kw}
                            </span>
                          ))}
                       </div>

                       <div className="flex items-center justify-between pt-2 border-t border-neutral-800/50">
                          <div className="flex items-center gap-3">
                             <span className="text-[9px] font-black text-neutral-500 uppercase">CHOOSE SOURCE:</span>
                             <div className="flex bg-neutral-950 rounded-lg p-1 border border-neutral-800">
                                {[
                                  { id: "STOCK", icon: <Library className="h-3 w-3" />, label: "Stock" },
                                  { id: "AI_GENERATED", icon: <Cpu className="h-3 w-3" />, label: "AI Gen" },
                                  { id: "USER_UPLOAD", icon: <History className="h-3 w-3" />, label: "My Library" }
                                ].map(src => (
                                  <button
                                    key={src.id}
                                    onClick={() => changeSource(item.id, src.id as BRollSource)}
                                    className={`px-2 py-1 rounded text-[8px] font-black uppercase flex items-center gap-1.5 transition-all ${
                                      item.type === src.id ? "bg-cyan-600 text-white" : "text-neutral-500 hover:text-neutral-300"
                                    }`}
                                  >
                                    {src.icon}
                                    {src.label}
                                  </button>
                                ))}
                             </div>
                          </div>

                          <button 
                            onClick={() => approveItem(item.id)}
                            disabled={item.status === "APPROVED"}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                              item.status === "APPROVED" 
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                                : "bg-white text-black hover:bg-neutral-200"
                            }`}
                          >
                             {item.status === "APPROVED" ? (
                               <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> ADDED</span>
                             ) : (
                               isSk ? "SCHVÁLIŤ" : "APPROVE"
                             )}
                          </button>
                       </div>
                    </div>
                 </div>
              </motion.div>
            ))}
         </div>
      </div>

      {/* Footer Insight */}
      <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20 flex items-center gap-4">
         <div className="h-10 w-10 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-500">
            <Zap className="h-5 w-5" />
         </div>
         <div>
            <p className="text-[10px] font-black text-white uppercase tracking-wider">AI CONTEXTUAL MATCHING ACTIVE</p>
            <p className="text-[9px] text-neutral-500 leading-tight">
               {isSk 
                 ? "AI monitoruje celú timeline a automaticky dopĺňa vizuály tam, kde deteguje pokles vizuálnej dynamiky."
                 : "AI monitors the entire timeline and automatically adds visuals where it detects a drop in visual dynamics."}
            </p>
         </div>
      </div>
    </div>
  );
};

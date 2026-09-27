import React from "react";
import { 
  Split, 
  Zap, 
  Wind, 
  Type, 
  Film, 
  Sparkles, 
  CheckCircle2, 
  Play, 
  Download, 
  TrendingUp, 
  Layers, 
  ArrowRight,
  Info,
  History,
  Activity,
  Maximize2
} from "lucide-react";
import { 
  ABVersionProject, 
  ABVersion 
} from "../types";
import { motion, AnimatePresence } from "motion/react";

interface ABVersionGeneratorProps {
  project: ABVersionProject;
  onGenerate: () => void;
  onPreview: (version: ABVersion) => void;
  language: "sk" | "en";
  isGenerating: boolean;
}

export const ABVersionGenerator: React.FC<ABVersionGeneratorProps> = ({
  project,
  onGenerate,
  onPreview,
  language,
  isGenerating
}) => {
  const isSk = language === "sk";

  const getStyleIcon = (style: ABVersion["style"]) => {
    switch (style) {
      case "FAST_CUTS": return <Zap className="h-5 w-5 text-orange-500" />;
      case "NATURAL": return <Wind className="h-5 w-5 text-emerald-500" />;
      case "HEAVY_CAPTIONS": return <Type className="h-5 w-5 text-blue-500" />;
      case "CINEMATIC": return <Film className="h-5 w-5 text-violet-500" />;
      default: return <Layers className="h-5 w-5" />;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Module Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-600/20">
            <Split className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">A/B VERSION GENERATOR</h3>
            <p className="text-[10px] text-neutral-500 font-bold uppercase">Multi-Style Hypothesis Testing</p>
          </div>
        </div>

        <button 
          onClick={onGenerate}
          disabled={isGenerating}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-violet-600/20 disabled:opacity-50"
        >
          {isGenerating ? <Activity className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {isGenerating ? (isSk ? "GENERUJEM VARIANTY..." : "GENERATING VARIANTS...") : (isSk ? "VYTVORIŤ A/B VERZIE" : "CREATE A/B VERSIONS")}
        </button>
      </div>

      {/* Intro Info */}
      <div className="p-4 rounded-2xl bg-violet-500/5 border border-violet-500/20 flex items-start gap-4">
         <div className="h-10 w-10 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-400 shrink-0">
            <Info className="h-5 w-5" />
         </div>
         <div>
            <p className="text-[11px] font-black text-white uppercase tracking-wider mb-1">STOP GUESSING, START TESTING</p>
            <p className="text-[10px] text-neutral-400 leading-relaxed italic">
               {isSk 
                 ? "Namiesto hľadania jedného ideálneho strihu vytvorte viacero verzií s rôznym tempom a štýlom titulkov. AI pripraví každú verziu ako samostatný projekt pripravený na export."
                 : "Instead of looking for one perfect edit, create multiple versions with different pacing and subtitle styles. AI prepares each version as a separate project ready for export."}
            </p>
         </div>
      </div>

      {!project.isGenerated ? (
        <div className="p-20 rounded-3xl bg-neutral-900/50 border border-neutral-800 border-dashed flex flex-col items-center text-center gap-6">
           <div className="h-24 w-24 rounded-full bg-violet-500/5 flex items-center justify-center border border-violet-500/10">
              <Split className="h-10 w-10 text-violet-500/40" />
           </div>
           <div className="space-y-2">
              <h4 className="text-sm font-black text-white uppercase tracking-widest">{isSk ? "PRIPRAVENÉ NA VARIÁCIE" : "READY FOR VARIATIONS"}</h4>
              <p className="text-[10px] text-neutral-500 font-bold uppercase leading-relaxed max-w-[320px]">
                {isSk ? "Systém vygeneruje 3 unikátne verzie vášho videa založené na rôznych editačných stratégiách." : "The system will generate 3 unique versions of your video based on different editing strategies."}
              </p>
           </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {project.versions.map((version, idx) => (
             <motion.div 
               key={version.id}
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: idx * 0.1 }}
               className="flex flex-col bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden group hover:border-violet-500/50 transition-all shadow-xl"
             >
                {/* Preview Thumbnail Placeholder */}
                <div className="aspect-[9/16] bg-neutral-950 relative flex items-center justify-center overflow-hidden">
                   <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10" />
                   <div className="text-neutral-800 group-hover:scale-110 transition-all duration-700">
                      {getStyleIcon(version.style)}
                   </div>
                   
                   <div className="absolute top-4 left-4 z-20">
                      <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-white/10 backdrop-blur-md ${
                        idx === 0 ? "bg-orange-600/80" : idx === 1 ? "bg-emerald-600/80" : "bg-blue-600/80"
                      }`}>
                         VERSION {String.fromCharCode(65 + idx)}
                      </div>
                   </div>

                   <button 
                     onClick={() => onPreview(version)}
                     className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all bg-black/40 backdrop-blur-[2px]"
                   >
                      <div className="h-12 w-12 rounded-full bg-white text-black flex items-center justify-center shadow-2xl">
                         <Play className="h-6 w-6 fill-current" />
                      </div>
                   </button>
                </div>

                <div className="p-6 space-y-4">
                   <div className="space-y-1">
                      <h4 className="text-sm font-black text-white uppercase tracking-wider">{version.name}</h4>
                      <p className="text-[10px] text-neutral-500 font-bold leading-relaxed italic">
                         {isSk ? version.descriptionSk : version.descriptionEn}
                      </p>
                   </div>

                   {version.metrics && (
                     <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="p-3 rounded-2xl bg-neutral-950 border border-neutral-800">
                           <p className="text-[8px] font-black text-neutral-500 uppercase mb-1">Retention</p>
                           <p className="text-xs font-black text-emerald-500">{version.metrics.estimatedRetention}%</p>
                        </div>
                        <div className="p-3 rounded-2xl bg-neutral-950 border border-neutral-800">
                           <p className="text-[8px] font-black text-neutral-500 uppercase mb-1">Density</p>
                           <p className="text-xs font-black text-violet-400">{version.metrics.visualDensity}%</p>
                        </div>
                     </div>
                   )}

                   <div className="flex items-center gap-2 pt-2">
                      <button className="flex-1 py-2.5 rounded-xl bg-neutral-800 text-white text-[10px] font-black uppercase tracking-widest hover:bg-neutral-700 transition-all">
                         {isSk ? "VYBRAŤ" : "SELECT"}
                      </button>
                      <button className="p-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-500 transition-all">
                         <Download className="h-4 w-4" />
                      </button>
                   </div>
                </div>
             </motion.div>
           ))}
        </div>
      )}

      {/* Comparison Insights */}
      {project.isGenerated && (
        <div className="mt-4 p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4">
           <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              <span className="text-[11px] font-black text-white uppercase tracking-widest">A/B STRATEGY INSIGHT</span>
           </div>
           <p className="text-[10px] text-neutral-400 leading-relaxed italic">
              {isSk 
                ? "Verzia A (Fast Cuts) vykazuje o 22% vyššiu počiatočnú pozornosť, ale Verzia B (Natural) má stabilnejšie dlhodobé udržanie u vzdelávacieho obsahu. Odporúčame nasadiť Verziu A ako reklamu a Verziu B ako organický post."
                : "Version A (Fast Cuts) shows 22% higher initial attention, but Version B (Natural) has more stable long-term retention for educational content. We recommend using Version A as an ad and Version B as an organic post."}
           </p>
        </div>
      )}
    </div>
  );
};

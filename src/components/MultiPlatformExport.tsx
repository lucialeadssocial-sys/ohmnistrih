import React from "react";
import { 
  Share2, 
  Youtube, 
  Smartphone, 
  Facebook, 
  Instagram, 
  Linkedin, 
  Monitor, 
  CheckCircle2, 
  Download, 
  Zap, 
  Layers, 
  Maximize2, 
  Settings2,
  RefreshCcw,
  Clock,
  Sparkles,
  Info,
  ChevronRight,
  ShieldCheck,
  Video,
  Play,
  Pause
} from "lucide-react";
import { 
  MultiExportProject, 
  PlatformExportConfig, 
  ExportPlatform, 
  ExportAspectRatio 
} from "../types";
import { motion, AnimatePresence } from "motion/react";

interface MultiPlatformExportProps {
  project: MultiExportProject;
  onUpdateProject: (project: MultiExportProject) => void;
  onStartExport: () => void;
  language: "sk" | "en";
  isExporting: boolean;
}

export const MultiPlatformExport: React.FC<MultiPlatformExportProps> = ({
  project,
  onUpdateProject,
  onStartExport,
  language,
  isExporting
}) => {
  const isSk = language === "sk";

  const togglePlatform = (id: string) => {
    onUpdateProject({
      ...project,
      configs: project.configs.map(c => c.id === id ? { ...c, isEnabled: !c.isEnabled } : c)
    });
  };

  const toggleAIComposition = (id: string) => {
    onUpdateProject({
      ...project,
      configs: project.configs.map(c => c.id === id ? { ...c, aiCompositionEnabled: !c.aiCompositionEnabled } : c)
    });
  };

  const getPlatformIcon = (platform: ExportPlatform) => {
    switch (platform) {
      case "YOUTUBE": return <Youtube className="h-5 w-5" />;
      case "TIKTOK": return <Smartphone className="h-5 w-5" />;
      case "REELS": return <Instagram className="h-5 w-5" />;
      case "SHORTS": return <Youtube className="h-5 w-5 text-rose-500" />;
      case "FACEBOOK": return <Facebook className="h-5 w-5" />;
      case "INSTAGRAM": return <Instagram className="h-5 w-5" />;
      case "LINKEDIN": return <Linkedin className="h-5 w-5" />;
      default: return <Share2 className="h-5 w-5" />;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Module Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
            <Share2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">MULTI-PLATFORM EXPORT</h3>
            <p className="text-[10px] text-neutral-500 font-bold uppercase">One Content, Every Audience</p>
          </div>
        </div>
      </div>

      {/* Intro Context */}
      <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-start gap-3">
         <Sparkles className="h-4 w-4 text-emerald-400 mt-0.5" />
         <p className="text-[10px] text-neutral-400 leading-relaxed italic">
           {isSk 
             ? "AI Smart Composition nie je len resize. Systém analyzuje dôležité objekty (tváre, produkty) a pre každý formát vytvorí unikátny výrez tak, aby akcia zostala vždy v strede pozornosti."
             : "AI Smart Composition is not just a resize. The system analyzes important objects (faces, products) and creates a unique crop for each format so that the action always stays centered."}
         </p>
      </div>

      {/* Platforms Grid */}
      <div className="grid grid-cols-1 gap-3">
         {project.configs.map((config, idx) => (
           <motion.div 
             key={config.id}
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: idx * 0.05 }}
             className={`p-4 rounded-2xl border transition-all ${
               config.isEnabled ? "bg-neutral-900 border-emerald-500/30" : "bg-neutral-900/40 border-neutral-800"
             }`}
           >
              <div className="flex items-center justify-between gap-4">
                 <div className="flex items-center gap-4 flex-1">
                    <button 
                      onClick={() => togglePlatform(config.id)}
                      className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${
                        config.isEnabled ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "bg-neutral-800 text-neutral-500"
                      }`}
                    >
                       {getPlatformIcon(config.platform)}
                    </button>
                    <div>
                       <div className="flex items-center gap-2">
                          <span className="text-[11px] font-black text-white uppercase tracking-wider">{config.platform}</span>
                          <span className="text-[9px] font-bold text-neutral-500 px-1.5 py-0.5 rounded bg-neutral-800">{config.aspectRatio}</span>
                       </div>
                       <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">{config.quality}</p>
                    </div>
                 </div>

                 <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end gap-1">
                       <label className="flex items-center gap-2 cursor-pointer group">
                          <span className={`text-[10px] font-black uppercase transition-all ${config.aiCompositionEnabled ? "text-emerald-400" : "text-neutral-500 group-hover:text-neutral-300"}`}>
                            {isSk ? "AI Kompozícia" : "AI Composition"}
                          </span>
                          <button 
                            onClick={() => toggleAIComposition(config.id)}
                            className={`w-10 h-5 rounded-full transition-all relative ${config.aiCompositionEnabled ? "bg-emerald-600" : "bg-neutral-800"}`}
                          >
                             <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${config.aiCompositionEnabled ? "left-5.5" : "left-0.5"}`} />
                          </button>
                       </label>
                    </div>

                    <div className="h-8 w-px bg-neutral-800 mx-2" />

                    {config.status === "COMPLETED" ? (
                      <div className="flex items-center gap-2 text-emerald-400">
                         <CheckCircle2 className="h-5 w-5" />
                         <span className="text-[10px] font-black uppercase">READY</span>
                      </div>
                    ) : config.status === "PROCESSING" ? (
                      <div className="flex items-center gap-3">
                         <div className="flex flex-col items-end gap-1 min-w-[110px]">
                            <div className="flex items-center gap-2">
                               <span className="text-[9px] font-black text-emerald-500 animate-pulse uppercase">
                                 {isSk ? "EXPORTUJEM" : "EXPORTING"} {config.progress}%
                               </span>
                               <span className="text-[8px] font-bold text-neutral-400">
                                 (~{config.estimatedSecondsRemaining ?? Math.max(1, Math.ceil((100 - config.progress) / 5))}s)
                               </span>
                            </div>
                            <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                               <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${config.progress}%` }} />
                            </div>
                         </div>
                         <button
                           onClick={() => {
                             onUpdateProject({
                               ...project,
                               configs: project.configs.map(c => c.id === config.id ? { ...c, isPaused: true, status: "PAUSED" } : c)
                             });
                           }}
                           className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-all"
                           title={isSk ? "Pozastaviť" : "Pause"}
                         >
                            <Pause className="h-3.5 w-3.5" />
                         </button>
                      </div>
                    ) : config.status === "PAUSED" ? (
                      <div className="flex items-center gap-3">
                         <div className="flex flex-col items-end gap-1 min-w-[110px]">
                            <div className="flex items-center gap-2">
                               <span className="text-[9px] font-black text-amber-400 uppercase">
                                 {isSk ? "POZASTAVENÉ" : "PAUSED"} ({config.progress}%)
                               </span>
                               <span className="text-[8px] font-bold text-neutral-400">
                                 (~{config.estimatedSecondsRemaining ?? 15}s)
                               </span>
                            </div>
                            <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                               <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${config.progress}%` }} />
                            </div>
                         </div>
                         <button
                           onClick={() => {
                             onUpdateProject({
                               ...project,
                               configs: project.configs.map(c => c.id === config.id ? { ...c, isPaused: false, status: "PROCESSING" } : c)
                             });
                           }}
                           className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-all flex items-center gap-1"
                           title={isSk ? "Pokračovať" : "Resume"}
                         >
                            <Play className="h-3.5 w-3.5 fill-current" />
                         </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => togglePlatform(config.id)}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                          config.isEnabled ? "bg-white text-black" : "bg-neutral-800 text-neutral-500 hover:text-white"
                        }`}
                      >
                         {config.isEnabled ? (isSk ? "AKTÍVNY" : "ACTIVE") : (isSk ? "VYPNUTÝ" : "OFF")}
                      </button>
                    )}
                 </div>
              </div>
           </motion.div>
         ))}
      </div>

      {/* Global Export Action */}
      <div className="mt-4 pt-6 border-t border-neutral-800 space-y-4">
         <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
               <ShieldCheck className="h-4 w-4 text-emerald-500" />
               <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Master Production Hub</span>
            </div>
            <div className="flex items-center gap-1">
               <Clock className="h-3.5 w-3.5 text-neutral-600" />
               <span className="text-[10px] font-bold text-neutral-500">Est. 4m 20s</span>
            </div>
         </div>

         <button
           onClick={onStartExport}
           disabled={isExporting || !project.configs.some(c => c.isEnabled)}
           className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-black uppercase tracking-[0.2em] shadow-xl shadow-emerald-600/20 hover:bg-emerald-500 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
         >
            {isExporting ? (
              <RefreshCcw className="h-5 w-5 animate-spin" />
            ) : (
              <Download className="h-5 w-5" />
            )}
            <span>{isExporting ? (isSk ? "GENEROVÁM VERZIE..." : "GENERATING VERSIONS...") : (isSk ? "SPUSTIŤ MULTI-EXPORT" : "START MULTI-EXPORT")}</span>
         </button>

         <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800">
            <div className="flex items-center gap-3 mb-3">
               <Settings2 className="h-4 w-4 text-neutral-500" />
               <span className="text-[10px] font-black text-white uppercase tracking-widest">Global Export Settings</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <p className="text-[9px] font-black text-neutral-500 uppercase">Codec</p>
                  <p className="text-[10px] font-bold text-white">H.265 (HEVC)</p>
               </div>
               <div className="space-y-1">
                  <p className="text-[9px] font-black text-neutral-500 uppercase">Bitrate</p>
                  <p className="text-[10px] font-bold text-white">VBR 30Mbps (Auto)</p>
               </div>
            </div>
         </div>
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-center gap-6 py-2">
         <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-neutral-600" />
            <span className="text-[9px] font-black text-neutral-500 uppercase">SRT Included</span>
         </div>
         <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-neutral-600" />
            <span className="text-[9px] font-black text-neutral-500 uppercase">Metadata Optimized</span>
         </div>
      </div>
    </div>
  );
};

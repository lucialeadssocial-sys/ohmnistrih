import React, { useState } from "react";
import { 
  Eraser, 
  UserX, 
  MicOff, 
  Trash2, 
  Zap, 
  Target, 
  Search, 
  Layers, 
  ShieldAlert, 
  EyeOff, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  History, 
  Settings2, 
  Activity, 
  Play,
  Maximize2,
  MousePointer2,
  ScanFace,
  Car,
  Wind,
  ShieldCheck,
  RefreshCcw,
  Info
} from "lucide-react";
import { 
  SmartCleanupProject, 
  SmartCleanupMask, 
  RawAIAnalysis 
} from "../types";
import { motion, AnimatePresence } from "motion/react";

interface SmartCleanupSuiteProps {
  project: SmartCleanupProject;
  rawAnalysis: RawAIAnalysis;
  onUpdateProject: (project: SmartCleanupProject) => void;
  onRunDetection: () => void;
  onApplyCleanup: () => void;
  onSeek: (time: number) => void;
  currentTime: number;
  language: "sk" | "en";
  isAnalyzing: boolean;
  isProcessing: boolean;
}

export const SmartCleanupSuite: React.FC<SmartCleanupSuiteProps> = ({
  project,
  rawAnalysis,
  onUpdateProject,
  onRunDetection,
  onApplyCleanup,
  onSeek,
  currentTime,
  language,
  isAnalyzing,
  isProcessing
}) => {
  const isSk = language === "sk";
  const [activeFilter, setActiveFilter] = useState<string>("ALL");

  const getTargetIcon = (target: string) => {
    switch (target) {
      case "FACE": return <ScanFace className="h-4 w-4" />;
      case "MICROPHONE": return <MicOff className="h-4 w-4" />;
      case "PEOPLE": return <UserX className="h-4 w-4" />;
      case "LICENSE_PLATE": return <Car className="h-4 w-4" />;
      case "WATERMARK": return <Layers className="h-4 w-4" />;
      case "BACKGROUND": return <Wind className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  const toggleMaskMode = (maskId: string) => {
    onUpdateProject({
      ...project,
      masks: project.masks.map(m => m.id === maskId ? { ...m, mode: m.mode === "ERASE" ? "BLUR" : "ERASE" } : m)
    });
  };

  const toggleTracking = (maskId: string) => {
    onUpdateProject({
      ...project,
      masks: project.masks.map(m => m.id === maskId ? { ...m, isTracking: !m.isTracking } : m)
    });
  };

  const removeMask = (maskId: string) => {
    onUpdateProject({
      ...project,
      masks: project.masks.filter(m => m.id !== maskId)
    });
  };

  const filteredMasks = project.masks.filter(m => 
    (activeFilter === "ALL") || 
    (activeFilter === "BLUR" && m.mode === "BLUR") ||
    (activeFilter === "ERASE" && m.mode === "ERASE")
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Module Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
            <Eraser className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">AI SMART CLEANUP</h3>
            <p className="text-[10px] text-neutral-500 font-bold uppercase">Non-Destructive Scene Inpainting</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
           <button 
             onClick={onRunDetection}
             disabled={isAnalyzing}
             className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-[10px] font-black text-white uppercase tracking-widest hover:border-indigo-500/50 transition-all disabled:opacity-50"
           >
              <Search className={`h-3.5 w-3.5 ${isAnalyzing ? "animate-spin" : ""}`} />
              {isAnalyzing ? (isSk ? "SKENUJEM..." : "SCANNING...") : (isSk ? "DETEGOVAŤ RUŠIVÉ PRVKY" : "DETECT DISTRACTIONS")}
           </button>
        </div>
      </div>

      {/* Intro Info */}
      <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 flex items-start gap-3">
         <Info className="h-4 w-4 text-indigo-400 mt-0.5" />
         <p className="text-[10px] text-neutral-400 leading-relaxed italic">
           {isSk 
             ? "AI automaticky identifikuje mikrofóny, statívy, tváre a iné neželané objekty. Využíva AI inpainting na ich odstránenie bez straty kvality pozadia."
             : "AI automatically identifies microphones, tripods, faces and other unwanted objects. Uses AI inpainting to remove them without losing background quality."}
         </p>
      </div>

      {/* Cleanup Dashboard */}
      {!project.isAnalyzed ? (
        <div className="p-12 rounded-3xl bg-neutral-900 border border-neutral-800 border-dashed flex flex-col items-center text-center gap-4">
           <div className="h-16 w-16 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-600">
              <Zap className="h-8 w-8" />
           </div>
           <div className="space-y-1">
              <h4 className="text-sm font-black text-white uppercase tracking-widest">{isSk ? "PRIPRAVENÉ NA ČISTENIE" : "READY FOR CLEANUP"}</h4>
              <p className="text-[10px] text-neutral-500 font-bold uppercase leading-relaxed max-w-[240px]">
                {isSk ? "Spustite analýzu scény pre nájdenie tripodov, mikrofónov a osôb v pozadí." : "Run scene analysis to find tripods, microphones and people in the background."}
              </p>
           </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
           {/* Masks List */}
           <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                 <h4 className="text-[11px] font-black text-neutral-500 uppercase tracking-widest">DETECTION RESULTS</h4>
                 <div className="flex gap-2">
                    {["ALL", "ERASE", "BLUR"].map(f => (
                      <button
                        key={f}
                        onClick={() => setActiveFilter(f)}
                        className={`px-2 py-0.5 rounded text-[8px] font-black uppercase transition-all ${
                          activeFilter === f ? "bg-indigo-600 text-white" : "bg-neutral-900 text-neutral-500 hover:text-neutral-300"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                 <AnimatePresence mode="popLayout">
                    {filteredMasks.map((mask, idx) => (
                      <motion.div
                        key={mask.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`p-4 rounded-2xl border transition-all ${
                          mask.status === "CLEANED" ? "bg-emerald-500/5 border-emerald-500/30" : "bg-neutral-900 border-neutral-800"
                        }`}
                      >
                         <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                               <div className="h-9 w-9 rounded-xl bg-indigo-600/10 flex items-center justify-center text-indigo-500 border border-indigo-500/20">
                                  {getTargetIcon(mask.target)}
                               </div>
                               <div>
                                  <p className="text-[10px] font-black text-white uppercase tracking-wider">{mask.target}</p>
                                  <p className="text-[9px] font-bold text-neutral-500">{(mask.confidence * 100).toFixed(0)}% Match</p>
                               </div>
                            </div>
                            <button 
                              onClick={() => removeMask(mask.id)}
                              className="p-1.5 rounded-lg bg-neutral-950 text-neutral-600 hover:text-rose-500 transition-all"
                            >
                               <Trash2 className="h-3.5 w-3.5" />
                            </button>
                         </div>

                         <div className="grid grid-cols-2 gap-2 mb-4">
                            <button 
                              onClick={() => toggleMaskMode(mask.id)}
                              className={`flex items-center justify-center gap-2 py-2 rounded-lg border text-[9px] font-black uppercase transition-all ${
                                mask.mode === "ERASE" ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20" : "bg-neutral-950 border-neutral-800 text-neutral-500"
                              }`}
                            >
                               <Zap className="h-3 w-3" /> Erase
                            </button>
                            <button 
                              onClick={() => toggleMaskMode(mask.id)}
                              className={`flex items-center justify-center gap-2 py-2 rounded-lg border text-[9px] font-black uppercase transition-all ${
                                mask.mode === "BLUR" ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20" : "bg-neutral-950 border-neutral-800 text-neutral-500"
                              }`}
                            >
                               <EyeOff className="h-3 w-3" /> Blur
                            </button>
                         </div>

                         <div className="flex items-center justify-between px-1">
                            <button 
                              onClick={() => toggleTracking(mask.id)}
                              className={`flex items-center gap-2 text-[9px] font-black uppercase transition-all ${
                                mask.isTracking ? "text-indigo-400" : "text-neutral-500"
                              }`}
                            >
                               <Activity className={`h-3 w-3 ${mask.isTracking ? "animate-pulse" : ""}`} />
                               {mask.isTracking ? "AI Tracking Active" : "Static Mask"}
                            </button>
                            <span className="text-[9px] font-black text-neutral-600 tracking-widest">{mask.startTime.toFixed(1)}s - {mask.endTime.toFixed(1)}s</span>
                         </div>
                      </motion.div>
                    ))}
                 </AnimatePresence>
              </div>
           </div>

           {/* Global Settings */}
           <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-6">
              <div className="flex items-center justify-between">
                 <h4 className="text-[11px] font-black text-neutral-500 uppercase tracking-widest">MASTER CLEANUP SETTINGS</h4>
                 <Settings2 className="h-4 w-4 text-neutral-600" />
              </div>

              <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-3">
                    <div className="flex items-center justify-between">
                       <label className="text-[10px] font-black text-neutral-400 uppercase">Blur Intensity</label>
                       <span className="text-xs font-black text-indigo-400">{project.globalSettings.blurIntensity}%</span>
                    </div>
                    <input 
                      type="range" min={0} max={100}
                      value={project.globalSettings.blurIntensity}
                      onChange={(e) => onUpdateProject({ ...project, globalSettings: { ...project.globalSettings, blurIntensity: parseInt(e.target.value) } })}
                      className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none accent-indigo-600"
                    />
                 </div>
                 <div className="space-y-3">
                    <div className="flex items-center justify-between">
                       <label className="text-[10px] font-black text-neutral-400 uppercase">Inpainting Quality</label>
                       <span className="text-[10px] font-black text-indigo-400 uppercase">{project.globalSettings.inpaintingQuality}</span>
                    </div>
                    <div className="flex bg-neutral-950 rounded-lg p-1 border border-neutral-800">
                       <button 
                         onClick={() => onUpdateProject({ ...project, globalSettings: { ...project.globalSettings, inpaintingQuality: "NORMAL" } })}
                         className={`flex-1 py-1 px-3 rounded text-[9px] font-black uppercase transition-all ${project.globalSettings.inpaintingQuality === "NORMAL" ? "bg-neutral-800 text-white" : "text-neutral-500"}`}
                       >
                         Normal
                       </button>
                       <button 
                         onClick={() => onUpdateProject({ ...project, globalSettings: { ...project.globalSettings, inpaintingQuality: "HIGH" } })}
                         className={`flex-1 py-1 px-3 rounded text-[9px] font-black uppercase transition-all ${project.globalSettings.inpaintingQuality === "HIGH" ? "bg-neutral-800 text-white" : "text-neutral-500"}`}
                       >
                         High
                       </button>
                    </div>
                 </div>
              </div>
           </div>

           {/* Final Action */}
           <div className="pt-4">
              <button
                onClick={onApplyCleanup}
                disabled={isProcessing || project.masks.length === 0}
                className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 hover:bg-indigo-500 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
              >
                 {isProcessing ? (
                   <RefreshCcw className="h-5 w-5 animate-spin" />
                 ) : (
                   <ShieldCheck className="h-5 w-5" />
                 )}
                 <span>{isProcessing ? (isSk ? "ČISTÍM SCÉNU..." : "CLEANING SCENE...") : (isSk ? "APLIKOVAŤ AI CLEANUP" : "APPLY AI CLEANUP")}</span>
              </button>
              <p className="text-[9px] text-neutral-500 text-center mt-3 italic">
                 Processing uses Generative Inpainting for invisible object removal. Quality may vary based on scene complexity.
              </p>
           </div>
        </div>
      )}
    </div>
  );
};

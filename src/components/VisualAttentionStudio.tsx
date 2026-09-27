import React, { useState } from "react";
import { 
  Eye, 
  Target, 
  Maximize2, 
  Layers, 
  Zap, 
  Search, 
  User, 
  Package, 
  Type, 
  Monitor, 
  Hand, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  Settings2, 
  Box, 
  Crop, 
  Focus, 
  Move, 
  MousePointer2,
  Info,
  Activity,
  Play
} from "lucide-react";
import { 
  VisualAttentionProject, 
  AttentionPoint, 
  AttentionSuggestion,
  AttentionObjectType,
  RawAIAnalysis
} from "../types";
import { motion, AnimatePresence } from "motion/react";

interface VisualAttentionStudioProps {
  project: VisualAttentionProject;
  rawAnalysis: RawAIAnalysis;
  onUpdateProject: (project: VisualAttentionProject) => void;
  onRunAnalysis: () => void;
  onApplySuggestion: (id: string) => void;
  onSeek: (time: number) => void;
  currentTime: number;
  language: "sk" | "en";
  isAnalyzing: boolean;
}

export const VisualAttentionStudio: React.FC<VisualAttentionStudioProps> = ({
  project,
  rawAnalysis,
  onUpdateProject,
  onRunAnalysis,
  onApplySuggestion,
  onSeek,
  currentTime,
  language,
  isAnalyzing
}) => {
  const isSk = language === "sk";
  const [filter, setFilter] = useState<AttentionObjectType | "ALL">("ALL");

  const getObjectIcon = (type: AttentionObjectType) => {
    switch (type) {
      case "FACE": return <User className="h-3.5 w-3.5" />;
      case "PRODUCT": return <Package className="h-3.5 w-3.5" />;
      case "TEXT": return <Type className="h-3.5 w-3.5" />;
      case "SCREEN": return <Monitor className="h-3.5 w-3.5" />;
      case "GESTURE": return <Hand className="h-3.5 w-3.5" />;
      default: return <Box className="h-3.5 w-3.5" />;
    }
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case "CROP": return <Crop className="h-4 w-4" />;
      case "ZOOM": return <Maximize2 className="h-4 w-4" />;
      case "PAN": return <Move className="h-4 w-4" />;
      case "HIGHLIGHT": return <Focus className="h-4 w-4" />;
      case "BLUR_BG": return <Layers className="h-4 w-4" />;
      default: return <Sparkles className="h-4 w-4" />;
    }
  };

  const currentPoints = project.points.filter(p => 
    Math.abs(p.time - currentTime) < 0.5 && 
    (filter === "ALL" || p.type === filter)
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Module Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-600/20">
            <Eye className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">VISUAL ATTENTION MAP</h3>
            <p className="text-[10px] text-neutral-500 font-bold uppercase">Gaze-Aware Production Intelligence</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
           <button 
             onClick={() => onUpdateProject({ ...project, heatmapEnabled: !project.heatmapEnabled })}
             className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
               project.heatmapEnabled ? "bg-violet-600 border-violet-500 text-white" : "bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-neutral-300"
             }`}
           >
              <Activity className="h-3.5 w-3.5" />
              <span className="text-[10px] font-black uppercase tracking-widest">Heatmap View</span>
           </button>
        </div>
      </div>

      {/* Main Analysis Status */}
      {!project.isAnalyzed ? (
        <div className="p-8 rounded-3xl bg-neutral-900 border border-neutral-800 border-dashed flex flex-col items-center text-center gap-4">
           <div className="h-16 w-16 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-600">
              <Target className="h-8 w-8" />
           </div>
           <div className="space-y-1">
              <h4 className="text-sm font-black text-white uppercase tracking-widest">{isSk ? "ATTENTION ANALÝZA CHÝBA" : "NO ATTENTION ANALYSIS"}</h4>
              <p className="text-[10px] text-neutral-500 font-bold uppercase leading-relaxed max-w-[280px]">
                {isSk ? "AI musí analyzovať vizuálne objekty a pohyb očí diváka pre inteligentný cropping." : "AI needs to analyze visual objects and viewer's gaze for intelligent cropping."}
              </p>
           </div>
           <button 
             onClick={onRunAnalysis}
             disabled={isAnalyzing}
             className="mt-2 flex items-center gap-3 px-6 py-3 rounded-xl bg-violet-600 text-white text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-violet-600/20 hover:bg-violet-500 transition-all disabled:opacity-50"
           >
              <Zap className={`h-4 w-4 ${isAnalyzing ? "animate-spin" : ""}`} />
              <span>{isAnalyzing ? (isSk ? "ANALYZUJEM..." : "ANALYZING...") : (isSk ? "SPUSTIŤ VIZUÁLNU ANALÝZU" : "START VISUAL ANALYSIS")}</span>
           </button>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
           {/* Left: Object Detection & Tracking */}
           <div className="col-span-7 flex flex-col gap-6">
              <section className="space-y-3">
                 <div className="flex items-center justify-between px-1">
                    <h4 className="text-[11px] font-black text-neutral-500 uppercase tracking-widest">REAL-TIME OBJECTS</h4>
                    <div className="flex gap-2">
                       {["ALL", "FACE", "PRODUCT", "TEXT"].map(f => (
                         <button
                           key={f}
                           onClick={() => setFilter(f as any)}
                           className={`px-2 py-0.5 rounded text-[8px] font-black uppercase transition-all ${
                             filter === f ? "bg-violet-600 text-white" : "bg-neutral-900 text-neutral-500 hover:text-neutral-300"
                           }`}
                         >
                           {f}
                         </button>
                       ))}
                    </div>
                 </div>

                 <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    <AnimatePresence mode="popLayout">
                       {currentPoints.map(point => (
                         <motion.div
                           key={point.id}
                           initial={{ opacity: 0, x: -10 }}
                           animate={{ opacity: 1, x: 0 }}
                           exit={{ opacity: 0, x: 10 }}
                           className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/40 border border-neutral-800 group hover:border-violet-500/30 transition-all"
                         >
                            <div className="flex items-center gap-3">
                               <div className="h-8 w-8 rounded-lg bg-violet-600/10 flex items-center justify-center text-violet-500">
                                  {getObjectIcon(point.type)}
                               </div>
                               <div>
                                  <p className="text-[10px] font-black text-white uppercase tracking-wider">{isSk ? point.labelSk : point.labelEn}</p>
                                  <div className="flex items-center gap-2">
                                     <span className="text-[9px] font-black text-neutral-500 uppercase">CONFIDENCE</span>
                                     <span className="text-[10px] font-bold text-violet-400">{Math.round(point.confidence * 100)}%</span>
                                  </div>
                               </div>
                            </div>
                            <div className="text-right">
                               <p className="text-[10px] font-black text-neutral-500 uppercase">COORDS</p>
                               <p className="text-[9px] font-bold text-white">{Math.round(point.box.x)}, {Math.round(point.box.y)}</p>
                            </div>
                         </motion.div>
                       ))}
                    </AnimatePresence>
                    {currentPoints.length === 0 && (
                      <div className="py-8 text-center border border-neutral-800 border-dashed rounded-xl">
                         <Search className="h-6 w-6 text-neutral-700 mx-auto mb-2" />
                         <p className="text-[10px] font-black text-neutral-600 uppercase">Scanning for objects...</p>
                      </div>
                    )}
                 </div>
              </section>

              <section className="p-5 rounded-2xl border border-violet-500/20 bg-violet-500/5">
                 <div className="flex items-start gap-4">
                    <Zap className="h-6 w-6 text-violet-500 mt-1" />
                    <div className="flex-1">
                       <h5 className="text-[11px] font-black text-white uppercase tracking-widest mb-1">AI PRODUCTION SUGGESTION</h5>
                       <p className="text-[10px] text-neutral-400 leading-relaxed italic">
                          {isSk 
                            ? "Divák sa v tejto sekvencii príliš dlho pozerá na nepodstatné pozadie. AI navrhuje Blur-Background a Zoom-In na produkt pre zvýšenie pozornosti o 32%."
                            : "Viewer is looking at irrelevant background for too long in this sequence. AI suggests Blur-Background and Zoom-In on the product to increase attention by 32%."}
                       </p>
                    </div>
                 </div>
              </section>
           </div>

           {/* Right: AI Production Engine Suggestions */}
           <div className="col-span-5 flex flex-col gap-4">
              <h4 className="text-[11px] font-black text-neutral-500 uppercase tracking-widest px-1">PRODUCTION ENGINE</h4>
              
              <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                 {project.suggestions.map(sugg => (
                   <div 
                     key={sugg.id}
                     className={`p-4 rounded-2xl border transition-all ${
                       sugg.applied ? "bg-emerald-500/5 border-emerald-500/30" : "bg-neutral-900 border-neutral-800"
                     }`}
                   >
                      <div className="flex items-center justify-between mb-3">
                         <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${sugg.applied ? "bg-emerald-500 text-white" : "bg-violet-600 text-white shadow-lg shadow-violet-600/20"}`}>
                               {getSuggestionIcon(sugg.type)}
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${sugg.applied ? "text-emerald-400" : "text-white"}`}>{sugg.type}</span>
                         </div>
                         <button 
                           onClick={() => onSeek(sugg.startTime)}
                           className="text-[9px] font-black text-neutral-500 hover:text-white uppercase tracking-widest flex items-center gap-1 transition-all"
                         >
                            <Play className="h-3 w-3" />
                            {sugg.startTime.toFixed(1)}s
                         </button>
                      </div>

                      <p className="text-[10px] text-neutral-400 mb-4 leading-relaxed line-clamp-2 italic">
                         {isSk ? sugg.descriptionSk : sugg.descriptionEn}
                      </p>

                      <button
                        onClick={() => onApplySuggestion(sugg.id)}
                        disabled={sugg.applied}
                        className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          sugg.applied 
                            ? "bg-emerald-500/20 text-emerald-400 cursor-default flex items-center justify-center gap-2" 
                            : "bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-600/10"
                        }`}
                      >
                         {sugg.applied ? (
                           <>
                             <CheckCircle2 className="h-3.5 w-3.5" />
                             <span>APPLIED TO TIMELINE</span>
                           </>
                         ) : (
                           isSk ? "APLIKOVAŤ ÚPRAVU" : "APPLY EDIT"
                         )}
                      </button>
                   </div>
                 ))}
              </div>

              <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 mt-auto">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <MousePointer2 className="h-4 w-4 text-violet-500" />
                       <span className="text-[10px] font-black text-white uppercase tracking-widest">AUTO-FOLLOW MODE</span>
                    </div>
                    <button className="w-10 h-5 rounded-full bg-neutral-800 relative transition-all">
                       <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-neutral-600" />
                    </button>
                 </div>
                 <p className="text-[9px] text-neutral-500 mt-2 italic">Automatically pan & zoom based on the most active attention object.</p>
              </div>
           </div>
        </div>
      )}

      {/* Heatmap Overlay Simulation (Small version for insight) */}
      {project.isAnalyzed && project.heatmapEnabled && (
        <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col gap-4">
           <h4 className="text-[11px] font-black text-neutral-500 uppercase tracking-widest">VISUAL ENERGY DISTRIBUTION</h4>
           <div className="relative h-48 w-full bg-black rounded-xl overflow-hidden group">
              {/* Fake frame */}
              <div className="absolute inset-0 opacity-40">
                 <div className="h-full w-full bg-[radial-gradient(circle_at_center,_rgba(124,58,237,0.4)_0%,_rgba(0,0,0,1)_70%)]" />
                 {currentPoints.map(p => (
                   <div 
                     key={p.id}
                     className="absolute w-20 h-20 rounded-full blur-3xl opacity-60"
                     style={{ 
                       left: `${p.box.x}%`, 
                       top: `${p.box.y}%`, 
                       backgroundColor: p.type === "FACE" ? "red" : p.type === "PRODUCT" ? "orange" : "blue" 
                     }}
                   />
                 ))}
              </div>
              
              {/* Bounding boxes overlay */}
              {currentPoints.map(p => (
                <div 
                  key={`box-${p.id}`}
                  className="absolute border-2 border-violet-500/50 rounded flex flex-col items-start"
                  style={{ 
                    left: `${p.box.x}%`, 
                    top: `${p.box.y}%`, 
                    width: `${p.box.width}%`, 
                    height: `${p.box.height}%` 
                  }}
                >
                   <div className="bg-violet-600 text-[8px] font-black text-white px-1 -mt-5 flex items-center gap-1">
                      {getObjectIcon(p.type)}
                      {p.type}
                   </div>
                </div>
              ))}

              <div className="absolute inset-0 border border-white/5 pointer-events-none" />
              <div className="absolute bottom-3 left-3 flex items-center gap-2 px-2 py-1 bg-black/60 backdrop-blur rounded text-[8px] font-black text-violet-400 border border-violet-500/20">
                 <Zap className="h-3 w-3" />
                 ATTENTION HEATMAP LIVE
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

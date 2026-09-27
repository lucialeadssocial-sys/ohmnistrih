import React, { useState } from "react";
import { 
  Music, 
  Zap, 
  Clock, 
  Activity, 
  Maximize2, 
  Volume2, 
  Layers, 
  CheckCircle2, 
  RefreshCcw, 
  Scissors, 
  Magnet,
  Sparkles,
  Play,
  Settings2,
  BarChart3,
  Waves,
  Timer,
  ChevronRight
} from "lucide-react";
import { 
  BeatSyncProject, 
  BeatMarker, 
  RawAIAnalysis,
  BeatSyncSettings
} from "../types";
import { motion, AnimatePresence } from "motion/react";

interface BeatSyncStudioProps {
  project: BeatSyncProject;
  rawAnalysis: RawAIAnalysis;
  onUpdateProject: (project: BeatSyncProject) => void;
  onAnalyzeBeats: () => void;
  onSnapToBeat: () => void;
  onSeek: (time: number) => void;
  currentTime: number;
  language: "sk" | "en";
  isAnalyzing: boolean;
}

export const BeatSyncStudio: React.FC<BeatSyncStudioProps> = ({
  project,
  rawAnalysis,
  onUpdateProject,
  onAnalyzeBeats,
  onSnapToBeat,
  onSeek,
  currentTime,
  language,
  isAnalyzing
}) => {
  const isSk = language === "sk";
  
  const updateSettings = (updates: Partial<BeatSyncSettings>) => {
    onUpdateProject({
      ...project,
      settings: { ...project.settings, ...updates }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Module Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/20">
            <Music className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">AI BEAT SYNC STUDIO</h3>
            <p className="text-[10px] text-neutral-500 font-bold uppercase">Rhythmic Visual Orchestration</p>
          </div>
        </div>

        {project.isAnalyzed && (
          <div className="flex items-center gap-2 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
             <Waves className="h-3.5 w-3.5 text-amber-500" />
             <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">{project.bpm} BPM DETECTED</span>
          </div>
        )}
      </div>

      {/* Primary Action Card */}
      {!project.isAnalyzed ? (
        <div className="p-8 rounded-3xl bg-neutral-900 border border-neutral-800 border-dashed flex flex-col items-center text-center gap-4">
           <div className="h-16 w-16 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-600">
              <Activity className="h-8 w-8" />
           </div>
           <div className="space-y-1">
              <h4 className="text-sm font-black text-white uppercase tracking-widest">{isSk ? "HUDOBNÁ ANALÝZA CHÝBA" : "NO MUSIC ANALYSIS"}</h4>
              <p className="text-[10px] text-neutral-500 font-bold uppercase leading-relaxed max-w-[240px]">
                {isSk ? "AI musí najprv analyzovať rytmiku hudobnej stopy pre presné časovanie." : "AI needs to analyze the music rhythm for precise timing synchronization."}
              </p>
           </div>
           <button 
             onClick={onAnalyzeBeats}
             disabled={isAnalyzing}
             className="mt-2 px-6 py-3 rounded-xl bg-amber-500 text-white text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-amber-500/20 hover:bg-amber-400 transition-all disabled:opacity-50"
           >
              {isAnalyzing ? (
                <span className="flex items-center gap-2"><RefreshCcw className="h-4 w-4 animate-spin" /> ANALYZING...</span>
              ) : (
                isSk ? "SPUSTIŤ BEAT ANALÝZU" : "START BEAT ANALYSIS"
              )}
           </button>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
           {/* Left: Beat Visualizer & Controls */}
           <div className="col-span-7 flex flex-col gap-6">
              <section className="space-y-3">
                 <h4 className="text-[11px] font-black text-neutral-500 uppercase tracking-widest px-1">RHYTHMIC SNAP INTENSITY</h4>
                 <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-black text-white uppercase tracking-wider">{isSk ? "Sila magnetu" : "Snap Strength"}</span>
                       <span className="text-xs font-black text-amber-500">{project.settings.snapIntensity}%</span>
                    </div>
                    <input 
                      type="range" min={0} max={100}
                      value={project.settings.snapIntensity}
                      onChange={(e) => updateSettings({ snapIntensity: parseInt(e.target.value) })}
                      className="w-full h-2 bg-neutral-800 rounded-lg appearance-none accent-amber-500"
                    />
                    <div className="flex justify-between text-[8px] font-black text-neutral-600 uppercase">
                       <span>Natural</span>
                       <span>Robotic Sync</span>
                    </div>
                 </div>
              </section>

              <section className="space-y-3">
                 <h4 className="text-[11px] font-black text-neutral-500 uppercase tracking-widest px-1">AUTOMATION LAYERS</h4>
                 <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: "autoZoomOnBeat", label: "Auto-Zoom on Drop", icon: <Maximize2 className="h-3.5 w-3.5" /> },
                      { id: "autoSFXOnBeat", label: "Auto-SFX Sync", icon: <Volume2 className="h-3.5 w-3.5" /> },
                      { id: "syncTransitions", label: "Beat-Synced Transitions", icon: <Layers className="h-3.5 w-3.5" /> }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => updateSettings({ [opt.id]: !project.settings[opt.id as keyof BeatSyncSettings] })}
                        className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                          project.settings[opt.id as keyof BeatSyncSettings] ? "bg-amber-500/10 border-amber-500/30 text-amber-500" : "bg-neutral-900/40 border-neutral-800 text-neutral-500"
                        }`}
                      >
                         <div className="flex items-center gap-3">
                            {opt.icon}
                            <span className="text-[10px] font-black uppercase tracking-wider">{opt.label}</span>
                         </div>
                         {project.settings[opt.id as keyof BeatSyncSettings] ? <CheckCircle2 className="h-4 w-4" /> : <div className="h-4 w-4 rounded-full border border-neutral-700" />}
                      </button>
                    ))}
                 </div>
              </section>
           </div>

           {/* Right: Beat Timeline Insight */}
           <div className="col-span-5 flex flex-col gap-4">
              <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 h-full flex flex-col">
                 <h4 className="text-[11px] font-black text-neutral-500 uppercase tracking-widest mb-4">DETECTED PEAKS</h4>
                 
                 <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                    {project.markers.map((marker, idx) => {
                      const isActive = Math.abs(currentTime - marker.time) < 0.1;
                      return (
                        <div 
                          key={marker.id}
                          className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                            isActive ? "bg-amber-500 border-amber-400" : "bg-neutral-950 border-neutral-800 hover:border-neutral-700"
                          }`}
                          onClick={() => onSeek(marker.time)}
                        >
                           <div className="flex items-center gap-2">
                              <span className={`text-[9px] font-black ${isActive ? "text-white" : "text-neutral-500"}`}>{idx + 1}</span>
                              <div className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                isActive ? "bg-white/20 text-white" : 
                                marker.type === "DROP" ? "bg-rose-500/10 text-rose-400" : "bg-indigo-500/10 text-indigo-400"
                              }`}>
                                {marker.type}
                              </div>
                           </div>
                           <span className={`text-[10px] font-black ${isActive ? "text-white" : "text-amber-500"}`}>{marker.time.toFixed(2)}s</span>
                        </div>
                      );
                    })}
                 </div>

                 <div className="mt-6 space-y-3">
                    <button 
                      onClick={onSnapToBeat}
                      className="w-full py-4 rounded-2xl bg-amber-500 text-white text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-amber-500/20 hover:bg-amber-400 transition-all flex items-center justify-center gap-2"
                    >
                       <Magnet className="h-4 w-4" />
                       <span>SNAP CUTS TO BEAT</span>
                    </button>
                    <p className="text-[9px] text-neutral-500 text-center leading-relaxed italic">
                       {isSk ? "Posunie všetky strihy na najbližšie beat markers podľa zvolenej intenzity." : "Aligns all cuts to the nearest beat markers based on intensity."}
                    </p>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Waveform Visualizer Simulation */}
      {project.isAnalyzed && (
        <div className="relative h-24 w-full bg-neutral-950 rounded-2xl border border-neutral-800 overflow-hidden group">
           <div className="absolute inset-0 flex items-end gap-[2px] px-4 pb-2">
              {Array.from({ length: 60 }).map((_, i) => {
                const height = 20 + Math.random() * 60;
                const isMarker = project.markers.some(m => Math.floor(m.time * 2) === i);
                return (
                  <div 
                    key={i} 
                    className={`flex-1 rounded-t-sm transition-all ${isMarker ? "bg-amber-500" : "bg-neutral-800 group-hover:bg-neutral-700"}`} 
                    style={{ height: `${height}%` }} 
                  />
                );
              })}
           </div>
           
           {/* Playhead */}
           <div 
             className="absolute top-0 bottom-0 w-0.5 bg-white z-10 shadow-[0_0_8px_rgba(255,255,255,0.5)] transition-all ease-linear"
             style={{ left: `${(currentTime % 30) * (100 / 30)}%` }}
           />

           <div className="absolute top-2 left-4 px-2 py-0.5 bg-neutral-900/80 backdrop-blur rounded border border-neutral-700">
              <span className="text-[8px] font-black text-amber-500 uppercase">TIMELINE BEAT VISUALIZER</span>
           </div>
        </div>
      )}

      {/* Insights */}
      <div className="grid grid-cols-2 gap-4">
         <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-start gap-3">
            <Zap className="h-5 w-5 text-amber-500 mt-1" />
            <div>
               <h5 className="text-[10px] font-black text-white uppercase tracking-wider mb-1">Energy Peak Detection</h5>
               <p className="text-[9px] text-neutral-500 leading-relaxed italic">
                  {isSk ? "Detegovali sme hlavný DROP na 00:12.4s. AI navrhuje v tomto mieste dramatický Zoom-In." : "Detected main DROP at 00:12.4s. AI suggests a dramatic Zoom-In at this point."}
               </p>
            </div>
         </div>
         <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-indigo-400 mt-1" />
            <div>
               <h5 className="text-[10px] font-black text-white uppercase tracking-wider mb-1">Cinematic Flow</h5>
               <p className="text-[9px] text-neutral-500 leading-relaxed italic">
                  {isSk ? "Synchrónny strih s hudbou zvýši vnímanú kvalitu videa o 40%." : "Synchronous editing with music increases perceived video quality by 40%."}
               </p>
            </div>
         </div>
      </div>
    </div>
  );
};

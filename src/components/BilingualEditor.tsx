import React, { useState } from "react";
import { 
  Globe, 
  Languages, 
  Mic2, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Volume2, 
  Play, 
  Settings2, 
  Zap, 
  ArrowRightLeft, 
  Type, 
  FileText,
  MousePointer2,
  Lock,
  History,
  Info,
  Cpu,
  Waves
} from "lucide-react";
import { 
  BilingualProject, 
  TranslatedSegment, 
  TranslationMode,
  RawAIAnalysis,
  CaptionProject
} from "../types";
import { motion, AnimatePresence } from "motion/react";

interface BilingualEditorProps {
  project: BilingualProject;
  rawAnalysis: RawAIAnalysis;
  captionProject: CaptionProject;
  onUpdateProject: (project: BilingualProject) => void;
  onGenerateTranslation: (mode: TranslationMode) => void;
  onGenerateVoiceover: () => void;
  onSeek: (time: number) => void;
  currentTime: number;
  language: "sk" | "en";
  isGenerating: boolean;
}

export const BilingualEditor: React.FC<BilingualEditorProps> = ({
  project,
  rawAnalysis,
  captionProject,
  onUpdateProject,
  onGenerateTranslation,
  onGenerateVoiceover,
  onSeek,
  currentTime,
  language,
  isGenerating
}) => {
  const isSk = language === "sk";
  const [activeView, setActiveView] = useState<"TRANSLATION" | "VOICEOVER" | "SYNC">("TRANSLATION");

  return (
    <div className="flex flex-col gap-6">
      {/* Module Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">SK ↔ EN BILINGUAL HUB</h3>
            <p className="text-[10px] text-neutral-500 font-bold uppercase">Cross-Language Production</p>
          </div>
        </div>

        <div className="flex bg-neutral-900 rounded-lg p-1 border border-neutral-800">
           {["TRANSLATION", "VOICEOVER", "SYNC"].map((tab) => (
             <button
               key={tab}
               onClick={() => setActiveView(tab as any)}
               className={`px-3 py-1 text-[10px] font-black rounded uppercase transition-all ${
                 activeView === tab ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300"
               }`}
             >
               {tab}
             </button>
           ))}
        </div>
      </div>

      {/* Main Switcher Card */}
      <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 relative overflow-hidden">
         <div className="absolute top-0 right-0 p-8 opacity-5">
            <Languages className="h-32 w-32 text-white" />
         </div>

         <div className="relative flex flex-col items-center gap-6">
            <div className="flex items-center gap-8">
               <div className="flex flex-col items-center gap-2">
                  <div className="h-14 w-14 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xl font-black text-white">SK</div>
                  <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Slovak</span>
               </div>
               <ArrowRightLeft className="h-6 w-6 text-emerald-500" />
               <div className="flex flex-col items-center gap-2">
                  <div className="h-14 w-14 rounded-2xl bg-emerald-600 border border-emerald-500 flex items-center justify-center text-xl font-black text-white shadow-xl shadow-emerald-600/20">EN</div>
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">English</span>
               </div>
            </div>

            <div className="w-full grid grid-cols-2 gap-3">
               <button
                 onClick={() => onGenerateTranslation("NATURAL")}
                 disabled={isGenerating}
                 className={`flex flex-col items-center gap-1 p-4 rounded-2xl border transition-all ${
                   project.mode === "NATURAL" ? "bg-emerald-600 border-emerald-500 shadow-lg" : "bg-neutral-800 border-neutral-700 hover:border-neutral-600"
                 }`}
               >
                  <Sparkles className={`h-5 w-5 mb-1 ${project.mode === "NATURAL" ? "text-white" : "text-emerald-500"}`} />
                  <span className={`text-[11px] font-black uppercase tracking-wider ${project.mode === "NATURAL" ? "text-white" : "text-neutral-300"}`}>NATURAL</span>
                  <span className="text-[9px] text-neutral-400 font-bold uppercase">Context & Rhythm</span>
               </button>
               <button
                 onClick={() => onGenerateTranslation("LITERAL")}
                 disabled={isGenerating}
                 className={`flex flex-col items-center gap-1 p-4 rounded-2xl border transition-all ${
                   project.mode === "LITERAL" ? "bg-emerald-600 border-emerald-500 shadow-lg" : "bg-neutral-800 border-neutral-700 hover:border-neutral-600"
                 }`}
               >
                  <FileText className={`h-5 w-5 mb-1 ${project.mode === "LITERAL" ? "text-white" : "text-emerald-500"}`} />
                  <span className={`text-[11px] font-black uppercase tracking-wider ${project.mode === "LITERAL" ? "text-white" : "text-neutral-300"}`}>LITERAL</span>
                  <span className="text-[9px] text-neutral-400 font-bold uppercase">Word-for-Word</span>
               </button>
            </div>
         </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeView === "TRANSLATION" && (
          <motion.div
            key="trans"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-4"
          >
             <div className="flex items-center justify-between px-2">
                <h4 className="text-[11px] font-black text-neutral-500 uppercase tracking-widest">BILINGUAL SEGMENTS</h4>
                <div className="flex items-center gap-2">
                   <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Accuracy: {project.accuracyScore}%</span>
                </div>
             </div>

             <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {project.translatedTranscript.map((seg, idx) => {
                  const original = captionProject.segments.find(s => s.id === seg.sourceId);
                  return (
                    <div key={seg.id} className="p-4 rounded-2xl bg-neutral-900/40 border border-neutral-800 group hover:border-neutral-700 transition-all">
                       <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-black text-neutral-500 uppercase">Segment {idx + 1}</span>
                          <div className="flex items-center gap-2">
                             <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${seg.lipSyncConfidence > 80 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                                Lip-Sync: {seg.lipSyncConfidence}%
                             </div>
                             <button className="p-1 text-neutral-500 hover:text-white"><History className="h-3 w-3" /></button>
                          </div>
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                             <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-1">
                                <span className="text-neutral-700 font-black">ORIGINAL</span>
                                <span className="h-1 flex-1 bg-neutral-800" />
                             </label>
                             <p className="text-xs font-bold text-neutral-400 leading-relaxed">{original?.text || "..."}</p>
                          </div>
                          <div className="space-y-2">
                             <label className="text-[9px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                                <span className="text-emerald-900 font-black">TRANSLATED</span>
                                <span className="h-1 flex-1 bg-emerald-500/20" />
                             </label>
                             <textarea 
                               value={seg.text}
                               onChange={(e) => {
                                 const updated = project.translatedTranscript.map(s => s.id === seg.id ? { ...s, text: e.target.value } : s);
                                 onUpdateProject({ ...project, translatedTranscript: updated });
                               }}
                               className="w-full bg-transparent border-none p-0 text-xs font-black text-white focus:ring-0 resize-none h-auto min-h-[40px] custom-scrollbar"
                             />
                          </div>
                       </div>
                    </div>
                  );
                })}
             </div>
          </motion.div>
        )}

        {activeView === "VOICEOVER" && (
          <motion.div
            key="voice"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
             <section className="p-5 rounded-3xl border border-emerald-500/20 bg-emerald-500/5">
                <div className="flex items-start gap-4 mb-6">
                   <div className="h-12 w-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white">
                      <Mic2 className="h-6 w-6" />
                   </div>
                   <div className="flex-1">
                      <h4 className="text-sm font-black text-white uppercase tracking-wider mb-1">AI DUBBING & VOICEOVER</h4>
                      <p className="text-[10px] text-neutral-500 font-bold uppercase italic">Generate natural EN narration from SK transcript</p>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-500 uppercase">Voice Profile</label>
                      <select 
                        value={project.voiceover.voiceId}
                        onChange={(e) => onUpdateProject({ ...project, voiceover: { ...project.voiceover, voiceId: e.target.value } })}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl text-xs font-bold text-white p-3 focus:ring-emerald-500"
                      >
                         <option value="v1">Professional Narrator (EN)</option>
                         <option value="v2">Dynamic Creator (EN)</option>
                         <option value="v3">Business Executive (EN)</option>
                         <option value="v4">Friendly Expert (EN)</option>
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-500 uppercase">Emotional Tone</label>
                      <select 
                        value={project.voiceover.emotion}
                        onChange={(e) => onUpdateProject({ ...project, voiceover: { ...project.voiceover, emotion: e.target.value as any } })}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl text-xs font-bold text-white p-3 focus:ring-emerald-500"
                      >
                         <option value="neutral">Neutral</option>
                         <option value="excited">Excited / High Energy</option>
                         <option value="serious">Serious / Authoritative</option>
                         <option value="friendly">Friendly / Conversational</option>
                      </select>
                   </div>
                </div>

                <div className="space-y-4">
                   <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Playback Speed</span>
                      <span className="text-xs font-black text-emerald-400">{project.voiceover.speed}x</span>
                   </div>
                   <input 
                     type="range" min={0.5} max={2.0} step={0.1}
                     value={project.voiceover.speed}
                     onChange={(e) => onUpdateProject({ ...project, voiceover: { ...project.voiceover, speed: parseFloat(e.target.value) } })}
                     className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none accent-emerald-500"
                   />
                </div>
             </section>

             <button 
               onClick={onGenerateVoiceover}
               disabled={isGenerating}
               className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-black uppercase tracking-[0.2em] shadow-xl shadow-emerald-600/20 hover:bg-emerald-500 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
             >
                <Waves className={`h-5 w-5 ${isGenerating ? "animate-pulse" : ""}`} />
                <span>GENERATE AI VOICE</span>
             </button>
          </motion.div>
        )}

        {activeView === "SYNC" && (
          <motion.div
            key="sync"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
             <div className="p-5 rounded-3xl border border-indigo-500/20 bg-indigo-500/5">
                <div className="flex items-center gap-3 mb-4">
                   <Cpu className="h-5 w-5 text-indigo-400" />
                   <h4 className="text-[11px] font-black text-white uppercase tracking-widest">TIMING & B-ROLL SYNC</h4>
                </div>
                
                <div className="space-y-3">
                   <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                      <div className="flex items-center gap-3">
                         <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                            <Clock className="h-4 w-4" />
                         </div>
                         <span className="text-[10px] font-black text-white uppercase">Recalculate Timing</span>
                      </div>
                      <button className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest">RUN AI</button>
                   </div>
                   <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                      <div className="flex items-center gap-3">
                         <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                            <Zap className="h-4 w-4" />
                         </div>
                         <span className="text-[10px] font-black text-white uppercase">Adjust B-Roll to EN Meaning</span>
                      </div>
                      <button className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest">RUN AI</button>
                   </div>
                </div>
             </div>

             <div className="p-4 rounded-2xl border border-neutral-800 bg-neutral-900/20">
                <div className="flex items-start gap-3">
                   <Info className="h-4 w-4 text-neutral-500 mt-0.5" />
                   <p className="text-[10px] text-neutral-500 leading-relaxed italic">
                      {isSk 
                        ? "Anglický preklad je o 12% dlhší než slovenský originál. AI navrhuje predĺženie ticha v stopách 3 a 7 pre dokonalú synchronizáciu."
                        : "English translation is 12% longer than Slovak original. AI suggests extending pauses in tracks 3 and 7 for perfect sync."}
                   </p>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Meta */}
      <div className="pt-4 mt-auto border-t border-neutral-800">
         <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
               <Zap className="h-3 w-3 text-emerald-500" />
               <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Powered by OmniTrans™ AI</span>
            </div>
            <div className="flex items-center gap-4">
               <button className="text-[9px] font-black text-neutral-500 hover:text-white uppercase tracking-widest underline decoration-neutral-800 underline-offset-4">EXPORT SRT (EN)</button>
               <button className="text-[9px] font-black text-neutral-500 hover:text-white uppercase tracking-widest underline decoration-neutral-800 underline-offset-4">DOWNLOAD DUBBING</button>
            </div>
         </div>
      </div>
    </div>
  );
};

import React, { useState } from "react";
import { 
  Mic2, 
  Waves, 
  Wind, 
  Volume2, 
  VolumeX, 
  Zap, 
  Music, 
  Radio, 
  Sliders, 
  CheckCircle2, 
  AlertCircle, 
  Activity, 
  Ear,
  ShieldCheck,
  Smartphone,
  Video,
  Clapperboard,
  User,
  Settings2,
  Trash2,
  Sparkles,
  Info
} from "lucide-react";
import { 
  AudioProject, 
  AudioProcessingSettings, 
  AudioPreset,
  RawAIAnalysis
} from "../types";
import { motion, AnimatePresence } from "motion/react";

interface AIAudioStudioProps {
  project: AudioProject;
  rawAnalysis: RawAIAnalysis;
  onUpdateProject: (project: AudioProject) => void;
  onProcessAudio: () => void;
  language: "sk" | "en";
  isProcessing: boolean;
}

export const AIAudioStudio: React.FC<AIAudioStudioProps> = ({
  project,
  rawAnalysis,
  onUpdateProject,
  onProcessAudio,
  language,
  isProcessing
}) => {
  const isSk = language === "sk";
  const [activeTab, setActiveTab] = useState<"CLEANUP" | "ENHANCE" | "MIX" | "PRESETS">("CLEANUP");

  const presets: { id: AudioPreset; name: string; icon: React.ReactNode; descSk: string; descEn: string }[] = [
    { id: "PODCAST", name: "PODCAST", icon: <Radio className="h-4 w-4" />, descSk: "Hlboký, teplý hlas, potlačenie ruchov.", descEn: "Deep, warm voice, noise suppression." },
    { id: "YOUTUBE", name: "YOUTUBE", icon: <Video className="h-4 w-4" />, descSk: "Jasný, vyvážený zvuk pre dlhšie videá.", descEn: "Clear, balanced sound for long videos." },
    { id: "TIKTOK", name: "TIKTOK", icon: <Smartphone className="h-4 w-4" />, descSk: "Agresívna kompresia, vysoká hlasitosť.", descEn: "Aggressive compression, high loudness." },
    { id: "REEL", name: "REEL", icon: <Smartphone className="h-4 w-4" />, descSk: "Podobné TikTok, optimalizované pre mobil.", descEn: "Similar to TikTok, mobile optimized." },
    { id: "CINEMATIC", name: "CINEMATIC", icon: <Clapperboard className="h-4 w-4" />, descSk: "Široký dynamický rozsah, filmová atmosféra.", descEn: "Wide dynamic range, cinematic feel." },
    { id: "VOICEOVER", name: "VOICEOVER", icon: <User className="h-4 w-4" />, descSk: "Čistý hlas bez pozadia, ideálne pre dabing.", descEn: "Clean voice, no background, ideal for dubbing." },
  ];

  const updateSettings = (updates: Partial<AudioProcessingSettings>) => {
    onUpdateProject({
      ...project,
      settings: { ...project.settings, ...updates }
    });
  };

  const applyPreset = (presetId: AudioPreset) => {
    let newSettings: Partial<AudioProcessingSettings> = { preset: presetId };
    
    switch (presetId) {
      case "PODCAST":
        newSettings = { ...newSettings, voiceEnhancement: 80, noiseRemoval: 70, loudnessNormalization: true };
        break;
      case "TIKTOK":
        newSettings = { ...newSettings, voiceEnhancement: 95, noiseRemoval: 40, loudnessNormalization: true };
        break;
      case "CINEMATIC":
        newSettings = { ...newSettings, voiceEnhancement: 60, noiseRemoval: 50, loudnessNormalization: false };
        break;
    }
    
    updateSettings(newSettings);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Module Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500 text-white shadow-lg shadow-rose-500/20">
            <Mic2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">AI VOICE MATCH & CLEANUP</h3>
            <p className="text-[10px] text-neutral-500 font-bold uppercase">Pro-Grade Audio Mastering</p>
          </div>
        </div>

        <div className="flex bg-neutral-900 rounded-lg p-1 border border-neutral-800">
           {["CLEANUP", "ENHANCE", "MIX", "PRESETS"].map((tab) => (
             <button
               key={tab}
               onClick={() => setActiveTab(tab as any)}
               className={`px-3 py-1 text-[10px] font-black rounded uppercase transition-all ${
                 activeTab === tab ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300"
               }`}
             >
               {tab}
             </button>
           ))}
        </div>
      </div>

      {/* Main Analysis Status */}
      <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
         <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
               <Activity className="h-5 w-5 animate-pulse" />
            </div>
            <div>
               <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">INPUT ANALYSIS</p>
               <p className="text-xs font-bold text-white uppercase">{isSk ? "Detegovaný šum v pozadí: -42dB" : "Background noise detected: -42dB"}</p>
            </div>
         </div>
         <div className="flex gap-4">
            <div className="text-center">
               <p className="text-[10px] font-black text-neutral-500 uppercase">BREATHS</p>
               <p className="text-xs font-bold text-rose-400">{project.artifactsRemoved.breaths}</p>
            </div>
            <div className="text-center">
               <p className="text-[10px] font-black text-neutral-500 uppercase">CLICKS</p>
               <p className="text-xs font-bold text-rose-400">{project.artifactsRemoved.clicks}</p>
            </div>
         </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "CLEANUP" && (
          <motion.div
            key="cleanup"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                   <div className="space-y-2">
                      <div className="flex items-center justify-between">
                         <label className="text-[10px] font-black text-neutral-400 uppercase flex items-center gap-2">
                            <Wind className="h-3 w-3" /> Noise Removal
                         </label>
                         <span className="text-[10px] font-bold text-rose-400">{project.settings.noiseRemoval}%</span>
                      </div>
                      <input 
                        type="range" min={0} max={100} 
                        value={project.settings.noiseRemoval}
                        onChange={(e) => updateSettings({ noiseRemoval: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none accent-rose-500"
                      />
                   </div>
                   <div className="space-y-2">
                      <div className="flex items-center justify-between">
                         <label className="text-[10px] font-black text-neutral-400 uppercase flex items-center gap-2">
                            <Waves className="h-3 w-3" /> Echo Removal
                         </label>
                         <span className="text-[10px] font-bold text-rose-400">{project.settings.echoRemoval}%</span>
                      </div>
                      <input 
                        type="range" min={0} max={100} 
                        value={project.settings.echoRemoval}
                        onChange={(e) => updateSettings({ echoRemoval: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none accent-rose-500"
                      />
                   </div>
                </div>
                <div className="space-y-4">
                   <div className="space-y-2">
                      <div className="flex items-center justify-between">
                         <label className="text-[10px] font-black text-neutral-400 uppercase flex items-center gap-2">
                            <VolumeX className="h-3 w-3" /> Hum Removal
                         </label>
                         <span className="text-[10px] font-bold text-rose-400">{project.settings.humRemoval}%</span>
                      </div>
                      <input 
                        type="range" min={0} max={100} 
                        value={project.settings.humRemoval}
                        onChange={(e) => updateSettings({ humRemoval: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none accent-rose-500"
                      />
                   </div>
                   <div className="space-y-2">
                      <div className="flex items-center justify-between">
                         <label className="text-[10px] font-black text-neutral-400 uppercase flex items-center gap-2">
                            <Ear className="h-3 w-3" /> Breath Control
                         </label>
                         <span className="text-[10px] font-bold text-rose-400">{project.settings.breathControl}%</span>
                      </div>
                      <input 
                        type="range" min={0} max={100} 
                        value={project.settings.breathControl}
                        onChange={(e) => updateSettings({ breathControl: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none accent-rose-500"
                      />
                   </div>
                </div>
             </div>

             <div className="flex gap-4">
                <button 
                  onClick={() => updateSettings({ clippingRepair: !project.settings.clippingRepair })}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-all ${
                    project.settings.clippingRepair ? "bg-rose-500/10 border-rose-500/30 text-rose-400" : "bg-neutral-900 border-neutral-800 text-neutral-500"
                  }`}
                >
                   <ShieldCheck className="h-4 w-4" />
                   <span className="text-[10px] font-black uppercase">Clipping Repair</span>
                </button>
                <button 
                  onClick={() => updateSettings({ loudnessNormalization: !project.settings.loudnessNormalization })}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-all ${
                    project.settings.loudnessNormalization ? "bg-rose-500/10 border-rose-500/30 text-rose-400" : "bg-neutral-900 border-neutral-800 text-neutral-500"
                  }`}
                >
                   <Volume2 className="h-4 w-4" />
                   <span className="text-[10px] font-black uppercase">Loudness Norm.</span>
                </button>
             </div>
          </motion.div>
        )}

        {activeTab === "ENHANCE" && (
          <motion.div
            key="enhance"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
             <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 flex flex-col items-center gap-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-xl shadow-rose-500/20">
                   <Sparkles className="h-8 w-8" />
                </div>
                <div className="text-center space-y-1">
                   <h4 className="text-sm font-black text-white uppercase tracking-widest">AI VOICE ENHANCEMENT</h4>
                   <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Studio-quality vocal processing</p>
                </div>
                <div className="w-full space-y-4">
                   <div className="flex items-center justify-between px-2">
                      <span className="text-[10px] font-black text-neutral-500 uppercase">Intensity</span>
                      <span className="text-xs font-black text-rose-400">{project.settings.voiceEnhancement}%</span>
                   </div>
                   <input 
                     type="range" min={0} max={100} 
                     value={project.settings.voiceEnhancement}
                     onChange={(e) => updateSettings({ voiceEnhancement: parseInt(e.target.value) })}
                     className="w-full h-2 bg-neutral-800 rounded-lg appearance-none accent-rose-500"
                   />
                </div>
             </div>

             <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20">
                <div className="flex items-start gap-3">
                   <Info className="h-4 w-4 text-rose-400 mt-0.5" />
                   <p className="text-[10px] text-neutral-400 leading-relaxed italic">
                      {isSk 
                        ? "AI automaticky identifikovala typ mikrofónu a prispôsobila EQ krivku pre dosiahnutie teplého 'podcastového' charakteru hlasu."
                        : "AI automatically identified the microphone type and adjusted the EQ curve to achieve a warm 'podcast' vocal character."}
                   </p>
                </div>
             </div>
          </motion.div>
        )}

        {activeTab === "MIX" && (
          <motion.div
            key="mix"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
             <div className="grid grid-cols-1 gap-4">
                <div className="space-y-3">
                   <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-neutral-400 uppercase flex items-center gap-2">
                         <User className="h-3 w-3" /> Voice Volume
                      </label>
                      <span className="text-[10px] font-bold text-white">{project.settings.mix.voice}%</span>
                   </div>
                   <input 
                     type="range" min={0} max={100} 
                     value={project.settings.mix.voice}
                     onChange={(e) => updateSettings({ mix: { ...project.settings.mix, voice: parseInt(e.target.value) } })}
                     className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none accent-rose-500"
                   />
                </div>
                <div className="space-y-3">
                   <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-neutral-400 uppercase flex items-center gap-2">
                         <Music className="h-3 w-3" /> Music Volume
                      </label>
                      <span className="text-[10px] font-bold text-white">{project.settings.mix.music}%</span>
                   </div>
                   <input 
                     type="range" min={0} max={100} 
                     value={project.settings.mix.music}
                     onChange={(e) => updateSettings({ mix: { ...project.settings.mix, music: parseInt(e.target.value) } })}
                     className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none accent-rose-500"
                   />
                </div>
                <div className="space-y-3">
                   <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-neutral-400 uppercase flex items-center gap-2">
                         <Zap className="h-3 w-3" /> SFX Volume
                      </label>
                      <span className="text-[10px] font-bold text-white">{project.settings.mix.sfx}%</span>
                   </div>
                   <input 
                     type="range" min={0} max={100} 
                     value={project.settings.mix.sfx}
                     onChange={(e) => updateSettings({ mix: { ...project.settings.mix, sfx: parseInt(e.target.value) } })}
                     className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none accent-rose-500"
                   />
                </div>
             </div>

             <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                         <Volume2 className="h-4 w-4" />
                      </div>
                      <div>
                         <p className="text-[10px] font-black text-white uppercase tracking-wider">AUTO MUSIC DUCKING</p>
                         <p className="text-[9px] text-neutral-500">Lower music during speech</p>
                      </div>
                   </div>
                   <button 
                     onClick={() => updateSettings({ musicDucking: { ...project.settings.musicDucking, enabled: !project.settings.musicDucking.enabled } })}
                     className={`w-12 h-6 rounded-full transition-all relative ${project.settings.musicDucking.enabled ? "bg-rose-500" : "bg-neutral-800"}`}
                   >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${project.settings.musicDucking.enabled ? "left-7" : "left-1"}`} />
                   </button>
                </div>
                {project.settings.musicDucking.enabled && (
                   <div className="space-y-2">
                      <div className="flex items-center justify-between">
                         <span className="text-[9px] font-black text-neutral-500 uppercase">Ducking Strength</span>
                         <span className="text-[10px] font-bold text-rose-400">{project.settings.musicDucking.strength}%</span>
                      </div>
                      <input 
                        type="range" min={0} max={100} 
                        value={project.settings.musicDucking.strength}
                        onChange={(e) => updateSettings({ musicDucking: { ...project.settings.musicDucking, strength: parseInt(e.target.value) } })}
                        className="w-full h-1 bg-neutral-800 rounded-lg appearance-none accent-rose-500"
                      />
                   </div>
                )}
             </div>
          </motion.div>
        )}

        {activeTab === "PRESETS" && (
          <motion.div
            key="presets"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-2 gap-3"
          >
             {presets.map(p => (
               <button
                 key={p.id}
                 onClick={() => applyPreset(p.id)}
                 className={`flex flex-col p-4 rounded-2xl border transition-all text-left group ${
                   project.settings.preset === p.id ? "bg-rose-500 border-rose-400 shadow-lg" : "bg-neutral-900/40 border-neutral-800 hover:border-neutral-700"
                 }`}
               >
                  <div className={`h-8 w-8 rounded-lg mb-3 flex items-center justify-center transition-all ${
                    project.settings.preset === p.id ? "bg-white/20 text-white" : "bg-neutral-800 text-rose-500 group-hover:scale-110"
                  }`}>
                     {p.icon}
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest mb-1 ${project.settings.preset === p.id ? "text-white" : "text-white"}`}>
                    {p.name}
                  </span>
                  <span className={`text-[9px] leading-tight ${project.settings.preset === p.id ? "text-rose-100" : "text-neutral-500"}`}>
                    {isSk ? p.descSk : p.descEn}
                  </span>
               </button>
             ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Actions */}
      <div className="pt-6 border-t border-neutral-800">
         <button
           onClick={onProcessAudio}
           disabled={isProcessing}
           className="w-full py-4 rounded-2xl bg-rose-600 text-white font-black uppercase tracking-[0.2em] shadow-xl shadow-rose-600/20 hover:bg-rose-500 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
         >
            <Zap className={`h-5 w-5 ${isProcessing ? "animate-spin" : ""}`} />
            <span>{isSk ? "APLIKOVAŤ MASTERING" : "APPLY AUDIO MASTERING"}</span>
         </button>
      </div>
    </div>
  );
};

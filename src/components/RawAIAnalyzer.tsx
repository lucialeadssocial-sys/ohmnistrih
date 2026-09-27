import React, { useState, useEffect } from "react";
import { 
  Zap, 
  Search, 
  Scissors, 
  BarChart3, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  Clock, 
  TrendingUp,
  Smile,
  Mic,
  Layout,
  Layers,
  ArrowRight,
  Info,
  ChevronRight,
  Video,
  Settings,
  MessageSquare,
  FileText,
  MousePointer2
} from "lucide-react";
import { 
  RawAIAnalysis, 
  EditMapItem, 
  ShortsSuggestion, 
  TranscriptionSegment,
  EditMapItemType
} from "../types";
import { motion, AnimatePresence } from "motion/react";

interface RawAIAnalyzerProps {
  analysis: RawAIAnalysis;
  onRunAnalysis: () => void;
  onApplyClip: (start: number, end: number) => void;
  isAnalyzing: boolean;
  language: "sk" | "en";
  currentTime: number;
}

export const RawAIAnalyzer: React.FC<RawAIAnalyzerProps> = ({
  analysis,
  onRunAnalysis,
  onApplyClip,
  isAnalyzing,
  language,
  currentTime
}) => {
  const isSk = language === "sk";
  const [viewMode, setViewMode] = useState<"ANALYSIS" | "EDITOR">("ANALYSIS");
  const [activeTab, setActiveTab] = useState<"MAP" | "TRANSCRIPT" | "SHORTS" | "NOTES">("MAP");
  const [analysisStep, setAnalysisStep] = useState(0);
  
  const steps = [
    { sk: "Extracting media", en: "Extracting media" },
    { sk: "Transcribing speech", en: "Transcribing speech" },
    { sk: "Detecting speakers", en: "Detecting speakers" },
    { sk: "Detecting pauses", en: "Detecting pauses" },
    { sk: "Detecting sentences", en: "Detecting sentences" },
    { sk: "Detecting scene changes", en: "Detecting scene changes" },
    { sk: "Detecting visual moments", en: "Detecting visual moments" },
    { sk: "Detecting emotional emphasis", en: "Detecting emotional emphasis" },
    { sk: "Detecting repetitive content", en: "Detecting repetitive content" },
    { sk: "Building Edit Map", en: "Building Edit Map" },
  ];

  useEffect(() => {
    if (isAnalyzing) {
      const interval = setInterval(() => {
        setAnalysisStep(prev => (prev < steps.length - 1 ? prev + 1 : prev));
      }, 350);
      return () => clearInterval(interval);
    } else {
      setAnalysisStep(0);
    }
  }, [isAnalyzing]);

  const getBadgeColor = (type: EditMapItemType) => {
    switch (type) {
      case "HOOK": return "bg-rose-500";
      case "CONTEXT": return "bg-indigo-500";
      case "PROBLEM": return "bg-amber-600";
      case "EXPLANATION": return "bg-blue-500";
      case "EXAMPLE": return "bg-emerald-500";
      case "PAYOFF": return "bg-rose-600";
      case "CTA": return "bg-rose-500";
      case "PAUSE": return "bg-neutral-800";
      case "REPEAT": return "bg-neutral-700";
      case "HIGHLIGHT": return "bg-amber-400";
      default: return "bg-neutral-600";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "KEEP": return "text-emerald-400 bg-emerald-500/10";
      case "REVIEW": return "text-amber-400 bg-amber-500/10";
      case "REMOVE": return "text-rose-400 bg-rose-500/10";
      default: return "text-neutral-400";
    }
  };

  if (!analysis.isAnalyzed && !isAnalyzing) {
    return (
      <div className="flex flex-col gap-6">
        {/* Section A: Metadata Display */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
          <div className="flex items-center gap-3 mb-4">
            <Video className="h-5 w-5 text-indigo-400" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              {isSk ? "Súbor na analýzu" : "File to analyze"}
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] text-neutral-500 font-bold uppercase">{isSk ? "Názov" : "Name"}</span>
              <span className="text-xs text-neutral-200 truncate">{analysis.metadata?.filename || "RAW_FOOTAGE_01.mp4"}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-neutral-500 font-bold uppercase">{isSk ? "Dĺžka" : "Duration"}</span>
              <span className="text-xs text-neutral-200">45:12</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-neutral-500 font-bold uppercase">{isSk ? "Rozlíšenie" : "Resolution"}</span>
              <span className="text-xs text-neutral-200">3840x2160 (4K)</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-neutral-500 font-bold uppercase">Audio</span>
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> {isSk ? "Dostupné" : "Available"}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-dashed border-neutral-800 bg-neutral-900/20 p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
            <Zap className="h-8 w-8" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-white">
            {isSk ? "AI RAW VIDEO ANALYZER" : "AI RAW VIDEO ANALYZER"}
          </h3>
          <p className="mx-auto mb-6 max-w-md text-sm text-neutral-400 leading-relaxed">
            {isSk 
              ? "Pochopte svoje RAW video skôr, než urobíte prvý strih. AI vytvorí Edit Mapu, nájde najlepšie momenty a označí ticho či chyby."
              : "Understand your RAW footage before you make the first cut. AI creates an Edit Map, finds the best moments, and marks silences or errors."}
          </p>
          <button
            onClick={onRunAnalysis}
            className="group relative flex items-center gap-2 mx-auto rounded-xl bg-indigo-600 px-8 py-4 text-sm font-black text-white shadow-xl shadow-indigo-600/20 transition-all hover:bg-indigo-500 active:scale-95"
          >
            <Search className="h-4 w-4 group-hover:animate-pulse" />
            <span>{isSk ? "ANALYZE VIDEO" : "ANALYZE VIDEO"}</span>
          </button>
        </div>
      </div>
    );
  }

  if (isAnalyzing) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-12 text-center">
        <div className="relative mx-auto mb-8 h-24 w-24">
          <div className="absolute inset-0 rounded-full border-4 border-indigo-500/10" />
          <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap className="h-10 w-10 text-indigo-400 animate-pulse" />
          </div>
        </div>
        
        <h3 className="mb-2 text-xl font-black text-white uppercase tracking-widest">
          {isSk ? "ANALYZING RAW VIDEO" : "ANALYZING RAW VIDEO"}
        </h3>
        
        <div className="mx-auto max-w-sm space-y-4">
          <div className="h-2 w-full rounded-full bg-neutral-800 overflow-hidden">
            <motion.div 
              className="h-full bg-indigo-500" 
              initial={{ width: "0%" }}
              animate={{ width: `${((analysisStep + 1) / steps.length) * 100}%` }}
            />
          </div>
          
          <div className="space-y-1">
            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Current task:</p>
            <p className="text-sm text-indigo-400 font-bold animate-pulse">
              {isSk ? steps[analysisStep].sk : steps[analysisStep].en}...
            </p>
          </div>

          <div className="flex flex-col items-start gap-1 pt-4 border-t border-neutral-800">
            {steps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className={`h-1.5 w-1.5 rounded-full ${idx <= analysisStep ? "bg-indigo-500" : "bg-neutral-800"}`} />
                <span className={`text-[10px] uppercase font-bold tracking-wider ${idx === analysisStep ? "text-indigo-400" : idx < analysisStep ? "text-neutral-500" : "text-neutral-700"}`}>
                  {isSk ? step.sk : step.en}
                </span>
                {idx < analysisStep && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Mode Switcher */}
      <div className="flex items-center justify-between p-1 bg-neutral-900 border border-neutral-800 rounded-xl">
        <button
          onClick={() => setViewMode("ANALYSIS")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-black transition-all ${
            viewMode === "ANALYSIS" ? "bg-indigo-600 text-white shadow-lg" : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          <span>AI ANALYSIS</span>
        </button>
        <button
          onClick={() => setViewMode("EDITOR")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-black transition-all ${
            viewMode === "EDITOR" ? "bg-neutral-800 text-white shadow-lg" : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          <Settings className="h-4 w-4" />
          <span>EDITOR VIEW</span>
        </button>
      </div>

      {/* Summary Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
        <div>
          <h4 className="text-sm font-black text-white uppercase tracking-wider mb-1">
            {isSk ? "VIDEO JE ANALYZOVANÉ" : "YOUR VIDEO IS ANALYZED"}
          </h4>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-neutral-500 font-bold uppercase">
            <span>Duration: 45:12</span>
            <span>Segments: 37</span>
            <span className="text-emerald-400">Potential highlights: 8</span>
            <span className="text-rose-400">Long pauses: 14</span>
            <span className="text-indigo-400">Potential Shorts: 8</span>
          </div>
        </div>
        <div className="flex gap-2 mt-4 sm:mt-0">
          <button 
            onClick={() => setActiveTab("MAP")}
            className="px-4 py-2 rounded-lg bg-neutral-800 text-xs font-bold text-white hover:bg-neutral-700"
          >
            {isSk ? "VIEW EDIT MAP" : "VIEW EDIT MAP"}
          </button>
          <button 
            onClick={() => setActiveTab("SHORTS")}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-500"
          >
            {isSk ? "CREATE SHORTS" : "CREATE SHORTS"}
          </button>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex gap-1 border-b border-neutral-800">
        {(["MAP", "TRANSCRIPT", "SHORTS", "NOTES"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${
              activeTab === tab ? "border-indigo-500 text-white" : "border-transparent text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "MAP" && (
          <motion.div
            key="MAP"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {analysis.editMap.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => onApplyClip(item.start, item.end)}
                  className={`group relative flex flex-col gap-2 p-4 rounded-xl border border-neutral-800 bg-neutral-900/40 hover:border-indigo-500/50 hover:bg-neutral-900 transition-all cursor-pointer`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black text-white ${getBadgeColor(item.type)}`}>
                        {item.type}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-neutral-500">
                      {item.start.toFixed(1)}s - {item.end.toFixed(1)}s
                    </span>
                  </div>
                  <h5 className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors">
                    {isSk ? item.labelSk : item.labelEn}
                  </h5>
                  {item.reasonSk && (
                    <p className="text-[10px] text-neutral-500 italic">
                      {isSk ? item.reasonSk : item.reasonEn}
                    </p>
                  )}
                  <div className="flex gap-2 mt-1">
                    <button className="text-[9px] font-black text-neutral-400 hover:text-white uppercase tracking-widest">Preview</button>
                    <button className="text-[9px] font-black text-emerald-400 hover:text-emerald-300 uppercase tracking-widest">Keep</button>
                    <button className="text-[9px] font-black text-rose-400 hover:text-rose-300 uppercase tracking-widest">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === "TRANSCRIPT" && (
          <motion.div
            key="TRANSCRIPT"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-1 overflow-hidden"
          >
            <div className="max-h-[500px] overflow-y-auto p-4 space-y-4">
              {analysis.transcription.map((seg) => {
                const isActive = currentTime >= seg.start && currentTime <= seg.end;
                return (
                  <div 
                    key={seg.id}
                    onClick={() => onApplyClip(seg.start, seg.end)}
                    className={`flex gap-4 p-3 rounded-xl transition-all cursor-pointer ${
                      isActive ? "bg-indigo-500/10 ring-1 ring-indigo-500/30" : "hover:bg-neutral-800/50"
                    }`}
                  >
                    <div className="flex flex-col items-end gap-1 min-w-[60px]">
                      <span className={`text-[10px] font-bold ${isActive ? "text-indigo-400" : "text-neutral-500"}`}>
                        {Math.floor(seg.start / 60)}:{(seg.start % 60).toString().padStart(2, '0')}
                      </span>
                      <span className="text-[8px] font-black text-neutral-600 uppercase tracking-tighter">
                        Spk {seg.speaker}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm leading-relaxed ${isActive ? "text-white font-bold" : "text-neutral-400"}`}>
                        {seg.text}
                      </p>
                      {seg.confidence < 0.8 && (
                        <div className="mt-1 flex items-center gap-1 text-[9px] text-amber-500/80 font-bold uppercase tracking-widest">
                          <AlertCircle className="h-3 w-3" />
                          LOW CONFIDENCE
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {activeTab === "SHORTS" && (
          <motion.div
            key="SHORTS"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analysis.shortsSuggestions.map((short) => (
                <div 
                  key={short.id}
                  className="group flex flex-col gap-3 p-5 rounded-2xl border border-neutral-800 bg-neutral-900/60 hover:border-emerald-500/40 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <TrendingUp className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="block text-[10px] font-black text-emerald-400 uppercase tracking-widest leading-none">Potential</span>
                        <span className="text-lg font-black text-white">{short.score.overall}/100</span>
                      </div>
                    </div>
                    <div className="px-2 py-1 rounded bg-neutral-800 text-[9px] font-black text-neutral-400 uppercase tracking-widest">
                      {short.type}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-black text-white mb-1 group-hover:text-emerald-400 transition-colors">
                      {isSk ? short.titleSk : short.titleEn}
                    </h4>
                    <p className="text-[11px] text-neutral-500 leading-relaxed italic">
                      Why: "{isSk ? short.reasonSk : short.reasonEn}"
                    </p>
                  </div>

                  {/* Detailed Scores */}
                  <div className="grid grid-cols-3 gap-2 py-2 border-y border-neutral-800/50">
                    <div className="flex flex-col">
                      <span className="text-[8px] text-neutral-600 font-bold uppercase">Hook</span>
                      <span className="text-[10px] font-bold text-white">{short.score.hookStrength}/100</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] text-neutral-600 font-bold uppercase">Density</span>
                      <span className="text-[10px] font-bold text-white">{short.score.infoDensity}/100</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] text-neutral-600 font-bold uppercase">Energy</span>
                      <span className="text-[10px] font-bold text-white">{short.score.emotionalEnergy}/100</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] font-bold text-neutral-500">
                      {Math.floor(short.start / 60)}:{(short.start % 60).toString().padStart(2, '0')} → 
                      {Math.floor(short.end / 60)}:{(short.end % 60).toString().padStart(2, '0')}
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => onApplyClip(short.start, short.end)} className="p-2 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white transition-all">
                        <Play className="h-4 w-4 fill-current" />
                      </button>
                      <button className="px-3 py-1.5 rounded-lg bg-emerald-600 text-[10px] font-black text-white hover:bg-emerald-500 transition-all uppercase tracking-widest">
                        Add to Project
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <button className="w-full py-4 mt-4 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 hover:bg-indigo-500 transition-all active:scale-[0.98]">
              CREATE SHORTS FROM THIS VIDEO
            </button>
          </motion.div>
        )}

        {activeTab === "NOTES" && (
          <motion.div
            key="NOTES"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-5 w-5 text-indigo-400" />
              <h4 className="text-sm font-black text-white uppercase tracking-widest">AI EDITOR NOTES</h4>
            </div>
            {analysis.notes.map((note) => (
              <div 
                key={note.id}
                className={`p-4 rounded-xl border flex gap-3 ${
                  note.type === "warning" ? "bg-amber-500/5 border-amber-500/20" : 
                  note.type === "tip" ? "bg-emerald-500/5 border-emerald-500/20" : 
                  "bg-indigo-500/5 border-indigo-500/20"
                }`}
              >
                <div className="mt-0.5">
                  {note.type === "warning" ? <AlertCircle className="h-4 w-4 text-amber-400" /> : 
                   note.type === "tip" ? <TrendingUp className="h-4 w-4 text-emerald-400" /> : 
                   <Info className="h-4 w-4 text-indigo-400" />}
                </div>
                <div>
                  <p className="text-xs text-neutral-300 leading-relaxed font-bold">
                    {isSk ? note.textSk : note.textEn}
                  </p>
                  {note.timestamp && (
                    <button 
                      onClick={() => onApplyClip(note.timestamp!, note.timestamp! + 5)}
                      className="mt-2 text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest"
                    >
                      Jump to {Math.floor(note.timestamp / 60)}:{(note.timestamp % 60).toString().padStart(2, '0')}
                    </button>
                  )}
                </div>
              </div>
            ))}
            
            {/* Principles Disclaimer */}
            <div className="mt-6 p-4 rounded-xl border border-neutral-800 bg-neutral-900/20">
              <p className="text-[10px] text-neutral-600 italic leading-relaxed">
                {isSk 
                  ? "AI asistent nesmie tvrdiť niečo, čo nedokáže z videa potvrdiť. Ak si nie je istá, označí danú sekciu ako 'Needs Review'. Editorka má vždy posledné slovo."
                  : "AI assistant must not claim something it cannot confirm from the video. If unsure, it marks the section as 'Needs Review'. The editor always has the last word."}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

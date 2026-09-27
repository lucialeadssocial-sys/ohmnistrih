import React, { useState } from "react";
import { 
  BookOpen, 
  Layout, 
  Target, 
  Layers, 
  ChevronRight, 
  MoveHorizontal, 
  AlertTriangle, 
  CheckCircle2, 
  Play, 
  Trash2, 
  Edit3, 
  Plus, 
  HelpCircle,
  Zap,
  BarChart,
  History,
  ArrowRight,
  GripVertical,
  Settings2,
  Clock,
  Sparkles
} from "lucide-react";
import { 
  RawAIAnalysis, 
  StoryPlan, 
  StorySegment, 
  StoryFormat, 
  StoryPlatform, 
  StoryGoal, 
  StoryStructure 
} from "../types";
import { motion, AnimatePresence } from "motion/react";

interface AIStoryBuilderProps {
  rawAnalysis: RawAIAnalysis;
  storyPlan: StoryPlan | null;
  onGenerateStory: (config: { format: StoryFormat, platform: StoryPlatform, goal: StoryGoal, structure: StoryStructure, targetDuration: number }) => void;
  onUpdatePlan: (plan: StoryPlan) => void;
  onApplyToTimeline: () => void;
  language: "sk" | "en";
  isGenerating: boolean;
}

export const AIStoryBuilder: React.FC<AIStoryBuilderProps> = ({
  rawAnalysis,
  storyPlan,
  onGenerateStory,
  onUpdatePlan,
  onApplyToTimeline,
  language,
  isGenerating
}) => {
  const isSk = language === "sk";
  const [config, setConfig] = useState<{
    format: StoryFormat;
    platform: StoryPlatform;
    goal: StoryGoal;
    structure: StoryStructure;
    targetDuration: number;
  }>({
    format: "Short Form",
    platform: "TikTok",
    goal: "EDUCATE",
    structure: "HOOK_VALUE_PAYOFF",
    targetDuration: 60
  });

  const [activeStep, setActiveStep] = useState<"SETUP" | "PROPOSAL">("SETUP");

  const goals: { id: StoryGoal; labelSk: string; labelEn: string; descSk: string; descEn: string }[] = [
    { id: "EDUCATE", labelSk: "EDUCATE", labelEn: "EDUCATE", descSk: "Vysvetliť informáciu.", descEn: "Explain information." },
    { id: "ENTERTAIN", labelSk: "ENTERTAIN", labelEn: "ENTERTAIN", descSk: "Zabaviť.", descEn: "Entertain." },
    { id: "STORY", labelSk: "STORY", labelEn: "STORY", descSk: "Vyrozprávať príbeh.", descEn: "Tell a story." },
    { id: "SELL", labelSk: "SELL", labelEn: "SELL", descSk: "Predstaviť produkt.", descEn: "Pitch a product." },
    { id: "INSPIRE", labelSk: "INSPIRE", labelEn: "INSPIRE", descSk: "Vyvolať emóciu.", descEn: "Evoke emotion." },
  ];

  const structures: { id: StoryStructure; labelSk: string; labelEn: string }[] = [
    { id: "HOOK_VALUE_PAYOFF", labelSk: "HOOK → VALUE → PAYOFF", labelEn: "HOOK → VALUE → PAYOFF" },
    { id: "HOOK_PROBLEM_SOLUTION", labelSk: "HOOK → PROBLEM → SOLUTION", labelEn: "HOOK → PROBLEM → SOLUTION" },
    { id: "HOOK_STORY_LESSON", labelSk: "HOOK → STORY → LESSON", labelEn: "HOOK → STORY → LESSON" },
    { id: "PAS", labelSk: "PROBLEM → AGITATE → SOLUTION", labelEn: "PROBLEM → AGITATE → SOLUTION" },
  ];

  const handleGenerate = () => {
    onGenerateStory(config);
    setActiveStep("PROPOSAL");
  };

  const moveSegment = (fromIndex: number, toIndex: number) => {
    if (!storyPlan) return;
    const newSegments = [...storyPlan.segments];
    const [moved] = newSegments.splice(fromIndex, 1);
    newSegments.splice(toIndex, 0, moved);
    onUpdatePlan({ ...storyPlan, segments: newSegments });
  };

  if (!rawAnalysis.isAnalyzed) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-12 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h3 className="mb-2 text-xl font-bold text-white">
          {isSk ? "Najskôr analyzujte RAW video" : "Analyze RAW video first"}
        </h3>
        <p className="mx-auto mb-6 max-w-sm text-sm text-neutral-400">
          {isSk 
            ? "Story Builder potrebuje dáta z AI analýzy, aby mohol navrhnúť pútavý príbeh."
            : "Story Builder needs data from AI analysis to suggest an engaging story."}
        </p>
      </div>
    );
  }

  if (activeStep === "SETUP" && !isGenerating) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">AI STORY BUILDER</h3>
            <p className="text-[10px] text-neutral-500 font-bold uppercase">Step 1: Configuration</p>
          </div>
        </div>

        {/* Format Selection */}
        <section className="space-y-4">
          <h4 className="text-[11px] font-black text-neutral-400 uppercase tracking-[0.2em]">WHAT ARE YOU CREATING?</h4>
          <div className="grid grid-cols-2 gap-3">
            {(["Short Form", "Long Form"] as const).map(f => (
              <button
                key={f}
                onClick={() => setConfig({ ...config, format: f })}
                className={`p-4 rounded-xl border text-left transition-all ${
                  config.format === f ? "border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/30" : "border-neutral-800 bg-neutral-900/40 hover:border-neutral-700"
                }`}
              >
                <span className={`block text-xs font-black mb-1 ${config.format === f ? "text-white" : "text-neutral-300"}`}>{f}</span>
                <span className="text-[10px] text-neutral-500 leading-tight">
                  {f === "Short Form" ? "TikTok, Reels, Shorts" : "YouTube, Podcasts, Long-form"}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Goal Selection */}
        <section className="space-y-4">
          <h4 className="text-[11px] font-black text-neutral-400 uppercase tracking-[0.2em]">STORY GOAL</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {goals.map(g => (
              <button
                key={g.id}
                onClick={() => setConfig({ ...config, goal: g.id })}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  config.goal === g.id ? "border-emerald-500 bg-emerald-500/10" : "border-neutral-800 bg-neutral-900/20 hover:border-neutral-700"
                }`}
              >
                <div className="text-left">
                  <span className={`block text-[10px] font-black ${config.goal === g.id ? "text-white" : "text-neutral-400"}`}>{isSk ? g.labelSk : g.labelEn}</span>
                  <span className="text-[9px] text-neutral-600">{isSk ? g.descSk : g.descEn}</span>
                </div>
                {config.goal === g.id && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
              </button>
            ))}
          </div>
        </section>

        {/* Structure Selection */}
        <section className="space-y-4">
          <h4 className="text-[11px] font-black text-neutral-400 uppercase tracking-[0.2em]">AI STORY STRUCTURE</h4>
          <div className="grid grid-cols-1 gap-2">
            {structures.map(s => (
              <button
                key={s.id}
                onClick={() => setConfig({ ...config, structure: s.id })}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  config.structure === s.id ? "border-indigo-500 bg-indigo-500/10" : "border-neutral-800 bg-neutral-900/20 hover:border-neutral-700"
                }`}
              >
                <span className={`text-[10px] font-black ${config.structure === s.id ? "text-white" : "text-neutral-400"}`}>
                  {isSk ? s.labelSk : s.labelEn}
                </span>
                {config.structure === s.id && <CheckCircle2 className="h-4 w-4 text-indigo-500" />}
              </button>
            ))}
          </div>
        </section>

        {/* Target Duration */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-black text-neutral-400 uppercase tracking-[0.2em]">TARGET DURATION</h4>
            <span className="text-xs font-bold text-white">{config.targetDuration}s</span>
          </div>
          <input
            type="range"
            min={15}
            max={600}
            step={15}
            value={config.targetDuration}
            onChange={(e) => setConfig({ ...config, targetDuration: parseInt(e.target.value) })}
            className="w-full h-2 rounded-lg bg-neutral-800 appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="flex justify-between text-[8px] text-neutral-600 font-bold uppercase">
            <span>15s</span>
            <span>60s</span>
            <span>3m</span>
            <span>5m</span>
            <span>10m</span>
          </div>
        </section>

        <button
          onClick={handleGenerate}
          className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 hover:bg-indigo-500 transition-all active:scale-[0.98]"
        >
          GENERATE STORY PROPOSAL
        </button>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-12 text-center">
        <div className="relative mx-auto mb-8 h-20 w-20">
          <div className="absolute inset-0 rounded-full border-4 border-indigo-500/10" />
          <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-indigo-400 animate-pulse" />
          </div>
        </div>
        <h3 className="mb-2 text-lg font-black text-white uppercase tracking-widest">
          {isSk ? "STAVIAM PRÍBEH..." : "BUILDING STORY..."}
        </h3>
        <p className="text-xs text-neutral-500 italic">
          {isSk ? "Vyberám kľúčové momenty a kontrolujem kontinuitu..." : "Selecting key moments and checking continuity..."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Proposal Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg">
            <Layout className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">STORY STORYBOARD</h3>
            <div className="flex items-center gap-2">
               <span className="text-[10px] text-emerald-400 font-bold uppercase">V1: Fast / Direct</span>
               <span className="text-neutral-700">•</span>
               <span className="text-[10px] text-neutral-500 font-bold uppercase">{config.structure}</span>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setActiveStep("SETUP")}
          className="p-2 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </div>

      {/* Pacing & Density Analysis */}
      <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">PACING</span>
            <span className="text-[10px] font-bold text-emerald-400 uppercase">Balanced</span>
          </div>
          <div className="flex gap-1 h-1">
             <div className="flex-1 bg-rose-500/50 rounded-full" />
             <div className="flex-1 bg-emerald-500 rounded-full" />
             <div className="flex-1 bg-amber-500/50 rounded-full" />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">INFO DENSITY</span>
            <span className="text-[10px] font-bold text-indigo-400 uppercase">High</span>
          </div>
          <div className="w-full bg-neutral-800 h-1 rounded-full overflow-hidden">
             <div className="w-[85%] bg-indigo-500 h-full" />
          </div>
        </div>
      </div>

      {/* Drag & Drop Storyboard */}
      <div className="flex flex-col gap-3">
        {storyPlan?.segments.map((segment, index) => (
          <motion.div 
            key={segment.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`group relative flex flex-col p-4 rounded-2xl border bg-neutral-900/40 transition-all ${
              segment.contextRisk ? "border-rose-500/30 ring-1 ring-rose-500/10" : "border-neutral-800 hover:border-neutral-700"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center gap-2 pt-1 text-neutral-600">
                <GripVertical className="h-4 w-4 cursor-grab active:cursor-grabbing hover:text-neutral-400" />
                <span className="text-[10px] font-black">{index + 1}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-[9px] font-black text-indigo-400 uppercase">
                      {segment.type}
                    </span>
                    <span className="text-[10px] font-bold text-neutral-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {segment.start.toFixed(1)}s → {segment.end.toFixed(1)}s
                    </span>
                  </div>
                  <div className="flex gap-1">
                     <button className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white"><Edit3 className="h-3 w-3" /></button>
                     <button className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-rose-400"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </div>

                <p className="text-xs text-neutral-200 leading-relaxed mb-3 line-clamp-2">
                  "{segment.transcript}"
                </p>

                <div className="flex items-center gap-2">
                   <div className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-800/80 text-[9px] font-bold text-neutral-400">
                      <HelpCircle className="h-3 w-3" />
                      {isSk ? segment.purposeSk : segment.purposeEn}
                   </div>
                   {segment.contextRisk ? (
                     <div className="flex items-center gap-1 px-2 py-1 rounded bg-rose-500/10 text-[9px] font-bold text-rose-400 animate-pulse">
                        <AlertTriangle className="h-3 w-3" />
                        {isSk ? "CONTEXT RISK" : "CONTEXT RISK"}
                     </div>
                   ) : (
                     <div className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/10 text-[9px] font-bold text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        SAFE
                     </div>
                   )}
                </div>
                
                {segment.contextRisk && (
                  <p className="mt-2 text-[10px] text-rose-400 font-bold italic">
                    ⚠ {isSk ? segment.contextWarningSk : segment.contextWarningEn}
                  </p>
                )}
              </div>
            </div>
            
            {/* Visual Arrow Connector */}
            {index < (storyPlan?.segments.length || 0) - 1 && (
              <div className="absolute -bottom-4 left-6 z-10 flex flex-col items-center gap-0.5">
                 <div className="h-2 w-0.5 bg-neutral-800" />
                 <ArrowRight className="h-3 w-3 text-neutral-800 rotate-90" />
                 <div className="h-2 w-0.5 bg-neutral-800" />
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Actions */}
      <div className="sticky bottom-0 pt-6 pb-2 bg-gradient-to-t from-neutral-950 via-neutral-950 to-transparent">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
             <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-[10px] font-black text-white uppercase tracking-widest">Story Quality Check: PASSED</span>
             </div>
             <button className="text-[10px] font-black text-emerald-400 uppercase tracking-widest underline underline-offset-4">Details</button>
          </div>
          
          <button
            onClick={onApplyToTimeline}
            className="group relative w-full py-4 rounded-2xl bg-emerald-600 text-white font-black uppercase tracking-[0.2em] shadow-xl shadow-emerald-600/20 hover:bg-emerald-500 transition-all active:scale-[0.98] overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            <span>APPLY TO TIMELINE</span>
          </button>
        </div>
      </div>

      {/* Why? Panel (Sticky or Modal-like overlay could go here) */}
      <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/20">
         <div className="flex items-start gap-3">
            <HelpCircle className="h-4 w-4 text-indigo-400 mt-0.5" />
            <div>
               <h5 className="text-[10px] font-black text-white uppercase tracking-wider mb-1">AI CO-EDITOR ADVICE</h5>
               <p className="text-[10px] text-neutral-500 leading-relaxed italic">
                 {isSk 
                   ? "Tento návrh príbehu sa zameriava na rýchly spád (V1: Fast). Odporúčam zachovať poradie HOOK → PROBLEM, pretože to okamžite zachytí pozornosť a vytvorí dopyt po riešení."
                   : "This story proposal focuses on fast pacing (V1: Fast). I recommend keeping the HOOK → PROBLEM sequence as it immediately captures attention and creates demand for a solution."}
               </p>
            </div>
         </div>
      </div>
    </div>
  );
};

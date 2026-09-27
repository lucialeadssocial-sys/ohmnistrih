import React, { useState } from "react";
import { Sparkles, X, ChevronRight, Check, Zap, Gauge, Film, Type, Music, Palette } from "lucide-react";
import { BriefingModal } from "./BriefingModal";
import { coreEngine } from "../core";
import { directorEngine } from "../core/ai/directorEngine";
import { DirectorPlan } from "../core/ai/analysisTypes";
import { playSynthesizedSFX } from "../utils/audioSynth";

interface DirectorProductionCenterProps {
  language: "sk" | "en";
  showToast: (msg: string) => void;
  projectId: string;
}

export const DirectorProductionCenter: React.FC<DirectorProductionCenterProps> = ({ language, showToast, projectId }) => {
  const isSk = language === "sk";
  const [isBriefingOpen, setIsBriefingOpen] = useState(false);
  const [plan, setPlan] = useState<DirectorPlan | null>(null);
  const [acceptedIds, setAcceptedIds] = useState<string[]>([]);
  const [isApplying, setIsApplying] = useState(false);

  const handleRunBriefing = (brief: any) => {
    setIsBriefingOpen(false);
    showToast(isSk ? "✨ AI Director analyzuje obsah..." : "✨ AI Director analyzing content...");
    const project = coreEngine.getProject();
    const generatedPlan = directorEngine.generateDirectorPlan(project, brief.platform, [brief.objective]);
    setPlan(generatedPlan);
  };

  const toggleDecision = (id: string, accept: boolean) => {
    setAcceptedIds(prev => accept ? [...prev, id] : prev.filter(i => i !== id));
  };

  const handleApplyAll = () => {
    if (acceptedIds.length === 0) return;
    setIsApplying(true);
    showToast(isSk ? "🔄 Vytváram snapshot a aplikujem zmeny..." : "🔄 Creating snapshot and applying changes...");
    
    // 1. Snapshot
    coreEngine.commandManager.snapshot();

    // 2. Apply via DirectorEngine (which uses CommandManager)
    const result = directorEngine.safeBatchApply(coreEngine.commandManager, plan!, acceptedIds);

    if (!result.success) {
      // 3. Rollback on failure
      coreEngine.commandManager.rollback();
      showToast(isSk ? `❌ Konflikt: ${result.error}` : `❌ Conflict: ${result.error}`);
    } else {
      showToast(isSk ? `✅ Aplikovaných ${result.appliedCount} úprav.` : `✅ ${result.appliedCount} edits applied.`);
      playSynthesizedSFX("cash", 0.7);
    }
    setIsApplying(false);
  };

  return (
    <div className="flex flex-col h-full bg-neutral-900 border border-neutral-800 rounded-2xl p-6 text-neutral-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-black text-white">{isSk ? "AI Director Production" : "AI Director Production"}</h2>
        <div className="flex gap-2">
           <button 
            onClick={() => setIsBriefingOpen(true)}
            className="px-4 py-2 bg-neutral-800 rounded-lg text-xs font-bold text-white hover:bg-neutral-700"
          >
            {isSk ? "Briefing" : "Briefing"}
          </button>
           <button 
            onClick={handleApplyAll}
            disabled={isApplying || acceptedIds.length === 0}
            className="px-4 py-2 bg-emerald-600 rounded-lg text-xs font-bold text-white disabled:opacity-50"
          >
            {isSk ? "Aplikovať Plán" : "Apply Plan"} ({acceptedIds.length})
          </button>
        </div>
      </div>

      {!plan ? (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-neutral-800 rounded-2xl">
          <Sparkles className="w-12 h-12 text-neutral-700 mb-4" />
          <p className="text-sm text-neutral-400">{isSk ? "Spusti produkčný brief pre AI návrhy strihu." : "Run a production brief to get AI editing suggestions."}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4">
          <h3 className="text-sm font-bold text-rose-400">{isSk ? "Navrhovaný plán:" : "Proposed Plan:"}</h3>
          {plan.decisions.map(dec => (
            <div key={dec.id} className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2">
              <div className="flex justify-between">
                <p className="text-xs font-semibold text-white">{dec.what}</p>
                <div className="flex gap-1">
                   <button onClick={() => toggleDecision(dec.id, true)} className={`p-1 rounded ${acceptedIds.includes(dec.id) ? 'bg-emerald-600' : 'bg-neutral-800'}`}><Check className="w-3 h-3"/></button>
                   <button onClick={() => toggleDecision(dec.id, false)} className={`p-1 rounded ${!acceptedIds.includes(dec.id) ? 'bg-rose-600' : 'bg-neutral-800'}`}><X className="w-3 h-3"/></button>
                </div>
              </div>
              <p className="text-[10px] text-neutral-400 italic">WHY: {dec.why}</p>
              <button className="text-[9px] text-rose-400 underline">{isSk ? "Zobraziť ako na to" : "Show me how"}</button>
            </div>
          ))}
        </div>
      )}

      <BriefingModal 
        isOpen={isBriefingOpen} 
        onClose={() => setIsBriefingOpen(false)} 
        language={language}
        onConfirm={handleRunBriefing}
      />
    </div>
  );
};

import React from "react";
import { 
  AlertCircle, 
  CheckCircle2, 
  MessageSquare, 
  TrendingUp,
  Zap,
  Lightbulb
} from "lucide-react";
import { ViralityAnalysis } from "../types";

interface SmartAIInsightProps {
  virality?: ViralityAnalysis;
  language: "sk" | "en";
}

export const SmartAIInsight: React.FC<SmartAIInsightProps> = ({
  virality,
  language,
}) => {
  const isSk = language === "sk";
  
  // Demo insights if none provided
  const insights = virality?.aiInsights || [
    {
      type: "hook",
      textSk: "Prvých 2.5 sekundy je kľúčových. Skúste pridať dynamický ZOOM a veľký červený nadpis.",
      textEn: "First 2.5 seconds are key. Try adding a dynamic ZOOM and a big red headline.",
      impact: "high"
    },
    {
      type: "pacing",
      textSk: "Tempo je mierne pomalé medzi 0:12 a 0:18. AI odporúča 'Jump Cut' na odstránenie ticha.",
      textEn: "Pacing is slightly slow between 0:12 and 0:18. AI recommends a 'Jump Cut' to remove silence.",
      impact: "medium"
    },
    {
      type: "engagement",
      textSk: "Skvelá práca s emoji v titulkách! Udržuje to pozornosť o 22% dlhšie.",
      textEn: "Great job with emojis in captions! It keeps attention 22% longer.",
      impact: "positive"
    }
  ];

  return (
    <div className="rounded-2xl border border-indigo-500/20 bg-indigo-950/20 p-4 shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-indigo-500 p-1.5 text-white shadow-lg shadow-indigo-500/20">
            <Lightbulb className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            {isSk ? "AI Smart Insights" : "AI Smart Insights"}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
          <Zap className="h-3 w-3" />
          {isSk ? "Live Analýza" : "Live Analysis"}
        </div>
      </div>

      <div className="space-y-3">
        {insights.map((insight: any, idx: number) => (
          <div 
            key={idx}
            className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all hover:scale-[1.01] cursor-default ${
              insight.impact === "high" 
                ? "bg-rose-500/10 border-rose-500/20" 
                : insight.impact === "medium"
                ? "bg-amber-500/10 border-amber-500/20"
                : "bg-emerald-500/10 border-emerald-500/20"
            }`}
          >
            <div className="mt-0.5">
              {insight.impact === "high" ? (
                <AlertCircle className="h-4 w-4 text-rose-400" />
              ) : insight.impact === "medium" ? (
                <TrendingUp className="h-4 w-4 text-amber-400" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-neutral-200">
              <span className={`font-bold uppercase mr-1.5 ${
                insight.impact === "high" ? "text-rose-400" : insight.impact === "medium" ? "text-amber-400" : "text-emerald-400"
              }`}>
                {insight.impact === "high" ? (isSk ? "Kritické:" : "Critical:") : insight.impact === "medium" ? (isSk ? "Tip:" : "Tip:") : (isSk ? "Skvelé:" : "Great:")}
              </span>
              {isSk ? insight.textSk : insight.textEn}
            </p>
          </div>
        ))}
      </div>

      <button className="w-full mt-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
        {isSk ? "Spustiť hĺbkovú AI revíziu" : "Run Deep AI Review"}
      </button>
    </div>
  );
};

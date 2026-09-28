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
import { coreEngine } from "../core";
import { buildMeasuredInsights } from "../core/ai/highlightModel";

interface SmartAIInsightProps {
  virality?: ViralityAnalysis;
  language: "sk" | "en";
}

export const SmartAIInsight: React.FC<SmartAIInsightProps> = ({
  virality,
  language,
}) => {
  const isSk = language === "sk";

  /**
   * Insights come from real measurements.
   *
   * The previous version showed three fabricated "demo insights" (including an invented
   * "22 % longer attention" claim) whenever no analysis was available. Now the panel reads the
   * measured analysis of the canonical project and says "not measured" when there is nothing.
   */
  const measured = buildMeasuredInsights(coreEngine.getProject());
  const insights = (virality?.aiInsights && virality.aiInsights.length > 0 ? virality.aiInsights : measured)
    .map((insight: any) => ({
      type: insight.type,
      textSk: insight.textSk,
      textEn: insight.textEn,
      impact: insight.impact,
      evidence: insight.evidence,
    }));

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
        <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold border ${
          insights.length > 0
            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
        }`}>
          <Zap className="h-3 w-3" />
          {insights.length > 0 ? (isSk ? "Merané z analýzy" : "Measured analysis") : (isSk ? "Nemerané" : "Not measured")}
        </div>
      </div>

      <div className="space-y-3">
        {insights.map((insight: any, idx: number) => (
          <div 
            key={idx}
            title={insight.evidence}
            className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all cursor-default ${
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
                {insight.impact === "high" ? (isSk ? "Kritické:" : "Critical:") : insight.impact === "medium" ? (isSk ? "Tip:" : "Tip:") : (isSk ? "Merané:" : "Measured:")}
              </span>
              {isSk ? insight.textSk : insight.textEn}
            </p>
          </div>
        ))}
      </div>

      {insights.length === 0 && (
        <p className="text-[11px] text-neutral-400 leading-relaxed">
          {isSk
            ? "Zatiaľ žiadne merané poznatky: projekt nemá výsledky analýzy (hooky, pauzy, CTA). Spustite analýzu projektu — poznatky sa potom vypíšu s nameranými číslami."
            : "No measured insights yet: the project has no analysis results (hooks, pauses, CTAs). Run project analysis — insights will then be listed with their measured numbers."}
        </p>
      )}
    </div>
  );
};

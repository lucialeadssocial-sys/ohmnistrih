import React, { useState, useEffect } from "react";
import { EditorialDecision, DecisionStatus } from "../visual/VisualDecisionTypes";
import { VisualDecisionManager } from "../visual/VisualDecisionManager";
import { EDLManager } from "../utils/edlManager";
import { Shield, Lock, CheckCircle2, XCircle, AlertTriangle, HelpCircle, Eye } from "lucide-react";

interface VisualReviewCenterProps {
  projectId: string;
  onDecisionUpdated?: () => void;
}

export const VisualReviewCenter: React.FC<VisualReviewCenterProps> = ({
  projectId,
  onDecisionUpdated,
}) => {
  const [decisions, setDecisions] = useState<EditorialDecision[]>([]);
  const [filter, setFilter] = useState<"ALL" | "SAFE" | "REVIEW" | "CRITICAL" | "LOCKED">("ALL");

  useEffect(() => {
    loadDecisions();
  }, [projectId]);

  const loadDecisions = () => {
    const edl = EDLManager.getEDL(projectId);
    const visDecs: EditorialDecision[] = edl.decisions
      .filter((d) => d.id.startsWith("vis-"))
      .map((d) => ({
        id: d.id.replace("vis-", ""),
        timelineStart: d.timelineStart ?? d.start,
        timelineEnd: d.timelineEnd ?? d.end,
        type: (d.type as any) || "VISUAL_KEEP",
        priority: 1,
        confidence: d.confidence,
        reason: d.reason,
        reasonSk: d.reasonSk,
        source: (d.createdBy as any) || "EDITORIAL_ENGINE",
        status: (d.status as any) || "applied",
        locked: !!d.isLocked,
        visualAssetId: d.details?.brollKeywords?.[0],
      }));
    setDecisions(visDecs);
  };

  const updateDecisionStatus = (id: string, newStatus: DecisionStatus, lock = false) => {
    const updated = decisions.map((d) =>
      d.id === id ? { ...d, status: newStatus, locked: lock || d.locked } : d
    );
    setDecisions(updated);
    VisualDecisionManager.syncVisualDecisionsToEDL(projectId, updated);
    if (onDecisionUpdated) onDecisionUpdated();
  };

  const filteredDecisions = decisions.filter((d) => {
    const confCat = VisualDecisionManager.categorizeConfidence(d.confidence).category;
    if (filter === "LOCKED") return d.locked;
    if (filter === "SAFE") return confCat === "SAFE";
    if (filter === "REVIEW") return confCat === "REVIEW";
    if (filter === "CRITICAL") return confCat === "CRITICAL";
    return true;
  });

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 text-white space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Eye className="w-5 h-5 text-amber-500" /> Human Review Center — Visual Review
          </h3>
          <p className="text-sm text-neutral-400 mt-1">
            Overovanie a schvaľovanie vizuálnych rozhodnutí AI pred finálnym vyexportovaním.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["ALL", "SAFE", "REVIEW", "CRITICAL", "LOCKED"] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                filter === cat
                  ? "bg-amber-500 text-black"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {filteredDecisions.length === 0 ? (
          <p className="text-sm text-neutral-500 italic text-center py-6">
            Žiadne vizuálne rozhodnutia nezodpovedajú vybranému filtru.
          </p>
        ) : (
          filteredDecisions.map((dec) => {
            const confCat = VisualDecisionManager.categorizeConfidence(dec.confidence).category;
            return (
              <div
                key={dec.id}
                className={`p-4 border rounded-xl transition ${
                  dec.locked
                    ? "border-amber-500/50 bg-amber-950/10"
                    : confCat === "SAFE"
                    ? "border-emerald-800/40 bg-emerald-950/10"
                    : confCat === "REVIEW"
                    ? "border-amber-800/40 bg-amber-950/10"
                    : "border-rose-800/40 bg-rose-950/10"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                        {dec.type}
                      </span>
                      <span className="text-xs text-neutral-400">
                        {dec.timelineStart.toFixed(1)}s – {dec.timelineEnd.toFixed(1)}s
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          confCat === "SAFE"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : confCat === "REVIEW"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-rose-500/20 text-rose-300"
                        }`}
                      >
                        {confCat} ({Math.round(dec.confidence * 100)}%)
                      </span>
                      {dec.locked && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded flex items-center gap-1">
                          <Lock className="w-3 h-3" /> LOCKED / DO_NOT_TOUCH
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-neutral-200 mt-1">{dec.reasonSk}</p>
                    <p className="text-xs text-neutral-400 italic">
                      {VisualDecisionManager.getExplanation(dec)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => updateDecisionStatus(dec.id, "approved")}
                      className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 rounded transition"
                      title="Schváliť (APPROVE)"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => updateDecisionStatus(dec.id, "rejected")}
                      className="p-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 rounded transition"
                      title="Zamietnuť (REJECT)"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => updateDecisionStatus(dec.id, "approved", !dec.locked)}
                      className={`p-1.5 rounded transition ${
                        dec.locked
                          ? "bg-amber-500 text-black font-bold"
                          : "bg-neutral-800 hover:bg-neutral-700 text-amber-400"
                      }`}
                      title="Zamknúť (LOCK / DO_NOT_TOUCH)"
                    >
                      <Lock className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

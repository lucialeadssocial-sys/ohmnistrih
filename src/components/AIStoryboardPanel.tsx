import React, { useState } from "react";
import { StoryboardPlan, StoryboardItem, AIStoryboardGenerator } from "../visual/AIStoryboardGenerator";
import { VisualStyleDNA } from "../visual/VisualStyleDNA";
import { VisualDecisionManager } from "../visual/VisualDecisionManager";
import { Play, Check, X, ShieldAlert, Sparkles, RefreshCw } from "lucide-react";

interface AIStoryboardPanelProps {
  projectId: string;
  styleDNA: VisualStyleDNA;
  onApplyDecisions?: () => void;
}

export const AIStoryboardPanel: React.FC<AIStoryboardPanelProps> = ({
  projectId,
  styleDNA,
  onApplyDecisions,
}) => {
  const [storyboard, setStoryboard] = useState<StoryboardPlan | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      // Deterministic 30s test scenes for demo/runtime verification
      const sampleScenes = [
        {
          sceneId: "s1",
          timelineStart: 0,
          timelineEnd: 5.0,
          transcriptText: "Intro - Hello and welcome to OmniStrih AI Video Studio.",
          speakerIsActive: true,
          semanticImportance: 0.85,
          keywords: ["OmniStrih"],
          availableBrollAssets: [{ id: "br-1", name: "Studio Workspace", url: "/demo-broll.mp4", category: "tech" }],
        },
        {
          sceneId: "s2",
          timelineStart: 5.0,
          timelineEnd: 10.0,
          transcriptText: "Important statement about AI visual editorial power.",
          speakerIsActive: true,
          semanticImportance: 0.95,
          keywords: ["EDITORIAL"],
          availableBrollAssets: [],
        },
        {
          sceneId: "s3",
          timelineStart: 10.0,
          timelineEnd: 15.0,
          transcriptText: "Explanation of kinetic typography and collage composition.",
          speakerIsActive: true,
          semanticImportance: 0.7,
          keywords: ["Typografia"],
          availableBrollAssets: [{ id: "br-2", name: "Paper Texture", url: "/paper.png", category: "texture" }],
        },
        {
          sceneId: "s4",
          timelineStart: 15.0,
          timelineEnd: 20.0,
          transcriptText: "Example showing paper cutouts and polaroid frames in action.",
          speakerIsActive: true,
          semanticImportance: 0.8,
          keywords: ["Polaroid"],
          availableBrollAssets: [],
        },
        {
          sceneId: "s5",
          timelineStart: 20.0,
          timelineEnd: 25.0,
          transcriptText: "Strong conclusion on offline render engine output.",
          speakerIsActive: true,
          semanticImportance: 0.9,
          keywords: ["WebCodecs"],
          availableBrollAssets: [],
        },
        {
          sceneId: "s6",
          timelineStart: 25.0,
          timelineEnd: 30.0,
          transcriptText: "Outro - Subscribe and create your next video now.",
          speakerIsActive: true,
          semanticImportance: 0.4,
          keywords: ["Outro"],
          availableBrollAssets: [],
        },
      ];

      const plan = AIStoryboardGenerator.generateStoryboard(projectId, sampleScenes, styleDNA);
      setStoryboard(plan);
      setSelectedIds(plan.items.map((i) => i.id));
      setIsGenerating(false);
    }, 400);
  };

  const handleApplyAll = () => {
    if (!storyboard) return;
    const allDecisions = storyboard.items.flatMap((i) => i.decisions);
    VisualDecisionManager.syncVisualDecisionsToEDL(projectId, allDecisions);
    setStoryboard({
      ...storyboard,
      items: storyboard.items.map((i) => ({ ...i, status: "applied" })),
    });
    if (onApplyDecisions) onApplyDecisions();
  };

  const handleApplySelected = () => {
    if (!storyboard) return;
    const selectedDecisions = storyboard.items
      .filter((i) => selectedIds.includes(i.id))
      .flatMap((i) => i.decisions);
    VisualDecisionManager.syncVisualDecisionsToEDL(projectId, selectedDecisions);
    setStoryboard({
      ...storyboard,
      items: storyboard.items.map((i) =>
        selectedIds.includes(i.id) ? { ...i, status: "applied" } : i
      ),
    });
    if (onApplyDecisions) onApplyDecisions();
  };

  const handleRejectAll = () => {
    if (!storyboard) return;
    setStoryboard({
      ...storyboard,
      items: storyboard.items.map((i) => ({ ...i, status: "rejected" })),
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 text-white space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" /> AI Storyboard Director
          </h3>
          <p className="text-sm text-neutral-400 mt-1">
            Generovanie a náhľad vizuálneho scenára pred aplikáciou do EDL.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg flex items-center gap-2 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`} />
          {isGenerating ? "Generujem..." : "Vygenerovať Storyboard"}
        </button>
      </div>

      {storyboard && (
        <>
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <span className="text-sm text-neutral-300">
              Profil: <strong className="text-amber-400">{storyboard.styleName}</strong> | Scény: {storyboard.items.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleApplyAll}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" /> Aplikovať všetko (EDL)
              </button>
              <button
                onClick={handleApplySelected}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded flex items-center gap-1"
              >
                Aplikovať vybrané ({selectedIds.length})
              </button>
              <button
                onClick={handleRejectAll}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-rose-400 text-xs font-semibold rounded flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Odmietnuť všetko
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-2">
            {storyboard.items.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => toggleSelect(item.id)}
                  className={`border rounded-lg p-4 cursor-pointer transition ${
                    item.status === "applied"
                      ? "border-emerald-500/50 bg-emerald-950/20"
                      : isSelected
                      ? "border-amber-500/60 bg-neutral-800/80"
                      : "border-neutral-800 bg-neutral-900/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                      Scéna #{item.sceneNumber} ({item.timelineStart}s – {item.timelineEnd}s)
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        item.status === "applied"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : item.status === "rejected"
                          ? "bg-rose-500/20 text-rose-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {item.status === "applied" ? "AI APPLIED" : item.status === "rejected" ? "REJECTED" : "AI SUGGESTION"}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-300 mb-2 line-clamp-2">
                    <strong>Vizuál:</strong> {item.visualTreatmentSk}
                  </p>
                  <p className="text-xs text-neutral-400 mb-1">
                    <strong>Typografia:</strong> {item.typographySk}
                  </p>
                  <p className="text-xs text-neutral-400 mb-1">
                    <strong>Pohyb:</strong> {item.motionSk}
                  </p>
                  <div className="mt-2 text-[11px] text-neutral-500 italic border-t border-neutral-800/60 pt-2">
                    Prečo: {item.reasonSk} (Istota: Math.round({item.confidence * 100})%)
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

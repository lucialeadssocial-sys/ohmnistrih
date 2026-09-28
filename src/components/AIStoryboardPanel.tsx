import React, { useState } from "react";
import { StoryboardPlan, StoryboardItem, AIStoryboardGenerator } from "../visual/AIStoryboardGenerator";
import { VisualStyleDNA } from "../visual/VisualStyleDNA";
import { VisualDecisionManager } from "../visual/VisualDecisionManager";
import { buildStoryboardScenes, StoryboardSceneSource } from "../visual/StoryboardSceneSource";
import { coreEngine, useCoreProject } from "../core";
import { Play, Check, X, ShieldAlert, Sparkles, RefreshCw } from "lucide-react";

interface AIStoryboardPanelProps {
  projectId: string;
  styleDNA: VisualStyleDNA;
  onApplyDecisions?: () => void;
}

/**
 * AI Storyboard Director.
 *
 * Scenes come from the measured transcript (or from the real clips when there is no transcript) —
 * see visual/StoryboardSceneSource. Applying a scene now goes through the canonical Command System:
 * the visual decisions are mapped onto Director decisions and only the ones the engine can really
 * execute (punch-in, trim, multicam, a transition with a defined spec) are applied, undoably, with
 * a snapshot. Everything else is reported as a manual step with the engine's own reason.
 */
export const AIStoryboardPanel: React.FC<AIStoryboardPanelProps> = ({
  projectId,
  styleDNA,
  onApplyDecisions,
}) => {
  const { project } = useCoreProject();
  const [storyboard, setStoryboard] = useState<StoryboardPlan | null>(null);
  const [sceneSource, setSceneSource] = useState<StoryboardSceneSource | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleGenerate = () => {
    setIsGenerating(true);
    const source = buildStoryboardScenes(project);
    setSceneSource(source);

    if (source.scenes.length === 0) {
      setStoryboard(null);
      setSelectedIds([]);
      setStatusMessage(source.notesSk.join(" "));
      setIsGenerating(false);
      return;
    }

    const plan = AIStoryboardGenerator.generateStoryboard(project.id || projectId, source.scenes, styleDNA, source.evidence);
    setStoryboard(plan);
    setSelectedIds(plan.items.map((i) => i.id));
    setStatusMessage(
      source.measured
        ? `Storyboard postavený z ${source.scenes.length} reálnych scén projektu.`
        : `Storyboard postavený z ${source.scenes.length} scén, ale bez meranej analýzy — hodnoty dôležitosti sú označené ako neutrálne.`
    );
    setIsGenerating(false);
  };

  /**
   * Real apply: maps the visual decisions of the chosen scenes onto Director decisions and lets the
   * Command System execute what it can. Returns the engine's own applied/skipped report.
   */
  const applyScenes = (items: StoryboardItem[]) => {
    if (!storyboard || items.length === 0) return;

    const currentProject = coreEngine.getProject();
    const groups = items.map(item => ({
      itemId: item.id,
      decisions: VisualDecisionManager.toDirectorDecisionItems(currentProject, item.decisions, `sb_${item.id}`),
    }));
    const allDecisions = groups.flatMap(g => g.decisions);

    // The visual cache stays a cache; the real edits are the ones applied below.
    VisualDecisionManager.syncVisualDecisionsToEDL(currentProject.id || projectId, items.flatMap(i => i.decisions));

    if (allDecisions.length === 0) {
      setStatusMessage("Vybrané scény neobsahujú žiadne vizuálne rozhodnutie — nie je čo aplikovať.");
      return;
    }

    const result = coreEngine.applyDirectorDecisions(allDecisions, `AI Storyboard: ${items.length} scén`);
    const skippedIds = new Set(result.skipped.map(s => s.id));

    setStoryboard(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map(item => {
          const group = groups.find(g => g.itemId === item.id);
          if (!group) return item;

          const appliedHere = group.decisions.filter(d => !skippedIds.has(d.id)).length;
          const firstSkip = group.decisions
            .map(d => result.skipped.find(s => s.id === d.id)?.reason)
            .find((reason): reason is string => !!reason);

          if (appliedHere === group.decisions.length && appliedHere > 0) {
            return { ...item, status: "applied" as const, manualReasonSk: undefined };
          }
          if (appliedHere > 0) {
            return { ...item, status: "applied" as const, manualReasonSk: firstSkip };
          }
          return { ...item, status: "pending" as const, manualReasonSk: firstSkip };
        }),
      };
    });

    if (result.success) {
      setStatusMessage(
        `Aplikované cez Command System: ${result.appliedCount} úprav v projekte` +
          (result.skippedCount > 0
            ? `, ${result.skippedCount} rozhodnutí zostáva na ručnú prácu (dôvod pri scéne).`
            : ".")
      );
    } else {
      setStatusMessage(`Nepodarilo sa aplikovať: ${result.error || "neznáma chyba"}`);
    }

    if (onApplyDecisions) onApplyDecisions();
  };

  const handleApplyAll = () => {
    if (!storyboard) return;
    applyScenes(storyboard.items);
  };

  const handleApplySelected = () => {
    if (!storyboard) return;
    applyScenes(storyboard.items.filter(i => selectedIds.includes(i.id)));
  };

  const handleRejectAll = () => {
    if (!storyboard) return;
    setStoryboard({
      ...storyboard,
      items: storyboard.items.map((i) => ({ ...i, status: "rejected" })),
    });
    setStatusMessage("Všetky scény označené ako zamietnuté — do projektu sa nezapísalo nič.");
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
            Scény z meraného prepisu (alebo z reálnych klipov), aplikácia cez Command System so zálohou.
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

      {sceneSource && (
        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 space-y-1">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
              sceneSource.measured
                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                : "bg-rose-500/10 text-rose-300 border-rose-500/30"
            }`}
          >
            {sceneSource.measured ? "MERANÉ DÁTA" : "NEMERANÉ — neutrálne hodnoty"}
          </span>
          {sceneSource.notesSk.map(note => (
            <p key={note} className="text-[11px] text-neutral-400">• {note}</p>
          ))}
        </div>
      )}

      {statusMessage && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs font-semibold text-amber-300 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{statusMessage}</span>
        </div>
      )}

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
                <Check className="w-3.5 h-3.5" /> Aplikovať všetko
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
                      {item.status === "applied"
                        ? "APLIKOVANÉ"
                        : item.status === "rejected"
                        ? "ZAMIETNUTÉ"
                        : item.manualReasonSk
                        ? "MANUÁLNE"
                        : "NÁVRH"}
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
                  {item.manualReasonSk && (
                    <p className="text-xs text-rose-300/90 mb-1">
                      <strong>Ručne:</strong> {item.manualReasonSk}
                    </p>
                  )}
                  <div className="mt-2 text-[11px] text-neutral-500 italic border-t border-neutral-800/60 pt-2">
                    Prečo: {item.reasonSk} (Istota: {Math.round(item.confidence * 100)} %)
                  </div>
                  {item.evidenceSk && (
                    <div className="mt-1 text-[10px] text-neutral-500">{item.evidenceSk}</div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {!storyboard && !isGenerating && sceneSource && sceneSource.scenes.length === 0 && (
        <div className="flex items-start gap-2 text-xs text-neutral-400">
          <Play className="w-4 h-4 text-neutral-600 mt-0.5" />
          <span>Storyboard sa nedá postaviť — nahraj médiá alebo spusti analýzu prepisu a skús znova.</span>
        </div>
      )}
    </div>
  );
};

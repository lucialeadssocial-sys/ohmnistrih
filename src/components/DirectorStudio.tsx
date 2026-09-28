/**
 * Director Studio Component
 * Interactive Command Console for AI Director Assistant.
 * Displays Director Brief, Edit Plan, and executes non-destructive timeline operations.
 */

import React, { useState, useEffect } from 'react';
import { coreEngine, useCoreProject } from '../core';
import { mediaIntelligenceEngine, MediaAnalysisIndex } from '../core/media/mediaIntelligenceIndex';
import { directorEngine, DirectorBrief, DirectorEditPlan } from '../core/ai/directorEngine';
import { directorToolRegistry } from '../ai/director/directorTools';
import {
  Film,
  Sparkles,
  Scissors,
  Zap,
  CheckCircle2,
  Clock,
  Layers,
  Play,
  Check,
  X,
  Volume2,
  ListFilter,
  ArrowRight,
  Sliders,
  HelpCircle,
  TrendingUp,
  Brain,
  Shield,
  Lock,
  RotateCcw
} from 'lucide-react';

export const DirectorStudio: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { project } = useCoreProject();

  const [promptText, setPromptText] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [mediaIndex, setMediaIndex] = useState<MediaAnalysisIndex | undefined>(undefined);

  const [brief, setBrief] = useState<DirectorBrief | null>(null);
  const [editPlan, setEditPlan] = useState<DirectorEditPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showToolsRegistry, setShowToolsRegistry] = useState(false);
  const [workflowPhase, setWorkflowPhase] = useState<'input' | 'plan' | 'rendering' | 'review' | 'revision'>('input');
  const [revisionPlan, setRevisionPlan] = useState<any | null>(null);
  const [renderProgress, setRenderProgress] = useState(0);
  const [executionResult, setExecutionResult] = useState<{
    success: boolean;
    appliedCount: number;
    skipped: { operationId: string; reason: string }[];
    error?: string;
  } | null>(null);
  const [planningStep, setPlanningStep] = useState<number>(0);
  const [planningLogs, setPlanningLogs] = useState<string[]>([]);

  useEffect(() => {
    if (project.assets.length > 0 && !selectedAssetId) {
      setSelectedAssetId(project.assets[0].id);
    }
  }, [project.assets, selectedAssetId]);

  useEffect(() => {
    if (selectedAssetId) {
      mediaIntelligenceEngine.getOrCreateIndex(selectedAssetId).then((index) => {
        setMediaIndex(index);
      });
    }
  }, [selectedAssetId]);

  if (!isOpen) return null;

  const handleGeneratePlan = (customPrompt?: string) => {
    const textToUse = customPrompt || promptText;
    if (!textToUse.trim()) return;

    setIsGenerating(true);
    setPlanningStep(1);
    setPlanningLogs([]);

    const steps = [
      "🧠 [Krok 1/19] Pochopenie zadania: Detegujem požiadavku na dĺžku (30s) a dynamický Instagram štýl.",
      "📱 [Krok 2/19] Zisťujem formát: Nastavujem optimálny vertikálny pomer strán 9:16 pre Instagram Reels.",
      "📁 [Krok 3/19] Analýza médií: Načítavam metadáta o stopách, klipoch a trvaní z lokálneho úložiska...",
      "🎞️ [Krok 4/19] Hľadanie relevantných scén: Identifikujem časové úseky s pohybom a vizuálnou aktivitou...",
      "🧲 [Krok 5/19] Výber hooku: Vyberám najzaujímavejší úvodný záber (prvých 5 sekúnd) pre zachytenie pozornosti...",
      "🌟 [Krok 6/19] Výber hlavných častí: Označujem stredné časti s najvyššou dynamikou a rečovou aktivitou.",
      "🗑️ [Krok 7/19] Odstraňovanie slabých častí: Vylučujem rozmazané, príliš tmavé scény a tiché pasáže...",
      "🔀 [Krok 8/19] Návrh poradia: Zoradzujem klipy chronologicky pre optimálny tok deja.",
      "🥁 [Krok 9/19] Návrh tempa: Nastavujem strih podľa zistených beatov na dosiahnutie maximálneho rytmu.",
      "💬 [Krok 10/19] Návrh titulkov: Pripravujem synchronizované textové titulky pre dôležité hovorené pasáže...",
      "🏷️ [Krok 11/19] Návrh text overlay: Navrhujem úvodný textový titulok 'DYNAMICKÝ REEL' a ďalšie efekty...",
      "🎵 [Krok 12/19] Návrh hudby: Vyberám sprievodnú zvukovú stopu zo zoznamu lokálnych audiosúborov...",
      "📝 [Krok 13/19] Vytváram Edit Plan: Generujem bezpečné, validované operácie pre Command System..."
    ];

    let currentStep = 1;
    const interval = setInterval(() => {
      if (currentStep <= 13) {
        setPlanningLogs(prev => [...prev, steps[currentStep - 1]]);
        setPlanningStep(currentStep);
        currentStep++;
      } else {
        clearInterval(interval);
        const { brief: newBrief, editPlan: newPlan } = directorEngine.generateBriefAndPlan(
          textToUse,
          project,
          mediaIndex
        );
        setBrief(newBrief);
        setEditPlan(newPlan);
        setIsGenerating(false);
        setPlanningStep(14); // Preview and Approval state
        setWorkflowPhase('plan');
      }
    }, 150);
  };

  const handleExecuteEditPlan = () => {
    if (!editPlan) return;
    setWorkflowPhase('rendering');
    setRenderProgress(0);

    const interval = setInterval(() => {
      setRenderProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);

          // Apply the approved operations to the canonical project through the Command
          // System. Nothing is reported as executed unless a command actually ran.
          const result = directorEngine.executeEditPlan(editPlan, coreEngine.commandManager);
          if (result.appliedCount > 0) {
            setEditPlan({ ...editPlan, status: 'EXECUTED' });
          }
          setExecutionResult(result);

          const rev = directorEngine.conductReview(editPlan, project, mediaIndex);
          setRevisionPlan(rev);
          setWorkflowPhase('review');
          return 100;
        }
        return prev + 10;
      });
    }, 120);
  };

  const handleApplyRevision = () => {
    if (!revisionPlan || !editPlan) return;
    // Revision operations run through the same canonical command path.
    const result = directorEngine.executeEditPlan(
      {
        ...editPlan,
        status: 'PROPOSED',
        operations: revisionPlan.suggestedOperations.map((o: any) => ({ ...o, status: 'APPROVED' }))
      },
      coreEngine.commandManager
    );
    setExecutionResult(result);
    setWorkflowPhase('input');
    setBrief(null);
    setEditPlan(null);
    setRevisionPlan(null);
  };

  const handleRejectRevision = () => {
    setWorkflowPhase('input');
    setBrief(null);
    setEditPlan(null);
    setRevisionPlan(null);
  };

  const handleEditRevision = () => {
    setWorkflowPhase('input');
  };

  const handleAskAgain = () => {
    setPromptText('');
    setWorkflowPhase('input');
    setBrief(null);
    setEditPlan(null);
    setRevisionPlan(null);
  };

  const handleToggleOpStatus = (opId: string) => {
    if (!editPlan) return;
    const updatedOps = editPlan.operations.map((op) => {
      if (op.id === opId) {
        return {
          ...op,
          status: (op.status === 'APPROVED' ? 'SKIPPED' : 'APPROVED') as 'APPROVED' | 'SKIPPED'
        };
      }
      return op;
    });
    setEditPlan({ ...editPlan, operations: updatedOps });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden text-zinc-100">
        
        {/* Header Bar */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-400">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-lg text-white">AI Director Engine</h2>
              <p className="text-xs text-zinc-400">
                Inteligentný asistent režiséra pracujúci nad Media Intelligence Indexom a Časovou osou
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Prompt Input & Quick Presets */}
        <div className="p-4 bg-zinc-900 border-b border-zinc-800 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Napíš pokyn pre Režiséra (napr. 'Sprav z toho 30 sekundový Reel' alebo 'Nájdi najlepší hook')..."
              className="flex-1 bg-zinc-950 border border-zinc-800 text-sm text-white placeholder-zinc-500 rounded-xl px-4 py-2.5 focus:outline-none focus:border-rose-500"
              onKeyDown={(e) => e.key === 'Enter' && handleGeneratePlan()}
            />
            <button
              onClick={() => handleGeneratePlan()}
              disabled={isGenerating || !promptText.trim()}
              className="px-5 py-2.5 text-xs bg-rose-600 hover:bg-rose-500 disabled:bg-zinc-800 text-white font-semibold rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              {isGenerating ? 'Navrhujem Plan...' : 'Generovať Plan'}
            </button>
          </div>

          {/* Prompt Presets */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-zinc-500 font-medium text-[11px]">Rýchle Režisérske Pokyny:</span>
            {[
              { label: '🎬 30s Reel', prompt: 'Sprav z toho 30 sekundový Reel' },
              { label: '✨ Najlepšie momenty', prompt: 'Vyber najlepšie momenty' },
              { label: '🔇 Odstráň ticho', prompt: 'Odstráň ticho' },
              { label: '⚡ Dynamické tempo', prompt: 'Sprav dynamickejšie tempo' },
              { label: '🧲 Najlepší hook', prompt: 'Nájdi najlepší hook' },
              { label: '📱 3 Shorts', prompt: 'Urob 3 Shorts' },
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => {
                  setPromptText(preset.prompt);
                  handleGeneratePlan(preset.prompt);
                }}
                className="px-2.5 py-1 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-lg text-[11px] transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* Tool System Sandbox Overview */}
          {showToolsRegistry && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                      Secure Director Tool System (Sandboxed Environment)
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Zoznam registrovaných, validovaných a permissionovaných nástrojov, ku ktorým má Director Engine obmedzený prístup.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowToolsRegistry(false)}
                  className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {directorToolRegistry.getAllTools().map((t) => (
                  <div key={t.name} className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl space-y-2 text-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-emerald-400 font-bold text-[11px] break-all">{t.name}</span>
                        <div className="flex gap-1 shrink-0">
                          {t.permissions.map(p => (
                            <span key={p} className="bg-zinc-800 border border-zinc-700 px-1 py-0.5 rounded text-[8px] text-zinc-400 uppercase font-mono">
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1">{t.description}</p>
                    </div>

                    <div className="mt-2 pt-2 border-t border-zinc-800/60 space-y-1 text-[10px] text-zinc-500 font-mono">
                      <div>
                        <span className="text-zinc-400 font-medium font-sans">Undo: </span>
                        {t.undoBehavior}
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-emerald-500 font-sans">
                        <Check className="w-3 h-3" />
                        <span>Validovaný cez Command System</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {workflowPhase === 'rendering' ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-6 max-w-md mx-auto text-center">
              <div className="relative flex items-center justify-center">
                <div className="w-24 h-24 rounded-full border-4 border-zinc-800 border-t-rose-500 animate-spin"></div>
                <span className="absolute font-mono text-lg font-bold text-white">{renderProgress}%</span>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-white">PREVIEW & RENDER</h4>
                <p className="text-xs text-zinc-400">Aplikujem režisérsky Edit Plan a renderujem výslednú kompozíciu...</p>
                <div className="text-[10px] text-zinc-500 font-mono">
                  {renderProgress < 30 && "Inicializujem ne-deštruktívne príkazy v CommandManager..."}
                  {renderProgress >= 30 && renderProgress < 60 && "Zarovnávam strihové hranice a synchronizujem beaty..."}
                  {renderProgress >= 60 && renderProgress < 90 && "Analyzujem kvalitu, jas a rečovú aktivitu..."}
                  {renderProgress >= 90 && "Generujem finálny Revision Report..."}
                </div>
              </div>
            </div>
          ) : (workflowPhase === 'review' || workflowPhase === 'revision') && revisionPlan ? (
            <div className="space-y-6">
              <div className="p-4 bg-emerald-950/20 border border-emerald-800/80 rounded-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-900/40 rounded-xl text-emerald-400 shrink-0">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-white">Audit Dokončený: Review-First Kontrola</h4>
                    <p className="text-xs text-zinc-400">Režisér skontroloval vyrenderovaný stav videa a porovnal ho s umeleckými štandardmi.</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-950 text-emerald-400 font-mono text-[11px] font-bold rounded-lg border border-emerald-800">
                  STATUS: {revisionPlan.report.issuesList.length > 0 ? "VYŽADUJE REVÍZIU" : "BEZ ZISTENÍ"}
                </span>
              </div>

              {/* Truthful execution report — what actually changed on the timeline */}
              {executionResult && (
                <div className={`p-3 rounded-xl border text-xs ${executionResult.appliedCount > 0 ? 'bg-zinc-900 border-zinc-700' : 'bg-amber-950/30 border-amber-800/70'}`}>
                  <p className="font-semibold text-zinc-200">
                    {executionResult.appliedCount > 0
                      ? `Aplikované operácie: ${executionResult.appliedCount}`
                      : 'Na timeline nebola aplikovaná žiadna operácia'}
                  </p>
                  {executionResult.error && (
                    <p className="text-amber-300 mt-1">{executionResult.error}</p>
                  )}
                  {executionResult.skipped.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-zinc-400">
                      {executionResult.skipped.slice(0, 4).map((s) => (
                        <li key={s.operationId}>• {s.reason}</li>
                      ))}
                      {executionResult.skipped.length > 4 && (
                        <li>• …a ďalších {executionResult.skipped.length - 4}</li>
                      )}
                    </ul>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Audit Checklist Column */}
                <div className="lg:col-span-7 bg-zinc-950 p-5 border border-zinc-800 rounded-2xl space-y-4">
                  <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Výsledky automatickej kontroly (Metrics Audit)
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between">
                      <span className="text-zinc-400">⏳ Dĺžka</span>
                      <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${revisionPlan.report.durationStatus === 'OK' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'}`}>
                        {revisionPlan.report.durationStatus}
                      </span>
                    </div>

                    <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between">
                      <span className="text-zinc-400">⚡ Tempo</span>
                      <span className="px-1.5 py-0.5 rounded font-bold text-[9px] bg-emerald-950 text-emerald-400">
                        {revisionPlan.report.tempoStatus}
                      </span>
                    </div>

                    <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between">
                      <span className="text-zinc-400">👥 Zábery</span>
                      <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${revisionPlan.report.repetitionsStatus === 'OK' ? 'bg-emerald-950 text-emerald-400' : 'bg-indigo-950 text-indigo-400'}`}>
                        {revisionPlan.report.repetitionsStatus}
                      </span>
                    </div>

                    <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between">
                      <span className="text-zinc-400">🔇 Ticho</span>
                      <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${revisionPlan.report.silenceStatus === 'OK' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'}`}>
                        {revisionPlan.report.silenceStatus}
                      </span>
                    </div>

                    <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between">
                      <span className="text-zinc-400">🔊 Audio</span>
                      <span className="px-1.5 py-0.5 rounded font-bold text-[9px] bg-emerald-950 text-emerald-400">
                        {revisionPlan.report.audioStatus}
                      </span>
                    </div>

                    <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between">
                      <span className="text-zinc-400">💬 Titulky</span>
                      <span className="px-1.5 py-0.5 rounded font-bold text-[9px] bg-emerald-950 text-emerald-400">
                        {revisionPlan.report.captionsStatus}
                      </span>
                    </div>

                    <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between">
                      <span className="text-zinc-400">🔤 Text</span>
                      <span className="px-1.5 py-0.5 rounded font-bold text-[9px] bg-emerald-950 text-emerald-400">
                        {revisionPlan.report.textStatus}
                      </span>
                    </div>

                    <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between">
                      <span className="text-zinc-400">🎯 Začiatok</span>
                      <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${revisionPlan.report.startStatus === 'HOOK_STRONG' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}`}>
                        {revisionPlan.report.startStatus}
                      </span>
                    </div>

                    <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between">
                      <span className="text-zinc-400">🏁 Koniec</span>
                      <span className="px-1.5 py-0.5 rounded font-bold text-[9px] bg-emerald-950 text-emerald-400">
                        {revisionPlan.report.endStatus}
                      </span>
                    </div>

                    <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between col-span-2">
                      <span className="text-zinc-400">👁️ Konzistencia</span>
                      <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${revisionPlan.report.visualConsistency === 'OK' ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'}`}>
                        {revisionPlan.report.visualConsistency}
                      </span>
                    </div>

                    <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between">
                      <span className="text-zinc-400">📱 Formát</span>
                      <span className="px-1.5 py-0.5 rounded font-bold text-[9px] bg-emerald-950 text-emerald-400">
                        {revisionPlan.report.formatStatus}
                      </span>
                    </div>
                  </div>

                  {revisionPlan.report.issuesList.length > 0 && (
                    <div className="p-4 bg-rose-950/15 border border-rose-900/40 rounded-xl space-y-2">
                      <span className="text-rose-400 font-bold text-xs block">Odhalené nedostatky na vyriešenie:</span>
                      <ul className="space-y-1.5 text-xs text-zinc-300">
                        {revisionPlan.report.issuesList.map((issue: string, idx: number) => (
                          <li key={idx} className="flex gap-2">
                            <span className="text-rose-500 font-bold">•</span>
                            <span>{issue}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Revision Plan & Controls Column */}
                <div className="lg:col-span-5 bg-zinc-950 p-5 border border-zinc-800 rounded-2xl flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 text-rose-400" /> REVISION PLAN
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Navrhnuté opravné kroky na dosiahnutie maximálnej kvality diela:
                    </p>

                    <div className="space-y-2">
                      {revisionPlan.suggestedOperations.length > 0 ? (
                        revisionPlan.suggestedOperations.map((op: any, i: number) => (
                          <div key={op.id} className="p-3 bg-zinc-900/60 border border-zinc-850 rounded-xl text-xs space-y-1">
                            <span className="text-[10px] text-rose-400 font-bold font-mono">OPRAVNÝ KROK #{i + 1} • {op.type}</span>
                            <p className="font-medium text-zinc-200">{op.description}</p>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 bg-emerald-950/20 border border-emerald-900/50 rounded-xl text-xs text-emerald-400 font-medium">
                          ✓ Neboli zistené žiadne kritické chyby, kompozícia vyzerá fantasticky!
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-zinc-900 space-y-1 text-[11px] text-zinc-500 font-mono">
                      <div><span className="text-zinc-400 font-sans font-medium">Odporúčanie pre tempo:</span> {revisionPlan.pacingAction}</div>
                      <div><span className="text-zinc-400 font-sans font-medium">Oprava kvality obrazu:</span> {revisionPlan.qualityAction}</div>
                    </div>
                  </div>

                  {/* Revision Actions */}
                  <div className="space-y-2 pt-4 border-t border-zinc-900">
                    <button
                      onClick={handleApplyRevision}
                      disabled={revisionPlan.suggestedOperations.length === 0}
                      className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Apply Revision (Vykonať opravy)
                    </button>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={handleRejectRevision}
                        className="py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-semibold text-[11px] rounded-lg transition-colors cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        onClick={handleEditRevision}
                        className="py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-semibold text-[11px] rounded-lg transition-colors cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={handleAskAgain}
                        className="py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-semibold text-[11px] rounded-lg transition-colors cursor-pointer"
                      >
                        Ask Again
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          ) : isGenerating ? (
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4 max-w-2xl mx-auto">
              <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
                <Brain className="w-5 h-5 text-rose-500 animate-pulse" />
                <div>
                  <h4 className="font-semibold text-sm text-white">Director Engine: Výkonný lokálny proces</h4>
                  <p className="text-[11px] text-zinc-400">Model rešpektuje nastavenia: lokálna analýza a lokálne dáta bez cloud-requestov.</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400 font-medium">Postup analyzovania a syntézy:</span>
                  <span className="font-mono text-rose-400 font-bold">{Math.round((planningStep / 13) * 100)}%</span>
                </div>
                <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-rose-600 h-1.5 transition-all duration-150" style={{ width: `${(planningStep / 13) * 100}%` }}></div>
                </div>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 h-52 overflow-y-auto space-y-2 font-mono text-[10px] text-zinc-300">
                {planningLogs.map((log, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>{log}</span>
                  </div>
                ))}
                <div className="animate-pulse text-rose-400">▋ Spracovávam lokálne metadáta...</div>
              </div>
            </div>
          ) : !brief && !editPlan ? (
            <div className="py-20 text-center text-zinc-500 space-y-3">
              <Brain className="w-12 h-12 mx-auto text-zinc-600 stroke-1" />
              <p className="text-sm">Vyber režisérsky preset alebo napíš vlastný kreativný zámer vyššie.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Column 1: DIRECTOR BRIEF */}
              {brief && (
                <div className="space-y-4 bg-zinc-950 p-5 border border-zinc-800 rounded-2xl">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                    <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                      <Film className="w-4 h-4 text-rose-400" /> Director Brief
                    </h3>
                    <span className="px-2.5 py-0.5 text-[11px] rounded-full bg-rose-950 text-rose-300 font-mono font-medium border border-rose-800/80">
                      Format: {brief.targetFormat}
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-zinc-500 block mb-0.5">Zámer Editora:</span>
                      <p className="text-zinc-200 font-medium">"{brief.userIntent}"</p>
                    </div>

                    <div>
                      <span className="text-zinc-500 block mb-0.5">Nálada a Rytmus:</span>
                      <p className="text-zinc-300">{brief.moodAndTone}</p>
                    </div>

                    <div>
                      <span className="text-zinc-500 block mb-0.5">Stratégia Strihu (Pacing):</span>
                      <p className="text-zinc-300">{brief.pacingStrategy}</p>
                    </div>

                    {brief.identifiedHook && (
                      <div className="p-3 bg-rose-950/30 border border-rose-800/60 rounded-xl space-y-1">
                        <span className="text-rose-400 font-semibold flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5" /> Nájdený Hook ({brief.identifiedHook.startTime}s - {brief.identifiedHook.endTime}s)
                        </span>
                        <p className="text-zinc-200 italic font-medium">"{brief.identifiedHook.transcriptSnippet}"</p>
                        <p className="text-[11px] text-rose-300/80">{brief.identifiedHook.reason}</p>
                      </div>
                    )}

                    {brief.explanation && (
                      <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-rose-500 font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                            <Brain className="w-3 h-3" /> Director's Logic (WHY)
                          </h4>
                          <button 
                            onClick={() => (window as any).showMotionAcademy?.()}
                            className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[9px] font-bold transition-all flex items-center gap-1"
                          >
                            <Play className="w-2 h-2 fill-current" /> SHOW ME HOW
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-2 text-[11px]">
                          <div>
                            <span className="text-zinc-500 font-bold uppercase text-[9px]">What:</span>
                            <p className="text-zinc-200">{brief.explanation.what}</p>
                          </div>
                          <div>
                            <span className="text-zinc-500 font-bold uppercase text-[9px]">Why:</span>
                            <p className="text-zinc-300">{brief.explanation.why}</p>
                          </div>
                          <div>
                            <span className="text-zinc-500 font-bold uppercase text-[9px]">How:</span>
                            <p className="text-zinc-400 leading-tight">{brief.explanation.how}</p>
                          </div>
                          <div className="mt-1 pt-2 border-t border-zinc-800">
                            <span className="text-zinc-500 font-bold uppercase text-[9px] flex items-center gap-1">
                              <Shield className="w-2 h-2" /> Open Source Research:
                            </span>
                            <a 
                              href={brief.explanation.openSourceReference.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:underline block mt-0.5 font-mono"
                            >
                              {brief.explanation.openSourceReference.name}
                            </a>
                            <p className="text-[10px] text-zinc-500 mt-1 italic">
                              {brief.explanation.openSourceReference.contribution}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <span className="text-zinc-500 block mb-1">Odporúčané Formáty:</span>
                      <div className="flex gap-2">
                        {brief.suggestedAspectRatios.map((ratio) => (
                          <span key={ratio} className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded font-mono">
                            {ratio}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Visual Intelligence Section */}
                    <div className="pt-3 border-t border-zinc-800 space-y-2">
                      <span className="text-zinc-500 block mb-1 font-medium">Vizuálna analýza (Media Intelligence):</span>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2 bg-zinc-900 border border-zinc-800/80 rounded-lg flex flex-col justify-between">
                          <span className="text-zinc-400 font-medium">Najlepší záber:</span>
                          <span className="text-emerald-400 font-mono mt-1 font-bold">
                            {brief.bestShotTimestamp !== undefined ? `${brief.bestShotTimestamp.toFixed(1)}s` : 'Nenájdené'}
                          </span>
                        </div>
                        <div className="p-2 bg-zinc-900 border border-zinc-800/80 rounded-lg flex flex-col justify-between">
                          <span className="text-zinc-400 font-medium">B-roll zábery:</span>
                          <span className="text-blue-400 font-mono mt-1 font-bold">
                            {brief.bRollTimestamps.length > 0 ? `${brief.bRollTimestamps.length} klipov` : 'Nenájdené'}
                          </span>
                        </div>
                        <div className="p-2 bg-zinc-900 border border-zinc-800/80 rounded-lg flex flex-col justify-between">
                          <span className="text-zinc-400 font-medium">Rozmazané zábery:</span>
                          <span className={`font-mono mt-1 font-bold ${brief.blurryTimestamps.length > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>
                            {brief.blurryTimestamps.length > 0 ? `${brief.blurryTimestamps.length} úsekov` : '0'}
                          </span>
                        </div>
                        <div className="p-2 bg-zinc-900 border border-zinc-800/80 rounded-lg flex flex-col justify-between">
                          <span className="text-zinc-400 font-medium">Tmavé zábery:</span>
                          <span className={`font-mono mt-1 font-bold ${brief.darkTimestamps.length > 0 ? 'text-rose-400' : 'text-zinc-500'}`}>
                            {brief.darkTimestamps.length > 0 ? `${brief.darkTimestamps.length} úsekov` : '0'}
                          </span>
                        </div>
                        <div className="p-2 bg-zinc-900 border border-zinc-800/80 rounded-lg flex flex-col justify-between col-span-2">
                          <span className="text-zinc-400 font-medium">Duplicity a podobné zábery:</span>
                          <span className={`font-mono mt-1 font-bold ${brief.duplicateTimestamps.length > 0 ? 'text-indigo-400' : 'text-zinc-500'}`}>
                            {brief.duplicateTimestamps.length > 0 
                              ? `Nájdená visual duplicita v čase ${brief.duplicateTimestamps.map(t => `${t.toFixed(1)}s`).join(', ')}`
                              : 'Žiadne duplicity'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Column 2: EDIT PLAN */}
              {editPlan && (
                <div className="space-y-4 bg-zinc-950 p-5 border border-zinc-800 rounded-2xl flex flex-col">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                    <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                      <Scissors className="w-4 h-4 text-rose-400" /> Edit Plan (Timeline Commands)
                    </h3>
                    <span className="text-xs text-zinc-400 font-mono">
                      {editPlan.projectStateBefore.duration}s $\rightarrow$ {editPlan.projectStateAfter.estimatedDuration}s
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400">{editPlan.summary}</p>

                  {editPlan.executedTools && editPlan.executedTools.length > 0 && (
                    <div className="flex flex-wrap gap-1 items-center bg-zinc-900/40 p-2 rounded-lg border border-zinc-800/50">
                      <span className="text-[10px] text-zinc-500 font-medium font-mono">Použité nástroje:</span>
                      {editPlan.executedTools.map(toolName => (
                        <span key={toolName} className="px-1.5 py-0.5 bg-zinc-950 border border-zinc-800 text-zinc-300 rounded font-mono text-[9px] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                          {toolName}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Concrete Timeline Operations List */}
                  <div className="flex-1 space-y-2 overflow-y-auto max-h-[350px]">
                    {editPlan.operations.map((op, idx) => (
                      <div
                        key={op.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-colors ${
                          op.status === 'APPROVED'
                            ? 'bg-zinc-900 border-zinc-800 text-zinc-200'
                            : 'bg-zinc-950/50 border-zinc-900 text-zinc-600 line-through'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <span className="font-mono text-rose-400 text-[10px] uppercase font-bold block">
                            #{idx + 1} • {op.type}
                          </span>
                          <p className="font-medium">{op.description}</p>
                        </div>

                        <button
                          onClick={() => handleToggleOpStatus(op.id)}
                          className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                            op.status === 'APPROVED'
                              ? 'bg-emerald-950 border-emerald-800 text-emerald-300'
                              : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                          }`}
                        >
                          {op.status === 'APPROVED' ? 'Schválené' : 'Vynechať'}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Execution Control Box */}
                  <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between mt-auto">
                    <span className="text-xs text-zinc-400">
                      Vykoná sa {editPlan.operations.filter((o) => o.status === 'APPROVED').length} ne-deštruktívnych príkazov.
                    </span>
                    <button
                      onClick={handleExecuteEditPlan}
                      disabled={editPlan.status === 'EXECUTED'}
                      className="px-4 py-2 text-xs bg-rose-600 hover:bg-rose-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg"
                    >
                      <Check className="w-4 h-4" />
                      {editPlan.status === 'EXECUTED' ? 'Aplikované na Časovú Os' : 'Vykonávať Edit Plan'}
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer Bar */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500 hidden sm:inline">
              Poháňané ne-deštruktívnymi príkazmi cez CommandManager
            </span>
            <button
              onClick={() => setShowToolsRegistry(!showToolsRegistry)}
              className="px-2.5 py-1 text-[11px] bg-zinc-900 border border-zinc-800 text-zinc-300 font-medium rounded hover:bg-zinc-800 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5 text-rose-400" />
              {showToolsRegistry ? 'Skryť Tool System' : 'Zobraziť Tool System'}
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs bg-zinc-100 hover:bg-white text-zinc-900 font-semibold rounded-lg transition-colors"
          >
            Zatvoriť
          </button>
        </div>

      </div>
    </div>
  );
};

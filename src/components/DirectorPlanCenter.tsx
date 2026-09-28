import React, { useState } from 'react';
import { useCoreProject, coreEngine } from '../core';
import {
  DirectorDecisionItem,
  DirectorObjective,
  DirectorPlan,
  EditComparison,
  DecisionPriority
} from '../core/ai/analysisTypes';
import { getTeachMeExplanation } from '../core/ai/knowledgeBase';
import { DIRECTOR_MODES, DirectorMode, DirectorQuality, QUALITY_RULES } from '../core/ai/directorModes';
import { playheadStore } from '../core/playback/playheadStore';
import {
  Clapperboard,
  Sparkles,
  CheckCircle2,
  XCircle,
  HelpCircle,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Zap,
  Play,
  Layers,
  ListOrdered,
  Eye,
  RotateCcw,
  Sliders,
  AlertTriangle,
  Lock,
  Clock
} from 'lucide-react';

export const DirectorPlanCenter: React.FC = () => {
  const { project } = useCoreProject();
  const [targetPlatform, setTargetPlatform] = useState<
    'TikTok' | 'Instagram Reels' | 'YouTube Shorts' | 'YouTube Long-form' | 'UGC Ads' | 'General'
  >('TikTok');
  const [selectedObjectives, setSelectedObjectives] = useState<DirectorObjective[]>([
    'Retention',
    'Education'
  ]);
  const [acceptedIds, setAcceptedIds] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | DecisionPriority>('ALL');
  const [activeTab, setActiveTab] = useState<'PLAN' | 'COMPARE' | 'STRATEGIES'>('PLAN');
  const [activeTeachTopic, setActiveTeachTopic] = useState<string | null>(null);
  const [showHowSteps, setShowHowSteps] = useState<DirectorDecisionItem | null>(null);
  const [modalTab, setModalTab] = useState<'HOW' | 'WHY' | 'ACADEMY'>('HOW');
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [seekFeedback, setSeekFeedback] = useState<string | null>(null);
  const [applyStatus, setApplyStatus] = useState<string | null>(null);
  const [mode, setMode] = useState<DirectorMode>('SOCIAL');
  const [quality, setQuality] = useState<DirectorQuality>('PRO_QUALITY');
  const [showDropped, setShowDropped] = useState(false);

  /**
   * The stored plan is READ; it is never generated during render (that used to write into the
   * canonical project from the render pass). The button below is the only place that creates one.
   */
  const plan: DirectorPlan | undefined = project.directorPlan;
  const decisions = plan?.decisions ?? [];

  const comparisons: EditComparison[] = plan ? coreEngine.compareUserAndAiEdits(plan) : [];
  const summary = plan ? coreEngine.getReadinessSummary(plan) : null;

  const handleGeneratePlan = () => {
    const newPlan = coreEngine.generateDirectorPlan(targetPlatform, selectedObjectives, mode, quality);
    setAcceptedIds(newPlan.decisions.map(d => d.id));
  };

  /**
   * „Použiť všetko" — applies every decision of the current plan in one undoable batch.
   * Decisions that cannot be executed automatically are reported back, not silently swallowed.
   */
  const handleApplyAll = () => {
    if (!plan) return;
    const allIds = plan.decisions.map(d => d.id);
    setApplyStatus('Použitie všetkého: aplikujem plán a vytváram zálohu...');
    const result = coreEngine.safeBatchApplyDirectorPlan(plan, allIds);
    if (result.success) {
      setAcceptedIds(allIds);
      setApplyStatus(
        `Použité všetko: ${result.appliedCount} zásahov v projekte` +
          (result.skippedCount > 0 ? `, ${result.skippedCount} návrhov zostáva na ručnú prácu (dôvody nižšie v pláne).` : '.')
      );
    } else {
      setApplyStatus(`Chyba pri aplikovaní: ${result.error || 'Neznáma chyba'}`);
    }
    setTimeout(() => setApplyStatus(null), 7000);
  };

  /** Changing the mode also loads that mode's default objectives (visible in the chips). */
  const handleModeChange = (nextMode: DirectorMode) => {
    setMode(nextMode);
    const defaults = DIRECTOR_MODES[nextMode].defaultObjectives;
    if (defaults.length > 0) setSelectedObjectives(defaults);
  };

  const toggleAccept = (id: string) => {
    if (acceptedIds.includes(id)) {
      setAcceptedIds(acceptedIds.filter(i => i !== id));
    } else {
      setAcceptedIds([...acceptedIds, id]);
    }
  };

  const handleSeekToTime = (timeInSec?: number, label?: string) => {
    if (timeInSec === undefined) return;
    playheadStore.setTime(timeInSec, true);
    const feedbackMsg = `📍 Playhead posunutý na ${timeInSec.toFixed(1)}s${label ? ` (${label})` : ''}`;
    setSeekFeedback(feedbackMsg);
    setTimeout(() => setSeekFeedback(null), 3000);
  };

  const openHowModal = (dec: DirectorDecisionItem, initialTab: 'HOW' | 'WHY' | 'ACADEMY' = 'HOW') => {
    setShowHowSteps(dec);
    setModalTab(initialTab);
    setActiveStepIndex(0);
    setCompletedSteps([]);
  };

  const toggleStepCompleted = (idx: number) => {
    if (completedSteps.includes(idx)) {
      setCompletedSteps(completedSteps.filter(i => i !== idx));
    } else {
      setCompletedSteps([...completedSteps, idx]);
    }
  };

  const handleBatchApply = () => {
    if (!plan) {
      setApplyStatus('Najprv vygeneruj Director Plan — potom sa dajú rozhodnutia aplikovať.');
      setTimeout(() => setApplyStatus(null), 5000);
      return;
    }
    setApplyStatus('Aplikujem vybrané rozhodnutia a vytváram zálohu...');
    const result = coreEngine.safeBatchApplyDirectorPlan(plan, acceptedIds);
    if (result.success) {
      setApplyStatus(`Úspešne aplikovaných ${result.appliedCount} rozhodnutí. Záloha uložená v histórii.`);
    } else {
      setApplyStatus(`Chyba pri aplikovaní: ${result.error || 'Neznáma chyba'}`);
    }
    setTimeout(() => setApplyStatus(null), 5000);
  };

  const filteredDecisions = decisions.filter(d => {
    if (priorityFilter === 'ALL') return true;
    return d.priority === priorityFilter;
  });

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 text-white space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-neutral-800 pb-5 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
            <Clapperboard className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              AI Director Center — Professional Edit Planning
            </h3>
            <p className="text-xs text-neutral-400">
              Vysvetliteľný AI plán strihu, rozhodovacia matica a Edit Academy pre výučbu.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('PLAN')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'PLAN' ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            AI Plán & Rozhodnutia ({decisions.length})
          </button>
          <button
            onClick={() => setActiveTab('COMPARE')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'COMPARE' ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            Compare My Edit vs AI
          </button>
          <button
            onClick={() => setActiveTab('STRATEGIES')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'STRATEGIES' ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            Prehľad Stratégií
          </button>
        </div>
      </div>

      {/* Target Setup */}
      <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <span className="text-[10px] text-neutral-500 font-bold uppercase block mb-1">Cieľová Platforma</span>
            <select
              value={targetPlatform}
              onChange={e => setTargetPlatform(e.target.value as any)}
              className="bg-neutral-900 border border-neutral-700 text-xs font-semibold text-white px-3 py-1.5 rounded-lg focus:ring-amber-500"
            >
              <option value="TikTok">TikTok (9:16)</option>
              <option value="Instagram Reels">Instagram Reels (9:16)</option>
              <option value="YouTube Shorts">YouTube Shorts (9:16)</option>
              <option value="YouTube Long-form">YouTube Long-form (16:9)</option>
              <option value="UGC Ads">UGC Reklama (9:16)</option>
            </select>
          </div>

          <div>
            <span className="text-[10px] text-neutral-500 font-bold uppercase block mb-1">Režim Directora</span>
            <select
              value={mode}
              onChange={e => handleModeChange(e.target.value as DirectorMode)}
              className="bg-neutral-900 border border-neutral-700 text-xs font-semibold text-white px-3 py-1.5 rounded-lg focus:ring-amber-500"
            >
              {(Object.values(DIRECTOR_MODES) as typeof DIRECTOR_MODES[DirectorMode][]).map(m => (
                <option key={m.id} value={m.id}>
                  {m.labelSk}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="text-[10px] text-neutral-500 font-bold uppercase block mb-1">Kvalita</span>
            <div className="flex gap-2">
              {(['PRO_QUALITY', 'STANDARD'] as DirectorQuality[]).map(q => (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition ${
                    quality === q
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-neutral-900 text-neutral-500 border-neutral-800'
                  }`}
                >
                  {q === 'PRO_QUALITY' ? 'PRO QUALITY' : 'Štandard'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[10px] text-neutral-500 font-bold uppercase block mb-1">Ciele Editu</span>
            <div className="flex gap-2 flex-wrap">
              {(['Retention', 'Education', 'Conversion', 'Storytelling', 'UGC', 'Long-form', 'Short-form'] as DirectorObjective[]).map(obj => (
                <button
                  key={obj}
                  onClick={() => {
                    if (selectedObjectives.includes(obj)) {
                      setSelectedObjectives(selectedObjectives.filter(o => o !== obj));
                    } else {
                      setSelectedObjectives([...selectedObjectives, obj]);
                    }
                  }}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition ${
                    selectedObjectives.includes(obj)
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-neutral-900 text-neutral-500 border border-neutral-800'
                  }`}
                >
                  {obj}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleGeneratePlan}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-amber-500/10 transition"
        >
          <Sparkles className="w-4 h-4" /> Prepočítať Director Plan
        </button>
      </div>

      {/* Mode rules — what is currently applied, in words */}
      <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800 text-[11px] text-neutral-400 space-y-1">
        <div className="flex items-center gap-2 text-neutral-300">
          <Sliders className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-bold uppercase tracking-wide">
            {DIRECTOR_MODES[mode].labelSk} · {quality === 'PRO_QUALITY' ? 'PRO QUALITY' : 'Štandard'}
          </span>
        </div>
        <p>{DIRECTOR_MODES[mode].goalSk}</p>
        <p className="text-neutral-500">{QUALITY_RULES[quality].noteSk}</p>
        {plan?.modeNotesSk && plan.modeNotesSk.length > 0 && (
          <p className="text-neutral-500">
            V pláne uložené pravidlá: {plan.modeNotesSk[plan.modeNotesSk.length - 1]}
          </p>
        )}
      </div>

      {/* RAW → READY summary — measured counts; the time figure is a labelled estimate */}
      {summary && (
        <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-amber-400" /> RAW → READY
            </h4>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
              summary.analysisMeasured
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            }`}>
              {summary.analysisMeasured ? 'Analýza: meraná' : 'Analýza: NEMERANÁ'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { label: 'Dĺžka materiálu', value: `${summary.durationSeconds}s` },
              { label: 'Klipy', value: `${summary.clipCount}` },
              { label: 'Nájdené úpravy', value: `${summary.decisions}` },
              { label: 'Vynechať', value: `${summary.trims} (${summary.trimmedSeconds}s)` },
              { label: 'Punch-in', value: `${summary.punchIns}` },
              { label: 'Titulky', value: `${summary.captions}` },
              { label: 'B-roll', value: `${summary.broll}` },
              { label: 'Audio ducking', value: `${summary.audio}` },
              { label: 'Hooky (merané)', value: `${summary.hooksMeasured}` },
              { label: 'Návrhy Shorts', value: `${summary.shortsProposals}` },
              { label: 'Prechody', value: `${summary.transitions}` }
            ].map(item => (
              <div key={item.label} className="bg-neutral-900/60 border border-neutral-800 rounded-lg px-2.5 py-2">
                <span className="block text-[10px] text-neutral-500 uppercase font-bold">{item.label}</span>
                <span className="text-sm font-bold text-white font-mono">{item.value}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-neutral-500">
            {summary.estimateBasisSk} Odhad ušetreného času: <span className="text-neutral-300 font-mono">{summary.estimatedManualMinutes} min</span>
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <button
              onClick={handleApplyAll}
              disabled={summary.decisions === 0}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-2 transition ${
                summary.decisions > 0
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/10'
                  : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
              }`}
            >
              <Zap className="w-4 h-4" /> Použiť všetko ({summary.decisions})
            </button>
            <span className="text-[10px] text-neutral-500">
              alebo schváľ jednotlivé návrhy nižšie — nič sa neurobí potichu
            </span>
          </div>
        </div>
      )}

      {/* Dropped decisions — nothing disappears silently */}
      {plan && (plan.droppedDecisions?.length ?? 0) > 0 && (
        <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-2">
          <button
            onClick={() => setShowDropped(!showDropped)}
            className="w-full flex items-center justify-between text-left"
          >
            <span className="text-xs font-bold text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Režim vynechal {plan.droppedDecisions?.length} návrhov — pozri dôvody
            </span>
            <span className="text-[10px] text-neutral-500">{showDropped ? 'Skryť' : 'Zobraziť'}</span>
          </button>
          {showDropped && (
            <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {plan.droppedDecisions?.map(d => (
                <li key={d.id} className="text-[11px] text-neutral-400 bg-neutral-900/60 border border-neutral-800 rounded-lg px-2.5 py-2">
                  <span className="font-mono text-neutral-500">{d.kind}</span> · {d.reasonSk}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Empty state — the plan is only created when the user asks for it */}
      {!plan && (
        <div className="bg-neutral-950 p-6 rounded-xl border border-dashed border-neutral-700 text-center space-y-2">
          <Clapperboard className="w-6 h-6 text-neutral-500 mx-auto" />
          <p className="text-sm text-neutral-300 font-semibold">Zatiaľ nie je vytvorený žiadny Director Plan.</p>
          <p className="text-[11px] text-neutral-500">
            Nič sa nevytvára potichu — klikni na „Prepočítať Director Plan" a návrhy sa zobrazia na schválenie.
          </p>
        </div>
      )}

      {applyStatus && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs font-semibold text-amber-300 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          {applyStatus}
        </div>
      )}

      {/* Main Tab Views */}
      {activeTab === 'PLAN' && plan && (
        <div className="space-y-4">
          {/* Priority Filters */}
          <div className="flex items-center justify-between bg-neutral-950 px-4 py-2.5 rounded-xl border border-neutral-800">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400 font-semibold mr-2">Filter Priorít:</span>
              {(['ALL', 'MUST_CONSIDER', 'RECOMMENDED', 'OPTIONAL'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(p)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${
                    priorityFilter === p
                      ? 'bg-amber-500 text-black'
                      : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <button
              onClick={handleBatchApply}
              disabled={acceptedIds.length === 0}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg flex items-center gap-2 transition ${
                acceptedIds.length > 0
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/10'
                  : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" /> Aplikovať Vybrané ({acceptedIds.length})
            </button>
          </div>

          {/* Decision Cards List */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {filteredDecisions.map(dec => {
              const isAccepted = acceptedIds.includes(dec.id);
              return (
                <div
                  key={dec.id}
                  className={`p-4 rounded-xl border transition ${
                    isAccepted
                      ? 'border-emerald-500/40 bg-emerald-950/10'
                      : 'border-neutral-800 bg-neutral-950'
                  }`}
                >
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1.5 max-w-2xl">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                            dec.priority === 'MUST_CONSIDER'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : dec.priority === 'RECOMMENDED'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-neutral-800 text-neutral-400'
                          }`}
                        >
                          {dec.priority}
                        </span>

                        <span className="text-[10px] bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded font-mono">
                          {dec.category}
                        </span>

                        <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          Confidence {Math.round(dec.confidence * 100)}%
                        </span>

                        {dec.timelineLocation && (
                          <button
                            onClick={() => handleSeekToTime(dec.timelineLocation?.start, dec.what)}
                            className="text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded flex items-center gap-1 font-mono transition border border-amber-500/30"
                            title="Prejsť na tento čas na timeline"
                          >
                            <Play className="w-3 h-3 fill-amber-300" />
                            {dec.timelineLocation.start.toFixed(1)}s
                            {dec.timelineLocation.end ? ` - ${dec.timelineLocation.end.toFixed(1)}s` : ''}
                          </button>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-white mt-1">{dec.what}</h4>
                      <p className="text-xs text-neutral-300">{dec.why}</p>

                      <div className="text-[11px] text-neutral-500 italic">
                        Zdroj: {dec.source}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      <button
                        onClick={() => openHowModal(dec, 'HOW')}
                        className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold rounded-lg flex items-center gap-1.5 transition"
                        title="Show Me How — Prejsť si manuálny postup krok za krokom"
                      >
                        <ListOrdered className="w-4 h-4 text-amber-400" /> Ako na to?
                      </button>

                      <button
                        onClick={() => openHowModal(dec, 'WHY')}
                        className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
                        title="Why — Dôvod, psychológia a teória"
                      >
                        <BookOpen className="w-4 h-4 text-amber-400" /> Prečo?
                      </button>

                      <button
                        onClick={() => toggleAccept(dec.id)}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                          isAccepted
                            ? 'bg-emerald-500 text-black'
                            : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                        }`}
                      >
                        {isAccepted ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        {isAccepted ? 'Schválené' : 'Schváliť'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Compare My Edit Tab */}
      {activeTab === 'COMPARE' && (
        <div className="space-y-4">
          <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
            <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2 mb-1">
              <Eye className="w-4 h-4" /> Compare My Edit vs AI Proposed Plan
            </h4>
            <p className="text-xs text-neutral-400">
              Učebné porovnanie tvojich manuálnych strihových rozhodnutí s návrhom AI Director. Nejde o hodnotenie, ale o vysvetlenie kreatívnych rozdielov.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {comparisons.map((cmp, idx) => (
              <div key={idx} className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-3">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                  Metrika: {cmp.metric}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg">
                    <span className="text-neutral-500 font-bold block mb-1">Tvoj Edit (Používateľ)</span>
                    <span className="text-white font-medium">{cmp.userChoice}</span>
                  </div>

                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <span className="text-amber-400 font-bold block mb-1">AI Proposed Plan</span>
                    <span className="text-amber-200 font-medium">{cmp.aiProposal}</span>
                  </div>
                </div>

                <p className="text-xs text-neutral-300 italic">{cmp.explanation}</p>
                <div className="p-2.5 bg-neutral-900 rounded-lg text-xs text-emerald-300 border border-emerald-500/20 font-medium">
                  💡 Tip pre úpravu: {cmp.learningTip}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strategies Overview Tab */}
      {activeTab === 'STRATEGIES' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Object.entries(plan?.strategies ?? {}).map(([key, strat]) => {
            if (!strat) return null;
            return (
              <div key={key} className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                  <span className="text-xs font-bold text-amber-400">{strat.name}</span>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                    Confidence {Math.round(strat.confidence * 100)}%
                  </span>
                </div>
                <p className="text-xs text-neutral-200 font-medium">{strat.goal}</p>
                <p className="text-xs text-neutral-400">{strat.approach}</p>
                <div className="text-[11px] text-neutral-500 italic pt-1 border-t border-neutral-900">
                  Odôvodnenie: {strat.why}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Show Me How & Edit Academy Interactive Unified Modal */}
      {showHowSteps && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-2xl w-full p-6 text-white space-y-5 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-neutral-800 pb-4 gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                    {showHowSteps.priority}
                  </span>
                  <span className="bg-neutral-800 text-neutral-300 text-[10px] px-2 py-0.5 rounded font-mono">
                    {showHowSteps.category}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded">
                    Confidence {Math.round(showHowSteps.confidence * 100)}%
                  </span>
                  {showHowSteps.timelineLocation && (
                    <span className="text-[10px] bg-neutral-800 text-amber-300 px-2 py-0.5 rounded font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400" />
                      {showHowSteps.timelineLocation.start.toFixed(1)}s
                      {showHowSteps.timelineLocation.end ? ` - ${showHowSteps.timelineLocation.end.toFixed(1)}s` : ''}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ListOrdered className="w-5 h-5 text-amber-400 shrink-0" />
                  {showHowSteps.what}
                </h3>
              </div>

              <button
                onClick={() => setShowHowSteps(null)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Sub-tab Navigation */}
            <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
              <button
                onClick={() => setModalTab('HOW')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition ${
                  modalTab === 'HOW'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                <ListOrdered className="w-4 h-4" /> SHOW ME HOW (Ako na to)
              </button>
              <button
                onClick={() => setModalTab('WHY')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition ${
                  modalTab === 'WHY'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                <HelpCircle className="w-4 h-4" /> WHY (Prečo toto)
              </button>
              <button
                onClick={() => setModalTab('ACADEMY')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition ${
                  modalTab === 'ACADEMY'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                <BookOpen className="w-4 h-4" /> EDIT ACADEMY
              </button>
            </div>

            {/* Seek Feedback Banner */}
            {seekFeedback && (
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs font-semibold text-amber-300 flex items-center justify-between">
                <span>{seekFeedback}</span>
                <span className="text-[10px] text-neutral-400">Timeline aktualizovaná</span>
              </div>
            )}

            {/* TAB 1: SHOW ME HOW (Step-by-step interactive stepper) */}
            {modalTab === 'HOW' && (
              <div className="space-y-4 overflow-y-auto pr-1 flex-1">
                {/* Timeline Seek Quick Action */}
                {showHowSteps.timelineLocation && (
                  <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 flex items-center justify-between gap-3">
                    <div className="text-xs text-neutral-300">
                      <span className="text-amber-400 font-bold block mb-0.5">Miesto na timeline:</span>
                      Časový kód {showHowSteps.timelineLocation.start.toFixed(1)}s
                      {showHowSteps.timelineLocation.end ? ` do ${showHowSteps.timelineLocation.end.toFixed(1)}s` : ''}
                    </div>
                    <button
                      onClick={() => handleSeekToTime(showHowSteps.timelineLocation?.start, showHowSteps.what)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-lg flex items-center gap-1.5 transition shadow-sm"
                    >
                      <Play className="w-3.5 h-3.5 fill-black" /> Ukázať na timeline
                    </button>
                  </div>
                )}

                {/* Active Step Highlight Card */}
                {showHowSteps.howToManual && showHowSteps.howToManual.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                      <span>KROK {activeStepIndex + 1} Z {showHowSteps.howToManual.length}</span>
                      <span className="text-[11px] text-neutral-400">
                        Dokončené {completedSteps.length} / {showHowSteps.howToManual.length}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-amber-100">
                      {showHowSteps.howToManual[activeStepIndex]}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-amber-500/20">
                      <button
                        onClick={() => setActiveStepIndex(Math.max(0, activeStepIndex - 1))}
                        disabled={activeStepIndex === 0}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-800 text-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-700"
                      >
                        ◄ Predchádzajúci
                      </button>

                      <button
                        onClick={() => toggleStepCompleted(activeStepIndex)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1 ${
                          completedSteps.includes(activeStepIndex)
                            ? 'bg-emerald-500 text-black'
                            : 'bg-amber-500 text-black hover:bg-amber-400'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {completedSteps.includes(activeStepIndex) ? 'Splnené ✓' : 'Spraviť manuálne'}
                      </button>

                      <button
                        onClick={() => setActiveStepIndex(Math.min(showHowSteps.howToManual.length - 1, activeStepIndex + 1))}
                        disabled={activeStepIndex === showHowSteps.howToManual.length - 1}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-800 text-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-700"
                      >
                        Ďalší krok ►
                      </button>
                    </div>
                  </div>
                )}

                {/* All Steps Checklist */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
                    Všetky manuálne kroky úpravy:
                  </span>
                  {showHowSteps.howToManual.map((stepText, idx) => {
                    const isDone = completedSteps.includes(idx);
                    const isActive = activeStepIndex === idx;
                    return (
                      <div
                        key={idx}
                        onClick={() => setActiveStepIndex(idx)}
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                          isActive
                            ? 'border-amber-500 bg-amber-500/10'
                            : isDone
                            ? 'border-emerald-500/30 bg-emerald-950/10'
                            : 'border-neutral-800 bg-neutral-950 hover:bg-neutral-900'
                        }`}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStepCompleted(idx);
                          }}
                          className={`mt-0.5 p-1 rounded transition ${
                            isDone ? 'text-emerald-400' : 'text-neutral-500 hover:text-neutral-300'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>

                        <div className="space-y-1 flex-1">
                          <p className={`text-xs font-medium ${isDone ? 'line-through text-neutral-400' : 'text-white'}`}>
                            {stepText}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: WHY (Rationale & Rationale Breakdown) */}
            {modalTab === 'WHY' && (
              <div className="space-y-3 overflow-y-auto pr-1 flex-1 text-xs text-neutral-300">
                <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800 space-y-1">
                  <span className="font-bold text-amber-400 uppercase tracking-wider block text-[10px]">
                    WHAT — Čo presne robíme
                  </span>
                  <p className="text-white font-medium text-sm">{showHowSteps.what}</p>
                </div>

                <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800 space-y-1">
                  <span className="font-bold text-emerald-400 uppercase tracking-wider block text-[10px]">
                    WHY — Psychologické zdôvodnenie & Naratív
                  </span>
                  <p className="text-neutral-200 leading-relaxed">{showHowSteps.why}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 space-y-1">
                    <span className="font-bold text-blue-400 uppercase tracking-wider block text-[10px]">
                      WHEN — Kedy túto techniku použiť
                    </span>
                    <p className="text-neutral-300">{showHowSteps.whenToUse}</p>
                  </div>

                  <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 space-y-1">
                    <span className="font-bold text-rose-400 uppercase tracking-wider block text-[10px]">
                      WHEN NOT — Kedy sa technika nepoužíva
                    </span>
                    <p className="text-neutral-300">{showHowSteps.whenNotToUse}</p>
                  </div>
                </div>

                {showHowSteps.alternatives && showHowSteps.alternatives.length > 0 && (
                  <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800 space-y-1">
                    <span className="font-bold text-purple-400 uppercase tracking-wider block text-[10px]">
                      ALTERNATIVE — Profesionálne alternatívy
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-neutral-300">
                      {showHowSteps.alternatives.map((alt, i) => (
                        <li key={i}>{alt}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: EDIT ACADEMY (Knowledge grounding) */}
            {modalTab === 'ACADEMY' && (
              <div className="space-y-3 overflow-y-auto pr-1 flex-1 text-xs text-neutral-300">
                <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-2">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                    Zdroj a Princíp Poznania:
                  </span>
                  <div className="flex items-center justify-between text-neutral-400 text-xs pt-1 border-t border-neutral-900">
                    <span>Zdroj: <strong className="text-white">{showHowSteps.source}</strong></span>
                    <span className="bg-neutral-800 px-2 py-0.5 rounded text-amber-300 font-mono">
                      Kategória: {showHowSteps.category}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-medium">
                  🎓 Edit Academy Poznámka: OmniStrih vysvetľuje každé rozhodnutie na základe overených filmových a digitálnych princípov (Murch Rules, AES Broadcast Standards, YouTube & ByteDance Analytics).
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="pt-3 border-t border-neutral-800 flex items-center justify-between">
              <span className="text-[11px] text-neutral-500 italic">
                OmniStrih Edit Academy — Uč sa profesionálne editovať
              </span>
              <button
                onClick={() => setShowHowSteps(null)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl transition"
              >
                Rozumiem, zvládnem sama
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

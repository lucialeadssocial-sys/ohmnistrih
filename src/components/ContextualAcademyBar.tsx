import React, { useState } from 'react';
import { 
  BookOpen, 
  HelpCircle, 
  ListOrdered, 
  Sparkles, 
  X,
  Play,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getTeachMeExplanation } from '../core/ai/knowledgeBase';
import { TeachMeExplanation } from '../core/ai/analysisTypes';
import { playheadStore } from '../core/playback/playheadStore';

interface ContextualAcademyBarProps {
  topicKey: string;
  language: 'sk' | 'en';
  contextLabel?: string;
  onPractice?: (topicKey: string) => void;
  onCompare?: (topicKey: string) => void;
}

export const ContextualAcademyBar: React.FC<ContextualAcademyBarProps> = ({
  topicKey,
  language,
  contextLabel,
  onPractice,
  onCompare
}) => {
  const isSk = language === 'sk';
  const explanation = getTeachMeExplanation(topicKey);
  const [activeModal, setActiveModal] = useState<'HOW' | 'WHY' | 'ACADEMY' | 'PRACTICE' | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  if (!explanation) return null;

  const toggleStepCompleted = (idx: number) => {
    if (completedSteps.includes(idx)) {
      setCompletedSteps(completedSteps.filter(i => i !== idx));
    } else {
      setCompletedSteps([...completedSteps, idx]);
    }
  };

  const handleSeekToTime = (timeInSec?: number) => {
    if (timeInSec === undefined) return;
    playheadStore.setTime(timeInSec, true);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-1">
      {/* WHY Button */}
      <button
        onClick={() => setActiveModal('WHY')}
        className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-[10px] font-bold text-amber-400 border border-amber-500/20 flex items-center gap-1 transition-all"
        title={isSk ? "Prečo?" : "Why?"}
      >
        <HelpCircle className="w-3 h-3" />
        <span>WHY</span>
      </button>

      {/* SHOW ME HOW Button */}
      <button
        onClick={() => setActiveModal('HOW')}
        className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-[10px] font-bold text-rose-400 border border-rose-500/20 flex items-center gap-1 transition-all"
        title={isSk ? "Ako na to?" : "Show me how?"}
      >
        <ListOrdered className="w-3 h-3" />
        <span>SHOW ME HOW</span>
      </button>

      {/* LEARN THIS Button */}
      <button
        onClick={() => setActiveModal('ACADEMY')}
        className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-[10px] font-bold text-indigo-400 border border-indigo-500/20 flex items-center gap-1 transition-all"
        title={isSk ? "Uč sa viac" : "Learn more"}
      >
        <BookOpen className="w-3 h-3" />
        <span>LEARN THIS</span>
      </button>

      {/* PRACTICE Button */}
      {onPractice && (
        <button
          onClick={() => onPractice(topicKey)}
          className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-[10px] font-bold text-emerald-400 border border-emerald-500/20 flex items-center gap-1 transition-all"
        >
          <Target className="w-3 h-3" />
          <span>PRACTICE</span>
        </button>
      )}

      {/* COMPARE Button */}
      {onCompare && (
        <button
          onClick={() => onCompare(topicKey)}
          className="px-2 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-[10px] font-bold text-blue-400 border border-blue-500/20 flex items-center gap-1 transition-all"
        >
          <Sparkles className="w-3 h-3" />
          <span>COMPARE</span>
        </button>
      )}

      {/* Unified Contextual Modal */}
      <AnimatePresence>
        {activeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-2xl w-full p-6 text-white space-y-5 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-neutral-800 pb-4 gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                      {explanation.category}
                    </span>
                    <span className="bg-neutral-800 text-neutral-300 text-[10px] px-2 py-0.5 rounded font-mono">
                      {explanation.topic}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    {activeModal === 'HOW' && <ListOrdered className="w-5 h-5 text-rose-400 shrink-0" />}
                    {activeModal === 'WHY' && <HelpCircle className="w-5 h-5 text-amber-400 shrink-0" />}
                    {activeModal === 'ACADEMY' && <BookOpen className="w-5 h-5 text-indigo-400 shrink-0" />}
                    {explanation.topic} {contextLabel && <span className="text-neutral-500 font-normal">— {isSk ? 'Uč sa na' : 'Learn on'} {contextLabel}</span>}
                  </h3>
                </div>

                <button
                  onClick={() => setActiveModal(null)}
                  className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Sub-tab Navigation within Modal */}
              <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
                <button
                  
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition ${
                    activeModal === 'HOW'
                      ? 'bg-rose-500 text-white shadow-md'
                      : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                  onClick={() => setActiveModal('HOW')}
                >
                  <ListOrdered className="w-4 h-4" /> {isSk ? 'AKO NA TO' : 'SHOW ME HOW'}
                </button>
                <button
                  onClick={() => setActiveModal('WHY')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition ${
                    activeModal === 'WHY'
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  <HelpCircle className="w-4 h-4" /> {isSk ? 'PREČO' : 'WHY'}
                </button>
                <button
                  onClick={() => setActiveModal('ACADEMY')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition ${
                    activeModal === 'ACADEMY'
                      ? 'bg-indigo-500 text-white shadow-md'
                      : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  <BookOpen className="w-4 h-4" /> {isSk ? 'ACADEMY' : 'LEARN THIS'}
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                {activeModal === 'HOW' && (
                  <div className="space-y-4">
                    {explanation.manualWorkflowSteps && explanation.manualWorkflowSteps.length > 0 ? (
                      <>
                        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between text-xs font-bold text-rose-400">
                            <span>KROK {activeStepIndex + 1} Z {explanation.manualWorkflowSteps.length}</span>
                            <span className="text-[11px] text-neutral-400">
                              Dokončené {completedSteps.length} / {explanation.manualWorkflowSteps.length}
                            </span>
                          </div>

                          <p className="text-sm font-semibold text-rose-100">
                            {explanation.manualWorkflowSteps[activeStepIndex]}
                          </p>

                          <div className="flex items-center justify-between pt-2 border-t border-rose-500/20">
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
                                  : 'bg-rose-500 text-white hover:bg-rose-600'
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {completedSteps.includes(activeStepIndex) ? 'Splnené ✓' : 'Spraviť manuálne'}
                            </button>

                            <button
                              onClick={() => setActiveStepIndex(Math.min(explanation.manualWorkflowSteps!.length - 1, activeStepIndex + 1))}
                              disabled={activeStepIndex === (explanation.manualWorkflowSteps?.length || 0) - 1}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-800 text-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-700"
                            >
                              Ďalší krok ►
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {explanation.manualWorkflowSteps.map((step, idx) => (
                            <div
                              key={idx}
                              onClick={() => setActiveStepIndex(idx)}
                              className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                                activeStepIndex === idx
                                  ? 'border-rose-500 bg-rose-500/10'
                                  : completedSteps.includes(idx)
                                  ? 'border-emerald-500/30 bg-emerald-950/10'
                                  : 'border-neutral-800 bg-neutral-950 hover:bg-neutral-900'
                              }`}
                            >
                              <div className={`mt-0.5 p-1 rounded transition ${completedSteps.includes(idx) ? 'text-emerald-400' : 'text-neutral-500'}`}>
                                <CheckCircle2 className="w-4 h-4" />
                              </div>
                              <p className={`text-xs font-medium ${completedSteps.includes(idx) ? 'line-through text-neutral-400' : 'text-white'}`}>
                                {step}
                              </p>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="py-10 text-center text-neutral-500 italic text-sm">
                        Pre tento tému zatiaľ nie je dostupný interaktívny postup.
                      </div>
                    )}
                  </div>
                )}

                {activeModal === 'WHY' && (
                  <div className="space-y-4 text-sm">
                    <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-2">
                      <span className="font-bold text-amber-400 uppercase tracking-wider block text-[10px]">WHY — Dôvod</span>
                      <p className="text-neutral-200 leading-relaxed">{explanation.why}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-2">
                        <span className="font-bold text-emerald-400 uppercase tracking-wider block text-[10px]">WHEN — Kedy použiť</span>
                        <p className="text-neutral-300 text-xs">{explanation.whenToUse}</p>
                      </div>
                      <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-2">
                        <span className="font-bold text-rose-400 uppercase tracking-wider block text-[10px]">WHEN NOT — Kedy nepoužiť</span>
                        <p className="text-neutral-300 text-xs">{explanation.whenNotToUse}</p>
                      </div>
                    </div>
                    <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-2">
                      <span className="font-bold text-indigo-400 uppercase tracking-wider block text-[10px]">PRINCIPLE</span>
                      <p className="text-neutral-300 text-xs">{explanation.principle}</p>
                    </div>
                  </div>
                )}

                {activeModal === 'ACADEMY' && (
                  <div className="space-y-4">
                    <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-3">
                      <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Knowledge Base Entry</span>
                        <span className="text-[10px] text-neutral-500 font-mono">Source: {explanation.source}</span>
                      </div>
                      <p className="text-neutral-200 text-sm leading-relaxed">{explanation.explanation}</p>
                      <div className="p-3 bg-indigo-500/5 rounded-lg border border-indigo-500/10 text-xs text-indigo-300 italic">
                        " {explanation.example} "
                      </div>
                    </div>

                    <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-3">
                      <span className="font-bold text-rose-400 uppercase tracking-wider block text-[10px]">Anti-Pattern (Čomu sa vyhnúť)</span>
                      <div className="p-3 bg-rose-500/5 rounded-lg border border-rose-500/10 text-xs text-rose-300">
                        {explanation.antiPattern}
                      </div>
                    </div>

                    {explanation.alternativeChoices && (
                      <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-2">
                        <span className="font-bold text-emerald-400 uppercase tracking-wider block text-[10px]">Alternatívy</span>
                        <ul className="space-y-1.5">
                          {explanation.alternativeChoices.map((choice, i) => (
                            <li key={i} className="text-xs text-neutral-400 flex items-center gap-2">
                              <ChevronRight className="w-3 h-3 text-emerald-500" />
                              {choice}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-neutral-500 italic">OmniStrih Edit Academy</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <span className="text-[10px] text-neutral-500">{explanation.sourceType}</span>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded-xl transition"
                >
                  {isSk ? 'ROZUMIEM' : 'I UNDERSTAND'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

import React, { useState } from 'react';
import { GraduationCap, X, BookOpen, ChevronLeft, CheckCircle2, Quote, Wrench, AlertTriangle, Layers, Film } from 'lucide-react';
import { EDIT_KNOWLEDGE_BASE } from '../core/ai/knowledgeBase';
import { TeachMeExplanation } from '../core/ai/analysisTypes';
import { MulticamAcademy } from './editor/MulticamAcademy';
import { MotionAcademy } from './MotionAcademy';

/**
 * Edit Academy — the single entry point that Home links to.
 *
 * This component intentionally owns no lesson data and no teaching engine: the principle
 * lessons come from the existing EDIT_KNOWLEDGE_BASE (the same knowledge base the Director
 * Engine uses to justify its decisions), and the Multicam / Motion modules render the
 * existing Academy components unchanged.
 */

type AcademyModule = 'PRINCIPLES' | 'MULTICAM' | 'MOTION';

interface EditAcademyCenterProps {
  isOpen: boolean;
  onClose: () => void;
  language: 'sk' | 'en';
  showToast?: (msg: string) => void;
}

const PRINCIPLE_LESSONS: { key: string; lesson: TeachMeExplanation }[] = Object.entries(EDIT_KNOWLEDGE_BASE)
  .map(([key, lesson]) => ({ key, lesson }));

const LessonRow: React.FC<{
  lesson: TeachMeExplanation;
  index: number;
  isOpened: boolean;
  onOpen: () => void;
}> = ({ lesson, index, isOpened, onOpen }) => (
  <button
    onClick={onOpen}
    className="w-full text-left p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-indigo-500/50 hover:bg-zinc-900 transition-all group flex items-start justify-between gap-3"
  >
    <div className="min-w-0">
      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">
        Lekcia {index + 1} • {lesson.category || 'editorial'}
      </span>
      <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
        {lesson.topic}
      </h4>
      <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{lesson.principle}</p>
    </div>
    <div className="shrink-0 flex items-center gap-2 pt-1">
      {isOpened && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
      <BookOpen className="w-4 h-4 text-zinc-600 group-hover:text-indigo-400 transition-colors" />
    </div>
  </button>
);

const PrincipleLesson: React.FC<{
  lesson: TeachMeExplanation;
  onBack: () => void;
  isSk: boolean;
}> = ({ lesson, onBack, isSk }) => (
  <div className="space-y-4">
    <button
      onClick={onBack}
      className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors"
    >
      <ChevronLeft className="w-3.5 h-3.5" />
      {isSk ? 'Späť na zoznam lekcií' : 'Back to lesson list'}
    </button>

    <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
      <div className="space-y-2">
        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">
          {lesson.category || 'editorial'} • {lesson.region} • {lesson.platformTarget}
        </span>
        <h3 className="text-lg font-black text-white">{lesson.topic}</h3>
        <p className="text-sm text-indigo-100 font-medium">{lesson.principle}</p>
      </div>

      <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
        <div>
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1">
            {isSk ? 'Čo to je (WHAT)' : 'What it is (WHAT)'}
          </span>
          {lesson.explanation}
        </div>
        <div>
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1">
            {isSk ? 'Prečo to funguje (WHY)' : 'Why it works (WHY)'}
          </span>
          {lesson.why}
        </div>
        <div>
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1">
            {isSk ? 'Kedy použiť (WHEN)' : 'When to use (WHEN)'}
          </span>
          {lesson.whenToUse}
        </div>
        <div>
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1">
            {isSk ? 'Kedy NEPOUŽIŤ (WHEN NOT)' : 'When NOT to use (WHEN NOT)'}
          </span>
          {lesson.whenNotToUse}
        </div>
        <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex gap-2">
          <Quote className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
          <span>{lesson.example}</span>
        </div>
        <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/40 text-amber-200/90 flex gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            <strong className="font-black uppercase tracking-wider text-[10px] block">
              {isSk ? 'Anti-pattern' : 'Anti-pattern'}
            </strong>
            {lesson.antiPattern}
          </span>
        </div>
      </div>

      {lesson.manualWorkflowSteps && lesson.manualWorkflowSteps.length > 0 && (
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
            <Wrench className="w-3.5 h-3.5" />
            {isSk ? 'Ako to spraviť v editore' : 'How to do it in the editor'}
          </span>
          <ol className="space-y-1.5 text-xs text-zinc-300">
            {lesson.manualWorkflowSteps.map((step, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="text-zinc-600 font-mono">{idx + 1}.</span>
                <span>{step.replace(/^\d+\.\s*/, '')}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {lesson.alternativeChoices && lesson.alternativeChoices.length > 0 && (
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
            <Layers className="w-3.5 h-3.5" />
            {isSk ? 'Alternatívy' : 'Alternatives'}
          </span>
          <ul className="space-y-1.5 text-xs text-zinc-300">
            {lesson.alternativeChoices.map((alt, idx) => (
              <li key={idx}>• {alt}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-[10px] text-zinc-500 font-mono border-t border-zinc-800 pt-3">
        {isSk ? 'Zdroj' : 'Source'}: {lesson.source} ({lesson.sourceType}) •{' '}
        {isSk ? 'istota' : 'confidence'} {Math.round(lesson.confidence * 100)}%
      </div>
    </div>
  </div>
);

export const EditAcademyCenter: React.FC<EditAcademyCenterProps> = ({ isOpen, onClose, language }) => {
  const isSk = language === 'sk';
  const [activeModule, setActiveModule] = useState<AcademyModule>('PRINCIPLES');
  const [openLessonKey, setOpenLessonKey] = useState<string | null>(null);
  const [openedLessons, setOpenedLessons] = useState<string[]>([]);

  if (!isOpen) return null;

  const openLesson = (key: string) => {
    setOpenLessonKey(key);
    setOpenedLessons(prev => (prev.includes(key) ? prev : [...prev, key]));
  };

  const activeLesson = openLessonKey ? PRINCIPLE_LESSONS.find(l => l.key === openLessonKey) : null;

  const modules: { id: AcademyModule; labelSk: string; labelEn: string; icon: any }[] = [
    { id: 'PRINCIPLES', labelSk: 'Princípy strihu', labelEn: 'Editing principles', icon: BookOpen },
    { id: 'MULTICAM', labelSk: 'Multicam', labelEn: 'Multicam', icon: Layers },
    { id: 'MOTION', labelSk: 'Pohyb a animácia', labelEn: 'Motion & animation', icon: Film },
  ];

  const progressPercent = Math.round((openedLessons.length / PRINCIPLE_LESSONS.length) * 100);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-950/80 border border-indigo-800 rounded-xl text-indigo-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-widest">
                {isSk ? 'Edit Academy' : 'Edit Academy'}
              </h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                {isSk
                  ? `${PRINCIPLE_LESSONS.length} lekcií z knowledge base • ${openedLessons.length} otvorených (${progressPercent}%)`
                  : `${PRINCIPLE_LESSONS.length} knowledge-base lessons • ${openedLessons.length} opened (${progressPercent}%)`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
            title={isSk ? 'Zavrieť Academy' : 'Close Academy'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Module navigation */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/50 px-2 shrink-0">
          {modules.map(mod => (
            <button
              key={mod.id}
              onClick={() => {
                setActiveModule(mod.id);
                setOpenLessonKey(null);
              }}
              className={`flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${
                activeModule === mod.id
                  ? 'text-indigo-400 border-indigo-500 bg-indigo-500/5'
                  : 'text-zinc-500 border-transparent hover:text-zinc-300'
              }`}
            >
              <mod.icon className="w-3.5 h-3.5" />
              {isSk ? mod.labelSk : mod.labelEn}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeModule === 'PRINCIPLES' && (
            <div className="space-y-4">
              {activeLesson ? (
                <PrincipleLesson lesson={activeLesson.lesson} onBack={() => setOpenLessonKey(null)} isSk={isSk} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {PRINCIPLE_LESSONS.map((entry, idx) => (
                    <LessonRow
                      key={entry.key}
                      lesson={entry.lesson}
                      index={idx}
                      isOpened={openedLessons.includes(entry.key)}
                      onOpen={() => openLesson(entry.key)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeModule === 'MULTICAM' && <MulticamAcademy />}
          {activeModule === 'MOTION' && <MotionAcademy />}
        </div>
      </div>
    </div>
  );
};

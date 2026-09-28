import React, { useState } from 'react';
import { useCoreProject, coreEngine } from '../../core';
import { BookOpen, GraduationCap, Play, Trophy, HelpCircle, ChevronRight, CheckCircle2, Monitor } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const MulticamAcademy: React.FC = () => {
  const { project } = useCoreProject();
  // Real count of angle decisions written to the canonical timeline by
  // coreEngine.switchMulticamAngle (Multicam Viewer). No sample/AI score is invented.
  const angleDecisions = project.tracks
    .flatMap(t => t.clips)
    .filter(c => !!c.multicamAngleId).length;
  const [activeLesson, setActiveLesson] = useState(0);
  const [practiceMode, setPracticeMode] = useState(false);
  const [score, setTrophyScore] = useState(0);

  const lessons = [
    {
      title: "Základy Multicamu",
      description: "Prečo používať viac kamier a ako funguje synchronizácia.",
      content: "Multicam strih umožňuje prepínať medzi viacerými uhlami snímania tej istej udalosti v reálnom čase. Kľúčom je presná synchronizácia (najčastejšie cez audio waveformy).",
      principle: "Vždy strihaj na dôležitú akciu alebo na začiatok vety rečníka."
    },
    {
      title: "Speaker-Aware Strih",
      description: "Kedy prepnúť na detail a kedy nechať celok.",
      content: "V podcastoch a rozhovoroch prepíname na detail toho, kto práve hovorí. Niekedy je však lepšie ukázať reakciu druhého človeka (Reaction Shot).",
      principle: "Udržuj vizuálnu hierarchiu: Hovorca = Detail, Kontext = Široký záber."
    },
    {
      title: "Rytmus a Pacing",
      description: "Ako často by ste mali meniť uhol?",
      content: "Príliš častý strih pôsobí chaoticky, príliš zriedkavý nudne. Štandard je zmena každých 3-7 sekúnd, v závislosti od dynamiky reči.",
      principle: "Strih by mal byť motivovaný - zmenou témy, emóciou alebo gestom."
    }
  ];

  const startPractice = () => {
    setPracticeMode(true);
    // In real app, this would load a specific multicam demo project
    coreEngine.createProjectVersion('Multicam Practice Start', 'Initial state for multicam practice');
  };

  const completePractice = () => {
    setTrophyScore(score + 100);
    setPracticeMode(false);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-6 bg-gradient-to-br from-indigo-900/40 to-zinc-950 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
             <div className="p-2.5 bg-indigo-500 rounded-xl shadow-[0_0_15px_rgba(99,102,241,0.5)]">
               <GraduationCap className="w-5 h-5 text-white" />
             </div>
             <div>
               <h2 className="text-lg font-black text-white uppercase tracking-tight">Multicam Academy</h2>
               <p className="text-xs text-indigo-300 font-medium italic">Master the art of multi-angle storytelling</p>
             </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-full">
             <Trophy className="w-3.5 h-3.5 text-amber-400" />
             <span className="text-xs font-bold text-white font-mono">{score} XP</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-6 overflow-y-auto">
        {!practiceMode ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3">
              {lessons.map((lesson, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveLesson(idx)}
                  className={`p-4 rounded-xl border transition-all text-left group ${
                    activeLesson === idx 
                      ? 'bg-zinc-900 border-indigo-500/50 ring-1 ring-indigo-500/20' 
                      : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Lekcia {idx + 1}</span>
                    {idx < activeLesson && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                  </div>
                  <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">{lesson.title}</h4>
                  <p className="text-xs text-zinc-500 mt-1">{lesson.description}</p>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeLesson}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-4"
              >
                <div className="flex items-center gap-2 text-white">
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-bold">{lessons[activeLesson].title}</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {lessons[activeLesson].content}
                </p>
                <div className="p-3 bg-indigo-950/20 border border-indigo-500/20 rounded-xl">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Kľúčový princíp:</span>
                  <p className="text-xs text-indigo-100 italic">"{lessons[activeLesson].principle}"</p>
                </div>
              </motion.div>
            </AnimatePresence>

            <button
              onClick={startPractice}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-xs rounded-xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-indigo-600/20"
            >
              <Play className="w-4 h-4 fill-current" />
              Spustiť Practice Mode
            </button>
          </div>
        ) : (
          <div className="space-y-6 flex-1 flex flex-col">
             <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-20 h-20 bg-indigo-950/40 rounded-full flex items-center justify-center border-2 border-indigo-500/30 animate-pulse">
                   <Monitor className="w-10 h-10 text-indigo-400" />
                </div>
                <div>
                   <h3 className="text-lg font-black text-white uppercase tracking-tight">Interactive Practice</h3>
                   <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                     Prepínaj uhly v Multicam Vieweri (Workspace → Multicam Viewer). Každá zmena uhla sa zapíše do časovej osi ako reálny Multicam klip.
                   </p>
                </div>
                
                <div className="w-full grid grid-cols-2 gap-3 mt-4">
                   <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase block">Zmeny uhla na časovej osi</span>
                      <span className="text-xl font-mono text-white font-black">{angleDecisions}</span>
                   </div>
                   <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase block">AI porovnanie</span>
                      <span className="text-[11px] text-zinc-500 font-bold block mt-1">NEMERANÉ — porovnanie rozhodnutí nie je implementované</span>
                   </div>
                </div>
             </div>

             <div className="space-y-3">
                <button
                  onClick={completePractice}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-[10px] rounded-lg transition-all"
                >
                  Ukončiť a vyhodnotiť
                </button>
                <button
                  onClick={() => setPracticeMode(false)}
                  className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-black uppercase tracking-widest text-[10px] rounded-lg transition-all"
                >
                  Zrušiť cvičenie
                </button>
             </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-4 bg-zinc-900/50 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-500">
         <span className="flex items-center gap-1.5 uppercase font-bold tracking-widest">
            <GraduationCap className="w-3 h-3" /> Level: <span className="text-indigo-400">Intermediate</span>
         </span>
         <span className="font-mono">OMNISTRIH ED.SYSTEM V3</span>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useCoreProject, coreEngine } from '../../core';
import { Scissors, ArrowLeftRight, Move, SquareSplitVertical, Maximize2, MousePointer2 } from 'lucide-react';

export const AdvancedTrimmingUI: React.FC = () => {
  const { project } = useCoreProject();
  const [trimMode, setTrimMode] = useState<'ripple' | 'roll' | 'slip' | 'slide'>('ripple');

  const selectedClip = project.tracks.flatMap(t => t.clips)[0]; // For demo, pick first clip

  const handleTrim = (delta: number) => {
    if (!selectedClip) return;

    switch (trimMode) {
      case 'ripple':
        coreEngine.trimClip(selectedClip.id, 'right', delta, true);
        break;
      case 'slip':
        coreEngine.slipClip(selectedClip.id, delta);
        break;
      case 'slide':
        coreEngine.slideClip(selectedClip.id, delta);
        break;
      // roll would need both sides, implemented via slide logic usually
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2 uppercase tracking-tight">
          <Scissors className="w-4 h-4 text-rose-500" /> Advanced Trim Studio
        </h3>
        <div className="flex gap-1 bg-black/40 p-1 rounded-md border border-zinc-800">
           {[
             { id: 'ripple', icon: Scissors, label: 'Ripple' },
             { id: 'roll', icon: SquareSplitVertical, label: 'Roll' },
             { id: 'slip', icon: ArrowLeftRight, label: 'Slip' },
             { id: 'slide', icon: Move, label: 'Slide' }
           ].map(mode => (
             <button
               key={mode.id}
               onClick={() => setTrimMode(mode.id as any)}
               className={`p-1.5 rounded transition-all flex items-center gap-1.5 ${
                 trimMode === mode.id ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/20' : 'text-zinc-500 hover:text-zinc-300'
               }`}
               title={mode.label}
             >
               <mode.icon className="w-3.5 h-3.5" />
               <span className="text-[10px] font-bold px-0.5">{mode.label}</span>
             </button>
           ))}
        </div>
      </div>

      {/* Double View Preview (Mock) */}
      <div className="grid grid-cols-2 gap-2 flex-1">
         <div className="aspect-video bg-black rounded-lg border border-zinc-800 relative group overflow-hidden">
            <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 rounded text-[9px] font-mono text-zinc-400 z-10 border border-white/10 uppercase">Outgoing: {selectedClip?.name || 'Clip A'}</div>
            <img src="https://picsum.photos/seed/trim1/320/180" className="w-full h-full object-cover opacity-60" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
               <div className="w-0.5 h-full bg-rose-500/50" />
            </div>
         </div>
         <div className="aspect-video bg-black rounded-lg border border-zinc-800 relative group overflow-hidden">
            <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 rounded text-[9px] font-mono text-zinc-400 z-10 border border-white/10 uppercase">Incoming: Clip B</div>
            <img src="https://picsum.photos/seed/trim2/320/180" className="w-full h-full object-cover opacity-60" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
               <div className="w-0.5 h-full bg-rose-500/50" />
            </div>
         </div>
      </div>

      {/* Nudge Controls */}
      <div className="flex items-center justify-center gap-4 bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50">
         <div className="flex gap-1">
            <button onClick={() => handleTrim(-5/30)} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-[10px] font-bold text-zinc-400">-5 fr</button>
            <button onClick={() => handleTrim(-1/30)} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-[10px] font-bold text-zinc-400">-1 fr</button>
         </div>
         
         <div className="flex flex-col items-center">
            <span className="text-[10px] font-mono text-rose-500 font-bold mb-1 uppercase tracking-widest">{trimMode} MODE</span>
            <div className="flex items-center gap-2">
               <MousePointer2 className="w-3.5 h-3.5 text-zinc-600" />
               <span className="text-lg font-mono font-black text-white tabular-nums">+00:00:00</span>
            </div>
         </div>

         <div className="flex gap-1">
            <button onClick={() => handleTrim(1/30)} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-[10px] font-bold text-zinc-400">+1 fr</button>
            <button onClick={() => handleTrim(5/30)} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-[10px] font-bold text-zinc-400">+5 fr</button>
         </div>
      </div>

      {/* Logic Explanation (Learning Gate) */}
      <div className="p-3 bg-indigo-950/10 border border-indigo-900/30 rounded-xl">
         <div className="flex items-center gap-2 mb-1.5">
            <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Editing Principle</span>
         </div>
         <p className="text-[11px] text-zinc-400 leading-relaxed">
            {trimMode === 'ripple' && "Ripple trim mení dĺžku celého projektu. Použi ho, keď chceš odstrániť ticho alebo chybu a chceš, aby sa zvyšok videa posunul."}
            {trimMode === 'slip' && "Slip edit mení vnútorné časovanie klipu bez zmeny jeho pozície alebo dĺžky na timeline. Ideálne na doladenie akcie v zábere."}
            {trimMode === 'slide' && "Slide edit posúva klip medzi dvoma susednými klipmi. Dĺžka vybraného klipu ostáva, menia sa dĺžky klipov pred ním a za ním."}
            {trimMode === 'roll' && "Roll trim mení bod strihu medzi dvoma klipmi bez zmeny celkovej dĺžky projektu. Jeden klip sa skracuje, druhý predlžuje."}
         </p>
      </div>
    </div>
  );
};

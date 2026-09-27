import React from 'react';
import { useCoreProject, coreEngine } from '../../core';
import { MulticamGroup, MulticamAngle } from '../../core/types/project';
import { Monitor, LayoutGrid, Zap, Info, Play } from 'lucide-react';

export const MulticamViewer: React.FC = () => {
  const { project } = useCoreProject();
  const playheadTime = project.playheadTime;
  
  // Find active multicam clip at playhead
  const activeClips = project.tracks.flatMap(t => t.clips).filter(c => 
    c.multicamGroupId && 
    playheadTime >= c.timelineStart && 
    playheadTime < c.timelineStart + c.duration
  );

  const activeClip = activeClips[0];
  const activeGroup = project.multicamGroups?.find(g => g.id === activeClip?.multicamGroupId);

  const handleAngleClick = (angle: MulticamAngle) => {
    if (activeClip) {
      coreEngine.switchMulticamAngle(activeClip.id, angle.id, playheadTime);
    }
  };

  if (!activeGroup) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 bg-zinc-900/50 rounded-lg border border-zinc-800 p-8 text-center">
        <Monitor className="w-12 h-12 mb-4 opacity-20" />
        <h3 className="text-zinc-300 font-medium mb-2">Multicam Angle Viewer</h3>
        <p className="text-sm max-w-xs">
          Pre aktiváciu Multicam náhľadu vyberte Multicam klip na časovej osi.
        </p>
        <button 
          onClick={() => {}}
          className="mt-6 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-md transition-colors"
        >
          Ako vytvoriť Multicam Group?
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Multicam Live Switching</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono">
            <span className="text-zinc-600">GROUP:</span>
            <span className="text-zinc-300 uppercase">{activeGroup.name}</span>
          </div>
          <div className="h-3 w-px bg-zinc-800" />
          <button className="text-zinc-400 hover:text-white transition-colors">
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Angle Grid */}
      <div className="flex-1 p-3 grid grid-cols-2 gap-3 overflow-y-auto">
        {activeGroup.angles.map((angle, idx) => {
          const isActive = activeClip?.multicamAngleId === angle.id;
          return (
            <div 
              key={angle.id}
              onClick={() => handleAngleClick(angle)}
              className={`group relative aspect-video bg-black rounded-md overflow-hidden cursor-pointer border-2 transition-all ${
                isActive ? 'border-red-500 ring-4 ring-red-500/20' : 'border-zinc-800 hover:border-zinc-600'
              }`}
            >
              {/* Fake Video Preview */}
              <div className="absolute inset-0 flex items-center justify-center">
                 <img 
                   src={`https://picsum.photos/seed/${angle.assetId}/400/225`} 
                   alt={angle.name}
                   className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                 />
                 {isActive && (
                   <div className="absolute inset-0 bg-red-500/10 pointer-events-none" />
                 )}
              </div>

              {/* Angle Info Overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${
                      isActive ? 'bg-red-500 text-white' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className="text-[11px] font-medium text-white truncate max-w-[100px]">
                      {angle.name}
                    </span>
                  </div>
                  {isActive && (
                    <span className="text-[9px] font-bold text-red-500 animate-pulse">ON AIR</span>
                  )}
                </div>
              </div>

              {/* Selection Indicator */}
              <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${isActive ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-white/20'}`} />
            </div>
          );
        })}
      </div>

      {/* Footer / Controls */}
      <div className="px-4 py-3 bg-zinc-900/80 border-t border-zinc-800 flex items-center justify-between">
        <div className="flex gap-2">
           <button className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium rounded transition-colors border border-zinc-700/50">
             <Zap className="w-3 h-3 text-amber-400" />
             AI Speaker Sync
           </button>
           <button className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium rounded transition-colors border border-zinc-700/50">
             <Info className="w-3 h-3" />
             Switching Rules
           </button>
        </div>
        
        <div className="text-[10px] font-mono text-zinc-500">
           MODE: <span className="text-emerald-400">REAL-TIME SWITCHING</span>
        </div>
      </div>
    </div>
  );
};

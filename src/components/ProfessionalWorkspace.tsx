import React, { useState } from 'react';
import { MediaManagerPanel } from './MediaManagerPanel';
import { DirectorProductionCenter } from './DirectorProductionCenter';
import { EditorBrainStudio } from './EditorBrainStudio';
import { SourceMonitor } from './SourceMonitor';
import { OpenSourceLab } from './OpenSourceLab';
import { MulticamViewer } from './editor/MulticamViewer';
import { AdvancedTrimmingUI } from './editor/AdvancedTrimmingUI';
import { MulticamAcademy } from './editor/MulticamAcademy';
import { MediaAsset } from '../core/types/project';
import { Monitor, Scissors, GraduationCap, Brain, Database, Film } from 'lucide-react';

export const ProfessionalWorkspace: React.FC<{
  language: "sk" | "en";
  showToast: (msg: string) => void;
  projectId: string;
}> = ({ language, showToast, projectId }) => {
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [activeTab, setActiveTab] = useState<"monitor" | "multicam" | "trim" | "academy" | "lab">("monitor");

  return (
    <div className="grid grid-cols-12 grid-rows-12 h-screen w-full gap-2 p-2 bg-zinc-950 overflow-hidden text-zinc-300">
      {/* Sidebar: Media & Assets */}
      <div className="col-span-3 row-span-8 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
        <MediaManagerPanel language={language} showToast={showToast} onSetVideoUrl={() => {}} onAssetSelect={setSelectedAsset} />
      </div>

      {/* Main Viewport Area */}
      <div className="col-span-6 row-span-8 bg-black border border-zinc-800 rounded-xl flex flex-col shadow-2xl overflow-hidden">
        {/* Viewport Tabs */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/50 px-2">
          {[
            { id: 'monitor', label: 'SOURCE MONITOR', icon: Monitor },
            { id: 'multicam', label: 'MULTICAM VIEWER', icon: Film },
            { id: 'trim', label: 'ADVANCED TRIM', icon: Scissors },
            { id: 'academy', label: 'ACADEMY', icon: GraduationCap },
            { id: 'lab', label: 'OPEN SOURCE LAB', icon: Database },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)} 
              className={`flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${
                activeTab === tab.id 
                  ? 'text-rose-500 border-rose-600 bg-rose-500/5' 
                  : 'text-zinc-500 border-transparent hover:text-zinc-300'
              }`}
            >
              <tab.icon className={`w-3 h-3 ${activeTab === tab.id ? 'text-rose-500' : 'text-zinc-600'}`} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dynamic Content Rendering */}
        <div className="flex-1 overflow-hidden relative">
           {activeTab === 'monitor' && <SourceMonitor asset={selectedAsset} language={language} showToast={showToast} />}
           {activeTab === 'multicam' && <MulticamViewer />}
           {activeTab === 'trim' && <AdvancedTrimmingUI />}
           {activeTab === 'academy' && <MulticamAcademy />}
           {activeTab === 'lab' && <OpenSourceLab />}
        </div>
      </div>

      {/* Right Panel: Editor Brain & Intelligence */}
      <div className="col-span-3 row-span-8 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
        <EditorBrainStudio language={language} showToast={showToast} editDNA={{} as any} onUpdateEditDNA={() => {}} />
      </div>

      {/* Bottom Panel Left: Director & AI Ops */}
      <div className="col-span-4 row-span-4 bg-zinc-900 border border-zinc-800 rounded-xl p-3 overflow-auto shadow-2xl">
        <div className="flex items-center gap-2 mb-3 border-b border-zinc-800 pb-2">
           <Brain className="w-4 h-4 text-rose-500" />
           <span className="text-[10px] font-black text-white uppercase tracking-widest">Director Plan Center</span>
        </div>
        <DirectorProductionCenter language={language} showToast={showToast} projectId={projectId} />
      </div>
      
      {/* Bottom Panel Right: Professional Timeline Placeholder */}
      <div className="col-span-8 row-span-4 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col shadow-2xl overflow-hidden">
         <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-950/50">
            <div className="flex items-center gap-3">
               <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Canonical Timeline Engine</span>
               <div className="h-3 w-px bg-zinc-800" />
               <span className="text-[10px] font-mono text-zinc-500">PROJECT: {projectId.slice(0, 8)}</span>
            </div>
            <div className="flex gap-4 text-[10px] font-bold text-zinc-400">
               <span>23.976 FPS</span>
               <span>48kHz</span>
               <span>STEREO</span>
            </div>
         </div>
         <div className="flex-1 flex items-center justify-center relative group">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-10" />
            <div className="flex flex-col items-center gap-4 z-10">
               <div className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="w-1/3 h-full bg-rose-500 animate-[shimmer_2s_infinite]" />
               </div>
               <span className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Waiting for Sequence Initialization</span>
            </div>
         </div>
      </div>
    </div>
  );
};

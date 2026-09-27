import React from 'react';
import { Plus, FolderOpen, Film, Tv, User, Mic, Briefcase, Zap, Settings } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  onNewProject: (type: string) => void;
  onOpenProject: () => void;
}

const ProjectTypeCard = ({ title, icon: Icon, onClick }: { title: string, icon: any, onClick: () => void }) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className="flex flex-col items-center justify-center p-8 rounded-3xl bg-neutral-900 border border-neutral-800 hover:border-rose-500/50 transition-all shadow-lg hover:shadow-rose-500/10"
  >
    <Icon className="w-10 h-10 text-rose-500 mb-4" />
    <span className="text-sm font-black uppercase tracking-wider text-white">{title}</span>
  </motion.button>
);

export const OmniStrihHome: React.FC<Props> = ({ onNewProject, onOpenProject }) => {
  return (
    <div className="min-h-screen bg-neutral-950 p-6 md:p-12 text-neutral-200">
      <header className="flex justify-between items-center mb-16">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center">
            <Zap className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter">OMNISTRIH SYNC TEST</h1>
        </div>
        <button className="text-neutral-500 hover:text-white">
          <Settings className="w-6 h-6" />
        </button>
      </header>

      <main className="max-w-6xl mx-auto">
        <div className="flex gap-4 mb-12">
          <button 
            onClick={() => onNewProject('custom')}
            className="flex-1 flex items-center justify-center gap-3 p-6 rounded-3xl bg-rose-600 text-white font-black uppercase tracking-wider hover:bg-rose-500 transition-all"
          >
            <Plus className="w-6 h-6" />
            New Video
          </button>
          <button 
            onClick={onOpenProject}
            className="flex-1 flex items-center justify-center gap-3 p-6 rounded-3xl bg-neutral-900 border border-neutral-800 text-white font-black uppercase tracking-wider hover:bg-neutral-800 transition-all"
          >
            <FolderOpen className="w-6 h-6" />
            Open Project
          </button>
        </div>

        <h2 className="text-xs font-black uppercase tracking-widest text-neutral-500 mb-8">What do you want to create?</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <ProjectTypeCard title="Short Video" icon={Film} onClick={() => onNewProject('short')} />
          <ProjectTypeCard title="YouTube" icon={Tv} onClick={() => onNewProject('long')} />
          <ProjectTypeCard title="Talking Head" icon={User} onClick={() => onNewProject('talking')} />
          <ProjectTypeCard title="Podcast" icon={Mic} onClick={() => onNewProject('podcast')} />
          <ProjectTypeCard title="Client" icon={Briefcase} onClick={() => onNewProject('client')} />
          <ProjectTypeCard title="Custom" icon={Settings} onClick={() => onNewProject('custom')} />
        </div>
      </main>
    </div>
  );
};

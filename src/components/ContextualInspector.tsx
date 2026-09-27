import React, { useState } from 'react';
import { 
  Settings, 
  Move, 
  Maximize2, 
  Palette, 
  Volume2, 
  Scissors, 
  Sparkles, 
  Minimize2,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  Zap,
  Info,
  Lock,
  ExternalLink,
  History,
  RotateCcw,
  Type,
  Film,
  Music,
  Layout,
  Clock,
  CheckCircle2,
  Sliders,
  Eye,
  Eraser,
  Wand2,
  Layers,
  Activity,
  Mic,
  Gauge,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SelectionType, VideoProjectSettings } from '../types';
import { ContextualAcademyBar } from './ContextualAcademyBar';

interface InspectorProps {
  selectionType: SelectionType;
  selectedId: string | null;
  data: any;
  settings?: VideoProjectSettings;
  onUpdateSettings?: (partial: Partial<VideoProjectSettings>) => void;
  onAction: (actionId: string, params?: any) => void;
  language: 'sk' | 'en';
  onTriggerMagicEdit?: () => void;
  onOpenQC?: () => void;
  onOpenExport?: () => void;
  onClose?: () => void;
}

const CollapsibleSection: React.FC<{ 
  title: string; 
  children: React.ReactNode; 
  defaultOpen?: boolean;
  icon?: React.ElementType;
}> = ({ title, children, defaultOpen = true, icon: Icon }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-neutral-800/80 last:border-b-0">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-2.5 px-4 flex items-center justify-between hover:bg-neutral-800/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-3.5 h-3.5 text-rose-400" />}
          <span className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider">{title}</span>
        </div>
        {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-neutral-500" /> : <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const ContextualInspector: React.FC<InspectorProps> = React.memo(({ 
  selectionType, 
  selectedId, 
  data, 
  settings,
  onUpdateSettings,
  onAction,
  language,
  onTriggerMagicEdit,
  onOpenQC,
  onOpenExport,
  onClose
}) => {
  const isSk = language === 'sk';
  const [showAdvanced, setShowAdvanced] = useState(false);

  // NO SELECTION: Show Project Info & Quick Start Hub
  if (selectionType === 'NONE' || !selectionType) {
    return (
      <div className="h-full bg-neutral-900/90 flex flex-col justify-between border-l border-neutral-800/80">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <Layout className="w-4 h-4 text-rose-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                {isSk ? "Prehľad Projektu" : "Project Overview"}
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
                {settings?.aspectRatio || "9:16"}
              </span>
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-all cursor-pointer"
                  title={isSk ? "Skryť prehľad projektu" : "Hide Project Overview"}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Primary Actions */}
          <div className="space-y-2">
            <button
              onClick={onTriggerMagicEdit}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-rose-500 to-amber-500 hover:brightness-110 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Wand2 className="w-4 h-4" />
              <span>{isSk ? "⚡ MAKE IT PROFESSIONAL" : "⚡ MAKE IT PROFESSIONAL"}</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onOpenQC}
                className="py-2 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border border-neutral-700"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isSk ? "QC Analýza" : "QC Audit"}</span>
              </button>
              <button
                onClick={onOpenExport}
                className="py-2 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border border-neutral-700"
              >
                <Sliders className="w-3.5 h-3.5 text-rose-400" />
                <span>{isSk ? "Export" : "Export"}</span>
              </button>
            </div>
          </div>

          {/* Master Project Settings */}
          <div className="pt-2 space-y-3">
            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
              {isSk ? "Rýchle Nastavenia" : "Quick Settings"}
            </div>

            {/* Captions Toggle */}
            <label className="flex items-center justify-between p-2 rounded-xl bg-neutral-950/60 border border-neutral-800 text-xs text-neutral-200 cursor-pointer">
              <div className="flex items-center gap-2">
                <Type className="w-3.5 h-3.5 text-indigo-400" />
                <span>{isSk ? "Kinetic Titulky" : "Kinetic Captions"}</span>
              </div>
              <input
                type="checkbox"
                checked={settings?.captionsEnabled ?? true}
                onChange={(e) => onUpdateSettings?.({ captionsEnabled: e.target.checked })}
                className="accent-rose-500 w-4 h-4 rounded cursor-pointer"
              />
            </label>

            {/* Auto Zoom Toggle */}
            <label className="flex items-center justify-between p-2 rounded-xl bg-neutral-950/60 border border-neutral-800 text-xs text-neutral-200 cursor-pointer">
              <div className="flex items-center gap-2">
                <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                <span>{isSk ? "Punch-In Zoom" : "Punch-In Zoom"}</span>
              </div>
              <input
                type="checkbox"
                checked={settings?.autoZoomEnabled ?? true}
                onChange={(e) => onUpdateSettings?.({ autoZoomEnabled: e.target.checked })}
                className="accent-rose-500 w-4 h-4 rounded cursor-pointer"
              />
            </label>

            {/* Voice Clarifier Toggle */}
            <label className="flex items-center justify-between p-2 rounded-xl bg-neutral-950/60 border border-neutral-800 text-xs text-neutral-200 cursor-pointer">
              <div className="flex items-center gap-2">
                <Mic className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isSk ? "Čistenie Hlasu (-14 LUFS)" : "Voice Clarifier (-14 LUFS)"}</span>
              </div>
              <input
                type="checkbox"
                checked={settings?.voiceClarifierEnabled ?? true}
                onChange={(e) => onUpdateSettings?.({ voiceClarifierEnabled: e.target.checked })}
                className="accent-rose-500 w-4 h-4 rounded cursor-pointer"
              />
            </label>

            {/* Auto Ducking Toggle */}
            <label className="flex items-center justify-between p-2 rounded-xl bg-neutral-950/60 border border-neutral-800 text-xs text-neutral-200 cursor-pointer">
              <div className="flex items-center gap-2">
                <Music className="w-3.5 h-3.5 text-rose-400" />
                <span>{isSk ? "Auto-Ducking Hudby (-16dB)" : "Music Ducking (-16dB)"}</span>
              </div>
              <input
                type="checkbox"
                checked={settings?.bgMusicDucking ?? true}
                onChange={(e) => onUpdateSettings?.({ bgMusicDucking: e.target.checked })}
                className="accent-rose-500 w-4 h-4 rounded cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Bottom Hint */}
        <div className="p-4 bg-neutral-950/50 border-t border-neutral-800 text-center">
          <p className="text-[11px] text-neutral-400">
            {isSk
              ? "Kliknite na ľubovoľný klip, titulok alebo B-Roll na časovej osi pre detailnú úpravu."
              : "Click any clip, caption, or B-roll element on the timeline for detailed editing."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-neutral-900 flex flex-col border-l border-neutral-800/80 shadow-2xl">
      {/* Selection Header */}
      <div className="p-3.5 border-b border-neutral-800 bg-neutral-950/40">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${data?.isLocked ? 'bg-amber-500/10' : 'bg-rose-500/10'}`}>
              {data?.isLocked ? <Lock className="w-3.5 h-3.5 text-amber-500" /> : <Settings className="w-3.5 h-3.5 text-rose-500" />}
            </div>
            <h3 className="text-xs font-bold text-white uppercase tracking-tight truncate max-w-[140px]">
              {data?.name || data?.text || selectedId || 'Selected Element'}
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded uppercase">
              {selectionType.replace('_', ' ')}
            </span>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-all cursor-pointer"
                title={isSk ? "Skryť prehľad" : "Hide Inspector"}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* VIDEO CLIP CONTROLS */}
        {selectionType === 'VIDEO_CLIP' && (
          <>
            <CollapsibleSection title={isSk ? "STRIH A KADENCIA" : "TRIM & PACING"} icon={Scissors}>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => onAction('SPLIT_CLIP')}
                  className="py-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 border border-neutral-700"
                >
                  <Scissors className="w-3.5 h-3.5 text-rose-400" />
                  <span>{isSk ? "Rozdeliť" : "Split"}</span>
                </button>
                <button 
                  onClick={() => onAction('SMART_CUT')}
                  className="py-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 border border-neutral-700"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isSk ? "Smart Cut" : "Smart Cut"}</span>
                </button>
              </div>

              <div className="pt-2 border-t border-neutral-800/60">
                <ContextualAcademyBar 
                  topicKey="PAUSE_TRIMMING" 
                  language={language} 
                  contextLabel={data?.name || (isSk ? "tomto klipe" : "this clip")}
                />
              </div>

              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs font-semibold text-neutral-300">
                  <span>{isSk ? "Punch-In Zoom" : "Punch-In Zoom"}</span>
                  <span className="text-rose-400 font-mono">1.25x</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="2" 
                  step="0.05" 
                  defaultValue="1.25" 
                  className="w-full h-1.5 bg-neutral-800 rounded-full appearance-none accent-rose-500 cursor-pointer" 
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection title={isSk ? "ZVUK & ČISTENIE" : "AUDIO & CLEANUP"} icon={Volume2}>
              <div className="space-y-2">
                <button 
                  onClick={() => onAction('CLEAN_AUDIO')}
                  className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 border border-neutral-700"
                >
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isSk ? "Odstrániť Šum & Reverb" : "Remove Noise & Reverb"}</span>
                </button>
                <div className="pt-2">
                  <ContextualAcademyBar 
                    topicKey="AUDIO_DUCKING" 
                    language={language} 
                    contextLabel={data?.name || (isSk ? "tomto audiu" : "this audio")}
                  />
                </div>
              </div>
            </CollapsibleSection>
          </>
        )}

        {/* AUDIO CLIP CONTROLS */}
        {selectionType === 'AUDIO_CLIP' && (
          <CollapsibleSection title={isSk ? "HLASITOSŤ A MASTERING" : "VOLUME & MASTERING"} icon={Volume2}>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-neutral-300">
                  <span>{isSk ? "Úroveň Hlasitosti" : "Volume Level"}</span>
                  <span className="text-rose-400 font-mono">0.0 dB</span>
                </div>
                <input 
                  type="range" 
                  min="-24" 
                  max="6" 
                  step="0.5" 
                  defaultValue="0" 
                  className="w-full h-1.5 bg-neutral-800 rounded-full appearance-none accent-rose-500 cursor-pointer" 
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button 
                  onClick={() => onAction('NORMALIZE_LUFS')}
                  className="py-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-1 border border-neutral-700"
                >
                  <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                  <span>-14 LUFS</span>
                </button>
                <button 
                  onClick={() => onAction('DUCK_MUSIC')}
                  className="py-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-1 border border-neutral-700"
                >
                  <Music className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Ducking</span>
                </button>
              </div>

              <div className="pt-2 border-t border-neutral-800/60">
                <ContextualAcademyBar 
                  topicKey="AUDIO_DUCKING" 
                  language={language} 
                  contextLabel={data?.name || (isSk ? "tejto stope" : "this track")}
                />
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* CAPTION CONTROLS */}
        {selectionType === 'CAPTION' && (
          <CollapsibleSection title={isSk ? "ÚPRAVA TITULKU" : "CAPTION CONTROLS"} icon={Type}>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                  {isSk ? "Text Titulku" : "Subtitle Text"}
                </label>
                <textarea 
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-xs text-white focus:border-rose-500 outline-none transition-all"
                  rows={3}
                  defaultValue={data?.text || ''}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => onAction('HIGHLIGHT_KEYWORD')}
                  className="py-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 border border-neutral-700"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isSk ? "Zvýrazniť" : "Highlight"}</span>
                </button>
                <button 
                  onClick={() => onAction('CHANGE_EMOJI')}
                  className="py-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 border border-neutral-700"
                >
                  <span>🔥 Emoji</span>
                </button>
              </div>

              <div className="pt-2 border-t border-neutral-800/60">
                <ContextualAcademyBar 
                  topicKey="CAPTIONS_EMPHASIS" 
                  language={language} 
                  contextLabel={isSk ? "tomto titulku" : "this caption"}
                />
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* B-ROLL CONTROLS */}
        {selectionType === 'BROLL' && (
          <CollapsibleSection title={isSk ? "B-ROLL OVERLAY" : "B-ROLL OVERLAY"} icon={Film}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => onAction('REPLACE_BROLL')}
                  className="py-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 border border-neutral-700"
                >
                  <History className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{isSk ? "Nahradiť" : "Replace"}</span>
                </button>
                <button 
                  onClick={() => onAction('REMOVE_BROLL')}
                  className="py-2 bg-red-950/40 hover:bg-red-900/50 rounded-xl text-xs font-bold text-red-400 transition-all flex items-center justify-center gap-1.5 border border-red-800/40"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>{isSk ? "Zmazať" : "Delete"}</span>
                </button>
              </div>

              <div className="pt-2 border-t border-neutral-800/60">
                <ContextualAcademyBar 
                  topicKey="BROLL_INSERTION" 
                  language={language} 
                  contextLabel={isSk ? "tomto B-rolle" : "this B-roll"}
                />
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* Progressive Disclosure: Advanced Controls */}
        <div className="p-4 pt-2">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full py-2 text-xs font-bold text-neutral-400 hover:text-neutral-200 transition-colors flex items-center justify-center gap-1.5 bg-neutral-950/60 rounded-xl border border-neutral-800"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{showAdvanced ? (isSk ? "Skryť Pokročilé Nástroje" : "Hide Advanced Tools") : (isSk ? "Pokročilé Profesionálne Nástroje" : "Advanced Professional Tools")}</span>
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-2">
              <button 
                onClick={() => onAction('OPEN_PRO_TOOLBOX')}
                className="w-full py-2.5 px-3 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-xs font-bold text-neutral-200 flex items-center justify-between border border-neutral-700 transition-all"
              >
                <span>{isSk ? "Otvoriť v Pro Toolbox" : "Open in Pro Toolbox"}</span>
                <ExternalLink className="w-3.5 h-3.5 text-rose-400" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});


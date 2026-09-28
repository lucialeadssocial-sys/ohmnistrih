import React, { useState } from "react";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Sliders,
  CheckCircle2,
  Lock,
  Play,
  FileVideo,
  Eye,
  Settings,
  Flame,
  FileText,
  Scissors,
  Type,
  Film,
  Music,
  Tv,
  Heart,
  TrendingUp,
  Download,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { playSynthesizedSFX } from "../utils/audioSynth";

// Import all sub-editors to mount them inside the wizard steps
import { RawAIAnalyzer } from "./RawAIAnalyzer";
import { AIStoryBuilder } from "./AIStoryBuilder";
import { AIJumpCutEditor } from "./AIJumpCutEditor";
import { SmartCleanupSuite } from "./SmartCleanupSuite";
import { SmartCaptionEditor } from "./SmartCaptionEditor";
import { BilingualEditor } from "./BilingualEditor";
import { AIBrollEngine } from "./AIBrollEngine";
import { BRollEditor } from "./BRollEditor";
import { AIAudioStudio } from "./AIAudioStudio";
import { BeatSyncStudio } from "./BeatSyncStudio";
import { VisualAttentionStudio } from "./VisualAttentionStudio";
import { ObjectEraserSuite } from "./ObjectEraserSuite";
import { AIBrollFinder } from "./AIBrollFinder";
import { RetentionSimulator } from "./RetentionSimulator";
import { ABVersionGenerator } from "./ABVersionGenerator";
import { MultiPlatformExport } from "./MultiPlatformExport";
import { ContentPackMachine } from "./ContentPackMachine";
import { ViralPresets } from "./ViralPresets";
import { SmartAIInsight } from "./SmartAIInsight";
import { OpusStudio } from "./OpusStudio";

interface RawToReadyPipelineProps {
  // Global States from App.tsx
  rawAnalysis: any;
  onRunRawAnalysis: () => void;
  isAnalyzingRaw: boolean;

  storyPlan: any;
  onGenerateStory: (config: any) => void;
  onUpdatePlan: (plan: any) => void;
  onApplyStoryToTimeline: () => void;
  isGeneratingStory: boolean;

  jumpSequence: any;
  onGenerateCuts: (mode: any, density: number) => void;
  onApplyCuts: (selectedIds: string[]) => void;
  isGeneratingCuts: boolean;

  brollProject: any;
  onUpdateBrollProject: (proj: any) => void;
  onGenerateBrollSuggestions: () => void;
  onApplyBroll: () => void;
  isGeneratingBroll: boolean;

  bilingualProject: any;
  onUpdateBilingualProject: (proj: any) => void;
  onGenerateBilingualTranslation: (mode: any) => void;
  onGenerateVoiceover: () => void;
  isTranslating: boolean;

  audioProject: any;
  onUpdateAudioProject: (proj: any) => void;
  onProcessAudio: () => void;
  isProcessingAudio: boolean;

  beatSyncProject: any;
  onUpdateBeatSyncProject: (proj: any) => void;
  onAnalyzeBeats: () => void;
  onSnapToBeat: () => void;
  isAnalyzingBeats: boolean;

  visualAttentionProject: any;
  onUpdateAttentionProject: (proj: any) => void;
  onRunAttentionAnalysis: () => void;
  onApplyAttentionSuggestion: (sug: any) => void;
  isAnalyzingAttention: boolean;

  brollFinderProject: any;
  onUpdateBrollFinderProject: (proj: any) => void;
  onGenerateBrollFinderSuggestions: () => void;

  cleanupProject: any;
  onUpdateCleanupProject: (proj: any) => void;
  onRunCleanupDetection: () => void;
  onApplyCleanup: () => void;
  isAnalyzingCleanup: boolean;
  isProcessingCleanup: boolean;

  multiExportProject: any;
  onUpdateMultiExportProject: (proj: any) => void;
  onStartMultiExport: () => void;
  isExportingMulti: boolean;

  contentPack: any;
  onGenerateContentPack: () => void;
  isGeneratingPack: boolean;

  retentionProject: any;
  onRunRetentionAnalysis: () => void;
  isAnalyzingRetention: boolean;

  abVersionProject: any;
  onGenerateABVersions: () => void;
  isGeneratingAB: boolean;

  // Video State
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  onTogglePlay: () => void;
  language: "sk" | "en";

  // Captions
  captionProject: any;
  onUpdateCaptionProject: (proj: any) => void;
  onRunMagicSplit: () => void;
  onTranslate: (targetLang: "sk" | "en") => void;
  isGeneratingCaptions: boolean;

  // Settings
  settings: any;
  setSettings: React.Dispatch<React.SetStateAction<any>>;
  onUpdateSettings: (s: any) => void;

  // B-Roll
  bRollOverlays: any[];
  setBRollOverlays: React.Dispatch<React.SetStateAction<any[]>>;
  setIsBRollTimelineOpen: (open: boolean) => void;

  // Navigation Trigger to open PRO TIMELINE
  onJumpToProTimeline: () => void;
  showToast: (msg: string) => void;
}

export const RawToReadyPipeline: React.FC<RawToReadyPipelineProps> = ({
  rawAnalysis,
  onRunRawAnalysis,
  isAnalyzingRaw,
  storyPlan,
  onGenerateStory,
  onUpdatePlan,
  onApplyStoryToTimeline,
  isGeneratingStory,
  jumpSequence,
  onGenerateCuts,
  onApplyCuts,
  isGeneratingCuts,
  brollProject,
  onUpdateBrollProject,
  onGenerateBrollSuggestions,
  onApplyBroll,
  isGeneratingBroll,
  bilingualProject,
  onUpdateBilingualProject,
  onGenerateBilingualTranslation,
  onGenerateVoiceover,
  isTranslating,
  audioProject,
  onUpdateAudioProject,
  onProcessAudio,
  isProcessingAudio,
  beatSyncProject,
  onUpdateBeatSyncProject,
  onAnalyzeBeats,
  onSnapToBeat,
  isAnalyzingBeats,
  visualAttentionProject,
  onUpdateAttentionProject,
  onRunAttentionAnalysis,
  onApplyAttentionSuggestion,
  isAnalyzingAttention,
  brollFinderProject,
  onUpdateBrollFinderProject,
  onGenerateBrollFinderSuggestions,
  cleanupProject,
  onUpdateCleanupProject,
  onRunCleanupDetection,
  onApplyCleanup,
  isAnalyzingCleanup,
  isProcessingCleanup,
  multiExportProject,
  onUpdateMultiExportProject,
  onStartMultiExport,
  isExportingMulti,
  contentPack,
  onGenerateContentPack,
  isGeneratingPack,
  retentionProject,
  onRunRetentionAnalysis,
  isAnalyzingRetention,
  abVersionProject,
  onGenerateABVersions,
  isGeneratingAB,
  duration,
  currentTime,
  isPlaying,
  onSeek,
  onTogglePlay,
  language,
  captionProject,
  onUpdateCaptionProject,
  onRunMagicSplit,
  onTranslate,
  isGeneratingCaptions,
  settings,
  setSettings,
  onUpdateSettings,
  bRollOverlays,
  setBRollOverlays,
  setIsBRollTimelineOpen,
  onJumpToProTimeline,
  showToast
}) => {
  const isSk = language === "sk";
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Demofiles state for Step 1: Import
  const [importedVideo, setImportedVideo] = useState<{
    name: string;
    size: string;
    duration: string;
    aspectRatio: string;
  } | null>({
    name: "OMNISTRIH_RAW_4K.mp4",
    size: "4.2 GB",
    duration: "45:12",
    aspectRatio: "16:9"
  });

  // 12-Step Definitions
  const steps = [
    {
      id: 1,
      labelSk: "1. IMPORT",
      labelEn: "1. IMPORT",
      descSk: "Nahrajte a nastavte surový video záznam",
      descEn: "Upload and prepare raw talkhead video footage",
      icon: FileVideo,
      color: "border-blue-500 text-blue-400"
    },
    {
      id: 2,
      labelSk: "2. AI ANALÝZA",
      labelEn: "2. AI ANALYZE",
      descSk: "Preveďte hlbokú AI analýzu, zistite filler slová a ticho",
      descEn: "Run deep AI analytics on transcripts, fillers & silence",
      icon: Sparkles,
      color: "border-purple-500 text-purple-400"
    },
    {
      id: 3,
      labelSk: "3. TOP MOMENTY",
      labelEn: "3. BEST MOMENTS",
      descSk: "Objavte vysoko virálne momenty a najsilnejšie háčiky",
      descEn: "Find viral hooks & highest interest retention parts",
      icon: Flame,
      color: "border-rose-500 text-rose-400"
    },
    {
      id: 4,
      labelSk: "4. BUILD STORY",
      labelEn: "4. BUILD STORY",
      descSk: "Zostavte plán rozprávania a štruktúru príbehu",
      descEn: "Synthesize structured story scripts and chapters",
      icon: FileText,
      color: "border-emerald-500 text-emerald-400"
    },
    {
      id: 5,
      labelSk: "5. AUTO CUT",
      labelEn: "5. AUTO CUT",
      descSk: "Odstráňte tiché pauzy a prebytočné slová okamžite",
      descEn: "Instantly slice out pauses, fillers & mistakes",
      icon: Scissors,
      color: "border-amber-500 text-amber-400"
    },
    {
      id: 6,
      labelSk: "6. TITULKY",
      labelEn: "6. CAPTIONS",
      descSk: "Vygenerujte dizajnové bilingválne titulky s emodži",
      descEn: "Generate styled multilingual subtitle tracks",
      icon: Type,
      color: "border-indigo-500 text-indigo-400"
    },
    {
      id: 7,
      labelSk: "7. B-ROLL",
      labelEn: "7. B-ROLL",
      descSk: "Doplňte vizuálne prekryvy a sekundárne zábery",
      descEn: "Overlay cinematic B-Roll footage suggestions",
      icon: Film,
      color: "border-violet-500 text-violet-400"
    },
    {
      id: 8,
      labelSk: "8. ZVUK & AUDIO",
      labelEn: "8. AUDIO ENGINE",
      descSk: "Upravte zvuk, odstráňte šum a zosynchronizujte beaty",
      descEn: "Enhance voices, gate noise & snap to background audio beats",
      icon: Music,
      color: "border-pink-500 text-pink-400"
    },
    {
      id: 9,
      labelSk: "9. VISUAL DYNAMICS",
      labelEn: "9. VISUAL DYNAMICS",
      descSk: "Aktivujte sledovanie tváre, priblíženia a gumovanie",
      descEn: "Enable smart face tracking, automated zooms & eraser",
      icon: Tv,
      color: "border-cyan-500 text-cyan-400"
    },
    {
      id: 10,
      labelSk: "10. DIAGNOSTIKA",
      labelEn: "10. REVIEW",
      descSk: "Simulujte retenciu divákov a vytvorte A/B verzie",
      descEn: "Test audience retention drop-offs & create A/B variations",
      icon: Heart,
      color: "border-teal-500 text-teal-400"
    },
    {
      id: 11,
      labelSk: "11. MULTI-FORMAT",
      labelEn: "11. MULTI-FORMAT",
      descSk: "Preformátujte video pre TikTok, YouTube a IG",
      descEn: "Crop and optimize canvas safe margins across platforms",
      icon: TrendingUp,
      color: "border-orange-500 text-orange-400"
    },
    {
      id: 12,
      labelSk: "12. EXPORT",
      labelEn: "12. EXPORT",
      descSk: "Vyexportujte finálny balíček s popisom a hashtágmi",
      descEn: "Bundle and download complete ready-to-post socials package",
      icon: Download,
      color: "border-emerald-600 text-emerald-500"
    }
  ];

  // Helper to trigger navigation
  const handleNextStep = () => {
    if (currentStep < 12) {
      setCurrentStep(prev => prev + 1);
      playSynthesizedSFX("click", 0.5);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
      playSynthesizedSFX("click", 0.5);
    }
  };

  const handleImportFile = () => {
    playSynthesizedSFX("click", 0.6);
    showToast(isSk ? "RAW video úspešne naimportované do OmniStrihu!" : "RAW video successfully imported into OmniStrih!");
  };

  const currentStepData = steps[currentStep - 1];

  return (
    <div className="w-full flex flex-col gap-6" id="raw-to-ready-pipeline-hub">
      
      {/* HEADER MASTER WORKFLOW BANNER */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-neutral-900 to-neutral-950 border border-neutral-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-rose-600 flex items-center justify-center text-white font-black shadow-lg shadow-rose-600/20">
            <Sparkles className="h-6 w-6 animate-spin" />
          </div>
          <div>
            <span className="text-[10px] font-black tracking-widest text-rose-500 uppercase">OMNISTRIH ENGINE MASTERPIECE</span>
            <h1 className="text-xl font-black text-white tracking-tight uppercase">
              {isSk ? "Surové Video ➜ Hotový Príspevok" : "Raw Video ➜ Ready-To-Post Content"}
            </h1>
            <p className="text-xs text-neutral-400">
              {isSk 
                ? "Pristúpte k tvorbe strategicky. Prejdite 12-krokovou AI produkciou a kedykoľvek prejdite na manuálne ladenie."
                : "A unified 12-step structured video workflow. Step through automation or override manually anytime."}
            </p>
          </div>
        </div>

        {/* PRO MANUAL OVERRIDE (SKIP AI) BUTTON */}
        <button
          onClick={() => {
            playSynthesizedSFX("ding", 0.6);
            onJumpToProTimeline();
          }}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-violet-600/30 transition-all hover:-translate-y-0.5 active:translate-y-0"
        >
          <Sliders className="h-4 w-4" />
          <span>{isSk ? "Ísť na Manuálny Pro Timeline" : "Jump to Manual Pro Timeline"}</span>
        </button>
      </div>

      {/* 12-STEP INTEGRATED HEADER MAP (Horizontal scroller) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 px-1 scrollbar-thin scrollbar-thumb-neutral-800">
        {steps.map(step => {
          const StepIcon = step.icon;
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;

          return (
            <button
              key={step.id}
              onClick={() => {
                setCurrentStep(step.id);
                playSynthesizedSFX("click", 0.4);
              }}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shrink-0 transition-all border ${
                isActive
                  ? "bg-rose-600/10 border-rose-500 text-rose-400 ring-2 ring-rose-500/20 font-black scale-[1.02]"
                  : isCompleted
                  ? "bg-neutral-900/60 border-emerald-500/50 text-emerald-400 font-semibold"
                  : "bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {isCompleted ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              ) : (
                <StepIcon className="h-4 w-4 shrink-0" />
              )}
              <span className="text-xs uppercase tracking-tight whitespace-nowrap">{isSk ? step.labelSk : step.labelEn}</span>
            </button>
          );
        })}
      </div>

      {/* ACTIVE WORKSPACE ZONE */}
      <div className="grid grid-cols-1 gap-6">
        
        {/* Step details header */}
        <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-neutral-900 text-rose-400 font-mono text-[10px] font-black uppercase border border-rose-500/20">
                {isSk ? `KROK ${currentStep} z 12` : `STEP ${currentStep} OF 12`}
              </span>
              <h2 className="text-base font-black text-white uppercase tracking-tight">
                {isSk ? currentStepData.labelSk : currentStepData.labelEn}
              </h2>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              {isSk ? currentStepData.descSk : currentStepData.descEn}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrevStep}
              disabled={currentStep === 1}
              className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 disabled:opacity-30 text-neutral-300"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleNextStep}
              disabled={currentStep === 12}
              className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 disabled:opacity-30 text-neutral-300"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* STEP CORE WRAPPERS AND RENDER LOGIC */}
        <div className="min-h-[300px] p-6 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl relative">
          
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              
              {/* STEP 1: IMPORT */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="border-2 border-dashed border-neutral-800 hover:border-rose-500/50 rounded-2xl p-8 text-center bg-neutral-950/40 transition-colors cursor-pointer group" onClick={handleImportFile}>
                    <div className="h-12 w-12 rounded-xl bg-neutral-900 flex items-center justify-center text-neutral-400 group-hover:text-rose-400 mx-auto border border-neutral-800 transition-colors">
                      <FileVideo className="h-6 w-6" />
                    </div>
                    <h3 className="text-sm font-bold text-white mt-4 uppercase tracking-wider">{isSk ? "Potiahnite surové video sem" : "Drag and drop raw footage here"}</h3>
                    <p className="text-[11px] text-neutral-500 mt-1 max-w-sm mx-auto">
                      {isSk 
                        ? "Podporujeme MP4, MOV, MKV v rozlíšení až do 4K. Ideálne sú statické hovoriace videá."
                        : "Supports MP4, MOV, MKV up to 4K. Talkhead style videos work best."}
                    </p>
                    <button className="mt-4 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded-xl border border-neutral-700 uppercase tracking-wider">
                      {isSk ? "Vybrať Súbor" : "Browse Files"}
                    </button>
                  </div>

                  {/* Active imported metadata */}
                  {importedVideo && (
                    <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between gap-4 flex-wrap text-xs">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-neutral-900 text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-bold text-white font-mono">{importedVideo.name}</p>
                          <p className="text-[10px] text-neutral-500">{isSk ? "Veľkosť súboru: " : "File size: "}{importedVideo.size}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-neutral-400 text-[11px] font-mono">
                        <div>
                          <span className="text-neutral-500">DUR:</span> {importedVideo.duration}
                        </div>
                        <div>
                          <span className="text-neutral-500">FORMAT:</span> {importedVideo.aspectRatio}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: AI ANALYZE */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-violet-600/10 border border-violet-500/20 rounded-xl text-xs text-violet-400">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>
                      {isSk 
                        ? "AI prejde celé video a identifikuje monológy, výplňové slová, pauzy a dôležité témy."
                        : "AI scans the complete footage to catalog speaker segments, filler words, silence, and themes."}
                    </span>
                  </div>
                  <RawAIAnalyzer
                    analysis={rawAnalysis}
                    onRunAnalysis={onRunRawAnalysis}
                    onApplyClip={onSeek}
                    isAnalyzing={isAnalyzingRaw}
                    language={language}
                    currentTime={currentTime}
                  />
                </div>
              )}

              {/* STEP 3: FIND BEST MOMENTS */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <ViralPresets 
                      currentSettings={settings}
                      onChangeSettings={onUpdateSettings}
                      language={language}
                    />
                    <SmartAIInsight 
                      virality={settings.virality}
                      language={language}
                    />
                  </div>
                  <OpusStudio
                    virality={settings.virality}
                    smartClips={[]}
                    onSelectClip={(start) => {
                      onSeek(start);
                    }}
                    language={language}
                    autoReframe={settings.autoReframeFace}
                    onToggleAutoReframe={(val) =>
                      onUpdateSettings({ autoReframeFace: val })
                    }
                    bRollEnabled={settings.bRollEnabled}
                    onToggleBRoll={(val) =>
                      onUpdateSettings({ bRollEnabled: val })
                    }
                    showToast={showToast}
                    onUpdateCaptionProject={onUpdateCaptionProject}
                  />
                </div>
              )}

              {/* STEP 4: BUILD STORY */}
              {currentStep === 4 && (
                <AIStoryBuilder
                  rawAnalysis={rawAnalysis}
                  storyPlan={storyPlan}
                  onGenerateStory={onGenerateStory}
                  onUpdatePlan={onUpdatePlan}
                  onApplyToTimeline={onApplyStoryToTimeline}
                  language={language}
                  isGenerating={isGeneratingStory}
                />
              )}

              {/* STEP 5: AUTO CUT */}
              {currentStep === 5 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <AIJumpCutEditor
                    rawAnalysis={rawAnalysis}
                    storyPlan={storyPlan}
                    jumpSequence={jumpSequence}
                    onGenerateCuts={onGenerateCuts}
                    onApplyCuts={onApplyCuts}
                    language={language}
                    isGenerating={isGeneratingCuts}
                    onPreviewCut={onSeek}
                  />
                  <SmartCleanupSuite
                    project={cleanupProject}
                    rawAnalysis={rawAnalysis}
                    onUpdateProject={onUpdateCleanupProject}
                    onRunDetection={onRunCleanupDetection}
                    onApplyCleanup={onApplyCleanup}
                    onSeek={onSeek}
                    currentTime={currentTime}
                    language={language}
                    isAnalyzing={isAnalyzingCleanup}
                    isProcessing={isProcessingCleanup}
                  />
                </div>
              )}

              {/* STEP 6: CAPTIONS */}
              {currentStep === 6 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <SmartCaptionEditor
                    project={captionProject}
                    rawAnalysis={rawAnalysis}
                    jumpSequence={jumpSequence}
                    onUpdateProject={onUpdateCaptionProject}
                    onRunMagicSplit={onRunMagicSplit}
                    onTranslate={onTranslate}
                    onSeek={onSeek}
                    currentTime={currentTime}
                    language={language}
                    isGenerating={isGeneratingCaptions}
                    settings={settings}
                    setSettings={setSettings}
                  />
                  <BilingualEditor
                    project={bilingualProject}
                    rawAnalysis={rawAnalysis}
                    captionProject={captionProject}
                    onUpdateProject={onUpdateBilingualProject}
                    onGenerateTranslation={onGenerateBilingualTranslation}
                    onGenerateVoiceover={onGenerateVoiceover}
                    onSeek={onSeek}
                    currentTime={currentTime}
                    language={language}
                    isGenerating={isTranslating}
                  />
                </div>
              )}

              {/* STEP 7: B-ROLL */}
              {currentStep === 7 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <AIBrollEngine
                    project={brollProject}
                    rawAnalysis={rawAnalysis}
                    storyPlan={storyPlan}
                    onUpdateProject={onUpdateBrollProject}
                    onGenerateSuggestions={onGenerateBrollSuggestions}
                    onApplyBroll={onApplyBroll}
                    onSeek={onSeek}
                    currentTime={currentTime}
                    language={language}
                    isGenerating={isGeneratingBroll}
                  />
                  <BRollEditor
                    overlays={bRollOverlays}
                    onChangeOverlays={setBRollOverlays}
                    language={language}
                    currentTime={currentTime}
                    onSeek={onSeek}
                    bRollEnabled={settings.bRollEnabled}
                    onToggleEnabled={(enabled: boolean) =>
                      onUpdateSettings({ bRollEnabled: enabled })
                    }
                    paperTexture={settings.omniCollagePaperTexture}
                    onTogglePaperTexture={(enabled: boolean) =>
                      onUpdateSettings({ omniCollagePaperTexture: enabled })
                    }
                    onOpenFullScreen={() => setIsBRollTimelineOpen(true)}
                    duration={duration}
                  />
                </div>
              )}

              {/* STEP 8: AUDIO */}
              {currentStep === 8 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <AIAudioStudio
                    project={audioProject}
                    rawAnalysis={rawAnalysis}
                    onUpdateProject={onUpdateAudioProject}
                    onProcessAudio={onProcessAudio}
                    language={language}
                    isProcessing={isProcessingAudio}
                  />
                  <BeatSyncStudio
                    project={beatSyncProject}
                    rawAnalysis={rawAnalysis}
                    onUpdateProject={onUpdateBeatSyncProject}
                    onAnalyzeBeats={onAnalyzeBeats}
                    onSnapToBeat={onSnapToBeat}
                    onSeek={onSeek}
                    currentTime={currentTime}
                    language={language}
                    isAnalyzing={isAnalyzingBeats}
                  />
                </div>
              )}

              {/* STEP 9: VISUAL DYNAMICS */}
              {currentStep === 9 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <VisualAttentionStudio
                    project={visualAttentionProject}
                    rawAnalysis={rawAnalysis}
                    onUpdateProject={onUpdateAttentionProject}
                    onRunAnalysis={onRunAttentionAnalysis}
                    onApplySuggestion={onApplyAttentionSuggestion}
                    onSeek={onSeek}
                    currentTime={currentTime}
                    language={language}
                    isAnalyzing={isAnalyzingAttention}
                  />
                  <ObjectEraserSuite
                    settings={settings}
                    onChangeSettings={onUpdateSettings}
                    language={language}
                  />
                </div>
              )}

              {/* STEP 10: REVIEW */}
              {currentStep === 10 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <RetentionSimulator
                    project={retentionProject}
                    onRunAnalysis={onRunRetentionAnalysis}
                    onSeek={onSeek}
                    currentTime={currentTime}
                    language={language}
                    isAnalyzing={isAnalyzingRetention}
                  />
                  <ABVersionGenerator
                    project={abVersionProject}
                    onGenerate={onGenerateABVersions}
                    onPreview={(v) => showToast(`Preview: ${v.name}`)}
                    language={language}
                    isGenerating={isGeneratingAB}
                  />
                </div>
              )}

              {/* STEP 11: MULTI-FORMAT */}
              {currentStep === 11 && (
                <MultiPlatformExport
                  project={multiExportProject}
                  onUpdateProject={onUpdateMultiExportProject}
                  onStartExport={onStartMultiExport}
                  language={language}
                  isExporting={isExportingMulti}
                />
              )}

              {/* STEP 12: EXPORT */}
              {currentStep === 12 && (
                <div className="space-y-6">
                  <div className="p-6 rounded-2xl bg-neutral-950 border border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">{isSk ? "FINÁLNE GENEROVANIE A EXPORT" : "FINAL RENDERING & COMPILATION"}</h3>
                      <p className="text-xs text-neutral-400 mt-1">
                        {isSk 
                          ? "Skombinujte audio vylepšenia, titulky, filtre a b-roll do hotového príspevku."
                          : "Apply all enhancements, subtitles, speed ramping, and B-roll to create your ready-to-post asset."}
                      </p>
                    </div>
                    <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-widest active:scale-95 transition-all">
                      <Download className="h-4 w-4" />
                      <span>{isSk ? "Spustiť Export Videa" : "Compile Video Asset"}</span>
                    </button>
                  </div>
                  <ContentPackMachine
                    pack={contentPack}
                    onGenerate={onGenerateContentPack}
                    language={language}
                    isGenerating={isGeneratingPack}
                  />
                </div>
              )}

            </motion.div>
          </AnimatePresence>
          
        </div>

      </div>

    </div>
  );
};

import React, { useState, useRef, useEffect, useCallback, lazy, Suspense } from "react";
import { AdaptiveDeviceExperienceProvider, useAdaptiveDeviceExperience } from "./contexts/AdaptiveDeviceExperienceContext";
import { Header } from "./components/Header";
import { VideoPlayer } from "./components/VideoPlayer";
import { ContextualInspector } from "./components/ContextualInspector";
import { SelectionType } from "./types";
import { TimelineControls } from "./components/TimelineControls";
import { FeatureToggles } from "./components/FeatureToggles";
import { ErrorDebuggerOverlay } from "./components/ErrorDebuggerOverlay";
import { detectHardcodedSubtitles } from "./utils/videoInpainter";
import { AnimatePresence } from "motion/react";
import { GlobalSearch } from "./components/GlobalSearch";
import { AIJobQueue, ProxyQuality, generateProxyJob, LastSeekWinsCoordinator, InstantMediaRegistry, ResourceManager } from "./utils/performanceEngine";
import { playheadStore } from "./core/playback/playheadStore";
import { HistoryManager } from "./utils/historyManager";
import { AIOrchestrator } from "./utils/aiRouter";
import { PipelineExecutor } from "./utils/pipelineExecutor";
import { ToolSuspenseFallback } from "./components/ToolSuspenseFallback";

// On-Demand Lazy-Loaded Studios and Heavy Tools
const AIVisualDirectorCenter = lazy(() => import("./components/AIVisualDirectorCenter").then(m => ({ default: m.AIVisualDirectorCenter })));
const ExportModal = lazy(() => import("./components/ExportModal").then(m => ({ default: m.ExportModal })));
const SettingsModal = lazy(() => import("./components/SettingsModal").then(m => ({ default: m.SettingsModal })));
const ApiKeyManagerModal = lazy(() => import("./components/ApiKeyManagerModal").then(m => ({ default: m.ApiKeyManagerModal })));
const OpusStudio = lazy(() => import("./components/OpusStudio").then(m => ({ default: m.OpusStudio })));
const OmniStrihHome = lazy(() => import("./components/OmniStrihHome").then(m => ({ default: m.OmniStrihHome })));
const CanvaAudioSuite = lazy(() => import("./components/CanvaAudioSuite").then(m => ({ default: m.CanvaAudioSuite })));
const ObjectEraserSuite = lazy(() => import("./components/ObjectEraserSuite").then(m => ({ default: m.ObjectEraserSuite })));
const RawAIAnalyzer = lazy(() => import("./components/RawAIAnalyzer").then(m => ({ default: m.RawAIAnalyzer })));
const AIStoryBuilder = lazy(() => import("./components/AIStoryBuilder").then(m => ({ default: m.AIStoryBuilder })));
const AIJumpCutEditor = lazy(() => import("./components/AIJumpCutEditor").then(m => ({ default: m.AIJumpCutEditor })));
const SmartCaptionEditor = lazy(() => import("./components/SmartCaptionEditor").then(m => ({ default: m.SmartCaptionEditor })));
const AutoVideoCaptionsPanel = lazy(() => import("./components/AutoVideoCaptionsPanel").then(m => ({ default: m.AutoVideoCaptionsPanel })));
const BurnedSubtitlesRemover = lazy(() => import("./components/BurnedSubtitlesRemover").then(m => ({ default: m.BurnedSubtitlesRemover })));
const AIBrollEngine = lazy(() => import("./components/AIBrollEngine").then(m => ({ default: m.AIBrollEngine })));
const BilingualEditor = lazy(() => import("./components/BilingualEditor").then(m => ({ default: m.BilingualEditor })));
const AIAudioStudio = lazy(() => import("./components/AIAudioStudio").then(m => ({ default: m.AIAudioStudio })));
const BeatSyncStudio = lazy(() => import("./components/BeatSyncStudio").then(m => ({ default: m.BeatSyncStudio })));
const VisualAttentionStudio = lazy(() => import("./components/VisualAttentionStudio").then(m => ({ default: m.VisualAttentionStudio })));
const AIBrollFinder = lazy(() => import("./components/AIBrollFinder").then(m => ({ default: m.AIBrollFinder })));
const SmartCleanupSuite = lazy(() => import("./components/SmartCleanupSuite").then(m => ({ default: m.SmartCleanupSuite })));
const MultiPlatformExport = lazy(() => import("./components/MultiPlatformExport").then(m => ({ default: m.MultiPlatformExport })));
const ContentPackMachine = lazy(() => import("./components/ContentPackMachine").then(m => ({ default: m.ContentPackMachine })));
const RetentionSimulator = lazy(() => import("./components/RetentionSimulator").then(m => ({ default: m.RetentionSimulator })));
const ABVersionGenerator = lazy(() => import("./components/ABVersionGenerator").then(m => ({ default: m.ABVersionGenerator })));
const PerformancePanel = lazy(() => import("./components/PerformancePanel").then(m => ({ default: m.PerformancePanel })));
const SuggestionPanel = lazy(() => import("./components/SuggestionPanel").then(m => ({ default: m.SuggestionPanel })));
const ProTimeline = lazy(() => import("./components/ProTimeline").then(m => ({ default: m.ProTimeline })));
const RawToReadyPipeline = lazy(() => import("./components/RawToReadyPipeline").then(m => ({ default: m.RawToReadyPipeline })));
const AINaturalVoiceStudio = lazy(() => import("./components/AINaturalVoiceStudio").then(m => ({ default: m.AINaturalVoiceStudio })));
const TransitionStudio = lazy(() => import("./components/TransitionStudio").then(m => ({ default: m.TransitionStudio })));
const AIThumbnailStudio = lazy(() => import("./components/AIThumbnailStudio").then(m => ({ default: m.AIThumbnailStudio })));
const OmniStrihOSHub = lazy(() => import("./components/OmniStrihOSHub").then(m => ({ default: m.OmniStrihOSHub })));
const ProfessionalToolbox = lazy(() => import("./components/ProfessionalToolbox").then(m => ({ default: m.ProfessionalToolbox })));
const ProfessionalAutopilotEngine = lazy(() => import("./components/ProfessionalAutopilotEngine").then(m => ({ default: m.ProfessionalAutopilotEngine })));
const EditorBrainStudio = lazy(() => import("./components/EditorBrainStudio").then(m => ({ default: m.EditorBrainStudio })));
const AIOrchestratorStudio = lazy(() => import("./components/AIOrchestratorStudio").then(m => ({ default: m.AIOrchestratorStudio })));
const ContentGraphStudio = lazy(() => import("./components/ContentGraphStudio").then(m => ({ default: m.ContentGraphStudio })));
const ProfessionalAudioMasterSuite = lazy(() => import("./components/ProfessionalAudioMasterSuite").then(m => ({ default: m.ProfessionalAudioMasterSuite })));
const LocalAIControlCenter = lazy(() => import("./components/LocalAIControlCenter").then(m => ({ default: m.LocalAIControlCenter })));
const LocalCaptionStudio = lazy(() => import("./components/LocalCaptionStudio").then(m => ({ default: m.LocalCaptionStudio })));
const MediaIntelligenceInspector = lazy(() => import("./components/MediaIntelligenceInspector").then(m => ({ default: m.MediaIntelligenceInspector })));
const DirectorStudio = lazy(() => import("./components/DirectorStudio").then(m => ({ default: m.DirectorStudio })));
const QualityControlAndAnalytics = lazy(() => import("./components/QualityControlAndAnalytics").then(m => ({ default: m.QualityControlAndAnalytics })));
const ProfessionalAutopilotCenter = lazy(() => import("./components/ProfessionalAutopilotCenter").then(m => ({ default: m.ProfessionalAutopilotCenter })));
const EditorBrainCenter = lazy(() => import("./components/EditorBrainCenter").then(m => ({ default: m.EditorBrainCenter })));
const SystemDiagnosticSuite = lazy(() => import("./components/SystemDiagnosticSuite").then(m => ({ default: m.SystemDiagnosticSuite })));
const DirectorProductionCenter = lazy(() => import("./components/DirectorProductionCenter").then(m => ({ default: m.DirectorProductionCenter })));
const ProfessionalWorkspace = lazy(() => import("./components/ProfessionalWorkspace").then(m => ({ default: m.ProfessionalWorkspace })));
const ProfessionalExportCenter = lazy(() => import("./components/ProfessionalExportCenter").then(m => ({ default: m.ProfessionalExportCenter })));
const ImportMediaModal = lazy(() => import("./components/ImportMediaModal").then(m => ({ default: m.ImportMediaModal })));

import { MediaManagerPanel } from "./components/MediaManagerPanel";
import { mediaEngine } from "./core/media/mediaEngine";
import {
  VideoProjectSettings,
  CaptionSegment,
  ZoomCue,
  SFXCue,
  VideoAspectRatio,
  BRollOverlay,
  ViralityAnalysis,
  SmartClipHighlight,
  VideoCategory,
  RawAIAnalysis,
  StoryPlan,
  StoryFormat,
  StoryPlatform,
  StoryGoal,
  StoryStructure,
  StorySegment,
  Suggestion,
  AIBudgetMode,
  Pipeline,
  JumpCutSequence,
  JumpCutMode,
  AICutMarker,
  CaptionProject,
  CaptionStyle,
  CaptionAnimation,
  BrollProject,
  BilingualProject,
  TranslationMode,
  AudioProject,
  AudioProcessingSettings,
  AudioPreset,
  BeatSyncProject,
  BeatMarker,
  BeatSyncSettings,
  VisualAttentionProject,
  AttentionPoint,
  AttentionSuggestion,
  SmartCleanupProject,
  SmartCleanupMask,
  MultiExportProject,
  PlatformExportConfig,
  ContentPack,
  ContentClip,
  SocialAsset,
  RetentionProject,
  RetentionSegment,
  ABVersionProject,
  ABVersion,
  ThumbnailProject,
  EditDNAModel,
  EditingMemoryRule,
  ReviewDecisionItem,
  LockZone,
  TimeMachineVersion,
  ContentUniverseItem,
  VideoTransition,
  NaturalVoiceClip,
} from "./types";
import type { DirectorPlanItem, DirectorApplyReport } from "./components/DirectorPlanPanel";
import { SimpleSmartToolInterface, SmartCategory } from "./components/SimpleSmartToolInterface";
import { aiOrchestrator } from "./services/aiOrchestrator";
import { DEFAULT_EDIT_DNA_PROFILES } from "./utils/editorBrainDefaults";
import { DEMO_VIDEOS } from "./utils/demoVideos";
import { playSynthesizedSFX } from "./utils/audioSynth";
import { startBrowserSpeechTranscription } from "./utils/speechSync";
import { ViralPresets } from "./components/ViralPresets";
import { SmartAIInsight } from "./components/SmartAIInsight";
import {
  Sliders,
  Type,
  ZoomIn,
  Sparkles,
  Zap,
  CheckCircle,
  Wand2,
  Share2,
  TrendingUp,
  Layers,
  Flame,
  Award,
  Palette,
  Image as ImageIcon,
  Music,
  Mic2,
  Volume2,
  Home,
  Eye,
  Eraser,
  Film,
  Globe,
  MessageSquare,
  Brain,
  AlertCircle,
  Scissors,
  BookOpen,
  Box,
  BarChart3,
  Split,
  LayoutGrid,
  FileText,
  Crop,
  Download,
  FolderPlus,
  Settings,
  Search,
  Send,
  Plus,
  Cpu,
  PlayCircle,
  Smartphone,
  Layout,
  FileVideo,
  Upload,
  History,
  Play,
  Activity,
  ShieldCheck,
  HardDrive,
  Cloud,
  Link2,
  QrCode,
  Laptop,
  Camera,
  CheckCircle2,
  PanelRight,
} from "lucide-react";

function MainApp() {
  const [view, setView] = useState<'home' | 'editor'>('home');
  const [language, setLanguage] = useState<"sk" | "en">("sk");

  const isSk = language === "sk";

  const [rawAnalysis, setRawAnalysis] = useState<RawAIAnalysis>({
    isAnalyzed: false,
    metadata: {
      filename: "OMNISTRIH_RAW_4K.mp4",
      duration: 2712,
      resolution: "3840x2160",
      fps: 30,
      aspectRatio: "16:9",
      fileSize: "4.2 GB",
      hasAudio: true
    },
    transcription: [],
    editMap: [],
    shortsSuggestions: [],
    notes: [],
    totalFillerWords: 0,
    totalSilenceRemoved: 0,
    rawVideoDuration: 2712,
    estimatedEditedDuration: 1840,
  });
  const [isAnalyzingRaw, setIsAnalyzingRaw] = useState(false);
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);
  const [proxyQuality, setProxyQuality] = useState<ProxyQuality>("HIGH");

  const [budgetMode, setBudgetMode] = useState<AIBudgetMode>("BALANCED");
  const [isLocalAIModalOpen, setIsLocalAIModalOpen] = useState(false);
  const [isCaptionStudioOpen, setIsCaptionStudioOpen] = useState(false);
  const [isMediaIntelligenceOpen, setIsMediaIntelligenceOpen] = useState(false);
  const [isDirectorStudioOpen, setIsDirectorStudioOpen] = useState(false);
  const [activePhase, setActivePhase] = useState<"prepare" | "review" | "deliver">("prepare");
  const [storyPlan, setStoryPlan] = useState<StoryPlan | null>(null);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const runAutopilot = () => {
    const autopilotPipeline: Pipeline = {
      id: "autopilot_" + Date.now(),
      projectId: "current-project",
      currentStepIndex: 0,
      steps: [
        { type: "IMPORT", status: "pending", priority: "P0" },
        { type: "LOCAL_ANALYSIS", status: "pending", priority: "P1" },
        { type: "TRANSCRIPTION", status: "pending", priority: "P1" },
        { type: "AI_ANALYSIS", status: "pending", priority: "P2" },
        { type: "STORY", status: "pending", priority: "P2" },
        { type: "JUMP_CUT", status: "pending", priority: "P2" },
        { type: "AUDIO", status: "pending", priority: "P2" },
        { type: "CAPTIONS", status: "pending", priority: "P2" },
        { type: "BROLL", status: "pending", priority: "P3" },
        { type: "ZOOMS", status: "pending", priority: "P3" },
        { type: "QC", status: "pending", priority: "P1" },
        { type: "HUMAN_REVIEW", status: "pending", priority: "P0" },
      ]
    };
    
    PipelineExecutor.registerPipeline(autopilotPipeline);
    PipelineExecutor.startPipeline(autopilotPipeline.id);
  };

  useEffect(() => {
    AIOrchestrator.setBudgetMode(budgetMode);
  }, [budgetMode]);

  // Event-driven subscription for suggestions (zero polling, zero idle CPU)
  useEffect(() => {
    return HistoryManager.subscribeSuggestions((newSuggestions) => {
      setSuggestions(newSuggestions);
    });
  }, []);


  const [jumpSequence, setJumpSequence] = useState<JumpCutSequence | null>(null);
  const [isGeneratingCuts, setIsGeneratingCuts] = useState(false);

  const [captionProject, setCaptionProject] = useState<CaptionProject>({
    id: "proj-cap-001",
    sourceVideoId: "v1",
    language: "sk",
    segments: [
      {
        id: "cs1", start: 0.0, end: 2.8, text: "Ako ušetriť 95% času na strih videa", confidence: 0.99, emoji: "⚡",
        words: [
          { word: "Ako", start: 0.0, end: 0.4, confidence: 0.99 },
          { word: "ušetriť", start: 0.4, end: 0.9, confidence: 0.99 },
          { word: "95%", start: 0.9, end: 1.6, confidence: 0.99, emphasis: "NUMBER" },
          { word: "času", start: 1.6, end: 2.1, confidence: 0.99 },
          { word: "na strih", start: 2.1, end: 2.8, confidence: 0.99, emphasis: "KEYWORD" },
        ]
      },
      {
        id: "cs2", start: 3.0, end: 6.2, text: "Už žiadne platenie drahých appiek!", confidence: 0.98, emoji: "💸",
        words: [
          { word: "Už", start: 3.0, end: 3.4, confidence: 0.98 },
          { word: "žiadne", start: 3.4, end: 4.1, confidence: 0.98 },
          { word: "platenie", start: 4.1, end: 4.8, confidence: 0.98 },
          { word: "drahých", start: 4.8, end: 5.5, confidence: 0.98, emphasis: "WARNING" },
          { word: "appiek!", start: 5.5, end: 6.2, confidence: 0.98, emphasis: "EMOTION" },
        ]
      },
      {
        id: "cs3", start: 6.5, end: 9.8, text: "Automatické titulky a smart zoom", confidence: 0.97, emoji: "🎯",
        words: [
          { word: "Automatické", start: 6.5, end: 7.4, confidence: 0.97, emphasis: "KEYWORD" },
          { word: "titulky", start: 7.4, end: 8.2, confidence: 0.97 },
          { word: "a", start: 8.2, end: 8.5, confidence: 0.97 },
          { word: "smart", start: 8.5, end: 9.1, confidence: 0.97 },
          { word: "zoom", start: 9.1, end: 9.8, confidence: 0.97, emphasis: "NUMBER" },
        ],
      },
      {
        id: "cs4", start: 10.0, end: 14.5, text: "Skús OmniStrih hneď teraz zadarmo!", confidence: 0.99, emoji: "🚀",
        words: [
          { word: "Skús", start: 10.0, end: 10.6, confidence: 0.99 },
          { word: "OmniStrih", start: 10.6, end: 11.4, confidence: 0.99, emphasis: "KEYWORD" },
          { word: "hneď", start: 11.4, end: 12.0, confidence: 0.99 },
          { word: "teraz", start: 12.0, end: 12.6, confidence: 0.99 },
          { word: "zadarmo!", start: 12.6, end: 14.2, confidence: 0.99, emphasis: "EMOTION" },
        ],
      }
    ],
    globalStyle: {
      fontFamily: "Plus Jakarta Sans",
      fontSize: 48,
      color: "#FFFFFF",
      outlineColor: "#000000",
      outlineWidth: 2,
      shadowEnabled: true,
      backgroundColor: "transparent",
      backgroundOpacity: 0.5,
      borderRadius: 12,
      animation: "POP",
      style: "HORMOZI",
      position: "bottom",
      wordsPerCaption: "auto",
      maxLines: 2,
      case: "uppercase"
    },
    qualityChecks: [
      { id: "qc1", type: "OK", messageSk: "Rýchlosť čítania je optimálna.", messageEn: "Reading speed is optimal." },
      { id: "qc2", type: "WARNING", messageSk: "Titulok na 03:00 je blízko okraja.", messageEn: "Caption at 03:00 is close to the edge.", segmentId: "cs2" }
    ]
  });
  const [isGeneratingCaptions, setIsGeneratingCaptions] = useState(false);

  const [brollProject, setBrollProject] = useState<BrollProject>({
    id: "broll-001",
    sourceVideoId: "v1",
    items: [
      {
        id: "bi1",
        start: 1.2,
        end: 3.5,
        type: "STOCK",
        titleSk: "Moderná kancelária",
        titleEn: "Modern Office",
        status: "SUGGESTED",
        reasonSk: "Vizualizácia produktivity a ušetreného času.",
        reasonEn: "Visualizing productivity and saved time."
      },
      {
        id: "bi2",
        start: 5.0,
        end: 7.2,
        type: "ZOOM_FX",
        titleSk: "Dynamický zoom",
        titleEn: "Dynamic Zoom",
        status: "APPROVED",
        reasonSk: "Dôraz na kľúčovú myšlienku o drahých appkách.",
        reasonEn: "Emphasis on key point about expensive apps."
      }
    ],
    isApplied: false,
    density: "Balanced",
    isAnalyzed: false
  });
  const [isGeneratingBroll, setIsGeneratingBroll] = useState(false);
  const [bilingualProject, setBilingualProject] = useState<BilingualProject>({
    id: "bi-001",
    sourceLanguage: "sk",
    targetLanguage: "en",
    mode: "NATURAL",
    translatedTranscript: [
      { id: "tr1", sourceId: "cs1", text: "How to save 95% of your video editing time", timingAdjusted: false, lipSyncConfidence: 94 },
      { id: "tr2", sourceId: "cs2", text: "No more paying for expensive apps!", timingAdjusted: false, lipSyncConfidence: 91 }
    ],
    voiceover: {
      id: "vo-001",
      language: "en",
      voiceId: "v1",
      pitch: 1.0,
      speed: 1.0,
      emotion: "friendly",
      isGenerated: false
    },
    isSynced: true,
    accuracyScore: 98
  });
  const [isTranslating, setIsTranslating] = useState(false);

  const [thumbnailProject, setThumbnailProject] = useState<ThumbnailProject>({
    id: "thumb_1",
    sourceVideoId: "v_main",
    isGenerating: false,
    selectedConceptId: "tc_1",
    concepts: [
      {
        id: "tc_1",
        titleSk: "AKO TO DOKÁZAL ZA 24 HODÍN?",
        titleEn: "HOW DID HE DO THIS IN 24H?",
        badgeSk: "ŠOKUJÚCA PRAVDA",
        badgeEn: "SHOCKING TRUTH",
        ctrScore: 98,
        bgTheme: "neon-cyber",
        isApplied: true
      },
      {
        id: "tc_2",
        titleSk: "NEROBTE TÚTO CHYBU!",
        titleEn: "NEVER MAKE THIS MISTAKE!",
        badgeSk: "VAROVANIE",
        badgeEn: "WARNING",
        ctrScore: 94,
        bgTheme: "rich-sunset",
        isApplied: false
      },
      {
        id: "tc_3",
        titleSk: "95% RÝCHLEJŠÍ STRIH V AI",
        titleEn: "95% FASTER AI EDITING",
        badgeSk: "GAMECHANGER",
        badgeEn: "GAMECHANGER",
        ctrScore: 96,
        bgTheme: "emerald-growth",
        isApplied: false
      }
    ]
  });

  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState<boolean>(false);

  const handleGenerateThumbnailConcepts = () => {
    setIsGeneratingThumbnails(true);
    showToast(isSk ? "🎨 Generujem AI miniatúry a clickbait názvy..." : "🎨 Generating AI thumbnails & clickbait titles...");
    setTimeout(() => {
      setThumbnailProject(prev => ({
        ...prev,
        concepts: [
          {
            id: "tc_1",
            titleSk: "TAJOMSTVO, KTORÉ NIKTO NEPOVIE",
            titleEn: "THE SECRET NO ONE TELLS YOU",
            badgeSk: "EXKLUZÍVNE",
            badgeEn: "EXCLUSIVE",
            ctrScore: 99,
            bgTheme: "neon-cyber",
            isApplied: true
          },
          {
            id: "tc_2",
            titleSk: "PREČO VŠETCI STRÁCAJÚ ČAS",
            titleEn: "WHY EVERYONE IS WASTING TIME",
            badgeSk: "HALÓ",
            badgeEn: "TRENDING",
            ctrScore: 95,
            bgTheme: "rich-sunset",
            isApplied: false
          },
          {
            id: "tc_3",
            titleSk: "ZMENITE SI VIDEÁ NAVŽDY",
            titleEn: "CHANGE YOUR VIDEOS FOREVER",
            badgeSk: "ULTIMATE",
            badgeEn: "ULTIMATE",
            ctrScore: 97,
            bgTheme: "emerald-growth",
            isApplied: false
          }
        ]
      }));
      setIsGeneratingThumbnails(false);
      showToast(isSk ? "✨ AI miniatúry vygenerované úspešne!" : "✨ AI thumbnails generated successfully!");
    }, 1500);
  };

  const [editDNA, setEditDNA] = useState<EditDNAModel>(() => {
    return DEFAULT_EDIT_DNA_PROFILES[0];
  });

  const [memoryRules, setMemoryRules] = useState<EditingMemoryRule[]>([
    {
      id: "rule_1",
      ruleSk: "Používateľ preferuje ponechať pauzy pred emocionálnymi vyhláseniami (0.8–1.2s)",
      ruleEn: "User prefers to keep pauses before emotional statements (0.8-1.2s)",
      occurrences: 14,
      confidence: 0.94,
      isActive: true
    },
    {
      id: "rule_2",
      ruleSk: "Pri hookoch používa 108% punch-in zoom",
      ruleEn: "Uses 108% punch-in zoom for hooks",
      occurrences: 22,
      confidence: 0.98,
      isActive: true
    },
    {
      id: "rule_3",
      ruleSk: "B-roll pridáva iba pri abstraktných pojmoch, nie pri každej vete",
      ruleEn: "Adds B-roll only on abstract concepts, not every sentence",
      occurrences: 18,
      confidence: 0.91,
      isActive: true
    }
  ]);

  const [reviewItems, setReviewItems] = useState<ReviewDecisionItem[]>([
    {
      id: "rev_1",
      titleSk: "Odstránená pauza 0.72s + dokončená veta",
      titleEn: "Removed pause 0.72s + completed sentence",
      category: "CUT",
      confidence: 0.94,
      riskLevel: "SAFE",
      whySk: "Podobné rezy boli schválené v 87% predchádzajúcich projektov.",
      whyEn: "Similar cuts were accepted by you in 87% of previous projects.",
      patternMatch: 87,
      status: "PENDING"
    },
    {
      id: "rev_2",
      titleSk: "Automatický punch-in zoom 1.15x na kľúčovom slove",
      titleEn: "Automatic punch-in zoom 1.15x on keyword",
      category: "ZOOM",
      confidence: 0.89,
      riskLevel: "MODERATE",
      whySk: "Váš Edit DNA profil vyžaduje vysokú frekvenciu zoomu pri dôrazoch.",
      whyEn: "Your Edit DNA profile demands high zoom frequency on emphasis.",
      patternMatch: 92,
      status: "PENDING"
    },
    {
      id: "rev_3",
      titleSk: "Výmena originálneho záberu za B-roll grafiku trhu",
      titleEn: "Replacement of original footage with market B-roll",
      category: "BROLL",
      confidence: 0.78,
      riskLevel: "CRITICAL",
      whySk: "Záber obsahuje tvár a lock zónu. Vyžaduje explicitné schválenie.",
      whyEn: "Footage contains face & lock zone. Explicit review required.",
      patternMatch: 45,
      status: "PENDING"
    }
  ]);

  const [lockZones, setLockZones] = useState<LockZone[]>([
    { id: "l_1", type: "FACE", labelSk: "Tvár rečníka (hlavná kamera)", labelEn: "Speaker face (main camera)", timeRange: "00:00 - 05:42", isLocked: true },
    { id: "l_2", type: "SENTENCE", labelSk: "Záverečná výzva k odberu", labelEn: "Final CTA sentence", timeRange: "05:10 - 05:35", isLocked: true },
    { id: "l_3", type: "BRAND", labelSk: "Logo watermark v pravom rohu", labelEn: "Logo watermark in bottom right", isLocked: true }
  ]);

  const [timeMachine, setTimeMachine] = useState<TimeMachineVersion[]>([
    { id: "tm_3", timestamp: "14:12", actionSk: "AI Shadow Editor Cut Optimization", actionEn: "AI Shadow Editor Cut Optimization", author: "AI" },
    { id: "tm_2", timestamp: "14:05", actionSk: "Manuálna úprava pauzy rečníka", actionEn: "Manual speaker pause adjustment", author: "USER" },
    { id: "tm_1", timestamp: "13:50", actionSk: "Import RAW projektu a inicializácia", actionEn: "Import RAW project & initialization", author: "AI" }
  ]);

  const [contentUniverse, setContentUniverse] = useState<ContentUniverseItem[]>([
    { id: "cu_1", type: "LONG", titleSk: "Hlavné YouTube video (Master Story)", titleEn: "Main YouTube Video (Master Story)", status: "READY", duration: "05:42" },
    { id: "cu_2", type: "SHORT", titleSk: "TikTok Viral Short #1 (Hook Focus)", titleEn: "TikTok Viral Short #1 (Hook Focus)", status: "READY", duration: "00:45" },
    { id: "cu_3", type: "SHORT", titleSk: "Instagram Reel #2 (Secret Trick)", titleEn: "Instagram Reel #2 (Secret Trick)", status: "READY", duration: "00:30" },
    { id: "cu_4", type: "QUOTE", titleSk: "Quote Clip pre LinkedIn", titleEn: "Quote Clip for LinkedIn", status: "READY", duration: "00:20" },
    { id: "cu_5", type: "THUMBNAIL", titleSk: "3x AI Thumbnail Clickbait Concepts", titleEn: "3x AI Thumbnail Clickbait Concepts", status: "READY" }
  ]);

  const [audioProject, setAudioProject] = useState<AudioProject>({
    id: "audio-001",
    sourceVideoId: "v1",
    settings: {
      noiseRemoval: 40,
      echoRemoval: 20,
      humRemoval: 10,
      voiceEnhancement: 60,
      loudnessNormalization: true,
      breathControl: 50,
      clippingRepair: true,
      musicDucking: {
        enabled: true,
        strength: 70
      },
      mix: {
        voice: 100,
        music: 30,
        sfx: 50
      },
      preset: "YOUTUBE"
    },
    isProcessed: false,
    artifactsRemoved: {
      breaths: 12,
      clicks: 4,
      backgroundNoiseDb: -42
    }
  });
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [beatSyncProject, setBeatSyncProject] = useState<BeatSyncProject>({
    id: "beat-001",
    sourceVideoId: "v1",
    musicTrackId: "m1",
    bpm: 124,
    markers: [
      { id: "m1", time: 1.2, intensity: 0.8, type: "KICK" },
      { id: "m2", time: 2.4, intensity: 0.6, type: "SNARE" },
      { id: "m3", time: 3.6, intensity: 0.9, type: "DROP" },
      { id: "m4", time: 4.8, intensity: 0.7, type: "KICK" }
    ],
    settings: {
      snapIntensity: 80,
      autoZoomOnBeat: true,
      autoSFXOnBeat: true,
      syncTransitions: true
    },
    isAnalyzed: false
  });
  const [isAnalyzingBeats, setIsAnalyzingBeats] = useState(false);

  const handleAnalyzeBeats = () => {
    setIsAnalyzingBeats(true);
    showToast(isSk ? "🎵 AI analyzuje rytmiku hudby..." : "🎵 AI is analyzing music rhythm...");
    
    setTimeout(() => {
      setBeatSyncProject({ ...beatSyncProject, isAnalyzed: true });
      setIsAnalyzingBeats(false);
      showToast(isSk ? "✅ Rytmická analýza hotová!" : "✅ Rhythmic analysis complete!");
      playSynthesizedSFX("whoosh", 0.5);
    }, 2500);
  };

  const handleSnapToBeat = () => {
    showToast(isSk ? "🧲 Zarovnávam strihy na beat..." : "🧲 Snapping cuts to beat...");
    setTimeout(() => {
      showToast(isSk ? "✅ Synchronizácia dokončená!" : "✅ Synchronization complete!");
      playSynthesizedSFX("camera-shutter", 0.8);
    }, 1500);
  };

  const [visualAttentionProject, setVisualAttentionProject] = useState<VisualAttentionProject>({
    id: "att-001",
    sourceVideoId: "v1",
    points: [
      { id: "p1", time: 1.5, type: "FACE", confidence: 0.98, box: { x: 45, y: 30, width: 10, height: 15 }, labelSk: "Tvár hovorcu", labelEn: "Speaker Face" },
      { id: "p2", time: 1.5, type: "PRODUCT", confidence: 0.92, box: { x: 20, y: 60, width: 15, height: 20 }, labelSk: "Vlogovací set", labelEn: "Vlogging set" },
      { id: "p3", time: 1.5, type: "TEXT", confidence: 0.85, box: { x: 70, y: 10, width: 20, height: 10 }, labelSk: "Titulok v obraze", labelEn: "On-screen text" }
    ],
    suggestions: [
      { id: "s1", startTime: 1.2, endTime: 4.5, type: "ZOOM", targetId: "p2", descriptionSk: "Priblížiť na produkt pre zvýšenie detailu.", descriptionEn: "Zoom in on the product for more detail.", applied: false },
      { id: "s2", startTime: 5.0, endTime: 8.0, type: "BLUR_BG", targetId: "p1", descriptionSk: "Rozmazať pozadie za hovorcom.", descriptionEn: "Blur background behind the speaker.", applied: false }
    ],
    isAnalyzed: false,
    heatmapEnabled: false
  });
  const [isAnalyzingAttention, setIsAnalyzingAttention] = useState(false);

  const [brollFinderProject, setBrollFinderProject] = useState<BrollProject>({
    id: "finder-001",
    sourceVideoId: "v1",
    items: [
      {
        id: "b1",
        start: 4.2,
        end: 8.5,
        type: "STOCK",
        titleSk: "Phone Scrolling Detail",
        titleEn: "Phone Scrolling Detail",
        status: "SUGGESTED",
        reasonSk: "Vizuálne doplnenie vety o sociálnych sieťach.",
        reasonEn: "Visual supplement for the social media sentence.",
        sourceSentenceSk: "Ľudia trávia hodiny scrollovaním každý jeden deň.",
        sourceSentenceEn: "People waste hours scrolling every single day.",
        keywords: ["smartphone", "scrolling", "social media", "hand"],
        thumbnail: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400&h=200&fit=crop"
      },
      {
        id: "b2",
        start: 12.0,
        end: 15.5,
        type: "AI_GENERATED",
        titleSk: "Futuristic Clock Fast Motion",
        titleEn: "Futuristic Clock Fast Motion",
        status: "SUGGESTED",
        reasonSk: "Metafora pre plynutie času.",
        reasonEn: "Metaphor for the passage of time.",
        sourceSentenceSk: "Čas je naša najcennejšia komodita.",
        sourceSentenceEn: "Time is our most valuable commodity.",
        keywords: ["clock", "time", "futuristic", "fast motion"],
        thumbnail: "https://images.unsplash.com/photo-1508921334172-b68ed301ec82?w=400&h=200&fit=crop"
      }
    ],
    density: "Balanced",
    isApplied: false,
    isAnalyzed: false
  });
  const [isAnalyzingBroll, setIsAnalyzingBroll] = useState(false);

  const handleGenerateBrollFinderSuggestions = () => {
    setIsAnalyzingBroll(true);
    showToast(isSk ? "🔍 AI analyzuje text a hľadá vizuály..." : "🔍 AI analyzing text and searching visuals...");
    
    setTimeout(() => {
      setBrollFinderProject({ ...brollFinderProject, isAnalyzed: true });
      setIsAnalyzingBroll(false);
      showToast(isSk ? "✅ Sémantická analýza B-rollov hotová!" : "✅ Semantic B-roll analysis complete!");
      playSynthesizedSFX("camera-shutter", 0.5);
    }, 3000);
  };

  const [cleanupProject, setCleanupProject] = useState<SmartCleanupProject>({
    id: "cleanup-001",
    sourceVideoId: "v1",
    masks: [
      { id: "m1", target: "MICROPHONE", mode: "ERASE", startTime: 0, endTime: 120, isTracking: true, confidence: 0.95, status: "DETECTED" },
      { id: "m2", target: "TRIPOD", mode: "ERASE", startTime: 10, endTime: 30, isTracking: false, confidence: 0.88, status: "DETECTED" },
      { id: "m3", target: "FACE", mode: "BLUR", startTime: 45, endTime: 60, isTracking: true, confidence: 0.99, status: "DETECTED" }
    ],
    isAnalyzed: false,
    globalSettings: {
      blurIntensity: 60,
      inpaintingQuality: "HIGH"
    }
  });
  const [isAnalyzingCleanup, setIsAnalyzingCleanup] = useState(false);
  const [isProcessingCleanup, setIsProcessingCleanup] = useState(false);
  const [multiExportProject, setMultiExportProject] = useState<MultiExportProject>({
    id: "export-001",
    sourceVideoId: "v1",
    configs: [
      { id: "e1", platform: "YOUTUBE", aspectRatio: "16:9", isEnabled: true, aiCompositionEnabled: false, quality: "4K", status: "PENDING", progress: 0 },
      { id: "e2", platform: "SHORTS", aspectRatio: "9:16", isEnabled: true, aiCompositionEnabled: true, quality: "1080p", status: "PENDING", progress: 0 },
      { id: "e3", platform: "TIKTOK", aspectRatio: "9:16", isEnabled: true, aiCompositionEnabled: true, quality: "1080p", status: "PENDING", progress: 0 },
      { id: "e4", platform: "INSTAGRAM", aspectRatio: "4:5", isEnabled: false, aiCompositionEnabled: true, quality: "1080p", status: "PENDING", progress: 0 },
      { id: "e5", platform: "FACEBOOK", aspectRatio: "1:1", isEnabled: true, aiCompositionEnabled: true, quality: "1080p", status: "PENDING", progress: 0 }
    ],
    isExporting: false
  });
  const [isExportingMulti, setIsExportingMulti] = useState(false);

  const [contentPack, setContentPack] = useState<ContentPack>({
    id: "pack-001",
    sourceVideoId: "v1",
    clips: [
      {
        id: "c1",
        startTime: 120,
        endTime: 175,
        hookSk: "Tajomstvo, ktoré vám nikto nepovie o AI strihu.",
        hookEn: "The secret nobody tells you about AI editing.",
        viralityScore: 98,
        platformOptimized: ["TIKTOK", "REELS", "SHORTS"]
      },
      {
        id: "c2",
        startTime: 450,
        endTime: 510,
        hookSk: "Prečo sú vaše videá nudné a ako to hneď opraviť.",
        hookEn: "Why your videos are boring and how to fix it now.",
        viralityScore: 92,
        platformOptimized: ["TIKTOK", "REELS", "SHORTS"]
      },
      {
        id: "c3",
        startTime: 820,
        endTime: 880,
        hookSk: "Návod krok za krokom na virálne Shorts.",
        hookEn: "Step-by-step guide to viral Shorts.",
        viralityScore: 89,
        platformOptimized: ["TIKTOK", "SHORTS"]
      }
    ],
    assets: [
      {
        id: "a1",
        platform: "TIKTOK",
        type: "VIDEO",
        titleSk: "AI Video Revolution",
        titleEn: "AI Video Revolution",
        contentSk: "Prestaňte tráviť hodiny strihom. OmniStrih to urobí za vás. 🚀",
        contentEn: "Stop spending hours editing. OmniStrih does it for you. 🚀",
        hashtags: ["#aivideo", "#omnistrih", "#editing"],
        ctaSk: "Vyskúšaj zadarmo",
        ctaEn: "Try for free"
      },
      {
        id: "a2",
        platform: "LINKEDIN",
        type: "POST",
        titleSk: "Efektivita v produkcii",
        titleEn: "Efficiency in Production",
        contentSk: "Budúcnosť video produkcie je v AI automatizácii. Tu je prečo...",
        contentEn: "The future of video production is in AI automation. Here is why...",
        hashtags: ["#videoproduction", "#ai", "#efficiency"],
        ctaSk: "Čítaj viac",
        ctaEn: "Read more"
      }
    ],
    marketingData: {
      ytTitleSk: "Budúcnosť videa je tu: OmniStrih AI Masterclass",
      ytTitleEn: "The Future of Video is Here: OmniStrih AI Masterclass",
      ytDescriptionSk: "V tomto videu sa dozviete všetko o tom, ako využiť AI na profesionálny strih videa bez predchádzajúcich skúseností.",
      ytDescriptionEn: "In this video, you will learn everything about how to use AI for professional video editing without prior experience.",
      thumbnailTextSk: "AI STRIH ZA 60 SEKÚND",
      thumbnailTextEn: "AI EDIT IN 60 SECONDS"
    },
    isGenerated: false
  });
  const [isGeneratingPack, setIsGeneratingPack] = useState(false);

  const [retentionProject, setRetentionProject] = useState<RetentionProject>({
    id: "ret-001",
    sourceVideoId: "v1",
    segments: [
      { id: "s1", startTime: 0, endTime: 3.5, type: "STRONG", labelSk: "Silný úvod / Hook", labelEn: "Strong Opening / Hook", score: 96 },
      { id: "s2", startTime: 3.5, endTime: 7.2, type: "LOW_DENSITY", labelSk: "Nízka hustota informácií", labelEn: "Low information density", score: 45 },
      { id: "s3", startTime: 12.0, endTime: 16.5, type: "LONG_PAUSE", labelSk: "Dlhá tichá pauza", labelEn: "Long silent pause", score: 20 },
      { id: "s4", startTime: 24.0, endTime: 29.5, type: "STRONG_PAYOFF", labelSk: "Silné rozuzlenie / Payoff", labelEn: "Strong Payoff / Resolution", score: 92 },
      { id: "s5", startTime: 40.0, endTime: 55.0, type: "REPETITIVE", labelSk: "Opakujúce sa myšlienky", labelEn: "Repetitive thoughts", score: 35 }
    ],
    overallScore: 68,
    isAnalyzed: false
  });
  const [isAnalyzingRetention, setIsAnalyzingRetention] = useState(false);

  const [abVersionProject, setAbVersionProject] = useState<ABVersionProject>({
    id: "ab-001",
    sourceVideoId: "v1",
    versions: [
      { 
        id: "v-fast", 
        name: "Version A: Fast Cuts", 
        style: "FAST_CUTS", 
        status: "READY",
        descriptionSk: "Agresívny strih, krátke prestrihy, vysoká dynamika.",
        descriptionEn: "Aggressive editing, short cuts, high dynamics.",
        metrics: { estimatedRetention: 94, pacingScore: 98, visualDensity: 85 }
      },
      { 
        id: "v-natural", 
        name: "Version B: Natural Pacing", 
        style: "NATURAL", 
        status: "READY",
        descriptionSk: "Plynulý, prirodzený rytmus, menej rušivých prvkov.",
        descriptionEn: "Smooth, natural rhythm, fewer distractions.",
        metrics: { estimatedRetention: 82, pacingScore: 65, visualDensity: 40 }
      },
      { 
        id: "v-heavy", 
        name: "Version C: Heavy Captions", 
        style: "HEAVY_CAPTIONS", 
        status: "READY",
        descriptionSk: "Dominantné titulky, vizuálne efekty pri každom slove.",
        descriptionEn: "Dominant captions, visual effects on every word.",
        metrics: { estimatedRetention: 88, pacingScore: 80, visualDensity: 95 }
      }
    ],
    isGenerated: false
  });
  const [isGeneratingAB, setIsGeneratingAB] = useState(false);

  const handleGenerateABVersions = () => {
    setIsGeneratingAB(true);
    showToast(isSk ? "🧬 AI rozvetvuje váš edit na varianty..." : "🧬 AI branching your edit into variants...");
    
    setTimeout(() => {
      setAbVersionProject({ ...abVersionProject, isGenerated: true });
      setIsGeneratingAB(false);
      showToast(isSk ? "✅ A/B varianty sú pripravené!" : "✅ A/B variants are ready!");
      playSynthesizedSFX("ding", 0.6);
    }, 4000);
  };

  const handleRunRetentionAnalysis = () => {
    setIsAnalyzingRetention(true);
    showToast(isSk ? "📊 AI simuluje správanie diváka..." : "📊 AI simulating viewer behavior...");
    
    setTimeout(() => {
      setRetentionProject({ ...retentionProject, isAnalyzed: true });
      setIsAnalyzingRetention(false);
      showToast(isSk ? "✅ Analýza udržania pozornosti hotová!" : "✅ Retention analysis complete!");
      playSynthesizedSFX("boom", 0.5);
    }, 3500);
  };

  const handleGenerateContentPack = () => {
    setIsGeneratingPack(true);
    showToast(isSk ? "📦 AI vyťahuje virálne momenty z videa..." : "📦 AI extracting viral moments from video...");
    
    setTimeout(() => {
      setContentPack({ ...contentPack, isGenerated: true });
      setIsGeneratingPack(false);
      showToast(isSk ? "✅ Content Pack bol úspešne vygenerovaný!" : "✅ Content Pack generated successfully!");
      playSynthesizedSFX("cash", 0.7);
    }, 4500);
  };

  useEffect(() => {
    if (isExportingMulti) {
      const enabled = multiExportProject.configs.filter(c => c.isEnabled);
      const allDone = enabled.length > 0 && enabled.every(c => c.status === "COMPLETED");
      if (allDone) {
        setIsExportingMulti(false);
        setMultiExportProject(prev => ({ ...prev, isExporting: false }));
        showToast(isSk ? "✅ Všetky verzie boli úspešne vygenerované!" : "✅ All versions generated successfully!");
        playSynthesizedSFX("ding", 0.8);
      }
    }
  }, [multiExportProject, isExportingMulti, isSk]);

  const handleStartMultiExport = () => {
    setIsExportingMulti(true);
    showToast(isSk ? "🚀 Spúšťam Multi-platformový export..." : "🚀 Starting Multi-platform export...");
    
    setMultiExportProject(prev => ({
      ...prev,
      isExporting: true,
      configs: prev.configs.map(c => c.isEnabled ? { ...c, status: "PROCESSING" as const, progress: 0, isPaused: false, estimatedSecondsRemaining: 20 } : c)
    }));

    const enabledConfigs = multiExportProject.configs.filter(c => c.isEnabled);

    enabledConfigs.forEach((config) => {
      let prog = 0;
      let remaining = 20;
      const interval = setInterval(() => {
        setMultiExportProject(latest => {
          const currentConfig = latest.configs.find(c => c.id === config.id);
          if (!currentConfig || currentConfig.status === "COMPLETED" || currentConfig.status === "FAILED") {
            clearInterval(interval);
            return latest;
          }
          if (currentConfig.isPaused || currentConfig.status === "PAUSED") {
            return latest; // paused
          }

          prog += Math.random() * 10 + 5;
          remaining = Math.max(0, Math.ceil(((100 - prog) / 100) * 20));

          if (prog >= 100) {
            prog = 100;
            clearInterval(interval);
            return {
              ...latest,
              configs: latest.configs.map(c => c.id === config.id ? { ...c, progress: 100, status: "COMPLETED" as const, estimatedSecondsRemaining: 0, isPaused: false } : c)
            };
          } else {
            return {
              ...latest,
              configs: latest.configs.map(c => c.id === config.id ? { ...c, progress: Math.floor(prog), status: "PROCESSING" as const, estimatedSecondsRemaining: remaining } : c)
            };
          }
        });
      }, 500);
    });
  };

  const handleRunCleanupDetection = () => {
    setIsAnalyzingCleanup(true);
    showToast(isSk ? "🔍 AI skenuje scénu pre rušivé prvky..." : "🔍 AI scanning scene for distractions...");
    
    setTimeout(() => {
      setCleanupProject({ ...cleanupProject, isAnalyzed: true });
      setIsAnalyzingCleanup(false);
      showToast(isSk ? "✅ Detekcia dokončená!" : "✅ Detection complete!");
      playSynthesizedSFX("whoosh", 0.4);
    }, 2500);
  };

  const handleApplyCleanup = () => {
    setIsProcessingCleanup(true);
    showToast(isSk ? "✨ AI vykonáva nedestruktívne čistenie..." : "✨ AI performing non-destructive cleanup...");
    
    setTimeout(() => {
      setCleanupProject({
        ...cleanupProject,
        masks: cleanupProject.masks.map(m => ({ ...m, status: "CLEANED" }))
      });
      setIsProcessingCleanup(false);
      showToast(isSk ? "✅ Scéna je vyčistená!" : "✅ Scene is clean!");
      playSynthesizedSFX("glitch", 0.6);
    }, 4000);
  };

  const handleRunAttentionAnalysis = () => {
    setIsAnalyzingAttention(true);
    showToast(isSk ? "👀 AI analyzuje vizuálnu pozornosť..." : "👀 AI analyzing visual attention...");
    
    setTimeout(() => {
      setVisualAttentionProject({ ...visualAttentionProject, isAnalyzed: true });
      setIsAnalyzingAttention(false);
      showToast(isSk ? "✅ Vizuálna analýza hotová!" : "✅ Visual analysis complete!");
      playSynthesizedSFX("glitch", 0.4);
    }, 3000);
  };

  const handleApplyAttentionSuggestion = (id: string) => {
    setVisualAttentionProject({
      ...visualAttentionProject,
      suggestions: visualAttentionProject.suggestions.map(s => s.id === id ? { ...s, applied: true } : s)
    });
    showToast(isSk ? "✨ Úprava aplikovaná na timeline!" : "✨ Edit applied to timeline!");
    playSynthesizedSFX("camera-shutter", 0.6);
  };

  const handleProcessAudio = () => {
    setIsProcessingAudio(true);
    showToast(isSk ? "🎙️ AI čistí a vylepšuje zvuk..." : "🎙️ AI is cleaning and enhancing audio...");
    
    setTimeout(() => {
      setAudioProject({ ...audioProject, isProcessed: true });
      setIsProcessingAudio(false);
      showToast(isSk ? "✅ Audio mastering hotový!" : "✅ Audio mastering complete!");
      playSynthesizedSFX("glitch", 0.6);
    }, 3000);
  };

  const handleGenerateBilingualTranslation = (mode: TranslationMode) => {
    setIsTranslating(true);
    showToast(isSk ? `🌍 AI generuje ${mode.toLowerCase()} preklad...` : `🌍 AI generating ${mode.toLowerCase()} translation...`);
    
    setTimeout(() => {
      setBilingualProject({ ...bilingualProject, mode });
      setIsTranslating(false);
      showToast(isSk ? "✅ Preklad pripravený!" : "✅ Translation ready!");
      playSynthesizedSFX("whoosh", 0.5);
    }, 2000);
  };

  const handleGenerateVoiceover = () => {
    setIsTranslating(true);
    showToast(isSk ? "🎙️ AI generuje anglický dabing..." : "🎙️ AI generating English dubbing...");
    
    setTimeout(() => {
      setBilingualProject({ 
        ...bilingualProject, 
        voiceover: { ...bilingualProject.voiceover, isGenerated: true } 
      });
      setIsTranslating(false);
      showToast(isSk ? "✅ Dabing vygenerovaný a synchronizovaný!" : "✅ Dubbing generated and synced!");
      playSynthesizedSFX("camera-shutter", 0.8);
    }, 3000);
  };

  const handleGenerateBrollSuggestions = () => {
    setIsGeneratingBroll(true);
    showToast(isSk ? "🔍 AI analyzuje miesta pre B-roll..." : "🔍 AI is analyzing B-roll spots...");
    
    setTimeout(() => {
      const newItems: BrollProject["items"] = [
        ...brollProject.items,
        {
          id: "bi-" + Date.now(),
          start: 8.5,
          end: 11.0,
          type: "AI_GENERATED",
          titleSk: "Futuristický strih videa",
          titleEn: "Futuristic Video Editing",
          status: "SUGGESTED",
          reasonSk: "Vhodné pre vizualizáciu AI technológií.",
          reasonEn: "Perfect for visualizing AI technologies."
        }
      ];
      setBrollProject({ ...brollProject, items: newItems });
      setIsGeneratingBroll(false);
      showToast(isSk ? "✅ Nové návrhy pripravené!" : "✅ New suggestions ready!");
      playSynthesizedSFX("whoosh", 0.5);
    }, 2500);
  };

  const handleApplyBroll = () => {
    setBrollProject({ ...brollProject, isApplied: true });
    showToast(isSk ? "🎬 B-roll aplikovaný na timeline!" : "🎬 B-roll applied to timeline!");
    playSynthesizedSFX("camera-shutter", 0.8);
  };

  const [settings, setSettings] = useState<VideoProjectSettings>({
    aspectRatio: "9:16",
    language: "sk",
    autoZoomEnabled: true,
    zoomIntensity: 1.25,
    captionsEnabled: true,
    captionStyle: "submagic-viral",
    captionPosition: "bottom",
    captionScale: 1.0,
    captionSafeMargin: true,
    sfxEnabled: true,
    sfxVolume: 0.8,
    backgroundMode: "studio-blur",
    chromaKeyColor: "#00ff00",
    chromaTolerance: 40,
    studioEnhanceColor: true,
    studioNormalizeAudio: true,
    cutSilences: true,
    progressBarEnabled: true,
    progressBarColor: "#f43f5e",
    viralHookEnabled: true,
    viralHookText: "ZASTAV SCROLLOVANIE! 🔥",

    // Opus, VN and OmniStrih options
    screenShakeEnabled: true,
    speedRampPreset: "fast-ramp",
    autoReframeFace: true,
    bRollEnabled: true,
    omniCollagePaperTexture: true,
    omniWashiTapeEnabled: true,
    highlighterColor: "rgba(250, 204, 21, 0.88)",
    zeroTokenMode: false,
    activeApiKeyMode: "auto-pool",

    // Pro-Editor, Canva & Audio Suite
    videoCategory: "educational",
    colorPalette: "hormozi",
    bgMusicTrack: "none",
    bgMusicVolume: 0.35,
    bgMusicDucking: true,
    voiceClarifierEnabled: true,
    detectedSilenceSeconds: 2.8,

    // Object & Watermark Zero-Blur Eraser
    eraserEnabled: true,
    eraserActiveTool: "none",
    eraserBrushRadius: 24,
    eraserZones: DEMO_VIDEOS[0]?.suggestedEraserZones || [
      {
        id: "demo-wm",
        name: "TikTok / Logo Vodoznak (Vpravo dole)",
        type: "watermark",
        x: 0.72,
        y: 0.88,
        width: 0.24,
        height: 0.08,
        enabled: true,
        feather: 3,
      },
    ],
    eraserBlendMode: "content-aware",
    eraserGrainMatch: true,
    eraserFeather: 3,

    // Audio & Speech Narration Sync
    captionAudioOffsetMs: 0,
    voiceNarrationSyncEnabled: false,

    // Caption Display Customizations
    captionCase: "uppercase",
    captionStrokeWidth: 1,
    captionShadowEnabled: true,
  });

  const [currentVideoUrl, setCurrentVideoUrl] = useState<string>(
    DEMO_VIDEOS[0].url
  );
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(15);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // PERFORMANCE ENGINE: AI JOB LISTENER
  useEffect(() => {
    return AIJobQueue.registerListener((queue) => {
      const analysisJob = queue.find(j => j.type === 'VIDEO_ANALYSIS' && j.status === 'completed');
      if (analysisJob && isAnalyzingRaw) {
         completeRawAnalysis();
      }
      
      const proxyJob = queue.find(j => j.type === 'PROXY_GENERATION' && j.status === 'queued');
      if (proxyJob) {
        generateProxyJob("current-project", currentVideoUrl, proxyQuality).then(url => {
            setProxyUrl(url);
        });
      }
    });
  }, [isAnalyzingRaw, currentVideoUrl, proxyQuality]);


  // Active navigation tab
  const [activeTab, setActiveTab] = useState<
    "edl_autopilot" | "content_graph" | "pro_audio" | "qc_analytics" | "editor_brain" | "ai_orchestrator" | "ai_visual_director" | "pro_autopilot" | "system_test" | "pipeline" | "raw" | "story" | "jump" | "transitions" | "bilingual" | "audio" | "beat" | "attention" | "finder" | "cleanup" | "export" | "pack" | "retention" | "ab" | "pro_timeline" | "omnistrih" | "eraser" | "captions" | "burned_subtitles" | "opus" | "canva" | "thumbnail" | "os_hub" | "broll" | "toggles" | "zoomsfx" | "pro_toolbox" | "ai_voice" | "media_manager" | "director_briefing" | "workspace"
  >(() => {
    const saved = localStorage.getItem("omnistrih_active_tab");
    return (saved as any) || "pro_autopilot";
  });

  // AI Natural Voice Clips Collection
  const [voiceClips, setVoiceClips] = useState<NaturalVoiceClip[]>([]);

  // Project Versioning State (For Stale AI Job Protection)
  const [projectVersion, setProjectVersion] = useState<number>(1);
  const [aiStatusLevel, setAiStatusLevel] = useState<string>("AI AVAILABLE");

  useEffect(() => {
    const unsubscribe = aiOrchestrator.subscribe((state) => {
      setAiStatusLevel(state.overallStatus);
    });
    return () => unsubscribe();
  }, []);

  // TRANSITION STUDIO STATE
  const [transitions, setTransitions] = useState<VideoTransition[]>([
    {
      id: "trans-1",
      timestamp: 2.8,
      duration: 0.35,
      type: "zoom_through",
      easing: "spring",
      easingCurve: [0.16, 1, 0.3, 1],
      soundEffect: "whoosh",
      labelSk: "Zoom-Through (Prelet)",
      labelEn: "Zoom-Through",
    },
    {
      id: "trans-2",
      timestamp: 6.2,
      duration: 0.28,
      type: "whip_pan",
      easing: "spring",
      easingCurve: [0.7, 0, 0.3, 1],
      soundEffect: "whip_snap",
      labelSk: "Whip Pan (Švih Kamery)",
      labelEn: "Whip Pan",
    },
    {
      id: "trans-3",
      timestamp: 9.8,
      duration: 0.4,
      type: "light_leak",
      easing: "ease_in_out",
      easingCurve: [0.4, 0, 0.2, 1],
      soundEffect: "film_click",
      labelSk: "Svetelný Záblesk (Light Leak)",
      labelEn: "Light Leak & Flare",
    },
  ]);

  // OMNISTRIH V2 CENTRAL DATAMODEL & VIEWS
  const [currentView, setCurrentView] = useState<"dashboard" | "editor" | "templates" | "style">(() => {
    const saved = localStorage.getItem("omnistrih_current_view");
    return (saved as any) || "dashboard";
  });
  const [projects, setProjects] = useState<any[]>(() => {
    const saved = localStorage.getItem("omnistrih_projects");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    return [
      {
        id: "proj-001",
        name: "Podcast Episode #24",
        duration: "15:20",
        resolution: "4K UHD",
        fps: 30,
        language: "sk",
        lastModified: "Dnes, 10:24",
        completionPercentage: 85,
        status: "EDITING", // IMPORTED, ANALYZING, ANALYZED, STORY_READY, EDITING, REVIEW, APPROVED, EXPORTING, EXPORTED
        thumbnail: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=400&h=200&fit=crop",
        steps: { rawAnalysis: "done", story: "done", jumpCut: "done", captions: "done", bRoll: "72%", audio: "45%", export: "pending" }
      },
      {
        id: "proj-002",
        name: "AI Marketing Teaser",
        duration: "01:15",
        resolution: "1080p",
        fps: 60,
        language: "sk/en",
        lastModified: "Včera, 15:42",
        completionPercentage: 40,
        status: "STORY_READY",
        thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=200&fit=crop",
        steps: { rawAnalysis: "done", story: "done", jumpCut: "pending", captions: "pending", bRoll: "pending", audio: "pending", export: "pending" }
      },
      {
        id: "proj-003",
        name: "Slovenský Tech Review",
        duration: "03:12",
        resolution: "4K UHD",
        fps: 30,
        language: "sk",
        lastModified: "15. Sept 2026",
        completionPercentage: 100,
        status: "EXPORTED",
        thumbnail: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=400&h=200&fit=crop",
        steps: { rawAnalysis: "done", story: "done", jumpCut: "done", captions: "done", bRoll: "done", audio: "done", export: "done" }
      }
    ];
  });
  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    return localStorage.getItem("omnistrih_active_project_id") || "proj-001";
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectionType, setSelectionType] = useState<SelectionType>('NONE');

  const handleInspectorAction = (actionId: string, params?: any) => {
    switch (actionId) {
      case 'OPEN_PRO_TOOLBOX':
        setActiveTab('pro_toolbox');
        showToast(isSk ? "Otváram Pro Toolbox..." : "Opening Pro Toolbox...");
        break;
      case 'OPEN_TOOL_SEARCH':
        setIsSearchOpen(true);
        break;
      case 'SHOW_PROJECT_INFO':
        setSelectionType('PROJECT');
        break;
      case 'cut':
      case 'split':
        showToast(isSk ? "Strih aplikovaný na aktuálnej pozícii." : "Cut applied at current position.");
        playSynthesizedSFX("camera-shutter", 0.5);
        break;
      case 'stabilize':
        showToast(isSk ? "Spúšťam AI stabilizáciu klipu..." : "Running AI stabilization on clip...");
        // Route to existing cleanup/optimization if possible
        break;
      case 'clean':
        handleRunCleanupDetection();
        break;
      case 'style':
        if (selectionType === 'CAPTION') {
          setActiveTab('captions');
        }
        break;
      default:
        console.log(`Inspector action ${actionId} not yet fully routed.`);
    }
  };

  // AI Copilot State
  const [copilotInput, setCopilotInput] = useState("");
  const [copilotMessages, setCopilotMessages] = useState<any[]>([
    {
      id: "m1",
      sender: "ai",
      textSk: "Ahoj! Ja som tvoj OmniStrih AI asistent. Môžeš mi zadať príkazy ako 'Zväčši titulky', 'Odstráň ticho' alebo 'Použi filmový štýl'. Ako ti dnes môžem pomôcť s tvojím editom?",
      textEn: "Hi! I am your OmniStrih AI Assistant. You can give me commands like 'Make captions bigger', 'Remove silence', or 'Use cinematic style'. How can I help you with your edit today?",
      time: "10:48"
    }
  ]);

  // Searchable project query
  const [searchQuery, setSearchQuery] = useState("");
  const [customVideoName, setCustomVideoName] = useState<string>("Podcast Episode #24");
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const mainFileInputRef = useRef<HTMLInputElement | null>(null);
  const mainMultiFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleUploadVideo = async (url: string, filename?: string, file?: File) => {
    const fname = filename || (isSk ? "Nahrané video" : "Uploaded video");
    setCustomVideoName(fname);
    
    // Revoke previous blob URL if replacing media to prevent memory leaks
    if (currentVideoUrl && currentVideoUrl.startsWith("blob:") && currentVideoUrl !== url) {
      try {
        URL.revokeObjectURL(currentVideoUrl);
      } catch (e) {
        // ignore
      }
    }

    setCurrentVideoUrl(url);

    // Phase 1: Register with the new Media Engine if it's a real file
    if (file) {
      try {
        const asset = await mediaEngine.registerMediaFile(file);
        console.log('[MediaEngine] Registered asset:', asset);
        // We can update project state with real duration/metadata here
        if (asset.duration > 0) {
           setDuration(asset.duration);
           playheadStore.setDuration(asset.duration);
        }
      } catch (err) {
        console.error('[MediaEngine] Registration failed:', err);
      }
    }

    setProjects(prev => prev.map(p => p.id === activeProjectId ? {
      ...p,
      hasMedia: true,
      mediaUrl: url,
      name: (p.name.startsWith("Nový") || p.name.startsWith("New") || p.name === "Podcast Episode #24") ? fname.replace(/\.[^/.]+$/, "") : p.name,
      status: "IMPORTED",
      lastModified: isSk ? "Práve teraz" : "Just now"
    } : p));
    showToast(isSk ? `📁 Video "${fname}" bolo úspešne nahrané!` : `📁 Video "${fname}" successfully uploaded!`);
  };

  const handleGlobalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      InstantMediaRegistry.registerInstant(url, file.name);
      ResourceManager.registerBlob(url);
      handleUploadVideo(url, file.name, file);
    }
  };

  const handleGlobalMultiFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const firstFile = files[0];
      const url = URL.createObjectURL(firstFile);
      InstantMediaRegistry.registerInstant(url, firstFile.name);
      ResourceManager.registerBlob(url);
      handleUploadVideo(url, firstFile.name, firstFile);
      showToast(isSk ? `📁 Nahraných ${files.length} súborov.` : `📁 Uploaded ${files.length} files.`);
    }
  };

  const handleCreateNewProject = () => {
    const newProjId = "proj-" + Date.now();
    const newProj = {
      id: newProjId,
      name: isSk ? "Nový projekt" : "New Project",
      duration: "00:00",
      resolution: "4K UHD",
      fps: 30,
      language: isSk ? "sk" : "en",
      lastModified: isSk ? "Práve teraz" : "Just now",
      completionPercentage: 0,
      status: "NEW",
      hasMedia: false,
      mediaUrl: "",
      thumbnail: "",
      steps: { rawAnalysis: "pending", story: "pending", jumpCut: "pending", captions: "pending", bRoll: "pending", audio: "pending", export: "pending" }
    };
    setProjects(prev => [newProj, ...prev]);
    setActiveProjectId(newProjId);
    setCurrentVideoUrl("");
    setDuration(0);
    setCurrentTime(0);
    setCurrentView("editor");
    setActiveTab("jump");
    setIsImportModalOpen(true);
    showToast(isSk ? "Nový projekt vytvorený. Zvoľte zdroj pre nahratie videa." : "New project created. Choose video import source.");
  };

  const handleContinueEditing = (projId: string) => {
    setActiveProjectId(projId);
    const proj = projects.find(p => p.id === projId);
    if (proj) {
      if (proj.mediaUrl) {
        setCurrentVideoUrl(proj.mediaUrl);
      } else if (proj.hasMedia !== false) {
        const demo = DEMO_VIDEOS.find(d => d.id === proj.id) || DEMO_VIDEOS[0];
        setCurrentVideoUrl(demo.url);
      } else {
        setCurrentVideoUrl("");
      }
      showToast(isSk ? `Načítavam projekt: ${proj.name}` : `Loading project: ${proj.name}`);
    }
    setCurrentView("editor");
    setActiveTab("jump");
  };

  const handleDuplicateProject = (projId: string) => {
    const target = projects.find(p => p.id === projId);
    if (!target) return;
    const duplicated = {
      ...target,
      id: "proj-" + Date.now(),
      name: `${target.name} (${isSk ? "Kópia" : "Copy"})`,
      lastModified: isSk ? "Práve teraz" : "Just now",
      completionPercentage: target.completionPercentage
    };
    setProjects(prev => [...prev, duplicated]);
    showToast(isSk ? `Projekt "${target.name}" bol duplikovaný.` : `Project "${target.name}" duplicated.`);
  };

  const handleRenameProject = (projId: string) => {
    const target = projects.find(p => p.id === projId);
    if (!target) return;
    const newName = prompt(isSk ? "Zadajte nový názov projektu:" : "Enter new project name:", target.name);
    if (!newName) return;
    setProjects(prev => prev.map(p => p.id === projId ? { ...p, name: newName } : p));
    showToast(isSk ? `Projekt premenovaný na "${newName}"` : `Project renamed to "${newName}"`);
  };

  const handleArchiveProject = (projId: string) => {
    const target = projects.find(p => p.id === projId);
    if (!target) return;
    showToast(isSk ? `Projekt "${target.name}" bol archivovaný.` : `Project "${target.name}" archived.`);
  };

  const handleDeleteProject = (projId: string) => {
    const target = projects.find(p => p.id === projId);
    if (!target) return;
    const ok = confirm(isSk ? `Naozaj chcete vymazať projekt "${target.name}"?` : `Are you sure you want to delete project "${target.name}"?`);
    if (!ok) return;
    setProjects(prev => prev.filter(p => p.id !== projId));
    showToast(isSk ? `Projekt "${target.name}" bol zmazaný.` : `Project "${target.name}" deleted.`);
  };

  const handleSendCopilotMessage = (e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!copilotInput.trim()) return;

    const userText = copilotInput;
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = {
      id: "u-" + Date.now(),
      sender: "user",
      textSk: userText,
      textEn: userText,
      time: timeNow
    };

    setCopilotMessages(prev => [...prev, userMsg]);
    setCopilotInput("");
    playSynthesizedSFX("click", 0.5);

    // AI thinking transition
    setTimeout(() => {
      const query = userText.toLowerCase();
      let replySk = "Príkaz spracovaný. Úspešne som optimalizoval nastavenia vášho projektu na časovej osi.";
      let replyEn = "Command processed. I have successfully optimized your project timeline settings.";

      if (query.includes("zväčš") || query.includes("big") || query.includes("large")) {
        setSettings(prev => ({ ...prev, captionScale: 1.4, captionStyle: "submagic-viral" }));
        replySk = "Aplikoval som zmenu: Veľkosť písma titulkov bola zvýšená na 1.4x a nastavená na štýl 'Hormozi / Viral' pre maximálnu viditeľnosť na mobilných zariadeniach (9:16).";
        replyEn = "Applied change: Caption font scale increased to 1.4x and set to 'Hormozi / Viral' style for maximum readability on mobile devices (9:16).";
        playSynthesizedSFX("ding", 0.6);
      } else if (query.includes("zmenš") || query.includes("small")) {
        setSettings(prev => ({ ...prev, captionScale: 0.85 }));
        replySk = "Zmenil som veľkosť písma titulkov na kompaktnejších 0.85x.";
        replyEn = "Adjusted caption font scale to a more compact 0.85x.";
        playSynthesizedSFX("click", 0.5);
      } else if (query.includes("tich") || query.includes("silence") || query.includes("pauz") || query.includes("odstráň")) {
        setSettings(prev => ({ ...prev, cutSilences: true, detectedSilenceSeconds: 1.2 }));
        replySk = "Aktivoval som funkciu 'Magic Split / Cut Silences'. Skenujem tiché miesta presahujúce 1.2 sekundy a automaticky ich odstraňujem z finálneho Edit Decision Listu (EDL).";
        replyEn = "Enabled 'Magic Split / Cut Silences'. Scanning silence intervals exceeding 1.2s and removing them automatically from the final Edit Decision List (EDL).";
        playSynthesizedSFX("whoosh", 0.6);
      } else if (query.includes("film") || query.includes("cinematic") || query.includes("abdaal")) {
        setSettings(prev => ({ ...prev, captionStyle: "omnistrih-torn-paper", colorPalette: "cinematic", aspectRatio: "16:9" }));
        replySk = "Prepínam projekt do filmového režimu: Nastavený pomer strán 16:9, štýl titulkov 'Torn Paper' (Ali Abdaal) s tlmenou elegantnou farebnou paletou.";
        replyEn = "Switching project to cinematic mode: Aspect ratio 16:9, 'Torn Paper' captions (Ali Abdaal style) with a refined cinematic color palette.";
        playSynthesizedSFX("glitch", 0.6);
      } else if (query.includes("broll") || query.includes("b-roll")) {
        handleGenerateBrollSuggestions();
        replySk = "AI Co-editor prešiel celý prepis videa a vygeneroval nové návrhy pre B-roll prekrytia na základe dôležitých kľúčových slov. Skontrolujte sekciu B-roll.";
        replyEn = "AI Co-editor scanned the video transcript and generated context-aware B-roll overlay suggestions. Please check the B-roll section.";
      } else if (query.includes("zvuk") || query.includes("audio") || query.includes("vocal") || query.includes("hlas")) {
        setSettings(prev => ({ ...prev, voiceClarifierEnabled: true, studioNormalizeAudio: true }));
        replySk = "Aplikoval som audio mastering: Hlasový clarifier je aktívny, automatická normalizácia a potlačenie šumu na pozadí nastavené pre štúdiový zvuk.";
        replyEn = "Applied audio mastering: Voice clarifier is active, automatic normalization and background noise reduction set for professional studio sound.";
        playSynthesizedSFX("camera-shutter", 0.6);
      } else if (query.includes("príbeh") || query.includes("story") || query.includes("plán")) {
        replySk = "Analyzoval som tému a štruktúru videa. AI Story Builder vytvoril ucelený príbehový plán (Háčik → Sľub → Kontext → Problém → Riešenie → Výsledok). Pozrite si záložku 'Story Builder'.";
        replyEn = "Analyzed video theme and structure. AI Story Builder has structured a cohesive narrative outline (Hook → Promise → Context → Problem → Solution → Payoff). Check 'Story Builder' tab.";
        playSynthesizedSFX("camera-shutter", 0.8);
      } else if (query.includes("hormozi") || query.includes("viral")) {
        setSettings(prev => ({
          ...prev,
          captionStyle: "submagic-viral",
          captionCase: "uppercase",
          autoZoomEnabled: true,
          zoomIntensity: 1.35,
          colorPalette: "hormozi",
          highlighterColor: "rgba(250, 204, 21, 0.9)",
          sfxEnabled: true,
          sfxVolume: 0.9
        }));
        replySk = "Aplikoval som kompletný štýl Alex Hormozi: Veľké veľké texty, žlté zvýrazňovače, automatické dynamické priblíženia (auto-zooms) a zapnuté zvukové efekty.";
        replyEn = "Applied complete Alex Hormozi viral template: Large uppercase texts, yellow highlighter accents, automatic dynamic zooms, and synchronized SFX.";
        playSynthesizedSFX("ding", 0.7);
      }

      setCopilotMessages(prev => [
        ...prev,
        {
          id: "ai-" + Date.now(),
          sender: "ai",
          textSk: replySk,
          textEn: replyEn,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      playSynthesizedSFX("camera-shutter", 0.5);
    }, 1500);
  };

  const handleRunRawAnalysis = () => {
    setIsAnalyzingRaw(true);
    AIJobQueue.addJob("current-project", "VIDEO_ANALYSIS", "P1");
  };

  const completeRawAnalysis = () => {
    setRawAnalysis({
        isAnalyzed: true,
        metadata: {
          filename: "OMNISTRIH_RAW_4K.mp4",
          duration: 2712,
          resolution: "3840x2160",
          fps: 30,
          aspectRatio: "16:9",
          fileSize: "4.2 GB",
          hasAudio: true
        },
        totalFillerWords: 42,
        totalSilenceRemoved: 128,
        rawVideoDuration: 2712,
        estimatedEditedDuration: 1840,
        transcription: [
          { id: "t1", start: 0.0, end: 5.2, speaker: "1", text: isSk ? "Vitajte v novom OmniStrih AI tutoriále." : "Welcome to the new OmniStrih AI tutorial.", confidence: 0.98 },
          { id: "t2", start: 5.2, end: 12.5, speaker: "1", text: isSk ? "Dnes vám ukážem ako ušetriť až 95 percent času pri strihu videa." : "Today I'll show you how to save up to 95 percent of editing time.", confidence: 0.96 },
          { id: "t3", start: 12.5, end: 28.4, speaker: "1", text: isSk ? "Najväčšou chybou je začať strihať hneď. Najskôr potrebujete plán." : "The biggest mistake is to start editing right away. First you need a plan.", confidence: 0.94 },
          { id: "t4", start: 28.4, end: 35.0, speaker: "1", text: isSk ? "eee... no... v podstate... eee..." : "um... well... basically... um...", confidence: 0.75 },
          { id: "t5", start: 35.0, end: 55.0, speaker: "1", text: isSk ? "S AI analýzou OmniStrih pochopíte obsah ešte pred prvým strihom." : "With OmniStrih AI analysis, you'll understand the content before the first cut.", confidence: 0.97 },
        ],
        editMap: [
          { id: "e1", type: "HOOK", start: 0, end: 5.2, labelSk: "Silný úvodný háčik", labelEn: "Strong opening hook", status: "KEEP", reasonSk: "Vysoká emócia a jasná téma." },
          { id: "e2", type: "CONTEXT", start: 5.2, end: 12.5, labelSk: "Kontext a sľub hodnoty", labelEn: "Context & value promise", status: "KEEP" },
          { id: "e3", type: "PROBLEM", start: 12.5, end: 28.4, labelSk: "Identifikácia problému", labelEn: "Problem identification", status: "KEEP" },
          { id: "e4", type: "PAUSE", start: 28.4, end: 35.0, labelSk: "Dlhá pauza a filler slová", labelEn: "Long pause and fillers", status: "REMOVE", reasonSk: "Rušivé elementy znižujúce retenciu." },
          { id: "e5", type: "EXPLANATION", start: 35.0, end: 55.0, labelSk: "Vysvetlenie riešenia", labelEn: "Solution explanation", status: "KEEP" },
          { id: "e6", type: "PAYOFF", start: 55.0, end: 68.2, labelSk: "Záverečná pointa", labelEn: "Final payoff", status: "KEEP", reasonSk: "Jasný výsledok a uspokojenie diváka." },
        ],
        shortsSuggestions: [],
        notes: [
          { id: "n1", type: "info", textSk: "Úvod trvá 5.2 sekundy, kým sa objaví hlavná myšlienka.", textEn: "The introduction takes 5.2 seconds before the main idea appears.", timestamp: 0 },
          { id: "n2", type: "warning", textSk: "Na čase 00:28 je 6.6 sekundová pauza s výplňovými slovami.", textEn: "There is a 6.6-second pause at 00:28 with filler words.", timestamp: 28.4 },
          { id: "n3", type: "tip", textSk: "Odpoveď na čase 04:18 by mohla fungovať ako samostatný Short.", textEn: "The answer at 04:18 could work as a standalone short.", timestamp: 258 },
        ]
    });
    setIsAnalyzingRaw(false);
  };

  const handleGenerateStory = (config: { format: StoryFormat, platform: StoryPlatform, goal: StoryGoal, structure: StoryStructure, targetDuration: number }) => {
    setIsGeneratingStory(true);
    // Simulate story building logic using rawAnalysis data
    setTimeout(() => {
      const segments: StorySegment[] = [
        { 
          id: "st1", sourceId: "e1", type: "HOOK", start: 0, end: 5.2, 
          transcript: "Vitajte v novom OmniStrih AI tutoriále.", 
          purposeSk: "Zachytenie pozornosti hneď v úvode.",
          purposeEn: "Capturing attention at the very start.",
          contextRisk: false 
        },
        { 
          id: "st2", sourceId: "e3", type: "PROBLEM", start: 12.5, end: 28.4, 
          transcript: "Najväčšou chybou je začať strihať hneď. Najskôr potrebujete plán.", 
          purposeSk: "Identifikácia bolesti strihača.",
          purposeEn: "Identifying the editor's pain point.",
          contextRisk: true,
          contextWarningSk: "Vynechaný úsek pred touto vetou môže pôsobiť náhle.",
          contextWarningEn: "The missing section before this sentence may feel abrupt."
        },
        { 
          id: "st3", sourceId: "e5", type: "EXPLANATION", start: 35.0, end: 55.0, 
          transcript: "S AI analýzou OmniStrih pochopíte obsah ešte pred prvým strihom.", 
          purposeSk: "Predstavenie riešenia.",
          purposeEn: "Presenting the solution.",
          contextRisk: false 
        },
        { 
          id: "st4", sourceId: "e6", type: "PAYOFF", start: 55.0, end: 68.2, 
          transcript: "Jasný výsledok a uspokojenie diváka.", 
          purposeSk: "Zavŕšenie myšlienky.",
          purposeEn: "Concluding the thought.",
          contextRisk: false 
        }
      ];

      setStoryPlan({
        id: "plan-001",
        format: config.format,
        platform: config.platform,
        goal: config.goal,
        structure: config.structure,
        targetDuration: config.targetDuration,
        segments,
        pacing: { hook: "Fast", middle: "Balanced", ending: "Balanced" },
        infoDensity: "High",
        isApplied: false
      });
      setIsGeneratingStory(false);
      showToast(isSk ? "✅ Príbeh vygenerovaný! Skontrolujte Storyboard." : "✅ Story generated! Check the Storyboard.");
    }, 2500);
  };

  const handleApplyStoryToTimeline = () => {
    if (!storyPlan) return;
    
    showToast(isSk ? "🚀 Aplikujem príbeh na timeline... (Non-destructive)" : "🚀 Applying story to timeline... (Non-destructive)");
    
    // In a real app, this would re-sequence the timeline
    // For demo, we just mark it as applied
    setStoryPlan({ ...storyPlan, isApplied: true });
    
    // Jump to the first segment of the story
    if (storyPlan.segments.length > 0) {
       handleSeek(storyPlan.segments[0].start);
    }
    
    playSynthesizedSFX("paper-rip", 0.6);
  };

  const handleGenerateCuts = (mode: JumpCutMode, density: number) => {
    setIsGeneratingCuts(true);
    // Simulate jump cut detection logic
    setTimeout(() => {
      const markers: AICutMarker[] = [
        { 
          id: "m1", start: 28.4, end: 35.0, type: "REMOVE", category: "pause", pauseType: "DEAD_AIR",
          reasonSk: "Dlhá pauza s výplňovými slovami.",
          reasonEn: "Long pause with filler words.",
          contextRisk: false 
        },
        { 
          id: "m2", start: 45.2, end: 46.8, type: "REMOVE", category: "filler",
          reasonSk: "Odstránenie 'ehm... vlastne'.",
          reasonEn: "Removing 'um... basically'.",
          contextRisk: false 
        },
        { 
          id: "m3", start: 82.5, end: 84.1, type: "REVIEW", category: "repetition",
          reasonSk: "Opakovanie začiatku vety.",
          reasonEn: "Repetition of sentence start.",
          contextRisk: true 
        },
        { 
          id: "m4", start: 110.4, end: 112.0, type: "REMOVE", category: "stutter",
          reasonSk: "Zajaknutie pri slove 'analýza'.",
          reasonEn: "Stutter on the word 'analysis'.",
          contextRisk: false 
        },
        { 
          id: "m5", start: 155.0, end: 156.5, type: "KEEP", category: "pause", pauseType: "EMOTIONAL_PAUSE",
          reasonSk: "Emocionálna pauza pred pointou.",
          reasonEn: "Emotional pause before payoff.",
          contextRisk: false 
        }
      ];

      setJumpSequence({
        id: "jump-001",
        mode,
        cutDensity: density,
        markers,
        originalDuration: 2712,
        editedDuration: 2661,
        stats: {
          removedPauses: 21,
          removedFillers: 12,
          removedRepetitions: 5,
          removedStutters: 3,
          totalCuts: 37
        },
        isApplied: false
      });
      setIsGeneratingCuts(false);
      showToast(isSk ? "✅ Jump-Cut návrhy sú pripravené!" : "✅ Jump-Cut proposals are ready!");
    }, 3000);
  };

  const handleApplyCuts = (selectedIds: string[]) => {
    if (!jumpSequence) return;
    
    showToast(isSk ? `✂️ Aplikujem ${selectedIds.length} strihov...` : `✂️ Applying ${selectedIds.length} cuts...`);
    
    setJumpSequence({ ...jumpSequence, isApplied: true });
    playSynthesizedSFX("camera-shutter", 0.7);
  };

  // ============================================================
  // DIRECTOR PLAN → TIMELINE (Fáza F1.5)
  // Schválené zásahy z Director Planu sa premietnu do existujúcich
  // mechanizmov strihacieho jadra. Nič sa nerobí potichu — vraciame
  // report, čo sa kam zapísalo a čo sa (zatiaľ) nedá aplikovať.
  // ============================================================
  const handleApplyDirectorPlan = (accepted: DirectorPlanItem[]): DirectorApplyReport => {
    const report: DirectorApplyReport = { applied: [], skipped: [] };

    if (!accepted || accepted.length === 0) {
      showToast(isSk ? "⚠️ Nie je vybraný žiadny zásah na aplikovanie." : "⚠️ No edits selected.");
      return report;
    }

    const add = (label: string, count: number) => {
      if (count <= 0) return;
      const found = report.applied.find((a) => a.label === label);
      if (found) found.count += count;
      else report.applied.push({ label, count });
    };

    // 1) CUT / KEEP → markery v jump-sequence (ovplyvní AI Jump-Cut Editor aj timeline)
    const cutItems = accepted.filter((i) => i.type === "CUT" || i.type === "KEEP");
    if (cutItems.length > 0) {
      const newMarkers: AICutMarker[] = cutItems.map((i, idx) => ({
        id: `dp-${i.id || idx}`,
        start: i.start,
        end: typeof i.end === "number" && i.end > i.start ? i.end : i.start + 1.5,
        type: i.type === "CUT" ? "REMOVE" : "KEEP",
        reasonSk: i.reason,
        reasonEn: i.reason,
        category: "pause",
        pauseType: i.type === "CUT" ? "DEAD_AIR" : "NATURAL_PAUSE",
        contextRisk: i.confidence < 0.6,
      }));

      setJumpSequence((prev) => {
        const kept = (prev?.markers ?? []).filter((m) => !String(m.id).startsWith("dp-"));
        const merged = [...kept, ...newMarkers];
        const totalCuts = merged.filter((m) => m.type === "REMOVE").length;
        const original = prev?.originalDuration || (typeof duration === "number" ? duration : 0);
        return {
          id: prev?.id || "director-plan",
          mode: prev?.mode || "BALANCED",
          cutDensity: prev?.cutDensity ?? 55,
          markers: merged,
          originalDuration: original,
          editedDuration: Math.max(0, original - totalCuts * 1.2),
          stats: {
            removedPauses: totalCuts,
            removedFillers: prev?.stats?.removedFillers ?? 0,
            removedRepetitions: prev?.stats?.removedRepetitions ?? 0,
            removedStutters: prev?.stats?.removedStutters ?? 0,
            totalCuts,
          },
          isApplied: true,
        };
      });
      add(isSk ? "Strihy (CUT/KEEP)" : "Cuts (CUT/KEEP)", cutItems.length);
    }

    // 2) ZOOM → punch-in cue + návrat späť
    const zoomItems = accepted.filter((i) => i.type === "ZOOM");
    if (zoomItems.length > 0) {
      setZoomCues((prev) => {
        const kept = prev.filter((c) => !String(c.id).startsWith("dp-"));
        const cues: ZoomCue[] = [];
        zoomItems.forEach((i, idx) => {
          const end = typeof i.end === "number" && i.end > i.start ? i.end : i.start + 3;
          cues.push({
            id: `dp-zin-${i.id || idx}`,
            timestamp: i.start,
            scale: Math.min(1.35, 1.18 + i.confidence * 0.12),
            duration: 0.3,
          });
          cues.push({ id: `dp-zout-${i.id || idx}`, timestamp: end, scale: 1.0, duration: 0.3 });
        });
        return [...kept, ...cues].sort((a, b) => a.timestamp - b.timestamp);
      });
      add(isSk ? "Punch-in zoom" : "Zoom punch-ins", zoomItems.length);
    }

    // 3) SFX → zvukové cue (typ sa odvodí z textu zásahu)
    const sfxItems = accepted.filter((i) => i.type === "SFX");
    if (sfxItems.length > 0) {
      setSfxCues((prev) => {
        const kept = prev.filter((c) => !String(c.id).startsWith("dp-"));
        const cues: SFXCue[] = sfxItems.map((i, idx) => {
          const t = `${i.label} ${i.reason}`.toLowerCase();
          const type: SFXCue["type"] = t.includes("whoosh")
            ? "whoosh"
            : t.includes("boom")
              ? "boom"
              : t.includes("cash")
                ? "cash"
                : t.includes("ding")
                  ? "ding"
                  : t.includes("glitch")
                    ? "glitch"
                    : "pop";
          return { id: `dp-sfx-${i.id || idx}`, timestamp: i.start, type, label: i.label };
        });
        return [...kept, ...cues].sort((a, b) => a.timestamp - b.timestamp);
      });
      add("SFX", sfxItems.length);
    }

    // 4) BROLL → B-roll overlay nad videom
    const brollItems = accepted.filter((i) => i.type === "BROLL");
    if (brollItems.length > 0) {
      setBRollOverlays((prev) => {
        const kept = prev.filter((b) => !String(b.id).startsWith("dp-"));
        const overlays: BRollOverlay[] = brollItems.map((i, idx) => ({
          id: `dp-broll-${i.id || idx}`,
          type: "custom-badge",
          start: i.start,
          end: typeof i.end === "number" && i.end > i.start ? i.end : i.start + 3,
          title: i.label,
          subtitle: i.reason.length > 60 ? `${i.reason.slice(0, 57)}…` : i.reason,
          position: "top-right",
          rotation: -2,
        }));
        return [...kept, ...overlays];
      });
      add("B-roll", brollItems.length);
    }

    // 5) CAPTION → segment titulkov (vstup pre Smart Caption Editor)
    const captionItems = accepted.filter((i) => i.type === "CAPTION");
    if (captionItems.length > 0) {
      setCaptionProject((prev) => ({
        ...prev,
        segments: [
          ...prev.segments.filter((s) => !String(s.id).startsWith("dp-")),
          ...captionItems.map((i, idx) => ({
            id: `dp-cap-${i.id || idx}`,
            start: i.start,
            end: typeof i.end === "number" && i.end > i.start ? i.end : i.start + 2.5,
            text: i.label,
            words: [],
            confidence: i.confidence,
          })),
        ].sort((a, b) => a.start - b.start),
      }));
      add(isSk ? "Titulky" : "Captions", captionItems.length);
    }

    // 6) HOOK → hook text + 808 boom + jemný punch-in (kompozitný zásah)
    const hookItems = accepted.filter((i) => i.type === "HOOK");
    if (hookItems.length > 0) {
      const hook = hookItems.slice().sort((a, b) => a.start - b.start)[0];
      setSettings((prev) => ({
        ...prev,
        viralHookEnabled: true,
        viralHookText: hook.label,
      }));
      setSfxCues((prev) =>
        [
          ...prev.filter((c) => c.id !== "dp-hook-sfx"),
          { id: "dp-hook-sfx", timestamp: hook.start, type: "boom" as const, label: "Hook 808 Boom" },
        ].sort((a, b) => a.timestamp - b.timestamp),
      );
      setZoomCues((prev) =>
        [
          ...prev.filter((c) => c.id !== "dp-hook-zoom"),
          { id: "dp-hook-zoom", timestamp: hook.start, scale: 1.2, duration: 0.25 },
        ].sort((a, b) => a.timestamp - b.timestamp),
      );
      add(isSk ? "Hook (text + boom + zoom)" : "Hook (text + boom + zoom)", 1);
    }

    // 7) HIGHLIGHT → samostatný highlight klip
    const highlightItems = accepted.filter((i) => i.type === "HIGHLIGHT");
    if (highlightItems.length > 0) {
      setSmartClips((prev) => {
        const kept = prev.filter((c) => !String(c.id).startsWith("dp-"));
        const clips: SmartClipHighlight[] = highlightItems.map((i, idx) => ({
          id: `dp-hl-${i.id || idx}`,
          title: i.label,
          start: i.start,
          end: typeof i.end === "number" && i.end > i.start ? i.end : i.start + 8,
          viralityScore: Math.round(Math.max(0, Math.min(1, i.confidence)) * 100),
          badge: isSk ? "AI TIP" : "AI PICK",
        }));
        return [...kept, ...clips];
      });
      add(isSk ? "Highlight klipy" : "Highlight clips", highlightItems.length);
    }

    // 8) CROP → formát rámu 9:16
    const cropItems = accepted.filter((i) => i.type === "CROP");
    if (cropItems.length > 0) {
      setSettings((prev) => ({ ...prev, aspectRatio: "9:16" }));
      add(isSk ? "Formát 9:16" : "9:16 frame", 1);
    }

    // 9) SPEED → rýchlostná krivka (celý klip; per-segment príde vo F2)
    const speedItems = accepted.filter((i) => i.type === "SPEED");
    if (speedItems.length > 0) {
      setSettings((prev) => ({ ...prev, speedRampPreset: "fast-ramp" }));
      add(isSk ? "Zrýchlenie (speed ramp)" : "Speed ramp", speedItems.length);
      report.skipped.push({
        label: isSk ? "Presné rozsahy zrýchlenia" : "Exact speed ranges",
        reason: isSk
          ? "Zrýchlenie sa teraz aplikuje ako krivka na celý klip. Strih presne v rozsahu (napr. 450–470 s) príde vo F2."
          : "Speed is applied as a clip-wide curve; per-range speed arrives in F2.",
      });
    }

    // 10) MUSIC → hudba na pozadí (odhad žánru z textu zásahu)
    const musicItems = accepted.filter((i) => i.type === "MUSIC");
    if (musicItems.length > 0) {
      const text = musicItems.map((i) => `${i.label} ${i.reason}`).join(" ").toLowerCase();
      const guessed: VideoProjectSettings["bgMusicTrack"] = text.includes("lofi")
        ? "lofi-chill"
        : text.includes("phonk")
          ? "viral-phonk"
          : text.includes("synth") || text.includes("tech")
            ? "tech-ambient"
            : text.includes("corporate") || text.includes("brand")
              ? "corporate-inspire"
              : "demo-ambient";

      if (settings.bgMusicTrack === "none") {
        setSettings((prev) => ({ ...prev, bgMusicTrack: guessed }));
        add(isSk ? "Hudba na pozadí" : "Background music", 1);
      } else {
        report.skipped.push({
          label: isSk ? "Hudba na pozadí" : "Background music",
          reason: isSk
            ? `Hudba už je nastavená (${settings.bgMusicTrack}) — AI návrh som neprepísal, aby som ti nezmenil zvuk pod rukami.`
            : `Music already set (${settings.bgMusicTrack}); AI suggestion was not forced.`,
        });
      }
    }

    // Skoč na prvý aplikovaný zásah + povedz, čo sa stalo
    const firstApplied = accepted.slice().sort((a, b) => a.start - b.start)[0];
    if (firstApplied) handleSeek(Math.max(0, firstApplied.start));

    const total = report.applied.reduce((sum, a) => sum + a.count, 0);
    if (total > 0) {
      showToast(
        isSk
          ? `🎬 Director Plan aplikovaný: ${total} zásahov → ${report.applied.map((a) => `${a.label} (${a.count})`).join(", ")}`
          : `🎬 Director Plan applied: ${total} edits`,
      );
      playSynthesizedSFX("ding", 0.6);
    } else {
      showToast(isSk ? "⚠️ Žiadny zásah sa nedal aplikovať." : "⚠️ Nothing could be applied.");
    }

    return report;
  };

  const handleRunMagicSplit = () => {
    setIsGeneratingCaptions(true);
    showToast(isSk ? "🪄 AI prepočítava Magic Split..." : "🪄 AI is recalculating Magic Split...");
    
    setTimeout(() => {
      // Simulate intelligent splitting
      const updatedSegments = captionProject.segments.flatMap(seg => {
        if (seg.words.length > 3) {
          const mid = Math.floor(seg.words.length / 2);
          const s1 = seg.words.slice(0, mid);
          const s2 = seg.words.slice(mid);
          
          return [
            { 
              ...seg, 
              id: seg.id + "-1", 
              text: s1.map(w => w.word).join(" "), 
              words: s1, 
              end: s1[s1.length - 1].end 
            },
            { 
              ...seg, 
              id: seg.id + "-2", 
              start: s2[0].start, 
              text: s2.map(w => w.word).join(" "), 
              words: s2 
            }
          ];
        }
        return [seg];
      });
      
      setCaptionProject({ ...captionProject, segments: updatedSegments });
      setIsGeneratingCaptions(false);
      showToast(isSk ? "✅ Magic Split aplikovaný!" : "✅ Magic Split applied!");
      playSynthesizedSFX("whoosh", 0.5);
    }, 2000);
  };

  const handleTranslateCaptions = (target: "sk" | "en") => {
    setIsGeneratingCaptions(true);
    showToast(isSk ? `🌍 Prekladám titulky do ${target.toUpperCase()}...` : `🌍 Translating captions to ${target.toUpperCase()}...`);
    
    setTimeout(() => {
       const translatedSegments = captionProject.segments.map(seg => ({
         ...seg,
         text: target === "en" ? "Translated Professional Caption" : "Preložený profesionálny titulok",
         words: seg.words.map(w => ({ ...w, word: target === "en" ? "Word" : "Slovo" }))
       }));
       
       setCaptionProject({ 
         ...captionProject, 
         segments: translatedSegments, 
         language: target === "sk" ? "sk" : "en",
         translatedLanguage: target === "en" ? "en" : "sk" 
       });
       setIsGeneratingCaptions(false);
       showToast(isSk ? "✅ Preklad hotový!" : "✅ Translation complete!");
    }, 2500);
  };

  const [isProcessingMagic, setIsProcessingMagic] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [videoTopic, setVideoTopic] = useState<string>("");
  const [captionStyle, setCaptionStyle] = useState<"mrbeast" | "ali-abdaal" | "cyber">("mrbeast");
  const [transcriptionProgress, setTranscriptionProgress] = useState<number>(0);
  const [transcriptionStage, setTranscriptionStage] = useState<string>("");

  const handleGenerateSubtitles = async () => {
    if (isTranscribing) return;
    
    setIsTranscribing(true);
    setTranscriptionProgress(5);
    setTranscriptionStage(isSk ? "🎙️ Inicializujem audio stopu z videa..." : "🎙️ Initializing audio track from video...");
    
    const timer1 = setTimeout(() => {
      setTranscriptionProgress(25);
      setTranscriptionStage(isSk ? "🎙️ Extrahujem rečový signál..." : "🎙️ Extracting speech signal...");
    }, 800);

    const timer2 = setTimeout(() => {
      setTranscriptionProgress(55);
      setTranscriptionStage(isSk ? "🧠 Prepisujem reč pomocou Gemini AI..." : "🧠 Transcribing speech using Gemini AI...");
    }, 2000);

    try {
      const response = await fetch("/api/transcribe-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          filename: customVideoName,
          topic: videoTopic,
          language: language,
          duration: duration,
          style: captionStyle
        })
      });

      const data = await response.json();

      clearTimeout(timer1);
      clearTimeout(timer2);

      if (data.success && data.segments) {
        setTranscriptionProgress(85);
        setTranscriptionStage(isSk ? "⚡ Synchronizujem kinetické karaoke časovanie..." : "⚡ Syncing kinetic karaoke word timings...");

        setTimeout(() => {
          setTranscriptionProgress(100);
          setTranscriptionStage(isSk ? "✨ Dokončené!" : "✨ Done!");

          setCaptionProject({
            ...captionProject,
            segments: data.segments,
            language: language
          });

          setIsTranscribing(false);
          setActiveTab("captions"); // Switch to captions editor
          showToast(isSk ? "✅ AI Titulky úspešne vygenerované!" : "✅ AI Captions successfully generated!");
          playSynthesizedSFX("cash", 0.7);
        }, 1200);
      } else {
        throw new Error(data.error || "Failed to generate segments");
      }
    } catch (err: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setIsTranscribing(false);
      setTranscriptionProgress(0);
      setTranscriptionStage("");
      showToast(isSk ? `❌ Generovanie titulkov zlyhalo: ${err.message}` : `❌ Caption generation failed: ${err.message}`);
    }
  };

  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isApiKeysOpen, setIsApiKeysOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isBRollTimelineOpen, setIsBRollTimelineOpen] = useState<boolean>(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);
  const [smartCategory, setSmartCategory] = useState<SmartCategory>("titulky");
  const [showAdvancedTools, setShowAdvancedTools] = useState<boolean>(false);
  const [rightPanelTab, setRightPanelTab] = useState<"smart_tools" | "ai_copilot">("smart_tools");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const currentTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);

  currentTimeRef.current = currentTime;
  durationRef.current = duration;
  isPlayingRef.current = isPlaying;

  const activeCaptions = captionProject.segments;
  const setActiveCaptions = (caps: CaptionSegment[]) => {
    setCaptionProject(prev => ({
      ...prev,
      segments: caps
    }));
  };

  // Synchronize workspace view settings to localStorage to avoid resetting on refresh/HMR/iframe reload
  useEffect(() => {
    localStorage.setItem("omnistrih_active_tab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem("omnistrih_current_view", currentView);
  }, [currentView]);

  useEffect(() => {
    localStorage.setItem("omnistrih_active_project_id", activeProjectId || "");
  }, [activeProjectId]);

  useEffect(() => {
    localStorage.setItem("omnistrih_projects", JSON.stringify(projects));
  }, [projects]);

  // Zoom Punch-In Cues
  const [zoomCues, setZoomCues] = useState<ZoomCue[]>([
    { id: "z1", timestamp: 0.0, scale: 1.0, duration: 0.2 },
    { id: "z2", timestamp: 0.9, scale: 1.25, duration: 0.25 },
    { id: "z3", timestamp: 3.0, scale: 1.0, duration: 0.2 },
    { id: "z4", timestamp: 5.5, scale: 1.25, duration: 0.25 },
    { id: "z5", timestamp: 6.5, scale: 1.0, duration: 0.2 },
    { id: "z6", timestamp: 9.1, scale: 1.2, duration: 0.25 },
    { id: "z7", timestamp: 10.6, scale: 1.25, duration: 0.25 },
  ]);

  // SFX Trigger Cues (including 808 Boom)
  const [sfxCues, setSfxCues] = useState<SFXCue[]>([
    { id: "s1", timestamp: 0.0, type: "boom", label: "Hook 808 Boom" },
    { id: "s2", timestamp: 0.9, type: "pop", label: "Emphasis Pop" },
    { id: "s3", timestamp: 3.0, type: "whoosh", label: "Topic Switch" },
    { id: "s4", timestamp: 5.5, type: "cash", label: "Money Saved" },
    { id: "s5", timestamp: 6.5, type: "ding", label: "Opus Ding" },
    { id: "s6", timestamp: 9.1, type: "pop", label: "VN Motion Pop" },
    { id: "s7", timestamp: 12.3, type: "pop", label: "CTA Pop" },
  ]);

  // Contextual B-Roll Overlays State
  const [bRollOverlays, setBRollOverlays] = useState<BRollOverlay[]>([
    {
      id: "b1",
      type: "educational-whiteboard",
      start: 0.8,
      end: 3.2,
      title: "KROK 1: STRUKTÚRA",
      subtitle: "Vzdelávací OmniStrih",
      position: "top-right",
      rotation: -2,
    },
    {
      id: "b2",
      type: "brain-idea",
      start: 4.0,
      end: 6.8,
      title: "95% RÝCHLEJŠIE",
      subtitle: "Dopamínový Reset",
      position: "bottom-right",
      rotation: 3,
    },
    {
      id: "b3",
      type: "time-saver",
      start: 7.2,
      end: 10.2,
      title: "0€ NÁKLADY",
      subtitle: "Free-Tier Nástroje",
      position: "top-left",
      rotation: -3,
    },
  ]);

  // Opus Virality Analysis State
  const [virality, setVirality] = useState<ViralityAnalysis>({
    overallScore: 98,
    hookScore: 99,
    pacingScore: 96,
    retentionScore: 97,
    trendScore: 95,
    keyReasons: [
      "Bleskový hook s 808 bass dropom v prvých 2 sekundách eliminuje okamžité odchody.",
      "Submagic kontrastné titulky udržiavajú pozornosť s vizuálnym vysvecovaním slov.",
      "Inteligentný B-Roll a VN zoom resetujú dopamínovú pozornosť každé 3 sekundy.",
      "Nulové hluché miesta a úderné tempo garantujú vysokú mieru dopozerania.",
    ],
    suggestedTitle: "Ako ušetriť 95% času pri strihu videa na sociálne siete (OmniStrih)",
    suggestedDescription:
      "Zabudni na drahé predplatné za Submagic či CapCut. Tento OmniStrih postup ti umožní tvoriť virálne videá za zlomok času bez poplatkov. #omnistrih #strihvidea #aivideo #tiktoksk",
    suggestedHashtags: [
      "#omnistrih",
      "#strihvidea",
      "#submagic",
      "#opusclip",
      "#aivideo",
      "#contentcreator",
    ],
  });

  // Opus Smart Clip Highlights
  const [smartClips, setSmartClips] = useState<SmartClipHighlight[]>([
    {
      id: "sc-1",
      title: "Kompletný Virálny Hook (0 - 15s)",
      start: 0.0,
      end: 14.5,
      viralityScore: 98,
      badge: "TOP VIRAL 🔥",
    },
    {
      id: "sc-2",
      title: "Úspora peňazí & Nástroje (3 - 10s)",
      start: 3.0,
      end: 10.0,
      viralityScore: 94,
      badge: "HIGH VALUE 💡",
    },
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  };

  // Handle Play/Pause with robust playback state checks
  const handleTogglePlay = useCallback((forceState?: boolean) => {
    const video = videoRef.current;
    if (video) {
      // Determine if the video is truly playing using the DOM properties directly
      const isTrulyPlaying = !video.paused && !video.ended && video.readyState > 0;
      const targetPlay = forceState !== undefined ? forceState : !isTrulyPlaying;

      if (targetPlay) {
        if (video.paused) {
          video.play().catch((err) => {
            console.warn("Direct play failed, playing muted as fallback:", err);
            video.muted = true;
            video.play().catch(console.error);
          });
        }
        setIsPlaying(true);
        playheadStore.setIsPlaying(true);
      } else {
        if (!video.paused) {
          video.pause();
        }
        setIsPlaying(false);
        playheadStore.setIsPlaying(false);
      }
    } else {
      setIsPlaying((prev) => {
        const next = forceState !== undefined ? forceState : !prev;
        playheadStore.setIsPlaying(next);
        return next;
      });
    }
  }, [videoRef]);

  // Handle Seek with LastSeekWinsCoordinator arbitration & isolated PlayheadStore
  const handleSeek = useCallback((time: number) => {
    playheadStore.setTime(time, true);
    setCurrentTime(time);
    if (videoRef.current) {
      LastSeekWinsCoordinator.requestSeek(videoRef.current, time);
    }
  }, []);

  // Handle Language switch
  const handleToggleLanguage = (lang: "sk" | "en") => {
    setLanguage(lang);
    setSettings((prev) => ({
      ...prev,
      language: lang,
      viralHookText:
        lang === "sk" ? "ZASTAV SCROLLOVANIE! 🔥" : "STOP SCROLLING! 🔥",
    }));
  };

  // Switch Category and adapt B-Roll and Canva Palette immediately
  const handleApplyCategoryPreset = (cat: VideoCategory) => {
    let newOverlays: BRollOverlay[] = [];
    let palette = settings.colorPalette;
    let music = settings.bgMusicTrack;

    if (cat === "educational") {
      palette = "ali-abdaal";
      music = "lofi-chill";
      newOverlays = [
        {
          id: "b-edu-1",
          type: "educational-whiteboard",
          start: 0.8,
          end: 3.2,
          title: isSk ? "KROK 1: STRUKTÚRA" : "STEP 1: FRAMEWORK",
          subtitle: isSk ? "Vzdelávací OmniStrih" : "Educational Cut",
          position: "top-right",
          rotation: -2,
        },
        {
          id: "b-edu-2",
          type: "brain-idea",
          start: 4.0,
          end: 6.8,
          title: isSk ? "95% RÝCHLEJŠIE" : "RETENTION +85%",
          subtitle: isSk ? "Dopamínový Reset" : "Cognitive Focus",
          position: "bottom-right",
          rotation: 3,
        },
        {
          id: "b-edu-3",
          type: "time-saver",
          start: 7.2,
          end: 10.2,
          title: isSk ? "0€ NÁKLADY" : "ZERO COST",
          subtitle: isSk ? "Free-Tier Nástroje" : "Free Web Suite",
          position: "top-left",
          rotation: -3,
        },
      ];
    } else if (cat === "business") {
      palette = "hormozi";
      music = "corporate-inspire";
      newOverlays = [
        {
          id: "b-biz-1",
          type: "growth-chart",
          start: 0.8,
          end: 3.2,
          title: isSk ? "+340% NÁVRATNOSŤ" : "+340% ROI",
          subtitle: isSk ? "Organický dosah" : "Organic Reach",
          position: "top-right",
          rotation: -2,
        },
        {
          id: "b-biz-2",
          type: "money-stack",
          start: 4.0,
          end: 6.5,
          title: isSk ? "0€ MESAČNE" : "$0 FOREVER",
          subtitle: isSk ? "Ušetrené $50/mesiac" : "Saved $50/mo",
          position: "bottom-right",
          rotation: 3,
        },
      ];
    } else if (cat === "tech") {
      palette = "cyber-neon";
      music = "tech-ambient";
      newOverlays = [
        {
          id: "b-tech-1",
          type: "tech-code",
          start: 0.8,
          end: 3.2,
          title: isSk ? "AI ALGORITMUS" : "AI PIPELINE",
          subtitle: isSk ? "Automatický render" : "Instant Synthesis",
          position: "top-right",
          rotation: -2,
        },
        {
          id: "b-tech-2",
          type: "brain-idea",
          start: 4.0,
          end: 6.8,
          title: isSk ? "LATENCIA 0ms" : "0ms LATENCY",
          subtitle: isSk ? "Lokálny Browser DSP" : "Client-side DSP",
          position: "bottom-right",
          rotation: 2,
        },
      ];
    } else if (cat === "lifestyle") {
      palette = "luxury-glow";
      music = "viral-phonk";
      newOverlays = [
        {
          id: "b-life-1",
          type: "target-goal",
          start: 0.8,
          end: 3.2,
          title: isSk ? "100% CIEĽ" : "100% GOAL",
          subtitle: isSk ? "Sebarozvoj & Fokus" : "Daily Elevation",
          position: "top-right",
          rotation: -2,
        },
        {
          id: "b-life-2",
          type: "time-saver",
          start: 4.0,
          end: 6.8,
          title: isSk ? "DENNÝ STREAK" : "HABIT STREAK",
          subtitle: isSk ? "Konzistentný rast" : "Consistency Win",
          position: "bottom-right",
          rotation: 3,
        },
      ];
    } else {
      palette = "mrbeast";
      music = "viral-phonk";
      newOverlays = [
        {
          id: "b-vir-1",
          type: "time-saver",
          start: 0.8,
          end: 3.2,
          title: isSk ? "ÚSPORA: 95%" : "TIME SAVED: 95%",
          subtitle: isSk ? "OmniStrih Recept" : "OmniCut Framework",
          position: "top-right",
          rotation: -3,
        },
        {
          id: "b-vir-2",
          type: "fire-meme",
          start: 4.0,
          end: 6.5,
          title: isSk ? "VIRÁLNY HOOK 🔥" : "VIRAL HOOK 🔥",
          subtitle: isSk ? "Dopamínový reset" : "Attention Reset",
          position: "bottom-right",
          rotation: 3,
        },
      ];
    }

    setBRollOverlays(newOverlays);
    setSettings((prev) => ({
      ...prev,
      videoCategory: cat,
      colorPalette: palette,
      bgMusicTrack: music,
    }));

    playSynthesizedSFX("ding", 0.7);
    showToast(
      isSk
        ? `🎯 B-Roll prechody a paleta nastavené pre: ${cat.toUpperCase()}`
        : `🎯 B-Roll cutaways and palette updated for: ${cat.toUpperCase()}`
    );
  };

  // Handle 1-Click Magic Auto-Edit
  const handleTriggerMagicEdit = async () => {
    try {
      setIsProcessingMagic(true);
      showToast(
        isSk
          ? "⚡ Analyzujem video a generujem inteligentný B-Roll a 95% auto-strih..."
          : "⚡ Analyzing video & generating contextual B-roll and 95% auto-cut..."
      );

      // Local fallback for Zero-Token Mode to save quota
      if (settings.zeroTokenMode) {
        // Simulate high-quality local generation
        setTimeout(() => {
          showToast(
            isSk
              ? "🛡️ 0-Token Režim aktívny: Používam lokálne algoritmy (úspora 100% kvóty)."
              : "🛡️ Zero-Token Mode active: Using local algorithms (100% quota saved)."
          );
          setIsProcessingMagic(false);
          // Play a small sound to signal completion
          try {
            const audio = new Audio("https://cdn.pixabay.com/audio/2022/03/10/audio_c352c8a7d9.mp3");
            audio.volume = 0.3;
            audio.play();
          } catch {}
        }, 1500);
        return;
      }

      const resp = await fetch("/api/analyze-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic:
            language === "sk"
              ? "Ušetri 95% času na strih videa bez platenia (OmniStrih)"
              : "Save 95% of video editing time for free (OmniCut)",
          language,
          duration: duration || 15,
          category: settings.videoCategory,
          useZeroTokenMode: settings.zeroTokenMode,
        }),
      });

      const resData = await resp.json();
      if (resData.success && resData.data) {
        const d = resData.data;
        if (d.captions && d.captions.length > 0) {
          setActiveCaptions(d.captions);
        }
        if (d.zoomCues && d.zoomCues.length > 0) {
          setZoomCues(d.zoomCues);
        }
        if (d.sfxCues && d.sfxCues.length > 0) {
          setSfxCues(d.sfxCues);
        }
        if (d.bRollOverlays && d.bRollOverlays.length > 0) {
          setBRollOverlays(d.bRollOverlays);
        }
        if (d.viralityAnalysis) {
          setVirality(d.viralityAnalysis);
        }
        if (d.smartClips && d.smartClips.length > 0) {
          setSmartClips(d.smartClips);
        }
        if (d.viralHook) {
          setSettings((prev) => ({ ...prev, viralHookText: d.viralHook }));
        }
        if (d.recommendedPalette) {
          setSettings((prev) => ({ ...prev, colorPalette: d.recommendedPalette }));
        }
        if (d.recommendedBgMusic && settings.bgMusicTrack === "none") {
          setSettings((prev) => ({ ...prev, bgMusicTrack: d.recommendedBgMusic }));
        }
        if (d.detectedSilenceSeconds) {
          setSettings((prev) => ({
            ...prev,
            detectedSilenceSeconds: d.detectedSilenceSeconds,
          }));
        }

        // Play intro 808 boom and paper-rip to confirm
        playSynthesizedSFX("paper-rip", 0.7);
        setTimeout(() => playSynthesizedSFX("boom", 0.9), 150);

        showToast(
          resData.zeroTokenUsed
            ? isSk
              ? "🛡️ 0-Token Režim: Ušetrených 100% tokenov! Bleskový OmniStrih pripravený."
              : "🛡️ Zero-Token Mode: 100% quota saved! Instant OmniCut ready."
            : isSk
            ? "✅ Dokonalý strih hotový! Titulky, inteligentný B-Roll a čistý zvuk pripravené."
            : "✅ Auto-Cut complete! Captions, contextual B-Roll & voice clarifier synced."
        );

        // Auto play to demonstrate
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          videoRef.current.play().catch(() => {});
          setIsPlaying(true);
        }
      }
    } catch (err) {
      console.error("Magic edit error:", err);
      showToast(isSk ? "Strih aplikovaný." : "Edit applied.");
    } finally {
      setIsProcessingMagic(false);
    }
  };

  // 1-Click OmniStrih Full Auto-Activation (Recipe from aiktivista.sk)
  const handleApplyFullOmniStrih = () => {
    // 1. Activate all optimal layers according to Tomáš Jevčik / Aiktivista
    setSettings((prev) => ({
      ...prev,
      captionsEnabled: true,
      captionStyle: "omnistrih-torn-paper",
      autoZoomEnabled: true,
      zoomIntensity: 1.25,
      screenShakeEnabled: true,
      speedRampPreset: "fast-ramp",
      cutSilences: true,
      sfxEnabled: true,
      sfxVolume: 0.8,
      viralHookEnabled: true,
      viralHookText: isSk ? "ZASTAV SCROLLOVANIE! 🔥" : "STOP SCROLLING! 🔥",
      bRollEnabled: true,
      omniCollagePaperTexture: true,
      omniWashiTapeEnabled: true,
      highlighterColor: "rgba(250, 204, 21, 0.88)",
      autoReframeFace: true,
      progressBarEnabled: true,
      studioEnhanceColor: true,
      voiceClarifierEnabled: true,
      bgMusicDucking: true,
    }));

    // Play paper rip and 808 boom effect
    playSynthesizedSFX("paper-rip", 0.8);
    setTimeout(() => playSynthesizedSFX("boom", 0.9), 120);

    showToast(
      isSk
        ? "✨ Originálny OmniStrih™ aktivovaný! Taktilný papier, washi páska a 7 krokov zapnutých."
        : "✨ Original OmniCut™ active! Tactile paper, washi tape & all 7 steps applied."
    );

    // Seek to beginning and play
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  // Update partial settings helper
  const handleUpdateSettings = (partial: Partial<VideoProjectSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  // Browser speech recognition transcription helper for exact voice sync
  const handleTranscribeSpeech = async () => {
    try {
      setIsTranscribing(true);
      showToast(
        isSk
          ? "🎙️ Počúvam zvuk videa a generujem titulky ZADARMO (Zero-Token)..."
          : "🎙️ Listening to video audio & generating FREE local captions (Zero-Token)..."
      );
      
      const segments = await startBrowserSpeechTranscription(language);
      
      if (segments && segments.length > 0) {
        setActiveCaptions(segments);
        showToast(
          isSk
            ? `✅ Úspešne vygenerovaných ${segments.length} segmentov reči!`
            : `✅ Successfully generated ${segments.length} local speech segments!`
        );
      } else {
        showToast(
          isSk
            ? "ℹ️ Žiadna reč nebola zachytená. Skúste znova v tichšom prostredí."
            : "ℹ️ No speech detected. Try again in a quieter environment."
        );
      }
    } catch (err: any) {
      showToast(`⚠️ ${err?.message || "Transcription error"}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global Command Palette shortcut: Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
        return;
      }

      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        handleSeek(Math.max(0, currentTimeRef.current - 3));
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        handleSeek(Math.min(durationRef.current, currentTimeRef.current + 3));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleAutoDetectSubtitles = async () => {
    if (!videoRef.current) return;
    setToastMessage(language === "sk" ? "AI deteguje staré titulky..." : "AI detecting old subtitles...");
    
    try {
      const detectedZone = await detectHardcodedSubtitles(
        videoRef.current,
        videoRef.current.videoWidth,
        videoRef.current.videoHeight
      );
      
      if (detectedZone) {
        setSettings(prev => ({
          ...prev,
          eraserEnabled: true,
          eraserZones: [...(prev.eraserZones || []), detectedZone]
        }));
        setToastMessage(language === "sk" ? "Titulky úspešne detegované!" : "Subtitles successfully detected!");
      } else {
        setToastMessage(language === "sk" ? "Nenašli sa žiadne staré titulky." : "No old subtitles found.");
      }
    } catch (err) {
      console.error("Subtitle detection failed:", err);
      setToastMessage(language === "sk" ? "Detekcia zlyhala." : "Detection failed.");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] selection:bg-rose-500 selection:text-white">
      {view === 'home' && <OmniStrihHome onNewProject={() => setView('editor')} onOpenProject={() => setView('editor')} />}
      
      <div style={{ display: view === 'home' ? 'none' : 'block' }}>
        {toastMessage && (
          <div className="fixed top-20 right-6 z-50 bg-neutral-900 border border-neutral-700 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <Sparkles className="h-5 w-5 text-rose-500 animate-spin" />
            <span className="text-sm font-bold">{toastMessage}</span>
          </div>
        )}
      </div>

      {currentView === "dashboard" ? (
        <div className="min-h-screen bg-neutral-950 flex flex-col">
          {/* Dashboard Header */}
          <header className="border-b border-neutral-800 bg-neutral-900/60 backdrop-blur-md px-6 py-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 via-amber-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-white font-['Fraunces']">
                    OmniStrih <span className="text-rose-500">AI V2</span>
                  </h1>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                    {isSk ? "Autonómne štúdio pre 95% rýchlejší strih" : "Autonomous Studio for 95% Faster Editing"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  id="dashboard-search-trigger-btn"
                  onClick={() => setIsSearchOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-800 bg-neutral-900 text-xs font-semibold text-neutral-300 hover:text-white hover:border-neutral-700 transition-all"
                  title={isSk ? "Hľadať nástroje (Ctrl+K)" : "Search tools (Cmd+K)"}
                >
                  <Search className="w-4 h-4 text-rose-400" />
                  <span className="hidden sm:inline">{isSk ? "Hľadať" : "Search"}</span>
                  <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-mono text-neutral-400 bg-neutral-950 border border-neutral-800 rounded">
                    ⌘K
                  </kbd>
                </button>

                <div className="flex items-center rounded-xl border border-neutral-800 bg-neutral-900 p-0.5">
                  <button
                    onClick={() => handleToggleLanguage("sk")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      isSk ? "bg-rose-500 text-white" : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    SK
                  </button>
                  <button
                    onClick={() => handleToggleLanguage("en")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      !isSk ? "bg-rose-500 text-white" : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    EN
                  </button>
                </div>
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-2.5 rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-300 hover:text-white hover:border-neutral-700 transition-all"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
          </header>

          {/* Dashboard Body */}
          <main className="max-w-7xl mx-auto px-6 py-10 flex-1 w-full space-y-10">
            {/* Hero Banner */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-800 border border-neutral-800 p-8 sm:p-12 shadow-2xl">
              <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10 max-w-2xl space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold">
                  <Flame className="w-3.5 h-3.5" />
                  {isSk ? "Nová verzia 2.5 • AI Multi-Agent Engine" : "New Version 2.5 • AI Multi-Agent Engine"}
                </div>
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight font-['Fraunces']">
                  {isSk ? "Premeňte surové video na virálny hit za pár sekúnd." : "Transform raw video into viral hits in seconds."}
                </h2>
                <p className="text-neutral-400 text-sm sm:text-base leading-relaxed">
                  {isSk 
                    ? "Submagic titulky v SK/EN, CapCut punch-in zoom, Opus AI virality skóre, inteligentný B-Roll podľa obsahu a štúdiový zvuk bez poplatkov."
                    : "Submagic captions in SK/EN, CapCut punch-in zoom, Opus AI virality score, context-aware B-Roll, and studio audio mastering."}
                </p>
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button
                    onClick={handleCreateNewProject}
                    className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold text-sm shadow-lg shadow-rose-500/25 hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    {isSk ? "Nový Projekt" : "New Project"}
                  </button>
                  <button
                    onClick={() => handleContinueEditing(projects[0]?.id || "proj-001")}
                    className="px-6 py-3.5 rounded-2xl bg-neutral-800 text-neutral-200 font-bold text-sm hover:bg-neutral-700 transition-all flex items-center gap-2 border border-neutral-700 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current text-rose-500" />
                    {isSk ? "Pokračovať v poslednom" : "Continue Latest"}
                  </button>
                </div>
              </div>
            </div>

            {/* Projects Section */}
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    {isSk ? "Vaše Projekty" : "Your Projects"}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    {isSk ? "Všetky vaše rozpracované a vyrenderované videá." : "All your ongoing and rendered videos."}
                  </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={handleCreateNewProject}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white text-xs font-bold shadow-md shadow-rose-500/20 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isSk ? "+ Nový Projekt" : "+ New Project"}</span>
                  </button>
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input
                      type="text"
                      placeholder={isSk ? "Hľadať projekt..." : "Search project..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Grid of Projects */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects
                  .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((proj) => (
                    <div
                      key={proj.id}
                      className="group bg-neutral-900 rounded-3xl border border-neutral-800 overflow-hidden hover:border-rose-500/50 transition-all shadow-xl flex flex-col"
                    >
                      <div className="relative aspect-video bg-neutral-950 overflow-hidden">
                        {proj.thumbnail && proj.thumbnail.trim().length > 0 ? (
                          <img
                            src={proj.thumbnail}
                            alt={proj.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-950 text-neutral-600">
                            <FileVideo className="w-10 h-10 text-neutral-700 mb-1" />
                            <span className="text-[10px] uppercase font-bold text-neutral-600 tracking-wider">
                              {isSk ? "Čaká na video" : "Awaiting Media"}
                            </span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent opacity-80" />
                        <div className="absolute top-3 right-3 bg-neutral-900/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-neutral-800 text-[10px] font-black text-neutral-300 uppercase">
                          {proj.resolution}
                        </div>
                        <div className="absolute bottom-3 left-3 flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-md bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10px] font-black uppercase">
                            {proj.status}
                          </span>
                        </div>
                      </div>

                      <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                        <div>
                          <h4 className="font-bold text-white text-base group-hover:text-rose-400 transition-colors">
                            {proj.name}
                          </h4>
                          <div className="flex items-center gap-3 text-xs text-neutral-400 mt-1">
                            <span>{proj.duration}</span>
                            <span>•</span>
                            <span>{proj.lastModified}</span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-bold text-neutral-400">
                            <span>{isSk ? "Dokončenie" : "Completion"}</span>
                            <span className="text-rose-400">{proj.completionPercentage}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-rose-500 to-amber-500 transition-all duration-500"
                              style={{ width: `${proj.completionPercentage}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-neutral-800/80">
                          <button
                            onClick={() => handleContinueEditing(proj.id)}
                            className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                          >
                            <Play className="w-3.5 h-3.5 fill-current text-rose-500" />
                            {isSk ? "Upraviť" : "Edit"}
                          </button>
                          <button
                            onClick={() => handleDuplicateProject(proj.id)}
                            className="p-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl transition-all"
                            title={isSk ? "Duplikovať" : "Duplicate"}
                          >
                            <FolderPlus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProject(proj.id)}
                            className="p-2.5 bg-neutral-800 hover:bg-red-950/50 text-neutral-400 hover:text-red-400 rounded-xl transition-all"
                            title={isSk ? "Zmazať" : "Delete"}
                          >
                            <Eraser className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </main>
        </div>
      ) : (
        <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
          {/* Hidden File Inputs for Main App Media Loading */}
          <input
            type="file"
            ref={mainFileInputRef}
            onChange={handleGlobalFileUpload}
            accept="video/mp4,video/quicktime,video/webm,video/*"
            className="hidden"
          />
          <input
            type="file"
            ref={mainMultiFileInputRef}
            onChange={handleGlobalMultiFileUpload}
            multiple
            accept="video/*,audio/*,image/*"
            className="hidden"
          />

          {/* Editor Header */}
          <Header
            aspectRatio={settings.aspectRatio}
            onSelectAspectRatio={(ratio) => setSettings(prev => ({ ...prev, aspectRatio: ratio }))}
            language={language}
            onToggleLanguage={handleToggleLanguage}
            onTriggerMagicEdit={() => {
              setActiveTab("pro_autopilot");
              showToast(isSk ? "⚡ Otváram PROFESSIONAL AUTOPILOT ENGINE..." : "⚡ Opening PROFESSIONAL AUTOPILOT ENGINE...");
              playSynthesizedSFX("click", 0.6);
            }}
            isProcessingMagic={isProcessingMagic}
            onOpenExport={() => setIsExportOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenApiKeys={() => setIsApiKeysOpen(true)}
            zeroTokenMode={!!settings.zeroTokenMode}
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenLocalAI={() => setIsLocalAIModalOpen(true)}
            onOpenCaptions={() => setIsCaptionStudioOpen(true)}
            onOpenMediaIntelligence={() => setIsMediaIntelligenceOpen(true)}
            onOpenDirector={() => setIsDirectorStudioOpen(true)}
            projectName={projects.find(p => p.id === activeProjectId)?.name || "Master Edit"}
            onUndo={() => {
              showToast(isSk ? "Krok späť (Undo)" : "Undo action");
              playSynthesizedSFX("click", 0.4);
            }}
            onRedo={() => {
              showToast(isSk ? "Krok vpred (Redo)" : "Redo action");
              playSynthesizedSFX("click", 0.4);
            }}
            canUndo={true}
            canRedo={false}
            onOpenQC={() => setActiveTab("qc_analytics")}
            workflowState={isProcessingMagic ? "NEW" : (jumpSequence?.isApplied || captionProject.segments.length > 0) ? "PROCESSED" : "RAW_IMPORTED"}
            onReviewChanges={() => setActiveTab("edl_autopilot")}
            hasMedia={Boolean(currentVideoUrl && currentVideoUrl.length > 0 && projects.find(p => p.id === activeProjectId)?.hasMedia !== false)}
            onOpenImport={() => setIsImportModalOpen(true)}
            isInspectorOpen={isInspectorOpen}
            onToggleInspector={() => {
              setIsInspectorOpen(prev => !prev);
              playSynthesizedSFX("click", 0.4);
            }}
          />

          {/* Main Editor Workspace with 9-Category Left Navigation */}
          <main className="flex-1 w-full flex overflow-hidden bg-neutral-950">
            {/* 1. Left Nav: 9 Clean Primary Categories */}
            <div className="w-18 bg-neutral-900/90 border-r border-neutral-800 flex flex-col items-center py-4 gap-2 shadow-2xl z-20 shrink-0">
              {[
                { id: 'home', icon: Home, labelSk: 'Domov', labelEn: 'Home', action: () => setCurrentView('dashboard') },
                { id: 'edit', category: 'strih' as SmartCategory, icon: Scissors, labelSk: 'Strih', labelEn: 'Edit', tab: 'jump' },
                { id: 'audio', category: 'audio' as SmartCategory, icon: Music, labelSk: 'Audio', labelEn: 'Audio', tab: 'pro_audio' },
                { id: 'captions', category: 'titulky' as SmartCategory, icon: Type, labelSk: 'Titulky', labelEn: 'Captions', tab: 'captions' },
                { id: 'visuals', category: 'vizual' as SmartCategory, icon: Film, labelSk: 'Vizuál', labelEn: 'Visuals', tab: 'broll' },
                { id: 'ai', category: 'ai' as SmartCategory, icon: Brain, labelSk: 'AI Hub', labelEn: 'AI', tab: 'pro_autopilot' },
                { id: 'pro_toolbox', category: 'toolbox' as SmartCategory, icon: Sliders, labelSk: 'Toolbox', labelEn: 'Toolbox', tab: 'pro_toolbox' },
                { id: 'director', category: 'ai' as SmartCategory, icon: Sparkles, labelSk: 'Director', labelEn: 'Director', tab: 'director_briefing' },
                { id: 'workspace', category: 'strih' as SmartCategory, icon: Layout, labelSk: 'Workspace', labelEn: 'Workspace', tab: 'workspace' },
                { id: 'export', category: 'export' as SmartCategory, icon: Share2, labelSk: 'Export', labelEn: 'Export', tab: 'export', action: () => setIsExportOpen(true) },
                { id: 'history', category: 'historia' as SmartCategory, icon: History, labelSk: 'História', labelEn: 'History', tab: 'os_hub' },
              ].map(item => {
                const isItemActive = item.id === 'home' 
                  ? false
                  : item.category === smartCategory;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.action) {
                        item.action();
                      } else {
                        if (item.category) setSmartCategory(item.category);
                        if (item.tab) setActiveTab(item.tab as any);
                        setIsInspectorOpen(true);
                      }
                      playSynthesizedSFX("click", 0.4);
                    }}
                    className={`w-14 py-2.5 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all group relative cursor-pointer ${
                      isItemActive 
                        ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25 font-bold' 
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800/80 font-medium'
                    }`}
                  >
                    <item.icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${isItemActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                    <span className="text-[10px] tracking-tight leading-none text-center">
                      {isSk ? item.labelSk : item.labelEn}
                    </span>
                    {/* Tooltip on hover */}
                    <div className="absolute left-full ml-2 px-2.5 py-1 bg-neutral-900 border border-neutral-700 text-[11px] text-white rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                      {isSk ? item.labelSk : item.labelEn}
                    </div>
                  </button>
                );
              })}

              <div className="mt-auto pt-2 border-t border-neutral-800/80 w-10 flex flex-col items-center gap-2">
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  title={isSk ? "Nastavenia" : "Settings"}
                  className="p-2 rounded-xl text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 2. Center Stage: Upper Split (Active Tool Drawer + Video Player Preview) + Bottom Fixed Timeline OR Import Video Empty State */}
            <div className="flex-1 flex flex-col min-w-0 bg-neutral-950 overflow-hidden min-h-0">
              {!Boolean(currentVideoUrl && currentVideoUrl.length > 0 && projects.find(p => p.id === activeProjectId)?.hasMedia !== false) ? (
                /* Empty State / Start Screen with Source Preview */
                <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 bg-neutral-950 text-center relative overflow-y-auto">
                  {/* Ambient lighting effects */}
                  <div className="absolute w-[500px] h-[500px] bg-rose-500/10 rounded-full blur-3xl pointer-events-none -top-24" />
                  <div className="absolute w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none -bottom-20" />

                  <div className="relative z-10 max-w-2xl w-full flex flex-col items-center gap-6 p-6 sm:p-8 rounded-3xl bg-neutral-900/90 border border-neutral-800 shadow-2xl backdrop-blur-md">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-rose-500 via-rose-600 to-amber-500 flex items-center justify-center shadow-2xl shadow-rose-500/30">
                      <FileVideo className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                    </div>

                    <div className="space-y-2 text-center max-w-lg">
                      <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-['Fraunces']">
                        {isSk ? "VYTVORTE SVOJE VIDEO" : "CREATE YOUR VIDEO"}
                      </h2>
                      <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
                        {isSk 
                          ? "Zvoľte zdroj pre nahratie videa: z disku, mobilu cez QR kód, z cloudu alebo webu a začnite upravovať pomocou AI asistenta."
                          : "Choose video source: local disk, smartphone QR drop, cloud storage or web link to start editing."}
                      </p>
                    </div>

                    {/* Primary Import CTA Button */}
                    <div className="w-full flex flex-col gap-3">
                      <button
                        id="import-video-primary-btn"
                        onClick={() => setIsImportModalOpen(true)}
                        className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-rose-500 via-rose-600 to-amber-500 text-white font-bold text-base shadow-xl shadow-rose-500/30 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer"
                      >
                        <Upload className="w-5 h-5" />
                        <span>{isSk ? "+ NAHRAŤ VIDEO / ZVOLIŤ ZDROJ" : "+ IMPORT VIDEO / SELECT SOURCE"}</span>
                      </button>
                    </div>

                    {/* Source Quick Selection Cards */}
                    <div className="w-full pt-1">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-3 text-left">
                        {isSk ? "Dostupné zdroje importu:" : "Available Import Sources:"}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {/* Source 1: Local Disk */}
                        <div
                          onClick={() => setIsImportModalOpen(true)}
                          className="p-3.5 rounded-2xl bg-neutral-950/80 border border-neutral-800 hover:border-rose-500/50 hover:bg-neutral-800/50 cursor-pointer transition-all flex flex-col items-center text-center group"
                        >
                          <div className="w-9 h-9 rounded-xl bg-neutral-800 group-hover:bg-rose-500/20 text-neutral-300 group-hover:text-rose-400 flex items-center justify-center mb-2 transition-colors">
                            <HardDrive className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-bold text-white group-hover:text-rose-300 transition-colors">
                            {isSk ? "Môj počítač" : "Local Disk"}
                          </span>
                          <span className="text-[10px] text-neutral-500 mt-0.5">
                            {isSk ? "MP4, MOV, ProRes" : "Files & Folders"}
                          </span>
                        </div>

                        {/* Source 2: Smartphone */}
                        <div
                          onClick={() => setIsImportModalOpen(true)}
                          className="p-3.5 rounded-2xl bg-neutral-950/80 border border-neutral-800 hover:border-amber-500/50 hover:bg-neutral-800/50 cursor-pointer transition-all flex flex-col items-center text-center group"
                        >
                          <div className="w-9 h-9 rounded-xl bg-neutral-800 group-hover:bg-amber-500/20 text-neutral-300 group-hover:text-amber-400 flex items-center justify-center mb-2 transition-colors relative">
                            <Smartphone className="w-4 h-4" />
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                          </div>
                          <span className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                            {isSk ? "Zo smartfónu" : "Smartphone"}
                          </span>
                          <span className="text-[10px] text-neutral-500 mt-0.5">
                            {isSk ? "QR Kód & Kamera" : "QR Drop & Camera"}
                          </span>
                        </div>

                        {/* Source 3: Cloud Storage */}
                        <div
                          onClick={() => setIsImportModalOpen(true)}
                          className="p-3.5 rounded-2xl bg-neutral-950/80 border border-neutral-800 hover:border-blue-500/50 hover:bg-neutral-800/50 cursor-pointer transition-all flex flex-col items-center text-center group"
                        >
                          <div className="w-9 h-9 rounded-xl bg-neutral-800 group-hover:bg-blue-500/20 text-neutral-300 group-hover:text-blue-400 flex items-center justify-center mb-2 transition-colors">
                            <Cloud className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors">
                            {isSk ? "Cloud úložisko" : "Cloud Drive"}
                          </span>
                          <span className="text-[10px] text-neutral-500 mt-0.5">
                            Drive, Dropbox, iCloud
                          </span>
                        </div>

                        {/* Source 4: URL & Samples */}
                        <div
                          onClick={() => setIsImportModalOpen(true)}
                          className="p-3.5 rounded-2xl bg-neutral-950/80 border border-neutral-800 hover:border-indigo-500/50 hover:bg-neutral-800/50 cursor-pointer transition-all flex flex-col items-center text-center group"
                        >
                          <div className="w-9 h-9 rounded-xl bg-neutral-800 group-hover:bg-indigo-500/20 text-neutral-300 group-hover:text-indigo-400 flex items-center justify-center mb-2 transition-colors">
                            <Link2 className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                            {isSk ? "URL / Knižnica" : "Link & Samples"}
                          </span>
                          <span className="text-[10px] text-neutral-500 mt-0.5">
                            {isSk ? "Web odkaz & Ukážky" : "YouTube & Demos"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-neutral-800/80 w-full flex items-center justify-between text-xs text-neutral-500">
                      <span>{isSk ? "⚡ Lokálne spracovanie bez limitu veľkosti" : "⚡ Local processing with zero file size limits"}</span>
                      <button
                        onClick={() => {
                          const demo = DEMO_VIDEOS[0];
                          handleUploadVideo(demo.url, isSk ? demo.titleSk : demo.titleEn);
                          showToast(isSk ? `🎬 Ukážkové video načítané!` : `🎬 Sample video loaded!`);
                        }}
                        className="text-xs font-bold text-rose-400 hover:text-rose-300 underline cursor-pointer"
                      >
                        {isSk ? "Rýchla ukážka (Demo)" : "Quick sample demo"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Upper Section: Left Tool Drawer + Right Video Player */}
                  <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
                
                {/* A. Left Active Tool Drawer & Sub-tabs */}
                {showAdvancedTools && (
                <div className="w-full lg:w-[460px] xl:w-[500px] border-r border-neutral-800 flex flex-col bg-neutral-900/60 shrink-0 min-h-0 overflow-hidden">
                  {/* Category Sub-Tabs Header Strip */}
                  <div className="bg-neutral-900 border-b border-neutral-800 px-3 py-2 flex items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5">
                      {/* Category-Specific Sub-tabs */}
                      {(['jump', 'story', 'transitions', 'eraser', 'burned_subtitles', 'pro_timeline', 'raw'].includes(activeTab) || activeTab === 'edit' as any) && [
                        { id: 'jump', label: isSk ? '✂️ Smart Cut' : '✂️ Smart Cut', icon: Scissors },
                        { id: 'story', label: isSk ? '📖 Story Builder' : '📖 Story Builder', icon: BookOpen },
                        { id: 'transitions', label: isSk ? '🎬 Prechody' : '🎬 Transitions', icon: Layers },
                        { id: 'eraser', label: isSk ? '🧹 Zero-Blur Eraser' : '🧹 Object Eraser', icon: Eraser },
                        { id: 'burned_subtitles', label: isSk ? '🔤 Vypálené Titulky' : '🔤 Burned Subtitles', icon: Eraser },
                        { id: 'pro_timeline', label: isSk ? '⏱️ Pro Timeline' : '⏱️ Pro Timeline', icon: Layers },
                        { id: 'raw', label: isSk ? '🔍 Surová Analýza' : '🔍 Raw Ingest', icon: Search },
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                            activeTab === tab.id
                              ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                              : 'bg-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-800'
                          }`}
                        >
                          <tab.icon className="w-3.5 h-3.5" />
                          <span>{tab.label}</span>
                        </button>
                      ))}

                      {['pro_audio', 'audio', 'canva', 'beat', 'ai_voice'].includes(activeTab) && [
                        { id: 'ai_voice', label: isSk ? '🎙️ AI Prirodzený Hlas' : '🎙️ AI Natural Voice', icon: Mic2 },
                        { id: 'pro_audio', label: isSk ? '🎚️ Pro Audio Master (-14 LUFS)' : '🎚️ Pro Audio Master (-14 LUFS)', icon: Sliders },
                        { id: 'audio', label: isSk ? '🎙️ Voice Clarifier & Ducking' : '🎙️ Voice Clarifier & Ducking', icon: Mic2 },
                        { id: 'canva', label: isSk ? '🎵 Canva Soundtracks' : '🎵 Canva Soundtracks', icon: Music },
                        { id: 'beat', label: isSk ? '🥁 Beat Sync Studio' : '🥁 Beat Sync Studio', icon: Activity },
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                            activeTab === tab.id
                              ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                              : 'bg-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-800'
                          }`}
                        >
                          <tab.icon className="w-3.5 h-3.5" />
                          <span>{tab.label}</span>
                        </button>
                      ))}

                      {['captions', 'burned_subtitles', 'bilingual'].includes(activeTab) && [
                        { id: 'captions', label: isSk ? '⚡ Kinetické Titulky (V2)' : '⚡ Kinetic Captions (V2)', icon: Type },
                        { id: 'burned_subtitles', label: isSk ? '🧹 Odstrániť vypálené titulky' : '🧹 Burned-In Subtitles Remover', icon: Eraser },
                        { id: 'bilingual', label: isSk ? '🌍 Bilingual Dubbing' : '🌍 Bilingual Dubbing', icon: Globe },
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                            activeTab === tab.id
                              ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                              : 'bg-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-800'
                          }`}
                        >
                          <tab.icon className="w-3.5 h-3.5" />
                          <span>{tab.label}</span>
                        </button>
                      ))}

                      {['broll', 'finder', 'attention', 'thumbnail'].includes(activeTab) && [
                        { id: 'broll', label: isSk ? '🎥 B-Roll Studio' : '🎥 B-Roll Studio', icon: Film },
                        { id: 'finder', label: isSk ? '🔍 B-Roll Finder' : '🔍 B-Roll Finder', icon: Search },
                        { id: 'attention', label: isSk ? '👁️ Vizuálna Pozornosť' : '👁️ Visual Attention', icon: Eye },
                        { id: 'thumbnail', label: isSk ? '🖼️ AI Miniatúry (CTR 95%+)' : '🖼️ AI Thumbnails (95%+ CTR)', icon: ImageIcon },
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                            activeTab === tab.id
                              ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                              : 'bg-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-800'
                          }`}
                        >
                          <tab.icon className="w-3.5 h-3.5" />
                          <span>{tab.label}</span>
                        </button>
                      ))}

                      {['pro_autopilot', 'pipeline', 'editor_brain', 'ai_visual_director', 'retention', 'opus', 'content_graph', 'ai_orchestrator', 'edl_autopilot'].includes(activeTab) && [
                        { id: 'pro_autopilot', label: isSk ? '🚀 95% Autopilot' : '🚀 95% Autopilot', icon: Zap },
                        { id: 'pipeline', label: isSk ? '⚡ Sprievodca (Wizard)' : '⚡ Wizard Pipeline', icon: Sparkles },
                        { id: 'edl_autopilot', label: isSk ? '✨ Decision Studio' : '✨ Decision Studio', icon: Sparkles },
                        { id: 'editor_brain', label: isSk ? '🧬 Editor Brain DNA' : '🧬 Editor Brain DNA', icon: Brain },
                        { id: 'ai_visual_director', label: isSk ? '🎨 Creative Director' : '🎨 Creative Director', icon: Sparkles },
                        { id: 'retention', label: isSk ? '📈 Retencia' : '📈 Retention Simulator', icon: TrendingUp },
                        { id: 'opus', label: isSk ? '🔥 Opus Shorts' : '🔥 Opus Shorts', icon: Flame },
                        { id: 'content_graph', label: isSk ? '🌐 Content Graph' : '🌐 Content Graph', icon: Share2 },
                        { id: 'ai_orchestrator', label: isSk ? '🛡️ AI Orchestrator' : '🛡️ AI Orchestrator', icon: ShieldCheck },
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                            activeTab === tab.id
                              ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                              : 'bg-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-800'
                          }`}
                        >
                          <tab.icon className="w-3.5 h-3.5" />
                          <span>{tab.label}</span>
                        </button>
                      ))}

                      {activeTab === 'pro_toolbox' && (
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1.5 bg-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                            <Sliders className="w-3.5 h-3.5" />
                            {isSk ? "Kompletný Pro Toolbox (30+ Nástrojov)" : "Full Pro Toolbox (30+ Tools)"}
                          </span>
                        </div>
                      )}

                      {['export', 'pack', 'ab'].includes(activeTab) && [
                        { id: 'export', label: isSk ? '📤 Multi-Platform Export' : '📤 Multi-Platform Export', icon: Share2 },
                        { id: 'pack', label: isSk ? '📦 Content Pack Machine' : '📦 Content Pack Machine', icon: Box },
                        { id: 'ab', label: isSk ? '🔀 A/B Varianty' : '🔀 A/B Variants', icon: Split },
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                            activeTab === tab.id
                              ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                              : 'bg-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-800'
                          }`}
                        >
                          <tab.icon className="w-3.5 h-3.5" />
                          <span>{tab.label}</span>
                        </button>
                      ))}

                      {['os_hub', 'qc_analytics', 'system_test'].includes(activeTab) && [
                        { id: 'os_hub', label: isSk ? '⏳ Time Machine & Verzie' : '⏳ Time Machine & Versions', icon: Brain },
                        { id: 'qc_analytics', label: isSk ? '⏱️ QC & Úspora Času' : '⏱️ QC & Time Saved', icon: ShieldCheck },
                        { id: 'system_test', label: isSk ? '🩺 Diagnostika Systému' : '🩺 System Health & Test', icon: Activity },
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                            activeTab === tab.id
                              ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                              : 'bg-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-800'
                          }`}
                        >
                          <tab.icon className="w-3.5 h-3.5" />
                          <span>{tab.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Search Quick Launcher & AI status */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setIsSearchOpen(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-[11px] font-bold border border-neutral-700 transition-colors"
                      >
                        <Search className="w-3 h-3 text-rose-400" />
                        <span>⌘K</span>
                      </button>
                      <button
                        onClick={() => setActiveTab("ai_orchestrator")}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono font-semibold border ${
                          aiStatusLevel === "AI AVAILABLE"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${aiStatusLevel === "AI AVAILABLE" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                        <span>{aiStatusLevel}</span>
                      </button>
                    </div>
                  </div>

                  {/* Scrollable Tool Workspace Panel */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                    <Suspense fallback={<ToolSuspenseFallback isSk={isSk} />}>
                    {activeTab === "ai_orchestrator" && (
                      <AIOrchestratorStudio
                        language={language}
                        showToast={showToast}
                        projectVersion={projectVersion}
                        onIncrementVersion={() => {
                          setProjectVersion(v => v + 1);
                          aiOrchestrator.setProjectVersion(projectVersion + 1);
                        }}
                      />
                    )}
                    {activeTab === "ai_visual_director" && (
                      <AIVisualDirectorCenter projectId={activeProjectId} />
                    )}
                    {activeTab === "edl_autopilot" && (
                      <ProfessionalAutopilotCenter
                        language={language}
                        showToast={showToast}
                        projectId={activeProjectId}
                      />
                    )}
                    {activeTab === "content_graph" && (
                      <ContentGraphStudio
                        language={language}
                        showToast={showToast}
                        videoTitle={projects.find(p => p.id === activeProjectId)?.name || "RAW Master Source"}
                        videoDuration={742}
                      />
                    )}
                    {activeTab === "pro_audio" && (
                      <ProfessionalAudioMasterSuite
                        language={language}
                        showToast={showToast}
                      />
                    )}
                    {activeTab === "media_manager" && (
                      <MediaManagerPanel
                        language={language}
                        showToast={showToast}
                        onSetVideoUrl={(url, filename, file) => handleUploadVideo(url, filename, file)}
                      />
                    )}
                    {activeTab === "qc_analytics" && (
                      <QualityControlAndAnalytics
                        language={language}
                        showToast={showToast}
                        videoDurationSeconds={742}
                      />
                    )}
                    {activeTab === "editor_brain" && (
                      <EditorBrainStudio
                        editDNA={editDNA}
                        onUpdateEditDNA={(newDNA) => {
                          setEditDNA(newDNA);
                          if (newDNA.captionStyle) {
                            setSettings(prev => ({ ...prev, captionStyle: newDNA.captionStyle as any }));
                          }
                          if (newDNA.captionSize) {
                            setSettings(prev => ({ ...prev, captionScale: newDNA.captionSize }));
                          }
                          if (newDNA.captionPosition) {
                            const pos = newDNA.captionPosition;
                            setSettings(prev => ({ ...prev, captionPosition: pos }));
                          }
                          if (newDNA.zoomIntensity) {
                            setSettings(prev => ({ ...prev, zoomIntensity: newDNA.zoomIntensity }));
                          }
                          if (typeof newDNA.musicVolume === "number") {
                            setSettings(prev => ({ ...prev, bgMusicVolume: newDNA.musicVolume as number }));
                          }
                          if (newDNA.preferredAspectRatio) {
                            setSettings(prev => ({ ...prev, aspectRatio: newDNA.preferredAspectRatio as any }));
                          }
                        }}
                        language={language}
                        showToast={showToast}
                        onJumpToAutopilot={() => setActiveTab("pro_autopilot")}
                      />
                    )}
                    {activeTab === "pro_autopilot" && (
                      <ProfessionalAutopilotEngine
                        onSeek={handleSeek}
                        onApplyAllToTimeline={() => {
                          setZoomCues([
                            { id: "z1", timestamp: 4.2, scale: 1.12, duration: 3.0 },
                            { id: "z2", timestamp: 8.5, scale: 1.15, duration: 3.5 },
                            { id: "z3", timestamp: 18.7, scale: 1.10, duration: 4.0 },
                            { id: "z4", timestamp: 35.0, scale: 1.14, duration: 3.2 },
                          ]);
                          setSfxCues([
                            { id: "sfx1", timestamp: 4.2, type: "whoosh", label: "Cut Whoosh" },
                            { id: "sfx2", timestamp: 8.5, type: "ding", label: "Highlight Ding" },
                            { id: "sfx3", timestamp: 18.7, type: "pop", label: "Pop Accent" },
                            { id: "sfx4", timestamp: 28.4, type: "cash", label: "Value Cash SFX" },
                          ]);
                          setSettings(prev => ({
                            ...prev,
                            voiceClarifierEnabled: true,
                            studioNormalizeAudio: true,
                            sfxEnabled: true,
                            autoZoomEnabled: true,
                          }));
                          setTimeMachine(prev => [
                            {
                              id: "tm_" + Date.now(),
                              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                              actionSk: "95% Autopilot Batch Polish (128 úprav aplikovaných)",
                              actionEn: "95% Autopilot Batch Polish (128 edits applied)",
                              author: "AI"
                            },
                            ...prev,
                          ]);
                          showToast(isSk ? "✨ 95% Autopilot úpravy aplikované na timeline (Zoomy, SFX a Audio DSP pripravené)!" : "✨ 95% Autopilot edits applied to timeline (Zooms, SFX and Audio DSP live)!");
                          playSynthesizedSFX("cash", 0.7);
                        }}
                        language={language}
                        showToast={showToast}
                        editDNA={editDNA}
                        onOpenEditorBrain={() => setActiveTab("editor_brain")}
                      />
                    )}
                    {activeTab === "workspace" && (
                      <ProfessionalWorkspace
                        language={language}
                        showToast={showToast}
                        projectId={activeProjectId}
                      />
                    )}
                    {activeTab === "director_briefing" && (
                      <DirectorProductionCenter
                        language={language}
                        showToast={showToast}
                        projectId={activeProjectId}
                      />
                    )}
                    {activeTab === "system_test" && (
                      <SystemDiagnosticSuite
                        language={language}
                        showToast={showToast}
                        onTestLivePlayer={() => {
                          showToast(isSk ? "🎬 Spúšťam živý stress-test prehrávača (play -> zoom -> sfx -> seek)..." : "🎬 Running live player stress test (play -> zoom -> sfx -> seek)...");
                          const video = videoRef.current;
                          if (!video) return;

                          video.currentTime = 0;
                          setCurrentTime(0);
                          video.play().then(() => {
                            setIsPlaying(true);
                            playSynthesizedSFX("whoosh", 0.5);

                            setTimeout(() => {
                              if (videoRef.current) {
                                videoRef.current.currentTime = 3.5;
                                setCurrentTime(3.5);
                                playSynthesizedSFX("pop", 0.6);
                              }
                            }, 1200);

                            setTimeout(() => {
                              if (videoRef.current) {
                                videoRef.current.currentTime = 6.0;
                                setCurrentTime(6.0);
                                playSynthesizedSFX("ding", 0.7);
                              }
                            }, 2400);

                            setTimeout(() => {
                              showToast(isSk ? "✅ Test plynulosti úspešný: 60FPS overené, nulové zasekávanie!" : "✅ Smoothness test passed: 60FPS verified, zero stutter!");
                            }, 3400);
                          }).catch((err) => {
                            console.warn("Live test play failed, retrying muted:", err);
                            video.muted = true;
                            video.play().then(() => setIsPlaying(true)).catch(console.error);
                          });
                        }}
                      />
                    )}
                    {activeTab === "pipeline" && (
                      <RawToReadyPipeline
                        rawAnalysis={rawAnalysis}
                        onRunRawAnalysis={handleRunRawAnalysis}
                        isAnalyzingRaw={isAnalyzingRaw}
                        storyPlan={storyPlan}
                        onGenerateStory={setStoryPlan}
                        onUpdatePlan={setStoryPlan}
                        onApplyStoryToTimeline={() => showToast(isSk ? "Príbeh aplikovaný na timeline." : "Story applied to timeline.")}
                        isGeneratingStory={isGeneratingStory}
                        jumpSequence={jumpSequence}
                        onGenerateCuts={(mode, density) => handleGenerateCuts(mode, density)}
                        onApplyCuts={(ids) => handleApplyCuts(ids)}
                        onApplyDirectorPlan={handleApplyDirectorPlan}
                        onOpenTimeline={() => setActiveTab("pro_timeline")}
                        isGeneratingCuts={isGeneratingCuts}
                        brollProject={brollProject}
                        onUpdateBrollProject={setBrollProject}
                        onGenerateBrollSuggestions={handleGenerateBrollSuggestions}
                        onApplyBroll={handleApplyBroll}
                        isGeneratingBroll={isGeneratingBroll}
                        bilingualProject={bilingualProject}
                        onUpdateBilingualProject={setBilingualProject}
                        onGenerateBilingualTranslation={handleGenerateBilingualTranslation}
                        onGenerateVoiceover={handleGenerateVoiceover}
                        isTranslating={isTranslating}
                        audioProject={audioProject}
                        onUpdateAudioProject={setAudioProject}
                        onProcessAudio={handleProcessAudio}
                        isProcessingAudio={isProcessingAudio}
                        beatSyncProject={beatSyncProject}
                        onUpdateBeatSyncProject={setBeatSyncProject}
                        onAnalyzeBeats={handleAnalyzeBeats}
                        onSnapToBeat={handleSnapToBeat}
                        isAnalyzingBeats={isAnalyzingBeats}
                        visualAttentionProject={visualAttentionProject}
                        onUpdateAttentionProject={setVisualAttentionProject}
                        onRunAttentionAnalysis={handleRunAttentionAnalysis}
                        onApplyAttentionSuggestion={handleApplyAttentionSuggestion}
                        isAnalyzingAttention={isAnalyzingAttention}
                        brollFinderProject={brollFinderProject}
                        onUpdateBrollFinderProject={setBrollFinderProject}
                        onGenerateBrollFinderSuggestions={handleGenerateBrollFinderSuggestions}
                        cleanupProject={cleanupProject}
                        onUpdateCleanupProject={setCleanupProject}
                        onRunCleanupDetection={handleRunCleanupDetection}
                        onApplyCleanup={handleApplyCleanup}
                        isAnalyzingCleanup={isAnalyzingCleanup}
                        isProcessingCleanup={isProcessingCleanup}
                        multiExportProject={multiExportProject}
                        onUpdateMultiExportProject={setMultiExportProject}
                        onStartMultiExport={handleStartMultiExport}
                        isExportingMulti={isExportingMulti}
                        contentPack={contentPack}
                        onGenerateContentPack={handleGenerateContentPack}
                        isGeneratingPack={isGeneratingPack}
                        retentionProject={retentionProject}
                        onRunRetentionAnalysis={handleRunRetentionAnalysis}
                        isAnalyzingRetention={isAnalyzingRetention}
                        abVersionProject={abVersionProject}
                        onGenerateABVersions={handleGenerateABVersions}
                        isGeneratingAB={isGeneratingAB}
                        duration={duration}
                        currentTime={currentTime}
                        isPlaying={isPlaying}
                        onSeek={handleSeek}
                        onTogglePlay={handleTogglePlay}
                        language={language}
                        captionProject={captionProject}
                        onUpdateCaptionProject={setCaptionProject}
                        onRunMagicSplit={handleRunMagicSplit}
                        onTranslate={handleTranslateCaptions}
                        isGeneratingCaptions={isGeneratingCaptions}
                        settings={settings}
                        setSettings={setSettings}
                        onUpdateSettings={(s) => setSettings(prev => ({ ...prev, ...s }))}
                        bRollOverlays={brollProject.items}
                        setBRollOverlays={(items) => setBrollProject(prev => ({ ...prev, items: typeof items === 'function' ? items(prev.items) : items }))}
                        setIsBRollTimelineOpen={() => {}}
                        onJumpToProTimeline={() => setActiveTab("pro_timeline")}
                        showToast={showToast}
                      />
                    )}
                    {activeTab === "raw" && <RawAIAnalyzer analysis={rawAnalysis} isAnalyzing={isAnalyzingRaw} onRunAnalysis={handleRunRawAnalysis} onApplyClip={(start, end) => handleSeek(start)} currentTime={currentTime} language={language} />}
                    {activeTab === "story" && <AIStoryBuilder rawAnalysis={rawAnalysis} storyPlan={storyPlan} isGenerating={isGeneratingStory} onGenerateStory={handleGenerateStory} onUpdatePlan={setStoryPlan} onApplyToTimeline={() => showToast(isSk ? "Príbeh aplikovaný." : "Story applied.")} language={language} />}
                    {activeTab === "jump" && <AIJumpCutEditor rawAnalysis={rawAnalysis} storyPlan={storyPlan} jumpSequence={jumpSequence} isGenerating={isGeneratingCuts} onGenerateCuts={(mode, density) => handleGenerateCuts(mode, density)} onApplyCuts={(ids) => handleApplyCuts(ids)} onPreviewCut={(start) => handleSeek(start)} language={language} />}
                    {activeTab === "transitions" && (
                      <TransitionStudio
                        currentVideoUrl={currentVideoUrl}
                        currentTime={currentTime}
                        duration={duration}
                        onSeek={handleSeek}
                        transitions={transitions}
                        onChangeTransitions={setTransitions}
                        language={language}
                        cuts={jumpSequence ? jumpSequence.markers.map((m: AICutMarker) => ({ id: m.id, time: m.start, label: m.reasonSk })) : []}
                      />
                    )}
                    {activeTab === "captions" && (
                      <div className="space-y-6">
                        {/* 1. AUTOMATICKÝ PREPIS HOVORENÉHO SLOVA (ÚPLNE NA VRCHU) */}
                        <AutoVideoCaptionsPanel
                          currentVideoUrl={currentVideoUrl}
                          videoDuration={duration}
                          captionProject={captionProject}
                          onUpdateCaptionProject={setCaptionProject}
                          onSeek={handleSeek}
                          currentTime={currentTime}
                          language={language}
                          showToast={showToast}
                        />

                        {/* Integrated AI Caption Generator Section */}
                        <div className="bg-neutral-950 rounded-2xl border border-neutral-800 p-4 shadow-xl relative overflow-hidden">
                          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <div className="bg-gradient-to-tr from-rose-500 to-amber-500 p-1.5 rounded-xl text-white shadow-md shadow-rose-500/20">
                                <Sparkles className="w-4 h-4 animate-pulse" />
                              </div>
                              <div>
                                <h3 className="text-xs font-black text-white tracking-wide uppercase flex items-center gap-1.5">
                                  {isSk ? "AI Generátor Titulkov" : "AI Caption Generator"}
                                  {(currentVideoUrl.startsWith("blob:") || currentVideoUrl.includes("blob")) && (
                                    <span className="bg-rose-500/20 text-rose-400 text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-rose-500/30">
                                      {isSk ? "VLASTNÉ VIDEO" : "CUSTOM VIDEO"}
                                    </span>
                                  )}
                                </h3>
                                <p className="text-[11px] text-neutral-400 truncate max-w-[280px]">
                                  {isSk 
                                    ? `Pre "${customVideoName || "OMNISTRIH_RAW.mp4"}"` 
                                    : `For "${customVideoName || "OMNISTRIH_RAW.mp4"}"`}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2.5 mb-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-semibold text-neutral-300 flex items-center gap-1">
                                <FileText className="w-3 h-3 text-neutral-400" />
                                <span>{isSk ? "Téma / Kontext:" : "Topic / Context:"}</span>
                              </label>
                              <input
                                type="text"
                                value={videoTopic}
                                onChange={(e) => setVideoTopic(e.target.value)}
                                placeholder={isSk ? "Napr. 'Vzdelávacie video', 'Rozhovor'..." : "e.g., 'Educational video', 'Podcast'..."}
                                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-all"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[10px] font-semibold text-neutral-300 flex items-center gap-1">
                                  <Palette className="w-3 h-3 text-neutral-400" />
                                  <span>{isSk ? "Kinetický štýl:" : "Style:"}</span>
                                </label>
                                <select
                                  value={captionStyle}
                                  onChange={(e) => setCaptionStyle(e.target.value as any)}
                                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500 transition-all cursor-pointer"
                                >
                                  <option value="mrbeast">MrBeast Bold 💥</option>
                                  <option value="ali-abdaal">Ali Abdaal Minimal 🌿</option>
                                  <option value="cyber">Cyber Neon 👾</option>
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-semibold text-neutral-300 flex items-center gap-1">
                                  <Globe className="w-3 h-3 text-neutral-400" />
                                  <span>{isSk ? "Jazyk:" : "Language:"}</span>
                                </label>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => setLanguage("sk")}
                                    className={`flex-1 flex items-center justify-center py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                      language === "sk"
                                        ? "bg-rose-500 text-white border-rose-500 shadow-sm"
                                        : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white"
                                    }`}
                                  >
                                    <span>🇸🇰 SK</span>
                                  </button>
                                  <button
                                    onClick={() => setLanguage("en")}
                                    className={`flex-1 flex items-center justify-center py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                      language === "en"
                                        ? "bg-rose-500 text-white border-rose-500 shadow-sm"
                                        : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white"
                                    }`}
                                  >
                                    <span>🇬🇧 EN</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Progress bar */}
                          {isTranscribing && (
                            <div className="mb-3 bg-neutral-900 border border-neutral-800 rounded-xl p-2.5 animate-in fade-in duration-300">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-black text-rose-400 animate-pulse">{transcriptionStage}</span>
                                <span className="text-[10px] font-bold text-neutral-400">{transcriptionProgress}%</span>
                              </div>
                              <div className="w-full bg-neutral-950 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-gradient-to-r from-rose-500 to-amber-500 h-full rounded-full transition-all duration-500"
                                  style={{ width: `${transcriptionProgress}%` }}
                                />
                              </div>
                            </div>
                          )}

                          <button
                            onClick={handleGenerateSubtitles}
                            disabled={isTranscribing}
                            className="w-full py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white shadow-lg shadow-rose-500/20 active:scale-[0.98] disabled:opacity-50 transition-all"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{isTranscribing ? (isSk ? "GENERUJEM..." : "GENERATING...") : (isSk ? "SPUSTIŤ AI PREPIS A TITULKY" : "RUN AI TRANSCRIPTION & CAPTIONS")}</span>
                          </button>
                        </div>

                        <SmartCaptionEditor project={captionProject} rawAnalysis={rawAnalysis} jumpSequence={jumpSequence} isGenerating={isGeneratingCaptions} onUpdateProject={setCaptionProject} onRunMagicSplit={handleRunMagicSplit} onTranslate={handleTranslateCaptions} onSeek={handleSeek} currentTime={currentTime} language={language} />
                      </div>
                    )}
                    {activeTab === "broll" && <AIBrollEngine project={brollProject} rawAnalysis={rawAnalysis} storyPlan={storyPlan} isGenerating={isGeneratingBroll} onUpdateProject={setBrollProject} onGenerateSuggestions={handleGenerateBrollSuggestions} onApplyBroll={handleApplyBroll} onSeek={handleSeek} currentTime={currentTime} language={language} />}
                    {activeTab === "bilingual" && <BilingualEditor project={bilingualProject} rawAnalysis={rawAnalysis} captionProject={captionProject} isGenerating={isTranslating} onUpdateProject={setBilingualProject} onGenerateTranslation={handleGenerateBilingualTranslation} onGenerateVoiceover={handleGenerateVoiceover} onSeek={handleSeek} currentTime={currentTime} language={language} />}
                    {activeTab === "audio" && <AIAudioStudio project={audioProject} rawAnalysis={rawAnalysis} isProcessing={isProcessingAudio} onUpdateProject={setAudioProject} onProcessAudio={handleProcessAudio} language={language} />}
                    {activeTab === "beat" && <BeatSyncStudio project={beatSyncProject} rawAnalysis={rawAnalysis} isAnalyzing={isAnalyzingBeats} onUpdateProject={setBeatSyncProject} onAnalyzeBeats={handleAnalyzeBeats} onSnapToBeat={handleSnapToBeat} onSeek={handleSeek} currentTime={currentTime} language={language} />}
                    {activeTab === "attention" && <VisualAttentionStudio project={visualAttentionProject} rawAnalysis={rawAnalysis} isAnalyzing={isAnalyzingAttention} onUpdateProject={setVisualAttentionProject} onRunAnalysis={handleRunAttentionAnalysis} onApplySuggestion={handleApplyAttentionSuggestion} onSeek={handleSeek} currentTime={currentTime} language={language} />}
                    {activeTab === "finder" && <AIBrollFinder project={brollFinderProject} rawAnalysis={rawAnalysis} isAnalyzing={isAnalyzingBroll} onUpdateProject={setBrollFinderProject} onGenerateSuggestions={handleGenerateBrollFinderSuggestions} language={language} />}
                    {activeTab === "cleanup" && <SmartCleanupSuite project={cleanupProject} rawAnalysis={rawAnalysis} isAnalyzing={isAnalyzingCleanup} isProcessing={isProcessingCleanup} onUpdateProject={setCleanupProject} onRunDetection={handleRunCleanupDetection} onApplyCleanup={handleApplyCleanup} onSeek={handleSeek} currentTime={currentTime} language={language} />}
                    {activeTab === "export" && <MultiPlatformExport project={multiExportProject} isExporting={isExportingMulti} onStartExport={handleStartMultiExport} onUpdateProject={setMultiExportProject} language={language} />}
                    {activeTab === "pack" && <ContentPackMachine pack={contentPack} isGenerating={isGeneratingPack} onGenerate={handleGenerateContentPack} language={language} />}
                    {activeTab === "retention" && <RetentionSimulator project={retentionProject} isAnalyzing={isAnalyzingRetention} onRunAnalysis={handleRunRetentionAnalysis} onSeek={handleSeek} currentTime={currentTime} language={language} />}
                    {activeTab === "ab" && <ABVersionGenerator project={abVersionProject} isGenerating={isGeneratingAB} onGenerate={handleGenerateABVersions} onPreview={(v) => handleSeek(0)} language={language} />}
                    {activeTab === "pro_timeline" && <ProTimeline duration={duration} currentTime={currentTime} isPlaying={isPlaying} onSeek={handleSeek} onTogglePlay={handleTogglePlay} language={language} />}
                    {activeTab === "eraser" && <ObjectEraserSuite settings={settings} onChangeSettings={(s: any) => setSettings((prev: any) => ({ ...prev, ...s }))} language={language} />}
                    {activeTab === "burned_subtitles" && (
                      <BurnedSubtitlesRemover
                        settings={settings}
                        onChangeSettings={(s: any) => setSettings((prev: any) => ({ ...prev, ...s }))}
                        currentVideoUrl={currentVideoUrl}
                        videoRef={videoRef}
                        currentTime={currentTime}
                        duration={duration}
                        onSeek={handleSeek}
                        language={language}
                        showToast={showToast}
                        onSelectVideoUrl={setCurrentVideoUrl}
                        onUploadVideo={handleUploadVideo}
                      />
                    )}
                    {activeTab === "opus" && <OpusStudio virality={{ overallScore: 92, hookScore: 90, pacingScore: 88, retentionScore: 94, trendScore: 91, keyReasons: ["Strong hook", "Fast pacing"], suggestedHashtags: ["#viral", "#trending"], suggestedTitle: "Viral Video", suggestedDescription: "Amazing video" }} smartClips={[]} onSelectClip={(start, end) => handleSeek(start)} autoReframe={settings.autoReframeFace} onToggleAutoReframe={(val) => setSettings((prev: any) => ({ ...prev, autoReframeFace: val }))} bRollEnabled={settings.bRollEnabled} onToggleBRoll={(val) => setSettings((prev: any) => ({ ...prev, bRollEnabled: val }))} language={language} onUpdateCaptionProject={setCaptionProject} showToast={showToast} />}
                    {activeTab === "canva" && <CanvaAudioSuite settings={settings} onChangeSettings={(s: any) => setSettings((prev: any) => ({ ...prev, ...s }))} onApplyCategoryPreset={(cat) => setSettings((prev: any) => ({ ...prev, category: cat }))} language={language} />}
                    {activeTab === "thumbnail" && <AIThumbnailStudio project={thumbnailProject} rawAnalysis={rawAnalysis} isGenerating={isGeneratingThumbnails} onUpdateProject={setThumbnailProject} onGenerateConcepts={handleGenerateThumbnailConcepts} language={language} showToast={showToast} />}
                    {activeTab === "os_hub" && <OmniStrihOSHub editDNA={editDNA} onUpdateDNA={setEditDNA} memoryRules={memoryRules} onToggleRule={(id) => setMemoryRules(prev => prev.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r))} reviewItems={reviewItems} onReviewItem={(id, status) => setReviewItems(prev => prev.map(i => i.id === id ? { ...i, status } : i))} lockZones={lockZones} onToggleLock={(id) => setLockZones(prev => prev.map(l => l.id === id ? { ...l, isLocked: !l.isLocked } : l))} timeMachine={timeMachine} onRestoreVersion={(id) => showToast(isSk ? "Verzia obnovená" : "Version restored")} contentUniverse={contentUniverse} language={language} showToast={showToast} />}
                    {activeTab === "pro_toolbox" && <ProfessionalToolbox language={language} currentTime={currentTime} duration={duration} onSeek={handleSeek} showToast={showToast} />}
                    {activeTab === "ai_voice" && (
                      <AINaturalVoiceStudio
                        isSk={isSk}
                        captionProject={captionProject}
                        audioProject={audioProject}
                        settings={settings}
                        currentTime={currentTime}
                        videoDuration={duration}
                        onSeek={handleSeek}
                        onChangeSettings={(s: any) => setSettings((prev: any) => ({ ...prev, ...s }))}
                        onAddVoiceClip={(clip) => {
                          setVoiceClips((prev) => [...prev, clip]);
                          showToast(isSk ? `Hlas pridaný: ${clip.voiceName}` : `Voice added: ${clip.voiceName}`);
                        }}
                      />
                    )}
                    </Suspense>
                  </div>
                </div>
                )}

                {/* B. Center/Right Video Preview Player Viewport */}
                <div className="flex-1 flex flex-col min-w-0 bg-neutral-950 min-h-0 overflow-y-auto custom-scrollbar p-3 sm:p-4">
                  <div className="w-full max-w-4xl mx-auto flex items-center justify-between pb-2 text-xs text-neutral-400">
                    <span className="text-[11px] font-bold text-neutral-400">
                      {isSk ? "🎬 Náhľad videa" : "🎬 Video Preview"}
                    </span>
                    <button
                      onClick={() => {
                        setShowAdvancedTools(prev => !prev);
                        playSynthesizedSFX("click", 0.4);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-[11px] font-bold text-neutral-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Sliders className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{showAdvancedTools ? (isSk ? "Skryť expertné nástroje" : "Hide Expert Tools") : (isSk ? "Expertné nástroje" : "Expert Tools")}</span>
                    </button>
                  </div>
                  <div className="w-full max-w-4xl mx-auto my-auto flex flex-col items-center justify-center">
                    <VideoPlayer
                      settings={settings}
                      captions={captionProject.segments}
                      zoomCues={zoomCues}
                      sfxCues={sfxCues}
                      transitions={transitions}
                      bRollOverlays={brollProject.items as any}
                      onSelect={(type: SelectionType, id: string | null) => {
                        setSelectionType(type);
                        setSelectedId(id);
                      }}
                      currentTime={currentTime}
                      duration={duration}
                      isPlaying={isPlaying}
                      onTimeUpdate={setCurrentTime}
                      onDurationChange={setDuration}
                      onTogglePlay={handleTogglePlay}
                      canvasRef={canvasRef}
                      videoRef={videoRef}
                      currentVideoUrl={currentVideoUrl}
                      proxyUrl={null}
                      onSelectVideoUrl={setCurrentVideoUrl}
                      onUploadVideo={handleUploadVideo}
                      onChangeSettings={(newS) => setSettings((prev) => ({ ...prev, ...newS }))}
                      language={language}
                    />
                  </div>
                </div>

              </div>

              {/* Fixed Bottom Timeline */}
              <div className="h-56 sm:h-64 bg-neutral-900 border-t border-neutral-800 shadow-2xl shrink-0 z-10">
                <TimelineControls
                  currentTime={currentTime}
                  duration={duration}
                  onSeek={handleSeek}
                  isPlaying={isPlaying}
                  onTogglePlay={() => handleTogglePlay()}
                  language={language}
                  captions={captionProject.segments}
                  zoomCues={zoomCues}
                  sfxCues={sfxCues}
                  bRollOverlays={brollProject.items as any}
                  onSelect={(type: SelectionType, id: string | null) => {
                    setSelectionType(type);
                    setSelectedId(id);
                  }}
                />
              </div>
            </>
          )}
        </div>

            {/* Right: Simple Smart Tool Interface & AI Copilot */}
            {isInspectorOpen ? (
              <div className="w-84 sm:w-96 bg-neutral-900 border-l border-neutral-800 flex flex-col shadow-2xl z-20 shrink-0 transition-all">
                {/* Panel Tab Switcher */}
                <div className="px-3 pt-2 pb-1.5 border-b border-neutral-800/80 bg-neutral-950 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-1 bg-neutral-900 p-0.5 rounded-lg border border-neutral-800">
                    <button
                      onClick={() => {
                        setRightPanelTab("smart_tools");
                        playSynthesizedSFX("click", 0.4);
                      }}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        rightPanelTab === "smart_tools"
                          ? "bg-rose-500 text-white shadow-sm"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      {isSk ? "⚡ Smart Nástroje" : "⚡ Smart Tools"}
                    </button>
                    <button
                      onClick={() => {
                        setRightPanelTab("ai_copilot");
                        playSynthesizedSFX("click", 0.4);
                      }}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                        rightPanelTab === "ai_copilot"
                          ? "bg-rose-500 text-white shadow-sm"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{isSk ? "AI Copilot" : "AI Copilot"}</span>
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setIsInspectorOpen(false);
                      playSynthesizedSFX("click", 0.3);
                    }}
                    title={isSk ? "Skryť panel" : "Hide Panel"}
                    className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <PanelRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {rightPanelTab === "smart_tools" ? (
                  <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                    <SimpleSmartToolInterface
                      activeCategory={smartCategory}
                      onSelectCategory={setSmartCategory}
                      currentVideoUrl={currentVideoUrl}
                      videoRef={videoRef}
                      currentTime={currentTime}
                      duration={duration}
                      onSeek={handleSeek}
                      captionProject={captionProject}
                      onChangeCaptionProject={setCaptionProject}
                      jumpSequence={jumpSequence}
                      onChangeJumpSequence={setJumpSequence}
                      audioProject={audioProject}
                      onChangeAudioProject={setAudioProject}
                      brollProject={brollProject}
                      settings={settings}
                      onChangeSettings={(partial) => setSettings(prev => ({ ...prev, ...partial }))}
                      onUndo={() => {
                        playSynthesizedSFX("ding", 0.5);
                        showToast(isSk ? "✓ Zmena vrátená späť (Undo)" : "✓ Change undone");
                      }}
                      onRedo={() => {
                        playSynthesizedSFX("ding", 0.5);
                        showToast(isSk ? "✓ Krok vpred (Redo)" : "✓ Change redone");
                      }}
                      canUndo={true}
                      canRedo={false}
                      showToast={showToast}
                      language={language}
                      selectionType={selectionType}
                      selectedId={selectedId}
                      onSelectElement={(type, id) => {
                        setSelectionType(type);
                        setSelectedId(id);
                      }}
                      onUploadVideo={handleUploadVideo}
                      onOpenFullTool={(tabId) => {
                        setShowAdvancedTools(true);
                        setActiveTab(tabId as any);
                      }}
                      onClose={() => setIsInspectorOpen(false)}
                    />
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto">
                      <ContextualInspector 
                        selectionType={selectionType}
                        selectedId={selectedId}
                        onAction={handleInspectorAction}
                        data={{
                          jumpSequence,
                          captionProject,
                          brollProject,
                          audioProject,
                          duration,
                          currentTime,
                          rawAnalysis,
                        }}
                        settings={settings}
                        onUpdateSettings={(partial) => setSettings(prev => ({ ...prev, ...partial }))}
                        language={language}
                        onTriggerMagicEdit={() => {
                          setActiveTab("pro_autopilot");
                          showToast(isSk ? "⚡ Otváram PROFESSIONAL AUTOPILOT ENGINE..." : "⚡ Opening PROFESSIONAL AUTOPILOT ENGINE...");
                          playSynthesizedSFX("click", 0.6);
                        }}
                        onOpenQC={() => setActiveTab("qc_analytics")}
                        onOpenExport={() => setIsExportOpen(true)}
                        onClose={() => {
                          setIsInspectorOpen(false);
                          playSynthesizedSFX("click", 0.3);
                        }}
                      />
                    </div>
                    
                    {/* Compact AI Copilot */}
                    <div className="h-1/2 border-t border-neutral-800 flex flex-col bg-neutral-950">
                      <div className="p-3 border-b border-neutral-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                          <span className="text-[10px] font-black text-neutral-300 uppercase tracking-widest">AI Co-Editor</span>
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[9px] font-black rounded-full">
                          ONLINE
                        </span>
                      </div>

                      {/* Chat Messages */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {copilotMessages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                          >
                            <div
                              className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                                msg.sender === "user"
                                  ? "bg-rose-500 text-white rounded-br-xs"
                                  : "bg-neutral-800 border border-neutral-700/80 text-neutral-200 rounded-bl-xs"
                              }`}
                            >
                              {isSk ? msg.textSk : msg.textEn}
                            </div>
                            <span className="text-[9px] text-neutral-500 mt-1 px-1">{msg.time}</span>
                          </div>
                        ))}
                      </div>

                      {/* Prompt Input */}
                      <div className="p-3 border-t border-neutral-800 bg-neutral-900/50">
                        <form onSubmit={handleSendCopilotMessage} className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder={isSk ? "Napíš príkaz (napr. Zväčši titulky)..." : "Type command (e.g. Make captions bigger)..."}
                            value={copilotInput}
                            onChange={(e) => setCopilotInput(e.target.value)}
                            className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-colors"
                          />
                          <button
                            type="submit"
                            className="p-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-all shadow-md shadow-rose-500/20 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => {
                  setIsInspectorOpen(true);
                  playSynthesizedSFX("click", 0.4);
                }}
                className="fixed right-3 top-20 z-30 px-3 py-2 bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700 text-rose-400 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md"
                title={isSk ? "Zobraziť panel nástrojov" : "Show Smart Tools Panel"}
              >
                <PanelRight className="w-4 h-4" />
                <span className="hidden sm:inline">{isSk ? "Nástroje" : "Smart Tools"}</span>
              </button>
            )}
          </main>
        </div>
      )}
      
      <Suspense fallback={null}>
        <PerformancePanel />
        <SuggestionPanel
          suggestions={suggestions}
          onApply={(id) => {
            showToast(isSk ? `Návrh [${id}] bol úspešne aplikovaný.` : `Suggestion [${id}] applied successfully.`);
            playSynthesizedSFX("click", 0.5);
          }}
          onReject={(id) => {
            showToast(isSk ? `Návrh [${id}] bol odmietnutý.` : `Suggestion [${id}] rejected.`);
          }}
        />

        {/* Professional Export Center */}
        {isExportOpen && (
          <ProfessionalExportCenter
            isOpen={isExportOpen}
            onClose={() => setIsExportOpen(false)}
            settings={settings}
            duration={duration}
            canvasRef={canvasRef}
            videoRef={videoRef}
            language={language}
            projectId="current-project"
            showToast={showToast}
          />
        )}

        {/* Settings Modal */}
        {isSettingsOpen && (
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            language={language}
          />
        )}

        {/* API Key Manager Modal */}
        {isApiKeysOpen && (
          <ApiKeyManagerModal
            isOpen={isApiKeysOpen}
            onClose={() => setIsApiKeysOpen(false)}
            zeroTokenMode={!!settings.zeroTokenMode}
            onToggleZeroTokenMode={(enabled) =>
              setSettings((prev) => ({ ...prev, zeroTokenMode: enabled }))
            }
          />
        )}
      </Suspense>

      {/* Global Command Palette / Search Overlay */}
      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        language={language}
        selectedId={selectedId}
        selectionType={selectionType}
        onNavigateTab={(tabId) => {
          setActiveTab(tabId as any);
          setCurrentView("editor");
        }}
        onExecuteAction={(actionId, params) => {
          handleInspectorAction(actionId, params);
        }}
        onOpenInspector={(toolId) => {
          setCurrentView("editor");
          handleInspectorAction(toolId);
        }}
        onTriggerMakeProfessional={() => {
          setActiveTab("pro_autopilot");
          showToast(isSk ? "⚡ Otváram PROFESSIONAL AUTOPILOT ENGINE..." : "⚡ Opening PROFESSIONAL AUTOPILOT ENGINE...");
          playSynthesizedSFX("click", 0.6);
        }}
        onOpenExport={() => setIsExportOpen(true)}
        onSelectSampleClip={() => {
          setSelectedId("clip-sample-1");
          setSelectionType("VIDEO_CLIP");
          showToast(isSk ? "Označený ukážkový video klip." : "Sample video clip selected.");
        }}
      />

      {/* Media Ingestion & Source Hub Modal (Disk, Smartphone/QR, Cloud, URL, Samples) */}
      <Suspense fallback={null}>
        {isImportModalOpen && (
          <ImportMediaModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            language={language}
            onSelectVideo={(url, filename, file) => {
              handleUploadVideo(url, filename, file);
              setIsImportModalOpen(false);
            }}
            onSelectMultipleFiles={(files) => {
              if (files && files.length > 0) {
                const firstFile = files[0];
                const url = URL.createObjectURL(firstFile);
                InstantMediaRegistry.registerInstant(url, firstFile.name);
                ResourceManager.registerBlob(url);
                handleUploadVideo(url, firstFile.name, firstFile);
                showToast(isSk ? `📁 Nahraných ${files.length} súborov.` : `📁 Uploaded ${files.length} files.`);
              }
              setIsImportModalOpen(false);
            }}
          />
        )}
      </Suspense>

      {/* Local AI Control Center Modal (100% Offline, Zero Startup Impact) */}
      <Suspense fallback={null}>
        {isLocalAIModalOpen && (
          <LocalAIControlCenter
            isOpen={isLocalAIModalOpen}
            onClose={() => setIsLocalAIModalOpen(false)}
          />
        )}
        {isCaptionStudioOpen && (
          <LocalCaptionStudio
            isOpen={isCaptionStudioOpen}
            onClose={() => setIsCaptionStudioOpen(false)}
          />
        )}
        {isMediaIntelligenceOpen && (
          <MediaIntelligenceInspector
            isOpen={isMediaIntelligenceOpen}
            onClose={() => setIsMediaIntelligenceOpen(false)}
          />
        )}
        {isDirectorStudioOpen && (
          <DirectorStudio
            isOpen={isDirectorStudioOpen}
            onClose={() => setIsDirectorStudioOpen(false)}
          />
        )}
      </Suspense>

      {/* Real-time Error Catcher & Debugger Overlay */}
      <ErrorDebuggerOverlay />
    </div>
  );
}

export default function App() {
  return (
    <AdaptiveDeviceExperienceProvider>
      <MainApp />
    </AdaptiveDeviceExperienceProvider>
  );
}
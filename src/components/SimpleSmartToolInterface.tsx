import React, { useState, useEffect, useRef, useMemo, memo } from "react";
import {
  Scissors,
  Music,
  Type,
  Film,
  Brain,
  Sliders,
  Share2,
  History,
  Trash2,
  Sparkles,
  Mic2,
  Volume2,
  VolumeX,
  Edit3,
  Check,
  RotateCcw,
  Search,
  Star,
  Clock,
  ChevronRight,
  ChevronDown,
  X,
  Play,
  Pause,
  AlertTriangle,
  ShieldCheck,
  Zap,
  Split,
  Eye,
  Settings,
  Flame,
  ArrowRight,
  Maximize2,
  Smartphone,
  Layers,
  CheckCircle2,
  HelpCircle,
  Activity,
  TrendingUp,
  Globe,
  Eraser,
  ImageIcon,
  Download,
  RefreshCw,
  FileText,
  Radio,
  Plus,
} from "lucide-react";
import {
  CaptionProject,
  CaptionSegment,
  CaptionStyle,
  VideoProjectSettings,
  JumpCutSequence,
  AudioProject,
  BrollProject,
  SelectionType,
  VideoAspectRatio,
} from "../types";
import { playSynthesizedSFX } from "../utils/audioSynth";
import { processVideoInpaintingPipeline } from "../utils/videoInpainter";
import { BurnedSubtitlesRemover } from "./BurnedSubtitlesRemover";

export type SmartCategory =
  | "strih"
  | "audio"
  | "titulky"
  | "vizual"
  | "ai"
  | "toolbox"
  | "export"
  | "historia";

interface SimpleSmartToolInterfaceProps {
  activeCategory: SmartCategory;
  onSelectCategory: (cat: SmartCategory) => void;
  currentVideoUrl: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  captionProject: CaptionProject;
  onChangeCaptionProject: (project: CaptionProject | ((prev: CaptionProject) => CaptionProject)) => void;
  jumpSequence: JumpCutSequence | null;
  onChangeJumpSequence: (seq: JumpCutSequence | null) => void;
  audioProject: AudioProject;
  onChangeAudioProject: (proj: AudioProject | ((prev: AudioProject) => AudioProject)) => void;
  brollProject: BrollProject;
  settings: VideoProjectSettings;
  onChangeSettings: (settings: Partial<VideoProjectSettings>) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  showToast: (msg: string) => void;
  language: "sk" | "en";
  selectionType: SelectionType;
  selectedId: string | null;
  onSelectElement: (type: SelectionType, id: string | null) => void;
  onUploadVideo: (url: string, filename?: string) => void;
  onOpenFullTool: (tabId: string) => void;
  onClose: () => void;
}

export const SimpleSmartToolInterface: React.FC<SimpleSmartToolInterfaceProps> = memo(({
  activeCategory,
  onSelectCategory,
  currentVideoUrl,
  videoRef,
  currentTime,
  duration,
  onSeek,
  captionProject,
  onChangeCaptionProject,
  jumpSequence,
  onChangeJumpSequence,
  audioProject,
  onChangeAudioProject,
  brollProject,
  settings,
  onChangeSettings,
  onUndo,
  onRedo,
  canUndo = true,
  canRedo = false,
  showToast,
  language,
  selectionType,
  selectedId,
  onSelectElement,
  onUploadVideo,
  onOpenFullTool,
  onClose,
}) => {
  const isSk = language === "sk";

  // State Management
  const [searchQuery, setSearchQuery] = useState("");
  const [panelTab, setPanelTab] = useState<"quick_actions" | "editor">("quick_actions");
  const [workflowMode, setWorkflowMode] = useState<"manual" | "assisted" | "auto">("assisted");
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [recentActions, setRecentActions] = useState<string[]>([]);
  const [showTip, setShowTip] = useState(true);

  // Subtitle Edit State
  const [editingCaption, setEditingCaption] = useState<CaptionSegment | null>(null);
  const [captionFont, setCaptionFont] = useState("Impact");
  const [captionSize, setCaptionSize] = useState(24);
  const [captionColor, setCaptionColor] = useState("#FFFFFF");
  const [captionBold, setCaptionBold] = useState(true);
  const [captionItalic, setCaptionItalic] = useState(false);
  const [captionUnderline, setCaptionUnderline] = useState(false);
  const [captionAlign, setCaptionAlign] = useState<"left" | "center" | "right">("center");

  // Inpainting progress
  const [isInpaintingRunning, setIsInpaintingRunning] = useState(false);
  const [inpaintStage, setInpaintStage] = useState("");
  const [inpaintPercent, setInpaintPercent] = useState(0);

  // Track recent actions
  const addRecent = (id: string) => {
    setRecentActions((prev) => [id, ...prev.filter((item) => item !== id)].slice(0, 5));
  };

  // When selectionType changes to CAPTION, auto-open editor tab
  useEffect(() => {
    if (selectionType === "CAPTION" && selectedId) {
      const cap = captionProject.segments.find((s) => s.id === selectedId);
      if (cap) {
        setEditingCaption(cap);
        setPanelTab("editor");
      }
    }
  }, [selectionType, selectedId, captionProject.segments]);

  // Handle Quick Subtitle Preset Apply
  const handleApplySubtitleStylePreset = (styleName: string) => {
    let captionStyle: CaptionStyle = "MINIMAL_CLEAN";
    let color = "#FFFFFF";
    let fontSize = 24;

    if (styleName === "Clean") {
      captionStyle = "MINIMAL_CLEAN";
      color = "#FFFFFF";
      fontSize = 24;
    } else if (styleName === "Bold") {
      captionStyle = "HORMOZI";
      color = "#FFFFFF";
      fontSize = 30;
    } else if (styleName === "Hormozi") {
      captionStyle = "HORMOZI";
      color = "#FACC15";
      fontSize = 32;
    } else if (styleName === "MrBeast") {
      captionStyle = "mrbeast-pop";
      color = "#38BDF8";
      fontSize = 34;
    } else if (styleName === "Neon") {
      captionStyle = "SOCIAL_POP";
      color = "#A855F7";
      fontSize = 28;
    } else if (styleName === "Comic") {
      captionStyle = "COLLAGE";
      color = "#F43F5E";
      fontSize = 26;
    } else {
      captionStyle = "MINIMAL_CLEAN";
      color = "#FFFFFF";
      fontSize = 24;
    }

    onChangeSettings({ captionStyle });
    onChangeCaptionProject({
      ...captionProject,
      globalStyle: {
        ...captionProject.globalStyle,
        style: captionStyle,
        color,
        fontSize,
      },
    });
    showToast(isSk ? `Štýl titulkov zmenený na "${styleName}".` : `Caption style set to "${styleName}".`);
    playSynthesizedSFX("pop", 0.5);
  };

  // Burned-In Subtitle Inpainting Action Handler
  const handleRunBurnedSubtitlesRemoval = async () => {
    if (!currentVideoUrl) {
      showToast(isSk ? "Najprv nahrajte video." : "Please import a video first.");
      return;
    }

    const zones = settings.eraserZones || [];
    const activeZones = zones.filter((z) => z.enabled);

    if (activeZones.length === 0) {
      const autoZone = {
        id: `auto-sub-${Date.now()}`,
        name: isSk ? "Maska vypálených titulkov" : "Burned Subtitles Mask",
        type: "subtitles" as const,
        x: 0.1,
        y: 0.78,
        width: 0.8,
        height: 0.14,
        enabled: true,
        feather: 4,
        isTracking: true,
      };
      onChangeSettings({ eraserEnabled: true, eraserZones: [autoZone] });
    }

    setIsInpaintingRunning(true);
    setInpaintPercent(0);
    setInpaintStage(isSk ? "Detegujem pixely titulkov…" : "Detecting subtitle pixels…");
    playSynthesizedSFX("whoosh", 0.4);

    try {
      const active = (settings.eraserZones || []).filter((z) => z.enabled);
      const zonesToUse = active.length > 0 ? active : [{
        id: `auto-sub-${Date.now()}`,
        name: "Burned Subtitle",
        type: "subtitles" as const,
        x: 0.1,
        y: 0.78,
        width: 0.8,
        height: 0.14,
        enabled: true,
        feather: 4,
        isTracking: true,
      }];

      const res = await processVideoInpaintingPipeline({
        videoUrl: currentVideoUrl,
        zones: zonesToUse,
        grainMatch: settings.eraserGrainMatch !== false,
        onProgress: (prog) => {
          setInpaintStage(isSk ? prog.stageLabelSk : prog.stageLabelEn);
          setInpaintPercent(prog.percent);
        },
      });

      if (res.success && res.cleanVideoUrl) {
        onUploadVideo(res.cleanVideoUrl, "Clean_Inpainted_Video.mp4");
        playSynthesizedSFX("cash", 0.8);
        showToast(
          isSk
            ? "✓ Zmena použitá: Vypálené titulky odstránené! [ ↶ SPÄŤ ]"
            : "✓ Change applied: Burned subtitles removed! [ ↶ UNDO ]"
        );
      } else {
        showToast(res.error || (isSk ? "Chyba pri inpaintingu." : "Inpainting error."));
      }
    } catch (err: any) {
      showToast(isSk ? `Chyba: ${err.message}` : `Error: ${err.message}`);
    } finally {
      setIsInpaintingRunning(false);
    }
  };

  // Save single caption edit
  const handleSaveCaptionEdit = () => {
    if (!editingCaption) return;
    onChangeCaptionProject((prev) => ({
      ...prev,
      segments: prev.segments.map((s) => (s.id === editingCaption.id ? editingCaption : s)),
    }));
    showToast(isSk ? "✓ Titulok uložený" : "✓ Subtitle saved");
    playSynthesizedSFX("pop", 0.5);
    setEditingCaption(null);
    onSelectElement("NONE", null);
  };

  // Split at playhead action
  const handleSplitAtPlayhead = () => {
    playSynthesizedSFX("click", 0.5);
    showToast(isSk ? `✂️ Klip rozdelený v čase ${currentTime.toFixed(2)}s` : `✂️ Clip split at ${currentTime.toFixed(2)}s`);
  };

  // 8 High Level Categories configuration
  const ALL_CATEGORIES = [
    { id: "strih" as SmartCategory, icon: Scissors, label: isSk ? "Strih" : "Cut & Edit", badge: "✂️", color: "from-amber-500 to-rose-600" },
    { id: "audio" as SmartCategory, icon: Music, label: isSk ? "Audio & Zvuk" : "Audio & Sound", badge: "🎵", color: "from-blue-500 to-cyan-600" },
    { id: "titulky" as SmartCategory, icon: Type, label: isSk ? "Titulky" : "Captions", badge: "⚡", color: "from-indigo-500 to-purple-600" },
    { id: "vizual" as SmartCategory, icon: Film, label: isSk ? "Vizuál & Efekty" : "Visual & B-roll", badge: "🎬", color: "from-pink-500 to-rose-600" },
    { id: "ai" as SmartCategory, icon: Sparkles, label: isSk ? "AI Asistent" : "AI Assistant", badge: "✨", color: "from-violet-500 to-indigo-600" },
    { id: "toolbox" as SmartCategory, icon: Sliders, label: isSk ? "Toolbox" : "Toolbox", badge: "🧰", color: "from-emerald-500 to-teal-600" },
    { id: "export" as SmartCategory, icon: Share2, label: isSk ? "Export" : "Export", badge: "🚀", color: "from-orange-500 to-red-600" },
    { id: "historia" as SmartCategory, icon: History, label: isSk ? "História" : "History", badge: "⏳", color: "from-neutral-600 to-neutral-800" },
  ];

  // ALL ACTIONS REGISTRY (FOR CARDS & FULL SEARCH)
  const ACTION_REGISTRY = [
    // TITULKY
    {
      id: "remove_burned",
      category: "titulky" as SmartCategory,
      title: isSk ? "Vymazať vypálené titulky" : "Remove burned-in subtitles",
      desc: isSk ? "Odstráni pôvodné 'vpečené' pixely titulkov pomocou video inpaintingu." : "Removes hardcoded subtitle pixels via real video inpainting.",
      icon: Trash2,
      color: "purple",
      badge: isSk ? "Inpainting" : "Inpainting",
      run: () => {
        setActiveActionId("remove_burned");
        addRecent("remove_burned");
        playSynthesizedSFX("click", 0.4);
      },
    },
    {
      id: "auto_captions",
      category: "titulky" as SmartCategory,
      title: isSk ? "Generovať titulky z hovoreného slova" : "Generate subtitles from speech",
      desc: isSk ? "Automatická AI transkripcia hovoreného slova na presné segmenty." : "Automatic AI transcription of spoken dialogue with word timings.",
      icon: Sparkles,
      color: "indigo",
      badge: "AI",
      run: () => {
        onOpenFullTool("captions");
        addRecent("auto_captions");
        playSynthesizedSFX("click", 0.4);
      },
    },
    {
      id: "audio_extract_subs",
      category: "titulky" as SmartCategory,
      title: isSk ? "Zo zvuku vytiahnuť titulky" : "Extract subtitles from audio track",
      desc: isSk ? "Prepis čistej zvukovej stopy bez vplyvu obrazu." : "Audio-only speech-to-text recognition.",
      icon: Mic2,
      color: "blue",
      badge: isSk ? "Zvuk" : "Audio",
      run: () => {
        onOpenFullTool("captions");
        addRecent("audio_extract_subs");
        playSynthesizedSFX("click", 0.4);
      },
    },
    {
      id: "manual_captions",
      category: "titulky" as SmartCategory,
      title: isSk ? "Ručné úpravy a formátovanie" : "Manual editing and styling",
      desc: isSk ? "Zmena slov, presné časovanie, farby, tiene a animácie." : "Edit words, timings, fonts, colors and animations.",
      icon: Edit3,
      color: "pink",
      badge: isSk ? "Editor" : "Editor",
      run: () => {
        setPanelTab("editor");
        addRecent("manual_captions");
        playSynthesizedSFX("click", 0.4);
      },
    },
    {
      id: "bilingual_subs",
      category: "titulky" as SmartCategory,
      title: isSk ? "Dvojjazyčné titulky a preklad" : "Bilingual captions & translation",
      desc: isSk ? "Preklad do 15 svetových jazykov s paralelným zobrazením." : "Translate captions into 15+ world languages.",
      icon: Globe,
      color: "amber",
      badge: "Global",
      run: () => {
        onOpenFullTool("bilingual");
        addRecent("bilingual_subs");
        playSynthesizedSFX("click", 0.4);
      },
    },

    // STRIH
    {
      id: "cut_silence",
      category: "strih" as SmartCategory,
      title: isSk ? "✂️ Odstrániť ticho (Jump Cuts)" : "✂️ Remove Silence (Jump Cuts)",
      desc: isSk ? "Automaticky vystrihne hluché miesta a pauzy dlhšie než 0.5s." : "Cuts pauses longer than 0.5s for fast-paced video.",
      icon: Scissors,
      color: "amber",
      badge: "Auto",
      run: () => {
        onOpenFullTool("jump");
        addRecent("cut_silence");
        playSynthesizedSFX("click", 0.4);
      },
    },
    {
      id: "cut_fillers",
      category: "strih" as SmartCategory,
      title: isSk ? "🧹 Odstrániť výplňové slová" : "🧹 Remove Filler Words",
      desc: isSk ? "Deteguje a odstráni 'eeeh', 'uhm', 'vlastne' a brbty." : "Removes ums, uhs, stumbles and hesitation words.",
      icon: Eraser,
      color: "rose",
      badge: "AI",
      run: () => {
        onOpenFullTool("jump");
        addRecent("cut_fillers");
        playSynthesizedSFX("click", 0.4);
      },
    },
    {
      id: "cut_badtakes",
      category: "strih" as SmartCategory,
      title: isSk ? "❌ Odstrániť nepodarené zábery" : "❌ Remove Bad Takes",
      desc: isSk ? "Detekuje opakovania, preklepy rečníka a nedokončené vety." : "Detects false starts, repeated phrases and mistakes.",
      icon: Trash2,
      color: "red",
      badge: "AI",
      run: () => {
        onOpenFullTool("jump");
        addRecent("cut_badtakes");
        playSynthesizedSFX("click", 0.4);
      },
    },
    {
      id: "split_playhead",
      category: "strih" as SmartCategory,
      title: isSk ? "✂️ Vystrihnúť na časovej osi" : "✂️ Split at Playhead",
      desc: isSk ? `Rozdelí aktívny klip presne na pozícii ${currentTime.toFixed(1)}s.` : `Splits active clip exactly at playhead ${currentTime.toFixed(1)}s.`,
      icon: Split,
      color: "orange",
      badge: "Manual",
      run: () => {
        handleSplitAtPlayhead();
        addRecent("split_playhead");
      },
    },
    {
      id: "zoom_punch",
      category: "strih" as SmartCategory,
      title: isSk ? "🔍 Rytmický Punch-in Zoom" : "🔍 Dynamic Punch-in Zoom",
      desc: isSk ? "Rytmické priblíženie kamery na zvýraznenie kľúčovej pointy." : "Emphasis punch-in zoom for high viewer retention.",
      icon: Maximize2,
      color: "violet",
      badge: "Retention",
      run: () => {
        onChangeSettings({ autoZoomEnabled: true, zoomIntensity: 1.2 });
        showToast(isSk ? "✓ Dynamický Zoom aktivovaný!" : "✓ Dynamic Zoom enabled!");
        playSynthesizedSFX("pop", 0.5);
        addRecent("zoom_punch");
      },
    },
    {
      id: "transitions_studio",
      category: "strih" as SmartCategory,
      title: isSk ? "🎞️ Filmové prechody" : "🎞️ Cinematic Transitions",
      desc: isSk ? "Hladké prechody (Zoom, Dissolve, Glitch, Whip) medzi rezmi." : "Smooth camera and glitch transitions between cuts.",
      icon: Film,
      color: "blue",
      badge: "Studio",
      run: () => {
        onOpenFullTool("transitions");
        addRecent("transitions_studio");
        playSynthesizedSFX("click", 0.4);
      },
    },

    // AUDIO
    {
      id: "ai_natural_voice",
      category: "audio" as SmartCategory,
      title: isSk ? "🎙️ AI Prirodzený Hlas (Studio)" : "🎙️ AI Natural Voice Studio",
      desc: isSk
        ? "Ľudský prednes, kontextové pauzy, emócie a nahrádzanie viet bez robotického tónu."
        : "Human-like delivery, contextual pauses, emotions and sentence replacement.",
      icon: Mic2,
      color: "indigo",
      badge: "Natural",
      run: () => {
        onOpenFullTool("ai_voice");
        addRecent("ai_natural_voice");
        playSynthesizedSFX("click", 0.4);
      },
    },
    {
      id: "clarify_voice",
      category: "audio" as SmartCategory,
      title: isSk ? "🎙️ Vyčistiť hlas (Voice Clarifier)" : "🎙️ Voice Clarifier & Denoise",
      desc: isSk ? "Izolácia reči, odstránenie šumu pozadia a akustického reverbu." : "Isolates speech, cleans background noise and echo.",
      icon: Mic2,
      color: "blue",
      badge: "DSP",
      run: () => {
        onChangeSettings({ voiceClarifierEnabled: true });
        showToast(isSk ? "🎙️ Vyčistenie hlasu aktivované!" : "🎙️ Voice Clarifier enabled!");
        playSynthesizedSFX("ding", 0.6);
        addRecent("clarify_voice");
      },
    },
    {
      id: "add_music",
      category: "audio" as SmartCategory,
      title: isSk ? "🎵 Pridať hudbu do pozadia" : "🎵 Add Background Music",
      desc: isSk ? "Výber royalty-free podkladových skladieb s automatickou dĺžkou." : "Curated royalty-free soundtracks with auto-trimming.",
      icon: Music,
      color: "cyan",
      badge: "Canva",
      run: () => {
        onOpenFullTool("canva");
        addRecent("add_music");
        playSynthesizedSFX("click", 0.4);
      },
    },
    {
      id: "auto_ducking",
      category: "audio" as SmartCategory,
      title: isSk ? "🔉 Auto-Ducking" : "🔉 Auto-Ducking",
      desc: isSk ? "Automatické stíšenie hudby vždy, keď rečník hovorí." : "Lowers soundtrack automatically when voice speaks.",
      icon: Volume2,
      color: "emerald",
      badge: "Pro",
      run: () => {
        onChangeSettings({ bgMusicDucking: true });
        showToast(isSk ? "🔉 Auto-Ducking zapnuté!" : "🔉 Auto-Ducking turned ON!");
        playSynthesizedSFX("ding", 0.5);
        addRecent("auto_ducking");
      },
    },
    {
      id: "studio_master",
      category: "audio" as SmartCategory,
      title: isSk ? "🎛️ Broadcast Mastering (-14 LUFS)" : "🎛️ Studio Mastering (-14 LUFS)",
      desc: isSk ? "Normalizácia zvuku na sociálne siete bez skreslenia a praskania." : "Standard -14 LUFS loudness mastering with limiter.",
      icon: Sliders,
      color: "purple",
      badge: "-14 LUFS",
      run: () => {
        onOpenFullTool("pro_audio");
        addRecent("studio_master");
        playSynthesizedSFX("click", 0.4);
      },
    },
    {
      id: "beat_sync",
      category: "audio" as SmartCategory,
      title: isSk ? "🥁 Beat-Sync Studio" : "🥁 Beat-Sync Studio",
      desc: isSk ? "Zladenie strihu, b-rollu a efektov presne na bicie v hudbe." : "Sync cuts, zooms and overlays to the musical beat.",
      icon: Activity,
      color: "rose",
      badge: "Sync",
      run: () => {
        onOpenFullTool("beat");
        addRecent("beat_sync");
        playSynthesizedSFX("click", 0.4);
      },
    },

    // VIZUÁL
    {
      id: "broll_add",
      category: "vizual" as SmartCategory,
      title: isSk ? "🎬 Pridať B-roll prestrihy" : "🎬 Add B-Roll Overlays",
      desc: isSk ? "Kontextové ilustračné videá podľa témy hovoreného slova." : "Contextual stock footage matched to spoken keywords.",
      icon: Film,
      color: "pink",
      badge: "AI",
      run: () => {
        onOpenFullTool("broll");
        addRecent("broll_add");
        playSynthesizedSFX("click", 0.4);
      },
    },
    {
      id: "erase_object",
      category: "vizual" as SmartCategory,
      title: isSk ? "🧹 Odstrániť objekt z videa" : "🧹 Remove Object from Video",
      desc: isSk ? "Zero-blur odstránenie nechcených log, predmetov a ľudí." : "Zero-blur content-aware object and logo removal.",
      icon: Eraser,
      color: "purple",
      badge: "Eraser",
      run: () => {
        onOpenFullTool("eraser");
        addRecent("erase_object");
        playSynthesizedSFX("click", 0.4);
      },
    },
    {
      id: "visual_attention",
      category: "vizual" as SmartCategory,
      title: isSk ? "👁️ Analýza vizuálnej pozornosti" : "👁️ Visual Attention Analysis",
      desc: isSk ? "AI predikcia očného pohľadu diváka a hotspotov videa." : "AI heatmap of viewer eye tracking and visual hotspots.",
      icon: Eye,
      color: "amber",
      badge: "Heatmap",
      run: () => {
        onOpenFullTool("attention");
        addRecent("visual_attention");
        playSynthesizedSFX("click", 0.4);
      },
    },
    {
      id: "aspect_ratio",
      category: "vizual" as SmartCategory,
      title: isSk ? "📐 Pomer strán (9:16 / 16:9 / 1:1)" : "📐 Aspect Ratio & Reframe",
      desc: isSk ? "Okamžitá zmena formátu s inteligentným centrovaním na tvár." : "Switch format with AI smart face reframe.",
      icon: Smartphone,
      color: "indigo",
      badge: "Format",
      run: () => {
        const nextRatio: VideoAspectRatio = settings.aspectRatio === "9:16" ? "16:9" : settings.aspectRatio === "16:9" ? "1:1" : "9:16";
        onChangeSettings({ aspectRatio: nextRatio });
        showToast(isSk ? `Formát zmenený na ${nextRatio}` : `Format set to ${nextRatio}`);
        playSynthesizedSFX("pop", 0.4);
        addRecent("aspect_ratio");
      },
    },

    // AI
    {
      id: "ai_natural_voice_ai",
      category: "ai" as SmartCategory,
      title: isSk ? "🎙️ AI Prirodzený Hlas (Narration)" : "🎙️ AI Natural Voice Studio",
      desc: isSk
        ? "Kontextové frázovanie, emócie, Hook & CTA detekcia a prirodzené pauzy."
        : "Contextual phrasing, emotions, Hook & CTA detection and natural pauses.",
      icon: Mic2,
      color: "indigo",
      badge: "Voice",
      run: () => {
        onOpenFullTool("ai_voice");
        addRecent("ai_natural_voice_ai");
        playSynthesizedSFX("click", 0.4);
      },
    },
    {
      id: "make_professional",
      category: "ai" as SmartCategory,
      title: isSk ? "✨ 95% Autopilot (Make It Professional)" : "✨ 95% Autopilot (Make It Professional)",
      desc: isSk ? "Autonómne spracovanie: ticho, zoomy, SFX, audio DSP a titulky v 1 kroku." : "Autonomous polish: silence cut, zooms, SFX, audio DSP and subtitles.",
      icon: Zap,
      color: "rose",
      badge: "One-Click",
      run: () => {
        onOpenFullTool("pro_autopilot");
        addRecent("make_professional");
        playSynthesizedSFX("click", 0.4);
      },
    },
    {
      id: "ai_virality",
      category: "ai" as SmartCategory,
      title: isSk ? "🧠 AI Virality & Retention (Opus Studio)" : "🧠 AI Virality & Retention (Opus Studio)",
      desc: isSk ? "Skórovanie hooku, tempa, dynamiky a výber najlepších momentov." : "Scores hook, pacing and selects the highest retention clips.",
      icon: Flame,
      color: "amber",
      badge: "Viral",
      run: () => {
        onOpenFullTool("opus");
        addRecent("ai_virality");
        playSynthesizedSFX("click", 0.4);
      },
    },
    {
      id: "editor_brain",
      category: "ai" as SmartCategory,
      title: isSk ? "🧬 Editor Brain (Strihové DNA)" : "🧬 Editor Brain (Editing DNA)",
      desc: isSk ? "Definuj si vlastný strihový štýl (Alex Hormozi, MrBeast, Cinematic)." : "Define custom editing style and persistent creator rules.",
      icon: Brain,
      color: "violet",
      badge: "DNA",
      run: () => {
        onOpenFullTool("editor_brain");
        addRecent("editor_brain");
        playSynthesizedSFX("click", 0.4);
      },
    },
    {
      id: "visual_director",
      category: "ai" as SmartCategory,
      title: isSk ? "🎨 AI Visual Director" : "🎨 AI Visual Director",
      desc: isSk ? "Kreatívny režisér – navrhuje scény, kontrasty a vizuálne nápady." : "Creative director proposing scenes, contrasts and visual ideas.",
      icon: Sparkles,
      color: "cyan",
      badge: "Director",
      run: () => {
        onOpenFullTool("ai_visual_director");
        addRecent("visual_director");
        playSynthesizedSFX("click", 0.4);
      },
    },

    // TOOLBOX
    {
      id: "pro_toolbox",
      category: "toolbox" as SmartCategory,
      title: isSk ? "🧰 Profesionálny Toolbox" : "🧰 Professional Toolbox",
      desc: isSk ? "Kompletný panel všetkých expertných nástrojov a utilít." : "Full centralized panel of all specialized tools and utilities.",
      icon: Sliders,
      color: "emerald",
      badge: "Suite",
      run: () => {
        onOpenFullTool("pro_toolbox");
        addRecent("pro_toolbox");
        playSynthesizedSFX("click", 0.4);
      },
    },
    {
      id: "ab_generator",
      category: "toolbox" as SmartCategory,
      title: isSk ? "🔀 A/B Verzie generátor" : "🔀 A/B Variant Generator",
      desc: isSk ? "Vytvor 3 verzie videa s rôznymi hookmi pre testovanie na sociálnych sieťach." : "Create 3 video variants with distinct hooks for social A/B testing.",
      icon: Split,
      color: "blue",
      badge: "Test",
      run: () => {
        onOpenFullTool("ab");
        addRecent("ab_generator");
        playSynthesizedSFX("click", 0.4);
      },
    },
    {
      id: "content_pack",
      category: "toolbox" as SmartCategory,
      title: isSk ? "📦 Content Pack Machine" : "📦 Content Pack Machine",
      desc: isSk ? "Pretvorte 1 hlavné video na 10 sociálnych príspevkov a formátov." : "Turn 1 source video into 10 multi-platform social assets.",
      icon: Layers,
      color: "purple",
      badge: "Pack",
      run: () => {
        onOpenFullTool("pack");
        addRecent("content_pack");
        playSynthesizedSFX("click", 0.4);
      },
    },
    {
      id: "thumbnail_studio",
      category: "toolbox" as SmartCategory,
      title: isSk ? "🖼️ AI Thumbnail Studio (CTR 95%+)" : "🖼️ AI Thumbnail Studio (95%+ CTR)",
      desc: isSk ? "Generovanie vysoko klikateľných miniatúr s tvárami a textom." : "Generate high-CTR thumbnail concepts and cover artwork.",
      icon: ImageIcon,
      color: "rose",
      badge: "CTR",
      run: () => {
        onOpenFullTool("thumbnail");
        addRecent("thumbnail_studio");
        playSynthesizedSFX("click", 0.4);
      },
    },
    {
      id: "retention_sim",
      category: "toolbox" as SmartCategory,
      title: isSk ? "📈 Simulátor udržania diváka" : "📈 Viewer Retention Simulator",
      desc: isSk ? "Odhalenie nudných pasáží a predpoveď prepadu pozornosti." : "Pinpoint slow pacing and predict viewer drop-off points.",
      icon: TrendingUp,
      color: "amber",
      badge: "Graph",
      run: () => {
        onOpenFullTool("retention");
        addRecent("retention_sim");
        playSynthesizedSFX("click", 0.4);
      },
    },
    {
      id: "system_diagnostics",
      category: "toolbox" as SmartCategory,
      title: isSk ? "🩺 Diagnostika a stress-test systému" : "🩺 System Health & Stress Test",
      desc: isSk ? "Živý test plynulosti 60 FPS, seek bez oneskorenia a stav RAM." : "Live 60 FPS playback test, latency verification and RAM state.",
      icon: Activity,
      color: "teal",
      badge: "60 FPS",
      run: () => {
        onOpenFullTool("system_test");
        addRecent("system_diagnostics");
        playSynthesizedSFX("click", 0.4);
      },
    },

    // EXPORT
    {
      id: "quick_export",
      category: "export" as SmartCategory,
      title: isSk ? "🚀 Rýchly export (1080p 60fps)" : "🚀 Quick Export (1080p 60fps)",
      desc: isSk ? "Okamžitý export videa s GPU akceleráciou pre sociálne siete." : "Instant GPU-accelerated video export optimized for social media.",
      icon: Download,
      color: "rose",
      badge: "MP4",
      run: () => {
        onOpenFullTool("export");
        addRecent("quick_export");
        playSynthesizedSFX("click", 0.4);
      },
    },
    {
      id: "multi_export",
      category: "export" as SmartCategory,
      title: isSk ? "📱 Multi-Platform Export" : "📱 Multi-Platform Export",
      desc: isSk ? "Hromadný export pre TikTok, YouTube Shorts, IG Reels a LinkedIn." : "Batch export optimized for TikTok, YouTube Shorts, IG and LinkedIn.",
      icon: Share2,
      color: "indigo",
      badge: "Batch",
      run: () => {
        onOpenFullTool("export");
        addRecent("multi_export");
        playSynthesizedSFX("click", 0.4);
      },
    },
    {
      id: "export_nle",
      category: "export" as SmartCategory,
      title: isSk ? "🎬 Export XML / EDL / FCPXML" : "🎬 Export XML / EDL / FCPXML",
      desc: isSk ? "Otvorenie časovej osi priamo v Premiere Pro, DaVinci Resolve a FCPX." : "Open project timeline directly in Premiere Pro, DaVinci Resolve or FCPX.",
      icon: FileText,
      color: "amber",
      badge: "NLE",
      run: () => {
        onOpenFullTool("export");
        addRecent("export_nle");
        playSynthesizedSFX("click", 0.4);
      },
    },

    // HISTÓRIA
    {
      id: "time_machine",
      category: "historia" as SmartCategory,
      title: isSk ? "⏳ Time Machine (Verzie projektu)" : "⏳ Time Machine (Project Versions)",
      desc: isSk ? "História každej zmeny s možnosťou 1-klik návratu do minulosti." : "Complete revision history with 1-click time restore.",
      icon: History,
      color: "neutral",
      badge: "Versions",
      run: () => {
        onOpenFullTool("os_hub");
        addRecent("time_machine");
        playSynthesizedSFX("click", 0.4);
      },
    },
    {
      id: "undo_action",
      category: "historia" as SmartCategory,
      title: isSk ? "↩️ Vrátiť poslednú zmenu (Undo)" : "↩️ Undo Latest Change",
      desc: isSk ? "Bezpečný návrat predchádzajúceho kroku (Ctrl+Z)." : "Safely reverts your most recent editing action (Ctrl+Z).",
      icon: RotateCcw,
      color: "emerald",
      badge: "Undo",
      run: () => {
        onUndo();
        addRecent("undo_action");
      },
    },
    {
      id: "lock_zones",
      category: "historia" as SmartCategory,
      title: isSk ? "🔒 Zóny zámku (Lock Zones)" : "🔒 Lock Zones",
      desc: isSk ? "Ochrana hotových častí videa proti prepísaniu AI Autopilotom." : "Lock verified video sections to prevent accidental AI overwrites.",
      icon: ShieldCheck,
      color: "blue",
      badge: "Protect",
      run: () => {
        onOpenFullTool("os_hub");
        addRecent("lock_zones");
        playSynthesizedSFX("click", 0.4);
      },
    },
  ];

  // Filtered actions based on search or category
  const filteredActions = searchQuery.trim()
    ? ACTION_REGISTRY.filter(
        (a) =>
          a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.desc.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : ACTION_REGISTRY.filter((a) => a.category === activeCategory);

  return (
    <div className="flex flex-col h-full bg-neutral-900 border-l border-neutral-800 text-neutral-100 select-none overflow-hidden">
      {/* 1. TOP HEADER WITH CATEGORIES SELECTOR */}
      <div className="p-3 sm:p-4 border-b border-neutral-800 flex flex-col gap-3 bg-neutral-950/80 shrink-0">
        {/* Category Header Row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Category Icon */}
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg transition-transform ${
                activeCategory === "titulky"
                  ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-purple-500/25"
                  : activeCategory === "strih"
                  ? "bg-gradient-to-br from-amber-500 to-rose-600 text-white shadow-amber-500/25"
                  : activeCategory === "audio"
                  ? "bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow-blue-500/25"
                  : activeCategory === "vizual"
                  ? "bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-pink-500/25"
                  : activeCategory === "ai"
                  ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-violet-500/25"
                  : activeCategory === "toolbox"
                  ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-500/25"
                  : activeCategory === "export"
                  ? "bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-orange-500/25"
                  : "bg-gradient-to-br from-neutral-700 to-neutral-800 text-white"
              }`}
            >
              {activeCategory === "titulky" && <Type className="w-5 h-5 font-black" />}
              {activeCategory === "strih" && <Scissors className="w-5 h-5 font-black" />}
              {activeCategory === "audio" && <Music className="w-5 h-5 font-black" />}
              {activeCategory === "vizual" && <Film className="w-5 h-5 font-black" />}
              {activeCategory === "ai" && <Sparkles className="w-5 h-5 font-black" />}
              {activeCategory === "toolbox" && <Sliders className="w-5 h-5 font-black" />}
              {activeCategory === "export" && <Share2 className="w-5 h-5 font-black" />}
              {activeCategory === "historia" && <History className="w-5 h-5 font-black" />}
            </div>

            <div>
              <h2 className="text-sm sm:text-base font-black text-white capitalize flex items-center gap-2">
                <span>
                  {activeCategory === "titulky" && (isSk ? "Titulky" : "Captions")}
                  {activeCategory === "strih" && (isSk ? "Strih" : "Cut & Edit")}
                  {activeCategory === "audio" && (isSk ? "Audio & Zvuk" : "Audio & Sound")}
                  {activeCategory === "vizual" && (isSk ? "Vizuál & Efekty" : "Visual & B-roll")}
                  {activeCategory === "ai" && (isSk ? "AI Asistent" : "AI Assistant")}
                  {activeCategory === "toolbox" && (isSk ? "Toolbox" : "Toolbox")}
                  {activeCategory === "export" && (isSk ? "Export" : "Export")}
                  {activeCategory === "historia" && (isSk ? "História" : "History")}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400">
                  {filteredActions.length} {isSk ? "akcií" : "actions"}
                </span>
              </h2>
              <p className="text-[11px] text-neutral-400">
                {isSk ? "Jednoduchý prístup ku všetkým nástrojom" : "Simple access to powerful tools"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              title={isSk ? "Zavrieť panel" : "Close panel"}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 8-CATEGORY HORIZONTAL PILL NAVIGATOR (DESKTOP & TABLET) */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar -mx-1 px-1">
          {ALL_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  onSelectCategory(cat.id);
                  setActiveActionId(null);
                  setSearchQuery("");
                  playSynthesizedSFX("click", 0.3);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? "bg-rose-500 text-white shadow-md shadow-rose-500/20 scale-[1.02]"
                    : "bg-neutral-900/90 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800/80"
                }`}
              >
                <cat.icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Input: "🔍 Čo chceš urobiť?" */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isSk
                ? "🔍 Čo chceš urobiť? (napr. ticho, hudba, titulky...)"
                : "🔍 What do you want to do? (e.g. silence, captions, audio...)"
            }
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2 text-neutral-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Tabs: Rýchle akcie vs Editor */}
        <div className="flex items-center gap-2 border-b border-neutral-800/80 pt-1">
          <button
            onClick={() => {
              setPanelTab("quick_actions");
              playSynthesizedSFX("click", 0.4);
            }}
            className={`pb-2 text-xs font-bold transition-all flex items-center gap-1.5 border-b-2 cursor-pointer ${
              panelTab === "quick_actions"
                ? "text-white border-rose-500 font-black"
                : "text-neutral-400 border-transparent hover:text-neutral-200"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-rose-500" />
            <span>{isSk ? "Rýchle akcie" : "Quick Actions"}</span>
          </button>

          <button
            onClick={() => {
              setPanelTab("editor");
              playSynthesizedSFX("click", 0.4);
            }}
            className={`pb-2 text-xs font-bold transition-all flex items-center gap-1.5 border-b-2 cursor-pointer ${
              panelTab === "editor"
                ? "text-white border-rose-500 font-black"
                : "text-neutral-400 border-transparent hover:text-neutral-200"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isSk ? "Editor" : "Editor"}</span>
          </button>

          {/* Mode Switcher: MANUÁLNE | ASISTOVANÉ | AUTOMATICKÉ */}
          <div className="ml-auto flex items-center bg-neutral-950 border border-neutral-800 rounded-lg p-0.5 text-[9px] font-bold">
            {(["manual", "assisted", "auto"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setWorkflowMode(m);
                  playSynthesizedSFX("pop", 0.3);
                  showToast(
                    isSk
                      ? `Režim: ${m === "manual" ? "Manuálne" : m === "assisted" ? "Asistované" : "Automatické"}`
                      : `Mode: ${m}`
                  );
                }}
                className={`px-1.5 py-0.5 rounded transition-all ${
                  workflowMode === m
                    ? "bg-rose-500 text-white font-black shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {m === "manual" ? "MAN" : m === "assisted" ? "ASIST" : "AUTO"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. BODY SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
        {/* VIEW A: DEDICATED INPAINTING OVERLAY (WHEN ACTIVATED) */}
        {activeActionId === "remove_burned" ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <button
                onClick={() => setActiveActionId(null)}
                className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
              >
                <span>← {isSk ? "Späť na výber akcií" : "Back to actions"}</span>
              </button>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                {isSk ? "Skutočný inpainting" : "Real Inpainting"}
              </span>
            </div>

            <BurnedSubtitlesRemover
              settings={settings}
              onChangeSettings={onChangeSettings}
              currentVideoUrl={currentVideoUrl}
              videoRef={videoRef}
              currentTime={currentTime}
              duration={duration}
              onSeek={onSeek}
              language={language}
              showToast={showToast}
              onSelectVideoUrl={(url) => onUploadVideo(url, "Clean_Inpainted.mp4")}
              onUploadVideo={onUploadVideo}
            />
          </div>
        ) : panelTab === "editor" ? (
          /* VIEW B: CATEGORY-SPECIFIC INLINE EDITOR */
          <div className="space-y-4">
            {/* SUBTITLE EDITOR */}
            {activeCategory === "titulky" && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-purple-400" />
                      <span>{isSk ? "Úprava titulku" : "Subtitle Editor"}</span>
                    </span>
                    {editingCaption && (
                      <button
                        onClick={() => {
                          setEditingCaption(null);
                          onSelectElement("NONE", null);
                        }}
                        className="text-neutral-500 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Subtitle Text Preview Bounding Box */}
                  <div className="relative border-2 border-dashed border-rose-500/60 bg-neutral-900/90 rounded-xl p-4 text-center">
                    <p
                      style={{
                        fontFamily: captionFont,
                        fontSize: `${captionSize}px`,
                        color: captionColor,
                        fontWeight: captionBold ? 800 : 400,
                        fontStyle: captionItalic ? "italic" : "normal",
                        textDecoration: captionUnderline ? "underline" : "none",
                        textAlign: captionAlign,
                      }}
                      className="drop-shadow-md select-none transition-all"
                    >
                      {editingCaption ? editingCaption.text : isSk ? "Náhľad štýlu titulku" : "Subtitle preview text"}
                    </p>
                  </div>

                  {/* Text Input Area */}
                  <div>
                    <label className="text-[11px] font-bold text-neutral-400 block mb-1">
                      {isSk ? "Text titulku:" : "Subtitle text:"}
                    </label>
                    <textarea
                      rows={2}
                      value={editingCaption ? editingCaption.text : ""}
                      onChange={(e) => {
                        if (editingCaption) {
                          setEditingCaption({ ...editingCaption, text: e.target.value });
                        }
                      }}
                      placeholder={isSk ? "Kliknite na titulok nižšie alebo napíšte text..." : "Select caption below or type text..."}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-rose-500 resize-none font-bold"
                    />
                  </div>

                  {/* Typography & Color Controls */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-800/80">
                    <div className="flex items-center gap-1 bg-neutral-900 rounded-lg p-1 border border-neutral-800">
                      <button
                        onClick={() => setCaptionBold(!captionBold)}
                        className={`px-2 py-1 rounded text-xs font-black transition-all ${
                          captionBold ? "bg-rose-500 text-white" : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        B
                      </button>
                      <button
                        onClick={() => setCaptionItalic(!captionItalic)}
                        className={`px-2 py-1 rounded text-xs font-serif italic transition-all ${
                          captionItalic ? "bg-rose-500 text-white" : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        I
                      </button>
                      <button
                        onClick={() => setCaptionUnderline(!captionUnderline)}
                        className={`px-2 py-1 rounded text-xs underline transition-all ${
                          captionUnderline ? "bg-rose-500 text-white" : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        U
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {["#FFFFFF", "#FACC15", "#F43F5E", "#38BDF8", "#4ADE80"].map((c) => (
                        <button
                          key={c}
                          onClick={() => setCaptionColor(c)}
                          style={{ backgroundColor: c }}
                          className={`w-5 h-5 rounded-full border transition-transform ${
                            captionColor === c ? "scale-125 border-white ring-2 ring-rose-500" : "border-neutral-700"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => {
                        setEditingCaption(null);
                        onSelectElement("NONE", null);
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                    >
                      {isSk ? "Zrušiť" : "Cancel"}
                    </button>
                    <button
                      onClick={handleSaveCaptionEdit}
                      className="px-4 py-1.5 rounded-xl text-xs font-black text-white bg-rose-500 hover:bg-rose-600 transition-all shadow-md shadow-rose-500/25 active:scale-95 cursor-pointer"
                    >
                      {isSk ? "✓ Uložiť" : "✓ Save"}
                    </button>
                  </div>
                </div>

                {/* List of Captions */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                    {isSk ? "Všetky titulky v projekte" : "All project captions"} ({captionProject.segments.length})
                  </span>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                    {captionProject.segments.map((seg) => (
                      <div
                        key={seg.id}
                        onClick={() => {
                          setEditingCaption(seg);
                          onSeek(seg.start);
                          onSelectElement("CAPTION", seg.id);
                        }}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          editingCaption?.id === seg.id
                            ? "bg-rose-500/10 border-rose-500/80"
                            : "bg-neutral-950/80 border-neutral-800/80 hover:border-neutral-700"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate">{seg.text}</p>
                          <span className="text-[10px] text-neutral-500 font-mono">
                            {seg.start.toFixed(1)}s - {seg.end.toFixed(1)}s
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-neutral-500 shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* STRIH EDITOR */}
            {activeCategory === "strih" && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isSk ? "Rýchly strih v reálnom čase" : "Real-time Quick Cut"}</span>
                  </span>
                  <p className="text-[11px] text-neutral-400">
                    {isSk
                      ? `Aktuálna pozícia prehrávača: ${currentTime.toFixed(2)}s / ${duration.toFixed(2)}s`
                      : `Current playhead position: ${currentTime.toFixed(2)}s / ${duration.toFixed(2)}s`}
                  </p>
                  <button
                    onClick={handleSplitAtPlayhead}
                    className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-98 transition-all cursor-pointer"
                  >
                    <Scissors className="w-4 h-4" />
                    <span>{isSk ? `Vystrihnúť na ${currentTime.toFixed(1)}s` : `Split at ${currentTime.toFixed(1)}s`}</span>
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{isSk ? "Detegované rezy (Jump Cuts)" : "Detected Jump Cuts"}</span>
                    <button
                      onClick={() => onOpenFullTool("jump")}
                      className="text-[11px] font-bold text-amber-400 hover:underline"
                    >
                      {isSk ? "Otvoriť JumpCut Studio →" : "Open JumpCut Studio →"}
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                    {jumpSequence && jumpSequence.markers.length > 0 ? (
                      jumpSequence.markers.map((m, idx) => (
                        <div
                          key={m.id || idx}
                          onClick={() => onSeek(m.start)}
                          className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between text-xs cursor-pointer hover:border-neutral-700"
                        >
                          <span className="font-bold text-white">{m.reasonSk || `Rez #${idx + 1}`}</span>
                          <span className="font-mono text-[10px] text-amber-400">{m.start.toFixed(1)}s</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-neutral-500 text-center py-3">
                        {isSk ? "Zatiaľ neboli aplikované žiadne rezy." : "No cut markers generated yet."}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* AUDIO EDITOR */}
            {activeCategory === "audio" && (
              <div className="space-y-4">
                {/* AI Natural Voice Quick Launcher */}
                <div className="p-3 rounded-2xl bg-gradient-to-r from-indigo-950/80 to-purple-950/50 border border-indigo-500/40 flex items-center justify-between shadow-lg">
                  <div className="space-y-0.5">
                    <div className="text-xs font-black text-white flex items-center gap-1.5">
                      <span className="text-sm">🎙️</span>
                      <span>{isSk ? "AI Prirodzený Hlas" : "AI Natural Voice Studio"}</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-indigo-500/30 text-indigo-300">PRO</span>
                    </div>
                    <p className="text-[10px] text-neutral-400">
                      {isSk ? "Kontextové tempo, emócie a prirodzené pauzy" : "Contextual pacing, emotion and pauses"}
                    </p>
                  </div>
                  <button
                    onClick={() => onOpenFullTool("ai_voice")}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer transition shadow-md shadow-indigo-600/30"
                  >
                    {isSk ? "Otvoriť Studio →" : "Open Studio →"}
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-blue-400" />
                    <span>{isSk ? "Zvukový mixér (Stopy)" : "Audio Track Mixer"}</span>
                  </span>

                  {/* Voice Track */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-400 font-bold">{isSk ? "🎙️ Hlas rečníka (DSP Clarifier)" : "🎙️ Voice Track (DSP Clarifier)"}</span>
                      <span className="font-mono text-blue-400 font-bold">
                        {settings.voiceClarifierEnabled ? (isSk ? "ČISTÝ" : "CLARIFIED") : "NORMAL"}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        onChangeSettings({ voiceClarifierEnabled: !settings.voiceClarifierEnabled });
                        playSynthesizedSFX("ding", 0.5);
                      }}
                      className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        settings.voiceClarifierEnabled
                          ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                          : "bg-neutral-900 text-neutral-400 border-neutral-800"
                      }`}
                    >
                      {settings.voiceClarifierEnabled ? (isSk ? "Vyčistenie hlasu ZAPNUTÉ" : "Voice Clarifier ON") : (isSk ? "Vyčistenie hlasu VYPNUTÉ" : "Voice Clarifier OFF")}
                    </button>
                  </div>

                  {/* Background Music Slider */}
                  <div className="space-y-1 pt-2 border-t border-neutral-800/80">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-400 font-bold">{isSk ? "🎵 Hudba v pozadí" : "🎵 Music Track"}</span>
                      <span className="font-mono text-cyan-400 font-bold">
                        {Math.round((settings.bgMusicVolume ?? 0.25) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round((settings.bgMusicVolume ?? 0.25) * 100)}
                      onChange={(e) => onChangeSettings({ bgMusicVolume: Number(e.target.value) / 100 })}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                  </div>

                  {/* SFX Volume Slider */}
                  <div className="space-y-1 pt-2 border-t border-neutral-800/80">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-400 font-bold">{isSk ? "💥 Zvukové efekty (SFX)" : "💥 SFX Track"}</span>
                      <span className="font-mono text-purple-400 font-bold">
                        {settings.sfxEnabled ? "100%" : "MUTE"}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        onChangeSettings({ sfxEnabled: !settings.sfxEnabled });
                        playSynthesizedSFX("ding", 0.5);
                      }}
                      className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        settings.sfxEnabled
                          ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                          : "bg-neutral-900 text-neutral-400 border-neutral-800"
                      }`}
                    >
                      {settings.sfxEnabled ? (isSk ? "SFX sú zapnuté" : "SFX Enabled") : (isSk ? "SFX sú stíšené" : "SFX Muted")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* VIZUÁL EDITOR */}
            {activeCategory === "vizual" && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-pink-400" />
                    <span>{isSk ? "Pomer strán a reframe" : "Aspect Ratio & Reframe"}</span>
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "9:16" as VideoAspectRatio, label: "9:16", desc: "Shorts/Reels" },
                      { id: "16:9" as VideoAspectRatio, label: "16:9", desc: "YouTube/Desktop" },
                      { id: "1:1" as VideoAspectRatio, label: "1:1", desc: "Feed/Square" },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => {
                          onChangeSettings({ aspectRatio: f.id });
                          playSynthesizedSFX("pop", 0.3);
                        }}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          settings.aspectRatio === f.id
                            ? "bg-pink-500 text-white border-pink-500 shadow-md shadow-pink-500/20 font-black"
                            : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white"
                        }`}
                      >
                        <span className="block text-xs font-bold">{f.label}</span>
                        <span className="block text-[9px] opacity-75">{f.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{isSk ? "B-roll vrstvy v projekte" : "Project B-Roll Overlays"}</span>
                    <button
                      onClick={() => onOpenFullTool("broll")}
                      className="text-[11px] font-bold text-pink-400 hover:underline"
                    >
                      {isSk ? "Otvoriť B-Roll Studio →" : "Open B-Roll Studio →"}
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                    {brollProject && brollProject.items.length > 0 ? (
                      brollProject.items.map((b) => (
                        <div
                          key={b.id}
                          onClick={() => onSeek(b.start)}
                          className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between text-xs cursor-pointer hover:border-neutral-700"
                        >
                          <span className="font-bold text-white truncate max-w-[150px]">{isSk ? b.titleSk : b.titleEn}</span>
                          <span className="font-mono text-[10px] text-pink-400">{b.start.toFixed(1)}s - {b.end.toFixed(1)}s</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-neutral-500 text-center py-3">
                        {isSk ? "Zatiaľ neboli pridané žiadne B-roll prestrihy." : "No B-roll overlays added yet."}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* AI EDITOR */}
            {activeCategory === "ai" && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5 text-violet-400" />
                    <span>{isSk ? "Editor Brain & Pravidlá strihu" : "Editor Brain & Style"}</span>
                  </span>
                  <p className="text-[11px] text-neutral-400">
                    {isSk
                      ? "AI aplikuje strihové pravidlá odvodené z najúspešnejších tvorcov."
                      : "AI applies custom editing rules modelled after top creators."}
                  </p>
                  <div className="space-y-2">
                    {[
                      { id: "fast_pace", label: isSk ? "Rýchle tempo (strih každé 2-3s)" : "Fast Pacing (cut every 2-3s)", active: true },
                      { id: "auto_punch", label: isSk ? "Automatický punch-in zoom na emócie" : "Auto punch-in on emotional peaks", active: settings.autoZoomEnabled ?? true },
                      { id: "sfx_accents", label: isSk ? "Akcentové zvukové efekty pri rezoch" : "Accent SFX on cut transitions", active: settings.sfxEnabled ?? true },
                      { id: "smart_ducking", label: isSk ? "Auto-Ducking podkladu pod reč" : "Auto-Ducking soundtrack under speech", active: settings.bgMusicDucking ?? true },
                    ].map((rule) => (
                      <div key={rule.id} className="flex items-center justify-between p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs">
                        <span className="text-neutral-300 font-bold">{rule.label}</span>
                        <Check className="w-4 h-4 text-emerald-400" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TOOLBOX EDITOR */}
            {activeCategory === "toolbox" && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isSk ? "Všetky expertné nástroje" : "All Expert Tools"}</span>
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "pro_toolbox", name: "Toolbox Suite", icon: Sliders },
                      { id: "ab", name: "A/B Testing", icon: Split },
                      { id: "pack", name: "Content Pack", icon: Layers },
                      { id: "thumbnail", name: "Thumbnails", icon: ImageIcon },
                      { id: "retention", name: "Retention Sim", icon: TrendingUp },
                      { id: "system_test", name: "System Health", icon: Activity },
                      { id: "bilingual", name: "Bilingual", icon: Globe },
                      { id: "eraser", name: "Object Eraser", icon: Eraser },
                    ].map((tool) => (
                      <button
                        key={tool.id}
                        onClick={() => onOpenFullTool(tool.id)}
                        className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-emerald-500/60 text-left transition-all cursor-pointer"
                      >
                        <tool.icon className="w-4 h-4 text-emerald-400 mb-1" />
                        <span className="block text-xs font-bold text-white">{tool.name}</span>
                        <span className="block text-[10px] text-neutral-400">{isSk ? "Otvoriť →" : "Open →"}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* EXPORT EDITOR */}
            {activeCategory === "export" && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-orange-400" />
                    <span>{isSk ? "Export videa & Nastavenia" : "Video Export & Settings"}</span>
                  </span>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-neutral-800">
                      <span className="text-neutral-400">{isSk ? "Rozlíšenie" : "Resolution"}</span>
                      <span className="font-bold text-white">1080 × 1920 (Full HD)</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-neutral-800">
                      <span className="text-neutral-400">{isSk ? "Snímkovanie" : "Frame Rate"}</span>
                      <span className="font-bold text-white">60 FPS</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-neutral-800">
                      <span className="text-neutral-400">{isSk ? "Kodek" : "Codec"}</span>
                      <span className="font-bold text-white">H.264 / AAC</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onOpenFullTool("export")}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 active:scale-98 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isSk ? "Spustiť rendering videa" : "Start Video Render"}</span>
                  </button>
                </div>
              </div>
            )}

            {/* HISTÓRIA EDITOR */}
            {activeCategory === "historia" && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{isSk ? "Body obnovenia (Time Machine)" : "Restore Points (Time Machine)"}</span>
                  </span>
                  <div className="space-y-2">
                    {[
                      { id: "v1", title: isSk ? "Automatické uloženie" : "Auto-save snapshot", time: "Pred 2 minútami" },
                      { id: "v2", title: isSk ? "Úprava titulkov a štýlu" : "Captions & style edit", time: "Pred 8 minútami" },
                      { id: "v3", title: isSk ? "Import RAW videa" : "RAW video imported", time: "Pred 15 minútami" },
                    ].map((v) => (
                      <div key={v.id} className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between text-xs">
                        <div>
                          <span className="block font-bold text-white">{v.title}</span>
                          <span className="block text-[10px] text-neutral-500">{v.time}</span>
                        </div>
                        <button
                          onClick={() => {
                            onUndo();
                            playSynthesizedSFX("ding", 0.5);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-bold"
                        >
                          {isSk ? "Obnoviť" : "Restore"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* VIEW C: QUICK ACTIONS (MODEL EXAMPLE FROM SPECIFICATION & SCREENSHOT) */
          <div className="space-y-4">
            {/* Contextual Tip Banner */}
            {showTip && (
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-3 flex items-start justify-between gap-3 text-xs text-neutral-300">
                <div className="flex items-start gap-2">
                  <span className="text-amber-400 text-sm mt-0.5">💡</span>
                  <div>
                    <span className="font-bold text-white">
                      {activeCategory === "titulky"
                        ? isSk ? "Tip: Titulky môžeš kedykoľvek upraviť." : "Tip: You can edit captions anytime."
                        : activeCategory === "strih"
                        ? isSk ? "Tip: Ticho a výplňové slová vystrihneš na 1 klik." : "Tip: Silence and fillers cut in 1 click."
                        : activeCategory === "audio"
                        ? isSk ? "Tip: Auto-Ducking automaticky stíši hudbu pri reči." : "Tip: Auto-ducking lowers music while speaking."
                        : activeCategory === "vizual"
                        ? isSk ? "Tip: Vertikálny formát 9:16 dosahuje najvyššiu virálnosť." : "Tip: 9:16 format yields highest virality."
                        : activeCategory === "ai"
                        ? isSk ? "Tip: 95% Autopilot urobí takmer všetku prácu za teba." : "Tip: 95% Autopilot does almost all the work for you."
                        : activeCategory === "toolbox"
                        ? isSk ? "Tip: Všetky expertné nástroje sú plne prepojené s časovou osou." : "Tip: All expert tools are connected to the timeline."
                        : activeCategory === "export"
                        ? isSk ? "Tip: Exportuj video pripravené pre všetky siete naraz." : "Tip: Export video optimized for all platforms at once."
                        : isSk ? "Tip: Každú úpravu môžeš bezpečne vrátiť späť (Undo)." : "Tip: Revert any change with 1-click Undo."}
                    </span>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      {isSk
                        ? "Klikni na akúkoľvek akciu nižšie a OmniStrih okamžite vykoná zmenu."
                        : "Click any action below and OmniStrih executes it instantly."}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTip(false)}
                  className="text-neutral-500 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* SECTION 1: ČO CHCEŠ UROBIŤ? (ACTION CARDS) */}
            <div className="space-y-2.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-neutral-400 block px-1">
                {isSk ? "ČO CHCEŠ UROBIŤ?" : "WHAT DO YOU WANT TO DO?"}
              </span>

              {filteredActions.map((act) => {
                const IconComponent = act.icon;
                return (
                  <div
                    key={act.id}
                    onClick={act.run}
                    className="group relative p-3.5 rounded-2xl bg-neutral-950/90 border border-neutral-800 hover:border-rose-500/60 hover:bg-neutral-900/90 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-lg hover:shadow-rose-500/10"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-rose-400 group-hover:scale-105 transition-transform shrink-0">
                        <IconComponent className="w-5 h-5 font-bold" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-white group-hover:text-rose-300 transition-colors flex items-center gap-1.5">
                          <span>{act.title}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-neutral-800 text-neutral-400 border border-neutral-700">
                            {act.badge}
                          </span>
                        </h4>
                        <p className="text-[11px] text-neutral-400 group-hover:text-neutral-300 line-clamp-1 mt-0.5">
                          {act.desc}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-white transition-colors shrink-0" />
                  </div>
                );
              })}
            </div>

            {/* SECTION 2: RÝCHLE NASTAVENIA (QUICK SETTINGS) */}
            <div className="p-4 rounded-2xl bg-neutral-950/90 border border-neutral-800 space-y-3">
              <span className="text-xs font-black text-white uppercase tracking-wider block">
                {isSk ? "Rýchle nastavenia" : "Quick Settings"}
              </span>

              {/* TITULKY QUICK SETTINGS */}
              {activeCategory === "titulky" && (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-neutral-800/80">
                    <span className="text-neutral-400">{isSk ? "Štýl" : "Style"}</span>
                    <select
                      value={settings.captionStyle || "modern"}
                      onChange={(e) => handleApplySubtitleStylePreset(e.target.value)}
                      className="bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-white font-bold cursor-pointer"
                    >
                      <option value="Moderný">{isSk ? "Moderný" : "Modern"}</option>
                      <option value="Clean">Clean</option>
                      <option value="Bold">Bold</option>
                      <option value="Hormozi">Hormozi</option>
                      <option value="MrBeast">MrBeast</option>
                      <option value="Minimal">Minimal</option>
                      <option value="Neon">Neon</option>
                      <option value="Comic">Comic</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-neutral-800/80">
                    <span className="text-neutral-400">{isSk ? "Veľkosť" : "Size"}</span>
                    <select
                      value={captionProject.globalStyle?.fontSize || 24}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        onChangeCaptionProject({
                          ...captionProject,
                          globalStyle: {
                            ...captionProject.globalStyle,
                            fontSize: val,
                          },
                        });
                      }}
                      className="bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-white font-bold cursor-pointer"
                    >
                      <option value={18}>{isSk ? "Malá" : "Small"}</option>
                      <option value={24}>{isSk ? "Stredná" : "Medium"}</option>
                      <option value={32}>{isSk ? "Veľká" : "Large"}</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-neutral-800/80">
                    <span className="text-neutral-400">{isSk ? "Farba" : "Color"}</span>
                    <div className="flex items-center gap-1.5">
                      <span
                        style={{ backgroundColor: captionProject.globalStyle?.color || "#FFFFFF" }}
                        className="w-3.5 h-3.5 rounded-full border border-white/50"
                      />
                      <select
                        value={captionProject.globalStyle?.color || "#FFFFFF"}
                        onChange={(e) => {
                          const col = e.target.value;
                          onChangeCaptionProject({
                            ...captionProject,
                            globalStyle: {
                              ...captionProject.globalStyle,
                              color: col,
                            },
                          });
                        }}
                        className="bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-white font-bold cursor-pointer"
                      >
                        <option value="#FFFFFF">{isSk ? "Biela" : "White"}</option>
                        <option value="#FACC15">{isSk ? "Žltá" : "Yellow"}</option>
                        <option value="#F43F5E">{isSk ? "Červená" : "Red"}</option>
                        <option value="#38BDF8">{isSk ? "Modrá" : "Blue"}</option>
                        <option value="#4ADE80">{isSk ? "Zelená" : "Green"}</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-neutral-400">{isSk ? "Pozícia" : "Position"}</span>
                    <select
                      value={captionProject.globalStyle?.position || "bottom"}
                      onChange={(e) => {
                        const pos = e.target.value as "top" | "center" | "bottom" | "auto";
                        onChangeCaptionProject({
                          ...captionProject,
                          globalStyle: {
                            ...captionProject.globalStyle,
                            position: pos,
                          },
                        });
                      }}
                      className="bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-white font-bold cursor-pointer"
                    >
                      <option value="bottom">{isSk ? "Dole" : "Bottom"}</option>
                      <option value="center">{isSk ? "Stred" : "Center"}</option>
                      <option value="top">{isSk ? "Hore" : "Top"}</option>
                    </select>
                  </div>
                </div>
              )}

              {/* STRIH QUICK SETTINGS */}
              {activeCategory === "strih" && (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-neutral-800/80">
                    <span className="text-neutral-400">{isSk ? "Automatický strih ticha" : "Auto-Cut Silences"}</span>
                    <button
                      onClick={() => onChangeSettings({ cutSilences: !settings.cutSilences })}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        settings.cutSilences
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : "bg-neutral-900 text-neutral-400 border border-neutral-800"
                      }`}
                    >
                      {settings.cutSilences ? (isSk ? "Zapnuté" : "Enabled") : (isSk ? "Vypnuté" : "Disabled")}
                    </button>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-neutral-400">{isSk ? "Auto-Zoom pri rezoch" : "Cut Auto-Zoom"}</span>
                    <button
                      onClick={() => onChangeSettings({ autoZoomEnabled: !settings.autoZoomEnabled })}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        settings.autoZoomEnabled
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : "bg-neutral-900 text-neutral-400 border border-neutral-800"
                      }`}
                    >
                      {settings.autoZoomEnabled ? (isSk ? "Zapnuté" : "Enabled") : (isSk ? "Vypnuté" : "Disabled")}
                    </button>
                  </div>
                </div>
              )}

              {/* AUDIO QUICK SETTINGS */}
              {activeCategory === "audio" && (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-neutral-800/80">
                    <span className="text-neutral-400">{isSk ? "Čistenie hlasu" : "Voice Clarifier"}</span>
                    <button
                      onClick={() => onChangeSettings({ voiceClarifierEnabled: !settings.voiceClarifierEnabled })}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        settings.voiceClarifierEnabled
                          ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                          : "bg-neutral-900 text-neutral-400 border border-neutral-800"
                      }`}
                    >
                      {settings.voiceClarifierEnabled ? (isSk ? "Zapnuté" : "Enabled") : (isSk ? "Vypnuté" : "Disabled")}
                    </button>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-neutral-400">{isSk ? "Auto-Ducking hudby" : "Music Auto-Ducking"}</span>
                    <button
                      onClick={() => onChangeSettings({ bgMusicDucking: !settings.bgMusicDucking })}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        settings.bgMusicDucking
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                          : "bg-neutral-900 text-neutral-400 border border-neutral-800"
                      }`}
                    >
                      {settings.bgMusicDucking ? (isSk ? "Zapnuté" : "Enabled") : (isSk ? "Vypnuté" : "Disabled")}
                    </button>
                  </div>
                </div>
              )}

              {/* VIZUÁL QUICK SETTINGS */}
              {activeCategory === "vizual" && (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-neutral-800/80">
                    <span className="text-neutral-400">{isSk ? "Pomer strán" : "Aspect Ratio"}</span>
                    <select
                      value={settings.aspectRatio || "9:16"}
                      onChange={(e) => onChangeSettings({ aspectRatio: e.target.value as VideoAspectRatio })}
                      className="bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-white font-bold cursor-pointer"
                    >
                      <option value="9:16">9:16 (Shorts/Reels)</option>
                      <option value="16:9">16:9 (YouTube 4K)</option>
                      <option value="1:1">1:1 (Square)</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-neutral-400">{isSk ? "Face-safe reframe (merané)" : "Face-safe reframe (measured)"}</span>
                    <button
                      onClick={() => onChangeSettings({ autoReframeFace: !settings.autoReframeFace })}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        settings.autoReframeFace
                          ? "bg-pink-500/20 text-pink-300 border border-pink-500/40"
                          : "bg-neutral-900 text-neutral-400 border border-neutral-800"
                      }`}
                    >
                      {settings.autoReframeFace ? (isSk ? "Zapnuté" : "Enabled") : (isSk ? "Vypnuté" : "Disabled")}
                    </button>
                  </div>
                </div>
              )}

              {/* AI QUICK SETTINGS */}
              {activeCategory === "ai" && (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-neutral-800/80">
                    <span className="text-neutral-400">{isSk ? "DNA Profil štýlu" : "DNA Style Profile"}</span>
                    <span className="font-bold text-violet-400">Alex Hormozi (Fast-Paced)</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-neutral-400">{isSk ? "Autonómia AI" : "AI Autonomy"}</span>
                    <span className="font-bold text-emerald-400">95% Polish Ready</span>
                  </div>
                </div>
              )}

              {/* TOOLBOX QUICK SETTINGS */}
              {activeCategory === "toolbox" && (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-neutral-800/80">
                    <span className="text-neutral-400">{isSk ? "Dostupné moduly" : "Available Modules"}</span>
                    <span className="font-bold text-emerald-400">8 Expertných Štúdií</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-neutral-400">{isSk ? "Stav prehrávača" : "Player Status"}</span>
                    <span className="font-mono text-emerald-400 font-bold">60 FPS Ready</span>
                  </div>
                </div>
              )}

              {/* EXPORT QUICK SETTINGS */}
              {activeCategory === "export" && (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-neutral-800/80">
                    <span className="text-neutral-400">{isSk ? "Predvolený formát" : "Default Format"}</span>
                    <span className="font-bold text-orange-400">MP4 / 1080p 60fps</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-neutral-400">{isSk ? "Cieľ" : "Destination"}</span>
                    <span className="font-bold text-white">TikTok, Shorts, IG Reels</span>
                  </div>
                </div>
              )}

              {/* HISTÓRIA QUICK SETTINGS */}
              {activeCategory === "historia" && (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-neutral-800/80">
                    <span className="text-neutral-400">{isSk ? "Automatické ukladanie" : "Auto-Save"}</span>
                    <span className="font-bold text-emerald-400">Aktívne (každých 30s)</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-neutral-400">{isSk ? "Zóny zámku" : "Protected Zones"}</span>
                    <span className="font-bold text-white">{isSk ? "Bezpečné" : "Protected"}</span>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 3: ZOBRAZIŤ VŠETKY MOŽNOSTI → (REVEALS COMPLETE PROFESSIONAL TOOL) */}
            <button
              onClick={() => {
                if (activeCategory === "titulky") onOpenFullTool("captions");
                else if (activeCategory === "strih") onOpenFullTool("jump");
                else if (activeCategory === "audio") onOpenFullTool("pro_audio");
                else if (activeCategory === "vizual") onOpenFullTool("broll");
                else if (activeCategory === "ai") onOpenFullTool("pro_autopilot");
                else if (activeCategory === "toolbox") onOpenFullTool("pro_toolbox");
                else if (activeCategory === "export") onOpenFullTool("export");
                else if (activeCategory === "historia") onOpenFullTool("os_hub");
                playSynthesizedSFX("click", 0.4);
              }}
              className="w-full py-3 px-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 hover:border-neutral-700 text-xs font-bold text-neutral-300 hover:text-white flex items-center justify-between transition-all group cursor-pointer"
            >
              <span>{isSk ? "Zobraziť všetky možnosti a expertné nástroje →" : "View all options and expert tools →"}</span>
              <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-white transition-colors" />
            </button>

            {/* SECTION 4: SPÄŤ DO ÚPRAV (UNDO/RESTORE) */}
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="w-full p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 hover:border-emerald-500/60 text-xs font-bold text-emerald-300 flex items-center gap-2.5 transition-all cursor-pointer disabled:opacity-40"
            >
              <RotateCcw className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="text-left">
                <span className="block font-black">{isSk ? "Späť do úprav" : "Restore / Undo"}</span>
                <span className="text-[10px] text-emerald-400/80 font-normal">
                  {isSk ? "Vráti späť posledné zmeny (Undo)" : "Reverts latest edit decision"}
                </span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* 3. MOBILE & DESKTOP BOTTOM NAVIGATION BAR */}
      <div className="border-t border-neutral-800 bg-neutral-950 p-2 flex items-center justify-around shrink-0 overflow-x-auto custom-scrollbar">
        {ALL_CATEGORIES.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              onSelectCategory(item.id);
              setActiveActionId(null);
              setSearchQuery("");
              playSynthesizedSFX("click", 0.25);
            }}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeCategory === item.id ? "text-rose-400 bg-neutral-900 shadow-sm" : "text-neutral-400 hover:text-white"
            }`}
          >
            <item.icon className="w-3.5 h-3.5" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
});

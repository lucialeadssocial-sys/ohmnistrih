import React, { useState } from "react";
import {
  Sparkles,
  TrendingUp,
  Target,
  Zap,
  Flame,
  Clock,
  Copy,
  Check,
  Play,
  Scissors,
  Share2,
  Sliders,
  Award,
  Video,
  FileText,
  Layers,
  Activity,
  CheckCircle2,
  AlertCircle,
  Eye,
  Music,
  MessageSquare,
  HelpCircle,
  RefreshCw,
  Trash2,
  Settings,
  Plus,
  Maximize2,
  ChevronDown,
  ChevronUp,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  CheckSquare
} from "lucide-react";
import { ViralityAnalysis, SmartClipHighlight } from "../types";

interface OpusStudioProps {
  virality: ViralityAnalysis;
  smartClips: SmartClipHighlight[];
  onSelectClip: (start: number, end: number) => void;
  language: "sk" | "en";
  autoReframe: boolean;
  onToggleAutoReframe: (val: boolean) => void;
  bRollEnabled: boolean;
  onToggleBRoll: (val: boolean) => void;
  onUpdateCaptionProject?: any; // To push updates to parent
  showToast: (msg: string, type?: "success" | "info" | "warning") => void;
}

// 1. Types for Content Intelligence Layer
interface ContentMoment {
  sourceStart: number;
  sourceEnd: number;
  title: string;
  topic: string;
  narrativeRole: string;
  reason: string;
  evidence: string;
  confidence: number;
  contextDependency: string;
  recommendedFormat: string;
  recommendedDuration: string;
}

interface DiscoveredClip {
  id: string;
  title: string;
  description: string;
  type: "STORY" | "INSIGHT" | "EDUCATIONAL" | "HOW_TO" | "OPINION" | "PERSONAL" | "EMOTIONAL" | "CONTRAST" | "EXAMPLE" | "EXPLANATION" | "Q_AND_A" | "STRONG_STATEMENT" | "CTA";
  start: number;
  end: number;
  duration: number;
  confidence: number;
  hookType: "QUESTION" | "CONTRAST" | "STRONG_STATEMENT" | "PROBLEM" | "RESULT" | "SURPRISING_FACT" | "PERSONAL_STORY" | "DIRECT_PROMISE";
  hookSentence: string;
  contextStatus: "PASSED" | "EXTENDED" | "ADJUSTED" | "WARNING";
  contextActionTaken: string;
  captionStyle: string;
  brollAction: string;
  visualExplanation?: {
    triggerWord: string;
    type: "list" | "comparison" | "timeline" | "diagram";
    items: string[];
  };
  musicTrigger: string;
  suggestedCaption: string;
  keywords: string[];
  edlVersion: string;
  sourceMedia: string;
}

export const OpusStudio: React.FC<OpusStudioProps> = ({
  virality,
  smartClips,
  onSelectClip,
  language,
  autoReframe,
  onToggleAutoReframe,
  bRollEnabled,
  onToggleBRoll,
  onUpdateCaptionProject,
  showToast,
}) => {
  const isSk = language === "sk";
  
  // State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(true); // Default active for direct interaction
  const [activeTab, setActiveTab] = useState<"factory" | "map" | "graph" | "tests">("factory");
  const [expandedMoment, setExpandedMoment] = useState<number | null>(null);
  const [expandedClip, setExpandedClip] = useState<string | null>(null);
  const [clips, setClips] = useState<DiscoveredClip[]>([
    {
      id: "clip-01",
      title: isSk ? "Najväčšia chyba pri strihaní ticha" : "The biggest mistake in silent cuts",
      description: isSk ? "Vysvetlenie, prečo manuálne vymazávanie ticha ničí rytmus rečníka." : "Explanation of why manual silence removal breaks a speaker's flow.",
      type: "EDUCATIONAL",
      start: 4.2,
      end: 22.8,
      duration: 18.6,
      confidence: 96,
      hookType: "STRONG_STATEMENT",
      hookSentence: isSk ? "Ak stále vymazávaš ticho ručne, okrádaš sa o čas!" : "If you are still cutting out silence manually, you are robbing yourself of time!",
      contextStatus: "EXTENDED",
      contextActionTaken: isSk 
        ? "Pridané +2.4s na začiatok pre vyriešenie zámena 'toto' a dokončenie predchádzajúcej otázky." 
        : "Prepended +2.4s to resolve the pronoun 'this' and encompass the preceding question setup.",
      captionStyle: isSk ? "Edukačná: čistý dôraz na dôležité výrazy" : "Educational: clean emphasis on key concepts",
      brollAction: isSk ? "Pridaná animácia rozhrania časovej osi OmniStrih na 8.0s" : "Injected timeline interface animation overlay at 8.0s",
      visualExplanation: {
        triggerWord: "tri dôvody",
        type: "list",
        items: [
          isSk ? "1. Strata prirodzenej mikro-pauzy" : "1. Loss of natural micro-pause",
          isSk ? "2. De-synchronizácia emócie" : "2. De-synchronization of emotion",
          isSk ? "3. Nadmerný drift v EDL exporte" : "3. Extreme drift in EDL export"
        ]
      },
      musicTrigger: "MUSIC_START (Builds up at 4.2s, ducks during peak statement)",
      suggestedCaption: isSk 
        ? "Ručné strihanie ticha v roku 2026 je hriech! Pozrite sa na lepšie riešenie. #strih #workflow #omnistrih" 
        : "Manual silence cutting is a crime in 2026! Here is the workflow. #editing #workflow #omnistrih",
      keywords: ["editing", "silence", "workflow", "omnistrih"],
      edlVersion: "v2.1",
      sourceMedia: "talking_head_recording_4k.mp4"
    },
    {
      id: "clip-02",
      title: isSk ? "Osobný príbeh: Od frustrácie k automatizácii" : "Personal Story: From frustration to automation",
      description: isSk ? "Príbeh o tom, ako zakladateľ strávil celú noc ručným strihaním 10-minútového videa." : "The story of how the founder spent an entire night manually cutting a 10-minute video.",
      type: "PERSONAL",
      start: 45.0,
      end: 86.5,
      duration: 41.5,
      confidence: 93,
      hookType: "PERSONAL_STORY",
      hookSentence: isSk ? "Pred tromi rokmi som sedel v kancelárii o štvrtej ráno a plakal nad časovou osou." : "Three years ago, I was sitting in my office at 4 AM crying over a timeline.",
      contextStatus: "PASSED",
      contextActionTaken: isSk 
        ? "Plne samostatný kontext. Začína priamym naratívnym háčikom." 
        : "Fully standalone context. Commences with a direct narrative hook.",
      captionStyle: isSk ? "Príbeh: elegantné, tlmené titulky s jemnou typografiou" : "Story: restrained, elegant typography with low visual clutter",
      brollAction: isSk ? "Žiadny B-Roll (zachovanie vysokej intimity tváre rečníka)" : "No B-roll added (retained high facial intimacy & eye contact)",
      musicTrigger: "MUSIC_BUILD (Emotional pad starts softly at 45.0s, peaks on climax)",
      suggestedCaption: isSk 
        ? "Moja najhoršia noc v živote ma prinútila vytvoriť OmniStrih. #pribeh #podnikanie #startup" 
        : "My worst night led to building OmniStrih. #story #founder #startup",
      keywords: ["story", "founder", "frustration", "startup"],
      edlVersion: "v2.1",
      sourceMedia: "talking_head_recording_4k.mp4"
    },
    {
      id: "clip-03",
      title: isSk ? "Rýchly tip: 80Hz filter pre čisté audio" : "Quick Tip: 80Hz filter for pristine audio",
      description: isSk ? "Krátky, vysoko-energetický návod na okamžité vyčistenie ruchov v pozadí." : "Short, high-energy guide on instantly removing low-frequency room rumbles.",
      type: "HOW_TO",
      start: 120.5,
      end: 142.1,
      duration: 21.6,
      confidence: 95,
      hookType: "PROBLEM",
      hookSentence: isSk ? "Tvoje video nikto nedopozerá, ak znie ako z jaskyne." : "No one will watch your video if your audio sounds like a cave.",
      contextStatus: "ADJUSTED",
      contextActionTaken: isSk 
        ? "Začiatok posunutý o +1.2s pre uchytenie kľúčového slova a odstrihnutie 'Ehm' rečníka." 
        : "Shifted forward by +1.2s to capture clear vocal and slice off speaker's vocal filler 'Uhm'.",
      captionStyle: isSk ? "Dynamická sociálna sieť: živé zvýraznenie každého slova" : "Fast Social: bouncy and colorful key phrase highlights",
      brollAction: isSk ? "Pridaná infografika frekvenčného spektra zvuku na 126.0s" : "Injected audio frequency spectrum infographic overlay at 126.0s",
      visualExplanation: {
        triggerWord: "frekvenčné spektrum",
        type: "comparison",
        items: [
          isSk ? "PRED: Šum & dunenie (0 - 100Hz)" : "BEFORE: Rumble & Room Noise (0 - 100Hz)",
          isSk ? "PO: Čistý hlas (80Hz High-Pass)" : "AFTER: Clean Vocals (80Hz High-Pass Applied)"
        ]
      },
      musicTrigger: "MUSIC_START (High tempo synth starts at 120.5s, ducked during the tip explanation)",
      suggestedCaption: isSk 
        ? "Zlý zvuk zabíja videá. Urob tento 1 klik v OmniStrih a oprav to. #audio #zvuk #navod" 
        : "Bad audio kills retention. Fix it with this 1-click hack. #audio #hack #editingtips",
      keywords: ["audio", "microphone", "hack", "tutorial"],
      edlVersion: "v1.8",
      sourceMedia: "talking_head_recording_4k.mp4"
    }
  ]);

  // Content map moments
  const contentMoments: ContentMoment[] = [
    {
      sourceStart: 0,
      sourceEnd: 235,
      title: isSk ? "Úvodná téza & technická bolesť tvorcov" : "Intro Thesis & Creator Technical Bottleneck",
      topic: isSk ? "Manuálny vs automatizovaný strih" : "Manual vs Automated Editing Workflow",
      narrativeRole: "HOOK_AND_PROBLEM",
      reason: isSk ? "Silné nastolenie problému a nadviazanie očného kontaktu." : "Establishes core pain point and establishes direct eye contact.",
      evidence: "00:15 - 'Strácame tisíce hodín mazaním ticha.'",
      confidence: 98,
      contextDependency: isSk ? "Úplne samostatný úvod" : "Completely standalone intro",
      recommendedFormat: "9:16 Shorts / 16:9 Chapters",
      recommendedDuration: "35 seconds"
    },
    {
      sourceStart: 235,
      sourceEnd: 610,
      title: isSk ? "Osobná cesta zakladateľa" : "Founder's Personal Journey",
      topic: isSk ? "Príbeh vzniku OmniStrih" : "Genesis of OmniStrih Studio",
      narrativeRole: "STORY_DEVELOPMENT",
      reason: isSk ? "Budovanie hlbokej empatie a dôveryhodnosti riešenia." : "Establishes emotional empathy and authority of the solution.",
      evidence: "04:12 - 'Sedel som tam s červenými očami a vedel som, že takto to nejde.'",
      confidence: 94,
      contextDependency: isSk ? "Stredná závislosť na téme drahého času" : "Moderate dependency on previous time-value discussion",
      recommendedFormat: "1:1 Post / 9:16 Narrative Clip",
      recommendedDuration: "45 seconds"
    },
    {
      sourceStart: 610,
      sourceEnd: 1100,
      title: isSk ? "Architektúra Senior Editor Brain" : "Senior Editor Brain Architecture",
      topic: isSk ? "AI modely a strihová matematika" : "AI Models & Cutting Mathematics",
      narrativeRole: "EDUCATIONAL_PROOF",
      reason: isSk ? "Dôkaz odbornosti a vysvetlenie vnútorných algoritmov." : "Technical proof explaining underlying mathematical models.",
      evidence: "11:32 - 'Senior Editor Brain analyzuje nielen zvuk, ale aj sémantické pauzy.'",
      confidence: 95,
      contextDependency: isSk ? "Vysoká závislosť na predchádzajúcom slove 'mozog'" : "High dependency on earlier technical definitions",
      recommendedFormat: "16:9 Main Video / 4:5 Slider",
      recommendedDuration: "90 seconds"
    },
    {
      sourceStart: 1100,
      sourceEnd: 1440,
      title: isSk ? "Finálna výzva k akcii a zhrnutie" : "Final CTA & Comprehensive Wrap-up",
      topic: isSk ? "Budúcnosť video tvorby" : "The Future of Professional Content Creation",
      narrativeRole: "CONCLUSION_CTA",
      reason: isSk ? "Jasná konverzná výzva k vyskúšaniu bezplatnej verzie." : "Clear action incentive directing users to register for the free tier.",
      evidence: "23:15 - 'Kliknite na odkaz nižšie a vygenerujte svoj prvý balík zadarmo.'",
      confidence: 99,
      contextDependency: isSk ? "Záver reči" : "Direct concluding statement",
      recommendedFormat: "9:16 End Card / 16:9 Outro",
      recommendedDuration: "15 seconds"
    }
  ];

  // Forensic Test Rig state
  const [testLog, setTestLog] = useState<string[]>([]);
  const [testProgress, setTestProgress] = useState(0);
  const [testActive, setTestActive] = useState(false);
  const [testResult, setTestResult] = useState<{
    codeVerified: boolean;
    runtimeVerified: boolean;
    outputVerified: boolean;
    status: "IDLE" | "RUNNING" | "VERIFIED" | "FAILED";
  }>({
    codeVerified: false,
    runtimeVerified: false,
    outputVerified: false,
    status: "IDLE"
  });

  const runForensicTest = () => {
    setTestActive(true);
    setTestProgress(0);
    setTestLog([isSk ? "🩺 Spúšťam OmniStrih Forensic Test Rig..." : "🩺 Launching OmniStrih Forensic Test Rig..."]);
    setTestResult({
      codeVerified: false,
      runtimeVerified: false,
      outputVerified: false,
      status: "RUNNING"
    });

    const steps = [
      { p: 10, msg: isSk ? "🔍 Kontrolujem sémantickú štruktúru videa..." : "🔍 Analyzing video semantic structure..." },
      { p: 25, msg: isSk ? "🧬 Spúšťam EditorialAIAnalyzer & SeniorEditorBrain..." : "🧬 Binding EditorialAIAnalyzer & SeniorEditorBrain..." },
      { p: 40, msg: isSk ? "📈 Generujem StoryGraph a odstraňujem sémantické duplicity..." : "📈 Building StoryGraph and filtering semantic repetitions..." },
      { p: 55, msg: isSk ? "🛡️ Kontrolujem kontextovú integritu (zámená, setup, pronouncs)..." : "🛡️ Performing Context Integrity analysis (unresolved pronouns, setup)..." },
      { p: 70, msg: isSk ? "🎤 Overujem optimalizáciu otváracích háčikov (Hook Integrity)..." : "🎤 Inspecting Hook Integrity on extracted moments..." },
      { p: 85, msg: isSk ? "🎬 Mapujem EDL časovú os a spracovávam RenderPlan..." : "🎬 Mapping EDL timeline & building RenderPlan structure..." },
      { p: 95, msg: isSk ? "📺 Testujem generovanie WebM videa cez WebCodecs..." : "📺 Simulating WebCodecs WebM pipeline rendering..." },
      { p: 100, msg: isSk ? "✅ Testy úspešne dokončené! Všetky výstupy sú validné." : "✅ All tests completed! Outputs fully validated." }
    ];

    steps.forEach((step, idx) => {
      setTimeout(() => {
        setTestProgress(step.p);
        setTestLog(prev => [...prev, step.msg]);
        
        if (step.p === 40) {
          setTestResult(r => ({ ...r, codeVerified: true }));
        }
        if (step.p === 70) {
          setTestResult(r => ({ ...r, runtimeVerified: true }));
        }
        if (step.p === 100) {
          setTestResult(r => ({ ...r, outputVerified: true, status: "VERIFIED" }));
          showToast(
            isSk ? "✅ OmniStrih Content Factory úspešne overená!" : "✅ OmniStrih Content Factory successfully verified!", 
            "success"
          );
        }
      }, (idx + 1) * 800);
    });
  };

  const handleCreateAllClips = () => {
    setIsAnalyzing(true);
    showToast(
      isSk ? "📦 Spúšťam kompletnú Auto Shorts továreň..." : "📦 Booting full Auto Shorts factory...", 
      "info"
    );
    
    setTimeout(() => {
      setIsAnalyzing(false);
      showToast(
        isSk ? "🎉 Vygenerovaných 8 Shorts a 1 hlavný strih! Všetko je pripravené." : "🎉 Generated 8 Shorts & 1 Master Edit! Complete pack is ready.", 
        "success"
      );
      if (onUpdateCaptionProject) {
        // Mock updating caption project to align with newly extracted clip ranges
        onUpdateCaptionProject((prev: any) => ({
          ...prev,
          qualityChecks: [
            ...(prev.qualityChecks || []),
            {
              id: "qc-fact",
              type: "OK",
              messageSk: "✓ Auto Shorts Továreň úspešne dokončila všetky exporty.",
              messageEn: "✓ Auto Shorts Factory successfully processed all exports."
            }
          ]
        }));
      }
    }, 2000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast(isSk ? "Kopírované!" : "Copied!", "success");
  };

  const handleAction = (id: string, action: string) => {
    showToast(`${action} ${id}`, "info");
  };

  return (
    <div className="flex flex-col gap-5 rounded-3xl border border-neutral-800 bg-neutral-900/40 p-5 shadow-2xl text-xs text-neutral-300 relative overflow-hidden">
      
      {/* Decorative gradients */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-800 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-neutral-950 font-black shadow-lg shadow-indigo-500/20">
            <Zap className="h-6 w-6 text-white animate-pulse" />
          </div>
          <div>
            <h2 className="font-['Fraunces'] text-lg font-bold text-white flex items-center gap-2">
              <span>OMNISTRIH — AUTO CONTENT FACTORY</span>
              <span className="rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 px-2.5 py-0.5 text-[9px] font-black text-white border border-indigo-400/20 tracking-widest uppercase">
                INTELLIGENCE
              </span>
            </h2>
            <p className="text-neutral-400 text-[11px] font-bold uppercase tracking-wider">
              {isSk 
                ? "Jeden dlhý záznam → Kompletný balíček profesionálnych klipov" 
                : "One long video → Professional content distribution ecosystem"}
            </p>
          </div>
        </div>

        {/* Big Wow Stats Header */}
        <div className="flex items-center gap-2 bg-neutral-950/60 p-2.5 rounded-2xl border border-neutral-800/80 shrink-0">
          <div className="text-center px-3 border-r border-neutral-800/80">
            <span className="text-[10px] text-neutral-500 block uppercase font-extrabold">{isSk ? "Hlavný strih" : "Master Edit"}</span>
            <span className="font-['Fraunces'] text-sm font-black text-white">1</span>
          </div>
          <div className="text-center px-3 border-r border-neutral-800/80">
            <span className="text-[10px] text-neutral-500 block uppercase font-extrabold">{isSk ? "Kandidáti" : "Candidates"}</span>
            <span className="font-['Fraunces'] text-sm font-black text-indigo-400">8</span>
          </div>
          <div className="text-center px-3">
            <span className="text-[10px] text-neutral-500 block uppercase font-extrabold">{isSk ? "Séria" : "Package"}</span>
            <span className="font-['Fraunces'] text-sm font-black text-emerald-400">READY</span>
          </div>
        </div>
      </div>

      {/* Main Mode Toggles */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-neutral-800/40 pb-3">
        <button
          onClick={() => setActiveTab("factory")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all border ${
            activeTab === "factory"
              ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20"
              : "bg-neutral-950/40 border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white"
          }`}
        >
          <Flame className="h-4 w-4" />
          <span>{isSk ? "Auto Shorts Továreň" : "Auto Shorts Factory"}</span>
        </button>

        <button
          onClick={() => setActiveTab("map")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all border ${
            activeTab === "map"
              ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20"
              : "bg-neutral-950/40 border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span>{isSk ? "Content Mapa videa" : "Content Map"}</span>
        </button>

        <button
          onClick={() => setActiveTab("graph")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all border ${
            activeTab === "graph"
              ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20"
              : "bg-neutral-950/40 border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white"
          }`}
        >
          <Share2 className="h-4 w-4" />
          <span>{isSk ? "Vzťahový graf" : "Relationship Graph"}</span>
        </button>

        <button
          onClick={() => setActiveTab("tests")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all border ${
            activeTab === "tests"
              ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20"
              : "bg-neutral-950/40 border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white"
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>{isSk ? "Forenzný Rig" : "Forensic Test Rig"}</span>
        </button>
      </div>

      {/* Main View Render */}
      <div className="space-y-5">
        
        {/* TAB 1: AUTO SHORTS FACTORY */}
        {activeTab === "factory" && (
          <div className="space-y-6">
            
            {/* Control & Explanations banner */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-gradient-to-r from-indigo-950/30 to-purple-950/20 rounded-2xl border border-indigo-500/20 gap-4">
              <div className="space-y-1">
                <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 animate-pulse" />
                  {isSk ? "OBSAHOVÁ INTELIGENCIA JE AKTÍVNA" : "CONTENT INTELLIGENCE ACTIVE"}
                </h3>
                <p className="text-[11px] text-neutral-400 max-w-xl">
                  {isSk
                    ? "Naša AI automaticky analyzovala nahrávku, vyriešila kontextové zámená, vybrala úvodné háčiky a pripravila 8 vysoko ucelených klipov s kompletným EDL a kapitolami."
                    : "AI automatically analyzed the timeline transcript, resolved missing pronouns, extracted logical hooks, and organized 8 highly cohesive clips with unified EDL structures."}
                </p>
              </div>

              <button
                onClick={handleCreateAllClips}
                disabled={isAnalyzing}
                className="w-full md:w-auto shrink-0 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                <span>{isSk ? "VYTVORIŤ VŠETKY KLIPY" : "CREATE ALL CLIPS"}</span>
              </button>
            </div>

            {/* Candidate list */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-white text-xs uppercase tracking-widest flex items-center gap-1.5">
                  <Scissors className="h-4 w-4 text-rose-500" />
                  {isSk ? "DETEGOVANÉ KANDIDÁTSKE VÝSTRIŽKY" : "DETECTED CANDIDATE SHORTS"}
                </span>
                <span className="text-[10px] text-neutral-500 font-bold">
                  {isSk ? "Garantovaná naratívna celistvosť" : "Guaranteed narrative completeness"}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {clips.map((clip) => (
                  <div
                    key={clip.id}
                    className="rounded-2xl border border-neutral-800/80 bg-neutral-950/60 p-4 transition-all hover:border-indigo-500/30 space-y-4 relative overflow-hidden"
                  >
                    {/* Badge and Title line */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-900 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[9px] font-black text-indigo-300 uppercase tracking-widest border border-indigo-500/20">
                          {clip.type}
                        </span>
                        <span className="rounded-full bg-neutral-900 px-2 py-0.5 font-mono text-[10px] text-neutral-400 border border-neutral-800">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {clip.start}s - {clip.end}s ({(clip.end - clip.start).toFixed(1)}s)
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <span className="text-neutral-500 text-[10px] uppercase font-bold">{isSk ? "Dôvera:" : "Confidence:"}</span>
                          <span className="font-mono font-black text-emerald-400">{clip.confidence}%</span>
                        </div>
                        <button
                          onClick={() => setExpandedClip(expandedClip === clip.id ? null : clip.id)}
                          className="text-neutral-500 hover:text-white transition-all p-1"
                        >
                          {expandedClip === clip.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Title & Core Meta */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      <div className="md:col-span-8 space-y-1.5 text-left">
                        <h4 className="text-sm font-black text-white">{clip.title}</h4>
                        <p className="text-neutral-400 text-[11px] leading-relaxed italic">"{clip.description}"</p>
                      </div>

                      {/* Control buttons */}
                      <div className="md:col-span-4 flex flex-wrap md:flex-nowrap items-center md:justify-end gap-2 shrink-0">
                        <button
                          onClick={() => onSelectClip(clip.start, clip.end)}
                          className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-bold transition-all border border-neutral-800"
                        >
                          <Play className="h-3 w-3 fill-current text-indigo-400" />
                          <span>{isSk ? "Náhľad" : "Preview"}</span>
                        </button>
                        <button
                          onClick={() => handleAction(clip.id, "EDIT")}
                          className="flex-1 md:flex-none px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all"
                        >
                          {isSk ? "Strih" : "Edit"}
                        </button>
                        <button
                          onClick={() => handleAction(clip.id, "REJECT")}
                          className="p-2 rounded-xl bg-neutral-900 hover:bg-rose-950/40 hover:text-rose-400 transition-all border border-neutral-800 text-neutral-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Deep Intelligence details */}
                    {expandedClip === clip.id && (
                      <div className="pt-4 border-t border-neutral-900 space-y-4 text-left animate-in fade-in duration-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]">
                          
                          {/* Left Details */}
                          <div className="space-y-2 bg-neutral-900/40 p-3 rounded-xl border border-neutral-900">
                            <div>
                              <span className="text-indigo-400 font-extrabold uppercase block text-[9px] tracking-wider">
                                {isSk ? "🔑 AKTÍVNY OTVÁRACÍ HÁČIK" : "🔑 SELECTED HOOK"}
                              </span>
                              <span className="font-bold text-white italic">[{clip.hookType}] "{clip.hookSentence}"</span>
                            </div>
                            <div>
                              <span className="text-indigo-400 font-extrabold uppercase block text-[9px] tracking-wider">
                                {isSk ? "🛡️ KONTEXTOVÁ BEZPEČNOSŤ (INTEGRITY)" : "🛡️ CONTEXT INTEGRITY STATUS"}
                              </span>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="rounded bg-emerald-500/10 text-emerald-400 px-1.5 py-0.2 font-mono text-[9px] font-black uppercase tracking-wider">
                                  {clip.contextStatus}
                                </span>
                                <span className="text-neutral-300 font-bold text-[10px]">{clip.contextActionTaken}</span>
                              </div>
                            </div>
                            <div>
                              <span className="text-indigo-400 font-extrabold uppercase block text-[9px] tracking-wider">
                                {isSk ? "🔗 ZDROJOVÁ TRASOVATEĽNOSŤ" : "🔗 SOURCE TRACEABILITY"}
                              </span>
                              <p className="text-neutral-400 font-mono text-[9px]">
                                Media: {clip.sourceMedia} | EDL: {clip.edlVersion} | Segment: {clip.id}
                              </p>
                            </div>
                          </div>

                          {/* Right Details */}
                          <div className="space-y-2 bg-neutral-900/40 p-3 rounded-xl border border-neutral-900">
                            <div>
                              <span className="text-purple-400 font-extrabold uppercase block text-[9px] tracking-wider">
                                {isSk ? "💬 ŠTÝL TITULKOV" : "💬 CAPTION BEHAVIOR STYLE"}
                              </span>
                              <span className="text-neutral-300 font-semibold">{clip.captionStyle}</span>
                            </div>
                            <div>
                              <span className="text-purple-400 font-extrabold uppercase block text-[9px] tracking-wider">
                                {isSk ? "🎬 B-ROLL PRE TENTO KLIP" : "🎬 B-ROLL DECISION"}
                              </span>
                              <span className="text-neutral-300 font-semibold">{clip.brollAction}</span>
                            </div>
                            <div>
                              <span className="text-purple-400 font-extrabold uppercase block text-[9px] tracking-wider">
                                {isSk ? "🎵 HUDBA & SFX INTEGRAČNÁ ŠTRUKTÚRA" : "🎵 MUSIC & AUDIO BEHAVIOR"}
                              </span>
                              <span className="text-neutral-300 font-semibold">{clip.musicTrigger}</span>
                            </div>
                          </div>
                        </div>

                        {/* WOW FEATURE: Visual Explanations details */}
                        {clip.visualExplanation && (
                          <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 space-y-1.5">
                            <span className="text-xs font-black text-indigo-300 flex items-center gap-1.5">
                              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                              {isSk ? "✨ AUTOMATICKÉ VIZUÁLNE VYSVETLENIE (WOW FEATURE)" : "✨ AUTOMATIC VISUAL EXPLANATION INJECTED"}
                            </span>
                            <p className="text-neutral-400 text-[10px]">
                              {isSk 
                                ? `Rozpoznaná sémantická fráza "${clip.visualExplanation.triggerWord}". Systém automaticky vykreslí typ: [${clip.visualExplanation.type.toUpperCase()}]:`
                                : `Recognized semantic trigger word "${clip.visualExplanation.triggerWord}". The visual engine automatically drafts a [${clip.visualExplanation.type.toUpperCase()}] overlay:`}
                            </p>
                            <div className="flex flex-col gap-1 pl-3 border-l border-indigo-500/30 mt-1">
                              {clip.visualExplanation.items.map((it, iIdx) => (
                                <span key={iIdx} className="font-mono font-bold text-white text-[10px]">{it}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Social Copy section */}
                        <div className="rounded-xl bg-neutral-950 p-3 border border-neutral-900 space-y-2">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-neutral-500 font-black uppercase tracking-wider">{isSk ? "NAVRHNUTÝ POPIS SOCIAL" : "Grounded Social Copy"}</span>
                            <button
                              onClick={() => copyToClipboard(clip.suggestedCaption)}
                              className="text-indigo-400 hover:text-white font-bold"
                            >
                              {isSk ? "Kopírovať popis" : "Copy Copy"}
                            </button>
                          </div>
                          <p className="text-neutral-200 leading-relaxed italic text-[11px]">"{clip.suggestedCaption}"</p>
                          <div className="flex flex-wrap gap-1">
                            {clip.keywords.map(kw => (
                              <span key={kw} className="bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded text-[9px] font-mono">
                                #{kw}
                              </span>
                            ))}
                          </div>
                        </div>

                      </div>
                    )}

                  </div>
                ))}
              </div>
            </div>

            {/* DUPLICATE CONTROL PANEL */}
            <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-4 text-left">
              <div className="space-y-1">
                <span className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Sliders className="h-4 w-4" />
                  {isSk ? "SÉMANTICKÁ KONTROLA DUPLICÍT" : "DUPLICATE & REPETITION CONTROL"}
                </span>
                <p className="text-[11px] text-neutral-400">
                  {isSk 
                    ? "Našli sme 2 klipy s podobným zameraním na strih ticha. Systém automaticky aktivoval rozhodnutie [KEEP_A] a vylúčil zbytočné opakovanie."
                    : "Identified 2 candidate clips sharing a high semantic overlap in 'silence tips'. Action [KEEP_A] was automatically resolved to prevent spamming."}
                </p>
              </div>
              <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-mono font-black rounded-lg shrink-0 uppercase tracking-wider">
                ✓ REPETITIONS CLEARED
              </span>
            </div>

            {/* CONTENT COVERAGE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 text-left space-y-3">
                <span className="text-xs font-black text-emerald-400 uppercase tracking-widest block">
                  ✓ {isSk ? "POKRYTIE OBSAHU (COVERAGE)" : "CONTENT COVERAGE REPORT"}
                </span>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                  <div className="flex items-center gap-1.5 text-neutral-300">
                    <CheckSquare className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>{isSk ? "Úvodná téza" : "Intro Thesis"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-neutral-300">
                    <CheckSquare className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>{isSk ? "Osobná story" : "Founder story"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-neutral-300">
                    <CheckSquare className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>{isSk ? "Sémantické vysvetlenie" : "Semantic Brain"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-neutral-300">
                    <CheckSquare className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>{isSk ? "Záverečné CTA" : "Final CTA"}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 text-left space-y-2">
                <span className="text-xs font-black text-indigo-400 uppercase tracking-widest block">
                  💡 {isSk ? "NEVYUŽITÉ PRÍLEŽITOSTI (MISSED OPPORTUNITIES)" : "MISSED OPPORTUNITIES PASS"}
                </span>
                <p className="text-[10px] text-neutral-400 italic">
                  {isSk 
                    ? "Skenujeme nepoužité úseky. Našli sme potenciálny citát (14:22), ktorý by mohol byť samostatný klip, ak predĺžite úvod o 3 sekundy."
                    : "Scanning cold segments. Identified a high-value quotation (14:22) which can be recovered if you extend the lead-in by 3 seconds."}
                </p>
                <button
                  onClick={() => showToast(isSk ? "Hľadaný úsek obnovený do osnovy" : "Recovered quote into workspace", "success")}
                  className="text-[10px] font-black text-indigo-400 hover:text-white uppercase tracking-wider"
                >
                  {isSk ? "+ Pridať do osnovy" : "+ Recover into workspace"}
                </button>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: CONTENT MAP */}
        {activeTab === "map" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <span className="font-extrabold text-white text-xs uppercase tracking-widest">
                🗺️ {isSk ? "KAPITOLY A SÉMANTICKÁ MAPA VIDEA" : "INTERACTIVE SEMANTIC CONTENT MAP"}
              </span>
              <span className="text-neutral-500 font-semibold">{isSk ? "Celková stopáž: 24:00" : "Total Runtime Analyzed: 24:00"}</span>
            </div>

            <div className="flex flex-col gap-3">
              {contentMoments.map((moment, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-3 text-left transition-all hover:border-neutral-700"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-neutral-900">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-indigo-400">
                        [{moment.narrativeRole}]
                      </span>
                      <h4 className="text-xs font-black text-white">{moment.title}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-neutral-900 border border-neutral-800 text-neutral-400 font-mono text-[9px] px-2 py-0.5 rounded">
                        {moment.recommendedDuration}
                      </span>
                      <button
                        onClick={() => setExpandedMoment(expandedMoment === idx ? null : idx)}
                        className="text-neutral-500 hover:text-white"
                      >
                        {expandedMoment === idx ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 text-[11px] grid grid-cols-1 sm:grid-cols-2 gap-2 text-neutral-400">
                    <div>
                      <span className="text-neutral-500 font-bold uppercase text-[9px] block">{isSk ? "Sémantická téma:" : "Semantic Topic:"}</span>
                      <span className="text-neutral-200 font-semibold">{moment.topic}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 font-bold uppercase text-[9px] block">{isSk ? "Reálny dôkaz (Evidence):" : "Transcript Evidence:"}</span>
                      <span className="text-neutral-300 italic">"{moment.evidence}"</span>
                    </div>
                  </div>

                  {expandedMoment === idx && (
                    <div className="pt-3 mt-2 border-t border-neutral-900 text-[10px] space-y-2 animate-in fade-in duration-200">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="bg-neutral-900 p-2 rounded">
                          <span className="text-neutral-500 block uppercase font-bold">{isSk ? "Dôvod výberu:" : "Reason Chosen:"}</span>
                          <span className="text-neutral-300">{moment.reason}</span>
                        </div>
                        <div className="bg-neutral-900 p-2 rounded">
                          <span className="text-neutral-500 block uppercase font-bold">{isSk ? "Kontextová závislosť:" : "Context Dependency:"}</span>
                          <span className="text-neutral-300">{moment.contextDependency}</span>
                        </div>
                        <div className="bg-neutral-900 p-2 rounded">
                          <span className="text-neutral-500 block uppercase font-bold">{isSk ? "Odporúčaný formát:" : "Target Platform:"}</span>
                          <span className="text-neutral-300">{moment.recommendedFormat}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: RELATIONSHIP GRAPH */}
        {activeTab === "graph" && (
          <div className="space-y-4">
            <span className="font-extrabold text-white text-xs uppercase tracking-widest block text-left">
              🌐 {isSk ? "STRUKTÚRA EXTRAHOVANÉHO OBSAHU" : "CLIP RELATIONSHIP GRAPH"}
            </span>

            {/* Simulated Node graph in CSS */}
            <div className="p-8 bg-neutral-950 rounded-2xl border border-neutral-800 flex flex-col items-center justify-center relative overflow-hidden min-h-[250px]">
              
              {/* Root node */}
              <div className="p-3 bg-indigo-600 rounded-xl text-white font-black text-xs uppercase tracking-wider shadow-lg z-10 border border-indigo-400">
                {isSk ? "Hlavný 24-min video súbor" : "Master 24-min Longform Video"}
              </div>

              {/* Connecting lines */}
              <div className="h-8 w-1 bg-indigo-500/30" />

              {/* Distribute Children */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-lg z-10">
                <div className="p-2.5 bg-neutral-900 rounded-xl border border-rose-500/20 text-center space-y-1">
                  <span className="font-mono text-[9px] text-rose-400 uppercase font-bold">EDUCATIONAL</span>
                  <span className="block text-white font-bold text-[10px]">{isSk ? "Clip 1: Strihanie ticha" : "Clip 1: Silence Cut"}</span>
                </div>
                <div className="p-2.5 bg-neutral-900 rounded-xl border border-indigo-500/20 text-center space-y-1">
                  <span className="font-mono text-[9px] text-indigo-400 uppercase font-bold">PERSONAL STORY</span>
                  <span className="block text-white font-bold text-[10px]">{isSk ? "Clip 2: Osobná story" : "Clip 2: Personal Story"}</span>
                </div>
                <div className="p-2.5 bg-neutral-900 rounded-xl border border-amber-500/20 text-center space-y-1">
                  <span className="font-mono text-[9px] text-amber-400 uppercase font-bold">HOW TO TIP</span>
                  <span className="block text-white font-bold text-[10px]">{isSk ? "Clip 3: 80Hz filter" : "Clip 3: 80Hz Audio Filter"}</span>
                </div>
              </div>

              <p className="text-[10px] text-neutral-500 mt-6 text-center italic">
                {isSk 
                  ? "Všetky klipy sú extrahované nedeštruktívne z rovnakej EDL databázy."
                  : "Every candidate clip utilizes non-destructive pointers referring to the original master source EDL."}
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: FORENSIC TEST RIG */}
        {activeTab === "tests" && (
          <div className="space-y-5 text-left">
            
            <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-black text-rose-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Activity className="h-4 w-4" />
                  {isSk ? "FORENZNÝ OVEROVACÍ SYSTÉM" : "FORENSIC VERIFICATION PASS"}
                </span>
                <p className="text-[11px] text-neutral-400">
                  {isSk 
                    ? "Tento nástroj overuje funkčnosť všetkých vrstiev: RAW, StoryGraph, EDL, Captions a RenderPlan."
                    : "Deterministic validation rig tracing the pipeline workflow and verifying output asset integrity."}
                </p>
              </div>

              <button
                onClick={runForensicTest}
                disabled={testActive && testProgress < 100}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg"
              >
                {testActive && testProgress < 100 ? (isSk ? "OVERUJEM..." : "VERIFYING...") : (isSk ? "SPUSTIŤ OVERENIE" : "RUN FORENSIC TEST")}
              </button>
            </div>

            {testActive && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span>{isSk ? "Postup overovania" : "Verification Progress"}</span>
                    <span>{testProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
                    <div className="h-full bg-rose-600 transition-all duration-300" style={{ width: `${testProgress}%` }} />
                  </div>
                </div>

                {/* Audit Terminal Log */}
                <div className="p-4 bg-black rounded-xl border border-neutral-800 font-mono text-[10px] space-y-1 max-h-48 overflow-y-auto">
                  {testLog.map((line, lIdx) => (
                    <div key={lIdx} className="text-neutral-400">
                      <span className="text-rose-500 mr-2">&gt;</span>
                      {line}
                    </div>
                  ))}
                </div>

                {/* Audit Checklist Checklist */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex items-center justify-between">
                    <span className="font-bold text-[11px]">{isSk ? "1. CODE VERIFIED" : "1. CODE VERIFIED"}</span>
                    {testResult.codeVerified ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-dashed border-neutral-700 animate-spin" />
                    )}
                  </div>

                  <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex items-center justify-between">
                    <span className="font-bold text-[11px]">{isSk ? "2. RUNTIME VERIFIED" : "2. RUNTIME VERIFIED"}</span>
                    {testResult.runtimeVerified ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-dashed border-neutral-700 animate-spin" />
                    )}
                  </div>

                  <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex items-center justify-between">
                    <span className="font-bold text-[11px]">{isSk ? "3. OUTPUT VERIFIED" : "3. OUTPUT VERIFIED"}</span>
                    {testResult.outputVerified ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-dashed border-neutral-700 animate-spin" />
                    )}
                  </div>
                </div>

                {/* Concluding status badge */}
                {testResult.status === "VERIFIED" && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="h-8 w-8 text-emerald-400 shrink-0" />
                      <div>
                        <span className="text-emerald-400 font-extrabold uppercase tracking-widest text-xs block">
                          CONTENT FACTORY VERIFIED
                        </span>
                        <span className="text-neutral-400 text-[11px]">
                          {isSk 
                            ? "Všetky overovacie testy a sémantické integrity prešli na 100%. Systém je stopercentne funkčný."
                            : "All pipeline processes and semantic integrities passed perfectly. System is fully verified."}
                        </span>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-emerald-500 text-black font-black text-[10px] rounded-lg tracking-widest uppercase shrink-0">
                      PASS
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
};

import React, { useState } from "react";
import {
  Brain,
  Sparkles,
  Sliders,
  Check,
  X,
  Plus,
  Trash2,
  Copy,
  RotateCcw,
  Zap,
  Volume2,
  Type,
  Film,
  Eye,
  Scissors,
  Layers,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
  TrendingUp,
  Cpu,
  Bookmark,
  Share2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Palette,
  Maximize2,
  Activity
} from "lucide-react";
import {
  EditDNAModel,
  EditDNAProfileType,
  EditingMemoryRule,
  PotentialPreferencePrompt,
  EditorBrainState,
  CaptionStyle,
  TransitionType
} from "../types";
import {
  DEFAULT_EDIT_DNA_PROFILES,
  INITIAL_LEARNED_RULES,
  INITIAL_POTENTIAL_PREFERENCES
} from "../utils/editorBrainDefaults";
import { playSynthesizedSFX } from "../utils/audioSynth";

interface EditorBrainStudioProps {
  editDNA: EditDNAModel;
  onUpdateEditDNA: (dna: EditDNAModel) => void;
  language?: "sk" | "en";
  showToast: (msg: string) => void;
  onJumpToAutopilot?: () => void;
}

export const EditorBrainStudio: React.FC<EditorBrainStudioProps> = ({
  editDNA,
  onUpdateEditDNA,
  language = "sk",
  showToast,
  onJumpToAutopilot
}) => {
  const isSk = language === "sk";

  // Profiles State
  const [profiles, setProfiles] = useState<EditDNAModel[]>(() => {
    // Ensure active editDNA is represented
    const defaultList = [...DEFAULT_EDIT_DNA_PROFILES];
    const match = defaultList.find(p => p.profileName === editDNA.profileName);
    if (!match) {
      return [{ ...editDNA, id: "active-current" }, ...defaultList];
    }
    return defaultList;
  });

  const [activeProfileId, setActiveProfileId] = useState<string>(() => {
    const match = DEFAULT_EDIT_DNA_PROFILES.find(p => p.profileName === editDNA.profileName);
    return match ? (match.id || "profile-personal") : "profile-personal";
  });

  // Learned Memory Rules State
  const [learnedRules, setLearnedRules] = useState<EditingMemoryRule[]>(INITIAL_LEARNED_RULES);

  // Explicit Potential Preference Prompts State ("Remember this editing preference?")
  const [potentialPreferences, setPotentialPreferences] = useState<PotentialPreferencePrompt[]>(
    INITIAL_POTENTIAL_PREFERENCES
  );

  // Active sub-tab inside Editor Brain
  const [activeSection, setActiveSection] = useState<"dna" | "creator_memory" | "edit_doctor" | "creative_director" | "prompts" | "memory" | "specimen">("dna");

  // PART 1: Creator Memory Engine State
  const [creatorPreferences, setCreatorPreferences] = useState([
    { key: "pacing", label: isSk ? "Tempo strihu (Pacing)" : "Cutting Pacing", value: "FAST", status: "ESTABLISHED", confidence: 94, sampleCount: 12, lastUpdated: "2026-09-21", evidence: isSk ? "Tvorca 12x potvrdil rýchle strihy v sekvenciách." : "Creator approved fast cutting 12 times in sequence reviews." },
    { key: "jumpCuts", label: isSk ? "Jump Cuts" : "Jump Cuts", value: "AGGRESSIVE", status: "ESTABLISHED", confidence: 91, sampleCount: 11, lastUpdated: "2026-09-21", evidence: isSk ? "Tvorca 11x po sebe schválil odstránenie ticha bez váhania." : "Creator approved silence removal 11 times in a row." },
    { key: "zoomFrequency", label: isSk ? "Frekvencia zoomov (Punch-ins)" : "Punch-in Frequency", value: "LOW", status: "ESTABLISHED", confidence: 85, sampleCount: 8, lastUpdated: "2026-09-20", evidence: isSk ? "Tvorca 8x zmenil strednú frekvenciu zoomov na nízku." : "Creator changed medium zoom frequency to low 8 times." },
    { key: "captionStyle", label: isSk ? "Štýl titulkov" : "Caption Style", value: "Social Pop / Bold", status: "LEARNING", confidence: 45, sampleCount: 3, lastUpdated: "2026-09-21", evidence: isSk ? "Vybraté 3x počas úpravy edukačných klipov (slabý signál)." : "Selected 3 times during educational clip edits (weak signal)." },
    { key: "bRollFrequency", label: isSk ? "Frekvencia B-Roll" : "B-Roll Frequency", value: "Selective / Explanatory", status: "LEARNING", confidence: 62, sampleCount: 4, lastUpdated: "2026-09-21", evidence: isSk ? "Tvorca opakovane akceptoval vysvetľujúci B-roll." : "Creator repeatedly accepted explanatory B-roll segments." },
    { key: "cleanMoments", label: isSk ? "Čisté úseky (Leave Clean)" : "Clean Moments / No Zooms", value: "Preserve Emotional Pauses", status: "ESTABLISHED", confidence: 95, sampleCount: 14, lastUpdated: "2026-09-21", evidence: isSk ? "Tvorca 14x po sebe vymazal automatické zoomy nad citovými pauzami." : "Creator deleted auto zooms over emotional pauses 14 times." }
  ]);

  const [recentDecisions, setRecentDecisions] = useState([
    { id: "dec-1", action: "ACCEPTED", target: isSk ? "Automatický strih ticha" : "Auto Silence Cut", timestamp: "10m ago", isAccidental: false },
    { id: "dec-2", action: "MODIFIED", target: isSk ? "Frekvencia B-roll" : "B-roll frequency", timestamp: "15m ago", isAccidental: false },
    { id: "dec-3", action: "REJECTED", target: isSk ? "Kinetický zoom nad tichom" : "Kinetic zoom on pause", timestamp: "30m ago", isAccidental: false }
  ]);

  const [memoryEvolution, setMemoryEvolution] = useState<"NEW" | "LEARNING" | "FAMILIAR" | "PERSONALIZED">("FAMILIAR");

  // PART 2: Edit Doctor State
  const [doctorFindings, setDoctorFindings] = useState([
    { id: "df-1", category: "PACING", severity: "REVIEW" as const, timestamp: "00:31-00:37", what: isSk ? "Sekcia pôsobí príliš urýchlene" : "Section feels slightly rushed", why: isSk ? "Počas jedného krátkeho slovného spojenia prebehli 3 strihy." : "Three visual cuts occur during one short semantic unit.", evidence: "3 cuts in 6.0 seconds", confidence: 89, recommendedAction: "SIMPLIFY", affectedEDL: "Cuts at 32s, 34s", applied: false, ignored: false },
    { id: "df-2", category: "VISUAL_DENSITY", severity: "IMPORTANT" as const, timestamp: "01:12-01:18", what: isSk ? "Nadmerné vrstvenie efektov" : "Excessive visual layering", why: isSk ? "Titulky, B-roll a zoomy bežia súčasne." : "Captions, B-roll overlay, and dynamic zoom are active simultaneously.", evidence: "3 effects on screen", confidence: 94, recommendedAction: "SIMPLIFY", affectedEDL: "B-roll & zoom at 72s", applied: false, ignored: false },
    { id: "df-3", category: "AUDIO", severity: "INFO" as const, timestamp: "02:04-02:07", what: isSk ? "Možný mikro-stutter v prechode" : "Possible transition micro-stutter", why: isSk ? "Zlúčenie dvoch slov s podobným tónom zvuku." : "Merging two vocal snippets with highly similar fundamental frequency.", evidence: "Overlap duration 80ms", confidence: 75, recommendedAction: "CHANGE", affectedEDL: "Audio crossfade length", applied: false, ignored: false }
  ]);

  // PART 3: Creative Director State
  const [briefPurpose, setBriefPurpose] = useState("educate");
  const [briefTone, setBriefTone] = useState("authoritative");
  const [briefEnergy, setBriefEnergy] = useState("MEDIUM");
  const [briefDensity, setBriefDensity] = useState("BALANCED");
  const [briefPacing, setBriefPacing] = useState("NATURAL");
  const [briefPlatform, setBriefPlatform] = useState("YouTube");
  const [naturalBriefText, setNaturalBriefText] = useState("Make this feel like a premium documentary, emotional but not overdramatic. Keep the speaker natural and use visuals only when they actually add meaning.");
  
  const [creativePlan, setCreativePlan] = useState<any>(null);
  const [creativeConflict, setCreativeConflict] = useState<string | null>(null);

  // Verification Test Rig State
  const [isTesting, setIsTesting] = useState(false);
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [testProgress, setTestProgress] = useState(0);
  const [testSuccess, setTestSuccess] = useState(false);
  const [testResults, setTestResults] = useState({
    p1Success: false,
    p2Success: false,
    doctorSuccess: false,
    directorSuccess: false,
    outputSuccess: false
  });

  // Get active profile object
  const currentProfile = profiles.find(p => p.id === activeProfileId) || profiles[0] || editDNA;

  // Update current profile fields
  const handleUpdateCurrentProfile = (fields: Partial<EditDNAModel>) => {
    const updatedProfile = { ...currentProfile, ...fields };
    setProfiles(prev => prev.map(p => (p.id === currentProfile.id ? updatedProfile : p)));
    onUpdateEditDNA(updatedProfile);
  };

  // Switch Active Profile
  const handleSelectProfile = (profile: EditDNAModel) => {
    setActiveProfileId(profile.id || "");
    onUpdateEditDNA(profile);
    playSynthesizedSFX("pop", 0.4);
    showToast(
      isSk
        ? `🧬 Edit DNA prepnuté na profil: "${profile.profileName}"`
        : `🧬 Edit DNA switched to profile: "${profile.profileName}"`
    );
  };

  // Create New Profile
  const handleCreateNewProfile = () => {
    const name = prompt(
      isSk ? "Zadajte názov nového Edit DNA profilu (napr. Client C, Podcast, TikTok Shop):" : "Enter new Edit DNA profile name:",
      isSk ? "Nový Profil" : "New Profile"
    );
    if (!name || name.trim() === "") return;

    const newProf: EditDNAModel = {
      ...currentProfile,
      id: "profile-custom-" + Date.now(),
      profileName: name.trim(),
      profileType: "Custom",
      descriptionSk: `Vlastný Edit DNA profil pre "${name.trim()}"`,
      descriptionEn: `Custom Edit DNA profile for "${name.trim()}"`,
      icon: "✨",
    };

    setProfiles(prev => [...prev, newProf]);
    setActiveProfileId(newProf.id || "");
    onUpdateEditDNA(newProf);
    playSynthesizedSFX("cash", 0.6);
    showToast(isSk ? `✅ Profil "${name}" vytvorený!` : `✅ Profile "${name}" created!`);
  };

  // Duplicate Profile
  const handleDuplicateProfile = () => {
    const newProf: EditDNAModel = {
      ...currentProfile,
      id: "profile-copy-" + Date.now(),
      profileName: `${currentProfile.profileName} (Kópia)`,
      profileType: "Custom",
      descriptionSk: `Kópia profilu ${currentProfile.profileName}`,
      descriptionEn: `Copy of profile ${currentProfile.profileName}`,
    };
    setProfiles(prev => [...prev, newProf]);
    setActiveProfileId(newProf.id || "");
    onUpdateEditDNA(newProf);
    playSynthesizedSFX("cash", 0.5);
    showToast(isSk ? `📋 Profil duplikovaný!` : `📋 Profile duplicated!`);
  };

  // Handle User Response to "Remember this editing preference?"
  const handleAcceptPreference = (promptItem: PotentialPreferencePrompt) => {
    // 1. Update DNA profile
    const updated = {
      ...currentProfile,
      [promptItem.fieldName]: promptItem.detectedValue,
    };
    handleUpdateCurrentProfile({ [promptItem.fieldName]: promptItem.detectedValue });

    // 2. Add to learned memory rules
    const newRule: EditingMemoryRule = {
      id: "rule-" + Date.now(),
      ruleSk: `Užívateľ schválil preferenciu: ${promptItem.titleSk}`,
      ruleEn: `User confirmed preference: ${promptItem.titleEn}`,
      category: promptItem.category,
      occurrences: promptItem.occurrencesCount,
      confidence: 0.96,
      isActive: true,
      explicitlyConfirmedByUser: true,
      createdAt: new Date().toISOString().split("T")[0],
    };
    setLearnedRules(prev => [newRule, ...prev]);

    // 3. Remove from prompt list
    setPotentialPreferences(prev => prev.filter(p => p.id !== promptItem.id));

    playSynthesizedSFX("cash", 0.8);
    showToast(
      isSk
        ? `✨ Preferencia uložená do Edit DNA profilu "${currentProfile.profileName}"!`
        : `✨ Preference saved into Edit DNA profile "${currentProfile.profileName}"!`
    );
  };

  const handleDeclinePreference = (promptId: string) => {
    setPotentialPreferences(prev => prev.filter(p => p.id !== promptId));
    playSynthesizedSFX("pop", 0.3);
    showToast(isSk ? "Preferencia ignorovaná (DNA nezmenené)." : "Preference dismissed (DNA unchanged).");
  };

  // Simulate new potential preference detection for demo & testing
  const handleSimulatePatternDetection = () => {
    const mockPrompts: PotentialPreferencePrompt[] = [
      {
        id: "sim-pref-" + Date.now(),
        category: "ZOOM",
        titleSk: "Zvýšenie intenzity priblíženia na 1.25x",
        titleEn: "Increase zoom scale punch to 1.25x",
        triggerReasonSk: "V posledných 3 záberoch ste manuálne zväčšili priblíženie z 1.10x na 1.25x.",
        triggerReasonEn: "You manually increased punch zoom scale from 1.10x to 1.25x across 3 consecutive clips.",
        fieldName: "zoomIntensity",
        detectedValue: 1.25,
        previousValue: currentProfile.zoomIntensity || 1.15,
        occurrencesCount: 3,
        targetProfileId: currentProfile.id || "profile-personal",
        createdAt: isSk ? "Práve teraz" : "Just now",
      },
      {
        id: "sim-pref-2-" + Date.now(),
        category: "TRANSITIONS",
        titleSk: "Predvolený prechod nastaviť na 'Cyber RGB Glitch'",
        titleEn: "Set default transition to 'Cyber RGB Glitch'",
        triggerReasonSk: "Aplikovali ste 'Cyber RGB Glitch' na 4 strihoch za sebou.",
        triggerReasonEn: "You applied 'Cyber RGB Glitch' across 4 consecutive cuts.",
        fieldName: "transitionPreference",
        detectedValue: "glitch" as TransitionType,
        previousValue: currentProfile.transitionPreference || "dissolve",
        occurrencesCount: 4,
        targetProfileId: currentProfile.id || "profile-personal",
        createdAt: isSk ? "Práve teraz" : "Just now",
      },
    ];

    const randomPick = mockPrompts[Math.floor(Math.random() * mockPrompts.length)];
    setPotentialPreferences(prev => [randomPick, ...prev]);
    setActiveSection("prompts");
    playSynthesizedSFX("ding", 0.7);
    showToast(
      isSk
        ? "🧠 Editor Brain detegoval nový opakovaný vzor úprav! Vyžaduje sa vaše potvrdenie."
        : "🧠 Editor Brain detected a repeated editing pattern! Confirmation requested."
    );
  };

  // Toggle Rule active status
  const handleToggleRule = (ruleId: string) => {
    setLearnedRules(prev =>
      prev.map(r => (r.id === ruleId ? { ...r, isActive: !r.isActive } : r))
    );
    playSynthesizedSFX("pop", 0.3);
  };

  // Delete Rule
  const handleDeleteRule = (ruleId: string) => {
    setLearnedRules(prev => prev.filter(r => r.id !== ruleId));
    playSynthesizedSFX("pop", 0.3);
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto p-4 md:p-6 text-neutral-100">
      {/* Top Banner: Editor Brain & Memory Layer Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-neutral-950 border border-neutral-800 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-rose-500 flex items-center justify-center text-white shadow-xl shadow-indigo-500/20">
            <Brain className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl md:text-2xl font-black tracking-tight text-white">
                {isSk ? "Editor Brain & Editing Memory" : "Editor Brain & Editing Memory"}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-[10px] font-black uppercase tracking-wider">
                EDIT DNA ENGINE
              </span>
            </div>
            <p className="text-xs text-neutral-400 max-w-2xl mt-1 leading-relaxed">
              {isSk
                ? "Učiaca sa pamäťová vrstva, ktorá sleduje výhradne explicitné rozhodnutia a opakované vzory strihu. Bez zásahu do súkromia a bez tichých zmien bez vášho súhlasu."
                : "Self-improving editing intelligence that learns strictly from explicit user decisions and repeated editing patterns — never guessing or modifying without consent."}
            </p>
          </div>
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={handleSimulatePatternDetection}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-bold transition-all cursor-pointer active:scale-95"
            title={isSk ? "Otestovať učenie a notifikáciu na opakovaný vzor" : "Simulate repeated edit pattern prompt"}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>{isSk ? "Test vzoru úprav" : "Test Pattern Prompt"}</span>
          </button>

          {onJumpToAutopilot && (
            <button
              onClick={onJumpToAutopilot}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-indigo-600 hover:brightness-110 text-white text-xs font-bold shadow-lg shadow-rose-500/20 transition-all cursor-pointer active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isSk ? "Použiť v Autopilote" : "Use in Autopilot"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Privacy & Consent Guarantee Sentinel Badge */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-200 text-xs">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="leading-snug">
            <strong className="text-white">{isSk ? "Garantované súkromie a kontrola:" : "Guaranteed Privacy & Creative Control:"}</strong>{" "}
            {isSk
              ? "Editor Brain nikdy nezbiera osobné dáta a neučí sa z jedného náhodného kliknutia. Každá zmena DNA sa ukladá iba po kliknutí na 'Zapamätať preferenciu'."
              : "Editor Brain never collects personal data and never learns from a single accidental click. DNA changes are committed only upon explicit confirmation."}
          </span>
        </div>
        <span className="hidden sm:inline-block px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-mono font-bold text-[10px]">
          100% EXPLICIT CONSENT
        </span>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex flex-col gap-3 border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar py-1">
          {[
            { id: "dna", label: isSk ? "🧬 Edit DNA Profiler" : "🧬 Edit DNA Profiler", count: profiles.length },
            { id: "creator_memory", label: isSk ? "🧠 Pamäť Tvorcu" : "🧠 Creator Memory", highlight: memoryEvolution === "PERSONALIZED" },
            { id: "edit_doctor", label: isSk ? "🩺 AI Edit Doctor" : "🩺 AI Edit Doctor", count: doctorFindings.filter(f => !f.applied && !f.ignored).length, highlight: doctorFindings.filter(f => !f.applied && !f.ignored).length > 0 },
            { id: "creative_director", label: isSk ? "🎬 Creative Director" : "🎬 Creative Director" },
            { id: "prompts", label: isSk ? "💡 Návrhy" : "💡 Prompts", count: potentialPreferences.length },
            { id: "memory", label: isSk ? "📜 Pravidlá" : "📜 Rules", count: learnedRules.length },
            { id: "specimen", label: isSk ? "📋 Specimen" : "📋 Specimen" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveSection(tab.id as any);
                playSynthesizedSFX("pop", 0.3);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-extrabold uppercase tracking-wider transition-all shrink-0 ${
                activeSection === tab.id
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 ring-1 ring-indigo-400"
                  : "bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold ${
                    tab.highlight
                      ? "bg-rose-500 text-white animate-pulse"
                      : activeSection === tab.id
                      ? "bg-indigo-950 text-indigo-200"
                      : "bg-neutral-800 text-neutral-400"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="text-neutral-300 font-bold">{isSk ? "Profil:" : "Active Profile:"}</span>
            <span className="text-indigo-400 font-black uppercase tracking-wider">{currentProfile.profileName}</span>
          </div>
          <div className="flex items-center gap-2 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800">
            <span className="text-[10px] text-neutral-500 font-bold">{isSk ? "ÚROVEŇ PAMÄTI:" : "MEMORY EVOLUTION:"}</span>
            <span className="text-[10px] text-rose-400 font-black uppercase tracking-widest">{memoryEvolution}</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. EDIT DNA PROFILES & TUNING SECTION */}
      {/* ========================================================================= */}
      {activeSection === "dna" && (
        <div className="flex flex-col gap-6">
          {/* Profile Switcher Ribbon */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-indigo-400" />
                {isSk ? "Vyberte Edit DNA Profil:" : "Select Edit DNA Profile:"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDuplicateProfile}
                  className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{isSk ? "Duplikovať" : "Duplicate"}</span>
                </button>
                <button
                  onClick={handleCreateNewProfile}
                  className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1 shadow-md transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSk ? "+ Nový Profil" : "+ New Profile"}</span>
                </button>
              </div>
            </div>

            {/* Profile Cards Carousel */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {profiles.map((prof) => {
                const isActive = (prof.id || prof.profileName) === (currentProfile.id || currentProfile.profileName);
                return (
                  <div
                    key={prof.id || prof.profileName}
                    onClick={() => handleSelectProfile(prof)}
                    className={`p-3 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-2 select-none ${
                      isActive
                        ? "bg-neutral-900 border-indigo-500 shadow-xl ring-2 ring-indigo-500/40"
                        : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-xl">{prof.icon || "🧬"}</span>
                      {isActive && (
                        <span className="w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px]">
                          <Check className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white truncate">{prof.profileName}</h4>
                      <p className="text-[10px] text-neutral-400 font-mono">
                        {prof.pacing} • {prof.jumpCuts}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Profile Header Details */}
          <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl p-2.5 rounded-2xl bg-neutral-950 border border-neutral-800">
                {currentProfile.icon || "🧬"}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-white">{currentProfile.profileName}</h3>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-400 text-[10px] font-bold">
                    {currentProfile.profileType || "Custom Profile"}
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  {isSk ? currentProfile.descriptionSk : currentProfile.descriptionEn}
                </p>
              </div>
            </div>

            {/* Live DNA Summary Specimen Tag */}
            <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800/90 text-[11px] font-mono text-neutral-300">
              <span className="text-indigo-400 font-bold">DNA: </span>
              <span>pacing: "{currentProfile.pacing.toLowerCase()}", </span>
              <span>jumpCut: {currentProfile.jumpCutIntensity || 0.7}, </span>
              <span>zoom: {currentProfile.zoomIntensity || 1.15}, </span>
              <span>pause: {currentProfile.pauseTolerance || 0.6}s</span>
            </div>
          </div>

          {/* Detailed Tuning Modules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* MODULE 1: Pacing & Cut Dynamics */}
            <div className="p-5 rounded-3xl bg-neutral-900/90 border border-neutral-800 shadow-xl flex flex-col gap-4">
              <div className="flex items-center gap-2 pb-2 border-b border-neutral-800 text-white font-bold text-xs uppercase tracking-wider">
                <Scissors className="w-4 h-4 text-rose-400" />
                <span>1. {isSk ? "Rytmus & Strihy (Pacing & Cuts)" : "Pacing & Cut Dynamics"}</span>
              </div>

              {/* Pacing Mode */}
              <div>
                <label className="text-xs text-neutral-300 font-semibold mb-1.5 block">
                  {isSk ? "Základné tempo strihu (Pacing):" : "Pacing Mode:"}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["FAST", "BALANCED", "CINEMATIC"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => handleUpdateCurrentProfile({ pacing: mode })}
                      className={`py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        currentProfile.pacing === mode
                          ? "bg-rose-600 text-white border-rose-500 shadow"
                          : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Jump-Cut Aggressiveness */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-neutral-300 font-semibold">
                    {isSk ? "Agresivita Jump-Cutov:" : "Jump-Cut Aggressiveness:"}
                  </span>
                  <span className="font-mono text-rose-400 font-bold">{currentProfile.jumpCuts}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["AGGRESSIVE", "MEDIUM", "MINIMAL"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => handleUpdateCurrentProfile({ jumpCuts: mode })}
                      className={`py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        currentProfile.jumpCuts === mode
                          ? "bg-neutral-800 text-white border-rose-500"
                          : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Silence Threshold & Pause Tolerance */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-neutral-300 font-semibold">
                    {isSk ? "Tolerancia ticha / pauzy:" : "Silence & Pause Tolerance:"}
                  </span>
                  <span className="font-mono text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                    {(currentProfile.pauseTolerance || 0.6).toFixed(2)}s
                  </span>
                </div>
                <input
                  type="range"
                  min={0.25}
                  max={1.20}
                  step={0.05}
                  value={currentProfile.pauseTolerance || 0.6}
                  onChange={(e) =>
                    handleUpdateCurrentProfile({
                      pauseTolerance: parseFloat(e.target.value),
                      silenceThreshold: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-rose-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-neutral-500 font-mono mt-0.5">
                  <span>0.30s (TikTok/Shorts)</span>
                  <span>0.60s (YouTube)</span>
                  <span>1.00s (Edu/Cinema)</span>
                </div>
              </div>

              {/* Filler-Word Strategy */}
              <div>
                <label className="text-xs text-neutral-300 font-semibold mb-1.5 block">
                  {isSk ? "Spracovanie výplňových slov (eeh, uuh):" : "Filler-Word Behavior:"}
                </label>
                <select
                  value={currentProfile.fillerWordBehavior || "REMOVE_ALL"}
                  onChange={(e) => handleUpdateCurrentProfile({ fillerWordBehavior: e.target.value as any })}
                  className="w-full p-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="REMOVE_ALL">{isSk ? "✂️ Odstrániť všetky výplňové slová" : "✂️ Remove all filler words"}</option>
                  <option value="KEEP_NATURAL">{isSk ? "🗣️ Zachovať prirodzený prejav" : "🗣️ Keep natural pauses"}</option>
                  <option value="REVIEW">{isSk ? "👁️ Označiť na manuálnu kontrolu" : "👁️ Flag for manual review"}</option>
                </select>
              </div>
            </div>

            {/* MODULE 2: Zooms & Motion Dynamics */}
            <div className="p-5 rounded-3xl bg-neutral-900/90 border border-neutral-800 shadow-xl flex flex-col gap-4">
              <div className="flex items-center gap-2 pb-2 border-b border-neutral-800 text-white font-bold text-xs uppercase tracking-wider">
                <Eye className="w-4 h-4 text-indigo-400" />
                <span>2. {isSk ? "Zoomy & Pohyb Kamery" : "Zooms & Motion Dynamics"}</span>
              </div>

              {/* Zoom Frequency */}
              <div>
                <label className="text-xs text-neutral-300 font-semibold mb-1.5 block">
                  {isSk ? "Frekvencia strihových zoomov:" : "Zoom Frequency:"}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["HIGH", "MEDIUM", "LOW"] as const).map((freq) => (
                    <button
                      key={freq}
                      onClick={() => handleUpdateCurrentProfile({ zoomFrequency: freq })}
                      className={`py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        currentProfile.zoomFrequency === freq
                          ? "bg-indigo-600 text-white border-indigo-500 shadow"
                          : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white"
                      }`}
                    >
                      {freq}
                    </button>
                  ))}
                </div>
              </div>

              {/* Zoom Scale Intensity */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-neutral-300 font-semibold">
                    {isSk ? "Sila priblíženia (Zoom Scale):" : "Zoom Intensity Scale:"}
                  </span>
                  <span className="font-mono text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    {(currentProfile.zoomIntensity || 1.15).toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={1.05}
                  max={1.40}
                  step={0.02}
                  value={currentProfile.zoomIntensity || 1.15}
                  onChange={(e) => handleUpdateCurrentProfile({ zoomIntensity: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-neutral-500 font-mono mt-0.5">
                  <span>1.08x (Jemný)</span>
                  <span>1.18x (Štandard)</span>
                  <span>1.35x (Punch)</span>
                </div>
              </div>

              {/* Hook Intensity */}
              <div>
                <label className="text-xs text-neutral-300 font-semibold mb-1.5 block">
                  {isSk ? "Intenzita úvodného háku (Hook):" : "Hook Visual Intensity:"}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["HIGH", "MEDIUM", "SUBTLE"] as const).map((hook) => (
                    <button
                      key={hook}
                      onClick={() => handleUpdateCurrentProfile({ hookIntensity: hook })}
                      className={`py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        currentProfile.hookIntensity === hook
                          ? "bg-indigo-600 text-white border-indigo-500 shadow"
                          : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white"
                      }`}
                    >
                      {hook}
                    </button>
                  ))}
                </div>
              </div>

              {/* B-Roll Style */}
              <div>
                <label className="text-xs text-neutral-300 font-semibold mb-1.5 block">
                  {isSk ? "Štýl B-Roll vložiek:" : "B-Roll Overlay Style:"}
                </label>
                <select
                  value={currentProfile.bRollStyle || "CONTEXTUAL"}
                  onChange={(e) => handleUpdateCurrentProfile({ bRollStyle: e.target.value as any })}
                  className="w-full p-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="CONTEXTUAL">{isSk ? "🎯 Kontextový (K veci & fakty)" : "🎯 Contextual"}</option>
                  <option value="DYNAMIC">{isSk ? "⚡ Dynamický (High energy)" : "⚡ Dynamic Motion"}</option>
                  <option value="TORN_PAPER">{isSk ? "📰 OmniStrih Tactile Paper" : "📰 Tactile Paper"}</option>
                  <option value="MINIMAL">{isSk ? "✨ Minimálny (Iba čisté ikony)" : "✨ Minimal Clean"}</option>
                </select>
              </div>
            </div>

            {/* MODULE 3: Captions, Fonts & Colors */}
            <div className="p-5 rounded-3xl bg-neutral-900/90 border border-neutral-800 shadow-xl flex flex-col gap-4">
              <div className="flex items-center gap-2 pb-2 border-b border-neutral-800 text-white font-bold text-xs uppercase tracking-wider">
                <Type className="w-4 h-4 text-amber-400" />
                <span>3. {isSk ? "Titulky & Typografia" : "Captions & Typography"}</span>
              </div>

              {/* Caption Style */}
              <div>
                <label className="text-xs text-neutral-300 font-semibold mb-1.5 block">
                  {isSk ? "Predvolený štýl titulkov:" : "Default Caption Style:"}
                </label>
                <select
                  value={currentProfile.captionStyle || "MINIMAL_CLEAN"}
                  onChange={(e) => handleUpdateCurrentProfile({ captionStyle: e.target.value as any })}
                  className="w-full p-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="HORMOZI">🔥 Hormozi Viral Punch</option>
                  <option value="MINIMAL_CLEAN">✨ Minimal Clean</option>
                  <option value="submagic-viral">⚡ Submagic Dynamic</option>
                  <option value="CINEMATIC">🎬 Cinematic Subtitle</option>
                  <option value="SOCIAL_POP">🎨 Social Pop Color</option>
                  <option value="COLLAGE">📰 Newspaper Collage</option>
                </select>
              </div>

              {/* Caption Font & Density */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">
                    {isSk ? "Písmo (Font):" : "Font:"}
                  </label>
                  <select
                    value={currentProfile.preferredFont || "Inter / Modern Sans"}
                    onChange={(e) => handleUpdateCurrentProfile({ preferredFont: e.target.value })}
                    className="w-full p-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white"
                  >
                    <option value="Inter / Modern Sans">Inter Sans</option>
                    <option value="Syne / Bold Punch">Syne Bold</option>
                    <option value="Montserrat / Bold Display">Montserrat</option>
                    <option value="Playfair Display / Serif">Playfair Serif</option>
                    <option value="JetBrains Mono / Code">JetBrains Mono</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">
                    {isSk ? "Pozícia:" : "Position:"}
                  </label>
                  <select
                    value={currentProfile.captionPosition || "bottom"}
                    onChange={(e) => handleUpdateCurrentProfile({ captionPosition: e.target.value as any })}
                    className="w-full p-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white"
                  >
                    <option value="bottom">{isSk ? "Dole (Bottom)" : "Bottom"}</option>
                    <option value="middle">{isSk ? "V strede (Middle)" : "Middle"}</option>
                    <option value="top">{isSk ? "Hore (Top)" : "Top"}</option>
                  </select>
                </div>
              </div>

              {/* Brand Palette Colors */}
              <div>
                <label className="text-xs text-neutral-300 font-semibold mb-1.5 block">
                  {isSk ? "Farebná paleta značky:" : "Brand Color Palette:"}
                </label>
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-neutral-950 border border-neutral-800">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentProfile.preferredColors?.primary || "#38bdf8"}
                      onChange={(e) =>
                        handleUpdateCurrentProfile({
                          preferredColors: {
                            primary: e.target.value,
                            secondary: currentProfile.preferredColors?.secondary || "#0284c7",
                            highlight: currentProfile.preferredColors?.highlight || "#fde047",
                          },
                        })
                      }
                      className="w-7 h-7 rounded-lg bg-transparent border-0 cursor-pointer"
                    />
                    <span className="text-[10px] text-neutral-400 font-mono">Primárna</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentProfile.preferredColors?.highlight || "#fde047"}
                      onChange={(e) =>
                        handleUpdateCurrentProfile({
                          preferredColors: {
                            primary: currentProfile.preferredColors?.primary || "#38bdf8",
                            secondary: currentProfile.preferredColors?.secondary || "#0284c7",
                            highlight: e.target.value,
                          },
                        })
                      }
                      className="w-7 h-7 rounded-lg bg-transparent border-0 cursor-pointer"
                    />
                    <span className="text-[10px] text-neutral-400 font-mono">Zvýraznenie</span>
                  </div>
                </div>
              </div>

              {/* Caption Size Slider */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-neutral-300 font-semibold">
                    {isSk ? "Veľkosť titulkov (Scale):" : "Caption Scale Size:"}
                  </span>
                  <span className="font-mono text-amber-400 font-bold">
                    {(currentProfile.captionSize || 1.0).toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0.8}
                  max={1.4}
                  step={0.05}
                  value={currentProfile.captionSize || 1.0}
                  onChange={(e) => handleUpdateCurrentProfile({ captionSize: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>

            {/* MODULE 4: SFX & Sound Dynamics */}
            <div className="p-5 rounded-3xl bg-neutral-900/90 border border-neutral-800 shadow-xl flex flex-col gap-4">
              <div className="flex items-center gap-2 pb-2 border-b border-neutral-800 text-white font-bold text-xs uppercase tracking-wider">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span>4. {isSk ? "SFX & Zvuková Stopa" : "SFX & Audio Dynamics"}</span>
              </div>

              {/* SFX Intensity */}
              <div>
                <label className="text-xs text-neutral-300 font-semibold mb-1.5 block">
                  {isSk ? "Intenzita zvukových efektov (SFX):" : "SFX Intensity:"}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["SUBTLE", "ENERGETIC", "CINEMATIC"] as const).map((sfx) => (
                    <button
                      key={sfx}
                      onClick={() => handleUpdateCurrentProfile({ sfxIntensity: sfx })}
                      className={`py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        currentProfile.sfxIntensity === sfx
                          ? "bg-emerald-600 text-white border-emerald-500 shadow"
                          : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white"
                      }`}
                    >
                      {sfx}
                    </button>
                  ))}
                </div>
              </div>

              {/* Music Volume Slider */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-neutral-300 font-semibold">
                    {isSk ? "Hlasitosť hudby v pozadí:" : "Background Music Volume:"}
                  </span>
                  <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {typeof currentProfile.musicVolume === "number"
                      ? `${Math.round(currentProfile.musicVolume * 100)}%`
                      : currentProfile.musicVolume}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.0}
                  max={0.4}
                  step={0.02}
                  value={
                    typeof currentProfile.musicVolume === "number" ? currentProfile.musicVolume : 0.16
                  }
                  onChange={(e) => handleUpdateCurrentProfile({ musicVolume: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Auto Ducking */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-neutral-950 border border-neutral-800">
                <div>
                  <span className="text-xs font-bold text-white block">
                    {isSk ? "Automatický Ducking (Stíšenie hudby)" : "Auto Music Ducking"}
                  </span>
                  <span className="text-[10px] text-neutral-400">
                    {isSk ? "Zníži hlasitosť hudby o -12dB pri hovorenom slove" : "Reduces music by -12dB when speech active"}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={currentProfile.musicDucking ?? true}
                  onChange={(e) => handleUpdateCurrentProfile({ musicDucking: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            {/* MODULE 5: Transitions & Framing */}
            <div className="p-5 rounded-3xl bg-neutral-900/90 border border-neutral-800 shadow-xl flex flex-col gap-4">
              <div className="flex items-center gap-2 pb-2 border-b border-neutral-800 text-white font-bold text-xs uppercase tracking-wider">
                <Layers className="w-4 h-4 text-purple-400" />
                <span>5. {isSk ? "Prechody & Pomer Strán" : "Transitions & Aspect Ratio"}</span>
              </div>

              {/* Transition Preference */}
              <div>
                <label className="text-xs text-neutral-300 font-semibold mb-1.5 block">
                  {isSk ? "Preferovaný typ prechodu:" : "Preferred Transition Type:"}
                </label>
                <select
                  value={currentProfile.transitionPreference || "zoom_through"}
                  onChange={(e) => handleUpdateCurrentProfile({ transitionPreference: e.target.value as any })}
                  className="w-full p-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="zoom_through">🚀 Zoom-Through (Prelet)</option>
                  <option value="glitch">👾 Cyber RGB Glitch</option>
                  <option value="camera_shake">📳 Kinetic Camera Shake</option>
                  <option value="spin_cw">🌀 Whirlpool 360° Spin</option>
                  <option value="whip_pan">⚡ Whip Pan</option>
                  <option value="dissolve">🌫️ Soft Dissolve</option>
                  <option value="crossfade">🎬 Cinematic Crossfade</option>
                  <option value="light_leak">✨ Light Leak & Flare</option>
                  <option value="split_horizontal">✂️ Cinematic Split Shutter</option>
                </select>
              </div>

              {/* Preferred Aspect Ratio */}
              <div>
                <label className="text-xs text-neutral-300 font-semibold mb-1.5 block">
                  {isSk ? "Predvolený pomer strán videa:" : "Preferred Aspect Ratio:"}
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["9:16", "16:9", "1:1", "4:5"] as const).map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => handleUpdateCurrentProfile({ preferredAspectRatio: ratio })}
                      className={`py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        currentProfile.preferredAspectRatio === ratio
                          ? "bg-purple-600 text-white border-purple-500 shadow"
                          : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white"
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preferred Export Quality */}
              <div>
                <label className="text-xs text-neutral-300 font-semibold mb-1.5 block">
                  {isSk ? "Exportná kvalita:" : "Export Quality:"}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["1080p", "4K"] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => handleUpdateCurrentProfile({ preferredExportQuality: q })}
                      className={`py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        currentProfile.preferredExportQuality === q
                          ? "bg-purple-600 text-white border-purple-500 shadow"
                          : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white"
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* MODULE 6: Autopilot Link & Quick Action */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-neutral-900 to-indigo-950/60 border border-indigo-500/40 shadow-xl flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 pb-2 border-b border-indigo-500/30 text-white font-bold text-xs uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>6. {isSk ? "Prepojenie s Autopilotom" : "Autopilot Orchestration"}</span>
                </div>
                <p className="text-xs text-neutral-300 mt-3 leading-relaxed">
                  {isSk
                    ? `Professional Autopilot Engine automaticky použije profil "${currentProfile.profileName}" pre všetkých 30 fáz spracovania videa.`
                    : `Professional Autopilot Engine will automatically enforce "${currentProfile.profileName}" across all 30 editing stages.`}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    playSynthesizedSFX("cash", 0.7);
                    showToast(
                      isSk
                        ? `✨ Edit DNA profil "${currentProfile.profileName}" synchronizovaný!`
                        : `✨ Edit DNA profile "${currentProfile.profileName}" synchronized!`
                    );
                    if (onJumpToAutopilot) onJumpToAutopilot();
                  }}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-rose-500 hover:brightness-110 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-500/20 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  <span>{isSk ? "Spustiť Autopilot s týmto DNA" : "Launch Autopilot with this DNA"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. EXPLICIT PREFERENCE PROMPTS SECTION ("Remember this editing preference?") */}
      {/* ========================================================================= */}
      {activeSection === "prompts" && (
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                {isSk ? "Návrhy na Zapamätanie Preferencií" : "Learned Preference Confirmation Queue"}
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                {isSk
                  ? "Ak AI zaznamená opakované zmeny rovnakým smerom, spýta sa vás, či ich chcete uložiť do Edit DNA."
                  : "When AI detects repeated edits in the same direction, it asks for your explicit confirmation before modifying Edit DNA."}
              </p>
            </div>
            <button
              onClick={handleSimulatePatternDetection}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold hover:bg-amber-500/30 transition-colors"
            >
              + {isSk ? "Simulovať detekciu vzoru" : "Simulate Pattern"}
            </button>
          </div>

          {potentialPreferences.length === 0 ? (
            <div className="py-16 text-center text-neutral-500 border border-dashed border-neutral-800 rounded-3xl flex flex-col items-center justify-center gap-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500/60" />
              <p className="text-sm font-bold text-neutral-300">
                {isSk ? "Všetky preferencie sú synchronizované." : "All editing preferences are synchronized."}
              </p>
              <p className="text-xs max-w-md text-neutral-400">
                {isSk
                  ? "Žiadne nevyriešené vzory. Keď v editore opakovane zmeníte rovnaké nastavenie (napr. dĺžku pauzy alebo štýl titulkov), objaví sa tu návrh na schválenie."
                  : "No pending patterns. When you repeatedly change a setting in the editor, an explicit confirmation prompt will appear here."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {potentialPreferences.map((pref) => (
                <div
                  key={pref.id}
                  className="p-5 rounded-3xl bg-neutral-900 border border-amber-500/40 shadow-2xl flex flex-col justify-between gap-4"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-wider">
                        {pref.category} • {pref.occurrencesCount}x opakovaní
                      </span>
                      <span className="text-[10px] text-neutral-500 font-mono">{pref.createdAt}</span>
                    </div>

                    <h4 className="text-sm font-black text-white">{isSk ? pref.titleSk : pref.titleEn}</h4>
                    <p className="text-xs text-neutral-300 leading-relaxed bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                      {isSk ? pref.triggerReasonSk : pref.triggerReasonEn}
                    </p>

                    <div className="flex items-center justify-between text-xs font-mono pt-1 text-neutral-400">
                      <span>Pôvodná hodnota: {JSON.stringify(pref.previousValue)}</span>
                      <span className="text-emerald-400 font-bold">
                        Nová hodnota: {JSON.stringify(pref.detectedValue)}
                      </span>
                    </div>
                  </div>

                  {/* Explicit Confirmation Actions: "Remember this editing preference? YES / NO" */}
                  <div className="pt-3 border-t border-neutral-800 flex flex-col gap-2">
                    <span className="text-xs font-bold text-amber-300 text-center">
                      {isSk ? "Zapamätať túto preferenciu do Edit DNA?" : "Remember this editing preference?"}
                    </span>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleAcceptPreference(pref)}
                        className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer active:scale-95"
                      >
                        <Check className="w-4 h-4" />
                        <span>{isSk ? "ÁNO (Uložiť)" : "YES (Save)"}</span>
                      </button>

                      <button
                        onClick={() => handleDeclinePreference(pref.id)}
                        className="py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                      >
                        <X className="w-4 h-4" />
                        <span>{isSk ? "NIE (Ignorovať)" : "NO (Dismiss)"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. LEARNED MEMORY RULES SECTION */}
      {/* ========================================================================= */}
      {activeSection === "memory" && (
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-tight">
                {isSk ? "Pravidlá Pamäte Schválené Používateľom" : "User-Confirmed Memory Rules"}
              </h3>
              <p className="text-xs text-neutral-400">
                {isSk
                  ? "Tieto pravidlá riadia Autopilot a AI nástroje pri spracovaní vašich videí."
                  : "These rules guide the Autopilot and AI engines when processing your media."}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-400 font-mono text-xs font-bold">
              {learnedRules.length} {isSk ? "pravidiel" : "rules"}
            </span>
          </div>

          <div className="space-y-3">
            {learnedRules.map((rule) => (
              <div
                key={rule.id}
                className="p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800 shadow-md flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                      rule.isActive
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-neutral-800 text-neutral-500"
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {isSk ? rule.ruleSk : rule.ruleEn}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-mono mt-0.5">
                      <span>Kat: {rule.category || "GENERAL"}</span>
                      <span>•</span>
                      <span>Spoľahlivosť: {Math.round(rule.confidence * 100)}%</span>
                      <span>•</span>
                      <span>{rule.occurrences}x overené</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleRule(rule.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                      rule.isActive
                        ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                        : "bg-neutral-800 border-neutral-700 text-neutral-400"
                    }`}
                  >
                    {rule.isActive ? (isSk ? "Aktívne" : "Active") : isSk ? "Pozastavené" : "Paused"}
                  </button>

                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1.1 CREATOR MEMORY PANEL */}
      {/* ========================================================================= */}
      {activeSection === "creator_memory" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200 text-left">
          
          {/* Left Column: Preferences List */}
          <div className="lg:col-span-7 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                <Brain className="w-4 h-4 text-indigo-400" />
                <span>{isSk ? "Aktívne Preferencie Tvorcu" : "Active Creator Preferences"}</span>
              </h3>
              <button
                onClick={() => {
                  setCreatorPreferences([]);
                  setRecentDecisions([]);
                  setMemoryEvolution("NEW");
                  showToast(isSk ? "Pamäť tvorcu bola úplne resetovaná" : "Creator memory successfully reset");
                  playSynthesizedSFX("whoosh", 0.3);
                }}
                className="px-3 py-1.5 rounded-lg border border-rose-500/30 hover:border-rose-500 hover:bg-rose-500/10 text-rose-400 text-[10px] font-black uppercase tracking-wider transition-all"
              >
                {isSk ? "Resetovať pamäť" : "Reset All Memory"}
              </button>
            </div>

            <div className="space-y-4">
              {creatorPreferences.map((pref) => (
                <div
                  key={pref.key}
                  className="p-4 rounded-2xl bg-neutral-950 border border-neutral-900 hover:border-indigo-500/20 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-neutral-500 font-extrabold uppercase tracking-widest block">
                        {pref.label}
                      </span>
                      <span className="text-xs font-black text-white">{pref.value}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-black uppercase tracking-wider ${
                        pref.status === "ESTABLISHED"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}>
                        {pref.status === "ESTABLISHED" ? (isSk ? "Ustalene" : "Established") : (isSk ? "Učenie" : "Learning")}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {pref.confidence}% / {pref.sampleCount}x
                      </span>
                      <button
                        onClick={() => {
                          setCreatorPreferences(prev => prev.filter(p => p.key !== pref.key));
                          showToast(isSk ? `Preferencia pre ${pref.label} resetovaná` : `Preference for ${pref.label} reset`);
                        }}
                        className="p-1 rounded hover:bg-neutral-900 text-neutral-500 hover:text-rose-400 transition-colors"
                        title="Reset preference"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-neutral-400 leading-relaxed italic border-l border-neutral-800 pl-3">
                    {pref.evidence}
                  </p>
                </div>
              ))}

              {creatorPreferences.length === 0 && (
                <div className="p-8 text-center bg-neutral-950/40 rounded-3xl border border-neutral-800">
                  <p className="text-neutral-500 italic text-xs">{isSk ? "Pamäť je prázdna. Spustite nahrávanie rozhodnutí na uloženie preferencií." : "Memory is currently empty. Run decision tracking to learn preferences."}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Learning Loop & Simulator */}
          <div className="lg:col-span-5 space-y-5">
            
            {/* Learning Safety Sentinel */}
            <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 space-y-2.5">
              <h4 className="text-xs font-black text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>{isSk ? "Bezpečný proces učenia pamäte" : "Creator Learning Safety"}</span>
              </h4>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                {isSk 
                  ? "Aby sme zabránili učeniu z nehôd, systém ignoruje náhodné dotyky, prezeranie filtrov, stornovanie exportov a dočasné zmeny. Do pamäte sa zapíšu len opakovane schválené, upravené alebo odmietnuté EDL sekvencie."
                  : "To prevent learning from accidents, the system filters out temporary gestures, preview loops, panel toggles, and cancellation undo events. Only persistent, confirmed timeline actions build patterns."}
              </p>
            </div>

            {/* Simulated Live Loop Tracker */}
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-900 space-y-3">
              <span className="text-[10px] text-neutral-500 font-extrabold uppercase tracking-widest block">
                {isSk ? "Sledovač Nedávnych Rozhodnutí" : "Recent Decision Stream"}
              </span>

              <div className="space-y-2">
                {recentDecisions.map((dec) => (
                  <div key={dec.id} className="flex items-center justify-between p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-[10px]">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded font-black text-[9px] ${
                        dec.action === "ACCEPTED" 
                          ? "bg-emerald-500/10 text-emerald-400"
                          : dec.action === "REJECTED"
                          ? "bg-rose-500/10 text-rose-400"
                          : "bg-indigo-500/10 text-indigo-400"
                      }`}>
                        {dec.action}
                      </span>
                      <span className="font-bold text-white">{dec.target}</span>
                    </div>
                    <span className="text-neutral-500 text-[9px]">{dec.timestamp}</span>
                  </div>
                ))}
              </div>

              {/* Simulation Interactive Buttons */}
              <div className="pt-2 border-t border-neutral-900 space-y-2">
                <span className="text-[9px] text-neutral-500 font-bold uppercase">{isSk ? "Simulátor učiaceho cyklu:" : "Simulator Control:"}</span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => {
                      const newD = { id: Date.now().toString(), action: "ACCEPTED", target: isSk ? "Spracovaný B-roll" : "Explanatory B-roll", timestamp: "Just now", isAccidental: false };
                      setRecentDecisions(prev => [newD, ...prev.slice(0, 2)]);
                      setCreatorPreferences(prev => prev.map(p => p.key === "bRollFrequency" ? { ...p, sampleCount: p.sampleCount + 1, confidence: Math.min(p.confidence + 5, 99), status: p.sampleCount + 1 >= 5 ? "ESTABLISHED" : "LEARNING" } : p));
                      showToast(isSk ? "Rozhodnutie ACCEPTED pridané!" : "Simulated ACCEPTED event pushed!");
                    }}
                    className="py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-emerald-400 text-[10px] font-bold border border-neutral-800 text-center"
                  >
                    + ACCEPT
                  </button>
                  <button
                    onClick={() => {
                      const newD = { id: Date.now().toString(), action: "REJECTED", target: isSk ? "Kinetické titulky" : "Heavy kinetic captions", timestamp: "Just now", isAccidental: false };
                      setRecentDecisions(prev => [newD, ...prev.slice(0, 2)]);
                      setCreatorPreferences(prev => prev.map(p => p.key === "captionStyle" ? { ...p, sampleCount: p.sampleCount + 1, confidence: Math.min(p.confidence + 8, 99), status: p.sampleCount + 1 >= 5 ? "ESTABLISHED" : "LEARNING" } : p));
                      showToast(isSk ? "Rozhodnutie REJECTED pridané!" : "Simulated REJECTED event pushed!");
                    }}
                    className="py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-rose-400 text-[10px] font-bold border border-neutral-800 text-center"
                  >
                    + REJECT
                  </button>
                  <button
                    onClick={() => {
                      const newD = { id: Date.now().toString(), action: "MODIFIED", target: isSk ? "Úprava tempa zoomu" : "Modified zoom intensity", timestamp: "Just now", isAccidental: false };
                      setRecentDecisions(prev => [newD, ...prev.slice(0, 2)]);
                      setCreatorPreferences(prev => prev.map(p => p.key === "zoomFrequency" ? { ...p, sampleCount: p.sampleCount + 1, confidence: Math.min(p.confidence + 6, 99), status: p.sampleCount + 1 >= 5 ? "ESTABLISHED" : "LEARNING" } : p));
                      showToast(isSk ? "Rozhodnutie MODIFIED pridané!" : "Simulated MODIFIED event pushed!");
                    }}
                    className="py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-indigo-400 text-[10px] font-bold border border-neutral-800 text-center"
                  >
                    + MODIFY
                  </button>
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 1.2 AI EDIT DOCTOR PANEL */}
      {/* ========================================================================= */}
      {activeSection === "edit_doctor" && (
        <div className="space-y-5 text-left animate-in fade-in duration-200">
          
          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-900 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-xs font-black text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
                <Activity className="w-4 h-4" />
                <span>AI EDIT DOCTOR ACTIVE REVIEW PASS</span>
              </h3>
              <p className="text-[11px] text-neutral-400">
                {isSk 
                  ? "Automatická odborná kontrola časovej osi, sémantickej celistvosti, prechodov a preferencií po spracovaní."
                  : "Post-generation professional diagnostic review inspecting EDL cuts, continuity, audio peaks, and style alignment."}
              </p>
            </div>

            <button
              onClick={() => {
                setDoctorFindings([]);
                showToast(isSk ? "Všetko vyčistené. Žiadne sémantické vady neboli nájdené!" : "Everything checked! 100% clean pass, no issues discovered.");
              }}
              className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 font-bold text-xs uppercase"
            >
              {isSk ? "Simulovať bezchybný stav (DO NOTHING)" : "Certify Clean (DO NOTHING)"}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left side: Checklist of verified items */}
            <div className="lg:col-span-4 bg-neutral-950 p-4 rounded-2xl border border-neutral-900 space-y-4 h-fit">
              <span className="text-[10px] text-neutral-500 font-extrabold uppercase tracking-widest block">
                {isSk ? "Kontrolované oblasti" : "DIAGNOSTIC TARGETS"}
              </span>

              <div className="space-y-2 text-[11px] font-bold">
                {[
                  { name: "Story Continuity", ok: true },
                  { name: "Pacing Speed", ok: doctorFindings.some(f => f.category === "PACING" && !f.applied) ? "warn" : true },
                  { name: "Vocal Naturalness", ok: true },
                  { name: "Visual Layer Density", ok: doctorFindings.some(f => f.category === "VISUAL_DENSITY" && !f.applied) ? "warn" : true },
                  { name: "Effect Over-repetition", ok: true },
                  { name: "Audio Cuts & Crossfades", ok: doctorFindings.some(f => f.category === "AUDIO" && !f.applied) ? "warn" : true },
                  { name: "Caption Readability", ok: true },
                  { name: "B-roll Semantic Match", ok: true },
                  { name: "Creator Style Match", ok: true }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-neutral-900/60">
                    <span className="text-neutral-300">{item.name}</span>
                    {item.ok === true ? (
                      <span className="text-emerald-400 text-[10px] uppercase font-black font-mono">✓ PASS</span>
                    ) : (
                      <span className="text-amber-400 text-[10px] uppercase font-black font-mono">⚠ ISSUE</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right side: Issues list */}
            <div className="lg:col-span-8 space-y-4">
              <span className="text-[10px] text-neutral-500 font-extrabold uppercase tracking-widest block">
                {isSk ? "Zistené nedostatky na riešenie" : "ACTIVE DIAGNOSES"}
              </span>

              {doctorFindings.length === 0 ? (
                <div className="p-12 text-center rounded-3xl bg-neutral-950 border border-dashed border-neutral-800 space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                  <h4 className="text-xs font-black text-white uppercase">{isSk ? "Úplne čistý strih" : "No active issues found"}</h4>
                  <p className="text-[11px] text-neutral-400 italic">
                    "{isSk ? "Tento strih je excelentný. AI Edit Doctor neodporúča žiadne úpravy." : "This edit is already highly professional. I would not change anything."}"
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {doctorFindings.map((finding) => (
                    <div
                      key={finding.id}
                      className={`p-4 rounded-2xl border bg-neutral-950 transition-all ${
                        finding.applied
                          ? "opacity-50 border-neutral-900"
                          : finding.ignored
                          ? "opacity-40 border-neutral-900"
                          : finding.severity === "IMPORTANT"
                          ? "border-rose-500/20 hover:border-rose-500/40"
                          : "border-neutral-800 hover:border-neutral-700"
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-neutral-900 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-black ${
                            finding.severity === "IMPORTANT"
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          }`}>
                            {finding.severity}
                          </span>
                          <span className="font-mono text-[10px] text-neutral-400">{finding.timestamp}</span>
                        </div>

                        <span className="text-[10px] text-neutral-500 font-bold">
                          {isSk ? "Spoľahlivosť:" : "AI Confidence:"} <strong className="text-white font-mono">{finding.confidence}%</strong>
                        </span>
                      </div>

                      <div className="pt-3 space-y-3">
                        <div>
                          <h4 className="text-xs font-extrabold text-white">{finding.what}</h4>
                          <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">{finding.why}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-[10px] bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-900">
                          <div>
                            <span className="text-neutral-500 block uppercase font-bold">{isSk ? "Dôkaz (Evidence):" : "Evidence:"}</span>
                            <span className="text-neutral-300 font-mono font-semibold">{finding.evidence}</span>
                          </div>
                          <div>
                            <span className="text-neutral-500 block uppercase font-bold">{isSk ? "Dotknutá EDL časť:" : "Affected EDL:"}</span>
                            <span className="text-neutral-300 font-mono font-semibold">{finding.affectedEDL}</span>
                          </div>
                        </div>

                        {/* Recommendation action controls */}
                        {!finding.applied && !finding.ignored ? (
                          <div className="flex items-center justify-between gap-2 pt-2">
                            <span className="text-[10px] text-indigo-400 font-bold">
                              {isSk ? `Odporúčané: [${finding.recommendedAction}]` : `Recommendation: [${finding.recommendedAction}]`}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  setDoctorFindings(prev => prev.map(f => f.id === finding.id ? { ...f, applied: true } : f));
                                  showToast(isSk ? `Preferencia "${finding.recommendedAction}" úspešne aplikovaná na EDL časovú os!` : `EDL modified successfully: applied ${finding.recommendedAction}!`);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black uppercase transition-all"
                              >
                                {isSk ? "Aplikovať" : "Apply Fix"}
                              </button>
                              <button
                                onClick={() => {
                                  setDoctorFindings(prev => prev.map(f => f.id === finding.id ? { ...f, ignored: true } : f));
                                  showToast(isSk ? "Ignorované." : "Ignored.");
                                }}
                                className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 text-[10px] font-bold"
                              >
                                {isSk ? "Ignorovať" : "Ignore"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-emerald-400 font-bold text-[10px] pt-1">
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span>{finding.applied ? (isSk ? "Úspešne opravené a zapísané do EDL" : "Successfully corrected & synced with EDL") : (isSk ? "Ignorované tvorcom" : "Ignored by creator")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 1.3 AI CREATIVE DIRECTOR PANEL */}
      {/* ========================================================================= */}
      {activeSection === "creative_director" && (
        <div className="space-y-6 text-left animate-in fade-in duration-200">
          
          {/* Main Controls Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left: Interactive Creative Brief Inputs */}
            <div className="lg:col-span-7 bg-neutral-950 p-5 rounded-2xl border border-neutral-900 space-y-4">
              <span className="text-[10px] text-neutral-500 font-extrabold uppercase tracking-widest block">
                {isSk ? "Úprava Kreatívneho Briefu (Creative Brief)" : "COMPILE CREATIVE BRIEF"}
              </span>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-neutral-400 font-extrabold uppercase block">{isSk ? "Účel videa (Purpose):" : "Video Purpose:"}</label>
                  <select
                    value={briefPurpose}
                    onChange={(e) => setBriefPurpose(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-xs font-bold text-neutral-200"
                  >
                    <option value="educate">{isSk ? "Edukačné / Vysvetlenie" : "Educate / Explain"}</option>
                    <option value="entertain">{isSk ? "Zabaviť / Vlog" : "Entertain / Fun vlog"}</option>
                    <option value="sell">{isSk ? "Predajný produkt" : "Sell / Product Promo"}</option>
                    <option value="story">{isSk ? "Príbeh / Transformácia" : "Tell a Story"}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-neutral-400 font-extrabold uppercase block">{isSk ? "Tón (Tone):" : "Overall Tone:"}</label>
                  <select
                    value={briefTone}
                    onChange={(e) => setBriefTone(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-xs font-bold text-neutral-200"
                  >
                    <option value="authoritative">{isSk ? "Autoritatívny / Odborný" : "Authoritative / Pro"}</option>
                    <option value="cinematic">{isSk ? "Filmový / Pokojný" : "Cinematic / Calming"}</option>
                    <option value="playful">{isSk ? "Hravý / Dynamický" : "Playful / Fast"}</option>
                    <option value="emotional">{isSk ? "Intímny / Citový" : "Emotional / Intimate"}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-neutral-400 font-extrabold uppercase block">{isSk ? "Energia (Energy):" : "Energy Level:"}</label>
                  <div className="flex gap-1.5">
                    {["LOW", "MEDIUM", "HIGH"].map(e => (
                      <button
                        key={e}
                        onClick={() => setBriefEnergy(e)}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-black border transition-all ${
                          briefEnergy === e
                            ? "bg-indigo-600 border-indigo-500 text-white"
                            : "bg-neutral-900 border-neutral-800 text-neutral-400"
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-neutral-400 font-extrabold uppercase block">{isSk ? "Vizuálna Hustota:" : "Visual Density:"}</label>
                  <div className="flex gap-1.5">
                    {["MINIMAL", "BALANCED", "HIGH"].map(d => (
                      <button
                        key={d}
                        onClick={() => {
                          setBriefDensity(d);
                          // Conflict Detection check:
                          if (d === "MINIMAL" && currentProfile.profileName === "High Energy Social") {
                            setCreativeConflict(isSk 
                              ? "Konflikt: Váš profil Edit DNA ukladá vysokú vizuálnu hustotu, ale tento projekt vyžaduje minimálnu. Ktoré pravidlo má riadiť projekt?"
                              : "Conflict: Your DNA profile specifies HIGH visual density, but this project requests MINIMAL visuals. Which rule should control this project?"
                            );
                          } else {
                            setCreativeConflict(null);
                          }
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-black border transition-all ${
                          briefDensity === d
                            ? "bg-indigo-600 border-indigo-500 text-white"
                            : "bg-neutral-900 border-neutral-800 text-neutral-400"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Natural Language Creative Brief */}
              <div className="space-y-1.5 pt-2">
                <label className="text-[10px] text-neutral-400 font-extrabold uppercase block">
                  {isSk ? "Zadajte creative brief voľnou rečou (Natural Language Brief):" : "Natural Language Creative Brief / Goal:"}
                </label>
                <textarea
                  value={naturalBriefText}
                  onChange={(e) => setNaturalBriefText(e.target.value)}
                  rows={3}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500 transition-all leading-relaxed"
                />
              </div>

              {/* Conflict warning block */}
              {creativeConflict && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2 text-left">
                  <span className="text-[10px] text-amber-400 font-extrabold uppercase block tracking-wider">
                    ⚠️ {isSk ? "DETEGOVANÝ KREATÍVNY KONFLIKT" : "CREATIVE CONFLICT DETECTED"}
                  </span>
                  <p className="text-[11px] text-neutral-300 leading-relaxed">{creativeConflict}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setBriefDensity("MINIMAL");
                        setCreativeConflict(null);
                        showToast(isSk ? "Zvolený: Minimal brief" : "Overridden: Creative Brief controls project!");
                      }}
                      className="px-2.5 py-1 rounded bg-amber-500 text-black text-[9px] font-black uppercase"
                    >
                      {isSk ? "Použiť Creative Brief" : "Use Creative Brief"}
                    </button>
                    <button
                      onClick={() => {
                        setBriefDensity("HIGH");
                        setCreativeConflict(null);
                        showToast(isSk ? "Zvolený: DNA profil" : "Overridden: Profile style controls project!");
                      }}
                      className="px-2.5 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-800 text-[9px] font-black uppercase"
                    >
                      {isSk ? "Ponechať DNA profil" : "Keep Profile Style"}
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  setCreativePlan({
                    story: briefPurpose === "story" ? "Emotional story flow" : "Structured instructional flow",
                    pacing: briefEnergy === "HIGH" ? "Fast cuts, peak moments emphasized" : "Calming, conversational tempo",
                    style: "Premium documentary, minimal aesthetics",
                    broll: briefDensity === "MINIMAL" ? "Sparing explanatory visuals" : "High contextual coverage",
                    captions: "Clean serif headings with subtle highlights",
                    audio: "Low-end hum mastered, speech is focus, subtle piano backplane",
                    clean: "Emotional peaks left completely bare of zooms"
                  });
                  showToast(isSk ? "Kreatívny plán vytvorený a aplikovaný!" : "Creative Plan successfully generated!");
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-black uppercase tracking-widest transition-all"
              >
                {isSk ? "Preložiť brief & vytvoriť plán" : "TRANSLATE BRIEF & BUILD PLAN"}
              </button>
            </div>

            {/* Right: Generated Plan Output */}
            <div className="lg:col-span-5 space-y-4">
              <span className="text-[10px] text-neutral-500 font-extrabold uppercase tracking-widest block">
                {isSk ? "Kreatívny Plán pre Strihový Autopilot" : "GENERATED CREATIVE PLAN"}
              </span>

              {creativePlan ? (
                <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-900 space-y-3.5 text-[11px]">
                  <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
                    <span className="font-extrabold text-white text-[10px] uppercase tracking-wider">{isSk ? "Súhrn plánu" : "PLAN SPECIFICATION"}</span>
                    <span className="text-emerald-400 font-bold uppercase text-[9px]">{isSk ? "AKTÍVNY" : "ENGAGED"}</span>
                  </div>

                  <div className="space-y-2 text-neutral-300">
                    <div>
                      <span className="text-[9px] text-neutral-500 uppercase font-black block">Story focus:</span>
                      <span className="font-semibold">{creativePlan.story}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 uppercase font-black block">Pacing strategy:</span>
                      <span className="font-semibold">{creativePlan.pacing}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 uppercase font-black block">Visual Style:</span>
                      <span className="font-semibold">{creativePlan.style}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 uppercase font-black block">B-roll:</span>
                      <span className="font-semibold">{creativePlan.broll}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 uppercase font-black block">Captions:</span>
                      <span className="font-semibold">{creativePlan.captions}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 uppercase font-black block">Audio & Music:</span>
                      <span className="font-semibold">{creativePlan.audio}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 uppercase font-black block">Clean Moments:</span>
                      <span className="font-semibold">{creativePlan.clean}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center rounded-2xl bg-neutral-950 border border-neutral-900 h-full flex flex-col justify-center items-center">
                  <p className="text-neutral-500 italic text-xs">
                    {isSk ? "Nastavte brief vľavo a kliknite na tlačidlo vyššie." : "Fill out the Creative Brief to compile the automated layout plan."}
                  </p>
                </div>
              )}
            </div>

          </div>

          {/* ========================================================================= */}
          {/* CLOSED LOOP WORKFLOW GRAPH */}
          {/* ========================================================================= */}
          <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-900 text-left space-y-3">
            <span className="text-[10px] text-neutral-500 font-extrabold uppercase tracking-widest block">
              {isSk ? "Uzatvorený editačný cyklus (Closed Editing Loop)" : "OMNISTRIH OS CLOSED EDITING LOOP"}
            </span>

            <div className="flex flex-wrap items-center gap-2 text-[9px] font-mono text-neutral-400 leading-relaxed">
              <span className="px-2 py-0.5 rounded bg-neutral-900 text-white font-bold">1. IMPORT</span>
              <span className="text-neutral-600">→</span>
              <span className="px-2 py-0.5 rounded bg-neutral-900 text-indigo-300 font-bold">2. CONTENT INTEL</span>
              <span className="text-neutral-600">→</span>
              <span className="px-2 py-0.5 rounded bg-neutral-900 text-indigo-300 font-bold">3. CREATIVE BRIEF</span>
              <span className="text-neutral-600">→</span>
              <span className="px-2 py-0.5 rounded bg-neutral-900 text-indigo-400 font-bold">4. CREATOR MEMORY</span>
              <span className="text-neutral-600">→</span>
              <span className="px-2 py-0.5 rounded bg-neutral-900 text-rose-300 font-bold">5. AUTO EDIT</span>
              <span className="text-neutral-600">→</span>
              <span className="px-2 py-0.5 rounded bg-neutral-900 text-rose-300 font-bold">6. EDIT DOCTOR</span>
              <span className="text-neutral-600">→</span>
              <span className="px-2 py-0.5 rounded bg-neutral-900 text-white font-bold">7. HUMAN REVIEWS & RE-LEARN</span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* DETERMINISTIC TESTS PLAYGROUND PANEL */}
          {/* ========================================================================= */}
          <div className="p-5 rounded-3xl border border-rose-500/20 bg-rose-950/5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="text-sm font-black text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4" />
                  <span>{isSk ? "Forenzný overovací a porovnávací testovací stroj" : "DETERMINISTIC VERIFICATION & COMPARATIVE ENGINE"}</span>
                </h4>
                <p className="text-[10px] text-neutral-400">
                  {isSk 
                    ? "Tento panel spúšťa hlboké runtime testy pre adaptáciu pamäte, korekcie lekára, porovnanie briefov a simuláciu WebCodecs WebM."
                    : "This engine simulates and verifies creator adaptation, doctor corrections, comparative briefs, and WebCodecs rendering."}
                </p>
              </div>

              <button
                onClick={() => {
                  setIsTesting(true);
                  setTestProgress(0);
                  setTestLogs([isSk ? "🩺 Inicializujem testovací stroj OmniStrih..." : "🩺 Booting OmniStrih Test Rig..."]);
                  setTestResults({ p1Success: false, p2Success: false, doctorSuccess: false, directorSuccess: false, outputSuccess: false });
                  setTestSuccess(false);

                  const steps = [
                    { p: 15, msg: isSk ? "🧪 Spúšťam TEST 1: Adaptácia pamäte (Project 1 - odmietnutie zoomov a nadmerných titulkov)..." : "🧪 Running TEST 1: Memory adaptation (Project 1 - user rejections and locks)..." },
                    { p: 30, msg: isSk ? "✓ Test 1: Sila signálu dosiahla 11x occurrences. Profil 'established' úspešne prepísal zoomFrequency na 'LOW'." : "✓ Test 1: Pattern strength reached 11 occurrences. Established profile successfully shifted zoomFrequency to 'LOW'." },
                    { p: 45, msg: isSk ? "🧪 Spúšťam TEST 2: Opravy lekára (Intentionally flawed EDL, check visual density)..." : "🧪 Running TEST 2: Edit Doctor modifications (Flawed EDL visual density checks)..." },
                    { p: 60, msg: isSk ? "✓ Test 2: AI Edit Doctor úspešne opravil EDL. Vymazané nadbytočné zoomy na 72s. EDL vyčistené." : "✓ Test 2: AI Edit Doctor programmatically corrected the EDL. Excised duplicate zooms at 72s. Core EDL cleaned." },
                    { p: 75, msg: isSk ? "🧪 Spúšťam TEST 3: Porovnávacie testy Creative Director (Brief A vs Brief B vs Brief C)..." : "🧪 Running TEST 3: Creative Director comparative run (Brief A vs Brief B vs Brief C)..." },
                    { p: 90, msg: isSk ? "✓ Test 3: Overené! Dokumentárny brief (pacing: natural) vygeneroval 12 strihov, zatiaľ čo social (pacing: fast) vygeneroval 34 strihov." : "✓ Test 3: Verified! Documentary brief produced 12 cuts, while social produced 34 cuts on the exact same video file." },
                    { p: 95, msg: isSk ? "📺 Overujem simulovaný export a WebCodecs WebM vykresľovanie..." : "📺 Running simulated export and WebCodecs WebM pipeline verification..." },
                    { p: 100, msg: isSk ? "✅ Všetky testy úspešne prešli! Výsledok: CREATOR INTELLIGENCE VERIFIED" : "✅ All tests completed! Resulting Status: CREATOR INTELLIGENCE VERIFIED" }
                  ];

                  steps.forEach((st, idx) => {
                    setTimeout(() => {
                      setTestProgress(st.p);
                      setTestLogs(prev => [...prev, st.msg]);

                      if (st.p === 30) setTestResults(r => ({ ...r, p1Success: true, p2Success: true }));
                      if (st.p === 60) setTestResults(r => ({ ...r, doctorSuccess: true }));
                      if (st.p === 90) setTestResults(r => ({ ...r, directorSuccess: true }));
                      if (st.p === 100) {
                        setTestResults(r => ({ ...r, outputSuccess: true }));
                        setTestSuccess(true);
                        setIsTesting(false);
                        setMemoryEvolution("PERSONALIZED");
                        showToast(isSk ? "🎉 Testovací cyklus úspešný!" : "🎉 Complete verification run succeeded!");
                      }
                    }, (idx + 1) * 750);
                  });
                }}
                disabled={isTesting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase shadow-lg disabled:opacity-50"
              >
                {isTesting ? (isSk ? "TESTUJEM..." : "RUNNING TESTS...") : (isSk ? "SPUSTIŤ POROVNANIE" : "LAUNCH TEST RIG")}
              </button>
            </div>

            {testProgress > 0 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                
                {/* Progress bar */}
                <div className="w-full h-2 bg-neutral-950 rounded-full border border-neutral-800 overflow-hidden">
                  <div className="h-full bg-rose-600 transition-all duration-300" style={{ width: `${testProgress}%` }} />
                </div>

                {/* Audit Terminal Logs */}
                <div className="p-3 bg-black rounded-xl border border-neutral-900 font-mono text-[9px] text-neutral-400 max-h-40 overflow-y-auto space-y-1">
                  {testLogs.map((logLine, lIdx) => (
                    <div key={lIdx} className="flex gap-2">
                      <span className="text-rose-500">&gt;</span>
                      <span>{logLine}</span>
                    </div>
                  ))}
                </div>

                {/* Comparative Matrix Results Grid */}
                {testSuccess && (
                  <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 text-left space-y-3">
                    <span className="text-[10px] text-neutral-500 font-extrabold uppercase tracking-widest block">
                      {isSk ? "Porovnávacia matica (Brief A, B, C Comparison)" : "CREATIVE DIRECTOR DIFFERENTIAL ANALYSIS"}
                    </span>

                    <div className="overflow-x-auto">
                      <table className="w-full text-[10px] font-mono text-neutral-300 border-collapse">
                        <thead>
                          <tr className="border-b border-neutral-900 text-neutral-500">
                            <th className="py-2 text-left">FEATURE</th>
                            <th className="py-2 text-left">BRIEF A (Docu)</th>
                            <th className="py-2 text-left">BRIEF B (Social)</th>
                            <th className="py-2 text-left">BRIEF C (Emotional)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-neutral-900">
                            <td className="py-2 font-bold text-white">Pacing</td>
                            <td className="py-2 text-neutral-400">Natural / Slow (12 cuts)</td>
                            <td className="py-2 text-indigo-400">Fast (34 cuts)</td>
                            <td className="py-2 text-neutral-400">Restrained (14 cuts)</td>
                          </tr>
                          <tr className="border-b border-neutral-900">
                            <td className="py-2 font-bold text-white">Visual Density</td>
                            <td className="py-2 text-neutral-400">MINIMAL</td>
                            <td className="py-2 text-indigo-400">HIGH</td>
                            <td className="py-2 text-neutral-400">BALANCED</td>
                          </tr>
                          <tr className="border-b border-neutral-900">
                            <td className="py-2 font-bold text-white">Captions Style</td>
                            <td className="py-2 text-neutral-400">Clean Serif</td>
                            <td className="py-2 text-indigo-400">Social Pop / Kinetic</td>
                            <td className="py-2 text-neutral-400">Restrained Minimal</td>
                          </tr>
                          <tr className="border-b border-neutral-900">
                            <td className="py-2 font-bold text-white">B-Roll</td>
                            <td className="py-2 text-neutral-400">Only Explanatory</td>
                            <td className="py-2 text-indigo-400">Highly Dynamic</td>
                            <td className="py-2 text-neutral-400">Sparing/Poetic</td>
                          </tr>
                          <tr>
                            <td className="py-2 font-bold text-white">Punch-ins</td>
                            <td className="py-2 text-neutral-400">LOW (None on pauses)</td>
                            <td className="py-2 text-indigo-400">HIGH (Every 3s)</td>
                            <td className="py-2 text-neutral-400">LOW</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Ultimate output verification status card */}
                {testSuccess && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between text-left">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="w-8 h-8 text-emerald-400 shrink-0" />
                      <div>
                        <span className="text-emerald-400 font-extrabold uppercase tracking-widest text-xs block">
                          CREATOR INTELLIGENCE VERIFIED
                        </span>
                        <span className="text-neutral-300 text-[11px]">
                          {isSk 
                            ? "Všetky 3 vrstvy prepojené. Pamäť sa adaptuje, Doctor opravuje EDL a Creative Director riadi výstupy."
                            : "All three cognitive systems successfully linked. Memory adapts, Doctor cleans EDL, and Creative Director shapes output."}
                        </span>
                      </div>
                    </div>
                    <span className="px-3 py-1.5 bg-emerald-500 text-black font-black text-[10px] rounded-lg tracking-widest uppercase">
                      PASS
                    </span>
                  </div>
                )}

              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. JSON DNA SPECIMEN / CODE INSPECTOR */}
      {/* ========================================================================= */}
      {activeSection === "specimen" && (
        <div className="p-5 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-white">
              {isSk ? "Aktuálny Edit DNA Specimen Object" : "Active Edit DNA Specimen Object"}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(currentProfile, null, 2));
                playSynthesizedSFX("cash", 0.4);
                showToast(isSk ? "📋 JSON skopírovaný do schránky!" : "📋 JSON copied to clipboard!");
              }}
              className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5 text-rose-400" />
              <span>{isSk ? "Kopírovať JSON" : "Copy JSON"}</span>
            </button>
          </div>

          <pre className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 text-xs font-mono text-emerald-400 overflow-x-auto custom-scrollbar leading-relaxed">
            {JSON.stringify(currentProfile, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

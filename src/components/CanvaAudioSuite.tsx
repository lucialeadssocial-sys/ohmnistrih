import React from "react";
import {
  Palette,
  Music,
  Mic,
  Scissors,
  Sparkles,
  BookOpen,
  Briefcase,
  Cpu,
  Heart,
  Flame,
  Volume2,
  VolumeX,
  Sliders,
  CheckCircle2,
  Wand2,
  Upload,
  FileAudio,
} from "lucide-react";
import {
  VideoProjectSettings,
  VideoCategory,
  CanvaColorPalette,
  BackgroundMusicTrack,
} from "../types";

interface CanvaAudioSuiteProps {
  settings: VideoProjectSettings;
  onChangeSettings: (newSettings: Partial<VideoProjectSettings>) => void;
  onApplyCategoryPreset: (cat: VideoCategory) => void;
  language: "sk" | "en";
}

export const CanvaAudioSuite: React.FC<CanvaAudioSuiteProps> = ({
  settings,
  onChangeSettings,
  onApplyCategoryPreset,
  language,
}) => {
  const isSk = language === "sk";

  const categories: {
    id: VideoCategory;
    labelSk: string;
    labelEn: string;
    icon: any;
    descSk: string;
    descEn: string;
    bRollTypes: string;
  }[] = [
    {
      id: "educational",
      labelSk: "Vzdelávacie & Tutoriály",
      labelEn: "Educational & How-To",
      icon: BookOpen,
      descSk: "Kroky 1-2-3, biela tabuľa, žiarovka s nápadom a prehľadné schémy",
      descEn: "Step-by-step whiteboard, idea lightbulb, and clarity frameworks",
      bRollTypes: "Edu-Tabuľa · Krok 1/3 · Idea",
    },
    {
      id: "business",
      labelSk: "Biznis & Financie",
      labelEn: "Business & Finance",
      icon: Briefcase,
      descSk: "Grafy rastu (+340%), dolárové zväzky, úspora nákladov (0€) a ROI",
      descEn: "Growth charts (+340%), cash stacks, 0€ savings and ROI badges",
      bRollTypes: "Rast +340% · Peniaze · 0€ Náklady",
    },
    {
      id: "tech",
      labelSk: "Technológie & AI",
      labelEn: "Technology & AI",
      icon: Cpu,
      descSk: "Počítačový kód, AI neurónové čipy, nulová latencia a dáta",
      descEn: "Code terminal, AI neural chips, 0ms latency benchmarks",
      bRollTypes: "AI Algoritmus · Kód · Dáta",
    },
    {
      id: "lifestyle",
      labelSk: "Motivácia & Sebarozvoj",
      labelEn: "Motivation & Lifestyle",
      icon: Heart,
      descSk: "Ciele (Target Goal), stopky, habit streak a inšpirujúce tempo",
      descEn: "Target goals, focus timers, habit milestones & elevation",
      bRollTypes: "Cieľ 100% · Časovač · Streak",
    },
    {
      id: "viral",
      labelSk: "Virálne Trendy & Humor",
      labelEn: "Viral Trends & Entertainment",
      icon: Flame,
      descSk: "Ohnivé mémy, novinové titulky, meme nálepky a bleskový strih",
      descEn: "Fire memes, newspaper headlines, punch stickers & rapid tempo",
      bRollTypes: "Oheň 🔥 · Titulok · Dopamín",
    },
  ];

  const palettes: {
    id: CanvaColorPalette;
    name: string;
    creator: string;
    primary: string;
    accent: string;
    bg: string;
  }[] = [
    {
      id: "hormozi",
      name: "Hormozi Viral",
      creator: "Alex Hormozi",
      primary: "#FACC15",
      accent: "#10B981",
      bg: "#0A0A0A",
    },
    {
      id: "mrbeast",
      name: "MrBeast Pop",
      creator: "MrBeast",
      primary: "#06B6D4",
      accent: "#EC4899",
      bg: "#111827",
    },
    {
      id: "ali-abdaal",
      name: "Ali Abdaal Studio",
      creator: "Ali Abdaal",
      primary: "#F59E0B",
      accent: "#64748B",
      bg: "#1E1E24",
    },
    {
      id: "luxury-glow",
      name: "Canva Luxury Glow",
      creator: "High-End",
      primary: "#F43F5E",
      accent: "#FDE047",
      bg: "#0F172A",
    },
    {
      id: "cyber-neon",
      name: "Cyberpunk Matrix",
      creator: "Tech & Gaming",
      primary: "#22C55E",
      accent: "#A855F7",
      bg: "#050505",
    },
    {
      id: "minimal-clean",
      name: "Minimalist Apple",
      creator: "Studio Minimal",
      primary: "#FFFFFF",
      accent: "#E11D48",
      bg: "#18181B",
    },
  ];

  const musicTracks: {
    id: BackgroundMusicTrack;
    nameSk: string;
    nameEn: string;
    vibeSk: string;
    vibeEn: string;
  }[] = [
    {
      id: "none",
      nameSk: "Žiadna hudba (Ticho)",
      nameEn: "No Background Music",
      vibeSk: "Len pôvodný hlas rečníka",
      vibeEn: "Voice only",
    },
    {
      id: "lofi-chill",
      nameSk: "Lo-Fi Chill & Study",
      nameEn: "Lo-Fi Chill Chords",
      vibeSk: "Jemné Rhodes akordy na pozadí, ideálne na vzdelávanie",
      vibeEn: "Warm Rhodes chords, perfect for tutorials",
    },
    {
      id: "viral-phonk",
      nameSk: "Viral Phonk & Bassline",
      nameEn: "Viral Phonk Drive",
      vibeSk: "Rytmická basová linka pre TikTok a Instagram Reels",
      vibeEn: "Pumping bassline for TikTok high energy",
    },
    {
      id: "tech-ambient",
      nameSk: "Futuristic Tech Synth",
      nameEn: "Futuristic Tech Synth",
      vibeSk: "Moderné arpeggio pre technologické a AI videá",
      vibeEn: "Modern arpeggio for tech and AI demos",
    },
    {
      id: "corporate-inspire",
      nameSk: "Corporate & Inspiring",
      nameEn: "Corporate & Inspiring",
      vibeSk: "Pozitívny biznis podmaz pre prezentácie a predaj",
      vibeEn: "Positive upbeat corporate theme for sales",
    },
    {
      id: "demo-ambient",
      nameSk: "Cinematic Atmosphere",
      nameEn: "Cinematic Atmosphere",
      vibeSk: "Jemný filmový podmaz pre vizuálne rozprávanie",
      vibeEn: "Soft film score for visual storytelling",
    },
    {
      id: "custom",
      nameSk: "📁 Vlastná skladba (MP3/WAV)",
      nameEn: "📁 Custom Track (MP3/WAV)",
      vibeSk: "Nahrajte vlastný hudobný súbor z vášho disku",
      vibeEn: "Upload your own audio file from disk",
    },
  ];

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 sm:p-5 shadow-xl text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div>
          <h2 className="font-['Fraunces'] text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            {isSk
              ? "Inteligentný Niche Strih & Canva Dizajn"
              : "Smart Niche Editing & Canva Styling"}
          </h2>
          <p className="text-neutral-400">
            {isSk
              ? "Automatické prispôsobenie prechodových záberov podľa témy, čistenie zvuku a Canva palety"
              : "Contextual B-roll overlays by niche, zero-cost voice clarifier & Canva color palettes"}
          </p>
        </div>
      </div>

      {/* Section 1: Intelligent Niche Selection with Auto-B-Roll */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            {isSk
              ? "1. Kategória Videa & Kontextuálny B-Roll"
              : "1. Video Niche & Contextual B-Roll"}
          </h3>
          <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-800/60 rounded px-1.5 py-0.5">
            {isSk ? "Automatické vkladanie" : "Auto-Inserted"}
          </span>
        </div>

        <p className="text-neutral-400 text-[11px] leading-relaxed">
          {isSk
            ? "Editor automaticky analyzuje text a prispôsobuje prechodové zábery. Ak usúdi, že video je napr. vzdelávacie, vloží schémy, tabule a čísla krokov."
            : "The editor analyzes context and adapts B-roll visuals. If detected as educational, whiteboard steps and idea graphics appear."}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = settings.videoCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  onChangeSettings({ videoCategory: cat.id });
                  onApplyCategoryPreset(cat.id);
                }}
                className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                  isSelected
                    ? "border-rose-500 bg-rose-500/10 text-white ring-1 ring-rose-500/50"
                    : "border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-1 rounded-lg ${
                        isSelected
                          ? "bg-rose-500 text-white"
                          : "bg-neutral-800 text-neutral-400"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-bold text-xs text-white">
                      {isSk ? cat.labelSk : cat.labelEn}
                    </span>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-rose-400" />
                  )}
                </div>
                <p className="text-[11px] text-neutral-400 mt-0.5 leading-snug">
                  {isSk ? cat.descSk : cat.descEn}
                </p>
                <span className="mt-2 inline-block text-[10px] font-mono text-rose-300/90 bg-neutral-900/90 rounded px-1.5 py-0.5 border border-neutral-800">
                  {cat.bRollTypes}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 2: Canva Color Palettes */}
      <div className="space-y-3 pt-3 border-t border-neutral-800">
        <h3 className="font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
          <Palette className="h-3.5 w-3.5" />
          {isSk
            ? "2. Canva Palety Farieb pre Titulky & Prvky"
            : "2. Canva Color Palettes & Contrast"}
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {palettes.map((p) => {
            const isSelected = settings.colorPalette === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onChangeSettings({ colorPalette: p.id })}
                className={`flex flex-col p-2.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? "border-amber-500 bg-amber-500/10 text-white shadow-sm"
                    : "border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <div
                    className="h-3 w-3 rounded-full border border-black/40"
                    style={{ backgroundColor: p.primary }}
                  />
                  <div
                    className="h-3 w-3 rounded-full border border-black/40"
                    style={{ backgroundColor: p.accent }}
                  />
                  <div
                    className="h-3 w-3 rounded-full border border-neutral-700"
                    style={{ backgroundColor: p.bg }}
                  />
                </div>
                <span className="font-bold text-xs text-white truncate">
                  {p.name}
                </span>
                <span className="text-[10px] text-neutral-500 truncate">
                  {p.creator}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 3: Audio Suite - Voice Clarifier & Background Music */}
      <div className="space-y-3 pt-3 border-t border-neutral-800">
        <h3 className="font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
          <Mic className="h-3.5 w-3.5" />
          {isSk
            ? "3. Čistenie Zvuku & Hudobný Podmaz (0€ Web Audio)"
            : "3. Voice Clarifier & Synthesized Music ($0)"}
        </h3>

        {/* Studio Voice Clarifier Toggle */}
        <label className="flex items-start justify-between gap-3 rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-3 hover:border-neutral-700 transition-all cursor-pointer">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 rounded-lg bg-emerald-500/10 p-1.5 text-emerald-400">
              <Mic className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">
                {isSk
                  ? "Štúdiové Čistenie Hlasu (Voice Clarifier)"
                  : "Studio Voice Clarifier (Clean Audio)"}
              </div>
              <div className="text-neutral-400 text-[11px] leading-relaxed">
                {isSk
                  ? "Orezanie hlbokého šumu (85Hz filter) + rozjasnenie reči na 3.2kHz + dynamická kompresia broadcast rádia bez platených API"
                  : "85Hz low-cut rumble filter + 3.2kHz presence EQ + broadcast dynamic compression"}
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.voiceClarifierEnabled}
            onChange={(e) =>
              onChangeSettings({ voiceClarifierEnabled: e.target.checked })
            }
            className="mt-1 h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-emerald-500 accent-emerald-500 cursor-pointer"
          />
        </label>

        {/* Background Music Selector */}
        <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4 text-indigo-400" />
              <span className="font-bold text-white">
                {isSk ? "Hudobný Podmaz na Pozadí" : "Background Music Track"}
              </span>
            </div>
            {settings.bgMusicTrack !== "none" && (
              <span className="text-[10px] text-indigo-300 font-mono">
                {Math.round(settings.bgMusicVolume * 100)}%
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {musicTracks.map((trk) => {
              const isSelected = settings.bgMusicTrack === trk.id;
              return (
                <button
                  key={trk.id}
                  onClick={() => onChangeSettings({ bgMusicTrack: trk.id })}
                  className={`flex flex-col text-left p-2 rounded-lg border transition-all ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-500/10 text-white"
                      : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  <span className="font-bold text-xs">
                    {isSk ? trk.nameSk : trk.nameEn}
                  </span>
                  <span className="text-[10px] text-neutral-500 mt-0.5 truncate">
                    {isSk ? trk.vibeSk : trk.vibeEn}
                  </span>
                </button>
              );
            })}
          </div>

          {settings.bgMusicTrack === "custom" && (
            <div className="p-3 rounded-xl border border-indigo-500/40 bg-indigo-950/20 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                  <FileAudio className="h-4 w-4 text-indigo-400" />
                  {settings.customMusicName || (isSk ? "Žiadny audio súbor nevybraný" : "No audio file selected")}
                </span>
                <label className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-md active:scale-95">
                  <Upload className="h-3.5 w-3.5" />
                  <span>{isSk ? "Vybrať MP3/WAV" : "Choose MP3/WAV"}</span>
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const url = URL.createObjectURL(file);
                        onChangeSettings({
                          bgMusicTrack: "custom",
                          customMusicUrl: url,
                          customMusicName: file.name,
                        });
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          )}

          {settings.bgMusicTrack !== "none" && (
            <div className="pt-2 border-t border-neutral-800 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] text-neutral-400">
                <span>{isSk ? "Hlasitosť hudby:" : "Music Volume:"}</span>
                <input
                  type="range"
                  min={0.05}
                  max={0.8}
                  step={0.05}
                  value={settings.bgMusicVolume}
                  onChange={(e) =>
                    onChangeSettings({ bgMusicVolume: parseFloat(e.target.value) })
                  }
                  className="w-32 accent-indigo-500 cursor-pointer"
                />
              </div>

              {/* Auto Ducking toggle */}
              <label className="flex items-center justify-between text-[11px] cursor-pointer text-neutral-300">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="h-3.5 w-3.5 text-indigo-400" />
                  {isSk
                    ? "Auto-Ducking: Stíšiť hudbu pri hovorení (-72%)"
                    : "Auto-Ducking: Smoothly dip music when speaking"}
                </span>
                <input
                  type="checkbox"
                  checked={settings.bgMusicDucking}
                  onChange={(e) =>
                    onChangeSettings({ bgMusicDucking: e.target.checked })
                  }
                  className="h-3.5 w-3.5 accent-indigo-500 cursor-pointer"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Section 4: Silence & Dead-Air Clipper Stats */}
      <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Scissors className="h-4 w-4 text-emerald-400 flex-shrink-0" />
          <div>
            <div className="font-bold text-white text-xs">
              {isSk
                ? "Automatické Vystrihnutie Mŕtvych Pauz"
                : "Auto Silence & Dead-Air Cutter"}
            </div>
            <p className="text-[11px] text-emerald-400/90">
              {isSk
                ? `Odstránených ~${settings.detectedSilenceSeconds || 2.8}s zbytočného ticha medzi vetami.`
                : `Cut ~${settings.detectedSilenceSeconds || 2.8}s of dead air between sentences.`}
            </p>
          </div>
        </div>
        <span className="rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono font-bold px-2 py-0.5 text-[11px]">
          AKTÍVNE
        </span>
      </div>
    </div>
  );
};

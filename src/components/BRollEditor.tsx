import React from "react";
import {
  Layers,
  Plus,
  Trash2,
  TrendingUp,
  DollarSign,
  Newspaper,
  Flame,
  Clock,
  Sparkles,
  Sliders,
  BookOpen,
  Cpu,
  Lightbulb,
  Target,
  Maximize2,
} from "lucide-react";
import { BRollOverlay, BRollOverlayType } from "../types";

interface BRollEditorProps {
  overlays: BRollOverlay[];
  onChangeOverlays: (overlays: BRollOverlay[]) => void;
  language: "sk" | "en";
  currentTime: number;
  onSeek: (time: number) => void;
  bRollEnabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  paperTexture: boolean;
  onTogglePaperTexture: (enabled: boolean) => void;
  onOpenFullScreen: () => void;
  duration: number;
}

export const BRollEditor: React.FC<BRollEditorProps> = ({
  overlays,
  onChangeOverlays,
  language,
  currentTime,
  onSeek,
  bRollEnabled,
  onToggleEnabled,
  paperTexture,
  onTogglePaperTexture,
  onOpenFullScreen,
  duration,
}) => {
  const isSk = language === "sk";

  const presetTypes: {
    type: BRollOverlayType;
    label: string;
    icon: any;
    defaultTitle: string;
    defaultSub: string;
  }[] = [
    {
      type: "educational-whiteboard",
      label: isSk ? "Edu Tabuľa (Kroky)" : "Educational Whiteboard",
      icon: BookOpen,
      defaultTitle: isSk ? "KROK 1: STRUKTÚRA" : "STEP 1: FRAMEWORK",
      defaultSub: isSk ? "Vzdelávací OmniStrih" : "Educational Cut",
    },
    {
      type: "tech-code",
      label: isSk ? "AI Kód & Terminál" : "AI Code & Terminal",
      icon: Cpu,
      defaultTitle: "AI ALGORITMUS",
      defaultSub: "LATENCIA: 0ms",
    },
    {
      type: "brain-idea",
      label: isSk ? "Dopamínový Nápad 💡" : "Idea & Retention 💡",
      icon: Lightbulb,
      defaultTitle: isSk ? "RETENCIA +85%" : "RETENTION +85%",
      defaultSub: isSk ? "Dopamínový Reset" : "Cognitive Focus",
    },
    {
      type: "target-goal",
      label: isSk ? "Cieľ 100% 🎯" : "Target Goal 🎯",
      icon: Target,
      defaultTitle: isSk ? "100% VÝSLEDOK" : "100% GOAL ACHIEVED",
      defaultSub: isSk ? "Zaručený Úspech" : "Proven Method",
    },
    {
      type: "growth-chart",
      label: isSk ? "Graf rastu virality" : "Virality Growth Chart",
      icon: TrendingUp,
      defaultTitle: "+350% VIRALITY",
      defaultSub: "Opus AI Algorithm",
    },
    {
      type: "money-stack",
      label: isSk ? "0€ Úspora / Peniaze" : "0€ Savings / Money",
      icon: DollarSign,
      defaultTitle: "0€ NAVŽDY",
      defaultSub: isSk ? "Ušetrené $50/mesiac" : "Save $50/mo Subscriptions",
    },
    {
      type: "newspaper-headline",
      label: isSk ? "Novinový titulok (OmniStrih)" : "Newspaper Headline",
      icon: Newspaper,
      defaultTitle: "DENNÍK: OMNISTRIH",
      defaultSub: isSk ? "Strih za 60 sekúnd" : "Edit in 60 seconds",
    },
    {
      type: "time-saver",
      label: isSk ? "Stopky: 95% Úspora času" : "Stopwatch: 95% Time Saver",
      icon: Clock,
      defaultTitle: "95% ÚSPORA ČASU",
      defaultSub: isSk ? "Bleskový strih videa" : "Lightning fast video edit",
    },
    {
      type: "fire-meme",
      label: isSk ? "Virálny Oheň / Nálepka" : "Viral Fire Meme Sticker",
      icon: Flame,
      defaultTitle: "VIRALITY SCORE: 98/100",
      defaultSub: isSk ? "Zákaz scrollovania" : "Stop scrolling now",
    },
  ];

  const handleAddPreset = (preset: (typeof presetTypes)[0]) => {
    const start = Math.max(0, currentTime);
    const end = start + 2.5;

    const newOverlay: BRollOverlay = {
      id: "broll-" + Date.now(),
      type: preset.type,
      start,
      end,
      title: preset.defaultTitle,
      subtitle: preset.defaultSub,
      position: overlays.length % 2 === 0 ? "top-right" : "bottom-right",
      rotation: Math.random() > 0.5 ? -3 : 3,
    };

    onChangeOverlays([...overlays, newOverlay]);
  };

  const handleDelete = (id: string) => {
    onChangeOverlays(overlays.filter((o) => o.id !== id));
  };

  const handleUpdate = (id: string, updates: Partial<BRollOverlay>) => {
    onChangeOverlays(
      overlays.map((o) => (o.id === id ? { ...o, ...updates } : o))
    );
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 sm:p-5 shadow-xl text-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-indigo-400" />
          <div>
            <h2 className="font-['Fraunces'] text-base font-bold text-white">
              {isSk ? "Opus & Omni B-Roll Prekrytia" : "Opus & Omni B-Roll Overlays"}
            </h2>
            <p className="text-[11px] text-neutral-400">
              {isSk
                ? "Taktilné grafiky, polaroidy a schémy prispôsobené obsahu videa"
                : "Tactile cutaways, whiteboards & charts adapting to video context"}
            </p>
          </div>
        </div>

        {/* Global Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenFullScreen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20"
            title={isSk ? "Celoobrazovková časová os" : "Full-screen timeline"}
          >
            <Maximize2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{isSk ? "Časová os" : "Timeline"}</span>
          </button>

          <button
            onClick={() => onToggleEnabled(!bRollEnabled)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all border ${
              bRollEnabled
                ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                : "border-neutral-800 bg-neutral-950 text-neutral-500"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{bRollEnabled ? (isSk ? "B-Roll ZAPNUTÝ" : "B-Roll ON") : (isSk ? "VYPNUTÝ" : "OFF")}</span>
          </button>
        </div>
      </div>

      {/* Paper texture toggle (OmniStrih tactile look) */}
      <div
        onClick={() => onTogglePaperTexture(!paperTexture)}
        className={`flex items-center justify-between rounded-xl border p-2.5 cursor-pointer transition-all ${
          paperTexture
            ? "border-amber-500/60 bg-amber-500/10"
            : "border-neutral-800 bg-neutral-950/40"
        }`}
      >
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-amber-400" />
          <div>
            <span className="font-bold text-white block">
              {isSk ? "OmniStrih Taktilná Novinová Textúra" : "OmniStrih Tactile Paper Texture"}
            </span>
            <span className="text-[11px] text-neutral-400">
              {isSk
                ? "Pridáva jemnú vinetáciu a novinový rámec podľa vzoru aiktivista.sk/omnistrih"
                : "Adds paper collage frame and vignette from OmniStrih methodology"}
            </span>
          </div>
        </div>
        <div
          className={`h-4 w-8 rounded-full transition-colors relative ${
            paperTexture ? "bg-amber-500" : "bg-neutral-800"
          }`}
        >
          <div
            className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
              paperTexture ? "left-4" : "left-1"
            }`}
          />
        </div>
      </div>

      {/* Quick Insert Preset Buttons */}
      <div className="flex flex-col gap-2">
        <span className="text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
          {isSk ? "Rýchle vloženie na aktuálny čas:" : "Quick insert at current time:"}
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {presetTypes.map((p, idx) => {
            const Icon = p.icon;
            return (
              <button
                key={idx}
                onClick={() => handleAddPreset(p)}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-950/70 p-2 text-left hover:border-indigo-500/60 hover:text-white transition-all group"
              >
                <Icon className="h-3.5 w-3.5 text-indigo-400 group-hover:scale-110 transition-transform flex-shrink-0" />
                <span className="truncate font-semibold text-neutral-300">
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Overlay list */}
      <div className="flex flex-col gap-2 pt-2">
        <span className="text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
          {isSk ? `Aktívne prekrytia (${overlays.length}):` : `Active overlays (${overlays.length}):`}
        </span>

        {overlays.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-neutral-800 text-center text-neutral-500">
            {isSk
              ? "Žiadne B-roll prekrytia. Klikni na 'Kúzelný OmniStrih' alebo pridaj tlačidlami vyššie."
              : "No B-roll overlays yet. Click Magic OmniStrih or add via presets above."}
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
            {overlays.map((ov) => {
              const isCurrent = currentTime >= ov.start && currentTime <= ov.end;
              return (
                <div
                  key={ov.id}
                  className={`flex flex-col gap-2 rounded-xl border p-2.5 transition-all ${
                    isCurrent
                      ? "border-indigo-500/80 bg-indigo-950/20"
                      : "border-neutral-800 bg-neutral-950/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-indigo-400 font-bold text-[11px]">
                        {ov.start.toFixed(1)}s - {ov.end.toFixed(1)}s
                      </span>
                      <span className="text-[10px] text-neutral-400 uppercase bg-neutral-800 px-1.5 py-0.5 rounded">
                        {ov.type}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onSeek(ov.start)}
                        className="text-[10px] text-neutral-400 hover:text-white px-1.5 py-0.5 rounded bg-neutral-800"
                      >
                        {isSk ? "Skočiť" : "Seek"}
                      </button>
                      <button
                        onClick={() => handleDelete(ov.id)}
                        className="text-neutral-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={ov.title}
                      onChange={(e) => handleUpdate(ov.id, { title: e.target.value })}
                      placeholder={isSk ? "Nadpis" : "Title"}
                      className="rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1 text-white text-[11px] focus:outline-none focus:border-indigo-500"
                    />
                    <input
                      type="text"
                      value={ov.subtitle || ""}
                      onChange={(e) => handleUpdate(ov.id, { subtitle: e.target.value })}
                      placeholder={isSk ? "Podtitul" : "Subtitle"}
                      className="rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1 text-white text-[11px] focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-neutral-400">
                    <div className="flex items-center gap-2">
                      <span>{isSk ? "Pozícia:" : "Position:"}</span>
                      <select
                        value={ov.position}
                        onChange={(e) =>
                          handleUpdate(ov.id, {
                            position: e.target.value as BRollOverlay["position"],
                          })
                        }
                        className="bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-neutral-200"
                      >
                        <option value="top-right">{isSk ? "Vpravo hore" : "Top Right"}</option>
                        <option value="bottom-right">{isSk ? "Vpravo dole" : "Bottom Right"}</option>
                        <option value="top-left">{isSk ? "Vľavo hore" : "Top Left"}</option>
                        <option value="center">{isSk ? "Stred" : "Center"}</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span>{isSk ? "Trvanie:" : "Duration:"}</span>
                      <span className="font-mono text-neutral-300">
                        {(ov.end - ov.start).toFixed(1)}s
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

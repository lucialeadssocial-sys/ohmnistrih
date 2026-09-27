import React, { useState } from "react";
import {
  Type,
  Sparkles,
  Plus,
  Trash2,
  Highlighter,
  RotateCw,
  Sliders,
  Flame,
  Check,
  CheckSquare,
  Square,
  Maximize2,
  ShieldCheck,
  Monitor,
  Volume2,
  Mic,
  Clock,
  Target,
  Zap,
} from "lucide-react";
import { CaptionSegment, CaptionStyle, VideoAspectRatio, VideoProjectSettings } from "../types";

interface CaptionsEditorProps {
  captions: CaptionSegment[];
  onChangeCaptions: (newCaptions: CaptionSegment[]) => void;
  style: CaptionStyle;
  onChangeStyle: (style: CaptionStyle) => void;
  position: VideoProjectSettings["captionPosition"];
  onChangePosition: (pos: VideoProjectSettings["captionPosition"]) => void;
  captionScale?: number;
  onChangeCaptionScale?: (scale: number) => void;
  captionSafeMargin?: boolean;
  onChangeCaptionSafeMargin?: (margin: boolean) => void;
  aspectRatio?: VideoAspectRatio;
  audioOffsetMs?: number;
  onChangeAudioOffsetMs?: (ms: number) => void;
  voiceNarrationEnabled?: boolean;
  onToggleVoiceNarration?: (enabled: boolean) => void;
  onTranscribeSpeech?: () => void;
  isTranscribing?: boolean;
  language: "sk" | "en";
  onRegenerateAI: () => void;
  isGenerating: boolean;
  currentTime: number;
  onSeek: (time: number) => void;
  // Display settings
  captionCase?: "uppercase" | "normal" | "capitalize";
  onChangeCaptionCase?: (c: "uppercase" | "normal" | "capitalize") => void;
  captionShadowEnabled?: boolean;
  onChangeCaptionShadow?: (enabled: boolean) => void;
}

export const CaptionsEditor: React.FC<CaptionsEditorProps> = ({
  captions,
  onChangeCaptions,
  style,
  onChangeStyle,
  position,
  onChangePosition,
  captionScale = 1.0,
  onChangeCaptionScale,
  captionSafeMargin = true,
  onChangeCaptionSafeMargin,
  aspectRatio = "9:16",
  audioOffsetMs = 0,
  onChangeAudioOffsetMs,
  voiceNarrationEnabled = false,
  onToggleVoiceNarration,
  onTranscribeSpeech,
  isTranscribing = false,
  language,
  onRegenerateAI,
  isGenerating,
  currentTime,
  onSeek,
  captionCase = "uppercase",
  onChangeCaptionCase,
  captionShadowEnabled = true,
  onChangeCaptionShadow,
}) => {
  const isSk = language === "sk";
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);

  const stylePresets: { id: CaptionStyle; name: string; badge: string }[] = [
    { id: "omnistrih-torn-paper", name: "OmniStrih Papier", badge: "AIKTIVISTA ✨" },
    { id: "submagic-viral", name: "Submagic Viral", badge: "TOP 🔥" },
    { id: "hormozi-punch", name: "Hormozi Bold", badge: "KINETIC" },
    { id: "mrbeast-pop", name: "MrBeast Pop", badge: "POPULAR" },
    { id: "cyber-neon", name: "Cyber Neon", badge: "GLOW" },
    { id: "clean-minimal", name: "Clean Minimal", badge: "STUDIO" },
  ];

  const toggleWordHighlight = (segmentId: string, wordIdx: number) => {
    const updated = captions.map((seg) => {
      if (seg.id !== segmentId) return seg;
      const newWords = [...seg.words];
      newWords[wordIdx] = {
        ...newWords[wordIdx],
        highlight: !newWords[wordIdx].highlight,
      };
      return { ...seg, words: newWords };
    });
    onChangeCaptions(updated);
  };

  const handleUpdateText = (segmentId: string, newText: string) => {
    const updated = captions.map((seg) => {
      if (seg.id !== segmentId) return seg;
      const currentWords = seg.words || [];
      const split = newText.trim().split(/\s+/);
      const step = (seg.end - seg.start) / Math.max(1, split.length);

      const newWords = split.map((w, idx) => ({
        word: w,
        start: seg.start + idx * step,
        end: seg.start + (idx + 1) * step,
        highlight: currentWords[idx]?.highlight || idx === Math.floor(split.length / 2),
      }));

      return {
        ...seg,
        text: newText,
        words: newWords,
      };
    });
    onChangeCaptions(updated);
  };

  const handleDeleteSegment = (id: string) => {
    onChangeCaptions(captions.filter((c) => c.id !== id));
  };

  const handleAddSegment = () => {
    const last = captions[captions.length - 1];
    const start = last ? last.end + 0.2 : 0;
    const end = start + 2.5;
    const defaultWord = isSk ? "Nové slovo" : "New word";

    const newSeg: CaptionSegment = {
      id: "cap-" + Date.now(),
      start,
      end,
      text: defaultWord,
      emoji: "✨",
      words: [{ word: defaultWord, start, end, highlight: true }],
    };
    onChangeCaptions([...captions, newSeg]);
  };

  const handleViralAutoSplit = () => {
    // Splits long caption segments into short, punchy viral blocks (1-3 words)
    const newCaptions: CaptionSegment[] = [];
    
    captions.forEach((seg) => {
      const words = seg.words || [];
      if (words.length <= 3) {
        newCaptions.push(seg);
        return;
      }

      // Group words into chunks of 2-3
      for (let i = 0; i < words.length; i += 2) {
        const chunk = words.slice(i, i + 2);
        const chunkText = chunk.map(w => w.word).join(" ");
        const first = chunk[0];
        const last = chunk[chunk.length - 1];

        newCaptions.push({
          id: `viral-${seg.id}-${i}`,
          start: first.start,
          end: last.end,
          text: chunkText,
          emoji: seg.emoji, // Keep emoji if exists
          words: chunk.map(w => ({ ...w, highlight: w.highlight })),
        });
      }
    });

    onChangeCaptions(newCaptions);
  };

  const handleSnapToCurrentTime = (segId: string) => {
    const targetTime = Math.max(0, currentTime);
    const updated = captions.map((seg) => {
      if (seg.id !== segId) return seg;
      const segLen = Math.max(0.6, seg.end - seg.start);
      const newStart = targetTime;
      const newEnd = newStart + segLen;
      const words = seg.words?.map((w, idx) => {
        const wLen = Math.max(0.15, w.end - w.start);
        const wStart = newStart + idx * (segLen / Math.max(1, seg.words.length));
        return {
          ...w,
          start: parseFloat(wStart.toFixed(2)),
          end: parseFloat((wStart + wLen).toFixed(2)),
        };
      });
      return {
        ...seg,
        start: parseFloat(newStart.toFixed(2)),
        end: parseFloat(newEnd.toFixed(2)),
        words: words || seg.words,
      };
    });
    onChangeCaptions(updated);
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 sm:p-5 shadow-xl">
      {/* Top action header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-3">
        <div>
          <h2 className="font-['Fraunces'] text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Type className="h-4 w-4 text-rose-400" />
            {isSk ? "Submagic Titulky & Karaoke" : "Submagic Captions & Karaoke"}
          </h2>
          <p className="text-xs text-neutral-400">
            {isSk
              ? "Klikni na slovo pre Submagic zvýraznenie kľúčového slova"
              : "Click any word to toggle kinetic highlight color"}
          </p>
        </div>

        <button
          onClick={onRegenerateAI}
          disabled={isGenerating}
          className="flex items-center gap-1.5 rounded-xl border border-rose-500/50 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20 active:scale-95 transition-all disabled:opacity-50"
        >
          <Sparkles className={`h-3.5 w-3.5 ${isGenerating ? "animate-spin" : ""}`} />
          <span>{isSk ? "AI Inteligentný Prepis" : "AI Intelligent Transcript"}</span>
        </button>
      </div>

      {/* Intelligent Processing Tools */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onTranscribeSpeech}
          disabled={isTranscribing}
          className="flex items-center justify-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-3 py-2 text-xs font-bold text-indigo-300 hover:bg-indigo-500/20 transition-all disabled:opacity-50 shadow-sm"
        >
          <Mic className="h-4 w-4" />
          <span>{isSk ? "Vytiahnuť text z videa" : "Extract text from video"}</span>
        </button>
        <button
          onClick={handleViralAutoSplit}
          className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition-all shadow-sm"
        >
          <Zap className="h-4 w-4" />
          <span>{isSk ? "Virálny auto-strih textu" : "Viral auto-split text"}</span>
        </button>
      </div>

      {/* Bulk Edit / Hromadná úprava Section */}
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3.5 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-rose-400" />
          <span className="text-sm font-bold text-white">
            {isSk ? "Hromadná úprava (Všetky titulky naraz):" : "Bulk Edit (Apply to all):"}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={() => {
              const updated = captions.map(c => ({
                ...c,
                words: c.words.map(w => ({ ...w, highlight: true }))
              }));
              onChangeCaptions(updated);
            }}
            className="rounded-lg bg-neutral-800 hover:bg-neutral-700 px-2 py-2 text-[10px] font-bold text-white border border-neutral-700"
          >
            {isSk ? "Vysvietiť všetko" : "Highlight All Words"}
          </button>
          <button
            onClick={() => {
              const updated = captions.map(c => ({
                ...c,
                words: c.words.map(w => ({ ...w, highlight: false }))
              }));
              onChangeCaptions(updated);
            }}
            className="rounded-lg bg-neutral-800 hover:bg-neutral-700 px-2 py-2 text-[10px] font-bold text-white border border-neutral-700"
          >
            {isSk ? "Zrušiť zvýraznenie" : "Remove Highlights"}
          </button>
          <button
            onClick={() => {
              const updated = captions.map(c => ({
                ...c,
                emoji: "✨"
              }));
              onChangeCaptions(updated);
            }}
            className="rounded-lg bg-neutral-800 hover:bg-neutral-700 px-2 py-2 text-[10px] font-bold text-white border border-neutral-700"
          >
            {isSk ? "Pridať emoji všade" : "Add Emoji to All"}
          </button>
          <button
            onClick={() => {
              const updated = captions.map(c => ({
                ...c,
                emoji: ""
              }));
              onChangeCaptions(updated);
            }}
            className="rounded-lg bg-neutral-800 hover:bg-neutral-700 px-2 py-2 text-[10px] font-bold text-white border border-neutral-700"
          >
            {isSk ? "Odobrať všetky emoji" : "Remove All Emojis"}
          </button>
        </div>
      </div>

      {/* Style Presets */}
      <div>
        <label className="text-xs font-semibold text-neutral-400 mb-2 block">
          {isSk ? "Vizuálny štýl písma:" : "Visual Caption Style:"}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {stylePresets.map((preset) => {
            const isSelected = style === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => onChangeStyle(preset.id)}
                className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition-all border ${
                  isSelected
                    ? "border-rose-500 bg-rose-500/10 text-white shadow-sm ring-1 ring-rose-500/40"
                    : "border-neutral-800 bg-neutral-950/40 text-neutral-400 hover:text-white"
                }`}
              >
                <span>{preset.name}</span>
                <span className="text-[9px] px-1 py-0.5 rounded bg-neutral-800 text-rose-300">
                  {preset.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Position Checkboxes: Hore, V strede, Dole pod tvárou */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-3.5">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <label className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
            <CheckSquare className="h-4 w-4 text-rose-400" />
            <span>
              {isSk
                ? "Pozícia titulkov (zaškrtnúť: hore, v strede, dole pod tvárou):"
                : "Caption Position (check: top, middle, under face):"}
            </span>
          </label>
          <span className="text-[10px] text-rose-300/80 bg-rose-500/10 px-2 py-0.5 rounded-md font-mono font-semibold">
            {position === "top"
              ? isSk ? "Hore (18%)" : "Top (18%)"
              : position === "middle"
              ? isSk ? "V strede (50%)" : "Middle (50%)"
              : isSk ? "Dole pod tvárou (74%)" : "Under Face (74%)"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {[
            {
              id: "top" as const,
              titleSk: "Hore",
              titleEn: "Top",
              descSk: "Nad tvárou • 18% výšky",
              descEn: "Above face • 18%",
              iconPos: "top",
            },
            {
              id: "middle" as const,
              titleSk: "V strede",
              titleEn: "Middle",
              descSk: "Centrum obrazovky • 50%",
              descEn: "Screen center • 50%",
              iconPos: "middle",
            },
            {
              id: "bottom" as const,
              titleSk: "Dole pod tvárou",
              titleEn: "Under Face",
              descSk: "Pod bradou / Safe Reels • 74%",
              descEn: "Under face / Safe Reels • 74%",
              iconPos: "bottom",
            },
          ].map((item) => {
            const isChecked = position === item.id;
            return (
              <label
                key={item.id}
                onClick={() => onChangePosition(item.id)}
                className={`relative flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isChecked
                    ? "border-rose-500 bg-rose-500/10 shadow-md ring-1 ring-rose-500/30 text-white"
                    : "border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
                }`}
              >
                {/* Real Checkbox */}
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => onChangePosition(item.id)}
                  className="h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-rose-500 accent-rose-500 cursor-pointer shrink-0"
                />

                {/* Visual mini-mockup frame */}
                <div className="w-6 h-9 rounded-sm border border-neutral-700 bg-neutral-950 flex flex-col justify-between p-0.5 shrink-0">
                  <div
                    className={`h-1.5 w-full rounded-xs transition-colors ${
                      item.iconPos === "top"
                        ? isChecked
                          ? "bg-rose-500"
                          : "bg-neutral-400"
                        : "bg-neutral-800"
                    }`}
                  />
                  <div
                    className={`h-1.5 w-full rounded-xs transition-colors ${
                      item.iconPos === "middle"
                        ? isChecked
                          ? "bg-rose-500"
                          : "bg-neutral-400"
                        : "bg-neutral-800"
                    }`}
                  />
                  <div
                    className={`h-1.5 w-full rounded-xs transition-colors ${
                      item.iconPos === "bottom"
                        ? isChecked
                          ? "bg-rose-500"
                          : "bg-neutral-400"
                        : "bg-neutral-800"
                    }`}
                  />
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-white truncate">
                    {isSk ? item.titleSk : item.titleEn}
                  </span>
                  <span className="text-[10px] text-neutral-400 truncate">
                    {isSk ? item.descSk : item.descEn}
                  </span>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Video Size & Safe Margin Adaptation */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-3.5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Monitor className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-bold text-neutral-200">
              {isSk ? "Úprava zobrazenia a mierky:" : "Display & Scale Adjustment:"}
            </span>
          </div>
        </div>

        {/* Caption Case & Shadow Toggles */}
        <div className="flex flex-wrap items-center gap-3 py-1">
          {onChangeCaptionCase && (
            <div className="flex items-center gap-1.5 bg-neutral-900 rounded-lg p-1 border border-neutral-800">
              <button
                onClick={() => onChangeCaptionCase("uppercase")}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${captionCase === "uppercase" ? "bg-rose-500 text-white" : "text-neutral-500 hover:text-white"}`}
              >
                ABC
              </button>
              <button
                onClick={() => onChangeCaptionCase("normal")}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${captionCase === "normal" ? "bg-rose-500 text-white" : "text-neutral-500 hover:text-white"}`}
              >
                abc
              </button>
              <button
                onClick={() => onChangeCaptionCase("capitalize")}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${captionCase === "capitalize" ? "bg-rose-500 text-white" : "text-neutral-500 hover:text-white"}`}
              >
                Abc
              </button>
            </div>
          )}

          {onChangeCaptionShadow && (
            <label className="flex items-center gap-2 cursor-pointer bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800">
              <input
                type="checkbox"
                checked={captionShadowEnabled}
                onChange={(e) => onChangeCaptionShadow(e.target.checked)}
                className="h-3 w-3 rounded border-neutral-700 bg-neutral-800 text-rose-500 accent-rose-500"
              />
              <span className="text-[10px] font-bold text-neutral-300">{isSk ? "Tieň" : "Shadow"}</span>
            </label>
          )}
        </div>

        {/* Quick Scale Presets & Slider */}
        {onChangeCaptionScale && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { scale: 0.85, label: isSk ? "Kompaktné (85%)" : "Compact (85%)" },
                { scale: 1.0, label: isSk ? "Štandard (100%)" : "Standard (100%)" },
                { scale: 1.2, label: isSk ? "Výrazné (120%)" : "Bold (120%)" },
                { scale: 1.35, label: isSk ? "Maxi (135%)" : "Maxi (135%)" },
              ].map((p) => {
                const isActive = Math.abs(captionScale - p.scale) < 0.05;
                return (
                  <button
                    key={p.scale}
                    onClick={() => onChangeCaptionScale(p.scale)}
                    className={`rounded-lg py-1 px-1.5 text-[10px] font-bold transition-all truncate border ${
                      isActive
                        ? "border-amber-400/80 bg-amber-400/20 text-white shadow-xs"
                        : "border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:text-white"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10px] text-neutral-500">70%</span>
              <input
                type="range"
                min="0.7"
                max="1.4"
                step="0.05"
                value={captionScale}
                onChange={(e) => onChangeCaptionScale(parseFloat(e.target.value))}
                className="w-full accent-rose-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
              />
              <span className="text-[10px] text-neutral-500">140%</span>
            </div>
          </div>
        )}

        {/* Safe Margin Protection Checkbox */}
        {onChangeCaptionSafeMargin && (
          <label className="flex items-center gap-2.5 pt-2 border-t border-neutral-800/80 cursor-pointer">
            <input
              type="checkbox"
              checked={captionSafeMargin}
              onChange={(e) => onChangeCaptionSafeMargin(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-rose-500 accent-rose-500 cursor-pointer"
            />
            <div className="flex items-center gap-1 text-xs text-neutral-300">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-semibold">
                {isSk
                  ? "Chrániť pred orezaním okrajov videa (Automatické zalomenie do 2 riadkov)"
                  : "Safe Margin Protection (Auto-wrap long sentences into 2 lines)"}
              </span>
            </div>
          </label>
        )}
      </div>

      {/* Audio-Caption Sync & Calibration Panel */}
      <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3.5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-indigo-400" />
            <span className="text-xs font-bold text-white">
              {isSk ? "Presný súlad so zvukom (Audio Sync Calibration):" : "Audio-to-Speech Sync Calibration:"}
            </span>
          </div>

          <div className="text-xs font-mono font-bold text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-500/30">
            {audioOffsetMs > 0 ? `+${audioOffsetMs}` : audioOffsetMs} ms
          </div>
        </div>

        <p className="text-[11px] text-neutral-400">
          {isSk
            ? "Ak sa slová vo videu rozchádzajú so zvukom, posuňte offset pre milisekundovú presnosť:"
            : "If words in video don't match speech timing, adjust offset for millisecond accuracy:"}
        </p>

        {/* Offset Nudge Buttons */}
        {onChangeAudioOffsetMs && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-5 gap-1.5">
              {[
                { ms: -300, label: "-300ms" },
                { ms: -100, label: "-100ms" },
                { ms: 0, label: "0 (Reset)" },
                { ms: 100, label: "+100ms" },
                { ms: 300, label: "+300ms" },
              ].map((b) => (
                <button
                  key={b.ms}
                  type="button"
                  onClick={() => onChangeAudioOffsetMs(b.ms === 0 ? 0 : audioOffsetMs + b.ms)}
                  className={`rounded-lg py-1 px-1 text-[10px] font-bold font-mono transition-all border ${
                    b.ms === 0 && audioOffsetMs === 0
                      ? "border-indigo-500 bg-indigo-500/30 text-white"
                      : "border-neutral-800 bg-neutral-900/70 text-neutral-300 hover:text-white hover:border-indigo-500/50"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-neutral-500">-1500ms</span>
              <input
                type="range"
                min="-1500"
                max="1500"
                step="50"
                value={audioOffsetMs}
                onChange={(e) => onChangeAudioOffsetMs(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
              />
              <span className="text-[10px] text-neutral-500">+1500ms</span>
            </div>
          </div>
        )}

        {/* Voice Narration & Speech Recognition Extras */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-indigo-500/20">
          {onToggleVoiceNarration && (
            <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-300">
              <input
                type="checkbox"
                checked={voiceNarrationEnabled}
                onChange={(e) => onToggleVoiceNarration(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-neutral-700 bg-neutral-800 text-indigo-500 accent-indigo-500 cursor-pointer"
              />
              <span className="flex items-center gap-1 font-semibold">
                <Volume2 className="h-3.5 w-3.5 text-indigo-400" />
                <span>{isSk ? "Hlasový sprievod reči (TTS)" : "Voice Narration (TTS)"}</span>
              </span>
            </label>
          )}

          {onTranscribeSpeech && (
            <button
              type="button"
              onClick={onTranscribeSpeech}
              disabled={isTranscribing}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/20 px-2.5 py-1 text-[11px] font-bold text-indigo-200 hover:bg-indigo-500/30 hover:text-white transition-all disabled:opacity-50"
            >
              <Mic className="h-3.5 w-3.5 text-indigo-300" />
              <span>
                {isTranscribing
                  ? isSk ? "Počúvam reč..." : "Transcribing..."
                  : isSk ? "Prepísať reč zo zvuku" : "Transcribe Audio Speech"}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Captions List */}
      <div className="flex flex-col gap-2.5 max-h-[340px] overflow-y-auto pr-1">
        {captions.map((seg, segIdx) => {
          const isActive =
            currentTime >= seg.start && currentTime <= seg.end + 0.1;

          return (
            <div
              key={seg.id}
              className={`rounded-xl border p-3 transition-all ${
                isActive
                  ? "border-rose-500/80 bg-neutral-900/90 shadow-md ring-1 ring-rose-500/20"
                  : "border-neutral-800 bg-neutral-950/50 hover:border-neutral-700"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSeek(seg.start)}
                    className="font-mono font-semibold text-rose-400 hover:underline"
                  >
                    {seg.start.toFixed(1)}s - {seg.end.toFixed(1)}s
                  </button>

                  {/* Snap to current playhead button */}
                  <button
                    type="button"
                    onClick={() => handleSnapToCurrentTime(seg.id)}
                    title={isSk ? `Posunúť na aktuálny čas videa (${currentTime.toFixed(1)}s)` : `Snap to current video time (${currentTime.toFixed(1)}s)`}
                    className="flex items-center gap-1 text-[10px] font-bold text-neutral-400 hover:text-indigo-300 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800 hover:border-indigo-500/40 transition-all"
                  >
                    <Target className="h-3 w-3 text-indigo-400" />
                    <span>{isSk ? "Zarovnať sem" : "Snap to time"}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-base">{seg.emoji || "💬"}</span>
                  <button
                    onClick={() => handleDeleteSegment(seg.id)}
                    className="text-neutral-500 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Editable Text Field */}
              <input
                type="text"
                value={seg.text}
                onChange={(e) => handleUpdateText(seg.id, e.target.value)}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs sm:text-sm font-bold text-white focus:border-rose-500 focus:outline-none"
              />

              {/* Word Chips with highlight toggles */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {seg.words?.map((w, wIdx) => (
                  <button
                    key={wIdx}
                    onClick={() => toggleWordHighlight(seg.id, wIdx)}
                    title={isSk ? "Klikni pre zmenu zvýraznenia" : "Toggle highlight"}
                    className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold transition-all ${
                      w.highlight
                        ? "bg-amber-400 text-neutral-950 ring-1 ring-amber-300"
                        : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                    }`}
                  >
                    <span>{w.word}</span>
                    {w.highlight && <Flame className="h-3 w-3 text-amber-900 fill-current" />}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add New Caption Segment Button */}
      <button
        onClick={handleAddSegment}
        className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-neutral-700 p-2.5 text-xs font-bold text-neutral-400 hover:border-neutral-500 hover:text-white transition-all"
      >
        <Plus className="h-4 w-4" />
        <span>{isSk ? "Pridať ďalší blok titulkov" : "Add Caption Segment"}</span>
      </button>
    </div>
  );
};

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Sliders,
  Play,
  RotateCcw,
  Volume2,
  Layers,
  Plus,
  Trash2,
  Check,
  Zap,
  Film,
  Compass,
  ArrowRight,
  MoveRight,
  Maximize2,
  Clock,
  Settings,
  Scissors,
  Eye,
  Search,
  GripVertical,
  PanelRightOpen,
  PanelRightClose,
  HelpCircle,
  FolderOpen
} from "lucide-react";
import {
  TransitionPreset,
  TransitionEasing,
  TransitionType,
  VideoTransition,
  TransitionProject,
  VideoProjectSettings,
} from "../types";
import {
  TRANSITION_PRESETS,
  EASING_OPTIONS,
  getEasingCss,
} from "../utils/transitionPresets";
import { playSynthesizedSFX } from "../utils/audioSynth";
import { TransitionPresetDrawer } from "./TransitionPresetDrawer";

interface TransitionStudioProps {
  currentVideoUrl: string;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  transitions: VideoTransition[];
  onChangeTransitions: (transitions: VideoTransition[]) => void;
  language?: "sk" | "en";
  cuts?: { id: string; time: number; label?: string }[];
}

export const TransitionStudio: React.FC<TransitionStudioProps> = ({
  currentVideoUrl,
  currentTime,
  duration,
  onSeek,
  transitions,
  onChangeTransitions,
  language = "sk",
  cuts = [],
}) => {
  const isSk = language === "sk";
  const validDuration = duration > 0 ? duration : 15;

  // Drawer open/close state
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Search & Category filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    "ALL" | "CLASSIC" | "DYNAMIC_ZOOM" | "KINETIC_SLIDE" | "FILMIC_ORGANIC" | "CREATIVE_GLITCH"
  >("ALL");

  // Active selected preset / transition being customized
  const [activePreset, setActivePreset] = useState<TransitionPreset>(TRANSITION_PRESETS[2]); // Zoom-Through default
  const [customDuration, setCustomDuration] = useState<number>(0.35);
  const [customEasing, setCustomEasing] = useState<TransitionEasing>("spring");
  const [customSfx, setCustomSfx] = useState<
    "whoosh" | "swish" | "glitch_sfx" | "film_click" | "whip_snap" | "none"
  >("whoosh");
  const [bezierCurve, setBezierCurve] = useState<[number, number, number, number]>([0.16, 1, 0.3, 1]);

  // Live preview state inside sandbox
  const [isPreviewAnimating, setIsPreviewAnimating] = useState<boolean>(false);
  const [previewClipA, setPreviewClipA] = useState<string>("Scene 1 • Main Take");
  const [previewClipB, setPreviewClipB] = useState<string>("Scene 2 • Punch Hook");

  // Timeline Drag & Drop Hover state
  const timelineTrackRef = useRef<HTMLDivElement>(null);
  const [isTimelineDragOver, setIsTimelineDragOver] = useState<boolean>(false);
  const [dragHoverTime, setDragHoverTime] = useState<number | null>(null);
  const [snappedCutId, setSnappedCutId] = useState<string | null>(null);
  const [draggedPresetName, setDraggedPresetName] = useState<string | null>(null);

  // Status Notification Toast
  const [notification, setNotification] = useState<{ text: string; type: "success" | "info" } | null>(null);

  const showLocalToast = (text: string) => {
    setNotification({ text, type: "success" });
    setTimeout(() => setNotification(null), 3000);
  };

  // Fallback cuts if none supplied
  const effectiveCuts =
    cuts && cuts.length > 0
      ? cuts
      : [
          { id: "cut-1", time: Math.min(validDuration * 0.2, 2.5), label: isSk ? "Strih 1 • Pauza" : "Cut 1 • Pause" },
          { id: "cut-2", time: Math.min(validDuration * 0.45, 5.2), label: isSk ? "Strih 2 • Zmena témy" : "Cut 2 • Topic Switch" },
          { id: "cut-3", time: Math.min(validDuration * 0.72, 8.4), label: isSk ? "Strih 3 • Vyvrcholenie" : "Cut 3 • Climax" },
        ];

  // Update parameters when preset changes
  const handleSelectPreset = (preset: TransitionPreset) => {
    setActivePreset(preset);
    setCustomDuration(preset.defaultDuration);
    setCustomEasing(preset.defaultEasing);
    setCustomSfx(preset.recommendedSfx);
    if (preset.easingCurve) {
      setBezierCurve(preset.easingCurve);
    } else {
      const match = EASING_OPTIONS.find((e) => e.id === preset.defaultEasing);
      if (match) setBezierCurve(match.curve);
    }
    triggerPreviewAnimation();
  };

  const handleSelectEasing = (easingId: TransitionEasing) => {
    setCustomEasing(easingId);
    const match = EASING_OPTIONS.find((e) => e.id === easingId);
    if (match) {
      setBezierCurve(match.curve);
    }
    triggerPreviewAnimation();
  };

  // Trigger live interactive CSS transition animation preview
  const triggerPreviewAnimation = () => {
    setIsPreviewAnimating(false);
    setTimeout(() => {
      setIsPreviewAnimating(true);
      if (customSfx !== "none") {
        playSynthesizedSFX(
          customSfx === "whip_snap"
            ? "whoosh"
            : customSfx === "glitch_sfx"
            ? "pop"
            : customSfx === "film_click"
            ? "click"
            : (customSfx as any),
          0.7
        );
      }
    }, 20);
  };

  // Add transition at a specific timestamp
  const handleApplyPresetAtTime = (preset: TransitionPreset, time: number) => {
    const timestamp = Math.max(0, Math.min(validDuration, Math.round(time * 100) / 100));
    const newTransition: VideoTransition = {
      id: "trans_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      timestamp,
      duration: preset.defaultDuration,
      type: preset.type,
      easing: preset.defaultEasing,
      easingCurve: preset.easingCurve || [0.25, 1, 0.5, 1],
      soundEffect: preset.recommendedSfx,
      labelSk: preset.nameSk,
      labelEn: preset.nameEn,
    };

    // Remove existing transition if at exact same time (<0.15s)
    const filtered = transitions.filter((t) => Math.abs(t.timestamp - timestamp) > 0.15);
    const updated = [...filtered, newTransition].sort((a, b) => a.timestamp - b.timestamp);
    onChangeTransitions(updated);
    onSeek(timestamp);
    showLocalToast(
      isSk
        ? `✨ Prechod "${preset.nameSk}" aplikovaný na @ ${timestamp.toFixed(2)}s`
        : `✨ Transition "${preset.nameEn}" applied at @ ${timestamp.toFixed(2)}s`
    );
  };

  // Add transition at current playhead time
  const handleAddAtCurrentTime = () => {
    handleApplyPresetAtTime(activePreset, currentTime);
  };

  // Apply transition to all cut points
  const handleApplyToAllCuts = () => {
    const cutTimes = effectiveCuts.map((c) => c.time).filter((t) => t < validDuration);

    const generated: VideoTransition[] = cutTimes.map((time, idx) => ({
      id: "trans_cut_" + idx + "_" + Math.random().toString(36).substring(2, 7),
      timestamp: Math.round(time * 100) / 100,
      duration: customDuration,
      type: activePreset.type,
      easing: customEasing,
      easingCurve: bezierCurve,
      soundEffect: customSfx,
      labelSk: activePreset.nameSk,
      labelEn: activePreset.nameEn,
      autoApplied: true,
    }));

    // Merge without duplicates at same timestamp
    const existing = transitions.filter((t) => !cutTimes.some((ct) => Math.abs(ct - t.timestamp) < 0.2));
    const merged = [...existing, ...generated].sort((a, b) => a.timestamp - b.timestamp);
    onChangeTransitions(merged);
    playSynthesizedSFX("cash", 0.7);
    showLocalToast(
      isSk
        ? `⚡ Prechod "${activePreset.nameSk}" aplikovaný na ${generated.length} strihových bodov!`
        : `⚡ Transition "${activePreset.nameEn}" applied to ${generated.length} cut markers!`
    );
  };

  const handleDeleteTransition = (id: string) => {
    onChangeTransitions(transitions.filter((t) => t.id !== id));
    playSynthesizedSFX("pop", 0.3);
  };

  const handleClearAll = () => {
    onChangeTransitions([]);
    playSynthesizedSFX("pop", 0.3);
  };

  // Drag & Drop Handlers for Timeline Track & Cut Markers
  const handleTimelineDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsTimelineDragOver(true);

    if (timelineTrackRef.current) {
      const rect = timelineTrackRef.current.getBoundingClientRect();
      const rawX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, rawX / rect.width));
      let calculatedTime = ratio * validDuration;

      // Check magnetic snap to cut markers (threshold = 0.4s or 4% of track)
      const snapThreshold = Math.max(0.3, validDuration * 0.03);
      let snappedCut: { id: string; time: number } | null = null;

      for (const cut of effectiveCuts) {
        if (Math.abs(cut.time - calculatedTime) <= snapThreshold) {
          calculatedTime = cut.time;
          snappedCut = cut;
          break;
        }
      }

      setDragHoverTime(Math.round(calculatedTime * 100) / 100);
      setSnappedCutId(snappedCut ? snappedCut.id : null);
    }
  };

  const handleTimelineDragLeave = (e: React.DragEvent) => {
    // Only reset if leaving the track container itself
    if (e.currentTarget === e.target) {
      setIsTimelineDragOver(false);
      setDragHoverTime(null);
      setSnappedCutId(null);
    }
  };

  const handleTimelineDrop = (e: React.DragEvent, targetTimeOverride?: number) => {
    e.preventDefault();
    setIsTimelineDragOver(false);
    const dropTime = targetTimeOverride !== undefined ? targetTimeOverride : dragHoverTime !== null ? dragHoverTime : currentTime;
    setDragHoverTime(null);
    setSnappedCutId(null);
    setDraggedPresetName(null);

    try {
      const jsonData = e.dataTransfer.getData("application/json");
      const plainText = e.dataTransfer.getData("text/plain");

      let presetToApply: TransitionPreset | undefined;

      if (jsonData) {
        presetToApply = JSON.parse(jsonData);
      } else if (plainText) {
        presetToApply = TRANSITION_PRESETS.find((p) => p.id === plainText || p.type === plainText);
      }

      if (!presetToApply) {
        presetToApply = activePreset;
      }

      if (presetToApply) {
        handleApplyPresetAtTime(presetToApply, dropTime);
        playSynthesizedSFX("cash", 0.7);
      }
    } catch (err) {
      console.warn("Drop transition parse error:", err);
      handleApplyPresetAtTime(activePreset, dropTime);
    }
  };

  const handlePresetCardDragStart = (preset: TransitionPreset, e: React.DragEvent) => {
    e.dataTransfer.setData("application/json", JSON.stringify(preset));
    e.dataTransfer.setData("text/plain", preset.id);
    e.dataTransfer.effectAllowed = "copyMove";
    setDraggedPresetName(isSk ? preset.nameSk : preset.nameEn);
    playSynthesizedSFX("whoosh", 0.3);
  };

  // Filtered presets for main grid
  const filteredPresets = TRANSITION_PRESETS.filter((p) => {
    if (selectedCategory !== "ALL" && p.category !== selectedCategory) return false;
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const matchName = p.nameSk.toLowerCase().includes(q) || p.nameEn.toLowerCase().includes(q);
      const matchDesc = p.descriptionSk.toLowerCase().includes(q) || p.descriptionEn.toLowerCase().includes(q);
      const matchType = p.type.toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchType) return false;
    }
    return true;
  });

  // SVG Curve Coordinate Path for Bezier visualizer
  const renderBezierSvg = () => {
    const [x1, y1, x2, y2] = bezierCurve;
    const p1x = x1 * 140 + 10;
    const p1y = 90 - y1 * 70;
    const p2x = x2 * 140 + 10;
    const p2y = 90 - y2 * 70;

    return (
      <svg className="w-full h-24 bg-neutral-950 rounded-xl border border-neutral-800/80 p-2 overflow-visible">
        <line x1="10" y1="20" x2="150" y2="20" stroke="#333" strokeDasharray="2 2" />
        <line x1="10" y1="90" x2="150" y2="90" stroke="#444" />
        <line x1="10" y1="20" x2="10" y2="90" stroke="#444" />
        <line x1="150" y1="20" x2="150" y2="90" stroke="#333" strokeDasharray="2 2" />

        <path
          d={`M 10 90 C ${p1x} ${p1y}, ${p2x} ${p2y}, 150 20`}
          fill="none"
          stroke="#f43f5e"
          strokeWidth="3"
        />

        <line x1="10" y1="90" x2={p1x} y2={p1y} stroke="#6366f1" strokeWidth="1.5" />
        <circle cx={p1x} cy={p1y} r="4" fill="#6366f1" />

        <line x1="150" y1="20" x2={p2x} y2={p2y} stroke="#ec4899" strokeWidth="1.5" />
        <circle cx={p2x} cy={p2y} r="4" fill="#ec4899" />
      </svg>
    );
  };

  // Helper for transition visual animations in sandbox
  const getSandboxAnimationClass = () => {
    if (!isPreviewAnimating) return "opacity-0 scale-95";

    switch (activePreset.type) {
      case "glitch":
        return "opacity-100 animate-glitch";
      case "camera_shake":
        return "opacity-100 animate-shake";
      case "spin_cw":
        return "opacity-100 animate-spin-cw";
      case "spin_ccw":
        return "opacity-100 animate-spin-ccw";
      case "warp_zoom":
        return "opacity-100 animate-warp-zoom";
      case "zoom_through":
        return "opacity-100 animate-zoom-through";
      case "zoom_in":
        return "opacity-100 scale-100";
      case "zoom_out":
        return "opacity-100 scale-100";
      case "slide_left":
        return "opacity-100 translate-x-0";
      case "slide_right":
        return "opacity-100 translate-x-0";
      case "slide_up":
        return "opacity-100 translate-y-0";
      case "whip_pan":
        return "opacity-100 translate-x-0 skew-x-0";
      case "tv_static":
        return "opacity-100 animate-tv-static";
      case "light_leak":
        return "opacity-100";
      case "film_burn":
        return "opacity-100";
      case "flash_white":
      case "flash_black":
        return "opacity-100";
      default:
        return "opacity-100";
    }
  };

  return (
    <div className="relative flex flex-col gap-6 w-full max-w-6xl mx-auto p-4 md:p-6 text-neutral-100">
      {/* Dynamic Keyframes for Sandbox Effects */}
      <style>{`
        @keyframes sandboxShake {
          0% { transform: translate(0, 0) rotate(0deg) scale(1); }
          15% { transform: translate(-10px, 8px) rotate(-2.5deg) scale(1.06); }
          30% { transform: translate(12px, -8px) rotate(2deg) scale(1.04); }
          45% { transform: translate(-8px, -6px) rotate(-1.5deg) scale(1.03); }
          60% { transform: translate(6px, 5px) rotate(1deg) scale(1.02); }
          75% { transform: translate(-4px, 2px) rotate(-0.5deg) scale(1.01); }
          100% { transform: translate(0, 0) rotate(0deg) scale(1); }
        }
        @keyframes sandboxGlitch {
          0% { transform: translate(0,0); filter: drop-shadow(0 0 0 transparent); }
          20% { transform: translate(-6px, 4px) skewX(4deg); filter: drop-shadow(4px 0 0 #f43f5e) drop-shadow(-4px 0 0 #06b6d4); }
          40% { transform: translate(6px, -4px) skewX(-4deg); filter: drop-shadow(-4px 0 0 #f43f5e) drop-shadow(4px 0 0 #a855f7); }
          60% { transform: translate(-3px, 2px); filter: drop-shadow(2px 0 0 #06b6d4); }
          100% { transform: translate(0,0); filter: drop-shadow(0 0 0 transparent); }
        }
        @keyframes sandboxSpinCw {
          0% { transform: rotate(0deg) scale(0.7); opacity: 0; }
          60% { transform: rotate(270deg) scale(1.15); opacity: 1; }
          100% { transform: rotate(360deg) scale(1); opacity: 1; }
        }
        @keyframes sandboxSpinCcw {
          0% { transform: rotate(0deg) scale(0.7); opacity: 0; }
          60% { transform: rotate(-270deg) scale(1.15); opacity: 1; }
          100% { transform: rotate(-360deg) scale(1); opacity: 1; }
        }
        @keyframes sandboxWarpZoom {
          0% { transform: scale(0.4) rotate(6deg); opacity: 0; }
          60% { transform: scale(1.3) rotate(-2deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes sandboxTvStatic {
          0% { filter: contrast(2) brightness(1.3) hue-rotate(90deg); opacity: 0.8; }
          50% { filter: contrast(2.5) brightness(0.7) hue-rotate(180deg); opacity: 1; }
          100% { filter: contrast(1.8) brightness(1.2) hue-rotate(0deg); opacity: 0.9; }
        }
        .animate-shake {
          animation: sandboxShake ${customDuration}s ease-in-out forwards;
        }
        .animate-glitch {
          animation: sandboxGlitch ${customDuration}s linear forwards;
        }
        .animate-spin-cw {
          animation: sandboxSpinCw ${customDuration}s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }
        .animate-spin-ccw {
          animation: sandboxSpinCcw ${customDuration}s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }
        .animate-warp-zoom {
          animation: sandboxWarpZoom ${customDuration}s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-tv-static {
          animation: sandboxTvStatic 0.15s steps(3) infinite;
        }
      `}</style>

      {/* Floating Notification Toast */}
      {notification && (
        <div className="fixed top-6 right-6 z-50 px-4 py-2.5 rounded-2xl bg-neutral-900 border border-emerald-500/50 text-white text-xs font-bold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{notification.text}</span>
        </div>
      )}

      {/* Expandable Side-Drawer */}
      <TransitionPresetDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSelectPreset={handleSelectPreset}
        onApplyPresetAtTime={handleApplyPresetAtTime}
        activePresetId={activePreset.id}
        currentTime={currentTime}
        language={language}
        onDragStartPreset={handlePresetCardDragStart}
      />

      {/* Top Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-neutral-950 border border-neutral-800/90 shadow-2xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl md:text-2xl font-black tracking-tight text-white">
                {isSk ? "Transition Studio" : "Transition Studio"}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10px] font-black">
                PRO EASING & DRAG-DROP
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              {isSk
                ? "Kinematické prechody (Glitch, Camera Shake, Spin...) s Drag & Drop na strihové body"
                : "Kinematic transitions (Glitch, Camera Shake, Spin...) with Drag & Drop onto cut markers"}
            </p>
          </div>
        </div>

        {/* Action Controls & Drawer Trigger */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Side Drawer Toggle Button */}
          <button
            onClick={() => {
              setIsDrawerOpen(!isDrawerOpen);
              playSynthesizedSFX("pop", 0.4);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold shadow-lg transition-all active:scale-95 cursor-pointer ${
              isDrawerOpen
                ? "bg-rose-600 text-white border-rose-500 ring-2 ring-rose-500/30"
                : "bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700 hover:border-neutral-600"
            }`}
          >
            <FolderOpen className="w-4 h-4 text-rose-400" />
            <span>{isSk ? "Knižnica Prechodov" : "Preset Library Drawer"}</span>
            <span className="px-1.5 py-0.5 rounded-md bg-neutral-900 text-rose-400 text-[10px] font-mono">
              {TRANSITION_PRESETS.length}
            </span>
            {isDrawerOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>

          <button
            onClick={handleAddAtCurrentTime}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs shadow-lg shadow-rose-500/25 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>
              {isSk
                ? `Pridať na @ ${currentTime.toFixed(2)}s`
                : `Add at @ ${currentTime.toFixed(2)}s`}
            </span>
          </button>

          <button
            onClick={handleApplyToAllCuts}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 active:scale-95 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-indigo-200" />
            <span>{isSk ? "Aplikovať na všetky strihy" : "Apply to All Cuts"}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISUAL TIMELINE TRACK WITH CUT MARKERS & DRAG-AND-DROP SNAP TARGETS */}
      {/* ========================================================================= */}
      <div className="p-5 rounded-3xl bg-neutral-900/90 border border-neutral-800 shadow-2xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400">
              <Film className="w-4 h-4" />
            </span>
            <h3 className="text-xs md:text-sm font-black uppercase tracking-wider text-white">
              {isSk ? "Časová Os Prechodov & Značky Strihov" : "Transition Timeline & Cut Markers"}
            </h3>
          </div>

          <div className="flex items-center gap-3 text-xs text-neutral-400 font-mono">
            <span className="flex items-center gap-1.5">
              <Scissors className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-neutral-300 font-bold">{effectiveCuts.length}</span> {isSk ? "strihov" : "cuts"}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-rose-400 font-bold">{transitions.length}</span> {isSk ? "prechodov" : "transitions"}
            </span>
          </div>
        </div>

        {/* Drag & Drop Visual Help Notice */}
        <div className="text-[11px] text-neutral-400 flex items-center justify-between bg-neutral-950/70 p-2.5 rounded-xl border border-neutral-800/80">
          <span className="flex items-center gap-2">
            <GripVertical className="w-3.5 h-3.5 text-indigo-400" />
            {isSk
              ? "Potiahnite ľubovoľný prechod zo zoznamu alebo knižnice a pustite ho na nožnice (strih) alebo na časovú os."
              : "Drag any preset from the catalog or drawer and drop it directly onto the cut scissors or timeline track."}
          </span>
          <span className="font-mono text-indigo-300 font-bold">
            Pos: {currentTime.toFixed(2)}s / {validDuration.toFixed(2)}s
          </span>
        </div>

        {/* Interactive Timeline Drop Canvas */}
        <div
          ref={timelineTrackRef}
          onDragOver={handleTimelineDragOver}
          onDragLeave={handleTimelineDragLeave}
          onDrop={(e) => handleTimelineDrop(e)}
          onClick={(e) => {
            if (timelineTrackRef.current) {
              const rect = timelineTrackRef.current.getBoundingClientRect();
              const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              onSeek(clickRatio * validDuration);
            }
          }}
          className={`relative w-full h-24 bg-neutral-950 rounded-2xl border transition-all cursor-pointer select-none overflow-hidden ${
            isTimelineDragOver
              ? "border-rose-500 shadow-2xl ring-4 ring-rose-500/20 bg-rose-950/10"
              : "border-neutral-800 hover:border-neutral-700"
          }`}
        >
          {/* Time ticks ruler background */}
          <div className="absolute inset-x-0 top-0 h-6 border-b border-neutral-800/80 bg-neutral-900/40 flex items-center justify-between px-3 text-[10px] font-mono text-neutral-500">
            <span>00:00</span>
            <span>{(validDuration * 0.25).toFixed(1)}s</span>
            <span>{(validDuration * 0.5).toFixed(1)}s</span>
            <span>{(validDuration * 0.75).toFixed(1)}s</span>
            <span>{validDuration.toFixed(1)}s</span>
          </div>

          {/* Cut Markers (Drop Targets) */}
          {effectiveCuts.map((cut) => {
            const cutPercent = Math.max(0, Math.min(100, (cut.time / validDuration) * 100));
            const isCutSnapped = snappedCutId === cut.id;
            const hasTransitionHere = transitions.some((t) => Math.abs(t.timestamp - cut.time) < 0.2);

            return (
              <div
                key={cut.id}
                style={{ left: `${cutPercent}%` }}
                onDragOver={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setSnappedCutId(cut.id);
                  setDragHoverTime(cut.time);
                }}
                onDrop={(e) => {
                  e.stopPropagation();
                  handleTimelineDrop(e, cut.time);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSeek(cut.time);
                }}
                className={`absolute top-0 bottom-0 -translate-x-1/2 z-20 flex flex-col items-center justify-between py-1 transition-all group ${
                  isCutSnapped ? "scale-110" : ""
                }`}
                title={`✂️ ${cut.label || "Cut"} @ ${cut.time.toFixed(2)}s`}
              >
                {/* Top Scissors Icon Pin */}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-md transition-all ${
                    isCutSnapped
                      ? "bg-amber-400 text-neutral-950 ring-4 ring-amber-400/50 scale-125"
                      : hasTransitionHere
                      ? "bg-emerald-500 text-white ring-2 ring-emerald-500/30"
                      : "bg-neutral-800 text-amber-400 border border-neutral-700 hover:border-amber-400"
                  }`}
                >
                  <Scissors className="w-3 h-3" />
                </div>

                {/* Vertical Cut Guideline */}
                <div
                  className={`w-0.5 flex-1 transition-colors ${
                    isCutSnapped
                      ? "bg-amber-400 w-1 shadow-lg shadow-amber-400/50"
                      : hasTransitionHere
                      ? "bg-emerald-500/60"
                      : "bg-neutral-800 group-hover:bg-amber-400/60"
                  }`}
                />

                {/* Timestamp Pill */}
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold whitespace-nowrap shadow ${
                    isCutSnapped
                      ? "bg-amber-400 text-neutral-950 font-black"
                      : "bg-neutral-900 text-neutral-400 border border-neutral-800"
                  }`}
                >
                  {cut.time.toFixed(1)}s
                </span>
              </div>
            );
          })}

          {/* Applied Transitions Blocks */}
          {transitions.map((t) => {
            const transPercent = Math.max(0, Math.min(100, (t.timestamp / validDuration) * 100));
            const widthPercent = Math.max(4, (t.duration / validDuration) * 100);
            const presetInfo = TRANSITION_PRESETS.find((p) => p.type === t.type);

            return (
              <div
                key={t.id}
                style={{
                  left: `${Math.max(0, transPercent - widthPercent / 2)}%`,
                  width: `${widthPercent}%`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSeek(t.timestamp);
                  if (presetInfo) handleSelectPreset(presetInfo);
                }}
                className="absolute top-7 bottom-5 z-10 rounded-xl bg-gradient-to-r from-rose-600/90 to-indigo-600/90 border border-rose-400/60 shadow-lg flex items-center justify-between px-1.5 text-white hover:brightness-110 transition-all cursor-pointer group"
                title={`${isSk ? t.labelSk || t.type : t.labelEn || t.type} @ ${t.timestamp.toFixed(2)}s (${t.duration}s)`}
              >
                <div className="flex items-center gap-1 truncate text-[10px] font-bold">
                  <span>{presetInfo?.icon || "🎬"}</span>
                  <span className="hidden sm:inline truncate">{isSk ? t.labelSk : t.labelEn}</span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTransition(t.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded bg-black/50 hover:bg-rose-700 transition-all shrink-0"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            );
          })}

          {/* Live Drag Hover Ghost Preview Marker */}
          {isTimelineDragOver && dragHoverTime !== null && (
            <div
              style={{ left: `${(dragHoverTime / validDuration) * 100}%` }}
              className="absolute top-0 bottom-0 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center justify-center animate-pulse"
            >
              <div className="w-0.5 h-full bg-rose-400 shadow-lg shadow-rose-400/80" />
              <div className="absolute top-2 px-2 py-0.5 rounded-full bg-rose-500 text-white font-mono font-bold text-[10px] shadow-xl whitespace-nowrap">
                {snappedCutId ? "✂️ Snap to Cut " : "Drop @ "}
                {dragHoverTime.toFixed(2)}s
              </div>
            </div>
          )}

          {/* Current Playhead Scrubber Marker */}
          <div
            style={{ left: `${Math.max(0, Math.min(100, (currentTime / validDuration) * 100))}%` }}
            className="absolute top-0 bottom-0 -translate-x-1/2 z-40 pointer-events-none flex flex-col items-center justify-between"
          >
            <div className="w-3 h-3 bg-rose-500 rotate-45 -mt-1 shadow-md shadow-rose-500/50" />
            <div className="w-0.5 h-full bg-rose-500 shadow-lg shadow-rose-500/50" />
            <div className="w-2 h-2 bg-rose-500 rounded-full -mb-1 shadow-md" />
          </div>
        </div>
      </div>

      {/* Main Studio Grid: Left = Presets Catalog, Right = Live Sandbox & Customizer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Preset Catalog & Filter (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Search bar & Category Filter Pills */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    isSk
                      ? "Hľadať prechod (Glitch, Camera Shake, Spin...)..."
                      : "Search presets (Glitch, Camera Shake, Spin...)..."
                  }
                  className="w-full pl-9 pr-8 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                  >
                    ×
                  </button>
                )}
              </div>

              <button
                onClick={() => setIsDrawerOpen(true)}
                className="px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-rose-500/50 text-neutral-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title={isSk ? "Otvoriť knižnicu v bočnom paneli" : "Open library side-drawer"}
              >
                <PanelRightOpen className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">{isSk ? "Knižnica" : "Drawer"}</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
              {[
                { id: "ALL", labelSk: "🌟 Všetky", labelEn: "🌟 All" },
                { id: "CREATIVE_GLITCH", labelSk: "👾 Glitch & Spin", labelEn: "👾 Glitch & Spin" },
                { id: "DYNAMIC_ZOOM", labelSk: "🚀 Dynamic Zoom", labelEn: "🚀 Zoom Punch" },
                { id: "KINETIC_SLIDE", labelSk: "⚡ Kinetic Slide", labelEn: "⚡ Kinetic Slide" },
                { id: "FILMIC_ORGANIC", labelSk: "✨ Filmic & Glow", labelEn: "✨ Filmic & Glow" },
                { id: "CLASSIC", labelSk: "🎬 Classic Blend", labelEn: "🎬 Classic Blend" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                    selectedCategory === cat.id
                      ? "bg-rose-500/20 border-rose-500 text-white shadow-sm ring-1 ring-rose-500/40"
                      : "bg-neutral-900/80 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  {isSk ? cat.labelSk : cat.labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* Preset Cards Grid (With Drag & Drop Support) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[560px] overflow-y-auto pr-1 custom-scrollbar">
            {filteredPresets.map((preset) => {
              const isSelected = activePreset.id === preset.id;
              return (
                <div
                  key={preset.id}
                  draggable
                  onDragStart={(e) => handlePresetCardDragStart(preset, e)}
                  onClick={() => handleSelectPreset(preset)}
                  className={`p-4 rounded-2xl border text-left cursor-grab active:cursor-grabbing transition-all flex flex-col justify-between gap-3 group select-none ${
                    isSelected
                      ? "bg-gradient-to-b from-neutral-900 to-neutral-900/90 border-rose-500 shadow-xl ring-2 ring-rose-500/30"
                      : "bg-neutral-900/60 border-neutral-800/80 hover:border-neutral-700 hover:bg-neutral-900/90"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl p-2 rounded-xl bg-neutral-950 border border-neutral-800 shadow-inner group-hover:scale-105 transition-transform">
                        {preset.icon}
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-rose-400 transition-colors">
                          {isSk ? preset.nameSk : preset.nameEn}
                        </h4>
                        <span className="text-[10px] text-rose-400 font-mono font-semibold">
                          {preset.type.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <span
                        className="p-1 rounded-md bg-neutral-950 text-neutral-400 text-[9px] font-bold uppercase tracking-wider opacity-60 group-hover:opacity-100 transition-opacity flex items-center gap-0.5"
                        title={isSk ? "Potiahnite na timeline" : "Drag onto timeline"}
                      >
                        <GripVertical className="w-3 h-3" />
                      </span>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center text-white text-xs">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-neutral-400 line-clamp-2">
                    {isSk ? preset.descriptionSk : preset.descriptionEn}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-neutral-800/70 text-[10px] text-neutral-400 font-mono">
                    <span>⏱️ {preset.defaultDuration}s</span>
                    <span className="text-indigo-400 font-sans">
                      🔊 {preset.recommendedSfx !== "none" ? preset.recommendedSfx : "Tiché"}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApplyPresetAtTime(preset, currentTime);
                      }}
                      className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-rose-600 text-neutral-300 hover:text-white font-sans font-bold text-[9px] uppercase tracking-wider transition-colors"
                      title={isSk ? "Rýchlo vložiť na aktuálny čas" : "Quick insert at current time"}
                    >
                      + @{currentTime.toFixed(1)}s
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Custom Easing Curve, Duration & Live Sandbox (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Live Preview Sandbox */}
          <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-bold text-neutral-300">
              <span className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-rose-400" />
                {isSk ? "Živý Náhľad Prechodu" : "Live Transition Sandbox"}
              </span>
              <button
                onClick={triggerPreviewAnimation}
                className="px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-bold text-[10px] flex items-center gap-1 shadow-md cursor-pointer transition-all active:scale-95"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>{isSk ? "Prehrať Prechod" : "Play Transition"}</span>
              </button>
            </div>

            {/* Sandbox Viewport */}
            <div className="relative w-full h-44 bg-neutral-950 rounded-xl overflow-hidden border border-neutral-800 flex items-center justify-center">
              {/* Scene A Background */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-neutral-900 to-purple-900 flex flex-col items-center justify-center p-4 text-center">
                <span className="text-xs font-black uppercase text-indigo-300 tracking-wider">
                  {previewClipA}
                </span>
                <span className="text-[10px] text-neutral-400 mt-1">Clip 1 • Before Transition</span>
              </div>

              {/* Scene B Transition Overlay layer */}
              <div
                className={`absolute inset-0 bg-gradient-to-br from-rose-900 via-neutral-950 to-amber-900 flex flex-col items-center justify-center p-4 text-center transition-all ${getSandboxAnimationClass()}`}
                style={{
                  transitionDuration: `${customDuration}s`,
                  transitionTimingFunction: getEasingCss(customEasing, bezierCurve),
                }}
              >
                <span className="text-xs font-black uppercase text-rose-300 tracking-wider">
                  {previewClipB}
                </span>
                <span className="text-[10px] text-neutral-400 mt-1">
                  Clip 2 • [{isSk ? activePreset.nameSk : activePreset.nameEn}]
                </span>
              </div>

              {/* White Flash Effect Layer */}
              {activePreset.type === "flash_white" && isPreviewAnimating && (
                <div
                  className="absolute inset-0 bg-white pointer-events-none animate-in fade-in"
                  style={{
                    animationDuration: `${customDuration * 0.4}s`,
                    animationTimingFunction: "ease-out",
                  }}
                />
              )}

              {/* Light Leak Glow Bloom Layer */}
              {activePreset.type === "light_leak" && isPreviewAnimating && (
                <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/60 via-rose-500/40 to-transparent pointer-events-none animate-pulse" />
              )}
            </div>
          </div>

          {/* Duration & Easing Curve Customizer */}
          <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 shadow-xl flex flex-col gap-4 text-xs">
            {/* Duration Slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-neutral-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-rose-400" />
                  {isSk ? "Dĺžka trvania prechodu:" : "Transition Duration:"}
                </span>
                <span className="font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                  {customDuration.toFixed(2)}s
                </span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1.5}
                step={0.05}
                value={customDuration}
                onChange={(e) => {
                  setCustomDuration(parseFloat(e.target.value));
                  triggerPreviewAnimation();
                }}
                className="w-full accent-rose-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-neutral-500 font-mono mt-0.5">
                <span>0.10s (Bleskový)</span>
                <span>0.50s (Štandard)</span>
                <span>1.50s (Dlhý)</span>
              </div>
            </div>

            {/* Easing Options */}
            <div>
              <span className="font-bold text-neutral-300 flex items-center gap-1.5 mb-2">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                {isSk ? "Krivka zrýchlenia (Easing Curve):" : "Easing Curve:"}
              </span>

              <div className="grid grid-cols-2 gap-1.5">
                {EASING_OPTIONS.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => handleSelectEasing(e.id)}
                    className={`p-2 rounded-xl text-left border transition-all ${
                      customEasing === e.id
                        ? "bg-indigo-600/20 border-indigo-500 text-white font-bold"
                        : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    <p className="text-[11px] truncate">{isSk ? e.nameSk : e.nameEn}</p>
                    <p className="text-[9px] text-neutral-500 font-mono truncate">{e.css}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Bezier Visualizer */}
            <div>
              <div className="flex items-center justify-between mb-1.5 text-[10px] text-neutral-400">
                <span>Cubic Bezier Graph Visualizer</span>
                <span className="font-mono text-rose-400">
                  [{bezierCurve.map((n) => n.toFixed(2)).join(", ")}]
                </span>
              </div>
              {renderBezierSvg()}
            </div>

            {/* Synchronized SFX */}
            <div>
              <span className="font-bold text-neutral-300 flex items-center gap-1.5 mb-1.5">
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                {isSk ? "Zvukový efekt pri prechode (SFX):" : "Transition SFX Sync:"}
              </span>

              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "whoosh", label: "💨 Whoosh" },
                  { id: "swish", label: "🌪️ Swish" },
                  { id: "whip_snap", label: "⚡ Whip Snap" },
                  { id: "glitch_sfx", label: "👾 Glitch" },
                  { id: "film_click", label: "🎞️ 35mm Click" },
                  { id: "none", label: "🔇 Žiadny" },
                ].map((sfx) => (
                  <button
                    key={sfx.id}
                    onClick={() => {
                      setCustomSfx(sfx.id as any);
                      if (sfx.id !== "none") {
                        playSynthesizedSFX(
                          sfx.id === "whip_snap"
                            ? "whoosh"
                            : sfx.id === "glitch_sfx"
                            ? "pop"
                            : sfx.id === "film_click"
                            ? "click"
                            : (sfx.id as any),
                          0.7
                        );
                      }
                    }}
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-all ${
                      customSfx === sfx.id
                        ? "bg-amber-500/20 border-amber-500 text-amber-300"
                        : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white"
                    }`}
                  >
                    {sfx.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Applied Transitions List on Video Timeline */}
      <div className="p-5 rounded-3xl bg-neutral-900/80 border border-neutral-800 shadow-2xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Film className="w-4 h-4 text-rose-400" />
              {isSk ? "Aplikované prechody na časovej osi" : "Applied Video Transitions"}
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-mono text-xs font-bold">
              {transitions.length}
            </span>
          </div>

          {transitions.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isSk ? "Vymazať všetky" : "Clear All"}</span>
            </button>
          )}
        </div>

        {transitions.length === 0 ? (
          <div className="py-8 text-center text-neutral-500 border border-dashed border-neutral-800 rounded-2xl flex flex-col items-center justify-center gap-2">
            <Layers className="w-8 h-8 text-neutral-600" />
            <p className="text-xs">
              {isSk
                ? "Zatiaľ neboli pridané žiadne prechody. Potiahnite prechod na časovú os vyššie alebo kliknite 'Aplikovať na všetky strihy'."
                : "No transitions applied yet. Drag a transition onto the timeline above or click 'Apply to All Cuts'."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {transitions.map((t) => (
              <div
                key={t.id}
                className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-between gap-2 shadow-md hover:border-neutral-700 transition-all"
              >
                <div
                  className="flex items-center gap-2.5 cursor-pointer min-w-0 flex-1"
                  onClick={() => onSeek(t.timestamp)}
                  title={isSk ? `Prejsť na čas @ ${t.timestamp}s` : `Seek to @ ${t.timestamp}s`}
                >
                  <span className="text-xl shrink-0">
                    {TRANSITION_PRESETS.find((p) => p.type === t.type)?.icon || "🎬"}
                  </span>
                  <div className="min-w-0">
                    <h5 className="text-xs font-bold text-white truncate">
                      {isSk ? t.labelSk || t.type : t.labelEn || t.type}
                    </h5>
                    <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 font-mono">
                      <span className="text-rose-400 font-bold">@{t.timestamp}s</span>
                      <span>•</span>
                      <span>{t.duration}s</span>
                      <span>•</span>
                      <span className="text-indigo-400 truncate">{t.easing}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteTransition(t.id)}
                  className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-neutral-900 transition-colors cursor-pointer shrink-0"
                  title="Remove"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

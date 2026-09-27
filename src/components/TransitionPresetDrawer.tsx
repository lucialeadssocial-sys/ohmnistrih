import React, { useState, useMemo } from "react";
import {
  Search,
  X,
  Sparkles,
  Zap,
  Sliders,
  Play,
  Volume2,
  Clock,
  Layers,
  ChevronRight,
  GripVertical,
  Check,
  Film,
  Plus,
  ArrowRight,
  Eye,
  Info
} from "lucide-react";
import { TransitionPreset, TransitionEasing } from "../types";
import { TRANSITION_PRESETS, EASING_OPTIONS, getEasingCss } from "../utils/transitionPresets";
import { playSynthesizedSFX } from "../utils/audioSynth";

interface TransitionPresetDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset: (preset: TransitionPreset) => void;
  onApplyPresetAtTime: (preset: TransitionPreset, time: number) => void;
  activePresetId?: string;
  currentTime: number;
  language?: "sk" | "en";
  onDragStartPreset?: (preset: TransitionPreset, e: React.DragEvent) => void;
}

export const TransitionPresetDrawer: React.FC<TransitionPresetDrawerProps> = ({
  isOpen,
  onClose,
  onSelectPreset,
  onApplyPresetAtTime,
  activePresetId,
  currentTime,
  language = "sk",
  onDragStartPreset
}) => {
  const isSk = language === "sk";

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    "ALL" | "GLITCH_CYBER" | "SHAKE_IMPACT" | "SPIN_WARP" | "DYNAMIC_ZOOM" | "KINETIC_SLIDE" | "FILMIC_ORGANIC" | "CLASSIC"
  >("ALL");

  // Hover preview state
  const [hoveredPresetId, setHoveredPresetId] = useState<string | null>(null);

  // Category tags mapping
  const categoryFilters = [
    { id: "ALL", labelSk: "Všetky", labelEn: "All", icon: "🌟" },
    { id: "GLITCH_CYBER", labelSk: "Glitch & Cyber", labelEn: "Glitch & Cyber", icon: "👾" },
    { id: "SHAKE_IMPACT", labelSk: "Shake & Impact", labelEn: "Shake & Impact", icon: "📳" },
    { id: "SPIN_WARP", labelSk: "Spin & Warp", labelEn: "Spin & Warp", icon: "🌀" },
    { id: "DYNAMIC_ZOOM", labelSk: "Zoom & Punch", labelEn: "Zoom & Punch", icon: "🚀" },
    { id: "KINETIC_SLIDE", labelSk: "Kinetic Slide", labelEn: "Kinetic Slide", icon: "⚡" },
    { id: "FILMIC_ORGANIC", labelSk: "Filmic & Glow", labelEn: "Filmic & Glow", icon: "✨" },
    { id: "CLASSIC", labelSk: "Classic Blend", labelEn: "Classic Blend", icon: "🎬" },
  ];

  // Filtered Presets
  const filteredPresets = useMemo(() => {
    return TRANSITION_PRESETS.filter((preset) => {
      // Category match
      if (selectedCategory !== "ALL") {
        if (selectedCategory === "GLITCH_CYBER") {
          if (preset.type !== "glitch" && preset.type !== "tv_static") return false;
        } else if (selectedCategory === "SHAKE_IMPACT") {
          if (preset.type !== "camera_shake" && preset.type !== "flash_white" && preset.type !== "flash_black") return false;
        } else if (selectedCategory === "SPIN_WARP") {
          if (preset.type !== "spin_cw" && preset.type !== "spin_ccw" && preset.type !== "warp_zoom") return false;
        } else if (selectedCategory === "DYNAMIC_ZOOM") {
          if (preset.category !== "DYNAMIC_ZOOM" && preset.type !== "zoom_through" && preset.type !== "zoom_in" && preset.type !== "zoom_out" && preset.type !== "warp_zoom") return false;
        } else if (selectedCategory === "KINETIC_SLIDE") {
          if (preset.category !== "KINETIC_SLIDE" && preset.type !== "whip_pan" && !preset.type.startsWith("slide_")) return false;
        } else if (selectedCategory === "FILMIC_ORGANIC") {
          if (preset.category !== "FILMIC_ORGANIC" && preset.type !== "light_leak" && preset.type !== "film_burn" && preset.type !== "prism_blur") return false;
        } else if (selectedCategory === "CLASSIC") {
          if (preset.category !== "CLASSIC" && preset.type !== "dissolve" && preset.type !== "crossfade" && preset.type !== "split_horizontal") return false;
        }
      }

      // Search query match
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const matchName = preset.nameSk.toLowerCase().includes(q) || preset.nameEn.toLowerCase().includes(q);
        const matchDesc = preset.descriptionSk.toLowerCase().includes(q) || preset.descriptionEn.toLowerCase().includes(q);
        const matchType = preset.type.toLowerCase().includes(q);
        const matchCat = preset.category.toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchType && !matchCat) return false;
      }

      return true;
    });
  }, [searchQuery, selectedCategory]);

  const handleDragStart = (preset: TransitionPreset, e: React.DragEvent) => {
    e.dataTransfer.setData("application/json", JSON.stringify(preset));
    e.dataTransfer.setData("text/plain", preset.id);
    e.dataTransfer.effectAllowed = "copyMove";
    playSynthesizedSFX("whoosh", 0.4);
    if (onDragStartPreset) {
      onDragStartPreset(preset, e);
    }
  };

  // Preview animation class generator based on transition type
  const getPreviewAnimationStyles = (type: string, isHovered: boolean, duration: number) => {
    if (!isHovered) return {};

    switch (type) {
      case "glitch":
        return {
          animation: `previewGlitch ${Math.max(0.2, duration)}s infinite linear`,
        };
      case "camera_shake":
        return {
          animation: `previewCameraShake ${Math.max(0.25, duration)}s infinite ease-in-out`,
        };
      case "spin_cw":
        return {
          animation: `previewSpinCw ${Math.max(0.3, duration)}s infinite cubic-bezier(0.25, 1, 0.5, 1)`,
        };
      case "spin_ccw":
        return {
          animation: `previewSpinCcw ${Math.max(0.3, duration)}s infinite cubic-bezier(0.25, 1, 0.5, 1)`,
        };
      case "warp_zoom":
        return {
          animation: `previewWarpZoom ${Math.max(0.3, duration)}s infinite cubic-bezier(0.16, 1, 0.3, 1)`,
        };
      case "zoom_through":
        return {
          animation: `previewZoomThrough ${Math.max(0.28, duration)}s infinite ease-out`,
        };
      case "whip_pan":
        return {
          animation: `previewWhipPan ${Math.max(0.22, duration)}s infinite ease-in-out`,
        };
      case "tv_static":
        return {
          animation: `previewTvStatic 0.15s infinite steps(2)`,
        };
      case "light_leak":
        return {
          animation: `previewLightLeak ${Math.max(0.35, duration)}s infinite ease-in-out`,
        };
      case "film_burn":
        return {
          animation: `previewFilmBurn ${Math.max(0.3, duration)}s infinite linear`,
        };
      case "flash_white":
        return {
          animation: `previewFlashWhite ${Math.max(0.2, duration)}s infinite ease-out`,
        };
      default:
        return {
          animation: `previewCrossfade ${Math.max(0.4, duration)}s infinite alternate ease-in-out`,
        };
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-neutral-950/95 backdrop-blur-xl border-l border-neutral-800 shadow-2xl flex flex-col transition-all duration-300 animate-in slide-in-from-right">
      {/* Inline Keyframes for Live Card Preview Animations */}
      <style>{`
        @keyframes previewGlitch {
          0% { transform: translate(0,0) scale(1); filter: drop-shadow(0 0 0 transparent); }
          20% { transform: translate(-3px, 2px) skewX(2deg); filter: drop-shadow(2px 0 0 #f43f5e) drop-shadow(-2px 0 0 #06b6d4); }
          40% { transform: translate(2px, -2px) skewX(-2deg); filter: drop-shadow(-2px 0 0 #f43f5e) drop-shadow(2px 0 0 #a855f7); }
          60% { transform: translate(-1px, 1px); filter: drop-shadow(1px 0 0 #06b6d4); }
          100% { transform: translate(0,0) scale(1); filter: drop-shadow(0 0 0 transparent); }
        }
        @keyframes previewCameraShake {
          0% { transform: translate(0, 0) rotate(0deg); }
          20% { transform: translate(-4px, 3px) rotate(-1.5deg) scale(1.04); }
          40% { transform: translate(4px, -3px) rotate(1.2deg) scale(1.02); }
          60% { transform: translate(-3px, -2px) rotate(-0.8deg); }
          80% { transform: translate(2px, 2px) rotate(0.5deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }
        @keyframes previewSpinCw {
          0% { transform: rotate(0deg) scale(0.9); opacity: 0.7; }
          50% { transform: rotate(180deg) scale(1.1); opacity: 1; }
          100% { transform: rotate(360deg) scale(0.9); opacity: 0.7; }
        }
        @keyframes previewSpinCcw {
          0% { transform: rotate(0deg) scale(0.9); opacity: 0.7; }
          50% { transform: rotate(-180deg) scale(1.1); opacity: 1; }
          100% { transform: rotate(-360deg) scale(0.9); opacity: 0.7; }
        }
        @keyframes previewWarpZoom {
          0% { transform: scale(0.7) rotate(0deg); opacity: 0.5; }
          50% { transform: scale(1.3) rotate(3deg); opacity: 1; }
          100% { transform: scale(0.7) rotate(0deg); opacity: 0.5; }
        }
        @keyframes previewZoomThrough {
          0% { transform: scale(0.85); }
          50% { transform: scale(1.25); }
          100% { transform: scale(0.85); }
        }
        @keyframes previewWhipPan {
          0% { transform: translateX(-30%) skewX(-15deg); opacity: 0.5; }
          50% { transform: translateX(0) skewX(0); opacity: 1; }
          100% { transform: translateX(30%) skewX(15deg); opacity: 0.5; }
        }
        @keyframes previewTvStatic {
          0% { filter: brightness(1.2) contrast(1.4) hue-rotate(45deg); opacity: 0.8; }
          50% { filter: brightness(0.8) contrast(1.8) hue-rotate(180deg); opacity: 1; }
          100% { filter: brightness(1.1) contrast(1.2) hue-rotate(90deg); opacity: 0.9; }
        }
        @keyframes previewLightLeak {
          0% { opacity: 0.3; filter: saturate(1); }
          50% { opacity: 1; filter: saturate(2) brightness(1.4); }
          100% { opacity: 0.3; filter: saturate(1); }
        }
        @keyframes previewFilmBurn {
          0% { filter: sepia(0.3) brightness(1); }
          50% { filter: sepia(0.8) brightness(1.5) contrast(1.3); }
          100% { filter: sepia(0.3) brightness(1); }
        }
        @keyframes previewFlashWhite {
          0% { opacity: 0.2; }
          30% { opacity: 1; filter: brightness(2); }
          100% { opacity: 0.2; }
        }
        @keyframes previewCrossfade {
          0% { opacity: 0.3; }
          100% { opacity: 1; }
        }
      `}</style>

      {/* Drawer Header */}
      <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black tracking-tight text-white uppercase flex items-center gap-2">
              {isSk ? "Knižnica Prechodov" : "Transition Preset Library"}
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-black">
                {filteredPresets.length}
              </span>
            </h3>
            <p className="text-[11px] text-neutral-400">
              {isSk ? "Potiahnite (Drag & Drop) na značky timeline" : "Drag & drop onto timeline markers"}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          title={isSk ? "Zavrieť knižnicu" : "Close drawer"}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Drag & Drop Quick Tip Box */}
      <div className="mx-4 mt-3 p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-[11px] text-neutral-300 leading-snug">
          <span className="font-bold text-indigo-300 block mb-0.5">
            {isSk ? "💡 Drag & Drop na Časovú Os" : "💡 Drag & Drop to Timeline"}
          </span>
          {isSk
            ? "Uchopte ktorúkoľvek kartu a potiahnite ju priamo na značku strihu (nožnice) alebo kdekoľvek na časovú os."
            : "Grab any card handle and drop it directly onto a cut marker (scissors) or anywhere on the timeline track."}
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="p-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isSk
                ? "Hľadať prechod (Glitch, Camera Shake, Spin, Warp...)..."
                : "Search presets (Glitch, Camera Shake, Spin, Warp...)..."
            }
            className="w-full pl-10 pr-9 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Category Pills Filter */}
      <div className="px-4 pb-3 flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
        {categoryFilters.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              setSelectedCategory(cat.id as any);
              playSynthesizedSFX("pop", 0.2);
            }}
            className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all border flex items-center gap-1 ${
              selectedCategory === cat.id
                ? "bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/20"
                : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <span>{cat.icon}</span>
            <span>{isSk ? cat.labelSk : cat.labelEn}</span>
          </button>
        ))}
      </div>

      {/* Preset Cards List with Drag & Drop */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3 custom-scrollbar">
        {filteredPresets.length === 0 ? (
          <div className="py-12 text-center text-neutral-500 space-y-2">
            <Search className="w-8 h-8 mx-auto text-neutral-600" />
            <p className="text-xs font-semibold">
              {isSk ? "Žiadne prechody nezodpovedajú vyhľadávaniu." : "No transitions match your query."}
            </p>
          </div>
        ) : (
          filteredPresets.map((preset) => {
            const isSelected = activePresetId === preset.id;
            const isHovered = hoveredPresetId === preset.id;

            return (
              <div
                key={preset.id}
                draggable
                onDragStart={(e) => handleDragStart(preset, e)}
                onMouseEnter={() => setHoveredPresetId(preset.id)}
                onMouseLeave={() => setHoveredPresetId(null)}
                onClick={() => {
                  onSelectPreset(preset);
                  playSynthesizedSFX("pop", 0.4);
                }}
                className={`group relative p-3.5 rounded-2xl border transition-all cursor-grab active:cursor-grabbing select-none flex flex-col gap-2.5 ${
                  isSelected
                    ? "bg-neutral-900 border-rose-500 shadow-lg ring-1 ring-rose-500/40"
                    : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/90"
                }`}
              >
                {/* Top Row: Icon + Title + Drag Grip */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {/* Animated Mini Preview Icon Box */}
                    <div
                      className="relative w-11 h-11 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-center text-xl overflow-hidden shrink-0 shadow-inner group-hover:border-rose-500/50 transition-colors"
                    >
                      <span
                        style={getPreviewAnimationStyles(preset.type, isHovered, preset.defaultDuration)}
                        className="inline-block"
                      >
                        {preset.icon}
                      </span>

                      {/* Visual Pulse Wave on Hover */}
                      {isHovered && (
                        <div className="absolute inset-0 bg-rose-500/10 pointer-events-none" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-black text-white group-hover:text-rose-400 transition-colors">
                          {isSk ? preset.nameSk : preset.nameEn}
                        </h4>
                        {isSelected && (
                          <span className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px]">
                            <Check className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono font-bold text-rose-400 uppercase">
                        {preset.type}
                      </span>
                    </div>
                  </div>

                  {/* Drag Handle Indicator */}
                  <div
                    className="p-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-400 group-hover:text-rose-400 group-hover:border-rose-500/40 transition-colors flex items-center gap-1 text-[10px] font-bold"
                    title={isSk ? "Potiahnite na timeline" : "Drag onto timeline"}
                  >
                    <GripVertical className="w-3.5 h-3.5" />
                    <span className="text-[9px] uppercase tracking-wider hidden sm:inline">DRAG</span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-[11px] text-neutral-400 line-clamp-2">
                  {isSk ? preset.descriptionSk : preset.descriptionEn}
                </p>

                {/* Meta info & Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-neutral-800/80 text-[10px] font-mono text-neutral-400">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-neutral-300">
                      <Clock className="w-3 h-3 text-rose-400" />
                      {preset.defaultDuration}s
                    </span>
                    <span>•</span>
                    <span className="text-indigo-400 truncate max-w-[90px]">
                      {preset.defaultEasing}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onApplyPresetAtTime(preset, currentTime);
                        playSynthesizedSFX("cash", 0.6);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-rose-600 text-neutral-300 hover:text-white font-sans font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-1"
                      title={isSk ? `Aplikovať na čas @ ${currentTime.toFixed(2)}s` : `Apply at @ ${currentTime.toFixed(2)}s`}
                    >
                      <Plus className="w-3 h-3" />
                      <span>@{currentTime.toFixed(1)}s</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Drawer Footer info */}
      <div className="p-3.5 border-t border-neutral-800 bg-neutral-900/70 text-center text-[11px] text-neutral-400">
        <span className="text-neutral-300 font-bold">OmniStrih Pro Preset Engine</span> • 100% Non-Destructive Easing
      </div>
    </div>
  );
};

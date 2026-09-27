import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";
import { useAdaptiveDeviceExperience } from "../contexts/AdaptiveDeviceExperienceContext";
import { usePlayheadTime, playheadStore } from "../core/playback/playheadStore";
import {
  useCoreProject,
  coreEngine,
  ClipModel,
  TrackModel,
  TimelineEngine,
  Keyframe,
  createCanonicalClip
} from "../core";
import {
  Scissors,
  Move,
  Magnet,
  Trash2,
  Copy,
  Plus,
  Undo2,
  Redo2,
  Volume2,
  VolumeX,
  Lock,
  Unlock,
  Type,
  Film,
  Music,
  Layers,
  Sparkles,
  Play,
  Pause,
  Sliders,
  Eye,
  EyeOff,
  Activity,
  Check,
  ChevronDown,
  HelpCircle,
  PenTool,
  Bookmark,
  TrendingUp,
  SlidersHorizontal,
  FolderPlus,
  RotateCcw,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { playSynthesizedSFX } from "../utils/audioSynth";

interface ProTimelineProps {
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  onTogglePlay: () => void;
  language: "sk" | "en";
}

/**
 * Isolated Playhead component subscribed to 60fps PlayheadStore.
 * Moving the needle does NOT re-render track clips.
 */
const ProTimelinePlayhead: React.FC<{ pxPerSec: number; fallbackTime: number }> = memo(({ pxPerSec, fallbackTime }) => {
  const storeTime = usePlayheadTime();
  const time = storeTime > 0 ? storeTime : fallbackTime;
  return (
    <div 
      className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-40 pointer-events-none transition-none shadow-[0_0_8px_rgba(239,68,68,0.8)]"
      style={{ left: `${200 + time * pxPerSec}px` }}
    >
      <div className="h-3 w-3 rounded-full bg-rose-500 absolute top-0 -translate-x-[5px] ring-2 ring-white" />
    </div>
  );
});

/**
 * Memoized single Clip block to prevent whole-track re-rendering on playhead movements.
 */
interface ProTimelineClipProps {
  clip: ClipModel;
  trackId: string;
  pxPerSec: number;
  isSelected: boolean;
  activeTool: "select" | "blade";
  isLocked: boolean;
  onSelect: (clipId: string, e: React.MouseEvent) => void;
  onBladeCut: (clipId: string, clickTime: number) => void;
  onStartDrag: (e: React.MouseEvent | React.TouchEvent, clipId: string, type: "move" | "trim-left" | "trim-right") => void;
}

const ProTimelineClip: React.FC<ProTimelineClipProps> = memo(({
  clip,
  trackId,
  pxPerSec,
  isSelected,
  activeTool,
  isLocked,
  onSelect,
  onBladeCut,
  onStartDrag
}) => {
  const timelineStart = clip.timelineStart ?? clip.start ?? 0;
  const sourceStart = clip.sourceStart ?? clip.offset ?? 0;
  const sourceEnd = clip.sourceEnd ?? (sourceStart + clip.duration * (clip.speed ?? 1.0));
  const left = timelineStart * pxPerSec;
  const width = Math.max(12, clip.duration * pxPerSec);

  // Determine clip visual badge/color
  let colorClasses = "bg-neutral-800/80 border-neutral-600 text-neutral-200";
  if (clip.type === "video") {
    colorClasses = "bg-rose-500/20 border-rose-500/70 text-rose-200";
  } else if (clip.type === "b-roll") {
    colorClasses = "bg-emerald-500/20 border-emerald-400 text-emerald-200";
  } else if (clip.type === "caption") {
    colorClasses = "bg-indigo-500/20 border-indigo-400 text-indigo-200";
  } else if (clip.type === "audio") {
    colorClasses = "bg-amber-500/20 border-amber-400 text-amber-200";
  } else if (clip.type === "adjustment") {
    colorClasses = "bg-violet-500/20 border-violet-400 text-violet-200";
  }

  const handleClick = (e: React.MouseEvent) => {
    if (activeTool === "blade") {
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickTime = timelineStart + (clickX / pxPerSec);
      onBladeCut(clip.id, clickTime);
    } else {
      onSelect(clip.id, e);
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{ left, width }}
      title={`Timeline: ${timelineStart.toFixed(2)}s – ${(timelineStart + clip.duration).toFixed(2)}s\nSource: ${sourceStart.toFixed(2)}s – ${sourceEnd.toFixed(2)}s`}
      className={`absolute top-1 bottom-1 rounded-lg border-2 flex items-center justify-between px-2.5 cursor-pointer group transition-shadow ${colorClasses} ${
        isSelected 
          ? "ring-2 ring-violet-400 border-white shadow-lg shadow-violet-500/30 z-10" 
          : "hover:border-neutral-300"
      } ${isLocked ? "opacity-60 cursor-not-allowed" : ""}`}
    >
      {/* Left Trim Handle */}
      {!isLocked && (
        <div
          onMouseDown={(e) => onStartDrag(e, clip.id, "trim-left")}
          onTouchStart={(e) => onStartDrag(e, clip.id, "trim-left")}
          title="Trim In-Point (Left)"
          className="absolute left-0 top-0 bottom-0 w-2.5 bg-white/20 hover:bg-white/80 active:bg-white cursor-ew-resize rounded-l-md transition-colors z-20"
        />
      )}

      {/* Center Clip Title & Timing Info */}
      <div 
        onMouseDown={(e) => {
          if (activeTool === "select" && !isLocked) {
            onStartDrag(e, clip.id, "move");
          }
        }}
        onTouchStart={(e) => {
          if (activeTool === "select" && !isLocked) {
            onStartDrag(e, clip.id, "move");
          }
        }}
        className="flex-1 h-full flex flex-col justify-center select-none overflow-hidden pr-2"
      >
        <span className="text-[10px] font-bold uppercase tracking-tight truncate">
          {clip.name}
        </span>
        <span className="text-[8px] font-mono opacity-70">
          {timelineStart.toFixed(1)}s – {(timelineStart + clip.duration).toFixed(1)}s ({clip.duration.toFixed(1)}s)
        </span>
      </div>

      {/* Keyframe & Feature Badges */}
      <div className="flex items-center gap-1 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
        {clip.speed && clip.speed !== 1.0 && (
          <span className="text-[8px] font-mono font-bold bg-neutral-900/80 px-1 rounded text-amber-300" title={`Speed: ${clip.speed}x`}>
            {clip.speed}x
          </span>
        )}
        {clip.maskConfig && clip.maskConfig.type !== "NONE" && (
          <span title={`Mask: ${clip.maskConfig.type}`}>
            <PenTool className="h-3 w-3 text-emerald-400" />
          </span>
        )}
        {clip.filter && clip.filter !== "NONE" && (
          <span title={`Filter: ${clip.filter}`}>
            <Sparkles className="h-3 w-3 text-violet-400" />
          </span>
        )}
        {clip.keyframes && clip.keyframes.length > 0 && (
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shadow shadow-violet-500 animate-ping" title={`${clip.keyframes.length} keyframes`} />
        )}
      </div>

      {/* Right Trim Handle */}
      {!isLocked && (
        <div
          onMouseDown={(e) => onStartDrag(e, clip.id, "trim-right")}
          onTouchStart={(e) => onStartDrag(e, clip.id, "trim-right")}
          title="Trim Out-Point (Right)"
          className="absolute right-0 top-0 bottom-0 w-2.5 bg-white/20 hover:bg-white/80 active:bg-white cursor-ew-resize rounded-r-md transition-colors z-20"
        />
      )}
    </div>
  );
});

export const ProTimeline: React.FC<ProTimelineProps> = React.memo(({
  duration: initialDuration,
  currentTime,
  isPlaying,
  onSeek,
  onTogglePlay,
  language
}) => {
  const isSk = language === "sk";
  
  // 1. CANONICAL TIMELINE SUBSCRIPTION (Single Source of Truth)
  const { project, canUndo, canRedo } = useCoreProject();
  const calculatedDuration = TimelineEngine.calculateProjectDuration(project);
  const duration = Math.max(initialDuration || 15, calculatedDuration, 15);

  // 2. UI-ONLY STATE (Selection, Tools, Zoom, Drag preview)
  const [activeTool, setActiveTool] = useState<"select" | "blade">("select");
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [snappingEnabled, setSnappingEnabled] = useState(true);
  const [rippleMode, setRippleMode] = useState(false);
  const [copiedClipAttributes, setCopiedClipAttributes] = useState<Partial<ClipModel> | null>(null);

  // Zoom & Dimensions
  const [pxPerSec, setPxPerSec] = useState(35); // Pixels per second zoom factor
  const timelineWidth = duration * pxPerSec;

  // Markers from Canonical Project (Single Source of Truth)
  const markers = useMemo(() => {
    if (project.markers && project.markers.length > 0) {
      return project.markers;
    }
    return [
      { id: "m1", time: 2.0, color: "#ef4444", label: "Intro Hook", notes: "Intro Hook" },
      { id: "m2", time: 8.0, color: "#eab308", label: "Key Statement", notes: "Key Statement" }
    ];
  }, [project.markers]);

  const [snappingGuideTime, setSnappingGuideTime] = useState<number | null>(null);
  const timelineTracksRef = useRef<HTMLDivElement>(null);
  const [isScrubbingRuler, setIsScrubbingRuler] = useState(false);

  // Find currently selected clip across canonical tracks
  const selectedClip = useMemo(() => {
    for (const track of project.tracks) {
      const found = track.clips.find(c => selectedClipIds.includes(c.id));
      if (found) return found;
    }
    return null;
  }, [project.tracks, selectedClipIds]);

  const { waveformDensity } = useAdaptiveDeviceExperience();

  // Waveform bars memoization
  const staticWaveformBars = useMemo(() => {
    const barCount = waveformDensity === "MINIMAL_DETAIL" ? 20 : waveformDensity === "REDUCED_DETAIL" ? 35 : 60;
    return Array.from({ length: barCount }, (_, i) => `${20 + Math.sin(i * 0.15) * 40 + ((i * 17) % 20)}%`);
  }, [waveformDensity]);

  // Dynamic Ruler Ticks based on zoom factor
  const rulerStep = pxPerSec >= 60 ? 0.5 : pxPerSec >= 25 ? 1 : 2;
  const rulerTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let t = 0; t <= duration + 1; t += rulerStep) {
      ticks.push(Math.round(t * 10) / 10);
    }
    return ticks;
  }, [duration, rulerStep]);

  // --- RULER SCRUBBING & TIME SEEK ---
  const updateRulerSeek = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!timelineTracksRef.current) return;
    const rect = timelineTracksRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left - 200; // Subtract 200px track headers
    if (clickX >= 0) {
      const targetTime = Math.max(0, Math.min(duration, clickX / pxPerSec));
      onSeek(targetTime);
      playheadStore.setTime(targetTime, true);
    }
  }, [duration, pxPerSec, onSeek]);

  const updateRulerSeekTouch = useCallback((e: TouchEvent | React.TouchEvent) => {
    if (!timelineTracksRef.current || !e.touches || e.touches.length === 0) return;
    const rect = timelineTracksRef.current.getBoundingClientRect();
    const touchX = e.touches[0].clientX - rect.left - 200;
    if (touchX >= 0) {
      const targetTime = Math.max(0, Math.min(duration, touchX / pxPerSec));
      onSeek(targetTime);
      playheadStore.setTime(targetTime, true);
    }
  }, [duration, pxPerSec, onSeek]);

  const handleRulerMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsScrubbingRuler(true);
    updateRulerSeek(e);
  };

  const handleRulerTouchStart = (e: React.TouchEvent) => {
    setIsScrubbingRuler(true);
    updateRulerSeekTouch(e);
  };

  useEffect(() => {
    if (!isScrubbingRuler) return;
    const handleMove = (e: MouseEvent) => updateRulerSeek(e);
    const handleTouchMove = (e: TouchEvent) => updateRulerSeekTouch(e);
    const handleUp = () => setIsScrubbingRuler(false);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [isScrubbingRuler, updateRulerSeek, updateRulerSeekTouch]);

  // --- 3. COMMAND-BACKED TIMELINE ACTIONS ---

  // UNDO / REDO
  const handleUndo = useCallback(() => {
    if (coreEngine.undo()) {
      playSynthesizedSFX("click", 0.4);
    }
  }, []);

  const handleRedo = useCallback(() => {
    if (coreEngine.redo()) {
      playSynthesizedSFX("click", 0.4);
    }
  }, []);

  // SPLIT AT PLAYHEAD
  const handleSplitAtPlayhead = useCallback(() => {
    const playheadTime = playheadStore.getTime() || currentTime;
    let targetClipId = selectedClipIds[0];

    // If no clip explicitly selected, find clip under playhead on main video/b-roll track
    if (!targetClipId) {
      const activeClips = TimelineEngine.getActiveClipsAtTime(project, playheadTime);
      if (activeClips.length > 0) {
        targetClipId = activeClips[activeClips.length - 1].clip.id;
      }
    }

    if (targetClipId) {
      const success = coreEngine.splitSelectedClip(targetClipId, playheadTime);
      if (success) {
        playSynthesizedSFX("click", 0.7);
      }
    }
  }, [project, currentTime, selectedClipIds]);

  // BLADE CUT (Slice on direct click)
  const handleBladeCut = useCallback((clipId: string, clickTime: number) => {
    const success = coreEngine.splitSelectedClip(clipId, clickTime);
    if (success) {
      playSynthesizedSFX("click", 0.7);
    }
  }, []);

  // RIPPLE DELETE / REGULAR DELETE
  const handleDeleteSelected = useCallback((ripple: boolean = false) => {
    if (selectedClipIds.length === 0) return;
    for (const id of selectedClipIds) {
      coreEngine.removeClip(id, ripple || rippleMode);
    }
    setSelectedClipIds([]);
    playSynthesizedSFX(ripple || rippleMode ? "whoosh" : "glitch", 0.5);
  }, [selectedClipIds, rippleMode]);

  // SELECTION
  const handleSelectClip = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      setSelectedClipIds(prev => 
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
    } else {
      setSelectedClipIds([id]);
    }
  }, []);

  // MARKERS
  const handleAddMarker = () => {
    const playheadTime = playheadStore.getTime() || currentTime;
    const note = prompt(isSk ? "Zadajte poznámku pre marker:" : "Enter note for marker:");
    if (note === null) return;
    coreEngine.addMarker({
      id: `m_${crypto.randomUUID()}`,
      time: playheadTime,
      label: note || "Marker",
      notes: note || "Marker",
      color: "#10b981",
      category: "comment"
    });
    playSynthesizedSFX("click", 0.6);
  };

  // RIPPLE TRIM HEAD (Q shortcut) & TAIL (W shortcut)
  const handleRippleTrimHead = useCallback(() => {
    const playheadTime = playheadStore.getTime() || currentTime;
    let targetClipId = selectedClipIds[0];
    if (!targetClipId) {
      const activeClips = TimelineEngine.getActiveClipsAtTime(project, playheadTime);
      if (activeClips.length > 0) {
        targetClipId = activeClips[activeClips.length - 1].clip.id;
      }
    }
    if (targetClipId) {
      const success = coreEngine.rippleTrimHead(targetClipId, playheadTime);
      if (success) {
        playSynthesizedSFX("whoosh", 0.5);
      }
    }
  }, [project, currentTime, selectedClipIds]);

  const handleRippleTrimTail = useCallback(() => {
    const playheadTime = playheadStore.getTime() || currentTime;
    let targetClipId = selectedClipIds[0];
    if (!targetClipId) {
      const activeClips = TimelineEngine.getActiveClipsAtTime(project, playheadTime);
      if (activeClips.length > 0) {
        targetClipId = activeClips[activeClips.length - 1].clip.id;
      }
    }
    if (targetClipId) {
      const success = coreEngine.rippleTrimTail(targetClipId, playheadTime);
      if (success) {
        playSynthesizedSFX("whoosh", 0.5);
      }
    }
  }, [project, currentTime, selectedClipIds]);

  // KEYBOARD SHORTCUTS
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key.toLowerCase() === "v") {
        setActiveTool("select");
      } else if (e.key.toLowerCase() === "c" && !e.metaKey && !e.ctrlKey) {
        setActiveTool("blade");
      } else if (e.key.toLowerCase() === "b" || (e.key.toLowerCase() === "c" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        handleSplitAtPlayhead();
      } else if (e.key.toLowerCase() === "q" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleRippleTrimHead();
      } else if (e.key.toLowerCase() === "w" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleRippleTrimTail();
      } else if (e.key === "Backspace" || e.key === "Delete") {
        handleDeleteSelected(e.shiftKey);
      } else if (e.key.toLowerCase() === "m") {
        handleAddMarker();
      } else if (e.key.toLowerCase() === "s") {
        setSnappingEnabled(prev => !prev);
      } else if (e.key.toLowerCase() === "z" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (e.key.toLowerCase() === "y" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === " ") {
        e.preventDefault();
        onTogglePlay();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleSplitAtPlayhead,
    handleRippleTrimHead,
    handleRippleTrimTail,
    handleDeleteSelected,
    handleUndo,
    handleRedo,
    onTogglePlay
  ]);

  // --- 4. DRAG & DROP / TRIMMING WITH CANONICAL COMMAND DISPATCH ---
  const [dragState, setDragState] = useState<{
    clipId: string;
    type: "move" | "trim-left" | "trim-right";
    initialX: number;
    initialTimelineStart: number;
    initialDuration: number;
    initialSourceStart: number;
    currentDeltaT: number;
  } | null>(null);

  const handleStartDrag = (
    e: React.MouseEvent | React.TouchEvent,
    clipId: string,
    type: "move" | "trim-left" | "trim-right"
  ) => {
    e.stopPropagation();
    let targetClip: ClipModel | null = null;
    for (const tr of project.tracks) {
      const c = tr.clips.find(clip => clip.id === clipId);
      if (c) {
        targetClip = c;
        break;
      }
    }
    if (!targetClip) return;

    const clientX = "touches" in e && e.touches.length > 0 ? e.touches[0].clientX : (e as React.MouseEvent).clientX;

    setDragState({
      clipId,
      type,
      initialX: clientX,
      initialTimelineStart: targetClip.timelineStart ?? targetClip.start ?? 0,
      initialDuration: targetClip.duration,
      initialSourceStart: targetClip.sourceStart ?? targetClip.offset ?? 0,
      currentDeltaT: 0
    });
  };

  const handleGlobalDragMove = useCallback((clientX: number) => {
    if (!dragState) return;
    const deltaX = clientX - dragState.initialX;
    const deltaT = deltaX / pxPerSec;

    let targetTime = dragState.initialTimelineStart + deltaT;
    if (dragState.type === "trim-right") {
      targetTime = dragState.initialTimelineStart + dragState.initialDuration + deltaT;
    }

    if (snappingEnabled) {
      const snap = TimelineEngine.getSnappedTime(project, targetTime, dragState.clipId, 0.08);
      if (snap.snapped) {
        setSnappingGuideTime(snap.time);
      } else {
        setSnappingGuideTime(null);
      }
    }

    setDragState(prev => prev ? { ...prev, currentDeltaT: deltaT } : null);
  }, [dragState, pxPerSec, snappingEnabled, project]);

  const handleGlobalMouseUp = useCallback(() => {
    if (!dragState) return;

    const deltaT = dragState.currentDeltaT;
    setSnappingGuideTime(null);

    if (Math.abs(deltaT) > 0.005) {
      if (dragState.type === "move") {
        let newStart = Math.max(0, dragState.initialTimelineStart + deltaT);
        if (snappingEnabled) {
          const snap = TimelineEngine.getSnappedTime(project, newStart, dragState.clipId, 0.08);
          if (snap.snapped) newStart = snap.time;
        }
        coreEngine.moveClip(dragState.clipId, newStart);
      } else if (dragState.type === "trim-left") {
        let deltaSeconds = deltaT;
        if (snappingEnabled) {
          const newStart = Math.max(0, dragState.initialTimelineStart + deltaT);
          const snap = TimelineEngine.getSnappedTime(project, newStart, dragState.clipId, 0.08);
          if (snap.snapped) {
            deltaSeconds = snap.time - dragState.initialTimelineStart;
          }
        }
        coreEngine.trimClip(dragState.clipId, "left", deltaSeconds, rippleMode);
      } else if (dragState.type === "trim-right") {
        let deltaSeconds = deltaT;
        if (snappingEnabled) {
          const newEnd = dragState.initialTimelineStart + dragState.initialDuration + deltaT;
          const snap = TimelineEngine.getSnappedTime(project, newEnd, dragState.clipId, 0.08);
          if (snap.snapped) {
            deltaSeconds = snap.time - (dragState.initialTimelineStart + dragState.initialDuration);
          }
        }
        coreEngine.trimClip(dragState.clipId, "right", deltaSeconds, rippleMode);
      }
      playSynthesizedSFX("click", 0.5);
    }

    setDragState(null);
  }, [dragState, snappingEnabled, project, rippleMode]);

  useEffect(() => {
    if (dragState) {
      const handleMouseMove = (e: MouseEvent) => handleGlobalDragMove(e.clientX);
      const handleTouchMove = (e: TouchEvent) => {
        if (e.touches && e.touches.length > 0) {
          handleGlobalDragMove(e.touches[0].clientX);
        }
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleGlobalMouseUp);
      window.addEventListener("touchmove", handleTouchMove, { passive: true });
      window.addEventListener("touchend", handleGlobalMouseUp);

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleGlobalMouseUp);
        window.removeEventListener("touchmove", handleTouchMove);
        window.removeEventListener("touchend", handleGlobalMouseUp);
      };
    }
  }, [dragState, handleGlobalDragMove, handleGlobalMouseUp]);

  // --- 5. TRACK CONTROLS ---
  const handleToggleTrackMute = (track: TrackModel) => {
    coreEngine.updateTrackProps(track.id, { muted: !track.muted });
  };

  const handleToggleTrackLock = (track: TrackModel) => {
    coreEngine.updateTrackProps(track.id, { locked: !track.locked });
  };

  const handleToggleTrackVisible = (track: TrackModel) => {
    coreEngine.updateTrackProps(track.id, { visible: !track.visible });
  };

  // Helper track icons
  const getTrackIcon = (type: string) => {
    switch (type) {
      case "video": return Move;
      case "b-roll": return Film;
      case "caption": return Type;
      case "audio": return Music;
      case "sfx": return Volume2;
      case "adjustment": return Layers;
      default: return Film;
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 p-6 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl">
      
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-600/20">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>{isSk ? "Profesionálna Nelineárna Časová Os" : "Professional NLE Timeline"}</span>
              <span className="text-[10px] bg-rose-500/20 text-rose-300 font-mono px-2 py-0.5 rounded-full border border-rose-500/40">
                CANONICAL V3
              </span>
            </h3>
            <p className="text-xs text-neutral-400">
              {isSk 
                ? "Plnohodnotný strih, split, trim, ripple, snap a multi-track s Undo/Redo históriou." 
                : "Full multi-track NLE with split, trim, ripple, snap, and transactional Undo/Redo."}
            </p>
          </div>
        </div>

        {/* Action Button Strip */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tool Selector: Select (V) / Blade (C) */}
          <div className="flex items-center bg-neutral-950 p-1 rounded-xl border border-neutral-800">
            <button
              onClick={() => setActiveTool("select")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTool === "select"
                  ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                  : "text-neutral-400 hover:text-white"
              }`}
              title="Select Tool (V)"
            >
              <Move className="h-3.5 w-3.5" />
              <span>{isSk ? "Výber (V)" : "Select (V)"}</span>
            </button>
            <button
              onClick={() => setActiveTool("blade")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTool === "blade"
                  ? "bg-rose-600 text-white shadow-md shadow-rose-600/30 animate-pulse"
                  : "text-neutral-400 hover:text-white"
              }`}
              title="Blade / Razor Tool (C)"
            >
              <Scissors className="h-3.5 w-3.5" />
              <span>{isSk ? "Žiletka (C)" : "Blade (C)"}</span>
            </button>
          </div>

          {/* Quick Split at Playhead */}
          <button
            onClick={handleSplitAtPlayhead}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-950 border border-neutral-800 hover:bg-neutral-800 text-neutral-200 rounded-xl text-xs font-bold transition-all"
            title="Split at Playhead (Ctrl+B / Cmd+B)"
          >
            <Scissors className="h-3.5 w-3.5 text-rose-400" />
            <span>{isSk ? "Rozdeliť" : "Split"}</span>
          </button>

          {/* Ripple Mode Toggle */}
          <button
            onClick={() => setRippleMode(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-bold transition-all ${
              rippleMode 
                ? "bg-amber-500/20 border-amber-500/60 text-amber-300" 
                : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white"
            }`}
            title="Ripple Edit Mode (Shift+Del)"
          >
            <span>⚡ RIPPLE</span>
          </button>

          {/* Snapping Toggle */}
          <button
            onClick={() => setSnappingEnabled(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-bold transition-all ${
              snappingEnabled 
                ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300" 
                : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white"
            }`}
            title="Magnet Snapping (S)"
          >
            <Magnet className="h-3.5 w-3.5" />
            <span>SNAP</span>
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center bg-neutral-950 p-1 rounded-xl border border-neutral-800">
            <button
              onClick={() => setPxPerSec(prev => Math.max(15, prev - 10))}
              className="p-1 text-neutral-400 hover:text-white rounded"
              title="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="text-[10px] font-mono text-neutral-400 px-1.5 select-none">{pxPerSec}px/s</span>
            <button
              onClick={() => setPxPerSec(prev => Math.min(150, prev + 10))}
              className="p-1 text-neutral-400 hover:text-white rounded"
              title="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Undo / Redo */}
          <div className="flex items-center bg-neutral-950 p-1 rounded-xl border border-neutral-800">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-30 rounded-lg transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-30 rounded-lg transition-colors"
              title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
            >
              <Redo2 className="h-4 w-4" />
            </button>
          </div>

          {/* Delete Selected */}
          {selectedClipIds.length > 0 && (
            <button
              onClick={() => handleDeleteSelected(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/40 border border-rose-800/60 hover:bg-rose-900/60 text-rose-300 rounded-xl text-xs font-bold transition-all animate-pulse"
              title="Delete Selected Clip (Del)"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{isSk ? `Zmazať (${selectedClipIds.length})` : `Delete (${selectedClipIds.length})`}</span>
            </button>
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts Hint Bar */}
      <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-neutral-500 bg-neutral-950/60 px-3 py-1.5 rounded-xl border border-neutral-800/60">
        <span><kbd className="bg-neutral-900 px-1 rounded text-white font-sans font-bold">V</kbd> Výber</span>
        <span><kbd className="bg-neutral-900 px-1 rounded text-white font-sans font-bold">C</kbd> Žiletka</span>
        <span><kbd className="bg-neutral-900 px-1 rounded text-white font-sans font-bold">Ctrl+B</kbd> Rozdeliť</span>
        <span><kbd className="bg-neutral-900 px-1 rounded text-white font-sans font-bold">Del</kbd> Zmazať</span>
        <span><kbd className="bg-neutral-900 px-1 rounded text-white font-sans font-bold">Shift+Del</kbd> Ripple Zmazanie</span>
        <span><kbd className="bg-neutral-900 px-1 rounded text-white font-sans font-bold">M</kbd> Marker</span>
        <span><kbd className="bg-neutral-900 px-1 rounded text-white font-sans font-bold">S</kbd> Snapping</span>
        <span><kbd className="bg-neutral-900 px-1 rounded text-white font-sans font-bold">Medzerník</kbd> Play/Pauza</span>
      </div>

      {/* 2. MAIN SCROLLABLE TRACK LAYOUT */}
      <div 
        ref={timelineTracksRef}
        onMouseDown={handleRulerMouseDown}
        onTouchStart={handleRulerTouchStart}
        className="flex flex-col bg-neutral-950 rounded-2xl border border-neutral-800 overflow-hidden relative select-none cursor-pointer"
      >
        
        {/* Time Ruler */}
        <div className="h-8 bg-neutral-950 border-b border-neutral-900 relative overflow-hidden flex items-end">
          <div className="absolute left-[200px] right-0 h-full flex" style={{ width: timelineWidth }}>
            {rulerTicks.map((t) => {
              const isMajor = t % 1 === 0;
              return (
                <div
                  key={t}
                  className="absolute border-l border-neutral-800/80 h-full flex flex-col justify-end pb-0.5 pl-1"
                  style={{ left: t * pxPerSec }}
                >
                  {isMajor && (
                    <span className="text-[9px] font-mono text-neutral-500 font-bold">{t}s</span>
                  )}
                  <div className={`absolute left-0 bottom-0 w-px ${isMajor ? "h-2 bg-neutral-600" : "h-1 bg-neutral-800"}`} />
                </div>
              );
            })}

            {/* Visual Markers on Ruler */}
            {markers.map(m => (
              <div
                key={m.id}
                className="absolute top-0 bottom-0 w-px z-30 group cursor-pointer"
                style={{ left: m.time * pxPerSec }}
                title={`${m.label || m.notes || "Marker"} (${m.time.toFixed(1)}s)`}
              >
                <div 
                  className="h-3 w-3 -translate-x-1/2 rotate-45 border border-black shadow shadow-black/80"
                  style={{ backgroundColor: m.color || "#10b981" }}
                />
                <div className="hidden group-hover:block absolute top-4 left-2 bg-neutral-900 border border-neutral-700 p-1.5 rounded text-[9px] font-mono text-white whitespace-nowrap z-50">
                  {m.label || m.notes || "Marker"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Canonical Tracks Container */}
        <div className="flex flex-col relative divide-y divide-neutral-900 max-h-[440px] overflow-y-auto">
          {project.tracks.map(track => {
            const TrackIcon = getTrackIcon(track.type);

            return (
              <div key={track.id} className={`flex h-16 items-center relative ${!track.visible ? "opacity-30" : ""}`}>
                
                {/* Track Headers (Left sidebar area) */}
                <div className="w-[200px] shrink-0 border-r border-neutral-900 bg-neutral-950/90 h-full flex items-center justify-between px-3 z-20">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="h-7 w-7 rounded-lg bg-neutral-900 flex items-center justify-center text-neutral-400 border border-neutral-800 shrink-0">
                      <TrackIcon className="h-3.5 w-3.5" />
                    </div>
                    <div className="overflow-hidden">
                      <h5 className="text-[10px] font-black text-white uppercase tracking-wider truncate max-w-[85px]" title={track.name}>
                        {track.name}
                      </h5>
                      <p className="text-[8px] text-neutral-600 font-mono uppercase">{track.type}</p>
                    </div>
                  </div>

                  {/* Track Toggle Icons (Mute, Lock, Visibility) */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleTrackMute(track); }}
                      className={`p-1 rounded hover:bg-neutral-800 ${track.muted ? "text-rose-400" : "text-neutral-500"}`}
                      title={track.muted ? "Unmute Track" : "Mute Track"}
                    >
                      {track.muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleTrackLock(track); }}
                      className={`p-1 rounded hover:bg-neutral-800 ${track.locked ? "text-amber-400" : "text-neutral-500"}`}
                      title={track.locked ? "Unlock Track" : "Lock Track"}
                    >
                      {track.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleTrackVisible(track); }}
                      className={`p-1 rounded hover:bg-neutral-800 ${!track.visible ? "text-neutral-600" : "text-neutral-400"}`}
                      title={track.visible ? "Hide Track" : "Show Track"}
                    >
                      {track.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    </button>
                  </div>
                </div>

                {/* Track timeline drag track (Right area) */}
                <div className="flex-1 h-full bg-neutral-900/10 relative overflow-hidden">
                  <div className="absolute top-0 bottom-0 left-0" style={{ width: timelineWidth }}>
                    
                    {/* Audio Waveform visualization background on sound/main track */}
                    {(track.type === "audio" || track.type === "video") && (
                      <div className="absolute inset-x-0 bottom-1 h-6 pointer-events-none opacity-20 flex items-end gap-0.5 px-2">
                        {staticWaveformBars.map((heightStr, i) => (
                          <div 
                            key={i} 
                            className="flex-1 bg-amber-500 rounded-t"
                            style={{ height: heightStr }}
                          />
                        ))}
                      </div>
                    )}

                    {/* Clip Blocks rendered from Canonical Track Clips */}
                    {track.clips.map(clip => (
                      <ProTimelineClip
                        key={clip.id}
                        clip={clip}
                        trackId={track.id}
                        pxPerSec={pxPerSec}
                        isSelected={selectedClipIds.includes(clip.id)}
                        activeTool={activeTool}
                        isLocked={track.locked}
                        onSelect={handleSelectClip}
                        onBladeCut={handleBladeCut}
                        onStartDrag={handleStartDrag}
                      />
                    ))}

                  </div>
                </div>

              </div>
            );
          })}
        </div>

        {/* Playhead marker indicator line */}
        <ProTimelinePlayhead pxPerSec={pxPerSec} fallbackTime={currentTime} />

        {/* Snapping Guide Indicator line */}
        {snappingGuideTime !== null && (
          <div 
            className="absolute top-0 bottom-0 w-px bg-emerald-400 z-30 pointer-events-none border-dashed border-emerald-400 animate-pulse"
            style={{ left: `${200 + snappingGuideTime * pxPerSec}px` }}
          />
        )}
      </div>

      {/* 3. PRO EDITOR INSPECTOR SIDE-PANEL (Renders when a clip is selected) */}
      <AnimatePresence mode="popLayout">
        {selectedClip ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 p-5 rounded-2xl bg-neutral-950 border border-neutral-800"
          >
            {/* Inspector Left Column: Clip Information & Copy/Paste */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-white uppercase tracking-widest">{isSk ? "INFORMÁCIE O KLIPE" : "CLIP PROPERTIES"}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCopiedClipAttributes({
                        scale: selectedClip.scale,
                        opacity: selectedClip.opacity,
                        volume: selectedClip.volume,
                        filter: selectedClip.filter,
                        keyframes: selectedClip.keyframes
                      });
                      playSynthesizedSFX("click", 0.6);
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-[10px] font-bold text-neutral-300 rounded-lg"
                    title="Copy attributes (scale, filter, volume)"
                  >
                    <Copy className="h-3 w-3" />
                    <span>COPY</span>
                  </button>
                  <button
                    onClick={() => {
                      if (copiedClipAttributes) {
                        coreEngine.updateClipProps(selectedClip.id, copiedClipAttributes);
                        playSynthesizedSFX("ding", 0.5);
                      }
                    }}
                    disabled={!copiedClipAttributes}
                    className="flex items-center gap-1.5 px-2 py-1 bg-violet-900/30 border border-violet-800/50 hover:bg-violet-800/40 text-[10px] font-bold text-violet-300 rounded-lg disabled:opacity-30"
                    title="Paste copied attributes"
                  >
                    <Check className="h-3 w-3" />
                    <span>PASTE</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-neutral-900 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Clip ID:</span>
                  <span className="font-mono text-neutral-300">{selectedClip.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Track type:</span>
                  <span className="font-bold text-rose-500 uppercase">{selectedClip.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Timeline position:</span>
                  <span className="font-mono text-neutral-300">
                    {(selectedClip.timelineStart ?? selectedClip.start ?? 0).toFixed(2)}s – {((selectedClip.timelineStart ?? selectedClip.start ?? 0) + selectedClip.duration).toFixed(2)}s
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Source Range:</span>
                  <span className="font-mono text-neutral-300">
                    {(selectedClip.sourceStart ?? selectedClip.offset ?? 0).toFixed(2)}s – {(selectedClip.sourceEnd ?? 0).toFixed(2)}s
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">LUT Style Filter:</span>
                  <select
                    value={selectedClip.filter || "NONE"}
                    onChange={(e) => {
                      coreEngine.updateClipProps(selectedClip.id, { filter: e.target.value as any });
                    }}
                    className="bg-neutral-800 border border-neutral-700 rounded px-2 py-0.5 text-white font-mono text-[10px]"
                  >
                    <option value="NONE">None</option>
                    <option value="CINEMATIC">Cinematic</option>
                    <option value="TEAL_ORANGE">Teal & Orange</option>
                    <option value="VINTAGE">Vintage</option>
                    <option value="BW">B&W Monochrome</option>
                    <option value="WARM">Warm Golden</option>
                    <option value="COOL">Cool Steel</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Inspector Middle Column: Transform & Opacity */}
            <div className="space-y-4">
              <span className="text-[11px] font-black text-white uppercase tracking-widest">{isSk ? "TRANSFORMÁCIA & PREKRYTIE" : "TRANSFORM & OPACITY"}</span>
              
              <div className="p-4 rounded-xl bg-neutral-900 space-y-4 text-xs">
                {/* Scale Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-neutral-400">
                    <span>Mierka (Scale):</span>
                    <span className="font-mono text-white font-bold">{selectedClip.scale || 100}%</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={300}
                    value={selectedClip.scale || 100}
                    onChange={(e) => coreEngine.updateClipProps(selectedClip.id, { scale: parseInt(e.target.value) })}
                    className="w-full accent-violet-500"
                  />
                </div>

                {/* Opacity Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-neutral-400">
                    <span>Priehľadnosť (Opacity):</span>
                    <span className="font-mono text-white font-bold">{selectedClip.opacity || 100}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={selectedClip.opacity !== undefined ? selectedClip.opacity : 100}
                    onChange={(e) => coreEngine.updateClipProps(selectedClip.id, { opacity: parseInt(e.target.value) })}
                    className="w-full accent-violet-500"
                  />
                </div>
              </div>
            </div>

            {/* Inspector Right Column: Audio Volume & Keyframes */}
            <div className="space-y-4">
              <span className="text-[11px] font-black text-white uppercase tracking-widest">{isSk ? "ZVUK & ANIMÁCIA" : "AUDIO & KEYFRAMES"}</span>

              <div className="p-4 rounded-xl bg-neutral-900 space-y-4 text-xs">
                {/* Volume Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-neutral-400">
                    <span>Hlasitosť (Volume):</span>
                    <span className="font-mono text-white font-bold">{selectedClip.volume || 100}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={200}
                    value={selectedClip.volume !== undefined ? selectedClip.volume : 100}
                    onChange={(e) => coreEngine.updateClipProps(selectedClip.id, { volume: parseInt(e.target.value) })}
                    className="w-full accent-amber-500"
                  />
                </div>

                {/* Speed Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-neutral-400">
                    <span>Rýchlosť (Speed):</span>
                    <span className="font-mono text-white font-bold">{selectedClip.speed || 1.0}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.25}
                    max={4.0}
                    step={0.25}
                    value={selectedClip.speed || 1.0}
                    onChange={(e) => coreEngine.updateClipProps(selectedClip.id, { speed: parseFloat(e.target.value) })}
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

    </div>
  );
});

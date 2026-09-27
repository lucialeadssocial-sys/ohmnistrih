import React, { memo, useMemo } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Rewind,
  Zap,
  Volume2,
  Layers,
  Film,
  Music,
} from "lucide-react";
import { ZoomCue, SFXCue, CaptionSegment, BRollOverlay, EditMapItem, SelectionType } from "../types";
import { AIJobQueue } from "../utils/performanceEngine";
import { usePlayheadTime, playheadStore } from "../core/playback/playheadStore";

interface TimelineControlsProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onSelect?: (type: SelectionType, id: string | null) => void;
  zoomCues: ZoomCue[];
  sfxCues: SFXCue[];
  captions: CaptionSegment[];
  bRollOverlays?: BRollOverlay[];
  editMap?: EditMapItem[];
  language: "sk" | "en";
}

export const TimelineControls: React.FC<TimelineControlsProps> = memo(({
  currentTime,
  duration,
  isPlaying,
  onTogglePlay,
  onSeek,
  onSelect,
  zoomCues,
  sfxCues,
  captions,
  bRollOverlays = [],
  editMap = [],
  language,
}) => {
  const storeTime = usePlayheadTime();
  const effectiveCurrentTime = storeTime > 0 ? storeTime : currentTime;
  const isSk = language === "sk";
  const safeDuration = duration > 0 ? duration : 15;

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) secs = 0;
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m.toString().padStart(2, "0")}:${s
      .toString()
      .padStart(2, "0")}.${ms}`;
  };

  // Memoized track rendering for 60fps playhead responsiveness
  const renderedEditMapTrack = useMemo(() => {
    if (editMap.length === 0) return null;
    return (
      <div className="relative h-1.5 w-full rounded-full bg-neutral-950/60 overflow-hidden">
        {editMap.map((item, idx) => {
          const leftPct = (item.start / safeDuration) * 100;
          const widthPct = Math.max(
            0.8,
            ((item.end - item.start) / safeDuration) * 100
          );
          return (
            <div
              key={`${item.id}-${idx}`}
              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              title={`${isSk ? item.labelSk : item.labelEn} (${item.type})`}
              className={`absolute top-0 bottom-0 rounded-full border-x border-neutral-950/20 ${
                item.type === "HOOK" ? "bg-rose-500" :
                item.type === "HIGHLIGHT" ? "bg-amber-400" :
                item.type === "PAYOFF" ? "bg-emerald-500" :
                item.type === "PAUSE" || item.type === "REPEAT" ? "bg-neutral-800" :
                "bg-neutral-600"
              }`}
            />
          );
        })}
      </div>
    );
  }, [editMap, safeDuration, isSk]);

  const renderedCaptionsTrack = useMemo(() => {
    return (
      <div className="relative h-2 w-full rounded-full bg-neutral-950 overflow-hidden">
        {captions.map((cap, idx) => {
          const leftPct = (cap.start / safeDuration) * 100;
          const widthPct = Math.max(
            2,
            ((cap.end - cap.start) / safeDuration) * 100
          );
          return (
            <div
              key={`${cap.id}-${idx}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.('CAPTION', cap.id);
              }}
              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              title={cap.text}
              className="absolute top-0 bottom-0 rounded-full bg-indigo-500/80 border border-indigo-400/40 cursor-pointer hover:bg-indigo-400 transition-colors"
            />
          );
        })}
      </div>
    );
  }, [captions, safeDuration, onSelect]);

  const renderedBRollTrack = useMemo(() => {
    if (bRollOverlays.length === 0) return null;
    return (
      <div className="relative h-1.5 w-full rounded-full bg-neutral-950 overflow-hidden">
        {bRollOverlays.map((b, idx) => {
          const leftPct = (b.start / safeDuration) * 100;
          const widthPct = Math.max(
            3,
            ((b.end - b.start) / safeDuration) * 100
          );
          return (
            <div
              key={`${b.id}-${idx}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.('BROLL', b.id);
              }}
              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              title={`B-Roll: ${b.title}`}
              className="absolute top-0 bottom-0 rounded-full bg-emerald-500/80 border border-emerald-400/50 cursor-pointer hover:bg-emerald-400 transition-colors"
            />
          );
        })}
      </div>
    );
  }, [bRollOverlays, safeDuration, onSelect]);

  const renderedZoomMarkers = useMemo(() => {
    return zoomCues.map((z, idx) => {
      if (z.scale <= 1.0) return null;
      const leftPct = (z.timestamp / safeDuration) * 100;
      return (
        <div
          key={`${z.id}-${idx}`}
          style={{ left: `${leftPct}%` }}
          title={`Smart Zoom: ${z.scale}x`}
          className="pointer-events-none absolute top-1 z-30 h-4 w-1 -translate-x-1/2 rounded-full bg-rose-400 shadow-sm shadow-rose-500/80"
        />
      );
    });
  }, [zoomCues, safeDuration]);

  const renderedSfxMarkers = useMemo(() => {
    return sfxCues.map((s, idx) => {
      const leftPct = (s.timestamp / safeDuration) * 100;
      return (
        <div
          key={`${s.id}-${idx}`}
          style={{ left: `${leftPct}%` }}
          title={`SFX: ${s.type} (${s.label})`}
          className="pointer-events-none absolute bottom-1 z-30 h-2 w-2 -translate-x-1/2 rounded-full bg-amber-400 shadow-sm shadow-amber-500/80"
        />
      );
    });
  }, [sfxCues, safeDuration]);

  return (
    <div className="w-full rounded-2xl border border-neutral-800 bg-neutral-900/90 p-3 sm:p-4 shadow-xl backdrop-blur-md">
      {/* Multi-Track Timeline Bar */}
      <div className="relative mb-3 flex flex-col gap-1.5">
        {/* Main Video Track (Selectable) */}
        <div 
          onClick={() => onSelect?.('VIDEO_CLIP', 'primary-video')}
          className="relative h-3 w-full rounded bg-neutral-800 border border-neutral-700 cursor-pointer hover:border-rose-500/50 transition-all group overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-rose-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute left-2 top-0 bottom-0 flex items-center">
            <Film className="w-2.5 h-2.5 text-neutral-600 group-hover:text-rose-500" />
            <span className="ml-1.5 text-[8px] font-black text-neutral-600 group-hover:text-neutral-400 uppercase tracking-tighter">Primary Video Clip</span>
          </div>
        </div>

        {/* AI Edit Map Track (Raw analysis) */}
        {renderedEditMapTrack}

        {/* Caption Blocks visual track */}
        {renderedCaptionsTrack}

        {/* B-Roll Overlays Visual Track */}
        {renderedBRollTrack}

        {/* Audio Track (Selectable) */}
        <div 
          onClick={() => onSelect?.('AUDIO_CLIP', 'primary-audio')}
          className="relative h-3 w-full rounded bg-neutral-800 border border-neutral-700 cursor-pointer hover:border-indigo-500/50 transition-all group overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute left-2 top-0 bottom-0 flex items-center">
            <Music className="w-2.5 h-2.5 text-neutral-600 group-hover:text-indigo-500" />
            <span className="ml-1.5 text-[8px] font-black text-neutral-600 group-hover:text-neutral-400 uppercase tracking-tighter">Primary Audio Track</span>
          </div>
          {/* Waveform placeholder */}
          <div className="absolute inset-y-0.5 right-2 flex items-center gap-0.5 opacity-20">
            {[2, 4, 3, 5, 2, 6, 4, 3, 5].map((h, i) => (
              <div key={i} className="w-0.5 bg-indigo-400" style={{ height: `${h * 15}%` }} />
            ))}
          </div>
        </div>

        {/* Main Interactive Scrubber Bar with Zoom & SFX Markers */}
        <div className="relative h-6 flex items-center cursor-pointer group">
          <input
            type="range"
            min={0}
            max={safeDuration}
            step={0.05}
            value={effectiveCurrentTime}
            onPointerDown={() => AIJobQueue.setUserInteracting(true)}
            onPointerUp={() => AIJobQueue.setUserInteracting(false)}
            onTouchStart={() => AIJobQueue.setUserInteracting(true)}
            onTouchEnd={() => AIJobQueue.setUserInteracting(false)}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="w-full h-2 rounded-lg bg-neutral-800 appearance-none cursor-pointer accent-rose-500 z-20 focus:outline-none"
          />

          {/* Zoom Markers (Red dots) */}
          {renderedZoomMarkers}

          {/* SFX Markers (Amber dots) */}
          {renderedSfxMarkers}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between text-[11px] text-neutral-400 px-1 font-mono gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-indigo-400" />
              {isSk ? "Titulky" : "Captions"}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {isSk ? "B-Roll Koláž" : "B-Roll Collage"}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-1 rounded-full bg-rose-400" />
              {isSk ? "Smart Zoom" : "Smart Zoom"}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              {isSk ? "Zvuk (SFX)" : "SFX Sound"}
            </span>
          </div>
          <div>
            <span className="font-bold text-white">{formatTime(effectiveCurrentTime)}</span>
            <span className="text-neutral-500"> / </span>
            <span>{formatTime(safeDuration)}</span>
          </div>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-800/80">
        {/* Left: Quick Seek */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onSeek(0)}
            title={isSk ? "Na začiatok" : "Restart"}
            className="rounded-lg p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={() => onSeek(Math.max(0, (playheadStore.getTime() || effectiveCurrentTime) - 3))}
            title="-3s"
            className="rounded-lg p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all"
          >
            <Rewind className="h-4 w-4" />
          </button>
        </div>

        {/* Center: Main Play/Pause */}
        <button
          id="play-pause-btn"
          onClick={onTogglePlay}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 text-white shadow-lg shadow-rose-600/20 hover:scale-105 active:scale-95 transition-all"
        >
          {isPlaying ? (
            <Pause className="h-5 w-5 fill-current" />
          ) : (
            <Play className="h-5 w-5 translate-x-0.5 fill-current" />
          )}
        </button>

        {/* Right: Forward */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onSeek(Math.min(safeDuration, (playheadStore.getTime() || effectiveCurrentTime) + 3))}
            title="+3s"
            className="rounded-lg p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all"
          >
            <FastForward className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

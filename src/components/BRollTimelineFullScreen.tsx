import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Maximize2, Minimize2, Move, Clock, Layers, Sparkles } from "lucide-react";
import { BRollOverlay } from "../types";

interface BRollTimelineFullScreenProps {
  overlays: BRollOverlay[];
  onChangeOverlays: (overlays: BRollOverlay[]) => void;
  duration: number;
  onClose: () => void;
  language: "sk" | "en";
}

export const BRollTimelineFullScreen: React.FC<BRollTimelineFullScreenProps> = ({
  overlays,
  onChangeOverlays,
  duration,
  onClose,
  language,
}) => {
  const isSk = language === "sk";
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1); // 1x = standard width

  // Pixels per second
  const basePxPerSec = 60;
  const pxPerSec = basePxPerSec * zoomLevel;
  const timelineWidth = duration * pxPerSec;

  const handleMoveOverlay = (id: string, newStart: number) => {
    const overlay = overlays.find((o) => o.id === id);
    if (!overlay) return;

    const len = overlay.end - overlay.start;
    const clampedStart = Math.max(0, Math.min(duration - len, newStart));
    const newEnd = clampedStart + len;

    onChangeOverlays(
      overlays.map((o) =>
        o.id === id ? { ...o, start: clampedStart, end: newEnd } : o
      )
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-[100] flex flex-col bg-neutral-950 text-white p-4 sm:p-8"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-500/20 p-2 text-indigo-400">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-['Fraunces'] text-xl sm:text-2xl font-bold">
              {isSk ? "Celoobrazovková B-Roll Časová Os" : "Full-Screen B-Roll Timeline"}
            </h2>
            <p className="text-sm text-neutral-400">
              {isSk
                ? "Presúvaj prekrytia (drag-and-drop) pre presné načasovanie vo videu"
                : "Drag and drop overlays to precisely sync with your video timeline"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 bg-neutral-900 rounded-xl p-1 border border-neutral-800">
            <button
              onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
              className="px-3 py-1 hover:bg-neutral-800 rounded-lg text-xs font-bold"
            >
              -
            </button>
            <span className="text-[10px] font-mono text-neutral-400 w-12 text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel(Math.min(3, zoomLevel + 0.25))}
              className="px-3 py-1 hover:bg-neutral-800 rounded-lg text-xs font-bold"
            >
              +
            </button>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl bg-neutral-900 p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all border border-neutral-800"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Main Timeline Area */}
      <div className="flex-1 overflow-hidden flex flex-col rounded-3xl border border-neutral-800 bg-neutral-900/40 shadow-2xl relative">
        {/* Time Ruler */}
        <div className="h-10 border-b border-neutral-800 bg-neutral-950/50 flex items-end relative overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full flex"
            style={{ width: timelineWidth }}
          >
            {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
              <div
                key={i}
                className="absolute border-l border-neutral-800 h-full flex flex-col justify-end pb-1 pl-1"
                style={{ left: i * pxPerSec }}
              >
                <span className="text-[10px] font-mono text-neutral-500">{i}s</span>
                <div className="absolute left-0 bottom-0 w-px h-2 bg-neutral-700" />
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable Tracks Area */}
        <div className="flex-1 overflow-auto relative p-8 custom-scrollbar" ref={containerRef}>
          <div
            className="relative min-h-[400px] border-b border-dashed border-neutral-800/50"
            style={{ width: timelineWidth }}
          >
            {/* Background Grid Lines */}
            <div className="absolute inset-0 pointer-events-none opacity-10">
              {Array.from({ length: Math.ceil(duration) * 4 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 w-px bg-neutral-500"
                  style={{ left: (i * pxPerSec) / 4 }}
                />
              ))}
            </div>

            {/* B-Roll Tracks */}
            <div className="relative pt-12">
              {overlays.map((ov, idx) => (
                <motion.div
                  key={ov.id}
                  drag="x"
                  dragMomentum={false}
                  dragElastic={0}
                  dragConstraints={containerRef}
                  onDragEnd={(_, info) => {
                    const deltaX = info.offset.x;
                    const deltaT = deltaX / pxPerSec;
                    handleMoveOverlay(ov.id, ov.start + deltaT);
                  }}
                  style={{
                    left: ov.start * pxPerSec,
                    width: (ov.end - ov.start) * pxPerSec,
                    top: (idx % 3) * 80, // Staggered tracks
                  }}
                  className="absolute h-16 cursor-grab active:cursor-grabbing group"
                >
                  <div className="h-full rounded-2xl border border-indigo-500/50 bg-indigo-600/20 backdrop-blur-md p-3 flex flex-col justify-between shadow-lg group-hover:border-indigo-400 group-hover:bg-indigo-600/30 transition-all">
                    <div className="flex items-center justify-between gap-2 overflow-hidden">
                      <div className="flex items-center gap-1.5 truncate">
                        <Move className="h-3 w-3 text-indigo-400 shrink-0" />
                        <span className="text-[11px] font-bold truncate text-white uppercase tracking-tight">
                          {ov.title}
                        </span>
                      </div>
                      <div className="bg-neutral-900/80 rounded px-1 py-0.5 text-[9px] font-mono text-indigo-300">
                        {ov.type}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                      <span>{ov.start.toFixed(1)}s</span>
                      <span>{(ov.end - ov.start).toFixed(1)}s</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Floating Hint */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-neutral-950/80 backdrop-blur-xl border border-neutral-800 rounded-full px-6 py-3 shadow-2xl">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span className="text-xs font-semibold text-neutral-300">
            {isSk
              ? "Uchop a presúvaj bloky pre zmenu ich poradia a času"
              : "Grab and move blocks to change their timing and order"}
          </span>
        </div>
      </div>

      {/* Style Helpers */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.1);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.2);
        }
      `}</style>
    </motion.div>
  );
};

import React, { useEffect, useState } from "react";
import {
  Activity,
  Cpu,
  Zap,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Monitor,
  Tablet,
  SlidersHorizontal,
  ShieldAlert,
} from "lucide-react";
import {
  PerformanceMonitor,
  PerformanceMetrics,
  ProxyQuality,
  AIJobQueue,
  AIJob,
} from "../utils/performanceEngine";
import { useAdaptiveDeviceExperience } from "../contexts/AdaptiveDeviceExperienceContext";

export const PerformancePanel: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>(PerformanceMonitor.getMetrics());
  const [jobs, setJobs] = useState<AIJob[]>(AIJobQueue.getQueue());
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const adaptiveExp = useAdaptiveDeviceExperience();

  useEffect(() => {
    const unsubMonitor = PerformanceMonitor.subscribe((m) => {
      setMetrics(m);
    });

    const unsubJobs = AIJobQueue.registerListener((q) => {
      setJobs(q);
    });

    return () => {
      unsubMonitor();
      unsubJobs();
    };
  }, []);

  const handleSelectQuality = (quality: ProxyQuality) => {
    PerformanceMonitor.setQualityOverride(quality);
  };

  const runningJobs = jobs.filter((j) => j.status === "running");
  const queuedJobs = jobs.filter((j) => j.status === "queued" || j.status === "paused");

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-4 right-4 bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 border border-neutral-700/80 px-3 py-1.5 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-2 text-xs font-mono font-bold z-40 transition-all hover:scale-105 active:scale-95"
        title="Open OmniStrih Engine Diagnostics"
      >
        <span
          className={`h-2 w-2 rounded-full ${
            metrics.fps >= 50
              ? "bg-emerald-400 animate-pulse"
              : metrics.fps >= 30
              ? "bg-amber-400"
              : "bg-rose-500"
          }`}
        />
        <span>{metrics.fps.toFixed(0)} FPS</span>
        <span className="text-neutral-500">|</span>
        <span className="text-[10px] text-rose-400 font-sans font-bold uppercase">{adaptiveExp.compositeProfile}</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-sm w-full font-sans transition-all duration-300">
      <div className="bg-neutral-950/95 border border-neutral-800/90 shadow-2xl rounded-2xl backdrop-blur-xl overflow-hidden text-neutral-200 text-xs">
        {/* Header Bar */}
        <div className="px-3.5 py-2.5 bg-neutral-900/60 border-b border-neutral-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              {adaptiveExp.isMobile ? <Smartphone className="w-3 h-3" /> : adaptiveExp.isTablet ? <Tablet className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-[11px] tracking-tight">ADAPTIVE HUD</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {adaptiveExp.compositeProfile}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setIsMinimized(true)}
              className="px-1.5 py-0.5 rounded-md text-[10px] text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Minimize to Pill"
            >
              _
            </button>
          </div>
        </div>

        {/* Primary Metrics Row */}
        <div className="p-3 grid grid-cols-3 gap-2 text-center bg-neutral-900/30">
          <div className="bg-neutral-900/80 rounded-xl p-2 border border-neutral-800/80">
            <span className="text-[10px] text-neutral-400 uppercase font-semibold block">Framerate</span>
            <div className="flex items-baseline justify-center gap-1 mt-0.5">
              <span
                className={`text-base font-black font-mono ${
                  metrics.fps >= 50
                    ? "text-emerald-400"
                    : metrics.fps >= 30
                    ? "text-amber-400"
                    : "text-rose-400"
                }`}
              >
                {metrics.fps.toFixed(0)}
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">FPS</span>
            </div>
          </div>

          <div className="bg-neutral-900/80 rounded-xl p-2 border border-neutral-800/80">
            <span className="text-[10px] text-neutral-400 uppercase font-semibold block">Preview Quality</span>
            <div className="flex items-baseline justify-center gap-1 mt-0.5">
              <span className="text-xs font-black font-mono text-amber-400 uppercase">
                {adaptiveExp.previewQuality}
              </span>
            </div>
          </div>

          <div className="bg-neutral-900/80 rounded-xl p-2 border border-neutral-800/80">
            <span className="text-[10px] text-neutral-400 uppercase font-semibold block">Mobile Safe</span>
            <button
              onClick={() => adaptiveExp.setMobileSafeMode(!adaptiveExp.isMobileSafeMode)}
              className={`mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-md transition-all ${
                adaptiveExp.isMobileSafeMode ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-neutral-800 text-neutral-400"
              }`}
            >
              {adaptiveExp.isMobileSafeMode ? "SAFE ON" : "OFF"}
            </button>
          </div>
        </div>

        {/* Adaptive Quality Selector */}
        <div className="px-3 pb-2 pt-1">
          <div className="flex items-center justify-between mb-1 text-[10px] text-neutral-400 font-semibold">
            <span className="flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3 text-rose-400" />
              Manual Override:
            </span>
            <span className="text-rose-400 font-bold">{metrics.adaptiveQuality}</span>
          </div>

          <div className="grid grid-cols-5 gap-1 bg-neutral-900 p-0.5 rounded-lg border border-neutral-800">
            {(["AUTO", "HIGH", "MEDIUM", "LOW", "PROXY"] as ProxyQuality[]).map((q) => {
              const active = metrics.adaptiveQuality === q;
              return (
                <button
                  key={q}
                  onClick={() => handleSelectQuality(q)}
                  className={`py-1 text-[9px] font-bold rounded-md transition-all ${
                    active
                      ? "bg-rose-500 text-white shadow-xs"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                  }`}
                >
                  {q}
                </button>
              );
            })}
          </div>
        </div>

        {/* Expanded Diagnostics & Queue Details */}
        {isExpanded && (
          <div className="px-3 pb-3 pt-2 border-t border-neutral-800/80 space-y-2.5 text-[11px] animate-in fade-in duration-200">
            {/* Device & Experience Capabilities */}
            <div className="bg-neutral-900/60 p-2 rounded-xl border border-neutral-800/80 space-y-1">
              <div className="flex items-center justify-between text-neutral-400 text-[10px] font-bold">
                <span className="flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-indigo-400" />
                  Adaptive Device Capabilities
                </span>
                <span className="text-emerald-400 font-mono">
                  {adaptiveExp.capabilities.viewportWidth}x{adaptiveExp.capabilities.viewportHeight}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[9px] text-neutral-400 font-mono">
                <div>Device Class: <span className="text-white font-bold">{adaptiveExp.deviceClass}</span></div>
                <div>Interaction: <span className="text-white font-bold">{adaptiveExp.interactionMode}</span></div>
                <div>Waveform: <span className="text-white font-bold">{adaptiveExp.waveformDensity}</span></div>
                <div>Thumbnails: <span className="text-white font-bold">{adaptiveExp.thumbnailDensity}</span></div>
                <div>WebCodecs: <span className="text-emerald-400 font-bold">{adaptiveExp.capabilities.webCodecsAvailable ? "YES" : "NO"}</span></div>
                <div>Orientation: <span className="text-white font-bold">{adaptiveExp.orientation}</span></div>
              </div>
            </div>

            {/* AI Job Queue Status */}
            <div className="bg-neutral-900/60 p-2 rounded-xl border border-neutral-800/80 space-y-1.5">
              <div className="flex items-center justify-between text-neutral-300 font-bold text-[10px]">
                <span className="flex items-center gap-1">
                  <Activity className="w-3 h-3 text-amber-400" />
                  Background AI Jobs ({jobs.length})
                </span>
                <span className="text-[9px] text-neutral-400 font-normal">
                  {runningJobs.length} active, {queuedJobs.length} queued
                </span>
              </div>

              {jobs.length === 0 ? (
                <p className="text-[10px] text-neutral-500 italic">Queue idle • Playback at full bandwidth</p>
              ) : (
                <div className="max-h-24 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {jobs.slice(0, 4).map((j) => (
                    <div
                      key={j.job_id}
                      className="flex items-center justify-between text-[10px] bg-neutral-950/80 px-2 py-1 rounded-md border border-neutral-800"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            j.status === "running"
                              ? "bg-amber-400 animate-pulse"
                              : j.status === "completed"
                              ? "bg-emerald-400"
                              : j.status === "paused"
                              ? "bg-rose-400"
                              : "bg-neutral-500"
                          }`}
                        />
                        <span className="font-semibold text-neutral-300 truncate">{j.type}</span>
                      </div>
                      <span className="text-[9px] font-mono font-bold text-neutral-400">
                        {j.status === "completed" ? "100%" : `${j.progress}%`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


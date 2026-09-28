import React, { useState, useEffect, useRef } from "react";
import {
  Download,
  FileVideo,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Play,
  Square,
  Sparkles,
  Layers,
  History,
  FileText,
  Check,
  AlertCircle
} from "lucide-react";
import { 
  ExportPresetId, 
  RenderJobStatus, 
  ExportHistoryItem, 
  RenderPlan 
} from "../types/renderEngine";
import { EXPORT_PRESETS, RenderEngineManager } from "../utils/renderEngineManager";
import { VideoProjectSettings } from "../types";
import { RenderBackendSelector } from "../render/RenderBackendSelector";
import { RenderBackend } from "../render/RenderBackend";
import { RenderProgressInfo } from "../render/renderCapabilities";
import { coreEngine } from "../core";

interface ProfessionalExportCenterProps {
  isOpen: boolean;
  onClose: () => void;
  settings: VideoProjectSettings;
  duration: number;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  language: "sk" | "en";
  projectId: string;
  showToast: (msg: string, type?: "success" | "info" | "warning") => void;
}

export const ProfessionalExportCenter: React.FC<ProfessionalExportCenterProps> = ({
  isOpen,
  onClose,
  settings,
  duration,
  canvasRef,
  videoRef,
  language,
  projectId,
  showToast,
}) => {
  const isSk = language === "sk";
  const [selectedPreset, setSelectedPreset] = useState<ExportPresetId>("SOCIAL_VERTICAL");
  const [renderPlan, setRenderPlan] = useState<RenderPlan | null>(null);
  const [jobStatus, setJobStatus] = useState<RenderJobStatus | "IDLE">("IDLE");
  const [progressInfo, setProgressInfo] = useState<RenderProgressInfo>({
    status: "QUEUED",
    currentFrame: 0,
    totalFrames: 0,
    percentage: 0,
    elapsedSeconds: 0,
    estimatedRemainingSeconds: 0,
    renderFps: 0,
    backendUsed: "REALTIME_CANVAS_FALLBACK",
  });
  const [qcResult, setQcResult] = useState<any | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<"export" | "history" | "academy">("export");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [missingAssets, setMissingAssets] = useState<any[]>([]);
  const activeBackendRef = useRef<RenderBackend | null>(null);

  const checkOriginalMediaMissing = () => {
    const project = coreEngine.getProject();
    const referencedAssetIds = new Set<string>();
    project.tracks.forEach(track => {
      track.clips.forEach(clip => {
        if (clip.assetId) {
          referencedAssetIds.add(clip.assetId);
        }
      });
    });

    const missing = project.assets.filter(asset => 
      referencedAssetIds.has(asset.id) && 
      (asset.onlineState === "OFFLINE" || asset.onlineState === "MISSING" || asset.status === "OFFLINE" || asset.status === "MISSING")
    );

    return missing;
  };

  useEffect(() => {
    if (isOpen) {
      const plan = RenderEngineManager.createRenderPlan(projectId, selectedPreset, undefined, undefined, undefined, {
      trackSubject: settings.autoReframeFace,
    });
      setRenderPlan(plan);
      setExportHistory(RenderEngineManager.getExportHistory(projectId));

      const missing = checkOriginalMediaMissing();
      setMissingAssets(missing);
    } else {
      setMissingAssets([]);
    }
  }, [isOpen, selectedPreset, projectId]);

  if (!isOpen) return null;

  if (missingAssets.length > 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 text-neutral-100">
        <div className="relative w-full max-w-lg rounded-2xl border border-red-500/30 bg-neutral-900 p-6 shadow-2xl space-y-6 animate-in fade-in duration-200">
          
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-neutral-800 pb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-500 shadow-lg shadow-red-500/10 shrink-0">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-['Fraunces'] text-base font-black text-red-400 uppercase tracking-tight leading-none">
                ORIGINAL MEDIA MISSING
              </h3>
              <p className="text-xs text-neutral-400 mt-1.5">
                {isSk
                  ? "Tento projekt nemôže byť exportovaný v plnej kvalite."
                  : "This project cannot be exported at full quality because one or more original source files are unavailable."}
              </p>
            </div>
          </div>

          {/* Explanation Body */}
          <div className="space-y-4 text-xs leading-relaxed">
            <div className="space-y-1">
              <span className="block font-bold text-neutral-400 uppercase tracking-wider text-[10px]">{isSk ? "ČO:" : "WHAT:"}</span>
              <p className="text-neutral-300">
                {isSk
                  ? "Originálne médiá pre jeden alebo viacero klipov na časovej osi nie sú dostupné."
                  : "The original media for one or more clips is missing."}
              </p>
            </div>

            <div className="space-y-1">
              <span className="block font-bold text-neutral-400 uppercase tracking-wider text-[10px]">{isSk ? "PREČO:" : "WHY:"}</span>
              <p className="text-neutral-300">
                {isSk
                  ? "Finálny export nesmie ticho použiť nízko-rozlíšenú proxy verziu."
                  : "Final export must not silently use a low-resolution proxy."}
              </p>
            </div>

            <div className="space-y-1">
              <span className="block font-bold text-neutral-400 uppercase tracking-wider text-[10px]">{isSk ? "ČO ROBIŤ:" : "WHAT TO DO:"}</span>
              <p className="text-neutral-300">
                {isSk
                  ? "Znovu prepojte (Relink) chýbajúce originálne médiá v Správcovi médií."
                  : "Relink the missing original media."}
              </p>
            </div>
          </div>

          {/* List of missing assets */}
          <div className="p-3.5 bg-neutral-950/60 rounded-xl border border-neutral-800 space-y-1.5 max-h-24 overflow-y-auto custom-scrollbar">
            {missingAssets.map(asset => (
              <div key={asset.id} className="flex justify-between text-[11px] text-neutral-400">
                <span className="truncate font-semibold text-neutral-300">{asset.name}</span>
                <span className="shrink-0 text-red-500 font-bold uppercase text-[9px] px-1.5 py-0.5 bg-red-500/10 rounded">{isSk ? "CHÝBA" : "OFFLINE"}</span>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => {
                onClose();
                showToast(isSk ? "📂 Prejdite do sekcie Toolbox -> Správca médií pre Relink." : "📂 Navigate to Toolbox -> Media Manager to relink.", "info");
              }}
              className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/25 transition-all text-center cursor-pointer"
            >
              {isSk ? "Znovu prepojiť súbory (Relink)" : "Locate Media"}
            </button>
            
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white font-semibold text-xs transition-colors text-center cursor-pointer"
            >
              {isSk ? "Zrušiť export" : "Cancel Export"}
            </button>
          </div>

        </div>
      </div>
    );
  }

  const handlePresetChange = (presetId: ExportPresetId) => {
    setSelectedPreset(presetId);
    const plan = RenderEngineManager.createRenderPlan(projectId, presetId, undefined, undefined, undefined, {
      trackSubject: settings.autoReframeFace,
    });
    setRenderPlan(plan);
  };

  const handleStartExport = async () => {
    if (!renderPlan) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video) {
      setErrorMessage(isSk ? "Chýba plátno alebo video element na render." : "Canvas or video element missing for render.");
      return;
    }

    try {
      setJobStatus("PREPARING");
      setDownloadUrl(null);
      setErrorMessage(null);
      setQcResult(null);

      // Verify EDL unchanged during prep
      const currentPlan = RenderEngineManager.createRenderPlan(projectId, selectedPreset, undefined, undefined, undefined, {
      trackSubject: settings.autoReframeFace,
    });
      if (currentPlan.edlVersion !== renderPlan.edlVersion) {
        setJobStatus("FAILED");
        const err = RenderEngineManager.getErrorMessage("EDL_CHANGED");
        setErrorMessage(isSk ? err.sk : err.en);
        return;
      }

      const backend = await RenderBackendSelector.selectBackend(renderPlan);
      activeBackendRef.current = backend;

      await backend.prepare(renderPlan, (info) => {
        setProgressInfo(info);
        setJobStatus(info.status as any);
      });

      const artifact = await backend.render(renderPlan, canvas, video, (info) => {
        setProgressInfo(info);
        setJobStatus(info.status as any);
      });

      setDownloadUrl(artifact.blobUrl);
      setJobStatus("COMPLETED");

      const historyItem: ExportHistoryItem = {
        id: artifact.id,
        projectId,
        fileName: `OmniStrih_${renderPlan.presetId}_v${renderPlan.edlVersion}.webm`,
        preset: renderPlan.presetId,
        resolution: `${renderPlan.outputWidth}x${renderPlan.outputHeight}`,
        fps: renderPlan.fps,
        duration: renderPlan.timelineDuration,
        edlVersion: renderPlan.edlVersion,
        dnaVersion: renderPlan.dnaVersion,
        status: "COMPLETED",
        qcStatus: artifact.qcStatus,
        createdAt: new Date().toLocaleTimeString(),
        fileUrl: artifact.blobUrl,
        fileSize: artifact.fileSize,
        audioLoudness: artifact.audioLoudness
          ? {
              integratedLufs: artifact.audioLoudness.integratedLufs,
              truePeakDbfs: artifact.audioLoudness.truePeakDbfs,
              targetLufs: artifact.audioLoudness.targetLufs,
              appliedGainDb: artifact.audioLoudness.appliedGainDb,
              normalizationApplied: artifact.audioLoudness.normalizationApplied,
              audioTrackIncluded: artifact.audioLoudness.audioTrackIncluded,
            }
          : undefined,
      };

      RenderEngineManager.addExportHistoryItem(projectId, historyItem);
      setExportHistory(RenderEngineManager.getExportHistory(projectId));
      showToast(isSk ? "Profesionálny render úspešne dokončený!" : "Professional render completed successfully!", "success");

    } catch (err: any) {
      console.error("Render error:", err);
      setJobStatus("FAILED");
      const errCode = err.message === "EDL_CHANGED" ? "EDL_CHANGED" : err.message === "QC_FAILED" ? "QC_FAILED" : err.message === "EXPORT_CANCELLED" ? "EXPORT_CANCELLED" : "ENCODE_FAILED";
      const errInfo = RenderEngineManager.getErrorMessage(errCode as any);
      setErrorMessage(isSk ? errInfo.sk : errInfo.en);
    }
  };

  const handleCancelExport = async () => {
    if (activeBackendRef.current) {
      await activeBackendRef.current.cancel();
    }
    setJobStatus("CANCELLED");
    const errInfo = RenderEngineManager.getErrorMessage("EXPORT_CANCELLED");
    setErrorMessage(isSk ? errInfo.sk : errInfo.en);
    showToast(isSk ? "Export bol zrušený" : "Export cancelled", "warning");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-neutral-100">
      <div className="relative w-full max-w-2xl rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <FileVideo className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-100">
                {isSk ? "Professional Render & Export Engine (Phase 5.2)" : "Professional Render & Export Engine (Phase 5.2)"}
              </h2>
              <p className="text-xs text-neutral-400">
                {isSk ? "Frame-akurate offline render pipeline s QC bránou a backend selektorom." : "Frame-accurate offline render pipeline with QC gate & backend selector."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs font-semibold">
              <button
                onClick={() => setActiveTab("export")}
                className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === "export" ? "bg-purple-600 text-white" : "text-neutral-400 hover:text-neutral-200"}`}
              >
                {isSk ? "Export" : "Export"}
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === "history" ? "bg-purple-600 text-white" : "text-neutral-400 hover:text-neutral-200"}`}
              >
                {isSk ? "História" : "History"}
              </button>
              <button
                onClick={() => setActiveTab("academy")}
                className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === "academy" ? "bg-purple-600 text-white" : "text-neutral-400 hover:text-neutral-200"}`}
              >
                {isSk ? "🎓 Teach Me Export" : "🎓 Teach Me Export"}
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-neutral-200"
            >
              ✕
            </button>
          </div>
        </div>

        {activeTab === "export" ? (
          <div className="space-y-5">
            {/* Presets Grid */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                {isSk ? "Výstupné Presety" : "Export Presets"}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.keys(EXPORT_PRESETS) as ExportPresetId[]).map((pid) => {
                  const preset = EXPORT_PRESETS[pid];
                  const isSelected = selectedPreset === pid;

                  return (
                    <button
                      key={pid}
                      disabled={jobStatus !== "IDLE" && jobStatus !== "COMPLETED" && jobStatus !== "FAILED" && jobStatus !== "CANCELLED"}
                      onClick={() => handlePresetChange(pid)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "bg-purple-950/30 border-purple-500 text-purple-300 shadow-md shadow-purple-500/10"
                          : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      <div className="font-bold text-xs text-neutral-200">{preset.name}</div>
                      <div className="text-[10px] font-mono text-neutral-400 mt-1">{preset.width} × {preset.height} ({preset.fps}fps)</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* RenderPlan Summary */}
            {renderPlan && (
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2 text-xs">
                <div className="flex justify-between text-neutral-400">
                  <span>{isSk ? "EDL Verzia:" : "EDL Version:"}</span>
                  <span className="font-mono text-purple-400 font-bold">v{renderPlan.edlVersion}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>{isSk ? "Edit DNA Verzia:" : "Edit DNA Version:"}</span>
                  <span className="font-mono text-emerald-400 font-bold">v{renderPlan.dnaVersion}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>{isSk ? "Odhadovaná dĺžka:" : "Estimated Duration:"}</span>
                  <span className="font-mono text-neutral-200 font-bold">{renderPlan.timelineDuration.toFixed(1)}s</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>{isSk ? "Render Backend:" : "Render Backend:"}</span>
                  <span className="font-mono text-indigo-400 font-bold">
                    {progressInfo.backendUsed === "OFFLINE_WEBCODECS" ? "WebCodecs Offline Frame-Accurate" : "Realtime Canvas + MediaRecorder (Fallback)"}
                  </span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>{isSk ? "Render Režim:" : "Render Mode:"}</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {progressInfo.backendUsed === "OFFLINE_WEBCODECS" ? "OFFLINE FRAME-ACCURATE" : "REALTIME_FALLBACK"}
                  </span>
                </div>
              </div>
            )}

            {/* Progress / Status */}
            {jobStatus !== "IDLE" && (
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-neutral-300 uppercase tracking-wide">
                    {jobStatus === "PREPARING" && (isSk ? "Príprava RenderPlanu..." : "Preparing Render Plan...")}
                    {jobStatus === "RENDERING_VIDEO" && (isSk ? `Renderovanie rámcov (${progressInfo.currentFrame}/${progressInfo.totalFrames})...` : `Rendering frames (${progressInfo.currentFrame}/${progressInfo.totalFrames})...`)}
                    {jobStatus === "MUXING" && (isSk ? "Muxing výstupného kontajnera..." : "Muxing streams...")}
                    {jobStatus === "QC" && (isSk ? "Prebieha QC Gate kontrola..." : "Running QC Gate check...")}
                    {jobStatus === "COMPLETED" && (isSk ? "Export hotový!" : "Export completed!")}
                    {jobStatus === "FAILED" && (isSk ? "Export zlyhal" : "Export failed")}
                    {jobStatus === "CANCELLED" && (isSk ? "Export zrušený" : "Export cancelled")}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-neutral-400">
                      {progressInfo.renderFps} FPS | {progressInfo.elapsedSeconds.toFixed(1)}s
                    </span>
                    <span className="font-mono font-bold text-purple-400">{progressInfo.percentage}%</span>
                  </div>
                </div>

                <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${jobStatus === "FAILED" ? "bg-rose-500" : "bg-purple-600"}`}
                    style={{ width: `${progressInfo.percentage}%` }}
                  />
                </div>

                {errorMessage && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              {jobStatus === "IDLE" || jobStatus === "COMPLETED" || jobStatus === "FAILED" || jobStatus === "CANCELLED" ? (
                <>
                  {downloadUrl && (
                    <a
                      href={downloadUrl}
                      download={`OmniStrih_${selectedPreset}_v${renderPlan?.edlVersion || 1}.webm`}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-neutral-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
                    >
                      <Download className="w-4 h-4" />
                      {isSk ? "Stiahnuť Výstup (WebM)" : "Download Output (WebM)"}
                    </a>
                  )}

                  <button
                    onClick={handleStartExport}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-xl shadow-purple-600/20 transition-all"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    {isSk ? "Spustiť Offline Render" : "Start Offline Render"}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleCancelExport}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-xl shadow-rose-600/20 transition-all"
                >
                  <Square className="w-4 h-4 fill-current" />
                  {isSk ? "Zrušiť Render" : "Cancel Render"}
                </button>
              )}
            </div>
          </div>
        ) : activeTab === "history" ? (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              {isSk ? "História Exportov tohto Projektu" : "Project Export History"}
            </h3>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {exportHistory.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-500">
                  {isSk ? "Zatiaľ žiadne exporty v histórii." : "No exports in history yet."}
                </div>
              ) : (
                exportHistory.map((item) => (
                  <div key={item.id} className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="font-bold text-neutral-200">{item.fileName}</div>
                      <div className="text-[10px] font-mono text-neutral-400 flex items-center gap-2">
                        <span>Preset: {item.preset}</span>
                        <span>Res: {item.resolution}</span>
                        <span>EDL v{item.edlVersion}</span>
                        <span>
                          {item.audioLoudness
                            ? (item.audioLoudness.audioTrackIncluded
                                ? `Audio: ${item.audioLoudness.integratedLufs !== null ? `${item.audioLoudness.integratedLufs.toFixed(1)} LUFS` : "nemerané"} / ${item.audioLoudness.truePeakDbfs !== null ? `${item.audioLoudness.truePeakDbfs.toFixed(2)} dBTP` : "TP nemerané"}${item.audioLoudness.normalizationApplied ? ` (normalizované ${item.audioLoudness.appliedGainDb?.toFixed(2)} dB na ${item.audioLoudness.targetLufs} LUFS)` : ""}`
                                : "Audio: bez zvukovej stopy (mix sa nedal dekódovať)")
                            : "Audio: nemerané"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                        {item.qcStatus}
                      </span>
                      {item.fileUrl && (
                        <a
                           href={item.fileUrl}
                           download={item.fileName}
                           className="p-2 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-200 hover:text-white"
                        >
                           <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
            <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-950/20 text-xs flex gap-3">
              <span className="text-xl">🎓</span>
              <div>
                <h4 className="font-bold text-white mb-0.5">{isSk ? "Edit Academy: Veda o Exportovaní" : "Edit Academy: Science of Exporting"}</h4>
                <p className="text-neutral-400 leading-relaxed">
                  {isSk 
                    ? "Porozumejte technickým parametrom master súborov, kódovaniu a kompresným kompromisom pre sociálne siete."
                    : "Understand the technical specifications of master files, encoding, and compression trade-offs for social media."}
                </p>
              </div>
            </div>

            {/* Parameter Explanations */}
            <div className="space-y-4 text-xs">
              {/* 1. CODEC & CONTAINER */}
              <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-950/50 space-y-2">
                <span className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-widest block">RULE #1 — CODEC & CONTAINER</span>
                <h4 className="text-sm font-black text-white uppercase">{isSk ? "VP9/Opus (WebM) vs. H.264/AAC (MP4)" : "VP9/Opus (WebM) vs. H.264/AAC (MP4)"}</h4>
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1">
                    <span className="font-bold text-neutral-300 uppercase block text-[9px]">{isSk ? "WHAT (Čo to je):" : "WHAT:"}</span>
                    <p className="text-neutral-400 leading-relaxed">VP9 je moderný, vysoko kompresný otvorený video kodek; H.264 je priemyselný štandard s najširšou hardvérovou podporou.</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-neutral-300 uppercase block text-[9px]">{isSk ? "WHY (Prečo na tom záleží):" : "WHY:"}</span>
                    <p className="text-neutral-400 leading-relaxed">Určuje rýchlosť načítania videa divákom na internete, kompatibilitu s prehrávačmi a úsporu mobilných dát.</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-neutral-300 uppercase block text-[9px]">{isSk ? "WHEN (Kedy použiť):" : "WHEN:"}</span>
                    <p className="text-neutral-400 leading-relaxed">VP9 je excelentné pre YouTube a moderné webové prehrávače, nakoľko udržiava čisté detaily textu.</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-neutral-300 uppercase block text-[9px]">{isSk ? "WHEN NOT (Kedy nepoužiť):" : "WHEN NOT:"}</span>
                    <p className="text-neutral-400 leading-relaxed">Nepoužívajte VP9 (WebM) ak doručujete súbor starším iOS zariadeniam alebo legacy televíznym systémom.</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-neutral-300 uppercase block text-[9px]">{isSk ? "TRADE-OFF (Kompromis):" : "TRADE-OFF:"}</span>
                    <p className="text-neutral-400 leading-relaxed">VP9 šetrí 35% veľkosti oproti H.264 pri identickej kvalite, ale kódovanie vyžaduje modernejší procesor.</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-neutral-300 uppercase block text-[9px]">{isSk ? "HOW (Ako nastaviť):" : "HOW:"}</span>
                    <p className="text-neutral-400 leading-relaxed">OmniStrih automaticky vyberá optimálny kodek na základe podpory vášho webového prehliadača (WebCodecs).</p>
                  </div>
                </div>
              </div>

              {/* 2. RESOLUTION & ASPECT RATIO */}
              <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-950/50 space-y-2">
                <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest block">RULE #2 — RESOLUTION & ASPECT RATIO</span>
                <h4 className="text-sm font-black text-white uppercase">{isSk ? "Mierka & Rozlíšenie (Vertical vs. Landscape)" : "Aspect Ratios & Dimensions (Vertical vs. Landscape)"}</h4>
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1">
                    <span className="font-bold text-neutral-300 uppercase block text-[9px]">{isSk ? "WHAT (Čo to je):" : "WHAT:"}</span>
                    <p className="text-neutral-400 leading-relaxed">Fyzický počet horizontálnych a vertikálnych bodov (pixelov) vo video matici.</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-neutral-300 uppercase block text-[9px]">{isSk ? "WHY (Prečo na tom záleží):" : "WHY:"}</span>
                    <p className="text-neutral-400 leading-relaxed">Zabraňuje čiernym pruhom na stranách obrazovky na rôznych typoch mobilných a desktopových zariadení.</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-neutral-300 uppercase block text-[9px]">{isSk ? "WHEN (Kedy použiť):" : "WHEN:"}</span>
                    <p className="text-neutral-400 leading-relaxed">9:16 (1080×1920) pre TikTok, Reels, Shorts; 16:9 (1920×1080) pre štandardný YouTube na stolných PC.</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-neutral-300 uppercase block text-[9px]">{isSk ? "WHEN NOT (Kedy nepoužiť):" : "WHEN NOT:"}</span>
                    <p className="text-neutral-400 leading-relaxed">Nikdy neexportujte 9:16 video ak je doručované na klasický TV prijímač.</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-neutral-300 uppercase block text-[9px]">{isSk ? "TRADE-OFF (Kompromis):" : "TRADE-OFF:"}</span>
                    <p className="text-neutral-400 leading-relaxed">4K poskytuje perfektné detaily, ale vyžaduje dramaticky dlhší čas renderovania a spôsobuje rýchlejšie zaplnenie disku.</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-neutral-300 uppercase block text-[9px]">{isSk ? "HOW (Ako nastaviť):" : "HOW:"}</span>
                    <p className="text-neutral-400 leading-relaxed">Zvoľte príslušný preset (napr. 'Social Vertical') v zozname presetov pred kliknutím na štart renderu.</p>
                  </div>
                </div>
              </div>

              {/* 3. AUDIO SAMPLE RATE & LOUDNESS */}
              <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-950/50 space-y-2">
                <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest block">RULE #3 — LOUDNESS & SAMPLE RATE</span>
                <h4 className="text-sm font-black text-white uppercase">{isSk ? "Hlasitosť -14 LUFS & Vzorkovanie 48kHz" : "Loudness Standards (-14 LUFS) & 48kHz Sampling"}</h4>
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1">
                    <span className="font-bold text-neutral-300 uppercase block text-[9px]">{isSk ? "WHAT (Čo to je):" : "WHAT:"}</span>
                    <p className="text-neutral-400 leading-relaxed">Integrované meranie priemernej vnímanej hlasitosti ľudským sluchom a frekvencia vzorkovania audia.</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-neutral-300 uppercase block text-[9px]">{isSk ? "WHY (Prečo na tom záleží):" : "WHY:"}</span>
                    <p className="text-neutral-400 leading-relaxed">Predchádza tomu, aby algoritmus sociálnej siete (TikTok/YouTube) vaše video automaticky stíšil.</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-neutral-300 uppercase block text-[9px]">{isSk ? "WHEN (Kedy použiť):" : "WHEN:"}</span>
                    <p className="text-neutral-400 leading-relaxed">Vždy doručujte hlasitosť na hladine -14 LUFS pre internetové platformy s čistou vzorkou 44.1kHz alebo 48kHz.</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-neutral-300 uppercase block text-[9px]">{isSk ? "WHEN NOT (Kedy nepoužiť):" : "WHEN NOT:"}</span>
                    <p className="text-neutral-400 leading-relaxed">Nepoužívajte nízky audio bitrate pod 96kbps, inak bude reč znieť plechovo a neprirodzene.</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-neutral-300 uppercase block text-[9px]">{isSk ? "TRADE-OFF (Kompromis):" : "TRADE-OFF:"}</span>
                    <p className="text-neutral-400 leading-relaxed">Maximálny limiter chráni pred praskaním zvuku (clipping), ale mierne splošťuje dynamiku dramatických tichých momentov.</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-neutral-300 uppercase block text-[9px]">{isSk ? "HOW (Ako nastaviť):" : "HOW:"}</span>
                    <p className="text-neutral-400 leading-relaxed">OmniStrih integrovaný obmedzovač (limiter) a normalizátor automaticky zarovná audio na -14 LUFS s peakom pod -0.1dBFS.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};


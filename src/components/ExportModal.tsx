import React, { useState, useEffect } from "react";
import {
  X,
  Download,
  CheckCircle2,
  ShieldCheck,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";
import { VideoProjectSettings, VideoAspectRatio } from "../types";
import { RenderBackendSelector } from "../render/RenderBackendSelector";
import { RenderEngineManager } from "../utils/renderEngineManager";
import { coreEngine } from "../core";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: VideoProjectSettings;
  duration: number;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  language: "sk" | "en";
  showToast?: (msg: string, type?: "success" | "info" | "warning") => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  settings,
  duration,
  canvasRef,
  videoRef,
  language,
  showToast,
}) => {
  const isSk = language === "sk";
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingAssets, setMissingAssets] = useState<any[]>([]);
  const activeBackendRef = React.useRef<any>(null);

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
      const missing = checkOriginalMediaMissing();
      setMissingAssets(missing);
    } else {
      setMissingAssets([]);
      setError(null);
      setExportProgress(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  if (missingAssets.length > 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
        <div className="relative w-full max-w-lg rounded-2xl border border-red-500/30 bg-neutral-900 p-6 shadow-2xl space-y-6 text-neutral-100 animate-in fade-in duration-200">
          
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
                if (showToast) {
                  showToast(isSk ? "📂 Prejdite do sekcie Toolbox -> Správca médií pre Relink." : "📂 Navigate to Toolbox -> Media Manager to relink.", "info");
                }
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

  const resolutionMap: Record<VideoAspectRatio, string> = {
    "9:16": "1080 × 1920 (Full HD Vertical)",
    "16:9": "1920 × 1080 (Full HD Landscape)",
    "1:1": "1080 × 1080 (Square 1:1)",
    "4:5": "1080 × 1350 (Instagram Portrait)",
  };

  const handleStartExport = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      setError(isSk ? "Chýba plátno alebo video element na render." : "Canvas or video element missing for render.");
      return;
    }

    try {
      setIsExporting(true);
      setError(null);
      setExportProgress(0);
      setDownloadUrl(null);

      // 1. Determine Dimensions
      const dim = resolutionMap[settings.aspectRatio].split(" × ");
      const width = parseInt(dim[0]);
      const height = parseInt(dim[1]);

      // 2. Generate immutable canonical RenderPlan
      const project = coreEngine.getProject();
      const plan = RenderEngineManager.createRenderPlan(project.id, "CUSTOM", width, height);

      // 3. Select appropriate rendering backend (WebCodecs Offline / Realtime Fallback)
      const backend = await RenderBackendSelector.selectBackend(plan);
      activeBackendRef.current = backend;

      // 4. Run real-time/offline multi-track composition render pipeline
      await backend.prepare(plan, (info) => {
        setExportProgress(Math.min(95, Math.round(info.percentage * 0.95)));
      });

      const artifact = await backend.render(plan, canvas, video, (info) => {
        setExportProgress(Math.min(95, info.percentage));
      });

      const url = artifact.blobUrl;
      setDownloadUrl(url);
      setIsExporting(false);
      setExportProgress(100);

      // Auto trigger browser download
      const a = document.createElement("a");
      a.href = url;
      a.download = `omnistrih-${settings.aspectRatio.replace(":", "x")}-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      console.error("Export error:", err);
      setError(err.message === "QC_FAILED" 
        ? (isSk ? "QC Kontrola zlyhala: Výstup nesplnil kvalitatívne nároky." : "QC Check failed: Output failed quality requirements.")
        : err.message || (isSk ? "Export zlyhal" : "Export failed"));
      setIsExporting(false);
    }
  };

  const handleCancelExport = async () => {
    if (activeBackendRef.current) {
      await activeBackendRef.current.cancel();
    }
    setIsExporting(false);
    setExportProgress(0);
  };

  const proStylePrompt = `TASK: Visual edit only. Preserve exact voiceover and original audio.
STYLE: Editorial newspaper collage, 12fps agile stop-motion, fast kinetic pop-up typography, dynamic fast zooms and punch-ins, mixed media paper textures and polaroids. 
FEEL: Energetic, bold, tactile, viral high-retention.`;

  const copyPrompt = () => {
    navigator.clipboard.writeText(proStylePrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-5 sm:p-6 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isExporting}
          className="absolute top-4 right-4 rounded-xl p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-all disabled:opacity-30"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white shadow-md shadow-rose-500/20">
            <Download className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-['Fraunces'] text-lg font-bold text-white">
              {isSk ? "Export Videa Bez Poplatkov" : "Free Video Export"}
            </h3>
            <p className="text-xs text-neutral-400">
              {isSk
                ? "Všetky efekty, zoom a titulky priamo zapečené do videa"
                : "Captions, zooms, SFX & bokeh baked directly into MP4"}
            </p>
          </div>
        </div>

        {/* Ultimatum & Zero-Cost Guarantee */}
        <div className="mb-4 rounded-xl border border-emerald-800/80 bg-emerald-950/30 p-3 flex items-start gap-2.5">
          <ShieldCheck className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-emerald-300">
              {isSk
                ? "Splnené Ultimátum: 0€ Navždy!"
                : "Ultimatum Fulfilled: $0 Forever!"}
            </span>
            <p className="text-emerald-400/80 mt-0.5">
              {isSk
                ? "Žiadne mesačné platby za Submagic ($50/mes) ani CapCut Pro. Render beží lokálne v tvojom prehliadači bez vodoznaku."
                : "No monthly subscriptions. Rendering runs directly in your browser with zero watermarks."}
            </p>
          </div>
        </div>

        {/* Video Specs Summary */}
        <div className="mb-5 rounded-xl border border-neutral-800 bg-neutral-950/70 p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between text-neutral-300">
            <span className="text-neutral-400">{isSk ? "Formát:" : "Aspect Ratio:"}</span>
            <span className="font-bold text-white">{settings.aspectRatio}</span>
          </div>
          <div className="flex items-center justify-between text-neutral-300">
            <span className="text-neutral-400">{isSk ? "Rozlíšenie:" : "Resolution:"}</span>
            <span className="font-mono text-neutral-200">
              {resolutionMap[settings.aspectRatio]}
            </span>
          </div>
          <div className="flex items-center justify-between text-neutral-300">
            <span className="text-neutral-400">{isSk ? "Submagic Titulky:" : "Captions:"}</span>
            <span className="font-semibold text-rose-400">
              {settings.captionsEnabled ? settings.captionStyle : "Vypnuté"}
            </span>
          </div>
          <div className="flex items-center justify-between text-neutral-300">
            <span className="text-neutral-400">{isSk ? "CapCut Smart Zoom:" : "Auto-Zoom:"}</span>
            <span className="font-semibold text-amber-400">
              {settings.autoZoomEnabled ? `${settings.zoomIntensity}x Punch-In` : "Vypnuté"}
            </span>
          </div>
          <div className="flex items-center justify-between text-neutral-300">
            <span className="text-neutral-400">{isSk ? "Guma / Pozadie:" : "Background:"}</span>
            <span className="font-semibold text-indigo-400">
              {settings.backgroundMode}
            </span>
          </div>
        </div>

        {/* Export Progress Bar */}
        {isExporting && (
          <div className="mb-5 space-y-2">
            <div className="flex justify-between text-xs font-semibold text-neutral-300">
              <span>{isSk ? "Renderujem video snímky..." : "Rendering video frames..."}</span>
              <span className="text-rose-400">{exportProgress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-neutral-800 overflow-hidden">
              <div
                style={{ width: `${exportProgress}%` }}
                className="h-full bg-gradient-to-r from-rose-500 to-amber-500 transition-all duration-300"
              />
            </div>
            <button
              onClick={handleCancelExport}
              className="w-full py-2 text-[10px] font-bold text-neutral-500 hover:text-rose-400 transition-colors uppercase tracking-widest"
            >
              {isSk ? "Zrušiť export" : "Cancel Export"}
            </button>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/50 bg-rose-500/10 p-3 flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold text-rose-300">
                {isSk ? "Chyba Exportu" : "Export Error"}
              </span>
              <p className="text-rose-400/80 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Download Success */}
        {downloadUrl && !isExporting && (
          <div className="mb-4 rounded-xl border border-emerald-500/50 bg-emerald-500/10 p-3 text-center space-y-2">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              {isSk ? "Video úspešne vyrenderované a stiahnuté!" : "Video rendered and downloaded!"}
            </div>
            <a
              href={downloadUrl}
              download={`autoclip-${Date.now()}.mp4`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500"
            >
              <Download className="h-3.5 w-3.5" />
              {isSk ? "Stiahnuť znova" : "Download again"}
            </a>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            id="start-render-download-btn"
            onClick={handleStartExport}
            disabled={isExporting}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 py-3 text-sm font-bold text-white shadow-lg shadow-rose-500/25 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>
              {isExporting
                ? isSk
                  ? "Spracúvam video..."
                  : "Rendering..."
                : isSk
                ? "Spustiť Render a Stiahnuť MP4 (0€)"
                : "Start Render & Download MP4 ($0)"}
            </span>
          </button>

          {/* Pro Style Collapsible / Prompt */}
          <div className="pt-3 border-t border-neutral-800 text-xs">
            <div className="flex items-center justify-between text-neutral-400 mb-1">
              <span>{isSk ? "Pro Prompt pre Google Flow (Editorial Collage):" : "Pro Prompt for Google Flow:"}</span>
              <button
                onClick={copyPrompt}
                className="flex items-center gap-1 text-rose-400 hover:text-rose-300 font-semibold"
              >
                {copiedPrompt ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span className="text-emerald-400">{isSk ? "Skopírované" : "Copied"}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>{isSk ? "Kopírovať" : "Copy"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

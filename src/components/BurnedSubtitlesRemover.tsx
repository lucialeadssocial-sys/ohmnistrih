import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Eraser,
  Sparkles,
  Square,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  Compass,
  Zap,
  Download,
  Check,
  RotateCcw,
  XCircle,
  Terminal,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { EraserZone, VideoProjectSettings } from "../types";
import {
  inpaintEraserZones,
  detectHardcodedSubtitles,
  processVideoInpaintingPipeline,
  InpaintProgressState,
} from "../utils/videoInpainter";

interface BurnedSubtitlesRemoverProps {
  settings: VideoProjectSettings;
  onChangeSettings: (settings: Partial<VideoProjectSettings>) => void;
  currentVideoUrl: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  language: "sk" | "en";
  showToast: (msg: string) => void;
  onSelectVideoUrl?: (url: string) => void;
  onUploadVideo?: (url: string, filename?: string) => void;
}

type JobStatus = "idle" | "queued" | "processing" | "completed" | "failed" | "cancelled";

export const BurnedSubtitlesRemover: React.FC<BurnedSubtitlesRemoverProps> = ({
  settings,
  onChangeSettings,
  currentVideoUrl,
  videoRef,
  currentTime,
  duration,
  onSeek,
  language,
  showToast,
  onSelectVideoUrl,
  onUploadVideo,
}) => {
  const isSk = language === "sk";
  const zones = settings.eraserZones || [];

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [comparisonMode, setComparisonMode] = useState<"side_by_side" | "toggle" | "result_only">("side_by_side");
  const [showOriginal, setShowOriginal] = useState(false);

  // Job & Processing State Machine
  const [jobStatus, setJobStatus] = useState<JobStatus>("idle");
  const [progressState, setProgressState] = useState<InpaintProgressState | null>(null);
  const [cleanVideoUrl, setCleanVideoUrl] = useState<string | null>(null);
  const [cleanBlob, setCleanBlob] = useState<Blob | null>(null);
  const [isPlayingResult, setIsPlayingResult] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStalledWarning, setIsStalledWarning] = useState<boolean>(false);

  // Real-time Debug Logs
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebugLogs, setShowDebugLogs] = useState<boolean>(false);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  // AbortController for instant cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastProgressTimestampRef = useRef<number>(Date.now());

  // Video ref for comparison/result video player
  const resultVideoCompareRef = useRef<HTMLVideoElement | null>(null);

  // Canvas refs for side-by-side comparison
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const inpaintedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const interactiveCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Drawing state
  const [isDrawingNewBox, setIsDrawingNewBox] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [draggingZoneId, setDraggingZoneId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [resizingZoneId, setResizingZoneId] = useState<string | null>(null);

  const appendLog = useCallback((logMsg: string) => {
    setDebugLogs((prev) => [...prev.slice(-150), logMsg]);
  }, []);

  useEffect(() => {
    if (showDebugLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [debugLogs, showDebugLogs]);

  // Watchdog timer to detect stalled operations (>25 seconds without progress)
  useEffect(() => {
    if (jobStatus !== "processing") {
      setIsStalledWarning(false);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastProgressTimestampRef.current > 25000) {
        setIsStalledWarning(true);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [jobStatus]);

  // Preset default bottom subtitle mask
  const handleAddDefaultSubtitleMask = () => {
    const newZone: EraserZone = {
      id: `sub-mask-${Date.now()}`,
      name: isSk ? "Maska pre vypálené titulky" : "Burned Subtitle Mask",
      type: "subtitles",
      x: 0.1,
      y: 0.78,
      width: 0.8,
      height: 0.14,
      enabled: true,
      feather: 4,
      isTracking: true,
    };
    const updated = [...zones, newZone];
    onChangeSettings({
      eraserEnabled: true,
      eraserZones: updated,
    });
    setSelectedZoneId(newZone.id);
    showToast(isSk ? "Pridaná nová obdĺžniková maska titulkov." : "Added new rectangular subtitle mask.");
    appendLog(`[ACTION] Added subtitle mask [${newZone.id}] at y=78%, h=14%`);
  };

  // Auto-detect hardcoded subtitles
  const handleAutoDetectSubtitles = async () => {
    const video = videoRef.current;
    if (!video) {
      showToast(isSk ? "Video nie je načítané." : "Video is not loaded.");
      return;
    }

    setIsAutoDetecting(true);
    appendLog("[AI DETECT] Scanning video frame for hardcoded subtitle contrast clusters...");

    try {
      // 1. Try Gemini Vision server endpoint if available
      const offscreen = document.createElement("canvas");
      offscreen.width = video.videoWidth || 1280;
      offscreen.height = video.videoHeight || 720;
      const ctx = offscreen.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
        const imageBase64 = offscreen.toDataURL("image/jpeg", 0.85);

        try {
          const res = await fetch("/api/detect-burned-subtitles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64 }),
          });
          const data = await res.json();

          if (data.success && data.detected && Array.isArray(data.boundingBoxes) && data.boundingBoxes.length > 0) {
            const newZones: EraserZone[] = data.boundingBoxes.map((box: any, idx: number) => ({
              id: `ai-sub-${Date.now()}-${idx}`,
              name: isSk ? `AI Detegovaný Titulok ${idx + 1}` : `AI Detected Subtitle ${idx + 1}`,
              type: "subtitles",
              x: Math.max(0, Math.min(0.9, Number(box.x) || 0.1)),
              y: Math.max(0, Math.min(0.9, Number(box.y) || 0.78)),
              width: Math.max(0.05, Math.min(1, Number(box.width) || 0.8)),
              height: Math.max(0.03, Math.min(0.5, Number(box.height) || 0.14)),
              enabled: true,
              feather: 4,
              isTracking: true,
            }));

            const updated = [...zones, ...newZones];
            onChangeSettings({ eraserEnabled: true, eraserZones: updated });
            setSelectedZoneId(newZones[0].id);
            setIsAutoDetecting(false);
            appendLog(`[AI DETECT SUCCESS] Server AI identified ${newZones.length} subtitle region(s).`);
            showToast(isSk ? `✨ AI detegovalo ${newZones.length} oblasť(í) s vypáleným textom!` : `✨ AI detected ${newZones.length} burned subtitle area(s)!`);
            return;
          }
        } catch {
          // Fall through to local detector
        }
      }

      // 2. Client-side edge/contrast computer vision detector
      const detectedZone = await detectHardcodedSubtitles(video, video.videoWidth || 1280, video.videoHeight || 720);
      if (detectedZone) {
        detectedZone.name = isSk ? "AI Detegované Titulky" : "AI Detected Subtitles";
        const updated = [...zones, detectedZone];
        onChangeSettings({ eraserEnabled: true, eraserZones: updated });
        setSelectedZoneId(detectedZone.id);
        appendLog(`[AI DETECT SUCCESS] Computer vision detected subtitle bounds: [x:${detectedZone.x.toFixed(2)}, y:${detectedZone.y.toFixed(2)}, w:${detectedZone.width.toFixed(2)}, h:${detectedZone.height.toFixed(2)}]`);
        showToast(isSk ? "✨ AI detegovalo oblasť s vypálenými titulkami!" : "✨ AI detected burned subtitles region!");
      } else {
        appendLog("[AI DETECT NOTICE] No high-contrast text detected. Adding default subtitle template.");
        handleAddDefaultSubtitleMask();
      }
    } catch (err) {
      appendLog(`[AI DETECT ERROR] ${err}`);
      handleAddDefaultSubtitleMask();
    } finally {
      setIsAutoDetecting(false);
    }
  };

  // Manage Zones
  const handleToggleZone = (id: string) => {
    const updated = zones.map((z) => (z.id === id ? { ...z, enabled: !z.enabled } : z));
    onChangeSettings({ eraserZones: updated });
  };

  const handleDeleteZone = (id: string) => {
    const updated = zones.filter((z) => z.id !== id);
    onChangeSettings({ eraserZones: updated });
    if (selectedZoneId === id) setSelectedZoneId(null);
    showToast(isSk ? "Maska bola vymazaná." : "Mask deleted.");
  };

  const handleClearAllZones = () => {
    onChangeSettings({ eraserZones: [] });
    setSelectedZoneId(null);
    showToast(isSk ? "Všetky masky boli vymazané." : "All masks cleared.");
  };

  const handleUpdateZoneCoords = (id: string, updates: Partial<EraserZone>) => {
    const updated = zones.map((z) => (z.id === id ? { ...z, ...updates } : z));
    onChangeSettings({ eraserZones: updated });
  };

  // Cancel inpainting job
  const handleCancelProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setJobStatus("cancelled");
    setIsStalledWarning(false);
    appendLog("[ABORT] Processing job cancelled by user.");
    showToast(isSk ? "Spracovanie inpaintingu bolo zrušené." : "Inpainting processing was cancelled.");
  };

  // Execute Pipeline (Full Video or 5s Sample)
  const handleRunPipeline = async (isSampleMode: boolean) => {
    if (!currentVideoUrl) {
      showToast(isSk ? "Prv načítajte video." : "Please load a video first.");
      return;
    }

    const activeZones = zones.filter((z) => z.enabled);
    if (activeZones.length === 0) {
      showToast(isSk ? "Najprv pridajte alebo povoľte aspoň jednu masku." : "Please add or enable at least one mask.");
      return;
    }

    // Initialize controller and state
    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;
    lastProgressTimestampRef.current = Date.now();

    setJobStatus("processing");
    setErrorMessage(null);
    setIsStalledWarning(false);
    setCleanVideoUrl(null);
    setCleanBlob(null);

    const sampleSeconds = isSampleMode ? Math.min(5, duration || 5) : undefined;
    appendLog(`[JOB START] Started inpainting job. Mode: ${isSampleMode ? `Quick 5s Sample` : `Full Video (${duration.toFixed(1)}s)`}`);

    try {
      const result = await processVideoInpaintingPipeline({
        videoUrl: currentVideoUrl,
        zones: activeZones,
        grainMatch: settings.eraserGrainMatch !== false,
        feather: settings.eraserFeather || 4,
        sampleDurationSec: sampleSeconds,
        signal: abortCtrl.signal,
        onProgress: (prog) => {
          lastProgressTimestampRef.current = Date.now();
          setProgressState(prog);
          if (isStalledWarning) setIsStalledWarning(false);
        },
        onLog: (logText) => {
          appendLog(logText);
        },
      });

      if (result.success && result.cleanVideoUrl) {
        setCleanVideoUrl(result.cleanVideoUrl);
        if (result.cleanBlob) setCleanBlob(result.cleanBlob);
        setJobStatus("completed");
        onChangeSettings({ eraserEnabled: true });
        appendLog(`[JOB COMPLETE] Clean video created successfully (${(result.processingTimeMs! / 1000).toFixed(1)}s).`);
        showToast(
          isSk
            ? `🎉 ${isSampleMode ? "Rýchly test" : "Odstránenie"} úspešne dokončené!`
            : `🎉 ${isSampleMode ? "Quick test" : "Removal"} completed successfully!`
        );
      } else {
        if (jobStatus !== "cancelled") {
          setJobStatus("failed");
          setErrorMessage(result.error || (isSk ? "Nepodarilo sa spracovať video inpainting." : "Video inpainting failed."));
          appendLog(`[JOB FAILED] ${result.error}`);
        }
      }
    } catch (err: any) {
      if (jobStatus !== "cancelled") {
        setJobStatus("failed");
        setErrorMessage(err?.message || (isSk ? "Chyba pri spracovaní inpaintingu." : "Error during inpainting pipeline."));
        appendLog(`[JOB EXCEPTION] ${err?.message || err}`);
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  // Play Result Video
  const handleTogglePlayResult = () => {
    if (resultVideoCompareRef.current) {
      if (isPlayingResult) {
        resultVideoCompareRef.current.pause();
        setIsPlayingResult(false);
      } else {
        resultVideoCompareRef.current.play();
        setIsPlayingResult(true);
      }
    }
  };

  // Apply to Project Timeline
  const handleApplyToProject = () => {
    if (!cleanVideoUrl) return;
    if (onUploadVideo) {
      onUploadVideo(cleanVideoUrl, "Clean_Subtitles_Removed.webm");
    } else if (onSelectVideoUrl) {
      onSelectVideoUrl(cleanVideoUrl);
    }
    showToast(isSk ? "✨ Vyčistené video bez titulkov bolo vložené do projektu!" : "✨ Clean video applied to project!");
  };

  // Download resulting video
  const handleDownloadResult = () => {
    if (!cleanVideoUrl) return;
    const a = document.createElement("a");
    a.href = cleanVideoUrl;
    a.download = `omnistrih_clean_subtitles_${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(isSk ? "⬇️ Sťahujem vyčistené video..." : "⬇️ Downloading clean video...");
  };

  // Render loop for Side-by-Side comparison and interactive canvas
  const renderComparisonFrames = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    const W = video.videoWidth || 1280;
    const H = video.videoHeight || 720;

    // 1. Original Canvas (Raw video frame)
    if (originalCanvasRef.current) {
      const origCtx = originalCanvasRef.current.getContext("2d");
      if (origCtx) {
        if (originalCanvasRef.current.width !== W) originalCanvasRef.current.width = W;
        if (originalCanvasRef.current.height !== H) originalCanvasRef.current.height = H;
        origCtx.drawImage(video, 0, 0, W, H);
      }
    }

    // 2. Inpainted Canvas (Video frame with inpaintEraserZones applied)
    if (inpaintedCanvasRef.current) {
      const inpaintCtx = inpaintedCanvasRef.current.getContext("2d");
      if (inpaintCtx) {
        if (inpaintedCanvasRef.current.width !== W) inpaintedCanvasRef.current.width = W;
        if (inpaintedCanvasRef.current.height !== H) inpaintedCanvasRef.current.height = H;

        inpaintCtx.drawImage(video, 0, 0, W, H);
        inpaintEraserZones(inpaintCtx, W, H, zones, {
          blendMode: "content-aware",
          grainMatch: settings.eraserGrainMatch !== false,
          feather: settings.eraserFeather || 4,
        });
      }
    }

    // 3. Interactive Mask Editor Overlay Canvas
    if (interactiveCanvasRef.current) {
      const overlayCtx = interactiveCanvasRef.current.getContext("2d");
      if (overlayCtx) {
        if (interactiveCanvasRef.current.width !== W) interactiveCanvasRef.current.width = W;
        if (interactiveCanvasRef.current.height !== H) interactiveCanvasRef.current.height = H;

        overlayCtx.clearRect(0, 0, W, H);
        overlayCtx.drawImage(video, 0, 0, W, H);

        inpaintEraserZones(overlayCtx, W, H, zones, {
          blendMode: "content-aware",
          grainMatch: settings.eraserGrainMatch !== false,
          feather: settings.eraserFeather || 4,
        });

        // Draw bounding boxes and tags
        for (const zone of zones) {
          if (!zone.enabled) continue;
          const zx = zone.x * W;
          const zy = zone.y * H;
          const zw = zone.width * W;
          const zh = zone.height * H;
          const isSelected = zone.id === selectedZoneId;

          overlayCtx.fillStyle = isSelected ? "rgba(244, 63, 94, 0.25)" : "rgba(251, 191, 36, 0.18)";
          overlayCtx.strokeStyle = isSelected ? "#f43f5e" : "#fbbf24";
          overlayCtx.lineWidth = isSelected ? 3 : 2;
          overlayCtx.setLineDash([6, 4]);

          overlayCtx.fillRect(zx, zy, zw, zh);
          overlayCtx.strokeRect(zx, zy, zw, zh);
          overlayCtx.setLineDash([]);

          overlayCtx.font = 'bold 12px "Montserrat", sans-serif';
          const tag = zone.name || (isSk ? "Maska titulkov" : "Subtitle Mask");
          const tagWidth = overlayCtx.measureText(tag).width + 16;
          overlayCtx.fillStyle = isSelected ? "#f43f5e" : "#171717";
          overlayCtx.fillRect(zx, Math.max(0, zy - 22), tagWidth, 20);
          overlayCtx.fillStyle = "#ffffff";
          overlayCtx.fillText(tag, zx + 8, Math.max(14, zy - 7));
        }

        // Draw active drawing box
        if (isDrawingNewBox && drawStart && drawCurrent) {
          const x = Math.min(drawStart.x, drawCurrent.x) * W;
          const y = Math.min(drawStart.y, drawCurrent.y) * H;
          const w = Math.abs(drawCurrent.x - drawStart.x) * W;
          const h = Math.abs(drawCurrent.y - drawStart.y) * H;

          overlayCtx.fillStyle = "rgba(244, 63, 94, 0.3)";
          overlayCtx.strokeStyle = "#f43f5e";
          overlayCtx.lineWidth = 2;
          overlayCtx.setLineDash([4, 2]);
          overlayCtx.fillRect(x, y, w, h);
          overlayCtx.strokeRect(x, y, w, h);
        }
      }
    }
  }, [zones, selectedZoneId, isDrawingNewBox, drawStart, drawCurrent, settings.eraserGrainMatch, settings.eraserFeather, isSk, videoRef]);

  // Render on time/seek
  useEffect(() => {
    renderComparisonFrames();
  }, [currentTime, renderComparisonFrames]);

  // Animation frame loop during video playback
  useEffect(() => {
    let animId: number;
    let isRunning = true;
    const loop = () => {
      if (!isRunning) return;
      const video = videoRef.current;
      if (video && !video.paused) {
        renderComparisonFrames();
        animId = requestAnimationFrame(loop);
      } else {
        animId = window.setTimeout(loop, 250);
      }
    };
    animId = requestAnimationFrame(loop);
    return () => {
      isRunning = false;
      cancelAnimationFrame(animId);
      clearTimeout(animId);
    };
  }, [renderComparisonFrames, videoRef]);

  // Mouse interaction handlers
  const getCanvasRelativeCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = interactiveCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasRelativeCoords(e);
    const clickedZone = zones.find(
      (z) =>
        z.enabled &&
        coords.x >= z.x &&
        coords.x <= z.x + z.width &&
        coords.y >= z.y &&
        coords.y <= z.y + z.height
    );

    if (clickedZone) {
      setSelectedZoneId(clickedZone.id);
      setDraggingZoneId(clickedZone.id);
      setDragOffset({ x: coords.x - clickedZone.x, y: coords.y - clickedZone.y });
    } else {
      setIsDrawingNewBox(true);
      setDrawStart(coords);
      setDrawCurrent(coords);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasRelativeCoords(e);
    if (isDrawingNewBox && drawStart) {
      setDrawCurrent(coords);
    } else if (draggingZoneId) {
      const newX = Math.max(0, Math.min(1 - 0.05, coords.x - dragOffset.x));
      const newY = Math.max(0, Math.min(1 - 0.05, coords.y - dragOffset.y));
      handleUpdateZoneCoords(draggingZoneId, { x: newX, y: newY });
    }
  };

  const handleCanvasMouseUp = () => {
    if (isDrawingNewBox && drawStart && drawCurrent) {
      const minX = Math.min(drawStart.x, drawCurrent.x);
      const minY = Math.min(drawStart.y, drawCurrent.y);
      const width = Math.abs(drawCurrent.x - drawStart.x);
      const height = Math.abs(drawCurrent.y - drawStart.y);

      if (width > 0.03 && height > 0.02) {
        const newZone: EraserZone = {
          id: `custom-sub-${Date.now()}`,
          name: isSk ? "Vlastná maska titulkov" : "Custom Subtitle Mask",
          type: "subtitles",
          x: minX,
          y: minY,
          width,
          height,
          enabled: true,
          feather: 4,
          isTracking: true,
        };
        const updated = [...zones, newZone];
        onChangeSettings({ eraserEnabled: true, eraserZones: updated });
        setSelectedZoneId(newZone.id);
      }
    }
    setIsDrawingNewBox(false);
    setDrawStart(null);
    setDrawCurrent(null);
    setDraggingZoneId(null);
  };

  const isProcessing = jobStatus === "processing";

  return (
    <div className="flex flex-col gap-5 p-4 bg-neutral-900/60 rounded-2xl border border-neutral-800 text-neutral-200">
      {/* Header Banner */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 border border-rose-500/40 text-rose-400 shadow-inner">
            <Eraser className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black tracking-wide text-white uppercase flex items-center gap-2">
              <span>{isSk ? "Odstrániť vypálené titulky pomocou AI" : "AI Burned-in Subtitles Remover"}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                PRO AI
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              {isSk
                ? "Rekonštruuje pixely pod titulkami bez rozmazania, oreza a straty kvality."
                : "Reconstructs pixels beneath subtitles without blur, crop, or loss of clarity."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAutoDetectSubtitles}
            disabled={isAutoDetecting || isProcessing}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white font-bold text-xs shadow-lg shadow-rose-500/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isAutoDetecting ? "animate-spin" : ""}`} />
            <span>
              {isAutoDetecting
                ? isSk
                  ? "AI deteguje..."
                  : "AI Detecting..."
                : isSk
                ? "Automaticky nájsť titulky"
                : "Auto Detect Subtitles"}
            </span>
          </button>
        </div>
      </div>

      {/* Warning / Stalled Alert Banner */}
      {isStalledWarning && isProcessing && (
        <div className="p-3.5 rounded-xl bg-amber-950/70 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              {isSk
                ? "Spracovanie trvá dlhšie, než sa očakávalo. Prebieha náročná rekonštrukcia snímok."
                : "Processing is taking longer than expected. Complex frame reconstruction in progress."}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancelProcessing}
              className="px-2.5 py-1 rounded bg-rose-500/30 hover:bg-rose-500/50 text-rose-200 border border-rose-500/40 text-[11px] font-bold"
            >
              {isSk ? "Zrušiť" : "Cancel"}
            </button>
          </div>
        </div>
      )}

      {/* Real Progress Stage Card */}
      {isProcessing && progressState && (
        <div className="p-4 rounded-xl bg-neutral-950/90 border border-rose-500/40 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                {isSk ? progressState.stageLabelSk : progressState.stageLabelEn}
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-rose-400">
              {progressState.percent}%
            </span>
          </div>

          {/* Real Granular Progress Bar */}
          <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-500 via-amber-500 to-rose-400 transition-all duration-200"
              style={{ width: `${progressState.percent}%` }}
            />
          </div>

          {/* Real Metrics (Frames, FPS, ETA) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] font-mono text-neutral-400 border-t border-neutral-800/80">
            <div>
              <span className="text-neutral-500">{isSk ? "Snímka:" : "Frame:"} </span>
              <span className="text-neutral-200 font-bold">
                {progressState.currentFrame || 0} / {progressState.totalFrames || 0}
              </span>
            </div>
            <div>
              <span className="text-neutral-500">{isSk ? "Rýchlosť:" : "Speed:"} </span>
              <span className="text-neutral-200 font-bold">
                {progressState.fps ? `${progressState.fps} FPS` : "—"}
              </span>
            </div>
            <div>
              <span className="text-neutral-500">{isSk ? "Zostáva:" : "ETA:"} </span>
              <span className="text-amber-400 font-bold">
                {progressState.etaSeconds !== undefined ? `${progressState.etaSeconds}s` : "—"}
              </span>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleCancelProcessing}
                className="text-rose-400 hover:text-rose-300 font-bold underline cursor-pointer"
              >
                {isSk ? "Zrušiť spracovanie" : "Cancel processing"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completed Result Card */}
      {jobStatus === "completed" && cleanVideoUrl && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/50 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span className="text-xs font-black uppercase text-emerald-300 tracking-wide">
                {isSk ? "Vyčistené video je pripravené!" : "Clean video is ready!"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadResult}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold flex items-center gap-1.5 border border-neutral-700 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isSk ? "Stiahnuť súbor" : "Download"}</span>
              </button>

              <button
                type="button"
                onClick={handleApplyToProject}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSk ? "Použiť v projekte" : "Apply to Project"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error State Card */}
      {jobStatus === "failed" && errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => handleRunPipeline(true)}
            className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
          >
            {isSk ? "Skúsiť znova (5s)" : "Retry (5s)"}
          </button>
        </div>
      )}

      {/* Comparison Mode Selector */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1 p-1 bg-neutral-950 rounded-xl border border-neutral-800">
          <button
            type="button"
            onClick={() => setComparisonMode("side_by_side")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              comparisonMode === "side_by_side"
                ? "bg-rose-500 text-white shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            {isSk ? "Vedľa seba (Pred / Po)" : "Side-by-Side (Before / After)"}
          </button>

          <button
            type="button"
            onClick={() => setComparisonMode("toggle")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              comparisonMode === "toggle"
                ? "bg-rose-500 text-white shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            {isSk ? "Interaktívny náhľad" : "Interactive Preview"}
          </button>

          {cleanVideoUrl && (
            <button
              type="button"
              onClick={() => setComparisonMode("result_only")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                comparisonMode === "result_only"
                  ? "bg-emerald-500 text-white shadow-md"
                  : "text-emerald-400 hover:text-emerald-300"
              }`}
            >
              {isSk ? "Iba výsledok ▶️" : "Result Only ▶️"}
            </button>
          )}
        </div>

        {/* Grain & Feather settings */}
        <div className="flex items-center gap-3 text-xs text-neutral-400">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.eraserGrainMatch !== false}
              onChange={(e) => onChangeSettings({ eraserGrainMatch: e.target.checked })}
              className="w-3.5 h-3.5 accent-rose-500 cursor-pointer"
            />
            <span>{isSk ? "Zrno senzora (Grain Match)" : "Sensor Grain Match"}</span>
          </label>
        </div>
      </div>

      {/* Video Viewport Stage */}
      <div className="w-full bg-black/80 rounded-2xl border border-neutral-800 p-2 overflow-hidden shadow-2xl">
        {comparisonMode === "side_by_side" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {/* Left: Original with red subtitles */}
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-neutral-800 flex items-center justify-center">
              <canvas ref={originalCanvasRef} className="w-full h-full object-contain" />
              <div className="absolute top-2 left-2 bg-neutral-900/90 text-neutral-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-neutral-700">
                {isSk ? "PÔVODNÉ VIDEO S TITULKAMI" : "ORIGINAL WITH SUBTITLES"}
              </div>
            </div>

            {/* Right: Real-time Inpainted Preview */}
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-rose-500/40 flex items-center justify-center">
              <canvas ref={inpaintedCanvasRef} className="w-full h-full object-contain" />
              <div className="absolute top-2 left-2 bg-rose-950/90 text-rose-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-rose-500/40 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-rose-400" />
                <span>{isSk ? "AI INPAINTING (BEZ TITULKOV)" : "AI INPAINTED (NO SUBTITLES)"}</span>
              </div>
            </div>
          </div>
        )}

        {(comparisonMode === "toggle" || comparisonMode === "result_only") && (
          <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-neutral-800 flex items-center justify-center">
            {showOriginal ? (
              <canvas ref={originalCanvasRef} className="w-full h-full object-contain" />
            ) : cleanVideoUrl && comparisonMode === "result_only" ? (
              <video
                ref={resultVideoCompareRef}
                src={cleanVideoUrl}
                controls
                playsInline
                className="w-full h-full object-contain"
              />
            ) : (
              <canvas
                ref={interactiveCanvasRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                className="w-full h-full object-contain cursor-crosshair"
              />
            )}

            <div className="absolute top-2 left-2 flex items-center gap-2 pointer-events-none">
              <div className="bg-neutral-900/90 text-white font-mono text-[10px] font-bold px-2.5 py-1 rounded-lg border border-neutral-700 shadow-md flex items-center gap-1.5">
                <Square className="w-3 h-3 text-rose-400" />
                <span>
                  {showOriginal
                    ? isSk
                      ? "NÁHĽAD: ORIGINÁL"
                      : "PREVIEW: ORIGINAL"
                    : isSk
                    ? "INTERAKTÍVNA MASKA (Kliknite a ťahajte pre novú oblasť)"
                    : "INTERACTIVE MASK (Click & drag to create)"}
                </span>
              </div>
            </div>

            {comparisonMode === "toggle" && (
              <button
                onMouseDown={() => setShowOriginal(true)}
                onMouseUp={() => setShowOriginal(false)}
                onMouseLeave={() => setShowOriginal(false)}
                className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-white border border-neutral-700 text-xs font-bold shadow-xl active:scale-95 transition-all select-none"
              >
                {isSk ? "Podržte pre ORIGINÁL 👁️" : "Hold for ORIGINAL 👁️"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mask Manager & Slider Coordinates */}
      <div className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-950/80 p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-amber-400" />
            <span>
              {isSk ? "Zoznam Masiek Vypálených Titulkov:" : "Burned Subtitle Masks:"} ({zones.length})
            </span>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddDefaultSubtitleMask}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>{isSk ? "+ Pridať masku" : "+ Add Mask"}</span>
            </button>

            {zones.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllZones}
                className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isSk ? "Vymazať všetky" : "Clear All"}</span>
              </button>
            )}
          </div>
        </div>

        {zones.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/40 p-4 text-center text-xs text-neutral-400">
            {isSk
              ? "Zatiaľ nie sú pridané žiadne masky. Kliknite na 'Automaticky nájsť titulky' alebo pridajte masku manuálne."
              : "No subtitle masks added yet. Click 'Auto Detect Subtitles' or add a mask."}
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
            {zones.map((zone) => {
              const isSelected = zone.id === selectedZoneId;
              return (
                <div
                  key={zone.id}
                  onClick={() => setSelectedZoneId(zone.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-rose-500/10 border-rose-500/60 shadow-md"
                      : zone.enabled
                      ? "bg-neutral-900 border-neutral-800 hover:border-neutral-700"
                      : "bg-neutral-950/50 border-neutral-900 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleZone(zone.id);
                        }}
                        className="p-1 text-neutral-400 hover:text-white transition-colors"
                      >
                        {zone.enabled ? (
                          <Eye className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-neutral-600" />
                        )}
                      </button>

                      <input
                        type="text"
                        value={zone.name}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleUpdateZoneCoords(zone.id, { name: e.target.value })}
                        className="bg-transparent text-xs font-bold text-white focus:outline-none border-b border-transparent focus:border-rose-500"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteZone(zone.id);
                        }}
                        className="p-1 text-neutral-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-neutral-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] text-neutral-400">
                      <div>
                        <span>X: {Math.round(zone.x * 100)}%</span>
                        <input
                          type="range"
                          min="0"
                          max="0.9"
                          step="0.01"
                          value={zone.x}
                          onChange={(e) => handleUpdateZoneCoords(zone.id, { x: parseFloat(e.target.value) })}
                          className="w-full accent-rose-500 h-1 bg-neutral-800 rounded cursor-pointer"
                        />
                      </div>
                      <div>
                        <span>Y: {Math.round(zone.y * 100)}%</span>
                        <input
                          type="range"
                          min="0"
                          max="0.9"
                          step="0.01"
                          value={zone.y}
                          onChange={(e) => handleUpdateZoneCoords(zone.id, { y: parseFloat(e.target.value) })}
                          className="w-full accent-rose-500 h-1 bg-neutral-800 rounded cursor-pointer"
                        />
                      </div>
                      <div>
                        <span>{isSk ? "Šírka:" : "Width:"} {Math.round(zone.width * 100)}%</span>
                        <input
                          type="range"
                          min="0.05"
                          max="1"
                          step="0.01"
                          value={zone.width}
                          onChange={(e) => handleUpdateZoneCoords(zone.id, { width: parseFloat(e.target.value) })}
                          className="w-full accent-rose-500 h-1 bg-neutral-800 rounded cursor-pointer"
                        />
                      </div>
                      <div>
                        <span>{isSk ? "Výška:" : "Height:"} {Math.round(zone.height * 100)}%</span>
                        <input
                          type="range"
                          min="0.02"
                          max="0.5"
                          step="0.01"
                          value={zone.height}
                          onChange={(e) => handleUpdateZoneCoords(zone.id, { height: parseFloat(e.target.value) })}
                          className="w-full accent-rose-500 h-1 bg-neutral-800 rounded cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Execution Actions (5s Quick Sample vs Full Video) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Quick 5-Second Test */}
        <button
          type="button"
          onClick={() => handleRunPipeline(true)}
          disabled={isProcessing || zones.length === 0}
          className="py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 shadow-lg active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer"
        >
          <Zap className="w-4 h-4 text-amber-400" />
          <span>
            {isProcessing && progressState?.stageId === "inpaint" && progressState.totalFrames! <= 150
              ? isSk
                ? "TESTUJEM VZORKU..."
                : "TESTING SAMPLE..."
              : isSk
              ? "⚡ Rýchly test (5s vzorka)"
              : "⚡ Quick Test (5s Sample)"}
          </span>
        </button>

        {/* Full Video Inpainting */}
        <button
          type="button"
          onClick={() => handleRunPipeline(false)}
          disabled={isProcessing || zones.length === 0}
          className="py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600 hover:from-rose-600 hover:to-amber-600 text-white shadow-xl shadow-rose-500/25 active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer"
        >
          <Eraser className="w-4 h-4" />
          <span>
            {isProcessing
              ? isSk
                ? "SPRACOVÁVAM CELÉ VIDEO..."
                : "PROCESSING FULL VIDEO..."
              : isSk
              ? "🎬 Odstrániť titulky z celého videa"
              : "🎬 Remove Subtitles from Full Video"}
          </span>
        </button>
      </div>

      {/* Real-Time Technical Debug Log Console */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowDebugLogs((prev) => !prev)}
          className="w-full px-4 py-2.5 bg-neutral-900/70 hover:bg-neutral-900 text-xs font-mono font-bold text-neutral-400 flex items-center justify-between transition-colors"
        >
          <span className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-rose-400" />
            <span>{isSk ? "Technický Debug Log & Pipeline State" : "Technical Debug Log & Pipeline State"}</span>
            {debugLogs.length > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-neutral-800 text-[10px] text-neutral-300">
                {debugLogs.length}
              </span>
            )}
          </span>
          {showDebugLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showDebugLogs && (
          <div className="p-3 bg-black/90 max-h-48 overflow-y-auto custom-scrollbar font-mono text-[10px] text-neutral-300 space-y-1 select-text">
            {debugLogs.length === 0 ? (
              <span className="text-neutral-600">{isSk ? "Zatiaľ žiadne záznamy..." : "No logs yet..."}</span>
            ) : (
              debugLogs.map((log, idx) => (
                <div key={idx} className="leading-tight text-neutral-400 hover:text-white">
                  {log}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
};

import React from "react";
import {
  Sparkles,
  Download,
  Smartphone,
  Monitor,
  Square,
  RectangleVertical,
  Wand2,
  Settings2,
  Key,
  ShieldCheck,
  Search,
  Undo2,
  Redo2,
  CheckCircle2,
  Eye,
  Upload,
  PanelRight,
  Bell,
  Brain,
  Subtitles,
  Zap,
  Film,
} from "lucide-react";
import { VideoAspectRatio } from "../types";

interface HeaderProps {
  aspectRatio: VideoAspectRatio;
  onSelectAspectRatio: (ratio: VideoAspectRatio) => void;
  language: "sk" | "en";
  onToggleLanguage: (lang: "sk" | "en") => void;
  onTriggerMagicEdit: () => void;
  isProcessingMagic: boolean;
  onOpenExport: () => void;
  onOpenSettings: () => void;
  onOpenApiKeys: () => void;
  zeroTokenMode: boolean;
  onOpenSearch?: () => void;
  projectName?: string;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onOpenQC?: () => void;
  /** Measured Quality Check badge (score or critical count) — null until the check has run. */
  qcBadge?: string | null;
  qcBadgeTone?: "ok" | "critical";
  workflowState?: "NEW" | "RAW_IMPORTED" | "PROCESSED" | "REVIEWED";
  onReviewChanges?: () => void;
  hasMedia?: boolean;
  onOpenImport?: () => void;
  isInspectorOpen?: boolean;
  onToggleInspector?: () => void;
  onOpenLocalAI?: () => void;
  onOpenCaptions?: () => void;
  onOpenMediaIntelligence?: () => void;
  onOpenDirector?: () => void;
}

export const Header: React.FC<HeaderProps> = React.memo(({
  aspectRatio,
  onSelectAspectRatio,
  language,
  onToggleLanguage,
  onTriggerMagicEdit,
  isProcessingMagic,
  onOpenExport,
  onOpenSettings,
  onOpenApiKeys,
  zeroTokenMode,
  onOpenSearch,
  projectName = "Active Project",
  onUndo,
  onRedo,
  canUndo = true,
  canRedo = false,
  onOpenQC,
  qcBadge,
  qcBadgeTone = "ok",
  workflowState = "RAW_IMPORTED",
  onReviewChanges,
  hasMedia = true,
  onOpenImport,
  isInspectorOpen = true,
  onToggleInspector,
  onOpenLocalAI,
  onOpenCaptions,
  onOpenMediaIntelligence,
  onOpenDirector,
}) => {
  const isSk = language === "sk";

  const formats: { ratio: VideoAspectRatio; label: string; icon: any }[] = [
    { ratio: "9:16", label: "Reels / TikTok", icon: Smartphone },
    { ratio: "16:9", label: "YouTube / TV", icon: Monitor },
    { ratio: "1:1", label: "Square", icon: Square },
    { ratio: "4:5", label: "Portrait", icon: RectangleVertical },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-800 bg-neutral-950/95 backdrop-blur-md px-3 py-2.5 sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        {/* Left: Brand + Project Name + Undo/Redo */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 via-amber-500 to-indigo-600 shadow-md shadow-rose-500/20">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-['Fraunces'] text-base sm:text-lg font-bold tracking-tight text-white leading-none">
                OmniStrih <span className="text-rose-500 text-xs font-mono font-bold">PRO</span>
              </h1>
              <span className="hidden md:inline-block text-neutral-600">•</span>
              <span className="hidden md:inline-block text-xs font-semibold text-neutral-300 max-w-[150px] truncate" title={projectName}>
                {projectName}
              </span>
            </div>
          </div>

          {/* Undo / Redo controls */}
          <div className="hidden lg:flex items-center gap-0.5 ml-2 bg-neutral-900 border border-neutral-800 rounded-lg p-0.5">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400 rounded transition-colors"
              title={isSk ? "Späť (Cmd+Z)" : "Undo (Cmd+Z)"}
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400 rounded transition-colors"
              title={isSk ? "Dopredu (Cmd+Shift+Z)" : "Redo (Cmd+Shift+Z)"}
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Center: Format Aspect Ratio Selector */}
        <div className="hidden md:flex items-center rounded-xl border border-neutral-800 bg-neutral-900/80 p-1">
          {formats.map((fmt) => {
            const Icon = fmt.icon;
            const active = aspectRatio === fmt.ratio;
            return (
              <button
                key={fmt.ratio}
                id={`format-btn-${fmt.ratio.replace(":", "-")}`}
                onClick={() => onSelectAspectRatio(fmt.ratio)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  active
                    ? "bg-neutral-800 text-white shadow-sm ring-1 ring-neutral-700"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
                title={fmt.label}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{fmt.ratio}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Search + State-Adaptive Primary CTA + QC + Export + Settings */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Import Media Hub Button */}
          {onOpenImport && (
            <button
              id="header-import-media-btn"
              onClick={onOpenImport}
              className="flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900/90 px-2.5 py-1.5 text-xs font-semibold text-neutral-300 hover:text-white hover:border-neutral-700 active:scale-95 transition-all shadow-sm"
              title={isSk ? "Importovať médiá (Disk, Mobil, Cloud, URL)" : "Import Media (Disk, Phone, Cloud, URL)"}
            >
              <Upload className="h-3.5 w-3.5 text-rose-400" />
              <span className="hidden sm:inline text-[11px]">{isSk ? "Import" : "Import"}</span>
            </button>
          )}

          {/* Global Search (Ctrl+K) */}
          {onOpenSearch && (
            <button
              id="global-search-trigger-btn"
              onClick={onOpenSearch}
              className="flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900/90 px-2.5 py-1.5 text-xs font-semibold text-neutral-300 hover:text-white hover:border-neutral-700 active:scale-95 transition-all shadow-sm"
              title={isSk ? "Globálne vyhľadávanie nástrojov (Ctrl+K)" : "Global Tool Search (Cmd+K)"}
            >
              <Search className="h-3.5 w-3.5 text-rose-400" />
              <span className="hidden sm:inline text-[11px]">{isSk ? "Hľadať" : "Search"}</span>
              <kbd className="hidden lg:inline-block ml-1 px-1 py-0.2 text-[9px] font-mono text-neutral-400 bg-neutral-950 border border-neutral-800 rounded">
                ⌘K
              </kbd>
            </button>
          )}

          {/* Quality Check (QC & Time Saved) */}
          {onOpenQC && (
            <button
              onClick={onOpenQC}
              className="hidden sm:flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs font-semibold text-neutral-300 hover:text-white hover:border-neutral-700 transition-all"
              title={isSk ? "Kontrola kvality a štatistika úspory času" : "Quality Check & Time Saved Analytics"}
            >
              <CheckCircle2 className={`h-3.5 w-3.5 ${qcBadgeTone === "critical" ? "text-red-400" : "text-emerald-400"}`} />
              <span className="text-[11px]">QC</span>
              {qcBadge && (
                <span className={`text-[10px] font-mono ${qcBadgeTone === "critical" ? "text-red-400" : "text-emerald-400"}`}>{qcBadge}</span>
              )}
            </button>
          )}

          {/* Language Switch */}
          <div className="flex items-center rounded-lg border border-neutral-800 bg-neutral-900 p-0.5">
            <button
              id="lang-sk-btn"
              onClick={() => onToggleLanguage("sk")}
              className={`px-2 py-0.5 text-[11px] font-bold rounded transition-all ${
                isSk ? "bg-rose-500 text-white shadow" : "text-neutral-400 hover:text-white"
              }`}
            >
              SK
            </button>
            <button
              id="lang-en-btn"
              onClick={() => onToggleLanguage("en")}
              className={`px-2 py-0.5 text-[11px] font-bold rounded transition-all ${
                !isSk ? "bg-rose-500 text-white shadow" : "text-neutral-400 hover:text-white"
              }`}
            >
              EN
            </button>
          </div>

          {/* Primary State-Adaptive CTA */}
          {workflowState === "PROCESSED" && onReviewChanges ? (
            <button
              id="review-changes-btn"
              onClick={onReviewChanges}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-95 transition-all"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>{isSk ? "KONTROLA ZMIEN" : "REVIEW CHANGES"}</span>
            </button>
          ) : !hasMedia ? (
            <button
              id="magic-auto-edit-btn"
              disabled={true}
              title={isSk ? "Najskôr nahrajte video" : "Import video first"}
              className="flex items-center gap-1.5 rounded-xl bg-neutral-900 border border-neutral-800 px-3.5 py-1.5 text-xs font-bold text-neutral-500 cursor-not-allowed opacity-70"
            >
              <Wand2 className="h-3.5 w-3.5 text-neutral-600" />
              <span>{isSk ? "NAJSKÔR NAHRAJTE VIDEO" : "IMPORT VIDEO FIRST"}</span>
            </button>
          ) : (
            <button
              id="magic-auto-edit-btn"
              onClick={onTriggerMagicEdit}
              disabled={isProcessingMagic}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 px-4 py-1.5 text-xs font-black text-white shadow-lg shadow-indigo-600/30 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className={`h-3.5 w-3.5 text-indigo-200 ${isProcessingMagic ? "animate-spin" : ""}`} />
              <span>{isProcessingMagic ? (isSk ? "SPRACOVÁVAM..." : "PROCESSING...") : "Make it professional"}</span>
            </button>
          )}

          {/* Notifications Bell */}
          <button
            onClick={() => {}}
            title={isSk ? "Notifikácie a stav" : "Notifications & Status"}
            className="hidden sm:flex items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 p-2 text-neutral-400 hover:text-white transition-all cursor-pointer relative"
          >
            <Bell className="h-3.5 w-3.5" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-rose-500 ring-2 ring-neutral-900" />
          </button>

          {/* Export Video Button */}
          <button
            id="export-video-btn"
            onClick={onOpenExport}
            className="flex items-center gap-1.5 rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-700 active:scale-95 transition-all"
          >
            <Download className="h-3.5 w-3.5 text-rose-400" />
            <span className="hidden sm:inline">{isSk ? "Export" : "Export"}</span>
          </button>

          {/* Director Engine Button */}
          {onOpenDirector && (
            <button
              id="director-engine-btn"
              onClick={onOpenDirector}
              title={isSk ? "AI Director Engine (Režisér)" : "AI Director Engine"}
              className="rounded-xl border border-rose-800/80 bg-rose-950/40 p-2 text-rose-300 hover:text-white hover:bg-rose-900/60 transition-all cursor-pointer shadow-sm"
            >
              <Film className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Media Intelligence Index Button */}
          {onOpenMediaIntelligence && (
            <button
              id="media-intelligence-btn"
              onClick={onOpenMediaIntelligence}
              title={isSk ? "Media Intelligence Index (Incremental DAG)" : "Media Intelligence Index (Incremental DAG)"}
              className="rounded-xl border border-emerald-800/80 bg-emerald-950/40 p-2 text-emerald-300 hover:text-white hover:bg-emerald-900/60 transition-all cursor-pointer shadow-sm"
            >
              <Zap className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Local Auto Captions Button */}
          {onOpenCaptions && (
            <button
              id="local-captions-btn"
              onClick={onOpenCaptions}
              title={isSk ? "Lokálne Titulky & Text-Based Video Editor" : "Local Captions & Text-Based Video Editor"}
              className="rounded-xl border border-amber-800/80 bg-amber-950/40 p-2 text-amber-300 hover:text-white hover:bg-amber-900/60 transition-all cursor-pointer shadow-sm"
            >
              <Subtitles className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Local AI Control Center Button */}
          {onOpenLocalAI && (
            <button
              id="local-ai-center-btn"
              onClick={onOpenLocalAI}
              title={isSk ? "Lokálne AI Modely (100% Offline)" : "Local AI Models (100% Offline)"}
              className="rounded-xl border border-purple-800/80 bg-purple-950/40 p-2 text-purple-300 hover:text-white hover:bg-purple-900/60 transition-all cursor-pointer shadow-sm"
            >
              <Brain className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Settings button */}
          <button
            id="settings-info-btn"
            onClick={onOpenSettings}
            title={isSk ? "Nastavenia & Diagnostika" : "Settings & Diagnostics"}
            className="rounded-xl border border-neutral-800 bg-neutral-900 p-2 text-neutral-400 hover:text-white transition-all cursor-pointer"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>

          {/* Toggle Inspector / Project Overview Panel */}
          {onToggleInspector && (
            <button
              id="toggle-inspector-btn"
              onClick={onToggleInspector}
              title={isInspectorOpen ? (isSk ? "Skryť Prehľad projektu (Inspector)" : "Hide Project Overview") : (isSk ? "Zobraziť Prehľad projektu (Inspector)" : "Show Project Overview")}
              className={`rounded-xl border p-2 transition-all cursor-pointer ${
                isInspectorOpen
                  ? "border-rose-500/50 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 shadow-sm"
                  : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white"
              }`}
            >
              <PanelRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
});

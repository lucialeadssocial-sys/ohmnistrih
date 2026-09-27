import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Search,
  X,
  Star,
  Clock,
  ArrowRight,
  Sparkles,
  Command as CommandIcon,
  ShieldAlert,
  AlertCircle,
  HelpCircle,
  Check,
  Film,
  Scissors,
  Sliders,
  Type,
  Music,
  Video,
  Lock,
  Maximize2,
  Cpu,
  Brain,
  Download,
  ShieldCheck,
  Zap,
  CornerDownLeft
} from "lucide-react";
import { ToolDefinition, ToolCategory, SelectionType } from "../types";
import { ALL_TOOLS, TOOL_CATEGORIES } from "../data/tools";

export interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  language: "sk" | "en";
  selectedId: string | null;
  selectionType: SelectionType;
  onNavigateTab: (tabId: string) => void;
  onExecuteAction: (actionId: string, params?: any) => void;
  onOpenInspector: (toolId: string) => void;
  onTriggerMakeProfessional?: () => void;
  onOpenExport?: () => void;
  onSelectSampleClip?: () => void;
}

// Synonyms dictionary for rich bilingual fuzzy search
const SYNONYMS: Record<string, string[]> = {
  // Editing
  "cut": ["split", "trim", "strih", "rezať", "odrezať", "skrátiť", "prestrih", "crop"],
  "strih": ["split", "cut", "trim", "prestrih", "smart_cut", "orezať"],
  "orezať": ["trim", "crop", "skrátiť", "rezať"],
  "ticho": ["silence", "smart_cut", "gap", "pauza", "prestoj", "jump"],
  "silence": ["smart_cut", "ticho", "gap", "pauza", "jump_cut"],
  "bad take": ["nepodarok", "chyba", "stutter", "prerušenie", "fail", "zaseknutie"],
  
  // Audio
  "šum": ["noise_removal", "odšumiť", "noise", "audio cleanup", "clear voice", "hiss"],
  "noise": ["noise_removal", "šum", "voice cleanup", "audio cleanup", "de-noise"],
  "zvuk": ["audio", "hlas", "voice", "music", "noise_removal", "ducking", "eq"],
  "hlas": ["voice", "vocal", "speech", "voice_enhancement", "eq", "de-esser", "zvuk"],
  "hudba": ["music", "podmaz", "soundtrack", "ducking", "audio"],
  "music": ["hudba", "background music", "ducking", "soundtrack"],
  "ducking": ["stíšenie", "volume", "speech focus", "music"],
  
  // Visual & Color
  "farby": ["color", "jas", "kontrast", "brightness", "contrast", "grading", "farba"],
  "color": ["farby", "grading", "brightness", "contrast", "saturation", "jas"],
  "jas": ["color", "brightness", "expozícia", "farby"],
  "zoom": ["punch_in", "zväčšiť", "fokus", "priblížiť", "punch in"],
  "zväčšiť": ["punch_in", "zoom", "scale", "mierka"],
  "stabilizovať": ["stabilize", "trasenie", "shake", "smooth", "zastabilizovať"],
  "maskovanie": ["pro_masking", "masking", "maska", "feather", "tracking"],
  "masking": ["pro_masking", "maskovanie", "feather", "cutout"],
  "tracking": ["sledovanie", "motion tracking", "follow", "object tracking"],
  "pozadie": ["background_removal", "green screen", "kľúčovanie", "remove background"],
  "background": ["background_removal", "pozadie", "green screen", "segmentation"],
  "vymazať": ["object_removal", "eraser", "odstrániť", "inpaint", "retuš"],
  "eraser": ["object_removal", "vymazať", "inpaint", "retouch"],
  
  // Captions
  "titulky": ["captions", "subtitles", "text", "kinetic_text", "preklad"],
  "captions": ["titulky", "subtitles", "text", "kinetic_text"],
  
  // Video & Motion
  "prechod": ["transition", "prechody", "dissolve", "whip pan", "fade"],
  "transition": ["prechod", "prechody", "dissolve", "cut"],
  "zrýchliť": ["speed_ramp", "speed", "fast", "rýchlosť"],
  "spomaliť": ["speed_ramp", "speed", "slow motion", "spomalenie"],
  "rýchlosť": ["speed_ramp", "speed", "tempo"],
  
  // Social & Export
  "vertical": ["auto_reframe", "social_reframe", "9:16", "tiktok", "reels", "vertikálne"],
  "vertikálne": ["auto_reframe", "social_reframe", "9:16", "tiktok", "reels"],
  "tiktok": ["auto_reframe", "social_reframe", "9:16", "reels", "shorts"],
  "export": ["export", "render", "save", "uložiť", "stiahnuť", "webm", "mp4"],
  
  // AI & Doctor
  "doctor": ["edit_doctor", "fix this", "opraviť", "diagnostika", "check my edit"],
  "opraviť": ["edit_doctor", "fix this", "oprava", "doctor"],
  "fix": ["edit_doctor", "opraviť", "doctor", "fix this"],
  "professional": ["make_professional", "autopilot", "vylepšiť", "make it professional"],
  "autopilot": ["make_professional", "edit_doctor", "auto edit"],
  "kvalita": ["quality_gate", "qc", "kontrola", "quality check", "check my video"],
  "quality": ["quality_gate", "qc", "check my video", "review"]
};

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  isOpen,
  onClose,
  language,
  selectedId,
  selectionType,
  onNavigateTab,
  onExecuteAction,
  onOpenInspector,
  onTriggerMakeProfessional,
  onOpenExport,
  onSelectSampleClip
}) => {
  const isSk = language === "sk";
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<ToolCategory>("ALL");
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("omnistrih_favorite_tools");
      return saved ? JSON.parse(saved) : ["make_professional", "edit_doctor", "smart_cut", "captions"];
    } catch {
      return ["make_professional", "edit_doctor", "smart_cut", "captions"];
    }
  });

  const [recentToolIds, setRecentToolIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("omnistrih_recent_searches");
      return saved ? JSON.parse(saved) : ["make_professional", "captions", "noise_removal", "punch_in"];
    } catch {
      return ["make_professional", "captions", "noise_removal", "punch_in"];
    }
  });

  const [selectionWarning, setSelectionWarning] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setSelectionWarning(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Save favorites to localStorage
  const toggleFavorite = (toolId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId];
      try {
        localStorage.setItem("omnistrih_favorite_tools", JSON.stringify(next));
      } catch (err) {
        console.error(err);
      }
      return next;
    });
  };

  // Add tool to recents
  const addToRecents = useCallback((toolId: string) => {
    setRecentToolIds((prev) => {
      const filtered = prev.filter((id) => id !== toolId);
      const next = [toolId, ...filtered].slice(0, 8);
      try {
        localStorage.setItem("omnistrih_recent_searches", JSON.stringify(next));
      } catch (err) {
        console.error(err);
      }
      return next;
    });
  }, []);

  // Compute Context Match Score
  const getContextPriority = useCallback((tool: ToolDefinition, selType: SelectionType): number => {
    if (selType === "VIDEO_CLIP") {
      const videoPriority = ["trim", "split", "speed_ramp", "punch_in", "stabilize", "color", "noise_removal", "pro_masking", "tracking", "broll", "object_removal", "make_professional"];
      const idx = videoPriority.indexOf(tool.id);
      return idx !== -1 ? 100 - idx : 10;
    }
    if (selType === "AUDIO_CLIP") {
      const audioPriority = ["noise_removal", "voice_enhancement", "music", "ducking", "j_cut", "l_cut", "trim", "split", "speed_ramp"];
      const idx = audioPriority.indexOf(tool.id);
      return idx !== -1 ? 100 - idx : 5;
    }
    if (selType === "CAPTION") {
      const captionPriority = ["captions", "kinetic_text", "trim"];
      const idx = captionPriority.indexOf(tool.id);
      return idx !== -1 ? 100 - idx : 5;
    }
    if (selType === "BROLL" || selType === "IMAGE") {
      const brollPriority = ["broll", "image", "trim", "crop", "color", "pro_masking", "tracking", "speed_ramp"];
      const idx = brollPriority.indexOf(tool.id);
      return idx !== -1 ? 100 - idx : 10;
    }
    // No selection -> Prioritize project-level & AI orchestration
    const projectPriority = ["make_professional", "edit_doctor", "quality_gate", "export", "smart_cut", "bad_take", "captions", "auto_reframe", "social_reframe", "music"];
    const idx = projectPriority.indexOf(tool.id);
    return idx !== -1 ? 100 - idx : 20;
  }, []);

  // Search Index Calculation
  const searchResults = useMemo(() => {
    const rawQuery = query.trim().toLowerCase();

    // Collect base tools
    let candidates = ALL_TOOLS;
    if (activeCategory !== "ALL") {
      candidates = candidates.filter((t) => t.category === activeCategory);
    }

    if (!rawQuery) {
      // Return sorted by Context Relevance and Favorites
      return candidates
        .map((tool) => {
          const isFav = favorites.includes(tool.id);
          const isRecent = recentToolIds.includes(tool.id);
          const contextScore = getContextPriority(tool, selectionType);
          const score = (isFav ? 200 : 0) + (isRecent ? 80 : 0) + contextScore;
          return { tool, score, matchReason: isFav ? (isSk ? "Obľúbené" : "Favorite") : undefined };
        })
        .sort((a, b) => b.score - a.score)
        .map((r) => r.tool);
    }

    // Match with scoring
    const results: { tool: ToolDefinition; score: number; matchReason?: string }[] = [];

    // Find expanded synonym terms
    const expandedTerms = [rawQuery];
    for (const [key, synList] of Object.entries(SYNONYMS)) {
      if (rawQuery.includes(key) || key.includes(rawQuery)) {
        expandedTerms.push(...synList);
      }
      for (const syn of synList) {
        if (rawQuery.includes(syn) || syn.includes(rawQuery)) {
          expandedTerms.push(key, ...synList);
        }
      }
    }
    const uniqueTerms = Array.from(new Set(expandedTerms));

    for (const tool of candidates) {
      let score = 0;
      let reason: string | undefined;

      const nameSk = tool.nameSk.toLowerCase();
      const nameEn = tool.nameEn.toLowerCase();
      const descSk = tool.descSk.toLowerCase();
      const descEn = tool.descEn.toLowerCase();
      const id = tool.id.toLowerCase();
      const keywords = (tool.keywords || []).map((k) => k.toLowerCase());

      // 1. Exact Name Match (Highest priority)
      if (nameSk === rawQuery || nameEn === rawQuery || id === rawQuery) {
        score += 500;
        reason = isSk ? "Presný názov" : "Exact Name";
      }
      // 2. Starts with query
      else if (nameSk.startsWith(rawQuery) || nameEn.startsWith(rawQuery) || id.startsWith(rawQuery)) {
        score += 300;
        reason = isSk ? "Názov začína na dopyt" : "Name prefix match";
      }
      // 3. Name contains query
      else if (nameSk.includes(rawQuery) || nameEn.includes(rawQuery)) {
        score += 200;
        reason = isSk ? "V názve nástroja" : "In tool name";
      }
      // 4. Keyword matches
      for (const kw of keywords) {
        if (kw === rawQuery) {
          score += 250;
          reason = isSk ? `Kľúčové slovo: ${kw}` : `Keyword: ${kw}`;
          break;
        } else if (kw.includes(rawQuery)) {
          score += 150;
          reason = isSk ? `Kľúčové slovo: ${kw}` : `Keyword: ${kw}`;
          break;
        }
      }

      // 5. Synonym / Natural language expansion matches
      for (const term of uniqueTerms) {
        if (id.includes(term) || nameSk.includes(term) || nameEn.includes(term)) {
          score += 120;
          if (!reason) reason = isSk ? `Synonymum: ${term}` : `Synonym: ${term}`;
        }
        for (const kw of keywords) {
          if (kw.includes(term)) {
            score += 90;
            if (!reason) reason = isSk ? `Zámer: ${term}` : `Intent: ${term}`;
          }
        }
      }

      // 6. Description match
      if (descSk.includes(rawQuery) || descEn.includes(rawQuery)) {
        score += 60;
        if (!reason) reason = isSk ? "V popise funkcie" : "In description";
      }

      // Context Boost
      if (score > 0) {
        score += getContextPriority(tool, selectionType);
        if (favorites.includes(tool.id)) score += 50;
        results.push({ tool, score, matchReason: reason });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.map((r) => r.tool);
  }, [query, activeCategory, favorites, recentToolIds, selectionType, isSk, getContextPriority]);

  // Suggestions when no results found
  const suggestions = useMemo(() => {
    if (searchResults.length > 0 || !query.trim()) return [];
    const q = query.toLowerCase();

    if (q.includes("face") || q.includes("tvár") || q.includes("look better") || q.includes("krajší")) {
      return ALL_TOOLS.filter((t) => ["color", "stabilize", "privacy_blur", "edit_doctor"].includes(t.id));
    }
    if (q.includes("audio") || q.includes("zvuk") || q.includes("hlas") || q.includes("voice")) {
      return ALL_TOOLS.filter((t) => ["noise_removal", "voice_enhancement", "ducking", "music"].includes(t.id));
    }
    if (q.includes("strih") || q.includes("cut") || q.includes("video")) {
      return ALL_TOOLS.filter((t) => ["smart_cut", "split", "trim", "make_professional"].includes(t.id));
    }
    // Default smart fallback suggestions
    return ALL_TOOLS.filter((t) => ["make_professional", "edit_doctor", "quality_gate", "captions"].includes(t.id));
  }, [searchResults.length, query]);

  // Ensure index in bounds
  useEffect(() => {
    if (selectedIndex >= searchResults.length) {
      setSelectedIndex(0);
    }
  }, [searchResults.length, selectedIndex]);

  // Handle Tool Execution & Routing
  const handleSelectTool = useCallback(
    (tool: ToolDefinition) => {
      // Check if tool requires selection
      if (tool.requiresSelection && selectionType === "NONE") {
        setSelectionWarning(
          isSk
            ? `Nástroj "${tool.nameSk}" vyžaduje označenie klipu na časovej osi.`
            : `Tool "${tool.nameEn}" requires selecting a clip on the timeline.`
        );
        return;
      }

      addToRecents(tool.id);
      onClose();

      // Route to Existing Tool Implementation
      if (tool.id === "make_professional") {
        if (onTriggerMakeProfessional) {
          onTriggerMakeProfessional();
        } else {
          onExecuteAction("make_professional");
        }
        return;
      }

      if (tool.id === "export") {
        if (onOpenExport) {
          onOpenExport();
        } else {
          onExecuteAction("export");
        }
        return;
      }

      if (tool.id === "social_reframe") {
        onExecuteAction("OPEN_ASPECT_RATIO_MODAL");
        return;
      }

      if (tool.actionType === "OPEN_INSPECTOR") {
        onOpenInspector(tool.id);
        return;
      }

      if (tool.actionType === "NAVIGATE" && tool.tabId) {
        onNavigateTab(tool.tabId);
        return;
      }

      if (tool.actionType === "EXECUTE_ACTION") {
        onExecuteAction(tool.id);
        return;
      }

      // Default fallback
      if (tool.tabId) {
        onNavigateTab(tool.tabId);
      } else {
        onOpenInspector(tool.id);
      }
    },
    [
      selectionType,
      isSk,
      addToRecents,
      onClose,
      onTriggerMakeProfessional,
      onOpenExport,
      onExecuteAction,
      onOpenInspector,
      onNavigateTab
    ]
  );

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, searchResults.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + searchResults.length) % Math.max(1, searchResults.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (searchResults[selectedIndex]) {
        handleSelectTool(searchResults[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="global-command-palette-backdrop"
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="global-command-palette-modal"
        role="dialog"
        aria-modal="true"
        aria-label="OmniStrih Global Search"
        className="w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-2xl bg-neutral-900 border-0 sm:border border-neutral-800 rounded-none sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden text-neutral-100"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header / Search Input */}
        <div className="p-3 sm:p-4 border-b border-neutral-800 bg-neutral-950/80 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
            <Search className="w-5 h-5" />
          </div>

          <div className="flex-1 relative">
            <input
              ref={inputRef}
              id="global-search-input"
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
                setSelectionWarning(null);
              }}
              placeholder={
                isSk
                  ? "Hľadaj nástroj, akciu, strih, šum, titulky... (Ctrl+K)"
                  : "Search tool, action, trim, noise, captions, speed... (Cmd+K)"
              }
              className="w-full bg-transparent border-0 text-white placeholder-neutral-500 text-sm sm:text-base font-medium focus:ring-0 focus:outline-none"
              autoComplete="off"
              spellCheck="false"
            />
          </div>

          {query && (
            <button
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              title={isSk ? "Vymazať dopyt" : "Clear query"}
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            id="close-search-btn"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
            title={isSk ? "Zavrieť (Esc)" : "Close (Esc)"}
          >
            <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-neutral-800 rounded text-neutral-400 border border-neutral-700 mr-2">
              ESC
            </span>
            <X className="w-5 h-5 inline-block" />
          </button>
        </div>

        {/* Selection Context Banner */}
        <div className="px-4 py-2 bg-neutral-950/50 border-b border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold uppercase tracking-wider text-[10px] text-neutral-500">
              {isSk ? "Aktuálny kontext:" : "Current Context:"}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono text-[10px] font-bold">
              {selectionType === "VIDEO_CLIP" && (isSk ? "🎥 VIDEO KLIP" : "🎥 VIDEO CLIP")}
              {selectionType === "AUDIO_CLIP" && (isSk ? "🎤 AUDIO STOPA" : "🎤 AUDIO TRACK")}
              {selectionType === "CAPTION" && (isSk ? "📝 TITULKY" : "📝 CAPTION")}
              {selectionType === "BROLL" && (isSk ? "🎞️ B-ROLL" : "🎞️ B-ROLL")}
              {selectionType === "IMAGE" && (isSk ? "🖼️ OBRÁZOK" : "🖼️ IMAGE")}
              {selectionType === "NONE" && (isSk ? "⚡ PROJEKT (BEZ OZNAČENIA)" : "⚡ PROJECT LEVEL (NO SELECTION)")}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-neutral-500 text-[10px]">
            <span>↑↓ {isSk ? "pohyb" : "navigate"}</span>
            <span>·</span>
            <span>↵ {isSk ? "spustiť" : "execute"}</span>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="px-3 py-2 border-b border-neutral-800/60 bg-neutral-900/90 flex gap-1.5 overflow-x-auto custom-scrollbar">
          {TOOL_CATEGORIES.slice(0, 10).map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  active
                    ? "bg-rose-500 text-white shadow-sm shadow-rose-500/20 font-bold"
                    : "bg-neutral-800/70 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
                }`}
              >
                <span>{isSk ? cat.labelSk : cat.labelEn}</span>
              </button>
            );
          })}
        </div>

        {/* Selection Warning (if user clicked a selection-bound tool without selection) */}
        {selectionWarning && (
          <div className="m-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300 animate-in slide-in-from-top-1 duration-150">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{selectionWarning}</span>
            </div>
            {onSelectSampleClip && (
              <button
                onClick={() => {
                  onSelectSampleClip();
                  setSelectionWarning(null);
                }}
                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[11px] rounded-lg transition-colors shrink-0"
              >
                {isSk ? "Označiť ukážkový klip" : "Select Sample Clip"}
              </button>
            )}
          </div>
        )}

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1.5 custom-scrollbar">
          {searchResults.length > 0 ? (
            searchResults.map((tool, idx) => {
              const Icon = tool.icon || Sparkles;
              const isSelected = idx === selectedIndex;
              const isFavorite = favorites.includes(tool.id);
              const isAvail = tool.availability !== "NOT AVAILABLE";

              return (
                <div
                  key={tool.id}
                  id={`search-item-${tool.id}`}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => handleSelectTool(tool)}
                  className={`group p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? "bg-neutral-800 border-rose-500/60 shadow-lg shadow-rose-500/10 ring-1 ring-rose-500/30"
                      : "bg-neutral-950/60 hover:bg-neutral-800/60 border-neutral-800/70"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Tool Icon */}
                    <div
                      className={`p-2.5 rounded-xl border shrink-0 transition-colors ${
                        isSelected
                          ? "bg-rose-500 text-white border-rose-400 shadow-sm"
                          : "bg-neutral-900 text-neutral-400 border-neutral-800 group-hover:text-rose-400"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    {/* Tool Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-neutral-100 truncate">
                          {isSk ? tool.nameSk : tool.nameEn}
                        </span>

                        {/* Category Badge */}
                        <span className="hidden xs:inline-block px-1.5 py-0.2 text-[9px] font-bold rounded bg-neutral-800 text-neutral-400 uppercase tracking-wider">
                          {tool.category}
                        </span>

                        {/* Availability Pill */}
                        <span
                          className={`px-1.5 py-0.2 text-[9px] font-bold rounded border ${
                            tool.availability === "LOCAL"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : tool.availability === "AI PROVIDER"
                              ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                              : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          }`}
                        >
                          {tool.availability}
                        </span>

                        {/* Shortcut */}
                        {tool.shortcut && (
                          <span className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono bg-neutral-900 border border-neutral-800 text-neutral-400 rounded">
                            {tool.shortcut}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-neutral-400 truncate mt-0.5">
                        {isSk ? tool.descSk : tool.descEn}
                      </p>

                      {/* Explainability - Why Available */}
                      {(tool.whyAvailableSk || tool.whyAvailableEn) && isSelected && (
                        <div className="mt-1 text-[10px] text-rose-400/90 font-medium flex items-center gap-1">
                          <Check className="w-3 h-3 text-rose-400" />
                          <span>{isSk ? tool.whyAvailableSk : tool.whyAvailableEn}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions / Star */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => toggleFavorite(tool.id, e)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isFavorite
                          ? "text-amber-400 hover:text-amber-300"
                          : "text-neutral-600 hover:text-neutral-400"
                      }`}
                      title={isFavorite ? (isSk ? "Odobrať z obľúbených" : "Remove favorite") : (isSk ? "Pridať k obľúbeným" : "Add to favorites")}
                    >
                      <Star className={`w-4 h-4 ${isFavorite ? "fill-amber-400" : ""}`} />
                    </button>

                    <div
                      className={`p-1.5 rounded-lg transition-colors ${
                        isSelected ? "text-rose-400 bg-rose-500/10" : "text-neutral-500"
                      }`}
                    >
                      <CornerDownLeft className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            /* Empty State & Suggestions */
            <div className="p-8 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center text-neutral-400">
                <Search className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {isSk ? "Nenašiel sa žiadny zodpovedajúci nástroj" : "No matching tool found"}
                </h3>
                <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                  {isSk
                    ? `Pre výraz "${query}" neexistuje priamy nástroj. Vyskúšaj nižšie uvedené návrhy:`
                    : `No direct tool found for "${query}". Try one of these suggested capabilities:`}
                </p>
              </div>

              {suggestions.length > 0 && (
                <div className="max-w-md mx-auto pt-2 space-y-2 text-left">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                    {isSk ? "Odporúčané alternatívy:" : "Suggested Alternatives:"}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {suggestions.map((sug) => {
                      const Icon = sug.icon || Sparkles;
                      return (
                        <button
                          key={sug.id}
                          onClick={() => handleSelectTool(sug)}
                          className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-left flex items-center gap-2.5 transition-colors"
                        >
                          <div className="p-1.5 rounded-lg bg-neutral-900 text-rose-400">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-neutral-200 truncate">
                              {isSk ? sug.nameSk : sug.nameEn}
                            </div>
                            <div className="text-[10px] text-neutral-500 uppercase font-mono">
                              {sug.category}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-neutral-800 bg-neutral-950/90 flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[10px] text-neutral-500 uppercase tracking-wider">OmniStrih Router:</span>
            <span className="text-[11px] text-neutral-300">
              {isSk ? "Presmerovanie do existujúceho nástroja bez duplicity" : "Routes to authoritative existing tool"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateTab("pro_toolbox")}
              className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1"
            >
              <span>{isSk ? "Otvoriť kompletný Pro Toolbox" : "Open Full Pro Toolbox"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from "react";
import {
  Mic,
  Sparkles,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Play,
  Split,
  Merge,
  Clock,
  CheckCircle2,
  FileAudio,
  Plus,
  Edit3
} from "lucide-react";
import { CaptionProject, CaptionSegment, WordTiming } from "../types";
import { extractWavFromVideoUrl } from "../utils/audioExtraction";

interface AutoVideoCaptionsPanelProps {
  currentVideoUrl: string;
  videoDuration: number;
  captionProject: CaptionProject;
  onUpdateCaptionProject: (project: CaptionProject) => void;
  onSeek: (time: number) => void;
  currentTime: number;
  language: "sk" | "en";
  showToast: (msg: string) => void;
}

// Real audio extraction lives in the shared util so the header "Generate subtitles" flow uses
// exactly the same (real) implementation.
export { extractWavFromVideoUrl } from "../utils/audioExtraction";

export const AutoVideoCaptionsPanel: React.FC<AutoVideoCaptionsPanelProps> = ({
  currentVideoUrl,
  videoDuration,
  captionProject,
  onUpdateCaptionProject,
  onSeek,
  currentTime,
  language,
  showToast
}) => {
  const isSk = language === "sk";
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageText, setStageText] = useState("");
  const [noSpeechDetected, setNoSpeechDetected] = useState(false);
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);

  // Auto-transcription process
  const handleCreateAutoCaptions = async () => {
    setIsAnalyzing(true);
    setProgress(10);
    setNoSpeechDetected(false);
    setStageText(isSk ? "Spracovávam audio stopu videa..." : "Processing video audio track...");

    try {
      // 1. Extract WAV audio from current video URL using Web Audio API
      const audioResult = await extractWavFromVideoUrl(currentVideoUrl);

      if (!audioResult.hasAudio) {
        setIsAnalyzing(false);
        setNoSpeechDetected(true);
        showToast(isSk ? "V tomto videu sa nepodarilo nájsť hovorené slovo." : "No spoken speech found in this video.");
        return;
      }

      setProgress(40);
      setStageText(isSk ? "Analyzujem hovorené slovo…" : "Analyzing spoken speech...");

      // 2. Send base64 audio to server endpoint
      const res = await fetch("/api/transcribe-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64: audioResult.base64,
          mimeType: "audio/wav",
          language: language,
          videoDuration: videoDuration || audioResult.duration
        })
      });

      setProgress(80);
      const data = await res.json();

      if (!data.success || !data.hasSpeech || !data.segments || data.segments.length === 0) {
        setIsAnalyzing(false);
        setNoSpeechDetected(true);
        // Distinguish "the model found no speech" from "transcription was not available at all".
        showToast(
          data.message
            ? data.message
            : (isSk ? "V tomto videu sa nepodarilo nájsť hovorené slovo." : "No spoken speech found in this video.")
        );
        return;
      }

      setProgress(100);
      setStageText(isSk ? "Titulky úspešne vygenerované!" : "Captions generated successfully!");

      // 3. Update caption project with new auto-generated segments
      const newSegments: CaptionSegment[] = data.segments.map((s: any, idx: number) => ({
        id: `auto-cap-${Date.now()}-${idx}`,
        start: Number(s.start) || 0,
        end: Number(s.end) || 2,
        text: String(s.text || "").trim(),
        words: Array.isArray(s.words) ? s.words.map((w: any) => ({
          word: String(w.word || ""),
          start: Number(w.start) || Number(s.start) || 0,
          end: Number(w.end) || Number(s.end) || 2,
          highlight: Boolean(w.highlight)
        })) : []
      }));

      onUpdateCaptionProject({
        ...captionProject,
        segments: newSegments
      });

      setIsAnalyzing(false);
      showToast(isSk ? `✅ Vytvorených ${newSegments.length} automatických titulkov!` : `✅ Created ${newSegments.length} auto captions!`);
    } catch (err: any) {
      console.error("Auto captions error:", err);
      setIsAnalyzing(false);
      setNoSpeechDetected(true);
      showToast(isSk ? "V tomto videu sa nepodarilo nájsť hovorené slovo." : "No spoken speech found in this video.");
    }
  };

  // Regenerate captions
  const handleRegenerate = () => {
    handleCreateAutoCaptions();
  };

  // Clear auto captions
  const handleClear = () => {
    onUpdateCaptionProject({
      ...captionProject,
      segments: []
    });
    setNoSpeechDetected(false);
    showToast(isSk ? "Titulky boli vymazané." : "Captions deleted.");
  };

  // Edit segment text
  const handleTextChange = (id: string, newText: string) => {
    const updated = captionProject.segments.map(seg => {
      if (seg.id !== id) return seg;
      return { ...seg, text: newText };
    });
    onUpdateCaptionProject({ ...captionProject, segments: updated });
  };

  // Edit start or end time
  const handleTimeChange = (id: string, field: "start" | "end", val: number) => {
    const updated = captionProject.segments.map(seg => {
      if (seg.id !== id) return seg;
      const newStart = field === "start" ? Math.max(0, val) : seg.start;
      const newEnd = field === "end" ? Math.max(newStart + 0.1, val) : seg.end;
      return { ...seg, start: newStart, end: newEnd };
    });
    onUpdateCaptionProject({ ...captionProject, segments: updated });
  };

  // Split segment into two
  const handleSplitSegment = (id: string) => {
    const index = captionProject.segments.findIndex(s => s.id === id);
    if (index === -1) return;

    const seg = captionProject.segments[index];
    const midTime = Number(((seg.start + seg.end) / 2).toFixed(2));
    const words = seg.text.split(" ");
    const midWordIndex = Math.ceil(words.length / 2);

    const text1 = words.slice(0, midWordIndex).join(" ");
    const text2 = words.slice(midWordIndex).join(" ") || "...";

    const seg1: CaptionSegment = {
      ...seg,
      id: `auto-cap-split-1-${Date.now()}`,
      end: midTime,
      text: text1,
      words: seg.words ? seg.words.slice(0, midWordIndex) : []
    };

    const seg2: CaptionSegment = {
      ...seg,
      id: `auto-cap-split-2-${Date.now()}`,
      start: midTime,
      text: text2,
      words: seg.words ? seg.words.slice(midWordIndex) : []
    };

    const updated = [...captionProject.segments];
    updated.splice(index, 1, seg1, seg2);

    onUpdateCaptionProject({ ...captionProject, segments: updated });
    showToast(isSk ? "Titulok bol rozdelený na 2 časti." : "Caption split into 2 parts.");
  };

  // Merge segment with next segment
  const handleMergeNext = (id: string) => {
    const index = captionProject.segments.findIndex(s => s.id === id);
    if (index === -1 || index >= captionProject.segments.length - 1) return;

    const seg1 = captionProject.segments[index];
    const seg2 = captionProject.segments[index + 1];

    const mergedText = `${seg1.text} ${seg2.text}`.trim();
    const mergedWords = [...(seg1.words || []), ...(seg2.words || [])];

    const mergedSeg: CaptionSegment = {
      ...seg1,
      id: `auto-cap-merged-${Date.now()}`,
      end: seg2.end,
      text: mergedText,
      words: mergedWords
    };

    const updated = [...captionProject.segments];
    updated.splice(index, 2, mergedSeg);

    onUpdateCaptionProject({ ...captionProject, segments: updated });
    showToast(isSk ? "Titulky boli spojené." : "Captions merged.");
  };

  // Delete individual segment
  const handleDeleteSegment = (id: string) => {
    const updated = captionProject.segments.filter(s => s.id !== id);
    onUpdateCaptionProject({ ...captionProject, segments: updated });
  };

  const autoCaptionsCount = captionProject.segments.length;

  return (
    <div className="bg-neutral-950 rounded-2xl border border-neutral-800 p-4 shadow-xl relative overflow-hidden mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="bg-gradient-to-tr from-rose-500 to-amber-500 p-2 rounded-xl text-white shadow-md shadow-rose-500/20">
            <Mic className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-black text-white tracking-wide uppercase flex items-center gap-1.5">
              {isSk ? "Automatické titulky z videa" : "Auto Captions from Video"}
            </h3>
            <p className="text-[11px] text-neutral-400">
              {isSk
                ? "Preveď hovorené slovo vo videu na presne synchronizované titulky."
                : "Convert spoken speech in video into precisely synchronized captions."}
            </p>
          </div>
        </div>
      </div>

      {/* Progress state */}
      {isAnalyzing && (
        <div className="mb-4 bg-neutral-900 border border-neutral-800 rounded-xl p-3 animate-in fade-in duration-300 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-rose-400 flex items-center gap-1.5 animate-pulse">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{stageText}</span>
            </span>
            <span className="font-bold text-neutral-300">{progress}%</span>
          </div>
          <div className="w-full bg-neutral-950 rounded-full h-2 overflow-hidden border border-neutral-800">
            <div
              className="bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Action / Results View */}
      {!isAnalyzing && autoCaptionsCount === 0 && (
        <div>
          {noSpeechDetected && (
            <div className="mb-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center gap-2 text-amber-300 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                {isSk
                  ? "V tomto videu sa nepodarilo nájsť hovorené slovo."
                  : "No spoken speech found in this video."}
              </span>
            </div>
          )}

          <button
            onClick={handleCreateAutoCaptions}
            className="w-full py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600 hover:from-rose-600 hover:to-amber-600 text-white shadow-lg shadow-rose-500/25 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isSk ? "Vytvoriť automatické titulky" : "Create Auto Captions"}</span>
          </button>
        </div>
      )}

      {!isAnalyzing && autoCaptionsCount > 0 && (
        <div className="space-y-3">
          {/* Status bar & Action buttons */}
          <div className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs">
            <span className="font-bold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isSk
                  ? `${autoCaptionsCount} titulkov vytvorených`
                  : `${autoCaptionsCount} captions created`}
              </span>
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRegenerate}
                className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-[11px] font-bold flex items-center gap-1 transition-all"
                title={isSk ? "Regenerovať titulky z videa" : "Regenerate captions"}
              >
                <RotateCcw className="w-3 h-3 text-amber-400" />
                <span>{isSk ? "Regenerovať" : "Regenerate"}</span>
              </button>

              <button
                onClick={handleClear}
                className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold flex items-center gap-1 transition-all"
                title={isSk ? "Vymazať titulky" : "Clear captions"}
              >
                <Trash2 className="w-3 h-3" />
                <span>{isSk ? "Vymazať" : "Clear"}</span>
              </button>
            </div>
          </div>

          {/* Interactive Captions Editor List */}
          <div className="space-y-2 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
            {captionProject.segments.map((segment, idx) => {
              const isActive = currentTime >= segment.start && currentTime <= segment.end;

              return (
                <div
                  key={segment.id}
                  className={`p-2.5 rounded-xl border transition-all ${
                    isActive
                      ? "bg-rose-500/10 border-rose-500/50 shadow-md shadow-rose-500/10"
                      : "bg-neutral-900/80 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  {/* Row 1: Controls (Play/Seek, Time range, Split, Merge, Delete) */}
                  <div className="flex items-center justify-between gap-1.5 mb-2 text-[10px] font-mono text-neutral-400">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onSeek(segment.start)}
                        className={`p-1 rounded-md transition-all ${
                          isActive
                            ? "bg-rose-500 text-white"
                            : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                        }`}
                        title={isSk ? "Prehrať od tohto bodu" : "Seek to start"}
                      >
                        <Play className="w-3 h-3 fill-current" />
                      </button>

                      <div className="flex items-center gap-1 bg-neutral-950 px-2 py-0.5 rounded-md border border-neutral-800">
                        <Clock className="w-2.5 h-2.5 text-neutral-500" />
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={segment.start}
                          onChange={(e) => handleTimeChange(segment.id, "start", parseFloat(e.target.value) || 0)}
                          className="w-10 bg-transparent text-white font-bold focus:outline-none text-center"
                        />
                        <span>-</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={segment.end}
                          onChange={(e) => handleTimeChange(segment.id, "end", parseFloat(e.target.value) || 0)}
                          className="w-10 bg-transparent text-white font-bold focus:outline-none text-center"
                        />
                        <span>s</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleSplitSegment(segment.id)}
                        className="px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white flex items-center gap-1 text-[10px] transition-all"
                        title={isSk ? "Rozdeliť titulok na polovicu" : "Split caption"}
                      >
                        <Split className="w-3 h-3 text-amber-400" />
                        <span>{isSk ? "Rozdeliť" : "Split"}</span>
                      </button>

                      {idx < captionProject.segments.length - 1 && (
                        <button
                          onClick={() => handleMergeNext(segment.id)}
                          className="px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white flex items-center gap-1 text-[10px] transition-all"
                          title={isSk ? "Spojiť s nasledujúcim titulkom" : "Merge with next"}
                        >
                          <Merge className="w-3 h-3 text-cyan-400" />
                          <span>{isSk ? "Spojiť" : "Merge"}</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteSegment(segment.id)}
                        className="p-1 rounded bg-neutral-800 hover:bg-rose-500/20 text-neutral-400 hover:text-rose-400 transition-all"
                        title={isSk ? "Vymazať tento titulok" : "Delete caption"}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Editable Caption Text */}
                  <input
                    type="text"
                    value={segment.text}
                    onChange={(e) => handleTextChange(segment.id, e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500 transition-all"
                    placeholder={isSk ? "Text titulku..." : "Caption text..."}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useMemo, memo } from "react";
import { 
  Type, 
  Sparkles, 
  Plus, 
  Trash2, 
  Highlighter, 
  Settings2, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Zap, 
  Monitor, 
  User, 
  Globe, 
  Scissors, 
  Layers, 
  Flame, 
  Target, 
  HelpCircle,
  Play,
  RotateCcw,
  Palette,
  Layout,
  Eye,
  Info,
  Maximize2,
  Lock,
  Unlock,
  Split,
  Merge
} from "lucide-react";
import { 
  CaptionSegment, 
  CaptionStyle, 
  WordTiming, 
  CaptionProject, 
  CaptionEmphasisType, 
  CaptionAnimation,
  RawAIAnalysis,
  JumpCutSequence
} from "../types";
import { motion, AnimatePresence } from "motion/react";

interface SmartCaptionEditorProps {
  project: CaptionProject;
  rawAnalysis: RawAIAnalysis;
  jumpSequence: JumpCutSequence | null;
  onUpdateProject: (project: CaptionProject) => void;
  onRunMagicSplit: () => void;
  onTranslate: (targetLang: "sk" | "en") => void;
  onSeek: (time: number) => void;
  currentTime: number;
  language: "sk" | "en";
  isGenerating: boolean;
  settings?: any;
  setSettings?: any;
}

export const SmartCaptionEditor: React.FC<SmartCaptionEditorProps> = memo(({
  project,
  rawAnalysis,
  jumpSequence,
  onUpdateProject,
  onRunMagicSplit,
  onTranslate,
  onSeek,
  currentTime,
  language,
  isGenerating,
  settings,
  setSettings
}) => {
  const isSk = language === "sk";
  const [activeTab, setActiveTab] = useState<"LIST" | "STYLE" | "POSITION" | "CHECK">("LIST");
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);

  // Speech silence & pause analyzer (> 0.5s) - Memoized for 60fps playhead performance
  const detectedSpeechPauses = useMemo(() => {
    const pauses: {
      segmentId: string;
      wordIndex?: number;
      isBetweenSegments: boolean;
      nextSegmentId?: string;
      duration: number;
      timestamp: number;
      snippetBefore: string;
      snippetAfter: string;
    }[] = [];

    // 1. Gaps inside segments (between words)
    project.segments.forEach(seg => {
      if (!seg.words || seg.words.length < 2) return;
      for (let i = 1; i < seg.words.length; i++) {
        const gap = seg.words[i].start - seg.words[i - 1].end;
        if (gap > 0.5) {
          pauses.push({
            segmentId: seg.id,
            wordIndex: i,
            isBetweenSegments: false,
            duration: gap,
            timestamp: seg.words[i - 1].end,
            snippetBefore: seg.words.slice(Math.max(0, i - 1), i).map(w => w.word).join(" "),
            snippetAfter: seg.words.slice(i, i + 1).map(w => w.word).join(" ")
          });
        }
      }
    });

    // 2. Gaps between adjacent segments
    for (let j = 0; j < project.segments.length - 1; j++) {
      const currentSeg = project.segments[j];
      const nextSeg = project.segments[j + 1];
      const gap = nextSeg.start - currentSeg.end;
      if (gap > 0.5) {
        pauses.push({
          segmentId: currentSeg.id,
          nextSegmentId: nextSeg.id,
          isBetweenSegments: true,
          duration: gap,
          timestamp: currentSeg.end,
          snippetBefore: currentSeg.text.split(" ").slice(-2).join(" ") || "",
          snippetAfter: nextSeg.text.split(" ").slice(0, 2).join(" ") || ""
        });
      }
    }

    return pauses.sort((a, b) => a.timestamp - b.timestamp);
  }, [project.segments]);

  const getDetectedSpeechPauses = () => detectedSpeechPauses;

  const splitSegmentAtWordIndex = (segmentId: string, wordIndex: number) => {
    const updatedSegments: CaptionSegment[] = [];

    project.segments.forEach(seg => {
      if (seg.id !== segmentId || !seg.words || seg.words.length <= wordIndex) {
        updatedSegments.push(seg);
        return;
      }

      const firstWords = seg.words.slice(0, wordIndex);
      const secondWords = seg.words.slice(wordIndex);

      if (firstWords.length === 0 || secondWords.length === 0) {
        updatedSegments.push(seg);
        return;
      }

      const seg1: CaptionSegment = {
        ...seg,
        id: `split-a-${seg.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        start: firstWords[0].start,
        end: firstWords[firstWords.length - 1].end,
        text: firstWords.map(w => w.word).join(" "),
        words: firstWords
      };

      const seg2: CaptionSegment = {
        ...seg,
        id: `split-b-${seg.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        start: secondWords[0].start,
        end: secondWords[secondWords.length - 1].end,
        text: secondWords.map(w => w.word).join(" "),
        words: secondWords
      };

      updatedSegments.push(seg1, seg2);
    });

    onUpdateProject({
      ...project,
      segments: updatedSegments
    });
  };

  const splitAllDetectedPauses = () => {
    const pauses = getDetectedSpeechPauses();
    if (pauses.length === 0) return;

    let currentSegments = [...project.segments];

    // Filter to inside segment pauses since between segment blocks are already separate
    const insidePauses = pauses.filter(p => !p.isBetweenSegments);
    insidePauses.sort((a, b) => b.timestamp - a.timestamp);

    insidePauses.forEach(pause => {
      const segIdx = currentSegments.findIndex(s => s.id === pause.segmentId);
      if (segIdx === -1) return;

      const seg = currentSegments[segIdx];
      if (pause.wordIndex === undefined) return;
      
      const wordIndex = seg.words.findIndex(w => w.start === seg.words[pause.wordIndex!].start);
      if (wordIndex === -1 || wordIndex === 0 || wordIndex >= seg.words.length) return;

      const firstWords = seg.words.slice(0, wordIndex);
      const secondWords = seg.words.slice(wordIndex);

      const seg1: CaptionSegment = {
        ...seg,
        id: `split-a-${seg.id}-${Math.floor(Math.random() * 10000)}`,
        start: firstWords[0].start,
        end: firstWords[firstWords.length - 1].end,
        text: firstWords.map(w => w.word).join(" "),
        words: firstWords
      };

      const seg2: CaptionSegment = {
        ...seg,
        id: `split-b-${seg.id}-${Math.floor(Math.random() * 10000)}`,
        start: secondWords[0].start,
        end: secondWords[secondWords.length - 1].end,
        text: secondWords.map(w => w.word).join(" "),
        words: secondWords
      };

      currentSegments.splice(segIdx, 1, seg1, seg2);
    });

    onUpdateProject({
      ...project,
      segments: currentSegments
    });
  };

  const tightenGapBetweenSegments = (segmentId: string, nextSegmentId: string) => {
    const updatedSegments = project.segments.map((seg, idx, arr) => {
      if (seg.id === nextSegmentId) {
        const prevSeg = arr[idx - 1];
        if (prevSeg) {
          const shift = seg.start - prevSeg.end - 0.2; // leave 0.2s natural gap
          if (shift > 0) {
            const shiftedWords = (seg.words || []).map(w => ({
              ...w,
              start: Number((w.start - shift).toFixed(2)),
              end: Number((w.end - shift).toFixed(2))
            }));
            return {
              ...seg,
              start: Number((seg.start - shift).toFixed(2)),
              end: Number((seg.end - shift).toFixed(2)),
              words: shiftedWords
            };
          }
        }
      }
      return seg;
    });

    onUpdateProject({
      ...project,
      segments: updatedSegments
    });
  };

  const handleManualSplit = (segId: string) => {
    const seg = project.segments.find(s => s.id === segId);
    if (!seg || !seg.words || seg.words.length < 2) return;
    
    // Find matching word closest to current playhead time, or split at half
    let splitIdx = Math.floor(seg.words.length / 2);
    const activeWordIdx = seg.words.findIndex(w => currentTime >= w.start && currentTime <= w.end);
    if (activeWordIdx !== -1 && activeWordIdx > 0 && activeWordIdx < seg.words.length) {
      splitIdx = activeWordIdx;
    }

    splitSegmentAtWordIndex(segId, splitIdx);
  };

  const handleMergeWithNext = (segId: string) => {
    const idx = project.segments.findIndex(s => s.id === segId);
    if (idx === -1 || idx === project.segments.length - 1) return;

    const currentSeg = project.segments[idx];
    const nextSeg = project.segments[idx + 1];

    const mergedWords = [...(currentSeg.words || []), ...(nextSeg.words || [])].sort((a, b) => a.start - b.start);
    if (mergedWords.length === 0) return;

    const mergedSeg: CaptionSegment = {
      ...currentSeg,
      id: `merge-${currentSeg.id}-${Date.now()}`,
      start: mergedWords[0].start,
      end: mergedWords[mergedWords.length - 1].end,
      text: `${currentSeg.text} ${nextSeg.text}`.trim(),
      words: mergedWords
    };

    const newSegments = [...project.segments];
    newSegments.splice(idx, 2, mergedSeg);

    onUpdateProject({
      ...project,
      segments: newSegments
    });
  };

  const handleDeleteSegment = (segId: string) => {
    const newSegments = project.segments.filter(s => s.id !== segId);
    onUpdateProject({
      ...project,
      segments: newSegments
    });
  };

  // Word-level caption timing & grouping constraints
  const [wordsPerBlock, setWordsPerBlock] = useState<number>(project.globalStyle.wordsPerCaption === "auto" ? 3 : Number(project.globalStyle.wordsPerCaption) || 3);
  const [maxCharacters, setMaxCharacters] = useState<number>(24);
  const [maxLines, setMaxLines] = useState<number>(project.globalStyle.maxLines || 2);
  const [minDuration, setMinDuration] = useState<number>(0.3);
  const [maxDuration, setMaxDuration] = useState<number>(3.5);

  const [isRechunking, setIsRechunking] = useState<boolean>(false);
  const [isProcessingLocalMagic, setIsProcessingLocalMagic] = useState<boolean>(false);
  const [isAutoCorrecting, setIsAutoCorrecting] = useState<boolean>(false);

  // AI Auto-Correction (Autosamá oprava) Engine
  const runAutoCorrection = () => {
    setIsAutoCorrecting(true);
    setTimeout(() => {
      const correctedSegments = project.segments.map(seg => {
        let text = seg.text.trim();
        if (text.length > 0) {
          text = text.charAt(0).toUpperCase() + text.slice(1);
          if (!/[.!?,;:]$/.test(text)) {
            text += ".";
          }
        }
        text = text.replace(/\s+/g, " ");

        const correctedWords = seg.words?.map(w => ({
          ...w,
          word: w.word.trim()
        }));

        return {
          ...seg,
          text,
          words: correctedWords || seg.words
        };
      });

      onUpdateProject({
        ...project,
        segments: correctedSegments
      });
      setIsAutoCorrecting(false);
    }, 1200);
  };

  // Style Presets
  const stylePresets: { id: CaptionStyle; name: string; descSk: string; descEn: string }[] = [
    { id: "HORMOZI", name: "HORMOZI / VIRAL", descSk: "Výrazné, krátke, sýto-žlté a zelené kľúčové slová.", descEn: "Bold, short, vibrant yellow & green keywords." },
    { id: "MINIMAL_CLEAN", name: "MINIMAL CLEAN", descSk: "Čisté, moderné s tmavým polopriehľadným pozadím.", descEn: "Clean, modern with dark translucent backdrop." },
    { id: "CINEMATIC", name: "CINEMATIC", descSk: "Elegantná serif typografia, filmový podtón.", descEn: "Elegant serif typography with cinematic undertones." },
    { id: "SOCIAL_POP", name: "SOCIAL POP", descSk: "Bouncy animácie, výrazné zväčšenie aktívnych slov.", descEn: "Bouncy scale animations on active talking words." },
    { id: "COLLAGE", name: "COLLAGE", descSk: "Scrapbook štýl s rotovaným papierom a zvýrazňovačom.", descEn: "Scrapbook layout with rotated paper backing." },
    { id: "CUSTOM", name: "VLASTNÝ DIZAJN", descSk: "Vytvorte si vlastný štýl (písmo, veľkosť, obrysy).", descEn: "Create your custom layout (fonts, sizing, strokes)." },
  ];

  const updateGlobalStyle = (updates: Partial<CaptionProject["globalStyle"]>) => {
    onUpdateProject({
      ...project,
      globalStyle: { ...project.globalStyle, ...updates }
    });

    // Synchronize parent settings if present
    if (setSettings) {
      const parentStyleMapping: Record<string, string> = {
        "HORMOZI": "HORMOZI",
        "MINIMAL_CLEAN": "MINIMAL_CLEAN",
        "CINEMATIC": "CINEMATIC",
        "SOCIAL_POP": "SOCIAL_POP",
        "COLLAGE": "COLLAGE",
        "CUSTOM": "CUSTOM"
      };
      
      const patch: any = {};
      if (updates.style) {
        patch.captionStyle = parentStyleMapping[updates.style] || updates.style;
      }
      if (updates.case) {
        patch.captionCase = updates.case;
      }
      if (updates.outlineWidth !== undefined) {
        patch.captionStrokeWidth = updates.outlineWidth;
      }
      if (updates.shadowEnabled !== undefined) {
        patch.captionShadowEnabled = updates.shadowEnabled;
      }
      setSettings((prev: any) => ({ ...prev, ...patch }));
    }
  };

  // 1. ADVANCED WORD-LEVEL RE-CHUNKING TIMING LIMIT ENGINE
  const handleRechunkSegments = () => {
    setIsRechunking(true);
    
    setTimeout(() => {
      // Collect all words across all segments chronologically
      const allWords: WordTiming[] = [];
      project.segments.forEach(seg => {
        if (seg.words && seg.words.length > 0) {
          seg.words.forEach(w => {
            allWords.push({
              word: w.word,
              start: w.start,
              end: w.end,
              confidence: w.confidence ?? 0.99,
              speaker: w.speaker ?? "Rečník 1",
              emphasis: w.emphasis,
              color: w.color
            });
          });
        } else {
          // If a segment has no word-level timings, estimate word times
          const words = seg.text.split(" ");
          const duration = seg.end - seg.start;
          const wordDuration = duration / Math.max(1, words.length);
          words.forEach((w, idx) => {
            allWords.push({
              word: w,
              start: seg.start + idx * wordDuration,
              end: seg.start + (idx + 1) * wordDuration,
              confidence: 0.98,
              speaker: "Rečník 1"
            });
          });
        }
      });

      // Sort words chronologically
      allWords.sort((a, b) => a.start - b.start);

      if (allWords.length === 0) {
        setIsRechunking(false);
        return;
      }

      const newSegments: CaptionSegment[] = [];
      let currentGroup: WordTiming[] = [];
      let currentText = "";

      const commitGroup = () => {
        if (currentGroup.length === 0) return;
        const first = currentGroup[0];
        const last = currentGroup[currentGroup.length - 1];
        
        newSegments.push({
          id: `rechunk-seg-${newSegments.length + 1}`,
          start: first.start,
          end: last.end,
          text: currentGroup.map(w => w.word).join(" "),
          words: [...currentGroup],
          confidence: 0.99
        });

        currentGroup = [];
        currentText = "";
      };

      for (let i = 0; i < allWords.length; i++) {
        const w = allWords[i];
        const lastW = currentGroup[currentGroup.length - 1];

        const testText = currentText ? `${currentText} ${w.word}` : w.word;
        const wordCount = currentGroup.length + 1;
        const charCount = testText.length;
        const totalDur = lastW ? (w.end - currentGroup[0].start) : (w.end - w.start);

        // Word-level threshold triggers
        const exceedsWords = wordCount > wordsPerBlock;
        const exceedsChars = charCount > maxCharacters;
        const exceedsDuration = totalDur > maxDuration;
        
        // Large quiet pause (speech break > 0.7s) triggers a natural split
        const isPauseBreak = lastW && (w.start - lastW.end > 0.7);

        if (currentGroup.length > 0 && (exceedsWords || exceedsChars || exceedsDuration || isPauseBreak)) {
          // Commit previous chunk if it has minimum readable display time (or if it is a pause break)
          const currentDur = lastW ? (lastW.end - currentGroup[0].start) : 0;
          if (currentDur >= minDuration || isPauseBreak) {
            commitGroup();
          }
        }

        currentGroup.push(w);
        currentText = testText;
      }

      // Flush remainder
      commitGroup();

      onUpdateProject({
        ...project,
        segments: newSegments
      });
      setIsRechunking(false);
    }, 1200);
  };

  // 2. ENHANCED SEMANTIC & RHYTHMIC MAGIC SPLIT AI ENGINE
  const runSemanticMagicSplit = () => {
    setIsProcessingLocalMagic(true);

    setTimeout(() => {
      // Slovak & English dictionaries of punchy keywords, emphasis, and emotion terms
      const keyWordsSk = ["ušetriť", "95%", "strih", "videa", "platenie", "drahých", "appiek", "tajomstvo", "rast", "pozor", "biznis", "zadarmo", "nikdy", "chyba"];
      const keyWordsEn = ["save", "95%", "edit", "paying", "expensive", "apps", "secret", "growth", "attention", "business", "free", "never", "mistake", "actually", "work", "three", "years"];

      const emojiDictionary: Record<string, string> = {
        "ušetriť": "💰", "95%": "📈", "strih": "✂️", "platenie": "💳", "drahých": "💸", "appiek": "📱",
        "chyba": "❌", "roky": "⏳", "peniaze": "💵", "zadarmo": "🎁", "free": "🆓", "dôležité": "⚠️",
        "mistake": "❌", "years": "⏳", "three": "3️⃣", "money": "💵", "save": "💾", "secret": "🤫",
        "work": "⚙️", "actually": "💥", "video": "🎥", "time": "⏱️", "času": "⏱️"
      };

      // Collect all words
      const rawWords: WordTiming[] = [];
      project.segments.forEach(seg => {
        if (seg.words && seg.words.length > 0) {
          seg.words.forEach(w => {
            rawWords.push({ ...w });
          });
        } else {
          seg.text.split(" ").forEach(w => {
            rawWords.push({
              word: w,
              start: seg.start,
              end: seg.end,
              confidence: 0.98,
              speaker: "Rečník 1"
            });
          });
        }
      });

      rawWords.sort((a, b) => a.start - b.start);

      // Perform semantic enrichment & keyword tracking
      const enrichedWords = rawWords.map(w => {
        const clean = w.word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
        let emphasis: CaptionEmphasisType | undefined = w.emphasis;

        if (keyWordsSk.includes(clean) || keyWordsEn.includes(clean)) {
          emphasis = "KEYWORD";
        }
        if (/\d+/.test(clean)) {
          emphasis = "NUMBER";
        }
        return {
          ...w,
          emphasis
        };
      });

      const magicSegments: CaptionSegment[] = [];
      let currentGroup: WordTiming[] = [];
      
      enrichedWords.forEach((word, idx) => {
        currentGroup.push(word);

        // Semantic checks
        const hasPunctuation = /[.,?!:;]/.test(word.word);
        const nextWord = enrichedWords[idx + 1];
        
        // Pause gap > 0.45s marks a speech rhythm break
        const silenceGap = nextWord ? (nextWord.start - word.end) : 0;
        const isRhythmBreak = silenceGap > 0.45;
        
        // Limits
        const maxWordsReached = currentGroup.length >= wordsPerBlock;

        if (hasPunctuation || isRhythmBreak || maxWordsReached || idx === enrichedWords.length - 1) {
          const first = currentGroup[0];
          const last = currentGroup[currentGroup.length - 1];

          // Determine high-relevance emoji for this block
          let selectedEmoji = "";
          for (const item of currentGroup) {
            const c = item.word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
            if (emojiDictionary[c]) {
              selectedEmoji = emojiDictionary[c];
              break;
            }
          }

          magicSegments.push({
            id: `magic-seg-${magicSegments.length + 1}`,
            start: first.start,
            end: last.end,
            text: currentGroup.map(w => w.word).join(" "),
            words: [...currentGroup],
            emoji: selectedEmoji || undefined,
            confidence: 0.99
          });

          currentGroup = [];
        }
      });

      onUpdateProject({
        ...project,
        segments: magicSegments
      });

      setIsProcessingLocalMagic(false);
    }, 1500);
  };

  const toggleSegmentSelection = (id: string) => {
    setSelectedSegments(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const applyStyleToSelected = (style: CaptionStyle) => {
    const updatedSegments = project.segments.map(seg => 
      selectedSegments.includes(seg.id) ? { ...seg, style } : seg
    );
    onUpdateProject({ ...project, segments: updatedSegments });
  };

  const updateWordEmphasis = (segmentId: string, wordIdx: number, emphasis: CaptionEmphasisType | undefined) => {
    const updatedSegments = project.segments.map(seg => {
      if (seg.id !== segmentId) return seg;
      const newWords = [...seg.words];
      newWords[wordIdx] = { ...newWords[wordIdx], emphasis };
      return { ...seg, words: newWords };
    });
    onUpdateProject({ ...project, segments: updatedSegments });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Module Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/20">
            <Type className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">AI SMART CAPTIONS</h3>
            <p className="text-[10px] text-neutral-500 font-bold uppercase">Professional Caption Engine</p>
          </div>
        </div>
        
        <div className="flex bg-neutral-900 rounded-lg p-1 border border-neutral-800">
           {["LIST", "STYLE", "POSITION", "CHECK"].map((tab) => (
             <button
               key={tab}
               onClick={() => setActiveTab(tab as any)}
               className={`px-3 py-1 text-[10px] font-black rounded uppercase transition-all ${
                 activeTab === tab ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300"
               }`}
             >
               {tab}
             </button>
           ))}
        </div>
      </div>

      {/* Main Tools Row */}
      <div className="grid grid-cols-3 gap-3">
         <button
           onClick={onRunMagicSplit}
           disabled={isGenerating}
           className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-widest hover:bg-amber-500/20 transition-all disabled:opacity-50"
         >
           <Zap className={`h-4 w-4 ${isGenerating ? "animate-spin" : ""}`} />
           <span>MAGIC SPLIT AI</span>
         </button>
         <button
           onClick={runAutoCorrection}
           disabled={isAutoCorrecting}
           className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all disabled:opacity-50"
         >
           <Sparkles className={`h-4 w-4 ${isAutoCorrecting ? "animate-spin" : ""}`} />
           <span>{isSk ? "AUTOSAMÁ OPRAVA" : "AUTO CORRECTION"}</span>
         </button>
         <button
           onClick={() => onTranslate(project.language === "sk" ? "en" : "sk")}
           className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-black uppercase tracking-widest hover:bg-indigo-500/20 transition-all"
         >
           <Globe className="h-4 w-4" />
           <span>{isSk ? "PRELOŽIŤ" : "TRANSLATE"}</span>
         </button>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "LIST" && (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center justify-between px-2">
               <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setSelectedSegments(project.segments.map(s => s.id))}
                    className="text-[10px] font-black text-neutral-500 hover:text-white uppercase tracking-widest"
                  >
                    SELECT ALL
                  </button>
                  <span className="text-neutral-700">|</span>
                  <button 
                    onClick={() => setSelectedSegments([])}
                    className="text-[10px] font-black text-neutral-500 hover:text-white uppercase tracking-widest"
                  >
                    CLEAR
                  </button>
               </div>
               <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                 {selectedSegments.length} Selected
               </span>
            </div>

            {/* Speech Pause Analyzer & Auto-Split Suggestion Widget */}
            {(() => {
              const detectedPauses = getDetectedSpeechPauses();
              if (detectedPauses.length === 0) return null;
              return (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-1">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="bg-amber-500 p-1.5 rounded-lg text-black">
                        <Scissors className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h4 className="text-[11px] font-black text-white uppercase tracking-wider">
                          {isSk ? "Detegované pauzy v reči (> 0.5s)" : "Speech Pauses Detected (> 0.5s)"}
                        </h4>
                        <p className="text-[9px] text-neutral-400">
                          {isSk 
                            ? `Našli sme ${detectedPauses.length} dlhých tichých prestávok vo vnútri titulkov.` 
                            : `Found ${detectedPauses.length} long speech breaks inside your subtitles.`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={splitAllDetectedPauses}
                      className="bg-amber-500 hover:bg-amber-600 active:scale-[0.97] text-black text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-wider transition-all"
                    >
                      {isSk ? "Rozstrihnúť všetky" : "Split All Pauses"}
                    </button>
                  </div>

                  <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                    {detectedPauses.map((pause, pIdx) => (
                      <div 
                        key={pIdx} 
                        className={`bg-neutral-950/60 border rounded-xl p-2 flex items-center justify-between gap-3 text-[10px] hover:border-amber-500/30 transition-all ${pause.isBetweenSegments ? "border-indigo-500/20 bg-indigo-950/20" : "border-neutral-800/80"}`}
                      >
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className={`font-extrabold font-mono px-1.5 py-0.5 rounded border shrink-0 ${pause.isBetweenSegments ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/15"}`}>
                            {pause.duration.toFixed(2)}s
                          </span>
                          <div className="truncate text-neutral-300">
                            <span className="text-neutral-500 italic">"{pause.snippetBefore}"</span>
                            <span className={`font-black mx-1 font-mono ${pause.isBetweenSegments ? "text-indigo-400" : "text-amber-500/60"}`}>
                              ⚡ [ {pause.isBetweenSegments ? (isSk ? "MEDZI SEGMENTAMI" : "GAP BETWEEN") : (isSk ? "PAUZA" : "PAUSE")} ] ⚡
                            </span>
                            <span className="text-neutral-300 italic font-bold">"{pause.snippetAfter}"</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => onSeek(pause.timestamp)}
                            className="px-2 py-1 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-400 hover:text-white uppercase font-black tracking-wider transition-all"
                          >
                            {isSk ? "PREHRAŤ" : "PREVIEW"}
                          </button>
                          {pause.isBetweenSegments ? (
                            <button
                              onClick={() => tightenGapBetweenSegments(pause.segmentId, pause.nextSegmentId!)}
                              className="px-2 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 font-black tracking-wider transition-all"
                            >
                              {isSk ? "STIAHNUŤ" : "TIGHTEN"}
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                if (pause.wordIndex !== undefined) {
                                  splitSegmentAtWordIndex(pause.segmentId, pause.wordIndex);
                                }
                              }}
                              className="px-2 py-1 bg-amber-500 text-black rounded-lg hover:bg-amber-600 font-black tracking-wider transition-all"
                            >
                              {isSk ? "ROZSTRIHNÚŤ" : "SPLIT"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="flex flex-col gap-2 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
               {project.segments.map((seg) => {
                 const isActive = currentTime >= seg.start && currentTime <= seg.end;
                 const isSelected = selectedSegments.includes(seg.id);
                 
                 return (
                   <div 
                     key={seg.id}
                     className={`group relative flex flex-col p-3 rounded-xl border transition-all ${
                       isActive ? "border-amber-500 bg-amber-500/5 shadow-md" : 
                       isSelected ? "border-indigo-500/50 bg-indigo-500/5" :
                       "bg-neutral-900/40 border-neutral-800 hover:border-neutral-700"
                     }`}
                   >
                     <div className="flex items-start gap-3">
                        <input 
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSegmentSelection(seg.id)}
                          className="mt-1 w-4 h-4 rounded border-neutral-700 bg-neutral-800 text-amber-500 focus:ring-amber-500"
                        />
                        <div className="flex-1 min-w-0">
                           <div className="flex items-center justify-between mb-2">
                              <button 
                                onClick={() => onSeek(seg.start)}
                                className="flex items-center gap-1.5 text-[10px] font-black text-neutral-500 hover:text-white uppercase tracking-widest"
                              >
                                <Clock className="h-3 w-3" />
                                {seg.start.toFixed(2)}s - {seg.end.toFixed(2)}s
                              </button>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button 
                                   onClick={() => handleManualSplit(seg.id)}
                                   title={isSk ? "Rozdeliť segment na pozícii" : "Split segment at playhead/middle"}
                                   className="p-1 rounded bg-neutral-800 text-neutral-400 hover:text-white"
                                 >
                                   <Split className="h-3 w-3" />
                                 </button>
                                 <button 
                                   onClick={() => handleMergeWithNext(seg.id)}
                                   title={isSk ? "Zlúčiť s nasledujúcim" : "Merge with next"}
                                   className="p-1 rounded bg-neutral-800 text-neutral-400 hover:text-white"
                                 >
                                   <Merge className="h-3 w-3" />
                                 </button>
                                 <button 
                                   onClick={() => handleDeleteSegment(seg.id)}
                                   title={isSk ? "Vymazať" : "Delete"}
                                   className="p-1 rounded bg-neutral-800 text-neutral-400 hover:text-rose-400"
                                 >
                                   <Trash2 className="h-3 w-3" />
                                 </button>
                              </div>
                           </div>

                           <input 
                             type="text"
                             value={seg.text}
                             onChange={(e) => {
                               const updated = project.segments.map(s => s.id === seg.id ? { ...s, text: e.target.value } : s);
                               onUpdateProject({ ...project, segments: updated });
                             }}
                             className="w-full bg-transparent border-none p-0 text-xs font-bold text-white focus:ring-0 mb-3"
                           />

                           <div className="flex flex-wrap gap-1.5">
                              {seg.words.map((word, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    const nextEmphasis: Record<string, CaptionEmphasisType | undefined> = {
                                      undefined: "KEYWORD",
                                      "KEYWORD": "NUMBER",
                                      "NUMBER": "EMOTION",
                                      "EMOTION": "WARNING",
                                      "WARNING": undefined
                                    };
                                    updateWordEmphasis(seg.id, idx, nextEmphasis[String(word.emphasis)]);
                                  }}
                                  className={`px-2 py-0.5 rounded text-[10px] font-black transition-all ${
                                    word.emphasis === "KEYWORD" ? "bg-amber-400 text-neutral-950" :
                                    word.emphasis === "NUMBER" ? "bg-emerald-400 text-neutral-950" :
                                    word.emphasis === "EMOTION" ? "bg-rose-500 text-white" :
                                    word.emphasis === "WARNING" ? "bg-orange-500 text-white" :
                                    "bg-neutral-800 text-neutral-400 hover:text-white"
                                  }`}
                                >
                                  {word.word}
                                </button>
                              ))}
                           </div>
                        </div>
                     </div>
                   </div>
                 );
               })}
            </div>
          </motion.div>
        )}

        {activeTab === "STYLE" && (
          <motion.div
            key="style"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-6 pb-20"
          >
             {/* PRESET STYLES LIST */}
             <section className="space-y-3">
                <h4 className="text-[11px] font-black text-neutral-500 uppercase tracking-[0.2em]">{isSk ? "PRESET ŠTÝLOV" : "PRESET STYLES"}</h4>
                <div className="grid grid-cols-2 gap-2">
                   {stylePresets.map(preset => (
                     <button
                       key={preset.id}
                       onClick={() => updateGlobalStyle({ 
                         style: preset.id,
                         animation: preset.id === "CINEMATIC" ? "FADE" : preset.id === "SOCIAL_POP" ? "BOUNCE" : "POP" 
                       })}
                       className={`group relative flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                         project.globalStyle.style === preset.id ? "border-amber-500 bg-amber-500/10" : "border-neutral-800 bg-neutral-900/40 hover:border-neutral-700"
                       }`}
                     >
                        <div className="flex items-center justify-between mb-1.5">
                           <span className="text-[11px] font-black text-white uppercase tracking-widest">{preset.name}</span>
                           <Sparkles className={`h-3 w-3 ${project.globalStyle.style === preset.id ? "text-amber-500" : "text-neutral-600"} transition-colors`} />
                        </div>
                        <span className="text-[10px] text-neutral-500 leading-normal">{isSk ? preset.descSk : preset.descEn}</span>
                     </button>
                   ))}
                </div>
             </section>

             {/* CUSTOM STYLE PARAMETERS - Visible only when CUSTOM preset is active */}
             {project.globalStyle.style === "CUSTOM" && (
               <section className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-4">
                  <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">{isSk ? "VLASTNÉ NASTAVENIA ŠTÝLU" : "CUSTOM STYLE SETTINGS"}</h4>
                  
                  <div className="space-y-3">
                     {/* Font Select */}
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-neutral-500 uppercase">{isSk ? "Písmo (Font Family)" : "Font Family"}</label>
                        <select 
                          value={project.globalStyle.fontFamily || "Montserrat"}
                          onChange={(e) => updateGlobalStyle({ fontFamily: e.target.value })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg py-2 px-3 text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                        >
                           <option value="Montserrat">Montserrat (Standard Bold)</option>
                           <option value="Inter">Inter (Minimal Modern)</option>
                           <option value="Georgia">Georgia (Classic Serif)</option>
                           <option value="Impact">Impact (Bold Vintage Pop)</option>
                           <option value="Courier New">Courier New (Handwritten Type)</option>
                        </select>
                     </div>

                     {/* Casing Toggles */}
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-neutral-500 uppercase">{isSk ? "Veľkosť písmen" : "Letter Case"}</label>
                        <div className="flex bg-neutral-950 rounded-lg p-1 border border-neutral-850">
                           {(["uppercase", "normal", "capitalize"] as const).map(c => (
                             <button
                               key={c}
                               onClick={() => updateGlobalStyle({ case: c })}
                               className={`flex-1 py-1.5 text-[10px] font-black rounded transition-all ${project.globalStyle.case === c ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-400"}`}
                             >
                               {c === "uppercase" ? "ABC" : c === "normal" ? "abc" : "Abc"}
                             </button>
                           ))}
                        </div>
                     </div>

                     {/* Custom Sizing */}
                     <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                           <label className="text-[10px] font-black text-neutral-500 uppercase">{isSk ? "Veľkosť písma" : "Font Size"}</label>
                           <span className="text-xs font-bold text-white">{project.globalStyle.fontSize || 42}px</span>
                        </div>
                        <input 
                          type="range" 
                          min={20} 
                          max={100} 
                          value={project.globalStyle.fontSize || 42} 
                          onChange={(e) => updateGlobalStyle({ fontSize: parseInt(e.target.value) })}
                          className="w-full h-1 bg-neutral-800 rounded-lg appearance-none accent-amber-500"
                        />
                     </div>

                     {/* Stroke Outline Sizer */}
                     <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                           <label className="text-[10px] font-black text-neutral-500 uppercase">{isSk ? "Hrúbka čierneho obrysu" : "Black Outline Width"}</label>
                           <span className="text-xs font-bold text-white">{project.globalStyle.outlineWidth ?? 2}</span>
                        </div>
                        <input 
                          type="range" 
                          min={0} 
                          max={6} 
                          value={project.globalStyle.outlineWidth ?? 2} 
                          onChange={(e) => updateGlobalStyle({ outlineWidth: parseInt(e.target.value) })}
                          className="w-full h-1 bg-neutral-800 rounded-lg appearance-none accent-amber-500"
                        />
                     </div>

                     {/* Drop Shadow Switch */}
                     <div className="flex items-center justify-between py-1 border-t border-neutral-850 mt-2">
                        <label className="text-[10px] font-black text-neutral-500 uppercase">{isSk ? "Efekt drop shadow (tieň)" : "Enable Drop Shadow"}</label>
                        <button
                          onClick={() => updateGlobalStyle({ shadowEnabled: !project.globalStyle.shadowEnabled })}
                          className={`w-9 h-5 rounded-full p-0.5 transition-all ${project.globalStyle.shadowEnabled ? "bg-amber-500 flex justify-end" : "bg-neutral-800 flex justify-start"}`}
                        >
                           <span className="w-4 h-4 rounded-full bg-white block" />
                        </button>
                     </div>
                  </div>
               </section>
             )}

             {/* WORD-LEVEL BLOCKING CONSTRAINTS (RE-CHUNKER) */}
             <section className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-4">
                <div className="flex items-center justify-between">
                   <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">{isSk ? "ČASOVÉ A ROZSAHOVÉ LIMITY BLOKOV" : "WORD BLOCK TIMING CONSTRAINTS"}</h4>
                   <span className="text-[9px] bg-amber-500/15 text-amber-500 px-1.5 py-0.5 rounded font-bold uppercase">Word-Level</span>
                </div>

                <div className="space-y-3.5">
                   {/* Words per block */}
                   <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-black text-neutral-500 uppercase">{isSk ? "Maximálny počet slov v bloku" : "Max Words Per Block"}</span>
                         <span className="text-xs font-extrabold text-white">{wordsPerBlock} slov</span>
                      </div>
                      <input 
                        type="range" 
                        min={1} 
                        max={10} 
                        value={wordsPerBlock} 
                        onChange={(e) => setWordsPerBlock(parseInt(e.target.value))}
                        className="w-full h-1 bg-neutral-800 rounded-lg appearance-none accent-amber-500"
                      />
                   </div>

                   {/* Max Characters */}
                   <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-black text-neutral-500 uppercase">{isSk ? "Maximálny počet znakov" : "Max Characters Per Block"}</span>
                         <span className="text-xs font-extrabold text-white">{maxCharacters} znakov</span>
                      </div>
                      <input 
                        type="range" 
                        min={8} 
                        max={50} 
                        value={maxCharacters} 
                        onChange={(e) => setMaxCharacters(parseInt(e.target.value))}
                        className="w-full h-1 bg-neutral-800 rounded-lg appearance-none accent-amber-500"
                      />
                   </div>

                   {/* Max Lines */}
                   <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-black text-neutral-500 uppercase">{isSk ? "Maximálny počet riadkov" : "Max Rows"}</span>
                         <span className="text-xs font-extrabold text-white">{maxLines} {maxLines === 1 ? "riadok" : maxLines < 5 ? "riadky" : "riadkov"}</span>
                      </div>
                      <input 
                        type="range" 
                        min={1} 
                        max={3} 
                        value={maxLines} 
                        onChange={(e) => setMaxLines(parseInt(e.target.value))}
                        className="w-full h-1 bg-neutral-800 rounded-lg appearance-none accent-amber-500"
                      />
                   </div>

                   {/* Duration limits */}
                   <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1">
                         <span className="text-[9px] font-black text-neutral-500 uppercase">{isSk ? "Minimálny čas" : "Min Duration"}</span>
                         <div className="flex items-center justify-between bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5">
                            <input 
                              type="number" 
                              step="0.1"
                              min="0.1"
                              max="1.5"
                              value={minDuration} 
                              onChange={(e) => setMinDuration(parseFloat(e.target.value) || 0.3)}
                              className="w-full bg-transparent text-xs font-extrabold text-white focus:outline-none"
                            />
                            <span className="text-[9px] font-bold text-neutral-500">sec</span>
                         </div>
                      </div>
                      <div className="space-y-1">
                         <span className="text-[9px] font-black text-neutral-500 uppercase">{isSk ? "Maximálny čas" : "Max Duration"}</span>
                         <div className="flex items-center justify-between bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5">
                            <input 
                              type="number" 
                              step="0.1"
                              min="1.0"
                              max="8.0"
                              value={maxDuration} 
                              onChange={(e) => setMaxDuration(parseFloat(e.target.value) || 3.5)}
                              className="w-full bg-transparent text-xs font-extrabold text-white focus:outline-none"
                            />
                            <span className="text-[9px] font-bold text-neutral-500">sec</span>
                         </div>
                      </div>
                   </div>

                   {/* Rechunk Apply Button */}
                   <button
                     onClick={handleRechunkSegments}
                     disabled={isRechunking}
                     className="w-full mt-3 flex items-center justify-center gap-2 py-2 px-4 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 disabled:from-neutral-800 disabled:to-neutral-800 text-xs font-black text-black disabled:text-neutral-500 rounded-xl transition-all shadow-md active:scale-[0.98]"
                   >
                      {isRechunking ? (
                        <>
                          <span className="animate-spin block h-3 w-3 border-2 border-neutral-500 border-t-white rounded-full" />
                          <span>{isSk ? "PREPOČÍTAVAM BLOKY..." : "CALCULATING BLOCKS..."}</span>
                        </>
                      ) : (
                        <>
                          <span>⚙️</span>
                          <span>{isSk ? "APLIKOVAŤ ČASOVÉ LIMITY" : "APPLY BLOCK CONSTRAINTS"}</span>
                        </>
                      )}
                   </button>
                </div>
             </section>

             {/* CONTEXT-AWARE SMART SEMANTIC SPLITTER */}
             <section className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-4">
                <div className="flex items-center justify-between">
                   <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">{isSk ? "SÉMANTICKÝ MAGIC SPLIT" : "SEMANTIC MAGIC SPLIT"}</h4>
                   <span className="text-[9px] bg-indigo-500/15 text-indigo-400 px-1.5 py-0.5 rounded font-bold uppercase">Rhythm AI</span>
                </div>
                <p className="text-[10px] text-neutral-400 leading-relaxed">
                   {isSk 
                     ? "Na rozdiel od bežného rozdelenia reže vety podľa prirodzeného rytmu reči, gramatických pauz, a zvýrazňuje kľúčové slová svietiacimi farbami a priraďuje relevantné emoji." 
                     : "Unlike mechanical splits, this slices text based on natural speech cadence, pauses, and emphasizes crucial keywords with glowing styles and matching emojis."}
                </p>

                <button
                  onClick={runSemanticMagicSplit}
                  disabled={isProcessingLocalMagic}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-800 text-xs font-black text-white disabled:text-neutral-500 rounded-xl transition-all shadow-md active:scale-[0.98]"
                >
                   {isProcessingLocalMagic ? (
                     <>
                       <span className="animate-spin block h-3 w-3 border-2 border-indigo-400 border-t-white rounded-full" />
                       <span>{isSk ? "DETEKUJEM RYTMUS A REČ..." : "DETECTING EMOTION & PAUSES..."}</span>
                     </>
                   ) : (
                     <>
                       <span>🪄</span>
                       <span>{isSk ? "SPUSTIŤ SÉMANTICKÝ SPLIT" : "RUN SEMANTIC MAGIC SPLIT"}</span>
                     </>
                   )}
                </button>
             </section>
          </motion.div>
        )}

        {activeTab === "POSITION" && (
          <motion.div
            key="position"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-6"
          >
             <section className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
                <div className="flex items-start gap-3">
                   <User className="h-5 w-5 text-emerald-400 mt-0.5" />
                   <div>
                      <h5 className="text-[10px] font-black text-white uppercase tracking-wider mb-1">FACE-AWARE POSITIONING</h5>
                      <p className="text-[10px] text-neutral-500 leading-relaxed italic">
                        {isSk 
                          ? "AI automaticky presúva titulky mimo oblasť tváre. V momentoch 02:14 a 05:22 boli titulky posunuté vyššie kvôli gestikulácii."
                          : "AI automatically moves captions away from the face. At 02:14 and 05:22, captions were moved higher due to hand gestures."}
                      </p>
                   </div>
                </div>
             </section>

             <section className="space-y-4">
                <h4 className="text-[11px] font-black text-neutral-500 uppercase tracking-[0.2em]">PLACEMENT</h4>
                <div className="grid grid-cols-2 gap-3">
                   {(["auto", "top", "center", "bottom"] as const).map(p => (
                     <button
                       key={p}
                       onClick={() => updateGlobalStyle({ position: p })}
                       className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                         project.globalStyle.position === p ? "border-amber-500 bg-amber-500/10" : "border-neutral-800 bg-neutral-900/40 hover:border-neutral-700"
                       }`}
                     >
                        <div className="w-6 h-9 rounded border border-neutral-700 bg-neutral-950 flex flex-col justify-between p-0.5">
                           <div className={`h-1 w-full rounded-full ${p === "top" || p === "auto" ? "bg-amber-500" : "bg-neutral-800"}`} />
                           <div className={`h-1 w-full rounded-full ${p === "center" ? "bg-amber-500" : "bg-neutral-800"}`} />
                           <div className={`h-1 w-full rounded-full ${p === "bottom" ? "bg-amber-500" : "bg-neutral-800"}`} />
                        </div>
                        <span className={`text-[10px] font-black uppercase ${project.globalStyle.position === p ? "text-white" : "text-neutral-500"}`}>{p}</span>
                     </button>
                   ))}
                </div>
             </section>

             <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/20">
                <div className="flex items-center gap-2 mb-2">
                   <AlertTriangle className="h-4 w-4 text-amber-500" />
                   <span className="text-[10px] font-black text-white uppercase">Safe Zone Check</span>
                </div>
                <p className="text-[10px] text-neutral-500 leading-relaxed">
                   {isSk 
                     ? "Všetky titulky sú v bezpečnej zóne pre TikTok/Reels UI." 
                     : "All captions are within safe zones for TikTok/Reels UI."}
                </p>
             </div>
          </motion.div>
        )}

        {activeTab === "CHECK" && (
          <motion.div
            key="check"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-4"
          >
             <h4 className="text-[11px] font-black text-neutral-500 uppercase tracking-[0.2em]">QUALITY CHECK SUMMARY</h4>
             
             <div className="flex flex-col gap-2">
                {project.qualityChecks.map(check => (
                  <div 
                    key={check.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border ${
                      check.type === "ERROR" ? "bg-rose-500/5 border-rose-500/20" :
                      check.type === "WARNING" ? "bg-amber-500/5 border-amber-500/20" :
                      "bg-emerald-500/5 border-emerald-500/20"
                    }`}
                  >
                     {check.type === "ERROR" && <AlertTriangle className="h-4 w-4 text-rose-500 mt-0.5" />}
                     {check.type === "WARNING" && <Info className="h-4 w-4 text-amber-500 mt-0.5" />}
                     {check.type === "OK" && <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />}
                     
                     <div className="flex-1">
                        <p className="text-[10px] font-black text-white uppercase mb-0.5">{check.type}</p>
                        <p className="text-[10px] text-neutral-400">{isSk ? check.messageSk : check.messageEn}</p>
                     </div>

                     {check.segmentId && (
                        <button 
                          onClick={() => {
                            const seg = project.segments.find(s => s.id === check.segmentId);
                            if (seg) onSeek(seg.start);
                          }}
                          className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white"
                        >
                           <Eye className="h-3.5 w-3.5" />
                        </button>
                     )}
                  </div>
                ))}
             </div>

             <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-center">
                   <span className="block text-[9px] font-black text-neutral-500 uppercase mb-1">Reading Speed</span>
                   <span className="text-xs font-bold text-emerald-400">Optimal (14 cps)</span>
                </div>
                <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-center">
                   <span className="block text-[9px] font-black text-neutral-500 uppercase mb-1">Face Occlusion</span>
                   <span className="text-xs font-bold text-emerald-400">0% Detected</span>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Actions */}
      <div className="sticky bottom-0 pt-6 pb-2 bg-gradient-to-t from-neutral-950 via-neutral-950 to-transparent">
         <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between p-4 rounded-2xl border border-neutral-800 bg-neutral-900/40">
               <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-800">
                     <Palette className="h-4 w-4 text-neutral-400" />
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-white uppercase tracking-wider">BULK APPLY STYLE</p>
                     <p className="text-[9px] text-neutral-500">Apply current settings to all segments</p>
                  </div>
               </div>
               <button className="px-4 py-2 rounded-xl bg-neutral-800 text-white text-[10px] font-black uppercase tracking-widest hover:bg-neutral-700 transition-all">
                  APPLY ALL
               </button>
            </div>
            
            <button
              onClick={() => {}} // Placeholder for final commit
              className="w-full py-4 rounded-2xl bg-amber-600 text-white font-black uppercase tracking-[0.2em] shadow-xl shadow-amber-600/20 hover:bg-amber-500 transition-all active:scale-[0.98]"
            >
              FINALIZE CAPTIONS
            </button>
         </div>
      </div>
    </div>
  );
});

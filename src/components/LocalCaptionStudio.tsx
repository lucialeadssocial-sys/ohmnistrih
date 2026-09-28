/**
 * Local Automatic Captions & Text-Based Video Editor Studio
 * Pipeline: VIDEO -> AUDIO -> STT -> WORD TIMESTAMPS -> TRANSCRIPT -> CAPTION SEGMENTS
 * Includes word-level editing, caption styling, and non-destructive Edit Plan review for video cuts.
 */

import React, { useState, useEffect } from 'react';
import { captionEngine, CaptionSegment, WordItem, DEFAULT_CAPTION_STYLE, CaptionStyleOptions } from '../ai/subtitles/captionEngine';
import { textBasedEditor, EditPlan } from '../ai/subtitles/textBasedEditor';
import { coreEngine, useCoreProject, AddClipCommand, ClipModel, createCanonicalClip } from '../core';
import { opfsManager } from '../core/storage/opfs';
import { localAIManager, ModelProgress } from '../ai';
import { Subtitles, Mic, Sparkles, Scissors, Check, X, RefreshCw, Layers, Edit3, Trash2, Split, Merge, Type, AlignCenter, Sliders, Play } from 'lucide-react';

export const LocalCaptionStudio: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { project } = useCoreProject();

  const [speechStatus, setSpeechStatus] = useState<ModelProgress>(localAIManager.speech.getStatus());
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [words, setWords] = useState<WordItem[]>([]);
  const [segments, setSegments] = useState<CaptionSegment[]>([]);
  const [style, setStyle] = useState<CaptionStyleOptions>(DEFAULT_CAPTION_STYLE);
  
  const [sttNotice, setSttNotice] = useState<string | null>(null);
  const [sttSynthetic, setSttSynthetic] = useState(false);
  const [editPlan, setEditPlan] = useState<EditPlan | null>(null);
  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'TRANSCRIPT' | 'CAPTION_STYLE' | 'EDIT_PLAN'>('TRANSCRIPT');

  useEffect(() => {
    const unsub = localAIManager.speech.subscribe(setSpeechStatus);
    return unsub;
  }, []);

  useEffect(() => {
    if (project.assets.length > 0 && !selectedAssetId) {
      setSelectedAssetId(project.assets[0].id);
    }
  }, [project.assets, selectedAssetId]);

  // Recalculate Edit Plan when word deletion states change
  useEffect(() => {
    if (words.length > 0) {
      const plan = textBasedEditor.generateEditPlanFromDeletedWords(words);
      setEditPlan(plan);
    }
  }, [words]);

  if (!isOpen) return null;

  const selectedAsset = project.assets.find((a) => a.id === selectedAssetId);

  // --- Pipeline Actions ---

  const handleTranscribeMedia = async () => {
    if (!selectedAsset) return;

    setSttNotice(null);
    setSttSynthetic(false);

    // Resolve the REAL media file for the selected asset (OPFS first, then its URL).
    let mediaBlob: Blob | null = null;
    try {
      mediaBlob = await opfsManager.getFile(selectedAsset.opfsPath);
      if (!mediaBlob && selectedAsset.url) {
        const response = await fetch(selectedAsset.url);
        if (response.ok) mediaBlob = await response.blob();
      }
    } catch (e: any) {
      console.warn('[CaptionStudio] Media lookup failed:', e);
    }

    if (!mediaBlob) {
      setWords([]);
      setSegments([]);
      setSttNotice(
        'Médium sa nepodarilo načítať (nie je v OPFS ani na URL) — prepis nie je možný. Nahráte médium znova.'
      );
      return;
    }

    try {
      const result = await captionEngine.generateCaptions(mediaBlob, style);

      if (result.synthetic || result.words.length === 0) {
        // No STT engine produced text: show the honest reason, never a fabricated transcript.
        setWords([]);
        setSegments([]);
        setSttSynthetic(true);
        setSttNotice(result.notice || 'Prepis sa nevygeneroval — lokálny STT model nie je načítaný.');
        return;
      }

      setWords(result.words);
      setSegments(result.segments);
      setSttSynthetic(false);
      setSttNotice(null);
      setActiveTab('TRANSCRIPT');
    } catch (e: any) {
      setWords([]);
      setSegments([]);
      setSttNotice(`Prepis zlyhal: ${e?.message || 'neznáma chyba'}`);
      console.error('[CaptionStudio] Transcription failed:', e);
    }
  };

  // --- Word Editing Handlers ---

  const handleToggleDeleteWord = (wordId: string) => {
    setWords((prev) =>
      prev.map((w) => (w.id === wordId ? { ...w, isDeleted: !w.isDeleted } : w))
    );
    // Re-chunk segments
    const updatedWords = words.map((w) => (w.id === wordId ? { ...w, isDeleted: !w.isDeleted } : w));
    setSegments(captionEngine.chunkWordsIntoSegments(updatedWords, style));
  };

  const handleStartEditWord = (w: WordItem) => {
    setEditingWordId(w.id);
    setEditingText(w.word);
  };

  const handleSaveWordText = (wordId: string) => {
    if (!editingText.trim()) return;
    const updated = words.map((w) => (w.id === wordId ? { ...w, word: editingText.trim() } : w));
    setWords(updated);
    setSegments(captionEngine.chunkWordsIntoSegments(updated, style));
    setEditingWordId(null);
  };

  // --- Caption Style Handlers ---

  const handleStyleChange = (key: keyof CaptionStyleOptions, value: any) => {
    const updatedStyle = { ...style, [key]: value };
    setStyle(updatedStyle);
    if (words.length > 0) {
      setSegments(captionEngine.chunkWordsIntoSegments(words, updatedStyle));
    }
  };

  // --- Timeline Export Handler ---

  const handleAddCaptionsToTimeline = () => {
    if (segments.length === 0) return;

    const captionTrack = project.tracks.find((t) => t.type === 'caption') || project.tracks[0];

    for (const seg of segments) {
      const captionClip = createCanonicalClip({
        id: `caption_${crypto.randomUUID()}`,
        trackId: captionTrack.id,
        type: 'caption',
        name: `Titulok: ${seg.text.slice(0, 15)}...`,
        timelineStart: seg.start,
        sourceStart: 0,
        sourceEnd: seg.end - seg.start,
        duration: seg.end - seg.start,
        speed: 1,
        volume: 100,
        scale: 100,
        opacity: 100,
        positionX: 0,
        positionY: style.position === 'bottom' ? 380 : style.position === 'top' ? -380 : 0,
        rotation: 0,
        textConfig: {
          content: seg.text,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          color: style.color,
          backgroundColor: style.backgroundColor,
          strokeColor: style.strokeColor,
          strokeWidth: style.strokeWidth,
          textAlign: style.alignment,
          fontWeight: 'bold'
        },
        keyframes: []
      });

      coreEngine.commandManager.executeCommand(
        new AddClipCommand(`Pridaný titulok "${seg.text.slice(0, 20)}"`, captionTrack.id, captionClip)
      );
    }

    coreEngine.saveCurrentProject();
    onClose();
  };

  // --- Edit Plan Actions ---

  const handleApplyEditPlan = () => {
    if (!editPlan) return;
    const success = textBasedEditor.applyEditPlan(editPlan);
    if (success) {
      setEditPlan({ ...editPlan, status: 'APPLIED' });
    }
  };

  const handleRejectEditPlan = () => {
    if (!editPlan) return;
    setEditPlan({ ...editPlan, status: 'REJECTED' });
    // Reset word deletion flags
    setWords((prev) => prev.map((w) => ({ ...w, isDeleted: false })));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden text-zinc-100">
        
        {/* Header Bar */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-950/80 border border-purple-800 rounded-xl text-purple-400">
              <Subtitles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-lg text-white">Lokálne Titulky & Text-Based Video Editor</h2>
              <p className="text-xs text-zinc-400">100% Offline Whisper STT • Úprava videa vymazaním slov v transkripte</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-xs text-zinc-400 font-medium">Zdrojové médium:</label>
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-500"
            >
              {project.assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.duration.toFixed(1)}s)
                </option>
              ))}
            </select>

            <button
              onClick={handleTranscribeMedia}
              disabled={speechStatus.status === 'PROCESSING' || speechStatus.status === 'LOADING'}
              className="px-3.5 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 text-white font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {speechStatus.status === 'PROCESSING' ? 'Transkribujem reč...' : 'Vygenerovať Titulky'}
            </button>
            {sttSynthetic && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-950/70 text-amber-400 border border-amber-800/80">
                SYNTHETIC / NO STT MODEL
              </span>
            )}
          </div>

          {/* Tab Selection */}
          <div className="flex items-center gap-1 bg-zinc-950 p-1 border border-zinc-800 rounded-lg">
            <button
              onClick={() => setActiveTab('TRANSCRIPT')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                activeTab === 'TRANSCRIPT' ? 'bg-purple-600 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Transkript ({words.length} slov)
            </button>
            <button
              onClick={() => setActiveTab('CAPTION_STYLE')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                activeTab === 'CAPTION_STYLE' ? 'bg-purple-600 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Štýl a Animácie
            </button>

            {editPlan && editPlan.proposedCuts.length > 0 && (
              <button
                onClick={() => setActiveTab('EDIT_PLAN')}
                className={`px-3 py-1 text-xs rounded-md font-medium flex items-center gap-1.5 transition-colors ${
                  activeTab === 'EDIT_PLAN' ? 'bg-amber-600 text-white' : 'bg-amber-950/60 text-amber-400 border border-amber-800/80'
                }`}
              >
                <Scissors className="w-3 h-3" />
                Edit Plan ({editPlan.proposedCuts.length})
              </button>
            )}
          </div>
        </div>

        {sttNotice && (
          <div className="px-4 py-2 bg-amber-950/40 border-b border-amber-900/60 text-[11px] text-amber-300">
            ⚠️ {sttNotice}
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4">
          
          {/* TAB 1: TRANSCRIPT & WORD EDITOR */}
          {activeTab === 'TRANSCRIPT' && (
            <div className="space-y-4">
              {words.length === 0 ? (
                <div className="py-16 text-center text-zinc-500 space-y-3">
                  <Mic className="w-10 h-10 mx-auto text-zinc-600 stroke-1" />
                  <p className="text-sm">Klikni na **"Vygenerovať Titulky"** pre lokálny preklad hovorenej reči pomocou Whisper ONNX.</p>
                </div>
              ) : (
                <>
                  <div className="text-xs text-zinc-400 flex items-center justify-between">
                    <span>💡 Tip: Kliknutím na slovo ho upravíš. Kliknutím na tlačidlo <Trash2 className="w-3 h-3 inline text-red-400" /> ho označíš na vystrihnutie z videa.</span>
                    <span className="text-purple-400">{segments.length} Titulkových Kariet</span>
                  </div>

                  {/* Word Cloud Editor */}
                  <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl flex flex-wrap gap-2 leading-relaxed">
                    {words.map((w) => (
                      <div
                        key={w.id}
                        className={`group relative inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border transition-all ${
                          w.isDeleted
                            ? 'bg-red-950/60 border-red-800/80 text-red-400 line-through'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:border-purple-500/80'
                        }`}
                      >
                        {editingWordId === w.id ? (
                          <input
                            type="text"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onBlur={() => handleSaveWordText(w.id)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveWordText(w.id)}
                            autoFocus
                            className="bg-zinc-800 text-white text-xs px-1 rounded border border-purple-500 focus:outline-none"
                          />
                        ) : (
                          <span onClick={() => handleStartEditWord(w)} className="cursor-pointer font-medium">
                            {w.word}
                          </span>
                        )}

                        <span className="text-[10px] text-zinc-500 font-mono">
                          {w.start.toFixed(1)}s
                        </span>

                        <button
                          onClick={() => handleToggleDeleteWord(w.id)}
                          title={w.isDeleted ? 'Obnoviť slovo' : 'Vymazať slovo a navrhnúť strih videa'}
                          className={`p-0.5 rounded hover:bg-zinc-800 transition-colors ${
                            w.isDeleted ? 'text-green-400' : 'text-zinc-500 hover:text-red-400'
                          }`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Caption Cards Preview */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Náhľad Titulkových Kariet</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {segments.map((seg, i) => (
                        <div key={seg.id} className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-lg space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-zinc-400">
                            <span className="font-mono text-purple-400">#{i + 1} ({seg.start.toFixed(2)}s - {seg.end.toFixed(2)}s)</span>
                            <span>{seg.words.length} slov</span>
                          </div>
                          <p className="text-sm font-semibold text-white">{seg.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: CAPTION STYLE & ANIMATIONS */}
          {activeTab === 'CAPTION_STYLE' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4 bg-zinc-950 p-4 border border-zinc-800 rounded-xl">
                <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-purple-400" /> Vzhľad a Pozícia
                </h3>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-zinc-400 block mb-1">Veľkosť Písma ({style.fontSize}px)</label>
                    <input
                      type="range"
                      min="20"
                      max="72"
                      value={style.fontSize}
                      onChange={(e) => handleStyleChange('fontSize', Number(e.target.value))}
                      className="w-full accent-purple-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-zinc-400 block mb-1">Farba Textu</label>
                      <input
                        type="color"
                        value={style.color}
                        onChange={(e) => handleStyleChange('color', e.target.value)}
                        className="w-full h-8 bg-zinc-900 border border-zinc-800 rounded cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-400 block mb-1">Pozadie</label>
                      <input
                        type="color"
                        value={style.backgroundColor.slice(0, 7)}
                        onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                        className="w-full h-8 bg-zinc-900 border border-zinc-800 rounded cursor-pointer"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-zinc-400 block mb-1">Vertikálna Pozícia</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['top', 'middle', 'bottom'] as const).map((pos) => (
                        <button
                          key={pos}
                          onClick={() => handleStyleChange('position', pos)}
                          className={`py-1.5 capitalize rounded border transition-colors ${
                            style.position === pos ? 'bg-purple-600 border-purple-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                          }`}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-zinc-400 block mb-1">Animácia Titulku</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['NONE', 'POP_IN', 'FADE', 'WORD_HIGHLIGHT'] as const).map((anim) => (
                        <button
                          key={anim}
                          onClick={() => handleStyleChange('animation', anim)}
                          className={`py-1.5 text-[11px] rounded border transition-colors ${
                            style.animation === anim ? 'bg-purple-600 border-purple-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                          }`}
                        >
                          {anim}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Styled Live Card Preview */}
              <div className="bg-black border border-zinc-800 rounded-xl flex items-center justify-center p-8 relative min-h-[250px]">
                <div
                  className={`px-4 py-2 rounded-lg text-center font-bold shadow-lg transition-all ${
                    style.position === 'top' ? 'absolute top-6' : style.position === 'bottom' ? 'absolute bottom-6' : 'relative'
                  }`}
                  style={{
                    fontSize: `${style.fontSize}px`,
                    color: style.color,
                    backgroundColor: style.backgroundColor,
                    fontFamily: style.fontFamily
                  }}
                >
                  Ukážka Titulku V Reálnom Čase
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TEXT-BASED EDIT PLAN REVIEW */}
          {activeTab === 'EDIT_PLAN' && editPlan && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-950/40 border border-amber-800/80 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-amber-300 flex items-center gap-2">
                    <Scissors className="w-4 h-4" /> {editPlan.title}
                  </h3>
                  <span className="px-2 py-0.5 text-xs rounded bg-amber-900 text-amber-200 font-mono">
                    {editPlan.status}
                  </span>
                </div>
                <p className="text-xs text-amber-200/80">{editPlan.summary}</p>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Navrhované Strihy zo Snímky</h4>
                {editPlan.proposedCuts.map((cut, idx) => (
                  <div key={cut.id} className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono text-purple-400">Strih #{idx + 1}</span>
                        <span className="text-zinc-500">•</span>
                        <span className="font-mono text-zinc-300">{cut.startTime}s - {cut.endTime}s (-{cut.duration}s)</span>
                      </div>
                      <p className="text-xs text-red-400 line-through">"{cut.deletedWordsText}"</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditPlan(textBasedEditor.toggleCutStatus(editPlan, cut.id))}
                        className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                          cut.status === 'ACCEPTED'
                            ? 'bg-red-950 border-red-800 text-red-300 hover:bg-red-900'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                        }`}
                      >
                        {cut.status === 'ACCEPTED' ? 'Vystrihnúť' : 'Ponechať'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Review Decision Actions */}
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between">
                <p className="text-xs text-zinc-400">
                  Schválením sa automaticky vytvoria ne-deštruktívne príkazové strihy na časovej osi.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRejectEditPlan}
                    className="px-3.5 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-medium transition-colors"
                  >
                    Zamietnuť
                  </button>
                  <button
                    onClick={handleApplyEditPlan}
                    className="px-4 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" /> Aplikovať Strihy Videa
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            {segments.length > 0 ? `Pripravených ${segments.length} titulkových kariet` : 'Zatiaľ nevygenerované titulky'}
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
            >
              Zrušiť
            </button>
            <button
              onClick={handleAddCaptionsToTimeline}
              disabled={segments.length === 0}
              className="px-4 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" /> Pridať Titulky Na Časovú Os
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

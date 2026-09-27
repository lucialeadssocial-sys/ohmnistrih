import React, { useState } from 'react';
import { useCoreProject, coreEngine } from '../core';
import { AnalysisType, EditingInsight } from '../core/ai/analysisTypes';
import { getTeachMeExplanation } from '../core/ai/knowledgeBase';
import { playheadStore } from '../core/playback/playheadStore';
import {
  Brain,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  BookOpen,
  Volume2,
  Film,
  Layers,
  ArrowRight,
  HelpCircle,
  AlertCircle
} from 'lucide-react';

export const AnalyzePanel: React.FC = () => {
  const { project } = useCoreProject();
  const [selectedTypes, setSelectedTypes] = useState<AnalysisType[]>([
    'transcript',
    'silence',
    'shots',
    'scenes',
    'content',
    'editing'
  ]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTeachTopic, setActiveTeachTopic] = useState<string | null>(null);

  const toggleType = (type: AnalysisType) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter(t => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  const handleStartAnalysis = async () => {
    setIsAnalyzing(true);
    setProgress(5);
    try {
      await coreEngine.runProjectAnalysis(selectedTypes, undefined, (prog) => {
        setProgress(prog);
      });
    } catch (e) {
      console.error('Analysis error:', e);
    } finally {
      setIsAnalyzing(false);
      setProgress(100);
    }
  };

  const handleSeek = (timecode?: number) => {
    if (timecode !== undefined) {
      playheadStore.setTime(timecode);
    }
  };

  const handleConvertDecision = (insight: EditingInsight) => {
    coreEngine.convertInsightToEditDecision(insight);
  };

  const results = project.analysisResults;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 text-white space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Editing Intelligence & Analysis Center
            </h3>
            <p className="text-xs text-neutral-400">
              Ne-deštruktívna analýza videa, rytmu, pauz a naratívnej štruktúry.
            </p>
          </div>
        </div>

        <button
          onClick={handleStartAnalysis}
          disabled={isAnalyzing || selectedTypes.length === 0}
          className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition ${
            isAnalyzing
              ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
              : 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/10'
          }`}
        >
          {isAnalyzing ? (
            <>
              <Clock className="w-4 h-4 animate-spin" /> Analyzujem... ({progress}%)
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" /> Spustiť Analýzu
            </>
          )}
        </button>
      </div>

      {/* Checkboxes selection */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-neutral-950 p-4 rounded-xl border border-neutral-800">
        {[
          { type: 'transcript' as AnalysisType, label: 'Transkript & Reč', icon: Volume2 },
          { type: 'silence' as AnalysisType, label: 'Pauzy & Ticho', icon: Clock },
          { type: 'shots' as AnalysisType, label: 'Detekcia Záberov', icon: Film },
          { type: 'scenes' as AnalysisType, label: 'Zoskupenie Scén', icon: Layers },
          { type: 'content' as AnalysisType, label: 'Štruktúra Obsahu', icon: Sparkles },
          { type: 'editing' as AnalysisType, label: 'Editing Insights', icon: Brain }
        ].map(({ type, label, icon: Icon }) => (
          <label
            key={type}
            className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition ${
              selectedTypes.includes(type)
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
            }`}
          >
            <input
              type="checkbox"
              checked={selectedTypes.includes(type)}
              onChange={() => toggleType(type)}
              className="rounded border-neutral-700 text-amber-500 focus:ring-amber-500 bg-neutral-900"
            />
            <Icon className="w-4 h-4 text-amber-400" />
            {label}
          </label>
        ))}
      </div>

      {/* Results View */}
      {results && (
        <div className="space-y-6">
          {/* Summary Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
              <span className="text-xs text-neutral-400 block">Rýchlosť Reči (WPM)</span>
              <span className="text-xl font-black text-amber-400 mt-1 block">
                {results.speechDensity?.wordsPerMinute || 0} WPM
              </span>
              <span className="text-[10px] text-neutral-500 mt-1 block uppercase tracking-wider font-semibold">
                Hustota: {results.speechDensity?.informationDensity || 'Balanced'}
              </span>
            </div>

            <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
              <span className="text-xs text-neutral-400 block">Detegované Pauzy</span>
              <span className="text-xl font-black text-amber-400 mt-1 block">
                {results.pauses?.length || 0}
              </span>
              <span className="text-[10px] text-neutral-500 mt-1 block font-medium">
                Pauzy dlhšie ako 0.8s
              </span>
            </div>

            <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
              <span className="text-xs text-neutral-400 block">Editing Insights</span>
              <span className="text-xl font-black text-amber-400 mt-1 block">
                {results.insights?.length || 0}
              </span>
              <span className="text-[10px] text-neutral-500 mt-1 block font-medium">
                Navrhnuté odporúčania
              </span>
            </div>
          </div>

          {/* Insights List */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" /> Detegované Odporúčania (Insights)
            </h4>

            {results.insights && results.insights.length > 0 ? (
              results.insights.map((ins: EditingInsight) => (
                <div
                  key={ins.id}
                  className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-neutral-700 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {ins.type}
                      </span>
                      {ins.start !== undefined && (
                        <button
                          onClick={() => handleSeek(ins.start)}
                          className="text-xs font-mono text-neutral-400 hover:text-amber-400 underline"
                        >
                          {ins.start.toFixed(1)}s {ins.end !== undefined ? `– ${ins.end.toFixed(1)}s` : ''}
                        </button>
                      )}
                      <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        Confidence {Math.round(ins.confidence * 100)}%
                      </span>
                    </div>

                    <p className="text-sm font-medium text-neutral-200 mt-1">{ins.observation}</p>
                    <p className="text-xs text-neutral-400">{ins.implication}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setActiveTeachTopic(ins.type === 'LongPause' ? 'PAUSE_TRIMMING' : 'BROLL_INSERTION')}
                      className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium rounded-lg flex items-center gap-1.5 transition"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-amber-400" /> Teach Me
                    </button>

                    <button
                      onClick={() => handleConvertDecision(ins)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg flex items-center gap-1.5 transition"
                    >
                      Vytvoriť Návrh <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-neutral-500 italic py-4">Žiadne špecifické odchýlky nezistené.</p>
            )}
          </div>
        </div>
      )}

      {/* Teach Me Modal Explanation */}
      {activeTeachTopic && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-xl w-full p-6 text-white space-y-4 shadow-2xl">
            {(() => {
              const explanation = getTeachMeExplanation(activeTeachTopic);
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-lg">
                      <BookOpen className="w-5 h-5" /> Edit Academy — {explanation.topic}
                    </div>
                    <button
                      onClick={() => setActiveTeachTopic(null)}
                      className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs text-neutral-300">
                    <div>
                      <span className="font-bold text-amber-300 uppercase tracking-wider block mb-1">
                        WHAT (Princíp)
                      </span>
                      <p className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
                        {explanation.principle}
                      </p>
                    </div>

                    <div>
                      <span className="font-bold text-emerald-300 uppercase tracking-wider block mb-1">
                        WHY (Dôvod & Psychológia)
                      </span>
                      <p className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
                        {explanation.why}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="font-bold text-blue-300 uppercase tracking-wider block mb-1">
                          WHEN (Kedy použiť)
                        </span>
                        <p className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
                          {explanation.whenToUse}
                        </p>
                      </div>

                      <div>
                        <span className="font-bold text-rose-300 uppercase tracking-wider block mb-1">
                          WHEN NOT (Kedy nepoužiť)
                        </span>
                        <p className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
                          {explanation.whenNotToUse}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-neutral-800 text-[11px] text-neutral-400 flex items-center justify-between">
                      <span>Zdroj: {explanation.source}</span>
                      <span className="bg-neutral-800 px-2 py-0.5 rounded text-amber-400 font-semibold">
                        Region: {explanation.region}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

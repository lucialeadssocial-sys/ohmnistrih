/**
 * Media Intelligence Index Inspector Component
 * Interactive UI for viewing, running, canceling, resuming, and selectively invalidating media analysis.
 */

import React, { useState, useEffect } from 'react';
import { useCoreProject } from '../core';
import {
  mediaIntelligenceEngine,
  MediaAnalysisIndex,
  INITIAL_MEDIA_INDEX,
  InvalidationTag
} from '../core/media/mediaIntelligenceIndex';
import {
  Brain,
  Play,
  Pause,
  RefreshCw,
  Scissors,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  Volume2,
  Film,
  Zap,
  Eye,
  Copy,
  Sliders,
  AlertCircle
} from 'lucide-react';

export const MediaIntelligenceInspector: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose
}) => {
  const { project } = useCoreProject();
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [indexData, setIndexData] = useState<MediaAnalysisIndex | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [currentTaskName, setCurrentTaskName] = useState('');
  const [overallProgress, setOverallProgress] = useState(0);

  useEffect(() => {
    if (project.assets.length > 0 && !selectedAssetId) {
      setSelectedAssetId(project.assets[0].id);
    }
  }, [project.assets, selectedAssetId]);

  useEffect(() => {
    if (selectedAssetId) {
      mediaIntelligenceEngine.getOrCreateIndex(selectedAssetId).then((data) => {
        setIndexData(data);
      });
      setIsRunning(mediaIntelligenceEngine.isRunning(selectedAssetId));
    }
  }, [selectedAssetId]);

  if (!isOpen) return null;

  const selectedAsset = project.assets.find((a) => a.id === selectedAssetId);

  const handleRunAnalysis = async () => {
    if (!selectedAsset) return;
    setIsRunning(true);

    try {
      const result = await mediaIntelligenceEngine.runAnalysis(
        selectedAsset,
        null,
        (taskName, pct) => {
          setCurrentTaskName(taskName);
          setOverallProgress(pct);
        }
      );
      setIndexData(result);
    } catch (e) {
      console.error('[MediaInspector] Analysis error:', e);
    } finally {
      setIsRunning(false);
    }
  };

  const handleCancelAnalysis = () => {
    if (!selectedAssetId) return;
    mediaIntelligenceEngine.cancelAnalysis(selectedAssetId);
    setIsRunning(false);
  };

  const handleInvalidateTag = async (tag: InvalidationTag) => {
    if (!selectedAssetId) return;
    const updated = await mediaIntelligenceEngine.invalidateByTag(selectedAssetId, tag);
    setIndexData(updated);
  };

  const completedNodeCount = indexData ? Object.keys(indexData.completedTasks).length : 0;
  const totalNodeCount = 8;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden text-zinc-100">
        
        {/* Header Bar */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-950/80 border border-purple-800 rounded-xl text-purple-400">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-lg text-white">Media Intelligence Index (Incremental DAG Engine)</h2>
              <p className="text-xs text-zinc-400">
                Lokalná analýza bez LLM • Zisťovanie VAD, rytmu, scén, jasnosti, rozostrenia a duplicitných záberov
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-xs text-zinc-400 font-medium">Médium na analýzu:</label>
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

            {!isRunning ? (
              <button
                onClick={handleRunAnalysis}
                className="px-3.5 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {completedNodeCount > 0 ? 'Pokračovať v analýze' : 'Spustiť Media Index'}
              </button>
            ) : (
              <button
                onClick={handleCancelAnalysis}
                className="px-3.5 py-1.5 text-xs bg-red-950 border border-red-800 text-red-300 hover:bg-red-900 font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Pause className="w-3.5 h-3.5 fill-current" />
                Pozastaviť
              </button>
            )}
          </div>

          {/* Selective Invalidation Controls */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-500 font-medium">Invalidovať Cache:</span>
            <button
              onClick={() => handleInvalidateTag('transcript')}
              title="Invaliduje iba transkript, zachová obraz a audio analýzu"
              className="px-2.5 py-1 text-[11px] bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded transition-colors"
            >
              Iba Transcript
            </button>
            <button
              onClick={() => handleInvalidateTag('crop')}
              title="Invaliduje iba obraz, zachová audio a transkript"
              className="px-2.5 py-1 text-[11px] bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded transition-colors"
            >
              Iba Obraz/Crop
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {isRunning && (
          <div className="bg-purple-950/40 border-b border-purple-800/60 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-purple-300 font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 animate-spin" /> {currentTaskName}...
              </span>
              <span className="font-mono text-purple-400">{overallProgress}%</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-purple-500 h-full transition-all duration-300"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* DAG Nodes Completion Manifest */}
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-300 uppercase tracking-wider">DAG Dependency Graph Status</span>
              <span className="text-purple-400 font-mono">{completedNodeCount} / {totalNodeCount} Uzlov hotových</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                { key: 'metadata', label: 'Vlastnosti Videa' },
                { key: 'waveform_peaks', label: 'Audio Priebeh & Špičky' },
                { key: 'beat_positions', label: 'Rytmus & Beaty' },
                { key: 'silence_speech_vad', label: 'VAD (Reč/Ticho)' },
                { key: 'transcript', label: 'Slovný Transkript' },
                { key: 'scene_boundaries', label: 'Hranice Scén' },
                { key: 'representative_frames', label: 'Jasnosť & Rozostrenie' },
                { key: 'duplicate_shots', label: 'Duplicitné Zábery' },
              ].map((node) => {
                const isDone = indexData?.completedTasks[node.key];
                const quality = indexData?.dataQuality?.[node.key];
                return (
                  <div
                    key={node.key}
                    className={`p-2 rounded-lg border flex flex-col gap-0.5 ${
                      quality === 'MEASURED'
                        ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                        : quality === 'DERIVED'
                          ? 'bg-sky-950/40 border-sky-800/80 text-sky-300'
                          : quality === 'NOT_AVAILABLE'
                            ? 'bg-amber-950/30 border-amber-800/70 text-amber-300'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{node.label}</span>
                      <CheckCircle2 className={`w-3.5 h-3.5 ${isDone ? 'opacity-90' : 'text-zinc-600'}`} />
                    </div>
                    <span className="text-[10px] uppercase tracking-wide opacity-80">
                      {quality === 'MEASURED'
                        ? 'merané'
                        : quality === 'DERIVED'
                          ? 'odvodené z merania'
                          : quality === 'NOT_AVAILABLE'
                            ? 'nemám dáta'
                            : isDone
                              ? 'bez označenia'
                              : 'nespustené'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {indexData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Box 1: Audio, Waveform & Rhythm Beats */}
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3">
                <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-purple-400" /> Audio, Špičky a Rytmus
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-zinc-400">
                    <span>Detegované beaty v hudbe:</span>
                    <span className="text-zinc-200 font-mono font-medium">{indexData.beatPositions.length} beatov</span>
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                    {indexData.beatPositions.slice(0, 10).map((b, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 text-[10px] font-mono">
                        {b}s
                      </span>
                    ))}
                  </div>

                  <div className="flex justify-between text-zinc-400 pt-2 border-t border-zinc-800">
                    <span>VAD Ticho vs Reč:</span>
                    <span className="text-zinc-200 font-mono">
                      {indexData.silentRanges.length} tichých úsekov
                    </span>
                  </div>
                </div>
              </div>

              {/* Box 2: Visual Quality & Duplicate Shots */}
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3">
                <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-purple-400" /> Kvalita Obrazu & Duplicity
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-zinc-400">
                    <span>Priemerná Jasnosť (Luminance):</span>
                    <span className="text-zinc-200 font-mono">{indexData.averageBrightness} / 255</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Skóre Rozostrenia (Blur Score):</span>
                    <span className="text-zinc-200 font-mono">{indexData.averageBlurScore} (Ostré)</span>
                  </div>

                  <div className="flex justify-between text-zinc-400 pt-2 border-t border-zinc-800">
                    <span>Nájdené duplicitné zábery:</span>
                    <span className="text-amber-400 font-mono font-medium">{indexData.duplicateShots.length} zhôd</span>
                  </div>
                  {indexData.duplicateShots.map((dup, i) => (
                    <div key={i} className="p-2 bg-amber-950/40 border border-amber-800/80 rounded flex justify-between text-[11px] text-amber-200">
                      <span>Záber @ {dup.shot1Timestamp}s $\approx$ Záber @ {dup.shot2Timestamp}s</span>
                      <span className="font-mono">{Math.round(dup.similarityScore * 100)}% zhoda</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Box 3: Scenes & Boundary Cuts */}
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3">
                <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                  <Film className="w-4 h-4 text-purple-400" /> Scény & Strihové Hranice
                </h3>

                <div className="space-y-2 text-xs">
                  {indexData.dataQuality?.scene_boundaries === 'NOT_AVAILABLE' ? (
                    <div className="p-3 bg-amber-950/30 border border-amber-800/70 rounded-lg text-amber-200 space-y-1">
                      <p className="font-semibold uppercase tracking-wide text-[11px]">Scény: nemám dáta</p>
                      <p className="text-[11px] leading-relaxed">
                        {indexData.unavailableSk?.scene_boundaries ||
                          'Snímky z média sa nepodarilo prečítať, preto sa strihy nemerali.'}
                      </p>
                      <p className="text-[10px] opacity-80">Nič sa nedomýšľa — žiadne „scény“ sa nevymýšľajú.</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-zinc-400">
                        Nameraných {indexData.scenes.length} scén z {indexData.framesAnalysed} skutočných snímok
                        (zmena jasu/farby medzi vzorkami).
                      </p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {indexData.scenes.length === 0 && (
                          <p className="text-zinc-500 italic text-[11px]">
                            Žiadna zmena obrazu neprekročila prah — video má pravdepodobne jeden súvislý záber.
                          </p>
                        )}
                        {indexData.scenes.map((sc, i) => (
                          <div key={sc.id} className="p-2 bg-zinc-900 rounded border border-zinc-800 flex justify-between text-[11px]">
                            <span className="font-mono text-purple-300">Scéna #{i + 1}</span>
                            <span className="text-zinc-400">{sc.start}s – {sc.end}s ({sc.duration.toFixed(1)}s)</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Box 4: Speech Transcript & Words */}
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3">
                <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-400" /> Transkript & Slová
                </h3>

                <div className="space-y-2 text-xs">
                  {indexData.dataQuality?.transcript === 'NOT_AVAILABLE' || !indexData.transcriptText ? (
                    <div className="p-3 bg-amber-950/30 border border-amber-800/70 rounded-lg text-amber-200 space-y-1">
                      <p className="font-semibold uppercase tracking-wide text-[11px]">Prepis: nemám dáta</p>
                      <p className="text-[11px] leading-relaxed">
                        {indexData.unavailableSk?.transcript ||
                          'Automatický prepis sa pri analýze média nespúšťa.'}
                      </p>
                      <p className="text-[10px] opacity-80">Vymyslené slová sa tu už nezobrazujú (predtým tu bol pevný zoznam slov).</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-zinc-300 font-medium leading-relaxed">"{indexData.transcriptText}"</p>
                      <span className="text-[11px] text-zinc-500 block">
                        {indexData.wordTimestamps.length} slov s presným časovaním
                      </span>
                    </>
                  )}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer Bar */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            {indexData?.updatedAt ? `Naposledy aktualizované: ${new Date(indexData.updatedAt).toLocaleTimeString()}` : 'Zatiaľ bez dát'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs bg-zinc-100 hover:bg-white text-zinc-900 font-semibold rounded-lg transition-colors"
          >
            Zatvoriť
          </button>
        </div>

      </div>
    </div>
  );
};

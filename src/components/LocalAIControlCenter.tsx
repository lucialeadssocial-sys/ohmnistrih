/**
 * Local AI Control Center Component
 * Provides complete user visibility and lifecycle control over offline local AI models.
 * Shows status (Not loaded, Loading, Ready, Processing, Complete, Error) with Cancel, Retry, and Unload capabilities.
 */

import React, { useState, useEffect } from 'react';
import { localAIManager, ModelProgress } from '../ai';
import { Brain, Sparkles, RefreshCw, XCircle, Power, Volume2, Mic, Eye, Database, FileText } from 'lucide-react';

export const LocalAIControlCenter: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [speechStatus, setSpeechStatus] = useState<ModelProgress>(localAIManager.speech.getStatus());
  const [vadStatus, setVadStatus] = useState<ModelProgress>(localAIManager.vad.getStatus());
  const [visionStatus, setVisionStatus] = useState<ModelProgress>(localAIManager.vision.getStatus());
  const [ttsStatus, setTtsStatus] = useState<ModelProgress>(localAIManager.tts.getStatus());
  const [embeddingStatus, setEmbeddingStatus] = useState<ModelProgress>(localAIManager.embedding.getStatus());

  useEffect(() => {
    const unsubSpeech = localAIManager.speech.subscribe(setSpeechStatus);
    const unsubVad = localAIManager.vad.subscribe(setVadStatus);
    const unsubVision = localAIManager.vision.subscribe(setVisionStatus);
    const unsubTts = localAIManager.tts.subscribe(setTtsStatus);
    const unsubEmbed = localAIManager.embedding.subscribe(setEmbeddingStatus);

    return () => {
      unsubSpeech();
      unsubVad();
      unsubVision();
      unsubTts();
      unsubEmbed();
    };
  }, []);

  if (!isOpen) return null;

  const renderStatusBadge = (status: ModelProgress['status']) => {
    switch (status) {
      case 'NOT_LOADED':
        return <span className="px-2 py-0.5 text-xs rounded bg-zinc-800 text-zinc-400 font-mono">Not loaded</span>;
      case 'LOADING':
        return <span className="px-2 py-0.5 text-xs rounded bg-blue-950 text-blue-400 animate-pulse font-mono">Loading...</span>;
      case 'READY':
        return <span className="px-2 py-0.5 text-xs rounded bg-emerald-950 text-emerald-400 font-mono">Ready</span>;
      case 'PROCESSING':
        return <span className="px-2 py-0.5 text-xs rounded bg-purple-950 text-purple-300 animate-pulse font-mono">Processing</span>;
      case 'COMPLETE':
        return <span className="px-2 py-0.5 text-xs rounded bg-green-950 text-green-400 font-mono">Complete</span>;
      case 'ERROR':
        return <span className="px-2 py-0.5 text-xs rounded bg-red-950 text-red-400 font-mono">Error</span>;
    }
  };

  const modelCards = [
    {
      title: 'Whisper Speech Transcription',
      icon: Mic,
      status: speechStatus,
      onLoad: () => localAIManager.speech.loadModel(),
      onUnload: () => localAIManager.speech.unloadModel(),
      onCancel: () => localAIManager.speech.cancel(),
      onRetry: () => localAIManager.speech.retry(),
    },
    {
      title: 'Silence & Voice Activity Detector (VAD)',
      icon: Volume2,
      status: vadStatus,
      onLoad: () => localAIManager.vad.loadModel(),
      onUnload: () => localAIManager.vad.unloadModel(),
      onCancel: () => localAIManager.vad.cancel(),
      onRetry: () => localAIManager.vad.retry(),
    },
    {
      title: 'Scene Cut & Vision Analyzer',
      icon: Eye,
      status: visionStatus,
      onLoad: () => localAIManager.vision.loadModel(),
      onUnload: () => localAIManager.vision.unloadModel(),
      onCancel: () => localAIManager.vision.cancel(),
      onRetry: () => localAIManager.vision.retry(),
    },
    {
      title: 'Text-To-Speech (TTS) Voice Synthesizer',
      icon: FileText,
      status: ttsStatus,
      onLoad: () => localAIManager.tts.loadModel(),
      onUnload: () => localAIManager.tts.unloadModel(),
      onCancel: () => localAIManager.tts.cancel(),
      onRetry: () => localAIManager.tts.retry(),
    },
    {
      title: 'Vector Feature & Semantic Embedder',
      icon: Database,
      status: embeddingStatus,
      onLoad: () => localAIManager.embedding.loadModel(),
      onUnload: () => localAIManager.embedding.unloadModel(),
      onCancel: () => localAIManager.embedding.cancel(),
      onRetry: () => localAIManager.embedding.retry(),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden text-zinc-100">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            <h2 className="font-semibold text-lg">Lokálne AI Modely (100% Offline / WebGPU)</h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <p className="text-xs text-zinc-400">
            Tieto modely bežia výhradne v tvojom prehliadači bez odosielania dát na cloud. Nespôsobujú žiadne spomalenie zapnutia aplikácie a načítavajú sa iba pri explicitnom vyžiadaní.
          </p>

          {modelCards.map((card, index) => {
            const Icon = card.icon;
            const { status, progress, message, error } = card.status;

            return (
              <div key={index} className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-lg flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-purple-400" />
                    <span className="font-medium text-sm text-zinc-200">{card.title}</span>
                  </div>
                  {renderStatusBadge(status)}
                </div>

                {/* Progress bar */}
                {(status === 'LOADING' || status === 'PROCESSING') && (
                  <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-purple-500 h-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}

                {message && <div className="text-xs text-zinc-400">{message}</div>}
                {error && <div className="text-xs text-red-400">{error}</div>}

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  {status === 'NOT_LOADED' && (
                    <button
                      onClick={card.onLoad}
                      className="px-2.5 py-1 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded font-medium flex items-center gap-1 transition-colors"
                    >
                      <Sparkles className="w-3 h-3" /> Načítať model
                    </button>
                  )}

                  {status === 'PROCESSING' && (
                    <button
                      onClick={card.onCancel}
                      className="px-2.5 py-1 text-xs bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 rounded flex items-center gap-1 transition-colors"
                    >
                      <XCircle className="w-3 h-3" /> Zrušiť
                    </button>
                  )}

                  {status === 'ERROR' && (
                    <button
                      onClick={card.onRetry}
                      className="px-2.5 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded flex items-center gap-1 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" /> Skúsiť znova
                    </button>
                  )}

                  {(status === 'READY' || status === 'COMPLETE') && (
                    <button
                      onClick={card.onUnload}
                      className="px-2.5 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded flex items-center gap-1 transition-colors"
                    >
                      <Power className="w-3 h-3" /> Uvoľniť pamäť
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between">
          <button
            onClick={() => localAIManager.unloadAllModels()}
            className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Power className="w-3.5 h-3.5" /> Uvoľniť všetky modely z VRAM
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs bg-zinc-100 hover:bg-white text-zinc-900 font-medium rounded-lg transition-colors"
          >
            Zatvoriť
          </button>
        </div>
      </div>
    </div>
  );
};

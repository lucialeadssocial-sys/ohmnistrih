import React, { useState } from "react";
import {
  X,
  Settings,
  Server,
  Zap,
  HelpCircle,
  Code2,
  ExternalLink,
  ShieldCheck,
  Check,
} from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: "sk" | "en";
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  language,
}) => {
  const isSk = language === "sk";
  const [backendUrl, setBackendUrl] = useState(
    () => localStorage.getItem("vd_backend") || ""
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSaveBackend = () => {
    localStorage.setItem("vd_backend", backendUrl.trim());
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-5 sm:p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-xl p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-all"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-800 text-rose-400 border border-neutral-700">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-['Fraunces'] text-lg font-bold text-white">
              {isSk ? "Nastavenia & Návod" : "Settings & Architecture"}
            </h3>
            <p className="text-xs text-neutral-400">
              {isSk
                ? "Dva režimy strihu: Lokálny bezplatný a Vlastný cloud backend"
                : "Dual mode: In-browser $0 engine or external pipeline"}
            </p>
          </div>
        </div>

        <div className="space-y-4 text-xs">
          {/* Engine 1: Default In-Browser */}
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-3.5 space-y-1.5">
            <div className="flex items-center gap-2 text-rose-400 font-bold">
              <Zap className="h-4 w-4" />
              <span>
                {isSk
                  ? "1. Štandardný režim (100% Zadarmo v prehliadači)"
                  : "1. Built-in In-Browser Studio ($0 Free)"}
              </span>
            </div>
            <p className="text-neutral-300 leading-relaxed">
              {isSk
                ? "Využíva HTML5 Canvas + Web Audio API syntetizátor priamo v tvojom zariadení. Nepotrebuješ platiť žiadne predplatné, žiadne tokeny ani poplatky za renderovanie. Všetko prebieha okamžite."
                : "Uses client-side Canvas and Web Audio API directly in your browser. Zero subscriptions, zero token costs, no watermarks, unlimited renders."}
            </p>
          </div>

          {/* Engine 2: External Dispatch */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-3.5 space-y-2.5">
            <div className="flex items-center gap-2 text-indigo-400 font-bold">
              <Server className="h-4 w-4" />
              <span>
                {isSk
                  ? "2. Voliteľný externý backend (Render / Railway)"
                  : "2. Optional External Backend (Render / Railway)"}
              </span>
            </div>
            <p className="text-neutral-400 leading-relaxed">
              {isSk
                ? "Ak máš nasadený vlastný server z priloženého Python FastAPI skriptu (Whisper + Shotstack), môžeš tu zadať jeho URL."
                : "If you have deployed your own Python FastAPI orchestrator on Render/Railway, configure its URL here."}
            </p>

            <div className="flex gap-2">
              <input
                type="url"
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
                placeholder="https://tvoj-server.onrender.com"
                className="flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
              />
              <button
                onClick={handleSaveBackend}
                className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 font-bold text-white hover:bg-indigo-500"
              >
                {savedSuccess ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>{isSk ? "Uložené" : "Saved"}</span>
                  </>
                ) : (
                  <span>{isSk ? "Uložiť" : "Save"}</span>
                )}
              </button>
            </div>
          </div>

          {/* Gemini AI Status */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-emerald-400" />
              <span className="font-semibold text-neutral-300">
                {isSk ? "Gemini 3.8 Flash AI Model" : "Gemini 3.8 Flash AI Model"}
              </span>
            </div>
            <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-800/60">
              {isSk ? "Aktívny na serveri" : "Active Server-side"}
            </span>
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-neutral-800 px-4 py-2 text-xs font-bold text-white hover:bg-neutral-700"
          >
            {isSk ? "Zavrieť" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
};

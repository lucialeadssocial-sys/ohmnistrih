import React, { useState, useEffect } from "react";
import {
  Key,
  ShieldCheck,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Zap,
  Sparkles,
  ExternalLink,
  RefreshCw,
  X,
  Star,
  Layers,
  Sliders,
  Check,
} from "lucide-react";
import { AIProviderCredential, AICredentialCapability } from "../types";

interface ApiKeyManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  zeroTokenMode: boolean;
  onToggleZeroTokenMode: (enabled: boolean) => void;
}

export const ApiKeyManagerModal: React.FC<ApiKeyManagerModalProps> = ({
  isOpen,
  onClose,
  zeroTokenMode,
  onToggleZeroTokenMode,
}) => {
  const [keys, setKeys] = useState<AIProviderCredential[]>([]);
  const [sharedProjects, setSharedProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newKeyInput, setNewKeyInput] = useState("");
  const [newNameInput, setNewNameInput] = useState("");
  const [newProjectId, setNewProjectId] = useState("");
  const [newPriority, setNewPriority] = useState<"HIGH" | "NORMAL" | "LOW">("NORMAL");
  const [newModel, setNewModel] = useState("gemini-3.8-flash");
  const [newCapabilities, setNewCapabilities] = useState<AICredentialCapability[]>([
    "VIDEO_ANALYSIS",
    "TEXT_REASONING",
    "STRUCTURED_OUTPUT",
    "AUDIO",
  ]);

  const [detectedProvider, setDetectedProvider] = useState<{
    provider: string;
    label: string;
    color: string;
  } | null>(null);
  const [testResult, setTestResult] = useState<{
    valid: boolean;
    message: string;
    /** Presná odpoveď poskytovateľa (napr. od Googlu) – na diagnostiku. */
    detail?: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/keys");
      const data = await res.json();
      if (data.success) {
        setKeys(data.keys || []);
        setSharedProjects(data.sharedProjects || []);
        setLoadError(null);
      } else {
        setLoadError(data.error || "Server vrátil chybu pri načítaní kľúčov.");
      }
    } catch {
      // Predtým sa chyba ticho ignorovala a zoznam zostal prázdny – vyzeralo to,
      // akoby žiadne kľúče neboli, hoci v skutočnosti nebežal server.
      setLoadError(
        "Nepodarilo sa spojiť so serverom aplikácie. Server pravdepodobne nebeží – kľúče sa vtedy nedajú načítať ani pridať."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchKeys();
      setStatusMessage(null);
      setTestResult(null);
      setNewKeyInput("");
      setNewNameInput("");
      setNewProjectId("");
      setDetectedProvider(null);
    }
  }, [isOpen]);

  // Real-time key format recognition
  useEffect(() => {
    const trimmed = newKeyInput.trim();
    if (!trimmed) {
      setDetectedProvider(null);
      setTestResult(null);
      return;
    }

    if (trimmed.startsWith("AIzaSy")) {
      setDetectedProvider({
        provider: "gemini",
        label: "Google Gemini (AI Studio Free Tier • 15 RPM zdarma)",
        color: "bg-blue-50 text-blue-700 border-blue-200",
      });
    } else if (trimmed.startsWith("gsk_")) {
      setDetectedProvider({
        provider: "groq",
        label: "Groq Cloud (Ultra-Fast Free Tier)",
        color: "bg-amber-50 text-amber-700 border-amber-200",
      });
    } else if (trimmed.startsWith("sk-or-")) {
      setDetectedProvider({
        provider: "openrouter",
        label: "OpenRouter Free / Community",
        color: "bg-purple-50 text-purple-700 border-purple-200",
      });
    } else if (trimmed.startsWith("sk-")) {
      setDetectedProvider({
        provider: "custom",
        label: "OpenAI / Custom Kompatibilný Kľúč",
        color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      });
    } else if (trimmed.length >= 8) {
      setDetectedProvider({
        provider: "gemini",
        label: "Google Gemini Kompatibilný Formát",
        color: "bg-blue-50 text-blue-700 border-blue-200",
      });
    } else {
      setDetectedProvider(null);
    }
  }, [newKeyInput]);

  const handleTestKey = async (keyString?: string, credentialId?: string) => {
    const toTest = keyString || newKeyInput.trim();
    if (!toTest && !credentialId) return;

    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/keys/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentialId ? { id: credentialId } : { key: toTest }),
      });
      const data = await res.json();
      if (data.success && data.valid) {
        setTestResult({
          valid: true,
          message: data.message || "Kľúč je 100% overený a pripravený!",
        });
        if (credentialId) fetchKeys();
      } else {
        setTestResult({
          valid: false,
          message: data.error || data.message || "Kľúč sa nepodarilo overiť.",
          // Detail od poskytovateľa – umožní presne zistiť príčinu
          // (napr. vypnuté Gemini API v projekte, obmedzenie regiónu…).
          detail: data.rawError ? String(data.rawError).slice(0, 240) : undefined,
        });
      }
    } catch (err: any) {
      setTestResult({
        valid: false,
        message:
          "Nepodarilo sa spojiť so serverom aplikácie (server pravdepodobne nebeží). Skontroluj, či je dev server spustený.",
        detail: err?.message,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleAddKey = async () => {
    if (!newKeyInput.trim()) return;
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: newKeyInput.trim(),
          name: newNameInput.trim() || undefined,
          projectId: newProjectId.trim() || undefined,
          priority: newPriority,
          model: newModel,
          capabilities: newCapabilities,
          quotaScope: "PROJECT",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: "success",
          text: data.message || "Credential úspešne pridaný do poolu!",
        });
        setNewKeyInput("");
        setNewNameInput("");
        setNewProjectId("");
        setTestResult(null);
        setDetectedProvider(null);
        fetchKeys();
      } else {
        setStatusMessage({
          type: "error",
          text: data.error || "Chyba pri pridávaní credentialu.",
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "Nastala chyba.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleKey = async (id: string, currentEnabled: boolean) => {
    try {
      const res = await fetch(`/api/keys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !currentEnabled }),
      });
      if (res.ok) {
        fetchKeys();
      }
    } catch {
      // ignore
    }
  };

  const handleTogglePreferred = async (id: string, currentPref?: boolean) => {
    try {
      const res = await fetch(`/api/keys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferred: !currentPref }),
      });
      if (res.ok) {
        fetchKeys();
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteKey = async (id: string) => {
    try {
      const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        fetchKeys();
      } else {
        setStatusMessage({ type: "error", text: data.error || "Zlyhalo zmazanie." });
      }
    } catch {
      // ignore
    }
  };

  const toggleCapability = (cap: AICredentialCapability) => {
    if (newCapabilities.includes(cap)) {
      setNewCapabilities(newCapabilities.filter((c) => c !== cap));
    } else {
      setNewCapabilities([...newCapabilities, cap]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-xs z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                Multi AI Credential & Quota Manager
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  0€ Ultimátum
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Správa vlastných AI kľúčov, detekcia projektovej kvóty a bezpečný failover bez porušenia limitov
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Zero-Token Mode Banner */}
          <div className={`p-4 rounded-xl border transition-all ${
            zeroTokenMode
              ? "bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20"
              : "bg-slate-50 border-slate-200"
          }`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  zeroTokenMode ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
                }`}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">
                      100% Bezplatný 0-Token Režim (Šetrenie kvóty)
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                      0 TOKENOV
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    Keď je zapnutý, analýzy a OmniStrih strihy sa generujú okamžite cez lokálny deterministický algoritmus bez spotreby API tokenov. Ušetrí 100% vašich limitov.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={zeroTokenMode}
                  onChange={(e) => onToggleZeroTokenMode(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>

          {/* Shared Projects Quota Banner (if any projects share quota) */}
          {sharedProjects.some((p) => p.isSharedQuota) && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <Layers className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Detegovaná zdieľaná kvóta projektu (Shared Google Cloud Quota):</span>
                <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                  Viac vašich kľúčov patrí pod rovnaký projekt GCP. OmniStrih vie, že zdieľajú rovnaký limit a nebude medzi nimi zbytočne rotovať pri vyčerpaní kvóty.
                </p>
              </div>
            </div>
          )}

          {/* Add New Credential Form */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-blue-600" />
                Pridať vlastný AI Credential
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 hover:underline"
              >
                Získať bezplatný Gemini kľúč
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">API Kľúč *</label>
                <input
                  type="text"
                  placeholder="AIzaSy... (Gemini) alebo gsk_... (Groq)"
                  value={newKeyInput}
                  onChange={(e) => setNewKeyInput(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">Vlastný Názov (Voliteľné)</label>
                <input
                  type="text"
                  placeholder="Napr. Osobný AI Studio Kľúč 1"
                  value={newNameInput}
                  onChange={(e) => setNewNameInput(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">Model</label>
                <select
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="gemini-3.8-flash">gemini-3.8-flash (Rýchly, bezplatný)</option>
                  <option value="gemini-3.8-pro">gemini-3.8-pro (Vysoká kvalita)</option>
                  <option value="llama-3.3-70b">Groq Llama 3.3 (Fallback)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">Priorita</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="HIGH">Vysoká (Preferovaná)</option>
                  <option value="NORMAL">Normálna</option>
                  <option value="LOW">Nízka (Záložná)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">GCP Projekt ID (Voliteľné)</label>
                <input
                  type="text"
                  placeholder="napr. my-gcp-project-1"
                  value={newProjectId}
                  onChange={(e) => setNewProjectId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 mb-1 block">Podporované Schopnosti (Capabilities):</label>
              <div className="flex flex-wrap gap-1.5">
                {(["VIDEO_ANALYSIS", "TEXT_REASONING", "STRUCTURED_OUTPUT", "AUDIO", "IMAGE"] as AICredentialCapability[]).map((cap) => {
                  const isChecked = newCapabilities.includes(cap);
                  return (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => toggleCapability(cap)}
                      className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-colors ${
                        isChecked
                          ? "bg-blue-600 text-white"
                          : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3" />}
                      {cap}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Auto-Recognition Indicator */}
            {detectedProvider && (
              <div className={`px-3 py-2 rounded-lg border text-xs font-medium flex items-center justify-between ${detectedProvider.color}`}>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span>Rozpoznané: <strong>{detectedProvider.label}</strong></span>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/70">
                  Auto-Detect
                </span>
              </div>
            )}

            {/* Test result message */}
            {testResult && (
              <div
                className={`px-3 py-2 rounded-lg border text-xs flex items-center gap-2 ${
                  testResult.valid
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-red-50 text-red-800 border-red-200"
                }`}
              >
                {testResult.valid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{testResult.message}</span>
                {testResult.detail && (
                  <span className="ml-auto text-[10px] font-mono text-slate-500 max-w-[45%] truncate" title={testResult.detail}>
                    {testResult.detail}
                  </span>
                )}
              </div>
            )}

            {/* Status message */}
            {statusMessage && (
              <div
                className={`px-3 py-2 rounded-lg border text-xs flex items-center gap-2 ${
                  statusMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-red-50 text-red-800 border-red-200"
                }`}
              >
                {statusMessage.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleTestKey()}
                disabled={!newKeyInput.trim() || isTesting}
                className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors"
              >
                {isTesting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                )}
                Otestovať Kľúč
              </button>
              <button
                type="button"
                onClick={handleAddKey}
                disabled={!newKeyInput.trim() || isSubmitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                Pridať Credential
              </button>
            </div>
          </div>

          {/* Active Credentials Pool Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <span>Zoznam AI Credentials ({keys.length})</span>
                <span className="text-[10px] font-normal text-slate-500 lowercase">
                  (s projektovou kvótou & priorizáciou)
                </span>
              </h3>
              <button
                onClick={fetchKeys}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                Obnoviť
              </button>
            </div>

            {loadError && (
              <div className="px-3 py-2 rounded-lg border text-xs flex items-start gap-2 bg-red-50 text-red-800 border-red-200">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{loadError}</span>
              </div>
            )}

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
              {keys.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  V poole sa zatiaľ nenachádzajú žiadne kľúče. Vlož kľúč do poľa vyššie a klikni na
                  <strong className="text-slate-500"> „Pridať Credential“</strong> — bez uloženého
                  kľúča bežia len lokálne (offline) funkcie. Samotné „Otestovať Kľúč“ kľúč neukladá.
                </div>
              ) : (
                keys.map((k, idx) => (
                  <div key={k.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center">
                        #{idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTogglePreferred(k.id, k.preferred)}
                            title={k.preferred ? "Preferovaný credential" : "Označiť ako preferovaný"}
                            className="text-amber-500 hover:scale-110 transition-transform"
                          >
                            <Star className={`w-3.5 h-3.5 ${k.preferred ? "fill-amber-400 text-amber-500" : "text-slate-300"}`} />
                          </button>
                          <span className="text-xs font-bold text-slate-900">
                            {k.name || `Credential ${idx + 1}`}
                          </span>
                          <span className="text-xs font-mono text-slate-500">
                            ({k.keyMasked})
                          </span>
                          {k.isDefaultSystemKey && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                              Systémový
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              !k.enabled
                                ? "bg-slate-100 text-slate-500"
                                : k.status === "READY" || k.status === ("active" as any)
                                ? "bg-emerald-100 text-emerald-800"
                                : k.status === "COOLDOWN" || k.status === ("rate-limited" as any)
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {!k.enabled
                              ? "Vypnutý"
                              : k.status === "READY" || k.status === ("active" as any)
                              ? "● Pripravený"
                              : k.status === "COOLDOWN" || k.status === ("rate-limited" as any)
                              ? "⏳ Cooldown"
                              : "Chyba"}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {k.priority || "NORMAL"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2 mt-1">
                          <span>Model: <strong>{k.model || "gemini-3.8-flash"}</strong></span>
                          <span>•</span>
                          <span>Projekt: <strong>{k.projectId || "default"}</strong></span>
                          <span>•</span>
                          <span>Požiadavky: {k.requestCount || 0}</span>
                          {k.errorCount > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-amber-600">Chyby: {k.errorCount}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleToggleKey(k.id, k.enabled)}
                        className={`px-2 py-1 rounded text-[11px] font-bold transition-colors ${
                          k.enabled
                            ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
                            : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                        }`}
                      >
                        {k.enabled ? "Vypnúť" : "Zapnúť"}
                      </button>

                      <button
                        onClick={() => handleTestKey(undefined, k.id)}
                        disabled={isTesting}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                        title="Otestovať tento kľúč"
                      >
                        <Zap className="w-4 h-4" />
                      </button>

                      {!k.isDefaultSystemKey && (
                        <button
                          onClick={() => handleDeleteKey(k.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Odstrániť credential"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Educational Free Tier Tip */}
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-blue-950">
              <Zap className="w-4 h-4 text-blue-600" />
              Zdieľanie kvót a bezpečné limity Google Cloud:
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1 leading-relaxed">
              <li>
                <strong>Google AI Studio:</strong> Každý Google Cloud projekt má samostatnú bezplatnú kvótu (15 RPM).
              </li>
              <li>
                Ak do OmniStrih pridáte viac kľúčov z <em>rôznych projektov</em>, systém môže pri dočasnom prekročení jedného projektu bezpečne využiť druhý projekt.
              </li>
              <li>
                Ak kľúče patria do <em>rovnakého projektu</em>, OmniStrih rozpozná zdieľanú kvótu a nebude medzi nimi zbytočne rotovať. Namiesto toho použije cooldown a lokálny offline engine.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors shadow-xs"
          >
            Hotovo
          </button>
        </div>
      </div>
    </div>
  );
};


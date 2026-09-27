import React, { useState } from "react";
import {
  Brain,
  Sliders,
  Sparkles,
  ShieldAlert,
  Check,
  X,
  RotateCcw,
  Plus,
  Copy,
  Lock,
  Unlock,
  HelpCircle,
  TrendingUp,
  Layers,
  Zap
} from "lucide-react";
import { EditBrainManager } from "../utils/editBrainManager";
import { EditDNAProfile, LearnedPreference } from "../types/editDNA";

interface EditorBrainCenterProps {
  language: "sk" | "en";
  showToast: (msg: string, type?: "success" | "info" | "warning") => void;
  projectId: string;
}

export const EditorBrainCenter: React.FC<EditorBrainCenterProps> = ({
  language,
  showToast,
  projectId,
}) => {
  const isSk = language === "sk";
  const [brainState, setBrainState] = useState(() => EditBrainManager.getState(projectId));
  const [activeTab, setActiveTab] = useState<"profiles" | "parameters" | "learning" | "conflicts">("profiles");
  const [selectedProfileId, setSelectedProfileId] = useState(brainState.activeProfileId);

  const activeProfile = brainState.profiles.find((p) => p.id === selectedProfileId) || brainState.globalDNA;
  const conflicts = EditBrainManager.detectConflicts(projectId, selectedProfileId);
  const proposedPreferences = EditBrainManager.analyzeHistoryAndProposePreferences(projectId);

  // Handle switching active profile
  const handleSelectProfile = (id: string) => {
    setSelectedProfileId(id);
    const updated = { ...brainState, activeProfileId: id };
    EditBrainManager.saveState(projectId, updated);
    setBrainState(updated);
    showToast(isSk ? "Profil Edit DNA bol prepnutý" : "Edit DNA profile switched", "success");
  };

  // Handle parameter edit
  const handleParamChange = (key: keyof EditDNAProfile, value: any) => {
    const updatedProfiles = brainState.profiles.map((p) => {
      if (p.id === selectedProfileId) {
        return { ...p, [key]: value, source: "USER" as const };
      }
      return p;
    });
    const updated = { ...brainState, profiles: updatedProfiles };
    EditBrainManager.saveState(projectId, updated);
    setBrainState(updated);
  };

  // Accept learned preference
  const handleAcceptLearned = (lp: LearnedPreference) => {
    const updatedLearned = [...brainState.learnedPreferences, lp];
    const updated = { ...brainState, learnedPreferences: updatedLearned };
    EditBrainManager.saveState(projectId, updated);
    setBrainState(updated);
    showToast(isSk ? "Naučená preferencia bola akceptovaná do DNA" : "Learned preference accepted into DNA", "success");
  };

  return (
    <div className="space-y-6 text-neutral-100">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-neutral-950 border border-neutral-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              {isSk ? "Editor Brain & Edit DNA" : "Editor Brain & Edit DNA"}
            </h2>
            <p className="text-xs text-neutral-400">
              {isSk
                ? "Personálny editačný mozog, štýlové profily, učenie z histórie rozhodnutí a detekcia konfliktov."
                : "Personal editing brain, style profiles, history learning, and conflict detection."}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
          <button
            onClick={() => setActiveTab("profiles")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "profiles"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {isSk ? "1. Štýlové Profily" : "1. Style Profiles"}
          </button>
          <button
            onClick={() => setActiveTab("parameters")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "parameters"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {isSk ? "2. Edit DNA Parametre" : "2. DNA Parameters"}
          </button>
          <button
            onClick={() => setActiveTab("learning")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all relative ${
              activeTab === "learning"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {isSk ? "3. Learning Loop" : "3. Learning Loop"}
            {proposedPreferences.length > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-neutral-950 font-mono text-[9px] font-black">
                {proposedPreferences.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("conflicts")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all relative ${
              activeTab === "conflicts"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {isSk ? "4. Konflikty" : "4. Conflicts"}
            {conflicts.length > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-mono text-[9px] font-black">
                {conflicts.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab 1: Style Profiles */}
      {activeTab === "profiles" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {brainState.profiles.map((profile: EditDNAProfile) => {
              const isSelected = selectedProfileId === profile.id;
              const isActive = brainState.activeProfileId === profile.id;

              return (
                <div
                  key={profile.id}
                  onClick={() => setSelectedProfileId(profile.id)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                    isSelected
                      ? "bg-purple-950/20 border-purple-500 shadow-xl shadow-purple-500/10 ring-1 ring-purple-500/30"
                      : "bg-neutral-900 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-neutral-100">{profile.name}</h3>
                      {isActive && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono text-[10px] font-bold border border-purple-500/30">
                          {isSk ? "AKTÍVNY" : "ACTIVE"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-400 line-clamp-2">{profile.description}</p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-neutral-800/80">
                    <div className="text-[11px] font-mono text-neutral-500">
                      Pacing: <span className="text-neutral-300 font-bold">{profile.overallPacing}</span>
                    </div>

                    {!isActive && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectProfile(profile.id);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-600/20 transition-all"
                      >
                        {isSk ? "Použiť profil" : "Select Profile"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Edit DNA Parameters */}
      {activeTab === "parameters" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-3">
            <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">
                {isSk ? "Upravovaný Profil" : "Editing Profile"}
              </h3>
              <div className="text-sm font-bold text-neutral-100">{activeProfile.name}</div>
              <p className="text-xs text-neutral-400">{activeProfile.description}</p>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-2 text-xs text-neutral-400">
              <div className="flex justify-between">
                <span>Source:</span>
                <span className="text-emerald-400 font-bold font-mono">{activeProfile.source}</span>
              </div>
              <div className="flex justify-between">
                <span>DNA Version:</span>
                <span className="text-purple-400 font-bold font-mono">v{brainState.dnaVersion}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-4">
            <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-6 shadow-xl">
              <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-400" />
                {isSk ? "Kľúčové Edit DNA Parametre" : "Key Edit DNA Parameters"}
              </h3>

              <div className="space-y-4 text-xs">
                {/* Pacing */}
                <div className="space-y-1.5">
                  <div className="flex justify-between font-semibold text-neutral-300">
                    <span>{isSk ? "Celkové Tempo (Overall Pacing)" : "Overall Pacing"}</span>
                    <span className="text-purple-400 uppercase font-mono">{activeProfile.overallPacing}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {(["fast", "balanced", "slow", "cinematic"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => handleParamChange("overallPacing", p)}
                        className={`py-2 rounded-xl border text-xs font-bold uppercase transition-all ${
                          activeProfile.overallPacing === p
                            ? "bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-600/20"
                            : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Silence Threshold */}
                <div className="space-y-1.5">
                  <div className="flex justify-between font-semibold text-neutral-300">
                    <span>{isSk ? "Maximálna pauza pred strihom (Max Comfortable Pause)" : "Max Comfortable Pause"}</span>
                    <span className="text-emerald-400 font-mono">{activeProfile.maxComfortablePause}s</span>
                  </div>
                  <input
                    type="range"
                    min="0.3"
                    max="2.0"
                    step="0.1"
                    value={activeProfile.maxComfortablePause}
                    onChange={(e) => handleParamChange("maxComfortablePause", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 bg-neutral-950"
                  />
                </div>

                {/* Zoom Intensity */}
                <div className="space-y-1.5">
                  <div className="flex justify-between font-semibold text-neutral-300">
                    <span>{isSk ? "Intenzita Zoomu (Zoom Intensity)" : "Zoom Intensity"}</span>
                    <span className="text-cyan-400 font-mono">{activeProfile.zoomIntensity}x</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="1.5"
                    step="0.05"
                    value={activeProfile.zoomIntensity}
                    onChange={(e) => handleParamChange("zoomIntensity", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 bg-neutral-950"
                  />
                </div>

                {/* Caption Style */}
                <div className="space-y-1.5">
                  <div className="flex justify-between font-semibold text-neutral-300">
                    <span>{isSk ? "Štýl titulkov (Caption Style)" : "Caption Style"}</span>
                    <span className="text-amber-400 uppercase font-mono">{activeProfile.captionStyle}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {(["hormozi", "cinematic", "karaoke", "minimal", "cyberpunk"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => handleParamChange("captionStyle", s)}
                        className={`py-2 rounded-xl border text-[11px] font-bold uppercase transition-all ${
                          activeProfile.captionStyle === s
                            ? "bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-600/20"
                            : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Learning Loop */}
      {activeTab === "learning" && (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              {isSk ? "Learning Loop & Zistené Návrhy" : "Learning Loop & Proposed Preferences"}
            </h3>
            <p className="text-xs text-neutral-400">
              {isSk
                ? "Editor Brain analyzuje vaše manuálne úpravy v EDL a navrhuje aktualizáciu Edit DNA. Vy rozhodujete, čo sa schváli."
                : "Editor Brain analyzes your manual EDL edits and suggests Edit DNA updates. You decide what gets accepted."}
            </p>

            <div className="space-y-3 pt-2">
              {proposedPreferences.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-500">
                  {isSk ? "Zatiaľ nie je dostatok vzoriek z editov na nové návrhy." : "Not enough sample edits yet for new proposals."}
                </div>
              ) : (
                proposedPreferences.map((lp) => (
                  <div
                    key={lp.id}
                    className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-500/30">
                          Confidence: {(lp.confidence * 100).toFixed(0)}%
                        </span>
                        <span className="text-xs font-mono text-neutral-400">Samples: {lp.sampleCount}</span>
                      </div>
                      <p className="text-xs font-semibold text-neutral-200">{lp.evidence}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleAcceptLearned(lp)}
                        className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-neutral-950 font-bold text-xs flex items-center gap-1 shadow-lg shadow-emerald-600/20 transition-all"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {isSk ? "Akceptovať" : "Accept"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Conflicts */}
      {activeTab === "conflicts" && (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              {isSk ? "Detekcia Konfliktov medzi Pravidlami" : "Rule Conflict Detection"}
            </h3>

            <div className="space-y-3 pt-2">
              {conflicts.length === 0 ? (
                <div className="p-8 text-center text-xs text-emerald-400">
                  {isSk ? "Žiadne konflikty medzi globálnym DNA a profilom neboli zistené." : "No conflicts detected between global DNA and profile."}
                </div>
              ) : (
                conflicts.map((c, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/30 space-y-2 text-xs">
                    <div className="font-bold text-rose-300">Konflikt v parametri: {c.key}</div>
                    <div className="grid grid-cols-3 gap-2 font-mono text-neutral-400">
                      <div>Global: {String(c.globalVal)}</div>
                      <div>Profile: {String(c.profileVal)}</div>
                      <div className="text-emerald-400 font-bold">Effective: {String(c.effectiveVal)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

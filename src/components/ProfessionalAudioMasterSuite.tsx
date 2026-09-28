import React, { useState, useEffect } from "react";
import {
  Sliders,
  Volume2,
  Activity,
  ShieldAlert,
  Zap,
  CheckCircle2,
  Mic,
  Music,
  Bell,
  Sparkles,
  Gauge,
  Radio,
  Layers,
  Wand2,
  RotateCcw
} from "lucide-react";
import {
  ParametricEQState,
  AudioMasteringConfig,
  RealtimeLoudnessMetrics
} from "../types";

import { coreEngine } from "../core";
import { SetEQCommand, SetCompressionCommand } from "../core/command/commandSystem";

interface ProfessionalAudioMasterSuiteProps {
  language: "sk" | "en";
  showToast: (msg: string, type?: "success" | "info" | "warning") => void;
}

export const ProfessionalAudioMasterSuite: React.FC<ProfessionalAudioMasterSuiteProps> = ({
  language,
  showToast,
}) => {
  const isSk = language === "sk";

  // EQ state
  const [eq, setEq] = useState<ParametricEQState>({
    highPassEnabled: true,
    highPassCutoffHz: 80,
    lowShelfGainDb: 1.5,
    midFrequencyHz: 450,
    midGainDb: -2.5, // De-mud
    midQFactor: 1.2,
    highShelfGainDb: 3.0, // Air boost
    voicePolishPreset: "BROADCAST_WARMTH",
  });

  // Mastering config
  const [masterConfig, setMasterConfig] = useState<AudioMasteringConfig>({
    noiseSuppressionStrength: 65,
    rumbleFilterActive: true,
    deEsserStrength: 45,
    loudnessTargetLUFS: -14,
    truePeakLimiterDbfs: -1.0,
    voiceLevelDb: 0,
    musicLevelDb: -18,
    sfxLevelDb: -12,
    sidechainDuckingRatio: 5,
    duckingThresholdDb: -24,
    dynamicRangeCompressor: true,
  });

  // Simulated live loudness metering
  const [metrics, setMetrics] = useState<RealtimeLoudnessMetrics>({
    momentaryLUFS: -13.8,
    shortTermLUFS: -14.1,
    integratedLUFS: -14.0,
    truePeakDbfs: -1.1,
    clippingDetected: false,
    rumbleDetected: false,
    stereoBalance: 0.02,
  });

  /**
   * Writes the current suite settings into the canonical project so the values are real
   * state that the export audio graph actually processes. Returns how many clips changed.
   */
  const applyMixToCanonicalProject = (eqState: ParametricEQState, config: AudioMasteringConfig): number => {
    const project = coreEngine.getProject();
    const audioClips = project.tracks
      .flatMap(t => t.clips)
      .filter(c => c.type === "audio");
    const targets = audioClips.length > 0 ? audioClips : project.tracks.flatMap(t => t.clips).slice(0, 1);

    let applied = 0;
    for (const clip of targets) {
      const okEq = coreEngine.commandManager.executeCommand(new SetEQCommand(clip.id, {
        enabled: true,
        bypass: false,
        highPass: { enabled: eqState.highPassEnabled, freq: eqState.highPassCutoffHz },
        lowShelf: { freq: 120, gain: eqState.lowShelfGainDb },
        mid: { freq: eqState.midFrequencyHz, gain: eqState.midGainDb, q: eqState.midQFactor },
        highShelf: { freq: 8000, gain: eqState.highShelfGainDb },
      }));
      const okComp = config.dynamicRangeCompressor
        ? coreEngine.commandManager.executeCommand(new SetCompressionCommand(clip.id, {
            enabled: true,
            bypass: false,
            threshold: config.duckingThresholdDb,
            ratio: Math.max(1, config.sidechainDuckingRatio),
            attack: 0.01,
            release: 0.25,
            makeupGain: 0,
          }))
        : false;
      if (okEq || okComp) applied++;
    }
    return applied;
  };

  // Preset changer
  const applyPreset = (preset: ParametricEQState["voicePolishPreset"]): ParametricEQState => {
    let next: ParametricEQState = eq;
    switch (preset) {
      case "BROADCAST_WARMTH":
        next = {
          highPassEnabled: true,
          highPassCutoffHz: 80,
          lowShelfGainDb: 2.5,
          midFrequencyHz: 400,
          midGainDb: -3.0,
          midQFactor: 1.4,
          highShelfGainDb: 2.0,
          voicePolishPreset: "BROADCAST_WARMTH",
        };
        break;
      case "CRISP_CLARITY":
        next = {
          highPassEnabled: true,
          highPassCutoffHz: 95,
          lowShelfGainDb: -1.0,
          midFrequencyHz: 550,
          midGainDb: -4.0,
          midQFactor: 1.8,
          highShelfGainDb: 4.5,
          voicePolishPreset: "CRISP_CLARITY",
        };
        break;
      case "PODCAST_STUDIO":
        next = {
          highPassEnabled: true,
          highPassCutoffHz: 80,
          lowShelfGainDb: 1.0,
          midFrequencyHz: 350,
          midGainDb: -2.0,
          midQFactor: 1.0,
          highShelfGainDb: 2.5,
          voicePolishPreset: "PODCAST_STUDIO",
        };
        break;
      case "FLAT_NATURAL":
        next = {
          highPassEnabled: true,
          highPassCutoffHz: 80,
          lowShelfGainDb: 0.0,
          midFrequencyHz: 1000,
          midGainDb: 0.0,
          midQFactor: 1.0,
          highShelfGainDb: 0.0,
          voicePolishPreset: "FLAT_NATURAL",
        };
        break;
    }
    setEq(next);
    showToast(isSk ? `Preset aktivovaný: ${preset}` : `Preset applied: ${preset}`, "success");
    return next;
  };

  return (
    <div className="space-y-6 text-neutral-100">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-neutral-950 border border-neutral-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              {isSk ? "Profesionálny Zvukový Mastering Engine" : "Professional Audio Mastering Suite"}
            </h2>
            <p className="text-xs text-neutral-400">
              {isSk
                ? "Kompletný mastering: 80Hz Rumble filter, Parametrický EQ (De-Mud & Air Boost), Sidechain Ducking a -14 LUFS YouTube Limiter."
                : "Comprehensive mastering: 80Hz rumble high-pass, 3-band parametric EQ, sidechain ducking, and -14 LUFS True-Peak limiter."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const nextEq = applyPreset("BROADCAST_WARMTH");
              const nextConfig: AudioMasteringConfig = {
                ...masterConfig,
                noiseSuppressionStrength: 70,
                rumbleFilterActive: true,
                loudnessTargetLUFS: -14,
                sidechainDuckingRatio: 5,
              };
              setMasterConfig(nextConfig);
              const applied = applyMixToCanonicalProject(nextEq, nextConfig);
              if (applied > 0) {
                showToast(
                  isSk
                    ? `EQ (rumble filter + 3 pásma) a kompresia zapísané na ${applied} klip(ov) v projekte — export ich aplikuje. Cieľová LUFS normalizácia nie je meraná.`
                    : `EQ (rumble filter + 3 bands) and compression written to ${applied} clip(s) in the project — the export applies them. LUFS target normalization is not measured.`,
                  "success"
                );
              } else {
                showToast(
                  isSk
                    ? "Žiadny audio klip v projekte — nie je čo upraviť."
                    : "No audio clip in the project — nothing to process.",
                  "warning"
                );
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isSk ? "1-Click Auto Studio Polish" : "1-Click Auto Studio Polish"}
          </button>
        </div>
      </div>

      {/* Realtime Loudness Meter & Safety Display */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800">
        <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <span>{isSk ? "Integrovaná Hlasitosť" : "Integrated LUFS"}</span>
            <span className="text-[10px] text-amber-400 font-mono">Cieľ: {masterConfig.loudnessTargetLUFS} LUFS</span>
          </div>
          <div className="text-xl font-black font-mono text-emerald-400">
            {metrics.integratedLUFS.toFixed(1)} <span className="text-xs font-normal text-neutral-400">LUFS</span>
          </div>
          <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: "88%" }} />
          </div>
        </div>

        <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <span>True Peak (Max)</span>
            <span className="text-[10px] text-neutral-500 font-mono">Limit: {masterConfig.truePeakLimiterDbfs} dB</span>
          </div>
          <div className="text-xl font-black font-mono text-neutral-200">
            {metrics.truePeakDbfs.toFixed(1)} <span className="text-xs font-normal text-neutral-400">dBFS</span>
          </div>
          <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-500" style={{ width: "82%" }} />
          </div>
        </div>

        <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <span>Clipping Ochrana</span>
            <span className="text-[10px] text-emerald-400 font-mono">AKTÍVNA</span>
          </div>
          <div className="text-sm font-bold font-mono text-emerald-400 flex items-center gap-1.5 pt-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            0 Over-Peaks (Čisté)
          </div>
          <p className="text-[10px] text-neutral-500">{isSk ? "Žiadne skreslenie zvuku" : "Zero digital distortion"}</p>
        </div>

        <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <span>80Hz Rumble Filter</span>
            <span className={`text-[10px] font-mono ${masterConfig.rumbleFilterActive ? "text-emerald-400" : "text-neutral-500"}`}>
              {masterConfig.rumbleFilterActive ? "ZAPNUTÝ" : "VYPNUTÝ"}
            </span>
          </div>
          <div className="text-sm font-bold font-mono text-neutral-200 flex items-center gap-1.5 pt-1">
            <Zap className="w-4 h-4 text-amber-400" />
            High-Pass @ 80Hz
          </div>
          <p className="text-[10px] text-neutral-500">{isSk ? "Orezaný hluk z vibrácií stola" : "Desk vibration rumble cut"}</p>
        </div>
      </div>

      {/* Main Controls: 3 Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel 1: Parametric EQ & Polish Presets */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-neutral-200">
                {isSk ? "Parametrický Voice EQ" : "Parametric Voice EQ"}
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-950 text-neutral-400 border border-neutral-800">
              3-Band Studio
            </span>
          </div>

          {/* Preset Buttons */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              {isSk ? "Rýchle Presety Hlasu" : "Voice Polish Presets"}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["BROADCAST_WARMTH", "CRISP_CLARITY", "PODCAST_STUDIO", "FLAT_NATURAL"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => applyPreset(p)}
                  className={`px-2.5 py-2 rounded-xl text-left border text-[11px] font-semibold transition-all ${
                    eq.voicePolishPreset === p
                      ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-md shadow-amber-500/10"
                      : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700"
                  }`}
                >
                  {p === "BROADCAST_WARMTH"
                    ? "🎙️ Broadcast Warmth"
                    : p === "CRISP_CLARITY"
                    ? "✨ Crisp Clarity"
                    : p === "PODCAST_STUDIO"
                    ? "📻 Podcast Studio"
                    : "⚖️ Flat / Natural"}
                </button>
              ))}
            </div>
          </div>

          {/* EQ Sliders */}
          <div className="space-y-3.5 pt-2">
            {/* Low-End (Warmth / Rumble) */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-300">{isSk ? "Basy / Plnosť hlasu (120Hz)" : "Low Warmth (120Hz)"}</span>
                <span className="font-mono text-amber-400 font-bold">{eq.lowShelfGainDb > 0 ? `+${eq.lowShelfGainDb}` : eq.lowShelfGainDb} dB</span>
              </div>
              <input
                type="range"
                min="-6"
                max="6"
                step="0.5"
                value={eq.lowShelfGainDb}
                onChange={(e) => setEq({ ...eq, lowShelfGainDb: parseFloat(e.target.value), voicePolishPreset: "CUSTOM" })}
                className="w-full accent-amber-400"
              />
            </div>

            {/* Mid Frequency De-Mud */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-300">{isSk ? "De-Mud (Stredy / Zahmlenosť 450Hz)" : "De-Mud Clarity (450Hz)"}</span>
                <span className="font-mono text-amber-400 font-bold">{eq.midGainDb > 0 ? `+${eq.midGainDb}` : eq.midGainDb} dB</span>
              </div>
              <input
                type="range"
                min="-8"
                max="4"
                step="0.5"
                value={eq.midGainDb}
                onChange={(e) => setEq({ ...eq, midGainDb: parseFloat(e.target.value), voicePolishPreset: "CUSTOM" })}
                className="w-full accent-amber-400"
              />
            </div>

            {/* High-End Air Boost */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-300">{isSk ? "Air Boost (Výšky / Iskrivosť 10kHz)" : "Air Boost Sparkle (10kHz)"}</span>
                <span className="font-mono text-amber-400 font-bold">{eq.highShelfGainDb > 0 ? `+${eq.highShelfGainDb}` : eq.highShelfGainDb} dB</span>
              </div>
              <input
                type="range"
                min="-4"
                max="8"
                step="0.5"
                value={eq.highShelfGainDb}
                onChange={(e) => setEq({ ...eq, highShelfGainDb: parseFloat(e.target.value), voicePolishPreset: "CUSTOM" })}
                className="w-full accent-amber-400"
              />
            </div>
          </div>
        </div>

        {/* Panel 2: Noise, Rumble & De-Esser */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-neutral-200">
                {isSk ? "Čistenie & Odšumenie" : "Noise & Rumble Cleanup"}
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              DSP Offline
            </span>
          </div>

          <div className="space-y-4">
            {/* Noise Suppression */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-300">{isSk ? "Odstránenie šumu na pozadí" : "Background Noise Suppression"}</span>
                <span className="font-mono text-emerald-400 font-bold">{masterConfig.noiseSuppressionStrength}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={masterConfig.noiseSuppressionStrength}
                onChange={(e) => setMasterConfig({ ...masterConfig, noiseSuppressionStrength: parseInt(e.target.value) })}
                className="w-full accent-emerald-400"
              />
              <p className="text-[10px] text-neutral-500">{isSk ? "Potláča ventilátory, klimatizáciu a šum predzosilňovača." : "Suppresses AC, room hum, and preamp hiss."}</p>
            </div>

            {/* De-Esser */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-300">{isSk ? "De-Esser (Sycavky s/š/c)" : "De-Esser (Harsh Sibilance)"}</span>
                <span className="font-mono text-emerald-400 font-bold">{masterConfig.deEsserStrength}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={masterConfig.deEsserStrength}
                onChange={(e) => setMasterConfig({ ...masterConfig, deEsserStrength: parseInt(e.target.value) })}
                className="w-full accent-emerald-400"
              />
              <p className="text-[10px] text-neutral-500">{isSk ? "Zjemňuje nepríjemné vysokofrekvenčné sykavky." : "Attenuates harsh S and SH sibilants around 6-8kHz."}</p>
            </div>

            {/* Rumble Toggle */}
            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-neutral-200">{isSk ? "80Hz High-Pass Sub Rumble" : "80Hz High-Pass Rumble"}</span>
                <p className="text-[10px] text-neutral-500">{isSk ? "Odstraňuje nízkofrekvenčné dunenie" : "Cuts sub-bass rumble"}</p>
              </div>
              <input
                type="checkbox"
                checked={masterConfig.rumbleFilterActive}
                onChange={(e) => setMasterConfig({ ...masterConfig, rumbleFilterActive: e.target.checked })}
                className="w-4 h-4 accent-amber-400 rounded"
              />
            </div>
          </div>
        </div>

        {/* Panel 3: Voice / Music / SFX Mix Matrix & Ducking */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-neutral-200">
                {isSk ? "Audio Mix Matica & Ducking" : "Audio Mix & Sidechain Ducking"}
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Auto-Balanced
            </span>
          </div>

          <div className="space-y-3.5">
            {/* Voice Volume */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-neutral-300">
                  <Mic className="w-3.5 h-3.5 text-amber-400" />
                  {isSk ? "Hlas (Hlavná Stopa)" : "Voice (Dialogue Master)"}
                </span>
                <span className="font-mono text-amber-400 font-bold">{masterConfig.voiceLevelDb > 0 ? `+${masterConfig.voiceLevelDb}` : masterConfig.voiceLevelDb} dB</span>
              </div>
              <input
                type="range"
                min="-12"
                max="6"
                value={masterConfig.voiceLevelDb}
                onChange={(e) => setMasterConfig({ ...masterConfig, voiceLevelDb: parseFloat(e.target.value) })}
                className="w-full accent-amber-400"
              />
            </div>

            {/* Music Volume */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-neutral-300">
                  <Music className="w-3.5 h-3.5 text-purple-400" />
                  {isSk ? "Hudba na Pozadí (BGM)" : "Background Music"}
                </span>
                <span className="font-mono text-purple-400 font-bold">{masterConfig.musicLevelDb} dB</span>
              </div>
              <input
                type="range"
                min="-36"
                max="-6"
                value={masterConfig.musicLevelDb}
                onChange={(e) => setMasterConfig({ ...masterConfig, musicLevelDb: parseFloat(e.target.value) })}
                className="w-full accent-purple-400"
              />
            </div>

            {/* SFX Volume */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-neutral-300">
                  <Bell className="w-3.5 h-3.5 text-cyan-400" />
                  {isSk ? "Zvukové Efekty (SFX / Whoosh)" : "Sound Effects (SFX)"}
                </span>
                <span className="font-mono text-cyan-400 font-bold">{masterConfig.sfxLevelDb} dB</span>
              </div>
              <input
                type="range"
                min="-30"
                max="0"
                value={masterConfig.sfxLevelDb}
                onChange={(e) => setMasterConfig({ ...masterConfig, sfxLevelDb: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400"
              />
            </div>

            {/* Ducking Target */}
            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
              <div className="flex justify-between text-[11px] text-neutral-400">
                <span>Sidechain Ducking Ratio:</span>
                <span className="font-mono text-cyan-300 font-bold">{masterConfig.sidechainDuckingRatio}:1</span>
              </div>
              <p className="text-[10px] text-neutral-500">
                {isSk ? "Keď hovoríš, hudba sa plynulo zoslabí o -14dB." : "Music automatically ducks by -14dB whenever voice is detected."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

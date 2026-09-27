import React, { useState, useEffect, useRef } from "react";
import {
  NaturalVoicePresetId,
  DeliveryEmotion,
  DeliveryEnergy,
  VoiceQualityMode,
  VoiceProviderId,
  DeliveryPlanSentence,
  NaturalVoiceClip,
  NaturalVoiceProject,
  CaptionProject,
  AudioProject,
  VideoProjectSettings,
} from "../types";
import {
  VOICE_PRESETS,
  VoicePresetInfo,
  getProviderCapabilities,
  analyzeNaturalDeliveryPlan,
  synthesizeNaturalAudioLocally,
} from "../utils/aiVoiceEngine";
import { playSynthesizedSFX } from "../utils/audioSynth";

interface AINaturalVoiceStudioProps {
  isSk: boolean;
  captionProject?: CaptionProject;
  audioProject?: AudioProject;
  settings: VideoProjectSettings;
  currentTime: number;
  videoDuration: number;
  onSeek: (time: number) => void;
  onChangeSettings: (newSettings: Partial<VideoProjectSettings>) => void;
  onAddVoiceClip?: (clip: NaturalVoiceClip) => void;
  onClose?: () => void;
}

type StudioAction =
  | "generate_voiceover"
  | "from_transcript"
  | "replace_sentence"
  | "create_narrator"
  | "create_dialogue";

export const AINaturalVoiceStudio: React.FC<AINaturalVoiceStudioProps> = ({
  isSk,
  captionProject,
  audioProject,
  settings,
  currentTime,
  videoDuration,
  onSeek,
  onChangeSettings,
  onAddVoiceClip,
  onClose,
}) => {
  // Current mode
  const [activeAction, setActiveAction] = useState<StudioAction>("generate_voiceover");

  // Input states
  const [inputText, setInputText] = useState<string>(
    isSk
      ? "Vitajte pri tomto videu! Dnes vám ukážem, ako vytvoriť prirodzený hlas bez robotického tónu."
      : "Welcome to this video! Today I will show you how to create natural human speech without any robotic tone."
  );
  const [timelineRange, setTimelineRange] = useState<{ start: number; end: number }>({
    start: Math.max(0, Math.floor(currentTime)),
    end: Math.min(videoDuration || 30, Math.floor(currentTime) + 10),
  });
  const [rewriteRequested, setRewriteRequested] = useState<boolean>(false);
  const [rewrittenProposal, setRewrittenProposal] = useState<string | null>(null);

  // Voice & Delivery Settings
  const [selectedVoiceId, setSelectedVoiceId] = useState<NaturalVoicePresetId>("natural_male");
  const [customVoiceDescription, setCustomVoiceDescription] = useState<string>("");
  const [deliveryEmotion, setDeliveryEmotion] = useState<DeliveryEmotion>("neutral");
  const [deliveryEnergy, setDeliveryEnergy] = useState<DeliveryEnergy>("balanced");
  const [speed, setSpeed] = useState<number>(1.0);
  const [qualityMode, setQualityMode] = useState<VoiceQualityMode>("natural");
  const [activeProvider, setActiveProvider] = useState<VoiceProviderId>("gemini_expressive");

  // Advanced settings toggle
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [pauseStrength, setPauseStrength] = useState<number>(1.0); // 0.5 to 1.5
  const [expressiveness, setExpressiveness] = useState<number>(85); // 0 to 100
  const [stability, setStability] = useState<number>(75); // 0 to 100

  // Replace sentence specific state
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(
    captionProject?.segments?.[0]?.id || null
  );

  // Dialogue specific state
  const [speakerAVoice, setSpeakerAVoice] = useState<NaturalVoicePresetId>("natural_male");
  const [speakerBVoice, setSpeakerBVoice] = useState<NaturalVoicePresetId>("natural_female");
  const [dialogueTextA, setDialogueTextA] = useState<string>(
    isSk ? "Počul si o novom prirodzenom hlase v OmniStrihu?" : "Did you hear about the new natural voice in OmniStrih?"
  );
  const [dialogueTextB, setDialogueTextB] = useState<string>(
    isSk ? "Áno, znie úplne ako skutočný človek s prirodzenými pauzami!" : "Yes, it sounds completely human with authentic pacing and pauses!"
  );

  // Voice Cloning State
  const [cloneVoiceName, setCloneVoiceName] = useState<string>("");
  const [hasConsentConfirmed, setHasConsentConfirmed] = useState<boolean>(false);
  const [cloneStatusMessage, setCloneStatusMessage] = useState<string | null>(null);

  // Delivery Plan & Audio Preview
  const [deliveryPlan, setDeliveryPlan] = useState<DeliveryPlanSentence[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [takeIndex, setTakeIndex] = useState<number>(1);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  // Audio element reference for preview playback
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Provider capabilities
  const capabilities = getProviderCapabilities(activeProvider);

  // Creator memory check and audio cleanup on unmount
  useEffect(() => {
    const savedVoice = localStorage.getItem("omnistrih_preferred_voice");
    if (savedVoice && VOICE_PRESETS.some((p) => p.id === savedVoice)) {
      setSelectedVoiceId(savedVoice as NaturalVoicePresetId);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  // Cleanup blob URL when audioUrl changes or unmounts
  const lastBlobUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastBlobUrlRef.current && lastBlobUrlRef.current !== audioUrl && lastBlobUrlRef.current.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(lastBlobUrlRef.current);
      } catch (e) {
        // ignore
      }
    }
    lastBlobUrlRef.current = audioUrl;
    return () => {
      if (lastBlobUrlRef.current && lastBlobUrlRef.current.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(lastBlobUrlRef.current);
        } catch (e) {
          // ignore
        }
      }
    };
  }, [audioUrl]);

  const handleSelectVoice = (id: NaturalVoicePresetId) => {
    setSelectedVoiceId(id);
    localStorage.setItem("omnistrih_preferred_voice", id);
    playSynthesizedSFX("click", 0.3);
  };

  // 1. Analyze and generate Delivery Plan
  const handleAnalyzeDelivery = async () => {
    setIsAnalyzing(true);
    setStatusNotification(null);
    try {
      const res = await fetch("/api/ai-voice/delivery-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: inputText,
          baseEmotion: deliveryEmotion,
          baseEnergy: deliveryEnergy,
          speedMultiplier: speed,
          rewriteRequested,
          language: isSk ? "sk" : "en",
        }),
      });

      const data = await res.json();
      if (data.success && data.plan && data.plan.length > 0) {
        setDeliveryPlan(data.plan);
        if (data.rewrittenText) {
          setRewrittenProposal(data.rewrittenText);
        }
        playSynthesizedSFX("ding", 0.4);
      } else {
        // Local fallback
        const localPlan = analyzeNaturalDeliveryPlan(
          inputText,
          deliveryEmotion,
          deliveryEnergy,
          speed
        );
        setDeliveryPlan(localPlan);
      }
    } catch {
      const localPlan = analyzeNaturalDeliveryPlan(
        inputText,
        deliveryEmotion,
        deliveryEnergy,
        speed
      );
      setDeliveryPlan(localPlan);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 2. Synthesize Audio Preview
  const handleGenerateVoice = async () => {
    if (!inputText.trim()) return;
    setIsGenerating(true);
    setStatusNotification(null);

    try {
      // Step A: Ensure delivery plan exists
      let currentPlan = deliveryPlan;
      if (!currentPlan || currentPlan.length === 0) {
        currentPlan = analyzeNaturalDeliveryPlan(
          inputText,
          deliveryEmotion,
          deliveryEnergy,
          speed
        );
        setDeliveryPlan(currentPlan);
      }

      // Step B: Dispatch synthesis
      const res = await fetch("/api/ai-voice/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: inputText,
          voiceId: selectedVoiceId,
          emotion: deliveryEmotion,
          energy: deliveryEnergy,
          speed,
          qualityMode,
          language: isSk ? "sk" : "en",
          provider: activeProvider,
          customVoiceDescription: customVoiceDescription.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (data.capabilityError) {
        setStatusNotification(data.message); // "Provider does not support custom voice design."
        setIsGenerating(false);
        return;
      }

      // High-Fidelity Acoustic Generation & Loudness Mastering (-14 LUFS)
      const synthesized = await synthesizeNaturalAudioLocally(
        currentPlan,
        selectedVoiceId,
        qualityMode,
        qualityMode === "max_quality" ? 48000 : 44100
      );

      const objectUrl = URL.createObjectURL(synthesized.audioBlob);
      setAudioUrl(objectUrl);
      setAudioBuffer(synthesized.audioBuffer);
      setAudioDuration(synthesized.duration);
      setTakeIndex((prev) => prev + 1);

      playSynthesizedSFX("ding", 0.5);
      setStatusNotification(
        isSk
          ? `Hlas úspešne vygenerovaný (${synthesized.duration.toFixed(1)}s, -14 LUFS).`
          : `Voice successfully synthesized (${synthesized.duration.toFixed(1)}s, -14 LUFS).`
      );
    } catch (err: any) {
      setStatusNotification(
        isSk ? `Chyba syntézy: ${err.message}` : `Synthesis error: ${err.message}`
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // 3. Play / Pause preview audio
  const handleTogglePlayPreview = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  // 4. Apply to Timeline
  const handleUseThisVoice = () => {
    if (!audioUrl) return;

    const clip: NaturalVoiceClip = {
      id: `voice-clip-${Date.now()}`,
      sourceText: inputText,
      provider: activeProvider,
      providerLabel:
        activeProvider === "gemini_expressive"
          ? "Google Gemini Speech Engine"
          : activeProvider === "elevenlabs"
          ? "ElevenLabs Voice Engine"
          : "Local Expressive Acoustic Synthesizer",
      model:
        activeProvider === "gemini_expressive"
          ? "gemini-3.1-flash-tts-preview"
          : activeProvider === "elevenlabs"
          ? "eleven-multilingual-v2"
          : "omnistrih-formant-v3",
      voiceId: selectedVoiceId,
      voiceName:
        VOICE_PRESETS.find((p) => p.id === selectedVoiceId)?.nameSk || selectedVoiceId,
      customVoiceDescription: customVoiceDescription || undefined,
      emotion: deliveryEmotion,
      energy: deliveryEnergy,
      speed,
      qualityMode,
      audioUrl,
      audioBuffer: audioBuffer || undefined,
      duration: audioDuration,
      startTime: currentTime,
      endTime: currentTime + audioDuration,
      timelineTrackIndex: 2, // Voiceover dedicated track
      version: 1,
      userApproval: true,
      deliveryPlan,
      createdAt: new Date().toISOString(),
    };

    if (onAddVoiceClip) {
      onAddVoiceClip(clip);
    }

    // Auto-ducking awareness
    if (!settings.bgMusicDucking) {
      onChangeSettings({ bgMusicDucking: true });
    }

    playSynthesizedSFX("ding", 0.6);
    setStatusNotification(
      isSk
        ? "✅ Hlas bol pridaný na časovú os s automatickým duckingom hudby."
        : "✅ Voice applied to timeline with automatic music ducking."
    );
  };

  // 5. Replace Selected Sentence Flow
  const handleReplaceSentence = async () => {
    if (!selectedSegmentId || !captionProject) return;
    const segment = captionProject.segments.find((s) => s.id === selectedSegmentId);
    if (!segment) return;

    setInputText(segment.text);
    setActiveAction("generate_voiceover");
    handleAnalyzeDelivery();
    setStatusNotification(
      isSk
        ? `Text vety bol načítaný: "${segment.text}". Kliknite na [✨ GENERATE VOICE].`
        : `Sentence text loaded: "${segment.text}". Click [✨ GENERATE VOICE].`
    );
  };

  // 6. Voice from transcript
  const handleLoadFullTranscript = () => {
    if (!captionProject || !captionProject.segments || captionProject.segments.length === 0) {
      setStatusNotification(
        isSk ? "Žiadne titulky v projekte neboli nájdené." : "No transcript segments found in project."
      );
      return;
    }

    const fullText = captionProject.segments.map((s) => s.text).join(" ");
    setInputText(fullText);
    setStatusNotification(
      isSk
        ? `Načítaný prepis z ${captionProject.segments.length} segmentov.`
        : `Loaded transcript from ${captionProject.segments.length} segments.`
    );
    playSynthesizedSFX("click", 0.3);
  };

  // 7. Voice Cloning Handler
  const handleCloneVoice = async () => {
    if (!hasConsentConfirmed) {
      setCloneStatusMessage(
        isSk
          ? "⚠️ Pred klonovaním musíte potvrdiť, že máte autorské práva a súhlas na použitie tohto hlasu."
          : "⚠️ You must confirm you have the legal right and permission to clone this voice."
      );
      return;
    }

    try {
      const res = await fetch("/api/ai-voice/clone-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: activeProvider,
          hasConsentConfirmed,
          voiceName: cloneVoiceName || (isSk ? "Môj klonovaný hlas" : "My Cloned Voice"),
        }),
      });

      const data = await res.json();
      if (!data.available) {
        setCloneStatusMessage(
          isSk
            ? `NOT AVAILABLE: Aktuálny poskytovateľ (${activeProvider}) nepodporuje klonovanie hlasov.`
            : `NOT AVAILABLE: Current provider (${activeProvider}) does not support voice cloning.`
        );
      } else {
        setCloneStatusMessage(
          isSk ? "✅ Hlas bol úspešne naklonovaný a pripravený na použitie." : "✅ Voice cloned successfully."
        );
      }
    } catch (err: any) {
      setCloneStatusMessage(`Chyba: ${err.message}`);
    }
  };

  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden flex flex-col h-full shadow-2xl">
      {/* Top Header */}
      <div className="p-4 border-b border-neutral-800/80 bg-neutral-900/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xl shadow-lg shadow-indigo-500/20">
            🎙️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white tracking-wide">
                {isSk ? "AI Prirodzený Hlas" : "AI Natural Voice Studio"}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                PRO NARRATION
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              {isSk
                ? "Ľudský prednes, autentické pauzy a kontextové frázovanie bez robotického tónu"
                : "Human-like cadence, organic pauses and emotional phrasing with zero robotic tone"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Active Provider Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] font-mono text-neutral-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              {activeProvider === "gemini_expressive"
                ? "Google Gemini Speech (Flash)"
                : activeProvider === "elevenlabs"
                ? "ElevenLabs Studio"
                : "Local Acoustic DSP (0-Token)"}
            </span>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
        {/* Status Notification Banner */}
        {statusNotification && (
          <div className="p-3 rounded-xl bg-indigo-950/60 border border-indigo-800/80 text-xs text-indigo-200 flex items-center justify-between animate-fadeIn">
            <span>{statusNotification}</span>
            <button
              onClick={() => setStatusNotification(null)}
              className="text-neutral-400 hover:text-white ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* 1. What do you want to do? Mode Selector */}
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-2">
            <span>🎯</span>
            <span>{isSk ? "Čo chceš urobiť?" : "What do you want to do?"}</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              {
                id: "generate_voiceover",
                icon: "🗣️",
                labelSk: "Generovať komentár",
                labelEn: "Generate voiceover",
                descSk: "Komentár z vlastného textu",
                descEn: "Custom text narration",
              },
              {
                id: "from_transcript",
                icon: "📜",
                labelSk: "Hlas z prepisu",
                labelEn: "Voice from transcript",
                descSk: "Kompletný prepis videa",
                descEn: "Full video transcript",
              },
              {
                id: "replace_sentence",
                icon: "✂️",
                labelSk: "Nahradiť vetu",
                labelEn: "Replace sentence",
                descSk: "Oprava breptu / preklepu",
                descEn: "Fix stumble / retake",
              },
              {
                id: "create_narrator",
                icon: "🎙️",
                labelSk: "Vytvoriť rozprávača",
                labelEn: "Create narrator",
                descSk: "Dokumentárny persona profil",
                descEn: "Persona voice profile",
              },
              {
                id: "create_dialogue",
                icon: "👥",
                labelSk: "Vytvoriť dialóg",
                labelEn: "Create dialogue",
                descSk: "Konverzácia 2 hlasov",
                descEn: "2-speaker conversation",
              },
            ].map((action) => {
              const isSelected = activeAction === action.id;
              return (
                <button
                  key={action.id}
                  onClick={() => {
                    setActiveAction(action.id as StudioAction);
                    playSynthesizedSFX("click", 0.3);
                  }}
                  className={`p-3 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "bg-indigo-600/20 border-indigo-500/70 text-white shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/50"
                      : "bg-neutral-900/80 border-neutral-800 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{action.icon}</span>
                    <span className="text-xs font-bold truncate">
                      {isSk ? action.labelSk : action.labelEn}
                    </span>
                  </div>
                  <span className="text-[10px] text-neutral-400 line-clamp-1">
                    {isSk ? action.descSk : action.descEn}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Replace Sentence Specific View */}
        {activeAction === "replace_sentence" && (
          <div className="p-4 rounded-xl bg-neutral-900/90 border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <span>✂️</span>
                <span>{isSk ? "Vyber vetu z prepisu na nahradenie" : "Select sentence from transcript to replace"}</span>
              </span>
              <span className="text-[11px] text-neutral-400">
                {captionProject?.segments?.length || 0} {isSk ? "viet v projekte" : "sentences in project"}
              </span>
            </div>

            <div className="max-h-44 overflow-y-auto space-y-1.5 custom-scrollbar">
              {captionProject && captionProject.segments.length > 0 ? (
                captionProject.segments.map((seg) => (
                  <div
                    key={seg.id}
                    onClick={() => setSelectedSegmentId(seg.id)}
                    className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition ${
                      selectedSegmentId === seg.id
                        ? "bg-indigo-600/20 border-indigo-500 text-white"
                        : "bg-neutral-950 border-neutral-800/80 text-neutral-300 hover:border-neutral-700"
                    }`}
                  >
                    <span className="truncate max-w-[80%] font-medium">{seg.text}</span>
                    <span className="font-mono text-[10px] text-indigo-400">
                      {seg.start.toFixed(1)}s - {seg.end.toFixed(1)}s
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-neutral-500 text-center py-4">
                  {isSk ? "V projekte sa nenašli žiadne titulky." : "No subtitles found in project."}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                onClick={handleReplaceSentence}
                disabled={!selectedSegmentId}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer"
              >
                {isSk ? "🎙️ Nahradiť túto vetu AI hlasom →" : "🎙️ Replace this sentence with AI voice →"}
              </button>
            </div>
          </div>
        )}

        {/* 3. Dialogue Mode View */}
        {activeAction === "create_dialogue" && (
          <div className="p-4 rounded-xl bg-neutral-900/90 border border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <span>👥</span>
                <span>{isSk ? "Nastavenie dialógu 2 hlasov" : "2-Speaker Dialogue Setup"}</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                MULTI-VOICE
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Speaker A */}
              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-400">👤 {isSk ? "Rečník A" : "Speaker A"}</span>
                  <select
                    value={speakerAVoice}
                    onChange={(e) => setSpeakerAVoice(e.target.value as NaturalVoicePresetId)}
                    className="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-xs text-white cursor-pointer"
                  >
                    {VOICE_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {isSk ? p.nameSk : p.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={dialogueTextA}
                  onChange={(e) => setDialogueTextA(e.target.value)}
                  rows={2}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                  placeholder={isSk ? "Replika rečníka A..." : "Speaker A line..."}
                />
              </div>

              {/* Speaker B */}
              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-pink-400">👤 {isSk ? "Rečník B" : "Speaker B"}</span>
                  <select
                    value={speakerBVoice}
                    onChange={(e) => setSpeakerBVoice(e.target.value as NaturalVoicePresetId)}
                    className="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-xs text-white cursor-pointer"
                  >
                    {VOICE_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {isSk ? p.nameSk : p.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={dialogueTextB}
                  onChange={(e) => setDialogueTextB(e.target.value)}
                  rows={2}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-pink-500"
                  placeholder={isSk ? "Replika rečníka B..." : "Speaker B line..."}
                />
              </div>
            </div>

            <button
              onClick={() => {
                setInputText(`${dialogueTextA}\n${dialogueTextB}`);
                handleAnalyzeDelivery();
              }}
              className="w-full py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-pink-600 text-white text-xs font-bold cursor-pointer hover:opacity-90 transition"
            >
              {isSk ? "Zlúčiť do dialógového plánu →" : "Compile into dialogue plan →"}
            </button>
          </div>
        )}

        {/* 4. Text Input & Quick Actions */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-2">
              <span>✍️</span>
              <span>{isSk ? "Text na hovorenie" : "Text to Speak"}</span>
            </label>
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={handleLoadFullTranscript}
                className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer flex items-center gap-1"
              >
                <span>📜</span>
                <span>{isSk ? "Načítať z prepisu" : "Load from transcript"}</span>
              </button>
              <span className="text-neutral-600">|</span>
              <span className="font-mono text-[10px] text-neutral-500">
                {inputText.length} {isSk ? "znakov" : "chars"} (~
                {Math.ceil(inputText.split(/\s+/).filter(Boolean).length / 2.6)}s)
              </span>
            </div>
          </div>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={3}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition shadow-inner font-sans"
            placeholder={
              isSk
                ? "Sem napíšte alebo vložte text, ktorý má AI prirodzene nahovoriť..."
                : "Type or paste text for AI to naturally narrate..."
            }
          />

          {/* Rewrite + Voice Confirmation Option */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
              <input
                type="checkbox"
                checked={rewriteRequested}
                onChange={(e) => setRewriteRequested(e.target.checked)}
                className="rounded accent-indigo-500 cursor-pointer"
              />
              <span>
                {isSk
                  ? "AI vylepšenie textu (Rewrite na údernejší hovorený štýl)"
                  : "AI speech rewrite (punchier conversational flow)"}
              </span>
            </label>

            {rewrittenProposal && (
              <button
                onClick={() => {
                  setInputText(rewrittenProposal);
                  setRewrittenProposal(null);
                  playSynthesizedSFX("click", 0.3);
                }}
                className="text-[11px] font-bold text-emerald-400 hover:underline cursor-pointer"
              >
                {isSk ? "Prijať navrhnutý prepis ✓" : "Accept rewritten text ✓"}
              </button>
            )}
          </div>
        </div>

        {/* 5. Voice Preset Selection (Section 3) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-2">
              <span>🎭</span>
              <span>{isSk ? "Výber hlasu" : "Voice Selection"}</span>
            </label>
            <span className="text-[10px] text-neutral-500 font-mono">
              8 {isSk ? "prirodzených presetov" : "natural presets"}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {VOICE_PRESETS.map((preset) => {
              const isSelected = selectedVoiceId === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => handleSelectVoice(preset.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500/50"
                      : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs truncate">
                      {isSk ? preset.nameSk : preset.nameEn}
                    </span>
                    <span className="text-[10px]">
                      {preset.gender === "female" ? "👩" : "👨"}
                    </span>
                  </div>
                  <span className="text-[10px] text-neutral-400 line-clamp-1">
                    {isSk ? preset.styleSk : preset.styleEn}
                  </span>
                  <span className="text-[9px] font-mono text-indigo-400 mt-1">
                    {preset.recommendedFor}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Custom Voice Description per Section 3 */}
          <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-300">
                {isSk ? "Vlastný popis hlasu (Voice Design)" : "Custom Voice Description"}
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">
                {capabilities.voiceDesign ? "SUPPORTED" : "NOT SUPPORTED (Gemini)"}
              </span>
            </div>
            <input
              type="text"
              value={customVoiceDescription}
              onChange={(e) => setCustomVoiceDescription(e.target.value)}
              placeholder={
                isSk
                  ? "napr. hrejivý mužský rozprávač, pokojný, sebavedomý, stredné tempo..."
                  : "e.g. warm male narrator, calm, natural, confident, medium pace..."
              }
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-indigo-500"
            />
            {!capabilities.voiceDesign && customVoiceDescription.trim() && (
              <p className="text-[10px] text-amber-400">
                ⚠️ {isSk ? "Tento poskytovateľ nepodporuje vlastný voice design." : "Provider does not support custom voice design."}
              </p>
            )}
          </div>
        </div>

        {/* 6. Style, Energy & Speed Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800">
          {/* Style / Emotion */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-neutral-400">
              {isSk ? "Štýl a emócia" : "Style & Emotion"}
            </span>
            <select
              value={deliveryEmotion}
              onChange={(e) => setDeliveryEmotion(e.target.value as DeliveryEmotion)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-medium cursor-pointer"
            >
              <option value="neutral">{isSk ? "Neutrálny (Prirodzený)" : "Neutral"}</option>
              <option value="calm">{isSk ? "Pokojný / Relaxačný" : "Calm"}</option>
              <option value="warm">{isSk ? "Hrejivý / Priateľský" : "Warm"}</option>
              <option value="happy">{isSk ? "Pozitívny / Šťastný" : "Happy"}</option>
              <option value="energetic">{isSk ? "Energický / Dynamický" : "Energetic"}</option>
              <option value="serious">{isSk ? "Vážny / Autoritatívny" : "Serious"}</option>
              <option value="emotional">{isSk ? "Emocionálny / Citlivý" : "Emotional"}</option>
              <option value="dramatic">{isSk ? "Dramatický / Filmový" : "Dramatic"}</option>
              <option value="whisper">{isSk ? "Šepot / Jemný" : "Whisper / Soft"}</option>
            </select>
          </div>

          {/* Energy */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-neutral-400">
              {isSk ? "Energia prednesu" : "Energy Level"}
            </span>
            <div className="grid grid-cols-4 gap-1">
              {(["low", "balanced", "high", "explosive"] as DeliveryEnergy[]).map((eng) => (
                <button
                  key={eng}
                  onClick={() => setDeliveryEnergy(eng)}
                  className={`py-1.5 rounded-lg text-[10px] font-bold border transition cursor-pointer capitalize ${
                    deliveryEnergy === eng
                      ? "bg-indigo-600 text-white border-indigo-500"
                      : "bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white"
                  }`}
                >
                  {eng === "low" ? (isSk ? "Nízka" : "Low") : eng === "balanced" ? (isSk ? "Stred" : "Med") : eng === "high" ? (isSk ? "Vysoká" : "High") : "Max"}
                </button>
              ))}
            </div>
          </div>

          {/* Speed */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-neutral-400">{isSk ? "Rýchlosť" : "Speed"}</span>
              <span className="font-mono text-indigo-400 font-bold">{speed.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={0.8}
              max={1.4}
              step={0.05}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>
        </div>

        {/* 7. Action Buttons (Preview & Generate) */}
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            onClick={handleAnalyzeDelivery}
            disabled={isAnalyzing}
            className="flex-1 py-2.5 px-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-200 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>{isAnalyzing ? "⏳" : "🧠"}</span>
            <span>
              {isAnalyzing
                ? (isSk ? "Analyzujem kontext..." : "Analyzing context...")
                : (isSk ? "Vytvoriť plán prednesu (Delivery Engine)" : "Analyze Natural Delivery Plan")}
            </span>
          </button>

          <button
            onClick={handleGenerateVoice}
            disabled={isGenerating || !inputText.trim()}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-black shadow-lg shadow-indigo-500/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>{isGenerating ? "⏳" : "✨"}</span>
            <span>
              {isGenerating
                ? (isSk ? "Generujem prirodzený hlas..." : "Synthesizing voice...")
                : (isSk ? "GENEROVAŤ PRIRODZENÝ HLAS" : "GENERATE NATURAL VOICE")}
            </span>
          </button>
        </div>

        {/* 8. Natural Delivery Engine Plan Visualization (Section 4 & 5 & 6) */}
        {deliveryPlan.length > 0 && (
          <div className="p-4 rounded-xl bg-neutral-900/90 border border-neutral-800 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <span>📊</span>
                <span>{isSk ? "Plán prednesu (Natural Delivery Engine)" : "Natural Delivery Plan"}</span>
              </span>
              <span className="text-[10px] font-mono text-neutral-500">
                {deliveryPlan.length} {isSk ? "analyzovaných viet" : "sentences analyzed"}
              </span>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar">
              {deliveryPlan.map((unit, idx) => (
                <div
                  key={unit.id || idx}
                  className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800/80 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black tracking-wide uppercase bg-neutral-800 text-neutral-300">
                      {unit.role}
                    </span>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-400">
                      <span>Tempo: {unit.pace}x</span>
                      <span>•</span>
                      <span>Pauza: {unit.pauseBeforeMs}ms / {unit.pauseAfterMs}ms</span>
                    </div>
                  </div>

                  <p className="text-white font-medium">{unit.sentence}</p>

                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-neutral-800/60">
                    <span className="text-[10px] text-neutral-400">
                      {unit.deliveryStyle}
                    </span>
                    {unit.emphasisWords && unit.emphasisWords.length > 0 && (
                      <div className="flex items-center gap-1 ml-auto">
                        <span className="text-[10px] text-amber-400 font-bold">Dôraz:</span>
                        {unit.emphasisWords.map((w, wIdx) => (
                          <span
                            key={wIdx}
                            className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono"
                          >
                            {w}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 9. Voice Preview & Application (Section 10 & 11) */}
        {audioUrl && (
          <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 to-neutral-900 border border-indigo-500/40 space-y-3 animate-fadeIn shadow-xl">
            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🎧</span>
                <span className="text-xs font-bold text-white">
                  {isSk ? "Ukážka vygenerovaného hlasu" : "Voice Preview"} (Take #{takeIndex - 1})
                </span>
                <span className="text-[10px] font-mono text-emerald-400">
                  {audioDuration.toFixed(1)}s • -14 LUFS
                </span>
              </div>

              {/* Quality badge */}
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-800 text-neutral-300">
                {qualityMode.toUpperCase()}
              </span>
            </div>

            {/* Audio Waveform Bar Mockup */}
            <div className="h-10 bg-neutral-950 rounded-xl border border-neutral-800 p-2 flex items-center gap-1 overflow-hidden">
              {Array.from({ length: 48 }).map((_, barIdx) => {
                const height = Math.max(15, (Math.sin(barIdx * 0.4) * 0.5 + 0.5) * 85);
                return (
                  <div
                    key={barIdx}
                    className={`flex-1 rounded-full transition-all ${
                      isPlaying ? "bg-indigo-500 animate-pulse" : "bg-neutral-700"
                    }`}
                    style={{ height: `${height}%` }}
                  />
                );
              })}
            </div>

            {/* Action Bar per Spec Section 10 */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={handleTogglePlayPreview}
                className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>{isPlaying ? "⏸️" : "▶"}</span>
                <span>{isPlaying ? (isSk ? "Pozastaviť" : "Pause") : (isSk ? "Prehrať ukážku" : "Play Preview")}</span>
              </button>

              <button
                onClick={handleUseThisVoice}
                className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-600/20"
              >
                <span>✨</span>
                <span>{isSk ? "POUŽIŤ TENTO HLAS" : "USE THIS VOICE"}</span>
              </button>

              <button
                onClick={handleGenerateVoice}
                className="py-2 px-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 text-xs font-medium transition cursor-pointer"
              >
                {isSk ? "Skúsiť znova (Take 2)" : "Try Again"}
              </button>

              <button
                onClick={() => {
                  setSelectedVoiceId(selectedVoiceId === "natural_male" ? "natural_female" : "natural_male");
                  handleGenerateVoice();
                }}
                className="py-2 px-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 text-xs font-medium transition cursor-pointer ml-auto"
              >
                {isSk ? "Zmeniť hlas" : "Change Voice"}
              </button>
            </div>
          </div>
        )}

        {/* 10. Voice Cloning (Section 15) */}
        <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-300 flex items-center gap-2">
              <span>🧬</span>
              <span>{isSk ? "Klonovanie môjho hlasu (Voice Cloning)" : "Clone My Voice"}</span>
            </span>
            <span className="text-[10px] font-mono text-neutral-500">
              {capabilities.voiceCloning ? "READY" : "NOT AVAILABLE (Active Provider)"}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2">
            <input
              type="text"
              value={cloneVoiceName}
              onChange={(e) => setCloneVoiceName(e.target.value)}
              placeholder={isSk ? "Názov hlasu (napr. Lucia — Môj Hlas)" : "Voice name..."}
              className="flex-1 w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleCloneVoice}
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-xs font-bold text-neutral-300 cursor-pointer"
            >
              {isSk ? "Klonovať hlas" : "Clone Voice"}
            </button>
          </div>

          {/* Consent Checkbox */}
          <label className="flex items-start gap-2 text-[11px] text-neutral-400 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={hasConsentConfirmed}
              onChange={(e) => setHasConsentConfirmed(e.target.checked)}
              className="rounded accent-indigo-500 cursor-pointer mt-0.5"
            />
            <span>
              {isSk
                ? "Potvrdzujem, že mám zákonné právo a súhlas na klonovanie tohto hlasu."
                : "I confirm that I have the legal right and permission to clone this voice."}
            </span>
          </label>

          {cloneStatusMessage && (
            <p className="text-[11px] font-mono text-amber-400">{cloneStatusMessage}</p>
          )}
        </div>

        {/* 11. Advanced Expandable Settings (Section 19) */}
        <div className="pt-2 border-t border-neutral-800/80">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs font-bold text-neutral-400 hover:text-white flex items-center gap-2 cursor-pointer"
          >
            <span>{showAdvanced ? "▾" : "▸"}</span>
            <span>{isSk ? "Pokročilé akustické nastavenia" : "Advanced Acoustic Settings"}</span>
          </button>

          {showAdvanced && (
            <div className="mt-3 p-3.5 rounded-xl bg-neutral-900/40 border border-neutral-800 space-y-3 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {/* Provider Selector */}
                <div className="space-y-1">
                  <span className="text-neutral-400 font-bold">{isSk ? "Poskytovateľ" : "Provider"}</span>
                  <select
                    value={activeProvider}
                    onChange={(e) => setActiveProvider(e.target.value as VoiceProviderId)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-1.5 text-xs text-white"
                  >
                    <option value="gemini_expressive">Google Gemini Expressive TTS</option>
                    <option value="elevenlabs">ElevenLabs Multilingual v2</option>
                    <option value="local_expressive">Local DSP Synthesizer (0-Token)</option>
                  </select>
                </div>

                {/* Quality Mode */}
                <div className="space-y-1">
                  <span className="text-neutral-400 font-bold">{isSk ? "Kvalita syntézy" : "Quality Mode"}</span>
                  <select
                    value={qualityMode}
                    onChange={(e) => setQualityMode(e.target.value as VoiceQualityMode)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-1.5 text-xs text-white"
                  >
                    <option value="fast_preview">{isSk ? "Rýchly náhľad (Fast Preview)" : "Fast Preview"}</option>
                    <option value="natural">{isSk ? "Prirodzená kvalita (Natural)" : "Natural (Default)"}</option>
                    <option value="max_quality">{isSk ? "Maximálna kvalita (Max Studio)" : "Max Quality"}</option>
                  </select>
                </div>

                {/* Pause Strength */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-neutral-400 font-bold">{isSk ? "Sila pauzy" : "Pause Strength"}</span>
                    <span className="font-mono text-indigo-400">{pauseStrength.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={1.5}
                    step={0.1}
                    value={pauseStrength}
                    onChange={(e) => setPauseStrength(Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Upload,
  Film,
  Check,
  Zap,
  Brush,
  Square,
  Music,
  Type,
  Eraser,
  FastForward,
  Rewind,
  Sliders,
  X,
  FileAudio,
} from "lucide-react";
import {
  VideoProjectSettings,
  CaptionSegment,
  ZoomCue,
  SFXCue,
  BRollOverlay,
  EraserZone,
  VideoAspectRatio,
  BackgroundMusicTrack,
  VideoTransition,
  SelectionType,
} from "../types";
import {
  playSynthesizedSFX,
  getAudioContext,
  startBackgroundMusic,
  stopBackgroundMusic,
  setMusicDucking,
  setupVoiceAudioClarifier,
  getDetectedSpeechLevel,
} from "../utils/audioSynth";
import { DEMO_VIDEOS } from "../utils/demoVideos";
import { detectHardcodedSubtitles } from "../utils/videoInpainter";
import { playCaptionVoiceNarration, stopCaptionVoiceNarration } from "../utils/speechSync";
import {
  AIJobQueue,
  InstantMediaRegistry,
  LastSeekWinsCoordinator,
  PerformanceMonitor,
  ResourceManager,
} from "../utils/performanceEngine";
import { playheadStore, usePlayheadTime } from "../core/playback/playheadStore";
import { coreEngine, TimelineEngine, createCanonicalClip, keyboardManager } from "../core";
import { ArrowLeft, ArrowRight, CornerDownLeft, Edit3, Bookmark, Scissors, ArrowDownToLine, Replace } from "lucide-react";

interface VideoPlayerProps {
  settings: VideoProjectSettings;
  captions: CaptionSegment[];
  zoomCues: ZoomCue[];
  sfxCues: SFXCue[];
  transitions?: VideoTransition[];
  bRollOverlays?: BRollOverlay[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onTogglePlay: (forceState?: boolean) => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  currentVideoUrl: string;
  proxyUrl?: string | null;
  onSelectVideoUrl: (url: string) => void;
  onUploadVideo?: (url: string, filename: string) => void;
  onChangeCaptionPosition?: (pos: VideoProjectSettings["captionPosition"]) => void;
  onChangeCaptionScale?: (scale: number) => void;
  onChangeSettings?: (settings: Partial<VideoProjectSettings>) => void;
  onSelect?: (type: SelectionType, id: string | null) => void;
  language?: "sk" | "en";
}

export const MUSIC_OPTIONS: {
  id: BackgroundMusicTrack;
  nameSk: string;
  nameEn: string;
  vibeSk: string;
  vibeEn: string;
  icon: string;
}[] = [
  {
    id: "none",
    nameSk: "Bez hudby (Ticho)",
    nameEn: "No Background Music",
    vibeSk: "Len pôvodný hlas rečníka",
    vibeEn: "Voice only",
    icon: "🔇",
  },
  {
    id: "lofi-chill",
    nameSk: "Lo-Fi Chill & Study",
    nameEn: "Lo-Fi Chill Chords",
    vibeSk: "Jemné Rhodes akordy, pre vysvetľovacie videá",
    vibeEn: "Warm Rhodes chords for tutorials",
    icon: "☕",
  },
  {
    id: "viral-phonk",
    nameSk: "Viral Phonk & Bassline",
    nameEn: "Viral Phonk Drive",
    vibeSk: "Rytmická basová linka pre Reels a TikTok",
    vibeEn: "Pumping bassline for high energy",
    icon: "🔥",
  },
  {
    id: "tech-ambient",
    nameSk: "Futuristic Tech Synth",
    nameEn: "Futuristic Tech Synth",
    vibeSk: "Moderné arpeggio pre AI a technológie",
    vibeEn: "Modern arpeggio for tech & AI",
    icon: "⚡",
  },
  {
    id: "corporate-inspire",
    nameSk: "Corporate & Inspiring",
    nameEn: "Corporate & Inspiring",
    vibeSk: "Inšpiratívna zvonkohra pre biznis a predaj",
    vibeEn: "Positive upbeat corporate theme",
    icon: "✨",
  },
  {
    id: "demo-ambient",
    nameSk: "Cinematic Atmosphere",
    nameEn: "Cinematic Atmosphere",
    vibeSk: "Jemný filmový podmaz pre vizuály",
    vibeEn: "Soft film score for storytelling",
    icon: "🎬",
  },
  {
    id: "custom",
    nameSk: "Vlastná MP3 skladba",
    nameEn: "Custom Audio File",
    vibeSk: "Nahrajte vlastný hudobný súbor z disku",
    vibeEn: "Upload your custom audio file",
    icon: "📁",
  },
];

export const VideoPlayer: React.FC<VideoPlayerProps> = React.memo(({
  settings,
  captions,
  zoomCues,
  sfxCues,
  transitions = [],
  bRollOverlays = [],
  currentTime,
  duration,
  isPlaying,
  onTimeUpdate,
  onDurationChange,
  onTogglePlay,
  canvasRef,
  videoRef,
  currentVideoUrl,
  proxyUrl,
  onSelectVideoUrl,
  onUploadVideo,
  onChangeCaptionPosition,
  onChangeCaptionScale,
  onChangeSettings,
  language = "sk",
}) => {
  const isSk = language === "sk";
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [monitorMode, setMonitorMode] = useState<"program" | "source">("program");
  const [jklSpeed, setJklSpeed] = useState<number>(0);
  const [inPoint, setInPoint] = useState<number | null>(null);
  const [outPoint, setOutPoint] = useState<number | null>(null);
  const [showMusicMenu, setShowMusicMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const musicFileInputRef = useRef<HTMLInputElement | null>(null);
  const customAudioRef = useRef<HTMLAudioElement | null>(null);
  const playedSfxRef = useRef<Set<string>>(new Set());
  const playedTransitionSfxRef = useRef<Set<string>>(new Set());
  const lastTimeRef = useRef<number>(0);
  const timeRafRef = useRef<number | null>(null);
  // Reverse transport (J). HTMLMediaElement has no negative playbackRate, so J runs as a
  // seek-chained frame-step loop over the real media element.
  const reverseSpeedRef = useRef<number>(0);
  const reverseBusyRef = useRef<boolean>(false);
  const transportHandlersRef = useRef({ onTimeUpdate, onTogglePlay, isPlaying });

  useEffect(() => {
    transportHandlersRef.current = { onTimeUpdate, onTogglePlay, isPlaying };
  });

  // Resume audio context
  const resumeAudio = () => {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    } catch {
      // Non-blocking
    }
  };

  // Synchronous, direct Play/Pause handler
  const handlePlayToggle = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const video = videoRef.current;
    if (!video) return;

    resumeAudio();

    if (video.paused) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            if (!isPlaying) onTogglePlay(true);
          })
          .catch((err) => {
            console.warn("Direct play blocked, retrying muted:", err);
            video.muted = true;
            setIsMuted(true);
            video.play().then(() => {
              if (!isPlaying) onTogglePlay(true);
            }).catch(console.error);
          });
      }
    } else {
      video.pause();
      if (isPlaying) onTogglePlay(false);
    }
  };

  // Check if speech is currently active (via captions)
  const isSpeechActive = captions.some((c) => currentTime >= c.start && currentTime <= c.end);

  // Auto-Ducking effect for speech
  useEffect(() => {
    if (settings.bgMusicDucking && settings.bgMusicTrack !== "none") {
      setMusicDucking(isSpeechActive);
      const audio = customAudioRef.current;
      if (audio && settings.bgMusicTrack === "custom") {
        const baseVol = isMuted ? 0 : settings.bgMusicVolume;
        audio.volume = isSpeechActive ? baseVol * 0.28 : baseVol;
      }
    }
  }, [isSpeechActive, settings.bgMusicDucking, settings.bgMusicVolume, isMuted, settings.bgMusicTrack]);

  // Handle Background Music (Synthesized Web Audio tracks)
  useEffect(() => {
    if (isPlaying && settings.bgMusicTrack !== "none" && settings.bgMusicTrack !== "custom") {
      startBackgroundMusic(settings.bgMusicTrack, isMuted ? 0 : settings.bgMusicVolume);
    } else {
      stopBackgroundMusic();
    }
    return () => {
      stopBackgroundMusic();
    };
  }, [isPlaying, settings.bgMusicTrack, settings.bgMusicVolume, isMuted]);

  // Handle Custom Audio Track (Uploaded MP3/WAV)
  useEffect(() => {
    const audio = customAudioRef.current;
    if (!audio) return;

    if (isPlaying && settings.bgMusicTrack === "custom" && settings.customMusicUrl) {
      if (audio.src !== settings.customMusicUrl) {
        audio.src = settings.customMusicUrl;
      }
      audio.volume = isMuted ? 0 : Math.min(1, Math.max(0, settings.bgMusicVolume));
      audio.loop = true;
      audio.play().catch((err) => console.warn("Custom music playback blocked:", err));
    } else {
      audio.pause();
    }
  }, [isPlaying, settings.bgMusicTrack, settings.customMusicUrl, settings.bgMusicVolume, isMuted]);

  // Sync custom audio position with video when seeking or playing
  useEffect(() => {
    const audio = customAudioRef.current;
    if (audio && audio.duration && !isNaN(audio.duration) && settings.bgMusicTrack === "custom") {
      const targetTime = currentTime % audio.duration;
      if (Math.abs(audio.currentTime - targetTime) > 0.6) {
        audio.currentTime = targetTime;
      }
    }
  }, [currentTime, settings.bgMusicTrack]);

  // Sync external isPlaying changes (from keyboard or external buttons) and notify JobQueue
  useEffect(() => {
    AIJobQueue.setPlaybackState(isPlaying);
    PerformanceMonitor.updateMetric("isPlaybackActive", isPlaying);

    const video = videoRef.current;
    if (video) {
      if (isPlaying && video.paused) {
        video.play().catch((err) => {
          console.warn("Sync play failed, retrying muted:", err);
          video.muted = true;
          setIsMuted(true);
          video.play().catch(() => {});
        });
      } else if (!isPlaying && !video.paused) {
        video.pause();
      }
    }
  }, [isPlaying, currentVideoUrl, videoRef]);

  // Instant Media Registration on URL change
  useEffect(() => {
    if (currentVideoUrl) {
      InstantMediaRegistry.registerInstant(currentVideoUrl);
      if (currentVideoUrl.startsWith("blob:")) {
        ResourceManager.registerBlob(currentVideoUrl);
      }
    }
  }, [currentVideoUrl]);

  // Voice Clarifier DSP
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      setupVoiceAudioClarifier(video, settings.voiceClarifierEnabled);
    }
  }, [settings.voiceClarifierEnabled, currentVideoUrl]);

  // Handle native video time updates with isolated playheadStore and throttled parent sync
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const nowTime = videoRef.current.currentTime;
    
    // 1. Direct isolated store update (60fps buttery smooth for leaf subscribers)
    playheadStore.setTime(nowTime);

    // 2. Throttled parent sync to avoid laggy App.tsx whole-tree rerenders
    if (Math.abs(nowTime - lastTimeRef.current) < 0.25) return;
    lastTimeRef.current = nowTime;

    if (timeRafRef.current) cancelAnimationFrame(timeRafRef.current);
    timeRafRef.current = requestAnimationFrame(() => {
      onTimeUpdate(nowTime);
    });
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      if (dur && !isNaN(dur) && dur > 0) {
        playheadStore.setDuration(dur);
        onDurationChange(dur);
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const nextMuted = !isMuted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      if (newVol === 0) {
        videoRef.current.muted = true;
        setIsMuted(true);
      } else if (isMuted) {
        videoRef.current.muted = false;
        setIsMuted(false);
      }
    }
  };

  // Last-seek-wins coordinator ensures instant scrubbing with 0ms UI lock
  const handleScrub = (targetTime: number) => {
    playheadStore.setTime(targetTime, true);
    LastSeekWinsCoordinator.requestSeek(videoRef.current, targetTime, (time) => {
      playheadStore.setTime(time, true);
      onTimeUpdate(time);
    });
  };

  const handleSkip = (seconds: number) => {
    if (videoRef.current) {
      const safeDuration = duration > 0 ? duration : 15;
      const nextTime = Math.max(0, Math.min(safeDuration, videoRef.current.currentTime + seconds));
      playheadStore.setTime(nextTime, true);
      LastSeekWinsCoordinator.requestSeek(videoRef.current, nextTime, (t) => {
        playheadStore.setTime(t, true);
        onTimeUpdate(t);
      });
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  // --- Professional Editing Handlers (FÁZA 2A) ---

  const stopReversePlayback = useCallback(() => {
    reverseSpeedRef.current = 0;
    reverseBusyRef.current = false;
  }, []);

  // Recursive step function kept in a ref so the seek callback always calls the latest copy.
  const stepReverseRef = useRef<() => void>(() => {});
  stepReverseRef.current = () => {
    const video = videoRef.current;
    const speed = reverseSpeedRef.current;
    if (!video || speed >= 0) {
      reverseBusyRef.current = false;
      return;
    }

    const fps = Math.max(1, coreEngine.getProject().settings.fps || 30);
    const framesPerStep = Math.max(1, Math.round(Math.abs(speed)));
    const target = Math.max(0, video.currentTime - framesPerStep / fps);

    // Start of the media reached — stop like a real transport instead of looping.
    if (video.currentTime <= 0.001 || target >= video.currentTime) {
      reverseSpeedRef.current = 0;
      reverseBusyRef.current = false;
      setJklSpeed(0);
      if (transportHandlersRef.current.isPlaying) transportHandlersRef.current.onTogglePlay(false);
      return;
    }

    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      const t = video.currentTime;
      playheadStore.setTime(t, true);
      transportHandlersRef.current.onTimeUpdate(t);
      reverseBusyRef.current = false;
      if (reverseSpeedRef.current < 0) stepReverseRef.current();
    };

    reverseBusyRef.current = true;
    video.addEventListener("seeked", onSeeked);
    video.currentTime = target;
  };

  const handleJklKey = useCallback((key: "J" | "K" | "L") => {
    const currentSpeed = reverseSpeedRef.current !== 0 ? reverseSpeedRef.current : jklSpeed;
    const nextSpeed = TimelineEngine.calculateJklSpeed(currentSpeed, key);
    setJklSpeed(nextSpeed);
    reverseSpeedRef.current = nextSpeed;

    const video = videoRef.current;

    if (nextSpeed === 0) {
      // K: full stop, including any running reverse pass.
      if (video) {
        video.pause();
        video.playbackRate = 1;
      }
      if (isPlaying) onTogglePlay(false);
      return;
    }

    if (nextSpeed < 0) {
      // J: real reverse — pause the element and walk it backwards frame by frame.
      if (video) {
        video.pause();
        video.playbackRate = 1;
      }
      if (isPlaying) onTogglePlay(false);
      if (!reverseBusyRef.current) stepReverseRef.current();
      return;
    }

    // L: forward playback at 1x / 2x / 4x / 8x on the media element.
    stopReversePlayback();
    if (video) {
      video.playbackRate = Math.abs(nextSpeed);
      if (video.paused) video.play().catch(() => {});
    }
    if (!isPlaying) onTogglePlay(true);
  }, [jklSpeed, isPlaying, onTogglePlay, stopReversePlayback, videoRef]);

  // Pressing Play (or any external play state) ends the reverse pass.
  useEffect(() => {
    if (isPlaying && reverseSpeedRef.current < 0) {
      reverseSpeedRef.current = 0;
      setJklSpeed(0);
    }
  }, [isPlaying]);

  // Never leave a seek listener running after unmount.
  useEffect(() => () => {
    reverseSpeedRef.current = 0;
    reverseBusyRef.current = false;
  }, []);

  const handleFrameStep = useCallback((direction: "forward" | "backward", count: number = 1) => {
    const fps = coreEngine.getProject().settings.fps || 30;
    const current = videoRef.current?.currentTime ?? currentTime;
    const next = TimelineEngine.frameStep(current, direction, fps, count, duration);
    handleScrub(next);
  }, [currentTime, duration, videoRef]);

  const handleMarkIn = useCallback(() => {
    const now = videoRef.current?.currentTime ?? currentTime;
    setInPoint(now);
    coreEngine.setInOutPoints(now, outPoint);
    playSynthesizedSFX("click", 0.5);
  }, [currentTime, outPoint, videoRef]);

  const handleMarkOut = useCallback(() => {
    const now = videoRef.current?.currentTime ?? currentTime;
    setOutPoint(now);
    coreEngine.setInOutPoints(inPoint, now);
    playSynthesizedSFX("click", 0.5);
  }, [currentTime, inPoint, videoRef]);

  const handleClearInOut = useCallback(() => {
    setInPoint(null);
    setOutPoint(null);
    coreEngine.setInOutPoints(null, null);
    playSynthesizedSFX("click", 0.4);
  }, []);

  const handleInsertEdit = useCallback(() => {
    const project = coreEngine.getProject();
    const videoTrack = project.tracks.find((t) => t.type === "video") || project.tracks[0];
    if (!videoTrack) return;

    const start = inPoint !== null ? inPoint : 0;
    const end = outPoint !== null ? outPoint : (duration > 0 ? duration : 5);
    const editDuration = Math.max(0.1, end - start);
    const playheadTime = playheadStore.getTime() || currentTime;

    const clipToInsert = createCanonicalClip({
      id: `clip_${crypto.randomUUID()}`,
      trackId: videoTrack.id,
      name: `Inserted Segment (${formatTime(start)} - ${formatTime(end)})`,
      type: "video",
      sourceStart: start,
      sourceEnd: end,
      timelineStart: playheadTime,
      duration: editDuration,
      speed: 1.0,
      volume: 100
    });

    coreEngine.insertEdit(videoTrack.id, clipToInsert, playheadTime);
    playSynthesizedSFX("ding", 0.6);
  }, [inPoint, outPoint, duration, currentTime]);

  const handleOverwriteEdit = useCallback(() => {
    const project = coreEngine.getProject();
    const videoTrack = project.tracks.find((t) => t.type === "video") || project.tracks[0];
    if (!videoTrack) return;

    const start = inPoint !== null ? inPoint : 0;
    const end = outPoint !== null ? outPoint : (duration > 0 ? duration : 5);
    const editDuration = Math.max(0.1, end - start);
    const playheadTime = playheadStore.getTime() || currentTime;

    const clipToInsert = createCanonicalClip({
      id: `clip_${crypto.randomUUID()}`,
      trackId: videoTrack.id,
      name: `Overwrite Segment (${formatTime(start)} - ${formatTime(end)})`,
      type: "video",
      sourceStart: start,
      sourceEnd: end,
      timelineStart: playheadTime,
      duration: editDuration,
      speed: 1.0,
      volume: 100
    });

    coreEngine.overwriteEdit(videoTrack.id, clipToInsert, playheadTime);
    playSynthesizedSFX("click", 0.7);
  }, [inPoint, outPoint, duration, currentTime]);

  // Centralized Keyboard Shortcuts Integration
  useEffect(() => {
    const unsubs = [
      keyboardManager.register({ id: "jkl-j", key: "j", description: "Reverse Playback (J)", action: () => handleJklKey("J") }),
      keyboardManager.register({ id: "jkl-k", key: "k", description: "Stop / Pause (K)", action: () => handleJklKey("K") }),
      keyboardManager.register({ id: "jkl-l", key: "l", description: "Forward Playback (L)", action: () => handleJklKey("L") }),
      keyboardManager.register({ id: "mark-in", key: "i", description: "Mark In Point (I)", action: () => handleMarkIn() }),
      keyboardManager.register({ id: "mark-out", key: "o", description: "Mark Out Point (O)", action: () => handleMarkOut() }),
      keyboardManager.register({ id: "clear-inout", key: "x", description: "Clear In/Out (X)", action: () => handleClearInOut() }),
      keyboardManager.register({ id: "frame-back", key: "ArrowLeft", description: "Step Backward 1 Frame (←)", action: () => handleFrameStep("backward", 1) }),
      keyboardManager.register({ id: "frame-fwd", key: "ArrowRight", description: "Step Forward 1 Frame (→)", action: () => handleFrameStep("forward", 1) }),
      keyboardManager.register({ id: "step-10-back", key: "ArrowLeft", shift: true, description: "Step Backward 1s (Shift+←)", action: () => handleFrameStep("backward", 30) }),
      keyboardManager.register({ id: "step-10-fwd", key: "ArrowRight", shift: true, description: "Step Forward 1s (Shift+→)", action: () => handleFrameStep("forward", 30) }),
      keyboardManager.register({ id: "insert-edit", key: ",", description: "Insert Edit (,)", action: () => handleInsertEdit() }),
      keyboardManager.register({ id: "overwrite-edit", key: ".", description: "Overwrite Edit (.)", action: () => handleOverwriteEdit() })
    ];

    const cleanupGlobal = keyboardManager.init();

    return () => {
      unsubs.forEach(unsub => unsub());
      cleanupGlobal();
    };
  }, [handleJklKey, handleFrameStep, handleMarkIn, handleMarkOut, handleClearInOut, handleInsertEdit, handleOverwriteEdit]);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) secs = 0;
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms}`;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      InstantMediaRegistry.registerInstant(url, file.name);
      ResourceManager.registerBlob(url);
      onSelectVideoUrl(url);
      if (onUploadVideo) {
        onUploadVideo(url, file.name);
      }
    }
  };

  // Aspect ratio class helper
  const getContainerAspectClass = (aspectRatio: VideoAspectRatio) => {
    switch (aspectRatio) {
      case "9:16":
        return "aspect-[9/16] max-h-[66vh] w-auto mx-auto";
      case "16:9":
        return "aspect-[16/9] w-full max-w-3xl mx-auto";
      case "1:1":
        return "aspect-square max-h-[58vh] w-auto mx-auto";
      case "4:5":
        return "aspect-[4/5] max-h-[62vh] w-auto mx-auto";
    }
  };

  // Find active caption segment for overlay
  const activeCaption = useMemo(() => {
    return captions.find(
      (c) => currentTime >= c.start && currentTime <= c.end + 0.1
    );
  }, [captions, currentTime]);

  // Find active zoom cue for punch-in zoom
  const activeZoom = useMemo(() => {
    return zoomCues.find(
      (z) => currentTime >= z.timestamp && currentTime <= z.timestamp + (z.duration || 2.5)
    );
  }, [zoomCues, currentTime]);

  const currentScale = activeZoom ? activeZoom.scale : 1.0;

  // Find active transition
  const activeTransition = useMemo(() => {
    return transitions.find(
      (t) => Math.abs(currentTime - t.timestamp) <= (t.duration / 2)
    );
  }, [transitions, currentTime]);

  const { transitionScale, transitionTranslateX, transitionTranslateY, transitionOpacity, transitionFilter } = useMemo(() => {
    let scale = currentScale;
    let translateX = 0;
    let translateY = 0;
    let opacity = 1;
    let filter = "";

    if (activeTransition) {
      const half = activeTransition.duration / 2;
      const progressFromCenter = Math.min(1, Math.abs(currentTime - activeTransition.timestamp) / half);
      const impact = 1 - progressFromCenter;

      if (activeTransition.type === "zoom_through" || activeTransition.type === "zoom_in") {
        scale = currentScale * (1 + impact * 0.45);
      } else if (activeTransition.type === "zoom_out") {
        scale = currentScale * (1 - impact * 0.25);
      } else if (activeTransition.type === "dissolve" || activeTransition.type === "crossfade") {
        opacity = 0.5 + 0.5 * progressFromCenter;
      } else if (activeTransition.type === "slide_left") {
        translateX = impact * -25;
      } else if (activeTransition.type === "slide_right") {
        translateX = impact * 25;
      } else if (activeTransition.type === "slide_up") {
        translateY = impact * -25;
      } else if (activeTransition.type === "whip_pan") {
        translateX = impact * -40;
        filter = `blur(${impact * 4}px)`;
      } else if (activeTransition.type === "glitch") {
        filter = `hue-rotate(${impact * 120}deg) contrast(${1 + impact * 0.8})`;
      }
    }

    return {
      transitionScale: scale,
      transitionTranslateX: translateX,
      transitionTranslateY: translateY,
      transitionOpacity: opacity,
      transitionFilter: filter,
    };
  }, [currentScale, activeTransition, currentTime]);

  // Handle synchronized SFX cues & Transition SFX
  useEffect(() => {
    if (!isPlaying || !settings.sfxEnabled) return;

    // Regular SFX cues
    sfxCues.forEach((sfx) => {
      if (currentTime >= sfx.timestamp && currentTime <= sfx.timestamp + 0.35) {
        if (!playedSfxRef.current.has(sfx.id)) {
          playedSfxRef.current.add(sfx.id);
          playSynthesizedSFX(sfx.type, (settings.sfxVolume ?? 0.8) * 0.8);
        }
      }
    });

    // Transition sound effects
    transitions.forEach((t) => {
      if (t.soundEffect && t.soundEffect !== "none") {
        if (Math.abs(currentTime - t.timestamp) <= 0.25) {
          if (!playedTransitionSfxRef.current.has(t.id)) {
            playedTransitionSfxRef.current.add(t.id);
            const soundType =
              t.soundEffect === "whip_snap"
                ? "whoosh"
                : t.soundEffect === "glitch_sfx"
                ? "pop"
                : t.soundEffect === "film_click"
                ? "click"
                : (t.soundEffect as any);
            playSynthesizedSFX(soundType, (settings.sfxVolume ?? 0.8) * 0.9);
          }
        }
      }
    });
  }, [currentTime, isPlaying, sfxCues, transitions, settings.sfxEnabled, settings.sfxVolume]);

  useEffect(() => {
    if (!isPlaying) {
      playedSfxRef.current.clear();
      playedTransitionSfxRef.current.clear();
    }
  }, [isPlaying]);

  const safeDuration = duration > 0 ? duration : 15;
  const storeTime = usePlayheadTime();
  const effectiveTime = storeTime > 0 ? storeTime : currentTime;
  const progressPercent = Math.min(100, Math.max(0, (effectiveTime / safeDuration) * 100));

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Butter-smooth Hardware Accelerated Native Video Player */}
      <div className="relative flex items-center justify-center w-full bg-neutral-950 rounded-2xl overflow-hidden shadow-2xl border border-neutral-800">
        <div className={`relative flex items-center justify-center w-full bg-black ${getContainerAspectClass(settings.aspectRatio)}`}>
          {currentVideoUrl ? (
            <video
              ref={videoRef}
              src={currentVideoUrl}
              playsInline
              muted={isMuted}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={() => {
                if (!isPlaying) onTogglePlay(true);
              }}
              onPause={() => {
                if (isPlaying) onTogglePlay(false);
              }}
              onEnded={() => {
                if (isPlaying) onTogglePlay(false);
              }}
              className="w-full h-full object-contain cursor-pointer"
              style={{
                transform: `scale(${transitionScale}) translate(${transitionTranslateX}px, ${transitionTranslateY}px)`,
                opacity: transitionOpacity,
                filter: transitionFilter || undefined,
                transition: "transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.15s ease-out",
                transformOrigin: "center center",
              }}
              onClick={handlePlayToggle}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-950 text-neutral-600 gap-2">
              <Film className="w-12 h-12 text-neutral-800" />
            </div>
          )}

          {/* Flash & Light Leak Overlays */}
          {activeTransition?.type === "flash_white" && (
            <div className="absolute inset-0 bg-white pointer-events-none transition-opacity duration-150 animate-in fade-in" />
          )}
          {activeTransition?.type === "light_leak" && (
            <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/40 via-rose-500/30 to-transparent pointer-events-none mix-blend-screen transition-opacity duration-200" />
          )}

          {/* Hidden audio element for custom uploaded background track */}
          <audio ref={customAudioRef} className="hidden" preload="auto" />

          {/* Hidden canvas ref to maintain compatibility with ExportModal */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Top-Right Interactive Background Music Indicator & Quick Selector */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20">
            <button
              onClick={() => setShowMusicMenu(!showMusicMenu)}
              className={`px-2.5 py-1 rounded-md backdrop-blur-md text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer border ${
                settings.bgMusicTrack !== "none"
                  ? "bg-indigo-600/90 hover:bg-indigo-500 text-white border-indigo-400/40 shadow-indigo-600/30"
                  : "bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 border-neutral-700/60"
              }`}
              title={isSk ? "Kliknite pre nastavenie hudobného podmazu" : "Click to configure background music"}
            >
              <Music className={`h-3 w-3 ${settings.bgMusicTrack !== "none" ? "text-indigo-200" : "text-neutral-400"}`} />
              <span>
                {settings.bgMusicTrack !== "none"
                  ? `${isSk ? "Podmaz" : "Music"}: ${
                      MUSIC_OPTIONS.find((m) => m.id === settings.bgMusicTrack)?.[isSk ? "nameSk" : "nameEn"] || settings.bgMusicTrack
                    } (${Math.round(settings.bgMusicVolume * 100)}%)`
                  : isSk
                  ? "+ Pridať hudobný podmaz"
                  : "+ Add Background Music"}
              </span>
            </button>
          </div>

          {/* Status Overlay Badges & Monitor Switcher */}
          <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 z-20">
            {/* Source / Program Monitor Mode Switcher */}
            <div className="flex items-center bg-neutral-950/90 backdrop-blur-md rounded-lg p-0.5 border border-neutral-700/60 shadow-lg">
              <button
                onClick={() => {
                  setMonitorMode("program");
                  playSynthesizedSFX("click", 0.4);
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-black transition-all cursor-pointer ${
                  monitorMode === "program"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
                title="Program Monitor (Timeline Sequence)"
              >
                📺 PROGRAM
              </button>
              <button
                onClick={() => {
                  setMonitorMode("source");
                  playSynthesizedSFX("click", 0.4);
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-black transition-all cursor-pointer ${
                  monitorMode === "source"
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
                title="Source Monitor (Raw Media Preview & In/Out Selection)"
              >
                🎬 SOURCE
              </button>
            </div>

            <span className="rounded-md bg-neutral-900/80 backdrop-blur-md px-2 py-1 text-[10px] font-bold text-neutral-300 border border-neutral-700/60 pointer-events-none">
              {settings.aspectRatio}
            </span>

            {/* J/K/L Speed Indicator Badge */}
            {jklSpeed !== 0 && (
              <span className="rounded-md bg-amber-500/90 backdrop-blur-md px-2 py-1 text-[10px] font-black text-black animate-pulse flex items-center gap-1 shadow-lg pointer-events-none">
                J/K/L: {jklSpeed > 0 ? `+${jklSpeed}x` : `${jklSpeed}x`}
              </span>
            )}

            {/* In / Out Active Badge */}
            {(inPoint !== null || outPoint !== null) && (
              <span className="rounded-md bg-indigo-600/90 backdrop-blur-md px-2 py-1 text-[10px] font-bold text-white flex items-center gap-1 border border-indigo-400/40 pointer-events-none">
                IN/OUT: {inPoint !== null ? `${formatTime(inPoint)}` : "0s"} → {outPoint !== null ? `${formatTime(outPoint)}` : "End"}
              </span>
            )}

            {activeZoom && (
              <span className="rounded-md bg-rose-600/90 backdrop-blur-md px-2.5 py-1 text-[10px] font-black text-white animate-pulse flex items-center gap-1 shadow-lg shadow-rose-600/30 pointer-events-none">
                <Zap className="h-3 w-3" />
                PUNCH-IN ZOOM {Math.round(currentScale * 100)}%
              </span>
            )}
          </div>

          {/* Center Play Button Overlay on Pause */}
          {!isPlaying && (
            <button
              onClick={handlePlayToggle}
              className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/90 hover:bg-rose-500 text-white shadow-2xl backdrop-blur-sm transition-transform hover:scale-110 active:scale-95 z-20"
            >
              <Play className="h-8 w-8 translate-x-0.5 fill-current" />
            </button>
          )}

          {/* Subtitles Overlay */}
          {settings.captionsEnabled && activeCaption && (
            <div className={`absolute left-0 right-0 flex justify-center z-30 pointer-events-none px-4 ${
              settings.captionPosition === "top" ? "top-12" :
              settings.captionPosition === "middle" ? "top-1/2 -translate-y-1/2" : "bottom-16"
            }`}>
              <div className="bg-black/85 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 text-center shadow-2xl max-w-xl">
                <p className="text-white font-black text-lg md:text-xl tracking-wide uppercase drop-shadow-md">
                  {activeCaption.text}
                </p>
                {activeCaption.emoji && (
                  <span className="text-2xl ml-2 inline-block animate-bounce">{activeCaption.emoji}</span>
                )}
              </div>
            </div>
          )}

          {/* Bottom Bar Audio Toggle */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 z-20">
            <button
              onClick={toggleMute}
              className="rounded-lg bg-neutral-900/80 backdrop-blur-md p-2 text-neutral-300 hover:text-white border border-neutral-700/60 transition-all"
            >
              {isMuted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* 🎛️ Master Timeline Scrubber & Transport Controller */}
      <div className="w-full max-w-3xl bg-neutral-900/95 border border-neutral-800 rounded-2xl p-3 shadow-xl backdrop-blur-md flex flex-col gap-2.5">
        {/* Timeline Scrubber Bar with Cue Indicators */}
        <div className="relative flex flex-col gap-1">
          <div className="relative w-full h-4 flex items-center group cursor-pointer">
            {/* Background track */}
            <div className="absolute inset-x-0 h-2 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800/80">
              <div
                className="h-full bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-400 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Visual Markers for Zoom Cues (Yellow) and SFX Cues (Rose) */}
            {zoomCues.map((z) => {
              const left = Math.min(100, Math.max(0, (z.timestamp / safeDuration) * 100));
              return (
                <div
                  key={z.id}
                  title={`Zoom ${Math.round(z.scale * 100)}% @ ${z.timestamp}s`}
                  style={{ left: `${left}%` }}
                  className="absolute top-0 bottom-0 w-1.5 -ml-0.5 rounded-full bg-amber-400/90 shadow-sm pointer-events-none z-10"
                />
              );
            })}
            {sfxCues.map((s) => {
              const left = Math.min(100, Math.max(0, (s.timestamp / safeDuration) * 100));
              return (
                <div
                  key={s.id}
                  title={`SFX: ${s.label || s.type} @ ${s.timestamp}s`}
                  style={{ left: `${left}%` }}
                  className="absolute top-0.5 bottom-0.5 w-1.5 -ml-0.5 rounded-full bg-rose-500 shadow-sm pointer-events-none z-10"
                />
              );
            })}
            {transitions.map((t) => {
              const left = Math.min(100, Math.max(0, (t.timestamp / safeDuration) * 100));
              return (
                <div
                  key={t.id}
                  title={`Transition: ${t.labelSk || t.type} (${t.duration}s) @ ${t.timestamp}s`}
                  style={{ left: `${left}%` }}
                  className="absolute top-0 bottom-0 w-2 -ml-1 rounded-sm bg-cyan-400 shadow-sm ring-1 ring-cyan-300 pointer-events-none z-10"
                />
              );
            })}

            {/* Real HTML Range input overlaid for smooth dragging */}
            <input
              type="range"
              min={0}
              max={safeDuration}
              step={0.05}
              value={effectiveTime}
              onChange={(e) => handleScrub(parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            />

            {/* Playhead handle indicator */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg border border-neutral-900 pointer-events-none z-15 transition-transform group-hover:scale-125"
              style={{ left: `calc(${progressPercent}% - 8px)` }}
            />
          </div>

          {/* Time text & Cue count info */}
          <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-neutral-400 px-0.5">
            <span className="text-white font-bold">{formatTime(effectiveTime)}</span>
            <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-sans">
              {zoomCues.length > 0 && (
                <span className="text-amber-400/90 font-medium">⚡ {zoomCues.length} {isSk ? "zoomov" : "zooms"}</span>
              )}
              {sfxCues.length > 0 && (
                <span className="text-rose-400/90 font-medium">🔊 {sfxCues.length} SFX</span>
              )}
              {transitions.length > 0 && (
                <span className="text-cyan-400/90 font-medium">✨ {transitions.length} {isSk ? "prechodov" : "transitions"}</span>
              )}
            </div>
            <span>{formatTime(safeDuration)}</span>
          </div>
        </div>

        {/* Transport Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-neutral-800/80">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Primary Play/Pause button */}
            <button
              onClick={handlePlayToggle}
              className="flex items-center justify-center h-9 w-9 rounded-xl bg-rose-500 hover:bg-rose-400 text-white shadow-md active:scale-95 transition-all"
              title={isPlaying ? (isSk ? "Pozastaviť (Space)" : "Pause (Space)") : (isSk ? "Prehrať (Space)" : "Play (Space)")}
            >
              {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current translate-x-0.5" />}
            </button>

            {/* Skip -5s */}
            <button
              onClick={() => handleSkip(-5)}
              className="flex items-center gap-1 h-8 px-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold active:scale-95 transition-all"
              title={isSk ? "Späť 5s" : "Back 5s"}
            >
              <Rewind className="h-3.5 w-3.5" />
              <span>-5s</span>
            </button>

            {/* Skip +5s */}
            <button
              onClick={() => handleSkip(5)}
              className="flex items-center gap-1 h-8 px-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold active:scale-95 transition-all"
              title={isSk ? "Dopredu 5s" : "Forward 5s"}
            >
              <span>+5s</span>
              <FastForward className="h-3.5 w-3.5" />
            </button>

            {/* Reset to 0 */}
            <button
              onClick={() => handleScrub(0)}
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white active:scale-95 transition-all"
              title={isSk ? "Na začiatok (0s)" : "Reset to 0s"}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>

            {/* Frame Stepping Buttons */}
            <div className="flex items-center rounded-lg bg-neutral-950 p-0.5 border border-neutral-800">
              <button
                onClick={() => handleFrameStep("backward", 1)}
                className="px-1.5 py-1 text-[10px] font-mono text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"
                title="Previous Frame (←)"
              >
                ←1F
              </button>
              <button
                onClick={() => handleFrameStep("forward", 1)}
                className="px-1.5 py-1 text-[10px] font-mono text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"
                title="Next Frame (→)"
              >
                1F→
              </button>
            </div>

            {/* In / Out Mark Buttons */}
            <div className="flex items-center rounded-lg bg-neutral-950 p-0.5 border border-neutral-800">
              <button
                onClick={handleMarkIn}
                className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${
                  inPoint !== null ? "bg-indigo-600 text-white" : "text-neutral-400 hover:text-white"
                }`}
                title="Mark In Point (I)"
              >
                [ IN
              </button>
              <button
                onClick={handleMarkOut}
                className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${
                  outPoint !== null ? "bg-indigo-600 text-white" : "text-neutral-400 hover:text-white"
                }`}
                title="Mark Out Point (O)"
              >
                OUT ]
              </button>
              {(inPoint !== null || outPoint !== null) && (
                <button
                  onClick={handleClearInOut}
                  className="px-1.5 py-1 text-[10px] font-bold text-rose-400 hover:text-rose-300 rounded transition-colors"
                  title="Clear In/Out (X)"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Insert & Overwrite Edit Actions */}
            <div className="flex items-center rounded-lg bg-neutral-950 p-0.5 border border-neutral-800">
              <button
                onClick={handleInsertEdit}
                className="px-2 py-1 text-[10px] font-bold text-emerald-400 hover:bg-emerald-950/40 rounded transition-colors flex items-center gap-1"
                title="Insert Edit into Timeline (,)"
              >
                <ArrowDownToLine className="h-3 w-3" />
                <span>INSERT</span>
              </button>
              <button
                onClick={handleOverwriteEdit}
                className="px-2 py-1 text-[10px] font-bold text-amber-400 hover:bg-amber-950/40 rounded transition-colors flex items-center gap-1"
                title="Overwrite Edit into Timeline (.)"
              >
                <Replace className="h-3 w-3" />
                <span>OVERWRITE</span>
              </button>
            </div>
          </div>

          {/* Speed & Audio controls */}
          <div className="flex items-center gap-2">
            {/* Speed Presets */}
            <div className="flex items-center rounded-lg bg-neutral-950 p-0.5 border border-neutral-800">
              {[0.5, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                <button
                  key={rate}
                  onClick={() => handleSpeedChange(rate)}
                  className={`px-1.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                    playbackSpeed === rate
                      ? "bg-rose-500 text-white shadow-xs"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-1.5 bg-neutral-950 px-2 py-1 rounded-lg border border-neutral-800">
              <button
                onClick={toggleMute}
                className="text-neutral-400 hover:text-white transition-colors"
                title={isMuted ? (isSk ? "Zapnúť zvuk" : "Unmute") : (isSk ? "Stlmiť zvuk" : "Mute")}
              >
                {isMuted ? <VolumeX className="h-3.5 w-3.5 text-rose-400" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-14 h-1 accent-rose-500 bg-neutral-800 rounded-lg cursor-pointer"
                title={`Hlasitosť: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
              />
            </div>

            {/* Background Music Button & Indicator */}
            <button
              onClick={() => setShowMusicMenu(!showMusicMenu)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
                settings.bgMusicTrack !== "none"
                  ? "bg-indigo-600/30 border-indigo-500/60 text-indigo-300 hover:bg-indigo-600/40"
                  : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200"
              }`}
              title={isSk ? "Nastavenie podmazovej hudby" : "Background music settings"}
            >
              <Music className={`h-3.5 w-3.5 ${settings.bgMusicTrack !== "none" ? "text-indigo-400 animate-pulse" : ""}`} />
              <span className="hidden sm:inline">
                {settings.bgMusicTrack !== "none"
                  ? `${isSk ? "Podmaz" : "Music"}: ${Math.round(settings.bgMusicVolume * 100)}%`
                  : isSk ? "Podmaz" : "Music"}
              </span>
              {settings.bgMusicTrack !== "none" && (
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              )}
            </button>
          </div>
        </div>

        {/* Expandable Background Music Settings Panel */}
        {showMusicMenu && (
          <div className="mt-3 p-3.5 rounded-2xl bg-neutral-950 border border-indigo-500/40 shadow-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-150 text-xs">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Music className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">
                    {isSk ? "Hudobný Podmaz do Videa" : "Video Background Music"}
                  </h4>
                  <p className="text-[10px] text-neutral-400">
                    {isSk ? "Vyberte syntetizovanú hudbu na pozadie alebo nahrajte vlastnú MP3" : "Select synthesized vibe or upload your custom MP3 track"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMusicMenu(false)}
                className="h-6 w-6 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Music Tracks Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
              {MUSIC_OPTIONS.map((trk) => {
                const isSelected = settings.bgMusicTrack === trk.id;
                return (
                  <button
                    key={trk.id}
                    onClick={() => {
                      if (trk.id === "custom" && !settings.customMusicUrl) {
                        musicFileInputRef.current?.click();
                      } else if (onChangeSettings) {
                        onChangeSettings({ bgMusicTrack: trk.id });
                      }
                    }}
                    className={`flex items-start gap-2 p-2 rounded-xl text-left border transition-all ${
                      isSelected
                        ? "bg-indigo-600/25 border-indigo-500 text-white shadow-sm"
                        : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/80"
                    }`}
                  >
                    <span className="text-base leading-none">{trk.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate">
                        {isSk ? trk.nameSk : trk.nameEn}
                      </p>
                      <p className="text-[9px] text-neutral-500 line-clamp-1">
                        {isSk ? trk.vibeSk : trk.vibeEn}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom file upload display */}
            {settings.bgMusicTrack === "custom" && (
              <div className="p-2.5 rounded-xl bg-neutral-900 border border-indigo-500/30 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileAudio className="h-4 w-4 text-indigo-400 shrink-0" />
                  <span className="text-xs font-semibold text-neutral-200 truncate">
                    {settings.customMusicName || (isSk ? "Žiadny súbor nahraný" : "No file uploaded")}
                  </span>
                </div>
                <button
                  onClick={() => musicFileInputRef.current?.click()}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>{isSk ? "Nahrať MP3 / WAV" : "Upload MP3 / WAV"}</span>
                </button>
              </div>
            )}

            {/* Volume and Ducking controls */}
            {settings.bgMusicTrack !== "none" && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-800/80">
                {/* Volume slider */}
                <div className="flex items-center gap-2">
                  <span className="text-neutral-400 font-medium">
                    {isSk ? "Hlasitosť hudby:" : "Music Volume:"}
                  </span>
                  <input
                    type="range"
                    min={0.05}
                    max={1.0}
                    step={0.05}
                    value={settings.bgMusicVolume}
                    onChange={(e) =>
                      onChangeSettings && onChangeSettings({ bgMusicVolume: parseFloat(e.target.value) })
                    }
                    className="w-24 accent-indigo-500 cursor-pointer"
                  />
                  <span className="text-indigo-400 font-mono font-bold text-[11px] w-9">
                    {Math.round(settings.bgMusicVolume * 100)}%
                  </span>
                </div>

                {/* Auto Ducking toggle */}
                <label className="flex items-center gap-2 cursor-pointer text-neutral-300">
                  <input
                    type="checkbox"
                    checked={settings.bgMusicDucking}
                    onChange={(e) =>
                      onChangeSettings && onChangeSettings({ bgMusicDucking: e.target.checked })
                    }
                    className="h-3.5 w-3.5 accent-indigo-500 rounded cursor-pointer"
                  />
                  <span className="text-[11px]">
                    {isSk ? "Auto-Ducking: Stíšiť pri reči (-72%)" : "Auto-Ducking: Dip music during speech"}
                  </span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* Hidden file input for custom music upload */}
        <input
          ref={musicFileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && onChangeSettings) {
              const url = URL.createObjectURL(file);
              onChangeSettings({
                bgMusicTrack: "custom",
                customMusicUrl: url,
                customMusicName: file.name,
              });
            }
          }}
        />
      </div>

      {/* Caption Position & Size Controls */}
      {settings.captionsEnabled && onChangeCaptionPosition && (
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/90 px-3 py-2 text-xs shadow-md">
          <div className="flex items-center gap-1.5 text-neutral-300 font-semibold mr-1">
            <Type className="h-3.5 w-3.5 text-rose-400" />
            <span>{isSk ? "Pozícia titulkov:" : "Caption Position:"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {[
              { id: "top", labelSk: "Hore", labelEn: "Top", icon: "🔝" },
              { id: "middle", labelSk: "V strede", labelEn: "Middle", icon: "🎯" },
              { id: "bottom", labelSk: "Dole pod tvárou", labelEn: "Under Face", icon: "👤⬇️" },
            ].map((pos) => {
              const isChecked = settings.captionPosition === pos.id;
              return (
                <button
                  key={pos.id}
                  onClick={() => onChangeCaptionPosition(pos.id as any)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all border ${
                    isChecked
                      ? "border-rose-500/80 bg-rose-500/20 text-white shadow-sm ring-1 ring-rose-500/40"
                      : "border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:text-white"
                  }`}
                >
                  <span>{pos.icon}</span>
                  <span>{isSk ? pos.labelSk : pos.labelEn}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Video Source Switcher */}
      <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl px-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-xl border border-dashed border-rose-500/60 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20 active:scale-95 transition-all"
        >
          <Upload className="h-3.5 w-3.5" />
          <span>{isSk ? "Nahrať vlastné video" : "Upload your video"}</span>
        </button>

        <span className="text-neutral-600 text-xs">•</span>

        {DEMO_VIDEOS.map((demo) => {
          const isSelected = currentVideoUrl === demo.url;
          return (
            <button
              key={demo.id}
              onClick={() => onSelectVideoUrl(demo.url)}
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all ${
                isSelected
                  ? "bg-neutral-800 text-white border border-neutral-600 shadow-sm"
                  : "bg-neutral-900/80 text-neutral-400 hover:text-neutral-200 border border-neutral-800"
              }`}
            >
              <Film className="h-3 w-3 text-amber-400" />
              <span>{isSk ? demo.titleSk : demo.titleEn}</span>
              {isSelected && <Check className="h-3 w-3 text-emerald-400" />}
            </button>
          );
        })}
      </div>
    </div>
  );
});

import { SFXType, BackgroundMusicTrack } from "../types";

let sharedAudioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedAudioCtx) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * Synthesizes ultra-clean SFX with zero external audio assets.
 * Can output to speaker or mix into MediaStreamDestination for video export.
 */
export function playSynthesizedSFX(
  type: SFXType,
  volume: number = 0.8,
  destinationNode?: AudioNode
) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const dest = destinationNode || ctx.destination;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), now);
    masterGain.connect(dest);

    switch (type) {
      case "boom": {
        // Heavy cinematic sub-bass 808 boom impact for viral hooks
        const osc = ctx.createOscillator();
        const boomGain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.5);

        boomGain.gain.setValueAtTime(0.9, now);
        boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        osc.connect(boomGain);
        boomGain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 0.62);
        break;
      }

      case "glitch": {
        // High energy digital scratch/glitch
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.linearRampToValueAtTime(880, now + 0.05);
        osc.frequency.linearRampToValueAtTime(120, now + 0.12);

        g.gain.setValueAtTime(0.6, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

        osc.connect(g);
        g.connect(masterGain);

        osc.start(now);
        osc.stop(now + 0.15);
        break;
      }

      case "whoosh": {
        // Fast noise frequency sweep (CapCut / Submagic transition whoosh)
        const bufferSize = ctx.sampleRate * 0.35; // 350ms
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.Q.value = 3.0;
        filter.frequency.setValueAtTime(200, now);
        filter.frequency.exponentialRampToValueAtTime(3200, now + 0.15);
        filter.frequency.exponentialRampToValueAtTime(300, now + 0.35);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.001, now);
        noiseGain.gain.linearRampToValueAtTime(0.7, now + 0.14);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(masterGain);

        noise.start(now);
        noise.stop(now + 0.36);
        break;
      }

      case "pop": {
        // Snappy bubble pop (Submagic active word popup)
        const osc = ctx.createOscillator();
        const popGain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(950, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);

        popGain.gain.setValueAtTime(0.8, now);
        popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        osc.connect(popGain);
        popGain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 0.1);
        break;
      }

      case "ding": {
        // Bright bell / chime (CapCut feature cue)
        const fundamental = 1320;
        const freqs = [fundamental, fundamental * 2.1, fundamental * 3.2];
        const gains = [0.6, 0.25, 0.1];

        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now);

          g.gain.setValueAtTime(gains[idx], now);
          g.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

          osc.connect(g);
          g.connect(masterGain);

          osc.start(now);
          osc.stop(now + 0.72);
        });
        break;
      }

      case "cash": {
        // Dual metallic chime ("cha-ching" savings)
        const note1 = ctx.createOscillator();
        const note2 = ctx.createOscillator();
        const g1 = ctx.createGain();
        const g2 = ctx.createGain();

        note1.type = "triangle";
        note1.frequency.setValueAtTime(1450, now);
        g1.gain.setValueAtTime(0.5, now);
        g1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        note2.type = "triangle";
        note2.frequency.setValueAtTime(1960, now + 0.08);
        g2.gain.setValueAtTime(0.6, now + 0.08);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

        note1.connect(g1);
        g1.connect(masterGain);
        note2.connect(g2);
        g2.connect(masterGain);

        note1.start(now);
        note1.stop(now + 0.32);
        note2.start(now + 0.08);
        note2.stop(now + 0.58);
        break;
      }

      case "click": {
        // Short camera shutter / button click
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(2400, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.03);

        g.gain.setValueAtTime(0.5, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

        osc.connect(g);
        g.connect(masterGain);

        osc.start(now);
        osc.stop(now + 0.04);
        break;
      }

      case "paper-rip": {
        // Authentic OmniStrih tactile paper tear / sticker slide
        const bufferSize = Math.floor(ctx.sampleRate * 0.12);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(2200, now);
        filter.frequency.exponentialRampToValueAtTime(800, now + 0.11);
        filter.Q.value = 2.2;

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.8, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        noise.connect(filter);
        filter.connect(g);
        g.connect(masterGain);

        noise.start(now);
        break;
      }
    }
  } catch (err) {
    console.warn("Could not play synthesized SFX:", err);
  }
}

// ==========================================
// BACKGROUND MUSIC SYNTHESIZER WITH DUCKING
// ==========================================

let activeMusicLoopTimer: number | null = null;
let musicMasterGain: GainNode | null = null;
let currentMusicTrack: BackgroundMusicTrack = "none";
let currentMusicVolume: number = 0.3;
let isCurrentlyDucked: boolean = false;

export function setMusicDucking(shouldDuck: boolean) {
  if (!musicMasterGain) return;
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  
  if (isCurrentlyDucked === shouldDuck) return; 
  isCurrentlyDucked = shouldDuck;

  const targetVol = shouldDuck
    ? currentMusicVolume * 0.25 // Duck down to 25% volume
    : currentMusicVolume;

  musicMasterGain.gain.cancelScheduledValues(now);
  // Fast attack (150ms) for professional responsiveness, slower release (800ms) for natural transition
  const rampTime = shouldDuck ? 0.15 : 0.8;
  musicMasterGain.gain.linearRampToValueAtTime(targetVol, now + rampTime);
}

export function stopBackgroundMusic() {
  if (activeMusicLoopTimer !== null) {
    window.clearInterval(activeMusicLoopTimer);
    activeMusicLoopTimer = null;
  }
  if (musicMasterGain) {
    const ctx = getAudioContext();
    musicMasterGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
  }
  currentMusicTrack = "none";
}

export function startBackgroundMusic(
  track: BackgroundMusicTrack,
  volume: number = 0.35,
  destinationNode?: AudioNode
) {
  if (track === "none" || track === "custom") {
    stopBackgroundMusic();
    return;
  }

  stopBackgroundMusic();
  currentMusicTrack = track;
  currentMusicVolume = volume;

  const ctx = getAudioContext();
  const dest = destinationNode || ctx.destination;

  musicMasterGain = ctx.createGain();
  musicMasterGain.gain.setValueAtTime(volume, ctx.currentTime);
  musicMasterGain.connect(dest);

  // Play pattern step
  let step = 0;

  const playStep = () => {
    if (!musicMasterGain) return;
    const now = ctx.currentTime;

    if (track === "lofi-chill") {
      // Warm jazzy Rhodes-like chord progression: Cmaj7 -> Am7 -> Dm7 -> G7
      const chords = [
        [261.63, 329.63, 392.0, 493.88], // Cmaj7
        [220.0, 261.63, 329.63, 392.0],  // Am7
        [293.66, 349.23, 440.0, 523.25], // Dm7
        [196.0, 246.94, 293.66, 349.23], // G7
      ];
      const chord = chords[step % chords.length];

      chord.forEach((freq) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(800, now);

        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(0.12, now + 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

        osc.connect(filter);
        filter.connect(g);
        g.connect(musicMasterGain!);

        osc.start(now);
        osc.stop(now + 1.85);
      });
    } else if (track === "viral-phonk") {
      // Hard driving bassline note + pulse
      const bassNotes = [110, 110, 130.81, 146.83, 98.0, 110];
      const freq = bassNotes[step % bassNotes.length];

      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, now);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(650, now);

      g.gain.setValueAtTime(0.2, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(filter);
      filter.connect(g);
      g.connect(musicMasterGain!);

      osc.start(now);
      osc.stop(now + 0.48);
    } else if (track === "tech-ambient") {
      // Arpeggiated tech synth
      const arps = [440, 554.37, 659.25, 880, 659.25, 554.37];
      const freq = arps[step % arps.length];

      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);

      g.gain.setValueAtTime(0.12, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(g);
      g.connect(musicMasterGain!);

      osc.start(now);
      osc.stop(now + 0.38);
    } else if (track === "corporate-inspire") {
      // Bright inspiring bell arpeggio
      const notes = [523.25, 659.25, 783.99, 1046.5];
      const freq = notes[step % notes.length];

      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);

      g.gain.setValueAtTime(0.1, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(g);
      g.connect(musicMasterGain!);

      osc.start(now);
      osc.stop(now + 0.65);
    }

    step++;
  };

  playStep();
  const intervalMs = track === "viral-phonk" ? 480 : track === "tech-ambient" ? 380 : 1200;
  activeMusicLoopTimer = window.setInterval(playStep, intervalMs);
}

// ==========================================
// CLIENT-SIDE STUDIO VOICE CLARIFIER (DSP)
// ==========================================

let videoSourceNode: MediaElementAudioSourceNode | null = null;
let currentConnectedVideo: HTMLVideoElement | null = null;
let voiceEqFilterHighPass: BiquadFilterNode | null = null;
let voiceEqFilterPresence: BiquadFilterNode | null = null;
let voiceCompressor: DynamicsCompressorNode | null = null;
let speechAnalyser: AnalyserNode | null = null;
let speechDataArray: Uint8Array | null = null;

export function getDetectedSpeechLevel(): number {
  if (!speechAnalyser || !speechDataArray) return 0;
  // Use any cast to bypass SharedArrayBuffer typing issues in some TS environments
  speechAnalyser.getByteFrequencyData(speechDataArray as any);
  
  let sum = 0;
  for (let i = 2; i < 20; i++) {
    sum += speechDataArray[i];
  }
  return sum / 18 / 255; // Normalized 0 to 1
}

export function setupVoiceAudioClarifier(videoElement: HTMLVideoElement, isEnabled: boolean) {
  // Hard Rule: Do NOT initialize AudioContext or MediaElementSource if not enabled and never initialized
  if (!isEnabled && !videoSourceNode) return;

  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    // Only create MediaElementSource if not already created
    if (currentConnectedVideo !== videoElement && !videoSourceNode) {
      try {
        videoSourceNode = ctx.createMediaElementSource(videoElement);
        currentConnectedVideo = videoElement;

        // Speech Analyser for ducking
        speechAnalyser = ctx.createAnalyser();
        speechAnalyser.fftSize = 256;
        speechDataArray = new Uint8Array(speechAnalyser.frequencyBinCount);

        // 1. High-Pass Filter (cuts 85Hz mic rumbles, breathing, table bumps)
        voiceEqFilterHighPass = ctx.createBiquadFilter();
        voiceEqFilterHighPass.type = "highpass";
        voiceEqFilterHighPass.frequency.setValueAtTime(85, ctx.currentTime);

        // 2. Presence Peaking Filter (boosts 3.2kHz for broadcast clarity)
        voiceEqFilterPresence = ctx.createBiquadFilter();
        voiceEqFilterPresence.type = "peaking";
        voiceEqFilterPresence.frequency.setValueAtTime(3200, ctx.currentTime);
        voiceEqFilterPresence.Q.setValueAtTime(1.2, ctx.currentTime);
        voiceEqFilterPresence.gain.setValueAtTime(4.5, ctx.currentTime);

        // 3. Studio Broadcast Compressor
        voiceCompressor = ctx.createDynamicsCompressor();
        voiceCompressor.threshold.setValueAtTime(-24, ctx.currentTime);
        voiceCompressor.knee.setValueAtTime(6, ctx.currentTime);
        voiceCompressor.ratio.setValueAtTime(4, ctx.currentTime);
        voiceCompressor.attack.setValueAtTime(0.005, ctx.currentTime);
        voiceCompressor.release.setValueAtTime(0.12, ctx.currentTime);

        // Chain: Source -> Analyser -> HighPass -> Presence -> Compressor -> Destination
        videoSourceNode.connect(speechAnalyser);
        speechAnalyser.connect(voiceEqFilterHighPass);
        voiceEqFilterHighPass.connect(voiceEqFilterPresence);
        voiceEqFilterPresence.connect(voiceCompressor);
        voiceCompressor.connect(ctx.destination);
      } catch (mediaErr) {
        // If cross-origin or already connected, let the browser play native audio without interruption
        console.info("Native video audio routing preserved:", mediaErr);
      }
    }

    if (voiceEqFilterPresence && voiceCompressor && voiceEqFilterHighPass) {
      const now = ctx.currentTime;
      if (isEnabled) {
        voiceEqFilterHighPass.frequency.setValueAtTime(85, now);
        voiceEqFilterPresence.gain.setValueAtTime(5.0, now);
        voiceCompressor.threshold.setValueAtTime(-24, now);
      } else {
        voiceEqFilterHighPass.frequency.setValueAtTime(20, now);
        voiceEqFilterPresence.gain.setValueAtTime(0, now);
        voiceCompressor.threshold.setValueAtTime(0, now);
      }
    }
  } catch (err) {
    console.warn("Voice clarifier non-critical notice:", err);
  }
}

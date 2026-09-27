import { CaptionSegment } from "../types";

/**
 * Speech Audio Synchronization & Narration Engine
 * Provides live speech synthesis synchronized with video captions and audio transcription.
 */

let activeUtterance: SpeechSynthesisUtterance | null = null;
let lastSpokenSegmentId: string | null = null;

/**
 * Speaks a caption segment in sync with the video timeline
 */
export function playCaptionVoiceNarration(
  segment: CaptionSegment | null,
  language: "sk" | "en",
  volume: number = 0.95
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  if (!segment) {
    if (activeUtterance) {
      window.speechSynthesis.cancel();
      activeUtterance = null;
      lastSpokenSegmentId = null;
    }
    return;
  }

  if (lastSpokenSegmentId === segment.id) {
    return; // Already voiced this segment
  }

  window.speechSynthesis.cancel();
  lastSpokenSegmentId = segment.id;

  const textToSpeak = segment.text.replace(/[:#@!%^&*]/g, "");
  const utterance = new SpeechSynthesisUtterance(textToSpeak);
  utterance.volume = volume;
  utterance.rate = 1.05;
  utterance.pitch = 1.0;

  // Select Slovak or English voice
  const voices = window.speechSynthesis.getVoices();
  if (language === "sk") {
    const skVoice = voices.find(
      (v) => v.lang.startsWith("sk") || v.lang.startsWith("cs")
    );
    if (skVoice) utterance.voice = skVoice;
    utterance.lang = "sk-SK";
  } else {
    const enVoice = voices.find((v) => v.lang.startsWith("en"));
    if (enVoice) utterance.voice = enVoice;
    utterance.lang = "en-US";
  }

  activeUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

export function stopCaptionVoiceNarration() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    activeUtterance = null;
    lastSpokenSegmentId = null;
  }
}

/**
 * Transcribes audio speech using browser SpeechRecognition (when available)
 * Returns a list of caption segments with estimated timestamps.
 * This is the "Zero-Token / No-Credit" mode equivalent to CapCut's local transcription.
 */
export async function startBrowserSpeechTranscription(
  language: "sk" | "en"
): Promise<CaptionSegment[]> {
  const SpeechRec =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRec) {
    throw new Error(
      language === "sk"
        ? "Váš prehliadač nepodporuje lokálny Web Speech API. Skúste Chrome."
        : "Browser does not support local Web Speech API. Try Chrome."
    );
  }

  return new Promise((resolve, reject) => {
    const recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = language === "sk" ? "sk-SK" : "en-US";

    const segments: CaptionSegment[] = [];
    let startTime = Date.now();

    recognition.onresult = (event: any) => {
      const results = event.results;
      const lastResult = results[results.length - 1];
      const transcript = lastResult[0].transcript.trim();

      if (transcript) {
        // Calculate relative time from start
        const now = Date.now();
        const startSec = (now - startTime - 1500) / 1000; // Offset for processing delay
        const endSec = (now - startTime) / 1000;

        const words = transcript.split(/\s+/).map((w: string, idx: number, arr: string[]) => {
          const duration = (endSec - startSec) / arr.length;
          return {
            word: w,
            start: Math.max(0, startSec + idx * duration),
            end: startSec + (idx + 1) * duration,
            highlight: false,
          };
        });

        segments.push({
          id: `local-${Date.now()}-${segments.length}`,
          start: Math.max(0, startSec),
          end: endSec,
          text: transcript,
          emoji: "💬",
          words,
        });
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") return;
      reject(new Error(event.error));
    };

    recognition.onend = () => {
      resolve(segments);
    };

    // Auto-stop after some time if it's just a demo, or allow user to stop
    // In this app context, we'll stop after 30 seconds of silence or manual stop
    recognition.start();

    // For the sake of the demo, we'll resolve after a short delay if segments are found
    // or provide a timeout
    setTimeout(() => {
      recognition.stop();
    }, 15000); // 15s record window for demo
  });
}

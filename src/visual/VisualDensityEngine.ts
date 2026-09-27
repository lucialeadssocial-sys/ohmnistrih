export interface DensityFactors {
  speechIntensity: number; // 0.0 to 1.0
  semanticImportance: number; // 0.0 to 1.0
  isSceneChange: boolean;
  emotionalEmphasis: number; // 0.0 to 1.0
  informationDensity: number; // 0.0 to 1.0
  currentVisualLoad: number; // 0.0 to 1.0
  previousVisualTreatment: "clean" | "subtle" | "dense" | "reset";
  captionDensity: number; // words per second
  audioEmphasis: number; // dB peak / RMS normalize
  editPacing: "fast" | "moderate" | "slow";
}

export class VisualDensityEngine {
  /**
   * Calculates visualDensityScore (0.00 - 1.00) based on weighted signals
   */
  static calculateDensityScore(factors: DensityFactors): number {
    const wSpeech = factors.speechIntensity * 0.15;
    const wSemantic = factors.semanticImportance * 0.25;
    const wScene = factors.isSceneChange ? 0.15 : 0.0;
    const wEmotion = factors.emotionalEmphasis * 0.15;
    const wInfo = factors.informationDensity * 0.15;
    const wAudio = factors.audioEmphasis * 0.15;

    let rawScore = wSpeech + wSemantic + wScene + wEmotion + wInfo + wAudio;

    // Adjust based on current load and previous treatment
    if (factors.previousVisualTreatment === "dense") {
      // Dampen to avoid visual fatigue
      rawScore *= 0.7;
    } else if (factors.previousVisualTreatment === "reset") {
      // Allow rapid build up if semantic importance is high
      rawScore = Math.min(1.0, rawScore * 1.15);
    }

    if (factors.editPacing === "fast") {
      rawScore *= 1.1;
    } else if (factors.editPacing === "slow") {
      rawScore *= 0.85;
    }

    return Math.max(0.0, Math.min(1.0, Number(rawScore.toFixed(2))));
  }

  static getDensityTier(score: number): {
    tier: "CLEAN_FRAME" | "SUBTLE_SUPPORT" | "SUPPORTING_VISUAL" | "STRONG_EDITORIAL" | "PEAK_VISUAL";
    recommendationSk: string;
    description: string;
  } {
    if (score < 0.25) {
      return {
        tier: "CLEAN_FRAME",
        recommendationSk: "Čistý rámec bez rušivých prvkov",
        description: "Keep frame clean for viewer focus on speaker/audio",
      };
    }
    if (score < 0.50) {
      return {
        tier: "SUBTLE_SUPPORT",
        recommendationSk: "Jemná podpora (punch-in alebo minimalistický text)",
        description: "Subtle support (punch-in or minor text highlight)",
      };
    }
    if (score < 0.75) {
      return {
        tier: "SUPPORTING_VISUAL",
        recommendationSk: "Podporný B-roll / karta / ilustrácia",
        description: "Supporting visual element or graphic card",
      };
    }
    if (score < 0.90) {
      return {
        tier: "STRONG_EDITORIAL",
        recommendationSk: "Silná editoriálna kompozícia (koláž, noviny, polaroid)",
        description: "Strong editorial composition (collage/newspaper/polaroid)",
      };
    }
    return {
      tier: "PEAK_VISUAL",
      recommendationSk: "Vrcholný vizuálny moment (plná animovaná koláž + kinetický text)",
      description: "Peak visual moment (full animated collage + kinetic typography)",
    };
  }

  /**
   * Checks whether a sequence of scores warrants a VISUAL_RESET
   */
  static shouldTriggerVisualReset(recentScores: number[]): boolean {
    if (recentScores.length < 2) return false;
    const lastTwo = recentScores.slice(-2);
    return lastTwo.every(s => s >= 0.75);
  }
}

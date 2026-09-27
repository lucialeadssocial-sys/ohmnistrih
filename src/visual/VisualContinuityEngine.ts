import { EditorialDecision } from "./VisualDecisionTypes";
import { VisualStyleDNA } from "./VisualStyleDNA";

export interface SceneVisualState {
  sceneId: string;
  dominantColor: string;
  visualDensityScore: number;
  compositionType: string;
  typographyStyle: string;
  motionDirection: "left" | "right" | "up" | "down" | "zoom_in" | "none";
}

export class VisualContinuityEngine {
  /**
   * Validates and adjusts scene decisions to prevent visual jarring or rapid theme switches
   */
  static harmonizeContinuity(
    prevScene: SceneVisualState | null,
    currentScene: SceneVisualState,
    decisions: EditorialDecision[],
    style: VisualStyleDNA
  ): EditorialDecision[] {
    if (!prevScene) return decisions;

    return decisions.map(dec => {
      // Rule 1: Don't repeat identical punch-in or whip transition back-to-back if density is high
      if (dec.type === "TRANSITION" && prevScene.motionDirection === dec.animation?.direction) {
        return {
          ...dec,
          animation: {
            ...dec.animation!,
            direction: dec.animation?.direction === "left" ? "right" : "up",
          },
          reason: `${dec.reason} (Harmonized direction for visual continuity)`,
        };
      }

      // Rule 2: Ensure accent color matches VisualStyleDNA across scene transitions
      if (dec.style && !dec.style.accentColor) {
        dec.style.accentColor = style.accentColor;
      }

      return dec;
    });
  }
}

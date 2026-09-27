import { VisualStyleDNA } from "./VisualStyleDNA";
import { EditorialDecision } from "./VisualDecisionTypes";

export interface KineticTypographyRequest {
  id: string;
  text: string;
  words: { word: string; start: number; end: number; isKeyword?: boolean }[];
  timelineStart: number;
  timelineEnd: number;
  importance: number; // 0.0 to 1.0
}

export class KineticTypographyEngine {
  static createKineticDecision(
    req: KineticTypographyRequest,
    style: VisualStyleDNA
  ): EditorialDecision {
    const duration = req.timelineEnd - req.timelineStart;
    
    // Choose animation type based on importance and style
    let animType: "scale_in" | "pop" | "slide_in" | "stagger" = "pop";
    let direction: "in" | "out" | "left" | "right" | "up" | "down" = "up";
    let easing = "ease-out";

    if (req.importance >= 0.8) {
      animType = style.typographyStyle === "kinetic_display" ? "pop" : "scale_in";
      easing = "bounce";
    } else if (style.pacingVisual === "fast_dynamic") {
      animType = "stagger";
      direction = "right";
    } else {
      animType = "slide_in";
      direction = "up";
    }

    const priority = req.importance >= 0.8 ? 1 : 2;
    const confidence = Number((0.85 + req.importance * 0.12).toFixed(2));

    return {
      id: `kinetic-${req.id}`,
      timelineStart: req.timelineStart,
      timelineEnd: req.timelineEnd,
      type: "KINETIC_TEXT",
      priority,
      confidence,
      reason: `Kinetic typography applied for emphasized phrase '${req.text}' using ${animType} animation.`,
      reasonSk: `Kinetická typografia pre zvýraznené slová '${req.text}' s animáciou ${animType}.`,
      source: "EDITORIAL_ENGINE",
      status: "applied",
      locked: false,
      animation: {
        name: animType,
        duration: Math.min(0.4, duration * 0.3),
        easing,
        direction,
        priority,
      },
      style: {
        fontStyle: style.typographyStyle,
        fontWeight: style.typographyWeight,
        accentColor: style.accentColor,
        scale: style.typographyScale,
        words: req.words,
      },
    };
  }
}

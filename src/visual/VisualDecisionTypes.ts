export type EditorialDecisionType =
  | "VISUAL_KEEP"
  | "VISUAL_REFRAME"
  | "PUNCH_IN"
  | "PUNCH_OUT"
  | "BROLL"
  | "PHOTO"
  | "SCREENSHOT"
  | "MAP"
  | "DIAGRAM"
  | "ICON"
  | "QUOTE_CARD"
  | "TEXT_CARD"
  | "NEWSPAPER"
  | "PAPER_CUTOUT"
  | "POLAROID"
  | "CHARACTER_CUTOUT"
  | "HALFTONE"
  | "BACKGROUND_TEXTURE"
  | "KINETIC_TEXT"
  | "CAPTION_EMPHASIS"
  | "TRANSITION"
  | "MICRO_MOTION"
  | "COLOR_ACCENT"
  | "VISUAL_PAUSE"
  | "VISUAL_RESET";

export type DecisionStatus = "pending" | "applied" | "approved" | "rejected" | "overridden" | "NEEDS_ASSET" | "NEEDS_DATA";

export interface CompositionElement {
  id: string;
  type: "photo" | "screenshot" | "paper_card" | "newspaper_fragment" | "polaroid" | "icon" | "diagram" | "map" | "cutout_subject" | "text" | "shape" | "texture";
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width: number; // percentage 0-100
  height: number; // percentage 0-100
  rotation: number; // degrees -180 to 180
  scale: number; // e.g. 1.0
  opacity: number; // 0.0 to 1.0
  zIndex: number;
  shadow?: { color: string; blur: number; offsetX: number; offsetY: number };
  border?: { color: string; width: number; style: "solid" | "dashed" | "deckle" };
  mask?: "circle" | "star" | "paper_tear" | "ellipse" | "none";
  blendMode?: string;
  animation?: {
    type: "scale_in" | "slide_in" | "pop" | "fade" | "stagger";
    duration: number; // seconds
    easing: "ease-out" | "bounce" | "linear" | "cubic-bezier";
  };
  contentUrl?: string;
  textVal?: string;
}

export interface AnimationSpec {
  name: string;
  duration: number; // seconds
  easing: string;
  direction?: "in" | "out" | "left" | "right" | "up" | "down";
  priority: number; // 1 (highest) to 5
}

export interface EditorialDecision {
  id: string;
  timelineStart: number;
  timelineEnd: number;
  type: EditorialDecisionType;
  priority: number; // 1 = mandatory, 5 = optional polish
  confidence: number; // 0.00 to 1.00
  reason: string;
  reasonSk: string;
  source: "DEFAULT" | "USER" | "LEARNED" | "EDITORIAL_ENGINE" | "AI_SUGGESTION";
  status: DecisionStatus;
  locked: boolean;
  visualAssetId?: string;
  composition?: CompositionElement[];
  animation?: AnimationSpec;
  style?: Record<string, any>;
  dependencies?: string[]; // IDs of required preceding or sibling decisions
  evidence?: string;
  overriddenBy?: string;
}

export interface SceneEditorialPlan {
  sceneId: string;
  timelineStart: number;
  timelineEnd: number;
  contentSummary: string;
  talkingHeadPercentage: number;
  supportingVisualPercentage: number;
  decisions: EditorialDecision[];
  status: "READY" | "NEEDS_ASSET" | "NEEDS_DATA";
  visualDensityScore: number;
}

import { VisualStyleDNA } from "./VisualStyleDNA";

export type TalkingHeadDecisionType =
  | "KEEP_TALKING_HEAD"
  | "PUNCH_IN"
  | "PARTIAL_COVER"
  | "FULL_SUPPORTING_VISUAL"
  | "RETURN_TO_TALKING_HEAD";

export interface TalkingHeadContext {
  semanticImportance: number; // 0.0 to 1.0
  hasAvailableVisualAsset: boolean;
  visualDensityScore: number;
  previousDecision: TalkingHeadDecisionType;
  consecutiveTalkingHeadDuration: number; // seconds
  speakerIsActive: boolean;
  editDnaTalkingHeadRatio?: number; // e.g. 0.55
}

export class TalkingHeadDirector {
  static decideTreatment(
    context: TalkingHeadContext,
    style: VisualStyleDNA
  ): {
    type: TalkingHeadDecisionType;
    reason: string;
    reasonSk: string;
    confidence: number;
  } {
    const targetTalkingHeadRatio = context.editDnaTalkingHeadRatio ?? style.talkingHeadRatio ?? 0.6;

    // Rule 1: If speaker is inactive or absent -> FULL_SUPPORTING_VISUAL or RETURN_TO_TALKING_HEAD
    if (!context.speakerIsActive) {
      if (context.hasAvailableVisualAsset) {
        return {
          type: "FULL_SUPPORTING_VISUAL",
          reason: "Speaker quiet/absent; covering with supporting visual asset.",
          reasonSk: "Rečník nehovorí; nahradené podporným vizuálnym assetom.",
          confidence: 0.95,
        };
      }
      return {
        type: "KEEP_TALKING_HEAD",
        reason: "Speaker quiet/absent but no visual asset available.",
        reasonSk: "Rečník nehovorí, ale žiadny podporný asset nie je k dispozícii.",
        confidence: 0.82,
      };
    }

    // Rule 2: If we were previously in FULL_SUPPORTING_VISUAL and duration exceeds broll limit -> RETURN_TO_TALKING_HEAD
    if (context.previousDecision === "FULL_SUPPORTING_VISUAL" && context.consecutiveTalkingHeadDuration < 1.0) {
      return {
        type: "RETURN_TO_TALKING_HEAD",
        reason: "Returning focus to speaker after supporting visual.",
        reasonSk: "Návrat pozornosti na rečníka po podpornom vizuále.",
        confidence: 0.92,
      };
    }

    // Rule 3: High semantic importance + low visual density -> PUNCH_IN to emphasize speaker
    if (context.semanticImportance >= 0.75 && context.visualDensityScore < 0.6) {
      return {
        type: "PUNCH_IN",
        reason: "High semantic importance statement; framing punch-in for speaker emphasis.",
        reasonSk: "Kľúčové vyhlásenie s vysokým významom; punch-in pre zvýraznenie rečníka.",
        confidence: 0.94,
      };
    }

    // Rule 4: High visual density score + available asset -> PARTIAL_COVER or FULL_SUPPORTING_VISUAL
    if (context.visualDensityScore >= 0.65 && context.hasAvailableVisualAsset) {
      if (targetTalkingHeadRatio < 0.5) {
        return {
          type: "FULL_SUPPORTING_VISUAL",
          reason: "High visual density phase; full supporting visual layer applied per style profile.",
          reasonSk: "Fáza vysokej vizuálnej hustoty; aplikovaný plný podporný vizuál.",
          confidence: 0.91,
        };
      }
      return {
        type: "PARTIAL_COVER",
        reason: "High visual density phase; partial collage cover over talking head.",
        reasonSk: "Fáza vysokej vizuálnej hustoty; čiastočné prekrytie kolážou nad rečníkom.",
        confidence: 0.89,
      };
    }

    // Rule 5: Long continuous talking head -> PUNCH_IN if duration > 4s
    if (context.consecutiveTalkingHeadDuration > 4.0 && style.punchInFrequency > 0.3) {
      return {
        type: "PUNCH_IN",
        reason: "Preventing visual fatigue during extended talking head clip.",
        reasonSk: "Zabránenie vizuálnej únave počas dlhšieho záberu rečníka.",
        confidence: 0.88,
      };
    }

    // Default
    return {
      type: "KEEP_TALKING_HEAD",
      reason: "Standard speaker framing maintained.",
      reasonSk: "Štandardný záber na rečníka zachovaný.",
      confidence: 0.96,
    };
  }
}

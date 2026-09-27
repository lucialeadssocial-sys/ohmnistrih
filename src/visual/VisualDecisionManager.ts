import { EditorialDecision, DecisionStatus } from "./VisualDecisionTypes";
import { EditDecisionRecord, EditDecisionList } from "../types";
import { EDLManager } from "../utils/edlManager";
import { VisualStyleDNA } from "./VisualStyleDNA";

export interface CacheKeyParams {
  projectId: string;
  mediaVersion: number;
  edlVersion: number;
  dnaVersion: number;
  styleVersion: number;
  promptVersion: string;
  modelVersion: string;
}

export class VisualDecisionManager {
  private static CACHE_PREFIX = "omnistrih_visual_cache_";

  static generateCacheKey(p: CacheKeyParams): string {
    return `${this.CACHE_PREFIX}${p.projectId}_m${p.mediaVersion}_e${p.edlVersion}_dna${p.dnaVersion}_s${p.styleVersion}_p${p.promptVersion}_m${p.modelVersion}`;
  }

  static getCachedDecisions(params: CacheKeyParams): EditorialDecision[] | null {
    try {
      const key = this.generateCacheKey(params);
      const cached = localStorage.getItem(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.error("[VisualDecisionManager] Cache load error", e);
    }
    return null;
  }

  static saveCachedDecisions(params: CacheKeyParams, decisions: EditorialDecision[]): void {
    try {
      const key = this.generateCacheKey(params);
      localStorage.setItem(key, JSON.stringify(decisions));
    } catch (e) {
      console.error("[VisualDecisionManager] Cache save error", e);
    }
  }

  /**
   * Applies confidence thresholds:
   * 0.90-1.00 -> SAFE (Auto apply)
   * 0.75-0.89 -> REVIEW (Requires review)
   * <0.75 -> DO NOT AUTO APPLY
   */
  static categorizeConfidence(confidence: number): {
    category: "SAFE" | "REVIEW" | "CRITICAL";
    autoApply: boolean;
  } {
    if (confidence >= 0.90) {
      return { category: "SAFE", autoApply: true };
    }
    if (confidence >= 0.75) {
      return { category: "REVIEW", autoApply: false };
    }
    return { category: "CRITICAL", autoApply: false };
  }

  /**
   * Maps EditorialDecision items directly to EDL EditDecisionRecord items
   * and saves to EDLManager without breaking existing EDL structure.
   */
  static syncVisualDecisionsToEDL(projectId: string, visualDecisions: EditorialDecision[]): EditDecisionList {
    const currentEDL = EDLManager.getEDL(projectId);

    // Filter out existing visual decisions that are NOT locked or overridden
    const nonVisualDecisions = currentEDL.decisions.filter(d => d.isLocked || !d.id.startsWith("vis-"));

    const convertedNewDecisions: EditDecisionRecord[] = visualDecisions.map(vDec => {
      const confCategory = this.categorizeConfidence(vDec.confidence);

      return {
        id: `vis-${vDec.id}`,
        type: vDec.type as any,
        action: vDec.type === "PUNCH_IN" ? "ZOOM" : vDec.type === "BROLL" ? "BROLL" : vDec.type === "KINETIC_TEXT" ? "CAPTION" : "KEEP",
        sourceStart: vDec.timelineStart,
        sourceEnd: vDec.timelineEnd,
        timelineStart: vDec.timelineStart,
        timelineEnd: vDec.timelineEnd,
        start: vDec.timelineStart,
        end: vDec.timelineEnd,
        duration: vDec.timelineEnd - vDec.timelineStart,
        reason: vDec.reason,
        reasonSk: vDec.reasonSk,
        confidence: vDec.confidence,
        createdBy: "AI",
        status: vDec.locked ? "APPLIED" : confCategory.autoApply ? "accepted" : "PENDING_REVIEW",
        category: confCategory.category,
        risk: confCategory.category === "SAFE" ? "SAFE" : confCategory.category === "REVIEW" ? "NEEDS_REVIEW" : "CRITICAL",
        isLocked: vDec.locked,
        details: {
          zoomScale: vDec.type === "PUNCH_IN" ? 1.2 : 1.0,
          brollKeywords: vDec.visualAssetId ? [vDec.visualAssetId] : [],
        },
      };
    });

    const updatedEDL: EditDecisionList = {
      ...currentEDL,
      decisions: [...nonVisualDecisions, ...convertedNewDecisions],
    };

    EDLManager.saveEDL(updatedEDL);
    return updatedEDL;
  }

  /**
   * Explainability provider for UI "Why?" inspector
   */
  static getExplanation(decision: EditorialDecision): string {
    return `[ODÔVODNENIE AI]: ${decision.reasonSk} (Istota: Math.round(${decision.confidence * 100})%, Zdroj: ${decision.source})`;
  }
}

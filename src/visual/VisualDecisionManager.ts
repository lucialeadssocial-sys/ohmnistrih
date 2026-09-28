import { EditorialDecision, DecisionStatus } from "./VisualDecisionTypes";
import { DirectorDecisionItem, DirectorProposedAction, DecisionPriority, KnowledgeCategory } from "../core/ai/analysisTypes";
import { ProjectModel } from "../core/types/project";
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
   * Maps visual/editorial decisions onto canonical Director decisions.
   *
   * Why: the storyboard used to be "applied" only into a private EDL copy in localStorage that
   * nothing read. Turning the visual decisions into Director decisions lets the Command System apply
   * the ones it can really execute (punch-in, trim, multicam angle, transition) and report the rest
   * as manual steps — the visual layer never claims an edit it did not make.
   */
  static toDirectorDecisionItems(
    project: ProjectModel,
    visualDecisions: EditorialDecision[],
    idPrefix = 'vis'
  ): DirectorDecisionItem[] {
    const clips = project.tracks
      .filter(t => t.type === 'video')
      .flatMap(t => t.clips)
      .map(clip => {
        const start = clip.timelineStart ?? clip.start ?? 0;
        return { id: clip.id, start, end: start + clip.duration };
      })
      .sort((a, b) => a.start - b.start);

    const clipAt = (time: number) => clips.find(c => time >= c.start && time < c.end)?.id;

    const actionFor = (decision: EditorialDecision): DirectorProposedAction => {
      switch (decision.type) {
        case 'PUNCH_IN':
        case 'MICRO_MOTION':
        case 'VISUAL_REFRAME':
          return { kind: 'PUNCH_IN', parameters: { scale: 115 } };
        case 'PUNCH_OUT':
          // There is no punch-out command in the canonical engine — saying so is the honest option.
          return { kind: 'MANUAL_ONLY', parameters: { reason: 'Zmenšenie záberu (punch-out) nie je v engine automatizované — nastav ho v Inspectori.' } };
        case 'BROLL':
        case 'PHOTO':
        case 'SCREENSHOT':
        case 'MAP':
        case 'DIAGRAM':
        case 'ICON':
        case 'QUOTE_CARD':
        case 'NEWSPAPER':
        case 'PAPER_CUTOUT':
        case 'POLAROID':
        case 'CHARACTER_CUTOUT':
        case 'HALFTONE':
        case 'BACKGROUND_TEXTURE':
          return { kind: 'BROLL_INSERT', parameters: { assetId: decision.visualAssetId } };
        case 'KINETIC_TEXT':
        case 'CAPTION_EMPHASIS':
        case 'TEXT_CARD':
          return { kind: 'CAPTION_EMPHASIS' };
        case 'TRANSITION': {
          const spec = (decision.style?.transition ?? decision.style?.spec) as { type?: string; duration?: number } | undefined;
          if (!spec) {
            return { kind: 'MANUAL_ONLY', parameters: { reason: 'Prechod nemá definovanú podobu — vyber ho ručne, aby vznikol len tam, kde má dôvod.' } };
          }
          return { kind: 'TRANSITION', parameters: { edge: 'in', transition: spec } };
        }
        case 'COLOR_ACCENT':
          return { kind: 'COLOR_BALANCE' };
        default:
          return { kind: 'MANUAL_ONLY', parameters: { reason: `Vizuálne rozhodnutie typu ${decision.type} sa vykonáva ručne.` } };
      }
    };

    const priorityFor = (confidence: number): DecisionPriority =>
      confidence >= 0.9 ? 'MUST_CONSIDER' : confidence >= 0.75 ? 'RECOMMENDED' : 'OPTIONAL';

    const categoryFor = (decision: EditorialDecision): KnowledgeCategory => {
      if (decision.confidence < 0.6) return 'uncertainty';
      switch (decision.type) {
        case 'PUNCH_IN':
        case 'MICRO_MOTION':
        case 'VISUAL_REFRAME':
          return 'creative_choice';
        case 'TRANSITION':
        case 'KINETIC_TEXT':
        case 'CAPTION_EMPHASIS':
        case 'TEXT_CARD':
          return 'trend_platform_pattern';
        default:
          return 'professional_convention';
      }
    };

    return visualDecisions.map((decision, index) => {
      const action = actionFor(decision);
      const kind = action.kind;
      return {
        id: `${idPrefix}_${decision.id}_${index + 1}`,
        editDecisionId: decision.id,
        priority: priorityFor(decision.confidence),
        what: `${decision.type}: ${decision.reasonSk}`,
        why: VisualDecisionManager.getExplanation(decision),
        whenToUse: 'Keď to zodpovedá obsahu scény a zámeru strihu.',
        whenNotToUse: 'Keď vizuál nesúvisí s myšlienkou alebo prebíja reč.',
        howToManual: kind === 'MANUAL_ONLY' ? [action.parameters?.reason ?? 'Ručný krok.'] : [],
        alternatives: [],
        confidence: decision.confidence,
        source: decision.source,
        category: categoryFor(decision),
        proposedAction: action,
        affectedClipId: clipAt(decision.timelineStart),
        timelineLocation: { start: decision.timelineStart, end: decision.timelineEnd },
        status: 'proposed',
      } as DirectorDecisionItem;
    });
  }

  /**
   * Explainability provider for UI "Why?" inspector
   */
  static getExplanation(decision: EditorialDecision): string {
    return `[ODÔVODNENIE AI]: ${decision.reasonSk} (Istota: ${Math.round(decision.confidence * 100)} %, Zdroj: ${decision.source})`;
  }
}

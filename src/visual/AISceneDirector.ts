import { SceneEditorialPlan, EditorialDecision } from "./VisualDecisionTypes";
import { VisualStyleDNA } from "./VisualStyleDNA";
import { VisualDensityEngine } from "./VisualDensityEngine";
import { TalkingHeadDirector } from "./TalkingHeadDirector";
import { KineticTypographyEngine } from "./KineticTypographyEngine";
import { EditorialCollageEngine } from "./EditorialCollageEngine";
import { MicroMotionEngine } from "./MicroMotionEngine";

export interface SceneInputData {
  sceneId: string;
  timelineStart: number;
  timelineEnd: number;
  transcriptText: string;
  speakerIsActive: boolean;
  semanticImportance: number; // 0.0 to 1.0
  keywords: string[];
  availableBrollAssets: { id: string; name: string; url: string; category: string }[];
  previousSceneDecision?: string;
}

export class AISceneDirector {
  static createSceneEditorialPlan(
    scene: SceneInputData,
    style: VisualStyleDNA
  ): SceneEditorialPlan {
    const duration = scene.timelineEnd - scene.timelineStart;
    const decisions: EditorialDecision[] = [];

    // 1. Calculate Visual Density Score
    const densityScore = VisualDensityEngine.calculateDensityScore({
      speechIntensity: scene.speakerIsActive ? 0.8 : 0.2,
      semanticImportance: scene.semanticImportance,
      isSceneChange: true,
      emotionalEmphasis: scene.semanticImportance >= 0.75 ? 0.8 : 0.3,
      informationDensity: Math.min(1.0, scene.keywords.length * 0.25),
      currentVisualLoad: 0.3,
      previousVisualTreatment: "clean",
      captionDensity: 2.5,
      audioEmphasis: 0.7,
      editPacing: style.pacingVisual === "fast_dynamic" ? "fast" : "moderate",
    });

    // 2. Talking Head vs Supporting Visual Decision
    const hasMatchingAsset = scene.availableBrollAssets.length > 0;
    const thDecision = TalkingHeadDirector.decideTreatment(
      {
        semanticImportance: scene.semanticImportance,
        hasAvailableVisualAsset: hasMatchingAsset,
        visualDensityScore: densityScore,
        previousDecision: "KEEP_TALKING_HEAD",
        consecutiveTalkingHeadDuration: duration,
        speakerIsActive: scene.speakerIsActive,
      },
      style
    );

    let thRatio = 0.6;
    let suppRatio = 0.4;

    if (thDecision.type === "FULL_SUPPORTING_VISUAL") {
      thRatio = 0.0;
      suppRatio = 1.0;
    } else if (thDecision.type === "PARTIAL_COVER") {
      thRatio = 0.4;
      suppRatio = 0.6;
    }

    // Add Primary Talking Head / Reframe decision
    decisions.push({
      id: `th-${scene.sceneId}`,
      timelineStart: scene.timelineStart,
      timelineEnd: scene.timelineStart + duration * (thRatio || 1.0),
      type: thDecision.type === "PUNCH_IN" ? "PUNCH_IN" : "VISUAL_KEEP",
      priority: 1,
      confidence: thDecision.confidence,
      reason: thDecision.reason,
      reasonSk: thDecision.reasonSk,
      source: "EDITORIAL_ENGINE",
      status: "applied",
      locked: false,
    });

    // 3. Keyword / Kinetic Typography Decision
    if (scene.keywords.length > 0 && densityScore >= 0.3) {
      const keywordTime = scene.timelineStart + duration * 0.25;
      const typographyDec = KineticTypographyEngine.createKineticDecision(
        {
          id: `kw-${scene.sceneId}`,
          text: scene.keywords[0].toUpperCase(),
          words: [{ word: scene.keywords[0], start: keywordTime, end: keywordTime + 1.5, isKeyword: true }],
          timelineStart: keywordTime,
          timelineEnd: Math.min(scene.timelineEnd, keywordTime + 1.8),
          importance: scene.semanticImportance,
        },
        style
      );
      decisions.push(typographyDec);
    }

    // 4. B-roll / Supporting Visual or Collage Decision
    let planStatus: "READY" | "NEEDS_ASSET" | "NEEDS_DATA" = "READY";

    if (scene.semanticImportance >= 0.6) {
      const brollStart = scene.timelineStart + duration * 0.4;
      const brollEnd = Math.min(scene.timelineEnd, brollStart + 2.5);

      if (hasMatchingAsset) {
        const asset = scene.availableBrollAssets[0];
        const collageComp = EditorialCollageEngine.createCollageComposition(
          scene.sceneId,
          [{ id: asset.id, type: style.photoStyle === "polaroid" ? "polaroid" : "photo", contentUrl: asset.url }],
          style
        );

        decisions.push({
          id: `broll-${scene.sceneId}`,
          timelineStart: brollStart,
          timelineEnd: brollEnd,
          type: "BROLL",
          priority: 2,
          confidence: 0.92,
          reason: `Supporting B-roll '${asset.name}' added for semantic alignment.`,
          reasonSk: `Podporný B-roll '${asset.name}' pridaný pre sémantické doplnenie.`,
          source: "EDITORIAL_ENGINE",
          status: "applied",
          locked: false,
          visualAssetId: asset.id,
          composition: collageComp,
        });
      } else {
        // Explicitly set status to NEEDS_ASSET per strict rule! No hallucinated assets!
        planStatus = "NEEDS_ASSET";
        decisions.push({
          id: `need-asset-${scene.sceneId}`,
          timelineStart: brollStart,
          timelineEnd: brollEnd,
          type: "BROLL",
          priority: 2,
          confidence: 0.7,
          reason: "Semantic concept requires supporting visual, but no matching asset is present in project media.",
          reasonSk: "Sémantická myšlienka vyžaduje podporný vizuál, avšak zodpovedajúci asset chýba v knižnici.",
          source: "EDITORIAL_ENGINE",
          status: "NEEDS_ASSET",
          locked: false,
        });
      }
    }

    // 5. Micro-motion decision
    const motion = MicroMotionEngine.computeMicroMotion(duration, scene.semanticImportance >= 0.8, style);
    if (motion.type !== "none") {
      decisions.push({
        id: `motion-${scene.sceneId}`,
        timelineStart: scene.timelineStart,
        timelineEnd: scene.timelineEnd,
        type: "MICRO_MOTION",
        priority: 3,
        confidence: 0.94,
        reason: motion.reasonSk,
        reasonSk: motion.reasonSk,
        source: "EDITORIAL_ENGINE",
        status: "applied",
        locked: false,
        animation: {
          name: motion.type,
          duration,
          easing: "ease-out",
          priority: 3,
        },
      });
    }

    return {
      sceneId: scene.sceneId,
      timelineStart: scene.timelineStart,
      timelineEnd: scene.timelineEnd,
      contentSummary: scene.transcriptText || `Scene ${scene.sceneId}`,
      talkingHeadPercentage: Math.round(thRatio * 100),
      supportingVisualPercentage: Math.round(suppRatio * 100),
      decisions,
      status: planStatus,
      visualDensityScore: densityScore,
    };
  }
}

import { EditorialDecision } from "./VisualDecisionTypes";
import { VisualStyleDNA } from "./VisualStyleDNA";
import { AISceneDirector, SceneInputData } from "./AISceneDirector";

export interface StoryboardItem {
  id: string;
  sceneNumber: number;
  timelineStart: number;
  timelineEnd: number;
  duration: number;
  visualTreatmentSk: string;
  compositionSk: string;
  typographySk: string;
  brollIntentSk: string;
  motionSk: string;
  transitionSk: string;
  reasonSk: string;
  /** Where the numbers of this item come from (measured / neutral value / missing data). */
  evidenceSk?: string;
  confidence: number;
  decisions: EditorialDecision[];
  status: "pending" | "applied" | "rejected";
  /** Real reason why a decision of this scene stayed manual (filled after an apply attempt). */
  manualReasonSk?: string;
}

export interface StoryboardPlan {
  projectId: string;
  generatedAt: string;
  items: StoryboardItem[];
  styleName: string;
}

export class AIStoryboardGenerator {
  static generateStoryboard(
    projectId: string,
    scenes: SceneInputData[],
    style: VisualStyleDNA,
    evidence?: Record<string, { boundsSk: string; importanceSk: string; brollSk: string }>
  ): StoryboardPlan {
    const items: StoryboardItem[] = scenes.map((scene, idx) => {
      const plan = AISceneDirector.createSceneEditorialPlan(scene, style);
      const duration = scene.timelineEnd - scene.timelineStart;

      const kineticDec = plan.decisions.find(d => d.type === "KINETIC_TEXT");
      const brollDec = plan.decisions.find(d => d.type === "BROLL");
      const motionDec = plan.decisions.find(d => d.type === "MICRO_MOTION");
      const transitionDec = plan.decisions.find(d => d.type === "TRANSITION");

      return {
        id: `sb-item-${idx + 1}`,
        sceneNumber: idx + 1,
        timelineStart: scene.timelineStart,
        timelineEnd: scene.timelineEnd,
        duration: Number(duration.toFixed(1)),
        visualTreatmentSk: `Talking Head (${plan.talkingHeadPercentage}%) + Podporný vizuál (${plan.supportingVisualPercentage}%)`,
        compositionSk: style.compositionStyle === "layered_collage" ? "Vrstvená editoriálna koláž" : "Pravidlo tretin / Stredové zábery",
        typographySk: kineticDec ? `Kinetický text: '${kineticDec.reasonSk}'` : "Štandardný titulok",
        brollIntentSk: brollDec ? brollDec.reasonSk : "Bez dodatočného B-rollu",
        motionSk: motionDec ? motionDec.reasonSk : "Statický záber",
        transitionSk: transitionDec ? transitionDec.reasonSk : "Priamy strih",
        reasonSk: `Rozhodnutie scény podľa dôležitosti ${(scene.semanticImportance * 100).toFixed(0)} % a vizuálnej hustoty ${plan.visualDensityScore}.`,
        // The item confidence is the scene's declared importance — no made-up baseline offset.
        confidence: Number(scene.semanticImportance.toFixed(2)),
        evidenceSk: evidence?.[scene.sceneId]
          ? `Zdroj: ${evidence[scene.sceneId].boundsSk} · ${evidence[scene.sceneId].importanceSk} · B-roll: ${evidence[scene.sceneId].brollSk}`
          : undefined,
        decisions: plan.decisions,
        status: "pending",
      };
    });

    return {
      projectId,
      generatedAt: new Date().toISOString(),
      items,
      styleName: style.name,
    };
  }
}

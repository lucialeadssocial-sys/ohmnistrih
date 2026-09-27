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
  confidence: number;
  decisions: EditorialDecision[];
  status: "pending" | "applied" | "rejected";
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
    style: VisualStyleDNA
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
        reasonSk: `Automatické rozhodnutie scény na základe sémantickej dôležitosti (${scene.semanticImportance * 100}%) a hustoty ${plan.visualDensityScore}.`,
        confidence: Number((0.88 + scene.semanticImportance * 0.1).toFixed(2)),
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

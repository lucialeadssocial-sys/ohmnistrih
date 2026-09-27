import { VisualStyleDNA } from "./VisualStyleDNA";
import { CompositionElement } from "./VisualDecisionTypes";

export interface CollageItemInput {
  id: string;
  type: CompositionElement["type"];
  contentUrl?: string;
  textVal?: string;
  importance?: number;
}

export class EditorialCollageEngine {
  /**
   * Simple deterministic random generator using seed string
   */
  private static seededRandom(seed: string, offset: number = 0): number {
    let hash = 0;
    const str = seed + offset.toString();
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const x = Math.sin(hash) * 10000;
    return x - Math.floor(x);
  }

  static createCollageComposition(
    seed: string,
    items: CollageItemInput[],
    style: VisualStyleDNA
  ): CompositionElement[] {
    const elements: CompositionElement[] = [];

    // Background texture layer if configured
    if (style.textureStyle !== "clean") {
      elements.push({
        id: `bg-tex-${seed}`,
        type: "texture",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        scale: 1.0,
        opacity: style.halftoneIntensity > 0 ? style.halftoneIntensity * 0.5 : 0.15,
        zIndex: 1,
        blendMode: style.textureStyle === "halftone" ? "multiply" : "overlay",
      });
    }

    // Process each collage item deterministically
    items.forEach((item, index) => {
      const r1 = this.seededRandom(seed, index * 5 + 1);
      const r2 = this.seededRandom(seed, index * 5 + 2);
      const r3 = this.seededRandom(seed, index * 5 + 3);
      const r4 = this.seededRandom(seed, index * 5 + 4);

      // Deterministic layout coordinates
      const angleRange = style.paperStyle === "torn_rough" ? 12 : 5;
      const rotation = Number(((r1 * 2 - 1) * angleRange).toFixed(1));
      
      let width = 45 + r2 * 25; // 45% - 70%
      let height = 35 + r3 * 20; // 35% - 55%
      let x = 15 + r2 * 30; // 15% - 45%
      let y = 15 + r4 * 30; // 15% - 45%

      if (style.compositionStyle === "centered_focus") {
        x = 25;
        y = 20;
        width = 50;
        height = 60;
      } else if (style.compositionStyle === "split_screen") {
        x = index % 2 === 0 ? 5 : 52;
        y = 15;
        width = 43;
        height = 70;
      }

      // Shadow & Border per VisualStyleDNA
      const shadow = style.shadowStyle === "layered_drop"
        ? { color: "rgba(0,0,0,0.4)", blur: 16, offsetX: 8, offsetY: 12 }
        : style.shadowStyle === "hard_offset"
        ? { color: "rgba(0,0,0,0.8)", blur: 0, offsetX: 6, offsetY: 6 }
        : undefined;

      const border = style.borderStyle === "solid_2px"
        ? { color: style.accentColor, width: 2, style: "solid" as const }
        : style.borderStyle === "paper_deckle"
        ? { color: "#FFFFFF", width: 6, style: "deckle" as const }
        : undefined;

      elements.push({
        id: `elem-${item.id}-${index}`,
        type: item.type,
        x: Number(x.toFixed(1)),
        y: Number(y.toFixed(1)),
        width: Number(width.toFixed(1)),
        height: Number(height.toFixed(1)),
        rotation,
        scale: Number((1.0 + r4 * 0.1).toFixed(2)),
        opacity: 1.0,
        zIndex: 10 + index * 5,
        shadow,
        border,
        mask: style.cutoutStyle === "paper_edge" ? "paper_tear" : "none",
        animation: {
          type: style.pacingVisual === "fast_dynamic" ? "pop" : "scale_in",
          duration: 0.35,
          easing: "ease-out",
        },
        contentUrl: item.contentUrl,
        textVal: item.textVal,
      });
    });

    return elements;
  }
}

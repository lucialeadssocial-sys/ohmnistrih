/**
 * REFERENČNÝ OBRÁZOK → ŠTÝL (krok 11 Reality Gate).
 *
 * Trieda má rovnaké meno ako predtým, ale **obsah je iný a pravdivý**: predtým
 * „analýza" hádala štýl podľa **mena súboru** (`if (name.includes("clean")) …`),
 * čo je presne to, čo pravidlá zakazujú — appka tvrdila veci, ktoré nemala z čoho zistiť.
 *
 * Teraz:
 *  - dostane **reálne pixely** a zmeria ich (`analyzeReferencePixels`),
 *  - z merania vyplní len tie polia DNA, ktoré sa naozaj dajú zmerať
 *    (farba, hustota, kontrast, teplota),
 *  - zvyšok DNA **prevezme z vybraného receptu** a **prizná**, že je prevzatý,
 *  - keď pixely nemá, vráti `NOT AVAILABLE` s dôvodom. Nič sa nedomýšľa.
 */

import { VisualStyleDNA, STYLE_PRESETS } from "./VisualStyleDNA";
import {
  analyzeReferencePixels,
  buildStyleBoard,
  type AnalyzeReferenceOptions,
  type ReferenceAnalysis,
  type StyleBoardData,
} from "../core/style/referencePixels";

export interface ReferenceExtractedAttributes {
  dominantColors: string[];
  /** Nameraná hustota (0–1) — z hustoty hrán, nie z mena súboru. */
  densityScoreMeasured: number;
  /** Priemerný jas 0–255. */
  brightness: number;
  contrast: number;
  saturation: number;
  edgeDensity: number;
  accentColor: string | null;
}

export interface ReferenceStyleAnalysisResult {
  available: boolean;
  /** Prečo to nejde (keď `available: false`) — po slovensky, konkrétne. */
  reasonSk?: string;
  dna: VisualStyleDNA | null;
  analysis: ReferenceAnalysis | null;
  board: StyleBoardData | null;
  extractedAttributes: ReferenceExtractedAttributes | null;
  /** Ktoré polia DNA sú prevzaté z receptu a nie namerané (aby sa nepovedalo viac). */
  inheritedSk: string[];
  explanationSk: string;
}

export class ReferenceStyleAnalyzer {
  /**
   * Zmeria referenčný obrázok. **Bez pixelov sa nič nevymýšľa.**
   *
   * @param referenceName meno súboru — používa sa len do textov, **nikdy** na rozhodovanie.
   * @param projectId projekt, ku ktorému sa DNA viaže.
   * @param pixels RGBA/RGB pixely obrázka (z canvasu v prehliadači, z ffmpeg v runneri).
   */
  static analyzeReferenceStyle(
    referenceName: string,
    projectId: string,
    pixels?: Uint8ClampedArray | Uint8Array | number[],
    width?: number,
    height?: number,
    options: AnalyzeReferenceOptions = {},
  ): ReferenceStyleAnalysisResult {
    if (!pixels || !width || !height) {
      return {
        available: false,
        reasonSk:
          "NOT AVAILABLE — nemám pixely referenčného obrázka. Analýza podľa mena súboru sa už zámerne nerobí " +
          "(tvrdila by veci, ktoré sa nedajú zmerať). Vyber obrázok znova, prosím.",
        dna: null,
        analysis: null,
        board: null,
        extractedAttributes: null,
        inheritedSk: [],
        explanationSk: "Analýza referencie: NOT AVAILABLE (chýbajú pixely).",
      };
    }

    const outcome = analyzeReferencePixels(pixels, width, height, options);
    if (!outcome.available) {
      return {
        available: false,
        reasonSk: outcome.reasonSk,
        dna: null,
        analysis: null,
        board: null,
        extractedAttributes: null,
        inheritedSk: [],
        explanationSk: `Analýza referencie: NOT AVAILABLE (${outcome.reasonSk})`,
      };
    }

    const analysis = outcome;
    const board = buildStyleBoard(analysis, { titleSk: `Deska štýlu — ${referenceName}` });

    // Základ pre „prevzaté" polia DNA. Používateľ si recept vyberá v Style Studiu;
    // tu berieme neutrálny základ, aby DNA nepredstierala namerané hodnoty.
    const basePreset = STYLE_PRESETS.OMNISTRIH_EDITORIAL;

    const dominantColors = analysis.palette.slice(0, 5).map((c) => c.hex);
    const accent = analysis.accent?.hex ?? null;
    // Koľko plochy vysvetľujú namerané farby — to je poctivá „istota" analýzy.
    const paletteCoverage = Math.min(
      1,
      analysis.palette.reduce((sum, c) => sum + c.coverage, 0),
    );

    const dna: VisualStyleDNA = {
      ...basePreset,
      id: `ref_${Date.now()}_${projectId}`,
      name: `Referencia: ${referenceName}`,
      description: `Zmerané z pixelov referenčného obrázka (${analysis.width}×${analysis.height}).`,
      source: "REFERENCE",
      confidence: Math.round(paletteCoverage * 100) / 100,
      evidence:
        `jas ${analysis.brightness}/255, kontrast ${analysis.contrast}, sýtosť ${Math.round(analysis.saturation * 100)} %, ` +
        `hustota hrán ${analysis.edgeDensity}, tmavé ${Math.round(analysis.darkRatio * 100)} %, ` +
        `paleta ${dominantColors.join(" · ")}`,
      version: 1,
      projectId,

      // --- NAMERANÉ (má oporu v pixeloch) ---
      accentColor: accent ?? dominantColors[0],
      visualDensity: analysis.edgeDensity,
      colorMood:
        analysis.saturation <= 0.15
          ? "monochrome_newspaper"
          : analysis.darkRatio >= 0.5
            ? "dark_editorial"
            : analysis.lightRatio >= 0.5
              ? "clean_light"
              : analysis.warmth > 12
                ? "cinematic_warm"
                : "vibrant_pop",
      backgroundStyle:
        analysis.darkRatio >= 0.4 ? "dark_neutral" : analysis.lightRatio >= 0.4 ? "light_clean" : "gradient_editorial",

      // --- PREVZATÉ Z RECEPTU (nemerateľné z obrázka) ---
      pacingVisual: basePreset.pacingVisual,
      typographyStyle: basePreset.typographyStyle,
      typographyWeight: basePreset.typographyWeight,
      typographyScale: basePreset.typographyScale,
      captionVisualStyle: basePreset.captionVisualStyle,
      textureStyle: basePreset.textureStyle,
      collageIntensity: basePreset.collageIntensity,
    };

    const inheritedSk = [
      "typografia (font, hrúbka, veľkosť) — z obrázka sa nedá určiť spoľahlivo",
      "tempo a rytmus (pacingVisual) — na to treba video, nie obrázok",
      "textúra a intenzita koláže — prevzaté z receptu, nie namerané",
    ];

    return {
      available: true,
      dna,
      analysis,
      board,
      extractedAttributes: {
        dominantColors,
        densityScoreMeasured: analysis.edgeDensity,
        brightness: analysis.brightness,
        contrast: analysis.contrast,
        saturation: analysis.saturation,
        edgeDensity: analysis.edgeDensity,
        accentColor: accent,
      },
      inheritedSk,
      explanationSk:
        `Zmerané z pixelov „${referenceName}": ${analysis.moodSk} ` +
        `Paleta: ${dominantColors.join(" · ")}. Hustota hrán ${analysis.edgeDensity} (0 = pokojná, 1 = plná). ` +
        `Namerané farby vysvetľujú ${Math.round(paletteCoverage * 100)} % plochy. ` +
        `Prebraté (nemerateľné z obrázka): ${inheritedSk.length} vlastností — viď zoznam.`,
    };
  }
}

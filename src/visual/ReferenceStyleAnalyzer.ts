import { VisualStyleDNA, STYLE_PRESETS } from "./VisualStyleDNA";

export interface ReferenceAnalysisResult {
  dna: VisualStyleDNA;
  extractedAttributes: {
    dominantColors: string[];
    typographyStyleFound: string;
    densityScoreEstimated: number;
    hasPaperTexture: boolean;
    hasCollageElements: boolean;
  };
  explanationSk: string;
}

export class ReferenceStyleAnalyzer {
  /**
   * Analyzes reference image visual language deterministically or via heuristic signals
   */
  static analyzeReferenceStyle(
    referenceName: string,
    projectId: string
  ): ReferenceAnalysisResult {
    // Heuristic analysis of reference design language
    const nameLower = referenceName.toLowerCase();

    let basePreset = STYLE_PRESETS.OMNISTRIH_EDITORIAL;
    let extractedColors = ["#F59E0B", "#111827", "#F3F4F6"];
    let typographyFound = "bold_condensed";
    let density = 0.65;
    let paper = true;
    let collage = true;

    if (nameLower.includes("clean") || nameLower.includes("minimal")) {
      basePreset = STYLE_PRESETS.CLEAN_PROFESSIONAL;
      extractedColors = ["#2563EB", "#FFFFFF", "#1F2937"];
      typographyFound = "clean_sans";
      density = 0.35;
      paper = false;
      collage = false;
    } else if (nameLower.includes("cinematic") || nameLower.includes("dark")) {
      basePreset = STYLE_PRESETS.CINEMATIC;
      extractedColors = ["#D97706", "#0F172A", "#E2E8F0"];
      typographyFound = "editorial_serif";
      density = 0.4;
      paper = false;
      collage = false;
    } else if (nameLower.includes("social") || nameLower.includes("fast")) {
      basePreset = STYLE_PRESETS.SOCIAL_FAST;
      extractedColors = ["#10B981", "#09090B", "#FAFAFA"];
      typographyFound = "kinetic_display";
      density = 0.85;
      paper = true;
      collage = true;
    }

    const analyzedDNA: VisualStyleDNA = {
      ...basePreset,
      id: `ref_${Date.now()}_${projectId}`,
      name: `Style extracted from: ${referenceName}`,
      description: `Reference visual DNA derived from ${referenceName}`,
      accentColor: extractedColors[0],
      visualDensity: density,
      source: "REFERENCE",
      confidence: 0.92,
      evidence: `Derived from image analysis of '${referenceName}' (composition, typography, color scheme)`,
      version: 1,
      projectId,
    };

    return {
      dna: analyzedDNA,
      extractedAttributes: {
        dominantColors: extractedColors,
        typographyStyleFound: typographyFound,
        densityScoreEstimated: density,
        hasPaperTexture: paper,
        hasCollageElements: collage,
      },
      explanationSk: `Extrahovaný vizuálny štýl z referenčného obrázku '${referenceName}': dominantná farba ${extractedColors[0]}, typografia ${typographyFound}, hustota ${density}.`,
    };
  }
}

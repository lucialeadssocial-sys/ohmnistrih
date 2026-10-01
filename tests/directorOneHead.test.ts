/**
 * KROK 0c — JEDNA HLAVA: testy, ktoré držia slovo Directora na jednom mieste.
 *
 * Testujeme tri veci, ktoré sa v praxi rozídu najľahšie:
 *  1. typy zásahov a režimy existujú LEN v jednom module (žiadne kópie),
 *  2. režim navrhuje cieľ, ale cieľ si určuje používateľ (9 cieľov z kroku 26),
 *  3. Director Studio číta rozhodnutia zo spoločného enginu a bez analýzy
 *     NEDOSTANE žiadne (nič sa nedomýšľa).
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DIRECTOR_ACTION_TYPES,
  DIRECTOR_MODES,
  isDirectorActionType,
  normalizeDirectorMode,
  planVocabularyIssues,
  suggestedGoalForMode,
} from "../src/core/ai/directorVocabulary";
import { VIDEO_GOALS } from "../src/core/style/videoGoal";
import { directorToolRegistry } from "../src/ai/director/directorTools";

const ROOT = process.cwd();

/** Kód bez komentárov — komentár nesmie spôsobiť falošný nález. */
function readCode(relPath: string): string {
  const raw = readFileSync(join(ROOT, relPath), "utf-8");
  return raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("KROK 0c — jeden slovník Directora", () => {
  test("typy zásahov sú na jednom mieste a neznámy typ sa odmietne", () => {
    expect(DIRECTOR_ACTION_TYPES.length).toBe(11);
    expect(isDirectorActionType("CUT")).toBe(true);
    expect(isDirectorActionType("cut")).toBe(false); // veľkosť písmen rieši volajúci
    expect(planVocabularyIssues([{ type: "CUT" }, { type: "MAGIC" as any }]).length).toBe(1);
  });

  test("neznámy režim padá na CUSTOM, nie na vymyslený režim", () => {
    expect(normalizeDirectorMode("ads")).toBe("ADS");
    expect(normalizeDirectorMode("nonsense")).toBe("CUSTOM");
    expect(normalizeDirectorMode(undefined)).toBe("CUSTOM");
  });

  test("režim len NAVRHUJE cieľ a návrh je z existujúcich 9 cieľov", () => {
    const goals = Object.keys(VIDEO_GOALS);
    expect(goals.length).toBe(9);
    for (const mode of Object.keys(DIRECTOR_MODES)) {
      const suggested = suggestedGoalForMode(normalizeDirectorMode(mode));
      if (suggested !== null) {
        expect(goals).toContain(suggested);
      }
    }
    // Vlastný štýl cieľ neurčuje — cieľ vyberá používateľ.
    expect(suggestedGoalForMode("CUSTOM")).toBeNull();
  });

  test("server AJ panel berú slovník z jedného modulu (žiadne kópie)", () => {
    const server = readCode("server.ts");
    const panel = readCode("src/components/DirectorPlanPanel.tsx");

    // Kópie, ktoré tam boli pred krokom 0c:
    expect(server.includes("const DIRECTOR_MODES: Record<")).toBe(false);
    expect(server.includes("const DIRECTOR_ACTION_TYPES: DirectorActionType[]")).toBe(false);
    expect(panel.includes("export type DirectorActionType =")).toBe(false);
    expect(panel.includes("export interface DirectorPlanItem {")).toBe(false);

    // A naopak: obe strany skutočne importujú spoločný modul.
    expect(server.includes("directorVocabulary")).toBe(true);
    expect(panel.includes("directorVocabulary")).toBe(true);
  });

  test("server priznáva, z čoho plán vznikol (basis + dataQuality)", () => {
    const server = readCode("server.ts");
    expect(server.includes("planBasis:")).toBe(true);
    expect(server.includes("dataQuality:")).toBe(true);
    expect(server.includes("estimatedTimeSavedIsEstimate: true")).toBe(true);
  });
});

describe("KROK 0c — Director Studio sa pýta tej istej hlavy", () => {
  test("existuje nástroj, ktorý vracia rozhodnutia spoločného enginu", () => {
    const tool = directorToolRegistry.getTool("getDirectorDecisions");
    expect(tool).toBeDefined();
    expect(tool?.permissions).toContain("READ_PROJECT");
  });

  test("bez nameranej analýzy nevydá ani jedno rozhodnutie a povie prečo", () => {
    const tool = directorToolRegistry.getTool("getDirectorDecisions")!;
    const project: any = {
      id: "test-projekt",
      title: "Bez analýzy",
      updatedAt: 1000,
      createdAt: 1000,
      tracks: [],
      assets: [],
      analysisResults: null,
    };
    const out = tool.execute({}, project);
    expect(out.success).toBe(true);
    expect(out.result.decisions.length).toBe(0);
    expect(out.result.basis).toBe("none");
    expect(String(out.result.noteSk).toLowerCase()).toContain("nič sa nedomýšľa");
  });

  test("výstup nástroja je deterministický", () => {
    const tool = directorToolRegistry.getTool("getDirectorDecisions")!;
    const project: any = { id: "p", title: "t", updatedAt: 5, createdAt: 5, tracks: [], assets: [], analysisResults: null };
    expect(JSON.stringify(tool.execute({}, project))).toBe(JSON.stringify(tool.execute({}, project)));
  });
});

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cutDensitySeries, measureProject, measurementSummary, verdictForCheck } from "../src/core/qc/qcMeasure";
import { INITIAL_QC_GATE_CHECKS } from "../src/data/qcGateChecksData";
import { directorEngine } from "../src/core/ai/directorEngine";
import { CREATIVE_PATTERNS_DB } from "../src/core/ai/knowledgeBase";
import { createInitialProject, coreEngine } from "../src/core";
import type { ProjectModel } from "../src/core/types/project";

/**
 * KROK 29 — HONESTY FIX (UNIT TESTED).
 *
 * Cieľ: dokázať, že appka NEMÔŽE zobraziť tvrdenie, ktoré nemá meranie.
 *
 * POZOR (reporting): toto je **UNIT TESTED**. Neznamená to, že to niekto videl
 * v prehliadači (BROWSER VERIFIED) — to vie overiť len používateľ v appke.
 */

const REPO = process.cwd();
const read = (rel: string) => readFileSync(join(REPO, rel), "utf8");

/**
 * Kód bez komentárov — aby test nepadal na tom, že si súbor vo vysvetlení
 * PAMÄTÁ starú chybu (napr. „pôvodne tu bolo Math.random()“).
 */
const readCode = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/** Projekt s reálnymi klipmi, ktorý sa dá zmerať. */
function projectWithClips(): ProjectModel {
  const project = createInitialProject("honesty-test");
  const asset = {
    id: "asset-1",
    name: "real_speech.mp4",
    type: "video" as const,
    opfsPath: "opfs://asset-1",
    size: 1000,
    mimeType: "video/mp4",
    duration: 30,
    width: 1080,
    height: 1920,
    fps: 30,
    createdAt: 1759219200000,
  };
  project.assets = [asset];

  const track = project.tracks.find((t) => t.type === "video");
  if (!track) throw new Error("test project nemá video stopu");

  // Tri zábery: 0–6 s, 6–12 s (strih), 12–20 s (strih) → 2 strihy.
  track.clips = [
    { ...(track.clips[0] as any), id: "c1", assetId: asset.id, sourceStart: 0, sourceEnd: 6, start: 0, duration: 6 },
    { ...(track.clips[0] as any), id: "c2", assetId: asset.id, sourceStart: 6, sourceEnd: 12, start: 6, duration: 6 },
    { ...(track.clips[0] as any), id: "c3", assetId: asset.id, sourceStart: 12, sourceEnd: 20, start: 12, duration: 8 },
  ];
  return project;
}

describe("KROK 29 — meranie časovej osi (qcMeasure)", () => {
  test("prázdny projekt: nič sa nemeria a nič nemá PASS", () => {
    const m = measureProject(null);
    expect(m.ok).toBe(false);
    expect(m.clipCount).toBe(0);
    for (const check of INITIAL_QC_GATE_CHECKS) {
      const v = verdictForCheck(check.id, m);
      expect(v.status).toBe("NOT_VERIFIED");
      expect(v.evidenceSource).toBe(null);
    }
  });

  test("reálne klipy: spočíta strihy, dĺžku a medián záberu", () => {
    const m = measureProject(projectWithClips());
    expect(m.ok).toBe(true);
    expect(m.videoClipCount).toBe(3);
    expect(m.cutCount).toBe(2);
    expect(m.timelineDurationSec).toBe(20);
    expect(m.medianShotSec).toBe(6);
    expect(m.cutsPerMinute).toBe(6);
    expect(m.aspect).toBe("1080:1920");
  });

  test("meranie je deterministické (ten istý projekt = tie isté čísla)", () => {
    const project = projectWithClips();
    const a = measureProject(project);
    const b = measureProject(project);
    // `id` projektu je náhodné pri vytvorení projektu, preto ho z porovnania vynechávame.
    const strip = (x: typeof a) => JSON.stringify({ ...x, projectId: "" });
    expect(strip(a)).toBe(strip(b));
  });

  test("hustota strihu sedí s počtom strihov", () => {
    const m = measureProject(projectWithClips());
    const total = m.densitySeries.reduce((sum, p) => sum + p.cuts, 0);
    expect(total).toBe(m.cutCount);
    expect(m.densitySeries.length).toBe(12);
  });

  test("cutDensitySeries: prázdne zadanie nič nevymýšľa", () => {
    expect(cutDensitySeries([], 0, 12)).toEqual([]);
    expect(cutDensitySeries([1, 2, 3], 0, 12)).toEqual([]);
  });

  test("kontroly bez merania NIKDY nemajú PASS ani pri plnom projekte", () => {
    const m = measureProject(projectWithClips());
    // Tie, ktoré si vyžadujú meranie zvuku / obrazu / emócií / posudok:
    const withoutMeasurement = ["QC-01", "QC-02", "QC-05", "QC-07", "QC-09", "QC-10", "QC-13", "QC-18", "QC-19", "QC-20", "QC-21", "QC-23", "QC-25"];
    for (const id of withoutMeasurement) {
      const v = verdictForCheck(id, m);
      expect(v.status).toBe("NOT_VERIFIED");
      expect(v.evidenceSource).toBe(null);
    }
  });

  test("PASS sa objaví len tam, kde je meranie (a je vidno, odkiaľ)", () => {
    const m = measureProject(projectWithClips());
    const m2 = measureProject(null);
    expect(verdictForCheck("QC-03", m).evidenceSource).toBe("measured");
    expect(verdictForCheck("QC-03", m2).evidenceSource).toBe(null);
    expect(measurementSummary(INITIAL_QC_GATE_CHECKS.map((c) => c.id), m).notVerified).toBeGreaterThan(0);
  });

  test("kolízia na stope a chýbajúce médium = FAIL s dôkazom", () => {
    const project = projectWithClips();
    const track = project.tracks.find((t) => t.type === "video")!;
    // Druhý klip posunieme dovnútra prvého → kolízia na tej istej stope.
    track.clips[1] = { ...track.clips[1], start: 3, duration: 6 };
    project.assets = []; // použité médium už v projekte nie je

    const m = measureProject(project);
    expect(m.overlapCount).toBe(1);
    expect(m.missingAssets).toEqual(["asset-1"]);
    const v = verdictForCheck("QC-24", m);
    expect(v.status).toBe("FAIL");
    expect(v.evidenceSk).toContain("kolízií");
  });
});

describe("KROK 29 — Director nesmie predstierať znalosť", () => {
  test("bez analýzy: žiadne rozhodnutia a otvorená otázka namiesto vymyslených časov", () => {
    const project = projectWithClips();
    project.analysisResults = undefined;

    const plan = directorEngine.generateDirectorPlan(project, "TikTok", ["Retention"]);
    expect(plan.decisions.length).toBe(0);
    expect(plan.unresolvedAmbiguities.length).toBeGreaterThan(0);
    expect(plan.confidence).toBe(0);
    const dump = JSON.stringify(plan);
    expect(dump).not.toContain("12.0");
    expect(dump).not.toContain("4.2");
    expect(dump).not.toContain("5.8");
  });

  test("s analýzou: rozhodnutia vychádzajú z analýzy a confidence je priemer (nie konštanta)", () => {
    const project = projectWithClips();
    project.analysisResults = {
      projectId: project.id,
      timestamp: 1759219200000,
      pauses: [{ id: "p1", start: 3.0, end: 5.5, duration: 2.5, type: "long_pause", confidence: 0.9 }],
      hooks: [{ id: "h1", start: 0, end: 3.0, type: "question", confidence: 0.8 }],
      brollOpportunities: [{ id: "b1", start: 6.0, end: 10.0, suggestedVisualType: "product", confidence: 0.7 }],
    } as any;

    const plan = directorEngine.generateDirectorPlan(project, "TikTok", ["Retention"]);
    expect(plan.decisions.length).toBe(3);
    expect(plan.decisions[0].timelineLocation?.start).toBe(3.0);
    expect(plan.confidence).toBeCloseTo(0.8, 2);
    expect(plan.decisions.some((d) => d.priority === "MUST_CONSIDER")).toBe(true);
  });

  test("plán je deterministický (žiadny Date.now() v rozhodnutí)", () => {
    const project = projectWithClips();
    project.analysisResults = { projectId: project.id, timestamp: 1, pauses: [], hooks: [], brollOpportunities: [] } as any;
    const a = directorEngine.generateDirectorPlan(project, "TikTok", ["Retention"]);
    const b = directorEngine.generateDirectorPlan(project, "TikTok", ["Retention"]);
    expect(a.createdAt).toBe(b.createdAt);
    expect(a.createdAt).toBe(project.updatedAt);
  });
});

describe("KROK 29 — vymyslené dáta sú preč (regresná poistka)", () => {
  test("CREATIVE_PATTERNS_DB je prázdny (žiadne fake zdroje ani Date.now())", () => {
    expect(CREATIVE_PATTERNS_DB.length).toBe(0);
  });

  test("zavrhnuté vymyslené hodnoty sa v kóde už nevyskytujú", () => {
    const forbidden: Array<[string, string]> = [
      ["src/components/QualityControlAndAnalytics.tsx", "STRESS TEST VERIFIED"],
      ["src/components/QualityControlAndAnalytics.tsx", "WebM bitstream"],
      // Poznámka: panel smie historické hodnoty VYSVETLIŤ („simulácia vypisovala
      // 742 s / -14 LUFS“), ale nesmie ich tvrdiť ako výsledok merania.
      ["src/components/RetentionSimulator.tsx", "Math.random"],
      ["src/components/RetentionSimulator.tsx", "AI EDIT ADVISOR"],
      ["src/components/ContentGraphStudio.tsx", "5.8x"],
      ["src/components/ContentGraphStudio.tsx", "742"],
      ["src/core/ai/knowledgeBase.ts", "OmniStrih SK Content Intelligence Data 2026"],
      ["src/core/ai/directorEngine.ts", "createdAt: Date.now()"],
      ["src/App.tsx", "contentPack, isGenerated: true"],
      ["src/App.tsx", "export_finished\");\n      showToast(isSk ? \"✅ Všetky verzie"],
    ];
    for (const [file, needle] of forbidden) {
      expect([file, needle, readCode(file).includes(needle)]).toEqual([file, needle, false]);
    }
  });

  test("QC panel nezapisuje PASS sám od seba (iba cez verdikt z merania)", () => {
    const panel = readCode("src/components/QualityControlAndAnalytics.tsx");
    expect(panel.includes('status: "PASS"')).toBe(false);
    expect(panel.includes("setQcGateChecks")).toBe(false);
    expect(panel.includes("STRESS TEST")).toBe(false);
  });

  test("retenčný prehľad sa plní z merania, nie z pevných hodnôt", () => {
    const app = readCode("src/App.tsx");
    const retentionHandler = app.slice(app.indexOf("const handleRunRetentionAnalysis"), app.indexOf("const handleGenerateContentPack"));
    expect(retentionHandler.includes("measureProject(coreEngine.getProject())")).toBe(true);
    expect(retentionHandler.includes("setTimeout")).toBe(false);
    expect(retentionHandler.includes("Math.random")).toBe(false);
  });
});

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  detectSceneBoundaries,
  frameDistance,
  frameMetricsFromPixels,
  LUMA_709,
  sampleTimes,
  scenesFromBoundaries,
} from "../src/core/media/frameMetrics";
import { INITIAL_MEDIA_INDEX } from "../src/core/media/mediaIntelligenceIndex";

/**
 * KROK 30b — POCTIVÝ MEDIA INTELLIGENCE INDEX (UNIT TESTED).
 *
 * Dokazuje, že:
 *  1) obrazové metriky počítame z PIXELOV (nie zo vzorcov),
 *  2) strihy sa hľadajú v nameranom jase (nie na 25 % a 65 % dĺžky),
 *  3) keď dáta nie sú, index to prizná (`NOT_AVAILABLE` + dôvod),
 *  4) vymyslené hodnoty z pôvodnej verzie sa už v kóde nevyskytujú.
 *
 * POZOR: je to UNIT TESTED (syntetické pixely). Reálne video overuje
 * `tools/verify-media-index.ts` (REAL MEDIA VERIFIED).
 */

const REPO = process.cwd();
const readCode = (rel: string) =>
  readFileSync(join(REPO, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/** Vyrobí RGBA pixely jednej farby (testovací vstup — nie meranie). */
function solidPixels(width: number, height: number, r: number, g: number, b: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return data;
}

/** Šachovnica — má hrany, takže ostrosť musí byť > 0. */
function checkerPixels(width: number, height: number, a = 0, b = 255): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const v = (x + y) % 2 === 0 ? a : b;
      const o = (y * width + x) * 4;
      data[o] = v;
      data[o + 1] = v;
      data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  return data;
}

describe("KROK 30b — obrazové metriky z pixelov", () => {
  test("jas a farba sedia s pixelmi (žiadne vzorce)", () => {
    const m = frameMetricsFromPixels(solidPixels(10, 10, 200, 100, 50), 10, 10, 1.5);
    expect(m).not.toBeNull();
    expect(m!.rgb).toEqual([200, 100, 50]);
    expect(m!.luma).toBeCloseTo(LUMA_709(200, 100, 50), 1);
    expect(m!.darkShare).toBe(0);
    expect(m!.sharpness).toBe(0); // jednofarevná plocha nemá hrany
  });

  test("ostrosť na šachovnici je vysoká, na jednofarevnej ploche nulová", () => {
    const flat = frameMetricsFromPixels(solidPixels(20, 20, 128, 128, 128), 20, 20, 0)!;
    const checker = frameMetricsFromPixels(checkerPixels(20, 20), 20, 20, 0)!;
    expect(flat.sharpness).toBe(0);
    expect(checker.sharpness).toBeGreaterThan(100); // maximum je 255 (priemer |rozdielu|)
  });

  test("tmavé a svetlé pixely sa správne počítajú", () => {
    const dark = frameMetricsFromPixels(solidPixels(8, 8, 10, 10, 10), 8, 8, 0)!;
    const light = frameMetricsFromPixels(solidPixels(8, 8, 250, 250, 250), 8, 8, 0)!;
    expect(dark.darkShare).toBe(1);
    expect(light.lightShare).toBe(1);
  });

  test("bez pixelov sa nič nevymýšľa (vráti null)", () => {
    expect(frameMetricsFromPixels(new Uint8ClampedArray(0), 0, 0, 0)).toBeNull();
    expect(frameMetricsFromPixels(new Uint8ClampedArray(8), 10, 10, 0)).toBeNull();
  });
});

describe("KROK 30b — strihy z nameraného jasu", () => {
  test("skok jasu medzi vzorkami = strih, plynulá zmena = žiadny strih", () => {
    const black = frameMetricsFromPixels(solidPixels(6, 6, 0, 0, 0), 6, 6, 0)!;
    const white = frameMetricsFromPixels(solidPixels(6, 6, 255, 255, 255), 6, 6, 1)!;
    const dark = frameMetricsFromPixels(solidPixels(6, 6, 60, 60, 60), 6, 6, 2)!;
    const mid = frameMetricsFromPixels(solidPixels(6, 6, 90, 90, 90), 6, 6, 3)!;

    const sharpCut = detectSceneBoundaries([black, white]);
    expect(sharpCut.length).toBe(1);
    expect(sharpCut[0].timestamp).toBe(1);
    expect(sharpCut[0].score).toBeGreaterThan(0.6);

    // Pri predvolenom (nameranom) prahu 0,12 sa veľká zmena označí…
    expect(detectSceneBoundaries([black, dark]).length).toBe(1);

    // …ale malá zmena nie, a to ani s prísnejším prahom.
    const tiny = frameMetricsFromPixels(solidPixels(6, 6, 30, 30, 30), 6, 6, 1)!;
    expect(detectSceneBoundaries([black, tiny]).length).toBe(0);
    expect(detectSceneBoundaries([black, dark], 0.3).length).toBe(0);
  });

  test("vzdialenosť snímok je symetrická a v rozsahu 0–1", () => {
    const a = frameMetricsFromPixels(solidPixels(4, 4, 10, 10, 10), 4, 4, 0)!;
    const b = frameMetricsFromPixels(solidPixels(4, 4, 240, 240, 240), 4, 4, 0)!;
    expect(frameDistance(a, b)).toBeCloseTo(frameDistance(b, a), 6);
    expect(frameDistance(a, b)).toBeLessThanOrEqual(1);
    expect(frameDistance(a, a)).toBe(0);
  });

  test("scény sa delia podľa hraníc a nikdy nie na pevných 25 % / 65 %", () => {
    const scenes = scenesFromBoundaries([{ timestamp: 3, score: 0.8 }], 10);
    expect(scenes.map((s) => [s.start, s.end])).toEqual([
      [0, 3],
      [3, 10],
    ]);
    const one = scenesFromBoundaries([], 10);
    expect(one.length).toBe(1);
    expect(one[0]).toMatchObject({ start: 0, end: 10, duration: 10 });
  });

  test("vzorkovanie je deterministické a drží sa vnútri média (stredy intervalov)", () => {
    const times = sampleTimes(10, 5);
    // Stredy intervalov, NIE krajné body: vzorka na presnom konci média
    // vracia prázdny obraz a vyrobí falošnú hranicu (overené na statickom médiu).
    expect(times).toEqual([1, 3, 5, 7, 9]);
    expect(times.every((t) => t > 0 && t < 10)).toBe(true);
    expect(sampleTimes(10, 5)).toEqual(times);
    expect(sampleTimes(0, 5)).toEqual([]);
  });
});

describe("KROK 30b — index nesmie predstierať", () => {
  test("prázdny index neobsahuje žiadne vymyslené čísla", () => {
    const index = INITIAL_MEDIA_INDEX("asset-1");
    expect(index.transcriptText).toBe("");
    expect(index.wordTimestamps).toEqual([]);
    expect(index.scenes).toEqual([]);
    expect(index.sceneBoundaries).toEqual([]);
    expect(index.representativeFrames).toEqual([]);
    expect(index.duplicateShots).toEqual([]);
    expect(index.framesAnalysed).toBe(0);
    expect(index.averageBrightness).toBe(0); // predtým falošných 128
    expect(index.averageBlurScore).toBe(0); // predtým falošných 80
    expect(index.dataQuality).toEqual({});
  });

  test("pôvodné vymyslené vzory sa v kóde už nevyskytujú", () => {
    const index = readCode("src/core/media/mediaIntelligenceIndex.ts");
    const forbidden = [
      "sampleWords", // pevný zoznam slov namiesto prepisu
      "Heuristic to simulate",
      "duration * 0.25",
      "duration * 0.65",
      "0.88",
      "OmniStrihu']",
    ];
    for (const needle of forbidden) {
      expect([needle, index.includes(needle)]).toEqual([needle, false]);
    }
  });

  test("obrazové metriky sa počítajú z pixelov (index používa frameMetrics)", () => {
    const index = readCode("src/core/media/mediaIntelligenceIndex.ts");
    expect(index.includes("frameMetricsFromPixels")).toBe(true);
    expect(index.includes("detectSceneBoundaries")).toBe(true);
    expect(index.includes("getFrameAtTime")).toBe(true);
  });

  test("directorTools priznávajú kvalitu dát (scény, snímky, prepis)", () => {
    const tools = readCode("src/ai/director/directorTools.ts");
    expect(tools.includes("quality")).toBe(true);
    expect(tools.includes("reasonSk")).toBe(true);
    expect(tools.includes("dataQuality?.scene_boundaries")).toBe(true);
    expect(tools.includes("dataQuality?.representative_frames")).toBe(true);
    expect(tools.includes("dataQuality?.transcript")).toBe(true);
  });
});

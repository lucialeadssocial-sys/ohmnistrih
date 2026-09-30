/**
 * Testy: MERANIE REFERENČNÉHO VIDEA (krok 12).
 *
 * Strážia tri veci:
 *  A) strihy a dĺžky záberov sa počítajú správne (vrátane zlúčenia blízkych strihov),
 *  B) agregácia snímok a palety nemeria jednu snímku namiesto celého videa,
 *  C) recept **nepredstiera**, čo sa zmerať nedá (podiel rečníka, text titulkov)
 *     — a hodnoty, ktoré recept používa, sedia na namerané čísla.
 */

import { describe, expect, test } from "bun:test";
import {
  aggregateFrameAnalyses,
  medianOf,
  mergePalettes,
  motionBetweenFrames,
  normalizeCutTimes,
  shotLengths,
  shotStatsFromCuts,
  summarizeVideos,
  videoStyleHints,
  type VideoAggregate,
} from "../src/core/style/referenceVideoStats";
import { analyzeReferencePixels, type ReferenceAnalysisOutcome } from "../src/core/style/referencePixels";
import { STYLE_RECIPES, STYLE_PRESET_IDS, getStyleRecipe } from "../src/core/style/styleRecipes";

// ---------------------------------------------------------------------------
// A) strihy
// ---------------------------------------------------------------------------

describe("A) strihy a dĺžky záberov", () => {
  test("blízke strihy sa zlúčia (inak vznikne falošný 0,02 s záber)", () => {
    const { times, merged } = normalizeCutTimes([2.0, 2.02, 5.0]);
    expect(times).toEqual([2.0, 5.0]);
    expect(merged).toBe(1);
  });

  test("zlúčenie rešpektuje vlastnú hranicu", () => {
    const { times } = normalizeCutTimes([1.0, 1.4], 0.25);
    expect(times).toEqual([1.0, 1.4]);
  });

  test("nezmyselné časy (NaN, záporné) sa zahodia", () => {
    const { times } = normalizeCutTimes([Number.NaN, -3, 4.5]);
    expect(times).toEqual([4.5]);
  });

  test("dĺžky záberov pokrývajú celé video (od 0 po koniec)", () => {
    const lengths = shotLengths([3, 7], 10);
    expect(lengths).toEqual([3, 4, 3]);
    expect(lengths.reduce((a, b) => a + b, 0)).toBeCloseTo(10, 6);
  });

  test("bez strihov je celé video jeden záber", () => {
    expect(shotLengths([], 12.5)).toEqual([12.5]);
  });

  test("štatistika: tempo, medián a podiely času", () => {
    const s = shotStatsFromCuts([2, 4, 6, 8], 10);
    expect(s.cutCount).toBe(4);
    expect(s.cutsPerSecond).toBeCloseTo(0.4, 2);
    expect(s.medianShotSec).toBeCloseTo(2, 2);
    expect(s.meanShotSec).toBeCloseTo(2, 2);
    // všetky zábery majú presne 2 s → ani krátke (≤1,2), ani dlhé (≥2,5)
    expect(s.shortShare).toBe(0);
    expect(s.longShare).toBe(0);
  });

  test("podiel je podiel ČASU, nie počtu záberov", () => {
    // 1 krátky (0,5 s) + 1 dlhý (9,5 s): počet 50/50, čas 5 % / 95 %
    const s = shotStatsFromCuts([0.5], 10);
    expect(s.shortShare).toBeCloseTo(0.05, 2);
    expect(s.longShare).toBeCloseTo(0.95, 2);
  });

  test("jeden 25 s záber bez strihu = 100 % dlhých, 0 rezov/s", () => {
    const s = shotStatsFromCuts([], 25.19);
    expect(s.cutsPerSecond).toBe(0);
    expect(s.longShare).toBe(1);
    expect(s.medianShotSec).toBeCloseTo(25.19, 2);
  });

  test("nulové trvanie nezblázni tempo (delí sa nulou → 0)", () => {
    expect(shotStatsFromCuts([1, 2], 0).cutsPerSecond).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// B) snímky a paleta
// ---------------------------------------------------------------------------

function solidFrame(width: number, height: number, rgb: [number, number, number]): Uint8ClampedArray {
  const px = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < px.length; i += 4) {
    px[i] = rgb[0];
    px[i + 1] = rgb[1];
    px[i + 2] = rgb[2];
    px[i + 3] = 255;
  }
  return px;
}

describe("B) dynamika, agregácia, paleta", () => {
  test("dva rovnaké vzorky = žiadny pohyb", () => {
    const w = 8;
    const h = 8;
    const frame = solidFrame(w, h, [120, 120, 120]);
    const two = new Uint8ClampedArray([...frame, ...frame]);
    const m = motionBetweenFrames(two, w, h, 2, 2);
    expect(m.perSecond).toBe(0);
    expect(m.calmShare).toBe(1);
    expect(m.samples).toBe(1);
  });

  test("zmena jasu sa prepočíta na sekundu podľa vzorkovacej frekvencie", () => {
    const w = 4;
    const h = 4;
    const a = solidFrame(w, h, [100, 100, 100]);
    const b = solidFrame(w, h, [110, 110, 110]);
    const two = new Uint8ClampedArray([...a, ...b]);
    const m2 = motionBetweenFrames(two, w, h, 2, 2);
    const m1 = motionBetweenFrames(two, w, h, 2, 1);
    expect(m2.perSecond).toBeCloseTo(20, 1); // 10 úrovní × 2 vzorky/s
    expect(m1.perSecond).toBeCloseTo(10, 1);
  });

  test("jediná vzorka nemá s čím porovnať — nehlási pohyb", () => {
    const m = motionBetweenFrames(solidFrame(4, 4, [50, 50, 50]), 4, 4, 1, 2);
    expect(m.perSecond).toBe(0);
    expect(m.samples).toBe(0);
  });

  test("agregácia spriemeruje vzorky a spočíta svetlý spodok", () => {
    const w = 6;
    const h = 9;
    const dark = analyzeReferencePixels(solidFrame(w, h, [10, 10, 10]), w, h);
    const bright = analyzeReferencePixels(solidFrame(w, h, [240, 240, 240]), w, h);
    const agg = aggregateFrameAnalyses([dark, bright]);
    expect(agg.frameCount).toBe(2);
    expect(agg.usableFrames).toBe(2);
    expect(agg.brightness).toBeCloseTo(125, 0);
    // jednofarebná vzorka nemá svetlejší spodok (všetky pásma sú rovnaké)
    expect(agg.bottomBandBrightShare).toBe(0);
  });

  test("keď sa nezmerala ani jedna vzorka, agregát to prizná", () => {
    const agg = aggregateFrameAnalyses([]);
    expect(agg.usableFrames).toBe(0);
    expect(agg.moodSk).toContain("nedá sa popísať");
  });

  test("paleta sa spriemeruje cez VŠETKY vzorky, nie len tie s farbou", () => {
    const merged = mergePalettes([
      [{ hex: "#112233", coverage: 0.5 }],
      [{ hex: "#112233", coverage: 0.1 }],
      [], // vzorka bez palety
    ]);
    const color = merged.find((c) => c.hex === "#112233")!;
    expect(color.coverage).toBeCloseTo(0.2, 3); // (0,5 + 0,1 + 0) / 3
    expect(color.frameShare).toBeCloseTo(0.667, 2); // v 2 z 3 vzoriek
  });

  test("farba z okamihu je označená ako menej častá (podiel vzoriek to prizná)", () => {
    // Zámerne: pokrytie je priemer cez všetky vzorky, takže veľký farebný záblesk
    // v jednej vzorke môže mať vyššie pokrytie — ale `frameShare` povie, že je
    // len v jednej vzorke. Presne preto paletu nerobí jediný záber.
    const merged = mergePalettes([
      [{ hex: "#AAAAAA", coverage: 0.4 }],
      [{ hex: "#AAAAAA", coverage: 0.4 }],
      [{ hex: "#FF00FF", coverage: 0.9 }],
    ]);
    const grey = merged.find((c) => c.hex === "#AAAAAA")!;
    const flash = merged.find((c) => c.hex === "#FF00FF")!;
    expect(grey.frameShare).toBeCloseTo(0.667, 2);
    expect(flash.frameShare).toBeCloseTo(0.333, 2);
    expect(grey.frameShare).toBeGreaterThan(flash.frameShare);
    expect(grey.coverage).toBeCloseTo(0.267, 2); // (0,4 + 0,4 + 0) / 3
  });

  test("šum pod 0,5 % pokrytia sa do palety videa nedostane", () => {
    const merged = mergePalettes([[{ hex: "#000001", coverage: 0.001 }]]);
    expect(merged).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// C) poctivosť + recept stojí na nameraných číslach
// ---------------------------------------------------------------------------

function fakeAggregate(over: Partial<VideoAggregate> = {}): VideoAggregate {
  const base: VideoAggregate = {
    frameCount: 10,
    usableFrames: 10,
    brightness: 73,
    contrast: 56,
    saturation: 0.22,
    warmth: 5,
    edgeDensity: 0.023,
    darkRatio: 0.4,
    midRatio: 0.4,
    lightRatio: 0.2,
    bands: [80, 70, 60],
    bottomBandBrightShare: 0,
    accent: null,
    moodSk: "test",
  };
  return { ...base, ...over };
}

describe("C) poctivosť merania (žiadne predstieranie)", () => {
  test("podiel rečníka sa NEmeria — hlásenia to hovoria jasne", () => {
    const shot = shotStatsFromCuts([], 25);
    const hints = videoStyleHints(shot, fakeAggregate(), {
      perSecond: 12,
      p90: 4,
      calmShare: 0.5,
      samples: 10,
    });
    expect(hints.hintsSk.join(" ")).toContain("NIE podiel rečníka");
    expect(hints.notDetectableSk.join(" ")).toContain("detektora tvárí");
    expect(hints.longTakeRatio).toBe(1);
  });

  test("text titulkov sa netvrdí — len svetlosť pásma", () => {
    const hints = videoStyleHints(shotStatsFromCuts([], 10), fakeAggregate(), {
      perSecond: 0,
      p90: 0,
      calmShare: 1,
      samples: 5,
    });
    expect(hints.notDetectableSk.join(" ")).toContain("titul");
  });

  test("tempo sa pomenuje podľa nameraných rezov", () => {
    const fast = videoStyleHints(shotStatsFromCuts([0.5, 1, 1.5, 2, 2.5], 3), fakeAggregate(), {
      perSecond: 40,
      p90: 9,
      calmShare: 0.1,
      samples: 6,
    });
    expect(fast.tempoSk).toContain("veľmi rýchly");
    const none = videoStyleHints(shotStatsFromCuts([], 25), fakeAggregate(), {
      perSecond: 12,
      p90: 4,
      calmShare: 0.5,
      samples: 10,
    });
    expect(none.tempoSk).toContain("bez strihov");
  });

  test("súhrn berie medián — jeden klip neprebije ostatné", () => {
    const shot = (cps: number, median: number) => ({
      ...shotStatsFromCuts([], 10),
      cutsPerSecond: cps,
      medianShotSec: median,
    });
    const summary = summarizeVideos([
      { durationSec: 10, shot: shot(0, 25), aggregate: fakeAggregate(), motion: { perSecond: 12, p90: 4, calmShare: 1, samples: 5 }, palette: [] },
      { durationSec: 10, shot: shot(0.1, 9), aggregate: fakeAggregate(), motion: { perSecond: 20, p90: 6, calmShare: 0.8, samples: 5 }, palette: [] },
      { durationSec: 10, shot: shot(3, 0.3), aggregate: fakeAggregate(), motion: { perSecond: 400, p90: 90, calmShare: 0, samples: 5 }, palette: [] },
    ]);
    expect(summary.medianCutsPerSecond).toBe(0.1);
    expect(summary.medianShotSec).toBe(9);
    expect(summary.medianMotionPerSecond).toBe(20);
    expect(summary.totalDurationSec).toBe(30);
  });

  test("farba je „stála“ len keď je aspoň v polovici videí", () => {
    const summary = summarizeVideos([
      { durationSec: 1, shot: shotStatsFromCuts([], 1), aggregate: fakeAggregate(), motion: { perSecond: 0, p90: 0, calmShare: 1, samples: 1 }, palette: [{ hex: "#111111", coverage: 0.3, frameShare: 1 }] },
      { durationSec: 1, shot: shotStatsFromCuts([], 1), aggregate: fakeAggregate(), motion: { perSecond: 0, p90: 0, calmShare: 1, samples: 1 }, palette: [{ hex: "#111111", coverage: 0.2, frameShare: 1 }] },
      { durationSec: 1, shot: shotStatsFromCuts([], 1), aggregate: fakeAggregate(), motion: { perSecond: 0, p90: 0, calmShare: 1, samples: 1 }, palette: [{ hex: "#222222", coverage: 0.5, frameShare: 1 }] },
    ]);
    const shared = summary.sharedPalette.map((c) => c.hex);
    const occasional = summary.occasionalPalette.map((c) => c.hex);
    expect(shared).toContain("#111111"); // v 2 z 3 videí
    expect(shared).not.toContain("#222222");
    expect(occasional).toContain("#222222");
  });

  test("prázdny súhrn nič nevymýšľa", () => {
    const summary = summarizeVideos([]);
    expect(summary.videoCount).toBe(0);
    expect(summary.sharedPalette).toHaveLength(0);
  });

  test("medián sa počíta správne pre párny aj nepárny počet", () => {
    expect(medianOf([3, 1, 2])).toBe(2);
    expect(medianOf([4, 1, 3, 2])).toBe(2.5);
    expect(medianOf([])).toBe(0);
  });
});

describe("C2) recept AI_CINEMATIC_TAKE stojí na nameraných číslach", () => {
  const recipe = STYLE_RECIPES.AI_CINEMATIC_TAKE;

  test("je v ponuke ako 14. recept", () => {
    expect(STYLE_PRESET_IDS).toHaveLength(14);
    expect(STYLE_PRESET_IDS).toContain("AI_CINEMATIC_TAKE");
    expect(getStyleRecipe("ai_cinematic_take").id).toBe("AI_CINEMATIC_TAKE");
  });

  test("drží namerané tempo: žiadny švih, žiadny rýchly zoom, strih je výnimka", () => {
    expect(recipe.camera.fastZoom).toBe(false);
    expect(recipe.camera.whipPan).toBe("none");
    expect(recipe.camera.punchIn).toBe(false);
    expect(recipe.transitionStyle.base).toBe("cut");
    expect(recipe.transitionStyle.accent).toBe("none");
    expect(recipe.motionPool).toEqual(["subtle_zoom"]);
  });

  test("titulky sú potichu — nameraný svetlý spodok bol len v 1 zo 6 klipov", () => {
    expect(recipe.captionStyle.styleId).toBe("MINIMAL");
    expect(recipe.captionStyle.rationaleSk).toContain("1 zo 6");
  });

  test("používa len tie prvky, ktoré sa naozaj namerali (b-roll, bez koláže)", () => {
    expect(recipe.aesthetic.elementPool).toContain("b_roll");
    expect(recipe.aesthetic.elementPool).not.toContain("paper_element");
    expect(recipe.aesthetic.halftone).toBe(false);
    expect(recipe.composition.primary).toBe("full_screen");
  });

  test("priznáva, že paleta nie je zdieľaná a pomery nie sú z merania", () => {
    const text = `${recipe.whySk} ${recipe.requiresSk} ${recipe.captionStyle.rationaleSk}`;
    expect(text).toContain("0,14 rezu/s");
    expect(recipe.requiresSk).toContain("nie z merania");
    expect(recipe.requiresSk).toContain("detektora tvárí");
    expect(recipe.colorPalette).toEqual(["#0A070B", "#4A3123", "#6F869D", "#E8E3DD"]);
  });

  test("recept nemení zvuk ani nič nesľubuje o AI videu", () => {
    const json = JSON.stringify(recipe).toLowerCase();
    expect(json).not.toContain("vygeneruje video");
    expect(recipe.requiresSk).toContain("video negeneruje");
  });

  test("referenčné recepty z kliet ostávajú nezmenené (regresia)", () => {
    // Regresia: nový recept nesmie ticho prepísať staré referenčné recepty.
    expect(STYLE_RECIPES.AI_CARD_DEMO.captionStyle.styleId).toBe("MINIMAL");
    expect(STYLE_RECIPES.FILM_MONTAGE.camera.fastZoom).toBe(true);
    expect(STYLE_RECIPES.EXPERT_COLLAGE_TALK.composition.primary).toBe("layered_collage");
  });

  test("všetky recepty majú namerané alebo zdrojom podložené čísla (kontrola tvaru)", () => {
    const outcome: ReferenceAnalysisOutcome = analyzeReferencePixels(
      solidFrame(8, 8, [90, 90, 90]),
      8,
      8,
    );
    expect(outcome.available).toBe(true);
    for (const id of STYLE_PRESET_IDS) {
      const r = STYLE_RECIPES[id];
      expect(r.talkingHeadRatio + r.supportingVisualRatio).toBeCloseTo(1, 3);
    }
  });
});

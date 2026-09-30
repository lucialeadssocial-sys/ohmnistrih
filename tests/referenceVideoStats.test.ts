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
  contentAreaFromCrop,
  hexToRgb,
  medianOf,
  mergePalettes,
  motionBetweenFrames,
  normalizeCutTimes,
  parseCropDetect,
  parseFfmpegProbe,
  pickVideoAccent,
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

  test("je v ponuke vedľa receptu z TikToku", () => {
    expect(STYLE_PRESET_IDS).toHaveLength(15);
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

// ---------------------------------------------------------------------------
// D) čítanie ffmpeg výpisu — trieda chýb, ktorá sa už nesmie vrátiť
// ---------------------------------------------------------------------------

describe("D) čítanie ffmpeg výpisu (video stopa, pruhy, akcent)", () => {
  const tikTokStyle = `Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'x.mp4':
  Duration: 00:00:45.51, start: 0.000000, bitrate: 1442 kb/s
  Stream #0:0[0x1](und): Audio: aac (HE-AACv2) (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 32 kb/s (default)
  Stream #0:1[0x2](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(tv, bt709), 576x1024 [SAR 1:1 DAR 9:16], 1404 kb/s, 30 fps, 30 tbr`;

  test("nájde VIDEO stopu, aj keď je až druhá (TikTok: audio #0:0, video #0:1)", () => {
    const p = parseFfmpegProbe(tikTokStyle);
    expect(p.videoStreamNumber).toBe(1);
    expect(p.width).toBe(576);
    expect(p.height).toBe(1024);
    expect(p.fps).toBe(30);
    expect(p.durationSec).toBeCloseTo(45.51, 2);
  });

  test("bežné poradie (video prvé) funguje tiež", () => {
    const p = parseFfmpegProbe(`  Duration: 00:00:12.00, start: 0.000000
  Stream #0:0: Video: h264, yuv420p, 1280x720, 25 fps
  Stream #0:1: Audio: aac, 44100 Hz`);
    expect(p.videoStreamNumber).toBe(0);
    expect(p.width).toBe(1280);
    expect(p.height).toBe(720);
    expect(p.fps).toBe(25);
  });

  test("keď rozmery vo výpise nie sú, vráti nuly (a volajúci to musí vyriešiť inak)", () => {
    const p = parseFfmpegProbe("  Stream #0:0: Audio: aac, 44100 Hz");
    expect(p.width).toBe(0);
    expect(p.height).toBe(0);
    expect(p.videoStreamNumber).toBeNull();
  });

  test("cropdetect: berie sa POSLEDNÝ návrh (ffmpeg ho spresňuje)", () => {
    const crop = parseCropDetect("crop=576:1024:0:0\ncrop=508:642:34:190\ncrop=508:642:34:190\n");
    expect(crop).toEqual({ width: 508, height: 642, x: 34, y: 190 });
  });

  test("cropdetect bez návrhu = null (nedá sa posúdiť)", () => {
    expect(parseCropDetect("no crop here")).toBeNull();
  });

  test("zapečené pruhy sa vyrežú a veľkosť sa zaokrúhli na párne", () => {
    const area = contentAreaFromCrop({ width: 507, height: 641, x: 35, y: 191 }, 576, 1024);
    expect(area).not.toBeNull();
    expect(area!.width % 2).toBe(0);
    expect(area!.height % 2).toBe(0);
    expect(area!.x % 2).toBe(0);
    expect(area!.y % 2).toBe(0);
    expect(area!.letterboxShare).toBeGreaterThan(0.3);
  });

  test("okraj do 2 % sa neorezáva (nechceme rezať 1–2 px)", () => {
    expect(contentAreaFromCrop({ width: 574, height: 1020, x: 1, y: 2 }, 576, 1024)).toBeNull();
  });

  test("keď by vyrezanie zobralo väčšinu rámu, radšej nič (nie sú to pruhy)", () => {
    expect(contentAreaFromCrop({ width: 300, height: 300, x: 100, y: 100 }, 576, 1024)).toBeNull();
  });

  test("plný rám = žiadne pruhy", () => {
    expect(contentAreaFromCrop({ width: 576, height: 1024, x: 0, y: 0 }, 576, 1024)).toBeNull();
  });

  test("akcent videa sa berie z palety videa a nesie pokrytie z celého videa", () => {
    const accent = pickVideoAccent([
      { hex: "#7D5F55", coverage: 0.053, frameShare: 0.6 },
      { hex: "#0E0E17", coverage: 0.129, frameShare: 1 },
    ])!;
    expect(accent.hex).toBe("#7D5F55");
    expect(accent.coverage).toBeCloseTo(0.053, 3);
    expect(accent.frameShare).toBeCloseTo(0.6, 3);
  });

  test("skoro-čierna farba nie je akcent (rovnaké pravidlo ako pri snímke)", () => {
    expect(pickVideoAccent([{ hex: "#110D0B", coverage: 0.66, frameShare: 1 }])).toBeNull();
  });

  test("hex → rgb funguje a nezmysel vráti null", () => {
    expect(hexToRgb("#FAC918")).toEqual({ r: 250, g: 201, b: 24 });
    expect(hexToRgb("fac918")).toEqual({ r: 250, g: 201, b: 24 });
    expect(hexToRgb("#GGG")).toBeNull();
  });

  test("tempo sa nemení tým, že video má audio stopu prvú (regresia)", () => {
    const p = parseFfmpegProbe(tikTokStyle);
    const stats = shotStatsFromCuts([2, 6], p.durationSec);
    expect(stats.cutsPerSecond).toBeCloseTo(0.04, 2);
    expect(stats.cutCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// E) recept z TikToku (EDU_WORD_TALK) — stojí na nameraných číslach skupiny
// ---------------------------------------------------------------------------

describe("E) recept EDU_WORD_TALK stojí na meraní 6 klipov z TikToku", () => {
  const recipe = STYLE_RECIPES.EDU_WORD_TALK;

  test("je v ponuke ako 15. recept", () => {
    expect(STYLE_PRESET_IDS).toHaveLength(15);
    expect(STYLE_PRESET_IDS).toContain("EDU_WORD_TALK");
    expect(getStyleRecipe("edu_word_talk").id).toBe("EDU_WORD_TALK");
  });

  test("titulky idú po jednom slove — naraz maximálne jeden text", () => {
    // Namerané zo snímok: v jeho klipoch je vždy len jedno slovo.
    expect(recipe.typography.maxElementsPerScene).toBe(1);
    expect(recipe.captionStyle.styleId).toBe("KARAOKE");
  });

  test("tempo zostáva pokojné (0,15 rezu/s v meraní) — žiadne švihy ani rýchly zoom", () => {
    expect(recipe.camera.fastZoom).toBe(false);
    expect(recipe.camera.whipPan).toBe("none");
    expect(recipe.camera.punchIn).toBe(true);
    expect(recipe.camera.punchInScale).toBeLessThan(1.15);
    expect(recipe.motionPool).not.toContain("whip_transition");
  });

  test("používa vložené ilustrácie a screenshoty, nie koláž", () => {
    expect(recipe.aesthetic.elementPool).toContain("illustration");
    expect(recipe.aesthetic.elementPool).toContain("existing_media");
    expect(recipe.aesthetic.elementPool).not.toContain("paper_element");
    expect(recipe.aesthetic.halftone).toBe(false);
    expect(recipe.composition.primary).toBe("full_screen");
  });

  test("paleta je označená ako občasná, nie ako jeho pravidlo", () => {
    expect(recipe.colorPalette).toEqual(["#FCF8FC", "#110D11", "#FEC903", "#4A6C56"]);
    // Biela, takmer čierna, žltá (v 1 zo 6 klipov) a zelená — žiadna nie je zdieľaná.
    const text = `${recipe.whySk} ${recipe.requiresSk}`.toLowerCase();
    expect(text).toContain("detektora tvárí");
    expect(text).toContain("real export");
  });

  test("priznáva, že krok slova nie je meraný a že AI negeneruje ilustrácie", () => {
    const text = `${recipe.requiresSk} ${recipe.captionStyle.rationaleSk}`;
    expect(text).toContain("negeneruje");
    expect(text).toContain("real export");
  });

  test("regresia: recept z IG (krok 12) zostal bez zmeny", () => {
    expect(STYLE_RECIPES.AI_CINEMATIC_TAKE.captionStyle.styleId).toBe("MINIMAL");
    expect(STYLE_RECIPES.AI_CINEMATIC_TAKE.requiresSk).toContain("video negeneruje");
  });
});

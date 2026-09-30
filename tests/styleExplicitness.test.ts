import { describe, expect, test } from "bun:test";
import {
  STYLE_PILLAR_IDS,
  STYLE_PILLAR_ORDER_SK,
  auditStyleExplicitness,
  describeControlChangeSk,
  explicitnessLineSk,
  stylePillarLabelSk,
  stylePillarOriginSk,
} from "../src/core/style/styleExplicitness";
import { STYLE_RECIPES, STYLE_PRESET_IDS, getStyleRecipe } from "../src/core/style/styleRecipes";
import { buildStylePlan } from "../src/core/style/styleIntelligence";
import type { SpeechSegmentLike } from "../src/core/transcript/wordTiming";

/**
 * Krok 15 — „nič nenechaj modelu na domyslenie" (jeho pravidlo zo videa „Prečo práve 10:10?").
 *
 * POZOR (reporting): toto je **unit-test verification**. Neznamená, že to beží
 * v prehliadači na reálnom videu ani že to niekto videl v UI.
 */

const NOW = 1759219200000;

const FIXTURE: SpeechSegmentLike[] = [
  {
    start: 0.2,
    end: 3.1,
    text: "Dnes ti ukážem trik, ktorý mi ušetrí hodiny.",
    words: [
      { word: "Dnes", start: 0.2, end: 0.5 },
      { word: "ti", start: 0.5, end: 0.65 },
      { word: "ukážem", start: 0.65, end: 1.1 },
      { word: "trik", start: 1.12, end: 1.5 },
      { word: "ktorý", start: 1.55, end: 1.85 },
      { word: "mi", start: 1.85, end: 2.0 },
      { word: "ušetrí", start: 2.0, end: 2.6 },
      { word: "hodiny", start: 2.62, end: 3.1 },
    ],
  },
];

/** Referenčné meranie (reálne čísla z jeho videí) — pre testy, kde netreba súbory. */
const MERANE_SVETLO = {
  brightness: 114.04,
  contrast: 55.8,
  sourceSk: "analyza-tiktok.json, medián cez 12 jeho tiktokov",
};

function pillar(report: ReturnType<typeof auditStyleExplicitness>, id: string) {
  const found = report.pillars.find((p) => p.id === id);
  if (!found) throw new Error(`pilier ${id} chýba`);
  return found;
}

// ---------------------------------------------------------------------------
// A) Svetlo — jediný pilier, ktorý dnes nemá žiadny recept ako číslo (okrem meraných)
// ---------------------------------------------------------------------------

describe("A) pilier svetlo", () => {
  test("bez merania a bez nameraného receptu → doplní appka (a pomenuje to)", () => {
    const r = auditStyleExplicitness({ recipe: "EDITORIAL_COLLAGE" });
    const p = pillar(r, "svetlo");
    expect(p.origin).toBe("app_default");
    expect(p.originSk).toBe("doplní appka (default)");
    expect(p.noteSk).toContain("domyslel");
  });

  test("s nameraným svetlom → meranie, čísla s desatinnou čiarkou", () => {
    const r = auditStyleExplicitness({ recipe: "EDITORIAL_COLLAGE", measuredLight: MERANE_SVETLO });
    const p = pillar(r, "svetlo");
    expect(p.origin).toBe("measurement");
    expect(p.valueSk).toContain("jas 114,0");
    expect(p.valueSk).toContain("kontrast 55,8");
    expect(p.valueSk).toContain("analyza-tiktok.json");
  });

  test("recept AI_CINEMATIC_TAKE nesie namerané svetlo z jeho IG klipov", () => {
    const r = auditStyleExplicitness({ recipe: "AI_CINEMATIC_TAKE" });
    const p = pillar(r, "svetlo");
    expect(p.origin).toBe("measurement");
    expect(p.valueSk).toContain("87,5");
    expect(p.valueSk).toContain("analyza-videa.json");
  });

  test("recept EDU_WORD_TALK nesie namerané svetlo z jeho tiktokov", () => {
    const r = auditStyleExplicitness({ recipe: "EDU_WORD_TALK" });
    expect(pillar(r, "svetlo").valueSk).toContain("analyza-tiktok.json");
  });

  test("parameter prebije to, čo nesie recept", () => {
    const r = auditStyleExplicitness({ recipe: "EDU_WORD_TALK", measuredLight: { brightness: 10, contrast: 20, sourceSk: "test" } });
    const p = pillar(r, "svetlo");
    expect(p.valueSk).toContain("jas 10,0");
    expect(p.valueSk).toContain("(test)");
  });

  test("nezmyselné čísla (NaN) appka nesmie vydávať za meranie", () => {
    const r = auditStyleExplicitness({
      recipe: "EDITORIAL_COLLAGE",
      measuredLight: { brightness: Number.NaN, contrast: 50, sourceSk: "test" },
    });
    expect(pillar(r, "svetlo").origin).toBe("app_default");
  });
});

// ---------------------------------------------------------------------------
// B) Kompozícia — má ju každý recept (a je v nej aj počet vrstiev a kamera)
// ---------------------------------------------------------------------------

describe("B) pilier kompozícia", () => {
  test("všetkých 15 receptov má kompozíciu z receptu (nie default)", () => {
    for (const id of STYLE_PRESET_IDS) {
      const r = auditStyleExplicitness({ recipe: id });
      const p = pillar(r, "kompozicia");
      expect(p.origin).toBe("recipe");
      expect(p.valueSk.length).toBeGreaterThan(10);
      expect(p.valueSk).toContain("vrstv");
    }
  });

  test("EDU_WORD_TALK má v hodnote aj punch-in s číslom", () => {
    const r = auditStyleExplicitness({ recipe: "EDU_WORD_TALK" });
    expect(pillar(r, "kompozicia").valueSk).toContain("punch-in ×1,08");
  });

  test("AI_CINEMATIC_TAKE prizná, že punch-in nemá", () => {
    const r = auditStyleExplicitness({ recipe: "AI_CINEMATIC_TAKE" });
    expect(pillar(r, "kompozicia").valueSk).toContain("bez punch-in");
    expect(pillar(r, "kompozicia").valueSk).toContain("bez švihov");
  });
});

// ---------------------------------------------------------------------------
// C) Farby
// ---------------------------------------------------------------------------

describe("C) pilier farby", () => {
  test("bez merania ich nesie recept", () => {
    const r = auditStyleExplicitness({ recipe: "EDITORIAL_COLLAGE" });
    const p = pillar(r, "farby");
    expect(p.origin).toBe("recipe");
    expect(p.valueSk).toContain("#");
  });

  test("namerané farby prebijú recept a sú veľkými písmenami", () => {
    const r = auditStyleExplicitness({ recipe: "EDITORIAL_COLLAGE", measuredPalette: ["#e9e4df", "#110d11", "#fec903"] });
    const p = pillar(r, "farby");
    expect(p.origin).toBe("measurement");
    expect(p.valueSk).toContain("#E9E4DF");
    expect(p.valueSk).toContain("#FEC903");
  });

  test("jedna farba nie je paleta → ostáva recept", () => {
    const r = auditStyleExplicitness({ recipe: "EDITORIAL_COLLAGE", measuredPalette: ["#ffffff"] });
    expect(pillar(r, "farby").origin).toBe("recipe");
  });

  test("poznámka k nameranej palete sa pridá (napr. že sa neopakuje)", () => {
    const r = auditStyleExplicitness({
      recipe: "AI_CINEMATIC_TAKE",
      measuredPalette: ["#000000", "#E9E3DD"],
      measuredPaletteNoteSk: "Paleta sa medzi klipmi NEopakuje.",
    });
    expect(pillar(r, "farby").noteSk).toContain("NEopakuje");
  });

  test("recept bez palety → farby by si domyslel model", () => {
    const recipe = { ...getStyleRecipe("MINIMAL"), colorPalette: [] };
    const r = auditStyleExplicitness({ recipe });
    const p = pillar(r, "farby");
    expect(p.origin).toBe("app_default");
    expect(p.noteSk).toContain("domyslel");
  });
});

// ---------------------------------------------------------------------------
// D) Celkový štýl
// ---------------------------------------------------------------------------

describe("D) pilier celkový štýl", () => {
  test("bez zásahu používateľa ho nesie recept", () => {
    const r = auditStyleExplicitness({ recipe: "EDITORIAL_COLLAGE" });
    const p = pillar(r, "styl");
    expect(p.origin).toBe("recipe");
    expect(p.valueSk).toContain("textúra");
    expect(p.valueSk).toContain("typografia");
  });

  test("keď si textúru zmeníš, je to tvoje nastavenie", () => {
    const r = auditStyleExplicitness({ recipe: "EDITORIAL_COLLAGE", controls: { texture: "clean" } });
    const p = pillar(r, "styl");
    expect(p.origin).toBe("user");
    expect(p.valueSk).toContain("Textúra: clean");
  });

  test("rovnaká hodnota ako default sa NESMIE vydávať za tvoje rozhodnutie", () => {
    const r = auditStyleExplicitness({ recipe: "EDITORIAL_COLLAGE", controls: { texture: "editorial" } });
    expect(pillar(r, "styl").origin).toBe("recipe");
  });

  test("zmena intenzity sa počíta", () => {
    const r = auditStyleExplicitness({ recipe: "MINIMAL", controls: { intensity: "aggressive" } });
    expect(pillar(r, "styl").origin).toBe("user");
    expect(pillar(r, "styl").valueSk).toContain("Intenzita: aggressive");
  });
});

// ---------------------------------------------------------------------------
// E) Verdikt a otvorené piliere
// ---------------------------------------------------------------------------

describe("E) verdikt", () => {
  test("bez merania: 3 zo 4 podložené, otvorené je svetlo", () => {
    const r = auditStyleExplicitness({ recipe: "EDITORIAL_COLLAGE" });
    expect(r.coveredCount).toBe(3);
    expect(r.openCount).toBe(1);
    expect(r.openToModelSk.length).toBe(1);
    expect(r.openToModelSk[0]).toContain("svetlo");
    expect(r.verdictSk).toContain("3 zo 4");
  });

  test("s nameraným svetlom: 4 zo 4 a model nemá čo domýšľať", () => {
    const r = auditStyleExplicitness({ recipe: "EDITORIAL_COLLAGE", measuredLight: MERANE_SVETLO });
    expect(r.coveredCount).toBe(4);
    expect(r.openCount).toBe(0);
    expect(r.verdictSk).toContain("nemá čo domýšľať");
    expect(r.closeGapsSk.length).toBe(0);
  });

  test("medzera má vždy konkrétny krok (nie „zlepši prompt“)", () => {
    const r = auditStyleExplicitness({ recipe: "EDITORIAL_COLLAGE" });
    expect(r.closeGapsSk.length).toBe(1);
    const gap = r.closeGapsSk[0];
    expect(gap.includes("analyzeReferencePixels") || gap.includes("analyzeMoodboard")).toBe(true);
    expect(gap.toLowerCase()).not.toContain("zlepši prompt");
  });

  test("čo appka doplní, je pomenované (nič ticho)", () => {
    const r = auditStyleExplicitness({ recipe: "EDITORIAL_COLLAGE" });
    expect(r.appFillsSk.length).toBe(1);
    expect(r.appFillsSk[0]).toContain("svetlo");
    expect(r.appFillsSk[0]).toContain("default");
  });

  test("štyri piliere sú presne tie, ktoré pomenúva on", () => {
    expect([...STYLE_PILLAR_IDS]).toEqual(["svetlo", "kompozicia", "farby", "styl"]);
    expect(STYLE_PILLAR_ORDER_SK).toEqual(["svetlo", "kompozícia", "farby", "celkový štýl"]);
    expect(stylePillarLabelSk("svetlo")).toBe("svetlo");
    expect(stylePillarOriginSk("app_default")).toContain("default");
  });
});

// ---------------------------------------------------------------------------
// F) Determininizmus (rovnaký vstup = rovnaký výstup, bez času a náhody)
// ---------------------------------------------------------------------------

describe("F) determinizmus", () => {
  test("dva rovnaké vstupy dajú bajtovo rovnaký report", () => {
    const a = auditStyleExplicitness({ recipe: "EDU_WORD_TALK", controls: { motion: "calm" }, measuredLight: MERANE_SVETLO });
    const b = auditStyleExplicitness({ recipe: "EDU_WORD_TALK", controls: { motion: "calm" }, measuredLight: MERANE_SVETLO });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("poradie kľúčov v ovládačoch nič nemení", () => {
    const a = auditStyleExplicitness({ recipe: "MINIMAL", controls: { motion: "calm", texture: "clean" } });
    const b = auditStyleExplicitness({ recipe: "MINIMAL", controls: { texture: "clean", motion: "calm" } });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("súhrnná veta pre UI je stabilná a má číslo", () => {
    const report = auditStyleExplicitness({ recipe: "AI_CINEMATIC_TAKE" });
    const line = explicitnessLineSk(report);
    expect(line).toContain("Kontrola štýlu: podložené 4/4");
    expect(line).not.toContain("undefined");
    expect(explicitnessLineSk(report)).toBe(line);
  });
});

// ---------------------------------------------------------------------------
// G) Štruktúra rečník / prvky (jeho 30/70) — odkiaľ to číslo je
// ---------------------------------------------------------------------------

describe("G) štruktúra", () => {
  test("tvoje číslo sa povie ako tvoje", () => {
    const r = auditStyleExplicitness({ recipe: "MINIMAL", controls: { talkingHeadRatio: 0.4 }, talkingHeadRatioFromPlan: 0.4 });
    expect(r.structureSk).toContain("Tvoje číslo: 40 %");
    expect(r.structureSk).toContain("60 % prvky");
  });

  test("keď si to nechal na engine, appka to nepovie ako svoje", () => {
    const r = auditStyleExplicitness({ recipe: "MINIMAL", talkingHeadRatioFromPlan: 0.3 });
    expect(r.structureSk).toContain("Nechal si to na engine");
    expect(r.structureSk).toContain("30 %");
    expect(r.structureSk).toContain("nie je to tvoje číslo");
  });

  test("bez plánu ani ovládačov je to neurčené", () => {
    const r = auditStyleExplicitness({ recipe: "MINIMAL" });
    expect(r.structureSk).toContain("nie je určený");
  });
});

// ---------------------------------------------------------------------------
// H) Jeho druhá metóda: „stačí zmeniť riadok v kóde" = zmena jedného ovládača
// ---------------------------------------------------------------------------

describe("H) zmena jedného ovládača", () => {
  test("bez zmeny: nič sa nemení", () => {
    const r = describeControlChangeSk({ intensity: "balanced" }, { intensity: "balanced" });
    expect(r.changedSk.length).toBe(0);
    expect(r.noteSk).toContain("Nič sa nezmenilo");
  });

  test("jedna zmena = jedna položka (nemusí sa generovať nanovo)", () => {
    const r = describeControlChangeSk({ intensity: "balanced", motion: "calm" }, { intensity: "balanced", motion: "dynamic" });
    expect(r.changedSk.length).toBe(1);
    expect(r.changedSk[0]).toContain("Motion");
    expect(r.noteSk).toContain("jednu vec");
  });

  test("viac zmien sa vypíše všetkých", () => {
    const r = describeControlChangeSk({ intensity: "subtle" }, { intensity: "aggressive", texture: "clean" });
    expect(r.changedSk.length).toBe(2);
    expect(r.noteSk).toContain("2 veci");
  });
});

// ---------------------------------------------------------------------------
// I) Neznámy recept — nesmie sa stať, že appka ticho použije niečo iné
// ---------------------------------------------------------------------------

describe("I) neznámy recept", () => {
  test("audit pobeží na základe a povie to", () => {
    const r = auditStyleExplicitness({ recipe: "NEEXISTUJE_TAKY_RECEPT" });
    expect(r.recipeId).toBe("EDITORIAL_COLLAGE");
    expect(r.notesSk.length).toBe(1);
    expect(r.notesSk[0]).toContain("NEEXISTUJE_TAKY_RECEPT");
  });

  test("známy recept nemá žiadnu takú poznámku", () => {
    expect(auditStyleExplicitness({ recipe: "MINIMAL" }).notesSk.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// J) Napojenie na plán (aby to nebolo API, ktoré nikto nevidí)
// ---------------------------------------------------------------------------

describe("J) plán to naozaj povie", () => {
  test("plán bez nameraného svetla prizná, čo by si model domyslel", () => {
    const plan = buildStylePlan({ segments: FIXTURE, recipe: "EDITORIAL_COLLAGE", now: NOW });
    const notes = plan.notesSk.join(" ");
    expect(notes).toContain("Kontrola štýlu:");
    expect(notes).toContain("Chýba pilier → Svetlo:");
  });

  test("recept s nameraným svetlom nemá v pláne žiadnu chýbajúcu pilier-poznámku", () => {
    const plan = buildStylePlan({ segments: FIXTURE, recipe: "EDU_WORD_TALK", now: NOW });
    const notes = plan.notesSk.join(" ");
    expect(notes).toContain("Kontrola štýlu: podložené 4/4");
    expect(notes).not.toContain("Chýba pilier");
  });

  test("plán nikdy netvrdí, že niečo zmeral, keď to nezmeral (žiadne fake čísla)", () => {
    const plan = buildStylePlan({ segments: FIXTURE, recipe: "EDITORIAL_COLLAGE", now: NOW });
    const notes = plan.notesSk.join(" ");
    // Svetlo nie je zmerané → v poznámkach sa nesmie objaviť žiadne číslo jasu
    // (samotné slovo „jas" je v návode, ako to zmerať — to je v poriadku).
    expect(/jas \d/.test(notes)).toBe(false);
    expect(notes).not.toContain("analýza-videa");
    expect(notes).not.toContain("analyza-videa");
    expect(notes).not.toContain("analyza-tiktok");
  });

  test("všetkých 15 receptov prejde auditom a plán sa vyrobí", () => {
    for (const id of STYLE_PRESET_IDS) {
      const report = auditStyleExplicitness({ recipe: id });
      expect(report.coveredCount).toBeGreaterThanOrEqual(3);
      const plan = buildStylePlan({ segments: FIXTURE, recipe: id, now: NOW });
      expect(plan.notesSk.join(" ")).toContain("Kontrola štýlu:");
    }
  });

  test("merané recepty majú v sebe zdroj čísel (dohľadateľnosť)", () => {
    for (const id of ["AI_CINEMATIC_TAKE", "EDU_WORD_TALK"] as const) {
      const recipe = STYLE_RECIPES[id];
      expect(recipe.measuredLight).toBeDefined();
      expect(recipe.measuredLight?.sourceSk).toContain("analyza-");
      expect(recipe.measuredLight?.brightness).toBeGreaterThan(0);
      expect(recipe.measuredLight?.contrast).toBeGreaterThan(0);
    }
  });

  test("ostatné recepty namerané svetlo nepredstierajú", () => {
    for (const id of STYLE_PRESET_IDS) {
      if (id === "AI_CINEMATIC_TAKE" || id === "EDU_WORD_TALK") continue;
      expect(STYLE_RECIPES[id].measuredLight).toBeUndefined();
    }
  });
});

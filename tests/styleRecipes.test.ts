import { describe, expect, test } from "bun:test";
import {
  STYLE_PRESET_IDS,
  STYLE_RECIPES,
  customRecipeFromBrief,
  getStyleRecipe,
  listStyleRecipes,
} from "../src/core/style/styleRecipes";
import { CAPTION_STYLES } from "../src/core/export/subtitleRender";
import { GENERATED_VISUALS_PROVIDER_AVAILABLE, DEFAULT_STYLE_CONTROLS } from "../src/core/style/styleDecisionTypes";

/**
 * A) Načítanie presetov a B) tvorba receptu — unit tested.
 * Zameriava sa na to, čo sa naozaj používa v engine: konzistentné pomery,
 * platné napojenie na existujúce štýly titulkov a deterministický vlastný brief.
 */

describe("A) načítanie presetov", () => {
  test("existuje presne 14 receptov a všetky ID sedia", () => {
    expect(STYLE_PRESET_IDS).toHaveLength(14);
    expect(Object.keys(STYLE_RECIPES)).toHaveLength(14);
    for (const id of STYLE_PRESET_IDS) {
      expect(getStyleRecipe(id).id).toBe(id);
    }
    expect(listStyleRecipes().map((r) => r.id)).toEqual([...STYLE_PRESET_IDS]);
  });

  test("zadanie žiada týchto 10 štýlov — a všetky sú naozaj prítomné", () => {
    for (const id of [
      "EDITORIAL_COLLAGE",
      "DOCUMENTARY",
      "MODERN_SOCIAL",
      "DARK_EDITORIAL",
      "KINETIC_TYPOGRAPHY",
      "MINIMAL",
      "CINEMATIC",
      "PODCAST_VISUAL",
      "UGC_PERFORMANCE",
      "CUSTOM",
    ] as const) {
      expect(getStyleRecipe(id).id).toBe(id);
    }
  });

  test("neznámy recept nespadne — vráti CUSTOM (a je to vidieť)", () => {
    expect(getStyleRecipe("NEEXISTUJE").id).toBe("CUSTOM");
    expect(getStyleRecipe("").id).toBe("CUSTOM");
  });

  test("pomery rečníka a vizuálov vždy sedia na 1", () => {
    for (const r of listStyleRecipes()) {
      expect(r.talkingHeadRatio + r.supportingVisualRatio).toBeCloseTo(1, 3);
      expect(r.visualStructure.talkingHeadRatio).toBe(r.talkingHeadRatio);
      expect(r.visualStructure.supportingVisualRatio).toBe(r.supportingVisualRatio);
      expect(r.talkingHeadRatio).toBeGreaterThanOrEqual(0.05);
      expect(r.talkingHeadRatio).toBeLessThanOrEqual(0.95);
    }
  });

  test("captionStyle sa napája na existujúce štýly titulkov (žiadny druhý katalóg)", () => {
    const ids = new Set(CAPTION_STYLES.map((s) => s.id));
    for (const r of listStyleRecipes()) {
      expect(ids.has(r.captionStyle.styleId)).toBe(true);
      expect(r.captionStyle.rationaleSk.length).toBeGreaterThan(10);
    }
  });

  test("každý recept má vyplnené všetky polia zo zadania", () => {
    for (const r of listStyleRecipes()) {
      expect(r.name.length).toBeGreaterThan(2);
      expect(r.animation.easingSk.length).toBeGreaterThan(2);
      expect(r.typography.roles.length).toBeGreaterThan(0);
      expect(r.movement.noteSk.length).toBeGreaterThan(2);
      expect(r.aesthetic.elementPool.length).toBeGreaterThan(0);
      expect(r.colorPalette.length).toBeGreaterThan(1);
      expect(r.composition.allowed.length).toBeGreaterThan(0);
      expect(r.texture.level).toBeTruthy();
      expect(r.transitionStyle.noteSk.length).toBeGreaterThan(2);
      expect(r.requiresSk.length).toBeGreaterThan(10);
      expect(r.motionPool.length).toBeGreaterThan(0);
    }
  });

  test("recept nikdy neponúka generovaný vizuál, keď provider neexistuje", () => {
    // Dnes provider NEMÁME (Reality Gate) → recepty nesmú sľubovať generované prvky.
    expect(GENERATED_VISUALS_PROVIDER_AVAILABLE).toBe(false);
    for (const r of listStyleRecipes()) {
      // `generated_visual` sa v engine vždy odfiltruje; v recepte smie byť len ako zoznam možností,
      // ale nikdy nie ako jediná možnosť.
      expect(r.aesthetic.elementPool.filter((e) => e !== "generated_visual").length).toBeGreaterThan(0);
    }
  });

  test("Editorial Collage zodpovedá referenčnému workflow bod po bode", () => {
    const r = getStyleRecipe("EDITORIAL_COLLAGE");
    // ANIMATION
    expect(r.animation.kind).toBe("stop-motion");
    expect(r.animation.fpsLook).toBe(12);
    expect(r.animation.motionBlur).toBe(false);
    // TYPOGRAPHY
    expect(r.typography.character).toBe("bold-condensed");
    expect(r.typography.kinetic).toBe(true);
    expect(r.typography.staggerMs).toBeGreaterThan(0);
    // CAMERA
    expect(r.camera.punchIn).toBe(true);
    expect(r.camera.fastZoom).toBe(true);
    expect(r.camera.whipPan).toBe("occasional");
    // MOVEMENT
    expect(r.movement.paperCutout).toBe(true);
    expect(r.movement.layering).toBe(true);
    expect(r.movement.subtleZoom).toBe(true);
    expect(r.movement.depthLayers).toBeGreaterThanOrEqual(2);
    // AESTHETIC
    expect(r.aesthetic.halftone).toBe(true);
    expect(r.aesthetic.visibleShadows).toBe(true);
    expect(r.aesthetic.asymmetric).toBe(true);
    expect(r.aesthetic.illustrationBodies).toBe(true);
    // VISUAL STRUCTURE: 30 / 70, ale ako odporúčanie (nie pravidlo)
    expect(r.talkingHeadRatio).toBe(0.3);
    expect(r.supportingVisualRatio).toBe(0.7);
    // Referenčný workflow: prvky sa objavujú jednotlivo, nie celé panely
    expect(r.visualStructure.elementAnimation).toBe("sequential");
    expect(r.visualStructure.transitionsBetweenPanels).toBe(false);
  });

  test("podcastový recept drží rečníka v obraze (a dokument tiež)", () => {
    expect(getStyleRecipe("PODCAST_VISUAL").talkingHeadRatio).toBeGreaterThan(0.7);
    expect(getStyleRecipe("DOCUMENTARY").talkingHeadRatio).toBeGreaterThan(0.7);
    expect(getStyleRecipe("MINIMAL").talkingHeadRatio).toBeGreaterThan(0.8);
  });

  test("kinetická typografia má hustejší stagger než dokument", () => {
    expect(getStyleRecipe("KINETIC_TYPOGRAPHY").typography.staggerMs).toBeLessThan(
      getStyleRecipe("DOCUMENTARY").typography.staggerMs,
    );
  });
});

describe("B) tvorba receptu (CUSTOM a vlastný brief)", () => {
  test("brief s kolážou a stop-motion naozaj prepne vizuálne nastavenia", () => {
    const { recipe, recognized } = customRecipeFromBrief("chcem editorial koláž, stop motion 12 fps, paper cutouts");
    expect(recipe.id).toBe("CUSTOM");
    expect(recipe.animation.kind).toBe("stop-motion");
    expect(recipe.animation.fpsLook).toBe(12);
    expect(recipe.aesthetic.halftone).toBe(true);
    expect(recipe.composition.primary).toBe("layered_collage");
    // rozpoznanie je za pravidlo (nie za slovo) — dve pravidlá = dve položky
    expect(recognized.map((r) => r.meaningSk)).toContain("koláž z papiera a výstrižkov");
    expect(recognized.map((r) => r.meaningSk)).toContain("stop-motion dojem (12 fps, bez rozmazania)");
    expect(recognized.length).toBeGreaterThanOrEqual(2);
  });

  test("brief s farbami použije presne tie farby (nič nedomýšľa)", () => {
    const { recipe, recognized } = customRecipeFromBrief("minimal, farby #0A3D91 a #FFC400");
    expect(recipe.colorPalette).toEqual(["#0A3D91", "#FFC400"]);
    expect(recognized.some((r) => r.meaningSk.includes("farby"))).toBe(true);
    expect(recipe.texture.level).toBe("clean");
  });

  test("nerozpoznaný brief prizná, že nerozumel — a nič si nevymyslí", () => {
    const { recipe, recognized, unrecognizedSk, noteSk } = customRecipeFromBrief("blabla xyzqwerty");
    expect(recognized).toHaveLength(0);
    expect(unrecognizedSk.length).toBeGreaterThan(0);
    expect(noteSk).toContain("Nič som si nevymyslel");
    // Základ zostáva neutrálny CUSTOM
    expect(recipe.id).toBe("CUSTOM");
    expect(recipe.aesthetic.halftone).toBe(false);
  });

  test("rovnaký brief = rovnaký recept (determinizmus, žiadny provider)", () => {
    const a = customRecipeFromBrief("koláž, halftone, whip pan, #111111");
    const b = customRecipeFromBrief("koláž, halftone, whip pan, #111111");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("brief nikdy neprepíše pomery mimo zdravý rozsah", () => {
    const { recipe } = customRecipeFromBrief("podcast rozhovor, koláž, všetko naraz");
    expect(recipe.talkingHeadRatio).toBeGreaterThanOrEqual(0.05);
    expect(recipe.talkingHeadRatio).toBeLessThanOrEqual(0.95);
  });

  test("defaultné ovládače chránia pôvodné audio", () => {
    expect(DEFAULT_STYLE_CONTROLS.preserveOriginalAudio).toBe(true);
    expect(DEFAULT_STYLE_CONTROLS.talkingHeadRatio).toBeNull();
  });

  test("recept sa nikdy nemení tým, že ho niekto použije (žiadne zdieľané mutácie)", () => {
    const before = JSON.stringify(getStyleRecipe("EDITORIAL_COLLAGE"));
    customRecipeFromBrief("koláž, minimal");
    expect(JSON.stringify(getStyleRecipe("EDITORIAL_COLLAGE"))).toBe(before);
  });

  test("recepty z reálnych referencií nesú namerané hodnoty (nie dojmy)", () => {
    // Hodnoty sú merané z reálnych klipov — viď docs/STYLE_STUDIO_REFERENCE_ANALYSIS.md.
    const karta = STYLE_RECIPES.AI_CARD_DEMO;
    // Referencia: 18 s, 0 rezov → kamera sa nehýbe a rezy nie sú základ.
    expect(karta.camera.punchIn).toBe(false);
    expect(karta.camera.whipPan).toBe("none");
    expect(karta.composition.primary).toBe("picture_in_picture");
    expect(karta.talkingHeadRatio).toBeGreaterThan(0.8);
    expect(karta.typography.uppercase).toBe(true);
    expect(karta.typography.character).toBe("bold-condensed");
    expect(karta.captionStyle.styleId).toBe("MINIMAL");

    const montaz = STYLE_RECIPES.FILM_MONTAGE;
    // Referencia: 1,62 rezu/s → strih je základ a b-roll dominuje.
    expect(montaz.transitionStyle.base).toBe("cut");
    expect(montaz.talkingHeadRatio).toBeLessThan(0.4);
    expect(montaz.aesthetic.elementPool).toContain("b_roll");
    expect(montaz.aesthetic.elementPool).not.toContain("paper_element");
    expect(montaz.composition.primary).toBe("full_screen");

    const expert = STYLE_RECIPES.EXPERT_COLLAGE_TALK;
    // Referencia: 0,46 rezu/s, 2,13 s na záber → pokojné tempo, vrstvená koláž.
    expect(expert.camera.fastZoom).toBe(false);
    expect(expert.composition.primary).toBe("layered_collage");
    expect(expert.movement.depthLayers).toBeGreaterThanOrEqual(3);
    expect(expert.captionStyle.styleId).toBe("HORMOZI");
  });

  test("nové recepty priznávajú, čo potrebujú (žiadne tiché sľuby)", () => {
    for (const id of ["AI_CARD_DEMO", "FILM_MONTAGE", "EXPERT_COLLAGE_TALK"] as const) {
      const r = STYLE_RECIPES[id];
      expect(r.requiresSk.length).toBeGreaterThan(20);
      expect(r.talkingHeadRatio + r.supportingVisualRatio).toBeCloseTo(1, 3);
    }
  });
});

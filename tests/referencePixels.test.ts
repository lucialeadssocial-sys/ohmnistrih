import { describe, expect, test } from "bun:test";
import {
  analyzeReferencePixels,
  applyReferencePalette,
  buildStyleBoard,
  luma709,
  referencePaletteForRecipe,
  saturationOf,
  toHex,
} from "../src/core/style/referencePixels";
import { ReferenceStyleAnalyzer } from "../src/visual/ReferenceStyleAnalyzer";
import { STYLE_RECIPES } from "../src/core/style/styleRecipes";

/**
 * Testy kroku 11: referenčný obrázok sa **naozaj meria z pixelov**.
 *
 * Predtým sa štýl hádal podľa mena súboru. Testy preto strážia dve veci:
 *  1. merania sú správne (na syntetických pixeloch, kde odpoveď presne poznám),
 *  2. appka netvrdí nič, čo z pixelov zistiť nedá (font, pohyb, hudba, sémantika).
 */

/** Vyrobí RGBA pixely: každá farba dostane svoj podiel plochy. */
function makePixels(
  width: number,
  height: number,
  parts: { color: [number, number, number]; share: number }[],
): Uint8ClampedArray {
  const total = width * height;
  const data = new Uint8ClampedArray(total * 4);
  let index = 0;
  for (const part of parts) {
    const count = Math.round(total * part.share);
    for (let i = 0; i < count && index < total; i++, index++) {
      const o = index * 4;
      data[o] = part.color[0];
      data[o + 1] = part.color[1];
      data[o + 2] = part.color[2];
      data[o + 3] = 255;
    }
  }
  for (; index < total; index++) {
    const o = index * 4;
    data[o] = 0;
    data[o + 1] = 0;
    data[o + 2] = 0;
    data[o + 3] = 255;
  }
  return data;
}

/** Šachovnica — veľa hrán (na rozdiel od jednoliatej plochy). */
function checkerboard(width: number, height: number, cell: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const on = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0;
      const o = (y * width + x) * 4;
      const v = on ? 255 : 0;
      data[o] = v;
      data[o + 1] = v;
      data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  return data;
}

// ---------------------------------------------------------------------------
// A) Prepočty
// ---------------------------------------------------------------------------

describe("A) pomocné prepočty farieb", () => {
  test("luma podľa Rec. 709 (zelená je najsvetlejšia, modrá najtmavšia)", () => {
    expect(luma709(255, 255, 255)).toBeCloseTo(255, 1);
    expect(luma709(0, 0, 0)).toBe(0);
    expect(luma709(0, 255, 0)).toBeGreaterThan(luma709(255, 0, 0));
    expect(luma709(255, 0, 0)).toBeGreaterThan(luma709(0, 0, 255));
  });

  test("sýtosť: sivá je nula, čistá farba je jedna", () => {
    expect(saturationOf(120, 120, 120)).toBe(0);
    expect(saturationOf(255, 0, 0)).toBe(1);
    expect(saturationOf(128, 64, 64)).toBeCloseTo(0.5, 2);
  });

  test("hex formát je veľkými písmenami a vždy šesťmiestny", () => {
    expect(toHex(0, 0, 0)).toBe("#000000");
    expect(toHex(255, 255, 255)).toBe("#FFFFFF");
    expect(toHex(232, 114, 12)).toBe("#E8720C");
  });
});

// ---------------------------------------------------------------------------
// B) Merania na známych pixeloch
// ---------------------------------------------------------------------------

describe("B) meranie pixelov (odpoveď poznám dopredu)", () => {
  test("tmavý editorial: 70 % temnej plochy + 30 % oranžová", () => {
    const px = makePixels(100, 100, [
      { color: [17, 17, 17], share: 0.7 }, // #111111
      { color: [232, 114, 12], share: 0.3 }, // #E8720C
    ]);
    const res = analyzeReferencePixels(px, 100, 100);
    expect(res.available).toBe(true);
    if (!res.available) return;

    expect(res.palette[0].hex).toBe("#111111");
    expect(res.palette[0].coverage).toBeCloseTo(0.7, 1);
    expect(res.palette[1].hex).toBe("#E8720C");
    expect(res.palette[1].coverage).toBeCloseTo(0.3, 1);
    // zvýraznenie musí byť tá sýta oranžová, nie tmavá plocha
    expect(res.accent?.hex).toBe("#E8720C");
    expect(res.darkRatio).toBeGreaterThan(0.65);
    expect(res.moodSk).toContain("tmavý");
    expect(res.moodSk).toContain("sýte");
  });

  test("svetlý a čistý obrázok nemá sýte zvýraznenie", () => {
    const px = makePixels(80, 80, [{ color: [245, 245, 245], share: 1 }]);
    const res = analyzeReferencePixels(px, 80, 80);
    if (!res.available) throw new Error("analýza zlyhala");
    expect(res.lightRatio).toBeGreaterThan(0.95);
    expect(res.accent).toBeNull();
    expect(res.moodSk).toContain("svetlý");
    expect(res.hintsSk.join(" ")).toContain("nemá VÝRAZNÚ sýtu farbu");
    // jednofarebný obrázok nesmie tvrdiť, že vie, kde je „najtmavšie pásmo"
    expect(res.hintsSk.join(" ")).toContain("Jas pásiem je vyrovnaný");
  });

  test("kontrast: jednofarebná plocha má odchýlku ~0, šachovnica veľkú", () => {
    const flat = analyzeReferencePixels(makePixels(60, 60, [{ color: [128, 128, 128], share: 1 }]), 60, 60);
    const check = analyzeReferencePixels(checkerboard(60, 60, 4), 60, 60);
    if (!flat.available || !check.available) throw new Error("analýza zlyhala");
    expect(flat.contrast).toBeLessThan(1);
    expect(check.contrast).toBeGreaterThan(100);
  });

  test("hustota hrán: plocha ~0, šachovnica výrazne vyššia", () => {
    const flat = analyzeReferencePixels(makePixels(100, 100, [{ color: [40, 40, 40], share: 1 }]), 100, 100);
    const check = analyzeReferencePixels(checkerboard(100, 100, 2), 100, 100);
    if (!flat.available || !check.available) throw new Error("analýza zlyhala");
    expect(flat.edgeDensity).toBeLessThan(0.01);
    expect(check.edgeDensity).toBeGreaterThan(0.3);
    expect(check.hintsSk.join(" ")).toContain("kompozícia je plná");
  });

  test("teplota: teplý obrázok je kladný, studený záporný", () => {
    const warm = analyzeReferencePixels(makePixels(50, 50, [{ color: [200, 120, 60], share: 1 }]), 50, 50);
    const cool = analyzeReferencePixels(makePixels(50, 50, [{ color: [60, 120, 200], share: 1 }]), 50, 50);
    if (!warm.available || !cool.available) throw new Error("analýza zlyhala");
    expect(warm.warmth).toBeGreaterThan(12);
    expect(cool.warmth).toBeLessThan(-12);
    expect(warm.moodSk).toContain("teplý");
    expect(cool.moodSk).toContain("studený");
  });

  test("pásma: svetlá horná tretina a tmavá dolná sa naozaj namerajú", () => {
    const width = 30;
    const height = 90;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      const v = y < height / 3 ? 230 : 20;
      for (let x = 0; x < width; x++) {
        const o = (y * width + x) * 4;
        data[o] = data[o + 1] = data[o + 2] = v;
        data[o + 3] = 255;
      }
    }
    const res = analyzeReferencePixels(data, width, height);
    if (!res.available) throw new Error("analýza zlyhala");
    expect(res.bands[0].brightness).toBeGreaterThan(200);
    expect(res.bands[2].brightness).toBeLessThan(40);
    expect(res.hintsSk.join(" ")).toContain("Pásma sa líšia");
    expect(res.hintsSk.join(" ")).toContain("najsvetlejšie hore");
  });

  test("determinizmus: rovnaké pixely dajú vždy rovnaký výsledok", () => {
    const px = makePixels(64, 64, [
      { color: [10, 10, 12], share: 0.5 },
      { color: [240, 240, 235], share: 0.3 },
      { color: [200, 60, 40], share: 0.2 },
    ]);
    const a = analyzeReferencePixels(px, 64, 64);
    const b = analyzeReferencePixels(px, 64, 64);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("veľké obrázky sa vzorkujú (stride) a výsledok ostáva rovnaký", () => {
    const px = makePixels(200, 200, [
      { color: [20, 20, 20], share: 0.8 },
      { color: [220, 40, 40], share: 0.2 },
    ]);
    const full = analyzeReferencePixels(px, 200, 200);
    const sampled = analyzeReferencePixels(px, 200, 200, { stride: 4 });
    if (!full.available || !sampled.available) throw new Error("analýza zlyhala");
    expect(sampled.palette[0].hex).toBe(full.palette[0].hex);
    expect(sampled.palette[0].coverage).toBeCloseTo(full.palette[0].coverage, 2);
  });
});

// ---------------------------------------------------------------------------
// C) Keď sa merať nedá — NOT AVAILABLE, žiadne hádanie
// ---------------------------------------------------------------------------

describe("C) bez pixelov sa nič nevymýšľa", () => {
  test("málo pixelových dát = nedostupné (nie tichý odhad)", () => {
    const res = analyzeReferencePixels(new Uint8ClampedArray(16), 100, 100);
    expect(res.available).toBe(false);
    if (res.available) return;
    expect(res.reasonSk).toContain("kratšie");
  });

  test("nulové rozmery = nedostupné", () => {
    const res = analyzeReferencePixels(new Uint8ClampedArray(100), 0, 0);
    expect(res.available).toBe(false);
  });

  test("analyzátor bez pixelov vráti NOT AVAILABLE a NEPOUŽIJE meno súboru", () => {
    // Toto je kľúčový regresný test: predtým stačilo, aby sa súbor volal „cinematic",
    // a appka „zmerala" tmavý filmový štýl. Teraz je odpoveďou NOT AVAILABLE.
    const res = ReferenceStyleAnalyzer.analyzeReferenceStyle("cinematic-dark-clean-social.png", "proj_1");
    expect(res.available).toBe(false);
    expect(res.dna).toBeNull();
    expect(res.analysis).toBeNull();
    expect(res.board).toBeNull();
    expect(res.reasonSk).toContain("NOT AVAILABLE");
    expect(res.reasonSk).toContain("mena súboru");
    expect(res.explanationSk).toContain("NOT AVAILABLE");
  });

  test("analyzátor s pixelmi meria skutočné farby a prizná, čo prevzal", () => {
    const px = makePixels(60, 60, [
      { color: [15, 15, 18], share: 0.75 },
      { color: [255, 200, 40], share: 0.25 },
    ]);
    const res = ReferenceStyleAnalyzer.analyzeReferenceStyle("nejaky-subor.png", "proj_1", px, 60, 60);
    expect(res.available).toBe(true);
    if (!res.available) return;
    expect(res.dna?.accentColor).toBe("#FFC828");
    expect(res.extractedAttributes?.dominantColors[0]).toBe("#0F0F12");
    expect(res.dna?.colorMood).toBe("dark_editorial");
    // dôležité: mimo merateľného rozsahu sa appka musí priznať
    expect(res.inheritedSk.length).toBeGreaterThan(0);
    expect(res.inheritedSk.join(" ")).toContain("typografia");
    expect(res.explanationSk).toContain("Prebraté");
    expect(res.board?.swatches[0].hex).toBe("#0F0F12");
  });
});

// ---------------------------------------------------------------------------
// D) Paleta do receptu (bez nového modelu)
// ---------------------------------------------------------------------------

describe("D) nameraná paleta ide do existujúceho receptu", () => {
  const analysis = (() => {
    const res = analyzeReferencePixels(
      makePixels(60, 60, [
        { color: [12, 12, 14], share: 0.6 },
        { color: [235, 235, 230], share: 0.25 },
        { color: [232, 114, 12], share: 0.15 },
      ]),
      60,
      60,
    );
    if (!res.available) throw new Error("analýza zlyhala");
    return res;
  })();

  test("paleta má základ, najkontrastnejší text a zvýraznenie", () => {
    const palette = referencePaletteForRecipe(analysis);
    expect(palette[0]).toBe("#0C0C0E");
    expect(palette).toContain("#EBEBE6");
    expect(palette).toContain("#E8720C");
    expect(new Set(palette).size).toBe(palette.length);
  });

  test("recept dostane nameranú paletu a ostane CUSTOM (žiadny nový preset)", () => {
    const base = STYLE_RECIPES.EDITORIAL_COLLAGE;
    const withRef = applyReferencePalette(base, analysis, "referencia.png");
    expect(withRef.id).toBe("CUSTOM");
    expect(withRef.labelSk).toContain("referencia");
    expect(withRef.colorPalette).toEqual(referencePaletteForRecipe(analysis));
    // a nesmie meniť správanie receptu (pohyby, kompozícia, titulky)
    expect(withRef.motionPool).toEqual(base.motionPool);
    expect(withRef.composition).toEqual(base.composition);
    expect(withRef.captionStyle).toEqual(base.captionStyle);
    // pôvodný recept sa nesmie zmeniť (žiadne zdieľané mutácie)
    expect(base.colorPalette).not.toEqual(withRef.colorPalette);
  });
});

// ---------------------------------------------------------------------------
// E) Deska štýlu
// ---------------------------------------------------------------------------

describe("E) deska štýlu", () => {
  const analysis = (() => {
    const res = analyzeReferencePixels(checkerboard(80, 80, 4), 80, 80);
    if (!res.available) throw new Error("analýza zlyhala");
    return res;
  })();

  test("deska má vzorky, čísla a poctivý zoznam toho, čo sa nedá zistiť", () => {
    const board = buildStyleBoard(analysis, { titleSk: "Test" });
    expect(board.titleSk).toBe("Test");
    expect(board.swatches.length).toBeGreaterThan(0);
    expect(board.swatches[0].coveragePercent).toBeGreaterThan(0);
    expect(board.rows.find((r) => r.labelSk === "Analyzovaných pixelov")?.valueSk).toBeTruthy();
    expect(board.notesSk.join(" ")).toContain("fontu");
    expect(board.notesSk.join(" ")).toContain("Zvuk");
  });

  test("bez image providera je to v deske napísané priamo (žiadne fake vizuály)", () => {
    const board = buildStyleBoard(analysis);
    expect(board.providerSk).toContain("PROVIDER UNAVAILABLE");
    expect(board.providerSk).toContain("nedoplňujú");
  });

  test("vzorky nesú rolu (hlavná plocha, zvýraznenie, svetlá/tmavá)", () => {
    const board = buildStyleBoard(analysis);
    const roles = board.swatches.map((s) => s.roleSk).join(" | ");
    expect(roles).toContain("hlavná plocha");
  });
});

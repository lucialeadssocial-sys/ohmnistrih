import { describe, expect, test } from "bun:test";
import {
  STYLE_CARD_KINDS,
  buildPattern,
  buildStyleCardSpec,
  layoutCardText,
  chooseCardPalette,
  escapeCardText,
  hexToAssColor,
  luminance,
  patternBoxCount,
  saturation,
} from "../src/core/visual/styleCard";
import {
  SAFE_LICENSES,
  attributionRequired,
  buildAttribution,
  licenseDecision,
  openverseSearchUrl,
  processOpenverseResponse,
} from "../src/core/visual/freeLibrary";
import { getStyleRecipe, listStyleRecipes } from "../src/core/style/styleRecipes";
import { librariesItemRowSk, libraryViewItem } from "../src/core/visual/ownVisualView";

/**
 * KROK 27 — VLASTNÝ VIZUÁL.
 *
 * Testy strážia tri veci, na ktorých stojí dôvera:
 *  A) generátor je deterministický a stojí na REÁLNYCH hodnotách receptu,
 *  B) appka si NIKDY nevymyslí text (prázdny text = jasná chyba, nie tichý výmysel),
 *  C) licenčná politika nikdy nepustí obrázok, ktorý sa do videa nesmie,
 *     a pri povinnej licencii vždy pripraví text priznania.
 */

describe("A) Generátor kariet stojí na recepte a je deterministický", () => {
  /**
   * Tieto dva testy vznikli z REÁLNEJ CHYBY prvej verzie (videné na obrázku):
   * text „ZA PÄŤ MINÚT DENNE“ sa zrezal a halftone vzor šel cez text.
   * Preto sa teraz text meria a vzor vynecháva pás textu — a testy to strážia.
   */
  test("A0a — dlhý text sa zalomí a zmenší tak, aby sa NIKDY nezrezal", () => {
    const layout = layoutCardText("ZA PÄŤ MINÚT DENNE", {
      width: 1080,
      height: 1920,
      maxCharsPerLine: 16,
      preferredFontRatio: 0.11,
    });
    expect(layout.lines).toEqual(["ZA PÄŤ MINÚT", "DENNE"]);
    expect(layout.estimatedWidthPx).toBeLessThanOrEqual(Math.round(1080 * 0.84));
    expect(layout.fitsSk).toContain("zmenšil");
  });

  test("A0b — vzor vynechá pás textu (text zostáva čitateľný)", () => {
    const recipe = getStyleRecipe("EDITORIAL_COLLAGE");
    const withoutText = buildPattern(recipe, { width: 1080, height: 1920 }, null);
    const withText = buildPattern(recipe, { width: 1080, height: 1920 }, { top: 800, bottom: 1120 });
    expect(withText.boxCount).toBeLessThan(withoutText.boxCount);
    expect(withText.skippedForText).toBeGreaterThan(0);
    // Žiadny štvorce nesmie ležať v páse textu.
    for (const box of withText.boxes) {
      const overlaps = box.y + box.size > 800 && box.y < 1120;
      expect(overlaps).toBe(false);
    }
    expect(withText.opacity).toBeLessThanOrEqual(0.12);
  });

  test("A0c — generátor vráti zalomenie aj vzor v jednom výstupe (aby to UI aj server videli rovnako)", () => {
    const spec = buildStyleCardSpec({
      recipeId: "EDITORIAL_COLLAGE",
      kind: "headline",
      text: "Za päť minút denne",
      width: 1080,
      height: 1920,
    });
    expect(spec.ok).toBe(true);
    expect(spec.layout.lines.length).toBe(2);
    expect(spec.pattern.boxCount).toBeGreaterThan(0);
    expect(spec.assContent).toContain("\\N"); // ASS zlom riadku
    expect(spec.notesSk.join(" ")).toContain("vynechal");
  });
  test("A1 — paleta sa vyberá z palety receptu (pozadie najtmavšia, text najsvetlejšia, akcent najsýtejšia)", () => {
    const palette = chooseCardPalette(["#0A070B", "#4A3123", "#6F869D", "#E8E3DD"]);
    expect(luminance(palette.background)).toBeLessThan(luminance(palette.text));
    expect(saturation(palette.accent)).toBeGreaterThanOrEqual(saturation(palette.background));
    expect(["#0A070B", "#4A3123", "#6F869D", "#E8E3DD"]).toContain(palette.accent);
  });

  test("A2 — rovnaký vstup dá presne ten istý obrázok (žiadna náhoda)", () => {
    const request = { recipeId: "AI_CARD_DEMO", kind: "statistic" as const, text: "70%", subText: "kratší strih", width: 1080, height: 1920 };
    const first = buildStyleCardSpec(request);
    const second = buildStyleCardSpec(request);
    expect(first.assContent).toBe(second.assContent);
    expect(first.palette).toEqual(second.palette);
    expect(first.pattern).toEqual(second.pattern);
  });

  test("A3 — každý recept v appke vie kartu (žiadny recept nespadne)", () => {
    for (const recipe of listStyleRecipes()) {
      const spec = buildStyleCardSpec({ recipeId: recipe.id, kind: "headline", text: "Test" });
      expect(spec.ok).toBe(true);
      expect(spec.recipeId).toBe(recipe.id);
      expect(spec.fontFile.length).toBeGreaterThan(0);
    }
  });

  test("A4 — vzor závisí od textúry receptu (hustejšia textúra = hustejšia mriežka)", () => {
    const editorial = patternBoxCount(getStyleRecipe("EDITORIAL_COLLAGE"));
    const cinematic = patternBoxCount(getStyleRecipe("AI_CINEMATIC_TAKE"));
    expect(editorial.boxCount).toBeGreaterThan(cinematic.boxCount);
    expect(editorial.reasonSk).toContain("halftone");
    expect(cinematic.reasonSk).toContain("jemná textúra");
    // Recept, ktorý textúru nemá, nemá ani vzor — a appka povie prečo.
    const clean = patternBoxCount({ ...getStyleRecipe("AI_CINEMATIC_TAKE"), texture: { level: "clean", kinds: [] } } as never);
    expect(clean.boxCount).toBe(0);
    expect(clean.reasonSk).toContain("clean");
  });

  test("A5 — ASS farba je v poradí BGR (inak by karta mala iné farby než paleta)", () => {
    expect(hexToAssColor("#FF8800")).toBe("&H000088FF");
    expect(hexToAssColor("#0A070B", 128)).toBe("&H800B070A");
  });

  test("A6 — text sa do ASS nedostane s nebezpečnými znakmi (zálomky by rozbili štýl)", () => {
    expect(escapeCardText("Ahoj {\\fscx200}svet\nnový riadok")).toBe("Ahoj \\fscx200svet nový riadok");
  });
});

describe("B) Appka si text NEVYMÝŠĽA", () => {
  test("B1 — prázdny text = jasná chyba, nie tichý výmysel", () => {
    const spec = buildStyleCardSpec({ recipeId: "AI_CARD_DEMO", kind: "statistic", text: "   " });
    expect(spec.ok).toBe(false);
    expect(spec.errorSk ?? "").toContain("nevymýšľa");
  });

  test("B2 — vzor (pattern) text nepotrebuje a žiadny si nedomyslí", () => {
    const spec = buildStyleCardSpec({ recipeId: "EDITORIAL_COLLAGE", kind: "pattern" });
    expect(spec.ok).toBe(true);
    expect(spec.assContent).toBe("");
  });

  test("B3 — neznámy druh karty sa prizná (nič sa nedomyslí)", () => {
    const spec = buildStyleCardSpec({ recipeId: "AI_CARD_DEMO", kind: "nieco" as never, text: "x" });
    expect(spec.ok).toBe(false);
    expect(spec.errorSk ?? "").toContain("Neznámy druh karty");
  });

  test("B4 — text karty je vždy doslovne to, čo prišlo (mení sa len veľkosť písmen podľa receptu)", () => {
    const text = "Klient zaplatil 3000 €";
    const spec = buildStyleCardSpec({ recipeId: "AI_CARD_DEMO", kind: "quote", text });
    // Recept AI_CARD_DEMO má predpísané VEĽKÉ PÍSMENÁ — to je štýl, nie prepis textu.
    expect(spec.uppercase).toBe(true);
    expect(spec.assContent.toUpperCase()).toContain(text.toUpperCase());
    // Bez uppercase receptu musí byť text znak po znaku rovnaký.
    const lower = buildStyleCardSpec({
      recipeId: "CUSTOM",
      kind: "quote",
      text,
    });
    const plain = lower.uppercase ? text.toUpperCase() : text;
    expect(lower.assContent).toContain(plain);
  });

  test("B5 — druhy kariet sú presne tie, ktoré appka vie vykresliť", () => {
    expect(STYLE_CARD_KINDS.map((k) => k.id)).toEqual(["headline", "statistic", "label", "quote", "pattern"]);
    expect(STYLE_CARD_KINDS.filter((k) => k.needsText).length).toBe(4);
  });
});

describe("C) Licenčná politika voľnej knižnice", () => {
  test("C1 — komerčne použiteľné licencie prejdú, NC/ND nie (s dôvodom)", () => {
    for (const license of SAFE_LICENSES) {
      expect(licenseDecision(license).allowed).toBe(true);
    }
    const nc = licenseDecision("by-nc");
    expect(nc.allowed).toBe(false);
    expect(nc.reasonSk).toContain("nekomerčná");
    expect(licenseDecision("by-nd").reasonSk).toContain("bez odvodenín");
    expect(licenseDecision("").allowed).toBe(false);
    expect(licenseDecision("vlastna-licencia").allowed).toBe(false);
  });

  test("C2 — pri licencii by/by-sa je priznanie povinné, pri CC0/PDM nie", () => {
    expect(attributionRequired("by")).toBe(true);
    expect(attributionRequired("by-sa")).toBe(true);
    expect(attributionRequired("cc0")).toBe(false);
    expect(attributionRequired("pdm")).toBe(false);
  });

  test("C3 — text priznania obsahuje autora, licenciu aj zdroj", () => {
    const text = buildAttribution({ creator: "KevinJump", license: "by", licenseVersion: "2.0", title: "The New Study", sourceUrl: "https://example.org/1" });
    expect(text).toContain("KevinJump");
    expect(text).toContain("BY 2.0");
    expect(text).toContain("https://example.org/1");
  });

  test("C4 — odpoveď knižnice sa prefiltruje a appka povie, koľko vyradila", () => {
    const payload = {
      result_count: 3,
      results: [
        { id: "1", title: "Ok", creator: "A", license: "by", license_version: "2.0", url: "https://x/1.jpg", foreign_landing_url: "https://x/1", width: 100, height: 200 },
        { id: "2", title: "Nekomerčné", creator: "B", license: "by-nc", url: "https://x/2.jpg", width: 100, height: 200 },
        { id: "3", title: "Bez úprav", creator: "C", license: "by-nd", url: "https://x/3.jpg", width: 100, height: 200 },
      ],
    };
    const result = processOpenverseResponse(payload, "ok");
    expect(result.items.length).toBe(1);
    expect(result.rejectedForLicense).toBe(2);
    expect(result.notesSk.join(" ")).toContain("Vyradil som 2");
    expect(result.notesSk.join(" ")).toContain("uvedenie autora");
  });

  test("C5 — hľadanie v knižnici žiada len komerčné a upraviteľné licencie", () => {
    const url = openverseSearchUrl("desk", 1, 12);
    expect(url).toContain("license_type=commercial%2Cmodification");
    expect(url).toContain("page_size=12");
  });

  test("C6 — riadok pre človeka vždy ukáže autora, licenciu a veľkosť", () => {
    const row = librariesItemRowSk({
      id: "1", title: "T", creator: "KevinJump", license: "by", licenseVersion: "2.0",
      licenseUrl: "", sourceUrl: "", imageUrl: "", thumbnailUrl: "", width: 1024, height: 768,
      attributionSk: "", attributionRequired: true,
    } as never);
    expect(row).toContain("KevinJump");
    expect(row).toContain("BY 2.0");
    expect(row).toContain("1024×768");

    const view = libraryViewItem({
      id: "1", title: "T", creator: "A", license: "by", licenseVersion: "2.0",
      licenseUrl: "", sourceUrl: "", imageUrl: "", thumbnailUrl: "", width: 1, height: 1,
      attributionSk: "", attributionRequired: true,
    } as never);
    expect(view.warningSk ?? "").toContain("uveď autora");
  });
});

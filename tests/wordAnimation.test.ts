import { describe, expect, test } from "bun:test";
import {
  CAPTION_STYLES,
  WORD_POP_DEFAULT_MS,
  activeWordScaleAt,
  buildAssFile,
  getCaptionStyle,
  wordPopSecForStyle,
} from "../src/core/export/subtitleRender";

/**
 * KROK 18 — **PRUŽENIE HOVORENÉHO SLOVA** (animované zvýraznenie).
 *
 * POZOR (reporting): toto je **UNIT TESTED**. Že sa animácia naozaj vykreslí vo
 * videe, dokazuje samostatný runner (`tools/verify-word-animation.ts`) meraním
 * hotového MP4 a sondy do libass (`kontrola-krok18/libass-sondy.json`).
 */

const SEGMENTS = [
  {
    start: 0,
    end: 1.2,
    text: "Za päť minút",
    words: [
      { word: "Za", start: 0, end: 0.4 },
      { word: "päť", start: 0.4, end: 0.8 },
      { word: "minút", start: 0.8, end: 1.2 },
    ],
  },
];

function assFor(styleId: string, opts: Record<string, unknown> = {}) {
  return buildAssFile({
    segments: SEGMENTS as never,
    style: getCaptionStyle(styleId as never),
    width: 1080,
    height: 1920,
    ...opts,
  });
}

// ---------------------------------------------------------------------------
// A) Dĺžka pruženia — čistá funkcia
// ---------------------------------------------------------------------------

describe("A) dĺžka pruženia (wordPopSecForStyle)", () => {
  test("štýl bez zväčšenia slova nepruží (0 s)", () => {
    expect(wordPopSecForStyle({ activeWordScale: 100 }, 1)).toBe(0);
    expect(wordPopSecForStyle({}, 1)).toBe(0);
    expect(wordPopSecForStyle(null, 1)).toBe(0);
  });

  test("štýl so zväčšením pruží svojou dĺžkou (a má predvolenú, keď ju nemá)", () => {
    expect(wordPopSecForStyle({ activeWordScale: 112, activeWordPopMs: 150 }, 1)).toBeCloseTo(0.15, 4);
    expect(wordPopSecForStyle({ activeWordScale: 112 }, 1)).toBeCloseTo(WORD_POP_DEFAULT_MS / 1000, 4);
  });

  test("pruženie nikdy nepresiahne polovicu slova (inak by dobehlo až pri ďalšom slove)", () => {
    expect(wordPopSecForStyle({ activeWordScale: 118, activeWordPopMs: 200 }, 0.3)).toBeCloseTo(0.15, 4);
    expect(wordPopSecForStyle({ activeWordScale: 118, activeWordPopMs: 200 }, 0.9)).toBeCloseTo(0.2, 4);
  });

  test("veľmi krátke slovo nepruží (nemalo by sa stihnúť ani vykresliť)", () => {
    expect(wordPopSecForStyle({ activeWordScale: 118 }, 0.05)).toBe(0);
    expect(wordPopSecForStyle({ activeWordScale: 118 }, 0)).toBe(0);
  });

  test("determinizmus: dva behy dajú tú istú hodnotu", () => {
    const a = wordPopSecForStyle({ activeWordScale: 112, activeWordPopMs: 150 }, 0.6);
    const b = wordPopSecForStyle({ activeWordScale: 112, activeWordPopMs: 150 }, 0.6);
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// B) Priebeh veľkosti v čase — to isté pravidlo ako ASS \t (lineárne)
// ---------------------------------------------------------------------------

describe("B) priebeh veľkosti hovoreného slova (activeWordScaleAt)", () => {
  test("pred začiatkom slova a v čase začiatku je veľkosť základná", () => {
    expect(activeWordScaleAt(-1, 0.4, 112, 0.15)).toBe(1);
    expect(activeWordScaleAt(0.4, 0.4, 112, 0.15)).toBe(1);
  });

  test("v polovici pruženia je v polovici cesty (lineárne ako ASS \\t)", () => {
    expect(activeWordScaleAt(0.475, 0.4, 112, 0.15)).toBeCloseTo(1.06, 4);
  });

  test("po pružení drží vrchol (a nikdy neprekročí)", () => {
    expect(activeWordScaleAt(0.55, 0.4, 112, 0.15)).toBeCloseTo(1.12, 4);
    expect(activeWordScaleAt(5, 0.4, 112, 0.15)).toBeCloseTo(1.12, 4);
    expect(activeWordScaleAt(0.475, 0.4, 130, 0.15)).toBeLessThan(1.31);
  });

  test("bez pruženia (popSec 0) je slovo rovno vo vrchole — nie blikanie", () => {
    expect(activeWordScaleAt(0.45, 0.4, 118, 0)).toBeCloseTo(1.18, 4);
  });

  test("pokazené vstupy nezhodia appku a nezväčšujú", () => {
    expect(activeWordScaleAt(Number.NaN, 0.4, 112, 0.15)).toBe(1);
    expect(activeWordScaleAt(0.5, 0.4, Number.NaN, 0.15)).toBe(1);
    expect(activeWordScaleAt(0.5, Number.NaN, 112, 0.15)).toBe(1);
    expect(activeWordScaleAt(0.5, 0.4, 90, 0.15)).toBe(1); // menšie než základ = žiadne zväčšenie
  });
});

// ---------------------------------------------------------------------------
// C) ASS výstup — animácia musí byť v súbore naozaj zapísaná
// ---------------------------------------------------------------------------

describe("C) ASS výstup obsahuje animované pruženie", () => {
  test("KARAOKE (zväčšenie 118, 130 ms) píše \\t na hovorené slovo", () => {
    const ass = assFor("KARAOKE");
    expect(ass.ass).toMatch(/\\t\(0,130,\\fscx118\\fscy118\)/);
    expect(ass.wordHighlight).toBe(true);
  });

  test("HORMOZI (zväčšenie 112, 150 ms) píše \\t s vlastnou dĺžkou", () => {
    const ass = assFor("HORMOZI");
    expect(ass.ass).toMatch(/\\t\(0,150,\\fscx112\\fscy112\)/);
  });

  test("štýl bez zväčšenia slova nepridáva pruženie na slovo (vstupná animácia titulku zostáva)", () => {
    const ass = assFor("VIRAL_BOLD");
    // Pruženie slova by malo tvar \t(0,ms,\fscx118\fscy118) — teda cieľ väčší než 100.
    const wordPopTags = ass.ass.match(/\\t\(0,\d+,\\fscx(?!100)\d+\\fscy(?!100)\d+\)/g) ?? [];
    expect(wordPopTags).toEqual([]);
    // A žiadne statické zväčšenie slova (staré správanie) tiež nie je.
    expect(ass.ass).not.toMatch(/\\fscx1[1-9]\d/);
  });

  test("krátke slovo: dĺžka pruženia sa oreže na polovicu slova", () => {
    const short = [
      {
        start: 0,
        end: 0.6,
        text: "Áno nie",
        words: [
          { word: "Áno", start: 0, end: 0.2 },
          { word: "nie", start: 0.2, end: 0.6 },
        ],
      },
    ];
    const ass = buildAssFile({
      segments: short as never,
      style: getCaptionStyle("KARAOKE"),
      width: 1080,
      height: 1920,
    });
    // „Áno" má 0,2 s → pruženie max 100 ms (130 ms by presiahlo polovicu)
    expect(ass.ass).toMatch(/\\t\(0,100,\\fscx118\\fscy118\)/);
  });

  test("diakritika v slovách sa nestratí (titulky sú po slovensky)", () => {
    const ass = assFor("KARAOKE");
    expect(ass.ass).toContain("päť");
  });
});

// ---------------------------------------------------------------------------
// D) Katalóg štýlov — hodnoty sú viditeľné, nie schované v kóde
// ---------------------------------------------------------------------------

describe("D) katalóg štýlov nesie dĺžku pruženia", () => {
  test("štýly so zväčšením majú aj dĺžku pruženia", () => {
    const withScale = CAPTION_STYLES.filter((s) => s.activeWordScale && s.activeWordScale !== 100);
    expect(withScale.length).toBeGreaterThan(0);
    for (const s of withScale) {
      expect(s.activeWordPopMs).toBeGreaterThan(0);
      expect((s.activeWordPopMs ?? 0) / 1000).toBeLessThanOrEqual(0.4); // nad 400 ms pôsobí pomaly
    }
  });

  test("štýly bez zväčšenia pruženie nemajú (žiadne tiché animovanie)", () => {
    for (const s of CAPTION_STYLES) {
      if (!s.activeWordScale || s.activeWordScale === 100) {
        expect(wordPopSecForStyle(s, 0.6)).toBe(0);
      }
    }
  });
});

/**
 * Testy: GRID / MOODBOARD REFERENCIA (krok 14).
 *
 * Strážia najmä to, aby appka **netvrdila**, že panely „našla“, keď ich len
 * rovnomerne rozdelila, a aby priemer cez panely nezakryl, že scény sú odlišné.
 */

import { describe, expect, test } from "bun:test";
import {
  analyzeMoodboard,
  analyzePane,
  bandsLookConsistent,
  evenPanes,
  findGutterBands,
  panelPaletteSpread,
  rowAndColumnLuma,
  segmentsLookRegular,
  splitByGutters,
} from "../src/core/style/referenceGrid";

// ---------------------------------------------------------------------------
// Pomocníci na syntetické obrázky
// ---------------------------------------------------------------------------

function solid(width: number, height: number, rgb: [number, number, number]): Uint8ClampedArray {
  const px = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < px.length; i += 4) {
    px[i] = rgb[0];
    px[i + 1] = rgb[1];
    px[i + 2] = rgb[2];
    px[i + 3] = 255;
  }
  return px;
}

/** Vyplní obdĺžnik vo veľkom obrázku (in-place). */
function fill(
  px: Uint8ClampedArray,
  imgW: number,
  rect: { x: number; y: number; width: number; height: number },
  rgb: [number, number, number],
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      const i = (y * imgW + x) * 4;
      px[i] = rgb[0];
      px[i + 1] = rgb[1];
      px[i + 2] = rgb[2];
      px[i + 3] = 255;
    }
  }
}

/** Grid 1×N: panely oddelené čiernymi medzerami (ako moodboard). */
function grid1xN(
  n: number,
  paneW = 40,
  paneH = 80,
  gutter = 6,
  colors: Array<[number, number, number]> = [
    [200, 40, 40],
    [40, 200, 40],
    [40, 40, 200],
    [220, 220, 40],
  ],
): { pixels: Uint8ClampedArray; width: number; height: number } {
  const width = n * paneW + (n - 1) * gutter;
  const height = paneH;
  const px = solid(width, height, [0, 0, 0]);
  for (let i = 0; i < n; i++) {
    fill(px, width, { x: i * (paneW + gutter), y: 0, width: paneW, height: paneH }, colors[i % colors.length]);
  }
  return { pixels: px, width, height };
}

// ---------------------------------------------------------------------------
// A) rovnomerné delenie
// ---------------------------------------------------------------------------

describe("A) rovnomerné delenie (keď je zadanie od používateľa)", () => {
  test("1×4 pokryje celý obrázok bez medzier a bez prekrytia", () => {
    const panes = evenPanes(100, 50, 1, 4);
    expect(panes).toHaveLength(4);
    expect(panes[0].x).toBe(0);
    expect(panes[3].x + panes[3].width).toBe(100);
    expect(panes.reduce((s, p) => s + p.width, 0)).toBe(100);
    expect(panes.every((p) => p.height === 50)).toBe(true);
  });

  test("zvyšok dostane posledný panel (nestratí sa ani pixel)", () => {
    const panes = evenPanes(101, 51, 1, 4);
    expect(panes.reduce((s, p) => s + p.width, 0)).toBe(101);
    expect(panes[3].width).toBeGreaterThan(panes[0].width);
  });

  test("indexy idú zľava doprava, zhora dole", () => {
    const panes = evenPanes(60, 60, 2, 3);
    expect(panes.map((p) => p.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(panes[0]).toMatchObject({ row: 0, col: 0 });
    expect(panes[5]).toMatchObject({ row: 1, col: 2 });
  });

  test("nezmyselné počty sa orežú (nikdy prázdny alebo obrovský grid)", () => {
    expect(evenPanes(40, 40, 0, -3)).toHaveLength(1);
    expect(evenPanes(40, 40, 99, 99)).toHaveLength(144);
  });
});

// ---------------------------------------------------------------------------
// B) hľadanie medzier
// ---------------------------------------------------------------------------

describe("B) hľadanie medzier (porovnanie s okolím, nie s celkom)", () => {
  test("nájde pás tmavých hodnôt uprostred", () => {
    expect(findGutterBands([180, 180, 180, 5, 5, 5, 180, 180])).toEqual([{ start: 3, end: 5 }]);
  });

  test("na obrázku bez medzier nič nenájde", () => {
    expect(findGutterBands([150, 152, 148, 151])).toEqual([]);
  });

  test("príliš tenký pás (1 px) sa ignoruje (býva to obrys, nie medzera)", () => {
    expect(findGutterBands([180, 180, 180, 0, 180, 180, 180])).toEqual([]);
  });

  test("funguje aj pri svetlom moodboarde (medzera nie je čierna, len tmavšia)", () => {
    const values = [
      245, 245, 245, 245, 245, 245, 245, 245, 245,
      110, 110, 110,
      245, 245, 245, 245, 245, 245, 245, 245, 245,
    ];
    expect(findGutterBands(values)).toEqual([{ start: 9, end: 11 }]);
  });

  test("TM AVÝ PANEL nie je medzera (je hrubý) — toto bola skutočná chyba", () => {
    // tmavý panel na konci svetlého obrázka: pôvodná verzia z neho spravila „medzeru“
    const values = [200, 200, 200, 200, 200, 200, 8, 8, 8, 8, 8, 8];
    expect(findGutterBands(values)).toEqual([]);
  });

  test("tmavý panel vedľa tmavej medzery: medzera sa nájde, panel nie", () => {
    // panel 30× jas 20, medzera 6× jas 0 (presne jeho moodboard s nočnou scénou)
    const panel = new Array(30).fill(20);
    const gutter = new Array(6).fill(0);
    const values = [...gutter, ...panel, ...gutter, ...new Array(30).fill(180), ...gutter, ...new Array(30).fill(250)];
    const bands = findGutterBands(values);
    expect(bands).toHaveLength(3);
    expect(bands[0]).toEqual({ start: 0, end: 5 });
    expect(bands[1]).toEqual({ start: 36, end: 41 });
    expect(bands[2]).toEqual({ start: 72, end: 77 });
  });

  test("pás na okraji sa vráti tiež (volajúci ho potom vyfiltruje)", () => {
    expect(findGutterBands([0, 0, 0, 200, 200])).toEqual([{ start: 0, end: 2 }]);
  });

  test("prázdny vstup = žiadne pásy", () => {
    expect(findGutterBands([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// C) rozdelenie obrázka podľa medzier
// ---------------------------------------------------------------------------

describe("C) rozdelenie podľa medzier", () => {
  test("grid 1×4 s čiernymi medzerami sa nájde ako 4 panely", () => {
    const { pixels, width, height } = grid1xN(4);
    const split = splitByGutters(pixels, width, height)!;
    expect(split).not.toBeNull();
    expect(split.panes).toHaveLength(4);
    expect(split.cols).toBe(4);
    expect(split.rows).toBe(1);
    expect(split.modeSk).toContain("medzier");
  });

  test("medzery sa nepočítajú do panelov (panel nemá obsahovať čierny pruh)", () => {
    const { pixels, width, height } = grid1xN(3, 40, 80, 6);
    const split = splitByGutters(pixels, width, height)!;
    for (const pane of split.panes) {
      expect(pane.width).toBeLessThanOrEqual(40);
    }
    expect(split.gutterShare).toBeGreaterThan(0.05);
  });

  test("jednofarebný obrázok nemá medzery — vráti null (žiadne vymyslené panely)", () => {
    const px = solid(60, 40, [120, 120, 120]);
    expect(splitByGutters(px, 60, 40)).toBeNull();
  });

  test("okrajové čierne pruhy (letterbox) nie sú medzera medzi panelmi", () => {
    const width = 40;
    const height = 100;
    const px = solid(width, height, [0, 0, 0]);
    fill(px, width, { x: 0, y: 20, width, height: 60 }, [180, 180, 180]);
    expect(splitByGutters(px, width, height)).toBeNull();
  });

  test("priemer riadkov a stĺpcov zodpovedá obsahu", () => {
    const { pixels, width, height } = grid1xN(2, 10, 10, 4, [[255, 255, 255], [0, 0, 0]]);
    const { cols } = rowAndColumnLuma(pixels, width, height);
    expect(cols[0]).toBeGreaterThan(200);
    expect(cols[12]).toBeLessThan(40);
  });
});

// ---------------------------------------------------------------------------
// D) meranie panelov
// ---------------------------------------------------------------------------

describe("D) meranie panelov (každá scéna zvlášť)", () => {
  test("zmeria panel a vráti jeho vlastné čísla, nie celého obrázka", () => {
    const px = solid(20, 20, [255, 255, 255]);
    const dark = analyzePane(px, 20, { index: 0, row: 0, col: 0, x: 0, y: 0, width: 20, height: 20 });
    expect(dark.available).toBe(true);
    if (dark.available) expect(dark.brightness).toBeGreaterThan(240);
  });

  test("moodboard 1×4: každý panel má vlastný jas", () => {
    const { pixels, width, height } = grid1xN(4, 30, 60, 6, [
      [20, 20, 20],
      [90, 90, 90],
      [180, 180, 180],
      [250, 250, 250],
    ]);
    const board = analyzeMoodboard(pixels, width, height);
    expect(board.available).toBe(true);
    expect(board.measuredPanels).toBe(4);
    const brightnesses = board.panels.map((p) => p.analysis.brightness);
    expect(brightnesses[0]).toBeLessThan(brightnesses[1]);
    expect(brightnesses[1]).toBeLessThan(brightnesses[2]);
    expect(brightnesses[2]).toBeLessThan(brightnesses[3]);
  });

  test("keď sa panely veľmi líšia, appka to napíše (priemer nie je celý štýl)", () => {
    const { pixels, width, height } = grid1xN(2, 30, 60, 6, [[10, 10, 10], [250, 250, 250]]);
    const board = analyzeMoodboard(pixels, width, height);
    expect(board.notesSk.join(" ")).toContain("neopisuje ani jednu scénu");
  });

  test("keď sú panely podobné, priemer dáva zmysel a appka to povie", () => {
    const { pixels, width, height } = grid1xN(3, 30, 60, 6, [[120, 120, 120], [125, 125, 125], [118, 118, 118]]);
    const board = analyzeMoodboard(pixels, width, height);
    expect(board.notesSk.join(" ")).toContain("priemer dáva zmysel");
  });

  test("priemer cez panely sa počíta z panelov (nie z celého obrázka s medzerami)", () => {
    const { pixels, width, height } = grid1xN(2, 30, 60, 6, [[200, 200, 200], [200, 200, 200]]);
    const board = analyzeMoodboard(pixels, width, height);
    expect(board.average!.brightness).toBeGreaterThan(190);
  });

  test("keď používateľ zadá grid, appka prizná, že delenie je dohodnuté, nie namerané", () => {
    const px = solid(80, 40, [120, 120, 120]);
    const board = analyzeMoodboard(px, 80, 40, { rows: 1, cols: 4 });
    expect(board.available).toBe(true);
    expect(board.modeSk).toContain("dohodnuté, nie namerané");
    expect(board.panels).toHaveLength(4);
  });

  test("bez medzier a bez zadania = jedna referencia, so správnym vysvetlením", () => {
    const px = solid(60, 40, [130, 130, 130]);
    const board = analyzeMoodboard(px, 60, 40);
    expect(board.available).toBe(false);
    expect(board.modeSk).toBe("jeden panel");
    expect(board.notesSk.join(" ")).toContain("zadaj počet riadkov a stĺpcov");
  });

  test("bez pixelov = NOT AVAILABLE (nič sa nevymýšľa)", () => {
    const board = analyzeMoodboard(new Uint8ClampedArray(0), 10, 10);
    expect(board.available).toBe(false);
    expect(board.reasonSk).toContain("NOT AVAILABLE");
  });

  test("pixely nesediace s rozmermi sa odmietnu (aby sa nemeralo zlé okno)", () => {
    const board = analyzeMoodboard(new Uint8ClampedArray(16), 100, 100);
    expect(board.available).toBe(false);
    expect(board.reasonSk).toContain("nesedia");
  });
});

// ---------------------------------------------------------------------------
// E) paleta naprieč panelmi
// ---------------------------------------------------------------------------

describe("E) paleta naprieč panelmi", () => {
  test("farba, ktorá je vo všetkých paneloch, sa hlási vo všetkých", () => {
    const { pixels, width, height } = grid1xN(3, 30, 60, 6, [[200, 60, 60], [200, 60, 60], [200, 60, 60]]);
    const board = analyzeMoodboard(pixels, width, height);
    const spread = panelPaletteSpread(board);
    expect(spread.length).toBeGreaterThan(0);
    expect(spread[0].panels).toBe(3);
  });

  test("bez dostupného moodboardu vráti prázdny zoznam (žiadne vymyslené farby)", () => {
    const board = analyzeMoodboard(new Uint8ClampedArray(0), 0, 0);
    expect(panelPaletteSpread(board)).toEqual([]);
  });

  test("poradie je podľa počtu panelov, potom podľa pokrytia", () => {
    const { pixels, width, height } = grid1xN(4, 30, 60, 6, [
      [200, 60, 60],
      [200, 60, 60],
      [60, 60, 200],
      [60, 200, 60],
    ]);
    const board = analyzeMoodboard(pixels, width, height);
    const spread = panelPaletteSpread(board);
    expect(spread[0].panels).toBeGreaterThanOrEqual(spread[spread.length - 1].panels);
  });
});

// ---------------------------------------------------------------------------
// F) pravidelnosť (aby auto-detekcia neklamala na reálnych záberoch)
// ---------------------------------------------------------------------------

describe("F) pravidelnosť medzier a panelov", () => {
  test("rovnako hrubé medzery prejdú", () => {
    expect(bandsLookConsistent([{ start: 30, end: 35 }, { start: 66, end: 71 }])).toBe(true);
  });

  test("jedna zlúčená „medzera“ (napr. tmavá scéna) neprejde", () => {
    // presne to sa stalo na reálnych snímkach z jeho videa
    expect(bandsLookConsistent([{ start: 200, end: 240 }, { start: 30, end: 35 }, { start: 66, end: 71 }])).toBe(false);
  });

  test("panely rovnakej veľkosti prejdú, nevyrovnané nie", () => {
    expect(segmentsLookRegular([{ start: 0, end: 253 }, { start: 260, end: 497 }])).toBe(true);
    expect(segmentsLookRegular([{ start: 0, end: 20 }, { start: 30, end: 300 }])).toBe(false);
  });

  test("auto-detekcia na obrázku s tmavými pruhmi v scéne radšej nič nevrátí", () => {
    // dva panely (tmavé) oddelené medzerou, ale v scéne je ďalší tmavý pruh
    const width = 80;
    const height = 60;
    const px = solid(width, height, [200, 200, 200]);
    fill(px, width, { x: 0, y: 0, width: 30, height: 60 }, [12, 12, 12]);
    fill(px, width, { x: 30, y: 0, width: 6, height: 60 }, [0, 0, 0]);
    fill(px, width, { x: 36, y: 0, width: 44, height: 60 }, [210, 210, 210]);
    // tmavý pás vnútri prvého panelu (ako most/obzor v nočnom zábere)
    fill(px, width, { x: 0, y: 25, width: 30, height: 8 }, [0, 0, 0]);
    const split = splitByGutters(px, width, height);
    // buď sa nájde správne rozdelenie, alebo null (nikdy 6 vymyslených panelov)
    if (split) {
      expect(split.panes.length).toBeLessThanOrEqual(4);
    } else {
      expect(split).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// G) výber rozdelenia podľa pomeru strán (reálny nočný záber)
// ---------------------------------------------------------------------------

describe("G) výber rozdelenia, keď má obrázok vlastný tmavý pruh", () => {
  /** 1×4 grid z 9:16 panelov, do ktorého je vodorovne vložený tmavý pruh (nočná scéna). */
  function nightGrid() {
    const paneW = 40;
    const paneH = 72;
    const gutter = 6;
    const n = 4;
    const width = n * paneW + (n - 1) * gutter;
    const height = paneH;
    const px = solid(width, height, [0, 0, 0]);
    const scene: Array<[number, number, number]> = [
      [60, 70, 90],
      [50, 60, 80],
      [70, 80, 100],
      [55, 65, 95],
    ];
    for (let i = 0; i < n; i++) {
      fill(px, width, { x: i * (paneW + gutter), y: 0, width: paneW, height: paneH }, scene[i]);
    }
    // tmavý pruh v scéne (obzor/most) — nie je medzera, ale vyzerá ako tmavý pás
    fill(px, width, { x: 0, y: 30, width, height: 10 }, [14, 16, 20]);
    return { pixels: px, width, height, paneW, paneH };
  }

  test("bez očakávaného pomeru vyberie rozdelenie s panelmi najbližšie k štvorcu", () => {
    const { pixels, width, height } = nightGrid();
    const split = splitByGutters(pixels, width, height);
    expect(split).not.toBeNull();
    expect(split!.modeSk).toContain("najbližšie k štvorcu");
    expect(split!.panes.length).toBeLessThanOrEqual(8);
  });

  test("s očakávaným pomerom 9:16 vyberie 4 panely (nie 8) — to bola skutočná chyba", () => {
    const { pixels, width, height, paneW, paneH } = nightGrid();
    const split = splitByGutters(pixels, width, height, { preferAspect: paneW / paneH });
    expect(split).not.toBeNull();
    expect(split!.panes).toHaveLength(4);
    expect(split!.modeSk).toContain("pomer strán");
    expect(split!.panes.every((p) => Math.abs(p.width / p.height - paneW / paneH) < 0.15)).toBe(true);
  });

  test("keď panely nesedia na očakávaný pomer, radšej nič (žiadne vymyslené panely)", () => {
    const { pixels, width, height } = nightGrid();
    // očakávame extrémne široké panely, čo tomuto obrázku nezodpovedá
    expect(splitByGutters(pixels, width, height, { preferAspect: 4 })).toBeNull();
  });
});

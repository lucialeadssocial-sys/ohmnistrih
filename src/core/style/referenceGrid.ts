/**
 * GRID / MOODBOARD REFERENCIA (krok 14, Reality Gate).
 *
 * Prečo tento súbor existuje: tvorca, ktorého štýl meriame (`@ai_ktivista`), má
 * **zverejnený postup**, ktorý hovorí presne toto:
 *
 *   „Vygeneruj si najskôr jeden obrázok ako grid / moodboard, do ktorého dáš všetko,
 *    čo AI potrebuje vedieť o tvojej scéne. Ten potom použiješ ako referenciu pri
 *    generovaní AI videa. … Nie vždy potrebuješ lepší prompt. Niekedy potrebuješ
 *    lepšiu referenciu.“ (popis jeho videa `7680609867467345174`)
 *
 * Krok 11 vie zmerať **jednu** referenciu. Grid/moodboard je ale **viac panelov
 * v jednom obrázku** — a zmysel je v tom, že každý panel nesie inú scénu. Ak by sa
 * meral ako jeden obrázok, dostali by sme priemer, ktorý neopisuje ani jednu scénu.
 *
 * Čo to NIE JE: žiadny generátor obrázkov ani videa (appka ich nemá a nepredstiera),
 * žiadny nový model. Je to len **meranie**: nájdi panely, zmeraj každý zvlášť.
 *
 * Poctivosť: rozloženie panelov sa dá **odhadnúť** z obrázka (tmavé medzery), ale
 * nedá sa zaručiť. Preto si používateľ môže povedať počet riadkov/stĺpcov sám a
 * výsledok vždy nesie `modeSk` s tým, ako sa panely určili.
 */

import {
  analyzeReferencePixels,
  type ReferenceAnalysis,
  type ReferenceAnalysisOutcome,
} from "./referencePixels";

// ---------------------------------------------------------------------------
// Typy
// ---------------------------------------------------------------------------

export interface PaneRect {
  /** Poradie panelu zľava doprava, zhora dole (0 = prvý). */
  index: number;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridSplitResult {
  panes: PaneRect[];
  rows: number;
  cols: number;
  /** Ako sa panely určili — aby sa dalo vidieť, či to bolo meranie alebo dohoda. */
  modeSk: string;
  /** Podiel pixelov, ktoré pripadli na medzery medzi panelmi (0–1). */
  gutterShare: number;
}

export interface MoodboardPanel extends PaneRect {
  analysis: ReferenceAnalysis;
}

export interface MoodboardAnalysis {
  available: boolean;
  reasonSk?: string;
  width: number;
  height: number;
  rows: number;
  cols: number;
  modeSk: string;
  gutterShare: number;
  panels: MoodboardPanel[];
  /** Koľko panelov má naozaj namerané dáta (zvyšok sa nezmeral). */
  measuredPanels: number;
  /** Priemer cez panely — použiteľný na „celkový štýl moodboardu“. */
  average: {
    brightness: number;
    contrast: number;
    saturation: number;
    warmth: number;
    edgeDensity: number;
  } | null;
  notesSk: string[];
}

export interface MoodboardOptions {
  /** Koľko riadkov/stĺpcov má grid mať. Bez toho sa odhaduje z obrázka. */
  rows?: number;
  cols?: number;
  /** Ako tmavá musí byť medzera, aby sa počítala za medzeru (luma 0–255). */
  gutterLumaMax?: number;
  /** Podiel riadkov/stĺpcov, ktoré musia byť „tmavé“, aby sa našla medzera. */
  gutterMinShare?: number;
  /** Koľko pixelov najviac zmerať v jednom paneli (kvôli rýchlosti). */
  maxPanelPixels?: number;
  /**
   * Pomer strán jedného panelu, aký očakávame (napr. 9/16 pri 9:16 videu).
   * Keď je zadaný, appka vyberie z možných rozdelení to, ktoré mu najviac sedí —
   * vďaka tomu sa nočná scéna s tmavým pruhom nerozdelí na dvojnásobok panelov.
   */
  preferAspect?: number;
}

// ---------------------------------------------------------------------------
// Pomocné: priemer riadku/stĺpca a hľadanie pásov medzier
// ---------------------------------------------------------------------------

/** Priemerná luma každého riadku a stĺpca (na hrubom vzorkovaní, aby to bolo rýchle). */
export function rowAndColumnLuma(
  pixels: Uint8ClampedArray | Uint8Array | number[],
  width: number,
  height: number,
  channels: 3 | 4 = 4,
): { rows: number[]; cols: number[] } {
  const rowSum = new Array<number>(height).fill(0);
  const colSum = new Array<number>(width).fill(0);
  const rowCount = new Array<number>(height).fill(0);
  const colCount = new Array<number>(width).fill(0);

  // POZOR: nesmie sa tu vzorkovať „každý druhý pixel“ — nevzorkované riadky/stĺpce by
  // ostali nulové a vyzerali by ako čierna medzera (presne to odhalil test na 1×4 gride:
  // nuly z nepárnych stĺpcov spravili „medzeru“ širokú 36 px a panely sa zlúčili).
  // Preto sa meria každý pixel; je to rovnaká zložitosť ako analýza pixelov inde.
  for (let y = 0; y < height; y++) {
    const rowBase = y * width * channels;
    for (let x = 0; x < width; x++) {
      const i = rowBase + x * channels;
      const l = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
      rowSum[y] += l;
      rowCount[y] += 1;
      colSum[x] += l;
      colCount[x] += 1;
    }
  }
  const rows = rowSum.map((s, i) => (rowCount[i] > 0 ? s / rowCount[i] : 0));
  const cols = colSum.map((s, i) => (colCount[i] > 0 ? s / colCount[i] : 0));
  return { rows, cols };
}

/**
 * Nájde **pásy medzier** (gutter) v priebehu riadkovej alebo stĺpcovej lumy.
 *
 * Pravidlo: index je medzera, ak je **výrazne tmavší než jeho okolie** (`≤ 0,5 ×
 * lokálny medián`) alebo úplne čierny. Rozhoduje **okolie**, nie celkový priemer —
 * to je presne to, čo odlíši tmavú medzeru od tmavého panelu:
 *
 *  - medzera medzi dvoma panelmi je tenká a tmavšia než oba susedné panely,
 *  - tmavý panel je **hrubý** — a hrubé pásy sa preto zahadzujú (limit `maxShare`).
 *
 * Prvá verzia porovnávala s **celkovým** mediánom, takže v moodboarde s jedným
 * tmavým panelom spravila z panelu aj medzery jeden pás a panely zlúčila —
 * odhalil to test na 1×4 gride, nie oko.
 */
export function findGutterBands(
  values: number[],
  options: {
    windowShare?: number;
    relativeToLocal?: number;
    absoluteMax?: number;
    minShare?: number;
    maxShare?: number;
  } = {},
): Array<{ start: number; end: number }> {
  const windowShare = options.windowShare ?? 0.1;
  const relativeToLocal = options.relativeToLocal ?? 0.5;
  const absoluteMax = options.absoluteMax ?? 6;
  const minShare = options.minShare ?? 0.005;
  const maxShare = options.maxShare ?? 0.35;
  if (values.length === 0) return [];

  const w = Math.max(3, Math.round(values.length * windowShare));
  const isGutter = (i: number): boolean => {
    const lo = Math.max(0, i - w);
    const hi = Math.min(values.length - 1, i + w);
    const win = values.slice(lo, hi + 1).sort((a, b) => a - b);
    const localMedian = win[Math.floor(win.length / 2)];
    return values[i] <= absoluteMax || values[i] <= localMedian * relativeToLocal;
  };

  const bands: Array<{ start: number; end: number }> = [];
  let start = -1;
  for (let i = 0; i < values.length; i++) {
    const gut = isGutter(i);
    if (gut && start < 0) start = i;
    if (!gut && start >= 0) {
      bands.push({ start, end: i - 1 });
      start = -1;
    }
  }
  if (start >= 0) bands.push({ start, end: values.length - 1 });

  const minLen = Math.max(2, Math.round(values.length * minShare));
  const maxLen = Math.max(4, Math.round(values.length * maxShare));
  return bands.filter((b) => {
    const len = b.end - b.start + 1;
    return len >= minLen && len <= maxLen;
  });
}

/**
 * Rozdelí obrázok na panely **rovnomerne** (keď počet riadkov/stĺpcov zadá používateľ
 * alebo keď sa medzery nedajú nájsť). Nikdy nevracia prázdne panely.
 */
export function evenPanes(width: number, height: number, rows: number, cols: number): PaneRect[] {
  const r = Math.max(1, Math.min(12, Math.round(rows)));
  const c = Math.max(1, Math.min(12, Math.round(cols)));
  const paneW = Math.floor(width / c);
  const paneH = Math.floor(height / r);
  const panes: PaneRect[] = [];
  let index = 0;
  for (let row = 0; row < r; row++) {
    for (let col = 0; col < c; col++) {
      panes.push({
        index,
        row,
        col,
        x: col * paneW,
        y: row * paneH,
        // Posledný panel dostane zvyšok, aby sa nestratil ani jeden pixel.
        width: col === c - 1 ? width - col * paneW : paneW,
        height: row === r - 1 ? height - row * paneH : paneH,
      });
      index += 1;
    }
  }
  return panes;
}

/** Priemer a rozptyl lumy na vzorke pixelov (stride 2) — pre kontrolu „jednofarebnosti“. */
export function lumaStats(
  pixels: Uint8ClampedArray | Uint8Array | number[],
  width: number,
  height: number,
  region: { x: number; y: number; width: number; height: number },
  channels: 3 | 4 = 4,
): { mean: number; variance: number; samples: number } {
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = region.y; y < region.y + region.height; y++) {
    const rowBase = y * width * channels;
    for (let x = region.x; x < region.x + region.width; x++) {
      const i = rowBase + x * channels;
      const l = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
      sum += l;
      sumSq += l * l;
      n += 1;
    }
  }
  if (n === 0) return { mean: 0, variance: 0, samples: 0 };
  const mean = sum / n;
  return { mean, variance: Math.max(0, sumSq / n - mean * mean), samples: n };
}

/**
 * Skutočná medzera je **jednofarebná plocha** — tmavý pruh vo filme (obzor, most, tieň)
 * je síce tmavý, ale nie je jednofarebný. Presne tento rozdiel rozhodol na reálnych
 * snímkach: bez neho appka videla 8 panelov namiesto 4, pretože nočná scéna má tmavý
 * pruh vodorovne naprieč všetkými panelmi.
 */
export function bandIsFlat(
  pixels: Uint8ClampedArray | Uint8Array | number[],
  width: number,
  height: number,
  band: { start: number; end: number },
  axis: "row" | "col",
  imageVariance: number,
  channels: 3 | 4 = 4,
): boolean {
  const region =
    axis === "row"
      ? { x: 0, y: band.start, width, height: band.end - band.start + 1 }
      : { x: band.start, y: 0, width: band.end - band.start + 1, height };
  const { variance } = lumaStats(pixels, width, height, region, channels);
  const limit = Math.max(6, imageVariance * 0.3);
  return variance <= limit;
}

/**
 * Hrúbky medzier musia byť **rovnaké** (moodboard má rovnomerné medzery). Keď sa jedna
 * „medzera“ výrazne líši (typicky preto, že sa zlúčila s tmavou časťou scény), grid sa
 * považuje za nenájdený — používateľ potom zadá riadky a stĺpce a meria sa presne.
 */
export function bandsLookConsistent(bands: Array<{ start: number; end: number }>): boolean {
  if (bands.length <= 1) return true;
  const lengths = bands.map((b) => b.end - b.start + 1).sort((a, b) => a - b);
  const median = lengths[Math.floor(lengths.length / 2)];
  const tolerance = Math.max(4, median * 1.5);
  return lengths.every((len) => Math.abs(len - median) <= tolerance);
}

/** Panely majú byť približne rovnako veľké — inak to nie je grid, ale náhodné pruhy. */
export function segmentsLookRegular(segments: Array<{ start: number; end: number }>): boolean {
  if (segments.length <= 1) return true;
  const sizes = segments.map((s) => s.end - s.start + 1).sort((a, b) => a - b);
  const median = sizes[Math.floor(sizes.length / 2)];
  if (median <= 0) return false;
  return sizes.every((size) => size >= median * 0.6 && size <= median * 1.4);
}

/**
 * Rozdelí dĺžku na **úseky obsahu** okolo medzier. Medzery sa vynechávajú úplne —
 * panel musí obsahovať len obraz, nie čierny pruh (inak by jeho jas aj šírka klamali).
 */
export function contentSegments(
  length: number,
  bands: Array<{ start: number; end: number }>,
  minSegment = 8,
): Array<{ start: number; end: number }> {
  const segments: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (const band of bands) {
    const end = band.start - 1;
    if (end - cursor + 1 >= minSegment) segments.push({ start: cursor, end });
    cursor = Math.max(cursor, band.end + 1);
  }
  if (length - cursor >= minSegment) segments.push({ start: cursor, end: length - 1 });
  return segments;
}

/**
 * Rozdelí obrázok na panely podľa **tmavých medzier**; keď sa medzery nájdu,
 * hranice panelov sú presne medzi nimi (nie rovnomerne).
 */
export function splitByGutters(
  pixels: Uint8ClampedArray | Uint8Array | number[],
  width: number,
  height: number,
  options: MoodboardOptions = {},
): GridSplitResult | null {
  const { rows: rowLuma, cols: colLuma } = rowAndColumnLuma(pixels, width, height);
  const rowBands = findGutterBands(rowLuma);
  const colBands = findGutterBands(colLuma);

  // Medzery musia byť vnútri obrázka (okrajové čierne pruhy nie sú medzera medzi panelmi).
  const insideRows = rowBands.filter((b) => b.start > 0 && b.end < height - 1);
  const insideCols = colBands.filter((b) => b.start > 0 && b.end < width - 1);
  if (insideRows.length === 0 && insideCols.length === 0) return null;

  // Medzera musí byť jednofarebná plocha (nie tmavý pruh vo filme) — inak by nočná
  // scéna „rozdelila“ každý panel na dva a appka by merala vymyslené panely.
  const whole = lumaStats(pixels, width, height, { x: 0, y: 0, width, height });
  const innerRowBands = insideRows.filter((b) => bandIsFlat(pixels, width, height, b, "row", whole.variance));
  const innerColBands = insideCols.filter((b) => bandIsFlat(pixels, width, height, b, "col", whole.variance));
  if (innerRowBands.length === 0 && innerColBands.length === 0) return null;

  // Z medzier sa dajú poskladať až tri rozdelenia: len podľa stĺpcov, len podľa riadkov,
  // alebo podľa oboch. Keď obrázok obsahuje vlastné tmavé pruhy (nočná scéna), vznikne
  // aj „medzera“ vnútri panelov — a rozdelenie podľa oboch by dalo dvojnásobok panelov.
  // Preto sa zostavia všetky možnosti, overí sa pravidelnosť a vyberie sa **tá, ktorá
  // dáva panely s pomerom strán najbližším očakávaniu** (`preferAspect`). Bez očakávania
  // sa vyberie možnosť s panelmi najbližšie k štvorcu (moodboard býva mriežka).
  // Presne tu appka predtým hlásila 8 panelov namiesto 4 na reálnych snímkach.
  if (!bandsLookConsistent([...innerRowBands, ...innerColBands])) return null;

  const variants: Array<{
    rowSegments: Array<{ start: number; end: number }>;
    colSegments: Array<{ start: number; end: number }>;
    rowBands: Array<{ start: number; end: number }>;
    colBands: Array<{ start: number; end: number }>;
  }> = [];
  const pushVariant = (rows: typeof innerRowBands, cols: typeof innerColBands) => {
    if (rows.length === 0 && cols.length === 0) return;
    const rs = contentSegments(height, rows);
    const cs = contentSegments(width, cols);
    if (!segmentsLookRegular(rs) || !segmentsLookRegular(cs)) return;
    if (rs.length * cs.length < 2) return;
    variants.push({ rowSegments: rs, colSegments: cs, rowBands: rows, colBands: cols });
  };
  pushVariant([], innerColBands);
  pushVariant(innerRowBands, []);
  pushVariant(innerRowBands, innerColBands);
  if (variants.length === 0) return null;

  const medianSize = (segments: Array<{ start: number; end: number }>) => {
    const sizes = segments.map((x) => x.end - x.start + 1).sort((a, b) => a - b);
    return sizes[Math.floor(sizes.length / 2)] || 1;
  };
  const scoreOf = (v: (typeof variants)[number]): number => {
    const paneW = medianSize(v.colSegments);
    const paneH = medianSize(v.rowSegments);
    const aspect = paneW / paneH;
    const target = options.preferAspect && options.preferAspect > 0 ? options.preferAspect : 1;
    return Math.abs(Math.log(aspect / target));
  };
  variants.sort((a, b) => scoreOf(a) - scoreOf(b) || a.rowSegments.length * a.colSegments.length - b.rowSegments.length * b.colSegments.length);
  const chosen = variants[0];

  // Keď ani najlepšia možnosť nesedí na očakávaný pomer (viac než ±40 %), radšej
  // priznáme, že grid sa nedá určiť — vymyslené panely sú horšie než otázka.
  if (options.preferAspect && options.preferAspect > 0) {
    const paneW = medianSize(chosen.colSegments);
    const paneH = medianSize(chosen.rowSegments);
    const ratio = paneW / paneH / options.preferAspect;
    if (ratio < 0.6 || ratio > 1.4) return null;
  }

  const { rowSegments, colSegments, rowBands: chosenRowBands, colBands: chosenColBands } = chosen;
  const innerRowBandsFinal = chosenRowBands;
  const innerColBandsFinal = chosenColBands;

  const panes: PaneRect[] = [];
  let index = 0;
  for (let r = 0; r < rowSegments.length; r++) {
    for (let c = 0; c < colSegments.length; c++) {
      const { start: x, end: xEnd } = colSegments[c];
      const { start: y, end: yEnd } = rowSegments[r];
      const w = xEnd - x + 1;
      const h = yEnd - y + 1;
      if (w < 8 || h < 8) continue; // príliš tenké na to, aby to bol panel
      panes.push({ index, row: r, col: c, x, y, width: w, height: h });
      index += 1;
    }
  }
  if (panes.length < 2) return null;

  const gutterPixels =
    innerRowBandsFinal.reduce((s, b) => s + (b.end - b.start + 1), 0) * width +
    innerColBandsFinal.reduce((s, b) => s + (b.end - b.start + 1), 0) * height;
  const totalPixels = width * height;

  return {
    panes,
    rows: rowSegments.length,
    cols: colSegments.length,
    modeSk:
      `panely nájdené podľa medzier (${innerRowBandsFinal.length} vodorovných, ${innerColBandsFinal.length} zvislých)` +
      (variants.length > 1
        ? options.preferAspect
          ? `, vybrané rozdelenie najlepšie sedí na pomer strán ${options.preferAspect.toFixed(2)}`
          : ", vybrané rozdelenie s panelmi najbližšie k štvorcu"
        : ""),
    gutterShare: Math.round((gutterPixels / totalPixels) * 1000) / 1000,
  };
}

// ---------------------------------------------------------------------------
// Hlavné meranie
// ---------------------------------------------------------------------------

/** Zmeria jednu oblasť obrázka tak, že si z nej najprv vyreže pixely. */
export function analyzePane(
  pixels: Uint8ClampedArray | Uint8Array | number[],
  imageWidth: number,
  pane: PaneRect,
  channels: 3 | 4 = 4,
  maxPixels = 400_000,
): ReferenceAnalysisOutcome {
  // Pri veľkých paneloch meriame každý n-tý pixel (analýza je štatistická).
  const total = pane.width * pane.height;
  const step = Math.max(1, Math.ceil(Math.sqrt(total / maxPixels)));
  const outW = Math.max(1, Math.floor(pane.width / step));
  const outH = Math.max(1, Math.floor(pane.height / step));
  const buf = new Uint8ClampedArray(outW * outH * 4);

  let o = 0;
  for (let y = 0; y < outH; y++) {
    const srcRow = (pane.y + y * step) * imageWidth * channels;
    for (let x = 0; x < outW; x++) {
      const src = srcRow + (pane.x + x * step) * channels;
      buf[o] = pixels[src];
      buf[o + 1] = pixels[src + 1];
      buf[o + 2] = pixels[src + 2];
      buf[o + 3] = 255;
      o += 4;
    }
  }
  return analyzeReferencePixels(buf, outW, outH, { channels: 4 });
}

/**
 * Zmeria grid/moodboard: nájde panely a každý zmeria **zvlášť**.
 * Ak má používateľ presnú predstavu (napr. grid 1×4 9:16), počet riadkov/stĺpcov
 * sa použije priamo — potom je delenie dohodnuté, nie merané (a tak to aj hlási).
 */
export function analyzeMoodboard(
  pixels: Uint8ClampedArray | Uint8Array | number[],
  width: number,
  height: number,
  options: MoodboardOptions = {},
): MoodboardAnalysis {
  const notesSk: string[] = [];
  const empty: MoodboardAnalysis = {
    available: false,
    reasonSk: "NOT AVAILABLE — nemám pixely obrázka.",
    width,
    height,
    rows: 0,
    cols: 0,
    modeSk: "—",
    gutterShare: 0,
    panels: [],
    measuredPanels: 0,
    average: null,
    notesSk,
  };

  if (!pixels || !width || !height || pixels.length < width * height * 3) {
    return { ...empty, reasonSk: "NOT AVAILABLE — pixely nesedia s rozmermi obrázka." };
  }

  let split: GridSplitResult;
  if (options.rows || options.cols) {
    const rows = options.rows ?? 1;
    const cols = options.cols ?? Math.max(1, Math.round((width / height) * rows));
    const panes = evenPanes(width, height, rows, cols);
    split = {
      panes,
      rows: Math.max(1, Math.min(12, rows)),
      cols: Math.max(1, Math.min(12, cols)),
      modeSk: `panely podľa zadania používateľa (${rows}×${cols}) — delenie je dohodnuté, nie namerané`,
      gutterShare: 0,
    };
  } else {
    const detected = splitByGutters(pixels, width, height, options);
    if (!detected) {
      return {
        ...empty,
        modeSk: "jeden panel",
        notesSk: [
          "Grid sa nepodarilo určiť spoľahlivo (medzery nie sú jednoznačné alebo panely nesedia na očakávaný pomer). " +
            "Meriam to ako jednu referenciu. Ak je to grid, zadaj počet riadkov a stĺpcov a zmeriam panely zvlášť.",
        ],
      };
    }
    split = detected;
  }

  const panels: MoodboardPanel[] = [];
  for (const pane of split.panes) {
    const outcome = analyzePane(pixels, width, pane, 4, options.maxPanelPixels ?? 400_000);
    if (!outcome.available) {
      notesSk.push(`Panel ${pane.index + 1} sa nezmeral (${outcome.reasonSk}).`);
      continue;
    }
    panels.push({ ...pane, analysis: outcome });
  }

  if (panels.length === 0) {
    return { ...empty, modeSk: split.modeSk, notesSk: [...notesSk, "Nezmeral sa ani jeden panel."] };
  }

  const avg = (pick: (a: ReferenceAnalysis) => number) =>
    Math.round((panels.reduce((s, p) => s + pick(p.analysis), 0) / panels.length) * 1000) / 1000;

  // Poctivo: priemer cez panely je priemer, nie „štýl moodboardu zmeraný“.
  if (panels.length > 1) {
    const brightnesses = panels.map((p) => p.analysis.brightness);
    const spread = Math.max(...brightnesses) - Math.min(...brightnesses);
    // Pozor na zátvorky: `"text" + spread >= 25 ? A : B` sa vyhodnotí ako
    // `("text" + spread) >= 25 ? A : B`, čiže vždy B. Presne tá chyba tu bola
    // (test ju odhalil: pri rozdieli 240 appka tvrdila, že panely „držia pri sebe“).
    const roundedSpread = Math.round(spread);
    // Rozhoduje sa podľa ZAOKRÚHLENÉHO rozdielu — inak text mohol hlásiť „líšia sa o 25“
    // a pritom tvrdiť, že sa držia pri sebe (24,6 sa zaokrúhli na 25).
    const verdictSk =
      roundedSpread >= 25
        ? "To je veľa — priemer nižšie neopisuje ani jednu scénu, pozeraj sa na panely."
        : "Držia sa pri sebe, takže priemer dáva zmysel.";
    notesSk.push(
      `Panely sa v jase líšia o ${roundedSpread} úrovní (${Math.round(Math.min(...brightnesses))}–${Math.round(Math.max(...brightnesses))}). ${verdictSk}`,
    );
  }

  return {
    available: true,
    width,
    height,
    rows: split.rows,
    cols: split.cols,
    modeSk: split.modeSk,
    gutterShare: split.gutterShare,
    panels,
    measuredPanels: panels.length,
    average: {
      brightness: avg((a) => a.brightness),
      contrast: avg((a) => a.contrast),
      saturation: avg((a) => a.saturation),
      warmth: avg((a) => a.warmth),
      edgeDensity: avg((a) => a.edgeDensity),
    },
    notesSk,
  };
}

/** Zoznam farieb naprieč panelmi: farba + v koľkých paneloch sa objavila. */
export function panelPaletteSpread(board: MoodboardAnalysis): Array<{
  hex: string;
  panels: number;
  averageCoverage: number;
}> {
  if (!board.available || board.panels.length === 0) return [];
  const map = new Map<string, { panels: number; coverage: number }>();
  for (const panel of board.panels) {
    for (const color of panel.analysis.palette) {
      const entry = map.get(color.hex) ?? { panels: 0, coverage: 0 };
      entry.panels += 1;
      entry.coverage += color.coverage;
      map.set(color.hex, entry);
    }
  }
  return [...map.entries()]
    .map(([hex, e]) => ({
      hex,
      panels: e.panels,
      averageCoverage: Math.round((e.coverage / board.panels.length) * 1000) / 1000,
    }))
    .sort((a, b) => b.panels - a.panels || b.averageCoverage - a.averageCoverage || a.hex.localeCompare(b.hex));
}

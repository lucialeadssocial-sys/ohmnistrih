/**
 * REFERENCE IMAGE — REÁLNA PIXELOVÁ ANALÝZA (krok 11 Reality Gate).
 *
 * Prečo tento modul existuje: dovtedy „analýza referencie" hádala štýl **podľa mena
 * súboru** (`ReferenceStyleAnalyzer`). Pri pravidle „referenčná analýza bez pixelovej
 * analýzy = NOT AVAILABLE" to bolo neprijateľné — appka tvrdila veci, ktoré nemala z čoho
 * zistiť.
 *
 * Preto je tu **jedna čistá funkcia nad pixelmi** (žiadny DOM, žiadny canvas, žiadny
 * server, žiadny provider). Rovnakú funkciu volá prehliadač (pixely z canvasu) aj
 * verifikačný runner (pixely z ffmpeg rawvideo) — nemôže sa teda stať, že by sa dve
 * cesty rozslišli.
 *
 * Čo MERÁ (a preto to smie tvrdiť):
 *  - dominantné farby (kvantovaný histogram, 32 úrovní na kanál, zlučovanie blízkych),
 *  - jas a kontrast (luma podľa Rec. 709, smerodajná odchýlka),
 *  - sýtosť, teplotu (červená vs. modrá), podiel tmavých/svetlých pixelov,
 *  - hustotu hrán (gradient lumy = „plná vs. pokojná kompozícia"),
 *  - jas v hornom / strednom / dolnom pásme (kde je v referencii „ťažisko").
 *
 * Čo NEMERÁ (a preto to NETVRDÍ): meno a veľkosť fontu, pohyb/easing/strih, zvuk,
 * sémantiku obsahu. Presne to je v `notDetectableSk`.
 */

import type { StyleRecipe } from "./styleRecipes";

// ---------------------------------------------------------------------------
// Typy
// ---------------------------------------------------------------------------

/** Jedna farba palety — nameraná, s podielom pokrytia. */
export interface ReferenceColor {
  hex: string;
  r: number;
  g: number;
  b: number;
  /** 0–1: akú časť analyzovaných pixelov táto farba pokrýva. */
  coverage: number;
  /** 0–1: sýtosť (HSV). */
  saturation: number;
}

export interface ReferenceBand {
  labelSk: string;
  /** Priemerný jas pásma (0–255). */
  brightness: number;
}

export interface ReferenceAnalysis {
  available: true;
  width: number;
  height: number;
  /** Koľko pixelov sa naozaj analyzovalo. */
  pixels: number;
  /** Priemerný jas (0–255). */
  brightness: number;
  /** Smerodajná odchýlka jasu (0–128) — čím vyššia, tým väčší kontrast. */
  contrast: number;
  /** Priemerná sýtosť (0–1). */
  saturation: number;
  /** Teplota: kladné = teplejšie (viac červenej), záporné = chladnejšie. */
  warmth: number;
  darkRatio: number;
  midRatio: number;
  lightRatio: number;
  /** 0–1: priemerná veľkosť gradientu lumy (hustota hrán). */
  edgeDensity: number;
  /** Najviac zastúpené farby (max 6), zoradené podľa pokrytia. */
  palette: ReferenceColor[];
  /** Najsýtejšia farba s rozumným pokrytím — kandidát na zvýraznenie. */
  accent: ReferenceColor | null;
  bands: ReferenceBand[];
  /** Ľudský popis nameraného (po slovensky, bez dohadov). */
  moodSk: string;
  /** Konkrétne odporúčania odvodené z čísel (každé s číslom). */
  hintsSk: string[];
  /** Čo sa z obrázka zmerať nedá — aby appka netvrdila viac, než vie. */
  notDetectableSk: string[];
  /** Akou metódou sa meralo (pre report a dôveru). */
  analysisMethodSk: string;
}

export interface ReferenceUnavailable {
  available: false;
  reasonSk: string;
}

export type ReferenceAnalysisOutcome = ReferenceAnalysis | ReferenceUnavailable;

export interface AnalyzeReferenceOptions {
  /** Kanály na pixel: 4 = RGBA (predvolené), 3 = RGB. */
  channels?: 3 | 4;
  /** Koľko farieb najviac vrátiť (predvolene 6). */
  maxColors?: number;
  /** Vzorkovanie: každý `stride`-tý pixel (kvôli rýchlosti na veľkých obrázkoch). */
  stride?: number;
}

// ---------------------------------------------------------------------------
// Pomocné prevody
// ---------------------------------------------------------------------------

/** Luma podľa Rec. 709 (rovnaký vzorec, aký používa video). */
export function luma709(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Absolútna farebnosť (max − min kanál, 0–255) — stabilná aj pri tmavých farbách. */
export function absoluteChroma(c: { r: number; g: number; b: number }): number {
  return Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
}

/** Sýtosť v HSV (0–1). */
export function saturationOf(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

export function toHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

/** Vzdialenosť dvoch farieb v RGB (euklidovsky) — na zlučovanie podobných odtieňov. */
function colorDistance(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// ---------------------------------------------------------------------------
// Analýza
// ---------------------------------------------------------------------------

/**
 * Zmeria referenčný obrázok z jeho pixelov. Bez pixelov sa **nič nevymýšľa** —
 * vráti sa `available: false` s dôvodom.
 */
export function analyzeReferencePixels(
  pixels: Uint8ClampedArray | Uint8Array | number[],
  width: number,
  height: number,
  options: AnalyzeReferenceOptions = {},
): ReferenceAnalysisOutcome {
  const channels = options.channels ?? 4;
  const maxColors = Math.max(1, Math.min(12, options.maxColors ?? 6));
  const stride = Math.max(1, Math.floor(options.stride ?? 1));

  if (!pixels || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { available: false, reasonSk: "Chýbajú pixely alebo rozmery obrázka — analýza sa nedá spraviť." };
  }
  const needed = width * height * channels;
  if (pixels.length < needed) {
    return {
      available: false,
      reasonSk: `Pixelové dáta sú kratšie, než hovoria rozmery (${pixels.length} < ${needed}) — analýza by klamala.`,
    };
  }

  const buckets = new Uint32Array(32768); // 32×32×32 (5 bitov na kanál)
  const bucketSumR = new Float64Array(32768);
  const bucketSumG = new Float64Array(32768);
  const bucketSumB = new Float64Array(32768);

  let sumLuma = 0;
  let sumLuma2 = 0;
  let sumSat = 0;
  let sumR = 0;
  let sumB = 0;
  let dark = 0;
  let mid = 0;
  let light = 0;
  let sampled = 0;

  const bandCounts = [0, 0, 0];
  const bandLuma = [0, 0, 0];

  for (let y = 0; y < height; y += stride) {
    const rowBase = y * width * channels;
    for (let x = 0; x < width; x += stride) {
      const i = rowBase + x * channels;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const l = luma709(r, g, b);

      sumLuma += l;
      sumLuma2 += l * l;
      sumSat += saturationOf(r, g, b);
      sumR += r;
      sumB += b;
      if (l < 64) dark++;
      else if (l < 192) mid++;
      else light++;

      const band = Math.min(2, Math.floor((y / height) * 3));
      bandCounts[band]++;
      bandLuma[band] += l;

      const bucket = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      buckets[bucket]++;
      bucketSumR[bucket] += r;
      bucketSumG[bucket] += g;
      bucketSumB[bucket] += b;
      sampled++;
    }
  }

  if (sampled === 0) {
    return { available: false, reasonSk: "Nepodarilo sa prečítať ani jeden pixel — analýza sa preskakuje." };
  }

  const brightness = sumLuma / sampled;
  const variance = Math.max(0, sumLuma2 / sampled - brightness * brightness);
  const contrast = Math.sqrt(variance);

  // --- Paleta: najčastejšie odtiene, blízke farby sa zlučujú -------------------
  const order = Array.from(buckets.keys())
    .filter((k) => buckets[k] > 0)
    .sort((a, b) => buckets[b] - buckets[a]);

  const palette: ReferenceColor[] = [];
  for (const k of order) {
    if (palette.length >= maxColors) break;
    const count = buckets[k];
    const r = bucketSumR[k] / count;
    const g = bucketSumG[k] / count;
    const b = bucketSumB[k] / count;
    const existing = palette.find((c) => colorDistance(c, { r, g, b }) < 48);
    if (existing) {
      // Zlúčime do už prijatej farby (vážený priemer — aby hex sedel s tým, čo vidno).
      const totalCount = existing.coverage * sampled;
      const newCount = totalCount + count;
      existing.r = (existing.r * totalCount + r * count) / newCount;
      existing.g = (existing.g * totalCount + g * count) / newCount;
      existing.b = (existing.b * totalCount + b * count) / newCount;
      existing.hex = toHex(existing.r, existing.g, existing.b);
      existing.saturation = saturationOf(existing.r, existing.g, existing.b);
      existing.coverage = newCount / sampled;
      continue;
    }
    palette.push({
      hex: toHex(r, g, b),
      r,
      g,
      b,
      coverage: count / sampled,
      saturation: saturationOf(r, g, b),
    });
  }
  palette.sort((a, b) => b.coverage - a.coverage);
  // Farby s mizivým pokrytím sú šum z kompresie — držíme len tie, čo naozaj niečo
  // pokrývajú (a nikdy menej než tri farby, aby paleta nebola prázdna).
  const meaningful = palette.filter((c) => c.coverage >= 0.005);
  const finalPalette = meaningful.length >= 3 ? meaningful : palette.slice(0, Math.max(3, meaningful.length));

  // Zvýraznenie musí byť aj VIDIEŤ: samotná HSV sýtosť nestačí, lebo skoro-čierna
  // farba (napr. #110D0B) má vysokú relatívnu sýtosť, ale v obraze pôsobí ako čierna.
  // Preto sa počíta **absolútna farebnosť** (max−min) a vyžaduje sa aj rozumný jas.
  // Odhalil to reálny beh na referenčnom videe — nie test.
  const accentCandidates = finalPalette.filter(
    (c) => c.coverage >= 0.02 && absoluteChroma(c) >= 25 && luma709(c.r, c.g, c.b) >= 48,
  );
  const accent =
    accentCandidates.length > 0
      ? accentCandidates.reduce((best, c) => (absoluteChroma(c) > absoluteChroma(best) ? c : best))
      : null;

  // --- Hustota hrán (gradient lumy) ------------------------------------------
  let edgeSum = 0;
  let edgeSamples = 0;
  const edgeStride = Math.max(stride, Math.ceil(Math.sqrt((width * height) / 40000)));
  for (let y = 0; y < height - edgeStride; y += edgeStride) {
    for (let x = 0; x < width - edgeStride; x += edgeStride) {
      const i = (y * width + x) * channels;
      const iRight = (y * width + x + edgeStride) * channels;
      const iDown = ((y + edgeStride) * width + x) * channels;
      const l = luma709(pixels[i], pixels[i + 1], pixels[i + 2]);
      const lRight = luma709(pixels[iRight], pixels[iRight + 1], pixels[iRight + 2]);
      const lDown = luma709(pixels[iDown], pixels[iDown + 1], pixels[iDown + 2]);
      edgeSum += (Math.abs(lRight - l) + Math.abs(lDown - l)) / 2;
      edgeSamples++;
    }
  }
  const edgeDensity = edgeSamples > 0 ? Math.min(1, edgeSum / edgeSamples / 255) : 0;

  const bands: ReferenceBand[] = [
    { labelSk: "hore", brightness: bandCounts[0] ? bandLuma[0] / bandCounts[0] : 0 },
    { labelSk: "v strede", brightness: bandCounts[1] ? bandLuma[1] / bandCounts[1] : 0 },
    { labelSk: "dole", brightness: bandCounts[2] ? bandLuma[2] / bandCounts[2] : 0 },
  ];

  const darkRatio = dark / sampled;
  const midRatio = mid / sampled;
  const lightRatio = light / sampled;
  const warmth = (sumR - sumB) / sampled;
  const saturation = sumSat / sampled;

  const moodSk = describeMood({ darkRatio, lightRatio, saturation, warmth, contrast });
  const hintsSk = hintsFromNumbers({
    darkRatio,
    lightRatio,
    edgeDensity,
    contrast,
    saturation,
    warmth,
    palette: finalPalette,
    accent,
    bands,
  });

  return {
    available: true,
    width,
    height,
    pixels: sampled,
    brightness: round2(brightness),
    contrast: round2(contrast),
    saturation: round3(saturation),
    warmth: round2(warmth),
    darkRatio: round3(darkRatio),
    midRatio: round3(midRatio),
    lightRatio: round3(lightRatio),
    edgeDensity: round3(edgeDensity),
    palette: finalPalette.map((c) => ({ ...c, coverage: round3(c.coverage), saturation: round3(c.saturation) })),
    accent: accent ? { ...accent, coverage: round3(accent.coverage), saturation: round3(accent.saturation) } : null,
    bands: bands.map((b) => ({ ...b, brightness: round2(b.brightness) })),
    moodSk,
    hintsSk,
    notDetectableSk: [
      "Meno ani veľkosť fontu sa z obrázka nedajú určiť spoľahlivo — preto ich netvrdím (v referenciách som ich určil len vizuálne).",
      "Pohyb, easing a rytmus strihu sa z jedného obrázka zmerať nedajú — na to treba video.",
      "Zvuk a hudbu z obrázka nezískam.",
      "Sémantiku (čo je na obrázku ponuka a čo dôkaz) neviem — viem farby, jas, kontrast a hustotu hrán.",
    ],
    analysisMethodSk:
      `Reálne pixely (${sampled} vzoriek, krok ${stride}): kvantovaný histogram 32×32×32, luma Rec. 709, ` +
      "kontrast = smerodajná odchýlka, hustota hrán = gradient lumy, pásma po tretinách výšky.",
  };
}

// ---------------------------------------------------------------------------
// Popis a odporúčania (všetko s číslami z merania)
// ---------------------------------------------------------------------------

function describeMood(m: {
  darkRatio: number;
  lightRatio: number;
  saturation: number;
  warmth: number;
  contrast: number;
}): string {
  const base =
    m.darkRatio >= 0.5
      ? `tmavý editorial (${Math.round(m.darkRatio * 100)} % pixelov je tmavých)`
      : m.lightRatio >= 0.5
        ? `svetlý a čistý (${Math.round(m.lightRatio * 100)} % pixelov je svetlých)`
        : `stredne tmavý (${Math.round(m.darkRatio * 100)} % tmavých, ${Math.round(m.lightRatio * 100)} % svetlých)`;
  const temp = m.warmth > 12 ? "teplý podtón" : m.warmth < -12 ? "studený podtón" : "neutrálna teplota";
  const sat = m.saturation >= 0.45 ? "sýte farby" : m.saturation <= 0.15 ? "takmer bez farby" : "mierne sýte farby";
  const con = m.contrast >= 60 ? "vysoký kontrast" : m.contrast <= 25 ? "nízky kontrast" : "stredný kontrast";
  return `${base}, ${temp}, ${sat}, ${con}.`;
}

function hintsFromNumbers(n: {
  darkRatio: number;
  lightRatio: number;
  edgeDensity: number;
  contrast: number;
  saturation: number;
  warmth: number;
  palette: ReferenceColor[];
  accent: ReferenceColor | null;
  bands: ReferenceBand[];
}): string[] {
  const hints: string[] = [];
  const paletteHex = n.palette.slice(0, 4).map((c) => c.hex).join(" · ");
  hints.push(`Nameraná paleta: ${paletteHex} (podľa pokrytia v obrázku).`);

  if (n.darkRatio >= 0.4) {
    hints.push(
      `Podklad je prevažne tmavý (${Math.round(n.darkRatio * 100)} %) — svetlé titulky na ňom budú čitateľné bez podkladovej dosky.`,
    );
  } else if (n.lightRatio >= 0.4) {
    hints.push(
      `Podklad je prevažne svetlý (${Math.round(n.lightRatio * 100)} %) — titulky potrebujú tmavú farbu alebo podkladovú dosku.`,
    );
  }

  if (n.accent) {
    hints.push(
      `Najsýtejšia farba je ${n.accent.hex} (${Math.round(n.accent.coverage * 100)} % plochy) — vhodná na zvýraznenie jedného slova v titulku.`,
    );
  } else {
    hints.push(
      "Obrázok nemá VÝRAZNÚ sýtu farbu (ani jedna dostatočne pokrytá farba nemá farebnosť ≥ 25 a jas ≥ 48) — " +
        "zvýraznenie rieš v svetlo-tmavom kontraste, nie farbou.",
    );
  }

  hints.push(
    n.edgeDensity > 0.18
      ? `Hustota hrán ${n.edgeDensity.toFixed(2)} — kompozícia je plná; drž menej prvkov na jednu scénu.`
      : `Hustota hrán ${n.edgeDensity.toFixed(2)} — kompozícia je pokojná; unesie aj vrstvenie (fotky, diagramy).`,
  );

  const brightest = n.bands.reduce((a, b) => (b.brightness > a.brightness ? b : a));
  const darkest = n.bands.reduce((a, b) => (b.brightness < a.brightness ? b : a));
  const bandSpread = brightest.brightness - darkest.brightness;
  if (bandSpread >= 12) {
    hints.push(
      `Pásma sa líšia o ${bandSpread.toFixed(0)} jasu: najsvetlejšie ${brightest.labelSk} (${brightest.brightness.toFixed(0)}), ` +
        `najtmavšie ${darkest.labelSk} (${darkest.brightness.toFixed(0)}) — v tom tmavšom mieste je prirodzené miesto pre text.`,
    );
  } else {
    // Vyrovnaný jas znamená, že sa z pásiem NEDÁ určiť, kam patrí text. Predtým tu
    // appka tvrdila „najtmavšie hore (245)" pri jednofarebnom obrázku — nezmysel.
    hints.push(
      `Jas pásiem je vyrovnaný (rozdiel ${bandSpread.toFixed(0)} < 12) — z pásiem sa nedá určiť, kam patrí text; ` +
        "rozhodni podľa obsahu scény.",
    );
  }
  return hints;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Paleta pre recept (bez nového modelu — recept je len slovník)
// ---------------------------------------------------------------------------

/**
 * Z nameranej analýzy poskladá paletu pre **existujúci** `StyleRecipe`:
 * základ (najväčšia plocha) → text (najkontrastnejší) → zvýraznenie → doplnok.
 * Nič sa nevymýšľa: každá farba je z obrázka.
 */
export function referencePaletteForRecipe(analysis: ReferenceAnalysis): string[] {
  const byCoverage = analysis.palette.slice().sort((a, b) => b.coverage - a.coverage);
  const base = byCoverage[0];
  const rest = byCoverage.slice(1);
  // Text: najvzdialenejšia farba od základu (najväčší kontrast), inak biela/čierna.
  const text =
    rest.length > 0
      ? rest.reduce((best, c) => (colorDistance(c, base) > colorDistance(best, base) ? c : best))
      : { hex: base.r + base.g + base.b > 380 ? "#111111" : "#FFFFFF" };
  const out = [base.hex, text.hex];
  if (analysis.accent) out.push(analysis.accent.hex);
  const secondary = rest.find((c) => c.hex !== text.hex && c.hex !== analysis.accent?.hex);
  if (secondary) out.push(secondary.hex);
  return Array.from(new Set(out)).slice(0, 5);
}

/**
 * Vráti **kópiu** receptu s nameranou paletou. Ostatné vlastnosti receptu sa nemenia —
 * analýza obrázka vie farby, nie pohyb ani typografiu, a nič viac sa neprepisuje.
 */
export function applyReferencePalette<T extends Pick<StyleRecipe, "colorPalette" | "id" | "name" | "labelSk">>(
  recipe: T,
  analysis: ReferenceAnalysis,
  sourceNameSk: string,
): T {
  return {
    ...recipe,
    id: "CUSTOM",
    name: `${recipe.name} + referencia`,
    labelSk: `${recipe.labelSk} + referencia`,
    colorPalette: referencePaletteForRecipe(analysis),
  };
}

// ---------------------------------------------------------------------------
// Style Board (dáta pre desku — žiadne generovanie obrázkov)
// ---------------------------------------------------------------------------

export interface StyleBoardSwatch {
  hex: string;
  coveragePercent: number;
  saturationPercent: number;
  roleSk: string;
}

export interface StyleBoardRow {
  labelSk: string;
  valueSk: string;
}

export interface StyleBoardData {
  titleSk: string;
  swatches: StyleBoardSwatch[];
  rows: StyleBoardRow[];
  notesSk: string[];
  /** Poctivo: bez image providera appka obrázky negeneruje. */
  providerSk: string;
  source: { width: number; height: number; pixels: number };
}

/**
 * Poskladá **desku štýlu** z nameraných dát. Je to dáta, nie obrázok — deska sa
 * skladá z referenčného obrázka (ktorý má používateľ), farebných vzoriek a čísel.
 * Obrázky sa **negenerujú** (na to appka nemá providera a nebude to predstierať).
 */
export function buildStyleBoard(analysis: ReferenceAnalysis, options: { titleSk?: string } = {}): StyleBoardData {
  const palette = analysis.palette.slice(0, 6).sort((a, b) => b.coverage - a.coverage);
  const brightest = palette.reduce((a, b) => (b.r + b.g + b.b > a.r + a.g + a.b ? b : a), palette[0]);
  const darkest = palette.reduce((a, b) => (b.r + b.g + b.b < a.r + a.g + a.b ? b : a), palette[0]);

  // Poradie rolí je dané prioritou: zvýraznenie → hlavná plocha → svetlá/tmavá → doplnok.
  // (Predtým sa „hlavná plocha" prepisovala rolou „tmavá", keď bola tá istá farba aj najtmavšia
  // — odhalil to test, nie oko.)
  const swatches: StyleBoardSwatch[] = palette.map((c) => {
    const isAccent = Boolean(analysis.accent && c.hex === analysis.accent.hex);
    const isMain = c.hex === palette[0].hex;
    let roleSk: string;
    if (isAccent) roleSk = "zvýraznenie (najsýtejšia farba)";
    else if (isMain) roleSk = "hlavná plocha (najväčšie pokrytie)";
    else if (c.hex === brightest.hex) roleSk = "svetlá plocha / text na tmavom";
    else if (c.hex === darkest.hex) roleSk = "tmavá plocha / text na svetlom";
    else roleSk = "doplnková plocha";
    return {
      hex: c.hex,
      coveragePercent: Math.round(c.coverage * 1000) / 10,
      saturationPercent: Math.round(c.saturation * 100),
      roleSk,
    };
  });

  const rows: StyleBoardRow[] = [
    { labelSk: "Rozmer referencie", valueSk: `${analysis.width}×${analysis.height}` },
    { labelSk: "Analyzovaných pixelov", valueSk: String(analysis.pixels) },
    { labelSk: "Priemerný jas", valueSk: `${analysis.brightness} / 255` },
    { labelSk: "Kontrast (odchýlka jasu)", valueSk: String(analysis.contrast) },
    { labelSk: "Sýtosť", valueSk: `${Math.round(analysis.saturation * 100)} %` },
    { labelSk: "Teplota (R − B)", valueSk: analysis.warmth > 0 ? `+${analysis.warmth}` : String(analysis.warmth) },
    {
      labelSk: "Tmavé / stredné / svetlé",
      valueSk: `${Math.round(analysis.darkRatio * 100)} % / ${Math.round(analysis.midRatio * 100)} % / ${Math.round(analysis.lightRatio * 100)} %`,
    },
    { labelSk: "Hustota hrán", valueSk: String(analysis.edgeDensity) },
    {
      labelSk: "Jas pásiem (hore / stred / dole)",
      valueSk: analysis.bands.map((b) => b.brightness.toFixed(0)).join(" / "),
    },
  ];

  return {
    titleSk: options.titleSk ?? "Deska štýlu z referenčného obrázka",
    swatches,
    rows,
    notesSk: [analysis.moodSk, ...analysis.hintsSk, ...analysis.notDetectableSk],
    providerSk:
      "PROVIDER UNAVAILABLE — appka nemá poskytovateľa na generovanie obrázkov, preto deska pracuje len s TVOJÍM referenčným obrázkom a nameranými číslami. Žiadne obrázky sa nedoplňujú.",
    source: { width: analysis.width, height: analysis.height, pixels: analysis.pixels },
  };
}

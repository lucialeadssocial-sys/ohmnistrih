/**
 * REFERENČNÉ VIDEO — ŠTATISTIKY (krok 12, Reality Gate).
 *
 * Prečo nový súbor: krok 11 meria **jednu snímku**. Štýl referenčného klipu je ale
 * hlavne o **čase** — tempo strihu, dĺžka záberov, dynamika, paleta v priebehu videa.
 * Tieto funkcie sú **čisté** (vstup = čísla a namerané snímky, výstup = čísla),
 * takže sa dajú testovať bez prehliadača, bez ffmpeg a bez servera.
 *
 * Čo to NIE JE: žiadny render, žiadny nový timeline ani projektový model. Je to
 * meracia vrstva — to isté, čo robí `referencePixels.ts` pre jednu snímku.
 *
 * Poctivosť: „rečník" sa **nedá** zmerať bez detektora tvárí. Preto sa odhaduje
 * z dĺžky záberu a dynamiky a **vždy sa to tak volá** (`talkingHeadProxyRatio`,
 * doslova „odhad"). Nikde sa netvrdí, že sme videli tvár.
 */

import { absoluteChroma, type ReferenceAnalysisOutcome, type ReferenceColor } from "./referencePixels";

// ---------------------------------------------------------------------------
// Strih a dĺžky záberov
// ---------------------------------------------------------------------------

export interface CutNormalization {
  /** Časy strihov po zlúčení príliš blízkych. */
  times: number[];
  /** Koľko strihov sa zlúčilo (ffmpeg vie ohlásiť dva strihy v jednej zmene). */
  merged: number;
}

/**
 * Zlúči strihy bližšie ako `minGapSec`. Bez toho by dva zápisy tej istej zmeny
 * vytvorili záber dlhý 0,02 s a celá štatistika by klamala.
 */
export function normalizeCutTimes(cutTimes: number[], minGapSec = 0.25): CutNormalization {
  const sorted = [...cutTimes].filter((t) => Number.isFinite(t) && t >= 0).sort((a, b) => a - b);
  const times: number[] = [];
  let merged = 0;
  for (const t of sorted) {
    const prev = times[times.length - 1];
    if (prev !== undefined && t - prev < minGapSec) {
      merged++;
      continue;
    }
    times.push(t);
  }
  return { times, merged };
}

/** Dĺžky záberov vrátane prvého (od 0) a posledného (po posledný strih). */
export function shotLengths(cutTimes: number[], durationSec: number): number[] {
  const { times } = normalizeCutTimes(cutTimes);
  const bounds = [0, ...times.filter((t) => t > 0 && t < durationSec), durationSec];
  const lengths: number[] = [];
  for (let i = 1; i < bounds.length; i++) {
    const len = bounds[i] - bounds[i - 1];
    if (len > 0) lengths.push(len);
  }
  return lengths;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

export interface ShotStats {
  cutCount: number;
  /** Koľko strihov sa zlúčilo (diagnostika merania, nie strih videa). */
  mergedCuts: number;
  cutsPerSecond: number;
  medianShotSec: number;
  meanShotSec: number;
  shortestShotSec: number;
  longestShotSec: number;
  /** Podiel **času** (nie počtu) v krátkych záberoch ≤ 1,2 s. */
  shortShare: number;
  /** Podiel **času** v dlhých záberoch ≥ 2,5 s. */
  longShare: number;
}

export interface ShotStatsOptions {
  shortMaxSec?: number;
  longMinSec?: number;
  minGapSec?: number;
}

/**
 * Štatistika strihu z nameraných časov strihov.
 * Podiely sú podiely **času** — 3 krátke zábery v 15 s videu znamenajú menej než
 * jeden krátky záber v 3 s videu, a to je presne to, čo zaujíma tempo.
 */
export function shotStatsFromCuts(
  cutTimes: number[],
  durationSec: number,
  options: ShotStatsOptions = {},
): ShotStats {
  const shortMaxSec = options.shortMaxSec ?? 1.2;
  const longMinSec = options.longMinSec ?? 2.5;
  const { times, merged } = normalizeCutTimes(cutTimes, options.minGapSec ?? 0.25);
  const lengths = shotLengths(times, durationSec);
  const total = lengths.reduce((s, l) => s + l, 0);
  const shortTime = lengths.filter((l) => l <= shortMaxSec).reduce((s, l) => s + l, 0);
  const longTime = lengths.filter((l) => l >= longMinSec).reduce((s, l) => s + l, 0);

  return {
    cutCount: times.length,
    mergedCuts: merged,
    cutsPerSecond: durationSec > 0 ? round2(times.length / durationSec) : 0,
    medianShotSec: round2(percentile(lengths, 50)),
    meanShotSec: round2(lengths.length > 0 ? total / lengths.length : 0),
    shortestShotSec: round2(lengths.length > 0 ? Math.min(...lengths) : 0),
    longestShotSec: round2(lengths.length > 0 ? Math.max(...lengths) : 0),
    shortShare: total > 0 ? round3(shortTime / total) : 0,
    longShare: total > 0 ? round3(longTime / total) : 0,
  };
}

// ---------------------------------------------------------------------------
// Dynamika (pohyb medzi vzorkami)
// ---------------------------------------------------------------------------

export interface MotionStats {
  /** Priemerná zmena lumy medzi susednými vzorkami (0–255) prepočítaná na sekundu. */
  perSecond: number;
  /** 90. percentil zmeny medzi susednými vzorkami — „čo sa ešte dá považovať za pokoj". */
  p90: number;
  /** Podiel prechodov, kde sa obraz takmer nepohol (< 2 úrovne lumy). */
  calmShare: number;
  samples: number;
}

/**
 * Pohyb medzi vzorkami snímok. Počíta sa z **pixelov**, ktoré už máme (RGBA),
 * takže nepotrebuje ďalší dekódovací krok.
 * `calmShare` je dôležitý: statická rozprávajúca hlava má pokojné prechody,
 * zostrihané podporné zábery nie.
 */
export function motionBetweenFrames(
  bytes: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  frameCount: number,
  sampleFps: number,
): MotionStats {
  const frameBytes = width * height * 4;
  if (frameCount < 2 || bytes.length < frameBytes * 2) {
    return { perSecond: 0, p90: 0, calmShare: 1, samples: Math.max(0, frameCount - 1) };
  }
  const diffs: number[] = [];
  for (let f = 1; f < frameCount; f++) {
    const a = (f - 1) * frameBytes;
    const b = f * frameBytes;
    let sum = 0;
    for (let i = 0; i < frameBytes; i += 4) {
      const la = 0.2126 * bytes[a + i] + 0.7152 * bytes[a + i + 1] + 0.0722 * bytes[a + i + 2];
      const lb = 0.2126 * bytes[b + i] + 0.7152 * bytes[b + i + 1] + 0.0722 * bytes[b + i + 2];
      sum += Math.abs(lb - la);
    }
    diffs.push(sum / (frameBytes / 4));
  }
  const mean = diffs.reduce((s, d) => s + d, 0) / diffs.length;
  const calm = diffs.filter((d) => d < 2).length;
  return {
    perSecond: round2(mean * sampleFps),
    p90: round2(percentile(diffs, 90)),
    calmShare: round3(calm / diffs.length),
    samples: diffs.length,
  };
}

// ---------------------------------------------------------------------------
// Agregácia snímok celého videa
// ---------------------------------------------------------------------------

export interface VideoAggregate {
  frameCount: number;
  /** Koľko vzoriek sa dalo naozaj zmerať (zvyšok bol prázdny/poškodený). */
  usableFrames: number;
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  edgeDensity: number;
  darkRatio: number;
  midRatio: number;
  lightRatio: number;
  /** Priemerný jas pásiem hore / stred / dole. */
  bands: number[];
  /**
   * Podiel vzoriek, kde je spodné pásmo aspoň o 6 úrovní svetlejšie než stredné.
   * Je to **odhad** prítomnosti svetlých titulkov dole — nie dôkaz textu.
   */
  bottomBandBrightShare: number;
  /** Nameraný akcent z palety videa (nie z jednej snímky). */
  accent: ReferenceColor | null;
  moodSk: string;
}

export function aggregateFrameAnalyses(frames: ReferenceAnalysisOutcome[]): VideoAggregate {
  const usable = frames.filter((f): f is Extract<ReferenceAnalysisOutcome, { available: true }> => f.available);
  if (usable.length === 0) {
    return {
      frameCount: frames.length,
      usableFrames: 0,
      brightness: 0,
      contrast: 0,
      saturation: 0,
      warmth: 0,
      edgeDensity: 0,
      darkRatio: 0,
      midRatio: 0,
      lightRatio: 0,
      bands: [0, 0, 0],
      bottomBandBrightShare: 0,
      accent: null,
      moodSk: "nedá sa popísať — žiadna vzorka sa nezmerala",
    };
  }
  const avg = (pick: (f: (typeof usable)[number]) => number) =>
    usable.reduce((s, f) => s + pick(f), 0) / usable.length;

  const bands = [0, 1, 2].map((i) => round2(avg((f) => f.bands[i]?.brightness ?? 0)));
  const brightBottom = usable.filter((f) => (f.bands[2]?.brightness ?? 0) - (f.bands[1]?.brightness ?? 0) >= 6).length;

  const aggregate: VideoAggregate = {
    frameCount: frames.length,
    usableFrames: usable.length,
    brightness: round2(avg((f) => f.brightness)),
    contrast: round2(avg((f) => f.contrast)),
    saturation: round3(avg((f) => f.saturation)),
    warmth: round2(avg((f) => f.warmth)),
    edgeDensity: round3(avg((f) => f.edgeDensity)),
    darkRatio: round3(avg((f) => f.darkRatio)),
    midRatio: round3(avg((f) => f.midRatio)),
    lightRatio: round3(avg((f) => f.lightRatio)),
    bands,
    bottomBandBrightShare: round3(brightBottom / usable.length),
    accent: pickAccent(usable.map((f) => f.accent).filter((c): c is ReferenceColor => c !== null)),
    moodSk: "",
  };
  aggregate.moodSk = describeVideoMood(aggregate);
  return aggregate;
}

/** Rovnaká logika výberu akcentu ako pri jednej snímke: absolútna farebnosť + jas. */
function pickAccent(candidates: ReferenceColor[]): ReferenceColor | null {
  const good = candidates.filter((c) => absoluteChroma(c) >= 25 && c.r + c.g + c.b >= 48 * 3);
  if (good.length === 0) return null;
  good.sort((a, b) => absoluteChroma(b) - absoluteChroma(a) || b.coverage - a.coverage);
  return good[0];
}

/** Popis **videa** (nie jednej snímky) — farba + svetlo + tempo strihu. */
export function describeVideoMood(a: {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  darkRatio: number;
  lightRatio: number;
  edgeDensity: number;
}): string {
  const light =
    a.darkRatio >= 0.5
      ? `tmavý obraz (${Math.round(a.darkRatio * 100)} % tmavých pixelov)`
      : a.lightRatio >= 0.5
        ? `svetlý obraz (${Math.round(a.lightRatio * 100)} % svetlých)`
        : `stredne tmavý obraz (${Math.round(a.darkRatio * 100)} % tmavých)`;
  const temp = a.warmth > 12 ? "teplý podtón" : a.warmth < -12 ? "studený podtón" : "neutrálna teplota";
  const sat = a.saturation >= 0.45 ? "sýte farby" : a.saturation <= 0.15 ? "takmer bez farby" : "mierne sýte farby";
  const con = a.contrast >= 60 ? "vysoký kontrast" : a.contrast <= 25 ? "nízky kontrast" : "stredný kontrast";
  const detail = a.edgeDensity >= 0.09 ? "hustý detail" : a.edgeDensity <= 0.03 ? "málo detailov" : "stredný detail";
  return `${light}, ${temp}, ${sat}, ${con}, ${detail}.`;
}

// ---------------------------------------------------------------------------
// Paleta celého videa
// ---------------------------------------------------------------------------

export interface MergedColor {
  hex: string;
  /** Priemerné pokrytie plochy naprieč **všetkými** vzorkami (0–1). */
  coverage: number;
  /** V koľkých vzorkách sa farba vôbec objavila (0–1) — odlišuje „stála" od „občasná". */
  frameShare: number;
}

/**
 * Spojí palety vzoriek do palety videa.
 *
 * Pokrytie je **priemer cez všetky vzorky** (nielen cez tie, kde sa farba objavila).
 * Preto je farba z jednej sekundy nízko — presne ako má byť: recept nemá stavať
 * paletu na jednom zábere.
 */
export function mergePalettes(
  palettes: Array<Array<{ hex: string; coverage: number }>>,
  top = 6,
  minCoverage = 0.005,
): MergedColor[] {
  if (palettes.length === 0) return [];
  const sums = new Map<string, { total: number; frames: number }>();
  for (const palette of palettes) {
    for (const color of palette) {
      const entry = sums.get(color.hex) ?? { total: 0, frames: 0 };
      entry.total += color.coverage;
      entry.frames += 1;
      sums.set(color.hex, entry);
    }
  }
  const merged: MergedColor[] = [...sums.entries()]
    .map(([hex, e]) => ({
      hex,
      coverage: round3(e.total / palettes.length),
      frameShare: round3(e.frames / palettes.length),
    }))
    .filter((c) => c.coverage >= minCoverage)
    .sort((a, b) => b.coverage - a.coverage || b.frameShare - a.frameShare || a.hex.localeCompare(b.hex));
  return merged.slice(0, top);
}

// ---------------------------------------------------------------------------
// Odhad štruktúry z nameraných čísel (pre recept)
// ---------------------------------------------------------------------------

export interface VideoStyleHints {
  /**
   * Podiel **času** v dlhých záberoch (≥ 2,5 s). **Toto NIE je podiel rečníka** —
   * detektor tvárí nemáme, a dlhý záber môže byť aj pomalý AI záber bez rečníka
   * (presne to je prípad referenčných klipov: 25 s jedným záberom bez strihu).
   * Meranie teda hovorí len jednu vetu: „koľko času je v záberoch, ktoré nie sú
   * rozbité na drobné strihy".
   */
  longTakeRatio: number;
  /** Podiel času v záberoch kratších ako 2,5 s (doplnok k `longTakeRatio`). */
  cutHeavyShare: number;
  tempoSk: string;
  hintsSk: string[];
  notDetectableSk: string[];
}

export function videoStyleHints(
  shot: ShotStats,
  aggregate: VideoAggregate,
  motion: MotionStats,
): VideoStyleHints {
  const longTakeRatio = round3(Math.min(1, Math.max(0, shot.longShare)));
  const cutHeavyShare = round3(1 - longTakeRatio);

  const tempo =
    shot.cutsPerSecond >= 1.2
      ? `veľmi rýchly strih (${shot.cutsPerSecond}/s, medián záberu ${shot.medianShotSec} s)`
      : shot.cutsPerSecond >= 0.5
        ? `rýchly strih (${shot.cutsPerSecond}/s, medián záberu ${shot.medianShotSec} s)`
        : shot.cutsPerSecond > 0
          ? `pokojný strih (${shot.cutsPerSecond}/s, medián záberu ${shot.medianShotSec} s)`
          : `bez strihov (jeden záber ${shot.medianShotSec} s)`;

  const hints = [
    `tempo: ${tempo} — ${Math.round(shot.shortShare * 100)} % času v záberoch ≤ 1,2 s`,
    `podiel času v dlhých záberoch (≥ 2,5 s): ${Math.round(longTakeRatio * 100)} % — toto je dĺžka záberu, NIE podiel rečníka`,
    `dynamika: ${motion.perSecond}/s, pokojných prechodov ${Math.round(motion.calmShare * 100)} %`,
    `obraz: jas ${aggregate.brightness}/255, kontrast ${aggregate.contrast}, sýtosť ${Math.round(aggregate.saturation * 100)} %`,
    `svetlý spodok (titulky?) v ${Math.round(aggregate.bottomBandBrightShare * 100)} % vzoriek`,
    `paleta: ${aggregate.accent ? `akcent ${aggregate.accent.hex}` : "bez sýteho akcentu"}`,
  ];

  const notDetectableSh = [
    "podiel rečníka v obraze — bez detektora tvárí sa nedá zmerať; meriame len dĺžku záberov",
    "či je svetlý pás dole naozaj text titulkov (meria sa len svetlosť pásma)",
    "zvuk, hudba a ich strih",
    "zámer autora a to, čo je zákulisné know-how",
  ];

  return {
    longTakeRatio,
    cutHeavyShare,
    tempoSk: tempo,
    hintsSk: hints,
    notDetectableSk: notDetectableSh,
  };
}

// ---------------------------------------------------------------------------
// Súhrn viacerých videí (základ pre recept)
// ---------------------------------------------------------------------------

export interface VideoSummaryRow {
  durationSec: number;
  shot: ShotStats;
  aggregate: VideoAggregate;
  motion: MotionStats;
  palette: MergedColor[];
}

export interface VideoSummary {
  videoCount: number;
  totalDurationSec: number;
  /** Mediány cez videá — jeden klip nemá prebiť ostatné. */
  medianCutsPerSecond: number;
  medianShotSec: number;
  medianBrightness: number;
  medianContrast: number;
  medianSaturation: number;
  medianEdgeDensity: number;
  medianMotionPerSecond: number;
  /** Podiel videí, kde je spodné pásmo svetlejšie (možné titulky). */
  brightBottomVideoShare: number;
  /** Farby, ktoré sa objavili aspoň v polovici videí (stála paleta). */
  sharedPalette: MergedColor[];
  /** Zoznam farieb, ktoré sú len v menšine videí — vysvetľuje, prečo je paleta užšia. */
  occasionalPalette: MergedColor[];
}

export function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Súhrn cez viac videí. Zámerne **medián**, nie priemer: keby jeden klip mal
 * 0 rezov a druhý 2 rezy za sekundu, priemer by neopisoval ani jeden z nich.
 */
export function summarizeVideos(rows: VideoSummaryRow[]): VideoSummary {
  if (rows.length === 0) {
    return {
      videoCount: 0,
      totalDurationSec: 0,
      medianCutsPerSecond: 0,
      medianShotSec: 0,
      medianBrightness: 0,
      medianContrast: 0,
      medianSaturation: 0,
      medianEdgeDensity: 0,
      medianMotionPerSecond: 0,
      brightBottomVideoShare: 0,
      sharedPalette: [],
      occasionalPalette: [],
    };
  }
  const brightBottom = rows.filter((r) => r.aggregate.bottomBandBrightShare >= 0.5).length;

  // Farba je „stála", ak sa objavila aspoň v polovici videí.
  const votes = new Map<string, { videos: number; coverage: number }>();
  for (const row of rows) {
    for (const color of row.palette) {
      const entry = votes.get(color.hex) ?? { videos: 0, coverage: 0 };
      entry.videos += 1;
      entry.coverage += color.coverage;
      votes.set(color.hex, entry);
    }
  }
  const all: Array<MergedColor & { videos: number }> = [...votes.entries()]
    .map(([hex, e]) => ({
      hex,
      coverage: round3(e.coverage / rows.length),
      frameShare: round3(e.videos / rows.length),
      videos: e.videos,
    }))
    .sort((a, b) => b.videos - a.videos || b.coverage - a.coverage || a.hex.localeCompare(b.hex));

  // Porovnáva sa počet videí, nie zaokrúhlený podiel — pri 3 videách je 1/3 = 0,333
  // a zaokrúhlenie by farbu z jedného videa ticho vyhodilo (presne tá chyba, ktorú
  // odhalil test).
  const isShared = (c: { videos: number }) => c.videos * 2 >= rows.length;
  const strip = (c: MergedColor & { videos: number }): MergedColor => ({
    hex: c.hex,
    coverage: c.coverage,
    frameShare: c.frameShare,
  });

  return {
    videoCount: rows.length,
    totalDurationSec: round2(rows.reduce((s, r) => s + r.durationSec, 0)),
    medianCutsPerSecond: round2(medianOf(rows.map((r) => r.shot.cutsPerSecond))),
    medianShotSec: round2(medianOf(rows.map((r) => r.shot.medianShotSec))),
    medianBrightness: round2(medianOf(rows.map((r) => r.aggregate.brightness))),
    medianContrast: round2(medianOf(rows.map((r) => r.aggregate.contrast))),
    medianSaturation: round3(medianOf(rows.map((r) => r.aggregate.saturation))),
    medianEdgeDensity: round3(medianOf(rows.map((r) => r.aggregate.edgeDensity))),
    medianMotionPerSecond: round2(medianOf(rows.map((r) => r.motion.perSecond))),
    brightBottomVideoShare: round3(brightBottom / rows.length),
    sharedPalette: all.filter(isShared).slice(0, 6).map(strip),
    occasionalPalette: all.filter((c) => !isShared(c)).slice(0, 6).map(strip),
  };
}

// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

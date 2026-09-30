/**
 * KROK 24 — MERANÉ ZOSÚLADENIE SVETLA (aby výstup sedel s ich videami).
 *
 * Prečo to existuje: recepty z referencií (denis_vencel, ai_ktivista) majú
 * **namerané** hodnoty jasu a kontrastu, ale render ich dovtedy nepoužíval —
 * svetlo bolo označené ako „MEASURED STYLE PARAMETER — NOT WIRED TO RENDER“.
 * Tento modul to napája: z rozdielu medzi zdrojovým videom a referenciou
 * vypočíta korekciu a **tú istú korekciu** dostane export (ffmpeg `eq`) aj
 * náhľad (CSS filter) — nemôžu sa rozísť.
 *
 * Pravidlá (rovnaké ako zvyšok appky):
 *  - žiadne `random()`, žiadny odhad: všetko z nameraných čísel,
 *  - keď sa merať nedá (chýba jas alebo kontrast), funkcia vráti `null`
 *    a render nerobí nič — radšej nič, než vymyslená korekcia,
 *  - korekcia má tvrdé limity (aby „napodobnenie“ nezničilo obraz).
 */

/** Namerané hodnoty jedného videa (jas a kontrast na stupnici 0–255). */
export interface MeasuredLightStats {
  brightness: number;
  contrast: number;
}

export interface LightCorrection {
  /** Zdroj: čo appka namerala na tvojom videe. */
  source: MeasuredLightStats;
  /** Cieľ: čo appka namerala na referencii (jeho videu). */
  target: MeasuredLightStats;
  /** Ako silno sa má korekcia prejaviť (0–100 %). 100 = naplno na cieľ. */
  strengthPercent: number;
  /** ffmpeg: pripočítanie k jasu v rozsahu -0.35 … 0.35 (eq=brightness je sčítanie). */
  ffmpegBrightness: number;
  /** ffmpeg: násobiteľ kontrastu v rozsahu 0.75 … 1.35. */
  ffmpegContrast: number;
  /** Smerom k čomu to bolo počítané (aby bolo v UI vidieť, odkiaľ čísla sú). */
  noteSk: string;
}

/**
 * Tvrdé limity korekcie. Zámerne úzke: cieľom je priblížiť sa ich svetlu,
 * nie prežehliť alebo vybiť obraz. Mimo týchto limitov by „napodobnenie“
 * vyzeralo horšie než originál.
 */
export const LIGHT_CORRECTION_LIMITS = {
  minFfmpegBrightness: -0.35,
  maxFfmpegBrightness: 0.35,
  minFfmpegContrast: 0.75,
  maxFfmpegContrast: 1.35,
  /** Pod tento rozdiel nemá zmysel nič korigovať (je to šum merania). */
  minSignal: 2.5,
} as const;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function finitePair(a: MeasuredLightStats, b: MeasuredLightStats): boolean {
  return (
    Number.isFinite(a.brightness) &&
    Number.isFinite(a.contrast) &&
    Number.isFinite(b.brightness) &&
    Number.isFinite(b.contrast)
  );
}

/**
 * Vypočíta korekciu svetla zo zdrojového videa na referenciu.
 *
 * Vráti `null`, keď:
 *  - chýbajú namerané hodnoty (radšej nič než odhad),
 *  - rozdiel je pod hranicou šumu (nemá zmysel nič robiť).
 */
export function computeLightCorrection(
  source: MeasuredLightStats,
  target: MeasuredLightStats,
  options: { strengthPercent?: number } = {},
): LightCorrection | null {
  if (!finitePair(source, target)) return null;

  const strength = clamp(Number.isFinite(options.strengthPercent) ? Number(options.strengthPercent) : 100, 0, 100) / 100;
  if (strength <= 0) return null;

  const sourceContrast = Math.max(20, source.contrast);
  const s = source.brightness / 255;
  // Sila korekcie = ako ďaleko ideme k ich svetlu (100 % = presne na ich hodnoty,
  // 50 % = na pol cesty medzi mojím a ich videom). Počíta sa to na cieľových
  // hodnotách, aby „polovica“ znamenala polovicu cesty, nie polovičné čísla.
  const t = s + (target.brightness / 255 - s) * strength;

  // Želaný kontrast: koľkokrát je referencia kontrastnejšia než zdroj.
  const wantedContrast = 1 + ((target.contrast - sourceContrast) / sourceContrast) * strength;

  /**
   * ffmpeg `eq` ráta takto:  výstup = (vstup − 0,5) × kontrast + 0,5 + jas.
   * Preto sa jas NEPOČÍTA ako jednoduchý rozdiel (to by pri kontraste ≠ 1
   * minulo cieľ) — dopočíta sa tak, aby stredná hodnota snímky sedela s referenciou.
   */
  const brightnessForContrast = (c: number) => t - 0.5 + 0.5 * c - c * s;
  const meanFor = (c: number, b: number) => (s - 0.5) * c + 0.5 + b;

  let ffmpegContrast = clamp(wantedContrast, LIGHT_CORRECTION_LIMITS.minFfmpegContrast, LIGHT_CORRECTION_LIMITS.maxFfmpegContrast);
  let ffmpegBrightness = clamp(
    brightnessForContrast(ffmpegContrast),
    LIGHT_CORRECTION_LIMITS.minFfmpegBrightness,
    LIGHT_CORRECTION_LIMITS.maxFfmpegBrightness,
  );

  const contrastClipped = ffmpegContrast !== wantedContrast;
  const wantedBrightness = brightnessForContrast(ffmpegContrast);
  let brightnessClipped = Math.abs(wantedBrightness - ffmpegBrightness) > 1e-9;

  // Keď jas narazil na limit (typicky pri veľmi tmavom videe, keď treba pridať
  // veľa svetla), skúsime v rámci bezpečných limitov nájsť NAJBLIŽŠÍ dosiahnuteľný
  // výsledok. Je to deterministické prehľadanie (žiadna náhoda) — a appka vždy
  // povie, že ide o maximum, ktoré limity dovoľujú.
  let searchedSk = "";
  if (brightnessClipped) {
    let bestC = ffmpegContrast;
    let bestB = ffmpegBrightness;
    let bestErr = Math.abs(meanFor(ffmpegContrast, ffmpegBrightness) - t);
    for (let c = LIGHT_CORRECTION_LIMITS.minFfmpegContrast; c <= LIGHT_CORRECTION_LIMITS.maxFfmpegContrast + 1e-9; c += 0.005) {
      const b = clamp(brightnessForContrast(c), LIGHT_CORRECTION_LIMITS.minFfmpegBrightness, LIGHT_CORRECTION_LIMITS.maxFfmpegBrightness);
      const err = Math.abs(meanFor(c, b) - t);
      const tie = Math.abs(err - bestErr) < 1e-6 && Math.abs(c - wantedContrast) < Math.abs(bestC - wantedContrast);
      if (err < bestErr - 1e-6 || tie) {
        bestC = c;
        bestB = b;
        bestErr = err;
      }
    }
    if (Math.abs(bestC - ffmpegContrast) > 1e-9 || Math.abs(bestB - ffmpegBrightness) > 1e-9) {
      searchedSk = " (hľadal som najbližší dosiahnuteľný výsledok v rámci limitov)";
      ffmpegContrast = bestC;
      ffmpegBrightness = bestB;
      brightnessClipped = true;
    }
  }

  ffmpegBrightness = Math.round(ffmpegBrightness * 10000) / 10000;
  ffmpegContrast = Math.round(ffmpegContrast * 10000) / 10000;

  const signal = Math.max(
    Math.abs(target.brightness - source.brightness),
    Math.abs(target.contrast - sourceContrast) / 2,
  );
  if (signal < LIGHT_CORRECTION_LIMITS.minSignal) return null;

  const notes: string[] = [];
  if (contrastClipped) notes.push("kontrast je mimo bezpečných limitov — ostáva najbližšia povolená hodnota");
  if (brightnessClipped) notes.push("jas narazil na bezpečný limit (viac svetla by už vybielilo obraz)");
  const okrem = notes.length > 0 ? ` (${notes.join("; ")}${searchedSk})` : "";

  return {
    source,
    target,
    strengthPercent: Math.round(strength * 100),
    ffmpegBrightness,
    ffmpegContrast,
    noteSk:
      `Svetlo: zdroj ${source.brightness.toFixed(2)} / ${source.contrast.toFixed(2)} → ` +
      `referencia ${target.brightness.toFixed(2)} / ${target.contrast.toFixed(2)}; ` +
      `korekcia jas ${ffmpegBrightness >= 0 ? "+" : ""}${ffmpegBrightness.toFixed(3)} (sčítanie), ` +
      `kontrast ×${ffmpegContrast.toFixed(3)}${okrem}.`,
  };
}

/** ffmpeg filter pre export (`eq`). Prázdny reťazec = nič sa nemení. */
export function lightCorrectionFfmpeg(correction: LightCorrection | null | undefined): string {
  if (!correction) return "";
  return `,eq=brightness=${correction.ffmpegBrightness.toFixed(4)}:contrast=${correction.ffmpegContrast.toFixed(4)}`;
}

/**
 * CSS filter pre náhľad — **tie isté čísla** ako export.
 * Pozor: CSS `brightness(x%)` je násobenie, ffmpeg `eq=brightness` je sčítanie;
 * preto sa jas prekladá ako násobiteľ (1 + delta), aby náhľad zodpovedal exportu.
 */
export function lightCorrectionCss(correction: LightCorrection | null | undefined): string {
  if (!correction) return "";
  const brightnessMultiplier = clamp(1 + correction.ffmpegBrightness, 0.4, 1.8);
  return `brightness(${(brightnessMultiplier * 100).toFixed(1)}%) contrast(${(correction.ffmpegContrast * 100).toFixed(1)}%)`;
}

/** Kontrola, či je korekcia v bezpečných limitoch (testy a server). */
export function lightCorrectionWithinLimits(correction: LightCorrection): boolean {
  const L = LIGHT_CORRECTION_LIMITS;
  return (
    correction.ffmpegBrightness >= L.minFfmpegBrightness &&
    correction.ffmpegBrightness <= L.maxFfmpegBrightness &&
    correction.ffmpegContrast >= L.minFfmpegContrast &&
    correction.ffmpegContrast <= L.maxFfmpegContrast
  );
}

// ---------------------------------------------------------------------------
// MERANIE — jedna funkcia pre celú appku (server, nástroje aj testy)
// ---------------------------------------------------------------------------

/** Ako sa meria svetlo: pevné rozmery a hustota vzoriek (aby boli čísla vždy porovnateľné). */
export const LIGHT_MEASURE = {
  width: 160,
  height: 90,
  fps: 2,
  /**
   * Jas = medián priemeru pixelov na snímku · Kontrast = medián smerodajnej
   * odchýlky pixelov na snímku. Je to rovnaká metóda, akou boli merané referenčné
   * videá (analyza-videa.json / analyza-tiktok.json), takže čísla sú porovnateľné.
   */
  methodSk:
    "ffmpeg: 2 snímky/s, zmenšené na 160×90, čiernobielo; jas = medián priemeru pixelov na snímku, kontrast = medián smerodajnej odchýlky pixelov na snímku",
} as const;

/**
 * Spočíta jas a kontrast zo surových čiernobielych snímok (jeden bajt = jeden pixel).
 * Je to čistá funkcia — žiadne I/O, žiadna náhoda, preto sa dá presne otestovať.
 * Keď je dát málo (menej než 2 snímky), vráti `null` (radšej nič než odhad).
 */
export function lightStatsFromGrayFrames(
  buffer: Uint8Array,
  width: number = LIGHT_MEASURE.width,
  height: number = LIGHT_MEASURE.height,
): (MeasuredLightStats & { frames: number }) | null {
  const frameBytes = width * height;
  if (!buffer || frameBytes <= 0 || buffer.length < frameBytes * 2) return null;

  const means: number[] = [];
  const stds: number[] = [];
  for (let i = 0; i + frameBytes <= buffer.length; i += frameBytes) {
    let sum = 0;
    for (let p = 0; p < frameBytes; p++) sum += buffer[i + p];
    const mean = sum / frameBytes;
    let acc = 0;
    for (let p = 0; p < frameBytes; p++) {
      const d = buffer[i + p] - mean;
      acc += d * d;
    }
    means.push(mean);
    stds.push(Math.sqrt(acc / frameBytes));
  }
  if (means.length < 2) return null;

  const median = (a: number[]) => {
    const b = [...a].sort((x, y) => x - y);
    const m = Math.floor(b.length / 2);
    return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
  };

  return {
    brightness: Math.round(median(means) * 100) / 100,
    contrast: Math.round(median(stds) * 100) / 100,
    frames: means.length,
  };
}

/** Zhrnutie merania pre človeka (napr. do poznámok v UI). */
export function lightMeasureSummarySk(stats: MeasuredLightStats & { frames?: number }): string {
  return `jas ${stats.brightness.toFixed(2)} / kontrast ${stats.contrast.toFixed(2)}${stats.frames ? ` (${stats.frames} vzoriek)` : ""}`;
}

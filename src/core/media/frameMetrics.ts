/**
 * MERANIE ZO SKUTOČNÝCH SNÍMOK (krok 30b).
 *
 * Prečo tento modul existuje: `MediaIntelligenceIndex` mal snímky „vyrobené“
 * vzorcami (`brightness = 40 + (i * 45) % 185`, v komentári dokonca
 * „Heuristic to simulate…“). Director nástroje (`getThumbnails`, `searchMedia`)
 * z nich robili závery, hoci žiadne pixely nikdy nevideli.
 *
 * Tento modul počíta **len to, čo je v pixeloch naozaj**:
 *  • jas (luma 709, 0–255),
 *  • farebný vektor (priemerné R,G,B + podiel tmavých pixelov),
 *  • ostrosť (rozptyl gradientu — čím vyšší, tým viac detailov/hrán),
 *  • ostré strihy medzi vzorkami (skok v jasovom histograme).
 *
 * Je to čistá funkcia: vstup = pixely, výstup = čísla. Žiadny `Math.random()`,
 * žiadne vzorce „ako keby“. V prehliadači pixely dodá canvas nad snímkou
 * z `mediaEngineV1.getFrameAtTime()`; v dôkazovom runneri ich dodá ffmpeg.
 */

export interface FrameMetrics {
  /** Čas snímky v sekundách (odkiaľ bola vzatá). */
  t: number;
  /** Priemerný jas v 0–255 (luma 709). */
  luma: number;
  /** Priemerné R, G, B v 0–255. */
  rgb: [number, number, number];
  /** Podiel tmavých pixelov (luma < 40), 0–1. */
  darkShare: number;
  /** Podiel svetlých pixelov (luma > 215), 0–1. */
  lightShare: number;
  /**
   * Ostrosť = priemerná sila hrán (priemerný |rozdiel jasu| susedných pixelov),
   * 0 = úplne bez detailov (jednofarevná plocha). Vysoké číslo = veľa hrán.
   */
  sharpness: number;
  /**
   * Zmenšený raster jasu (šírka×výška podľa `GRAY_THUMB_W/H`) — zachytáva
   * PRIESTOROVÉ rozloženie obrazu. Priemer ani histogram nepovedia, či sa
   * tvár posunula alebo či je to iný uhol; tento raster áno, a to za 576 bajtov.
   */
  grayThumb: number[];
  /**
   * Histogram jasu v 8 pásmach (podiel pixelov, súčet = 1).
   *
   * Prečo: samotný PRIEMER jasu je slabý detektor strihu — dva rôzne zábery
   * môžu mať rovnaký priemer. Histogram zachytí zmenu rozloženia svetla
   * (napr. tmavá tvár na svetlom pozadí → svetlá tvár na tmavom).
   */
  lumaHistogram: number[];
}

export interface SceneBoundary {
  /** Čas hranice (medzi vzorkou `t` a nasledujúcou). */
  timestamp: number;
  /** Sila zmeny 0–1 (podiel zmeny jasu; nie „confidence modelu“). */
  score: number;
}

export interface SceneSpan {
  id: string;
  start: number;
  end: number;
  duration: number;
}

export const LUMA_709 = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Rozmery zmenšeného rastra (priestorové porovnanie). Malé zámerne — 576 bajtov. */
export const GRAY_THUMB_W = 32;
export const GRAY_THUMB_H = 18;

/**
 * Z pixelov (RGBA) spočíta metriky. `pixels` je to, čo vráti `ctx.getImageData().data`.
 * Ak sú rozmery menšie než 1, vráti `null` — radšej nič, než vymyslené čísla.
 */
export function frameMetricsFromPixels(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  t: number,
): FrameMetrics | null {
  if (!(width > 0) || !(height > 0)) return null;
  const count = width * height;
  if (pixels.length < count * 4) return null;

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumLuma = 0;
  let dark = 0;
  let light = 0;
  const histogram = new Array(8).fill(0) as number[];

  for (let i = 0; i < count; i += 1) {
    const o = i * 4;
    const r = pixels[o];
    const g = pixels[o + 1];
    const b = pixels[o + 2];
    sumR += r;
    sumG += g;
    sumB += b;
    const l = LUMA_709(r, g, b);
    sumLuma += l;
    histogram[Math.min(7, Math.floor(l / 32))] += 1;
    if (l < 40) dark += 1;
    else if (l > 215) light += 1;
  }

  // Ostrosť: priemerná sila hrán (|rozdiel jasu| susedných pixelov).
  // Pozor na pascu: rozptyl gradientu je pri pravidelnom vzore (šachovnica)
  // nulový, hoci hrán je plno. Preto meriame PRIEMER, nie rozptyl.
  let sumGrad = 0;
  let gradCount = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 1; x < width; x += 1) {
      const o = (y * width + x) * 4;
      const p = (y * width + (x - 1)) * 4;
      const l1 = LUMA_709(pixels[o], pixels[o + 1], pixels[o + 2]);
      const l0 = LUMA_709(pixels[p], pixels[p + 1], pixels[p + 2]);
      sumGrad += Math.abs(l1 - l0);
      gradCount += 1;
    }
  }
  const sharpness = gradCount > 0 ? sumGrad / gradCount : 0;

  // Zmenšený raster (nearest-neighbour) — priestorová informácia.
  const grayThumb: number[] = new Array(GRAY_THUMB_W * GRAY_THUMB_H);
  for (let ty = 0; ty < GRAY_THUMB_H; ty += 1) {
    const sy = Math.min(height - 1, Math.floor(((ty + 0.5) / GRAY_THUMB_H) * height));
    for (let tx = 0; tx < GRAY_THUMB_W; tx += 1) {
      const sx = Math.min(width - 1, Math.floor(((tx + 0.5) / GRAY_THUMB_W) * width));
      const o = (sy * width + sx) * 4;
      grayThumb[ty * GRAY_THUMB_W + tx] = Number(LUMA_709(pixels[o], pixels[o + 1], pixels[o + 2]).toFixed(1));
    }
  }

  return {
    t: Number(t.toFixed(3)),
    grayThumb,
    luma: Number((sumLuma / count).toFixed(2)),
    rgb: [Number((sumR / count).toFixed(1)), Number((sumG / count).toFixed(1)), Number((sumB / count).toFixed(1))],
    darkShare: Number((dark / count).toFixed(4)),
    lightShare: Number((light / count).toFixed(4)),
    sharpness: Number(sharpness.toFixed(2)),
    lumaHistogram: histogram.map((h) => Number((h / count).toFixed(4))),
  };
}

/**
 * Vzdialenosť dvoch snímok (0–1) z nameraných metrík.
 *
 * Tri merané zložky:
 *  • priemer jasu — hrubá zmena expozície,
 *  • **kumulatívny histogram jasu (CDF)** — zmena ROZLOŽENIA sveta v obraze;
 *    CDF vzdialenosť sa správa ako „posun“ distribúcie, takže malé postupné
 *    rozjasnenie dá malé číslo, kým skok na úplne iný obraz dá veľké,
 *  • farba (priemer R, G, B).
 *
 * Výsledok = maximum zložiek: stačí jedna výrazná zmena. (Pozor na pascu:
 * samotný histogram cez L1 vzdialenosť je prehnane citlivý — dva susedné
 * pásma dajú 1,0 aj pri malej zmene. Preto CDF.)
 */
export function frameDistance(a: FrameMetrics, b: FrameMetrics): number {
  const luma = Math.abs(a.luma - b.luma) / 255;
  const colour =
    (Math.abs(a.rgb[0] - b.rgb[0]) + Math.abs(a.rgb[1] - b.rgb[1]) + Math.abs(a.rgb[2] - b.rgb[2])) / (3 * 255);

  // Priestorová zložka: priemerný |rozdiel| zmenšeného rastra (0–1).
  let spatial = 0;
  if (a.grayThumb?.length && a.grayThumb.length === b.grayThumb?.length) {
    let sum = 0;
    for (let i = 0; i < a.grayThumb.length; i += 1) sum += Math.abs(a.grayThumb[i] - b.grayThumb[i]);
    spatial = sum / a.grayThumb.length / 255;
  }

  let histogram = 0;
  if (a.lumaHistogram?.length && b.lumaHistogram?.length) {
    const bins = Math.min(a.lumaHistogram.length, b.lumaHistogram.length);
    let cdfA = 0;
    let cdfB = 0;
    let l1 = 0;
    for (let i = 0; i < bins; i += 1) {
      cdfA += a.lumaHistogram[i];
      cdfB += b.lumaHistogram[i];
      l1 += Math.abs(cdfA - cdfB);
    }
    histogram = Math.min(1, l1 / bins);
  }

  return Number(Math.min(1, Math.max(luma, histogram, colour * 0.9, spatial)).toFixed(4));
}

/**
 * Nájde ostré strihy medzi vzorkami. Je to **meranie zmeny obrazu**, nie model:
 * ak sa obraz medzi dvoma vzorkami zmení viac než `threshold`, je tu strih.
 * (Pri vzorkovaní po ~0,5 s sa dá odhaliť cut na danej vzorke; presnejšie by
 * bolo potrebné dekódovať každú snímku — to zámerne nerobíme kvôli výkonu.)
 */
export function detectSceneBoundaries(
  samples: FrameMetrics[],
  /**
   * Prah vzdialenosti snímok (0–1). **Nameraný, nie odhadnutý.**
   *
   * Kalibrácia na reálnom videe (aikt-DdRcznCusBh.mp4, 71 s, 142 vzoriek po 0,5 s),
   * nezávislé meranie = ffmpeg `select='gt(scene,0.3)'` (16 strihov):
   *   prah 0,08 → 16/16 strihov, ale 17 zmien naviac,
   *   prah 0,12 → **16/16 strihov, 6 zmien naviac**,
   *   prah 0,16 → 13/16, 2 naviac,
   *   prah 0,20 → 7/16, 1 naviac,
   *   prah 0,25 → 4/16, 0 naviac.
   *
   * Preto 0,12: radšej nájsť všetky strihy a priznať pár zmien naviac (pohyb
   * v zábere), než ticho prehliadnuť skutočný strih. Presné časy strihov
   * v exporte aj tak dáva ffmpeg meranie.
   */
  threshold = 0.12,
  minGapSec = 0.6,
): SceneBoundary[] {
  const out: SceneBoundary[] = [];
  for (let i = 1; i < samples.length; i += 1) {
    const d = frameDistance(samples[i - 1], samples[i]);
    if (d < threshold) continue;
    const timestamp = samples[i].t;
    const last = out[out.length - 1];
    if (last && timestamp - last.timestamp < minGapSec) {
      if (d > last.score) {
        out[out.length - 1] = { timestamp, score: d };
      }
      continue;
    }
    out.push({ timestamp: Number(timestamp.toFixed(2)), score: d });
  }
  return out;
}

/** Rozdelí dĺžku média podľa hraníc na scény (bez hraníc = jedna scéna). */
export function scenesFromBoundaries(boundaries: SceneBoundary[], durationSec: number): SceneSpan[] {
  if (!(durationSec > 0)) return [];
  const points = [0, ...boundaries.map((b) => b.timestamp).filter((t) => t > 0 && t < durationSec), durationSec];
  const scenes: SceneSpan[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = Number(points[i].toFixed(2));
    const end = Number(points[i + 1].toFixed(2));
    if (end - start <= 0.05) continue;
    scenes.push({ id: `sc_${i + 1}`, start, end, duration: Number((end - start).toFixed(2)) });
  }
  return scenes;
}

/**
 * Vzorkovanie: rovnomerné časy pre `sampleCount` snímok (vrátane začiatku).
 * Deterministické — žiadny náhodný výber.
 */
export function sampleTimes(durationSec: number, sampleCount: number): number[] {
  if (!(durationSec > 0) || sampleCount <= 0) return [];
  if (sampleCount === 1) return [durationSec / 2];
  const step = durationSec / sampleCount;
  const times: number[] = [];
  for (let i = 0; i < sampleCount; i += 1) {
    // STREDY intervalov, nie krajné body.
    //
    // Prečo: vzorka presne na `durationSec` (a často aj na 0) vracia pri
    // vyťahovaní snímky prázdny/posledný obraz, ktorý so záberom nesúvisí —
    // na statickom médiu to vyrobilo falošnú „hranicu“ na konci. Stred
    // intervalu je vždy vnútri média.
    times.push(Number(((i + 0.5) * step).toFixed(3)));
  }
  return times;
}

/**
 * RETENTION SHORT engine — z plánu vznikne KONKRÉTNY strih.
 *
 * Vstup:  schválené zásahy (Director Plan) + dĺžka RAW videa + cieľová platforma.
 * Výstup: EDL (edit decision list) — presný zoznam úsekov, ktoré vo výslednom
 *         klipu zostanú, s časom na zdrojovej aj výslednej osi.
 *
 * Prečo EDL a nie rovno render:
 *  - EDL je lacný, okamžitý a overiteľný — dá sa prehrať v prehliadači (preskakovaním
 *    vystrihnutých úsekov) bez jedinej sekundy renderu.
 *  - Ten istý EDL sa dá odovzdať renderu (Mediabunny) alebo inému strihu (XML).
 *  - AI naďalej IBA rozhoduje; strih je zoznam čísel, ktorý si vieš prečítať.
 *
 * Hranice (aby to nebolo klamstvo):
 *  - Pracujeme s časmi z plánu. Ak plán nie je kotvený na prepis (basis "estimate"),
 *    časy sú odhad — engine to vráti ako upozornenie, nie ako hotovú vec.
 *  - Ak plán nič nestrihá, engine NEVYMÝŠĽA strihy a povie to.
 *  - Presuny (hook na začiatok) menia poradie rozprávania — preto sú vždy ohlásené.
 */

import {
  buildWordIndex,
  flattenWords,
  snapRangeToWords,
  snapReportSk,
  type SpeechSegmentLike,
  type TimingPrecision,
  type WordTimingIndex,
} from "../transcript/wordTiming";

import type { DirectorBasis } from "../ai/directorVocabulary";

export const DEFAULT_MIN_SEGMENT_SEC = 0.6;
export const MIN_USEFUL_SEGMENT_SEC = 1.2;

/** Minimálny tvar zásahu — engine nezávisí od konkrétneho komponentu. */
export interface RetentionPlanItemLike {
  id?: string;
  type: string;
  start: number;
  end?: number;
  label?: string;
  reason?: string;
  confidence?: number;
  /** KROK 0c — rovnaký slovník pôvodu ako Director (`directorVocabulary`). */
  basis?: DirectorBasis;
}

export interface RetentionPlatformSpec {
  id: string;
  labelSk: string;
  minSeconds: number;
  maxSeconds: number;
}

export interface RemovedRange {
  start: number;
  end: number;
  label: string;
  reason: string;
  seconds: number;
}

export interface RetentionSegment {
  id: string;
  /** Zdrojový čas (v RAW videu). */
  sourceStart: number;
  sourceEnd: number;
  /** Čas vo výslednom klipu. */
  timelineStart: number;
  duration: number;
  label: string;
  reason: string;
  /** True, ak bol úsek prehodený na začiatok kvôli hooku. */
  movedForHook?: boolean;
}

export interface RetentionWarning {
  level: "info" | "warn" | "stop";
  text: string;
  hint?: string;
}

export interface RetentionEdl {
  id: string;
  createdAt: string;
  platform: string;
  platformLabelSk: string;
  mode: string;
  sourceDurationSec: number;
  targetDurationSec: number;
  /** Výsledná dĺžka klipu po vystrihnutí. */
  totalDurationSec: number;
  segments: RetentionSegment[];
  removedRanges: RemovedRange[];
  removedSeconds: number;
  removedShare: number;
  droppedForLength: RemovedRange[];
  hookFirst: boolean;
  hookMoved: boolean;
  warnings: RetentionWarning[];
  stats: {
    keptSegments: number;
    removedCount: number;
    shortestSegmentSec: number;
    cutsPerMinute: number;
  };
  /** Na čom je strih postavený — dedí sa z plánu. */
  basis: DirectorBasis | "mixed" | "none";
  /**
   * Na čom sú postavené ČASY strihu:
   *  - `words` — prichytené na hranice slov (presnosť ~0,1 s), z word-level tituliek
   *  - `sentences` — málo slov, ale presné časy viet z tituliek
   *  - `estimate` — časy viet odhadnuté z dĺžky textu (najmenej presné)
   */
  timingPrecision: TimingPrecision;
  /** Koľko strihov sa posunulo kvôli hranici slova (a o koľko najviac). */
  wordSnap: {
    snappedCount: number;
    maxShiftSec: number;
    /** Ľudské hlásenia — presne to, čo sa stalo. */
    reports: string[];
  };
}

export interface BuildRetentionEdlInput {
  plan: RetentionPlanItemLike[];
  durationSec: number;
  platform: RetentionPlatformSpec;
  mode?: string;
  /** Krátke zvyšky sa zahodia, aby klip nebol nervózny. */
  minSegmentSec?: number;
  /**
   * Word-level časovanie z automatických tituliek (`/api/transcribe-speech`).
   * Keď je k dispozícii, strihy sa **prichytia na hranice slov** — reč sa
   * nepretne v polovici a každý posun je ohlásený v desatinách sekundy.
   * Keď nie je, strih funguje ako doteraz (a je to priznané).
   */
  speechSegments?: SpeechSegmentLike[];
  now?: Date;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Slovenské tvary počtu: 1 úsek / 2 úseky / 5 úsekov. */
export function pluralSk(n: number, one: string, few: string, many: string): string {
  const count = Math.abs(Math.round(n));
  if (count === 1) return `${count} ${one}`;
  if (count >= 2 && count <= 4) return `${count} ${few}`;
  return `${count} ${many}`;
}

function clampRange(start: number, end: number, duration: number): [number, number] {
  const s = Math.max(0, Math.min(start, duration));
  const e = Math.max(0, Math.min(end, duration));
  return s <= e ? [round2(s), round2(e)] : [round2(e), round2(s)];
}

/** Zlúči prekrývajúce sa alebo na seba nadväzujúce rozsahy. */
export function mergeRanges(ranges: [number, number][]): [number, number][] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [sorted[0]];
  for (const [s, e] of sorted.slice(1)) {
    const last = out[out.length - 1];
    if (s <= last[1] + 0.001) {
      last[1] = Math.max(last[1], e);
    } else {
      out.push([s, e]);
    }
  }
  return out;
}

/** Doplnok k vystrihnutým rozsahom = úseky, ktoré zostanú. */
export function complementRanges(
  removed: [number, number][],
  duration: number,
): [number, number][] {
  const keep: [number, number][] = [];
  let cursor = 0;
  for (const [s, e] of removed) {
    if (s > cursor) keep.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < duration) keep.push([cursor, duration]);
  return keep.filter(([s, e]) => e - s > 0.01);
}

/**
 * Vyreže z rozsahov jeden úsek [start, end) a vráti zvyšok aj vyrezaný úsek.
 * Používa sa na presun hook vety na začiatok klipu.
 */
export function carveRange(
  ranges: [number, number][],
  start: number,
  end: number,
): { rest: [number, number][]; carved: [number, number] } {
  const rest: [number, number][] = [];
  for (const [s, e] of ranges) {
    if (e <= start || s >= end) {
      rest.push([s, e]);
      continue;
    }
    if (s < start) rest.push([s, start]);
    if (e > end) rest.push([end, e]);
  }
  return { rest: rest.filter(([s, e]) => e - s > 0.01), carved: [start, end] };
}

/**
 * Hlavná funkcia: z plánu postaví EDL pre krátky klip.
 * Je deterministická — rovnaký vstup dá vždy rovnaký výstup.
 */
export function buildRetentionEdl(input: BuildRetentionEdlInput): RetentionEdl {
  const now = input.now || new Date();
  const duration = Math.max(1, Number(input.durationSec) || 0);
  const minSeg = input.minSegmentSec ?? DEFAULT_MIN_SEGMENT_SEC;
  const plan = Array.isArray(input.plan) ? input.plan : [];
  const warnings: RetentionWarning[] = [];

  // 1) Vystrihnuté rozsahy z plánu
  const cutItems = plan.filter((i) => i.type === "CUT" && Number.isFinite(i.start));
  const removedRanges: RemovedRange[] = [];
  const rawRemoved: [number, number][] = [];

  for (const item of cutItems) {
    const end = Number.isFinite(item.end as number) ? (item.end as number) : item.start + 1.5;
    const [s, e] = clampRange(item.start, end, duration);
    if (e - s < 0.05) continue;
    rawRemoved.push([s, e]);
  }

  // --- Prichytenie strihov na hranice slov (krok A) ---
  // Ak máme word-level časovanie, strih nikdy nepretne slovo v polovici:
  // posunie sa do najbližšej pauzy alebo na hranicu slova. Každý posun sa hlási.
  const wordIndex: WordTimingIndex | null = input.speechSegments?.length
    ? buildWordIndex(flattenWords(input.speechSegments))
    : null;
  const wordSnapReports: string[] = [];
  let snappedCount = 0;
  let maxShiftSec = 0;

  if (wordIndex && wordIndex.words.length >= 3) {
    for (let i = 0; i < rawRemoved.length; i++) {
      const [s0, e0] = rawRemoved[i];
      const snapped = snapRangeToWords(s0, e0, wordIndex, 0.6);
      const startReport = snapReportSk(`Strih ${i + 1}`, snapped.startSnap, "start");
      const endReport = snapReportSk(`Strih ${i + 1}`, snapped.endSnap, "end");
      for (const r of [startReport, endReport]) {
        if (r) {
          wordSnapReports.push(r);
          snappedCount++;
          maxShiftSec = Math.max(maxShiftSec, snapped.startSnap.deltaSec, snapped.endSnap.deltaSec);
        }
      }
      rawRemoved[i] = [snapped.start, snapped.end];
    }
    if (snappedCount > 0) {
      warnings.push({
        level: "info",
        text: `Strihy som prichytil na hranice slov — ${pluralSk(snappedCount, "posun", "posuny", "posunov")}, najviac o ${round2(maxShiftSec).toFixed(2)} s.`,
        hint: "Je to zámerné: strih v pauze alebo na hranici slova divák nepočuje. Detaily sú v zozname nižšie.",
      });
    }
  }

  const mergedRemoved = mergeRanges(rawRemoved);
  for (const [s, e] of mergedRemoved) {
    // Priradiť dôvod: nájdeme prvý CUT zásah, ktorý do rozsahu patrí
    const source = cutItems.find((c) => {
      const cs = Number(c.start);
      const ce = Number.isFinite(c.end as number) ? (c.end as number) : cs + 1.5;
      return cs >= s - 0.01 && cs <= e + 0.01;
    });
    removedRanges.push({
      start: s,
      end: e,
      seconds: round2(e - s),
      label: source?.label || "Vystrihnutý úsek",
      reason: source?.reason || "Plán tu navrhol strih.",
    });
  }

  // 2) Zachované úseky (doplnok)
  let keepRanges = complementRanges(mergedRemoved, duration);

  // 3) Zahodiť príliš krátke zvyšky — krátky úsek pôsobí ako trhanie
  const tinyRanges: [number, number][] = [];
  keepRanges = keepRanges.filter(([s, e]) => {
    if (e - s < minSeg) {
      tinyRanges.push([s, e]);
      return false;
    }
    return true;
  });

  for (const [s, e] of tinyRanges) {
    removedRanges.push({
      start: s,
      end: e,
      seconds: round2(e - s),
      label: "Príliš krátky zvyšok",
      reason: `Zvyšok ${(e - s).toFixed(2)} s by v klipu pôsobil ako trhanie, preto ide tiež preč.`,
    });
  }
  removedRanges.sort((a, b) => a.start - b.start);

  // 4) Hook na začiatok.
  // Dôležité: nepresúvame celý dlhý úsek (tým sa hook nepredsunie), ale VYREŽEME
  // samotnú hook vetu a tú dáme na začiatok. Presne to robí editor pri front-loadingu.
  const hook = plan
    .filter((i) => i.type === "HOOK")
    .sort((a, b) => a.start - b.start)[0];
  let hookMoved = false;
  let hookWindow: [number, number] | null = null;

  if (hook && hook.start > 0.5) {
    const hookEnd =
      Number.isFinite(hook.end as number) && (hook.end as number) > hook.start + 0.2
        ? (hook.end as number)
        : Math.min(duration, hook.start + 3);
    const [hs, he] = clampRange(hook.start, hookEnd, duration);

    if (he - hs < 0.8) {
      warnings.push({
        level: "info",
        text: `Hook na ${hook.start.toFixed(1)} s je príliš krátky na samostatný presun.`,
        hint: "Nechal som strih bez presunu — over, či je hook vôbec použiteľný.",
      });
    } else if (mergedRemoved.some(([rs, re]) => hs < re && rs < he)) {
      warnings.push({
        level: "stop",
        text: "Hook leží vo vystrihnutom úseku — plán si navzájom odporuje.",
        hint: "Skontroluj plán: hook nemôže byť v časti, ktorú sám navrhuje vystrihnúť.",
      });
    } else {
      const carved = carveRange(keepRanges, hs, he);
      keepRanges = [carved.carved, ...carved.rest];
      hookWindow = carved.carved;
      hookMoved = true;
      warnings.push({
        level: "info",
        text: `Vyrezal som hook z ${hs.toFixed(1)} s a dal ho na začiatok klipu (${(he - hs).toFixed(1)} s).`,
        hint: "Front-loading mení poradie rozprávania — prehraj si prvých 5 sekúnd a over, či veta obstojí bez pôvodného kontextu.",
      });
    }
  }
  const hookFirst = !!hook && (hook.start <= 0.5 || hookMoved);

  // 5) Limit platformy — čo sa nezmestí, ide preč z konca (a povie sa to)
  const target = input.platform.maxSeconds;
  const droppedForLength: RemovedRange[] = [];
  const segmentSource = keepRanges.map(([s, e]) => ({ start: s, end: e }));

  let idCounter = 0;
  let segments: RetentionSegment[] = segmentSource.map((r, idx) => ({
    id: `seg-${++idCounter}`,
    sourceStart: r.start,
    sourceEnd: r.end,
    timelineStart: 0,
    duration: round2(r.end - r.start),
    label: idx === 0 ? "Úvod (hook)" : `Úsek ${idx + 1}`,
    reason: r.start === 0 ? "Začiatok videa" : "Zachovaná časť videa",
    movedForHook: false,
  }));

  const totalOf = (list: RetentionSegment[]) => round2(list.reduce((sum, s) => sum + s.duration, 0));

  while (segments.length > 1 && totalOf(segments) > target) {
    const dropped = segments[segments.length - 1];
    droppedForLength.unshift({
      start: dropped.sourceStart,
      end: dropped.sourceEnd,
      seconds: dropped.duration,
      label: "Nad limit platformy",
      reason: `Do limitu ${target} s pre ${input.platform.labelSk} sa nezmestil.`,
    });
    segments = segments.slice(0, -1);
  }

  // 6) Časová os výsledného klipu
  let cursor = 0;
  segments = segments.map((s) => {
    const timelineStart = round2(cursor);
    cursor += s.duration;
    return { ...s, timelineStart };
  });

  const totalDurationSec = round2(cursor);
  const removedSeconds = round2(
    removedRanges.reduce((sum, r) => sum + r.seconds, 0) +
      droppedForLength.reduce((sum, r) => sum + r.seconds, 0),
  );
  // Označíme úsek, ktorý sme prehodili na začiatok kvôli hooku.
  if (hookMoved && segments.length > 0) {
    segments[0] = { ...segments[0], movedForHook: true, label: "Úvod (hook presunutý)" };
  }

  // 7) Kontroly a upozornenia — poctivo, aj keď sa to nepáči
  const removedShare = duration > 0 ? removedSeconds / duration : 0;

  if (mergedRemoved.length === 0 && tinyRanges.length === 0) {
    warnings.push({
      level: "warn",
      text: "Plán v tomto behu nič nestrihá — klip by bol rovnako dlhý ako RAW.",
      hint: "Skontroluj, či plán našiel výplňové vety (vlož prepis), alebo zvýš agresivitu režimu.",
    });
  }

  if (removedShare > 0.35) {
    warnings.push({
      level: "warn",
      text: `Strih odstráni ${(removedShare * 100).toFixed(0)} % videa.`,
      hint: "Pri takom rozsahu hrozí, že sa stratí kontext. Prehraj si klip celý a skontroluj, či pointy zostali celé.",
    });
  }

  if (totalDurationSec < input.platform.minSeconds) {
    warnings.push({
      level: "stop",
      text: `Výsledný klip má ${totalDurationSec.toFixed(1)} s — pod minimom pre ${input.platform.labelSk} (${input.platform.minSeconds} s).`,
      hint: "Pridaj ďalší materiál, zníž počet strihov, alebo zvoľ kratší formát (napr. Reels/TikTok).",
    });
  } else if (totalDurationSec > input.platform.maxSeconds) {
    warnings.push({
      level: "warn",
      text: `Výsledok je ${totalDurationSec.toFixed(1)} s, čo je nad limitom ${input.platform.maxSeconds} s.`,
      hint: "Skráť ďalšie úseky alebo rozdeľ na dva klipy.",
    });
  }

  if (droppedForLength.length > 0) {
    warnings.push({
      level: "warn",
      text: `Kvôli limitu ${input.platform.labelSk} som odrezal ${pluralSk(
        droppedForLength.length,
        "úsek",
        "úseky",
        "úsekov",
      )} z konca (${round2(droppedForLength.reduce((sum, d) => sum + d.seconds, 0))} s).`,
      hint: "Ak je tam niečo dôležité, skráť skôr stredné pasáže a ponechaj uzáver.",
    });
  }

  const shortSegs = segments.filter((s) => s.duration < MIN_USEFUL_SEGMENT_SEC).length;
  if (segments.length > 3 && shortSegs / segments.length > 0.5) {
    warnings.push({
      level: "info",
      text: "Veľa krátkych úsekov za sebou — klip môže pôsobiť nervózne.",
      hint: "Zváž, či niektoré strihy zlúčiť (napr. zrýchliť pasáž namiesto strihu).",
    });
  }

  const basisSet = new Set(plan.map((i) => i.basis).filter(Boolean) as string[]);
  const basis: RetentionEdl["basis"] =
    basisSet.size === 0 ? "none" : basisSet.size > 1 ? "mixed" : (basisSet.values().next().value as any);

  if (basis === "estimate" || basis === "none") {
    warnings.push({
      level: "warn",
      text: "Časy v strihu sú odhad (plán nie je kotvený na prepis).",
      hint: "Vlož prepis hovoreného slova do plánu — strihy potom sedia na skutočné vety.",
    });
  }

  const cutsPerMinute =
    totalDurationSec > 0 ? Math.round(((segments.length - 1) / (totalDurationSec / 60)) * 10) / 10 : 0;

  return {
    id: `short-${now.getTime().toString(36)}`,
    createdAt: now.toISOString(),
    platform: input.platform.id,
    platformLabelSk: input.platform.labelSk,
    mode: input.mode || "SOCIAL",
    sourceDurationSec: round2(duration),
    targetDurationSec: target,
    totalDurationSec,
    segments,
    removedRanges,
    removedSeconds,
    removedShare: Math.round(removedShare * 1000) / 1000,
    droppedForLength,
    hookFirst,
    hookMoved,
    warnings,
    stats: {
      keptSegments: segments.length,
      removedCount: removedRanges.length + droppedForLength.length,
      shortestSegmentSec: segments.length
        ? round2(Math.min(...segments.map((s) => s.duration)))
        : 0,
      cutsPerMinute,
    },
    basis,
    timingPrecision:
      wordIndex && wordIndex.words.length >= 3 ? wordIndex.precision : basis === "transcript" ? "sentences" : "estimate",
    wordSnap: {
      snappedCount,
      maxShiftSec: round2(maxShiftSec),
      reports: wordSnapReports,
    },
  };
}

/**
 * Prehrávanie náhľadu: ak je aktuálny čas vo vystrihnutom úseku, vráti čas,
 * na ktorý treba skočiť. Ak nie, vráti null (prehrávanie pokračuje).
 * Vďaka tomuto sa náhľad klipu dá prehrať bez jedinej sekundy renderu.
 */
export function nextKeepTime(edl: RetentionEdl, time: number): number | null {
  for (const drop of [...edl.removedRanges, ...edl.droppedForLength]) {
    if (time >= drop.start && time < drop.end) {
      return round2(drop.end);
    }
  }
  return null;
}

/** Dĺžka výsledného klipu (na kontrolu v UI). */
export function edlDuration(edl: RetentionEdl): number {
  return round2(edl.segments.reduce((sum, s) => sum + s.duration, 0));
}

/** Prevod EDL na klipy timeline (sourceStart/duration/timelineStart) pre render. */
export function edlToClipSpecs(edl: RetentionEdl) {
  return edl.segments.map((s) => ({
    name: s.label,
    sourceStart: s.sourceStart,
    sourceEnd: s.sourceEnd,
    timelineStart: s.timelineStart,
    duration: s.duration,
  }));
}

/** Zhrnutie pre používateľa — bez marketingu. */
export function edlSummarySk(edl: RetentionEdl): string {
  const parts = [
    `Klip pre ${edl.platformLabelSk}: ${edl.totalDurationSec.toFixed(1)} s z pôvodných ${edl.sourceDurationSec.toFixed(0)} s.`,
    `Zostáva ${pluralSk(edl.stats.keptSegments, "úsek", "úseky", "úsekov")}, vystrihnutých ${pluralSk(
      edl.stats.removedCount,
      "úsek",
      "úseky",
      "úsekov",
    )} (${edl.removedSeconds.toFixed(1)} s, ${(edl.removedShare * 100).toFixed(0)} %).`,
  ];
  if (edl.hookMoved) parts.push("Hook som presunul na začiatok.");
  else if (edl.hookFirst) parts.push("Hook už bol na začiatku — sedí to.");
  return parts.join(" ");
}

export const mmss = (seconds: number): string => {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
};

/**
 * WORD-LEVEL ČASOVANIE (krok A).
 *
 * Problém, ktorý to rieši: keď strih padne doprostred slova, divák to počuje.
 * Doteraz appka odhadovala časy viet podľa dĺžky textu (prepis prilepený z titulkovej
 * appky nemá časovanie), takže strih mohol preťať slovo v polovici.
 *
 * Odkiaľ berieme presné časy: automatické titulky (`/api/transcribe-speech`) už
 * vracajú **časovanie po slovách** — appka ich len nepoužívala v pláne a v strihu.
 * Tento modul z nich robí:
 *   1. presné časovanie viet (nie odhad),
 *   2. **pauzy medzi slovami** — najprirodzenejšie miesto pre strih,
 *   3. prichytenie ľubovoľného času na hranicu slova (aby sa nič nepretlo).
 *
 * Zásady (rovnaké ako inde v projekte):
 *  - Modul je **čistý** — žiadne siete, žiadny stav, dá sa testovať bez videa.
 *  - **Nič sa nedomýšľa.** Keď slová nie sú, vráti sa poctivé „nemám presné časovanie"
 *    a volajúci sa rozhodne (typicky fallback na odhad podľa textu).
 *  - **Každý zásah je viditeľný.** Keď sa strih posunul kvôli hranici slova,
 *    výsledok to hlási — v desatinách sekundy, nie „približne".
 */

// ---------------------------------------------------------------------------
// Typy
// ---------------------------------------------------------------------------

export interface WordTimingLike {
  word: string;
  start: number;
  end: number;
  highlight?: boolean;
}

/** Titulkový segment tak, ako ho vracia `/api/transcribe-speech`. */
export interface SpeechSegmentLike {
  id?: string;
  start: number;
  end: number;
  text: string;
  words?: WordTimingLike[];
}

export type TimingPrecision = "words" | "sentences" | "estimate";

export interface SentenceTiming {
  text: string;
  start: number;
  end: number;
  index: number;
  /** Počet slov, ktoré túto vetu tvoria (0 = veta bez slov). */
  wordCount: number;
  precision: TimingPrecision;
}

export interface SpeechGap {
  start: number;
  end: number;
  duration: number;
}

export interface WordBoundary {
  /** Čas hranice (koniec jedného slova = začiatok druhého). */
  time: number;
  /** Ktoré slovo pred hranicou končí (môže chýbať na začiatku). */
  beforeWord?: string;
  /** Ktoré slovo za hranicou začína (môže chýbať na konci). */
  afterWord?: string;
  /** Dĺžka pauzy, ktorú hranica predstavuje (0 = slová na seba nadväzujú). */
  gapSec: number;
}

export interface SnapResult {
  /** Prichytený čas. */
  time: number;
  /** O koľko sekúnd sa posunul (absolútna hodnota). */
  deltaSec: number;
  /** Čo sa na hranici nachádza (pre zrozumiteľné hlásenie). */
  boundary?: WordBoundary;
  /** True, ak sa nič nemenilo (čas už bol na hranici slov). */
  unchanged: boolean;
}

export interface WordTimingIndex {
  words: WordTimingLike[];
  /** Všetky hranice slov (vrátane medzier) zoradené podľa času. */
  boundaries: WordBoundary[];
  /** Pauzy dlhšie než `minGapSec` — najlepšie miesta pre strih. */
  gaps: SpeechGap[];
  /** Prvý a posledný okamih reči. */
  speechStart: number;
  speechEnd: number;
  precision: TimingPrecision;
}

// ---------------------------------------------------------------------------
// Pomocné
// ---------------------------------------------------------------------------

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function cleanWord(w: unknown): string {
  return String(w ?? "").trim();
}

/** Z titulkových segmentov vytiahne jedno zoradené pole slov (bez duplicít). */
export function flattenWords(segments: SpeechSegmentLike[]): WordTimingLike[] {
  const out: WordTimingLike[] = [];
  const seen = new Set<string>();

  for (const seg of Array.isArray(segments) ? segments : []) {
    const words = Array.isArray(seg?.words) ? seg.words : [];
    for (const w of words) {
      const word = cleanWord(w?.word);
      if (!word) continue;
      const start = num(w?.start, num(seg?.start, 0));
      let end = num(w?.end, start + 0.2);
      if (end <= start) end = start + 0.08; // poškodené časy nezhodíme, len spravíme použiteľné
      // deduplikácia: rovnaké slovo s rovnakým začiatkom (prekryté segmenty)
      const key = `${word}@${start.toFixed(3)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ word, start, end, highlight: w?.highlight });
    }
  }

  return out.sort((a, b) => a.start - b.start || a.end - b.end);
}

/**
 * Postaví index hraníc a pauzy z časovania slov.
 * `minGapSec` je najmenšia pauza, ktorú ešte považujeme za miesto na strih
 * (pod 0,08 s je to len medzera v meraní, nie pauza v reči).
 */
export function buildWordIndex(words: WordTimingLike[], minGapSec = 0.08): WordTimingIndex {
  const list = (Array.isArray(words) ? words : [])
    .map((w) => ({
      word: cleanWord(w?.word),
      start: num(w?.start, 0),
      end: num(w?.end, num(w?.start, 0) + 0.1),
      highlight: w?.highlight,
    }))
    .filter((w) => w.word.length > 0)
    .sort((a, b) => a.start - b.start);

  const boundaries: WordBoundary[] = [];
  const gaps: SpeechGap[] = [];

  // Hranica existuje na ZAČIATKU aj na KONCI každého slova. Obe sú legitímne
  // miesta na strih: začiatok = „odtiaľto strihám", koniec = „sem to slovo ešte
  // patrí". Bez koncových hraníc by sa strih prichytil na začiatok slova,
  // ktoré malo ostať celé — presne to odhalil test.
  for (let i = 0; i < list.length; i++) {
    const prev = list[i - 1];
    const cur = list[i];
    const next = list[i + 1];

    const gapBefore = prev ? Math.max(0, cur.start - prev.end) : 0;
    const gapAfter = next ? Math.max(0, next.start - cur.end) : 0;

    boundaries.push({
      time: cur.start,
      beforeWord: prev?.word,
      afterWord: cur.word,
      gapSec: gapBefore,
    });
    boundaries.push({
      time: cur.end,
      beforeWord: cur.word,
      afterWord: next?.word,
      gapSec: gapAfter,
    });

    if (gapBefore >= minGapSec) {
      gaps.push({ start: prev!.end, end: cur.start, duration: gapBefore });
    }
    if (gapAfter >= minGapSec) {
      gaps.push({ start: cur.end, end: next!.start, duration: gapAfter });
    }
  }

  const precision: TimingPrecision = list.length >= 3 ? "words" : "sentences";

  const last = list[list.length - 1];

  // každá pauza sa našla dvakrát (z konca aj zo začiatku) — necháme jednu
  const uniqueGaps: SpeechGap[] = [];
  for (const g of gaps.sort((a, b) => a.start - b.start)) {
    const last = uniqueGaps[uniqueGaps.length - 1];
    if (last && Math.abs(last.start - g.start) < 1e-6 && Math.abs(last.end - g.end) < 1e-6) continue;
    uniqueGaps.push(g);
  }

  return {
    words: list,
    boundaries: boundaries.sort((a, b) => a.time - b.time),
    gaps: uniqueGaps,
    speechStart: list.length ? list[0].start : 0,
    speechEnd: last ? last.end : 0,
    precision,
  };
}

/** Najdlhšie pauzy (typicky miesta, kde má zmysel klip rozdeliť alebo strihať). */
export function longestGaps(index: WordTimingIndex, limit = 5): SpeechGap[] {
  return [...index.gaps].sort((a, b) => b.duration - a.duration).slice(0, Math.max(0, limit));
}

// ---------------------------------------------------------------------------
// Prichytenie na hranicu slova
// ---------------------------------------------------------------------------

/**
 * Prichytí čas na hranicu slova.
 *
 * `direction`:
 *  - `"before"` — posunieme sa na hranicu pred časom (nič nepridáme do záberu),
 *  - `"after"`  — na hranicu za časom (nič neukrojíme z reči),
 *  - `"nearest"` — najbližšia hranica.
 *
 * Preferencia (dôležitá pre kvalitu): ak je na výber medzi **hranicou v pauze**
 * a hranicou, kde slová na seba nadväzujú, vyhráva pauza — strih v pauze je
 * pre diváka neviditeľný.
 *
 * `maxShiftSec` obmedzí maximálny posun; keď je najbližšia hranica príliš ďaleko,
 * vráti sa pôvodný čas a `unchanged: true` (radšej nič než nečakaný veľký posun).
 */
export function snapToWordBoundary(
  time: number,
  index: WordTimingIndex,
  direction: "before" | "after" | "nearest" = "nearest",
  maxShiftSec = 1.5,
): SnapResult {
  const t = num(time, 0);
  if (!index || index.boundaries.length === 0) {
    return { time: t, deltaSec: 0, unchanged: true };
  }

  const candidates = index.boundaries.filter((b) => {
    if (direction === "before") return b.time <= t + 1e-6;
    if (direction === "after") return b.time >= t - 1e-6;
    return true;
  });

  if (candidates.length === 0) return { time: t, deltaSec: 0, unchanged: true };

  const scored = candidates
    .map((b) => ({ b, dist: Math.abs(b.time - t) }))
    .sort((a, b) => {
      // 1) pauza je krajšia než tesná hranica (do 0,25 s rozdielu)
      const gapA = a.b.gapSec > 0.05 ? 1 : 0;
      const gapB = b.b.gapSec > 0.05 ? 1 : 0;
      if (gapA !== gapB) {
        const close = Math.abs(a.dist - b.dist) < 0.25;
        if (close) return gapB - gapA;
      }
      // 2) inak najbližšia
      if (a.dist !== b.dist) return a.dist - b.dist;
      // 3) determinizmus
      return a.b.time - b.b.time;
    });

  const best = scored[0];
  if (!best || best.dist > maxShiftSec) {
    return { time: t, deltaSec: 0, unchanged: true };
  }

  return {
    time: best.b.time,
    deltaSec: Math.abs(best.b.time - t),
    boundary: best.b,
    unchanged: Math.abs(best.b.time - t) < 1e-3,
  };
}

/**
 * Rozšíri strihaný rozsah tak, aby **nepretal ani jedno slovo**.
 *
 * Začiatok strihu sa posunie na koniec slova, ktoré by inak ostalo prerezané
 * (tým pádom sa celé slovo vystrihne — nič nepofrká). Koniec strihu sa posunie
 * na koniec prerezaného slova (celé slovo ostane vonku).
 * Rozsah sa len **zmenšuje alebo posúva**, nikdy dramaticky nerozširuje —
 * `maxShiftSec` to stráži.
 */
export function snapRangeToWords(
  start: number,
  end: number,
  index: WordTimingIndex,
  maxShiftSec = 0.6,
): { start: number; end: number; startSnap: SnapResult; endSnap: SnapResult; changed: boolean } {
  const s = num(start, 0);
  const e = num(end, s);
  const startSnap = snapToWordBoundary(s, index, "before", maxShiftSec);
  const endSnap = snapToWordBoundary(e, index, "after", maxShiftSec);
  const newStart = Math.min(startSnap.time, e - 0.05);
  const newEnd = Math.max(endSnap.time, newStart + 0.05);
  return {
    start: newStart,
    end: newEnd,
    startSnap,
    endSnap,
    changed: Math.abs(newStart - s) > 0.001 || Math.abs(newEnd - e) > 0.001,
  };
}

// ---------------------------------------------------------------------------
// Vety z časovania slov
// ---------------------------------------------------------------------------

/**
 * Poskladá vety s PRESNÝMI časmi z titulkových segmentov.
 *
 * Titulky sú krátke (2–6 slov), takže samy o sebe nie sú „veta". Spájame ich,
 * kým nenarazíme na koniec vety (`. ! ? …`) alebo na **pauzu** dlhšiu než
 * `pauseBreakSec` — pauza v reči je prirodzená hranica myšlienky, aj keď
 * interpunkcia chýba.
 */
export function buildSentenceTimings(
  segments: SpeechSegmentLike[],
  pauseBreakSec = 0.45,
  maxSentences = 120,
): SentenceTiming[] {
  const segs = (Array.isArray(segments) ? segments : [])
    .map((s, i) => {
      const words = Array.isArray(s?.words)
        ? s.words.filter((w) => cleanWord(w?.word))
        : [];
      const start = num(s?.start, 0);
      const declaredEnd = num(s?.end, start + 0.5);
      // Slová sú presnejšie než hranice segmentu (segment často „presahuje“ do pauzy).
      const wordEnd = words.length ? Math.max(...words.map((w) => num(w?.end, start))) : 0;
      return {
        text: String(s?.text ?? "").trim(),
        start,
        end: wordEnd > start ? wordEnd : declaredEnd,
        words,
        i,
      };
    })
    .filter((s) => s.text.length > 0 || s.words.length > 0)
    .sort((a, b) => a.start - b.start || a.i - b.i);

  const out: SentenceTiming[] = [];
  let buf: { text: string[]; start: number; end: number; words: number } | null = null;

  const flush = () => {
    if (!buf) return;
    const text = buf.text.join(" ").replace(/\s+/g, " ").trim();
    if (text) {
      out.push({
        text,
        start: round3(buf.start),
        end: round3(buf.end),
        index: out.length,
        wordCount: buf.words,
        precision: buf.words > 0 ? "words" : "estimate",
      });
    }
    buf = null;
  };

  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const prev = segs[i - 1];
    const pause = prev ? s.start - prev.end : 0;

    if (buf && pause >= pauseBreakSec) flush();

    if (!buf) {
      buf = { text: [], start: s.start, end: s.end, words: s.words.length };
    } else {
      buf.end = Math.max(buf.end, s.end);
      buf.words += s.words.length;
    }
    buf.text.push(s.text || s.words.map((w) => cleanWord(w.word)).join(" "));

    // koniec vety podľa interpunkcie
    if (/[.!?…]["')\]]?$/.test(s.text.trim())) flush();
  }
  flush();

  return out.slice(0, maxSentences);
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Zistí, aká časť videa je pokrytá rečou — hodí sa na rozhodnutie, či má zmysel
 * strihať „ticho" (napr. keď je reči 95 %, strihanie ticha nič neprinesie).
 */
export function speechCoverage(words: WordTimingLike[], durationSec: number): { ratio: number; speechSec: number } {
  const list = (Array.isArray(words) ? words : []).filter((w) => cleanWord(w?.word));
  const speechSec = list.reduce((sum, w) => sum + Math.max(0, num(w.end) - num(w.start)), 0);
  const total = Math.max(0.001, num(durationSec, 0));
  return { ratio: Math.min(1, speechSec / total), speechSec: round3(speechSec) };
}

// ---------------------------------------------------------------------------
// Texty pre človeka
// ---------------------------------------------------------------------------

/** Jednou vetou: na čom je strih postavený — bez zveličovania. */
export function precisionLabelSk(index: WordTimingIndex | null, sentenceCount = 0): string {
  if (!index || index.words.length === 0) {
    return sentenceCount > 0
      ? `Časovanie viet je odhad z dĺžky textu — strihy môžu byť o pár desatín vedľa.`
      : "Nemám časovanie reči — strihy sú len podľa plánu.";
  }
  const gaps = index.gaps.length;
  return (
    `Časovanie je presné na slová (${index.words.length} slov, ${gaps} páuz). ` +
    `Strihy sa prichycujú na hranice slov, takže reč sa nepretne v polovici.`
  );
}

/** Hlásenie konkrétneho posunu — v desatinách, s tým, čo sa na hranici nachádza. */
export function snapReportSk(
  label: string,
  snap: SnapResult,
  side: "start" | "end",
): string | null {
  if (!snap || snap.unchanged || snap.deltaSec < 0.005) return null;
  const dir = side === "start" ? "skôr" : "neskôr";
  const where = snap.boundary
    ? snap.boundary.gapSec > 0.05
      ? `pauza ${snap.boundary.gapSec.toFixed(2)} s`
      : "hranica slov"
    : "hranica slov";
  return `${label}: ${side === "start" ? "začiatok" : "koniec"} som posunul o ${snap.deltaSec.toFixed(2)} s ${dir} (${where}) — aby sa slovo nepretlo.`;
}

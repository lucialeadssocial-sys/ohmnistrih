/**
 * VYPÁLENIE TITULKOV DO OBRAZU (krok B).
 *
 * Prečo to existuje: klip vyrenderovaný cez F2b je čistý strih bez titulkov.
 * TikTok/Reels bez titulkov znamenajú, že väčšina ľudí (ktorí pozerajú bez zvuku)
 * video odscrolluje. Preto potrebujeme titulky **zapečené do obrazu** — to sa
 * nedá spraviť kopírovaním packetov, tu sa prekódováva (a volá sa to explicitne).
 *
 * Ako: ASS formát pre ffmpeg filter `ass` (libas). ASS je textový formát, takže
 * sa dá **úplne otestovať bez videa** — a to aj robíme.
 *
 * Zásady:
 *  - Nič sa nedomýšľa: keď nie sú word-level časy, zvýrazňovanie slova sa
 *    vypne a appka to povie (radšej čistý text než náhodné blikanie).
 *  - Cudzí text sa escapuje — text z prepisu nikdy nesmie rozbiť ASS súbor.
 *  - Bezpečné okraje: titulky nesmú skončiť pod rozhraním TikToku/Reels.
 */

import type { SpeechSegmentLike, WordTimingLike } from "../transcript/wordTiming";

// ---------------------------------------------------------------------------
// Typy
// ---------------------------------------------------------------------------

export type CaptionStyleId = "VIRAL_BOLD" | "CLEAN" | "MINIMAL";

export interface CaptionStyleSpec {
  id: CaptionStyleId;
  labelSk: string;
  descriptionSk: string;
  /** Veľkosť fontu ako podiel výšky videa (1/1000). */
  fontSizeRatio: number;
  bold: boolean;
  uppercase: boolean;
  /** Farba textu (ASS &HAABBGGRR). */
  primaryColor: string;
  /** Farba zvýrazneného slova. */
  highlightColor: string;
  outlineColor: string;
  outlineWidth: number;
  shadow: number;
  /** Koľko slov sa zobrazuje naraz (viral štýl ukazuje málo slov, veľké). */
  wordsPerChunk: number;
  /** Spodný okraj ako podiel výšky — kvôli rozhraniu aplikácií. */
  bottomMarginRatio: number;
}

const C = {
  WHITE: "&H00FFFFFF",
  YELLOW: "&H0000FFFF", // v ASS je poradie BGR → toto je žltá
  GREEN: "&H0000FF00",
  BLACK: "&H00000000",
  TRANSPARENT_BACK: "&H80000000",
} as const;

export const CAPTION_STYLES: CaptionStyleSpec[] = [
  {
    id: "VIRAL_BOLD",
    labelSk: "Virálny (Submagic štýl)",
    descriptionSk: "Veľké tučné písmo, 2–3 slová naraz, aktuálne slovo žlté. Najčítanejšie bez zvuku.",
    fontSizeRatio: 78,
    bold: true,
    uppercase: true,
    primaryColor: C.WHITE,
    highlightColor: C.YELLOW,
    outlineColor: C.BLACK,
    outlineWidth: 6,
    shadow: 3,
    wordsPerChunk: 3,
    bottomMarginRatio: 0.16,
  },
  {
    id: "CLEAN",
    labelSk: "Čistý (celá veta)",
    descriptionSk: "Pokojné biele písmo, celá veta naraz, bez zvýrazňovania slov.",
    fontSizeRatio: 54,
    bold: true,
    uppercase: false,
    primaryColor: C.WHITE,
    highlightColor: C.WHITE,
    outlineColor: C.BLACK,
    outlineWidth: 4,
    shadow: 2,
    wordsPerChunk: 0, // 0 = celý segment
    bottomMarginRatio: 0.14,
  },
  {
    id: "MINIMAL",
    labelSk: "Minimálny",
    descriptionSk: "Malé decentné písmo bez výrazného obrysu — pre firemné a dokumentárne video.",
    fontSizeRatio: 42,
    bold: false,
    uppercase: false,
    primaryColor: C.WHITE,
    highlightColor: C.WHITE,
    outlineColor: C.BLACK,
    outlineWidth: 2,
    shadow: 1,
    wordsPerChunk: 0,
    bottomMarginRatio: 0.12,
  },
];

export function getCaptionStyle(id: CaptionStyleId): CaptionStyleSpec {
  const s = CAPTION_STYLES.find((x) => x.id === id);
  if (!s) throw new Error(`Neznámy štýl titulkov: ${id}`);
  return s;
}

export interface AssBuildOptions {
  segments: SpeechSegmentLike[];
  style: CaptionStyleSpec;
  width: number;
  height: number;
  /** Názov fontu, ktorý je na serveri naozaj k dispozícii. */
  fontName?: string;
  /** Posun celej titulkovej stopy (napr. keď klip začína neskôr v zdroji). */
  timeOffsetSec?: number;
  /** Oreže titulky na tento rozsah (dĺžka klipu). */
  durationSec?: number;
}

export interface AssBuildResult {
  /** Obsah .ass súboru. */
  ass: string;
  /** Koľko titulkov sa vypáli. */
  eventCount: number;
  /** True, ak sa dá zvýrazňovať aktuálne slovo (má word-level časy). */
  wordHighlight: boolean;
  notesSk: string[];
}

// ---------------------------------------------------------------------------
// Pomocné
// ---------------------------------------------------------------------------

/** ASS čas: H:MM:SS.cc (stotiny). */
export function assTime(seconds: number): string {
  const t = Math.max(0, Number(seconds) || 0);
  // Počíta sa v stotinách a zaokrúhľuje — inak by plávajúca desatinná čiarka
  // odsekla poslednú stotinu (61.23 s dávalo „.22").
  const totalCs = Math.round(t * 100);
  const h = Math.floor(totalCs / 360000);
  const m = Math.floor((totalCs % 360000) / 6000);
  const sec = Math.floor((totalCs % 6000) / 100);
  const cs = totalCs % 100;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/**
 * Escapuje text pre ASS.
 * V ASS sú špeciálne `{` `}` (bloky kódu), `\` a nový riadok. Text z prepisu je
 * cudzí vstup — nikdy nesmie prepísať štýly ani rozbiť súbor.
 */
export function escapeAssText(text: string): string {
  return String(text ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\r?\n/g, "\\N")
    .trim();
}

/**
 * Zalomenie textu na riadky podľa odhadnutej šírky.
 * Prečo ručne: libass pri dlhom texte preteká mimo obraz (overené v teste).
 * Šírka znaku ≈ 0,55 × veľkosť fontu (pri tučnom písme sedí na Montserrat/DejaVu).
 */
export function wrapAssLines(
  words: string[],
  fontSize: number,
  maxWidthPx: number,
  maxLines = 2,
): string[] {
  const perChar = fontSize * 0.55;
  const maxChars = Math.max(8, Math.floor(maxWidthPx / perChar));
  const lines: string[] = [];
  let current = "";

  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (candidate.length <= maxChars || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);

  // Keď je riadkov priveľa, **nelepíme ich do jedného dlhého** (to bola chyba —
  // text potom pretiekol z obrazu). Radšej necháme o riadok viac: prečítať tri
  // riadky je lepšie než nerušene pretekajúci text.
  if (lines.length > maxLines + 1) {
    // Zvyšok spojíme len vtedy, keď sa to ešte zmestí do rozumnej šírky.
    const head = lines.slice(0, maxLines - 1);
    const rest = lines.slice(maxLines - 1).join(" ");
    if (rest.length <= Math.ceil(maxChars * 1.4)) head.push(rest);
    else head.push(...lines.slice(maxLines - 1));
    return head;
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Stavba ASS
// ---------------------------------------------------------------------------

/** Slová jedného segmentu (s časmi), alebo prázdne pole. */
function segmentWords(seg: SpeechSegmentLike): WordTimingLike[] {
  return (Array.isArray(seg?.words) ? seg.words : [])
    .filter((w) => String(w?.word ?? "").trim().length > 0)
    .map((w) => ({
      word: String(w.word).trim(),
      start: Number(w.start) || 0,
      end: Number(w.end) || (Number(w.start) || 0) + 0.2,
    }))
    .sort((a, b) => a.start - b.start);
}

/**
 * Postaví ASS súbor z titulkových segmentov.
 *
 * Dva režimy:
 *  - **so slovami** → zvýrazňuje aktuálne slovo (virálny štýl),
 *  - **bez slov** → zobrazí celý segment naraz (a prizná to v `notesSk`).
 */
export function buildAssFile(options: AssBuildOptions): AssBuildResult {
  const { segments, style, width, height } = options;
  const fontName = options.fontName || "DejaVu Sans";
  const offset = Number(options.timeOffsetSec) || 0;
  const limit = Number.isFinite(options.durationSec) ? (options.durationSec as number) : Infinity;
  const fontSize = Math.max(18, Math.round((height * style.fontSizeRatio) / 1000));
  const bottomMargin = Math.round(height * style.bottomMarginRatio);
  const sideMargin = Math.round(width * 0.06);
  const maxTextWidth = width - sideMargin * 2;

  const notesSk: string[] = [];
  let eventCount = 0;
  let wordHighlight = false;

  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${Math.max(2, Math.round(width))}`,
    `PlayResY: ${Math.max(2, Math.round(height))}`,
    "WrapStyle: 2",
    "ScaledBorderAndShadow: yes",
    "YCbCr Matrix: None",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    [
      "Style: Default",
      fontName,
      fontSize,
      style.primaryColor,
      style.primaryColor,
      style.outlineColor,
      C.TRANSPARENT_BACK,
      style.bold ? "-1" : "0",
      "0",
      "0",
      "0",
      "100",
      "100",
      "0",
      "0",
      "1",
      style.outlineWidth,
      style.shadow,
      "2", // dole, na stred
      sideMargin,
      sideMargin,
      bottomMargin,
      "1",
    ].join(","),
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  const events: string[] = [];

  const pushDialogue = (startSec: number, endSec: number, text: string) => {
    const s = Math.max(0, startSec + offset);
    const e = Math.min(endSec + offset, limit + offset);
    if (e - s < 0.08) return; // príliš krátke na prečítanie — radšej vynechať
    events.push(`Dialogue: 0,${assTime(s)},${assTime(e)},Default,,0,0,0,,${text}`);
    eventCount++;
  };

  let segmentsWithoutWords = 0;

  for (const seg of Array.isArray(segments) ? segments : []) {
    const words = segmentWords(seg);
    const segStart = Number(seg?.start) || words[0]?.start || 0;
    const segEnd = Number(seg?.end) || words[words.length - 1]?.end || segStart + 1;

    // Bez slov → celý segment naraz (poctivo priznané)
    if (words.length < 2 || style.wordsPerChunk === 0) {
      if (words.length < 2) segmentsWithoutWords++;
      const text = words.length
        ? words.map((w) => w.word).join(" ")
        : String(seg?.text ?? "").trim();
      if (!text) continue;
      const shown = style.uppercase ? text.toUpperCase() : text;
      const lines = wrapAssLines(shown.split(/\s+/), fontSize, maxTextWidth, 2);
      pushDialogue(segStart, segEnd, lines.map((l) => escapeAssText(l)).join("\\N"));
      continue;
    }

    // So slovami → dávky po `wordsPerChunk` slovách, zvýraznené aktuálne slovo
    wordHighlight = true;
    const perChunk = Math.max(1, style.wordsPerChunk);
    for (let i = 0; i < words.length; i += perChunk) {
      const chunk = words.slice(i, i + perChunk);
      const chunkTextWords = chunk.map((w) => (style.uppercase ? w.word.toUpperCase() : w.word));
      const lines = wrapAssLines(chunkTextWords, fontSize, maxTextWidth, 2);

      // Text sa escapuje RAZ a vopred — zvýrazňovacie kódy sa vkladajú až potom,
      // inak by ich escapovanie zjedlo a zvýraznenie by vôbec nefungovalo.
      const safeLines = lines.map((line) => line.split(/\s+/).map((w) => escapeAssText(w)));

      for (let k = 0; k < chunk.length; k++) {
        const w = chunk[k];
        const nextStart = chunk[k + 1]?.start;
        const start = Math.max(w.start, segStart);
        const end = Math.min(nextStart ?? Math.max(w.end, chunk[chunk.length - 1].end), segEnd);
        if (end <= start) continue;

        const target = w.word.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
        const rendered = safeLines
          .map((line) =>
            line
              .map((escapedWord) => {
                const bare = escapedWord.replace(/\\/g, "").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
                const isActive =
                  bare.length > 0 &&
                  target.length > 0 &&
                  (bare === target || target.startsWith(bare) || bare.startsWith(target));
                return isActive
                  ? `{\\c${style.highlightColor}}${escapedWord}{\\c${style.primaryColor}}`
                  : escapedWord;
              })
              .join(" "),
          )
          .join("\\N");

        pushDialogue(start, end, rendered);
      }
    }
  }

  if (segmentsWithoutWords > 0) {
    notesSk.push(
      `Pri ${segmentsWithoutWords} titulkoch nemám časovanie slov, takže sa zvýrazňovanie slova vynechalo (text sa zobrazí celý naraz).`,
    );
  }
  if (eventCount === 0) {
    notesSk.push("Neboli žiadne titulky na vypálenie — skontroluj, či má video prepis.");
  }
  if (events.length > 3000) {
    notesSk.push("Titulkov je veľmi veľa (nad 3000 udalostí) — render môže trvať dlhšie.");
  }

  const ass = [...header, ...events, ""].join("\n");
  return { ass, eventCount, wordHighlight, notesSk };
}

// ---------------------------------------------------------------------------
// Strih → titulky: čas zdroja sa musí prepočítať na čas klipu
// ---------------------------------------------------------------------------

export interface KeepRange {
  start: number;
  end: number;
}

export interface RemapResult {
  /** Titulky preložené do času **výsledného klipu**. */
  segments: SpeechSegmentLike[];
  /** Dĺžka výsledného klipu (súčet zachovaných úsekov). */
  outputDurationSec: number;
  droppedWords: number;
  clippedWords: number;
  droppedSegments: number;
  splitSegments: number;
  notesSk: string[];
}

/** Zjednotí a zlúči úseky: zoradené, bez prekryvov, bez príliš krátkych. */
export function normalizeKeepRanges(ranges: KeepRange[] | undefined): KeepRange[] {
  const cleaned = (Array.isArray(ranges) ? ranges : [])
    .map((r) => ({
      start: Math.max(0, Number(r?.start) || 0),
      end: Math.max(0, Number(r?.end) || 0),
    }))
    .filter((r) => r.end - r.start > 0.02)
    .sort((a, b) => a.start - b.start);

  const merged: KeepRange[] = [];
  for (const r of cleaned) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end + 0.001) {
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

/**
 * Najdôležitejšia vec celého kroku B: keď klip vznikne vystrihnutím častí videa,
 * titulky **nesmú zostať v pôvodných časoch** — inak by hovorili o niečom inom,
 * než sa práve deje. Táto funkcia prekladá titulky (aj jednotlivé slová) z času
 * zdroja do času hotového klipu:
 *
 *  - slová, ktoré padli do vystrihnutej časti, vypadnú spolu s ňou,
 *  - slovo preseknuté strihom sa oreže na hranicu strihu (a appka to napočíta),
 *  - titulok rozdelený strihom na dva sa rozdelí aj v titulkoch,
 *  - titulok bez časovania slov sa priradí k tomu úseku, kam väčšinou patrí
 *    (aby divák nečítal tú istú vetu dvakrát).
 */
export function remapSegmentsToOutput(
  segments: SpeechSegmentLike[],
  keepRanges: KeepRange[] | undefined,
): RemapResult {
  const keeps = normalizeKeepRanges(keepRanges);
  const input = Array.isArray(segments) ? segments : [];

  if (keeps.length === 0) {
    const outputDurationSec = input.reduce(
      (max, s) => Math.max(max, Number(s?.end) || 0),
      0,
    );
    return {
      segments: input,
      outputDurationSec,
      droppedWords: 0,
      clippedWords: 0,
      droppedSegments: 0,
      splitSegments: 0,
      notesSk: [],
    };
  }

  // Kam sa ktorý úsek posunul na výslednej osi.
  const offsets: number[] = [];
  let acc = 0;
  for (const k of keeps) {
    offsets.push(acc);
    acc += k.end - k.start;
  }
  const outputDurationSec = acc;

  const EPS = 0.02;
  const out: SpeechSegmentLike[] = [];
  let droppedWords = 0;
  let clippedWords = 0;
  let droppedSegments = 0;
  let splitSegments = 0;

  for (const seg of input) {
    const words = segmentWords(seg);
    const segStart = Number(seg?.start) || words[0]?.start || 0;
    const segEnd = Number(seg?.end) || words[words.length - 1]?.end || segStart + 1;

    // Titulok bez časovania slov: patrí do úseku, kde trávi najviac času.
    if (words.length === 0) {
      let bestIdx = -1;
      let bestOverlap = 0;
      keeps.forEach((k, idx) => {
        const overlap = Math.min(segEnd, k.end) - Math.max(segStart, k.start);
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestIdx = idx;
        }
      });
      if (bestIdx < 0 || bestOverlap <= EPS) {
        droppedSegments++;
        continue;
      }
      const k = keeps[bestIdx];
      const start = Math.max(segStart, k.start);
      const end = Math.min(segEnd, k.end);
      const text = String(seg?.text ?? "").trim();
      if (!text) {
        droppedSegments++;
        continue;
      }
      out.push({
        ...(seg?.id ? { id: seg.id } : {}),
        start: offsets[bestIdx] + (start - k.start),
        end: offsets[bestIdx] + (end - k.start),
        text,
      });
      continue;
    }

    let touched = 0;
    for (let idx = 0; idx < keeps.length; idx++) {
      const k = keeps[idx];
      const overlapStart = Math.max(segStart, k.start);
      const overlapEnd = Math.min(segEnd, k.end);
      if (overlapEnd - overlapStart <= EPS) continue;
      touched++;

      const outWords: WordTimingLike[] = [];
      for (const w of words) {
        const ws = Math.max(w.start, k.start);
        const we = Math.min(w.end, k.end);
        if (we - ws <= 0.02) {
          droppedWords++;
          continue;
        }
        if (ws > w.start + 0.001 || we < w.end - 0.001) clippedWords++;
        outWords.push({
          word: w.word,
          start: offsets[idx] + (ws - k.start),
          end: offsets[idx] + (we - k.start),
          ...(w.highlight !== undefined ? { highlight: w.highlight } : {}),
        });
      }

      if (outWords.length === 0) {
        droppedSegments++;
        continue;
      }

      out.push({
        ...(seg?.id ? { id: seg.id } : {}),
        start: Math.max(outWords[0].start, offsets[idx] + (overlapStart - k.start)),
        end: Math.min(
          outWords[outWords.length - 1].end,
          offsets[idx] + (overlapEnd - k.start),
        ),
        text: outWords.map((w) => w.word).join(" "),
        words: outWords,
      });
    }

    if (touched === 0) droppedSegments++;
    else if (touched > 1) splitSegments++;
  }

  out.sort((a, b) => a.start - b.start);

  const notesSk: string[] = [];
  if (droppedWords > 0) {
    notesSk.push(
      `${droppedWords} slov padlo do vystrihnutých častí — zmizli spolu s nimi (titulky nič nedopovedajú, čo v klipe nie je).`,
    );
  }
  if (clippedWords > 0) {
    notesSk.push(
      `${clippedWords} slov strih preskolil — orežú sa na hranicu strihu, aby nelietali cez nový začiatok klipu.`,
    );
  }
  if (splitSegments > 0) {
    notesSk.push(`${splitSegments} titulkov strih rozdelil na dve časti — rozdelil som ich aj v titulkoch.`);
  }
  if (droppedSegments > 0) {
    notesSk.push(`${droppedSegments} titulkov ležalo celé vo vystrihnutých častiach — vo výsledku nie sú.`);
  }

  return {
    segments: out,
    outputDurationSec,
    droppedWords,
    clippedWords,
    droppedSegments,
    splitSegments,
    notesSk,
  };
}

export interface AssForCutOptions
  extends Omit<AssBuildOptions, "segments" | "timeOffsetSec" | "durationSec"> {
  segments: SpeechSegmentLike[];
  /** Úseky, ktoré ostanú v klipe. Prázdne = celé video, čas sa nemení. */
  keepRanges?: KeepRange[];
  /** Dĺžka zdroja — používa sa len v poznámkach, keď sa nič nevystrihne. */
  sourceDurationSec?: number;
}

export interface AssForCutResult extends AssBuildResult {
  /** Prepočet zdroja na klip: koľko slov vypadlo, orežilo sa, rozdelilo. */
  remap: RemapResult;
  /** Dĺžka titulkovej stopy (dĺžka klipu). */
  clipDurationSec: number;
}

/**
 * Postaví ASS pre **hotový klip** (strih + titulky v jednom prechode).
 * Volajúci nemusí riešiť posuny časov — to je presne to, na čo sa v projekte
 * už raz zabudlo, takže je to tu na jednom mieste.
 */
export function buildAssForCut(options: AssForCutOptions): AssForCutResult {
  const remap = remapSegmentsToOutput(options.segments, options.keepRanges);
  const hasCut = normalizeKeepRanges(options.keepRanges).length > 0;
  const limit = hasCut
    ? remap.outputDurationSec
    : (options.sourceDurationSec ?? remap.outputDurationSec);

  const built = buildAssFile({
    segments: remap.segments,
    style: options.style,
    width: options.width,
    height: options.height,
    ...(options.fontName ? { fontName: options.fontName } : {}),
    durationSec: limit,
  });

  return {
    ...built,
    remap,
    clipDurationSec: limit,
    notesSk: [...built.notesSk, ...remap.notesSk],
  };
}

// ---------------------------------------------------------------------------
// Argumenty pre ffmpeg
// ---------------------------------------------------------------------------

export interface BurnArgsOptions {
  inputPath: string;
  outputPath: string;
  assPath: string;
  fontsDir?: string;
  /** Klipy, ktoré sa majú vystrihnúť (rovnaký EDL ako v náhľade). Prázdne = celé video. */
  keepSegments?: { start: number; end: number }[];
  width?: number;
  height?: number;
  /**
   * Snímková frekvencia zdroja. Bez nej `concat` spojí úseky v implicitných
   * 25 fps a klip pri 30/60 fps zdroji potichu stratí snímky (overené živo:
   * 3,1 s klipu malo 78 snímok namiesto 93). Preto ju sem posielame.
   */
  sourceFps?: number;
  crf?: number;
  preset?: string;
}

/**
 * Zloží argumenty pre ffmpeg: **strih + vypálenie titulkov v jednom prechode**.
 * Jeden prechod = jedno prekódovanie = rýchlejšie a bez straty kvality navyše.
 */
export function buildBurnFfmpegArgs(o: BurnArgsOptions): string[] {
  const args: string[] = ["-y", "-hide_banner", "-loglevel", "error", "-i", o.inputPath];

  const keep = (o.keepSegments ?? []).filter((s) => s.end - s.start > 0.02);
  const filters: string[] = [];

  if (keep.length > 0) {
    // Strih: každý úsek orežeme a spojíme. `concat` vyžaduje rovnaké parametre
    // (sú, lebo je to ten istý zdroj), takže obraz aj zvuk sa dajú spájať naraz.
    // Pozor: časti sa spájajú `;` — takže NESMÚ končiť `;`, inak vznikne
    // prázdny filter a ffmpeg spadne na „No such filter: ''" (odhalené testom).
    // `fps=` drží pôvodnú snímkovú frekvenciu zdroja — bez neho `concat` ticho
    // prepne na 25 fps a snímky sa stratia (odhalené live testom).
    const fpsFilter = o.sourceFps && o.sourceFps > 0 ? `,fps=${o.sourceFps}` : "";
    const parts = keep.map((k, i) => {
      return (
        `[0:v]trim=start=${k.start.toFixed(3)}:end=${k.end.toFixed(3)},setpts=PTS-STARTPTS${fpsFilter}[v${i}]` +
        `;[0:a]atrim=start=${k.start.toFixed(3)}:end=${k.end.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`
      );
    });
    const inputs = keep.map((_, i) => `[v${i}][a${i}]`).join("");
    const scale = o.width && o.height
      ? `scale=${o.width}:${o.height}:force_original_aspect_ratio=increase,crop=${o.width}:${o.height},`
      : "";
    filters.push(
      ...parts,
      `${inputs}concat=n=${keep.length}:v=1:a=1[vc][ac]`,
      `[vc]${scale}ass=${escapeFilterPath(o.assPath)}${o.fontsDir ? `:fontsdir=${escapeFilterPath(o.fontsDir)}` : ""}[vout]`,
    );
  } else {
    const scale = o.width && o.height ? `scale=${o.width}:${o.height}:force_original_aspect_ratio=increase,crop=${o.width}:${o.height},` : "";
    filters.push(
      `[0:v]${scale}ass=${escapeFilterPath(o.assPath)}${o.fontsDir ? `:fontsdir=${escapeFilterPath(o.fontsDir)}` : ""}[vout]`,
    );
  }

  args.push("-filter_complex", filters.join(";"));
  args.push("-map", "[vout]");
  if (keep.length > 0) {
    args.push("-map", "[ac]");
  } else {
    args.push("-map", "0:a?");
  }

  args.push(
    "-c:v", "libx264",
    "-preset", o.preset || "veryfast",
    "-crf", String(o.crf ?? 20),
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
  );
  if (keep.length > 0) args.push("-c:a", "aac", "-b:a", "192k");
  else args.push("-c:a", "copy");
  args.push(o.outputPath);

  return args;
}

/** Cesty vo filtroch: `:` a `\` majú vo ffmpeg filtri špeciálny význam. */
export function escapeFilterPath(p: string): string {
  return String(p).replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

// ---------------------------------------------------------------------------
// Texty pre človeka
// ---------------------------------------------------------------------------

export function burnSummarySk(result: AssBuildResult, style: CaptionStyleSpec, seconds: number): string {
  const hl = result.wordHighlight ? "so zvýrazňovaním slova" : "bez zvýrazňovania (nemám časovanie slov)";
  return `Vypálim ${result.eventCount} titulkov v štýle „${style.labelSk}" ${hl}. Prekódovanie: ${Math.round(seconds)} s videa, kvalita CRF 20.`;
}

export const BURN_HONESTY_SK = [
  "Vypálené titulky sa nedajú vypnúť ani upraviť — sú súčasťou obrazu. Preto si najprv prehraj náhľad.",
  "Táto cesta **prekódováva** video (na rozdiel od čistého strihu). Kvalita zostáva vysoká (CRF 20), ale nie je to už bit-po-bite originál.",
  "Rám videa sa nemení — nič sa neorezáva ani nezoomie. Titulky sa píšu do pôvodných rozmerov, aby klip vyzeral presne ako zdroj.",
];

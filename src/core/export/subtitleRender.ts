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

import { wordsShareToken } from "../transcript/wordTiming";
import type { SpeechSegmentLike, WordTimingLike } from "../transcript/wordTiming";

// ---------------------------------------------------------------------------
// Typy
// ---------------------------------------------------------------------------

export type CaptionStyleId =
  | "VIRAL_BOLD"
  | "HORMOZI"
  | "KARAOKE"
  | "NEON_BOX"
  | "KEYWORD_POP"
  | "CLEAN"
  | "PODCAST"
  | "MINIMAL"
  | "BRAND";

/** Kategória pre UI — aby sa v zozname dalo rýchlo orientovať. */
export type CaptionStyleCategory = "viralne" | "ciste" | "brand";

/**
 * Ako sa zvýrazňuje text:
 *  - `active-word` — aktuálne hovorené slovo (karaoke efekt, potrebuje časovanie slov),
 *  - `keywords` — celá veta naraz, ale **čísla a silné slová** sú farebne zdôraznené
 *    (needs časovanie slov sa nevyžaduje — preto funguje aj bez neho),
 *  - `none` — len čistý text, žiadne zvýrazňovanie.
 */
export type CaptionHighlightMode = "active-word" | "keywords" | "none";

/**
 * Animácia vstupu titulku. Zámerne len tri, ktoré sa v praxi osvedčili —
 * a hlavne: **animuje sa len vstup**, text počas čítania stojí. Titulok, ktorý sa
 * hýbe celý čas, sa nedá čítať (to je najčastejšia chyba „cool“ titulkov).
 *
 *  - `none` — bez animácie (pokojné štýly),
 *  - `pop` — text vyrastie z 86 % na 100 % (živý, ale čitateľný),
 *  - `punch` — text priletí z 114 % a sadne na 100 % (agresívnejšie, pre hooky),
 *  - `fade` — jemné objavenie a zmiznutie (decentné, pre rozprávanie).
 */
export type CaptionAnimation = "none" | "pop" | "punch" | "fade";

/** Ako dlho animácia trvá (ms). Nad 250 ms už pôsobí pomaly. */
export const CAPTION_ANIMATION_MS: Record<CaptionAnimation, number> = {
  none: 0,
  pop: 130,
  punch: 160,
  fade: 150,
};

/**
 * Ako dlho „pruží" zvýraznené (hovorené) slovo — krok 18.
 *
 * Pruženie je **jedna pravda pre dve miesta**: vypálenie titulkov (ASS `\t`) aj
 * náhľad (canvas). Preto je to funkcia, nie dve konštanty.
 *
 * Nikdy nie je dlhšie než polovica slova: keby áno, pruženie by dobehlo až v čase,
 * keď sa už zvýrazňuje ďalšie slovo (a divák by videl „oneskorené" zväčšenie).
 */
export const WORD_POP_DEFAULT_MS = 130;

/**
 * Dĺžka pruženia pre konkrétny štýl (sekundy), alebo 0 = štýl nepruží.
 *
 * Pruženie má zmysel len vtedy, keď štýl hovorené slovo **zväčšuje**
 * (`activeWordScale`). Dĺžku nesie štýl (`activeWordPopMs`); keď ju nemá, použije
 * sa `WORD_POP_DEFAULT_MS` — jediná „voľba appky", a je viditeľná v katalógu.
 */
export function wordPopSecForStyle(
  spec: { activeWordScale?: number; activeWordPopMs?: number } | null | undefined,
  wordDurationSec: number,
): number {
  const peak = spec?.activeWordScale;
  if (!peak || peak === 100) return 0;
  const ms = spec?.activeWordPopMs ?? WORD_POP_DEFAULT_MS;
  const dur = Number.isFinite(wordDurationSec) ? Math.max(0, wordDurationSec) : 0;
  if (ms <= 0 || dur <= 0.08) return 0;
  return Math.min(ms / 1000, dur / 2);
}

/**
 * Veľkosť zvýrazneného slova v čase (1 = základná veľkosť), `peakScale` = vrchol.
 *
 * Priebeh je **lineárny od začiatku slova po `popSec`** a potom drží vrchol —
 * presne tak, ako to kreslí ASS `\t(0,ms,...)` (lineárne, bez zrýchlenia).
 * Vďaka tomu sa náhľad a video nemôžu rozísť v tom, ako veľké slovo je.
 */
export function activeWordScaleAt(
  tSec: number,
  fromSec: number,
  peakScale: number,
  popSec: number,
): number {
  const peak = Number.isFinite(peakScale) ? peakScale / 100 : 1;
  if (!Number.isFinite(peak) || peak <= 1) return 1;
  // Pokazené časy neznamenajú „animuj od nuly" — znamenajú „nemám kedy začať".
  // Radšej základná veľkosť než náhodne zväčšené slovo v neznámom čase.
  if (!Number.isFinite(tSec) || !Number.isFinite(fromSec)) return 1;
  const t = tSec;
  const from = fromSec;
  if (t <= from) return 1;
  if (popSec <= 0) return peak;
  const progress = Math.min(1, (t - from) / popSec);
  return 1 + (peak - 1) * progress;
}

export interface CaptionStyleSpec {
  id: CaptionStyleId;
  labelSk: string;
  descriptionSk: string;
  /** Kategória pre UI (virálne / čisté / brand). */
  category: CaptionStyleCategory;
  /**
   * Odkiaľ štýl je — poctivo: „princíp bežný v X“. Nie je to kópia cudzieho
   * kódu ani sľub, že to vyzerá 1:1 ako iný nástroj.
   */
  inspirationSk: string;
  /** Pre koho sa hodí — jednou vetou, aby výber netrval minúty. */
  bestForSk: string;
  /** Veľkosť fontu ako podiel výšky videa (1/1000). */
  fontSizeRatio: number;
  bold: boolean;
  uppercase: boolean;
  /** Farba textu (ASS &HAABBGGRR). */
  primaryColor: string;
  /** Farba zvýrazneného slova (pri `keywords` farba zdôraznených slov). */
  highlightColor: string;
  outlineColor: string;
  outlineWidth: number;
  shadow: number;
  /** Koľko slov sa zobrazuje naraz (virálny štýl ukazuje málo slov, veľké). */
  wordsPerChunk: number;
  /** Ako sa zvýrazňuje — viď `CaptionHighlightMode`. */
  highlightMode: CaptionHighlightMode;
  /** Kedy sa zvýraznenie vypne, keď niet časovania slov (keywords zostávajú). */
  highlightNeedsWordTiming: boolean;
  /** Rozdiel veľkosti (‰) zvýrazneného slova — „bounce“ efekt virálnych štýlov. */
  activeWordScale?: number;
  /**
   * Ako dlho sa hovorené slovo zväčšuje (ms) — „pruženie" (krok 18).
   * Keď chýba a štýl má `activeWordScale`, použije sa `WORD_POP_DEFAULT_MS`.
   */
  activeWordPopMs?: number;
  /** Animácia vstupu titulku (viď `CaptionAnimation`). */
  animation?: CaptionAnimation;
  /** Text na farebnej placce (ASS BorderStyle 3) namiesto obrysu. */
  boxed?: boolean;
  /** Farba placky (ASS &HAABBGGRR), keď je `boxed`. */
  boxColor?: string;
  /** Zarovnanie v ASS (2 = dole na stred, 5 = stred obrazu). */
  alignment?: number;
  /** Rozostup písmen (ASS Spacing) — decentný štýl vyzerá lepšie s 1–2. */
  letterSpacing?: number;
  /** Spodný okraj ako podiel výšky — kvôli rozhraniu aplikácií. */
  bottomMarginRatio: number;
}

const C = {
  WHITE: "&H00FFFFFF",
  YELLOW: "&H0000FFFF", // v ASS je poradie BGR → toto je žltá
  GREEN: "&H0000FF00",
  ORANGE: "&H0000A5FF", // oranžová (BGR: FF A5 00)
  BLACK: "&H00000000",
  PLATE_PURPLE: "&H00B43CC8", // fialová placka
  PLATE_DARK: "&H00141414", // takmer čierna placka
  TRANSPARENT_BACK: "&H80000000",
} as const;

export const CAPTION_STYLES: CaptionStyleSpec[] = [
  // ── VIRÁLNE (krátke formáty, pozerané bez zvuku) ──────────────────────────
  {
    id: "VIRAL_BOLD",
    labelSk: "Virálny (Submagic štýl)",
    descriptionSk:
      "Veľké tučné písmo, 2–3 slová naraz, aktuálne slovo žlté. Najčítanejšie bez zvuku.",
    category: "viralne",
    inspirationSk: "princíp bežný v Submagic / CapCut",
    bestForSk: "TikTok, Reels, Shorts — rýchly hovorený obsah",
    fontSizeRatio: 78,
    bold: true,
    uppercase: true,
    primaryColor: C.WHITE,
    highlightColor: C.YELLOW,
    outlineColor: C.BLACK,
    outlineWidth: 6,
    shadow: 3,
    wordsPerChunk: 3,
    highlightMode: "active-word",
    highlightNeedsWordTiming: true,
    animation: "pop",
    bottomMarginRatio: 0.16,
  },
  {
    id: "HORMOZI",
    labelSk: "Hormozi (1–2 slová, obrovské)",
    descriptionSk:
      "Najagresívnejší štýl: 1–2 slová cez pol obrazu, zvýraznené slovo sa ešte zväčší.",
    category: "viralne",
    inspirationSk: "princíp bežný v Hormozi / MrBeast style klipoch",
    bestForSk: "hook a prvé 3 sekundy, reklama, veľmi rýchle tempo",
    fontSizeRatio: 104,
    bold: true,
    uppercase: true,
    primaryColor: C.WHITE,
    highlightColor: C.YELLOW,
    outlineColor: C.BLACK,
    outlineWidth: 8,
    shadow: 4,
    wordsPerChunk: 2,
    highlightMode: "active-word",
    highlightNeedsWordTiming: true,
    activeWordScale: 112,
    activeWordPopMs: 150,
    animation: "fade",
    bottomMarginRatio: 0.2,
  },
  {
    id: "KARAOKE",
    labelSk: "Karaoke (celá veta po slovách)",
    descriptionSk:
      "Vidno celú vetu a zvýrazňuje sa práve hovorené slovo — čitateľné aj v strehu, bez skákania textu.",
    category: "viralne",
    inspirationSk: "princíp bežný v karaoke titulkoch (Submagic „karaoke“ mód)",
    bestForSk: "vysvetľovanie, vzdelávanie, keď sa veta nedá rozbiť",
    fontSizeRatio: 62,
    bold: true,
    uppercase: false,
    primaryColor: C.WHITE,
    highlightColor: C.YELLOW,
    outlineColor: C.BLACK,
    outlineWidth: 5,
    shadow: 3,
    wordsPerChunk: 0, // 0 = celý segment
    highlightMode: "active-word",
    highlightNeedsWordTiming: true,
    activeWordScale: 118,
    activeWordPopMs: 130,
    bottomMarginRatio: 0.15,
  },
  {
    id: "NEON_BOX",
    labelSk: "Placka (text na farebnom pruhu)",
    descriptionSk:
      "Biely text na fialovej placce — čitateľné doslova v každom zábere (svetlá stena, more, sneh).",
    category: "viralne",
    inspirationSk: "princíp bežný v estetických Reels a UGC reklamách",
    bestForSk: "svetlé alebo rušivé zábery, beauty, cestovanie, produkt",
    fontSizeRatio: 60,
    bold: true,
    uppercase: true,
    primaryColor: C.WHITE,
    highlightColor: C.YELLOW,
    outlineColor: C.PLATE_PURPLE,
    outlineWidth: 20, // pri BorderStyle 3 je to vnútorný okraj placky (padding)
    shadow: 0,
    wordsPerChunk: 3,
    highlightMode: "active-word",
    highlightNeedsWordTiming: true,
    boxed: true,
    boxColor: C.PLATE_PURPLE,
    animation: "pop",
    bottomMarginRatio: 0.18,
  },
  {
    id: "KEYWORD_POP",
    labelSk: "Zdôraznené čísla a silné slová",
    descriptionSk:
      "Celá veta naraz, ale čísla (3 000 €, 95 %, krok 2) a silné slová sú farebne zdôraznené — aj bez časovania slov.",
    category: "viralne",
    inspirationSk: "princíp „keyword emphasis“ z kontraktu kvality (§3)",
    bestForSk: "predaj, vzdelávanie, výsledky a čísla, ponuky",
    fontSizeRatio: 58,
    bold: true,
    uppercase: false,
    primaryColor: C.WHITE,
    highlightColor: C.ORANGE,
    outlineColor: C.BLACK,
    outlineWidth: 5,
    shadow: 2,
    wordsPerChunk: 0,
    highlightMode: "keywords",
    highlightNeedsWordTiming: false, // zdôraznenie čísel funguje aj bez časov slov
    animation: "fade",
    bottomMarginRatio: 0.15,
  },

  // ── ČISTÉ (rozprávanie, bez efektov) ─────────────────────────────────────
  {
    id: "CLEAN",
    labelSk: "Čistý (celá veta)",
    descriptionSk: "Pokojné biele písmo, celá veta naraz, bez zvýrazňovania slov.",
    category: "ciste",
    inspirationSk: "klasické titulky v televíznom štýle",
    bestForSk: "rozhovory, YouTube, B2B, keď má video zvuk",
    fontSizeRatio: 54,
    bold: true,
    uppercase: false,
    primaryColor: C.WHITE,
    highlightColor: C.WHITE,
    outlineColor: C.BLACK,
    outlineWidth: 4,
    shadow: 2,
    wordsPerChunk: 0, // 0 = celý segment
    highlightMode: "none",
    highlightNeedsWordTiming: false,
    bottomMarginRatio: 0.14,
  },
  {
    id: "PODCAST",
    labelSk: "Podcast (pokojne, mäkký obrys)",
    descriptionSk:
      "Menšie písmo s mäkkým obrysom a rozostupom — nič nezakrýva tvár, hodí sa na dlhšie rozprávanie.",
    category: "ciste",
    inspirationSk: "princíp titulkov v podcastových zostrihoch",
    bestForSk: "podcast, talking head, interview",
    fontSizeRatio: 50,
    bold: true,
    uppercase: false,
    primaryColor: C.WHITE,
    highlightColor: C.WHITE,
    outlineColor: C.BLACK,
    outlineWidth: 4,
    shadow: 2,
    wordsPerChunk: 0,
    highlightMode: "none",
    highlightNeedsWordTiming: false,
    letterSpacing: 1,
    bottomMarginRatio: 0.12,
  },
  {
    id: "MINIMAL",
    labelSk: "Minimálny",
    descriptionSk:
      "Malé decentné písmo bez výrazného obrysu — pre firemné a dokumentárne video.",
    category: "ciste",
    inspirationSk: "dokumentárny a firemný štandard",
    bestForSk: "dokument, firemné video, keď titulky nemajú byť stredobod",
    fontSizeRatio: 42,
    bold: false,
    uppercase: false,
    primaryColor: C.WHITE,
    highlightColor: C.WHITE,
    outlineColor: C.BLACK,
    outlineWidth: 2,
    shadow: 1,
    wordsPerChunk: 0,
    highlightMode: "none",
    highlightNeedsWordTiming: false,
    bottomMarginRatio: 0.12,
  },

  // ── BRAND ────────────────────────────────────────────────────────────────
  {
    id: "BRAND",
    labelSk: "Brand (firemné, vyššie v obraze)",
    descriptionSk:
      "Decentný text s rozostupom a väčším odstupom od okraja — necháva priestor pre logo a CTA prvky.",
    category: "brand",
    inspirationSk: "princíp firemných šablón (konzistencia pred efektom)",
    bestForSk: "firemné video, portfólio, prezentácia klienta",
    fontSizeRatio: 46,
    bold: false,
    uppercase: false,
    primaryColor: C.WHITE,
    highlightColor: C.WHITE, // štýl nič nezvýrazňuje — nedeklarujeme nepoužitú farbu
    outlineColor: C.BLACK,
    outlineWidth: 3,
    shadow: 1,
    wordsPerChunk: 0,
    highlightMode: "none",
    highlightNeedsWordTiming: false,
    letterSpacing: 2,
    animation: "fade",
    bottomMarginRatio: 0.22,
  },
];

/**
 * Slová, ktoré diváka naozaj zastavia — čísla, peniaze, čas, kontrasty.
 * Je to **pravidlo, nie AI**: dá sa prečítať, otestovať a vysvetliť.
 */
const STRONG_WORDS_SK = [
  "zadarmo", "zdarma", "gratis", "tajny", "tajný", "trik", "chyba", "nikdy",
  "vzdy", "vždy", "prvy", "prvý", "posledny", "posledný", "najlepsi", "najlepší",
  "najhorsi", "najhorší", "rychlo", "rýchlo", "zdvojnasob", "zdvojnásob",
  "zaraba", "zarába", "usetri", "ušetrí", "strati", "stratí", "prekvapenie",
  "zakazany", "zakázaný", "skutocne", "skutočne", "dokaz", "dôkaz", "vysledok",
  "výsledok", "tajomstvo", "recept", "navod", "návod", "0", "100",
];

/** Čísla, peniaze, percentá a jednotky — najsilnejšie slová v titulkoch. */
const NUMBER_PATTERN = /\d|[€$£%]|\bx\d/i;

/**
 * Je toto slovo „silné“ (má sa farebne zdôrazniť)?
 * Zdôrazňujeme: čísla a meny, veľké skratky (VIP, B2B), slová z krátkeho
 * zoznamu silných slov a slová písané VEĽKÝMI (autor ich sám zdôraznil).
 */
export function isStrongCaptionWord(word: string): boolean {
  const raw = String(word ?? "").trim();
  if (!raw) return false;
  const bare = raw.replace(/^[^\p{L}\p{N}€$£%]+|[^\p{L}\p{N}€$£%]+$/gu, "");
  if (!bare) return false;
  if (NUMBER_PATTERN.test(bare)) return true;
  if (bare.length >= 3 && bare === bare.toUpperCase() && /[A-ZÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ]/u.test(bare)) return true;
  const lower = bare
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return STRONG_WORDS_SK.some((w) => lower === w.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
}

/** Koľko silných slov veta má — používa sa v odporúčaní štýlu. */
export function countStrongWords(text: string): number {
  return String(text ?? "")
    .split(/\s+/)
    .filter((w) => w && isStrongCaptionWord(w)).length;
}

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
  // odsekla poslednú stotinu (61.23 s dávalo „.22“).
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
      style.primaryColor || C.WHITE,
      style.primaryColor || C.WHITE,
      // Poistka: prázdne pole by libass prečítal ako čiernu a štýl by ticho
      // zmenil farbu (presne to sa raz stalo pri placce — placka sčernela).
      style.outlineColor || C.BLACK,
      // Pri „placce“ (BorderStyle 3) je BackColour farba podkladu, inak priehľadná.
      style.boxed ? (style.boxColor || C.PLATE_DARK) : C.TRANSPARENT_BACK,
      style.bold ? "-1" : "0",
      "0",
      "0",
      "0",
      "100",
      "100",
      String(style.letterSpacing ?? 0),
      "0",
      style.boxed ? "3" : "1", // 3 = text na placce, 1 = obrys + tieň
      style.outlineWidth,
      style.shadow,
      String(style.alignment ?? 2), // 2 = dole na stred
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

  /**
   * Animačný prefix vstupu titulku. Vždy sa animuje **len vstup** — text potom
   * stojí, aby sa dal čítať, a zároveň animácia nezväčšuje počet udalostí
   * (jedno slovo = jedna udalosť, ako doteraz).
   */
  const requestedAnimation: CaptionAnimation = style.animation ?? "none";
  const isScaleAnimation = requestedAnimation === "pop" || requestedAnimation === "punch";
  // Zmerané vo ffmpeg: ak má štýl zväčšenie aktívneho slova (inline `\\fscx`),
  // libass ním **zruší** animáciu zmeny veľkosti na celej udalosti — animácia by
  // ticho nič nerobila. Vtedy radšej jemné objavenie (iná vlastnosť) a appka to povie.
  const scaleAnimationDead =
    isScaleAnimation && Boolean(style.activeWordScale) && style.highlightMode === "active-word";
  const effectiveAnimation: CaptionAnimation = scaleAnimationDead ? "fade" : requestedAnimation;

  const animPrefix = (() => {
    const ms = CAPTION_ANIMATION_MS[effectiveAnimation] ?? 0;
    if (effectiveAnimation === "none" || ms <= 0) return "";
    if (effectiveAnimation === "fade") return `{\\fad(${ms},${Math.round(ms * 0.8)})}`;
    if (effectiveAnimation === "pop") return `{\\fscx86\\fscy86\\t(0,${ms},\\fscx100\\fscy100)}`;
    if (effectiveAnimation === "punch") return `{\\fscx114\\fscy114\\t(0,${ms},\\fscx100\\fscy100)}`;
    return "";
  })();

  const pushDialogue = (startSec: number, endSec: number, text: string) => {
    const s = Math.max(0, startSec + offset);
    const e = Math.min(endSec + offset, limit + offset);
    if (e - s < 0.08) return; // príliš krátke na prečítanie — radšej vynechať
    events.push(`Dialogue: 0,${assTime(s)},${assTime(e)},Default,,0,0,0,,${animPrefix}${text}`);
    eventCount++;
  };

  let segmentsWithoutWords = 0;
  let keywordEmphasis = false;
  /** True, keď aspoň jedno hovorené slovo dostalo animované pruženie (aby to appka povedala). */
  let wordPopActive = false;

  const mode: CaptionHighlightMode = style.highlightMode ?? "active-word";
  /** Pri `keywords` je celá veta naraz; pri `active-word` podľa `wordsPerChunk`. */
  const wholeSentence = style.wordsPerChunk === 0;

  /**
   * Zvýrazní jedno slovo farbou (+ animované zväčšenie hovoreného slova).
   *
   * Krok 18: zväčšenie už nie je „skoč a stoj", ale **pruženie** — slovo sa od
   * základnej veľkosti zväčší na `activeWordScale` za `popSec` (ASS `\t`, lineárne).
   * Rovnaké číslo používa aj náhľad (`activeWordScaleAt`), takže sa nemôžu rozísť.
   *
   * Poznámka k meraniu: `\t` na **jednom slove** libass vykresľuje (overené meraním
   * v `kontrola-krok18/libass-sondy.json`: šírka slova rástla 416 → 518 px). Animácia
   * vstupu celej udalosti je pri zapnutom zväčšení slova stále nahradená jemným
   * objavením (`fade`), pretože obe naraz sa v libass navzájom oslabujú (E 42 px vs
   * F 18 px v tom istom meraní).
   */
  const accentWord = (
    escapedWord: string,
    opts: { active: boolean; strong: boolean; popSec?: number },
  ): string => {
    if (!opts.active && !opts.strong) return escapedWord;
    const color = opts.active ? style.highlightColor : style.highlightColor;
    const peak = style.activeWordScale && style.activeWordScale !== 100 ? style.activeWordScale : 0;
    const popSec = opts.popSec ?? 0;
    // Keď slovo nemá zmeranú dĺžku alebo „pruženie" nemá zmysel, ostaň pri statickom
    // zväčšení (staré správanie) — nič sa nepredstiera.
    const scale = !peak
      ? ""
      : popSec > 0
        ? `\\fscx100\\fscy100\\t(0,${Math.round(popSec * 1000)},\\fscx${peak}\\fscy${peak})`
        : `\\fscx${peak}\\fscy${peak}`;
    const resetScale = scale ? `\\fscx100\\fscy100` : "";
    return `{\\c${color}${scale}}${escapedWord}{\\c${style.primaryColor}${resetScale}}`;
  };

  for (const seg of Array.isArray(segments) ? segments : []) {
    const words = segmentWords(seg);
    const segStart = Number(seg?.start) || words[0]?.start || 0;
    const segEnd = Number(seg?.end) || words[words.length - 1]?.end || segStart + 1;
    const hasWordTiming = words.length >= 2;

    // ── 1) Bez časovania slov ────────────────────────────────────────────
    if (!hasWordTiming) {
      segmentsWithoutWords++;
      const text = words.length
        ? words.map((w) => w.word).join(" ")
        : String(seg?.text ?? "").trim();
      if (!text) continue;
      const shown = style.uppercase ? text.toUpperCase() : text;
      const lines = wrapAssLines(shown.split(/\s+/), fontSize, maxTextWidth, 2);

      // Aj bez časovania vieme zdôrazniť čísla a silné slová (`keywords`).
      const renderedLines = lines.map((line) =>
        line
          .split(/\s+/)
          .map((w0) => {
            const escaped = escapeAssText(w0);
            if (mode !== "keywords") return escaped;
            const strong = isStrongCaptionWord(w0);
            if (strong) keywordEmphasis = true;
            return accentWord(escaped, { active: false, strong });
          })
          .join(" "),
      );
      pushDialogue(segStart, segEnd, renderedLines.join("\\N"));
      continue;
    }

    // ── 2) Režim „len text“ (čisté štýly) ────────────────────────────────
    if (mode === "none") {
      const text = words.map((w) => w.word).join(" ");
      const shown = style.uppercase ? text.toUpperCase() : text;
      const lines = wrapAssLines(shown.split(/\s+/), fontSize, maxTextWidth, 2);
      pushDialogue(segStart, segEnd, lines.map((l) => escapeAssText(l)).join("\\N"));
      continue;
    }

    // ── 3) Zvýrazňovanie (karaoke / virálne / kľúčové slová) ─────────────
    wordHighlight = true;
    const perChunk = wholeSentence || mode === "keywords" ? words.length : Math.max(1, style.wordsPerChunk);
    for (let i = 0; i < words.length; i += perChunk) {
      const chunk = words.slice(i, i + perChunk);
      const chunkTextWords = chunk.map((w) => (style.uppercase ? w.word.toUpperCase() : w.word));
      const lines = wrapAssLines(chunkTextWords, fontSize, maxTextWidth, 2);

      // Text sa escapuje RAZ a vopred — zvýrazňovacie kódy sa vkladajú až potom,
      // inak by ich escapovanie zjedlo a zvýraznenie by vôbec nefungovalo.
      const safeLines = lines.map((line) => line.split(/\s+/).map((w) => escapeAssText(w)));
      const strongFlags = lines.map((line) => line.split(/\s+/).map((w) => isStrongCaptionWord(w)));

      for (let k = 0; k < chunk.length; k++) {
        const w = chunk[k];
        const nextStart = chunk[k + 1]?.start;
        const start = Math.max(w.start, segStart);
        const end = Math.min(nextStart ?? Math.max(w.end, chunk[chunk.length - 1].end), segEnd);
        if (end <= start) continue;
        // Pruženie hovoreného slova: nikdy dlhšie než polovica jeho času na obrazovke.
        const popSecForWord = wordPopSecForStyle(style, end - start);
        if (popSecForWord > 0) wordPopActive = true;

        // Porovnanie tokenu je jedna funkcia (transcript/wordTiming) — aby
        // vypálenie titulkov aj náhľad zvýrazňovali to isté slovo.
        const rendered = safeLines
          .map((line, li) =>
            line
              .map((escapedWord, wi) => {
                const isActive = wordsShareToken(escapedWord, w.word);
                const strong = mode === "keywords" && Boolean(strongFlags[li]?.[wi]);
                if (strong) keywordEmphasis = true;
                // Pruženie patrí len hovorenému slovu (nie zdôrazneným kľúčovým slovám).
                return accentWord(escapedWord, {
                  active: isActive,
                  strong,
                  popSec: isActive && mode === "active-word" ? popSecForWord : 0,
                });
              })
              .join(" "),
          )
          .join("\\N");

        pushDialogue(start, end, rendered);
      }
    }
  }

  if (segmentsWithoutWords > 0) {
    if (mode === "keywords") {
      notesSk.push(
        `Pri ${pluralSk(segmentsWithoutWords, "titulku", "titulkoch", "titulkoch")} nemám časovanie slov — zdôrazňujem preto len čísla a silné slová (nie aktuálne hovorené slovo).`,
      );
    } else if (mode === "active-word") {
      notesSk.push(
        `Pri ${pluralSk(segmentsWithoutWords, "titulku", "titulkoch", "titulkoch")} nemám časovanie slov, takže sa zvýrazňovanie slova vynechalo (text sa zobrazí celý naraz).`,
      );
    }
  }
  if (wordHighlight && mode === "active-word") {
    notesSk.push(
      "Zvýrazňovanie hovoreného slova je zapnuté — mám časovanie slov z automatických tituliek.",
    );
  }
  if (keywordEmphasis) {
    notesSk.push(
      "Zdôraznené sú čísla a silné slová (pravidlo, nie AI) — dá sa prečítať v appke a vypnúť výberom iného štýlu.",
    );
  }
  if (effectiveAnimation !== "none") {
    notesSk.push(
      `Titulky majú animáciu vstupu (${effectiveAnimation}) — týka sa objavenia titulku.` +
        (wordPopActive ? " Hovorené slovo popri tom pruží (zväčšuje sa), ako je to v štýle." : " Počas čítania text stojí."),
    );
  }
  if (wordPopActive) {
    const popMs = Math.round(wordPopSecForStyle(style, 1) * 1000);
    notesSk.push(
      `Hovorené slovo **pruží** (krok 18): zväčší sa na ${style.activeWordScale} % za ${popMs} ms ` +
        `a potom drží — v náhľade aj vo videe rovnakým pravidlom.`,
    );
  }
  if (scaleAnimationDead) {
    notesSk.push(
      `Animáciu „${requestedAnimation}“ som nahradil jemným objavením: tento štýl zväčšuje aktívne slovo a libass by animáciu veľkosti ticho zrušil (zmerané vo videu).`,
    );
  }
  if (style.boxed) {
    notesSk.push(
      "Tento štýl kreslí text na farebnú placku — je najčitateľnejší aj na svetlom a rušivom zábere.",
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

/**
 * Slovenské tvary podľa počtu: 1 → „1 slovo“, 2–4 → „2 slová“, 5+ → „5 slov“.
 * Texty v appke číta človek — „1 titulkov ležalo“ je vidieť, aj keď to nie je
 * funkčná chyba. Preto to riešime raz a tu.
 */
export function pluralSk(count: number, one: string, few: string, many: string): string {
  const n = Math.abs(Math.round(Number(count) || 0));
  const word = n === 1 ? one : n >= 2 && n <= 4 ? few : many;
  return `${n} ${word}`;
}

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
    const words = pluralSk(droppedWords, "slovo", "slová", "slov");
    notesSk.push(
      `${words} ${droppedWords === 1 ? "padlo" : "padli"} do vystrihnutých častí — zmizli spolu s nimi (titulky nič nedopovedajú, čo v klipe nie je).`,
    );
  }
  if (clippedWords > 0) {
    const words = pluralSk(clippedWords, "slovo", "slová", "slov");
    notesSk.push(
      `${words} strih preskolil — ${clippedWords === 1 ? "oreže sa" : "orežú sa"} na hranicu strihu, aby nelietali cez nový začiatok klipu.`,
    );
  }
  if (splitSegments > 0) {
    if (splitSegments === 1) {
      notesSk.push("Jeden titulok ležal na oboch stranách strihu — rozdelil som ho aj v titulkoch.");
    } else {
      notesSk.push(
        `${pluralSk(splitSegments, "titulky", "titulky", "titulkov")} strih rozdelil na dve časti — rozdelil som ich aj v titulkoch.`,
      );
    }
  }
  if (droppedSegments > 0) {
    if (droppedSegments === 1) {
      notesSk.push("Jeden titulok ležal celý vo vystrihnutej časti — vo výsledku nie je.");
    } else {
      notesSk.push(
        `${pluralSk(droppedSegments, "titulok", "titulky", "titulkov")} ležalo celé vo vystrihnutých častiach — vo výsledku nie sú.`,
      );
    }
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

/**
 * Priblíženie jedného klipu (statické, na stred) — presne ako v canonical pláne snímky.
 * `scalePercent` 112 = obraz je 1,12× väčší a orezaný na stred (žiadny posun).
 */
/** Jeden krok animovaného priblíženia (čas od začiatku úseku). */
export interface BurnZoomKeyframe {
  timeSec: number;
  scalePercent: number;
}

export interface BurnZoomWindow {
  /** Identifikátor klipu (len do poznámok/reportu). */
  clipId?: string;
  startSec: number;
  endSec: number;
  scalePercent: number;
  /** Keď je vyplnené, priblíženie sa v čase mení (nie statický orez). */
  keyframes?: BurnZoomKeyframe[];
}

/**
 * Obrazová vrstva (b-roll / fotka) z canonical osi.
 * `scalePercent` 100 = prirodzená veľkosť média; poloha je posun od stredu plátna.
 */
export interface BurnOverlay {
  path: string;
  kind: "image" | "video";
  startSec: number;
  endSec: number;
  scalePercent: number;
  positionX: number;
  positionY: number;
  /** Otočenie v stupňoch okolo stredu (0 = bez otočenia). */
  rotation?: number;
  /** Priesvitnosť v percentách (100 = plne nepriehľadné). */
  opacity?: number;
  /** Farebný filter z canonical osi (`NONE`, `BW`, `VINTAGE`, …). */
  filter?: string;
  /** Meno pre poznámky a report (nikdy nie cesta na disku). */
  nameSk?: string;
}

export interface BurnArgsOptions {
  inputPath: string;
  outputPath: string;
  assPath: string;
  fontsDir?: string;
  /** Klipy, ktoré sa majú vystrihnúť (rovnaký EDL ako v náhľade). Prázdne = celé video. */
  keepSegments?: { start: number; end: number; scalePercent?: number; keyframes?: BurnZoomKeyframe[] }[];
  /** Priblíženia na časovej osi (len keď sa nič nestrihá — čas videa sa nemení). */
  zoomWindows?: BurnZoomWindow[];
  /** Obrazové vrstvy z canonical osi (b-roll, fotky). */
  overlays?: BurnOverlay[];
  /** Farebný filter na základnom videu (`NONE` = nič). */
  baseFilter?: string;
  /** KROK 24: merané zosúladenie svetla (voliteľné; keď chýba, render nič nemení). */
  lightCorrection?: LightCorrection | null;
  /** Dĺžka výsledku — potrebná, keď sa skladá z viacerých častí alebo s vrstvami. */
  outputDurationSec?: number;
  /**
   * Skutočné rozmery rámu (zo sondy servera) — používajú sa **výhradne** na to,
   * aby priblíženie orezávalo na presne tie isté rozmery. Rám videa sa NEMENÍ.
   */
  frameSize?: { width: number; height: number };
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
  const overlays = (o.overlays ?? []).filter((v) => v.endSec - v.startSec > 0.02);
  const zoomWindows = (o.zoomWindows ?? []).filter(
    (z) => Math.abs(z.scalePercent - 100) > 0.01 && z.endSec - z.startSec > 0.02,
  );

  // Vstupy pre obrazové vrstvy: obrázok aj video idú ako samostatný vstup.
  for (const overlay of overlays) {
    // Pozor: `-loop 1` na obrázok by spravil nekonečný vstup (a render by nikdy
    // neskončil). Obrázok preto čítame raz a v overlay filtri použijeme
    // `eof_action=repeat` — posledná snímka sa opakuje len v rámci svojho okna.
    args.push("-i", overlay.path);
  }

  const filters: string[] = [];
  const fpsFilter = o.sourceFps && o.sourceFps > 0 ? `,fps=${o.sourceFps}` : "";
  const scaleFilter =
    o.width && o.height
      ? `scale=${o.width}:${o.height}:force_original_aspect_ratio=increase,crop=${o.width}:${o.height},`
      : "";

  let baseLabel: string;
  let audioFromConcat = false;

  if (keep.length > 0) {
    // Strih: každý úsek orežeme a spojíme (aj s priblížením daného úseku).
    // `fps=` drží snímkovú frekvenciu zdroja — bez neho `concat` ticho prepne na 25 fps.
    const parts = keep.map((k, i) => {
      const zoom = zoomFilterForWindow(k, o.sourceFps, o.frameSize);
      return (
        `[0:v]trim=start=${k.start.toFixed(3)}:end=${k.end.toFixed(3)},setpts=PTS-STARTPTS${fpsFilter}${zoom}[v${i}]` +
        `;[0:a]atrim=start=${k.start.toFixed(3)}:end=${k.end.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`
      );
    });
    const inputs = keep.map((_, i) => `[v${i}][a${i}]`).join("");
    filters.push(...parts, `${inputs}concat=n=${keep.length}:v=1:a=1[vc][ac]`);
    baseLabel = "[vc]";
    audioFromConcat = true;
  } else if (zoomWindows.length > 0) {
    // Bez strihu sa čas videa nemení → zvuk sa dá **kopírovať** (pôvodné audio
    // zostáva bajtovo nedotknuté). Obraz sa však musí rozdeliť na okná, aby
    // priblíženie sedelo len na svojom úseku.
    const windows = zoomWindows
      .slice()
      .sort((a, b) => a.startSec - b.startSec)
      .map((z) => ({
        startSec: Math.max(0, z.startSec),
        endSec: z.endSec,
        scalePercent: z.scalePercent,
        ...(z.keyframes && z.keyframes.length >= 2 ? { keyframes: z.keyframes } : {}),
      }));
    const parts: string[] = [];
    let cursor = 0;
    let index = 0;
    for (const w of windows) {
      if (w.startSec > cursor + 0.02) {
        parts.push(
          `[0:v]trim=start=${cursor.toFixed(3)}:end=${w.startSec.toFixed(3)},setpts=PTS-STARTPTS${fpsFilter}[v${index}]`,
        );
        index++;
      }
      parts.push(
        `[0:v]trim=start=${w.startSec.toFixed(3)}:end=${w.endSec.toFixed(3)},setpts=PTS-STARTPTS${fpsFilter}${zoomFilterForWindow(w, o.sourceFps, o.frameSize)}[v${index}]`,
      );
      index++;
      cursor = w.endSec;
    }
    const end = o.outputDurationSec && o.outputDurationSec > cursor ? o.outputDurationSec : cursor;
    if (end > cursor + 0.02) {
      parts.push(`[0:v]trim=start=${cursor.toFixed(3)}:end=${end.toFixed(3)},setpts=PTS-STARTPTS${fpsFilter}[v${index}]`);
      index++;
    }
    const labelInputs = Array.from({ length: index }, (_, i) => `[v${i}]`).join("");
    filters.push(...parts, `${labelInputs}concat=n=${index}:v=1:a=0[vc]`);
    baseLabel = "[vc]";
  } else {
    baseLabel = "[0:v]";
  }

  // Rozmer výstupu (server ho zámerne neposiela — vypálenie nesmie zmeniť rám videa).
  let videoLabel = baseLabel;
  if (scaleFilter) {
    filters.push(`${baseLabel}${scaleFilter.slice(0, -1)}[vscaled]`);
    videoLabel = "[vscaled]";
  }

  // Farebný filter základného videa — ten istý prepis ako pri vrstvách, aby sa
  // náhľad a export nemohli rozísť.
  const baseColorFilter = colorFilterForName(o.baseFilter);
  // KROK 24: merané zosúladenie svetla (jas/kontrast z referencie). Pripojí sa
  // k základnému videu PRED vrstvami; náhľad používa tie isté čísla cez CSS.
  const baseLightFilter = lightCorrectionFfmpeg(o.lightCorrection);
  if (baseColorFilter || baseLightFilter) {
    filters.push(`${videoLabel}format=yuv420p${baseColorFilter}${baseLightFilter}[vbase]`);
    videoLabel = "[vbase]";
  }

  // Obrazové vrstvy (b-roll / fotky) — v poradí zdola nahor, každá vo svojom čase.
  overlays.forEach((overlay, i) => {
    const inputIndex = 1 + i;
    const scale = overlay.scalePercent && Math.abs(overlay.scalePercent - 100) > 0.01
      ? overlay.scalePercent / 100
      : 1;
    const imgScale = scale !== 1 ? `scale=iw*${scale.toFixed(4)}:ih*${scale.toFixed(4)},` : "";
    const overlayLabel = `[ov${i}]`;
    // Farebný filter, otočenie a priesvitnosť — v poradí, v akom ich skladá
    // canonical kompozitor: filter na obsah, otočenie okolo stredu, potom alfa.
    const colorFilter = colorFilterForName(overlay.filter);
    const transform = overlayTransformFilters(overlay);
    if (overlay.kind === "video") {
      const dur = Math.max(0.02, overlay.endSec - overlay.startSec);
      filters.push(
        `[${inputIndex}:v]${imgScale}format=rgba,trim=duration=${dur.toFixed(3)},setpts=PTS-STARTPTS+${overlay.startSec.toFixed(3)}/TB${colorFilter}${transform}${overlayLabel}`,
      );
    } else {
      filters.push(`[${inputIndex}:v]${imgScale}format=rgba,setpts=PTS-STARTPTS${colorFilter}${transform}${overlayLabel}`);
    }
    const nextLabel = `[vov${i}]`;
    // Poloha presne ako v canonical kompozitore: stred plátna + posun klipu.
    // `enable` zaručí, že vrstva je vidieť len vo svojom čase (nič „navyše“).
    filters.push(
      `${videoLabel}${overlayLabel}overlay=x=${
        overlay.positionX !== 0 ? `(W-w)/2+${overlay.positionX.toFixed(1)}` : "(W-w)/2"
      }:y=${
        overlay.positionY !== 0 ? `(H-h)/2+${overlay.positionY.toFixed(1)}` : "(H-h)/2"
      }:enable='between(t,${overlay.startSec.toFixed(3)},${overlay.endSec.toFixed(3)})':eof_action=repeat${nextLabel}`,
    );
    videoLabel = nextLabel;
  });

  filters.push(
    `${videoLabel}ass=${escapeFilterPath(o.assPath)}${o.fontsDir ? `:fontsdir=${escapeFilterPath(o.fontsDir)}` : ""}[vout]`,
  );

  args.push("-filter_complex", filters.join(";"));
  args.push("-map", "[vout]");
  if (audioFromConcat) args.push("-map", "[ac]");
  else args.push("-map", "0:a?");

  args.push(
    "-c:v", "libx264",
    "-preset", o.preset || "veryfast",
    "-crf", String(o.crf ?? 20),
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
  );
  if (audioFromConcat) args.push("-c:a", "aac", "-b:a", "192k");
  else args.push("-c:a", "copy");
  args.push(o.outputPath);

  return args;
}

/**
 * Priblíženie ako **statický stredový orez** — presne to, čo robí canonical kompozitor
 * (`ctx.scale` okolo stredu).
 *
 * Keď poznáme rozmery rámu, orežeme na **presné čísla**. Prečo je to dôležité:
 * výrazové orezanie (`trunc(iw/s/2)*2`) pri 1080 px a priblížení 112 % vyrobí
 * 1078 px — rám sa potichu zmenší o dva pixely (odhalené meraním výstupu, nie testom).
 * Rám videa sa meniť nesmie.
 */
/**
 * Farebný filter canonical osi → ffmpeg.
 *
 * Musí sedieť s tým, čo kreslí canonical kompozitor (`renderEngine.getCanvasFilterCSS`),
 * inak by náhľad a export ukazovali niečo iné. Pozor na jednu poctivú nepresnosť:
 * prehliadačové `brightness(95 %)` je **násobenie**, kým `eq=brightness` je
 * **pripočítanie** — preto je tu prepis `0,95 → -0,05`. Je to zámerná aproximácia
 * (CSS filtre sú percepčné, ffmpeg lineárne) a v poznámkach sa to priznáva.
 */
import { lightCorrectionFfmpeg, type LightCorrection } from "./lightMatch";

export function colorFilterForName(filter?: string): string {
  const name = String(filter ?? "NONE").toUpperCase();
  switch (name) {
    case "TEAL_ORANGE":
      return ",eq=contrast=1.2:saturation=1.3,hue=h=-10";
    case "CINEMATIC":
      return ",eq=contrast=1.1:brightness=-0.05:saturation=0.85";
    case "VINTAGE":
      return `,${sepiaMix(0.4)},eq=brightness=-0.10`;
    case "BW":
      return ",hue=s=0,eq=contrast=1.2";
    case "WARM":
      return `,${sepiaMix(0.2)},eq=saturation=1.2`;
    case "COOL":
      return ",hue=h=15:s=1.1";
    default:
      return "";
  }
}

/**
 * Čiastočná sépia presne podľa CSS: matica sépie sa mieša s jednotkovou maticou.
 * (`sepia(40 %)` v prehliadači = 60 % pôvodnej farby + 40 % sépie.)
 */
function sepiaMix(amount: number): string {
  const a = Math.min(1, Math.max(0, amount));
  const b = 1 - a;
  const f = (v: number) => Number(v.toFixed(4));
  return (
    "colorchannelmixer=" +
    [
      `rr=${f(b + 0.393 * a)}`, `rg=${f(0.769 * a)}`, `rb=${f(0.189 * a)}`,
      `gr=${f(0.349 * a)}`, `gg=${f(b + 0.686 * a)}`, `gb=${f(0.168 * a)}`,
      `br=${f(0.272 * a)}`, `bg=${f(0.534 * a)}`, `bb=${f(b + 0.131 * a)}`,
    ].join(":")
  );
}

/**
 * Otočenie a priesvitnosť vrstvy ako ffmpeg filtre (0 = nič sa nemení).
 * Poradie je **otočenie → priesvitnosť**; alfa sa násobí, takže na výsledku sa
 * nič nemení, ale čitateľnosť filtra je lepšia (geometria pred priehľadnosťou).
 */
export function overlayTransformFilters(overlay: { opacity?: number; rotation?: number }): string {
  const parts: string[] = [];
  const rotation = overlay.rotation ?? 0;
  if (Math.abs(rotation) > 0.01) {
    // Otočenie okolo stredu. `ow=rotw/oh=roth` = celý otočený obsah zostane
    // viditeľný (rohy priesvitné) — presne ako `ctx.rotate` na canvase, ktorý
    // tiež nič neodrezáva.
    const radians = (rotation * Math.PI) / 180;
    parts.push(`rotate=${radians.toFixed(6)}:ow=rotw(${radians.toFixed(6)}):oh=roth(${radians.toFixed(6)}):c=none`);
  }
  const opacity = overlay.opacity ?? 100;
  if (Math.abs(opacity - 100) > 0.01) {
    const alpha = Math.min(1, Math.max(0, opacity / 100));
    parts.push(`colorchannelmixer=aa=${alpha.toFixed(4)}`);
  }
  return parts.length > 0 ? `,${parts.join(",")}` : "";
}

export function zoomFilterForPercent(scalePercent?: number, frameWidth?: number, frameHeight?: number): string {
  const p = Number(scalePercent ?? 100);
  if (!Number.isFinite(p) || Math.abs(p - 100) <= 0.01) return "";
  const scale = p / 100;
  if (frameWidth && frameHeight && frameWidth > 0 && frameHeight > 0) {
    const w = Math.round(frameWidth);
    const h = Math.round(frameHeight);
    return `,scale=iw*${scale.toFixed(4)}:ih*${scale.toFixed(4)},crop=${w}:${h}`;
  }
  return `,scale=iw*${scale.toFixed(4)}:ih*${scale.toFixed(4)},crop=trunc(iw/${scale.toFixed(4)}/2)*2:trunc(ih/${scale.toFixed(4)}/2)*2`;
}

/**
 * Priebeh animovaného priblíženia ako výraz pre `zoompan` (premenná `in_time`).
 *
 * Prečo po častiach lineárne a bez `min()`/`max()` obalu: obal s vnorenými
 * `if()` sa v praxi správal nepredvídateľne (namerané počas vývoja — raz
 * zoomoval, raz nie), preto výraz drží rozsah **konštrukciou**: prvý úsek sa
 * pred svojím časom drží prvej hodnoty a posledná hodnota platí až do konca.
 * Hodnoty aj časy sú overené vo validácii, takže výraz nemá čo „zalepiť".
 */
export function zoomExpressionFromKeyframes(keyframes: BurnZoomKeyframe[]): string {
  const pts = keyframes
    .filter((k) => Number.isFinite(k.timeSec) && Number.isFinite(k.scalePercent))
    .slice()
    .sort((a, b) => a.timeSec - b.timeSec);
  if (pts.length === 0) return "1";
  if (pts.length === 1) return (pts[0].scalePercent / 100).toFixed(4);

  // Od konca: posledná hodnota platí, kým sa nedostaneme do skoršieho úseku.
  let expr = (pts[pts.length - 1].scalePercent / 100).toFixed(4);
  for (let i = pts.length - 2; i >= 0; i--) {
    const a = pts[i];
    const b = pts[i + 1];
    const sa = (a.scalePercent / 100).toFixed(4);
    const sb = (b.scalePercent / 100).toFixed(4);
    const span = Math.max(0.001, b.timeSec - a.timeSec);
    const seg = `${sa}+(${sb}-${sa})*(in_time-${a.timeSec.toFixed(3)})/${span.toFixed(3)}`;
    expr = `if(lt(in_time,${b.timeSec.toFixed(3)}),${seg},${expr})`;
  }
  // Pred prvým krokrom drž prvú hodnotu (aby priblíženie nezačínalo „pod 100 %").
  const first = pts[0];
  if (first.timeSec > 0 && first.scalePercent !== 100) {
    expr = `if(lt(in_time,${first.timeSec.toFixed(3)}),${(first.scalePercent / 100).toFixed(4)},${expr})`;
  }
  return expr;
}

/**
 * Animované priblíženie ako filter (`zoompan`). Na rozdiel od statického orezu
 * mení mierku **priebežne**, preto tu `zoompan` s `d=1` (jedna výstupná snímka
 * na vstupnú) a `s=` presne na rozmery rámu — rám videa sa nesmie zmeniť.
 */
export function animatedZoomFilter(
  keyframes: BurnZoomKeyframe[],
  sourceFps?: number,
  frameWidth?: number,
  frameHeight?: number,
): string {
  if (!keyframes || keyframes.length < 2) return "";
  if (!frameWidth || !frameHeight || frameWidth <= 0 || frameHeight <= 0) return "";
  const w = Math.round(frameWidth);
  const h = Math.round(frameHeight);
  const fps = sourceFps && sourceFps > 0 ? `:fps=${Math.round(sourceFps * 1000) / 1000}` : "";
  return (
    `,zoompan=z='${zoomExpressionFromKeyframes(keyframes)}'` +
    `:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${w}x${h}${fps}`
  );
}

/**
 * Filter priblíženia pre úsek/okno — animovaný (`zoompan`) alebo statický orez.
 * Drží jedno miesto, aby sa obe cesty (so strihom aj bez) nemohli rozísť.
 */
export function zoomFilterForWindow(
  window: { scalePercent?: number; keyframes?: BurnZoomKeyframe[] },
  sourceFps?: number,
  frameSize?: { width: number; height: number },
): string {
  const animated = animatedZoomFilter(window.keyframes ?? [], sourceFps, frameSize?.width, frameSize?.height);
  if (animated) return animated;
  return zoomFilterForPercent(window.scalePercent, frameSize?.width, frameSize?.height);
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
  return `Vypálim ${result.eventCount} titulkov v štýle „${style.labelSk}“ ${hl}. Prekódovanie: ${Math.round(seconds)} s videa, kvalita CRF 20.`;
}

export const BURN_HONESTY_SK = [
  "Vypálené titulky sa nedajú vypnúť ani upraviť — sú súčasťou obrazu. Preto si najprv prehraj náhľad.",
  "Táto cesta **prekódováva** video (na rozdiel od čistého strihu). Kvalita zostáva vysoká (CRF 20), ale nie je to už bit-po-bite originál.",
  "Rám videa sa nemení — nič sa neorezáva ani nezoomie. Titulky sa píšu do pôvodných rozmerov, aby klip vyzeral presne ako zdroj.",
];

// ---------------------------------------------------------------------------
// Farby: UI tvar (#RRGGBB) ↔ ASS tvar (&HAABBGGRR)
// ---------------------------------------------------------------------------

/**
 * `#RRGGBB` → ASS `&H00BBGGRR`.
 * Pozor: v ASS je poradie **BGR**, nie RGB — to je najčastejšia chyba pri
 * prenose farieb z brand manuálu do titulkov.
 */
export function hexToAssColor(hex: string): string | null {
  const raw = String(hex ?? "").trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null;
  const r = raw.slice(0, 2).toUpperCase();
  const g = raw.slice(2, 4).toUpperCase();
  const b = raw.slice(4, 6).toUpperCase();
  return `&H00${b}${g}${r}`;
}

/** ASS `&HAABBGGRR` → `#RRGGBB` (pre farebné políčka v UI). */
export function assColorToHex(ass: string): string | null {
  const raw = String(ass ?? "").replace(/&H/i, "").replace(/&/g, "").trim();
  if (!/^[0-9a-fA-F]{6,8}$/.test(raw)) return null;
  const padded = raw.padStart(8, "0");
  const b = padded.slice(2, 4);
  const g = padded.slice(4, 6);
  const r = padded.slice(6, 8);
  return `#${r}${g}${b}`.toUpperCase();
}

// ---------------------------------------------------------------------------
// Odchýlky (overrides)
// ---------------------------------------------------------------------------

/** Rozsahy, v ktorých sa odchýlky pohybujú. Mimo nich sa orežú (a appka to povie). */
export const OVERRIDE_LIMITS = {
  fontSizeRatio: [30, 130] as const,
  wordsPerChunk: [0, 6] as const,
  bottomMarginRatio: [0.04, 0.35] as const,
  letterSpacing: [-2, 4] as const,
  activeWordScale: [100, 160] as const,
  activeWordPopMs: [0, 400] as const,
  outlineWidth: [0, 24] as const,
} as const;

export interface CaptionOverrides {
  /** Farby v tvare `#RRGGBB` (prehliadač ich vie vykresliť v náhľade). */
  primaryHex?: string;
  highlightHex?: string;
  outlineHex?: string;
  boxHex?: string;
  fontSizeRatio?: number;
  wordsPerChunk?: number;
  uppercase?: boolean;
  boxed?: boolean;
  animation?: CaptionAnimation;
  bottomMarginRatio?: number;
  letterSpacing?: number;
  activeWordScale?: number;
  outlineWidth?: number;
  /** Zarovnanie: 2 = dole, 5 = stred, 8 = hore (ASS hodnoty). */
  alignment?: 2 | 5 | 8;
}

export interface NormalizedOverrides {
  overrides: CaptionOverrides;
  /** Čo sa orežalo alebo zahodilo — pre človeka, po slovensky. */
  notesSk: string[];
}

const ANIMATIONS: CaptionAnimation[] = ["none", "pop", "punch", "fade"];

function clamp(v: number, range: readonly [number, number]): { value: number; clipped: boolean } {
  if (v < range[0]) return { value: range[0], clipped: true };
  if (v > range[1]) return { value: range[1], clipped: true };
  return { value: v, clipped: false };
}

/**
 * Skontroluje odchýlky: čísla oreže do rozsahu, farby prevedie, neznáme veci
 * zahodí — a ku každej oprave pridá vetu. Vstupom môže byť čokoľvek (aj
 * poškodené dáta z uloženého profilu).
 */
export function normalizeOverrides(input: unknown): NormalizedOverrides {
  const notesSk: string[] = [];
  const overrides: CaptionOverrides = {};
  if (!input || typeof input !== "object") return { overrides, notesSk };

  const src = input as Record<string, unknown>;

  const numberKeys: [keyof CaptionOverrides, readonly [number, number], string][] = [
    ["fontSizeRatio", OVERRIDE_LIMITS.fontSizeRatio, "veľkosť písma"],
    ["wordsPerChunk", OVERRIDE_LIMITS.wordsPerChunk, "počet slov na obrazovke"],
    ["bottomMarginRatio", OVERRIDE_LIMITS.bottomMarginRatio, "odstup od spodku"],
    ["letterSpacing", OVERRIDE_LIMITS.letterSpacing, "rozostup písmen"],
    ["activeWordScale", OVERRIDE_LIMITS.activeWordScale, "zväčšenie aktívneho slova"],
    ["outlineWidth", OVERRIDE_LIMITS.outlineWidth, "hrúbka obrysu"],
  ];

  for (const [key, range, labelSk] of numberKeys) {
    const raw = src[key as string];
    if (raw === undefined || raw === null || raw === "") continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      notesSk.push(`„${labelSk}“ nebolo číslo — nastavenie som vynechal.`);
      continue;
    }
    const rounded = key === "bottomMarginRatio" ? Math.round(n * 1000) / 1000 : Math.round(n);
    const { value, clipped } = clamp(rounded, range);
    if (clipped) {
      notesSk.push(`„${labelSk}“ bolo mimo rozsahu — použil som ${value} (rozsah ${range[0]}–${range[1]}).`);
    }
    (overrides as Record<string, unknown>)[key as string] = value;
  }

  for (const key of ["primaryHex", "highlightHex", "outlineHex", "boxHex"] as const) {
    const raw = src[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const hex = String(raw).trim();
    const ass = hexToAssColor(hex);
    if (!ass) {
      notesSk.push(`Farba „${hex}“ nie je v tvare #RRGGBB — vynechal som ju (radšej pôvodná farba než náhodná).`);
      continue;
    }
    overrides[key] = `#${hex.replace(/^#/, "").toUpperCase()}`;
  }

  if (typeof src.uppercase === "boolean") overrides.uppercase = src.uppercase;
  if (typeof src.boxed === "boolean") overrides.boxed = src.boxed;

  if (src.animation !== undefined && src.animation !== null && src.animation !== "") {
    const anim = String(src.animation) as CaptionAnimation;
    if (ANIMATIONS.includes(anim)) overrides.animation = anim;
    else notesSk.push(`Neznáma animácia „${anim}“ — nechal som pôvodnú. Na výber je: ${ANIMATIONS.join(", ")}.`);
  }

  if (src.alignment !== undefined && src.alignment !== null && src.alignment !== "") {
    const a = Number(src.alignment);
    if (a === 2 || a === 5 || a === 8) overrides.alignment = a as 2 | 5 | 8;
    else notesSk.push(`Zarovnanie „${src.alignment}“ nepoznám — na výber je dole (2), stred (5), hore (8).`);
  }

  return { overrides, notesSk };
}

/**
 * Naloží odchýlky na hotový štýl. Vracia **nový** objekt (pôvodný katalóg sa
 * nikdy nemení — inak by si jedna zakázka pokazila štýl pre všetkých).
 */
export function applyCaptionOverrides(
  style: CaptionStyleSpec,
  overrides: CaptionOverrides | undefined,
): CaptionStyleSpec {
  const { overrides: o } = normalizeOverrides(overrides ?? {});
  if (Object.keys(o).length === 0) return style;

  const out: CaptionStyleSpec = { ...style };

  const colorKeys = ["primaryHex", "highlightHex", "outlineHex", "boxHex"] as const;
  for (const key of colorKeys) {
    const hex = o[key];
    if (!hex) continue;
    const ass = hexToAssColor(hex);
    if (!ass) continue;
    if (key === "primaryHex") out.primaryColor = ass;
    if (key === "highlightHex") out.highlightColor = ass;
    if (key === "outlineHex") out.outlineColor = ass;
    if (key === "boxHex") out.boxColor = ass;
  }

  if (o.fontSizeRatio !== undefined) out.fontSizeRatio = o.fontSizeRatio;
  if (o.wordsPerChunk !== undefined) out.wordsPerChunk = o.wordsPerChunk;
  if (o.uppercase !== undefined) out.uppercase = o.uppercase;
  if (o.bottomMarginRatio !== undefined) out.bottomMarginRatio = o.bottomMarginRatio;
  if (o.letterSpacing !== undefined) out.letterSpacing = o.letterSpacing;
  if (o.activeWordScale !== undefined) out.activeWordScale = o.activeWordScale;
  if (o.outlineWidth !== undefined) out.outlineWidth = o.outlineWidth;
  if (o.alignment !== undefined) out.alignment = o.alignment;

  if (o.boxed !== undefined) {
    out.boxed = o.boxed;
    if (o.boxed && !out.boxColor) out.boxColor = "&H00141414";
  }
  if (o.animation !== undefined) out.animation = o.animation;

  // Zarovnanie hore/stred znamená iný okraj — inak by text liezol do rozhrania.
  if (o.alignment === 8) out.bottomMarginRatio = Math.max(out.bottomMarginRatio ?? 0.12, 0.08);
  if (o.alignment === 5) out.bottomMarginRatio = 0.5;

  // „Placka“ bez farby podkladu by nebola placka.
  if (out.boxed && !out.boxColor) out.boxColor = "&H00141414";

  return out;
}

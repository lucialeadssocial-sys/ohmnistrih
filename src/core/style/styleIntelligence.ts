/**
 * STYLE INTELLIGENCE — deterministické rozhodnutia z reálnych dát (krok 1–3).
 *
 * **Žiadny AI provider.** Všetko je čistá funkcia nad tým, čo naozaj máme:
 * slovami a ich časmi (`wordTiming.ts`), vetami a pauzami. Rovnaký vstup = rovnaký
 * plán (testy to overujú). Ak dáta chýbajú, appka **nič nevymyslí** a povie to.
 *
 * **Žiadne „každé 2 sekundy".** Rozhodnutia sa viažu na **vetu / myšlienku / pauzu**,
 * nie na hodiny. Počet zásahov preto prirodzene kolíše podľa toho, ako človek hovorí.
 *
 * **Zvuk sa nechytá.** Tento modul neobsahuje ani jedno rozhodnutie o audiu a
 * plán nesie `audioPolicy: "ORIGINAL_VO_MASTER"`.
 *
 * Návratový objekt je **plán** (podobne ako existujúci `DirectorPlan`), nie nový
 * timeline. Rozhodnutia samotné sú **existujúci `EditDecision`** z projektového modelu.
 */

import {
  buildSentenceTimings,
  buildWordIndex,
  flattenWords,
  longestGaps,
  type SpeechSegmentLike,
  type TimingPrecision,
} from "../transcript/wordTiming";
import { isStrongCaptionWord } from "../export/subtitleRender";
import { getStyleRecipe, type StylePresetId, type StyleRecipe } from "./styleRecipes";
import {
  DEFAULT_STYLE_CONTROLS,
  GENERATED_VISUALS_PROVIDER_AVAILABLE,
  GENERATED_VISUALS_STATUS_SK,
  type CompositionKind,
  type MotionKind,
  type StyleActionPayload,
  type StyleControls,
  type StyleDecisionDetail,
  type StyleDecisionKind,
  type SupportingElementType,
  type TypographyRole,
} from "./styleDecisionTypes";
import type { EditDecision } from "../types/project";

// ---------------------------------------------------------------------------
// Prahy a mantinely (konštanty, aby sa dali čítať a testovať)
// ---------------------------------------------------------------------------

/** Nad touto hustotou reči (slová/s) má zmysel pridať podporný vizuál alebo text. */
export const HIGH_DENSITY_WPS = 3.4;
/** Pod touto hustotou je reč pokojná — netreba na ňu „tlačiť“ vizuál. */
export const LOW_DENSITY_WPS = 2.0;
/** Pauza dlhšia než toto = miesto na vizuálne vydýchnutie (nič sa nepridáva). */
export const BREATHING_PAUSE_SEC = 0.6;
/** Pod touto zhodou slov (Jaccard) považujeme vetu za novú myšlienku. */
export const TOPIC_SHIFT_OVERLAP = 0.15;
/**
 * Najviac po sebe idúcich viet s podporným vizuálom. **Nie je to kadencia** —
 * je to čitateľnosť: divák musí rečníka aj vidieť. Viaže sa na vety, nie na sekundy,
 * takže pri rýchlej reči je zásahov viac a pri pomalej menej.
 */
export const MAX_CONSECUTIVE_COVERED = 3;
/** Confidence nikdy neprekročí 0,92 — appka nikdy netvrdí istotu. */
export const CONFIDENCE_MIN = 0.35;
export const CONFIDENCE_MAX = 0.92;

/** Emocionálne slová (krátky, čitateľný zoznam — **nie** AI sentiment). */
export const EMOTION_MARKERS_SK = [
  "milujem", "nenávidím", "najhorší", "najhoršie", "najlepší", "najlepšie",
  "neuveriteľné", "šokujúce", "hrozný", "hrozné", "úžasné", "strach", "bojím",
  "slzy", "úprimne", "bolestivé", "bolí", "zlyhal", "zlyhala", "katastrofa",
  "naozaj", "vôbec", "nikdy", "vždy", "srdce", "tajný", "tajomstvo",
];
export const EMOTION_MARKERS_EN = [
  "love", "hate", "worst", "best", "incredible", "shocking", "terrifying",
  "amazing", "scared", "honestly", "painful", "failed", "disaster", "never",
  "always", "heart", "secret", "honest",
];

/** Bežné slová, ktoré pri zisťovaní „je to nová myšlienka?“ ignorujeme. */
const STOPWORDS = new Set([
  "a", "aby", "aj", "ak", "ako", "ale", "alebo", "and", "the", "that", "this", "for",
  "je", "jeho", "jej", "ju", "ja", "ty", "on", "ona", "to", "ten", "tá", "to", "sa",
  "si", "sú", "som", "ste", "by", "bol", "bola", "bolo", "boli", "byť", "má", "mám",
  "mať", "mi", "ma", "me", "my", "vy", "oni", "no", "že", "zo", "za", "na", "do",
  "od", "po", "pri", "pre", "so", "vo", "v", "s", "k", "o", "u", "i", "e",
  "is", "are", "was", "were", "be", "you", "your", "we", "they", "it", "of", "in",
  "on", "at", "as", "but", "or", "if", "so", "not",
]);

// ---------------------------------------------------------------------------
// Typy plánu
// ---------------------------------------------------------------------------

export interface StylePlanInput {
  /** Titulky s časovaním (ideálne po slovách) — reálne dáta, nie odhad. */
  segments: SpeechSegmentLike[];
  /** Dĺžka zdroja (informačne; keď nie je, vezme sa koniec poslednej vety). */
  durationSec?: number;
  recipe: StyleRecipe | StylePresetId | string;
  controls?: Partial<StyleControls>;
  /**
   * Koľko podporných médií má používateľ k dispozícii (knižnica / b-roll track).
   * `0` = nemá → appka navrhne len text a pohyb (a povie to).
   */
  availableSupportingVisuals?: number;
  /** Fixný čas pre deterministické testy (inak `Date.now()`). */
  now?: number;
}

/** Jeden zvážený, ale nevybraný nápad — aby bolo vidieť aj to, čo sme NEspravili. */
export interface StyleConsideredItem {
  sentenceIndex: number;
  kind: StyleDecisionKind;
  reasonSk: string;
  score: number;
  /** Kde vo videu táto veta začína (aby sa dalo pozrieť aj na to, čo sme nevybrali). */
  atSec: number;
  /** Koniec vety (pre prípad, že si to chce človek pustiť celé). */
  endSec?: number;
}

export interface StylePlanBasis {
  timingPrecision: TimingPrecision;
  sentenceCount: number;
  wordCount: number;
  speechSeconds: number;
  /** Ktoré signály engine naozaj použil. */
  usedSignalsSk: string[];
  /** Ktoré dáta chýbali (a preto sa podľa nich nerozhodovalo). */
  missingSignalsSk: string[];
}

export interface StylePlan {
  id: string;
  recipeId: StylePresetId;
  recipeName: string;
  /** Slovenský názov receptu (na obrazovke a v texte plánu). */
  recipeLabelSk: string;
  createdAt: number;
  basis: StylePlanBasis;
  controls: StyleControls;
  /** Pomer rečníka, s ktorým sa naozaj počítalo (a prečo). */
  ratio: { target: number; base: number; adjustmentsSk: string[] };
  /** Rozhodnutia — **existujúci `EditDecision`** (nie nový model). */
  decisions: EditDecision[];
  /** Čo engine zvážil a nevybral (transparentnosť, žiadne ticho vynechané nápady). */
  considered: StyleConsideredItem[];
  /** Krátke čísla pre človeka. */
  statsSk: string[];
  /** Poctivé poznámky: čo dáta neumožnili, čo sme nepoužili a prečo. */
  notesSk: string[];
  /** Zvuk sa nikdy nemení. */
  audioPolicy: "ORIGINAL_VO_MASTER";
  /** Žiadny provider nebol použitý (deterministický engine). */
  provider: "NONE";
}

// ---------------------------------------------------------------------------
// Analýza viet (signály)
// ---------------------------------------------------------------------------

export interface StyleSentenceSignal {
  index: number;
  text: string;
  start: number;
  end: number;
  durationSec: number;
  wordCount: number;
  wordsPerSecond: number;
  strongWords: string[];
  numberWords: string[];
  isQuestion: boolean;
  isEmotional: boolean;
  emotionMarkers: string[];
  isHook: boolean;
  isLast: boolean;
  /** Nová myšlienka (nízka slovná zhoda s predchádzajúcou vetou). */
  topicShift: boolean;
  overlapPrev: number;
  pauseBeforeSec: number;
  pauseAfterSec: number;
  /** Podiel opakovaných slov — signál „veta sa len opakuje“. */
  repetitionRatio: number;
}

function contentWords(text: string): string[] {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

function overlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : Math.round((inter / union) * 1000) / 1000;
}

function emotionOf(text: string): string[] {
  const lower = String(text ?? "").toLowerCase();
  const found: string[] = [];
  for (const m of [...EMOTION_MARKERS_SK, ...EMOTION_MARKERS_EN]) {
    if (new RegExp(`(^|[^\\p{L}])${m}([^\\p{L}]|$)`, "u").test(lower)) found.push(m);
  }
  return Array.from(new Set(found));
}

/** Čísla a meny — to, čo si divák musí prečítať (a čo stojí za veľký text). */
function numbersOf(text: string): string[] {
  return String(text ?? "")
    .split(/\s+/)
    .filter((w) => /\d/.test(w) && isStrongCaptionWord(w));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Rozloží prepis na vety a z **reálnych dát** z nich vytiahne signály.
 * Žiadny signál sa nedomýšľa: čo v dátach nie je, to tu nie je.
 */
export function analyzeStyleSentences(segments: SpeechSegmentLike[]): StyleSentenceSignal[] {
  const sentences = buildSentenceTimings(segments, 0.45);
  const words = flattenWords(segments);

  const out: StyleSentenceSignal[] = [];
  for (const s of sentences) {
    const durationSec = Math.max(0.05, s.end - s.start);
    const wordsInSentence = words.filter((w) => w.start >= s.start - 0.001 && w.end <= s.end + 0.001);
    const wordCount = wordsInSentence.length || s.wordCount;
    const wps = wordCount / durationSec;
    const strong = wordsInSentence.map((w) => w.word).filter((w) => isStrongCaptionWord(w));
    const content = contentWords(s.text);
    const prev = out[out.length - 1];
    const prevContent = prev ? contentWords(prev.text) : [];
    const ov = prev ? overlap(content, prevContent) : 1;
    const repeated = content.filter((w, i) => content.indexOf(w) !== i).length;

    out.push({
      index: s.index,
      text: s.text,
      start: round2(s.start),
      end: round2(s.end),
      durationSec: round2(durationSec),
      wordCount,
      wordsPerSecond: round2(wps),
      strongWords: strong,
      numberWords: numbersOf(s.text),
      isQuestion: /\?\s*$/.test(s.text.trim()),
      isEmotional: emotionOf(s.text).length > 0,
      emotionMarkers: emotionOf(s.text),
      isHook: s.index === 0,
      isLast: false,
      topicShift: prev ? ov < TOPIC_SHIFT_OVERLAP && content.length >= 3 && prevContent.length >= 3 : false,
      overlapPrev: ov,
      pauseBeforeSec: 0,
      pauseAfterSec: 0,
      repetitionRatio: content.length ? round2(repeated / content.length) : 0,
    });
  }

  // Pauzy pred/za vetou (z reálnych časov slov).
  for (let i = 0; i < out.length; i++) {
    const cur = out[i];
    if (i > 0) cur.pauseBeforeSec = Math.max(0, round2(cur.start - out[i - 1].end));
    if (i < out.length - 1) cur.pauseAfterSec = Math.max(0, round2(out[i + 1].start - cur.end));
  }
  if (out.length > 0) out[out.length - 1].isLast = true;

  return out;
}

// ---------------------------------------------------------------------------
// Pomer rečníka vs. podporné vizuály (podľa obsahu, NIE napevno)
// ---------------------------------------------------------------------------

export interface RatioDecision {
  target: number;
  base: number;
  adjustmentsSk: string[];
}

/**
 * Upraví podiel rečníka podľa **obsahu** (hustota reči, emócia, tempo) a podľa
 * používateľa. Odporúčanie receptu (napr. 30 % rečník) teda nie je pravidlo.
 */
export function adjustTalkingHeadRatio(
  sentences: StyleSentenceSignal[],
  recipe: StyleRecipe,
  controls: StyleControls,
  availableSupportingVisuals: number | undefined,
): RatioDecision {
  const base = recipe.talkingHeadRatio;
  const adjustmentsSk: string[] = [];

  if (controls.talkingHeadRatio !== null) {
    const t = Math.min(0.95, Math.max(0.05, controls.talkingHeadRatio));
    adjustmentsSk.push(
      `Použil som tvoje nastavenie ${Math.round(t * 100)} % rečníka (recept hovorí ${Math.round(base * 100)} %).`,
    );
    return { target: round2(t), base, adjustmentsSk };
  }

  let target = base;

  const withSpeech = sentences.filter((s) => s.durationSec > 0.2);
  const avgWps = withSpeech.length
    ? withSpeech.reduce((sum, s) => sum + s.wordsPerSecond, 0) / withSpeech.length
    : 0;

  if (avgWps > HIGH_DENSITY_WPS) {
    target -= 0.1;
    adjustmentsSk.push(
      `Reč je hustá (${round2(avgWps)} slova/s) → viac podporných vizuálov, rečníka ${Math.round(target * 100)} %.`,
    );
  } else if (avgWps > 0 && avgWps < LOW_DENSITY_WPS) {
    target += 0.1;
    adjustmentsSk.push(
      `Reč je pokojná (${round2(avgWps)} slova/s) → menej vizuálov, rečníkovi zostáva viac priestoru (${Math.round(target * 100)} %).`,
    );
  }

  const emotionalShare = withSpeech.length
    ? withSpeech.filter((s) => s.isEmotional).length / withSpeech.length
    : 0;
  if (emotionalShare > 0.15) {
    const delta = Math.min(0.15, round2(emotionalShare * 0.25));
    target += delta;
    adjustmentsSk.push(
      `${Math.round(emotionalShare * 100)} % viet nesie emóciu → rečníka nezastieram (${Math.round(target * 100)} %).`,
    );
  }

  if (controls.intensity === "subtle") {
    target += 0.08;
    adjustmentsSk.push("Intenzita „subtle“ → menej zásahov.");
  } else if (controls.intensity === "aggressive") {
    target -= 0.08;
    adjustmentsSk.push("Intenzita „aggressive“ → viac zásahov.");
  }

  if (availableSupportingVisuals === 0) {
    adjustmentsSk.push(
      "Nemáš k dispozícii žiadne podporné médiá → navrhujem len text a pohyb (pomer rečníka je preto 100 %).",
    );
    return { target: 1, base, adjustmentsSk };
  }

  target = Math.min(0.9, Math.max(0.25, target));
  return { target: round2(target), base, adjustmentsSk };
}

// ---------------------------------------------------------------------------
// Rozhodnutia
// ---------------------------------------------------------------------------

/** Skóre priority: podľa čoho sa vyberá, ktoré vety dostanú vizuál. */
export function supportingVisualScore(s: StyleSentenceSignal): number {
  let score = 0;
  if (s.wordsPerSecond >= HIGH_DENSITY_WPS) score += 0.4;
  else if (s.wordsPerSecond >= 2.6) score += 0.2;
  score += Math.min(0.3, s.numberWords.length * 0.15);
  score += Math.min(0.2, s.strongWords.length * 0.08);
  if (s.topicShift) score += 0.15;
  if (s.isHook) score += 0.1;
  return Math.round(score * 1000) / 1000;
}

/** Confidence: čím viac signálov sa zhoduje, tým vyššia — ale nikdy nie istota. */
export function decisionConfidence(kind: StyleDecisionKind, s: StyleSentenceSignal, recipe: StyleRecipe): number {
  let c = 0.45;
  if (kind === "talking_head") c = s.isEmotional ? 0.75 : 0.55;
  if (kind === "supporting_visual") c = 0.5 + Math.min(0.25, supportingVisualScore(s) * 0.5);
  if (kind === "typography") c = 0.55 + Math.min(0.25, s.numberWords.length * 0.1 + s.strongWords.length * 0.05);
  if (kind === "motion") c = 0.5 + (s.topicShift ? 0.15 : 0) + (s.isHook ? 0.1 : 0);
  if (kind === "composition") c = 0.5 + Math.min(0.2, (recipe.composition.layersMax - 1) * 0.06);
  if (s.repetitionRatio > 0.4) c -= 0.1; // veta sa opakuje — menej dôvodov na veľký zásah
  return Math.round(Math.min(CONFIDENCE_MAX, Math.max(CONFIDENCE_MIN, c)) * 1000) / 1000;
}

function typographyRoleFor(s: StyleSentenceSignal, recipe: StyleRecipe, controls: StyleControls): TypographyRole | null {
  const allowed = recipe.typography.roles;
  const wantStat = s.numberWords.length > 0 && allowed.includes("statistic");
  if (wantStat) return "statistic";
  if (s.isHook && allowed.includes("headline") && controls.typography !== "minimal") return "headline";
  if (/[„“"']/.test(s.text) && allowed.includes("quote")) return "quote";
  if (s.strongWords.length > 0 && allowed.includes("keyword")) return "keyword";
  if (controls.typography === "minimal") return null;
  return allowed.includes("label") ? "label" : null;
}

/** Text do obrazu je **vždy doslovne z vety** — nikdy sa negeneruje. */
function typographyTextFor(s: StyleSentenceSignal): string {
  if (s.numberWords.length > 0) {
    const around = s.text.split(/\s+/);
    const idx = around.findIndex((w) => s.numberWords.includes(w));
    const from = Math.max(0, idx - 2);
    return around.slice(from, Math.min(around.length, from + 4)).join(" ");
  }
  if (s.strongWords.length > 0) return s.strongWords.slice(0, 3).join(" ");
  return s.text.split(/\s+/).slice(0, 3).join(" ");
}

function motionFor(s: StyleSentenceSignal, recipe: StyleRecipe, controls: StyleControls): MotionKind | null {
  const pool = recipe.motionPool;
  if (controls.motion === "calm") return pool.includes("subtle_zoom") ? "subtle_zoom" : null;
  if (s.topicShift && pool.includes("whip_transition")) return "whip_transition";
  if (s.isHook && pool.includes("punch")) return "punch";
  if (s.durationSec >= 6 && pool.includes("subtle_zoom")) return "subtle_zoom";
  if (s.wordsPerSecond >= HIGH_DENSITY_WPS && controls.motion === "dynamic" && pool.includes("paper_movement")) {
    return "paper_movement";
  }
  return null;
}

/** Vyberie typ podporného prvku — deterministicky a bez opakovania toho istého. */
function pickElementType(s: StyleSentenceSignal, recipe: StyleRecipe, lastUsed: SupportingElementType | null): SupportingElementType | null {
  const pool = recipe.aesthetic.elementPool.filter((e) => e !== "generated_visual");
  if (pool.length === 0) return null;
  if (s.numberWords.length > 0 && pool.includes("diagram")) return "diagram";
  const start = s.index % pool.length;
  for (let i = 0; i < pool.length; i++) {
    const candidate = pool[(start + i) % pool.length];
    if (candidate !== lastUsed) return candidate;
  }
  return pool[start];
}

const KIND_TO_EDIT_TYPE: Record<StyleDecisionKind, EditDecision["type"]> = {
  talking_head: "talking_head",
  supporting_visual: "b_roll",
  typography: "typography",
  motion: "motion",
  composition: "composition",
};

function shortHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 6);
}

/** Z detailu spraví **existujúci `EditDecision`** (jediný typ rozhodnutia v appke). */
export function styleDecisionToEditDecision(detail: StyleDecisionDetail): EditDecision {
  const edit: EditDecision = {
    id: `style-${detail.recipeId.toLowerCase()}-${detail.whenSk.startSec.toFixed(2)}-${detail.kind}`,
    timestamp: 0, // doplní `buildStylePlan` (deterministický `now`)
    type: KIND_TO_EDIT_TYPE[detail.kind],
    reason: detail.whySk,
    alternatives: [detail.alternativeSk],
    impact: impactFor(detail),
    status: "proposed",
    actionPayload: {
      ...detail.action,
      startSec: detail.whenSk.startSec,
      endSec: detail.whenSk.endSec,
      whenNotSk: detail.whenNotSk,
      confidence: detail.confidence,
      signals: detail.signals,
    },
    style: detail,
  };
  return edit;
}

/** Dopad je **kvalitatívny** — appka nesľubuje percentá retencie (to sa nedá vedieť). */
function impactFor(detail: StyleDecisionDetail): string {
  switch (detail.kind) {
    case "supporting_visual":
      return "V obraze pribudne podporný prvok; reč a zvuk zostávajú presne tak, ako sú.";
    case "typography":
      return "Do obrazu pribudne text prevzatý z vety; rečník zostáva viditeľný.";
    case "motion":
      return "Zmení sa pohyb kamery/vrstiev v tomto úseku; zvuk sa nemení.";
    case "composition":
      return "Zmení sa rozloženie obrazu (vrstvenie/rozdelenie); zvuk sa nemení.";
    case "talking_head":
      return "Rečník zostane bez prekrytia — je to ochranné rozhodnutie, nič sa nezakrýva.";
  }
}

// ---------------------------------------------------------------------------
// Hlavná funkcia
// ---------------------------------------------------------------------------

/**
 * Postaví Style Plan: **deterministicky**, lokálne, bez providera.
 *
 * Poradie práce:
 *  1. overí, aké dáta naozaj máme (a čo chýba),
 *  2. rozloží reč na vety a získa signály,
 *  3. upraví pomer rečníka podľa obsahu,
 *  4. navrhne rozhodnutia (text, vizuál, pohyb, kompozícia, ochrana rečníka),
 *  5. vynechané nápady zapíše do `considered` (nič sa nestratí ticho).
 */
export function buildStylePlan(input: StylePlanInput): StylePlan {
  const recipe = typeof input.recipe === "string" ? getStyleRecipe(input.recipe) : input.recipe;
  const controls: StyleControls = { ...DEFAULT_STYLE_CONTROLS, ...(input.controls ?? {}) };
  // Audio je vždy chránené — aj keby niekto poslal `false`, engine to nedovolí.
  controls.preserveOriginalAudio = true;

  const now = Number.isFinite(input.now) ? Number(input.now) : Date.now();
  const segments = Array.isArray(input.segments) ? input.segments : [];
  const words = flattenWords(segments);
  const notesSk: string[] = [];
  const missingSignalsSk: string[] = [];
  const usedSignalsSk: string[] = [];

  // --- 1. Aké dáta máme -----------------------------------------------------
  const hasWords = words.length > 0;
  const hasSpeech = segments.length > 0;
  const index = hasWords ? buildWordIndex(words) : null;
  const durationSec =
    Number(input.durationSec) > 0
      ? Number(input.durationSec)
      : segments.reduce((max, s) => Math.max(max, Number(s?.end) || 0), 0);

  const speakerLabels = segments.some((s) => typeof (s as { speaker?: string }).speaker === "string");
  if (hasWords) usedSignalsSk.push("časovanie po slovách");
  else if (hasSpeech) usedSignalsSk.push("hranice viet (bez časovania slov)");
  if (!hasWords) missingSignalsSk.push("časovanie po slovách (zvýrazňovanie a presné hranice)");
  if (!speakerLabels) missingSignalsSk.push("zmena rečníka (diarizácia sa nerobí)");
  missingSignalsSk.push("hranice záberov / scén (scene detection neexistuje)");

  const sentences = hasSpeech ? analyzeStyleSentences(segments) : [];

  if (!hasSpeech) {
    notesSk.push(
      "Nemám žiadny prepis (titulky) — nerobím ani jedno rozhodnutie. Radšej nič než vymyslené rozhodnutia.",
    );
    return emptyPlan(recipe, controls, now, { hasWords, hasSpeech, sentences, words, durationSec, usedSignalsSk, missingSignalsSk, notesSk });
  }

  notesSk.push(
    `Rozhodujem z ${sentences.length} viet (${words.length} slov) — všetko z reálnych časov, ktoré máme${hasWords ? "" : " (bez časovania slov, preto bez zvýrazňovania)"}.`,
  );

  // --- 2. Pomer rečníka -----------------------------------------------------
  const ratio = adjustTalkingHeadRatio(sentences, recipe, controls, input.availableSupportingVisuals);
  notesSk.push(...ratio.adjustmentsSk);

  // --- 3. Podporné vizuály: výber viet -------------------------------------
  const decisions: EditDecision[] = [];
  const considered: StyleConsideredItem[] = [];
  const targetCoveredSec = ratio.target < 1 ? (1 - ratio.target) * (durationSec || sentences[sentences.length - 1]?.end || 0) : 0;

  const candidates = sentences
    .map((s) => ({ s, score: supportingVisualScore(s) }))
    .filter((c) => c.score > 0.15 && !c.s.isEmotional && !c.s.isHook)
    .sort((a, b) => b.score - a.score);

  const covered = new Set<number>();
  let coveredSec = 0;
  const orderedIdx = sentences.map((s) => s.index);

  if (input.availableSupportingVisuals === 0) {
    notesSk.push("Podporné médiá nemáš → vizuálne zásahy vynechávam a navrhujem len text a pohyb.");
  } else {
    for (const cand of candidates) {
      if (coveredSec >= targetCoveredSec) {
        considered.push({
          sentenceIndex: cand.s.index,
          kind: "supporting_visual",
          reasonSk: `Vyšiel by z pomeru rečníka (${Math.round(ratio.target * 100)} %) — radšej menej vizuálov, keď sú veta a rečník dôležitejšie.`,
          score: cand.score,
          atSec: cand.s.start,
          endSec: cand.s.end,
        });
        continue;
      }
      // Čitateľnosť: nezakryť rečníka príliš dlho v kuse (viazané na vety, nie na sekundy).
      const pos = orderedIdx.indexOf(cand.s.index);
      let consecutive = 1;
      for (let i = pos - 1; i >= 0 && covered.has(orderedIdx[i]); i--) consecutive++;
      for (let i = pos + 1; i < orderedIdx.length && covered.has(orderedIdx[i]); i++) consecutive++;
      if (consecutive > MAX_CONSECUTIVE_COVERED) {
        considered.push({
          sentenceIndex: cand.s.index,
          kind: "supporting_visual",
          reasonSk: `Už ${MAX_CONSECUTIVE_COVERED} vety po sebe má vizuál — divák musí rečníka aj vidieť, preto tu nie.`,
          score: cand.score,
          atSec: cand.s.start,
          endSec: cand.s.end,
        });
        continue;
      }
      covered.add(cand.s.index);
      coveredSec += cand.s.durationSec;
    }
  }

  // --- 4. Rozhodnutia po vetách (v časovom poradí) --------------------------
  let lastElement: SupportingElementType | null = null;

  for (const s of sentences) {
    // 4a) Ochranné rozhodnutie: rečník zostáva viditeľný (emócia / hook).
    //     Emócia je **tvrdý** guard (žiadne ďalšie zásahy), hook je mäkký —
    //     rečníka nezakrývam, ale text a pohyb (punch) recept pripúšťa.
    const guardAgainstCovering = s.isEmotional || s.isHook;
    if (s.isEmotional || s.isHook) {
      const why = s.isEmotional
        ? `Veta nesie emóciu (${s.emotionMarkers.slice(0, 3).join(", ")}) — v takej chvíli divák sleduje tvár, nie grafiku.`
        : "Prvá veta rozhoduje, či divák zostane — rečníka nezakrývam.";
      decisions.push(
        makeDecision(now, {
          kind: "talking_head",
          recipeId: recipe.id,
          whatSk: s.isHook
            ? "Nechaj rečníka v plnom obraze a pridaj len krátky titulok (bez podporného vizuálu)."
            : "Nechaj rečníka bez prekrytia — žiadny podporný vizuál, žiadny text cez tvár.",
          whenSk: { startSec: s.start, endSec: s.end },
          whySk: why,
          whenNotSk:
            "Nepoužiť, ak je rečník mimo záberu alebo ak ide o čisto textovú pasáž bez tváre v obraze.",
          alternativeSk:
            recipe.movement.paperCutout
              ? "Pridaj len papierový rám alebo okraj mimo tváre (rečník zostane viditeľný)."
              : "Pridaj len malý text v spodnej tretine.",
          confidence: decisionConfidence("talking_head", s, recipe),
          evidenceSk: [
            `veta ${s.index + 1}: ${Math.round(s.durationSec * 10) / 10} s`,
            `hustota ${s.wordsPerSecond} slova/s`,
            ...(s.emotionMarkers.length ? [`emocionálne slová: ${s.emotionMarkers.slice(0, 3).join(", ")}`] : []),
          ],
          signals: s.isEmotional ? ["emotion_marker", "sentence_boundary"] : ["position", "sentence_boundary"],
          action: {
            targetTrackType: "video",
            // hook sám hovorí „pridaj len krátky titulok“ → text je povolený; emócia nie.
            allowTypography: !s.isEmotional,
            noteSk: "rečník zostáva v plnom obraze",
          },
        }),
      );
      if (guardAgainstCovering) {
        considered.push({
          sentenceIndex: s.index,
          kind: "supporting_visual",
          reasonSk: s.isEmotional
            ? "Emocionálna veta — vizuál by odvádzal pozornosť od tváre."
            : "Prvá veta — rečníka nezakrývam, aby divák hneď videl, kto hovorí.",
          score: supportingVisualScore(s),
          atSec: s.start,
          endSec: s.end,
        });
      }
      // Emócia ukončí zásahy (tvrdý guard); hook pokračuje textom a pohybom.
      if (s.isEmotional) continue;
    }

    // 4b) Podporný vizuál
    if (covered.has(s.index)) {
      const element = pickElementType(s, recipe, lastElement);
      if (element) {
        lastElement = element;
        decisions.push(
          makeDecision(now, {
            kind: "supporting_visual",
            recipeId: recipe.id,
            whatSk: `${elementLabelSk(element)} na ${recipe.composition.primary === "layered_collage" ? "vrchnú vrstvu koláže" : "vedľajšiu vrstvu"} (mimo tváre rečníka).`,
            whenSk: { startSec: s.start, endSec: s.end },
            whySk: `Veta má vysokú informačnú hustotu (${s.wordsPerSecond} slova/s${s.numberWords.length ? `, čísla: ${s.numberWords.join(", ")}` : ""}) — obraz má čo ukázať.`,
            whenNotSk:
              "Nepoužiť, ak v tejto vete rečník dokončuje pointu alebo ak by prvok prekryl tvár (kontrola pri Apply).",
            alternativeSk: "Nechaj rečníka a pridaj len typografiu (text bez vizuálu).",
            confidence: decisionConfidence("supporting_visual", s, recipe),
            evidenceSk: [
              `hustota ${s.wordsPerSecond} slova/s`,
              ...(s.numberWords.length ? [`čísla: ${s.numberWords.join(", ")}`] : []),
              ...(s.topicShift ? ["nová myšlienka (zhoda s predchádzajúcou vetou " + Math.round(s.overlapPrev * 100) + " %)"] : []),
            ],
            signals: ["speech_density", "sentence_boundary", ...(s.numberWords.length ? ["number"] : []), ...(s.topicShift ? ["topic_shift"] : [])],
            action: {
              targetTrackType: "b-roll",
              elementType: element,
              composition: recipe.composition.primary,
              noteSk: "prvok sa objaví ako jeden z vrstiev, nie ako celý panel",
            },
          }),
        );
      }
    } else if (supportingVisualScore(s) > 0.15) {
      considered.push({
        sentenceIndex: s.index,
        kind: "supporting_visual",
        reasonSk: s.isHook
          ? "Prvá veta — rečníka nezakrývam (hook musí byť vidieť)."
          : s.isLast
            ? "Záverečná veta — vizuál by odviedol pozornosť z pointy."
            : "Podľa priority a pomeru rečníka si táto veta vizuál nevyžiadala.",
        score: supportingVisualScore(s),
        atSec: s.start,
        endSec: s.end,
      });
    }

    // 4c) Text (typografia) — neprekrýva rečníka, preto ju hodnotím samostatne
    const role = typographyRoleFor(s, recipe, controls);
    if (role) {
      const text = typographyTextFor(s);
      decisions.push(
        makeDecision(now, {
          kind: "typography",
          recipeId: recipe.id,
          whatSk: `Text „${text}“ ako ${typographyRoleLabelSk(role)} (${recipe.typography.kinetic ? "objaví sa postupne" : "bez animácie"}).`,
          whenSk: { startSec: s.start, endSec: s.end },
          whySk:
            role === "statistic"
              ? `Vo vete je číslo (${s.numberWords.join(", ")}) — čísla si divák musí prečítať, nie dopočítať.`
              : `Veta obsahuje slová, ktoré nesú význam (${s.strongWords.slice(0, 3).join(", ")}) — text ich podčiarkne.`,
          whenNotSk:
            recipe.captionStyle.styleId === "KEYWORD_POP"
              ? "Nepoužiť, ak sú titulky už zapnuté v rovnakom štýle — text by sa duplikoval (appka to kontroluje pri Apply)."
              : "Nepoužiť, ak je text už v titulkoch na tom istom mieste alebo ak by prekryl tvár.",
          alternativeSk: "Nechaj text len v titulkoch (bez samostatného grafického textu).",
          confidence: decisionConfidence("typography", s, recipe),
          evidenceSk: [
            ...(s.numberWords.length ? [`čísla: ${s.numberWords.join(", ")}`] : []),
            ...(s.strongWords.length ? [`silné slová: ${s.strongWords.slice(0, 3).join(", ")}`] : []),
            `text je doslovne z vety (nič sa negeneruje)`,
          ],
          signals: ["strong_words", "sentence_boundary", ...(s.numberWords.length ? ["number"] : [])],
          action: { typographyRole: role, typographyText: text, noteSk: "text prevzatý z vety, nie vygenerovaný" },
        }),
      );
    }

    // 4d) Pohyb
    const motion = motionFor(s, recipe, controls);
    if (motion) {
      decisions.push(
        makeDecision(now, {
          kind: "motion",
          recipeId: recipe.id,
          whatSk: motionLabelSk(motion, recipe),
          whenSk: { startSec: s.start, endSec: s.end },
          whySk:
            motion === "whip_transition"
              ? `Začína sa nová myšlienka (zhoda slov s predchádzajúcou vetou len ${Math.round(s.overlapPrev * 100)} %) — švih oddelí celky.`
              : motion === "punch"
                ? "Prvá veta (hook) — krátke priblíženie pridá dôraz."
                : `Veta je dlhá (${Math.round(s.durationSec)} s) — jemné priblíženie ju udrží živú.`,
          whenNotSk:
            motion === "whip_transition"
              ? "Nepoužiť, ak je veta emocionálna alebo ak je to posledná veta klipu — rozbilo by to pointu."
              : "Nepoužiť, ak je v zábere statický text alebo rozhranie, ktoré musí zostať čitateľné.",
          alternativeSk:
            recipe.motionPool.includes("pop")
              ? "Použi len pop-in prvku bez pohybu kamery."
              : "Nechaj obraz bez pohybu.",
          confidence: decisionConfidence("motion", s, recipe),
          evidenceSk: [
            ...(s.topicShift ? [`zhoda s predchádzajúcou vetou ${Math.round(s.overlapPrev * 100)} % (nová myšlienka)`] : []),
            `dĺžka vety ${Math.round(s.durationSec * 10) / 10} s`,
          ],
          signals: ["sentence_boundary", ...(s.topicShift ? ["topic_shift"] : []), ...(s.isHook ? ["position"] : [])],
          action: {
            motion,
            punchInScale: motion === "punch" || motion === "whip_transition" ? recipe.camera.punchInScale : undefined,
            transitionHint: motion === "whip_transition" ? "whip_pan" : motion === "punch" ? "punch" : "none",
          },
        }),
      );
    }

    // 4e) Pauzy — vizuálne „vydýchanie“ (zámerne NIČ nepridávam, a preto to nie je rozhodnutie)
    if (s.pauseAfterSec >= BREATHING_PAUSE_SEC) {
      considered.push({
        sentenceIndex: s.index,
        kind: "composition",
        reasonSk: `Pauza ${s.pauseAfterSec} s — obraz má ostať prázdny, žiadne nové prvky (vizuálne vydýchanie).`,
        score: s.pauseAfterSec,
        atSec: s.end,
        endSec: s.end + s.pauseAfterSec,
      });
    }
  }

  // 4f) Kompozícia: zhrnutie, keď má veta viac vrstiev (vizuál + text)
  for (const s of sentences) {
    const forSentence = decisions.filter((d) => d.style?.whenSk.startSec === s.start && d.style.kind !== "composition");
    const layers = forSentence.filter((d) => d.style?.kind === "supporting_visual" || d.style?.kind === "typography").length;
    if (layers < 2) continue;
    decisions.push(
      makeDecision(now, {
        kind: "composition",
        recipeId: recipe.id,
        whatSk: `Poskladaj vrstvy tak, aby rečník zostal viditeľný (${compositionLabelSk(recipe.composition.primary)}).`,
        whenSk: { startSec: s.start, endSec: s.end },
        whySk: `V tejto vete sa stretávajú ${layers} prvky (vizuál + text) — bez pravidla vrstvenia by mohli prekryť tvár.`,
        whenNotSk: "Nepoužiť, ak má veta menej než dva prvky alebo ak nie je v zábere tvár.",
        alternativeSk: "Daj text do spodnej tretiny a vizuál mimo tváre (najjednoduchšie riešenie).",
        confidence: decisionConfidence("composition", s, recipe),
        evidenceSk: [`prvky vo vete: ${layers}`, `recept: ${recipe.name}`],
        signals: ["layering", "sentence_boundary"],
        action: { composition: recipe.composition.primary, noteSk: "vrstvy mimo tváre, asymetria podľa receptu" },
      }),
    );
  }

  // --- 5. Poznámky o poctivosti -------------------------------------------
  if (!GENERATED_VISUALS_PROVIDER_AVAILABLE) {
    notesSk.push(GENERATED_VISUALS_STATUS_SK);
    if (controls.generatedVisuals !== "off") {
      notesSk.push("Generované vizuály preto nepoužívam — navrhujem len to, čo vieš mať z existujúcich médií.");
    }
  }
  if (missingSignalsSk.length) {
    notesSk.push(`Bez týchto dát som nerobil rozhodnutia: ${missingSignalsSk.join("; ")}.`);
  }

  const sorted = decisions.sort(
    (a, b) => (a.style?.whenSk.startSec ?? 0) - (b.style?.whenSk.startSec ?? 0) || String(a.type).localeCompare(String(b.type)),
  );

  const byKind: Record<string, number> = {};
  for (const d of sorted) byKind[d.type] = (byKind[d.type] ?? 0) + 1;
  const totalSec = durationSec || sentences[sentences.length - 1]?.end || 0;
  const statsSk = [
    `Rozhodnutí: ${sorted.length} (${Object.entries(byKind).map(([k, v]) => `${k}: ${v}`).join(", ") || "žiadne"})`,
    `Podiel rečníka: ${Math.round(ratio.target * 100)} % (recept ${Math.round(ratio.base * 100)} %).`,
    `Zvážené a nevybrané nápady: ${considered.length}.`,
    totalSec > 0 ? `Pokrytie: ${sentences.length} viet za ${Math.round(totalSec)} s.` : `Viet: ${sentences.length}.`,
  ];

  return {
    id: `styleplan_${recipe.id.toLowerCase()}_${shortHash(`${recipe.id}|${sentences.length}|${words.length}|${controls.intensity}`)}`,
    recipeId: recipe.id,
    recipeName: recipe.name,
    recipeLabelSk: recipe.labelSk || recipe.name,
    createdAt: now,
    basis: {
      timingPrecision: index?.precision ?? "sentences",
      sentenceCount: sentences.length,
      wordCount: words.length,
      speechSeconds: round2(words.reduce((sum, w) => sum + Math.max(0, w.end - w.start), 0)),
      usedSignalsSk: usedSignalsSk,
      missingSignalsSk,
    },
    controls,
    ratio,
    decisions: sorted,
    considered,
    statsSk,
    notesSk,
    audioPolicy: "ORIGINAL_VO_MASTER",
    provider: "NONE",
  };
}

// ---------------------------------------------------------------------------
// Pomocníci
// ---------------------------------------------------------------------------

function makeDecision(now: number, detail: Omit<StyleDecisionDetail, "confidence"> & { confidence: number }): EditDecision {
  const edit = styleDecisionToEditDecision(detail as StyleDecisionDetail);
  edit.timestamp = now;
  return edit;
}

function emptyPlan(
  recipe: StyleRecipe,
  controls: StyleControls,
  now: number,
  ctx: {
    hasWords: boolean;
    hasSpeech: boolean;
    sentences: StyleSentenceSignal[];
    words: { word: string; start: number; end: number }[];
    durationSec: number;
    usedSignalsSk: string[];
    missingSignalsSk: string[];
    notesSk: string[];
  },
): StylePlan {
  return {
    id: `styleplan_${recipe.id.toLowerCase()}_empty`,
    recipeId: recipe.id,
    recipeName: recipe.name,
    recipeLabelSk: recipe.labelSk || recipe.name,
    createdAt: now,
    basis: {
      timingPrecision: ctx.hasWords ? "words" : "estimate",
      sentenceCount: 0,
      wordCount: ctx.words.length,
      speechSeconds: 0,
      usedSignalsSk: ctx.usedSignalsSk,
      missingSignalsSk: ctx.missingSignalsSk,
    },
    controls,
    ratio: { target: recipe.talkingHeadRatio, base: recipe.talkingHeadRatio, adjustmentsSk: [] },
    decisions: [],
    considered: [],
    statsSk: ["Rozhodnutí: 0 (nemám dáta)."],
    notesSk: ctx.notesSk,
    audioPolicy: "ORIGINAL_VO_MASTER",
    provider: "NONE",
  };
}

export function elementLabelSk(element: SupportingElementType): string {
  const labels: Record<SupportingElementType, string> = {
    b_roll: "B-roll záber",
    photo: "fotografia",
    illustration: "ilustrácia",
    diagram: "diagram",
    map: "mapa",
    icon: "ikona",
    paper_element: "papierový výstrižok",
    generated_visual: "generovaný vizuál (NEDOSTUPNÉ)",
    existing_media: "existujúce médium",
  };
  return labels[element] ?? element;
}

export function typographyRoleLabelSk(role: TypographyRole): string {
  const labels: Record<TypographyRole, string> = {
    keyword: "kľúčové slovo",
    headline: "titulok",
    label: "popisok",
    statistic: "veľké číslo",
    quote: "citát",
    emphasis: "dôraz",
  };
  return labels[role] ?? role;
}

export function motionLabelSk(motion: MotionKind, recipe: StyleRecipe): string {
  const labels: Record<MotionKind, string> = {
    pop: "pop-in prvku (prvok naskočí)",
    slide: "posun prvku z boku",
    punch: `krátke priblíženie na rečníka (${Math.round(recipe.camera.punchInScale * 100)} %)`,
    paper_movement: "pohyb papierových vrstiev (stop-motion dojem)",
    subtle_zoom: "veľmi jemné priblíženie",
    whip_transition: "švihový prechod na novú myšlienku",
  };
  return labels[motion] ?? motion;
}

export function compositionLabelSk(c: CompositionKind): string {
  const labels: Record<CompositionKind, string> = {
    full_screen: "celá obrazovka",
    split: "rozdelená obrazovka",
    layered_collage: "vrstvená koláž",
    picture_in_picture: "obraz v obraze",
    asymmetric: "asymetrické rozloženie",
  };
  return labels[c] ?? c;
}

/** Prehľad pre človeka: koľko pauz a kde (používa sa v reporte aj v UI). */
export function pauseOverview(segments: SpeechSegmentLike[], limit = 5): { start: number; end: number; duration: number }[] {
  const words = flattenWords(segments);
  if (words.length === 0) return [];
  return longestGaps(buildWordIndex(words), limit);
}

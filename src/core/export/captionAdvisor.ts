/**
 * INTELIGENTNÝ VÝBER ŠTÝLU TITULKOV (krok B+).
 *
 * Prečo to existuje: výber štýlu je presne tá vec, na ktorej editor stratí
 * najviac času a pri každej zakázke sa rozhoduje odznova. Appka preto ponúkne
 * **odporúčanie s dôvodom** — ale rozhodnutie necháva na človeku.
 *
 * Ako to funguje (a čo to NIE je):
 *  - **Žiadna AI, žiadne tokeny.** Je to čitateľné pravidlo: platforma, formát,
 *    tempo strihu, rýchlosť reči, obsah videa. Preto sa dá každé odporúčanie
 *    vysvetliť a otestovať — a preto sa nemôže „vymyslieť“.
 *  - **Žiadne sľuby o virálnosti.** Odporúčanie hovorí, čo je vhodné pre daný
 *    formát (hook, čítanie bez zvuku, čitateľnosť). Nie „toto bude virálne“.
 *  - **Nikdy neúčinkuje potichu.** Vráti dôvody pre aj proti, ktoré UI zobrazí
 *    presne v tomto texte.
 *  - Čo nevieme, nepovieme: keď chýbajú dáta (napr. tempo strihu), odporúčanie
 *    to prizná v `cautionSk` a opiera sa o zvyšok.
 */

import {
  CAPTION_STYLES,
  getCaptionStyle,
  isStrongCaptionWord,
  type CaptionStyleId,
  type CaptionStyleSpec,
} from "./subtitleRender";
import { PLATFORMS } from "../trends/trendLibrary";

// ---------------------------------------------------------------------------
// Typy
// ---------------------------------------------------------------------------

export interface CaptionAdviceInput {
  /** Platforma, pre ktorú klip je (rovnaké id ako v Trend Radare). */
  platform?: string;
  /** Oblastníček / typ klienta (id z knižnice trendov, napr. „b2b“, „fitness“). */
  niche?: string;
  /** Rozmery výsledného videa. */
  width?: number;
  height?: number;
  /** Tempo strihu hotového klipu (strihov za minútu), ak je známe. */
  cutsPerMinute?: number;
  /** Rýchlosť reči (slová za sekundu), ak je známa. */
  wordsPerSecond?: number;
  /** Má prepis časovanie po slovách? (rozhoduje o karaoke/virálnych štýloch) */
  hasWordTiming?: boolean;
  /** Dĺžka klipu v sekundách, ak je známa. */
  durationSec?: number;
  /** Podiel silných slov (čísla, peniaze) — užitočné pre štýl so zdôrazňovaním. */
  strongWordShare?: number;
}

export interface CaptionReason {
  /** Pre koho/za akých okolností platí. */
  textSk: string;
  /** O koľko bodov posunul skóre (vidno, že nič nie je „z čista jasna“). */
  weight: number;
}

export interface RankedCaptionStyle {
  id: CaptionStyleId;
  labelSk: string;
  score: number;
  reasonsSk: CaptionReason[];
}

export interface CaptionAdvice {
  /** Odporúčaný štýl (top 1). `null` len keď by odporúčanie bolo klamstvo. */
  recommended: CaptionStyleId | null;
  /** Zoradené odporúčania s dôvodmi (max 5, aby zoznam nezaplavil). */
  ranked: RankedCaptionStyle[];
  /** Na čo si dať pozor — poctivo, aj keď to odporúčanie znie dobre. */
  cautionSk: string[];
  /** Jedna veta, z čoho odporúčanie vychádza (alebo že nevychádza z ničoho). */
  basisSk: string;
}

// ---------------------------------------------------------------------------
// Pomocné pravidlá
// ---------------------------------------------------------------------------

/** Rýchle tempo strihu: nad 25 strihov za minútu je klip „hustý“. */
const FAST_CUTS = 25;
const MEDIUM_CUTS = 12;
/** Rýchla reč: nad 3,2 slova za sekundu sa dlhšie bloky nestíhajú čítať. */
const FAST_SPEECH = 3.2;
const SLOW_SPEECH = 2.2;

const PLATFORM_KEYS = new Set(PLATFORMS.map((p) => p.id.toUpperCase()));

const PLATFORM_LABEL: Record<string, string> = Object.fromEntries(
  PLATFORMS.map((p) => [p.id.toUpperCase(), p.labelSk]),
);

/** Známe „obaly“, ktoré zdieľajú rovnaké pravidlá (TikTok ≈ Reels ≈ Shorts). */
function platformGroup(platform?: string): "short" | "long" | "ads" | "brand" | "unknown" {
  const p = String(platform ?? "").toUpperCase();
  if (!p) return "unknown";
  if (p === "ADS" || p === "UGC" || p === "REKLAMA") return "ads";
  if (p === "YOUTUBE" || p === "YOUTUBE_LONG" || p === "LONGFORM") return "long";
  if (p === "BRAND" || p === "FIREMNE" || p === "PORTFOLIO") return "brand";
  if (p === "TIKTOK" || p === "REELS" || p === "SHORTS" || p === "IG" || p === "SOCIAL") return "short";
  return PLATFORM_KEYS.has(p) ? "short" : "unknown";
}

function isVertical(width?: number, height?: number): boolean {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  return w > 0 && h > 0 && h > w;
}

/** Oblasť → štýly, ktoré v nej fungujú (a prečo). */
const NICHE_FAVOURITES: Record<string, { ids: CaptionStyleId[]; reasonSk: string }> = {
  b2b: { ids: ["BRAND", "CLEAN", "PODCAST"], reasonSk: "B2B klient čaká pokoj a konzistenciu, nie efekty" },
  firemne: { ids: ["BRAND", "CLEAN"], reasonSk: "firemné video drží jednotný vizuál" },
  sluzby: { ids: ["CLEAN", "KEYWORD_POP", "VIRAL_BOLD"], reasonSk: "pri službách predáva jasná informácia (cena, termín)" },
  ecommerce: { ids: ["NEON_BOX", "KEYWORD_POP", "VIRAL_BOLD"], reasonSk: "pri produkte rozhoduje čitateľnosť ceny a benefitu" },
  vzdelavanie: { ids: ["KARAOKE", "KEYWORD_POP", "CLEAN"], reasonSk: "pri vysvetľovaní sa divák vracia k textu, potrebuje celú vetu" },
  "osobny-brand": { ids: ["VIRAL_BOLD", "KARAOKE", "HORMOZI"], reasonSk: "osobný brand žije z retencie a čitateľného hooku" },
  fitness: { ids: ["HORMOZI", "VIRAL_BOLD", "KARAOKE"], reasonSk: "fitness obsah je rýchly a energický" },
  krasa: { ids: ["NEON_BOX", "VIRAL_BOLD", "CLEAN"], reasonSk: "beauty obsah má často svetlé a rušivé pozadie" },
  gastro: { ids: ["NEON_BOX", "VIRAL_BOLD", "CLEAN"], reasonSk: "gastro/krása: text musí držať aj na svetlom zábere" },
  nehnutelnosti: { ids: ["CLEAN", "BRAND", "KEYWORD_POP"], reasonSk: "nehnuteľnosti predávajú parametre (m², cena, lokalita)" },
  podcast: { ids: ["PODCAST", "CLEAN"], reasonSk: "podcast necháva priestor tvári a zvuku" },
};

// ---------------------------------------------------------------------------
// Poradca
// ---------------------------------------------------------------------------

/**
 * Vráti odporúčanie štýlu s dôvodmi. Poradie a body sú deterministické:
 * rovnaký vstup = rovnaké odporúčanie (žiadne „raz tak, raz tak“).
 */
export function adviseCaptionStyle(input: CaptionAdviceInput = {}): CaptionAdvice {
  const group = platformGroup(input.platform);
  const vertical = isVertical(input.width, input.height);
  const hasDims = (Number(input.width) || 0) > 0 && (Number(input.height) || 0) > 0;
  const wordTiming = input.hasWordTiming === true;
  const cuts = Number(input.cutsPerMinute);
  const hasCuts = Number.isFinite(cuts) && cuts > 0;
  const wps = Number(input.wordsPerSecond);
  const hasWps = Number.isFinite(wps) && wps > 0;
  const strongShare = Number(input.strongWordShare);
  const hasStrong = Number.isFinite(strongShare) && strongShare > 0;

  const scores = new Map<CaptionStyleId, { score: number; reasons: CaptionReason[] }>();
  for (const style of CAPTION_STYLES) scores.set(style.id, { score: 0, reasons: [] });

  const add = (id: CaptionStyleId, weight: number, textSk: string) => {
    const entry = scores.get(id);
    if (!entry) return;
    entry.score += weight;
    entry.reasons.push({ textSk, weight });
  };

  // ── Platforma ────────────────────────────────────────────────────────────
  if (group === "short") {
    add("VIRAL_BOLD", 30, "krátky vertikálny formát — titulky sa čítajú aj bez zvuku");
    add("HORMOZI", 26, "TikTok/Reels/Shorts odmeňujú rýchly, agresívny text v prvých sekundách");
    add("KARAOKE", 18, "divák sa nestratí vo vete, keď sa zvýrazňuje hovorené slovo");
    add("NEON_BOX", 16, "na telefóne v exteriéri drží čitateľnosť aj farebná placka");
    add("KEYWORD_POP", 14, "zdôraznené čísla zvyšujú dôveryhodnosť v krátkom formáte");
    add("CLEAN", -10, "celá veta v čistom štýle sa v krátkom formáte nestíha dočítať");
    add("BRAND", -14, "firemný štýl je pre krátky formát príliš tichý");
    add("MINIMAL", -10, "malé písmo sa na telefóne pri scrollovaní prehliadne");
  } else if (group === "ads") {
    add("VIRAL_BOLD", 26, "reklama musí byť jasná aj bez zvuku — benefit priamo v obraze");
    add("KEYWORD_POP", 24, "cena, zľava a čísla sú v reklame to, čo divák hľadá");
    add("HORMOZI", 18, "krátke reklamné zostrihy ťahajú z rýchleho textu");
    add("NEON_BOX", 14, "placka zaručí, že ponuka je čitateľná v každom zábere");
    add("MINIMAL", -16, "pri reklame sa nesmie stratiť ponuka");
    add("BRAND", -6, "brand štýl je pre priamy predaj príliš pasívny");
  } else if (group === "long") {
    add("CLEAN", 26, "YouTube long-form znesie celú vetu a čistý vzhľad");
    add("PODCAST", 22, "dlhšie video a rozprávanie — text nemá prekážať");
    add("KEYWORD_POP", 18, "zdôraznené čísla pomáhajú v dlhom videu držať pozornosť");
    add("MINIMAL", 10, "pri dokumentárnom obsahu je menej viac");
    add("HORMOZI", -18, "obrovské dvojslovné titulky patria ku krátkemu formátu");
    add("NEON_BOX", -10, "placka pôsobí v dlhom videu rušivo");
  } else if (group === "brand") {
    add("BRAND", 30, "firemné zadanie — konzistencia a priestor pre logo a CTA");
    add("CLEAN", 20, "pokojný text drží dôveryhodnosť značky");
    add("MINIMAL", 12, "decentné titulky nechajú vyniknúť obrazu");
    add("HORMOZI", -20, "agresívny štýl sa s firemným vizuálom bije");
    add("NEON_BOX", -12, "výrazná placka odvedie pozornosť od produktu");
  } else {
    add("VIRAL_BOLD", 12, "bez známej platformy je najuniverzálnejší čitateľný štýl");
  }

  // ── Formát obrazu ────────────────────────────────────────────────────────
  if (vertical) {
    add("HORMOZI", 8, "na výšku je miesto pod tvárou — veľké písmo nič nezakryje");
    add("VIRAL_BOLD", 6, "veľké písmo sedí na 9:16 formát");
    if (hasDims) add("BRAND", -6, "na výšku je brand štýl s veľkým okrajom ešte tichší");
  } else if (hasDims) {
    add("CLEAN", 10, "na šírku (16:9) je celá veta prirodzená a čitateľná");
    add("PODCAST", 8, "na šírku sedí pokojný titulkový pás");
    add("HORMOZI", -8, "obrovské písmo na šírku preteká alebo zaberá pol obrazu");
    add("KARAOKE", -4, "na šírku je karaoke efekt menej užitočný (obraz nie je zvislý)");
  }

  // ── Tempo strihu ────────────────────────────────────────────────────────
  if (hasCuts) {
    if (cuts >= FAST_CUTS) {
      add("HORMOZI", 24, `tempo ${Math.round(cuts)} strihov/min — divák stíha 1–2 slová, nič viac`);
      add("VIRAL_BOLD", 16, `pri tempe ${Math.round(cuts)} strihov/min sa dlhšie bloky nestíhajú`);
      add("KARAOKE", -10, "celá veta pri rýchlom tempe nestíha dočítať");
      add("CLEAN", -12, "celá veta pri rýchlom strihu mizne skôr, než sa prečíta");
      add("PODCAST", -10, "pokojný štýl sa bije s rýchlym strihom");
    } else if (cuts >= MEDIUM_CUTS) {
      add("VIRAL_BOLD", 14, `tempo ${Math.round(cuts)} strihov/min — 2–3 slová na obrazovke sedia`);
      add("KARAOKE", 8, "stredné tempo znesie celú vetu so zvýrazňovaním");
      add("MINIMAL", -6, "pri strednom tempe je malý text už slabý");
    } else {
      add("CLEAN", 14, `pokojné tempo ${Math.round(cuts)} strihov/min — celá veta funguje`);
      add("PODCAST", 12, "pokojné tempo a rozprávanie si rozumejú");
      add("KEYWORD_POP", 8, "pri pokojnom tempe vyniknú zdôraznené čísla");
      add("HORMOZI", -12, "pri pokojnom tempe pôsobí agresívny štýl nepatrične");
    }
  }

  // ── Rýchlosť reči ───────────────────────────────────────────────────────
  if (hasWps) {
    if (wps >= FAST_SPEECH) {
      add("HORMOZI", 14, `rýchla reč (${wps.toFixed(1)} slov/s) — text musí byť krátky a veľký`);
      add("VIRAL_BOLD", 8, "pri rýchlej reči pomáha delenie na malé bloky");
      add("KARAOKE", -6, "pri rýchlej reči sa karaoke zvýrazňovanie míha");
    } else if (wps <= SLOW_SPEECH) {
      add("CLEAN", 12, `pokojná reč (${wps.toFixed(1)} slov/s) — celá veta sa stíha prečítať`);
      add("KARAOKE", 10, "pri pokojnej reči karaoke zvýraznenie pomáha sledovať text");
      add("HORMOZI", -8, "pri pokojnej reči je agresívny štýl zbytočný");
    }
  }

  // ── Časovanie slov ──────────────────────────────────────────────────────
  if (wordTiming) {
    add("KARAOKE", 16, "máš časovanie slov — zvýrazňovanie hovoreného slova je presné");
    add("VIRAL_BOLD", 8, "časovanie slov dáva presné zvýraznenie aj v krátkych blokoch");
    add("HORMOZI", 6, "bounce zvýraznenie funguje len s časovaním slov");
  } else {
    add("KARAOKE", -22, "bez časovania slov by zvýrazňovanie slova blikalo nepravidelne");
    add("VIRAL_BOLD", -10, "bez časovania slov sa zvýrazňovanie vypne (ostane len text)");
    add("HORMOZI", -20, "bez časovania slov sa bounce zvýraznenie nedá spraviť");
    add("KEYWORD_POP", 14, "zdôrazní čísla a silné slová aj bez časovania slov");
    add("CLEAN", 6, "čistý text funguje rovnako dobre bez časovania aj s ním");
    add("PODCAST", 6, "pokojný štýl nepotrebuje časovanie slov");
  }

  // ── Silné slová (čísla, peniaze) ────────────────────────────────────────
  if (hasStrong && strongShare >= 0.06) {
    add("KEYWORD_POP", 16, `v texte je ${Math.round(strongShare * 100)} % čísel a silných slov — zdôraznenie má čo robiť`);
    add("NEON_BOX", 4, "výrazné čísla si rozumejú s výrazným štýlom");
  }

  // ── Oblasť / klient ─────────────────────────────────────────────────────
  const nicheKey = String(input.niche ?? "").toLowerCase();
  const niche = NICHE_FAVOURITES[nicheKey];
  if (niche) {
    for (const id of niche.ids) add(id, 10, niche.reasonSk);
  }

  // ── Čo padá vždy (bezpečnosť a čitateľnosť) ─────────────────────────────
  for (const style of CAPTION_STYLES) {
    if (style.fontSizeRatio < 50 && group === "short") {
      add(style.id, -4, "malé písmo v krátkom formáte sa na telefóne číta zle");
    }
  }

  // ── Zoradenie ───────────────────────────────────────────────────────────
  const ordered = [...CAPTION_STYLES]
    .map((style) => {
      const entry = scores.get(style.id)!;
      // Poradie pri rovnosti je stabilné (podľa poradia v katalógu) — determinizmus.
      return { style, score: entry.score, reasons: entry.reasons };
    })
    .sort((a, b) => b.score - a.score);

  const ranked: RankedCaptionStyle[] = ordered.slice(0, 5).map((o) => ({
    id: o.style.id,
    labelSk: o.style.labelSk,
    score: Math.round(o.score),
    reasonsSk: o.reasons.filter((r) => r.weight > 0),
  }));

  const recommended = ordered[0]?.score > 0 ? ordered[0].style.id : null;

  // ── Poctivé poznámky ────────────────────────────────────────────────────
  const cautionSk: string[] = [];
  const spec: CaptionStyleSpec | null = recommended ? getCaptionStyle(recommended) : null;

  if (recommended && spec?.highlightMode !== "none" && !wordTiming) {
    cautionSk.push(
      "Odporúčaný štýl vie zvýrazňovať hovorené slovo, ale nemáš časovanie slov — zvýrazňovanie sa vypne. Ak chceš plný efekt, vygeneruj automatické titulky.",
    );
  }
  if (!hasCuts) {
    cautionSk.push("Tempo strihu nepoznám — do odporúčania nevstúpilo. Postav strih a odporúčanie sa spresní.");
  }
  if (!hasDims) {
    cautionSk.push("Nepoznám rozmery videa — formát (9:16 vs 16:9) som nezohľadnil. Server si rozmery overí pri renderi.");
  }
  if (!hasWps) {
    cautionSk.push("Rýchlosť reči nepoznám — ak hovoríš rýchlo, uber slová na obrazovke (Hormozi) alebo naopak pridaj (Čistý).");
  }
  if (group === "unknown") {
    cautionSk.push("Platformu nemám — odporúčanie je zatiaľ všeobecné. Vyber formát (TikTok/Reels/Shorts/YouTube/Reklama) a spresní sa.");
  }
  cautionSk.push(
    "Toto je odporúčanie, nie pravidlo — štýl si vyberá človek a dá sa kedykoľvek zmeniť (pred vypálením).",
  );

  const basisParts: string[] = [];
  if (group !== "unknown") basisParts.push(`platforma ${PLATFORM_LABEL[String(input.platform).toUpperCase()] || input.platform}`);
  if (hasDims) basisParts.push(vertical ? "formát na výšku" : "formát na šírku");
  if (hasCuts) basisParts.push(`tempo ${Math.round(cuts)} strihov/min`);
  if (hasWps) basisParts.push(`reč ${wps.toFixed(1)} slov/s`);
  if (wordTiming) basisParts.push("časovanie slov");
  if (niche) basisParts.push(`oblasť ${nicheKey}`);

  return {
    recommended,
    ranked,
    cautionSk,
    basisSk: basisParts.length
      ? `Odporúčanie vychádza z toho, čo o klipe viem: ${basisParts.join(", ")}. Sú to pravidlá z knižnice princípov (dá sa prečítať a otestovať), nie odhad z trendov.`
      : "Zatiaľ neviem o klipe nič konkrétne — toto je len všeobecné odporúčanie. Postav strih a vyber formát, odporúčanie sa spresní.",
  };
}

// ---------------------------------------------------------------------------
// Vstup pre poradcu z reálnych dát klipu
// ---------------------------------------------------------------------------

export interface AdviceContextLike {
  /** Dĺžka klipu v sekundách. */
  durationSec?: number;
  /** Počet strihov v klipe (na výpočet tempa). */
  cutCount?: number;
  /** Úseky s textom (titulky). */
  segments?: { start: number; end: number; text: string; words?: { word: string; start: number; end: number }[] }[];
}

/**
 * Vypočíta z tituliek to, čo poradca potrebuje: rýchlosť reči, podiel silných
 * slov a či existuje časovanie po slovách. Nič sa neodhaduje z dĺžky videa —
 * keď dáta nie sú, pole jednoducho chýba.
 */
export function adviceInputFromContext(
  ctx: AdviceContextLike,
): Pick<CaptionAdviceInput, "wordsPerSecond" | "strongWordShare" | "hasWordTiming" | "durationSec" | "cutsPerMinute"> {
  const segments = Array.isArray(ctx.segments) ? ctx.segments : [];
  const words: string[] = [];
  let wordTimingCount = 0;

  for (const seg of segments) {
    const segWords = Array.isArray(seg?.words) ? seg.words : [];
    if (segWords.length >= 2) wordTimingCount += segWords.length;
    const text = String(seg?.text ?? "").trim();
    if (text) words.push(...text.split(/\s+/));
  }

  const out: ReturnType<typeof adviceInputFromContext> = {};
  const duration = Number(ctx.durationSec);

  if (duration > 0 && words.length > 0) {
    out.wordsPerSecond = Number((words.length / duration).toFixed(2));
  }
  if (words.length > 0) {
    const strong = words.filter((w) => isStrongCaptionWord(w)).length;
    out.strongWordShare = Number((strong / words.length).toFixed(3));
  }
  if (wordTimingCount >= 2) out.hasWordTiming = true;
  if (Number.isFinite(duration) && duration > 0) out.durationSec = duration;
  const cutCount = Number(ctx.cutCount);
  if (Number.isFinite(cutCount) && cutCount > 0 && duration > 0) {
    out.cutsPerMinute = Number(((cutCount / duration) * 60).toFixed(1));
  }
  return out;
}

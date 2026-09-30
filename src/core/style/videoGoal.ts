/**
 * KROK 26 — VIDEO GOAL (ČO má video dosiahnuť) + CREATOR REFERENCE (AKO má vyzerať).
 *
 * Prečo to existuje: štýl z referencie (Denis, AI_KTIVISTA…) hovorí **ako** má
 * video vyzerať. Ale to isté surové video s tým istým štýlom má iné rozhodnutia,
 * keď má **predávať**, a iné, keď má **získať odber**.
 *
 * Toto NIE JE nový model ani druhý engine:
 *  - cieľ je **stratégia**, ktorá prerátá a doplní **existujúce `EditDecision`**,
 *  - nič sa nedopisuje do textu a nič sa nevymýšľa: keď v prepise nie je výzva
 *    na akciu, appka to povie (a CTA rozhodnutie nevznikne),
 *  - všetko je deterministické — žiadna náhoda, žiadny provider.
 *
 * Dve vrstvy, ktoré sa nikdy nemiešajú:
 *     CREATOR REFERENCE → AKO (vizuál, rytmus, typografia)  [styleRecipes.ts]
 *     VIDEO GOAL        → ČO (čo má divák spraviť)          [tento modul]
 */

/** Ciele, ktoré appka pozná. Jeden projekt = jeden hlavný cieľ. */
export type VideoGoalId =
  | "PREDAJ"
  | "ODBER"
  | "REACH"
  | "KOMENTARE"
  | "KLIK"
  | "VZDELAVANIE"
  | "BRAND"
  | "LEAD"
  | "STORYTELLING";

/** Ako sa cieľ prejaví v rozhodnutiach (všetko sú násobiče/uprednostnenia, nie nové efekty). */
export interface VideoGoalDefinition {
  id: VideoGoalId;
  labelSk: string;
  emoji: string;
  /** Jednou vetou, čo má video dosiahnuť. */
  purposeSk: string;
  /** Čo má edit robiť inak (konkrétne, nie fráza). */
  strategySk: string[];
  /** Slová vo vete, ktoré nesú tento cieľ (deterministické hľadanie v prepise). */
  intentMarkersSk: string[];
  /** Slová výzvy na akciu (CTA). Keď v prepise nie sú, appka to prizná. */
  actionMarkersSk: string[];
  /**
   * Váhy pre skóre vety (čím väčšia váha, tým skôr sa veta dostane do výberu).
   * Všetko sa počíta z reálnych vlastností vety — nie z odhadu.
   */
  weights: {
    /** veta obsahuje slová cieľa */
    intent: number;
    /** veta je na začiatku (hook) */
    hook: number;
    /** veta je otázka */
    question: number;
    /** veta obsahuje číslo */
    number: number;
    /** veta nesie emóciu */
    emotional: number;
    /** veta začína novú myšlienku (topic shift) */
    topicShift: number;
    /** veta je na konci (uzavretie / CTA) */
    late: number;
  };
  /** Koľko priestoru dostať ktorým rozhodnutiam (1 = koľko dáva recept, 0,5 = polovicu). */
  caps: { motion: number; typography: number; supportingVisual: number };
  /** Čo cieľ vyžaduje (keď to v dátach nie je, appka to povie — nič nedopisuje). */
  requiresSk: string[];
  /** Čo cieľ NIKDY nerobí — poctivá hranica. */
  neverDoesSk: string[];
}

export const VIDEO_GOALS: Record<VideoGoalId, VideoGoalDefinition> = {
  PREDAJ: {
    id: "PREDAJ",
    labelSk: "Predaj",
    emoji: "🛒",
    purposeSk: "Divák má pochopiť ponuku a spraviť kúpny krok.",
    strategySk: [
      "benefit a ponuka sa zvýraznia hneď, ako vo videu zaznejú (nie na konci)",
      "čísla, ceny a výsledky dostanú text (dajú sa overiť, nehádajú sa)",
      "tvrdenia o produkte zostávajú celé — nevyhadzujú sa, ani keď sú dlhé",
      "výzva na akciu (CTA) sa zvýrazní na konci",
      "pohyb a ozdoby sa držia pri zemi — pozornosť má ísť na ponuku",
    ],
    intentMarkersSk: [
      "cena", "zľava", "akcia", "balík", "produkt", "výsledok", "benefit", "zdarma",
      "doprava", "záruka", "skladom", "objedn", "kúp", "predaj", "zisk", "ušetrí",
      "vyrieši", "pomôže", "funguje",
    ],
    actionMarkersSk: ["objednaj", "kúp", "napíš", "klikni", "pošli správu", "link", "odkaz", "doprava zdarma"],
    weights: { intent: 3.0, hook: 1.4, question: 0.6, number: 2.0, emotional: 0.8, topicShift: 0.6, late: 1.2 },
    caps: { motion: 0.7, typography: 1.2, supportingVisual: 1.2 },
    requiresSk: ["výzva na akciu (CTA) v prepise", "aspoň jedno číslo alebo konkrétny výsledok ponuky"],
    neverDoesSk: [
      "nedopisuje CTA do textu ani do titulkov — keď výzvu v nahrávke nemáš, appka to povie",
      "nevymýšľa ceny, benefity ani čísla, ktoré v nahrávke nezazneli",
    ],
  },
  ODBER: {
    id: "ODBER",
    labelSk: "Odber / follow",
    emoji: "👤",
    purposeSk: "Divák má pochopiť, kto to je, a chcieť ďalšie video.",
    strategySk: [
      "hook nesmie byť prekrytý grafikou — tvár a prvá veta držia pozornosť",
      "osobné a názorové vety (ktoré ukazujú osobnosť) dostanú dôraz",
      "výzva na sledovanie sa zvýrazní na konci",
      "rytmus zostáva pokojnejší — ide o vzťah, nie o rýchlosť",
    ],
    intentMarkersSk: ["ja", "moje", "robím", "zažil", "naučil", "môj", "my", "názor", "myslím", "verím", "skúsenosť"],
    actionMarkersSk: ["sleduj", "odber", "follow", "prihlás", "zapni si zvonek", "zvonček"],
    weights: { intent: 2.6, hook: 2.2, question: 1.0, number: 0.8, emotional: 2.2, topicShift: 1.0, late: 1.2 },
    caps: { motion: 0.9, typography: 1.0, supportingVisual: 1.0 },
    requiresSk: ["výzva na sledovanie (CTA) v prepise"],
    neverDoesSk: [
      "nedopisuje výzvu na sledovanie — keď v nahrávke nie je, appka to povie",
      "nevyrába „tvár kanála“ ani logo — to je tvoja grafika",
    ],
  },
  REACH: {
    id: "REACH",
    labelSk: "Pozornosť / dosah",
    emoji: "👀",
    purposeSk: "Video má prežiť prvých pár sekúnd a ísť ďalej.",
    strategySk: [
      "prvé dve sekundy bez prekrytia tváre + krátke priblíženie na hook",
      "rytmus sa zrýchli: nové myšlienky dostanú švih/pohyb",
      "podporné vizuály dostanú viac priestoru (obraz sa má meniť)",
      "dlhé vety sa držia krátko čitateľným textom, nie novým efektom",
    ],
    intentMarkersSk: ["šok", "nikdy", "vždy", "tajomstvo", "trik", "rýchlo", "zadarmo", "toto", "pozor", "chýba", "zlé"],
    actionMarkersSk: ["zdieľaj", "pošli", "ulož si", "repost", "označ"],
    weights: { intent: 2.4, hook: 3.0, question: 1.4, number: 1.6, emotional: 1.6, topicShift: 2.4, late: 0.6 },
    caps: { motion: 1.4, typography: 1.1, supportingVisual: 1.5 },
    requiresSk: ["dosť podporných médií na striedanie obrazu (inak appka povie, že sa obraz nemá čím meniť)"],
    neverDoesSk: [
      "nepridáva efekty len preto, aby niečo blikalo — pohyb musí sedieť na hranicu myšlienky",
      "neurobí z pokojnej vety virálnu — mení dôraz, nie obsah",
    ],
  },
  KOMENTARE: {
    id: "KOMENTARE",
    labelSk: "Komentáre / engagement",
    emoji: "💬",
    purposeSk: "Divák má mať na čo reagovať.",
    strategySk: [
      "otázky vo videu dostanú najväčší dôraz (sú to miesta na reakciu)",
      "názorové a kontrastné vety („ale“, „naopak“, „väčšina si myslí“) sa zvýraznia",
      "jedna myšlienka zostáva zámerne otvorená — appka ju nezakryje grafikou",
      "CTA na komentár sa zvýrazní na konci",
    ],
    intentMarkersSk: ["myslíš", "súhlasíš", "podľa", "podľa mňa", "naopak", "ale", "väčšina", "kontroverz", "názor", "ozvi"],
    actionMarkersSk: ["napíš", "koment", "odpíš", "povedz mi", "čo si myslíš"],
    weights: { intent: 2.8, hook: 1.4, question: 3.2, number: 1.0, emotional: 1.6, topicShift: 1.6, late: 1.2 },
    caps: { motion: 0.9, typography: 1.1, supportingVisual: 0.9 },
    requiresSk: ["aspoň jedna otázka vo videu", "výzva na komentár v prepise"],
    neverDoesSk: [
      "nedopisuje otázku ani výzvu — keď v nahrávke nie je, appka to povie",
      "nevyrába kontroverziu z ničoho",
    ],
  },
  KLIK: {
    id: "KLIK",
    labelSk: "Klik / návšteva",
    emoji: "🔗",
    purposeSk: "Divák má kliknúť na odkaz alebo otvoriť ponuku.",
    strategySk: [
      "sľub (čo tam nájde) sa zvýrazní hneď na začiatku",
      "kontaktné a odkazové miesta dostanú text, aby sa dali prečítať",
      "rytmus je pokojnejší — divák musí stihnúť prečítať, kam ísť",
      "CTA na klik sa zvýrazní na konci",
    ],
    intentMarkersSk: ["odkaz", "link", "bio", "profil", "web", "stránka", "nájdeš", "stiahni", "rezervuj", "prihlás"],
    actionMarkersSk: ["klikni", "otvor", "choď na", "pozri si", "stiahni", "prihlás sa", "rezervuj"],
    weights: { intent: 2.8, hook: 1.6, question: 0.8, number: 1.4, emotional: 0.8, topicShift: 0.8, late: 1.6 },
    caps: { motion: 0.7, typography: 1.3, supportingVisual: 0.9 },
    requiresSk: ["výzva na klik v prepise", "konkrétne miesto (odkaz, profil, stránka) v prepise"],
    neverDoesSk: [
      "nedopisuje odkaz ani výzvu — musí zaznieť v nahrávke",
      "nevkladá klikateľné odkazy do videa (titulky nie sú klikateľné)",
    ],
  },
  VZDELAVANIE: {
    id: "VZDELAVANIE",
    labelSk: "Vzdelávanie",
    emoji: "🎓",
    purposeSk: "Divák má pochopiť a zapamätať si.",
    strategySk: [
      "jasnosť má prednosť pred efektmi — pohyb sa utlmí na minimum",
      "postup a čísla (kroky, poradie) dostanú text",
      "pauzy zostávajú prázdne (na pochopenie), nedávajú sa do nich ozdoby",
      "stručne: menej titulkov, ale presnejších",
    ],
    intentMarkersSk: ["krok", "najprv", "potom", "preto", "lebo", "znamená", "princíp", "pravidlo", "rozdiel", "napríklad"],
    actionMarkersSk: ["vyskúšaj", "zapamätaj", "poznámka"],
    weights: { intent: 3.0, hook: 1.0, question: 0.8, number: 2.4, emotional: 0.4, topicShift: 1.0, late: 0.8 },
    caps: { motion: 0.4, typography: 1.1, supportingVisual: 0.8 },
    requiresSk: ["zrozumiteľný prepis (bez neho niet čo vysvetľovať)"],
    neverDoesSk: [
      "nepridáva efekty do výkladu — rušili by porozumenie",
      "nedopĺňa chýbajúce kroky ani definície",
    ],
  },
  BRAND: {
    id: "BRAND",
    labelSk: "Značka / dôvera",
    emoji: "❤️",
    purposeSk: "Video má pôsobiť pokojne a dôveryhodne pre značku.",
    strategySk: [
      "pokojný rytmus: menej pohybu, žiadne rýchle švihy",
      "typografia konzistentná — rovnaký spôsob zvýraznenia po celý klip",
      "dôkazové vety (skúsenosť, čísla, hodnoty) dostanú dôraz",
      "záver pôsobí uzavreto (bez „predaja za každú cenu“)",
    ],
    intentMarkersSk: ["veríme", "hodnota", "kvalita", "skúsenosť", "rokmi", "ľudia", "tím", "zákazník", "dôvera", "poctivo"],
    actionMarkersSk: ["ozvi sa", "napíš nám", "stav sa", "príď", "kontakt"],
    weights: { intent: 2.6, hook: 1.0, question: 0.6, number: 1.6, emotional: 1.2, topicShift: 0.8, late: 1.4 },
    caps: { motion: 0.5, typography: 0.9, supportingVisual: 1.0 },
    requiresSk: ["aspoň jedna dôkazová veta (skúsenosť, číslo, hodnota)"],
    neverDoesSk: [
      "nedodá logo, farby ani claim — tie patria do tvojej grafiky (Brand kit)",
      "nepoužije agresívny efekt, aj keď ho referencia bežne používa",
    ],
  },
  LEAD: {
    id: "LEAD",
    labelSk: "Lead / kontakt",
    emoji: "📩",
    purposeSk: "Divák má zanechať kontakt alebo napísať správu.",
    strategySk: [
      "problém → riešenie musí byť čitateľné (text na oboch stranách)",
      "dôkazové čísla a výsledky dostanú dôraz",
      "kontaktná výzva sa zvýrazní na konci",
      "striedmy pohyb — dôraz na dôveru, nie na efekt",
    ],
    intentMarkersSk: ["problém", "riešenie", "výsledok", "za mesiac", "klient", "dopyt", "skúsenosť", "obrat", "predaj", "rast"],
    actionMarkersSk: ["napíš", "ozvi sa", "kontakt", "formulár", "správa", "zavolaj", "dopyt"],
    weights: { intent: 3.0, hook: 1.2, question: 1.0, number: 2.2, emotional: 0.8, topicShift: 1.2, late: 1.6 },
    caps: { motion: 0.6, typography: 1.2, supportingVisual: 1.1 },
    requiresSk: ["výzva na kontakt v prepise", "aspoň jedno číslo alebo konkrétny výsledok"],
    neverDoesSk: [
      "nedopĺňa kontaktné údaje (telefón, e-mail) do videa",
      "nesľubuje výsledok, ktorý v nahrávke nezaznel",
    ],
  },
  STORYTELLING: {
    id: "STORYTELLING",
    labelSk: "Príbeh",
    emoji: "🎬",
    purposeSk: "Divák má prežiť príbeh od začiatku do pointy.",
    strategySk: [
      "emocionálne beaty (a pointa) dostanú dôraz, ozdoby idú bokom",
      "pauzy zostávajú — nesú napätie",
      "pohyb len na obratoch (nová myšlienka), nie priebežne",
      "posledná veta je pointa — nezakryje sa grafikou",
    ],
    intentMarkersSk: ["kedysi", "raz", "potom", "nakoniec", "príbeh", "stalo", "zrazu", "až", "odvtedy", "napokon"],
    actionMarkersSk: ["sleduj", "pokračovanie", "druhá časť"],
    weights: { intent: 2.4, hook: 1.8, question: 1.0, number: 1.0, emotional: 3.0, topicShift: 2.0, late: 1.8 },
    caps: { motion: 0.8, typography: 0.9, supportingVisual: 1.2 },
    requiresSk: ["uzavretá myšlienka na konci (pointa)"],
    neverDoesSk: [
      "nedopisuje pointu ani pointy z iného videa",
      "nepridáva efekty do emotívnych miest — tam ide tvár",
    ],
  },
};

export const VIDEO_GOAL_IDS = Object.keys(VIDEO_GOALS) as VideoGoalId[];

/** Zjednotí text na porovnávanie (bez diakritiky, bez interpunkcie). */
export function normalizeForMarkers(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Nájde v texte slová z daného zoznamu (deterministicky, vrátane tvarov so spoločným základom). */
export function findMarkers(text: string, markers: string[]): string[] {
  const haystack = normalizeForMarkers(text);
  if (!haystack) return [];
  return markers.filter((m) => haystack.includes(normalizeForMarkers(m)));
}

/** Veta (to, čo engine naozaj analyzuje) — potrebné polia, aby bol modul testovateľný sám. */
export interface GoalSentenceLike {
  index: number;
  text: string;
  start: number;
  end: number;
  durationSec: number;
  isQuestion?: boolean;
  isEmotional?: boolean;
  numberWords?: string[];
  topicShift?: boolean;
  isHook?: boolean;
  isLast?: boolean;
}

export interface GoalFit {
  sentenceIndex: number;
  score: number;
  /** Prečo veta patrí k cieľu (vždy s konkrétnym dôvodom, nie „je dobrá“). */
  reasonsSk: string[];
  /** Nájdené slová cieľa. */
  intentWordsSk: string[];
  /** Nájdené slová výzvy na akciu (CTA). */
  actionWordsSk: string[];
}

/**
 * Skóre „ako veľmi táto veta slúži cieľu“ — čisto z reálnych vlastností vety.
 * Slúži na preusporiadanie dôrazu; **nový obsah sa nevyrába**.
 */
export function scoreSentenceForGoal(
  sentence: GoalSentenceLike,
  goal: VideoGoalDefinition,
  context: { totalSentences: number; durationSec?: number },
): GoalFit {
  const w = goal.weights;
  const reasons: string[] = [];
  let score = 0;

  const intentWords = findMarkers(sentence.text, goal.intentMarkersSk);
  if (intentWords.length > 0) {
    score += w.intent * Math.min(3, intentWords.length);
    reasons.push(`slová cieľa: ${intentWords.slice(0, 4).join(", ")}`);
  }

  const actionWords = findMarkers(sentence.text, goal.actionMarkersSk);
  if (actionWords.length > 0) {
    score += w.intent * 0.8;
    reasons.push(`výzva na akciu: ${actionWords.slice(0, 3).join(", ")}`);
  }

  if (sentence.isHook) {
    score += w.hook;
    reasons.push("prvá veta (hook)");
  }
  if (sentence.isQuestion) {
    score += w.question;
    reasons.push("otázka");
  }
  if ((sentence.numberWords?.length ?? 0) > 0) {
    score += w.number;
    reasons.push(`číslo vo vete: ${sentence.numberWords!.slice(0, 3).join(", ")}`);
  }
  if (sentence.isEmotional) {
    score += w.emotional;
    reasons.push("nesie emóciu");
  }
  if (sentence.topicShift) {
    score += w.topicShift;
    reasons.push("začína novú myšlienku");
  }
  // Koniec videa: pri cieľoch, ktoré chcú akciu, je koniec dôležitý.
  const total = Math.max(1, context.totalSentences);
  const positionRatio = total === 1 ? 0 : sentence.index / (total - 1);
  if (sentence.isLast || positionRatio >= 0.85) {
    score += w.late;
    reasons.push("záver videa");
  }
  // Pri „reach“ je začiatok vzácnejší než čokoľvek iné — koniec naopak stráca.
  score += positionRatio < 0.25 ? w.hook * 0.5 : 0;

  return {
    sentenceIndex: sentence.index,
    score: Math.round(score * 1000) / 1000,
    reasonsSk: reasons,
    intentWordsSk: intentWords,
    actionWordsSk: actionWords,
  };
}

/** Prejde všetky vety a vráti ich skóre pre daný cieľ (deterministicky zoradené). */
export function scoreSentencesForGoal(
  sentences: GoalSentenceLike[],
  goal: VideoGoalDefinition,
  context: { durationSec?: number } = {},
): GoalFit[] {
  return sentences
    .map((s) => scoreSentenceForGoal(s, goal, { totalSentences: sentences.length, ...context }))
    .sort((a, b) => b.score - a.score || a.sentenceIndex - b.sentenceIndex);
}

/**
 * Čo cieľ od dát vyžaduje a čo v nich NIE je — aby appka mohla poctivo povedať
 * „toto som nenašiel, nedopĺňam to“.
 */
export function goalRequirementsReport(
  sentences: GoalSentenceLike[],
  goal: VideoGoalDefinition,
): { foundSk: string[]; missingSk: string[] } {
  const foundSk: string[] = [];
  const missingSk: string[] = [];

  const allText = sentences.map((s) => s.text).join(" ");
  const hasAction = findMarkers(allText, goal.actionMarkersSk).length > 0;
  const hasIntent = findMarkers(allText, goal.intentMarkersSk).length > 0;
  const hasQuestion = sentences.some((s) => s.isQuestion);
  const hasNumbers = sentences.some((s) => (s.numberWords?.length ?? 0) > 0);

  if (hasAction) foundSk.push(`výzva na akciu: ${findMarkers(allText, goal.actionMarkersSk).slice(0, 3).join(", ")}`);
  else missingSk.push("výzva na akciu (CTA) — appka ju nedopíše, musí zaznieť v nahrávke");

  if (hasIntent) foundSk.push(`slová cieľa: ${findMarkers(allText, goal.intentMarkersSk).slice(0, 4).join(", ")}`);
  else missingSk.push("slová, ktoré nesú cieľ — video ich zatiaľ neobsahuje");

  if (goal.requiresSk.some((r) => r.includes("otázka"))) {
    if (hasQuestion) foundSk.push("otázka vo videu (miesto na reakciu)");
    else missingSk.push("otázka vo videu — bez nej niet na čo reagovať");
  }
  if (goal.requiresSk.some((r) => r.includes("číslo") || r.includes("výsledok"))) {
    if (hasNumbers) foundSk.push(`čísla vo videu: ${sentences.flatMap((s) => s.numberWords ?? []).slice(0, 3).join(", ")}`);
    else missingSk.push("číslo alebo konkrétny výsledok — appka si ho nevymyslí");
  }

  return { foundSk, missingSk };
}

/** Krátke zhrnutie stratégie cieľa pre človeka (do UI a do plánu). */
export function goalSummarySk(goal: VideoGoalDefinition): string {
  return `${goal.emoji} ${goal.labelSk}: ${goal.purposeSk}`;
}

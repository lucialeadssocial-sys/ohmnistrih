/**
 * STYLE STUDIO — typy rozhodnutí (krok 1–3 Reality Gate).
 *
 * Prečo vlastný súbor: tieto typy sú **čisté data-typy bez importov**. `ProjectModel`
 * z nich berie iba doplnkový detail rozhodnutia (`EditDecision.style`), takže medzi
 * projektovým modelom a Style Studiom **nevzniká cyklický import** ani druhý model.
 *
 * Zámer:
 *  - **Žiadny nový timeline/projekt model.** Style Studio len opisuje, AKO sa má
 *    navrhnúť vizuálna úprava — rozhodnutia samotné sú existujúci `EditDecision`.
 *  - **Nič o audiu.** Audio (voiceover) nie je v týchto typoch vôbec prítomné, aby
 *    nebolo možné ho omylom meniť. Kontrolky majú len `preserveOriginalAudio`.
 */

/** Druh vizuálneho zásahu. Mapuje sa na `EditDecision['type']`. */
export type StyleDecisionKind =
  | "talking_head" // rečník: nechať / orez / punch-in / presun
  | "supporting_visual" // podporný vizuál: papier, foto, ilustrácia, diagram, ikona…
  | "typography" // text: keyword / headline / label / statistika / citát / dôraz
  | "motion" // pohyb: pop / slide / punch / pohyb papiera / jemné zoom / švih
  | "composition"; // kompozícia: celá obrazovka / split / vrstvená koláž / PiP / asymetria

/** Typy podporných prvkov (presne tie, ktoré pomenúva zadanie). */
export type SupportingElementType =
  | "b_roll"
  | "photo"
  | "illustration"
  | "diagram"
  | "map"
  | "icon"
  | "paper_element"
  | "generated_visual" // POVOLENÉ len ak existuje provider — dnes NEDOSTUPNÉ (viď `providerAvailable`)
  | "existing_media";

/** Rola textu v obraze. */
export type TypographyRole = "keyword" | "headline" | "label" | "statistic" | "quote" | "emphasis";

/** Druh pohybu. */
export type MotionKind = "pop" | "slide" | "punch" | "paper_movement" | "subtle_zoom" | "whip_transition";

/** Kompozícia scény. */
export type CompositionKind = "full_screen" | "split" | "layered_collage" | "picture_in_picture" | "asymmetric";

/**
 * Čo presne sa má spraviť — strojovo čitateľný cieľ pre neskorší Apply (krok 6).
 * Zámerne tu **nie je** nič o audiu a nič o časovej osi: to patrí existujúcemu
 * projektu a jeho commands.
 */
export interface StyleActionPayload {
  /** Na ktorý typ existujúceho tracku to patrí (ProjectModel: 'b-roll' | 'video' | 'caption'). */
  targetTrackType?: "b-roll" | "video" | "caption";
  /** Podporný vizuál — typ prvku. */
  elementType?: SupportingElementType;
  /** Pohyb (pop / švih / jemné zoom…). */
  motion?: MotionKind;
  /** Text — rola a navrhovaný text (text sa nikdy nevymýšľa: berie sa z vety!). */
  typographyRole?: TypographyRole;
  /** Doslovný text z vety, ktorý sa má zobraziť (nikdy vygenerovaný). */
  typographyText?: string;
  /** Punch-in: koľko zväčšiť (napr. 1.12). */
  punchInScale?: number;
  /** Kompozícia scény. */
  composition?: CompositionKind;
  /** Prepis pre existujúcu transition štruktúru (`TransitionConfig`), keď príde Apply. */
  transitionHint?: "whip_pan" | "punch" | "dissolve" | "none";
  /**
   * Ochranné rozhodnutie (rečník zostáva v obraze): smie sa v tomto čase pridať
   * text? `true` = áno (napr. hook: „pridaj len krátky titulok“),
   * `false`/neurčené = nie (napr. emocionálna veta — nič cez tvár).
   * Apply podľa toho vie, čo je ešte v poriadku a čo by pravidlo porušilo.
   */
  allowTypography?: boolean;
  /** Poznámka pre človeka (napr. „počas pauzy nepridávaj nové prvky“). */
  noteSk?: string;
}

/**
 * Doplnkový detail vizuálneho rozhodnutia — pripája sa k **existujúcemu**
 * `EditDecision` (`ProjectModel`), aby každé rozhodnutie malo:
 * WHAT / WHEN / WHY / WHEN NOT / ALTERNATIVE / CONFIDENCE.
 */
export interface StyleDecisionDetail {
  kind: StyleDecisionKind;
  /** ID receptu, z ktorého rozhodnutie vzniklo (dohľadateľnosť). */
  recipeId: string;
  /** WHAT — čo sa má v obraze zmeniť (konkrétne, nie „sprav to zaujímavejšie“). */
  whatSk: string;
  /** WHEN — presný časový rozsah (sekundy na zdrojovej osi). */
  whenSk: { startSec: number; endSec: number };
  /** WHY — prečo práve tu (vždy s dátovým dôvodom). */
  whySk: string;
  /** WHEN NOT — kedy to NEpoužiť. Konkrétna podmienka, nie fráza. */
  whenNotSk: string;
  /** ALTERNATIVE — jedna konkrétna náhrada (nie zoznam možností). */
  alternativeSk: string;
  /** CONFIDENCE — 0–1. Nikdy presne 1 (nikdy netvrdíme istotu). */
  confidence: number;
  /** Na akých dátach rozhodnutie stojí (napr. „hustota 4,1 slova/s“, „pauza 0,8 s“). */
  evidenceSk: string[];
  /** Mená signálov, ktoré sa použili (strojovo čitateľné). */
  signals: string[];
  /** Čo konkrétne sa má spraviť (pre Apply v kroku 6). */
  action: StyleActionPayload;
  /**
   * KROK 26 — podľa akého cieľa videa bolo rozhodnutie prehodnotené
   * (`PREDAJ`, `ODBER`…). Nepovinné: rozhodnutia bez cieľa fungujú presne
   * ako predtým.
   */
  goalId?: string;
  /** Ako veľmi táto veta slúži cieľu (0 a viac) — z reálnych vlastností vety. */
  goalFit?: number;
  /** Prečo veta patrí k cieľu (konkrétne dôvody, nie „je dobrá“). */
  goalFitSk?: string[];
}

/** Úroveň stylingu — ovládač používateľa. */
export type StyleIntensity = "subtle" | "balanced" | "aggressive";
/** Koľko textu v obraze. */
export type TypographyIntensity = "minimal" | "balanced" | "strong";
/** Koľko pohybu. */
export type MotionIntensity = "calm" | "balanced" | "dynamic";
/** Miera textúr (editorial look). */
export type TextureIntensity = "clean" | "subtle" | "editorial";

/** Čo robiť s generovanými vizuálmi (dnes provider NEEXISTUJE → vždy len `off`/`suggested`). */
export type GeneratedVisualsMode = "off" | "suggested" | "automatic";

/**
 * Ovládače používateľa (bod 24 zadania). Defaulty sú zámerne pokojné a
 * **audio je vždy chránené**.
 */
export interface StyleControls {
  intensity: StyleIntensity;
  /** 0–1 alebo `null` = nech rozhodne recept + analýza (odporúčané). */
  talkingHeadRatio: number | null;
  typography: TypographyIntensity;
  motion: MotionIntensity;
  texture: TextureIntensity;
  generatedVisuals: GeneratedVisualsMode;
  /**
   * Voiceover zostáva master. Toto je **jediné** nastavenie o audiu a appka ho
   * nikdy sama neprepne na `false` — Style Studio audio nemenia.
   */
  preserveOriginalAudio: boolean;
}

export const DEFAULT_STYLE_CONTROLS: StyleControls = {
  intensity: "balanced",
  talkingHeadRatio: null,
  typography: "balanced",
  motion: "balanced",
  texture: "editorial",
  generatedVisuals: "suggested",
  preserveOriginalAudio: true,
};

/**
 * Je dostupný provider na generovanie vizuálov?
 *
 * Dnes **nie** (Reality Gate: image/video generation = NOT AVAILABLE). Kým sa to
 * nezmení, Style Studio nesmie ponúkať „Generate Video" ani sľubovať generované
 * prvky — `automatic` sa preto správa ako `suggested` a appka to napíše.
 */
export const GENERATED_VISUALS_PROVIDER_AVAILABLE = false;

/** Ľudské pomenovanie providera pre UI a poznámky. */
export const GENERATED_VISUALS_STATUS_SK = "PROVIDER UNAVAILABLE — generovanie vizuálov nie je dostupné (žiadny provider).";

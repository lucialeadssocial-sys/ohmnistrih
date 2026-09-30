/**
 * KROK 0c — JEDEN SLOVNÍK DIRECTORA (jedna hlava, nie tri)
 *
 * Prečo tento súbor existuje:
 * OmniStrih mal tri rozhodovacie cesty, ktoré o tom istom hovorili tromi
 * spôsobmi (audit v `docs/CREATIVE_DIRECTOR_INTELLIGENCE_REPORT.md`, D.3):
 *
 *   A) `src/core/ai/directorEngine.ts` → `generateDirectorPlan` (z `analysisResults`),
 *   B) `server.ts` → `POST /api/director/plan` (z textu prepisu),
 *   C) `src/ai/director/directorTools.ts` → tool-calling (mutácie projektu).
 *
 * Typ `DirectorPlanItem`, typ `DirectorActionType` a tabuľka `DIRECTOR_MODES`
 * boli **skopírované trikrát** (server.ts, `DirectorPlanPanel.tsx`, čiastočne
 * aj v engine). Každá kópia sa mohla pohnúť inam — a to je presne chyba, ktorá
 * sa v praxi prejaví tak, že panel zobrazí iné možnosti než server prijme.
 *
 * Tento modul je **jediný zdroj pravdy** pre slovník Directora. Nie je to nový
 * Director ani nová vrstva rozhodovania — je to spoločný jazyk, ktorý existujúce
 * cesty používajú. Rozhodovanie samo ostáva v `directorEngine` (klient)
 * a v `directorDecision` (spoločné pravidlá pre obe strany).
 *
 * CIEĽ vs. REŽIM: režim (mode) je len **odporúčaný** východiskový bod.
 * Skutočný cieľ videa (`VideoGoalId` z `src/core/style/videoGoal.ts`, krok 26)
 * určuje používateľ a **cieľ nikdy neurčuje štýl ani naopak**. Preto je
 * mapovanie `mode → goalId` označené ako `suggestedGoalId` (návrh, nie príkaz).
 */

import type { VideoGoalId } from "../style/videoGoal";

export type DirectorActionType =
  | "CUT" | "KEEP" | "SPEED" | "ZOOM" | "CROP"
  | "CAPTION" | "HOOK" | "HIGHLIGHT" | "BROLL" | "SFX" | "MUSIC";

export const DIRECTOR_ACTION_TYPES: DirectorActionType[] = [
  "CUT", "KEEP", "SPEED", "ZOOM", "CROP", "CAPTION", "HOOK", "HIGHLIGHT", "BROLL", "SFX", "MUSIC",
];

export function isDirectorActionType(value: string): value is DirectorActionType {
  return (DIRECTOR_ACTION_TYPES as string[]).includes(value);
}

/**
 * Odkiaľ zásah pochádza. Toto pole je dôvod, prečo panel nesmie tvrdiť viac,
 * než vie:
 *  • `analysis`   — z nameranej analýzy projektu (najsilnejší základ),
 *  • `transcript` — z konkrétnej vety prepisu (server má text, nie projekt),
 *  • `estimate`   — z odhadu bez prepisu (musí sa to priznať),
 *  • `ai`         — návrh od AI, ktorý **musí** prejsť schválením používateľa.
 */
export type DirectorBasis = "analysis" | "transcript" | "estimate" | "ai";

export interface DirectorPlanItem {
  id: string;
  type: DirectorActionType;
  start: number;
  end?: number;
  label: string;
  reason: string;
  lesson?: string;
  confidence: number;
  status: "proposed";
  /** Odkiaľ zásah pochádza: z analýzy, z vety prepisu, z odhadu, alebo od AI. */
  basis?: DirectorBasis;
  /** Vysvetlenie od Edit DNA, prečo sa zmenila istota (nikdy nie potichu). */
  dnaNote?: string;
  dnaDelta?: number;
}

export interface DirectorModeDefinition {
  labelSk: string;
  goalSk: string;
  /**
   * Odhad, koľko minút ručnej práce ušetrí jedna minúta surového videa.
   * **Je to odhad, nie meranie** — v UI musí byť takto označený.
   */
  minutesSavedPerRawMinute: number;
  /**
   * NÁVRH cieľa podľa režimu (krok 26 má 9 cieľov vo `videoGoal.ts`).
   * `null` = režim sám o sebe cieľ neurčuje; cieľ vyberá používateľ.
   * Toto pole NIKDY nesmie prepísať cieľ, ktorý si používateľ vybral.
   */
  suggestedGoalId: VideoGoalId | null;
}

/**
 * Režimy strihu. Predtým žili v `server.ts`; odteraz ich číta server AJ klient
 * z tohto jedného miesta (`DIRECTOR_MODES_SERVER` a panel si ich berú odtiaľto).
 */
export const DIRECTOR_MODES: Record<string, DirectorModeDefinition> = {
  SOCIAL: {
    labelSk: "Retention Short (Reels / TikTok / Shorts)",
    goalSk: "udržať pozornosť: silný hook, svižné tempo, dynamické titulky, punch-iny",
    minutesSavedPerRawMinute: 4.2,
    suggestedGoalId: "REACH",
  },
  ADS: {
    labelSk: "UGC / Reklama (performance)",
    goalSk: "konverzia: hook → problém → riešenie → dôkaz → CTA, viac variantov hooku",
    minutesSavedPerRawMinute: 3.8,
    suggestedGoalId: "PREDAJ",
  },
  PODCAST: {
    labelSk: "Podcast / Talking head",
    goalSk: "čistý prirodzený strih bez fillerov a zakopnutí, zachovať rytmus reči",
    minutesSavedPerRawMinute: 3.5,
    suggestedGoalId: "STORYTELLING",
  },
  YOUTUBE: {
    labelSk: "YouTube / Long-form",
    goalSk: "dlhodobá kontinuita, kapitoly, story štruktúra, žiadne agresívne skoky",
    minutesSavedPerRawMinute: 3.9,
    suggestedGoalId: "VZDELAVANIE",
  },
  CORPORATE: {
    labelSk: "Firemné / Brand video",
    goalSk: "čistý profesionálny dojem, konzistentný vizuál, dôveryhodnosť",
    minutesSavedPerRawMinute: 3.2,
    suggestedGoalId: "BRAND",
  },
  CUSTOM: {
    labelSk: "Vlastný štýl",
    goalSk: "rešpektovať poznámky používateľa",
    minutesSavedPerRawMinute: 3.5,
    suggestedGoalId: null,
  },
};

export type DirectorModeId = keyof typeof DIRECTOR_MODES;

/** Bezpečne prevedie hocijaký reťazec na známy režim (neznámy → CUSTOM). */
export function normalizeDirectorMode(value: unknown): DirectorModeId {
  const key = String(value ?? "").toUpperCase();
  return (key in DIRECTOR_MODES ? key : "CUSTOM") as DirectorModeId;
}

/**
 * Návrh cieľa z režimu. Slovenské vysvetlenie patrí do UI, aby používateľ videl,
 * že ide o **návrh** a že cieľ si určuje on (krok 26: 1 projekt = 1 cieľ).
 */
export function suggestedGoalForMode(mode: DirectorModeId): VideoGoalId | null {
  return DIRECTOR_MODES[mode]?.suggestedGoalId ?? null;
}

/**
 * Overí, že v pláne nie je typ zásahu, ktorý neexistuje. Vracia zoznam
 * problémov (prázdny = OK). Používajú to obe strany — klient aj server.
 */
export function planVocabularyIssues(items: Pick<DirectorPlanItem, "type">[]): string[] {
  const issues: string[] = [];
  items.forEach((item, index) => {
    if (!isDirectorActionType(String(item?.type ?? ""))) {
      issues.push(`Zásah ${index + 1}: neznámy typ „${String(item?.type ?? "")}“.`);
    }
  });
  return issues;
}

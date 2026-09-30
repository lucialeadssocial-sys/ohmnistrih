/**
 * STYLE STUDIO — „Nič nenechaj modelu na domyslenie" (krok 15).
 *
 * Zdroj (jeho vlastné slová, tiktok `7673961257115979030` — „Prečo práve 10:10?"):
 *   „Keď AI nepovieš, aké má byť svetlo, kompozícia, farby alebo celkový štýl, musí si to
 *    všetko nejako domyslieť. A väčšinou siahne po vzoroch, ktoré si s danou vecou spája
 *    najviac. … čím viac rozhodnutí necháš na AI, tým viac sa prikloní k tomu
 *    najpravdepodobnejšiemu. A to najpravdepodobnejšie býva často aj to najgenerickejšie."
 *
 * Preto appka pred odovzdaním plánu (či už do renderu, alebo do AI nástroja mimo appky)
 * povie pri každom zo **štyroch pilierov** (svetlo, kompozícia, farby, štýl):
 *
 *   - `user`        — rozhodol si ty (ovládač v Style Studiu),
 *   - `measurement` — je to zmerané z reálnej referencie (kroky 11–14),
 *   - `recipe`      — určuje to recept (autor receptu / jeho zverejnený workflow),
 *   - `app_default` — **nie je to nikde** → appka doplní neutrál a model by si to domyslel.
 *
 * Zámer:
 *  - **Žiadny nový model, žiadny nový engine.** Je to čistý audit existujúcich hodnôt
 *    (`StyleRecipe` + `StyleControls` + namerané dáta), bez `Date.now()` a bez náhody.
 *  - **Nič sa nedomýšľa.** Keď hodnota chýba, appka to napíše — nikdy nedoplní „nejaký
 *    štýl" ticho a nikdy netvrdí, že niečo zmerala, keď to nezmerala.
 *  - Toto nie je generovanie ani meranie: audit nič nemení, len pomenúva, čo je podložené.
 */

import type { StyleControls } from "./styleDecisionTypes";
import { DEFAULT_STYLE_CONTROLS } from "./styleDecisionTypes";
import type { StyleRecipe } from "./styleRecipes";
import { STYLE_RECIPES } from "./styleRecipes";

// ---------------------------------------------------------------------------
// Typy
// ---------------------------------------------------------------------------

/** Štyri piliere presne tak, ako ich pomenúva on: svetlo, kompozícia, farby, štýl. */
export const STYLE_PILLAR_IDS = ["svetlo", "kompozicia", "farby", "styl"] as const;

export type StylePillarId = (typeof STYLE_PILLAR_IDS)[number];

/** Odkiaľ je hodnota piliera. `app_default` = jediné, čo by si model domyslel. */
export type StylePillarOrigin = "user" | "measurement" | "recipe" | "app_default";

export interface StylePillarAudit {
  id: StylePillarId;
  labelSk: string;
  origin: StylePillarOrigin;
  /** Ľudsky: „tvoje nastavenie" / „meranie z tvojej referencie" / „recept" / „doplní appka". */
  originSk: string;
  /** Konkrétna hodnota, ktorá je v hre (nie fráza). */
  valueSk: string;
  /** Čo to znamená pre zadanie do AI nástroja. */
  noteSk: string;
}

/** Namerané svetlo z reálnej referencie (kroky 11–14). Čísla, nie dojem. */
export interface MeasuredLight {
  brightness: number;
  contrast: number;
  /** Odkiaľ tie čísla sú (napr. „analyza-videa.json, medián cez 6 videí"). */
  sourceSk: string;
}

export interface StyleExplicitnessInput {
  recipe: StyleRecipe | string;
  /** Ovládače používateľa (`null` v pomere = nechal to na engine). */
  controls?: Partial<StyleControls>;
  /** Namerané svetlo referencie — prepíše aj to, čo nesie recept. */
  measuredLight?: MeasuredLight;
  /** Namerané farby referencie (hex), napr. z `analyzeMoodboard` / `analyzeReferencePixels`. */
  measuredPalette?: string[];
  /** Poctivá poznámka k nameranej palete (napr. „neopakuje sa medzi klipmi"). */
  measuredPaletteNoteSk?: string;
  /** Pomer rečníka z existujúceho plánu (`StylePlan.ratio.target`) — informačne. */
  talkingHeadRatioFromPlan?: number | null;
}

export interface StyleExplicitnessReport {
  recipeId: string;
  recipeLabelSk: string;
  pillars: StylePillarAudit[];
  /** Koľko pilierov je podložených (user / measurement / recipe). */
  coveredCount: number;
  /** Koľko pilierov by si model domyslel (len `app_default`). */
  openCount: number;
  verdictSk: string;
  /** Piliere, ktoré by si model domyslel — jeho slovom „generický slop" ako riziko. */
  openToModelSk: string[];
  /** Čo appka doplní do svojho renderu (pomenované, nie ticho). */
  appFillsSk: string[];
  /** Ako to zavrieť — konkrétny krok, nie „zlepši prompt". */
  closeGapsSk: string[];
  /** Štruktúra rečník / podporné prvky: odkiaľ je to číslo (ty / engine / neurčené). */
  structureSk: string;
  /** Poctivé poznámky (napr. neznámy recept — nič sa nedeje ticho). */
  notesSk: string[];
}

// ---------------------------------------------------------------------------
// Etykety
// ---------------------------------------------------------------------------

const PILLAR_LABELS_SK: Record<StylePillarId, string> = {
  svetlo: "svetlo",
  kompozicia: "kompozícia",
  farby: "farby",
  styl: "celkový štýl",
};

const ORIGIN_LABELS_SK: Record<StylePillarOrigin, string> = {
  user: "tvoje nastavenie",
  measurement: "meranie z reálnej referencie",
  recipe: "recept (autor receptu)",
  app_default: "doplní appka (default)",
};

/** Ľudské meno piliera (pre UI aj text plánu). */
export function stylePillarLabelSk(id: StylePillarId): string {
  return PILLAR_LABELS_SK[id];
}

/** Ľudské meno pôvodu hodnoty. */
export function stylePillarOriginSk(origin: StylePillarOrigin): string {
  return ORIGIN_LABELS_SK[origin];
}

// ---------------------------------------------------------------------------
// Pomocníky
// ---------------------------------------------------------------------------

function recipeOf(recipe: StyleRecipe | string): { recipe: StyleRecipe; unknownId?: string } {
  if (typeof recipe !== "string") return { recipe };
  const found = (STYLE_RECIPES as Record<string, StyleRecipe | undefined>)[recipe];
  if (found) return { recipe: found };
  // Neznámy recept: appka to nesmie ticho prejsť na „nejaký" štýl — pomenuje to (viď `notesSk`).
  return { recipe: STYLE_RECIPES.EDITORIAL_COLLAGE, unknownId: recipe };
}

function num(n: number, digits = 1): string {
  return n.toFixed(digits).replace(".", ",");
}

function hexListSk(colors: string[], limit = 4): string {
  const first = colors.slice(0, limit).map((c) => c.toUpperCase());
  const rest = colors.length > limit ? ` + ${colors.length - limit} ďalšie` : "";
  return `${first.join(", ")}${rest}`;
}

/** Rozdiel v ovládačoch — používa sa pre pilier „celkový štýl" a pre jeho „zmena riadku v kóde". */
function controlDiffSk(
  before: Partial<StyleControls>,
  after: Partial<StyleControls>,
): string[] {
  const keys: (keyof StyleControls)[] = [
    "intensity",
    "talkingHeadRatio",
    "typography",
    "motion",
    "texture",
    "generatedVisuals",
    "preserveOriginalAudio",
  ];
  const labelsSk: Record<string, string> = {
    intensity: "Intensity",
    talkingHeadRatio: "Talking head pomer",
    typography: "Typography",
    motion: "Motion",
    texture: "Texture",
    generatedVisuals: "Generated visuals",
    preserveOriginalAudio: "Preserve Original Audio",
  };
  const out: string[] = [];
  for (const k of keys) {
    const a = before[k];
    const b = after[k];
    if (a === b) continue;
    out.push(`${labelsSk[k]}: ${String(a ?? "—")} → ${String(b ?? "—")}`);
  }
  return out;
}

/**
 * Je ovládač nastavený **inak** než default appky? (rovnaká hodnota nie je „tvoje" rozhodnutie,
 * preto ju appka nesmie vydávať za používateľovo nastavenie)
 */
function userSet<T extends keyof StyleControls>(controls: Partial<StyleControls>, key: T): boolean {
  const value = controls[key];
  if (value === undefined) return false;
  return value !== DEFAULT_STYLE_CONTROLS[key];
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

/** Svetlo: namerané (parameter) → namerané (recept) → default appky. */
function auditLight(
  recipe: StyleRecipe,
  input: StyleExplicitnessInput,
): StylePillarAudit {
  const measured = input.measuredLight ?? recipe.measuredLight;
  const hasMeasured = Boolean(measured && Number.isFinite(measured.brightness) && Number.isFinite(measured.contrast));
  if (hasMeasured && measured) {
    return {
      id: "svetlo",
      labelSk: PILLAR_LABELS_SK.svetlo,
      origin: "measurement",
      originSk: ORIGIN_LABELS_SK.measurement,
      valueSk: `jas ${num(measured.brightness)} / 100, kontrast ${num(measured.contrast)} / 100 (${measured.sourceSk})`,
      noteSk:
        "Svetlo máš zmerané z reálnej referencie — do zadania ho vieš dať ako číslo, model ho nemusí hádať.",
    };
  }
  return {
    id: "svetlo",
    labelSk: PILLAR_LABELS_SK.svetlo,
    origin: "app_default",
    originSk: ORIGIN_LABELS_SK.app_default,
    valueSk: "neutrálny základ appky (žiadny recept v ponuke svetlo neuvádza ako číslo)",
    noteSk:
      "Svetlo nie je ani v tvojom nastavení, ani v meraní, ani v recepte — appka doplní neutrál a pri generovaní by si svetlo domyslel model (jeho slovo: generický slop).",
  };
}

/** Kompozícia: určuje ju recept (a jej čísla sú v ňom). */
function auditComposition(recipe: StyleRecipe): StylePillarAudit {
  const c = recipe.composition;
  const cam = recipe.camera;
  const camSk = cam.punchIn
    ? `punch-in ×${num(cam.punchInScale, 2)}`
    : "bez punch-in";
  const whipSk =
    cam.whipPan === "none" ? "bez švihov" : `švihy: ${cam.whipPan === "occasional" ? "občas" : "často"}`;
  if (!c || !c.primary || !Array.isArray(c.allowed) || c.allowed.length === 0) {
    return {
      id: "kompozicia",
      labelSk: PILLAR_LABELS_SK.kompozicia,
      origin: "app_default",
      originSk: ORIGIN_LABELS_SK.app_default,
      valueSk: "recept kompozíciu neuvádza",
      noteSk: "Kompozícia nie je v recepte — appka doplní celú obrazovku a model by si ju domyslel.",
    };
  }
  return {
    id: "kompozicia",
    labelSk: PILLAR_LABELS_SK.kompozicia,
    origin: "recipe",
    originSk: ORIGIN_LABELS_SK.recipe,
    valueSk: `${c.primary}, max ${c.layersMax} vrstvy, ${camSk}, ${whipSk}`,
    noteSk:
      "Kompozíciu máš pomenovanú receptom — ponesieš ju do zadania, model ju nemusí hádať.",
  };
}

/** Farby: namerané (parameter) → paleta receptu → default appky. */
function auditColors(recipe: StyleRecipe, input: StyleExplicitnessInput): StylePillarAudit {
  const measured = (input.measuredPalette ?? []).filter((c) => typeof c === "string" && c.trim().length > 0);
  if (measured.length >= 2) {
    const note = input.measuredPaletteNoteSk ? ` ${input.measuredPaletteNoteSk}` : "";
    return {
      id: "farby",
      labelSk: PILLAR_LABELS_SK.farby,
      origin: "measurement",
      originSk: ORIGIN_LABELS_SK.measurement,
      valueSk: hexListSk(measured),
      noteSk: `Farby máš zmerané z reálnej referencie — dá sa nimi model nasmerovať presne.${note}`,
    };
  }
  if (Array.isArray(recipe.colorPalette) && recipe.colorPalette.length > 0) {
    return {
      id: "farby",
      labelSk: PILLAR_LABELS_SK.farby,
      origin: "recipe",
      originSk: ORIGIN_LABELS_SK.recipe,
      valueSk: hexListSk(recipe.colorPalette),
      noteSk: "Paletu nesie recept — model ju nemusí hádať.",
    };
  }
  return {
    id: "farby",
    labelSk: PILLAR_LABELS_SK.farby,
    origin: "app_default",
    originSk: ORIGIN_LABELS_SK.app_default,
    valueSk: "recept paletu neuvádza",
    noteSk: "Farby nie sú ani v tvojom nastavení, ani v meraní, ani v recepte — model by si ich domyslel.",
  };
}

/** Celkový štýl: tvoje nastavenie (ak sa líši od defaultu) → inak recept. */
function auditStyle(recipe: StyleRecipe, controls: Partial<StyleControls>): StylePillarAudit {
  const changed: string[] = [];
  if (userSet(controls, "texture")) changed.push(`Textúra: ${controls.texture}`);
  if (userSet(controls, "typography")) changed.push(`Typografia: ${controls.typography}`);
  if (userSet(controls, "motion")) changed.push(`Pohyb: ${controls.motion}`);
  if (userSet(controls, "intensity")) changed.push(`Intenzita: ${controls.intensity}`);
  if (changed.length > 0) {
    return {
      id: "styl",
      labelSk: PILLAR_LABELS_SK.styl,
      origin: "user",
      originSk: ORIGIN_LABELS_SK.user,
      valueSk: changed.join(", "),
      noteSk: "Celkový štýl si nastavil ty — je to tvoje rozhodnutie, nie náhoda ani odhad modelu.",
    };
  }
  const textureLevel = recipe.texture?.level ?? "—";
  const character = recipe.typography?.character ?? "—";
  return {
    id: "styl",
    labelSk: PILLAR_LABELS_SK.styl,
    origin: "recipe",
    originSk: ORIGIN_LABELS_SK.recipe,
    valueSk: `${recipe.aesthetic?.labelSk ?? recipe.labelSk}, textúra: ${textureLevel}, typografia: ${character}`,
    noteSk:
      "Celkový štýl určuje recept (a ty si ho nezmenil) — je pomenovaný, model si ho nemusí domýšľať.",
  };
}

/** Ako zavrieť konkrétny pilier — vždy konkrétny krok, nikdy „zlepši prompt". */
function closeGapSk(id: StylePillarId): string {
  switch (id) {
    case "svetlo":
      return "Svetlo: zmeraj referenciu (`analyzeReferencePixels` na obrázok alebo `analyzeMoodboard` na grid) a daj appke jas a kontrast ako čísla.";
    case "farby":
      return "Farby: dodaj referenčný obrázok alebo grid a použi nameranú paletu (alebo vyber recept, ktorý paletu nesie).";
    case "kompozicia":
      return "Kompozícia: vyber recept, ktorý ju má pomenovanú — dnes ju majú všetky recepty v ponuke.";
    case "styl":
      return "Celkový štýl: nastav si Texture / Typography / Motion podľa seba (nie podľa defaultu appky).";
  }
}

/**
 * Audit: ktoré zo štyroch pilierov máš podložené a ktoré by si model domyslel.
 * Deterministické — rovnaký vstup dá vždy rovnaký výstup.
 */
export function auditStyleExplicitness(input: StyleExplicitnessInput): StyleExplicitnessReport {
  const { recipe, unknownId } = recipeOf(input.recipe);
  const controls: Partial<StyleControls> = input.controls ?? {};
  const notesSk: string[] = [];
  if (unknownId) {
    notesSk.push(
      `Recept „${unknownId}" appka nepozná → audit bežal na základe EDITORIAL_COLLAGE a nič sa neskrýva.`,
    );
  }

  const pillars: StylePillarAudit[] = [
    auditLight(recipe, input),
    auditComposition(recipe),
    auditColors(recipe, input),
    auditStyle(recipe, controls),
  ];

  const open = pillars.filter((p) => p.origin === "app_default");
  const coveredCount = pillars.length - open.length;
  const openLabels = open.map((p) => p.labelSk);

  const verdictSk =
    open.length === 0
      ? "Všetky štyri piliere (svetlo, kompozícia, farby, štýl) máš podložené — model nemá čo domýšľať."
      : `Podložené ${coveredCount} zo 4 pilierov; ${open.length} by si domyslel model: ${openLabels.join(", ")}. ` +
        "Appka ich doplní ako default — výsledok teda nie je tichý, je pomenovaný.";

  const structureSk =
    typeof controls.talkingHeadRatio === "number" && input.talkingHeadRatioFromPlan !== undefined && input.talkingHeadRatioFromPlan !== null
      ? `Tvoje číslo: ${Math.round(controls.talkingHeadRatio * 100)} % rečník / ${Math.round((1 - controls.talkingHeadRatio) * 100)} % prvky.`
      : input.talkingHeadRatioFromPlan !== undefined && input.talkingHeadRatioFromPlan !== null
        ? `Nechal si to na engine: ${Math.round(input.talkingHeadRatioFromPlan * 100)} % rečník podľa analýzy viet (nie je to tvoje číslo a nie je to odhad modelu).`
        : "Pomer rečník / prvky nie je určený — appka ho vezme z receptu a analýzy, keď jej dáš titulky.";

  return {
    recipeId: recipe.id,
    recipeLabelSk: recipe.labelSk,
    pillars,
    coveredCount,
    openCount: open.length,
    verdictSk,
    openToModelSk: open.map((p) => `${p.labelSk} — ${p.valueSk}`),
    appFillsSk: open.map((p) => `${p.labelSk}: appka doplní default (${p.valueSk})`),
    closeGapsSk: open.map((p) => closeGapSk(p.id)),
    structureSk,
    notesSk,
  };
}

/**
 * Jeho druhá metóda (tiktok `7690550368333499650`): „…nemusíš všetko generovať nanovo ako
 * napr. pri videu, ale stačí, aby AI zmenilo riadok v kóde."
 *
 * V appke to znamená: zmena jedného ovládača = **jedna** zmena v pláne, nič iné sa nehýbe.
 * Táto funkcia to pomenuje (a testy overujú, že sa naozaj nič iné nemení).
 */
export function describeControlChangeSk(
  before: Partial<StyleControls>,
  after: Partial<StyleControls>,
): { changedSk: string[]; noteSk: string } {
  const changedSk = controlDiffSk(before, after);
  const noteSk =
    changedSk.length === 0
      ? "Nič sa nezmenilo — plán ostáva presne taký istý (deterministický výsledok)."
      : changedSk.length === 1
        ? `Zmenil si jednu vec (${changedSk[0]}). Ostatné nastavenia appka necháva tak, ako boli — nemusí sa nič generovať nanovo.`
        : `Zmenil si ${changedSk.length} veci (${changedSk.join("; ")}). Ostatné nastavenia ostávajú tak, ako boli.`;
  return { changedSk, noteSk };
}

/** Jedna veta do UI a do textu plánu (aby to nebolo len API, ktoré nikto nevidí). */
export function explicitnessLineSk(report: StyleExplicitnessReport): string {
  const measuredOrUser = report.pillars.filter((p) => p.origin === "measurement" || p.origin === "user").length;
  const fromRecipe = report.pillars.filter((p) => p.origin === "recipe").length;
  const openSk = report.openCount > 0 ? report.openToModelSk.map((s) => s.split(" — ")[0]).join(", ") : "nič";
  return (
    `Kontrola štýlu: podložené ${report.coveredCount}/4 (${measuredOrUser}× tvoje alebo zmerané, ${fromRecipe}× z receptu); ` +
    `modelu na domyslenie by ostalo: ${openSk}.`
  );
}

/** Mená pilierov v poradí, v akom ich pomenúva on (svetlo → kompozícia → farby → štýl). */
export const STYLE_PILLAR_ORDER_SK = STYLE_PILLAR_IDS.map((id) => PILLAR_LABELS_SK[id]);

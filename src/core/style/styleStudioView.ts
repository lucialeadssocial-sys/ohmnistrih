/**
 * STYLE STUDIO — view-model pre obrazovku (krok 4).
 *
 * Tenký, **čistý** prevod plánu na to, čo vidí človek (SK texty, čísla, poradie).
 * Zámerne tu nie je žiadna logika rozhodovania — tá je v `styleIntelligence.ts`.
 * Vďaka tomu sa dá obrazovka testovať bez prehliadača a bez AI.
 */

import type { EditDecision, EditDecisionType } from "../types/project";
import { getStyleRecipe, listStyleRecipes, type StylePresetId, type StyleRecipe } from "./styleRecipes";
import type { StyleDecisionKind, StyleControls, SupportingElementType } from "./styleDecisionTypes";
import { DEFAULT_STYLE_CONTROLS, GENERATED_VISUALS_PROVIDER_AVAILABLE } from "./styleDecisionTypes";
import type { StylePlan } from "./styleIntelligence";
import { elementLabelSk } from "./styleIntelligence";

// ---------------------------------------------------------------------------
// Čas a texty
// ---------------------------------------------------------------------------

/** `0:03.9` — krátke, čitateľné, nezaokrúhľuje „na sekundy“ (čas je reálny z dát). */
export function formatSecSk(sec: number): string {
  const safe = Number.isFinite(sec) && sec > 0 ? sec : 0;
  const m = Math.floor(safe / 60);
  const s = safe - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

export function formatRangeSk(startSec: number, endSec: number): string {
  const dur = Math.max(0, endSec - startSec);
  return `${formatSecSk(startSec)} – ${formatSecSk(endSec)} (${dur.toFixed(1)} s)`;
}

export interface BadgeView {
  labelSk: string;
  tone: "ok" | "warn" | "info" | "danger";
}

export interface KindVisual {
  labelSk: string;
  emoji: string;
  accentClass: string;
}

/** Druhy rozhodnutí — jedna vizuálna mapa pre celú obrazovku. */
export const STYLE_KIND_VISUALS: Record<StyleDecisionKind, KindVisual> = {
  talking_head: { labelSk: "Rečník", emoji: "🗣️", accentClass: "text-sky-300 border-sky-500/30 bg-sky-500/10" },
  supporting_visual: { labelSk: "Podporný vizuál", emoji: "🖼️", accentClass: "text-amber-300 border-amber-500/30 bg-amber-500/10" },
  typography: { labelSk: "Text v obraze", emoji: "🔤", accentClass: "text-fuchsia-300 border-fuchsia-500/30 bg-fuchsia-500/10" },
  motion: { labelSk: "Pohyb", emoji: "🎬", accentClass: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" },
  composition: { labelSk: "Kompozícia", emoji: "🧩", accentClass: "text-violet-300 border-violet-500/30 bg-violet-500/10" },
};

export function kindVisualFor(type: EditDecisionType): KindVisual {
  return (
    STYLE_KIND_VISUALS[type as StyleDecisionKind] ?? {
      labelSk: String(type),
      emoji: "•",
      accentClass: "text-neutral-300 border-neutral-700 bg-neutral-800/40",
    }
  );
}

// ---------------------------------------------------------------------------
// Recepty
// ---------------------------------------------------------------------------

export const TYPO_CHARACTER_LABEL_SK: Record<StyleRecipe["typography"]["character"], string> = {
  "bold-condensed": "tučné kondenzované",
  "bold-sans": "tučné bezpätkové",
  "serif-editorial": "editoriálny serif",
  "clean-sans": "čisté bezpätkové",
  mono: "monospace (technický look)",
};

export interface RecipeOptionView {
  id: StylePresetId;
  labelSk: string;
  purposeSk: string;
  ratioSk: string;
  /** Ľudské pomenovanie charakteru písma (nie kód). */
  characterSk: string;
  textureSk: string;
  /** Krátke „čo to znamená pre strih“ — aby sa dalo vybrať bez skúšania. */
  summarySk: string;
  recommendedForSk: string;
}

export function recipeOptionsSk(): RecipeOptionView[] {
  return listStyleRecipes().map((r) => ({
    id: r.id,
    labelSk: r.labelSk || r.name,
    purposeSk: r.purposeSk,
    ratioSk: `${Math.round(r.talkingHeadRatio * 100)} % rečník / ${Math.round(r.supportingVisualRatio * 100)} % vizuály`,
    characterSk: TYPO_CHARACTER_LABEL_SK[r.typography.character],
    textureSk: r.texture.level,
    summarySk: [
      r.animation.kind === "stop-motion" ? `stop-motion ${r.animation.fpsLook} fps` : `animácia: ${r.animation.kind}`,
      r.composition.primary.replace(/_/g, " "),
      r.typography.kinetic ? "text sa objavuje postupne" : "text bez animácie",
    ].join(" · "),
    recommendedForSk: r.requiresSk,
  }));
}

export function recipeOptionFor(id: StylePresetId): RecipeOptionView {
  return recipeOptionsSk().find((r) => r.id === id) ?? recipeOptionsSk()[0];
}

// ---------------------------------------------------------------------------
// Ovládače používateľa (povinné zo zadania)
// ---------------------------------------------------------------------------

export interface OptionView<T extends string = string> {
  value: T;
  labelSk: string;
  hintSk: string;
}

export interface SegmentedControlView {
  key: "intensity" | "typography" | "motion" | "texture" | "generatedVisuals";
  kind: "segmented";
  labelSk: string;
  hintSk: string;
  options: OptionView[];
}

export interface SliderControlView {
  key: "talkingHeadRatio";
  kind: "slider";
  labelSk: string;
  hintSk: string;
  min: number;
  max: number;
  step: number;
  /** `true` = rozhodne recept + analýza (odporúčané zadanie). */
  auto: boolean;
  autoLabelSk: string;
}

export interface ProtectedToggleView {
  key: "preserveOriginalAudio";
  kind: "protected";
  labelSk: string;
  hintSk: string;
  lockedSk: string;
}

export type StyleControlView = SegmentedControlView | SliderControlView | ProtectedToggleView;

export function controlViewsSk(): StyleControlView[] {
  return [
    {
      key: "intensity",
      kind: "segmented",
      labelSk: "Intenzita",
      hintSk: "Ako často má obraz meniť prvky. Nikdy to nie je „každé dve sekundy“ — viaže sa na vety a pauzy.",
      options: [
        { value: "subtle", labelSk: "Jemná", hintSk: "menej zásahov, dlhšie nechaný priestor rečníkovi" },
        { value: "balanced", labelSk: "Vyvážená", hintSk: "zodpovedá hustote reči a emócii" },
        { value: "aggressive", labelSk: "Výrazná", hintSk: "viac prvkov, vhodné pre krátke sociálne videá" },
      ],
    },
    {
      key: "talkingHeadRatio",
      kind: "slider",
      labelSk: "Rečník v obraze",
      hintSk: "Koľko času má ostať rečník bez prekrytia. Nechaj na „auto“, ak chceš, aby to určila reč.",
      min: 0.05,
      max: 0.95,
      step: 0.05,
      auto: true,
      autoLabelSk: "auto (podľa reči a receptu)",
    },
    {
      key: "typography",
      kind: "segmented",
      labelSk: "Typografia",
      hintSk: "Text v obraze sa vždy berie doslovne z vety — nikdy sa negeneruje.",
      options: [
        { value: "minimal", labelSk: "Minimálna", hintSk: "len veľké čísla a kľúčové slová" },
        { value: "balanced", labelSk: "Vyvážená", hintSk: "čísla, kľúčové slová, titulky" },
        { value: "strong", labelSk: "Výrazná", hintSk: "aj titulky a dôrazy, väčšie" },
      ],
    },
    {
      key: "motion",
      kind: "segmented",
      labelSk: "Pohyb",
      hintSk: "Pohyb kamery a vrstiev je naviazaný na začiatok nových myšlienok, nie na hodiny.",
      options: [
        { value: "calm", labelSk: "Pokojný", hintSk: "len veľmi jemné priblíženia" },
        { value: "balanced", labelSk: "Vyvážený", hintSk: "priblíženia na hook, švih pri nových celkoch" },
        { value: "dynamic", labelSk: "Dynamický", hintSk: "okrem pohybu kamery aj pohyb papierových vrstiev" },
      ],
    },
    {
      key: "texture",
      kind: "segmented",
      labelSk: "Textúra",
      hintSk: "Množstvo materiálovej stopy (papier, halftone, zrnitosť) v obraze.",
      options: [
        { value: "clean", labelSk: "Čistá", hintSk: "bez textúr" },
        { value: "editorial", labelSk: "Editoriálna", hintSk: "halftone a papier" },
        { value: "heavy", labelSk: "Výrazná", hintSk: "kolážová, novinová" },
      ],
    },
    {
      key: "generatedVisuals",
      kind: "segmented",
      labelSk: "Generované vizuály",
      hintSk: GENERATED_VISUALS_PROVIDER_AVAILABLE
        ? "Generované prvky sa použijú, keď to recept pripúšťa."
        : "Generovanie obrázkov/videa dnes nie je dostupné (žiadny provider) → navrhnem len existujúce médiá, text a pohyb.",
      options: [
        { value: "off", labelSk: "Vypnuté", hintSk: "nikdy nenavrhovať generované prvky" },
        { value: "suggested", labelSk: "Navrhnúť", hintSk: "v pláne označiť, kde by sa hodili (nikdy sa negeneruje automaticky)" },
        { value: "automatic", labelSk: "Automaticky", hintSk: "vyžaduje provider — dnes NEDOSTUPNÉ" },
      ],
    },
    {
      key: "preserveOriginalAudio",
      kind: "protected",
      labelSk: "Pôvodné audio (voiceover)",
      hintSk: "Style Studio zvuk nechytá. Hudba, hlas ani priestor sa nemenia.",
      lockedSk: "Vždy zapnuté — nedá sa vypnúť.",
    },
  ];
}

/** Riadok s aktuálnou hodnotou (aby obrazovka vedela ukázať stav bez parsovania). */
export function controlValueLabelSk(view: StyleControlView, controls: StyleControls): string {
  if (view.kind === "segmented") {
    const value = String(controls[view.key]);
    return view.options.find((o) => o.value === value)?.labelSk ?? value;
  }
  if (view.kind === "slider") {
    const value = controls.talkingHeadRatio;
    return value === null ? view.autoLabelSk : `${Math.round(value * 100)} % rečník`;
  }
  return controls.preserveOriginalAudio ? "Zapnuté (chránené)" : "Vypnuté — nepodporované";
}

// ---------------------------------------------------------------------------
// Plán → riadky pre obrazovku
// ---------------------------------------------------------------------------

export interface DecisionRowView {
  id: string;
  kind: StyleDecisionKind;
  kindLabelSk: string;
  kindEmoji: string;
  accentClass: string;
  whenLabelSk: string;
  startSec: number;
  endSec: number;
  whatSk: string;
  whySk: string;
  whenNotSk: string;
  alternativeSk: string;
  confidencePct: number;
  confidenceLabelSk: string;
  confidenceTone: BadgeView["tone"];
  evidenceSk: string[];
  signalsSk: string[];
  targetLabelSk: string;
  textSk: string | null;
  statusSk: string;
  statusTone: BadgeView["tone"];
}

export type DecisionStatus = EditDecision["status"];

export function statusViewSk(status: DecisionStatus): { labelSk: string; tone: BadgeView["tone"] } {
  switch (status) {
    case "accepted":
      return { labelSk: "Súhlasím (ešte neaplikované)", tone: "ok" };
    case "rejected":
      return { labelSk: "Zamietnuté", tone: "danger" };
    case "applied":
      return { labelSk: "Aplikované", tone: "ok" };
    default:
      return { labelSk: "Návrh", tone: "info" };
  }
}

export function confidenceViewSk(confidence: number): { pct: number; labelSk: string; tone: BadgeView["tone"] } {
  const pct = Math.round(confidence * 100);
  if (pct >= 75) return { pct, labelSk: `vysoká (${pct} %)`, tone: "ok" };
  if (pct >= 55) return { pct, labelSk: `stredná (${pct} %)`, tone: "info" };
  return { pct, labelSk: `nižšia (${pct} %)`, tone: "warn" };
}

export function targetLabelSk(decision: EditDecision): string {
  const payload = (decision.actionPayload ?? {}) as Record<string, unknown>;
  const target = payload.targetTrackType;
  const element = payload.elementType as SupportingElementType | undefined;
  if (element) return `${elementLabelSk(element)} → track „${String(target ?? "b-roll")}“`;
  if (target === "video") return "video track (rečník)";
  if (target === "caption") return "titulky";
  const motion = payload.motion;
  if (motion) return `pohyb: ${String(motion)}`;
  const role = payload.typographyRole;
  if (role) return `text: ${String(role)}`;
  const composition = payload.composition;
  if (composition) return `kompozícia: ${String(composition).replace(/_/g, " ")}`;
  return "bez zmeny videa (poznámka)";
}

/**
 * Prevod rozhodnutí na riadky. `marks` prepíše stav (len v obrazovke — **uloží sa
 * až v kroku 5–6**, preto to obrazovka aj takto pomenúva).
 */
export function decisionRowsSk(plan: StylePlan, marks: Record<string, DecisionStatus> = {}): DecisionRowView[] {
  return plan.decisions.map((d) => {
    const detail = d.style;
    const kind = (detail?.kind ?? "supporting_visual") as StyleDecisionKind;
    const visual = STYLE_KIND_VISUALS[kind];
    const status = marks[d.id] ?? d.status;
    const conf = confidenceViewSk(detail?.confidence ?? 0.5);
    const text = (d.actionPayload as Record<string, unknown> | undefined)?.typographyText;
    return {
      id: d.id,
      kind,
      kindLabelSk: visual.labelSk,
      kindEmoji: visual.emoji,
      accentClass: visual.accentClass,
      whenLabelSk: formatRangeSk(detail?.whenSk.startSec ?? 0, detail?.whenSk.endSec ?? 0),
      startSec: detail?.whenSk.startSec ?? 0,
      endSec: detail?.whenSk.endSec ?? 0,
      whatSk: detail?.whatSk ?? d.reason,
      whySk: detail?.whySk ?? d.reason,
      whenNotSk: detail?.whenNotSk ?? "",
      alternativeSk: detail?.alternativeSk ?? d.alternatives?.[0] ?? "",
      confidencePct: conf.pct,
      confidenceLabelSk: conf.labelSk,
      confidenceTone: conf.tone,
      evidenceSk: detail?.evidenceSk ?? [],
      signalsSk: detail?.signals ?? [],
      targetLabelSk: targetLabelSk(d),
      textSk: typeof text === "string" ? text : null,
      statusSk: statusViewSk(status).labelSk,
      statusTone: statusViewSk(status).tone,
    };
  });
}

export interface ConsideredRowView {
  emoji: string;
  kindLabelSk: string;
  whenLabelSk: string;
  reasonSk: string;
  scoreLabelSk: string;
}

export function consideredRowsSk(plan: StylePlan): ConsideredRowView[] {
  return plan.considered.map((c) => {
    const visual = STYLE_KIND_VISUALS[c.kind];
    return {
      emoji: visual.emoji,
      kindLabelSk: visual.labelSk,
      whenLabelSk: formatSecSk(c.atSec),
      reasonSk: c.reasonSk,
      scoreLabelSk: c.score.toFixed(2),
    };
  });
}

export interface PlanTotalsRow {
  labelSk: string;
  valueSk: string;
}

export function planTotalsSk(plan: StylePlan): PlanTotalsRow[] {
  const byKind = new Map<string, number>();
  for (const d of plan.decisions) {
    const kind = d.style?.kind ?? "supporting_visual";
    byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
  }
  const kindRows = [...byKind.entries()]
    .map(([k, v]) => `${STYLE_KIND_VISUALS[k as StyleDecisionKind]?.labelSk ?? k}: ${v}`)
    .join(" · ");

  const totalTargetSec = plan.decisions
    .filter((d) => d.style?.kind === "supporting_visual")
    .reduce((sum, d) => sum + ((d.style?.whenSk.endSec ?? 0) - (d.style?.whenSk.startSec ?? 0)), 0);

  return [
    { labelSk: "Rozhodnutí", valueSk: String(plan.decisions.length) },
    { labelSk: "Podľa druhu", valueSk: kindRows || "—" },
    { labelSk: "Podporný vizuál v obraze", valueSk: `${totalTargetSec.toFixed(1)} s` },
    { labelSk: "Vety v prepise", valueSk: String(plan.basis.sentenceCount) },
    { labelSk: "Slová s časovaním", valueSk: String(plan.basis.wordCount) },
    { labelSk: "Presnosť časov", valueSk: plan.basis.timingPrecision === "words" ? "po slovách (najlepšia)" : "len na úrovni viet" },
    { labelSk: "Zvážené a nevybrané", valueSk: String(plan.considered.length) },
  ];
}

export function planBadgesSk(plan: StylePlan, marks: Record<string, DecisionStatus> = {}): BadgeView[] {
  const accepted = plan.decisions.filter((d) => (marks[d.id] ?? d.status) === "accepted").length;
  const rejected = plan.decisions.filter((d) => (marks[d.id] ?? d.status) === "rejected").length;
  return [
    { labelSk: "NÁVRH — NEAPLIKOVANÉ", tone: "warn" },
    { labelSk: `Recept: ${plan.recipeLabelSk || plan.recipeName}`, tone: "info" },
    { labelSk: `Rečník ${Math.round(plan.ratio.target * 100)} %`, tone: "info" },
    { labelSk: `Zdroje: ${plan.basis.usedSignalsSk.join(", ") || "—"}`, tone: "info" },
    { labelSk: plan.provider === "NONE" ? "Bez AI (deterministické)" : `Provider: ${plan.provider}`, tone: plan.provider === "NONE" ? "ok" : "warn" },
    ...(accepted > 0 ? [{ labelSk: `Označené na súhlas: ${accepted}`, tone: "ok" as const }] : []),
    ...(rejected > 0 ? [{ labelSk: `Zamietnuté: ${rejected}`, tone: "danger" as const }] : []),
    ...(GENERATED_VISUALS_PROVIDER_AVAILABLE ? [] : [{ labelSk: "Generované vizuály: PROVIDER UNAVAILABLE", tone: "warn" as const }]),
  ];
}

export function ratioExplanationSk(plan: StylePlan): { headlineSk: string; linesSk: string[] } {
  const lines = [...plan.ratio.adjustmentsSk];
  if (lines.length === 0) {
    lines.push(
      `Reč si nevyžiadala žiadnu úpravu — ostávam na odporúčaní receptu (${Math.round(plan.ratio.base * 100)} % rečník).`,
    );
  }
  return {
    headlineSk: `Rečník v obraze: ${Math.round(plan.ratio.target * 100)} % (recept odporúča ${Math.round(plan.ratio.base * 100)} %)`,
    linesSk: lines,
  };
}

// ---------------------------------------------------------------------------
// Brány a poctivosť
// ---------------------------------------------------------------------------

export interface TranscriptGate {
  ready: boolean;
  titleSk: string;
  bodySk: string;
  actionSk: string | null;
}

/**
 * Obrazovka nesmie tvrdiť, že niečo vie, keď nemá dáta.
 * Preto je „brána“ prvý obal, ktorý človek vidí.
 */
export function transcriptGateSk(segmentCount: number, wordCount: number, hasVideo: boolean): TranscriptGate {
  if (segmentCount === 0) {
    return {
      ready: false,
      titleSk: "Na čo sa pozerám: potrebujem prepis (titulky)",
      bodySk: hasVideo
        ? "Style Studio rozhoduje z reči — z viet, ich časov, hustoty a pauzy. Video mám, ale prepis (titulky s časmi) zatiaľ nemáš, preto nerobím ani jedno rozhodnutie. Radšej nič než vymyslené rozhodnutia."
        : "Style Studio zatiaľ nemá video ani prepis. Nahraj video a vygeneruj titulky — potom tu uvidíš konkrétne návrhy s časmi a dôvodmi.",
      actionSk: "Prejsť na titulky (Kinetické Titulky V2)",
    };
  }
  if (wordCount === 0) {
    return {
      ready: true,
      titleSk: "Mám vety, ale bez časovania po slovách",
      bodySk: "Rozhodnutia budú na úrovni viet (bez zvýrazňovania jednotlivých slov). Presnejšie to bude, keď titulky prídu s časmi slov.",
      actionSk: null,
    };
  }
  return {
    ready: true,
    titleSk: "Mám reálny prepis s časovaním po slovách",
    bodySk: "Rozhodujem z viet, hustoty reči, čísel, silných slov, zmien myšlienky a pauzy. Zdroj zvuku sa nemení.",
    actionSk: null,
  };
}

/**
 * Signály, ktoré appka **nemá** — obrazovka to musí povedať ešte pred výpočtom,
 * aby človek nečakal rozhodnutia, ktoré engine nemôže spraviť.
 */
export function unavailableSignalsSk(): string[] {
  return [
    "zmena rečníka (diarizácia sa nerobí) — rečníka ako postavu nerozlišujem",
    "hranice záberov / scén (scene detection neexistuje)",
    "analýza referenčného obrázka (chýba pixelová analýza) — PROVIDER / ANALYSIS UNAVAILABLE",
  ];
}

/**
 * Jedna veta, ktorá musí byť viditeľná vždy: plán sa **sám** neaplikuje.
 * Apply existuje (krok 5–6), ale spustí ho len človek — a vždy so snapshotom.
 */
export function applyNoticeSk(): string {
  return "Toto je plán, nie zmenený projekt. Kým v sekcii „4. Aplikovať“ nepotvrdíš súhlas a neklikneš na Aplikovať, nič sa nezmení. Až vtedy vznikne verzia projektu (snapshot) a zmeny idú cez existujúci CommandManager — a dajú sa vrátiť (rollback aj Undo).";
}

/** Sekcia apply sa v appke správa takto — text pre človeka. */
export function applySectionNoticeSk(wired: boolean): string {
  return wired
    ? "Apply zapisuje do projektu len cez existujúce príkazy: pridať klip (text/vizuál z tvojich médií), zmeniť transformáciu (priblíženie), pridať marker a zapísať rozhodnutie. Žiadny druhý command systém ani render path nevzniká."
    : "Apply nie je v tomto náhľade pripojený — preto nič neaplikujem. V appke je napojený na existujúci CommandManager.";
}

export function marksNoticeSk(): string {
  return "Označenie „Súhlasím“/„Zamietnuté“ je zatiaľ len na obrazovke (pomáha ti prejsť návrh). Do projektu sa zapíše až v kroku 5–6.";
}

export function generatedVisualsNoticeSk(): string {
  return GENERATED_VISUALS_PROVIDER_AVAILABLE
    ? "Generované vizuály: provider je dostupný."
    : "Generované vizuály: PROVIDER UNAVAILABLE — appka nič negeneruje a nikde to nepredstiera.";
}

export function missingDataNoticeSk(plan: StylePlan): string | null {
  if (plan.basis.missingSignalsSk.length === 0) return null;
  return `Rozhodnutia podľa týchto dát NEROBÍM (nemám ich): ${plan.basis.missingSignalsSk.join("; ")}.`;
}

export function supportingMediaNoticeSk(availableSupportingVisuals: number | undefined): string {
  if (availableSupportingVisuals === undefined) {
    return "Neviem, koľko podporných médií máš v projekte — počítam s tým, že nejaké máš.";
  }
  if (availableSupportingVisuals === 0) {
    return "V projekte nemáš žiadne podporné médiá → navrhujem len text a pohyb (a rečníka nezakrývam).";
  }
  return `Podporné médiá v projekte: ${availableSupportingVisuals} → vizuály staviam z tvojich existujúcich médií.`;
}

/** Plán ako obyčajný text — na skopírovanie/pomer s klientom (žiadny export „do videa“). */
export function planAsTextSk(plan: StylePlan): string {
  const lines: string[] = [];
  lines.push(`STYLE PLAN — ${plan.recipeLabelSk || plan.recipeName} (${plan.recipeId})`);
  lines.push(`Rozhodnutí: ${plan.decisions.length} | rečník ${Math.round(plan.ratio.target * 100)} % | zdroje: ${plan.basis.usedSignalsSk.join(", ")}`);
  lines.push(`Audio: ${plan.audioPolicy} (pôvodný zvuk sa nemení) | provider: ${plan.provider}`);
  lines.push("");
  for (const d of plan.decisions) {
    const st = d.style;
    if (!st) continue;
    lines.push(`• [${STYLE_KIND_VISUALS[st.kind]?.labelSk ?? st.kind}] ${formatRangeSk(st.whenSk.startSec, st.whenSk.endSec)}`);
    lines.push(`   ČO: ${st.whatSk}`);
    lines.push(`   PREČO: ${st.whySk}`);
    lines.push(`   KEDY NIE: ${st.whenNotSk}`);
    lines.push(`   ALTERNATÍVA: ${st.alternativeSk}`);
    lines.push(`   ISTOTA: ${Math.round(st.confidence * 100)} % | dôkazy: ${st.evidenceSk.join("; ")}`);
  }
  if (plan.considered.length) {
    lines.push("");
    lines.push("ZVÁŽENÉ A NEVYBRANÉ:");
    for (const c of plan.considered) lines.push(`• (veta ${c.sentenceIndex + 1}, skóre ${c.score.toFixed(2)}) ${c.reasonSk}`);
  }
  lines.push("");
  lines.push("POZNÁMKY:");
  for (const n of plan.notesSk) lines.push(`• ${n}`);
  lines.push("");
  lines.push(applyNoticeSk());
  return lines.join("\n");
}

/** Koľko rozhodnutí je v pláne podľa druhu — pre filtre v obrazovke. */
export function kindFilterRowsSk(plan: StylePlan): { kind: StyleDecisionKind; labelSk: string; emoji: string; count: number }[] {
  const rows: { kind: StyleDecisionKind; labelSk: string; emoji: string; count: number }[] = [];
  for (const kind of Object.keys(STYLE_KIND_VISUALS) as StyleDecisionKind[]) {
    const count = plan.decisions.filter((d) => (d.style?.kind ?? "supporting_visual") === kind).length;
    if (count > 0) rows.push({ kind, labelSk: STYLE_KIND_VISUALS[kind].labelSk, emoji: STYLE_KIND_VISUALS[kind].emoji, count });
  }
  return rows;
}

/** Text pre prázdny plán — aby prázdno nikdy nevyzeralo ako chyba. */
export function emptyPlanMessageSk(plan: StylePlan | null): string | null {
  if (!plan) return null;
  if (plan.decisions.length > 0) return null;
  return "Plán vyšiel prázdny. Dôvod je v poznámkach vyššie — najčastejšie chýbajúci prepis alebo to, že reč neobsahuje signály, z ktorých rozhodujem.";
}

export { DEFAULT_STYLE_CONTROLS, getStyleRecipe };

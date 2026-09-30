/**
 * STYLE RECIPES — 13 vizuálnych receptov (krok 1 Reality Gate).
 *
 * `StyleRecipe` je **ľahký dátový objekt**. Neurčuje timeline, projekt ani render —
 * hovorí existujúcemu Directorovi/editoru, **AKO** má navrhovať vizuálnu úpravu.
 *
 * Zásady:
 *  - Žiadny nový timeline/projekt model — recept je len slovník vizuálneho jazyka.
 *  - Žiadny paralelný Director — recept je vstup, rozhodnutia robí existujúci
 *    `DirectorEngine` (Style Mode) cez `styleIntelligence.ts`.
 *  - `captionStyle` sa **napája na existujúcich 9 štýlov titulkov** (`CaptionStyleId`),
 *    aby v projekte nevznikol druhý katalóg titulkov.
 *  - Recept nikdy nehovorí o audiu. Voiceover zostáva master (rieši `StyleControls`).
 */

import type { CaptionStyleId } from "../export/subtitleRender";
import type {
  CompositionKind,
  MotionKind,
  SupportingElementType,
  TypographyRole,
} from "./styleDecisionTypes";

// ---------------------------------------------------------------------------
// Recept
// ---------------------------------------------------------------------------

export type StylePresetId =
  | "EDITORIAL_COLLAGE"
  | "DOCUMENTARY"
  | "MODERN_SOCIAL"
  | "DARK_EDITORIAL"
  | "KINETIC_TYPOGRAPHY"
  | "MINIMAL"
  | "CINEMATIC"
  | "PODCAST_VISUAL"
  | "UGC_PERFORMANCE"
  // Recepty odvodené z REÁLNYCH referenčných klipov (merané, nie vymyslené) —
  // viď docs/STYLE_STUDIO_REFERENCE_ANALYSIS.md.
  | "AI_CARD_DEMO"
  | "FILM_MONTAGE"
  | "EXPERT_COLLAGE_TALK"
  | "AI_CINEMATIC_TAKE"
  | "EDU_WORD_TALK"
  | "CUSTOM";

export interface StyleAnimationSpec {
  kind: "stop-motion" | "snappy" | "smooth" | "none";
  /** Dojem snímkovej frekvencie (12 = stop-motion). `null` = podľa videa. */
  fpsLook: number | null;
  /** `false` = zámerne bez umelého rozmazania (tactile look). */
  motionBlur: boolean;
  easingSk: string;
}

export interface StyleTypographySpec {
  character: "bold-condensed" | "bold-sans" | "serif-editorial" | "clean-sans" | "mono";
  /** Postupné „pop-in" jednotlivých textových elementov. */
  kinetic: boolean;
  /** Rozostup medzi elementmi (ms) — postupné objavovanie, nie naraz. */
  staggerMs: number;
  /** Náznak veľkosti (100 = základ receptu). */
  scaleHint: number;
  uppercase: boolean;
  /** Koľko textových elementov naraz (aby obraz nebol preplnený). */
  maxElementsPerScene: number;
  roles: TypographyRole[];
}

export interface StyleCameraSpec {
  punchIn: boolean;
  punchInScale: number;
  fastZoom: boolean;
  whipPan: "none" | "occasional" | "frequent";
}

export interface StyleMovementSpec {
  paperCutout: boolean;
  layering: boolean;
  subtleZoom: boolean;
  depthLayers: number;
  noteSk: string;
}

export interface StyleAestheticSpec {
  labelSk: string;
  elementPool: SupportingElementType[];
  halftone: boolean;
  visibleShadows: boolean;
  tornEdges: boolean;
  asymmetric: boolean;
  illustrationBodies: boolean;
}

export interface StyleCompositionSpec {
  primary: CompositionKind;
  allowed: CompositionKind[];
  layersMax: number;
}

export interface StyleTextureSpec {
  level: "clean" | "subtle" | "editorial" | "heavy";
  kinds: string[];
}

export interface StyleVisualStructureSpec {
  /** Referenčný workflow: prvky sa objavujú **jeden po druhom**, nie naraz. */
  elementAnimation: "sequential" | "together";
  /** `false` = neprechádzať celými panelmi, animovať jednotlivé prvky. */
  transitionsBetweenPanels: boolean;
  /**
   * Predvolený podiel rečníka (0–1) — dopĺňa ho `makeRecipe` z receptu, aby sa
   * pomery nemohli rozísť. Director ho podľa obsahu upraví (nikdy nie napevno).
   */
  talkingHeadRatio: number;
  supportingVisualRatio: number;
}

export interface StyleTransitionSpec {
  base: "cut" | "whip_pan" | "dissolve";
  accent: "whip_pan" | "punch" | "none";
  noteSk: string;
}

export interface StyleRecipe {
  id: StylePresetId;
  name: string;
  labelSk: string;
  /** Na čo je recept dobrý — jednou vetou. */
  purposeSk: string;
  /** Prečo to funguje (princíp, nie sľub virálnosti). */
  whySk: string;
  animation: StyleAnimationSpec;
  typography: StyleTypographySpec;
  camera: StyleCameraSpec;
  movement: StyleMovementSpec;
  aesthetic: StyleAestheticSpec;
  colorPalette: string[];
  composition: StyleCompositionSpec;
  texture: StyleTextureSpec;
  visualStructure: StyleVisualStructureSpec;
  captionStyle: { styleId: CaptionStyleId; rationaleSk: string };
  transitionStyle: StyleTransitionSpec;
  talkingHeadRatio: number;
  supportingVisualRatio: number;
  /** Pohyby, ktoré recept pripúšťa (neskôr ich vyberá Director podľa obsahu). */
  motionPool: MotionKind[];
  /**
   * **Namerané svetlo** (krok 15) — iba ak recept stojí na reálnom meraní videa.
   * Sú to čísla z `referencie/analyza-*.json`, nie odhad: bez nich by svetlo
   * ostalo na domyslenie modelu (jeho pravidlo: „keď AI nepovieš, aké má byť
   * svetlo… musí si to domyslieť").
   */
  measuredLight?: {
    brightness: number;
    contrast: number;
    /** Konkrétny zdroj čísel (súbor + čo je to za číslo). */
    sourceSk: string;
  };
  /** Recept sám priznáva, že bez dát sa nič nevymýšľa. */
  requiresSk: string;
}

// ---------------------------------------------------------------------------
// recepty
// ---------------------------------------------------------------------------

/**
 * Pomocník: recept musí mať **konzistentné pomery** (súčet 1). Keď sa to raz
 * pokazí, celá logika pomerov prestane dávať zmysel — preto sa to kontroluje
 * hneď pri vzniku a v testoch.
 */
type RecipeInput = Omit<StyleRecipe, "talkingHeadRatio" | "supportingVisualRatio" | "visualStructure"> & {
  talkingHeadRatio: number;
  visualStructure: Pick<StyleVisualStructureSpec, "elementAnimation" | "transitionsBetweenPanels">;
};

function makeRecipe(r: RecipeInput): StyleRecipe {
  const talking = Math.min(0.95, Math.max(0.05, r.talkingHeadRatio));
  return {
    ...r,
    talkingHeadRatio: Math.round(talking * 1000) / 1000,
    supportingVisualRatio: Math.round((1 - talking) * 1000) / 1000,
    visualStructure: {
      ...r.visualStructure,
      talkingHeadRatio: Math.round(talking * 1000) / 1000,
      supportingVisualRatio: Math.round((1 - talking) * 1000) / 1000,
    },
  };
}

/**
 * **EDITORIAL COLLAGE** — prvý reálny preset, podľa referenčného workflow
 * (stop-motion 12 fps bez rozmazania, kinetická typografia, punch-in / švih,
 * papierové vrstvy, halftone, polaroidy, asymetria, 30 % rečník / 70 % prvky).
 */
const EDITORIAL_COLLAGE: StyleRecipe = makeRecipe({
  id: "EDITORIAL_COLLAGE",
  name: "Editorial Collage",
  labelSk: "Editoriálna koláž",
  purposeSk: "Rozprávané video premení na koláž papiera, výstrižkov a textu, ktorá drží pozornosť bez zvuku.",
  whySk:
    "Kombinuje pohyb (stop-motion dojem), text a novinové textúry — obraz sa mení, aj keď rečník hovorí stále; divák má stále nový podnet, ale rečník zostáva hlavný.",
  animation: { kind: "stop-motion", fpsLook: 12, motionBlur: false, easingSk: "krokové, ale plynulé — žiadne rozmazanie" },
  typography: {
    character: "bold-condensed",
    kinetic: true,
    staggerMs: 140,
    scaleHint: 112,
    uppercase: true,
    maxElementsPerScene: 3,
    roles: ["keyword", "headline", "label", "statistic", "quote"],
  },
  camera: { punchIn: true, punchInScale: 1.12, fastZoom: true, whipPan: "occasional" },
  movement: {
    paperCutout: true,
    layering: true,
    subtleZoom: true,
    depthLayers: 3,
    noteSk: "papierové vrstvy s viditeľnými tieňmi, jemné priblíženie/oddialenie",
  },
  aesthetic: {
    labelSk: "zmiešané médium — papier, noviny, halftone, polaroid",
    elementPool: ["paper_element", "photo", "illustration", "diagram", "map", "icon"],
    halftone: true,
    visibleShadows: true,
    tornEdges: true,
    asymmetric: true,
    illustrationBodies: true,
  },
  colorPalette: ["#F3EFE7", "#111111", "#C8402F", "#D9A441"],
  composition: {
    primary: "layered_collage",
    allowed: ["layered_collage", "asymmetric", "split", "full_screen", "picture_in_picture"],
    layersMax: 4,
  },
  texture: { level: "heavy", kinds: ["papier", "noviny", "halftone", "zrnitosť"] },
  visualStructure: { elementAnimation: "sequential", transitionsBetweenPanels: false },
  captionStyle: {
    styleId: "HORMOZI",
    rationaleSk: "Koláž je hustá — titulky musia byť krátke a veľké, aby sa nestratili medzi prvkami.",
  },
  transitionStyle: {
    base: "whip_pan",
    accent: "punch",
    noteSk: "Švih len na hranici novej myšlienky, nie na každej vete.",
  },
  talkingHeadRatio: 0.3,
  motionPool: ["pop", "paper_movement", "subtle_zoom", "punch", "whip_transition"],
  requiresSk: "Potrebuje prepis s časovaním (ideálne po slovách) — bez neho viem len veľmi málo a poviem to.",
});

const DOCUMENTARY: StyleRecipe = makeRecipe({
  id: "DOCUMENTARY",
  name: "Documentary",
  labelSk: "Dokumentárny",
  purposeSk: "Vážna výpoveď, kde obraz nesmie prekričať obsah — pokojné, dôveryhodné, bez efektov navyše.",
  whySk: "Titulky a vizuály sa objavujú málo a pomaly, aby divák vnímal, čo človek hovorí — nie čo robí grafika.",
  animation: { kind: "smooth", fpsLook: null, motionBlur: false, easingSk: "plynulé, pokojné" },
  typography: {
    character: "serif-editorial",
    kinetic: false,
    staggerMs: 260,
    scaleHint: 92,
    uppercase: false,
    maxElementsPerScene: 2,
    roles: ["label", "quote", "statistic"],
  },
  camera: { punchIn: false, punchInScale: 1.06, fastZoom: false, whipPan: "none" },
  movement: { paperCutout: false, layering: false, subtleZoom: true, depthLayers: 1, noteSk: "len veľmi jemné priblíženie" },
  aesthetic: {
    labelSk: "fotografia a archívne materiály",
    elementPool: ["photo", "map", "diagram", "existing_media"],
    halftone: false,
    visibleShadows: false,
    tornEdges: false,
    asymmetric: false,
    illustrationBodies: false,
  },
  colorPalette: ["#0F1113", "#E8E6E1", "#7A8B99"],
  composition: { primary: "full_screen", allowed: ["full_screen", "split", "picture_in_picture"], layersMax: 2 },
  texture: { level: "clean", kinds: ["jemná zrnitosť"] },
  visualStructure: { elementAnimation: "together", transitionsBetweenPanels: true },
  captionStyle: { styleId: "CLEAN", rationaleSk: "Celá veta, pokojne — pri dokumente ide o čitateľnosť a kontext." },
  transitionStyle: { base: "dissolve", accent: "none", noteSk: "Prechody len tam, kde sa mení kapitola." },
  talkingHeadRatio: 0.8,
  motionPool: ["subtle_zoom"],
  requiresSk: "Vety a pauzy stačia; časovanie po slovách zlepší presnosť titulkov.",
});

const MODERN_SOCIAL: StyleRecipe = makeRecipe({
  id: "MODERN_SOCIAL",
  name: "Modern Social",
  labelSk: "Moderný social",
  purposeSk: "Súčasný krátky formát: čistý obraz, výrazný text a rytmus, ktorý znesie aj rýchle tempo.",
  whySk: "Strieda rečníka s textom a krátkymi vizuálmi — obraz sa hýbe, ale nepreplní sa.",
  animation: { kind: "snappy", fpsLook: null, motionBlur: false, easingSk: "rýchle nábehy, krátke" },
  typography: {
    character: "bold-sans",
    kinetic: true,
    staggerMs: 120,
    scaleHint: 106,
    uppercase: false,
    maxElementsPerScene: 3,
    roles: ["keyword", "headline", "label", "statistic"],
  },
  camera: { punchIn: true, punchInScale: 1.1, fastZoom: true, whipPan: "occasional" },
  movement: { paperCutout: false, layering: true, subtleZoom: true, depthLayers: 2, noteSk: "vrstvy bez papiera, jemné priblíženia" },
  aesthetic: {
    labelSk: "moderné UI prvky a fotografie",
    elementPool: ["photo", "icon", "diagram", "existing_media", "illustration"],
    halftone: false,
    visibleShadows: true,
    tornEdges: false,
    asymmetric: true,
    illustrationBodies: false,
  },
  colorPalette: ["#0B0B0C", "#FFFFFF", "#FF5A1F", "#1D9BF0"],
  composition: { primary: "picture_in_picture", allowed: ["picture_in_picture", "split", "full_screen", "layered_collage"], layersMax: 3 },
  texture: { level: "subtle", kinds: ["gradient", "jemná zrnitosť"] },
  visualStructure: { elementAnimation: "sequential", transitionsBetweenPanels: false },
  captionStyle: { styleId: "VIRAL_BOLD", rationaleSk: "Krátke formáty sa pozerajú bez zvuku — text musí byť okamžite čitateľný." },
  transitionStyle: { base: "cut", accent: "whip_pan", noteSk: "Švih ako akcent, nie ako pravidlo." },
  talkingHeadRatio: 0.55,
  motionPool: ["pop", "slide", "punch", "subtle_zoom"],
  requiresSk: "Potrebuje prepis; bez časovania stráca zmysel striedanie na vetách.",
});

const DARK_EDITORIAL: StyleRecipe = makeRecipe({
  id: "DARK_EDITORIAL",
  name: "Dark Editorial",
  labelSk: "Tmavý editoriál",
  purposeSk: "Vážne, prémiové témy (financie, zdravie, B2B) — tmavá paleta, pokojná elegancia.",
  whySk: "Tempo je pomalšie a text dôstojný — nič nekričí, ale každý prvok má váhu.",
  animation: { kind: "smooth", fpsLook: 15, motionBlur: false, easingSk: "pokojné s krátkym nábehom" },
  typography: {
    character: "serif-editorial",
    kinetic: true,
    staggerMs: 200,
    scaleHint: 100,
    uppercase: false,
    maxElementsPerScene: 2,
    roles: ["headline", "statistic", "quote", "label"],
  },
  camera: { punchIn: true, punchInScale: 1.07, fastZoom: false, whipPan: "none" },
  movement: { paperCutout: false, layering: true, subtleZoom: true, depthLayers: 2, noteSk: "jemné vrstvenie, minimum pohybu" },
  aesthetic: {
    labelSk: "tmavý editorial — noviny, fotografia, zlato",
    elementPool: ["photo", "diagram", "map", "paper_element", "existing_media"],
    halftone: true,
    visibleShadows: true,
    tornEdges: false,
    asymmetric: true,
    illustrationBodies: false,
  },
  colorPalette: ["#101215", "#E6E1D8", "#C9A227", "#5B6B7A"],
  composition: { primary: "asymmetric", allowed: ["asymmetric", "split", "full_screen", "layered_collage"], layersMax: 3 },
  texture: { level: "editorial", kinds: ["papier", "halftone", "tmavá zrnitosť"] },
  visualStructure: { elementAnimation: "sequential", transitionsBetweenPanels: false },
  captionStyle: { styleId: "CLEAN", rationaleSk: "Vážny obsah potrebuje čitateľnú vetu, nie blikajúce slová." },
  transitionStyle: { base: "dissolve", accent: "punch", noteSk: "Akcent len na kľúčovom čísle." },
  talkingHeadRatio: 0.6,
  motionPool: ["pop", "subtle_zoom", "punch"],
  requiresSk: "Potrebuje prepis; silné slová a čísla sú hlavný zdroj rozhodnutí.",
});

const KINETIC_TYPOGRAPHY: StyleRecipe = makeRecipe({
  id: "KINETIC_TYPOGRAPHY",
  name: "Kinetic Typography",
  labelSk: "Kinetická typografia",
  purposeSk: "Text je hlavný hrdina — hlavne pre fakty, čísla a citáty, kde obraz nestačí.",
  whySk: "Slová z vety sa objavujú po jednom; divák číta presne to, čo počuje, a nestráca sa.",
  animation: { kind: "snappy", fpsLook: null, motionBlur: false, easingSk: "energické nábehy" },
  typography: {
    character: "bold-condensed",
    kinetic: true,
    staggerMs: 90,
    scaleHint: 118,
    uppercase: true,
    maxElementsPerScene: 4,
    roles: ["keyword", "headline", "statistic", "quote", "emphasis"],
  },
  camera: { punchIn: false, punchInScale: 1.05, fastZoom: false, whipPan: "none" },
  movement: { paperCutout: false, layering: false, subtleZoom: true, depthLayers: 1, noteSk: "obraz sa hýbe minimálne — dominuje text" },
  aesthetic: {
    labelSk: "typografický plagát",
    elementPool: ["icon", "diagram", "existing_media"],
    halftone: false,
    visibleShadows: false,
    tornEdges: false,
    asymmetric: false,
    illustrationBodies: false,
  },
  colorPalette: ["#0A0A0A", "#FFFFFF", "#FFD400"],
  composition: { primary: "full_screen", allowed: ["full_screen", "split"], layersMax: 2 },
  texture: { level: "clean", kinds: ["plochá farba"] },
  visualStructure: { elementAnimation: "sequential", transitionsBetweenPanels: false },
  captionStyle: { styleId: "KEYWORD_POP", rationaleSk: "Text je už v obraze — titulky sa nesmú duplikovať, preto zdôrazňujú len čísla a kľúčové slová." },
  transitionStyle: { base: "cut", accent: "punch", noteSk: "Rez je súčasťou rytmu textu." },
  talkingHeadRatio: 0.35,
  motionPool: ["pop", "slide", "punch"],
  requiresSk: "Bez presných časov slov nemá zmysel — potrebuje word-level časovanie.",
});

const MINIMAL: StyleRecipe = makeRecipe({
  id: "MINIMAL",
  name: "Minimal",
  labelSk: "Minimal",
  purposeSk: "Keď má hovoriť obsah: žiadne ozdoby, len človek a občas jeden text.",
  whySk: "Minimum zásahov znamená maximum dôvery — nič neodvádza pozornosť.",
  animation: { kind: "none", fpsLook: null, motionBlur: false, easingSk: "bez animácie" },
  typography: {
    character: "clean-sans",
    kinetic: false,
    staggerMs: 0,
    scaleHint: 88,
    uppercase: false,
    maxElementsPerScene: 1,
    roles: ["label", "statistic"],
  },
  camera: { punchIn: false, punchInScale: 1.03, fastZoom: false, whipPan: "none" },
  movement: { paperCutout: false, layering: false, subtleZoom: false, depthLayers: 1, noteSk: "žiadny pohyb" },
  aesthetic: {
    labelSk: "čisté pozadie, minimálne prvky",
    elementPool: ["existing_media", "icon"],
    halftone: false,
    visibleShadows: false,
    tornEdges: false,
    asymmetric: false,
    illustrationBodies: false,
  },
  colorPalette: ["#FFFFFF", "#121212", "#8A8A8A"],
  composition: { primary: "full_screen", allowed: ["full_screen"], layersMax: 1 },
  texture: { level: "clean", kinds: [] },
  visualStructure: { elementAnimation: "together", transitionsBetweenPanels: true },
  captionStyle: { styleId: "MINIMAL", rationaleSk: "Aj titulky majú byť nenápadné." },
  transitionStyle: { base: "cut", accent: "none", noteSk: "Rez bez efektu." },
  talkingHeadRatio: 0.9,
  motionPool: ["subtle_zoom"],
  requiresSk: "Stačia vety; čím menej dát, tým menej zásahov (a to je zámer).",
});

const CINEMATIC: StyleRecipe = makeRecipe({
  id: "CINEMATIC",
  name: "Cinematic",
  labelSk: "Filmový",
  purposeSk: "Príbeh a atmosféra — široké zábery, tmavá paleta, pokojné tempo.",
  whySk: "Obraz dýcha a zmeny prichádzajú v bodoch obratu, nie priebežne.",
  animation: { kind: "smooth", fpsLook: null, motionBlur: false, easingSk: "plynulé, filmové" },
  typography: {
    character: "serif-editorial",
    kinetic: false,
    staggerMs: 300,
    scaleHint: 95,
    uppercase: false,
    maxElementsPerScene: 2,
    roles: ["headline", "quote"],
  },
  camera: { punchIn: true, punchInScale: 1.06, fastZoom: false, whipPan: "none" },
  movement: { paperCutout: false, layering: true, subtleZoom: true, depthLayers: 2, noteSk: "paralaxa a jemné priblíženie" },
  aesthetic: {
    labelSk: "filmový záber s jemnou textúrou",
    elementPool: ["photo", "existing_media", "map"],
    halftone: false,
    visibleShadows: true,
    tornEdges: false,
    asymmetric: true,
    illustrationBodies: false,
  },
  colorPalette: ["#0C0F14", "#D8C9A3", "#3E5C6B", "#8A3B2E"],
  composition: { primary: "full_screen", allowed: ["full_screen", "asymmetric", "split"], layersMax: 2 },
  texture: { level: "subtle", kinds: ["zrnitosť", "vignette"] },
  visualStructure: { elementAnimation: "together", transitionsBetweenPanels: true },
  captionStyle: { styleId: "PODCAST", rationaleSk: "Pokojné, teplé titulky k atmosfére." },
  transitionStyle: { base: "dissolve", accent: "none", noteSk: "Prechod len pri zmene scény." },
  talkingHeadRatio: 0.75,
  motionPool: ["subtle_zoom", "punch"],
  requiresSk: "Stačia vety a pauzy; najviac profituje zo shot boundaries (tie dnes nemáme).",
});

const PODCAST_VISUAL: StyleRecipe = makeRecipe({
  id: "PODCAST_VISUAL",
  name: "Podcast Visual",
  labelSk: "Podcastový vizuál",
  purposeSk: "Rozhovor alebo sólo rozprávanie, kde je reč hlavná a vizuály len pomáhajú.",
  whySk: "Rečník zostáva v obraze, text dopĺňa pointy — nič nezakrýva tvár počas dôležitej vety.",
  animation: { kind: "smooth", fpsLook: null, motionBlur: false, easingSk: "jemné, krátke" },
  typography: {
    character: "bold-sans",
    kinetic: true,
    staggerMs: 180,
    scaleHint: 96,
    uppercase: false,
    maxElementsPerScene: 2,
    roles: ["keyword", "quote", "statistic", "label"],
  },
  camera: { punchIn: true, punchInScale: 1.08, fastZoom: false, whipPan: "none" },
  movement: { paperCutout: false, layering: false, subtleZoom: true, depthLayers: 1, noteSk: "takmer žiadny pohyb" },
  aesthetic: {
    labelSk: "čistý štúdiový look",
    elementPool: ["existing_media", "photo", "icon", "diagram"],
    halftone: false,
    visibleShadows: false,
    tornEdges: false,
    asymmetric: false,
    illustrationBodies: false,
  },
  colorPalette: ["#141414", "#F5EFE6", "#E0A458"],
  composition: { primary: "picture_in_picture", allowed: ["picture_in_picture", "split", "full_screen"], layersMax: 2 },
  texture: { level: "clean", kinds: ["jemná zrnitosť"] },
  visualStructure: { elementAnimation: "sequential", transitionsBetweenPanels: false },
  captionStyle: { styleId: "PODCAST", rationaleSk: "Teplé titulky, ktoré nerušia rozhovor." },
  transitionStyle: { base: "cut", accent: "none", noteSk: "Bez efektov — nič neodvádza od témy." },
  talkingHeadRatio: 0.82,
  motionPool: ["pop", "subtle_zoom"],
  requiresSk: "Potrebuje prepis; najviac profituje zo zmien rečníka (dnes ich nemáme).",
});

const UGC_PERFORMANCE: StyleRecipe = makeRecipe({
  id: "UGC_PERFORMANCE",
  name: "UGC Performance",
  labelSk: "UGC výkon",
  purposeSk: "Reklama a výkonnostný obsah: rýchle, priame, s jasnou ponukou a číslami.",
  whySk: "Krátke texty a čísla zvýraznené okamžite — divák musí pochopiť ponuku do pár sekúnd.",
  animation: { kind: "snappy", fpsLook: null, motionBlur: false, easingSk: "veľmi rýchle nábehy" },
  typography: {
    character: "bold-sans",
    kinetic: true,
    staggerMs: 80,
    scaleHint: 114,
    uppercase: true,
    maxElementsPerScene: 3,
    roles: ["statistic", "keyword", "headline", "label", "emphasis"],
  },
  camera: { punchIn: true, punchInScale: 1.14, fastZoom: true, whipPan: "frequent" },
  movement: { paperCutout: false, layering: true, subtleZoom: true, depthLayers: 2, noteSk: "rýchle, ale čitateľné zmeny" },
  aesthetic: {
    labelSk: "produktové fotky a čísla",
    elementPool: ["photo", "icon", "diagram", "existing_media", "paper_element"],
    halftone: false,
    visibleShadows: true,
    tornEdges: false,
    asymmetric: true,
    illustrationBodies: false,
  },
  colorPalette: ["#0B0B0B", "#FFFFFF", "#00C853", "#FF3D00"],
  composition: { primary: "split", allowed: ["split", "picture_in_picture", "layered_collage", "full_screen"], layersMax: 3 },
  texture: { level: "subtle", kinds: ["gradient", "zrnitosť"] },
  visualStructure: { elementAnimation: "sequential", transitionsBetweenPanels: false },
  captionStyle: { styleId: "VIRAL_BOLD", rationaleSk: "Predajný text musí byť vidieť okamžite a bez zvuku." },
  transitionStyle: { base: "cut", accent: "whip_pan", noteSk: "Švih v mieste nového argumentu (čísla, ponuky)." },
  talkingHeadRatio: 0.5,
  motionPool: ["pop", "slide", "punch", "whip_transition"],
  requiresSk: "Potrebuje prepis; čísla a ponuky sú hlavný zdroj rozhodnutí.",
});

const CUSTOM: StyleRecipe = makeRecipe({
  id: "CUSTOM",
  name: "Custom",
  labelSk: "Vlastný štýl",
  purposeSk: "Základ, ktorý si používateľ doladí vlastným briefom (alebo ručne).",
  whySk: "Neutrálny, bezpečný základ — nič nepredpokladá a všetko sa dá zmeniť.",
  animation: { kind: "smooth", fpsLook: null, motionBlur: false, easingSk: "neutrálne" },
  typography: {
    character: "bold-sans",
    kinetic: true,
    staggerMs: 150,
    scaleHint: 100,
    uppercase: false,
    maxElementsPerScene: 2,
    roles: ["keyword", "headline", "label", "statistic", "quote", "emphasis"],
  },
  camera: { punchIn: true, punchInScale: 1.1, fastZoom: false, whipPan: "occasional" },
  movement: { paperCutout: false, layering: true, subtleZoom: true, depthLayers: 2, noteSk: "neutrálne vrstvenie" },
  aesthetic: {
    labelSk: "neutrálne zmiešané médium",
    elementPool: ["existing_media", "photo", "illustration", "diagram", "paper_element", "icon"],
    halftone: false,
    visibleShadows: true,
    tornEdges: false,
    asymmetric: true,
    illustrationBodies: false,
  },
  colorPalette: ["#111111", "#F5F5F5", "#FF7A00"],
  composition: { primary: "layered_collage", allowed: ["layered_collage", "split", "picture_in_picture", "full_screen", "asymmetric"], layersMax: 3 },
  texture: { level: "subtle", kinds: ["zrnitosť"] },
  visualStructure: { elementAnimation: "sequential", transitionsBetweenPanels: false },
  captionStyle: { styleId: "VIRAL_BOLD", rationaleSk: "Bezpečný predvolený štýl titulkov pre vlastný brief." },
  transitionStyle: { base: "cut", accent: "punch", noteSk: "Všetko sa dá zmeniť." },
  talkingHeadRatio: 0.5,
  motionPool: ["pop", "slide", "punch", "subtle_zoom", "whip_transition", "paper_movement"],
  requiresSk: "Čím konkrétnejší brief, tým lepší výsledok; nerozpoznané pojmy appka vypíše.",
});

// ---------------------------------------------------------------------------
// Recepty z reálnych referencií (merania v docs/STYLE_STUDIO_REFERENCE_ANALYSIS.md)
// ---------------------------------------------------------------------------

/**
 * **AI KARTA (ZADAJ → VÝSLEDOK)** — referenčný klip: 18,0 s, **0 rezov**
 * (jeden statický záber), 9:16. Rečník dole, cez obraz veľká svetlá „karta"
 * s výsledkom AI a kinetické popisky (biely + oranžový, silný kondenzovaný,
 * tmavý obtiahnutý obrys). Zdrojom karty je existujúce médium, nie generovanie.
 */
const AI_CARD_DEMO: StyleRecipe = makeRecipe({
  id: "AI_CARD_DEMO",
  name: "AI Card Demo",
  labelSk: "AI karta (zadaj → výsledok)",
  purposeSk: "Ukázať výsledok AI v jednom statickom zábere: rečník + karta s výstupom a dvoma popiskami.",
  whySk: "Divák vidí zadanie aj výsledok súčasne — nie je čo domýšľať, stačí pozerať.",
  animation: { kind: "snappy", fpsLook: null, motionBlur: false, easingSk: "karta nabehne naraz, potom sa vymení jej obsah" },
  typography: {
    character: "bold-condensed",
    kinetic: true,
    staggerMs: 140,
    scaleHint: 108,
    uppercase: true,
    maxElementsPerScene: 2,
    roles: ["label", "keyword", "headline", "emphasis"],
  },
  camera: { punchIn: false, punchInScale: 1, fastZoom: false, whipPan: "none" },
  movement: { paperCutout: false, layering: true, subtleZoom: false, depthLayers: 2, noteSk: "vrstva karty sa nehýbe, mení sa jej obsah" },
  aesthetic: {
    labelSk: "karta s výstupom AI + reálne pozadie",
    elementPool: ["existing_media", "diagram", "photo", "icon"],
    halftone: false,
    visibleShadows: true,
    tornEdges: false,
    asymmetric: false,
    illustrationBodies: false,
  },
  colorPalette: ["#FFFFFF", "#F08A24", "#111111", "#7FB2D9"],
  composition: { primary: "picture_in_picture", allowed: ["picture_in_picture", "split", "full_screen"], layersMax: 3 },
  texture: { level: "clean", kinds: ["mäkký tieň pod kartou"] },
  visualStructure: { elementAnimation: "sequential", transitionsBetweenPanels: false },
  captionStyle: { styleId: "MINIMAL", rationaleSk: "Text nesie karta, nie titulková linka — titulky len potichu." },
  transitionStyle: { base: "cut", accent: "none", noteSk: "Rezy nie sú potrebné; mení sa obsah karty." },
  talkingHeadRatio: 0.85,
  motionPool: ["pop", "subtle_zoom"],
  requiresSk: "Potrebuje médium pre kartu (výstup AI alebo screenshot). Bez neho appka kartu nevymyslí.",
});

/**
 * **FILMOVÁ MONTÁŽ** — referenčný klip: 54,3 s, **88 rezov** (1,62 rezu/s,
 * priemerný záber 0,61 s), 720×1280. B-roll so skutočnou kamerou, rečník
 * vsunutý medzi zábery, titulky dole na tmavom podklade.
 */
const FILM_MONTAGE: StyleRecipe = makeRecipe({
  id: "FILM_MONTAGE",
  name: "Film Montage",
  labelSk: "Filmová montáž",
  purposeSk: "Rytmický klip postavený na b-roll záberoch s krátkymi prestrihmi na rečníka.",
  whySk: "Rýchly strih (merane 1,6 rezu za sekundu) drží tempo a b-roll nesie význam, ktorý slová len dopĺňajú.",
  animation: { kind: "snappy", fpsLook: null, motionBlur: false, easingSk: "strih, žiadne dlhé prechody" },
  typography: {
    character: "bold-sans",
    kinetic: true,
    staggerMs: 90,
    scaleHint: 104,
    uppercase: true,
    maxElementsPerScene: 3,
    roles: ["keyword", "headline", "label", "emphasis"],
  },
  camera: { punchIn: true, punchInScale: 1.12, fastZoom: true, whipPan: "occasional" },
  movement: { paperCutout: false, layering: false, subtleZoom: true, depthLayers: 1, noteSk: "pohyb robí strih a kamera v zábere, nie efekty" },
  aesthetic: {
    labelSk: "skutočné zábery (b-roll), žiadna koláž",
    elementPool: ["b_roll", "existing_media", "photo"],
    halftone: false,
    visibleShadows: false,
    tornEdges: false,
    asymmetric: false,
    illustrationBodies: false,
  },
  colorPalette: ["#111111", "#FFFFFF", "#8A8F98", "#E8720C"],
  composition: { primary: "full_screen", allowed: ["full_screen", "picture_in_picture"], layersMax: 2 },
  texture: { level: "clean", kinds: ["filmová zrnitosť v záberoch"] },
  visualStructure: { elementAnimation: "together", transitionsBetweenPanels: true },
  captionStyle: { styleId: "CLEAN", rationaleSk: "Titulky na tmavom podklade čitateľné na akomkoľvek zábere." },
  transitionStyle: { base: "cut", accent: "none", noteSk: "Základ je strih; švih len výnimočne na zmene témy." },
  talkingHeadRatio: 0.25,
  motionPool: ["punch", "subtle_zoom", "whip_transition"],
  requiresSk: "Potrebuje dosť b-roll záberov — bez nich je montáž len rečník a recept to prizná.",
});

/**
 * **EXPERT + KOLÁŽ NA OBRAZOVKE** — referenčný klip: 93,6 s, **43 rezov**
 * (0,46 rezu/s, priemerný záber 2,13 s). Rečník vysvetľuje, na obrazovke sa
 * vrstvia fotky (čiernobiela koláž) a ručne kreslené diagramy; v titulkoch
 * je zvýraznené jedno slovo.
 */
const EXPERT_COLLAGE_TALK: StyleRecipe = makeRecipe({
  id: "EXPERT_COLLAGE_TALK",
  name: "Expert Collage Talk",
  labelSk: "Expert + koláž na obrazovke",
  purposeSk: "Dlhší vysvetľujúci klip: rečník hovorí, obraz dopĺňajú fotky, diagramy a zvýraznené slová.",
  whySk: "Dlhý záber (merane 2,1 s) nechá myšlienku dozrieť a vrstvené fotky držia pozornosť bez zrýchľovania reči.",
  animation: { kind: "smooth", fpsLook: null, motionBlur: false, easingSk: "plynulé, pokojné nábehy" },
  typography: {
    character: "bold-sans",
    kinetic: true,
    staggerMs: 120,
    scaleHint: 102,
    uppercase: true,
    maxElementsPerScene: 2,
    roles: ["keyword", "label", "emphasis", "quote"],
  },
  camera: { punchIn: true, punchInScale: 1.08, fastZoom: false, whipPan: "none" },
  movement: { paperCutout: false, layering: true, subtleZoom: true, depthLayers: 3, noteSk: "fotky sa skladajú do vrstiev, nie animujú" },
  aesthetic: {
    labelSk: "čiernobiele fotky + ručne kreslené diagramy",
    elementPool: ["photo", "diagram", "illustration", "existing_media", "paper_element"],
    halftone: false,
    visibleShadows: true,
    tornEdges: false,
    asymmetric: true,
    illustrationBodies: false,
  },
  colorPalette: ["#111111", "#F5F5F5", "#E8720C"],
  composition: { primary: "layered_collage", allowed: ["layered_collage", "picture_in_picture", "split"], layersMax: 3 },
  texture: { level: "subtle", kinds: ["kontrast", "zrnitosť"] },
  visualStructure: { elementAnimation: "sequential", transitionsBetweenPanels: false },
  captionStyle: { styleId: "HORMOZI", rationaleSk: "V referencii je v titulkoch vždy jedno zvýraznené slovo (merané vizuálne)." },
  transitionStyle: { base: "cut", accent: "punch", noteSk: "Zvýraznenie v mieste pointy, inak pokojný strih." },
  talkingHeadRatio: 0.6,
  motionPool: ["slide", "pop", "subtle_zoom", "punch"],
  requiresSk: "Potrebuje fotky/diagramy pre koláž; bez nich zostane rečník a appka to napíše.",
});

/**
 * **AI KINEMATOGRAFICKÝ ZÁBER** — recept nameraný z 6 reálnych klipov
 * `instagram.com/ai_ktivista` (Tomáš Jevčik), spolu 194,7 s.
 *
 * Čo bolo **NAMERANÉ** (medián cez 6 klipov, nie z jedného):
 *  - 0,14 rezu/s · 9,25 s na záber · 62–100 % času v záberoch ≥ 2,5 s (jeden klip
 *    je 25 s bez jediného strihu) → dlhý záber, strih je výnimka;
 *  - dynamika v obraze 11,7–83,0 (medián 24,5) → obraz sa hýbe **vnútri** záberu
 *    (kamera letí, kráča), nie strihom;
 *  - jas 37,9–162,0 (medián 73,4), kontrast medián 55,7, sýtosť medián 22 % →
 *    stredne tmavý, stredne kontrastný obraz, mierne sýte farby;
 *  - svetlý spodok (možné titulky) aspoň v polovici vzoriek len v **1 zo 6** klipov;
 *  - 5 zo 6 klipov je 720×1280 (9:16), 30 fps (jeden 24 fps), jeden 1280×720.
 *
 * Čo **NEbolo** namerané a recept to nepredstiera:
 *  - **paletu** — ani jedna farba sa neobjavila vo väčšine klipov (klipy zdieľajú
 *    tempo a svetlo, nie farbu). Štyri farby nižšie sú **namerané odtiene z jeho
 *    klipov** (dve tmavé základne, teplý hnedý stred, studený bridlicový), nie
 *    „jeho paleta";
 *  - **podiel rečníka** — bez detektora tvárí sa nedá zmerať. Pomer 30/70 je
 *    z jeho **zverejneného workflow** (Flow/Omni na aiktivista.sk), nie z videa.
 */
const AI_CINEMATIC_TAKE: StyleRecipe = makeRecipe({
  id: "AI_CINEMATIC_TAKE",
  name: "AI Cinematic Take",
  labelSk: "AI kinematografický záber (merané)",
  purposeSk:
    "Dlhý kinematografický záber s pomalou kamerou a minimom strihov — atmosféra nesie obsah, nie efekty ani titulky.",
  whySk:
    "Merané na 6 klipoch: medián 0,14 rezu/s a 9,25 s na záber, pohyb je vnútri záberu (dynamika 24,5/s). Pozornosť teda drží obraz a pomalý pohyb kamery, nie strih.",
  animation: { kind: "smooth", fpsLook: null, motionBlur: false, easingSk: "pomalý nábeh kamery, žiadne švihy ani skoky" },
  typography: {
    character: "clean-sans",
    kinetic: false,
    staggerMs: 160,
    scaleHint: 96,
    uppercase: false,
    maxElementsPerScene: 1,
    roles: ["label", "headline", "quote"],
  },
  camera: { punchIn: false, punchInScale: 1, fastZoom: false, whipPan: "none" },
  movement: {
    paperCutout: false,
    layering: false,
    subtleZoom: true,
    depthLayers: 1,
    noteSk: "pohyb je v zábere (kamera letí alebo kráča) — appka pridá len jemné priblíženie, nič nevyrezáva",
  },
  aesthetic: {
    labelSk: "reálny alebo AI záber, žiadna koláž",
    elementPool: ["b_roll", "existing_media"],
    halftone: false,
    visibleShadows: false,
    tornEdges: false,
    asymmetric: false,
    illustrationBodies: false,
  },
  // Namerané odtiene z jeho klipov (nie „jeho paleta" — pozri komentár vyššie).
  colorPalette: ["#0A070B", "#4A3123", "#6F869D", "#E8E3DD"],
  composition: { primary: "full_screen", allowed: ["full_screen", "picture_in_picture"], layersMax: 1 },
  texture: { level: "subtle", kinds: ["filmová zrnitosť", "jemná hmla v obraze"] },
  visualStructure: { elementAnimation: "together", transitionsBetweenPanels: false },
  captionStyle: {
    styleId: "MINIMAL",
    rationaleSk:
      "Svetlý spodok (možné titulky) bol aspoň v polovici vzoriek len v 1 zo 6 klipov — titulky teda len potichu, obraz nesie obsah.",
  },
  transitionStyle: {
    base: "cut",
    accent: "none",
    noteSk: "Strih je výnimka (nameraných 0–0,39 rezu/s); prechody appka nemeria, preto žiadne nepredstiera.",
  },
  talkingHeadRatio: 0.3,
  motionPool: ["subtle_zoom"],
  measuredLight: {
    brightness: 87.51,
    contrast: 55.92,
    sourceSk: "analyza-videa.json, medián cez 6 jeho IG klipov (median_jas / median_kontrast)",
  },
  requiresSk:
    "Potrebuje dlhé zábery — vlastné b-roll alebo AI klipy vyrobené mimo appky (appka video negeneruje). Pomer 30/70 je z jeho zverejneného workflow, nie z merania videa; podiel rečníka sa bez detektora tvárí zmerať nedá.",
});


/**
 * **EDU TALK — SLOVO PO SLOVE** — recept nameraný zo **6 klipov** na TikToku
 * (`tiktok.com/@ai_ktivista`, spolu 297,2 s). Je to jeho najčastejší formát:
 * rečník v obraze + vložené ilustrácie/screenshoty k tomu, čo práve hovorí,
 * a titulky idúce **slovo po slove** (v snímkach je vždy len jedno slovo).
 *
 * NAMERANÉ (medián cez 6 klipov; pruhy zapečené vo videu vyrezané):
 *  - 0,15 rezu/s · 5,35 s na záber → pokojné tempo, strih je výnimka,
 *  - jas 115,5 (rozsah 65,0–142,8) · kontrast 55,0 · sýtosť 30 %,
 *  - dynamika 46,2 (obraz menia vložené prvky, nie strih),
 *  - hustota hrán 0,026 (čisté prostredie, málo detailov v pozadí),
 *  - svetlý spodok len v 2 zo 6 klipov → titulky nie sú vždy dole.
 *
 * ČO NAMERANÉ NEBOLO (a recept to nepredstiera):
 *  - **podiel rečníka** — bez detektora tvárí sa zmerať nedá; 60/40 je pracovný
 *    pomer, nie meranie,
 *  - **krok slova v titulkoch** — z videa sa časovanie slov nečíta; `staggerMs`
 *    je preto len nastavenie, nie meranie (presný rytmus je z časovania v prepise),
 *  - **jeho žltá** (`#FEC903`) prekročila prah palety (0,5 % plochy) len v **1 zo 6**
 *    klipov (11,9 % plochy); v ostatných je žltá vidieť v popiskoch, ale jej plocha
 *    je pod prahom merania — preto ju recept uvádza ako **možný** akcent, nie pravidlo,
 *  - **žiadna farba sa neopakuje vo väčšine klipov** (rovnako ako pri AI_CINEMATIC_TAKE).
 */
const EDU_WORD_TALK: StyleRecipe = makeRecipe({
  id: "EDU_WORD_TALK",
  name: "Edu Word Talk",
  labelSk: "Edu talk — slovo po slove (merané)",
  purposeSk:
    "Vysvetľujúci klip: rečník hovorí a k jeho slovám sa prikladajú ilustrácie, screenshoty a karty; titulky idú po jednom slove.",
  whySk:
    "Merané na 6 klipoch: pokojné tempo (0,15 rezu/s, 5,35 s na záber) a dynamika 46,2 znamenajú, že pozornosť držia vložené prvky a text, nie strih. Preto recept necháva strih pokojný a animuje jednotlivé prvky.",
  animation: { kind: "smooth", fpsLook: null, motionBlur: false, easingSk: "prvky sa objavujú po jednom, bez švihov (namerané tempo 0,15 rezu/s)" },
  typography: {
    character: "bold-sans",
    kinetic: true,
    staggerMs: 120,
    scaleHint: 120,
    uppercase: false,
    // Namerané: v snímkach je vždy len jedno slovo → naraz maximálne jeden text.
    maxElementsPerScene: 1,
    roles: ["keyword", "emphasis", "label"],
  },
  camera: { punchIn: true, punchInScale: 1.08, fastZoom: false, whipPan: "none" },
  movement: {
    paperCutout: false,
    layering: false,
    subtleZoom: true,
    depthLayers: 1,
    noteSk: "obraz menia vložené ilustrácie a karty, ktoré sa objavujú po jednom — nie efekty na rečníkovi",
  },
  aesthetic: {
    labelSk: "rečník + vložené ilustrácie, screenshoty a karty",
    elementPool: ["illustration", "diagram", "existing_media", "photo", "icon"],
    halftone: false,
    visibleShadows: false,
    tornEdges: false,
    asymmetric: false,
    illustrationBodies: true,
  },
  // Namerané „občasné" farby: biela #FCF8FC, takmer čierna #110D11, žltá #FEC903
  // (v 1 zo 6 klipov 11,9 % plochy), zelená #4A6C56. Žiadna nie je zdieľaná.
  colorPalette: ["#FCF8FC", "#110D11", "#FEC903", "#4A6C56"],
  composition: { primary: "full_screen", allowed: ["full_screen", "picture_in_picture", "split"], layersMax: 2 },
  texture: { level: "clean", kinds: ["čisté prostredie bez textúry (nameraná sýtosť 30 %)"] },
  visualStructure: { elementAnimation: "sequential", transitionsBetweenPanels: false },
  captionStyle: {
    styleId: "KARAOKE",
    rationaleSk:
      "Jeho titulky idú slovo po slove — v snímkach je vždy len jedno slovo. KARAOKE je najbližší existujúci štýl; či render naozaj zvýrazňuje po slovách, overí real export, nie tento text.",
  },
  transitionStyle: { base: "cut", accent: "punch", noteSk: "Prechody appka nemeria — recept preto používa len strih a dôraz na vloženom prvku." },
  talkingHeadRatio: 0.6,
  motionPool: ["pop", "slide", "subtle_zoom"],
  measuredLight: {
    brightness: 114.04,
    contrast: 55.8,
    sourceSk: "analyza-tiktok.json, medián cez 12 jeho tiktokov (median_jas / median_kontrast)",
  },
  requiresSk:
    "Potrebuje vložené ilustrácie, screenshoty alebo karty k tomu, čo hovoríš — appka ich negeneruje, len ich načasuje. Podiel rečníka (60/40) nie je meraný (bez detektora tvárí) a zvýrazňovanie titulkov po slovách musí potvrdiť real export.",
});

/** Všetkých 15 receptov v poradí, v akom sa ponúkajú v UI. */
export const STYLE_RECIPES: Record<StylePresetId, StyleRecipe> = {
  EDITORIAL_COLLAGE,
  DOCUMENTARY,
  MODERN_SOCIAL,
  DARK_EDITORIAL,
  KINETIC_TYPOGRAPHY,
  MINIMAL,
  CINEMATIC,
  PODCAST_VISUAL,
  UGC_PERFORMANCE,
  AI_CARD_DEMO,
  FILM_MONTAGE,
  EXPERT_COLLAGE_TALK,
  AI_CINEMATIC_TAKE,
  EDU_WORD_TALK,
  CUSTOM,
};

export const STYLE_PRESET_IDS: StylePresetId[] = [
  "EDITORIAL_COLLAGE",
  "DOCUMENTARY",
  "MODERN_SOCIAL",
  "DARK_EDITORIAL",
  "KINETIC_TYPOGRAPHY",
  "MINIMAL",
  "CINEMATIC",
  "PODCAST_VISUAL",
  "UGC_PERFORMANCE",
  "AI_CARD_DEMO",
  "FILM_MONTAGE",
  "EXPERT_COLLAGE_TALK",
  "AI_CINEMATIC_TAKE",
  "EDU_WORD_TALK",
  "CUSTOM",
];

export function getStyleRecipe(id: StylePresetId | string): StyleRecipe {
  const key = String(id ?? "").toUpperCase() as StylePresetId;
  return STYLE_RECIPES[key] ?? STYLE_RECIPES.CUSTOM;
}

export function listStyleRecipes(): StyleRecipe[] {
  return STYLE_PRESET_IDS.map((id) => STYLE_RECIPES[id]);
}

// ---------------------------------------------------------------------------
// CUSTOM — vlastný brief používateľa (deterministicky, bez AI)
// ---------------------------------------------------------------------------

/** Jeden rozpoznaný pojem z briefu (aby používateľ videl, čo appka pochopila). */
export interface BriefMatch {
  keyword: string;
  meaningSk: string;
}

export interface CustomRecipeResult {
  recipe: StyleRecipe;
  recognized: BriefMatch[];
  /** Čo appka **nemala ako rozpoznať** — vypíše to, aby nič nepredstierala. */
  unrecognizedSk: string[];
  noteSk: string;
}

interface BriefRule {
  test: RegExp;
  meaningSk: string;
  apply: (r: StyleRecipe) => void;
}

/**
 * Pravidlá prekladu briefu na recept. Sú to **obyčajné slová a farby** — žiadny
 * model, žiadny provider. Nerozpoznané časti briefu appka vráti používateľovi,
 * aby vedel, čo si má doladiť ručne (a aby to nevyzeralo, že rozumie všetkému).
 */
const BRIEF_RULES: BriefRule[] = [
  {
    test: /\bcollage\b|koláž|kolaz|výstriž|vystriz|cut[\s-]?out|paper|papier/i,
    meaningSk: "koláž z papiera a výstrižkov",
    apply: (r) => {
      r.aesthetic.halftone = true;
      r.aesthetic.tornEdges = true;
      r.aesthetic.visibleShadows = true;
      r.aesthetic.elementPool = ["paper_element", "photo", "illustration", "diagram", "icon"];
      r.composition.primary = "layered_collage";
      r.texture.level = "heavy";
      r.texture.kinds = Array.from(new Set<string>([...r.texture.kinds, "papier", "halftone"]));
      r.movement.paperCutout = true;
      r.movement.depthLayers = Math.max(r.movement.depthLayers, 3);
    },
  },
  {
    test: /stop[\s-]?motion|12\s*fps|krokov|tactile|hmatateľ/i,
    meaningSk: "stop-motion dojem (12 fps, bez rozmazania)",
    apply: (r) => {
      r.animation.kind = "stop-motion";
      r.animation.fpsLook = 12;
      r.animation.motionBlur = false;
      r.animation.easingSk = "krokové, bez rozmazania";
    },
  },
  {
    test: /kinetic|kinetick|pop[\s-]?in|pop[\s-]?up/i,
    meaningSk: "kinetická typografia (prvky sa objavujú postupne)",
    apply: (r) => {
      r.typography.kinetic = true;
      r.typography.staggerMs = Math.min(r.typography.staggerMs, 110);
      r.visualStructure.elementAnimation = "sequential";
    },
  },
  {
    test: /bold[\s-]?condensed|tučné|tucne|chunky|plagát|plagat/i,
    meaningSk: "tučné kondenzované písmo",
    apply: (r) => {
      r.typography.character = "bold-condensed";
      r.typography.scaleHint = Math.max(r.typography.scaleHint, 110);
      r.typography.uppercase = true;
    },
  },
  {
    test: /halftone|polotón|novin|newspaper|rastr/i,
    meaningSk: "halftone / novinová textúra",
    apply: (r) => {
      r.aesthetic.halftone = true;
      r.texture.kinds = Array.from(new Set<string>([...r.texture.kinds, "halftone", "noviny"]));
      if (r.texture.level === "clean") r.texture.level = "editorial";
    },
  },
  {
    test: /polaroid/i,
    meaningSk: "polaroidové prvky",
    apply: (r) => {
      r.aesthetic.elementPool = Array.from(new Set<SupportingElementType>([...r.aesthetic.elementPool, "photo"]));
      r.aesthetic.visibleShadows = true;
    },
  },
  {
    test: /whip|švih|svih|swish/i,
    meaningSk: "švihové prechody (whip-pan)",
    apply: (r) => {
      r.camera.whipPan = "occasional";
      r.transitionStyle.base = "whip_pan";
      r.transitionStyle.accent = "punch";
    },
  },
  {
    test: /punch[\s-]?in|priblíž|pribliz|zoom/i,
    meaningSk: "punch-in a rýchle priblíženia",
    apply: (r) => {
      r.camera.punchIn = true;
      r.camera.fastZoom = true;
      r.camera.punchInScale = Math.max(r.camera.punchInScale, 1.12);
    },
  },
  {
    test: /asymetr|asymmetr/i,
    meaningSk: "asymetrická kompozícia",
    apply: (r) => {
      r.aesthetic.asymmetric = true;
      if (r.composition.primary === "full_screen") r.composition.primary = "asymmetric";
    },
  },
  {
    test: /podcast|rozhovor|interview|hovoren/i,
    meaningSk: "rečník zostáva v obraze (podcastový pomer)",
    apply: (r) => {
      r.visualStructure.talkingHeadRatio = Math.max(r.visualStructure.talkingHeadRatio, 0.75);
    },
  },
  {
    test: /\bugc\b|selfie|reklam|performance|výkon/i,
    meaningSk: "UGC / výkonnostný formát",
    apply: (r) => {
      r.camera.fastZoom = true;
      r.camera.punchIn = true;
      r.typography.roles = Array.from(new Set<TypographyRole>(["statistic", ...r.typography.roles]));
    },
  },
  {
    test: /minimal|čistý|cisty|clean|jednoduch/i,
    meaningSk: "minimalistický, čistý vzhľad",
    apply: (r) => {
      r.texture.level = "clean";
      r.texture.kinds = [];
      r.aesthetic.halftone = false;
      r.aesthetic.tornEdges = false;
      r.typography.maxElementsPerScene = 1;
    },
  },
  {
    test: /film|cinematic|kino|atmosfér/i,
    meaningSk: "filmová atmosféra",
    apply: (r) => {
      r.animation.kind = "smooth";
      r.camera.whipPan = "none";
      r.texture.kinds = Array.from(new Set<string>([...r.texture.kinds, "zrnitosť"]));
      r.colorPalette = ["#0C0F14", "#D8C9A3", "#3E5C6B"];
    },
  },
  {
    test: /\bsplit\b|rozdelen|dva\s+panely/i,
    meaningSk: "delená obrazovka",
    apply: (r) => {
      r.composition.primary = "split";
    },
  },
];

/**
 * Z vlastného briefu vytvorí recept — **deterministicky** (rovnaký brief = rovnaký
 * recept), bez AI providera. Rozpoznané pojmy a farby vráti používateľovi; zvyšok
 * označí ako nerozpoznaný, aby appka nepredstierala porozumenie.
 */
export function customRecipeFromBrief(brief: string): CustomRecipeResult {
  const text = String(brief ?? "");
  const recipe: StyleRecipe = JSON.parse(JSON.stringify(CUSTOM)) as StyleRecipe;

  const recognized: BriefMatch[] = [];
  for (const rule of BRIEF_RULES) {
    const m = text.match(rule.test);
    if (!m) continue;
    rule.apply(recipe);
    recognized.push({ keyword: m[0], meaningSk: rule.meaningSk });
  }

  // Farby: `#RRGGBB` (a ich kombinácie). Berieme len platné, nič nedomýšľame.
  const hexes = Array.from(new Set((text.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map((h) => h.toUpperCase())));
  if (hexes.length > 0) {
    recipe.colorPalette = hexes.slice(0, 5);
    recognized.push({ keyword: hexes.join(", "), meaningSk: "vlastné farby z briefu" });
  }

  // Nerozpoznané: slová, ktoré nie sú v žiadnom pravidle ani farba.
  const words = text
    .split(/[\s,.;:()"'„“]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !/^#[0-9a-fA-F]{6}$/.test(w));
  const unrecognizedSk = words.filter((w) => !BRIEF_RULES.some((r) => r.test.test(w))).slice(0, 12);

  const noteSk =
    recognized.length === 0
      ? "V briefe som nerozpoznal žiadny pojem, ktorý viem preložiť na vizuálne nastavenia — použil som neutrálny základ. Nič som si nevymyslel; doladíš to v ovládačoch."
      : `Z briefu som rozpoznal ${recognized.length} pojem(nov): ${recognized.map((r) => r.meaningSk).join(", ")}.`;

  return { recipe, recognized, unrecognizedSk, noteSk };
}

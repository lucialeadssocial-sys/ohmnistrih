/**
 * KROK 26 — CREATOR REFERENCE (KTO / ODKIAĽ) + pravidlo „nie každý tvorca je preset“.
 *
 * Dve veci sa nesmú pomiešať:
 *
 *  1) **Vizuálny zdroj** — tvorca, z ktorého videí máme **namerané** hodnoty
 *     (rytmus, dĺžka záberov, svetlo, typografia). Z neho vzniká recept.
 *  2) **Pracovný zdroj** — tvorca alebo nástroj, od ktorého preberáme **postup**
 *     (workflow, delenie práce človek/AI, prompting, postprodukcia). Z neho
 *     recept NEVZNIKÁ — appka z toho nerobí vizuálny preset, lebo na to nemá
 *     namerané dáta. Namiesto toho to ukáže ako princípy a poctivo povie, že
 *     vizuál zmeraný nemá.
 *
 * Zákaz (rovnaký ako zvyšok appky): **žiadne odhady v presetoch.** Keď nemáme
 * namerané čísla, nie je recept — je to len pracovný princíp.
 */

import { getStyleRecipe, STYLE_RECIPES, type StyleRecipe } from "./styleRecipes";
import type { StylePresetId } from "./styleRecipes";

/** Odkiaľ vieme, čo o tvorcovi tvrdíme. */
export type CreatorEvidence =
  /** Zmerali sme jeho videá (pacing, dĺžka záberov, svetlo…) — dá sa z toho postaviť recept. */
  | "MEASURED"
  /** Verejne opísaný postup (jeho slová, jeho stránky, rozhovory) — princípy, nie preset. */
  | "DOCUMENTED_PRINCIPLES"
  /**
   * Vlastná referencia používateľa: zdrojom nie je cudzí tvorca, ale **tvoje**
   * médium (appka ho zmeria) a tvoje ovládače. Preto tu recept existuje — je tvoj.
   */
  | "USER_SUPPLIED";

/** Čo od tvorcu preberáme. */
export type CreatorContribution =
  | "visual_production"
  | "content_workflow"
  | "automation"
  | "ai_coding"
  | "prompting"
  | "generative_video"
  | "postproduction"
  | "editing_ux";

export interface CreatorReferenceEntry {
  id: string;
  name: string;
  /** Jednou vetou, čím je pre OmniStrih užitočný. */
  whySk: string;
  contributions: CreatorContribution[];
  evidence: CreatorEvidence;
  /** Odkiaľ presne vieme, čo tvrdíme (dohľadateľnosť, žiadne „videl som niekde“). */
  evidenceSk: string;
  /**
   * Recepty, ktoré z tohto tvorcu **naozaj** vznikli z nameraných hodnôt.
   * Prázdne = z tohto zdroja žiadny vizuálny preset nemáme (a appka to povie).
   */
  recipeIds: StylePresetId[];
  /** Čo si z neho berieme do rozhodovania (človek + AI, postup, kontrola). */
  principlesSk: string[];
  /** Čo z neho vedome NEpreberáme (hranica, aby sa nepredstieralo). */
  notTakenSk: string[];
}

export const CREATOR_REFERENCES: CreatorReferenceEntry[] = [
  {
    id: "AI_KTIVISTA",
    name: "Tomáš Jevčík / AI_KTIVISTA (Aftercode Studio) 🇸🇰",
    whySk: "Reálna produkcia: AI vizuály, reklamy pre značky, klipy — z jeho videí máme namerané hodnoty.",
    contributions: ["visual_production", "generative_video", "content_workflow"],
    evidence: "MEASURED",
    evidenceSk:
      "analýza jeho IG/TikTok videí (median_jas, median_kontrast, rezov/s, dĺžka záberu) + jeho zverejnený postup na aiktivista.sk/omnistrih.html (klipy ≤10 s, grid 1×4, 30 % rečník / 70 % podporné vizuály).",
    recipeIds: ["AI_CINEMATIC_TAKE", "EDU_WORD_TALK", "AI_CARD_DEMO"],
    principlesSk: [
      "Najprv referencia (grid / moodboard), potom prompt — bez referencie vzniká generický výsledok (jeho vlastná téza: „AI slop je technicky bezchybný, ale generický“).",
      "Svetlo, kompozícia a farby patria do zadania — inak si model vyberie najpravdepodobnejšie (= najgenerickejšie).",
      "Klipy držať krátke (do ~10 s) a strihať podľa myšlienky, nie podľa časovača.",
      "Pomer rečník/podporné vizuály riešiť vedome (u neho približne 30/70).",
    ],
    notTakenSk: [
      "Nevyrábame jeho konkrétne zábery ani jeho AI klipy — do videa idú tvoje médiá.",
      "Negenerujeme video (u nás žiadny provider na video generovanie nebeží).",
    ],
  },
  {
    id: "DENIS_VENCEL",
    name: "Denis Vencel 🇸🇰",
    whySk: "Social a content workflow: čo delegovať na AI a čo má zostať na človeku.",
    contributions: ["content_workflow", "visual_production"],
    evidence: "MEASURED",
    evidenceSk:
      "analýza jeho IG klipov (median_jas/median_kontrast, rezov/s, dĺžka záberu) — z toho sú recepty; workflow princípy sú z jeho verejne povedaného postupu.",
    recipeIds: ["FILM_MONTAGE", "EXPERT_COLLAGE_TALK", "AI_CARD_DEMO"],
    principlesSk: [
      "Vizuálny scenár píše človek — AI dostane to, kde prináša úsporu času, nie rozhodnutie o obsahu.",
      "Trend → nápad → scenár → vizuál → video: poradie sa nedá preskočiť (a appka ho rešpektuje v pláne).",
      "Strihať podľa myšlienky (nie podľa pevného intervalu).",
    ],
    notTakenSk: [
      "Nepreberáme jeho konkrétne zábery ani texty.",
      "Nepredstierame, že poznáme jeho interné rozhodnutia — berieme len to, čo je zverejnené alebo namerané.",
    ],
  },
  {
    id: "KAMIL_AUJESKY",
    name: "Kamil Aujeský 🇸🇰",
    whySk: "AI + kreativita + reálna práca: ako si AI rozdelí prácu s človekom a kde pomáha automatizácia.",
    contributions: ["content_workflow", "automation"],
    evidence: "DOCUMENTED_PRINCIPLES",
    evidenceSk:
      "zverejnené ukážky práce a postupu (AI workflow, vizuály, automatizácia). **Nemáme zmerané jeho videá**, preto z neho nevzniká žiadny vizuálny preset.",
    recipeIds: [],
    principlesSk: [
      "Workflow namiesto „jeden prompt = hotové video“: prácu rozdeľ na kroky a každý krok over.",
      "Automatizuj opakované kroky, rozhodnutia o obsahu nechaj človeku.",
      "Konzistentnosť vizuálu rieš cez jednu referenciu, nie cez nový prompt pri každom zábere.",
    ],
    notTakenSk: [
      "Žiadny vizuálny preset z neho (nemáme namerané hodnoty — a nechceme ich vymyslieť).",
      "Nepreberáme jeho konkrétne nástroje ani postupy, ktoré sme nevideli v praxi.",
    ],
  },
  {
    id: "MAREK_LISKA",
    name: "Marek Liška 🇨🇿",
    whySk: "Vibe coding a stavba vlastných AI aplikácií — ako nad nástrojom premýšľať (agenti, delenie práce).",
    contributions: ["ai_coding", "automation"],
    evidence: "DOCUMENTED_PRINCIPLES",
    evidenceSk:
      "verejne opisované skúsenosti s tvorbou AI aplikácií a agentov. **Žiadne namerané videá** → bez vizuálneho presetu.",
    recipeIds: [],
    principlesSk: [
      "Jednoduché veci nechaj jednoduché; zložité (bezpečnosť, dáta, prístupy) patria človeku.",
      "Agent má mať jasný limit a potvrdenie pred akciou, ktorá niečo míňa alebo mení.",
      "Každá automatizácia musí byť spätne dohľadateľná (čo spravila a prečo).",
    ],
    notTakenSk: [
      "Nepreberáme cudzí kód ani licencované projekty.",
      "Žiadny vizuálny preset — nešlo by o odpozorovaný štýl, ale o výmysel.",
    ],
  },
  {
    id: "MAREK_BARTOS",
    name: "Marek Bartoš 🇨🇿",
    whySk: "Prompting a praktické AI workflow vo firmách — ako zadať úlohu, aby výsledok sedel.",
    contributions: ["prompting", "content_workflow"],
    evidence: "DOCUMENTED_PRINCIPLES",
    evidenceSk: "verejne opisovaná praxe (školenia, prompting pre firmy). Bez nameraných videí → princípy, nie preset.",
    recipeIds: [],
    principlesSk: [
      "Zadanie musí obsahovať cieľ, publikum a formát — inak je výsledok náhodný.",
      "Kontrola výsledku je súčasť zadania (nie „veď to AI spraví“).",
      "Opakované zadania patria do šablóny, nie do nového promptu zakaždým.",
    ],
    notTakenSk: ["Žiadny vizuálny preset z neho.", "Nepreberáme konkrétne promptovacie postupy tretích strán."],
  },
  {
    id: "RUNWAY",
    name: "Runway / Runway Academy 🌍",
    whySk: "Generatívne video a filmový workflow — ako sa premýšľa o klipoch, ktoré sa generujú.",
    contributions: ["generative_video", "visual_production"],
    evidence: "DOCUMENTED_PRINCIPLES",
    evidenceSk: "verejne dostupné materiály k generatívnemu videu. **Nemáme namerané videá** → bez vizuálneho presetu.",
    recipeIds: [],
    principlesSk: [
      "Krátke klipy (do ~10 s) držia konzistenciu a dajú sa skladať do scény.",
      "Referenčný obrázok drží postavu a vizuálny štýl medzi klipmi.",
      "Kamera a pohyb sa zadávajú vedome — pohyb „len tak“ kazí čitateľnosť.",
    ],
    notTakenSk: [
      "U nás žiadny generatívny provider na video nebeží („Generate video“ by bol fake, tak ho nemáme).",
      "Nepreberáme ich modely ani ceny.",
    ],
  },
  {
    id: "DAVINCI_BLACKMAGIC",
    name: "Blackmagic / DaVinci Resolve 🌍",
    whySk: "Profesionálna postprodukcia — poradie prác a disciplína, ktorú má rešpektovať aj náš export.",
    contributions: ["postproduction", "editing_ux"],
    evidence: "DOCUMENTED_PRINCIPLES",
    evidenceSk: "verejne dostupné materiály k práci na časovej osi a dokončeniu videa. Bez nameraných videí → princípy.",
    recipeIds: [],
    principlesSk: [
      "Poradie prác: skladba (assembly) → hrubý strih → zvuk → obraz (farba) → dokončenie. Nestrihať do už dokončeného.",
      "Jedna časová os = jeden výstup; náhľad aj export musia ísť z tej istej osi.",
      "Zvuk je master — obraz sa mu prispôsobuje, nie naopak.",
    ],
    notTakenSk: [
      "Nepreberáme ich kód ani licencované jadro (naše jadro je Mediabunny).",
      "Nepredstierame profesionálny color grading — máme obmedzené, ale poctivé korekcie.",
    ],
  },
  {
    id: "GOOGLE_YOUTUBE_CREATE",
    name: "Google / YouTube Create 🌍",
    whySk: "UX benchmark pre AI-asistované strihanie — ako má vyzerať rozdelenie práce človek/AI v rozhraní.",
    contributions: ["editing_ux", "generative_video"],
    evidence: "DOCUMENTED_PRINCIPLES",
    evidenceSk: "verejne dokumentované funkcie (referenčné obrázky, práca so svetlom, „Edit with AI“). Bez nameraných videí.",
    recipeIds: [],
    principlesSk: [
      "AI pomáha (návrh, skrátenie, titulky), ale posledné slovo má človek — presne tak to máme v appke.",
      "Referenčné médiá a svetlo sú nastavenia, ktoré musí používateľ vidieť (nie skryté AI rozhodnutie).",
      "Nikdy nemeniť hotové video potichu — zmena musí byť viditeľná a vrátiteľná.",
    ],
    notTakenSk: ["Žiadne prevzatie ich funkcií ani modelov.", "Žiadny vizuálny preset z ich videí."],
  },
  {
    id: "CUSTOM",
    name: "Vlastná referencia (nahraj svoju) 👤",
    whySk: "Tvoja vlastná referencia: nahraj video, z ktorého chceš vychádzať — aj s vlastným svetlom.",
    contributions: ["visual_production"],
    evidence: "USER_SUPPLIED",
    evidenceSk:
      "zdrojom nie sú žiadne cudzie dáta — appka zmeria **tvoje** video (svetlo a kontrast) a použije recept CUSTOM s tvojimi nastaveniami.",
    recipeIds: ["CUSTOM"],
    principlesSk: [
      "Recept CUSTOM je tvoj: appka doň zapisuje len to, čo naozaj zmerala alebo čo si nastavil v ovládačoch.",
      "Svetlo sa dá zosúladiť s tvojou referenciou (merané, nie odhadnuté).",
    ],
    notTakenSk: ["Nepreberáme nič od cudzích tvorcov — tvoja referencia zostáva tvoja."],
  },
];

export interface CreatorResolution {
  entry: CreatorReferenceEntry | null;
  /** Vizuálny recept, ktorý z tohto zdroja naozaj máme (inak `null`). */
  recipe: StyleRecipe | null;
  /** Čo appka o zdroji poctivo hovorí (vrátane toho, čo nemá). */
  notesSk: string[];
  /** Princípy, ktoré sa zobrazia používateľovi (nie sú to rozhodnutia o obraze). */
  principlesSk: string[];
}

/**
 * Vyrieši referenciu: vráti recept len vtedy, keď naň máme namerané dáta.
 * Keď nie, vráti princípy a **poctivo povie, že vizuálny preset z toho nemá**.
 */
export function resolveCreatorReference(
  creatorId: string,
  options: { recipeId?: StylePresetId | string } = {},
): CreatorResolution {
  const entry = CREATOR_REFERENCES.find((c) => c.id === creatorId) ?? null;
  if (!entry) {
    return {
      entry: null,
      recipe: null,
      notesSk: [`Tvorcu „${creatorId}“ nepoznám — nemám z neho nič (ani princípy, ani vizuál).`],
      principlesSk: [],
    };
  }

  // Chce konkrétny recept z tohto zdroja? Povoľ len ten, ktorý naozaj patrí zdroju.
  const wanted = options.recipeId ? String(options.recipeId) : null;
  const allowed = entry.recipeIds as string[];
  if (wanted && !allowed.includes(wanted)) {
    return {
      entry,
      recipe: null,
      notesSk: [
        `Recept „${wanted}“ k zdroju ${entry.name} nepatrí — z jeho videí sme ho nemerali, preto ho nepoužijem.`,
        ...(allowed.length > 0 ? [`Z tohto zdroja máme: ${allowed.join(", ")}.`] : []),
      ],
      principlesSk: entry.principlesSk,
    };
  }
  const recipeId = wanted ?? allowed[0];

  if (!recipeId) {
    return {
      entry,
      recipe: null,
      notesSk: [
        `${entry.name}: **vizuálny preset z neho nemáme** — jeho videá sme nemerali.`,
        "Do rozhodovania vstupujú len princípy nižšie (postup, delenie práce človek/AI). Nič o obraze si nevymýšľam.",
      ],
      principlesSk: entry.principlesSk,
    };
  }

  const recipe = getStyleRecipe(recipeId);
  return {
    entry,
    recipe,
    notesSk: [
      `${entry.name}: vizuál ide z receptu „${recipe.name}“ (${entry.evidence === "MEASURED" ? "namerané hodnoty" : "princípy"}).`,
      `Zdroj: ${entry.evidenceSk}`,
    ],
    principlesSk: entry.principlesSk,
  };
}

/** Zoznam na vykreslenie do rozhrania (vizuálne zdroje prvé, potom pracovné). */
export function creatorReferenceListSk(): { id: string; name: string; kindSk: string; hasVisual: boolean }[] {
  return CREATOR_REFERENCES.map((c) => ({
    id: c.id,
    name: c.name,
    kindSk:
      c.recipeIds.length > 0
        ? `vizuálny zdroj (${c.recipeIds.length} recept${c.recipeIds.length === 1 ? "" : "y"})`
        : "pracovný zdroj (princípy, bez presetu)",
    hasVisual: c.recipeIds.length > 0,
  }));
}

/** Koľko receptov v appke vzniklo z nameraných zdrojov a ktoré (kontrola proti „vymysleným presetom“). */
export function recipesFromMeasuredSources(): { recipeId: string; sourceId: string }[] {
  const out: { recipeId: string; sourceId: string }[] = [];
  for (const c of CREATOR_REFERENCES) {
    if (c.evidence !== "MEASURED") continue;
    for (const r of c.recipeIds) out.push({ recipeId: r, sourceId: c.id });
  }
  return out;
}

/** Kontrola: každý recept, ktorý tvrdí, že je z ich videí, musí mať nameraný zdroj. */
export function recipesWithoutMeasuredSource(): string[] {
  const measured = new Set(recipesFromMeasuredSources().map((r) => r.recipeId));
  return Object.keys(STYLE_RECIPES).filter((id) => !measured.has(id));
}

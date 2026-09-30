import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { StyleStudioPanel } from "../src/components/StyleStudioPanel";
import { STYLE_FIXTURE_NOW, STYLE_FIXTURE_SEGMENTS, styleFixturePlan } from "./fixtures/styleFixture";
import { coreEngine, createInitialProject } from "../src/core";
import { applyStylePlan } from "../src/core/style/styleApply";
import { buildStylePlan } from "../src/core/style/styleIntelligence";
import { getStyleRecipe } from "../src/core/style/styleRecipes";

/**
 * I) obrazovka sa naozaj vykreslí — **server-side render** (žiadny prehliadač).
 *
 * Čo to dokazuje: komponent nespadne, vykreslí správne texty a v prázdnom stave
 * nič nepredstiera. Čo to NEDOKAZUJE: ako to vyzerá a reaguje v prehliadači
 * (klikanie, scroll) — to je browser verification, ktorá tu neprebehla.
 */

const html = (props: Partial<React.ComponentProps<typeof StyleStudioPanel>> = {}) =>
  renderToStaticMarkup(
    <StyleStudioPanel
      language="sk"
      segments={STYLE_FIXTURE_SEGMENTS}
      hasVideo
      availableSupportingVisuals={6}
      {...props}
    />,
  );

const plan = buildStylePlan({
  segments: STYLE_FIXTURE_SEGMENTS,
  recipe: getStyleRecipe("EDITORIAL_COLLAGE"),
  durationSec: 14,
  availableSupportingVisuals: 6,
  now: STYLE_FIXTURE_NOW,
});

let originalFetch: typeof globalThis.fetch;

/** Report z **reálneho** aplikovania cez reálny CommandManager (nie vymyslený objekt). */
const APPLY_REPORT = (() => {
  coreEngine.commandManager.setProject(createInitialProject("Render test — Style Apply"));
  return applyStylePlan(coreEngine, plan, { now: STYLE_FIXTURE_NOW });
})();
beforeEach(() => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("Style Studio nesmie volať žiadnu sieť/AI provider pri vykreslení");
  }) as typeof globalThis.fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("I) obrazovka sa vykreslí a hovorí pravdu", () => {
  test("vykreslí sa bez chyby a má hlavičku, recepty aj ovládače", () => {
    const out = html();
    expect(out).toContain("Style Studio — vizuálny štýl");
    expect(out).toContain("Editoriálna koláž");
    expect(out).toContain("Intenzita");
    expect(out).toContain("Rečník v obraze");
    expect(out).toContain("Pôvodné audio (voiceover)");
    expect(out).toContain("Vypočítať návrh (lokálne, bez AI)");
  });

  test("na obrazovke je viditeľné, že plán sa sám neaplikuje", () => {
    const out = html();
    expect(out).toContain("Toto je plán, nie zmenený projekt");
    expect(out).toContain("Kým v sekcii");
    expect(out).toContain("Čo tu (zatiaľ) NIE JE");
    expect(out).toContain("krok 7");
  });

  test("generované vizuály sú označené ako nedostupné, nie ako funkcia", () => {
    const out = html();
    expect(out).toContain("PROVIDER UNAVAILABLE");
  });

  test("bez prepisu obrazovka nič nepočíta a ponúkne cestu k titulkom", () => {
    const out = html({ segments: [], hasVideo: true, onOpenCaptions: () => {} });
    expect(out).toContain("potrebujem prepis (titulky)");
    expect(out).toContain("nerobím ani jedno rozhodnutie");
    expect(out).toContain("Prejsť na titulky");
    // tlačidlo výpočtu je vypnuté, keď nie sú dáta
    expect(out).toContain("disabled");
  });

  test("bez videa aj bez prepisu obrazovka nepredstiera nič", () => {
    const out = html({ segments: [], hasVideo: false });
    expect(out).toContain("zatiaľ nemá video ani prepis");
  });

  test("v plnom stave vypíše, že rozhoduje z reálnych časov (a čo nemá)", () => {
    const out = html();
    expect(out).toContain("Mám reálny prepis s časovaním po slovách");
    expect(out).toContain("Rozhodujem z viet, hustoty reči");
    // aj to, čo appka NEMÁ, je na obrazovke vidieť ešte pred výpočtom
    expect(out).toContain("diarizácia sa nerobí");
    expect(out).toContain("ANALYSIS UNAVAILABLE");
  });
});

describe("I) plán sa vykreslí s WHY / WHEN NOT / alternatívou a dôkazmi", () => {
  test("každé rozhodnutie má na obrazovke PREČO a tlačidlo na detaily", () => {
    const out = html({ initialPlan: plan });
    expect(out).toContain("PREČO:");
    expect(out).toContain("Detaily a dôkazy");
    expect(out).toContain("NÁVRH — NEAPLIKOVANÉ");
    expect(out).toContain("Bez AI (deterministické)");
  });

  test("text do obrazu je viditeľný a označený ako doslovný z vety", () => {
    const out = html({ initialPlan: plan });
    expect(out).toContain("Text v obraze (doslovne z vety)");
  });

  test("v pláne je vidieť aj to, čo engine zvážil a nevybral", () => {
    const out = html({ initialPlan: plan });
    expect(out).toContain("Čo som zvážil a nevybral");
  });

  test("štítky označenia hovoria, že sa zatiaľ neukladá", () => {
    const out = html({ initialPlan: plan });
    expect(out).toContain("len na obrazovke");
  });

  test("prázdny plán (bez dát) sa vykreslí bez rozhodnutí a s vysvetlením", () => {
    const empty = buildStylePlan({ segments: [], recipe: getStyleRecipe("MINIMAL"), now: STYLE_FIXTURE_NOW });
    const out = html({ initialPlan: empty });
    expect(out).toContain("Plán vyšiel prázdny");
    expect(out).toContain("Nemám žiadny prepis");
    expect(out).toContain("V tomto filtri nie sú žiadne rozhodnutia");
  });

  test("vykreslenie nevolá žiadnu sieť ani AI providera", () => {
    // `fetch` je v tomto teste nastavený tak, že pri volaní vyhodí chybu
    expect(() => html({ initialPlan: plan })).not.toThrow();
    expect(() => html()).not.toThrow();
  });
});

describe("J) Apply je v obrazovke poctivo zapojený", () => {
  test("bez pripojeného CommandManageru obrazovka NEaplikuje a povie to", () => {
    const out = html({ initialPlan: plan });
    expect(out).toContain("Apply nie je v tomto náhľade pripojený");
  });

  test("s pripojeným Apply je vidieť súhlas, výber a počet vybraných", () => {
    const out = html({ initialPlan: plan, onApplyStylePlan: () => null, onRollbackStyleApply: () => null });
    expect(out).toContain("Aplikovať do projektu (snapshot → CommandManager)");
    expect(out).toContain("Rozumiem: aplikovaním sa zmení projekt");
    expect(out).toContain("Vybrané na aplikovanie");
    expect(out).toContain("Vybrať všetky");
    // bez súhlasu je tlačidlo vypnuté a dôvod je napísaný
    expect(out).toContain("Vyber aspoň jedno rozhodnutie");
    expect(out).toContain("Apply zapisuje do projektu len cez existujúce príkazy");
  });

  test("report z aplikovania sa vykreslí s číslami pred/po a stavom audia", () => {
    const out = html({ initialPlan: plan, initialApplyReport: APPLY_REPORT, onApplyStylePlan: () => null, onRollbackStyleApply: () => null });
    expect(out).toContain("Aplikované:");
    expect(out).toContain("Časová os zmenená");
    expect(out).toContain("NEDOTKNUTÉ");
    expect(out).toContain("Vrátiť späť (rollback)");
    expect(out).toContain("Verzia pred zmenou");
  });
});

/**
 * KROK 26 — cieľ videa a referencia tvorcu na obrazovke.
 *
 * Dokazuje (UI PRESENT): cieľové tlačidlá a referencie sa vykreslia, pracovný
 * zdroj je označený ako „princípy“ (nie „vizuál“) a cieľ sa dá zrušiť.
 * Nedokazuje: kliknutie v prehliadači (to je browser verification) — preto nižšie
 * voláme aj reálny `buildStylePlan` a kontrolujeme, čo cieľ naozaj spravil.
 */
describe("I2) ČO (cieľ) a AKO (referencia) je na obrazovke", () => {
  test("cieľové tlačidlá a referencia tvorcov sa vykreslia", () => {
    const markup = html({});
    expect(markup).toContain('data-testid="goal-PREDAJ"');
    expect(markup).toContain('data-testid="goal-VZDELAVANIE"');
    expect(markup).toContain('data-testid="creator-AI_KTIVISTA"');
    expect(markup).toContain('data-testid="creator-DAVINCI_BLACKMAGIC"');
    expect(markup).toContain("Čo má video dosiahnuť");
    expect(markup).toContain("Podľa koho?");
  });

  test("pracovný zdroj je označený ako princípy (nie ako vizuálny preset)", () => {
    const markup = html({});
    expect(markup).toContain("princípy"); // DaVinci / Runway / Liška / Bartoš / Aujeský
    expect(markup).toContain("vizuálny zdroj");
  });

  test("plán s cieľom ukáže v obraze, čo cieľ našiel a čo v dátach chýba", () => {
    const planWithGoal = buildStylePlan({
      segments: STYLE_FIXTURE_SEGMENTS,
      recipe: getStyleRecipe("EDITORIAL_COLLAGE"),
      durationSec: 14,
      availableSupportingVisuals: 6,
      goal: "ODBER",
      now: STYLE_FIXTURE_NOW,
    });
    const markup = html({ initialPlan: planWithGoal });
    expect(markup).toContain("Zosilnené rozhodnutia");
    if ((planWithGoal.goal?.missingSk.length ?? 0) > 0) {
      expect(markup).toContain("nič som nedoplnil");
    }
    if ((planWithGoal.goal?.foundSk.length ?? 0) > 0) {
      expect(markup).toContain("V tvojom videe som našiel");
    }
  });

  test("plán bez cieľa zároveň nepredstiera cieľovú sekciu zmien", () => {
    const markup = html({ initialPlan: plan });
    expect(markup).not.toContain("Zosilnené rozhodnutia");
  });
});

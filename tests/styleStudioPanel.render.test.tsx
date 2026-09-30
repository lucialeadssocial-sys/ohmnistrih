import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { StyleStudioPanel } from "../src/components/StyleStudioPanel";
import { STYLE_FIXTURE_NOW, STYLE_FIXTURE_SEGMENTS, styleFixturePlan } from "./fixtures/styleFixture";
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

  test("na obrazovke je viditeľné, že sa nič neaplikuje (a nič neukladá)", () => {
    const out = html();
    expect(out).toContain("Toto je plán, nie zmenený projekt");
    expect(out).toContain("krok 5–6");
    expect(out).toContain("Čo tu (zatiaľ) NIE JE");
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

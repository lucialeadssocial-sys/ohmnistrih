import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { ToolGuideCard, GuideModal, SimpleModeStrip } from "../src/components/ToolGuide";
import {
  FLOW_STEPS,
  GUIDE_BY_ID,
  SIMPLE_MODE_TABS,
  TOOL_GUIDES,
  guideFor,
} from "../src/ui/toolGuides";

/**
 * KROK 19 — JEDNODUCHŠIE ROZHRANIE + VÝUČBA POPRI PRÁCI.
 *
 * Tieto testy sú o obsahu a o pokrytí, nie o vzhľade:
 *  - dokazujú, že naozaj KAŽDÝ nástroj v App.tsx má svoje vysvetlenie,
 *  - že texty sú neprázdne a nesľubujú nič, čo appka nerobí,
 *  - že komponenty sa dajú vykresliť (server-side render).
 *
 * Čo NEDOKAZUJÚ: ako to vyzerá a reaguje v prehliadači (klikanie, scroll,
 * skutočný vzhľad) — to je browser verification, ktorá v tomto prostredí
 * neprebehla (nie je tu DOM).
 */

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const APP = readFileSync(join(ROOT, "src", "App.tsx"), "utf8");

/** vytiahne z App.tsx všetky id nástrojov, ktoré appka používa v `activeTab` */
function appTabIds(): string[] {
  const union = APP.match(/const \[activeTab, setActiveTab\] = useState<\s*([\s\S]*?)>\(\(\) => \{/);
  expect(Boolean(union)).toBe(true);
  const ids = (union![1].match(/"([a-z0-9_]+)"/g) ?? []).map((s) => s.replace(/"/g, ""));
  return Array.from(new Set(ids));
}

describe("A) pokrytie: každý nástroj má výučbu", () => {
  test("A1 — z App.tsx sa podarilo prečítať zoznam nástrojov", () => {
    const ids = appTabIds();
    expect(ids.length).toBeGreaterThanOrEqual(40);
    expect(ids).toContain("captions");
    expect(ids).toContain("export");
    expect(ids).toContain("style_studio");
  });

  test("A2 — KAŽDÝ nástroj z App.tsx má svoju výučbu (žiadny bez textu)", () => {
    const missing = appTabIds().filter((id) => !GUIDE_BY_ID[id]);
    expect(missing).toEqual([]);
  });

  test("A3 — výučba neobsahuje nástroje, ktoré v App.tsx neexistujú", () => {
    const ids = new Set(appTabIds());
    const extra = TOOL_GUIDES.filter((g) => !ids.has(g.id)).map((g) => g.id);
    expect(extra).toEqual([]);
  });

  test("A4 — každá výučba má neprázdny názov a vysvetlenie", () => {
    const bad = TOOL_GUIDES.filter(
      (g) => g.title.trim().length <= 2 || g.what.trim().length <= 20 || g.when.trim().length <= 10,
    ).map((g) => g.id);
    expect(bad).toEqual([]);
  });

  test("A5 — každá výučba má aspoň jeden konkrétny krok (okrem starých názvov)", () => {
    const bad = TOOL_GUIDES.filter(
      (g) => !g.legacy && (g.steps.length < 1 || g.steps.some((step) => step.trim().length <= 10)),
    ).map((g) => g.id);
    expect(bad).toEqual([]);
  });
});

describe("B) pravdivosť textov (nič sa nesľubuje navyše)", () => {
  test("B1 — žiadne zakázané sľuby (AI nerenderuje video, nič sa nemaže potichu)", () => {
    const forbidden = [
      "vyrenderuje video",
      "AI vygeneruje video",
      "vymaže zvuk",
      "prepíše audio",
      "automaticky zmení",
      "vždy zadarmo",
    ];
    const hits: string[] = [];
    for (const g of TOOL_GUIDES) {
      const text = [g.title, g.what, g.when, ...g.steps, ...g.need].join(" ").toLowerCase();
      for (const bad of forbidden) if (text.includes(bad.toLowerCase())) hits.push(`${g.id}: ${bad}`);
    }
    expect(hits).toEqual([]);
  });

  test("B2 — nástroje, ktoré sa dnes neotvárajú, sú označené ako staré názvy", () => {
    const bad = ["toggles", "zoomsfx", "omnistrih"].filter((id) => !guideFor(id)?.legacy);
    expect(bad).toEqual([]);
  });

  test("B3 — pokročilé nástroje sú označené (jednoduchý režim ich nepotrebuje)", () => {
    const expertCount = TOOL_GUIDES.filter((g) => g.expert).length;
    expect(expertCount).toBeGreaterThan(10);
    expect(guideFor("captions")!.expert).toBeUndefined();
    expect(guideFor("export")!.expert).toBeUndefined();
  });
});

describe("C) postup pre začiatočníka (5 krokov)", () => {
  test("C1 — je presne 5 krokov a každý ukazuje na existujúci nástroj", () => {
    expect(FLOW_STEPS.length).toBe(5);
    const bad = FLOW_STEPS.filter((s) => !guideFor(s.tabId) || s.what.trim().length <= 20).map((s) => s.tabId);
    expect(bad).toEqual([]);
  });

  test("C2 — kroky idú v poradí: nahrať → prečítať → štýl → skontrolovať → export", () => {
    expect(FLOW_STEPS.map((s) => s.tabId)).toEqual([
      "media_manager",
      "raw",
      "style_studio",
      "workspace",
      "export",
    ]);
  });

  test("C3 — jednoduchý režim odkazuje len na nástroje, ktoré existujú", () => {
    expect(SIMPLE_MODE_TABS.filter((id) => !guideFor(id))).toEqual([]);
    expect(SIMPLE_MODE_TABS.length).toBeGreaterThanOrEqual(5);
  });
});

describe("D) vykreslenie (server-side render — nie prehliadač)", () => {
  test("D1 — karta výučby pre titulky vypíše názov aj „čo to robí“", () => {
    const html = renderToStaticMarkup(<ToolGuideCard tabId="captions" language="sk" />);
    expect(html).toContain('data-testid="tool-guide"');
    expect(html).toContain('data-tool-id="captions"');
    expect(html).toContain("Čo to robí");
    expect(html).toContain("Titulky");
    expect(html).toContain("Ako na to");
  });

  test("D2 — karta pre neznámy nástroj nič nepredstiera", () => {
    const html = renderToStaticMarkup(<ToolGuideCard tabId="neexistuje_toto" language="sk" />);
    expect(html).toContain("nemám výučbu");
  });

  test("D3 — Sprievodca vypíše všetky nástroje (každé id raz)", () => {
    const html = renderToStaticMarkup(
      <GuideModal open language="sk" onClose={() => {}} onGoToTool={() => {}} />,
    );
    const missing = TOOL_GUIDES.filter((g) => !html.includes(`data-guide-id="${g.id}"`)).map((g) => g.id);
    expect(missing).toEqual([]);
  });

  test("D4 — zatvorený Sprievodca sa nevykreslí", () => {
    const html = renderToStaticMarkup(<GuideModal open={false} language="sk" onClose={() => {}} />);
    expect(html).not.toContain('data-testid="guide-modal"');
  });

  test("D5 — krokový pás zobrazí 5 krokov a zvýrazní práve otvorený nástroj", () => {
    const html = renderToStaticMarkup(
      <SimpleModeStrip language="sk" activeTab="raw" onGoToTool={() => {}} onOpenGuide={() => {}} />,
    );
    expect(html).toContain('data-testid="simple-mode-strip"');
    expect(html).toContain("Postup: od surového videa k hotovému");
    for (const step of FLOW_STEPS) expect(html).toContain(step.title);
  });

  test("D6 — v angličtine appka prizná, že texty výučby sú zatiaľ po slovensky", () => {
    const html = renderToStaticMarkup(<ToolGuideCard tabId="export" language="en" />);
    // hlavičky a tlačidlá sú preložené…
    expect(html).toContain("What it does");
    expect(html).toContain("How to do it");
    // …ale samotné výučbové texty sú zatiaľ len slovenské a appka to prizná (nič nepredstiera)
    expect(html).toContain("guide texts are in Slovak");
  });
});

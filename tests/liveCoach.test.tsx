import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { LiveCoachCard } from "../src/components/LiveCoach";
import {
  FLOW_SIGNALS,
  TOOL_LIVE_STEPS,
  computeSignals,
  evaluateLiveSteps,
  flowDoneCount,
  legacyTargetFor,
  liveStepsFor,
  nextFlowTool,
  suggestedNextTool,
  verifiableCounts,
  type LiveInputs,
  type LiveSignal,
} from "../src/ui/liveCoach";
import { GUIDE_BY_ID } from "../src/ui/toolGuides";

/**
 * KROK 20 — ŽIVÝ SPRIEVODCA (výučba priamo vo funkciách, za behu).
 *
 * Testy strážia tri veci:
 *  1. kroky sa odškrtávajú LEN podľa skutočných udalostí (žiadne odhady),
 *  2. appka nikdy neodškrtne krok, ktorý nevie overiť (prizná to),
 *  3. každý nástroj má živé kroky a každý použitý signál sa naozaj niekde zapisuje.
 *
 * Čo testy NEDOKAZUJÚ: ako to vyzerá a reaguje v prehliadači (prostredie bez DOM).
 */

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const APP = readFileSync(join(ROOT, "src", "App.tsx"), "utf8");

const EMPTY: LiveInputs = { log: [], canonicalCaptions: 0, canonicalCaptionsWithWords: 0 };
const sig = (over: Partial<LiveInputs> = {}) => computeSignals({ ...EMPTY, ...over });

describe("A) kroky sa odškrtávajú len podľa skutočnosti", () => {
  test("A1 — na začiatku nie je hotový ani jeden krok", () => {
    const s = sig();
    const values = Object.values(s);
    expect(values.length).toBe(10); // 8 pôvodných + 2 z kroku 21 (B-roll, hlas)
    expect(values.every((v) => v === false)).toBe(true);
  });

  test("A2 — udalosť v logu odškrtne presne ten krok, ktorý s ňou súvisí", () => {
    const s = sig({ log: ["video_uploaded"] });
    expect(s.video_uploaded).toBe(true);
    expect(s.analysis_done).toBe(false);
    expect(s.export_finished).toBe(false);
  });

  test("A3 — titulky na canonical osi sú pravda aj bez logu (stav sa číta z osi)", () => {
    const s = sig({ canonicalCaptions: 3 });
    expect(s.captions_on_timeline).toBe(true);
    expect(s.captions_with_words).toBe(false);

    const w = sig({ canonicalCaptions: 3, canonicalCaptionsWithWords: 3 });
    expect(w.captions_with_words).toBe(true);
  });

  test("A3b — signály z vnútra nástrojov (B-roll, hlas) sa tiež riadia len udalosťou", () => {
    expect(sig().broll_applied).toBe(false);
    expect(sig().voice_added).toBe(false);
    expect(sig({ log: ["broll_applied"] }).broll_applied).toBe(true);
    expect(sig({ log: ["voice_added"] }).voice_added).toBe(true);
  });

  test("A4 — žiadny krok nie je „hotový“ z času ani z odhadu (0 px ⇒ nič hotové)", () => {
    // zámerne: rovnaký vstup dvakrát musí dať rovnaký výsledok (determinizmus)
    const a = sig({ log: ["analysis_done"] });
    const b = sig({ log: ["analysis_done"] });
    expect(a).toEqual(b);
  });
});

describe("B) kroky, ktoré appka nevie overiť, sa nikdy neodškrtnú samy", () => {
  test("B1 — ručný krok ostane „manual“, aj keď sú iné kroky hotové", () => {
    const steps = liveStepsFor("captions");
    const states = evaluateLiveSteps(steps, sig({ canonicalCaptions: 1, canonicalCaptionsWithWords: 1 }));
    const manual = states.find((s) => s.label.includes("štýl titulkov"));
    expect(manual?.status).toBe("manual");
    expect(Boolean(manual?.signal)).toBe(false);
    // a appka ho rovno označí ako krok, ktorý má človek spraviť teraz
    expect(manual?.isNext).toBe(true);
  });

  test("B2 — počet overiteľných a ručných krokov sedí s dátami", () => {
    const states = evaluateLiveSteps(liveStepsFor("jump"), sig());
    const c = verifiableCounts(states);
    expect(c.verifiableTotal).toBe(1); // „potvrď strih“ má signál
    expect(c.manualTotal).toBe(1); // „nechaj nájsť ticho“ appka nevie overiť
  });

  test("B3 — ručný krok sa zobrazí s priznaním, že ho appka nevie overiť", () => {
    const html = renderToStaticMarkup(
      <LiveCoachCard tabId="jump" signals={sig()} language="sk" />,
    );
    expect(html).toContain("appka ho nevie overiť");
  });
});

describe("C) poradie a postup", () => {
  test("C1 — „teraz“ je vždy prvý nehotový krok (a len jeden)", () => {
    const states = evaluateLiveSteps(liveStepsFor("captions"), sig());
    const current = states.filter((s) => s.isNext);
    expect(current.length).toBe(1);
    expect(current[0].label).toContain("Spusti prepis");
  });

  test("C2 — po splnení prvého kroku sa „teraz“ posunie na ďalší", () => {
    const states = evaluateLiveSteps(liveStepsFor("captions"), sig({ canonicalCaptionsWithWords: 1 }));
    expect(states[0].status).toBe("done");
    const current = states.find((s) => s.isNext);
    expect(current?.label).toContain("Vyber štýl");
  });

  test("C3 — keď je hotové všetko overiteľné, karta to povie a ponúkne ďalší nástroj", () => {
    const html = renderToStaticMarkup(
      <LiveCoachCard
        tabId="captions"
        signals={sig({ canonicalCaptions: 1, canonicalCaptionsWithWords: 1 })}
        language="sk"
        onGoToTool={() => {}}
      />,
    );
    expect(html).toContain("Hotovo — appka vidí, že máš všetko potrebné.");
    expect(html).toContain('data-testid="live-next-tool"');
    expect(html).toContain('data-status="done"');
  });

  test("C4 — 5-krokový postup sa odškrtáva podľa reálnych udalostí", () => {
    expect(flowDoneCount(sig())).toBe(0);
    expect(flowDoneCount(sig({ log: ["video_uploaded", "analysis_done"] }))).toBe(2);
    expect(
      flowDoneCount(
        sig({ log: ["video_uploaded", "analysis_done", "cuts_applied", "style_applied", "export_finished"] }),
      ),
    ).toBe(5);
  });

  test("C5 — ďalší nástroj v postupe sedí (Médiá → Analýza → Štýl → Pracovná plocha → Export)", () => {
    expect(nextFlowTool("media_manager")).toBe("raw");
    expect(nextFlowTool("raw")).toBe("style_studio");
    expect(nextFlowTool("export")).toBeNull();
  });

  test("C6 — návrh ďalšieho nástroja je vždy existujúci nástroj (a je len návrh)", () => {
    const bad = Object.keys(GUIDE_BY_ID)
      .map((id) => suggestedNextTool(id))
      .filter((t): t is string => Boolean(t))
      .filter((t) => !GUIDE_BY_ID[t]);
    expect(bad).toEqual([]);
    expect(suggestedNextTool("captions")).toBe("style_studio");
  });
});

describe("D) pokrytie: každý nástroj má živé kroky a každý signál sa naozaj zapisuje", () => {
  test("D1 — každý dnešný nástroj má aspoň jeden živý krok (staré názvy nie — tie len odkazujú)", () => {
    const legacy = new Set(Object.keys(GUIDE_BY_ID).filter((id) => GUIDE_BY_ID[id].legacy));
    const missing = Object.keys(GUIDE_BY_ID)
      .filter((id) => !legacy.has(id))
      .filter((id) => liveStepsFor(id).length === 0);
    expect(missing).toEqual([]);
  });

  test("D1b — každý starý názov ukazuje na dnešný nástroj a appka to povie", () => {
    const legacy = Object.keys(GUIDE_BY_ID).filter((id) => GUIDE_BY_ID[id].legacy);
    expect(legacy.length).toBeGreaterThan(0);
    const missingTarget = legacy.filter((id) => !legacyTargetFor(id));
    expect(missingTarget).toEqual([]);
    // a komponent to vykreslí ako poctivé nasmerovanie, nie ako „hotovo“
    const html = renderToStaticMarkup(
      <LiveCoachCard tabId="toggles" signals={sig()} language="sk" onGoToTool={() => {}} />,
    );
    expect(html).toContain('data-status="legacy"');
    expect(html).toContain("dnes neotvára samostatne");
    expect(html).toContain('data-testid="live-legacy-target"');
  });

  test("D2 — živé kroky neobsahujú nástroje, ktoré neexistujú", () => {
    const extra = Object.keys(TOOL_LIVE_STEPS).filter((id) => !GUIDE_BY_ID[id]);
    expect(extra).toEqual([]);
  });

  test("D3 — KAŽDÝ signál, ktorý kroky používajú, sa v App.tsx naozaj zapisuje", () => {
    const used = new Set<LiveSignal>();
    for (const steps of Object.values(TOOL_LIVE_STEPS)) {
      for (const s of steps) if (s.signal) used.add(s.signal);
    }
    // titulky na osi sa nečítajú z logu, ale z canonical osi (živý stav)
    const derivedFromCanonical: LiveSignal[] = ["captions_on_timeline", "captions_with_words"];
    const mustBeRecorded = [...used].filter((s) => !derivedFromCanonical.includes(s));
    const notRecorded = mustBeRecorded.filter((s) => !APP.includes(`recordLive("${s}")`));
    expect(notRecorded).toEqual([]);
  });

  test("D4 — každý krok má text a buď signál, alebo priznanie „ručné“", () => {
    const bad: string[] = [];
    for (const [id, steps] of Object.entries(TOOL_LIVE_STEPS)) {
      for (const s of steps) {
        if (!s.label || s.label.trim().length < 5) bad.push(`${id}: krátky text`);
        if (!s.signal && !s.manual) bad.push(`${id}: krok bez signálu a bez priznania`);
        if (s.signal && s.manual) bad.push(`${id}: krok nemôže byť aj signál aj ručný`);
      }
    }
    expect(bad).toEqual([]);
  });

  test("D5 — každý krok, ktorý appka vie overiť, má aj „kde to nájdeš“", () => {
    const missing: string[] = [];
    for (const [id, steps] of Object.entries(TOOL_LIVE_STEPS)) {
      for (const s of steps) if (s.signal && !s.where) missing.push(`${id}: ${s.label}`);
    }
    expect(missing).toEqual([]);
  });
});

describe("E) vykreslenie (server-side render — nie prehliadač)", () => {
  test("E1 — karta ukáže postup, „teraz“ krok a kde ho nájdeš", () => {
    const html = renderToStaticMarkup(<LiveCoachCard tabId="export" signals={sig()} language="sk" />);
    expect(html).toContain('data-testid="live-coach"');
    expect(html).toContain("Sprievodca týmto nástrojom — naživo");
    expect(html).toContain("Teraz sprav toto");
    expect(html).toContain("Kde to nájdeš");
    expect(html).toContain('data-testid="live-progress"');
  });

  test("E2 — postup ukazuje počet overiteľných krokov (nie všetkých)", () => {
    const html = renderToStaticMarkup(<LiveCoachCard tabId="export" signals={sig()} language="sk" />);
    expect(html).toContain("0 z 1 overiteľných krokov hotových");
  });

  test("E3 — nástroj bez živých krokov nič nepredstiera", () => {
    const html = renderToStaticMarkup(<LiveCoachCard tabId="neexistuje" signals={sig()} language="sk" />);
    expect(html).toContain('data-status="no-steps"');
    expect(html).toContain("nemá čo odškrtávať");
  });

  test("E4 — anglická verzia má anglické hlavičky", () => {
    const html = renderToStaticMarkup(<LiveCoachCard tabId="export" signals={sig()} language="en" />);
    expect(html).toContain("Guide for this tool — live");
    expect(html).toContain("Do this now");
    // …a prizná, že texty krokov sú zatiaľ po slovensky (nič nepredstiera)
    expect(html).toContain("Step texts are in Slovak");
  });

  test("E5 — appka píše, že odškrtnuté je len to, čo naozaj vidí", () => {
    const html = renderToStaticMarkup(<LiveCoachCard tabId="raw" signals={sig()} language="sk" />);
    expect(html).toContain("Odškrtnuté je len to, čo appka naozaj vidí");
  });
});

describe("G) krok 21 — kroky, ktoré už appka vie overiť (B-roll, hlas)", () => {
  test("G1 — krok „použi B-roll“ je overiteľný (nie ručný)", () => {
    const steps = liveStepsFor("broll");
    const applyStep = steps.find((s) => s.label.toLowerCase().includes("použi"));
    expect(Boolean(applyStep?.signal)).toBe(true);
    expect(applyStep?.manual).toBeUndefined();

    // a po reálnej udalosti sa naozaj odškrtne
    const states = evaluateLiveSteps(steps, sig({ log: ["broll_applied"] }));
    const done = states.filter((s) => s.status === "done");
    expect(done.length).toBe(1);
    expect(done[0].label.toLowerCase().includes("použi")).toBe(true);
  });

  test("G2 — krok „vlož hlas do projektu“ je overiteľný", () => {
    const steps = liveStepsFor("ai_voice");
    const voiceStep = steps.find((s) => s.label.toLowerCase().includes("hlas"));
    expect(Boolean(voiceStep?.signal)).toBe(true);
    const states = evaluateLiveSteps(steps, sig({ log: ["voice_added"] }));
    expect(states.some((s) => s.status === "done")).toBe(true);
  });

  test("G3 — hľadanie B-rollu vie appka tiež overiť (použitie záberu)", () => {
    const steps = liveStepsFor("finder");
    expect(steps.filter((s) => s.signal).length).toBe(1);
  });

  test("G4 — nič sa nepredstiera: kým sa nič nestalo, krok je neodškrtnutý", () => {
    const states = evaluateLiveSteps(liveStepsFor("broll"), sig());
    expect(states.every((s) => s.status !== "done")).toBe(true);
  });
});

describe("F) krokový pás ukazuje reálne hotové kroky", () => {
  test("F1 — pás dostane počet hotových krokov a zobrazí ho", async () => {
    const { SimpleModeStrip } = await import("../src/components/ToolGuide");
    const html = renderToStaticMarkup(
      <SimpleModeStrip language="sk" activeTab="raw" doneCount={2} nextTab="style_studio" onGoToTool={() => {}} onOpenGuide={() => {}} />,
    );
    expect(html).toContain("hotové: 2 z 5");
    expect(html).toContain('data-testid="flow-done"');
    expect(html).toContain("ďalej");
  });

  test("F2 — bez hotových krokov pás nič nepredstiera", async () => {
    const { SimpleModeStrip } = await import("../src/components/ToolGuide");
    const html = renderToStaticMarkup(
      <SimpleModeStrip language="sk" activeTab="raw" onGoToTool={() => {}} onOpenGuide={() => {}} />,
    );
    expect(html).not.toContain("hotové:");
    expect(html).toContain('data-flow-done="0"');
  });
});

import { describe, expect, test } from "bun:test";
import {
  auditPlanForVirality,
  getTrendPack,
  getPlatform,
  PLATFORMS,
  PRINCIPLES,
  HOOK_FORMULAS,
  FORMATS,
  RED_FLAGS,
  NICHES,
} from "../src/core/trends/trendLibrary";

describe("knižnica trendov", () => {
  test("každá platforma má vyplnené povinné polia", () => {
    expect(PLATFORMS.length).toBeGreaterThanOrEqual(5);
    for (const p of PLATFORMS) {
      expect(p.labelSk.length).toBeGreaterThan(0);
      expect(p.minSeconds).toBeLessThan(p.maxSeconds);
      expect(p.idealCutsPerMinute[0]).toBeLessThan(p.idealCutsPerMinute[1]);
      expect(p.noteSk.length).toBeGreaterThan(20);
    }
  });

  test("každé pravidlo má dôvod, riziko a kedy ho nepoužiť (žiadne holé tvrdenia)", () => {
    for (const item of [...PRINCIPLES, ...HOOK_FORMULAS, ...FORMATS]) {
      expect(item.whySk.length).toBeGreaterThan(30);
      expect(item.platforms.length).toBeGreaterThan(0);
    }
    for (const h of HOOK_FORMULAS) expect(h.riskSk.length).toBeGreaterThan(20);
    for (const p of PRINCIPLES) expect(p.whenNotSk.length).toBeGreaterThan(20);
    for (const f of FORMATS) expect(f.riskSk.length).toBeGreaterThan(20);
    for (const r of RED_FLAGS) expect(r.fixSk.length).toBeGreaterThan(20);
  });

  test("ochrana proti tichému klamstvu: pri ABSOLÚTNE žiadnom pravidle sa nič nesľubuje", () => {
    const suspicious = /garant|100 %|100%|zaručene|zaručené|virálne za každých/i;
    const all = [
      ...PRINCIPLES.map((p) => `${p.titleSk} ${p.whatSk} ${p.whySk}`),
      ...HOOK_FORMULAS.map((h) => `${h.titleSk} ${h.templateSk} ${h.whySk}`),
      ...FORMATS.map((f) => `${f.titleSk} ${f.howSk} ${f.whySk}`),
    ];
    for (const text of all) expect(suspicious.test(text)).toBe(false);
  });

  test("getTrendPack filtruje podľa platformy a oblasti", () => {
    const ads = getTrendPack("ADS", "ecommerce");
    const yt = getTrendPack("YOUTUBE_LONG", "b2b");
    expect(ads.hooks.length).toBeGreaterThan(0);
    expect(yt.hooks.length).toBeGreaterThan(0);
    // Reklamné hooky nesmú obsahovať čisto long-form vzorce
    for (const h of ads.hooks) expect(h.platforms).toContain("ADS");
    for (const f of yt.formats) expect(f.platforms).toContain("YOUTUBE_LONG");
    expect(NICHES.length).toBeGreaterThanOrEqual(10);
  });

  test("getPlatform vráti fallback pre neznámy vstup", () => {
    // @ts-expect-error zámerne neplatná hodnota
    expect(getPlatform("NEZNAS").id).toBe(PLATFORMS[0].id);
  });
});

describe("kontrola virality", () => {
  const goodPlan = [
    { type: "HOOK", start: 0, end: 3 },
    { type: "CAPTION", start: 0, end: 30 },
    { type: "CUT", start: 3.1, end: 4.0 },
    { type: "CUT", start: 6.2, end: 7.8 },
    { type: "CUT", start: 14.4, end: 16.0 },
    { type: "CUT", start: 22.1, end: 23.5 },
    { type: "CUT", start: 26.0, end: 27.0 },
    { type: "ZOOM", start: 8.5, end: 12 },
    { type: "SFX", start: 6.2 },
    { type: "SFX", start: 22.1 },
    { type: "HIGHLIGHT", start: 8.5, end: 14 },
    { type: "MUSIC", start: 0, end: 30 },
    { type: "CTALABEL" as string, start: 27, end: 30 },
  ];

  test("dobrý plán pre TikTok prejde s vysokým skóre", () => {
    const audit = auditPlanForVirality(goodPlan, "TIKTOK", 30);
    expect(audit.score).toBeGreaterThanOrEqual(85);
    expect(audit.checks.find((c) => c.id === "hook-3s")?.status).toBe("pass");
    expect(audit.checks.find((c) => c.id === "captions")?.status).toBe("pass");
    expect(audit.checks.find((c) => c.id === "tempo")?.status).toBe("pass");
  });

  test("prázdny plán musí nahlásiť vážne diery, nie ticho prejsť", () => {
    const audit = auditPlanForVirality([], "TIKTOK", 30);
    const fails = audit.checks.filter((c) => c.status === "fail").length;
    expect(fails).toBeGreaterThanOrEqual(3);
    expect(audit.score).toBeLessThan(60);
    // každý problém musí mať opravu a dôvod
    for (const c of audit.checks.filter((x) => x.status !== "pass")) {
      if (c.status === "fail") expect(c.fixSk).toBeTruthy();
      expect(c.whySk.length).toBeGreaterThan(20);
    }
  });

  test("hook v 8. sekunde = upozornenie, nie OK", () => {
    const audit = auditPlanForVirality([{ type: "HOOK", start: 8, end: 11 }], "REELS", 20);
    const hook = audit.checks.find((c) => c.id === "hook-3s");
    expect(hook?.status).toBe("warn");
    expect(hook?.fixSk).toBeTruthy();
  });

  test("strih cez prvú sekundu musí upozorniť (nesmie obetovať začiatok)", () => {
    const audit = auditPlanForVirality(
      [{ type: "CUT", start: 0, end: 4 }, { type: "HOOK", start: 0, end: 3 }],
      "SHORTS",
      30,
    );
    expect(audit.checks.find((c) => c.id === "first-second")?.status).toBe("warn");
  });

  test("príliš agresívny strih (viac než tretina videa) je upozornenie", () => {
    const audit = auditPlanForVirality(
      [{ type: "CUT", start: 0, end: 20 }, { type: "HOOK", start: 0, end: 3 }],
      "TIKTOK",
      40,
    );
    expect(audit.checks.find((c) => c.id === "removed-share")?.status).toBe("warn");
  });

  test("dĺžka mimo rozsahu platformy je upozornenie s konkrétnou opravou", () => {
    const audit = auditPlanForVirality([{ type: "HOOK", start: 0, end: 3 }], "TIKTOK", 400);
    const len = audit.checks.find((c) => c.id === "length");
    expect(len?.status).toBe("warn");
    expect(len?.fixSk).toContain("Skráť");
  });

  test("long-form nevyžaduje samostatný krátky klip (posledný check)", () => {
    const audit = auditPlanForVirality([{ type: "HOOK", start: 0, end: 3 }], "YOUTUBE_LONG", 600);
    expect(audit.checks.find((c) => c.id === "standalone")).toBeUndefined();
  });
});

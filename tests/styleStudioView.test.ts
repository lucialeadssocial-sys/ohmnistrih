import { describe, expect, test } from "bun:test";
import {
  applyNoticeSk,
  applySectionNoticeSk,
  confidenceViewSk,
  consideredRowsSk,
  controlValueLabelSk,
  controlViewsSk,
  decisionRowsSk,
  emptyPlanMessageSk,
  formatRangeSk,
  formatSecSk,
  kindFilterRowsSk,
  marksNoticeSk,
  missingDataNoticeSk,
  planAsTextSk,
  planBadgesSk,
  planTotalsSk,
  ratioExplanationSk,
  recipeOptionsSk,
  statusViewSk,
  supportingMediaNoticeSk,
  transcriptGateSk,
  STYLE_KIND_VISUALS,
} from "../src/core/style/styleStudioView";
import { DEFAULT_STYLE_CONTROLS } from "../src/core/style/styleDecisionTypes";
import { buildStylePlan } from "../src/core/style/styleIntelligence";
import { getStyleRecipe } from "../src/core/style/styleRecipes";
import type { SpeechSegmentLike } from "../src/core/transcript/wordTiming";
import { STYLE_FIXTURE_SEGMENTS, STYLE_FIXTURE_NOW } from "./fixtures/styleFixture";

/**
 * H) obrazovka Style Studia — unit-test verification view-modelu.
 * Obrazovka sama sa renderuje v `styleStudioPanel.render.test.tsx` (SSR).
 * **Toto nie je browser verification ani práca s reálnym videom.**
 */

const plan = () =>
  buildStylePlan({
    segments: STYLE_FIXTURE_SEGMENTS,
    recipe: getStyleRecipe("EDITORIAL_COLLAGE"),
    durationSec: 14,
    availableSupportingVisuals: 6,
    now: STYLE_FIXTURE_NOW,
  });

describe("H) recepty na obrazovke", () => {
  test("obrazovka ponúka všetkých 10 receptov s pomerom a charakterom", () => {
    const rows = recipeOptionsSk();
    expect(rows).toHaveLength(10);
    for (const r of rows) {
      expect(r.labelSk.length).toBeGreaterThan(2);
      expect(r.ratioSk).toMatch(/% rečník/);
      expect(r.summarySk.length).toBeGreaterThan(5);
    }
  });

  test("Editoriálna koláž je v zozname opísaná tak, aby sa dala vybrať bez skúšania", () => {
    const editorial = recipeOptionsSk().find((r) => r.id === "EDITORIAL_COLLAGE")!;
    expect(editorial.labelSk).toBe("Editoriálna koláž");
    expect(editorial.ratioSk).toBe("30 % rečník / 70 % vizuály");
    expect(editorial.summarySk).toMatch(/stop-motion 12 fps/);
    expect(editorial.summarySk).toMatch(/postupne/);
  });
});

describe("H) ovládače zo zadania", () => {
  test("obrazovka má všetky povinné ovládače vrátane chráneného audia", () => {
    const keys = controlViewsSk().map((v) => v.key);
    expect(keys).toEqual(["intensity", "talkingHeadRatio", "typography", "motion", "texture", "generatedVisuals", "preserveOriginalAudio"]);
  });

  test("audio je chránené a nedá sa vypnúť", () => {
    const audio = controlViewsSk().find((v) => v.key === "preserveOriginalAudio")!;
    expect(audio.kind).toBe("protected");
    expect(audio.lockedSk).toMatch(/nedá sa vypnúť/);
    expect(controlValueLabelSk(audio, { ...DEFAULT_STYLE_CONTROLS, preserveOriginalAudio: false })).toMatch(/nepodporované/);
  });

  test("rečník je predvolene na auto (rozhoduje reč, nie človek naslepo)", () => {
    const slider = controlViewsSk().find((v) => v.key === "talkingHeadRatio")!;
    expect(slider.kind).toBe("slider");
    if (slider.kind !== "slider") return;
    expect(slider.auto).toBe(true);
    expect(controlValueLabelSk(slider, DEFAULT_STYLE_CONTROLS)).toMatch(/auto/);
    expect(controlValueLabelSk(slider, { ...DEFAULT_STYLE_CONTROLS, talkingHeadRatio: 0.7 })).toBe("70 % rečník");
  });

  test("ovládač generovaných vizuálov priznáva, že provider nie je", () => {
    const gen = controlViewsSk().find((v) => v.key === "generatedVisuals")!;
    expect(gen.hintSk).toMatch(/nie je dostupné/);
    if (gen.kind !== "segmented") return;
    expect(gen.options.map((o) => o.value)).toEqual(["off", "suggested", "automatic"]);
    expect(gen.options.find((o) => o.value === "automatic")!.hintSk).toMatch(/NEDOSTUPNÉ/);
  });
});

describe("H) plán → riadky pre obrazovku", () => {
  test("čas sa zobrazuje v reálnych desatinách sekundy, nie zaokrúhlený", () => {
    expect(formatSecSk(3.9)).toBe("0:03.9");
    expect(formatSecSk(75.25)).toBe("1:15.3");
    expect(formatRangeSk(3.9, 7.4)).toBe("0:03.9 – 0:07.4 (3.5 s)");
  });

  test("každé rozhodnutie nesie WHY / WHEN NOT / alternatívu / istotu", () => {
    const rows = decisionRowsSk(plan());
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.whatSk.length).toBeGreaterThan(10);
      expect(r.whySk.length).toBeGreaterThan(10);
      expect(r.whenNotSk).toMatch(/Nepoužiť, ak/);
      expect(r.alternativeSk.length).toBeGreaterThan(5);
      expect(r.confidencePct).toBeGreaterThan(0);
      expect(r.confidencePct).toBeLessThan(100);
      expect(r.kindLabelSk).toBe(STYLE_KIND_VISUALS[r.kind].labelSk);
    }
  });

  test("text v obraze je v riadku vidieť aj s cieľom zápisu (kvôli Apply neskôr)", () => {
    const rows = decisionRowsSk(plan());
    const typo = rows.find((r) => r.kind === "typography")!;
    expect(typo.textSk).toBeTruthy();
    expect(typo.targetLabelSk).toMatch(/text:/);
    const visual = rows.find((r) => r.kind === "supporting_visual")!;
    expect(visual.targetLabelSk).toMatch(/b-roll/);
  });

  test("označenie na obrazovke prepíše stav, ale nič neukladá", () => {
    const base = plan();
    const target = base.decisions[0].id;
    const rows = decisionRowsSk(base, { [target]: "accepted" });
    expect(rows[0].statusSk).toMatch(/Súhlasím/);
    expect(rows[0].statusSk).toMatch(/neaplikované/);
    expect(statusViewSk("rejected").tone).toBe("danger");
    expect(marksNoticeSk()).toMatch(/len na obrazovke/);
  });

  test("confidence sa prekladá na slová, nie na falošnú istotu", () => {
    expect(confidenceViewSk(0.9).labelSk).toMatch(/vysoká/);
    expect(confidenceViewSk(0.6).labelSk).toMatch(/stredná/);
    expect(confidenceViewSk(0.4).labelSk).toMatch(/nižšia/);
    expect(confidenceViewSk(0.99).pct).toBe(99);
  });

  test("filtre podľa druhu sedia s počtami v pláne", () => {
    const p = plan();
    const filters = kindFilterRowsSk(p);
    const sum = filters.reduce((s, f) => s + f.count, 0);
    expect(sum).toBe(p.decisions.length);
    expect(filters.length).toBeGreaterThan(0);
  });

  test("vynechané nápady majú čas, aby sa dalo pozrieť aj na to, čo sa nevybralo", () => {
    const rows = consideredRowsSk(plan());
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.whenLabelSk).toMatch(/^\d+:\d{2}\.\d$/);
      expect(r.reasonSk.length).toBeGreaterThan(10);
    }
  });

  test("súhrn a vysvetlenie pomeru sú čitateľné a úplné", () => {
    const p = plan();
    const totals = planTotalsSk(p);
    expect(totals.find((t) => t.labelSk === "Rozhodnutí")!.valueSk).toBe(String(p.decisions.length));
    expect(totals.find((t) => t.labelSk === "Presnosť časov")!.valueSk).toMatch(/po slovách/);
    const ratio = ratioExplanationSk(p);
    expect(ratio.headlineSk).toMatch(/Rečník v obraze: \d+ %/);
    expect(ratio.linesSk.length).toBeGreaterThan(0);
  });

  test("štítky na obrazovke vždy hovoria, že ide o NÁVRH (nikdy „hotovo“)", () => {
    const badges = planBadgesSk(plan());
    expect(badges[0].labelSk).toBe("NÁVRH — NEAPLIKOVANÉ");
    expect(badges.some((b) => b.labelSk.includes("PROVIDER UNAVAILABLE"))).toBe(true);
    expect(badges.some((b) => b.labelSk.includes("Bez AI"))).toBe(true);
  });
});

describe("H) poctivé hlášky obrazovky", () => {
  test("bez prepisu obrazovka nič nepočíta a povie prečo", () => {
    const gate = transcriptGateSk(0, 0, true);
    expect(gate.ready).toBe(false);
    expect(gate.bodySk).toMatch(/nerobím ani jedno rozhodnutie/);
    expect(gate.actionSk).toBeTruthy();
    expect(emptyPlanMessageSk(null)).toBeNull();
  });

  test("s prepisom bez časov slov obrazovka prizná nižšiu presnosť", () => {
    const gate = transcriptGateSk(5, 0, true);
    expect(gate.ready).toBe(true);
    expect(gate.titleSk).toMatch(/bez časovania po slovách/);
  });

  test("s plnými dátami obrazovka povie, z čoho rozhoduje", () => {
    const gate = transcriptGateSk(5, 120, true);
    expect(gate.titleSk).toMatch(/reálny prepis/);
    expect(gate.bodySk).toMatch(/hustoty reči/);
  });

  test("počet podporných médií je v hláške vidieť (vrátane nuly)", () => {
    expect(supportingMediaNoticeSk(0)).toMatch(/nemáš žiadne/);
    expect(supportingMediaNoticeSk(4)).toMatch(/4/);
    expect(supportingMediaNoticeSk(undefined)).toMatch(/Neviem/);
  });

  test("chýbajúce dáta sú vypísané aj v pláne", () => {
    const notice = missingDataNoticeSk(plan());
    expect(notice).toMatch(/rečníka/);
    expect(notice).toMatch(/scén/);
  });

  test("notice o Apply je jednoznačný: nič sa nezmení, kým človek neklikne", () => {
    expect(applyNoticeSk()).toMatch(/nie zmenený projekt/);
    expect(applyNoticeSk()).toMatch(/nezmení/);
    expect(applyNoticeSk()).toMatch(/snapshot|verzia/);
    expect(applyNoticeSk()).toMatch(/CommandManager/);
    expect(applySectionNoticeSk(true)).toMatch(/existujúce príkazy/);
    expect(applySectionNoticeSk(false)).toMatch(/nie je v tomto náhľade pripojený/);
  });
});

describe("H) plán ako text na skopírovanie", () => {
  test("text obsahuje všetky časti rozhodnutia aj upozornenie o neaplikovaní", () => {
    const text = planAsTextSk(plan());
    expect(text).toMatch(/STYLE PLAN/);
    expect(text).toMatch(/ČO:/);
    expect(text).toMatch(/PREČO:/);
    expect(text).toMatch(/KEDY NIE:/);
    expect(text).toMatch(/ALTERNATÍVA:/);
    expect(text).toMatch(/ISTOTA:/);
    expect(text).toMatch(/ORIGINAL_VO_MASTER/);
    expect(text).toMatch(/Apply/);
    expect(text).toMatch(/ZVÁŽENÉ A NEVYBRANÉ/);
  });

  test("dvakrát rovnaký plán = dvakrát rovnaký text (dá sa poslať klientovi)", () => {
    expect(planAsTextSk(plan())).toBe(planAsTextSk(plan()));
  });
});

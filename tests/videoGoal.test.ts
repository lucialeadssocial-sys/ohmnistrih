import { describe, expect, test } from "bun:test";
import { VIDEO_GOALS, VIDEO_GOAL_IDS, findMarkers, goalRequirementsReport, scoreSentenceForGoal } from "../src/core/style/videoGoal";
import { buildStylePlan } from "../src/core/style/styleIntelligence";
import {
  CREATOR_REFERENCES,
  creatorReferenceListSk,
  recipesWithoutMeasuredSource,
  resolveCreatorReference,
} from "../src/core/style/creatorReference";

/**
 * KROK 26 — VIDEO GOAL (ČO má video dosiahnuť) + CREATOR REFERENCE (AKO).
 *
 * Testy strážia tri veci, na ktorých stojí celá dôvera:
 *  A) cieľ nemení štýl, ale rozhodovanie — a zmení ho naozaj,
 *  B) bez cieľa je plán PRESNE taký ako predtým (žiadna regresia),
 *  C) appka si nič nevymýšľa: chýbajúcu výzvu (CTA) nedoplní, len to povie.
 */

const segments = [
  { start: 0, end: 2.4, text: "Za päť minút ti ukážem, ako sa za mesiac zdvojnásobil predaj." },
  { start: 3.0, end: 6.2, text: "Najprv som si myslel, že stačí pridať produkt do ponuky." },
  { start: 6.6, end: 10.0, text: "Potom sa ma zákazníci začali pýtať, či to naozaj funguje aj v malom meste." },
  { start: 10.4, end: 13.5, text: "Výsledok bol 40 percent nových objednávok za jediný mesiac." },
  { start: 14.0, end: 17.0, text: "Napíš mi do správy a pošlem ti postup, ktorý používam." },
];

const words = segments.flatMap((s) => {
  const parts = s.text.split(" ");
  const step = (s.end - s.start) / parts.length;
  return parts.map((w, i) => ({ word: w, start: s.start + i * step, end: s.start + (i + 1) * step }));
});

const planFor = (goal?: string) =>
  buildStylePlan({
    segments: segments.map((s) => ({ ...s })) as never,
    recipe: "EDITORIAL_COLLAGE",
    durationSec: 17,
    availableSupportingVisuals: 2,
    ...(goal ? { goal } : {}),
    now: 1759219200000,
  });

describe("A) Video Goal mení rozhodovanie, nie štýl", () => {
  test("A1 — deväť cieľov existuje a každý má stratégiu, ktorá sa líši", () => {
    expect(VIDEO_GOAL_IDS.length).toBe(9);
    const strategies = new Set(VIDEO_GOALS.PREDAJ.strategySk);
    expect(strategies.size).toBe(VIDEO_GOALS.PREDAJ.strategySk.length);
    expect(VIDEO_GOALS.VZDELAVANIE.strategySk).not.toEqual(VIDEO_GOALS.PREDAJ.strategySk);
  });

  test("A2 — rovnaký recept, dva ciele ⇒ plán nesie iný cieľ a iné dôrazy", () => {
    const predaj = planFor("PREDAJ");
    const vzdelavanie = planFor("VZDELAVANIE");
    expect(predaj.goal?.id).toBe("PREDAJ");
    expect(vzdelavanie.goal?.id).toBe("VZDELAVANIE");
    // Rozdiel musí byť viditeľný v rozhodnutiach, nie len v texte plánu.
    const texts = (plan: typeof predaj) => plan.decisions.map((d) => d.style?.whatSk ?? "").join("|");
    expect(texts(predaj)).not.toBe(texts(vzdelavanie));
  });

  test("A3 — každé rozhodnutie má pri cieli dohľadateľný goalFit (prečo patrí cieľu)", () => {
    const plan = planFor("PREDAJ");
    const withFit = plan.decisions.filter((d) => typeof d.style?.goalFit === "number");
    expect(withFit.length).toBeGreaterThan(0);
    expect(withFit.every((d) => d.style?.goalId === "PREDAJ")).toBe(true);
    expect(withFit.every((d) => (d.style?.goalFitSk ?? []).length > 0)).toBe(true);
  });

  test("A4 — vzdelávanie utlmí pohyb (miernejší obraz) a povie to", () => {
    const bez = planFor();
    const skola = planFor("VZDELAVANIE");
    const motion = (p: typeof bez) => p.decisions.filter((d) => d.style?.kind === "motion").length;
    expect(motion(skola)).toBeLessThanOrEqual(motion(bez));
    const demoted = skola.considered.filter((c) => c.reasonSk.includes("utlmil"));
    if (motion(skola) < motion(bez)) {
      expect(demoted.length).toBeGreaterThan(0);
      expect(demoted[0].reasonSk).toContain("jasnosť pred efektom");
    }
  });

  test("A5 — predaj pridá dôraz na vetu s ponukou a číslom (deterministicky)", () => {
    const plan = planFor("PREDAJ");
    const promoted = plan.goal?.promotedCount ?? 0;
    expect(promoted).toBeGreaterThan(0);
    const typography = plan.decisions.filter((d) => d.style?.kind === "typography");
    // Aspoň jedno rozhodnutie musí stáť na vete s číslom alebo slovom cieľa.
    const grounded = typography.some((d) =>
      (d.style!.evidenceSk.join(" ").includes("číslo") || (d.style!.goalFitSk ?? []).some((r) => r.includes("slová cieľa"))),
    );
    expect(grounded).toBe(true);
  });
});

describe("B) Bez cieľa sa plán NEMENÍ (žiadna regresia)", () => {
  test("B1 — plán bez cieľa nemá pole goal a nemá rozhodnutia s goalFit", () => {
    const plan = planFor();
    expect(plan.goal).toBeUndefined();
    expect(plan.decisions.every((d) => d.style?.goalFit === undefined)).toBe(true);
  });

  test("B2 — neznámy cieľ sa prizná a plán zostane bez zmien", () => {
    const plan = planFor("NEEXISTUJE");
    expect(plan.goal).toBeUndefined();
    expect(plan.notesSk.some((n) => n.includes("Cieľ „NEEXISTUJE“ nepoznám"))).toBe(true);
  });

  test("B3 — dva behy s tým istým cieľom dajú presne tie isté rozhodnutia (determinizmus)", () => {
    const a = planFor("ODBER");
    const b = planFor("ODBER");
    expect(a.decisions.map((d) => d.id)).toEqual(b.decisions.map((d) => d.id));
    expect(a.goal).toEqual(b.goal);
  });
});

describe("C) Poctivosť: appka si nič nedopisuje", () => {
  test("C1 — keď vo videe NIE JE výzva na sledovanie, appka to povie a CTA nedoplní", () => {
    const bezCta = buildStylePlan({
      segments: [{ start: 0, end: 3, text: "Toto je moje video o strihaní a učení." }] as never,
      recipe: "EDITORIAL_COLLAGE",
      durationSec: 3,
      goal: "ODBER",
      now: 1759219200000,
    });
    expect(bezCta.goal?.missingSk.join(" ")).toContain("výzva na akciu");
    expect(bezCta.notesSk.some((n) => n.includes("nedopisujem ju"))).toBe(true);
    // Žiadne vygenerované CTA slová v textoch rozhodnutí.
    const texts = bezCta.decisions.map((d) => d.style?.action.typographyText ?? "").join(" ");
    expect(texts.toLowerCase()).not.toContain("sleduj");
    expect(texts.toLowerCase()).not.toContain("odber");
  });

  test("C2 — keď vo videe je výzva, cieľ ju zvýrazní (a text je doslovne z vety)", () => {
    const sCta = buildStylePlan({
      segments: [{ start: 0, end: 3, text: "Ak ti to pomohlo, sleduj ma pre ďalšie videá." }] as never,
      recipe: "EDITORIAL_COLLAGE",
      durationSec: 3,
      goal: "ODBER",
      now: 1759219200000,
    });
    expect(sCta.goal?.foundSk.join(" ")).toContain("výzva na akciu");
    const ctaDecisions = sCta.decisions.filter((d) => (d.style?.signals ?? []).includes("call_to_action"));
    expect(ctaDecisions.length).toBeGreaterThan(0);
    expect(ctaDecisions[0].style?.action.typographyText ?? "").toContain("sleduj");
  });

  test("C3 — chýbajúce veci idú do „zvážené“ (vidno, že o nich appka vie a nič nevyrábala)", () => {
    const plan = planFor("KOMENTARE");
    const missing = plan.considered.filter((c) => c.reasonSk.includes("Cieľ 💬") || c.reasonSk.includes("vyžaduje"));
    expect(plan.goal?.missingSk.length).toBeGreaterThan(0);
    expect(missing.length).toBeGreaterThan(0);
  });

  test("C4 — skóre vety sa počíta z reálnych vlastností (otázka, číslo, emócia)", () => {
    const goal = VIDEO_GOALS.KOMENTARE;
    const question = scoreSentenceForGoal(
      { index: 0, text: "Súhlasíš s tým?", start: 0, end: 2, durationSec: 2, isQuestion: true },
      goal,
      { totalSentences: 1 },
    );
    const plain = scoreSentenceForGoal(
      { index: 1, text: "Dnes je utorok.", start: 2, end: 4, durationSec: 2 },
      goal,
      { totalSentences: 1 },
    );
    expect(question.score).toBeGreaterThan(plain.score);
    expect(question.reasonsSk).toContain("otázka");
  });
});

describe("D) Creator Reference — nie každý tvorca je preset", () => {
  test("D1 — vizuálne zdroje majú recepty, pracovné zdroje nemajú (a appka to povie)", () => {
    const ktivista = resolveCreatorReference("AI_KTIVISTA");
    expect(ktivista.recipe).not.toBeNull();
    expect(ktivista.entry?.evidence).toBe("MEASURED");

    const liska = resolveCreatorReference("MAREK_LISKA");
    expect(liska.recipe).toBeNull();
    expect(liska.notesSk.join(" ")).toContain("vizuálny preset z neho nemáme");
    expect(liska.principlesSk.length).toBeGreaterThan(0);
  });

  test("D2 — z tvorcu bez nameraných videí sa NIKDY nevyrobí recept", () => {
    for (const c of CREATOR_REFERENCES) {
      // „CUSTOM“ nie je cudzí tvorca — je to vlastná referencia používateľa
      // (zdrojom je jeho vlastné médium), preto tam recept je a má byť.
      if (c.evidence === "MEASURED" || c.evidence === "USER_SUPPLIED") continue;
      expect(c.recipeIds.length).toBe(0);
      expect(resolveCreatorReference(c.id).recipe).toBeNull();
    }
  });

  test("D3 — recept, ktorý k zdroju nepatrí, sa neprijme", () => {
    const r = resolveCreatorReference("KAMIL_AUJESKY", { recipeId: "AI_CINEMATIC_TAKE" });
    expect(r.recipe).toBeNull();
    expect(r.notesSk.join(" ")).toContain("nepatrí");
  });

  test("D4 — vlastná referencia (Custom) existuje a má recept CUSTOM", () => {
    const custom = resolveCreatorReference("CUSTOM");
    expect(custom.recipe?.id).toBe("CUSTOM");
  });

  test("D5 — každý recept, ktorý tvrdí, že je z ich videí, má nameraný zdroj", () => {
    const bez = recipesWithoutMeasuredSource();
    // Recepty, ktoré nie sú z konkrétneho tvorcu (EDITORIAL_COLLAGE, MINIMAL…), sú v poriadku —
    // ide o to, že TVRDENIE o pôvode sa nesmie vymyslieť.
    const claimed = CREATOR_REFERENCES.flatMap((c) => (c.evidence === "MEASURED" ? c.recipeIds : []));
    for (const id of claimed) expect(bez).not.toContain(id);
  });

  test("D6 — zoznam do rozhrania rozlišuje vizuálny a pracovný zdroj", () => {
    const list = creatorReferenceListSk();
    expect(list.length).toBe(CREATOR_REFERENCES.length);
    expect(list.find((x) => x.id === "AI_KTIVISTA")?.hasVisual).toBe(true);
    expect(list.find((x) => x.id === "DAVINCI_BLACKMAGIC")?.hasVisual).toBe(false);
    expect(list.find((x) => x.id === "DAVINCI_BLACKMAGIC")?.kindSk).toContain("princípy");
  });

  test("D7 — užívateľské pravidlo: creator hovorí AKO, goal hovorí ČO (nikdy naopak)", () => {
    // Goal nesmie meniť recept; creator nesmie meniť cieľové rozhodnutia sám.
    const plan = planFor("PREDAJ");
    expect(plan.recipeId).toBe("EDITORIAL_COLLAGE");
    expect(plan.goal?.id).toBe("PREDAJ");
    expect(plan.goal?.strategySk.length).toBeGreaterThan(2);
  });
});

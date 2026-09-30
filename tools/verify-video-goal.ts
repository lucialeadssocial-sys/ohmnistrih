/**
 * KROK 26 — dôkaz na REÁLNOM prepise: to isté video × rôzne ciele.
 *
 * Čo to meria (a čo je pravda):
 *  - vstup je **reálny prepis** (`/home/user/real-media/segments-krok18.json`),
 *    ktorý vznikol z reálneho hovoreného videa (nie vymyslené vety),
 *  - recept je **pevný** (rovnaký pre všetky behy) — takže každý rozdiel
 *    v rozhodnutiach môže pochádzať LEN z cieľa,
 *  - meria sa: koľko rozhodnutí cieľ pridal/utlmil, ktoré typy sa zmenili,
 *    a či sa zmenil text dôrazu (doslovne z vety),
 *  - keď cieľ niečo v dátach nemá (výzva na akciu, otázka, číslo), zapíše sa to
 *    ako „chýba“ — appka to nedopĺňa.
 *
 * Tento skript **NEGENERUJE video** a nič neaplikuje do projektu. Je to meranie
 * plánu. (Apply a export sú samostatné kroky cez CommandManager.)
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { buildStylePlan } from "../src/core/style/styleIntelligence";
import { VIDEO_GOALS, VIDEO_GOAL_IDS } from "../src/core/style/videoGoal";
import { getStyleRecipe } from "../src/core/style/styleRecipes";
import { CREATOR_REFERENCES, resolveCreatorReference } from "../src/core/style/creatorReference";

const SEGMENTS_PATH = process.env.GOAL_SEGMENTS ?? "/home/user/real-media/segments-krok18.json";
const RECIPE = (process.env.GOAL_RECIPE ?? "EDITORIAL_COLLAGE") as never;
const OUT_DIR = process.env.GOAL_OUT ?? "/home/user/kontrola-ciel";
const NOW = 1759219200000;

type Row = {
  goalId: string;
  labelSk: string;
  decisions: number;
  promoted: number;
  demoted: number;
  byKind: Record<string, number>;
  texts: string[];
  foundSk: string[];
  missingSk: string[];
};

function main() {
  const segments = JSON.parse(readFileSync(SEGMENTS_PATH, "utf-8"));
  const durationSec = segments.reduce((m: number, s: any) => Math.max(m, Number(s.end) || 0), 0);
  const recipe = getStyleRecipe(RECIPE as string);

  mkdirSync(OUT_DIR, { recursive: true });

  const planFor = (goal?: string) =>
    buildStylePlan({
      segments,
      recipe,
      durationSec,
      availableSupportingVisuals: 3,
      ...(goal ? { goal } : {}),
      now: NOW,
    });

  const baseline = planFor();
  const baseSig = (p: ReturnType<typeof planFor>) =>
    p.decisions
      .map((d) => `${d.type}|${d.style?.kind ?? ""}|${d.style?.whenSk.startSec ?? 0}|${d.style?.action.typographyRole ?? ""}`)
      .join(",");

  const rows: Row[] = [];
  for (const id of VIDEO_GOAL_IDS) {
    const plan = planFor(id);
    const byKind: Record<string, number> = {};
    for (const d of plan.decisions) byKind[d.style?.kind ?? d.type] = (byKind[d.style?.kind ?? d.type] ?? 0) + 1;
    rows.push({
      goalId: id,
      labelSk: VIDEO_GOALS[id].labelSk,
      decisions: plan.decisions.length,
      promoted: plan.goal?.promotedCount ?? 0,
      demoted: plan.goal?.demotedCount ?? 0,
      byKind,
      texts: plan.decisions
        .filter((d) => d.style?.kind === "typography")
        .map((d) => `${d.style!.whenSk.startSec}s „${d.style!.action.typographyText ?? ""}“${d.style!.action.typographyRole === "emphasis" ? " (dôraz)" : ""}`),
      foundSk: plan.goal?.foundSk ?? [],
      missingSk: plan.goal?.missingSk ?? [],
    });
  }

  // Rozdiely proti plánu bez cieľa — číselne, nie dojmom.
  const diffs: Record<string, { same: boolean; diffSk: string[]; reasonSk: string | null }> = {};
  for (const id of VIDEO_GOAL_IDS) {
    const plan = planFor(id);
    const sig = baseSig(plan);
    const base = baseSig(baseline);
    const diffSk: string[] = [];
    if (plan.decisions.length !== baseline.decisions.length) {
      diffSk.push(`počet rozhodnutí ${baseline.decisions.length} → ${plan.decisions.length}`);
    }
    const kinds = (p: typeof plan) => {
      const m: Record<string, number> = {};
      for (const d of p.decisions) m[d.style?.kind ?? d.type] = (m[d.style?.kind ?? d.type] ?? 0) + 1;
      return m;
    };
    const bk = kinds(baseline);
    const pk = kinds(plan);
    for (const k of new Set([...Object.keys(bk), ...Object.keys(pk)])) {
      if ((bk[k] ?? 0) !== (pk[k] ?? 0)) diffSk.push(`${k}: ${bk[k] ?? 0} → ${pk[k] ?? 0}`);
    }
    const baseTexts = baseline.decisions.filter((d) => d.style?.kind === "typography").map((d) => d.style!.action.typographyRole + ":" + (d.style!.action.typographyText ?? ""));
    const planTexts = plan.decisions.filter((d) => d.style?.kind === "typography").map((d) => d.style!.action.typographyRole + ":" + (d.style!.action.typographyText ?? ""));
    const addedTexts = planTexts.filter((t) => !baseTexts.includes(t));
    if (addedTexts.length) diffSk.push(`texty navyše: ${addedTexts.join(" / ")}`);
    const changedRole = planTexts.filter((t, i) => baseTexts[i] && baseTexts[i].split(":")[0] !== t.split(":")[0]);
    if (changedRole.length) diffSk.push(`zmenená sila textu: ${changedRole.join(" / ")}`);
    const same = sig === base;
    diffs[id] = {
      same,
      diffSk,
      // Poctivosť: keď cieľ nemenil nič, musí byť vidieť PREČO (nie ticho).
      reasonSk: same ? (plan.goal?.notesSk.find((n) => n.includes("nemenil rozhodnutia")) ?? null) : null,
    };
  }

  const report = {
    krok: 26,
    co: "Video Goal (ČO) nad existujúcim StylePlan/EditDecision — meranie na reálnom prepise",
    vstup: { segments: SEGMENTS_PATH, segmentCount: segments.length, durationSec, recipe: recipe.id, recipeLabelSk: recipe.labelSk },
    baseline: {
      goal: null,
      decisions: baseline.decisions.length,
      typography: baseline.decisions.filter((d) => d.style?.kind === "typography").length,
      motion: baseline.decisions.filter((d) => d.style?.kind === "motion").length,
    },
    ciele: rows.map((r) => ({ ...r, notesSk: planFor(r.goalId).goal?.notesSk ?? [] })),
    rozhodnutiaSCielom: rows.reduce((sum, r) => sum + r.decisions, 0),
    rozdielyProtiBezCiela: diffs,
    tvorcovia: CREATOR_REFERENCES.map((c) => ({
      id: c.id,
      name: c.name,
      evidence: c.evidence,
      recepty: c.recipeIds,
      vyriesene: resolveCreatorReference(c.id).recipe?.id ?? null,
      poznamkaSk: resolveCreatorReference(c.id).notesSk[0],
    })),
    poznamka:
      "Video sa NEgeneruje a nič sa neaplikuje — ide o meranie plánu (EditDecision) na reálnom prepise. Apply/export je samostatný krok cez CommandManager.",
  };

  const outPath = `${OUT_DIR}/video-goal-merania.json`;
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(`Vstup: ${SEGMENTS_PATH} (${segments.length} viet, ${durationSec.toFixed(1)} s), recept ${recipe.id}`);
  console.log(`Bez cieľa: ${baseline.decisions.length} rozhodnutí\n`);
  console.log("Cieľ".padEnd(16), "rozh.".padStart(6), "+".padStart(4), "-".padStart(4), "  rozdiel proti plánu bez cieľa");
  for (const r of rows) {
    const d = diffs[r.goalId];
    const diff = d.same ? `BEZ ZMENY — ${d.reasonSk ?? "dôvod nezaznamenaný"}` : d.diffSk.join(" | ");
    console.log(`${r.labelSk.padEnd(16)}${String(r.decisions).padStart(6)}${String(r.promoted).padStart(4)}${String(r.demoted).padStart(4)}  ${diff}`);
  }
  console.log("\nPoctivé priznania (čo cieľ v dátach nenašiel):");
  for (const r of rows) {
    if (r.missingSk.length) console.log(`- ${r.labelSk}: ${r.missingSk.join("; ")}`);
  }
  console.log(`\nUložené: ${outPath}`);
}

main();

/**
 * KROK 26 — dôkaz, že CIEEĽ sa naozaj dostane do CANONICAL OSI (nie len do plánu).
 *
 * Postup (všetko na REÁLNOM médiu a reálnom prepise):
 *  1. postaví projekt z reálneho videa (`/home/user/real-media/real_speech.mp4`),
 *  2. pripraví plán BEZ cieľa a plány s tromi cieľmi (PREDAJ / ODBER / VZDELAVANIE)
 *     — recept je pre všetky **rovnaký**,
 *  3. každý plán **naozaj aplikuje** cez existujúci `applyStylePlan` →
 *     snapshot → CommandManager → canonical timeline,
 *  4. po každom behu zmeria canonical stav (fingerprint) a hneď vráti späť (rollback),
 *  5. zapíše, či sa canonical stav líši (BEFORE ≠ AFTER) a či sa líši MEDZI cieľmi.
 *
 * Čo to NEDOKAZUJE: vyexportované video (render sa tu nespúšťa). To je samostatná
 * úroveň dôkazu — REAL EXPORT — a musí sa overiť zvlášť.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { coreEngine } from "../src/core/index";
import { applyStylePlan, rollbackStyleApply, fingerprintStyleState } from "../src/core/style/styleApply";
import { buildStylePlan } from "../src/core/style/styleIntelligence";
import { getStyleRecipe } from "../src/core/style/styleRecipes";
import { buildRealProjectForExport } from "./verify-style-real-media";

const SEGMENTS_PATH = process.env.GOAL_SEGMENTS ?? "/home/user/real-media/segments-krok18.json";
const SOURCE = process.env.GOAL_SOURCE ?? "/home/user/real-media/real_speech.mp4";
const RECIPE = "EDITORIAL_COLLAGE";
const GOALS = ["PREDAJ", "ODBER", "VZDELAVANIE"] as const;
const NOW = 1759219200000;

function main() {
  const segments = JSON.parse(readFileSync(SEGMENTS_PATH, "utf-8"));
  const durationSec = segments.reduce((m: number, s: any) => Math.max(m, Number(s.end) || 0), 0);
  const media = readFileSync(SOURCE);
  const recipe = getStyleRecipe(RECIPE);

  const run = (goal?: string) => {
    const project = buildRealProjectForExport(media, SOURCE, durationSec);
    (coreEngine as any).commandManager.setProject(project);
    const plan = buildStylePlan({
      segments,
      recipe,
      durationSec,
      availableSupportingVisuals: 3,
      ...(goal ? { goal } : {}),
      now: NOW,
    });
    const before = fingerprintStyleState(coreEngine.getProject());
    const report: any = applyStylePlan(coreEngine as any, plan, { now: NOW });
    const after = fingerprintStyleState(coreEngine.getProject());
    // Presný rollback — aby ďalší beh začínal z rovnakého stavu.
    const rollback: any = rollbackStyleApply(coreEngine as any, report, { now: NOW });
    const restored = fingerprintStyleState(coreEngine.getProject());
    return {
      goal: goal ?? null,
      planId: plan.id,
      decisions: plan.decisions.length,
      applyOk: report?.ok === true,
      appliedCount: report?.appliedCount ?? 0,
      editsInProject: after.decisions,
      before,
      after,
      changed: JSON.stringify(before) !== JSON.stringify(after),
      rollbackRestored: JSON.stringify(before) === JSON.stringify(restored),
      rollbackOk: rollback?.ok === true,
      goalFitCount: plan.decisions.filter((d) => typeof d.style?.goalFit === "number").length,
    };
  };

  const results = [run(), ...GOALS.map((g) => run(g))];

  // Porovnanie canonical stavu medzi cieľmi (voči behu bez cieľa).
  const byGoal: Record<string, string> = {};
  for (const r of results) byGoal[String(r.goal)] = JSON.stringify(r.after);

  const pairwise: { a: string; b: string; differentCanonical: boolean }[] = [];
  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      pairwise.push({
        a: String(results[i].goal),
        b: String(results[j].goal),
        differentCanonical: byGoal[String(results[i].goal)] !== byGoal[String(results[j].goal)],
      });
    }
  }

  const report = {
    krok: 26,
    co: "Video Goal → canonical timeline (cez snapshot + CommandManager), na reálnom médiu a reálnom prepise",
    vstup: { source: SOURCE, bytes: media.length, segments: SEGMENTS_PATH, durationSec, recipe: RECIPE },
    behy: results,
    rovnakyCanonical: pairwise.filter((p) => !p.differentCanonical).map((p) => `${p.a} vs ${p.b}`),
    roznyCanonical: pairwise.filter((p) => p.differentCanonical).map((p) => `${p.a} vs ${p.b}`),
    poznamka:
      "Aplikované a vrátené späť na reálnom projekte. Video sa NErenderuje — render/export je samostatná úroveň dôkazu (REAL EXPORT).",
  };

  mkdirSync("/home/user/kontrola-ciel", { recursive: true });
  writeFileSync("/home/user/kontrola-ciel/video-goal-canonical.json", JSON.stringify(report, null, 2));

  console.log(`Vstup: ${SOURCE} (${media.length} B), prepis ${segments.length} viet, recept ${RECIPE}`);
  for (const r of results) {
    console.log(
      `${String(r.goal ?? "bez cieľa").padEnd(14)} rozhodnutí ${String(r.decisions).padStart(3)} | apply ${r.applyOk ? "OK" : "FAIL"} (${r.appliedCount}) | canonical zmenený: ${r.changed ? "ÁNO" : "NIE"} | rollback ${r.rollbackOk && r.rollbackRestored ? "presný" : "NIE"} | goalFit na ${r.goalFitCount} rozhodnutiach`,
    );
  }
  console.log(`\nRovnaký canonical stav medzi: ${report.rovnakyCanonical.join(", ") || "—"}`);
  console.log(`Rozdielny canonical stav: ${report.roznyCanonical.join(", ") || "—"}`);
  console.log("\nUložené: /home/user/kontrola-ciel/video-goal-canonical.json");
}

main();

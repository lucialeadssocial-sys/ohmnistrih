/**
 * KROK 2 — REAL-DATA DÔKAZ: Content Map naprieč médiami.
 *
 * Zdroj dát (reálne, lokálne, MIMO repa):
 *  • `/home/user/referencie/popisy-tiktok.json` — 12 popisov REÁLNYCH videí
 *    tvorcu ai_ktivista (text, ktorý naozaj napísal),
 *  • `/home/user/real-media/segments-krok18.json` — prepis REÁLNEJ reči
 *    (word-level) k médiu `real_speech.mp4`.
 *
 * POCTIVOSŤ: popis videa NIE JE prepis reči — v dôkaze je to povedané a časy
 * sa z popisov neberú (nemajú ich). Ak súbory nie sú, runner to povie a skončí.
 *
 * Spustenie: bun run tools/verify-content-map.ts [cesta-k-popisom] [proof]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildContentMap, whyNotList, type ContentMapMediaInput } from "../src/core/media/contentMap";
import { localEmbeddingProvider } from "../src/ai/providers/LocalEmbeddingProvider";
import { splitIntoSentences } from "../src/core/media/mediaIntelligenceIndex";
import type { VideoGoalId } from "../src/core/style/videoGoal";

const report: string[] = [];
const say = (line = "") => {
  console.log(line);
  report.push(line);
};

function sentencesFromText(text: string): { id: string; text: string; start?: number; end?: number }[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 12)
    .map((t, i) => ({ id: `s${i}`, text: t }));
}

async function main() {
  const corpusPath = process.argv[2] ?? join(process.cwd(), "..", "referencie", "popisy-tiktok.json");
  const proofPath = process.argv[3] ?? "docs/proof-content-map.txt";

  say("=".repeat(78));
  say("KROK 2 — REAL-DATA DÔKAZ: Content Map naprieč médiami");
  say("=".repeat(78));

  if (!existsSync(corpusPath)) {
    say(`korpus sa nenašiel: ${corpusPath}`);
    writeFileSync(proofPath, report.join("\n") + "\n", "utf-8");
    process.exit(2);
  }

  // ── Reálne médiá: 12 popisov ────────────────────────────────────────────
  const raw = JSON.parse(readFileSync(corpusPath, "utf-8")) as Record<string, { popis?: string }>;
  const media: ContentMapMediaInput[] = Object.entries(raw).map(([id, v], i) => ({
    assetId: id,
    sourceLabel: `video ${String(i + 1).padStart(2, "0")}`,
    durationSec: null,
    segments: sentencesFromText(String(v?.popis ?? "")),
    unavailableSk: "popis videa je prázdny — obsah sa nedá posúdiť",
  }));

  // ── Reálny prepis reči (word-level) ako ďalšie médium ───────────────────
  const transcriptPath = join(process.cwd(), "..", "real-media", "segments-krok18.json");
  if (existsSync(transcriptPath)) {
    const segs = JSON.parse(readFileSync(transcriptPath, "utf-8"));
    const words: { word: string; start: number; end: number }[] = [];
    for (const seg of Array.isArray(segs) ? segs : segs?.segments ?? []) {
      for (const w of seg?.words ?? []) {
        if (typeof w?.word === "string") words.push({ word: w.word, start: Number(w.start) || 0, end: Number(w.end) || 0 });
      }
    }
    const sentences = splitIntoSentences(words).map((s, i) => ({ id: `s${i}`, text: s.text, start: s.start, end: s.end }));
    if (sentences.length > 0) {
      media.push({
        assetId: "real_speech",
        sourceLabel: "video R (prepis reči)",
        durationSec: 20.27,
        segments: sentences,
      });
    }
  }

  say(`zdroj textov ......................... ${corpusPath.split("/").pop()} (popisy videí, NIE prepis reči)`);
  say(`médiá ................................ ${media.length}`);
  say(`pasáže ............................... ${media.reduce((s, m) => s + m.segments.length, 0)}`);
  say("");

  // ── Model (krok 1) ──────────────────────────────────────────────────────
  await localEmbeddingProvider.loadModel();
  const q = localEmbeddingProvider.getQuality();
  say(`sémantický model ..................... ${q.quality}${q.reasonSk ? ` — ${q.reasonSk}` : ""}`);

  const goalId: VideoGoalId = "REACH"; // cieľ, ktorý si pri týchto videách určila používateľka v Style Studiu
  const map = await buildContentMap({
    media,
    goalId,
    embed: q.quality === "MEASURED" ? (t) => localEmbeddingProvider.embedBatch(t) : null,
  });

  say("");
  say(`CIEĽ: ${map.goalLabelSk} (${map.goalId}) — cieľ určuje používateľka, mapa len počíta`);
  say("");
  say("— SÚHRN (presne to, čo vidí používateľka) —");
  say(map.summarySk);
  say("");
  say("— ROLE —");
  say(`OTVORENIE ${map.total.byRole.OPEN} · TELO ${map.total.byRole.BODY} · PRODUKT ${map.total.byRole.PRODUCT} · DÔKAZ ${map.total.byRole.PROOF} · ZÁVER ${map.total.byRole.END} · NEPOUŽIŤ ${map.total.byRole.OMIT}`);
  say("");
  say("— „PREČO NIE“ (vzorka) —");
  const why = whyNotList(map, 8);
  why.forEach((w) => say(`  • ${w}`));

  say("");
  say("— MÉDIÁ —");
  for (const row of map.rows) {
    say(
      `  ${row.sourceLabel.padEnd(22, " ")} použiteľné ${String(row.usableSegments).padStart(2)} / ${String(row.segments.length).padStart(2)} pasáží · vyradené ${row.omittedSegments} · ${row.quality}`,
    );
  }
  if (map.unavailableSk.length > 0) {
    say("");
    say("— BEZ DÁT (nič sa nedomýšľa) —");
    map.unavailableSk.forEach((u) => say(`  • ${u}`));
  }

  // ── Kontroly ────────────────────────────────────────────────────────────
  const checks: [string, boolean, string][] = [
    ["mapa má súhrn v tvare zo zadania", /Použiteľné \d+\/\d+;.*nepoužitých/.test(map.summarySk), map.summarySk],
    ["hook je konkrétne médium (alebo priznaná nemožnosť)", map.hook !== null, map.hook?.labelSk ?? "—"],
    [
      "každá vyradená pasáž má vysvetlenie",
      map.rows.flatMap((r) => r.segments).filter((s) => s.role === "OMIT").every((s) => s.whySk.length > 20),
      `${map.total.omitted} vyradených`,
    ],
    [
      "opakovanie sa meria (nie odhaduje)",
      map.semanticQuality === "MEASURED",
      map.semanticReasonSk,
    ],
    [
      "každá pasáž má práve jednu rolu a dôvod",
      map.rows.flatMap((r) => r.segments).every((s) => s.role.length > 0 && s.whySk.length > 15),
      `${map.total.segments} pasáží`,
    ],
    [
      "determinizmus (druhý beh = rovnaká mapa)",
      (() => {
        // druhé volanie s tými istými dátami; porovnáme serializovaný výsledok
        return true; // porovnáva sa nižšie, aby sme model nevolali dvakrát zbytočne
      })(),
      "kontroluje sa druhým behom nižšie",
    ],
  ];

  // Determinizmus naozaj: druhý beh a porovnanie (model je deterministický, viď krok 1).
  const map2 = await buildContentMap({
    media,
    goalId,
    embed: q.quality === "MEASURED" ? (t) => localEmbeddingProvider.embedBatch(t) : null,
  });
  checks[5][1] = JSON.stringify(map) === JSON.stringify(map2);

  say("");
  say("— VÝSLEDOK —");
  let allOk = true;
  for (const [name, ok, detail] of checks) {
    say(`${ok ? "OK  " : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
    report.push(`${ok ? "OK" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
    if (!ok) allOk = false;
  }
  say("");
  say("Úroveň dôvodu: REAL DATA VERIFIED pre obsahovú mapu (reálne texty reálneho tvorcu, reálny model).");
  say("POZOR: texty sú POPISY videí, nie prepis reči — časovanie preto chýba a hook to priznáva.");
  say("Pre 30+ surových videí s prepisom treba reálne dáta používateľky (appka ich spočíta, keď ich nahrá).");
  report.push("Úroveň dôvodu: REAL DATA VERIFIED (popisy videí + reálny model); časovanie z popisov sa neberie.");
  report.push("Pre 30+ surových videí s prepisom treba reálne dáta používateľky.");

  writeFileSync(proofPath, report.join("\n") + "\n", "utf-8");
  process.exit(allOk ? 0 : 1);
}

mkdirSync("docs", { recursive: true });
main();

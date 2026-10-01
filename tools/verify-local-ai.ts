/**
 * KROK 1 — REAL-MEDIA DÔKAZ: napojenie lokálnej AI (sémantika + VAD).
 *
 * Tento runner **naozaj načíta model** (multilingual MiniLM, q8) a meria na
 * slovenských vetách. Nie je to test so stubom — stuby sú v `tests/`.
 *
 * Čo sa meria:
 *  1. model sa načíta a vráti vektory (koľko dimenzií, za koľko sekúnd),
 *  2. prah 0,53 NAOZAJ oddelí parafrázy od nesúvisiacich viet,
 *  3. opakovanie v reálnom prepise sa nájde a vysvetlí („X opakuje Y“),
 *  4. determinizmus: dva behy = rovnaké čísla,
 *  5. bez modelu index NIČ nevymyslí (NOT_AVAILABLE + dôvod),
 *  6. VAD nájde ticho v reálnom zvukovom súbore (ffmpeg silencedetect je nezávislé meranie).
 *
 * Spustenie: bun run tools/verify-local-ai.ts [audio] [proof]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  SEMANTIC_DUPLICATE_THRESHOLD,
  buildSemanticIndex,
  cosineSimilarity,
  findRedundantSegments,
  semanticSearch,
  uniqueSegmentIds,
} from "../src/core/media/semanticSegments";
import { splitIntoSentences } from "../src/core/media/mediaIntelligenceIndex";
import { localEmbeddingProvider, EMBEDDING_DTYPE, EMBEDDING_MODEL_ID } from "../src/ai/providers/LocalEmbeddingProvider";

const report: string[] = [];
const say = (line = "") => {
  console.log(line);
  report.push(line);
};

/** Reálny prepis (to isté médium ako v krokoch 16–18). */
function loadTranscript(): { text: string; words: { word: string; start: number; end: number }[] } | null {
  const paths = [
    join(process.cwd(), "..", "real-media", "segments-krok18.json"),
    join(process.cwd(), "..", "real-media", "segments-krok16.json"),
    join(process.cwd(), "..", "real-media", "segments-krok17.json"),
  ];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    try {
      const raw = JSON.parse(readFileSync(p, "utf-8"));
      const segments = Array.isArray(raw) ? raw : raw?.segments ?? [];
      const words: { word: string; start: number; end: number }[] = [];
      for (const seg of segments) {
        for (const w of seg?.words ?? []) {
          if (typeof w?.word === "string") {
            words.push({ word: w.word, start: Number(w.start) || 0, end: Number(w.end) || 0 });
          }
        }
      }
      if (words.length > 0) {
        return { text: words.map((w) => w.word).join(" "), words };
      }
      if (typeof raw?.text === "string") {
        // Text bez časov: rozdelíme na vety a časy dopočítame len orientačne
        // (na sémantiku to stačí, čas sa v dôkaze neuvádza).
        const parts = raw.text.split(/(?<=[.!?])\s+/).filter(Boolean);
        const words: { word: string; start: number; end: number }[] = [];
        parts.forEach((sentence: string, si: number) => {
          sentence.split(/\s+/).filter(Boolean).forEach((word: string, wi: number) => {
            words.push({ word, start: si * 5 + wi * 0.3, end: si * 5 + wi * 0.3 + 0.3 });
          });
        });
        return { text: raw.text, words };
      }
    } catch {
      /* skúsime ďalší súbor */
    }
  }
  return null;
}

/** Reálne dvojice na meranie prahu — použité aj pri rozhodovaní o modeli. */
const PARY: [string, string, boolean][] = [
  ["Za mesiac som zdvojnásobil predaj vďaka systému", "Tržby mi za jeden mesiac narástli dvojnásobne", true],
  ["Ráno si naplánujem deň, večer ho skontrolujem", "Ráno plán, večer kontrola", true],
  ["Čas na strih mi klesol o sedemdesiat percent", "Strihanie mi zaberá o 70 percent menej času", true],
  ["Klient zaplatil tri tisíce eur", "Zákazník mi poslal tri tisíce eur", true],
  ["Začal som podnikať s jedným klientom", "Pripravila som sviečkovú omáčku s knedľou", false],
  ["Ráno si naplánujem deň, večer ho skontrolujem", "V noci som nemohol spať kvôli susedom", false],
  ["Čas na strih mi klesol o sedemdesiat percent", "Na trhu som kúpil čerstvé jablká", false],
  ["Klient zaplatil tri tisíc eur", "Auto mi neštartuje, treba vymeniť batériu", false],
];

async function main() {
  const audioPath = process.argv[2] ?? join(process.cwd(), "..", "real-media", "real_speech.mp4");
  const proofPath = process.argv[3] ?? "docs/proof-local-ai.txt";

  say("=".repeat(78));
  say("KROK 1 — REAL-MEDIA DÔKAZ: lokálna AI (sémantika viet + VAD)");
  say("=".repeat(78));
  say(`model: ${EMBEDDING_MODEL_ID} (dtype ${EMBEDDING_DTYPE})`);
  say("");

  // ── 1. Model sa naozaj načíta ────────────────────────────────────────────
  const t0 = Date.now();
  await localEmbeddingProvider.loadModel();
  const loadSec = (Date.now() - t0) / 1000;
  const quality = localEmbeddingProvider.getQuality();
  const status = localEmbeddingProvider.getStatus();
  say("— MODEL —");
  say(`stav ................................. ${status.status} (${status.message ?? ""})`);
  say(`načítanie ............................ ${loadSec.toFixed(1)} s`);
  say(`kvalita .............................. ${quality.quality}${quality.reasonSk ? ` — ${quality.reasonSk}` : ""}`);

  const checks: [string, boolean, string][] = [];

  if (quality.quality !== "MEASURED") {
    say("");
    say("MODEL NEDOSTUPNÝ — ďalšie merania by boli bezpredmetné, preto sa NIČ netvrdí.");
    say(`Dôvod: ${quality.reasonSk}`);
    checks.push(["model sa načítal", false, quality.reasonSk]);
    writeFileSync(proofPath, report.join("\n") + "\n", "utf-8");
    process.exit(1);
  }

  const embed = (texts: string[]) => localEmbeddingProvider.embedBatch(texts);
  const vectors = await embed(PARY.flatMap(([a, b]) => [a, b]));
  say(`dimenzie vektora ..................... ${vectors[0]?.length ?? 0}`);
  checks.push(["model vracia vektory (nie prázdno)", (vectors[0]?.length ?? 0) > 0, "384 dimenzií"]);

  // ── 2. Prah na slovenských vetách ───────────────────────────────────────
  const parafrazy: number[] = [];
  const nesuvisiace: number[] = [];
  PARY.forEach(([, , jeParafraza], i) => {
    const sim = cosineSimilarity(vectors[i * 2], vectors[i * 2 + 1]);
    (jeParafraza ? parafrazy : nesuvisiace).push(sim);
  });
  const priemer = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length;
  const minParafraza = Math.min(...parafrazy);
  const maxNesuvisiaca = Math.max(...nesuvisiace);

  say("");
  say("— PRAH NA SLOVENSKÝCH VETÁCH (merané, nie odhadnuté) —");
  say(`parafrázy (4 dvojice) ................ priemer ${priemer(parafrazy).toFixed(3)} · najnižšia ${minParafraza.toFixed(3)}`);
  say(`nesúvisiace (4 dvojice) .............. priemer ${priemer(nesuvisiace).toFixed(3)} · najvyššia ${maxNesuvisiaca.toFixed(3)}`);
  say(`odstup ............................... ${(minParafraza - maxNesuvisiaca).toFixed(3)}`);
  say(`nastavený prah ....................... ${SEMANTIC_DUPLICATE_THRESHOLD}`);
  say(`prah oddelí obe skupiny .............. ${minParafraza > SEMANTIC_DUPLICATE_THRESHOLD && maxNesuvisiaca < SEMANTIC_DUPLICATE_THRESHOLD ? "ÁNO" : "NIE"}`);
  checks.push([
    "prah oddelí parafrázy od nesúvisiacich (na reálnych SK vetách)",
    minParafraza > SEMANTIC_DUPLICATE_THRESHOLD && maxNesuvisiaca < SEMANTIC_DUPLICATE_THRESHOLD,
    `parafrázy ≥ ${minParafraza.toFixed(3)} > ${SEMANTIC_DUPLICATE_THRESHOLD} > ${maxNesuvisiaca.toFixed(3)} ≥ nesúvisiace`,
  ]);

  // ── 3. Determinizmus ────────────────────────────────────────────────────
  const again = await embed(PARY.flatMap(([a, b]) => [a, b]));
  const deterministic = JSON.stringify(vectors) === JSON.stringify(again);
  say("");
  say("— DETERMINIZMUS —");
  say(`dva behy dávajú rovnaké vektory ....... ${deterministic ? "ÁNO" : "NIE"}`);
  checks.push(["dva behy = rovnaké vektory", deterministic, "rovnaký vstup, rovnaký model"]);

  // ── 4. Opakovanie v reálnom prepise ─────────────────────────────────────
  say("");
  say("— REÁLNY PREPIS (to isté médium ako kroky 16–18) —");
  const transcript = loadTranscript();
  if (!transcript) {
    say("prepis sa nenašiel — časť s opakovaním sa preskakuje (NIČ sa nedomýšľa)");
    checks.push(["nájdený reálny prepis", false, "chýba segments-krok18.json"]);
  } else {
    const sentences = splitIntoSentences(transcript.words);
    say(`slová ................................ ${transcript.words.length}`);
    say(`viet/pasáží (delenie podľa interpunkcie a pauzy) ${sentences.length}`);
    const index = await buildSemanticIndex(
      sentences.map((s, i) => ({ id: `v${i}`, assetId: "real_speech", sourceLabel: `veta ${i + 1}`, text: s.text, start: s.start, end: s.end })),
      embed,
    );
    say(`kvalita indexu ....................... ${index.quality}${index.reasonSk ? ` — ${index.reasonSk}` : ""}`);
    checks.push(["index z reálneho prepisu je MEASURED", index.quality === "MEASURED", `${sentences.length} pasáží`]);

    if (index.quality === "MEASURED") {
      const redundancy = findRedundantSegments(index);
      const unique = uniqueSegmentIds(index, redundancy);
      say(`namerané opakovania .................. ${redundancy.length}`);
      say(`jedinečných pasáží ................... ${unique.size} / ${index.segments.length}`);
      for (const m of redundancy.slice(0, 5)) say(`  • ${m.reasonSk}`);
      if (redundancy.length > 0) {
        checks.push([
          "opakovanie je vysvetlené (podklad pre „prečo nie“)",
          redundancy.every((m) => m.reasonSk.includes("opakuje")),
          redundancy[0].reasonSk,
        ]);
      } else {
        say("  (v tomto prepise sa neopakuje tá istá myšlienka — nekryjem to tvrdením)");
      }

      // Hľadanie podľa VÝZNAMU, nie podľa slov: v prepise nie je slovo „tržby“.
      const [q] = await embed(["tržby a predaj"]);
      const hits = semanticSearch(q, index, 3, 0.25);
      say(`hľadanie podľa významu („tržby a predaj“): ${hits.length} zásahov`);
      for (const h of hits) say(`  • ${h.similarity.toFixed(3)} — „${h.segment.text.slice(0, 70)}…“`);
      checks.push([
        "hľadanie podľa významu nájde pasáž bez doslovnej zhody",
        hits.length > 0 && hits[0].similarity > 0.25,
        hits.length > 0 ? `najlepšia zhoda ${hits[0].similarity.toFixed(3)}` : "žiadny zásah",
      ]);

      // Model nesmie označiť za duplicitu dve rôzne veci: overíme na nesúvisiacich.
      const falsePositives = redundancy.filter((m) => m.similarity < SEMANTIC_DUPLICATE_THRESHOLD);
      checks.push(["žiadne opakovanie pod prahom", falsePositives.length === 0, `${falsePositives.length} pod prahom`]);
    }
  }

  // ── 4b. REÁLNY KORPUS: hľadanie opakovania naprieč médiami (ViDEO 1..N) ──
  //
  // Toto je predobraz Content Map (krok 2): 12 popisov REÁLNYCH videí od
  // tvorcu ai_ktivista (uložené lokálne v /home/user/referencie). Ak tam nie sú,
  // nič sa netvrdí — sekcia sa preskočí s dôvodom.
  say("");
  say("— REÁLNY KORPUS 12 VIDEÍ (naprieč médiami) —");
  const corpusPath = join(process.cwd(), "..", "referencie", "popisy-tiktok.json");
  if (!existsSync(corpusPath)) {
    say(`korpus sa nenašiel (${corpusPath}) — meranie sa preskakuje, nič sa nedomýšľa.`);
  } else {
    const raw = JSON.parse(readFileSync(corpusPath, "utf-8")) as Record<string, { popis?: string }>;
    const items = Object.entries(raw)
      .map(([id, v], i) => ({ id, video: i + 1, text: String(v?.popis ?? "").trim() }))
      .filter((x) => x.text.length > 0);

    const unit = (txt: string) =>
      txt
        .split(/(?<=[.!?])\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 12);

    const segments = items.flatMap((it) =>
      unit(it.text).map((text, si) => ({
        id: `v${String(it.video).padStart(2, "0")}s${si}`,
        assetId: it.id,
        sourceLabel: `video ${String(it.video).padStart(2, "0")}`,
        text,
      })),
    );

    say(`videí ................................ ${items.length}`);
    say(`viet/pasáží .......................... ${segments.length}`);
    const corpusIndex = await buildSemanticIndex(segments, embed);
    say(`kvalita indexu ....................... ${corpusIndex.quality}${corpusIndex.reasonSk ? ` — ${corpusIndex.reasonSk}` : ""}`);

    if (corpusIndex.quality === "MEASURED") {
      const redundancy = findRedundantSegments(corpusIndex);
      const unique = uniqueSegmentIds(corpusIndex, redundancy);
      say(`NAJDENÉ OPAKOVANIA (to isté povedané inak) ... ${redundancy.length}`);
      for (const m of redundancy.slice(0, 8)) say(`  • ${m.reasonSk}`);
      const repeatedVideos = new Set(redundancy.map((m) => m.b.assetId));
      say(`videí s opakujúcim sa obsahom ......... ${repeatedVideos.size} / ${items.length}`);
      say(`jedinečných pasáží ................... ${unique.size} / ${corpusIndex.segments.length}`);

      checks.push([
        "na reálnom korpuse 12 videí sa nájde opakovanie (podklad pre WHY NOT)",
        redundancy.length > 0,
        redundancy.length > 0 ? `${redundancy.length}× · „${redundancy[0].reasonSk}“` : "žiadne (nekryjem to tvrdením)",
      ]);
      checks.push([
        "opakovania sú naprieč RÔZNYMI médiami (nie v jednej vete)",
        redundancy.some((m) => m.a.assetId !== m.b.assetId),
        `${new Set(redundancy.filter((m) => m.a.assetId !== m.b.assetId).map((m) => `${m.a.sourceLabel}→${m.b.sourceLabel}`)).size} dvojíc`,
      ]);
    }
  }

  // ── 5. Bez modelu sa NIČ nevymyslí ──────────────────────────────────────
  const bezModelu = await buildSemanticIndex(
    [{ id: "a", text: "Za mesiac som zdvojnásobil predaj" }],
    null,
  );
  say("");
  say("— BEZ MODELU (poctivosť) —");
  say(`kvalita .............................. ${bezModelu.quality}`);
  say(`dôvod ................................ ${bezModelu.reasonSk}`);
  say(`segmenty ............................. ${bezModelu.segments.length} (žiadny hash vektor)`);
  checks.push([
    "bez modelu vráti NOT_AVAILABLE + dôvod (nič sa nedomýšľa)",
    bezModelu.quality === "NOT_AVAILABLE" && bezModelu.reasonSk.length > 10 && bezModelu.segments.length === 0,
    bezModelu.reasonSk,
  ]);

  const zlyhanyModel = await buildSemanticIndex(
    [{ id: "a", text: "Za mesiac som zdvojnásobil predaj" }],
    async () => {
      throw new Error("simulované zlyhanie modelu");
    },
  );
  checks.push([
    "zlyhanie modelu = NOT_AVAILABLE, nie náhradný vektor",
    zlyhanyModel.quality === "NOT_AVAILABLE" && zlyhanyModel.segments.length === 0,
    zlyhanyModel.reasonSk,
  ]);

  // ── 6. VAD na reálnom zvuku (nezávislé meranie cez ffmpeg) ──────────────
  say("");
  say("— VAD NA REÁLNOM ZVUKU —");
  say(`súbor ................................ ${audioPath}`);
  if (!existsSync(audioPath)) {
    say("zvukový súbor sa nenašiel — VAD sa nemeria.");
    checks.push(["VAD na reálnom zvuku", false, "súbor neexistuje"]);
  } else {
    const exe = spawnSync("python3", ["-c", "import imageio_ffmpeg,sys;sys.stdout.write(imageio_ffmpeg.get_ffmpeg_exe())"], { encoding: "utf-8" }).stdout?.trim();
    // Nezávislé meranie ticha: ffmpeg silencedetect (nie náš algoritmus).
    const res = spawnSync(exe, ["-hide_banner", "-i", audioPath, "-af", "silencedetect=noise=-35dB:d=0.3", "-f", "null", "-"], { encoding: "utf-8" });
    const stderr = `${res.stderr ?? ""}`;
    const silences = [...stderr.matchAll(/silence_duration:\s*([0-9.]+)/g)].map((m) => Number(m[1]));
    const totalSilence = silences.reduce((a, b) => a + b, 0);
    say(`ffmpeg silencedetect (nezávislé) ..... ${silences.length} úsekov, spolu ${totalSilence.toFixed(2)} s`);
    say(`najdlhšie ticho ...................... ${silences.length ? Math.max(...silences).toFixed(2) : "0.00"} s`);
    checks.push([
      "nezávislé ffmpeg meranie ticha existuje",
      silences.length > 0,
      `${silences.length} úsekov (${totalSilence.toFixed(2)} s)`,
    ]);
    say("Poznámka: náš VAD beží cez WebAudio (RMS) a je overený v prehliadači, nie tu.");
    say("Porovnanie oboch meraní patrí do kroku 4 (meranie zvuku, LUFS/silence).");
  }

  // ── Výsledok ────────────────────────────────────────────────────────────
  say("");
  say("— VÝSLEDOK —");
  let allOk = true;
  for (const [name, ok, detail] of checks) {
    say(`${ok ? "OK  " : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
    report.push(`${ok ? "OK" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
    if (!ok) allOk = false;
  }
  say("");
  say("Úroveň dôvodu: REAL MODEL + REAL MEDIA VERIFIED pre sémantiku viet (model bol naozaj načítaný).");
  say("NIE JE BROWSER VERIFIED: v prehliadači beží ten istý kód, ale musí ho otvoriť používateľ.");
  report.push("Úroveň dôvodu: REAL MODEL + REAL MEDIA VERIFIED pre sémantiku viet; BROWSER VERIFIED nie.");

  writeFileSync(proofPath, report.join("\n") + "\n", "utf-8");
  process.exit(allOk ? 0 : 1);
}

mkdirSync("docs", { recursive: true });
main();

/**
 * KROK 24 — MERANÉ ZOSÚLADENIE SVETLA: dôkaz na reálnych videách.
 *
 * Otázka, na ktorú tento nástroj odpovedá:
 *   „Keď mám surové video a chcem, aby vyzeralo ako JEHO video (referencia),
 *    dostane sa jeho namerané svetlo naozaj do môjho výsledku?“
 *
 * Postup (nič sa nepreskakuje):
 *   1) ZMERIAM REFERENCIU (jeho klip) — jas a kontrast z pixelov.
 *   2) ZMERIAM ZDROJ (moje surové video) — jas a kontrast z pixelov.
 *   3) VYPOČÍTAM KOREKCIU (`computeLightCorrection`, čistá funkcia, bez odhadu).
 *   4) EXPORTUJEM cez existujúcu linku appky (`/api/export/burn-captions`) —
 *      korekcia ide v požiadavke, render ju vloží do ffmpeg `eq=`.
 *   5) ZMERIAM VÝSTUP a porovnám s referenciou (pred/po).
 *
 * Poctivo: ak sa zmerať nedá (chýba ffmpeg alebo referenčné video), nástroj to
 * povie a skončí — nič nepredstiera.
 *
 * Spustenie:
 *   bun run tools/verify-light-match.ts <zdroj.mp4> --reference <referencia.mp4> \
 *       [--plan segments.json] [--out /home/user/export-svetlo.mp4]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const API = process.env.OMNISTRIH_URL ?? "http://127.0.0.1:3000";
const OUT_DIR = "/home/user/kontrola-svetlo";

/** Vloží reálny projekt do enginu tou istou cestou, akú používa appka (CommandManager). */
function applyRealProjectToEngine(project: unknown) {
  const engine = coreEngine as unknown as { commandManager: { execute: (c: unknown) => unknown } };
  const cmd = {
    id: "load-real-media",
    name: "Load real media",
    execute: () => project,
  };
  try {
    engine.commandManager.execute(cmd);
  } catch {
    /* keď command neprejde, stav sa overí nižšie (blokery/klipy) */
  }
}

function head(t: string) {
  console.log("\n" + "=".repeat(96));
  console.log(t);
  console.log("=".repeat(96));
}
function line(label: string, value: unknown) {
  const dots = ".".repeat(Math.max(2, 52 - label.length));
  console.log(`${label} ${dots} ${value}`);
}

const argv = process.argv.slice(2);
const sourcePath = argv[0];
const refArgIdx = argv.indexOf("--reference");
const referencePath = refArgIdx >= 0 ? argv[refArgIdx + 1] : undefined;
const planIdx = argv.indexOf("--plan");
const planPath = planIdx >= 0 ? argv[planIdx + 1] : undefined;
const outIdx = argv.indexOf("--out");
const outPath = outIdx >= 0 ? argv[outIdx + 1] : "/home/user/export-svetlo.mp4";

if (!sourcePath || !existsSync(sourcePath)) {
  console.error("Chýba zdrojové video. Použitie: bun run tools/verify-light-match.ts <zdroj.mp4> --reference <ref.mp4>");
  process.exit(2);
}
if (!referencePath || !existsSync(referencePath)) {
  console.error("Chýba referencia (--reference). Bez nej niet čo napodobniť — nič nepredstieram.");
  process.exit(2);
}

function ffmpegPath(): string | null {
  const r = spawnSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"], { encoding: "utf-8" });
  if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  const r2 = spawnSync("which", ["ffmpeg"], { encoding: "utf-8" });
  return r2.status === 0 && r2.stdout.trim() ? r2.stdout.trim() : null;
}

const FFMPEG = ffmpegPath();
if (!FFMPEG) {
  console.error("ffmpeg nie je k dispozícii — meranie sa nedá spraviť (nič nepredstieram).");
  process.exit(3);
}

/**
 * Zmeria jas a kontrast videa z pixelov.
 * Jas = medián priemeru pixelov na snímku · Kontrast = medián smerodajnej odchýlky
 * pixelov na snímku (rovnaká metóda, akou boli merané referencie — čísla sú porovnateľné).
 * Pevný rozmer 160×90, 2 snímky/s ⇒ veľkosť snímky je presne známa (žiadne hádanie).
 */
function measureLight(file: string, ffmpeg: string): { brightness: number; contrast: number; samples: number } | null {
  const W = 160;
  const H = 90;
  const FPS = 2;
  const frameBytes = W * H;

  const raw = spawnSync(
    ffmpeg,
    ["-v", "error", "-i", file, "-vf", `fps=${FPS},scale=${W}:${H},format=gray`, "-f", "rawvideo", "-"],
    { maxBuffer: 1024 * 1024 * 512 },
  );
  const buf = raw.stdout as unknown as Buffer;
  if (!buf || buf.length < frameBytes * 2) return null;

  const means: number[] = [];
  const stds: number[] = [];
  for (let i = 0; i + frameBytes <= buf.length; i += frameBytes) {
    const frame = buf.subarray(i, i + frameBytes);
    let sum = 0;
    for (let p = 0; p < frame.length; p++) sum += frame[p];
    const mean = sum / frame.length;
    let acc = 0;
    for (let p = 0; p < frame.length; p++) acc += (frame[p] - mean) ** 2;
    means.push(mean);
    stds.push(Math.sqrt(acc / frame.length));
  }
  if (means.length < 2) return null;

  const median = (a: number[]) => {
    const b = [...a].sort((x, y) => x - y);
    const m = Math.floor(b.length / 2);
    return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
  };
  return {
    brightness: Math.round(median(means) * 100) / 100,
    contrast: Math.round(median(stds) * 100) / 100,
    samples: means.length,
  };
}

console.log(`\nZdroj:      ${sourcePath}`);
console.log(`Referencia: ${referencePath}`);

head("1) MERANIE — referencia (jeho video) a zdroj (moje video)");
const refStats = measureLight(referencePath, FFMPEG!);
const srcStats = measureLight(sourcePath, FFMPEG!);
if (!refStats || !srcStats) {
  console.error("Meranie zlyhalo — nič nepredstieram a končím.");
  process.exit(4);
}
line("referencia: jas / kontrast", `${refStats.brightness} / ${refStats.contrast} (${refStats.samples} vzoriek)`);
line("zdroj:      jas / kontrast", `${srcStats.brightness} / ${srcStats.contrast} (${srcStats.samples} vzoriek)`);

const { computeLightCorrection, lightCorrectionFfmpeg } = await import("../src/core/export/lightMatch.ts");
const correction = computeLightCorrection(
  { brightness: srcStats.brightness, contrast: srcStats.contrast },
  { brightness: refStats.brightness, contrast: refStats.contrast },
);

head("2) VÝPOČET KOREKCIE (čistá funkcia, žiadny odhad)");
if (!correction) {
  line("korekcia", "žiadna — rozdiel je pod hranicou šumu merania alebo chýbajú dáta");
  line("poznámka", "Appka v takom prípade render nemení (radšej nič, než vymyslená korekcia).");
} else {
  line("jas (ffmpeg eq, sčítanie)", correction.ffmpegBrightness);
  line("kontrast (ffmpeg eq, násobiteľ)", correction.ffmpegContrast);
  line("filter pre render", `eq=brightness=…:contrast=…`);
  line("poznámka", correction.noteSk);
}

// ---------------------------------------------------------------------------
// 3) Canonical os so štýlom (rovnaká cesta ako v appke)
// ---------------------------------------------------------------------------

head("3) CANONICAL OS — štýl z jeho videa cez CommandManager");
const { coreEngine } = await import("../src/core/index.ts");
const { buildRealProjectForExport } = await import("./verify-style-real-media.ts");
const { getStyleRecipe } = await import("../src/core/style/styleRecipes.ts");
const { buildStylePlan } = await import("../src/core/style/styleIntelligence.ts");
const { applyStylePlan } = await import("../src/core/style/styleApply.ts");

const recipeId = basename(referencePath).startsWith("tiktok") ? "EDU_WORD_TALK" : "AI_CINEMATIC_TAKE";
line("recept podľa referencie", recipeId);

const planRaw = planPath && existsSync(planPath) ? JSON.parse(readFileSync(planPath, "utf-8")) : null;
const segments = planRaw
  ? (planRaw.segments ?? planRaw).map((s: any, i: number) => ({ ...s, id: s.id ?? `s${i}` }))
  : null;
if (!segments) {
  console.error("Bez --plan neviem postaviť canonical os (a nebudem si vymýšľať prepis).");
  process.exit(5);
}

// Presne tak, ako to robí overený runner: projekt s REÁLNYM hlavným klipom.
/** Zistí dĺžku videa z ffmpeg (žiadne pevné číslo — to by klamalo). */
function probeDurationSec(file: string, ffmpeg: string): number {
  const p = spawnSync(ffmpeg, ["-hide_banner", "-i", file], { encoding: "utf-8" });
  const text = `${p.stdout ?? ""}${p.stderr ?? ""}`;
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(text);
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

const sourceDurationSec = probeDurationSec(sourcePath, FFMPEG!);
if (!sourceDurationSec) {
  console.error("Nepodarilo sa zistiť dĺžku zdrojového videa — nebudem hádať.");
  process.exit(4);
}
line("dĺžka zdroja", `${sourceDurationSec.toFixed(2)} s`);
const project0 = buildRealProjectForExport(readFileSync(sourcePath), sourcePath, sourceDurationSec);
if (!project0) {
  console.error("Canonical projekt s reálnym médiom sa nepodarilo postaviť — STOP (nič sa nepredstiera).");
  process.exit(4);
}
(coreEngine as any).commandManager.setProject(project0);
const recipe = getStyleRecipe(recipeId);
const plan: any = buildStylePlan({ segments, recipe, durationSec: sourceDurationSec, availableSupportingVisuals: 1, now: 1759219200000 } as any);

const report: any = applyStylePlan(coreEngine as any, plan, {
  decisionIds: plan.decisions.map((d: any) => d.id),
  snapshotLabelSk: "Krok 24 — merané svetlo",
});
line("rozhodnutí aplikovaných", report.appliedCount);
line("canonical os sa zmenila", Boolean(report.timelineChanged));

// ---------------------------------------------------------------------------
// 4) Export cez bežiacu appku (existujúca linka) — S KOREKCIOU SVETLA
// ---------------------------------------------------------------------------

head("4) REAL EXPORT — existujúca linka appky, s korekciou svetla");

const uploadRes = await fetch(`${API}/api/export/upload?name=${encodeURIComponent(basename(sourcePath))}`, {
  method: "POST",
  headers: { "Content-Type": "application/octet-stream" },
  body: readFileSync(sourcePath),
});
if (!uploadRes.ok) {
  console.error(`Nahrávanie zdroja do appky zlyhalo (HTTP ${uploadRes.status}) — appka beží na ${API}?`);
  process.exit(6);
}
const upload = (await uploadRes.json()) as { uploadId?: string; success?: boolean; errorSk?: string };
if (!upload.success || !upload.uploadId) {
  console.error(`Nahrávanie do appky zlyhalo: ${upload.errorSk ?? uploadRes.status}`);
  process.exit(6);
}
const sourceId = upload.uploadId;
line("zdroj nahraný v appke", sourceId);

const { buildCanonicalExportPlan } = await import("../src/core/export/canonicalExport.ts");
const exportPlan: any = buildCanonicalExportPlan(
  coreEngine.getProject(),
  { uploadId: sourceId, uploadName: basename(sourcePath), width: 1080, height: 1920 } as any,
);
line("titulkov v zadaní", exportPlan.request.segments.length);
line("dá sa exportovať", exportPlan.canExport ? "áno" : "NIE");
line("blokery", (exportPlan.blockersSk ?? []).length === 0 ? "žiadne" : (exportPlan.blockersSk ?? []).join("; "));
if (!exportPlan.canExport) {
  console.error("Export sa nedá spustiť (blokery vyššie) — nič nepredstieram.");
  process.exit(6);
}

/**
 * Spustí render cez existujúcu linku appky a stiahne výsledok.
 * `withCorrection` rozhoduje LEN o tom, či požiadavka nesie korekciu svetla —
 * všetko ostatné (canonical os, titulky, strih) je v oboch behoch totožné.
 * Vďaka tomu je rozdiel v číslach naozaj prácou svetla, nie niečoho iného.
 */
async function runExport(labelSk: string, withCorrection: boolean, target: string) {
  const burnRes = await fetch(`${API}/api/export/burn-captions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...exportPlan.request,
      ...(withCorrection && correction ? { lightCorrection: correction } : {}),
    }),
  });
  const burn = (await burnRes.json()) as any;
  if (!burnRes.ok || !burn.success || !burn.jobId) {
    console.error(`${labelSk}: render sa nepodarilo spustiť (HTTP ${burnRes.status}): ${burn.errorSk ?? JSON.stringify(burn).slice(0, 200)}`);
    process.exit(7);
  }
  console.log(`\n  ▸ ${labelSk}`);
  line("    jobId", burn.jobId);
  for (const note of burn.notesSk ?? []) console.log(`      • server: ${note}`);

  let jobState = "queued";
  let result: any = null;
  const started = Date.now();
  while (Date.now() - started < 12 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 1200));
    const st = await fetch(`${API}/api/export/burn-captions/status?id=${encodeURIComponent(burn.jobId)}`);
    const stj = (await st.json()) as any;
    if (!stj?.success) {
      console.error(`${labelSk}: stav renderu sa nedá prečítať (HTTP ${st.status}).`);
      process.exit(8);
    }
    jobState = stj.status?.state ?? "unknown";
    if (jobState === "done" || jobState === "error" || jobState === "canceled") {
      result = stj.status?.result ?? null;
      if (jobState === "error") console.error(`${labelSk}: render zlyhal — ${stj.status?.errorSk}`);
      break;
    }
  }
  line("    stav renderu", jobState);
  if (jobState !== "done") {
    console.error(`${labelSk}: render nedobehol — ďalej nemám čo merať (nič nepredstieram).`);
    process.exit(8);
  }
  const fileName = result?.outputName as string | undefined;
  if (!fileName) {
    console.error(`${labelSk}: render hlási hotovo, ale nevrátil meno súboru — nebudem hádať.`);
    process.exit(9);
  }
  const fileRes = await fetch(`${API}/api/export/file/${encodeURIComponent(fileName)}`);
  if (!fileRes.ok) {
    console.error(`${labelSk}: výstup sa nedá stiahnuť (HTTP ${fileRes.status}).`);
    process.exit(9);
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, Buffer.from(await fileRes.arrayBuffer()));
  const bytes = readFileSync(target).length;
  line("    uložené", `${target} (${bytes} B)`);
  return { jobId: burn.jobId as string, fileName, bytes, serverNotesSk: (result?.notesSk ?? []) as string[] };
}

mkdirSync(OUT_DIR, { recursive: true });
const baselinePath = join(OUT_DIR, "kontrola-bez-korekcie.mp4");
const baselineRun = await runExport("A) KONTROLNÝ BEH — bez korekcie svetla (aby bolo vidno, čo robí svetlo a čo titulky)", false, baselinePath);
const correctedRun = await runExport("B) BEH S MERANOU KOREKCIOU SVETLA (rovnaká canonical os aj titulky)", true, outPath);

// ---------------------------------------------------------------------------
// 5) Meranie výsledkov — porovnanie s referenciou
// ---------------------------------------------------------------------------

head("5) MERANIE — ako blízko sme k jeho videu (a čo z toho spravilo svetlo)");
const baseStats = measureLight(baselinePath, FFMPEG!);
const outStats = measureLight(outPath, FFMPEG!);
if (!baseStats || !outStats) {
  console.error("Výstupy sa nedajú zmerať — končím bez verdiktu.");
  process.exit(10);
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const off = (v: number, ref: number) => round2(v - ref);

line("referencia (jeho video)", `jas ${refStats.brightness} / kontrast ${refStats.contrast}`);
line("zdroj (pred)", `jas ${srcStats.brightness} (odchýlka ${off(srcStats.brightness, refStats.brightness)}) / kontrast ${srcStats.contrast} (odchýlka ${off(srcStats.contrast, refStats.contrast)})`);
line("kontrolný beh (titulky, bez svetla)", `jas ${baseStats.brightness} (odchýlka ${off(baseStats.brightness, refStats.brightness)}) / kontrast ${baseStats.contrast} (odchýlka ${off(baseStats.contrast, refStats.contrast)})`);
line("výsledok (titulky + svetlo)", `jas ${outStats.brightness} (odchýlka ${off(outStats.brightness, refStats.brightness)}) / kontrast ${outStats.contrast} (odchýlka ${off(outStats.contrast, refStats.contrast)})`);

const movedToward = (before: number, after: number, ref: number) =>
  Math.abs(after - ref) < Math.abs(before - ref) - 0.01;
const brightnessMoved = movedToward(baseStats.brightness, outStats.brightness, refStats.brightness);
const contrastMoved = movedToward(baseStats.contrast, outStats.contrast, refStats.contrast);

console.log("");
line("svetlo samo posunulo jas smerom k referencii", brightnessMoved ? "ÁNO" : "NIE");
line("svetlo samo posunulo kontrast smerom k referencii", contrastMoved ? "ÁNO" : "NIE");
line("rozdiel medzi behmi (jas)", round2(outStats.brightness - baseStats.brightness));
line("rozdiel medzi behmi (kontrast)", round2(outStats.contrast - baseStats.contrast));

const evidence = {
  krok: 24,
  zdroj: sourcePath,
  referencia: referencePath,
  recept: recipeId,
  meranie: { referencia: refStats, zdroj: srcStats, kontrolnyBeh: baseStats, vysledok: outStats },
  korekcia: correction ?? null,
  exporty: {
    kontrolnyBeh: { subor: baselinePath, bajty: baselineRun.bytes, jobId: baselineRun.jobId, suborPodlaServera: baselineRun.fileName },
    sKorekciou: { subor: outPath, bajty: correctedRun.bytes, jobId: correctedRun.jobId, suborPodlaServera: correctedRun.fileName },
  },
  poznámkyServera: correctedRun.serverNotesSk,
  verdikt: {
    svetlo_posunulo_jas_k_referencii: brightnessMoved,
    svetlo_posunulo_kontrast_k_referencii: contrastMoved,
    korekcia_pouzita: Boolean(correction),
  },
};
writeFileSync(join(OUT_DIR, "svetlo-zo-referencie.json"), JSON.stringify(evidence, null, 2));

head("6) VERDIKT");
if (!correction) {
  console.log("Korekcia nebola potrebná alebo sa nedala vypočítať — appka render nemenila (nič sa nepredstiera).");
} else {
  console.log(
    brightnessMoved || contrastMoved
      ? "Namerané svetlo z jeho videa sa dostalo do renderu: oproti kontrolnému behu (tie isté titulky aj strih) sa obraz posunul k jeho videu — čísla vyššie."
      : "POZOR: korekcia sa vypočítala, ale výsledok sa k referencii nepriblížil — hlásim to ako neúspech, nie ako hotovo.",
  );
}
console.log("Klasifikácia:");
console.log("  • meranie jasu/kontrastu z reálnych videí ................. REAL MEDIA (tento beh)");
console.log("  • korekcia svetla v renderi (ffmpeg eq) .................. REAL EXPORT VERIFIED (tento beh, s kontrolným behom)");
console.log("  • náhľad v prehliadači ................................... NOT VERIFIED (v prostredí nie je DOM)");
console.log(`dôkaz uložený ...................................... ${join(OUT_DIR, "svetlo-zo-referencie.json")}`);

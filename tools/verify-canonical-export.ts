/**
 * REAL-MEDIA EXPORT VERIFIKÁCIA — export z canonical časovej osi.
 *
 * Samostatný runner (aby bola reálna verifikácia oddelená od unit testov):
 *   1. canonical projekt sa postaví Style Studio plánom na reálnych dátach,
 *   2. z canonical osi sa spraví zadanie pre **existujúcu** renderovaciu linku,
 *   3. zadanie sa pošle do bežiacej appky (`/api/export/burn-captions`),
 *   4. hotový súbor sa stiahne a **zmeria** (ffmpeg): stopy, dĺžka, zvuk, vypálené titulky.
 *
 * Nič sa netvrdí dopredu: všetko, čo runner vypíše, je zmerané alebo priznané ako nemerané.
 *
 *   bun run tools/verify-canonical-export.ts /tmp/real_speech.mp4 [--plan segments.json] [--recipe=ID] [--out /home/user/export.mp4]
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const REPO = join(HERE, "..");
const API = process.env.OMNISTRIH_URL || "http://127.0.0.1:3000";

const args = process.argv.slice(2);
const mediaPathArg = args.find((a) => !a.startsWith("--"));
const planFile = valueOf("--plan");
const recipeArg = valueOf("--recipe");
const outPath = valueOf("--out") ?? "/home/user/export-z-canonical-os.mp4";

/** Podporuje oba tvary: `--plan subor.json` aj `--plan=subor.json`. */
function valueOf(flag: string): string | undefined {
  const eq = args.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.slice(flag.length + 1);
  const idx = args.indexOf(flag);
  if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith("--")) return args[idx + 1];
  return undefined;
}

function ffmpegExe(): string {
  const fromPython = spawnSync("python3", ["-c", "import imageio_ffmpeg,sys; sys.stdout.write(imageio_ffmpeg.get_ffmpeg_exe())"], {
    encoding: "utf-8",
  });
  if (fromPython.status === 0 && fromPython.stdout.trim()) return fromPython.stdout.trim();
  return "ffmpeg";
}

/** Reálna dĺžka média — nech sa nikde nepíše „predpokladaná“ dĺžka. */
function probeDurationSec(exe: string, file: string): number {
  const probe = spawnSync(exe, ["-hide_banner", "-i", file], { encoding: "utf-8" });
  const text = `${probe.stdout ?? ""}${probe.stderr ?? ""}`;
  const m = text.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

function line(label: string, value: string | number | boolean) {
  console.log(`${label.padEnd(46, ".")} ${value}`);
}

function head(title: string) {
  console.log("=".repeat(78));
  console.log(title);
  console.log("=".repeat(78));
}

function hashFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 16);
}

/** Vytiahne zvukovú stopu do PCM WAV a vráti jej hash (na porovnanie obsahu zvuku). */
function audioFingerprint(ff: string, file: string, workDir: string, name: string): string | null {
  const wav = join(workDir, `${name}.wav`);
  const ex = spawnSync(ff, ["-y", "-hide_banner", "-loglevel", "error", "-i", file, "-vn", "-ac", "1", "-ar", "16000", "-f", "wav", wav]);
  if (ex.status !== 0 || !existsSync(wav)) return null;
  return hashFile(wav);
}

/** Koľko pixelov sa zmenilo medzi dvoma snímkami (dôkaz, že sa niečo vypálilo do obrazu). */
function frameDiff(ff: string, a: string, b: string, timeSec: number, workDir: string): number | null {
  const fa = join(workDir, `a_${timeSec}.png`);
  const fb = join(workDir, `b_${timeSec}.png`);
  for (const [file, out] of [
    [a, fa],
    [b, fb],
  ] as const) {
    const ex = spawnSync(ff, ["-y", "-hide_banner", "-loglevel", "error", "-ss", String(timeSec), "-i", file, "-frames:v", "1", out]);
    if (ex.status !== 0 || !existsSync(out)) return null;
  }
  // ffmpeg dokáže spraviť rozdiel sám (blend=difference) a vypísať priemernú zmenu.
  const ex2 = spawnSync(
    ff,
    [
      "-hide_banner", "-loglevel", "info",
      "-i", fa, "-i", fb,
      "-lavfi", "blend=all_mode=difference,format=gray,signalstats,metadata=print:file=-",
      "-frames:v", "1", "-f", "null", "-",
    ],
    { encoding: "utf-8" },
  );
  const out = `${ex2.stdout ?? ""}\n${ex2.stderr ?? ""}`;
  const match = out.match(/lavfi\.signalstats\.YAVG=([\d.]+)/);
  if (match) return Number(match[1]);
  return null;
}

async function main() {
  const mediaPath = (() => {
    if (!mediaPathArg || !existsSync(mediaPathArg)) {
      console.error("Použitie: bun run tools/verify-canonical-export.ts <video> [--plan segments.json] [--recipe=ID] [--out file.mp4]");
      process.exit(2);
    }
    return mediaPathArg;
  })();

  const ff = ffmpegExe();
  const workDir = mkdtempSync(join(tmpdir(), "canon-export-"));
  const media = readFileSync(mediaPath);
  const mediaDurationSec = probeDurationSec(ff, mediaPath);

  head("REAL-MEDIA EXPORT Z CANONICAL ČASOVEJ OSI");
  line("médium", `${basename(mediaPath)} (${media.byteLength} B)`);
  line("dĺžka média (meraná)", `${mediaDurationSec.toFixed(2)} s`);
  line("appka", API);

  // --- krok 1: canonical projekt cez Style Studio na reálnych dátach --------
  const { buildStylePlan } = await import(join(REPO, "src/core/style/styleIntelligence.ts"));
  const { applyStylePlan } = await import(join(REPO, "src/core/style/styleApply.ts"));
  const { getStyleRecipe } = await import(join(REPO, "src/core/style/styleRecipes.ts"));
  const { buildCanonicalExportPlan } = await import(join(REPO, "src/core/export/canonicalExport.ts"));
  const { coreEngine, createInitialProject } = await import(join(REPO, "src/core/index.ts"));

  const segmentsPath = planFile;
  if (!segmentsPath || !existsSync(segmentsPath)) {
    console.error("Chýba prepis: použi --plan <segments.json> (runner ho nevymýšľa).");
    process.exit(3);
  }
  const speechSegments = JSON.parse(readFileSync(segmentsPath, "utf-8")) as {
    start: number; end: number; text: string; words?: { word: string; start: number; end: number }[];
  }[];
  line("prepis (segmenty / slová)", `${speechSegments.length} / ${speechSegments.reduce((n, s) => n + (s.words?.length ?? 0), 0)}`);

  const recipe = getStyleRecipe(recipeArg ?? "EDITORIAL_COLLAGE");
  const plan = buildStylePlan({
    recipe,
    segments: speechSegments,
    durationSec: mediaDurationSec,
    availableSupportingVisuals: 1,
  });
  line("recept", `${plan.recipeLabelSk} (${plan.recipeId})`);
  line("rozhodnutí v pláne", plan.decisions.length);

  // rovnaká canonical konštrukcia ako pri real-media verifikácii Apply
  const helper = await import(join(REPO, "tools/verify-style-real-media.ts")).catch(() => null as any);
  const project = helper?.buildRealProjectForExport
    ? helper.buildRealProjectForExport(media, mediaPath, mediaDurationSec)
    : null;
  if (!project) {
    console.error("Nepodarilo sa postaviť canonical projekt (runner očakáva tools/verify-style-real-media.ts).");
    process.exit(4);
  }
  coreEngine.commandManager.setProject(project);

  const apply = applyStylePlan(coreEngine, plan, { snapshotLabelSk: "Export verifikácia — Style Studio" });
  line("apply: aplikované / dodržané / nevykonané", `${apply.appliedCount} / ${apply.honoredCount} / ${apply.skippedCount}`);
  line("časová os zmenená", apply.timelineChanged);
  if (!apply.ok || !apply.timelineChanged) {
    console.error("Apply nezmenil canonical časovú os — nemá zmysel exportovať (a nič sa nepredstiera).");
    process.exit(5);
  }

  const canonicalProject = coreEngine.getProject();
  const captionClips = canonicalProject.tracks
    .flatMap((t: any) => t.clips)
    .filter((c: any) => c.type === "caption" || c.type === "text").length;
  line("titulkov v canonical osi", captionClips);

  // --- krok 2: zadanie pre existujúcu renderovaciu linku -------------------
  const uploadRes = await fetch(`${API}/api/export/upload?name=${encodeURIComponent(basename(mediaPath))}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: media,
  });
  const upload = (await uploadRes.json()) as { success?: boolean; uploadId?: string; uploadName?: string; errorSk?: string };
  if (!uploadRes.ok || !upload.success || !upload.uploadId) {
    console.error(`Nahrávanie do appky zlyhalo: ${upload.errorSk ?? uploadRes.status}`);
    process.exit(6);
  }
  line("nahrané do appky", `${upload.uploadId} (${upload.uploadName})`);

  const exportPlan = buildCanonicalExportPlan(canonicalProject, {
    uploadId: upload.uploadId,
    uploadName: upload.uploadName ?? basename(mediaPath),
    width: 1080,
    height: 1920,
  });

  console.log("");
  console.log("── ZADANIE Z CANONICAL OSI ──────────────────────────────────────────────");
  for (const note of exportPlan.notesSk) console.log(`  • ${note}`);
  if (exportPlan.unsupportedSk.length > 0) {
    console.log("  POZOR (táto linka nevykresľuje):");
    for (const note of exportPlan.unsupportedSk) console.log(`    – ${note}`);
  }
  line("zhoda canonical ↔ zadanie", exportPlan.parity.matched ? "áno (nič nechýba, nič navyše)" : "NIE");
  if (!exportPlan.canExport) {
    console.error(`Export sa nedá spustiť: ${exportPlan.blockersSk.join(" ")}`);
    process.exit(7);
  }

  // --- krok 3: render v appke ----------------------------------------------
  const burnRes = await fetch(`${API}/api/export/burn-captions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(exportPlan.request),
  });
  const burn = (await burnRes.json()) as {
    success?: boolean; jobId?: string; eventCount?: number; wordHighlight?: boolean; errorSk?: string; notesSk?: string[];
  };
  if (!burnRes.ok || !burn.success || !burn.jobId) {
    console.error(`Render sa nepodarilo spustiť: ${burn.errorSk ?? burnRes.status}`);
    process.exit(8);
  }
  line("render spustený (jobId)", burn.jobId);
  line("titulkov spracoval server", `${burn.eventCount ?? "?"}${burn.wordHighlight ? " (so zvýrazňovaním slov)" : ""}`);
  for (const note of burn.notesSk ?? []) console.log(`  • server: ${note}`);

  let jobState = "queued";
  let result: any = null;
  const started = Date.now();
  while (Date.now() - started < 15 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 1500));
    const stRes = await fetch(`${API}/api/export/burn-captions/status?id=${encodeURIComponent(burn.jobId)}`);
    const st = (await stRes.json()) as any;
    if (!st?.success) {
      console.error(`Stav renderu sa nedá prečítať: ${st?.errorSk ?? stRes.status}`);
      process.exit(9);
    }
    jobState = st.status?.state ?? "unknown";
    if (jobState === "done" || jobState === "error" || jobState === "canceled") {
      result = st.status?.result ?? null;
      if (jobState === "error") console.error(`Render zlyhal: ${st.status?.errorSk}`);
      break;
    }
  }
  line("stav renderu", jobState);
  if (jobState !== "done") {
    console.error("Render sa nedokončil — ďalej nemám čo merať (a nič nepredstieram).");
    process.exit(10);
  }

  const fileName = result?.outputName ?? null;
  line("súbor z reportu", String(fileName));
  if (result?.clipDurationSec) line("dĺžka klipu podľa servera", `${Number(result.clipDurationSec).toFixed(2)} s`);
  if (result?.sizeBytes) line("veľkosť podľa servera", `${result.sizeBytes} B`);
  if (result?.summarySk) console.log(`  • server: ${result.summarySk}`);
  if (!fileName) {
    console.error("Render hlási hotovo, ale nevrátil meno súboru — nebudem hádať.");
    process.exit(11);
  }

  const fileRes = await fetch(`${API}/api/export/file/${encodeURIComponent(fileName)}`);
  if (!fileRes.ok) {
    console.error(`Hotový súbor sa nedá stiahnuť (HTTP ${fileRes.status}).`);
    process.exit(12);
  }
  const bytes = new Uint8Array(await fileRes.arrayBuffer());
  writeFileSync(outPath, bytes);

  // --- krok 4: meranie výsledku --------------------------------------------
  console.log("");
  console.log("── MERANIE HOTOVÉHO SÚBORU ──────────────────────────────────────────────");
  line("uložené", `${outPath} (${bytes.byteLength} B)`);
  const probe = spawnSync(ff, ["-hide_banner", "-i", outPath], { encoding: "utf-8" });
  const probeText = `${probe.stdout ?? ""}${probe.stderr ?? ""}`;
  const hasVideo = /Stream #\d+:\d+.*Video/.test(probeText);
  const hasAudio = /Stream #\d+:\d+.*Audio/.test(probeText);
  const durationMatch = probeText.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  const outDuration = durationMatch
    ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])
    : null;
  line("stopa video / audio", `${hasVideo ? "áno" : "NIE"} / ${hasAudio ? "áno" : "NIE"}`);
  line("dĺžka výstupu", outDuration !== null ? `${outDuration.toFixed(2)} s` : "neznáma");

  // zvuk: obsahová zhoda s pôvodným zvukovým tokom
  const srcAudioHash = audioFingerprint(ff, mediaPath, workDir, "src");
  const outAudioHash = audioFingerprint(ff, outPath, workDir, "out");
  const audioSame = Boolean(srcAudioHash && outAudioHash && srcAudioHash === outAudioHash);
  line("zvuk rovnaký ako v zdroji", audioSame ? "áno (obsahovo)" : "NIE / nedá sa porovnať");
  line("hash zvuku zdroj → výstup", `${srcAudioHash ?? "?"} → ${outAudioHash ?? "?"}`);

  // titulky: snímka v čase titulku sa musí líšiť od rovnakej snímky zdroja
  const firstCaption = exportPlan.request.segments[0];
  const midTime = firstCaption
    ? Math.min(firstCaption.start + (firstCaption.end - firstCaption.start) / 2, Math.max(0.2, mediaDurationSec - 0.5))
    : 1;
  const diff = frameDiff(ff, mediaPath, outPath, midTime, workDir);
  line(`zmena obrazu v ${midTime.toFixed(1)} s (YAVG)`, diff === null ? "nedá sa zmerať" : diff.toFixed(2));
  const captionsBurned = diff !== null && diff > 1.0;
  line("vypálené titulky v obraze", captionsBurned ? "áno (obraz sa na tom mieste líši)" : "NIE / nepreukázané");

  const pass =
    hasVideo &&
    hasAudio &&
    exportPlan.parity.matched &&
    captionsBurned &&
    (outDuration === null || Math.abs(outDuration - mediaDurationSec) < 1.5);

  console.log("");
  console.log("=".repeat(78));
  console.log(
    pass
      ? "VÝSLEDOK: REAL EXPORT Z CANONICAL OSI PASS (súbor vznikol, má obraz aj zvuk, titulky z canonical osi sú v obraze)"
      : "VÝSLEDOK: POZOR — nie všetko vyšlo; detaily vyššie (nič nezakrývam)",
  );
  console.log("Čo tento výsledok NEznamená:");
  console.log("  • nie je to dôkaz o prehliadači (runner obchádza UI a volá API appky)");
  console.log("  • obrazové vrstvy (b-roll/fotky) a priblíženia zatiaľ táto linka nekreslí — viď zoznam vyššie");
  console.log("  • zvuk sa porovnáva obsahovo (PCM 16 kHz mono), nie bajtovo vo formáte AAC");
  console.log("=".repeat(78));

  rmSync(workDir, { recursive: true, force: true });
  process.exit(pass ? 0 : 20);
}

main().catch((err) => {
  console.error("Runner spadol:", err);
  process.exit(1);
});

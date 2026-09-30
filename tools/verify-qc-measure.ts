/**
 * KROK 29 — REAL-MEDIA DÔKAZ: „meranie QC sedí na skutočnom videe.“
 *
 * Čo tento runner robí (nič nepreskakuje):
 *  1) vezme REÁLNE video z disku,
 *  2) postaví z neho canonical projekt (rovnakou funkciou ako exportné runnery),
 *  3) PRIDÁ REÁLNY STRIH (dva zdroje → dva klipy na osi),
 *  4) zmeria os modulom `measureProject` (ten istý, ktorý používa QC panel a retenčný prehľad),
 *  5) zmeria ju DRUHÝKRÁT a porovná (determinizmus),
 *  6) skontroluje, že kontroly bez merania nemajú PASS,
 *  7) zapíše protokol do `docs/proof-qc-measure.txt`.
 *
 * Poctivo: toto je REAL MEDIA VERIFIED pre **meranie**. Neznamená to, že to
 * niekto videl v prehliadači (BROWSER VERIFIED) — to vie overiť len používateľ.
 *
 * Spustenie: bun run tools/verify-qc-measure.ts [video]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { spawnSync } from "node:child_process";
import { buildRealProjectForExport } from "./verify-style-real-media";
import { measureProject, measurementSummary, verdictForCheck } from "../src/core/qc/qcMeasure";
import { INITIAL_QC_GATE_CHECKS } from "../src/data/qcGateChecksData";
import type { ClipModel, ProjectModel } from "../src/core/types/project";

const mediaPath = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "/home/user/real-media/real_speech.mp4";

/** Dĺžka média z ffprobe (imageio-ffmpeg) — žiadne konštanty. */
function probeDuration(file: string): number {
  const exe = spawnSync("python3", ["-c", "import imageio_ffmpeg,sys;sys.stdout.write(imageio_ffmpeg.get_ffmpeg_exe())"], { encoding: "utf-8" }).stdout?.trim() ?? "";
  if (!exe) return 0;
  const res = spawnSync(exe, ["-hide_banner", "-i", file], { encoding: "utf-8" });
  const m = `${res.stderr ?? ""}`.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

function line(label: string, value: string | number | boolean) {
  console.log(`${label.padEnd(44, ".")} ${value}`);
}

/** Z jedného klipu spraví dva s reálnym strihom v polovici. */
function addRealCut(project: ProjectModel): ProjectModel {
  const videoTrack = project.tracks.find((t) => t.type === "video");
  if (!videoTrack || videoTrack.clips.length === 0) return project;
  const first = videoTrack.clips[0] as ClipModel;
  const half = Math.round((first.duration / 2) * 100) / 100;
  const second: ClipModel = {
    ...first,
    id: `${first.id}_b`,
    sourceStart: first.sourceStart + half,
    sourceEnd: first.sourceEnd,
    start: first.start + half,
    timelineStart: first.start + half,
    duration: Math.round((first.duration - half) * 100) / 100,
  };
  const trimmed: ClipModel = { ...first, sourceEnd: first.sourceStart + half, duration: half };
  return { ...project, tracks: project.tracks.map((t) => (t.id === videoTrack.id ? { ...t, clips: [trimmed, second] } : t)) };
}

async function main() {
  const report: string[] = [];
  const say = (s: string) => {
    console.log(s);
    report.push(s);
  };

  say("=".repeat(78));
  say("KROK 29 — REAL-MEDIA DÔKAZ MERANIA (QC + retenčný prehľad)");
  say("=".repeat(78));

  if (!existsSync(mediaPath)) {
    say(`CHYBA: médium ${mediaPath} neexistuje.`);
    writeFileSync("docs/proof-qc-measure.txt", report.join("\n") + "\n", "utf-8");
    process.exit(2);
  }

  const media = readFileSync(mediaPath);
  // POCTIVOSŤ: dĺžku meriame z média (ffprobe), nikdy nedosadzujeme konštantu.
  const durationSec = probeDuration(mediaPath);
  if (!(durationSec > 0)) {
    say(`CHYBA: dĺžku média sa nepodarilo zmerať (${mediaPath}).`);
    writeFileSync("docs/proof-qc-measure.txt", report.join("\n") + "\n", "utf-8");
    process.exit(2);
  }
  line("médium", basename(mediaPath));
  line("dĺžka (ffprobe)", `${durationSec.toFixed(2)} s`);
  report.push(`médium: ${basename(mediaPath)} (${media.byteLength} B, dĺžka z ffprobe ${durationSec.toFixed(2)} s)`);

  const built = buildRealProjectForExport(media, mediaPath, durationSec);
  if (!built) {
    say("CHYBA: canonical projekt sa nepodarilo postaviť.");
    process.exit(1);
  }

  const project = addRealCut(built);
  const videoTrack = project.tracks.find((t) => t.type === "video")!;
  line("klipy na video stope", videoTrack.clips.length);
  line("očakávaný počet strihov", videoTrack.clips.length - 1);

  // 1) Meranie č. 1
  const m1 = measureProject(project);

  // 2) Meranie č. 2 (determinizmus)
  const m2 = measureProject(project);
  const strip = (x: ReturnType<typeof measureProject>) => JSON.stringify({ ...x, projectId: "" });
  const deterministic = strip(m1) === strip(m2);

  say("");
  say("— NAMERANÉ (canonical os z reálneho videa) —");
  const rows: [string, string | number | boolean][] = [
    ["meranie prešlo (ok)", m1.ok],
    ["dĺžka osi (s)", m1.timelineDurationSec],
    ["klipov celkom", m1.clipCount],
    ["video klipy", m1.videoClipCount],
    ["strihy", m1.cutCount],
    ["strihov / min", m1.cutsPerMinute ?? "—"],
    ["medián záberu (s)", m1.medianShotSec ?? "—"],
    ["zábery pod 1,5 s", m1.shotsUnder1_5s],
    ["zvukové stopy", m1.audioTrackCount],
    ["zvukové klipy", m1.audioClipCount],
    ["titulky", m1.captionSegmentCount],
    ["prechody na osi", m1.transitionCount],
    ["kolízie na stope", m1.overlapCount],
    ["formát", `${m1.aspect ?? "—"}${m1.fps ? ` @ ${m1.fps} fps` : ""}`],
    ["hustota (12 úsekov, súčet strihov)", m1.densitySeries.reduce((s, p) => s + p.cuts, 0)],
    ["determinizmus (2 merania zhodné)", deterministic],
  ];
  for (const [k, v] of rows) {
    line(k, v);
    report.push(`${k}: ${v}`);
  }

  // 3) Kontroly bez merania nesmú mať PASS
  const noMeasurement = ["QC-05", "QC-07", "QC-13", "QC-19", "QC-20", "QC-23", "QC-25"];
  const badPass = noMeasurement.filter((id) => verdictForCheck(id, m1).status === "PASS");
  const summary = measurementSummary(INITIAL_QC_GATE_CHECKS.map((c) => c.id), m1, { platform: "Instagram Reels" });

  say("");
  say("— KONTROLY —");
  say(`merané: ${summary.measured} · PASS: ${summary.pass} · WARNING/REVIEW: ${summary.warning} · FAIL: ${summary.fail} · NOT VERIFIED: ${summary.notVerified}`);
  say(`kontroly bez merania, ktoré by nesmeli mať PASS: ${badPass.length === 0 ? "OK (žiadna)" : badPass.join(", ")}`);
  report.push(`merané: ${summary.measured} · PASS: ${summary.pass} · WARNING/REVIEW: ${summary.warning} · FAIL: ${summary.fail} · NOT VERIFIED: ${summary.notVerified}`);
  report.push(`kontroly bez merania s PASS (musí byť prázdne): ${badPass.join(", ") || "žiadna"}`);

  const checks: [string, boolean][] = [
    ["strihy zodpovedajú klipom na osi", m1.cutCount === videoTrack.clips.length - 1],
    ["strihy v hustote sedia s počtom strihov", m1.densitySeries.reduce((s, p) => s + p.cuts, 0) === m1.cutCount],
    ["meranie je deterministické", deterministic],
    ["žiadna kontrola bez merania nemá PASS", badPass.length === 0],
  ];

  say("");
  say("— VÝSLEDOK —");
  let allOk = true;
  for (const [name, ok] of checks) {
    say(`${ok ? "OK  " : "FAIL"}  ${name}`);
    report.push(`${ok ? "OK" : "FAIL"}: ${name}`);
    if (!ok) allOk = false;
  }
  say("");
  say("Poznámka: REAL MEDIA VERIFIED pre meranie. Nie je to BROWSER VERIFIED —");
  say("obrazovku musí otvoriť používateľ v appke (záložka Kontrola kvality).");
  report.push("");
  report.push("Poznámka: REAL MEDIA VERIFIED pre meranie (nie BROWSER VERIFIED).");

  writeFileSync("docs/proof-qc-measure.txt", report.join("\n") + "\n", "utf-8");
  process.exit(allOk ? 0 : 1);
}

void main();

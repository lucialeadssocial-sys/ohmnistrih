#!/usr/bin/env bun
/**
 * REFERENČNÉ VIDEO → MERANIE (krok 12, Reality Gate) — reálna verifikácia.
 *
 * Prečo: krok 11 vie zmerať **jednu snímku**. Štýl referenčného klipu ale nie je
 * jedna snímka — je to **tempo strihu, dĺžka záberov, dynamika, paleta v čase
 * a podiel času, ktorý nesie rečník**. Tento runner to zmeria z reálnych pixelov
 * reálneho videa a zapíše JSON, z ktorého sa robí recept.
 *
 * Čo meria (všetko z pixelov, nič z mena súboru):
 *  - strihy: ffmpeg `select='gt(scene,T)'` (T = 0,3) + zlúčenie strihov bližších ako 0,25 s
 *  - dĺžky záberov: medián, priemer, podiely krátkych/stredných/dlhých
 *  - na vzorke 2 snímky/s (270×480): jas, kontrast, sýtosť, teplota, hustota hrán,
 *    tmavé/stredné/svetlé, jas pásiem (dole = pás titulkov)
 *  - dynamika: priemerná zmena jasu medzi susednými vzorkami (0–255)
 *  - paleta: spojenie paliet vzoriek vážené pokrytím
 *
 * Čo NEmeria (a appka to nesmie tvrdiť):
 *  - či je v zábere naozaj tvár/rečník (nemáme detektor tvárí) — „rečník" je
 *    odhad z DĹŽKY záberu a dynamiky, preto sa v reporte volá odhadom,
 *  - či sú titulky naozaj text (meria sa len svetlý pás dole),
 *  - hudbu, zvuk, zámer autora.
 *
 * Použitie:
 *   bun run tools/measure-reference-video.ts <video1> <video2> … [--out stats.json] [--fps 2] [--cuts 0.3]
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
// Typy staticky: dynamický `import()` s vypočítanou cestou vracia `any`,
// takže bez tohto by sa stratila typová kontrola (a lint hlási implicitné any).
import type {
  MergedColor,
  MotionStats,
  ShotStats,
  VideoAggregate,
} from "../src/core/style/referenceVideoStats";

const REPO = "/home/user/ohmnistrih";

const args = process.argv.slice(2);
const valueOf = (flag: string): string | undefined => {
  const withEq = args.find((a) => a.startsWith(`${flag}=`));
  if (withEq) return withEq.slice(flag.length + 1);
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
// Pozor: `--out` je JSON a existuje po prvom behu — nesmie sa považovať za video.
// Preto sa vstupy filtrujú aj podľa prípony, nielen podľa existencie.
const inputs = args.filter(
  (a) => !a.startsWith("--") && /\.(mp4|mov|mkv|webm|m4v)$/i.test(a) && existsSync(a),
);
const outPath = valueOf("--out") ?? "/home/user/referencie/analyza-videa.json";
const sampleFps = Number(valueOf("--fps") ?? "2");
const cutThreshold = Number(valueOf("--cuts") ?? "0.3");

if (inputs.length === 0) {
  console.error("Použitie: bun run tools/measure-reference-video.ts <video…> [--out stats.json]");
  process.exit(2);
}

function ffmpegExe(): string {
  const fromImageio = spawnSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"], {
    encoding: "utf-8",
  });
  const exe = (fromImageio.stdout ?? "").trim();
  if (exe.length > 0 && existsSync(exe)) return exe;
  const which = spawnSync("which", ["ffmpeg"], { encoding: "utf-8" });
  const w = (which.stdout ?? "").trim();
  if (w.length > 0) return w;
  throw new Error("ffmpeg sa nenašiel (pip install imageio-ffmpeg)");
}

const ff = ffmpegExe();
const line = (label: string, value: string | number) => console.log(`${label.padEnd(44, ".")} ${value}`);

// ---------------------------------------------------------------------------
// 1) ffmpeg: strihy + trvanie + rozlíšenie
// ---------------------------------------------------------------------------

function probe(file: string): { durationSec: number; width: number; height: number; fps: number } {
  const r = spawnSync(ff, ["-hide_banner", "-i", file], { encoding: "utf-8" });
  const text = `${r.stderr ?? ""}`;
  const dur = /Duration: (\d+):(\d+):([\d.]+)/.exec(text);
  const durationSec = dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : 0;
  const stream = /Stream #0:0[^\n]*/.exec(text)?.[0] ?? "";
  const size = /(\d{3,5})x(\d{3,5})/.exec(stream);
  const fpsM = /([\d.]+) fps/.exec(stream);
  return {
    durationSec,
    width: size ? Number(size[1]) : 0,
    height: size ? Number(size[2]) : 0,
    fps: fpsM ? Number(fpsM[1]) : 0,
  };
}

/** Strihy = časy, kde ffmpeg ohlási scene score > T. */
function cutTimes(file: string): { times: number[]; scores: number[] } {
  const r = spawnSync(
    ff,
    [
      "-hide_banner", "-nostats",
      "-i", file,
      "-vf", `select='gt(scene,${cutThreshold})',metadata=print:key=lavfi.scene_score:file=-`,
      "-an", "-sn", "-f", "null", "-",
    ],
    { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 },
  );
  const text = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const times: number[] = [];
  const scores: number[] = [];
  let lastTime = -1;
  for (const raw of text.split("\n")) {
    const t = /pts_time:([\d.]+)/.exec(raw);
    if (t) {
      lastTime = Number(t[1]);
      continue;
    }
    const s = /lavfi\.scene_score=([\d.]+)/.exec(raw);
    if (s && lastTime >= 0) {
      times.push(lastTime);
      scores.push(Number(s[1]));
      lastTime = -1;
    }
  }
  return { times, scores };
}

// ---------------------------------------------------------------------------
// 2) ffmpeg: vzorky snímok (rovnomerné v čase) na 270×480 RGBA
// ---------------------------------------------------------------------------

/**
 * Vzorkovacie rozmery sa **prispôsobia videu**. Keby sa na 9:16 pridávali čierne
 * pruhy, krajové pásy by merali pruhy, nie obraz — presne tá chyba, ktorú odhalil
 * prvý beh na širokouhlom klip (hlásil 80 % tmavých pixelov a pásy 0/87/0).
 * Preto: kratšia strana = 270 px, dlhšia podľa pomeru, **bez paddingu**.
 */
function sampleSize(width: number, height: number): { w: number; h: number } {
  const shortSide = 270;
  const scale = shortSide / Math.max(1, Math.min(width, height));
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  return { w: even(width * scale), h: even(height * scale) };
}

function sampleFrames(file: string, meta: { width: number; height: number }): {
  frameCount: number;
  bytes: Uint8ClampedArray;
  width: number;
  height: number;
} {
  const rawPath = "/tmp/measure-reference.raw";
  const { w, h } = sampleSize(meta.width, meta.height);
  const r = spawnSync(ff, [
    "-y", "-hide_banner", "-loglevel", "error",
    "-i", file,
    "-vf", `fps=${sampleFps},scale=${w}:${h}`,
    "-f", "rawvideo", "-pix_fmt", "rgba", rawPath,
  ]);
  if (r.status !== 0 || !existsSync(rawPath)) throw new Error(`Dekódovanie vzoriek zlyhalo: ${file}`);
  const bytes = new Uint8ClampedArray(readFileSync(rawPath));
  return { frameCount: Math.floor(bytes.length / (w * h * 4)), bytes, width: w, height: h };
}

// ---------------------------------------------------------------------------
// 3) analýza: tá istá funkcia, akú používa prehliadač (krok 11)
// ---------------------------------------------------------------------------

const { analyzeReferencePixels } = await import(join(REPO, "src/core/style/referencePixels.ts"));
const {
  shotStatsFromCuts,
  aggregateFrameAnalyses,
  motionBetweenFrames,
  mergePalettes,
  videoStyleHints,
  summarizeVideos,
} = await import(join(REPO, "src/core/style/referenceVideoStats.ts"));

const report: Record<string, unknown> = {};
const summaryRows: Array<{
  durationSec: number;
  shot: ShotStats;
  aggregate: VideoAggregate;
  motion: MotionStats;
  palette: MergedColor[];
}> = [];

for (const file of inputs) {
  const meta = probe(file);
  const cuts = cutTimes(file);
  const sampled = sampleFrames(file, meta);
  const frameCount = sampled.frameCount;
  const bytes = sampled.bytes;
  const sampleW = sampled.width;
  const sampleH = sampled.height;
  const frameBytes = sampleW * sampleH * 4;

  const perFrame: Array<ReturnType<typeof analyzeReferencePixels>> = [];
  const palettes: Array<Array<{ hex: string; coverage: number }>> = [];
  for (let i = 0; i < frameCount; i++) {
    const slice = bytes.slice(i * frameBytes, (i + 1) * frameBytes);
    const a = analyzeReferencePixels(slice, sampleW, sampleH);
    perFrame.push(a);
    if (a.available) palettes.push(a.palette.map((c: { hex: string; coverage: number }) => ({ hex: c.hex, coverage: c.coverage })));
  }

  const motion = motionBetweenFrames(bytes, sampleW, sampleH, frameCount, sampleFps);
  const shotStats = shotStatsFromCuts(cuts.times, meta.durationSec);
  const aggregate = aggregateFrameAnalyses(perFrame);
  const palette = mergePalettes(palettes, 6);
  const hints = videoStyleHints(shotStats, aggregate, motion);

  const name = file.split("/").pop() ?? file;
  report[name] = {
    subor: name,
    trvanie_s: Number(meta.durationSec.toFixed(2)),
    fps: meta.fps,
    rozmer: `${meta.width}x${meta.height}`,
    vzorkovany_rozmer: `${sampleW}x${sampleH}`,
    strihy: shotStats.cutCount,
    zlucene_strihy: shotStats.mergedCuts,
    strihy_za_s: Number(shotStats.cutsPerSecond.toFixed(2)),
    median_zaberu_s: Number(shotStats.medianShotSec.toFixed(2)),
    priemer_zaberu_s: Number(shotStats.meanShotSec.toFixed(2)),
    podiel_kratkych_do_1_2s: Number(shotStats.shortShare.toFixed(2)),
    podiel_dlhsich_od_2_5s: Number(shotStats.longShare.toFixed(2)),
    vzoriek_snimok: aggregate.frameCount,
    jas: aggregate.brightness,
    kontrast: aggregate.contrast,
    saturace_pct: Math.round(aggregate.saturation * 100),
    teplota: aggregate.warmth,
    hustota_hran: aggregate.edgeDensity,
    tmave_pct: Math.round(aggregate.darkRatio * 100),
    svetle_pct: Math.round(aggregate.lightRatio * 100),
    jas_pasov_hore_stred_dole: aggregate.bands.map((b: number) => Math.round(b)),
    podiel_svetleho_spodku: Number(aggregate.bottomBandBrightShare.toFixed(2)),
    dynamika_na_s: Number(motion.perSecond.toFixed(2)),
    dynamika_p90: Number(motion.p90.toFixed(2)),
    podiel_kludnych_vzoriek: Number(motion.calmShare.toFixed(2)),
    paleta: palette.map((c: MergedColor) => `${c.hex} ${(c.coverage * 100).toFixed(1)} %`),
    akcent: aggregate.accent ? `${aggregate.accent.hex} (${(aggregate.accent.coverage * 100).toFixed(1)} %)` : null,
    popis: aggregate.moodSk,
    podiel_dlhkych_zaberov_pct: Math.round(hints.longTakeRatio * 100),
    tempo: hints.tempoSk,
    odporucania: hints.hintsSk,
    nedetekovatelne: hints.notDetectableSk,
  };

  console.log("=".repeat(78));
  console.log(name);
  console.log("=".repeat(78));
  line("trvanie / fps / rozmer", `${meta.durationSec.toFixed(2)} s · ${meta.fps} fps · ${meta.width}×${meta.height}`);
  line("strihy (scene > " + cutThreshold + ")", `${shotStats.cutCount} → ${shotStats.cutsPerSecond.toFixed(2)}/s`);
  line("dĺžka záberu (medián / priemer)", `${shotStats.medianShotSec.toFixed(2)} s / ${shotStats.meanShotSec.toFixed(2)} s`);
  line("krátke ≤1,2 s / dlhé ≥2,5 s", `${(shotStats.shortShare * 100).toFixed(0)} % / ${(shotStats.longShare * 100).toFixed(0)} %`);
  line("jas / kontrast / sýtosť", `${aggregate.brightness} / ${aggregate.contrast} / ${Math.round(aggregate.saturation * 100)} %`);
  line("teplota (R−B)", aggregate.warmth);
  line("hustota hrán (0–1)", aggregate.edgeDensity);
  line("tmavé / stredné / svetlé", `${Math.round(aggregate.darkRatio * 100)} % / ${Math.round(aggregate.midRatio * 100)} % / ${Math.round(aggregate.lightRatio * 100)} %`);
  line("jas pásov hore/stred/dole", aggregate.bands.map((b: number) => Math.round(b)).join(" / "));
  line("podiel svetlého spodku", aggregate.bottomBandBrightShare.toFixed(2));
  line("dynamika (0–255 na s)", `${motion.perSecond.toFixed(2)} · pokojné vzorky ${(motion.calmShare * 100).toFixed(0)} %`);
  line("paleta", palette.map((c: MergedColor) => `${c.hex} ${(c.coverage * 100).toFixed(1)} % (v ${Math.round(c.frameShare * 100)} % vzoriek)`).join(" · "));
  line("akcent", aggregate.accent ? aggregate.accent.hex : "—");
  line("popis", aggregate.moodSk);
  line("tempo", hints.tempoSk);
  line("podiel času v dlhých záberoch", `${Math.round(hints.longTakeRatio * 100)} % (dĺžka záberu, NIE podiel rečníka)`);
  line("stála farba vs. občasná", palette.map((c: MergedColor) => `${c.hex} v ${Math.round(c.frameShare * 100)} %`).join(" · ") || "—");
  console.log("");

  summaryRows.push({
    durationSec: meta.durationSec,
    shot: shotStats,
    aggregate,
    motion,
    palette,
  });
}

// ---------------------------------------------------------------------------
// Súhrn — podklad pre recept (medián cez videá, nie jeden klip)
// ---------------------------------------------------------------------------

if (summaryRows.length > 1) {
  const s = summarizeVideos(summaryRows);
  report._suhrn = {
    pocet_videi: s.videoCount,
    celkove_trvanie_s: s.totalDurationSec,
    median_strihy_za_s: s.medianCutsPerSecond,
    median_zaber_s: s.medianShotSec,
    median_jas: s.medianBrightness,
    median_kontrast: s.medianContrast,
    median_saturace_pct: Math.round(s.medianSaturation * 100),
    median_hustota_hran: s.medianEdgeDensity,
    median_dynamika_na_s: s.medianMotionPerSecond,
    podiel_videi_so_svetlym_spodkom: s.brightBottomVideoShare,
    stala_paleta: s.sharedPalette.map((c: MergedColor) => `${c.hex} (v ${Math.round(c.frameShare * 100)} % videí)`),
    obcasna_paleta: s.occasionalPalette.map((c: MergedColor) => `${c.hex} (v ${Math.round(c.frameShare * 100)} % videí)`),
    poctivost:
      "Medián cez videá. Podiel rečníka sa NEmeria (bez detektora tvárí) — meria sa len dĺžka záberov a dynamika.",
  };

  console.log("=".repeat(78));
  console.log(`SÚHRN CEZ ${s.videoCount} VIDEÍ (medián — jeden klip neprebije ostatné)`);
  console.log("=".repeat(78));
  line("celkové trvanie", `${s.totalDurationSec} s`);
  line("strihy za sekundu (medián)", s.medianCutsPerSecond);
  line("dĺžka záberu (medián)", `${s.medianShotSec} s`);
  line("jas / kontrast / sýtosť (medián)", `${s.medianBrightness} / ${s.medianContrast} / ${Math.round(s.medianSaturation * 100)} %`);
  line("hustota hrán / dynamika (medián)", `${s.medianEdgeDensity} / ${s.medianMotionPerSecond}`);
  line("videá so svetlým spodkom", `${Math.round(s.brightBottomVideoShare * 100)} % (${summaryRows.filter((r: { aggregate: VideoAggregate }) => r.aggregate.bottomBandBrightShare >= 0.5).length}/${s.videoCount})`);
  line("stála paleta (≥ 50 % videí)", s.sharedPalette.map((c: MergedColor) => c.hex).join(" · ") || "— žiadna farba sa neopakuje vo väčšine videí");
  line("občasná paleta", s.occasionalPalette.map((c: MergedColor) => c.hex).join(" · ") || "—");
  console.log("");
}

writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
console.log(`Meranie zapísané: ${outPath}`);

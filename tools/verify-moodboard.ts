#!/usr/bin/env bun
/**
 * MOODBOARD / GRID → MERANIE (krok 14) — reálna verifikácia.
 *
 * Prečo: tvorca, ktorého štýl meriame, má zverejnený postup, ktorý hovorí, že si
 * **najprv vygeneruje grid / moodboard a ten použije ako referenciu**. Appka musí
 * vedieť takú referenciu zmerať po paneloch — inak zmeria priemer, ktorý neopisuje
 * ani jednu scénu.
 *
 * Tento runner:
 *  1. vezme reálne video a z daných časov vytiahne snímky,
 *  2. poskladá z nich grid (ffmpeg `hstack`) — teda presne ten typ obrázka, aký
 *     používa ako referenciu,
 *  3. zmeria panely **tou istou funkciou, akú používa appka** (`analyzeMoodboard`),
 *  4. zapíše grid ako PNG a meranie ako JSON.
 *
 * Čo to NIE je:
 *  - **nie je to jeho moodboard** — grid som poskladal ja z jeho reálnych snímok
 *    (jeho vlastný referenčný obrázok nemám a nedomýšľam si ho). V reporte je to
 *    napísané priamo.
 *  - nie je to dôkaz o prehliadači (UI cestu k pixelom overuje až používateľ).
 *
 * Použitie:
 *   bun run tools/verify-moodboard.ts <video> --at 2,8,14,20 [--rows 1 --cols 4] [--out grid.png]
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// Typy staticky — dynamický import s vypočítanou cestou vracia `any` (a lint to hlási).
import type { MoodboardAnalysis } from "../src/core/style/referenceGrid";

const REPO = "/home/user/ohmnistrih";

const args = process.argv.slice(2);
const valueOf = (flag: string): string | undefined => {
  const withEq = args.find((a) => a.startsWith(`${flag}=`));
  if (withEq) return withEq.slice(flag.length + 1);
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

const input = args.find((a) => !a.startsWith("--") && /\.(mp4|mov|mkv|webm|m4v|png|jpg|jpeg)$/i.test(a));
const timesArg = valueOf("--at") ?? "2,8,14,20";
const times = timesArg
  .split(",")
  .map((t) => Number(t.trim()))
  .filter((t) => Number.isFinite(t) && t >= 0);
const rowsArg = valueOf("--rows");
const colsArg = valueOf("--cols");
const outPng = valueOf("--out") ?? "/home/user/kontrola-krok14-moodboard.png";
const panelW = Number(valueOf("--panel-w") ?? "270");
const panelH = Number(valueOf("--panel-h") ?? "480");

if (!input || !existsSync(input) || times.length === 0) {
  console.error("Použitie: bun run tools/verify-moodboard.ts <video|obrazok> --at 2,8,14,20 [--rows 1 --cols 4] [--out grid.png]");
  process.exit(2);
}

function ffmpegExe(): string {
  const r = spawnSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"], { encoding: "utf-8" });
  const exe = (r.stdout ?? "").trim();
  if (exe && existsSync(exe)) return exe;
  const w = (spawnSync("which", ["ffmpeg"], { encoding: "utf-8" }).stdout ?? "").trim();
  if (w) return w;
  throw new Error("ffmpeg sa nenašiel (pip install imageio-ffmpeg)");
}

const ff = ffmpegExe();
const line = (label: string, value: string | number) => console.log(`${label.padEnd(46, ".")} ${value}`);

// ---------------------------------------------------------------------------
// 1) poskladanie gridu z reálnych snímok
// ---------------------------------------------------------------------------

const work = mkdtempSync(join(tmpdir(), "moodboard-"));
const framePaths: string[] = [];
for (let i = 0; i < times.length; i++) {
  const p = join(work, `frame-${i}.png`);
  const r = spawnSync(ff, [
    "-y", "-hide_banner", "-loglevel", "error",
    "-ss", String(times[i]), "-i", input,
    "-frames:v", "1",
    "-vf", `scale=${panelW}:${panelH}:force_original_aspect_ratio=decrease,pad=${panelW}:${panelH}:(ow-iw)/2:(oh-ih)/2:black`,
    p,
  ]);
  if (r.status !== 0 || !existsSync(p)) {
    console.error(`Snímku v ${times[i]} s sa nepodarilo získať.`);
    process.exit(3);
  }
  framePaths.push(p);
}

// Grid skladáme cez `hstack`; medzery medzi panelmi sú zámerne ČIERNE, aby ich
// appka musela naozaj nájsť (nie aby sme jej to uľahčili).
const cols = Number(colsArg ?? String(times.length));
const rows = Number(rowsArg ?? String(Math.ceil(times.length / cols)));
const gutter = 6;
const inputs: string[] = [];
for (const p of framePaths) inputs.push("-i", p);

// Medzera musí byť MEDZI panelmi — preto sa pridáva ako `pad` na pravý (prípadne
// spodný) okraj každého panelu okrem posledného v riadku/stĺpci. Prvý pokus pridal
// medzery na koniec celého riadku, čo by nebol grid, ale pruh navyše.
const filterParts: string[] = [];
let idx = 0;
const rowImages: string[] = [];
for (let r = 0; r < rows; r++) {
  const inRow = framePaths.slice(r * cols, (r + 1) * cols);
  if (inRow.length === 0) continue;
  const labels: string[] = [];
  for (let c = 0; c < inRow.length; c++) {
    const label = `[v${idx}]`;
    const needsRightPad = c < inRow.length - 1;
    // Pozor na syntax: vstup musí byť v hranatých zátvorkách (`[0:v]`), inak
    // ffmpeg ohlási „Invalid argument“ a filter sa vôbec nespustí.
    filterParts.push(`[${idx}:v]${needsRightPad ? `pad=iw+${gutter}:ih:0:0:black` : "null"}${label}`);
    labels.push(label);
    idx++;
  }
  if (inRow.length === 1) {
    filterParts.push(`${labels[0]}null[row${r}]`);
  } else {
    filterParts.push(`${labels.join("")}hstack=inputs=${inRow.length}[row${r}]`);
  }
  rowImages.push(`[row${r}]`);
}
// Zvislé medzery medzi riadkami
const paddedRows: string[] = [];
rowImages.forEach((label, r) => {
  const needsBottomPad = r < rowImages.length - 1;
  const out = `[rp${r}]`;
  filterParts.push(`${label}${needsBottomPad ? `pad=iw:ih+${gutter}:0:0:black` : "null"}${out}`);
  paddedRows.push(out);
});
filterParts.push(
  paddedRows.length === 1
    ? `${paddedRows[0]}null[grid]`
    : `${paddedRows.join("")}vstack=inputs=${paddedRows.length}[grid]`,
);

const stack = spawnSync(ff, [
  "-y", "-hide_banner", "-loglevel", "error",
  ...inputs,
  "-filter_complex", filterParts.join(";"),
  "-map", "[grid]", "-frames:v", "1", outPng,
]);
if (stack.status !== 0 || !existsSync(outPng)) {
  console.error(`Grid sa nepodarilo poskladať: ${(stack.stderr ?? "").toString().slice(-300)}`);
  process.exit(4);
}

// ---------------------------------------------------------------------------
// 2) meranie tou istou funkciou, akú používa appka
// ---------------------------------------------------------------------------

const rawPath = join(work, "grid.rgba");
const decode = spawnSync(ff, [
  "-y", "-hide_banner", "-loglevel", "error",
  "-i", outPng,
  "-f", "rawvideo", "-pix_fmt", "rgba", rawPath,
]);
if (decode.status !== 0) {
  console.error("Dekódovanie gridu zlyhalo.");
  process.exit(5);
}
const pixels = new Uint8ClampedArray(readFileSync(rawPath));

// rozmery z PNG hlavičky (IHDR) — bez spoliehania sa na ffmpeg výpis
const png = readFileSync(outPng);
const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);

const { analyzeMoodboard, panelPaletteSpread } = (await import(
  join(REPO, "src/core/style/referenceGrid.ts")
)) as typeof import("../src/core/style/referenceGrid");

console.log("=".repeat(78));
console.log("MOODBOARD / GRID — REÁLNE MERANIE PANELOV");
console.log("=".repeat(78));
line("vstup", `${input} (snímky v ${times.join(", ")} s)`);
line("grid", `${outPng} — ${width}×${height} px, ${rows}×${cols} panelov`);
line("POCTIVO", "grid som poskladal ja z jeho reálnych snímok; jeho vlastný moodboard nemám");
console.log("");

// Očakávaný pomer strán jedného panelu — vieme ho, lebo grid sme skladali z 9:16 snímok.
const preferAspect = panelW / panelH;
const auto = analyzeMoodboard(pixels, width, height, { preferAspect });
line("panely nájdené samo (bez zadania)", auto.available ? `${auto.panels.length} (${auto.modeSk})` : `${auto.modeSk} — ${auto.reasonSk ?? ""}`);
line("očakávaný pomer strán panelu", preferAspect.toFixed(3));
line("podiel medzier na ploche", auto.available ? auto.gutterShare : "—");
console.log("");

const result = rowsArg || colsArg ? analyzeMoodboard(pixels, width, height, { rows, cols }) : auto;

if (!result.available) {
  console.error(`Meranie panelov nejde: ${result.reasonSk ?? result.modeSk}`);
  process.exit(6);
}

console.log(`── PANELY (${result.modeSk}) ──────────────────────────────────────────`);
for (const p of result.panels) {
  const a = p.analysis;
  console.log(
    `  #${String(p.index + 1).padStart(2)}  ${String(p.width).padStart(4)}×${String(p.height).padEnd(4)}  ` +
      `jas ${String(Math.round(a.brightness)).padStart(3)} · kontrast ${String(Math.round(a.contrast)).padStart(3)} · ` +
      `sýtosť ${String(Math.round(a.saturation * 100)).padStart(3)} % · hrany ${a.edgeDensity.toFixed(3)} · ` +
      `paleta ${a.palette.slice(0, 2).map((c: { hex: string }) => c.hex).join(" ")}`,
  );
}
console.log("");
line("priemer cez panely (jas/kontrast)", `${result.average!.brightness} / ${result.average!.contrast}`);
console.log("");
console.log("  Poznámky (čo appka sama píše k výsledku):");
for (const n of result.notesSk) console.log(`   • ${n}`);
console.log("");
console.log("  Farby naprieč panelmi (farba · v koľkých paneloch):");
for (const c of panelPaletteSpread(result).slice(0, 8)) {
  console.log(`   • ${c.hex} · ${c.panels}/${result.panels.length} panelov · pokrytie ${(c.averageCoverage * 100).toFixed(1)} %`);
}
console.log("");
console.log("  Čo to NEtvrdí:");
console.log("   – nie je to jeho moodboard (grid je poskladaný z jeho snímok),");
console.log("   – appka obrázky ani video negeneruje, meria len to, čo dostane,");
console.log("   – či sú panely správne rozdelené, ukazuje počet a režim vyššie.");

writeFileSync(
  outPng.replace(/\.png$/, ".json"),
  `${JSON.stringify(
    {
      vstup: input,
      casy_s: times,
      grid: `${width}x${height}`,
      rezim: result.modeSk,
      podiel_medzier: result.gutterShare,
      panely: result.panels.map((p: MoodboardAnalysis["panels"][number]) => ({
        index: p.index + 1,
        x: p.x,
        y: p.y,
        sirka: p.width,
        vyska: p.height,
        jas: p.analysis.brightness,
        kontrast: p.analysis.contrast,
        saturace: p.analysis.saturation,
        hustota_hran: p.analysis.edgeDensity,
        paleta: p.analysis.palette
          .slice(0, 4)
          .map((c: { hex: string; coverage: number }) => `${c.hex} ${(c.coverage * 100).toFixed(1)} %`),
      })),
      priemer: result.average,
      poznamky: result.notesSk,
      poctivost: "Grid je poskladany z realnych snimok jeho videi; jeho vlastny moodboard obrazok nemame.",
    },
    null,
    2,
  )}\n`,
  "utf-8",
);
console.log(`\nMeranie zapísané: ${outPng.replace(/\.png$/, ".json")}`);

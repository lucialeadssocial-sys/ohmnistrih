#!/usr/bin/env bun
/**
 * REFERENČNÝ OBRÁZOK → MERANIE (krok 11 Reality Gate) — reálna verifikácia.
 *
 * Prečo takto: analýza musí bežať nad **skutočnými pixelmi**, nie nad menom súboru.
 * Tento runner vezme reálny obrázok (napr. snímku z reálneho referenčného videa),
 * dekóduje ho cez ffmpeg na surové RGBA a zavolá **tú istú funkciu**
 * (`analyzeReferencePixels`), akú používa prehliadač. Ak by sa niekedy rozslišli,
 * tento runner by to ukázal.
 *
 * Čo to NEznamená:
 *  - nie je to dôkaz o prehliadači (runner obchádza UI),
 *  - snímka z videa nie je „referenčný obrázok" v zmysle dizajnérskej predlohy;
 *    je to reálny obraz z reálneho videa používateľa (a je tak pomenovaný),
 *  - deska štýlu je dáta (vzorky farieb + čísla), nie generovaný obrázok — appka
 *    na generovanie obrázkov nemá providera a nepredstiera ho.
 *
 * Použitie:
 *   bun run tools/verify-reference-image.ts <obrazok.png|video.mp4> [--at 5] [--out board.png]
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REPO = "/home/user/ohmnistrih";

const args = process.argv.slice(2);
const valueOf = (flag: string): string | undefined => {
  const withEq = args.find((a) => a.startsWith(`${flag}=`));
  if (withEq) return withEq.slice(flag.length + 1);
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

const inputPath = args.find((a) => !a.startsWith("--"));
const atSec = Number(valueOf("--at") ?? "1");
const outPath = valueOf("--out") ?? "/home/user/referencia-deska-stylu.png";

if (!inputPath || !existsSync(inputPath)) {
  console.error("Použitie: bun run tools/verify-reference-image.ts <obrazok.png|video.mp4> [--at 5] [--out board.png]");
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
const isVideo = /\.(mp4|mov|mkv|webm|m4v)$/i.test(inputPath);

const line = (label: string, value: string | number) =>
  console.log(`${label.padEnd(46, ".")} ${value}`);

// ---------------------------------------------------------------------------
// 1) Získať pixely: z obrázka priamo, z videa snímku
// ---------------------------------------------------------------------------

const width = 480; // malé, ale dostatočné — analýza je štatistická
const height = 854;

const rawPath = "/tmp/reference-pixels.rgba";
const framePath = "/tmp/reference-frame.png";

if (isVideo) {
  const grab = spawnSync(ff, [
    "-y", "-hide_banner", "-loglevel", "error",
    "-ss", String(atSec), "-i", inputPath,
    "-frames:v", "1", framePath,
  ]);
  if (grab.status !== 0 || !existsSync(framePath)) {
    console.error("Snímku z videa sa nepodarilo získať.");
    process.exit(3);
  }
}

const sourceImage = isVideo ? framePath : inputPath;

const decode = spawnSync(ff, [
  "-y", "-hide_banner", "-loglevel", "error",
  "-i", sourceImage,
  "-vf", `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`,
  "-f", "rawvideo", "-pix_fmt", "rgba", rawPath,
]);

if (decode.status !== 0 || !existsSync(rawPath)) {
  console.error(`Dekódovanie pixelov zlyhalo: ${(decode.stderr ?? "").toString().slice(-200)}`);
  process.exit(4);
}

const pixels = new Uint8ClampedArray(readFileSync(rawPath));
console.log("=".repeat(78));
console.log("REFERENČNÝ OBRÁZOK — REÁLNE MERANIE PIXELOV");
console.log("=".repeat(78));
line("vstup", `${inputPath} (${isVideo ? `snímka v ${atSec} s` : "obrázok"})`);
line("analyzovaný rám", `${width}×${height} (${pixels.length / 4} pixelov)`);
console.log("");

// ---------------------------------------------------------------------------
// 2) Tá istá funkcia, akú používa prehliadač
// ---------------------------------------------------------------------------

const { analyzeReferencePixels, buildStyleBoard, referencePaletteForRecipe } = await import(
  join(REPO, "src/core/style/referencePixels.ts")
);
const { ReferenceStyleAnalyzer } = await import(join(REPO, "src/visual/ReferenceStyleAnalyzer.ts"));

const outcome = analyzeReferencePixels(pixels, width, height);
if (!outcome.available) {
  console.error(`Analýza sa nedá spraviť: ${outcome.reasonSk}`);
  process.exit(5);
}

console.log("── NAMERANÉ (z pixelov, nie z mena súboru) ──────────────────────────");
line("paleta (podľa pokrytia)", outcome.palette.map((c: { hex: string; coverage: number }) => `${c.hex} ${(c.coverage * 100).toFixed(1)} %`).join(" · "));
line("zvýraznenie (najsýtejšia)", outcome.accent ? `${outcome.accent.hex} (${(outcome.accent.coverage * 100).toFixed(1)} %)` : "žiadna sýta farba");
line("priemerný jas (0–255)", outcome.brightness);
line("kontrast (odchýlka jasu)", outcome.contrast);
line("sýtosť", `${(outcome.saturation * 100).toFixed(1)} %`);
line("teplota (R − B)", outcome.warmth > 0 ? `+${outcome.warmth}` : outcome.warmth);
line("tmavé / stredné / svetlé", `${(outcome.darkRatio * 100).toFixed(0)} % / ${(outcome.midRatio * 100).toFixed(0)} % / ${(outcome.lightRatio * 100).toFixed(0)} %`);
line("hustota hrán (0–1)", outcome.edgeDensity);
line("jas pásiem hore/stred/dole", outcome.bands.map((b: { brightness: number }) => b.brightness.toFixed(0)).join(" / "));
console.log("");
line("popis (po slovensky)", outcome.moodSk);
console.log("");
console.log("  Odporúčania odvodené z čísel:");
for (const h of outcome.hintsSk) console.log(`   • ${h}`);
console.log("");
console.log("  Čo sa z obrázka ZMERAŤ NEDÁ (appka to netvrdí):");
for (const n of outcome.notDetectableSk) console.log(`   – ${n}`);
console.log("");
line("metóda", outcome.analysisMethodSk);
console.log("");

// ---------------------------------------------------------------------------
// 3) Cez triedu (rovnaká cesta ako UI) + kontrola NOT AVAILABLE
// ---------------------------------------------------------------------------

console.log("── CESTA AKO V APPKЕ (ReferenceStyleAnalyzer) ───────────────────────");
const viaClass = ReferenceStyleAnalyzer.analyzeReferenceStyle("referencia.png", "verify", pixels, width, height);
line("dostupné", viaClass.available ? "áno" : `NIE (${viaClass.reasonSk})`);
if (viaClass.available) {
  line("DNA accentColor (namerané)", viaClass.dna?.accentColor ?? "?");
  line("DNA colorMood (namerané)", viaClass.dna?.colorMood ?? "?");
  line("istota (pokrytie palety)", viaClass.dna?.confidence);
  line("prevzaté z receptu (nemerateľné)", `${viaClass.inheritedSk.length} vlastností`);
  for (const i of viaClass.inheritedSk) console.log(`   – ${i}`);
  line("paleta pre recept", referencePaletteForRecipe(outcome).join(" · "));
}
console.log("");

// Kontrola, že bez pixelov appka nič nevymýšľa (predtým hádala podľa mena súboru).
const withoutPixels = ReferenceStyleAnalyzer.analyzeReferenceStyle("cinematic-dark-clean-social.png", "verify");
line("bez pixelov (meno súboru „cinematic…“)", withoutPixels.available ? "CHYBA: niečo vrátilo!" : "NOT AVAILABLE (správne)");
console.log("");

// ---------------------------------------------------------------------------
// 4) Deska štýlu — dáta + reálny PNG (bez generovania obrázkov)
// ---------------------------------------------------------------------------

const board = buildStyleBoard(outcome, { titleSk: `Deska štýlu — ${inputPath.split("/").pop()}` });
console.log("── DESKA ŠTYLU (dáta) ───────────────────────────────────────────────");
for (const s of board.swatches) {
  line(`${s.hex} — ${s.roleSk}`, `${s.coveragePercent} % plochy, sýtosť ${s.saturationPercent} %`);
}
console.log("");
line("poznámka o providerovi", board.providerSk.slice(0, 60) + "…");
console.log("");

// PNG deska: referenčná snímka + pruhy nameraných farieb (skladá sa z reálnych
// materiálov, nič sa negeneruje).
const swatchH = 80;
const boardH = Math.round((height * 520) / width);
// Šírky vzoriek musia dať PRESNE 520 px — inak `vstack` odmietne spojiť pruhy
// s referenčnou snímkou (naozaj sa to stalo: posledný pruh chýbal 4 px).
const swatchWidths = board.swatches.map((_: unknown, i: number) => {
  const n = board.swatches.length;
  const base = Math.floor(520 / n);
  return i === n - 1 ? 520 - base * (n - 1) : base;
});
const swatchFilters = board.swatches
  .map((s: { hex: string }, i: number) => `color=c=${s.hex.slice(1)}:s=${swatchWidths[i]}x${swatchH}:d=1[c${i}]`)
  .join(";");

const inputs: string[] = ["-i", sourceImage];
const filterParts: string[] = [];

filterParts.push(`[0:v]scale=520:${boardH}:force_original_aspect_ratio=decrease,pad=520:${boardH}:(ow-iw)/2:(oh-ih)/2:black[ref]`);
filterParts.push(swatchFilters);
filterParts.push(
  board.swatches.map((_: unknown, i: number) => `[c${i}]`).join("") + `hstack=inputs=${board.swatches.length}[pal]`,
);
filterParts.push(`[ref][pal]vstack=inputs=2[out]`);

const boardRender = spawnSync(
  ff,
  ["-y", "-hide_banner", "-loglevel", "error", ...inputs, "-filter_complex", filterParts.join(";"), "-map", "[out]", "-frames:v", "1", outPath],
);

line("deska štýlu (PNG)", boardRender.status === 0 && existsSync(outPath) ? `${outPath} (${readFileSync(outPath).byteLength} B)` : "NEPODARILO SA");
mkdirSync("/home/user", { recursive: true });
writeFileSync(
  outPath.replace(/\.png$/, ".json"),
  JSON.stringify(
    {
      source: inputPath,
      at: isVideo ? atSec : null,
      analysedFrame: `${width}x${height}`,
      measured: {
        palette: outcome.palette.map((c: { hex: string; coverage: number }) => ({ hex: c.hex, coverage: Number(c.coverage.toFixed(4)) })),
        accent: outcome.accent?.hex ?? null,
        brightness: outcome.brightness,
        contrast: outcome.contrast,
        saturation: outcome.saturation,
        warmth: outcome.warmth,
        darkRatio: outcome.darkRatio,
        lightRatio: outcome.lightRatio,
        edgeDensity: outcome.edgeDensity,
        bands: outcome.bands,
      },
      moodSk: outcome.moodSk,
      notDetectableSk: outcome.notDetectableSk,
      methodSk: outcome.analysisMethodSk,
      note:
        "Merané z reálnych pixelov (ffmpeg rawvideo → tá istá funkcia ako v prehliadači). " +
        "Snímka z videa nie je dizajnérska predloha. Deska je dáta + reálne materiály, nie generovaný obrázok.",
    },
    null,
    2,
  ),
);
line("dáta desky (JSON)", outPath.replace(/\.png$/, ".json"));

console.log("=".repeat(78));
console.log("Čo tento výsledok NEznamená:");
console.log("  • nie je to dôkaz o prehliadači (runner obchádza UI a volá funkciu priamo)");
console.log("  • snímka z videa nie je dizajnérska predloha — je to reálny obraz z reálneho videa");
console.log("  • typografia, tempo a textúra sa z obrázka nemerajú (appka ich nepredstiera)");
console.log("  • žiadne obrázky sa negenerujú — appka na to nemá providera (PROVIDER UNAVAILABLE)");
console.log("=".repeat(78));

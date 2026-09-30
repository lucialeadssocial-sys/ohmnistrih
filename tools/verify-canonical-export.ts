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
// Skúška animovaného priblíženia: keyframy sa do canonical osi zapíšu **cez
// existujúci CommandManager** (žiadna tichá mutácia modelu).
const animatedZoomArg = args.includes("--animated-zoom");
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

/** Rozmery rámu videa zo súboru (žiadne predpoklady). */
function probeSize(exe: string, file: string): { width: number; height: number } | null {
  const probe = spawnSync(exe, ["-hide_banner", "-i", file], { encoding: "utf-8" });
  const text = `${probe.stdout ?? ""}${probe.stderr ?? ""}`;
  const m = text.match(/Video: [^\n]*?(\d{2,5})x(\d{2,5})/);
  if (!m) return null;
  return { width: Number(m[1]), height: Number(m[2]) };
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

/**
 * Vyberie iné reálne video používateľa na snímku pre obrazovú vrstvu.
 *
 * Nevyberá konkrétny súbor podľa mena — appka staršie nahrávky prerezáva
 * (limit v `BURN_LIMITS`), takže mená sa menia. Preto sa z dostupných reálnych
 * videí zmeria jas a vyberie sa **najsvetlejšie** (aby bola vrstva v tmavom
 * zdrojovom videe vôbec merateľná). Keď nič nie je, vráti `null` — nič sa nevyrába.
 */
function pickOverlaySource(ff: string, mainPath: string): string | null {
  // 1) Uložená reálna snímka (aby verifikácia prežila prerezávanie nahrávok v appke).
  const savedFrame = "/home/user/real-media/overlay-frame.png";
  if (existsSync(savedFrame)) return savedFrame;

  // 2) Najsvetlejšie reálne médium, ktoré máme: používateľove nahrávky alebo reálne
  //    exporty z nich. Nič sa nevyrába — je to skutočný obraz z jeho videa.
  const dirs = [join(REPO, ".data", "uploads"), join(REPO, ".data", "exports")];
  const candidates: string[] = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const name of require("node:fs").readdirSync(dir) as string[]) {
      if (!/\.(mp4|png)$/i.test(name)) continue;
      // Vylúč vlastné uploady a výstupy runnera — inak by vrstva bola to isté video.
      if (/real_speech|broll-snimka|klip\.mp4/i.test(name)) continue;
      if (basename(name) === basename(mainPath)) continue;
      candidates.push(join(dir, name));
    }
  }
  if (candidates.length === 0) return null;

  let best: { path: string; yavg: number } | null = null;
  for (const candidate of candidates.slice(0, 12)) {
    const probe = spawnSync(ff, [
      "-hide_banner", "-loglevel", "info", "-ss", "1", "-i", candidate, "-frames:v", "1",
      "-vf", "signalstats,metadata=print", "-f", "null", "-",
    ], { encoding: "utf-8" });
    const m = `${probe.stdout ?? ""}${probe.stderr ?? ""}`.match(/lavfi\.signalstats\.YAVG=([\d.]+)/);
    const yavg = m ? Number(m[1]) : 0;
    if (!best || yavg > best.yavg) best = { path: candidate, yavg };
  }
  return best?.path ?? null;
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

/**
 * Zmena obrazu v DOLNEJ časti rámu — tam sú vypálené titulky.
 * (Prvé meranie pozeralo hore a hlásilo nulu, hoci titulky vo videu boli — chyba merania, nie renderu.)
 */
function frameDiffBottom(ff: string, a: string, b: string, timeSec: number, workDir: string): number | null {
  const fa = join(workDir, `cb_a_${timeSec}.png`);
  const fb = join(workDir, `cb_b_${timeSec}.png`);
  for (const [file, out] of [[a, fa], [b, fb]] as const) {
    const ex = spawnSync(ff, ["-y", "-hide_banner", "-loglevel", "error", "-ss", String(timeSec), "-i", file, "-frames:v", "1", out]);
    if (ex.status !== 0 || !existsSync(out)) return null;
  }
  const ex2 = spawnSync(
    ff,
    ["-hide_banner", "-loglevel", "info", "-i", fa, "-i", fb, "-lavfi",
     "[0:v][1:v]blend=all_mode=difference,crop=iw:ih*0.45:0:ih*0.55,format=gray,signalstats,metadata=print:file=-",
     "-frames:v", "1", "-f", "null", "-"],
    { encoding: "utf-8" },
  );
  const m = `${ex2.stdout ?? ""}\n${ex2.stderr ?? ""}`.match(/lavfi\.signalstats\.YAVG=([\d.]+)/);
  return m ? Number(m[1]) : null;
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
      "-lavfi",
      "[0:v][1:v]blend=all_mode=difference,crop=iw:ih*0.40:0:0,format=gray,signalstats,metadata=print:file=-",
      "-frames:v", "1", "-f", "null", "-",
    ],
    { encoding: "utf-8" },
  );
  const out = `${ex2.stdout ?? ""}\n${ex2.stderr ?? ""}`;
  const match = out.match(/lavfi\.signalstats\.YAVG=([\d.]+)/);
  if (match) return Number(match[1]);
  return null;
}

/**
 * SSIM dvoch snímok (0 = nič spoločné, 1 = rovnaké) — merané na hornej časti obrazu,
 * aby do merania nezasahovali vypálené titulky (tie sú dole).
 */
function frameSsim(ff: string, a: string, b: string, workDir: string, tag: string): number | null {
  const out = join(workDir, `ssim_${tag}.txt`);
  const ex = spawnSync(
    ff,
    [
      "-hide_banner", "-loglevel", "info",
      "-i", a, "-i", b,
      "-lavfi",
      "[0:v]crop=iw:ih*0.40:0:0,scale=540:-2,format=gray[x];[1:v]crop=iw:ih*0.40:0:0,scale=540:-2,format=gray[y];[x][y]ssim=stats_file=" + out.replace(/:/g, "\\:"),
      "-f", "null", "-",
    ],
    { encoding: "utf-8" },
  );
  const text = `${ex.stdout ?? ""}\n${ex.stderr ?? ""}`;
  const m = text.match(/All:([\d.]+)/);
  return m ? Number(m[1]) : null;
}

/** Priama zmena dvoch obrázkov v hornej časti (tam idú obrazové vrstvy). */
function diffTwoImagesTop(ff: string, a: string, b: string): number | null {
  const ex = spawnSync(
    ff,
    ["-hide_banner", "-loglevel", "info", "-i", a, "-i", b, "-lavfi",
     "[0:v][1:v]blend=all_mode=difference,crop=iw:ih*0.40:0:0,format=gray,signalstats,metadata=print:file=-",
     "-frames:v", "1", "-f", "null", "-"],
    { encoding: "utf-8" },
  );
  const m = `${ex.stdout ?? ""}\n${ex.stderr ?? ""}`.match(/lavfi\.signalstats\.YAVG=([\d.]+)/);
  return m ? Number(m[1]) : null;
}

/** Priama zmena dvoch obrázkov v dolnej časti (tam sú titulky). */
function diffTwoImagesBottom(ff: string, a: string, b: string, workDir: string, tag: string): number | null {
  const ex = spawnSync(
    ff,
    ["-hide_banner", "-loglevel", "info", "-i", a, "-i", b, "-lavfi",
     "[0:v][1:v]blend=all_mode=difference,crop=iw:ih*0.45:0:ih*0.55,format=gray,signalstats,metadata=print:file=-",
     "-frames:v", "1", "-f", "null", "-"],
    { encoding: "utf-8" },
  );
  const m = `${ex.stdout ?? ""}\n${ex.stderr ?? ""}`.match(/lavfi\.signalstats\.YAVG=([\d.]+)/);
  return m ? Number(m[1]) : null;
}

/** Priama zmena dvoch obrázkov (celý rám) — dôkaz, že sa niečo zmenilo. */
function diffTwoImages(ff: string, a: string, b: string): number | null {
  const ex = spawnSync(
    ff,
    ["-hide_banner", "-loglevel", "info", "-i", a, "-i", b, "-lavfi",
     "[0:v][1:v]blend=all_mode=difference,format=gray,signalstats,metadata=print:file=-",
     "-frames:v", "1", "-f", "null", "-"],
    { encoding: "utf-8" },
  );
  const m = `${ex.stdout ?? ""}\n${ex.stderr ?? ""}`.match(/lavfi\.signalstats\.YAVG=([\d.]+)/);
  return m ? Number(m[1]) : null;
}

/** Priemerná zmena jasu (YAVG) medzi dvoma snímkami — v hornej časti obrazu (bez titulkov). */
function frameDiffTop(ff: string, a: string, b: string, timeSec: number, workDir: string): number | null {
  const fa = join(workDir, `d_a_${timeSec}.png`);
  const fb = join(workDir, `d_b_${timeSec}.png`);
  for (const [file, out] of [[a, fa], [b, fb]] as const) {
    const ex = spawnSync(ff, ["-y", "-hide_banner", "-loglevel", "error", "-ss", String(timeSec), "-i", file, "-frames:v", "1", out]);
    if (ex.status !== 0 || !existsSync(out)) return null;
  }
  const ex2 = spawnSync(
    ff,
    ["-hide_banner", "-loglevel", "info", "-i", fa, "-i", fb, "-lavfi",
     "[0:v][1:v]blend=all_mode=difference,crop=iw:ih*0.40:0:0,format=gray,signalstats,metadata=print:file=-",
     "-frames:v", "1", "-f", "null", "-"],
    { encoding: "utf-8" },
  );
  const m = `${ex2.stdout ?? ""}\n${ex2.stderr ?? ""}`.match(/lavfi\.signalstats\.YAVG=([\d.]+)/);
  return m ? Number(m[1]) : null;
}

/** Jedna snímka z videa do PNG. */
function extractFrame(ff: string, file: string, timeSec: number, out: string): boolean {
  const ex = spawnSync(ff, ["-y", "-hide_banner", "-loglevel", "error", "-ss", String(timeSec), "-i", file, "-frames:v", "1", out]);
  return ex.status === 0 && existsSync(out);
}

/** Snímka, ktorú canonical plán očakáva pri priblížení (statický stredový orez). */
function expectedZoomedFrame(ff: string, file: string, timeSec: number, scalePercent: number, out: string): boolean {
  const scale = scalePercent / 100;
  const ex = spawnSync(ff, [
    "-y", "-hide_banner", "-loglevel", "error", "-ss", String(timeSec), "-i", file, "-frames:v", "1",
    "-vf", `scale=iw*${scale.toFixed(4)}:ih*${scale.toFixed(4)},crop=trunc(iw/${scale.toFixed(4)}/2)*2:trunc(ih/${scale.toFixed(4)}/2)*2`,
    out,
  ]);
  return ex.status === 0 && existsSync(out);
}

/**
 * Deterministická skúška **samotnej renderovacej linky** na syntetickom podklade.
 *
 * Prečo: reálne médium používateľa je jednofarebná plocha, takže sa na ňom
 * priblíženie nedá zmerať (nemá čo zmeniť). Táto skúška preto vygeneruje
 * **syntetický podklad** (farebné terče + mriežka) — a na ňom sa zoom, vrstva
 * aj titulky merajú presne. Je to test LINKY, nie tvrdenie o videu používateľa
 * (a runner to tak aj vypíše).
 */
async function zoomProbeOnSynthetic(ff: string, workDir: string) {
  console.log("");
  console.log("── SKÚŠKA LINKY NA SYNTETICKOM PODKLADE (nie je to video používateľa) ──");
  const { buildBurnFfmpegArgs } = await import(join(REPO, "src/core/export/subtitleRender.ts"));

  const synth = join(workDir, "synthetic.mp4");
  const gen = spawnSync(ff, [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "testsrc2=size=1080x1920:rate=30:duration=8",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=8",
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k",
    "-t", "8", synth,
  ]);
  if (gen.status !== 0 || !existsSync(synth)) {
    line("syntetický podklad", "NEPODARILO SA vygenerovať (skúška sa preskakuje)");
    return null;
  }

  const assPath = join(workDir, "probe.ass");
  writeFileSync(assPath, "[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\n\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,OutlineColour,BackColour,Bold,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Default,DejaVu Sans,72,&H00FFFFFF,&H00000000,&H00000000,-1,100,100,0,0,1,4,0,2,40,40,120,1\n\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\nDialogue: 0,0:00:00.50,0:00:07.50,Default,,0,0,0,,SKUSKA LINKY\n", "utf8");

  const overlayPng = join(workDir, "probe-overlay.png");
  spawnSync(ff, ["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=red:s=240x240:d=1", "-frames:v", "1", overlayPng]);
  const overlayOk = existsSync(overlayPng);

  const outPath = join(workDir, "synthetic-zoom.mp4");
  const args = buildBurnFfmpegArgs({
    inputPath: synth,
    outputPath: outPath,
    assPath,
    frameSize: { width: 1080, height: 1920 },
    sourceFps: 30,
    outputDurationSec: 8,
    // Dve okná naraz, aby sa dali oddeliť:
    //   2–4 s  … statické priblíženie 130 % (kontrola, že orez funguje),
    //   5–7 s  … animované priblíženie 100 % → 150 % (kontrola, že sa mení v čase).
    zoomWindows: [
      { startSec: 2, endSec: 4, scalePercent: 130 },
      {
        startSec: 5,
        endSec: 7,
        scalePercent: 150,
        keyframes: [
          { timeSec: 0, scalePercent: 100 },
          { timeSec: 2, scalePercent: 150 },
        ],
      },
    ],
    ...(overlayOk
      ? { overlays: [{ path: overlayPng, kind: "image" as const, startSec: 4.2, endSec: 4.8, scalePercent: 100, positionX: 0, positionY: -300 }] }
      : {}),
  });
  const render = spawnSync(ff, args, { encoding: "utf-8" });
  if (render.status !== 0 || !existsSync(outPath)) {
    line("render na syntetickom podklade", `ZLYHAL: ${(render.stderr ?? "").split("\n").filter((l) => l.trim()).slice(-2).join(" | ")}`);
    return null;
  }

  const size = probeSize(ff, outPath);
  const sizeOk = Boolean(size && size.width === 1080 && size.height === 1920);
  line("rám výstupu", size ? `${size.width}×${size.height}${sizeOk ? " (zachovaný)" : " — ZMENENÝ!"}` : "?");

  const plainAt = join(workDir, "syn-plain.png");
  const zoomAt = join(workDir, "syn-zoom.png");
  const outPlain = join(workDir, "syn-out-plain.png");
  const outZoom = join(workDir, "syn-out-zoom.png");
  const okFrames =
    extractFrame(ff, synth, 1, plainAt) &&
    extractFrame(ff, outPath, 1, outPlain) &&
    extractFrame(ff, synth, 3, zoomAt) &&
    extractFrame(ff, outPath, 3, outZoom);

  let zoomOk = false;
  let overlayOkMeasured = false;
  if (okFrames) {
    const diffPlain = diffTwoImages(ff, plainAt, outPlain);
    const diffZoom = diffTwoImages(ff, zoomAt, outZoom);
    line("rozdiel mimo zoomu (2 s okno) v 1 s", diffPlain === null ? "nedá sa zmerať" : diffPlain.toFixed(2));
    line("rozdiel v zoom okne v 3 s", diffZoom === null ? "nedá sa zmerať" : diffZoom.toFixed(2));
    zoomOk = diffPlain !== null && diffZoom !== null && diffPlain < 2 && diffZoom > 8;
  }
  // Animované priblíženie: rozdiel voči zdroju musí v čase RAST (nie byť len „iný").
  let animatedOk = false;
  let animNumbers: number[] = [];
  {
    const times = [5.15, 6.0, 6.85];
    const values: (number | null)[] = [];
    for (const t of times) {
      const srcF = join(workDir, `syn-an-src-${t}.png`);
      const outF = join(workDir, `syn-an-out-${t}.png`);
      if (!extractFrame(ff, synth, t, srcF) || !extractFrame(ff, outPath, t, outF)) {
        values.push(null);
        continue;
      }
      values.push(diffTwoImages(ff, srcF, outF));
    }
    animNumbers = values.filter((v): v is number => v !== null);
    if (values.every((v) => v !== null)) {
      line(
        `animované priblíženie v 5,15 / 6,00 / 6,85 s`,
        values.map((v) => (v as number).toFixed(2)).join(" → ") + " (má rásť)",
      );
      const [a, b, c] = values as number[];
      animatedOk = c > b + 0.5 && b > a + 0.5 && a < 60;
    } else {
      line("animované priblíženie", "nedá sa zmerať (chýba snímka)");
    }
  }

  if (overlayOk) {
    const srcBefore = join(workDir, "syn-ov-src-before.png");
    const outBefore = join(workDir, "syn-ov-out-before.png");
    const srcInside = join(workDir, "syn-ov-src-inside.png");
    const outInside = join(workDir, "syn-ov-out-inside.png");
    const ok2 =
      extractFrame(ff, synth, 4.0, srcBefore) &&
      extractFrame(ff, outPath, 4.0, outBefore) &&
      extractFrame(ff, synth, 4.55, srcInside) &&
      extractFrame(ff, outPath, 4.55, outInside);
    if (ok2) {
      const outside = diffTwoImagesTop(ff, srcBefore, outBefore);
      const inside = diffTwoImagesTop(ff, srcInside, outInside);
      line("vrstva: rozdiel HORE mimo okna (4,0 s)", outside === null ? "nedá sa zmerať" : outside.toFixed(2));
      line("vrstva: rozdiel HORE v okne (4,55 s)", inside === null ? "nedá sa zmerať" : inside.toFixed(2));
      overlayOkMeasured = inside !== null && outside !== null && inside > 1 && inside > outside * 3;
    }
  }

  const captionCheck = (() => {
    const srcFrame = join(workDir, "syn-cap-src.png");
    const outFrame = join(workDir, "syn-cap-out.png");
    if (!extractFrame(ff, synth, 3.0, srcFrame)) return null;
    const ex = spawnSync(ff, ["-y", "-hide_banner", "-loglevel", "error", "-ss", "3.0", "-i", outPath, "-frames:v", "1", outFrame]);
    if (ex.status !== 0) return null;
    return diffTwoImagesBottom(ff, srcFrame, outFrame, workDir, "syn-cap");
  })();
  line("titulky v obraze (dole) na syntetickom podklade", captionCheck === null ? "nedá sa zmerať" : captionCheck.toFixed(2));

  const pass = sizeOk && zoomOk && animatedOk && (!overlayOk || overlayOkMeasured) && captionCheck !== null && captionCheck > 2;
  line(
    "VÝSLEDOK SKÚŠKY LINKY",
    pass
      ? "PASS (statické aj animované priblíženie, vrstva aj titulky naozaj idú do obrazu)"
      : "NEPREŠLA — pozri čísla vyššie",
  );
  return { pass, sizeOk, zoomOk, animatedOk, overlayOkMeasured, captionCheck };
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

  if (animatedZoomArg) {
    const { SetAudioKeyframeCommand } = await import(join(REPO, "src/core/command/commandSystem.ts"));
    const projectNow = coreEngine.getProject();
    const videoClip = projectNow.tracks
      .filter((t: any) => t.type === "video" && t.visible !== false)
      .flatMap((t: any) => t.clips)
      .find((c: any) => c.type === "video");
    if (!videoClip) {
      console.error("Animované priblíženie: v canonical osi nie je video klip (skúška sa preskakuje).");
    } else {
      // Priebeh 100 % → 145 % počas klipu; druhý krok na 70 % dĺžky klipu.
      const a = {
        id: "kf_anim_zoom_a",
        timeOffset: 0,
        parameter: "scale" as const,
        value: 100,
        easing: "easeInOut" as const,
      };
      const b = {
        id: "kf_anim_zoom_b",
        timeOffset: Math.max(0.4, Math.round(videoClip.duration * 0.7 * 100) / 100),
        parameter: "scale" as const,
        value: 145,
        easing: "easeInOut" as const,
      };
      const okA = coreEngine.commandManager.executeCommand(
        new SetAudioKeyframeCommand("Skúška: animované priblíženie (krok 1/2)", videoClip.id, a),
      );
      const okB = coreEngine.commandManager.executeCommand(
        new SetAudioKeyframeCommand("Skúška: animované priblíženie (krok 2/2)", videoClip.id, b),
      );
      line(
        "animované priblíženie v canonical osi (cez CommandManager)",
        okA && okB
          ? `áno — klip „${videoClip.name}“: 100 % → 145 % za ${b.timeOffset.toFixed(2)} s`
          : "NEPODARILO SA zapísať keyframy (command ich odmietol)",
      );
    }
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

  // Obrazová vrstva: reálna snímka z INÉHO reálneho videa používateľa (aby bola
  // v tmavom zdrojovom videe merateľná). Nič sa nevyrába — je to skutočný snímok.
  const srcSizeForPreview = (() => {
    const p = spawnSync(ff, ["-hide_banner", "-i", mediaPath], { encoding: "utf-8" });
    const m = `${p.stdout ?? ""}${p.stderr ?? ""}`.match(/Video: [^\n]*?(\d{2,5})x(\d{2,5})/);
    return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
  })();
  const probeFpsForPreview = (() => {
    const p = spawnSync(ff, ["-hide_banner", "-i", mediaPath], { encoding: "utf-8" });
    const m = `${p.stdout ?? ""}${p.stderr ?? ""}`.match(/([\d.]+) fps/);
    return m ? Number(m[1]) : null;
  })();

  const overlaySource = pickOverlaySource(ff, mediaPath);
  const overlayFramePath = join(workDir, "overlay-frame.png");
  const assetUploads: Record<string, string> = {};
  let overlayIsFrame = false;
  if (overlaySource) {
    if (/\.png$/i.test(overlaySource)) {
      try {
        require("node:fs").copyFileSync(overlaySource, overlayFramePath);
        overlayIsFrame = true;
      } catch {
        /* skúsime video nižšie */
      }
    } else {
      // Zdrojom je reálne video (často už vyrenderovaný export) — spodok odstrihneme,
      // aby do vrstvy nezišli CUDZIE vypálené titulky. Zostáva skutočný obraz z videa.
      const ex = spawnSync(ff, [
        "-y", "-hide_banner", "-loglevel", "error", "-ss", "1", "-i", overlaySource,
        "-frames:v", "1", "-vf", "crop=iw:ih*0.55:0:0", overlayFramePath,
      ]);
      overlayIsFrame = ex.status === 0 && existsSync(overlayFramePath);
    }
  }
  if (overlayIsFrame && existsSync(overlayFramePath)) {
    const bytes = readFileSync(overlayFramePath);
    const res = await fetch(`${API}/api/export/upload?name=${encodeURIComponent("broll-snimka.png")}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: bytes,
    });
    const up = (await res.json()) as { success?: boolean; uploadId?: string; errorSk?: string };
    if (up.success && up.uploadId) {
      assetUploads["asset_real_shot"] = up.uploadId;
      const savedFrame = "/home/user/real-media/overlay-frame.png";
      try {
        if (!existsSync(savedFrame)) {
          require("node:fs").mkdirSync("/home/user/real-media", { recursive: true });
          require("node:fs").copyFileSync(overlayFramePath, savedFrame);
          require("node:fs").writeFileSync(
            "/home/user/real-media/overlay-frame.info.json",
            JSON.stringify(
              {
                origin: `Reálna snímka z reálneho média používateľa (${basename(overlaySource!)})`,
                note: "Uložená, aby verifikácia prežila prerezávanie nahrávok v appke. Nie je syntetická.",
                bytes: readFileSync(overlayFramePath).byteLength,
              },
              null,
              2,
            ),
          );
        }
      } catch {
        /* uloženie nie je kritické */
      }
      line("obrazová vrstva (reálna snímka)", `${basename(overlaySource!)} @1s → ${up.uploadId}`);
    } else {
      line("obrazová vrstva", `NEPRIPRAVENÁ (${up.errorSk ?? res.status})`);
    }
  } else {
    line("obrazová vrstva", "NEDOSTUPNÁ (žiadne iné reálne video na snímku)");
  }

  const exportPlan = buildCanonicalExportPlan(
    canonicalProject,
    {
      uploadId: upload.uploadId,
      uploadName: upload.uploadName ?? basename(mediaPath),
      width: 1080,
      height: 1920,
    },
    { assetUploads },
  );

  console.log("");
  console.log("── ZADANIE Z CANONICAL OSI ──────────────────────────────────────────────");
  for (const note of exportPlan.notesSk) console.log(`  • ${note}`);
  if (exportPlan.unsupportedSk.length > 0) {
    console.log("  POZOR (táto linka nevykresľuje):");
    for (const note of exportPlan.unsupportedSk) console.log(`    – ${note}`);
  }
  const animatedZooms = (exportPlan.request.zoom ?? []).filter((z: { animated?: boolean }) => z.animated) as {
    startSec: number;
    endSec: number;
    scale: number;
    keyframes?: { timeSec: number; scale: number }[];
  }[];
  if (animatedZooms.length > 0) {
    const z = animatedZooms[0];
    line(
      "animované priblíženie ide do linky",
      `${animatedZooms.length}× (${z.keyframes?.map((k: { timeSec: number; scale: number }) => `${k.timeSec.toFixed(2)}s=${Math.round(k.scale)}%`).join(" → ")})`,
    );
  } else if (animatedZoomArg) {
    line("animované priblíženie ide do linky", "NIE — plán ho neobsahuje (pozri poznámky vyššie)");
  }
  // Dôkaz, nie sľub: vypíšeme SKUTOČNÝ filter, ktorý pre animované priblíženie
  // vyrobí tá istá funkcia, akú použije server.
  if (animatedZooms.length > 0) {
    const { buildBurnFfmpegArgs } = await import(join(REPO, "src/core/export/subtitleRender.ts"));
    const zoomProbeArgs = buildBurnFfmpegArgs({
      inputPath: "vstup.mp4",
      outputPath: "vystup.mp4",
      assPath: "/x/a.ass",
      sourceFps: 30,
      frameSize: { width: 1080, height: 1920 },
      outputDurationSec: 20,
      zoomWindows: [
        {
          startSec: animatedZooms[0].startSec,
          endSec: animatedZooms[0].endSec,
          scalePercent: animatedZooms[0].scale,
          keyframes: (animatedZooms[0].keyframes ?? []).map((k) => ({
            timeSec: k.timeSec,
            scalePercent: k.scale,
          })),
        },
      ],
    });
    const graph = zoomProbeArgs[zoomProbeArgs.indexOf("-filter_complex") + 1] ?? "";
    const zoomsInGraph = graph.includes("zoompan=");
    line("filter pre animované priblíženie", zoomsInGraph ? "obsahuje zoompan= (mení mierku v čase)" : "CHÝBA zoompan= — to by nebolo animované!");
    const expr = (graph.match(/z='([^']+)'/) ?? [])[1] ?? "";
    if (expr) line("  priebeh (výraz)", expr.length > 150 ? `${expr.slice(0, 150)}…` : expr);
  }
  line("zhoda canonical ↔ zadanie", exportPlan.parity.matched ? "áno (nič nechýba, nič navyše)" : "NIE");
  if (!exportPlan.canExport) {
    console.error(`Export sa nedá spustiť: ${exportPlan.blockersSk.join(" ")}`);
    process.exit(7);
  }

  // --- krok 3: render v appke ----------------------------------------------
  const { buildBurnFfmpegArgs } = await import(join(REPO, "src/core/export/subtitleRender.ts"));
  console.log("  Filter graf, ktorý server naozaj použije (z canonical osi):");
  try {
    const graphPreview = buildBurnFfmpegArgs({
      inputPath: "/vstup.mp4",
      outputPath: "/vystup.mp4",
      assPath: "/titulky.ass",
      keepSegments: exportPlan.request.keepRanges,
      ...(exportPlan.request.zoom ? { zoomWindows: exportPlan.request.zoom.map((z: any) => ({ clipId: z.clipId, startSec: z.startSec, endSec: z.endSec, scalePercent: z.scale })) } : {}),
      ...((exportPlan.request.overlays ?? []).length > 0
        ? { overlays: exportPlan.request.overlays!.map((o: any) => ({ path: "/vrstva", kind: o.kind, startSec: o.startSec, endSec: o.endSec, scalePercent: o.scalePercent, positionX: o.positionX, positionY: o.positionY })) }
        : {}),
      outputDurationSec: mediaDurationSec,
      frameSize: srcSizeForPreview ?? undefined,
      ...(probeFpsForPreview ? { sourceFps: probeFpsForPreview } : {}),
    });
    const g = graphPreview[graphPreview.indexOf("-filter_complex") + 1] ?? "";
    console.log(`    vidím v ňom: priblíženie=${/scale=iw\*1\.[0-9]+/.test(g) ? "áno" : "nie"} · vrstvy=${/overlay=/.test(g) ? "áno" : "nie"} · titulky=${/ass=/.test(g) ? "áno" : "nie"}`);
  } catch (err) {
    console.log(`    filter graf sa nedá zobraziť: ${(err as Error).message}`);
  }

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
  const srcSize = probeSize(ff, mediaPath);
  const outSize = probeSize(ff, outPath);
  const sizeKept = Boolean(srcSize && outSize && srcSize.width === outSize.width && srcSize.height === outSize.height);
  line("stopa video / audio", `${hasVideo ? "áno" : "NIE"} / ${hasAudio ? "áno" : "NIE"}`);
  line(
    "rozmer rámu zdroj → výstup",
    `${srcSize ? `${srcSize.width}×${srcSize.height}` : "?"} → ${outSize ? `${outSize.width}×${outSize.height}` : "?"}${
      sizeKept ? " (rovnaký)" : " — POZOR, rám sa zmenil!"
    }`,
  );
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
  const diff = frameDiffBottom(ff, mediaPath, outPath, midTime, workDir);
  line(`zmena obrazu (dole, kde sú titulky) v ${midTime.toFixed(1)} s`, diff === null ? "nedá sa zmerať" : diff.toFixed(2));
  const captionsBurned = diff !== null && diff > 1.0;
  line("vypálené titulky v obraze", captionsBurned ? "áno (obraz sa na tom mieste líši)" : "NIE / nepreukázané");

  // --- obrazové vrstvy: naozaj sa objavia v obraze? -------------------------
  const overlayWindows = exportPlan.request.overlays ?? [];
  let overlayInside: number | null = null;
  let overlayOutside: number | null = null;
  if (overlayWindows.length > 0) {
    const w = overlayWindows[0];
    const insideT = (w.startSec + w.endSec) / 2;
    const outsideT = Math.max(0.2, w.startSec - 0.5);
    overlayInside = frameDiffTop(ff, mediaPath, outPath, insideT, workDir);
    overlayOutside = frameDiffTop(ff, mediaPath, outPath, outsideT, workDir);
    line(`vrstva v okne ${w.startSec.toFixed(1)}–${w.endSec.toFixed(1)} s: zmena obrazu (hore)`, overlayInside === null ? "nedá sa zmerať" : overlayInside.toFixed(2));
    line(`mimo okna (${outsideT.toFixed(1)} s): zmena obrazu (hore)`, overlayOutside === null ? "nedá sa zmerať" : overlayOutside.toFixed(2));
  } else {
    line("obrazové vrstvy vo videu", "žiadne nešli (nemám ich ako súbor)");
  }
  // Zdrojové médium je jednofarebná plocha, takže rozdiely sú malé čísla — rozhoduje
  // POMER „v okne / mimo okna“, nie veľkosť. Tak sa preukáže, že vrstva je vo videu
  // práve vo svojom čase (a nikde inde).
  const overlayRendered =
    overlayWindows.length > 0 &&
    overlayInside !== null &&
    overlayInside > 0.5 &&
    (overlayOutside === null || overlayInside > overlayOutside * 3);

  // --- priblíženie: sedí s canonical plánom? --------------------------------
  const zoomWindowsList = exportPlan.request.zoom ?? [];
  const zoomSegments = (exportPlan.request.keepRanges ?? []).filter((r: { scalePercent?: number }) => Math.abs((r.scalePercent ?? 100) - 100) > 0.01);
  const zoomKnown = zoomWindowsList.length > 0 || zoomSegments.length > 0;
  let zoomActual: number | null = null;
  let zoomWithout: number | null = null;
  if (zoomKnown) {
    const scalePercent = zoomWindowsList[0]?.scale ?? zoomSegments[0]?.scalePercent ?? 100;
    const t = zoomWindowsList.length > 0 ? (zoomWindowsList[0].startSec + zoomWindowsList[0].endSec) / 2 : Math.max(0.2, zoomSegments[0].start + 0.5);
    const outFrame = join(workDir, "zoom_out.png");
    const expectedFrame = join(workDir, "zoom_expected.png");
    const plainFrame = join(workDir, "zoom_plain.png");
    if (extractFrame(ff, outPath, t, outFrame) && expectedZoomedFrame(ff, mediaPath, t, scalePercent, expectedFrame) && extractFrame(ff, mediaPath, t, plainFrame)) {
      zoomActual = frameSsim(ff, expectedFrame, outFrame, workDir, "expected");
      zoomWithout = frameSsim(ff, plainFrame, outFrame, workDir, "plain");
      line(`priblíženie ${scalePercent.toFixed(0)} % v ${t.toFixed(1)} s: zhoda s plánom (SSIM)`, zoomActual === null ? "nedá sa zmerať" : zoomActual.toFixed(4));
      line("  (kontrola: zhoda bez priblíženia)", zoomWithout === null ? "nedá sa zmerať" : zoomWithout.toFixed(4));
    }
  } else {
    line("priblíženie vo videu", "žiadne nešlo (plán ho nemá)");
  }
  // Na jednofarebnom zdroji sa priblíženie zmerať nedá (nemá čo zmeniť) — vtedy
  // to priznáme a použijeme deterministickú skúšku linky na syntetickom podklade.
  // Prah 2 %: menší rozdiel je len šum kompresie — na jednofarebnom zdroji je
  // SSIM 0,9989 vs 1,0000 (prakticky identické), hoci zoom vo videu je. Taký
  // výsledok NEMÁ cenu a runner to musí priznať, nie tváriť sa, že preukázal zoom.
  const zoomMeasurable = zoomActual !== null && zoomWithout !== null && zoomActual - zoomWithout > 0.02;
  const zoomRendered = zoomKnown ? (zoomMeasurable ? zoomActual! > 0.85 && zoomActual! > zoomWithout! : true) : true;
  if (zoomKnown && !zoomMeasurable) {
    line("priblíženie — merateľnosť na tomto médiu", "nedá sa zmerať (zdroj je jednofarebná plocha) — skúšam syntetický podklad nižšie");
  }

  const synthetic = zoomKnown && !zoomMeasurable ? await zoomProbeOnSynthetic(ff, workDir) : null;

  const pass =
    hasVideo &&
    sizeKept &&
    hasAudio &&
    exportPlan.parity.matched &&
    captionsBurned &&
    (overlayWindows.length === 0 || overlayRendered) &&
    (!zoomKnown || zoomRendered) &&
    (synthetic === null || synthetic.pass) &&
    (outDuration === null || Math.abs(outDuration - mediaDurationSec) < 1.5);

  console.log("");
  if (exportPlan.unsupportedSk.length > 0) {
    console.log("Čo vo videu NIE je (a je to povedané vopred):");
    for (const note of exportPlan.unsupportedSk) console.log(`  – ${note}`);
  }
  console.log("=".repeat(78));
  console.log(
    pass
      ? "VÝSLEDOK: REAL EXPORT Z CANONICAL OSI PASS (súbor vznikol, má obraz aj zvuk, titulky z canonical osi sú v obraze)"
      : "VÝSLEDOK: POZOR — nie všetko vyšlo; detaily vyššie (nič nezakrývam)",
  );
  console.log("Čo tento výsledok NEznamená:");
  console.log("  • nie je to dôkaz o prehliadači (runner obchádza UI a volá API appky)");
  console.log("  • farebné filtre, rotácia a priesvitnosť vrstiev sa stále nevykresľujú — viď zoznam vyššie");
  console.log("  • zvuk sa porovnáva obsahovo (PCM 16 kHz mono), nie bajtovo vo formáte AAC");
  console.log("=".repeat(78));

  rmSync(workDir, { recursive: true, force: true });
  process.exit(pass ? 0 : 20);
}

main().catch((err) => {
  console.error("Runner spadol:", err);
  process.exit(1);
});

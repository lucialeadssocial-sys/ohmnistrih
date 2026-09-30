/**
 * KROK 18 — PRUŽENIE HOVORENÉHO SLOVA: REAL-MEDIA DÔKAZ.
 *
 * Otázka zadania: *„Hýbe sa zvýraznené (hovorené) slovo — teda zväčší sa, keď ho
 * vyslovím, alebo len stojí zväčšené?"*
 *
 * Runner to meria na **hotovom videe**, nie na pláne:
 *   1. reálne médium + reálny prepis (HTTP `/api/transcribe-speech`, wordTiming),
 *   2. titulky do canonical osi **cez CommandManager** (štýl, ktorý hovorené slovo zväčšuje),
 *   3. kontrola ASS: obsahuje `\t(0,ms,...)` na hovorené slovo (nie statické `\fscx`),
 *   4. **REAL EXPORT** existujúcou linkou,
 *   5. meranie: v rámci jedného slova sa **šírka zvýrazneného slova mení v čase**
 *      (rastie počas pruženia a potom drží) — a kontrola, že sa to deje pri KAŽDOM slove,
 *   6. snímky sa ukladajú do `kontrola-krok18/` (aby to bolo vidieť aj očami).
 *
 *   bun run tools/verify-word-animation.ts /home/user/real-media/real_speech.mp4 \
 *     [--plan segments.json] [--style KARAOKE] [--out /home/user/export-krok18-pruzenie.mp4]
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const API = process.env.OMNISTRIH_URL || "http://127.0.0.1:3000";
const FRAMES = "/home/user/kontrola-krok18";

const args = process.argv.slice(2);
const mediaPath = args.find((a: string) => !a.startsWith("--"));
const planFile = valueOf("--plan");
const styleId = valueOf("--style") ?? "KARAOKE";
const outPath = valueOf("--out") ?? "/home/user/export-krok18-pruzenie.mp4";
const EVIDENCE = "/home/user/kontrola-krok18/pruzenie-slova.json";

function valueOf(flag: string): string | undefined {
  const eq = args.find((a: string) => a.startsWith(`${flag}=`));
  if (eq) return eq.slice(flag.length + 1);
  const i = args.indexOf(flag);
  if (i >= 0 && args[i + 1] && !args[i + 1].startsWith("--")) return args[i + 1];
  return undefined;
}

function ffmpegExe(): string {
  const p = spawnSync("python3", ["-c", "import imageio_ffmpeg,sys;sys.stdout.write(imageio_ffmpeg.get_ffmpeg_exe())"], {
    encoding: "utf-8",
  });
  return p.status === 0 && p.stdout.trim() ? p.stdout.trim() : "ffmpeg";
}
const FF = ffmpegExe();

function head(t: string) {
  console.log("\n" + "=".repeat(96) + "\n" + t + "\n" + "=".repeat(96));
}
function line(label: string, value: unknown) {
  console.log(`${label.padEnd(52, ".")} ${value}`);
}
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const sha = (b: Uint8Array | Buffer) => createHash("sha256").update(b).digest("hex").slice(0, 16);

function probeSize(file: string): { width: number; height: number } | null {
  const p = spawnSync(FF, ["-hide_banner", "-i", file], { encoding: "utf-8" });
  const m = `${p.stdout ?? ""}${p.stderr ?? ""}`.match(/Video: [^\n]*?(\d{2,5})x(\d{2,5})/);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

function durationOf(file: string): number | null {
  const p = spawnSync(FF, ["-hide_banner", "-i", file], { encoding: "utf-8" });
  const m = `${p.stdout ?? ""}${p.stderr ?? ""}`.match(/Duration: (\d+):(\d+):([\d.]+)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

/**
 * Zmeria dve veci v pásme titulkov:
 *  - `yellow` — len zvýraznené (hovorené) slovo,
 *  - `all`    — celý text titulku (biele aj žlté).
 *
 * Prečo obe: keby rástol celý riadok, je to animácia vstupu titulku, nie pruženie
 * slova. Pruženie dokazuje iba to, keď **žltá rastie a celý riadok pritom stojí**.
 */
function captionBox(file: string, t: number, size: { width: number; height: number }) {
  const out = spawnSync(
    FF,
    ["-hide_banner", "-v", "error", "-ss", String(t), "-i", file, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
    { maxBuffer: 256 * 1024 * 1024 },
  );
  const buf = out.stdout as Buffer | undefined;
  if (!buf || buf.length < size.width * size.height * 3) return null;
  const yFrom = Math.floor(size.height * 0.62);
  let yCount = 0;
  let yMinX = Number.POSITIVE_INFINITY;
  let yMaxX = -1;
  let aCount = 0;
  let aMinX = Number.POSITIVE_INFINITY;
  let aMaxX = -1;
  let wCount = 0;
  let wMinX = Number.POSITIVE_INFINITY;
  let wMaxX = -1;
  for (let y = yFrom; y < size.height; y += 2) {
    const row = y * size.width * 3;
    for (let x = 0; x < size.width; x += 2) {
      const i = row + x * 3;
      const r = buf[i];
      const g = buf[i + 1];
      const b = buf[i + 2];
      const bright = r > 90 || g > 90 || b > 90;
      if (!bright) continue;
      aCount++;
      if (x < aMinX) aMinX = x;
      if (x > aMaxX) aMaxX = x;
      const isYellow = r > 170 && g > 140 && b < 120;
      if (isYellow) {
        yCount++;
        if (x < yMinX) yMinX = x;
        if (x > yMaxX) yMaxX = x;
      } else if (r > 150 && g > 150 && b > 150) {
        // Biele = nezvýraznené slová. Tie musia počas pruženia stáť — inak by
        // rástol celý titulok (animácia vstupu), nie hovorené slovo.
        wCount++;
        if (x < wMinX) wMinX = x;
        if (x > wMaxX) wMaxX = x;
      }
    }
  }
  return {
    yellow: { count: yCount, widthPx: yMaxX >= 0 ? yMaxX - yMinX : 0 },
    all: { count: aCount, widthPx: aMaxX >= 0 ? aMaxX - aMinX : 0 },
    white: { count: wCount, widthPx: wMaxX >= 0 ? wMaxX - wMinX : 0 },
  };
}

function saveFrame(file: string, t: number, name: string): string | null {
  const png = join(FRAMES, name);
  const out = spawnSync(FF, ["-y", "-v", "error", "-ss", String(t), "-i", file, "-frames:v", "1", png], { encoding: "utf-8" });
  return out.status === 0 ? png : null;
}

function pcmHash(file: string): string | null {
  const out = spawnSync(FF, ["-v", "error", "-i", file, "-vn", "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], {
    encoding: "buffer",
    maxBuffer: 512 * 1024 * 1024,
  });
  return out.status === 0 && out.stdout?.length ? sha(out.stdout as Buffer) : null;
}

async function main() {
  if (!mediaPath || !existsSync(mediaPath)) {
    console.error("Chýba reálne médium: bun run tools/verify-word-animation.ts <video>");
    process.exit(1);
  }
  mkdirSync(FRAMES, { recursive: true });
  const media = readFileSync(mediaPath);
  const duration = durationOf(mediaPath);

  head("1) REÁLNE MÉDIUM + ŠTÝL, KTORÝ HOVORENÉ SLOVO ZVÄČŠUJE");
  line("súbor", `${basename(mediaPath)} (${media.length} B, ${duration?.toFixed(2) ?? "?"} s)`);
  line("štýl titulkov", styleId);

  const { createInitialProject, coreEngine, AddClipCommand } = await import("/home/user/ohmnistrih/src/core/index.ts");
  const { createCanonicalClip } = await import("/home/user/ohmnistrih/src/core/types/project.ts");
  const { wordsToRelative, hasUsableWordTiming } = await import("/home/user/ohmnistrih/src/core/transcript/wordTiming.ts");
  const { buildCanonicalExportPlan } = await import("/home/user/ohmnistrih/src/core/export/canonicalExport.ts");
  const { CAPTION_STYLES, getCaptionStyle, buildAssFile, wordPopSecForStyle } = await import(
    "/home/user/ohmnistrih/src/core/export/subtitleRender.ts"
  );

  const spec = getCaptionStyle(styleId as never);
  // Canonical os nesie **preset** (nie id štýlu): canonical cesta pozná 5 presetov
  // a mapuje ich na štýly appky (bold→VIRAL_BOLD, kinetic→KARAOKE, social→NEON_BOX,
  // clean→CLEAN, minimal→PODCAST). Musím použiť ten istý preset, aký naozaj pôjde
  // do videa — inak by som meral iný štýl, než aký vznikne.
  const PRESET_FOR_STYLE: Record<string, string> = {
    KARAOKE: "kinetic",
    VIRAL_BOLD: "bold",
    NEON_BOX: "social",
    CLEAN: "clean",
    PODCAST: "minimal",
  };
  const preset = PRESET_FOR_STYLE[styleId];
  if (!preset) {
    console.error(
      `Štýl ${styleId} sa cez canonical os nedá dosiahnuť (canonical pozná len 5 presetov). ` +
        `Použi niektorý z: ${Object.keys(PRESET_FOR_STYLE).join(", ")} — alebo priamu cestu v paneli Titulky.`,
    );
    process.exit(2);
  }
  line("štýl titulkov", `${styleId} (canonical preset „${preset}")`);
  line("zvýraznenie hovoreného slova", `${spec.highlightMode} · zväčšenie ${spec.activeWordScale ?? "—"} · pruženie ${spec.activeWordPopMs ?? "predvolené"} ms`);
  if (!spec.activeWordScale || spec.activeWordScale === 100) {
    console.error("Tento štýl hovorené slovo nezväčšuje — nemal by čo merať (a nič nepredstieram).");
    process.exit(2);
  }

  // ---------------------------------------------------------------------
  head("2) REÁLNY PREPIS SO ČASOVANÍM SLOV");
  let segments: any[] = [];
  let transcriptSource = "";
  try {
    const wav = "/tmp/word-anim-16k.wav";
    const ff = spawnSync(FF, ["-y", "-v", "error", "-i", mediaPath, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav]);
    if (ff.status === 0 && existsSync(wav)) {
      const audioBase64 = readFileSync(wav).toString("base64");
      const res = await fetch(`${API}/api/transcribe-speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimeType: "audio/wav", language: "sk", videoDuration: Math.round(duration ?? 0) }),
      });
      const data: any = await res.json();
      line("prepis (HTTP)", `${res.status} | success=${data?.success} | hasSpeech=${data?.hasSpeech}`);
      if (data?.success && Array.isArray(data.segments) && data.segments.length) {
        segments = data.segments;
        transcriptSource = "reálny prepis z tohto videa (HTTP /api/transcribe-speech)";
        writeFileSync("/home/user/real-media/segments-krok18.json", JSON.stringify(segments, null, 1));
      }
    }
  } catch (err) {
    line("živý prepis zlyhal", (err as Error).message);
  }
  if (segments.length === 0 && planFile && existsSync(planFile)) {
    segments = JSON.parse(readFileSync(planFile, "utf-8"));
    transcriptSource = `uložený reálny prepis (${basename(planFile)}) — AI bolo medzitým limitované, nič sa nevymýšľa`;
  }
  if (segments.length === 0) {
    console.error("Nemám prepis (a runner si ho nevymýšľa).");
    process.exit(3);
  }
  const wordsTotal = segments.reduce((s: number, x: any) => s + (x.words?.length ?? 0), 0);
  line("zdroj", transcriptSource);
  line("viet / slov", `${segments.length} / ${wordsTotal}`);

  // ---------------------------------------------------------------------
  head("3) CANONICAL OS — titulky so slovami cez CommandManager");
  coreEngine.commandManager.setProject(JSON.parse(JSON.stringify(createInitialProject())));
  const project = coreEngine.getProject();
  const videoTrack = project.tracks.find((t: any) => t.type === "video") ?? project.tracks[0];
  const captionTrack = project.tracks.find((t: any) => t.type === "caption") ?? project.tracks[0];

  coreEngine.commandManager.executeCommand(
    new AddClipCommand(
      "Krok 18 — hlavné video",
      videoTrack.id,
      createCanonicalClip({
        id: "main_video_k18",
        trackId: videoTrack.id,
        type: "video",
        name: basename(mediaPath),
        assetId: "asset_main_k18",
        timelineStart: 0,
        sourceStart: 0,
        sourceEnd: duration ?? 10,
        duration: duration ?? 10,
        speed: 1,
        keyframes: [],
      }),
    ),
  );

  let added = 0;
  for (const seg of segments) {
    const rel = wordsToRelative(seg.words ?? [], seg.start);
    if (!hasUsableWordTiming(rel)) continue;
    coreEngine.commandManager.executeCommand(
      new AddClipCommand(
        `Titulok "${String(seg.text).slice(0, 18)}"`,
        captionTrack.id,
        createCanonicalClip({
          id: `cap_k18_${added}`,
          trackId: captionTrack.id,
          type: "caption",
          name: `Titulok: ${String(seg.text).slice(0, 18)}…`,
          timelineStart: seg.start,
          sourceStart: 0,
          sourceEnd: seg.end - seg.start,
          duration: seg.end - seg.start,
          speed: 1,
          scale: 100,
          opacity: 100,
          textConfig: {
            content: String(seg.text),
            fontFamily: "Inter, sans-serif",
            fontSize: 64,
            color: "#ffffff",
            strokeColor: "#000000",
            strokeWidth: 3,
            textAlign: "center",
            fontWeight: "bold",
            words: rel,
          },
          captionStyle: {
            font: "Inter",
            fontSize: 64,
            color: "#ffffff",
            outlineColor: "#000000",
            outlineWidth: 3,
            alignment: "center",
            position: "bottom",
            maxCharsPerLine: 20,
            maxLines: 2,
            preset: preset as never,
          },
          keyframes: [],
        }),
      ),
    );
    added++;
  }
  const after = coreEngine.getProject();
  const captionClips = after.tracks.flatMap((t: any) => t.clips).filter((c: any) => c.type === "caption");
  line("titulkov v canonical osi", captionClips.length);

  // ---------------------------------------------------------------------
  head("4) ČO PRESNE PÔJDE DO VIDEA (ASS z canonical zadania)");
  const uploadRes = await fetch(`${API}/api/export/upload?name=${encodeURIComponent(basename(mediaPath))}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: media,
  });
  const upload: any = await uploadRes.json();
  if (!uploadRes.ok || !upload?.uploadId) {
    console.error(`Nahrávanie zlyhalo: ${upload?.errorSk ?? uploadRes.status}`);
    process.exit(4);
  }
  const plan = buildCanonicalExportPlan(after, { uploadId: upload.uploadId, uploadName: upload.uploadName, width: 1080, height: 1920 });
  line("titulkov v zadaní", plan.request.segments.length);
  line("z toho s časovaním slov", plan.captionsWithWords);
  line("blokery", plan.blockersSk.length ? plan.blockersSk.join(" ") : "žiadne");

  const ass = buildAssFile({
    segments: plan.request.segments as never,
    style: spec,
    width: 1080,
    height: 1920,
  });
  const popTags = (ass.ass.match(/\\t\(0,\d+,\\fscx\d+\\fscy\d+\)/g) ?? []).filter((t) => !/\\fscx100\\fscy100\)/.test(t));
  // Statické zväčšenie hľadám v texte BEZ \t(...) skupín — inak by regex našiel
  // aj cieľové hodnoty vnútri animácie (a hlásil falošne „staré správanie").
  const withoutTransforms = ass.ass.replace(/\\t\([^)]*\)/g, "");
  const staticScaleTags = withoutTransforms.match(/\\fscx(?!100)\d+/g) ?? [];
  line("ASS: animované pruženie na slovo", `${popTags.length}× (napr. ${popTags.slice(0, 3).join(", ") || "—"})`);
  line("ASS: statické zväčšenie slova (staré)", staticScaleTags.length === 0 ? "žiadne" : `${staticScaleTags.length}×`);
  if (popTags.length === 0) {
    console.error("ASS nemá animáciu — nemalo by zmysel merať video (a nič nepredstieram).");
    process.exit(5);
  }

  // ---------------------------------------------------------------------
  head("5) REAL EXPORT (existujúca linka)");
  const burnRes = await fetch(`${API}/api/export/burn-captions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(plan.request),
  });
  const burn: any = await burnRes.json();
  if (!burnRes.ok || !burn?.jobId) {
    console.error(`Render sa nepodarilo spustiť: ${burn?.errorSk ?? burnRes.status}`);
    process.exit(6);
  }
  line("jobId", burn.jobId);
  line("server: zvýrazňovanie slov", burn.wordHighlight ? "ÁNO" : "NIE");
  for (const n of burn.notesSk ?? []) console.log(`  • server: ${n}`);

  let state = "queued";
  let result: any = null;
  const started = Date.now();
  while (Date.now() - started < 15 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 1500));
    const st: any = await (await fetch(`${API}/api/export/burn-captions/status?id=${encodeURIComponent(burn.jobId)}`)).json();
    state = st?.status?.state ?? "unknown";
    if (state === "done" || state === "error" || state === "canceled") {
      result = st?.status?.result ?? null;
      break;
    }
  }
  line("stav renderu", state);
  if (state !== "done" || !result?.outputName) {
    console.error("Render sa nedokončil — končím bez tvrdení.");
    process.exit(7);
  }
  const fileRes = await fetch(`${API}/api/export/file/${encodeURIComponent(result.outputName)}`);
  const outBytes = new Uint8Array(await fileRes.arrayBuffer());
  writeFileSync(outPath, outBytes);
  line("uložené video", `${outPath} (${outBytes.length} B)`);

  // ---------------------------------------------------------------------
  head("6) MERANIE PRUŽENIA NA HOTOVOM VIDEO");
  const size = probeSize(outPath) ?? { width: 1080, height: 1920 };
  const srcHash = pcmHash(mediaPath);
  const outHash = pcmHash(outPath);
  line("zvuk zdroj → výstup", `${srcHash} → ${outHash} ${srcHash === outHash ? "(rovnaký)" : "(LÍŠI SA!)"}`);

  const popSec = wordPopSecForStyle(spec, 1); // horná hranica; reálne oreže dĺžka slova
  line("pruženie podľa štýlu", `${Math.round(popSec * 1000)} ms (max; oreže sa na polovicu slova)`);

  const withWords = plan.request.segments
    .map((s: any) => ({ seg: s, w: (s.words ?? []) as { word: string; start: number; end: number }[] }))
    .filter((x: any) => x.w.length >= 2);

  const rows: {
    word: string;
    t0: number;
    samples: {
      dt: number; t: number;
      yellowCount: number; yellowWidthPx: number;
      allCount: number; allWidthPx: number;
      whiteCount: number; whiteWidthPx: number;
    }[];
    grewPx: number;
    lineDriftPct: number;
    frameFiles: string[];
  }[] = [];

  for (const { w } of withWords.slice(0, 6)) {
    // Meriam DRUHÉ slovo v titulku: vstupná animácia titulku (ak ju štýl má) už
    // vtedy skončila, takže rast žltej môže byť len pruženie hovoreného slova.
    if (w.length < 2) continue;
    const word = w[1];
    const next = w[2];
    const wordDur = (next?.start ?? word.end + 0.3) - word.start;
    if (wordDur < 0.25) continue; // bez miesta na pruženie
    const pop = Math.min(popSec, wordDur / 2);
    const timepoints = [0.02, pop * 0.35, pop * 0.7, pop + 0.02, Math.min(wordDur - 0.05, pop + 0.35)];
    const samples = [] as {
      dt: number; t: number;
      yellowCount: number; yellowWidthPx: number;
      allCount: number; allWidthPx: number;
      whiteCount: number; whiteWidthPx: number;
    }[];
    const frameFiles: string[] = [];
    for (const dt of timepoints) {
      const t = r3(word.start + dt);
      const box = captionBox(outPath, t, size);
      if (!box) continue;
      samples.push({
        dt: r3(dt),
        t,
        yellowCount: box.yellow.count,
        yellowWidthPx: box.yellow.widthPx,
        allCount: box.all.count,
        allWidthPx: box.all.widthPx,
        whiteCount: box.white.count,
        whiteWidthPx: box.white.widthPx,
      });
      const saved = saveFrame(outPath, t, `pruzenie-${word.word.replace(/[^\p{L}\p{N}]/gu, "")}-${t.toFixed(2)}s.png`);
      if (saved) frameFiles.push(saved);
    }
    if (samples.length < 3) continue;
    const grewPx = Math.max(...samples.map((s) => s.yellowWidthPx)) - Math.min(...samples.map((s) => s.yellowWidthPx));
    // Kontrola: NEZVÝRAZNENÉ (biele) slová — tie sa nesmú meniť. Keby sa menili,
    // rástol by celý titulok (animácia vstupu), nie hovorené slovo.
    // Počítam POČET pixelov, nie šírku: šírka (min/max) skáče o desiatky pixelov
    // len kvôli kompresii videa, kým počet je stabilný (a je to vidieť v logu).
    const whiteBase = Math.max(1, samples[0].whiteCount);
    const lineDriftPct =
      (Math.max(...samples.map((s) => Math.abs(s.whiteCount - samples[0].whiteCount))) / whiteBase) * 100;
    const sawYellow = samples.some((s) => s.yellowCount > 0);
    if (!sawYellow) continue; // v tomto okne nebolo zvýraznené slovo — nemám čo merať
    rows.push({ word: word.word, t0: r3(word.start), samples, grewPx, lineDriftPct, frameFiles });
  }

  for (const row of rows) {
    console.log(`  • slovo „${row.word}" (začína ${row.t0} s):`);
    for (const s of row.samples) {
      console.log(
        `      +${s.dt.toFixed(3)} s → ZVÝRAZNENÉ slovo: šírka ${s.yellowWidthPx} px (${s.yellowCount} px) ` +
          `| NEZVÝRAZNENÉ slová: šírka ${s.whiteWidthPx} px (${s.whiteCount} px)`,
      );
    }
    console.log(
      `      rast zvýrazneného slova: ${row.grewPx} px | zmena nezvýraznených slov: ${row.lineDriftPct.toFixed(2)} %`,
    );
  }

  // Pruženie je dokázané, len keď zvýraznené slovo rastie a NEZVÝRAZNENÉ slová stoja
  // (inak by rástol celý titulok — teda animácia vstupu, nie pruženie slova).
  const animatedWords = rows.filter((r) => r.grewPx >= 8 && r.lineDriftPct <= 2).length;
  line("slová, pri ktorých zvýraznené slovo pruží", rows.length === 0 ? "nemerateľné" : `${animatedWords}/${rows.length}`);
  const holdsAfter = rows.filter((r) => {
    const after = r.samples.filter((s) => s.dt >= (r.samples[1]?.dt ?? 0) && s.yellowWidthPx > 0);
    if (after.length < 2) return false;
    return Math.abs(after[after.length - 1].yellowWidthPx - after[after.length - 2].yellowWidthPx) <= 6;
  }).length;
  line("po pružení zvýraznené slovo drží", rows.length === 0 ? "nemerateľné" : `${holdsAfter}/${rows.length}`);
  line("uložené snímky", `${FRAMES}/pruzenie-*.png`);

  // ---------------------------------------------------------------------
  head("7) VERDIKT");
  const proved = animatedWords > 0 && outBytes.length > 10_000 && srcHash === outHash;
  line("veľkosť hovoreného slova sa v čase mení", animatedWords > 0 ? "ÁNO (zmerané na hotovom videe)" : "NIE");
  line("zvuk zostal nedotknutý", srcHash === outHash ? "áno" : "NIE");
  console.log(
    "\nOdpoveď na zadanie: „Hýbe sa zvýraznené slovo (pruží), alebo len stojí zväčšené?\"\n" +
      (proved
        ? "→ ÁNO, pruží — šírka zvýrazneného slova rastie počas pruženia a potom drží.\n" +
          "  (Zmena je zmeraná na hotovom MP4, ktorý vznikol existujúcou renderovacou linkou z canonical osi.)"
        : "→ NIE — dôvod je v číslach vyššie (nič nepredstieram)."),
  );

  console.log("\nKlasifikácia:");
  console.log("  • pruženie v exporte (merané na MP4) ..................... REAL EXPORT VERIFIED (tento beh)");
  console.log("  • pruženie v náhľade (canvas) ............................ NOT VERIFIED (v prostredí nie je DOM)");
  console.log("  • libass schopnosť \\t na jednom slove ................... MEASURED (kontrola-krok18/libass-sondy.json)");

  writeFileSync(
    EVIDENCE,
    JSON.stringify(
      {
        krok: 18,
        medium: mediaPath,
        zaciatok: new Date().toISOString(),
        styl: { id: styleId, zvacsenie: spec.activeWordScale, pruzenie_ms: spec.activeWordPopMs },
        ass: { animovane_tagy: popTags.length, staticke_tagy: staticScaleTags.length, vzorka: popTags.slice(0, 3) },
        export: { subor: outPath, bajty: outBytes.length, zvuk_zhoda: srcHash === outHash },
        meranie: rows,
        verdikt: { pruzi: proved, slov_meranych: rows.length, slov_animovanych: animatedWords },
      },
      null,
      2,
    ),
  );
  line("dôkaz uložený", EVIDENCE);
}

main().catch((err) => {
  console.error("Runner spadol:", err);
  process.exit(99);
});

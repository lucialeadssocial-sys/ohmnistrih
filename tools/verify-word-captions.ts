/**
 * KROK 17 — TITULKY PO SLOVÁCH: REAL-MEDIA DÔKAZ.
 *
 * Otázka zadania: *„Zvýrazňuje video naozaj hovorené slovo — a prišlo to
 * časovanie z canonical časovej osi, nie z UI?"*
 *
 * Tento runner to overuje na **reálnom videe** a **reálnom exporte**:
 *   1. reálne médium + reálny prepis (HTTP `/api/transcribe-speech`, wordTiming),
 *   2. titulky sa zapíšu do canonical osi **cez existujúci CommandManager**
 *      (rovnaká cesta ako `LocalCaptionStudio` — žiadna tichá mutácia modelu),
 *   3. canonical export plán: slová musia byť v zadaní v absolútnych časoch,
 *   4. plán snímky: náhľad vidí to isté slovo ako vypálenie (parita dát),
 *   5. **REAL EXPORT** existujúcou linkou (`/api/export/burn-captions`),
 *   6. meranie hotového súboru: zvýrazňovanie sa naozaj hýbe po slovách,
 *      zvuk zostal nedotknutý a server nehlási „nemám časovanie slov“.
 *
 * Nič sa nepredstiera: keď niečo nie je merateľné, runner to napíše.
 *
 *   bun run tools/verify-word-captions.ts /home/user/real-media/real_speech.mp4 \
 *     [--plan segments.json] [--out /home/user/export-krok17-slova.mp4] [--style VIRAL_BOLD]
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const API = process.env.OMNISTRIH_URL || "http://127.0.0.1:3000";

const args = process.argv.slice(2);
const mediaPath = args.find((a: string) => !a.startsWith("--"));
const planFile = valueOf("--plan");
const outPath = valueOf("--out") ?? "/home/user/export-krok17-slova.mp4";
const styleId = valueOf("--style") ?? "VIRAL_BOLD";
const EVIDENCE = "/home/user/kontrola-krok17-slova.json";

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
  console.log(`${label.padEnd(50, ".")} ${value}`);
}
function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
function sha256(bytes: Uint8Array | Buffer) {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 16);
}

/** Rozmery rámu zo súboru (žiadne predpoklady). */
function probeSize(file: string): { width: number; height: number } | null {
  const p = spawnSync(FF, ["-hide_banner", "-i", file], { encoding: "utf-8" });
  const m = `${p.stdout ?? ""}${p.stderr ?? ""}`.match(/Video: [^\n]*?(\d{2,5})x(\d{2,5})/);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

/**
 * Zmeria ŽLTÉ zvýraznenie v pásme titulkov na snímke v čase `t`.
 *
 * Prečo práve žltá: zvýraznené hovorené slovo má farbu zo štýlu titulkov
 * (`highlightColor`), takže sa dá merať priamo — koľko žltého je v obraze
 * a kde (stred X). Keď sa zvýraznenie posunie na iné slovo, **stred sa posunie**.
 *
 * Snímka sa číta ako surové pixely z ffmpeg (žiadna ďalšia knižnica).
 */
function yellowHighlight(
  file: string,
  t: number,
  size: { width: number; height: number },
): { count: number; centroidX: number | null } | null {
  const out = spawnSync(
    FF,
    ["-hide_banner", "-v", "error", "-ss", String(t), "-i", file, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
    { maxBuffer: 256 * 1024 * 1024 },
  );
  const buf = out.stdout as Buffer | undefined;
  if (!buf || buf.length < size.width * size.height * 3) return null;

  const yFrom = Math.floor(size.height * 0.62); // pásmo titulkov (dole)
  const step = 2;
  let count = 0;
  let sumX = 0;
  for (let y = yFrom; y < size.height; y += step) {
    const rowBase = y * size.width * 3;
    for (let x = 0; x < size.width; x += step) {
      const i = rowBase + x * 3;
      const r = buf[i];
      const g = buf[i + 1];
      const b = buf[i + 2];
      if (r > 170 && g > 140 && b < 120) {
        count++;
        sumX += x;
      }
    }
  }
  return { count, centroidX: count > 0 ? Math.round(sumX / count) : null };
}

/**
 * Rozdiel medzi ZDROJOVÝM videom a VÝSTUPOM v rovnakom čase (pásmo titulkov).
 * Kontrola, že titulok (a zvýraznenie) je vôbec v obraze a nie je to šum.
 */
function crossFileDiff(a: string, b: string, atSec: number): number | null {
  const filter =
    "[0:v][1:v]blend=all_mode=difference,crop=iw:ih*0.35:0:ih*0.65,format=gray,signalstats,metadata=print:file=-";
  const out = spawnSync(
    FF,
    ["-hide_banner", "-ss", String(atSec), "-i", a, "-ss", String(atSec), "-i", b, "-filter_complex", filter, "-frames:v", "1", "-f", "null", "-"],
    { encoding: "utf-8" },
  );
  const m = `${out.stdout ?? ""}\n${out.stderr ?? ""}`.match(/lavfi\.signalstats\.YAVG=([\d.]+)/);
  return m ? Number(m[1]) : null;
}

/** Zvuk vytiahnutý ako PCM (obsahové porovnanie — nie bajtové, formát sa mení). */
function pcmHash(file: string): string | null {
  const out = spawnSync(FF, ["-v", "error", "-i", file, "-vn", "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], {
    encoding: "buffer",
    maxBuffer: 512 * 1024 * 1024,
  });
  if (out.status !== 0 || !out.stdout?.length) return null;
  return sha256(out.stdout as Buffer);
}

function mediaDuration(file: string): number | null {
  const p = spawnSync(FF, ["-hide_banner", "-i", file], { encoding: "utf-8" });
  const m = `${p.stdout ?? ""}${p.stderr ?? ""}`.match(/Duration: (\d+):(\d+):([\d.]+)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

async function main() {
  if (!mediaPath || !existsSync(mediaPath)) {
    console.error("Chýba reálne médium: bun run tools/verify-word-captions.ts <video>");
    process.exit(1);
  }
  const media = readFileSync(mediaPath);
  const duration = mediaDuration(mediaPath);

  head("1) REÁLNE MÉDIUM (skutočný súbor, nie syntetický)");
  line("súbor", basename(mediaPath));
  line("veľkosť", `${media.length} B`);
  line("dĺžka (meraná ffmpeg)", `${duration?.toFixed(2) ?? "?"} s`);
  line("appka", API);

  // ---------------------------------------------------------------------
  head("2) REÁLNY PREPIS SO ČASOVANÍM SLOV");
  let segments: any[] = [];
  let transcriptSource = "";

  const tryLive = async (): Promise<any[] | null> => {
    const wavPath = "/tmp/word-captions-16k.wav";
    const ff = spawnSync(FF, ["-y", "-v", "error", "-i", mediaPath, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wavPath]);
    if (ff.status !== 0 || !existsSync(wavPath)) return null;
    const audioBase64 = readFileSync(wavPath).toString("base64");
    const res = await fetch(`${API}/api/transcribe-speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioBase64, mimeType: "audio/wav", language: "sk", videoDuration: Math.round(duration ?? 0) }),
    });
    const data: any = await res.json();
    line("prepis (HTTP)", `${res.status} | success=${data?.success} | hasSpeech=${data?.hasSpeech}`);
    if (!data?.success || !Array.isArray(data.segments) || data.segments.length === 0) return null;
    return data.segments;
  };

  try {
    const live = await tryLive();
    if (live) {
      segments = live;
      transcriptSource = "reálny prepis z tohto videa (HTTP /api/transcribe-speech)";
      // Reálny prepis sa ukladá mimo repa — keď AI medzitým limitované, dá sa použiť znova
      // (a je jasné, že je to ten istý reálny prepis, nie vymyslený).
      writeFileSync("/home/user/real-media/segments-krok17.json", JSON.stringify(segments, null, 1));
      line("prepis uložený", "/home/user/real-media/segments-krok17.json");
    }
  } catch (err) {
    line("živý prepis zlyhal", (err as Error).message);
  }

  if (segments.length === 0 && planFile && existsSync(planFile)) {
    segments = JSON.parse(readFileSync(planFile, "utf-8"));
    transcriptSource = `uložený reálny prepis (${basename(planFile)}) — AI bolo medzitým limitované, nič sa nevymýšľa`;
  }
  if (segments.length === 0) {
    console.error("Nemám prepis (a runner si ho nevymýšľa). Skús znova alebo daj --plan segments.json.");
    process.exit(2);
  }

  const wordsTotal = segments.reduce((s: number, x: any) => s + (Array.isArray(x.words) ? x.words.length : 0), 0);
  line("zdroj", transcriptSource);
  line("viet / slov", `${segments.length} / ${wordsTotal}`);
  line("prvá veta", segments[0]?.text ?? "");
  if (wordsTotal === 0) {
    console.error("Prepis nemá časovanie slov — tento dôkaz nemá čo merať (a nič nepredstieram).");
    process.exit(3);
  }

  // ---------------------------------------------------------------------
  head("3) CANONICAL ČASOVÁ OS — titulky sa zapíšu CEZ CommandManager");
  const { createInitialProject } = await import("/home/user/ohmnistrih/src/core/index.ts");
  const { createCanonicalClip } = await import("/home/user/ohmnistrih/src/core/types/project.ts");
  const { wordsToRelative, hasUsableWordTiming } = await import("/home/user/ohmnistrih/src/core/transcript/wordTiming.ts");
  const { buildCanonicalExportPlan } = await import("/home/user/ohmnistrih/src/core/export/canonicalExport.ts");
  const { buildCanonicalFramePlan } = await import("/home/user/ohmnistrih/src/core/render/canonicalFrame.ts");
  const { coreEngine } = await import("/home/user/ohmnistrih/src/core/index.ts");

  const project = createInitialProject();
  coreEngine.commandManager.setProject(JSON.parse(JSON.stringify(project)));

  const liveProject = coreEngine.getProject();
  const videoTrack = liveProject.tracks.find((t: any) => t.type === "video") ?? liveProject.tracks[0];
  const captionTrack = liveProject.tracks.find((t: any) => t.type === "caption") ?? liveProject.tracks[0];

  const videoClip = createCanonicalClip({
    id: "main_video_k17",
    trackId: videoTrack.id,
    type: "video",
    name: basename(mediaPath),
    assetId: "asset_main_k17",
    timelineStart: 0,
    sourceStart: 0,
    sourceEnd: duration ?? 10,
    duration: duration ?? 10,
    speed: 1,
    keyframes: [],
  });
  coreEngine.commandManager.executeCommand(
    new (await import("/home/user/ohmnistrih/src/core/index.ts")).AddClipCommand(
      "Krok 17 — hlavné video",
      videoTrack.id,
      videoClip,
    ),
  );

  let captionsAdded = 0;
  let captionsWithWords = 0;
  for (const seg of segments) {
    const rel = wordsToRelative(seg.words ?? [], seg.start);
    if (!hasUsableWordTiming(rel)) continue;
    const clip = createCanonicalClip({
      id: `cap_k17_${captionsAdded}`,
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
        backgroundColor: undefined,
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
        preset: styleId as never,
      },
      keyframes: [],
    });
    coreEngine.commandManager.executeCommand(
      new (await import("/home/user/ohmnistrih/src/core/index.ts")).AddClipCommand(
        `Titulok "${String(seg.text).slice(0, 18)}"`,
        captionTrack.id,
        clip,
      ),
    );
    captionsAdded++;
    captionsWithWords++;
  }

  const after = coreEngine.getProject();
  const captionClips = after.tracks.flatMap((t: any) => t.clips).filter((c: any) => c.type === "caption");
  line("titulkov zapísaných do canonical osi", captionClips.length);
  line("z toho s časovaním slov", captionsWithWords);
  line("bez časovania", captionsAdded - captionsWithWords);
  if (captionClips.length === 0) {
    console.error("Do canonical osi sa nezapísal ani jeden titulok — ďalej nemám čo dokazovať.");
    process.exit(4);
  }

  // ---------------------------------------------------------------------
  head("4) EXPORTNÝ PLÁN Z CANONICAL OSI — nesie slová?");
  const uploadRes = await fetch(`${API}/api/export/upload?name=${encodeURIComponent(basename(mediaPath))}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: media,
  });
  const upload: any = await uploadRes.json();
  if (!uploadRes.ok || !upload?.success || !upload?.uploadId) {
    console.error(`Nahrávanie do appky zlyhalo: ${upload?.errorSk ?? uploadRes.status}`);
    process.exit(5);
  }
  line("nahrané do appky", `${upload.uploadId} (${upload.uploadName})`);

  const plan = buildCanonicalExportPlan(after, {
    uploadId: upload.uploadId,
    uploadName: upload.uploadName,
    width: 1080,
    height: 1920,
  });
  line("titulkov v zadaní", plan.request.segments.length);
  line("z toho s časovaním slov", plan.captionsWithWords);
  line("blokery exportu", plan.blockersSk.length ? plan.blockersSk.join(" ") : "žiadne");
  const wordsInRequest = plan.request.segments.reduce((s: number, x: any) => s + (Array.isArray(x.words) ? x.words.length : 0), 0);
  line("slov v zadaní (celkom)", wordsInRequest);
  for (const n of plan.notesSk) console.log(`  • plán: ${n}`);

  const firstWithWords = plan.request.segments.find((s: any) => Array.isArray(s.words) && s.words.length > 0);
  if (!firstWithWords) {
    console.error("Zadanie nemá ani jeden titulok s časovaním slov — zvýrazňovanie nemá z čoho žiť.");
    process.exit(6);
  }
  const firstWords = (firstWithWords.words ?? []) as { word: string; start: number; end: number }[];
  line(
    "prvý titulok so slovami",
    `"${firstWithWords.text}" ${firstWithWords.start}–${firstWithWords.end} s · slová: ${firstWords
      .slice(0, 4)
      .map((w) => `${w.word}@${w.start}`)
      .join(", ")}${firstWords.length > 4 ? ", …" : ""}`,
  );
  const insideWindow = plan.request.segments
    .filter((s: any) => Array.isArray(s.words))
    .every((s: any) => s.words.every((w: any) => w.start >= s.start - 1e-6 && w.end <= s.end + 1e-6));
  line("slová sedia v okne svojho titulku", insideWindow ? "áno" : "NIE (!!)");

  // parita náhľadu: rovnaké slovo v pláne snímky ako v zadaní
  head("5) NÁHĽAD — vidí to isté slovo?");
  const { activeWordAt } = await import("/home/user/ohmnistrih/src/core/transcript/wordTiming.ts");
  let parityChecked = 0;
  let parityOk = 0;
  const parityRows: string[] = [];
  const paritySegments = plan.request.segments
    .map((s: any) => ({ seg: s, segWords: (s.words ?? []) as { word: string; start: number; end: number }[] }))
    .filter((x: any) => x.segWords.length >= 2)
    .slice(0, 3);
  for (const { seg, segWords } of paritySegments) {
    // Vzorka musí padnúť VNÚTRI slova (v medzere medzi slovami platí ešte to predošlé —
    // presne toto pravidlo používa aj vypálenie, takže by kontrola klamala).
    const wTarget = segWords[1];
    const nextStart = segWords[2]?.start ?? wTarget.end;
    const t = round3(wTarget.start + Math.max(0.01, (Math.min(wTarget.end, nextStart) - wTarget.start) / 2));
    const frame = buildCanonicalFramePlan(after, t);
    const layer = frame.layers.find((l: any) => l.kind === "text");
    if (!layer || !layer.words) continue;
    const active = activeWordAt(layer.words, layer.clipTime);
    parityChecked++;
    const norm = (x: string) => x.replace(/[.,!?…:;]+$/g, "").toLowerCase();
    const ok = Boolean(active && norm(active.word) === norm(wTarget.word));
    if (ok) parityOk++;
    parityRows.push(
      `titulok @${round3(seg.start)} s · čas ${round3(t)} s (vnútri slova) → náhľad zvýrazní „${active?.word ?? "—"}“, zadanie „${wTarget.word}“ ${ok ? "✔" : "✘"}`,
    );
  }
  for (const r of parityRows) console.log(`  • ${r}`);
  line("parita náhľad ↔ zadanie", parityChecked === 0 ? "nemerateľné (málo slov)" : `${parityOk}/${parityChecked} sedí`);

  // ---------------------------------------------------------------------
  head("6) REAL EXPORT — existujúca linka, žiadny druhý render engine");
  const burnRes = await fetch(`${API}/api/export/burn-captions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(plan.request),
  });
  const burn: any = await burnRes.json();
  if (!burnRes.ok || !burn?.success || !burn?.jobId) {
    console.error(`Render sa nepodarilo spustiť: ${burn?.errorSk ?? burnRes.status}`);
    process.exit(7);
  }
  line("render spustený (jobId)", burn.jobId);
  line("server: zvýrazňovanie slov", burn.wordHighlight ? "ÁNO (wordHighlight=true)" : "NIE");
  line("server: počet titulkov", burn.eventCount ?? "?");
  for (const n of burn.notesSk ?? []) console.log(`  • server: ${n}`);
  const serverNotes: string[] = Array.isArray(burn.notesSk) ? burn.notesSk : [];

  let state = "queued";
  let result: any = null;
  const started = Date.now();
  while (Date.now() - started < 15 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 1500));
    const stRes = await fetch(`${API}/api/export/burn-captions/status?id=${encodeURIComponent(burn.jobId)}`);
    const st: any = await stRes.json();
    state = st?.status?.state ?? "unknown";
    if (state === "done" || state === "error" || state === "canceled") {
      result = st?.status?.result ?? null;
      if (state === "error") console.error(`Render zlyhal: ${st?.status?.errorSk}`);
      break;
    }
  }
  line("stav renderu", state);
  if (state !== "done" || !result?.outputName) {
    console.error("Render sa nedokončil (alebo nevrátil súbor) — nič nepredstieram, končím.");
    process.exit(8);
  }

  const fileRes = await fetch(`${API}/api/export/file/${encodeURIComponent(result.outputName)}`);
  if (!fileRes.ok) {
    console.error(`Hotový súbor sa nedá stiahnuť (HTTP ${fileRes.status}).`);
    process.exit(9);
  }
  const outBytes = new Uint8Array(await fileRes.arrayBuffer());
  writeFileSync(outPath, outBytes);
  line("uložené", `${outPath} (${outBytes.length} B)`);

  // ---------------------------------------------------------------------
  head("7) MERANIE HOTOVÉHO SÚBORA — hýbe sa zvýraznenie po slovách?");
  const srcHash = pcmHash(mediaPath);
  const outHash = pcmHash(outPath);
  line("hash zvuku zdroj → výstup", `${srcHash} → ${outHash} ${srcHash && srcHash === outHash ? "(rovnaký)" : "(LÍŠI SA!)"}`);

  // Dvojice slov v jednom titulku: v čase slova A a v čase slova B sa musí
  // obraz v pásme titulkov líšiť (zvýraznenie sa posunulo na iné slovo).
  // Meria sa priamo zvýraznenie: koľko ŽLTÉHO je v pásme titulkov a kde (stred X).
  // Zvýraznené slovo má farbu zo štýlu, takže sa to dá odčítať z obrazu.
  const outSize = probeSize(outPath) ?? { width: 1080, height: 1920 };
  const srcSize = probeSize(mediaPath) ?? outSize;
  line("rozmer výstupu", `${outSize.width}×${outSize.height}`);

  const measurable = plan.request.segments
    .map((s: any) => ({ seg: s, segWords: (s.words ?? []) as { word: string; start: number; end: number }[] }))
    .filter((x: any) => x.segWords.length >= 2);

  const samples: {
    wordA: string; wordB: string; tA: number; tB: number;
    a: { count: number; centroidX: number | null } | null;
    b: { count: number; centroidX: number | null } | null;
    sameWord: { count: number; centroidX: number | null } | null;
    sourceA: { count: number; centroidX: number | null } | null;
  }[] = [];

  for (const { segWords } of measurable.slice(0, 5)) {
    const wa = segWords[0];
    const wb = segWords[1];
    const tA = round3(wa.start + Math.max(0.02, (wa.end - wa.start) / 2));
    const tB = round3(wb.start + Math.max(0.02, (wb.end - wb.start) / 2));
    if (tB - tA < 0.12) continue;
    samples.push({
      wordA: wa.word,
      wordB: wb.word,
      tA,
      tB,
      a: yellowHighlight(outPath, tA, outSize),
      b: yellowHighlight(outPath, tB, outSize),
      sameWord: yellowHighlight(outPath, round3(tA + 0.03), outSize),
      sourceA: yellowHighlight(mediaPath, tA, srcSize),
    });
  }

  for (const s of samples) {
    console.log(
      `  • „${s.wordA}“ @${s.tA} s: žltých ${s.a?.count ?? "?"} px (stred X ${s.a?.centroidX ?? "—"}) ` +
        `| „${s.wordB}“ @${s.tB} s: žltých ${s.b?.count ?? "?"} px (stred X ${s.b?.centroidX ?? "—"}) ` +
        `| to isté slovo (+0,03 s): ${s.sameWord?.count ?? "?"} px (X ${s.sameWord?.centroidX ?? "—"}) ` +
        `| zdrojové video: ${s.sourceA?.count ?? "?"} px`,
    );
  }

  // Zvýraznenie sa „pohlo“, keď sa medzi dvoma slovami zmenilo buď miesto (stred žltej
  // časti o viac než 40 px z 1080), alebo množstvo žltého (o viac než 25 % — iné slovo
  // má inú dĺžku). Zároveň kontrola „to isté slovo + 0,03 s“ musí zostať na mieste
  // (stred do 25 px a množstvo do 15 %) — inak by meranie len odrážalo pohyb videa.
  const movedPairs = samples.filter((s) => {
    if (!s.a || !s.b || !s.sameWord) return false;
    if (!s.a.centroidX || !s.b.centroidX || !s.sameWord.centroidX) return false;
    const movedByPosition = Math.abs(s.a.centroidX - s.b.centroidX) > 40;
    const countRatio = s.a.count > 0 ? Math.abs(s.a.count - s.b.count) / s.a.count : 0;
    const movedBySize = countRatio > 0.25;
    const stablePosition = Math.abs(s.a.centroidX - s.sameWord.centroidX) < 25;
    const sameRatio = s.sameWord.count > 0 ? Math.abs(s.a.count - s.sameWord.count) / s.sameWord.count : 1;
    return (movedByPosition || movedBySize) && stablePosition && sameRatio < 0.15;
  }).length;
  const highlighted = samples.filter((s) => (s.a?.count ?? 0) > 50).length;
  const sourceClean = samples.filter((s) => (s.sourceA?.count ?? 0) < 10).length;
  line("snímky so zvýrazneným slovom", samples.length === 0 ? "nemerateľné" : `${highlighted}/${samples.length}`);
  line("zvýraznenie sa posunulo na iné slovo", samples.length === 0 ? "nemerateľné" : `${movedPairs}/${samples.length} dvojíc`);
  line("zdrojové video žlté zvýraznenie nemá", samples.length === 0 ? "nemerateľné" : `${sourceClean}/${samples.length} snímok`);
  const captionInPicture = samples.length ? crossFileDiff(mediaPath, outPath, samples[0].tA) : null;
  line("kontrola: titulok je vôbec v obraze (zdroj vs výstup)", captionInPicture ?? "?");

  const noWordNote = serverNotes.filter((n) => n.includes("nemám časovanie slov"));
  const wordNote = serverNotes.filter((n) => n.includes("Zvýrazňovanie hovoreného slova je zapnuté"));
  line("server hlási chýbajúce časovanie", noWordNote.length === 0 ? "NIE (časovanie má)" : noWordNote.join(" "));
  line("server hlási zvýrazňovanie", wordNote.length ? "ÁNO" : "NIE");

  // ---------------------------------------------------------------------
  head("8) VERDIKT");
  const wordsOnPath = wordsInRequest > 0 && insideWindow;
  const exportOk = outBytes.length > 10_000;
  const highlightProved = burn.wordHighlight === true && noWordNote.length === 0 && movedPairs > 0 && highlighted > 0;
  line("slová idú z canonical osi do videa", wordsOnPath && exportOk ? "áno (dôkaz vyššie)" : "NIE");
  line("zvýrazňovanie hovoreného slova overené", highlightProved ? "áno — merané na hotovom súbore" : "NIE");
  console.log(
    "\nOdpoveď na zadanie: „Zvýrazňuje video naozaj hovorené slovo a ide to z canonical časovej osi?“\n" +
      (highlightProved
        ? "→ ÁNO (canonical os → plán snímky → existujúca renderovacia linka → zmerané vo videu)."
        : "→ NIE ÚPLNE — dôvod je v číslach vyššie (nič nepredstieram)."),
  );

  console.log("\nKlasifikácia:");
  console.log("  • canonical os + slová v zadaní + render ................. REAL MEDIA VERIFIED (tento beh)");
  console.log("  • náhľad (canvas v prehliadači) .......................... NOT VERIFIED (v prostredí nie je DOM)");
  console.log("  • generovanie vizuálov ................................... PROVIDER UNAVAILABLE (negeneruje sa nič)");

  writeFileSync(
    EVIDENCE,
    JSON.stringify(
      {
        krok: 17,
        medium: mediaPath,
        zaciatok: new Date().toISOString(),
        prepis: { zdroj: transcriptSource, viet: segments.length, slov: wordsTotal },
        canonical: { titulkov: captionClips.length, s_casovanim: captionsWithWords },
        zadanie: { titulkov: plan.request.segments.length, slov: wordsInRequest, s_casovanim: plan.captionsWithWords, slova_v_okne: insideWindow },
        parita_nahlad: { skontrolovane: parityChecked, sedi: parityOk, riadky: parityRows },
        export: {
          subor: outPath,
          bajty: outBytes.length,
          server_wordHighlight: burn.wordHighlight === true,
          server_poznamky: serverNotes,
          zvuk_zhoda: Boolean(srcHash && srcHash === outHash),
        },
        meranie: samples,
        verdikt: { slova_na_ceste: wordsOnPath && exportOk, zvysovanie_overene: highlightProved },
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

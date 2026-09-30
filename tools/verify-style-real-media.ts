/**
 * REAL-MEDIA VERIFIKÁCIA STYLE STUDIA (krok 5–6) — spúšťací skript.
 *
 * Preženie **reálne dáta** celým reťazcom:
 *   reálne médium (tvoj klip) → reálna reč → reálny prepis Gemini s časovaním po slovách
 *   → Style Intelligence (plán) → APPLY cez CommandManager → kontrola canonical stavu
 *   → kontrola audia (bajt po bajte) → ROLLBACK → kontrola presnej obnovy.
 *
 * Použitie:
 *   bun run tools/verify-style-real-media.ts <cesta-k-médiu> [--plan <subor-so-segmentami.json>]
 *
 * Ak `--plan` nie je zadaný, skript si vypýta prepis z bežiacej appky
 * (`POST /api/transcribe-speech` s reálnym audióm z videa — cez ffmpeg).
 *
 * Poctivo: skript NIKDY netvrdí „REAL VIDEO GENERATION VERIFIED“ ani podobné veci.
 * Vypisuje presne to, čo zmeria.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { basename } from "node:path";
import { coreEngine, createInitialProject } from "../src/core";
import { applyStylePlan, fingerprintStyleState, rollbackStyleApply, styleApplyReportTextSk } from "../src/core/style/styleApply";
import { buildStylePlan } from "../src/core/style/styleIntelligence";
import { getStyleRecipe, type StylePresetId } from "../src/core/style/styleRecipes";
import type { SpeechSegmentLike } from "../src/core/transcript/wordTiming";
import { flattenWords } from "../src/core/transcript/wordTiming";
import type { MediaAsset } from "../src/core/types/project";

const args = process.argv.slice(2);
const mediaPath = args.find((a) => !a.startsWith("--"));
const planIdx = args.indexOf("--plan");
const planFile = planIdx >= 0 ? args[planIdx + 1] : undefined;
const recipeArg = (args.find((a) => a.startsWith("--recipe="))?.split("=")[1] ?? "EDITORIAL_COLLAGE") as StylePresetId;
const API = process.env.OMNISTRIH_URL || "http://127.0.0.1:3000";

/** Overená cesta k médiu (aby TypeScript vedel, že je to naozaj `string`). */
function requireMediaPath(): string {
  if (typeof mediaPath !== "string" || mediaPath.length === 0 || !existsSync(mediaPath)) {
    console.error("Použitie: bun run tools/verify-style-real-media.ts <video> [--plan segments.json] [--recipe=ID]");
    process.exit(2);
  }
  return mediaPath;
}

/** ffmpeg z prostredia (imageio-ffmpeg) — bez neho sa nedá získať audio ani snímka. */
function ffmpegExe(): string {
  const fromImageio = spawnSync("python3", ["-c", "import imageio_ffmpeg,sys;sys.stdout.write(imageio_ffmpeg.get_ffmpeg_exe())"], { encoding: "utf-8" });
  const exe = (fromImageio.stdout ?? "").trim();
  if (exe.length > 0 && existsSync(exe)) return exe;
  const which = spawnSync("which", ["ffmpeg"], { encoding: "utf-8" });
  const w = (which.stdout ?? "").trim();
  if (w.length > 0) return w;
  throw new Error("ffmpeg sa nenašiel (pip install imageio-ffmpeg)");
}

function ffprobeDuration(exe: string, file: string): number {
  const res = spawnSync(exe, ["-hide_banner", "-i", file], { encoding: "utf-8" });
  const text = `${res.stderr ?? ""}`;
  const m = text.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

function line(label: string, value: string | number | boolean) {
  console.log(`${label.padEnd(46, ".")} ${value}`);
}

async function main() {
  const mediaFile = requireMediaPath();
  const ff = ffmpegExe();
  const media = readFileSync(mediaFile);
  const durationSec = ffprobeDuration(ff, mediaFile);
  console.log("=".repeat(78));
  console.log("REAL-MEDIA VERIFIKÁCIA STYLE STUDIA (krok 5–6)");
  console.log("=".repeat(78));
  line("médium", basename(mediaFile));
  line("veľkosť / dĺžka", `${media.byteLength} B / ${durationSec.toFixed(2)} s`);
  line("ffmpeg", ff.split("/").pop() ?? ff);

  // --- 1. Reálny prepis (z appky, ak nie je hotový JSON) -------------------
  let segments: SpeechSegmentLike[];
  if (planFile) {
    segments = JSON.parse(readFileSync(planFile, "utf-8")) as SpeechSegmentLike[];
    line("prepis", `zo súboru ${planFile}`);
  } else {
    const audioPath = "/tmp/verify-style-audio.m4a";
    const ex = spawnSync(ff, ["-y", "-hide_banner", "-loglevel", "error", "-i", mediaFile, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", audioPath]);
    if (ex.status !== 0) throw new Error("nepodarilo sa vytiahnuť audio z videa");
    const audioB64 = readFileSync(audioPath).toString("base64");
    line("audio pre prepis", `${readFileSync(audioPath).byteLength} B (16 kHz mono)`);
    const res = await fetch(`${API}/api/transcribe-speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioBase64: audioB64, mimeType: "audio/mp4", language: "sk", videoDuration: durationSec }),
    });
    const data = (await res.json()) as { success: boolean; hasSpeech: boolean; segments?: SpeechSegmentLike[]; errorSk?: string; error?: string; modelsTried?: string[] };
    line("prepis (HTTP)", `${res.status} | success=${data.success} | hasSpeech=${data.hasSpeech}`);
    if (data.error || data.errorSk) {
      line("dôvod chyby", data.errorSk ?? data.error ?? "?");
      line("skúsené modely", (data.modelsTried ?? []).join(", ") || "—");
    }
    if (!data.success) throw new Error(`prepis zlyhal: ${data.errorSk ?? data.error ?? "neznámy dôvod"}`);
    if (!data.hasSpeech) throw new Error("v médiu sa nenašla reč — nedá sa spustiť style intelligence (a nič sa nepredstiera)");
    segments = data.segments ?? [];
    writeFileSync("/tmp/verify-style-segments.json", JSON.stringify(segments, null, 1));
    line("segmenty uložené", "/tmp/verify-style-segments.json");
  }

  const words = flattenWords(segments);
  line("viet / slov", `${segments.length} / ${words.length}`);

  // --- 2. Style Intelligence na reálnych dátach ---------------------------
  const recipe = getStyleRecipe(recipeArg);
  const stylePlan = buildStylePlan({
    segments,
    recipe,
    durationSec,
    availableSupportingVisuals: 1,
  });
  line("recept", `${stylePlan.recipeLabelSk} (${stylePlan.recipeId})`);
  line("rozhodnutí", stylePlan.decisions.length);
  line("podiel rečníka", `${Math.round(stylePlan.ratio.target * 100)} % (recept ${Math.round(stylePlan.ratio.base * 100)} %)`);
  line("presnosť časov z dát", stylePlan.basis.timingPrecision);
  line("provider", stylePlan.provider);
  line("audio policy", stylePlan.audioPolicy);
  console.log("\nPrvé 3 rozhodnutia (WHAT / WHY / WHEN NOT):");
  for (const d of stylePlan.decisions.slice(0, 3)) {
    const st = d.style;
    if (!st) continue;
    console.log(`  • [${st.kind}] ${st.whenSk.startSec}–${st.whenSk.endSec} s`);
    console.log(`     ČO:       ${st.whatSk}`);
    console.log(`     PREČO:    ${st.whySk}`);
    console.log(`     KEDY NIE: ${st.whenNotSk}`);
    console.log(`     ISTOTA:   ${Math.round(st.confidence * 100)} %`);
  }

  // --- 3. Reálny projekt + reálne médiá ----------------------------------
  const project = createInitialProject("Real-media verifikácia Style Studia");
  coreEngine.commandManager.setProject(project);

  // Hlavné video: skutočný klip. Reálny „cutaway“ obrázok: skutočná snímka z toho istého videa.
  const shotPath = "/tmp/verify-style-shot.png";
  spawnSync(ff, ["-y", "-hide_banner", "-loglevel", "error", "-ss", "1", "-i", mediaFile, "-frames:v", "1", shotPath]);
  const shot = existsSync(shotPath) ? readFileSync(shotPath) : null;

  const mkAsset = (over: Partial<MediaAsset>): MediaAsset =>
    ({
      id: "asset_main_video",
      name: basename(mediaFile),
      type: "video",
      opfsPath: `/local/${basename(mediaFile)}`,
      size: media.byteLength,
      mimeType: "video/mp4",
      duration: durationSec,
      width: 1080,
      height: 1920,
      fps: 30,
      createdAt: Date.now(),
      ...over,
    }) as MediaAsset;

  const assets: MediaAsset[] = [mkAsset({})];
  if (shot) {
    assets.push(
      mkAsset({
        id: "asset_real_shot",
        name: "snímka-z-videa.png",
        type: "image",
        mimeType: "image/png",
        size: shot.byteLength,
        duration: 0,
        fps: 0,
        createdAt: Date.now() + 1,
      }),
    );
    line("reálny obrázok (snímka 1. s)", `${shot.byteLength} B`);
  } else {
    line("reálny obrázok (snímka 1. s)", "NEDOSTUPNÝ (ffmpeg snímku nevytvoril)");
  }
  coreEngine.commandManager.setProject({ ...coreEngine.getProject(), assets });
  line("médiá v projekte", assets.map((a) => `${a.type}:${a.id}`).join(", "));

  // Reálne video na hlavnú stopu (+ reálna zvuková stopa, aby bolo čo chrániť).
  const videoTrack = coreEngine.getProject().tracks.find((t) => t.type === "video")!;
  const audioTrack = coreEngine.getProject().tracks.find((t) => t.type === "audio")!;
  coreEngine.addClip(videoTrack.id, {
    id: "clip_main_video",
    trackId: videoTrack.id,
    type: "video",
    assetId: "asset_main_video",
    name: basename(mediaFile),
    timelineStart: 0,
    start: 0,
    sourceStart: 0,
    sourceEnd: durationSec,
    duration: durationSec,
    offset: 0,
    speed: 1,
    volume: 100,
    scale: 100,
    opacity: 100,
    positionX: 0,
    positionY: 0,
    rotation: 0,
    keyframes: [],
  } as never);
  coreEngine.addClip(audioTrack.id, {
    id: "clip_original_vo",
    trackId: audioTrack.id,
    type: "audio",
    assetId: "asset_main_video",
    name: "Pôvodný zvuk (VO master)",
    timelineStart: 0,
    start: 0,
    sourceStart: 0,
    sourceEnd: durationSec,
    duration: durationSec,
    offset: 0,
    speed: 1,
    volume: 100,
    scale: 100,
    opacity: 100,
    positionX: 0,
    positionY: 0,
    rotation: 0,
    keyframes: [],
  } as never);
  line("klipy pred apply", `video=${fingerprintStyleState(coreEngine.getProject()).videoClips} audio=${fingerprintStyleState(coreEngine.getProject()).audioClips}`);

  // --- 4. APPLY -----------------------------------------------------------
  const before = fingerprintStyleState(coreEngine.getProject());
  const report = applyStylePlan(coreEngine, stylePlan, { snapshotLabelSk: "Real-media verifikácia — Style Studio" });
  const after = fingerprintStyleState(coreEngine.getProject());

  console.log("\n--- APPLY REPORT ---");
  console.log(styleApplyReportTextSk(report));
  line("aplikované / dodržané / nevykonané", `${report.appliedCount} / ${report.honoredCount} / ${report.skippedCount}`);
  line("časová os zmenená", report.timelineChanged);
  line("audio nedotknuté (bajty)", report.audioPreserved);
  line("klipy video/b-roll/titulky pred", `${before.videoClips}/${before.brollClips}/${before.captionClips}`);
  line("klipy video/b-roll/titulky po", `${after.videoClips}/${after.brollClips}/${after.captionClips}`);
  line("markery pred/po", `${before.markers}/${after.markers}`);
  line("rozhodnutia v projekte pred/po", `${before.decisions}/${after.decisions}`);
  line("snapshot verzia", report.snapshotVersionId ?? "—");

  const appliedClips = coreEngine.getProject().tracks.filter((t) => t.type === "caption" || t.type === "b-roll").flatMap((t) => t.clips);
  console.log("\nReálne klipy vytvorené Apply:");
  for (const c of appliedClips) {
    console.log(`  • ${c.type} @ ${c.timelineStart}s (${c.duration}s) → ${c.textConfig?.content ?? c.name} [asset: ${c.assetId ?? "—"}]`);
  }

  // --- 5. ROLLBACK --------------------------------------------------------
  const rollback = rollbackStyleApply(coreEngine, report);
  const restored = fingerprintStyleState(coreEngine.getProject());
  console.log("\n--- ROLLBACK ---");
  line("ok", rollback.ok);
  line("obnovené presne (bajty)", rollback.restoredExactly);
  line("časová os späť", restored.visualJson === before.visualJson);
  line("audio späť", restored.audioJson === before.audioJson);
  line("klipy po rollbacku (video/b-roll/titulky)", `${restored.videoClips}/${restored.brollClips}/${restored.captionClips}`);

  // --- 6. Súhrn -----------------------------------------------------------
  const ok =
    report.ok &&
    report.timelineChanged &&
    report.audioPreserved &&
    report.snapshotVersionId !== null &&
    rollback.ok &&
    rollback.restoredExactly;
  console.log("\n" + "=".repeat(78));
  console.log(ok ? "VÝSLEDOK: REAL-MEDIA PIPELINE PASS (apply zmenil projekt, audio nedotknuté, rollback presný)" : "VÝSLEDOK: NEPREŠLO — pozri riadky vyššie");
  console.log("Poznámka: toto overuje ENGINE a canonical mutáciu na reálnych dátach.");
  console.log("Neznamená to, že je overený prehliadač ani že je hotový export/preview.");
  console.log("=".repeat(78));
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error("\nVERIFIKÁCIA ZLYHALA:", (err as Error)?.message ?? err);
  process.exit(1);
});

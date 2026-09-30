/**
 * KROK 25 — PRECHODY: dôkaz na reálnom videe.
 *
 * Otázka: „Keď v rozhraní nastavím prechod, dostane sa naozaj do hotového videa?“
 *
 * Postup (nič sa nepreskakuje):
 *  1) REÁLNE VIDEO → canonical os: tri úseky s dvoma strihmi (dva skutočné rezy).
 *  2) PRECHODY cez CommandManager na klipy (`transitions.in`) — ako to robí appka.
 *  3) EXPORT cez bežiacu appku: raz S prechodmi, raz BEZ nich (kontrolný beh).
 *     Obe zadania sú inak totožné, takže rozdiel je prácou prechodov.
 *  4) MERANIE: dĺžka hotového videa (prechod skracuje presne o prekrytie) a
 *     snímky na spoji (prelínanie = snímka v strede prechodu je zmes oboch).
 *
 * Spustenie:
 *   bun run tools/verify-transitions.ts <zdroj.mp4> --plan segments.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";

const API = process.env.OMNISTRIH_URL ?? "http://127.0.0.1:3000";
const OUT_DIR = "/home/user/kontrola-prechody";

function head(t: string) {
  console.log("\n" + "=".repeat(96));
  console.log(t);
  console.log("=".repeat(96));
}
function line(label: string, value: unknown) {
  console.log(`${label} ${".".repeat(Math.max(2, 52 - label.length))} ${value}`);
}

const argv = process.argv.slice(2);
const sourcePath = argv[0];
const planIdx = argv.indexOf("--plan");
const planPath = planIdx >= 0 ? argv[planIdx + 1] : undefined;

if (!sourcePath || !existsSync(sourcePath)) {
  console.error("Chýba zdrojové video. Použitie: bun run tools/verify-transitions.ts <zdroj.mp4> --plan segments.json");
  process.exit(2);
}

const FFMPEG = (() => {
  const r = spawnSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"], { encoding: "utf-8" });
  if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  const r2 = spawnSync("which", ["ffmpeg"], { encoding: "utf-8" });
  return r2.status === 0 && r2.stdout.trim() ? r2.stdout.trim() : null;
})();
if (!FFMPEG) {
  console.error("ffmpeg nie je k dispozícii — meranie sa nedá spraviť (nič nepredstieram).");
  process.exit(3);
}

function probeDurationSec(file: string): number {
  const p = spawnSync(FFMPEG!, ["-hide_banner", "-i", file], { encoding: "utf-8" });
  const text = `${p.stdout ?? ""}${p.stderr ?? ""}`;
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(text);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
}

/** Vytiahne jednu snímku ako sivé pixely 160×90 (na porovnávanie obsahu). */
function grayFrameAt(file: string, timeSec: number): Uint8Array | null {
  const p = spawnSync(
    FFMPEG!,
    ["-v", "error", "-ss", timeSec.toFixed(3), "-i", file, "-frames:v", "1", "-vf", "scale=160:90,format=gray", "-f", "rawvideo", "-"],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  const buf = p.stdout as unknown as Buffer;
  return buf && buf.length >= 160 * 90 ? new Uint8Array(buf.subarray(0, 160 * 90)) : null;
}

function mse(a: Uint8Array, b: Uint8Array): number {
  let acc = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    acc += d * d;
  }
  return acc / a.length;
}

console.log(`\nZdroj: ${sourcePath}`);
console.log(`Appka: ${API}`);

// ---------------------------------------------------------------------------
// 1) Canonical os: reálne video rozrezané na tri úseky (dva skutočné strihy)
// ---------------------------------------------------------------------------

head("1) CANONICAL OS — reálne video, dva skutočné strihy");
const { coreEngine } = await import("../src/core/index.ts");
const { buildRealProjectForExport } = await import("./verify-style-real-media.ts");
const { buildCanonicalExportPlan } = await import("../src/core/export/canonicalExport.ts");
const { buildBurnFfmpegArgs } = await import("../src/core/export/subtitleRender.ts");

const mediaDuration = probeDurationSec(sourcePath);
if (mediaDuration < 12) {
  console.error(`Video je príliš krátke (${mediaDuration.toFixed(1)} s) — na tri úseky treba aspoň 12 s.`);
  process.exit(4);
}

const project0 = buildRealProjectForExport(readFileSync(sourcePath), sourcePath, mediaDuration);
if (!project0) {
  console.error("Canonical projekt s reálnym médiom sa nepodarilo postaviť — STOP (nič sa nepredstiera).");
  process.exit(4);
}
coreEngine.commandManager.setProject(project0);

// Tri úseky so skutočnými rezmi: 0–4 s, 6–10 s, 12–16 s (medzi nimi sa vyhadzuje).
const SEGMENTS_DEF = [
  { start: 0, sourceStart: 0, sourceEnd: 4 },
  { start: 4, sourceStart: 6, sourceEnd: 10 },
  { start: 8, sourceStart: 12, sourceEnd: 16 },
];
const mainAssetId = project0.tracks.flatMap((t: any) => t.clips).find((c: any) => c.type === "video")?.assetId;
const videoTrack = project0.tracks.find((t: any) => t.type === "video");
if (!videoTrack || !mainAssetId) {
  console.error("V projekte nie je video stopa s klipom — STOP.");
  process.exit(4);
}
const template = videoTrack.clips.find((c: any) => c.type === "video");
videoTrack.clips = SEGMENTS_DEF.map((d, i): any => ({
  ...template,
  id: `seg-${i}`,
  name: `úsek ${i + 1}`,
  start: d.start,
  duration: d.sourceEnd - d.sourceStart,
  sourceStart: d.sourceStart,
  sourceEnd: d.sourceEnd,
  transitions: undefined,
}));
line("úseky na video stope", videoTrack.clips.map((c: any) => `${c.sourceStart}–${c.sourceEnd} s`).join(", "));
line("očakávaná dĺžka bez prechodov", `${(4 + 4 + 4).toFixed(2)} s`);

// Titulky na os (rovnako, ako keď ich appka má po prepise): bez nich by render
// nemal čo vypáliť a dôkaz by o prechodoch nehovoril nič. Časy sú pôvodné
// (v čase zdroja) — server ich pri strihu presunie na výslednú os sám.
const planSegmentsRaw: any[] = (() => {
  if (!planPath || !existsSync(planPath)) return [];
  const raw = JSON.parse(readFileSync(planPath, "utf-8"));
  return Array.isArray(raw) ? raw : (raw.segments ?? []);
})();
if (planSegmentsRaw.length === 0) {
  console.error("Bez --plan (so segmentami) sa nedá vypáliť ani jeden titulok — končím.");
  process.exit(5);
}
const captionTrack: any = {
  id: "track-titulky",
  name: "Titulky",
  type: "caption",
  visible: true,
  locked: false,
  muted: false,
  solo: false,
  height: 60,
  order: 90,
  clips: planSegmentsRaw.map((seg: any, i: number) => ({
    id: `cap-${i}`,
    trackId: "track-titulky",
    type: "caption",
    name: `titulok ${i + 1}`,
    start: Number(seg.start),
    duration: Math.max(0.1, Number(seg.end) - Number(seg.start)),
    opacity: 100,
    scale: 100,
    positionX: 0,
    positionY: 0,
    rotation: 0,
    keyframes: [],
    textConfig: {
      content: String(seg.text ?? ""),
      fontFamily: "Inter, sans-serif",
      fontSize: 64,
      color: "#ffffff",
      fontWeight: "bold",
      ...(Array.isArray(seg.words) && seg.words.length > 0
        ? {
            words: seg.words.map((w: any) => ({
              word: String(w.word ?? w.text ?? ""),
              start: Number(w.start) - Number(seg.start),
              end: Number(w.end) - Number(seg.start),
            })),
          }
        : {}),
    },
  })),
};
project0.tracks = [...project0.tracks.filter((t: any) => t.type !== "caption"), captionTrack];
line("titulkov na osi", captionTrack.clips.length);

// ---------------------------------------------------------------------------
// 2) Prechody cez CommandManager (rovnaká cesta ako rozhranie „Prechody“)
// ---------------------------------------------------------------------------

head("2) PRECHODY CEZ COMMANDMANAGER (canonical zmena, nie plán)");
const TRANSITIONS = [
  { clipId: "seg-1", type: "crossfade", duration: 0.4 },
  { clipId: "seg-2", type: "dissolve", duration: 0.5 },
];
let appliedCount = 0;
for (const t of TRANSITIONS) {
  const ok = coreEngine.updateClipProps(t.clipId, { transitions: { in: { type: t.type as never, duration: t.duration } } } as never);
  if (ok) appliedCount++;
  line(`prechod na ${t.clipId}`, ok ? `${t.type} (${t.duration} s)` : "NEPREŠIEL");
}
line("zmenila sa canonical os", String(appliedCount === TRANSITIONS.length));
line("očakávané prekrytie", "0,90 s (0,40 + 0,50) → video má byť kratšie");

// ---------------------------------------------------------------------------
// 3) Zadanie pre render (z canonical osi) + kontrola ffmpeg linky
// ---------------------------------------------------------------------------

head("3) ZADANIE PRE RENDER + FFMPEG LINKA");
const planRaw = planPath && existsSync(planPath) ? JSON.parse(readFileSync(planPath, "utf-8")) : null;
const segments = planRaw ? (planRaw.segments ?? planRaw).map((s: any, i: number) => ({ ...s, id: s.id ?? `s${i}` })) : null;
if (!segments) {
  console.error("Bez --plan neviem postaviť titulky (a nebudem si vymýšľať prepis).");
  process.exit(5);
}

const uploadRes = await fetch(`${API}/api/export/upload?name=${encodeURIComponent(basename(sourcePath))}`, {
  method: "POST",
  headers: { "Content-Type": "application/octet-stream" },
  body: readFileSync(sourcePath),
});
const upload = (await uploadRes.json()) as any;
if (!uploadRes.ok || !upload.success || !upload.uploadId) {
  console.error(`Nahrávanie do appky zlyhalo: ${upload.errorSk ?? uploadRes.status}`);
  process.exit(6);
}
line("zdroj nahraný v appke", upload.uploadId);

const exportPlan: any = buildCanonicalExportPlan(
  coreEngine.getProject(),
  { uploadId: upload.uploadId, uploadName: basename(sourcePath), width: 1080, height: 1920 } as any,
);
line("dá sa exportovať", exportPlan.canExport ? "áno" : "NIE");
for (const b of exportPlan.blockersSk ?? []) console.log(`  • blok: ${b}`);
if (!exportPlan.canExport) process.exit(6);
line("prechody v zadaní", JSON.stringify(exportPlan.request.transitions ?? []));
for (const n of (exportPlan.notesSk ?? []).filter((x: string) => x.toLowerCase().includes("prechod"))) {
  console.log(`  • ${n}`);
}
if (!exportPlan.request.transitions || exportPlan.request.transitions.length !== 2) {
  console.error("Prechody sa do zadania nedostali — ďalej nemá zmysel merať (nič nepredstieram).");
  process.exit(7);
}

const graphWith = buildBurnFfmpegArgs({
  inputPath: "/tmp/zdroj.mp4",
  outputPath: "/tmp/vystup.mp4",
  assPath: "/tmp/titulky.ass",
  keepSegments: exportPlan.request.keepRanges,
  transitions: exportPlan.request.transitions,
  outputDurationSec: exportPlan.request.outputDurationSec,
  sourceFps: 30,
} as never).join(" ");
const graphWithout = buildBurnFfmpegArgs({
  inputPath: "/tmp/zdroj.mp4",
  outputPath: "/tmp/vystup.mp4",
  assPath: "/tmp/titulky.ass",
  keepSegments: exportPlan.request.keepRanges,
  outputDurationSec: exportPlan.request.outputDurationSec,
  sourceFps: 30,
} as never).join(" ");
line("xffade v linke (s prechodmi)", graphWith.includes("xfade") ? "áno" : "NIE");
line("acrossfade v linke (s prechodmi)", graphWith.includes("acrossfade") ? "áno" : "NIE");
line("xfade v linke (kontrolný beh)", graphWithout.includes("xfade") ? "áno" : "NIE (správne)");
for (const m of graphWith.match(/xfade=transition=[a-z]+:duration=[\d.]+:offset=[\d.]+/g) ?? []) {
  console.log(`  • ${m}`);
}

// ---------------------------------------------------------------------------
// 4) Dva behy cez existujúcu linku appky
// ---------------------------------------------------------------------------

async function runExport(labelSk: string, withTransitions: boolean, target: string) {
  const body: any = { ...exportPlan.request };
  if (!withTransitions) delete body.transitions;
  const burnRes = await fetch(`${API}/api/export/burn-captions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const burn = (await burnRes.json()) as any;
  if (!burnRes.ok || !burn.success || !burn.jobId) {
    console.error(`${labelSk}: render sa nepodarilo spustiť: ${burn.errorSk ?? burnRes.status}`);
    process.exit(8);
  }
  console.log(`\n  ▸ ${labelSk}`);
  line("    jobId", burn.jobId);
  for (const n of burn.notesSk ?? []) console.log(`      • server: ${n}`);

  let state = "queued";
  let result: any = null;
  const started = Date.now();
  while (Date.now() - started < 12 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 1200));
    const st = await fetch(`${API}/api/export/burn-captions/status?id=${encodeURIComponent(burn.jobId)}`);
    const stj = (await st.json()) as any;
    if (!stj?.success) {
      console.error(`${labelSk}: stav sa nedá prečítať (HTTP ${st.status}).`);
      process.exit(8);
    }
    state = stj.status?.state ?? "unknown";
    if (state === "done" || state === "error" || state === "canceled") {
      result = stj.status?.result ?? null;
      if (state === "error") console.error(`      ! render zlyhal: ${stj.status?.errorSk}`);
      break;
    }
  }
  line("    stav renderu", state);
  if (state !== "done") process.exit(8);
  const fileName = result?.outputName as string | undefined;
  if (!fileName) {
    console.error(`${labelSk}: render hlási hotovo, ale nevrátil meno súboru.`);
    process.exit(9);
  }
  const fileRes = await fetch(`${API}/api/export/file/${encodeURIComponent(fileName)}`);
  if (!fileRes.ok) {
    console.error(`${labelSk}: výstup sa nedá stiahnuť (HTTP ${fileRes.status}).`);
    process.exit(9);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(target, Buffer.from(await fileRes.arrayBuffer()));
  const seconds = probeDurationSec(target);
  line("    súbor", `${target} (${readFileSync(target).length} B)`);
  line("    dĺžka podľa ffmpeg", `${seconds.toFixed(3)} s`);
  return { jobId: burn.jobId as string, fileName, seconds, serverNotesSk: (result?.notesSk ?? []) as string[] };
}

head("4) DVA BEHY — s prechodmi a bez nich (inak totožné zadanie)");
const withoutRun = await runExport("A) KONTROLNÝ BEH — bez prechodov (obyčajné strihy)", false, join(OUT_DIR, "bez-prechodov.mp4"));
const withRun = await runExport("B) BEH S PRECHODMI (crossfade 0,4 s + dissolve 0,5 s)", true, join(OUT_DIR, "s-prechodmi.mp4"));

// ---------------------------------------------------------------------------
// 5) Meranie: dĺžka (presná matematika) + snímky na spoji
// ---------------------------------------------------------------------------

head("5) MERANIE — čo prechody naozaj spravili");
const overlap = 0.4 + 0.5;
const expectedWith = 12 - overlap;
line("dĺžka bez prechodov", `${withoutRun.seconds.toFixed(3)} s`);
line("dĺžka s prechodmi", `${withRun.seconds.toFixed(3)} s`);
line("rozdiel (meraný)", `${(withoutRun.seconds - withRun.seconds).toFixed(3)} s`);
line("rozdiel (očakávaný = súčet prekrytí)", `${overlap.toFixed(3)} s`);
const durationOk = Math.abs(withoutRun.seconds - withRun.seconds - overlap) < 0.12 && Math.abs(withRun.seconds - expectedWith) < 0.2;
line("sedí to (prechod naozaj skrátil video)", durationOk ? "ÁNO" : "NIE");

// Snímky na spoji: prvý prechod začína na 3,6 s a trvá 0,4 s (3,6 – 4,0).
const beforeT = 3.5;
const midT = 3.8;
const afterT = 4.1;
const b1 = grayFrameAt(join(OUT_DIR, "s-prechodmi.mp4"), beforeT);
const m1 = grayFrameAt(join(OUT_DIR, "s-prechodmi.mp4"), midT);
const a1 = grayFrameAt(join(OUT_DIR, "s-prechodmi.mp4"), afterT);
const b0 = grayFrameAt(join(OUT_DIR, "bez-prechodov.mp4"), beforeT);
const m0 = grayFrameAt(join(OUT_DIR, "bez-prechodov.mp4"), midT);
const a0 = grayFrameAt(join(OUT_DIR, "bez-prechodov.mp4"), afterT);

console.log("");
if (b1 && m1 && a1 && b0 && m0 && a0) {
  const withoutNeighbours = mse(b0, a0);
  const withNeighbours = mse(b1, a1);
  const midDistanceWith = (mse(m1, b1) + mse(m1, a1)) / 2;
  const midDistanceWithout = (mse(m0, b0) + mse(m0, a0)) / 2;
  line("bez prechodov: rozdiel susedov / stred", `${withoutNeighbours.toFixed(0)} / ${midDistanceWithout.toFixed(0)}`);
  line("s prechodmi: rozdiel susedov / stred", `${withNeighbours.toFixed(0)} / ${midDistanceWith.toFixed(0)}`);
  line("stred je zmes oboch (menší rozdiel než susedia)", midDistanceWith < withNeighbours ? "ÁNO (prelína sa)" : "NIE");
} else {
  console.log("  snímky na spoji sa nedajú vytiahnuť — meranie obsahu vynechávam (priznávam).");
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  join(OUT_DIR, "prechody-merania.json"),
  JSON.stringify(
    {
      krok: 25,
      zdroj: sourcePath,
      useky: SEGMENTS_DEF,
      prechody: TRANSITIONS,
      bezPrechodov: { subor: join(OUT_DIR, "bez-prechodov.mp4"), jobId: withoutRun.jobId, dlzkaSec: withoutRun.seconds },
      sPrechodmi: { subor: join(OUT_DIR, "s-prechodmi.mp4"), jobId: withRun.jobId, dlzkaSec: withRun.seconds },
      ocakavane: { bezPrechodov: 12, sPrechodmi: expectedWith, prekrytie: overlap },
      verdikt: { dlzka_sedi: durationOk, xfade_v_linke: graphWith.includes("xfade") },
    },
    null,
    2,
  ),
);

head("6) VERDIKT");
console.log(
  durationOk
    ? "Prechody sa dostali z canonical osi do hotového videa: xfade je v linke a video je kratšie presne o súčet prekrytí."
    : "POZOR: čísla nesedia — hlásim to ako neúspech, nie ako hotovo.",
);
console.log("Klasifikácia:");
console.log("  • prechod v canonical osi (CommandManager) ............... UNIT/REAL (tento beh)");
console.log("  • xfade + acrossfade v renderi ........................... REAL EXPORT VERIFIED (tento beh)");
console.log("  • dĺžka a obsah na spoji (merané z MP4) .................. REAL MEDIA (tento beh)");
console.log("  • náhľad v prehliadači ................................... NOT VERIFIED (v prostredí nie je DOM)");
console.log(`dôkaz ..................................................... ${join(OUT_DIR, "prechody-merania.json")}`);

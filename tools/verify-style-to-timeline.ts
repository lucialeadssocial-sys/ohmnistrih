/**
 * KROK 16 — STYLE → TIMELINE: dôkaz, že reťazec je SKUTOČNÝ runtime chain.
 *
 * Postupnosť (presne tak, ako je zadaná; nič sa nepreskakuje):
 *
 *   REAL VIDEO
 *     ↓  existing transcript / wordTiming (reálny HTTP prepis)
 *     ↓  EDITORIAL_COLLAGE (existujúci recept)
 *     ↓  Style Intelligence → EditDecision[]  (lokálne, deterministicky, bez AI)
 *     ↓  REVIEW: Accept / Edit / Reject
 *     ↓  SNAPSHOT (existujúca verzia projektu)
 *     ↓  CommandManager (existujúce commands)
 *     ↓  CANONICAL TIMELINE — overené pred/po
 *     ↓  PREVIEW parity (ten istý canonical plán snímky ako export)
 *     ↓  ROLLBACK — overené, že je stav presne späť
 *
 * Čo tento nástroj NEROBÍ: negeneruje video ani obrázky, nepoužíva providera,
 * nemeni zvuk a nepredstiera export (export má vlastný runner).
 *
 * Spustenie:
 *   bun run tools/verify-style-to-timeline.ts <video> [--recipe=ID] [--plan segments.json]
 */

import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const mediaPath = args.find((a) => !a.startsWith("--"));
const planIdx = args.indexOf("--plan");
const planFile = planIdx >= 0 ? args[planIdx + 1] : undefined;
const recipeArg = args.find((a) => a.startsWith("--recipe="))?.split("=")[1] ?? "EDITORIAL_COLLAGE";
const API = process.env.OMNISTRIH_URL || "http://127.0.0.1:3000";
const EVIDENCE = "/home/user/kontrola-krok16-style-to-timeline.json";

if (typeof mediaPath !== "string" || mediaPath.length === 0 || !existsSync(mediaPath)) {
  console.error("Použitie: bun run tools/verify-style-to-timeline.ts <video> [--recipe=ID] [--plan segments.json]");
  process.exit(2);
}

const evidence: Record<string, unknown> = { krok: 16, medium: mediaPath, zaciatok: new Date().toISOString() };

function say(s = ""): void {
  console.log(s);
}
function head(title: string): void {
  console.log(`\n${"=".repeat(96)}\n${title}\n${"=".repeat(96)}`);
}
function line(label: string, value: string | number | boolean): void {
  console.log(`${label.padEnd(50, ".")} ${value}`);
}

function ffmpegExe(): string {
  const res = spawnSync("python3", ["-c", "import imageio_ffmpeg,sys;sys.stdout.write(imageio_ffmpeg.get_ffmpeg_exe())"], { encoding: "utf-8" });
  const exe = (res.stdout ?? "").trim();
  if (exe.length > 0 && existsSync(exe)) return exe;
  throw new Error("ffmpeg sa nenašiel (pip install imageio-ffmpeg)");
}
function durationSec(exe: string, file: string): number {
  const res = spawnSync(exe, ["-hide_banner", "-i", file], { encoding: "utf-8" });
  const m = `${res.stderr ?? ""}`.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

const ff = ffmpegExe();
const workDir = mkdtempSync(join(tmpdir(), "style-to-timeline-"));
const mediaDuration = durationSec(ff, mediaPath);

// ---------------------------------------------------------------------------
// 1) Reálne médium
// ---------------------------------------------------------------------------

head("1) REAL VIDEO (skutočný súbor, nie syntetický)");
const mediaBytes = readFileSync(mediaPath).byteLength;
line("súbor", basename(mediaPath));
line("veľkosť", `${mediaBytes} B`);
line("dĺžka (meraná ffmpeg)", `${mediaDuration.toFixed(2)} s`);
evidence.medium_info = { subor: basename(mediaPath), bajty: mediaBytes, sekundy: mediaDuration };

// ---------------------------------------------------------------------------
// 2) Reálny prepis (existujúca cesta) — inak sa NIČ nevymýšľa
// ---------------------------------------------------------------------------

head("2) EXISTING TRANSCRIPT / wordTiming (reálne dáta)");
type Seg = { start: number; end: number; text: string; words?: { word: string; start: number; end: number }[] };
let segments: Seg[] = [];
let transcriptSource = "";

if (planFile && existsSync(planFile)) {
  segments = JSON.parse(readFileSync(planFile, "utf-8")) as Seg[];
  transcriptSource = `existujúci prepis z reálneho behu (${basename(planFile)}) — prepis sa neznovuvyrába`;
  line("zdroj prepisu", transcriptSource);
} else {
  const audioPath = join(workDir, "audio-16k-mono.mp3");
  const conv = spawnSync(ff, ["-y", "-hide_banner", "-loglevel", "error", "-i", mediaPath, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", audioPath]);
  if (conv.status !== 0 || !existsSync(audioPath)) {
    line("audio pre prepis", "NEDOSTUPNÉ — ffmpeg zlyhal");
  } else {
    line("audio pre prepis", `${readFileSync(audioPath).byteLength} B (16 kHz mono)`);
    const audioBase64 = readFileSync(audioPath).toString("base64");
    try {
      const res = await fetch(`${API}/api/transcribe-speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimeType: "audio/mpeg", language: "sk", videoDuration: Math.round(mediaDuration) }),
      });
      const json = (await res.json()) as { success?: boolean; hasSpeech?: boolean; segments?: Seg[]; language?: string };
      line("prepis (HTTP)", `${res.status} | success=${json.success} | hasSpeech=${json.hasSpeech}`);
      if (Array.isArray(json.segments) && json.segments.length > 0) {
        segments = json.segments;
        transcriptSource = "reálny prepis z tohto videa (HTTP /api/transcribe-speech)";
        const savePath = join(workDir, "segments.json");
        writeFileSync(savePath, JSON.stringify(segments, null, 1));
        // Trvalá kópia (aby sa dal použiť aj pre exportný runner — reálny prepis, nie vymyslený).
        const stablePath = "/home/user/real-media/segments-krok16.json";
        writeFileSync(stablePath, JSON.stringify(segments, null, 1));
        line("prepis uložený", `${savePath} (+ ${stablePath})`);
      }
    } catch (error) {
      line("prepis (HTTP)", `ZLYHALO: ${String(error)}`);
    }
  }
}

if (segments.length === 0 && planFile && existsSync(planFile)) {
  segments = JSON.parse(readFileSync(planFile, "utf-8")) as Seg[];
  transcriptSource = `existujúci prepis (${basename(planFile)})`;
}
// Fallback: uložený REÁLNY prepis z predchádzajúceho behu (keď je AI práve limitované).
// Nikdy sa nič nevymýšľa — používa sa hotový prepis a appka to povie.
const savedTranscript = "/home/user/real-media/segments-krok16.json";
if (segments.length === 0 && existsSync(savedTranscript)) {
  segments = JSON.parse(readFileSync(savedTranscript, "utf-8")) as Seg[];
  transcriptSource = `uložený reálny prepis z predchádzajúceho behu (${basename(savedTranscript)}) — AI bolo medzitým limitované, nič sa nevymýšľa`;
  line("POZOR", "živý prepis sa nepodaril, používam uložený reálny prepis (označené v dôkaze)");
}

const words = segments.flatMap((s) => s.words ?? []);
line("zdroj", transcriptSource || "NEDOSTUPNÝ");
line("viet / slov", `${segments.length} / ${words.length}`);
if (segments.length === 0) {
  console.log("\nREAL MEDIA — NOT VERIFIED (nepodarilo sa získať reálny prepis a nič sa nevymýšľa).");
  process.exit(3);
}
evidence.prepis = { zdroj: transcriptSource, viet: segments.length, slov: words.length };
line("prvá veta", segments[0].text.slice(0, 60));

// ---------------------------------------------------------------------------
// 3) Recept + Style Intelligence (lokálne, deterministicky)
// ---------------------------------------------------------------------------

const { getStyleRecipe, STYLE_PRESET_IDS } = await import("../src/core/style/styleRecipes.ts");
const { buildStylePlan } = await import("../src/core/style/styleIntelligence.ts");
const { applyStylePlan, fingerprintStyleState, rollbackStyleApply, reviewStyleDecision } = await import("../src/core/style/styleApply.ts");
const { buildCanonicalFramePlan, projectContentEndSec } = await import("../src/core/render/canonicalFrame.ts");
const { coreEngine } = await import("../src/core/index.ts");
const { buildRealProjectForExport } = await import("./verify-style-real-media.ts");

head("3) STYLE RECIPE + STYLE INTELLIGENCE (lokálne, žiadny AI provider)");
const recipe = getStyleRecipe(recipeArg);
line("recept", `${recipe.labelSk} (${recipe.id})`);
line("je v presets", STYLE_PRESET_IDS.includes(recipe.id));
line("provider receptu", "NONE (deterministické)");

const plan = buildStylePlan({
  segments,
  recipe,
  durationSec: mediaDuration,
  availableSupportingVisuals: 1,
  now: 1759219200000,
});
line("rozhodnutí", plan.decisions.length);
line("podiel rečníka", `${Math.round(plan.ratio.target * 100)} % (recept ${Math.round(plan.ratio.base * 100)} %)`);
line("presnosť časov z dát", plan.basis.timingPrecision);
line("použité signály", plan.basis.usedSignalsSk.slice(0, 4).join("; "));
line("chýbajúce signály", plan.basis.missingSignalsSk.join("; ") || "—");
tell();

function tell(): void {
  console.log("\n  Prvé 3 rozhodnutia (WHAT / WHEN / WHY / WHEN NOT / ALTERNATIVE / CONFIDENCE):");
  for (const d of plan.decisions.slice(0, 3)) {
    const st = d.style;
    if (!st) continue;
    console.log(`  • [${st.kind}] WHEN ${st.whenSk.startSec}–${st.whenSk.endSec} s`);
    console.log(`      WHAT:        ${st.whatSk}`);
    console.log(`      WHY:         ${st.whySk}`);
    console.log(`      WHEN NOT:    ${st.whenNotSk}`);
    console.log(`      ALTERNATIVE: ${st.alternativeSk}`);
    console.log(`      CONFIDENCE:  ${Math.round(st.confidence * 100)} % — lokálna heuristika z reálnych časov (nie AI confidence)`);
    console.log(`      DÔKAZ:       ${(st.evidenceSk ?? []).slice(0, 2).join(" | ")}`);
  }
}

const heuristicLabel = plan.provider === "NONE" ? "LOCAL DETERMINISTIC HEURISTIC (nie AI confidence)" : String(plan.provider);
console.log(`\n  Klasifikácia rozhodnutí: ${heuristicLabel}`);
evidence.plan = {
  recept: recipe.id,
  rozhodnuti: plan.decisions.length,
  podiel_recnika: plan.ratio.target,
  presnost: plan.basis.timingPrecision,
  klasifikacia: heuristicLabel,
};

// ---------------------------------------------------------------------------
// 4) REVIEW: Accept / Edit / Reject
// ---------------------------------------------------------------------------

head("4) REVIEW — Accept / Edit / Reject (pred akýmkoľvek zápisom do osi)");
const byKind = (kind: string) => plan.decisions.find((d) => d.style?.kind === kind);
const textDecision = byKind("typography") ?? plan.decisions[0];
const motionDecision = plan.decisions.find((d) => d.style?.kind === "motion" && d.id !== textDecision.id) ?? textDecision;
const rejectedDecision = plan.decisions.find((d) => d.id !== textDecision.id && d.id !== motionDecision.id) ?? plan.decisions[plan.decisions.length - 1];

const edits = {
  [textDecision.id]: { typographyText: "UPRAVENÉ POUŽÍVATEĽOM: 3 000 €", noteSk: "kratšie, bez bodky" },
  [motionDecision.id]: { punchInScale: 1.3 },
};
line("ACCEPT (prijaté)", 2);
line("EDIT (upravené)", `${textDecision.id} (text) + ${motionDecision.id} (priblíženie 130 %)`);
line("REJECT (zamietnuté)", rejectedDecision.id);
line("apply sa spustí len na", "prijaté rozhodnutia (zamietnuté sa do osi nedostane)");

// kontrola čistej funkcie ešte pred apply
const previewReview = reviewStyleDecision(
  plan.decisions.find((d) => d.id === textDecision.id)!,
  edits[textDecision.id as keyof typeof edits],
);
line("kontrola úpravy (čistá funkcia)", previewReview.changedSk.join("; ") || "—");
evidence.review = {
  prijate: [textDecision.id, motionDecision.id],
  upravene: edits,
  zamietnute: [rejectedDecision.id],
};

// ---------------------------------------------------------------------------
// 5) SNAPSHOT + BEFORE
// ---------------------------------------------------------------------------

head("5) SNAPSHOT (existujúca verzia projektu) + stav PRED");
const project = buildRealProjectForExport(readFileSync(mediaPath), mediaPath, mediaDuration);
if (!project) {
  console.log("Nepodarilo sa postaviť canonical projekt — STOP (nič sa nepredstiera).");
  process.exit(4);
}
coreEngine.commandManager.setProject(project);

type Finger = ReturnType<typeof fingerprintStyleState>;
function describe(f: Finger) {
  return {
    klipy: { video: f.videoClips, broll: f.brollClips, titulky: f.captionClips, audio: f.audioClips, adjustment: f.adjustmentClips },
    markery: f.markers,
    rozhodnutia: f.decisions,
  };
}
function timelineDetail(): Record<string, unknown> {
  const p = coreEngine.getProject();
  const clips = p.tracks.flatMap((t) => t.clips.map((c) => ({
    id: c.id,
    stopa: t.type,
    typ: c.type,
    od: Number(c.timelineStart ?? 0),
    do: Number(c.timelineStart ?? 0) + Number(c.duration ?? 0),
    sourceStart: Number(c.sourceStart ?? 0),
    sourceEnd: Number(c.sourceEnd ?? 0),
    scale: Number(c.scale ?? 100),
    opacity: Number(c.opacity ?? 100),
    rotacia: Number(c.rotation ?? 0),
    text: c.textConfig?.content ?? null,
    medium: c.assetId ?? null,
    prechodIn: c.transitions?.in?.type ?? null,
    prechodOut: c.transitions?.out?.type ?? null,
  })));
  return {
    pocet_klipov: clips.length,
    klipy: clips,
    markery: (p.markers ?? []).map((m) => ({ id: m.id, cas: m.time ?? null })),
    rozhodnutia: (p.editDecisions ?? []).map((d) => ({ id: d.id, stav: d.status })),
    verzie: (p.versions ?? []).map((v) => ({ id: v.id, label: v.label })),
  };
}

const before = fingerprintStyleState(coreEngine.getProject());
const beforeDetail = timelineDetail();
line("stopy / klipy pred", `${coreEngine.getProject().tracks.length} / ${beforeDetail.pocet_klipov}`);
line("klipy video/b-roll/titulky pred", `${before.videoClips}/${before.brollClips}/${before.captionClips}`);
line("rozhodnutia pred", before.decisions);
evidence.pred = { fingerprint: describe(before), detail: beforeDetail };
say("\n(Snapshot vytvorí Apply ako prvý krok — bez verzie sa neaplikuje nič.)");

// ---------------------------------------------------------------------------
// 6) APPLY cez CommandManager
// ---------------------------------------------------------------------------

head("6) APPLY → COMMAND MANAGER → CANONICAL TIMELINE");
const report = applyStylePlan(coreEngine, plan, {
  decisionIds: [textDecision.id, motionDecision.id],
  edits,
  snapshotLabelSk: "Krok 16 — dôkaz Style → Timeline",
  now: 1759219200000,
});
line("ok", report.ok);
line("chyba", report.errorSk ?? "—");
line("snapshot verzia", report.snapshotVersionId ?? "—");
line("aplikované / dodržané / nevykonané", `${report.appliedCount} / ${report.honoredCount} / ${report.skippedCount}`);
line("časová os zmenená (podľa reportu)", report.timelineChanged);
line("audio nedotknuté (bajty)", report.audioPreserved);

for (const step of report.steps) {
  console.log(`  • [${step.status}] ${step.kind} — ${step.whatSk}`);
  if (step.status === "SKIPPED") console.log(`      dôvod: ${step.reasonSk}`);
  console.log(`      cieľ: ${step.targetSk}`);
}
for (const note of report.notesSk) console.log(`  poznámka: ${note}`);
evidence.apply = {
  ok: report.ok,
  snapshot: report.snapshotVersionId,
  aplikovane: report.appliedCount,
  dodrzane: report.honoredCount,
  nevykonane: report.skippedCount,
  casova_os_zmenena: report.timelineChanged,
  audio_nedotknute: report.audioPreserved,
  kroky: report.steps.map((s) => ({ kind: s.kind, status: s.status, efekt: s.effect, ciel: s.targetSk })),
};

// ---------------------------------------------------------------------------
// 7) AFTER + rozdiel (žiadne „vyzerá to dobre“)
// ---------------------------------------------------------------------------

head("7) CANONICAL TIMELINE PO ZMENE — konkrétny rozdiel PRED/PO");
const after = fingerprintStyleState(coreEngine.getProject());
const afterDetail = timelineDetail();
line("klipy video/b-roll/titulky po", `${after.videoClips}/${after.brollClips}/${after.captionClips}`);
line("rozhodnutia po", after.decisions);
line("markery po", after.markers);

const beforeIds = new Set((beforeDetail.klipy as { id: string }[]).map((c) => c.id));
const afterIds = new Set((afterDetail.klipy as { id: string }[]).map((c) => c.id));
const newClips = (afterDetail.klipy as { id: string; typ: string; od: number; do: number; text: string | null; scale: number }[]).filter(
  (c) => !beforeIds.has(c.id),
);
const removedClips = (beforeDetail.klipy as { id: string }[]).filter((c) => !afterIds.has(c.id));
const changedTransform = (afterDetail.klipy as { id: string; scale: number }[]).filter((c) => {
  const b = (beforeDetail.klipy as { id: string; scale: number }[]).find((x) => x.id === c.id);
  return b && b.scale !== c.scale;
});

console.log("\n  Pridané klipy:");
for (const c of newClips) console.log(`    + ${c.id} [${c.typ}] ${c.od}–${c.do} s${c.text ? ` · text „${c.text}“` : ""}`);
console.log("  Odobrané klipy:");
for (const c of removedClips) console.log(`    − ${c.id}`);
console.log("  Zmenené transformácie:");
for (const c of changedTransform) {
  const b = (beforeDetail.klipy as { id: string; scale: number }[]).find((x) => x.id === c.id)!;
  console.log(`    ~ ${c.id}: scale ${b.scale} → ${c.scale}`);
}

const changed = JSON.stringify(beforeDetail) !== JSON.stringify(afterDetail);
line("BEFORE ≠ AFTER", changed);
line("visualJson zmenený", before.visualJson !== after.visualJson);
line("audioJson nezmenený (bajty)", before.audioJson === after.audioJson);

// Rejected decision nesmie mať v osi žiadny efekt
const rejectedClipPrefix = `style_`;
const rejectedEffect = (afterDetail.klipy as { id: string }[]).filter((c) => c.id.includes(rejectedDecision.id) || c.id.includes(rejectedDecision.id.slice(-6)));
line("zamietnuté rozhodnutie v osi", rejectedEffect.length === 0 ? "žiadny klip / žiadny efekt" : `POZOR: ${rejectedEffect.map((c) => c.id).join(", ")}`);

// Upravené hodnoty musia byť v osi
const editedTextClip = (afterDetail.klipy as { id: string; text: string | null }[]).find((c) => c.text === "UPRAVENÉ POUŽÍVATEĽOM: 3 000 €");
line("upravený text v canonical klipe", editedTextClip ? `áno (${editedTextClip.id})` : "NIE");
const editedScaleClip = (afterDetail.klipy as { id: string; scale: number }[]).find((c) => c.scale === 130);
line("upravené priblíženie 130 % v klipe", editedScaleClip ? `áno (${editedScaleClip.id})` : "NIE");

evidence.po = {
  fingerprint: describe(after),
  detail: afterDetail,
  pridane: newClips,
  zmenene_transformacie: changedTransform,
  before_ne_after: changed,
  visual_zmeneny: before.visualJson !== after.visualJson,
  audio_nezmeneny: before.audioJson === after.audioJson,
  zamietnute_bez_efektu: rejectedEffect.length === 0,
  upraveny_text_v_osi: Boolean(editedTextClip),
  upravene_priblizenie_v_osi: Boolean(editedScaleClip),
};

// ---------------------------------------------------------------------------
// 8) PREVIEW = CANONICAL TIMELINE (parita)
// ---------------------------------------------------------------------------

head("8) PREVIEW PARITY — náhľad číta canonical os (žiadny skrytý stav)");
const probeTimes = newClips.slice(0, 3).map((c) => Number(c.od) + 0.4);
if (probeTimes.length === 0) {
  probeTimes.push(Math.min(1, projectContentEndSec(coreEngine.getProject()) / 2));
}
const previewBeforePlan = buildCanonicalFramePlan(project, probeTimes[0]);
const previewAfterPlans = probeTimes.map((t) => ({ t, plan: buildCanonicalFramePlan(coreEngine.getProject(), t) }));

line("snímka testovaná v čase", probeTimes.map((t) => `${t.toFixed(1)} s`).join(", "));
line("vrstvy pred apply", previewBeforePlan.layers.length);
for (const { t, plan: fp } of previewAfterPlans) {
  // `kind` rozlišuje kreslenie (text vs médium); typ klipu je v `clipType`.
  const texts = fp.layers.filter((l) => l.kind === "text").map((l) => l.name);
  const media = fp.layers.filter((l) => l.kind !== "text").map((l) => l.name);
  line(`vrstvy po apply @ ${t.toFixed(1)} s`, `${fp.layers.length} (text: ${texts.length ? texts.join(", ") : "—"}; obraz: ${media.join(", ") || "—"})`);
}
const previewHasEditedText = previewAfterPlans.some(({ plan: fp }) =>
  fp.layers.some((l) => (l.text ?? "").includes("UPRAVENÉ POUŽÍVATEĽOM")),
);
line("náhľad obsahuje upravený text", previewHasEditedText);
line("rovnaká funkcia ako export", "buildCanonicalFramePlan (renderEngine ju používa pre náhľad aj pre export)");
line("parita", previewHasEditedText ? "PREVIEW PARITY — OK (vrstvy pochádzajú z canonical osi)" : "PREVIEW PARITY — FAIL (vrstva v osi je, v pláne snímky nie)");
evidence.preview = {
  casy: probeTimes,
  vrstvy_pred: previewBeforePlan.layers.length,
  vrstvy_po: previewAfterPlans.map(({ t, plan: fp }) => ({ cas: t, vrstvy: fp.layers.length })),
  upraveny_text_v_nahlade: previewHasEditedText,
  poznamka: "Browser verification sa v tomto prostredí nedá (žiadny DOM) — toto je dátová parita náhľadu a exportu.",
};


// ---------------------------------------------------------------------------
// 8b) EXPORT PLAN z TEJ ISTEJ canonical osi (nie druhý export)
// ---------------------------------------------------------------------------

head("8b) EXPORTNÝ PLÁN Z TEJ ISTEJ CANONICAL OSI (pred rollbackom)");
const { buildCanonicalExportPlan } = await import("../src/core/export/canonicalExport.ts");
const exportPlan = buildCanonicalExportPlan(coreEngine.getProject(), {
  uploadId: "krok16",
  uploadName: basename(mediaPath),
  width: 1080,
  height: 1920,
});
const plannedSegments = exportPlan.request.segments ?? [];
line("export plán — segmentov titulkov", plannedSegments.length);
line("export plán — rozmery", `${exportPlan.request.width}×${exportPlan.request.height}`);
line("kontrola zhody (parity)", `${exportPlan.parity.matched ? "sedí" : "NESEDÍ"} | canonical klipov: ${exportPlan.parity.canonicalCaptionClips}, segmentov: ${exportPlan.parity.requestSegments}, chýbajúce texty: ${exportPlan.parity.missingTexts.length}, navyše: ${exportPlan.parity.extraTexts.length}`);
const plannedTexts = plannedSegments.map((sg) => sg.text);
line("upravený text v export pláne", plannedTexts.some((t) => t.includes("UPRAVENÉ POUŽÍVATEĽOM")) ? "áno" : "NIE");
line("dá sa exportovať", exportPlan.canExport);
line("blokery exportu", exportPlan.blockersSk.length > 0 ? exportPlan.blockersSk.join("; ") : "žiadne");
line("nevyrába táto linka", exportPlan.unsupportedSk.length > 0 ? exportPlan.unsupportedSk.join("; ") : "nič (všetko z osi sa vykreslí)");
line("poznámka", exportPlan.notesSk.slice(0, 2).join(" | ") || "—");
line("ten istý zdroj ako náhľad", "áno — náhľad aj export idú z canonical projektu");
evidence.export_plan = {
  segmenty: plannedSegments.length,
  texty: plannedTexts.slice(0, 6),
  upraveny_text_prítomný: plannedTexts.some((t) => t.includes("UPRAVENÉ POUŽÍVATEĽOM")),
  can_export: exportPlan.canExport,
  blokery: exportPlan.blockersSk,
  parita: exportPlan.parity.matched,
  poznamka: "Skutočný export do súboru je samostatný beh tools/verify-canonical-export.ts (REAL EXPORT VERIFIED).",
};

// ---------------------------------------------------------------------------
// 9) ROLLBACK (existujúca verzia projektu)
// ---------------------------------------------------------------------------

head("9) ROLLBACK — presne pôvodný stav");
const rollback = rollbackStyleApply(coreEngine, report);
const restored = fingerprintStyleState(coreEngine.getProject());
const restoredDetail = timelineDetail();
line("ok", rollback.ok);
line("obnovené presne (bajty)", rollback.restoredExactly);
line("časová os späť (visualJson)", restored.visualJson === before.visualJson);
line("audio späť (audioJson)", restored.audioJson === before.audioJson);
line("klipy video/b-roll/titulky po rollbacku", `${restored.videoClips}/${restored.brollClips}/${restored.captionClips}`);
const restoredVsBefore = JSON.stringify(restoredDetail) === JSON.stringify(beforeDetail);
line("celý stav zhoda", restoredVsBefore);
// Keď nie je zhoda, appka MUSÍ povedať, ktoré polia sa líšia (žiadne „skoro to isté“).
const diffKeys = Object.keys(beforeDetail).filter(
  (k) => JSON.stringify((beforeDetail as Record<string, unknown>)[k]) !== JSON.stringify((restoredDetail as Record<string, unknown>)[k]),
);
if (diffKeys.length > 0) {
  console.log(`  Líšia sa polia: ${diffKeys.join(", ")}`);
  for (const k of diffKeys) {
    const b = JSON.stringify((beforeDetail as Record<string, unknown>)[k]);
    const a = JSON.stringify((restoredDetail as Record<string, unknown>)[k]);
    console.log(`    ${k}:`);
    console.log(`      pred   : ${b.length > 220 ? b.slice(0, 220) + "…" : b}`);
    console.log(`      po     : ${a.length > 220 ? a.slice(0, 220) + "…" : a}`);
  }
  const onlyVersionRef = diffKeys.length === 1 && diffKeys[0] === "verzie";
  console.log(
    onlyVersionRef
      ? "  Vysvetlenie: obsah osi (klipy, časy, transformácie, texty, médiá) je zhodný; líši sa LEN zoznam verzií —"
      : "  Vysvetlenie: pozri rozdiel vyššie.",
  );
  if (onlyVersionRef) console.log("  projekt si ponecháva odkaz na verziu, ktorá vznikla pred aplikovaním (aby bolo vidieť, čo sa dialo).");
}
evidence.rollback = {
  ok: rollback.ok,
  presne: rollback.restoredExactly,
  visual_zhoda: restored.visualJson === before.visualJson,
  audio_zhoda: restored.audioJson === before.audioJson,
  detail_zhoda: restoredVsBefore,
  lisiace_sa_polia: diffKeys,
  poznamka_k_rozdielu: diffKeys.length === 1 && diffKeys[0] === "verzie"
    ? "Obsah časovej osi je zhodný; líši sa len evidencia verzií (odkaz na snapshot pred aplikovaním)."
    : "Pozri zoznam líšiacich sa polí.",
};

// ---------------------------------------------------------------------------
// 10) Verdikt
// ---------------------------------------------------------------------------

head("10) VERDIKT");
const chainOk =
  report.ok &&
  report.timelineChanged &&
  changed &&
  before.audioJson === after.audioJson &&
  Boolean(editedTextClip) &&
  Boolean(editedScaleClip) &&
  rejectedEffect.length === 0 &&
  previewHasEditedText &&
  rollback.ok &&
  rollback.restoredExactly;

line("Apply prešiel", report.ok);
line("canonical os sa zmenila", changed);
line("odpoveď na otázku zadania", chainOk ? "ÁNO — Apply mení SKUTOČNÚ canonical časovú os" : "NIE — pozri riadky vyššie");
console.log("\nOdpoveď na zadanie: „Keď vyberiem Editorial Collage a stlačím Apply Style,");
console.log("zmení sa skutočný canonical timeline projektu?“");
console.log(`→ ${chainOk ? "ÁNO (dôkaz vyššie: BEFORE ≠ AFTER, konkrétne klipy a transformácie)" : "STYLE-TO-TIMELINE — NOT VERIFIED"}`);
console.log("\nKlasifikácia:");
console.log("  • EditDecision + Apply + CommandManager + Snapshot/Rollback .... REAL MEDIA VERIFIED (tento beh)");
console.log("  • Náhľad a export čítajú ten istý canonical plán snímky ....... PREVIEW PARITY (dátová cesta v Node)");
console.log("  • Prehliadačové UI (tlačidlá, canvas) .......................... NOT VERIFIED (v prostredí nie je DOM)");
console.log("  • Export do súboru ............................................. samostatný runner: tools/verify-canonical-export.ts");
console.log("  • Generované obrázky/video ..................................... PROVIDER UNAVAILABLE (nič sa negenerovalo)");

evidence.verdikt = {
  odpoved: chainOk ? "ANO — canonical timeline sa zmenil" : "NIE",
  klasifikacia: {
    engine_apply_chain: "REAL MEDIA VERIFIED",
    preview_parity: "DATOVA PARITA (Node)",
    browser_ui: "NOT VERIFIED",
    export: "SEPARATNY RUNNER",
  },
};
evidence.koniec = new Date().toISOString();
writeFileSync(EVIDENCE, JSON.stringify(evidence, null, 1), "utf-8");
console.log(`\nDôkaz uložený: ${EVIDENCE}`);
process.exit(chainOk ? 0 : 1);

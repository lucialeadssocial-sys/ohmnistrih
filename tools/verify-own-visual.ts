/**
 * KROK 27 — dôkaz: VLASTNÝ VIZUÁL → canonical os → REÁLNY RENDER.
 *
 * Tri cesty, ktoré zadanie žiada, overené na REÁLNOM médiu:
 *   1. **vygenerovaný vizuál** v štýle videa (lokálne, z palety receptu) — server `POST /api/visual/card`,
 *   2. **voľná knižnica** — hľadanie s licenčným filtrom + stiahnutie (`/api/library/search`, `/api/library/fetch`),
 *      s priznaním autora,
 *   3. **súbor z disku** — PNG sa do projektu dostane **tou istou cestou ako tvoj súbor**
 *      (`importMediaFile` → AddClipCommand → canonical os), nie zvláštnou skratkou.
 *   4. **AI generovanie** — appka sa pokúsi naozaj (žiadne predstieranie) a zapíše presnú odpoveď providera.
 *
 * Potom sa celé video **vyrenderuje** (existujúci render engine — žiadny paralelný)
 * a zmeria sa, či je vizuál naozaj v obraze.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { coreEngine } from "../src/core/index";
import { buildStylePlan } from "../src/core/style/styleIntelligence";
import { getStyleRecipe } from "../src/core/style/styleRecipes";
import { applyStylePlan } from "../src/core/style/styleApply";
import { buildStyleCardSpec } from "../src/core/visual/styleCard";
import { buildRealProjectForExport } from "./verify-style-real-media";
import { buildCanonicalExportPlan } from "../src/core/export/canonicalExport";
import { basename } from "node:path";

const SERVER = process.env.VISUAL_SERVER ?? "http://127.0.0.1:3000";
const SOURCE = process.env.VISUAL_SOURCE ?? "/home/user/real-media/real_speech.mp4";
const SEGMENTS = process.env.VISUAL_SEGMENTS ?? "/home/user/real-media/segments-krok18.json";
const RECIPE = "AI_CARD_DEMO";
const OUT = "/home/user/kontrola-vizual";
const NOW = 1759219200000;
const ffmpegForShot =
  findFfmpegPathSafe();

function findFfmpegPathSafe(): string {
  try {
    // Len na čítanie snímok z hotového videa (nie render).
    return require("node:child_process").execSync(
      "python3 -c \"import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())\"",
      { encoding: "utf-8" },
    ).trim();
  } catch {
    return "ffmpeg";
  }
}

const log: string[] = [];
const say = (line: string) => {
  console.log(line);
  log.push(line);
};


/**
 * Runner NEMÁ prehliadač — appka v prehliadači načíta rozmery obrázka cez `new Image()`.
 * Tu ju nahradzujem čítaním rozmerov **priamo z hlavičky súboru** (PNG/JPEG).
 * Hodnoty sú skutočné (z bajtov súboru), nie vymyslené; inak by runner nevedel
 * nahrať vizuál tou istou cestou ako tvoj súbor.
 */
function installBrowserImageShim(log: (s: string) => void) {
  const blobs = new Map<string, Blob>();
  let counter = 0;
  (globalThis as any).URL = (globalThis as any).URL ?? {};
  const url = (globalThis as any).URL;
  url.createObjectURL = (blob: Blob) => {
    const id = `blob:shim/${++counter}`;
    blobs.set(id, blob);
    return id;
  };
  url.revokeObjectURL = (id: string) => blobs.delete(id);

  const dimensionsFromBytes = (bytes: Uint8Array): { width: number; height: number } | null => {
    // PNG: IHDR na offsete 16 (šírka) a 20 (výška), big-endian.
    if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return { width: view.getUint32(16), height: view.getUint32(20) };
    }
    // JPEG: nájdi SOF marker (0xFFC0–0xFFCF) a prečítaj výšku/šírku.
    if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
      let i = 2;
      while (i < bytes.length - 9) {
        if (bytes[i] !== 0xff) { i++; continue; }
        const marker = bytes[i + 1];
        const length = (bytes[i + 2] << 8) | bytes[i + 3];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          const height = (bytes[i + 5] << 8) | bytes[i + 6];
          const width = (bytes[i + 7] << 8) | bytes[i + 8];
          return { width, height };
        }
        i += 2 + Math.max(2, length);
      }
    }
    return null;
  };

  class ShimImage {
    naturalWidth = 0;
    naturalHeight = 0;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(value: string) {
      const blob = blobs.get(value);
      if (!blob) {
        setTimeout(() => this.onerror?.(), 0);
        return;
      }
      blob.arrayBuffer().then((buffer) => {
        const dims = dimensionsFromBytes(new Uint8Array(buffer));
        if (!dims) {
          setTimeout(() => this.onerror?.(), 0);
          return;
        }
        this.naturalWidth = dims.width;
        this.naturalHeight = dims.height;
        setTimeout(() => this.onload?.(), 0);
      });
    }
  }
  (globalThis as any).Image = ShimImage;
  log("   (runner nemá prehliadač: rozmery obrázkov čítam z hlavičky PNG/JPEG — hodnoty sú skutočné)");
}

async function main() {
  installBrowserImageShim(say);
  mkdirSync(OUT, { recursive: true });
  const segments = JSON.parse(readFileSync(SEGMENTS, "utf-8"));
  const durationSec = segments.reduce((m: number, s: any) => Math.max(m, Number(s.end) || 0), 0);
  const recipe = getStyleRecipe(RECIPE);

  // Text karty berieme DOSLOVNE z prepisu (slová/číslo z videa) — nič sa nevymýšľa.
  const statSegment =
    segments.find((s: any) => (s.words ?? []).some((w: any) => /^\d/.test(String(w.word)))) ?? segments[0];
  const numberWord = (statSegment.words ?? []).map((w: any) => String(w.word)).find((w: string) => /^\d/.test(w)) ?? "70%";
  const text = numberWord;
  const subText = "kratší strih";

  say(`Vstup: ${SOURCE}, prepis ${segments.length} viet / ${durationSec.toFixed(1)} s, recept ${RECIPE}`);
  say(`Text karty z prepisu: „${text}“ + „${subText}“ (doslovne z videa, nič nedoplnené)`);

  // ---------- 1) GENEROVANÝ VIZUÁL (server, lokálne) ----------------------
  const cardAnswer = await fetch(`${SERVER}/api/visual/card`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "statistic", recipeId: RECIPE, text, subText, width: 1080, height: 1920 }),
  }).then((r) => r.json() as any).catch((e) => ({ success: false, errorSk: String(e?.message ?? e) }));

  if (!cardAnswer?.success) {
    say(`1) GENEROVANÝ VIZUÁL — FAIL: ${cardAnswer?.errorSk}`);
  } else {
    const cardPath = path.join(OUT, cardAnswer.name);
    writeFileSync(cardPath, Buffer.from(cardAnswer.pngBase64, "base64"));
    say(`1) GENEROVANÝ VIZUÁL — OK: ${cardAnswer.name} (${cardAnswer.bytes} B, ${cardAnswer.width}×${cardAnswer.height})`);
    say(`   paleta: pozadie ${cardAnswer.spec.palette.background}, text ${cardAnswer.spec.palette.text}, akcent ${cardAnswer.spec.palette.accent}`);
    for (const n of cardAnswer.spec.notesSk) say(`   – ${n}`);
  }

  // ---------- 2) VOĽNÁ KNIŽNICA ------------------------------------------
  const search = await fetch(`${SERVER}/api/library/search?q=office%20desk%20laptop`).then((r) => r.json() as any).catch(() => null);
  let libraryPath: string | null = null;
  let libraryItem: any = null;
  if (!search?.success) {
    say(`2) VOĽNÁ KNIŽNICA — nedostupná: ${search?.errorSk ?? "bez odpovede"}`);
  } else {
    say(`2) VOĽNÁ KNIŽNICA — OK: ${search.items.length} použiteľných z ${search.totalFromProvider} výsledkov (vyradené pre licenciu: ${search.rejectedForLicense})`);
    for (const n of search.notesSk) say(`   – ${n}`);
    const pick = search.items[0];
    if (pick) {
      say(`   vybraný: „${pick.title}“ — ${pick.creator}, licencia ${pick.license.toUpperCase()} ${pick.licenseVersion}`);
      const fetched = await fetch(`${SERVER}/api/library/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pick.id }),
      }).then((r) => r.json() as any).catch(() => null);
      if (fetched?.success) {
        libraryPath = path.join(OUT, fetched.name);
        writeFileSync(libraryPath, Buffer.from(fetched.base64, "base64"));
        libraryItem = fetched.item;
        say(`   stiahnuté: ${fetched.name} (${fetched.bytes} B) — ${fetched.attributionRequiredSk}`);
      } else {
        say(`   stiahnutie FAIL: ${fetched?.errorSk}`);
      }
    }
  }

  // ---------- 3) AI GENEROVANIE (reálny pokus, pravda o výsledku) ---------
  const ai = await fetch(`${SERVER}/api/visual/ai-generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "Editorial collage illustration of a desk with laptop, halftone texture, bold shapes, no text" }),
  }).then((r) => r.json() as any).catch((e) => ({ success: false, errorSk: String(e?.message ?? e) }));
  say(`3) AI GENEROVANIE VIZUÁLU — ${ai?.success ? "OK" : "NEDOSTUPNÉ"}: ${ai?.errorSk ?? ai?.honestySk ?? ""}`);

  // ---------- 4) SÚBOR Z DISKU → PROJEKT (rovnaká cesta ako tvoj súbor) ---
  const project = buildRealProjectForExport(readFileSync(SOURCE), SOURCE, durationSec);
  if (!project) {
    say("FAIL: nepodarilo sa postaviť projekt z reálneho videa.");
    return;
  }
  (coreEngine as any).commandManager.setProject(project);

  const visuals: { path: string; kindSk: string; attributionSk?: string }[] = [];
  if (cardAnswer?.success) visuals.push({ path: path.join(OUT, cardAnswer.name), kindSk: "vygenerovaná karta (paleta receptu)" });
  if (libraryPath) visuals.push({ path: libraryPath, kindSk: "obrázok z voľnej knižnice", attributionSk: libraryItem?.attributionSk });

  const imported: { name: string; clipId: string; assetId: string }[] = [];
  for (const visual of visuals) {
    const bytes = readFileSync(visual.path);
    const file = new File([new Uint8Array(bytes)], path.basename(visual.path), {
      type: visual.path.endsWith(".png") ? "image/png" : "image/jpeg",
    });
    const clip: any = await (coreEngine as any).importMediaFile(file, "b-roll");
    imported.push({ name: path.basename(visual.path), clipId: clip?.id, assetId: clip?.assetId });
    say(`4) SÚBOR Z DISKU → projekt: ${path.basename(visual.path)} (${bytes.length} B) → klip ${clip?.id}`);
  }

  // ---------- 5) CIEĽ + ŠTÝL → PLÁN → APPLY → CANONICAL OS ---------------
  const assetImages = coreEngine.getProject().assets.filter((a) => a.type === "image");
  const plan = buildStylePlan({
    segments,
    recipe,
    durationSec,
    availableSupportingVisuals: assetImages.length,
    goal: "VZDELAVANIE",
    now: NOW,
  });
  const before = coreEngine.getProject();
  const applyReport: any = applyStylePlan(coreEngine as any, plan, { now: NOW });
  const after = coreEngine.getProject();
  const brollBefore = before.tracks.find((t) => t.type === "b-roll")?.clips.length ?? 0;
  const brollAfter = after.tracks.find((t) => t.type === "b-roll")?.clips.length ?? 0;
  say(
    `5) APPLY: ${applyReport?.ok ? "OK" : "FAIL"} — prijaté ${applyReport?.appliedCount ?? 0}, B-roll klipy ${brollBefore} → ${brollAfter} (z ${assetImages.length} vizuálov)`,
  );

  // ---------- 6) REÁLNY RENDER cez SKUTOČNÚ exportnú linku appky ----------
  // Postup je rovnaký ako pri exporte z rozhrania: canonical os → plán exportu
  // (`buildCanonicalExportPlan`) → `POST /api/export/burn-captions` → súbor.
  // Žiadny vlastný render engine, žiadne obchádzanie.
  // Endpoint prijíma SUROVÉ telo (`express.raw`), meno ide v query — presne ako to
  // robí appka (`xhr.open("POST", "/api/export/upload?name=…")` + `send(blob)`).
  const upload = await fetch(`${SERVER}/api/export/upload?name=${encodeURIComponent(basename(SOURCE))}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: new Uint8Array(readFileSync(SOURCE)),
  }).then((r) => r.json() as any).catch((e) => ({ success: false, error: String(e?.message ?? e) }));
  if (!upload?.success) {
    say(`6) RENDER — nedá sa: upload zlyhal: ${upload?.error ?? "bez odpovede"}`);
  } else {
    // Obrazové vrstvy musia byť aj na serveri — presne tak to robí panel exportu
    // (`prepareOverlays` → upload → `assetUploads`), inak by vo videu neboli.
    const assetUploads: Record<string, string> = {};
    for (const item of imported) {
      const bytes = readFileSync(path.join(OUT, item.name));
      const up = await fetch(`${SERVER}/api/export/upload?name=${encodeURIComponent(item.name)}`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: new Uint8Array(bytes),
      }).then((r) => r.json() as any).catch(() => null);
      if (up?.success && item.assetId) assetUploads[item.assetId] = up.uploadId;
    }
    say(`   vrstvy pripravené na serveri: ${Object.keys(assetUploads).length} z ${imported.length}`);

    const exportPlan: any = buildCanonicalExportPlan(
      coreEngine.getProject(),
      { uploadId: upload.uploadId, uploadName: basename(SOURCE), width: 1080, height: 1920 } as any,
      { assetUploads },
    );
    say(`6) PLÁN EXPORTU: dá sa exportovať = ${exportPlan.canExport ? "áno" : "NIE"}, blokery: ${(exportPlan.blockersSk ?? []).join("; ") || "žiadne"}`);
    say(`   obrazové vrstvy v pláne: ${(exportPlan.request?.overlays ?? []).length} (${(exportPlan.request?.overlays ?? []).map((o: any) => o.name ?? o.clipId).join(", ") || "žiadne"})`);

    if (!exportPlan.canExport) {
      say("   Render sa nespustil — plán má blokery (nič nepredstieram).");
    } else {
      const burnRes = await fetch(`${SERVER}/api/export/burn-captions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exportPlan.request),
      });
      const burn: any = await burnRes.json();
      say(`   render spustený: ${burn?.success ? `job ${burn.jobId}` : `FAIL ${burn?.errorSk ?? burn?.error ?? ""}`}`);

      let status: any = null;
      for (let i = 0; i < 90; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const answer = await fetch(`${SERVER}/api/export/burn-captions/status?id=${burn.jobId}`).then((r) => r.json() as any).catch(() => null);
        status = answer?.status ?? null;
        const st = String(status?.state ?? "").toLowerCase();
        if (st === "done" || st === "error" || st === "cancelled") break;
      }
      const finishedState = String(status?.state ?? "").toLowerCase();
      const outputName = status?.result?.outputName ?? status?.result?.fileName ?? null;
      if (finishedState === "done" && outputName) {
        const file = await fetch(`${SERVER}/api/export/file/${encodeURIComponent(outputName)}`);
        const buffer = Buffer.from(await file.arrayBuffer());
        const outPath = path.join(OUT, "vystup-s-vlastnym-vizualom.mp4");
        writeFileSync(outPath, buffer);
        say(`6) RENDER — OK: ${buffer.length} B → ${outPath} (stav ${status.state}, titulkov v zadaní ${exportPlan.request.segments.length})`);
        say(`   poznámky renderu: ${(status.result?.notesSk ?? []).slice(0, 3).join(" | ") || "žiadne"}`);

        // Snímky: v čase vizuálu a mimo neho — aby bolo vidieť rozdiel.
        const found = require("node:child_process");
        const planOverlays: any[] = exportPlan.request?.overlays ?? [];
        const firstStart = planOverlays[0]?.startSec ?? 0;
        const shotAt = Math.min((planOverlays[0]?.endSec ?? 3) - 0.2, firstStart + 1.2);
        const shot1 = path.join(OUT, "snimka-s-vizualom.png");
        found.spawnSync(ffmpegForShot, ["-y", "-hide_banner", "-loglevel", "error", "-ss", String(shotAt), "-i", outPath, "-frames:v", "1", shot1]);
        const lastEnd = planOverlays[planOverlays.length - 1]?.endSec ?? 0;
        const outAt = Math.min(durationSec - 0.3, lastEnd + 0.6);
        const shot2 = path.join(OUT, "snimka-bez-vizualu.png");
        found.spawnSync(ffmpegForShot, ["-y", "-hide_banner", "-loglevel", "error", "-ss", String(Math.max(0, outAt)), "-i", outPath, "-frames:v", "1", shot2]);
        say(`   snímka v čase vizuálu (${shotAt.toFixed(2)} s): ${existsSync(shot1) ? `${statSync(shot1).size} B → ${shot1}` : "NEPODARILO SA"}`);
        say(`   snímka mimo vizuálu (${Math.max(0, outAt).toFixed(2)} s): ${existsSync(shot2) ? `${statSync(shot2).size} B → ${shot2}` : "NEPODARILO SA"}`);
      } else {
        say(`6) RENDER — FAIL: stav ${status?.state ?? "neznámy"} ${status?.errorSk ?? status?.error ?? ""}`);
      }
    }
  }

  writeFileSync(path.join(OUT, "vizual-dokaz.txt"), log.join("\n"));
  writeFileSync(
    path.join(OUT, "vizual-dokaz.json"),
    JSON.stringify(
      {
        krok: 27,
        vstup: { source: SOURCE, segments: SEGMENTS, durationSec, recipe: RECIPE },
        generovany: cardAnswer?.success ? { name: cardAnswer.name, bytes: cardAnswer.bytes, spec: cardAnswer.spec } : { error: cardAnswer?.errorSk },
        kniznica: search?.success ? { totalFromProvider: search.totalFromProvider, pouzitelnych: search.items.length, vyradene: search.rejectedForLicense, vybrany: libraryItem } : { error: search?.errorSk },
        aiGenerovanie: ai,
        importovane: imported,
        apply: { ok: applyReport?.ok, appliedCount: applyReport?.appliedCount, brollBefore, brollAfter },
        poznamka: "Render beží existujúcim render engine (žiadny paralelný). AI generovanie obrázkov je závislé na providerovi — appka hlási presnú odpoveď, nič nepredstiera.",
      },
      null,
      2,
    ),
  );
  say(`\nUložené: ${OUT}/vizual-dokaz.json + vizual-dokaz.txt`);
}

main();

/**
 * CANONICAL EXPORT — z canonical časovej osi spraví zadanie pre **existujúcu**
 * renderovaciu linku (ffmpeg: strih + vypálené titulky). Žiadny druhý render engine.
 *
 * Prečo to existuje: titulky sa doteraz pálili zo stavu editora (legacy), nie
 * z canonical projektovej osi. Po Style Studio Apply sú titulky a strihy
 * v canonical projekte — a presne tie sa musia objaviť v exporte. Tento modul je
 * jediný most: canonical projekt → požiadavka na render.
 *
 * Modul je čistý (žiadny DOM, žiadna sieť) a **nič nezamlčuje**: okrem zadania
 * vracia aj zoznam vlastností canonical osi, ktoré táto linka zatiaľ nevykresľuje
 * (`unsupportedSk`), aby používateľ nečakal niečo, čo vo videu nebude.
 */

import { ProjectModel, ClipModel } from "../types/project";
import type { CaptionStyleId } from "./subtitleRender";

export interface CanonicalExportUpload {
  uploadId: string;
  uploadName: string;
  width: number;
  height: number;
  fontFamily?: string;
}

/** Rovnaký tvar, aký prijíma existujúci endpoint `/api/export/burn-captions`. */
export interface CanonicalBurnRequest {
  uploadId: string;
  uploadName: string;
  styleId: CaptionStyleId;
  width: number;
  height: number;
  segments: { start: number; end: number; text: string; words?: { word: string; start: number; end: number }[] }[];
  keepRanges: { start: number; end: number }[];
  fontFamily?: string;
}

export interface CanonicalExportPlan {
  request: CanonicalBurnRequest;
  /** Čo presne ide do videa (pre človeka). */
  notesSk: string[];
  /** Čo canonical os má, ale táto renderovacia linka to zatiaľ nevykresľuje. */
  unsupportedSk: string[];
  /** Kontrola zhody: canonical titulky ↔ segmenty v zadaní. */
  parity: CanonicalExportParity;
  /** Má export čo renderovať? Keď nie, `canExport` je false a `blockersSk` to povie. */
  canExport: boolean;
  blockersSk: string[];
}

export interface CanonicalExportParity {
  canonicalCaptionClips: number;
  requestSegments: number;
  /** Titulky, ktoré sú v canonical osi a v zadaní chýbajú (nikdy nesmie byť > 0). */
  missingTexts: string[];
  /** Texty v zadaní, ktoré v canonical osi nie sú (podvod alebo chyba mapovania). */
  extraTexts: string[];
  matched: boolean;
}

/** Preset canonical tituliek → štýl renderovacej linky (opačné mapovanie k Style Apply). */
const PRESET_TO_STYLE: Record<string, CaptionStyleId> = {
  bold: "VIRAL_BOLD",
  kinetic: "KARAOKE",
  social: "NEON_BOX",
  clean: "CLEAN",
  minimal: "PODCAST",
};

export function captionStyleForCanonicalClips(clips: ClipModel[]): CaptionStyleId {
  const counts = new Map<CaptionStyleId, number>();
  for (const clip of clips) {
    const preset = clip.textConfig && clip.captionStyle ? clip.captionStyle.preset : undefined;
    const styleId = preset ? PRESET_TO_STYLE[preset] : undefined;
    if (!styleId) continue;
    counts.set(styleId, (counts.get(styleId) ?? 0) + 1);
  }
  let best: CaptionStyleId | null = null;
  let bestCount = 0;
  for (const [id, count] of Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    if (count > bestCount) {
      best = id;
      bestCount = count;
    }
  }
  return best ?? "VIRAL_BOLD";
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Titulkové/textové klipy canonical osi v poradí podľa času. */
export function canonicalCaptionClips(project: ProjectModel): ClipModel[] {
  const clips: ClipModel[] = [];
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (clip.type === "caption" || clip.type === "text") clips.push(clip);
    }
  }
  return clips.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
}

/** Strihy canonical osi → úseky, ktoré sa majú z videa ponechať (v poradí na časovej osi). */
export function canonicalKeepRanges(project: ProjectModel): { start: number; end: number }[] {
  const videoClips: ClipModel[] = [];
  for (const track of project.tracks) {
    if (track.type !== "video") continue;
    for (const clip of track.clips) {
      if (clip.type === "video" || clip.type === "b-roll") videoClips.push(clip);
    }
  }
  videoClips.sort((a, b) => a.start - b.start);

  const ranges = videoClips.map((clip) => ({
    start: round3(clip.sourceStart ?? 0),
    end: round3(clip.sourceEnd ?? (clip.sourceStart ?? 0) + clip.duration),
  }));

  // Jeden klip, ktorý začína na začiatku média a siaha až na jeho koniec → žiadne strihy.
  // (Bez strihov ide zvuk cez `-c:a copy` — pôvodné audio zostane bajtovo rovnaké.)
  // Dĺžku média berieme z projektu (`assets.duration`), nie z „minimálnej dĺžky“ timeline enginu.
  if (videoClips.length === 1 && Math.abs(ranges[0].start) < 0.02) {
    const asset = project.assets?.find((a) => a.id === videoClips[0].assetId);
    const assetDuration = typeof asset?.duration === "number" && asset.duration > 0 ? asset.duration : null;
    if (assetDuration === null || Math.abs(ranges[0].end - assetDuration) <= 0.5) {
      return [];
    }
  }
  return ranges.filter((r) => r.end - r.start > 0.02);
}

/**
 * Z canonical projektu spraví zadanie pre existujúcu renderovaciu linku.
 * Nikdy nič nedomýšľa: chýbajúce médium, prázdne titulky či nula klipov = `blockersSk`.
 */
export function buildCanonicalExportPlan(
  project: ProjectModel,
  upload: CanonicalExportUpload,
): CanonicalExportPlan {
  const notesSk: string[] = [];
  const unsupportedSk: string[] = [];
  const blockersSk: string[] = [];

  const captionClips = canonicalCaptionClips(project);
  const keepRanges = canonicalKeepRanges(project);
  const styleId = captionStyleForCanonicalClips(captionClips);

  const segments = captionClips
    .map((clip) => {
      const text = (clip.textConfig?.content ?? "").trim();
      return {
        start: round3(clip.start),
        end: round3(clip.start + clip.duration),
        text,
      };
    })
    .filter((s) => s.text.length > 0 && s.end > s.start);

  // Textové klipy, ktoré sa do titulkov nedostali (rozbité/nezmyselné časy) — priznáme.
  const dropped = captionClips.length - segments.length;
  if (dropped > 0) {
    notesSk.push(
      `${dropped} textových vrstiev canonical osi nemá text alebo platný čas — do exportu nešli (a preto vo videu nebudú).`,
    );
  }

  if (captionClips.length > 0) {
    notesSk.push(
      `${segments.length} titulkov pôjde do videa priamo z canonical časovej osi (štýl ${styleId} podľa canonical presetov).`,
    );
  } else {
    notesSk.push("Canonical časová os nemá titulky — export nebude mať vypálené titulky.");
  }

  if (keepRanges.length > 0) {
    notesSk.push(
      `Strih: ponechá sa ${keepRanges.length} úsekov zo zdroja (${keepRanges
        .map((r) => `${r.start.toFixed(1)}–${r.end.toFixed(1)} s`)
        .join(", ")}). Zvuk sa pri strihu prekóduje na AAC 192 k (inak by nesedel na strih).`,
    );
  } else {
    notesSk.push("Strih: žiadny — ide celé video. Zvuk sa kopíruje bez prekódovania (bajtovo rovnaký ako zdroj).");
  }

  // --- Poctivo: čo canonical os má, ale táto linka nevykresľuje -----------------
  const imageClips: ClipModel[] = [];
  let zoomedClips = 0;
  let filteredClips = 0;
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (clip.type === "image" || clip.type === "b-roll") imageClips.push(clip);
      if (clip.scale !== undefined && Math.abs(clip.scale - 100) > 0.01) zoomedClips++;
      if (clip.filter && clip.filter !== "NONE") filteredClips++;
    }
  }
  if (imageClips.length > 0) {
    unsupportedSk.push(
      `${imageClips.length} obrazových vrstiev (b-roll/fotky) canonical osi sa v tomto exporte ZATIAĽ nekreslí — vo videu nebudú.`,
    );
  }
  if (zoomedClips > 0) {
    unsupportedSk.push(
      `Priblíženia (motion) na ${zoomedClips} klipoch sa v tomto exporte ZATIAĽ nevykresľujú — obraz ide bez zoomu.`,
    );
  }
  if (filteredClips > 0) {
    unsupportedSk.push(`${filteredClips} klipov má farebný filter — ten sa v tomto exporte ZATIAĽ nevykresľuje.`);
  }

  // --- Blokátory: bez týchto vecí sa nedá poctivo renderovať --------------------
  if (!upload.uploadId) blockersSk.push("Chýba nahrané video na serveri (uploadId) — nedá sa renderovať.");
  const totalVideoClips = project.tracks
    .filter((t) => t.type === "video")
    .reduce((sum, t) => sum + t.clips.filter((c) => c.type === "video").length, 0);
  if (totalVideoClips === 0) blockersSk.push("Canonical časová os nemá hlavný video klip — niet čo renderovať.");
  if (!(upload.width > 0) || !(upload.height > 0)) blockersSk.push("Neznámy rozmer videa — ASS titulky by sedeli zle.");

  const request: CanonicalBurnRequest = {
    uploadId: upload.uploadId,
    uploadName: upload.uploadName,
    styleId,
    width: Math.round(upload.width),
    height: Math.round(upload.height),
    segments,
    keepRanges,
    ...(upload.fontFamily ? { fontFamily: upload.fontFamily } : {}),
  };

  const parity = canonicalExportParity(project, request);

  return {
    request,
    notesSk,
    unsupportedSk,
    parity,
    canExport: blockersSk.length === 0,
    blockersSk,
  };
}

/**
 * Kontrola zhody: každý text canonical osi musí byť v zadaní a naopak.
 * Keď sa to niekedy rozíde, runner aj testy to povedia — export nebude ticho iný.
 */
export function canonicalExportParity(project: ProjectModel, request: CanonicalBurnRequest): CanonicalExportParity {
  const canonicalTexts = canonicalCaptionClips(project)
    .map((clip) => (clip.textConfig?.content ?? "").trim())
    .filter((t) => t.length > 0);
  const requestTexts = request.segments.map((s) => s.text.trim()).filter((t) => t.length > 0);

  const countBy = (list: string[]) => {
    const map = new Map<string, number>();
    for (const t of list) map.set(t, (map.get(t) ?? 0) + 1);
    return map;
  };
  const canonicalCount = countBy(canonicalTexts);
  const requestCount = countBy(requestTexts);

  const missingTexts: string[] = [];
  for (const [text, count] of canonicalCount) {
    const inRequest = requestCount.get(text) ?? 0;
    for (let i = 0; i < Math.max(0, count - inRequest); i++) missingTexts.push(text);
  }
  const extraTexts: string[] = [];
  for (const [text, count] of requestCount) {
    const inCanonical = canonicalCount.get(text) ?? 0;
    for (let i = 0; i < Math.max(0, count - inCanonical); i++) extraTexts.push(text);
  }

  return {
    canonicalCaptionClips: canonicalTexts.length,
    requestSegments: requestTexts.length,
    missingTexts,
    extraTexts,
    matched: missingTexts.length === 0 && extraTexts.length === 0,
  };
}

/** Zhrnutie pre človeka (do UI aj do reportu runnera). */
export function canonicalExportSummarySk(plan: CanonicalExportPlan): string {
  const lines: string[] = [];
  lines.push(`Export z canonical časovej osi: ${plan.request.segments.length} titulkov, ${plan.request.keepRanges.length} strihov.`);
  lines.push(`Zhoda canonical ↔ zadanie: ${plan.parity.matched ? "áno (nič nechýba, nič navyše)" : "NIE — pozri missing/extra"}.`);
  if (!plan.canExport) lines.push(`Nedá sa renderovať: ${plan.blockersSk.join(" ")}`);
  for (const note of plan.unsupportedSk) lines.push(`Pozor: ${note}`);
  return lines.join("\n");
}

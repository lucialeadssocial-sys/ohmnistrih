/**
 * VYPÁLENIE TITULKOV — serverová časť (krok B).
 *
 * Tu je všetko, čo sa dá otestovať **bez ffmpeg a bez videa**: validácia
 * požiadavky, bezpečné názvy súborov, stavová mašina renderu, čítanie priebehu
 * z ffmpeg a upratovanie. `server.ts` z toho robí len tenkú obálku (HTTP).
 *
 * Prečo práve takto:
 *  - Render je dlhý (prekódovanie), takže to **nemôže byť jeden HTTP request,
 *    ktorý visí** — klient dostane `jobId` a pýta sa na stav. Poctivý priebeh
 *    v percentách, nie točiace sa koliesko naslepo.
 *  - **Žiadne prekvapenia:** keď niečo nejde (veľký súbor, neznámy štýl, chýbajúci
 *    ffmpeg), odpoveď obsahuje slovenskú vetu s dôvodom.
 *  - Cesty: názvy súborov nikdy nesmú vyjsť z adresára exportov (inak by sa dal
 *    zapísať/prečítať hocijaký súbor na serveri).
 */

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  normalizeOverrides,
  type CaptionOverrides,
  CAPTION_STYLES,
  type CaptionStyleId,
  type KeepRange,
} from "./subtitleRender";
import { normalizeKeepRanges } from "./subtitleRender";
import type { SpeechSegmentLike } from "../transcript/wordTiming";

/**
 * Farebné filtre, ktoré vie táto linka vykresliť. Musia sedieť s `colorFilterForName`
 * v `subtitleRender.ts` — inak by plán poslal filter, ktorý sa ticho vynechá.
 */
export const BURN_KNOWN_FILTERS = ["NONE", "TEAL_ORANGE", "CINEMATIC", "VINTAGE", "BW", "WARM", "COOL"] as const;

export const BURN_LIMITS = {
  /** Väčšie video = dlhší upload do .data; nad týmto radšej poctivo odmietnuť. */
  maxUploadBytes: 512 * 1024 * 1024,
  maxCaptionSegments: 5000,
  maxKeepRanges: 500,
  minDim: 64,
  maxDim: 8192,
  maxStoredExports: 25,
  maxStoredUploads: 10,
  /** Koľko obrazových vrstiev (b-roll/fotky) sa smie skladať v jednom renderi. */
  maxOverlays: 20,
  /** Rozsah priblíženia, ktorý dáva zmysel (mimo neho je to skôr chyba v pláne). */
  minZoomPercent: 50,
  maxZoomPercent: 400,
  /** Koľko krokov animovaného priblíženia (keyframov) sa smie skladať v jednom okne. */
  maxZoomKeyframes: 24,
  /** Otočenie vrstvy, ktoré dáva zmysel (mimo neho je to skôr chyba v pláne). */
  maxOverlayRotation: 360,
} as const;

export const BURN_MAX_UPLOAD_SK = `Video je príliš veľké na vypálenie titulkov (limit ${Math.round(
  BURN_LIMITS.maxUploadBytes / (1024 * 1024),
)} MB). Použi kratší klip — titulky sa najčastejšie pália do krátkeho formátu pre TikTok/Reels.`;

// ---------------------------------------------------------------------------
// Bezpečné názvy
// ---------------------------------------------------------------------------

/** Bezpečné meno súboru: bez ciest, bez ovládacích znakov, bez „..“. */
export function safeBaseName(name: unknown, fallback = "video.mp4"): string {
  const raw = String(name ?? "").trim().split(/[\\/]/).pop() || "";
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^\p{L}\p{N}._ -]/gu, "_")
    .replace(/\.\.+/g, ".")
    .replace(/^[.\s]+/, "")
    .trim()
    .slice(0, 80);
  return cleaned || fallback;
}

/** Meno, ktoré smieme použiť ako názov uloženého súboru (bez adresárov). */
export function isSafeStoredName(name: unknown): boolean {
  const n = String(name ?? "");
  if (!n || n.length > 120) return false;
  if (n.includes("/") || n.includes("\\") || n.includes("..")) return false;
  return /^[A-Za-z0-9._-]+$/.test(n);
}

/** Z `pôvodné meno.mp4` urobí jedinečný názov uloženia. */
export function uploadStorageName(originalName: unknown, id: string = randomUUID()): string {
  const base = safeBaseName(originalName, "video.mp4");
  const ext = path.extname(base).slice(0, 8) || ".mp4";
  // Medzery v mene na disku sú zbytočný zdroj chýb (shell, URL) — nahradíme ich.
  const stem = (path.basename(base, path.extname(base)) || "video")
    .replace(/\s+/g, "_")
    .slice(0, 40);
  return `${id}__${stem || "video"}${ext}`;
}

// ---------------------------------------------------------------------------
// Validácia požiadavky na vypálenie
// ---------------------------------------------------------------------------

export interface BurnSpec {
  uploadId: string;
  uploadName: string;
  outputName: string;
  segments: SpeechSegmentLike[];
  styleId: CaptionStyleId;
  /**
   * Odchýlky vlastného štýlu klienta (brand kit). Server ich oreže do rozsahov
   * a vráti späť, čo upravil — aby vo videu nebolo nič „potichu iné“.
   */
  overrides?: CaptionOverrides;
  /** Poznámky k úpravám odchýlok (pre človeka, po slovensky). */
  overrideNotesSk?: string[];
  width: number;
  height: number;
  keepRanges: KeepRange[];
  fontFamily?: string;
  /** Priblíženia z canonical osi (krok 8). */
  zoom: {
    clipId: string;
    startSec: number;
    endSec: number;
    scale: number;
    positionX: number;
    positionY: number;
    /** Animované priblíženie: priebeh (čas od začiatku okna, percentá). */
    keyframes?: { timeSec: number; scalePercent: number }[];
  }[];
  /** Obrazové vrstvy z canonical osi (krok 8) — odkazy na súbory nahraté na server. */
  overlays: {
    clipId: string;
    kind: "image" | "video";
    uploadId: string;
    name: string;
    startSec: number;
    endSec: number;
    scalePercent: number;
    positionX: number;
    positionY: number;
    /** Otočenie v stupňoch okolo stredu (0 = bez otočenia). */
    rotation: number;
    /** Priesvitnosť v percentách (100 = plne nepriehľadné). */
    opacity: number;
    /** Farebný filter (len z `BURN_KNOWN_FILTERS`). */
    filter: string;
  }[];
  /** Farebný filter základného videa (len z `BURN_KNOWN_FILTERS`). */
  baseFilter: string;
  /**
   * KROK 24: merané zosúladenie svetla — jas/kontrast vypočítaný z rozdielu medzi
   * zdrojovým videom a referenciou. Voliteľné; keď chýba, render nič nemení.
   */
  lightCorrection?: LightCorrection | null;
}

import { lightCorrectionWithinLimits, type LightCorrection } from "./lightMatch";

export type BurnValidation =
  | { ok: true; spec: BurnSpec }
  | { ok: false; errorSk: string };

const STYLE_IDS = CAPTION_STYLES.map((s) => s.id);

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Skontroluje telo požiadavky a vráti hotový „recept“ na render.
 * Nikdy nehádže — vždy vráti buď recept, alebo vetu s dôvodom.
 */
export function validateBurnRequest(body: any): BurnValidation {
  if (!body || typeof body !== "object") {
    return { ok: false, errorSk: "Chýba telo požiadavky na vypálenie titulkov." };
  }

  const uploadId = String(body.uploadId ?? "").trim();
  if (!isSafeStoredName(uploadId)) {
    return {
      ok: false,
      errorSk: "Chýba alebo je neplatný identifikátor nahraného videa — nahraj video znova.",
    };
  }

  const styleId = String(body.styleId ?? "VIRAL_BOLD") as CaptionStyleId;
  if (!STYLE_IDS.includes(styleId)) {
    return {
      ok: false,
      errorSk: `Neznámy štýl titulkov „${styleId}“. Na výber je: ${STYLE_IDS.join(", ")}.`,
    };
  }

  const segments: SpeechSegmentLike[] = slimSegments(
    Array.isArray(body.segments)
      ? body.segments.filter(
          (s: any) => s && Number.isFinite(Number(s.start)) && Number.isFinite(Number(s.end)),
        )
      : [],
  ).filter((s) => s.end > s.start);

  if (segments.length === 0) {
    return {
      ok: false,
      errorSk:
        "Nemám žiadne titulky na vypálenie. Najprv spusti „Automatické titulky“ (prepis), potom pálime.",
    };
  }
  if (segments.length > BURN_LIMITS.maxCaptionSegments) {
    return {
      ok: false,
      errorSk: `Titulkov je príliš veľa (${segments.length}) — maximum je ${BURN_LIMITS.maxCaptionSegments}.`,
    };
  }

  const width = Math.round(num(body.width, 1080));
  const height = Math.round(num(body.height, 1920));
  if (
    width < BURN_LIMITS.minDim ||
    height < BURN_LIMITS.minDim ||
    width > BURN_LIMITS.maxDim ||
    height > BURN_LIMITS.maxDim
  ) {
    return {
      ok: false,
      errorSk: `Rozlíšenie ${width}×${height} je mimo rozumného rozsahu — pošli skutočné rozmery videa.`,
    };
  }

  const keepRanges = normalizeKeepRanges(body.keepRanges);
  if (keepRanges.length > BURN_LIMITS.maxKeepRanges) {
    return {
      ok: false,
      errorSk: `Strihov je príliš veľa (${keepRanges.length}) — maximum je ${BURN_LIMITS.maxKeepRanges}.`,
    };
  }

  // --- Priblíženia (krok 8): statické stredové orezanie podľa canonical osi ---
  const zoom: BurnSpec["zoom"] = [];
  if (Array.isArray(body.zoom)) {
    for (const raw of body.zoom as any[]) {
      const startSec = num(raw?.startSec, NaN);
      const endSec = num(raw?.endSec, NaN);
      const scale = num(raw?.scale, NaN);
      if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || !Number.isFinite(scale)) continue;
      if (endSec - startSec <= 0.02) continue;
      if (scale < BURN_LIMITS.minZoomPercent || scale > BURN_LIMITS.maxZoomPercent) {
        return {
          ok: false,
          errorSk: `Priblíženie ${Math.round(scale)} % je mimo rozsahu ${BURN_LIMITS.minZoomPercent}–${BURN_LIMITS.maxZoomPercent} % — skontroluj plán štýlu.`,
        };
      }
      const positionX = num(raw?.positionX, 0);
      const positionY = num(raw?.positionY, 0);

      // Animované priblíženie (keyframy) — priebeh sa overuje, nie „nejako" prevezme.
      let keyframes: { timeSec: number; scalePercent: number }[] | undefined;
      if (Array.isArray(raw?.keyframes) && raw.keyframes.length > 0) {
        if (raw.keyframes.length > BURN_LIMITS.maxZoomKeyframes) {
          return {
            ok: false,
            errorSk: `Animované priblíženie má príliš veľa krokov (${raw.keyframes.length}, max ${BURN_LIMITS.maxZoomKeyframes}).`,
          };
        }
        const parsed: { timeSec: number; scalePercent: number }[] = [];
        for (const k of raw.keyframes as any[]) {
          const t = num(k?.timeSec, NaN);
          // Canonical plán posiela krok ako `scale` (rovnako ako `zoom.scale`),
          // renderovacia linka používa `scalePercent`. Prijímame obe mená —
          // presne táto nezhoda sa naozaj stala a odhalil ju až reálny beh.
          const pct = num(k?.scalePercent, num(k?.scale, NaN));
          if (!Number.isFinite(t) || !Number.isFinite(pct)) {
            return { ok: false, errorSk: "Animované priblíženie má krok s neplatným časom alebo hodnotou." };
          }
          if (t < -0.001 || t > endSec - startSec + 0.05) {
            return {
              ok: false,
              errorSk: `Krok animovaného priblíženia je mimo svojho okna (${t.toFixed(2)} s pri dĺžke ${(endSec - startSec).toFixed(2)} s).`,
            };
          }
          if (pct < 100 - 0.01 || pct > BURN_LIMITS.maxZoomPercent) {
            return {
              ok: false,
              errorSk: `Animované priblíženie musí byť v rozsahu 100–${BURN_LIMITS.maxZoomPercent} % (zmenšovanie nevykresľujeme).`,
            };
          }
          parsed.push({ timeSec: t, scalePercent: pct });
        }
        parsed.sort((a, b) => a.timeSec - b.timeSec);
        if (parsed.length < 2) {
          return { ok: false, errorSk: "Animované priblíženie potrebuje aspoň dva kroky (inak je to statický stav)." };
        }
        keyframes = parsed;
      }

      if (Math.abs(scale - 100) <= 0.01 && !keyframes) continue; // nič sa nemení, zbytočný filter
      if (Math.abs(positionX) > 0.01 || Math.abs(positionY) > 0.01) {
        return {
          ok: false,
          errorSk:
            "Priblíženie spojené s posunom obrazu táto linka nevie verne vykresliť (statický stredový orez). Vynechaj posun alebo použi menší zoom.",
        };
      }
      zoom.push({
        clipId: String(raw?.clipId ?? "").slice(0, 80),
        startSec: Math.max(0, startSec),
        endSec: Math.min(endSec, 24 * 3600),
        scale,
        positionX,
        positionY,
        ...(keyframes ? { keyframes } : {}),
      });
    }
    if (zoom.length > BURN_LIMITS.maxKeepRanges) {
      return { ok: false, errorSk: `Priblížení je príliš veľa (${zoom.length}).` };
    }
  }

  // --- Obrazové vrstvy (krok 8) ------------------------------------------------
  const overlays: BurnSpec["overlays"] = [];
  if (Array.isArray(body.overlays)) {
    if (body.overlays.length > BURN_LIMITS.maxOverlays) {
      return {
        ok: false,
        errorSk: `Obrazových vrstiev je príliš veľa (${body.overlays.length}) — maximum je ${BURN_LIMITS.maxOverlays}.`,
      };
    }
    for (const raw of body.overlays as any[]) {
      const overlayUploadId = String(raw?.uploadId ?? "").trim();
      if (!isSafeStoredName(overlayUploadId)) {
        return {
          ok: false,
          errorSk: "Obrazová vrstva (b-roll/fotka) má neplatný súbor na serveri — nahraj ju znova.",
        };
      }
      const startSec = num(raw?.startSec, NaN);
      const endSec = num(raw?.endSec, NaN);
      if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec - startSec <= 0.02) continue;
      const scalePercent = num(raw?.scalePercent, 100);
      if (scalePercent < 5 || scalePercent > 1000) {
        return { ok: false, errorSk: `Veľkosť obrazovej vrstvy ${Math.round(scalePercent)} % je mimo rozumného rozsahu.` };
      }
      // Otočenie a priesvitnosť (krok 10): rozsahy sa kontrolujú, nie „nejako" prevezmú.
      const rotation = num(raw?.rotation, 0);
      if (Math.abs(rotation) > BURN_LIMITS.maxOverlayRotation) {
        return {
          ok: false,
          errorSk: `Otočenie obrazovej vrstvy ${Math.round(rotation)}° je mimo rozsahu ±${BURN_LIMITS.maxOverlayRotation}°.`,
        };
      }
      const opacity = num(raw?.opacity, 100);
      if (opacity < 1 || opacity > 100) {
        return {
          ok: false,
          errorSk: `Priesvitnosť obrazovej vrstvy ${Math.round(opacity)} % je mimo rozsahu 1–100 %.`,
        };
      }
      const overlayFilter = String(raw?.filter ?? "NONE").toUpperCase();
      if (!(BURN_KNOWN_FILTERS as readonly string[]).includes(overlayFilter)) {
        return {
          ok: false,
          errorSk: `Neznámy farebný filter „${overlayFilter}" na obrazovej vrstve — známe sú: ${BURN_KNOWN_FILTERS.join(", ")}.`,
        };
      }

      overlays.push({
        clipId: String(raw?.clipId ?? "").slice(0, 80),
        kind: raw?.kind === "video" ? "video" : "image",
        uploadId: overlayUploadId,
        name: safeBaseName(raw?.name, "vrstva"),
        startSec: Math.max(0, startSec),
        endSec: Math.min(endSec, 24 * 3600),
        scalePercent,
        positionX: num(raw?.positionX, 0),
        positionY: num(raw?.positionY, 0),
        rotation,
        opacity,
        filter: overlayFilter,
      });
    }
  }

  /** KROK 24: merané zosúladenie svetla — voliteľné, ale keď príde, musí byť platné a v limitoch. */
  const rawLight = body?.lightCorrection;
  let lightCorrection: LightCorrection | null = null;
  if (rawLight && typeof rawLight === "object") {
    const rl = rawLight as Record<string, any>;
    const candidate: LightCorrection = {
      source: { brightness: num(rl.source?.brightness, NaN), contrast: num(rl.source?.contrast, NaN) },
      target: { brightness: num(rl.target?.brightness, NaN), contrast: num(rl.target?.contrast, NaN) },
      strengthPercent: num(rl.strengthPercent, 100),
      ffmpegBrightness: num(rl.ffmpegBrightness, 0),
      ffmpegContrast: num(rl.ffmpegContrast, 1),
      noteSk: String(rl.noteSk ?? ""),
    };
    const valid =
      Number.isFinite(candidate.source.brightness) &&
      Number.isFinite(candidate.source.contrast) &&
      Number.isFinite(candidate.target.brightness) &&
      Number.isFinite(candidate.target.contrast) &&
      lightCorrectionWithinLimits(candidate);
    if (!valid) {
      return {
        ok: false,
        errorSk:
          "Merané zosúladenie svetla prišlo v neplatných hodnotách (chýbajú namerané čísla alebo sú mimo bezpečných limitov) — radšej sa nevykreslí nič, než pokazený obraz.",
      };
    }
    lightCorrection = candidate;
  }

  const baseFilter = String(body?.baseFilter ?? "NONE").toUpperCase();
  if (!(BURN_KNOWN_FILTERS as readonly string[]).includes(baseFilter)) {
    return {
      ok: false,
      errorSk: `Neznámy farebný filter „${baseFilter}" na videu — známe sú: ${BURN_KNOWN_FILTERS.join(", ")}.`,
    };
  }

  const uploadName = safeBaseName(body.uploadName, "video.mp4");
  const stem = path.basename(uploadName, path.extname(uploadName)) || "video";
  const outputName = `omnistrih-titulky-${stem}-${Date.now()}.mp4`.replace(/[^\w.\-]+/g, "-");

  const fontFamily =
    typeof body.fontFamily === "string" && body.fontFamily.trim()
      ? body.fontFamily.trim().slice(0, 40)
      : undefined;

  const normalized = normalizeOverrides(body.overrides);

  return {
    ok: true,
    spec: {
      uploadId,
      uploadName,
      outputName,
      segments,
      styleId,
      width,
      height,
      keepRanges,
      zoom,
      baseFilter,
      lightCorrection,
      overlays,
      ...(Object.keys(normalized.overrides).length > 0 ? { overrides: normalized.overrides } : {}),
      ...(normalized.notesSk.length > 0 ? { overrideNotesSk: normalized.notesSk } : {}),
      ...(fontFamily ? { fontFamily } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Priebeh z ffmpeg
// ---------------------------------------------------------------------------

/**
 * Číta jednu riadku z `-progress pipe:1` a vráti percentá (alebo null, keď
 * riadok o priebehu nič nehovorí).
 *
 * Pozor na dve veci, ktoré v praxi kazia percentá:
 *  - `out_time_ms` je v ffmpeg **tiež v mikrosekundách** (napriek názvu),
 *  - `out_time_us` môže byť záporné hneď na začiatku (–1) — vtedy radšej
 *    neposielať nič než poslať „-0 %“.
 */
export function parseFfmpegProgress(line: string, totalSeconds: number): number | null {
  const text = String(line ?? "").trim();
  if (!text) return null;
  if (text === "progress=end") return 100;

  const m = text.match(/^out_time_(?:us|ms)=(-?\d+)$/);
  if (m) {
    const micros = Number(m[1]);
    if (!Number.isFinite(micros) || micros < 0) return null;
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return null;
    const percent = (micros / 1_000_000 / totalSeconds) * 100;
    return Math.max(0, Math.min(99, Math.round(percent)));
  }

  const t = text.match(/^out_time=(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/);
  if (t && Number.isFinite(totalSeconds) && totalSeconds > 0) {
    const seconds = Number(t[1]) * 3600 + Number(t[2]) * 60 + Number(t[3]);
    return Math.max(0, Math.min(99, Math.round((seconds / totalSeconds) * 100)));
  }

  return null;
}

// ---------------------------------------------------------------------------
// Stavová mašina renderu
// ---------------------------------------------------------------------------

export type BurnJobState = "queued" | "rendering" | "done" | "error" | "canceled";

export interface BurnJobResult {
  outputName: string;
  outputUrl: string;
  sizeBytes: number;
  clipDurationSec: number;
  summarySk: string;
  /** Priebeh z ffmpeg: koľkokrát sa klip prekódoval (speed=1.2x). */
  speed?: string;
}

export interface BurnJob {
  id: string;
  state: BurnJobState;
  /** 0–100; nikdy nie 100, kým ffmpeg nedobehol. */
  percent: number;
  messageSk: string;
  styleId: CaptionStyleId;
  width: number;
  height: number;
  keepCount: number;
  createdAt: number;
  finishedAt?: number;
  result?: BurnJobResult;
  errorSk?: string;
  /** Posledných pár riadkov z ffmpeg — aby chyba mala dôvod, nie „zlyhalo“. */
  logTail: string[];
}

export function createBurnJob(partial: {
  id: string;
  styleId: CaptionStyleId;
  width: number;
  height: number;
  keepCount: number;
  messageSk?: string;
}): BurnJob {
  return {
    id: partial.id,
    state: "queued",
    percent: 0,
    messageSk: partial.messageSk ?? "Pripravujem vypálenie titulkov…",
    styleId: partial.styleId,
    width: partial.width,
    height: partial.height,
    keepCount: partial.keepCount,
    createdAt: Date.now(),
    logTail: [],
  };
}

/** Krátky, ľudský stavový objekt pre klienta (bez interného logu). */
export function burnJobStatus(job: BurnJob) {
  return {
    id: job.id,
    state: job.state,
    percent: job.percent,
    messageSk: job.messageSk,
    styleId: job.styleId,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt ?? null,
    result: job.result ?? null,
    errorSk: job.errorSk ?? null,
  };
}

export class BurnJobStore {
  private jobs = new Map<string, BurnJob>();
  private order: string[] = [];

  constructor(private readonly keep = 20) {}

  create(partial: { styleId: CaptionStyleId; width: number; height: number; keepCount: number }): BurnJob {
    const job = createBurnJob({ id: randomUUID(), ...partial });
    this.jobs.set(job.id, job);
    this.order.push(job.id);
    while (this.order.length > this.keep) {
      const oldest = this.order.shift();
      if (oldest && this.jobs.get(oldest)?.state !== "rendering") this.jobs.delete(oldest);
      else if (oldest) this.order.push(oldest);
    }
    return job;
  }

  get(id: string): BurnJob | undefined {
    return this.jobs.get(String(id ?? ""));
  }

  /** Posun stavu; percentá nikdy neklesajú a nikdy neukážu 100 pred koncom. */
  patch(id: string, patch: Partial<BurnJob>): BurnJob | undefined {
    const job = this.jobs.get(String(id ?? ""));
    if (!job) return undefined;
    if (patch.percent !== undefined) {
      patch.percent = Math.max(job.percent, Math.max(0, Math.min(99, Math.round(patch.percent))));
    }
    Object.assign(job, patch);
    return job;
  }

  finish(id: string, result: BurnJobResult, messageSk = "Hotovo — titulky sú vypálené."): BurnJob | undefined {
    const job = this.jobs.get(String(id ?? ""));
    if (!job) return undefined;
    job.state = "done";
    job.percent = 100;
    job.messageSk = messageSk;
    job.result = result;
    job.finishedAt = Date.now();
    return job;
  }

  fail(id: string, errorSk: string, logTail: string[] = []): BurnJob | undefined {
    const job = this.jobs.get(String(id ?? ""));
    if (!job) return undefined;
    job.state = "error";
    job.errorSk = errorSk;
    job.messageSk = errorSk;
    job.finishedAt = Date.now();
    if (logTail.length) job.logTail = logTail.slice(-12);
    return job;
  }

  cancel(id: string): BurnJob | undefined {
    const job = this.jobs.get(String(id ?? ""));
    if (!job) return undefined;
    if (job.state === "done" || job.state === "error") return job;
    job.state = "canceled";
    job.messageSk = "Render som zastavil. Rozpracovaný súbor sa zahodil — zdrojové video je nedotknuté.";
    job.finishedAt = Date.now();
    return job;
  }
}

// ---------------------------------------------------------------------------
// Upratovanie v .data
// ---------------------------------------------------------------------------

/**
 * Nechá v adresári len najnovších `keep` súborov. Render ukladá veľké MP4 —
 * bez tohto by disk rástol pri každom pokuse (a to aj nepodarenom).
 * Vracia počet zmazaných súborov.
 */
export function pruneDir(dir: string, keep: number, maxAgeMs?: number): number {
  let removed = 0;
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return 0;
  }

  const files = entries
    .map((name) => {
      const full = path.join(dir, name);
      try {
        const stat = fs.statSync(full);
        return stat.isFile() ? { name, full, mtimeMs: stat.mtimeMs } : null;
      } catch {
        return null;
      }
    })
    .filter((x): x is { name: string; full: string; mtimeMs: number } => x !== null)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  const now = Date.now();
  files.forEach((f, idx) => {
    const tooOld = maxAgeMs !== undefined && now - f.mtimeMs > maxAgeMs;
    if (idx < keep && !tooOld) return;
    try {
      fs.unlinkSync(f.full);
      removed++;
    } catch {
      /* súbor medzitým zmizol — nič sa nedeje */
    }
  });

  return removed;
}

/** Koľko miesta zaberajú uložené videá (informácia pre UI). */
export function dirSizeBytes(dir: string): number {
  try {
    return fs
      .readdirSync(dir)
      .map((n) => {
        try {
          return fs.statSync(path.join(dir, n)).size;
        } catch {
          return 0;
        }
      })
      .reduce((a, b) => a + b, 0);
  } catch {
    return 0;
  }
}

/** Vyčistí zoznam segmentov od zbytočných polí (menší upload, žiadne tajomstvá). */
export function slimSegments(segments: SpeechSegmentLike[]): SpeechSegmentLike[] {
  return (Array.isArray(segments) ? segments : []).map((s) => ({
    start: Number(s.start) || 0,
    end: Number(s.end) || 0,
    text: String(s.text ?? ""),
    ...(Array.isArray(s.words) && s.words.length
      ? {
          words: s.words.map((w) => ({
            word: String(w?.word ?? ""),
            start: Number(w?.start) || 0,
            end: Number(w?.end) || 0,
          })),
        }
      : {}),
  }));
}

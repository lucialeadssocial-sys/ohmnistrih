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
  CAPTION_STYLES,
  type CaptionStyleId,
  type KeepRange,
} from "./subtitleRender";
import { normalizeKeepRanges } from "./subtitleRender";
import type { SpeechSegmentLike } from "../transcript/wordTiming";

export const BURN_LIMITS = {
  /** Väčšie video = dlhší upload do .data; nad týmto radšej poctivo odmietnuť. */
  maxUploadBytes: 512 * 1024 * 1024,
  maxCaptionSegments: 5000,
  maxKeepRanges: 500,
  minDim: 64,
  maxDim: 8192,
  maxStoredExports: 25,
  maxStoredUploads: 10,
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
  width: number;
  height: number;
  keepRanges: KeepRange[];
  fontFamily?: string;
}

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

  const uploadName = safeBaseName(body.uploadName, "video.mp4");
  const stem = path.basename(uploadName, path.extname(uploadName)) || "video";
  const outputName = `omnistrih-titulky-${stem}-${Date.now()}.mp4`.replace(/[^\w.\-]+/g, "-");

  const fontFamily =
    typeof body.fontFamily === "string" && body.fontFamily.trim()
      ? body.fontFamily.trim().slice(0, 40)
      : undefined;

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

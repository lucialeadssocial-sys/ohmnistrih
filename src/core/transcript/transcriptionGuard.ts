/**
 * PREPIS — poctivé rozhodovanie o výsledku (krok „REAL DATA“).
 *
 * Prečo tento modul existuje: pri reálnej verifikácii sa ukázalo, že preťažený
 * model (HTTP 503) sa v appke **tváril ako „v tomto videu nie je reč“**. Používateľ
 * potom zbytočne hľadal chybu vo svojom videe. Tu je preto jediné miesto, kde sa
 * rozhoduje, čo je úspech, čo je ticho a čo je **chyba s dôvodom**.
 *
 * Modul je čistý (bez siete a bez providera) → dá sa testovať.
 */

export interface TranscriptionSegmentLike {
  id?: string;
  start: number;
  end: number;
  text: string;
  words?: { word: string; start: number; end: number; highlight?: boolean }[];
}

export type TranscriptionOutcome =
  | { kind: "OK"; segments: TranscriptionSegmentLike[]; modelUsed?: string }
  | { kind: "NO_SPEECH"; messageSk: string }
  | { kind: "ERROR"; httpStatus: number; code: TranscriptionErrorCode; errorSk: string; modelsTried: string[]; rawPreview?: string };

export type TranscriptionErrorCode = "TRANSCRIPTION_FAILED" | "TRANSCRIPTION_UNPARSABLE" | "TRANSCRIPTION_NO_RESPONSE";

/**
 * Poradie modelov: preferovaný z kľúča, potom overené alternatívy (bez duplicít).
 *
 * Poznámka z reálneho behu (30. 9. 2026): `gemini-2.5-flash` už **nie je dostupný
 * novým používateľom** (HTTP 404) a `gemini-3.8-flash` / `gemini-3.5-flash` bývajú
 * preťažené (503). Preto je v reťazi viac modelov vrátane `gemini-flash-latest`
 * a `gemini-3.5-flash-lite` — keď jeden padne, skúsi sa iný.
 */
export function buildTranscriptionModelChain(preferred?: string | null): string[] {
  const chain = [
    preferred,
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-flash-latest",
  ];
  return Array.from(new Set(chain.filter((m): m is string => typeof m === "string" && m.trim().length > 0)));
}

/**
 * Má zmysel skúsiť znova (iný model / druhý pokus)?
 * Sem patrí preťaženie a dočasné výpadky — NIE chyby typu „zlé dáta“ či „nemám právo“.
 */
export function isRetryableTranscriptionError(err: unknown): boolean {
  const anyErr = err as { status?: number; code?: number | string; message?: string } | null;
  const status = Number(anyErr?.status ?? anyErr?.code ?? NaN);
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) return true;
  const message = String(anyErr?.message ?? "");
  return /high demand|overloaded|UNAVAILABLE|RESOURCE_EXHAUSTED|deadline|timeout|rate limit/i.test(message);
}

/** Krátky, čitateľný dôvod pre človeka (nikdy nevyzerá ako „ticho vo videu“). */
export function describeTranscriptionErrorSk(err: unknown): string {
  const anyErr = err as { status?: number; message?: string } | null;
  const status = anyErr?.status;
  const message = String(anyErr?.message ?? err ?? "").slice(0, 200);
  if (status === 503 || /high demand|overloaded|UNAVAILABLE/i.test(message)) {
    return "AI model je práve preťažený (nie je to chyba tvojho videa). Skús to o chvíľu znova.";
  }
  if (status === 429) {
    return "Dosiahli sme limit volaní AI (nie je to chyba tvojho videa). Skús neskôr alebo pridaj ďalší kľúč.";
  }
  if (status === 401 || status === 403) {
    return "AI kľúč bol odmietnutý (chybné alebo neplatné oprávnenie).";
  }
  return message.length > 0 ? message : "neznáma chyba";
}

/**
 * Z odpovede modelu spraví výsledok — a **nikdy nezamení chybu za ticho**.
 *
 * @param parsed  JSON, ktorý model vrátil (alebo `null`, ak sa nedal prečítať)
 * @param rawText surová odpoveď (na ukážku, keď sa nedá prečítať)
 */
export function classifyTranscriptionResponse(
  parsed: unknown,
  rawText: string,
  modelsTried: string[],
  modelUsed?: string,
): TranscriptionOutcome {
  if (parsed === null || typeof parsed !== "object") {
    return {
      kind: "ERROR",
      httpStatus: 502,
      code: "TRANSCRIPTION_UNPARSABLE",
      errorSk: "AI odpovedala nečitateľne (odpoveď sa nedá prečítať ako JSON). Skús znova.",
      modelsTried,
      rawPreview: String(rawText ?? "").slice(0, 300),
    };
  }

  const obj = parsed as { hasSpeech?: unknown; segments?: unknown };
  if (typeof obj.hasSpeech !== "boolean") {
    return {
      kind: "ERROR",
      httpStatus: 502,
      code: "TRANSCRIPTION_UNPARSABLE",
      errorSk: "AI odpovedala v nečakanom formáte (chýba údaj o reči). Nič som nedomýšľal.",
      modelsTried,
      rawPreview: String(rawText ?? "").slice(0, 300),
    };
  }

  const segments = Array.isArray(obj.segments) ? (obj.segments as TranscriptionSegmentLike[]) : [];

  if (obj.hasSpeech === false) {
    return {
      kind: "NO_SPEECH",
      messageSk: "V tomto videu sa nepodarilo nájsť hovorené slovo.",
    };
  }

  if (segments.length === 0) {
    // Model tvrdí, že reč je, ale neposlal žiadny segment → to je chyba, nie ticho.
    return {
      kind: "ERROR",
      httpStatus: 502,
      code: "TRANSCRIPTION_UNPARSABLE",
      errorSk: "AI tvrdí, že v audio je reč, ale neposlala žiadne titulky. Skús to znova.",
      modelsTried,
    };
  }

  return { kind: "OK", segments, modelUsed };
}

/** Rovnaká odpoveď pre klienta, nech sa to v appke správa jednotne. */
export function transcriptionOutcomeToResponse(outcome: TranscriptionOutcome): {
  httpStatus: number;
  body: Record<string, unknown>;
} {
  switch (outcome.kind) {
    case "OK":
      return {
        httpStatus: 200,
        body: { success: true, hasSpeech: true, segments: outcome.segments, modelUsed: outcome.modelUsed },
      };
    case "NO_SPEECH":
      return { httpStatus: 200, body: { success: true, hasSpeech: false, message: outcome.messageSk, segments: [] } };
    case "ERROR":
      return {
        httpStatus: outcome.httpStatus,
        body: {
          success: false,
          hasSpeech: false,
          error: outcome.code,
          errorSk: outcome.errorSk,
          modelsTried: outcome.modelsTried,
          ...(outcome.rawPreview ? { rawPreview: outcome.rawPreview } : {}),
          segments: [],
        },
      };
  }
}

/**
 * Ako má KLIENT rozumieť odpovedi servera.
 *
 * Dôvod: presne tu vznikala tichá chyba — prehliadač dostal odpoveď, ktorá sa
 * nedala odlíšiť od „v audiu nič nie je“, a používateľ videl ticho. Teraz má
 * klient jediné pravidlo: chyba = viditeľný dôvod, ticho len keď to AI naozaj povie.
 */
export type ClientTranscriptionView =
  | { kind: "OK"; segments: TranscriptionSegmentLike[]; modelUsed?: string }
  | { kind: "NO_SPEECH"; toastSk: string }
  | { kind: "ERROR"; toastSk: string; modelsTried: string[] };

export function interpretTranscriptionClientResponse(data: unknown, isSk = true): ClientTranscriptionView {
  const d = (data ?? {}) as {
    success?: unknown;
    hasSpeech?: unknown;
    segments?: unknown;
    error?: unknown;
    errorSk?: unknown;
    modelsTried?: unknown;
  };
  const modelsTried = Array.isArray(d.modelsTried) ? (d.modelsTried as string[]) : [];

  if (d.success === false) {
    const reason =
      (typeof d.errorSk === "string" && d.errorSk.trim().length > 0 ? d.errorSk : "") ||
      (d.error === "TRANSCRIPTION_FAILED"
        ? isSk
          ? "AI práve neodpovedala (preťažený model alebo sieť) — nie je to chyba tvojho videa."
          : "AI did not respond (overloaded model or network)."
        : isSk
          ? "Prepis zlyhal."
          : "Transcription failed.");
    const suffix = modelsTried.length > 0 ? ` [${modelsTried.join(", ")}]` : "";
    return { kind: "ERROR", toastSk: `⚠️ ${reason}${suffix}`, modelsTried };
  }

  const segments = Array.isArray(d.segments) ? (d.segments as TranscriptionSegmentLike[]) : [];
  if (d.hasSpeech === true && segments.length > 0) {
    return {
      kind: "OK",
      segments,
      modelUsed: typeof (data as { modelUsed?: unknown })?.modelUsed === "string" ? (data as { modelUsed: string }).modelUsed : undefined,
    };
  }

  return {
    kind: "NO_SPEECH",
    toastSk: isSk ? "V tomto videu sa nepodarilo nájsť hovorené slovo." : "No spoken speech found in this video.",
  };
}

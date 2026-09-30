import { describe, expect, test } from "bun:test";
import {
  buildTranscriptionModelChain,
  classifyTranscriptionResponse,
  describeTranscriptionErrorSk,
  interpretTranscriptionClientResponse,
  isRetryableTranscriptionError,
  transcriptionOutcomeToResponse,
} from "../src/core/transcript/transcriptionGuard";

/**
 * Testy poctivosti prepisu. Vznikli z REÁLNEJ chyby nájdenej pri real-media
 * verifikácii: model vrátil 503 (preťažený) a appka to vydala za
 * „v tomto videu nie je reč“ — používateľ potom hľadal chybu vo svojom videe.
 */

describe("prepis: chyba sa NIKDY nesmie tváriť ako ticho", () => {
  test("no-speech vznikne len vtedy, keď to model naozaj povie", () => {
    const out = classifyTranscriptionResponse({ hasSpeech: false, segments: [] }, "{}", ["gemini-3.8-flash"]);
    expect(out.kind).toBe("NO_SPEECH");
    const body = transcriptionOutcomeToResponse(out).body;
    expect(body.success).toBe(true);
    expect(body.error).toBeUndefined();
  });

  test("nečitateľná odpoveď = chyba s dôvodom (nie ticho)", () => {
    const out = classifyTranscriptionResponse(null, "Server Error 503", ["gemini-3.8-flash"]);
    expect(out.kind).toBe("ERROR");
    const res = transcriptionOutcomeToResponse(out);
    expect(res.httpStatus).toBe(502);
    expect(res.body.success).toBe(false);
    expect(String(res.body.errorSk)).toMatch(/nečitateľne|nedá prečítať/i);
    expect(res.body.modelsTried).toEqual(["gemini-3.8-flash"]);
    expect(res.body.segments).toEqual([]);
  });

  test("odpoveď bez údaja o reči = chyba, nie ticho", () => {
    const out = classifyTranscriptionResponse({ text: "ahoj" }, "{}", []);
    expect(out.kind).toBe("ERROR");
    expect(transcriptionOutcomeToResponse(out).httpStatus).toBe(502);
  });

  test("model tvrdí, že reč je, ale nepošle titulky = chyba", () => {
    const out = classifyTranscriptionResponse({ hasSpeech: true, segments: [] }, "{}", []);
    expect(out.kind).toBe("ERROR");
    expect(String((out as { errorSk: string }).errorSk)).toMatch(/neposlala žiadne titulky/i);
  });

  test("úspech nesie segmenty a model, ktorý ich spravil", () => {
    const segs = [{ id: "cap-1", start: 0, end: 1.2, text: "Ahoj", words: [{ word: "Ahoj", start: 0, end: 1.2 }] }];
    const out = classifyTranscriptionResponse({ hasSpeech: true, segments: segs }, "{}", ["gemini-3.8-flash"], "gemini-3.5-flash");
    expect(out.kind).toBe("OK");
    if (out.kind !== "OK") return;
    expect(out.segments).toHaveLength(1);
    expect(out.modelUsed).toBe("gemini-3.5-flash");
    const res = transcriptionOutcomeToResponse(out);
    expect(res.httpStatus).toBe(200);
    expect(res.body.hasSpeech).toBe(true);
  });
});

describe("prepis: fallback modelov a rozpoznanie dočasnej chyby", () => {
  test("reťaz modelov má preferovaný prvý a žiadne duplicity", () => {
    const chain = buildTranscriptionModelChain("gemini-3.5-flash");
    expect(chain[0]).toBe("gemini-3.5-flash");
    expect(new Set(chain).size).toBe(chain.length);
    expect(chain).toContain("gemini-3.8-flash");
    expect(chain.length).toBeGreaterThanOrEqual(3); // keď je jeden preťažený, skúsi sa iný
    expect(buildTranscriptionModelChain(null)).toContain("gemini-3.8-flash");
  });

  test("mŕtvy model (gemini-2.5-flash, HTTP 404 novým používateľom) nie je v reťazi", () => {
    expect(buildTranscriptionModelChain(null)).not.toContain("gemini-2.5-flash");
    expect(buildTranscriptionModelChain("gemini-2.5-flash")).toContain("gemini-2.5-flash"); // ak si ho kľúč vymení, rešpektujeme voľbu
  });

  test("preťaženie a dočasné výpadky sú opakovateľné, zlé dáta nie", () => {
    expect(isRetryableTranscriptionError({ status: 503 })).toBe(true);
    expect(isRetryableTranscriptionError({ status: 429 })).toBe(true);
    expect(isRetryableTranscriptionError({ message: "This model is currently experiencing high demand." })).toBe(true);
    expect(isRetryableTranscriptionError({ status: 401, message: "API key not valid" })).toBe(false);
    expect(isRetryableTranscriptionError({ status: 400, message: "Invalid argument" })).toBe(false);
  });

  test("dôvod pre človeka je zrozumiteľný a neobviňuje video", () => {
    expect(describeTranscriptionErrorSk({ status: 503 })).toMatch(/preťažený/);
    expect(describeTranscriptionErrorSk({ status: 503 })).toMatch(/nie je to chyba tvojho videa/);
    expect(describeTranscriptionErrorSk({ status: 429 })).toMatch(/limit volaní/);
    expect(describeTranscriptionErrorSk({ status: 401 })).toMatch(/odmietnutý/);
    expect(describeTranscriptionErrorSk({ message: "niečo iné" })).toBe("niečo iné");
  });
});

describe("prepis: klient nesmie splynúť chybu s tichom", () => {
  test("chybová odpoveď servera → viditeľný dôvod (nikdy ticho)", () => {
    const view = interpretTranscriptionClientResponse({
      success: false,
      hasSpeech: false,
      error: "TRANSCRIPTION_FAILED",
      errorSk: "AI model je práve preťažený (nie je to chyba tvojho videa). Skús to o chvíľu znova.",
      modelsTried: ["gemini-3.8-flash", "gemini-3.5-flash"],
    });
    expect(view.kind).toBe("ERROR");
    if (view.kind !== "ERROR") return;
    expect(view.toastSk).toContain("preťažený");
    expect(view.toastSk).toContain("nie je to chyba tvojho videa");
    expect(view.toastSk).toContain("gemini-3.8-flash");
    expect(view.modelsTried).toHaveLength(2);
  });

  test("chyba bez slovenského dôvodu dostane zrozumiteľnú vetu", () => {
    const view = interpretTranscriptionClientResponse({ success: false, error: "TRANSCRIPTION_FAILED" });
    expect(view.kind).toBe("ERROR");
    if (view.kind !== "ERROR") return;
    expect(view.toastSk).toMatch(/AI práve neodpovedala/);
  });

  test("ticho je ticho len keď to server naozaj povie", () => {
    const view = interpretTranscriptionClientResponse({ success: true, hasSpeech: false, segments: [] });
    expect(view.kind).toBe("NO_SPEECH");
  });

  test("prázdne segmenty s tvrdením „reč je“ neprejdú ako úspech", () => {
    const view = interpretTranscriptionClientResponse({ success: true, hasSpeech: true, segments: [] });
    expect(view.kind).toBe("NO_SPEECH"); // server to už vracia ako chybu; klient nesmie tvrdiť úspech
    expect(view.kind).not.toBe("OK");
  });

  test("úspech prenesie segmenty ďalej", () => {
    const segs = [{ id: "c1", start: 0, end: 1, text: "Ahoj", words: [] }];
    const view = interpretTranscriptionClientResponse({ success: true, hasSpeech: true, segments: segs, modelUsed: "gemini-3.8-flash" });
    expect(view.kind).toBe("OK");
    if (view.kind !== "OK") return;
    expect(view.segments).toHaveLength(1);
    expect(view.modelUsed).toBe("gemini-3.8-flash");
  });
});

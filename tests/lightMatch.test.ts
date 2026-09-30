import { describe, expect, test } from "bun:test";
import {
  LIGHT_CORRECTION_LIMITS,
  lightStatsFromGrayFrames,
  computeLightCorrection,
  lightCorrectionCss,
  lightCorrectionFfmpeg,
  lightCorrectionWithinLimits,
} from "../src/core/export/lightMatch";

/**
 * KROK 24 — MERANÉ ZOSÚLADENIE SVETLA.
 *
 * Testy strážia, že korekcia je deterministická, nikdy nevymýšľa čísla,
 * drží bezpečné limity a že export aj náhľad dostanú tie isté hodnoty.
 */

describe("A) výpočet korekcie z nameraných čísel", () => {
  test("A1 — tmavšie zdrojové video sa zosvetlí na referenciu", () => {
    const c = computeLightCorrection({ brightness: 87, contrast: 55 }, { brightness: 114, contrast: 55.8 })!;
    expect(c).toBeTruthy();
    expect(c.ffmpegBrightness).toBeGreaterThan(0); // pridá jas
    expect(c.ffmpegContrast).toBeCloseTo(1.01, 2);
    expect(c.noteSk).toContain("referencia");
  });

  test("A2 — svetlejšie zdrojové video sa stlmí (záporná korekcia)", () => {
    const c = computeLightCorrection({ brightness: 162, contrast: 55.7 }, { brightness: 87.5, contrast: 55.9 })!;
    expect(c.ffmpegBrightness).toBeLessThan(0);
  });

  test("A3 — rovnaké video a referencia ⇒ žiadna korekcia (null, nie vymyslená nula)", () => {
    expect(computeLightCorrection({ brightness: 100, contrast: 50 }, { brightness: 100, contrast: 50 })).toBeNull();
  });

  test("A4 — chýbajúce namerané hodnoty ⇒ null (radšej nič než odhad)", () => {
    expect(computeLightCorrection({ brightness: NaN, contrast: 50 }, { brightness: 100, contrast: 50 })).toBeNull();
    expect(computeLightCorrection({ brightness: 100, contrast: 50 }, { brightness: Infinity, contrast: 50 })).toBeNull();
  });

  test("A5 — sila 0 % znamená žiadnu korekciu", () => {
    expect(
      computeLightCorrection({ brightness: 50, contrast: 50 }, { brightness: 150, contrast: 50 }, { strengthPercent: 0 }),
    ).toBeNull();
  });

  test("A6 — sila 50 % je polovica cesty k ich svetlu", () => {
    const full = computeLightCorrection({ brightness: 100, contrast: 50 }, { brightness: 130, contrast: 50 })!;
    const half = computeLightCorrection({ brightness: 100, contrast: 50 }, { brightness: 130, contrast: 50 }, { strengthPercent: 50 })!;
    expect(Math.abs(half.ffmpegBrightness)).toBeLessThan(Math.abs(full.ffmpegBrightness));
    expect(half.ffmpegBrightness).toBeCloseTo(full.ffmpegBrightness / 2, 3);
  });

  test("A7 — pri veľkom rozdiele appka prizná, že jas narazil na bezpečný limit", () => {
    const c = computeLightCorrection({ brightness: 50, contrast: 50 }, { brightness: 200, contrast: 50 })!;
    expect(c.ffmpegBrightness).toBe(LIGHT_CORRECTION_LIMITS.maxFfmpegBrightness);
    expect(c.noteSk).toContain("bezpečný limit");
  });
});

describe("B) bezpečné limity (aby napodobnenie nezničilo obraz)", () => {
  test("B1 — extrémny rozdiel ostáva v limitoch a appka to prizná", () => {
    const c = computeLightCorrection({ brightness: 0, contrast: 20 }, { brightness: 255, contrast: 200 })!;
    expect(lightCorrectionWithinLimits(c)).toBe(true);
    expect(c.noteSk).toContain("limit");
    expect(c.noteSk).toContain("kontrast");
  });

  test("B5 — tmavé video: zvyšovanie kontrastu by ho ešte stlmilo, preto appka kontrast NEZVÝŠI", () => {
    // Namerané naozaj: tmavý klip 22 / 0,23 vs jeho video 142 / 57,6.
    const c = computeLightCorrection({ brightness: 22.03, contrast: 0.23 }, { brightness: 142.27, contrast: 57.6 })!;
    expect(c.ffmpegContrast).toBeLessThanOrEqual(1);
    expect(c.ffmpegBrightness).toBe(LIGHT_CORRECTION_LIMITS.maxFfmpegBrightness);
    expect(c.noteSk).toContain("hľadal som najbližší dosiahnuteľný výsledok");

  });

  test("B2 — extrémne tmavý cieľ tiež ostáva v limitoch", () => {
    const c = computeLightCorrection({ brightness: 255, contrast: 200 }, { brightness: 5, contrast: 20 })!;
    expect(lightCorrectionWithinLimits(c)).toBe(true);
  });

  test("B3 — kontrast sa nikdy nedostane na nulu (čierna obrazovka)", () => {
    const c = computeLightCorrection({ brightness: 100, contrast: 200 }, { brightness: 100, contrast: 0 })!;
    expect(c.ffmpegContrast).toBeGreaterThanOrEqual(LIGHT_CORRECTION_LIMITS.minFfmpegContrast);
  });

  test("B4 — malý rozdiel je šum merania ⇒ žiadna korekcia", () => {
    expect(computeLightCorrection({ brightness: 100, contrast: 50 }, { brightness: 100.5, contrast: 50.4 })).toBeNull();
  });

  test("B6 — stredný rozdiel trafí ich jas presne (bez orezania)", () => {
    const c = computeLightCorrection({ brightness: 100, contrast: 40 }, { brightness: 130, contrast: 44 })!;
    const mean = (100 / 255 - 0.5) * c.ffmpegContrast + 0.5 + c.ffmpegBrightness;
    expect(mean * 255).toBeCloseTo(130, 0);
    expect(c.noteSk).not.toContain("limit");
  });
});

describe("C) determinizmus a parita export ↔ náhľad", () => {
  test("C1 — rovnaké vstupy dávajú presne rovnaké hodnoty (nula náhody)", () => {
    const a = computeLightCorrection({ brightness: 87, contrast: 55 }, { brightness: 114, contrast: 56 })!;
    const b = computeLightCorrection({ brightness: 87, contrast: 55 }, { brightness: 114, contrast: 56 })!;
    expect(a).toEqual(b);
  });

  test("C2 — export aj náhľad používajú tie isté čísla", () => {
    const c = computeLightCorrection({ brightness: 87, contrast: 55 }, { brightness: 114, contrast: 56 })!;
    const ff = lightCorrectionFfmpeg(c);
    const css = lightCorrectionCss(c);
    expect(ff).toContain(`contrast=${c.ffmpegContrast.toFixed(4)}`);
    expect(css).toContain(`contrast(${(c.ffmpegContrast * 100).toFixed(1)}%)`);
    // jas: ffmpeg sčítava, CSS násobí — oboje musí vyjsť z tej istej hodnoty
    const expectedCssBrightness = (1 + c.ffmpegBrightness) * 100;
    expect(css).toContain(`${expectedCssBrightness.toFixed(1)}%`);
  });

  test("C3 — bez korekcie je filter prázdny reťazec (render nič nemení)", () => {
    expect(lightCorrectionFfmpeg(null)).toBe("");
    expect(lightCorrectionCss(undefined)).toBe("");
  });
});

describe("D) meranie z pixelov (tá istá funkcia pre server aj nástroje)", () => {
  const uniform = (v: number, frames: number, w = 4, h = 4) => {
    const b = new Uint8Array(w * h * frames);
    b.fill(v);
    return b;
  };

  test("D1 — jednofarevná snímka má jas podľa svojej farby a nulový kontrast", () => {
    const s = lightStatsFromGrayFrames(uniform(120, 3), 4, 4)!;
    expect(s.brightness).toBe(120);
    expect(s.contrast).toBe(0);
    expect(s.frames).toBe(3);
  });

  test("D2 — polovica čierna, polovica biela ⇒ jas 127,5 a známa odchýlka", () => {
    const b = new Uint8Array(4 * 4 * 2);
    for (let f = 0; f < 2; f++) {
      for (let i = 0; i < 16; i++) b[f * 16 + i] = i < 8 ? 0 : 255;
    }
    const s = lightStatsFromGrayFrames(b, 4, 4)!;
    expect(s.brightness).toBeCloseTo(127.5, 2);
    expect(s.contrast).toBeCloseTo(127.5, 2);
  });

  test("D3 — málo dát ⇒ null (nič sa nepredstiera)", () => {
    expect(lightStatsFromGrayFrames(new Uint8Array(16), 4, 4)).toBeNull();
    expect(lightStatsFromGrayFrames(new Uint8Array(0), 4, 4)).toBeNull();
  });

  test("D4 — determinizmus: dva behy na tých istých dátach dajú tie isté čísla", () => {
    const b = uniform(77, 5);
    expect(lightStatsFromGrayFrames(b, 4, 4)).toEqual(lightStatsFromGrayFrames(b, 4, 4));
  });
});

describe("E) náhľad kreslí tie isté čísla ako export", () => {
  test("E1 — CSS filter pre náhľad sa skladá s filtrom klipu (nie prepíše)", async () => {
    const { composeCanvasFilters } = await import("../src/core/render/renderEngine");
    const c = computeLightCorrection({ brightness: 87, contrast: 55 }, { brightness: 114, contrast: 56 })!;
    const combined = composeCanvasFilters("contrast(120%) saturate(130%)", lightCorrectionCss(c));
    expect(combined).toContain("contrast(120%) saturate(130%)");
    expect(combined).toContain(lightCorrectionCss(c));
  });

  test("E2 — bez korekcie sa CSS nezmení (žiadne prázdne filtre)", async () => {
    const { composeCanvasFilters } = await import("../src/core/render/renderEngine");
    expect(composeCanvasFilters("sepia(40%)", "")).toBe("sepia(40%)");
    expect(composeCanvasFilters("", "")).toBe("");
    expect(composeCanvasFilters(null, undefined)).toBe("");
  });

  test("E3 — korekcia pre náhľad aj export pochádza z tých istých nameraných čísel", () => {
    const c = computeLightCorrection({ brightness: 22.03, contrast: 0.23 }, { brightness: 142.27, contrast: 57.6 })!;
    const ff = lightCorrectionFfmpeg(c);
    const css = lightCorrectionCss(c);
    expect(ff).toContain(`brightness=${c.ffmpegBrightness.toFixed(4)}`);
    expect(ff).toContain(`contrast=${c.ffmpegContrast.toFixed(4)}`);
    expect(css).toContain(`contrast(${(c.ffmpegContrast * 100).toFixed(1)}%)`);
  });
});

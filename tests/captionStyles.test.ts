import { describe, expect, test } from "bun:test";

import {
  CAPTION_STYLES,
  buildAssFile,
  countStrongWords,
  getCaptionStyle,
  isStrongCaptionWord,
} from "../src/core/export/subtitleRender";
import { adviseCaptionStyle, adviceInputFromContext } from "../src/core/export/captionAdvisor";
import { assColorToCss, buildCaptionPreview, scaleToFactor } from "../src/core/export/captionPreview";
import type { SpeechSegmentLike } from "../src/core/transcript/wordTiming";

/**
 * Testy „Možnosti výberu tituliek“ (krok B+):
 *  1. katalóg štýlov — zmes najlepších nástrojov musí byť kompletná a poctivá,
 *  2. inteligentné zvýrazňovanie (čísla a silné slová) — pravidlo, nie AI,
 *  3. poradca — odporúčanie musí mať dôvod a musí sa meniť podľa vstupu,
 *  4. náhľad bez renderovania — farby a veľkosti musia sedieť na ASS.
 */

const SPEECH: SpeechSegmentLike[] = [
  {
    start: 0.2,
    end: 2.0,
    text: "Dnes si ukážeme trik, ktorý mi ušetril 3 000 € mesačne.",
    words: [
      { word: "Dnes", start: 0.2, end: 0.5 },
      { word: "si", start: 0.52, end: 0.7 },
      { word: "ukážeme", start: 0.72, end: 1.1 },
      { word: "trik,", start: 1.12, end: 1.4 },
      { word: "ktorý", start: 1.42, end: 1.6 },
      { word: "mi", start: 1.62, end: 1.75 },
      { word: "ušetril", start: 1.77, end: 2.0 },
    ],
  },
];

// ---------------------------------------------------------------------------
// 1. Katalóg štýlov
// ---------------------------------------------------------------------------

describe("katalóg štýlov titulkov", () => {
  test("obsahuje deväť štýlov v troch kategóriách (zmes najlepších nástrojov)", () => {
    expect(CAPTION_STYLES.length).toBe(9);
    const cats = new Set(CAPTION_STYLES.map((s) => s.category));
    expect(cats).toEqual(new Set(["viralne", "ciste", "brand"]));
  });

  test("každý štýl povie, na čo je a odkiaľ princíp je (žiadne tajnosti)", () => {
    for (const s of CAPTION_STYLES) {
      expect(s.bestForSk.length).toBeGreaterThan(10);
      expect(s.inspirationSk.length).toBeGreaterThan(5);
      expect(s.descriptionSk.length).toBeGreaterThan(20);
      expect(s.bottomMarginRatio).toBeGreaterThanOrEqual(0.1);
      expect(typeof s.highlightMode).toBe("string");
    }
  });

  test("id sú unikátne (výber podľa id musí byť jednoznačný)", () => {
    const ids = CAPTION_STYLES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("štýly, ktoré zvýrazňujú hovorené slovo, to priznajú (potrebujú časovanie)", () => {
    for (const s of CAPTION_STYLES) {
      if (s.highlightMode === "active-word") expect(s.highlightNeedsWordTiming).toBe(true);
      if (s.highlightMode === "none") expect(s.highlightColor).toBe(s.primaryColor);
    }
  });

  test("iba jeden štýl je placka a má farbu podkladu", () => {
    const boxed = CAPTION_STYLES.filter((s) => s.boxed);
    expect(boxed.length).toBe(1);
    expect(boxed[0].boxColor).toBeTruthy();
    expect(boxed[0].id).toBe("NEON_BOX");
  });
});

// ---------------------------------------------------------------------------
// 2. Inteligentné zvýrazňovanie
// ---------------------------------------------------------------------------

describe("silné slová (čísla, peniaze, kontrasty)", () => {
  test("čísla a meny sú silné slová", () => {
    expect(isStrongCaptionWord("3")).toBe(true);
    expect(isStrongCaptionWord("3 000")).toBe(true);
    expect(isStrongCaptionWord("95%")).toBe(true);
    expect(isStrongCaptionWord("€")).toBe(true);
    expect(isStrongCaptionWord("2x")).toBe(true);
  });

  test("slová z krátkeho zoznamu sú silné (a diakritika neprekáža)", () => {
    expect(isStrongCaptionWord("zadarmo")).toBe(true);
    expect(isStrongCaptionWord("zdarma")).toBe(true);
    expect(isStrongCaptionWord("TRIK")).toBe(true);
    expect(isStrongCaptionWord("tajný")).toBe(true);
    expect(isStrongCaptionWord("výsledok")).toBe(true);
  });

  test("bežné slová silné nie sú (nič sa nezdôrazňuje zbytočne)", () => {
    expect(isStrongCaptionWord("a")).toBe(false);
    expect(isStrongCaptionWord("ktorý")).toBe(false);
    expect(isStrongCaptionWord("video")).toBe(false);
    expect(isStrongCaptionWord("   ")).toBe(false);
  });

  test("veľké skratky sú silné — autor ich sám zdôraznil", () => {
    expect(isStrongCaptionWord("VIP")).toBe(true);
    expect(isStrongCaptionWord("B2B")).toBe(true);
  });

  test("countStrongWords spočíta silné slová vo vete", () => {
    expect(countStrongWords("Zarábam 3 000 € mesačne")).toBe(3); // 3, 000, €
    expect(countStrongWords("dnes si povieme niečo")).toBe(0);
  });

  test("štýl KEYWORD_POP zdôrazní čísla aj bez časovania slov", () => {
    const r = buildAssFile({
      segments: [{ start: 0, end: 3, text: "Zľava 50 % len dnes" }],
      style: getCaptionStyle("KEYWORD_POP"),
      width: 1080,
      height: 1920,
    });
    expect(r.eventCount).toBe(1);
    expect(r.ass).toContain("{\\c&H0000A5FF}50"); // oranžová (zdôraznené)
    expect(r.notesSk.join(" ")).toContain("Zdôraznené sú čísla");
  });

  test("štýl CLEAN naopak nezdôrazňuje nič (poctivo čistý text)", () => {
    const r = buildAssFile({
      segments: [{ start: 0, end: 3, text: "Zľava 50 % len dnes" }],
      style: getCaptionStyle("CLEAN"),
      width: 1080,
      height: 1920,
    });
    expect(r.ass).not.toContain("{\\c&H0000A5FF}");
  });
});

// ---------------------------------------------------------------------------
// 3. Správanie nových štýlov v ASS
// ---------------------------------------------------------------------------

describe("nové štýly v ASS", () => {
  test("KARAOKE ukáže celú vetu a zvýrazní hovorené slovo (aj so zväčšením)", () => {
    const r = buildAssFile({
      segments: SPEECH,
      style: getCaptionStyle("KARAOKE"),
      width: 1080,
      height: 1920,
    });
    expect(r.wordHighlight).toBe(true);
    expect(r.eventCount).toBe(7); // 7 slov = 7 udalostí
    const events = r.ass.split("\n").filter((l) => l.startsWith("Dialogue:"));
    // každá udalosť obsahuje CELÚ vetu (nie len jedno slovo)
    for (const e of events) {
      expect(e).toContain("UKÁŽEME".length > 0 ? (getCaptionStyle("KARAOKE").uppercase ? "ukážeme".toUpperCase() : "ukážeme") : "ukážeme");
    }
    // a zvýraznenie aj so zväčšením slova
    expect(r.ass).toContain("\\fscx118");
    expect(r.notesSk.join(" ")).toContain("časovanie slov"); // poznámka o pôvode zvýraznenia
  });

  test("HORMOZI ukazuje 1–2 slová naraz (maximálna čitateľnosť na telefóne)", () => {
    const style = getCaptionStyle("HORMOZI");
    expect(style.wordsPerChunk).toBe(2);
    const r = buildAssFile({ segments: SPEECH, style, width: 1080, height: 1920 });
    expect(r.eventCount).toBe(7);
    const first = r.ass.split("\n").filter((l) => l.startsWith("Dialogue:"))[0];
    // v prvom bloku sú najviac dve slová (DNES SI), tretie už nie
    expect(first).toContain("DNES");
    expect(first).toContain("SI");
    expect(first).not.toContain("UKÁŽEME");
  });

  test("NEON_BOX kreslí text na placku (BorderStyle 3 + farba podkladu)", () => {
    const r = buildAssFile({
      segments: SPEECH,
      style: getCaptionStyle("NEON_BOX"),
      width: 1080,
      height: 1920,
    });
    expect(r.ass).toContain("&H00B43CC8"); // fialová placka
    expect(r.ass).toContain(",3,"); // BorderStyle
    expect(r.notesSk.join(" ")).toContain("placku");
  });

  test("PODCAST a BRAND majú rozostup písmen a väčší okraj (nič nezakrývajú)", () => {
    const podcast = getCaptionStyle("PODCAST");
    const brand = getCaptionStyle("BRAND");
    expect(podcast.letterSpacing).toBeGreaterThan(0);
    expect(brand.letterSpacing).toBeGreaterThan(0);
    expect(brand.bottomMarginRatio).toBeGreaterThan(podcast.bottomMarginRatio);
  });

  test("žiadne pole v ASS štýle nesmie byť prázdne (raz to zmenilo placku na čiernu)", () => {
    // Regresia: chýbajúca farba obrysu vyrobila riadok „…,,…", libass to prečítal
    // ako čiernu a fialová placka sčernela. Taká chyba musí spadnúť v teste.
    for (const s of CAPTION_STYLES) {
      const r = buildAssFile({ segments: SPEECH, style: s, width: 1080, height: 1920 });
      const styleLine = r.ass.split("\n").find((l) => l.startsWith("Style: Default"))!;
      const fields = styleLine.slice("Style: Default,".length).split(",");
      // Počet polí sa berie z deklarácie formátu — žiadne magické číslo, ktoré
      // by po zmene ASS hlavičky ticho prestalo platiť.
      const formatLine = r.ass.split("\n").find((l) => l.startsWith("Format: Name,"))!;
      const expectedFields = formatLine.slice("Format: ".length).split(", ").length - 1;
      expect(fields.length).toBe(expectedFields);
      for (const f of fields) {
        expect(f.length).toBeGreaterThan(0);
      }
      // Farba zvýraznenia musí byť naozaj použitá, keď štýl zvýrazňuje
      if (s.highlightMode !== "none") {
        expect(r.ass).toContain(s.highlightColor);
      }
    }
  });

  test("všetky štýly vyrobia platný ASS s udalosťami (nič nespadne)", () => {
    for (const s of CAPTION_STYLES) {
      const r = buildAssFile({ segments: SPEECH, style: s, width: 1080, height: 1920 });
      expect(r.eventCount).toBeGreaterThan(0);
      expect(r.ass).toContain("[Script Info]");
      expect(r.ass).toContain("[Events]");
      expect(r.ass.split("\n").filter((l) => l.startsWith("Dialogue:")).length).toBe(r.eventCount);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Poradca (inteligentný výber)
// ---------------------------------------------------------------------------

describe("poradca štýlu", () => {
  test("rýchly TikTok s časovaním slov → veľké krátke titulky", () => {
    const a = adviseCaptionStyle({
      platform: "TIKTOK",
      width: 1080,
      height: 1920,
      cutsPerMinute: 30,
      wordsPerSecond: 3.6,
      hasWordTiming: true,
    });
    expect(a.recommended).toBe("HORMOZI");
    expect(a.ranked[0].reasonsSk.length).toBeGreaterThan(2);
  });

  test("pokojný YouTube long-form → čisté titulky (nie agresívne)", () => {
    const a = adviseCaptionStyle({
      platform: "YOUTUBE_LONG",
      width: 1920,
      height: 1080,
      cutsPerMinute: 6,
      wordsPerSecond: 1.9,
      hasWordTiming: true,
    });
    expect(["CLEAN", "PODCAST"]).toContain(a.recommended!);
    // agresívne štýly nesmú byť v odporúčaní prvé
    expect(a.ranked[0].id).not.toBe("HORMOZI");
  });

  test("bez časovania slov poradca neodporučí karaoke (blikalo by)", () => {
    const a = adviseCaptionStyle({
      platform: "TIKTOK",
      width: 1080,
      height: 1920,
      cutsPerMinute: 20,
      hasWordTiming: false,
    });
    expect(a.recommended).not.toBe("KARAOKE");
    expect(a.cautionSk.join(" ")).toContain("časovanie slov");
  });

  test("B2B zadanie na šírku → brand/čistý, nie virálny", () => {
    const a = adviseCaptionStyle({
      platform: "BRAND",
      niche: "b2b",
      width: 1920,
      height: 1080,
      cutsPerMinute: 5,
      hasWordTiming: true,
    });
    expect(["BRAND", "CLEAN"]).toContain(a.recommended!);
  });

  test("reklama s číslami → zdôraznenie ponuky", () => {
    const a = adviseCaptionStyle({
      platform: "ADS",
      width: 1080,
      height: 1920,
      cutsPerMinute: 18,
      strongWordShare: 0.12,
      hasWordTiming: false,
    });
    expect(["KEYWORD_POP", "VIRAL_BOLD", "NEON_BOX", "HORMOZI"]).toContain(a.recommended!);
  });

  test("odporúčanie je deterministické (rovnaký vstup = rovnaký výsledok)", () => {
    const input = { platform: "REELS", width: 1080, height: 1920, cutsPerMinute: 22, hasWordTiming: true };
    const a = adviseCaptionStyle(input);
    const b = adviseCaptionStyle(input);
    expect(a.recommended).toBe(b.recommended);
    expect(a.ranked.map((r) => r.id)).toEqual(b.ranked.map((r) => r.id));
  });

  test("zdôvodnenie povie, z čoho vychádza (a prizná, čo nevie)", () => {
    const a = adviseCaptionStyle({ platform: "TIKTOK", hasWordTiming: true });
    expect(a.basisSk).toContain("TikTok");
    expect(a.cautionSk.length).toBeGreaterThan(0);
    // nevie tempo → musí to priznať
    expect(a.cautionSk.join(" ")).toContain("Tempo strihu nepoznám");
  });

  test("bez akýchkoľvek vstupov nič nepredstiera", () => {
    const a = adviseCaptionStyle({});
    expect(a.basisSk).toContain("neviem");
    expect(a.cautionSk.join(" ")).toContain("Platformu nemám");
  });

  test("nikdy nesľubuje virálnosť (ochrana proti marketingovému klamstvu)", () => {
    const a = adviseCaptionStyle({ platform: "TIKTOK", width: 1080, height: 1920 });
    const text = [a.basisSk, ...a.cautionSk, ...a.ranked.flatMap((r) => r.reasonsSk.map((x) => x.textSk))]
      .join(" ")
      .toLowerCase();
    expect(text).not.toContain("virálne to bude");
    expect(text).not.toContain("garantovan");
    expect(text).not.toContain("zaručene");
  });

  test("tempo a rýchlosť reči sa vedia vypočítať z reálneho klipu", () => {
    const ctx = adviceInputFromContext({
      durationSec: 30,
      cutCount: 12,
      segments: [
        { start: 0, end: 5, text: "Zarábam 3 000 € mesačne", words: [{ word: "Zarábam", start: 0, end: 1 }, { word: "3", start: 1, end: 2 }] },
      ],
    });
    expect(ctx.cutsPerMinute).toBeCloseTo(24, 1);
    expect(ctx.hasWordTiming).toBe(true);
    expect(ctx.strongWordShare).toBeGreaterThan(0);
    expect(ctx.wordsPerSecond).toBeCloseTo(5 / 30, 2);
  });

  test("bez dát poradca nič nedopočítava (chýbajúce pole radšej chýba)", () => {
    const ctx = adviceInputFromContext({ segments: [] });
    expect(ctx.wordsPerSecond).toBeUndefined();
    expect(ctx.strongWordShare).toBeUndefined();
    expect(ctx.hasWordTiming).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. Náhľad bez renderovania
// ---------------------------------------------------------------------------

describe("náhľad štýlu (bez renderovania)", () => {
  test("ASS farba sa prevedie správne (BGR poradie — žltá musí zostať žltá)", () => {
    expect(assColorToCss("&H0000FFFF")).toBe("rgba(255, 255, 0, 1)");
    expect(assColorToCss("&H00FFFFFF")).toBe("rgba(255, 255, 255, 1)");
    expect(assColorToCss("&H00B43CC8")).toBe("rgba(200, 60, 180, 1)");
  });

  test("zmena veľkosti aktívneho slova sa prevedie na násobok", () => {
    expect(scaleToFactor(112)).toBeCloseTo(1.12, 3);
    expect(scaleToFactor(undefined)).toBe(1);
    expect(scaleToFactor(0)).toBe(1);
  });

  test("náhľad použije skutočné slová z videa (nie ukážkový text)", () => {
    const m = buildCaptionPreview({
      styleId: "VIRAL_BOLD",
      segments: SPEECH,
      width: 1080,
      height: 1920,
      previewHeight: 190,
    });
    const flat = m.lines.flat().map((w) => w.text).join(" ");
    expect(flat).toContain("DNES"); // veľké písmená podľa štýlu
    expect(flat).not.toContain("Ukážka");
  });

  test("náhľad ukáže presne toľko slov, koľko ich štýl zobrazuje", () => {
    const two = buildCaptionPreview({ styleId: "HORMOZI", segments: SPEECH, previewHeight: 190 });
    expect(two.lines.flat().length).toBe(2);
    const whole = buildCaptionPreview({ styleId: "CLEAN", segments: SPEECH, previewHeight: 190 });
    expect(whole.lines.flat().length).toBeGreaterThan(2);
  });

  test("aktívne slovo je zvýraznené len v štýloch, ktoré to robia", () => {
    const viral = buildCaptionPreview({ styleId: "VIRAL_BOLD", segments: SPEECH, activeWordIndex: 1, previewHeight: 190 });
    expect(viral.lines.flat().filter((w) => w.active).length).toBe(1);
    expect(viral.lines.flat()[1].accent).toBe(true);
    const clean = buildCaptionPreview({ styleId: "CLEAN", segments: SPEECH, previewHeight: 190 });
    expect(clean.lines.flat().every((w) => !w.active)).toBe(true);
  });

  test("náhľad zdôrazní čísla v KEYWORD_POP (rovnaké pravidlo ako render)", () => {
    const m = buildCaptionPreview({
      styleId: "KEYWORD_POP",
      segments: [{ start: 0, end: 3, text: "Zľava 50 % len dnes" }],
      previewHeight: 190,
    });
    const accented = m.lines.flat().filter((w) => w.accent).map((w) => w.text);
    expect(accented).toContain("50");
    expect(accented).toContain("%");
  });

  test("placka má v náhľade podklad, ostatné štýly nie", () => {
    expect(buildCaptionPreview({ styleId: "NEON_BOX", segments: SPEECH, previewHeight: 190 }).boxCss).toBeTruthy();
    expect(buildCaptionPreview({ styleId: "CLEAN", segments: SPEECH, previewHeight: 190 }).boxCss).toBeNull();
  });

  test("veľkosť v náhľade je úmerná veľkosti vo videu (pomer drží)", () => {
    const small = buildCaptionPreview({ styleId: "VIRAL_BOLD", segments: SPEECH, previewHeight: 190 });
    const big = buildCaptionPreview({ styleId: "VIRAL_BOLD", segments: SPEECH, previewHeight: 760 });
    expect(big.fontSizePx / small.fontSizePx).toBeCloseTo(4, 0);
    // veľmi malý náhľad drží čitateľné minimum (inak by bol náhľad nečitateľný)
    const tiny = buildCaptionPreview({ styleId: "VIRAL_BOLD", segments: SPEECH, previewHeight: 40 });
    expect(tiny.fontSizePx).toBeGreaterThanOrEqual(9);
  });

  test("keď nie je text z videa, náhľad to povie a nespadne", () => {
    const m = buildCaptionPreview({ styleId: "CLEAN", segments: [], previewHeight: 190 });
    expect(m.lines.flat().length).toBeGreaterThan(0);
    expect(m.noteSk.length).toBeGreaterThan(5);
  });
});

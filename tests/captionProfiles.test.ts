import { describe, expect, it } from "bun:test";
import {
  CAPTION_ANIMATION_MS,
  CAPTION_STYLES,
  applyCaptionOverrides,
  assColorToHex,
  buildAssFile,
  getCaptionStyle,
  hexToAssColor,
  normalizeOverrides,
} from "../src/core/export/subtitleRender";
import {
  PROFILE_LIMITS,
  PROFILE_TEMPLATES,
  describeProfileSk,
  isSafeProfileId,
  profileFromTemplate,
  profileIdFromName,
  resolveProfileStyle,
  validateProfile,
} from "../src/core/export/captionProfiles";
import { buildCaptionPreview } from "../src/core/export/captionPreview";
import { validateBurnRequest } from "../src/core/export/burnJob";

const SEGMENTS = [
  {
    start: 0.2,
    end: 2.4,
    text: "zľava 50 % na celý kurz",
    words: [
      { word: "zľava", start: 0.2, end: 0.7 },
      { word: "50", start: 0.72, end: 1.0 },
      { word: "%", start: 1.0, end: 1.2 },
      { word: "na", start: 1.22, end: 1.4 },
      { word: "celý", start: 1.42, end: 1.8 },
      { word: "kurz", start: 1.82, end: 2.4 },
    ],
  },
];

function assOf(styleId: string, extra: Record<string, unknown> = {}) {
  const style = { ...getCaptionStyle(styleId as any), ...extra };
  return buildAssFile({
    segments: SEGMENTS as any,
    style: style as any,
    width: 1080,
    height: 1920,
  });
}

function dialogues(ass: string): string[] {
  return ass.split("\n").filter((l) => l.startsWith("Dialogue:"));
}

// ---------------------------------------------------------------------------
// Farby: #RRGGBB ↔ &HAABBGGRR (poradie BGR je najčastejšia chyba)
// ---------------------------------------------------------------------------

describe("farby medzi brand manuálom a ASS", () => {
  it("prevedie #RRGGBB na ASS s BGR poradím", () => {
    // Čistá modrá #0000FF musí byť v ASS na konci (BGR), nie na začiatku.
    expect(hexToAssColor("#0000FF")).toBe("&H00FF0000");
    expect(hexToAssColor("#FF0000")).toBe("&H000000FF");
    expect(hexToAssColor("#0A3D91")).toBe("&H00913D0A");
  });

  it("prijme aj tvar bez mriežky a malé písmená", () => {
    expect(hexToAssColor("ffc400")).toBe("&H0000C4FF");
    expect(hexToAssColor("  #Ffc400 ")).toBe("&H0000C4FF");
  });

  it("čo nie je farba, nevráti ako farbu", () => {
    for (const bad of ["", "modrá", "#12345", "#GGGGGG", "rgb(1,2,3)", null, undefined]) {
      expect(hexToAssColor(bad as any)).toBeNull();
    }
  });

  it("cesta tam a späť vráti pôvodnú farbu", () => {
    for (const hex of ["#0A3D91", "#FFC400", "#FFFFFF", "#000000", "#12AB34"]) {
      expect(assColorToHex(hexToAssColor(hex)!)).toBe(hex);
    }
  });

  it("vie prečítať aj farbu priamo z ASS štýlu", () => {
    // V štýle sú farby reálne — a musia sa dať zobraziť v UI.
    for (const style of CAPTION_STYLES) {
      expect(assColorToHex(style.primaryColor)).not.toBeNull();
      expect(assColorToHex(style.highlightColor)).not.toBeNull();
      expect(assColorToHex(style.outlineColor)).not.toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Odchýlky: čo je mimo rozsahu, sa oreže — a povie sa to
// ---------------------------------------------------------------------------

describe("kontrola vlastných nastavení klienta", () => {
  it("oreže veľkosť písma a napíše na akú hodnotu", () => {
    const { overrides, notesSk } = normalizeOverrides({ fontSizeRatio: 400 });
    expect(overrides.fontSizeRatio).toBe(130);
    expect(notesSk.join(" ")).toContain("130");
    expect(notesSk.join(" ")).toContain("veľkosť písma");
  });

  it("mierne hodnoty nechá tak (nič sa neorezáva zbytočne)", () => {
    const { overrides, notesSk } = normalizeOverrides({ fontSizeRatio: 64, wordsPerChunk: 3 });
    expect(overrides.fontSizeRatio).toBe(64);
    expect(overrides.wordsPerChunk).toBe(3);
    expect(notesSk).toHaveLength(0);
  });

  it("zlú farbu vynechá a povie prečo (radšej pôvodná než náhodná)", () => {
    const { overrides, notesSk } = normalizeOverrides({ primaryHex: "modrá" });
    expect(overrides.primaryHex).toBeUndefined();
    expect(notesSk.join(" ")).toContain("#RRGGBB");
  });

  it("dobrú farbu zjednotí na veľké písmená", () => {
    const { overrides } = normalizeOverrides({ primaryHex: "#ffc400" });
    expect(overrides.primaryHex).toBe("#FFC400");
  });

  it("neznámu animáciu nahradí pôvodnou a vypíše možnosti", () => {
    const { overrides, notesSk } = normalizeOverrides({ animation: "wobble" });
    expect(overrides.animation).toBeUndefined();
    expect(notesSk.join(" ")).toContain("pop");
    expect(notesSk.join(" ")).toContain("fade");
  });

  it("zlé zarovnanie vysvetlí ľudsky", () => {
    const { overrides, notesSk } = normalizeOverrides({ alignment: 7 });
    expect(overrides.alignment).toBeUndefined();
    expect(notesSk.join(" ")).toContain("dole");
  });

  it("nezmysly (text namiesto čísla, prázdne dáta) nezhavarujú", () => {
    expect(normalizeOverrides({ fontSizeRatio: "veľké" }).overrides.fontSizeRatio).toBeUndefined();
    expect(normalizeOverrides(null).overrides).toEqual({});
    expect(normalizeOverrides("text").overrides).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Naloženie odchýlok na štýl
// ---------------------------------------------------------------------------

describe("vlastný štýl sa nabalí na hotový štýl", () => {
  it("zmení farbu textu aj zvýraznenia (a správne, v BGR)", () => {
    const st = applyCaptionOverrides(getCaptionStyle("CLEAN"), {
      primaryHex: "#FFC400",
      highlightHex: "#0A3D91",
    });
    expect(st.primaryColor).toBe(hexToAssColor("#FFC400")!);
    expect(st.highlightColor).toBe(hexToAssColor("#0A3D91")!);
  });

  it("nikdy nezmení pôvodný štýl v katalógu", () => {
    const base = getCaptionStyle("CLEAN");
    const before = { ...base };
    const st = applyCaptionOverrides(base, { primaryHex: "#FFC400", fontSizeRatio: 99 });
    expect(st.primaryColor).not.toBe(before.primaryColor);
    expect(getCaptionStyle("CLEAN").primaryColor).toBe(before.primaryColor);
    expect(getCaptionStyle("CLEAN").fontSizeRatio).toBe(before.fontSizeRatio);
  });

  it("bez odchýlok vráti presne ten istý štýl", () => {
    const base = getCaptionStyle("VIRAL_BOLD");
    expect(applyCaptionOverrides(base, {})).toBe(base);
    expect(applyCaptionOverrides(base, undefined)).toBe(base);
  });

  it("placka bez farby podkladu dostane rozumnú tmavú (inak by nebola placka)", () => {
    const st = applyCaptionOverrides(getCaptionStyle("CLEAN"), { boxed: true });
    expect(st.boxed).toBe(true);
    expect(st.boxColor && st.boxColor.length).toBeGreaterThan(0);
  });

  it("zarovnanie hore/nadol posunie text, aby neliezol do rozhrania", () => {
    const hore = applyCaptionOverrides(getCaptionStyle("CLEAN"), { alignment: 8 });
    expect(hore.alignment).toBe(8);
    expect(hore.bottomMarginRatio).toBeGreaterThanOrEqual(0.08);
    const stred = applyCaptionOverrides(getCaptionStyle("CLEAN"), { alignment: 5 });
    expect(stred.bottomMarginRatio).toBe(0.5);
  });

  it("animácia z profilu sa naozaj dostane do štýlu", () => {
    const st = applyCaptionOverrides(getCaptionStyle("CLEAN"), { animation: "pop" });
    expect(st.animation).toBe("pop");
  });

  it("resolveProfileStyle dá to, čo pôjde do renderu", () => {
    const st = resolveProfileStyle({ styleId: "KEYWORD_POP", overrides: { highlightHex: "#FFC400" } });
    expect(st.id).toBe("KEYWORD_POP");
    expect(st.highlightColor).toBe(hexToAssColor("#FFC400")!);
  });
});

// ---------------------------------------------------------------------------
// Animácie titulkov
// ---------------------------------------------------------------------------

describe("animácie titulkov (a ich poctivé mantinely)", () => {
  it("každá animácia má zmerateľnú dĺžku a krátku (nad 250 ms už pôsobí pomaly)", () => {
    for (const a of ["none", "pop", "punch", "fade"] as const) {
      expect(typeof CAPTION_ANIMATION_MS[a]).toBe("number");
      expect(CAPTION_ANIMATION_MS[a]).toBeLessThanOrEqual(250);
    }
    expect(CAPTION_ANIMATION_MS.none).toBe(0);
  });

  it("pop vyrastie z 86 % a sadne na 100 %", () => {
    const { ass } = assOf("CLEAN", { animation: "pop" });
    expect(ass).toContain("\\fscx86\\fscy86");
    expect(ass).toContain("\\fscx100\\fscy100");
  });

  it("punch priletí z 114 % (agresívnejšie, pre hooky)", () => {
    const { ass } = assOf("CLEAN", { animation: "punch" });
    expect(ass).toContain("\\fscx114\\fscy114");
  });

  it("fade použije \\fad a nič nezväčšuje", () => {
    const { ass } = assOf("CLEAN", { animation: "fade" });
    expect(ass).toContain("\\fad(");
    expect(ass).not.toContain("\\fscx86");
  });

  it("bez animácie nie je v titulkoch ani jeden animačný príkaz", () => {
    const { ass } = assOf("CLEAN");
    expect(ass).not.toContain("\\fad(");
    expect(ass).not.toContain("\\t(");
  });

  it("animácia NEZDVYŠUJE počet udalostí (jedno slovo = jedna udalosť)", () => {
    const none = dialogues(assOf("CLEAN", { animation: "none" }).ass).length;
    const pop = dialogues(assOf("CLEAN", { animation: "pop" }).ass).length;
    const fade = dialogues(assOf("CLEAN", { animation: "fade" }).ass).length;
    expect(pop).toBe(none);
    expect(fade).toBe(none);
  });

  it("animuje sa len vstup — text počas čítania stojí (žiadne \\t s iným časom)", () => {
    const { ass } = assOf("CLEAN", { animation: "pop" });
    for (const line of dialogues(ass)) {
      // V animácii smie byť len prechod na 100 % od času 0.
      const transforms = [...line.matchAll(/\\t\((\d+),(\d+),/g)];
      for (const t of transforms) expect(t[1]).toBe("0");
    }
  });

  /**
   * Zmerané vo ffmpeg: štýl, ktorý zväčšuje aktívne slovo inline (`\fscx`),
   * ticho zruší animáciu veľkosti na celej udalosti. Appka to nesmie tvrdiť
   * ako hotové — nahradí ju jemným objavením a napíše prečo.
   */
  it("keď má štýl zväčšenie aktívneho slova, scale animácia sa nahradí a prizná", () => {
    const r = assOf("VIRAL_BOLD", { animation: "punch", activeWordScale: 112, highlightMode: "active-word" });
    expect(r.ass).toContain("\\fad(");
    expect(r.notesSk.join(" ")).toContain("punch");
    expect(r.notesSk.join(" ")).toContain("zrušil");
  });

  it("HORMOZI preto animuje fade (nie rozbité scale) a povie to", () => {
    const style = getCaptionStyle("HORMOZI");
    expect(style.animation).toBe("fade");
    const r = assOf("HORMOZI");
    expect(r.ass).toContain("\\fad(");
    expect(r.notesSk.join(" ")).toContain("animáciu vstupu");
  });

  it("virálne štýly majú animáciu, pokojné ju nemajú (aby to nebolo nasilu všade)", () => {
    expect(getCaptionStyle("VIRAL_BOLD").animation).toBe("pop");
    expect(getCaptionStyle("HORMOZI").animation).toBe("fade");
    expect(getCaptionStyle("CLEAN").animation).toBeUndefined();
    expect(getCaptionStyle("PODCAST").animation).toBeUndefined();
    expect(getCaptionStyle("MINIMAL").animation).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Profil klienta
// ---------------------------------------------------------------------------

describe("profil klienta (brand kit)", () => {
  it("bez názvu profil nevznikne — a povie sa to", () => {
    const v = validateProfile({ styleId: "CLEAN" });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errorSk).toContain("názov");
  });

  it("neznámy základný štýl sa odmietne s výpočtom možností", () => {
    const v = validateProfile({ name: "Klient A", styleId: "SUPER_STYLE" });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errorSk).toContain("VIRAL_BOLD");
  });

  it("príliš dlhý názov sa odmietne (nie ticho oreže)", () => {
    const v = validateProfile({ name: "x".repeat(PROFILE_LIMITS.maxNameLength + 1), styleId: "CLEAN" });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errorSk).toContain("maximum");
  });

  it("platný profil dostane bezpečné id a orežu sa mu hodnoty", () => {
    const v = validateProfile({
      name: "Klient A – beauty",
      styleId: "VIRAL_BOLD",
      overrides: { fontSizeRatio: 999, primaryHex: "zelená" },
    });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(isSafeProfileId(v.profile.id)).toBe(true);
      expect(v.profile.overrides.fontSizeRatio).toBe(130);
      expect(v.profile.overrides.primaryHex).toBeUndefined();
      expect(v.notesSk.length).toBeGreaterThan(0);
    }
  });

  it("diakritika v názve nerozbije id (ide do URL)", () => {
    const v = validateProfile({ name: "Žltý kôň – Žilina", styleId: "CLEAN" });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.profile.id).toMatch(/^[a-z0-9-]+$/);
  });

  it("id sa dá určiť aj z mena bez diakritiky", () => {
    expect(profileIdFromName("Klient A – beauty")).toBe("klient-a-beauty");
    expect(profileIdFromName("")).toBe("profil");
    expect(isSafeProfileId("../../etc/passwd")).toBe(false);
    expect(isSafeProfileId("klient-1")).toBe(true);
  });

  it("šablóny sú platné (inak by UI ponúkalo niečo, čo nefunguje)", () => {
    expect(PROFILE_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    for (const t of PROFILE_TEMPLATES) {
      const v = validateProfile({ name: t.name, styleId: t.styleId, overrides: t.overrides });
      expect(v.ok).toBe(true);
      expect(t.descriptionSk.length).toBeGreaterThan(10);
    }
  });

  it("zo šablóny vznikne použiteľný profil s časmi", () => {
    const p = profileFromTemplate(PROFILE_TEMPLATES[0]!);
    expect(p.createdAt).toBe(p.updatedAt);
    expect(p.name).toBe(PROFILE_TEMPLATES[0]!.name);
    const st = resolveProfileStyle(p);
    expect(st.id).toBe(PROFILE_TEMPLATES[0]!.styleId);
  });

  it("popis profilu vymenuje, čo mení (aby výber netrval minúty)", () => {
    const text = describeProfileSk({
      styleId: "CLEAN",
      overrides: { primaryHex: "#FFC400", wordsPerChunk: 2, animation: "pop" },
    });
    expect(text).toContain("#FFC400");
    expect(text).toContain("2 slová");
    expect(text).toContain("pop");
  });

  it("profil bez zmien to povie rovno (nič sa nepredstiera)", () => {
    const text = describeProfileSk({ styleId: "CLEAN", overrides: {} });
    expect(text).toContain("bez zmien");
  });

  it("„celá veta naraz“ sa povie ľudsky, nie ako 0", () => {
    const text = describeProfileSk({ styleId: "VIRAL_BOLD", overrides: { wordsPerChunk: 0 } });
    expect(text).toContain("celá veta");
  });
});

// ---------------------------------------------------------------------------
// Náhľad a render musia ukazovať to isté
// ---------------------------------------------------------------------------

describe("náhľad kreslia to isté, čo sa vypáli", () => {
  it("náhľad použije farbu z profilu", () => {
    const model = buildCaptionPreview({
      styleId: "CLEAN",
      overrides: { primaryHex: "#FFC400" },
      width: 1080,
      height: 1920,
      previewHeight: 190,
    });
    expect(model.primaryCss).toBe("rgba(255, 196, 0, 1)");
    // a bez profilu je text naozaj biely — rozdiel je teda od profilu, nie náhodou
    const plain = buildCaptionPreview({ styleId: "CLEAN", width: 1080, height: 1920, previewHeight: 190 });
    expect(plain.primaryCss).toBe("rgba(255, 255, 255, 1)");
  });

  it("bez odchýlok je náhľad presne ako predtým (nič sa nezmenilo)", () => {
    const a = buildCaptionPreview({ styleId: "VIRAL_BOLD", width: 1080, height: 1920, previewHeight: 190 });
    const b = buildCaptionPreview({ styleId: "VIRAL_BOLD", width: 1080, height: 1920, previewHeight: 190, overrides: {} });
    expect(a.primaryCss).toBe(b.primaryCss);
    expect(a.fontSizePx).toBe(b.fontSizePx);
  });

  it("väčšie písmo v profile = väčšie písmo v náhľade", () => {
    const small = buildCaptionPreview({ styleId: "CLEAN", width: 1080, height: 1920, previewHeight: 300 });
    const big = buildCaptionPreview({
      styleId: "CLEAN",
      overrides: { fontSizeRatio: 110 },
      width: 1080,
      height: 1920,
      previewHeight: 300,
    });
    expect(big.fontSizePx).toBeGreaterThan(small.fontSizePx);
  });
});

// ---------------------------------------------------------------------------
// Cesta cez server (požiadavka na vypálenie)
// ---------------------------------------------------------------------------

describe("odchýlky prejdú až do renderu", () => {
  const base = {
    uploadId: "abc__klip.mp4",
    uploadName: "klip.mp4",
    styleId: "VIRAL_BOLD",
    width: 1080,
    height: 1920,
    segments: SEGMENTS,
    keepRanges: [],
  };

  it("server prijme farby a veľkosť klienta", () => {
    const v = validateBurnRequest({ ...base, overrides: { primaryHex: "#FFC400", fontSizeRatio: 70 } });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.spec.overrides?.primaryHex).toBe("#FFC400");
      expect(v.spec.overrides?.fontSizeRatio).toBe(70);
    }
  });

  it("čo je mimo rozsahu, oreže — a vráti vetu pre človeka", () => {
    const v = validateBurnRequest({ ...base, overrides: { fontSizeRatio: 500 } });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.spec.overrides?.fontSizeRatio).toBe(130);
      expect(v.spec.overrideNotesSk?.join(" ")).toContain("130");
    }
  });

  it("bez odchýlok je recept presne ako doteraz (spätná kompatibilita)", () => {
    const v = validateBurnRequest({ ...base });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.spec.overrides).toBeUndefined();
      expect(v.spec.overrideNotesSk).toBeUndefined();
    }
  });

  it("celý reťazec: profil → recept → ASS s farbou klienta", () => {
    const profile = profileFromTemplate(PROFILE_TEMPLATES[1]!);
    const v = validateBurnRequest({ ...base, styleId: profile.styleId, overrides: profile.overrides });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const style = applyCaptionOverrides(getCaptionStyle(v.spec.styleId), v.spec.overrides);
    const { ass } = buildAssFile({ segments: SEGMENTS as any, style, width: 1080, height: 1920 });
    expect(ass).toContain(hexToAssColor(profile.overrides.highlightHex!)!);
  });
});

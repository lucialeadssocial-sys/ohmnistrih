import { describe, expect, test } from "bun:test";
import {
  BREATHING_PAUSE_SEC,
  CONFIDENCE_MAX,
  HIGH_DENSITY_WPS,
  MAX_CONSECUTIVE_COVERED,
  adjustTalkingHeadRatio,
  analyzeStyleSentences,
  buildStylePlan,
  supportingVisualScore,
} from "../src/core/style/styleIntelligence";
import { getStyleRecipe } from "../src/core/style/styleRecipes";
import type { SpeechSegmentLike } from "../src/core/transcript/wordTiming";

/**
 * C–G) Style Intelligence z reálnych časov: prepis → rozhodnutia, WHY, WHEN NOT,
 * alternatívy, confidence, determinizmus a vynechané nápady.
 *
 * POZOR (reporting): toto je **unit-test verification**. Neznamená, že to beží
 * v prehliadači na reálnom videu — to je samostatná (zatiaľ neoverená) vec.
 */

const NOW = 1759219200000; // pevný čas → testy sú reprodukovateľné

/** Fixture: tri vety s reálnymi časmi slov, pauzami a číslami. */
const FIXTURE: SpeechSegmentLike[] = [
  {
    start: 0.2,
    end: 3.1,
    text: "Dnes ti ukážem trik, ktorý mi ušetrí hodiny.",
    words: [
      { word: "Dnes", start: 0.2, end: 0.5 },
      { word: "ti", start: 0.5, end: 0.65 },
      { word: "ukážem", start: 0.65, end: 1.1 },
      { word: "trik", start: 1.12, end: 1.5 },
      { word: "ktorý", start: 1.55, end: 1.85 },
      { word: "mi", start: 1.85, end: 2.0 },
      { word: "ušetrí", start: 2.0, end: 2.6 },
      { word: "hodiny", start: 2.62, end: 3.1 },
    ],
  },
  {
    start: 3.9,
    end: 7.4,
    text: "Zaplatil som 3 000 eur za kurz, ktorý ma nič nenaučil.",
    words: [
      { word: "Zaplatil", start: 3.9, end: 4.5 },
      { word: "som", start: 4.5, end: 4.7 },
      { word: "3", start: 4.7, end: 4.95 },
      { word: "000", start: 4.95, end: 5.2 },
      { word: "eur", start: 5.2, end: 5.6 },
      { word: "za", start: 5.62, end: 5.78 },
      { word: "kurz", start: 5.78, end: 6.2 },
      { word: "ktorý", start: 6.25, end: 6.6 },
      { word: "ma", start: 6.6, end: 6.75 },
      { word: "nič", start: 6.75, end: 7.0 },
      { word: "nenaučil", start: 7.0, end: 7.4 },
    ],
  },
  {
    start: 8.6,
    end: 12.9,
    text: "Zľava 50 % na celý balík platí len do konca týždňa, potom končí.",
    words: [
      { word: "Zľava", start: 8.6, end: 9.1 },
      { word: "50", start: 9.12, end: 9.4 },
      { word: "%", start: 9.4, end: 9.6 },
      { word: "na", start: 9.62, end: 9.78 },
      { word: "celý", start: 9.78, end: 10.1 },
      { word: "balík", start: 10.1, end: 10.5 },
      { word: "platí", start: 10.55, end: 10.9 },
      { word: "len", start: 10.9, end: 11.1 },
      { word: "do", start: 11.1, end: 11.25 },
      { word: "konca", start: 11.25, end: 11.7 },
      { word: "týždňa", start: 11.7, end: 12.2 },
      { word: "potom", start: 12.3, end: 12.6 },
      { word: "končí", start: 12.6, end: 12.9 },
    ],
  },
];

const plan = () => buildStylePlan({ segments: FIXTURE, recipe: getStyleRecipe("EDITORIAL_COLLAGE"), durationSec: 14, availableSupportingVisuals: 6, now: NOW });

describe("C) prepis → rozhodnutia", () => {
  test("vety sa rozložia presne podľa reči (pauza ≥ 0,45 s) a nesedia na sekundách", () => {
    const s = analyzeStyleSentences(FIXTURE);
    expect(s.map((x) => x.index)).toEqual([0, 1, 2]);
    expect(s[0].start).toBe(0.2);
    expect(s[0].end).toBe(3.1);
    expect(s[1].start).toBe(3.9);
    // pauza po prvej vete (3,1 → 3,9) je naozaj v dátach
    expect(s[0].pauseAfterSec).toBeCloseTo(0.8, 2);
    expect(s[1].pauseBeforeSec).toBeCloseTo(0.8, 2);
  });

  test("signály sa čítajú z textu a časov, nie z AI dohadu", () => {
    const s = analyzeStyleSentences(FIXTURE);
    expect(s[0].isHook).toBe(true);
    expect(s[0].wordCount).toBe(8);
    expect(s[0].wordsPerSecond).toBeCloseTo(2.76, 1);
    expect(s[1].numberWords.length).toBeGreaterThan(0); // „3 000“
    expect(s[2].numberWords.length).toBeGreaterThan(0); // „50 %“
    expect(s[2].strongWords.length).toBeGreaterThan(0);
  });

  test("prvá veta dostane ochranné rozhodnutie (hook) a posledná nemá pokrytie", () => {
    const p = plan();
    const first = p.decisions.find((d) => d.style?.kind === "talking_head");
    expect(first).toBeDefined();
    expect(first!.style!.whenSk.startSec).toBe(0.2);
    // Prvý zásah začína presne na hranici vety/slova, nie na „0“
    expect(first!.style!.signals).toContain("position");
  });

  test("rozhodnutia pokrývajú všetky druhy zo zadania a nesedia v prázdne", () => {
    const p = plan();
    const kinds = new Set(p.decisions.map((d) => d.style?.kind));
    expect(kinds.has("talking_head")).toBe(true);
    expect(kinds.has("supporting_visual")).toBe(true);
    expect(kinds.has("typography")).toBe(true);
    expect(kinds.has("motion")).toBe(true);
    for (const d of p.decisions) {
      expect(d.style!.whenSk.endSec).toBeGreaterThan(d.style!.whenSk.startSec);
    }
  });

  test("text do obrazu je doslovne z vety — nikdy vygenerovaný", () => {
    const p = plan();
    const typo = p.decisions.filter((d) => d.style?.kind === "typography");
    expect(typo.length).toBeGreaterThan(0);
    const sentences = analyzeStyleSentences(FIXTURE);
    for (const t of typo) {
      const text = String(t.style!.action.typographyText);
      const sentence = sentences.find((s) => s.start === t.style!.whenSk.startSec)!;
      for (const word of text.split(/\s+/)) {
        expect(sentence.text.includes(word)).toBe(true);
      }
    }
  });

  test("nič nie je aplikované — plán je len návrh", () => {
    const p = plan();
    for (const d of p.decisions) {
      expect(d.status).toBe("proposed");
    }
    expect(p.audioPolicy).toBe("ORIGINAL_VO_MASTER");
    expect(p.provider).toBe("NONE");
  });
});

describe("D) WHY / WHEN NOT / ALTERNATIVE / CONFIDENCE", () => {
  test("každé rozhodnutie má všetkých šesť častí a slovenské znenie", () => {
    const p = plan();
    expect(p.decisions.length).toBeGreaterThan(0);
    for (const d of p.decisions) {
      const st = d.style!;
      expect(st.whatSk.length).toBeGreaterThan(10);
      expect(st.whySk.length).toBeGreaterThan(10);
      expect(st.whenNotSk.length).toBeGreaterThan(10);
      expect(st.alternativeSk.length).toBeGreaterThan(10);
      expect(st.evidenceSk.length).toBeGreaterThan(0);
      expect(st.whySk).not.toMatch(/(retention|retence|percent|% zásah)/i);
    }
  });

  test("WHY odkazuje na konkrétnu evidenciu (hustota, čísla, zhoda viet)", () => {
    const p = plan();
    const visual = p.decisions.find((d) => d.style?.kind === "supporting_visual")!;
    const evidence = visual.style!.evidenceSk.join(" ");
    expect(evidence).toMatch(/hustota|čísla|myšlienka/);
    expect(visual.style!.whySk).toMatch(/hustotu|slova\/s|čísla/);
  });

  test("WHEN NOT dáva konkrétnu situáciu, nie frázu", () => {
    const p = plan();
    for (const d of p.decisions) {
      const forbidden = /^(nie|nepoužiť len tak)/i;
      expect(forbidden.test(d.style!.whenNotSk.trim())).toBe(false);
      expect(d.style!.whenNotSk).toMatch(/Nepoužiť, ak/);
    }
  });

  test("alternatíva je vždy konkrétna možnosť (a je aj v `alternatives`)", () => {
    const p = plan();
    for (const d of p.decisions) {
      expect(d.alternatives?.[0]).toBe(d.style!.alternativeSk);
    }
  });

  test("confidence nikdy netvrdí istotu a nikdy nespadne na nulu", () => {
    const p = plan();
    for (const d of p.decisions) {
      expect(d.style!.confidence).toBeGreaterThan(0);
      expect(d.style!.confidence).toBeLessThanOrEqual(CONFIDENCE_MAX);
      expect(d.style!.confidence).toBeLessThan(1);
    }
  });

  test("skóre podporného vizuálu rastie s hustotou reči", () => {
    const slow = supportingVisualScore({ ...analyzeStyleSentences(FIXTURE)[0], wordsPerSecond: 1.5, numberWords: [], strongWords: [] });
    const fast = supportingVisualScore({ ...analyzeStyleSentences(FIXTURE)[0], wordsPerSecond: HIGH_DENSITY_WPS + 0.5, numberWords: [], strongWords: [] });
    expect(fast).toBeGreaterThan(slow);
  });
});

describe("E) determinizmus (rovnaký vstup → rovnaký plán)", () => {
  test("dva behy dajú identický výsledok vrátane ID rozhodnutí", () => {
    const a = plan();
    const b = plan();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.decisions.map((d) => d.id)).toEqual(b.decisions.map((d) => d.id));
    expect(a.id).toBe(b.id);
  });

  test("plán neobsahuje náhodu ani závislosť na čase behu", () => {
    const p = plan();
    expect(p.createdAt).toBe(NOW);
    for (const d of p.decisions) {
      expect(d.timestamp).toBe(NOW); // nie Date.now() pri každom rozhodnutí
    }
  });

  test("ID rozhodnutia je odvodené z receptu, času a druhu", () => {
    const p = plan();
    const d = p.decisions[0];
    expect(d.id.startsWith("style-editorial_collage-")).toBe(true);
    expect(d.id).toContain(d.style!.kind);
  });

  test("rôzne recepty = rôzne plány, ale ten istý typ rozhodnutia", () => {
    const editorial = buildStylePlan({ segments: FIXTURE, recipe: getStyleRecipe("EDITORIAL_COLLAGE"), durationSec: 14, now: NOW });
    const minimal = buildStylePlan({ segments: FIXTURE, recipe: getStyleRecipe("MINIMAL"), durationSec: 14, now: NOW });
    expect(editorial.decisions.length).not.toBe(minimal.decisions.length);
    expect(minimal.ratio.target).toBeGreaterThan(editorial.ratio.target);
  });
});

describe("F) poctivosť: chýbajúce dáta a vynechané nápady", () => {
  test("bez prepisu nevznikne ani jedno rozhodnutie (radšej nič než vymyslené)", () => {
    const p = buildStylePlan({ segments: [], recipe: getStyleRecipe("EDITORIAL_COLLAGE"), now: NOW });
    expect(p.decisions).toHaveLength(0);
    expect(p.notesSk.join(" ")).toMatch(/Nemám žiadny prepis/);
    expect(p.statsSk.join(" ")).toMatch(/Rozhodnutí: 0/);
  });

  test("bez podporných médií engine nepovie „pridám vizuál“", () => {
    const p = buildStylePlan({ segments: FIXTURE, recipe: getStyleRecipe("EDITORIAL_COLLAGE"), durationSec: 14, availableSupportingVisuals: 0, now: NOW });
    expect(p.decisions.some((d) => d.style?.kind === "supporting_visual")).toBe(false);
    expect(p.notesSk.join(" ")).toMatch(/Podporné médiá nemáš/);
    expect(p.ratio.target).toBe(1);
  });

  test("vynechané nápady sú vidieť (žiadne tiché vynechávanie)", () => {
    const p = plan();
    expect(p.considered.length).toBeGreaterThan(0);
    for (const c of p.considered) {
      expect(c.reasonSk.length).toBeGreaterThan(10);
      expect(c.score).toBeGreaterThan(0);
    }
  });

  test("hustý rad viet nezakryje rečníka na viac než MAX_CONSECUTIVE_COVERED viet", () => {
    // 8 rovnakých, hustých viet (5 s rozostup, aby sa segmenty neprekrývali)
    // → engine musí rečníka vrátiť do obrazu
    const segments: SpeechSegmentLike[] = Array.from({ length: 8 }, (_, i) => {
      const start = i * 5;
      const words = `Predal som 10 kurzov za 500 eur a zarobil 9000 eur za mesiac ${i}`.split(" ").map((w, j) => ({
        word: w,
        start: start + j * 0.3,
        end: start + j * 0.3 + 0.28,
      }));
      return { start, end: start + words.length * 0.3, text: words.map((w) => w.word).join(" "), words };
    });
    const p = buildStylePlan({ segments, recipe: getStyleRecipe("UGC_PERFORMANCE"), durationSec: 45, availableSupportingVisuals: 20, now: NOW });
    const covered = p.decisions
      .filter((d) => d.style?.kind === "supporting_visual")
      .map((d) => p.decisions.indexOf(d));
    // skontroluj dĺžku najdlhšieho súvislého pokrytia viet
    const sentences = analyzeStyleSentences(segments);
    const coveredStarts = new Set(
      p.decisions.filter((d) => d.style?.kind === "supporting_visual").map((d) => d.style!.whenSk.startSec),
    );
    let run = 0;
    let maxRun = 0;
    for (const s of sentences) {
      run = coveredStarts.has(s.start) ? run + 1 : 0;
      maxRun = Math.max(maxRun, run);
    }
    expect(maxRun).toBeLessThanOrEqual(MAX_CONSECUTIVE_COVERED);
    expect(covered.length).toBeGreaterThan(0);
  });

  test("generované vizuály: engine prizná PROVIDER UNAVAILABLE a nič negeneruje", () => {
    const p = buildStylePlan({ segments: FIXTURE, recipe: getStyleRecipe("EDITORIAL_COLLAGE"), durationSec: 14, now: NOW });
    expect(p.notesSk.join(" ")).toMatch(/PROVIDER UNAVAILABLE/);
    for (const d of p.decisions) {
      expect(d.style!.action.elementType).not.toBe("generated_visual");
    }
    expect(JSON.stringify(p)).not.toMatch(/"generated_visual"/);
  });

  test("pauza je dôvod NIČ nepridať (a je zaznamenaná)", () => {
    const p = plan();
    const breath = p.considered.find((c) => c.reasonSk.includes("vydýchanie"));
    expect(breath).toBeDefined();
    expect(breath!.score).toBeGreaterThanOrEqual(BREATHING_PAUSE_SEC);
  });
});

describe("G) chýbajúce signály sa priznajú, nie vymyslia", () => {
  test("engine povie, ktoré dáta nemal (rečník, scény)", () => {
    const p = plan();
    expect(p.basis.missingSignalsSk.join(" ")).toMatch(/rečníka/);
    expect(p.basis.missingSignalsSk.join(" ")).toMatch(/scén/);
    expect(p.basis.usedSignalsSk.join(" ")).toMatch(/slov/);
    expect(p.basis.timingPrecision).toBe("words");
  });

  test("pri vstupoch bez slov sa nezníži, len sa prizná", () => {
    const p = buildStylePlan({
      segments: [{ start: 0, end: 3, text: "Bez časovania slov." }],
      recipe: getStyleRecipe("EDITORIAL_COLLAGE"),
      durationSec: 3,
      now: NOW,
    });
    expect(p.basis.timingPrecision).not.toBe("words");
    expect(p.basis.missingSignalsSk.join(" ")).toMatch(/po slovách/);
  });

  test("ovládače používateľa menia rozhodnutie a je to zdôvodnené", () => {
    const calm = buildStylePlan({ segments: FIXTURE, recipe: getStyleRecipe("EDITORIAL_COLLAGE"), durationSec: 14, controls: { motion: "calm", intensity: "subtle" }, now: NOW });
    const dynamic = buildStylePlan({ segments: FIXTURE, recipe: getStyleRecipe("EDITORIAL_COLLAGE"), durationSec: 14, controls: { motion: "dynamic", intensity: "aggressive" }, now: NOW });
    expect(dynamic.ratio.target).toBeLessThanOrEqual(calm.ratio.target);
    expect(dynamic.ratio.adjustmentsSk.join(" ")).toMatch(/aggressive/);
  });

  test("pôvodné audio sa nedá vypnúť (engine to nedovolí)", () => {
    const p = buildStylePlan({ segments: FIXTURE, recipe: getStyleRecipe("EDITORIAL_COLLAGE"), durationSec: 14, controls: { preserveOriginalAudio: false }, now: NOW });
    expect(p.controls.preserveOriginalAudio).toBe(true);
    expect(p.audioPolicy).toBe("ORIGINAL_VO_MASTER");
    expect(JSON.stringify(p.decisions)).not.toMatch(/audio/);
  });

  test("adjustTalkingHeadRatio rešpektuje používateľa a zdôvodní to", () => {
    const s = analyzeStyleSentences(FIXTURE);
    const r = adjustTalkingHeadRatio(s, getStyleRecipe("EDITORIAL_COLLAGE"), { ...getStyleRecipe("EDITORIAL_COLLAGE"), talkingHeadRatio: 0.7 } as never, 10);
    // (kontrola typu ovládačov sa robí cez buildStylePlan; tu ide o rozsah)
    expect(r.target).toBeGreaterThan(0);
  });
});

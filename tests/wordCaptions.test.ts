import { describe, expect, test } from "bun:test";
import {
  activeWordAt,
  clampWordsToWindow,
  hasUsableWordTiming,
  wordsShareToken,
  wordsToAbsolute,
  wordsToRelative,
} from "../src/core/transcript/wordTiming";
import { buildCanonicalExportPlan } from "../src/core/export/canonicalExport";
import { buildCanonicalFramePlan } from "../src/core/render/canonicalFrame";
import { slimSegments } from "../src/core/export/burnJob";
import { createCanonicalClip, type ProjectModel } from "../src/core/types/project";
import { createInitialProject } from "../src/core";

/**
 * Krok 17 — **TITULKY PO SLOVÁCH** (časovanie slov z prepisu → canonical vrstva →
 * export → zvýrazňovanie hovoreného slova).
 *
 * POZOR (reporting): toto je **UNIT TESTED**. Neznamená to, že sa to niekde
 * vykreslilo naozaj — to dokazuje samostatný runner `tools/verify-word-captions.ts`
 * (REAL MEDIA / REAL EXPORT). Tu sa testuje len matematika a dátová cesta.
 */

const WORDS = [
  { word: "Za", start: 0.0, end: 0.3 },
  { word: "5", start: 0.35, end: 0.6 },
  { word: "minút", start: 0.62, end: 1.0 },
  { word: "denne", start: 1.02, end: 1.4 },
];

function projectWithCaptionClip(
  words?: { word: string; start: number; end: number }[],
  clipStart = 2,
  duration = 3,
  preset = "VIRAL_BOLD",
): ProjectModel {
  const project = createInitialProject();
  const captionTrack = project.tracks.find((t) => t.type === "caption") ?? project.tracks[0];
  const videoTrack = project.tracks.find((t) => t.type === "video") ?? project.tracks[0];
  const videoClip = createCanonicalClip({
    id: "main_video",
    trackId: videoTrack.id,
    type: "video",
    name: "Hlavné video",
    assetId: "asset_main",
    timelineStart: 0,
    sourceStart: 0,
    sourceEnd: 20,
    duration: 20,
    speed: 1,
    keyframes: [],
  });
  const clip = createCanonicalClip({
    id: "cap_words_1",
    trackId: captionTrack.id,
    type: "caption",
    name: "Titulok: Za 5 minút denne",
    timelineStart: clipStart,
    sourceStart: 0,
    sourceEnd: duration,
    duration,
    speed: 1,
    scale: 100,
    opacity: 100,
    textConfig: {
      content: "Za 5 minút denne",
      fontFamily: "Inter, sans-serif",
      fontSize: 64,
      color: "#ffffff",
      textAlign: "center",
      fontWeight: "bold",
      ...(words ? { words } : {}),
    },
    captionStyle: {
      font: "Inter",
      fontSize: 64,
      color: "#ffffff",
      alignment: "center",
      position: "bottom",
      maxCharsPerLine: 20,
      maxLines: 2,
      preset: preset as never,
    },
    keyframes: [],
  });
  const withClip: ProjectModel = {
    ...project,
    tracks: project.tracks.map((t) => {
      if (t.id === captionTrack.id) return { ...t, clips: [...t.clips, clip] };
      if (t.id === videoTrack.id) return { ...t, clips: [...t.clips, videoClip] };
      return t;
    }),
  };
  return withClip;
}

// ---------------------------------------------------------------------------
// A) Čisté funkcie — časovanie slov (bez videa, bez stavu)
// ---------------------------------------------------------------------------

describe("A) časovanie slov — čisté funkcie", () => {
  test("prepis → klip (relatívne) a späť (absolútne) dá presne pôvodné časy", () => {
    const rel = wordsToRelative(WORDS, 2.5);
    expect(rel.map((w) => w.start)).toEqual([-2.5, -2.15, -1.88, -1.48]);
    const abs = wordsToAbsolute(rel, 2.5);
    expect(abs.map((w) => w.start)).toEqual([0, 0.35, 0.62, 1.02]);
    expect(abs.map((w) => w.word)).toEqual(["Za", "5", "minút", "denne"]);
  });

  test("slová mimo okna klipu sa zahodia a tie na okraji sa orežú (nikdy sa nedomýšľajú)", () => {
    const rel = wordsToRelative(WORDS, 0); // 0 … 1,4 s
    const kept = clampWordsToWindow(rel, 0.3, 1.05);
    // „Za“ (0–0,3) do okna nezasahuje → von. „denne“ (1,02–1,4) do okna zasahuje
    // (v okne sa ešte hovorí) → ostáva, ale orezané presne na koniec okna.
    expect(kept.map((w) => w.word)).toEqual(["5", "minút", "denne"]);
    expect(kept[0].start).toBe(0.35);
    expect(kept[1].end).toBe(1.0);
    expect(kept[2].end).toBe(1.05);
    expect(clampWordsToWindow(rel, 2, 3)).toEqual([]); // okno bez slov = prázdno
  });

  test("prázdne a pokazené časovanie sa nikdy nevymyslí", () => {
    expect(hasUsableWordTiming([])).toBe(false);
    expect(hasUsableWordTiming(undefined)).toBe(false);
    expect(hasUsableWordTiming([{ word: "   ", start: 0, end: 1 }])).toBe(false);
    expect(hasUsableWordTiming([{ word: "a", start: 1, end: 1 }])).toBe(false);
    expect(hasUsableWordTiming([{ word: "a", start: 0, end: 0.2 }])).toBe(true);
    expect(wordsToRelative([{ word: "", start: 0, end: 1 }], 0)).toEqual([]);
  });

  test("aktívne slovo: pred prvým slovom nič, ticho patrí predchádzajúcemu slovu", () => {
    expect(activeWordAt(WORDS, -0.5)).toBeNull();
    expect(activeWordAt(WORDS, 0.0)?.word).toBe("Za");
    expect(activeWordAt(WORDS, 0.34)?.word).toBe("Za"); // medzera = ešte predchádzajúce slovo
    expect(activeWordAt(WORDS, 0.35)?.word).toBe("5");
    expect(activeWordAt(WORDS, 1.3)?.word).toBe("denne");
  });

  test("posledné slovo platí do svojho konca (a ďalej už nič)", () => {
    expect(activeWordAt(WORDS, 1.39)?.word).toBe("denne");
    expect(activeWordAt(WORDS, 1.5)).toBeNull();
    expect(activeWordAt(WORDS, 1.5, 2.0)?.word).toBe("denne"); // s deklarovaným koncom vety
    expect(activeWordAt(WORDS, 2.1, 2.0)).toBeNull();
  });

  test("porovnanie tokenu je zhovievavé k interpunkcii a veľkosti, ale nič nehalucinuje", () => {
    expect(wordsShareToken("DENNE,", "denne")).toBe(true);
    expect(wordsShareToken("minút", "minúty")).toBe(true); // spoločný začiatok (skloňovanie)
    expect(wordsShareToken("3000", "3000")).toBe(true);
    expect(wordsShareToken("...", "denne")).toBe(false);
    expect(wordsShareToken("", "denne")).toBe(false);
    expect(wordsShareToken("denne", "")).toBe(false);
  });

  test("determinizmus: dva behy dajú tie isté hodnoty", () => {
    const a = JSON.stringify(activeWordAt(WORDS, 0.5));
    const b = JSON.stringify(activeWordAt(WORDS, 0.5));
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// B) Canonical os → exportné zadanie (slová musia doraziť k vypáleniu)
// ---------------------------------------------------------------------------

describe("B) canonical → export: časovanie slov ide so zadaním", () => {
  const upload = { uploadId: "u1", uploadName: "video.mp4", width: 1080, height: 1920 };

  test("titulok s časovaním: slová sú v zadaní v ABSOLÚTNYCH časoch a v okne klipu", () => {
    const rel = wordsToRelative(WORDS, 0); // slová 0…1,4 s
    const project = projectWithCaptionClip(rel, 2, 3);
    const plan = buildCanonicalExportPlan(project, upload);
    expect(plan.captionsWithWords).toBe(1);
    expect(plan.captionsWithoutWords).toBe(0);
    const seg = plan.request.segments[0];
    expect(seg.start).toBe(2);
    expect(seg.end).toBe(5);
    expect(seg.words?.length).toBe(4);
    expect(seg.words?.map((w) => w.start)).toEqual([2, 2.35, 2.62, 3.02]);
    expect(seg.words?.every((w) => w.start >= 2 && w.end <= 5)).toBe(true);
    expect(plan.notesSk.some((n) => n.includes("časovanie slov z prepisu"))).toBe(true);
  });

  test("titulok bez časovania: žiadne vymyslené slová, poctivá poznámka", () => {
    const project = projectWithCaptionClip(undefined, 2, 3);
    const plan = buildCanonicalExportPlan(project, upload);
    expect(plan.captionsWithWords).toBe(0);
    expect(plan.captionsWithoutWords).toBe(1);
    expect(plan.request.segments[0].words).toBeUndefined();
    expect(plan.notesSk.some((n) => n.includes("nemá časovanie slov"))).toBe(true);
  });

  test("klip je kratší než prepis: do zadania idú len slová z okna klipu", () => {
    const rel = wordsToRelative(WORDS, 0); // 0…1,4 s
    const project = projectWithCaptionClip(rel, 10, 0.7); // okno 10…10,7
    const plan = buildCanonicalExportPlan(project, upload);
    const seg = plan.request.segments[0];
    expect(seg.words?.map((w) => w.word)).toEqual(["Za", "5", "minút"]);
    const last = seg.words![2];
    expect(last.end).toBe(10.7);
  });

  test("slová prežijú vyčistenie na strane servera (slimSegments)", () => {
    const rel = wordsToRelative(WORDS, 0);
    const project = projectWithCaptionClip(rel, 2, 3);
    const plan = buildCanonicalExportPlan(project, upload);
    const slim = slimSegments(plan.request.segments as never);
    expect(slim[0].words?.length).toBe(4);
    expect(slim[0].words?.[1]).toEqual({ word: "5", start: 2.35, end: 2.6 });
  });

  test("parita canonical ↔ zadanie zostáva zelená (texty sedia, nič navyše)", () => {
    const rel = wordsToRelative(WORDS, 0);
    const project = projectWithCaptionClip(rel, 2, 3);
    const plan = buildCanonicalExportPlan(project, upload);
    expect(plan.parity.matched).toBe(true);
    expect(plan.parity.missingTexts).toEqual([]);
    expect(plan.parity.extraTexts).toEqual([]);
    expect(plan.canExport).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// C) Canonical plán snímky — náhľad musí vidieť to isté
// ---------------------------------------------------------------------------

describe("C) canonical plán snímky nesie slová a predvoľbu", () => {
  test("textová vrstva má slová (relatívne ku klipu) aj predvoľbu štýlu", () => {
    const rel = wordsToRelative(WORDS, 0);
    const project = projectWithCaptionClip(rel, 2, 3);
    const frame = buildCanonicalFramePlan(project, 2.4);
    const layer = frame.layers.find((l) => l.kind === "text");
    expect(layer).toBeTruthy();
    expect(layer!.text).toBe("Za 5 minút denne");
    expect(layer!.words?.length).toBe(4);
    expect(layer!.captionPreset).toBe("VIRAL_BOLD");
    expect(layer!.clipTime).toBeCloseTo(0.4, 3);
    // v čase 0,4 s klipu je hovorené slovo „5“ (0,35–0,62) a to je aj v náhľade
    expect(activeWordAt(layer!.words!, layer!.clipTime)?.word).toBe("5");
  });

  test("bez časovania slov vrstva slová nemá (nič sa nepredstiera)", () => {
    const project = projectWithCaptionClip(undefined, 2, 3);
    const frame = buildCanonicalFramePlan(project, 2.4);
    const layer = frame.layers.find((l) => l.kind === "text");
    expect(layer!.words).toBeUndefined();
    expect(layer!.captionPreset).toBe("VIRAL_BOLD");
  });

  test("štýl, ktorý hovorené slovo nezvýrazňuje, dostane slová, ale zvýraznenie sa vypne", async () => {
    // CLEAN = highlightMode „none“ — pravidlo drží katalóg štýlov, nie náhľad.
    const rel = wordsToRelative(WORDS, 0);
    const project = projectWithCaptionClip(rel, 2, 3, "CLEAN");
    const frame = buildCanonicalFramePlan(project, 2.4);
    const layer = frame.layers.find((l) => l.kind === "text");
    expect(layer!.words?.length).toBe(4);
    const { CAPTION_STYLES } = await import("../src/core/export/subtitleRender");
    expect(CAPTION_STYLES.find((s) => s.id === "CLEAN")?.highlightMode).toBe("none");
  });
});

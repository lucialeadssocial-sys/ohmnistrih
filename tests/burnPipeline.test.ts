import { describe, expect, test, beforeAll } from "bun:test";
import { execSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildAssForCut,
  buildBurnFfmpegArgs,
  getCaptionStyle,
  normalizeKeepRanges,
  pluralSk,
  remapSegmentsToOutput,
  type KeepRange,
} from "../src/core/export/subtitleRender";
import {
  BURN_LIMITS,
  BurnJobStore,
  burnJobStatus,
  isSafeStoredName,
  parseFfmpegProgress,
  pruneDir,
  safeBaseName,
  slimSegments,
  uploadStorageName,
  validateBurnRequest,
} from "../src/core/export/burnJob";
import {
  findFfmpegPath,
  parseFfmpegProbe,
  prepareCaptionFont,
  probeVideoFile,
} from "../src/core/export/ffmpegEnv";
import type { SpeechSegmentLike } from "../src/core/transcript/wordTiming";

/**
 * Testy serverovej časti kroku B (vypálenie titulkov).
 *
 * Dve roviny, rovnako ako pri ASS:
 *  1. **všetko, čo sa dá bez ffmpeg** — prepočet časov pri strihu, validácia,
 *     percentá z ffmpeg, stavová mašina, bezpečné názvy súborov,
 *  2. **jeden E2E test s ffmpeg** — či prepočítané titulky naozaj sedia v obraze
 *     (a v časti, ktorú sme vystrihli, naozaj nič nie je).
 */

const FFMPEG = findFfmpegPath()?.path ?? null;
const maybe = FFMPEG ? test : test.skip;
const work = mkdtempSync(join(tmpdir(), "burn-pipeline-"));

// ---------------------------------------------------------------------------
// Prepočet časov pri strihu
// ---------------------------------------------------------------------------

const SPEECH: SpeechSegmentLike[] = [
  {
    start: 0.2,
    end: 1.4,
    text: "Dnes si ukážeme",
    words: [
      { word: "Dnes", start: 0.2, end: 0.5 },
      { word: "si", start: 0.52, end: 0.7 },
      { word: "ukážeme", start: 0.72, end: 1.4 },
    ],
  },
  {
    start: 2.0,
    end: 2.8,
    text: "tajný postup",
    words: [
      { word: "tajný", start: 2.0, end: 2.4 },
      { word: "postup", start: 2.4, end: 2.8 },
    ],
  },
  {
    start: 3.2,
    end: 4.3,
    text: "ako som to spravil",
    words: [
      { word: "ako", start: 3.2, end: 3.5 },
      { word: "som", start: 3.5, end: 3.7 },
      { word: "to", start: 3.7, end: 3.9 },
      { word: "spravil", start: 3.9, end: 4.3 },
    ],
  },
];

describe("strih → titulky: čas zdroja sa prepočíta na čas klipu", () => {
  test("bez strihu sa nič nemení", () => {
    const r = remapSegmentsToOutput(SPEECH, []);
    expect(r.segments.length).toBe(3);
    expect(r.segments[0].start).toBeCloseTo(0.2, 3);
    expect(r.outputDurationSec).toBeCloseTo(4.3, 3);
    expect(r.notesSk.length).toBe(0);
  });

  test("jeden zachovaný úsek posunie titulky na začiatok klipu", () => {
    const r = remapSegmentsToOutput(SPEECH, [{ start: 3.0, end: 4.5 }]);
    expect(r.outputDurationSec).toBeCloseTo(1.5, 3);
    expect(r.segments.length).toBe(1);
    // 3,2 s v zdroji = 0,2 s v klipе (klip začína na 3,0 s)
    expect(r.segments[0].start).toBeCloseTo(0.2, 3);
    expect(r.segments[0].end).toBeCloseTo(1.3, 3);
    expect(r.segments[0].words?.[0].start).toBeCloseTo(0.2, 3);
  });

  test("dva úseky: titulok z vystrihnutej časti zmizne a zvyšok sa posunie", () => {
    const keep: KeepRange[] = [
      { start: 0, end: 1.6 },
      { start: 3.0, end: 4.5 },
    ];
    const r = remapSegmentsToOutput(SPEECH, keep);
    expect(r.outputDurationSec).toBeCloseTo(3.1, 3);
    expect(r.segments.length).toBe(2);

    // Prvý titulok zostáva na 0,2–1,4
    expect(r.segments[0].text).toBe("Dnes si ukážeme");
    expect(r.segments[0].start).toBeCloseTo(0.2, 3);
    expect(r.segments[0].end).toBeCloseTo(1.4, 3);

    // „tajný postup" ležal celý vo vystrihnutej časti → nie je v klipе
    expect(r.segments.some((s) => s.text.includes("tajný"))).toBe(false);

    // „ako som to spravil" sa posunul o 1,6 s (dĺžka prvého úseku)
    const third = r.segments[1];
    expect(third.text).toBe("ako som to spravil");
    expect(third.start).toBeCloseTo(1.8, 3);
    expect(third.end).toBeCloseTo(2.9, 3);
    expect(r.droppedSegments).toBe(1);
    expect(r.notesSk).toContain("Jeden titulok ležal celý vo vystrihnutej časti — vo výsledku nie je.");
  });

  test("slová preseknuté strihom sa orežú a appka to napočíta", () => {
    const r = remapSegmentsToOutput(SPEECH, [{ start: 0, end: 1.0 }]);
    const first = r.segments[0];
    expect(first.end).toBeCloseTo(1.0, 3);
    // „ukážeme" (0,72–1,4) sa oreže na 0,72–1,0
    const last = first.words![first.words!.length - 1];
    expect(last.word).toBe("ukážeme");
    expect(last.end).toBeCloseTo(1.0, 3);
    expect(r.clippedWords).toBe(1);
    expect(r.notesSk.some((n) => n.includes("preskolil"))).toBe(true);
  });

  test("titulok bez časovania slov patrí do úseku, kde trávi najviac času (nezdvojí sa)", () => {
    const wordless: SpeechSegmentLike[] = [{ start: 2.0, end: 4.0, text: "Celá veta bez slov" }];
    const r = remapSegmentsToOutput(wordless, [
      { start: 0, end: 3.0 },
      { start: 3.5, end: 5.0 },
    ]);
    expect(r.segments.length).toBe(1);
    // väčšia časť (2,0–3,0 = 1,0 s) je v prvom úseku → tam patrí
    expect(r.segments[0].start).toBeCloseTo(2.0, 3);
    expect(r.segments[0].end).toBeCloseTo(3.0, 3);
  });

  test("úseky sa zjednotia, zoradia a príliš krátke sa ignorujú", () => {
    const merged = normalizeKeepRanges([
      { start: 5, end: 6 },
      { start: 1, end: 2 },
      { start: 1.9, end: 3 },
      { start: 9, end: 9.001 },
      { start: -3, end: -1 },
    ]);
    expect(merged).toEqual([
      { start: 1, end: 3 },
      { start: 5, end: 6 },
    ]);
  });
});

describe("texty pre človeka (slovenské tvary)", () => {
  test("pluralSk drží tvary 1 / 2–4 / 5+", () => {
    expect(pluralSk(1, "slovo", "slová", "slov")).toBe("1 slovo");
    expect(pluralSk(3, "slovo", "slová", "slov")).toBe("3 slová");
    expect(pluralSk(7, "slovo", "slová", "slov")).toBe("7 slov");
    expect(pluralSk(0, "titulok", "titulky", "titulkov")).toBe("0 titulkov");
  });

  test("jeden vystrihnutý titulok je napísaný v jednotnom čísle", () => {
    const r = remapSegmentsToOutput(SPEECH, [
      { start: 0, end: 1.6 },
      { start: 3.0, end: 4.5 },
    ]);
    expect(r.droppedSegments).toBe(1);
    expect(r.notesSk).toContain("Jeden titulok ležal celý vo vystrihnutej časti — vo výsledku nie je.");
  });

  test("viac vystrihnutých titulkov je v množnom čísle", () => {
    const many: SpeechSegmentLike[] = [
      { start: 8.0, end: 8.5, text: "prvý" },
      { start: 8.6, end: 9.0, text: "druhý" },
      { start: 9.1, end: 9.5, text: "tretí" },
    ];
    const r = remapSegmentsToOutput(many, [{ start: 0, end: 1 }]);
    expect(r.droppedSegments).toBe(3);
    expect(r.notesSk.some((n) => n.includes("3 titulky ležalo celé"))).toBe(true);
  });
});

describe("ASS pre klip (strih + titulky v jednom)", () => {
  const style = getCaptionStyle("VIRAL_BOLD");
  const keep: KeepRange[] = [
    { start: 0, end: 1.6 },
    { start: 3.0, end: 4.5 },
  ];

  test("žiadna udalosť nepresahuje dĺžku klipu", () => {
    const built = buildAssForCut({
      segments: SPEECH,
      keepRanges: keep,
      style,
      width: 1080,
      height: 1920,
      fontName: "DejaVu Sans",
    });
    expect(built.clipDurationSec).toBeCloseTo(3.1, 3);
    const times = [...built.ass.matchAll(/Dialogue: 0,(\d+):(\d{2}):(\d{2}\.\d{2}),(\d+):(\d{2}):(\d{2}\.\d{2})/g)];
    expect(times.length).toBeGreaterThan(0);
    expect(times.length).toBe(built.eventCount);
    for (const t of times) {
      const start = Number(t[1]) * 3600 + Number(t[2]) * 60 + Number(t[3]);
      const end = Number(t[4]) * 3600 + Number(t[5]) * 60 + Number(t[6]);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeLessThanOrEqual(3.1 + 0.05);
    }
  });

  test("poznámky povedia, čo strih s titulkami spravil", () => {
    const built = buildAssForCut({
      segments: SPEECH,
      keepRanges: keep,
      style,
      width: 640,
      height: 360,
      fontName: "DejaVu Sans",
    });
    expect(built.notesSk.length).toBeGreaterThan(0);
    expect(built.remap.droppedSegments).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Validácia požiadavky
// ---------------------------------------------------------------------------

const validBody = {
  uploadId: "abc-123__video.mp4",
  uploadName: "Moje video.mp4",
  styleId: "VIRAL_BOLD",
  width: 1080,
  height: 1920,
  segments: SPEECH,
  keepRanges: [
    { start: 0, end: 1.6 },
    { start: 3.0, end: 4.5 },
  ],
};

describe("validácia požiadavky na vypálenie", () => {
  test("správna požiadavka prejde a názov výsledku je bezpečný", () => {
    const r = validateBurnRequest(validBody);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spec.styleId).toBe("VIRAL_BOLD");
    expect(r.spec.uploadId).toBe("abc-123__video.mp4");
    expect(r.spec.outputName.endsWith(".mp4")).toBe(true);
    expect(isSafeStoredName(r.spec.outputName)).toBe(true);
    expect(r.spec.keepRanges.length).toBe(2);
  });

  test("cesta v názve sa nikdy nedostane von z adresára", () => {
    const r = validateBurnRequest({ ...validBody, uploadName: "../../etc/passwd" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spec.outputName.includes("..")).toBe(false);
    expect(r.spec.outputName.includes("/")).toBe(false);
    expect(isSafeStoredName(r.spec.outputName)).toBe(true);
  });

  test("bez titulkov render odmietne s vysvetlením", () => {
    const r = validateBurnRequest({ ...validBody, segments: [] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errorSk).toContain("Automatické titulky");
  });

  test("neznámy štýl vráti, čo je na výber", () => {
    const r = validateBurnRequest({ ...validBody, styleId: "MEGA" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errorSk).toContain("VIRAL_BOLD");
  });

  test("nezmyselné rozlíšenie sa odmietne (radšej nič než rozbitý klip)", () => {
    expect(validateBurnRequest({ ...validBody, width: 2, height: 2 }).ok).toBe(false);
    expect(validateBurnRequest({ ...validBody, width: 99999, height: 1920 }).ok).toBe(false);
  });

  test("chýbajúci identifikátor videa sa odmietne", () => {
    expect(validateBurnRequest({ ...validBody, uploadId: "" }).ok).toBe(false);
    expect(validateBurnRequest({ ...validBody, uploadId: "../../video.mp4" }).ok).toBe(false);
  });

  test("veľa úsekov naraz sa odmietne (limit)", () => {
    const many = Array.from({ length: BURN_LIMITS.maxKeepRanges + 1 }, (_, i) => ({
      start: i * 2,
      end: i * 2 + 1,
    }));
    const r = validateBurnRequest({ ...validBody, keepRanges: many });
    expect(r.ok).toBe(false);
  });
});

describe("bezpečné názvy súborov", () => {
  test("safeBaseName odstráni cestu aj riadiace znaky", () => {
    expect(safeBaseName("/tmp/x/Video.mp4")).toBe("Video.mp4");
    expect(safeBaseName("..\\..\\windows\\evil.mp4")).toBe("evil.mp4");
    expect(safeBaseName("a\u0000b\u001fc.mp4")).toBe("abc.mp4");
    expect(safeBaseName("")).toBe("video.mp4");
    expect(safeBaseName("....")).toBe("video.mp4");
  });

  test("isSafeStoredName pustí len jednoduché mená", () => {
    expect(isSafeStoredName("abc-123__video.mp4")).toBe(true);
    expect(isSafeStoredName("a/b.mp4")).toBe(false);
    expect(isSafeStoredName("a\\b.mp4")).toBe(false);
    expect(isSafeStoredName("..%2fetc")).toBe(false);
    expect(isSafeStoredName("")).toBe(false);
  });

  test("uložené meno je jedinečné a nesie pôvodný názov", () => {
    const n1 = uploadStorageName("Moje video.mp4", "id-1");
    const n2 = uploadStorageName("Moje video.mp4", "id-2");
    expect(n1).not.toBe(n2);
    expect(n1).toContain("Moje_video");
    expect(n1.endsWith(".mp4")).toBe(true);
    expect(isSafeStoredName(n1)).toBe(true);
  });

  test("slimSegments zbaví segmenty zbytočných polí", () => {
    const slim = slimSegments([
      { id: "x", start: 1, end: 2, text: "ahoj", words: [{ word: "ahoj", start: 1, end: 2, highlight: true }] } as any,
    ]);
    expect(slim[0].id).toBeUndefined();
    expect(slim[0].words?.[0].word).toBe("ahoj");
    expect((slim[0].words?.[0] as any).highlight).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Priebeh z ffmpeg
// ---------------------------------------------------------------------------

describe("percentá z ffmpeg", () => {
  test("out_time_us sa prepočíta na percentá", () => {
    expect(parseFfmpegProgress("out_time_us=500000", 2)).toBe(25);
    expect(parseFfmpegProgress("out_time_us=1000000", 2)).toBe(50);
    // `out_time_ms` je v ffmpeg tiež v mikrosekundách
    expect(parseFfmpegProgress("out_time_ms=1500000", 3)).toBe(50);
  });

  test("nikdy neukáže 100 %, kým ffmpeg nedobehol (a nikdy nejde pod 0)", () => {
    expect(parseFfmpegProgress("out_time_us=5000000", 2)).toBe(99);
    expect(parseFfmpegProgress("out_time_us=-1", 2)).toBeNull();
    expect(parseFfmpegProgress("progress=end", 2)).toBe(100);
  });

  test("iné riadky vracia ako null (nič sa nevymýšľa)", () => {
    expect(parseFfmpegProgress("frame=42", 2)).toBeNull();
    expect(parseFfmpegProgress("", 2)).toBeNull();
    expect(parseFfmpegProgress("out_time_us=500000", 0)).toBeNull();
  });

  test("vie aj klasický tvar out_time=H:MM:SS", () => {
    expect(parseFfmpegProgress("out_time=00:00:01.000000", 4)).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// Stavová mašina renderu
// ---------------------------------------------------------------------------

describe("stav renderu", () => {
  test("percentá nikdy neklesnú a 100 je len po dokončení", () => {
    const store = new BurnJobStore();
    const job = store.create({ styleId: "VIRAL_BOLD", width: 1080, height: 1920, keepCount: 2 });
    store.patch(job.id, { percent: 40 });
    store.patch(job.id, { percent: 12 });
    expect(store.get(job.id)!.percent).toBe(40);
    store.patch(job.id, { percent: 100 });
    expect(store.get(job.id)!.percent).toBe(99);
    store.finish(job.id, {
      outputName: "out.mp4",
      outputUrl: "/api/export/file/out.mp4",
      sizeBytes: 10,
      clipDurationSec: 3,
      summarySk: "hotovo",
    });
    expect(store.get(job.id)!.percent).toBe(100);
    expect(store.get(job.id)!.state).toBe("done");
  });

  test("zlyhanie nesie dôvod — nikdy tiché", () => {
    const store = new BurnJobStore();
    const job = store.create({ styleId: "CLEAN", width: 640, height: 360, keepCount: 0 });
    store.fail(job.id, "ffmpeg kód 1", ["No such filter"]);
    const status = burnJobStatus(store.get(job.id)!);
    expect(status.state).toBe("error");
    expect(status.errorSk).toContain("ffmpeg");
    expect(store.get(job.id)!.logTail).toEqual(["No such filter"]);
  });

  test("zastavenie renderu je vidieť a je poctivé", () => {
    const store = new BurnJobStore();
    const job = store.create({ styleId: "MINIMAL", width: 640, height: 360, keepCount: 0 });
    store.patch(job.id, { state: "rendering", percent: 30 });
    store.cancel(job.id);
    expect(store.get(job.id)!.state).toBe("canceled");
    expect(store.get(job.id)!.messageSk).toContain("nedotknuté");
    // po dokončení už zastaviť nemožno
    store.finish(job.id, {
      outputName: "o.mp4",
      outputUrl: "/api/export/file/o.mp4",
      sizeBytes: 1,
      clipDurationSec: 1,
      summarySk: "x",
    });
    store.cancel(job.id);
    expect(store.get(job.id)!.state).toBe("done");
  });

  test("neznámy job nevracia nič (žiadne vymyslené úspechy)", () => {
    const store = new BurnJobStore();
    expect(store.get("neexistuje")).toBeUndefined();
    expect(store.patch("neexistuje", { percent: 50 })).toBeUndefined();
    expect(store.cancel("neexistuje")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Upratovanie
// ---------------------------------------------------------------------------

describe("upratovanie v adresároch", () => {
  test("nechá najnovšie súbory a staré zmaže", () => {
    const dir = mkdtempSync(join(tmpdir(), "prune-"));
    for (let i = 0; i < 5; i++) {
      const f = join(dir, `f${i}.mp4`);
      writeFileSync(f, "x");
      const t = (Date.now() - (5 - i) * 1000) / 1000;
      utimesSync(f, t, t);
    }
    const removed = pruneDir(dir, 2);
    expect(removed).toBe(3);
    const left = execSync(`ls -1 ${dir}`, { encoding: "utf8" }).trim().split("\n").sort();
    expect(left).toEqual(["f3.mp4", "f4.mp4"]);
  });

  test("staré súbory zmaže aj pod limitom počtu (vek)", () => {
    const dir = mkdtempSync(join(tmpdir(), "prune-age-"));
    const oldFile = join(dir, "old.mp4");
    writeFileSync(oldFile, "x");
    const t = (Date.now() - 10 * 60 * 1000) / 1000;
    utimesSync(oldFile, t, t);
    writeFileSync(join(dir, "new.mp4"), "x");
    const removed = pruneDir(dir, 10, 5 * 60 * 1000);
    expect(removed).toBe(1);
    expect(existsSync(oldFile)).toBe(false);
    expect(existsSync(join(dir, "new.mp4"))).toBe(true);
  });

  test("neexistujúci adresár nie je chyba", () => {
    expect(pruneDir(join(tmpdir(), "neexistuje-xyz-123"), 3)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Zistenie parametrov videa (ffmpeg, bez ffprobe)
// ---------------------------------------------------------------------------

/** Skutočný výstup `ffmpeg -i` (skrátený) — parser sa učí z reality, nie z hlavy. */
const REAL_PROBE = `ffmpeg version 7.0.2 Copyright (c) 2000-2025 the FFmpeg developers
Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'src.mp4':
  Duration: 00:00:06.00, start: 0.000000, bitrate: 98 kb/s
  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(progressive), 1080x1920 [SAR 1:1 DAR 9:16], 18 kb/s, 30 fps, 30 tbr, 15360 tbn (default)
  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, mono, fltp, 69 kb/s (default)
At least one output file must be specified`;

describe("zistenie parametrov videa", () => {
  test("prečíta rozmery, fps a kodeky zo skutočného výstupu", () => {
    const p = parseFfmpegProbe(REAL_PROBE);
    expect(p.width).toBe(1080);
    expect(p.height).toBe(1920);
    expect(p.fps).toBe(30);
    expect(p.durationSec).toBeCloseTo(6.0, 2);
    expect(p.hasAudio).toBe(true);
    expect(p.videoCodec).toBe("h264");
    expect(p.audioCodec).toBe("aac");
  });

  test("video bez zvuku to povie (žiadne domýšľanie)", () => {
    const p = parseFfmpegProbe(
      "Input #0, mov,mp4, from 'x.mp4':\n  Duration: 00:00:02.50, start: 0.000000\n  Stream #0:0: Video: h264, yuv420p, 640x360, 25 fps, 25 tbr\n",
    );
    expect(p.hasAudio).toBe(false);
    expect(p.audioCodec).toBeNull();
  });

  test("nezmyselný vstup nespadne, len vráti prázdno", () => {
    const p = parseFfmpegProbe("nie je to vobec ffmpeg vystup");
    expect(p.width).toBeNull();
    expect(p.fps).toBeNull();
    expect(p.durationSec).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Písmo
// ---------------------------------------------------------------------------

describe("písmo pre titulky", () => {
  test("pripravené písmo vie poskytnúť adresár pre libass (alebo poctivo nič)", () => {
    const dir = mkdtempSync(join(tmpdir(), "fonts-resolve-"));
    const font = prepareCaptionFont(dir);
    if (font) {
      expect(font.fontName.length).toBeGreaterThan(0);
      expect(existsSync(font.fontsDir)).toBe(true);
      const files = readdirSync(font.fontsDir).filter((f) => f.endsWith(".ttf") || f.endsWith(".otf"));
      expect(files.length).toBeGreaterThan(0);
      expect(readFileSync(join(font.fontsDir, files[0])).length).toBeGreaterThan(1000);
      expect(font.sourceSk.length).toBeGreaterThan(0);
    } else {
      expect(font).toBeNull();
    }
  });
});

describe("strih nesmie potichu zmeniť snímkovú frekvenciu", () => {
  test("fps zdroja ide do filtra (inak concat ticho prepne na 25 fps)", () => {
    const args = buildBurnFfmpegArgs({
      inputPath: "/tmp/a.mp4",
      outputPath: "/tmp/b.mp4",
      assPath: "/tmp/s.ass",
      keepSegments: [{ start: 0, end: 1 }],
      sourceFps: 30,
    });
    const filter = args[args.indexOf("-filter_complex") + 1];
    expect(filter).toContain("fps=30");
  });

  test("bez znalosti fps sa filter nepridáva (nič sa nevymýšľa)", () => {
    const args = buildBurnFfmpegArgs({
      inputPath: "/tmp/a.mp4",
      outputPath: "/tmp/b.mp4",
      assPath: "/tmp/s.ass",
      keepSegments: [{ start: 0, end: 1 }],
    });
    const filter = args[args.indexOf("-filter_complex") + 1];
    expect(filter).not.toContain("fps=");
  });
});

// ---------------------------------------------------------------------------
// E2E: prepočítané titulky naozaj sedia v obraze
// ---------------------------------------------------------------------------

describe("titulky po strihu — skutočné vypálenie", () => {
  maybe("titulok je v zachovanej časti a v čase vystrihnutého titulku nie je nič", () => {
    if (!FFMPEG) throw new Error("ffmpeg nie je k dispozícii — E2E test nemožno spustiť.");
    const src = join(work, "src.mp4");
    execSync(
      // Zámerne 30 fps (nie 25) — práve na tomto sa ukázalo, že strih+concat
      // ticho prepne výstup na 25 fps a vyhodí snímky.
      `${FFMPEG} -y -hide_banner -loglevel error -f lavfi -i "color=c=black:size=640x360:rate=30" ` +
        `-f lavfi -i "sine=frequency=440" -t 6 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest ${src}`,
      { stdio: "pipe" },
    );

    const font = prepareCaptionFont(join(work, "fonts"));
    const built = buildAssForCut({
      segments: SPEECH,
      keepRanges: [
        { start: 0, end: 1.6 },
        { start: 3.0, end: 4.5 },
      ],
      style: getCaptionStyle("VIRAL_BOLD"),
      width: 640,
      height: 360,
      ...(font ? { fontName: font.fontName } : {}),
    });

    const assPath = join(work, "cut.ass");
    writeFileSync(assPath, built.ass);
    const out = join(work, "cut-burned.mp4");

    const probeSrc = probeVideoFile(FFMPEG, src);
    expect(probeSrc?.fps).toBe(30);

    const run = spawnSync(
      FFMPEG,
      buildBurnFfmpegArgs({
        inputPath: src,
        outputPath: out,
        assPath,
        ...(font ? { fontsDir: font.fontsDir } : {}),
        keepSegments: [
          { start: 0, end: 1.6 },
          { start: 3.0, end: 4.5 },
        ],
        sourceFps: probeSrc?.fps ?? undefined,
      }),
      { encoding: "utf8" },
    );
    if (run.status !== 0) console.error("ffmpeg zlyhal:", run.stderr?.slice(0, 600));
    expect(run.status).toBe(0);
    expect(statSync(out).size).toBeGreaterThan(1000);

    // Snímky sa nesmú stratiť: 1,6 s + 1,5 s pri 30 fps = 93 snímok.
    const outProbe = probeVideoFile(FFMPEG, out);
    expect(outProbe?.fps).toBe(30);
    const counted = execSync(`${FFMPEG} -hide_banner -i ${out} -map 0:v -f null - 2>&1 | tail -2`, {
      encoding: "utf8",
      shell: "/bin/bash",
    });
    const frames = Number((counted.match(/frame=\s*(\d+)/) || [])[1] ?? 0);
    expect(frames).toBe(93);

    const ymax = (t: string) => {
      const stats = execSync(
        `${FFMPEG} -y -hide_banner -ss ${t} -i ${out} -frames:v 1 ` +
          `-vf "signalstats,metadata=print:key=lavfi.signalstats.YMAX" -f null - 2>&1`,
        { encoding: "utf8", shell: "/bin/bash" },
      );
      const m = stats.match(/YMAX=([\d.]+)/);
      return m ? Number(m[1]) : -1;
    };

    // 0,6 s v klipе = titulok „DNES SI UKÁŽEME" (zachovaná časť) → text v obraze
    expect(ymax("0.6")).toBeGreaterThan(100);
    // 1,5 s v klipе = medzera medzi titulkami (1,4–1,8) → čierny obraz
    expect(ymax("1.5")).toBeLessThan(60);
    // 2,0 s v klipе = „AKO SOM TO SPRAVIL" po prepočte (zdroj 3,4 s) → text v obraze
    expect(ymax("2.0")).toBeGreaterThan(100);
  });
});

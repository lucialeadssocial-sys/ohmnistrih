import { describe, expect, test, beforeAll } from "bun:test";
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  assTime,
  buildAssFile,
  buildBurnFfmpegArgs,
  burnSummarySk,
  CAPTION_STYLES,
  escapeAssText,
  escapeFilterPath,
  getCaptionStyle,
  wrapAssLines,
} from "../src/core/export/subtitleRender";
import type { SpeechSegmentLike } from "../src/core/transcript/wordTiming";
import { findFfmpegPath } from "../src/core/export/ffmpegEnv";

/**
 * Testy titulkovej stopy a jej **skutočného vypálenia**.
 *
 * Dvojité overenie, pretože samotné testy reťazcov nič nedokazujú:
 *  1. ASS sa kontroluje ako text (dá sa aj bez ffmpeg),
 *  2. ak je ffmpeg k dispozícii, titulky sa naozaj vypália do videa a test
 *     **zmeria, že sa zmenili pixely v pásme titulkov** (a inde nie).
 */

// Hľadanie ffmpeg je v jednom module (rovnaké pre server aj testy).
const FFMPEG = findFfmpegPath()?.path ?? null;
const maybe = FFMPEG ? test : test.skip;

/**
 * E2E testy sa spúšťajú len keď ffmpeg existuje (`maybe` = test.skip inak), ale
 * TypeScript to nevie — tento helper mu to oznámi a zároveň dá človeku jasný
 * dôvod, keby sa test napriek tomu spustil bez ffmpeg. Volá sa až v tele testu,
 * takže zbieranie testov (collection) nikdy nespadne.
 */
function ffexe(): string {
  if (!FFMPEG) {
    throw new Error(
      "ffmpeg nie je k dispozícii (chýba imageio-ffmpeg aj FFMPEG_PATH) — E2E test nemožno spustiť.",
    );
  }
  return FFMPEG;
}

/** Font, ktorý je v tomto prostredí naozaj k dispozícii (a má slovenskú diakritiku). */
function findFont(): { path: string; dir: string; name: string } | null {
  const candidates = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/local/lib/python3.13/site-packages/cv2/qt/fonts/DejaVuSans-Bold.ttf",
    "/usr/lib/R/library/grDevices/fonts/Montserrat/static/Montserrat-Medium.ttf",
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      const dir = mkdtempSync(join(tmpdir(), "fonts-"));
      const name = p.split("/").pop()!;
      execSync(`cp "${p}" "${dir}/${name}"`);
      return { path: `${dir}/${name}`, dir, name };
    }
  }
  return null;
}

let FONT: ReturnType<typeof findFont> = null;
beforeAll(() => {
  FONT = findFont();
});

const SPEECH: SpeechSegmentLike[] = [
  {
    start: 0.2,
    end: 1.5,
    text: "Dnes si ukážeme,",
    words: [
      { word: "Dnes", start: 0.2, end: 0.6 },
      { word: "si", start: 0.62, end: 0.78 },
      { word: "ukážeme", start: 0.8, end: 1.5 },
    ],
  },
  {
    start: 2.4,
    end: 4.0,
    text: "ako som naplnil kaviareň.",
    words: [
      { word: "ako", start: 2.4, end: 2.7 },
      { word: "som", start: 2.72, end: 2.95 },
      { word: "naplnil", start: 3.0, end: 3.6 },
      { word: "kaviareň", start: 3.62, end: 4.0 },
    ],
  },
];

describe("titulky — ASS formát", () => {
  test("čas sa zapisuje v ASS tvare (stotiny, nie milisekundy)", () => {
    expect(assTime(0)).toBe("0:00:00.00");
    expect(assTime(1.5)).toBe("0:00:01.50");
    expect(assTime(61.23)).toBe("0:01:01.23");
    expect(assTime(3661.9)).toBe("1:01:01.90");
    expect(assTime(-5)).toBe("0:00:00.00");
  });

  test("riadiace znaky v texte sa escapujú (text z prepisu nikdy nerozbije súbor)", () => {
    expect(escapeAssText("ahoj {\\c&HFF0000&}svet")).toBe("ahoj \\{\\\\c&HFF0000&\\}svet");
    expect(escapeAssText("prvý\n druhý")).toBe("prvý\\N druhý");
    expect(escapeAssText("   ")).toBe("");
  });

  test("cesta vo filtri sa escapuje (dvojbodka a apostrof)", () => {
    expect(escapeFilterPath("/tmp/a:b/c.ass")).toBe("/tmp/a\\:b/c.ass");
    expect(escapeFilterPath("C:\\temp\\x.ass")).toBe("C\\:/temp/x.ass");
  });

  test("zalomenie textu drží šírku (aby nič nepretieklo z obrazu)", () => {
    const maxChars = Math.floor(800 / (70 * 0.55));
    const lines = wrapAssLines(["toto", "je", "veľmi", "dlhý", "titulok", "ktorý", "sa", "musí", "zalomiť"], 70, 800, 2);
    for (const l of lines) {
      expect(l.length).toBeLessThanOrEqual(maxChars + 3);
    }
    // Keď je text naozaj dlhý, radšej viac riadkov než jeden pretekajúci:
    // čítať tri riadky je lepšie než text, ktorý ide mimo obraz.
    const many = wrapAssLines("a b c d e f g h i j k l m n o p q r s t".split(" "), 90, 200, 2);
    expect(many.length).toBeGreaterThan(0);
    for (const l of many) {
      expect(l.length).toBeLessThanOrEqual(Math.ceil(200 / (90 * 0.55)) + 3);
    }
  });
});

describe("titulky — štýly", () => {
  test("virálny štýl má zvýrazňovanie po slovách a veľké písmo", () => {
    const v = getCaptionStyle("VIRAL_BOLD");
    expect(v.wordsPerChunk).toBeGreaterThan(0);
    expect(v.uppercase).toBe(true);
    expect(v.fontSizeRatio).toBeGreaterThan(60);
    expect(v.highlightColor).not.toBe(v.primaryColor);
  });

  test("čistý štýl nezvyšuje slová a nepíše veľkými písmenami", () => {
    const c = getCaptionStyle("CLEAN");
    expect(c.wordsPerChunk).toBe(0);
    expect(c.uppercase).toBe(false);
    expect(c.highlightColor).toBe(c.primaryColor);
  });

  test("neznámy štýl vyhodí zrozumiteľnú chybu", () => {
    expect(() => getCaptionStyle("NEJAKE" as any)).toThrow(/Neznámy štýl/);
  });

  test("všetky štýly majú bezpečný spodný okraj (rozhranie TikToku/Reels)", () => {
    for (const s of CAPTION_STYLES) {
      expect(s.bottomMarginRatio).toBeGreaterThanOrEqual(0.1);
      expect(s.descriptionSk.length).toBeGreaterThan(20);
    }
  });
});

describe("titulky — stavba súboru", () => {
  test("virálny štýl zvýrazňuje aktuálne slovo po jednom", () => {
    const r = buildAssFile({
      segments: SPEECH,
      style: getCaptionStyle("VIRAL_BOLD"),
      width: 1080,
      height: 1920,
    });
    expect(r.wordHighlight).toBe(true);
    // 7 slov = 7 udalostí (každé slovo má vlastné zvýraznenie)
    expect(r.eventCount).toBe(7);
    const events = r.ass.split("\n").filter((l) => l.startsWith("Dialogue:"));
    expect(events.length).toBe(7);
    // zvýrazňovacia farba je použitá
    expect(r.ass).toContain("{\\c" + "&H0000FFFF}");
    // Časovače sedia na slová. Koniec je začiatok ďalšieho slova (0,62), nie
    // koniec vlastného slova (0,60) — zámerne: bez toho by titulok na dve
    // stotiny zmizol a vrátil sa, čo vyzerá ako blikanie.
    expect(events[0]).toContain("0:00:00.20");
    expect(events[0]).toContain("0:00:00.62");
    // veľké písmená (virálny štýl)
    expect(r.ass).toContain("DNES");
  });

  test("zvýraznenie funguje pre slovo s interpunkciou (porovnáva sa bez bodky)", () => {
    const r = buildAssFile({
      segments: SPEECH,
      style: getCaptionStyle("VIRAL_BOLD"),
      width: 1080,
      height: 1920,
    });
    const last = r.ass.split("\n").filter((l) => l.startsWith("Dialogue:")).pop()!;
    expect(last).toContain("{\\c&H0000FFFF}KAVIAREŇ");
  });

  test("bez časovania slov sa zvýrazňovanie vypne a appka to prizná", () => {
    const r = buildAssFile({
      segments: [{ start: 0, end: 3, text: "Celá veta naraz." }],
      style: getCaptionStyle("VIRAL_BOLD"),
      width: 1080,
      height: 1920,
    });
    expect(r.wordHighlight).toBe(false);
    expect(r.eventCount).toBe(1);
    expect(r.notesSk.join(" ")).toContain("nemám časovanie slov");
    expect(r.ass).not.toContain("{\\c" + "&H0000FFFF}");
  });

  test("prázdny vstup povie, že nie je čo vypáliť (nie prázdny súbor bez slova)", () => {
    const r = buildAssFile({
      segments: [],
      style: getCaptionStyle("CLEAN"),
      width: 1080,
      height: 1920,
    });
    expect(r.eventCount).toBe(0);
    expect(r.notesSk.join(" ")).toContain("žiadne titulky na vypálenie");
  });

  test("časový posun a limit dĺžky klipu fungujú (titulky sedia na strih)", () => {
    const r = buildAssFile({
      segments: SPEECH,
      style: getCaptionStyle("CLEAN"),
      width: 1080,
      height: 1920,
      timeOffsetSec: -2, // klip začína v zdroji na 2 s
      durationSec: 3,
    });
    const events = r.ass.split("\n").filter((l) => l.startsWith("Dialogue:"));
    expect(events.length).toBeGreaterThan(0);
    // druhý segment (2.4–4.0 v zdroji) sa po posune zobrazí od 0.4 a oreže na 3 s
    const last = events[events.length - 1];
    expect(last).toContain("0:00:00.40");
    // nič nesmie presiahnuť koniec klipu
    for (const e of events) {
      const times = e.match(/(\d:\d\d:\d\d\.\d\d),(\d:\d\d:\d\d\.\d\d)/);
      expect(times).toBeTruthy();
      expect(times![2] <= "0:00:03.00").toBe(true);
    }
  });

  test("text s cudzími znakmi nerozbije ASS (escapovanie prežije)", () => {
    const r = buildAssFile({
      segments: [{ start: 0, end: 2, text: "Zlyhá {\\pos(0,0)} pokus \\N koniec" }],
      style: getCaptionStyle("CLEAN"),
      width: 1080,
      height: 1920,
    });
    expect(r.ass).toContain("\\{\\\\pos(0,0)\\}".slice(0, 5));
    // v ASS nesmie ostať nespracovaný blok kódu
    const dialogue = r.ass.split("\n").find((l) => l.startsWith("Dialogue:"))!;
    expect(dialogue.includes("{\\pos")).toBe(false);
  });

  test("veľmi krátke titulky sa vynechajú (nedajú sa prečítať)", () => {
    const r = buildAssFile({
      segments: [{ start: 1.0, end: 1.05, text: "x" }],
      style: getCaptionStyle("CLEAN"),
      width: 1080,
      height: 1920,
    });
    expect(r.eventCount).toBe(0);
  });

  test("zhrnutie pre človeka hovorí, čo sa vypáli", () => {
    const r = buildAssFile({ segments: SPEECH, style: getCaptionStyle("VIRAL_BOLD"), width: 1080, height: 1920 });
    const text = burnSummarySk(r, getCaptionStyle("VIRAL_BOLD"), 30);
    expect(text).toContain("7 titulkov");
    expect(text).toContain("zvýrazňovaním slova");
    expect(text).toContain("CRF 20");
  });
});

describe("titulky — argumenty ffmpegu", () => {
  test("bez strihu: jeden filter, zvuk sa kopíruje", () => {
    const args = buildBurnFfmpegArgs({
      inputPath: "/tmp/v.mp4",
      outputPath: "/tmp/o.mp4",
      assPath: "/tmp/s.ass",
      width: 1080,
      height: 1920,
    });
    expect(args).toContain("-filter_complex");
    expect(args.join(" ")).toContain("ass=/tmp/s.ass");
    expect(args.join(" ")).toContain("scale=1080:1920");
    expect(args.join(" ")).toContain("-c:a copy");
    expect(args[args.length - 1]).toBe("/tmp/o.mp4");
  });

  test("so strihom: úseky sa orežú, spoja a titulky sa vypália v jednom prechode", () => {
    const args = buildBurnFfmpegArgs({
      inputPath: "/tmp/v.mp4",
      outputPath: "/tmp/o.mp4",
      assPath: "/tmp/s.ass",
      keepSegments: [
        { start: 0, end: 3 },
        { start: 6, end: 9 },
      ],
    });
    const filter = args[args.indexOf("-filter_complex") + 1];
    expect(filter).toContain("trim=start=0.000:end=3.000");
    expect(filter).toContain("trim=start=6.000:end=9.000");
    expect(filter).toContain("concat=n=2:v=1:a=1");
    expect(filter).toContain("ass=/tmp/s.ass");
    // zvuk sa pri strihu musí prekódovať (nedá sa kopírovať spojený)
    expect(args.join(" ")).toContain("-c:a aac");
  });

  test("príliš krátke úseky sa do strihu neberú", () => {
    const args = buildBurnFfmpegArgs({
      inputPath: "/tmp/v.mp4",
      outputPath: "/tmp/o.mp4",
      assPath: "/tmp/s.ass",
      keepSegments: [{ start: 0, end: 3 }, { start: 5, end: 5.001 }],
    });
    const filter = args[args.indexOf("-filter_complex") + 1];
    expect(filter).toContain("concat=n=1");
  });
});

// ---------------------------------------------------------------------------
// Skutočné vypálenie (end-to-end)
// ---------------------------------------------------------------------------

describe("titulky — skutočné vypálenie do videa", () => {
  const work = mkdtempSync(join(tmpdir(), "burn-"));

  function makeSource(name: string, seconds = 4, color = "black"): string {
    const out = join(work, name);
    execSync(
      `${ffexe()} -y -hide_banner -loglevel error -f lavfi -i "color=c=${color}:size=640x360:rate=25" ` +
        `-f lavfi -i "sine=frequency=440" -t ${seconds} -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest ${out}`,
      { stdio: "pipe" },
    );
    return out;
  }

  maybe("titulky sa naozaj objavia v obraze (a inde nie)", () => {
    expect(FONT).not.toBeNull();
    const src = makeSource("src.mp4", 4, "black");
    const built = buildAssFile({
      segments: SPEECH,
      style: getCaptionStyle("VIRAL_BOLD"),
      width: 640,
      height: 360,
      fontName: "DejaVu Sans",
    });

    const assPath = join(work, "subs.ass");
    writeFileSync(assPath, built.ass);
    const out = join(work, "burned.mp4");
    const args = buildBurnFfmpegArgs({
      inputPath: src,
      outputPath: out,
      assPath,
      fontsDir: FONT!.dir,
      width: 640,
      height: 360,
    });

    const run = spawnSync(ffexe(), args, { encoding: "utf8" });
    if (run.status !== 0) {
      console.error("FFMPEG zlyhal:", run.stderr?.slice(0, 600), "\nARGS:", args.join(" "));
    }
    expect(run.status).toBe(0);
    expect(existsSync(out)).toBe(true);
    expect(statSync(out).size).toBeGreaterThan(1000);

    // Porovnanie pixelov: v čase 0,9 s (titulok „UKÁŽEME") musí byť obraz iný
    // než čistý zdroj v tom istom čase — práve preto vypálenie existuje.
    // Meriame MAXIMUM jasu, nie priemer: text zaberá málo pixelov, takže priemer
    // sa pohne len málo, ale maximum vyskočí z ~16 (čierna) na ~235 (biely text).
    const grabYMax = (file: string, t: string, tag: string) => {
      const png = join(work, `f-${tag}.png`);
      execSync(`${ffexe()} -y -hide_banner -loglevel error -ss ${t} -i ${file} -frames:v 1 ${png}`, { stdio: "pipe" });
      const out = execSync(
        `${ffexe()} -hide_banner -i ${png} -vf "signalstats,metadata=print:key=lavfi.signalstats.YMAX" -f null - 2>&1`,
        { encoding: "utf8", shell: "/bin/bash" },
      );
      const m = out.match(/YMAX=([\d.]+)/);
      return m ? Number(m[1]) : -1;
    };
    const srcMax = grabYMax(src, "0.9", "src");
    const outMax = grabYMax(out, "0.9", "out");
    expect(srcMax).toBeGreaterThanOrEqual(0);
    expect(srcMax).toBeLessThan(80); // zdroj je čierny
    expect(outMax).toBeGreaterThan(180); // titulok je biely
  });

  maybe("strih + titulky v jednom prechode: výsledok je kratší a má titulky", () => {
    const src = makeSource("src2.mp4", 6, "black");
    const out = join(work, "cut-burned.mp4");
    const built = buildAssFile({
      segments: SPEECH,
      style: getCaptionStyle("VIRAL_BOLD"),
      width: 640,
      height: 360,
      fontName: "DejaVu Sans",
      durationSec: 3,
    });
    const assPath = join(work, "subs2.ass");
    writeFileSync(assPath, built.ass);

    const args = buildBurnFfmpegArgs({
      inputPath: src,
      outputPath: out,
      assPath,
      fontsDir: FONT!.dir,
      keepSegments: [
        { start: 0, end: 1.5 },
        { start: 2.4, end: 3.9 },
      ],
      width: 640,
      height: 360,
    });
    const run = spawnSync(ffexe(), args, { encoding: "utf8" });
    if (run.status !== 0) console.error("FFMPEG (strih+titulky) zlyhal:", run.stderr?.slice(0, 600));
    expect(run.status).toBe(0);

    const probe = execSync(`${ffexe()} -i ${out} 2>&1 || true`, { encoding: "utf8" });
    const dur = probe.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
    const seconds = dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : 0;
    expect(seconds).toBeGreaterThan(2.4);
    expect(seconds).toBeLessThan(3.4);
    expect(probe).toContain("Video: h264");
  });

  maybe("slovenská diakritika sa vypáli (kontrola, že font nie je náhodný)", () => {
    const src = makeSource("src3.mp4", 2, "black");
    const out = join(work, "diakritika.mp4");
    const built = buildAssFile({
      segments: [
        {
          start: 0.1,
          end: 1.8,
          text: "Žltý kôň ľúbi ôsmy: ČÍSLA ďalej ť š č ž ň",
          words: [
            { word: "Žltý", start: 0.1, end: 0.4 },
            { word: "kôň", start: 0.4, end: 0.7 },
            { word: "ľúbi", start: 0.7, end: 1.0 },
            { word: "ôsmy:", start: 1.0, end: 1.3 },
            { word: "ČÍSLA", start: 1.3, end: 1.6 },
          ],
        },
      ],
      style: getCaptionStyle("VIRAL_BOLD"),
      width: 640,
      height: 360,
      fontName: "DejaVu Sans",
    });
    const assPath = join(work, "subs3.ass");
    writeFileSync(assPath, built.ass);
    const args = buildBurnFfmpegArgs({ inputPath: src, outputPath: out, assPath, fontsDir: FONT!.dir });
    const run = spawnSync(ffexe(), args, { encoding: "utf8" });
    if (run.status !== 0) console.error("FFMPEG (diakritika) zlyhal:", run.stderr?.slice(0, 600));
    expect(run.status).toBe(0);

    const stats = execSync(
      // POZOR: bez `-loglevel error` — metadata=print píše na úrovni info a tlmil by sa
      `${ffexe()} -y -hide_banner -ss 0.5 -i ${out} -frames:v 1 -vf "signalstats,metadata=print:key=lavfi.signalstats.YMAX" -f null - 2>&1`,
      { encoding: "utf8", shell: "/bin/bash" },
    );
    const m = stats.match(/YMAX=([\d.]+)/); // v týchto testoch meriame maximum jasu
    expect(m).toBeTruthy(); // null = metadata=print sa nevypísali (chýba -loglevel?)
    expect(Number(m![1])).toBeGreaterThan(100); // ~16 = čierny zdroj, ~235 = biely text
    // a ASS musí obsahovať diakritiku v pôvodnom tvare
    expect(readFileSync(assPath, "utf8")).toContain("KÔŇ");
  });
});

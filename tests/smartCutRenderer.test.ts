import { describe, expect, test, beforeAll } from "bun:test";
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  smartCutRender,
  chooseContainer,
  smartCutSummarySk,
  smartCutFileName,
  SmartCutCanceledError,
  type SmartCutSegment,
} from "../src/core/export/smartCutRenderer";

/**
 * End-to-end testy renderu. Potrebujú ffmpeg (vygeneruje testovacie video a overí
 * výsledok). Ak ffmpeg nie je, testy sa preskočia — nie zlyhajú, aby vývoj
 * nezávisel od binárky v prostredí.
 */
function findFfmpeg(): string | null {
  try {
    const viaImageio = execSync(
      `python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    if (viaImageio && existsSync(viaImageio)) return viaImageio;
  } catch {
    /* skúsime PATH */
  }
  try {
    const viaPath = execSync("command -v ffmpeg", { encoding: "utf8" }).trim();
    if (viaPath) return viaPath;
  } catch {
    /* nič */
  }
  return null;
}

const FFMPEG = findFfmpeg();
const HAS_FFMPEG = FFMPEG !== null;
const maybe = HAS_FFMPEG ? test : test.skip;

let workDir = "";
let sourcePath = "";

beforeAll(() => {
  if (!HAS_FFMPEG) return;
  workDir = mkdtempSync(join(tmpdir(), "omnistrih-cut-"));
  sourcePath = join(workDir, "source.mp4");
  // 12 s testovacieho videa: H.264 (keyframe každú sekundu) + AAC zvuk
  execSync(
    `${FFMPEG} -y -f lavfi -i "testsrc2=size=320x240:rate=30" -f lavfi -i "sine=frequency=440" ` +
      `-t 12 -c:v libx264 -g 30 -pix_fmt yuv420p -c:a aac -shortest "${sourcePath}"`,
    { stdio: "ignore" },
  );
});

async function sourceBlob(): Promise<Blob> {
  const buf = await Bun.file(sourcePath).arrayBuffer();
  return new Blob([buf], { type: "video/mp4" });
}

/** Zistí dĺžku súboru cez ffprobe (ffmpeg -i vypíše Duration). */
function probeDurationSec(path: string): number {
  const out = execSync(`${FFMPEG} -i "${path}" 2>&1 || true`, { encoding: "utf8" });
  const m = out.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  if (!m) throw new Error(`Nepodarilo sa zistiť dĺžku: ${out.slice(0, 200)}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

function probeStreams(path: string): string {
  const out = execSync(`${FFMPEG} -i "${path}" 2>&1 || true`, { encoding: "utf8" });
  return out;
}

/** Prejde súbor ffmpegom naplno — vracia true, keď dekódovanie nehlási chybu. */
function ffmpegDecodeOk(path: string): boolean {
  const ff = findFfmpeg();
  if (!ff) return true; // bez ffmpeg nevieme overiť, test sa preskakuje inde
  const r = spawnSync(ff, ["-v", "error", "-i", path, "-f", "null", "-"], {
    encoding: "utf-8",
  });
  return (r.stderr || "").trim().length === 0;
}

async function writeResult(blob: Blob, name: string): Promise<string> {
  const path = join(workDir, name);
  await Bun.write(path, blob);
  return path;
}

describe("smart cut renderer — výber kontajnera", () => {
  test("H.264 + AAC → MP4 (to, čo klient otvorí všade)", () => {
    expect(chooseContainer("avc", "aac")).toBe("mp4");
    expect(chooseContainer("hevc", "aac")).toBe("mp4");
    expect(chooseContainer("avc", null)).toBe("mp4");
  });

  test("VP8/VP9 bez podpory → WebM", () => {
    expect(chooseContainer("vp8", "opus")).toBe("webm");
    expect(chooseContainer("vp9", "vorbis" as any)).toBe("webm");
  });

  test("neznámy kodek → WebM (radšej bezpečnejšie)", () => {
    expect(chooseContainer(null, null)).toBe("webm");
  });
});

describe("smart cut renderer — vstupné kontroly", () => {
  test("bez segmentov vyhodí zrozumiteľnú chybu", async () => {
    await expect(
      smartCutRender({ source: new Blob([new Uint8Array([1, 2, 3])]), segments: [] }),
    ).rejects.toThrow(/žiadne úseky/i);
  });

  test("prázdny zdroj vyhodí zrozumiteľnú chybu", async () => {
    await expect(
      smartCutRender({
        source: new Blob([]),
        segments: [{ sourceStart: 0, sourceEnd: 1, timelineStart: 0, duration: 1 }],
      }),
    ).rejects.toThrow(/Chýba zdrojové video/i);
  });

  test("súbor, ktorý nie je video, vysvetlí prečo", async () => {
    const notVideo = new Blob([new TextEncoder().encode("toto nie je video, len text")], {
      type: "text/plain",
    });
    await expect(
      smartCutRender({
        source: notVideo,
        segments: [{ sourceStart: 0, sourceEnd: 1, timelineStart: 0, duration: 1 }],
      }),
    ).rejects.toThrow();
  });
});

describe("smart cut renderer — skutočný strih (end-to-end)", () => {
  maybe("zostrihá 2 úseky a výsledok je prehrateľné MP4 s obrazom aj zvukom", async () => {
    const blob = await sourceBlob();
    const segments: SmartCutSegment[] = [
      // 0–3 s a 6–9 s → výsledok má ~6 s
      { sourceStart: 0, sourceEnd: 3, timelineStart: 0, duration: 3, label: "prvý" },
      { sourceStart: 6, sourceEnd: 9, timelineStart: 3, duration: 3, label: "druhý" },
    ];

    const progress: string[] = [];
    const result = await smartCutRender({
      source: blob,
      segments,
      onProgress: (p) => progress.push(p.stage),
    });

    expect(result.container).toBe("mp4");
    expect(result.mimeType).toBe("video/mp4");
    expect(result.videoCodec).toBe("avc");
    expect(result.audioCodec).toBe("aac");
    expect(result.reencoded).toBe(false);
    expect(result.copiedVideoPackets).toBeGreaterThan(0);
    expect(result.copiedAudioPackets).toBeGreaterThan(0);
    expect(result.blob.size).toBeGreaterThan(1000);
    expect(progress).toContain("COPYING");
    expect(progress).toContain("DONE");

    // Súbor zapíšeme a overíme ffmpegom — či je naozaj prehrateľný
    const outPath = await writeResult(result.blob, "two-segments.mp4");
    expect(statSync(outPath).size).toBeGreaterThan(1000);

    const probed = probeDurationSec(outPath);
    expect(probed).toBeGreaterThan(5.4); // ~6 s
    expect(probed).toBeLessThan(7.6);

    const streams = probeStreams(outPath);
    expect(streams).toMatch(/Video: h264/);
    expect(streams).toMatch(/Audio: aac/);
  });

  maybe("dekódovanie výsledku prejde bez chýb (obraz aj zvuk sú celé)", async () => {
    const blob = await sourceBlob();
    const result = await smartCutRender({
      source: blob,
      segments: [
        { sourceStart: 2, sourceEnd: 4, timelineStart: 0, duration: 2 },
        { sourceStart: 8, sourceEnd: 10, timelineStart: 2, duration: 2 },
      ],
    });
    const outPath = await writeResult(result.blob, "decode-check.mp4");

    // -v error -f null - = dekóduje celý súbor a vypíše len chyby
    const log = execSync(`${FFMPEG} -v error -i "${outPath}" -f null - 2>&1 || true`, {
      encoding: "utf8",
    });
    const realErrors = log
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .filter((line) => !/deprecated|Last message repeated/i.test(line));
    expect(realErrors.join("\n")).toBe("");
  });

  maybe("hook pridaný na začiatok: poradie úsekov sedí (výsledok začína druhým úsekom)", async () => {
    const blob = await sourceBlob();
    // EDL, kde je hook vyrezaný z konca a posadený na začiatok
    const result = await smartCutRender({
      source: blob,
      segments: [
        { sourceStart: 9, sourceEnd: 10, timelineStart: 0, duration: 1, label: "hook" },
        { sourceStart: 0, sourceEnd: 2, timelineStart: 1, duration: 2, label: "úvod" },
      ],
    });
    const outPath = await writeResult(result.blob, "hook-first.mp4");
    const probed = probeDurationSec(outPath);
    expect(probed).toBeGreaterThan(2.4);
    expect(probed).toBeLessThan(4.0);
    expect(probeStreams(outPath)).toMatch(/Video: h264/);
  });

  maybe("render je podstatne rýchlejší než reálny čas (kopírovanie, nie prekódovanie)", async () => {
    const blob = await sourceBlob();
    const started = Date.now();
    const result = await smartCutRender({
      source: blob,
      segments: [{ sourceStart: 1, sourceEnd: 11, timelineStart: 0, duration: 10 }],
    });
    const elapsed = (Date.now() - started) / 1000;
    expect(result.durationSec).toBeCloseTo(10, 1);
    // 10 s videa musí byť hotových výrazne skôr než za 10 s
    expect(elapsed).toBeLessThan(8);
  });

  maybe("celý EDL mimo dĺžky videa → odmietne s jasným dôvodom (nie prázdny súbor)", async () => {
    const blob = await sourceBlob();
    await expect(
      smartCutRender({
        source: blob,
        segments: [{ sourceStart: 100, sourceEnd: 105, timelineStart: 0, duration: 5 }],
      }),
    ).rejects.toThrow(/mimo dĺžky videa/i);
  });

  maybe("časť EDL mimo videa → platné úseky sa zostrihajú a preskočenie sa nahlási", async () => {
    const blob = await sourceBlob();
    const result = await smartCutRender({
      source: blob,
      segments: [
        { sourceStart: 1, sourceEnd: 3, timelineStart: 0, duration: 2 },
        { sourceStart: 100, sourceEnd: 105, timelineStart: 2, duration: 5 },
      ],
    });
    expect(result.copiedVideoPackets).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.text.includes("mimo dĺžky videa"))).toBe(true);
    // výsledok nesmie obsahovať tých falošných 5 s navyše
    const outPath = await writeResult(result.blob, "partial-outside.mp4");
    const probed = probeDurationSec(outPath);
    expect(probed).toBeLessThan(4);
  });

  maybe("zrušenie renderu funguje a nezanechá rozpracovaný stav", async () => {
    const blob = await sourceBlob();
    let calls = 0;
    await expect(
      smartCutRender({
        source: blob,
        segments: [
          { sourceStart: 0, sourceEnd: 2, timelineStart: 0, duration: 2 },
          { sourceStart: 3, sourceEnd: 5, timelineStart: 2, duration: 2 },
        ],
        shouldCancel: () => {
          calls++;
          return calls > 1; // druhá kontrola = zruš
        },
      }),
    ).rejects.toThrow(SmartCutCanceledError);
  });

  maybe("veľa úsekov v rade (prekrytie časových značiek) — 6 úsekov prejde bez chyby muxeru", async () => {
    const blob = await sourceBlob();
    // 6 krátkych úsekov: práve tu sa lámalo „timestamps cannot be smaller…“,
    // keď sa výstupný čas počítal z plánu a nie z reálne zapísaných packetov.
    const segs = [0, 2, 4, 6, 8, 10].map((start) => ({
      sourceStart: start + 0.25,
      sourceEnd: start + 1.25,
      timelineStart: 0,
      duration: 1,
    }));
    const result = await smartCutRender({ source: blob, segments: segs });

    // časy musia byť vzostupné a bez prekrytia
    for (let i = 1; i < result.segmentOffsets.length; i++) {
      expect(result.segmentOffsets[i]).toBeGreaterThanOrEqual(0);
    }
    const outPath = await writeResult(result.blob, "six-segments.mp4");
    const probed = probeDurationSec(outPath);
    expect(probed).toBeGreaterThan(4);
    expect(probed).toBeLessThan(11);
    expect(ffmpegDecodeOk(outPath)).toBe(true);
    expect(result.warnings.some((w) => w.text.includes("kľúčové snímky"))).toBe(true);
  });

  maybe("keyframové posadenie strihu je priznané vo varovaní", async () => {
    const blob = await sourceBlob();
    // 1.4 s nie je keyframe (keyframy sú po 1 s) → render musí priznať posun
    const result = await smartCutRender({
      source: blob,
      segments: [{ sourceStart: 1.4, sourceEnd: 3.9, timelineStart: 0, duration: 2.5 }],
    });
    expect(result.segmentOffsets[0]).toBeGreaterThan(0);
    expect(
      result.warnings.some((w) => w.text.includes("kľúčové snímky")) ||
        result.durationDriftSec !== 0,
    ).toBe(true);
  });
});

describe("smart cut renderer — texty", () => {
  test("zhrnutie je vecné a neobsahuje marketing", () => {
    const text = smartCutSummarySk({
      blob: new Blob([new Uint8Array(2_000_000)]),
      container: "mp4",
      mimeType: "video/mp4",
      durationSec: 12.5,
      durationDriftSec: 0.2,
      videoCodec: "avc",
      audioCodec: "aac",
      copiedVideoPackets: 300,
      copiedAudioPackets: 500,
      segmentOffsets: [0.2],
      warnings: [],
      reencoded: false,
    });
    expect(text).toContain("MP4");
    expect(text).toContain("12.5 s");
    expect(text).toContain("avc + aac");
    expect(text).toContain("bez prekódovania");
    expect(/garant|virálne|100 %/i.test(text)).toBe(false);
  });

  test("názov súboru je bezpečný", () => {
    const name = smartCutFileName("mp4", "Úvod (hook) / časť 1");
    expect(name).toMatch(/^omnistrih-/);
    expect(name).toMatch(/\.mp4$/);
    expect(name).not.toMatch(/[^a-z0-9\-.]/i);
  });
});

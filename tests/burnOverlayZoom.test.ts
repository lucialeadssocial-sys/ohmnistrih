import { describe, expect, test } from "bun:test";
import { buildBurnFfmpegArgs, zoomFilterForPercent } from "../src/core/export/subtitleRender";

/**
 * Testy ffmpeg linky pre krok 8: **priblíženie** a **obrazové vrstvy**.
 * Sú to čisté funkcie, takže sa dá presne overiť, čo ffmpeg dostane —
 * a či sa pri tom nezmenil starý (fungujúci) spôsob bez zoomu a vrstiev.
 */

function filterOf(args: string[]): string {
  const i = args.indexOf("-filter_complex");
  return i >= 0 ? args[i + 1] : "";
}

describe("priblíženie v ffmpeg linke", () => {
  test("zoom sa prevedie na statický stredový orez — s presnými rozmermi rámu", () => {
    const f = zoomFilterForPercent(112, 1080, 1920);
    expect(f).toContain("scale=iw*1.1200:ih*1.1200");
    expect(f).toContain("crop=1080:1920");
    // Nikdy nesmie vzniknúť o dva pixely menší rám (to sa naozaj stalo a meranie to odhalilo).
    expect(f).not.toContain("trunc(");
  });

  test("bez známych rozmerov sa použije výraz (a appka to vie priznať)", () => {
    const f = zoomFilterForPercent(112);
    expect(f).toContain("trunc(iw/1.1200/2)*2");
  });

  test("celá linka drží rozmery rámu, keď dostane rozmery zo sondy", () => {
    const args = buildBurnFfmpegArgs({
      inputPath: "in.mp4",
      outputPath: "out.mp4",
      assPath: "/x/a.ass",
      outputDurationSec: 20,
      frameSize: { width: 1080, height: 1920 },
      zoomWindows: [{ startSec: 5, endSec: 9, scalePercent: 112 }],
    });
    const f = filterOf(args);
    expect(f).toContain("crop=1080:1920");
    // rám sa nesmie preškálovať na iný formát — žiadne scale=1080:1920
    expect(f).not.toContain("scale=1080:1920");
  });

  test("sto percent = žiadny filter (nič sa nepridáva zbytočne)", () => {
    expect(zoomFilterForPercent(100)).toBe("");
    expect(zoomFilterForPercent(undefined)).toBe("");
  });

  test("bez zoomu a bez vrstiev je filter presne ako predtým (stará cesta sa nemení)", () => {
    const args = buildBurnFfmpegArgs({ inputPath: "in.mp4", outputPath: "out.mp4", assPath: "/x/a.ass" });
    expect(filterOf(args)).toBe("[0:v]ass=/x/a.ass[vout]");
    expect(args.filter((a) => a === "-c:a")).toHaveLength(1);
    expect(args[args.indexOf("-c:a") + 1]).toBe("copy");
  });

  test("okno priblíženia rozdelí video a mimo okna nechá obraz bez zoomu", () => {
    const args = buildBurnFfmpegArgs({
      inputPath: "in.mp4",
      outputPath: "out.mp4",
      assPath: "/x/a.ass",
      outputDurationSec: 20,
      zoomWindows: [{ clipId: "c1", startSec: 5, endSec: 9, scalePercent: 112 }],
    });
    const f = filterOf(args);
    expect(f).toContain("trim=start=0.000:end=5.000");
    expect(f).toContain("trim=start=5.000:end=9.000");
    expect(f).toContain("scale=iw*1.1200");
    expect(f).toContain("trim=start=9.000:end=20.000");
    expect(f).toContain("concat=n=3:v=1:a=0[vc]");
    // bez strihu sa zvuk neprekóduje — pôvodné audio zostáva nedotknuté
    expect(args[args.indexOf("-c:a") + 1]).toBe("copy");
  });

  test("pri strihoch nesie zoom samotný úsek a zvuk ide cez concat", () => {
    const args = buildBurnFfmpegArgs({
      inputPath: "in.mp4",
      outputPath: "out.mp4",
      assPath: "/x/a.ass",
      sourceFps: 30,
      keepSegments: [
        { start: 1, end: 2.5, scalePercent: 112 },
        { start: 4, end: 6, scalePercent: 100 },
      ],
    });
    const f = filterOf(args);
    expect(f).toContain("trim=start=1.000:end=2.500");
    expect(f).toContain("scale=iw*1.1200");
    expect(f).toContain("[v0][a0][v1][a1]concat=n=2:v=1:a=1[vc][ac]");
    expect(args[args.indexOf("-c:a") + 1]).toBe("aac");
  });
});

describe("obrazové vrstvy (b-roll / fotky) v ffmpeg linke", () => {
  test("vrstva sa pridá ako vstup a kreslí sa len vo svojom čase", () => {
    const args = buildBurnFfmpegArgs({
      inputPath: "in.mp4",
      outputPath: "out.mp4",
      assPath: "/x/a.ass",
      overlays: [{ path: "/tmp/shot.png", kind: "image", startSec: 5, endSec: 9, scalePercent: 100, positionX: 0, positionY: 0 }],
    });
    // vstup pre obrázok
    expect(args[args.indexOf("-i") + 1]).toBe("in.mp4");
    expect(args.slice(args.indexOf("in.mp4")).includes("/tmp/shot.png")).toBe(true);
    const f = filterOf(args);
    expect(f).toContain("[1:v]");
    expect(f).toContain("enable='between(t,5.000,9.000)'");
    expect(f).toContain("overlay=x=(W-w)/2:y=(H-h)/2");
    expect(f).toContain("eof_action=repeat");
    // titulky idú až po vrstvách (aby boli navrchu nad obrazom)
    expect(f.indexOf("overlay=")).toBeLessThan(f.indexOf("ass="));
  });

  test("veľkosť vrstvy a posun od stredu sedia na canonical plán", () => {
    const args = buildBurnFfmpegArgs({
      inputPath: "in.mp4",
      outputPath: "out.mp4",
      assPath: "/x/a.ass",
      overlays: [{ path: "/tmp/shot.png", kind: "image", startSec: 1, endSec: 2, scalePercent: 50, positionX: 40, positionY: -30 }],
    });
    const f = filterOf(args);
    expect(f).toContain("scale=iw*0.5000:ih*0.5000");
    expect(f).toContain("overlay=x=(W-w)/2+40.0:y=(H-h)/2+-30.0");
  });

  test("video vrstva sa časovo posunie na svoj začiatok", () => {
    const args = buildBurnFfmpegArgs({
      inputPath: "in.mp4",
      outputPath: "out.mp4",
      assPath: "/x/a.ass",
      overlays: [{ path: "/tmp/clip.mp4", kind: "video", startSec: 3, endSec: 5, scalePercent: 100, positionX: 0, positionY: 0 }],
    });
    const f = filterOf(args);
    expect(f).toContain("trim=duration=2.000");
    expect(f).toContain("setpts=PTS-STARTPTS+3.000/TB");
  });

  test("dve vrstvy idú za sebou (nesplývajú do jednej)", () => {
    const args = buildBurnFfmpegArgs({
      inputPath: "in.mp4",
      outputPath: "out.mp4",
      assPath: "/x/a.ass",
      overlays: [
        { path: "/tmp/a.png", kind: "image", startSec: 1, endSec: 2, scalePercent: 100, positionX: 0, positionY: 0 },
        { path: "/tmp/b.png", kind: "image", startSec: 3, endSec: 4, scalePercent: 100, positionX: 0, positionY: 0 },
      ],
    });
    const f = filterOf(args);
    expect(f).toContain("[1:v]");
    expect(f).toContain("[2:v]");
    expect(f).toContain("[vov0][ov1]overlay=");
    expect(f).toContain("[vov1]ass=");
  });
});

import { describe, expect, test } from "bun:test";
import {
  animatedZoomFilter,
  buildBurnFfmpegArgs,
  zoomExpressionFromKeyframes,
  zoomFilterForWindow,
  zoomFilterForPercent,
} from "../src/core/export/subtitleRender";
import { animatedZoomFromClip, buildCanonicalExportPlan } from "../src/core/export/canonicalExport";
import { BURN_LIMITS, validateBurnRequest } from "../src/core/export/burnJob";
import { createInitialProject } from "../src/core";
import { ClipModel, Keyframe, ProjectModel } from "../src/core/types/project";

/**
 * Testy animovaného priblíženia (keyframy).
 *
 * Podstatné: animované priblíženie sa vykresľuje **`zoompan`** filtrom, ktorý mení
 * mierku priebežne. Statický orez (`crop`) na to nestačí. Zároveň platí staré
 * pravidlo z kroku 8: **rám videa sa nesmie zmeniť**.
 */

function filterOf(args: string[]): string {
  const i = args.indexOf("-filter_complex");
  return i >= 0 ? args[i + 1] : "";
}

function kf(timeOffset: number, value: number, parameter: Keyframe["parameter"] = "scale"): Keyframe {
  return { id: `kf_${parameter}_${timeOffset}`, timeOffset, parameter, value, easing: "easeInOut" };
}

function clip(over: Partial<ClipModel> & Pick<ClipModel, "id" | "trackId" | "type" | "start" | "duration">): ClipModel {
  return {
    name: over.name ?? over.id,
    sourceStart: over.sourceStart ?? over.start,
    sourceEnd: over.sourceEnd ?? over.start + over.duration,
    timelineStart: over.timelineStart ?? over.start,
    offset: 0,
    speed: 1,
    volume: 1,
    scale: 100,
    opacity: 100,
    positionX: 0,
    positionY: 0,
    rotation: 0,
    keyframes: [],
    ...over,
  } as ClipModel;
}

function projectWith(clips: ClipModel[]): ProjectModel {
  const base = createInitialProject();
  const project: ProjectModel = JSON.parse(JSON.stringify(base));
  project.tracks = [
    { id: "track_video", type: "video", name: "Video", order: 0, muted: false, locked: false, visible: true, clips },
  ];
  return project;
}

// ---------------------------------------------------------------------------
// A) Výraz priebehu
// ---------------------------------------------------------------------------

describe("A) priebeh animovaného priblíženia (výraz pre zoompan)", () => {
  test("rampa 100 % → 150 % je po častiach lineárna a bez min/max obalu", () => {
    const expr = zoomExpressionFromKeyframes([
      { timeSec: 0, scalePercent: 100 },
      { timeSec: 2, scalePercent: 150 },
    ]);
    expect(expr).toContain("if(lt(in_time,2.000)");
    expect(expr).toContain("1.0000+(1.5000-1.0000)*(in_time-0.000)/2.000");
    // Obal s min()/max() okolo vnorených if() sa počas vývoja správal nepredvídateľne
    // (raz zoomoval, raz nie) — preto sa nepoužíva a test to stráži.
    expect(expr).not.toContain("min(");
    expect(expr).not.toContain("max(");
  });

  test("viac krokov: prvý úsek drží prvú hodnotu, posledná platí do konca", () => {
    const expr = zoomExpressionFromKeyframes([
      { timeSec: 1, scalePercent: 120 },
      { timeSec: 3, scalePercent: 120 },
      { timeSec: 5, scalePercent: 180 },
    ]);
    expect(expr.startsWith("if(lt(in_time,1.000),1.2000,")).toBe(true);
    // posledný úsek 120 % → 180 % a za ním držanie poslednej hodnoty
    expect(expr).toContain("if(lt(in_time,5.000),1.2000+(1.8000-1.2000)*(in_time-3.000)/2.000,1.8000)");
  });

  test("bez držania pred prvým krokom, keď prvý krok začína na 100 %", () => {
    const expr = zoomExpressionFromKeyframes([
      { timeSec: 0, scalePercent: 100 },
      { timeSec: 1, scalePercent: 130 },
    ]);
    expect(expr.startsWith("if(lt(in_time,1.000)")).toBe(true);
  });

  test("nesprávne poradie krokrov sa zrovná (nie je to na dôvere vstupu)", () => {
    const expr = zoomExpressionFromKeyframes([
      { timeSec: 4, scalePercent: 170 },
      { timeSec: 0, scalePercent: 100 },
      { timeSec: 2, scalePercent: 140 },
    ]);
    expect(expr).toContain("if(lt(in_time,2.000)");
    expect(expr).toContain("if(lt(in_time,4.000)");
    // 100 % musí byť na začiatku (pred krokom v 2,0 s), nie 170 %
    expect(expr).toContain("1.0000+(1.4000-1.0000)*(in_time-0.000)/2.000");
  });

  test("jeden krok = konštanta, prázdny vstup = žiadna zmena", () => {
    expect(zoomExpressionFromKeyframes([{ timeSec: 1, scalePercent: 125 }])).toBe("1.2500");
    expect(zoomExpressionFromKeyframes([])).toBe("1");
  });
});

// ---------------------------------------------------------------------------
// B) Filter
// ---------------------------------------------------------------------------

describe("B) filter animovaného priblíženia", () => {
  const kfs = [
    { timeSec: 0, scalePercent: 100 },
    { timeSec: 2, scalePercent: 150 },
  ];

  test("používa zoompan s jednou výstupnou snímkou a presným rámom", () => {
    const f = animatedZoomFilter(kfs, 30, 1080, 1920);
    expect(f).toContain("zoompan=");
    expect(f).toContain("d=1");
    expect(f).toContain("s=1080x1920");
    expect(f).toContain("fps=30");
    // stredové priblíženie (rovnako ako canonical kompozitor)
    expect(f).toContain("x='iw/2-(iw/zoom/2)'");
    expect(f).toContain("y='ih/2-(ih/zoom/2)'");
  });

  test("bez rozmerov rámu sa animované priblíženie radšej nevyrobí (rám sa nesmie meniť)", () => {
    expect(animatedZoomFilter(kfs, 30)).toBe("");
    expect(animatedZoomFilter(kfs, 30, 0, 1920)).toBe("");
  });

  test("menej ako dva kroky nie je animácia", () => {
    expect(animatedZoomFilter([{ timeSec: 0, scalePercent: 120 }], 30, 1080, 1920)).toBe("");
    expect(animatedZoomFilter([], 30, 1080, 1920)).toBe("");
  });

  test("okno s krokmi ide cez zoompan, statické okno cez orez (nič sa nemení)", () => {
    const animated = zoomFilterForWindow({ scalePercent: 150, keyframes: kfs }, 30, { width: 1080, height: 1920 });
    expect(animated).toContain("zoompan=");
    const staticky = zoomFilterForWindow({ scalePercent: 112 }, 30, { width: 1080, height: 1920 });
    expect(staticky).toBe(zoomFilterForPercent(112, 1080, 1920));
    expect(staticky).toContain("crop=1080:1920");
  });
});

// ---------------------------------------------------------------------------
// C) Celá ffmpeg linka
// ---------------------------------------------------------------------------

describe("C) ffmpeg linka s animovaným priblížením", () => {
  const kfs = [
    { timeSec: 0.5, scalePercent: 100 },
    { timeSec: 3.5, scalePercent: 160 },
  ];

  test("bez strihu: okno rozdelí video a v okne pobeží zoompan", () => {
    const args = buildBurnFfmpegArgs({
      inputPath: "in.mp4",
      outputPath: "out.mp4",
      assPath: "/x/a.ass",
      sourceFps: 30,
      frameSize: { width: 1080, height: 1920 },
      outputDurationSec: 20,
      zoomWindows: [{ clipId: "c1", startSec: 5, endSec: 9, scalePercent: 160, keyframes: kfs }],
    });
    const f = filterOf(args);
    expect(f).toContain("trim=start=5.000:end=9.000");
    expect(f).toContain("zoompan=");
    expect(f).toContain("s=1080x1920");
    // mimo okna ostáva obraz bez priblíženia
    expect(f).toContain("trim=start=9.000:end=20.000");
    // zvuk sa stále len kopíruje (animovaný zoom čas nemení)
    expect(args[args.indexOf("-c:a") + 1]).toBe("copy");
    // rám sa nesmie preškálovať na iný formát
    expect(f).not.toContain("scale=1080:1920");
  });

  test("pri strihoch nesie kroky samotný úsek", () => {
    const args = buildBurnFfmpegArgs({
      inputPath: "in.mp4",
      outputPath: "out.mp4",
      assPath: "/x/a.ass",
      sourceFps: 30,
      frameSize: { width: 1080, height: 1920 },
      keepSegments: [
        { start: 0, end: 2 },
        { start: 4, end: 8, scalePercent: 160, keyframes: kfs },
      ],
    });
    const f = filterOf(args);
    expect(f).toContain("zoompan=");
    expect(f).toContain("trim=start=4.000:end=8.000");
    expect(f).toContain("concat=n=2:v=1:a=1[vc][ac]");
  });

  test("statické priblíženie sa nezmenilo — žiadny zoompan, ostáva orez", () => {
    const args = buildBurnFfmpegArgs({
      inputPath: "in.mp4",
      outputPath: "out.mp4",
      assPath: "/x/a.ass",
      sourceFps: 30,
      frameSize: { width: 1080, height: 1920 },
      keepSegments: [{ start: 0, end: 4, scalePercent: 112 }],
    });
    const f = filterOf(args);
    expect(f).not.toContain("zoompan=");
    expect(f).toContain("crop=1080:1920");
  });
});

// ---------------------------------------------------------------------------
// D) Canonical os — odkiaľ kroky pochádzajú
// ---------------------------------------------------------------------------

describe("D) kroky priblíženia z canonical osi", () => {
  test("klip s keyframami priblíženia sa premení na priebeh (a zoradí sa)", () => {
    const res = animatedZoomFromClip({
      duration: 6,
      keyframes: [kf(4, 160), kf(0, 100), kf(2, 130)],
    });
    expect(res && "keyframes" in res).toBe(true);
    const pts = res && "keyframes" in res ? res.keyframes : [];
    expect(pts.map((k) => k.timeSec)).toEqual([0, 2, 4]);
    expect(pts.map((k) => k.scale)).toEqual([100, 130, 160]);
  });

  test("jeden keyframe nie je animácia", () => {
    expect(animatedZoomFromClip({ duration: 4, keyframes: [kf(1, 140)] })).toBeNull();
    expect(animatedZoomFromClip({ duration: 4, keyframes: [] })).toBeNull();
  });

  test("animovaný posun/priehľadnosť sa prizná ako nevykreslené", () => {
    const res = animatedZoomFromClip({
      duration: 4,
      keyframes: [kf(0, 100), kf(2, 140), kf(1, 30, "positionX")],
    });
    expect(res && "reasonSk" in res).toBe(true);
    const reason = res && "reasonSk" in res ? res.reasonSk : "";
    expect(reason).toContain("positionX");
    expect(reason).toContain("scale");
  });

  test("zmenšovanie obrazu (pod 100 %) sa nepredstiera", () => {
    const res = animatedZoomFromClip({ duration: 4, keyframes: [kf(0, 100), kf(2, 80)] });
    expect(res && "reasonSk" in res).toBe(true);
    expect(res && "reasonSk" in res ? res.reasonSk : "").toContain("zmenšuje");
  });

  test("statický posun s animovaným priblížením = nevykreslíme (skreslilo by kompozíciu)", () => {
    const res = animatedZoomFromClip({ duration: 4, keyframes: [kf(0, 100), kf(2, 140)], positionX: 120 });
    expect(res && "reasonSk" in res).toBe(true);
    expect(res && "reasonSk" in res ? res.reasonSk : "").toContain("posunom");
  });

  test("ČASY NAD DĹŽKU KLIPU sa orežú na klip (nie ticho posunú dopredu)", () => {
    const res = animatedZoomFromClip({ duration: 3, keyframes: [kf(0, 100), kf(9, 200)] });
    const pts = res && "keyframes" in res ? res.keyframes : [];
    expect(pts.map((k) => k.timeSec)).toEqual([0, 3]);
  });

  test("plán exportu nesie animované priblíženie a povie to v poznámke", () => {
    const project = projectWith([
      clip({
        id: "v1",
        trackId: "track_video",
        type: "video",
        start: 0,
        duration: 6,
        sourceStart: 0,
        sourceEnd: 6,
        keyframes: [kf(0, 100), kf(4, 150)],
      }),
    ]);
    const plan = buildCanonicalExportPlan(project, { uploadId: "u.mp4", uploadName: "u.mp4", width: 1080, height: 1920 });
    expect(plan.request.zoom?.length).toBe(1);
    expect(plan.request.zoom?.[0].animated).toBe(true);
    expect(plan.request.zoom?.[0].keyframes?.length).toBe(2);
    // `scale` nesie najväčšiu hodnotu (do reportu)
    expect(plan.request.zoom?.[0].scale).toBe(150);
    expect(plan.notesSk.join(" ")).toContain("animovaných");
    // a nič sa nesťažuje, že by to nešlo (stará hláška o keyframoch už neplatí)
    expect(plan.unsupportedSk.join(" ")).not.toContain("keyframy");
    expect(plan.unsupportedSk).toHaveLength(0);
  });

  test("nepodporované animované priblíženie sa prizná klipom menom (nie ticho)", () => {
    const project = projectWith([
      clip({
        id: "v1",
        trackId: "track_video",
        type: "video",
        start: 0,
        duration: 6,
        name: "Klient reklama",
        keyframes: [kf(0, 100), kf(2, 140), kf(1, 40, "opacity")],
      }),
    ]);
    const plan = buildCanonicalExportPlan(project, { uploadId: "u.mp4", uploadName: "u.mp4", width: 1080, height: 1920 });
    expect(plan.request.zoom ?? []).toHaveLength(0);
    expect(plan.unsupportedSk.join(" ")).toContain("Klient reklama");
    expect(plan.unsupportedSk.join(" ")).toContain("opacity");
  });
});

// ---------------------------------------------------------------------------
// E) Validácia požiadavky
// ---------------------------------------------------------------------------

describe("E) validácia animovaného priblíženia", () => {
  const base = {
    uploadId: "abc-123__video.mp4",
    uploadName: "video.mp4",
    styleId: "VIRAL_BOLD",
    width: 1080,
    height: 1920,
    segments: [{ start: 0, end: 1, text: "Ahoj" }],
    keepRanges: [],
  };

  const zoomBody = (zoom: unknown) => ({ ...base, zoom });

  test("správne kroky prejdú a zoradia sa podľa času", () => {
    const r = validateBurnRequest(
      zoomBody([
        {
          clipId: "c1",
          startSec: 4,
          endSec: 8,
          scale: 160,
          positionX: 0,
          positionY: 0,
          keyframes: [
            { timeSec: 3, scalePercent: 160 },
            { timeSec: 0, scalePercent: 100 },
          ],
        },
      ]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spec.zoom[0].keyframes?.map((k) => k.timeSec)).toEqual([0, 3]);
  });

  test("round-trip: čo pošle canonical plán, to validácia prijme (mená polí sa nesmú rozísť)", () => {
    // Presne táto nezhoda (`scale` vs `scalePercent`) sa stala v reálnom behu —
    // unit testy dovtedy prechádzali, lebo volali validáciu s druhým menom.
    const project = projectWith([
      clip({
        id: "v1",
        trackId: "track_video",
        type: "video",
        start: 0,
        duration: 6,
        sourceStart: 0,
        sourceEnd: 6,
        keyframes: [kf(0, 100), kf(4, 150)],
      }),
    ]);
    const plan = buildCanonicalExportPlan(project, { uploadId: "u.mp4", uploadName: "u.mp4", width: 1080, height: 1920 });
    const zodpovedaPlanu = {
      ...base,
      zoom: plan.request.zoom ?? [],
      keepRanges: plan.request.keepRanges ?? [],
    };
    const r = validateBurnRequest(zodpovedaPlanu);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spec.zoom[0].keyframes?.length).toBe(2);
    expect(r.spec.zoom[0].keyframes?.[1].scalePercent).toBe(150);
  });

  test("krok mimo svojho okna sa odmietne s vysvetlením", () => {
    const r = validateBurnRequest(
      zoomBody([
        {
          clipId: "c1",
          startSec: 4,
          endSec: 8,
          scale: 160,
          keyframes: [
            { timeSec: 0, scalePercent: 100 },
            { timeSec: 9, scalePercent: 160 },
          ],
        },
      ]),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errorSk).toContain("mimo svojho okna");
  });

  test("jeden krok nestačí (je to len statický stav)", () => {
    const r = validateBurnRequest(
      zoomBody([{ clipId: "c1", startSec: 0, endSec: 4, scale: 150, keyframes: [{ timeSec: 0, scalePercent: 150 }] }]),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errorSk).toContain("aspoň dva kroky");
  });

  test("príliš veľa krokrov sa odmietne", () => {
    const many = Array.from({ length: BURN_LIMITS.maxZoomKeyframes + 1 }, (_, i) => ({
      timeSec: (i / (BURN_LIMITS.maxZoomKeyframes + 1)) * 4,
      scalePercent: 100 + i,
    }));
    const r = validateBurnRequest(zoomBody([{ clipId: "c1", startSec: 0, endSec: 4, scale: 150, keyframes: many }]));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errorSk).toContain("príliš veľa krokov");
  });

  test("zmenšovanie (pod 100 %) sa odmietne", () => {
    const r = validateBurnRequest(
      zoomBody([
        {
          clipId: "c1",
          startSec: 0,
          endSec: 4,
          scale: 150,
          keyframes: [
            { timeSec: 0, scalePercent: 100 },
            { timeSec: 3, scalePercent: 70 },
          ],
        },
      ]),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errorSk).toContain("100–400");
  });
});

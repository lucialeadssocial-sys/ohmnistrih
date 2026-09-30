import { describe, expect, test } from "bun:test";
import {
  TRANSITION_LIMITS,
  XFADE_TRANSITIONS,
  buildTransitionPlan,
  clampTransitionDurationSec,
  mapStudioTransitionsToClips,
  segmentsForTransitions,
  totalOverlapSec,
  transitionFfmpegName,
  transitionIsSupported,
  transitionUnsupportedReasonSk,
} from "../src/core/export/transitions";
import { buildBurnFfmpegArgs } from "../src/core/export/subtitleRender";
import { validateBurnRequest } from "../src/core/export/burnJob";

/**
 * KROK 25 — PRECHODY.
 *
 * Testy strážia tri veci, na ktorých stojí dôvera:
 *  1) preklad typu na ffmpeg je presný a nepodporované typy sa NIKDY nevykreslia,
 *  2) bez prechodov sa render nemení (regresia: acrossfade/xfade sa nesmie objaviť),
 *  3) zlý vstup skončí jasnou chybou, nie tichým zahodením.
 */

const keep = (a: number, b: number) => ({ start: a, end: b });

describe("A) preklad typov prechodov na ffmpeg", () => {
  test("A1 — typy, ktoré vieme vykresliť", () => {
    expect(transitionFfmpegName("dissolve")).toBe("dissolve");
    expect(transitionFfmpegName("crossfade")).toBe("fade");
    expect(transitionFfmpegName("fade")).toBe("fade");
    expect(transitionFfmpegName("slide_left")).toBe("slideleft");
    expect(transitionFfmpegName("slide_down")).toBe("slidedown");
    expect(transitionFfmpegName("zoom_in")).toBe("zoomin");
    expect(transitionFfmpegName("flash_white")).toBe("fadewhite");
    expect(transitionFfmpegName("flash_black")).toBe("fadeblack");
    expect(transitionFfmpegName("iris_circle")).toBe("circleopen");
    expect(transitionFfmpegName("wipeLeft")).toBe("wipeleft");
  });

  test("A2 — kinematické efekty sa NESMIE tváriť, že vieme vykresliť", () => {
    for (const t of ["glitch", "camera_shake", "tv_static", "vhs_rewind", "spin_cw", "whip_pan", "zoom_out"]) {
      expect(transitionIsSupported(t)).toBe(false);
      expect(transitionUnsupportedReasonSk(t).length).toBeGreaterThan(10);
    }
  });

  test("A3 — obyčajný strih nie je prechod", () => {
    expect(transitionFfmpegName("cut")).toBeNull();
    expect(transitionFfmpegName(undefined)).toBeNull();
    expect(transitionFfmpegName("nieco_neexistuje")).toBeNull();
  });

  test("A4 — každý preklad musí byť názov, ktorý ffmpeg pozná", () => {
    const supported = ["dissolve", "crossfade", "fade", "slide_left", "slide_right", "slide_up", "slide_down", "zoom_in", "flash_white", "flash_black", "iris_circle", "wipeLeft", "wipeRight"];
    for (const t of supported) {
      const name = transitionFfmpegName(t);
      expect(name).not.toBeNull();
      expect(XFADE_TRANSITIONS as readonly string[]).toContain(name as string);
    }
  });
});

describe("B) dĺžka prechodu a jej limity", () => {
  test("B1 — príliš dlhý prechod sa oreže podľa úsekov", () => {
    const d = clampTransitionDurationSec(5, 1.0, 1.0);
    expect(d).toBeLessThanOrEqual(1.0 * TRANSITION_LIMITS.maxShareOfShorterSegment + 0.001);
    expect(d).toBeLessThanOrEqual(TRANSITION_LIMITS.maxDurationSec);
  });

  test("B2 — príliš krátky prechod sa zdvihne na minimum (viditeľnosť)", () => {
    expect(clampTransitionDurationSec(0.001, 5, 5)).toBe(TRANSITION_LIMITS.minDurationSec);
  });

  test("B3 — primeraná dĺžka zostane nedotknutá", () => {
    expect(clampTransitionDurationSec(0.4, 5, 5)).toBe(0.4);
  });

  test("B4 — rozumná požiadavka sa nikdy nezmení na nezmysel", () => {
    const d = clampTransitionDurationSec(0.5, 0.6, 3);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThanOrEqual(0.24 + 0.001);
  });
});

describe("C) plán prechodov z canonical osi", () => {
  const segments = [
    { clipId: "c1", start: 0, end: 4, transitionIn: null },
    { clipId: "c2", start: 6, end: 10, transitionIn: { type: "crossfade", duration: 0.4 } },
    { clipId: "c3", start: 12, end: 16, transitionIn: { type: "dissolve", duration: 0.5 } },
  ];

  test("C1 — prechod patrí na spoj pred úsekom, ktorý ho má na vstupe", () => {
    const plan = buildTransitionPlan(segments);
    expect(plan.transitions.length).toBe(2);
    expect(plan.transitions[0]).toMatchObject({ junctionIndex: 0, toClipId: "c2", ffmpeg: "fade" });
    expect(plan.transitions[1]).toMatchObject({ junctionIndex: 1, toClipId: "c3", ffmpeg: "dissolve" });
    expect(totalOverlapSec(plan.transitions)).toBeCloseTo(0.9, 3);
  });

  test("C2 — nepodporovaný prechod sa prizná a na spoj sa nič nedá", () => {
    const plan = buildTransitionPlan([
      { clipId: "c1", start: 0, end: 4 },
      { clipId: "c2", start: 6, end: 10, transitionIn: { type: "glitch", duration: 0.4 } },
    ]);
    expect(plan.transitions.length).toBe(0);
    expect(plan.unsupportedSk[0]).toContain("glitch");
    expect(plan.unsupportedSk[0]).toContain("strih");
  });

  test("C3 — prechod na prvom úseku nemá s čím prechádzať (a appka to povie)", () => {
    const plan = buildTransitionPlan([
      { clipId: "c1", start: 0, end: 4, transitionIn: { type: "crossfade", duration: 0.4 } },
      { clipId: "c2", start: 6, end: 10 },
    ]);
    expect(plan.transitions.length).toBe(0);
    expect(plan.unsupportedSk[0]).toContain("prvého úseku");
  });

  test("C4 — strih bez prechodu nie je chyba ani prechod", () => {
    const plan = buildTransitionPlan([
      { clipId: "c1", start: 0, end: 4 },
      { clipId: "c2", start: 6, end: 10, transitionIn: { type: "cut", duration: 0 } },
    ]);
    expect(plan.transitions.length).toBe(0);
    expect(plan.unsupportedSk.length).toBe(0);
    expect(plan.summarySk).toContain("obyčajné");
  });

  test("C5 — úseky sa čítajú v poradí na časovej osi", () => {
    const segs = segmentsForTransitions([
      { id: "b", start: 10, sourceStart: 12, sourceEnd: 16, duration: 4 },
      { id: "a", start: 0, sourceStart: 0, sourceEnd: 4, duration: 4, transitions: { in: { type: "crossfade", duration: 0.4 } } },
    ]);
    expect(segs.map((s) => s.clipId)).toEqual(["a", "b"]);
    expect(segs[0].transitionIn?.type).toBe("crossfade");
  });
});

describe("D) prechody z rozhrania do canonical osi", () => {
  const clips = [
    { id: "c1", start: 0, sourceStart: 0, sourceEnd: 4, duration: 4 },
    { id: "c2", start: 4, sourceStart: 6, sourceEnd: 10, duration: 4 },
    { id: "c3", start: 8, sourceStart: 12, sourceEnd: 16, duration: 4 },
  ];

  test("D1 — prechod sa zapíše klipu, ktorý začína na jeho čase (to je ten strih)", () => {
    const m = mapStudioTransitionsToClips(clips, [{ timestamp: 6.0, duration: 0.4, type: "crossfade" }]);
    expect(m.updates).toEqual([{ clipId: "c2", transitionIn: { type: "crossfade", duration: 0.4 } }]);
    expect(m.unmatchedSk.length).toBe(0);
  });

  test("D2 — keď na tom čase strih nie je, prechod sa neuloží a appka to povie", () => {
    const m = mapStudioTransitionsToClips(clips, [{ timestamp: 99, duration: 0.4, type: "crossfade" }]);
    expect(m.updates.length).toBe(0);
    expect(m.unmatchedSk[0]).toContain("nie je strih");
  });

  test("D3 — nepodporovaný typ sa neuloží do osi (a je pomenovaný)", () => {
    const m = mapStudioTransitionsToClips(clips, [{ timestamp: 6.0, duration: 0.4, type: "glitch" }]);
    expect(m.updates.length).toBe(0);
    expect(m.unsupportedSk[0]).toContain("glitch");
  });

  test("D4 — zrušený prechod sa z osi odstráni (nezostane visieť)", () => {
    const withTransition = clips.map((c) => (c.id === "c2" ? { ...c, transitions: { in: { type: "crossfade", duration: 0.4 } } } : c));
    const m = mapStudioTransitionsToClips(withTransition as never, []);
    expect(m.updates).toEqual([{ clipId: "c2", transitionIn: null }]);
  });

  test("D5 — prvý klip nikdy nedostane prechod na vstupe", () => {
    const m = mapStudioTransitionsToClips(clips, [{ timestamp: 0, duration: 0.4, type: "crossfade" }]);
    expect(m.updates.length).toBe(0);
    expect(m.unmatchedSk.length).toBe(1);
  });
});

describe("E) ffmpeg linka: prechody áno, ale len keď majú byť", () => {
  const base = {
    inputPath: "/tmp/in.mp4",
    outputPath: "/tmp/out.mp4",
    assPath: "/tmp/subs.ass",
    keepSegments: [keep(0, 4), keep(6, 10), keep(12, 16)],
    outputDurationSec: 12,
    sourceFps: 30,
  };

  test("E1 — bez prechodov sa použije obyčajný concat (žiadny xfade, žiadne prelínanie zvuku)", () => {
    const graph = buildBurnFfmpegArgs(base as never).join(" ");
    expect(graph).toContain("concat=n=3:v=1:a=1");
    expect(graph).not.toContain("xfade");
    expect(graph).not.toContain("acrossfade");
  });

  test("E2 — s prechodom je v linke xfade s presným názvom a acrossfade pre zvuk", () => {
    const graph = buildBurnFfmpegArgs({
      ...base,
      transitions: [{ junctionIndex: 0, ffmpeg: "fade", durationSec: 0.4 }, { junctionIndex: 1, ffmpeg: "dissolve", durationSec: 0.5 }],
    } as never).join(" ");
    expect(graph).toContain("xfade=transition=fade:duration=0.400");
    expect(graph).toContain("xfade=transition=dissolve:duration=0.500");
    expect(graph).toContain("acrossfade=d=0.400");
    expect(graph).toContain("acrossfade=d=0.500");
  });

  test("E3 — offset prechodu sedí: prvý prechod začína na konci prvého úseku mínus prekrytie", () => {
    const graph = buildBurnFfmpegArgs({
      ...base,
      transitions: [{ junctionIndex: 0, ffmpeg: "fade", durationSec: 0.4 }],
    } as never).join(" ");
    expect(graph).toContain("offset=3.600");
  });

  test("E4 — druhý prechod počíta s tým, že prvý už čas skrátil", () => {
    const graph = buildBurnFfmpegArgs({
      ...base,
      transitions: [
        { junctionIndex: 0, ffmpeg: "fade", durationSec: 0.5 },
        { junctionIndex: 1, ffmpeg: "fade", durationSec: 0.5 },
      ],
    } as never).join(" ");
    // 4 + 4 - 0,5 = 7,5 → offset druhého = 7,0
    expect(graph).toContain("offset=7.000");
  });

  test("E5 — prechod na neexistujúci spoj sa v linke neobjaví", () => {
    const graph = buildBurnFfmpegArgs({
      ...base,
      transitions: [{ junctionIndex: 9, ffmpeg: "fade", durationSec: 0.4 }],
    } as never).join(" ");
    expect(graph).not.toContain("xfade");
  });

  test("E6 — spoj bez prechodu medzi dvoma s prechodom sa spojí obyčajne", () => {
    const graph = buildBurnFfmpegArgs({
      ...base,
      transitions: [
        { junctionIndex: 0, ffmpeg: "fade", durationSec: 0.4 },
        { junctionIndex: 2, ffmpeg: "fade", durationSec: 0.4 },
      ],
    } as never).join(" ");
    expect(graph).toContain("xfade=transition=fade:duration=0.400");
    expect(graph).toContain("concat=n=2:v=1:a=0");
  });
});

describe("F) validácia vstupu (zlý vstup = jasná chyba)", () => {
  const request = {
    uploadId: "abc__video.mp4",
    uploadName: "video.mp4",
    segments: [{ start: 0, end: 2, text: "ahoj", words: [] }],
    keepRanges: [keep(0, 4), keep(6, 10)],
    outputDurationSec: 8,
  };

  test("F1 — správny prechod prejde", () => {
    const v = validateBurnRequest({ ...request, transitions: [{ junctionIndex: 0, ffmpeg: "fade", durationSec: 0.4 }] });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.spec.transitions?.length).toBe(1);
  });

  test("F2 — spoj, ktorý v strihu neexistuje, sa odmietne", () => {
    const v = validateBurnRequest({ ...request, transitions: [{ junctionIndex: 3, ffmpeg: "fade", durationSec: 0.4 }] });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errorSk).toContain("neexistuje");
  });

  test("F3 — neznámy prechod pre ffmpeg sa odmietne (nie ticho zahodí)", () => {
    const v = validateBurnRequest({ ...request, transitions: [{ junctionIndex: 0, ffmpeg: "glitch", durationSec: 0.4 }] });
    expect(v.ok).toBe(false);
  });

  test("F4 — nezmyselná dĺžka sa odmietne", () => {
    const v = validateBurnRequest({ ...request, transitions: [{ junctionIndex: 0, ffmpeg: "fade", durationSec: 0.001 }] });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errorSk).toContain("Dĺžka prechodu");
  });

  test("F5 — bez prechodov je zadanie presne také ako doteraz (žiadne pole navyše)", () => {
    const v = validateBurnRequest(request);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.spec.transitions).toBeUndefined();
  });
});

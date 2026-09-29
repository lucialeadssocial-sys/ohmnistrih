import { describe, expect, test } from "bun:test";
import {
  buildRetentionEdl,
  mergeRanges,
  complementRanges,
  nextKeepTime,
  edlDuration,
  edlToClipSpecs,
  edlSummarySk,
  mmss,
  type RetentionPlatformSpec,
  type RetentionPlanItemLike,
} from "../src/core/retention/retentionEngine";

const REELS: RetentionPlatformSpec = {
  id: "REELS",
  labelSk: "Instagram Reels",
  minSeconds: 7,
  maxSeconds: 120,
};

const SHORT_REELS: RetentionPlatformSpec = {
  id: "ADS",
  labelSk: "Reklama",
  minSeconds: 6,
  maxSeconds: 30,
};

const cut = (start: number, end: number, label = "Vystrihnúť výplň"): RetentionPlanItemLike => ({
  id: `c-${start}`,
  type: "CUT",
  start,
  end,
  label,
  reason: "Pasáž nesie málo informácie.",
  basis: "transcript",
});

describe("retention engine — rozsahy", () => {
  test("mergeRanges zlúči prekrývajúce sa aj nadväzujúce rozsahy", () => {
    expect(mergeRanges([[5, 10], [8, 12]])).toEqual([[5, 12]]);
    expect(mergeRanges([[0, 5], [5, 9]])).toEqual([[0, 9]]);
    expect(mergeRanges([[10, 12], [0, 3]])).toEqual([[0, 3], [10, 12]]);
    expect(mergeRanges([])).toEqual([]);
  });

  test("complementRanges vráti presne zachované úseky", () => {
    expect(complementRanges([[3, 5]], 10)).toEqual([[0, 3], [5, 10]]);
    expect(complementRanges([[0, 4]], 10)).toEqual([[4, 10]]);
    expect(complementRanges([[0, 10]], 10)).toEqual([]);
    expect(complementRanges([], 8)).toEqual([[0, 8]]);
  });
});

describe("retention engine — stavba EDL", () => {
  test("základ: strihy sa odstránia, zvyšok zostane a má správne časy", () => {
    const edl = buildRetentionEdl({
      plan: [cut(10, 12), cut(20, 21)],
      durationSec: 30,
      platform: REELS,
      mode: "SOCIAL",
    });
    expect(edl.segments.map((s) => [s.sourceStart, s.sourceEnd])).toEqual([
      [0, 10],
      [12, 20],
      [21, 30],
    ]);
    expect(edlDuration(edl)).toBe(27);
    expect(edl.totalDurationSec).toBe(27);
    expect(edl.stats.keptSegments).toBe(3);
    expect(edl.stats.removedCount).toBe(2);
    // časová os výsledku musí byť spojitá
    expect(edl.segments.map((s) => s.timelineStart)).toEqual([0, 10, 18]);
  });

  test("hook sa presunie na začiatok a je to ohlásené", () => {
    const plan: RetentionPlanItemLike[] = [
      cut(10, 12),
      { id: "h", type: "HOOK", start: 24, end: 26, label: "Najsilnejšia veta", basis: "transcript" },
    ];
    const edl = buildRetentionEdl({ plan, durationSec: 30, platform: REELS });

    expect(edl.hookMoved).toBe(true);
    expect(edl.hookFirst).toBe(true);
    expect(edl.segments[0].sourceStart).toBe(24); // úsek s hookom je prvý
    expect(edl.segments[0].movedForHook).toBe(true);
    const info = edl.warnings.find((w) => w.level === "info");
    expect(info?.text).toContain("Vyrezal som hook");
    expect(info?.hint).toContain("poradie rozprávania");
    // a nič sa nestratilo
    expect(edlDuration(edl)).toBe(28);
  });

  test("hook, ktorý už je na začiatku, sa nepresúva", () => {
    const edl = buildRetentionEdl({
      plan: [cut(12, 14), { id: "h", type: "HOOK", start: 0, end: 3 }],
      durationSec: 30,
      platform: REELS,
    });
    expect(edl.hookMoved).toBe(false);
    expect(edl.hookFirst).toBe(true);
    expect(edl.segments[0].sourceStart).toBe(0);
  });

  test("príliš krátke zvyšky sa zahodia, aby klip nebol nervózny", () => {
    // strihy nechajú zvyšok 0,4 s medzi 5,0 – 5,4
    const edl = buildRetentionEdl({
      plan: [cut(4.8, 5.0), cut(5.4, 6.0)],
      durationSec: 20,
      platform: REELS,
    });
    const dropped = edl.removedRanges.find((r) => r.label === "Príliš krátky zvyšok");
    expect(dropped).toBeTruthy();
    expect(dropped!.seconds).toBeCloseTo(0.4, 2);
    for (const s of edl.segments) expect(s.duration).toBeGreaterThanOrEqual(0.6);
  });

  test("limit platformy: prebytok sa odreže z konca a povie sa to", () => {
    const edl = buildRetentionEdl({
      plan: [cut(10, 11)],
      durationSec: 60,
      platform: SHORT_REELS, // max 30 s
    });
    expect(edl.totalDurationSec).toBeLessThanOrEqual(30);
    expect(edl.droppedForLength.length).toBeGreaterThan(0);
    const warn = edl.warnings.find((w) => w.text.includes("limitu"));
    expect(warn?.level).toBe("warn");
    expect(edl.stats.removedCount).toBe(1 + edl.droppedForLength.length);
  });

  test("plán bez strihov = žiadne vymýšľanie, len upozornenie", () => {
    const edl = buildRetentionEdl({
      plan: [{ id: "h", type: "HOOK", start: 0, end: 3 }],
      durationSec: 20,
      platform: REELS,
    });
    expect(edl.segments).toHaveLength(1);
    expect(edl.segments[0].sourceStart).toBe(0);
    expect(edl.segments[0].sourceEnd).toBe(20);
    expect(edl.removedRanges).toHaveLength(0);
    expect(edl.warnings.some((w) => w.text.includes("nič nestrihá"))).toBe(true);
  });

  test("príliš agresívny strih varuje pred stratou kontextu", () => {
    const edl = buildRetentionEdl({
      plan: [cut(0, 25)],
      durationSec: 50,
      platform: REELS,
    });
    const w = edl.warnings.find((x) => x.text.includes("odstráni"));
    expect(w?.level).toBe("warn");
    expect(w?.hint).toContain("kontext");
  });

  test("klip pod minimom platformy je STOP s konkrétnou radou", () => {
    const edl = buildRetentionEdl({
      plan: [cut(2, 20)],
      durationSec: 24,
      platform: REELS, // min 7 s → zostane 2 + 4 = 6 s
    });
    const stop = edl.warnings.find((w) => w.level === "stop");
    expect(stop).toBeTruthy();
    expect(stop!.text).toContain("pod minimom");
    expect(stop!.hint).toContain("Pridaj ďalší materiál");
  });

  test("časy mimo dĺžky videa sa orežú (plan nemôže ukazovať mimo materiálu)", () => {
    const edl = buildRetentionEdl({
      plan: [cut(-5, 2), cut(19, 40)],
      durationSec: 20,
      platform: REELS,
    });
    for (const r of edl.removedRanges) {
      expect(r.start).toBeGreaterThanOrEqual(0);
      expect(r.end).toBeLessThanOrEqual(20);
    }
    for (const s of edl.segments) {
      expect(s.sourceStart).toBeGreaterThanOrEqual(0);
      expect(s.sourceEnd).toBeLessThanOrEqual(20);
    }
  });

  test("prekrývajúce sa strihy v pláne sa spoja (žiadne dvojité odpočítanie)", () => {
    const edl = buildRetentionEdl({
      plan: [cut(5, 10), cut(8, 12)],
      durationSec: 30,
      platform: REELS,
    });
    expect(edl.removedRanges).toHaveLength(1);
    expect(edl.removedSeconds).toBe(7);
    expect(edlDuration(edl)).toBe(23);
  });

  test("basis sa dedí z plánu a odhad varuje", () => {
    const estimated = buildRetentionEdl({
      plan: [{ ...cut(5, 7), basis: "estimate" }],
      durationSec: 20,
      platform: REELS,
    });
    expect(estimated.basis).toBe("estimate");
    expect(estimated.warnings.some((w) => w.text.includes("odhad"))).toBe(true);

    const anchored = buildRetentionEdl({ plan: [cut(5, 7)], durationSec: 20, platform: REELS });
    expect(anchored.basis).toBe("transcript");
  });

  test("engine je deterministický (rovnaký vstup = rovnaký strih)", () => {
    const input = { plan: [cut(3, 5), cut(9, 11)], durationSec: 30, platform: REELS };
    const a = buildRetentionEdl({ ...input, now: new Date(0) });
    const b = buildRetentionEdl({ ...input, now: new Date(0) });
    expect(a.segments).toEqual(b.segments);
    expect(a.removedRanges).toEqual(b.removedRanges);
    expect(a.stats).toEqual(b.stats);
  });
});

describe("retention engine — prehrávanie náhľadu", () => {
  const edl = buildRetentionEdl({
    plan: [cut(10, 12), cut(20, 21)],
    durationSec: 30,
    platform: REELS,
  });

  test("vo vystrihnutom úseku skočí na jeho koniec", () => {
    expect(nextKeepTime(edl, 10)).toBe(12);
    expect(nextKeepTime(edl, 11.5)).toBe(12);
    expect(nextKeepTime(edl, 20.5)).toBe(21);
  });

  test("v zachovanom úseku prehrávanie pokračuje", () => {
    expect(nextKeepTime(edl, 0)).toBeNull();
    expect(nextKeepTime(edl, 14)).toBeNull();
    expect(nextKeepTime(edl, 29.9)).toBeNull();
  });

  test("hranice: presne na konci vystrihnutého úseku už nepreskakuje", () => {
    expect(nextKeepTime(edl, 12)).toBeNull();
  });
});

describe("retention engine — výstup pre timeline", () => {
  test("edlToClipSpecs dá klipy s časmi pre render", () => {
    const edl = buildRetentionEdl({
      plan: [cut(10, 12)],
      durationSec: 25,
      platform: REELS,
    });
    const clips = edlToClipSpecs(edl);
    expect(clips).toHaveLength(2);
    expect(clips[0]).toMatchObject({ sourceStart: 0, sourceEnd: 10, timelineStart: 0, duration: 10 });
    expect(clips[1]).toMatchObject({ sourceStart: 12, sourceEnd: 25, timelineStart: 10, duration: 13 });
    // klipy na časovej osi nesmú mať diery
    for (let i = 1; i < clips.length; i++) {
      const prev = clips[i - 1];
      expect(clips[i].timelineStart).toBeCloseTo(prev.timelineStart + prev.duration, 2);
    }
  });

  test("zhrnutie je vecné (bez marketingových slov)", () => {
    const edl = buildRetentionEdl({ plan: [cut(5, 8)], durationSec: 30, platform: REELS });
    const text = edlSummarySk(edl);
    expect(text).toContain("Instagram Reels");
    expect(text).toContain("z pôvodných");
    expect(/garant|virálne za|100 % zhliadn/i.test(text)).toBe(false);
  });

  test("mmss formátuje čas", () => {
    expect(mmss(0)).toBe("0:00");
    expect(mmss(65)).toBe("1:05");
    expect(mmss(125.9)).toBe("2:05");
  });
});

describe("retention engine — slovenčina v textoch", () => {
  test("skloňovanie počtu je správne (1 úsek / 2 úseky / 5 úsekov)", async () => {
    const { pluralSk } = await import("../src/core/retention/retentionEngine");
    expect(pluralSk(1, "úsek", "úseky", "úsekov")).toBe("1 úsek");
    expect(pluralSk(2, "úsek", "úseky", "úsekov")).toBe("2 úseky");
    expect(pluralSk(4, "úsek", "úseky", "úsekov")).toBe("4 úseky");
    expect(pluralSk(5, "úsek", "úseky", "úsekov")).toBe("5 úsekov");
    expect(pluralSk(0, "úsek", "úseky", "úsekov")).toBe("0 úsekov");
  });

  test("zhrnutie nepoužije nesprávny tvar pri dvoch úsekoch", () => {
    const edl = buildRetentionEdl({ plan: [cut(5, 8)], durationSec: 30, platform: REELS });
    const text = edlSummarySk(edl);
    expect(text).toContain("2 úseky");
    expect(text).not.toContain("2 úsekov");
  });
});

describe("RETENTION — prichytenie strihov na hranice slov (krok A)", () => {
  /** Reč tak, ako ju vracia /api/transcribe-speech: krátke titulky s časmi slov. */
  const reč = [
    { start: 0.2, end: 4.0, text: "Dnes si ukážeme, ako som naplnil kaviareň.", words: [
      { word: "Dnes", start: 0.2, end: 0.6 }, { word: "si", start: 0.62, end: 0.78 },
      { word: "ukážeme", start: 0.8, end: 1.5 }, { word: "ako", start: 2.4, end: 2.7 },
      { word: "som", start: 2.72, end: 2.95 }, { word: "naplnil", start: 3.0, end: 3.6 },
      { word: "kaviareň", start: 3.62, end: 4.0 },
    ]},
    { start: 6.5, end: 12.0, text: "Prvý deň som dal inzerát a prišli ľudia.", words: [
      { word: "Prvý", start: 6.5, end: 6.9 }, { word: "deň", start: 6.92, end: 7.15 },
      { word: "som", start: 7.2, end: 7.4 }, { word: "dal", start: 7.42, end: 7.65 },
      { word: "inzerát", start: 7.7, end: 8.3 }, { word: "a", start: 8.35, end: 8.45 },
      { word: "prišli", start: 8.5, end: 9.1 }, { word: "ľudia", start: 9.12, end: 9.6 },
    ]},
  ];

  const platform = { id: "REELS", labelSk: "Instagram Reels", minSeconds: 7, maxSeconds: 120 };

  test("strih, ktorý pretínal slovo, sa posunie na hranicu a je to priznané", () => {
    // CUT 4.2 – 6.3 by pretal „a“ (8.35... nie) — tu len over, že sa posunie do pauzy
    const edl = buildRetentionEdl({
      plan: [{ type: "CUT", start: 4.2, end: 6.3, basis: "transcript" }],
      durationSec: 15,
      platform,
      speechSegments: reč,
    });

    expect(edl.timingPrecision).toBe("words");
    const cut = edl.removedRanges[0];
    // pôvodne 4.2 – 6.3; hranice slov/pauzy sú v 4.0 a 6.5 → strih ide do pauzy
    expect(cut.start).toBeCloseTo(4.0, 1);
    expect(cut.end).toBeCloseTo(6.5, 1);
    expect(edl.wordSnap.snappedCount).toBeGreaterThan(0);
    expect(edl.wordSnap.reports.length).toBeGreaterThan(0);
    expect(edl.wordSnap.maxShiftSec).toBeGreaterThan(0);
    // a posun sa nesmie skryť — je v hláseniach aj s číslom
    expect(edl.warnings.some((w) => w.text.includes("hranice slov"))).toBe(true);
  });

  test("posun je vždy malý (nikdy neprekvapí o sekundy)", () => {
    const edl = buildRetentionEdl({
      plan: [{ type: "CUT", start: 3.05, end: 7.6, basis: "transcript" }],
      durationSec: 15,
      platform,
      speechSegments: reč,
    });
    expect(edl.wordSnap.maxShiftSec).toBeLessThanOrEqual(0.6);
  });

  test("bez word-level časovania je strih presne tam, kde ho plán dal (a je to priznané)", () => {
    const edl = buildRetentionEdl({
      plan: [{ type: "CUT", start: 4.2, end: 6.3, basis: "transcript" }],
      durationSec: 15,
      platform,
    });
    expect(edl.removedRanges[0].start).toBeCloseTo(4.2, 2);
    expect(edl.removedRanges[0].end).toBeCloseTo(6.3, 2);
    expect(edl.wordSnap.snappedCount).toBe(0);
    expect(edl.wordSnap.reports).toEqual([]);
    expect(edl.timingPrecision).toBe("sentences");
  });

  test("strih už na hraniciach sa nehlási (žiadne zbytočné riadky)", () => {
    const edl = buildRetentionEdl({
      plan: [{ type: "CUT", start: 4.0, end: 6.5, basis: "transcript" }],
      durationSec: 15,
      platform,
      speechSegments: reč,
    });
    expect(edl.wordSnap.snappedCount).toBe(0);
    expect(edl.warnings.some((w) => w.text.includes("hranice slov"))).toBe(false);
  });

  test("determinizmus platí aj s prichytením na slová", () => {
    const input = {
      plan: [{ type: "CUT" as const, start: 4.2, end: 6.3, basis: "transcript" as const }],
      durationSec: 15,
      platform,
      speechSegments: reč,
      now: new Date("2026-09-29T10:00:00Z"),
    };
    const a = buildRetentionEdl(input);
    const b = buildRetentionEdl(input);
    expect(JSON.stringify(a.segments)).toBe(JSON.stringify(b.segments));
    expect(JSON.stringify(a.wordSnap)).toBe(JSON.stringify(b.wordSnap));
  });

  test("príliš málo slov (pod 3) sa nepovažuje za presné časovanie", () => {
    const edl = buildRetentionEdl({
      plan: [{ type: "CUT", start: 4.2, end: 6.3, basis: "transcript" }],
      durationSec: 15,
      platform,
      speechSegments: [{ start: 4, end: 5, text: "ahoj", words: [{ word: "ahoj", start: 4, end: 5 }] }],
    });
    expect(edl.timingPrecision).toBe("sentences");
    expect(edl.wordSnap.snappedCount).toBe(0);
  });
});

import { describe, expect, test } from "bun:test";
import {
  buildSentenceTimings,
  buildWordIndex,
  flattenWords,
  longestGaps,
  precisionLabelSk,
  snapRangeToWords,
  snapReportSk,
  snapToWordBoundary,
  speechCoverage,
  type SpeechSegmentLike,
} from "../src/core/transcript/wordTiming";

/**
 * Testy nad realistickými dátami — tak, ako ich vracia `/api/transcribe-speech`
 * (titulky po 2–6 slovách, každé slovo má vlastný čas).
 *
 * Vymyslená je len reč; formát je presne ten, ktorý appka naozaj dostane.
 */
function seg(start: number, end: number, text: string, words: [string, number, number][]): SpeechSegmentLike {
  return { start, end, text, words: words.map(([word, s, e]) => ({ word, start: s, end: e })) };
}

const SPEECH: SpeechSegmentLike[] = [
  seg(0.2, 1.9, "Dnes si ukážeme,", [
    ["Dnes", 0.2, 0.6],
    ["si", 0.62, 0.78],
    ["ukážeme", 0.8, 1.5],
  ]),
  seg(2.4, 4.0, "ako som naplnil kaviareň.", [
    ["ako", 2.4, 2.7],
    ["som", 2.72, 2.95],
    ["naplnil", 3.0, 3.6],
    ["kaviareň", 3.62, 4.0],
  ]),
  seg(6.5, 8.6, "Prvý deň som dal inzerát.", [
    ["Prvý", 6.5, 6.9],
    ["deň", 6.92, 7.15],
    ["som", 7.2, 7.4],
    ["dal", 7.42, 7.65],
    ["inzerát", 7.7, 8.3],
  ]),
];

describe("word-level časovanie — index", () => {
  test("poskladá slová zo segmentov v správnom poradí", () => {
    const words = flattenWords(SPEECH);
    expect(words.length).toBe(12);
    expect(words[0].word).toBe("Dnes");
    expect(words[words.length - 1].word).toBe("inzerát");
    // časovo vzostupné
    for (let i = 1; i < words.length; i++) {
      expect(words[i].start).toBeGreaterThanOrEqual(words[i - 1].start);
    }
  });

  test("nájde pauzy medzi slovami (najlepšie miesta pre strih)", () => {
    const idx = buildWordIndex(flattenWords(SPEECH));
    // pauza medzi „kaviareň“ (končí 4.0) a „Prvý“ (začína 6.5) = 2,5 s
    const biggest = longestGaps(idx, 1)[0];
    expect(biggest.duration).toBeCloseTo(2.5, 1);
    expect(biggest.start).toBeCloseTo(4.0, 1);
    expect(biggest.end).toBeCloseTo(6.5, 1);
  });

  test("hranice sú zoradené a nesú susedné slová", () => {
    const idx = buildWordIndex(flattenWords(SPEECH));
    expect(idx.boundaries.length).toBe(24); // začiatok aj koniec každého z 12 slov
    for (let i = 1; i < idx.boundaries.length; i++) {
      expect(idx.boundaries[i].time).toBeGreaterThanOrEqual(idx.boundaries[i - 1].time);
    }
    // pauza 0,9 s medzi koncom „ukážeme“ (1,5) a začiatkom „ako“ (2,4)
    const hranica = idx.boundaries.find((b) => Math.abs(b.time - 1.5) < 0.01);
    expect(hranica).toBeTruthy();
    expect(hranica!.beforeWord).toBe("ukážeme");
    expect(hranica!.afterWord).toBe("ako");
    expect(hranica!.gapSec).toBeCloseTo(0.9, 1);
    // a koniec slova je hranica rovnako ako jeho začiatok
    const koniec = idx.boundaries.find((b) => Math.abs(b.time - 4.0) < 0.01);
    expect(koniec!.beforeWord).toBe("kaviareň");
  });

  test("poškodené časy (end ≤ start) nespadnú, len sa spravia použiteľné", () => {
    const words = flattenWords([
      { start: 1, end: 0, text: "x", words: [{ word: "test", start: 1, end: 0 }] },
      { start: 2, end: 3, text: "y", words: [{ word: "ok", start: 2, end: 3 }] },
    ]);
    expect(words.length).toBe(2);
    expect(words[0].end).toBeGreaterThan(words[0].start);
  });

  test("prázdny vstup = prázdny index, žiadne výmysly", () => {
    expect(flattenWords([])).toEqual([]);
    const idx = buildWordIndex([]);
    expect(idx.words).toEqual([]);
    expect(idx.boundaries).toEqual([]);
    expect(idx.gaps).toEqual([]);
    expect(idx.precision).toBe("sentences");
  });

  test("prekryté segmenty (to isté slovo dvakrát) sa nezrátajú dvakrát", () => {
    const dup: SpeechSegmentLike[] = [
      seg(0, 1, "ahoj svet", [["ahoj", 0, 0.5], ["svet", 0.5, 1]]),
      seg(0, 1, "ahoj svet", [["ahoj", 0, 0.5], ["svet", 0.5, 1]]),
    ];
    expect(flattenWords(dup).length).toBe(2);
  });
});

describe("word-level časovanie — prichytenie strihu", () => {
  const idx = buildWordIndex(flattenWords(SPEECH));

  test("strih v pauze vyhráva nad tesnou hranicou (strih v pauze divák nevidí)", () => {
    // 4,05 je hneď za koncom slova „kaviareň“ — blízko je aj 4,0 (tesná hranica
    // konca vety) aj 6,5 (začiatok ďalšej vety s pauzou 2,5 s).
    const snap = snapToWordBoundary(4.3, idx, "nearest");
    expect(snap.time).toBeCloseTo(4.0, 1); // najbližšia je pauza na konci vety
    expect(snap.unchanged).toBe(false);
    expect(snap.deltaSec).toBeLessThan(0.5);
  });

  test("čas presne na hranici slov sa nemení", () => {
    const snap = snapToWordBoundary(4.0, idx, "nearest");
    expect(snap.time).toBeCloseTo(4.0, 2);
    expect(snap.unchanged).toBe(true);
  });

  test("príliš vzdialenú hranicu radšej nepoužijeme (žiadne prekvapenia)", () => {
    // Najbližšia hranica je 0,30 s ďaleko (koniec slova „kaviareň“).
    const ok = snapToWordBoundary(4.3, idx, "nearest", 0.35);
    expect(ok.time).toBeCloseTo(4.0, 2);
    // S prísnejším limitom (0,1 s) sa nesmie posunúť nikam.
    const strict = snapToWordBoundary(4.3, idx, "nearest", 0.1);
    expect(strict.unchanged).toBe(true);
    expect(strict.time).toBeCloseTo(4.3, 3);
  });

  test("smer „before“ nikdy neposunie dozadu (nič nepridá do záberu)", () => {
    const snap = snapToWordBoundary(7.0, idx, "before");
    expect(snap.time).toBeLessThanOrEqual(7.0);
  });

  test("smer „after“ nikdy neposunie dopredu", () => {
    const snap = snapToWordBoundary(7.0, idx, "after");
    expect(snap.time).toBeGreaterThanOrEqual(7.0);
  });

  test("strihaný rozsah sa rozšíri tak, aby nepretal slovo", () => {
    // Strih 2,5 – 3,3 pretína slovo „naplnil“ (3,0–3,6) v polovici.
    // Začiatok ide na hranicu pred 2,5 (teda 2,4 – začiatok „ako“),
    // koniec na koniec prerezaného slova (3,6).
    const snapped = snapRangeToWords(2.5, 3.3, idx, 0.6);
    expect(snapped.start).toBeCloseTo(2.4, 1);
    expect(snapped.end).toBeCloseTo(3.6, 1);
    expect(snapped.changed).toBe(true);
    // rozsah sa nesmie zmrštiť na nič
    expect(snapped.end).toBeGreaterThan(snapped.start);
  });

  test("rozsah, ktorý už na hraniciach je, sa nemení", () => {
    const snapped = snapRangeToWords(2.4, 4.0, idx, 0.6);
    expect(snapped.start).toBeCloseTo(2.4, 1);
    expect(snapped.end).toBeCloseTo(4.0, 1);
    expect(snapped.changed).toBe(false);
  });

  test("prázdny index = všetko ostáva tak, ako bolo", () => {
    const empty = buildWordIndex([]);
    const snap = snapToWordBoundary(3.33, empty, "nearest");
    expect(snap.unchanged).toBe(true);
    expect(snap.time).toBeCloseTo(3.33, 3);
    const range = snapRangeToWords(1, 2, empty);
    expect(range.changed).toBe(false);
  });

  test("hlásenie posunu je konkrétne a po slovensky", () => {
    const snap = snapToWordBoundary(4.3, idx, "nearest", 0.5);
    const text = snapReportSk("Strih „výplňová veta“", snap, "start");
    expect(text).toBeTruthy();
    expect(text!).toContain("0.30 s");
    expect(text!).toContain("skôr");
    expect(text!).toContain("slovo nepretlo");
    // bez posunu sa nehlási nič (žiadne zbytočné riadky)
    expect(snapReportSk("x", { time: 4, deltaSec: 0, unchanged: true }, "start")).toBeNull();
  });
});

describe("word-level časovanie — vety s presnými časmi", () => {
  test("spojí titulky do viet a použije PRESNÉ časy (nie odhad)", () => {
    const sentences = buildSentenceTimings(SPEECH);
    expect(sentences.length).toBe(3);
    expect(sentences[0].text).toContain("Dnes si ukážeme");
    expect(sentences[0].start).toBeCloseTo(0.2, 2);
    expect(sentences[0].end).toBeCloseTo(1.5, 2);
    expect(sentences[0].precision).toBe("words");
    expect(sentences[0].wordCount).toBe(3);
    // veta nesmie siahať na ďalšiu (pauza 0,9 s ju oddeľuje)
    expect(sentences[1].start).toBeCloseTo(2.4, 2);
  });

  test("pauza preruší vetu aj bez interpunkcie", () => {
    const bezBodiek: SpeechSegmentLike[] = [
      seg(0, 1, "prvá myšlienka", [["prvá", 0, 0.4], ["myšlienka", 0.4, 1]]),
      seg(2.2, 3.2, "druhá myšlienka", [["druhá", 2.2, 2.7], ["myšlienka", 2.7, 3.2]]),
    ];
    const sentences = buildSentenceTimings(bezBodiek, 0.45);
    expect(sentences.length).toBe(2);
    expect(sentences[0].text).toBe("prvá myšlienka");
    expect(sentences[1].text).toBe("druhá myšlienka");
  });

  test("titulky bez interpunkcie a bez pauzy ostanú jednou vetou", () => {
    const spolu: SpeechSegmentLike[] = [
      seg(0, 1, "prvá časť vety", [["prvá", 0, 0.3], ["časť", 0.32, 0.6]]),
      seg(1.02, 2, "a jej koniec", [["a", 1.02, 1.1], ["jej", 1.12, 1.4], ["koniec", 1.42, 2]]),
    ];
    const sentences = buildSentenceTimings(spolu);
    expect(sentences.length).toBe(1);
    expect(sentences[0].text).toContain("koniec");
  });

  test("prázdny vstup = nič (nie prázdna veta)", () => {
    expect(buildSentenceTimings([])).toEqual([]);
    expect(buildSentenceTimings([{ start: 0, end: 1, text: "   " }])).toEqual([]);
  });
});

describe("word-level časovanie — poctivé texty a pokrytie", () => {
  test("pokrytie rečou sa spočíta z reálneho času slov", () => {
    const cov = speechCoverage(flattenWords(SPEECH), 10);
    // reč zaberá 4,43 s z 10 s videa (zvyšok sú pauzy)
    expect(cov.ratio).toBeCloseTo(0.443, 2);
    expect(cov.speechSec).toBeCloseTo(4.43, 1);
    expect(speechCoverage([], 10).ratio).toBe(0);
  });

  test("popis presnosti prizná, keď slová nemám", () => {
    const soSlovami = precisionLabelSk(buildWordIndex(flattenWords(SPEECH)));
    expect(soSlovami).toContain("presné na slová");
    const bez = precisionLabelSk(null, 9);
    expect(bez).toContain("odhad");
    expect(bez).toContain("desatín");
    expect(precisionLabelSk(null, 0)).toContain("len podľa plánu");
  });

  test("málo slov (pod 3) sa neoznačuje ako presné časovanie", () => {
    const idx = buildWordIndex([{ word: "ahoj", start: 0, end: 0.5 }]);
    expect(idx.precision).toBe("sentences");
  });
});

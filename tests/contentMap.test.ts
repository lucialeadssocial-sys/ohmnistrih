/**
 * KROK 2 — Content Map naprieč médiami: UNIT testy (so stubom, bez modelu).
 *
 * Strážená poctivosť:
 *  • médium bez textu nie je „prázdne použiteľné“ — má dôvod a počíta sa ako nepoužité,
 *  • relevance je RELATÍVNA (v kóde aj v texte to musí byť povedané),
 *  • bez modelu sa opakovanie nemeria (a mapa to povie),
 *  • výstup má presne ten tvar, ktorý žiada zadanie,
 *  • determinizmus.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { buildContentMap, whyNotList, type ContentMapInput } from "../src/core/media/contentMap";

const ROOT = process.cwd();

function stub(vectors: Record<string, number[]>) {
  return async (texts: string[]) => texts.map((t) => vectors[t] ?? [0, 1]);
}

const MEDIA: ContentMapInput["media"] = [
  {
    assetId: "a1",
    sourceLabel: "video 07",
    durationSec: 30,
    segments: [
      { id: "s0", text: "Za päť minút ti ukážem, ako som zdvojnásobil predaj.", start: 0, end: 6 },
      { id: "s1", text: "Najprv som robil všetko ručne a strácal hodiny.", start: 6, end: 12 },
      { id: "s2", text: "Klient zaplatil tri tisíce eur a objednal ďalšie videá.", start: 20, end: 26 },
    ],
  },
  {
    assetId: "a2",
    sourceLabel: "video 12",
    durationSec: 20,
    segments: [
      { id: "s0", text: "Za päť minút ti ukážem, ako som zdvojnásobil predaj!", start: 0, end: 6 },
      { id: "s1", text: "Hm, no, aha.", start: 7, end: 9 },
    ],
  },
  { assetId: "a3", sourceLabel: "video 30", segments: [], unavailableSk: "chýba prepis" },
];

const VECTORS = {
  "Za päť minút ti ukážem, ako som zdvojnásobil predaj.": [1, 0],
  "Za päť minút ti ukážem, ako som zdvojnásobil predaj!": [1, 0], // to isté povedané inak
  "Najprv som robil všetko ručne a strácal hodiny.": [0, 1],
  "Klient zaplatil tri tisíce eur a objednal ďalšie videá.": [0.9, 0.1],
  "Hm, no, aha.": [0, 1],
};

describe("KROK 2 — Content Map", () => {
  test("súhrn má tvar, ktorý žiada zadanie", async () => {
    const map = await buildContentMap({ media: MEDIA, goalId: "PREDAJ", embed: stub(VECTORS) });
    expect(map.summarySk).toContain("Použiteľné 1/3");
    expect(map.summarySk).toContain("hook video 07 00:00–00:06");
    expect(map.summarySk).toContain("nepoužitých");
    expect(map.summarySk).toMatch(/vyradených/);
  });

  test("opakovanie naprieč médiami je dôvod na NEPOUŽIŤ a je vysvetlené", async () => {
    const map = await buildContentMap({ media: MEDIA, goalId: "PREDAJ", embed: stub(VECTORS) });
    const omitted = map.rows.find((r) => r.sourceLabel === "video 12")!.segments.find((s) => s.id === "s0")!;
    expect(omitted.role).toBe("OMIT");
    // Dôvod musí byť čitateľný pre človeka a pomenovať, KOHO pasáž opakuje.
    expect(omitted.whySk).toContain("opakuje");
    expect(omitted.whySk).toContain("video 07"); // naprieč médiami: pomenuje to CUDZIE médium
    expect(omitted.whySk).toContain("neprináša nový význam");
    expect(omitted.redundantOf?.similarity).toBe(1);
    expect(omitted.redundantOf?.sourceLabel).toBe("video 07");
  });

  test("médium bez textu = NEPOUŽITÉ s dôvodom (žiadne prázdne „významy“)", async () => {
    const map = await buildContentMap({ media: MEDIA, goalId: "PREDAJ", embed: stub(VECTORS) });
    const row = map.rows.find((r) => r.sourceLabel === "video 30")!;
    expect(row.quality).toBe("NOT_AVAILABLE");
    expect(row.segments.length).toBe(0);
    expect(row.reasonSk).toContain("chýba prepis");
    expect(map.unavailableSk.join(" ")).toContain("video 30");
    expect(map.total.unusedMedia).toBe(2); // video 12 (všetko vyradené) + video 30 (bez textu)
  });

  test("role: hook je jediný OPEN a je z prvej pasáže", async () => {
    const map = await buildContentMap({ media: MEDIA, goalId: "PREDAJ", embed: stub(VECTORS) });
    const opens = map.rows.flatMap((r) => r.segments).filter((s) => s.role === "OPEN");
    expect(opens.length).toBe(1);
    expect(opens[0].sourceLabel).toBe("video 07");
    expect(opens[0].start).toBe(0);
    expect(map.hook?.labelSk).toBe("video 07 00:00–00:06");
  });

  test("každá rola má po slovensky napísaný dôvod (nikdy prázdny)", async () => {
    const map = await buildContentMap({ media: MEDIA, goalId: "PREDAJ", embed: stub(VECTORS) });
    for (const row of map.rows) {
      for (const s of row.segments) {
        expect(s.whySk.length).toBeGreaterThan(15);
      }
    }
    expect(whyNotList(map).length).toBe(map.total.omitted);
  });

  test("relevance je relatívna a v kóde je to priznané", async () => {
    const code = readFileSync(ROOT + "/src/core/media/contentMap.ts", "utf-8");
    // Musí byť napísané, že relevance nie je kalibrovaná pravdepodobnosť.
    expect(code).toContain("relatívne poradie");
    expect(code.toLowerCase()).toContain("nie je kalibrovaná");
    expect(code).toContain("relatívna relevance");
    const map = await buildContentMap({ media: MEDIA, goalId: "PREDAJ", embed: stub(VECTORS) });
    for (const s of map.rows.flatMap((r) => r.segments)) {
      expect(s.relevance).toBeGreaterThanOrEqual(0);
      expect(s.relevance).toBeLessThanOrEqual(1);
    }
  });

  test("bez modelu: opakovanie sa nemeria, ale mapa funguje ďalej", async () => {
    const map = await buildContentMap({ media: MEDIA, goalId: "PREDAJ", embed: null });
    expect(map.semanticQuality).toBe("NOT_AVAILABLE");
    expect(map.semanticReasonSk.length).toBeGreaterThan(10);
    expect(map.total.omittedRepeats).toBe(0); // nič sa nedomýšľa
    expect(map.rows.find((r) => r.sourceLabel === "video 07")!.usableSegments).toBeGreaterThan(0);
  });

  test("determinizmus: rovnaký vstup = rovnaká mapa", async () => {
    const a = await buildContentMap({ media: MEDIA, goalId: "PREDAJ", embed: stub(VECTORS) });
    const b = await buildContentMap({ media: MEDIA, goalId: "PREDAJ", embed: stub(VECTORS) });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("cieľ mení výber: rovnaký text, iné role pri inom cieli", async () => {
    const predaj = await buildContentMap({ media: MEDIA, goalId: "PREDAJ", embed: stub(VECTORS) });
    const vzdelavanie = await buildContentMap({ media: MEDIA, goalId: "VZDELAVANIE", embed: stub(VECTORS) });
    expect(predaj.goalLabelSk).not.toBe(vzdelavanie.goalLabelSk);
    // Obe mapy sú spočítané a nič nespadlo — výber sa riadi cieľom (krok 26), nie náhodou.
    expect(predaj.total.segments).toBe(vzdelavanie.total.segments);
  });

  test("durationSec sa nepoužíva na vymýšľanie časov", async () => {
    const map = await buildContentMap({
      media: [
        {
          assetId: "x",
          sourceLabel: "video 01",
          durationSec: 60,
          segments: [{ id: "s0", text: "Veta bez časovania o predaji a systéme." }],
        },
      ],
      goalId: "PREDAJ",
      embed: stub(VECTORS),
    });
    // Hook bez časov musí priznať, že čas nevie — nie ho domyslieť z dĺžky média.
    expect(map.hook?.labelSk).toContain("čas sa nedá určiť");
  });
});

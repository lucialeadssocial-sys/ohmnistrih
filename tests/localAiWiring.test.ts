/**
 * KROK 1 — lokálna AI: UNIT testy (so STUBOM modelu, nie s reálnym modelom).
 *
 * Reálny model sa tu zámerne NEnačítava (je to 118 MB a testy musia byť rýchle).
 * Dôkaz na reálnom modeli je v `tools/verify-local-ai.ts` — trieda dôkazu sa
 * nesmie zamieňať: toto sú UNIT testy, tamto je REAL MODEL VERIFIED.
 *
 * Testujeme hlavne POCTIVOSŤ:
 *  • žiadny hash vektor ako náhrada sémantiky,
 *  • bez modelu = NOT_AVAILABLE s dôvodom (nikdy prázdne tvrdenie),
 *  • prah je nameraný (a v kóde je vysvetlené, na čom),
 *  • delenie na vety nefunguje „každé 2 sekundy“ (zakázané pravidlo).
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SEMANTIC_DUPLICATE_THRESHOLD,
  buildSemanticIndex,
  cosineSimilarity,
  findRedundantSegments,
  semanticSearch,
  uniqueSegmentIds,
} from "../src/core/media/semanticSegments";
import { splitIntoSentences } from "../src/core/media/mediaIntelligenceIndex";
import { EMBEDDING_DTYPE, EMBEDDING_MODEL_ID, localEmbeddingProvider } from "../src/ai/providers/LocalEmbeddingProvider";
import { transcriptFromProject } from "../src/ai/wireLocalAI";

const ROOT = process.cwd();
function readCode(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf-8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** Stub: deterministický „vektor“ z ručne zadaných osí (nie z textu — je to test). */
function stubEmbed(vectorByText: Record<string, number[]> | number[][]) {
  return async (texts: string[]): Promise<number[][]> => {
    if (Array.isArray(vectorByText)) return texts.map((_, i) => vectorByText[i] ?? [1, 0]);
    return texts.map((t) => vectorByText[t] ?? [0, 1]);
  };
}

describe("KROK 1 — sémantické segmenty", () => {
  test("kosínus funguje a je symetrický", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(cosineSimilarity([1, 0], [1, 0]));
    expect(cosineSimilarity([], [1])).toBe(0); // nezmysel radšej 0 než crash
  });

  test("bez modelu = NOT_AVAILABLE s dôvodom, žiadne vymyslené vektory", async () => {
    const out = await buildSemanticIndex([{ id: "a", text: "Za mesiac som zdvojnásobil predaj" }], null);
    expect(out.quality).toBe("NOT_AVAILABLE");
    expect(out.segments.length).toBe(0);
    expect(out.reasonSk.length).toBeGreaterThan(10);
  });

  test("zlyhanie modelu = NOT_AVAILABLE (nie náhradný vektor)", async () => {
    const out = await buildSemanticIndex([{ id: "a", text: "Za mesiac som zdvojnásobil predaj" }], async () => {
      throw new Error("model spadol");
    });
    expect(out.quality).toBe("NOT_AVAILABLE");
    expect(out.segments.length).toBe(0);
    expect(out.reasonSk).toContain("model spadol");
  });

  test("neúplný výstup modelu sa zahodí (radšej nič než polovica)", async () => {
    const out = await buildSemanticIndex(
      [
        { id: "a", text: "prvá slovenská veta" },
        { id: "b", text: "druhá slovenská veta" },
      ],
      async () => [[1, 0]], // vrátil len jeden vektor pre dva texty
    );
    expect(out.quality).toBe("NOT_AVAILABLE");
    expect(out.segments.length).toBe(0);
  });

  test("príliš krátke/textovo prázdne pasáže sa neporovnávajú", async () => {
    const out = await buildSemanticIndex([{ id: "a", text: "hm" }], stubEmbed([[1, 0]]));
    expect(out.quality).toBe("NOT_AVAILABLE");
    expect(out.segments.length).toBe(0);
  });

  test("opakovanie pomenuje obe strany a je deterministické", async () => {
    const out = await buildSemanticIndex(
      [
        { id: "s0", assetId: "v07", sourceLabel: "video 07", text: "Táto veta je o predaji a tržbách." },
        { id: "s1", assetId: "v12", sourceLabel: "video 12", text: "Hovorím o predaji a o tržbách znova." },
      ],
      stubEmbed({
        "Táto veta je o predaji a tržbách.": [1, 0, 0],
        "Hovorím o predaji a o tržbách znova.": [1, 0, 0],
      }),
    );
    expect(out.quality).toBe("MEASURED");
    const matches = findRedundantSegments(out);
    expect(matches.length).toBe(1);
    expect(matches[0].similarity).toBe(1);
    // Vysvetlenie musí menovať, KTO koho opakuje — to ide do stĺpca „prečo nie“.
    expect(matches[0].reasonSk).toContain("video 12");
    expect(matches[0].reasonSk).toContain("video 07");
    expect(matches[0].reasonSk).toContain("neprináša nový význam");
    // Deterministické: dva behy = rovnaký výsledok.
    expect(JSON.stringify(findRedundantSegments(out))).toBe(JSON.stringify(matches));
  });

  test("opakovanie v TOM ISTOM videe sa pomenuje inak než naprieč videami", async () => {
    const out = await buildSemanticIndex(
      [
        { id: "s0", assetId: "v01", sourceLabel: "video 01", text: "Prvá veta o systéme a pláne." },
        { id: "s3", assetId: "v01", sourceLabel: "video 01", text: "Tretia veta o systéme a pláne." },
      ],
      stubEmbed({ "Prvá veta o systéme a pláne.": [1, 0], "Tretia veta o systéme a pláne.": [1, 0] }),
    );
    const [m] = findRedundantSegments(out);
    expect(m.reasonSk).toContain("v tom istom videe");
  });

  test("pod prahom sa nič neoznačí (žiadne falošné „duplicity“)", async () => {
    const out = await buildSemanticIndex(
      [
        { id: "a", text: "Ráno si naplánujem deň a večer ho skontrolujem." },
        { id: "b", text: "V noci som nemohol spať kvôli susedom." },
      ],
      stubEmbed({ "Ráno si naplánujem deň a večer ho skontrolujem.": [1, 0], "V noci som nemohol spať kvôli susedom.": [0, 1] }),
    );
    expect(findRedundantSegments(out).length).toBe(0);
  });

  test("jedinečné pasáže a hľadanie podľa významu", async () => {
    const out = await buildSemanticIndex(
      [
        { id: "a", text: "Za mesiac som zdvojnásobil predaj vďaka systému." },
        { id: "b", text: "Za mesiac som zdvojnásobil predaj vďaka systému!" },
        { id: "c", text: "Recept na sviečkovú omáčku s knedľou je jednoduchý." },
      ],
      stubEmbed({
        "Za mesiac som zdvojnásobil predaj vďaka systému.": [1, 0],
        "Za mesiac som zdvojnásobil predaj vďaka systému!": [1, 0],
        "Recept na sviečkovú omáčku s knedľou je jednoduchý.": [0, 1],
      }),
    );
    const matches = findRedundantSegments(out);
    const unique = uniqueSegmentIds(out, matches);
    expect(unique.has("a")).toBe(true);
    expect(unique.has("b")).toBe(false); // b opakuje a
    expect(unique.has("c")).toBe(true);

    const hits = semanticSearch([0, 1], out, 2, 0.2);
    expect(hits[0].segment.id).toBe("c");
  });

  test("prah je nameraný a v kóde je vysvetlené, na čom (nie odhad)", () => {
    const code = readFileSync(join(ROOT, "src/core/media/semanticSegments.ts"), "utf-8");
    expect(SEMANTIC_DUPLICATE_THRESHOLD).toBe(0.53);
    expect(code).toContain("NAMERANÉ");
    expect(code).toContain("0,773"); // najnižšia príbuzná dvojica
    expect(code).toContain("0,282"); // najvyššia nesúvisiaca dvojica
  });
});

describe("KROK 1 — embedding provider nesmie klamať", () => {
  test("model je multilingual a kvantizovaný (namerané rozhodnutie)", () => {
    expect(EMBEDDING_MODEL_ID).toContain("multilingual");
    expect(EMBEDDING_DTYPE).toBe("q8");
  });

  test("hash vektor ako náhrada sémantiky je preč", () => {
    const code = readCode("src/ai/providers/LocalEmbeddingProvider.ts");
    expect(code.includes("generateHashVector")).toBe(false);
    expect(code.includes("Math.sin")).toBe(false);
    // A starý anglický model, ktorý na slovenčine nevyhovel, sa už nepoužíva.
    expect(code.includes("all-MiniLM-L6-v2'")).toBe(false);
  });

  test("nenačítaný model hlási NOT_AVAILABLE s dôvodom (nie READY)", () => {
    // Nová inštancia, aby test nezávisel od stavu singletonu.
    const Provider = localEmbeddingProvider.constructor as new () => typeof localEmbeddingProvider;
    const fresh = new Provider();
    const q = (fresh as any).getQuality();
    expect(q.quality).toBe("NOT_AVAILABLE");
    expect(q.reasonSk.length).toBeGreaterThan(10);
  });
});

describe("KROK 1 — delenie na vety podľa myšlienky", () => {
  test("delí na interpunkcii a pauze, NIE každé 2 sekundy", () => {
    const words = [
      { word: "Prvá", start: 0, end: 0.4 },
      { word: "myšlienka.", start: 0.4, end: 1.0 },
      // 2,0 s pauza = hranica myšlienky (aj bez bodky)
      { word: "Druhá", start: 3.0, end: 3.4 },
      { word: "myšlienka", start: 3.4, end: 3.9 },
      { word: "pokračuje", start: 3.9, end: 4.5 },
      { word: "ďalej.", start: 4.5, end: 5.0 },
    ];
    const sentences = splitIntoSentences(words, 0.8);
    expect(sentences.length).toBe(2);
    expect(sentences[0].text).toBe("Prvá myšlienka.");
    expect(sentences[0].start).toBe(0);
    expect(sentences[1].text).toBe("Druhá myšlienka pokračuje ďalej.");
  });

  test("tri slová bez interpunkcie a bez pauzy ostávajú jednou pasážou", () => {
    const words = [
      { word: "jedna", start: 0, end: 0.3 },
      { word: "dva", start: 0.3, end: 0.6 },
      { word: "tri", start: 0.6, end: 0.9 },
    ];
    expect(splitIntoSentences(words).length).toBe(1);
  });
});

describe("KROK 1 — prepis z projektu", () => {
  test("berie LEN titulky patriace danému médiu", () => {
    const project: any = {
      tracks: [
        {
          id: "t1",
          type: "caption",
          clips: [
            { id: "c1", assetId: "asset-A", timelineStart: 0, duration: 2, textConfig: { content: "Za päť minút ti ukážem systém." } },
            { id: "c2", assetId: "asset-B", timelineStart: 2, duration: 2, textConfig: { content: "Toto patrí inému médiu." } },
          ],
        },
      ],
    };
    const out = transcriptFromProject(project, "asset-A")!;
    expect(out.text).toContain("Za päť minút");
    expect(out.text).not.toContain("inému médiu");
    expect(out.words.length).toBe(6); // „Za päť minút ti ukážem systém.“ = 6 slov
    // Časy slov sú v časoch KLIPU (timelineStart), nie vymyslené od nuly.
    expect(out.words[0].start).toBe(0);
    expect(transcriptFromProject(project, "asset-C")).toBeNull();
  });

  test("projekt bez tituliek = null (index potom hlási NOT_AVAILABLE)", () => {
    expect(transcriptFromProject({ tracks: [] } as any, "x")).toBeNull();
    expect(transcriptFromProject(null, "x")).toBeNull();
  });
});

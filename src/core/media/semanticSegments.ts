/**
 * KROK 1 — SÉMANTICKÉ SEGMENTY (reálne embeddings, žiadny hash)
 *
 * Na čo to je: OmniStrih musí vedieť povedať **prečo** niečo nepoužije —
 * napr. „video 12 opakuje 07, neprináša nový význam“. To sa nedá zmerať
 * počtom slov; treba porovnať **význam**. Tento modul je most medzi
 * lokálnym embedding modelom a rozhodovaním Directora.
 *
 * POCTIVOSŤ:
 *  • Embedding model nie je sémantika „zadarmo“. Dva modely sme naozaj zmerali
 *    na slovenských vetách (viď `SEMANTIC_DUPLICATE_THRESHOLD`) a ten, ktorý
 *    na slovenčine nefungoval, sme **nepoužili**.
 *  • Ak model nie je k dispozícii, tento modul **nič nevymyslí**: vráti
 *    `quality: 'NOT_AVAILABLE'` a dôvod. Nikdy nevyrobí „hash vektor“, ktorý by
 *    sa tváril ako význam.
 *  • Všetko je deterministické: rovnaké vety a rovnaký model = rovnaké čísla.
 */

/** Vstup: textová jednotka (veta/pasáž) z jedného média. */
export interface SemanticSegmentInput {
  /** Identifikátor v rámci média (napr. index vety). */
  id: string;
  /** Médium, z ktorého segment je (assetId) — pre Content Map naprieč médiami. */
  assetId?: string;
  /** Zdroj pre človeka (napr. „video 04“). */
  sourceLabel?: string;
  text: string;
  /** Čas v médiu, ak je známy (pre „hook video 04 00:08–00:14“). */
  start?: number;
  end?: number;
}

/** Funkcia, ktorá prevedie texty na vektory. V produkcii reálny model, v testoch stub. */
export type SemanticEmbeddingFn = (texts: string[]) => Promise<number[][]>;

export interface SemanticIndex {
  segments: (SemanticSegmentInput & { vector: number[] })[];
  dimensions: number;
  quality: SemanticEmbeddingQuality;
  /** Dôvod, keď sa embedovať nedalo (nikdy nie prázdny pri NOT_AVAILABLE). */
  reasonSk: string;
}

export type SemanticEmbeddingQuality = 'MEASURED' | 'NOT_AVAILABLE';

/**
 * Prah, od ktorého dve pasáže považujeme za **to isté povedané inak**.
 *
 * NAMERANÉ (nie odhadnuté) na slovenských vetách, model
 * `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (dtype q8):
 *   • príbuzné dvojice (parafráza):  priemer 0,802 · najnižšia 0,773
 *   • nesúvisiace dvojice:           priemer 0,145 · najvyššia 0,282
 *   → odstup 0,491, stred = 0,53.
 *
 * Malý anglický model `all-MiniLM-L6-v2` (23 MB) sme zamietli: na slovenčine
 * sa príbuzné (0,540) a nesúvisiace (0,556) dvojice PREKRÝVALI — nedal sa nájsť
 * prah, ktorý by ich oddelil. Preto sa v appke používa multilingual model.
 */
export const SEMANTIC_DUPLICATE_THRESHOLD = 0.53;

/** Kosínus dvoch vektorov (vektory sú normalizované, preto stačí skalárny súčin). */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += a[i] * b[i];
  return Number(Math.max(-1, Math.min(1, dot)).toFixed(4));
}

/**
 * Vypočíta vektory pre segmenty. Pri akejkoľvek chybe (model sa nenacítal,
 * OOM, chýbajúce pole) vráti NOT_AVAILABLE — nikdy náhradu, ktorá vyzerá ako meranie.
 */
export async function buildSemanticIndex(
  segments: SemanticSegmentInput[],
  embed: SemanticEmbeddingFn | null,
  minTextLength = 12,
): Promise<SemanticIndex> {
  const usable = segments.filter((s) => s.text && s.text.trim().length >= minTextLength);
  if (usable.length === 0) {
    return {
      segments: [],
      dimensions: 0,
      quality: 'NOT_AVAILABLE',
      reasonSk: 'Nie sú k dispozícii žiadne textové pasáže na porovnanie (chýba prepis).',
    };
  }
  if (!embed) {
    return {
      segments: [],
      dimensions: 0,
      quality: 'NOT_AVAILABLE',
      reasonSk: 'Lokálny embedding model nie je pripojený — porovnanie významu sa nemeria.',
    };
  }

  try {
    const vectors = await embed(usable.map((s) => s.text));
    if (!Array.isArray(vectors) || vectors.length !== usable.length || vectors.some((v) => !v?.length)) {
      return {
        segments: [],
        dimensions: 0,
        quality: 'NOT_AVAILABLE',
        reasonSk: 'Embedding model vrátil neúplné údaje — výsledok sa nepoužije.',
      };
    }
    return {
      segments: usable.map((s, i) => ({ ...s, vector: vectors[i] })),
      dimensions: vectors[0].length,
      quality: 'MEASURED',
      reasonSk: '',
    };
  } catch (e: any) {
    return {
      segments: [],
      dimensions: 0,
      quality: 'NOT_AVAILABLE',
      reasonSk: `Embedding model zlyhal (${String(e?.message ?? e).slice(0, 120)}) — nič sa nedomýšľa.`,
    };
  }
}

export interface SemanticMatch {
  a: SemanticSegmentInput;
  b: SemanticSegmentInput;
  similarity: number;
  /** Ľudské vysvetlenie — presne to, čo ide do stĺpca WHY NOT. */
  reasonSk: string;
}

/**
 * Nájde pasáže, ktoré hovoria to isté. Vracia **staršiu** pasáž ako `a`
 * (tú, ktorá bola v poradí prvá), aby výstup znel prirodzene:
 * „video 12 opakuje 07, neprináša nový význam“.
 */
export function findRedundantSegments(
  index: SemanticIndex,
  threshold = SEMANTIC_DUPLICATE_THRESHOLD,
): SemanticMatch[] {
  if (index.quality !== 'MEASURED') return [];
  const out: SemanticMatch[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < index.segments.length; i += 1) {
    for (let j = i + 1; j < index.segments.length; j += 1) {
      const a = index.segments[i];
      const b = index.segments[j];
      const similarity = cosineSimilarity(a.vector, b.vector);
      if (similarity < threshold) continue;
      // Každý segment hlásime ako opakovanie len raz (najpodobnejší pár).
      if (seen.has(b.id)) continue;
      const key = `${a.id}->${b.id}`;
      if (seen.has(key)) continue;
      seen.add(b.id);
      seen.add(key);
      const sameMedia = Boolean(a.assetId && b.assetId && a.assetId === b.assetId);
      const pct = (similarity * 100).toFixed(0);
      out.push({
        a,
        b,
        similarity,
        // Dve rôzne vety v TOM ISTOM médiu a veta v INOM médiu sú dve rôzne
        // zistenia — a musia sa aj inak pomenovať, inak je výstup mätúci
        // („video 01 opakuje video 01“).
        reasonSk: sameMedia
          ? `${b.sourceLabel ?? b.id}: ${b.id} opakuje ${a.id} v tom istom videe ` +
            `(zhoda významu ${pct} %) — neprináša nový význam.`
          : `${b.sourceLabel ?? b.id} opakuje ${a.sourceLabel ?? a.id} ` +
            `(zhoda významu ${pct} %) — neprináša nový význam.`,
      });
    }
  }
  return out;
}

export interface SemanticSearchHit {
  segment: SemanticSegmentInput;
  similarity: number;
}

/**
 * Hľadanie podľa VÝZNAMU (nie podľa doslovných slov). Vracia prázdno, ak index
 * nemá namerané vektory — volajúci sa musí rozhodnúť, čo povie používateľovi.
 */
export function semanticSearch(
  queryVector: number[],
  index: SemanticIndex,
  topK = 5,
  minSimilarity = 0.25,
): SemanticSearchHit[] {
  if (index.quality !== 'MEASURED' || !queryVector?.length) return [];
  return index.segments
    .map((segment) => ({ segment, similarity: cosineSimilarity(queryVector, segment.vector) }))
    .filter((hit) => hit.similarity >= minSimilarity)
    .sort((x, y) => y.similarity - x.similarity)
    .slice(0, topK);
}

/**
 * Zvýrazní, ktoré segmenty sú **jedinečné** (nepoznačené ako opakovanie) —
 * podklad pre stĺpec „Použitie“ v Content Map. Nič sa nedomýšľa: bez merania
 * vráti prázdno a volajúci dostane NOT_AVAILABLE.
 */
export function uniqueSegmentIds(index: SemanticIndex, matches: SemanticMatch[]): Set<string> {
  const repeated = new Set(matches.map((m) => m.b.id));
  const out = new Set<string>();
  if (index.quality !== 'MEASURED') return out;
  for (const segment of index.segments) {
    if (!repeated.has(segment.id)) out.add(segment.id);
  }
  return out;
}

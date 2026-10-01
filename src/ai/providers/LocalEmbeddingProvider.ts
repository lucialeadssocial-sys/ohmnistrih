/**
 * Local Vector Embedding Provider
 *
 * Sémantické embeddingy (384 dimenzií) pre porovnávanie VÝZNAMU textu.
 * Beží 100 % lokálne, bez API kľúčov.
 *
 * ── KROK 1: čo sa tu zmenilo a prečo ────────────────────────────────────────
 *
 * 1) MODEL: pôvodne `Xenova/all-MiniLM-L6-v2` (23 MB, trénovaný na angličtine).
 *    **Zmerali sme ho na slovenských vetách a NEVYHOVUJE** — príbuzné dvojice
 *    dosahovali 0,540, nesúvisiace 0,556, teda sa PREKRÝVALI a nedal sa nájsť
 *    prah, ktorý by ich oddelil. Používame preto
 *    `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (q8), kde je odstup 0,491
 *    (príbuzné ≥ 0,773, nesúvisiace ≤ 0,282). Presné čísla: `semanticSegments.ts`.
 *
 * 2) KVANTIZÁCIA `dtype: 'q8'` je POVINNÁ, nie optimalizácia. Model v plnej
 *    presnosti (fp32) bol v prostredí s 2 GB RAM **zabitý (OOM)** — kvantizovaný
 *    sa načíta za ~2,4 s a funguje.
 *
 * 3) FAKE FALLBACK ZMAZANÝ: pôvodne sa pri zlyhaní modelu vygeneroval „hash
 *    vektor“ z `Math.sin(charCode)`, status sa nastavil na READY a výsledok sa
 *    vydával za sémantiku. To je presne ten typ nepravdy, ktorý projekt zakazuje:
 *    hash nič neznamená, a predsa by rozhodoval o tom, čo je „duplicita“.
 *    Dnes: model sa buď načíta (a meria sa), alebo je stav UNAVAILABLE
 *    s dôvodom a `process()` vyhodí chybu — volajúci to musí priznať.
 *
 * Beží v prehliadači (Transformers.js, WASM/WebGPU) aj v Node/Bun (ten istý kód).
 */

import { AIProvider, ModelProgress, EmbeddingResult } from '../types/ai';

/** Model, ktorý sme na slovenčine naozaj zmerali a ktorý vyhovuje. */
export const EMBEDDING_MODEL_ID = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
/** Kvantizácia. Bez nej model v 2 GB prostredí padá na OOM (merané). */
export const EMBEDDING_DTYPE = 'q8' as const;

export type EmbeddingQuality = 'MEASURED' | 'NOT_AVAILABLE';

export class LocalEmbeddingProvider implements AIProvider<string, EmbeddingResult> {
  public id = 'local_text_embedding_multilingual_minilm';
  public name = 'Local Multilingual Text Embedder (semantic)';

  private status: ModelProgress = {
    status: 'NOT_LOADED',
    progress: 0,
    modelName: EMBEDDING_MODEL_ID,
  };

  private listeners: Set<(status: ModelProgress) => void> = new Set();
  private pipelineInstance: any = null;
  /** Prečo sa model nenačítal — aby to UI mohlo povedať nahlas. */
  private lastError: string = '';

  public getStatus(): ModelProgress {
    return { ...this.status };
  }

  /** Poctivý stav pre volajúcich: meria sa, alebo nie? */
  public getQuality(): { quality: EmbeddingQuality; reasonSk: string } {
    if (this.pipelineInstance && this.status.status !== 'ERROR') {
      return { quality: 'MEASURED', reasonSk: '' };
    }
    if (this.status.status === 'ERROR' || this.lastError) {
      return {
        quality: 'NOT_AVAILABLE',
        reasonSk: `Lokálny embedding model sa nepodarilo načítať${this.lastError ? ` (${this.lastError})` : ''}. Porovnanie významu sa nemeria — nič sa nedomýšľa.`,
      };
    }
    return {
      quality: 'NOT_AVAILABLE',
      reasonSk: 'Lokálny embedding model ešte nie je načítaný. Porovnanie významu sa nemeria.',
    };
  }

  public subscribe(listener: (status: ModelProgress) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateStatus(statusPartial: Partial<ModelProgress>): void {
    this.status = { ...this.status, ...statusPartial };
    this.listeners.forEach((l) => l(this.getStatus()));
  }

  /**
   * Načítaný = držíme inštanciu modelu. NESMIEME sa spoliehať na text stavu:
   * po prvej dávke je stav `COMPLETE` a pôvodná kontrola
   * (`status === READY`) preto spustila **ďalšie načítanie modelu** — v prostredí
   * s 2 GB RAM to skončilo OOM (odhalil to `tools/verify-local-ai.ts`).
   */
  private isLoaded(): boolean {
    return this.pipelineInstance !== null;
  }

  public async loadModel(): Promise<void> {
    if (this.isLoaded() || this.status.status === 'LOADING') return;

    this.updateStatus({
      status: 'LOADING',
      progress: 10,
      message: 'Načítavam sémantický model (prvé načítanie ~118 MB, potom z cache)…',
    });

    try {
      const { pipeline } = await import('@huggingface/transformers');
      // dtype 'q8' je nutné: fp32 verzia modelu padá na OOM v 2 GB prostredí.
      this.pipelineInstance = await pipeline('feature-extraction', EMBEDDING_MODEL_ID, {
        dtype: EMBEDDING_DTYPE,
      });
      this.lastError = '';
      this.updateStatus({ status: 'READY', progress: 100, message: 'Sémantický model pripravený' });
    } catch (e: any) {
      // ŽIADNY náhradný „hash vektor“. Buď model máme, alebo je nedostupný.
      this.pipelineInstance = null;
      this.lastError = String(e?.message ?? e).slice(0, 160);
      this.updateStatus({
        status: 'ERROR',
        progress: 0,
        error: `Sémantický model sa nepodarilo načítať: ${this.lastError}`,
        message: 'Nedostupné — porovnanie významu sa nemeria',
      });
    }
  }

  public async unloadModel(): Promise<void> {
    this.pipelineInstance = null;
    this.updateStatus({ status: 'NOT_LOADED', progress: 0 });
  }

  public cancel(): void {
    if (this.status.status === 'PROCESSING') {
      this.updateStatus({ status: 'READY', progress: 100 });
    }
  }

  public async retry(): Promise<void> {
    this.lastError = '';
    await this.loadModel();
  }

  /** Jeden text → vektor. Vyhodí chybu, ak model nie je k dispozícii. */
  public async process(text: string): Promise<EmbeddingResult> {
    const [vector] = await this.embedBatch([text]);
    if (!vector) {
      throw new Error(this.getQuality().reasonSk);
    }
    return { vector, dimensions: vector.length };
  }

  /**
   * Dávkové embedovanie — jeden prechod modelom pre viac textov.
   * Rovnaký vstup = rovnaký výstup (deterministické).
   */
  public async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (!this.isLoaded()) {
      await this.loadModel();
    }
    if (!this.pipelineInstance) {
      throw new Error(this.getQuality().reasonSk);
    }

    this.updateStatus({ status: 'PROCESSING', progress: 30, message: `Počítam ${texts.length} vektorov…` });
    try {
      const output = await this.pipelineInstance(texts, { pooling: 'mean', normalize: true });
      // Transformers.js vracia ploché pole (n × dim) pre dávku aj pre jednu vetu.
      const dim = Number(output.dims?.[output.dims.length - 1] ?? 0);
      // Ochrana proti nekonečnej slučke: pri dim = 0 by `i += 0` zacyklilo
      // a naplnilo pamäť. Radšej chyba než tiché zacyklenie.
      if (!(dim > 0)) {
        throw new Error(`Model vrátil nečitateľný tvar výstupu (dims=${JSON.stringify(output.dims)}).`);
      }
      const flat = Array.from(output.data as Float32Array);
      const vectors: number[][] = [];
      for (let i = 0; i < flat.length; i += dim) {
        vectors.push(flat.slice(i, i + dim).map((v) => Number(v.toFixed(6))));
      }
      this.updateStatus({ status: 'COMPLETE', progress: 100, message: `${vectors.length} vektorov hotových` });
      return vectors;
    } catch (e: any) {
      this.updateStatus({
        status: 'ERROR',
        progress: 0,
        error: `Výpočet vektora zlyhal: ${String(e?.message ?? e).slice(0, 140)}`,
      });
      throw e;
    }
  }
}

export const localEmbeddingProvider = new LocalEmbeddingProvider();

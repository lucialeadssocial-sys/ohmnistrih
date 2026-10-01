/**
 * KROK 1 — NAPOJENIE EXISTUJÚCEJ LOKÁLNEJ AI DO ANALÝZY MÉDIÍ
 *
 * Prečo takto: `src/core/media/mediaIntelligenceIndex.ts` je jadro a **nesmie**
 * závisieť od AI vrstvy (inak by sa jadro nedalo testovať ani spustiť v Node).
 * Preto jadro vystavuje dva „vstrekovacie“ body (`setEmbeddingProvider`,
 * `setTranscriptProvider`) a tento modul ich naplní **skutočnými** lokálnymi
 * zdrojmi, ktoré už v projekte existujú:
 *
 *   • embeddingy → `localEmbeddingProvider` (multilingual MiniLM, q8)
 *     — porovnanie VÝZNAMU viet (pre Content Map a „prečo nie“),
 *   • prepis     → titulky z PROJEKTU (to, čo používateľ naozaj má).
 *     Automatický prepis sa pri analýze média nespúšťa (v prehliadači je to
 *     dlhý beh) — keď titulky nie sú, index poctivo vráti NOT_AVAILABLE.
 *
 * POCTIVOSŤ: tento modul **nič nevymýšľa**. Keď model nie je k dispozícii,
 * `localEmbeddingProvider.embedBatch` vyhodí chybu a `buildSemanticIndex`
 * z toho spraví `NOT_AVAILABLE` s dôvodom — nikdy náhradný „hash vektor“.
 */

import { mediaIntelligenceEngine } from '../core/media/mediaIntelligenceIndex';
import { localEmbeddingProvider } from './providers/LocalEmbeddingProvider';
import type { ProjectModel } from '../core/types/project';
import type { MediaAsset } from '../core/types/project';
import type { SemanticEmbeddingFn } from '../core/media/semanticSegments';

export interface LocalAIWiringReport {
  embeddingModel: string;
  embeddingQuality: 'MEASURED' | 'NOT_AVAILABLE';
  reasonSk: string;
  transcriptSource: string;
  wiredAt: number;
}

/**
 * Titulky projektu ako zdroj prepisu pre dané médium.
 * Hľadáme textové klipy, ktoré patria k assetu — presne tie, ktoré používateľ
 * vidí a môže upraviť. Žiadny odhad, žiadne vymyslené slová.
 */
export function transcriptFromProject(
  project: ProjectModel | null,
  assetId: string,
): { text: string; words: { word: string; start: number; end: number; confidence: number }[] } | null {
  if (!project?.tracks?.length) return null;

  const words: { word: string; start: number; end: number; confidence: number }[] = [];

  for (const track of project.tracks) {
    for (const clip of track.clips ?? []) {
      const sourceAssetId = clip.assetId;
      const text = clip.textConfig?.content ?? '';
      if (!text.trim() || sourceAssetId !== assetId) continue;

      // Titulkový klip má na časovej osi `timelineStart` a `duration`.
      const start = Number(clip.timelineStart ?? 0);
      const end = start + Number(clip.duration ?? 1);

      // Rozdelíme text na slová a rozložíme v čase klipu rovnomerne.
      // POZOR: toto je rozloženie textu, ktorý používateľ naozaj napísal —
      // nie meranie reči. Preto `confidence: 0` (nevieme) a v indexe sa to
      // označí podľa zdroja; slúži na porovnanie VÝZNAMU, nie na strihanie.
      const parts = text.split(/\s+/).filter(Boolean);
      if (parts.length === 0) continue;
      const step = (end - start) / parts.length;
      parts.forEach((word, i) => {
        words.push({
          word,
          start: Number((start + i * step).toFixed(3)),
          end: Number((start + (i + 1) * step).toFixed(3)),
          confidence: 0,
        });
      });
    }
  }

  if (words.length === 0) return null;
  return { text: words.map((w) => w.word).join(' '), words };
}

/**
 * Napojí lokálnu AI na analýzu médií. Volá sa raz (napr. po načítaní projektu).
 * Je to jediné miesto, kde sa AI vrstva spája s jadrom — ľahko sa to hľadá a testuje.
 */
export function wireLocalAIToMediaIndex(getProject: () => ProjectModel | null): LocalAIWiringReport {
  const embed: SemanticEmbeddingFn = async (texts: string[]) => {
    // Poctivé: keď model nemáme, vyhodíme chybu. `buildSemanticIndex` z toho
    // spraví NOT_AVAILABLE s dôvodom. Žiadny fallback, ktorý by klamal.
    return localEmbeddingProvider.embedBatch(texts);
  };

  mediaIntelligenceEngine.setEmbeddingProvider(embed);
  mediaIntelligenceEngine.setTranscriptProvider(async (asset: MediaAsset) =>
    transcriptFromProject(getProject(), asset.id),
  );

  const quality = localEmbeddingProvider.getQuality();
  return {
    embeddingModel: localEmbeddingProvider.getStatus().modelName ?? '',
    embeddingQuality: quality.quality,
    reasonSk: quality.reasonSk,
    transcriptSource: 'titulky z projektu (ak existujú) — inak NOT_AVAILABLE',
    wiredAt: Date.now(),
  };
}

/** Odpojí AI (napr. keď používateľ vypne lokálnu AI) — index vráti NOT_AVAILABLE. */
export function unwireLocalAI(): void {
  mediaIntelligenceEngine.setEmbeddingProvider(null);
  mediaIntelligenceEngine.setTranscriptProvider(null);
}

/**
 * Načíta model dopredu (voliteľné). Ak zlyhá, vráti dôvod — appka ho má
 * zobraziť, nie ticho ignorovať.
 */
export async function preloadLocalEmbeddingModel(): Promise<{ ok: boolean; reasonSk: string }> {
  await localEmbeddingProvider.loadModel();
  const quality = localEmbeddingProvider.getQuality();
  return { ok: quality.quality === 'MEASURED', reasonSk: quality.reasonSk };
}

/**
 * KROK 2 — CONTENT MAP NAPRIEČ MÉDIAMI (Source | Obsah | Význam | Relevance | Použitie)
 *
 * Zadanie (binding): pri 30+ surových videách musí nástroj povedať, ktoré médium
 * je na čo použiteľné a **prečo niektoré nie** — napr. „video 12 opakuje 07,
 * neprináša nový význam“. Výstup má vyzerať takto:
 *
 *   Použiteľné 7/30; hook video 04 00:08–00:14; 12 vyradených (opakovanie/slabá
 *   pointa); 11 nepoužitých.
 *
 * POCTIVOSŤ — čo tento modul NEROBÍ:
 *  • Nevymýšľa obsah médiu, ktoré nemá text: také médium je v mape s dôvodom
 *    `unavailableSk`, nikdy s prázdnym „významom“ ani s vymyslenou pointou.
 *  • Relevance NIE JE kalibrovaná pravdepodobnosť. Je to **relatívne poradie
 *    v rámci tejto sady médií** (0–1), odvodené z existujúcej cieľovej
 *    mašinérie (`videoGoal.ts`, krok 26). V UI sa musí volať „relatívna
 *    relevance“, nie „skóre úspechu“.
 *  • Ak nie je lokálny embedding model, opakovanie sa **nemeria** (a modul to
 *    povie v `semanticQuality`); zvyšok mapy funguje ďalej.
 *  • Je to deterministické: rovnaký vstup = rovnaká mapa (žiadny `Date.now()`
 *    v obsahu, žiadny `random`).
 *
 * NENÍ to nový Director ani nový timeline model — je to **pohľad** na médiá pre
 * rozhodovanie, ktorý čerpá z existujúcej analýzy.
 */

import { VIDEO_GOALS, findMarkers, scoreSentencesForGoal, type GoalSentenceLike, type VideoGoalId } from '../style/videoGoal';
import {
  buildSemanticIndex,
  findRedundantSegments,
  type SemanticEmbeddingFn,
  type SemanticMatch,
} from './semanticSegments';

/** Použitie pasáže v zostrihu. */
export type UsageRole = 'OPEN' | 'BODY' | 'PRODUCT' | 'PROOF' | 'END' | 'OMIT';

export const USAGE_ROLE_LABELS_SK: Record<UsageRole, string> = {
  OPEN: 'OTVORENIE (hook)',
  BODY: 'TELO',
  PRODUCT: 'PRODUKT / PONUKA',
  PROOF: 'DÔKAZ',
  END: 'ZÁVER (výzva)',
  OMIT: 'NEPOUŽIŤ',
};

/**
 * Slová, ktoré nesú ponuku/produkt a dôkaz. **NIE sú to „markery cieľa“** —
 * tie má `videoGoal.ts`; toto je obsahová klasifikácia pasáže (čo v nej je),
 * nie to, čo má video dosiahnuť. Preto to ostáva tu a je to viditeľné.
 */
export const PRODUCT_MARKERS_SK = [
  'cena', 'ceny', 'eur', '€', 'kurz', 'produkt', 'služba', 'ponuka', 'balík',
  'predávam', 'predám', 'kúpiš', 'kúpiť', 'objednať', 'objednaj', 'registrácia',
  'registrovať', 'prihláška', 'prihlás', 'link', 'odkaz', 'zľava', 'akcia',
];

export const PROOF_MARKERS_SK = [
  'výsledok', 'výsledky', 'dokázal', 'podarilo', 'klient', 'klienti', 'zákazník',
  'zaplatil', 'zaplatila', 'zarobil', 'rast', 'klesol', 'stúpol', 'zdvojnásobil',
  'trojnásobil', 'percent', 'mesiacoch', 'za mesiac', 'predtým', 'teraz', 'meranie',
];

export interface ContentMapSegmentInput {
  id: string;
  text: string;
  start?: number;
  end?: number;
}

export interface ContentMapMediaInput {
  assetId: string;
  /** Označenie pre človeka („video 04“). */
  sourceLabel: string;
  durationSec?: number | null;
  segments: ContentMapSegmentInput[];
  /** Keď médium nemá text (chýba prepis/titulky), sem patrí dôvod pre človeka. */
  unavailableSk?: string;
}

export interface ContentMapInput {
  media: ContentMapMediaInput[];
  goalId: VideoGoalId;
  /** Embedding model (krok 1). Keď je `null`, opakovanie sa nemeria. */
  embed: SemanticEmbeddingFn | null;
  /**
   * Pod touto **relatívnou** relevanciou je pasáž „slabá pointa“.
   * Predvolene 0,25 — je to prah pre výber do zostrihu, nie meranie kvality;
   * v UI musí byť takto pomenovaný.
   */
  weakRelevance?: number;
}

export interface ContentMapSegment extends ContentMapSegmentInput {
  assetId: string;
  sourceLabel: string;
  role: UsageRole;
  /** Relatívna relevance 0–1 (poradie v rámci sady, nie kalibrovaná pravdepodobnosť). */
  relevance: number;
  /** Prečo práve táto rola — veta pre človeka. Nikdy prázdna. */
  whySk: string;
  /** Ak je pasáž vyradená ako opakovanie, tu je, koho opakuje. */
  redundantOf?: { assetId?: string; sourceLabel?: string; similarity: number };
}

export interface ContentMapRow {
  assetId: string;
  sourceLabel: string;
  durationSec: number | null;
  segments: ContentMapSegment[];
  usableSegments: number;
  omittedSegments: number;
  quality: 'MEASURED' | 'NOT_AVAILABLE';
  reasonSk: string;
}

export interface ContentMapHook {
  assetId: string;
  sourceLabel: string;
  text: string;
  start: number | null;
  end: number | null;
  /** Napr. „video 04 00:08–00:14“ (alebo priznanie, že čas nepoznáme). */
  labelSk: string;
}

export interface ContentMapTotals {
  media: number;
  usableMedia: number;
  unusedMedia: number;
  segments: number;
  omitted: number;
  omittedRepeats: number;
  omittedWeak: number;
  byRole: Record<UsageRole, number>;
}

export interface ContentMap {
  goalId: VideoGoalId;
  goalLabelSk: string;
  rows: ContentMapRow[];
  hook: ContentMapHook | null;
  total: ContentMapTotals;
  /** Po slovensky napísaný záver — presne to, čo ide do UI hlavičky. */
  summarySk: string;
  semanticQuality: 'MEASURED' | 'NOT_AVAILABLE';
  semanticReasonSk: string;
  /** Čo v dátach chýba (napr. médium bez prepisu) — nikdy sa nedopĺňa. */
  unavailableSk: string[];
}

function mmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function hasMarker(text: string, markers: string[]): string[] {
  return findMarkers(text, markers);
}

/** Zmení skóre vety na relatívnu relevanciu 0–1 v rámci celej sady. */
function normalise(scores: number[]): number[] {
  const max = Math.max(...scores, 0);
  const min = Math.min(...scores, 0);
  const span = max - min;
  if (span <= 0) return scores.map(() => (max > 0 ? 1 : 0));
  return scores.map((s) => Number(((s - min) / span).toFixed(3)));
}

/**
 * Postaví Content Map. Poradie pravidiel (deterministické, prvé vyhráva):
 *  1. opakovanie (sémantika)  → OMIT
 *  2. slabá pointa            → OMIT
 *  3. hook (jediný)           → OPEN
 *  4. výzva na akciu v závere → END (jediný)
 *  5. ponuka/produkt          → PRODUCT
 *  6. dôkaz                   → PROOF
 *  7. inak                    → BODY
 */
export async function buildContentMap(input: ContentMapInput): Promise<ContentMap> {
  const goal = VIDEO_GOALS[input.goalId];
  const weakRelevance = input.weakRelevance ?? 0.25;
  const unavailableSk: string[] = [];

  // ── 1. Vety pre cieľovú mašinériu (krok 26) ─────────────────────────────
  type Flat = {
    mediaIndex: number;
    segment: ContentMapSegmentInput;
    isFirst: boolean;
    isLast: boolean;
    score: number;
    reasonsSk: string[];
  };
  const flat: Flat[] = [];

  input.media.forEach((media, mediaIndex) => {
    if (media.segments.length === 0) {
      unavailableSk.push(
        `${media.sourceLabel}: ${media.unavailableSk ?? 'obsah sa nedá posúdiť — chýba text (prepis alebo titulky).'}`,
      );
      return;
    }
    const sentences: GoalSentenceLike[] = media.segments.map((s, i) => ({
      index: i,
      text: s.text,
      start: s.start ?? 0,
      end: s.end ?? 0,
      durationSec: Math.max(0, (s.end ?? 0) - (s.start ?? 0)),
      isHook: i === 0,
      isLast: i === media.segments.length - 1,
      isQuestion: /[?]$/.test(s.text.trim()),
      numberWords: findMarkers(s.text, ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']),
      isEmotional: /[!]$/.test(s.text.trim()),
      topicShift: false,
    }));
    const scored = scoreSentencesForGoal(sentences, goal, {
      durationSec: media.durationSec ?? undefined,
    });
    const byIndex = new Map(scored.map((s) => [s.sentenceIndex, s]));
    media.segments.forEach((segment, i) => {
      const fit = byIndex.get(i);
      flat.push({
        mediaIndex,
        segment,
        isFirst: i === 0,
        isLast: i === media.segments.length - 1,
        score: fit?.score ?? 0,
        reasonsSk: fit?.reasonsSk ?? [],
      });
    });
  });

  const relevanceByKey = new Map<string, number>();
  normalise(flat.map((f) => f.score)).forEach((rel, i) => {
    relevanceByKey.set(`${flat[i].mediaIndex}:${flat[i].segment.id}`, rel);
  });

  // ── 2. Opakovanie (krok 1) ──────────────────────────────────────────────
  const semanticSegments = flat.map((f) => ({
    id: `${f.mediaIndex}:${f.segment.id}`,
    assetId: input.media[f.mediaIndex].assetId,
    sourceLabel: input.media[f.mediaIndex].sourceLabel,
    text: f.segment.text,
  }));
  const semanticIndex = await buildSemanticIndex(semanticSegments, input.embed);
  const redundancy: SemanticMatch[] = semanticIndex.quality === 'MEASURED' ? findRedundantSegments(semanticIndex) : [];
  const redundantByKey = new Map<string, SemanticMatch>();
  for (const match of redundancy) redundantByKey.set(match.b.id, match);

  // ── 3. Rozhodnutie o role ───────────────────────────────────────────────
  // Hook: najvyššia relevance medzi prvými pasážami (hook je zásadne zo začiatku média).
  const hookCandidates = flat.filter((f) => f.isFirst && !redundantByKey.has(`${f.mediaIndex}:${f.segment.id}`));
  const hookPick = hookCandidates
    .slice()
    .sort((a, b) => {
      const ra = relevanceByKey.get(`${a.mediaIndex}:${a.segment.id}`) ?? 0;
      const rb = relevanceByKey.get(`${b.mediaIndex}:${b.segment.id}`) ?? 0;
      return rb - ra || a.mediaIndex - b.mediaIndex;
    })[0];

  // Záver: posledná pasáž s výzvou na akciu, inak posledná pasáž s najvyššou relevanciou.
  const endCandidates = flat.filter((f) => {
    const key = `${f.mediaIndex}:${f.segment.id}`;
    if (redundantByKey.has(key)) return false;
    if (f === hookPick) return false;
    return hasMarker(f.segment.text, goal.actionMarkersSk).length > 0 || f.isLast;
  });
  const endPick = endCandidates
    .slice()
    .sort((a, b) => {
      const ca = hasMarker(a.segment.text, goal.actionMarkersSk).length > 0 ? 1 : 0;
      const cb = hasMarker(b.segment.text, goal.actionMarkersSk).length > 0 ? 1 : 0;
      if (ca !== cb) return cb - ca;
      const ra = relevanceByKey.get(`${a.mediaIndex}:${a.segment.id}`) ?? 0;
      const rb = relevanceByKey.get(`${b.mediaIndex}:${b.segment.id}`) ?? 0;
      return rb - ra || a.mediaIndex - b.mediaIndex;
    })[0];

  const rows: ContentMapRow[] = input.media.map((media, mediaIndex) => {
    const segments: ContentMapSegment[] = [];

    media.segments.forEach((segment) => {
      const key = `${mediaIndex}:${segment.id}`;
      const relevance = relevanceByKey.get(key) ?? 0;
      const redundant = redundantByKey.get(key);
      const flatEntry = flat.find((f) => f.mediaIndex === mediaIndex && f.segment.id === segment.id);

      let role: UsageRole;
      let whySk: string;
      let redundantOf: ContentMapSegment['redundantOf'];

      if (redundant) {
        role = 'OMIT';
        redundantOf = {
          assetId: redundant.a.assetId,
          sourceLabel: redundant.a.sourceLabel,
          similarity: redundant.similarity,
        };
        // Dôvod píšeme tu, aby bol čitateľný pre človeka: `redundant.reasonSk`
        // používa interné kľúče (napr. „0:s2“), ktoré v UI nič neznamenajú.
        const sameMedia = redundant.a.assetId === redundant.b.assetId;
        whySk = sameMedia
          ? `veta ${segment.id} opakuje vetu ${String(redundant.a.id).split(':').pop()} v tom istom videe `
            + `(zhoda významu ${(redundant.similarity * 100).toFixed(0)} %) — neprináša nový význam.`
          : `opakuje ${redundant.a.sourceLabel ?? redundant.a.id} `
            + `(zhoda významu ${(redundant.similarity * 100).toFixed(0)} %) — neprináša nový význam.`;
      } else if (relevance < weakRelevance) {
        role = 'OMIT';
        whySk = `slabá pointa — relatívna relevance ${(relevance * 100).toFixed(0)} % je pod prahom ${(weakRelevance * 100).toFixed(0)} %${
          flatEntry?.reasonsSk.length ? ` (zásah cieľa: ${flatEntry.reasonsSk.join(', ')})` : ' (žiadny zásah cieľa sa nenašiel)'
        }.`;
      } else if (flatEntry === hookPick) {
        role = 'OPEN';
        whySk = `hook — najsilnejšia prvá pasáž v sade (relatívna relevance ${(relevance * 100).toFixed(0)} %${
          flatEntry.reasonsSk.length ? `, ${flatEntry.reasonsSk.join(', ')}` : ''
        }).`;
      } else if (flatEntry === endPick) {
        role = 'END';
        whySk = `záver — ${
          hasMarker(segment.text, goal.actionMarkersSk).length > 0
            ? `obsahuje výzvu na akciu: ${hasMarker(segment.text, goal.actionMarkersSk).slice(0, 3).join(', ')}`
            : 'posledná pasáž najsilnejšieho média'
        } (relatívna relevance ${(relevance * 100).toFixed(0)} %).`;
      } else {
        const product = hasMarker(segment.text, PRODUCT_MARKERS_SK);
        const proof = hasMarker(segment.text, PROOF_MARKERS_SK);
        if (product.length > 0) {
          role = 'PRODUCT';
          whySk = `hovorí o ponuke/produkte: ${product.slice(0, 4).join(', ')} (relatívna relevance ${(relevance * 100).toFixed(0)} %).`;
        } else if (proof.length > 0) {
          role = 'PROOF';
          whySk = `nesie dôkaz/výsledok: ${proof.slice(0, 4).join(', ')} (relatívna relevance ${(relevance * 100).toFixed(0)} %).`;
        } else {
          role = 'BODY';
          whySk = `telo — nesie obsah${flatEntry?.reasonsSk.length ? ` (${flatEntry.reasonsSk.slice(0, 2).join(', ')})` : ''}, relatívna relevance ${(relevance * 100).toFixed(0)} %.`;
        }
      }

      segments.push({
        ...segment,
        assetId: media.assetId,
        sourceLabel: media.sourceLabel,
        role,
        relevance,
        whySk,
        redundantOf,
      });
    });

    const usableSegments = segments.filter((s) => s.role !== 'OMIT').length;
    const omittedSegments = segments.filter((s) => s.role === 'OMIT').length;
    const quality: ContentMapRow['quality'] = media.segments.length > 0 ? 'MEASURED' : 'NOT_AVAILABLE';
    return {
      assetId: media.assetId,
      sourceLabel: media.sourceLabel,
      durationSec: media.durationSec ?? null,
      segments,
      usableSegments,
      omittedSegments,
      quality,
      reasonSk:
        quality === 'MEASURED'
          ? `Posúdených ${segments.length} pasáží z textu média.`
          : media.unavailableSk ?? 'Obsah sa nedá posúdiť — chýba text (prepis alebo titulky).',
    };
  });

  const byRole: Record<UsageRole, number> = { OPEN: 0, BODY: 0, PRODUCT: 0, PROOF: 0, END: 0, OMIT: 0 };
  rows.forEach((r) => r.segments.forEach((s) => (byRole[s.role] += 1)));

  const omittedSegments = rows.flatMap((r) => r.segments).filter((s) => s.role === 'OMIT');
  const omittedRepeats = omittedSegments.filter((s) => s.redundantOf).length;
  const omittedWeak = omittedSegments.length - omittedRepeats;
  const usableMedia = rows.filter((r) => r.usableSegments > 0).length;
  const unusedMedia = rows.length - usableMedia;

  const hookSource = hookPick ? input.media[hookPick.mediaIndex] : null;
  const hook: ContentMapHook | null =
    hookPick && hookSource
      ? {
          assetId: hookSource.assetId,
          sourceLabel: hookSource.sourceLabel,
          text: hookPick.segment.text,
          start: hookPick.segment.start ?? null,
          end: hookPick.segment.end ?? null,
          labelSk:
            typeof hookPick.segment.start === 'number' && typeof hookPick.segment.end === 'number'
              ? `${hookSource.sourceLabel} ${mmss(hookPick.segment.start)}–${mmss(hookPick.segment.end)}`
              : `${hookSource.sourceLabel} (čas sa nedá určiť — pasáž nemá časovanie)`,
        }
      : null;

  const total: ContentMapTotals = {
    media: rows.length,
    usableMedia,
    unusedMedia,
    segments: rows.reduce((sum, r) => sum + r.segments.length, 0),
    omitted: omittedSegments.length,
    omittedRepeats,
    omittedWeak,
    byRole,
  };

  const parts: string[] = [];
  parts.push(`Použiteľné ${usableMedia}/${total.media}`);
  parts.push(hook ? `hook ${hook.labelSk}` : 'hook sa nedá určiť (žiadne médium nemá použiteľnú prvú pasáž s časom)');
  parts.push(
    `${total.omitted} vyradených (${
      omittedRepeats > 0 && omittedWeak > 0
        ? `${omittedRepeats} opakovanie, ${omittedWeak} slabá pointa`
        : omittedRepeats > 0
          ? 'opakovanie'
          : 'slabá pointa'
    })`,
  );
  parts.push(`${total.unusedMedia} nepoužitých`);
  const summarySk = `${parts.join('; ')}.`;

  const semanticReasonSk =
    semanticIndex.quality === 'MEASURED'
      ? `Opakovanie merané lokálnym modelom na ${semanticIndex.segments.length} pasážach.`
      : semanticIndex.reasonSk;

  return {
    goalId: goal.id,
    goalLabelSk: goal.labelSk,
    rows,
    hook,
    total,
    summarySk,
    semanticQuality: semanticIndex.quality,
    semanticReasonSk,
    unavailableSk,
  };
}

/** Zoznam „prečo nie“ pre UI — jedna veta na vyradenú pasáž. */
export function whyNotList(map: ContentMap, limit = 50): string[] {
  return map.rows
    .flatMap((row) => row.segments.filter((s) => s.role === 'OMIT').map((s) => s.whySk))
    .slice(0, limit);
}

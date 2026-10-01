import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ContentMapReview,
  contentMapReviewItems,
  filterContentMapReviewItems,
} from '../src/components/ContentMapReview';
import type { ContentMap, ContentMapSegment, ContentMapRow, UsageRole } from '../src/core/media/contentMap';

function segment(
  id: string,
  sourceLabel: string,
  role: UsageRole,
  text: string,
  whySk: string,
  over: Partial<ContentMapSegment> = {},
): ContentMapSegment {
  return {
    id,
    assetId: sourceLabel,
    sourceLabel,
    role,
    text,
    whySk,
    relevance: role === 'OMIT' ? 0.1 : 0.9,
    start: 1,
    end: 3,
    ...over,
  };
}

const usable = segment('s0', 'video 07', 'OPEN', 'Tu je výsledok zákazníka.', 'hook — najsilnejšia prvá pasáž.');
const weak = segment('s1', 'video 07', 'OMIT', 'Vetu som povedal ešte raz.', 'slabá pointa — neprináša nový význam.');
const repeated = segment('s0', 'video 12', 'OMIT', 'Tu je výsledok zákazníka!', 'opakuje video 07 — neprináša nový význam.', {
  redundantOf: { assetId: 'video 07', sourceLabel: 'video 07', similarity: 0.91 },
});

function row(
  sourceLabel: string,
  segments: ContentMapSegment[],
  over: Partial<ContentMapRow> = {},
): ContentMapRow {
  return {
    assetId: sourceLabel,
    sourceLabel,
    durationSec: 12,
    segments,
    usableSegments: segments.filter((s) => s.role !== 'OMIT').length,
    omittedSegments: segments.filter((s) => s.role === 'OMIT').length,
    quality: 'MEASURED',
    reasonSk: `Posúdené pasáže: ${segments.length}.`,
    ...over,
  };
}

const MAP: ContentMap = {
  goalId: 'PREDAJ',
  goalLabelSk: 'Predaj',
  rows: [
    row('video 07', [usable, weak]),
    row('video 12', [repeated]),
    row('video 30', [], {
      durationSec: null,
      quality: 'NOT_AVAILABLE',
      reasonSk: 'chýba prepis/titulky — obsah sa nedá posúdiť',
    }),
  ],
  hook: { assetId: 'video 07', sourceLabel: 'video 07', text: usable.text, start: 1, end: 3, labelSk: 'video 07 00:01–00:03' },
  total: {
    media: 3,
    usableMedia: 1,
    unusedMedia: 2,
    segments: 3,
    omitted: 2,
    omittedRepeats: 1,
    omittedWeak: 1,
    byRole: { OPEN: 1, BODY: 0, PRODUCT: 0, PROOF: 0, END: 0, OMIT: 2 },
  },
  summarySk: 'Použiteľné 1/3; hook video 07 00:01–00:03; 2 vyradené; 2 nepoužité.',
  semanticQuality: 'MEASURED',
  semanticReasonSk: 'Opakovanie merané lokálnym modelom na 3 pasážach.',
  unavailableSk: ['video 30: chýba prepis/titulky'],
};

const ITEMS = contentMapReviewItems(MAP);
const BASE_OPTIONS = { filter: 'ALL' as const, role: 'ALL' as const, whyNot: 'ALL' as const, search: '' };

describe('Content Map — filtre a WHY NOT', () => {
  test('chýbajúci text sa zobrazí ako NEMÁ DÁTA s pôvodným dôvodom, nie ako vymyslená pasáž', () => {
    const missing = ITEMS.find((item) => item.assetId === 'video 30')!;
    expect(missing.kind).toBe('MISSING_TEXT');
    expect(missing.role).toBe('NO_TEXT');
    expect(missing.text).toBe('');
    expect(missing.reasonSk).toContain('chýba prepis/titulky');
  });

  test('Odporúčané ukáže len pasáže, ktoré mapa navrhuje použiť', () => {
    const selected = filterContentMapReviewItems(ITEMS, { ...BASE_OPTIONS, filter: 'RECOMMENDED' });
    expect(selected.map((item) => item.key)).toEqual(['video 07:s0']);
  });

  test('Nepoužité médiá zahŕňa médiá bez použiteľnej pasáže, ale nie vyradený úsek z použiteľného média', () => {
    const selected = filterContentMapReviewItems(ITEMS, { ...BASE_OPTIONS, filter: 'UNUSED_MEDIA' });
    expect(selected.map((item) => item.key)).toEqual(['video 12:s0', 'video 30:missing-text']);
  });

  test('WHY NOT ukáže každú vyradenú pasáž aj médium bez textu', () => {
    const selected = filterContentMapReviewItems(ITEMS, { ...BASE_OPTIONS, filter: 'WHY_NOT' });
    expect(selected.map((item) => item.key)).toEqual([
      'video 07:s1',
      'video 12:s0',
      'video 30:missing-text',
    ]);
  });

  test('WHY NOT sa dá zúžiť na opakovanie, slabú pointu alebo chýbajúci prepis', () => {
    const repeats = filterContentMapReviewItems(ITEMS, { ...BASE_OPTIONS, filter: 'WHY_NOT', whyNot: 'REPEAT' });
    const weak = filterContentMapReviewItems(ITEMS, { ...BASE_OPTIONS, filter: 'WHY_NOT', whyNot: 'WEAK' });
    const missing = filterContentMapReviewItems(ITEMS, { ...BASE_OPTIONS, filter: 'WHY_NOT', whyNot: 'MISSING_TEXT' });
    expect(repeats.map((item) => item.sourceLabel)).toEqual(['video 12']);
    expect(weak.map((item) => item.sourceLabel)).toEqual(['video 07']);
    expect(missing.map((item) => item.sourceLabel)).toEqual(['video 30']);
  });

  test('role filter a vyhľadávanie zúžia výsledok bez zmeny mapy', () => {
    const omitted = filterContentMapReviewItems(ITEMS, { ...BASE_OPTIONS, role: 'OMIT' });
    const noText = filterContentMapReviewItems(ITEMS, { ...BASE_OPTIONS, role: 'NO_TEXT' });
    const search = filterContentMapReviewItems(ITEMS, { ...BASE_OPTIONS, filter: 'WHY_NOT', search: 'OPAKUJE' });
    expect(omitted).toHaveLength(2);
    expect(noText.map((item) => item.sourceLabel)).toEqual(['video 30']);
    expect(search.map((item) => item.sourceLabel)).toEqual(['video 12']);
    expect(MAP.rows[0].segments).toHaveLength(2);
  });

  test('samostatná obrazovka vykreslí filtre a prizná, že nič nebolo aplikované', () => {
    const html = renderToStaticMarkup(
      <ContentMapReview
        map={MAP}
        goalId="PREDAJ"
        onGoalChange={() => {}}
        onBuild={() => {}}
        isBuilding={false}
        mediaCount={3}
      />,
    );
    expect(html).toContain('Content Map — výber a WHY NOT');
    expect(html).toContain('Všetko');
    expect(html).toContain('Odporúčané');
    expect(html).toContain('Nepoužité médiá');
    expect(html).toContain('WHY NOT');
    expect(html).toContain('Hľadať zdroj, text alebo dôvod');
    expect(html).toContain('Použitie / stav dát');
    expect(html).toContain('Len návrh — nič nebolo aplikované.');
    expect(html).toContain('canonical timeline');
    expect(html).toContain('Relatívna relevance');
    expect(html).toContain('chýba prepis/titulky');
  });

  test('otvorenie prázdnej obrazovky nespúšťa výpočet', () => {
    let buildCalls = 0;
    const html = renderToStaticMarkup(
      <ContentMapReview
        map={null}
        goalId="PREDAJ"
        onGoalChange={() => {}}
        onBuild={() => { buildCalls += 1; }}
        isBuilding={false}
        mediaCount={0}
      />,
    );
    expect(buildCalls).toBe(0);
    expect(html).toContain('Mapa ešte nebola vypočítaná');
    expect(html).toContain('Najprv importuj aspoň jedno médium.');
    expect(html).toContain('disabled');
  });

  test('chyba výpočtu sa zobrazí používateľovi s dôvodom', () => {
    const html = renderToStaticMarkup(
      <ContentMapReview
        map={null}
        goalId="PREDAJ"
        onGoalChange={() => {}}
        onBuild={() => {}}
        isBuilding={false}
        error="Lokálny model nie je dostupný"
        mediaCount={1}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('Content Map sa nepodarilo vypočítať');
    expect(html).toContain('Lokálny model nie je dostupný');
  });
});

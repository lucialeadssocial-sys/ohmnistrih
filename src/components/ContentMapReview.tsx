import React, { useMemo, useState } from 'react';
import {
  USAGE_ROLE_LABELS_SK,
  whyNotList,
  type ContentMap,
  type UsageRole,
} from '../core/media/contentMap';
import { VIDEO_GOALS, type VideoGoalId } from '../core/style/videoGoal';

export type ContentMapReviewFilter = 'ALL' | 'RECOMMENDED' | 'UNUSED_MEDIA' | 'WHY_NOT';
export type ContentMapReviewRole = 'ALL' | UsageRole | 'NO_TEXT';
export type ContentMapWhyNotFilter = 'ALL' | 'REPEAT' | 'WEAK' | 'MISSING_TEXT';

type ReasonKind = 'NONE' | 'REPEAT' | 'WEAK' | 'MISSING_TEXT';

export interface ContentMapReviewItem {
  key: string;
  assetId: string;
  sourceLabel: string;
  text: string;
  start: number | null;
  end: number | null;
  role: UsageRole | 'NO_TEXT';
  relevance: number | null;
  reasonSk: string;
  kind: 'SEGMENT' | 'MISSING_TEXT';
  reasonKind: ReasonKind;
  mediaUsable: boolean;
}

export interface ContentMapReviewOptions {
  filter: ContentMapReviewFilter;
  role: ContentMapReviewRole;
  whyNot: ContentMapWhyNotFilter;
  search: string;
}

const PAGE_SIZE = 40;

function countLabel(count: number, forms: [string, string, string]): string {
  const absolute = Math.abs(count);
  const form = absolute % 10 === 1 && absolute % 100 !== 11
    ? forms[0]
    : absolute % 10 >= 2 && absolute % 10 <= 4 && (absolute % 100 < 12 || absolute % 100 > 14)
      ? forms[1]
      : forms[2];
  return `${count} ${form}`;
}

/**
 * Flattenuje iba existujúcu Content Map na riadky pre UI. Chýbajúci prepis sa
 * zobrazí ako samostatný stav s dôvodom, nikdy ako prázdna alebo domyslená veta.
 */
export function contentMapReviewItems(map: ContentMap): ContentMapReviewItem[] {
  return map.rows.flatMap<ContentMapReviewItem>((row) => {
    if (row.quality === 'NOT_AVAILABLE' || row.segments.length === 0) {
      return [{
        key: `${row.assetId}:missing-text`,
        assetId: row.assetId,
        sourceLabel: row.sourceLabel,
        text: '',
        start: null,
        end: null,
        role: 'NO_TEXT' as const,
        relevance: null,
        reasonSk: row.reasonSk,
        kind: 'MISSING_TEXT' as const,
        reasonKind: 'MISSING_TEXT' as const,
        mediaUsable: row.usableSegments > 0,
      }];
    }

    return row.segments.map((segment) => ({
      key: `${row.assetId}:${segment.id}`,
      assetId: row.assetId,
      sourceLabel: row.sourceLabel,
      text: segment.text,
      start: typeof segment.start === 'number' ? segment.start : null,
      end: typeof segment.end === 'number' ? segment.end : null,
      role: segment.role,
      relevance: segment.relevance,
      reasonSk: segment.whySk,
      kind: 'SEGMENT' as const,
      reasonKind: segment.role !== 'OMIT' ? 'NONE' as const : segment.redundantOf ? 'REPEAT' as const : 'WEAK' as const,
      mediaUsable: row.usableSegments > 0,
    }));
  });
}

function normalizeSearch(value: string): string {
  return value
    .toLocaleLowerCase('sk')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Čistý, deterministický filter nad už vypočítanou mapou; model ani timeline nespúšťa. */
export function filterContentMapReviewItems(
  items: ContentMapReviewItem[],
  options: ContentMapReviewOptions,
): ContentMapReviewItem[] {
  const query = normalizeSearch(options.search);
  return items.filter((item) => {
    if (options.filter === 'RECOMMENDED' && !(item.kind === 'SEGMENT' && item.role !== 'OMIT')) return false;
    if (options.filter === 'UNUSED_MEDIA' && item.mediaUsable) return false;
    if (options.filter === 'WHY_NOT' && !(item.role === 'OMIT' || item.kind === 'MISSING_TEXT')) return false;

    if (options.role !== 'ALL' && item.role !== options.role) return false;

    if (options.filter === 'WHY_NOT' && options.whyNot !== 'ALL' && item.reasonKind !== options.whyNot) return false;

    if (query) {
      const haystack = normalizeSearch(`${item.sourceLabel} ${item.text} ${item.reasonSk}`);
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

function timeLabel(start: number | null, end: number | null): string {
  if (start === null || end === null || !Number.isFinite(start) || !Number.isFinite(end)) {
    return 'čas sa nedá určiť';
  }
  const format = (seconds: number) => {
    const whole = Math.max(0, Math.floor(seconds));
    return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
  };
  return `${format(start)}–${format(end)}`;
}

const FILTER_LABELS: Array<{ id: ContentMapReviewFilter; label: string }> = [
  { id: 'ALL', label: 'Všetko' },
  { id: 'RECOMMENDED', label: 'Odporúčané' },
  { id: 'UNUSED_MEDIA', label: 'Nepoužité médiá' },
  { id: 'WHY_NOT', label: 'WHY NOT' },
];

export interface ContentMapReviewProps {
  map: ContentMap | null;
  goalId: VideoGoalId;
  onGoalChange: (goalId: VideoGoalId) => void;
  onBuild: () => void | Promise<void>;
  isBuilding: boolean;
  error?: string | null;
  mediaCount: number;
}

/**
 * Samostatný, read-only prehľad nad Content Map. „Odporúčané“ nie je „aplikované“:
 * táto obrazovka nemení EditDecision, CommandManager ani canonical timeline.
 */
export const ContentMapReview: React.FC<ContentMapReviewProps> = ({
  map,
  goalId,
  onGoalChange,
  onBuild,
  isBuilding,
  error = null,
  mediaCount,
}) => {
  const [filter, setFilter] = useState<ContentMapReviewFilter>('ALL');
  const [role, setRole] = useState<ContentMapReviewRole>('ALL');
  const [whyNotFilter, setWhyNotFilter] = useState<ContentMapWhyNotFilter>('ALL');
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const allItems = useMemo(() => map ? contentMapReviewItems(map) : [], [map]);
  const filteredItems = useMemo(
    () => filterContentMapReviewItems(allItems, { filter, role, whyNot: whyNotFilter, search }),
    [allItems, filter, role, whyNotFilter, search],
  );
  const counts = useMemo(() => {
    const recommended = allItems.filter((item) => item.kind === 'SEGMENT' && item.role !== 'OMIT').length;
    const missing = allItems.filter((item) => item.kind === 'MISSING_TEXT').length;
    const whyNotSegments = map ? whyNotList(map, map.total.omitted).length : 0;
    return {
      all: allItems.length,
      recommended,
      unusedMedia: map?.total.unusedMedia ?? 0,
      whyNot: whyNotSegments + missing,
    };
  }, [allItems, map]);

  const updateFilter = (next: ContentMapReviewFilter) => {
    setFilter(next);
    setVisibleCount(PAGE_SIZE);
  };
  const updateRole = (next: ContentMapReviewRole) => {
    setRole(next);
    setVisibleCount(PAGE_SIZE);
  };
  const updateWhyNot = (next: ContentMapWhyNotFilter) => {
    setWhyNotFilter(next);
    setVisibleCount(PAGE_SIZE);
  };
  const updateSearch = (next: string) => {
    setSearch(next);
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <section className="space-y-4" aria-labelledby="content-map-review-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="content-map-review-title" className="text-lg font-semibold text-white">Content Map — výber a WHY NOT</h3>
          <p className="mt-1 max-w-3xl text-xs text-zinc-400">
            Prehľad návrhov podľa tituliek/prepisu v projekte. Relatívna relevance je poradie v tejto sade,
            nie kalibrovaná pravdepodobnosť ani predikcia úspechu.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="content-map-goal" className="sr-only">Cieľ pre Content Map</label>
          <select
            id="content-map-goal"
            value={goalId}
            onChange={(event) => onGoalChange(event.target.value as VideoGoalId)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-xs text-zinc-200"
          >
            {Object.values(VIDEO_GOALS).map((goal) => (
              <option key={goal.id} value={goal.id}>{goal.emoji} {goal.labelSk}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => { void onBuild(); }}
            disabled={isBuilding || mediaCount === 0}
            className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-medium text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isBuilding ? 'Počítam…' : 'Vypočítať Content Map'}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-amber-800/60 bg-amber-950/20 p-3 text-xs text-amber-100">
        <strong>Len návrh — nič nebolo aplikované.</strong> Content Map nemení canonical timeline ani stav klipov.
        Prijatie alebo Apply nie je súčasťou tejto obrazovky.
      </div>
      {error && (
        <div role="alert" className="rounded-lg border border-red-800/70 bg-red-950/30 p-3 text-xs text-red-200">
          Content Map sa nepodarilo vypočítať: {error}
        </div>
      )}

      {!map ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-400">
          Mapa ešte nebola vypočítaná. Výpočet sa spustí až po kliknutí na tlačidlo — otvorenie tejto obrazovky
          nespúšťa analýzu ani model.
          {mediaCount === 0 && <div className="mt-2 text-amber-300">Najprv importuj aspoň jedno médium.</div>}
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-100">
            <div className="font-medium">{map.summarySk}</div>
            <div className="mt-1 text-[11px] text-zinc-400">Mapa bola vypočítaná pre cieľ: <span className="text-zinc-200">{map.goalLabelSk}</span>.</div>
            {map.goalId !== goalId && (
              <div className="mt-2 rounded-md border border-amber-800/50 bg-amber-950/30 p-2 text-[11px] text-amber-200">
                Zvolený cieľ sa zmenil. Zobrazená mapa stále patrí k cieľu „{map.goalLabelSk}“; klikni na výpočet, aby sa prepočítala.
              </div>
            )}
            <div className="mt-2 text-[11px]">
              {map.semanticQuality === 'MEASURED' ? (
                <span className="text-emerald-300">Opakovanie NAMERANÉ — {map.semanticReasonSk}</span>
              ) : (
                <span className="text-amber-300">Opakovanie sa NEMERALO — {map.semanticReasonSk} Dôvody opakovania sa nedopĺňajú.</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter Content Map">
            {FILTER_LABELS.map(({ id, label }) => {
              const count = id === 'ALL'
                ? counts.all
                : id === 'RECOMMENDED'
                  ? counts.recommended
                  : id === 'UNUSED_MEDIA'
                    ? counts.unusedMedia
                    : counts.whyNot;
              const forms: [string, string, string] = id === 'UNUSED_MEDIA'
                ? ['médium', 'médiá', 'médií']
                : id === 'WHY_NOT'
                  ? ['dôvod', 'dôvody', 'dôvodov']
                  : id === 'RECOMMENDED'
                    ? ['pasáž', 'pasáže', 'pasáží']
                    : ['položka', 'položky', 'položiek'];
              const countText = countLabel(count, forms);
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={filter === id}
                  onClick={() => updateFilter(id)}
                  className={`rounded-lg border px-3 py-2 text-xs transition-colors ${filter === id
                    ? 'border-purple-500 bg-purple-950/60 text-purple-100'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  {label} <span className="ml-1 font-mono opacity-75">{countText}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <div className="min-w-[220px] flex-1">
              <label htmlFor="content-map-search" className="mb-1 block text-[11px] text-zinc-400">Hľadať zdroj, text alebo dôvod</label>
              <input
                id="content-map-search"
                type="search"
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Napr. video 12, opakuje, CTA…"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-purple-500 focus:outline-none"
              />
            </div>
            <div className="min-w-[190px]">
              <label htmlFor="content-map-role" className="mb-1 block text-[11px] text-zinc-400">Použitie / stav dát</label>
              <select
                id="content-map-role"
                value={role}
                onChange={(event) => updateRole(event.target.value as ContentMapReviewRole)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200"
              >
                <option value="ALL">Všetky roly a stavy</option>
                {Object.entries(USAGE_ROLE_LABELS_SK).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
                <option value="NO_TEXT">NEMÁ DÁTA — chýba text</option>
              </select>
            </div>
            {filter === 'WHY_NOT' && (
              <div className="min-w-[190px]">
                <label htmlFor="content-map-why-filter" className="mb-1 block text-[11px] text-zinc-400">Dôvod vyradenia</label>
                <select
                  id="content-map-why-filter"
                  value={whyNotFilter}
                  onChange={(event) => updateWhyNot(event.target.value as ContentMapWhyNotFilter)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200"
                >
                  <option value="ALL">Všetky dôvody</option>
                  <option value="REPEAT">Opakovanie</option>
                  <option value="WEAK">Slabá pointa</option>
                  <option value="MISSING_TEXT">Chýba prepis/titulky</option>
                </select>
              </div>
            )}
            <div className="pb-2 text-[11px] text-zinc-500" aria-live="polite">
              {filteredItems.length === 0
                ? 'Žiadne položky'
                : `Zobrazené ${Math.min(visibleCount, filteredItems.length)} z ${filteredItems.length}`}
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-400">
              {filter === 'WHY_NOT' && map.semanticQuality === 'NOT_AVAILABLE' && counts.whyNot === 0
                ? 'Nie sú k dispozícii dôvody vyradenia; opakovanie sa nemeralo a žiadne ďalšie vyradené pasáže mapa neobsahuje.'
                : 'Pre zvolené filtre sa nenašli žiadne položky.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="min-w-[900px] w-full border-collapse text-left text-xs" aria-label="Content Map: odporúčané pasáže a dôvody nepoužitia">
                <thead className="bg-zinc-950 text-[10px] uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th scope="col" className="px-3 py-2">Source</th>
                    <th scope="col" className="px-3 py-2">Obsah</th>
                    <th scope="col" className="px-3 py-2">Relatívna relevance</th>
                    <th scope="col" className="px-3 py-2">Použitie v návrhu</th>
                    <th scope="col" className="px-3 py-2">WHY / WHY NOT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 bg-zinc-900/60">
                  {filteredItems.slice(0, visibleCount).map((item) => (
                    <tr key={item.key} className="align-top hover:bg-zinc-800/40">
                      <td className="whitespace-nowrap px-3 py-3 text-zinc-200">
                        <div>{item.sourceLabel}</div>
                        <div className="mt-1 font-mono text-[10px] text-zinc-500">{timeLabel(item.start, item.end)}</div>
                      </td>
                      <td className="max-w-[360px] px-3 py-3 text-zinc-300">
                        {item.kind === 'MISSING_TEXT'
                          ? <span className="italic text-amber-300">Prepis/titulky nie sú dostupné</span>
                          : <span>„{item.text}“</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-zinc-300">
                        {item.relevance === null ? '—' : `${Math.round(item.relevance * 100)} %`}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-block rounded border px-2 py-1 text-[10px] ${item.role === 'NO_TEXT'
                          ? 'border-amber-800/70 bg-amber-950/40 text-amber-200'
                          : item.role === 'OMIT'
                            ? 'border-amber-800/70 bg-amber-950/40 text-amber-200'
                            : item.role === 'OPEN'
                              ? 'border-emerald-800/70 bg-emerald-950/40 text-emerald-200'
                              : 'border-zinc-700 bg-zinc-800 text-zinc-200'
                        }`}>
                          {item.role === 'NO_TEXT' ? 'NEMÁ DÁTA' : USAGE_ROLE_LABELS_SK[item.role]}
                        </span>
                        <div className="mt-1 text-[10px] text-zinc-500">
                          {item.role === 'NO_TEXT'
                            ? 'neposúdené — chýba text'
                            : item.role === 'OMIT'
                              ? 'odporúčanie nepoužiť'
                              : 'odporúčanie použiť'}
                        </div>
                      </td>
                      <td className="max-w-[380px] px-3 py-3 text-zinc-400">
                        <span className={item.role === 'OMIT' || item.role === 'NO_TEXT' ? 'text-amber-200' : 'text-zinc-400'}>
                          {item.kind === 'MISSING_TEXT' ? 'WHY NOT — ' : item.role === 'OMIT' ? 'WHY NOT — ' : 'WHY — '}{item.reasonSk}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredItems.length > visibleCount && (
                <div className="border-t border-zinc-800 bg-zinc-950 p-3 text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900"
                  >
                    Zobraziť ďalších {Math.min(PAGE_SIZE, filteredItems.length - visibleCount)}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
};

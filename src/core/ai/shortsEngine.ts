import { ProjectModel } from '../types/project';

/**
 * Long-form → Shorts engine.
 *
 * Proposals are built ONLY from measured data: measured hooks (confidence from the analysis) and
 * the real end of the material. No hook means no proposals — the engine never invents a "viral
 * moment". Each hook yields one proposal per requested window (30/45/60 s); when the material ends
 * earlier the proposal is honestly marked as shorter than requested.
 */

export interface ShortsProposal {
  id: string;
  hookId: string;
  /** Measured hook confidence (0..1). */
  confidence: number;
  start: number;
  end: number;
  /** The window that was requested (30/45/60). */
  requestedDuration: number;
  /** The real length of the proposal (end - start). */
  duration: number;
  /** True when the material ended before the requested window was full. */
  cappedByMaterial: boolean;
  /** True when a measured CTA falls inside the window. */
  containsCta: boolean;
  titleSk: string;
  titleEn: string;
  evidenceSk: string;
  evidenceEn: string;
}

export interface ShortsEngineResult {
  proposals: ShortsProposal[];
  measured: boolean;
  materialEnd: number;
  notesSk: string[];
  notesEn: string[];
}

const DEFAULT_WINDOWS = [30, 45, 60];
/** A Short shorter than this is not a Short — documented minimum. */
const MIN_SHORT_SECONDS = 15;

const round1 = (value: number) => Math.round(value * 10) / 10;

export function buildShortsProposals(
  project: ProjectModel,
  options: { maxHooks?: number; windows?: number[] } = {}
): ShortsEngineResult {
  const maxHooks = options.maxHooks ?? 5;
  const windows = (options.windows ?? DEFAULT_WINDOWS).slice().sort((a, b) => a - b);
  const notesSk: string[] = [];
  const notesEn: string[] = [];

  const videoClips = project.tracks.filter(t => t.type === 'video').flatMap(t => t.clips);
  const materialEnd = videoClips.reduce((max, clip) => {
    const start = clip.timelineStart ?? clip.start ?? 0;
    return Math.max(max, start + clip.duration);
  }, 0);

  const hooks = (project.analysisResults?.hooks ?? [])
    .filter(hook => Number.isFinite(hook.start) && Number.isFinite(hook.confidence))
    .slice()
    .sort((a, b) => b.confidence - a.confidence);

  if (hooks.length === 0) {
    notesSk.push('Bez meraných hookov sa Shorts negenerujú — najprv spusti analýzu videa (hľadanie hookov).');
    notesEn.push('No measured hooks means no Shorts — run the analysis (hook detection) first.');
    return { proposals: [], measured: false, materialEnd: round1(materialEnd), notesSk, notesEn };
  }

  if (materialEnd < MIN_SHORT_SECONDS) {
    notesSk.push(`Materiál má ${round1(materialEnd)}s — z toho sa nedá postaviť ani ${MIN_SHORT_SECONDS}s okno.`);
    notesEn.push(`The material is ${round1(materialEnd)}s long — not even a ${MIN_SHORT_SECONDS}s window fits.`);
    return { proposals: [], measured: true, materialEnd: round1(materialEnd), notesSk, notesEn };
  }

  const ctas = project.analysisResults?.ctas ?? [];
  const segments = project.transcript?.segments ?? [];

  // De-duplicate hooks that start at nearly the same moment — one moment, one set of proposals.
  const uniqueHooks = hooks.filter(
    (hook, index) => hooks.findIndex(other => Math.abs(other.start - hook.start) < 0.5) === index
  ).slice(0, maxHooks);

  if (uniqueHooks.length < hooks.length) {
    notesSk.push(`Z ${hooks.length} meraných hookov je ${uniqueHooks.length} rôznych momentov (blízke hooky sa spájajú).`);
    notesEn.push(`${hooks.length} measured hooks form ${uniqueHooks.length} distinct moments (nearby hooks are merged).`);
  }

  const proposals: ShortsProposal[] = [];

  uniqueHooks.forEach((hook, hookIndex) => {
    const start = Math.max(0, hook.start);

    for (const requestedDuration of windows) {
      const end = Math.min(start + requestedDuration, materialEnd);
      const duration = round1(end - start);
      if (duration < MIN_SHORT_SECONDS) continue;

      const cappedByMaterial = duration < requestedDuration - 0.01;
      const containsCta = ctas.some(cta => cta.start >= start && cta.start < end);

      // Title = the real transcript text at the hook; otherwise an explicitly labelled fallback.
      const segment =
        segments.find(s => s.start >= start && s.start < start + 10) ||
        segments.find(s => s.start < end && s.end > start);
      const text = (segment?.text || '').trim();
      const titleSk = text ? text.slice(0, 70) : `Klip od ${round1(start)}s (prepis pre túto časť neexistuje)`;
      const titleEn = text ? text.slice(0, 70) : `Clip from ${round1(start)}s (no transcript for this part)`;

      const hookType = (hook as { type?: string }).type || 'hook';
      const confidencePct = Math.round(hook.confidence * 100);

      proposals.push({
        id: `short_${hookIndex}_${requestedDuration}`,
        hookId: hook.id || `hook_${hookIndex}`,
        confidence: hook.confidence,
        start: round1(start),
        end: round1(end),
        requestedDuration,
        duration,
        cappedByMaterial,
        containsCta,
        titleSk,
        titleEn,
        evidenceSk:
          `Meraný hook: dôvera ${confidencePct} % (${hookType}) v ${round1(start)}s · okno ${requestedDuration}s ` +
          `z reálneho materiálu (${round1(materialEnd)}s)` +
          (cappedByMaterial ? ` — materiál končí v ${round1(materialEnd)}s, preto je klip ${duration}s.` : '.') +
          (containsCta ? ' V okne je meraný CTA.' : ''),
        evidenceEn:
          `Measured hook: confidence ${confidencePct}% (${hookType}) at ${round1(start)}s · ${requestedDuration}s window ` +
          `from real material (${round1(materialEnd)}s)` +
          (cappedByMaterial ? ` — the material ends at ${round1(materialEnd)}s, so the clip is ${duration}s.` : '.') +
          (containsCta ? ' A measured CTA falls inside the window.' : ''),
      });
    }
  });

  proposals.sort((a, b) => (b.confidence - a.confidence) || (a.duration - b.duration) || (a.start - b.start));

  notesSk.push(
    `${proposals.length} variantov z ${uniqueHooks.length} meraných hookov (okná ${windows.join('/')}s). ` +
      `Každý variant začína na meranom hooku a končí na reálnom konci materiálu.`
  );
  notesEn.push(
    `${proposals.length} variants from ${uniqueHooks.length} measured hooks (windows ${windows.join('/')}s). ` +
      `Every variant starts at a measured hook and ends at the real end of the material.`
  );

  return { proposals, measured: true, materialEnd: round1(materialEnd), notesSk, notesEn };
}

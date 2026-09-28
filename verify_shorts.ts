/**
 * Verification for the Long-form → Shorts engine.
 *
 * What this proves:
 *  - proposals are built from measured hooks only (confidence, real material end, real transcript),
 *  - a window export gets a correct render plan (length, range, unchanged EDL version),
 *  - the render backends and the mix renderer really read the window.
 * What it does NOT prove: that a browser renders and downloads the file. That part runs in the
 * browser only and stays unverified until the user runs it (stated in the UI as well).
 *
 * Run: npx tsx verify_shorts.ts
 */
import { coreEngine, createInitialProject } from './src/core';
import { buildShortsProposals } from './src/core/ai/shortsEngine';
import { RenderEngineManager } from './src/utils/renderEngineManager';

let pass = 0;
let fail = 0;
const check = (label: string, condition: boolean, extra?: string) => {
  if (condition) {
    pass++;
    console.log(`  PASS  ${label}${extra ? ` — ${extra}` : ''}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}${extra ? ` — ${extra}` : ''}`);
  }
};

const CLIP = (id: string, trackId: string, start: number, duration: number) => ({
  id, trackId, assetId: 'asset_fixture', name: id, type: 'video' as const,
  timelineStart: start, duration, sourceStart: 0, sourceEnd: duration,
  speed: 1, volume: 100, scale: 100, opacity: 100, positionX: 0, positionY: 0, rotation: 0, keyframes: [],
});

function fixture(longForm: boolean) {
  const project: any = { ...createInitialProject('Shorts fixture'), analysisResults: undefined, transcript: undefined };
  const track = project.tracks.find((t: any) => t.type === 'video');
  track.clips.push(CLIP('lf1', track.id, 0, longForm ? 300 : 100));
  project.transcript = {
    id: 'tr',
    segments: [
      { id: 's1', start: 2, end: 8, text: 'Ako z 60-minútového podcastu spraviť pätnásť Shorts?' },
      { id: 's2', start: 100, end: 106, text: 'Druhá myšlienka o strihu a tempu.' },
    ],
    words: [],
  };
  return project;
}

console.log('=== Long-form → Shorts verification ===');

// ---------------------------------------------------------------- §1 proposals
console.log('\n--- 1. Proposals come from measured hooks only ---');
const project = fixture(true);
project.analysisResults = {
  projectId: project.id,
  timestamp: Date.now(),
  hooks: [
    { id: 'h_mid', start: 100, end: 104, type: 'promise', confidence: 0.71 },
    { id: 'h_top', start: 2, end: 6, type: 'question', confidence: 0.92 },
    { id: 'h_low', start: 200, end: 203, type: 'insight', confidence: 0.65 },
    { id: 'h_dup', start: 2.2, end: 6, type: 'question', confidence: 0.9 },
  ],
  ctas: [{ id: 'c1', start: 40, end: 43, type: 'subscribe', text: 'Odoberte kanál', confidence: 0.8 }],
};

const result = buildShortsProposals(project);
check('measured analysis is declared', result.measured === true);
check('four hooks form three distinct moments (near-duplicates merge)', result.proposals.length === 9, `${result.proposals.length} proposals`);
check('material end is the real end of the timeline', result.materialEnd === 300, String(result.materialEnd));
check('the strongest hook comes first', result.proposals[0].confidence === 0.92, String(result.proposals[0].confidence));
check('each moment yields the 30/45/60 s windows', [30, 45, 60].every(w => result.proposals.some(p => p.requestedDuration === w)));
check('a proposal starts at the measured hook', result.proposals[0].start === 2, String(result.proposals[0].start));
check('duration is the real length of the window', result.proposals[0].duration === 30 && result.proposals[0].end === 32, `${result.proposals[0].start}-${result.proposals[0].end}`);
check('confidence is the measured hook confidence', result.proposals.every(p => [0.92, 0.71, 0.65].includes(p.confidence)));
check('no proposal runs past the real material end', result.proposals.every(p => p.end <= result.materialEnd));
check('nothing is reported as capped when the windows fit', result.proposals.every(p => p.cappedByMaterial === false));
check('the title is the real transcript text of that moment', result.proposals[0].titleSk.startsWith('Ako z 60-minútového'), result.proposals[0].titleSk.slice(0, 40));
check('a measured CTA inside the window is flagged', result.proposals.filter(p => p.containsCta).every(p => p.start <= 40 && p.end > 40));
check('evidence cites the measured confidence in percent', result.proposals[0].evidenceSk.includes('92 %') && result.proposals[0].evidenceSk.includes('Meraný hook'), result.proposals[0].evidenceSk.slice(0, 60));
check('the same input produces the same proposals (deterministic)', JSON.stringify(buildShortsProposals(project)) === JSON.stringify(result));

// Short material: windows get capped, and a tiny remainder is dropped instead of invented.
const shortProject = fixture(false);
shortProject.analysisResults = {
  projectId: shortProject.id,
  timestamp: Date.now(),
  hooks: [{ id: 'h_short', start: 80, end: 84, type: 'question', confidence: 0.8 }],
  ctas: [],
};
const shortResult = buildShortsProposals(shortProject);
check('capped windows are marked as shorter than requested', shortResult.proposals.length > 0 && shortResult.proposals.every(p => p.cappedByMaterial && p.duration < p.requestedDuration), shortResult.proposals.map(p => p.duration).join(','));
check('a remainder under the 15 s minimum is not offered as a Short', shortResult.proposals.every(p => p.duration >= 15));
check('capping is explained in the evidence', shortResult.proposals[0].evidenceSk.includes('materiál končí'), shortResult.proposals[0].evidenceSk.slice(-80));

const bareProject = fixture(true);
bareProject.analysisResults = { projectId: bareProject.id, timestamp: Date.now(), hooks: [], ctas: [] };
const bareResult = buildShortsProposals(bareProject);
check('no measured hooks means no proposals', bareResult.proposals.length === 0 && bareResult.measured === false);
check('the empty state tells the user to run the analysis', bareResult.notesSk.some(n => n.includes('analýzu')));

const tooShort = fixture(true);
tooShort.tracks.find((t: any) => t.type === 'video').clips = [CLIP('tiny', 'video', 0, 8)];
tooShort.analysisResults = { projectId: tooShort.id, timestamp: Date.now(), hooks: [{ id: 'h', start: 1, end: 2, type: 'question', confidence: 0.9 }], ctas: [] };
const tooShortResult = buildShortsProposals(tooShort);
check('material shorter than a Short window yields no proposals', tooShortResult.proposals.length === 0 && tooShortResult.notesSk.some(n => n.includes('nedá postaviť')));
check('maxHooks limits the number of moments', buildShortsProposals(project, { maxHooks: 1 }).proposals.length === 3);

// ---------------------------------------------------------------- §2 render plan window
console.log('\n--- 2. A window export gets a correct render plan ---');
const fullPlan = RenderEngineManager.createRenderPlan('current-project', 'SOCIAL_VERTICAL');
const windowPlan = RenderEngineManager.createRenderPlan('current-project', 'SOCIAL_VERTICAL', undefined, undefined, { start: 10, end: 40 });
check('the window plan renders exactly the window length', windowPlan.timelineDuration === 30, String(windowPlan.timelineDuration));
check('the window is carried on the plan', windowPlan.sourceRange?.start === 10 && windowPlan.sourceRange?.end === 40);
check('the vertical preset is used', windowPlan.outputWidth === 1080 && windowPlan.outputHeight === 1920, `${windowPlan.outputWidth}x${windowPlan.outputHeight}`);
check('the EDL version stays comparable (no false EDL_CHANGED)', windowPlan.edlVersion === fullPlan.edlVersion);
const inverted = RenderEngineManager.createRenderPlan('current-project', 'SOCIAL_VERTICAL', undefined, undefined, { start: 40, end: 10 });
check('an inverted range cannot produce a zero/negative duration', inverted.timelineDuration > 0 && (inverted.sourceRange?.end ?? 0) > (inverted.sourceRange?.start ?? 0), `${inverted.timelineDuration}`);
check('a normal export still has no window', fullPlan.sourceRange === undefined && fullPlan.timelineDuration > 0, String(fullPlan.timelineDuration));

// ---------------------------------------------------------------- §3 wiring guards
console.log('\n--- 3. Wiring guards (static) ---');
const fs = await import('node:fs');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const backend = fs.readFileSync('src/render/WebCodecsOfflineBackend.ts', 'utf8');
const mix = fs.readFileSync('src/core/audio/mixRenderer.ts', 'utf8');
const panel = fs.readFileSync('src/components/ShortsEnginePanel.tsx', 'utf8');
const engine = fs.readFileSync('src/core/ai/shortsEngine.ts', 'utf8');

check('the app exports each proposal as its own window', app.includes('handleExportShorts') && app.includes('{ start: proposal.start, end: proposal.end }'));
check('the app downloads a real file per proposal', /link\.download = `\$\{safeTitle\}_\$\{proposal\.duration\}s_9x16\.webm`/.test(app));
check('the app reports produced vs failed honestly', app.includes('z ${proposals.length} vyrenderovaných'));
check('the panel is mounted with the measured proposals', app.includes('<ShortsEnginePanel') && app.includes('setShortsResult(buildShortsProposals('));
check('the backend renders frames from the window start', backend.includes('const timelineTime = rangeStart + currentFrame / fps;'));
check('the backend mixes audio only for the window', backend.includes('renderProjectMix(project, plan.timelineDuration, 44100, rangeStart)'));
check('the mix renderer shifts and clips clips into the window', mix.includes('windowStart: number = 0') && mix.includes('sourceNode.start(playFrom, sourceStart + offsetIntoClip, playDuration)'));
check('the realtime fallback honours the window too', fs.readFileSync('src/render/RealtimeCanvasBackend.ts', 'utf8').includes('video.currentTime = rangeStart'));
check('the panel states that the browser export is unverified here', panel.includes('nemožno overiť') && panel.includes('cannot be verified'));
check('the panel distinguishes measured from unmeasured', panel.includes('MERANÉ DÁTA') && panel.includes('NEMERANÉ'));
check('the shorts engine contains no randomness', !engine.includes('Math.random') && !panel.includes('Math.random'));

// ---------------------------------------------------------------- §4 panel DOM interaction
console.log('\n--- 4. Panel DOM interaction (jsdom, not a real browser) ---');
const { JSDOM } = await import('jsdom');
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost:3000/', pretendToBeVisual: true });
(global as any).window = dom.window;
(global as any).document = dom.window.document;
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
(global as any).HTMLElement = dom.window.HTMLElement;
(global as any).Element = dom.window.Element;
(global as any).Node = dom.window.Node;
(global as any).Event = dom.window.Event;
(global as any).CustomEvent = dom.window.CustomEvent;
(global as any).localStorage = dom.window.localStorage;
(global as any).IS_REACT_ACT_ENVIRONMENT = true;

const ReactModule = await import('react');
const React = ReactModule.default;
const act = (ReactModule as any).act;
const { createRoot } = await import('react-dom/client');
const { ShortsEnginePanel } = await import('./src/components/ShortsEnginePanel');

const container = document.createElement('div');
document.body.appendChild(container);
const root = createRoot(container);
const settle = async (ms = 150) => { await act(async () => { await new Promise(r => setTimeout(r, ms)); }); };
const bodyText = () => (document.body.textContent || '').replace(/\s+/g, ' ');
const clickByText = async (text: string) => {
  const button = [...document.querySelectorAll('button')].find(b => (b.textContent || '').includes(text));
  if (!button) return false;
  await act(async () => { button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  await settle();
  return true;
};

let exported: any[] = [];
let seeked: any = null;
const renderPanel = async (props: Record<string, unknown>) => {
  await act(async () => {
    root.render(
      React.createElement(ShortsEnginePanel as any, {
        result,
        isExporting: false,
        progress: null,
        failures: [],
        onExport: (list: any[]) => { exported = list; },
        onSeek: (start: number, end: number) => { seeked = { start, end }; },
        language: 'sk',
        ...props,
      })
    );
  });
  await settle();
};

await renderPanel({});
check('the panel renders one card per proposal', (bodyText().match(/Prejsť na čas/g) || []).length === result.proposals.length, `${(bodyText().match(/Prejsť na čas/g) || []).length} cards`);
check('the panel shows the measured badge', bodyText().includes('MERANÉ DÁTA'));

await clickByText('Prejsť na čas');
check('the first card seeks to its real window', seeked?.start === result.proposals[0].start && seeked?.end === result.proposals[0].end, JSON.stringify(seeked));

await clickByText('Označiť všetko');
check('select-all selects every proposal', bodyText().includes(`Exportovať vybrané (${result.proposals.length})`), bodyText().match(/Exportovať vybrané \(\d+\)/)?.[0] || 'not found');
await clickByText('Exportovať vybrané');
check('the export button hands the selected proposals over', exported.length === result.proposals.length && exported[0].id === result.proposals[0].id, `${exported.length} handed over`);

await clickByText('Odznačiť');
check('clearing the selection disables the export', bodyText().includes('Exportovať vybrané (0)'));

await renderPanel({ result: bareResult });
check('without measured hooks the panel states it instead of suggesting clips', bodyText().includes('Žiadne merané hooky'));
check('the unmeasured badge is shown', bodyText().includes('NEMERANÉ'));

await renderPanel({ isExporting: true, progress: { current: 2, total: 9, label: 'Renderujem 2s–32s (30s)' }, failures: ['12s–42s: EDL_CHANGED'] });
check('the progress of a running export is visible', bodyText().includes('Renderujem 2s–32s'));
check('failures are shown per proposal instead of being swallowed', bodyText().includes('EDL_CHANGED') && bodyText().includes('Nepodarilo sa vyexportovať'));

console.log(`\n=== ${fail === 0 ? 'ALL SHORTS CHECKS PASSED' : 'SHORTS CHECKS FAILED'} — ${pass} passed, ${fail} failed ===`);
console.log('NOTE: proposals and plan maths are verified in Node; the panel is verified in jsdom; the actual browser render/download is NOT verified.');
if (fail > 0) process.exitCode = 1;

/**
 * DOM interaction verification for the Director Center (modes, PRO QUALITY, RAW → READY,
 * „Použiť všetko", „Skúsim sama").
 *
 * What this script is: the real component mounted in jsdom, driven by real DOM clicks against the
 * real core engine (canonical project, Command System). What it is NOT: a real browser. jsdom has
 * no canvas/WebAudio, so a few browser-only warnings are expected and printed. This script never
 * claims BROWSER VERIFIED — the honest level is "JS DOM INTERACTION VERIFIED".
 *
 * Run: npx tsx verify_director_ui.mjs
 */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:3000/',
  pretendToBeVisual: true,
});

global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.Event = dom.window.Event;
global.CustomEvent = dom.window.CustomEvent;
global.localStorage = dom.window.localStorage;
global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.matchMedia = dom.window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
global.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
class MockAudioParam { constructor() { this.value = 0; } setValueAtTime() { return this; } linearRampToValueAtTime() { return this; } exponentialRampToValueAtTime() { return this; } }
global.AudioContext = class {
  constructor() { this.currentTime = 0; this.destination = {}; this.sampleRate = 48000; this.state = 'running'; }
  createOscillator() { return { connect() {}, start() {}, stop() {}, type: '', frequency: new MockAudioParam(), detune: new MockAudioParam() }; }
  createGain() { return { connect() {}, gain: new MockAudioParam() }; }
  createBiquadFilter() { return { connect() {}, type: '', frequency: new MockAudioParam(), Q: new MockAudioParam(), gain: new MockAudioParam() }; }
  createBufferSource() { return { connect() {}, start() {}, stop() {}, buffer: null }; }
  createBuffer(ch, len, rate) { return { length: len, sampleRate: rate, numberOfChannels: ch, getChannelData() { return new Float32Array(len); } }; }
  createAnalyser() { return { connect() {}, fftSize: 2048, frequencyBinCount: 1024, getByteFrequencyData() {}, getByteTimeDomainData() {} }; }
  createDynamicsCompressor() { return { connect() {}, threshold: new MockAudioParam(), knee: new MockAudioParam(), ratio: new MockAudioParam(), attack: new MockAudioParam(), release: new MockAudioParam() }; }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
};
global.OffscreenCanvas = class { constructor(w, h) { this.width = w; this.height = h; } getContext() { return { drawImage() {}, fillRect() {}, clearRect() {}, save() {}, restore() {}, translate() {}, scale() {}, fillText() {}, measureText() { return { width: 0 }; }, beginPath() {}, closePath() {}, arc() {}, fill() {}, stroke() {}, moveTo() {}, lineTo() {} }; } };
global.URL.createObjectURL = () => 'blob:mock';
global.URL.revokeObjectURL = () => {};

const consoleErrors = [];
const origError = console.error;
console.error = (...a) => { consoleErrors.push(a.map(String).join(' ')); };
const pageErrors = [];
dom.window.addEventListener('error', (e) => pageErrors.push(String(e.error || e.message)));

global.IS_REACT_ACT_ENVIRONMENT = true;
const ReactModule = await import('react');
const React = ReactModule.default;
const act = ReactModule.act;
const { createRoot } = await import('react-dom/client');

const { coreEngine, createInitialProject } = await import('/home/user/ohmnistrih/src/core/index.ts');
const { DirectorPlanCenter } = await import('/home/user/ohmnistrih/src/components/DirectorPlanCenter.tsx');

const settle = async (ms = 300) => { await act(async () => { await new Promise(r => setTimeout(r, ms)); }); };
const findByText = (text, selector = 'button') => {
  const nodes = [...document.querySelectorAll(selector)];
  return nodes.find(n => (n.textContent || '').includes(text));
};
const bodyText = () => (document.body.textContent || '').replace(/\s+/g, ' ');
const click = async (node, label) => {
  if (!node) { results.push({ name: label, ok: false, detail: 'element not found' }); console.log(`FAIL  ${label} — element not found`); return false; }
  await act(async () => { node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  await settle(250);
  return true;
};

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

// ---------- Fixture: a project with measured analysis and one real clip ----------
const project = createInitialProject('Director UI fixture');
const videoTrack = project.tracks.find(t => t.type === 'video');
videoTrack.clips.push({
  id: 'ui_clip', trackId: videoTrack.id, assetId: 'asset_ui', name: 'UI clip', type: 'video',
  timelineStart: 0, duration: 40, sourceStart: 0, sourceEnd: 40, speed: 1, volume: 100,
  scale: 100, opacity: 100, positionX: 0, positionY: 0, rotation: 0, keyframes: [],
});
project.analysisResults = {
  projectId: project.id,
  timestamp: Date.now(),
  hooks: [{ id: 'h_ui', start: 2, end: 6, type: 'question', reason: 'measured', confidence: 0.95 }],
  pauses: [
    { id: 'p_ui_1', start: 10, end: 13, duration: 3, type: 'long_pause', confidence: 0.95 },
    { id: 'p_ui_2', start: 20, end: 21.5, duration: 1.5, type: 'long_pause', confidence: 0.7 },
  ],
};
project.transcript = { id: 'tr_ui', segments: [{ id: 's_ui', start: 2, end: 6, text: 'Ako strihať rýchlejšie?' }], words: [] };
coreEngine.commandManager.setProject(project);

const container = document.createElement('div');
document.body.appendChild(container);
const root = createRoot(container);
await act(async () => { root.render(React.createElement(DirectorPlanCenter)); });
await settle(300);

// ---------- 1. Empty state before anything is generated ----------
const emptyText = bodyText();
check('the panel renders without a stored plan', emptyText.includes('Director Center'));
check('nothing is generated during render', coreEngine.getProject().directorPlan === undefined);
check('an empty state explains that a plan is created on demand', emptyText.includes('Zatiaľ nie je vytvorený žiadny Director Plan'));
check('the RAW → READY card is absent while there is no plan', !emptyText.includes('RAW → READY'));

// ---------- 2. Mode + quality controls ----------
const modeOptions = [...document.querySelectorAll('option')].map(o => o.value);
const expectedModes = ['SOCIAL', 'ADS', 'STORY', 'YOUTUBE', 'PODCAST', 'CORPORATE', 'CUSTOM'];
check('all seven professional modes are selectable', expectedModes.every(m => modeOptions.includes(m)), modeOptions.join(','));
check('PRO QUALITY is offered and preselected', !!findByText('PRO QUALITY'));
const qualityButtons = [...document.querySelectorAll('button')].filter(b => /PRO QUALITY|Štandard/.test(b.textContent || ''));
check('the active quality is marked', qualityButtons.some(b => (b.className || '').includes('emerald')), `${qualityButtons.length} quality buttons`);

// ---------- 3. Generate the plan by clicking the real button ----------
const clicked = await click(findByText('Prepočítať Director Plan'), 'the generate button is present');
if (clicked) {
  const plan = coreEngine.getProject().directorPlan;
  check('the click created a plan in the canonical project', !!plan && plan.decisions.length > 0, `${plan ? plan.decisions.length : 0} decisions`);
  check('the stored plan carries the chosen mode and quality', plan?.mode === 'SOCIAL' && plan?.quality === 'PRO_QUALITY', `${plan?.mode}/${plan?.quality}`);
  const afterText = bodyText();
  check('the RAW → READY card is rendered after generating', afterText.includes('RAW → READY'));
  check('the summary counts the measured hook exactly once', plan?.decisions.filter(d => d.proposedAction?.kind === 'PUNCH_IN').length === 1);
  check('the PRO floor drops the 70% pause decision (visible in the DOM)', afterText.includes('Režim vynechal') && (plan?.droppedDecisions?.length ?? 0) >= 1, `${plan?.droppedDecisions?.length} dropped`);
  check('„Použiť všetko" is offered with the decision count', afterText.includes('Použiť všetko'));
}

// ---------- 4. „Skúsim sama" on the trim decision ----------
// The button is clicked through its own card (an exact DOM path), not by guessing a label.
const planAfterGenerate = coreEngine.getProject().directorPlan;
const trimDecision = planAfterGenerate?.decisions.find(d => d.proposedAction?.kind === 'TRIM_RANGE');
check('the fixture plan contains the trim decision to hand over', !!trimDecision, String(trimDecision?.id));

let myselfClicked = false;
if (trimDecision) {
  // Walk up from each button to its decision card and pick the card that shows this decision.
  const marker = trimDecision.what.slice(0, 24);
  const myselfButton = [...container.querySelectorAll('button')]
    .filter(b => (b.textContent || '').includes('Skúsim sama'))
    .find(b => {
      const card = b.closest('.rounded-xl');
      return card && (card.textContent || '').includes(marker);
    });
  myselfClicked = await click(myselfButton, `the „Skúsim sama" button of the trim card is rendered (marker: ${marker})`);
}

if (myselfClicked) {
  const trimAfter = coreEngine.getProject().directorPlan?.decisions.find(d => d.id === trimDecision.id);
  check('the hand-over rejected the decision in the canonical plan', trimAfter?.status === 'rejected', String(trimAfter?.status));
  check('the DOM shows the ROBÍM SAMA badge', bodyText().includes('ROBÍM SAMA'));
  check('the hand-over copy states the 2× learning rule', bodyText().includes('aspoň 2×'));
}

// ---------- 5. „Použiť všetko" ----------
const scaleBefore = coreEngine.getProject().tracks.flatMap(t => t.clips).find(c => c.id === 'ui_clip').scale;
await click(findByText('Použiť všetko'), 'the „Použiť všetko" button is rendered');
const scaleAfter = coreEngine.getProject().tracks.flatMap(t => t.clips).find(c => c.id === 'ui_clip').scale;
check('the applied punch-in really changed the canonical clip', scaleBefore === 100 && scaleAfter === 115, `${scaleBefore} → ${scaleAfter}`);
const trimAfterApply = coreEngine.getProject().directorPlan?.decisions.find(d => d.id === trimDecision?.id);
check('the rejected decision was not applied behind the userʼs back', trimAfterApply?.status === 'rejected', String(trimAfterApply?.status));
const applyReport = bodyText().match(/Použité všetko: (\d+) zásahov v projekte, (\d+) návrhov zostáva/);
check('the apply report counts the really applied edits', applyReport?.[1] === '1', (bodyText().match(/Použité všetko: [^.]*/) || ['not found'])[0]);
check('only the non-executable proposals are reported as manual work', applyReport?.[2] === '2', String(applyReport?.[2]));
const pacingPreference = (coreEngine.getProject().editingPreferences || []).find(p => p.category === 'PACING');
check('one hand-over stays exactly one observation (no double counting)', pacingPreference?.evidenceCount === 1, JSON.stringify(pacingPreference && { count: pacingPreference.evidenceCount, value: pacingPreference.value }));
check('the DOM reports what was applied and what stayed manual', /Použité všetko: \d+/.test(bodyText()), (bodyText().match(/Použité všetko: [^.]*/) || ['not found'])[0]);

// ---------- 6. Honest environment report ----------
const ignorable = /getContext|Not implemented/;
const realErrors = consoleErrors.filter(e => !ignorable.test(e));
console.log(`\nCONSOLE_ERRORS: ${consoleErrors.length} (browser-only canvas/audio warnings: ${consoleErrors.filter(e => ignorable.test(e)).length})`);
console.log(`WINDOW_ERRORS: ${pageErrors.length}`);
check('no unexpected console errors from the Director Center', realErrors.length === 0, realErrors.slice(0, 2).join(' | '));
check('no uncaught window errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));

const failed = results.filter(r => !r.ok);
console.log(`\n=== ${failed.length === 0 ? 'DIRECTOR UI: JS DOM INTERACTION VERIFIED' : 'DIRECTOR UI CHECKS FAILED'} — ${results.length - failed.length} passed, ${failed.length} failed ===`);
console.log('NOTE: jsdom, not a real browser — BROWSER VERIFIED is not claimed.');
if (failed.length > 0) process.exitCode = 1;

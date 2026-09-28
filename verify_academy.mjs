/**
 * Runtime verification for the Edit Academy fix.
 *
 * Runs the real App in jsdom, then walks the user path by dispatching real DOM clicks:
 *   Test A: Home -> Edit Academy  (Academy must be visible)
 *   Test B: Academy -> lesson click (lesson content must open)
 *   Test C: Lesson -> Back (lesson list again)
 *   Test D: Home -> New Video (editor still reachable)
 *   Test E: Home -> Open Project (projects home still reachable)
 *
 * jsdom has no canvas/WebAudio, so a handful of browser-only warnings are expected and
 * reported explicitly. "BROWSER VERIFIED" is NOT claimed by this script.
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
const { default: App } = await import('/home/user/ohmnistrih/src/App.tsx');

const root = createRoot(document.getElementById('root'));

const settle = async (ms = 400) => {
  await act(async () => { await new Promise(r => setTimeout(r, ms)); });
};

const findByText = (text, selector = 'button') => {
  const nodes = [...document.querySelectorAll(selector)];
  return nodes.find(n => (n.textContent || '').includes(text));
};
const bodyText = () => (document.body.textContent || '').replace(/\s+/g, ' ');

const freshApp = async () => {
  // The stub Home is single-shot (its buttons flip the outer `view` flag), so D and E are
  // verified on fresh App instances instead of on one mutated tree.
  await act(async () => { root.unmount(); });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const r = createRoot(container);
  await act(async () => { r.render(React.createElement(App)); });
  await settle(2000);
  return { r, container };
};

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

await act(async () => { root.render(React.createElement(App)); });
await settle(2500);

// ---------- Test A: Home -> Edit Academy ----------
const academyEntry = findByText('Edit Academy');
check('A1 Home renders an Edit Academy entry point', !!academyEntry, academyEntry ? `"${(academyEntry.textContent || '').trim()}"` : 'button not found');

if (academyEntry) {
  await act(async () => { academyEntry.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  await settle(1200);
}

const academyText = bodyText();
check('A2 Academy overlay rendered', academyText.includes('Edit Academy') && academyText.includes('lekcií z knowledge base'),
  `overlay marker present: ${academyText.includes('lekcií z knowledge base')}`);
check('A3 Academy shows lesson cards', /Lekcia 1/.test(academyText) && academyText.includes('J-Cut'), 'first lesson card "J-Cut" listed');
const cardCount = [...document.querySelectorAll('button')].filter(b => /^Lekcia \d+/.test((b.textContent || '').trim())).length;
check('A4 lesson grid populated from knowledge base', cardCount >= 10, `${cardCount} lesson cards`);

// ---------- Test B: Academy -> lesson click ----------
const firstLesson = [...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('J-Cut'));
if (firstLesson) {
  await act(async () => { firstLesson.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  await settle(500);
}
const lessonText = bodyText();
check('B1 lesson content opened', lessonText.includes('Čo to je (WHAT)') && lessonText.includes('Prečo to funguje (WHY)'),
  lessonText.includes('Čo to je (WHAT)') ? 'WHAT/WHY blocks rendered' : 'lesson body missing');
check('B2 lesson shows WHEN NOT + how-to', lessonText.includes('Kedy NEPOUŽIŤ (WHEN NOT)') && lessonText.includes('Ako to spraviť v editore'), '');
check('B3 lesson shows source/provenance', lessonText.includes('Walter Murch'), 'J-Cut source line rendered');

// ---------- Test C: Back to lesson list ----------
const backBtn = findByText('Späť na zoznam lekcií');
check('C1 back button present', !!backBtn, '');
if (backBtn) {
  await act(async () => { backBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  await settle(400);
}
const backText = bodyText();
check('C2 back returns to lesson list', backText.includes('Lekcia 1') && !backText.includes('Prečo to funguje (WHY)'), '');
check('C3 progress reflects opened lesson', /1 otvorených \(10%\)/.test(backText), (backText.match(/\d+ otvorených \(\d+%\)/) || ['not found'])[0]);

// ---------- Other modules of the same Academy ----------
const multicamTab = findByText('Multicam');
if (multicamTab) {
  await act(async () => { multicamTab.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  await settle(400);
}
check('A5 Multicam module renders existing MulticamAcademy', bodyText().includes('Základy Multicamu') && bodyText().includes('Multicam Academy'), '');
const motionTab = [...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('Pohyb a animácia'));
if (motionTab) {
  await act(async () => { motionTab.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  await settle(400);
}
check('A6 Motion module renders existing MotionAcademy', bodyText().includes('MOTION ACADEMY') && bodyText().includes('Visual Hierarchy'), '');

// ---------- Close Academy ----------
const closeBtn = document.querySelector('button[title="Zavrieť Academy"], button[title="Close Academy"]');
check('A7 Academy has a close control', !!closeBtn, '');
if (closeBtn) {
  await act(async () => { closeBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  await settle(600);
}
check('A8 Academy closes back to the app', !bodyText().includes('lekcií z knowledge base'), '');

// The dashboard Home renders a second entry point (hero row); both must open the Academy.
const academyButtons = [...document.querySelectorAll('button')].filter(b => (b.textContent || '').includes('Edit Academy'));
check('A9 both Home surfaces expose Edit Academy', academyButtons.length >= 2, `${academyButtons.length} entry points`);
if (academyButtons.length >= 2) {
  const dashboardEntry = academyButtons[academyButtons.length - 1];
  await act(async () => { dashboardEntry.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  await settle(900);
  check('A10 dashboard Home entry opens the Academy', bodyText().includes('lekcií z knowledge base'), '');
  const close2 = document.querySelector('button[title="Zavrieť Academy"], button[title="Close Academy"]');
  if (close2) {
    await act(async () => { close2.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await settle(400);
  }
}

// ---------- Test E: Home -> Open Project (fresh instance) ----------
let fresh = await freshApp();
const openProject = findByText('Open Project');
check('E1 Open Project button present on Home', !!openProject, '');
if (openProject) {
  await act(async () => { openProject.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  await settle(1500);
}
const afterOpen = bodyText();
check('E2 Open Project renders the projects home', afterOpen.includes('Vaše Projekty') || afterOpen.includes('Your Projects'),
  `${afterOpen.length} chars of visible text`);
check('E3 Open Project is not a blank screen', afterOpen.length > 400, `${afterOpen.length} chars; sample: "${afterOpen.slice(0, 200)}"`);
const projectCards = [...document.querySelectorAll('button')].filter(b => /Upraviť|Edit/.test((b.textContent || ''))).length;
check('E4 Open Project lists existing projects', projectCards >= 1, `${projectCards} project card action(s)`);
await act(async () => { fresh.r.unmount(); });

// ---------- Test D: Home -> New Video (fresh instance) ----------
fresh = await freshApp();
const newVideo = findByText('New Video');
check('D1 New Video button present on Home', !!newVideo, '');
if (newVideo) {
  await act(async () => { newVideo.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  await settle(2000);
}
const afterNewVideo = bodyText();
const editorMarker = afterNewVideo.includes('Export') || afterNewVideo.includes('Import') || afterNewVideo.includes('Naimportovať');
check('D2 New Video reaches the editor / import flow (not the Home again)', editorMarker,
  `${afterNewVideo.length} chars; sample: "${afterNewVideo.slice(0, 160)}"`);
check('D3 New Video is not a blank screen', afterNewVideo.length > 1000, `${afterNewVideo.length} chars`);
await act(async () => { fresh.r.unmount(); });

console.log('---');
const failed = results.filter(r => !r.ok);
console.log(`SUMMARY: ${results.length - failed.length}/${results.length} checks passed`);
console.log('CONSOLE_ERRORS:', consoleErrors.length);
consoleErrors.slice(0, 8).forEach(e => console.log('  ERR:', e.slice(0, 200)));
console.log('WINDOW_ERRORS:', pageErrors.length);
pageErrors.slice(0, 5).forEach(e => console.log('  WINERR:', e.slice(0, 200)));
console.log(`ACADEMY_RUNTIME: ${failed.length === 0 ? 'PASS (jsdom interaction)' : 'FAIL'}`);
process.exit(failed.length === 0 ? 0 : 1);

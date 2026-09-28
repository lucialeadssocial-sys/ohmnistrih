import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:3000/',
  pretendToBeVisual: true,
});

// Minimal browser globals React 19 needs
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
global.matchMedia = dom.window.matchMedia || (() => ({ matches:false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} }));
global.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
global.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
class MockAudioParam { constructor(){ this.value = 0; } setValueAtTime(){ return this; } linearRampToValueAtTime(){ return this; } exponentialRampToValueAtTime(){ return this; } }
global.AudioContext = class {
  constructor(){ this.currentTime = 0; this.destination = {}; this.sampleRate = 48000; this.state = 'running'; }
  createOscillator(){ return { connect(){}, start(){}, stop(){}, type: '', frequency: new MockAudioParam(), detune: new MockAudioParam() }; }
  createGain(){ return { connect(){}, gain: new MockAudioParam() }; }
  createBiquadFilter(){ return { connect(){}, type: '', frequency: new MockAudioParam(), Q: new MockAudioParam(), gain: new MockAudioParam() }; }
  createBufferSource(){ return { connect(){}, start(){}, stop(){}, buffer: null }; }
  createBuffer(ch, len, rate){ return { length: len, sampleRate: rate, numberOfChannels: ch, getChannelData(){ return new Float32Array(len); } }; }
  createAnalyser(){ return { connect(){}, fftSize: 2048, frequencyBinCount: 1024, getByteFrequencyData(){}, getByteTimeDomainData(){} }; }
  createDynamicsCompressor(){ return { connect(){}, threshold:new MockAudioParam(), knee:new MockAudioParam(), ratio:new MockAudioParam(), attack:new MockAudioParam(), release:new MockAudioParam() }; }
  resume(){ return Promise.resolve(); }
  close(){ return Promise.resolve(); }
};
global.OffscreenCanvas = class { constructor(w,h){this.width=w;this.height=h;} getContext(){return {drawImage(){},fillRect(){},clearRect(){},save(){},restore(){},translate(){},scale(){},fillText(){},measureText(){return {width:0}},beginPath(){},closePath(){},arc(){},fill(){},stroke(){},moveTo(){},lineTo(){}};} };
global.URL.createObjectURL = () => 'blob:mock';
global.URL.revokeObjectURL = () => {};

// capture console errors
const errors = [];
const origError = console.error;
console.error = (...a) => { errors.push(a.map(String).join(' ')); };

const React = (await import('react')).default;
const { createRoot } = await import('react-dom/client');
const { default: App } = await import('/home/user/ohmnistrih/src/App.tsx');

const root = createRoot(document.getElementById('root'));
root.render(React.createElement(App));
await new Promise(r => setTimeout(r, 2500));

const html = document.getElementById('root').innerHTML;
const text = document.getElementById('root').textContent || '';
console.log('RENDERED_CHARS:', html.length);
console.log('TEXT_SAMPLE:', text.slice(0, 220).replace(/\s+/g,' '));
console.log('CONSOLE_ERRORS:', errors.length);
errors.slice(0, 12).forEach(e => console.log('  ERR:', e.slice(0, 300)));
process.exit(0);

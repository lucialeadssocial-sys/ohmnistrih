import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.Event = dom.window.Event;
global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.matchMedia = () => ({ matches:false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} });

const errors = [];
const orig = console.error;
console.error = () => {};

const React = (await import('react')).default;
const { createRoot } = await import('react-dom/client');
const { ErrorBoundary } = await import('./src/components/ErrorBoundary.tsx');

const Boom = () => { throw new Error('simulated studio crash'); };

const root = createRoot(document.getElementById('root'));
root.render(
  React.createElement(ErrorBoundary, { label: 'Test modul', language: 'sk' },
    React.createElement('div', null, 'SIBLING CONTENT'),
    React.createElement(Boom)
  )
);
await new Promise(r => setTimeout(r, 800));
const text = document.getElementById('root').textContent || '';
console.error = orig;
const caught = text.includes('Táto časť aplikácie spadla') && text.includes('Test modul') && text.includes('simulated studio crash');
console.log('BOUNDARY_CAUGHT:', caught);
console.log('TEXT:', text.slice(0, 200).replace(/\s+/g,' '));
process.exit(caught ? 0 : 1);

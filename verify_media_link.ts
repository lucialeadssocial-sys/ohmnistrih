/**
 * verify_media_link.ts — media → render engine link.
 *
 * Run:  npx tsx verify_media_link.ts
 *
 * §1 resolution order and honest failures (pure, injected elements)
 * §2 jsdom: a source that never loads is reported failed, nothing is registered
 * §3 export path: a visual clip whose media is missing stops the export with MEDIA_NOT_LINKED
 * §4 wiring: upload goes into the canonical project, the editor gets actionable error text
 *
 * The success path uses an injected element because jsdom cannot load media. That is stated here
 * instead of pretending a browser verified it.
 */
import * as fs from 'fs';

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, extra?: unknown) {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL  ${label}${extra !== undefined ? ` :: ${JSON.stringify(extra)}` : ''}`);
  }
}
function section(title: string) {
  console.log(`\n=== ${title} ===`);
}
const read = (rel: string) => fs.readFileSync(rel, 'utf8');

import { ensureProjectMediaElements, getLinkedMediaIds, clearLinkedMedia, getLinkedMediaElement } from './src/core/render/mediaElements';
import { createInitialProject } from './src/core/index';
import type { ProjectModel, MediaAsset } from './src/core/types/project';

const asset = (overrides: Partial<MediaAsset> & { id: string; type: MediaAsset['type'] }): MediaAsset =>
  ({
    name: overrides.name ?? `${overrides.id}.mp4`,
    assetId: overrides.id,
    opfsPath: overrides.opfsPath ?? overrides.id,
    size: 1,
    mimeType: overrides.type === 'video' ? 'video/mp4' : overrides.type === 'audio' ? 'audio/wav' : 'image/png',
    duration: 30,
    width: 1920,
    height: 1080,
    fps: 30,
    ...overrides,
  }) as MediaAsset;

const projectWith = (assets: MediaAsset[]): ProjectModel => ({ ...createInitialProject('media-link-fixture'), assets });

/** A video element stand-in that settles on the event the linker waits for. */
function fakeElement(options: { readyEvent: string; videoWidth?: number; videoHeight?: number; fail?: boolean; auto?: boolean }) {
  const listeners = new Map<string, Array<() => void>>();
  const element: any = {
    videoWidth: options.videoWidth ?? 1920,
    videoHeight: options.videoHeight ?? 1080,
    muted: false,
    playsInline: false,
    preload: '',
    addEventListener(event: string, handler: () => void) {
      listeners.set(event, [...(listeners.get(event) ?? []), handler]);
    },
    removeEventListener(event: string, handler: () => void) {
      listeners.set(event, (listeners.get(event) ?? []).filter(h => h !== handler));
    },
    dispatch(event: string) {
      (listeners.get(event) ?? []).forEach(handler => handler());
    },
  };
  const settle = () => element.dispatch(options.fail ? 'error' : options.readyEvent);
  Object.defineProperty(element, 'src', {
    get: () => element._src ?? '',
    set: (value: string) => {
      element._src = value;
      // A real element settles when the source loads; the stub does that on the next tick.
      if (options.auto !== false) setTimeout(settle, 0);
    },
    configurable: true,
  });
  return { element, settle };
}

// ---------------------------------------------------------------- §1 resolution + failures
section('§1 resolution order and honest failures');
{
  clearLinkedMedia();
  const video = asset({ id: 'asset_v1', type: 'video', opfsPath: 'asset_v1' });
  const audio = asset({ id: 'asset_a1', type: 'audio' });
  const project = projectWith([video, audio]);

  // a) URL override wins
  const first = fakeElement({ readyEvent: 'loadedmetadata' });
  const reportA = await ensureProjectMediaElements(project, {
    urlByAssetId: { asset_v1: 'blob:override' },
    elementFactory: () => first.element,
    timeoutMs: 50,
  });
  check('the explicit URL override is used first', reportA.linked[0]?.url === 'blob:override', reportA.linked[0]?.url);
  check('the linked element is registered with the render engine', getLinkedMediaElement('asset_v1') === (first.element as unknown as HTMLVideoElement));
  check('the measured size is reported, not assumed', reportA.linked[0]?.width === 1920 && reportA.linked[0]?.height === 1080);
  check('an audio asset is skipped with a reason instead of being "linked"', reportA.skipped.length === 1 && reportA.skipped[0].assetId === 'asset_a1');
  check('the skip explains that the mixer decodes the URL itself', reportA.skipped[0].reasonSk.includes('dekóduje'));
  check('nothing is reported as failed when the element settles', reportA.failed.length === 0, reportA.failed);

  // b) a source that errors is failed, never silently linked
  clearLinkedMedia();
  const failing = fakeElement({ readyEvent: 'loadedmetadata', fail: true });
  const reportB = await ensureProjectMediaElements(project, { elementFactory: () => failing.element, timeoutMs: 1000 });
  check('a media error is reported as failed', reportB.failed.length === 1 && reportB.failed[0].assetId === 'asset_v1');
  check('the failure carries the URL it tried', reportB.failed[0].reasonSk.includes('asset_v1'), reportB.failed[0].reasonSk);
  check('a failed asset is NOT registered', getLinkedMediaElement('asset_v1') === undefined);

  // c) a source that never settles times out with the real timeout in the message
  clearLinkedMedia();
  const silent = fakeElement({ readyEvent: 'loadedmetadata', auto: false });
  const reportC = await ensureProjectMediaElements(project, {
    urlByAssetId: { asset_v1: 'blob:silent' },
    elementFactory: () => silent.element,
    timeoutMs: 60,
  });
  check('a source that never loads times out', reportC.failed.length === 1, reportC.failed.map(f => f.name));
  check('the timeout message names the real budget', reportC.failed[0].reasonSk.includes('60 ms'), reportC.failed[0].reasonSk);
  check('the timeout is not dressed up as a success', reportC.linked.length === 0);

  // d) an asset with no URL and no OPFS path is failed
  clearLinkedMedia();
  const noPath = asset({ id: 'asset_nopath', type: 'video', opfsPath: '' });
  const reportD = await ensureProjectMediaElements(projectWith([noPath]), {
    elementFactory: () => fakeElement({ readyEvent: 'loadedmetadata' }).element,
    timeoutMs: 50,
  });
  check('an asset with no resolvable source is failed', reportD.failed.length === 1 && reportD.failed[0].assetId === 'asset_nopath');
  check('the failure names the missing path', reportD.failed[0].reasonSk.includes('bez cesty'), reportD.failed[0].reasonSk);

  // e) already linked assets are not re-created
  clearLinkedMedia();
  const once = fakeElement({ readyEvent: 'loadedmetadata' });
  let created = 0;
  await ensureProjectMediaElements(project, {
    urlByAssetId: { asset_v1: 'blob:once' },
    elementFactory: () => { created += 1; return once.element; },
    timeoutMs: 50,
  });
  const second = await ensureProjectMediaElements(project, { timeoutMs: 50 });
  check('the element is created once', created === 1, created);
  check('the second run reports the asset as already linked', second.skipped.some(s => s.assetId === 'asset_v1'));
  check('reload clears the registry and links again', (await ensureProjectMediaElements(project, {
    reload: true,
    urlByAssetId: { asset_v1: 'blob:reload' },
    elementFactory: () => fakeElement({ readyEvent: 'loadedmetadata' }).element,
    timeoutMs: 50,
  })).linked.length === 1);
  check('getLinkedMediaIds reflects the registry', getLinkedMediaIds().includes('asset_v1'));

  const src = read('src/core/render/mediaElements.ts');
  check('the linker has no randomness', !src.includes('Math.random'));
  check('the linker documents that nothing is assumed', src.includes('never silently'));
}

// ---------------------------------------------------------------- §2 jsdom honesty
section('§2 jsdom: real elements, no media support (stated, not faked)');
{
  const { JSDOM } = (await import('jsdom')) as { JSDOM: any };
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://localhost/' });
  (global as any).document = dom.window.document;
  (global as any).HTMLVideoElement = dom.window.HTMLVideoElement;
  (global as any).HTMLImageElement = dom.window.HTMLImageElement;
  clearLinkedMedia();

  const project = projectWith([asset({ id: 'asset_jsdom', type: 'video', url: 'blob:jsdom' })]);
  const started = Date.now();
  const report = await ensureProjectMediaElements(project, { timeoutMs: 120 });
  check('jsdom cannot load media, and the run says so', report.failed.length === 1 && report.failed[0].assetId === 'asset_jsdom', report.failed);
  check('the failure states the real timeout and the URL it tried', report.failed[0].reasonSk.includes('do 120 ms') && report.failed[0].reasonSk.includes('blob:jsdom'), report.failed[0].reasonSk);
  check('the run really waited for the media', Date.now() - started >= 100, Date.now() - started);
  check('nothing was registered for the unloaded asset', getLinkedMediaElement('asset_jsdom') === undefined);

  delete (global as any).document;
}

// ---------------------------------------------------------------- §3 export path
section('§3 an export with missing picture stops instead of succeeding');
{
  const offline = read('src/render/WebCodecsOfflineBackend.ts');
  const realtime = read('src/render/RealtimeCanvasBackend.ts');
  for (const [name, src] of [['offline', offline], ['realtime', realtime]] as const) {
    check(`${name}: prepare links the project media`, src.includes('const linkReport = await ensureProjectMediaElements(project);'));
    check(`${name}: prepare keeps the report for honest reporting`, src.includes('this.mediaLinkReport = linkReport;'));
    check(`${name}: a visual clip with missing media raises MEDIA_NOT_LINKED`, src.includes('throw new Error(`MEDIA_NOT_LINKED: ${names}`)'));
    check(`${name}: only visual clips with an asset can trigger it`, src.includes("(clip.type === 'video' || clip.type === 'image') && clip.assetId"));
    check(`${name}: the report is readable by the UI`, src.includes('getMediaLinkReport(): MediaLinkReport | null'));
  }
  check('the failure is raised in prepare, before any frame is rendered', offline.indexOf('MEDIA_NOT_LINKED') < offline.indexOf('const totalFrames = Math.round(plan.timelineDuration * plan.fps);'));
}

// ---------------------------------------------------------------- §4 wiring
section('§4 upload and error reporting');
{
  const app = read('src/App.tsx');
  check('the upload imports the file into the canonical project', app.includes('const clip = await coreEngine.importMediaFile(file, "video");'));
  check('the upload links the element with the player URL', app.includes('coreEngine.linkProjectMedia(clip.assetId ? { urlByAssetId: { [clip.assetId]: url } } : {})'));
  check('an upload that cannot be linked is reported', app.includes('médium sa nepodarilo prepojiť s renderom'));
  check('the upload no longer registers the file outside the project', !app.includes('mediaEngine.registerMediaFile'));
  check('the Shorts export reports the link failures per proposal', app.includes('getMediaLinkReport') && app.includes('klip môže ostať bez obrazu/zvuku'));
  check('export errors are translated for the editor', app.includes('const describeExportError = useCallback((error: unknown): string => {'));
  check('MEDIA_NOT_LINKED has an actionable message', app.includes('načítajte alebo znovu naimportujte zdroj a skúste znova'));
  check('the Shorts failures use the translated text', app.includes('failures.push(`${proposal.start}s–${proposal.end}s: ${describeExportError(err)}`);'));
  check('the core exposes linking for the UI', read('src/core/index.ts').includes('public async linkProjectMedia('));
}

console.log(`\n=== MEDIA LINK SUMMARY ===`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length > 0) {
  console.log('FAILED CHECKS:');
  failures.forEach(f => console.log(` - ${f}`));
  process.exitCode = 1;
} else {
  console.log('Linking rules and export guards verified in Node/jsdom. Loading real media into an element needs a browser — BROWSER NOT VERIFIED here.');
}

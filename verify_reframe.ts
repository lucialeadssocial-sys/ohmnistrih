/**
 * verify_reframe.ts — 9:16 deliverable must fill the frame.
 *
 * Run:  npx tsx verify_reframe.ts
 *
 * §1 reframe maths (pure, no canvas): uniform scale, aspect preserved, honest notes
 * §2 render plan wiring: social presets request COVER, others keep FIT, window plans keep it
 * §3 source guards: renderEngine applies it, the offline backend passes it, the realtime
 *    fallback does not claim what it cannot do
 * §4 subject track: measured faces move the crop, absent measurements never invent a position
 *
 * This harness calls no browser API. It does not claim that a rendered frame was inspected.
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

import { computeReframeTransform } from './src/core/render/reframe';
import { RenderEngineManager } from './src/utils/renderEngineManager';

const aspect = (w: number, h: number) => Math.round((w / h) * 10000) / 10000;

// ---------------------------------------------------------------- §1 maths
section('§1 reframe maths');
{
  const wide = computeReframeTransform(1920, 1080, 1080, 1920, 'COVER');
  check('16:9 source into 9:16 canvas scales to fill the height', wide.scale === 1.7778, wide.scale);
  check('the filled frame is 3413×1920 (sides are cropped, nothing distorted)', Math.round(1920 * wide.scale) === 3413 && Math.round(1080 * wide.scale) === 1920);
  check('COVER reports the frame as filled', wide.fillsFrame === true);
  check('COVER reports the upscale honestly', wide.upscaled === true);
  check('the note explains the frame is filled without distortion', wide.noteSk.includes('vyplní rám') && wide.noteSk.includes('bez zdeformovania'), wide.noteSk);
  check('aspect ratio is preserved', aspect(1920 * wide.scale, 1080 * wide.scale) === aspect(1920, 1080));

  const alreadyVertical = computeReframeTransform(1080, 1920, 1080, 1920, 'COVER');
  check('a matching source is drawn 1:1 (no pointless scaling)', alreadyVertical.scale === 1, alreadyVertical.scale);
  check('a 1:1 match still counts as a filled frame', alreadyVertical.fillsFrame === true);
  check('a 1:1 match is not reported as an upscale', alreadyVertical.upscaled === false);

  const small = computeReframeTransform(720, 1280, 1080, 1920, 'COVER');
  check('a 720p vertical source is enlarged 1.5×', small.scale === 1.5, small.scale);
  check('upscale is named in the note', small.noteSk.includes('zdroj je menší'), small.noteSk);

  const oversized = computeReframeTransform(3840, 2160, 1080, 1920, 'COVER');
  check('a 4K wide source is scaled down to fill', oversized.scale === 0.8889, oversized.scale);
  check('downscale is not called an upscale', oversized.upscaled === false);
  check('downscale still fills the frame', Math.round(3840 * oversized.scale) >= 1080 && Math.round(2160 * oversized.scale) >= 1920);

  const square = computeReframeTransform(1000, 1000, 1080, 1920, 'COVER');
  check('a square source fills the height and crops the sides', square.scale === 1.92 && Math.round(1000 * square.scale) === 1920, square.scale);

  const fit = computeReframeTransform(1920, 1080, 1080, 1920, 'FIT');
  check('FIT keeps the legacy native-size drawing', fit.scale === 1 && fit.fillsFrame === false);
  check('FIT says a black bar may remain', fit.noteSk.includes('čierny pruh'), fit.noteSk);

  const invalid = computeReframeTransform(0, 0, 1080, 1920, 'COVER');
  check('unknown dimensions fall back to native size', invalid.scale === 1);
  check('unknown dimensions are declared, not guessed', invalid.noteSk.includes('nie sú k dispozícii'), invalid.noteSk);
  const nan = computeReframeTransform(NaN, 1080, 1080, 1920, 'COVER');
  check('NaN dimensions are treated as unknown', nan.scale === 1);

  check('the transform is deterministic', JSON.stringify(computeReframeTransform(1920, 1080, 1080, 1920, 'COVER')) === JSON.stringify(wide));
  check('the maths never distorts (uniform scale object)', typeof wide.scale === 'number' && Number.isFinite(wide.scale));
}

// ---------------------------------------------------------------- §2 plan wiring
section('§2 render plans ask for what the deliverable needs');
{
  const vertical = RenderEngineManager.createRenderPlan('current-project', 'SOCIAL_VERTICAL');
  check('SOCIAL_VERTICAL requests COVER', vertical.reframe === 'COVER', vertical.reframe);
  check('SOCIAL_VERTICAL is 1080×1920', vertical.outputWidth === 1080 && vertical.outputHeight === 1920);

  const square = RenderEngineManager.createRenderPlan('current-project', 'SOCIAL_SQUARE');
  check('SOCIAL_SQUARE requests COVER', square.reframe === 'COVER', square.reframe);

  const landscape = RenderEngineManager.createRenderPlan('current-project', 'YOUTUBE_LANDSCAPE');
  check('YOUTUBE_LANDSCAPE keeps FIT (unchanged behaviour)', landscape.reframe === 'FIT', landscape.reframe);

  const window = RenderEngineManager.createRenderPlan('current-project', 'SOCIAL_VERTICAL', undefined, undefined, { start: 10, end: 40 });
  check('a window plan keeps COVER', window.reframe === 'COVER', window.reframe);
  check('the window plan still reports the window length', window.timelineDuration === 30, window.timelineDuration);
  check('the window plan carries its source range', window.sourceRange?.start === 10 && window.sourceRange?.end === 40);
}

// ---------------------------------------------------------------- §3 source guards
section('§3 the render path really applies it');
{
  const engine = read('src/core/render/renderEngine.ts');
  check('renderFrame accepts a reframe option', engine.includes('reframe?: ReframeMode'));
  check('renderFrame stores the requested mode', engine.includes("this.activeReframe = options?.reframe ?? 'FIT';"));
  check('media clips are scaled by the computed cover factor', engine.includes('ctx.scale(reframe.scale, reframe.scale);'));
  check(
    'the reframe is computed from real media dimensions',
    /computeReframeTransform\(\s*mediaWidth,\s*mediaHeight,\s*canvasWidth,\s*canvasHeight,\s*this\.activeReframe/.test(engine),
  );
  check('the reframe module is imported by the renderer', engine.includes("from './reframe'"));
  check('the default stays FIT (no silent change for other callers)', engine.includes("private activeReframe: ReframeMode = 'FIT';"));

  const backend = read('src/render/WebCodecsOfflineBackend.ts');
  check(
    'the offline export passes the plan reframe',
    backend.includes('renderEngine.renderFrame(project, timelineTime, canvas, {') && backend.includes("reframe: plan.reframe ?? 'FIT'"),
  );

  const manager = read('src/utils/renderEngineManager.ts');
  check('the manager decides by preset', manager.includes("reframe: presetId.startsWith('SOCIAL_') ? 'COVER' : 'FIT',"));

  const realtime = read('src/render/RealtimeCanvasBackend.ts');
  check('the realtime fallback does not claim reframe support', !realtime.includes('COVER') && !realtime.includes('computeReframeTransform'));

  const panel = read('src/components/ShortsEnginePanel.tsx');
  check('the Shorts panel states that the frame is filled', panel.includes('9:16 rám sa vyplní (cover)'));
  check('the Shorts panel states that the crop follows a measured track only', panel.includes('výrez sa posunie za nameranou tvárou') && panel.includes('pozícia sa nikdy neodhaduje'));

  const reframe = read('src/core/render/reframe.ts');
  check('the reframe module never runs detection itself (it only consumes measured samples)', !/trackFace|faceDetection|detectFace|FaceDetector/i.test(reframe));
  check('the reframe module has no randomness', !reframe.includes('Math.random'));

  const app = read('src/App.tsx');
  check('the Shorts export renders the 9:16 preset with the proposal window', app.includes('"SOCIAL_VERTICAL",') && app.includes('{ start: proposal.start, end: proposal.end }'));
}

// ---------------------------------------------------------------- §4 subject track
section('§4 measured subject moves the crop — and nothing else does');
{
  const wide = computeReframeTransform(1920, 1080, 1080, 1920, 'COVER');
  check('without a subject there is no offset and the crop stays centred', wide.offsetX === 0 && wide.offsetY === 0 && wide.subjectTracked === false);
  check('without a subject the note says the framing stays centred', wide.noteSk.includes('vystredený'), wide.noteSk);

  // A face on the left edge of a wide shot: the 9:16 crop must travel towards it, and stop at the edge.
  const leftFace = { x: 260, y: 420, width: 200, height: 240, confidence: 0.91, time: 1 };
  const left = computeReframeTransform(1920, 1080, 1080, 1920, 'COVER', { subject: leftFace });
  check('a measured face switches the transform to tracked', left.subjectTracked === true);
  check('the crop moves towards the measured face', left.offsetX < 0, left.offsetX);
  // The visible window is what the 9:16 canvas actually shows, expressed in media pixels.
  const windowOf = (t: { offsetX: number; offsetY: number; scale: number }, mw: number, mh: number, cw: number, ch: number) => {
    const w = cw / t.scale;
    const h = ch / t.scale;
    return { left: mw / 2 + t.offsetX - w / 2, right: mw / 2 + t.offsetX + w / 2, top: mh / 2 + t.offsetY - h / 2, bottom: mh / 2 + t.offsetY + h / 2, w, h };
  };
  const lw = windowOf(left, 1920, 1080, 1080, 1920);
  check('the shifted crop never leaves the media', lw.left >= -1e-6 && lw.right <= 1920 + 1e-6, { left: lw.left, right: lw.right });
  // The tracked point is the face centre: it must sit inside the visible window with the margin
  // (expressed in media pixels, since the window is measured in media pixels too).
  const marginInMedia = 0.15 * lw.w;
  const subjectInsideLeft = (leftFace.x - lw.left) >= marginInMedia - 0.01;
  const subjectInsideRight = (lw.right - leftFace.x) >= marginInMedia - 0.01;
  check('the measured face centre stays inside the crop with the full 15% margin', subjectInsideLeft && subjectInsideRight, {
    distanceFromLeft: leftFace.x - lw.left,
    distanceFromRight: lw.right - leftFace.x,
    margin: marginInMedia,
  });
  check('the tracked face is visible inside the 9:16 frame', (() => {
    const centreInCanvas = (leftFace.x - lw.left) * left.scale;
    return centreInCanvas > 0 && centreInCanvas < 1080;
  })());

  // Vertical source: a face high in the frame must not push the crop out of the media.
  const highFace = { x: 500, y: 120, width: 200, height: 240, confidence: 0.8, time: 2 };
  const high = computeReframeTransform(1080, 1920, 1080, 1920, 'COVER', { subject: highFace });
  check('a matching source with a measured face keeps scale 1', high.scale === 1);
  check('a 1:1 crop cannot move (there is nothing to crop)', high.offsetX === 0 && high.offsetY === 0, { x: high.offsetX, y: high.offsetY });
  check('a 1:1 tracked frame is still reported as tracked', high.subjectTracked === true);
  check('the tracked note names the measured position', high.noteSk.includes('Meraný subjekt'), high.noteSk);

  const squareFace = { x: 500, y: 500, width: 300, height: 300, confidence: 0.77, time: 3 };
  const square = computeReframeTransform(1000, 1000, 1080, 1920, 'COVER', { subject: squareFace });
  check('a centred face in a square source stays centred', Math.abs(square.offsetX) < 1e-9 && Math.abs(square.offsetY) < 1e-9, { x: square.offsetX, y: square.offsetY });

  const nanFace = { x: NaN, y: 100, width: 200, height: 240, confidence: 0.5, time: 4 };
  const broken = computeReframeTransform(1920, 1080, 1080, 1920, 'COVER', { subject: nanFace });
  check('a broken measurement is ignored, not guessed', broken.offsetX === 0 && broken.offsetY === 0 && broken.subjectTracked === false, { tracked: broken.subjectTracked });

  const fitWithFace = computeReframeTransform(1920, 1080, 1080, 1920, 'FIT', { subject: leftFace });
  check('FIT never shifts a crop (there is nothing to crop)', fitWithFace.offsetX === 0 && fitWithFace.offsetY === 0 && fitWithFace.subjectTracked === false);

  const first = computeReframeTransform(1920, 1080, 1080, 1920, 'COVER', { subject: leftFace });
  check('subject-driven reframe is deterministic', JSON.stringify(first) === JSON.stringify(left));
  check('a larger margin pulls the crop further and still stays inside the media', (() => {
    const tight = computeReframeTransform(1920, 1080, 1080, 1920, 'COVER', { subject: leftFace, margin: 0.4 });
    const w = windowOf(tight, 1920, 1080, 1080, 1920);
    return (
      tight.subjectTracked === true &&
      tight.offsetX < left.offsetX &&
      w.left >= -1e-6 &&
      w.right <= 1920 + 1e-6 &&
      (leftFace.x - w.left) >= 0.4 * w.w - 0.01
    );
  })());

  // The auto-reframe switch is a real control: it must reach the plan and the frame renderer.
  check('the plan always carries the switch, on by default', RenderEngineManager.createRenderPlan('current-project', 'SOCIAL_VERTICAL').trackSubject === true);
  check('the plan carries the switch as off when the user turned it off', RenderEngineManager.createRenderPlan('current-project', 'SOCIAL_VERTICAL', undefined, undefined, undefined, { trackSubject: false }).trackSubject === false);
  const gatedPlan = RenderEngineManager.createRenderPlan('current-project', 'SOCIAL_VERTICAL', undefined, undefined, undefined, { trackSubject: false });
  check('switching it off does not change the reframe mode itself', gatedPlan.reframe === 'COVER');

  const renderEngine = read('src/core/render/renderEngine.ts');
  check('the renderer only tracks clips the user has not framed by hand', renderEngine.includes('positionX === 0 && positionY === 0'));
  check('the renderer honours the switch before using the measured track', renderEngine.includes('this.activeTrackSubject && subjectSamples.length > 0'));
  check('renderFrame accepts the switch', renderEngine.includes('options?: { reframe?: ReframeMode; trackSubject?: boolean }'));
  const backend = read('src/render/WebCodecsOfflineBackend.ts');
  check('the offline export passes the switch from the plan', backend.includes("trackSubject: plan.trackSubject !== false"));
  const app = read('src/App.tsx');
  check('the Shorts export sends the user switch into the plan', app.includes('{ trackSubject: settings.autoReframeFace }'));
  check('the toggle no longer promises automatic face tracking', read('src/components/FeatureToggles.tsx').includes('Face-safe reframe (namerané pozície tváre)'));
  check('the export dialog respects the same switch', read('src/components/ExportModal.tsx').includes('trackSubject: settings.autoReframeFace'));
  check('the professional export center respects the same switch', read('src/components/ProfessionalExportCenter.tsx').includes('trackSubject: settings.autoReframeFace'));
  check('the renderer reads the track from the canonical analysis results', renderEngine.includes('analysisResults?.subjectTrack'));
  check('the renderer translates by the measured offset after scaling', /ctx\.translate\(reframe\.offsetX, reframe\.offsetY\)/.test(renderEngine));

  const core = read('src/core/index.ts');
  check('the core exposes a single canonical writer for the track', core.includes('recordSubjectTrack(samples'));
  check('storing with replace swaps the measured positions (empty array clears them)', core.includes('const replace = options.replace ?? true') && core.includes('merged = samples.slice()'));

  const track = read('src/core/vision/subjectTrack.ts');
  check('the detector module reports when the API is missing instead of inventing data', track.includes('faceDetectionAvailable'));
  check('the detector module never falls back to a guessed position', !/Math\.random/.test(track) && !/fallback.*(center|centre)/i.test(track));
  check('the studio is honest when the browser cannot detect faces', read('src/App.tsx').includes('Detekcia tvárí nie je v tomto prehliadači dostupná'));
  check('the studio no longer ships hardcoded attention points', !read('src/App.tsx').includes('Vlogovací set'));
  const studio = read('src/components/VisualAttentionStudio.tsx');
  check('the studio converts measured pixels to the percent boxes the overlay draws', app.includes('const pct = (value: number) => Math.min(100, Math.max(0, value * 100));'));
  check('the studio switch drives the real setting, not a local flag', app.includes('onToggleAutoFollow={(val: boolean) => setSettings') && read('src/components/RawToReadyPipeline.tsx').includes('onUpdateSettings({ autoReframeFace: val })'));
  check('the overlay no longer claims to measure visual attention', !studio.includes('ATTENTION HEATMAP LIVE') && !studio.includes('VISUAL ENERGY DISTRIBUTION'));
  check('the overlay is labelled as a schematic of measured boxes', studio.includes('SCHÉMA NAMERANÝCH POZÍCIÍ'));
  check('applying a suggestion goes through the canonical command layer', app.includes('coreEngine.applyDirectorDecisions([decision]'));
  check('the studio admits it cannot measure without a detector', app.includes('faceDetectionAvailable()'));
}

console.log(`\n=== REFRAME SUMMARY ===`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length > 0) {
  console.log('FAILED CHECKS:');
  failures.forEach(f => console.log(` - ${f}`));
  process.exitCode = 1;
} else {
  console.log('Reframe maths and plan wiring verified in Node — no frame was rendered or inspected here.');
}

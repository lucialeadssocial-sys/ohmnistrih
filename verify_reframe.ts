/**
 * verify_reframe.ts — 9:16 deliverable must fill the frame.
 *
 * Run:  npx tsx verify_reframe.ts
 *
 * §1 reframe maths (pure, no canvas): uniform scale, aspect preserved, honest notes
 * §2 render plan wiring: social presets request COVER, others keep FIT, window plans keep it
 * §3 source guards: renderEngine applies it, the offline backend passes it, the realtime
 *    fallback does not claim what it cannot do
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
  check('renderFrame accepts a reframe option', engine.includes('options?: { reframe?: ReframeMode }'));
  check('renderFrame stores the requested mode', engine.includes("this.activeReframe = options?.reframe ?? 'FIT';"));
  check('media clips are scaled by the computed cover factor', engine.includes('ctx.scale(reframe.scale, reframe.scale);'));
  check('the reframe is computed from real media dimensions', engine.includes('computeReframeTransform(mediaWidth, mediaHeight, canvasWidth, canvasHeight, this.activeReframe)'));
  check('the reframe module is imported by the renderer', engine.includes("from './reframe'"));
  check('the default stays FIT (no silent change for other callers)', engine.includes("private activeReframe: ReframeMode = 'FIT';"));

  const backend = read('src/render/WebCodecsOfflineBackend.ts');
  check('the offline export passes the plan reframe', backend.includes("renderEngine.renderFrame(project, timelineTime, canvas, { reframe: plan.reframe ?? 'FIT' })"));

  const manager = read('src/utils/renderEngineManager.ts');
  check('the manager decides by preset', manager.includes("reframe: presetId.startsWith('SOCIAL_') ? 'COVER' : 'FIT',"));

  const realtime = read('src/render/RealtimeCanvasBackend.ts');
  check('the realtime fallback does not claim reframe support', !realtime.includes('COVER') && !realtime.includes('computeReframeTransform'));

  const panel = read('src/components/ShortsEnginePanel.tsx');
  check('the Shorts panel states that the frame is filled', panel.includes('9:16 rám sa vyplní (cover)'));
  check('the Shorts panel states that face tracking is not implemented', panel.includes('sledovanie tváre nie je implementované'));

  const reframe = read('src/core/render/reframe.ts');
  check('the reframe module never claims face tracking', !/trackFace|faceDetection|detectFace/i.test(reframe));
  check('the reframe module has no randomness', !reframe.includes('Math.random'));

  const app = read('src/App.tsx');
  check('the Shorts export renders the 9:16 preset with the proposal window', app.includes('"SOCIAL_VERTICAL",') && app.includes('{ start: proposal.start, end: proposal.end }'));
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

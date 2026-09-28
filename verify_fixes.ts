/**
 * Verification for the "reality fixes" batch.
 *
 * Covers behaviour that can be checked without a browser: canonical commands (multicam
 * offsets, EQ/compression persistence, undo/redo), the QC gate result shape, and the
 * audio-mastering bridge into the canonical project.
 *
 * Browser-only behaviour (J reverse playback, realtime canvas drawing, UI badges) is NOT
 * asserted here — those need a real browser and are reported as BROWSER NOT VERIFIED.
 */
import { coreEngine } from './src/core';
import { RenderEngineManager } from './src/utils/renderEngineManager';
import { SetEQCommand, SetCompressionCommand } from './src/core/command/commandSystem';
import { createCanonicalClip } from './src/core/types/project';
import { measureImageData, histogramSimilarity, DARK_LUMINANCE_THRESHOLD } from './src/core/media/frameMetrics';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
};

process.on('unhandledRejection', (e) => { console.error('unhandledRejection', e); process.exit(1); });

console.log('=== 1. Multicam sync stores measured offsets ===');
{
  const project = coreEngine.getProject();
  const videoTrack = project.tracks.find(t => t.type === 'video')!;
  const a = createCanonicalClip({
    id: `fix_angle_a_${Date.now()}`, trackId: videoTrack.id, name: 'Angle A', type: 'video',
    timelineStart: 0, duration: 5, sourceStart: 0, sourceEnd: 5, speed: 1, volume: 100,
    scale: 100, opacity: 100, positionX: 0, positionY: 0, rotation: 0, keyframes: [], assetId: 'asset_a',
  });
  const b = createCanonicalClip({
    id: `fix_angle_b_${Date.now()}`, trackId: videoTrack.id, name: 'Angle B', type: 'video',
    timelineStart: 5, duration: 5, sourceStart: 0, sourceEnd: 5, speed: 1, volume: 100,
    scale: 100, opacity: 100, positionX: 0, positionY: 0, rotation: 0, keyframes: [], assetId: 'asset_b',
  });
  coreEngine.addClip(videoTrack.id, a);
  coreEngine.addClip(videoTrack.id, b);

  coreEngine.syncMulticam([a.id, b.id], 'Verejný test', 'waveform', { asset_b: 1.25 }, true);
  const group = (coreEngine.getProject().multicamGroups || []).slice(-1)[0];
  check('group created', !!group, group?.name);
  const angleB = group?.angles.find(x => x.assetId === 'asset_b');
  const angleA = group?.angles.find(x => x.assetId === 'asset_a');
  check('measured offset stored on angle B', angleB?.offset === 1.25, `offset=${angleB?.offset}`);
  check('reference angle stays at 0', angleA?.offset === 0, `offset=${angleA?.offset}`);
  check('group records syncVerified=true', (group as any)?.syncVerified === true, `${(group as any)?.syncVerified}`);
  check('group records the effective sync method', group?.syncMethod === 'waveform', group?.syncMethod);
}

console.log('=== 2. Manual / unsupported sync is not marked verified ===');
{
  const project = coreEngine.getProject();
  const videoTrack = project.tracks.find(t => t.type === 'video')!;
  const c = createCanonicalClip({
    id: `fix_manual_${Date.now()}`, trackId: videoTrack.id, name: 'Manual angle', type: 'video',
    timelineStart: 10, duration: 3, sourceStart: 0, sourceEnd: 3, speed: 1, volume: 100,
    scale: 100, opacity: 100, positionX: 0, positionY: 0, rotation: 0, keyframes: [], assetId: 'asset_c',
  });
  coreEngine.addClip(videoTrack.id, c);
  const prev = (coreEngine.getProject().multicamGroups || []).slice(-1)[0];
  coreEngine.syncMulticam([c.id], 'Manuálna skupina', 'manual', {}, false);
  const group = (coreEngine.getProject().multicamGroups || []).slice(-1)[0];
  check('new group is distinct from the previous one', group?.id !== prev?.id);
  check('manual sync is flagged unverified', (group as any)?.syncVerified === false, `${(group as any)?.syncVerified}`);
  check('manual offset stays 0', group?.angles[0]?.offset === 0, `${group?.angles[0]?.offset}`);
}

console.log('=== 3. Audio mastering writes real canonical state (EQ + compression) ===');
{
  const project = coreEngine.getProject();
  const videoTrack = project.tracks.find(t => t.type === 'video')!;
  const clip = createCanonicalClip({
    id: `fix_eq_${Date.now()}`, trackId: videoTrack.id, name: 'Speech', type: 'audio',
    timelineStart: 0, duration: 4, sourceStart: 0, sourceEnd: 4, speed: 1, volume: 100,
    scale: 100, opacity: 100, positionX: 0, positionY: 0, rotation: 0, keyframes: [],
  });
  coreEngine.addClip(videoTrack.id, clip);

  const okEq = coreEngine.commandManager.executeCommand(new SetEQCommand(clip.id, {
    enabled: true, bypass: false,
    highPass: { enabled: true, freq: 80 },
    lowShelf: { freq: 120, gain: 2.5 },
    mid: { freq: 400, gain: -3, q: 1.4 },
    highShelf: { freq: 8000, gain: 2 },
  }));
  const okComp = coreEngine.commandManager.executeCommand(new SetCompressionCommand(clip.id, {
    enabled: true, bypass: false, threshold: -24, ratio: 5, attack: 0.01, release: 0.25, makeupGain: 0,
  }));

  const stored = coreEngine.getProject().tracks.flatMap(t => t.clips).find(x => x.id === clip.id);
  check('EQ command executed', okEq);
  check('compression command executed', okComp);
  check('EQ persisted on the canonical clip', !!stored?.audioEffects?.eq, JSON.stringify(stored?.audioEffects?.eq));
  check('high-pass band persisted', stored?.audioEffects?.eq?.highPass?.enabled === true, `${stored?.audioEffects?.eq?.highPass?.freq} Hz`);
  check('compression persisted on the canonical clip', stored?.audioEffects?.compression?.ratio === 5, `ratio=${stored?.audioEffects?.compression?.ratio}`);
}

console.log('=== 4. Undo / redo reflect canonical history (header wiring) ===');
{
  const canUndo = coreEngine.commandManager.canUndo();
  check('canUndo is true after commands', canUndo === true, `${canUndo}`);
  const snapshot = () => JSON.stringify(coreEngine.getProject().tracks.flatMap(t => t.clips));
  const before = snapshot();
  const ok = coreEngine.undo();
  const afterUndo = snapshot();
  check('undo executes', ok === true);
  check('undo changed the canonical project', afterUndo !== before);
  check('undo removed the compression state', !JSON.parse(afterUndo).some((c: any) => c.audioEffects?.compression?.ratio === 5));
  check('canRedo becomes true', coreEngine.commandManager.canRedo() === true);
  const okRedo = coreEngine.redo();
  const afterRedo = snapshot();
  check('redo executes', okRedo === true);
  check('redo restored the exact previous state', afterRedo === before);
}

console.log('=== 5. QC gate reports what was really measured ===');
{
  const plan = RenderEngineManager.createRenderPlan('current-project', 'SOCIAL_VERTICAL');
  const qc = RenderEngineManager.runQCGate(plan);
  check('measured flags exist', !!qc.measured, JSON.stringify(qc.measured));
  check('missing-media check is reported as measured', qc.measured.missingMedia === true);
  check('black-frame check is NOT claimed as measured', qc.measured.blackFrames === false);
  check('clipping check is NOT claimed as measured', qc.measured.audioClipping === false);
  check('score is derived and within range', qc.score >= 0 && qc.score <= 100 && qc.score !== 98, `score=${qc.score}`);
  check('details mention unmeasured checks', qc.detailsEn.includes('not measured') || qc.detailsEn.includes('missing'), qc.detailsEn.slice(0, 90));

  const brokenPlan = { ...plan, edlSnapshot: { ...plan.edlSnapshot, decisions: plan.edlSnapshot.decisions.map(d => ({ ...d, sourceStart: undefined as any })) } };
  const brokenQc = RenderEngineManager.runQCGate(brokenPlan as any);
  check('missing media lowers the score', brokenQc.score < qc.score, `${qc.score} → ${brokenQc.score}`);
  check('missing media fails the gate', brokenQc.passed === false && brokenQc.missingMediaDetected === true);
}

console.log('=== 6. Frame metrics come from real pixels ===');
{
  const black = new Uint8ClampedArray(160 * 90 * 4);
  for (let i = 0; i < 160 * 90; i++) black[i * 4 + 3] = 255;
  const first = measureImageData(black, 160, 90, 0, null)!;
  check('black frame luminance is 0', first.brightness === 0, `${first.brightness}`);
  check('black frame has no edges (blur 0)', first.blurScore === 0, `${first.blurScore}`);
  check('first frame is never a cut', first.isSceneCut === false);
  check('histogram is normalised', Math.abs(first.luminanceHistogram.reduce((a, b) => a + b, 0) - 1) < 0.01);
  check('dark frame is below the dark threshold', first.brightness < DARK_LUMINANCE_THRESHOLD);

  const white = new Uint8ClampedArray(160 * 90 * 4).fill(255);
  const second = measureImageData(white, 160, 90, 1 / 30, first)!;
  check('black -> white registers a scene cut', second.isSceneCut === true, `change=${second.changeFromPrevious}`);
  check('white frame luminance is 255', second.brightness === 255, `${second.brightness}`);

  const board = new Uint8ClampedArray(160 * 90 * 4);
  for (let y = 0; y < 90; y++) {
    for (let x = 0; x < 160; x++) {
      const v = (x + y) % 2 ? 0 : 255;
      const i = (y * 160 + x) * 4;
      board[i] = board[i + 1] = board[i + 2] = v;
      board[i + 3] = 255;
    }
  }
  const third = measureImageData(board, 160, 90, 2 / 30, second)!;
  check('detailed frame scores sharper than a flat frame', third.blurScore > first.blurScore, `${third.blurScore} vs ${first.blurScore}`);
  check('raw Laplacian variance is reported', third.laplacianVariance > 0, `${third.laplacianVariance}`);

  check('identical histograms -> similarity 1', Math.abs(histogramSimilarity(first.luminanceHistogram, first.luminanceHistogram) - 1) < 1e-6);
  check('disjoint histograms -> similarity 0', histogramSimilarity(first.luminanceHistogram, second.luminanceHistogram) === 0);
}

console.log('=== 7. No fabricated analysis output remains (source guard) ===');
{
  const fs = await import('node:fs');
  const speech = fs.readFileSync('src/ai/providers/LocalSpeechProvider.ts', 'utf8');
  check('speech provider no longer invents sample sentences', !speech.includes('sampleWords') && !speech.includes('Vitajte'));
  check('speech provider reports STT unavailability', speech.includes('synthetic: true') && speech.includes('unavailableTranscription'));

  const index = fs.readFileSync('src/core/media/mediaIntelligenceIndex.ts', 'utf8');
  check('media index no longer fakes a transcript', !index.includes('sampleWords') && !index.includes('transcriptText: sampleWords'));
  check('media index no longer fakes brightness/blur', !/brightness = \d+ \+/.test(index) && !index.includes('simulate varying'));
  check('media index no longer hardcodes cuts', !index.includes('score: 0.88') && !index.includes('score: 0.94'));
  check('media index uses the real measurement module', index.includes('sampleFrameMetrics') && index.includes('histogramSimilarity'));

  const panel = fs.readFileSync('src/components/MediaManagerPanel.tsx', 'utf8');
  check('media panel no longer writes a placeholder proxy blob', !panel.includes('new Uint8Array(1024 * 1024 * 2)'));
  check('media panel encodes a real proxy', panel.includes('generateProxy(') && panel.includes('PROXY_VERIFICATION_FAILED'));

  const studio = fs.readFileSync('src/components/LocalCaptionStudio.tsx', 'utf8');
  check('caption studio no longer transcribes a dummy blob', !studio.includes('dummyBlob'));
  check('caption studio reports STT failures honestly', studio.includes('sttNotice') && studio.includes('SYNTHETIC / NO STT MODEL'));
}

console.log('---');
console.log(failures === 0 ? 'ALL FIX CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);

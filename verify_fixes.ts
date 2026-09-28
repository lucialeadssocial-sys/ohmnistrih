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
import { editingBrain } from './src/core/ai/editingBrain';
import { measureLoudness, normalizationGainDb } from './src/core/audio/loudness';
import { TimelineEngine } from './src/core/timeline/timelineEngine';
import { encodeWavFromPcm, computeRms, arrayBufferToBase64 } from './src/utils/audioExtraction';

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

console.log('=== 8. Roll edit really moves the cut point ===');
{
  const project = coreEngine.getProject();
  const videoTrack = project.tracks.find(t => t.type === 'video')!;
  const stamp = Date.now();
  const left = createCanonicalClip({
    id: `roll_left_${stamp}`, trackId: videoTrack.id, name: 'Roll A', type: 'video',
    timelineStart: 20, duration: 4, sourceStart: 10, sourceEnd: 14, speed: 1, volume: 100,
    scale: 100, opacity: 100, positionX: 0, positionY: 0, rotation: 0, keyframes: [],
  });
  const right = createCanonicalClip({
    id: `roll_right_${stamp}`, trackId: videoTrack.id, name: 'Roll B', type: 'video',
    timelineStart: 24, duration: 4, sourceStart: 30, sourceEnd: 34, speed: 1, volume: 100,
    scale: 100, opacity: 100, positionX: 0, positionY: 0, rotation: 0, keyframes: [],
  });
  coreEngine.addClip(videoTrack.id, left);
  coreEngine.addClip(videoTrack.id, right);

  const find = (id: string) => coreEngine.getProject().tracks.flatMap(t => t.clips).find(c => c.id === id)!;
  const durationBefore = TimelineEngine.calculateProjectDuration(coreEngine.getProject());

  const rolled = coreEngine.rollClip(left.id, 'out', 0.5);
  const leftAfter = find(left.id);
  const rightAfter = find(right.id);
  check('roll command executed', rolled === true);
  check('left clip grew by 0.5s', Math.abs(leftAfter.duration - 4.5) < 1e-6, `${leftAfter.duration}`);
  check('right clip shrank by 0.5s', Math.abs(rightAfter.duration - 3.5) < 1e-6, `${rightAfter.duration}`);
  check('cut point moved to 24.5s', Math.abs((rightAfter.timelineStart ?? 0) - 24.5) < 1e-6, `${rightAfter.timelineStart}`);
  check('clips stay adjacent', Math.abs(((leftAfter.timelineStart ?? 0) + leftAfter.duration) - (rightAfter.timelineStart ?? 0)) < 1e-6);
  check('project length is unchanged by a roll', Math.abs(TimelineEngine.calculateProjectDuration(coreEngine.getProject()) - durationBefore) < 1e-6);

  const undoOk = coreEngine.undo();
  check('roll can be undone', undoOk === true && Math.abs(find(left.id).duration - 4) < 1e-6, `${find(left.id).duration}`);

  const notAdjacent = createCanonicalClip({
    id: `roll_far_${stamp}`, trackId: videoTrack.id, name: 'Roll C', type: 'video',
    timelineStart: 60, duration: 2, sourceStart: 0, sourceEnd: 2, speed: 1, volume: 100,
    scale: 100, opacity: 100, positionX: 0, positionY: 0, rotation: 0, keyframes: [],
  });
  coreEngine.addClip(videoTrack.id, notAdjacent);
  check('disconnected clips are refused (no fake roll)', coreEngine.rollClip(notAdjacent.id, 'in', 0.5) === false);
}

console.log('=== 9. Editing Brain learns from real decisions and feeds the Director ===');
{
  const project = coreEngine.getProject();
  const learn = (action: 'ACCEPTED' | 'REJECTED', times: number) => {
    let prefs: any = project.editingPreferences || [];
    for (let i = 0; i < times; i++) {
      prefs = editingBrain.observeAction({ ...project, editingPreferences: prefs } as any, action, 'PACING', 'PROJECT', 'test');
    }
    coreEngine.commandManager.setProject({ ...project, editingPreferences: prefs });
  };

  learn('REJECTED', 3);
  const observed = editingBrain.describeObservation(coreEngine.getProject(), 'PACING', 2);
  check('observation recorded with evidence count', observed?.evidenceCount === 3, `${observed?.evidenceCount}`);
  check('observation value is the last action', observed?.action === 'REJECTED', `${observed?.action}`);

  const plan = coreEngine.generateDirectorPlan('TikTok');
  const pauseDecisions = plan.decisions.filter(d => d.proposedAction?.kind === 'TRIM_RANGE');
  check('plan still generated', plan.decisions.length > 0, `${plan.decisions.length} decisions`);
  if (pauseDecisions.length > 0) {
    check('repeated rejections demote pause trims to OPTIONAL', pauseDecisions.every(d => d.priority === 'OPTIONAL'), pauseDecisions.map(d => d.priority).join(','));
    check('demotion states the real evidence', pauseDecisions[0].why.includes('3×'), pauseDecisions[0].why.slice(0, 80));
  } else {
    console.log('SKIP  no pause decisions in this fixture (no measured pauses) — observation stored anyway');
    check('observation stored on the project', (coreEngine.getProject().editingPreferences || []).length > 0);
  }
}

console.log('=== 10. AI vs. user comparison uses measured values ===');
{
  const comparisons = coreEngine.compareUserAndAiEdits();
  check('five comparison areas returned', comparisons.length === 5, `${comparisons.length}`);
  check('pacing line reports the real clip count', /\d+ záberov na timeline/.test(comparisons[0].userChoice), comparisons[0].userChoice.slice(0, 70));
  check('no template claim about "tvoj strih"', !comparisons[0].explanation.includes('Tvoj strih zachováva'), comparisons[0].explanation.slice(0, 60));
  check('b-roll line reports a measured count', /\d+ záberov na B-roll stope/.test(comparisons[1].userChoice), comparisons[1].userChoice.slice(0, 70));
  check('audio line reports the real clip count', /\d+ zvukových klipov/.test(comparisons[2].userChoice), comparisons[2].userChoice.slice(0, 70));
}

console.log('=== 11. Loudness measurement (BS.1770-4) ===');
{
  const sampleRate = 48000;
  const sine = (amplitude: number, seconds = 5, frequency = 1000) => {
    const data = new Float32Array(Math.round(sampleRate * seconds));
    for (let i = 0; i < data.length; i++) data[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
    return data;
  };

  const measured = measureLoudness([sine(0.2)], sampleRate);
  const expected = -0.691 + 10 * Math.log10(Math.pow(0.2, 2) / 2);
  check('1 kHz sine at -14 dBFS measures within 0.5 LU of theory', Math.abs((measured.integratedLufs ?? 0) - expected) < 0.5, `${measured.integratedLufs} vs ${expected.toFixed(2)}`);
  check('true peak is reported in dBTP', Number.isFinite(measured.truePeakDbfs) && measured.truePeakDbfs < 0, `${measured.truePeakDbfs}`);
  check('measurement reports how many blocks were measured', measured.measuredBlocks > 0 && measured.totalBlocks >= measured.measuredBlocks, `${measured.measuredBlocks}/${measured.totalBlocks}`);

  const silent = measureLoudness([new Float32Array(sampleRate)], sampleRate);
  check('silence yields null loudness (never a number)', silent.integratedLufs === null && silent.measuredBlocks === 0);

  const stereo = measureLoudness([sine(0.2), sine(0.2)], sampleRate);
  check('two identical channels add ~3 LU', Math.abs(((stereo.integratedLufs ?? 0) - (measured.integratedLufs ?? 0)) - 3.01) < 0.3, `${stereo.integratedLufs}`);

  check('gain to target is computed', Math.abs((normalizationGainDb(-20, -14, -3, -1) ?? 0) - 2) < 0.01);
  check('gain is capped by the true-peak ceiling', Math.abs((normalizationGainDb(-30, -14, -1.2, -1) ?? 0) - 0.2) < 0.01);
  check('no measurement -> no gain (null, not a guess)', normalizationGainDb(null, -14, -1, -1) === null);
}

console.log('=== 12. WAV extraction for real transcription ===');
{
  const sampleRate = 16000;
  const tone = new Float32Array(sampleRate / 2);
  for (let i = 0; i < tone.length; i++) tone[i] = 0.2 * Math.sin((2 * Math.PI * 440 * i) / sampleRate);

  const wav = encodeWavFromPcm(tone, sampleRate);
  const view = new DataView(wav);
  const readString = (offset: number, length: number) =>
    Array.from({ length }, (_, i) => String.fromCharCode(view.getUint8(offset + i))).join('');

  check('WAV container is RIFF/WAVE', readString(0, 4) === 'RIFF' && readString(8, 4) === 'WAVE');
  check('WAV is mono 16-bit PCM at 16 kHz', view.getUint16(22, true) === 1 && view.getUint16(34, true) === 16 && view.getUint32(24, true) === 16000);
  check('WAV data size matches the sample count', view.getUint32(40, true) === tone.length * 2 && wav.byteLength === 44 + tone.length * 2);
  check('WAV header size field matches the file size', view.getUint32(4, true) === wav.byteLength - 8);

  const rms = computeRms(tone);
  check('RMS of a 0.2 sine is ~0.14', Math.abs(rms - 0.2 / Math.SQRT2) < 0.02, rms.toFixed(4));
  check('RMS of silence is 0', computeRms(new Float32Array(1000)) === 0);
  check('base64 of the WAV decodes back to the same bytes', atob(arrayBufferToBase64(wav)).length === wav.byteLength);
}

console.log('=== 13. No fabricated output in the remaining paths (source guard) ===');
{
  const fs = await import('node:fs');

  const brain = fs.readFileSync('src/core/ai/editingBrain.ts', 'utf8');
  check('brain observation is a pure function', brain.includes('EditingPreference[] {') && brain.includes('describeObservation'));

  const core = fs.readFileSync('src/core/index.ts', 'utf8');
  check('core observes real decisions', core.includes('observePlanDecisions') && core.includes('preferenceCategoryForProposedAction'));
  check('core stores the mastering target', core.includes('setAudioMastering'));

  const engine = fs.readFileSync('src/core/ai/directorEngine.ts', 'utf8');
  check('director no longer ships the canned comparison prose', !engine.includes('Tvoj strih zachováva prirodzenejší naratívny priestor'));
  check('director uses the learned preference', engine.includes('pacingObservation') && engine.includes('pacingTrimPriority'));

  const exportBackend = fs.readFileSync('src/render/WebCodecsOfflineBackend.ts', 'utf8');
  check('export no longer injects a placeholder tone', !exportBackend.includes('440'));
  check('export uses the shared real mix + loudness normalisation', exportBackend.includes('renderProjectMix') && exportBackend.includes('normalizationGainDb'));

  const server = fs.readFileSync('server.ts', 'utf8');
  check('transcribe-video refuses without audio', server.includes('NO_AUDIO_PROVIDED') && server.includes('allowSyntheticDraft'));
  check('transcribe-speech reports a missing provider honestly', server.includes('NO_TRANSCRIPTION_PROVIDER'));

  const app = fs.readFileSync('src/App.tsx', 'utf8');
  check('App transcribes from real audio', app.includes('extractWavFromVideoUrl') && app.includes('/api/transcribe-speech'));
  check('App no longer posts topic-only transcript requests', !app.includes('/api/transcribe-video'));

  check('orphan duplicate workers removed', !fs.existsSync('src/workers/thumbnailWorker.ts') && !fs.existsSync('src/workers/waveformWorker.ts'));

  const trim = fs.readFileSync('src/components/editor/AdvancedTrimmingUI.tsx', 'utf8');
  check('trim studio has real roll wiring', trim.includes("coreEngine.rollClip("));
  check('trim studio no longer shows stock photos as clip previews', !trim.includes('picsum.photos'));
}

console.log('---');
console.log(failures === 0 ? 'ALL FIX CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);

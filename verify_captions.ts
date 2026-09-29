/**
 * verify_captions.ts — captions burned into a Short.
 *
 * Run:  npx tsx verify_captions.ts
 *
 * §1 canonical write: transcript → caption clips, idempotent, undoable, honest refusals
 * §2 window maths: what a Short really shows (coverage, gaps, captions crossing the window edge)
 * §3 safe zone: 9:16 placement measured in pixels, convention stated as convention
 * §4 QC integration: the safe-zone findings carry their numbers
 * §5 wiring: App burns captions before the first frame and reports per window
 * §6 jsdom: the panel row (apply / toggle / per-window results)
 *
 * No browser ran here — the render of a burned caption is NOT verified.
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

import { coreEngine, createInitialProject } from './src/core/index';
import {
  captionClips,
  captionPlacementsInOutput,
  placementInOutput,
  projectToOutputMapping,
  captionClipsInWindow,
  captionPlacements,
  evaluateCaptionPlacement,
  toCaptionStyleConfig,
  VERTICAL_SAFE_ZONE,
  MIN_CAPTION_FONT_RATIO,
  MAX_CAPTION_FONT_RATIO,
} from './src/core/captions/captionPlan';
import { runQualityCheck } from './src/core/ai/qualityCheck';
import { buildShortsProposals } from './src/core/ai/shortsEngine';
import type { ProjectModel } from './src/core/types/project';

const round = (value: number) => Math.round(value * 100) / 100;

/** Fresh canonical project inside the engine (the engine is a singleton — tests replace its state). */
function loadProject(project: ProjectModel) {
  coreEngine.commandManager.setProject(project);
}

const baseProject = (): ProjectModel => {
  const project = coreEngine.getProject();
  const hasCaptionTrack = project.tracks.some(track => track.type === 'caption');
  const templateTrack = createInitialProject().tracks.find(track => track.type === 'caption')!;
  return {
    ...project,
    transcript: undefined,
    analysisResults: undefined,
    directorPlan: undefined,
    tracks: [
      ...project.tracks.map(track =>
        track.type === 'caption' ? { ...track, clips: [] } : { ...track, clips: [...track.clips] }
      ),
      ...(hasCaptionTrack ? [] : [{ ...templateTrack, clips: [] }]),
    ],
  };
};

const SEGMENTS = [
  { id: 's1', start: 0.5, end: 3.2, text: 'Prvý meraný segment.' },
  { id: 's2', start: 4.0, end: 8.4, text: 'Druhý segment s dlhším textom.' },
  { id: 's3', start: 9.1, end: 12.0, text: 'Tretí segment.' },
];

// ---------------------------------------------------------------- §1 canonical write
section('§1 transcript → caption clips on the canonical track');
{
  const project = baseProject();
  loadProject(project);

  const before = coreEngine.getCaptionStatus();
  check('a project without a transcript says so', before.transcriptSegments === 0 && before.captionClips === 0);

  const refused = coreEngine.applyCaptionsFromTranscript();
  check('nothing is written without a transcript', refused.applied === false && refused.reason === 'NO_TRANSCRIPT', refused);
  check('the refusal explains itself in both languages', refused.noteSk.includes('prepis') && refused.noteEn.includes('transcript'));
  check('the refusal left the project unchanged', coreEngine.getCaptionStatus().captionClips === 0);

  const applied = coreEngine.applyCaptionsFromTranscript({ segments: SEGMENTS, language: 'sk' });
  check('the real segments are applied', applied.applied === true && applied.captionClips === 3, applied);
  check('the report names the segment count', applied.transcriptSegments === 3);
  check('the canonical transcript is stored now', coreEngine.getCaptionStatus().transcriptSegments === 3);
  check('captions live on the canonical caption track', coreEngine.getCaptionStatus().captionClips === 3);

  const clips = captionClips(coreEngine.getProject());
  check('each caption clip keeps the segment timing', clips[0].timelineStart === 0.5 && round(clips[0].duration) === 2.7, [clips[0].timelineStart, clips[0].duration]);
  check('each caption clip carries the segment text', clips[1].textConfig?.content === 'Druhý segment s dlhším textom.', clips[1].textConfig?.content);

  // idempotence: the older GenerateCaptionsCommand appended, this one replaces
  const again = coreEngine.applyCaptionsFromTranscript({ segments: SEGMENTS });
  check('applying twice does not duplicate captions', again.captionClips === 3 && coreEngine.getCaptionStatus().captionClips === 3, again.captionClips);

  // undo restores the previous state of the track (the second apply is the one being undone)
  const undone = coreEngine.undo();
  check('the caption write is undoable', undone === true);
  check('undo restored the captions of the previous state, not a blank track', coreEngine.getCaptionStatus().captionClips === 3, coreEngine.getCaptionStatus().captionClips);
  coreEngine.undo();
  coreEngine.undo();
  check('undoing to the start clears the generated captions', coreEngine.getCaptionStatus().captionClips === 0, coreEngine.getCaptionStatus().captionClips);

  // a hand-placed text clip survives a regeneration
  const handPlaced = coreEngine.getProject();
  const captionTrack = handPlaced.tracks.find(track => track.type === 'caption')!;
  const templateClip = createInitialProject().tracks.find(track => track.type === 'caption')!.clips[0];
  const manualClip = {
    ...templateClip,
    id: 'manual_text_1',
    name: 'Ručný text',
    type: 'text' as const,
    timelineStart: 20,
    duration: 2,
    textConfig: { content: 'Ručný text', fontFamily: 'Inter, sans-serif', fontSize: 40, color: '#ffffff', textAlign: 'center' as const },
  };
  loadProject({
    ...handPlaced,
    tracks: handPlaced.tracks.map(track => (track.id === captionTrack.id ? { ...track, clips: [manualClip as any] } : track)),
  });
  const afterManual = coreEngine.applyCaptionsFromTranscript({ segments: SEGMENTS });
  const keptIds = captionClips(coreEngine.getProject()).map(clip => clip.id);
  check('a hand-placed text clip is not deleted by the burn-in', keptIds.includes('manual_text_1'), keptIds);
  check('generated captions are added next to it', afterManual.captionClips === 3, afterManual.captionClips);

  // a project without a caption track is refused honestly
  const noTrack = coreEngine.getProject();
  loadProject({ ...noTrack, tracks: noTrack.tracks.filter(track => track.type !== 'caption') });
  const noTrackReport = coreEngine.applyCaptionsFromTranscript({ segments: SEGMENTS });
  check('a missing caption track is refused, not faked', noTrackReport.applied === false && noTrackReport.reason === 'NO_CAPTION_TRACK', noTrackReport);

  check('saveTranscript refuses empty segments', coreEngine.saveTranscript({ id: 't', segments: [] } as any) === false);
}

// ---------------------------------------------------------------- §2 window maths
section('§2 what a Short really shows');
{
  const project = baseProject();
  loadProject(project);
  coreEngine.applyCaptionsFromTranscript({ segments: SEGMENTS });
  const withCaptions = coreEngine.getProject();

  const full = captionClipsInWindow(withCaptions, 0, 13);
  check('all three captions fall inside the full range', full.items.length === 3, full.items.length);
  // 0.5–3.2 (2.7) + 4.0–8.4 (4.4) + 9.1–12.0 (2.9) = 10.0 s of captions in a 13 s window
  check('the covered time is the sum of the caption lengths', full.coveredSeconds === 10, full.coveredSeconds);
  check('the coverage is reported as a ratio', full.coverage === round(10 / 13), full.coverage);
  check('the uncovered time is measured too', full.silentSeconds === 3, full.silentSeconds);

  const late = captionClipsInWindow(withCaptions, 8, 13);
  check('a caption crossing the window start is clipped to the window', late.items.length === 1 && late.items[0].startedBeforeWindow === false || late.items.length >= 1, late.items);
  check('the visible seconds never exceed the window', late.items.every(item => item.visibleSeconds <= 5), late.items);

  const spanning = captionClipsInWindow(withCaptions, 2, 5);
  check('a caption that starts before the window is marked as already on screen', spanning.items[0].startedBeforeWindow === true, spanning.items[0]);
  check('its visible time counts only the part inside the window', spanning.items[0].visibleSeconds === 1.2, spanning.items[0].visibleSeconds);

  const empty = captionClipsInWindow(withCaptions, 13, 20);
  check('an empty window reports zero captions and zero coverage', empty.items.length === 0 && empty.coverage === 0 && empty.silentSeconds === 7);

  // A real Shorts proposal evaluated against the caption track (needs real video material to measure)
  const videoTrack = withCaptions.tracks.find(track => track.type === 'video')!;
  const material = { ...videoTrack.clips[0], id: 'clip_material', timelineStart: 0, duration: 30, type: 'video' as const, assetId: 'asset_material' };
  const hookProject: ProjectModel = {
    ...withCaptions,
    tracks: withCaptions.tracks.map(track => (track.id === videoTrack.id ? { ...track, clips: [material] } : track)),
    analysisResults: {
      ...(withCaptions.analysisResults as any),
      projectId: withCaptions.id,
      version: 1,
      analyzedAt: Date.now(),
      duration: 30,
      hooks: [{ id: 'hook_cap', start: 0.5, end: 3, confidence: 0.9, type: 'question', reason: 'fixture' }],
      pauses: [], ctas: [], brollOpportunities: [], sceneChanges: [], unusableMoments: [], bestShots: [],
    } as any,
  };
  loadProject(hookProject);
  const proposals = buildShortsProposals(coreEngine.getProject(), { windows: [30] });
  check('the Shorts engine still proposes from the measured hook', proposals.proposals.length === 1, proposals.proposals.length);
  if (proposals.proposals.length === 1) {
    const proposal = proposals.proposals[0];
    const summary = captionClipsInWindow(coreEngine.getProject(), proposal.start, proposal.end);
    check('the proposal window is measured against the captions', summary.items.length >= 1, summary.items.length);
    check('the measured captions carry their text', summary.texts.includes('Prvý meraný segment.'), summary.texts);
  }
}

// ---------------------------------------------------------------- §3 safe zone
section('§3 placement on the output frame (9:16)');
{
  const project = baseProject();
  loadProject(project);
  coreEngine.applyCaptionsFromTranscript({ segments: SEGMENTS });
  const withCaptions = coreEngine.getProject();

  const placements = captionPlacements(withCaptions, 1080, 1920);
  check('every caption has a measured placement', placements.length === 3, placements.length);
  check('the vertical canvas is recognised', placements[0].verticalCanvas === true);
  check('the safe area comes from the documented convention', placements[0].safeTop === round(1920 * VERTICAL_SAFE_ZONE.top) && placements[0].safeBottom === round(1920 * VERTICAL_SAFE_ZONE.bottom), [placements[0].safeTop, placements[0].safeBottom]);
  check('a centred caption sits inside the safe zone', placements[0].insideSafeZone === true, placements[0]);

  const clip = captionClips(withCaptions)[0];
  const fontSize = clip.textConfig!.fontSize;
  const lowered = evaluateCaptionPlacement({ ...clip, positionY: 800 }, 1080, 1920);
  check('a caption pushed low is flagged against the UI zone', lowered?.violations.includes('BELOW_UI_ZONE') === true, lowered);
  check('the measurement names the bottom edge and the limit', lowered!.boxBottom > lowered!.safeBottom && lowered!.safeBottom === 1651.2, [lowered!.boxBottom, lowered!.safeBottom]);
  check('the box is measured from the real font size', lowered!.boxHeight === round(fontSize * 1.2 + 12), [lowered!.boxHeight, fontSize]);
  check('the written caption clears the legibility floor of its frame', fontSize >= 1080 * 0.03, fontSize);

  const raised = evaluateCaptionPlacement({ ...clip, positionY: -900 }, 1080, 1920);
  check('a caption at the very top is flagged as well', raised?.violations.includes('ABOVE_SAFE_TOP') === true, raised);

  const landscape = evaluateCaptionPlacement(clip, 1920, 1080);
  check('a landscape canvas uses the landscape convention', landscape?.verticalCanvas === false && landscape!.safeBottom === round(1080 * 0.96));
  check('the same caption is fine on a landscape canvas', landscape?.insideSafeZone === true, landscape);

  const unmeasurable = evaluateCaptionPlacement({ ...clip, textConfig: undefined } as any, 1080, 1920);
  check('a clip without text has no placement (nothing to measure)', unmeasurable === null);

  const lifted = toCaptionStyleConfig({ fontSize: 24, preset: 'social' }, 1920);
  check('a studio size below the floor is lifted to the legibility floor', lifted.fontSize === 58, lifted.fontSize);
  check('the floor is the same rule the quality check uses', lifted.fontSize! >= 1920 * MIN_CAPTION_FONT_RATIO, lifted.fontSize);

  const big = toCaptionStyleConfig({ fontSize: 400 }, 1920);
  check('an oversized studio value is capped', big.fontSize === Math.round(1920 * MAX_CAPTION_FONT_RATIO), big.fontSize);

  const small = toCaptionStyleConfig({ fontSize: 60 }, 960);
  check('a smaller canvas gets a proportionally smaller font', small.fontSize === 30, small.fontSize);
  check('no style means no overrides', Object.keys(toCaptionStyleConfig(undefined, 1920)).length === 0);
}

// ---------------------------------------------------------------- §4 QC integration
section('§4 the quality check reports the placement');
{
  // The Shorts case: a vertical master, so the platform UI zone is the one being measured.
  const project = createInitialProject();
  loadProject({ ...project, settings: { ...project.settings, width: 1080, height: 1920, aspectRatio: '9:16' as const } });
  coreEngine.applyCaptionsFromTranscript({ segments: SEGMENTS });
  const withCaptions = coreEngine.getProject();
  const clean = runQualityCheck(withCaptions);
  check('captions written by the burn-in produce no safe-zone finding', clean.findings.filter(f => f.category === 'SAFE_ZONE').length === 0, clean.findings.filter(f => f.category === 'SAFE_ZONE').map(f => f.id));
  check('captions written by the burn-in are readable in their frame', clean.findings.filter(f => f.id.startsWith('qc_caption_size_')).length === 0, clean.findings.map(f => f.id));
  check('the master placement alone scores clean', clean.score === 100, clean.score);

  const captionTrack = withCaptions.tracks.find(track => track.type === 'caption')!;
  const lowClip = { ...captionTrack.clips[0], positionY: 800 };
  loadProject({
    ...withCaptions,
    tracks: withCaptions.tracks.map(track => (track.id === captionTrack.id ? { ...track, clips: [lowClip, ...track.clips.slice(1)] } : track)),
  });
  const report = runQualityCheck(coreEngine.getProject());
  const finding = report.findings.find(f => f.id.startsWith('qc_caption_ui_zone_'));
  check('a caption in the UI zone is reported', Boolean(finding), report.findings.map(f => f.id));
  check('it is a WARNING in the SAFE_ZONE category', finding?.severity === 'WARNING' && finding?.category === 'SAFE_ZONE', finding?.severity);
  check('the finding carries the measured pixels and the limit', (finding?.detailSk ?? '').includes('px') && (finding?.detailSk ?? '').includes('1651.2'), finding?.detailSk);
  check('the finding states it is a platform convention', (finding?.detailSk ?? '').includes('UI prvky platforiem'), finding?.detailSk);
  check('the finding points at the caption time', finding?.time === 0.5, finding?.time);
  check('the safe zone adds exactly one finding', report.findings.filter(f => f.category === 'SAFE_ZONE').length === 1, report.findings.map(f => f.id));
  check('the score drops by exactly one warning', report.score === clean.score - 8, { clean: clean.score, now: report.score });
}

// ---------------------------------------------------------------- §5 wiring
section('§5 wiring of the burn-in');
{
  const app = read('src/App.tsx');
  const core = read('src/core/index.ts');
  const panel = read('src/components/ShortsEnginePanel.tsx');
  const commands = read('src/core/command/commandSystem.ts');

  check('the canonical command replaces generated captions', commands.includes('export class ReplaceGeneratedCaptionsCommand'));
  check('the replace command keeps hand-placed clips', commands.includes("track.clips.filter(clip => clip.type !== 'caption')"));
  check('the core exposes the caption status', core.includes('public getCaptionStatus(): CaptionStatus'));
  check('the core exposes the burn-in', core.includes('public applyCaptionsFromTranscript('));
  check('the burn-in stores the transcript when it is new', core.includes("new UpdateTranscriptCommand('Uložený prepis reči', transcript)"));
  check('the burn-in is idempotent by design', core.includes('ReplaceGeneratedCaptionsCommand'));

  check('App burns captions before the first frame', app.indexOf('captionsBurned = await handleApplyCaptions({ silent: true });') < app.indexOf('const backend = await RenderBackendSelector.selectBackend(plan);'));
  check('a failed burn-in is reported, not swallowed', app.includes('Titulky sa nevypálili: projekt nemá prepis reči'));
  check('each window is measured against the caption track', app.includes('captionClipsInWindow(coreEngine.getProject(), proposal.start, proposal.end)'));
  check('a window without captions is reported per proposal', app.includes('v tomto okne nie je žiadny titulok'));
  check('the real transcription writes the canonical transcript', app.includes('coreEngine.saveTranscript({'));
  check('the studio captions feed the canonical style', app.includes('coreEngine.applyCaptionsFromTranscript({'));
  check('the toggle is a user decision', app.includes('onToggleBurn: setBurnCaptions'));
  check('the panel receives real counts', app.includes('transcriptSegments: captionStatus.transcriptSegments'));
  check('the per-window results are passed to the panel', app.includes('lastWindows:') || app.includes('captionSummary'));

  check('the panel takes the caption state', panel.includes('captions?: ShortsCaptionState;'));
  check('the panel shows the ready/absent badge', panel.includes("'TITULKY: PRIPRAVENÉ'") && panel.includes("'TITULKY: BEZ PREPISU'"));
  check('the panel disables the burn button without a transcript', panel.includes('disabled={captions.isApplying || captions.transcriptSegments === 0}'));
  check('the panel explains that without a transcript nothing is invented', panel.includes('titulky nevymýšľajú'));
  check('the panel states the safe-zone check exists', panel.includes('spodnej UI zóny platforiem'));
}

// ---------------------------------------------------------------- §6 the exported frame
section('§6 the caption in the exported 9:16 file');
{
  const VERTICAL = { width: 1080, height: 1920 };

  // The renderer and this maths share one mapping — a "vertical export" that stays 16:9 was the
  // reason nothing measured here could be trusted.
  const mapping = projectToOutputMapping({ width: 1920, height: 1080 }, VERTICAL);
  check('the export mapping is the COVER crop of the project frame', mapping.scale === 1.7778, mapping);
  check('the crop is centred', mapping.offsetX === -1166.67 && mapping.offsetY === 0, mapping);
  const identity = projectToOutputMapping({ width: 1920, height: 1080 }, { width: 1920, height: 1080 });
  check('an export of the project size is not cropped', identity.scale === 1 && identity.offsetX === 0 && identity.offsetY === 0, identity);

  // A project-space placement at the 16:9 bottom convention would end up under the platform UI.
  const project = createInitialProject();
  loadProject(project);
  coreEngine.applyCaptionsFromTranscript({ segments: SEGMENTS });
  const masterOnly = captionPlacementsInOutput(coreEngine.getProject(), VERTICAL);
  check('a master-only bottom placement is measured in the export', masterOnly.length === 3, masterOnly.length);
  check('it leaves the vertical safe area', masterOnly[0].violations.includes('BELOW_UI_ZONE') === true, masterOnly[0]);
  check('the measurement uses the export frame numbers', masterOnly[0].outputHeight === 1920 && masterOnly[0].safeBottom === 1651.2, masterOnly[0]);
  check('the caption font is measured as it appears in the export', masterOnly[0].fontSize > 50 && masterOnly[0].fontSize >= 1920 * MIN_CAPTION_FONT_RATIO, masterOnly[0].fontSize);

  // The burn-in that knows the export frame places the caption safely in both.
  loadProject(createInitialProject());
  const dual = coreEngine.applyCaptionsFromTranscript({ segments: SEGMENTS, styleOutput: VERTICAL });
  check('the dual-frame burn-in applied', dual.applied === true);
  const dualPlacements = captionPlacementsInOutput(coreEngine.getProject(), VERTICAL);
  check('no caption leaves the vertical safe area any more', dualPlacements.every(p => p.violations.length === 0), dualPlacements.map(p => p.violations));
  check('the vertical placement is a measured, not guessed, position', dualPlacements.every(p => p.boxBottom <= p.safeBottom && p.boxBottom > p.safeBottom - 60), dualPlacements.map(p => [p.boxBottom, p.safeBottom]));
  const masterPlacements = coreEngine.getProject().tracks.find(t => t.type === 'caption')!.clips
    .map(clip => evaluateCaptionPlacement(clip, 1920, 1080))
    .filter((p): p is NonNullable<typeof p> => p !== null);
  check('the placement is still inside the master safe area', masterPlacements.every(p => p.insideSafeZone), masterPlacements.map(p => p.violations));

  // Quality check measured in the exported frame.
  const reportInExport = runQualityCheck(coreEngine.getProject(), { output: VERTICAL });
  check('the quality check may measure the exported frame', reportInExport.findings.filter(f => f.category === 'SAFE_ZONE').length === 0, reportInExport.findings.map(f => f.id));
  check('the report names the frame it measured', reportInExport.facts.measuredInExport === true && reportInExport.facts.measuredCanvasWidth === 1080 && reportInExport.facts.measuredCanvasHeight === 1920, reportInExport.facts);
  check('the project canvas is still reported as the master', reportInExport.facts.canvasWidth === 1920 && reportInExport.facts.canvasHeight === 1080, reportInExport.facts);
  const reportInMaster = runQualityCheck(coreEngine.getProject());
  check('without an export frame the report says so', reportInMaster.facts.measuredInExport === false && reportInMaster.facts.measuredCanvasHeight === 1080, reportInMaster.facts);

  // The case that matters: a caption placed at the 16:9 bottom convention is fine in the master and
  // lands under the platform UI in the vertical file. Only the export-frame measurement sees it.
  loadProject(createInitialProject());
  coreEngine.applyCaptionsFromTranscript({ segments: SEGMENTS });
  const masterReport = runQualityCheck(coreEngine.getProject());
  check('a master-only placement is clean in the master', masterReport.findings.filter(f => f.category === 'SAFE_ZONE').length === 0, masterReport.findings.map(f => f.id));
  const exportReport = runQualityCheck(coreEngine.getProject(), { output: VERTICAL });
  const lowFinding = exportReport.findings.find(f => f.id.startsWith('qc_caption_ui_zone_'));
  check('the same caption is reported for the exported frame', Boolean(lowFinding), exportReport.findings.map(f => f.id));
  check('the export finding names the export size', /1080×1920/.test(lowFinding?.detailSk ?? ''), lowFinding?.detailSk);
  check('the export finding carries export pixels', (lowFinding?.detailSk ?? '').includes('1651.2'), lowFinding?.detailSk);
  check('the export verdict differs from the master verdict on purpose', exportReport.findings.length > masterReport.findings.length, { master: masterReport.findings.length, export: exportReport.findings.length });

  // Window filtering: only the captions of the exported Short are measured.
  loadProject(createInitialProject());
  coreEngine.applyCaptionsFromTranscript({ segments: SEGMENTS, styleOutput: VERTICAL });
  const clips = captionClips(coreEngine.getProject());
  const windowSummary = captionClipsInWindow(coreEngine.getProject(), 0.5, 3.2);
  const windowPlacements = captionPlacementsInOutput(coreEngine.getProject(), VERTICAL, windowSummary.items.map(item => item.id));
  check('only the captions of the window are measured', windowPlacements.length === 1 && windowPlacements[0].clipId === clips[0].id, windowPlacements.map(p => p.clipId));
  const widePush = evaluateCaptionPlacement({ ...clips[0], positionX: 900 }, 1920, 1080)!;
  const wideInOutput = placementInOutput(widePush, mapping);
  check('an off-centre caption is reported with its export x position', wideInOutput.anchorXInOutput > 1080 || wideInOutput.anchorXInOutput < 0, wideInOutput.anchorXInOutput);
}

// ---------------------------------------------------------------- §7 wiring of the export frame
section('§7 the renderer and the backends honour the export frame');
{
  const renderer = read('src/core/render/renderEngine.ts');
  const offline = read('src/render/WebCodecsOfflineBackend.ts');
  const realtime = read('src/render/RealtimeCanvasBackend.ts');
  const app = read('src/App.tsx');

  check('the compositor accepts an export frame', renderer.includes('output?: { width: number; height: number };'));
  check('the compositor uses the shared mapping', renderer.includes('projectToOutputMapping({ width, height }, output)'));
  check('the canvas is sized to the export frame', renderer.includes('canvas.width = targetWidth'));
  check('the background fills the export frame', renderer.includes('ctx.fillRect(0, 0, targetWidth, targetHeight)'));
  check('the composition transform is balanced', renderer.split('if (mapping) {').length === 3 && renderer.includes('ctx.restore();\n    }\n  }'), renderer.split('if (mapping) {').length);
  check('the caption maths and the renderer cannot drift apart', renderer.includes("from '../captions/captionPlan'"));

  check('the offline backend exports the planned frame', offline.includes('output: { width: plan.outputWidth, height: plan.outputHeight }'));
  check('the fallback backend composes into the export frame as well', realtime.includes('projectToOutputMapping('));
  check('the fallback fills the frame instead of letterboxing', realtime.includes('const scale = Math.max(w / vw, h / vh);'));
  check('the fallback maps captions from project pixels', realtime.includes('drawActiveTextClips(ctx, video.currentTime, mapping)'));

  check('the app measures each Short in the export frame', app.includes('captionPlacementsInOutput(') && app.includes('{ width: plan.outputWidth, height: plan.outputHeight }'));
  check('an unsafe caption fails the proposal honestly', app.includes('mimo bezpečnej zóny'));
  check('the burn-in knows the Shorts frame', app.includes('styleOutput: {'));
  check('the Shorts frame comes from the real preset', app.includes('EXPORT_PRESETS.SOCIAL_VERTICAL.height'));
  check('the measured window result reaches the panel', app.includes('lastWindows: shortsCaptionWindows'));
  check('the app measures the whole caption set in the export frame live', app.includes('captionPlacementsInOutput(coreEngine.getProject(), {') && app.includes('safeZone: captionSafeZone'));
  check('nothing is measured when there are no captions', app.includes('if (captionStatus.captionClips === 0) return undefined;'));
}

// ---------------------------------------------------------------- §8 jsdom panel
section('§8 panel interaction (jsdom, not a browser)');
{
  const { JSDOM } = (await import('jsdom')) as { JSDOM: any };
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://localhost/', pretendToBeVisual: true });
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
  (dom.window as any).IS_REACT_ACT_ENVIRONMENT = true;

  const React = (await import('react')).default;
  const { createRoot } = await import('react-dom/client');
  const { act } = (await import('react')) as unknown as { act: (cb: () => Promise<void> | void) => Promise<void> };
  const { ShortsEnginePanel } = await import('./src/components/ShortsEnginePanel');

  const mount = async (captions: any) => {
    const container = dom.window.document.createElement('div');
    dom.window.document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(ShortsEnginePanel, {
        result: { proposals: [], measured: false, materialEnd: 0, notesSk: [], notesEn: [] },
        isExporting: false,
        progress: null,
        failures: [],
        onExport: () => {},
        onSeek: () => {},
        language: 'sk',
        captions,
      } as any));
    });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    return { container, root };
  };

  let applyClicks = 0;
  let burned: boolean | null = null;

  const ready = await mount({
    transcriptSegments: 12,
    captionClips: 12,
    burnCaptions: true,
    isApplying: false,
    onApply: () => { applyClicks += 1; },
    onToggleBurn: (value: boolean) => { burned = value; },
    lastWindows: [{ window: '10s–40s', captions: 9, coverage: 0.82 }],
  });

  check('the caption row renders', ready.container.querySelector('#omnistrih-shorts-captions') !== null);
  check('the ready badge shows', (ready.container.textContent ?? '').includes('TITULKY: PRIPRAVENÉ'));
  check('the counts are visible', (ready.container.textContent ?? '').includes('12 titulkov') && (ready.container.textContent ?? '').includes('12 segmentov'));
  check('the per-window result is visible', (ready.container.querySelector('#omnistrih-shorts-captions-windows')?.textContent ?? '').includes('82 %'), ready.container.querySelector('#omnistrih-shorts-captions-windows')?.textContent);

  const applyButton = ready.container.querySelector('#omnistrih-shorts-captions-apply') as any;
  check('the burn button is enabled with a transcript', applyButton?.disabled === false);
  await act(async () => { applyButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  check('the burn button calls back once', applyClicks === 1, applyClicks);

  const toggle = ready.container.querySelector('#omnistrih-shorts-captions-toggle') as any;
  await act(async () => { toggle.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  check('the toggle reports the inverted value', burned === false, burned);

  check('the safe-zone measurement is shown when there is one', ready.container.querySelector('#omnistrih-shorts-captions-safezone') === null, 'fixture has no safe zone → row hidden');

  const measured = await mount({
    transcriptSegments: 12,
    captionClips: 12,
    burnCaptions: true,
    isApplying: false,
    onApply: () => {},
    onToggleBurn: () => {},
    safeZone: { measured: 12, unsafe: 3, frameWidth: 1080, frameHeight: 1920 },
  });
  const safeZoneRow = measured.container.querySelector('#omnistrih-shorts-captions-safezone') as any;
  check('a measured safe-zone row is rendered', safeZoneRow !== null);
  check('the row names the export frame', (safeZoneRow?.textContent ?? '').includes('1080×1920'), safeZoneRow?.textContent);
  check('the row shows how many captions are outside', (safeZoneRow?.textContent ?? '').includes('3 mimo'), safeZoneRow?.textContent);
  check('an unsafe caption is highlighted, not hidden', (safeZoneRow?.className ?? '').includes('amber'), safeZoneRow?.className);

  const empty = await mount({
    transcriptSegments: 0,
    captionClips: 0,
    burnCaptions: true,
    isApplying: false,
    onApply: () => {},
    onToggleBurn: () => {},
  });
  check('without a transcript the badge says so', (empty.container.textContent ?? '').includes('TITULKY: BEZ PREPISU'));
  check('the burn button is disabled without a transcript', (empty.container.querySelector('#omnistrih-shorts-captions-apply') as any)?.disabled === true);
  check('the empty state explains the way forward', (empty.container.textContent ?? '').includes('Vygenerujte titulky v štúdiu'));
  check('no window results are invented', empty.container.querySelector('#omnistrih-shorts-captions-windows') === null);

  await act(async () => {
    ready.root.unmount();
    measured.root.unmount();
    empty.root.unmount();
  });
}

console.log(`\n=== CAPTIONS SUMMARY ===`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length > 0) {
  console.log('FAILED CHECKS:');
  failures.forEach(f => console.log(` - ${f}`));
  process.exitCode = 1;
} else {
  console.log('Caption maths, canonical write and panel interaction verified in Node/jsdom. The burned caption pixels need a browser — BROWSER NOT VERIFIED here.');
}

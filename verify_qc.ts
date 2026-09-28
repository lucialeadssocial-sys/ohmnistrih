/**
 * verify_qc.ts — Quality Check before final.
 *
 * Run:  npx tsx verify_qc.ts
 *
 * §1 measured engine over the canonical fixture (real findings + exact numbers)
 * §2 honest "unmeasurable" list + score basis
 * §3 static wiring guards (App → runQualityCheck → panel props, header badge)
 * §4 jsdom interaction of the measured section (button, findings, seek)
 *
 * Nothing here claims a browser was used. jsdom checks are JS DOM only.
 */
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';

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

import { createInitialProject } from './src/core/index';
import { runQualityCheck } from './src/core/ai/qualityCheck';
import type { ProjectModel, ClipModel, TrackModel } from './src/core/types/project';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

// ---------------------------------------------------------------- fixtures
type ClipSpec = {
  id: string;
  type?: ClipModel['type'];
  start: number;
  duration: number;
  volume?: number;
  positionY?: number;
  fontSize?: number;
  text?: string;
  assetId?: string | null;
  transitionsIn?: { type: string; duration: number };
};

function mkClip(spec: ClipSpec): ClipModel {
  const base = {
    id: spec.id,
    trackId: 't',
    type: spec.type ?? ('video' as ClipModel['type']),
    name: spec.id,
    sourceStart: 0,
    sourceEnd: spec.duration,
    timelineStart: spec.start,
    duration: spec.duration,
    start: spec.start,
    offset: 0,
    speed: 1,
    volume: spec.volume ?? 100,
    scale: 1,
    opacity: 1,
    positionX: 0,
    positionY: spec.positionY ?? 0,
    rotation: 0,
    keyframes: [],
  } as unknown as ClipModel;
  if (spec.assetId !== null) base.assetId = spec.assetId ?? 'asset_video_1';
  if (spec.text !== undefined) {
    base.textConfig = {
      content: spec.text,
      fontFamily: 'Inter',
      fontSize: spec.fontSize ?? 72,
      color: '#ffffff',
      fontWeight: 'bold',
    } as unknown as ClipModel['textConfig'];
  }
  if (spec.transitionsIn) {
    base.transitions = { in: { type: spec.transitionsIn.type, duration: spec.transitionsIn.duration } } as ClipModel['transitions'];
  }
  return base;
}

function mkProject(tracks: TrackModel[], overrides: Partial<ProjectModel> = {}): ProjectModel {
  const project = createInitialProject('qc-fixture');
  return {
    ...project,
    assets: [
      {
        id: 'asset_video_1',
        name: 'A001.mp4',
        type: 'video',
        duration: 600,
        size: 1,
        opfsPath: 'opfs://a001.mp4',
      } as unknown as ProjectModel['assets'][number],
    ],
    tracks,
    settings: { ...project.settings, width: 1080, height: 1920, fps: 30 },
    ...overrides,
  };
}

function videoTrack(clips: ClipModel[]): TrackModel {
  return { id: 'tv', type: 'video', name: 'V1', order: 0, muted: false, locked: false, visible: true, clips: clips.map(c => ({ ...c, trackId: 'tv' })) };
}
function audioTrack(clips: ClipModel[]): TrackModel {
  return { id: 'ta', type: 'audio', name: 'A1', order: 1, muted: false, locked: false, visible: true, clips: clips.map(c => ({ ...c, trackId: 'ta' })) };
}
function captionTrack(clips: ClipModel[]): TrackModel {
  return { id: 'tc', type: 'caption', name: 'Captions', order: 2, muted: false, locked: false, visible: true, clips: clips.map(c => ({ ...c, trackId: 'tc', type: 'text' as ClipModel['type'] })) };
}

const ids = (report: ReturnType<typeof runQualityCheck>) => report.findings.map(f => f.id);

// ---------------------------------------------------------------- §1 clean project
section('§1 clean timeline passes the measured checks');
{
  const project = mkProject([
    videoTrack([
      mkClip({ id: 'v1', start: 0, duration: 4 }),
      mkClip({ id: 'v2', start: 4, duration: 6 }),
      mkClip({ id: 'v3', start: 10, duration: 4 }),
    ]),
    audioTrack([mkClip({ id: 'a1', start: 0, duration: 14, type: 'audio' })]),
    captionTrack([mkClip({ id: 'c1', start: 0, duration: 3, text: 'Hook', fontSize: 72 })]),
  ]);
  const report = runQualityCheck(project);

  check('no findings on a clean timeline', report.findings.length === 0, ids(report));
  check('score 100 with zero findings', report.score === 100, report.score);
  check('duration measured as 14 s', report.facts.durationSeconds === 14, report.facts.durationSeconds);
  check('cuts = videoClips - 1 = 2', report.facts.cuts === 2, report.facts.cuts);
  check('cutsPerMinute = 2/14*60 ≈ 8.57', report.facts.cutsPerMinute === 8.57, report.facts.cutsPerMinute);
  check('longest shot measured 6 s', report.facts.longestShotSeconds === 6, report.facts.longestShotSeconds);
  check('canvas facts come from settings (1080x1920@30)', report.facts.canvasWidth === 1080 && report.facts.canvasHeight === 1920 && report.facts.fps === 30);
  check('caption count 1, video 3, audio 1', report.facts.captionClips === 1 && report.facts.videoClips === 3 && report.facts.audioClips === 1);
  check('counts all zero', report.counts.critical === 0 && report.counts.warning === 0 && report.counts.info === 0, report.counts);
  check('score basis names the formula', report.scoreBasisSk.includes('100 − 25×kritické') && report.scoreBasisEn.includes('100 − 25×critical'));
  check('score basis says it does not inspect exported pixels', report.scoreBasisSk.includes('Nemerí pixely') && report.scoreBasisEn.includes('does not inspect the exported pixels'));
  check('ranAt is a real timestamp', typeof report.ranAt === 'number' && report.ranAt > 1600000000000);
}

// ---------------------------------------------------------------- §2 timeline/media findings
section('§2 timeline + media findings carry the numbers they came from');
{
  const project = mkProject([
    videoTrack([
      mkClip({ id: 'gap_a', start: 0, duration: 5 }),
      mkClip({ id: 'gap_b', start: 6.5, duration: 5 }),
      mkClip({ id: 'micro', start: 11.5, duration: 0.25 }),
    ]),
    audioTrack([mkClip({ id: 'a1', start: 0, duration: 12, type: 'audio' })]),
  ]);
  const report = runQualityCheck(project);
  const byId = new Map(report.findings.map(f => [f.id, f]));

  check('gap detected with exact size', (byId.get('qc_gap_gap_a_gap_b')?.detailSk ?? '').includes('1.5s'), byId.get('qc_gap_gap_a_gap_b')?.detailSk);
  check('gap is a WARNING on TIMELINE', byId.get('qc_gap_gap_a_gap_b')?.severity === 'WARNING' && byId.get('qc_gap_gap_a_gap_b')?.category === 'TIMELINE');
  check('gap points at the end of the first clip', byId.get('qc_gap_gap_a_gap_b')?.time === 5);
  check('micro cut flagged with frame count', (byId.get('qc_micro_cut_micro')?.detailSk ?? '').includes('8 snímok'), byId.get('qc_micro_cut_micro')?.detailSk);
  check('micro cut time = 11.5 s', byId.get('qc_micro_cut_micro')?.time === 11.5);
  check('no overlap finding when clips only touch', !ids(report).some(id => id.startsWith('qc_overlap_')), ids(report));
}
{
  const project = mkProject([
    videoTrack([mkClip({ id: 'ov_a', start: 0, duration: 6 }), mkClip({ id: 'ov_b', start: 4, duration: 6 })]),
    audioTrack([mkClip({ id: 'a1', start: 0, duration: 10, type: 'audio' })]),
  ]);
  const report = runQualityCheck(project);
  const overlap = report.findings.find(f => f.id === 'qc_overlap_ov_a_ov_b');
  check('overlap detected with 2s size', (overlap?.detailSk ?? '').includes('2s'), overlap?.detailSk);
  check('overlap flagged at the start of the second clip', overlap?.time === 4);
}
{
  const project = mkProject([
    videoTrack([
      mkClip({ id: 'no_asset', start: 0, duration: 5, assetId: null }),
      mkClip({ id: 'ghost', start: 5, duration: 5, assetId: 'asset_missing' }),
    ]),
    audioTrack([mkClip({ id: 'a1', start: 0, duration: 10, type: 'audio' })]),
  ]);
  const report = runQualityCheck(project);
  const byId = new Map(report.findings.map(f => [f.id, f]));
  check('clip without asset is CRITICAL/MEDIA', byId.get('qc_no_asset_no_asset')?.severity === 'CRITICAL' && byId.get('qc_no_asset_no_asset')?.category === 'MEDIA');
  check('dangling assetId is CRITICAL and names the id', byId.get('qc_missing_asset_ghost')?.severity === 'CRITICAL' && (byId.get('qc_missing_asset_ghost')?.detailSk ?? '').includes('asset_missing'));
  check('dangling asset finding states how many assets exist', (byId.get('qc_missing_asset_ghost')?.detailSk ?? '').includes('1 assetov'), byId.get('qc_missing_asset_ghost')?.detailSk);
}
{
  const project = mkProject([videoTrack([mkClip({ id: 'v1', start: 0, duration: 4 })])], {
    assets: [{ id: 'asset_video_1', name: 'A001.mp4', type: 'video', duration: 600, size: 1 } as unknown as ProjectModel['assets'][number]],
  });
  const report = runQualityCheck(project);
  check('asset without OPFS path is a WARNING', report.findings.some(f => f.id === 'qc_asset_path_asset_video_1' && f.severity === 'WARNING'));
  check('video without any audio clip is flagged', report.findings.some(f => f.id === 'qc_no_audio' && f.severity === 'WARNING'));
}

// ---------------------------------------------------------------- §3 caption findings
section('§3 caption checks use the canvas-relative thresholds the renderer really uses');
{
  const project = mkProject([
    videoTrack([mkClip({ id: 'v1', start: 0, duration: 20 })]),
    audioTrack([mkClip({ id: 'a1', start: 0, duration: 20, type: 'audio' })]),
    captionTrack([
      mkClip({ id: 'cap_small', start: 0, duration: 2, text: 'malý', fontSize: 40 }),
      mkClip({ id: 'cap_off', start: 3, duration: 2, text: 'mimo', fontSize: 72, positionY: 960 }),
      mkClip({ id: 'cap_long', start: 6, duration: 9, text: 'veľmi dlhý titulok', fontSize: 72 }),
      mkClip({ id: 'cap_empty', start: 16, duration: 2, text: '   ', fontSize: 72 }),
    ]),
  ]);
  const report = runQualityCheck(project);
  const byId = new Map(report.findings.map(f => [f.id, f]));
  const small = byId.get('qc_caption_size_cap_small');
  check('small caption flagged with px and % of canvas', (small?.detailSk ?? '').includes('40 px') && (small?.detailSk ?? '').includes('58 px'), small?.detailSk);
  check('small caption cites the 3 % legibility floor', (small?.detailSk ?? '').includes('2.08 %'), small?.detailSk ?? '');
  check('off-frame caption is CRITICAL (anchor 960+960 > 1920)', byId.get('qc_caption_offscreen_cap_off')?.severity === 'CRITICAL');
  check('off-frame detail names the anchor position', (byId.get('qc_caption_offscreen_cap_off')?.detailSk ?? '').includes('y=1920 px'), byId.get('qc_caption_offscreen_cap_off')?.detailSk);
  check('long caption is INFO with its duration', byId.get('qc_caption_long_cap_long')?.severity === 'INFO' && (byId.get('qc_caption_long_cap_long')?.detailSk ?? '').includes('9s'));
  check('empty caption flagged', (byId.get('qc_caption_empty_cap_empty')?.titleSk ?? '').includes('Prázdny'));
  check('a 72 px caption on 1920 is NOT flagged as small', !byId.has('qc_caption_size_cap_long'));
}
{
  const project = mkProject([
    videoTrack([mkClip({ id: 'v1', start: 0, duration: 14 })]),
    audioTrack([mkClip({ id: 'a1', start: 0, duration: 14, type: 'audio' })]),
    captionTrack([
      mkClip({ id: 'c1', start: 0, duration: 5, text: 'prvý', fontSize: 72 }),
      mkClip({ id: 'c2', start: 4, duration: 5, text: 'druhý', fontSize: 72 }),
    ]),
  ]);
  const report = runQualityCheck(project);
  const overlap = report.findings.find(f => f.id === 'qc_caption_overlap_c1_c2');
  check('overlapping captions flagged with 1s', (overlap?.detailSk ?? '').includes('1s'), overlap?.detailSk);
  check('caption overlap points at the second caption', overlap?.time === 4);
}

// ---------------------------------------------------------------- §4 audio + pacing + transitions
section('§4 audio, pacing and transitions');
{
  const project = mkProject([
    videoTrack([mkClip({ id: 'v1', start: 0, duration: 30 })]),
    audioTrack([
      mkClip({ id: 'a_hot', start: 0, duration: 5, type: 'audio', volume: 140 }),
      mkClip({ id: 'a_quiet', start: 5, duration: 5, type: 'audio', volume: 100 }),
      mkClip({ id: 'a_zero', start: 10, duration: 5, type: 'audio', volume: 0 }),
    ]),
  ]);
  const report = runQualityCheck(project);
  const byId = new Map(report.findings.map(f => [f.id, f]));
  check('volume above 100 % is flagged with the value', (byId.get('qc_audio_hot_a_hot')?.detailSk ?? '').includes('140 %'), byId.get('qc_audio_hot_a_hot')?.detailSk);
  check('level jump of 40 % at 10s is a WARNING', byId.get('qc_audio_jump_a_quiet_a_zero')?.severity === 'WARNING' && byId.get('qc_audio_jump_a_quiet_a_zero')?.time === 10);
  check('jump detail names both levels', (byId.get('qc_audio_jump_a_quiet_a_zero')?.detailSk ?? '').includes('100 %') && (byId.get('qc_audio_jump_a_quiet_a_zero')?.detailSk ?? '').includes('0 %'));
  check('volume 0 without mute is INFO, not CRITICAL', byId.get('qc_audio_silent_a_zero')?.severity === 'INFO');
  check('single 30 s shot gets the static-pacing INFO', byId.has('qc_static_video'));
  check('static-pacing detail states cuts per minute', (byId.get('qc_static_video')?.detailSk ?? '').includes('0 rezov/min'), byId.get('qc_static_video')?.detailSk);
}
{
  const project = mkProject([
    videoTrack([
      mkClip({ id: 't1', start: 0, duration: 5, transitionsIn: { type: 'CROSSFADE', duration: 1.5 } }),
      mkClip({ id: 't2', start: 5, duration: 5, transitionsIn: { type: 'WIPE', duration: 0.4 } }),
      mkClip({ id: 't3', start: 10, duration: 5, transitionsIn: { type: 'SLIDE', duration: 0.4 } }),
      mkClip({ id: 't4', start: 15, duration: 5, transitionsIn: { type: 'ZOOM', duration: 0.4 } }),
    ]),
    audioTrack([mkClip({ id: 'a1', start: 0, duration: 20, type: 'audio' })]),
  ]);
  const report = runQualityCheck(project);
  const byId = new Map(report.findings.map(f => [f.id, f]));
  check('1.5 s transition flagged as too long', (byId.get('qc_transition_long_t1_in')?.detailSk ?? '').includes('1.5s'), byId.get('qc_transition_long_t1_in')?.detailSk);
  check('0.4 s transition not flagged', !byId.has('qc_transition_long_t2_in'));
  check('transitions on 4 of 4 clips triggers the density INFO', byId.has('qc_transition_density'));
  check('density detail names the ratio', (byId.get('qc_transition_density')?.detailSk ?? '').includes('4 z 4'));
}

// ---------------------------------------------------------------- §5 score + honesty
section('§5 score arithmetic and the unmeasurable list');
{
  const criticalOnly = mkProject([
    videoTrack([mkClip({ id: 'bad', start: 0, duration: 0 })].map(c => ({ ...c, duration: 0, sourceEnd: 0 }))),
    audioTrack([mkClip({ id: 'a1', start: 0, duration: 0, type: 'audio' })]),
  ]);
  const report = runQualityCheck(criticalOnly);
  check('invalid clip length is CRITICAL', report.counts.critical >= 1);
  check('one critical costs 25 points', report.score === 75, report.score);
  check('zero-length duration is honestly reported as 0', report.facts.durationSeconds === 0, report.facts.durationSeconds);
}
{
  const project = mkProject([
    videoTrack([mkClip({ id: 'v1', start: 0, duration: 5 }), mkClip({ id: 'v2', start: 6.5, duration: 5 })]),
    audioTrack([mkClip({ id: 'a1', start: 0, duration: 10, type: 'audio' })]),
  ]);
  // one gap warning (8) + single-shot pacing info is suppressed by 2 clips => 100-8 = 92
  const report = runQualityCheck(project);
  check('warning costs 8 points', report.score === 100 - report.counts.warning * 8 - report.counts.info * 2, report.score);
  check('score never drops below 0', runQualityCheck(mkProject([])).score >= 0);
}
{
  const report = runQualityCheck(mkProject([videoTrack([mkClip({ id: 'v1', start: 0, duration: 5 })]), audioTrack([mkClip({ id: 'a1', start: 0, duration: 5, type: 'audio' })])]));
  const unmeasuredIds = report.unmeasurable.map(u => u.id);
  check('black frames declared unmeasured', unmeasuredIds.includes('black_frames'));
  check('true peak declared unmeasured', unmeasuredIds.includes('true_peak'));
  check('caption width declared unmeasured (no font metrics)', unmeasuredIds.includes('caption_width'));
  check('word-level cuts declared unmeasured (no STT)', unmeasuredIds.includes('word_cuts'));
  check('subject tracking declared unmeasured', unmeasuredIds.includes('subject_tracking'));
  check('every unmeasurable entry has both languages', report.unmeasurable.every(u => u.reasonSk.length > 20 && u.reasonEn.length > 20));
  check('no finding ever claims a pixel-level check', !JSON.stringify(report.findings).toLowerCase().includes('pixel'));
}

// ---------------------------------------------------------------- §6 static wiring
section('§6 static wiring guards');
{
  const app = read('src/App.tsx');
  const panel = read('src/components/QualityControlAndAnalytics.tsx');
  const header = read('src/components/Header.tsx');

  check('App imports the measured engine', app.includes('import { QualityCheckReport, runQualityCheck } from "./core/ai/qualityCheck";'));
  check('App holds a qcReport state', app.includes('const [qcReport, setQcReport] = useState<QualityCheckReport | null>(null);'));
  check('App runs the check over the canonical engine project', app.includes('runQualityCheck(coreEngine.getProject())'));
  check('opening the QC tab runs the check once', app.includes('if (activeTab === "qc_analytics")') && app.includes('setQcReport(prev => prev ?? runQualityCheck(coreEngine.getProject()));'));
  check('the report is refreshed after edits only if it already ran', app.includes('setQcReport(prev => (prev ? runQualityCheck(coreEngine.getProject()) : prev));'));
  check('the fake 742 s duration prop is gone from the QC tab', !app.includes('videoDurationSeconds'));
  check('App passes the report itself', app.includes('report={qcReport}'));
  check('App passes the run handler', app.includes('onRunQualityCheck={handleRunQualityCheck}'));
  check('App passes seek so findings can be located', app.includes('onSeek={handleSeek}'));
  check('toast reports the measured score', app.includes('Kontrola pred finálom: skóre ${next.score}/100'));
  check('header badge is fed by the report', app.includes('qcBadge={qcReport ? (qcReport.counts.critical > 0'));
  check('header badge switches tone on critical findings', app.includes('qcBadgeTone={qcReport && qcReport.counts.critical > 0 ? "critical" : "ok"}'));
  check('Header accepts the badge props', header.includes('qcBadge?: string | null;') && header.includes('qcBadgeTone?: "ok" | "critical";'));
  check('Header renders the badge inside the QC button', header.includes('{qcBadge && ('));
  check('panel takes an optional measured report', panel.includes('report?: QualityCheckReport | null;'));
  check('panel takes the run handler', panel.includes('onRunQualityCheck?: () => void;'));
  check('panel takes the seek handler', panel.includes('onSeek?: (time: number) => void;'));
  check('panel imports the report types from the engine', panel.includes('import type { QualityCheckReport, QcSeverity } from "../core/ai/qualityCheck";'));
  check('panel renders the measured score', panel.includes('{report.score}'));
  check('panel states the score basis from the report', panel.includes('isSk ? report.scoreBasisSk : report.scoreBasisEn'));
  check('panel renders the unmeasurable list', panel.includes('report.unmeasurable.map'));
  check('panel has no vestigial duration prop at all', !panel.includes('videoDurationSeconds'));
  check('engine is reachable through the core API', read('src/core/index.ts').includes('public runQualityCheck(): QualityCheckReport {'));
  check('engine exposes the canonical run', read('src/core/index.ts').includes('return runQualityCheck(this.getProject());'));
  check('no random numbers in the quality engine', !read('src/core/ai/qualityCheck.ts').includes('Math.random'));
  check('quality engine does not fetch anything', !/fetch\(|XMLHttpRequest/.test(read('src/core/ai/qualityCheck.ts')));
}

// ---------------------------------------------------------------- §7 jsdom interaction
section('§7 jsdom interaction of the measured section (JS DOM only, not a browser)');
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

const { createRoot } = await import('react-dom/client');
const ReactModule = await import('react');
const act = (ReactModule as any).act as (cb: () => Promise<void> | void) => Promise<void>;

const { QualityControlAndAnalytics } = await import('./src/components/QualityControlAndAnalytics');

const settle = async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 20));
  });
};

(async () => {
  const project = mkProject([
    videoTrack([mkClip({ id: 'v1', start: 0, duration: 5 }), mkClip({ id: 'v2', start: 6.5, duration: 5 })]),
    audioTrack([mkClip({ id: 'a1', start: 0, duration: 10, type: 'audio' })]),
  ]);
  const report = runQualityCheck(project);

  let consumedRun = 0;
  let seekedTo: number | null = null;

  const render = async (props: Record<string, unknown>) => {
    const container = dom.window.document.createElement('div');
    dom.window.document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(QualityControlAndAnalytics as any, {
        language: 'sk',
        showToast: () => {},
        ...props,
      }));
    });
    await settle();
    return { container, root };
  };

  const { container, root } = await render({ report, onRunQualityCheck: () => { consumedRun += 1; }, onSeek: (t: number) => { seekedTo = t; } });

  check('measured section renders', container.querySelector('#omnistrih-measured-qc') !== null);
  check('score basis is rendered', (container.querySelector('#omnistrih-measured-qc-basis')?.textContent ?? '').includes('100 − 25×kritické'));
  check('facts block renders the measured 11.5 s duration', (container.querySelector('#omnistrih-measured-qc-facts')?.textContent ?? '').includes('11.5s'), container.querySelector('#omnistrih-measured-qc-facts')?.textContent);
  check('findings list renders the gap finding', (container.querySelector('#omnistrih-measured-qc-findings')?.textContent ?? '').includes('Diera na timeline'));
  check('finding detail shows the measured 1.5s', (container.querySelector('#omnistrih-measured-qc-findings')?.textContent ?? '').includes('1.5s'));
  check(
    'finding category rendered as a readable label, not the raw enum',
    (container.querySelector('#omnistrih-measured-qc-findings')?.textContent ?? '').toLowerCase().includes('timeline'),
  );
  check('unmeasurable block lists STT limitation', (container.querySelector('#omnistrih-measured-qc-unmeasurable')?.textContent ?? '').includes('STT'));
  check('panel never claims the browser verified the file', !container.textContent?.includes('BROWSER VERIFIED'));

  const runButton = container.querySelector('#omnistrih-measured-qc-run') as any;
  check('run button exists', runButton !== null);
  await act(async () => {
    runButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });
  await settle();
  check('run button calls back once', consumedRun === 1, consumedRun);

  const goButton = (Array.from(container.querySelectorAll('button')) as any[]).find(b => (b.textContent ?? '').includes('Prejsť na')) as any;
  check('finding has a jump button', Boolean(goButton), container.querySelectorAll('button').length);
  await act(async () => {
    goButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });
  await settle();
  check('jump button seeks to the measured time', seekedTo === 5, seekedTo);

  const cleanProject = mkProject([
    videoTrack([mkClip({ id: 'v1', start: 0, duration: 5 })]),
    audioTrack([mkClip({ id: 'a1', start: 0, duration: 5, type: 'audio' })]),
  ]);
  const cleanReport = runQualityCheck(cleanProject);
  const second = await render({ report: cleanReport });
  check('clean report shows the all-clear line', second.container.querySelector('#omnistrih-measured-qc-clean') !== null);
  check('clean report has no findings list', second.container.querySelector('#omnistrih-measured-qc-findings') === null);

  const third = await render({ report: null });
  check('without a report the panel says the check has not run', (third.container.textContent ?? '').includes('Kontrola ešte nebežala'));
  check('without a report no score is invented', third.container.querySelector('#omnistrih-measured-qc-findings') === null && !(third.container.textContent ?? '').includes('/100'));

  await act(async () => {
    root.unmount();
    second.root.unmount();
    third.root.unmount();
  });

  // ---------------------------------------------------------------- §8 RAW→READY pipeline step
  console.log('\n=== §8 RAW→READY pipeline: QC as the last phase before final ===');
  {
    const pipeline = read('src/components/RawToReadyPipeline.tsx');
    const app = read('src/App.tsx');

    check('pipeline declares a QC step with id 11', /id: 11,\s*labelSk: "11\. KONTROLA KVALITY"/.test(pipeline));
    check('QC step is described as the last phase before final', pipeline.includes('POSLEDNÁ FÁZA PRED FINÁLOM'));
    check('multi-format moved to step 12', /id: 12,\s*labelSk: "12\. MULTI-FORMAT"/.test(pipeline));
    check('export moved to step 13', /id: 13,\s*labelSk: "13\. EXPORT"/.test(pipeline));
    check('step navigation bound follows the new count', pipeline.includes('if (currentStep < 13) {') && pipeline.includes('disabled={currentStep === 13}'));
    check('QC step renders measured fields only from the report', pipeline.includes('qcReport.score') && pipeline.includes('qcReport.counts.critical'));
    check('QC step shows the unmeasurable list', pipeline.includes('qcReport.unmeasurable.map'));
    check('QC step states the check has not run instead of inventing data', pipeline.includes('Kontrola ešte nebežala'));
    check('QC step caps the inline list at 5 with an honest remainder line', pipeline.includes('qcReport.findings.slice(0, 5)') && pipeline.includes('nálezov v celej kontrole'));
    check('QC step can jump to a finding', pipeline.includes('Prejsť na ${finding.time}s'));
    check('QC step exposes a run button', pipeline.includes('id="omnistrih-pipeline-qc-run"'));
    check('QC step exposes the full check link', pipeline.includes('onOpenQualityCheck'));
    check('pipeline takes the report and handlers as props', pipeline.includes('qcReport?: QualityCheckReport | null;') && pipeline.includes('onRunQualityCheck?: () => void;') && pipeline.includes('onOpenExport?: () => void;'));
    check('final export button is wired to the real export dialog', pipeline.includes('id="omnistrih-pipeline-open-export"') && pipeline.includes('onOpenExport();'));
    check('final export button has an honest fallback when the dialog is missing', pipeline.includes('Export okno nie je dostupné'));
    check('App passes qcReport into the pipeline', app.includes('qcReport={qcReport}'));
    check('App passes the run handler into the pipeline', app.includes('onRunQualityCheck={handleRunQualityCheck}'));
    check('App opens the QC tab from the pipeline', app.includes('onOpenQualityCheck={() => setActiveTab("qc_analytics")}'));
    check('App opens the real export dialog from the pipeline', app.includes('onOpenExport={() => setIsExportOpen(true)}'));
  }

  // ---------------------------------------------------------------- §9 measured stage narration
  console.log('\n=== §9 project check narration is measured, not scripted ===');
  {
    const { buildStressStages, summariseStages } = await import('./src/core/ai/stressStages');

    const project = mkProject([
      videoTrack([mkClip({ id: 'v1', start: 0, duration: 5 }), mkClip({ id: 'v2', start: 6.5, duration: 5, transitionsIn: { type: 'CROSSFADE', duration: 1.5 } })]),
      audioTrack([mkClip({ id: 'a1', start: 0, duration: 5, type: 'audio', volume: 140 }), mkClip({ id: 'a2', start: 5, duration: 6.5, type: 'audio', volume: 100 })]),
      captionTrack([mkClip({ id: 'c1', start: 0, duration: 3, text: 'Hook', fontSize: 72 })]),
    ], {
      assets: [
        { id: 'asset_video_1', name: 'A001.mp4', type: 'video', duration: 600, size: 1, opfsPath: 'opfs://a001.mp4' } as unknown as ProjectModel['assets'][number],
        { id: 'asset_video_2', name: 'B002.mp4', type: 'video', duration: 300, size: 1 } as unknown as ProjectModel['assets'][number],
      ],
      audioMastering: { loudnessTargetLUFS: -14, truePeakCeilingDbfs: -1 } as unknown as ProjectModel['audioMastering'],
    });
    const report = runQualityCheck(project);
    const stages = buildStressStages(project, report, { hasExport: false });
    const byStage = new Map(stages.map(stage => [stage.stage, stage]));

    check('nine stages are produced', stages.length === 9, stages.map(s => s.stage));
    check('stage order follows the pipeline', stages.map(s => s.stage).join('|') === 'TIMELINE|MEDIA|GAPS & OVERLAPS|CAPTIONS|AUDIO LEVELS|PACING|TRANSITIONS|TRANSCRIPT|EXPORT', stages.map(s => s.stage));

    const timeline = byStage.get('TIMELINE');
    check('TIMELINE reports the measured duration', (timeline?.descSk ?? '').includes('11.5s'), timeline?.descSk);
    check('TIMELINE reports the measured cut count', (timeline?.descSk ?? '').includes('1 rezov'), timeline?.descSk);
    check('TIMELINE is marked measured', timeline?.measured === true);

    const media = byStage.get('MEDIA');
    check('MEDIA counts real assets and OPFS paths', (media?.descSk ?? '').includes('2 assetov') && (media?.descSk ?? '').includes('1 s uloženou OPFS cestou'), media?.descSk);

    const gaps = byStage.get('GAPS & OVERLAPS');
    check('GAPS reports the measured 1 gap', (gaps?.descSk ?? '').includes('1 medzier'), gaps?.descSk);

    const captions = byStage.get('CAPTIONS');
    check('CAPTIONS is measured when caption clips exist', captions?.measured === true && (captions?.descSk ?? '').includes('1 titulkových klipov'));
    check('CAPTIONS declares text width unmeasured', (captions?.descSk ?? '').includes('Šírka textu sa nemeria'));

    const audio = byStage.get('AUDIO LEVELS');
    check('AUDIO reports real clip levels', (audio?.descSk ?? '').includes('2 audio klipov') && (audio?.descSk ?? '').includes('1 nad 100 %'), audio?.descSk);
    check('AUDIO names the project loudness target', (audio?.descSk ?? '').includes('-14 LUFS'), audio?.descSk);
    check('AUDIO states ducking is not implemented', (audio?.descSk ?? '').includes('Ducking hudby nie je implementovaný'));

    const transitions = byStage.get('TRANSITIONS');
    check('TRANSITIONS counts real transitions', (transitions?.descSk ?? '').includes('1 z 2 video klipov') && (transitions?.descSk ?? '').includes('1 prechodov dlhších'), transitions?.descSk);

    const transcript = byStage.get('TRANSCRIPT');
    check('TRANSCRIPT is declared unmeasured without a transcript', transcript?.measured === false && (transcript?.descSk ?? '').startsWith('NEMERANÉ'));
    check('TRANSCRIPT names what cannot be checked', (transcript?.descSk ?? '').includes('rezy v polovici slova'));

    const exportStage = byStage.get('EXPORT');
    check('EXPORT is declared unmeasured without a completed export', exportStage?.measured === false && (exportStage?.descSk ?? '').includes('história exportov neobsahuje dokončený export'));

    const withExport = buildStressStages(project, report, { hasExport: true, sizeBytes: 154.8 * 1024 * 1024, container: 'WebM (9:16)', durationSeconds: 742, integratedLufs: -14.2, truePeakDbfs: -1.1 });
    const exportMeasured = withExport.find(s => s.stage === 'EXPORT');
    check('EXPORT becomes measured when a real export exists', exportMeasured?.measured === true);
    check('EXPORT reports the real bytes, duration and loudness', (exportMeasured?.descSk ?? '').includes('154.8 MB') && (exportMeasured?.descSk ?? '').includes('742s') && (exportMeasured?.descSk ?? '').includes('-14.2 LUFS') && (exportMeasured?.descSk ?? '').includes('-1.1 dBFS'), exportMeasured?.descSk);

    const summary = summariseStages(stages);
    check('summary counts 7 measured / 2 unmeasured', summary.measured === 7 && summary.unmeasured === 2, summary);

    const noCaptionProject = mkProject([videoTrack([mkClip({ id: 'v1', start: 0, duration: 5 })]), audioTrack([mkClip({ id: 'a1', start: 0, duration: 5, type: 'audio' })])]);
    const withoutCaptions = buildStressStages(noCaptionProject, runQualityCheck(noCaptionProject), { hasExport: false });
    check('CAPTIONS is declared unmeasured when the project has no captions', withoutCaptions.find(s => s.stage === 'CAPTIONS')?.measured === false);

    // Anti-fabrication: the previous scripted narration must be gone for good.
    const forbidden = ['raw_interview_01', 'ambient_cinematic_music', 'performance_metrics.png', 'drone_nature', 'Take 1', '154.8 MB, 742', '42s ticha', '1.8s emocionálna'];
    const allText = stages.map(s => `${s.descSk} ${s.descEn}`).join(' ');
    check('no scripted footage names survive in the narration', !forbidden.some(token => allText.includes(token)), forbidden.filter(t => allText.includes(t)));
    check('no scripted stage titles survive', !allText.includes('BAD TAKE SELECTION') && !allText.includes('RENDER & REAL OUTPUT'));

    const panel = read('src/components/QualityControlAndAnalytics.tsx');
    check('the panel no longer holds a scripted stage array', !panel.includes('stressTestSteps'));
    check('the panel builds stages from the project', panel.includes('buildStressStages(project, report,'));
    check('the panel imports the measured stage builder', panel.includes('from "../core/ai/stressStages"'));
    check('the panel marks measured vs unmeasured log lines', panel.includes('"✔ MERANÉ"') && panel.includes('"⚠ NEMERANÉ"'));
    check('the panel reports measured/unmeasured counts in the toast', panel.includes('fáz meraných, ${unmeasured} NEMERANÝCH'));
    check('the button no longer claims a stress test on scripted data', panel.includes('KONTROLA PROJEKTU (MERANÁ)'));
    check('stage builder has no randomness', !read('src/core/ai/stressStages.ts').includes('Math.random'));
    const panelSource = read('src/components/QualityControlAndAnalytics.tsx');
    check('the measured findings list labels the SUBJECT category in words', panelSource.includes('SUBJECT: "tvár v zábere"'));
  }

  // ------------------------------------------------- §8 subject track (measured faces)
  section('§8 the reframe check reads a real face track, or says it has none');
  {
    const sample = (time: number, x: number, y: number, confidence: number) => ({
      time, x, y, width: 40, height: 50, confidence, frameWidth: 400, frameHeight: 300, source: 'FACE_DETECTOR' as const,
    });
    const twoClips = [videoTrack([mkClip({ id: 'v1', start: 0, duration: 5 }), mkClip({ id: 'v2', start: 5, duration: 4 })])];

    // No track at all: the check must stay in the honest "unmeasurable" list with a way forward.
    const withoutTrack = runQualityCheck(mkProject(twoClips));
    check('without a measurement the subject check is declared unmeasured', withoutTrack.unmeasurable.some(u => u.id === 'subject_tracking'));
    check(
      'the unmeasured reason names the studio button that would fix it',
      withoutTrack.unmeasurable.find(u => u.id === 'subject_tracking')?.reasonSk.includes('Zmerať pozície tvárí') === true,
    );
    check('without a measurement no subject finding is invented', !ids(withoutTrack).some(id => id.startsWith('qc_subject_')));

    // Track covering both clips, one confident and one weak measurement.
    const covered = runQualityCheck(
      mkProject(twoClips, {
        analysisResults: { subjectTrack: [sample(1, 100, 60, 0.9), sample(6.5, 60, 40, 0.42)] } as unknown as ProjectModel['analysisResults'],
      })
    );
    check('a covering track is no longer declared unmeasured', !covered.unmeasurable.some(u => u.id === 'subject_tracking'));
    check('every clip with a sample produces no gap finding', !ids(covered).includes('qc_subject_track_gap'));
    check('a weak measurement is reported with its confidence', ids(covered).includes('qc_subject_low_confidence'));
    const weakFinding = covered.findings.find(f => f.id === 'qc_subject_low_confidence');
    check('the weak-measurement finding carries the measured percentage', weakFinding?.detailSk.includes('42 %') === true, weakFinding?.detailSk);
    check('the subject findings use their own category', weakFinding?.category === 'SUBJECT', weakFinding?.category);

    // Track that leaves the second clip uncovered.
    const gap = runQualityCheck(
      mkProject(twoClips, {
        analysisResults: { subjectTrack: [sample(1, 100, 60, 0.9)] } as unknown as ProjectModel['analysisResults'],
      })
    );
    check('a clip without any sample is reported as a gap', ids(gap).includes('qc_subject_track_gap'));
    const gapFinding = gap.findings.find(f => f.id === 'qc_subject_track_gap');
    check('the gap finding names how many clips are uncovered', gapFinding?.detailSk.includes('1 z 2 video klipov') === true, gapFinding?.detailSk);
    check('a single sample is declared sparse', ids(gap).includes('qc_subject_track_sparse'));

    // Face hugging the left edge of the source.
    const edge = runQualityCheck(
      mkProject(twoClips, {
        analysisResults: { subjectTrack: [sample(1, 20, 60, 0.9), sample(6.5, 200, 60, 0.9)] } as unknown as ProjectModel['analysisResults'],
      })
    );
    check('a face near the edge is a warning, not a silent detail', edge.findings.find(f => f.id === 'qc_subject_near_edge')?.severity === 'WARNING');
    check('the edge finding carries the measured position', edge.findings.find(f => f.id === 'qc_subject_near_edge')?.detailSk.includes('5 % šírky') === true, edge.findings.find(f => f.id === 'qc_subject_near_edge')?.detailSk);
    const edgeBaseline = runQualityCheck(
      mkProject(twoClips, {
        analysisResults: { subjectTrack: [sample(1, 200, 60, 0.9), sample(6.5, 200, 60, 0.9)] } as unknown as ProjectModel['analysisResults'],
      })
    );
    check('the edge warning costs the same 8 points as any warning', edge.score === edgeBaseline.score - 8, { edge: edge.score, baseline: edgeBaseline.score });

    // A zero-width frame can never be turned into a position — it must be ignored, not divided by zero.
    const brokenFrame = runQualityCheck(
      mkProject(twoClips, {
        analysisResults: { subjectTrack: [{ ...sample(1, 100, 60, 0.9), frameWidth: 0 }] } as unknown as ProjectModel['analysisResults'],
      })
    );
    check('a sample without frame dimensions cannot produce an edge warning', !ids(brokenFrame).includes('qc_subject_near_edge'));
    check('a broken sample still counts as a measured track', !brokenFrame.unmeasurable.some(u => u.id === 'subject_tracking'));
  }

  // ---------------------------------------------------------------- summary
  console.log(`\n================ QC SUMMARY ================`);
  console.log(`PASS ${pass} / FAIL ${failures.length}`);
  if (failures.length > 0) {
    console.log('FAILED CHECKS:');
    failures.forEach(f => console.log(` - ${f}`));
    process.exitCode = 1;
  } else {
    console.log('JS DOM INTERACTION VERIFIED (jsdom) — browser still NOT VERIFIED for rendering.');
  }
})();

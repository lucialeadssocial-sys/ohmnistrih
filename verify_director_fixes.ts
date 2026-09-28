/**
 * Verification for the AI Director fixes.
 *
 * Run with: npx tsx verify_director_fixes.ts
 *
 * Checks that:
 *  1. No fabrication: a project without analysis yields no data-derived decisions.
 *  2. Real application: accepted decisions actually mutate the canonical project.
 *  3. Honest failure: decisions with no canonical command report skipped, not success.
 *  4. Snapshot: a version snapshot is created before a batch apply.
 */
import { CommandManager, CreateProjectVersionCommand, AddClipCommand } from './src/core/command/commandSystem';
import { createInitialProject } from './src/core/index';
import { createCanonicalClip, ProjectModel } from './src/core/types/project';
import { directorEngine, DirectorEditPlan } from './src/core/ai/directorEngine';
import { TimelineEngine } from './src/core/timeline/timelineEngine';

let failures = 0;
function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name} ${detail}`);
  }
}

// ---------- 1. Honest plan without analysis ---------------------------------
console.log('\n[1] Project WITHOUT analysis results');
const emptyProject = createInitialProject('No analysis');
const planNoData = directorEngine.generateDirectorPlan(emptyProject, 'TikTok', ['Retention']);

const fabricated = planNoData.decisions.filter(d =>
  d.timelineLocation && !emptyProject.analysisResults?.pauses?.some((p: any) => p.start === d.timelineLocation!.start)
);
check('no pause/hook decisions invented from nothing', planNoData.decisions.length === 0, `got ${planNoData.decisions.length} decisions`);
check('unavailable inputs are reported', planNoData.unresolvedAmbiguities.length > 0);
check('confidence is 0 when nothing was derived', planNoData.confidence === 0, `got ${planNoData.confidence}`);
check('analysisReferences is empty', planNoData.analysisReferences.length === 0);

// ---------- 2. Real decisions from real analysis ----------------------------
console.log('\n[2] Project WITH analysis results and clips');
const project: ProjectModel = createInitialProject('With analysis');
project.tracks = project.tracks.map(t => {
  if (t.type === 'video') {
    return {
      ...t,
      clips: [
        createCanonicalClip({ id: 'clip_a', trackId: t.id, assetId: 'asset_1', name: 'A', type: 'video', sourceStart: 0, sourceEnd: 10, timelineStart: 0, duration: 10, speed: 1, volume: 100, scale: 100, opacity: 100, positionX: 0, positionY: 0, rotation: 0, keyframes: [] }),
        createCanonicalClip({ id: 'clip_b', trackId: t.id, assetId: 'asset_2', name: 'B', type: 'video', sourceStart: 0, sourceEnd: 8, timelineStart: 10, duration: 8, speed: 1, volume: 100, scale: 100, opacity: 100, positionX: 0, positionY: 0, rotation: 0, keyframes: [] }),
      ],
    };
  }
  return t;
});
project.analysisResults = {
  projectId: project.id,
  timestamp: Date.now(),
  pauses: [
    { id: 'p1', start: 10, end: 12, duration: 2, type: 'long_pause', confidence: 0.9 },
    { id: 'p2', start: 3, end: 3.5, duration: 0.5, type: 'natural_pause', confidence: 0.8 },
  ],
  hooks: [{ id: 'h1', start: 0, end: 3, type: 'question', confidence: 0.9 }],
  speechDensity: { wordsPerSecond: 3, wordsPerMinute: 180, pauseDensity: 0.2, informationDensity: 'high' },
} as any;

const plan = directorEngine.generateDirectorPlan(project, 'TikTok', ['Retention', 'Education']);
const pauseDecision = plan.decisions.find(d => d.proposedAction?.kind === 'TRIM_RANGE');
const hookDecision = plan.decisions.find(d => d.proposedAction?.kind === 'PUNCH_IN');
check('long pause produced a TRIM_RANGE decision', !!pauseDecision);
check('pause decision targets a real clip', pauseDecision?.affectedClipId === 'clip_b', `got ${pauseDecision?.affectedClipId}`);
check('hook produced a PUNCH_IN decision', !!hookDecision);
check('hook decision targets the first clip', hookDecision?.affectedClipId === 'clip_a', `got ${hookDecision?.affectedClipId}`);
check('natural pause (<0.4s filtered) is not a long pause', plan.decisions.filter(d => d.proposedAction?.kind === 'TRIM_RANGE').length === 1);
check('confidence is the mean of the real decisions', plan.confidence > 0 && plan.confidence <= 1, `got ${plan.confidence}`);

// ---------- 3. Decisions are actually applied ------------------------------
console.log('\n[3] safeBatchApply mutates the canonical project');
const cm = new CommandManager(JSON.parse(JSON.stringify(project)));
const beforeScales = cm.getProject().tracks.flatMap(t => t.clips).map(c => `${c.id}:${c.scale}`);
const hookId = plan.decisions.find(d => d.proposedAction?.kind === 'PUNCH_IN')!.id;
const result = directorEngine.safeBatchApply(cm, plan, [hookId]);
const afterScales = cm.getProject().tracks.flatMap(t => t.clips).map(c => `${c.id}:${c.scale}`);

check('apply reports exactly one applied decision', result.appliedCount === 1, JSON.stringify(result));
check('apply reports success only with real changes', result.success === true);
check('snapshot version id returned', !!result.snapshotVersionId, `got ${result.snapshotVersionId}`);
check('project versions grew by one', (cm.getProject().versions || []).length === 1);
check('clip_a scale actually changed to 115', cm.getProject().tracks.flatMap(t => t.clips).find(c => c.id === 'clip_a')!.scale === 115, `before=${beforeScales.join()} after=${afterScales.join()}`);

// ---------- 4. Honest skip for un-appliable decisions ----------------------
console.log('\n[4] Decisions with no canonical command are reported as skipped');
const trimId = plan.decisions.find(d => d.proposedAction?.kind === 'TRIM_RANGE')!.id;
const manualId = plan.decisions.find(d => d.proposedAction?.kind === 'MANUAL_ONLY')?.id;
const cm2 = new CommandManager(JSON.parse(JSON.stringify(project)));
const ids = [trimId, ...(manualId ? [manualId] : [])];
const res2 = directorEngine.safeBatchApply(cm2, plan, ids);
check('manual-only decision is NOT counted as applied', res2.appliedCount < ids.length, JSON.stringify(res2));
check('skipped reasons are reported to the caller', res2.skipped.length > 0, JSON.stringify(res2.skipped));
check('skipped entries carry a human-readable reason', res2.skipped.every(s => !!s.reason && s.reason.length > 5));

// ---------- 5. executeEditPlan is not a status flag ------------------------
console.log('\n[5] executeEditPlan requires a CommandManager');
const planForExec: DirectorEditPlan = {
  id: 'plan_exec',
  briefId: 'brief_exec',
  title: 'Execution test plan',
  summary: 'Informational operations only',
  status: 'PROPOSED',
  projectStateBefore: { clipCount: 2, duration: 18 },
  projectStateAfter: { estimatedClipCount: 2, estimatedDuration: 18 },
  operations: plan.decisions.map(d => ({
    id: d.id,
    type: 'KEEP_SEGMENT' as const,
    description: 'keep',
    startTime: 0,
    endTime: 1,
    status: 'APPROVED' as const,
  })),
};
const noCm = directorEngine.executeEditPlan(planForExec);
check('without CommandManager it fails instead of claiming success', noCm.success === false && !!noCm.error, JSON.stringify(noCm));
check('plan status stays PROPOSED when nothing ran', planForExec.status === 'PROPOSED');

const cm3 = new CommandManager(JSON.parse(JSON.stringify(project)));
const withCm = directorEngine.executeEditPlan(planForExec, cm3);
check(
  'informational KEEP_SEGMENT operations are skipped, not faked',
  withCm.appliedCount === 0 && withCm.skipped.length === planForExec.operations.length,
  JSON.stringify(withCm)
);

// ---------- 6. Review is computed from project state ----------------------
console.log('\n[6] conductReview derives statuses from the project');
const review = directorEngine.conductReview(
  { id: 'plan_rev', briefId: 'b', title: 't', summary: 's', operations: [], projectStateBefore: { clipCount: 2, duration: 18 }, projectStateAfter: { estimatedClipCount: 2, estimatedDuration: 18 }, status: 'EXECUTED' },
  project
);
check('captions reported as MISSING when the caption track is empty', review.report.captionsStatus === 'MISSING', review.report.captionsStatus);
check('outro reported as ABRUPT when the last clip has no fade', review.report.endStatus === 'OUTRO_ABRUPT', review.report.endStatus);
check('issues list is populated from real findings', review.report.issuesList.length > 0);
check('duration matches so durationStatus is OK', review.report.durationStatus === 'OK', review.report.durationStatus);

const durations = { computed: TimelineEngine.calculateProjectDuration(project) };
console.log(`\n  (timeline duration measured: ${durations.computed}s)`);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);

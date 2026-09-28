/**
 * Verification for the professional Director modes + RAW → READY summary.
 *
 * What this file proves (and what it does NOT):
 *  - Deterministic core-logic checks over real module code (mode filtering, honesty of numbers).
 *  - Source guards that are STATIC (they read files, they do not run a browser).
 *  - It does NOT claim browser rendering. Anything UI-shaped is labelled SOURCE GUARD.
 *
 * Run: npx tsx verify_director_mode.ts
 */
import { coreEngine, createInitialProject, AddClipCommand } from './src/core';
import { DIRECTOR_MODES, QUALITY_RULES, applyDirectorMode, buildReadinessSummary, inferModeForPlatform, DirectorMode, DirectorQuality } from './src/core/ai/directorModes';
import { buildStoryboardScenes } from './src/visual/StoryboardSceneSource';
import { VisualDecisionManager } from './src/visual/VisualDecisionManager';
import { DirectorDecisionItem, DirectorPlan } from './src/core/ai/analysisTypes';

let pass = 0;
let fail = 0;

function check(label: string, condition: boolean, extra?: string) {
  if (condition) {
    pass++;
    console.log(`  PASS  ${label}${extra ? ` — ${extra}` : ''}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}${extra ? ` — ${extra}` : ''}`);
  }
}

const CLIP = (id: string, trackId: string, start: number, duration: number) => ({
  id,
  trackId,
  assetId: 'asset_fixture',
  name: id,
  type: 'video' as const,
  timelineStart: start,
  duration,
  sourceStart: 0,
  sourceEnd: duration,
  speed: 1,
  volume: 100,
  scale: 100,
  opacity: 100,
  positionX: 0,
  positionY: 0,
  rotation: 0,
  keyframes: [],
});

/** Minimal real decision shape — the fields the filter reads, nothing invented. */
function decision(over: Partial<DirectorDecisionItem> & { id: string }): DirectorDecisionItem {
  return {
    id: over.id,
    editDecisionId: over.editDecisionId ?? `edit_${over.id}`,
    priority: over.priority ?? 'RECOMMENDED',
    what: over.what ?? 'fixture decision',
    why: over.why ?? 'fixture',
    whenToUse: 'fixture',
    whenNotToUse: 'fixture',
    howToManual: [],
    alternatives: [],
    confidence: over.confidence ?? 0.9,
    source: 'fixture',
    category: over.category ?? 'heuristic',
    proposedAction: over.proposedAction,
    affectedClipId: over.affectedClipId,
    timelineLocation: over.timelineLocation,
    status: over.status ?? 'proposed',
  } as DirectorDecisionItem;
}

function planWith(decisions: DirectorDecisionItem[]): DirectorPlan {
  return {
    id: 'plan_fixture',
    projectId: 'proj_fixture',
    title: 'fixture',
    targetPlatform: 'TikTok',
    targetFormat: '9:16',
    objectives: ['Retention'],
    audience: 'fixture',
    contentSummary: 'fixture',
    strategies: {},
    decisions,
    analysisReferences: [],
    insightReferences: [],
    knowledgeReferences: [],
    confidence: 0.9,
    unresolvedAmbiguities: [],
    createdAt: 0,
    analysisVersion: 2,
    directorVersion: 1,
  };
}

async function run() {
  console.log('=== Director modes & RAW → READY verification (deterministic core checks) ===');

  // ---------------------------------------------------------------- §1 configs
  console.log('\n--- 1. Mode and quality rules are complete ---');
  const modeIds: DirectorMode[] = ['SOCIAL', 'ADS', 'STORY', 'YOUTUBE', 'PODCAST', 'CORPORATE', 'CUSTOM'];
  check('all seven modes are defined', modeIds.every(id => !!DIRECTOR_MODES[id]), modeIds.join(','));
  check(
    'every mode names its goal in both languages',
    modeIds.every(id => DIRECTOR_MODES[id].goalSk.length > 10 && DIRECTOR_MODES[id].goalEn.length > 10)
  );
  check(
    'every mode allows at least one intervention per minute',
    modeIds.every(id => DIRECTOR_MODES[id].maxDecisionsPerMinute >= 1)
  );
  check(
    'PRO QUALITY is stricter than STANDARD on confidence and density',
    QUALITY_RULES.PRO_QUALITY.minConfidence > QUALITY_RULES.STANDARD.minConfidence &&
      QUALITY_RULES.PRO_QUALITY.maxDecisionsPerMinute < QUALITY_RULES.STANDARD.maxDecisionsPerMinute,
    `${QUALITY_RULES.PRO_QUALITY.minConfidence}/${QUALITY_RULES.PRO_QUALITY.maxDecisionsPerMinute} vs ${QUALITY_RULES.STANDARD.minConfidence}/${QUALITY_RULES.STANDARD.maxDecisionsPerMinute}`
  );
  check('PRO QUALITY explains itself in Slovak', QUALITY_RULES.PRO_QUALITY.noteSk.includes('menej'));
  check('platform → mode inference: shorts are SOCIAL', inferModeForPlatform('TikTok') === 'SOCIAL' && inferModeForPlatform('YouTube Shorts') === 'SOCIAL');
  check('platform → mode inference: ads are ADS', inferModeForPlatform('UGC Ads') === 'ADS');
  check('platform → mode inference: long-form is YOUTUBE', inferModeForPlatform('YouTube Long-form') === 'YOUTUBE');

  // ---------------------------------------------------------------- §2 filtering
  console.log('\n--- 2. Mode filtering is explainable and loses nothing silently ---');
  const project: any = createInitialProject('Director mode fixture');
  project.tracks.find((t: any) => t.type === 'video').clips.push(CLIP('c1', 'track_video', 0, 120));

  const fixtureDecisions = [
    decision({ id: 'd_hook', priority: 'MUST_CONSIDER', confidence: 0.9, proposedAction: { kind: 'PUNCH_IN', parameters: { scale: 1.15 } }, timelineLocation: { start: 4, end: 6 } }),
    decision({ id: 'd_mid', priority: 'RECOMMENDED', confidence: 0.75, proposedAction: { kind: 'CAPTION_EMPHASIS' }, timelineLocation: { start: 30 } }),
    decision({ id: 'd_cut', priority: 'RECOMMENDED', confidence: 0.85, proposedAction: { kind: 'TRIM_RANGE' }, timelineLocation: { start: 60, end: 65 } }),
    decision({ id: 'd_broll', priority: 'RECOMMENDED', confidence: 0.9, proposedAction: { kind: 'BROLL_INSERT' }, timelineLocation: { start: 45 } }),
    decision({ id: 'd_color', priority: 'RECOMMENDED', confidence: 0.9, proposedAction: { kind: 'COLOR_BALANCE' }, affectedClipId: 'c1' }),
    decision({ id: 'd_unanchored', priority: 'OPTIONAL', confidence: 0.95, proposedAction: { kind: 'TRANSITION' } }),
    decision({ id: 'd_spacing_a', priority: 'MUST_CONSIDER', confidence: 0.95, proposedAction: { kind: 'PUNCH_IN', parameters: { scale: 1.1 } }, timelineLocation: { start: 80 } }),
    decision({ id: 'd_spacing_b', priority: 'MUST_CONSIDER', confidence: 0.95, proposedAction: { kind: 'PUNCH_IN', parameters: { scale: 1.1 } }, timelineLocation: { start: 82 } }),
  ];

  const socialPro = applyDirectorMode(planWith(fixtureDecisions), project, 'SOCIAL', 'PRO_QUALITY');
  const customStd = applyDirectorMode(planWith(fixtureDecisions), project, 'CUSTOM', 'STANDARD');

  check('PRO QUALITY keeps fewer interventions than STANDARD', socialPro.plan.decisions.length < customStd.plan.decisions.length, `${socialPro.plan.decisions.length} vs ${customStd.plan.decisions.length}`);
  check(
    'no decision disappears without a record',
    socialPro.plan.decisions.length + socialPro.dropped.length === fixtureDecisions.length,
    `${socialPro.plan.decisions.length} kept + ${socialPro.dropped.length} dropped`
  );
  check(
    'a kept decision is never also reported as dropped',
    socialPro.plan.decisions.every(d => !socialPro.dropped.some(x => x.id === d.id))
  );

  const keptMid = socialPro.plan.decisions.find(d => d.id === 'd_mid');
  const droppedMid = socialPro.dropped.find(d => d.id === 'd_mid');
  check('PRO QUALITY drops a 75% decision', !keptMid && !!droppedMid);
  check('the drop reason names the confidence floor in Slovak', !!droppedMid?.reasonSk.includes('istota') && !!droppedMid?.reasonSk.includes('80'), droppedMid?.reasonSk);
  check('the drop reason exists in English too', !!droppedMid?.reasonEn.includes('confidence'));

  check('STANDARD keeps the 75% decision that PRO drops', customStd.plan.decisions.some(d => d.id === 'd_mid'));
  check('the unanchored decision is dropped with a reason', socialPro.dropped.some(d => d.id === 'd_unanchored' && d.reasonSk.includes('nie je ukotvené')));
  check('spacing kills the second punch-in 2s after the first', socialPro.plan.decisions.filter(d => d.id.startsWith('d_spacing')).length === 1, String(socialPro.plan.decisions.filter(d => d.id.startsWith('d_spacing')).length));
  check('spacing drop explains the rule', socialPro.dropped.some(d => d.id === 'd_spacing_b' && d.reasonSk.includes('PUNCH_IN')));

  const keptOrder = socialPro.plan.decisions.map(d => d.id);
  check('preferred kind wins the ordering tie (B-roll before colour)', keptOrder.indexOf('d_broll') < keptOrder.indexOf('d_color'), keptOrder.join(' → '));
  const lastMust = keptOrder.map((id, i) => ({ id, i })).filter(x => x.id === 'd_hook' || x.id === 'd_spacing_a').map(x => x.i);
  const firstRecommended = keptOrder.findIndex(id => id === 'd_cut' || id === 'd_broll' || id === 'd_color');
  check(
    'higher priority is ordered first',
    Math.max(...lastMust) < firstRecommended,
    keptOrder.join(' → ')
  );
  const executable = (d: DirectorDecisionItem) => !!d.proposedAction && d.proposedAction.kind !== 'MANUAL_ONLY';
  check('every kept intervention respects the PRO confidence floor', socialPro.plan.decisions.filter(executable).every(d => d.confidence >= QUALITY_RULES.PRO_QUALITY.minConfidence));

  // Guidance is the teaching layer — it must survive every mode.
  const guidanceFixture = [
    decision({ id: 'g_manual', priority: 'OPTIONAL', confidence: 0.4, proposedAction: { kind: 'MANUAL_ONLY', parameters: { reason: 'urob ručne' } } }),
    decision({ id: 'g_teach', priority: 'OPTIONAL', confidence: 0.2 }),
  ];
  const guidanceKept = applyDirectorMode(planWith(guidanceFixture), project, 'SOCIAL', 'PRO_QUALITY').plan.decisions;
  check('manual-only guidance survives PRO QUALITY', guidanceKept.some(d => d.id === 'g_manual'));
  check('pure explanation items survive PRO QUALITY', guidanceKept.some(d => d.id === 'g_teach'));
  check('guidance is not counted against the intervention budget', guidanceKept.length === 2, `${guidanceKept.length} kept`);
  check('the plan records which mode + quality produced it', socialPro.plan.mode === 'SOCIAL' && socialPro.plan.quality === 'PRO_QUALITY');
  check('mode notes state the numeric rules applied', (socialPro.plan.modeNotesSk || []).some(n => n.includes('80') && n.includes('min')), (socialPro.plan.modeNotesSk || []).join(' | '));
  check('mode notes are bilingual', (socialPro.plan.modeNotesEn || []).length === (socialPro.plan.modeNotesSk || []).length);

  // Budget per minute: 10 decisions inside the first minute.
  const manyDecisions = Array.from({ length: 10 }, (_, i) =>
    decision({ id: `b${i}`, priority: 'MUST_CONSIDER', confidence: 0.95, proposedAction: { kind: 'CAPTION_EMPHASIS' }, timelineLocation: { start: 1 + i * 5 } })
  );
  const budgeted = applyDirectorMode(planWith(manyDecisions), project, 'SOCIAL', 'PRO_QUALITY');
  check(
    'the per-minute budget is enforced (PRO allows 2/min here)',
    budgeted.plan.decisions.length <= QUALITY_RULES.PRO_QUALITY.maxDecisionsPerMinute,
    `${budgeted.plan.decisions.length} kept of 10`
  );
  check('the budget drop quotes the limit', budgeted.dropped.some(d => d.reasonSk.includes('limit')));

  // A global proposal (whole-timeline caption) must not eat the budget of localized cuts.
  const withGlobal = applyDirectorMode(
    planWith([
      decision({ id: 'g_caption', priority: 'MUST_CONSIDER', confidence: 0.9, proposedAction: { kind: 'CAPTION_EMPHASIS' }, timelineLocation: { start: 0, end: 120 } }),
      decision({ id: 'g_punch_a', priority: 'MUST_CONSIDER', confidence: 0.95, proposedAction: { kind: 'PUNCH_IN', parameters: { scale: 1.1 } }, timelineLocation: { start: 5, end: 7 } }),
      decision({ id: 'g_punch_b', priority: 'MUST_CONSIDER', confidence: 0.93, proposedAction: { kind: 'PUNCH_IN', parameters: { scale: 1.1 } }, timelineLocation: { start: 45, end: 47 } }),
    ]),
    project,
    'SOCIAL',
    'PRO_QUALITY'
  ).plan.decisions.map(d => d.id);
  check(
    'a whole-video proposal does not consume the localized per-minute budget',
    withGlobal.includes('g_caption') && withGlobal.includes('g_punch_a') && withGlobal.includes('g_punch_b'),
    withGlobal.join(',')
  );

  // ---------------------------------------------------------------- §3 readiness
  console.log('\n--- 3. RAW → READY counts are measured, the time figure is a labelled estimate ---');
  const readinessProject: any = {
    ...createInitialProject('Readiness fixture'),
    analysisResults: undefined,
    transcript: undefined,
  };
  const videoTrack = readinessProject.tracks.find((t: any) => t.type === 'video');
  videoTrack.clips.push(CLIP('r1', videoTrack.id, 0, 60), CLIP('r2', videoTrack.id, 60, 60), CLIP('r3', videoTrack.id, 120, 30));

  const readinessPlan = planWith([
    decision({ id: 't1', priority: 'MUST_CONSIDER', confidence: 0.9, proposedAction: { kind: 'TRIM_RANGE' }, timelineLocation: { start: 10, end: 15 } }),
    decision({ id: 't2', priority: 'RECOMMENDED', confidence: 0.85, proposedAction: { kind: 'TRIM_RANGE' }, timelineLocation: { start: 40, end: 43 } }),
    decision({ id: 'p1', priority: 'RECOMMENDED', confidence: 0.9, proposedAction: { kind: 'PUNCH_IN', parameters: { scale: 1.2 } }, timelineLocation: { start: 50 } }),
    decision({ id: 'b1', priority: 'RECOMMENDED', confidence: 0.9, proposedAction: { kind: 'BROLL_INSERT' }, timelineLocation: { start: 70 } }),
    decision({ id: 'c1', priority: 'RECOMMENDED', confidence: 0.9, proposedAction: { kind: 'CAPTION_EMPHASIS' }, timelineLocation: { start: 90 } }),
  ]);

  const summary = buildReadinessSummary(readinessProject, readinessPlan);
  check('duration is the measured end of the last clip', summary.durationSeconds === 150, `${summary.durationSeconds}`);
  check('clip count is the real number of clips', summary.clipCount === 3, `${summary.clipCount}`);
  check('trimmed seconds are summed from the plan ranges', summary.trimmedSeconds === 8, `${summary.trimmedSeconds}`);
  check('intervention counters come from the plan kinds', summary.punchIns === 1 && summary.broll === 1 && summary.captions === 1 && summary.trims === 2, `${summary.punchIns}/${summary.broll}/${summary.captions}/${summary.trims}`);
  check('unmeasured analysis is reported as such', summary.analysisMeasured === false);
  check('no shorts are proposed without measured hooks', summary.hooksMeasured === 0 && summary.shortsProposals === 0);
  const expectedEstimate = Math.round(((5 * 30 + 8 * 4 + 3 * 5) / 60) * 10) / 10;
  check('the saved-time figure follows the stated formula', summary.estimatedManualMinutes === expectedEstimate, `${summary.estimatedManualMinutes} vs ${expectedEstimate}`);
  check('the estimate is labelled as an estimate, not a measurement', summary.estimateBasisSk.includes('Nie je to meranie') && summary.estimateBasisEn.includes('not a measured'));

  // ---------------------------------------------------------------- §4 engine wiring
  console.log('\n--- 4. The engine applies the mode (integration) ---');
  const measured: any = {
    ...createInitialProject('Director engine fixture'),
    analysisResults: {
      projectId: 'engine_fixture',
      timestamp: Date.now(),
      hooks: [
        { id: 'h1', start: 2, end: 5, type: 'question', reason: 'measured', confidence: 0.92 },
        { id: 'h2', start: 30, end: 33, type: 'promise', reason: 'measured', confidence: 0.71 },
      ],
      pauses: [
        { id: 'p1', start: 10, end: 13, duration: 3, type: 'long_pause', confidence: 0.9 },
        { id: 'p2', start: 18, end: 19.2, duration: 1.2, type: 'long_pause', confidence: 0.7 },
      ],
      ctas: [{ id: 'c1', start: 40, end: 43, type: 'subscribe', text: 'Odoberte kanál', confidence: 0.8 }],
    },
    transcript: { id: 'tr1', segments: [{ id: 's1', start: 2, end: 5, text: 'Ako ušetriť čas pri strihu?' }], words: [] },
  };
  const measuredVideo = measured.tracks.find((t: any) => t.type === 'video');
  measuredVideo.clips.push(CLIP('m1', measuredVideo.id, 0, 90));

  coreEngine.commandManager.setProject(measured);
  const socialPlan = coreEngine.generateDirectorPlan('TikTok', ['Retention'], 'SOCIAL', 'PRO_QUALITY');
  check('the engine returns a plan tagged with the requested mode', socialPlan.mode === 'SOCIAL' && socialPlan.quality === 'PRO_QUALITY');
  check('the engine plan is built from measured pauses', socialPlan.decisions.length > 0, `${socialPlan.decisions.length} decisions`);
  check('every engine decision clears the PRO floor quoted in the notes', socialPlan.decisions.every(d => d.confidence >= QUALITY_RULES.PRO_QUALITY.minConfidence));
  check('the engine reports what the mode dropped', (socialPlan.droppedDecisions || []).length + socialPlan.decisions.length > 0);
  check(
    'the engine never fabricates decisions without analysis',
    (() => {
      coreEngine.commandManager.setProject({ ...createInitialProject('No analysis'), analysisResults: undefined, transcript: undefined } as any);
      const bare = coreEngine.generateDirectorPlan('TikTok', ['Retention'], 'SOCIAL', 'PRO_QUALITY');
      return bare.decisions.length === 0 && bare.unresolvedAmbiguities.some(a => a.includes('analysisResults'));
    })()
  );

  // ---------------------------------------------------------------- §5 source guards
  console.log('\n--- 5. Source guards (static file reading, not browser rendering) ---');
  const fs = await import('node:fs');
  const center = fs.readFileSync('src/components/DirectorPlanCenter.tsx', 'utf8');
  const engine = fs.readFileSync('src/core/ai/directorEngine.ts', 'utf8');
  const modes = fs.readFileSync('src/core/ai/directorModes.ts', 'utf8');

  check('the Director Center reads the stored plan during render', center.includes('const plan: DirectorPlan | undefined = project.directorPlan;'));
  check('the Director Center no longer generates a plan during render', !center.includes('project.directorPlan ||\n    coreEngine.generateDirectorPlan'));
  const generateCalls = center.match(/coreEngine\.generateDirectorPlan\(/g) || [];
  check('exactly one place creates a plan (the explicit button)', generateCalls.length === 1, `${generateCalls.length} call site(s)`);
  check('that call site passes the chosen mode and quality', /coreEngine\.generateDirectorPlan\(targetPlatform, selectedObjectives, mode, quality\)/.test(center));
  check('the UI offers every professional mode', center.includes('DIRECTOR_MODES') && center.includes('PRO QUALITY'));
  check('the UI renders the RAW → READY summary', center.includes('RAW → READY') && center.includes('getReadinessSummary'));
  check('the UI shows the dropped decisions with reasons', center.includes('droppedDecisions') && center.includes('reasonSk'));
  check('the engine delegates filtering to the mode module', engine.includes('applyDirectorMode(draftPlan, project, requestedMode, requestedQuality)'));
  check('the mode module contains no randomness', !modes.includes('Math.random'));

  // ---------------------------------------------------------------- §6 apply-all path
  console.log('\n--- 6. „Použiť všetko" really changes the canonical project ---');
  const applyProject: any = { ...createInitialProject('Apply fixture'), analysisResults: undefined, transcript: undefined };
  const applyVideo = applyProject.tracks.find((t: any) => t.type === 'video');
  applyVideo.clips.push(CLIP('a1', applyVideo.id, 0, 30));
  coreEngine.commandManager.setProject(applyProject);

  const applyPlan = planWith([
    decision({ id: 'a_punch', priority: 'MUST_CONSIDER', confidence: 0.9, proposedAction: { kind: 'PUNCH_IN', parameters: { scale: 118 } }, affectedClipId: 'a1', timelineLocation: { start: 1, end: 3 } }),
    decision({ id: 'a_manual', priority: 'RECOMMENDED', confidence: 0.9, proposedAction: { kind: 'MANUAL_ONLY', parameters: { reason: 'ručná práca' } } }),
  ]);
  const beforeScale = coreEngine.getProject().tracks.flatMap((t: any) => t.clips).find((c: any) => c.id === 'a1')?.scale;
  const applyResult = coreEngine.safeBatchApplyDirectorPlan(applyPlan, ['a_punch', 'a_manual']);
  const afterScale = coreEngine.getProject().tracks.flatMap((t: any) => t.clips).find((c: any) => c.id === 'a1')?.scale;

  check('apply-all reports success with the real number of applied edits', applyResult.success === true && applyResult.appliedCount === 1, JSON.stringify({ applied: applyResult.appliedCount, skipped: applyResult.skippedCount }));
  check('the punch-in really changed the canonical clip', beforeScale === 100 && afterScale === 118, `${beforeScale} → ${afterScale}`);
  check('the manual-only decision is reported as skipped, not as applied', applyResult.skippedCount === 1);
  check('the skip reason is written for the user', (applyResult.skipped[0]?.reason || '').length > 5, applyResult.skipped[0]?.reason);
  check('the apply is undoable through a snapshot', !!applyResult.snapshotVersionId);

  const centerAfter = fs.readFileSync('src/components/DirectorPlanCenter.tsx', 'utf8');
  check('the UI offers „Použiť všetko"', centerAfter.includes('Použiť všetko'));
  check('the UI reports how many proposals stay manual', centerAfter.includes('skippedCount'));
  const coreSource = fs.readFileSync('src/core/index.ts', 'utf8');
  check('the core returns the skip information to the caller', /skippedCount: number; skipped: \{ id: string; reason: string \}\[\]/.test(coreSource));

  // ---------------------------------------------------------------- §7 storyboard
  console.log('\n--- 7. Storyboard scenes come from measurements, apply goes through commands ---');
  const storyAsset = { id: 'asset_speaker', name: 'Speaker', type: 'video', duration: 30, width: 1080, height: 1920, fps: 30, opfsPath: 'opfs://speaker.mp4', size: 10, mimeType: 'video/mp4', createdAt: 0 };
  const brollAsset = { id: 'asset_broll', name: 'Workspace', type: 'video', duration: 10, width: 1080, height: 1920, fps: 30, opfsPath: 'opfs://workspace.mp4', size: 10, mimeType: 'video/mp4', createdAt: 0 };

  const storyProject: any = { ...createInitialProject('Storyboard fixture'), analysisResults: undefined, transcript: undefined };
  storyProject.assets.push(storyAsset, brollAsset);
  const storyTrack = storyProject.tracks.find((t: any) => t.type === 'video');
  storyTrack.clips.push({ ...CLIP('s1_clip', storyTrack.id, 0, 30), assetId: 'asset_speaker' });
  storyProject.transcript = {
    id: 'tr_story',
    segments: [
      { id: 'seg1', start: 0, end: 8, text: 'Ako ušetriť čas pri strihu videa?' },
      { id: 'seg2', start: 8, end: 16, text: 'Toto je druhá scéna bez hooku.' },
    ],
    words: [],
  };
  storyProject.analysisResults = {
    projectId: storyProject.id,
    timestamp: Date.now(),
    hooks: [{ id: 'h_story', start: 1, end: 4, type: 'question', reason: 'measured', confidence: 0.83 }],
  };

  const sceneSource = buildStoryboardScenes(storyProject);
  check('one storyboard scene per measured transcript segment', sceneSource.scenes.length === 2, `${sceneSource.scenes.length}`);
  check('scene boundaries are the measured segment times', sceneSource.scenes[0].timelineStart === 0 && sceneSource.scenes[0].timelineEnd === 8);
  check('measured analysis is declared', sceneSource.measured === true);
  check('scene importance is the measured hook confidence', sceneSource.scenes[0].semanticImportance === 0.83, String(sceneSource.scenes[0].semanticImportance));
  check('the evidence names the measured source', sceneSource.evidence[sceneSource.scenes[0].sceneId].importanceSk.includes('Meraná dôvera'));
  check('scene without a hook uses the labelled neutral value', sceneSource.scenes[1].semanticImportance === 0.5 && sceneSource.evidence[sceneSource.scenes[1].sceneId].importanceSk.includes('Neutrálna hodnota'));
  check('keywords come from the real transcript text', sceneSource.scenes[0].keywords.includes('ušetriť') && sceneSource.scenes[0].keywords.includes('strihu'), sceneSource.scenes[0].keywords.join(','));
  check('scene without text has no invented keywords', sceneSource.scenes[1].keywords.length === 0);
  check('the B-roll list excludes the asset already playing in the scene', sceneSource.scenes[0].availableBrollAssets.every(a => a.id !== 'asset_speaker'), sceneSource.scenes[0].availableBrollAssets.map(a => a.id).join(','));
  check('the B-roll list offers the real project asset', sceneSource.scenes[0].availableBrollAssets.some(a => a.id === 'asset_broll'));

  const clipOnlySource = buildStoryboardScenes((() => {
    const p: any = { ...createInitialProject('No transcript'), analysisResults: undefined, transcript: undefined };
    const track = p.tracks.find((t: any) => t.type === 'video');
    track.clips.push(CLIP('only_clip', track.id, 4, 6));
    return p;
  })());
  check('without a transcript scenes are the real clips', clipOnlySource.scenes.length === 1 && clipOnlySource.scenes[0].timelineStart === 4 && clipOnlySource.scenes[0].timelineEnd === 10);
  check('clip-based scenes say the transcript is missing', clipOnlySource.notesSk.some(n => n.includes('Prepis nie je k dispozícii')));
  check('clip-based scenes are not claimed as measured', clipOnlySource.measured === false);

  const emptySource = buildStoryboardScenes({ ...createInitialProject('Empty'), analysisResults: undefined, transcript: undefined } as any);
  check('no clips and no transcript means no storyboard at all', emptySource.scenes.length === 0 && emptySource.notesSk.some(n => n.includes('nedá postaviť')));

  // Apply path: visual decisions -> Director decisions -> canonical commands.
  const applyStoryProject: any = { ...createInitialProject('Storyboard apply'), analysisResults: undefined, transcript: undefined };
  applyStoryProject.assets.push(brollAsset);
  const applyStoryTrack = applyStoryProject.tracks.find((t: any) => t.type === 'video');
  applyStoryTrack.clips.push(CLIP('va1', applyStoryTrack.id, 0, 20));
  coreEngine.commandManager.setProject(applyStoryProject);

  const visualDecisions = [
    { id: 'vd_motion', timelineStart: 2, timelineEnd: 4, type: 'MICRO_MOTION', priority: 2, confidence: 0.92, reason: 'micro motion', reasonSk: 'Jemný pohyb drží oko.', source: 'EDITORIAL_ENGINE', status: 'pending', locked: false },
    { id: 'vd_broll', timelineStart: 6, timelineEnd: 9, type: 'BROLL', priority: 2, confidence: 0.8, reason: 'broll', reasonSk: 'Podporný záber.', source: 'EDITORIAL_ENGINE', status: 'pending', locked: false, visualAssetId: 'asset_broll' },
    { id: 'vd_punchout', timelineStart: 10, timelineEnd: 12, type: 'PUNCH_OUT', priority: 3, confidence: 0.7, reason: 'punch out', reasonSk: 'Zmenšenie záberu.', source: 'EDITORIAL_ENGINE', status: 'pending', locked: false },
  ] as any;
  const directorItems = VisualDecisionManager.toDirectorDecisionItems(coreEngine.getProject(), visualDecisions, 'sb_item1');
  check('visual decisions map onto Director decisions one to one', directorItems.length === 3, `${directorItems.length}`);
  check('micro motion becomes an executable punch-in', directorItems[0].proposedAction?.kind === 'PUNCH_IN');
  check('B-roll maps to a B-roll insert with the real asset id', directorItems[1].proposedAction?.kind === 'BROLL_INSERT' && (directorItems[1].proposedAction as any).parameters.assetId === 'asset_broll');
  check('punch-out is honestly a manual step (no punch-out command)', directorItems[2].proposedAction?.kind === 'MANUAL_ONLY');
  check('the target clip is the real clip at that time', directorItems[0].affectedClipId === 'va1', String(directorItems[0].affectedClipId));

  const beforeStoryScale = coreEngine.getProject().tracks.flatMap((t: any) => t.clips).find((c: any) => c.id === 'va1')?.scale;
  const storyApply = coreEngine.applyDirectorDecisions(directorItems, 'AI Storyboard: 1 scéna');
  const afterStoryScale = coreEngine.getProject().tracks.flatMap((t: any) => t.clips).find((c: any) => c.id === 'va1')?.scale;
  check('the storyboard apply executes what it can', storyApply.success === true && storyApply.appliedCount === 1, JSON.stringify({ applied: storyApply.appliedCount, skipped: storyApply.skippedCount }));
  check('the applied punch-in changed the canonical clip', beforeStoryScale === 100 && afterStoryScale === 115, `${beforeStoryScale} → ${afterStoryScale}`);
  check('B-roll and punch-out are reported as manual, not as applied', storyApply.skippedCount === 2 && storyApply.skipped.every(s => s.reason.length > 5), storyApply.skipped.map(s => s.reason).join(' | '));
  check('the transient plan is not written into the project', (coreEngine.getProject() as any).directorPlan === undefined);
  const motionPreference = (coreEngine.getProject().editingPreferences || []).find((p: any) => p.category === 'MOTION');
  check('only the really applied edit was learned', !!motionPreference && motionPreference.evidenceCount === 1, JSON.stringify(motionPreference && { count: motionPreference.evidenceCount, enabled: motionPreference.enabled }));

  const panel = fs.readFileSync('src/components/AIStoryboardPanel.tsx', 'utf8');
  check('the panel no longer contains the demo scenes', !panel.includes('sampleScenes') && !panel.includes('demo-broll.mp4') && !panel.includes('Hello and welcome'));
  check('the panel builds scenes from the project', panel.includes('buildStoryboardScenes'));
  check('the panel applies through the command system', panel.includes('applyDirectorDecisions'));
  check('the panel reports the manual reason per scene', panel.includes('manualReasonSk') && panel.includes('Ručne:'));
  check('the panel no longer prints "Math.round(" to the user', !panel.includes('Istota: Math.round('));
  const generator = fs.readFileSync('src/visual/AIStoryboardGenerator.ts', 'utf8');
  check('the storyboard confidence is the declared importance, not an invented 0.88 baseline', !generator.includes('0.88 + scene.semanticImportance'));
  check('the storyboard item carries its evidence label', generator.includes('evidenceSk'));
  check('the scene source contains no randomness', !fs.readFileSync('src/visual/StoryboardSceneSource.ts', 'utf8').includes('Math.random'));

  // ---------------------------------------------------------------- §8 do-it-myself
  console.log('\n--- 8. „Skúsim sama" rejects the decision, learns from it and edits nothing ---');
  const myselfProject: any = { ...createInitialProject('Skusim sama fixture'), analysisResults: undefined, transcript: undefined };
  const myselfTrack = myselfProject.tracks.find((t: any) => t.type === 'video');
  myselfTrack.clips.push(CLIP('mk1', myselfTrack.id, 0, 40));
  myselfProject.analysisResults = {
    projectId: myselfProject.id,
    timestamp: Date.now(),
    hooks: [{ id: 'h_mk', start: 2, end: 6, type: 'question', reason: 'measured', confidence: 0.95 }],
  };
  coreEngine.commandManager.setProject(myselfProject);

  const myselfPlan = coreEngine.generateDirectorPlan('TikTok', ['Retention'], 'CUSTOM', 'STANDARD');
  check('the fixture plan produced a decision to hand over', myselfPlan.decisions.length > 0, `${myselfPlan.decisions.length}`);
  const myselfDecision = myselfPlan.decisions[0];
  const scaleBeforeMyself = coreEngine.getProject().tracks.flatMap((t: any) => t.clips).find((c: any) => c.id === 'mk1')?.scale;

  const myselfResult = coreEngine.decideOnReviewItem(myselfDecision.id, 'REJECTED');
  const storedDecision = coreEngine.getProject().directorPlan?.decisions.find(d => d.id === myselfDecision.id);
  const scaleAfterMyself = coreEngine.getProject().tracks.flatMap((t: any) => t.clips).find((c: any) => c.id === 'mk1')?.scale;
  const queueRow = coreEngine.listReviewQueue().find(item => item.id === myselfDecision.id);

  check('the hand-over is accepted by the engine', myselfResult.ok === true && myselfResult.applied === false, JSON.stringify(myselfResult));
  check('the decision is marked as rejected in the canonical plan', storedDecision?.status === 'rejected', String(storedDecision?.status));
  check('the review queue shows the rejection instead of a pending item', queueRow?.status === 'REJECTED', String(queueRow?.status));
  check('nothing on the timeline changed', scaleBeforeMyself === scaleAfterMyself, `${scaleBeforeMyself} → ${scaleAfterMyself}`);
  const learnedCategory = myselfDecision.proposedAction?.kind === 'PUNCH_IN' ? 'MOTION' : null;
  const learned = learnedCategory ? (coreEngine.getProject().editingPreferences || []).find((p: any) => p.category === learnedCategory) : undefined;
  check('the hand-over is recorded as one real observation', !learnedCategory || (!!learned && learned.evidenceCount >= 1), JSON.stringify(learned && { count: learned.evidenceCount, confidence: learned.confidence }));
  check('the UI offers „Skúsim sama"', fs.readFileSync('src/components/DirectorPlanCenter.tsx', 'utf8').includes('Skúsim sama'));
  check('the UI routes it through the canonical decision API', fs.readFileSync('src/components/DirectorPlanCenter.tsx', 'utf8').includes("decideOnReviewItem(dec.id, 'REJECTED')"));

  // ---------------------------------------------------------------- §9 learning loop
  console.log('\n--- 9. Two hand-overs really change the next plan (learning loop) ---');
  const loopProject: any = { ...createInitialProject('Learning loop'), analysisResults: undefined, transcript: undefined };
  const loopTrack = loopProject.tracks.find((t: any) => t.type === 'video');
  loopTrack.clips.push(CLIP('lp1', loopTrack.id, 0, 60));
  loopProject.analysisResults = {
    projectId: loopProject.id,
    timestamp: Date.now(),
    pauses: [
      { id: 'lp_p1', start: 10, end: 13, duration: 3, type: 'long_pause', confidence: 0.9 },
      { id: 'lp_p2', start: 30, end: 32, duration: 2, type: 'long_pause', confidence: 0.8 },
    ],
  };
  coreEngine.commandManager.setProject(loopProject);

  const firstPlan = coreEngine.generateDirectorPlan('TikTok', ['Retention'], 'CUSTOM', 'STANDARD');
  const firstTrims = firstPlan.decisions.filter(d => d.proposedAction?.kind === 'TRIM_RANGE');
  check('two measured long pauses give two trim decisions', firstTrims.length === 2, `${firstTrims.length}`);
  check('the first plan is not yet influenced by learning', firstTrims.every(d => !d.why.includes('Brain')), firstTrims.map(d => d.priority).join(','));

  // The user takes both of them over — one real observation each.
  firstTrims.forEach(d => coreEngine.decideOnReviewItem(d.id, 'REJECTED'));
  const pacingPreference = (coreEngine.getProject().editingPreferences || []).find((p: any) => p.category === 'PACING');
  check('two hand-overs are two real observations', pacingPreference?.evidenceCount === 2, JSON.stringify(pacingPreference && { count: pacingPreference.evidenceCount, value: pacingPreference.value }));

  const secondPlan = coreEngine.generateDirectorPlan('TikTok', ['Retention'], 'CUSTOM', 'STANDARD');
  const secondTrims = secondPlan.decisions.filter(d => d.proposedAction?.kind === 'TRIM_RANGE');
  check('the next plan demotes the pause trimming the user kept taking over', secondTrims.length > 0 && secondTrims.every(d => d.priority === 'OPTIONAL'), secondTrims.map(d => d.priority).join(','));
  check('the demoted decision states the learned evidence', secondTrims.some(d => d.why.includes('Brain') && d.why.includes('2×')), secondTrims[0]?.why.slice(-90));

  // Control: the same fixture without the observations keeps the normal priority.
  const controlProject: any = { ...createInitialProject('Learning control'), analysisResults: loopProject.analysisResults, transcript: undefined };
  const controlTrack = controlProject.tracks.find((t: any) => t.type === 'video');
  controlTrack.clips.push(CLIP('cp1', controlTrack.id, 0, 60));
  coreEngine.commandManager.setProject(controlProject);
  const controlPlan = coreEngine.generateDirectorPlan('TikTok', ['Retention'], 'CUSTOM', 'STANDARD');
  const controlTrims = controlPlan.decisions.filter(d => d.proposedAction?.kind === 'TRIM_RANGE');
  check('without observations the same pauses stay high priority', controlTrims.some(d => d.priority === 'MUST_CONSIDER'), controlTrims.map(d => d.priority).join(','));
  check('the hand-over copy states the 2× threshold', fs.readFileSync('src/components/DirectorPlanCenter.tsx', 'utf8').includes('aspoň 2×'));

  console.log(`\n=== ${fail === 0 ? 'ALL DIRECTOR MODE CHECKS PASSED' : 'DIRECTOR MODE CHECKS FAILED'} — ${pass} passed, ${fail} failed ===`);
  if (fail > 0) process.exitCode = 1;
}

run().catch(err => {
  console.error('verify_director_mode crashed:', err);
  process.exitCode = 1;
});

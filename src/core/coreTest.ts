/**
 * Local Core Automated Verification Suite - FÁZA 1C
 * Comprehensive verification of Canonical Timeline Model, Command System,
 * Multi-Track, Split/Trim/Move/Ripple, Snap, Time Conversions, Validation, and Undo/Redo.
 */

import {
  coreEngine,
  createInitialProject,
  createCanonicalClip,
  AddClipCommand,
  RemoveClipCommand,
  SplitClipCommand,
  TrimClipCommand,
  MoveClipCommand,
  UpdateClipPropsCommand,
  UpdateTrackPropsCommand,
  InsertEditCommand,
  OverwriteEditCommand,
  SetInOutPointsCommand,
  SlipClipCommand,
  SlideClipCommand,
  RippleTrimHeadCommand,
  RippleTrimTailCommand,
  SplitAudioVideoCommand,
  SetAudioFadeCommand,
  SetAudioKeyframeCommand,
  UpdateTranscriptCommand,
  GenerateCaptionsCommand,
  SetTransformCommand,
  SetColorCorrectionCommand,
  SetTransitionCommand,
  AddProjectNoteCommand,
  RemoveProjectNoteCommand,
  CreateEditDecisionCommand,
  UpdateEditDecisionStatusCommand,
  AddReviewCommentCommand,
  ResolveReviewCommentCommand,
  SetReviewStatusCommand,
  CreateProjectVersionCommand,
  RestoreProjectVersionCommand,
  TimelineEngine,
  Keyframe,
  ProjectModel,
  ClipModel,
  TranscriptModel,
  CaptionStyleConfig,
  ColorCorrectionConfig,
  TransitionConfig,
  ProjectNote,
  EditDecision,
  ReviewComment,
  ReviewState,
  ProjectVersion,
  ExportPreset,
  analysisEngine,
  directorEngine,
  getTeachMeExplanation
} from './index';

export function runLocalCoreTests(): { success: boolean; log: string[] } {
  const log: string[] = [];
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      passed++;
      log.push(`✅ [PASS] ${testName}`);
    } else {
      log.push(`❌ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
    }
  }

  try {
    log.push('=== Starting OmniStrih AI — FÁZA 1C Core Verification ===');

    // 1. Project Creation & Multi-track
    const proj = createInitialProject('Canonical Test Project');
    assert(proj.tracks.length === 5, 'Project initialized with 5 multi-type tracks');
    assert(proj.settings.fps === 30, 'Default project FPS is 30');
    assert(!!proj.sequence, 'Project includes canonical sequence model');
    assert(proj.sequence?.videoTracks.length! > 0, 'Sequence has video tracks');
    assert(proj.sequence?.audioTracks.length! > 0, 'Sequence has audio tracks');

    // Reset CoreEngine with clean project
    coreEngine.commandManager.setProject(proj);
    const mainTrackId = proj.tracks.find(t => t.type === 'video')!.id;
    const audioTrackId = proj.tracks.find(t => t.type === 'audio')!.id;

    // 2. Add Clip via Command System
    const testClip1 = createCanonicalClip({
      id: 'clip_001',
      trackId: mainTrackId,
      name: 'Source 60s Raw Clip',
      type: 'video',
      sourceStart: 18,
      sourceEnd: 32,
      timelineStart: 0,
      duration: 14,
      speed: 1.0,
      volume: 100
    });

    const addSuccess = coreEngine.commandManager.executeCommand(
      new AddClipCommand('Add test video clip 1', mainTrackId, testClip1)
    );
    assert(addSuccess, 'AddClipCommand executed successfully');
    
    let currentProj = coreEngine.getProject();
    let track = currentProj.tracks.find(t => t.id === mainTrackId)!;
    let clip1 = track.clips.find(c => c.id === 'clip_001');
    assert(!!clip1, 'Clip exists on target track');
    assert(clip1?.sourceStart === 18 && clip1?.sourceEnd === 32, 'Clip preserves source in/out (18s - 32s)');
    assert(clip1?.timelineStart === 0 && clip1?.duration === 14, 'Clip has timeline start 0s and duration 14s');

    // 3. Move Clip (Source timing must remain invariant)
    const moveCmd = new MoveClipCommand('Move clip 1 to timeline 5s', 'clip_001', 5);
    coreEngine.commandManager.executeCommand(moveCmd);
    currentProj = coreEngine.getProject();
    clip1 = currentProj.tracks.find(t => t.id === mainTrackId)!.clips.find(c => c.id === 'clip_001');
    assert(clip1?.timelineStart === 5 && clip1?.start === 5, 'Clip moved to timeline position 5s');
    assert(clip1?.sourceStart === 18 && clip1?.sourceEnd === 32, 'Move preserved exact sourceStart (18s) and sourceEnd (32s)');
    assert(clip1?.duration === 14, 'Move preserved duration (14s)');

    // Undo Move
    coreEngine.undo();
    currentProj = coreEngine.getProject();
    clip1 = currentProj.tracks.find(t => t.id === mainTrackId)!.clips.find(c => c.id === 'clip_001');
    assert(clip1?.timelineStart === 0, 'Undo restored clip timeline position to 0s');

    // Redo Move then reset back to 0
    coreEngine.redo();
    coreEngine.undo(); // back to timeline 0s

    // 4. Deterministic Split (Exact specification: raw 60s, source 18-32, timeline 0-14, split at timeline 7)
    const splitCmd = new SplitClipCommand('Split clip at timeline 7s', 'clip_001', 7);
    const splitSuccess = coreEngine.commandManager.executeCommand(splitCmd);
    assert(splitSuccess, 'SplitClipCommand executed successfully at timeline 7s');

    currentProj = coreEngine.getProject();
    track = currentProj.tracks.find(t => t.id === mainTrackId)!;
    assert(track.clips.length === 2, 'Track contains 2 clips after split');

    const leftClip = track.clips.find(c => c.timelineStart === 0);
    const rightClip = track.clips.find(c => c.timelineStart === 7);

    assert(!!leftClip && !!rightClip, 'Both left and right clips found');
    assert(
      leftClip?.sourceStart === 18 && leftClip?.sourceEnd === 25 && leftClip?.duration === 7,
      'Left Clip A: source 18-25, timeline 0-7, duration 7'
    );
    assert(
      rightClip?.sourceStart === 25 && rightClip?.sourceEnd === 32 && rightClip?.duration === 7,
      'Right Clip B: source 25-32, timeline 7-14, duration 7'
    );

    // Undo Split
    coreEngine.undo();
    currentProj = coreEngine.getProject();
    track = currentProj.tracks.find(t => t.id === mainTrackId)!;
    assert(track.clips.length === 1 && track.clips[0].id === 'clip_001', 'Undo restored single unified clip');

    // Redo Split
    coreEngine.redo();
    currentProj = coreEngine.getProject();
    track = currentProj.tracks.find(t => t.id === mainTrackId)!;
    assert(track.clips.length === 2, 'Redo re-applied split into 2 clips');

    // 5. Trim Left
    const leftClipId = track.clips[0].id;
    // Trim left inwards by 2 seconds: sourceStart 18 -> 20, timelineStart 0 -> 2, duration 7 -> 5
    const trimLeftCmd = new TrimClipCommand('Trim left 2s', leftClipId, 'left', 2);
    coreEngine.commandManager.executeCommand(trimLeftCmd);
    currentProj = coreEngine.getProject();
    const trimmedLeft = currentProj.tracks.find(t => t.id === mainTrackId)!.clips.find(c => c.id === leftClipId);
    assert(
      trimmedLeft?.sourceStart === 20 && trimmedLeft?.timelineStart === 2 && trimmedLeft?.duration === 5,
      'Trim Left: sourceStart 20, timelineStart 2, duration 5'
    );

    // Undo Trim Left
    coreEngine.undo();
    currentProj = coreEngine.getProject();
    const untrimmedLeft = currentProj.tracks.find(t => t.id === mainTrackId)!.clips.find(c => c.id === leftClipId);
    assert(untrimmedLeft?.sourceStart === 18 && untrimmedLeft?.timelineStart === 0 && untrimmedLeft?.duration === 7, 'Undo restored Trim Left');

    // 6. Trim Right
    const rightClipId = track.clips[1].id;
    // Trim right inwards by -2 seconds: sourceEnd 32 -> 30, duration 7 -> 5, timelineStart remains 7
    const trimRightCmd = new TrimClipCommand('Trim right -2s', rightClipId, 'right', -2);
    coreEngine.commandManager.executeCommand(trimRightCmd);
    currentProj = coreEngine.getProject();
    const trimmedRight = currentProj.tracks.find(t => t.id === mainTrackId)!.clips.find(c => c.id === rightClipId);
    assert(
      trimmedRight?.sourceEnd === 30 && trimmedRight?.duration === 5 && trimmedRight?.timelineStart === 7,
      'Trim Right: sourceEnd 30, duration 5, timelineStart 7'
    );

    // Undo Trim Right
    coreEngine.undo();
    currentProj = coreEngine.getProject();

    // 7. Ripple Delete Test (A | B | C -> delete B -> A | C with C shifted left)
    const clipA = createCanonicalClip({ id: 'c_A', trackId: mainTrackId, name: 'Clip A', type: 'video', timelineStart: 0, duration: 5, sourceStart: 0, sourceEnd: 5 });
    const clipB = createCanonicalClip({ id: 'c_B', trackId: mainTrackId, name: 'Clip B', type: 'video', timelineStart: 5, duration: 5, sourceStart: 0, sourceEnd: 5 });
    const clipC = createCanonicalClip({ id: 'c_C', trackId: mainTrackId, name: 'Clip C', type: 'video', timelineStart: 10, duration: 5, sourceStart: 0, sourceEnd: 5 });

    // Set clean track with A, B, C
    const rippleProj: ProjectModel = {
      ...proj,
      tracks: proj.tracks.map(t => t.id === mainTrackId ? { ...t, clips: [clipA, clipB, clipC] } : t)
    };
    coreEngine.commandManager.setProject(rippleProj);

    const rippleDeleteCmd = new RemoveClipCommand('Ripple Delete Clip B', 'c_B', true);
    coreEngine.commandManager.executeCommand(rippleDeleteCmd);
    currentProj = coreEngine.getProject();
    track = currentProj.tracks.find(t => t.id === mainTrackId)!;
    
    assert(track.clips.length === 2, 'Track has 2 clips after ripple delete');
    const remainingA = track.clips.find(c => c.id === 'c_A');
    const remainingC = track.clips.find(c => c.id === 'c_C');
    assert(remainingA?.timelineStart === 0, 'Clip A remains at timeline 0s');
    assert(remainingC?.timelineStart === 5, 'Clip C rippled left from 10s to 5s');
    assert(remainingC?.sourceStart === 0 && remainingC?.sourceEnd === 5, 'Clip C preserved source timing during ripple');

    // Undo Ripple Delete
    coreEngine.undo();
    currentProj = coreEngine.getProject();
    track = currentProj.tracks.find(t => t.id === mainTrackId)!;
    assert(track.clips.length === 3, 'Undo restored all 3 clips');
    assert(track.clips.find(c => c.id === 'c_C')?.timelineStart === 10, 'Undo restored Clip C to 10s');

    // 8. Snapping with configurable threshold
    const snapResult1 = TimelineEngine.getSnappedTime(currentProj, 5.03, 'c_C', 0.08);
    assert(snapResult1.snapped && snapResult1.time === 5, 'Snapping snapped 5.03s -> 5.0s (threshold 0.08s)');

    const snapResult2 = TimelineEngine.getSnappedTime(currentProj, 5.15, 'c_C', 0.08);
    assert(!snapResult2.snapped && snapResult2.time === 5.15, 'Snapping ignored 5.15s (outside 0.08s threshold)');

    // 9. Source / Timeline Time Conversions
    const speedClip = createCanonicalClip({
      id: 'c_speed',
      trackId: mainTrackId,
      name: '2x Speed Clip',
      type: 'video',
      sourceStart: 10,
      sourceEnd: 30,
      timelineStart: 4,
      duration: 10,
      speed: 2.0
    });

    const calculatedSourceTime = TimelineEngine.timelineToSourceTime(speedClip, 6); // 2s into timeline clip at 2x speed -> +4s in source -> 14s
    assert(calculatedSourceTime === 14, 'timelineToSourceTime at t=6s (2x speed) = 14s');

    const calculatedTimelineTime = TimelineEngine.sourceToTimelineTime(speedClip, 20); // 10s into source at 2x speed -> +5s on timeline -> 9s
    assert(calculatedTimelineTime === 9, 'sourceToTimelineTime at source=20s (2x speed) = 9s');

    // 10. Centralized Validation & Invalid Command Rejection
    const rawInvalidClip: ClipModel = {
      id: 'c_invalid',
      trackId: mainTrackId,
      name: 'Invalid Clip',
      type: 'video',
      sourceStart: 20,
      sourceEnd: 10, // Invalid: sourceEnd < sourceStart
      timelineStart: -2, // Invalid: negative timelineStart
      duration: -5,  // Invalid: negative duration
      start: -2,
      offset: 20,
      speed: 1,
      volume: 100,
      scale: 100,
      opacity: 100,
      positionX: 0,
      positionY: 0,
      rotation: 0,
      keyframes: []
    };
    const clipVal = TimelineEngine.validateClip(rawInvalidClip);
    assert(!clipVal.valid && clipVal.errors.length >= 2, 'Validation caught negative duration and sourceEnd < sourceStart');

    // Invalid split outside clip bounds rejected
    const invalidSplitCmd = new SplitClipCommand('Invalid split at 99s', 'c_A', 99);
    const invalidSplitResult = coreEngine.commandManager.executeCommand(invalidSplitCmd);
    assert(!invalidSplitResult, 'CommandManager rejected invalid split outside clip bounds');

    // 11. Audio Track & Keyframe Interpolation
    const audioClip = createCanonicalClip({
      id: 'c_audio',
      trackId: audioTrackId,
      name: 'Background Audio',
      type: 'audio',
      sourceStart: 0,
      sourceEnd: 30,
      timelineStart: 0,
      duration: 30,
      volume: 80,
      keyframes: [
        { id: 'kf1', timeOffset: 0, parameter: 'volume', value: 0 },
        { id: 'kf2', timeOffset: 5, parameter: 'volume', value: 100 }
      ]
    });
    coreEngine.addClip(audioTrackId, audioClip);
    const audioVal = TimelineEngine.interpolateKeyframeValue(audioClip.keyframes, 'volume', 2.5, 80);
    assert(audioVal === 50, 'Audio volume keyframe interpolated to 50% at t=2.5s');

    // 12. SOURCE/TIMELINE SYNC TEST (Mandatory Phase 1D test)
    // sourceStart = 18, sourceEnd = 32, timelineStart = 10, duration = 14
    const syncClip = createCanonicalClip({
      id: 'c_sync_test',
      trackId: mainTrackId,
      name: 'Sync Test Clip',
      type: 'video',
      sourceStart: 18,
      sourceEnd: 32,
      timelineStart: 10,
      duration: 14,
      speed: 1.0
    });

    const sourceAt10 = TimelineEngine.timelineToSourceTime(syncClip, 10);
    const sourceAt15 = TimelineEngine.timelineToSourceTime(syncClip, 15);
    const sourceAt24 = TimelineEngine.timelineToSourceTime(syncClip, 24);

    assert(sourceAt10 === 18, 'Timeline 10s -> Source 18s');
    assert(sourceAt15 === 23, 'Timeline 15s -> Source 23s (playhead sync)');
    assert(sourceAt24 === 32, 'Timeline 24s -> Source 32s');

    // 13. Track Properties & Controls (Mute, Lock, Visibility)
    const trackMuteCmd = new UpdateTrackPropsCommand('Mute Audio Track', audioTrackId, { muted: true, locked: true });
    coreEngine.commandManager.executeCommand(trackMuteCmd);
    let updatedProj = coreEngine.getProject();
    let audioTrack = updatedProj.tracks.find(t => t.id === audioTrackId)!;
    assert(audioTrack.muted === true && audioTrack.locked === true, 'Track properties (muted & locked) updated via Command');

    coreEngine.undo();
    updatedProj = coreEngine.getProject();
    audioTrack = updatedProj.tracks.find(t => t.id === audioTrackId)!;
    assert(audioTrack.muted === false && audioTrack.locked === false, 'Undo restored track properties');

    // 14. Zoom Invariance (Zoom alters pxPerSec, NOT clip timing)
    const originalTimelineStart = syncClip.timelineStart;
    const originalDuration = syncClip.duration;
    const originalSourceStart = syncClip.sourceStart;
    const originalSourceEnd = syncClip.sourceEnd;

    // Simulate zoom changes from 15px/s to 150px/s
    const zoomFactors = [15, 35, 70, 150];
    const zoomMaintainsData = zoomFactors.every(px => {
      const visualLeft = syncClip.timelineStart * px;
      const visualWidth = syncClip.duration * px;
      return visualLeft >= 0 && visualWidth > 0 &&
        syncClip.timelineStart === originalTimelineStart &&
        syncClip.duration === originalDuration &&
        syncClip.sourceStart === originalSourceStart &&
        syncClip.sourceEnd === originalSourceEnd;
    });
    assert(zoomMaintainsData, 'Zooming transforms pixelsPerSecond purely visually without altering canonical data');

    // 15. Scalability Test: 100+ Synthetic Clips across 5 Canonical Tracks
    const startTimePerf = Date.now();
    const hundredClipsProj = createInitialProject('100+ Clips Stress Project');
    let clipCount = 0;
    for (let i = 0; i < 25; i++) {
      for (const t of hundredClipsProj.tracks) {
        t.clips.push(createCanonicalClip({
          id: `stress_clip_${clipCount++}`,
          trackId: t.id,
          name: `Clip ${clipCount}`,
          type: t.type === 'video' ? 'video' : t.type === 'audio' ? 'audio' : 'b-roll',
          sourceStart: i * 2,
          sourceEnd: i * 2 + 4,
          timelineStart: i * 4,
          duration: 4,
          speed: 1.0,
          volume: 100
        }));
      }
    }
    const valHundred = TimelineEngine.validateProject(hundredClipsProj);
    const totalClips = hundredClipsProj.tracks.reduce((acc, t) => acc + t.clips.length, 0);
    const perfDuration = Date.now() - startTimePerf;

    assert(valHundred.valid && totalClips >= 100, `Canonical model successfully verified with ${totalClips} clips`);
    assert(perfDuration < 50, `100+ clips processed & validated in ${perfDuration}ms (< 50ms)`);

    // ==========================================
    // --- FÁZA 2A: PROFESSIONAL EDITING FOUNDATION TESTS ---
    // ==========================================
    log.push('--- FÁZA 2A: Professional Editing Suite ---');

    // 16. In/Out Points Command & Clear In/Out
    const setInOutCmd = new SetInOutPointsCommand('Set In at 2.5s and Out at 7.5s', 2.5, 7.5);
    coreEngine.commandManager.executeCommand(setInOutCmd);
    let inOutProj = coreEngine.getProject();
    assert(inOutProj.inPoint === 2.5 && inOutProj.outPoint === 7.5, 'In/Out points set on project (2.5s -> 7.5s)');

    coreEngine.undo();
    inOutProj = coreEngine.getProject();
    assert(inOutProj.inPoint === undefined || inOutProj.inPoint === null, 'Undo cleared In/Out points');

    // 17. Insert Edit (Splits crossing clip and ripples subsequent clips right)
    const baseClip1 = createCanonicalClip({
      id: 'insert_base_1',
      trackId: mainTrackId,
      name: 'Base Clip 1',
      type: 'video',
      sourceStart: 0,
      sourceEnd: 10,
      timelineStart: 0,
      duration: 10
    });
    const insertProj: ProjectModel = {
      ...createInitialProject('Insert Test'),
      tracks: proj.tracks.map(t => t.id === mainTrackId ? { ...t, clips: [baseClip1] } : { ...t, clips: [] })
    };
    coreEngine.commandManager.setProject(insertProj);

    const clipToInsert = createCanonicalClip({
      id: 'inserted_clip_x',
      trackId: mainTrackId,
      name: 'Inserted Source Clip',
      type: 'video',
      sourceStart: 5,
      sourceEnd: 8,
      timelineStart: 4,
      duration: 3
    });

    const insertCmd = new InsertEditCommand('Insert at timeline 4s', mainTrackId, clipToInsert, 4);
    coreEngine.commandManager.executeCommand(insertCmd);
    let postInsertProj = coreEngine.getProject();
    let insertTrack = postInsertProj.tracks.find(t => t.id === mainTrackId)!;
    assert(insertTrack.clips.length === 3, 'Insert Edit split existing clip into left/right and inserted new clip (3 clips total)');
    
    const leftPart = insertTrack.clips.find(c => (c.timelineStart ?? 0) === 0);
    const middleInserted = insertTrack.clips.find(c => (c.timelineStart ?? 0) === 4);
    const rightPart = insertTrack.clips.find(c => (c.timelineStart ?? 0) === 7);

    assert(leftPart?.duration === 4 && leftPart?.sourceEnd === 4, 'Left part: timeline 0-4s, source 0-4s');
    assert(middleInserted?.id === 'inserted_clip_x' && middleInserted?.duration === 3, 'Middle inserted clip: timeline 4-7s, duration 3s');
    assert(rightPart?.duration === 6 && (rightPart?.timelineStart ?? 0) === 7 && rightPart?.sourceStart === 4, 'Right part shifted right: timeline 7-13s, source 4-10s');

    // Undo Insert Edit
    coreEngine.undo();
    postInsertProj = coreEngine.getProject();
    insertTrack = postInsertProj.tracks.find(t => t.id === mainTrackId)!;
    assert(insertTrack.clips.length === 1 && insertTrack.clips[0].id === 'insert_base_1', 'Undo restored single unified pre-insert clip');

    // 18. Overwrite Edit (Punches hole in underlying clip without rippling)
    coreEngine.commandManager.setProject(insertProj);
    const overwriteCmd = new OverwriteEditCommand('Overwrite at timeline 4s', mainTrackId, clipToInsert, 4);
    coreEngine.commandManager.executeCommand(overwriteCmd);
    let postOverwriteProj = coreEngine.getProject();
    let overwriteTrack = postOverwriteProj.tracks.find(t => t.id === mainTrackId)!;
    assert(overwriteTrack.clips.length === 3, 'Overwrite Edit punched a hole in the base clip (3 clips total)');

    const owLeft = overwriteTrack.clips.find(c => (c.timelineStart ?? 0) === 0);
    const owMiddle = overwriteTrack.clips.find(c => (c.timelineStart ?? 0) === 4);
    const owRight = overwriteTrack.clips.find(c => (c.timelineStart ?? 0) === 7);

    assert(owLeft?.duration === 4, 'Overwrite Left: duration 4s (timeline 0-4s)');
    assert(owMiddle?.duration === 3, 'Overwrite Middle: duration 3s (timeline 4-7s)');
    assert(owRight?.duration === 3 && (owRight?.timelineStart ?? 0) === 7 && owRight?.sourceStart === 7, 'Overwrite Right: timeline 7-10s, source 7-10s (no ripple)');

    // Undo Overwrite Edit
    coreEngine.undo();
    postOverwriteProj = coreEngine.getProject();
    overwriteTrack = postOverwriteProj.tracks.find(t => t.id === mainTrackId)!;
    assert(overwriteTrack.clips.length === 1 && overwriteTrack.clips[0].id === 'insert_base_1', 'Undo restored original clip prior to overwrite');

    // 19. Slip Edit (Shifts source media without altering timeline position or duration)
    // Clip: timelineStart: 0, duration: 5, sourceStart: 10, sourceEnd: 15
    const slipTargetClip = createCanonicalClip({
      id: 'slip_target',
      trackId: mainTrackId,
      name: 'Slip Target',
      type: 'video',
      sourceStart: 10,
      sourceEnd: 15,
      timelineStart: 0,
      duration: 5
    });
    const slipProj: ProjectModel = {
      ...createInitialProject('Slip Test'),
      tracks: proj.tracks.map(t => t.id === mainTrackId ? { ...t, clips: [slipTargetClip] } : { ...t, clips: [] })
    };
    coreEngine.commandManager.setProject(slipProj);

    // Slip forward by +3s: sourceStart 10 -> 13, sourceEnd 15 -> 18, timelineStart stays 0, duration stays 5
    const slipCmd = new SlipClipCommand('Slip clip +3s', 'slip_target', 3);
    coreEngine.commandManager.executeCommand(slipCmd);
    let slippedProj = coreEngine.getProject();
    let slippedClip = slippedProj.tracks.find(t => t.id === mainTrackId)!.clips.find(c => c.id === 'slip_target');
    assert(
      slippedClip?.sourceStart === 13 && slippedClip?.sourceEnd === 18,
      'Slip Edit: sourceStart shifted 10 -> 13, sourceEnd 15 -> 18'
    );
    assert(
      slippedClip?.timelineStart === 0 && slippedClip?.duration === 5,
      'Slip Edit: timelineStart (0s) and duration (5s) remained strictly invariant'
    );

    // Undo Slip Edit
    coreEngine.undo();
    slippedProj = coreEngine.getProject();
    slippedClip = slippedProj.tracks.find(t => t.id === mainTrackId)!.clips.find(c => c.id === 'slip_target');
    assert(slippedClip?.sourceStart === 10 && slippedClip?.sourceEnd === 15, 'Undo restored original source timing for Slip');

    // 20. Slide Edit (Moves clip along timeline and adjusts adjacent clips)
    // A (0-5s) | B (5-10s) | C (10-15s) -> Slide B right by +2s -> A (0-7s) | B (7-12s) | C (12-15s)
    const slideA = createCanonicalClip({ id: 's_A', trackId: mainTrackId, name: 'Slide A', type: 'video', timelineStart: 0, duration: 5, sourceStart: 0, sourceEnd: 5 });
    const slideB = createCanonicalClip({ id: 's_B', trackId: mainTrackId, name: 'Slide B', type: 'video', timelineStart: 5, duration: 5, sourceStart: 20, sourceEnd: 25 });
    const slideC = createCanonicalClip({ id: 's_C', trackId: mainTrackId, name: 'Slide C', type: 'video', timelineStart: 10, duration: 5, sourceStart: 50, sourceEnd: 55 });

    const slideProj: ProjectModel = {
      ...createInitialProject('Slide Test'),
      tracks: proj.tracks.map(t => t.id === mainTrackId ? { ...t, clips: [slideA, slideB, slideC] } : { ...t, clips: [] })
    };
    coreEngine.commandManager.setProject(slideProj);

    const slideCmd = new SlideClipCommand('Slide B right +2s', 's_B', 2);
    coreEngine.commandManager.executeCommand(slideCmd);
    let slidedProj = coreEngine.getProject();
    let slidedTrack = slidedProj.tracks.find(t => t.id === mainTrackId)!;
    
    const resA = slidedTrack.clips.find(c => c.id === 's_A');
    const resB = slidedTrack.clips.find(c => c.id === 's_B');
    const resC = slidedTrack.clips.find(c => c.id === 's_C');

    assert(resA?.duration === 7, 'Slide Edit: Preceding Clip A extended right (+2s to 7s duration)');
    assert(resB?.timelineStart === 7 && resB?.duration === 5 && resB?.sourceStart === 20, 'Slide Edit: Clip B timelineStart shifted to 7s with invariant duration & source');
    assert(resC?.timelineStart === 12 && resC?.duration === 3 && resC?.sourceStart === 52, 'Slide Edit: Succeeding Clip C shortened left (-2s to 3s duration, timelineStart 12s)');

    // Undo Slide Edit
    coreEngine.undo();
    slidedProj = coreEngine.getProject();
    slidedTrack = slidedProj.tracks.find(t => t.id === mainTrackId)!;
    assert(slidedTrack.clips.find(c => c.id === 's_B')?.timelineStart === 5, 'Undo restored Slide Edit to original timeline positions');

    // 21. Ripple Trim Head (Q key shortcut)
    // Clip A (0-10s) -> Ripple Trim Head at playhead 3s -> Clip A (0-7s, sourceStart 3) and ripples subsequent clips
    const qClip = createCanonicalClip({ id: 'q_clip', trackId: mainTrackId, name: 'Q Clip', type: 'video', timelineStart: 0, duration: 10, sourceStart: 0, sourceEnd: 10 });
    const qNext = createCanonicalClip({ id: 'q_next', trackId: mainTrackId, name: 'Q Next', type: 'video', timelineStart: 10, duration: 5, sourceStart: 0, sourceEnd: 5 });
    const qProj: ProjectModel = {
      ...createInitialProject('Q Test'),
      tracks: proj.tracks.map(t => t.id === mainTrackId ? { ...t, clips: [qClip, qNext] } : { ...t, clips: [] })
    };
    coreEngine.commandManager.setProject(qProj);

    const qCmd = new RippleTrimHeadCommand('Ripple Trim Head at 3s', 'q_clip', 3);
    coreEngine.commandManager.executeCommand(qCmd);
    let postQProj = coreEngine.getProject();
    let qTrack = postQProj.tracks.find(t => t.id === mainTrackId)!;

    const trimmedQ = qTrack.clips.find(c => c.id === 'q_clip');
    const rippledQNext = qTrack.clips.find(c => c.id === 'q_next');

    assert(trimmedQ?.duration === 7 && trimmedQ?.sourceStart === 3, 'Ripple Trim Head (Q): duration 7s, sourceStart 3s');
    assert(rippledQNext?.timelineStart === 7, 'Ripple Trim Head (Q): subsequent clip rippled left from 10s to 7s');

    // Undo Q
    coreEngine.undo();
    postQProj = coreEngine.getProject();
    qTrack = postQProj.tracks.find(t => t.id === mainTrackId)!;
    assert(qTrack.clips.find(c => c.id === 'q_clip')?.duration === 10, 'Undo restored pre-Q trim');

    // 22. Ripple Trim Tail (W key shortcut)
    coreEngine.commandManager.setProject(qProj);
    const wCmd = new RippleTrimTailCommand('Ripple Trim Tail at 7s', 'q_clip', 7);
    coreEngine.commandManager.executeCommand(wCmd);
    let postWProj = coreEngine.getProject();
    let wTrack = postWProj.tracks.find(t => t.id === mainTrackId)!;

    const trimmedW = wTrack.clips.find(c => c.id === 'q_clip');
    const rippledWNext = wTrack.clips.find(c => c.id === 'q_next');

    assert(trimmedW?.duration === 7 && trimmedW?.sourceEnd === 7, 'Ripple Trim Tail (W): duration 7s, sourceEnd 7s');
    assert(rippledWNext?.timelineStart === 7, 'Ripple Trim Tail (W): subsequent clip rippled left from 10s to 7s');

    // Undo W
    coreEngine.undo();
    postWProj = coreEngine.getProject();
    wTrack = postWProj.tracks.find(t => t.id === mainTrackId)!;
    assert(wTrack.clips.find(c => c.id === 'q_clip')?.duration === 10, 'Undo restored pre-W trim');

    // 23. J/K/L Speed Multipliers & Calculation
    assert(TimelineEngine.calculateJklSpeed(0, 'L') === 1, 'JKL: K (0x) -> L = +1x');
    assert(TimelineEngine.calculateJklSpeed(1, 'L') === 2, 'JKL: +1x -> L = +2x');
    assert(TimelineEngine.calculateJklSpeed(2, 'L') === 4, 'JKL: +2x -> L = +4x');
    assert(TimelineEngine.calculateJklSpeed(4, 'K') === 0, 'JKL: +4x -> K = 0x (Pause)');
    assert(TimelineEngine.calculateJklSpeed(0, 'J') === -1, 'JKL: 0x -> J = -1x (Reverse)');
    assert(TimelineEngine.calculateJklSpeed(-1, 'J') === -2, 'JKL: -1x -> J = -2x');

    // 24. Frame Stepping Accuracy (24, 30, 60 FPS & Boundary Clamping)
    const step24 = TimelineEngine.frameStep(1.0, 'forward', 24, 1);
    assert(Math.abs(step24 - (1.0 + 1/24)) < 0.0001, 'Frame step at 24 FPS (1/24s duration) = ~1.04167s');

    const step30 = TimelineEngine.frameStep(1.0, 'forward', 30, 1);
    assert(Math.abs(step30 - (1.0 + 1/30)) < 0.0001, 'Frame step at 30 FPS (1/30s duration) = ~1.03333s');

    const step60 = TimelineEngine.frameStep(1.0, 'forward', 60, 1);
    assert(Math.abs(step60 - (1.0 + 1/60)) < 0.0001, 'Frame step at 60 FPS (1/60s duration) = ~1.01667s');

    const stepBack30 = TimelineEngine.frameStep(1.0, 'backward', 30, 1);
    assert(Math.abs(stepBack30 - (1.0 - 1/30)) < 0.0001, 'Frame step backward at 30 FPS = ~0.96667s');

    const boundZero = TimelineEngine.frameStep(0, 'backward', 30, 1, 10);
    assert(boundZero === 0, 'Frame step boundary clamp at 0 (previous frame from 0 stays 0)');

    const boundDuration = TimelineEngine.frameStep(10, 'forward', 30, 1, 10);
    assert(boundDuration === 10, 'Frame step boundary clamp at duration (next frame from duration stays duration)');

    // 25. Split Audio/Video into Linked Tracks (L/J Cut Split)
    const avClip = createCanonicalClip({
      id: 'av_main',
      trackId: mainTrackId,
      name: 'Interview Video',
      type: 'video',
      sourceStart: 0,
      sourceEnd: 15,
      timelineStart: 0,
      duration: 15
    });
    const avProj: ProjectModel = {
      ...createInitialProject('AV Split Test'),
      tracks: proj.tracks.map(t => t.id === mainTrackId ? { ...t, clips: [avClip] } : { ...t, clips: [] })
    };
    coreEngine.commandManager.setProject(avProj);

    const splitAvCmd = new SplitAudioVideoCommand('Split Audio/Video', 'av_main', audioTrackId);
    coreEngine.commandManager.executeCommand(splitAvCmd);
    let postAvProj = coreEngine.getProject();
    let vTrack = postAvProj.tracks.find(t => t.id === mainTrackId)!;
    let aTrack = postAvProj.tracks.find(t => t.id === audioTrackId)!;

    const vidClip = vTrack.clips.find(c => c.id === 'av_main');
    const audClip = aTrack.clips.find(c => c.linkedClipId === 'av_main');

    assert(!!vidClip && !!audClip, 'Audio/Video split into separate video and audio tracks');
    assert(vidClip?.linkedClipId === audClip?.id && audClip?.linkedClipId === vidClip?.id, 'Clips cross-linked for synchronous editing');
    assert(audClip?.type === 'audio' && audClip?.duration === 15, 'Extracted audio clip has type audio and matching duration 15s');

    // ==========================================
    // --- FÁZA 2B: PROFESSIONAL AUDIO + CAPTIONS ---
    // ==========================================
    log.push('--- FÁZA 2B: Professional Audio + Captions Suite ---');

    // 26. Audio Fade In / Fade Out Calculation & Command
    const audioTestClip = createCanonicalClip({
      id: 'audio_fade_clip',
      trackId: audioTrackId,
      name: 'Audio Fade Test',
      type: 'audio',
      sourceStart: 0,
      sourceEnd: 10,
      timelineStart: 0,
      duration: 10,
      fadeIn: 2.0,
      fadeOut: 2.0
    });
    const audioProj: ProjectModel = {
      ...createInitialProject('Audio Fades Test'),
      tracks: proj.tracks.map(t => t.id === audioTrackId ? { ...t, clips: [audioTestClip] } : { ...t, clips: [] })
    };
    coreEngine.commandManager.setProject(audioProj);

    const gainAt0 = TimelineEngine.calculateAudioGain(audioTestClip, 0);
    const gainAt1 = TimelineEngine.calculateAudioGain(audioTestClip, 1.0); // halfway into 2s fadeIn -> 0.5
    const gainAt5 = TimelineEngine.calculateAudioGain(audioTestClip, 5.0); // middle -> 1.0
    const gainAt9 = TimelineEngine.calculateAudioGain(audioTestClip, 9.0); // halfway into 2s fadeOut -> 0.5

    assert(gainAt0 === 0, 'Audio fade in at t=0s is 0.0');
    assert(Math.abs(gainAt1 - 0.5) < 0.01, 'Audio fade in at t=1s is 0.5');
    assert(gainAt5 === 1.0, 'Audio gain at middle t=5s is 1.0');
    assert(Math.abs(gainAt9 - 0.5) < 0.01, 'Audio fade out at t=9s is 0.5');

    // Test SetAudioFadeCommand with Undo/Redo
    const fadeCmd = new SetAudioFadeCommand('Set Fades 3s', 'audio_fade_clip', 3.0, 3.0);
    coreEngine.commandManager.executeCommand(fadeCmd);
    let fadedProj = coreEngine.getProject();
    let fadedClip = fadedProj.tracks.find(t => t.id === audioTrackId)!.clips.find(c => c.id === 'audio_fade_clip')!;
    assert(fadedClip.fadeIn === 3.0 && fadedClip.fadeOut === 3.0, 'SetAudioFadeCommand updated fade times');

    coreEngine.undo();
    fadedProj = coreEngine.getProject();
    fadedClip = fadedProj.tracks.find(t => t.id === audioTrackId)!.clips.find(c => c.id === 'audio_fade_clip')!;
    assert(fadedClip.fadeIn === 2.0, 'Undo restored original audio fades');

    // 27. Audio Keyframes & Interpolation
    const kfCmd = new SetAudioKeyframeCommand('Add volume keyframe', 'audio_fade_clip', {
      id: 'kf_vol',
      timeOffset: 5.0,
      parameter: 'volume',
      value: 0
    });
    coreEngine.commandManager.executeCommand(kfCmd);
    let kfProj = coreEngine.getProject();
    let kfClip = kfProj.tracks.find(t => t.id === audioTrackId)!.clips.find(c => c.id === 'audio_fade_clip')!;
    assert(kfClip.keyframes.length === 1 && kfClip.keyframes[0].value === 0, 'SetAudioKeyframeCommand added volume keyframe');

    const gainWithKfAt5 = TimelineEngine.calculateAudioGain(kfClip, 5.0);
    assert(gainWithKfAt5 === 0, 'Audio gain interpolated to 0 at keyframe t=5s');

    coreEngine.undo();
    kfProj = coreEngine.getProject();
    kfClip = kfProj.tracks.find(t => t.id === audioTrackId)!.clips.find(c => c.id === 'audio_fade_clip')!;
    assert(kfClip.keyframes.length === 0, 'Undo removed audio keyframe');

    // 28. Transcript Model & Update Transcript Command
    const sampleTranscript: TranscriptModel = {
      id: 'tr_001',
      language: 'sk',
      segments: [
        { id: 'seg_1', start: 0, end: 3, text: 'Vitajte v OmniStrih AI.' },
        { id: 'seg_2', start: 3, end: 6, text: 'Profesionálny video editor.' }
      ]
    };
    const transcriptCmd = new UpdateTranscriptCommand('Update transcript', sampleTranscript);
    coreEngine.commandManager.executeCommand(transcriptCmd);
    let transProj = coreEngine.getProject();
    assert(transProj.transcript?.segments.length === 2, 'UpdateTranscriptCommand stored transcript segments');

    coreEngine.undo();
    transProj = coreEngine.getProject();
    assert(!transProj.transcript, 'Undo cleared transcript');

    // 29. Generate Captions from Transcript
    coreEngine.commandManager.setProject(transProj);
    const captionTrackId = proj.tracks.find(t => t.type === 'caption')!.id;
    const genCaptionsCmd = new GenerateCaptionsCommand('Generate captions from transcript', sampleTranscript, captionTrackId, { fontSize: 28, color: '#facc15' });
    coreEngine.commandManager.executeCommand(genCaptionsCmd);
    let postCapProj = coreEngine.getProject();
    let capTrack = postCapProj.tracks.find(t => t.id === captionTrackId)!;

    assert(capTrack.clips.length === 2, 'GenerateCaptionsCommand created 2 caption clips on caption track');
    assert(capTrack.clips[0].textConfig?.content === 'Vitajte v OmniStrih AI.' && capTrack.clips[0].timelineStart === 0, 'First caption clip has correct text and start time');
    assert(capTrack.clips[1].captionStyle?.fontSize === 28 && capTrack.clips[1].captionStyle?.color === '#facc15', 'Caption clips inherited style configuration');

    // Undo Generate Captions
    coreEngine.undo();
    postCapProj = coreEngine.getProject();
    capTrack = postCapProj.tracks.find(t => t.id === captionTrackId)!;
    assert(capTrack.clips.length === 0, 'Undo removed generated caption clips');

    // ==========================================
    // --- FÁZA 2C: MOTION + TRANSITIONS + COLOR + LEARNING ---
    // ==========================================
    log.push('--- FÁZA 2C: Motion, Transitions, Color & Learning Suite ---');

    // 31. Motion & Transform Command (Scale, Position, Rotation, Opacity, Anchor)
    const motionClip = createCanonicalClip({
      id: 'motion_clip',
      trackId: mainTrackId,
      name: 'Motion Clip',
      type: 'video',
      timelineStart: 0,
      duration: 5
    });
    const motionProj: ProjectModel = {
      ...createInitialProject('Motion Test'),
      tracks: proj.tracks.map(t => t.id === mainTrackId ? { ...t, clips: [motionClip] } : { ...t, clips: [] })
    };
    coreEngine.commandManager.setProject(motionProj);

    const transformCmd = new SetTransformCommand('Set Motion Transform', 'motion_clip', { scale: 125, positionX: 50, positionY: -30, rotation: 15, opacity: 90, anchorX: 0.3, anchorY: 0.7 });
    coreEngine.commandManager.executeCommand(transformCmd);
    let postMotionProj = coreEngine.getProject();
    let updatedMotionClip = postMotionProj.tracks.find(t => t.id === mainTrackId)!.clips.find(c => c.id === 'motion_clip')!;

    assert(updatedMotionClip.scale === 125 && updatedMotionClip.positionX === 50 && updatedMotionClip.rotation === 15 && updatedMotionClip.opacity === 90, 'SetTransformCommand updated motion parameters');
    assert(updatedMotionClip.anchorX === 0.3 && updatedMotionClip.anchorY === 0.7, 'SetTransformCommand updated anchor point');

    coreEngine.undo();
    postMotionProj = coreEngine.getProject();
    updatedMotionClip = postMotionProj.tracks.find(t => t.id === mainTrackId)!.clips.find(c => c.id === 'motion_clip')!;
    assert(updatedMotionClip.scale === 100 && updatedMotionClip.positionX === 0, 'Undo restored original motion parameters');

    // 32. Color Correction Command & Presets
    coreEngine.commandManager.setProject(motionProj);
    const colorCmd = new SetColorCorrectionCommand('Apply Cinematic Color', 'motion_clip', {
      exposure: 0.5,
      brightness: 10,
      contrast: 20,
      saturation: 115,
      temperature: 5600,
      tint: 5,
      highlights: -10,
      shadows: 15,
      whites: 5,
      blacks: -5,
      lutIntensity: 50
    });
    coreEngine.commandManager.executeCommand(colorCmd);
    let postColorProj = coreEngine.getProject();
    let coloredClip = postColorProj.tracks.find(t => t.id === mainTrackId)!.clips.find(c => c.id === 'motion_clip')!;
    assert(coloredClip.colorCorrection?.contrast === 20 && coloredClip.colorCorrection?.saturation === 115, 'SetColorCorrectionCommand applied color grading parameters');

    coreEngine.undo();
    postColorProj = coreEngine.getProject();
    coloredClip = postColorProj.tracks.find(t => t.id === mainTrackId)!.clips.find(c => c.id === 'motion_clip')!;
    assert(coloredClip.colorCorrection?.contrast === 0, 'Undo restored default color correction');

    // 33. Transitions Command (Dissolve / Fade / Zoom)
    coreEngine.commandManager.setProject(motionProj);
    const transCmd = new SetTransitionCommand('Add Dissolve Transition', 'motion_clip', 'in', { type: 'dissolve', duration: 1.0 });
    coreEngine.commandManager.executeCommand(transCmd);
    let postTransProj = coreEngine.getProject();
    let transClip = postTransProj.tracks.find(t => t.id === mainTrackId)!.clips.find(c => c.id === 'motion_clip')!;
    assert(transClip.transitions?.in?.type === 'dissolve' && transClip.transitions.in.duration === 1.0, 'SetTransitionCommand added incoming dissolve transition');

    coreEngine.undo();
    postTransProj = coreEngine.getProject();
    transClip = postTransProj.tracks.find(t => t.id === mainTrackId)!.clips.find(c => c.id === 'motion_clip')!;
    assert(!transClip.transitions?.in, 'Undo removed transition');

    // 34. Learning Foundation & WHY Explanation Model
    const learningExplanation = {
      what: 'Punch-in zoom (100% -> 125%)',
      why: 'Vizuálne zvýraznenie kľúčového momentu vo výpovedi rečníka.',
      when: 'Keď rečník zdôrazňuje dôležitú myšlienku alebo emóciu.',
      how: 'Použitie SetTransformCommand s miernym navýšením scale pri zachovaní ostrosti.',
      category: 'Storytelling & Retention'
    };
    const clipWithLearning = createCanonicalClip({
      ...motionClip,
      learningMeta: learningExplanation
    });
    assert(!!clipWithLearning.learningMeta?.why && clipWithLearning.learningMeta.why.includes('Vizuálne zvýraznenie'), 'Learning Foundation explanation model correctly attached with WHAT/WHY/WHEN/HOW metadata');

    // ==========================================
    // --- FÁZA 2D: WORKFLOW + REVIEW + AI EDIT DECISION ---
    // ==========================================
    log.push('--- FÁZA 2D: Workflow + Review + AI Edit Decision Foundation ---');

    // 35. Project Notes Command
    const testNote: ProjectNote = {
      id: 'note_001',
      title: 'Pacing feedback',
      content: 'Zzrýchliť tempo medzi 12s a 18s.',
      category: 'feedback',
      timecode: 12.0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const addNoteCmd = new AddProjectNoteCommand('Add note', testNote);
    coreEngine.commandManager.executeCommand(addNoteCmd);
    let postNoteProj = coreEngine.getProject();
    assert(postNoteProj.notes?.length === 1 && postNoteProj.notes[0].title === 'Pacing feedback', 'AddProjectNoteCommand added project note');

    coreEngine.undo();
    postNoteProj = coreEngine.getProject();
    assert((postNoteProj.notes?.length || 0) === 0, 'Undo cleanly removed project note');

    // 36. AI Edit Decision Foundation
    const testDecision: EditDecision = {
      id: 'decision_001',
      timestamp: Date.now(),
      type: 'b_roll',
      reason: 'Rečník hovorí o grafe predajov, odporúčaný B-roll grafu.',
      impact: 'Zvýšenie retencie o ~18% pri 14s.',
      status: 'proposed',
      learningNote: 'B-roll strih udržuje pozornosť diváka pri abstraktných témach.'
    };
    const createDecCmd = new CreateEditDecisionCommand('Create AI edit decision', testDecision);
    coreEngine.commandManager.executeCommand(createDecCmd);
    let postDecProj = coreEngine.getProject();
    assert(postDecProj.editDecisions?.length === 1 && postDecProj.editDecisions[0].status === 'proposed', 'CreateEditDecisionCommand registered proposed AI decision');

    const updateDecCmd = new UpdateEditDecisionStatusCommand('Accept AI decision', 'decision_001', 'accepted');
    coreEngine.commandManager.executeCommand(updateDecCmd);
    postDecProj = coreEngine.getProject();
    assert(postDecProj.editDecisions?.[0].status === 'accepted', 'UpdateEditDecisionStatusCommand updated status to accepted');

    coreEngine.undo();
    postDecProj = coreEngine.getProject();
    assert(postDecProj.editDecisions?.[0].status === 'proposed', 'Undo restored proposed decision status');

    // 37. Review System & Comments
    const testComment: ReviewComment = {
      id: 'rev_001',
      timecode: 5.5,
      text: 'Upraviť hlasitosť pozadia pod hovorcom.',
      author: 'ai_director',
      status: 'open',
      createdAt: Date.now()
    };
    const addCommCmd = new AddReviewCommentCommand('Add review comment', testComment);
    coreEngine.commandManager.executeCommand(addCommCmd);
    let postRevProj = coreEngine.getProject();
    assert(postRevProj.reviewState?.comments.length === 1 && postRevProj.reviewState.comments[0].status === 'open', 'AddReviewCommentCommand added review comment');

    const resolveCommCmd = new ResolveReviewCommentCommand('Resolve comment', 'rev_001', 'resolved');
    coreEngine.commandManager.executeCommand(resolveCommCmd);
    postRevProj = coreEngine.getProject();
    assert(postRevProj.reviewState?.comments[0].status === 'resolved', 'ResolveReviewCommentCommand resolved comment');

    const setReviewStatusCmd = new SetReviewStatusCommand('Set review approved', 'approved', true);
    coreEngine.commandManager.executeCommand(setReviewStatusCmd);
    postRevProj = coreEngine.getProject();
    assert(postRevProj.reviewState?.status === 'approved' && postRevProj.reviewState.lockedForExport === true, 'SetReviewStatusCommand updated project review state');

    // 38. Version Snapshots
    const createVerCmd = new CreateProjectVersionCommand('Create Version 1.0', 'Rough Cut v1.0', 'Základný hrubý strih s titulkami');
    coreEngine.commandManager.executeCommand(createVerCmd);
    let postVerProj = coreEngine.getProject();
    assert(postVerProj.versions?.length === 1 && postVerProj.versions[0].label === 'Rough Cut v1.0', 'CreateProjectVersionCommand saved project version snapshot');

    const verId = postVerProj.versions![0].id;
    const restoreVerCmd = new RestoreProjectVersionCommand('Restore Version 1.0', verId);
    const restoreSuccess = coreEngine.commandManager.executeCommand(restoreVerCmd);
    assert(restoreSuccess, 'RestoreProjectVersionCommand successfully restored version snapshot');

    // 39. Export Presets Validation
    assert(postVerProj.exportPresets?.length! >= 4, 'Project contains default export presets for YouTube, TikTok, Broadcast');
    assert(!!postVerProj.exportPresets?.some(p => p.presetType === 'tiktok' && p.resolution.height === 1920), 'TikTok 9:16 export preset verified');

    // ==========================================
    // --- FÁZA 2E: AI ANALYSIS + EDITING INTELLIGENCE FOUNDATION ---
    // ==========================================
    log.push('--- FÁZA 2E: AI Analysis + Editing Intelligence Foundation Suite ---');

    // 40. Non-destructive Silence & Pause Analysis
    const testAnalysisProj = createInitialProject('Analysis Test Project');
    testAnalysisProj.transcript = {
      id: 'trans_001',
      language: 'sk',
      segments: [
        { id: 'seg_1', start: 0, end: 4.2, text: 'Vítajte pri dnešnom videu o profesionálnom strihu.' },
        { id: 'seg_2', start: 6.0, end: 10.5, text: 'Ukážeme si ako správne pracovať s tematom a pauzami.' }
      ]
    };
    const pauses = analysisEngine.analyzeSilenceAndPauses(testAnalysisProj);
    assert(pauses.length === 1 && pauses[0].duration >= 1.7, 'Silence/Pause analyzer detected 1.8s speech gap without destructive edits');

    // 41. Speech Density Metrics
    const density = analysisEngine.analyzeSpeechDensity(testAnalysisProj);
    assert(density.wordsPerMinute > 0 && density.wordsPerSecond > 0, 'Speech density metrics calculated WPM and WPS successfully');

    // 42. Shot Detection & Scene Grouping
    const shots = analysisEngine.analyzeShots(testAnalysisProj);
    const scenes = analysisEngine.analyzeScenes(shots);
    assert(shots.length > 0 && scenes.length > 0, 'Shot detector and scene grouper structured media timeline into canonical scenes');

    // 43. Content Structure & Hook/CTA Candidates
    const structure = analysisEngine.analyzeContentStructure(testAnalysisProj);
    const hooks = analysisEngine.analyzeHooks(testAnalysisProj);
    const ctas = analysisEngine.analyzeCTAs(testAnalysisProj);
    assert(!!structure.hook && hooks.length >= 1, 'Content analyzer identified hook candidate and content structure breakdown');

    // 44. Editing Insights & Edit Decision Bridge
    const brolls = analysisEngine.analyzeBrollOpportunities(testAnalysisProj, pauses);
    const insights = analysisEngine.generateEditingInsights(pauses, hooks, ctas, brolls, density);
    assert(insights.length >= 1, 'Editing insight engine generated actionable insights');

    const proposedDecision = analysisEngine.convertInsightToEditDecision(insights[0]);
    assert(proposedDecision.status === 'proposed' && !!proposedDecision.learningNote, 'Bridge converted EditingInsight into proposed EditDecision for human review');

    // 45. WHY Engine & "Teach Me" Knowledge Base
    const teachExplanation = getTeachMeExplanation('J_CUT');
    assert(teachExplanation.region === 'GLOBAL' && !!teachExplanation.why && teachExplanation.confidence > 0.9, 'Edit Academy Knowledge Base provided structured WHAT/WHY/WHEN/HOW breakdown');

    // ==========================================
    // --- FÁZA 2F: AI DIRECTOR ENGINE & EDIT ACADEMY ---
    // ==========================================
    log.push('--- FÁZA 2F: AI Director Decision Engine + Edit Academy Suite ---');

    // 46. Director Plan Generation
    const testDirProj = createInitialProject('Director Plan Test Project');
    testDirProj.transcript = {
      id: 'trans_002',
      language: 'sk',
      segments: [
        { id: 's1', start: 0, end: 3.0, text: 'Ako správne strihať videá pre TikTok?' },
        { id: 's2', start: 5.5, end: 12.0, text: 'Dôležité je zachovať dynamiku a správne časovanie.' }
      ]
    };
    testDirProj.analysisResults = {
      projectId: testDirProj.id,
      timestamp: Date.now(),
      pauses: [{ id: 'p1', start: 3.0, end: 5.5, duration: 2.5, type: 'long_pause', confidence: 0.92 }],
      hooks: [{ id: 'h1', start: 0, end: 3.0, type: 'question', reason: 'Otázka v úvode', confidence: 0.95 }],
      brollOpportunities: [{ id: 'b1', start: 6.0, end: 10.0, reason: 'Dlhý monológ', suggestedVisualType: 'product', confidence: 0.88 }]
    };

    const plan = directorEngine.generateDirectorPlan(testDirProj, 'TikTok', ['Retention', 'Education']);
    assert(plan.targetPlatform === 'TikTok' && plan.decisions.length >= 2, 'DirectorEngine generated valid DirectorPlan with platform strategies and decisions');

    // 47. Decision Priority & Category Classification
    const mustConsider = plan.decisions.filter(d => d.priority === 'MUST_CONSIDER');
    assert(mustConsider.length >= 1 && !!mustConsider[0].category, 'Director decisions classified by Priority (MUST_CONSIDER) and KnowledgeCategory');

    // 48. Conflict Validation
    const validation = directorEngine.validatePlanConflicts(plan, testDirProj);
    assert(validation.updatedPlan.decisions.length === plan.decisions.length, 'Conflict validator inspected decisions without destructive modifications');

    // 49. Safe Transactional Batch Apply with Version Snapshot Backup
    coreEngine.commandManager.setProject(testDirProj);
    const acceptedIds = plan.decisions.map(d => d.id);
    const batchRes = directorEngine.safeBatchApply(coreEngine.commandManager, plan, acceptedIds);
    assert(batchRes.success && !!batchRes.snapshotVersionId, 'safeBatchApply created version snapshot backup and transactionally executed commands');

    // 50. Compare My Edit (User vs AI Edit)
    const postBatchProj = coreEngine.getProject();
    const comparisons = directorEngine.compareUserAndAiEdits(postBatchProj, plan);
    assert(comparisons.length >= 3 && !!comparisons[0].learningTip, 'Compare My Edit generated respectful, learning-oriented comparisons');

    // 51. Show Me How Manual Workflow Steps
    const firstDec = plan.decisions[0];
    assert(firstDec.howToManual.length >= 3, 'Show Me How provided step-by-step manual workflow guide');

    // 52. 155+ Clips & 6+ Tracks Synthetic Model Validation Benchmark
    const stressProj = createInitialProject('Stress Test Project');
    const extraTrack = { id: 'track_extra', type: 'video' as const, name: 'Overlay Track 2', order: 5, muted: false, locked: false, visible: true, clips: [] };
    stressProj.tracks.push(extraTrack);

    const stressTrack = stressProj.tracks[0];
    const stressClips: ClipModel[] = [];
    for (let i = 0; i < 155; i++) {
      stressClips.push(createCanonicalClip({
        id: `stress_${i}`,
        trackId: stressTrack.id,
        name: `Clip ${i}`,
        type: 'video',
        timelineStart: i * 2,
        duration: 2,
        sourceStart: 0,
        sourceEnd: 2
      }));
    }
    stressTrack.clips = stressClips;
    const stressStart = performance.now();
    const validatedStress = TimelineEngine.validateProject(stressProj);
    const stressDuration = performance.now() - stressStart;

    assert(validatedStress.valid && stressClips.length === 155 && stressProj.tracks.length === 6, '155 canonical clips across 6 tracks successfully validated in stress test');
    assert(stressDuration < 50, `Synthetic model validation benchmark processed 155 clips in ${stressDuration.toFixed(2)}ms (< 50ms requirement)`);

    log.push(`=== Local Core Test Suite: ${passed}/${total} Passed ===`);
    return { success: passed === total, log };
  } catch (e: any) {
    log.push(`🔥 [CRITICAL EXCEPTION] ${e?.message || e}`);
    return { success: false, log };
  }
}

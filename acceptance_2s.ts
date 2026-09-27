import { coreEngine, createInitialProject, AddClipCommand, SyncMulticamCommand, SwitchMulticamAngleCommand, TrimClipCommand, SlipClipCommand, SlideClipCommand, coreEngine as engine } from './src/core';
import { ProjectModel, MediaAsset } from './src/core/types/project';
import { DEMO_VIDEOS } from './src/utils/demoVideos';

async function runRealWorldMulticamTest() {
  console.log('--- OMNISTRIH AI: Phase 2S Real-World Acceptance Test ---');

  const project = createInitialProject('Real-World Multicam Test');
  engine.commandManager.setProject(project);

  // 1. Simulate REAL MEDIA INPUT (using DEMO_VIDEOS metadata)
  console.log('Test 1: Real Media Input');
  const demoA = DEMO_VIDEOS[0]; // Content Creator (Talking Head)
  const demoB = DEMO_VIDEOS[1]; // Podcast & Interview

  const assetA: MediaAsset = { 
    id: 'asset_a', name: demoA.titleEn, type: 'video', 
    duration: demoA.duration, width: 1280, height: 720, fps: 30, 
    opfsPath: '/media/a.mp4', url: demoA.url, size: 1024 * 1024 * 5, 
    mimeType: 'video/mp4', createdAt: Date.now() 
  };
  const assetB: MediaAsset = { 
    id: 'asset_b', name: demoB.titleEn, type: 'video', 
    duration: demoB.duration, width: 1280, height: 720, fps: 30, 
    opfsPath: '/media/b.mp4', url: demoB.url, size: 1024 * 1024 * 8, 
    mimeType: 'video/mp4', createdAt: Date.now() 
  };
  
  project.assets.push(assetA, assetB);
  console.log(`- Assets Imported: ${project.assets.length}`);
  console.log(`- Asset A: ${assetA.name} (${assetA.duration}s)`);
  console.log(`- Asset B: ${assetB.name} (${assetB.duration}s)`);

  // 2. MULTICAM GROUP creation
  console.log('Test 2: Multicam Group Creation');
  const clipA = { 
    id: 'clip_a', trackId: 'track_video', assetId: 'asset_a', name: 'Angle A', 
    type: 'video' as any, timelineStart: 0, duration: 15, 
    sourceStart: 0, sourceEnd: 15, speed: 1, volume: 100, 
    scale: 100, opacity: 100, positionX: 0, positionY: 0, rotation: 0, keyframes: [] 
  };
  engine.commandManager.executeCommand(new AddClipCommand('Add Angle A', 'track_video', clipA));
  
  engine.commandManager.executeCommand(new SyncMulticamCommand('Sync Multicam Group', ['clip_a'], 'Main Interview', 'manual'));
  let updatedProject = engine.getProject();
  const group = updatedProject.multicamGroups![0];
  console.log(`- Group Created: ${group.name} (ID: ${group.id})`);
  console.log(`- Angles in Group: ${group.angles.length}`);
  
  // Manually add the second angle to the group to simulate a real sync result where multiple clips were selected
  group.angles.push({ id: 'angle_b', assetId: 'asset_b', name: 'Angle B', offset: 0 });
  console.log(`- Manual Sync Angle B added. Total Angles: ${group.angles.length}`);

  // 3. REAL CAMERA SWITCHING (Simulated Playback)
  console.log('Test 5: Real Camera Switching');
  console.log('- Switching from Angle A to Angle B at t=5s');
  engine.commandManager.executeCommand(new SwitchMulticamAngleCommand('Switch to B', 'clip_a', 'angle_b', 5));
  
  updatedProject = engine.getProject();
  const clips = updatedProject.tracks.find(t => t.id === 'track_video')!.clips;
  console.log(`- Timeline segments after switch: ${clips.length}`);
  
  const segment1 = clips.find(c => c.timelineStart === 0);
  const segment2 = clips.find(c => c.timelineStart === 5);
  
  console.log(`- Segment 1 (0-5s) Asset: ${segment1?.assetId} (Expected: asset_a)`);
  console.log(`- Segment 2 (5-15s) Asset: ${segment2?.assetId} (Expected: asset_b)`);
  console.log(`- Segment 2 Multicam Angle ID: ${segment2?.multicamAngleId}`);

  // 4. UNDO / REDO
  console.log('Test 9: Undo/Redo');
  engine.undo();
  console.log(`- After Undo: Clip count = ${engine.getProject().tracks.find(t => t.id === 'track_video')!.clips.length} (Expected: 1)`);
  engine.redo();
  console.log(`- After Redo: Clip count = ${engine.getProject().tracks.find(t => t.id === 'track_video')!.clips.length} (Expected: 2)`);

  // 5. ADVANCED TRIMMING
  console.log('Test 7: Advanced Trimming');
  console.log('- Ripple Trim segment 1 by -1s (making it 4s long)');
  engine.commandManager.executeCommand(new TrimClipCommand('Ripple Trim S1', segment1!.id, 'right', -1, true));
  
  updatedProject = engine.getProject();
  const s2AfterRipple = updatedProject.tracks.find(t => t.id === 'track_video')!.clips.find(c => c.timelineStart < 10 && c.timelineStart > 0);
  console.log(`- Segment 2 new timelineStart: ${s2AfterRipple?.timelineStart}s (Expected: 4s)`);

  // 6. SNAPSHOT / ROLLBACK
  console.log('Test 15: Snapshot / Rollback');
  engine.commandManager.snapshot();
  console.log('- Snapshot taken.');
  engine.commandManager.executeCommand(new TrimClipCommand('Experimental Trim', s2AfterRipple!.id, 'right', -2, true));
  console.log(`- Applied experimental change. Duration: ${engine.getProject().tracks.find(t => t.id === 'track_video')!.clips.reduce((acc, c) => acc + c.duration, 0)}s`);
  
  engine.commandManager.rollback();
  console.log('- Rollback executed.');
  console.log(`- Restored Duration: ${engine.getProject().tracks.find(t => t.id === 'track_video')!.clips.reduce((acc, c) => acc + c.duration, 0)}s`);

  console.log('--- Acceptance Test Logic Run Complete ---');
}

runRealWorldMulticamTest().catch(console.error);

import { ProjectModel } from '../core/types/project';
import { SceneInputData } from './AISceneDirector';

/**
 * Builds storyboard scenes from what is REALLY in the project.
 *
 * The panel used to feed six hard-coded demo scenes ("Intro - Hello and welcome…", a fake
 * /demo-broll.mp4 asset, invented semanticImportance values) into the storyboard generator, so the
 * "AI storyboard" described a video that did not exist. Scenes now come from the measured
 * transcript, or — when there is no transcript — from the real clips on the timeline, and every
 * value carries a label saying where it came from.
 */

export interface StoryboardSceneEvidence {
  /** Where the scene boundaries come from (measured transcript / real clip). */
  boundsSk: string;
  /** Where semanticImportance comes from. */
  importanceSk: string;
  /** Where the offered B-roll assets come from. */
  brollSk: string;
}

export interface StoryboardSceneSource {
  scenes: SceneInputData[];
  /** True when at least one scene is backed by measured analysis (transcript or hooks). */
  measured: boolean;
  notesSk: string[];
  notesEn: string[];
  evidence: Record<string, StoryboardSceneEvidence>;
}

const NEUTRAL_IMPORTANCE = 0.5;

function keywordsFromText(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/[^\p{L}\p{N}]+/u)
        .map(w => w.trim())
        .filter(w => w.length >= 6)
    )
  ).slice(0, 6);
}

export function buildStoryboardScenes(project: ProjectModel): StoryboardSceneSource {
  const notesSk: string[] = [];
  const notesEn: string[] = [];
  const evidence: Record<string, StoryboardSceneEvidence> = {};

  const videoClips = project.tracks
    .filter(t => t.type === 'video')
    .flatMap(t => t.clips)
    .map(clip => {
      const start = clip.timelineStart ?? clip.start ?? 0;
      return { id: clip.id, assetId: clip.assetId, start, end: start + clip.duration };
    })
    .sort((a, b) => a.start - b.start);

  const hooks = project.analysisResults?.hooks ?? [];
  const segments = (project.transcript?.segments ?? []).filter(s => Number.isFinite(s.start) && Number.isFinite(s.end));

  interface RawScene {
    id: string;
    start: number;
    end: number;
    text: string;
    boundsSk: string;
    boundsEn: string;
  }

  let raws: RawScene[] = [];
  let measured = false;

  if (segments.length > 0) {
    raws = segments.map((segment, index) => ({
      id: `scene_seg_${segment.id ?? index + 1}`,
      start: segment.start,
      end: segment.end,
      text: segment.text ?? '',
      boundsSk: 'Meraný prepis (transcript segment)',
      boundsEn: 'Measured transcript (segment)',
    }));
    measured = true;
    notesSk.push(`Scény vychádzajú z ${segments.length} meraných segmentov prepisu.`);
    notesEn.push(`Scenes come from ${segments.length} measured transcript segments.`);
  } else if (videoClips.length > 0) {
    raws = videoClips.map((clip, index) => ({
      id: `scene_clip_${clip.id ?? index + 1}`,
      start: clip.start,
      end: clip.end,
      text: '',
      boundsSk: 'Reálny klip na timeline (prepis nie je k dispozícii)',
      boundsEn: 'Real clip on the timeline (no transcript available)',
    }));
    notesSk.push('Prepis nie je k dispozícii — scény sú reálne klipy na timeline, text scény chýba.');
    notesEn.push('No transcript available — scenes are the real clips on the timeline, scene text is missing.');
  } else {
    notesSk.push('Na timeline nie je žiadny video klip ani prepis — storyboard sa nedá postaviť z reálnych dát.');
    notesEn.push('There is no video clip and no transcript — a storyboard cannot be built from real data.');
    return { scenes: [], measured: false, notesSk, notesEn, evidence };
  }

  if (hooks.length > 0) {
    measured = true;
    notesSk.push(`Dôležitosť scén sa berie z ${hooks.length} meraných hookov (dôvera z analýzy).`);
    notesEn.push(`Scene importance is taken from ${hooks.length} measured hooks (analysis confidence).`);
  } else {
    notesSk.push(`V projekte nie je meraný hook — dôležitosť scén je neutrálna hodnota ${NEUTRAL_IMPORTANCE} (označená v každej scéne).`);
    notesEn.push(`No measured hook in the project — scene importance is the neutral value ${NEUTRAL_IMPORTANCE} (labelled on every scene).`);
  }

  const scenes: SceneInputData[] = raws.map(raw => {
    const clipsInScene = videoClips.filter(clip => clip.start < raw.end && clip.end > raw.start);
    const overlappingHooks = hooks.filter(hook => hook.start < raw.end && (hook.end ?? hook.start) > raw.start);
    const strongestHook = overlappingHooks.reduce<typeof hooks[number] | null>(
      (best, hook) => (best === null || hook.confidence > best.confidence ? hook : best),
      null
    );

    const importance = strongestHook ? strongestHook.confidence : NEUTRAL_IMPORTANCE;
    const importanceSk = strongestHook
      ? `Meraná dôvera hooku ${(strongestHook.confidence * 100).toFixed(0)} % (${strongestHook.type})`
      : `Neutrálna hodnota ${NEUTRAL_IMPORTANCE} — v scéne nie je meraný hook`;

    // Only real assets of the project are offered, and never the asset that already plays here.
    const usedAssetIds = new Set(clipsInScene.map(clip => clip.assetId));
    const brollAssets = project.assets
      .filter(asset => (asset.type === 'video' || asset.type === 'image') && !usedAssetIds.has(asset.id))
      .map(asset => ({ id: asset.id, name: asset.name, url: asset.opfsPath || '', category: asset.type }));

    const brollSk = brollAssets.length > 0
      ? `${brollAssets.length} reálnych assetov v projekte (mimo záberu v tejto scéne)`
      : 'V projekte nie je žiadny ďalší video/obrázkový asset — B-roll nemá z čoho vyberať';

    evidence[raw.id] = { boundsSk: raw.boundsSk, importanceSk, brollSk };

    return {
      sceneId: raw.id,
      timelineStart: raw.start,
      timelineEnd: raw.end,
      transcriptText: raw.text,
      // A talking-head scene is a scene where real footage exists on the timeline.
      speakerIsActive: clipsInScene.length > 0,
      semanticImportance: importance,
      keywords: keywordsFromText(raw.text),
      availableBrollAssets: brollAssets,
    };
  });

  if (project.assets.length === 0) {
    notesSk.push('Projekt neobsahuje žiadne médiá — B-roll návrhy zostanú prázdne, kým nenahráš asset.');
    notesEn.push('The project has no media — B-roll suggestions stay empty until an asset is imported.');
  }

  return { scenes, measured, notesSk, notesEn, evidence };
}

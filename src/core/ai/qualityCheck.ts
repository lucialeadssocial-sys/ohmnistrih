import { ProjectModel } from '../types/project';

/**
 * Quality Check pred finálom.
 *
 * Every check below is computed from the canonical project state and every finding carries the
 * numbers it was derived from. Checks that would need something we do NOT have (a decoder, rendered
 * pixels, word-level STT) are NOT faked — they are listed in `unmeasurable` with the reason, so the
 * report never looks complete when it is not.
 *
 * The score is a documented function of the checks that really ran; it is not an inspection of the
 * encoded file. The panel states that next to the number.
 */

export type QcSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
export type QcCategory = 'TIMELINE' | 'MEDIA' | 'CAPTION' | 'AUDIO' | 'PACING' | 'TRANSITION';

export interface QcFinding {
  id: string;
  category: QcCategory;
  severity: QcSeverity;
  titleSk: string;
  titleEn: string;
  detailSk: string;
  detailEn: string;
  /** Timeline position the finding points at (seconds), when it has one. */
  time?: number;
  /** Clip the finding belongs to, when it belongs to one. */
  clipId?: string;
}

export interface QcUnmeasurable {
  id: string;
  reasonSk: string;
  reasonEn: string;
}

export interface QualityCheckReport {
  findings: QcFinding[];
  counts: { critical: number; warning: number; info: number };
  /** 100 − 25×critical − 8×warning − 2×info, clamped to 0..100 (see basisSk/basisEn). */
  score: number;
  scoreBasisSk: string;
  scoreBasisEn: string;
  unmeasurable: QcUnmeasurable[];
  facts: {
    durationSeconds: number;
    videoClips: number;
    audioClips: number;
    captionClips: number;
    cuts: number;
    cutsPerMinute: number;
    longestShotSeconds: number;
    canvasWidth: number;
    canvasHeight: number;
    fps: number;
  };
  ranAt: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
/** A cut shorter than this is a jitter cut no professional timeline should contain. */
const MICRO_CUT_SECONDS = 0.4;
/** Caption legibility floor: 3 % of the canvas height. */
const MIN_CAPTION_HEIGHT_RATIO = 0.03;
/** Longest caption a viewer can read in one go on a 9:16 canvas. */
const MAX_CAPTION_SECONDS = 6;
/** Two adjacent audio clips further apart than this jump audibly at the cut. */
const MAX_LEVEL_JUMP_PERCENT = 25;
/** A shot longer than this in a short-form video feels static. */
const LONG_SHOT_SECONDS = 20;
const TIMELINE_EPSILON = 0.05;

export function runQualityCheck(project: ProjectModel): QualityCheckReport {
  const findings: QcFinding[] = [];
  const videoTracks = project.tracks.filter(t => t.type === 'video');
  const audioTracks = project.tracks.filter(t => t.type === 'audio');
  // Caption/text clips can live on a caption track or directly on a video track.
  const captionClipsDirect = project.tracks.flatMap(t =>
    t.clips.filter(clip => clip.type === 'text' || clip.type === 'caption' || Boolean(clip.textConfig))
  );

  const canvasWidth = project.settings?.width || 1080;
  const canvasHeight = project.settings?.height || 1920;
  const fps = project.settings?.fps || 30;

  const videoClips = videoTracks
    .flatMap(t => t.clips.map(clip => ({ clip, trackId: t.id })))
    .filter(entry => entry.clip.type !== 'text' && entry.clip.type !== 'caption');
  const audioClips = audioTracks.flatMap(t => t.clips);
  const captionTrackClips = project.tracks.filter(t => t.type === 'caption').flatMap(t => t.clips);
  // Dedupe: a caption clip on a caption track is already in captionTrackClips.
  const captionIds = new Set(captionTrackClips.map(c => c.id));
  const captionClips = [...captionTrackClips, ...captionClipsDirect.filter(c => !captionIds.has(c.id))];

  const clipStart = (clip: { timelineStart?: number; start?: number }) => clip.timelineStart ?? clip.start ?? 0;
  const clipEnd = (clip: { timelineStart?: number; start?: number; duration: number }) => clipStart(clip) + clip.duration;

  const duration = [...videoClips.map(v => clipEnd(v.clip)), ...audioClips.map(clipEnd)]
    .reduce((max, end) => Math.max(max, end), 0);

  // ---------------------------------------------------------------- TIMELINE
  for (const { clip } of videoClips) {
    if (!(clip.duration > 0)) {
      findings.push({
        id: `qc_invalid_${clip.id}`,
        category: 'TIMELINE',
        severity: 'CRITICAL',
        titleSk: 'Klip s nulovou alebo zápornou dĺžkou',
        titleEn: 'Clip with zero or negative duration',
        detailSk: `Klip „${clip.name ?? clip.id}" má dĺžku ${round2(clip.duration)}s — takýto klip sa nedá vyrenderovať.`,
        detailEn: `Clip "${clip.name ?? clip.id}" is ${round2(clip.duration)}s long — it cannot be rendered.`,
        time: clipStart(clip),
        clipId: clip.id,
      });
    } else if (clip.duration < MICRO_CUT_SECONDS) {
      findings.push({
        id: `qc_micro_cut_${clip.id}`,
        category: 'TIMELINE',
        severity: 'WARNING',
        titleSk: 'Mikro-rez (klip kratší než 0,4 s)',
        titleEn: 'Micro cut (clip shorter than 0.4s)',
        detailSk: `Klip „${clip.name ?? clip.id}" trvá ${round2(clip.duration)}s v čase ${round2(clipStart(clip))}s — na 30 fps je to ${Math.round(clip.duration * fps)} snímok, oko to číta ako bliknutie.`,
        detailEn: `Clip "${clip.name ?? clip.id}" lasts ${round2(clip.duration)}s at ${round2(clipStart(clip))}s — ${Math.round(clip.duration * fps)} frames at ${fps} fps, which reads as a flash.`,
        time: clipStart(clip),
        clipId: clip.id,
      });
    }
  }

  for (const track of videoTracks) {
    const ordered = track.clips.slice().sort((a, b) => clipStart(a) - clipStart(b));
    for (let i = 0; i < ordered.length - 1; i++) {
      const current = ordered[i];
      const next = ordered[i + 1];
      const gap = round2(clipStart(next) - clipEnd(current));
      if (gap > TIMELINE_EPSILON) {
        findings.push({
          id: `qc_gap_${current.id}_${next.id}`,
          category: 'TIMELINE',
          severity: 'WARNING',
          titleSk: 'Diera na timeline',
          titleEn: 'Gap on the timeline',
          detailSk: `Medzi klipmi „${current.name ?? current.id}" a „${next.name ?? next.id}" je ${gap}s prázdneho miesta (stopa ${track.name ?? track.id}) — v exporte bude čierna.`,
          detailEn: `There is a ${gap}s gap between "${current.name ?? current.id}" and "${next.name ?? next.id}" (track ${track.name ?? track.id}) — it renders black.`,
          time: clipEnd(current),
          clipId: current.id,
        });
      } else if (gap < -TIMELINE_EPSILON) {
        findings.push({
          id: `qc_overlap_${current.id}_${next.id}`,
          category: 'TIMELINE',
          severity: 'WARNING',
          titleSk: 'Prekrytie klipov',
          titleEn: 'Overlapping clips',
          detailSk: `Klipy „${current.name ?? current.id}" a „${next.name ?? next.id}" sa prekrývajú o ${round2(Math.abs(gap))}s — kto je navrchu, rozhoduje poradie stopy, nie zámer.`,
          detailEn: `Clips "${current.name ?? current.id}" and "${next.name ?? next.id}" overlap by ${round2(Math.abs(gap))}s — the layer order decides what is visible, not the intent.`,
          time: clipStart(next),
          clipId: next.id,
        });
      }
    }
  }

  // ---------------------------------------------------------------- MEDIA
  const assetIds = new Set(project.assets.map(asset => asset.id));
  for (const { clip } of videoClips) {
    if (!clip.assetId) {
      findings.push({
        id: `qc_no_asset_${clip.id}`,
        category: 'MEDIA',
        severity: 'CRITICAL',
        titleSk: 'Klip bez média',
        titleEn: 'Clip without media',
        detailSk: `Klip „${clip.name ?? clip.id}" nemá priradený asset — vyrenderuje sa ako prázdne miesto.`,
        detailEn: `Clip "${clip.name ?? clip.id}" has no asset attached — it renders as empty space.`,
        time: clipStart(clip),
        clipId: clip.id,
      });
    } else if (!assetIds.has(clip.assetId)) {
      findings.push({
        id: `qc_missing_asset_${clip.id}`,
        category: 'MEDIA',
        severity: 'CRITICAL',
        titleSk: 'Chýbajúce médium v projekte',
        titleEn: 'Missing media in the project',
        detailSk: `Klip „${clip.name ?? clip.id}" odkazuje na asset ${clip.assetId}, ktorý v projekte neexistuje (${project.assets.length} assetov v projekte).`,
        detailEn: `Clip "${clip.name ?? clip.id}" points at asset ${clip.assetId}, which is not in the project (${project.assets.length} assets present).`,
        time: clipStart(clip),
        clipId: clip.id,
      });
    }
  }
  for (const asset of project.assets) {
    if (!asset.opfsPath && (asset.type === 'video' || asset.type === 'audio')) {
      findings.push({
        id: `qc_asset_path_${asset.id}`,
        category: 'MEDIA',
        severity: 'WARNING',
        titleSk: 'Médium bez uloženej cesty',
        titleEn: 'Media without a stored path',
        detailSk: `Asset „${asset.name}" (${asset.type}) nemá OPFS cestu — pri exporte sa musí znova načítať ručne.`,
        detailEn: `Asset "${asset.name}" (${asset.type}) has no OPFS path — it has to be re-imported manually before export.`,
      });
    }
  }

  // ---------------------------------------------------------------- CAPTIONS
  const minCaptionFontSize = canvasHeight * MIN_CAPTION_HEIGHT_RATIO;
  const sortedCaptions = captionClips.slice().sort((a, b) => clipStart(a) - clipStart(b));
  for (const clip of captionClips) {
    const text = clip.textConfig;
    if (!text || !text.content || text.content.trim().length === 0) {
      findings.push({
        id: `qc_caption_empty_${clip.id}`,
        category: 'CAPTION',
        severity: 'WARNING',
        titleSk: 'Prázdny titulok',
        titleEn: 'Empty caption',
        detailSk: `Klip „${clip.name ?? clip.id}" v čase ${round2(clipStart(clip))}s nemá text — divák vidí len prázdnu grafiku.`,
        detailEn: `Clip "${clip.name ?? clip.id}" at ${round2(clipStart(clip))}s has no text — the viewer only sees empty graphics.`,
        time: clipStart(clip),
        clipId: clip.id,
      });
      continue;
    }

    if (text.fontSize < minCaptionFontSize) {
      findings.push({
        id: `qc_caption_size_${clip.id}`,
        category: 'CAPTION',
        severity: 'WARNING',
        titleSk: 'Titulok je malý',
        titleEn: 'Caption is too small',
        detailSk: `Titulok má ${round2(text.fontSize)} px na plátne ${canvasWidth}×${canvasHeight} (${round2((text.fontSize / canvasHeight) * 100)} %) — minimum pre čitateľnosť je ${Math.round(minCaptionFontSize)} px.`,
        detailEn: `The caption is ${round2(text.fontSize)} px on a ${canvasWidth}×${canvasHeight} canvas (${round2((text.fontSize / canvasHeight) * 100)} %) — legibility needs at least ${Math.round(minCaptionFontSize)} px.`,
        time: clipStart(clip),
        clipId: clip.id,
      });
    }

    // The renderer places text at height/2 + positionY, so this is the real anchor position.
    const anchorY = canvasHeight / 2 + (clip.positionY ?? 0);
    const halfTextHeight = text.fontSize * 0.6;
    if (anchorY - halfTextHeight < 0 || anchorY + halfTextHeight > canvasHeight) {
      findings.push({
        id: `qc_caption_offscreen_${clip.id}`,
        category: 'CAPTION',
        severity: 'CRITICAL',
        titleSk: 'Titulok je mimo plátna',
        titleEn: 'Caption is off-frame',
        detailSk: `Stred titulku je na y=${round2(anchorY)} px (plátno 0–${canvasHeight} px) — text s výškou ${round2(text.fontSize)} px je mimo obrazu.`,
        detailEn: `The caption centre sits at y=${round2(anchorY)} px (canvas 0–${canvasHeight} px) — with a ${round2(text.fontSize)} px font the text falls outside the frame.`,
        time: clipStart(clip),
        clipId: clip.id,
      });
    }

    if (clip.duration > MAX_CAPTION_SECONDS) {
      findings.push({
        id: `qc_caption_long_${clip.id}`,
        category: 'CAPTION',
        severity: 'INFO',
        titleSk: 'Titulok drží príliš dlho',
        titleEn: 'Caption stays too long',
        detailSk: `Titulok „${text.content.slice(0, 40)}" je na obrazovke ${round2(clip.duration)}s (odporúčané maximum ${MAX_CAPTION_SECONDS}s).`,
        detailEn: `Caption "${text.content.slice(0, 40)}" is on screen for ${round2(clip.duration)}s (recommended maximum ${MAX_CAPTION_SECONDS}s).`,
        time: clipStart(clip),
        clipId: clip.id,
      });
    }
  }

  for (let i = 0; i < sortedCaptions.length - 1; i++) {
    const current = sortedCaptions[i];
    const next = sortedCaptions[i + 1];
    if (clipEnd(current) - clipStart(next) > TIMELINE_EPSILON) {
      findings.push({
        id: `qc_caption_overlap_${current.id}_${next.id}`,
        category: 'CAPTION',
        severity: 'WARNING',
        titleSk: 'Dva titulky naraz',
        titleEn: 'Two captions at once',
        detailSk: `Titulky sa prekrývajú o ${round2(clipEnd(current) - clipStart(next))}s okolo ${round2(clipStart(next))}s — divák číta oba a nestíha ani jeden.`,
        detailEn: `Captions overlap by ${round2(clipEnd(current) - clipStart(next))}s around ${round2(clipStart(next))}s — the viewer tries to read both.`,
        time: clipStart(next),
        clipId: next.id,
      });
    }
  }

  // ---------------------------------------------------------------- AUDIO
  for (const clip of audioClips) {
    const volume = clip.volume ?? 100;
    if (volume > 100) {
      findings.push({
        id: `qc_audio_hot_${clip.id}`,
        category: 'AUDIO',
        severity: 'WARNING',
        titleSk: 'Klip nad 100 % hlasitosti',
        titleEn: 'Clip above 100 % level',
        detailSk: `Klip „${clip.name ?? clip.id}" má volume ${round2(volume)} % — nad 100 % hrozí skreslenie pri mixe.`,
        detailEn: `Clip "${clip.name ?? clip.id}" is at ${round2(volume)} % volume — above 100 % risks distortion in the mix.`,
        time: clipStart(clip),
        clipId: clip.id,
      });
    } else if (volume === 0 && !clip.muted) {
      findings.push({
        id: `qc_audio_silent_${clip.id}`,
        category: 'AUDIO',
        severity: 'INFO',
        titleSk: 'Ticho nastavené hlasitosťou, nie stlmením',
        titleEn: 'Silence set by volume, not by mute',
        detailSk: `Klip „${clip.name ?? clip.id}" má volume 0 % a nie je stlmený — v mixe je ticho, ale v tracku to vyzerá ako aktívny zvuk.`,
        detailEn: `Clip "${clip.name ?? clip.id}" has volume 0 % and is not muted — silent in the mix, but the track still looks active.`,
        time: clipStart(clip),
        clipId: clip.id,
      });
    }
  }

  for (const track of audioTracks) {
    const ordered = track.clips.slice().sort((a, b) => clipStart(a) - clipStart(b));
    for (let i = 0; i < ordered.length - 1; i++) {
      const currentVolume = ordered[i].volume ?? 100;
      const nextVolume = ordered[i + 1].volume ?? 100;
      const jump = Math.abs(nextVolume - currentVolume);
      if (jump >= MAX_LEVEL_JUMP_PERCENT) {
        findings.push({
          id: `qc_audio_jump_${ordered[i].id}_${ordered[i + 1].id}`,
          category: 'AUDIO',
          severity: 'WARNING',
          titleSk: 'Skok v hlasitosti na strihu',
          titleEn: 'Level jump at a cut',
          detailSk: `V čase ${round2(clipStart(ordered[i + 1]))}s ide hlasitosť z ${round2(currentVolume)} % na ${round2(nextVolume)} % (rozdiel ${round2(jump)} %) — počuť to ako skok.`,
          detailEn: `At ${round2(clipStart(ordered[i + 1]))}s the level goes from ${round2(currentVolume)} % to ${round2(nextVolume)} % (a ${round2(jump)} % step) — audible as a jump.`,
          time: clipStart(ordered[i + 1]),
          clipId: ordered[i + 1].id,
        });
      }
    }
  }

  if (audioClips.length === 0 && videoClips.length > 0) {
    findings.push({
      id: 'qc_no_audio',
      category: 'AUDIO',
      severity: 'WARNING',
      titleSk: 'Projekt nemá žiadnu zvukovú stopu',
      titleEn: 'The project has no audio track content',
      detailSk: `Na timeline je ${videoClips.length} video klipov a 0 zvukových klipov — export bude bez zvuku.`,
      detailEn: `The timeline has ${videoClips.length} video clips and 0 audio clips — the export will be silent.`,
    });
  }

  // ---------------------------------------------------------------- PACING
  const orderedVideo = videoClips.slice().sort((a, b) => clipStart(a.clip) - clipStart(b.clip));
  const cuts = Math.max(0, orderedVideo.length - 1);
  const longestShot = orderedVideo.reduce((max, entry) => Math.max(max, entry.clip.duration), 0);
  const cutsPerMinute = duration > 0 ? round2((cuts / duration) * 60) : 0;

  if (duration >= 30 && cutsPerMinute < 2 && orderedVideo.length === 1) {
    findings.push({
      id: 'qc_static_video',
      category: 'PACING',
      severity: 'INFO',
      titleSk: 'Jeden záber bez rezu',
      titleEn: 'Single shot without a cut',
      detailSk: `Video má ${round2(duration)}s a jediný klip — tempo drží len obraz, nie strih (${cutsPerMinute} rezov/min).`,
      detailEn: `The video is ${round2(duration)}s long with a single clip — the pacing rests on the image, not on cuts (${cutsPerMinute} cuts/min).`,
    });
  }
  if (longestShot > LONG_SHOT_SECONDS) {
    findings.push({
      id: 'qc_long_shot',
      category: 'PACING',
      severity: 'INFO',
      titleSk: 'Dlhý statický záber',
      titleEn: 'Long static shot',
      detailSk: `Najdlhší záber má ${round2(longestShot)}s (odporúčané maximum ${LONG_SHOT_SECONDS}s pre short-form).`,
      detailEn: `The longest shot lasts ${round2(longestShot)}s (recommended maximum ${LONG_SHOT_SECONDS}s for short-form).`,
    });
  }

  // ---------------------------------------------------------------- TRANSITIONS
  const clipsWithTransitions = [...videoClips.map(v => v.clip)];
  const transitioned = clipsWithTransitions.filter(clip => clip.transitions && (clip.transitions.in || clip.transitions.out));
  for (const clip of transitioned) {
    for (const edge of ['in', 'out'] as const) {
      const transition = clip.transitions?.[edge];
      if (transition && transition.duration > 1.2) {
        findings.push({
          id: `qc_transition_long_${clip.id}_${edge}`,
          category: 'TRANSITION',
          severity: 'INFO',
          titleSk: 'Dlhý prechod',
          titleEn: 'Long transition',
          detailSk: `Prechod „${transition.type}" na klip „${clip.name ?? clip.id}" trvá ${round2(transition.duration)}s — pri krátkych záberoch zdržiava tempo.`,
          detailEn: `The "${transition.type}" transition on clip "${clip.name ?? clip.id}" lasts ${round2(transition.duration)}s — it slows the pace on short shots.`,
          time: clipStart(clip),
          clipId: clip.id,
        });
      }
    }
  }
  if (orderedVideo.length >= 4 && transitioned.length / orderedVideo.length > 0.4) {
    findings.push({
      id: 'qc_transition_density',
      category: 'TRANSITION',
      severity: 'INFO',
      titleSk: 'Prechody na väčšine strihov',
      titleEn: 'Transitions on most cuts',
      detailSk: `${transitioned.length} z ${orderedVideo.length} klipov má prechod — efekty bez dôvodu znižujú dôveryhodnosť výsledku.`,
      detailEn: `${transitioned.length} of ${orderedVideo.length} clips carry a transition — unmotivated effects make the result feel cheaper.`,
    });
  }

  // ---------------------------------------------------------------- score + honesty
  const counts = {
    critical: findings.filter(f => f.severity === 'CRITICAL').length,
    warning: findings.filter(f => f.severity === 'WARNING').length,
    info: findings.filter(f => f.severity === 'INFO').length,
  };
  const score = Math.max(0, Math.min(100, 100 - counts.critical * 25 - counts.warning * 8 - counts.info * 2));

  const unmeasurable: QcUnmeasurable[] = [
    {
      id: 'black_frames',
      reasonSk: 'Čierne alebo zamrznuté snímky potrebujú dekódovať exportované pixely — tento beh číta len stav timeline.',
      reasonEn: 'Black or frozen frames require decoding the exported pixels — this run only reads the timeline state.',
    },
    {
      id: 'true_peak',
      reasonSk: 'Skutočný peak (dBFS) sa meria počas reálneho exportu z mixu a zapisuje sa do histórie exportov — v paneli Overiť súbor ho uvidíš, keď export existuje.',
      reasonEn: 'The true peak (dBFS) is measured during a real export from the mix and stored in the export history — the Verify File panel shows it once an export exists.',
    },
    {
      id: 'caption_width',
      reasonSk: 'Šírka textu závisí od fontu (canvas.measureText) — bez vykreslenia sa nedá zmerať, preto sa kontroluje len výška a ukotvenie.',
      reasonEn: 'Text width depends on the font (canvas.measureText) — impossible without rendering, so only height and anchoring are checked.',
    },
    {
      id: 'word_cuts',
      reasonSk: 'Rez v polovici slova potrebuje slová s časmi (STT), ktoré projekt zatiaľ nemá.',
      reasonEn: 'A cut in the middle of a word needs word timestamps (STT), which the project does not have yet.',
    },
    {
      id: 'subject_tracking',
      reasonSk: 'Kontrola, či reframe drží tvár v zábere, potrebuje detekciu tváre vo snímkach.',
      reasonEn: 'Checking that the reframe keeps the face in frame needs face detection on the frames.',
    },
  ];

  const scoreBasisSk =
    `Skóre = 100 − 25×kritické − 8×varovanie − 2×info, obmedzené na 0–100. ` +
    `Tento beh vykonal ${findings.length === 0 ? 'všetky kontroly timeline bez nálezu' : `${counts.critical} kritických, ${counts.warning} varovaní a ${counts.info} informačných nálezov`}. ` +
    'Nemerí pixely exportu.';
  const scoreBasisEn =
    `Score = 100 − 25×critical − 8×warning − 2×info, clamped to 0–100. ` +
    `This run found ${counts.critical} critical, ${counts.warning} warning and ${counts.info} informational findings. ` +
    'It does not inspect the exported pixels.';

  return {
    findings,
    counts,
    score,
    scoreBasisSk,
    scoreBasisEn,
    unmeasurable,
    facts: {
      durationSeconds: round2(duration),
      videoClips: videoClips.length,
      audioClips: audioClips.length,
      captionClips: captionClips.length,
      cuts,
      cutsPerMinute,
      longestShotSeconds: round2(longestShot),
      canvasWidth,
      canvasHeight,
      fps,
    },
    ranAt: Date.now(),
  };
}

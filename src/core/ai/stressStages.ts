import { ProjectModel } from '../types/project';
import { QualityCheckReport } from './qualityCheck';

/**
 * Stage narration for the project-wide check (the "stress test" button in the QC panel).
 *
 * Every stage either reports numbers that were really computed from the canonical project, or says
 * NEMERANÉ / NOT MEASURED with the reason. There is no scripted copy with invented values here —
 * that was the previous behaviour of this panel and it is exactly what this module removes.
 */

export interface StressStage {
  stage: string;
  descSk: string;
  descEn: string;
  /** true = the numbers in this stage come from the project / report; false = declared unmeasured. */
  measured: boolean;
}

export interface ExportState {
  hasExport: boolean;
  sizeBytes?: number;
  container?: string;
  durationSeconds?: number;
  /** Measured loudness of the exported mix (from the export history, never a placeholder). */
  integratedLufs?: number | null;
  truePeakDbfs?: number | null;
}

const fmtSeconds = (value: number) => `${Math.round(value * 10) / 10}s`;
const countFindings = (report: QualityCheckReport, predicate: (id: string) => boolean) =>
  report.findings.filter(finding => predicate(finding.id)).length;

export function buildStressStages(
  project: ProjectModel,
  report: QualityCheckReport,
  exportState: ExportState = { hasExport: false }
): StressStage[] {
  const stages: StressStage[] = [];

  // 1 — TIMELINE
  stages.push({
    stage: 'TIMELINE',
    measured: true,
    descSk: `Zmerané z timeline: ${fmtSeconds(report.facts.durationSeconds)} • ${report.facts.videoClips} video klipov • ${report.facts.audioClips} audio klipov • ${report.facts.cuts} rezov (${report.facts.cutsPerMinute}/min) • najdlhší záber ${fmtSeconds(report.facts.longestShotSeconds)}.`,
    descEn: `Measured from the timeline: ${fmtSeconds(report.facts.durationSeconds)} • ${report.facts.videoClips} video clips • ${report.facts.audioClips} audio clips • ${report.facts.cuts} cuts (${report.facts.cutsPerMinute}/min) • longest shot ${fmtSeconds(report.facts.longestShotSeconds)}.`,
  });

  // 2 — MEDIA
  const assetsWithPath = project.assets.filter(asset => Boolean(asset.opfsPath)).length;
  const missingMedia = countFindings(report, id => id.startsWith('qc_no_asset_') || id.startsWith('qc_missing_asset_'));
  stages.push({
    stage: 'MEDIA',
    measured: true,
    descSk: `Zmerané z projektu: ${project.assets.length} assetov • ${assetsWithPath} s uloženou OPFS cestou • ${missingMedia} klipov bez média alebo s chýbajúcim médiom.`,
    descEn: `Measured from the project: ${project.assets.length} assets • ${assetsWithPath} with a stored OPFS path • ${missingMedia} clips without media or pointing at missing media.`,
  });

  // 3 — GAPS & OVERLAPS
  stages.push({
    stage: 'GAPS & OVERLAPS',
    measured: true,
    descSk: `Zmerané na stopách: ${countFindings(report, id => id.startsWith('qc_gap_'))} medzier • ${countFindings(report, id => id.startsWith('qc_overlap_'))} presahov • ${countFindings(report, id => id.startsWith('qc_micro_cut_'))} mikro-rezov pod 0,4s.`,
    descEn: `Measured per track: ${countFindings(report, id => id.startsWith('qc_gap_'))} gaps • ${countFindings(report, id => id.startsWith('qc_overlap_'))} overlaps • ${countFindings(report, id => id.startsWith('qc_micro_cut_'))} micro cuts below 0.4s.`,
  });

  // 4 — CAPTIONS
  if (report.facts.captionClips === 0) {
    stages.push({
      stage: 'CAPTIONS',
      measured: false,
      descSk: 'NEMERANÉ: v projekte nie sú žiadne titulkové klipy — čitateľnosť, prekryvy ani pozícia v obraze sa nedajú skontrolovať.',
      descEn: 'NOT MEASURED: the project has no caption clips — legibility, overlaps and in-frame position cannot be checked.',
    });
  } else {
    const captionIssues = countFindings(report, id => id.startsWith('qc_caption_'));
    stages.push({
      stage: 'CAPTIONS',
      measured: true,
      descSk: `Zmerané: ${report.facts.captionClips} titulkových klipov na plátne ${report.facts.canvasWidth}×${report.facts.canvasHeight} • ${captionIssues} nálezov (veľkosť, prekryv, mimo obrazu, dĺžka). Šírka textu sa nemeria — závisí od fontu.`,
      descEn: `Measured: ${report.facts.captionClips} caption clips on a ${report.facts.canvasWidth}×${report.facts.canvasHeight} canvas • ${captionIssues} findings (size, overlap, off-frame, duration). Text width is not measured — it depends on the font.`,
    });
  }

  // 5 — AUDIO LEVELS
  const loudnessTarget = project.audioMastering?.loudnessTargetLUFS;
  const levelJumps = countFindings(report, id => id.startsWith('qc_audio_jump_'));
  const hotClips = countFindings(report, id => id.startsWith('qc_audio_hot_'));
  stages.push({
    stage: 'AUDIO LEVELS',
    measured: true,
    descSk: `Zmerané z nastavení klipov: ${report.facts.audioClips} audio klipov • ${hotClips} nad 100 % • ${levelJumps} skokov hlasitosti na strihu. ` +
      (loudnessTarget !== undefined
        ? `Cieľ hlasitosti projektu je ${loudnessTarget} LUFS a normalizácia beží len v offline WebCodecs backend-e.`
        : 'Cieľ hlasitosti projektu nie je nastavený, takže sa nenormalizuje.') +
      ' Ducking hudby nie je implementovaný.',
    descEn: `Measured from clip settings: ${report.facts.audioClips} audio clips • ${hotClips} above 100 % • ${levelJumps} level jumps at cuts. ` +
      (loudnessTarget !== undefined
        ? `The project loudness target is ${loudnessTarget} LUFS and normalization runs only in the offline WebCodecs backend.`
        : 'No project loudness target is set, so nothing is normalized.') +
      ' Music ducking is not implemented.',
  });

  // 6 — PACING
  stages.push({
    stage: 'PACING',
    measured: true,
    descSk: `Zmerané: ${report.facts.cutsPerMinute} rezov za minútu • najdlhší záber ${fmtSeconds(report.facts.longestShotSeconds)} • ${countFindings(report, id => id.startsWith('qc_long_shot') || id === 'qc_static_video')} nálezov na tempo. Tempo sa hodnotí podľa obsahu, nie podľa pevného intervalu.`,
    descEn: `Measured: ${report.facts.cutsPerMinute} cuts per minute • longest shot ${fmtSeconds(report.facts.longestShotSeconds)} • ${countFindings(report, id => id.startsWith('qc_long_shot') || id === 'qc_static_video')} pacing findings. Pacing is judged by content, not by a fixed interval.`,
  });

  // 7 — TRANSITIONS
  const videoClips = project.tracks.filter(track => track.type === 'video').flatMap(track => track.clips);
  const withTransitions = videoClips.filter(clip => clip.transitions && (clip.transitions.in || clip.transitions.out)).length;
  stages.push({
    stage: 'TRANSITIONS',
    measured: true,
    descSk: `Zmerané: ${withTransitions} z ${videoClips.length} video klipov má prechod • ${countFindings(report, id => id.startsWith('qc_transition_long_'))} prechodov dlhších než 1,2s.`,
    descEn: `Measured: ${withTransitions} of ${videoClips.length} video clips carry a transition • ${countFindings(report, id => id.startsWith('qc_transition_long_'))} transitions longer than 1.2s.`,
  });

  // 8 — TRANSCRIPT / STT
  const segments = project.transcript?.segments ?? [];
  const wordsWithTime = segments.reduce((sum, segment) => sum + (segment.words?.length ?? 0), 0);
  if (segments.length === 0) {
    stages.push({
      stage: 'TRANSCRIPT',
      measured: false,
      descSk: 'NEMERANÉ: projekt nemá prepis (0 segmentov) — rezy v polovici slova, filler slová a duplicitné vety sa nedajú overiť.',
      descEn: 'NOT MEASURED: the project has no transcript (0 segments) — cuts inside words, filler words and repeated sentences cannot be checked.',
    });
  } else {
    stages.push({
      stage: 'TRANSCRIPT',
      measured: true,
      descSk: `Zmerané: ${segments.length} segmentov prepisu • ${wordsWithTime} slov s časom • časy rezu v polovici slova sa kontrolujú len ak sú slová s časmi.`,
      descEn: `Measured: ${segments.length} transcript segments • ${wordsWithTime} words with timestamps • cuts inside words are only checked when word timestamps exist.`,
    });
  }

  // 9 — EXPORT HISTORY
  stages.push(
    exportState.hasExport
      ? {
          stage: 'EXPORT',
          measured: true,
          descSk: `Zmerané z histórie exportov: existuje dokončený export${exportState.sizeBytes !== undefined ? ` • ${(exportState.sizeBytes / (1024 * 1024)).toFixed(1)} MB` : ''}${exportState.container ? ` • kontajner ${exportState.container}` : ''}${exportState.durationSeconds !== undefined ? ` • ${fmtSeconds(exportState.durationSeconds)}` : ''}.` +
            (typeof exportState.integratedLufs === 'number' && exportState.integratedLufs !== null
              ? ` Hlasitosť mixu: ${exportState.integratedLufs} LUFS${typeof exportState.truePeakDbfs === 'number' && exportState.truePeakDbfs !== null ? `, skutočný peak ${exportState.truePeakDbfs} dBFS` : ''}.`
              : ' Hlasitosť ani skutočný peak neboli pri tomto exporte zmerané.'),
          descEn: `Measured from the export history: a completed export exists${exportState.sizeBytes !== undefined ? ` • ${(exportState.sizeBytes / (1024 * 1024)).toFixed(1)} MB` : ''}${exportState.container ? ` • ${exportState.container} container` : ''}${exportState.durationSeconds !== undefined ? ` • ${fmtSeconds(exportState.durationSeconds)}` : ''}.` +
            (typeof exportState.integratedLufs === 'number' && exportState.integratedLufs !== null
              ? ` Mix loudness: ${exportState.integratedLufs} LUFS${typeof exportState.truePeakDbfs === 'number' && exportState.truePeakDbfs !== null ? `, true peak ${exportState.truePeakDbfs} dBFS` : ''}.`
              : ' Neither loudness nor true peak was measured for this export.'),
        }
      : {
          stage: 'EXPORT',
          measured: false,
          descSk: 'NEMERANÉ: história exportov neobsahuje dokončený export — čierne snímky, skutočný peak ani čitateľnosť v pixloch sa zatiaľ nedajú overiť.',
          descEn: 'NOT MEASURED: the export history has no completed export — black frames, true peak and pixel-level legibility cannot be verified yet.',
        }
  );

  return stages;
}

export function summariseStages(stages: StressStage[]): { measured: number; unmeasured: number } {
  return {
    measured: stages.filter(stage => stage.measured).length,
    unmeasured: stages.filter(stage => !stage.measured).length,
  };
}

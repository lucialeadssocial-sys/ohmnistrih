/**
 * QC MERANIE — jediný zdroj pravdy pre panel kvality.
 *
 * Pravidlo OmniStrihu: **žiadne „PASS“ bez merania.**
 * Tento modul počíta LEN to, čo sa naozaj dá zmerať z canonical projektu
 * (a z existujúcej exportnej linky). Všetko ostatné musí skončiť ako
 * `NOT_VERIFIED` — nikdy ako vymyslený PASS.
 *
 * Deterministické: žiadny `Date.now()`, žiadny `Math.random()`, žiadne odhady
 * vydávané za meranie. Ak nie je čo merať, vráti `ok: false` a dôvod.
 */
import { ClipModel, MediaAsset, ProjectModel } from "../types/project";

/** Jedna položka hustoty strihu pozdĺž osi (merané, nie predpoveď). */
export interface QcDensityPoint {
  /** Stred okna v sekundách. */
  t: number;
  /** Počet strihov (začiatkov klipov) v okne. */
  cuts: number;
}

export interface QcMeasurement {
  ok: boolean;
  reasonSk: string;
  reasonEn: string;

  /** Plán, ktorý sa meral (canonical). */
  projectId: string;
  projectUpdatedAt: number;

  assetCount: number;
  videoAssetCount: number;
  audioAssetCount: number;
  imageAssetCount: number;
  /** Médium podľa `id` — pre dôkazy (napr. „ktoré médium chýba“). */
  assetsById: Record<string, { name: string; type: MediaAsset["type"]; duration: number; width: number; height: number }>;
  missingAssets: string[];

  videoClipCount: number;
  brollClipCount: number;
  audioClipCount: number;
  captionClipCount: number;
  clipCount: number;

  /** Dĺžka osi = najvzdialenejší koniec klipu. */
  timelineDurationSec: number;
  /** Súčet dĺžok video klipov (koľko obrazu na osi naozaj je). */
  videoSecondsTotal: number;
  /** Podiel času na osi, ktorý je pokrytý obrazom (video + b-roll). */
  videoCoverageShare: number;

  /** Strihy = začiatky klipov (okrem prvého na každej stope). */
  cutCount: number;
  medianShotSec: number | null;
  meanShotSec: number | null;
  shotsUnder1_5s: number;
  cutsPerMinute: number | null;
  densitySeries: QcDensityPoint[];

  /** Koľkokrát je v tom istom čase na tej istej stope viac klipov (kolízia). */
  overlapCount: number;
  overlapSamples: { trackId: string; time: number }[];

  /** Prechody na osi (reálne zapísané na klipoch). */
  transitionCount: number;

  /** Titulky. */
  captionSegmentCount: number;
  captionTextsWithText: number;
  /** Najdlhší čas bez titulku (sekundy) — z canonical titulkov. */
  longestCaptionGapSec: number | null;
  /** Titulky prekrývajúce sa navzájom (dvojité titulky). */
  captionOverlapCount: number;

  /** Zvuk. */
  audioTrackCount: number;
  mutedAudioClipCount: number;
  /** Klipy s vypnutým zvukom, hoci obsahujú reč (info pre človeka). */
  silentVideoClipCount: number;

  /** Prepis (reálne dáta z automatického prepisu, ak existujú). */
  transcriptSegmentCount: number;
  transcriptWordCount: number;
  /** Najdlhšia medzera medzi slovami (sekundy) — merané z časov slov. */
  longestWordGapSec: number | null;

  /** Obraz. */
  hasStoredResolution: boolean;
  width: number | null;
  height: number | null;
  aspect: string | null;
  fps: number | null;
}

const ROUND3 = (n: number) => Math.round(n * 1000) / 1000;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Hustota strihov pozdĺž osi v rovnako veľkých oknách (deterministické). */
export function cutDensitySeries(startTimes: number[], durationSec: number, buckets = 12): QcDensityPoint[] {
  if (!(durationSec > 0) || buckets <= 0) return [];
  const size = durationSec / buckets;
  const out: QcDensityPoint[] = [];
  for (let i = 0; i < buckets; i += 1) {
    const from = i * size;
    const to = from + size;
    const cuts = startTimes.filter((t) => t >= from && t < to).length;
    out.push({ t: ROUND3(from + size / 2), cuts });
  }
  return out;
}

/**
 * Zmeria canonical projekt. Nikdy nič nedomýšľa: chýbajúce dáta = `null` alebo
 * `NOT_VERIFIED` na strane verdiktov, nikdy vymyslené číslo.
 */
export function measureProject(project: ProjectModel | null | undefined): QcMeasurement {
  const empty: QcMeasurement = {
    ok: false,
    reasonSk: "Nie je načítaný žiadny projekt (canonical časová os je prázdna).",
    reasonEn: "No project loaded (canonical timeline is empty).",
    projectId: "",
    projectUpdatedAt: 0,
    assetCount: 0,
    videoAssetCount: 0,
    audioAssetCount: 0,
    imageAssetCount: 0,
    assetsById: {},
    missingAssets: [],
    videoClipCount: 0,
    brollClipCount: 0,
    audioClipCount: 0,
    captionClipCount: 0,
    clipCount: 0,
    timelineDurationSec: 0,
    videoSecondsTotal: 0,
    videoCoverageShare: 0,
    cutCount: 0,
    medianShotSec: null,
    meanShotSec: null,
    shotsUnder1_5s: 0,
    cutsPerMinute: null,
    densitySeries: [],
    overlapCount: 0,
    overlapSamples: [],
    transitionCount: 0,
    captionSegmentCount: 0,
    captionTextsWithText: 0,
    longestCaptionGapSec: null,
    captionOverlapCount: 0,
    audioTrackCount: 0,
    mutedAudioClipCount: 0,
    silentVideoClipCount: 0,
    transcriptSegmentCount: 0,
    transcriptWordCount: 0,
    longestWordGapSec: null,
    hasStoredResolution: false,
    width: null,
    height: null,
    aspect: null,
    fps: null,
  };

  if (!project) return empty;

  const assets: MediaAsset[] = project.assets ?? [];
  const assetsById: QcMeasurement["assetsById"] = {};
  for (const a of assets) {
    assetsById[a.id] = { name: a.displayName || a.name, type: a.type, duration: a.duration, width: a.width, height: a.height };
  }

  const allClips: ClipModel[] = [];
  let audioTrackCount = 0;
  for (const track of project.tracks ?? []) {
    if (track.type === "audio") audioTrackCount += 1;
    for (const clip of track.clips ?? []) allClips.push(clip);
  }

  const videoTracks = (project.tracks ?? []).filter((t) => t.type === "video");
  const brollTracks = (project.tracks ?? []).filter((t) => t.type === "b-roll");
  const captionTracks = (project.tracks ?? []).filter((t) => t.type === "caption");
  const audioTracks = (project.tracks ?? []).filter((t) => t.type === "audio");

  const videoClips = videoTracks.flatMap((t) => t.clips ?? []);
  const brollClips = brollTracks.flatMap((t) => t.clips ?? []);
  const captionClips = captionTracks.flatMap((t) => t.clips ?? []);
  const audioClips = audioTracks.flatMap((t) => t.clips ?? []);

  // Dĺžka osi = najvzdialenejší koniec akéhokoľvek klipu.
  let timelineDurationSec = 0;
  for (const clip of allClips) {
    timelineDurationSec = Math.max(timelineDurationSec, clip.start + clip.duration);
  }
  const videoSecondsTotal = videoClips.reduce((sum, c) => sum + c.duration, 0);

  // Strihy = začiatky klipov na video stopách (okrem prvého na každej stope).
  const shotLengths: number[] = [];
  const cutStartTimes: number[] = [];
  for (const track of [...videoTracks, ...brollTracks]) {
    const clips = [...(track.clips ?? [])].sort((a, b) => a.start - b.start);
    clips.forEach((c, idx) => {
      shotLengths.push(ROUND3(c.duration));
      if (idx > 0) cutStartTimes.push(ROUND3(c.start));
    });
  }
  cutStartTimes.sort((a, b) => a - b);

  const minutes = timelineDurationSec > 0 ? timelineDurationSec / 60 : null;

  // Kolízie: na tej istej stope dva klipy, ktoré sa časovo prekrývajú.
  const overlapSamples: { trackId: string; time: number }[] = [];
  for (const track of project.tracks ?? []) {
    const clips = [...(track.clips ?? [])].sort((a, b) => a.start - b.start);
    for (let i = 1; i < clips.length; i += 1) {
      const prev = clips[i - 1];
      const cur = clips[i];
      if (cur.start < prev.start + prev.duration - 0.02) {
        overlapSamples.push({ trackId: track.id, time: ROUND3(cur.start) });
      }
    }
  }

  // Prechody na klipoch (reálne zapísané, nie odhad).
  let transitionCount = 0;
  for (const clip of allClips) {
    const t = clip.transitions;
    if (!t) continue;
    if (t.in) transitionCount += 1;
    if (t.out) transitionCount += 1;
  }

  // Titulky.
  const captionSorted = [...captionClips].sort((a, b) => a.start - b.start);
  const captionTextsWithText = captionSorted.filter((c) => (c.textConfig?.content ?? "").trim().length > 0).length;
  let longestCaptionGapSec: number | null = null;
  let captionOverlapCount = 0;
  for (let i = 1; i < captionSorted.length; i += 1) {
    const prevEnd = captionSorted[i - 1].start + captionSorted[i - 1].duration;
    const gap = captionSorted[i].start - prevEnd;
    if (gap > 0) longestCaptionGapSec = Math.max(longestCaptionGapSec ?? 0, ROUND3(gap));
    else if (gap < -0.02) captionOverlapCount += 1;
  }
  if (captionSorted.length === 1) longestCaptionGapSec = 0;

  // Zvuk — vypnuté klipy.
  const mutedAudioClipCount = audioClips.filter((c) => c.muted === true).length;
  const silentVideoClipCount = videoClips.filter((c) => c.muted === true).length;

  // Prepis — reálne dáta z automatického prepisu (word-level, ak je).
  const transcriptSegments = project.transcript?.segments ?? [];
  let transcriptWordCount = 0;
  let longestWordGapSec: number | null = null;
  for (const seg of transcriptSegments) {
    const words = (seg as any).words as { start: number; end: number }[] | undefined;
    if (!words || words.length === 0) continue;
    transcriptWordCount += words.length;
    for (let i = 1; i < words.length; i += 1) {
      const gap = words[i].start - words[i - 1].end;
      if (gap > 0.25) longestWordGapSec = Math.max(longestWordGapSec ?? 0, ROUND3(gap));
    }
    if (longestWordGapSec === null) longestWordGapSec = 0;
  }

  // Obrazové rozlíšenie: z videí, ktoré sú na osi naozaj použité.
  const usedAssetIds = new Set(videoClips.map((c) => c.assetId).filter(Boolean) as string[]);
  const usedVideos = assets.filter((a) => a.type === "video" && usedAssetIds.has(a.id));
  const withResolution = usedVideos.find((a) => a.width > 0 && a.height > 0) ?? null;
  const aspect = withResolution ? `${withResolution.width}:${withResolution.height}` : null;

  const missingAssets = [...usedAssetIds].filter((id) => !assetsById[id]);

  const m: QcMeasurement = {
    ...empty,
    ok: allClips.length > 0,
    reasonSk: allClips.length > 0 ? "Merané z canonical časovej osi." : "Na časovej osi nie je ani jeden klip — nie je čo merať.",
    reasonEn: allClips.length > 0 ? "Measured from the canonical timeline." : "The timeline has no clips — nothing to measure.",
    projectId: project.id,
    projectUpdatedAt: project.updatedAt ?? 0,
    assetCount: assets.length,
    videoAssetCount: assets.filter((a) => a.type === "video").length,
    audioAssetCount: assets.filter((a) => a.type === "audio").length,
    imageAssetCount: assets.filter((a) => a.type === "image").length,
    assetsById,
    missingAssets,
    videoClipCount: videoClips.length,
    brollClipCount: brollClips.length,
    audioClipCount: audioClips.length,
    captionClipCount: captionClips.length,
    clipCount: allClips.length,
    timelineDurationSec: ROUND3(timelineDurationSec),
    videoSecondsTotal: ROUND3(videoSecondsTotal),
    videoCoverageShare: timelineDurationSec > 0 ? Math.round((videoSecondsTotal / timelineDurationSec) * 1000) / 1000 : 0,
    cutCount: cutStartTimes.length,
    medianShotSec: median(shotLengths),
    meanShotSec: mean(shotLengths) === null ? null : ROUND3(mean(shotLengths) as number),
    shotsUnder1_5s: shotLengths.filter((d) => d < 1.5).length,
    cutsPerMinute: minutes ? Math.round((cutStartTimes.length / minutes) * 10) / 10 : null,
    densitySeries: cutDensitySeries(cutStartTimes, timelineDurationSec, 12),
    overlapCount: overlapSamples.length,
    overlapSamples: overlapSamples.slice(0, 10),
    transitionCount,
    captionSegmentCount: captionClips.length,
    captionTextsWithText,
    longestCaptionGapSec,
    captionOverlapCount,
    audioTrackCount,
    mutedAudioClipCount: mutedAudioClipCount + audioClips.filter((c) => c.volume <= 0).length,
    silentVideoClipCount,
    transcriptSegmentCount: transcriptSegments.length,
    transcriptWordCount,
    longestWordGapSec,
    hasStoredResolution: withResolution !== null,
    width: withResolution?.width ?? null,
    height: withResolution?.height ?? null,
    aspect,
    fps: withResolution?.fps ?? null,
  };

  return m;
}

// ---------------------------------------------------------------------------
// VERDIKTY — ku každej kontrole musí byť povedané, ODKIAĽ je dôkaz.
// ---------------------------------------------------------------------------

export type QcVerdictStatus = "PASS" | "WARNING" | "REVIEW" | "FAIL" | "NOT_VERIFIED";

export interface QcVerdict {
  status: QcVerdictStatus;
  /** Odkiaľ je dôkaz. `null` = kontrola nemá meranie a nesmie tvrdiť PASS. */
  evidenceSource: "measured" | null;
  evidenceSk: string;
  evidenceEn: string;
  reasonSk: string;
  reasonEn: string;
}

const NO_MEASURE_SK = "Táto kontrola zatiaľ nemá meranie — OmniStrih ju nevie doložiť číslom.";
const NO_MEASURE_EN = "This check has no measurement yet — OmniStrih cannot back it with a number.";

function measured(status: QcVerdictStatus, evidenceSk: string, evidenceEn: string, reasonSk: string, reasonEn: string): QcVerdict {
  return { status, evidenceSource: "measured", evidenceSk, evidenceEn, reasonSk, reasonEn };
}

function notVerified(whySk: string, whyEn: string): QcVerdict {
  return { status: "NOT_VERIFIED", evidenceSource: null, evidenceSk: NO_MEASURE_SK, evidenceEn: NO_MEASURE_EN, reasonSk: whySk, reasonEn: whyEn };
}

const PLATFORM_LIMITS: Record<string, number> = {
  "TikTok": 180,
  "Instagram Reels": 90,
  "YouTube Shorts": 60,
  "YouTube Long-form": 43200,
};

/**
 * Verdikt pre každú kontrolu. Nič sa „nedopĺňa“ — kontroly bez merania
 * skončia ako `NOT_VERIFIED` s dôvodom, PREČO meranie nie je.
 */
export function verdictForCheck(
  checkId: string,
  m: QcMeasurement,
  opts: { platform?: keyof typeof PLATFORM_LIMITS | string; hasExportBlockers?: boolean; exportBlockersSk?: string[] } = {},
): QcVerdict {
  if (!m.ok) return notVerified("Nie je načítaný projekt alebo je časová os prázdna — nie je čo merať.", "No project or empty timeline — nothing to measure.");

  switch (checkId) {
    case "QC-03":
    case "QC-04": {
      const med = m.medianShotSec;
      const perMin = m.cutsPerMinute;
      if (med === null || perMin === null) return notVerified("Bez klipov na video stopách sa tempo nedá zmerať.", "Pacing cannot be measured without clips.");
      const mechanical = med < 1.2 && m.shotsUnder1_5s / Math.max(1, m.videoClipCount) > 0.8;
      return measured(
        mechanical ? "WARNING" : "PASS",
        `Merané: ${m.cutCount} strihov, medián záberu ${med.toFixed(2)} s, ${perMin} strihov/min, ${m.shotsUnder1_5s} záberov pod 1,5 s.`,
        `Measured: ${m.cutCount} cuts, median shot ${med.toFixed(2)} s, ${perMin} cuts/min, ${m.shotsUnder1_5s} shots under 1.5 s.`,
        mechanical
          ? `Medián ${med.toFixed(2)} s pri ${m.shotsUnder1_5s} krátkych záberoch vyzerá mechanicky (rovnaké tempo). Skontrolujte, či strihy sledujú vety, nie stopky.`
          : `Tempo je nepravidelné (medián ${med.toFixed(2)} s) — strihy nesledujú pevný interval.`,
        mechanical ? `Median ${med.toFixed(2)} s looks mechanical.` : `Irregular pacing (median ${med.toFixed(2)} s).`,
      );
    }

    case "QC-11":
    case "QC-12": {
      if (m.captionSegmentCount === 0) {
        return measured("WARNING", "Merané: na časovej osi nie sú žiadne titulky (0 klipov).", "Measured: no caption clips on the timeline (0).", "Bez titulkov sa nedá overiť ich rozloženie ani rytmus.", "Without captions, their layout and rhythm cannot be checked.");
      }
      const bad = m.longestCaptionGapSec !== null && m.longestCaptionGapSec > 4;
      return measured(
        bad || m.captionOverlapCount > 0 ? "WARNING" : "PASS",
        `Merané: ${m.captionSegmentCount} titulkov, z toho ${m.captionTextsWithText} s textom; najdlhšia medzera ${m.longestCaptionGapSec === null ? "—" : m.longestCaptionGapSec.toFixed(2) + " s"}; prekrytia ${m.captionOverlapCount}.`,
        `Measured: ${m.captionSegmentCount} captions (${m.captionTextsWithText} with text); longest gap ${m.longestCaptionGapSec === null ? "—" : m.longestCaptionGapSec.toFixed(2) + " s"}; overlaps ${m.captionOverlapCount}.`,
        bad ? "Najdlhšia medzera bez titulku je dlhšia ako 4 s." : m.captionOverlapCount > 0 ? "Dva titulky sa prekrývajú." : "Rozloženie titulkov nemá medzeru nad 4 s ani prekrytie.",
        bad ? "Longest caption gap exceeds 4 s." : m.captionOverlapCount > 0 ? "Two captions overlap." : "No gap above 4 s, no overlaps.",
      );
    }

    case "QC-14":
    case "QC-15":
    case "QC-16": {
      const share = Math.round(m.videoCoverageShare * 100);
      return measured(
        m.videoClipCount + m.brollClipCount <= 1 ? "WARNING" : "PASS",
        `Merané: ${m.videoClipCount} klipov na video stopách + ${m.brollClipCount} B-roll, ${m.clipCount} celkom; obraz pokrýva ${share} % osi; ${m.assetCount} médií v projekte.`,
        `Measured: ${m.videoClipCount} video clips + ${m.brollClipCount} b-roll, ${m.clipCount} total; picture covers ${share} % of the timeline; ${m.assetCount} assets.`,
        "Pozor: relevancia B-rollu (či sa vizuál hodí k vete) sa v OmniStrihu zatiaľ NEMERIA — toto je len počet a pokrytie.",
        "Note: b-roll relevance (whether the visual fits the sentence) is NOT measured yet — this is only count and coverage.",
      );
    }

    case "QC-17": {
      const perMin = m.timelineDurationSec > 0 ? (m.transitionCount / m.timelineDurationSec) * 60 : 0;
      if (m.transitionCount === 0) {
        return measured("PASS", "Merané: na osi nie je zapísaný žiadny prechod (0).", "Measured: no transitions on the timeline (0).", "Žiadne prechody = nie je čo obmedzovať.", "No transitions — nothing to restrain.");
      }
      return measured(
        perMin > 6 ? "WARNING" : "PASS",
        `Merané: ${m.transitionCount} prechodov na osi, t. j. ${perMin.toFixed(1)} prechodu/min.`,
        `Measured: ${m.transitionCount} transitions, i.e. ${perMin.toFixed(1)}/min.`,
        perMin > 6 ? "Viac ako 6 prechodov za minútu pôsobí rušivo." : "Hustota prechodov je pod hranicou rušivosti (6/min).",
        perMin > 6 ? "More than 6 transitions per minute is distracting." : "Transition density is below the distraction threshold (6/min).",
      );
    }

    case "QC-22": {
      const platform = opts.platform ?? "TikTok";
      const limit = PLATFORM_LIMITS[platform] ?? PLATFORM_LIMITS["TikTok"];
      const over = m.timelineDurationSec > limit;
      return measured(
        over ? "FAIL" : "PASS",
        `Merané: dĺžka osi ${m.timelineDurationSec.toFixed(2)} s, formát ${m.aspect ?? "neznámy"}${m.width && m.height ? ` (${m.width}×${m.height})` : ""}, limit pre ${platform} ${limit} s.`,
        `Measured: timeline ${m.timelineDurationSec.toFixed(2)} s, format ${m.aspect ?? "unknown"}${m.width && m.height ? ` (${m.width}×${m.height})` : ""}, ${platform} limit ${limit} s.`,
        over ? `Video je dlhšie ako limit ${platform} (${limit} s).` : "Dĺžka aj formát sú v medziach platformy.",
        over ? `Longer than the ${platform} limit (${limit} s).` : "Duration and format are within platform limits.",
      );
    }

    case "QC-24": {
      const missing = m.missingAssets.length;
      const bad = m.overlapCount > 0 || missing > 0;
      return measured(
        bad ? "FAIL" : "PASS",
        `Merané: ${m.overlapCount} kolízií klipov na tej istej stope${m.overlapCount ? ` (napr. ${m.overlapSamples.slice(0, 3).map((o) => `${o.time.toFixed(2)} s`).join(", ")})` : ""}; médiá na osi, ktoré v projekte nie sú: ${missing}.`,
        `Measured: ${m.overlapCount} clip collisions on the same track; timeline assets missing from the project: ${missing}.`,
        bad ? "Kolízia na osi alebo chýbajúce médium znamená, že export nebude sedieť." : "Žiadne kolízie a všetky použité médiá sú v projekte.",
        bad ? "A collision or a missing asset means the export will not match." : "No collisions, every used asset exists.",
      );
    }

    case "QC-06": {
      if (m.audioTrackCount === 0 && m.audioClipCount === 0) {
        return measured("WARNING", "Merané: projekt nemá zvukovú stopu (0 klipov).", "Measured: no audio track (0 clips).", "Bez zvukovej stopy nie je čo overovať — pôvodný zvuk nie je na osi.", "Without an audio track there is nothing to verify — original audio is not on the timeline.");
      }
      const bad = m.mutedAudioClipCount > 0;
      return measured(
        bad ? "WARNING" : "PASS",
        `Merané: ${m.audioTrackCount} zvukových stôp, ${m.audioClipCount} klipov, ${m.mutedAudioClipCount} stlmených; video klipy so stlmeným zvukom: ${m.silentVideoClipCount}.`,
        `Measured: ${m.audioTrackCount} audio tracks, ${m.audioClipCount} clips, ${m.mutedAudioClipCount} muted; video clips with muted audio: ${m.silentVideoClipCount}.`,
        "Hlasitosť (LUFS), ducking hudby a J/L-cuts sa zatiaľ NEMERAJÚ — chýba meranie zvuku.",
        "Loudness (LUFS), music ducking and J/L-cuts are NOT measured yet — audio measurement is missing.",
      );
    }

    case "QC-08": {
      if (m.transcriptWordCount === 0) {
        return notVerified("Bez slov s časmi (automatický prepis) sa nedá overiť, či strihy padajú na hranice viet.", "Without word timings (auto transcript) cut positions cannot be verified against sentence boundaries.");
      }
      const gaps = m.longestWordGapSec;
      return measured(
        "REVIEW",
        `Merané: ${m.transcriptSegmentCount} viet, ${m.transcriptWordCount} slov s časmi; najdlhšia medzera medzi slovami ${gaps === null ? "—" : gaps.toFixed(2) + " s"}. Na osi je ${m.cutCount} strihov.`,
        `Measured: ${m.transcriptSegmentCount} sentences, ${m.transcriptWordCount} timed words; longest word gap ${gaps === null ? "—" : gaps.toFixed(2) + " s"}. Timeline has ${m.cutCount} cuts.`,
        "Toto je podklad pre človeka: strihy treba porovnať s hranicami viet (automatické porovnanie strih ↔ veta ešte nie je napojené).",
        "This is an input for a human: cuts must be compared with sentence boundaries (automatic cut ↔ sentence matching is not wired yet).",
      );
    }

    case "QC-01":
    case "QC-02":
    case "QC-05":
    case "QC-07":
    case "QC-09":
    case "QC-10":
    case "QC-13":
    case "QC-18":
    case "QC-19":
    case "QC-20":
    case "QC-21":
    case "QC-23":
      return notVerified(
        "Na túto kontrolu OmniStrih nemá meranie (napr. hlasitosť, zámery kamery, emocionálny oblúk, čistota záberov). Bez neho sa nesmie zobraziť PASS.",
        "OmniStrih has no measurement for this check (e.g. loudness, camera intent, emotional arc, clean takes). Without it, PASS must not be shown.",
      );

    case "QC-25":
      return notVerified(
        "Záverečný posudok sa skladá z ostatných kontrol — dnes je väčšina bez merania, preto ho nemožno uzavrieť.",
        "The final review aggregates the other checks — most are unmeasured today, so it cannot be closed.",
      );

    default:
      return notVerified("Neznáma kontrola.", "Unknown check.");
  }
}

/** Súhrn pre panel: koľko kontrol je meraných a koľko čaká na meranie. */
export function measurementSummary(checkIds: string[], m: QcMeasurement, opts?: { platform?: string }): {
  measured: number;
  notVerified: number;
  pass: number;
  warning: number;
  fail: number;
} {
  let passed = 0;
  let warning = 0;
  let fail = 0;
  let nv = 0;
  for (const id of checkIds) {
    const v = verdictForCheck(id, m, opts);
    if (v.evidenceSource === null) nv += 1;
    else if (v.status === "PASS") passed += 1;
    else if (v.status === "FAIL") fail += 1;
    else warning += 1;
  }
  return { measured: checkIds.length - nv, notVerified: nv, pass: passed, warning, fail };
}

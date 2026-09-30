/**
 * KROK 25 — PRECHODY (aby výstup mal aj to, čo majú oni vo videách).
 *
 * Doteraz: prechody existovali len ako rozhranie a náhľad prehrávača —
 * do canonical osi ani do vyrenderovaného videa sa nedostali (v celej
 * renderovacej linke nebol ani jeden `xfade`). Tento modul to napája:
 *
 *   prechod na klipе (canonical os) → canonical plán exportu → ffmpeg `xfade`
 *
 * Pravidlá sú rovnaké ako zvyšok appky:
 *  - **nič sa nepredstiera**: prechod, ktorý sa nedá vykresliť (glitch, otras
 *    kamery, TV statika…), sa do videa NEPUSTÍ a appka povie prečo,
 *  - žiadny odhad a žiadna náhoda — všetko je dané typom a dĺžkou prechodu,
 *  - zvuk sa mení LEN keď používateľ prechod naozaj nastaví (žiadna tichá zmena
 *    pôvodného audia).
 */

/** Prechod na spoji dvoch úsekov (v poradí na časovej osi). */
export interface CanonicalJunctionTransition {
  /** Spoj medzi úsekom `junctionIndex` a `junctionIndex + 1`. */
  junctionIndex: number;
  /** Typ prechodu, ako je zapísaný (slovník appky alebo canonical slovníka). */
  type: string;
  /** Názov prechodu pre ffmpeg `xfade`. */
  ffmpeg: string;
  /** Dĺžka prekrytia v sekundách (už oreznutá na bezpečnú hodnotu). */
  durationSec: number;
  /** Ktoré klipy sa spájajú (aby sa dalo spätne overiť). */
  fromClipId: string;
  toClipId: string;
  labelSk: string;
}

export interface TransitionPlan {
  /** Čo sa naozaj vykreslí. */
  transitions: CanonicalJunctionTransition[];
  /** Čo používateľ nastavil, ale vykresliť sa nedá (s dôvodom). */
  unsupportedSk: string[];
  /** Prehľad pre človeka. */
  summarySk: string;
}

/**
 * Bezpečné limity prechodov.
 *  - krátke: prechod nemá „zožrať“ dej,
 *  - prekrytie najviac 40 % kratšieho z dvoch úsekov (inak by xfade počítal
 *    záporný offset a obraz by skákal).
 */
export const TRANSITION_LIMITS = {
  minDurationSec: 0.1,
  maxDurationSec: 2.0,
  maxShareOfShorterSegment: 0.4,
  maxCount: 20,
} as const;

/**
 * Preklady typov prechodov na ffmpeg.
 *
 * Dva slovníky, pretože ich appka má naozaj dva (canonical klip používa
 * `fade | crossfade | dissolve | wipeLeft…`, Transition Studio používa
 * `dissolve | crossfade | slide_left… | glitch…`). Oboje sa prekladá tu, na
 * jednom mieste — aby sa náhľad a export nemohli rozísť.
 */
const FFMPEG_BY_TYPE: Record<string, string | null> = {
  // canonical slovník klipu
  cut: null, // strih bez prechodu — nič sa nevykresľuje
  fade: "fade",
  crossfade: "fade",
  dissolve: "dissolve",
  wipeLeft: "wipeleft",
  wipeRight: "wiperight",
  slideLeft: "slideleft",
  slideRight: "slideright",
  zoomIn: "zoomin",
  // slovník Transition Studio
  slide_left: "slideleft",
  slide_right: "slideright",
  slide_up: "slideup",
  slide_down: "slidedown",
  zoom_in: "zoomin",
  flash_white: "fadewhite",
  flash_black: "fadeblack",
  iris_circle: "circleopen",
  film_burn: "fadeblack",
  // čo sa vykresliť NEDÁ (kinematické efekty by potrebovali vlastné filtre)
  zoom_out: null,
  zoom_through: null,
  warp_zoom: null,
  whip_pan: null,
  glitch: null,
  camera_shake: null,
  tv_static: null,
  vhs_rewind: null,
  prism_blur: null,
  light_leak: null,
  spin_cw: null,
  spin_ccw: null,
  split_horizontal: null,
};

const UNSUPPORTED_REASON_SK: Record<string, string> = {
  zoom_out: "priblíženie von by potrebovalo vlastný filter (appka ho nevie vykresliť)",
  zoom_through: "prelet kamerou by potreboval vlastný filter (appka ho nevie vykresliť)",
  warp_zoom: "deformácia obrazu by potrebovala vlastný filter",
  whip_pan: "rýchly švih kamery by potreboval vlastný filter",
  glitch: "glitch efekt by potreboval vlastný filter",
  camera_shake: "otras kamery by potreboval vlastný filter",
  tv_static: "TV statika by potrebovala vlastný filter",
  vhs_rewind: "VHS prevíjanie by potrebovalo vlastný filter",
  prism_blur: "hranolové rozostrenie by potrebovalo vlastný filter",
  light_leak: "svetelný prechod by potreboval vlastný filter",
  spin_cw: "otočenie obrazu by potrebovalo vlastný filter",
  spin_ccw: "otočenie obrazu by potrebovalo vlastný filter",
  split_horizontal: "rozpolenie obrazu by potrebovalo vlastný filter",
};

/** Preklad typu prechodu na ffmpeg. `null` = nedá sa vykresliť (alebo je to obyčajný strih). */
export function transitionFfmpegName(type: string | null | undefined): string | null {
  if (!type) return null;
  const key = String(type);
  if (!(key in FFMPEG_BY_TYPE)) return null;
  return FFMPEG_BY_TYPE[key];
}

/** Je typ prechodu podporovaný (dá sa vykresliť do videa)? */
export function transitionIsSupported(type: string | null | undefined): boolean {
  return transitionFfmpegName(type) !== null;
}

/** Dôvod, prečo sa prechod nedá vykresliť (pre používateľa, po slovensky). */
export function transitionUnsupportedReasonSk(type: string): string {
  return UNSUPPORTED_REASON_SK[type] ?? "tento typ prechodu appka nevie vykresliť";
}

/** Dĺžka prechodu oreznutá na bezpečnú hodnotu (podľa oboch susedných úsekov). */
export function clampTransitionDurationSec(
  durationSec: number,
  previousSegmentSec: number,
  nextSegmentSec: number,
): number {
  const wanted = Number.isFinite(durationSec) ? durationSec : 0.4;
  const shorter = Math.max(0.05, Math.min(previousSegmentSec, nextSegmentSec));
  const safe = Math.min(
    Math.max(wanted, TRANSITION_LIMITS.minDurationSec),
    TRANSITION_LIMITS.maxDurationSec,
    shorter * TRANSITION_LIMITS.maxShareOfShorterSegment,
  );
  return Math.round(safe * 1000) / 1000;
}

/** Úseky, ktoré canonical os ponecháva (v poradí), vrátane klipu a jeho prechodu „na vstupe“. */
export interface CanonicalSegmentForTransitions {
  clipId: string;
  start: number;
  end: number;
  /** Prechod na vstupe tohto úseku (spoj s predchádzajúcim) — ak je nastavený. */
  transitionIn?: { type: string; duration: number } | null;
}

/**
 * Zloží plán prechodov z úsekov canonical osi.
 *
 * Prechod patrí na **vstup** úseku, ktorý začína za strihom — presne tak je to
 * aj v modeli klipu (`transitions.in`), takže nevzniká druhý model prechodov.
 */
export function buildTransitionPlan(segments: CanonicalSegmentForTransitions[]): TransitionPlan {
  const transitions: CanonicalJunctionTransition[] = [];
  const unsupportedSk: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const type = seg.transitionIn?.type;
    if (!type || type === "cut") continue; // bez prechodu = obyčajný strih

    if (i === 0) {
      // Prvý úsek nemá s čím prechádzať — appka to povie, nepredstiera nič.
      unsupportedSk.push(
        `„${type}“ je nastavený na vstupe prvého úseku — tam niet s čím prechádzať, takže sa vynecháva.`,
      );
      continue;
    }

    const ffmpeg = transitionFfmpegName(type);
    if (!ffmpeg) {
      unsupportedSk.push(
        `„${type}“ sa do videa nevykreslí — ${transitionUnsupportedReasonSk(type)}; strih na tom mieste zostáva.`,
      );
      continue;
    }

    const previous = segments[i - 1];
    const durationSec = clampTransitionDurationSec(
      seg.transitionIn?.duration ?? 0.4,
      previous.end - previous.start,
      seg.end - seg.start,
    );
    const wasClamped = Math.abs(durationSec - (seg.transitionIn?.duration ?? 0.4)) > 0.001;

    transitions.push({
      junctionIndex: i - 1,
      type,
      ffmpeg,
      durationSec,
      fromClipId: previous.clipId,
      toClipId: seg.clipId,
      labelSk:
        `prechod „${type}“ na spoji ${i - 1}${i} (${durationSec.toFixed(2)} s)` +
        (wasClamped ? " — dĺžka oreznutá na bezpečnú hodnotu" : ""),
    });
  }

  const capped = transitions.slice(0, TRANSITION_LIMITS.maxCount);
  if (transitions.length > capped.length) {
    unsupportedSk.push(
      `prechodov je viac než maximum (${TRANSITION_LIMITS.maxCount}) — vykreslí sa prvých ${capped.length}.`,
    );
  }

  const summarySk =
    capped.length === 0
      ? unsupportedSk.length > 0
        ? `Prechody: žiadny sa nevykreslí (${unsupportedSk.length} dôvodov nižšie).`
        : "Prechody: žiadne nastavené — strihy zostávajú obyčajné."
      : `Prechody: ${capped.length} sa vykreslí (${capped.map((t) => t.ffmpeg).join(", ")}), ` +
        `spolu prekrytie ${capped.reduce((a, t) => a + t.durationSec, 0).toFixed(2)} s.` +
        (unsupportedSk.length > 0 ? ` ${unsupportedSk.length} sa nevykreslí.` : "");

  return { transitions: capped, unsupportedSk, summarySk };
}

/**
 * Z canonical projektu (klipy video stopy) spraví úseky pre plán prechodov.
 * Poradie je rovnaké, ako pri strihaní (`canonicalKeepRanges`), aby junction
 * index sedel s tým, čo ide do ffmpeg.
 */
export function segmentsForTransitions(
  videoClips: { id: string; start: number; sourceStart?: number; sourceEnd?: number; duration: number; transitions?: { in?: { type: string; duration: number } } }[],
): CanonicalSegmentForTransitions[] {
  return videoClips
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((clip) => ({
      clipId: clip.id,
      start: clip.sourceStart ?? 0,
      end: clip.sourceEnd ?? (clip.sourceStart ?? 0) + clip.duration,
      transitionIn: clip.transitions?.in ? { type: clip.transitions.in.type, duration: clip.transitions.in.duration } : null,
    }))
    .filter((s) => s.end - s.start > 0.02);
}

/** Súčet prekrytí — o koľko bude hotové video kratšie než bez prechodov. */
export function totalOverlapSec(transitions: CanonicalJunctionTransition[]): number {
  return Math.round(transitions.reduce((a, t) => a + t.durationSec, 0) * 1000) / 1000;
}

/**
 * Prechody, ktoré vie ffmpeg `xfade` vykresliť (ffmpeg 7). Používa sa na
 * validáciu vstupu — neznámy názov sa nikdy ticho nezahodí.
 */
export const XFADE_TRANSITIONS = [
  "fade",
  "dissolve",
  "wipeleft",
  "wiperight",
  "wipeup",
  "wipedown",
  "slideleft",
  "slideright",
  "slideup",
  "slidedown",
  "fadeblack",
  "fadewhite",
  "circleopen",
  "circleclose",
  "zoomin",
  "hblur",
  "pixelize",
] as const;

// ---------------------------------------------------------------------------
// PREPOJENIE ROZHRANIA „PRECHODY“ S CANONICAL OSOU
// ---------------------------------------------------------------------------

/** Prechod, ako ho drží rozhranie „Prechody“ (Transition Studio). */
export interface StudioTransitionLike {
  timestamp: number;
  duration: number;
  type: string;
}

/** Klip na video stope (to, čo je naozaj v canonical osi). */
export interface ClipLikeForTransitions {
  id: string;
  start: number;
  sourceStart?: number;
  sourceEnd?: number;
  duration: number;
  transitions?: { in?: { type: string; duration: number }; out?: { type: string; duration: number } } | null;
}

export interface ClipTransitionUpdate {
  clipId: string;
  /** `null` = prechod sa má z klipu odstrániť (napr. používateľ ho zrušil). */
  transitionIn: { type: string; duration: number } | null;
}

export interface StudioTransitionMapping {
  updates: ClipTransitionUpdate[];
  /** Prechody, pre ktoré na časovej osi nie je strih (nedajú sa uložiť). */
  unmatchedSk: string[];
  /** Prechody, ktoré sú uložené, ale do videa sa nevykreslia. */
  unsupportedSk: string[];
  summarySk: string;
}

/**
 * Namapuje prechody z rozhrania na klipy canonical osi.
 *
 * Prechod na čase `T` patrí **klipu, ktorý začína na `T`** — to je strih,
 * ktorý používateľ videl. Keď taký klip neexistuje (napr. používateľ prestrihal
 * inde), prechod sa neuloží a appka to povie (nič sa nepredstiera).
 */
export function mapStudioTransitionsToClips(
  clips: ClipLikeForTransitions[],
  transitions: StudioTransitionLike[],
  options: { toleranceSec?: number } = {},
): StudioTransitionMapping {
  const tolerance = options.toleranceSec ?? 0.5;
  const ordered = clips.slice().sort((a, b) => a.start - b.start);
  const updates: ClipTransitionUpdate[] = [];
  const unmatchedSk: string[] = [];
  const unsupportedSk: string[] = [];
  const claimed = new Set<string>();

  for (const tr of transitions.slice().sort((a, b) => a.timestamp - b.timestamp)) {
    // Prvý klip nemá s čím prechádzať — preskočí sa prvý kandidát na začiatku.
    const target = ordered.find(
      (c, idx) =>
        idx > 0 &&
        Math.abs((c.sourceStart ?? 0) - tr.timestamp) <= tolerance &&
        !claimed.has(c.id) &&
        c.id !== updates[updates.length - 1]?.clipId,
    );
    if (!target) {
      unmatchedSk.push(
        `prechod „${tr.type}“ v ${tr.timestamp.toFixed(2)} s: na časovej osi tam nie je strih (medzi úsekmi), takže sa nedá uložiť — ostáva len v rozhraní.`,
      );
      continue;
    }
    claimed.add(target.id);
    if (!transitionIsSupported(tr.type)) {
      unsupportedSk.push(
        `prechod „${tr.type}“ v ${tr.timestamp.toFixed(2)} s: ${transitionUnsupportedReasonSk(tr.type)} — do videa sa nevykreslí (strih zostáva).`,
      );
      continue;
    }
    updates.push({
      clipId: target.id,
      transitionIn: { type: tr.type, duration: clampTransitionDurationSec(tr.duration, target.sourceEnd ? target.sourceEnd - (target.sourceStart ?? 0) : target.duration, target.duration) },
    });
  }

  // Prechody, ktoré na osi zostali z minula a používateľ ich v rozhraní zrušil.
  for (const clip of ordered) {
    const hasIn = Boolean(clip.transitions?.in);
    if (hasIn && !claimed.has(clip.id)) {
      updates.push({ clipId: clip.id, transitionIn: null });
    }
  }

  const summarySk =
    updates.length === 0 && unmatchedSk.length === 0 && unsupportedSk.length === 0
      ? "Prechody: žiadne."
      : `Prechody: ${updates.filter((u) => u.transitionIn).length} na časovej osi` +
        (unsupportedSk.length > 0 ? `, ${unsupportedSk.length} sa nevykreslí` : "") +
        (unmatchedSk.length > 0 ? `, ${unmatchedSk.length} nemá na osi strih` : "") +
        ".";

  return { updates, unmatchedSk, unsupportedSk, summarySk };
}

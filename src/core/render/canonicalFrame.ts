/**
 * CANONICAL FRAME PLAN — jediné miesto, ktoré rozhoduje, čo sa v danom čase kreslí.
 *
 * Prečo to existuje: náhľad a export musia ukázať **to isté**. Keď si každé z nich
 * rieši vrstvy samo, skôr či neskôr sa rozídu (a človek potom exportuje niečo iné,
 * než videl). Preto je tu jedna čistá funkcia, ktorú volá náhľad aj export.
 *
 * Modul je zámerne **bez DOM a bez canvasu** — dá sa testovať a nedá sa „potichu
 * pokaziť“ tým, že niekde chýba médium. Keď sa vrstva nedá nakresliť, vráti presný
 * dôvod (`skipped`), nikdy sa netvári, že tam je.
 */

import { ProjectModel, ClipModel, TrackModel } from "../types/project";
import { TimelineEngine } from "../timeline/timelineEngine";
import type { KeyframeParameter } from "../types/project";

/** Druhy vrstiev, ktoré canonical kompozitor vie nakresliť. */
export type CanonicalLayerKind = "media" | "text";

export interface CanonicalLayer {
  trackId: string;
  clipId: string;
  /** Poradie kreslenia (nižšie = spodok). Zoradené vzostupne. */
  zIndex: number;
  kind: CanonicalLayerKind;
  clipType: string;
  name: string;
  assetId?: string;
  /** Čas v rámci klipu (sekundy) — pre keyframy a časovanie animácií. */
  clipTime: number;
  /** Zdrojový čas v médiu (pre presné seeknutie prehrávača/exportu). */
  sourceTime: number | null;
  text?: string;
  /**
   * Časovanie slov z canonical klipu (relatívne k začiatku klipu) — náhľad podľa
   * neho zvýrazní hovorené slovo. Keď chýba, kreslí sa statický text bez zvýraznenia.
   */
  words?: { word: string; start: number; end: number }[];
  /** Predvoľba titulkov z canonical klipu (`CaptionStyleConfig.preset`) — farba zvýraznenia. */
  captionPreset?: string;
  opacity: number;
  scale: number;
  positionX: number;
  positionY: number;
  rotation: number;
  filter: string;
}

export interface CanonicalSkippedLayer {
  trackId: string;
  clipId: string;
  name: string;
  reasonSk: string;
}

export interface CanonicalFramePlan {
  timeSec: number;
  /** Vrstvy, ktoré sa naozaj kreslia (zoradené zdola nahor). */
  layers: CanonicalLayer[];
  /** Vrstvy, ktoré existujú na časovej osi, ale nedajú sa nakresliť — s dôvodom. */
  skipped: CanonicalSkippedLayer[];
  /** Snímka je mimo dĺžky projektu (nič sa nekreslí). */
  outsideTimeline: boolean;
  /** Skutočný koniec obsahu (posledný klip na osi) — nie „minimum 10 s“, ktoré má engine. */
  contentEndSec: number;
}

/** Koľko médií (podľa `assetId`) má klient naozaj k dispozícii na kreslenie. */
export type AvailableMediaIds = ReadonlySet<string> | readonly string[] | ((assetId: string) => boolean);

function toPredicate(available?: AvailableMediaIds): ((assetId: string) => boolean) | null {
  if (!available) return null;
  if (typeof available === "function") return available;
  if (Array.isArray(available)) {
    const set = new Set(available as readonly string[]);
    return (id) => set.has(id);
  }
  const set = available as ReadonlySet<string>;
  return (id) => set.has(id);
}

export interface BuildCanonicalFramePlanOptions {
  /**
   * Médiá, ktoré má klient pripravené na kreslenie (napr. registrované `<video>`/`<img>`).
   * Keď nie je uvedené, plán **nezamlčí** nič — vrstvy sa vypíšu a `skipped` zostane prázdne
   * len preto, že kresliť je schopný volajúci. Ak je zoznam uvedený, chýbajúce médium
   * sa objaví v `skipped` s dôvodom.
   */
  availableMedia?: AvailableMediaIds;
  /** Keď je true, `skipped` obsahuje aj textové vrstvy bez textu. */
  reportEmptyText?: boolean;
}

const PLURAL_SK: Record<string, string> = {};

/**
 * Zostaví canonical plán snímky v čase `timeSec`.
 *
 * Je to **jediný** zdroj pravdy pre to, čo sa kreslí — volá ho náhľad (`renderEngine`)
 * aj export (rovnaký `renderEngine`, len iným smerom do súboru).
 */
export function buildCanonicalFramePlan(
  project: ProjectModel,
  timeSec: number,
  options: BuildCanonicalFramePlanOptions = {},
): CanonicalFramePlan {
  const contentEndSec = projectContentEndSec(project);
  const t = Number.isFinite(timeSec) ? Math.max(0, timeSec) : 0;

  if (t > contentEndSec + 1e-6) {
    return {
      timeSec: t,
      layers: [],
      skipped: [],
      outsideTimeline: contentEndSec > 0,
      contentEndSec,
    };
  }

  const active = TimelineEngine.getActiveClipsAtTime(project, t);
  const isAvailable = toPredicate(options.availableMedia);
  let layerSequence = 0;

  const layers: CanonicalLayer[] = [];
  const skipped: CanonicalSkippedLayer[] = [];

  // Čo na osi je, ale engine ho kvôli skrytej/stlmenej stope už vynechal — priznáme to.
  for (const track of project.tracks) {
    if (track.visible && !track.muted) continue;
    for (const clip of track.clips) {
      if (t >= clip.start && t < clip.start + clip.duration) {
        skipped.push({
          trackId: track.id,
          clipId: clip.id,
          name: clip.name,
          reasonSk: track.visible
            ? `Stopa „${track.name}“ je stlmená — vrstva sa nekreslí.`
            : `Stopa „${track.name}“ je skrytá — vrstva sa nekreslí.`,
        });
      }
    }
  }

  for (const { track, clip } of active) {
    const clipTime = (t - clip.start) * (clip.speed || 1);
    const sourceTime =
      clip.type === "video" || clip.type === "b-roll" || clip.type === "image" || clip.type === "audio"
        ? safeSourceTime(clip, t)
        : null;

    // Hodnoty, ktoré sa naozaj kreslia — vrátane keyframov (rovnaká matematika ako kompozitor).
    const animated = {
      opacity: keyframe(clip, "opacity", clipTime, clip.opacity ?? 100),
      scale: keyframe(clip, "scale", clipTime, clip.scale ?? 100),
      positionX: keyframe(clip, "positionX", clipTime, clip.positionX ?? 0),
      positionY: keyframe(clip, "positionY", clipTime, clip.positionY ?? 0),
      rotation: keyframe(clip, "rotation", clipTime, clip.rotation ?? 0),
    };

    const base = {
      trackId: track.id,
      clipId: clip.id,
      zIndex: track.order * 1000 + Math.round(clip.start * 1000) + layerSequence++,
      clipType: clip.type,
      name: clip.name,
      assetId: clip.assetId,
      clipTime,
      sourceTime,
      ...animated,
      filter: clip.filter ?? "NONE",
    };

    if (clip.type === "video" || clip.type === "b-roll" || clip.type === "image") {
      if (!clip.assetId) {
        skipped.push({
          trackId: track.id,
          clipId: clip.id,
          name: clip.name,
          reasonSk: "Klip nemá médium (žiadne assetId) — nedá sa nakresliť.",
        });
        continue;
      }
      if (isAvailable && !isAvailable(clip.assetId)) {
        skipped.push({
          trackId: track.id,
          clipId: clip.id,
          name: clip.name,
          reasonSk: `Médium pre „${clip.name}“ nie je pripravené na kreslenie (nie je načítané v prehliadači).`,
        });
        continue;
      }
      layers.push({ ...base, kind: "media" });
      continue;
    }

    if (clip.type === "text" || clip.type === "caption") {
      const text = clip.textConfig?.content ?? "";
      if (text.trim().length === 0) {
        if (options.reportEmptyText) {
          skipped.push({
            trackId: track.id,
            clipId: clip.id,
            name: clip.name,
            reasonSk: "Textová vrstva nemá obsah — nie je čo nakresliť.",
          });
        }
        continue;
      }
      const words = Array.isArray(clip.textConfig?.words) ? clip.textConfig.words : [];
      layers.push({
        ...base,
        kind: "text",
        text,
        ...(words.length > 0 ? { words } : {}),
        ...(clip.captionStyle?.preset ? { captionPreset: clip.captionStyle.preset } : {}),
      });
      continue;
    }

    skipped.push({
      trackId: track.id,
      clipId: clip.id,
      name: clip.name,
      reasonSk: `Typ vrstvy „${clip.type}“ canonical kompozitor nekreslí (${track.type} stopa).`,
    });
  }

  // Zdola nahor: najprv podľa poradia stopy, potom podľa času začiatku klipu (stabilné a deterministické).
  layers.sort((a, b) => (a.zIndex - b.zIndex) || a.clipId.localeCompare(b.clipId));
  return { timeSec: t, layers, skipped, outsideTimeline: false, contentEndSec };
}

/** Koniec obsahu na časovej osi (posledný klip) — bez „minimálnej dĺžky“ enginu. */
export function projectContentEndSec(project: ProjectModel): number {
  let end = 0;
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      const clipEnd = (clip.start ?? 0) + (clip.duration ?? 0);
      if (clipEnd > end) end = clipEnd;
    }
  }
  return Math.round(end * 1000) / 1000;
}

/** Keyframe interpolácia s ochranou: keď engine zlyhá, použije sa statická hodnota. */
function keyframe(clip: ClipModel, property: KeyframeParameter, clipTime: number, fallback: number): number {
  try {
    const value = TimelineEngine.interpolateKeyframeValue(clip.keyframes, property, clipTime, fallback);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function safeSourceTime(clip: ClipModel, timelineTime: number): number | null {
  try {
    const value = TimelineEngine.timelineToSourceTime(clip, timelineTime);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Kontrola zhody: náhľad aj export musia z rovnakého projektu a času dostať **ten istý plán**.
 * Používa sa v testoch aj vo verifikačnom runneri — aby sa „dva render paths“ nedali
 * zavliecť späť potichu.
 */
export function canonicalPlansMatch(a: CanonicalFramePlan, b: CanonicalFramePlan): boolean {
  const sig = (p: CanonicalFramePlan) =>
    JSON.stringify({
      t: Number(p.timeSec.toFixed(4)),
      layers: p.layers.map((l) => [l.clipId, l.kind, l.zIndex, l.text ?? null, Number(l.opacity.toFixed(3)), Number(l.scale.toFixed(3))]),
      skipped: p.skipped.map((s) => [s.clipId, s.reasonSk]),
    });
  return sig(a) === sig(b);
}

/** Ľudské zhrnutie plánu (do UI a do reportu) — nič nezamlčuje. */
export function canonicalFrameSummarySk(plan: CanonicalFramePlan): string {
  if (plan.layers.length === 0 && plan.skipped.length === 0) {
    const t = plan.timeSec.toFixed(1).replace(".", ",");
    return plan.outsideTimeline
      ? `V čase ${t} s už je koniec projektu — nie je čo kresliť.`
      : `V čase ${t} s nie je na časovej osi nič.`;
  }
  const parts = plan.layers.map((l) => {
    if (l.kind === "text") return `text „${(l.text ?? "").slice(0, 40)}“`;
    const zoom = l.scale !== 100 ? ` (zoom ${l.scale} %)` : "";
    return `${l.clipType === "image" || l.clipType === "b-roll" ? "obraz" : "video"} „${l.name}“${zoom}`;
  });
  const skipped = plan.skipped.length > 0 ? ` · nevykreslené: ${plan.skipped.length} (${plan.skipped[0].reasonSk})` : "";
  return `${plan.layers.length} vrstiev: ${parts.join(", ")}${skipped}`;
}

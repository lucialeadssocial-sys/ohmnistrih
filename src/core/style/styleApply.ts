/**
 * STYLE STUDIO — APPLY (krok 5–6).
 *
 * Toto je **jediné miesto**, kde sa plán mení na skutočnú zmenu projektu — a to
 * výhradne cez **existujúci `CommandManager`** (žiadny druhý command systém,
 * žiadny paralelný render path, žiadny nový timeline model).
 *
 * Zásady, ktoré tento modul dodržiava (a testy ich overujú):
 *  1. **Bez snapshotu sa neaplikuje nič.** Najprv vznikne verzia projektu
 *     (`CreateProjectVersionCommand`), až potom idú zmeny.
 *  2. **APPLIED znamená reálna zmena.** Rozhodnutie sa označí ako aplikované len
 *     vtedy, keď naozaj pribudol klip / zmenila sa transformácia / prechod.
 *     Inak je to `SKIPPED` s konkrétnym dôvodom (alebo `HONORED` pri ochrannom
 *     pravidle „nechaj rečníka v obraze“).
 *  3. **Audio je nedotknuteľné.** Modul neobsahuje ani jedno audio volanie a po
 *     aplikovaní **overí**, že zvukové stopy a zvukové médiá sú bajtovo rovnaké.
 *  4. **Žiadny AI provider.** Všetko je lokálne a deterministické.
 */

import type {
  ClipModel,
  EditDecision,
  MarkerModel,
  MediaAsset,
  ProjectModel,
  TrackModel,
  TransitionConfig,
} from "../types/project";
import { createCanonicalClip } from "../types/project";
import type { CompositionKind, MotionKind, StyleDecisionKind, SupportingElementType } from "./styleDecisionTypes";
import { GENERATED_VISUALS_STATUS_SK } from "./styleDecisionTypes";
import { getStyleRecipe } from "./styleRecipes";
import type { StylePlan } from "./styleIntelligence";
import { elementLabelSk } from "./styleIntelligence";

// ---------------------------------------------------------------------------
// Host (v appke `coreEngine`, v testoch ten istý engine)
// ---------------------------------------------------------------------------

export interface StyleTransformProps {
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  positionX?: number;
  positionY?: number;
  rotation?: number;
  opacity?: number;
  anchorX?: number;
  anchorY?: number;
}

/**
 * Minimálny povrch, ktorý Apply potrebuje. **`CoreEngine` ho spĺňa celý** —
 * nepridáva sa žiadna nová vrstva, len sa pomenúvajú existujúce operácie.
 */
export interface StyleApplyHost {
  getProject(): ProjectModel;
  createProjectVersion(label: string, description: string): boolean;
  restoreProjectVersion(versionId: string): boolean;
  createEditDecision(decision: EditDecision): boolean;
  addMarker(marker: MarkerModel): boolean;
  addClip(trackId: string, clip: ClipModel, ripple?: boolean): boolean;
  setTransform(clipId: string, props: StyleTransformProps): boolean;
  /**
   * Voliteľné: vráti poslednú zmenu (existujúce `CommandManager.undo()`).
   * Používa sa, keď sa zmena vykonala, ale **nepodarilo sa zapísať rozhodnutie** —
   * appka potom zmenu vráti, aby v projekte neostala zmena bez záznamu.
   */
  undoLastCommand?: () => boolean;
}

export type StyleStepStatus = "APPLIED" | "HONORED" | "SKIPPED";

export type StyleCanonicalEffect =
  | "clip_added"
  | "transform_changed"
  | "marker_added"
  | "decision_recorded_only"
  | "nothing";

export interface StyleApplyStep {
  decisionId: string;
  kind: StyleDecisionKind;
  status: StyleStepStatus;
  /**
   * `true` = efekt tejto rozhodnutia v projekte **už existuje** (z predošlého
   * aplikovania). Vtedy je krok „SKIPPED“ (tento beh nič nemenil), ale záznam
   * rozhodnutia v projekte je správne „applied“ — stav projektu je aplikovaný.
   */
  alreadyApplied?: boolean;
  statusLabelSk: string;
  whatSk: string;
  reasonSk: string;
  effect: StyleCanonicalEffect;
  targetSk: string;
}

/** Presné odtlačky stavu — slúžia na overenie, nie na dojem. */
export interface StyleStateFingerprint {
  videoClips: number;
  brollClips: number;
  captionClips: number;
  audioClips: number;
  adjustmentClips: number;
  markers: number;
  decisions: number;
  /** Bajtová pravda o zvuku (stopy zvuku + zvukové médiá). */
  audioJson: string;
  /** Bajtová pravda o obraze a časovej osi (bez zvuku). */
  visualJson: string;
}

export interface StyleApplyReport {
  ok: boolean;
  errorSk: string | null;
  planId: string;
  recipeId: string;
  snapshotVersionId: string | null;
  snapshotLabelSk: string;
  steps: StyleApplyStep[];
  appliedCount: number;
  honoredCount: number;
  skippedCount: number;
  timelineChanged: boolean;
  before: StyleStateFingerprint;
  after: StyleStateFingerprint;
  audioPreserved: boolean;
  audioNoteSk: string;
  notesSk: string[];
  provider: "NONE";
  createdAt: number;
}

export interface StyleRollbackReport {
  ok: boolean;
  errorSk: string | null;
  snapshotVersionId: string;
  restoredExactly: boolean;
  timelineRestoredSk: string;
  audioRestoredSk: string;
}

const STATUS_LABEL_SK: Record<StyleStepStatus, string> = {
  APPLIED: "aplikované (zmenil sa projekt)",
  HONORED: "dodržané (nič sa neprekrylo)",
  SKIPPED: "nevykonané (dôvod nižšie)",
};

// ---------------------------------------------------------------------------
// Odtlačky stavu
// ---------------------------------------------------------------------------

function clipStart(c: ClipModel): number {
  return Number(c.timelineStart ?? c.start ?? 0);
}

function clipDuration(c: ClipModel): number {
  const d = Number(c.duration ?? 0);
  if (d > 0) return d;
  return Math.max(0, Number(c.sourceEnd ?? 0) - Number(c.sourceStart ?? 0));
}

function isAudioTrack(t: TrackModel): boolean {
  return t.type === "audio" || t.type === "sfx";
}

function visualPart(project: ProjectModel): string {
  return JSON.stringify({
    tracks: (project.tracks ?? [])
      .filter((t) => !isAudioTrack(t))
      .map((t) => ({ id: t.id, type: t.type, clips: t.clips })),
    markers: project.markers ?? [],
    assets: (project.assets ?? []).filter((a) => a.type !== "audio"),
  });
}

function audioPart(project: ProjectModel): string {
  return JSON.stringify({
    tracks: (project.tracks ?? []).filter(isAudioTrack).map((t) => ({ id: t.id, type: t.type, muted: t.muted, gain: t.gain, clips: t.clips })),
    assets: (project.assets ?? []).filter((a) => a.type === "audio"),
    // Zvukové nastavenia projektu (hlasitosť, ducking…) — musia ostať presne rovnaké.
    settings: JSON.parse(JSON.stringify(project.settings ?? {})),
  });
}

function countClips(project: ProjectModel, type: TrackModel["type"]): number {
  return (project.tracks ?? []).filter((t) => t.type === type).reduce((sum, t) => sum + t.clips.length, 0);
}

export function fingerprintStyleState(project: ProjectModel): StyleStateFingerprint {
  return {
    videoClips: countClips(project, "video"),
    brollClips: countClips(project, "b-roll"),
    captionClips: countClips(project, "caption"),
    audioClips: countClips(project, "audio") + countClips(project, "sfx"),
    adjustmentClips: countClips(project, "adjustment"),
    markers: (project.markers ?? []).length,
    decisions: (project.editDecisions ?? []).length,
    audioJson: audioPart(project),
    visualJson: visualPart(project),
  };
}

// ---------------------------------------------------------------------------
// Vyhľadávanie v projekte
// ---------------------------------------------------------------------------

function firstTrackOfType(project: ProjectModel, type: TrackModel["type"]): TrackModel | null {
  return (project.tracks ?? []).find((t) => t.type === type) ?? null;
}

function clipAt(project: ProjectModel, trackType: TrackModel["type"], startSec: number, endSec: number): ClipModel | null {
  const track = firstTrackOfType(project, trackType);
  if (!track) return null;
  const overlapping = track.clips
    .filter((c) => {
      const s = clipStart(c);
      const e = s + clipDuration(c);
      return s < endSec && e > startSec;
    })
    .sort((a, b) => clipStart(a) - clipStart(b));
  return overlapping[0] ?? null;
}

/**
 * Médium pre podporný vizuál: **len to, čo naozaj existuje v projektovej knižnici**.
 * Nikdy sa nič negeneruje ani nedopočítava.
 */
export function pickSupportingAsset(project: ProjectModel, avoidAssetId?: string): MediaAsset | null {
  const assets = (project.assets ?? []).filter((a) => (a.type === "image" || a.type === "video") && a.id !== avoidAssetId);
  if (assets.length === 0) return null;
  return [...assets].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.id.localeCompare(b.id))[0];
}

function assetOfMainVideo(project: ProjectModel): string | undefined {
  const track = firstTrackOfType(project, "video");
  return track?.clips[0]?.assetId;
}

/** Mapovanie receptu na **existujúci** presets tituliek projektu (žiadny druhý katalóg). */
const CAPTION_PRESET_BY_STYLE: Record<string, "clean" | "bold" | "social" | "minimal" | "kinetic"> = {
  VIRAL_BOLD: "bold",
  HORMOZI: "bold",
  KARAOKE: "kinetic",
  NEON_BOX: "social",
  KEYWORD_POP: "kinetic",
  CLEAN: "clean",
  PODCAST: "minimal",
  MINIMAL: "minimal",
  BRAND: "social",
};

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

export interface StyleApplyOptions {
  /** Ktoré rozhodnutia aplikovať (z obrazovky: tie, ktoré človek označil). */
  decisionIds?: string[];
  /**
   * **Upravené rozhodnutia z Review** (Accept / Edit / Reject) — krok 16.
   * Aplikujú sa **len hodnoty, ktoré zadal človek**; čo nie je v mape, ostáva z plánu.
   * Nič sa nedomýšľa a nič sa negeneruje.
   */
  edits?: Record<string, StyleDecisionEdit>;
  /** Fixný čas pre deterministické testy. */
  now?: number;
  /** Popis snapshotu (aby bolo v histórii vidieť, čo sa dialo). */
  snapshotLabelSk?: string;
}

/**
 * **Čo smie človek v Review upraviť** (a čo zámerne nie).
 *
 * Pravidlo: upraviť sa dá to, čo je **voľba štýlu**. Čas (WHEN) sa needituje, lebo
 * pochádza z reálnych dát (wordTiming) — vymyslené časovanie by bolo klamstvo.
 */
export interface StyleDecisionEdit {
  /** Doslovný text do obrazu — prepíše text z vety. Nikdy sa nevymýšľa, len prepisuje. */
  typographyText?: string;
  /** Priblíženie (napr. 1.12 = 112 %). Clampne sa na 1,00–1,60. */
  punchInScale?: number;
  /** Druh pohybu (pop / slide / punch / jemný zoom…). */
  motion?: MotionKind;
  /** Typ podporného prvku z existujúcich médií (generated_visual sa nikdy neprijme). */
  elementType?: SupportingElementType;
  /** Kompozícia scény. */
  composition?: CompositionKind;
  /** Poznámka človeka k úprave (uloží sa do dôkazov rozhodnutia). */
  noteSk?: string;
}

/** Výsledok úpravy jedného rozhodnutia: efektívne rozhodnutie + čo sa zmenilo a čo sa odmietlo. */
export interface StyleDecisionReview {
  decision: EditDecision;
  /** Ľudsky: „text: … → …", „priblíženie: 1,12 → 1,30". */
  changedSk: string[];
  /** Čo appka zámerne neprijala (napr. generovaný vizuál alebo nezmyselné číslo). */
  ignoredSk: string[];
}

function fmtNum(v: number): string {
  return v.toFixed(2).replace(".", ",");
}

/**
 * Použije úpravu človeka na rozhodnutie — **deterministicky, bez providera**.
 * Vracia nové rozhodnutie (nemutuje vstup) a povie, čo zmenila a čo odmietla.
 */
export function reviewStyleDecision(decision: EditDecision, edit?: StyleDecisionEdit): StyleDecisionReview {
  const changedSk: string[] = [];
  const ignoredSk: string[] = [];
  if (!edit || typeof edit !== "object") return { decision, changedSk, ignoredSk };

  const next = cloneDecision(decision);
  const detail = next.style;
  if (!detail) {
    ignoredSk.push("Rozhodnutie nemá vizuálny detail — úpravu nie je kam zapísať.");
    return { decision, changedSk, ignoredSk };
  }
  const action = (detail.action ?? {}) as Record<string, unknown>;
  const payload = (next.actionPayload ?? {}) as Record<string, unknown>;

  const applyToBoth = (key: string, value: unknown) => {
    action[key] = value;
    payload[key] = value;
  };

  // 1) Doslovný text — len neprázdny reťazec (nikdy sa nič nedopisuje).
  if (edit.typographyText !== undefined) {
    const text = typeof edit.typographyText === "string" ? edit.typographyText.trim() : "";
    if (text.length === 0) {
      ignoredSk.push("Prázdny text som neprijal — text sa nikdy nevymýšľa ani nedopĺňa.");
    } else if (text.length > 240) {
      ignoredSk.push("Text je dlhší než 240 znakov — nechal som pôvodný (dlhý text sa do obrazu nezmestí).");
    } else {
      const before = typeof payload.typographyText === "string" ? String(payload.typographyText) : "";
      if (before !== text) {
        applyToBoth("typographyText", text);
        changedSk.push(`text: „${before}" → „${text}"`);
      }
    }
  }

  // 2) Priblíženie — clamp na rozumný rozsah (nikdy 5× zoom).
  if (edit.punchInScale !== undefined) {
    const raw = Number(edit.punchInScale);
    if (!Number.isFinite(raw)) {
      ignoredSk.push("Priblíženie nebolo číslo — nechal som pôvodné.");
    } else {
      const clamped = Math.min(1.6, Math.max(1.0, Math.round(raw * 100) / 100));
      if (clamped !== raw) ignoredSk.push(`Priblíženie som upravil na bezpečný rozsah 1,00–1,60 (zadal si ${fmtNum(raw)}).`);
      const before = typeof payload.punchInScale === "number" ? Number(payload.punchInScale) : undefined;
      if (before !== clamped) {
        applyToBoth("punchInScale", clamped);
        changedSk.push(`priblíženie: ${before === undefined ? "—" : fmtNum(before)} → ${fmtNum(clamped)}`);
      }
    }
  }

  // 3) Druh pohybu.
  if (edit.motion !== undefined) {
    const allowed: MotionKind[] = ["pop", "slide", "punch", "paper_movement", "subtle_zoom", "whip_transition"];
    if (!allowed.includes(edit.motion)) {
      ignoredSk.push(`Pohyb „${String(edit.motion)}" nepoznám — nechal som pôvodný.`);
    } else if (payload.motion !== edit.motion) {
      const before = String(payload.motion ?? "—");
      applyToBoth("motion", edit.motion);
      changedSk.push(`pohyb: ${before} → ${edit.motion}`);
    }
  }

  // 4) Typ podporného prvku — generovaný vizuál sa NIKDY neprijme (provider neexistuje).
  if (edit.elementType !== undefined) {
    if (edit.elementType === "generated_visual") {
      ignoredSk.push(`${GENERATED_VISUALS_STATUS_SK} Generovaný prvok neprijímam (ani na požiadanie).`);
    } else if (payload.elementType !== edit.elementType) {
      const before = String(payload.elementType ?? "—");
      applyToBoth("elementType", edit.elementType);
      changedSk.push(`typ prvku: ${before} → ${edit.elementType}`);
    }
  }

  // 5) Kompozícia.
  if (edit.composition !== undefined) {
    const allowed: CompositionKind[] = ["full_screen", "split", "layered_collage", "picture_in_picture", "asymmetric"];
    if (!allowed.includes(edit.composition)) {
      ignoredSk.push(`Kompozíciu „${String(edit.composition)}" nepoznám — nechal som pôvodnú.`);
    } else if (payload.composition !== edit.composition) {
      const before = String(payload.composition ?? "—");
      applyToBoth("composition", edit.composition);
      changedSk.push(`kompozícia: ${before} → ${edit.composition}`);
    }
  }

  if (changedSk.length > 0) {
    // Dôkaz o úprave ide do rozhodnutia — aby bolo vidieť, že hodnoty zadal človek, nie AI.
    const note = typeof edit.noteSk === "string" && edit.noteSk.trim().length > 0 ? ` Poznámka: ${edit.noteSk.trim()}` : "";
    detail.evidenceSk = [
      ...(detail.evidenceSk ?? []),
      `Upravené používateľom v Review (nie AI, nie odhad): ${changedSk.join("; ")}.${note}`,
    ];
    detail.whySk = `${detail.whySk} (Hodnoty upravené používateľom pred aplikovaním.)`;
  }

  return { decision: next, changedSk, ignoredSk };
}


export function styleApplyCanRunSk(plan: StylePlan | null, selectedCount: number, consentGiven: boolean): { ready: boolean; reasonSk: string } {
  if (!plan || plan.decisions.length === 0) {
    return { ready: false, reasonSk: "Nie je čo aplikovať — plán je prázdny." };
  }
  if (selectedCount === 0) {
    return { ready: false, reasonSk: "Vyber aspoň jedno rozhodnutie (Súhlasím), alebo použi „Vybrať všetky“." };
  }
  if (!consentGiven) {
    return { ready: false, reasonSk: "Potvrď, že rozumieš: aplikovaním sa zmení projekt (a vznikne verzia na vrátenie)." };
  }
  return { ready: true, reasonSk: "Pripravené — najprv vznikne verzia, potom sa zmení projekt." };
}

export function applyStylePlan(host: StyleApplyHost, plan: StylePlan, options: StyleApplyOptions = {}): StyleApplyReport {
  const now = Number.isFinite(options.now) ? Number(options.now) : Date.now();
  const selected = new Set(options.decisionIds ?? plan.decisions.map((d) => d.id));
  const recipes = getStyleRecipe(plan.recipeId);

  const before = fingerprintStyleState(host.getProject());
  const notesSk: string[] = [];
  const steps: StyleApplyStep[] = [];

  // --- 1. Snapshot (bez neho sa neaplikuje) --------------------------------
  const snapshotLabelSk = options.snapshotLabelSk ?? `Style Studio Apply — ${plan.recipeLabelSk || plan.recipeName}`;
  const snapshotOk = host.createProjectVersion(
    snapshotLabelSk,
    `Automatická záloha pred aplikovaním ${selected.size} rozhodnutí Style Studia (recept ${plan.recipeId}).`,
  );
  const afterSnapshot = host.getProject();
  const snapshotVersionId = (afterSnapshot.versions ?? [])[(afterSnapshot.versions ?? []).length - 1]?.id ?? null;

  if (!snapshotOk || !snapshotVersionId) {
    return {
      ok: false,
      errorSk: "Nepodarilo sa vytvoriť verziu projektu — preto som nič neaplikoval (bez možnosti vrátenia sa neaplikuje).",
      planId: plan.id,
      recipeId: plan.recipeId,
      snapshotVersionId: null,
      snapshotLabelSk,
      steps: [],
      appliedCount: 0,
      honoredCount: 0,
      skippedCount: 0,
      timelineChanged: false,
      before,
      after: before,
      audioPreserved: true,
      audioNoteSk: "Audio sa nedotklo (nič sa neaplikovalo).",
      notesSk: ["Snapshot zlyhal → žiadna zmena projektu."],
      provider: "NONE",
      createdAt: now,
    };
  }

  const project0 = host.getProject();
  const captionTrackId = firstTrackOfType(project0, "caption")?.id ?? null;
  const brollTrackId = firstTrackOfType(project0, "b-roll")?.id ?? null;
  const avoidAssetId = assetOfMainVideo(project0);

  // Ochranné rozsahy (rečník má ostať vidieť) — Apply ich musí rešpektovať.
  // Text je zakázaný len tam, kde to ochranné rozhodnutie výslovne hovorí
  // (emocionálna veta); hook naopak krátky titulok priamo pripúšťa.
  const protectedRanges = plan.decisions
    .filter((d) => d.style?.kind === "talking_head")
    .map((d) => ({
      start: d.style!.whenSk.startSec,
      end: d.style!.whenSk.endSec,
      blocksTypography: d.style!.action?.allowTypography !== true,
    }));

  const overlapsProtected = (start: number, end: number) => protectedRanges.some((r) => start < r.end && end > r.start);
  const overlapsTypographyLock = (start: number, end: number) =>
    protectedRanges.some((r) => r.blocksTypography && start < r.end && end > r.start);

  /** Idempotencia: klip s tým istým ID už v projekte je → nepridávam druhý. */
  const clipExists = (project: ProjectModel, clipId: string) =>
    (project.tracks ?? []).some((t) => t.clips.some((c) => c.id === clipId));

  // --- 2. Aplikovanie po rozhodnutiach -------------------------------------
  for (const rawDecision of plan.decisions) {
    if (!selected.has(rawDecision.id)) continue;
    // Review (krok 16): ak človek rozhodnutie upravil, aplikujú sa JEHO hodnoty.
    // Nevybrané (rejected) rozhodnutia sa sem vôbec nedostanú → žiadna zmena canonical osi.
    const review = reviewStyleDecision(rawDecision, options.edits?.[rawDecision.id]);
    if (review.changedSk.length > 0) {
      notesSk.push(`Rozhodnutie ${rawDecision.id} som aplikoval s TVOJIMI hodnotami: ${review.changedSk.join("; ")}.`);
    }
    for (const ignored of review.ignoredSk) notesSk.push(`Rozhodnutie ${rawDecision.id}: ${ignored}`);
    const decision = review.decision;
    const detail = decision.style;
    if (!detail) {
      steps.push(skipStep(decision, "Rozhodnutie nemá vizuálny detail (starý formát) — neaplikujem naslepo.", "nothing", "—"));
      continue;
    }
    const { startSec, endSec } = detail.whenSk;
    const payload = (decision.actionPayload ?? {}) as Record<string, unknown>;

    // Vždy: rozhodnutie sa zapíše do projektu (auditovateľnosť cez existujúci command).
    const appliedNow = { value: false };
    const recordDecision = (status: EditDecision["status"]) => {
      const success = host.createEditDecision({ ...cloneDecision(decision), timestamp: now, status });
      if (!success) notesSk.push(`Rozhodnutie ${decision.id} sa nepodarilo zapísať do projektu (CommandManager vrátil false).`);
      return success;
    };

    /**
     * Zapíše rozhodnutie po vykonanej zmene. Keď sa zápis nepodarí, appka zmenu **vráti**
     * (`undoLastCommand`) — v projekte tak nikdy neostane zmena bez záznamu.
     * Keď host undo nepodporuje, appka to **prizná** (žiadne tiché prejdenie).
     */
    const recordOrRevert = (status: EditDecision["status"]): boolean => {
      if (recordDecision(status)) return true;
      const reverted = host.undoLastCommand ? host.undoLastCommand() : false;
      notesSk.push(
        reverted
          ? `Rozhodnutie ${decision.id}: zmenu som VRÁTIL — nepodarilo sa zapísať rozhodnutie (žiadna zmena potichu).`
          : `Rozhodnutie ${decision.id}: rozhodnutie sa nepodarilo zapísať a host nevie vrátiť zmenu — upozorňujem na to (zmena môže ostať bez záznamu).`,
      );
      return false;
    };

    switch (detail.kind) {
      // --- Ochranné pravidlo: rečník zostáva v obraze -----------------------
      case "talking_head": {
        recordDecision("applied");
        steps.push({
          decisionId: decision.id,
          kind: "talking_head",
          status: "HONORED",
          statusLabelSk: STATUS_LABEL_SK.HONORED,
          whatSk: detail.whatSk,
          reasonSk: `V rozsahu ${startSec}–${endSec} s som nepridal žiadny podporný vizuál ani text — rečník zostáva bez prekrytia.`,
          effect: "decision_recorded_only",
          targetSk: "video track (bez zmeny)",
        });
        continue;
      }

      // --- Text v obraze (existujúca caption stopa) ------------------------
      case "typography": {
        const text = typeof payload.typographyText === "string" ? payload.typographyText : "";
        if (!captionTrackId) {
          recordDecision("proposed");
          steps.push(skipStep(decision, "Projekt nemá stopu tituliek (caption) — text nemám kam položiť. Pridaj stopu a skús znova.", "nothing", "—"));
          continue;
        }
        if (!text) {
          recordDecision("proposed");
          steps.push(skipStep(decision, "Rozhodnutie nemá text (chýbal v pláne) — nič som nedopísal, text sa nikdy nevymýšľa.", "nothing", "—"));
          continue;
        }
        if (overlapsTypographyLock(startSec, endSec)) {
          recordDecision("proposed");
          steps.push(skipStep(decision, "V tomto čase má byť rečník bez prekrytia (ochranné rozhodnutie) — text som nepridal.", "nothing", "—"));
          continue;
        }
        const styleId = recipes.captionStyle.styleId;
        const captionClipId = `style_caption_${hashId(decision.id)}`;
        if (clipExists(host.getProject(), captionClipId)) {
          recordDecision("applied");
          steps.push({
            ...skipStep(decision, "Tento text je v projekte už z predošlého aplikovania (rovnaké ID klipu) — nepridávam druhýkrát.", "nothing", `caption clip ${captionClipId}`),
            alreadyApplied: true,
          });
          continue;
        }
        const clip = createCanonicalClip({
          id: captionClipId,
          trackId: captionTrackId,
          type: "caption",
          name: `Style Studio: ${text.slice(0, 24)}`,
          timelineStart: startSec,
          duration: Math.max(0.4, endSec - startSec),
          textConfig: {
            content: text,
            fontFamily: "Inter, sans-serif",
            fontSize: 28,
            color: "#ffffff",
            backgroundColor: "rgba(0,0,0,0.72)",
            textAlign: "center",
            fontWeight: "800",
          },
          captionStyle: {
            font: "Inter, sans-serif",
            fontSize: 28,
            color: "#ffffff",
            backgroundColor: "rgba(0,0,0,0.72)",
            alignment: "center",
            position: "bottom",
            maxCharsPerLine: 24,
            maxLines: 2,
            preset: CAPTION_PRESET_BY_STYLE[styleId] ?? "clean",
          },
        });
        const ok = host.addClip(captionTrackId, clip);
        if (ok) {
          if (!recordOrRevert("applied")) {
            steps.push(skipStep(decision, "Titulok sa podarilo pridať, ale rozhodnutie sa nepodarilo zapísať — text som preto vrátil (zmena bez záznamu sa nepočíta).", "nothing", `caption clip ${captionClipId}`));
            continue;
          }
          appliedNow.value = true;
          steps.push({
            decisionId: decision.id,
            kind: "typography",
            status: "APPLIED",
            statusLabelSk: STATUS_LABEL_SK.APPLIED,
            whatSk: `Pridal som text „${text}“ na stopu tituliek (${startSec}–${endSec} s).`,
            reasonSk: `Text je doslovne z vety, štýl podľa receptu (${styleId} → preset „${CAPTION_PRESET_BY_STYLE[styleId] ?? "clean"}“).`,
            effect: "clip_added",
            targetSk: `caption track „${captionTrackId}“`,
          });
        } else {
          recordDecision("proposed");
          steps.push(skipStep(decision, "CommandManager pridal text odmietol (stopa je zamknutá alebo neexistuje).", "nothing", "—"));
        }
        continue;
      }

      // --- Pohyb (transformácia existujúceho klipu) ------------------------
      case "motion": {
        const punch = typeof payload.punchInScale === "number" ? payload.punchInScale : undefined;
        if (!punch) {
          recordDecision("proposed");
          steps.push(skipStep(decision, "Pohyb nemá konkrétnu hodnotu (napr. priblíženie) — neaplikujem nič naslepo.", "nothing", "—"));
          continue;
        }
        const clip = clipAt(project0, "video", startSec, endSec);
        if (!clip) {
          recordDecision("proposed");
          steps.push(skipStep(decision, "V tomto čase nie je na hlavnej video stope žiadny klip — nemám čo priblížiť.", "nothing", "—"));
          continue;
        }
        const targetScale = Math.round(punch * 100);
        if (Number(clip.scale) === targetScale) {
          recordDecision("proposed");
          steps.push(skipStep(decision, `Klip už má priblíženie ${targetScale} % — nemá zmysel meniť to isté znova.`, "nothing", `video clip ${clip.id}`));
          continue;
        }
        const ok = host.setTransform(clip.id, { scale: targetScale });
        if (ok) {
          if (!recordOrRevert("applied")) {
            steps.push(skipStep(decision, "Transformáciu sa podarilo zmeniť, ale rozhodnutie sa nepodarilo zapísať — priblíženie som preto vrátil (zmena bez záznamu sa nepočíta).", "nothing", `video clip ${clip.id}`));
            continue;
          }
          appliedNow.value = true;
          steps.push({
            decisionId: decision.id,
            kind: "motion",
            status: "APPLIED",
            statusLabelSk: STATUS_LABEL_SK.APPLIED,
            whatSk: `Nastavil som priblíženie ${targetScale} % na klip v čase ${startSec}–${endSec} s.`,
            reasonSk: detail.whySk,
            effect: "transform_changed",
            targetSk: `video clip ${clip.id}`,
          });
        } else {
          recordDecision("proposed");
          steps.push(skipStep(decision, "CommandManager transformáciu odmietol.", "nothing", `video clip ${clip.id}`));
        }
        continue;
      }

      // --- Podporný vizuál (len z existujúcich médií) ----------------------
      case "supporting_visual": {
        const element = payload.elementType as string | undefined;
        if (element === "generated_visual") {
          recordDecision("proposed");
          steps.push(
            skipStep(
              decision,
              `${GENERATED_VISUALS_STATUS_SK} Generovaný prvok som nepridal a ani nepredstieram, že existuje.`,
              "nothing",
              "—",
            ),
          );
          continue;
        }
        if (!brollTrackId) {
          recordDecision("proposed");
          steps.push(skipStep(decision, "Projekt nemá b-roll stopu — vizuál nemám kam položiť.", "nothing", "—"));
          continue;
        }
        if (overlapsProtected(startSec, endSec)) {
          recordDecision("proposed");
          steps.push(skipStep(decision, "V tomto čase má byť rečník bez prekrytia (ochranné rozhodnutie) — podporný vizuál som nepridal.", "nothing", "—"));
          continue;
        }
        const asset = pickSupportingAsset(project0, avoidAssetId);
        if (!asset) {
          // Žiadne médium → vizuál sa NEPRIDÁ. Pridám len marker, aby miesto nezaniklo.
          const marker: MarkerModel = {
            id: `style_marker_${hashId(decision.id)}`,
            time: startSec,
            label: `Podporný vizuál: ${elementLabelSk((element ?? "existing_media") as never)}`,
            color: "#f59e0b",
            notes: `${detail.whatSk}\nPREČO: ${detail.whySk}\n(Poznámka Style Studio: vizuál sa NEpridal — v projekte nie je žiadne podporné médium.)`,
            category: "ai_suggestion",
          };
          const ok = host.addMarker(marker);
          recordDecision("proposed");
          appliedNow.value = false;
          steps.push({
            decisionId: decision.id,
            kind: "supporting_visual",
            status: "SKIPPED",
            statusLabelSk: STATUS_LABEL_SK.SKIPPED,
            whatSk: detail.whatSk,
            reasonSk: ok
              ? "V projekte nie je žiadne podporné médium (obrázok/video) → vizuál som NEpridal. Pridal som len marker, aby miesto nezaniklo; keď médium nahráš, daj prepočítať a aplikovať znova."
              : "V projekte nie je žiadne podporné médium → vizuál som nepridal a ani marker sa nepodarilo pridať.",
            effect: ok ? "marker_added" : "nothing",
            targetSk: ok ? `marker @ ${startSec} s` : "—",
          });
          continue;
        }
        const dur = Math.max(0.4, Math.min(endSec - startSec, asset.duration > 0 ? asset.duration : endSec - startSec));
        const visualClipId = `style_visual_${hashId(decision.id)}`;
        if (clipExists(host.getProject(), visualClipId)) {
          recordDecision("applied");
          steps.push({
            ...skipStep(decision, "Tento vizuál je v projekte už z predošlého aplikovania (rovnaké ID klipu) — nepridávam druhýkrát.", "nothing", `b-roll clip ${visualClipId}`),
            alreadyApplied: true,
          });
          continue;
        }
        const clip = createCanonicalClip({
          id: visualClipId,
          trackId: brollTrackId,
          type: asset.type === "image" ? "image" : "video",
          assetId: asset.id,
          name: `Style Studio: ${elementLabelSk((element ?? "existing_media") as never)}`,
          timelineStart: startSec,
          duration: dur,
          sourceStart: 0,
        });
        const ok = host.addClip(brollTrackId, clip);
        if (ok) {
          if (!recordOrRevert("applied")) {
            steps.push(skipStep(decision, "Vizuál sa podarilo vložiť, ale rozhodnutie sa nepodarilo zapísať — vloženie som preto vrátil (zmena bez záznamu sa nepočíta).", "nothing", `b-roll clip ${visualClipId}`));
            continue;
          }
          appliedNow.value = true;
          steps.push({
            decisionId: decision.id,
            kind: "supporting_visual",
            status: "APPLIED",
            statusLabelSk: STATUS_LABEL_SK.APPLIED,
            whatSk: `Vložil som existujúce médium „${asset.name}“ na b-roll stopu (${startSec}–${Math.round((startSec + dur) * 100) / 100} s).`,
            reasonSk: detail.whySk,
            effect: "clip_added",
            targetSk: `b-roll track „${brollTrackId}“ + médium ${asset.id}`,
          });
        } else {
          recordDecision("proposed");
          steps.push(skipStep(decision, "CommandManager vloženie vizuálu odmietol.", "nothing", `b-roll track „${brollTrackId}“`));
        }
        continue;
      }

      // --- Kompozícia (nemá čo meniť bez prvkov) ---------------------------
      case "composition": {
        recordDecision("proposed");
        steps.push(
          skipStep(
            decision,
            "Kompozícia sa prejaví až s prvkami v obraze — sám záber nemám čím preložiť, preto som nič nemenil (zostáva zapísané ako pravidlo pre tento úsek).",
            "decision_recorded_only",
            "—",
          ),
        );
        continue;
      }

      default: {
        recordDecision("proposed");
        steps.push(skipStep(decision, "Neznámy druh rozhodnutia — neaplikujem.", "nothing", "—"));
      }
    }
    void appliedNow;
  }

  // --- 3. Overenie: audio a časová os -------------------------------------
  const project1 = host.getProject();
  const after = fingerprintStyleState(project1);
  const audioPreserved = before.audioJson === after.audioJson;
  const timelineChanged = before.visualJson !== after.visualJson;

  const appliedCount = steps.filter((s) => s.status === "APPLIED").length;
  const honoredCount = steps.filter((s) => s.status === "HONORED").length;
  const skippedCount = steps.filter((s) => s.status === "SKIPPED").length;

  if (!audioPreserved) {
    notesSk.push(
      "POZOR: zvuková časť projektu sa zmenila. To Style Studio nikdy nerobí — vráť verziu tlačidlom „Vrátiť späť (rollback)“. " +
        "Táto veta je kontrola, nie sľub: porovnávam presné bajty zvukových stôp pred a po.",
    );
  }
  notesSk.push(GENERATED_VISUALS_STATUS_SK);
  notesSk.push("Provider: žiadny (deterministické, lokálne). AI sa na Apply nepoužíva.");

  return {
    ok: true,
    errorSk: null,
    planId: plan.id,
    recipeId: plan.recipeId,
    snapshotVersionId,
    snapshotLabelSk,
    steps,
    appliedCount,
    honoredCount,
    skippedCount,
    timelineChanged,
    before,
    after,
    audioPreserved,
    audioNoteSk: audioPreserved
      ? "Zvuk je nedotknutý: zvukové stopy aj zvukové médiá sú pred aj po aplikovaní presne rovnaké."
      : "Zvuk sa líši — použi rollback (verzia nižšie).",
    notesSk,
    provider: "NONE",
    createdAt: now,
  };
}

// ---------------------------------------------------------------------------
// Rollback
// ---------------------------------------------------------------------------

export function rollbackStyleApply(host: StyleApplyHost, report: StyleApplyReport): StyleRollbackReport {
  if (!report.snapshotVersionId) {
    return {
      ok: false,
      errorSk: "Report nemá ID verzie — nemám sa kam vrátiť.",
      snapshotVersionId: "",
      restoredExactly: false,
      timelineRestoredSk: "Bez zmeny.",
      audioRestoredSk: "Bez zmeny.",
    };
  }
  const ok = host.restoreProjectVersion(report.snapshotVersionId);
  const now = fingerprintStyleState(host.getProject());
  const restoredExactly = now.visualJson === report.before.visualJson && now.audioJson === report.before.audioJson;
  return {
    ok,
    errorSk: ok ? null : "CommandManager vrátenie verzie odmietol (verzia sa nenašla).",
    snapshotVersionId: report.snapshotVersionId,
    restoredExactly,
    timelineRestoredSk: restoredExactly
      ? "Obrazová časť je presne v stave pred aplikovaním (rovnaké klipy, markery aj rozhodnutia)."
      : "Obrazová časť sa líši od stavu pred aplikovaním — skontroluj to.",
    audioRestoredSk: now.audioJson === report.before.audioJson ? "Zvuk ostal nezmenený." : "Zvuk sa líši.",
  };
}

// ---------------------------------------------------------------------------
// Textový výstup pre človeka
// ---------------------------------------------------------------------------

export function styleApplyReportTextSk(report: StyleApplyReport): string {
  const lines: string[] = [];
  lines.push(`STYLE STUDIO — APPLY (${new Date(report.createdAt).toISOString()})`);
  lines.push(`Plán: ${report.planId} | recept: ${report.recipeId}`);
  lines.push(`Verzia pred zmenou: ${report.snapshotVersionId ?? "—"} (${report.snapshotLabelSk})`);
  lines.push(`Aplikované: ${report.appliedCount} | dodržané: ${report.honoredCount} | nevykonané: ${report.skippedCount}`);
  lines.push(`Zmenila sa časová os? ${report.timelineChanged ? "áno" : "nie"}`);
  lines.push(`Klipy (video / b-roll / titulky) pred: ${report.before.videoClips} / ${report.before.brollClips} / ${report.before.captionClips}`);
  lines.push(`Klipy (video / b-roll / titulky) po:   ${report.after.videoClips} / ${report.after.brollClips} / ${report.after.captionClips}`);
  lines.push(`Markery pred/po: ${report.before.markers} / ${report.after.markers}`);
  lines.push(`Rozhodnutia v projekte pred/po: ${report.before.decisions} / ${report.after.decisions}`);
  lines.push(`Audio: ${report.audioPreserved ? "NEDOTKNUTÉ" : "ZMENA — použi rollback"}`);
  lines.push("");
  for (const s of report.steps) {
    lines.push(`• [${s.status}] ${s.kind} — ${s.whatSk}`);
    if (s.status !== "APPLIED") lines.push(`   dôvod: ${s.reasonSk}`);
    if (s.status === "HONORED") {
      lines.push("   v projekte je vedené ako aplikované (ochranné pravidlo dodržané — appka sem nič nepridala)");
    }
    if (s.alreadyApplied) lines.push("   efekt v projekte už existoval z predošlého aplikovania");
    lines.push(`   cieľ: ${s.targetSk}`);
  }
  lines.push("");
  lines.push(...report.notesSk.map((n) => `• ${n}`));
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Pomocníci
// ---------------------------------------------------------------------------

function cloneDecision(decision: EditDecision): EditDecision {
  return JSON.parse(JSON.stringify(decision)) as EditDecision;
}

function skipStep(decision: EditDecision, reasonSk: string, effect: StyleCanonicalEffect, targetSk: string): StyleApplyStep {
  const detail = decision.style;
  return {
    decisionId: decision.id,
    kind: (detail?.kind ?? "supporting_visual") as StyleDecisionKind,
    status: "SKIPPED",
    statusLabelSk: STATUS_LABEL_SK.SKIPPED,
    whatSk: detail?.whatSk ?? decision.reason,
    reasonSk,
    effect,
    targetSk,
  };
}

/** Krátke, stabilné ID z ID rozhodnutia (aby opakovaný Apply nevytváral duplicitné ID). */
function hashId(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { coreEngine, createInitialProject } from "../src/core";
import {
  applyStylePlan,
  fingerprintStyleState,
  pickSupportingAsset,
  rollbackStyleApply,
  styleApplyCanRunSk,
  styleApplyReportTextSk,
} from "../src/core/style/styleApply";
import { buildStylePlan } from "../src/core/style/styleIntelligence";
import { getStyleRecipe } from "../src/core/style/styleRecipes";
import type { MediaAsset, ProjectModel } from "../src/core/types/project";
import { STYLE_FIXTURE_NOW, STYLE_FIXTURE_SEGMENTS } from "./fixtures/styleFixture";

/**
 * KROK 5–6 (apply / snapshot / rollback) — **unit + integration test verification**
 * cez **reálny `CoreEngine` a reálny `CommandManager`** (žiadne mocky commandov).
 *
 * Čo to dokazuje: že sa canonical projekt naozaj mení, že snapshot vzniká pred
 * zmenou a že rollback vráti presne pôvodný stav (porovnanie JSON bajtov).
 * Čo to NEDOKAZUJE: že to tak funguje v prehliadači na reálnom videe
 * (browser / real-media verification) — to je samostatná vec a hlásim ju ako NOT VERIFIED.
 */

const NOW = STYLE_FIXTURE_NOW;

function freshProject(title = "Style Apply Test"): ProjectModel {
  const project = createInitialProject(title);
  coreEngine.commandManager.setProject(project);
  return project;
}

function plan(recipeId: "EDITORIAL_COLLAGE" | "UGC_PERFORMANCE" | "MINIMAL" = "EDITORIAL_COLLAGE") {
  return buildStylePlan({
    segments: STYLE_FIXTURE_SEGMENTS,
    recipe: getStyleRecipe(recipeId),
    durationSec: 14,
    availableSupportingVisuals: 6,
    now: NOW,
  });
}

/** Médium „naozaj existuje“ — takto vyzerá reálny záznam v projektovej knižnici. */
function mediaAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "asset_photo_1",
    name: "graf-tržieb.png",
    type: "image",
    opfsPath: "/assets/graf-tržieb.png",
    size: 24_000,
    mimeType: "image/png",
    duration: 0,
    width: 1080,
    height: 1080,
    fps: 0,
    createdAt: NOW - 1000,
    ...overrides,
  } as MediaAsset;
}

function withAssets(project: ProjectModel, assets: MediaAsset[]): ProjectModel {
  const next = { ...project, assets: [...(project.assets ?? []), ...assets] } as ProjectModel;
  coreEngine.commandManager.setProject(next);
  return next;
}

const captionClips = () => coreEngine.getProject().tracks.filter((t) => t.type === "caption").flatMap((t) => t.clips);
const brollClips = () => coreEngine.getProject().tracks.filter((t) => t.type === "b-roll").flatMap((t) => t.clips);
const videoClips = () => coreEngine.getProject().tracks.filter((t) => t.type === "video").flatMap((t) => t.clips);
const markers = () => coreEngine.getProject().markers ?? [];
const decisions = () => coreEngine.getProject().editDecisions ?? [];
const versions = () => coreEngine.getProject().versions ?? [];

let originalFetch: typeof globalThis.fetch;
beforeEach(() => {
  freshProject();
  originalFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("Apply nesmie volať sieť ani AI providera");
  }) as typeof globalThis.fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ---------------------------------------------------------------------------

describe("5) snapshot PRED zmenou (bez snapshotu sa neaplikuje)", () => {
  test("apply najprv vytvorí verziu projektu a tá nesie stav PRED zmenou", () => {
    const report = applyStylePlan(coreEngine, plan(), { now: NOW });
    expect(report.ok).toBe(true);
    expect(report.snapshotVersionId).toBeTruthy();
    expect(versions()).toHaveLength(1);

    const snapshot = versions()[0].snapshot as ProjectModel;
    expect(snapshot.tracks.filter((t) => t.type === "caption").flatMap((t) => t.clips)).toHaveLength(0);
    expect((snapshot.editDecisions ?? []).length).toBe(0);
    // a projekt po zmene už zmenený JE
    expect(captionClips().length).toBeGreaterThan(0);
  });

  test("keď snapshot zlyhá, nič sa nezmení a appka to povie", () => {
    const failing = {
      getProject: () => coreEngine.getProject(),
      createProjectVersion: () => false,
      restoreProjectVersion: () => false,
      createEditDecision: () => {
        throw new Error("nesmie sa zavolať");
      },
      addMarker: () => {
        throw new Error("nesmie sa zavolať");
      },
      addClip: () => {
        throw new Error("nesmie sa zavolať");
      },
      setTransform: () => {
        throw new Error("nesmie sa zavolať");
      },
    };
    const report = applyStylePlan(failing, plan(), { now: NOW });
    expect(report.ok).toBe(false);
    expect(report.errorSk).toMatch(/bez možnosti vrátenia sa neaplikuje/i);
    expect(captionClips()).toHaveLength(0);
    expect(decisions()).toHaveLength(0);
    expect(report.timelineChanged).toBe(false);
  });
});

describe("5) APPLIED = skutočná zmena canonical projektu", () => {
  test("text v obraze sa naozaj vloží na stopu tituliek — s presným textom z vety", () => {
    const p = plan();
    const typo = p.decisions.filter((d) => d.style?.kind === "typography");
    expect(typo.length).toBeGreaterThan(0);

    const report = applyStylePlan(coreEngine, p, { now: NOW });
    expect(report.appliedCount).toBeGreaterThan(0);

    const clips = captionClips();
    expect(clips.length).toBe(typo.filter((t) => report.steps.find((s) => s.decisionId === t.id)?.status === "APPLIED").length);
    for (const clip of clips) {
      const expected = typo.map((t) => String((t.actionPayload as Record<string, unknown>).typographyText));
      expect(expected).toContain(String(clip.textConfig?.content));
      expect(clip.trackId).toBe("track_caption");
    }
  });

  test("pohyb sa naozaj zapíše do transformácie existujúceho video klipu", () => {
    const p = plan();
    // do projektu vložíme reálny video klip (ako keby tam bolo nahrané médium)
    const videoTrack = coreEngine.getProject().tracks.find((t) => t.type === "video")!;
    coreEngine.addClip(videoTrack.id, {
      id: "clip_main",
      trackId: videoTrack.id,
      type: "video",
      name: "Hlavné video",
      timelineStart: 0,
      start: 0,
      sourceStart: 0,
      sourceEnd: 20,
      duration: 20,
      offset: 0,
      speed: 1,
      volume: 100,
      scale: 100,
      opacity: 100,
      positionX: 0,
      positionY: 0,
      rotation: 0,
      keyframes: [],
    } as never);
    expect(videoClips()).toHaveLength(1);

    const motion = p.decisions.find((d) => d.style?.kind === "motion")!;
    const report = applyStylePlan(coreEngine, p, { now: NOW, decisionIds: [motion.id] });
    const step = report.steps[0];
    expect(step.status).toBe("APPLIED");
    expect(step.effect).toBe("transform_changed");
    const expectedScale = Math.round(Number((motion.actionPayload as Record<string, unknown>).punchInScale) * 100);
    expect(videoClips()[0].scale).toBe(expectedScale);
  });

  test("podporný vizuál sa vloží LEN z existujúceho média (žiadne vymyslené obrázky)", () => {
    const asset = mediaAsset();
    withAssets(coreEngine.getProject(), [asset]);
    expect(pickSupportingAsset(coreEngine.getProject(), undefined)?.id).toBe(asset.id);

    const p = plan();
    const visual = p.decisions.filter((d) => d.style?.kind === "supporting_visual");
    const report = applyStylePlan(coreEngine, p, { now: NOW });
    const appliedVisuals = report.steps.filter((s) => s.kind === "supporting_visual" && s.status === "APPLIED");
    expect(appliedVisuals.length).toBeGreaterThan(0);

    const clips = brollClips();
    expect(clips.length).toBe(appliedVisuals.length);
    for (const clip of clips) {
      expect(clip.assetId).toBe(asset.id); // ← presne to médium, ktoré v projekte existuje
      expect(clip.trackId).toBe("track_broll");
    }
    expect(visual.length).toBeGreaterThan(0);
  });

  test("bez média vizuál NEpridá a appka to nepovie ako „aplikované“", () => {
    const p = plan();
    const report = applyStylePlan(coreEngine, p, { now: NOW });
    const visualSteps = report.steps.filter((s) => s.kind === "supporting_visual");
    expect(visualSteps.length).toBeGreaterThan(0);
    for (const s of visualSteps) {
      expect(s.status).toBe("SKIPPED");
      expect(s.reasonSk).toMatch(/vizuál som NEpridal|médium/i);
    }
    expect(brollClips()).toHaveLength(0); // ← žiadny fake vizuál v časovej osi
    expect(markers().length).toBe(visualSteps.filter((s) => s.effect === "marker_added").length);
  });
});

describe("5) ochranné pravidlá (rečník zostáva v obraze) sa naozaj dodržia", () => {
  test("podporný vizuál sa neaplikuje do času, ktorý má ostať bez prekrytia", () => {
    withAssets(coreEngine.getProject(), [mediaAsset()]);
    const p = plan();
    const protectedRange = p.decisions.find((d) => d.style?.kind === "talking_head")!.style!.whenSk;
    const report = applyStylePlan(coreEngine, p, { now: NOW });
    const applied = report.steps.filter((s) => s.status === "APPLIED" && s.kind !== "talking_head");
    for (const step of applied) {
      const decision = p.decisions.find((d) => d.id === step.decisionId)!;
      const { startSec, endSec } = decision.style!.whenSk;
      const overlaps = startSec < protectedRange.endSec && endSec > protectedRange.startSec;
      if (step.kind === "supporting_visual") expect(overlaps).toBe(false);
    }
    expect(report.honoredCount).toBe(1);
  });

  test("hook pripúšťa krátky text (emócia nie) — a je to vidieť v pláne aj v apply", () => {
    const p = plan();
    const guard = p.decisions.find((d) => d.style?.kind === "talking_head")!;
    expect(guard.style!.action.allowTypography).toBe(true);
    const report = applyStylePlan(coreEngine, p, { now: NOW, decisionIds: [guard.id] });
    expect(report.steps[0].status).toBe("HONORED");
    expect(report.steps[0].reasonSk).toMatch(/nechal.*bez prekrytia|nepridal/i);
  });
});

describe("5) audio je nedotknuté (a je to overené, nie sľúbené)", () => {
  test("apply nesiaha na zvukové stopy ani na zvukové médiá", () => {
    // do projektu dáme reálny zvukový klip aj zvukové médium
    const audioTrack = coreEngine.getProject().tracks.find((t) => t.type === "audio")!;
    coreEngine.addClip(audioTrack.id, {
      id: "clip_vo",
      trackId: audioTrack.id,
      type: "audio",
      name: "Voiceover",
      timelineStart: 0,
      start: 0,
      sourceStart: 0,
      sourceEnd: 14,
      duration: 14,
      offset: 0,
      speed: 1,
      volume: 100,
      scale: 100,
      opacity: 100,
      positionX: 0,
      positionY: 0,
      rotation: 0,
      keyframes: [],
    } as never);
    withAssets(coreEngine.getProject(), [mediaAsset({ id: "asset_audio_1", name: "hudba.mp3", type: "audio", duration: 60 })]);

    const before = fingerprintStyleState(coreEngine.getProject());
    const report = applyStylePlan(coreEngine, plan(), { now: NOW });
    const after = fingerprintStyleState(coreEngine.getProject());

    expect(report.audioPreserved).toBe(true);
    expect(after.audioJson).toBe(before.audioJson);
    expect(after.audioClips).toBe(before.audioClips);
    expect(report.audioNoteSk).toMatch(/nedotknutý/i);
  });
});

describe("6) rollback vráti presne pôvodný stav", () => {
  test("po rollbacku je projekt bajtovo v stave pred aplikovaním", () => {
    const before = fingerprintStyleState(coreEngine.getProject());
    const report = applyStylePlan(coreEngine, plan(), { now: NOW });
    expect(fingerprintStyleState(coreEngine.getProject()).visualJson).not.toBe(before.visualJson);

    const rollback = rollbackStyleApply(coreEngine, report);
    const afterRollback = fingerprintStyleState(coreEngine.getProject());
    expect(rollback.ok).toBe(true);
    expect(rollback.restoredExactly).toBe(true);
    expect(afterRollback.visualJson).toBe(before.visualJson);
    expect(afterRollback.audioJson).toBe(before.audioJson);
    expect(captionClips()).toHaveLength(0);
    expect(markers()).toHaveLength(0);
    expect(decisions()).toHaveLength(0);
  });

  test("rollback bez ID verzie nič nezmení a povie to", () => {
    const bogus = { ...applyStylePlan(coreEngine, plan(), { now: NOW }), snapshotVersionId: null };
    const projectBefore = JSON.stringify(coreEngine.getProject().tracks);
    const rollback = rollbackStyleApply(coreEngine, bogus);
    expect(rollback.ok).toBe(false);
    expect(rollback.errorSk).toMatch(/nemám sa kam vrátiť/i);
    expect(JSON.stringify(coreEngine.getProject().tracks)).toBe(projectBefore);
  });
});

describe("6) vybrané vs. nevybrané rozhodnutia (accept / reject)", () => {
  test("aplikujú sa len označené rozhodnutia", () => {
    const p = plan();
    const typo = p.decisions.filter((d) => d.style?.kind === "typography");
    expect(typo.length).toBeGreaterThan(1);
    const chosen = typo[typo.length - 1].id;

    const report = applyStylePlan(coreEngine, p, { now: NOW, decisionIds: [chosen] });
    expect(report.steps).toHaveLength(1);
    expect(report.steps[0].decisionId).toBe(chosen);
    expect(captionClips()).toHaveLength(1);
    // ostatné rozhodnutia sa do projektu nezapísali
    expect(decisions()).toHaveLength(1);
  });

  test("opakovaný apply nevloží ten istý text dvakrát (idempotencia)", () => {
    const p = plan();
    const typo = p.decisions.find((d) => d.style?.kind === "typography")!;
    const first = applyStylePlan(coreEngine, p, { now: NOW, decisionIds: [typo.id] });
    expect(first.steps[0].status).toBe("APPLIED");
    const countAfterFirst = captionClips().length;

    const second = applyStylePlan(coreEngine, p, { now: NOW, decisionIds: [typo.id] });
    expect(second.steps[0].status).toBe("SKIPPED");
    expect(second.steps[0].reasonSk).toMatch(/už z predošlého aplikovania/i);
    expect(captionClips()).toHaveLength(countAfterFirst);
  });

  test("gates povedia, kedy sa aplikovať nedá (a prečo)", () => {
    expect(styleApplyCanRunSk(null, 0, false).ready).toBe(false);
    expect(styleApplyCanRunSk(plan(), 0, true).reasonSk).toMatch(/Vyber aspoň jedno/i);
    expect(styleApplyCanRunSk(plan(), 3, false).reasonSk).toMatch(/Potvrď/i);
    expect(styleApplyCanRunSk(plan(), 3, true).ready).toBe(true);
  });
});

describe("6) poctivosť a žiadny provider", () => {
  test("generovaný vizuál sa nikdy neaplikuje (PROVIDER UNAVAILABLE)", () => {
    const p = plan();
    const visual = p.decisions.find((d) => d.style?.kind === "supporting_visual")!;
    const fakePlan = {
      ...p,
      decisions: [
        {
          ...visual,
          actionPayload: { ...(visual.actionPayload as Record<string, unknown>), elementType: "generated_visual" },
        },
      ],
    };
    const report = applyStylePlan(coreEngine, fakePlan, { now: NOW });
    expect(report.steps[0].status).toBe("SKIPPED");
    expect(report.steps[0].reasonSk).toMatch(/PROVIDER UNAVAILABLE/);
    expect(brollClips()).toHaveLength(0);
  });

  test("report nikdy netvrdí aplikovanie bez zmeny a nesie poctivé poznámky", () => {
    const report = applyStylePlan(coreEngine, plan(), { now: NOW });
    expect(report.provider).toBe("NONE");
    expect(report.notesSk.join(" ")).toMatch(/Provider: žiadny/);
    expect(report.notesSk.join(" ")).toMatch(/PROVIDER UNAVAILABLE/);
    for (const s of report.steps) {
      if (s.status === "APPLIED") expect(s.effect).not.toBe("nothing");
      if (s.status === "SKIPPED") expect(s.reasonSk.length).toBeGreaterThan(20);
    }
  });

  test("report ako text obsahuje čísla pred/po a stav audia", () => {
    const text = styleApplyReportTextSk(applyStylePlan(coreEngine, plan(), { now: NOW }));
    expect(text).toMatch(/STYLE STUDIO — APPLY/);
    expect(text).toMatch(/Klipy \(video \/ b-roll \/ titulky\) pred:/);
    expect(text).toMatch(/Klipy \(video \/ b-roll \/ titulky\) po:/);
    expect(text).toMatch(/Audio: NEDOTKNUTÉ/);
    expect(text).toMatch(/Zmenila sa časová os\? áno/);
  });

  test("rozhodnutia sa v projekte označia presne (applied vs proposed)", () => {
    const report = applyStylePlan(coreEngine, plan(), { now: NOW });
    const stored = decisions();
    expect(stored).toHaveLength(report.steps.length);
    for (const s of report.steps) {
      const record = stored.find((d) => d.id === s.decisionId)!;
      expect(record.style?.kind).toBe(s.kind);
      // „applied“ v projekte = buď vznikol efekt teraz, alebo tu už bol,
      // alebo ide o ochranné pravidlo, ktoré Apply naozaj vynútil (HONORED).
      const expectApplied = s.status === "APPLIED" || s.status === "HONORED" || s.alreadyApplied === true;
      expect(record.status).toBe(expectApplied ? "applied" : "proposed");
    }
  });
});

describe("6) existujúce mechanizmy (undo/redo) fungujú aj po Apply", () => {
  test("undo vráti poslednú zmenu z CommandManageru a redo ju vráti späť", () => {
    applyStylePlan(coreEngine, plan(), { now: NOW });
    const withApply = decisions().length;
    expect(coreEngine.commandManager.canUndo()).toBe(true);

    expect(coreEngine.undo()).toBe(true);
    expect(decisions().length).toBeLessThan(withApply);

    expect(coreEngine.redo()).toBe(true);
    expect(decisions().length).toBe(withApply);
  });
});

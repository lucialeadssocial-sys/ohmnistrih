import { describe, expect, test } from "bun:test";
import { applyStylePlan, fingerprintStyleState, reviewStyleDecision, rollbackStyleApply } from "../src/core/style/styleApply";
import { buildStylePlan } from "../src/core/style/styleIntelligence";
import type { EditDecision } from "../src/core/types/project";
import { coreEngine, createInitialProject } from "../src/core";
import type { SpeechSegmentLike } from "../src/core/transcript/wordTiming";

/**
 * Krok 16 — **Review s úpravou (Accept / Edit / Reject)** a dôkaz, že upravené
 * hodnoty sa naozaj dostanú do canonical projektu (nie iba do UI stavu).
 *
 * POZOR (reporting): toto je **UNIT TESTED**. Neznamená to, že to niekto videl
 * v prehliadači (BROWSER VERIFIED) ani že to bežalo na reálnom médiu
 * (REAL MEDIA VERIFIED — to je samostatný runner `tools/verify-style-to-timeline.ts`).
 */

const NOW = 1759219200000;

const SEGMENTS: SpeechSegmentLike[] = [
  {
    start: 0.2,
    end: 3.0,
    text: "Klient zaplatil 3000 eur za reklamu.",
    words: [
      { word: "Klient", start: 0.2, end: 0.7 },
      { word: "zaplatil", start: 0.7, end: 1.4 },
      { word: "3000", start: 1.45, end: 2.0 },
      { word: "eur", start: 2.0, end: 2.4 },
      { word: "za", start: 2.45, end: 2.6 },
      { word: "reklamu.", start: 2.6, end: 3.0 },
    ],
  },
  {
    start: 4.0,
    end: 7.4,
    text: "Potom som zaviedol strih o 70 %.",
    words: [
      { word: "Potom", start: 4.0, end: 4.5 },
      { word: "som", start: 4.5, end: 4.7 },
      { word: "zaviedol", start: 4.7, end: 5.4 },
      { word: "strih", start: 5.5, end: 5.9 },
      { word: "o", start: 5.95, end: 6.05 },
      { word: "70", start: 6.05, end: 6.6 },
      { word: "%", start: 6.6, end: 7.0 },
    ],
  },
];

/** Reálny engine (singleton) ako host pre Apply — rovnako ako v appke. */
function engine() {
  const e = coreEngine;
  const project = createInitialProject("Review/Edit test");
  e.commandManager.setProject(project);
  const videoTrack = project.tracks.find((t) => t.type === "video")!;
  const broll = project.tracks.find((t) => t.type === "b-roll");
  const caption = project.tracks.find((t) => t.type === "caption");

  e.commandManager.setProject({
    ...project,
    assets: [
      {
        id: "asset_video",
        name: "video.mp4",
        type: "video",
        opfsPath: "/local/video.mp4",
        size: 1000,
        mimeType: "video/mp4",
        duration: 10,
        width: 1080,
        height: 1920,
        fps: 30,
        createdAt: NOW,
      },
      {
        id: "asset_photo",
        name: "foto.png",
        type: "image",
        opfsPath: "/local/foto.png",
        size: 500,
        mimeType: "image/png",
        duration: 0,
        fps: 0,
        createdAt: NOW + 1,
      },
    ] as never,
  });
  e.addClip(videoTrack.id, {
    id: "clip_video",
    trackId: videoTrack.id,
    type: "video",
    assetId: "asset_video",
    name: "video.mp4",
    timelineStart: 0,
    start: 0,
    sourceStart: 0,
    sourceEnd: 10,
    duration: 10,
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
  // Uisti sa, že existujú stopy, na ktoré Apply vie položiť text a vizuál.
  if (!broll || !caption) {
    const withTracks = { ...e.getProject() };
    withTracks.tracks = [
      ...withTracks.tracks,
      ...(broll ? [] : [{ id: "track_broll_x", type: "b-roll" as const, name: "B-roll", clips: [], visible: true, locked: false, muted: false, height: 60, color: "#888" }]),
      ...(caption ? [] : [{ id: "track_caption_x", type: "caption" as const, name: "Titulky", clips: [], visible: true, locked: false, muted: false, height: 60, color: "#888" }]),
    ] as never;
    e.commandManager.setProject(withTracks);
  }
  return e;
}

function planOf(recipe = "EDITORIAL_COLLAGE") {
  return buildStylePlan({ segments: SEGMENTS, recipe, durationSec: 10, availableSupportingVisuals: 1, now: NOW });
}

/** Rozhodnutie daného druhu (aby testy nezáviseli na poradí v pláne). */
function pick(plan: ReturnType<typeof planOf>, kind: string) {
  const d = plan.decisions.find((x) => x.style?.kind === kind);
  if (!d) throw new Error(`v pláne nie je rozhodnutie druhu ${kind}`);
  return d;
}

function clipById(e: typeof coreEngine, id: string) {
  return e.getProject().tracks.flatMap((t) => t.clips).find((c) => c.id === id) ?? null;
}

function captionClips(e: typeof coreEngine) {
  return e.getProject().tracks.filter((t) => t.type === "caption").flatMap((t) => t.clips);
}

// ---------------------------------------------------------------------------
// A) reviewStyleDecision — čistá funkcia (WHAT sa naozaj zmení, WHEN nie)
// ---------------------------------------------------------------------------

describe("A) úprava rozhodnutia (čistá funkcia)", () => {
  const plan = planOf();

  test("text: prepíše sa a je v dôkazoch, že ho zadal človek (nie AI)", () => {
    const d = pick(plan, "typography");
    const r = reviewStyleDecision(d, { typographyText: "Môj text" });
    expect(r.changedSk.length).toBe(1);
    expect(r.decision.actionPayload?.typographyText).toBe("Môj text");
    expect(r.decision.style?.action?.typographyText).toBe("Môj text");
    expect(r.decision.style?.evidenceSk.join(" ")).toContain("Upravené používateľom");
    // pôvodné rozhodnutie sa NEMUTUJE
    expect(d.actionPayload?.typographyText).not.toBe("Môj text");
  });

  test("prázdny text sa neprijme (text sa nikdy nevymýšľa)", () => {
    const r = reviewStyleDecision(pick(plan, "typography"), { typographyText: "   " });
    expect(r.changedSk.length).toBe(0);
    expect(r.ignoredSk.join(" ")).toContain("nikdy nevymýšľa");
  });

  test("priblíženie mimo rozsahu sa clampne a appka to prizná", () => {
    const r = reviewStyleDecision(pick(plan, "motion"), { punchInScale: 5 });
    expect(r.decision.actionPayload?.punchInScale).toBe(1.6);
    expect(r.ignoredSk.join(" ")).toContain("bezpečný rozsah");
  });

  test("priblíženie pod 1 sa zdvihne na 1,00", () => {
    expect(reviewStyleDecision(pick(plan, "motion"), { punchInScale: 0.2 }).decision.actionPayload?.punchInScale).toBe(1);
  });

  test("nezmyselné číslo sa ignoruje a pôvodná hodnota ostáva", () => {
    const d = pick(plan, "motion");
    const r = reviewStyleDecision(d, { punchInScale: Number.NaN });
    expect(r.changedSk.length).toBe(0);
    expect(r.decision.actionPayload?.punchInScale).toBe(d.actionPayload?.punchInScale);
    expect(r.ignoredSk.join(" ")).toContain("nebolo číslo");
  });

  test("generovaný vizuál sa neprijme ani na požiadanie (PROVIDER UNAVAILABLE)", () => {
    const r = reviewStyleDecision(pick(plan, "supporting_visual"), { elementType: "generated_visual" });
    expect(r.changedSk.length).toBe(0);
    expect(r.ignoredSk.join(" ")).toContain("PROVIDER UNAVAILABLE");
  });

  test("neznámy pohyb/kompozícia sa ignorujú (žiadne tiché prijatie)", () => {
    const r = reviewStyleDecision(pick(plan, "motion"), { motion: "teleport" as never, composition: "hexagon" as never });
    expect(r.changedSk.length).toBe(0);
    expect(r.ignoredSk.length).toBe(2);
  });

  test("čas (WHEN) sa needituje — úprava nemá ako zmeniť whenSk", () => {
    const d = pick(plan, "typography");
    const r = reviewStyleDecision(d, { typographyText: "X" });
    expect(r.decision.style?.whenSk).toEqual(d.style?.whenSk);
  });

  test("determinizmus: rovnaká úprava = rovnaký výsledok", () => {
    const d = pick(plan, "typography");
    const a = reviewStyleDecision(d, { typographyText: "Rovnako", noteSk: "pozn." });
    const b = reviewStyleDecision(d, { noteSk: "pozn.", typographyText: "Rovnako" });
    expect(JSON.stringify(a.decision)).toBe(JSON.stringify(b.decision));
  });
});

// ---------------------------------------------------------------------------
// B) Úprava sa naozaj dostane do canonical projektu
// ---------------------------------------------------------------------------

describe("B) upravené hodnoty v canonical projekte", () => {
  test("upravený text je v skutočnom caption klipe (nie v UI)", () => {
    const e = engine();
    const plan = planOf();
    const text = pick(plan, "typography");
    const report = applyStylePlan(e, plan, {
      decisionIds: [text.id],
      edits: { [text.id]: { typographyText: "MOJA VLASTNÁ VETA" } },
      now: NOW,
    });
    expect(report.ok).toBe(true);
    const clips = captionClips(e);
    expect(clips.length).toBe(1);
    expect(clips[0].textConfig?.content).toBe("MOJA VLASTNÁ VETA");
    expect(report.notesSk.join(" ")).toContain("TVOJIMI hodnotami");
  });

  test("upravené priblíženie je v transformácii video klipu", () => {
    const e = engine();
    const plan = planOf();
    const motion = pick(plan, "motion");
    const report = applyStylePlan(e, plan, {
      decisionIds: [motion.id],
      edits: { [motion.id]: { punchInScale: 1.3 } },
      now: NOW,
    });
    expect(report.ok).toBe(true);
    expect(clipById(e, "clip_video")?.scale).toBe(130);
    expect(report.steps.find((s) => s.decisionId === motion.id)?.whatSk).toContain("130");
  });

  test("bez úpravy sa použije hodnota z receptu (a appka to nepovie ako tvoju)", () => {
    const e = engine();
    const plan = planOf();
    const motion = pick(plan, "motion");
    const report = applyStylePlan(e, plan, { decisionIds: [motion.id], now: NOW });
    expect(clipById(e, "clip_video")?.scale).toBe(Math.round((plan.decisions.find((d) => d.id === motion.id)!.actionPayload!.punchInScale as number) * 100));
    expect(report.notesSk.join(" ")).not.toContain("TVOJIMI hodnotami");
  });

  test("ignorovaná úprava nechá canonical presne tak, ako by bol bez úpravy", () => {
    const a = engine();
    const b = engine();
    const plan = planOf();
    const motion = pick(plan, "motion");
    applyStylePlan(a, plan, { decisionIds: [motion.id], now: NOW });
    applyStylePlan(b, plan, { decisionIds: [motion.id], edits: { [motion.id]: { punchInScale: Number.NaN } }, now: NOW });
    expect(fingerprintStyleState(a.getProject()).visualJson).toBe(fingerprintStyleState(b.getProject()).visualJson);
  });
});

// ---------------------------------------------------------------------------
// C) Review: accept / edit / reject — čo sa smie dostať do CommandManageru
// ---------------------------------------------------------------------------

describe("C) accept / edit / reject", () => {
  test("rejected rozhodnutie NEMÁ žiadnu canonical zmenu (text nevznikne, transform sa nemení)", () => {
    const e = engine();
    const plan = planOf();
    const text = pick(plan, "typography");
    const motion = pick(plan, "motion");
    const before = fingerprintStyleState(e.getProject());
    applyStylePlan(e, plan, { decisionIds: [text.id], now: NOW }); // motion je "rejected" (nie je vo výbere)
    const after = fingerprintStyleState(e.getProject());
    expect(captionClips(e).length).toBe(1); // prijaté
    expect(clipById(e, "clip_video")?.scale).toBe(100); // zamietnuté → nedotknuté
    expect(after.videoClips).toBe(before.videoClips);
  });

  test("zamietnuté rozhodnutie zostáva len v pláne (nezapíše sa do projektu)", () => {
    const e = engine();
    const plan = planOf();
    const text = pick(plan, "typography");
    applyStylePlan(e, plan, { decisionIds: [text.id], now: NOW });
    const ids = (e.getProject().editDecisions ?? []).map((d: EditDecision) => d.id);
    expect(ids).toContain(text.id);
    expect(ids.length).toBe(1);
  });

  test("prijaté s úpravou = v projekte je upravená hodnota aj záznam o úprave", () => {
    const e = engine();
    const plan = planOf();
    const text = pick(plan, "typography");
    applyStylePlan(e, plan, { decisionIds: [text.id], edits: { [text.id]: { typographyText: "Upravené", noteSk: "kratšie" } }, now: NOW });
    const rec = (e.getProject().editDecisions ?? []).find((d: EditDecision) => d.id === text.id) as EditDecision;
    expect(rec).toBeTruthy();
    expect(rec.style?.action?.typographyText).toBe("Upravené");
    expect(rec.style?.evidenceSk.join(" ")).toContain("kratšie");
  });

  test("úprava neexistujúceho rozhodnutia nič nezmení (žiadne tiché pridanie)", () => {
    const e = engine();
    const plan = planOf();
    const text = pick(plan, "typography");
    const report = applyStylePlan(e, plan, { decisionIds: [text.id], edits: { "neexistuje": { typographyText: "X" } }, now: NOW });
    expect(report.ok).toBe(true);
    expect(captionClips(e).length).toBe(1);
    expect(captionClips(e)[0].textConfig?.content).not.toBe("X");
  });
});

// ---------------------------------------------------------------------------
// D) Bezpečnosť: zlyhanie commandu / pokazené dáta → canonical ostáva v poriadku
// ---------------------------------------------------------------------------

describe("D) bezpečnosť", () => {
  test("keď CommandManager odmietne transformáciu, canonical ostane bez zmeny a appka to povie", () => {
    const e = engine();
    const plan = planOf();
    const motion = pick(plan, "motion");
    const original = e.setTransform.bind(e);
    (e as unknown as { setTransform: unknown }).setTransform = () => false;
    const before = fingerprintStyleState(e.getProject());
    const report = applyStylePlan(e, plan, { decisionIds: [motion.id], now: NOW });
    const after = fingerprintStyleState(e.getProject());
    (e as unknown as { setTransform: unknown }).setTransform = original;
    expect(after.visualJson).toBe(before.visualJson); // žiadna polovičná zmena
    const step = report.steps.find((s) => s.decisionId === motion.id)!;
    expect(step.status).toBe("SKIPPED");
    expect(step.reasonSk).toContain("odmietol");
    expect(report.timelineChanged).toBe(false);
  });

  test("keď zlyhá zápis rozhodnutia, canonical os sa nemení a je to v poznámkach", () => {
    const e = engine();
    const plan = planOf();
    const motion = pick(plan, "motion");
    const original = e.createEditDecision.bind(e);
    (e as unknown as { createEditDecision: unknown }).createEditDecision = () => false;
    const before = fingerprintStyleState(e.getProject());
    const report = applyStylePlan(e, plan, { decisionIds: [motion.id], now: NOW });
    (e as unknown as { createEditDecision: typeof original }).createEditDecision = original;
    // Zmena sa VRÁTILA → canonical je presne v pôvodnom stave (žiadna zmena bez záznamu).
    expect(fingerprintStyleState(e.getProject()).visualJson).toBe(before.visualJson);
    expect(report.notesSk.join(" ")).toContain("VRÁTIL");
    // a appka to nepovie ako aplikované
    expect(report.steps.find((s) => s.decisionId === motion.id)?.status).toBe("SKIPPED");
  });

  test("pokazené (neobjektové) úpravy sa ignorujú — Apply prebehne s hodnotami z plánu", () => {
    const e = engine();
    const plan = planOf();
    const motion = pick(plan, "motion");
    const report = applyStylePlan(e, plan, { decisionIds: [motion.id], edits: { [motion.id]: 42 as never }, now: NOW });
    expect(report.ok).toBe(true);
    expect(clipById(e, "clip_video")?.scale).not.toBe(100);
  });

  test("rollback po úprave vráti projekt presne do stavu pred aplikovaním", () => {
    const e = engine();
    const plan = planOf();
    const before = fingerprintStyleState(e.getProject()).visualJson;
    const text = pick(plan, "typography");
    const report = applyStylePlan(e, plan, { decisionIds: [text.id], edits: { [text.id]: { typographyText: "Dočasné" } }, now: NOW });
    expect(fingerprintStyleState(e.getProject()).visualJson).not.toBe(before);
    const rb = rollbackStyleApply(e, report);
    expect(rb.ok).toBe(true);
    expect(rb.restoredExactly).toBe(true);
    expect(fingerprintStyleState(e.getProject()).visualJson).toBe(before);
    expect(captionClips(e).length).toBe(0);
  });
});

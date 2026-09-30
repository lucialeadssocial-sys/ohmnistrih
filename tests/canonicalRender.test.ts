import { describe, expect, test } from "bun:test";
import { buildCanonicalFramePlan, canonicalPlansMatch, canonicalFrameSummarySk } from "../src/core/render/canonicalFrame";
import { buildCanonicalExportPlan, canonicalExportParity, canonicalKeepRanges, canonicalKeepRangesWithZoom, captionStyleForCanonicalClips } from "../src/core/export/canonicalExport";
import { createInitialProject } from "../src/core";
import { ProjectModel, ClipModel } from "../src/core/types/project";

/**
 * Testy kroku 7: náhľad a export musia vychádzať z TEJ ISTEJ canonical časovej osi.
 * Tieto testy strážia, aby sa „dva render paths“ nemohli vrátiť potichu.
 */

function clip(over: Partial<ClipModel> & Pick<ClipModel, "id" | "trackId" | "type" | "start" | "duration">): ClipModel {
  return {
    name: over.name ?? over.id,
    sourceStart: over.sourceStart ?? over.start,
    sourceEnd: over.sourceEnd ?? over.start + over.duration,
    timelineStart: over.timelineStart ?? over.start,
    offset: 0,
    speed: 1,
    volume: 1,
    scale: 100,
    opacity: 100,
    positionX: 0,
    positionY: 0,
    rotation: 0,
    keyframes: [],
    ...over,
  } as ClipModel;
}

/** Projekt s videom, b-roll obrázkom a dvoma titulkami (ako po Style Studio Apply). */
function projectWithStyle(): ProjectModel {
  const base = createInitialProject();
  const project: ProjectModel = JSON.parse(JSON.stringify(base));
  project.tracks = [
    {
      id: "track_caption",
      type: "caption",
      name: "Titulky",
      order: 3,
      muted: false,
      locked: false,
      visible: true,
      clips: [
        clip({
          id: "cap_1",
          trackId: "track_caption",
          type: "caption",
          start: 0,
          duration: 2,
          textConfig: {
            content: "Za päť minút",
            fontFamily: "Inter, sans-serif",
            fontSize: 28,
            color: "#ffffff",
            fontWeight: "800",
          },
          captionStyle: {
            font: "Inter",
            fontSize: 28,
            color: "#ffffff",
            alignment: "center",
            position: "bottom",
            maxCharsPerLine: 24,
            maxLines: 2,
            preset: "bold",
          },
        } as Partial<ClipModel> & Pick<ClipModel, "id" | "trackId" | "type" | "start" | "duration">),
        clip({
          id: "cap_2",
          trackId: "track_caption",
          type: "caption",
          start: 2,
          duration: 2,
          textConfig: {
            content: "zdvojnásobil predaj",
            fontFamily: "Inter, sans-serif",
            fontSize: 28,
            color: "#ffffff",
            fontWeight: "800",
          },
          captionStyle: {
            font: "Inter",
            fontSize: 28,
            color: "#ffffff",
            alignment: "center",
            position: "bottom",
            maxCharsPerLine: 24,
            maxLines: 2,
            preset: "bold",
          },
        } as Partial<ClipModel> & Pick<ClipModel, "id" | "trackId" | "type" | "start" | "duration">),
      ],
    },
    {
      id: "track_broll",
      type: "b-roll",
      name: "B-roll",
      order: 2,
      muted: false,
      locked: false,
      visible: true,
      clips: [
        clip({
          id: "broll_1",
          trackId: "track_broll",
          type: "image",
          start: 1,
          duration: 1,
          assetId: "asset_shot",
        } as Partial<ClipModel> & Pick<ClipModel, "id" | "trackId" | "type" | "start" | "duration">),
      ],
    },
    {
      id: "track_video",
      type: "video",
      name: "Video",
      order: 1,
      muted: false,
      locked: false,
      visible: true,
      clips: [
        clip({
          id: "clip_main",
          trackId: "track_video",
          type: "video",
          start: 0,
          duration: 4,
          assetId: "asset_main",
          scale: 112,
        } as Partial<ClipModel> & Pick<ClipModel, "id" | "trackId" | "type" | "start" | "duration">),
      ],
    },
  ];
  project.assets = [
    { id: "asset_main", name: "video.mp4", type: "video", opfsPath: "/x", size: 1, mimeType: "video/mp4", duration: 4, width: 1080, height: 1920, fps: 30 },
    { id: "asset_shot", name: "snímka.png", type: "image", opfsPath: "/y", size: 1, mimeType: "image/png", duration: 0, width: 1080, height: 1920, fps: 0 },
  ] as ProjectModel["assets"];
  return project;
}

describe("canonical frame plan: jeden zdroj pravdy pre náhľad aj export", () => {
  test("v čase 1,5 s sú vo vrstvách video, b-roll aj titulok (v poradí zdola nahor)", () => {
    const project = projectWithStyle();
    const plan = buildCanonicalFramePlan(project, 1.5);
    expect(plan.outsideTimeline).toBe(false);
    expect(plan.layers.map((l) => l.clipId)).toEqual(["clip_main", "broll_1", "cap_1"]);
    expect(plan.layers.map((l) => l.kind)).toEqual(["media", "media", "text"]);
    expect(plan.layers[2].text).toBe("Za päť minút");
    expect(plan.layers[0].scale).toBe(112); // motion z Apply
    expect(plan.layers[1].sourceTime).not.toBeNull();
  });

  test("plán je deterministický — dva rovnaké vstupy dajú presne to isté", () => {
    const project = projectWithStyle();
    const a = buildCanonicalFramePlan(project, 1.5);
    const b = buildCanonicalFramePlan(project, 1.5);
    expect(canonicalPlansMatch(a, b)).toBe(true);
  });

  test("náhľad aj export dostanú z rovnakého projektu ten istý plán", () => {
    const project = projectWithStyle();
    const preview = buildCanonicalFramePlan(project, 2.4); // cesta náhľadu
    const exported = buildCanonicalFramePlan(JSON.parse(JSON.stringify(project)), 2.4); // cesta exportu
    expect(canonicalPlansMatch(preview, exported)).toBe(true);
  });

  test("chýbajúce médium sa nikdy nezamlčí — je v skipped s dôvodom", () => {
    const project = projectWithStyle();
    const plan = buildCanonicalFramePlan(project, 1.5, { availableMedia: ["asset_main"] });
    expect(plan.layers.map((l) => l.clipId)).toEqual(["clip_main", "cap_1"]);
    const skipped = plan.skipped.find((s) => s.clipId === "broll_1");
    expect(skipped).toBeDefined();
    expect(skipped!.reasonSk).toContain("nie je pripravené");
  });

  test("skrytá stopa sa nekreslí a povie to", () => {
    const project = projectWithStyle();
    project.tracks[0].visible = false; // titulky skryté
    const plan = buildCanonicalFramePlan(project, 1.5);
    expect(plan.layers.find((l) => l.clipId === "cap_1")).toBeUndefined();
    expect(plan.skipped.some((s) => s.reasonSk.includes("skrytá"))).toBe(true);
  });

  test("za koncom projektu sa nič nekreslí (a je to priznané)", () => {
    const project = projectWithStyle();
    const plan = buildCanonicalFramePlan(project, 9);
    expect(plan.layers).toHaveLength(0);
    expect(plan.outsideTimeline).toBe(true);
    expect(canonicalFrameSummarySk(plan)).toContain("koniec projektu");
  });

  test("zhrnutie pre človeka spomenie text aj zoom", () => {
    const project = projectWithStyle();
    const text = canonicalFrameSummarySk(buildCanonicalFramePlan(project, 1.5));
    expect(text).toContain("Za päť minút");
    expect(text).toContain("zoom 112");
    expect(text).toContain("3 vrstiev");
  });
});

describe("canonical export: zadanie pre existujúcu renderovaciu linku", () => {
  test("titulky idú do exportu doslovne z canonical osi", () => {
    const plan = buildCanonicalExportPlan(projectWithStyle(), {
      uploadId: "subor.mp4",
      uploadName: "video.mp4",
      width: 1080,
      height: 1920,
    });
    expect(plan.canExport).toBe(true);
    expect(plan.request.segments.map((s) => s.text)).toEqual(["Za päť minút", "zdvojnásobil predaj"]);
    expect(plan.request.segments[0].start).toBe(0);
    expect(plan.request.segments[0].end).toBe(2);
    expect(plan.parity.matched).toBe(true);
    expect(plan.parity.missingTexts).toEqual([]);
  });

  test("jediný klip bez orezu → žiadne strihy (a zvuk sa kopíruje, nie prekóduje)", () => {
    const ranges = canonicalKeepRanges(projectWithStyle());
    expect(ranges).toEqual([]);
    const plan = buildCanonicalExportPlan(projectWithStyle(), { uploadId: "s.mp4", uploadName: "v.mp4", width: 1080, height: 1920 });
    expect(plan.request.keepRanges).toEqual([]);
    expect(plan.notesSk.join(" ")).toContain("bajtovo rovnaký");
  });

  test("orezané klipy → strihy podľa canonical osi", () => {
    const project = projectWithStyle();
    project.tracks[2].clips[0].sourceStart = 1;
    project.tracks[2].clips[0].sourceEnd = 2.5;
    project.tracks[2].clips[0].duration = 1.5;
    const ranges = canonicalKeepRanges(project);
    expect(ranges).toEqual([{ start: 1, end: 2.5 }]);
    const plan = buildCanonicalExportPlan(project, { uploadId: "s.mp4", uploadName: "v.mp4", width: 1080, height: 1920 });
    expect(plan.notesSk.join(" ")).toContain("AAC 192 k");
  });

  test("b-roll bez nahratého súboru sa nevykreslí — a appka to povie PRED renderom", () => {
    const plan = buildCanonicalExportPlan(projectWithStyle(), { uploadId: "s.mp4", uploadName: "v.mp4", width: 1080, height: 1920 });
    expect(plan.unsupportedSk.join(" ")).toContain("nie je dostupné ako súbor");
    expect(plan.request.overlays ?? []).toEqual([]);
  });

  test("priblíženie (zoom) z canonical osi ide do exportu naozaj", () => {
    const plan = buildCanonicalExportPlan(projectWithStyle(), { uploadId: "s.mp4", uploadName: "v.mp4", width: 1080, height: 1920 });
    // V projekte má hlavný klip scale 112 % → musí byť v zadaní ako okno priblíženia.
    expect(plan.request.zoom).toEqual([{ clipId: "clip_main", startSec: 0, endSec: 4, scale: 112, positionX: 0, positionY: 0 }]);
    expect(plan.notesSk.join(" ")).toContain("Priblíženie (motion) sa vykreslí");
    expect(plan.unsupportedSk.join(" ")).not.toContain("Priblíženia (motion) na");
  });

  test("keď je b-roll nahratý na server, ide do zadania ako obrazová vrstva", () => {
    const plan = buildCanonicalExportPlan(
      projectWithStyle(),
      { uploadId: "s.mp4", uploadName: "v.mp4", width: 1080, height: 1920 },
      { assetUploads: { asset_shot: "shot-123.png" } },
    );
    expect(plan.request.overlays).toHaveLength(1);
    const overlay = plan.request.overlays![0];
    expect(overlay.assetId).toBe("asset_shot");
    expect(overlay.uploadId).toBe("shot-123.png");
    expect(overlay.kind).toBe("image");
    expect(overlay.startSec).toBe(1);
    expect(overlay.endSec).toBe(2);
    expect(plan.notesSk.join(" ")).toContain("obrazových vrstiev (b-roll/fotky) pôjde do videa");
    expect(plan.unsupportedSk.join(" ")).not.toContain("nie je dostupné ako súbor");
  });

  test("animované priblíženie (keyframy) sa nepredstiera — ide bez zoomu a s dôvodom", () => {
    const project = projectWithStyle();
    project.tracks[2].clips[0].keyframes = [
      { id: "k1", parameter: "scale", time: 0, value: 100, easing: "LINEAR" } as never,
      { id: "k2", parameter: "scale", time: 1, value: 130, easing: "LINEAR" } as never,
    ];
    const plan = buildCanonicalExportPlan(project, { uploadId: "s.mp4", uploadName: "v.mp4", width: 1080, height: 1920 });
    expect(plan.request.zoom ?? []).toEqual([]);
    expect(plan.unsupportedSk.join(" ")).toContain("animované priblíženie");
  });

  test("pri strihoch nesie priblíženie samotný úsek (zdrojový čas sedí s trim=)", () => {
    const project = projectWithStyle();
    project.tracks[2].clips[0].sourceStart = 1;
    project.tracks[2].clips[0].sourceEnd = 2.5;
    project.tracks[2].clips[0].duration = 1.5;
    project.tracks[2].clips[0].start = 0;
    project.tracks[2].clips[0].timelineStart = 0;
    const plan = buildCanonicalExportPlan(project, { uploadId: "s.mp4", uploadName: "v.mp4", width: 1080, height: 1920 });
    expect(plan.request.keepRanges).toEqual([{ start: 1, end: 2.5, scalePercent: 112 }]);
    expect(plan.request.zoom ?? []).toEqual([]);
  });

  test("pootočená a priesvitná vrstva sa vykreslí a nesie svoje hodnoty (krok 10)", () => {
    // Do kroku 10 sa také vrstvy vynechávali. Teraz sa vykresľujú — a do linky
    // musia ísť presné hodnoty z canonical osi, nie „nejako".
    const project = projectWithStyle();
    project.tracks[1].clips[0].rotation = 12.5;
    project.tracks[1].clips[0].opacity = 60;
    project.tracks[1].clips[0].filter = "VINTAGE";
    const plan = buildCanonicalExportPlan(
      project,
      { uploadId: "s.mp4", uploadName: "v.mp4", width: 1080, height: 1920 },
      { assetUploads: { asset_shot: "shot.png" } },
    );
    expect(plan.request.overlays?.length).toBe(1);
    const ov = plan.request.overlays![0];
    expect(ov.rotation).toBe(12.5);
    expect(ov.opacity).toBe(60);
    expect(ov.filter).toBe("VINTAGE");
    // a už sa nesťažuje, že by to nešlo
    expect(plan.unsupportedSk.join(" ")).not.toContain("pootočených");
    expect(plan.unsupportedSk.join(" ")).not.toContain("priehľadnosť");
  });

  test("takmer neviditeľná vrstva (pod 1 %) sa prizná — v obraze by nebola vidieť", () => {
    const project = projectWithStyle();
    project.tracks[1].clips[0].opacity = 0.5;
    const plan = buildCanonicalExportPlan(
      project,
      { uploadId: "s.mp4", uploadName: "v.mp4", width: 1080, height: 1920 },
      { assetUploads: { asset_shot: "shot.png" } },
    );
    expect(plan.request.overlays ?? []).toEqual([]);
    expect(plan.unsupportedSk.join(" ")).toContain("priehľadnosť");
  });

  test("skrytá stopa s b-rollom sa do videa nedostane (a je to správne, s dôvodom)", () => {
    const project = projectWithStyle();
    project.tracks[1].visible = false;
    const plan = buildCanonicalExportPlan(
      project,
      { uploadId: "s.mp4", uploadName: "v.mp4", width: 1080, height: 1920 },
      { assetUploads: { asset_shot: "shot.png" } },
    );
    expect(plan.request.overlays ?? []).toEqual([]);
    expect(plan.unsupportedSk.join(" ")).toContain("skrytej stope");
  });

  test("bez videa na serveri sa render nespustí (a povie prečo)", () => {
    const plan = buildCanonicalExportPlan(projectWithStyle(), { uploadId: "", uploadName: "v.mp4", width: 1080, height: 1920 });
    expect(plan.canExport).toBe(false);
    expect(plan.blockersSk.join(" ")).toContain("uploadId");
  });

  test("bez hlavného video klipu sa render nespustí", () => {
    const project = projectWithStyle();
    project.tracks = project.tracks.filter((t) => t.type !== "video");
    const plan = buildCanonicalExportPlan(project, { uploadId: "s.mp4", uploadName: "v.mp4", width: 1080, height: 1920 });
    expect(plan.canExport).toBe(false);
    expect(plan.blockersSk.join(" ")).toContain("video klip");
  });

  test("štýl titulkov sa vyberie z canonical presetov", () => {
    const project = projectWithStyle();
    expect(captionStyleForCanonicalClips(project.tracks[0].clips)).toBe("VIRAL_BOLD");
    project.tracks[0].clips[0].captionStyle!.preset = "kinetic";
    expect(captionStyleForCanonicalClips(project.tracks[0].clips)).toBe("KARAOKE");
    project.tracks[0].clips[0].captionStyle!.preset = "minimal";
    expect(captionStyleForCanonicalClips(project.tracks[0].clips)).toBe("PODCAST");
  });

  test("parita odhalí podvod: text navyše v zadaní aj chýbajúci text", () => {
    const project = projectWithStyle();
    const plan = buildCanonicalExportPlan(project, { uploadId: "s.mp4", uploadName: "v.mp4", width: 1080, height: 1920 });
    const tampered = { ...plan.request, segments: [plan.request.segments[0], { start: 5, end: 6, text: "vymyslený text" }] };
    const parity = canonicalExportParity(project, tampered);
    expect(parity.matched).toBe(false);
    expect(parity.extraTexts).toEqual(["vymyslený text"]);
    expect(parity.missingTexts).toEqual(["zdvojnásobil predaj"]);
  });

  test("prázdne textové vrstvy sa do exportu nedostanú a je to v poznámkach", () => {
    const project = projectWithStyle();
    project.tracks[0].clips.push(
      clip({ id: "cap_empty", trackId: "track_caption", type: "caption", start: 4, duration: 1, textConfig: { content: "   ", fontFamily: "Inter", fontSize: 24, color: "#fff" } } as Partial<ClipModel> & Pick<ClipModel, "id" | "trackId" | "type" | "start" | "duration">),
    );
    const plan = buildCanonicalExportPlan(project, { uploadId: "s.mp4", uploadName: "v.mp4", width: 1080, height: 1920 });
    expect(plan.request.segments).toHaveLength(2);
    expect(plan.notesSk.join(" ")).toContain("nemá text alebo platný čas");
  });
});

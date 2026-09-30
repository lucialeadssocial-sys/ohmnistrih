import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { CanonicalExportPanel } from "../src/components/CanonicalExportPanel";
import { createInitialProject } from "../src/core";
import type { ProjectModel, ClipModel } from "../src/core/types/project";

/**
 * SSR testy canonical náhľadu a exportu (krok 7).
 *
 * Prehliadač v prostredí nie je, preto sa overuje to, čo sa overiť dá: že panel
 * **nepredstiera** nič, čo nemá — a že používateľ vidí, čo pôjde do exportu
 * a čo táto renderovacia linka ešte nevykresľuje.
 */

function clip(over: Partial<ClipModel> & Pick<ClipModel, "id" | "trackId" | "type" | "start" | "duration">): ClipModel {
  return {
    name: over.name ?? over.id,
    sourceStart: 0,
    sourceEnd: over.duration,
    timelineStart: over.start,
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

function styledProject(): ProjectModel {
  const base = JSON.parse(JSON.stringify(createInitialProject())) as ProjectModel;
  base.tracks = [
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
          textConfig: { content: "Za päť minút", fontFamily: "Inter", fontSize: 28, color: "#fff", fontWeight: "800" },
          captionStyle: { font: "Inter", fontSize: 28, color: "#fff", alignment: "center", position: "bottom", maxCharsPerLine: 24, maxLines: 2, preset: "bold" },
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
      clips: [clip({ id: "broll_1", trackId: "track_broll", type: "image", start: 1, duration: 1, assetId: "asset_shot" } as Partial<ClipModel> & Pick<ClipModel, "id" | "trackId" | "type" | "start" | "duration">)],
    },
    {
      id: "track_video",
      type: "video",
      name: "Video",
      order: 1,
      muted: false,
      locked: false,
      visible: true,
      clips: [clip({ id: "clip_main", trackId: "track_video", type: "video", start: 0, duration: 4, assetId: "asset_main", scale: 112 } as Partial<ClipModel> & Pick<ClipModel, "id" | "trackId" | "type" | "start" | "duration">)],
    },
  ];
  base.assets = [
    { id: "asset_main", name: "video.mp4", type: "video", opfsPath: "/x", size: 1, mimeType: "video/mp4", duration: 4, width: 1080, height: 1920, fps: 30 },
    { id: "asset_shot", name: "snímka.png", type: "image", opfsPath: "/y", size: 1, mimeType: "image/png", duration: 0, width: 1080, height: 1920, fps: 0 },
  ] as ProjectModel["assets"];
  return base;
}

describe("canonical náhľad + export (SSR)", () => {
  test("panel povie, že náhľad aj export idú z jednej canonical osi", () => {
    const html = renderToString(<CanonicalExportPanel language="sk" project={styledProject()} currentTime={1.5} />);
    expect(html).toContain("Náhľad a export z canonical časovej osi");
    expect(html).toContain("Žiadne dva render paths");
    expect(html).toContain("Export z tej istej canonical osi");
  });

  test("čo linka nevykresľuje, to je viditeľné PRED renderom", () => {
    const html = renderToString(<CanonicalExportPanel language="sk" project={styledProject()} currentTime={1.5} />);
    expect(html).toContain("nevykresľuje");
    expect(html).toContain("obrazových vrstiev");
    expect(html).toContain("Priblíženia");
  });

  test("bez pripojeného zdroja sa render nespustí a panel to povie", () => {
    const html = renderToString(<CanonicalExportPanel language="sk" project={styledProject()} currentTime={1.5} />);
    expect(html).toContain("Zdrojové video nie je v tomto náhľade pripojené");
    expect(html).toContain("disabled");
  });

  test("náhľad v čase 1,5 s vypíše, čo je v obraze (vrátane nevykreslených vrstiev)", () => {
    const html = renderToString(<CanonicalExportPanel language="sk" project={styledProject()} currentTime={1.5} />);
    expect(html).toContain("V obraze:");
    expect(html).toContain("Za päť minút");
    expect(html).toContain("nie je pripravené");
  });

  test("panel sa nezobrazí bez projektu (nič nepredstiera)", () => {
    const html = renderToString(<CanonicalExportPanel language="sk" project={null} />);
    expect(html).toBe("");
  });

  test("anglická verzia má vlastné texty (nie slovenské zvyšky)", () => {
    const html = renderToString(<CanonicalExportPanel language="en" project={styledProject()} currentTime={0.5} />);
    expect(html).toContain("Preview &amp; export from the canonical timeline");
    expect(html).toContain("Not rendered by this pipeline yet");
  });

  test("panel prizná, že starší prehrávač môže ukazovať iný obraz", () => {
    const html = renderToString(<CanonicalExportPanel language="sk" project={styledProject()} currentTime={1.5} />);
    expect(html).toContain("Prehrávač hore má zatiaľ vlastné (staršie) vrstvy");
    expect(html).toContain("to ide do súboru");
  });

  test("náhľad sa dá vypnúť — vtedy sa canvase nekreslia", () => {
    const html = renderToString(<CanonicalExportPanel language="sk" project={styledProject()} currentTime={1.5} defaultPreviewOn={false} />);
    expect(html).toContain("Náhľad vypnutý");
    expect(html).not.toContain("Canonical os má obsah");
  });
});

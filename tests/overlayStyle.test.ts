import { describe, expect, test } from "bun:test";
import {
  buildBurnFfmpegArgs,
  colorFilterForName,
  overlayTransformFilters,
} from "../src/core/export/subtitleRender";
import { BURN_KNOWN_FILTERS, validateBurnRequest } from "../src/core/export/burnJob";
import { buildCanonicalExportPlan } from "../src/core/export/canonicalExport";
import { createInitialProject } from "../src/core";
import { ClipModel, ProjectModel } from "../src/core/types/project";

/**
 * Testy kroku 10: otočenie, priesvitnosť a farebné filtre obrazových vrstiev
 * (+ farebný filter základného videa).
 *
 * Podstatné: musí to sedieť s tým, čo kreslí canonical kompozitor
 * (`renderEngine.getCanvasFilterCSS`), inak by náhľad a export ukazovali iné.
 */

function filterOf(args: string[]): string {
  const i = args.indexOf("-filter_complex");
  return i >= 0 ? args[i + 1] : "";
}

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

// ---------------------------------------------------------------------------
// A) Farebné filtre — musia sedieť s náhľadom
// ---------------------------------------------------------------------------

describe("A) farebné filtre (zhoda s canonical kompozitorom)", () => {
  test("BW = odstrániť farbu + kontrast (rovnako ako grayscale(100%) contrast(120%))", () => {
    const f = colorFilterForName("BW");
    expect(f).toContain("hue=s=0");
    expect(f).toContain("eq=contrast=1.2");
  });

  test("CINEMATIC prekladá brightness(95 %) ako pripočítanie -0,05 (nie násobenie)", () => {
    const f = colorFilterForName("CINEMATIC");
    expect(f).toContain("contrast=1.1");
    expect(f).toContain("brightness=-0.05");
    expect(f).toContain("saturation=0.85");
  });

  test("TEAL_ORANGE a COOL používajú hue, nie len eq", () => {
    expect(colorFilterForName("TEAL_ORANGE")).toContain("hue=h=-10");
    expect(colorFilterForName("COOL")).toContain("hue=h=15");
  });

  test("VINTAGE a WARM miešajú sépiu podľa CSS (nie náhodné koeficienty)", () => {
    const vintage = colorFilterForName("VINTAGE");
    // sepia(40 %) = 60 % pôvodnej farby + 40 % sépie → rr = 0,6 + 0,393*0,4 = 0,7572
    expect(vintage).toContain("colorchannelmixer=");
    expect(vintage).toContain("rr=0.7572");
    expect(vintage).toContain("gg=0.8744");
    expect(vintage).toContain("bb=0.6524");
    const warm = colorFilterForName("WARM");
    // sepia(20 %) → rr = 0,8 + 0,393*0,2 = 0,8786
    expect(warm).toContain("rr=0.8786");
  });

  test("NONE a neznáme filtre nič nemenia (nič sa nepridáva zbytočne)", () => {
    expect(colorFilterForName("NONE")).toBe("");
    expect(colorFilterForName(undefined)).toBe("");
    expect(colorFilterForName("MAGIC")).toBe("");
  });

  test("všetky známe filtre majú aj ffmpeg podobu (zoznamy sa nesmú rozísť)", () => {
    for (const name of BURN_KNOWN_FILTERS) {
      const f = colorFilterForName(name);
      if (name === "NONE") expect(f).toBe("");
      else expect(f.length).toBeGreaterThan(5);
    }
  });
});

// ---------------------------------------------------------------------------
// B) Otočenie a priesvitnosť
// ---------------------------------------------------------------------------

describe("B) otočenie a priesvitnosť vrstvy", () => {
  test("otočenie ide okolo stredu a nič neodrezáva (ako ctx.rotate)", () => {
    const f = overlayTransformFilters({ rotation: 90 });
    expect(f).toContain("rotate=");
    expect(f).toContain("ow=rotw(");
    expect(f).toContain("oh=roth(");
    // `c=none` = rohy zostanú priesvitné, nie čierne
    expect(f).toContain(":c=none");
    // 90° v radiánoch
    expect(f).toContain("1.570796");
  });

  test("priesvitnosť ide cez alfa kanál (rovnako ako ctx.globalAlpha)", () => {
    const f = overlayTransformFilters({ opacity: 60 });
    expect(f).toContain("colorchannelmixer=aa=0.6000");
  });

  test("bez zmien sa nič nepridáva", () => {
    expect(overlayTransformFilters({})).toBe("");
    expect(overlayTransformFilters({ opacity: 100, rotation: 0 })).toBe("");
  });

  test("v linke je poradie: farebný filter → otočenie → priesvitnosť → overlay", () => {
    const f = filterOf(
      buildBurnFfmpegArgs({
        inputPath: "in.mp4",
        outputPath: "out.mp4",
        assPath: "/x/a.ass",
        overlays: [
          {
            path: "/tmp/shot.png",
            kind: "image",
            startSec: 2,
            endSec: 5,
            scalePercent: 50,
            positionX: 0,
            positionY: 0,
            rotation: 30,
            opacity: 70,
            filter: "BW",
          },
        ],
      }),
    );
    const overlayPart = f.split(";").find((p) => p.includes("overlay=")) ?? "";
    const before = f.slice(0, f.indexOf("overlay="));
    const idxColor = before.lastIndexOf("hue=s=0");
    const idxRotate = before.lastIndexOf("rotate=");
    const idxAlpha = before.lastIndexOf("colorchannelmixer=aa=");
    expect(idxColor).toBeGreaterThan(-1);
    expect(idxRotate).toBeGreaterThan(idxColor);
    expect(idxAlpha).toBeGreaterThan(idxRotate);
    // vrstva je stále len vo svojom čase
    expect(overlayPart).toContain("enable='between(t,2.000,5.000)'");
  });
});

// ---------------------------------------------------------------------------
// C) Farebný filter základného videa
// ---------------------------------------------------------------------------

describe("C) farebný filter základného videa", () => {
  test("filter videa ide pred vrstvy a pred titulky", () => {
    const f = filterOf(
      buildBurnFfmpegArgs({
        inputPath: "in.mp4",
        outputPath: "out.mp4",
        assPath: "/x/a.ass",
        baseFilter: "VINTAGE",
        overlays: [
          { path: "/tmp/s.png", kind: "image", startSec: 1, endSec: 2, scalePercent: 100, positionX: 0, positionY: 0 },
        ],
      }),
    );
    const idxBase = f.indexOf("[vbase]");
    const idxOverlay = f.indexOf("overlay=");
    const idxAss = f.indexOf("ass=");
    expect(idxBase).toBeGreaterThan(-1);
    expect(idxOverlay).toBeGreaterThan(idxBase);
    expect(idxAss).toBeGreaterThan(idxOverlay);
    // a je to presne ten istý prepis ako pri vrstvách
    expect(f).toContain(colorFilterForName("VINTAGE").slice(1));
  });

  test("bez filtra sa základné video nemení (stará cesta)", () => {
    const f = filterOf(
      buildBurnFfmpegArgs({ inputPath: "in.mp4", outputPath: "out.mp4", assPath: "/x/a.ass", baseFilter: "NONE" }),
    );
    expect(f).toBe("[0:v]ass=/x/a.ass[vout]");
    expect(f).not.toContain("vbase");
  });
});

// ---------------------------------------------------------------------------
// D) Canonical os → plán
// ---------------------------------------------------------------------------

function projectWithStyledOverlay(): ProjectModel {
  const base = createInitialProject();
  const project: ProjectModel = JSON.parse(JSON.stringify(base));
  project.tracks = [
    {
      id: "track_video",
      type: "video",
      name: "Video",
      order: 0,
      muted: false,
      locked: false,
      visible: true,
      clips: [
        clip({
          id: "v1",
          trackId: "track_video",
          type: "video",
          start: 0,
          duration: 10,
          sourceStart: 0,
          sourceEnd: 10,
          filter: "CINEMATIC",
        }),
      ],
    },
    {
      id: "track_broll",
      type: "b-roll",
      name: "B-roll",
      order: 1,
      muted: false,
      locked: false,
      visible: true,
      clips: [
        clip({
          id: "ov1",
          trackId: "track_broll",
          type: "b-roll",
          start: 2,
          duration: 3,
          assetId: "asset_shot",
          rotation: 15,
          opacity: 55,
          filter: "BW",
        }),
      ],
    },
  ];
  return project;
}

describe("D) canonical plán nesie nové vlastnosti", () => {
  test("otočenie, priesvitnosť a filter vrstvy idú do zadania", () => {
    const plan = buildCanonicalExportPlan(
      projectWithStyledOverlay(),
      { uploadId: "u.mp4", uploadName: "u.mp4", width: 1080, height: 1920 },
      { assetUploads: { asset_shot: "shot.png" } },
    );
    const ov = plan.request.overlays![0];
    expect(ov.rotation).toBe(15);
    expect(ov.opacity).toBe(55);
    expect(ov.filter).toBe("BW");
  });

  test("filter základného videa ide do zadania AJ do poznámok (s priznanou aproximáciou)", () => {
    const plan = buildCanonicalExportPlan(
      projectWithStyledOverlay(),
      { uploadId: "u.mp4", uploadName: "u.mp4", width: 1080, height: 1920 },
      { assetUploads: { asset_shot: "shot.png" } },
    );
    expect(plan.request.baseFilter).toBe("CINEMATIC");
    const notes = plan.notesSk.join(" ");
    expect(notes).toContain("CINEMATIC");
    expect(notes).toContain("aproximácia");
    // a nesťažuje sa, že by sa filter nevykreslil
    expect(plan.unsupportedSk.join(" ")).not.toContain("sa ZATIAĽ nevykresľuje");
  });
});

// ---------------------------------------------------------------------------
// E) Validácia
// ---------------------------------------------------------------------------

describe("E) validácia nových vlastností vrstiev", () => {
  const base = {
    uploadId: "abc-123__video.mp4",
    uploadName: "video.mp4",
    styleId: "VIRAL_BOLD",
    width: 1080,
    height: 1920,
    segments: [{ start: 0, end: 1, text: "Ahoj" }],
    keepRanges: [],
  };
  const withOverlay = (over: Record<string, unknown>) => ({
    ...base,
    overlays: [
      {
        clipId: "c1",
        kind: "image",
        uploadId: "overlay-1__shot.png",
        name: "shot.png",
        startSec: 1,
        endSec: 2,
        scalePercent: 100,
        positionX: 0,
        positionY: 0,
        rotation: 0,
        opacity: 100,
        filter: "NONE",
        ...over,
      },
    ],
  });

  test("správna vrstva prejde aj s otočením a filtrom", () => {
    const r = validateBurnRequest(withOverlay({ rotation: 45, opacity: 80, filter: "WARM" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spec.overlays[0].rotation).toBe(45);
    expect(r.spec.overlays[0].opacity).toBe(80);
    expect(r.spec.overlays[0].filter).toBe("WARM");
  });

  test("otočenie mimo rozsahu sa odmietne", () => {
    const r = validateBurnRequest(withOverlay({ rotation: 400 }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errorSk).toContain("Otočenie");
  });

  test("priesvitnosť mimo rozsahu sa odmietne", () => {
    const r = validateBurnRequest(withOverlay({ opacity: 0.2 }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errorSk).toContain("Priesvitnosť");
  });

  test("neznámy filter sa odmietne a povie, ktoré sú známe", () => {
    const r = validateBurnRequest(withOverlay({ filter: "MAGIC" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errorSk).toContain("MAGIC");
    expect(r.errorSk).toContain("VINTAGE");
  });

  test("neznámy filter na videu sa odmietne (nie ticho vynechá)", () => {
    const r = validateBurnRequest({ ...base, baseFilter: "MAGIC" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errorSk).toContain("MAGIC");
  });

  test("plán → validácia → filter graf: vzhľad vrstvy sa nesmie stratiť na ceste", () => {
    // Presne táto trieda chyby sa stala v kroku 9 (mená polí) aj pri náhľade grafu:
    // niekde sa preposiela len časť polí a náhľad potom klame o tom, čo ide do videa.
    const project = projectWithStyledOverlay();
    const plan = buildCanonicalExportPlan(
      project,
      { uploadId: "u.mp4", uploadName: "u.mp4", width: 1080, height: 1920 },
      { assetUploads: { asset_shot: "shot.png" } },
    );
    const r = validateBurnRequest({
      ...base,
      baseFilter: plan.request.baseFilter,
      overlays: (plan.request.overlays ?? []).map((o) => ({
        clipId: o.clipId,
        kind: o.kind,
        uploadId: o.uploadId,
        name: o.name,
        startSec: o.startSec,
        endSec: o.endSec,
        scalePercent: o.scalePercent,
        positionX: o.positionX,
        positionY: o.positionY,
        rotation: o.rotation,
        opacity: o.opacity,
        filter: o.filter,
      })),
      keepRanges: plan.request.keepRanges,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // a teraz to, čo z toho vyrobí linka
    const f = filterOf(
      buildBurnFfmpegArgs({
        inputPath: "in.mp4",
        outputPath: "out.mp4",
        assPath: "/x/a.ass",
        baseFilter: r.spec.baseFilter,
        overlays: r.spec.overlays.map((o) => ({
          path: "/tmp/shot.png",
          kind: o.kind,
          startSec: o.startSec,
          endSec: o.endSec,
          scalePercent: o.scalePercent,
          positionX: o.positionX,
          positionY: o.positionY,
          rotation: o.rotation,
          opacity: o.opacity,
          filter: o.filter,
        })),
      }),
    );
    expect(f).toContain("rotate=");
    expect(f).toContain("colorchannelmixer=aa=0.5500");
    expect(f).toContain("hue=s=0");
    expect(f).toContain("eq=contrast=1.1"); // CINEMATIC na videu
  });

  test("bez filtra je v spec NONE (predvolená hodnota, nie undefined)", () => {
    const r = validateBurnRequest(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spec.baseFilter).toBe("NONE");
  });
});

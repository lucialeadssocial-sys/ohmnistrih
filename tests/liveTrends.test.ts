import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ageLabelSk,
  buildBundle,
  dedupeSignals,
  DEFAULT_GEOS,
  geoLabelSk,
  getLiveSource,
  LIVE_SOURCES,
  LIVE_SIGNALS_DISCLAIMER_SK,
  normalizeChannelId,
  normalizeKey,
  parseApproxTraffic,
  parseGoogleTrendsRss,
  parseViewsFromStatistics,
  parseYouTubeChart,
  parseYouTubeFeed,
  PLATFORM_LIMITS_SK,
  rankSignals,
  scoreChartVideo,
  scoreSearchTrend,
  signalBriefSk,
  signalContextForPlanSk,
  summarizeBundleSk,
  trafficLabelSk,
  type SourceFetchResult,
  type TrendSignal,
} from "../src/core/trends/liveTrends";

/**
 * Testy s REÁLNYMI vzorkami dát.
 * `tests/fixtures/google-trends-sk.xml` a `youtube-feed.xml` sú stiahnuté
 * z reálnych zdrojov (Google Trends SK, YouTube kanál) a skrátené na 2 položky —
 * takže testy overujú skutočný formát, nie ten, ktorý sme si vymysleli.
 *
 * Fixture `youtube-chart.json` je poskladaná podľa dokumentovanej schémy
 * Data API (bez kľúča sa živá odpoveď nedá získať) — je to priznané aj v komentári.
 */
const FIX = join(fileURLToPath(new URL(".", import.meta.url)), "fixtures");
const read = (name: string) => readFileSync(join(FIX, name), "utf-8");

describe("živé signály — Google Trends (reálna vzorka)", () => {
  const xml = read("google-trends-sk.xml");
  const signals = parseGoogleTrendsRss(xml, "SK");

  test("parsuje reálne položky vrátane diakritiky a „el niño“", () => {
    expect(signals.length).toBe(2);
    const titles = signals.map((s) => s.title);
    expect(titles).toContain("el niño");
    expect(signals.every((s) => s.source === "GOOGLE_TRENDS")).toBe(true);
    expect(signals.every((s) => s.kind === "SEARCH_TREND")).toBe(true);
  });

  test("prečíta približný záujem a priloží súvislosť zo správ", () => {
    const first = signals[0];
    expect(first.approxTraffic).toBe(500);
    expect(first.countryLabelSk).toBe("Slovensko");
    expect(first.contextText && first.contextText.length).toBeGreaterThan(3);
    expect(first.contextUrl).toContain("http");
  });

  test("každý signál má odkaz a dátum, inak by bol nepoužiteľný", () => {
    for (const s of signals) {
      expect(s.url).toContain("http");
      expect(Number.isFinite(Date.parse(s.publishedAt!))).toBe(true);
      expect(s.score).toBeGreaterThan(0);
      expect(s.score).toBeLessThanOrEqual(100);
    }
  });

  test("prázdny alebo pokazený vstup nespadne — vráti prázdno", () => {
    expect(parseGoogleTrendsRss("", "SK")).toEqual([]);
    expect(parseGoogleTrendsRss("<rss><channel></channel></rss>", "SK")).toEqual([]);
    expect(parseGoogleTrendsRss("<item><title>x</title></item>", "SK").length).toBe(1);
    // neuzavreté / poškodené položky sa jednoducho vynechajú
    expect(parseGoogleTrendsRss("<item><title>y</title>", "SK")).toEqual([]);
  });

  test("rôzne krajiny dávajú rôzne id (nezlejú sa dokopy)", () => {
    const sk = parseGoogleTrendsRss(xml, "SK");
    const us = parseGoogleTrendsRss(xml, "US");
    expect(sk[0].id).not.toBe(us[0].id);
    expect(us[0].countryLabelSk).toBe("USA");
  });
});

describe("živé signály — YouTube kanálové RSS (reálna vzorka)", () => {
  const xml = read("youtube-feed.xml");
  const feed = parseYouTubeFeed(xml);

  test("prečíta kanál a jeho príspevky", () => {
    expect(feed.channelTitle).toBe("MrBeast");
    expect(feed.signals.length).toBe(2);
    expect(feed.signals[0].kind).toBe("NEW_UPLOAD");
    expect(feed.signals[0].channelTitle).toBe("MrBeast");
  });

  test("ZVLÁŠTNOSŤ YOUTUBE: id kanála v hlavičke chýba predpona „UC“ — doplníme ju", () => {
    // V reálnej vzorke je v hlavičke <yt:channelId>X6OQ3DkcsbYNE6H8uQQuVA</yt:channelId>
    // (22 znakov, bez „UC“), kým v položkách je správne „UCX6OQ…“.
    // Kanonické id kanála má 24 znakov a začína na „UC“.
    expect(xml).toContain("<yt:channelId>X6OQ3DkcsbYNE6H8uQQuVA</yt:channelId>");
    expect(feed.channelId).toBe("UCX6OQ3DkcsbYNE6H8uQQuVA");
    expect(normalizeChannelId("X6OQ3DkcsbYNE6H8uQQuVA")).toBe("UCX6OQ3DkcsbYNE6H8uQQuVA");
    expect(normalizeChannelId("UCX6OQ3DkcsbYNE6H8uQQuVA")).toBe("UCX6OQ3DkcsbYNE6H8uQQuVA");
    expect(normalizeChannelId(undefined)).toBeUndefined();
  });

  test("odkaz na video sedí podľa videoId z feedu", () => {
    for (const s of feed.signals) {
      expect(s.url).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=/);
    }
    const ids = feed.signals.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length); // žiadne duplicitné id
  });

  test("POCTIVO: keď feed nedáva zhliadnutia, nič sa nevymýšľa", () => {
    // tento feed (súčasný formát YouTube) views neobsahuje
    expect(feed.signals.every((s) => s.views === undefined)).toBe(true);
    // a preto je signál ohodnotený nižšie než rebríčkový s rovnakou sledovanosťou
    const chartScore = scoreChartVideo(1_000_000);
    expect(feed.signals[0].score).toBeLessThan(chartScore);
  });

  test("views sa prečítajú, keď ich feed naozaj pošle", () => {
    expect(parseViewsFromStatistics('<media:statistics views="12345"/>')).toBe(12345);
    expect(parseViewsFromStatistics('<media:statistics views="0"/>')).toBeUndefined();
    expect(parseViewsFromStatistics('<media:statistics/>')).toBeUndefined();
  });
});

describe("živé signály — YouTube rebríček (schéma Data API)", () => {
  const json = JSON.parse(read("youtube-chart.json"));
  const signals = parseYouTubeChart(json, "SK");

  test("prečíta titulok, kanál, zhliadnutia aj lajky", () => {
    expect(signals.length).toBe(2);
    expect(signals[0].title).toBe("Ako som za 7 dní naplnil kaviareň");
    expect(signals[0].views).toBe(1_240_000);
    expect(signals[0].channelTitle).toBe("Podnikateľské skratky");
    expect(signals[0].countryLabelSk).toBe("Slovensko");
    expect(signals[0].contextText).toContain("lajkov");
  });

  test("neznáma odpoveď (chyba API) nespadne — vráti prázdno", () => {
    expect(parseYouTubeChart(null, "SK")).toEqual([]);
    expect(parseYouTubeChart({}, "SK")).toEqual([]);
    expect(parseYouTubeChart({ error: { code: 403 } }, "SK")).toEqual([]);
    expect(parseYouTubeChart({ items: [{}] }, "SK")).toEqual([]);
  });

  test("viac zhliadnutí = silnejší signál a skóre sa NEZASEKNE na 100", () => {
    // Toto bola reálna chyba: stará kalibrácia dala 100 už pri 100 tis. zhliadnutiach,
    // takže všetky virálne videá mali rovnaké skóre a nedalo sa podľa neho radiť.
    const zlom = [1_000, 10_000, 100_000, 1_000_000, 10_000_000, 100_000_000].map((v) =>
      scoreChartVideo(v),
    );
    for (let i = 1; i < zlom.length; i++) {
      expect(zlom[i]).toBeGreaterThan(zlom[i - 1]);
    }
    expect(zlom[2]).toBeLessThan(100); // 100 tis. ešte nie je strop
    expect(zlom[zlom.length - 1]).toBeLessThanOrEqual(100);
    expect(scoreChartVideo(1_000)).toBeGreaterThan(scoreChartVideo(0)); // 0 zhliadnutí < 1 000
    // a „nevieme koľko" (undefined) nesmie vyzerať lepšie než tisíce zhliadnutí
    expect(scoreChartVideo(100_000)).toBeGreaterThan(scoreChartVideo(undefined));
  });
});

describe("živé signály — hodnotenie a poradie", () => {
  test("záujem 5000 je silnejší než 500, ale oba sú v rozumnom pásme", () => {
    const maly = scoreSearchTrend(500);
    const velky = scoreSearchTrend(5000);
    expect(velky).toBeGreaterThan(maly);
    expect(maly).toBeGreaterThan(40);
    expect(velky).toBeLessThan(90);
  });

  test("čerstrejší signál je silnejší (za inak rovnakých podmienok)", () => {
    const now = new Date("2026-09-29T12:00:00Z");
    const cerstvy = scoreSearchTrend(1000, "2026-09-29T11:00:00Z", now);
    const stary = scoreSearchTrend(1000, "2026-09-20T11:00:00Z", now);
    expect(cerstvy).toBeGreaterThan(stary);
  });

  test("budúci dátum (zlá hodina v zdroji) nič nezvyšuje", () => {
    const now = new Date("2026-09-29T12:00:00Z");
    const buduci = scoreSearchTrend(1000, "2030-01-01T00:00:00Z", now);
    const ziadny = scoreSearchTrend(1000, undefined, now);
    expect(buduci).toBe(ziadny);
  });

  test("duplicity sa zlúčia a vyhrá silnejší", () => {
    const a = mkSignal({ id: "x", score: 40 });
    const b = mkSignal({ id: "x", score: 70 });
    const merged = dedupeSignals([a, b]);
    expect(merged.length).toBe(1);
    expect(merged[0].score).toBe(70);
  });

  test("poradie: sila → čerstvosť → abeceda (deterministické)", () => {
    const now = "2026-09-29T12:00:00Z";
    const list = [
      mkSignal({ id: "b", title: "Bé", score: 50, publishedAt: now }),
      mkSignal({ id: "a", title: "Á", score: 50, publishedAt: now }),
      mkSignal({ id: "c", title: "Cé", score: 80, publishedAt: now }),
      mkSignal({ id: "d", title: "Dé", score: 50, publishedAt: "2026-09-01T12:00:00Z" }),
    ];
    const ranked = rankSignals(list).map((s) => s.id);
    expect(ranked).toEqual(["c", "a", "b", "d"]);
  });
});

describe("živé signály — texty pre človeka", () => {
  const now = new Date("2026-09-29T12:00:00Z");

  test("vek a záujem sú po slovensky a bez zveličovania", () => {
    expect(ageLabelSk("2026-09-29T09:00:00Z", now)).toBe("pred 3 h");
    expect(ageLabelSk("2026-09-28T12:00:00Z", now)).toBe("včera");
    expect(ageLabelSk(undefined, now)).toBe("bez dátumu");
    expect(trafficLabelSk(5000)).toBe("5 000+ vyhľadávaní");
    expect(trafficLabelSk(undefined)).toBe("neznámy záujem");
    expect(parseApproxTraffic("1,000+")).toBe(1000);
    expect(parseApproxTraffic("")).toBeUndefined();
  });

  test("zhrnutie neobsahuje marketingové slová", () => {
    const results: SourceFetchResult[] = [
      {
        source: "GOOGLE_TRENDS",
        ok: true,
        fetchedAt: now.toISOString(),
        signals: parseGoogleTrendsRss(read("google-trends-sk.xml"), "SK"),
      },
    ];
    const text = summarizeBundleSk(results, now);
    for (const word of ["virál", "zaručene", "100 %", "explózia", "revolúcia"]) {
      expect(text.toLowerCase()).not.toContain(word);
    }
    expect(text).toContain("vyhľadávaných tém");
    expect(text).toContain("Najsilnejší signál");
  });

  test("keď zdroj zlyhá, zhrnutie to prizná (nikdy ticho)", () => {
    const results: SourceFetchResult[] = [
      { source: "GOOGLE_TRENDS", ok: false, fetchedAt: now.toISOString(), signals: [], errorSk: "HTTP 403" },
    ];
    const bundle = buildBundle(results, now);
    expect(bundle.signals).toEqual([]);
    expect(bundle.warningsSk[0]).toContain("HTTP 403");
    expect(bundle.summarySk).toContain("nedomýšľa");
  });

  test("z kanálov bez zhliadnutí zhrnutie samo upozorní, že nehovoria „čo funguje“", () => {
    const results: SourceFetchResult[] = [
      {
        source: "YOUTUBE_FEED",
        ok: true,
        fetchedAt: now.toISOString(),
        signals: parseYouTubeFeed(read("youtube-feed.xml")).signals,
      },
    ];
    const text = summarizeBundleSk(results, now);
    expect(text).toContain("len čo vyšlo");
  });

  test("brief rozlíši druhy signálov", () => {
    const gt = parseGoogleTrendsRss(read("google-trends-sk.xml"), "SK")[0];
    expect(signalBriefSk(gt, now).originSk).toContain("Google Trends");
    const chart = parseYouTubeChart(JSON.parse(read("youtube-chart.json")), "SK")[0];
    const b = signalBriefSk(chart, now);
    expect(b.lineSk).toContain("zhliadnutí");
    expect(b.originSk).toContain("rebríček");
  });

  test("kontext pre plán hovorí, že signály vybrala používateľka", () => {
    const signals = parseGoogleTrendsRss(read("google-trends-sk.xml"), "SK");
    const ctx = signalContextForPlanSk(signals, now);
    expect(ctx).toContain("VYBRALA");
    expect(ctx).toContain("nie tvoj odhad");
    expect(ctx).toContain("el niño");
    expect(signalContextForPlanSk([], now)).toBe("");
  });
});

describe("živé signály — poctivý popis zdrojov", () => {
  test("každý zdroj má popísané, čo dáva aj čo nedáva", () => {
    expect(LIVE_SOURCES.length).toBe(3);
    for (const s of LIVE_SOURCES) {
      expect(s.givesSk.length).toBeGreaterThan(20);
      expect(s.limitsSk.length).toBeGreaterThan(20);
    }
    expect(getLiveSource("YOUTUBE_CHART").needsKey).toBe(true);
    expect(getLiveSource("GOOGLE_TRENDS").needsKey).toBe(false);
    expect(getLiveSource("YOUTUBE_FEED").limitsSk).toContain("zhliadnutí");
  });

  test("nedostupné platformy sú priznané s dôvodom (nie ticho)", () => {
    const names = PLATFORM_LIMITS_SK.map((p) => p.platform);
    expect(names).toContain("TikTok");
    expect(names).toContain("Instagram Reels");
    expect(PLATFORM_LIMITS_SK.every((p) => p.reasonSk.length > 40)).toBe(true);
  });

  test("upozornenie nezakrýva riziko", () => {
    expect(LIVE_SIGNALS_DISCLAIMER_SK).toContain("nie záruka");
  });

  test("krajiny majú slovenské názvy a rozumné predvolené", () => {
    expect(geoLabelSk("SK")).toBe("Slovensko");
    expect(geoLabelSk("CZ")).toBe("Česko");
    expect(geoLabelSk("xx")).toBe("XX");
    expect(DEFAULT_GEOS[0]).toBe("SK");
  });

  test("kľúč na porovnávanie zvládne diakritiku a interpunkciu", () => {
    expect(normalizeKey("Kaviareň U Janka!")).toBe("kaviaren-u-janka");
    expect(normalizeKey("  TV — Markíza  ")).toBe("tv-markiza");
  });
});

// pomocník
function mkSignal(over: Partial<TrendSignal>): TrendSignal {
  return {
    id: "s",
    source: "GOOGLE_TRENDS",
    kind: "SEARCH_TREND",
    title: "Téma",
    score: 50,
    ...over,
  };
}

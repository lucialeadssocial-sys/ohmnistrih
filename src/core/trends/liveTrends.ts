/**
 * ŽIVÉ SIGNÁLY — reálne dáta z platforiem pre Trend Radar (F5).
 *
 * Zásada: radšej **poctivý malý zdroj** než veľký, ktorý si niekto domýšľa.
 * Tento modul preto pri každom zdroji hovorí, čo naozaj dáva a čo nedáva —
 * aby si nikto nepomýlil „téma sa vyhľadáva“ so „video bude virálne“.
 *
 * Čo je tu:
 *  - parsovanie Google Trends RSS (bez kľúča, funguje pre SK aj celý svet)
 *  - parsovanie YouTube kanálového RSS (bez kľúča — čerstvé príspevky)
 *  - parsovanie YouTube Data API (voliteľný kľúč — oficiálny rebríček s počtami zhliadnutí)
 *  - spoločný tvar signálu, zlučovanie duplicít, radenie, slovenské texty
 *
 * Modul je **čistý** (žiadne siete, žiadny stav) → dá sa testovať bez internetu.
 * Sieťové volania robí server; tu sa len číta to, čo prišlo.
 */

// ---------------------------------------------------------------------------
// Zdroje
// ---------------------------------------------------------------------------

export type LiveSourceId = "GOOGLE_TRENDS" | "YOUTUBE_FEED" | "YOUTUBE_CHART";

export interface LiveSourceSpec {
  id: LiveSourceId;
  labelSk: string;
  /** Čo tento zdroj naozaj dáva. */
  givesSk: string;
  /** Čo nedáva — aby sa z toho nestala falošná istota. */
  limitsSk: string;
  needsKey: boolean;
}

export const LIVE_SOURCES: LiveSourceSpec[] = [
  {
    id: "GOOGLE_TRENDS",
    labelSk: "Google Trends",
    givesSk:
      "Čo ľudia práve teraz hľadajú v konkrétnej krajine — dopyt, približný záujem a správy, ktoré to spustili.",
    limitsSk:
      "Je to záujem o tému, nie dôkaz, že z toho bude virálne video. Netýka sa TikTok ani Reels.",
    needsKey: false,
  },
  {
    id: "YOUTUBE_FEED",
    labelSk: "YouTube kanály (RSS)",
    givesSk: "Čo práve zverejnili kanály, ktoré si si vybrala — čerstvé príspevky s dátumom.",
    limitsSk:
      "YouTube kanálové RSS už neposiela počet zhliadnutí ani lajkov. Vidíš teda „čo vyšlo“, nie „čo funguje“. Na „čo funguje“ treba kľúč (YOUTUBE_CHART).",
    needsKey: false,
  },
  {
    id: "YOUTUBE_CHART",
    labelSk: "YouTube rebríček (Data API)",
    givesSk:
      "Oficiálny rebríček najpopulárnejších videí podľa krajiny — aj s počtom zhliadnutí a menom kanála.",
    limitsSk:
      "Týka sa len YouTube (nie TikTok/Reels) a vyžaduje bezplatný kľúč z Google Cloud. Denný limit je 10 000 jednotiek — označujem, koľko ich čo stojí.",
    needsKey: true,
  },
];

export function getLiveSource(id: LiveSourceId): LiveSourceSpec {
  const s = LIVE_SOURCES.find((x) => x.id === id);
  if (!s) throw new Error(`Neznámy zdroj: ${id}`);
  return s;
}

/** Poctivo: čo (zatiaľ) nedokážeme a prečo — nie „zabudli sme“. */
export const PLATFORM_LIMITS_SK: { platform: string; reasonSk: string }[] = [
  {
    platform: "TikTok",
    reasonSk:
      "Nemá bezplatné verejné API na trendy. Existujú len akademické (Research API) a firemné (Display API) prístupy. Neobchádzam to neoficiálnym čítaním stránok — je to proti ich pravidlám a rozbilo by sa to pri prvej zmene.",
  },
  {
    platform: "Instagram Reels",
    reasonSk:
      "Oficiálne API vydáva dáta len o vlastnom firemnom účte (nie o cudzích virálnych videách), takže globálny prehľad trendov sa z neho nedá získať.",
  },
  {
    platform: "Reddit",
    reasonSk:
      "Verejné JSON rozhranie je bez kľúča, ale server nás z tohto prostredia odmieta (HTTP 403). Nechávam to vypnuté — radšej nič než tiché prázdno.",
  },
];

/** Prečo „sledovať platformy“ nikdy nebude znamenať „garantované zhliadnutia“. */
export const LIVE_SIGNALS_DISCLAIMER_SK =
  "Signály sú surový materiál na rozhodnutie, nie záruka. Aj najsilnejší trend vyjde nazmar, ak ho použiješ bez vlastného uhla pohľadu.";

// ---------------------------------------------------------------------------
// Signál
// ---------------------------------------------------------------------------

export type SignalKind = "SEARCH_TREND" | "NEW_UPLOAD" | "CHART_VIDEO";

export interface TrendSignal {
  /** Stabilné id pre zlučovanie duplicít. */
  id: string;
  source: LiveSourceId;
  kind: SignalKind;
  /** Názov signálu (dopyt / titulok videa). */
  title: string;
  geo?: string;
  countryLabelSk?: string;
  url?: string;
  /** Kedy to vyšlo (ISO), keď to zdroj udáva. */
  publishedAt?: string;
  /** Približný počet vyhľadávaní (z „5000+“ sa číta 5000). */
  approxTraffic?: number;
  /** Doplnkový kontext — napr. správa, ktorá dopyt spustila. */
  contextText?: string;
  contextUrl?: string;
  channelTitle?: string;
  views?: number;
  /** 0–100, relatívna sila v rámci dávky. */
  score: number;
}

export interface SourceFetchResult {
  source: LiveSourceId;
  ok: boolean;
  fetchedAt: string;
  /** Čo to stálo (hlavne pri YouTube Data API). */
  costSk?: string;
  signals: TrendSignal[];
  errorSk?: string;
  hintSk?: string;
  /** Napr. koľko kanálov sa sledovalo / koľko krajín. */
  detailSk?: string;
}

export interface LiveSignalsBundle {
  fetchedAt: string;
  results: SourceFetchResult[];
  signals: TrendSignal[];
  summarySk: string;
  warningsSk: string[];
}

// ---------------------------------------------------------------------------
// Pomocné
// ---------------------------------------------------------------------------

const MONTHS_SK = [
  "1.",
  "2.",
  "3.",
  "4.",
  "5.",
  "6.",
  "7.",
  "8.",
  "9.",
  "10.",
  "11.",
  "12.",
];

/** Z „5000+“ alebo „1,000+“ spraví číslo. Nerozumiem → undefined (radšej nič). */
export function parseApproxTraffic(text: string | undefined | null): number | undefined {
  if (!text) return undefined;
  const cleaned = String(text).replace(/[^\d]/g, "");
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function trafficLabelSk(n: number | undefined): string {
  if (!n) return "neznámy záujem";
  const s = String(Math.round(n));
  // slovenské oddeľovanie tisícov: 5 000
  const spaced = s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${spaced}+ vyhľadávaní`;
}

export function ageLabelSk(publishedAt: string | undefined, now: Date = new Date()): string {
  if (!publishedAt) return "bez dátumu";
  const t = Date.parse(publishedAt);
  if (!Number.isFinite(t)) return "bez dátumu";
  const min = Math.max(0, Math.round((now.getTime() - t) / 60000));
  if (min < 1) return "práve teraz";
  if (min < 60) return `pred ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `pred ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return "včera";
  if (d < 7) return `pred ${d} dňami`;
  return `pred ${Math.round(d / 7)} týždňami`;
}

/** Krajiny, ktoré vieme sledovať (Google Trends aj YouTube rebríček). */
export const GEO_OPTIONS: { code: string; labelSk: string }[] = [
  { code: "SK", labelSk: "Slovensko" },
  { code: "CZ", labelSk: "Česko" },
  { code: "AT", labelSk: "Rakúsko" },
  { code: "DE", labelSk: "Nemecko" },
  { code: "GB", labelSk: "Veľká Británia" },
  { code: "US", labelSk: "USA" },
];

export function geoLabelSk(code: string): string {
  return GEO_OPTIONS.find((g) => g.code === code.toUpperCase())?.labelSk ?? code.toUpperCase();
}

/** Poradie krajín dáva zmysel len takto — lokálne prvé, svetové druhé. */
export const DEFAULT_GEOS = ["SK", "CZ", "US"];

// ---------------------------------------------------------------------------
// Google Trends RSS
// ---------------------------------------------------------------------------

function decodeXmlEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function tagText(block: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = block.match(re);
  if (!m) return undefined;
  const v = decodeXmlEntities(m[1]);
  return v.length ? v : undefined;
}

/**
 * Parser Google Trends RSS (`trends.google.com/trending/rss?geo=SK`).
 *
 * Formát je neoficiálny (Google ho môže zmeniť) — preto parser **nikdy
 * nespadne**: čo nenájde, jednoducho vynechá a vráti menej signálov.
 * Bezpečnosť: vstup je cudzí text, takže žiadne vykonávanie, len čítanie.
 */
export function parseGoogleTrendsRss(xml: string, geo: string): TrendSignal[] {
  if (typeof xml !== "string" || !xml.trim()) return [];
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  const out: TrendSignal[] = [];

  for (const item of items) {
    const title = tagText(item, "title");
    if (!title) continue;
    const traffic = parseApproxTraffic(tagText(item, "ht:approx_traffic"));
    const pub = tagText(item, "pubDate");
    const newsTitle = tagText(item, "ht:news_item_title");
    const newsUrl = tagText(item, "ht:news_item_url");
    const link = tagText(item, "link");

    // Google dáva titulok správy v dvoch podobách (title/snippet) — vezmeme prvý, ktorý je.
    const context = newsTitle || tagText(item, "ht:news_item_snippet");
    const publishedAt = pub && Number.isFinite(Date.parse(pub)) ? new Date(pub).toISOString() : undefined;

    out.push({
      id: `gt:${geo.toUpperCase()}:${normalizeKey(title)}`,
      source: "GOOGLE_TRENDS",
      kind: "SEARCH_TREND",
      title,
      geo: geo.toUpperCase(),
      countryLabelSk: geoLabelSk(geo),
      url: link || `https://trends.google.com/trends/explore?geo=${geo.toUpperCase()}&q=${encodeURIComponent(title)}`,
      publishedAt,
      approxTraffic: traffic,
      contextText: context,
      contextUrl: newsUrl,
      score: scoreSearchTrend(traffic, publishedAt),
    });
  }

  return out;
}

/**
 * Sila dopytu: logaritmicky podľa záujmu + prídavok za čerstvosť.
 *
 * Kalibrácia je zámerne rozložená tak, aby sa horné priečky **nesploštili**:
 * keď má päť tém zhodne 100/100, používateľka sa z poradia nič nedozvie.
 *   200 → 50 · 1 000 → 62 · 5 000 → 75 · 10 000 → 80 · 50 000 → 92 · 100 000 → 98
 */
export function scoreSearchTrend(traffic: number | undefined, publishedAt?: string, now: Date = new Date()): number {
  let base = 30;
  if (traffic && traffic > 0) {
    base = 10 + 17.5 * Math.log10(Math.max(10, traffic));
  }
  const rec = recencyBonus(publishedAt, now);
  return clampScore(base + rec);
}

function recencyBonus(publishedAt: string | undefined, now: Date): number {
  if (!publishedAt) return 0;
  const t = Date.parse(publishedAt);
  if (!Number.isFinite(t)) return 0;
  const hours = (now.getTime() - t) / 3600000;
  if (hours < 0) return 0;
  if (hours <= 6) return 12;
  if (hours <= 24) return 6;
  if (hours <= 72) return 2;
  return 0;
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Kľúč na porovnávanie titulkov: bez diakritiky, bez interpunkcie, malé písmená. */
export function normalizeKey(s: string): string {
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// ---------------------------------------------------------------------------
// YouTube kanálové RSS
// ---------------------------------------------------------------------------

/** Kanonické YouTube id kanála začína na "UC" a má 24 znakov. */
export function normalizeChannelId(id: string | undefined): string | undefined {
  if (!id) return undefined;
  const v = id.trim();
  if (!v) return undefined;
  // Feed samotný vie poslať 22-znakové id bez "UC" — doplníme ho.
  if (v.length === 22 && !v.startsWith("UC")) return `UC${v}`;
  return v;
}

export interface YouTubeFeedResult {
  channelTitle?: string;
  channelId?: string;
  signals: TrendSignal[];
}

/**
 * Parser YouTube kanálového RSS (`youtube.com/feeds/videos.xml?channel_id=…`).
 * Dôležité a poctivé: novšie feed-y **nemajú** počet zhliadnutí, takže tu
 * žiadne „views“ nevymýšľame — ostáva len čerstvosť.
 */
export function parseYouTubeFeed(xml: string): YouTubeFeedResult {
  if (typeof xml !== "string" || !xml.trim()) return { signals: [] };
  const head = xml.split("<entry")[0];
  const channelTitle = tagText(head, "title");
  const entries = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  // Pozor, reálna zvláštnosť YouTube: na úrovni kanála vie prísť <yt:channelId>
  // bez predpony "UC" (napr. "X6OQ…"), kým v položkách je správne "UCX6OQ…".
  // Preto berieme prednostne id z prvej položky a až potom to z hlavičky.
  const channelId = normalizeChannelId(
    tagText(entries[0] ?? "", "yt:channelId") ?? tagText(head, "yt:channelId"),
  );
  const signals: TrendSignal[] = [];

  for (const e of entries) {
    const title = tagText(e, "media:title") ?? tagText(e, "title");
    if (!title) continue;
    const videoId = tagText(e, "yt:videoId");
    const published = tagText(e, "published");
    const publishedAt =
      published && Number.isFinite(Date.parse(published)) ? new Date(published).toISOString() : undefined;
    const description = tagText(e, "media:description");
    const views = parseViewsFromStatistics(tagText(e, "media:statistics"));

    signals.push({
      id: `ytf:${videoId || normalizeKey(title)}`,
      source: "YOUTUBE_FEED",
      kind: "NEW_UPLOAD",
      title,
      url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined,
      publishedAt,
      channelTitle,
      contextText: description ? description.slice(0, 300) : undefined,
      views,
      // Bez počtu zhliadnutí je to slabší signál — a presne tak je ohodnotený.
      score: clampScore((views ? scoreSearchTrend(views, publishedAt) : 40) + recencyBonus(publishedAt, new Date())),
    });
  }

  return { channelTitle, channelId, signals };
}

/** `<media:statistics views="12345"/>` → 12345. Prázdne → undefined. */
export function parseViewsFromStatistics(stat: string | undefined): number | undefined {
  if (!stat) return undefined;
  const m = stat.match(/views\s*=\s*"?(\d+)"?/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

// ---------------------------------------------------------------------------
// YouTube Data API (voliteľný kľúč) — oficiálny rebríček
// ---------------------------------------------------------------------------

export interface YouTubeChartItem {
  id?: string;
  snippet?: { title?: string; channelTitle?: string; publishedAt?: string; description?: string };
  statistics?: { viewCount?: string; likeCount?: string };
}

/**
 * Z odpovede `videos.list?chart=mostPopular` spraví signály.
 * Počet zhliadnutí je tu naozaj — preto majú tieto signály najvyššiu váhu.
 */
export function parseYouTubeChart(json: unknown, geo: string): TrendSignal[] {
  const items = (json as any)?.items;
  if (!Array.isArray(items)) return [];
  const out: TrendSignal[] = [];

  for (const it of items as YouTubeChartItem[]) {
    const title = it?.snippet?.title;
    if (!title || !it?.id) continue;
    const views = Number(it.statistics?.viewCount ?? 0) || undefined;
    const likes = Number(it.statistics?.likeCount ?? 0) || undefined;
    const publishedAt = it.snippet?.publishedAt;
    const channelTitle = it.snippet?.channelTitle;

    out.push({
      id: `ytc:${geo.toUpperCase()}:${it.id}`,
      source: "YOUTUBE_CHART",
      kind: "CHART_VIDEO",
      title,
      geo: geo.toUpperCase(),
      countryLabelSk: geoLabelSk(geo),
      url: `https://www.youtube.com/watch?v=${it.id}`,
      publishedAt,
      channelTitle,
      views,
      contextText: likes ? `${likes.toLocaleString("sk-SK")} lajkov` : undefined,
      score: scoreChartVideo(views, publishedAt),
    });
  }

  return out;
}

/**
 * Rebríček: váha podľa zhliadnutí (log) + čerstvosť.
 *
 * Kalibrácia zámerne **nesatiruje** pri desaťtisícoch — virálne videá majú
 * bežne milióny zhliadnutí a skóre by potom bolo pri všetkých rovnaké (100)
 * a nedalo by sa podľa neho rozhodovať:
 *   10 tis. → 50 · 100 tis. → 63 · 1 mil. → 75 · 10 mil. → 88 · 100 mil. → 100
 */
export function scoreChartVideo(views: number | undefined, publishedAt?: string, now: Date = new Date()): number {
  // Rozlišujeme „nevieme koľko“ (views === undefined → neutrálnych 45) od
  // „naozaj nula zhliadnutí“ (→ 10). Bez toho by video s nulou dostalo viac
  // než video s 1 000 zhliadnutiami, čo je nezmysel.
  let base = 45;
  if (typeof views === "number" && Number.isFinite(views)) {
    base = views <= 0 ? 10 : 12.5 * Math.log10(Math.max(10, views));
  }
  return clampScore(base + recencyBonus(publishedAt, now));
}

/** Koľko jednotiek denného limitu (10 000) čo stojí — aby to nikoho neprekvapilo. */
export const YOUTUBE_API_COST = {
  /** videos.list (rebríček) = 1 jednotka na volanie. */
  chartPerCall: 1,
  /** search.list = 100 jednotiek na volanie — preto ho nepoužívame sami od seba. */
  searchPerCall: 100,
  dailyLimit: 10000,
} as const;

// ---------------------------------------------------------------------------
// Spracovanie dávky
// ---------------------------------------------------------------------------

/** Zlúči signály: rovnaké id drží len raz, vyhráva silnejší. */
export function dedupeSignals(signals: TrendSignal[]): TrendSignal[] {
  const map = new Map<string, TrendSignal>();
  for (const s of signals) {
    const prev = map.get(s.id);
    if (!prev || s.score > prev.score) map.set(s.id, s);
  }
  return [...map.values()];
}

/** Najsilnejšie prvé; pri rovnosti novšie prvé, potom abecedne (determinizmus). */
export function rankSignals(signals: TrendSignal[]): TrendSignal[] {
  return [...signals].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    if (tb !== ta) return tb - ta;
    return a.title.localeCompare(b.title, "sk");
  });
}

export interface SignalBrief {
  /** Čo to je, jednou vetou — pre rýchle čítanie. */
  lineSk: string;
  /** Odkiaľ to je a ako je to čerstvé. */
  originSk: string;
}

export function signalBriefSk(s: TrendSignal, now: Date = new Date()): SignalBrief {
  const where = s.countryLabelSk ? ` (${s.countryLabelSk})` : "";
  if (s.kind === "SEARCH_TREND") {
    return {
      lineSk: `„${s.title}“${where} — ${trafficLabelSk(s.approxTraffic)}`,
      originSk: `Google Trends · ${ageLabelSk(s.publishedAt, now)}`,
    };
  }
  if (s.kind === "NEW_UPLOAD") {
    const views = s.views ? ` · ${s.views.toLocaleString("sk-SK")} zhliadnutí` : "";
    return {
      lineSk: `„${s.title}“ — ${s.channelTitle || "kanál"}${views}`,
      originSk: `YouTube kanál · ${ageLabelSk(s.publishedAt, now)}`,
    };
  }
  const views = s.views ? ` — ${s.views.toLocaleString("sk-SK")} zhliadnutí` : "";
  return {
    lineSk: `„${s.title}“ — ${s.channelTitle || "kanál"}${views}`,
    originSk: `YouTube rebríček${where} · ${ageLabelSk(s.publishedAt, now)}`,
  };
}

/** Zhrnutie dávky — vecne, bez marketingu, s priznanými dierami. */
export function summarizeBundleSk(results: SourceFetchResult[], now: Date = new Date()): string {
  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const all = rankSignals(dedupeSignals(ok.flatMap((r) => r.signals)));

  if (!all.length && !failed.length) return "Zatiaľ nemám žiadne signály — spusti obnovenie.";
  if (!all.length) return "Neprišli žiadne signály. Dôvody sú nižšie, nič sa nedomýšľa.";

  const parts: string[] = [];
  const gt = all.filter((s) => s.source === "GOOGLE_TRENDS");
  const ytFeed = all.filter((s) => s.source === "YOUTUBE_FEED");
  const ytChart = all.filter((s) => s.source === "YOUTUBE_CHART");
  if (gt.length) parts.push(`${gt.length} vyhľadávaných tém`);
  if (ytChart.length) parts.push(`${ytChart.length} videí z YouTube rebríčka`);
  if (ytFeed.length) parts.push(`${ytFeed.length} čerstvých príspevkov z kanálov`);

  const top = all[0];
  const topBrief = signalBriefSk(top, now);
  const topLine = `Najsilnejší signál: ${topBrief.lineSk} (${topBrief.originSk.toLowerCase()}).`;

  const tail: string[] = [];
  if (ytFeed.length && !ytChart.length) {
    tail.push(
      "Pozor na poctivosť zdroja: príspevky z kanálov nemajú počet zhliadnutí, takže nehovoria, čo funguje — len čo vyšlo.",
    );
  }
  if (failed.length) {
    tail.push(`${failed.length} ${failed.length === 1 ? "zdroj sa nedal načítať" : "zdroje sa nedali načítať"} — dôvod je pri ňom napísaný.`);
  }

  return [`${parts.join(", ")}.`, topLine, ...tail].join(" ");
}

/** Poskladá celý balík z výsledkov jednotlivých zdrojov. */
export function buildBundle(results: SourceFetchResult[], now: Date = new Date()): LiveSignalsBundle {
  const signals = rankSignals(dedupeSignals(results.flatMap((r) => r.signals)));
  const warningsSk: string[] = [];
  for (const r of results) {
    if (!r.ok) warningsSk.push(`${getLiveSource(r.source).labelSk}: ${r.errorSk || "neznáma chyba"}`);
  }
  return {
    fetchedAt: now.toISOString(),
    results,
    signals,
    summarySk: summarizeBundleSk(results, now),
    warningsSk,
  };
}

/**
 * Text pre AI (a pre človeka), aby plán mohol vedome reagovať na trendy —
 * a aby bolo vidieť, že je to **vybraný** signál, nie AI výmysel.
 */
export function signalContextForPlanSk(signals: TrendSignal[], now: Date = new Date()): string {
  if (!signals.length) return "";
  const lines = signals.slice(0, 8).map((s, i) => {
    const b = signalBriefSk(s, now);
    const ctx = s.contextText ? ` Súvislosť: ${s.contextText}` : "";
    return `${i + 1}. ${b.lineSk} [${b.originSk}]${ctx}`;
  });
  return [
    "POUŽÍVATEĽKA VYBRALA TIETO TRENDOVÉ SIGNÁLY (sú to reálne dáta, nie tvoj odhad):",
    ...lines,
    "Použi ich len ak sa naozaj hodia k obsahu videa. Ak sa nehodia, povedz to.",
  ].join("\n");
}

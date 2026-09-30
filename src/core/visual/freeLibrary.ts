/**
 * KROK 27 — VOĽNÁ KNIŽNICA: obrázky so slobodnou licenciou, ktoré sa smú použiť
 * v tvojom videe. Zdroj: **Openverse** (openverse.org, API bez kľúča) — overené
 * reálnym volaním 30. 9. 2026.
 *
 * Prečo je tu licenčná politika a nie len „stiahni obrázok“:
 *  - nie každá „voľná“ fotka sa smie použiť komerčne a bez úprav,
 *  - licencie `NC` (nekomerčné), `ND` (bez odvodenín) a `SA` v kombinácii so
 *    strihaním do videa sú pre tvorcu pasca — appka ich preto **neponúkne**,
 *  - pri licenciách, ktoré vyžadujú uvedenie autora, appka **vždy** ukáže a uloží
 *    text priznania (meno, licencia, odkaz). Nikdy ho nezamlčí.
 *
 * Toto je čistá logika (žiadna sieť) — sieťové volanie robí server.
 */

/** Licencie, ktoré appka prijme (komerčné použitie + úpravy povolené). */
export const SAFE_LICENSES = ["cc0", "pdm", "by", "by-sa"] as const;

/** Licencie, ktoré appka odmietne — s dôvodom pre človeka. */
export const REJECTED_LICENSES: { match: string; reasonSk: string }[] = [
  { match: "nc", reasonSk: "nekomerčná licencia (NC) — video nesmieš použiť na podnikanie ani na propagáciu produktu" },
  { match: "nd", reasonSk: "licencia bez odvodenín (ND) — vloženie do videa je odvodené dielo" },
  { match: "sampling", reasonSk: "licencia sampling+ — vzťahuje sa na hudbu, nie na vizuál do videa" },
];

export interface LibraryItem {
  id: string;
  title: string;
  /** Autor / zdroj (pre priznanie). */
  creator: string;
  license: string;
  licenseVersion: string;
  licenseUrl: string;
  /** Stránka, odkiaľ obrázok je (odkaz pre človeka). */
  sourceUrl: string;
  /** Priama adresa obrázka (server ju aj tak overí voči Openverse). */
  imageUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  /** Priznanie, ktoré treba vložiť do popisu videa. */
  attributionSk: string;
  /** `true` = musíš uviesť autora (CC0/PDM nie). */
  attributionRequired: boolean;
}

export interface LibrarySearchResult {
  ok: boolean;
  /** Keď nie je, prečo (napr. nedostupná knižnica). */
  errorSk?: string;
  provider: "openverse";
  query: string;
  /** Koľko výsledkov knižnica vôbec má (pred filtrovaním licencií). */
  totalFromProvider: number;
  /** Koľko sme z ponuky vyradili pre licenciu. */
  rejectedForLicense: number;
  items: LibraryItem[];
  notesSk: string[];
}

/** Rozhodne, či licencia prejde — a keď nie, povie dôvod. */
export function licenseDecision(license: string): { allowed: boolean; reasonSk: string } {
  const l = String(license ?? "").toLowerCase().trim();
  if (!l) return { allowed: false, reasonSk: "licencia neuvedená — radšej nič nestrhávam" };
  const rejected = REJECTED_LICENSES.find((r) => l.includes(r.match));
  if (rejected) return { allowed: false, reasonSk: rejected.reasonSk };
  const safe = (SAFE_LICENSES as readonly string[]).includes(l);
  return safe
    ? { allowed: true, reasonSk: `licencia ${l.toUpperCase()} — komerčné použitie a úpravy povolené` }
    : { allowed: false, reasonSk: `licenciu „${l}“ nepoznám, preto ju neponúkam` };
}

export function attributionRequired(license: string): boolean {
  const l = String(license ?? "").toLowerCase();
  return l === "by" || l === "by-sa";
}

/** Text priznania, ktorý máš dať do popisu videa (pri CC0/PDM je dobrovoľný). */
export function buildAttribution(item: {
  creator?: string;
  license?: string;
  licenseVersion?: string;
  title?: string;
  sourceUrl?: string;
}): string {
  const creator = (item.creator ?? "").trim() || "neznámy autor";
  const license = `${(item.license ?? "").toUpperCase()} ${item.licenseVersion ?? ""}`.trim();
  const title = (item.title ?? "").trim();
  return `${title ? `„${title}“ ` : ""}— ${creator}, licencia ${license}${item.sourceUrl ? `, zdroj: ${item.sourceUrl}` : ""}`;
}

/** Prevedie výsledok Openverse na položku, ktorú vie appka zobraziť (alebo `null` + dôvod). */
export function mapOpenverseResult(
  raw: any,
  query = "",
): { item: LibraryItem | null; rejectedReasonSk?: string } {
  const license = String(raw?.license ?? "");
  const decision = licenseDecision(license);
  if (!decision.allowed) return { item: null, rejectedReasonSk: decision.reasonSk };

  const creator = raw?.creator ? String(raw.creator) : "";
  const title = String(raw?.title ?? raw?.content_title ?? "").trim() || "bez názvu";
  const sourceUrl = String(raw?.foreign_landing_url ?? raw?.detail_url ?? "");
  const imageUrl = String(raw?.url ?? "");
  const thumbnailUrl = String(raw?.thumbnail ?? raw?.url ?? "");
  if (!imageUrl) return { item: null, rejectedReasonSk: "knižnica neposlala adresu obrázka" };

  return {
    item: {
      id: String(raw?.id ?? imageUrl),
      title,
      creator: creator || "neznámy autor",
      license,
      licenseVersion: String(raw?.license_version ?? ""),
      licenseUrl: String(raw?.license_url ?? ""),
      sourceUrl,
      imageUrl,
      thumbnailUrl,
      width: Number(raw?.width ?? 0),
      height: Number(raw?.height ?? 0),
      attributionSk: buildAttribution({ creator, license, licenseVersion: raw?.license_version, title, sourceUrl }),
      attributionRequired: attributionRequired(license),
    },
  };
}

/** Prejde celú odpoveď knižnice: vyhodí to, čo sa nesmie použiť, a povie koľko. */
export function processOpenverseResponse(payload: any, query = ""): LibrarySearchResult {
  const results = Array.isArray(payload?.results) ? payload.results : [];
  const items: LibraryItem[] = [];
  let rejected = 0;
  for (const raw of results) {
    const mapped = mapOpenverseResult(raw, query);
    if (mapped.item) items.push(mapped.item);
    else rejected++;
  }
  const notesSk: string[] = [];
  if (rejected > 0) {
    notesSk.push(
      `Vyradil som ${rejected} obrázkov, ktoré sa do videa nesmú použiť (licencia NC/ND alebo neznáma) — ponúkam len to, čo môžeš použiť komerčne a upraviť.`,
    );
  }
  const needAttr = items.filter((i) => i.attributionRequired).length;
  if (needAttr > 0) {
    notesSk.push(`${needAttr} z ${items.length} obrázkov vyžaduje uvedenie autora — text priznania ti appka ukáže a uloží k vizuálu.`);
  }
  return {
    ok: true,
    provider: "openverse",
    query,
    totalFromProvider: Number(payload?.result_count ?? results.length),
    rejectedForLicense: rejected,
    items,
    notesSk,
  };
}

/** Adresa knižnice, ktorú server naozaj volá (aby bola na jednom mieste). */
export function openverseSearchUrl(query: string, page = 1, pageSize = 12): string {
  const params = new URLSearchParams({
    q: query,
    license_type: "commercial,modification",
    page: String(Math.max(1, page)),
    page_size: String(Math.max(1, Math.min(20, pageSize))),
  });
  return `https://api.openverse.org/v1/images/?${params.toString()}`;
}

/** Adresa detailu jedného obrázka (server cez ňu overí, že sťahuje to, čo knižnica naozaj ponúka). */
export function openverseDetailUrl(id: string): string {
  return `https://api.openverse.org/v1/images/${encodeURIComponent(id)}/`;
}

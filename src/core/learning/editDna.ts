/**
 * Edit DNA — učenie sa z tvojich rozhodnutí.
 *
 * Princíp (a jeho hranice, aby to nebolo klamstvo):
 *  - Učí sa VÝHRADNE z toho, čo klikneš: ktoré zásahy prijmeš a ktoré zamietneš.
 *  - Je to štatistika tvojich klikov, nie „AI, ktorá ťa chápe“.
 *  - Ukladá sa LOKÁLNE v prehliadači (localStorage). Nikam sa neposiela, 0 tokenov.
 *  - Pri malom počte rozhodnutí NEROBÍ NIČ a povie to. Žiadne domýšľanie z dvoch klikov.
 *  - Nikdy nemení štruktúru plánu: neodstraňuje zásahy, nepridáva ich a neprehadzuje
 *    poradie. Upraví len istotu a k zmene pripíše dôvod. Ty máš stále posledné slovo.
 */

export const EDIT_DNA_STORAGE_KEY = "omnistrih_edit_dna_v1";

/** Od koľkých rozhodnutí o konkrétnom type si dovolíme niečo tvrdiť. */
export const MIN_SAMPLES = 5;

export interface DnaCounters {
  accepted: number;
  rejected: number;
}

export interface EditDnaProfile {
  version: 1;
  totals: DnaCounters & { sessions: number };
  /** Podľa typu zásahu (CUT, ZOOM, SPEED, …). */
  byType: Record<string, DnaCounters>;
  /** Podľa režimu strihu — človek môže chcieť iný strih na Reels a iný v podcaste. */
  byMode: Record<string, Record<string, DnaCounters>>;
  updatedAt: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface DnaPlanItemLike {
  id: string;
  type: string;
  confidence: number;
}

export interface DnaBiasResult<T extends DnaPlanItemLike> {
  /** Plán s upravenou istotou. Poradie, počet ani typy zásahov sa nemenia. */
  plan: (T & { dnaNote?: string; dnaDelta?: number })[];
  /** Vety pre UI — čo som sa naučil a kde mám málo dát. */
  insights: string[];
  /** Koľko zásahov som upravil (0 = držím sa stranou). */
  adjustedCount: number;
  /** True, len ak existuje aspoň jedno spoľahlivé zistenie. */
  learned: boolean;
}

// ============================================================
// Profil
// ============================================================

export function emptyProfile(): EditDnaProfile {
  return {
    version: 1,
    totals: { accepted: 0, rejected: 0, sessions: 0 },
    byType: {},
    byMode: {},
    updatedAt: new Date(0).toISOString(),
  };
}

function safeStorage(storage?: StorageLike | null): StorageLike | null {
  if (storage) return storage;
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    /* prehliadač môže blokovať prístup — vtedy proste neukladáme */
  }
  return null;
}

function sanitizeCounters(raw: any): DnaCounters {
  const accepted = Number(raw?.accepted);
  const rejected = Number(raw?.rejected);
  return {
    accepted: Number.isFinite(accepted) && accepted > 0 ? Math.floor(accepted) : 0,
    rejected: Number.isFinite(rejected) && rejected > 0 ? Math.floor(rejected) : 0,
  };
}

/** Načíta profil. Poškodené dáta nikdy nespadnú — radšej prázdny profil. */
export function loadEditDna(storage?: StorageLike | null): EditDnaProfile {
  const store = safeStorage(storage);
  if (!store) return emptyProfile();
  try {
    const raw = store.getItem(EDIT_DNA_STORAGE_KEY);
    if (!raw) return emptyProfile();
    const parsed = JSON.parse(raw);
    const profile = emptyProfile();

    profile.totals = { ...sanitizeCounters(parsed?.totals), sessions: Math.max(0, Number(parsed?.totals?.sessions) || 0) };
    if (parsed?.byType && typeof parsed.byType === "object") {
      for (const [type, counters] of Object.entries(parsed.byType)) {
        profile.byType[String(type).toUpperCase()] = sanitizeCounters(counters);
      }
    }
    if (parsed?.byMode && typeof parsed.byMode === "object") {
      for (const [mode, types] of Object.entries(parsed.byMode)) {
        if (!types || typeof types !== "object") continue;
        const inner: Record<string, DnaCounters> = {};
        for (const [type, counters] of Object.entries(types as Record<string, any>)) {
          inner[String(type).toUpperCase()] = sanitizeCounters(counters);
        }
        profile.byMode[String(mode).toUpperCase()] = inner;
      }
    }
    profile.updatedAt = typeof parsed?.updatedAt === "string" ? parsed.updatedAt : profile.updatedAt;
    return profile;
  } catch {
    return emptyProfile();
  }
}

export function saveEditDna(profile: EditDnaProfile, storage?: StorageLike | null): boolean {
  const store = safeStorage(storage);
  if (!store) return false;
  try {
    store.setItem(EDIT_DNA_STORAGE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    // Napr. plný alebo zakázaný localStorage — nesmieme zhodiť aplikáciu.
    return false;
  }
}

export function resetEditDna(storage?: StorageLike | null): EditDnaProfile {
  const store = safeStorage(storage);
  try {
    store?.removeItem(EDIT_DNA_STORAGE_KEY);
  } catch {
    /* ignorujeme */
  }
  return emptyProfile();
}

// ============================================================
// Zapisovanie rozhodnutí
// ============================================================

export interface RecordedDecision {
  type: string;
  decision: "accept" | "reject";
}

/**
 * Zapíše rozhodnutia do profilu (nemennou cestou — vráti nový profil).
 * Volá sa v momente, keď používateľ potvrdí plán („Použiť vybrané“).
 */
export function recordDecisions(
  profile: EditDnaProfile,
  mode: string,
  decisions: RecordedDecision[],
  now: Date = new Date(),
): EditDnaProfile {
  if (decisions.length === 0) return profile;

  const next: EditDnaProfile = {
    version: 1,
    totals: { ...profile.totals, sessions: profile.totals.sessions + 1 },
    byType: { ...profile.byType },
    byMode: { ...profile.byMode },
    updatedAt: now.toISOString(),
  };

  const modeKey = String(mode || "CUSTOM").toUpperCase();
  const modeBucket: Record<string, DnaCounters> = { ...(next.byMode[modeKey] || {}) };

  for (const d of decisions) {
    const type = String(d.type || "").toUpperCase();
    if (!type) continue;

    const globalCounters = next.byType[type] || { accepted: 0, rejected: 0 };
    const modeCounters = modeBucket[type] || { accepted: 0, rejected: 0 };

    if (d.decision === "accept") {
      next.totals.accepted++;
      next.byType[type] = { ...globalCounters, accepted: globalCounters.accepted + 1 };
      modeBucket[type] = { ...modeCounters, accepted: modeCounters.accepted + 1 };
    } else {
      next.totals.rejected++;
      next.byType[type] = { ...globalCounters, rejected: globalCounters.rejected + 1 };
      modeBucket[type] = { ...modeCounters, rejected: modeCounters.rejected + 1 };
    }
  }

  next.byMode[modeKey] = modeBucket;
  return next;
}

// ============================================================
// Vyhodnotenie
// ============================================================

export function totalDecisions(counters: DnaCounters): number {
  return counters.accepted + counters.rejected;
}

/** Podiel prijatia 0–1, alebo null ak je dát primalo (menej než MIN_SAMPLES). */
export function acceptRate(counters: DnaCounters, minSamples = MIN_SAMPLES): number | null {
  const total = totalDecisions(counters);
  if (total < minSamples) return null;
  return counters.accepted / total;
}

export interface ResolvedStats {
  counters: DnaCounters;
  scope: "mode" | "type" | null;
}

/** Preferuje štatistiku pre konkrétny režim, keď je v nej dosť dát. */
export function resolveStats(
  profile: EditDnaProfile,
  mode: string,
  type: string,
  minSamples = MIN_SAMPLES,
): ResolvedStats {
  const typeKey = String(type || "").toUpperCase();
  const modeKey = String(mode || "CUSTOM").toUpperCase();

  const modeCounters = profile.byMode?.[modeKey]?.[typeKey];
  if (modeCounters && totalDecisions(modeCounters) >= minSamples) {
    return { counters: modeCounters, scope: "mode" };
  }
  const typeCounters = profile.byType?.[typeKey];
  if (typeCounters && totalDecisions(typeCounters) >= minSamples) {
    return { counters: typeCounters, scope: "type" };
  }
  return { counters: typeCounters || { accepted: 0, rejected: 0 }, scope: null };
}

const TYPE_LABELS_SK: Record<string, string> = {
  CUT: "strihy (výplň a rozbehy)",
  KEEP: "ponechané pasáže",
  SPEED: "zrýchlenie",
  ZOOM: "punch-in (zmena framingu)",
  CROP: "zmena formátu",
  CAPTION: "titulky",
  HOOK: "hook na začiatok",
  HIGHLIGHT: "highlight klipy",
  BROLL: "B-roll",
  SFX: "zvukové akcenty",
  MUSIC: "hudba na pozadí",
};

export function typeLabelSk(type: string): string {
  return TYPE_LABELS_SK[String(type).toUpperCase()] || String(type).toLowerCase();
}

/**
 * Upraví istotu zásahov podľa tvojich rozhodnutí.
 * Zmena je zámerne malá (±0,15) a vždy vysvetlená — istota nie je náhrada za
 * tvoje rozhodnutie, len zoradenie pozornosti.
 */
export function applyDnaBias<T extends DnaPlanItemLike>(
  plan: T[],
  profile: EditDnaProfile,
  opts: { mode?: string; enabled?: boolean; minSamples?: number } = {},
): DnaBiasResult<T> {
  const enabled = opts.enabled !== false;
  const mode = opts.mode || "CUSTOM";
  const minSamples = opts.minSamples ?? MIN_SAMPLES;
  const insights: string[] = [];

  if (!enabled) {
    return { plan: [...plan], insights: [], adjustedCount: 0, learned: false };
  }

  const items = profile.byType ? Object.entries(profile.byType) : [];
  const reliable = items.filter(([, c]) => totalDecisions(c) >= minSamples);

  if (totalDecisions(profile.totals) === 0) {
    insights.push(
      `Zatiaľ nemám žiadne tvoje rozhodnutia. Keď klikneš „Použiť vybrané“, zapamätám si, čo si prijala a čo zamietla — a nabudúce ti to vrátim späť.`,
    );
  } else if (reliable.length === 0) {
    insights.push(
      `Mám ${totalDecisions(profile.totals)} rozhodnutí, ale na spoľahlivý záver potrebujem aspoň ${minSamples} pri jednom type zásahu. Dovtedy nič neupravujem — nechcem hádať z dvoch klikov.`,
    );
  }

  let adjustedCount = 0;

  const biased = plan.map((item) => {
    const { counters, scope } = resolveStats(profile, mode, item.type, minSamples);
    const rate = acceptRate(counters, minSamples);
    if (rate === null) return { ...item };

    const delta = Math.round(Math.max(-0.15, Math.min(0.15, (rate - 0.5) * 0.3)) * 100) / 100;
    const confidence = Math.round(Math.max(0.05, Math.min(0.97, item.confidence + delta)) * 100) / 100;
    const total = totalDecisions(counters);
    const accepted = counters.accepted;
    const where = scope === "mode" ? "v tomto režime" : "celkovo";

    let dnaNote: string | undefined;
    if (rate >= 0.75) {
      dnaNote = `Podľa tvojich rozhodnutí ${where} tento typ prijímaš (${accepted} z ${total}) — držím ho v popredí.`;
    } else if (rate <= 0.3) {
      dnaNote = `Tento typ zásahu ${where} skôr zamietaš (${accepted} z ${total}) — nechávam ho ako návrh na zváženie, nie ako odporúčanie.`;
    } else {
      dnaNote = `Podľa tvojich rozhodnutí ${where} je tento typ na hrane (${accepted} z ${total}) — nechávam istotu bez zmeny.`;
    }

    if (delta !== 0) adjustedCount++;

    return { ...item, confidence, dnaNote, dnaDelta: delta };
  });

  if (reliable.length > 0) {
    const sorted = reliable
      .map(([type, counters]) => ({ type, counters, rate: acceptRate(counters, minSamples)! }))
      .sort((a, b) => b.rate - a.rate);

    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (best && best.rate >= 0.75) {
      insights.push(
        `Najviac ti sedí ${typeLabelSk(best.type)} — prijímaš ${best.counters.accepted} z ${totalDecisions(best.counters)}.`,
      );
    }
    if (worst && worst.rate <= 0.3 && worst.type !== best?.type) {
      insights.push(
        `Naopak ${typeLabelSk(worst.type)} zvyčajne zamietaš (${worst.counters.accepted} z ${totalDecisions(worst.counters)}) — v pláne ho uvidíš, ale s nižšou istotou.`,
      );
    }
  }

  return { plan: biased, insights, adjustedCount, learned: reliable.length > 0 };
}

// ============================================================
// Prehľad pre používateľa („Môj štýl“)
// ============================================================

export interface DnaTypeRow {
  type: string;
  labelSk: string;
  accepted: number;
  rejected: number;
  rate: number | null;
  reliable: boolean;
}

export function dnaTypeRows(profile: EditDnaProfile): DnaTypeRow[] {
  return Object.entries(profile.byType || {})
    .map(([type, counters]) => ({
      type,
      labelSk: typeLabelSk(type),
      accepted: counters.accepted,
      rejected: counters.rejected,
      rate: acceptRate(counters),
      reliable: totalDecisions(counters) >= MIN_SAMPLES,
    }))
    .sort((a, b) => {
      if (a.reliable !== b.reliable) return a.reliable ? -1 : 1;
      return totalDecisions(b) - totalDecisions(a);
    });
}

export function dnaSummarySk(profile: EditDnaProfile): string {
  const total = totalDecisions(profile.totals);
  if (total === 0) {
    return "Zatiaľ som sa nič nenaučil — nemáš potvrdený ani jeden plán. Učím sa len z tvojich klikov, nikdy sám od seba.";
  }
  const sessions = profile.totals.sessions;
  const reliable = dnaTypeRows(profile).filter((r) => r.reliable).length;
  const base = `Zapamätal som si ${total} rozhodnutí z ${sessions} ${sessions === 1 ? "plánu" : "plánov"} — prijatých ${profile.totals.accepted}, zamietnutých ${profile.totals.rejected}.`;
  return reliable > 0
    ? `${base} Spoľahlivo ti rozumiem pri ${reliable} ${reliable === 1 ? "type" : "typoch"} zásahov.`
    : `${base} Na spoľahlivý záver potrebujem aspoň ${MIN_SAMPLES} rozhodnutí pri jednom type — dovtedy nič neupravujem.`;
}

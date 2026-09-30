/**
 * VLASTNÝ ŠTÝL KLIENTA (brand kit) — krok B++.
 *
 * Prečo: typická práca je **mix rôznych klientov**. Každý má svoje farby, písmo
 * a spôsob titulkov. Bez uloženého profilu to znamená pri každej zakázke znova
 * klikať farby — presne tá strata času, ktorú má nástroj odstrániť.
 *
 * Ako: profil = **odchýlky od hotového štýlu** (nie nový štýl od nuly). Takže
 * používateľ si vyberie najbližší štýl, doladí farby a veľkosť, pomenuje ho
 * („Klient A – beauty“) a nabudúce je to jeden klik.
 *
 * Zásady:
 *  - **Nič sa nedomýšľa:** keď je hodnota mimo rozsahu, oreže sa a appka napíše,
 *    na akú hodnotu (nie tichá zmena).
 *  - **Farby sa kontrolujú:** prijímame len platný tvar; zlý vstup sa zahodí
 *    a napíše sa prečo (nikdy nie „nejaká“ farba).
 *  - **Odchýlky nestrácajú poctivosť:** profil nemôže vypnúť upozornenia ani
 *    zmeniť to, že sa text páli do obrazu — mení len vzhľad.
 */

import {
  CAPTION_STYLES,
  getCaptionStyle,
  applyCaptionOverrides,
  normalizeOverrides,
  hexToAssColor,
  assColorToHex,
  type CaptionAnimation,
  type CaptionOverrides,
  type CaptionStyleId,
  type CaptionStyleSpec,
} from "./subtitleRender";

// Farby a odchýlky (UI tvar ↔ ASS) sú v `subtitleRender.ts` — patria k definícii
// štýlu. Tu ich len znovu sprístupňujeme, aby si nič nemuselo pamätať dve cesty.
export {
  hexToAssColor,
  assColorToHex,
  OVERRIDE_LIMITS,
  normalizeOverrides,
  applyCaptionOverrides,
} from "./subtitleRender";
export type { CaptionOverrides, NormalizedOverrides } from "./subtitleRender";

// ---------------------------------------------------------------------------
// Profil klienta
// ---------------------------------------------------------------------------

export interface CaptionProfile {
  id: string;
  /** Názov, ktorý uvidíš v zozname (typicky meno klienta alebo projektu). */
  name: string;
  /** Základný štýl, z ktorého profil vychádza. */
  styleId: CaptionStyleId;
  overrides: CaptionOverrides;
  /** Poznámka pre seba (napr. „brand manuál: modrá #0A3D91“). */
  noteSk?: string;
  createdAt: string;
  updatedAt: string;
}

export type ProfileValidation =
  | { ok: true; profile: Omit<CaptionProfile, "createdAt" | "updatedAt">; notesSk: string[] }
  | { ok: false; errorSk: string };

export const PROFILE_LIMITS = { maxProfiles: 50, maxNameLength: 40, maxNoteLength: 200 } as const;

/** Bezpečné id profilu (ide do URL aj do JSONu — nič, čo by mohlo niečo rozbiť). */
export function profileIdFromName(name: string): string {
  const base = String(name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return base || "profil";
}

export function isSafeProfileId(id: unknown): boolean {
  return /^[a-z0-9][a-z0-9-]{0,40}$/.test(String(id ?? ""));
}

/**
 * Skontroluje profil z UI (alebo z disku). Nikdy nehádže — vráti buď hotový
 * profil, alebo vetu s dôvodom.
 */
export function validateProfile(raw: unknown, existingId?: string): ProfileValidation {
  if (!raw || typeof raw !== "object") {
    return { ok: false, errorSk: "Profil nemá žiadne dáta." };
  }
  const src = raw as Record<string, unknown>;

  const name = String(src.name ?? "").trim();
  if (name.length === 0) return { ok: false, errorSk: "Profil potrebuje názov (napr. „Klient A – beauty“)." };
  if (name.length > PROFILE_LIMITS.maxNameLength) {
    return {
      ok: false,
      errorSk: `Názov profilu je príliš dlhý (${name.length} znakov, maximum ${PROFILE_LIMITS.maxNameLength}).`,
    };
  }

  const styleId = String(src.styleId ?? "") as CaptionStyleId;
  if (!CAPTION_STYLES.some((s) => s.id === styleId)) {
    return {
      ok: false,
      errorSk: `Neznámy základný štýl „${styleId}“. Na výber je: ${CAPTION_STYLES.map((s) => s.id).join(", ")}.`,
    };
  }

  const note = src.noteSk === undefined || src.noteSk === null ? "" : String(src.noteSk).trim();
  if (note.length > PROFILE_LIMITS.maxNoteLength) {
    return {
      ok: false,
      errorSk: `Poznámka je príliš dlhá (${note.length} znakov, maximum ${PROFILE_LIMITS.maxNoteLength}).`,
    };
  }

  const { overrides, notesSk } = normalizeOverrides(src.overrides);

  const idSource = existingId ?? (src.id !== undefined ? String(src.id) : "");
  const id = idSource && isSafeProfileId(idSource) ? String(idSource) : profileIdFromName(name);

  return {
    ok: true,
    profile: { id, name, styleId, overrides, ...(note ? { noteSk: note } : {}) },
    notesSk,
  };
}

// ---------------------------------------------------------------------------
// Hotové profily (aby sa dalo začať aj bez klikania farieb)
// ---------------------------------------------------------------------------

export interface ProfileTemplate {
  key: string;
  name: string;
  descriptionSk: string;
  styleId: CaptionStyleId;
  overrides: CaptionOverrides;
}

/**
 * Tri štartovacie profily. Sú zámerne jednoduché a **pomenované po použití**,
 * nie po značke — nič cudzie nekopírujeme.
 */
export const PROFILE_TEMPLATES: ProfileTemplate[] = [
  {
    key: "firma-modra",
    name: "Firemné (modrá, pokojné)",
    descriptionSk: "Biele písmo s tmavomodrým obrysom pre svetlé firemné zábery; celá veta, bez zvýrazňovania.",
    styleId: "CLEAN",
    overrides: { outlineHex: "#0A2E6B", fontSizeRatio: 52, bottomMarginRatio: 0.16, animation: "fade" },
  },
  {
    key: "eshop-zlata",
    name: "E-shop (zlatá, výrazné)",
    descriptionSk: "Biele písmo, zlaté zvýraznenie ceny a čísel — predajný štýl na 9:16.",
    styleId: "KEYWORD_POP",
    overrides: { highlightHex: "#FFC400", fontSizeRatio: 62, animation: "fade" },
  },
  {
    key: "podcast-tepla",
    name: "Podcast (teplá biela, pokojné)",
    descriptionSk: "Teplý odtieň textu bez zvýrazňovania, väčší okraj — nič nezakrýva tvár.",
    styleId: "PODCAST",
    overrides: { primaryHex: "#F5EFE6", outlineHex: "#12100E", bottomMarginRatio: 0.13 },
  },
];

/** Profil zhotovený zo šablóny (id + časy). */
export function profileFromTemplate(template: ProfileTemplate, now = new Date().toISOString()): CaptionProfile {
  return {
    id: profileIdFromName(template.name),
    name: template.name,
    styleId: template.styleId,
    overrides: template.overrides,
    noteSk: template.descriptionSk,
    createdAt: now,
    updatedAt: now,
  };
}

/** Štýl, ktorý sa naozaj použije pri renderi: základ + odchýlky profilu. */
export function resolveProfileStyle(profile: Pick<CaptionProfile, "styleId" | "overrides">): CaptionStyleSpec {
  return applyCaptionOverrides(getCaptionStyle(profile.styleId), profile.overrides);
}

/** Jedna veta pre človeka: čo profil mení oproti základnému štýlu. */
export function describeProfileSk(profile: Pick<CaptionProfile, "styleId" | "overrides">): string {
  const base = getCaptionStyle(profile.styleId);
  const merged = resolveProfileStyle(profile);
  const changes: string[] = [];

  const colorName = (hex?: string) => (hex ? hex : "—");
  if (merged.primaryColor !== base.primaryColor) changes.push(`farba textu ${colorName(assColorToHex(merged.primaryColor) ?? undefined)}`);
  if (merged.highlightColor !== base.highlightColor) changes.push(`zvýraznenie ${colorName(assColorToHex(merged.highlightColor) ?? undefined)}`);
  if (merged.outlineColor !== base.outlineColor) changes.push(`obrys ${colorName(assColorToHex(merged.outlineColor) ?? undefined)}`);
  if (merged.boxColor !== base.boxColor) changes.push(`podklad ${colorName(assColorToHex(merged.boxColor ?? "") ?? undefined)}`);
  if (merged.fontSizeRatio !== base.fontSizeRatio) changes.push(`veľkosť ${merged.fontSizeRatio}‰ (základ ${base.fontSizeRatio}‰)`);
  if (merged.wordsPerChunk !== base.wordsPerChunk) {
    changes.push(merged.wordsPerChunk === 0 ? "celá veta naraz" : `${merged.wordsPerChunk} slová naraz`);
  }
  if (merged.uppercase !== base.uppercase) changes.push(merged.uppercase ? "VEĽKÉ PÍSMENÁ" : "malé písmená");
  if (merged.animation !== base.animation) changes.push(`animácia ${merged.animation ?? "none"}`);
  if (merged.bottomMarginRatio !== base.bottomMarginRatio) {
    changes.push(`odstup od spodku ${Math.round((merged.bottomMarginRatio ?? 0) * 100)} %`);
  }
  if (merged.boxed !== base.boxed) changes.push(merged.boxed ? "text na placce" : "bez placky");

  if (changes.length === 0) return `Profil používa štýl „${base.labelSk}“ bez zmien.`;
  return `Oproti štýlu „${base.labelSk}“: ${changes.join(", ")}.`;
}

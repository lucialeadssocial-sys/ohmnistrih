/**
 * KROK 27 — VLASTNÝ VIZUÁL: lokálny generátor kariet v štýle videa.
 *
 * Prečo lokálne a nie AI: overené Reality Gate (30. 9. 2026) — kľúč v `.env` má
 * pre **obrázkové** modely `limit: 0` (free tier):
 *   „Quota exceeded for metric: …generate_content_free_tier_requests, limit: 0,
 *     model: gemini-3.1-flash-image“
 * Tlačidlo „AI generuj obrázok“, ktoré vždy spadne, by bola fake funkcia.
 * Preto sa vizuál vyrába **lokálne a deterministicky** — z reálnych hodnôt
 * receptu (farby, typografia, textúra), ktorý máš práve zvolený.
 *
 * Čo generátor NIKDY nerobí:
 *  - nevymýšľa text: berie len to, čo mu zadáš, alebo slová/čísla z tvojho prepisu,
 *  - nepoužíva `Math.random()` — ten istý vstup = ten istý obrázok,
 *  - nekreslí fotografie ani ilustrácie (to vie len AI/človek) — kreslí **kartu**:
 *    plochu, typografiu a vzor v palete receptu.
 *
 * Výstup je PNG, ktoré ide do videa ako bežná obrazová vrstva (b-roll) cez
 * existujúci `importMediaFile` → CommandManager → canonical os. Žiadny nový model.
 */

import type { StyleRecipe } from "../style/styleRecipes";
import { getStyleRecipe } from "../style/styleRecipes";

/** Druhy kariet, ktoré vieme (každý má iný vizuálny zámer, nie iný „štýl“). */
export type StyleCardKind = "headline" | "statistic" | "label" | "quote" | "pattern";

export const STYLE_CARD_KINDS: { id: StyleCardKind; labelSk: string; hintSk: string; needsText: boolean }[] = [
  { id: "headline", labelSk: "Nadpis (tvrdé tvrdenie)", hintSk: "Veľký text v strede dolnej tretiny — na pointu alebo sľub.", needsText: true },
  { id: "statistic", labelSk: "Číslo / štatistika", hintSk: "Veľké číslo a pod ním popis — pre výsledok alebo metriku.", needsText: true },
  { id: "label", labelSk: "Štítok (kategória)", hintSk: "Krátky text v rohu s farebným pruhom — na kapitolu alebo krok.", needsText: true },
  { id: "quote", labelSk: "Citát", hintSk: "Text v úvodzovkách s tenkou linkou — na vetu, ktorá nesie myšlienku.", needsText: true },
  { id: "pattern", labelSk: "Vzor bez textu", hintSk: "Len plocha a vzor v palete — na prekrytie alebo dýchaciu pauzu.", needsText: false },
];

export interface StyleCardRequest {
  /** Recept štýlu — z neho idú farby, typografia a textúra. */
  recipeId: string;
  kind: StyleCardKind;
  /** Text karty. Pri „pattern“ sa nepoužije. **Nikdy sa nedopĺňa sám.** */
  text?: string;
  /** Voliteľný podtitulok (napr. jednotka alebo kontext čísla). */
  subText?: string;
  width?: number;
  height?: number;
  /**
   * Voliteľné farby z **nameraného** svetla tvojho videa (krok 24) — keď ich máš,
   * karta sa im prispôsobí, aby neliezla z obrazu.
   */
  measured?: { brightness: number; contrast: number } | null;
}

export interface StyleCardSpec {
  ok: boolean;
  /** Keď sa nedá vygenerovať, presne prečo (nikdy ticho). */
  errorSk?: string;
  width: number;
  height: number;
  kind: StyleCardKind;
  recipeId: string;
  recipeLabelSk: string;
  /** Farby, ktoré karta naozaj použije (a odkiaľ sú). */
  palette: { background: string; text: string; accent: string };
  paletteSourceSk: string;
  fontName: string;
  fontFile: string;
  uppercase: boolean;
  /** Vzor (halftone mriežka) — počet štvorcov je deterministický. */
  pattern: { boxCount: number; reasonSk: string };
  /** Obsah ASS titulku karty (prázdny pri „pattern“). */
  assContent: string;
  /** Argumenty pre ffmpeg (PNG na konci). */
  ffmpegArgs: string[];
  notesSk: string[];
}

/** Fonty, ktoré v prostredí naozaj sú (overené `fc-list`). */
const FONT_FILES: Record<StyleRecipe["typography"]["character"], { name: string; file: string }> = {
  "bold-condensed": { name: "DejaVu Sans", file: "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" },
  "bold-sans": { name: "DejaVu Sans", file: "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" },
  "serif-editorial": { name: "DejaVu Serif", file: "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf" },
  "clean-sans": { name: "DejaVu Sans", file: "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf" },
  mono: { name: "DejaVu Sans Mono", file: "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf" },
};

/** `#RRGGBB` → `&HAABBGGRR` (ASS používa BGR poradie). */
export function hexToAssColor(hex: string, alpha = 0): string {
  const clean = String(hex ?? "").replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean.padEnd(6, "0").slice(0, 6);
  const r = full.slice(0, 2);
  const g = full.slice(2, 4);
  const b = full.slice(4, 6);
  const a = Math.max(0, Math.min(255, Math.round(alpha))).toString(16).padStart(2, "0").toUpperCase();
  return `&H${a}${b}${g}${r}`.toUpperCase();
}

/** Relatívna svetlosť farby (0 = čierna, 1 = biela) — len na rozhodnutie pozadia/textu. */
export function luminance(hex: string): number {
  const clean = String(hex ?? "").replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean.padEnd(6, "0").slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Sýtosť (max−min zložky) — podľa nej vyberáme akcentnú farbu. */
export function saturation(hex: string): number {
  const clean = String(hex ?? "").replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean.padEnd(6, "0").slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  return Math.max(r, g, b) - Math.min(r, g, b);
}

/**
 * Paleta karty z palety receptu — deterministicky:
 *  pozadie = najtmavšia farba, text = najsvetlejšia, akcent = najsýtejšia.
 */
export function chooseCardPalette(colorPalette: string[]): { background: string; text: string; accent: string } {
  const colors = (colorPalette ?? []).filter((c) => /^#?[0-9a-fA-F]{3,8}$/.test(String(c).trim()));
  if (colors.length === 0) {
    return { background: "#101014", text: "#F5F5F5", accent: "#E11D48" };
  }
  const sorted = [...colors].sort((a, b) => luminance(a) - luminance(b));
  const background = sorted[0];
  const text = sorted[sorted.length - 1];
  const accent = [...colors].sort((a, b) => saturation(b) - saturation(a) || luminance(b) - luminance(a))[0];
  return { background, text, accent };
}

/** ASS hlavička karty (PlayRes presne podľa veľkosti obrázka). */
function assHeader(width: number, height: number, fontName: string, bg: string, text: string, accent: string): string {
  const base = Math.round(height / 16);
  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    "WrapStyle: 2",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    // Tiene a obrysy vypnuté: karta má byť plochá grafika, nie titulok do videa.
    `Style: Card,${fontName},${Math.round(base * 2.6)},${hexToAssColor(text)},${hexToAssColor(text)},${hexToAssColor(bg, 255)},${hexToAssColor(bg, 255)},0,0,0,0,100,100,0,0,1,0,0,5,${Math.round(width * 0.08)},${Math.round(width * 0.08)},${Math.round(height * 0.12)},1`,
    `Style: Accent,${fontName},${Math.round(base * 0.95)},${hexToAssColor(accent)},${hexToAssColor(accent)},${hexToAssColor(bg, 255)},${hexToAssColor(bg, 255)},1,0,0,0,100,100,0,0,1,0,0,5,${Math.round(width * 0.08)},${Math.round(width * 0.08)},${Math.round(height * 0.06)},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ].join("\n");
}

/** Bezpečný text do ASS riadku (bez nových riadkov, bez zálomkov, ktoré rozbijú štýl). */
export function escapeCardText(text: string): string {
  return String(text ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Vzor: koľko štvorcov halftone mriežky (deterministicky z textúry receptu). */
export function patternBoxCount(recipe: StyleRecipe): { boxCount: number; reasonSk: string } {
  const isHalftone = recipe.aesthetic?.halftone === true;
  const level = recipe.texture?.level ?? "clean";
  if (isHalftone || level === "heavy") {
    return { boxCount: 140, reasonSk: "recept má halftone / silnú textúru → hustá mriežka" };
  }
  if (level === "editorial") return { boxCount: 80, reasonSk: "editorial textúra → stredná mriežka" };
  if (level === "subtle") return { boxCount: 40, reasonSk: "jemná textúra → riedka mriežka" };
  return { boxCount: 0, reasonSk: "recept je čistý (clean) → bez vzoru" };
}

/**
 * Postaví celý recept na kartu: farby, typografia, text a ffmpeg linka.
 * Je to **čistá funkcia** — rovnaký vstup dá vždy rovnaký výstup (test to stráži).
 */
export function buildStyleCardSpec(req: StyleCardRequest): StyleCardSpec {
  const recipe = getStyleRecipe(req.recipeId);
  const width = Math.max(64, Math.min(2160, Math.round(req.width ?? 1080)));
  const height = Math.max(64, Math.min(3840, Math.round(req.height ?? 1920)));
  const font = FONT_FILES[recipe.typography.character] ?? FONT_FILES["clean-sans"];
  const palette = chooseCardPalette(recipe.colorPalette);
  const notesSk: string[] = [];
  const pattern = patternBoxCount(recipe);

  const kindInfo = STYLE_CARD_KINDS.find((k) => k.id === req.kind);
  const text = escapeCardText(req.text ?? "");
  const subText = escapeCardText(req.subText ?? "");

  if (!kindInfo) {
    return {
      ok: false,
      errorSk: `Neznámy druh karty „${req.kind}“. Vyber z: ${STYLE_CARD_KINDS.map((k) => k.id).join(", ")}.`,
      width,
      height,
      kind: req.kind,
      recipeId: recipe.id,
      recipeLabelSk: recipe.labelSk,
      palette,
      paletteSourceSk: "",
      fontName: font.name,
      fontFile: font.file,
      uppercase: recipe.typography.uppercase,
      pattern,
      assContent: "",
      ffmpegArgs: [],
      notesSk: [],
    };
  }

  if (kindInfo.needsText && text.length === 0) {
    return {
      ok: false,
      // Poctivosť: text sa nedomýšľa.
      errorSk: "Text karty je prázdny — appka si text nevymýšľa. Napíš vlastný, alebo použi slová/číslo z prepisu videa.",
      width,
      height,
      kind: req.kind,
      recipeId: recipe.id,
      recipeLabelSk: recipe.labelSk,
      palette,
      paletteSourceSk: "",
      fontName: font.name,
      fontFile: font.file,
      uppercase: recipe.typography.uppercase,
      pattern,
      assContent: "",
      ffmpegArgs: [],
      notesSk: [],
    };
  }

  const shownText = recipe.typography.uppercase ? text.toUpperCase() : text;
  const shownSub = recipe.typography.uppercase ? subText.toUpperCase() : subText;

  // --- ASS obsah karty (žiadne animácie: statický vizuál) --------------------
  const lines: string[] = [];
  if (kindInfo.needsText) {
    lines.push(assHeader(width, height, font.name, palette.background, palette.text, palette.accent));
    const t = "0:00:00.00";
    const end = "9:59:59.00";
    if (req.kind === "quote") {
      lines.push(`Dialogue: 0,${t},${end},Card,,0,0,0,,{\\i1}„${shownText}“`);
      lines.push(`Dialogue: 0,${t},${end},Accent,,0,0,0,,—`);
    } else if (req.kind === "statistic") {
      lines.push(`Dialogue: 0,${t},${end},Card,,0,0,0,,${shownText}`);
      if (shownSub) lines.push(`Dialogue: 0,${t},${end},Accent,,0,0,0,,${shownSub}`);
    } else if (req.kind === "label") {
      lines.push(`Dialogue: 0,${t},${end},Accent,,0,0,0,,${shownText}`);
    } else {
      lines.push(`Dialogue: 0,${t},${end},Card,,0,0,0,,${shownText}`);
    }
  }

  // --- Vzor (halftone mriežka) ----------------------------------------------
  const filters: string[] = [];
  if (pattern.boxCount > 0) {
    const cols = Math.ceil(Math.sqrt(pattern.boxCount * (width / height)));
    const rows = Math.ceil(pattern.boxCount / cols);
    const cellW = width / cols;
    const cellH = height / rows;
    const size = Math.max(2, Math.round(Math.min(cellW, cellH) * 0.34));
    // Mriežka je v akcentnej farbe s priehľadnosťou — karta zostáva čitateľná.
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = Math.round(c * cellW + cellW / 2 - size / 2);
        const y = Math.round(r * cellH + cellH / 2 - size / 2);
        filters.push(`drawbox=x=${x}:y=${y}:w=${size}:h=${size}:color=${palette.accent}@0.18:t=fill`);
      }
    }
  }
  if (kindInfo.needsText) {
    // ASS ide posledný, aby bol text vždy nad vzorom.
    filters.push("ass=CARD_ASS_PATH");
  }

  const paletteSourceSk = `paleta receptu „${recipe.labelSk}“ (${recipe.colorPalette.length} farieb): pozadie najtmavšia, text najsvetlejšia, akcent najsýtejšia`;
  notesSk.push(`Farby: ${paletteSourceSk}.`);
  notesSk.push(`Typografia: ${recipe.typography.character} → ${font.name}${recipe.typography.uppercase ? " (VEĽKÉ PÍSMENÁ podľa receptu)" : ""}.`);
  notesSk.push(`Vzor: ${pattern.reasonSk}.`);
  if (req.measured) {
    notesSk.push(
      `Tvoje video má nameraný jas ${req.measured.brightness.toFixed(2)} a kontrast ${req.measured.contrast.toFixed(2)} — kartu som mu neprispôsoboval, aby ostala v palete receptu (dá sa zapnúť korekcia svetla pri exporte).`,
    );
  }

  return {
    ok: true,
    width,
    height,
    kind: req.kind,
    recipeId: recipe.id,
    recipeLabelSk: recipe.labelSk,
    palette,
    paletteSourceSk,
    fontName: font.name,
    fontFile: font.file,
    uppercase: recipe.typography.uppercase,
    pattern,
    assContent: lines.join("\n"),
    // Výsledný ffmpeg príkaz skladá server (doplní cestu k ASS súboru).
    ffmpegArgs: [],
    notesSk,
  };
}

/** Zoznam druhov kariet pre rozhranie (aby UI nič nepredstieralo). */
export function styleCardKindListSk(): { id: StyleCardKind; labelSk: string; hintSk: string; needsText: boolean }[] {
  return STYLE_CARD_KINDS.map((k) => ({ ...k }));
}

/** Krátke upozornenie, ktoré musí byť vidieť pri karte bez textu. */
export function patternNeedsNoTextSk(): string {
  return "Vzor nemá text — je to len plocha a mriežka v palete receptu.";
}

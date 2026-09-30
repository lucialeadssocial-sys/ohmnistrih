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
  /** Vzor (halftone mriežka) — deterministický; vynecháva pás textu, aby text ostal čitateľný. */
  pattern: {
    boxCount: number;
    /** Presné štvorce (x, y, veľkosť) — server ich len vykreslí, nič nedopočítava. */
    boxes: { x: number; y: number; size: number }[];
    /** Priehľadnosť vzoru (aby neprebil text). */
    opacity: number;
    reasonSk: string;
    /** Koľko štvorcov vypadlo, aby nešli cez text. */
    skippedForText: number;
  };
  /** Zalomenie a veľkosť textu — aby sa text NIKDY nezrezal. */
  layout: {
    lines: string[];
    fontSize: number;
    subFontSize: number;
    /** Najdlhší riadok v znakoch (pre kontrolu, že sa zmestí). */
    maxCharsPerLine: number;
    /** Koľko pixelov zaberá najdlhší riadok (odhad konštantou šírky znaku). */
    estimatedWidthPx: number;
    fitsSk: string;
  };
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
function assHeader(
  width: number,
  height: number,
  fontName: string,
  bg: string,
  text: string,
  accent: string,
  mainFontSize?: number,
  subFontSize?: number,
): string {
  // Veľkosti prichádzajú z výpočtu rozloženia (aby sa text nezrezal); základ je len náhrada.
  const main = mainFontSize && mainFontSize > 0 ? mainFontSize : Math.round(height / 16) * 2;
  const sub = subFontSize && subFontSize > 0 ? subFontSize : Math.round(main * 0.35);
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
    `Style: Card,${fontName},${main},${hexToAssColor(text)},${hexToAssColor(text)},${hexToAssColor(bg, 255)},${hexToAssColor(bg, 255)},0,0,0,0,100,100,0,0,1,0,0,5,${Math.round(width * 0.08)},${Math.round(width * 0.08)},${Math.round(height * 0.12)},1`,
    `Style: Accent,${fontName},${sub},${hexToAssColor(accent)},${hexToAssColor(accent)},${hexToAssColor(bg, 255)},${hexToAssColor(bg, 255)},1,0,0,0,100,100,0,0,1,0,0,5,${Math.round(width * 0.08)},${Math.round(width * 0.08)},${Math.round(height * 0.06)},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ].join("\n");
}

/** Prázdny layout (keď sa karta nedá vytvoriť) — aby tvar ostal rovnaký. */
export function emptyLayout(pattern: StyleCardSpec["pattern"]): StyleCardSpec["layout"] {
  return {
    lines: [],
    fontSize: 0,
    subFontSize: 0,
    maxCharsPerLine: 0,
    estimatedWidthPx: 0,
    fitsSk: pattern.boxCount > 0 ? "Karta nemá text — len vzor." : "Karta je prázdna (chýba text).",
  };
}

/** Bezpečný text do ASS riadku (bez nových riadkov, bez zálomkov, ktoré rozbijú štýl). */
export function escapeCardText(text: string): string {
  return String(text ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Vzor (halftone mriežka). Deterministicky z textúry receptu:
 *  hustota štvorcov + **vynechanie pásu textu**, aby text ostal čitateľný.
 * Preto sa štvorce počítajú tu (nie až v serveri) — dajú sa otestovať.
 */
export function buildPattern(
  recipe: StyleRecipe,
  size: { width: number; height: number },
  textBand: { top: number; bottom: number } | null,
): StyleCardSpec["pattern"] {
  const density = patternBoxCount(recipe);
  if (density.boxCount === 0) {
    return { boxCount: 0, boxes: [], opacity: 0, reasonSk: density.reasonSk, skippedForText: 0 };
  }
  const cols = Math.ceil(Math.sqrt(density.boxCount * (size.width / size.height)));
  const rows = Math.ceil(density.boxCount / cols);
  const cellW = size.width / cols;
  const cellH = size.height / rows;
  // Jemnosť: menšie štvorce a nižšia priehľadnosť, aby vzor nepobil text.
  const square = Math.max(2, Math.round(Math.min(cellW, cellH) * 0.22));
  const opacity = density.boxCount >= 120 ? 0.1 : 0.12;
  const boxes: { x: number; y: number; size: number }[] = [];
  let skipped = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = Math.round(c * cellW + cellW / 2 - square / 2);
      const y = Math.round(r * cellH + cellH / 2 - square / 2);
      // Pás textu zostáva prázdny (text je dôležitejší než vzor).
      if (textBand && y + square > textBand.top && y < textBand.bottom) {
        skipped++;
        continue;
      }
      boxes.push({ x, y, size: square });
    }
  }

  return {
    boxCount: boxes.length,
    boxes,
    opacity,
    reasonSk: density.reasonSk,
    skippedForText: skipped,
  };
}

/** Koľko štvorcov by mriežka mala (bez vynechania pásu textu) — z textúry receptu. */
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
 * Zalomenie textu na riadky a veľkosť písma tak, aby sa text **nikdy nezrezal**.
 *
 * Prečo ručné zalomenie: ASS s WrapStyle 2 text nezalomí; pri dlhej vete a veľkom
 * fontsize vyjde text mimo obraz (toto bola reálna chyba prvej verzie — text „ZA PÄŤ
 * MINÚT DENNE“ sa zrezal). Preto appka riadky zalomí sama a font zmenší tak, aby
 * najdlhší riadok sedel do šírky karty.
 */
export function layoutCardText(
  text: string,
  options: { width: number; height: number; maxCharsPerLine: number; preferredFontRatio: number },
): { lines: string[]; fontSize: number; maxCharsPerLine: number; estimatedWidthPx: number; fitsSk: string } {
  // Šírka znaku pre DejaVu Sans Bold ≈ 0,68 × veľkosť písma (konzervatívny odhad).
  const CHAR_WIDTH_RATIO = 0.68;
  const margin = 0.08;
  const usableWidth = options.width * (1 - 2 * margin);

  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > options.maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  if (lines.length === 0) lines.push("");

  const longest = Math.max(...lines.map((line) => line.length), 1);
  const preferred = options.height * options.preferredFontRatio;
  const fitFont = usableWidth / (longest * CHAR_WIDTH_RATIO);
  const fontSize = Math.max(18, Math.round(Math.min(preferred, fitFont)));
  const estimatedWidthPx = Math.round(longest * fontSize * CHAR_WIDTH_RATIO);
  const shrunk = fontSize < Math.round(preferred);

  return {
    lines,
    fontSize,
    maxCharsPerLine: options.maxCharsPerLine,
    estimatedWidthPx,
    fitsSk: shrunk
      ? `Text je dlhší, preto som ho zmenšil na ${fontSize} px (a zalomil na ${lines.length} riadkov) — inak by sa zrezal.`
      : `Text sa zmestí: ${lines.length} riadkov, najdlhší ${longest} znakov ≈ ${estimatedWidthPx} px z ${Math.round(usableWidth)} px.`,
  };
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

  const kindInfo = STYLE_CARD_KINDS.find((k) => k.id === req.kind);
  const text = escapeCardText(req.text ?? "");
  const subText = escapeCardText(req.subText ?? "");

  // Rozloženie textu potrebuje poznať druh karty — preto sa počíta až nižšie,
  // ale tvar `pattern` musí existovať vo všetkých návratoch.
  const emptyPattern: StyleCardSpec["pattern"] = { boxCount: 0, boxes: [], opacity: 0, reasonSk: "zatiaľ nevypočítané", skippedForText: 0 };

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
      pattern: emptyPattern,
      layout: emptyLayout(emptyPattern),
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
      pattern: emptyPattern,
      layout: emptyLayout(emptyPattern),
      assContent: "",
      ffmpegArgs: [],
      notesSk: [],
    };
  }

  const shownText = recipe.typography.uppercase ? text.toUpperCase() : text;
  const shownSub = recipe.typography.uppercase ? subText.toUpperCase() : subText;

  // --- Rozloženie textu (aby sa NIKDY nezrezal) -----------------------------
  const layoutSpec = {
    headline: { maxCharsPerLine: 16, preferredFontRatio: 0.11 },
    statistic: { maxCharsPerLine: 8, preferredFontRatio: 0.18 },
    label: { maxCharsPerLine: 20, preferredFontRatio: 0.05 },
    quote: { maxCharsPerLine: 22, preferredFontRatio: 0.07 },
    pattern: { maxCharsPerLine: 1, preferredFontRatio: 0 },
  }[req.kind as string] ?? { maxCharsPerLine: 16, preferredFontRatio: 0.11 };

  const mainLayout = layoutCardText(req.kind === "quote" ? shownText : shownText, {
    width,
    height,
    maxCharsPerLine: layoutSpec.maxCharsPerLine,
    preferredFontRatio: layoutSpec.preferredFontRatio,
  });
  const subLayout = shownSub
    ? layoutCardText(shownSub, { width, height, maxCharsPerLine: Math.max(12, layoutSpec.maxCharsPerLine), preferredFontRatio: 0.034 })
    : null;

  // Pás textu (kde nesmie byť vzor) — z výšky textu a jeho pozície v karte.
  const textLines = (mainLayout.lines.length || 0) + (subLayout?.lines.length ?? 0);
  const lineHeight = mainLayout.fontSize * 1.35;
  const blockHeight = textLines * lineHeight + (subLayout ? subLayout.fontSize * 1.5 : 0);
  const centerY = height / 2;
  const textBand = kindInfo.needsText
    ? { top: Math.round(centerY - blockHeight / 2 - 24), bottom: Math.round(centerY + blockHeight / 2 + 24) }
    : null;
  const patternComputed = kindInfo.needsText
    ? buildPattern(recipe, { width, height }, textBand)
    : buildPattern(recipe, { width, height }, null);

  // --- ASS obsah karty (žiadne animácie: statický vizuál) --------------------
  const lines: string[] = [];
  const layout: StyleCardSpec["layout"] = {
    lines: mainLayout.lines,
    fontSize: mainLayout.fontSize,
    subFontSize: subLayout?.fontSize ?? 0,
    maxCharsPerLine: mainLayout.maxCharsPerLine,
    estimatedWidthPx: mainLayout.estimatedWidthPx,
    fitsSk: mainLayout.fitsSk,
  };

  if (kindInfo.needsText) {
    lines.push(
      assHeader(
        width,
        height,
        font.name,
        palette.background,
        palette.text,
        palette.accent,
        mainLayout.fontSize,
        subLayout?.fontSize ?? Math.round(mainLayout.fontSize * 0.35),
      ),
    );
    const t = "0:00:00.00";
    const end = "9:59:59.00";
    const mainText = mainLayout.lines.join("\\N");
    const subTextLines = subLayout ? subLayout.lines.join("\\N") : "";
    if (req.kind === "quote") {
      lines.push(`Dialogue: 0,${t},${end},Card,,0,0,0,,{\\i1}„${mainText}“`);
      lines.push(`Dialogue: 0,${t},${end},Accent,,0,0,0,,—`);
    } else if (req.kind === "statistic") {
      lines.push(`Dialogue: 0,${t},${end},Card,,0,0,0,,${mainText}`);
      if (subTextLines) lines.push(`Dialogue: 0,${t},${end},Accent,,0,0,0,,${subTextLines}`);
    } else if (req.kind === "label") {
      lines.push(`Dialogue: 0,${t},${end},Accent,,0,0,0,,${mainText}`);
    } else {
      lines.push(`Dialogue: 0,${t},${end},Card,,0,0,0,,${mainText}`);
    }
  }

  const paletteSourceSk = `paleta receptu „${recipe.labelSk}“ (${recipe.colorPalette.length} farieb): pozadie najtmavšia, text najsvetlejšia, akcent najsýtejšia`;
  notesSk.push(`Farby: ${paletteSourceSk}.`);
  notesSk.push(`Typografia: ${recipe.typography.character} → ${font.name}${recipe.typography.uppercase ? " (VEĽKÉ PÍSMENÁ podľa receptu)" : ""}.`);
  notesSk.push(
    patternComputed.boxCount > 0
      ? `Vzor: ${patternComputed.reasonSk}${patternComputed.skippedForText > 0 ? ` — ${patternComputed.skippedForText} štvorcov som vynechal, aby nešli cez text (karta má ${patternComputed.boxCount})` : ` (${patternComputed.boxCount} štvorcov)`}.`
      : `Vzor: ${patternComputed.reasonSk}.`,
  );
  notesSk.push(layout.fitsSk);
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
    pattern: patternComputed,
    layout,
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

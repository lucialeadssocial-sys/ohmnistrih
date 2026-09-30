/**
 * NÁHĽAD ŠTÝLU TITULKOV — bez renderovania (krok B+).
 *
 * Prečo: editor dnes zistí, ako titulky vyzerajú, až keď vyrenderuje video
 * a pozrie sa. To je presne tá slučka, ktorá zožerie hodiny. Tento modul
 * prepočíta štýl (veľkosť, farby, obrys, placka, zvýraznenie) na model, ktorý
 * vie UI vykresliť okamžite — a to **s vlastnými slovami z videa**, nie
 * s ukážkovým textom.
 *
 * Je to čistá funkcia: dá sa otestovať bez prehliadača a bez videa. Prehliadač
 * potom len vykreslí to, čo tu vzniklo (žiadna logika navyše v komponente).
 *
 * Poctivo: náhľad je **vizuálna aproximácia** (prehliadač kreslí písmo inak než
 * libass). Hovorí to aj UI. Na presné rozhodnutie o veľkosti je render, tento
 * náhľad je na rýchle „áno/nie, toto je ono".
 */

import {
  getCaptionStyle,
  isStrongCaptionWord,
  wrapAssLines,
  type CaptionStyleId,
} from "./subtitleRender";
import type { SpeechSegmentLike } from "../transcript/wordTiming";

export interface CaptionPreviewWord {
  text: string;
  /** Zvýraznené (aktívne hovorené alebo silné slovo). */
  accent: boolean;
  /** Aktívne = práve hovorené (má aj zväčšenie, ak to štýl používa). */
  active: boolean;
}

export interface CaptionPreviewModel {
  styleId: CaptionStyleId;
  labelSk: string;
  /** Veľkosť písma v pixeloch náhľadu. */
  fontSizePx: number;
  /** Riadok textu v pixeloch náhľadu (1.15 × veľkosť). */
  lineHeightPx: number;
  outlinePx: number;
  letterSpacingPx: number;
  bottomMarginPx: number;
  maxWidthPx: number;
  uppercase: boolean;
  boxed: boolean;
  /** Zväčšenie aktívneho slova (‰ zmenené na násobok, napr. 1.12). */
  activeScale: number;
  primaryCss: string;
  highlightCss: string;
  outlineCss: string;
  boxCss: string | null;
  lines: CaptionPreviewWord[][];
  /** Koľko slov titulok ukazuje naraz (0 = celá veta). */
  wordsPerChunk: number;
  /** Čo náhľad ukazuje — poctivo pre UI. */
  noteSk: string;
}

/**
 * ASS farba (`&HAABBGGRR`) → CSS `rgba()`.
 * Poradie v ASS je **BGR**, takže sa nedá použiť ako hex priamo — to je presne
 * tá chyba, ktorá by dala modrý text namiesto žltého.
 */
export function assColorToCss(assColor: string): string {
  const raw = String(assColor ?? "").replace(/&H/i, "").replace(/&/g, "").trim();
  const padded = raw.padStart(8, "0");
  const a = parseInt(padded.slice(0, 2), 16);
  const b = parseInt(padded.slice(2, 4), 16);
  const g = parseInt(padded.slice(4, 6), 16);
  const r = parseInt(padded.slice(6, 8), 16);
  const alpha = Number.isFinite(a) ? 1 - a / 255 : 1;
  const parts = [r, g, b].map((v) => (Number.isFinite(v) ? v : 255));
  return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")})`;
}

/** Zvýraznenie v ASS → násobok zväčšenia pre CSS (112 → 1.12). */
export function scaleToFactor(scale?: number): number {
  const s = Number(scale);
  if (!Number.isFinite(s) || s <= 0) return 1;
  return s / 100;
}

function previewWords(seg: SpeechSegmentLike | undefined): string[] {
  if (!seg) return [];
  const words = (Array.isArray(seg.words) ? seg.words : [])
    .map((w) => String(w?.word ?? "").trim())
    .filter(Boolean);
  if (words.length) return words;
  return String(seg.text ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Postaví model náhľadu.
 *
 * @param previewHeight výška náhľadu v CSS pixeloch (napr. 190 pre malú kartu
 *                      alebo 420 pre veľký náhľad) — všetko sa prepočíta naň,
 *                      aby náhľad vyzeral rovnako ako vo videu.
 */
export function buildCaptionPreview(options: {
  styleId: CaptionStyleId;
  segments?: SpeechSegmentLike[];
  width?: number;
  height?: number;
  previewHeight?: number;
  /** Ktoré slovo je „práve hovorené" (index v rámci ukážky). */
  activeWordIndex?: number;
}): CaptionPreviewModel {
  const style = getCaptionStyle(options.styleId);
  const width = Number(options.width) > 0 ? Number(options.width) : 1080;
  const height = Number(options.height) > 0 ? Number(options.height) : 1920;
  const previewHeight = Number(options.previewHeight) > 0 ? Number(options.previewHeight) : 190;
  const factor = previewHeight / height;

  const seg = (Array.isArray(options.segments) ? options.segments : []).find(
    (s) => previewWords(s).length >= 2,
  );
  let words = previewWords(seg);
  if (words.length === 0) {
    // Nemáme text z videa — ukážeme aspoň tvar veľkosti a farieb.
    words = ["Ukážka", "titulkov"];
  }
  if (style.uppercase) words = words.map((w) => w.toUpperCase());

  const shownWords = style.wordsPerChunk > 0 ? words.slice(0, style.wordsPerChunk) : words;
  const fontSize = Math.max(18, Math.round((height * style.fontSizeRatio) / 1000));
  const sideMargin = Math.round(width * 0.06);
  const maxTextWidth = width - sideMargin * 2;

  const linesRaw = wrapAssLines(shownWords, fontSize, maxTextWidth, 2);
  const flatShown = linesRaw.join(" ").split(/\s+/).filter(Boolean);

  const activeIdx =
    Number.isFinite(options.activeWordIndex) && Number(options.activeWordIndex) >= 0
      ? Math.min(Number(options.activeWordIndex), Math.max(0, flatShown.length - 1))
      : 0;

  let cursor = 0;
  const lines = linesRaw.map((line) =>
    line
      .split(/\s+/)
      .filter(Boolean)
      .map((text) => {
        const idx = cursor++;
        const active = style.highlightMode === "active-word" && idx === activeIdx;
        const strong =
          style.highlightMode === "keywords" ? isStrongCaptionWord(text) : false;
        return { text, accent: active || strong, active };
      }),
  );

  const mode = style.highlightMode;
  const noteSk =
    style.boxed
      ? "Text na farebnej placce — najčitateľnejší aj na svetlom zábere."
      : mode === "active-word"
        ? "Zvýrazňuje sa práve hovorené slovo (vo videu sa mení po slovách)."
        : mode === "keywords"
          ? "Zdôraznené sú čísla a silné slová — rovnaké pravidlo ako pri renderi."
          : "Čistý text bez zvýrazňovania.";

  return {
    styleId: style.id,
    labelSk: style.labelSk,
    fontSizePx: Math.max(9, Math.round(fontSize * factor)),
    lineHeightPx: Math.max(11, Math.round(fontSize * factor * 1.15)),
    outlinePx: Math.max(0, Math.round(style.boxed ? style.outlineWidth * factor * 0.6 : style.outlineWidth * factor * 1.1)),
    letterSpacingPx: Math.round((style.letterSpacing ?? 0) * factor * 40 * 10) / 10,
    bottomMarginPx: Math.round(height * style.bottomMarginRatio * factor),
    maxWidthPx: Math.round(maxTextWidth * factor),
    uppercase: style.uppercase,
    boxed: Boolean(style.boxed),
    activeScale: scaleToFactor(style.activeWordScale),
    primaryCss: assColorToCss(style.primaryColor),
    highlightCss: assColorToCss(style.highlightColor),
    outlineCss: assColorToCss(style.outlineColor),
    boxCss: style.boxed ? assColorToCss(style.boxColor || "&H00141414") : null,
    lines,
    wordsPerChunk: style.wordsPerChunk,
    noteSk,
  };
}

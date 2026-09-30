import type { SpeechSegmentLike } from "../../src/core/transcript/wordTiming";

/**
 * Testovacia fixture pre Style Studio (kroky 1–4).
 *
 * Je to **vymyslená** vzorka reči s reálnymi časmi slov — slúži len na testy
 * deterministického enginu a obrazovky. NIKDY sa nepoužíva ako demo dáta v appke.
 */
export const STYLE_FIXTURE_NOW = 1759219200000;

export const STYLE_FIXTURE_SEGMENTS: SpeechSegmentLike[] = [
  {
    start: 0.2,
    end: 3.1,
    text: "Dnes ti ukážem trik, ktorý mi ušetrí hodiny.",
    words: [
      { word: "Dnes", start: 0.2, end: 0.5 },
      { word: "ti", start: 0.5, end: 0.65 },
      { word: "ukážem", start: 0.65, end: 1.1 },
      { word: "trik", start: 1.12, end: 1.5 },
      { word: "ktorý", start: 1.55, end: 1.85 },
      { word: "mi", start: 1.85, end: 2.0 },
      { word: "ušetrí", start: 2.0, end: 2.6 },
      { word: "hodiny", start: 2.62, end: 3.1 },
    ],
  },
  {
    start: 3.9,
    end: 7.4,
    text: "Zaplatil som 3 000 eur za kurz, ktorý ma nič nenaučil.",
    words: [
      { word: "Zaplatil", start: 3.9, end: 4.5 },
      { word: "som", start: 4.5, end: 4.7 },
      { word: "3", start: 4.7, end: 4.95 },
      { word: "000", start: 4.95, end: 5.2 },
      { word: "eur", start: 5.2, end: 5.6 },
      { word: "za", start: 5.62, end: 5.78 },
      { word: "kurz", start: 5.78, end: 6.2 },
      { word: "ktorý", start: 6.25, end: 6.6 },
      { word: "ma", start: 6.6, end: 6.75 },
      { word: "nič", start: 6.75, end: 7.0 },
      { word: "nenaučil", start: 7.0, end: 7.4 },
    ],
  },
  {
    start: 8.6,
    end: 12.9,
    text: "Zľava 50 % na celý balík platí len do konca týždňa, potom končí.",
    words: [
      { word: "Zľava", start: 8.6, end: 9.1 },
      { word: "50", start: 9.12, end: 9.4 },
      { word: "%", start: 9.4, end: 9.6 },
      { word: "na", start: 9.62, end: 9.78 },
      { word: "celý", start: 9.78, end: 10.1 },
      { word: "balík", start: 10.1, end: 10.5 },
      { word: "platí", start: 10.55, end: 10.9 },
      { word: "len", start: 10.9, end: 11.1 },
      { word: "do", start: 11.1, end: 11.25 },
      { word: "konca", start: 11.25, end: 11.7 },
      { word: "týždňa", start: 11.7, end: 12.2 },
      { word: "potom", start: 12.3, end: 12.6 },
      { word: "končí", start: 12.6, end: 12.9 },
    ],
  },
];

/** Plán z fixture — používa sa v testoch obrazovky aj v statickom náhľade. */
export function styleFixturePlan() {
  // dynamický import kvôli veľkosti; v testoch je to v poriadku
  const { buildStylePlan } = require("../../src/core/style/styleIntelligence") as typeof import("../../src/core/style/styleIntelligence");
  const { getStyleRecipe } = require("../../src/core/style/styleRecipes") as typeof import("../../src/core/style/styleRecipes");
  return buildStylePlan({
    segments: STYLE_FIXTURE_SEGMENTS,
    recipe: getStyleRecipe("EDITORIAL_COLLAGE"),
    durationSec: 14,
    availableSupportingVisuals: 6,
    now: STYLE_FIXTURE_NOW,
  });
}

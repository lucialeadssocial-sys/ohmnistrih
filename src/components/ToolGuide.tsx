/**
 * KROK 19 — komponenty výučby popri práci.
 *
 * `ToolGuideCard` = krátke „čo to robí / kedy / ako na to“ pre práve otvorený nástroj.
 * `GuideModal`    = celý Sprievodca: všetky nástroje podľa kategórií + hľadanie.
 *
 * Oba komponenty sú čisto zobrazovacie: nič nemenia, nič neposielajú, nič nerušia.
 * Vykreslenie je bezpečné aj na serveri (SSR) — v testoch sa overuje `renderToStaticMarkup`.
 */

import { useMemo, useState } from "react";
import {
  CATEGORY_LABELS,
  FLOW_STEPS,
  SIMPLE_MODE_TABS,
  SIMPLE_MODE_HINT,
  TOOL_GUIDES,
  guideFor,
  type ToolCategory,
} from "../ui/toolGuides";

type Lang = "sk" | "en";

const CATEGORY_ORDER: ToolCategory[] = [
  "media",
  "strih",
  "titulky",
  "audio",
  "vizual",
  "ai",
  "toolbox",
  "export",
  "system",
];

const T = {
  sk: {
    what: "Čo to robí",
    when: "Kedy sa to hodí",
    need: "Čo potrebuješ mať",
    steps: "Ako na to",
    nothing: "Na tento nástroj zatiaľ nemám výučbu.",
    legacy: "Starý názov — dnes sa neotvára samostatne.",
    expert: "Pokročilý nástroj",
    guideTitle: "Sprievodca appkou",
    guideSub:
      "Čo ktorý nástroj robí a kedy ho použiť. Kliknutím nástroj otvoríš. Nič sa tým nezmení ani nemaže.",
    search: "Napíš, čo chceš spraviť (napr. titulky, zvuk, export)…",
    start: "Začni tu — 5 krokov",
    startSub: "Tadiaľto prejdeš od surového videa k hotovému za pár minút.",
    close: "Zavrieť",
    openTool: "Otvoriť nástroj",
    noResults: "Nič som nenašiel. Skús iné slovo.",
    textLangNote: "",
    stepsTitle: "Postup: od surového videa k hotovému",
    stepsHint: "Klikni na krok a otvorí sa nástroj, ktorý ho spraví.",
  },
  en: {
    what: "What it does",
    when: "When to use it",
    need: "What you need first",
    steps: "How to do it",
    nothing: "No guide for this tool yet.",
    legacy: "Old name — not opened separately today.",
    expert: "Advanced tool",
    guideTitle: "App guide",
    guideSub: "What each tool does and when to use it. Clicking opens the tool. Nothing is changed or deleted.",
    search: "Type what you want to do (e.g. captions, audio, export)…",
    start: "Start here — 5 steps",
    startSub: "This takes you from raw video to a finished one in a few minutes.",
    close: "Close",
    openTool: "Open tool",
    noResults: "Nothing found. Try another word.",
    textLangNote: "The guide texts are in Slovak for now (English version is being added).",
    stepsTitle: "Flow: from raw video to finished",
    stepsHint: "Click a step and the tool that does it opens.",
  },
};

export interface ToolGuideCardProps {
  /** id nástroja = hodnota `activeTab` v App.tsx */
  tabId: string;
  language?: Lang;
  /** voliteľné: otvorí celého Sprievodcu */
  onOpenGuide?: () => void;
}

/** Krátka výučba pre práve otvorený nástroj. */
export function ToolGuideCard({ tabId, language = "sk", onOpenGuide }: ToolGuideCardProps) {
  const t = T[language];
  const guide = guideFor(tabId);

  if (!guide) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 text-xs text-neutral-400">
        {t.nothing}
        {onOpenGuide ? (
          <button onClick={onOpenGuide} className="ml-2 font-bold text-rose-400 hover:text-rose-300 underline">
            {t.guideTitle}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      data-testid="tool-guide"
      data-tool-id={guide.id}
      className="rounded-2xl border border-neutral-800 bg-neutral-900/60 px-4 py-3.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-black text-white">{guide.title}</span>
            {guide.expert ? (
              <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-[10px] font-bold text-neutral-400 uppercase tracking-wide">
                {t.expert}
              </span>
            ) : null}
            {guide.legacy ? (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-[10px] font-bold text-amber-400 uppercase tracking-wide">
                {t.legacy}
              </span>
            ) : null}
          </div>

          <p className="mt-1.5 text-xs leading-relaxed text-neutral-300">
            <span className="font-bold text-neutral-200">{t.what}: </span>
            {guide.what}
          </p>

          {guide.when ? (
            <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">
              <span className="font-bold text-neutral-300">{t.when}: </span>
              {guide.when}
            </p>
          ) : null}

          {guide.need.length > 0 ? (
            <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">
              <span className="font-bold text-neutral-300">{t.need}: </span>
              {guide.need.join(" · ")}
            </p>
          ) : null}

          {guide.steps.length > 0 ? (
            <div className="mt-2">
              <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{t.steps}</div>
              <ol className="mt-1 space-y-0.5">
                {guide.steps.map((step, i) => (
                  <li key={i} className="text-xs leading-relaxed text-neutral-300 flex gap-1.5">
                    <span className="text-rose-400 font-bold">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>

        {onOpenGuide ? (
          <button
            onClick={onOpenGuide}
            className="shrink-0 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-[11px] font-bold text-neutral-300 hover:text-white transition-colors"
          >
            {t.guideTitle}
          </button>
        ) : null}
      </div>
      {t.textLangNote ? (
        <p className="mt-2 text-[10px] text-amber-400/80">{t.textLangNote}</p>
      ) : null}
    </div>
  );
}

export interface GuideModalProps {
  open: boolean;
  language?: Lang;
  onClose: () => void;
  /** otvorí nástroj (App.tsx nastaví `activeTab` + kategóriu) */
  onGoToTool?: (tabId: string) => void;
}

/** Celý Sprievodca: 5 krokov + všetky nástroje podľa kategórií + hľadanie. */
export function GuideModal({ open, language = "sk", onClose, onGoToTool }: GuideModalProps) {
  const t = T[language];
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOOL_GUIDES;
    return TOOL_GUIDES.filter((g) =>
      [g.title, g.what, g.when, ...g.steps].join(" ").toLowerCase().includes(q),
    );
  }, [query]);

  const byCategory = useMemo(() => {
    const map = new Map<ToolCategory, typeof filtered>();
    for (const g of filtered) {
      const list = map.get(g.category) ?? [];
      list.push(g);
      map.set(g.category, list);
    }
    return map;
  }, [filtered]);

  if (!open) return null;

  return (
    <div
      data-testid="guide-modal"
      className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-3xl border border-neutral-800 bg-neutral-950 shadow-2xl my-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-neutral-800 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-white">{t.guideTitle}</h2>
            <p className="mt-1 text-xs text-neutral-400 max-w-xl">{t.guideSub}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-200"
          >
            {t.close}
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* 5 krokov */}
          <div>
            <div className="text-sm font-black text-white">{t.start}</div>
            <p className="mt-0.5 text-xs text-neutral-400">{t.startSub}</p>
            <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
              {FLOW_STEPS.map((step) => (
                <div key={step.n} className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-3">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[11px] font-black flex items-center justify-center">
                      {step.n}
                    </span>
                    <span className="text-xs font-bold text-white">{step.title}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-400">{step.what}</p>
                  <p className="mt-1 text-[11px] text-neutral-500">
                    <span className="font-bold text-neutral-400">{t.need}: </span>
                    {step.need}
                  </p>
                  {onGoToTool ? (
                    <button
                      onClick={() => onGoToTool(step.tabId)}
                      className="mt-2 px-2.5 py-1 rounded-lg bg-rose-500/90 hover:bg-rose-500 text-white text-[11px] font-bold"
                    >
                      {t.openTool}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* hľadanie */}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search}
            aria-label={t.search}
            className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-rose-500/50"
          />

          {/* všetky nástroje podľa kategórií */}
          {filtered.length === 0 ? (
            <p className="text-xs text-neutral-400">{t.noResults}</p>
          ) : (
            CATEGORY_ORDER.filter((c) => (byCategory.get(c)?.length ?? 0) > 0).map((category) => (
              <div key={category}>
                <div className="text-[11px] font-black uppercase tracking-wide text-neutral-500">
                  {CATEGORY_LABELS[category]}
                </div>
                <div className="mt-2 space-y-2">
                  {(byCategory.get(category) ?? []).map((g) => (
                    <div
                      key={g.id}
                      data-guide-id={g.id}
                      className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="text-xs font-bold text-white">{g.title}</span>
                          {g.legacy ? (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-[10px] font-bold text-amber-400">
                              {t.legacy}
                            </span>
                          ) : null}
                          {g.expert && !g.legacy ? (
                            <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-[10px] font-bold text-neutral-400">
                              {t.expert}
                            </span>
                          ) : null}
                        </div>
                        {onGoToTool && !g.legacy ? (
                          <button
                            onClick={() => onGoToTool(g.id)}
                            className="shrink-0 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-[11px] font-bold text-neutral-200"
                          >
                            {t.openTool}
                          </button>
                        ) : null}
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-300">{g.what}</p>
                      {g.when ? (
                        <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
                          <span className="font-bold text-neutral-300">{t.when}: </span>
                          {g.when}
                        </p>
                      ) : null}
                      {g.steps.length > 0 ? (
                        <ol className="mt-1.5 space-y-0.5">
                          {g.steps.map((step, i) => (
                            <li key={i} className="text-[11px] leading-relaxed text-neutral-400 flex gap-1.5">
                              <span className="text-rose-400 font-bold">{i + 1}.</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}

          <p className="text-[11px] text-neutral-500">{SIMPLE_MODE_HINT}</p>
          {t.textLangNote ? <p className="text-[11px] text-amber-400/80">{t.textLangNote}</p> : null}
        </div>
      </div>
    </div>
  );
}


export interface SimpleModeStripProps {
  language?: Lang;
  /** koľko z 5 krokov je NAOZAJ hotových (podľa reálnych udalostí v appke) */
  doneCount?: number;
  /** nasledujúci krok postupu (id nástroja) — zvýrazní sa „ďalej“ */
  nextTab?: string;
  /** práve otvorený nástroj — krok, ktorý mu zodpovedá, sa zvýrazní */
  activeTab?: string;
  /** true = užívateľ má zapnutý expert režim */
  expertMode?: boolean;
  onGoToTool: (tabId: string) => void;
  onOpenGuide: () => void;
  onToggleExpert?: () => void;
}

/**
 * Jednoduchý krokový pás: 5 krokov od surového videa k hotovému.
 * Je stále na očiach (aj v jednoduchom režime) — tým sa appka dá „prejsť“ bez hľadania.
 */
export function SimpleModeStrip({
  language = "sk",
  activeTab,
  expertMode,
  doneCount = 0,
  nextTab,
  onGoToTool,
  onOpenGuide,
  onToggleExpert,
}: SimpleModeStripProps) {
  const t = T[language];
  const isSk = language === "sk";

  return (
    <div
      data-testid="simple-mode-strip"
      className="w-full rounded-2xl border border-neutral-800 bg-neutral-900/50 px-3 py-2.5"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-wide text-neutral-400">
            {t.stepsTitle}
            {doneCount > 0 ? (
              <span
                data-testid="flow-done"
                className="ml-2 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 normal-case font-bold"
              >
                {isSk ? `hotové: ${doneCount} z 5` : `done: ${doneCount} of 5`}
              </span>
            ) : null}
          </div>
          <div className="text-[10px] text-neutral-500">{t.stepsHint}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenGuide}
            className="px-2.5 py-1 rounded-lg bg-rose-500/90 hover:bg-rose-500 text-white text-[11px] font-bold"
          >
            📖 {t.guideTitle}
          </button>
          {onToggleExpert ? (
            <button
              onClick={onToggleExpert}
              className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-[11px] font-bold text-neutral-300 hover:text-white"
            >
              {expertMode
                ? (isSk ? "Späť na jednoduchý režim" : "Back to simple mode")
                : (isSk ? "Všetky nástroje (expert)" : "All tools (expert)")}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-2 flex items-stretch gap-1.5 overflow-x-auto custom-scrollbar pb-0.5">
        {FLOW_STEPS.map((step) => {
          const active = activeTab === step.tabId;
          const flowDone = step.n <= doneCount;
          const simple = SIMPLE_MODE_TABS.includes(step.tabId);
          return (
            <button
              key={step.n}
              onClick={() => onGoToTool(step.tabId)}
              title={step.what}
              className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl border text-left transition-colors cursor-pointer ${
                active
                  ? "bg-rose-500/15 border-rose-500/50"
                  : "bg-neutral-950/70 border-neutral-800 hover:border-neutral-700"
              }`}
            >
              <span
                data-flow-done={flowDone ? "1" : "0"}
                className={`w-4.5 h-4.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-black flex items-center justify-center ${
                  flowDone ? "bg-emerald-500 text-white" : active ? "bg-rose-500 text-white" : "bg-neutral-800 text-neutral-300"
                }`}
              >
                {flowDone ? "✓" : step.n}
              </span>
              <span className={`text-[11px] font-bold whitespace-nowrap ${active ? "text-white" : "text-neutral-300"}`}>
                {step.title}
              </span>
              {step.tabId === nextTab ? (
                <span className="text-[9px] font-bold text-rose-300 uppercase">
                  {isSk ? "ďalej" : "next"}
                </span>
              ) : null}
              {!simple ? (
                <span className="text-[9px] font-bold text-amber-400/80 uppercase">{isSk ? "expert" : "expert"}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

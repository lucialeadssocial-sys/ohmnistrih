/**
 * KROK 20 — ŽIVÝ SPRIEVODCA (výučba priamo vo funkciách, za behu).
 *
 * `LiveCoachCard` sedí priamo nad otvoreným nástrojom a hovorí, ČO MÁŠ SPRAVIŤ TERAZ.
 * Kroky sa odškrtávajú len podľa SKUTOČNÝCH udalostí (nahratie, analýza, použitý
 * strih, titulky na osi, použitý štýl, export) — nie podľa času ani odhadu.
 * Kroky, ktoré appka overiť nevie, sú označené ako ručné a nikdy sa neodškrtnú samy.
 *
 * Komponent je čisto zobrazovací (nič nemení, nič neposiela) a vykreslí sa aj
 * na serveri — v testoch sa overuje `renderToStaticMarkup`.
 */

import { useState } from "react";
import {
  evaluateLiveSteps,
  legacyTargetFor,
  liveStepsFor,
  suggestedNextTool,
  verifiableCounts,
  type LiveSignal,
  type LiveStepState,
} from "../ui/liveCoach";
import { guideFor } from "../ui/toolGuides";

type Lang = "sk" | "en";

const T = {
  sk: {
    title: "Sprievodca týmto nástrojom — naživo",
    progress: (d: number, t: number) => `${d} z ${t} overiteľných krokov hotových`,
    manualNote: (n: number) =>
      n === 1
        ? "1 krok appka nevie overiť — označený ako ručný, odškrtneš si ho sám."
        : `${n} kroky appka nevie overiť — označené ako ručné, odškrtneš si ich sám.`,
    now: "Teraz sprav toto",
    where: "Kde to nájdeš",
    done: "Hotové",
    manualBadge: "ručný krok — appka ho nevie overiť",
    waiting: "Ďalší krok",
    allDone: "Hotovo — appka vidí, že máš všetko potrebné.",
    nextTool: "Ďalší krok postupu",
    openNext: "Otvoriť ďalší nástroj",
    collapse: "Skryť sprievodcu na tejto obrazovke",
    expand: "Zobraziť sprievodcu",
    noSteps: "Pre tento nástroj appka nemá čo odškrtávať — použi výučbu vyššie.",
    honest: "Odškrtnuté je len to, čo appka naozaj vidí (nie čas ani odhad).",
    textLangNote: "",
    legacy: (target: string) => `Tento nástroj sa dnes neotvára samostatne — použi namiesto neho „${target}“.`, 
  },
  en: {
    title: "Guide for this tool — live",
    progress: (d: number, t: number) => `${d} of ${t} verifiable steps done`,
    manualNote: (n: number) => `${n} step(s) cannot be verified by the app — marked as manual.`,
    now: "Do this now",
    where: "Where to find it",
    done: "Done",
    manualBadge: "manual step — the app cannot verify it",
    waiting: "Next step",
    allDone: "Done — the app can see everything is ready.",
    nextTool: "Next step in the flow",
    openNext: "Open next tool",
    collapse: "Hide guide on this screen",
    expand: "Show guide",
    noSteps: "No verifiable steps for this tool — use the guide above.",
    honest: "Only what the app really sees is ticked (not time, not a guess).",
    textLangNote: "Step texts are in Slovak for now (English version is being added).",
    legacy: (target: string) => `This tool is not opened separately today — use "${target}" instead.`,
  },
};

export interface LiveCoachCardProps {
  tabId: string;
  signals: Record<LiveSignal, boolean>;
  language?: Lang;
  onGoToTool?: (tabId: string) => void;
}

function StatusIcon({ status }: { status: LiveStepState["status"] }) {
  if (status === "done") {
    return (
      <span className="w-5 h-5 min-w-[20px] h-[20px] rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-black flex items-center justify-center">
        ✓
      </span>
    );
  }
  if (status === "current") {
    return (
      <span className="w-5 h-5 min-w-[20px] h-[20px] rounded-full bg-rose-500 text-white text-[11px] font-black flex items-center justify-center">
        ▶
      </span>
    );
  }
  if (status === "manual") {
    return (
      <span className="w-5 h-5 min-w-[20px] h-[20px] rounded-full bg-amber-500/20 text-amber-400 text-[11px] font-black flex items-center justify-center">
        ✋
      </span>
    );
  }
  return (
    <span className="w-5 h-5 min-w-[20px] h-[20px] rounded-full bg-neutral-800 text-neutral-500 text-[11px] font-black flex items-center justify-center">
      ○
    </span>
  );
}

export function LiveCoachCard({ tabId, signals, language = "sk", onGoToTool }: LiveCoachCardProps) {
  const t = T[language];
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("omnistrih_live_coach_collapsed") === "1";
    } catch {
      return false;
    }
  });

  const steps = liveStepsFor(tabId);
  const states = evaluateLiveSteps(steps, signals);
  const { verifiableTotal, verifiableDone, manualTotal } = verifiableCounts(states);
  const nextTab = suggestedNextTool(tabId);
  const allVerifiableDone = verifiableTotal > 0 && verifiableDone === verifiableTotal;
  const legacyTarget = legacyTargetFor(tabId);

  // Starý názov: žiadne kroky, len poctivé nasmerovanie na dnešný nástroj.
  if (legacyTarget) {
    const target = guideFor(legacyTarget);
    return (
      <div
        data-testid="live-coach"
        data-tool-id={tabId}
        data-status="legacy"
        className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3"
      >
        <div className="text-xs font-black text-white">{t.title}</div>
        <p className="mt-1 text-[11px] text-amber-300">{t.legacy(target?.title ?? legacyTarget)}</p>
        {onGoToTool ? (
          <button
            data-testid="live-legacy-target"
            onClick={() => onGoToTool(legacyTarget)}
            className="mt-2 px-2.5 py-1 rounded-lg bg-amber-500/90 hover:bg-amber-500 text-white text-[11px] font-bold"
          >
            {target?.title ?? legacyTarget}
          </button>
        ) : null}
      </div>
    );
  }

  if (steps.length === 0) {
    return (
      <div
        data-testid="live-coach"
        data-tool-id={tabId}
        data-status="no-steps"
        className="rounded-2xl border border-neutral-800 bg-neutral-900/40 px-4 py-2.5 text-[11px] text-neutral-500"
      >
        {t.noSteps}
      </div>
    );
  }

  return (
    <div
      data-testid="live-coach"
      data-tool-id={tabId}
      data-status={allVerifiableDone ? "done" : "in-progress"}
      className={`rounded-2xl border px-4 py-3 ${
        allVerifiableDone ? "border-emerald-500/40 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black text-white">{t.title}</span>
            {verifiableTotal > 0 ? (
              <span
                data-testid="live-progress"
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  allVerifiableDone ? "bg-emerald-500/20 text-emerald-300" : "bg-neutral-800 text-neutral-300"
                }`}
              >
                {t.progress(verifiableDone, verifiableTotal)}
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 text-[10px] text-neutral-500">{t.honest}</div>
        </div>
        <button
          onClick={() => {
            setCollapsed((prev) => {
              const next = !prev;
              try {
                localStorage.setItem("omnistrih_live_coach_collapsed", next ? "1" : "0");
              } catch {}
              return next;
            });
          }}
          className="shrink-0 px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-[10px] font-bold text-neutral-300"
        >
          {collapsed ? t.expand : t.collapse}
        </button>
      </div>

      {!collapsed ? (
        <ol className="mt-2.5 space-y-2">
          {states.map((step, i) => (
            <li key={i} data-step-status={step.status} className="flex gap-2.5">
              <StatusIcon status={step.status} />
              <div className="min-w-0">
                <div
                  className={`text-xs font-bold ${
                    step.status === "done"
                      ? "text-neutral-400 line-through"
                      : step.isNext
                        ? "text-white"
                        : "text-neutral-300"
                  }`}
                >
                  {step.label}
                  {step.status === "done" ? <span className="ml-1.5 font-normal text-emerald-400">({t.done})</span> : null}
                </div>
                {step.where ? (
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    <span className="font-bold text-neutral-400">{t.where}: </span>
                    {step.where}
                  </div>
                ) : null}
                {step.manual && !step.signal ? (
                  <div className="text-[10px] text-amber-400/90 mt-0.5">{t.manualBadge}</div>
                ) : null}
                {step.isNext ? (
                  <div className={`text-[10px] mt-0.5 font-bold ${step.manual ? "text-amber-300" : "text-rose-300"}`}>
                    {t.now}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {manualTotal > 0 ? (
        <div className="mt-2 text-[10px] text-amber-400/80">{t.manualNote(manualTotal)}</div>
      ) : null}

      {t.textLangNote ? <div className="mt-1 text-[10px] text-amber-400/80">{t.textLangNote}</div> : null}

      {allVerifiableDone ? (
        <div className="mt-2.5 pt-2.5 border-t border-emerald-500/20 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[11px] text-emerald-300">
            <span className="font-bold">{t.allDone}</span>
            {nextTab ? (
              <span className="text-neutral-400">
                {" "}
                {t.nextTool}: {guideFor(nextTab)?.title ?? nextTab}
              </span>
            ) : null}
          </div>
          {nextTab && onGoToTool ? (
            <button
              data-testid="live-next-tool"
              onClick={() => onGoToTool(nextTab)}
              className="px-2.5 py-1 rounded-lg bg-emerald-500/90 hover:bg-emerald-500 text-white text-[11px] font-bold"
            >
              {t.openNext}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

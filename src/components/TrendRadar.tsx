import React, { useMemo, useState } from "react";
import {
  Flame,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Copy,
  Check,
  Sparkles,
  BookOpen,
  Lightbulb,
  Clock,
  Calendar,
  TrendingUp,
} from "lucide-react";
import {
  PLATFORMS,
  NICHES,
  getTrendPack,
  auditPlanForVirality,
  TREND_LIBRARY_VERIFIED_AT,
  type TrendPlatform,
  type Niche,
  type PlanItemLike,
  type ViralityCheck,
} from "../core/trends/trendLibrary";

interface TrendRadarProps {
  language?: string;
  /** Aktuálne navrhnutý plán (z Director Planu) — z neho sa počíta kontrola virality. */
  plan?: PlanItemLike[];
  durationSec?: number;
  onSeek?: (seconds: number) => void;
}

type Section = "kontrola" | "principy" | "hooky" | "formaty" | "vlajky";

const SECTION_LABELS: { id: Section; labelSk: string; icon: any }[] = [
  { id: "kontrola", labelSk: "Kontrola virality", icon: TrendingUp },
  { id: "hooky", labelSk: "Hook vzorce", icon: Flame },
  { id: "principy", labelSk: "Princípy", icon: BookOpen },
  { id: "formaty", labelSk: "Formáty", icon: Lightbulb },
  { id: "vlajky", labelSk: "Červené vlajky", icon: ShieldAlert },
];

const STATUS_STYLE: Record<ViralityCheck["status"], { cls: string; icon: any; labelSk: string }> = {
  pass: { cls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300", icon: CheckCircle2, labelSk: "OK" },
  warn: { cls: "bg-amber-500/10 border-amber-500/30 text-amber-300", icon: AlertCircle, labelSk: "Doladiť" },
  fail: { cls: "bg-rose-500/10 border-rose-500/30 text-rose-300", icon: XCircle, labelSk: "Chýba" },
};

const CopyButton: React.FC<{ text: string; labelSk: string }> = ({ text, labelSk }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => {},
        );
      }}
      className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-bold flex items-center gap-1 transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      {copied ? "Skopírované" : labelSk}
    </button>
  );
};

export const TrendRadar: React.FC<TrendRadarProps> = ({
  language = "sk",
  plan = [],
  durationSec = 0,
  onSeek,
}) => {
  const isSk = language === "sk";
  const [platform, setPlatform] = useState<TrendPlatform>("TIKTOK");
  const [niche, setNiche] = useState<Niche>("univerzalne");
  const [section, setSection] = useState<Section>("kontrola");

  const pack = useMemo(() => getTrendPack(platform, niche), [platform, niche]);

  const audit = useMemo(
    () => (plan.length > 0 ? auditPlanForVirality(plan, platform, durationSec || 30) : null),
    [plan, platform, durationSec],
  );

  const scoreColor =
    !audit ? "text-neutral-500"
      : audit.score >= 80 ? "text-emerald-400"
        : audit.score >= 55 ? "text-amber-400"
          : "text-rose-400";

  return (
    <div className="space-y-4">
      {/* Výber platformy a niche */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 space-y-3">
        <div>
          <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-2">
            {isSk ? "Platforma" : "Platform"}
          </label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlatform(p.id)}
                className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-colors ${
                  platform === p.id
                    ? "border-rose-500/60 bg-rose-500/10 text-white"
                    : "border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700"
                }`}
              >
                {p.labelSk}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-2">
            {isSk ? "Oblasť klienta" : "Client niche"}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {NICHES.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setNiche(n.id)}
                className={`px-2 py-1 rounded border text-[10px] transition-colors ${
                  niche === n.id
                    ? "border-sky-500/50 bg-sky-500/10 text-sky-200"
                    : "border-neutral-800 text-neutral-500 hover:border-neutral-700"
                }`}
              >
                {n.labelSk}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-neutral-800 flex items-start gap-2">
          <Calendar className="h-3.5 w-3.5 text-neutral-500 shrink-0 mt-0.5" />
          <p className="text-[10px] text-neutral-500 leading-relaxed">
            {isSk
              ? `Knižnica overená ${TREND_LIBRARY_VERIFIED_AT}. Princípy platia roky, formáty sa menia — ak niečo vyzerá zastaralo, povedz mi a upravím to. Toto nie je horoskop: pri každej položke je mechanizmus, prečo funguje, aj kedy ju NEPOUŽIŤ.`
              : `Library verified ${TREND_LIBRARY_VERIFIED_AT}. Principles are timeless, formats change.`}
          </p>
        </div>
      </div>

      {/* Sekcie */}
      <div className="flex flex-wrap gap-1.5">
        {SECTION_LABELS.map((s) => {
          const Icon = s.icon;
          const badge =
            s.id === "hooky" ? pack.hooks.length
              : s.id === "principy" ? pack.principles.length
                : s.id === "formaty" ? pack.formats.length
                  : s.id === "vlajky" ? pack.redFlags.length
                    : audit ? audit.checks.length : 0;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-1.5 transition-colors ${
                section === s.id
                  ? "border-neutral-600 bg-neutral-800 text-white"
                  : "border-neutral-800 text-neutral-400 hover:border-neutral-700"
              }`}
            >
              <Icon className="h-3 w-3" />
              {s.labelSk}
              <span className="text-neutral-500">{badge}</span>
            </button>
          );
        })}
      </div>

      {/* KONTROLA VIRALITY */}
      {section === "kontrola" && (
        <div className="space-y-3">
          {!audit ? (
            <div className="p-6 rounded-xl border border-dashed border-neutral-800 text-center">
              <TrendingUp className="h-5 w-5 text-neutral-600 mx-auto" />
              <p className="text-[11px] text-neutral-500 mt-2 max-w-md mx-auto">
                {isSk
                  ? "Kontrola sa počíta z hotového plánu. Spusti najprv „RAW → READY“ a tu sa objaví, čo plánu chýba pre túto platformu — s konkrétnou opravou."
                  : "Run RAW → READY first; the audit uses the produced plan."}
              </p>
            </div>
          ) : (
            <>
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-[11px] text-neutral-400">
                      {isSk ? "Kontrola plánu pre" : "Plan audit for"}{" "}
                      <span className="text-white font-bold">{pack.spec.labelSk}</span>
                    </p>
                    <p className={`text-2xl font-black ${scoreColor}`}>{audit.score} / 100</p>
                  </div>
                  <div className="flex gap-2 text-[10px] font-mono">
                    <span className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      ✓ {audit.checks.filter((c) => c.status === "pass").length}
                    </span>
                    <span className="px-2 py-1 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      ! {audit.checks.filter((c) => c.status === "warn").length}
                    </span>
                    <span className="px-2 py-1 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                      ✕ {audit.checks.filter((c) => c.status === "fail").length}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-neutral-400 mt-2 leading-relaxed">{audit.summarySk}</p>
                <p className="text-[10px] text-neutral-600 mt-2">
                  {isSk
                    ? "Toto hodnotí PLÁN, nie hotové video. Nástroj nesľubuje zhliadnutia — hovorí, čo v strihu chýba a prečo."
                    : "This audits the plan, not the finished video."}
                </p>
              </div>

              {audit.checks.map((c) => {
                const style = STATUS_STYLE[c.status];
                const Icon = style.icon;
                return (
                  <div key={c.id} className={`p-3 rounded-xl border ${style.cls}`}>
                    <div className="flex items-start gap-2">
                      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold">{c.labelSk}</span>
                          <span className="text-[9px] font-mono opacity-70">{style.labelSk}</span>
                        </div>
                        <p className="text-[11px] mt-1 opacity-90 leading-relaxed">{c.detailSk}</p>
                        {c.fixSk && (
                          <p className="text-[11px] mt-1.5 text-white/90 leading-relaxed">
                            <span className="font-bold">{isSk ? "Oprava: " : "Fix: "}</span>
                            {c.fixSk}
                          </p>
                        )}
                        <p className="text-[10px] mt-1.5 opacity-70 leading-relaxed">
                          <span className="font-bold">{isSk ? "Prečo: " : "Why: "}</span>
                          {c.whySk}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* HOOK VZORCE */}
      {section === "hooky" && (
        <div className="space-y-2">
          {pack.hooks.map((h) => (
            <div key={h.id} className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Flame className="h-3.5 w-3.5 text-orange-400" />
                  <span className="text-[11px] font-bold text-white">{h.titleSk}</span>
                </div>
                <CopyButton text={h.templateSk} labelSk={isSk ? "Kopírovať vzor" : "Copy"} />
              </div>
              <p className="text-[11px] text-neutral-300 mt-2 font-mono bg-neutral-900 p-2 rounded">
                {h.templateSk}
              </p>
              <p className="text-[11px] text-neutral-400 mt-2">
                <span className="font-bold text-neutral-300">{isSk ? "Príklad: " : "Example: "}</span>
                {h.exampleSk}
              </p>
              <p className="text-[10px] text-neutral-500 mt-1.5 leading-relaxed">
                <span className="font-bold">{isSk ? "Prečo funguje: " : "Why: "}</span>
                {h.whySk}
              </p>
              <p className="text-[10px] text-amber-300/80 mt-1 leading-relaxed">
                <span className="font-bold">{isSk ? "Riziko: " : "Risk: "}</span>
                {h.riskSk}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* PRINCÍPY */}
      {section === "principy" && (
        <div className="space-y-2">
          {pack.principles.map((p) => (
            <div key={p.id} className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
              <div className="flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5 text-sky-400" />
                <span className="text-[11px] font-bold text-white">{p.titleSk}</span>
              </div>
              <p className="text-[11px] text-neutral-300 mt-2">{p.whatSk}</p>
              <p className="text-[10px] text-neutral-500 mt-1.5 leading-relaxed">
                <span className="font-bold">{isSk ? "Prečo: " : "Why: "}</span>
                {p.whySk}
              </p>
              <p className="text-[10px] text-amber-300/80 mt-1 leading-relaxed">
                <span className="font-bold">{isSk ? "Kedy nie: " : "When not: "}</span>
                {p.whenNotSk}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* FORMÁTY */}
      {section === "formaty" && (
        <div className="space-y-2">
          {pack.formats.map((f) => (
            <div key={f.id} className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-3.5 w-3.5 text-yellow-400" />
                  <span className="text-[11px] font-bold text-white">{f.titleSk}</span>
                </div>
                <span className="text-[9px] text-neutral-500 flex items-center gap-1 font-mono">
                  <Clock className="h-3 w-3" />
                  {f.effortSk}
                </span>
              </div>
              <p className="text-[11px] text-neutral-300 mt-2">{f.howSk}</p>
              <p className="text-[10px] text-neutral-500 mt-1.5 leading-relaxed">
                <span className="font-bold">{isSk ? "Prečo: " : "Why: "}</span>
                {f.whySk}
              </p>
              <p className="text-[10px] text-amber-300/80 mt-1 leading-relaxed">
                <span className="font-bold">{isSk ? "Riziko: " : "Risk: "}</span>
                {f.riskSk}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ČERVENÉ VLAJKY */}
      {section === "vlajky" && (
        <div className="space-y-2">
          {pack.redFlags.map((r) => (
            <div key={r.id} className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                <span className="text-[11px] font-bold text-white">{r.titleSk}</span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-2">{r.whatSk}</p>
              <p className="text-[11px] text-white/90 mt-1.5 leading-relaxed">
                <span className="font-bold">{isSk ? "Oprava: " : "Fix: "}</span>
                {r.fixSk}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Pätička */}
      <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-start gap-2">
        <Sparkles className="h-3.5 w-3.5 text-violet-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-neutral-500 leading-relaxed">
          {isSk
            ? "Trend Radar je znalostná vrstva, nie generátor. Nič neaplikuje do strihu samo — dá ti mechanizmus a ty sa rozhodneš. Ak chceš, aby sa zásahy z týchto vzorcov rovno objavili v pláne, použi ich v poli „Poznámky pre AI“."
            : "Trend Radar is a knowledge layer, not a generator — it never touches your edit by itself."}
        </p>
      </div>
    </div>
  );
};

export default TrendRadar;

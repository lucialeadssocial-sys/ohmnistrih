import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Download,
  Link2,
  Plus,
  RefreshCw,
  Radio,
  Trash2,
  Wand2,
} from "lucide-react";
import {
  LIVE_SIGNALS_DISCLAIMER_SK,
  signalBriefSk,
  signalContextForPlanSk,
  type LiveSignalsBundle,
  type LiveSourceId,
  type SourceFetchResult,
  type TrendSignal,
} from "../core/trends/liveTrends";

/**
 * ŽIVÉ SIGNÁLY — reálne dáta z platforiem pre Trend Radar (F5).
 *
 * Princípy (rovnaké ako inde v appke):
 *  - **Nikdy nič samo.** Signály sa načítajú len po kliknutí na „Obnoviť".
 *    Otvorenie panelu číta uloženú cache a povie, ako je stará.
 *  - **Každé zlyhanie má dôvod** — aj to, že niečo nejde, je informácia.
 *  - **Žiadne sľuby.** Signál je surovina, nie záruka zhliadnutí.
 */

interface TrendStatus {
  sources: { id: LiveSourceId; labelSk: string; givesSk: string; limitsSk: string; needsKey: boolean }[];
  platformLimits: { platform: string; reasonSk: string }[];
  disclaimerSk: string;
  settings: {
    geos: string[];
    channels: string[];
    channelCount: number;
    hasYouTubeKey: boolean;
    youtubeKeyHint: string | null;
  };
  geoOptions: { code: string; labelSk: string }[];
  cache: { fetchedAt: string; ageMinutes: number | null; count: number } | null;
  cacheTtlMinutes: number;
  youtubeApiCost: { chartPerCall: number; searchPerCall: number; dailyLimit: number };
}

interface LiveSignalsPanelProps {
  language?: string;
  /** Signály, ktoré používateľka vybrala pre plán (text pre AI). */
  onUseInPlan?: (contextText: string, count: number) => void;
  /** Koľko signálov je práve v pláne (aby bolo vidieť, že to funguje). */
  usedInPlanCount?: number;
}

const SOURCE_BADGE: Record<LiveSourceId, string> = {
  GOOGLE_TRENDS: "bg-sky-500/10 border-sky-500/30 text-sky-300",
  YOUTUBE_FEED: "bg-neutral-500/10 border-neutral-500/30 text-neutral-300",
  YOUTUBE_CHART: "bg-rose-500/10 border-rose-500/30 text-rose-300",
};

const SOURCE_SHORT: Record<LiveSourceId, string> = {
  GOOGLE_TRENDS: "Trendy",
  YOUTUBE_FEED: "Kanály",
  YOUTUBE_CHART: "Rebríček",
};

export const LiveSignalsPanel: React.FC<LiveSignalsPanelProps> = ({
  language = "sk",
  onUseInPlan,
  usedInPlanCount = 0,
}) => {
  const isSk = language !== "en";
  const [status, setStatus] = useState<TrendStatus | null>(null);
  const [bundle, setBundle] = useState<LiveSignalsBundle | null>(null);
  const [ageMinutes, setAgeMinutes] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [channelInput, setChannelInput] = useState("");
  const [channelBusy, setChannelBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/trends/status");
      const data = await res.json();
      if (data?.success) setStatus(data);
    } catch {
      /* stav sa nedá načítať — nižšie to povie načítanie signálov */
    }
  }, []);

  const loadSignals = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/trends/signals");
      const data = await res.json();
      if (data?.success) {
        setBundle(data.bundle ?? null);
        setAgeMinutes(data.ageMinutes ?? null);
        if (data.messageSk && !data.bundle) setNotice(data.messageSk);
      }
    } catch (err: any) {
      setError(isSk ? `Signály sa nedajú načítať: ${err?.message || "chyba"}` : "Could not load signals.");
    } finally {
      setIsLoading(false);
    }
  }, [isSk]);

  useEffect(() => {
    loadStatus();
    loadSignals();
  }, [loadStatus, loadSignals]);

  const refresh = async (force: boolean) => {
    setIsRefreshing(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/trends/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.errorSk || "obnovenie zlyhalo");
      if (data.fromCache) {
        setNotice(data.messageSk || null);
      } else {
        setNotice(null);
      }
      if (data.bundle) {
        setBundle(data.bundle);
        setAgeMinutes(data.ageMinutes ?? 0);
      }
      await loadStatus();
    } catch (err: any) {
      setError(
        isSk
          ? `Obnovenie sa nepodarilo: ${err?.message || "neznáma chyba"}`
          : "Refresh failed.",
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const addChannel = async () => {
    const value = channelInput.trim();
    if (!value) return;
    setChannelBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/trends/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addChannel: value }),
      });
      const data = await res.json();
      if (!data?.success) {
        throw new Error([data?.errorSk, data?.hintSk].filter(Boolean).join(" "));
      }
      setNotice(data.messageSk || "Kanál pridaný.");
      setChannelInput("");
      await loadStatus();
    } catch (err: any) {
      setError(isSk ? err?.message || "Kanál sa nepodarilo pridať." : "Could not add channel.");
    } finally {
      setChannelBusy(false);
    }
  };

  const removeChannel = async (id: string) => {
    try {
      await fetch("/api/trends/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeChannel: id }),
      });
      await loadStatus();
    } catch {
      setError(isSk ? "Kanál sa nepodarilo odobrať." : "Could not remove channel.");
    }
  };

  const signals = bundle?.signals ?? [];
  const selectedSignals = useMemo(
    () => signals.filter((s) => selected.includes(s.id)),
    [signals, selected],
  );
  const planContext = useMemo(() => signalContextForPlanSk(selectedSignals), [selectedSignals]);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const copyContext = async () => {
    try {
      await navigator.clipboard.writeText(planContext);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(isSk ? "Do schránky sa nepodarilo zapísať." : "Clipboard failed.");
    }
  };

  const failed = (bundle?.results ?? []).filter((r) => !r.ok);
  const ageLabel =
    ageMinutes === null
      ? isSk
        ? "nikdy neobnovené"
        : "never refreshed"
      : ageMinutes < 1
        ? isSk
          ? "práve teraz"
          : "just now"
        : isSk
          ? `pred ${ageMinutes} min`
          : `${ageMinutes} min ago`;

  return (
    <div className="space-y-4">
      {/* Hlavička + obnovenie */}
      <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-sky-400" />
            <p className="text-[11px] font-black text-neutral-200 uppercase tracking-wider">
              {isSk ? "Živé signály z platforiem" : "Live platform signals"}
            </p>
            <span className="text-[10px] text-neutral-500">
              {isSk ? `uložené ${ageLabel}` : ageLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {bundle && ageMinutes !== null && (
              <button
                type="button"
                onClick={() => refresh(true)}
                disabled={isRefreshing}
                className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
              >
                {isSk ? "Obnoviť aj tak" : "Force refresh"}
              </button>
            )}
            <button
              type="button"
              onClick={() => refresh(false)}
              disabled={isRefreshing}
              className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing
                ? isSk
                  ? "Sťahujem…"
                  : "Fetching…"
                : isSk
                  ? "Obnoviť signály"
                  : "Refresh signals"}
            </button>
          </div>
        </div>

        <p className="text-[10px] text-neutral-500 mt-2 leading-relaxed">
          {isSk
            ? `Sťahuje sa len na tvoje kliknutie — pri otvorení appky sa nikdy nič nestahuje. Uložené signály sú čerstvé ${status?.cacheTtlMinutes ?? 30} min, potom sa ponúkne obnovenie.`
            : "Fetching only on your click. Nothing runs on app open."}
        </p>

        {isLoading && !bundle && (
          <p className="text-[11px] text-neutral-400 mt-2">{isSk ? "Načítavam uložené signály…" : "Loading…"}</p>
        )}

        {notice && (
          <p className="text-[11px] text-sky-300 mt-3 flex items-start gap-2">
            <Activity className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{notice}</span>
          </p>
        )}

        {error && (
          <p className="text-[11px] text-rose-300 mt-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </p>
        )}
      </div>

      {/* Zhrnutie dávky */}
      {bundle && (
        <div className="p-4 rounded-xl bg-sky-500/5 border border-sky-500/25">
          <p className="text-[11px] text-neutral-200 leading-relaxed">{bundle.summarySk}</p>
          <p className="text-[10px] text-neutral-500 mt-2 italic">{LIVE_SIGNALS_DISCLAIMER_SK}</p>
        </div>
      )}

      {/* Stav zdrojov — vrátane dôvodov, prečo niečo nešlo */}
      {bundle && (
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2">
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">
            {isSk ? "Stav zdrojov — aj zlyhania s dôvodom" : "Source status"}
          </p>
          {(bundle.results as SourceFetchResult[]).map((r, i) => (
            <div key={`${r.source}-${i}`} className="flex items-start gap-2 text-[10px]">
              {r.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <span className="text-neutral-300 font-bold">{r.source.replace(/_/g, " ")}</span>
                {r.ok ? (
                  <span className="text-neutral-500">
                    {" "}
                    · {r.detailSk} {r.costSk ? `· ${r.costSk}` : ""}
                  </span>
                ) : (
                  <>
                    <span className="text-amber-300/90"> · {r.errorSk}</span>
                    {r.hintSk && <span className="block text-neutral-500 mt-0.5">{r.hintSk}</span>}
                  </>
                )}
              </div>
            </div>
          ))}
          <p className="text-[10px] text-neutral-500 pt-1">
            {isSk
              ? `YouTube rebríček stojí ${status?.youtubeApiCost.chartPerCall ?? 1} jednotku z ${(status?.youtubeApiCost.dailyLimit ?? 10000).toLocaleString("sk-SK")} na deň — nedá sa tým nič minúť omylom.`
              : ""}
          </p>
        </div>
      )}

      {/* Zoznam signálov */}
      {signals.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">
              {isSk ? `Signály (${signals.length}) — najsilnejšie prvé` : `Signals (${signals.length})`}
            </p>
            {selected.length > 0 && (
              <span className="text-[10px] text-violet-300">
                {isSk ? `vybrané ${selected.length}` : `${selected.length} selected`}
              </span>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
            {signals.map((s) => {
              const brief = signalBriefSk(s);
              const isOn = selected.includes(s.id);
              return (
                <div
                  key={s.id}
                  className={`p-3 rounded-xl border flex items-start gap-3 transition-colors ${
                    isOn ? "bg-violet-500/10 border-violet-500/40" : "bg-neutral-900 border-neutral-800"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggle(s.id)}
                    title={isSk ? "Použiť v pláne" : "Use in plan"}
                    className={`mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center ${
                      isOn ? "bg-violet-500 border-violet-400" : "border-neutral-600 hover:border-violet-400"
                    }`}
                  >
                    {isOn && <Check className="h-3 w-3 text-white" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-1.5 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider ${SOURCE_BADGE[s.source]}`}
                      >
                        {SOURCE_SHORT[s.source]}
                      </span>
                      <span className="text-[10px] text-neutral-500">{brief.originSk}</span>
                    </div>
                    <p className="text-[11px] text-neutral-200 mt-1 leading-snug break-words">{brief.lineSk}</p>
                    {s.contextText && (
                      <p className="text-[10px] text-neutral-500 mt-0.5 line-clamp-2">{s.contextText}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="h-1 w-20 rounded bg-neutral-800 overflow-hidden">
                        <div
                          className={`h-full ${s.score >= 75 ? "bg-rose-500" : s.score >= 55 ? "bg-amber-500" : "bg-neutral-600"}`}
                          style={{ width: `${s.score}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-neutral-500">
                        {isSk ? "sila" : "strength"} {s.score}/100
                      </span>
                      {s.url && (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[9px] text-sky-400 hover:text-sky-300 flex items-center gap-0.5"
                        >
                          <Link2 className="h-3 w-3" />
                          {isSk ? "otvoriť" : "open"}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Použiť v pláne */}
      {selected.length > 0 && (
        <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/30 space-y-2">
          <p className="text-[10px] font-black text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
            <Wand2 className="h-3.5 w-3.5" />
            {isSk ? "Toto sa pošle AI ako kontext k plánu" : "This goes to the AI"}
          </p>
          <pre className="text-[10px] text-neutral-300 whitespace-pre-wrap break-words font-mono max-h-40 overflow-y-auto">
            {planContext}
          </pre>
          <div className="flex items-center gap-2">
            {onUseInPlan && (
              <button
                type="button"
                onClick={() => onUseInPlan(planContext, selectedSignals.length)}
                className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-black uppercase tracking-wider"
              >
                {isSk ? "Použiť pri ďalšom pláne" : "Use in next plan"}
              </button>
            )}
            <button
              type="button"
              onClick={copyContext}
              className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? (isSk ? "Skopírované" : "Copied") : isSk ? "Kopírovať" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => setSelected([])}
              className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 text-[10px] font-bold uppercase tracking-wider"
            >
              {isSk ? "Zrušiť výber" : "Clear"}
            </button>
          </div>
          {usedInPlanCount > 0 && (
            <p className="text-[10px] text-emerald-300">
              {isSk ? `V pláne je použitých ${usedInPlanCount} signálov.` : `${usedInPlanCount} signals in the plan.`}
            </p>
          )}
        </div>
      )}

      {/* Kanály na sledovanie */}
      <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-3">
        <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">
          {isSk ? "Kanály, ktoré sledujem (YouTube)" : "Tracked channels"}
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            placeholder={isSk ? "youtube.com/@meno alebo UC…" : "youtube.com/@name"}
            className="flex-1 min-w-[180px] px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-200 placeholder:text-neutral-600"
          />
          <button
            type="button"
            onClick={addChannel}
            disabled={channelBusy || !channelInput.trim()}
            className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {channelBusy ? (isSk ? "Overujem…" : "Checking…") : isSk ? "Pridať" : "Add"}
          </button>
        </div>

        {(status?.settings.channels.length ?? 0) > 0 ? (
          <div className="space-y-1.5">
            {status!.settings.channels.map((id) => (
              <div key={id} className="flex items-center justify-between gap-2 text-[10px]">
                <span className="font-mono text-neutral-400 truncate">{id}</span>
                <button
                  type="button"
                  onClick={() => removeChannel(id)}
                  className="text-neutral-500 hover:text-rose-400 flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  {isSk ? "odobrať" : "remove"}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-neutral-500">
            {isSk
              ? "Zatiaľ nič nesledujem. Pridaj kanál — stačí odkaz (napr. youtube.com/@meno) a ID si overím sám cez kanálové RSS."
              : "No channels yet."}
          </p>
        )}

        {status && (
          <p className="text-[10px] text-neutral-500">
            {status.settings.hasYouTubeKey ? (
              <span className="text-emerald-300">
                {isSk ? "YouTube kľúč: nastavený " : "YouTube key: set "}
                {status.settings.youtubeKeyHint}
              </span>
            ) : (
              <span>
                {isSk
                  ? "YouTube rebríček (to, čo naozaj funguje, aj s počtami zhliadnutí) čaká na bezplatný kľúč z Google Cloud → YouTube Data API v3. Bez neho mám trending vyhľadávanie a čerstvé príspevky kanálov."
                  : "YouTube chart needs a free API key."}
              </span>
            )}
          </p>
        )}
      </div>

      {/* Poctivo: čo (zatiaľ) nejde */}
      <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
        <button
          type="button"
          onClick={() => setShowSources((v) => !v)}
          className="text-[10px] font-black text-neutral-400 uppercase tracking-wider flex items-center gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          {isSk ? "Odkiaľ to je a čo to naozaj znamená" : "Sources and limits"}
        </button>

        {showSources && status && (
          <div className="mt-3 space-y-3">
            {status.sources.map((s) => (
              <div key={s.id} className="text-[10px] leading-relaxed">
                <p className="text-neutral-200 font-bold">
                  {s.labelSk}
                  {s.needsKey ? (isSk ? " · vyžaduje kľúč" : " · needs key") : isSk ? " · bez kľúča" : " · no key"}
                </p>
                <p className="text-emerald-300/80">✓ {s.givesSk}</p>
                <p className="text-amber-300/80">! {s.limitsSk}</p>
              </div>
            ))}
            <div className="pt-2 border-t border-neutral-800">
              <p className="text-[10px] font-bold text-neutral-300 mb-1.5">
                {isSk ? "Platformy, ktoré zámerne NEnapájam:" : "Platforms I deliberately do not connect:"}
              </p>
              {status.platformLimits.map((p) => (
                <div key={p.platform} className="text-[10px] mb-2">
                  <span className="text-neutral-300 font-bold">{p.platform}</span>
                  <span className="text-neutral-500"> — {p.reasonSk}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

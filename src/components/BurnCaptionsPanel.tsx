import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  Flame,
  Info,
  Loader2,
  Sparkles,
  Square,
  Type,
} from "lucide-react";
import {
  BURN_HONESTY_SK,
  CAPTION_STYLES,
  type CaptionOverrides,
  type CaptionStyleCategory,
  type CaptionStyleId,
} from "../core/export/subtitleRender";
import {
  adviceInputFromContext,
  adviseCaptionStyle,
  type CaptionAdvice,
} from "../core/export/captionAdvisor";
import { CaptionStylePreview } from "./CaptionStylePreview";
import { CaptionProfileBar } from "./CaptionProfileBar";
import type { SpeechSegmentLike } from "../core/transcript/wordTiming";

/**
 * VYPÁLENIE TITULKOV DO OBRAZU (krok B) — UI.
 *
 * Prečo to nie je len tlačidlo: zapečené titulky sú nevratné a vyžadujú
 * prekódovanie. Appka preto:
 *  1. vopred zistí, či je na serveri ffmpeg (a keď nie, povie to **pred** kliknutím),
 *  2. ukáže čo sa stane (štýl, počet titulkov, strih, dĺžka klipu),
 *  3. pýta si vedomé potvrdenie („viem, že sa to už nedá vypnúť“),
 *  4. hlási skutočný priebeh v percentách z ffmpeg — žiadne točiace sa koliesko
 *     naslepo a žiadne tiché zlyhanie.
 *
 * Render beží na serveri (ffmpeg) — prehliadač na to nemá nástroj a appka to
 * nikdy nepredstiera.
 */

interface BurnCaptionsPanelProps {
  language?: string;
  /** Titulky s word-level časovaním (z automatického prepisu). */
  speechSegments?: SpeechSegmentLike[];
  /** Úseky klipu v časoch zdroja (z EDL). Prázdne = celé video. */
  keepRanges?: { start: number; end: number }[];
  /** Dĺžka zdrojového videa (informačne). */
  durationSec?: number | null;
  /** Zdrojové video z prehliadača (bez neho sa nedá nahrať na server). */
  getSourceBlob?: () => Promise<Blob | null>;
  /** Formát, pre ktorý klip je (TIKTOK/REELS/SHORTS/ADS) — vstup pre odporúčanie. */
  platform?: string;
  /** Počet strihov v klipe (tempo je dôležité pre voľbu štýlu). */
  cutCount?: number;
  /** Oblasť / typ klienta z knižnice trendov (napr. „b2b“, „fitness“). */
  niche?: string;
}

type Phase = "idle" | "uploading" | "rendering" | "done" | "error" | "canceled";

interface BurnStatus {
  state: string;
  percent: number;
  messageSk: string;
  errorSk: string | null;
  result: {
    outputName: string;
    outputUrl: string;
    sizeBytes: number;
    clipDurationSec: number;
    summarySk: string;
  } | null;
}

/** Názvy skupín v UI (aby sa v 9 štýloch dalo orientovať za sekundu). */
const STYLE_GROUPS: Record<CaptionStyleCategory, string> = {
  viralne: "🔥 Virálne (krátke formáty bez zvuku)",
  ciste: "🎬 Čisté (rozprávanie, YouTube, B2B)",
  brand: "🏢 Brand (firemné a klientske zadania)",
};

const STYLE_HINT_SK: Record<string, string> = {
  VIRAL_BOLD: "Submagic/CapCut štýl — veľké tučné, 2–3 slová, aktuálne slovo žlté.",
  CLEAN: "Pokojná celá veta — rozhovory, podcast, B2B.",
  MINIMAL: "Malé decentné písmo — firemné a dokumentárne video.",
};

function fmtMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtSec(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

/** Zistí skutočné rozmery videa z blobu (ASS musí sedieť na formát obrazu). */
async function probeVideoSize(blob: Blob): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const v = document.createElement("video");
    v.preload = "metadata";
    const done = (value: { width: number; height: number } | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    v.onloadedmetadata = () => {
      done(v.videoWidth > 0 && v.videoHeight > 0 ? { width: v.videoWidth, height: v.videoHeight } : null);
    };
    v.onerror = () => done(null);
    v.src = url;
  });
}

/** Upload s poctivým percentom (fetch to nevie, preto XHR). */
function uploadVideo(
  blob: Blob,
  name: string,
  onProgress: (percent: number) => void,
): Promise<{ uploadId: string; uploadName: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/export/upload?name=${encodeURIComponent(name)}`);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 200 && xhr.status < 300 && data.success) resolve(data);
        else reject(new Error(data.errorSk || `Nahrávanie zlyhalo (${xhr.status}).`));
      } catch {
        reject(new Error("Server nevrátil zrozumiteľnú odpoveď pri nahrávaní videa."));
      }
    };
    xhr.onerror = () => reject(new Error("Video sa nepodarilo nahrať na server (spojenie spadlo)."));
    xhr.send(blob);
  });
}

export const BurnCaptionsPanel: React.FC<BurnCaptionsPanelProps> = ({
  language = "sk",
  speechSegments,
  keepRanges,
  durationSec,
  getSourceBlob,
  platform,
  cutCount,
  niche,
}) => {
  const isSk = language === "sk";
  const [styleId, setStyleId] = useState<CaptionStyleId>("VIRAL_BOLD");
  /** Odchýlky vlastného štýlu klienta (brand kit) — idú do renderu aj do náhľadu. */
  const [overrides, setOverrides] = useState<CaptionOverrides>({});
  /** Názov aktívneho profilu (len na vysvetlenie v UI, render ide podľa hodnôt). */
  const [styleName, setStyleName] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [percent, setPercent] = useState(0);
  const [messageSk, setMessageSk] = useState("");
  const [status, setStatus] = useState<BurnStatus | null>(null);
  const [errorSk, setErrorSk] = useState<string | null>(null);
  /** Poznámky zo servera: čo si overil a čo spravil s titulkami. */
  const [notes, setNotes] = useState<string[]>([]);
  /** Parametre, ktoré server prečítal priamo zo súboru (nie z prehliadača). */
  const [verified, setVerified] = useState<{ width: number; height: number; fps: number | null } | null>(null);
  /** Odporúčanie štýlu (počíta sa lokálne, 0 tokenov, s dôvodmi). */
  const [showAdvice, setShowAdvice] = useState(true);
  const [server, setServer] = useState<{
    available: boolean;
    messageSk: string;
    ffmpegPath: string | null;
    maxUploadMb: number;
  } | null>(null);

  const jobRef = useRef<string | null>(null);
  const stoppedRef = useRef(false);

  const segments = Array.isArray(speechSegments) ? speechSegments : [];
  const wordCount = segments.reduce((sum, s) => sum + (Array.isArray(s.words) ? s.words.length : 0), 0);
  const keep = Array.isArray(keepRanges) && keepRanges.length > 0 ? keepRanges : [];
  const clipSeconds = keep.length
    ? keep.reduce((sum, k) => sum + Math.max(0, k.end - k.start), 0)
    : Number(durationSec) || 0;

  useEffect(() => {
    let alive = true;
    fetch("/api/export/ffmpeg")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setServer({
          available: Boolean(d.available),
          messageSk: String(d.messageSk ?? ""),
          ffmpegPath: d.ffmpegPath ?? null,
          maxUploadMb: Number(d.limits?.maxUploadMb ?? 0),
        });
      })
      .catch(() => {
        if (alive) {
          setServer({
            available: false,
            messageSk: isSk
              ? "Nepodarilo sa zistiť stav servera — skontroluj, či appka beží."
              : "Could not reach the server.",
            ffmpegPath: null,
            maxUploadMb: 0,
          });
        }
      });
    return () => {
      alive = false;
    };
  }, [isSk]);

  /** Sleduje priebeh renderu, kým nedobehne. */
  const poll = useCallback(async (jobId: string) => {
    for (;;) {
      if (stoppedRef.current) return;
      await new Promise((r) => setTimeout(r, 800));
      let data: any;
      try {
        const resp = await fetch(`/api/export/burn-captions/status?id=${encodeURIComponent(jobId)}`);
        data = await resp.json();
        if (!resp.ok || !data.success) throw new Error(data.errorSk || "Stav renderu sa nedá načítať.");
      } catch (err: any) {
        setPhase("error");
        setErrorSk(err?.message || "Spojenie so serverom sa stratilo počas renderu.");
        return;
      }

      const s: BurnStatus = data.status;
      setStatus(s);
      setPercent(s.percent);
      setMessageSk(s.messageSk);

      if (s.state === "done") {
        if (Array.isArray(data.notesSk) && data.notesSk.length) setNotes(data.notesSk);
        setPhase("done");
        return;
      }
      if (s.state === "error") {
        setPhase("error");
        setErrorSk(s.errorSk || "Render zlyhal.");
        return;
      }
      if (s.state === "canceled") {
        setPhase("canceled");
        setMessageSk(s.messageSk);
        return;
      }
    }
  }, []);

  const burn = async () => {
    setErrorSk(null);
    setStatus(null);

    if (!getSourceBlob) {
      setPhase("error");
      setErrorSk(
        isSk
          ? "Nemám prístup k zdrojovému videu (v prehliadači už nie je). Nahraj video znova a skús to."
          : "No access to the source video.",
      );
      return;
    }
    if (segments.length === 0) {
      setPhase("error");
      setErrorSk(
        isSk
          ? "Nemám titulky na vypálenie — najprv spusti „Automatické titulky“ (prepis) v záložke Titulky."
          : "No captions to burn.",
      );
      return;
    }

    stoppedRef.current = false;
    setPhase("uploading");
    setPercent(0);
    setMessageSk(isSk ? "Načítavam zdrojové video z prehliadača…" : "Reading the source video…");

    try {
      const blob = await getSourceBlob();
      if (!blob) throw new Error(isSk ? "Zdrojové video sa nepodarilo načítať." : "Could not read the source video.");

      setMessageSk(isSk ? "Zisťujem rozmer videa…" : "Checking video size…");
      const size = await probeVideoSize(blob);

      setMessageSk(isSk ? `Nahrávam video na server (${fmtMb(blob.size)})…` : "Uploading…");
      const uploaded = await uploadVideo(blob, "klip.mp4", (p) => setPercent(p));

      setPhase("rendering");
      setPercent(0);
      setMessageSk(isSk ? "Spúšťam ffmpeg…" : "Starting ffmpeg…");

      const resp = await fetch("/api/export/burn-captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId: uploaded.uploadId,
          uploadName: uploaded.uploadName,
          styleId,
          overrides,
          width: size?.width ?? 1080,
          height: size?.height ?? 1920,
          segments,
          keepRanges: keep,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) throw new Error(data.errorSk || "Vypálenie titulkov sa nepodarilo spustiť.");

      jobRef.current = data.jobId;
      setNotes(Array.isArray(data.notesSk) ? data.notesSk : []);
      setVerified({
        width: Number(data.probedWidth ?? size?.width ?? 0),
        height: Number(data.probedHeight ?? size?.height ?? 0),
        fps: data.probedFps ?? null,
      });
      setPercent(0);
      setMessageSk(
        isSk
          ? `ffmpeg vypáli ${data.eventCount} titulkov${data.wordHighlight ? " so zvýrazňovaním slov" : ""}…`
          : `Burning ${data.eventCount} captions…`,
      );
      await poll(data.jobId);
    } catch (err: any) {
      setPhase("error");
      setErrorSk(err?.message || (isSk ? "Vypálenie titulkov zlyhalo." : "Burning failed."));
    }
  };

  const stop = async () => {
    stoppedRef.current = true;
    const id = jobRef.current;
    if (id) {
      try {
        await fetch("/api/export/burn-captions/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: id }),
        });
      } catch {
        /* aj tak hlásime zastavenie — appka neklame o stave */
      }
    }
    setPhase("canceled");
    setMessageSk(
      isSk
        ? "Render zastavený. Rozpracovaný klip sa zahodil — zdrojové video je nedotknuté."
        : "Render canceled.",
    );
  };

  // Poradca: čisto lokálny výpočet z toho, čo o klipe viem.
  const advice: CaptionAdvice = useMemo(
    () =>
      adviseCaptionStyle({
        platform,
        niche,
        width: verified?.width ?? 1080,
        height: verified?.height ?? 1920,
        ...adviceInputFromContext({
          durationSec: clipSeconds > 0 ? clipSeconds : Number(durationSec) || undefined,
          cutCount: Number(cutCount) || 0,
          segments,
        }),
      }),
    [platform, niche, verified, clipSeconds, durationSec, cutCount, segments],
  );

  const recommendedStyle = advice.recommended
    ? CAPTION_STYLES.find((x) => x.id === advice.recommended) ?? null
    : null;
  const recommendedRank = advice.ranked.find((r) => r.id === advice.recommended) ?? null;

  const busy = phase === "uploading" || phase === "rendering";
  /** Koľko vlastných nastavení klienta je aktívnych (aby to bolo vidieť pred klikom). */
  const overrideCount = Object.values(overrides).filter((v) => v !== undefined && v !== "").length;
  const result = status?.result ?? null;
  const blockedByNoFfmpeg = server !== null && !server.available;

  return (
    <div className="rounded-2xl border border-orange-500/25 bg-gradient-to-br from-neutral-950 to-orange-950/10 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <div className="h-8 w-8 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
          <Flame className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[11px] font-black text-white uppercase tracking-wider">
            {isSk ? "Titulky zapečené do obrazu" : "Burn captions into the video"}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5 leading-relaxed">
            {isSk
              ? "Klip s titulkami, ktoré vidno aj bez zvuku — presne to, čo platformy odmeňujú. Voliteľne aj so strihom v jednom prekódovaní."
              : "One render: the cut plus hard-coded captions."}
          </p>
        </div>
      </div>

      {/* Stav ffmpeg na serveri — používateľ to má vedieť PRED kliknutím */}
      {server && (
        <div
          className={`p-2.5 rounded-xl border text-[10px] flex items-start gap-2 ${
            server.available
              ? "bg-emerald-500/5 border-emerald-500/25 text-emerald-200"
              : "bg-amber-500/10 border-amber-500/30 text-amber-200"
          }`}
        >
          {server.available ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          )}
          <span>
            {server.messageSk}
            {server.available && server.ffmpegPath && (
              <span className="block opacity-70 font-mono mt-0.5 truncate">{server.ffmpegPath}</span>
            )}
          </span>
        </div>
      )}

      {/* Poradca: ktorý štýl sa hodí a PREČO (0 tokenov, dá sa prečítať) */}
      {recommendedStyle && recommendedRank && (
        <div className="p-3 rounded-xl bg-sky-500/5 border border-sky-500/25 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <Sparkles className="h-3.5 w-3.5 text-sky-300 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-black text-sky-200 uppercase tracking-wider">
                  {isSk ? "Odporúčam pre tento klip" : "Recommended for this clip"}
                </p>
                <p className="text-[11px] text-white font-bold mt-0.5">{recommendedStyle.labelSk}</p>
                {!busy && styleId !== recommendedStyle.id && (
                  <button
                    type="button"
                    onClick={() => setStyleId(recommendedStyle.id)}
                    className="mt-1 px-2 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[9px] font-bold uppercase tracking-wider"
                  >
                    {isSk ? "Použiť odporúčaný" : "Use recommended"}
                  </button>
                )}
                {styleId === recommendedStyle.id && (
                  <p className="text-[9px] text-emerald-300 mt-1">
                    {isSk ? "✓ Toto je odporúčaný štýl" : "✓ Selected"}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAdvice((v) => !v)}
              className="text-[9px] text-sky-300/80 hover:text-sky-200 underline shrink-0"
            >
              {showAdvice ? (isSk ? "skryť prečo" : "hide why") : isSk ? "prečo?" : "why?"}
            </button>
          </div>

          {showAdvice && (
            <div className="space-y-1.5 pt-1 border-t border-sky-500/20">
              {recommendedRank.reasonsSk.slice(0, 4).map((r, i) => (
                <p key={i} className="text-[9px] text-sky-100/80 leading-relaxed">
                  • {r.textSk}
                </p>
              ))}
              {advice.ranked.slice(1, 3).map((alt) => (
                <p key={alt.id} className="text-[9px] text-neutral-400 leading-relaxed">
                  {isSk ? "Alternatíva" : "Alternative"}: <span className="text-neutral-300 font-bold">
                    {CAPTION_STYLES.find((x) => x.id === alt.id)?.labelSk ?? alt.id}
                  </span>
                  {alt.reasonsSk[0] ? ` — ${alt.reasonsSk[0].textSk}` : ""}
                </p>
              ))}
              {advice.cautionSk.slice(0, 2).map((c, i) => (
                <p key={`c${i}`} className="text-[9px] text-amber-200/80 leading-relaxed">
                  ⚠️ {c}
                </p>
              ))}
              <p className="text-[9px] text-neutral-500 leading-relaxed pt-1">{advice.basisSk}</p>
            </div>
          )}
        </div>
      )}

      {/* Vlastný štýl klienta: uložené farby a vzhľad na jeden klik */}
      <CaptionProfileBar
        styleId={styleId}
        overrides={overrides}
        segments={segments}
        width={verified?.width ?? 1080}
        height={verified?.height ?? 1920}
        disabled={busy}
        onApply={(id, o, name) => {
          setStyleId(id);
          setOverrides(o);
          setStyleName(name);
        }}
        onOverridesChange={(o) => {
          setOverrides(o);
          setStyleName(null);
        }}
      />

      {/* Možnosti výberu tituliek — s náhľadom, aby sa nemuselo renderovať */}
      <div>
        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
          <Type className="h-3 w-3" /> {isSk ? "Možnosti výberu tituliek" : "Caption style options"}
          <span className="text-[9px] font-normal text-neutral-500 normal-case">
            {isSk ? `(${CAPTION_STYLES.length} štýlov · náhľad ukazuje tvoje slová, bez renderovania)` : ""}
          </span>
        </label>

        {(Object.keys(STYLE_GROUPS) as CaptionStyleCategory[]).map((cat) => (
          <div key={cat} className="mt-2">
            <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
              {STYLE_GROUPS[cat]}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {CAPTION_STYLES.filter((x) => x.category === cat).map((style) => {
                const selected = styleId === style.id;
                const isRecommended = advice.recommended === style.id;
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => {
                      setStyleId(style.id);
                      // Základný štýl sa mení, doladenie klienta zostáva — je to
                      // častá práca („rovnaké farby, iný štýl“).
                    }}
                    disabled={busy}
                    title={`${style.descriptionSk} · ${style.inspirationSk}`}
                    className={`p-2 rounded-xl border text-left transition-colors flex gap-2 ${
                      selected ? "border-orange-500/60 bg-orange-500/10" : "border-neutral-800 hover:border-neutral-700"
                    }`}
                  >
                    <CaptionStylePreview
                      styleId={style.id}
                      overrides={style.id === styleId ? overrides : undefined}
                      segments={segments}
                      width={verified?.width ?? 1080}
                      height={verified?.height ?? 1920}
                      previewHeight={92}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-white flex items-center gap-1">
                        {style.labelSk}
                        {isRecommended && (
                          <span className="text-[8px] px-1 py-0.5 rounded bg-sky-500/20 text-sky-200 border border-sky-500/30">
                            {isSk ? "odporúčané" : "picked"}
                          </span>
                        )}
                      </p>
                      <p className="text-[9px] text-neutral-400 mt-0.5 leading-snug">{style.bestForSk}</p>
                      <p className="text-[8px] text-neutral-600 mt-0.5 leading-snug">{style.inspirationSk}</p>
                      {selected && (
                        <p className="text-[8px] text-orange-300 mt-0.5 leading-snug">
                          {isSk ? "✓ vybrané · " : "✓ "}
                          {style.highlightMode === "active-word"
                            ? isSk ? "zvýrazňuje hovorené slovo" : "highlights spoken word"
                            : style.highlightMode === "keywords"
                              ? isSk ? "zdôrazní čísla a silné slová" : "emphasises numbers"
                              : isSk ? "čistý text" : "plain text"}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Čo sa presne stane */}
      <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-[10px] text-neutral-400 space-y-1">
        <p>
          {isSk ? "Vypáli sa " : "Burning "}
          <span className="text-white font-bold">{segments.length}</span> {isSk ? "titulkov" : "captions"}
          {wordCount > 0 && (
            <>
              {" "}
              ({wordCount} {isSk ? "slov so zvýrazňovaním" : "highlighted words"})
            </>
          )}
          {keep.length > 0 && (
            <>
              {" "}
              {isSk ? "do klipu" : "into a clip"}{" "}
              <span className="text-white font-bold">{keep.length}</span> {isSk ? "úsekov" : "segments"} (
              {fmtSec(clipSeconds)})
            </>
          )}
        </p>
        <p className="text-[9px] text-neutral-300">
          {isSk ? "Štýl: " : "Style: "}
          <span className="font-bold text-white">
            {CAPTION_STYLES.find((x) => x.id === styleId)?.labelSk ?? styleId}
          </span>
          {styleName && <span className="text-fuchsia-300"> · profil „{styleName}“</span>}
          {overrideCount > 0 && !styleName && (
            <span className="text-fuchsia-300"> · vlastné farby/nastavenia ({overrideCount})</span>
          )}
          {overrideCount > 0 && (
            <span className="text-neutral-500"> — náhľady vyššie už kreslia tvoj vzhľad</span>
          )}
        </p>
        {verified && verified.width > 0 && (
          <p className="text-[9px] text-emerald-300/80">
            {isSk ? "Server si overil zo súboru: " : "Server verified: "}
            <span className="font-mono">
              {verified.width}×{verified.height}
              {verified.fps ? ` · ${verified.fps} fps` : ""}
            </span>
          </p>
        )}
        <p className="flex items-start gap-1.5 text-neutral-500">
          <Info className="h-3 w-3 shrink-0 mt-0.5" />
          <span>
            {isSk
              ? "Rám videa sa nemení (nič sa neorezáva) — titulky sa píšu do pôvodných rozmerov. Rozhranie aplikácií rešpektujú okraje."
              : "Framing is preserved."}
          </span>
        </p>
      </div>

      {/* Poctivé mantinely */}
      <div className="space-y-1">
        {BURN_HONESTY_SK.map((h, i) => (
          <p key={i} className="text-[10px] text-neutral-400 leading-relaxed flex items-start gap-1.5">
            <AlertCircle className="h-3 w-3 text-amber-400/80 shrink-0 mt-0.5" />
            <span>{h.replace(/\*\*/g, "")}</span>
          </p>
        ))}
      </div>

      <label className="flex items-start gap-2 text-[10px] text-neutral-300 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={busy}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 accent-orange-500"
        />
        <span>
          {isSk
            ? "Rozumiem, že po vypálení sa titulky nedajú vypnúť a video sa prekóduje. Chcem ich zapečené do obrazu."
            : "I understand captions become part of the picture."}
        </span>
      </label>

      {/* Tlačidlá */}
      <div className="flex flex-wrap items-center gap-2">
        {busy ? (
          <button
            type="button"
            onClick={stop}
            className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-rose-600 text-neutral-200 hover:text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"
          >
            <Square className="h-3.5 w-3.5" />
            {isSk ? "Zastaviť" : "Cancel"}
          </button>
        ) : (
          <button
            type="button"
            onClick={burn}
            disabled={!confirmed || blockedByNoFfmpeg || segments.length === 0}
            title={
              blockedByNoFfmpeg
                ? server?.messageSk
                : segments.length === 0
                  ? isSk
                    ? "Najprv vygeneruj automatické titulky."
                    : "Generate captions first."
                  : undefined
            }
            className="px-3 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"
          >
            <Flame className="h-3.5 w-3.5" />
            {phase === "error" || phase === "canceled" || phase === "done"
              ? isSk
                ? "Vypáliť znova"
                : "Burn again"
              : isSk
                ? "Vypáliť titulky do videa"
                : "Burn captions"}
          </button>
        )}
        {clipSeconds > 0 && (
          <span className="text-[10px] text-neutral-500">
            {isSk ? "Prekóduje sa" : "Re-encode"} ~{fmtSec(clipSeconds)} {isSk ? "videa" : "of video"}
          </span>
        )}
      </div>

      {/* Priebeh */}
      {busy && (
        <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/25">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 text-orange-300 animate-spin" />
            <p className="text-[10px] font-bold text-orange-200">{messageSk}</p>
          </div>
          <div className="mt-2 h-1.5 rounded bg-neutral-800 overflow-hidden">
            <div className="h-full bg-orange-500 transition-all" style={{ width: `${Math.max(2, percent)}%` }} />
          </div>
          <p className="text-[9px] text-neutral-500 mt-1">
            {phase === "uploading"
              ? isSk
                ? "Nahrávam zdrojové video do servera (potrebné raz, aby ffmpeg mohol čítať súbor)."
                : "Uploading the source video."
              : `${percent} % · ${isSk ? "ffmpeg prekóduje obraz" : "ffmpeg re-encoding"}`}
          </p>
        </div>
      )}

      {phase === "canceled" && (
        <div className="p-2.5 rounded-xl bg-neutral-800/50 border border-neutral-700 text-[10px] text-neutral-300">
          {messageSk}
        </div>
      )}

      {errorSk && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[10px] text-rose-200 flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{errorSk}</span>
        </div>
      )}

      {phase === "done" && result && (
        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/30 space-y-2">
          <p className="text-[11px] font-black text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {isSk ? "Hotovo — titulky sú v obraze" : "Done"}
          </p>
          <p className="text-[10px] text-neutral-300">{result.summarySk}</p>
          <p className="text-[10px] text-neutral-500">
            {fmtMb(result.sizeBytes)} · {fmtSec(result.clipDurationSec)} · MP4 (H.264 + AAC)
          </p>
          {notes.length > 0 && (
            <div className="pt-1 space-y-1">
              {notes.map((n, i) => (
                <p key={i} className="text-[9px] text-neutral-400 leading-relaxed">
                  • {n.replace(/\*\*/g, "")}
                </p>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <a
              href={result.outputUrl}
              download={result.outputName}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
            >
              <Download className="h-3 w-3" />
              {isSk ? "Stiahnuť klip" : "Download"}
            </a>
            <a
              href={`${result.outputUrl}?inline=1`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
            >
              <ExternalLink className="h-3 w-3" />
              {isSk ? "Prehrať v novej karte" : "Open preview"}
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default BurnCaptionsPanel;

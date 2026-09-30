import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Play, Download, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ProjectModel } from "../core/types/project";
import { buildCanonicalFramePlan, canonicalFrameSummarySk, projectContentEndSec } from "../core/render/canonicalFrame";
import { renderEngine } from "../core/render/renderEngine";
import { buildCanonicalExportPlan, canonicalExportSummarySk, canonicalOverlayAssets, type CanonicalExportPlan } from "../core/export/canonicalExport";

/**
 * CANONICAL NÁHĽAD + EXPORT (krok 7).
 *
 * Jedna canonical časová os → jeden render path:
 *  • Náhľad kreslí **presne to, čo pôjde do exportu** (rovnaký canonical plán snímky
 *    aj rovnaký kompozitor ako offline render v prehliadači).
 *  • Export skladá zadanie z canonical osi a posiela ho do **existujúcej** renderovacej
 *    linky (ffmpeg v appke). Žiadny druhý render engine.
 *
 * Čo tento panel zámerne robí nahlas:
 *  • keď sa vrstva nedá nakresliť (médium nie je načítané), napíše to,
 *  • keď renderovacia linka niečo nevykresľuje (b-roll, zoom), napíše to **pred** renderom,
 *  • keď sa render nepodarí, povie dôvod — nikdy „hotovo“ bez súboru.
 */

export interface CanonicalExportPanelProps {
  language?: "sk" | "en";
  /** Canonical projekt (staticky — pre SSR testy a náhľady). */
  project?: ProjectModel | null;
  /**
   * Živý canonical projekt. Keď je zadaný, náhľad sa po každej zmene osi
   * (napr. po Apply) prekreslí — a prekreslí sa LEN tento panel, nie celá appka.
   */
  getProject?: () => ProjectModel | null;
  /** Odber zmien canonical osi (CommandManager). */
  subscribeToCanonical?: (onChange: () => void) => () => void;
  /** Aktuálny čas prehrávača — náhľad kreslí presne túto snímku. */
  currentTime?: number;
  /** URL zdrojového videa v prehliadači (na kreslenie náhľadu). */
  mediaUrl?: string | null;
  /** Zdrojový súbor pre upload na server (render prebieha na serveri). */
  getSourceBlob?: () => Promise<Blob | null>;
  /**
   * Súbor pre ľubovoľné médium projektu (b-roll / fotky). Bez neho obrazové
   * vrstvy vo videu nebudú — a panel to povie, nie zamlčí.
   */
  getAssetBlob?: (assetId: string, name: string) => Promise<Blob | null>;
  showToast?: (message: string) => void;
  /** Predvolene zapnutý náhľad — používateľ má vidieť, čo sa exportuje. */
  defaultPreviewOn?: boolean;
}

interface BurnStatusLike {
  state?: string;
  percent?: number;
  messageSk?: string;
  errorSk?: string | null;
  result?: { outputName?: string; outputUrl?: string; sizeBytes?: number; clipDurationSec?: number; summarySk?: string } | null;
}

export const CanonicalExportPanel: React.FC<CanonicalExportPanelProps> = ({
  language = "sk",
  project: projectProp = null,
  getProject,
  subscribeToCanonical,
  currentTime = 0,
  mediaUrl,
  getSourceBlob,
  getAssetBlob,
  showToast,
  defaultPreviewOn = true,
}) => {
  const isSk = language === "sk";
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [previewOn, setPreviewOn] = useState(defaultPreviewOn);
  const [previewErrorSk, setPreviewErrorSk] = useState<string | null>(null);
  /** Prekreslenie po zmene canonical osi (Apply/undo/rollback) — bez rerenderu appky. */
  const [, setCanonicalTick] = useState(0);

  useEffect(() => {
    if (!subscribeToCanonical) return;
    return subscribeToCanonical(() => setCanonicalTick((t) => t + 1));
  }, [subscribeToCanonical]);

  /** Projekt vždy čerstvý (canonical os je jediný zdroj pravdy). */
  const project = getProject ? getProject() : projectProp;

  const [exportPhase, setExportPhase] = useState<"idle" | "uploading" | "rendering" | "done" | "error">("idle");
  const [percent, setPercent] = useState(0);
  const [messageSk, setMessageSk] = useState("");
  const [notesSk, setNotesSk] = useState<string[]>([]);
  const [status, setStatus] = useState<BurnStatusLike | null>(null);
  const [errorSk, setErrorSk] = useState<string | null>(null);
  const jobRef = useRef<string | null>(null);
  /** Nahraté obrazové médiá: assetId → súbor na serveri. */
  const [assetUploads, setAssetUploads] = useState<Record<string, string>>({});
  /** Čo sa podarilo/ nepodarilo pripraviť pre render (vidí to používateľ). */
  const [overlayPrepNotesSk, setOverlayPrepNotesSk] = useState<string[]>([]);
  const prepKeyRef = useRef<string>("");

  /** Aktivované médium: hlavné video z canonical osi (na kreslenie náhľadu). */
  const mainVideoAssetId = useMemo(() => {
    if (!project) return null;
    for (const track of project.tracks) {
      for (const clip of track.clips) {
        if (clip.type === "video" && clip.assetId) return clip.assetId;
      }
    }
    return null;
  }, [project]);

  const contentEndSec = useMemo(() => (project ? projectContentEndSec(project) : 0), [project]);

  /** Rozmery náhľadu berieme z projektu (žiadne „približne“). */
  const targetWidth = project?.settings?.width ?? 1080;
  const targetHeight = project?.settings?.height ?? 1920;

  // --- Register média pre canonical kreslenie -------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !mainVideoAssetId) return;
    renderEngine.registerMediaElement(mainVideoAssetId, video);
  }, [mainVideoAssetId, mediaUrl]);

  // --- Vykreslenie canonical snímky (rovnaký kompozitor ako offline render) --
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !project || !previewOn) return;
    try {
      renderEngine.renderFrame(project, currentTime, canvas);
      setPreviewErrorSk(null);
    } catch (err: any) {
      setPreviewErrorSk(err?.message ? String(err.message) : isSk ? "Náhľad sa nepodarilo vykresliť." : "Preview failed.");
    }
  }, [project, currentTime, previewOn, isSk]);

  useEffect(() => {
    draw();
  }, [draw]);

  /** Plán snímky — používateľovi povie, čo je v obraze a čo sa (ne)dá nakresliť. */
  const framePlan = useMemo(() => {
    if (!project) return null;
    const available = new Set<string>();
    if (mainVideoAssetId) available.add(mainVideoAssetId);
    return buildCanonicalFramePlan(project, currentTime, { availableMedia: available, reportEmptyText: false });
  }, [project, currentTime, mainVideoAssetId]);

  /** Médiá, ktoré canonical os potrebuje ako obrazové vrstvy. */
  const neededAssets = useMemo(() => (project ? canonicalOverlayAssets(project) : []), [project]);
  const neededKey = useMemo(() => neededAssets.map((a) => a.assetId).sort().join("|"), [neededAssets]);

  /** Upload jedného overlay média (rovnaké percentá ako pri hlavnom videu). */
  const uploadAsset = (blob: Blob, name: string) =>
    new Promise<{ uploadId: string; uploadName: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/export/upload?name=${encodeURIComponent(name)}`);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText || "{}");
          if (xhr.status >= 200 && xhr.status < 300 && data.success) resolve(data);
          else reject(new Error(data.errorSk || `Nahrávanie vrstvy zlyhalo (${xhr.status}).`));
        } catch {
          reject(new Error(isSk ? "Server nevrátil zrozumiteľnú odpoveď pri nahrávaní vrstvy." : "Unreadable response."));
        }
      };
      xhr.onerror = () => reject(new Error(isSk ? "Vrstvu sa nepodarilo nahrať (spojenie spadlo)." : "Upload failed."));
      xhr.send(blob);
    });

  /**
   * Pripraví obrazové vrstvy vopred (aby používateľ videl už pred renderom,
   * čo vo videu naozaj bude). Nikdy nič nepredstiera: čo sa nedá získať, povie.
   */
  const prepareOverlays = useCallback(async (): Promise<Record<string, string>> => {
    if (!project || neededAssets.length === 0) return {};
    if (!getAssetBlob) {
      setOverlayPrepNotesSk([
        isSk
          ? `${neededAssets.length} obrazových vrstiev sa nedá pripraviť — médiá nie sú v tomto náhľade pripojené. Vo videu nebudú.`
          : `${neededAssets.length} overlays cannot be prepared — media not wired in this preview.`,
      ]);
      return {};
    }

    const uploads: Record<string, string> = {};
    const notes: string[] = [];
    for (const asset of neededAssets) {
      try {
        const blob = await getAssetBlob(asset.assetId, asset.name);
        if (!blob) {
          notes.push(
            isSk
              ? `Médium „${asset.name}“ sa nepodarilo načítať — táto vrstva vo videu nebude (v projekte zostáva).`
              : `Could not read “${asset.name}”.`,
          );
          continue;
        }
        const uploaded = await uploadAsset(blob, asset.name);
        uploads[asset.assetId] = uploaded.uploadId;
        notes.push(
          isSk
            ? `Vrstva „${asset.name}“ je pripravená (${(blob.size / 1024).toFixed(0)} kB).`
            : `Overlay “${asset.name}” ready.`,
        );
      } catch (err: any) {
        notes.push(isSk ? `Vrstvu „${asset.name}“ sa nepodarilo nahrať: ${err?.message ?? "chyba"}.` : `Overlay upload failed.`);
      }
    }
    setAssetUploads(uploads);
    setOverlayPrepNotesSk(notes);
    return uploads;
  }, [project, neededAssets, getAssetBlob, isSk]);

  useEffect(() => {
    if (!project || neededAssets.length === 0 || !getAssetBlob) return;
    if (prepKeyRef.current === neededKey) return;
    prepKeyRef.current = neededKey;
    void prepareOverlays();
  }, [neededKey, neededAssets.length, project, getAssetBlob, prepareOverlays]);

  const exportPlan: CanonicalExportPlan | null = useMemo(() => {
    if (!project) return null;
    return buildCanonicalExportPlan(
      project,
      {
        uploadId: "", // dozvieme sa ho až po nahratí — zámerne: bez uploadu sa nedá renderovať
        uploadName: "video.mp4",
        width: targetWidth,
        height: targetHeight,
      },
      { assetUploads },
    );
  }, [project, targetWidth, targetHeight, assetUploads]);

  /** Upload so skutočným percentom (fetch to nevie — preto XHR). */
  const uploadVideo = (blob: Blob, name: string, onProgress: (p: number) => void) =>
    new Promise<{ uploadId: string; uploadName: string }>((resolve, reject) => {
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
          reject(new Error(isSk ? "Server nevrátil zrozumiteľnú odpoveď pri nahrávaní." : "Unreadable server response."));
        }
      };
      xhr.onerror = () => reject(new Error(isSk ? "Video sa nepodarilo nahrať (spojenie spadlo)." : "Upload failed."));
      xhr.send(blob);
    });

  const runExport = async () => {
    if (!project) return;
    if (!getSourceBlob) {
      setErrorSk(isSk ? "V tomto náhľade nie je pripojené zdrojové video — export nie je dostupný." : "No source video wired.");
      setExportPhase("error");
      return;
    }
    setExportPhase("uploading");
    setPercent(0);
    setErrorSk(null);
    setStatus(null);
    setNotesSk([]);

    try {
      setMessageSk(isSk ? "Načítavam zdrojové video z prehliadača…" : "Reading source video…");
      const blob = await getSourceBlob();
      if (!blob) throw new Error(isSk ? "Zdrojové video sa nepodarilo načítať." : "Could not read the source video.");

      setMessageSk(isSk ? `Nahrávam video na server (${(blob.size / (1024 * 1024)).toFixed(1)} MB)…` : "Uploading…");
      const uploaded = await uploadVideo(blob, "klip.mp4", setPercent);

      // Obrazové vrstvy pripravíme (ak ešte nie sú) — bez nich by vo videu neboli.
      const overlayUploads = Object.keys(assetUploads).length > 0 ? assetUploads : await prepareOverlays();

      // Zadanie sa skladá z canonical osi **až teraz**, s reálnym uploadId.
      const freshPlan = buildCanonicalExportPlan(
        project,
        {
          uploadId: uploaded.uploadId,
          uploadName: uploaded.uploadName ?? "klip.mp4",
          width: targetWidth,
          height: targetHeight,
        },
        { assetUploads: overlayUploads },
      );
      if (!freshPlan.canExport) {
        throw new Error(freshPlan.blockersSk.join(" "));
      }

      setExportPhase("rendering");
      setPercent(0);
      setMessageSk(isSk ? "Spúšťam ffmpeg na serveri…" : "Starting ffmpeg…");

      const resp = await fetch("/api/export/burn-captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(freshPlan.request),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) throw new Error(data.errorSk || (isSk ? "Render sa nepodarilo spustiť." : "Render failed to start."));

      jobRef.current = data.jobId;
      setNotesSk([...(Array.isArray(data.notesSk) ? data.notesSk : []), ...freshPlan.notesSk]);
      setPercent(0);
      setMessageSk(
        isSk
          ? `Server vypáli ${data.eventCount} titulkov z canonical časovej osi…`
          : `Burning ${data.eventCount} captions from the canonical timeline…`,
      );

      // Polling
      const started = Date.now();
      while (Date.now() - started < 15 * 60 * 1000) {
        await new Promise((r) => setTimeout(r, 1200));
        const stRes = await fetch(`/api/export/burn-captions/status?id=${encodeURIComponent(data.jobId)}`);
        const st = await stRes.json();
        const s: BurnStatusLike = st?.status ?? {};
        setStatus(s);
        setPercent(s.percent ?? 0);
        if (s.messageSk) setMessageSk(s.messageSk);
        if (s.state === "done") {
          setExportPhase("done");
          setMessageSk(isSk ? "Hotovo — súbor je hotový (nižšie si ho stiahneš)." : "Done — download below.");
          showToast?.(isSk ? "✅ Export z canonical časovej osi dokončený." : "✅ Canonical export finished.");
          return;
        }
        if (s.state === "error" || s.state === "canceled") {
          throw new Error(s.errorSk || (isSk ? "Render zlyhal." : "Render failed."));
        }
      }
      throw new Error(isSk ? "Render trvá príliš dlho — vzdal som to (a nič netvrdím)." : "Render timed out.");
    } catch (err: any) {
      setExportPhase("error");
      setErrorSk(err?.message || (isSk ? "Export zlyhal." : "Export failed."));
    }
  };

  if (!project) return null;

  const activePlan = exportPlan;
  const resultUrl = status?.result?.outputUrl ?? null;

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-black text-white uppercase tracking-wide">
          <Eye className="w-4 h-4 text-cyan-400" />
          {isSk ? "5. Náhľad a export z canonical časovej osi" : "5. Preview & export from the canonical timeline"}
        </h3>
        <button
          onClick={() => setPreviewOn((v) => !v)}
          className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold transition-colors ${
            previewOn
              ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-300"
              : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-white"
          }`}
        >
          {previewOn ? (isSk ? "Náhľad zapnutý" : "Preview ON") : isSk ? "Náhľad vypnutý" : "Preview OFF"}
        </button>
      </div>

      <p className="text-[10px] text-neutral-400">
        {isSk
          ? "Náhľad kreslí presne to, čo pôjde do exportu: rovnaká canonical časová os, rovnaký plán snímky aj kompozitor. Žiadne dva render paths."
          : "The preview draws exactly what the export renders: same canonical timeline, same frame plan, same compositor."}
      </p>
      <p className="text-[10px] text-neutral-500">
        {isSk
          ? "Prehrávač hore má zatiaľ vlastné (staršie) vrstvy — preto sa môže líšiť. Rozhoduje to, čo vidíš tu: to ide do súboru."
          : "The player above still uses its own legacy layers — it may differ. What you see here is what goes into the file."}
      </p>

      {/* --- NÁHĽAD --------------------------------------------------------- */}
      {previewOn && (
        <div className="space-y-2">
          <div
            className="relative mx-auto rounded-xl overflow-hidden border border-neutral-800 bg-black"
            style={{ aspectRatio: `${targetWidth} / ${targetHeight}`, maxHeight: 320, width: "auto" }}
          >
            <canvas ref={canvasRef} className="w-full h-full block" />
          </div>
          <video ref={videoRef} src={mediaUrl ?? undefined} muted playsInline preload="auto" className="hidden" />
          {previewErrorSk ? (
            <p className="text-[10px] text-rose-300">⚠️ {previewErrorSk}</p>
          ) : (
            <p className="text-[10px] text-neutral-400">
              {isSk ? "V obraze: " : "In frame: "}
              {framePlan ? canonicalFrameSummarySk(framePlan) : "—"}
            </p>
          )}
          {framePlan && framePlan.skipped.length > 0 && (
            <p className="text-[10px] text-amber-300">
              {isSk ? "Nevykreslené vrstvy: " : "Not drawn: "}
              {framePlan.skipped.map((s) => s.name).join(", ")} — {framePlan.skipped[0].reasonSk}
            </p>
          )}
          {contentEndSec > 0 && (
            <p className="text-[10px] text-neutral-500">
              {isSk
                ? `Canonical os má obsah do ${contentEndSec.toFixed(1).replace(".", ",")} s. Náhľad sleduje playhead prehrávača.`
                : `Canonical timeline ends at ${contentEndSec.toFixed(1)} s.`}
            </p>
          )}
        </div>
      )}

      {/* --- EXPORT --------------------------------------------------------- */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3 space-y-2">
        <p className="text-[10px] font-bold text-neutral-300 uppercase tracking-wide">
          {isSk ? "Export z tej istej canonical osi" : "Export from the same canonical timeline"}
        </p>

        {activePlan && (
          <>
            <ul className="space-y-1">
              {activePlan.notesSk.map((n, i) => (
                <li key={`n-${i}`} className="text-[10px] text-neutral-400">
                  • {n}
                </li>
              ))}
            </ul>
            {overlayPrepNotesSk.length > 0 && (
              <ul className="space-y-1">
                {overlayPrepNotesSk.map((n, i) => (
                  <li
                    key={`prep-${i}`}
                    className={`text-[10px] ${n.includes("nepodarilo") || n.includes("nemá") || n.includes("nedá") ? "text-amber-300" : "text-neutral-400"}`}
                  >
                    • {n}
                  </li>
                ))}
              </ul>
            )}
            {activePlan.unsupportedSk.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 space-y-1">
                <p className="text-[10px] font-bold text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {isSk ? "Čo táto renderovacia linka zatiaľ nevykresľuje" : "Not rendered by this pipeline yet"}
                </p>
                {activePlan.unsupportedSk.map((n, i) => (
                  <p key={`u-${i}`} className="text-[10px] text-amber-200/80">
                    – {n}
                  </p>
                ))}
              </div>
            )}
            {!activePlan.parity.matched && (
              <p className="text-[10px] text-rose-300">
                ⚠️{" "}
                {isSk
                  ? `Zhoda canonical ↔ zadanie NIE je: chýba ${activePlan.parity.missingTexts.length}, navyše ${activePlan.parity.extraTexts.length}. Export nepustím, kým to nesedí.`
                  : "Canonical ↔ request mismatch — export blocked."}
              </p>
            )}
          </>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={runExport}
            disabled={exportPhase === "uploading" || exportPhase === "rendering" || !getSourceBlob || (activePlan ? !activePlan.canExport : true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold transition-colors"
          >
            {exportPhase === "uploading" || exportPhase === "rendering" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : exportPhase === "done" ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            {exportPhase === "done"
              ? isSk
                ? "Vyrenderované"
                : "Rendered"
              : isSk
                ? "Vyrenderovať z canonical osi"
                : "Render from canonical timeline"}
          </button>
          {resultUrl && (
            <a
              href={resultUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-[11px] font-bold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              {isSk ? "Stiahnuť hotový klip" : "Download"}
            </a>
          )}
          {!getSourceBlob && (
            <span className="text-[10px] text-neutral-500">
              {isSk ? "Zdrojové video nie je v tomto náhľade pripojené." : "Source video not wired here."}
            </span>
          )}
        </div>

        {(exportPhase === "uploading" || exportPhase === "rendering") && (
          <div className="space-y-1">
            <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
              <div className="h-full bg-cyan-500 transition-all" style={{ width: `${percent}%` }} />
            </div>
            <p className="text-[10px] text-neutral-400">{messageSk}</p>
          </div>
        )}

        {exportPhase === "done" && status?.result && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2 space-y-0.5">
            <p className="text-[10px] font-bold text-emerald-300">
              {isSk ? "Hotový súbor" : "Finished file"}: {status.result.outputName}
            </p>
            {status.result.clipDurationSec ? (
              <p className="text-[10px] text-emerald-200/80">
                {isSk ? "Dĺžka" : "Duration"}: {status.result.clipDurationSec.toFixed(2)} s
                {status.result.sizeBytes ? ` · ${(status.result.sizeBytes / 1024).toFixed(0)} kB` : ""}
              </p>
            ) : null}
            {status.result.summarySk && <p className="text-[10px] text-emerald-200/80">{status.result.summarySk}</p>}
          </div>
        )}

        {exportPhase === "error" && errorSk && (
          <p className="text-[10px] text-rose-300">
            ⛔ {errorSk} {isSk ? "Zdrojové video zostalo nedotknuté." : "Source untouched."}
          </p>
        )}

        {notesSk.length > 0 && (
          <details className="text-[10px] text-neutral-400">
            <summary className="cursor-pointer text-neutral-300">
              {isSk ? `Poznámky k renderu (${notesSk.length})` : `Render notes (${notesSk.length})`}
            </summary>
            <ul className="mt-1 space-y-0.5">
              {notesSk.map((n, i) => (
                <li key={`note-${i}`}>• {n}</li>
              ))}
            </ul>
          </details>
        )}

        {activePlan && !activePlan.canExport && (
          <p className="text-[10px] text-amber-300">
            {isSk ? "Render sa nedá spustiť: " : "Cannot render: "}
            {activePlan.blockersSk.join(" ")}
          </p>
        )}

        <p className="text-[10px] text-neutral-500">{canonicalExportSummarySk({
          request: activePlan?.request ?? { uploadId: "", uploadName: "", styleId: "VIRAL_BOLD", width: 0, height: 0, segments: [], keepRanges: [] },
          notesSk: [],
          unsupportedSk: activePlan?.unsupportedSk ?? [],
          parity: activePlan?.parity ?? { canonicalCaptionClips: 0, requestSegments: 0, missingTexts: [], extraTexts: [], matched: true },
          canExport: activePlan?.canExport ?? false,
          blockersSk: activePlan?.blockersSk ?? [],
        }).split("\n")[1]}</p>
      </div>
    </div>
  );
};

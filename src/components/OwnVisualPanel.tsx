import React, { useMemo, useState } from "react";
import {
  Sparkles,
  Search,
  Upload,
  Wand2,
  Image as ImageIcon,
  Info,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  AlertTriangle,
  Camera,
} from "lucide-react";
import {
  STYLE_CARD_KINDS,
  buildStyleCardSpec,
  type StyleCardKind,
} from "../core/visual/styleCard";
import { recipeOptionsSk } from "../core/style/styleStudioView";
import type { SpeechSegmentLike } from "../core/transcript/wordTiming";
import { librariesItemRowSk, type LibraryViewItem } from "../core/visual/ownVisualView";


/**
 * KROK 27 — VLASTNÝ VIZUÁL (štyri cesty, všetky naozaj).
 *
 * Prečo nie je len jedno tlačidlo „AI vygeneruj obrázok“: overené pokusom —
 * obrázkové modely Gemini sú na tomto kľúči nedostupné (`limit: 0`, free tier).
 * Appka preto ponúka to, čo naozaj funguje, a pri AI **povie pravdu** (aj keď je
 * odpoveď „nedostupné“). Nič nepredstiera a nikdy nepovie „vygenerované“, keď
 * obrázok nevznikol.
 *
 * Cesty:
 *  1) ✨ **Vytvoriť vizuál v štýle videa** — lokálne (ffmpeg), z palety a typografie
 *     receptu; text je tvoj alebo doslovne z prepisu.
 *  2) 🌐 **Voľná knižnica** — Openverse, len licencie, ktoré sa smú použiť komerčne
 *     a upraviť; pri licencii „by“ appka vždy dá text priznania autora.
 *  3) 📁 **Z disku / z telefónu** — tvoj súbor, ide do projektu tou istou cestou
 *     ako bežné nahraté video (importMediaFile → CommandManager).
 *  4) 🤖 **AI obrázok** — reálny pokus o providera; keď nefunguje, appka to napíše
 *     presne (a odkáže na cesty, ktoré fungujú).
 */

export interface OwnVisualMeta {
  sourceSk: string;
  noteSk: string;
  attributionSk?: string;
}

interface OwnVisualPanelProps {
  language?: "sk" | "en";
  segments?: SpeechSegmentLike[];
  /** Ktorý recept štýlu je práve zvolený v Style Studiu (ak je). */
  recipeId?: string;
  showToast?: (msg: string) => void;
  onAddVisual?: (file: File, meta: OwnVisualMeta) => void | Promise<void>;
  /** Priznania autora, ktoré si má človek vložiť do popisu videa. */
  attributions?: string[];
  onAttribution?: (text: string) => void;
  /** Počiatočný stav (pre statický náhľad a testy — nič sa tým nepredstiera). */
  initialSource?: SourceId;
  initialText?: string;
  initialSubText?: string;
}

type SourceId = "generate" | "library" | "file" | "ai";
type TaskState = { state: "idle" | "running" | "ok" | "error"; messageSk?: string };

const SOURCES: { id: SourceId; labelSk: string; hintSk: string }[] = [
  { id: "generate", labelSk: "✨ Vytvoriť v štýle videa", hintSk: "Lokálne, bez internetu — paleta a typografia receptu." },
  { id: "library", labelSk: "🌐 Voľná knižnica", hintSk: "Openverse — len licencie, ktoré môžeš použiť komerčne." },
  { id: "file", labelSk: "📁 Z disku / telefónu", hintSk: "Tvoj obrázok alebo fotka z telefónu." },
  { id: "ai", labelSk: "🤖 AI obrázok", hintSk: "Reálny pokus o providera — appka povie presný výsledok." },
];

function base64ToFile(base64: string, name: string, mime: string): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

export function OwnVisualPanel({
  language = "sk",
  segments = [],
  recipeId = "AI_CARD_DEMO",
  showToast,
  onAddVisual,
  attributions = [],
  onAttribution,
  initialSource = "generate",
  initialText = "",
  initialSubText = "",
}: OwnVisualPanelProps) {
  const isSk = language === "sk";
  const recipeOptions = useMemo(() => recipeOptionsSk(), []);
  const [styleRecipeId, setStyleRecipeId] = useState<string>(recipeId);
  const [source, setSource] = useState<SourceId>(initialSource);

  // 1) Lokálne generovanie
  const [kind, setKind] = useState<StyleCardKind>("statistic");
  const [text, setText] = useState(initialText);
  const [subText, setSubText] = useState(initialSubText);
  const [card, setCard] = useState<{ base64: string; name: string; bytes: number; spec: any } | null>(null);
  const [cardTask, setCardTask] = useState<TaskState>({ state: "idle" });

  // 2) Knižnica
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<LibraryViewItem[]>([]);
  const [libraryNotesSk, setLibraryNotesSk] = useState<string[]>([]);
  const [libraryTask, setLibraryTask] = useState<TaskState>({ state: "idle" });
  const [fetchingId, setFetchingId] = useState<string | null>(null);

  // 4) AI
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiTask, setAiTask] = useState<TaskState>({ state: "idle" });
  const [aiResult, setAiResult] = useState<{ base64: string; mime: string; honestySk?: string } | null>(null);

  const kindInfo = STYLE_CARD_KINDS.find((k) => k.id === kind)!;

  /** Slová a čísla z reálneho prepisu — ponúkame ich ako text vizuálu (nič sa nevymýšľa). */
  const suggestions = useMemo(() => {
    const numbers: string[] = [];
    const strong: string[] = [];
    for (const segment of segments) {
      for (const word of (segment as any).words ?? []) {
        const raw = String(word.word ?? "").trim();
        if (!raw) continue;
        if (/\d/.test(raw) && numbers.length < 8) numbers.push(raw);
        else if (raw.length > 4 && strong.length < 10) strong.push(raw);
      }
      if (numbers.length >= 8 && strong.length >= 10) break;
    }
    return { numbers: [...new Set(numbers)], strong: [...new Set(strong)] };
  }, [segments]);

  /** Náhľad sa robí vopred LOKÁLNE (bez siete), aby appka nič nesľubovala naslepo. */
  const localPreview = useMemo(() => {
    try {
      return buildStyleCardSpec({ recipeId: styleRecipeId, kind, text, subText, width: 1080, height: 1920 });
    } catch (error: any) {
      return { ok: false, errorSk: String(error?.message ?? error) } as any;
    }
  }, [styleRecipeId, kind, text, subText]);

  const createCard = async () => {
    setCardTask({ state: "running", messageSk: isSk ? "Kreslím kartu…" : "Drawing…" });
    try {
      const answer = await fetch("/api/visual/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, recipeId: styleRecipeId, text, subText, width: 1080, height: 1920 }),
      });
      const payload = await answer.json();
      if (!payload?.success) {
        setCard(null);
        setCardTask({ state: "error", messageSk: payload?.errorSk ?? (isSk ? "Kartu sa nepodarilo vytvoriť." : "Card failed.") });
        return;
      }
      setCard({ base64: payload.pngBase64, name: payload.name, bytes: payload.bytes, spec: payload.spec });
      setCardTask({ state: "ok", messageSk: isSk ? `Karta hotová (${payload.width}×${payload.height}, ${payload.bytes} B).` : "Card ready." });
    } catch (error: any) {
      setCard(null);
      setCardTask({ state: "error", messageSk: String(error?.message ?? error) });
    }
  };

  const addCard = async () => {
    if (!card || !onAddVisual) return;
    const file = base64ToFile(card.base64, card.name, "image/png");
    await onAddVisual(file, {
      sourceSk: isSk ? `vytvorený vizuál (${card.spec?.recipeLabelSk ?? styleRecipeId})` : "generated visual",
      noteSk: isSk
        ? `Karta je nakreslená z palety receptu „${card.spec?.recipeLabelSk ?? styleRecipeId}“ — nie je to fotografia ani AI obrázok.`
        : "Card drawn from recipe palette.",
    });
  };

  const searchLibrary = async () => {
    if (query.trim().length < 2) {
      setLibraryTask({ state: "error", messageSk: isSk ? "Napíš, čo hľadáš (aspoň 2 znaky)." : "Type at least 2 characters." });
      return;
    }
    setLibraryTask({ state: "running", messageSk: isSk ? "Hľadám v knižnici…" : "Searching…" });
    setItems([]);
    setLibraryNotesSk([]);
    try {
      const answer = await fetch(`/api/library/search?q=${encodeURIComponent(query.trim())}`);
      const payload = await answer.json();
      if (!payload?.success) {
        setLibraryTask({ state: "error", messageSk: payload?.errorSk ?? (isSk ? "Knižnica neodpovedala." : "Library unavailable.") });
        return;
      }
      setItems((payload.items ?? []).map((raw: any) => ({
        ...raw,
        rowSk: librariesItemRowSk(raw),
        warningSk: raw.attributionRequired ? (isSk ? "Povinné: uveď autora v popise videa." : "Attribution required.") : null,
      })));
      setLibraryNotesSk(payload.notesSk ?? []);
      setLibraryTask({
        state: (payload.items ?? []).length > 0 ? "ok" : "error",
        messageSk:
          (payload.items ?? []).length > 0
            ? isSk
              ? `${payload.items.length} použiteľných z ${payload.totalFromProvider} výsledkov (vyradené pre licenciu: ${payload.rejectedForLicense}).`
              : `${payload.items.length} usable results.`
            : isSk
              ? "Pre tento výraz knižnica nič nepoužiteľné nemá — skús iné slová."
              : "Nothing usable found.",
      });
    } catch (error: any) {
      setLibraryTask({ state: "error", messageSk: String(error?.message ?? error) });
    }
  };

  const addLibraryItem = async (item: LibraryViewItem) => {
    setFetchingId(item.id);
    try {
      const answer = await fetch("/api/library/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const payload = await answer.json();
      if (!payload?.success) {
        showToast?.(`❌ ${payload?.errorSk ?? (isSk ? "Obrázok sa nepodarilo stiahnuť." : "Download failed.")}`);
        return;
      }
      const file = base64ToFile(payload.base64, payload.name, payload.mimeType ?? "image/jpeg");
      await onAddVisual?.(file, {
        sourceSk: isSk ? `voľná knižnica (${item.creator})` : "free library",
        noteSk: isSk ? `Licencia ${item.license.toUpperCase()} ${item.licenseVersion} — ${item.title}.` : "Free library item.",
        attributionSk: payload.item?.attributionSk ?? item.attributionSk,
      });
      if (payload.item?.attributionSk && onAttribution) onAttribution(payload.item.attributionSk);
    } catch (error: any) {
      showToast?.(`❌ ${String(error?.message ?? error)}`);
    } finally {
      setFetchingId(null);
    }
  };

  const addLocalFile = async (file: File | null, fromCamera = false) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast?.(isSk ? "❌ Toto nie je obrázok — vyber obrázok (JPG/PNG/WebP)." : "❌ Not an image.");
      return;
    }
    await onAddVisual?.(file, {
      sourceSk: fromCamera ? (isSk ? "fotka z telefónu" : "phone photo") : isSk ? "súbor z disku" : "local file",
      noteSk: isSk
        ? `Tvoj súbor „${file.name}“ (${(file.size / 1024).toFixed(0)} kB) — do videa ide tak, ako je (appka ho neupravuje).`
        : "Your file, unchanged.",
    });
  };

  const tryAi = async () => {
    setAiTask({ state: "running", messageSk: isSk ? "Skúšam providera…" : "Trying provider…" });
    setAiResult(null);
    try {
      const answer = await fetch("/api/visual/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt.trim() }),
      });
      const payload = await answer.json();
      if (!payload?.success) {
        setAiTask({
          state: "error",
          // Presná odpoveď providera — žiadne „skús neskôr“ bez dôvodu.
          messageSk: payload?.errorSk ?? (isSk ? "AI neodpovedalo." : "AI failed."),
        });
        return;
      }
      setAiResult({ base64: payload.base64, mime: payload.mimeType ?? "image/png", honestySk: payload.honestySk });
      setAiTask({ state: "ok", messageSk: payload.honestySk ?? (isSk ? "AI obrázok hotový." : "AI image ready.") });
    } catch (error: any) {
      setAiTask({ state: "error", messageSk: String(error?.message ?? error) });
    }
  };

  const addAiImage = async () => {
    if (!aiResult || !onAddVisual) return;
    const extension = aiResult.mime.includes("jpeg") ? "jpg" : "png";
    const file = base64ToFile(aiResult.base64, `ai-vizual-${Date.now()}.${extension}`, aiResult.mime);
    await onAddVisual(file, {
      sourceSk: isSk ? "AI obrázok (provider)" : "AI image",
      noteSk: isSk
        ? "Toto je AI-generovaný obrázok z providera — pri publikovaní označ, že ide o AI obsah."
        : "AI-generated image — label it when publishing.",
    });
  };

  const TaskLine = ({ task }: { task: TaskState }) => {
    if (task.state === "idle") return null;
    const tone =
      task.state === "ok" ? "text-emerald-300" : task.state === "error" ? "text-rose-300" : "text-neutral-300";
    return (
      <div className={`flex items-start gap-2 text-[11px] ${tone}`}>
        {task.state === "running" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin mt-0.5 shrink-0" />
        ) : task.state === "ok" ? (
          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        ) : (
          <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        )}
        <span className="leading-relaxed">{task.messageSk}</span>
      </div>
    );
  };

  const buttonClass =
    "px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-white text-[11px] font-bold flex items-center gap-1.5";

  return (
    <div className="space-y-3" data-testid="own-visual-panel">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-rose-400" />
          <h3 className="text-xs font-black text-white uppercase tracking-wide">
            {isSk ? "Vlastný vizuál — štyri cesty" : "Own visual — four routes"}
          </h3>
        </div>
        <p className="text-[11px] text-neutral-400 leading-relaxed">
          {isSk
            ? "Appka vizuály negeneruje sama od seba — vie ich načasovať. Tu si ich vytvoríš alebo prinesieš: vygenerovaný v štýle videa, z voľnej knižnice, z disku/telefónu, alebo AI obrázkom (ak provider naozaj funguje)."
            : "Create or import visuals: generated in your style, free library, local file, or AI image when the provider works."}
        </p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              data-testid={`visual-source-${s.id}`}
              onClick={() => setSource(s.id)}
              className={`text-left p-2.5 rounded-xl border transition-all ${
                source === s.id ? "border-rose-500/60 bg-rose-500/10" : "border-neutral-800 bg-neutral-900/60 hover:border-neutral-700"
              }`}
            >
              <span className="text-[11px] font-black text-white">{s.labelSk}</span>
              <p className="text-[10px] text-neutral-400 mt-1 leading-snug">{s.hintSk}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ---------- 1) Lokálne generovanie ---------- */}
      {source === "generate" && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-3">
          <h4 className="text-[11px] font-black text-white uppercase tracking-wide">
            {isSk ? "Vytvoriť vizuál v štýle videa" : "Create visual in your style"}
          </h4>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-[10px] font-bold text-neutral-400 uppercase">
              {isSk ? "V štýle receptu" : "Style recipe"}
              <select
                data-testid="visual-recipe"
                value={styleRecipeId}
                onChange={(e) => setStyleRecipeId(e.target.value)}
                className="mt-1 w-full rounded-xl bg-neutral-950 border border-neutral-800 p-2 text-[11px] text-neutral-200"
              >
                {recipeOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.labelSk}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-bold text-neutral-400 uppercase">
              {isSk ? "Druh vizuálu" : "Kind"}
              <select
                data-testid="visual-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as StyleCardKind)}
                className="mt-1 w-full rounded-xl bg-neutral-950 border border-neutral-800 p-2 text-[11px] text-neutral-200"
              >
                {STYLE_CARD_KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.labelSk}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-[10px] text-neutral-500">{kindInfo.hintSk}</p>

          {kindInfo.needsText && (
            <div className="space-y-2">
              <input
                data-testid="visual-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={kind === "statistic" ? (isSk ? "napr. 70%" : "e.g. 70%") : isSk ? "napr. Za päť minút" : "e.g. In five minutes"}
                className="w-full rounded-xl bg-neutral-950 border border-neutral-800 p-2 text-[11px] text-neutral-200"
              />
              <input
                data-testid="visual-subtext"
                value={subText}
                onChange={(e) => setSubText(e.target.value)}
                placeholder={isSk ? "podtitulok (nepovinné) — napr. kratší strih" : "subtext (optional)"}
                className="w-full rounded-xl bg-neutral-950 border border-neutral-800 p-2 text-[11px] text-neutral-200"
              />
              {(suggestions.numbers.length > 0 || suggestions.strong.length > 0) && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase text-neutral-500">
                    {isSk ? "Vezmi z videa (doslovne, nič sa nedomýšľa)" : "Pick from video"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.numbers.map((word) => (
                      <button
                        key={`n-${word}`}
                        onClick={() => setText(word)}
                        className="px-2 py-0.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-[10px] text-neutral-200 font-mono"
                      >
                        {word}
                      </button>
                    ))}
                    {suggestions.strong.slice(0, 6).map((word) => (
                      <button
                        key={`s-${word}`}
                        onClick={() => setText(word)}
                        className="px-2 py-0.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-[10px] text-neutral-200"
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!localPreview.ok && (
            <div className="flex items-start gap-2 text-[11px] text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{localPreview.errorSk}</span>
            </div>
          )}
          {localPreview.ok && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-2.5 space-y-1">
              <p className="text-[10px] text-neutral-400">
                {isSk ? "Farby z receptu" : "Recipe colors"}:{" "}
                {[localPreview.palette.background, localPreview.palette.text, localPreview.palette.accent].map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 mr-2">
                    <span className="inline-block w-3 h-3 rounded border border-neutral-700" style={{ backgroundColor: c }} />
                    <span className="font-mono">{c}</span>
                  </span>
                ))}
              </p>
              <p className="text-[10px] text-neutral-500">
                {isSk ? "Typografia" : "Typography"}: {localPreview.fontName}
                {localPreview.uppercase ? (isSk ? " (VEĽKÉ PÍSMENÁ podľa receptu)" : " (uppercase)") : ""} ·{" "}
                {isSk ? "vzor" : "pattern"}: {localPreview.pattern.reasonSk}
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <button
              data-testid="visual-create-card"
              onClick={createCard}
              disabled={cardTask.state === "running" || !localPreview.ok}
              className={buttonClass}
            >
              <Wand2 className="w-3.5 h-3.5" />
              {isSk ? "Vytvoriť náhľad" : "Create preview"}
            </button>
            {card && (
              <button data-testid="visual-add-card" onClick={addCard} className={buttonClass}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isSk ? "Pridať do videa" : "Add to video"}
              </button>
            )}
          </div>
          <TaskLine task={cardTask} />

          {card && (
            <div className="space-y-2">
              <img
                data-testid="visual-card-preview"
                src={`data:image/png;base64,${card.base64}`}
                alt={isSk ? "Náhľad vizuálu" : "Visual preview"}
                className="w-full max-w-[220px] rounded-xl border border-neutral-800"
              />
              {card.spec?.notesSk?.map((note: string) => (
                <p key={note} className="text-[10px] text-neutral-500">
                  – {note}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------- 2) Voľná knižnica ---------- */}
      {source === "library" && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-3">
          <h4 className="text-[11px] font-black text-white uppercase tracking-wide">
            {isSk ? "Voľná knižnica (licencie, ktoré môžeš použiť)" : "Free library"}
          </h4>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            {isSk
              ? "Hľadám v Openverse (openverse.org). Ponúkam len licencie, ktoré dovoľujú komerčné použitie a úpravy (CC0, PDM, BY, BY-SA). Nekomerčné (NC) a bez odvodenín (ND) vyraďujem — do videa sa nesmú."
              : "Searching Openverse. Only commercially usable and modifiable licenses."}
          </p>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2.5" />
              <input
                data-testid="visual-library-query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isSk ? "napr. desk laptop office" : "e.g. desk laptop office"}
                className="w-full rounded-xl bg-neutral-950 border border-neutral-800 p-2 pl-8 text-[11px] text-neutral-200"
              />
            </div>
            <button data-testid="visual-library-search" onClick={searchLibrary} disabled={libraryTask.state === "running"} className={buttonClass}>
              {isSk ? "Hľadať" : "Search"}
            </button>
          </div>
          <TaskLine task={libraryTask} />
          {libraryNotesSk.map((note) => (
            <p key={note} className="text-[10px] text-amber-300/80">
              {note}
            </p>
          ))}

          {items.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {items.map((item) => (
                <div key={item.id} className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-2 space-y-1.5">
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt={item.title} className="w-full h-24 object-cover rounded-lg border border-neutral-800" />
                  ) : null}
                  <p className="text-[10px] font-bold text-neutral-200 line-clamp-2">{item.title}</p>
                  <p className="text-[10px] text-neutral-400">{item.rowSk ?? librariesItemRowSk(item)}</p>
                  {item.warningSk && <p className="text-[10px] text-amber-300/90">{item.warningSk}</p>}
                  <button
                    data-testid={`visual-library-add-${item.id}`}
                    onClick={() => addLibraryItem(item)}
                    disabled={fetchingId === item.id}
                    className={buttonClass}
                  >
                    {fetchingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {isSk ? "Pridať do videa" : "Add to video"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------- 3) Súbor z disku / telefónu ---------- */}
      {source === "file" && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-3">
          <h4 className="text-[11px] font-black text-white uppercase tracking-wide">
            {isSk ? "Z disku alebo z telefónu" : "From disk or phone"}
          </h4>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            {isSk
              ? "Vyber obrázok zo svojho počítača alebo z telefónu. Do videa ide tak, ako je — appka ho neupravuje ani nekomprimuje bez tvojho vedomia."
              : "Pick an image from your computer or phone."}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <label className={`${buttonClass} cursor-pointer`}>
              <Upload className="w-3.5 h-3.5" />
              {isSk ? "Vybrať súbor" : "Choose file"}
              <input
                data-testid="visual-file-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void addLocalFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <label className={`${buttonClass} cursor-pointer`}>
              <Camera className="w-3.5 h-3.5" />
              {isSk ? "Odfotiť (telefón)" : "Take photo"}
              <input
                data-testid="visual-camera-input"
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => void addLocalFile(e.target.files?.[0] ?? null, true)}
              />
            </label>
          </div>
        </div>
      )}

      {/* ---------- 4) AI ---------- */}
      {source === "ai" && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-3">
          <h4 className="text-[11px] font-black text-white uppercase tracking-wide">
            {isSk ? "AI obrázok (len ak provider naozaj funguje)" : "AI image (only if provider works)"}
          </h4>
          <div className="flex items-start gap-2 text-[11px] text-amber-300/90">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              {isSk
                ? "Appka ti nikdy nepovie „vygenerované“, keď obrázok nevznikol. Skús to — a keď provider nemôže (napr. obrázkové modely Gemini majú na kľúči limit 0), napíšem ti presnú odpoveď a odkážem na cesty, ktoré fungujú."
                : "The app always reports the provider's real answer."}
            </span>
          </div>
          <textarea
            data-testid="visual-ai-prompt"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            rows={2}
            placeholder={isSk ? "napr. kancelársky stôl s laptopom, editorial koláž, halftone, bez textu" : "e.g. desk with laptop, editorial collage, no text"}
            className="w-full rounded-xl bg-neutral-950 border border-neutral-800 p-2 text-[11px] text-neutral-200"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <button data-testid="visual-ai-run" onClick={tryAi} disabled={aiTask.state === "running" || aiPrompt.trim().length < 3} className={buttonClass}>
              <Sparkles className="w-3.5 h-3.5" />
              {isSk ? "Skúsiť AI obrázok" : "Try AI image"}
            </button>
            {aiResult && (
              <button data-testid="visual-ai-add" onClick={addAiImage} className={buttonClass}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isSk ? "Pridať do videa" : "Add to video"}
              </button>
            )}
          </div>
          <TaskLine task={aiTask} />
          {aiResult && (
            <img
              src={`data:${aiResult.mime};base64,${aiResult.base64}`}
              alt={isSk ? "AI vizuál" : "AI visual"}
              className="w-full max-w-[220px] rounded-xl border border-neutral-800"
            />
          )}
        </div>
      )}

      {/* ---------- Priznania (pri licenciách „by“) ---------- */}
      {attributions.length > 0 && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-2">
          <h4 className="text-[11px] font-black text-white uppercase tracking-wide">
            {isSk ? "Priznania autora (daj ich do popisu videa)" : "Attributions"}
          </h4>
          {attributions.map((line) => (
            <div key={line} className="flex items-start gap-2">
              <p className="flex-1 text-[10px] text-neutral-300 font-mono leading-relaxed">{line}</p>
              <button
                onClick={() => {
                  void navigator.clipboard?.writeText(line);
                  showToast?.(isSk ? "📋 Priznanie skopírované." : "📋 Copied.");
                }}
                className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white"
                title={isSk ? "Kopírovať" : "Copy"}
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Clock, Loader2, Palette, Save, Trash2, Wand2 } from "lucide-react";
import {
  CAPTION_ANIMATION_MS,
  CAPTION_STYLES,
  assColorToHex,
  type CaptionAnimation,
  type CaptionOverrides,
  type CaptionStyleId,
} from "../core/export/subtitleRender";
import type { ProfileTemplate } from "../core/export/captionProfiles";
import { CaptionStylePreview } from "./CaptionStylePreview";
import type { SpeechSegmentLike } from "../core/transcript/wordTiming";

/**
 * VLASTNÝ ŠTÝL KLIENTA (brand kit) — UI krok B++.
 *
 * Typická práca je mix klientov: každý má iné farby a písmo. Cieľom je, aby sa
 * štýl zakázky nastavil **na jeden klik** a nemusel sa zakaždým skladať znovu.
 *
 * Ako to funguje (a prečo tak):
 *  - profil = základný hotový štýl + odchýlky (farba, veľkosť, animácia…),
 *  - **uložený je na serveri** — prežije nové nahranie videa aj iné zariadenie,
 *  - náhľad používa tie isté dáta ako render, takže vidíš, čo sa vypáli
 *    (rozdiel je len v kreslení písma prehliadačom — a to appka povie),
 *  - `#RRGGBB` z brand manuálu sa prekladá do ASS `&HAABBGGRR` (BGR poradie!).
 *
 * Nikdy nič nemení ticho: ore zania a vynechané hodnoty sa zobrazia ako veta.
 */

interface CaptionProfileBarProps {
  styleId: CaptionStyleId;
  overrides: CaptionOverrides;
  /** Aplikuj profil/šablónu (prevezme aj základný štýl). */
  onApply: (styleId: CaptionStyleId, overrides: CaptionOverrides, name: string) => void;
  /** Zmeň len odchýlky (napr. pri ručnom dolaďovaní farby). */
  onOverridesChange: (overrides: CaptionOverrides) => void;
  segments?: SpeechSegmentLike[];
  width?: number;
  height?: number;
  disabled?: boolean;
}

interface SavedProfile {
  id: string;
  name: string;
  styleId: CaptionStyleId;
  overrides: CaptionOverrides;
  noteSk?: string;
}

const ANIM_LABEL_SK: Record<CaptionAnimation, string> = {
  none: "bez animácie",
  pop: "pop (vyrastie)",
  punch: "punch (priletí)",
  fade: "fade (jemné objavenie)",
};

const ALIGN_LABEL_SK: Record<string, string> = {
  "2": "dole",
  "5": "v strede",
  "8": "hore",
};

/** Farebné pole: prehliadač + ručný zápis `#RRGGBB` (pre brand manuály). */
const ColorField: React.FC<{
  labelSk: string;
  value?: string;
  onChange: (hex: string | undefined) => void;
  disabled?: boolean;
}> = ({ labelSk, value, onChange, disabled }) => {
  const shown = value ?? "#FFFFFF";
  return (
    <label className="flex items-center gap-2 text-[9px] text-neutral-400">
      <input
        type="color"
        value={shown}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-6 w-8 rounded border border-neutral-700 bg-neutral-900 cursor-pointer disabled:opacity-50"
      />
      <span className="min-w-0">
        {labelSk}
        <input
          type="text"
          value={value ?? ""}
          placeholder="—"
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value.trim();
            onChange(v === "" ? undefined : v.toUpperCase());
          }}
          className="ml-1 w-20 px-1 py-0.5 rounded bg-neutral-900 border border-neutral-700 font-mono text-[9px] text-neutral-200"
        />
      </span>
    </label>
  );
};

/** Číselné pole s viditeľným rozsahom — aby sa nedalo „trafiť“ hodnotu mimo. */
const NumberField: React.FC<{
  labelSk: string;
  value: number | undefined;
  min: number;
  max: number;
  step?: number;
  hintSk?: string;
  onChange: (v: number | undefined) => void;
  disabled?: boolean;
}> = ({ labelSk, value, min, max, step = 1, hintSk, onChange, disabled }) => (
  <label className="text-[9px] text-neutral-400">
    <span className="block">
      {labelSk} <span className="text-neutral-600">{value ?? "—"}</span>
      {hintSk && <span className="text-neutral-600"> · {hintSk}</span>}
    </span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value ?? min}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-orange-500"
    />
  </label>
);

export const CaptionProfileBar: React.FC<CaptionProfileBarProps> = ({
  styleId,
  overrides,
  onApply,
  onOverridesChange,
  segments,
  width = 1080,
  height = 1920,
  disabled = false,
}) => {
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [templates, setTemplates] = useState<ProfileTemplate[]>([]);
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [activeName, setActiveName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorSk, setErrorSk] = useState<string | null>(null);
  const [notesSk, setNotesSk] = useState<string[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/captions/profiles");
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.errorSk || "Profily sa nepodarilo načítať.");
      setProfiles(Array.isArray(d.profiles) ? d.profiles : []);
      setTemplates(Array.isArray(d.templates) ? d.templates : []);
      setDescriptions(d.descriptionSk ?? {});
      setErrorSk(null);
    } catch (err: any) {
      setErrorSk(err?.message || "Profily sa nepodarilo načítať zo servera.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const baseStyle = useMemo(() => CAPTION_STYLES.find((s) => s.id === styleId) ?? CAPTION_STYLES[0], [styleId]);
  const overrideCount = Object.values(overrides).filter((v) => v !== undefined && v !== "").length;

  const save = async () => {
    setBusy(true);
    setErrorSk(null);
    setNotesSk([]);
    try {
      const r = await fetch("/api/captions/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, noteSk: note, styleId, overrides }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.errorSk || "Profil sa nepodarilo uložiť.");
      setNotesSk(Array.isArray(d.notesSk) ? d.notesSk : []);
      setActiveName(d.profile?.name ?? name);
      setName("");
      setNote("");
      await load();
    } catch (err: any) {
      setErrorSk(err?.message || "Profil sa nepodarilo uložiť.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    setErrorSk(null);
    try {
      const r = await fetch(`/api/captions/profiles/${encodeURIComponent(id)}`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.errorSk || "Profil sa nepodarilo zmazať.");
      if (activeName && profiles.find((p) => p.id === id)?.name === activeName) setActiveName(null);
      await load();
    } catch (err: any) {
      setErrorSk(err?.message || "Profil sa nepodarilo zmazať.");
    } finally {
      setBusy(false);
    }
  };

  const set = <K extends keyof CaptionOverrides>(key: K, value: CaptionOverrides[K]) => {
    const next: CaptionOverrides = { ...overrides };
    if (value === undefined || value === "") delete next[key];
    else next[key] = value;
    onOverridesChange(next);
  };

  return (
    <div className="p-3 rounded-xl bg-fuchsia-500/5 border border-fuchsia-500/25 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Palette className="h-3.5 w-3.5 text-fuchsia-300 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-black text-fuchsia-200 uppercase tracking-wider">
              Vlastný štýl klienta (brand kit)
            </p>
            <p className="text-[9px] text-neutral-400 mt-0.5 leading-snug">
              Ulož si farby a vzhľad pre klienta — nabudúce je to jeden klik. Základ:{" "}
              <span className="text-neutral-300 font-bold">{baseStyle.labelSk}</span>
              {overrideCount > 0 && (
                <span className="text-fuchsia-300">
                  {" "}
                  · vlastné zmeny: {overrideCount}
                </span>
              )}
              {activeName && <span className="text-emerald-300"> · aktívny profil: {activeName}</span>}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowEditor((v) => !v)}
          disabled={disabled}
          className="text-[9px] text-fuchsia-300/90 hover:text-fuchsia-200 underline shrink-0"
        >
          {showEditor ? "skryť doladenie" : "doladiť farby a veľkosť"}
        </button>
      </div>

      {errorSk && (
        <p className="text-[9px] text-red-300 flex items-start gap-1.5">
          <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" /> {errorSk}
        </p>
      )}
      {notesSk.length > 0 && (
        <div className="space-y-0.5">
          {notesSk.map((n, i) => (
            <p key={i} className="text-[9px] text-amber-200/90 leading-snug">
              • {n}
            </p>
          ))}
        </div>
      )}

      {/* Doladenie: farby, veľkosť, množstvo textu, animácia */}
      {showEditor && (
        <div className="space-y-2 pt-2 border-t border-fuchsia-500/20">
          <div className="grid grid-cols-2 gap-2">
            <ColorField labelSk="Text" value={overrides.primaryHex} onChange={(v) => set("primaryHex", v)} disabled={disabled} />
            <ColorField
              labelSk="Zvýraznenie"
              value={overrides.highlightHex}
              onChange={(v) => set("highlightHex", v)}
              disabled={disabled}
            />
            <ColorField labelSk="Obrys" value={overrides.outlineHex} onChange={(v) => set("outlineHex", v)} disabled={disabled} />
            <ColorField labelSk="Podklad" value={overrides.boxHex} onChange={(v) => set("boxHex", v)} disabled={disabled} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              labelSk="Veľkosť písma"
              hintSk="‰ výšky videa"
              value={overrides.fontSizeRatio}
              min={30}
              max={130}
              onChange={(v) => set("fontSizeRatio", v)}
              disabled={disabled}
            />
            <NumberField
              labelSk="Slová na obrazovke"
              hintSk="0 = celá veta"
              value={overrides.wordsPerChunk}
              min={0}
              max={6}
              onChange={(v) => set("wordsPerChunk", v)}
              disabled={disabled}
            />
            <NumberField
              labelSk="Odstup od spodku"
              hintSk="podiel výšky"
              value={overrides.bottomMarginRatio}
              min={0.04}
              max={0.35}
              step={0.01}
              onChange={(v) => set("bottomMarginRatio", v)}
              disabled={disabled}
            />
            <NumberField
              labelSk="Zväčšenie aktívneho slova"
              hintSk="‰"
              value={overrides.activeWordScale}
              min={100}
              max={160}
              onChange={(v) => set("activeWordScale", v)}
              disabled={disabled}
            />
          </div>

          <div className="flex flex-wrap gap-3 items-center text-[9px] text-neutral-400">
            <label className="flex items-center gap-1.5">
              <span>Animácia vstupu</span>
              <select
                value={overrides.animation ?? ""}
                disabled={disabled}
                onChange={(e) => set("animation", (e.target.value || undefined) as CaptionAnimation | undefined)}
                className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-[9px] text-neutral-200"
              >
                <option value="">podľa štýlu ({baseStyle.animation ?? "none"})</option>
                {(Object.keys(ANIM_LABEL_SK) as CaptionAnimation[]).map((a) => (
                  <option key={a} value={a}>
                    {ANIM_LABEL_SK[a]} · {CAPTION_ANIMATION_MS[a]} ms
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              <span>Umiestnenie</span>
              <select
                value={overrides.alignment ?? ""}
                disabled={disabled}
                onChange={(e) => set("alignment", (e.target.value === "" ? undefined : Number(e.target.value)) as 2 | 5 | 8 | undefined)}
                className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-[9px] text-neutral-200"
              >
                <option value="">podľa štýlu</option>
                {Object.entries(ALIGN_LABEL_SK).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={Boolean(overrides.boxed ?? baseStyle.boxed)}
                disabled={disabled}
                onChange={(e) => set("boxed", e.target.checked)}
                className="accent-fuchsia-500"
              />
              <span>Text na placce</span>
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={Boolean(overrides.uppercase ?? baseStyle.uppercase)}
                disabled={disabled}
                onChange={(e) => set("uppercase", e.target.checked)}
                className="accent-fuchsia-500"
              />
              <span>VEĽKÉ PÍSMENÁ</span>
            </label>
            {overrideCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  onOverridesChange({});
                  setActiveName(null);
                }}
                disabled={disabled}
                className="ml-auto text-[9px] text-neutral-400 hover:text-neutral-200 underline"
              >
                zrušiť moje zmeny
              </button>
            )}
          </div>

          {/* Uložiť ako profil */}
          <div className="flex flex-wrap items-end gap-2 pt-1">
            <label className="text-[9px] text-neutral-400">
              <span className="block mb-0.5">Názov profilu (klient / projekt)</span>
              <input
                type="text"
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
                placeholder="napr. Klient A – beauty"
                className="w-48 px-2 py-1 rounded bg-neutral-900 border border-neutral-700 text-[10px] text-neutral-200"
              />
            </label>
            <label className="text-[9px] text-neutral-400">
              <span className="block mb-0.5">Poznámka (nepovinná)</span>
              <input
                type="text"
                value={note}
                maxLength={200}
                onChange={(e) => setNote(e.target.value)}
                placeholder="brand manuál: modrá #0A3D91"
                className="w-56 px-2 py-1 rounded bg-neutral-900 border border-neutral-700 text-[10px] text-neutral-200"
              />
            </label>
            <button
              type="button"
              onClick={save}
              disabled={busy || !name.trim()}
              className="px-2.5 py-1.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 text-white text-[9px] font-bold uppercase tracking-wider flex items-center gap-1"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Uložiť profil
            </button>
          </div>
        </div>
      )}

      {/* Uložené profily */}
      {profiles.length > 0 && (
        <div>
          <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider mb-1">Uložené profily</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {profiles.map((p) => {
              const active = activeName === p.name;
              return (
                <div
                  key={p.id}
                  className={`flex gap-2 p-2 rounded-xl border ${active ? "border-emerald-500/50 bg-emerald-500/5" : "border-neutral-800"}`}
                >
                  <CaptionStylePreview
                    styleId={p.styleId}
                    overrides={p.overrides}
                    segments={segments}
                    width={width}
                    height={height}
                    previewHeight={78}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-white truncate">{p.name}</p>
                    <p className="text-[8px] text-neutral-500 leading-snug line-clamp-3">
                      {descriptions[p.id] ?? p.noteSk ?? ""}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          onApply(p.styleId, p.overrides, p.name);
                          setActiveName(p.name);
                        }}
                        disabled={disabled}
                        className="px-1.5 py-0.5 rounded bg-fuchsia-600/80 hover:bg-fuchsia-500 text-white text-[8px] font-bold uppercase tracking-wider flex items-center gap-1"
                      >
                        {active ? <Check className="h-2.5 w-2.5" /> : null} Použiť
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(p.id)}
                        disabled={busy || disabled}
                        title="Zmazať profil"
                        className="text-[8px] text-neutral-500 hover:text-red-300 flex items-center gap-0.5"
                      >
                        <Trash2 className="h-2.5 w-2.5" /> zmazať
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Štartovacie šablóny — aby sa dalo začať aj bez klikania farieb */}
      {templates.length > 0 && (
        <div>
          <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Wand2 className="h-2.5 w-2.5" /> Hotové štarty (uprav a ulož ako svoj)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {templates.map((t) => (
              <div key={t.key} className="p-2 rounded-xl border border-neutral-800 flex gap-2">
                <CaptionStylePreview
                  styleId={t.styleId}
                  overrides={t.overrides}
                  segments={segments}
                  width={width}
                  height={height}
                  previewHeight={78}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-white">{t.name}</p>
                  <p className="text-[8px] text-neutral-500 leading-snug">{t.descriptionSk}</p>
                  <button
                    type="button"
                    onClick={() => {
                      onApply(t.styleId, t.overrides, t.name);
                      setName(t.name);
                      setNote(t.descriptionSk);
                      setActiveName(t.name);
                    }}
                    disabled={disabled}
                    className="mt-1 px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[8px] font-bold uppercase tracking-wider"
                  >
                    Vziať ako základ
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[8px] text-neutral-600 leading-snug flex items-start gap-1">
        <Clock className="h-2.5 w-2.5 shrink-0 mt-0.5" />
        Náhľady kreslí prehliadač (nie libass) — farby a rozloženie sedia, písmo môže vyzerať o vlások inak. Presne
        to, čo sa vypáli, sa ukáže po vyrenderovaní.
      </p>
    </div>
  );
};

export default CaptionProfileBar;

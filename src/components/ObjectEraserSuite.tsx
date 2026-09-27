import React from "react";
import {
  Eraser,
  Brush,
  Square,
  Sparkles,
  ShieldCheck,
  Trash2,
  Eye,
  EyeOff,
  Sliders,
  Plus,
  Zap,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import { EraserZone, EraserZoneType, VideoProjectSettings } from "../types";

interface ObjectEraserSuiteProps {
  settings: VideoProjectSettings;
  onChangeSettings: (settings: Partial<VideoProjectSettings>) => void;
  language: "sk" | "en";
}

export const ObjectEraserSuite: React.FC<ObjectEraserSuiteProps> = ({
  settings,
  onChangeSettings,
  language,
}) => {
  const isSk = language === "sk";
  const zones = settings.eraserZones || [];

  const handleToggleZone = (id: string) => {
    const updated = zones.map((z) =>
      z.id === id ? { ...z, enabled: !z.enabled } : z
    );
    onChangeSettings({ eraserZones: updated });
  };

  const handleDeleteZone = (id: string) => {
    const updated = zones.filter((z) => z.id !== id);
    onChangeSettings({ eraserZones: updated });
  };

  const handleClearAll = () => {
    onChangeSettings({ eraserZones: [] });
  };

  const handleAddPreset = (type: EraserZoneType, presetName: string, coords: { x: number; y: number; w: number; h: number }) => {
    const newZone: EraserZone = {
      id: `zone-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: presetName,
      type,
      x: coords.x,
      y: coords.y,
      width: coords.w,
      height: coords.h,
      enabled: true,
      feather: 3,
    };
    onChangeSettings({
      eraserEnabled: true,
      eraserZones: [...zones, newZone],
    });
  };

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4 sm:p-5 shadow-xl backdrop-blur-md">
      {/* Header & Master Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 p-2.5 text-neutral-950 shadow-md">
            <Eraser className="h-5 w-5 font-black" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>
                {isSk
                  ? "Vymazanie Vodoznaku, Titulkov a Objektu"
                  : "Watermark, Subtitles & Object Eraser"}
              </span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                {isSk ? "Bez rozmazania" : "Zero Blur AI"}
              </span>
            </h3>
            <p className="text-xs text-neutral-400">
              {isSk
                ? "Content-Aware inpainting so zachovaním ostrosti a filmového zrna bez straty kvality"
                : "Content-Aware inpainting preserving texture, sharpness, and high quality"}
            </p>
          </div>
        </div>

        {/* Master Toggle */}
        <label className="flex items-center gap-2.5 cursor-pointer bg-neutral-950/80 px-3.5 py-1.5 rounded-xl border border-neutral-800 hover:border-neutral-700 transition-all">
          <span className="text-xs font-bold text-neutral-300">
            {settings.eraserEnabled
              ? isSk ? "Aktívne" : "Active"
              : isSk ? "Vypnuté" : "Disabled"}
          </span>
          <input
            type="checkbox"
            checked={settings.eraserEnabled}
            onChange={(e) => onChangeSettings({ eraserEnabled: e.target.checked })}
            className="h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-rose-500 accent-rose-500 cursor-pointer"
          />
        </label>
      </div>

      {/* Quality Badge Guarantee */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3 flex items-start gap-2.5">
        <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-200/90 leading-relaxed">
          <span className="font-bold text-emerald-300">
            {isSk ? "100% Bez rozmazania a straty ostrosti: " : "100% Blur-Free Guarantee: "}
          </span>
          {isSk
            ? "Obyčajné editory vodoznak iba škaredo rozmažú. Náš algoritmus rekonštruuje textúru pozadia a syntetizuje mikrozrnitosť videa, takže miesto ostáva ostré a čisté."
            : "Generic apps just apply an ugly blur. Our algorithm reconstructs background textures and synthesizes micro-grain so the area remains crisp and clean."}
        </div>
      </div>

      {/* Direct Video Canvas Drawing Tools */}
      <div className="flex flex-col gap-2.5 rounded-xl border border-neutral-800 bg-neutral-950/70 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
            <Brush className="h-4 w-4 text-rose-400" />
            <span>
              {isSk
                ? "Nástroj presného označenia priamo na videu:"
                : "Precision Marking Tool on Video:"}
            </span>
          </span>
          <span className="text-[10px] text-neutral-400">
            {isSk ? "Kliknite a kreslite priamo na video" : "Click and draw on video canvas"}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() =>
              onChangeSettings({
                eraserEnabled: true,
                eraserActiveTool:
                  settings.eraserActiveTool === "brush" ? "none" : "brush",
              })
            }
            className={`flex items-center justify-center gap-2 rounded-xl p-2.5 text-xs font-bold transition-all border ${
              settings.eraserActiveTool === "brush"
                ? "border-rose-500 bg-rose-500/20 text-white shadow-md ring-1 ring-rose-500/40"
                : "border-neutral-800 bg-neutral-900/60 text-neutral-300 hover:text-white hover:border-neutral-700"
            }`}
          >
            <Brush className="h-4 w-4 text-rose-400" />
            <span>{isSk ? "🖌️ Štetec na objekt" : "🖌️ Object Brush"}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onChangeSettings({
                eraserEnabled: true,
                eraserActiveTool:
                  settings.eraserActiveTool === "box" ? "none" : "box",
              })
            }
            className={`flex items-center justify-center gap-2 rounded-xl p-2.5 text-xs font-bold transition-all border ${
              settings.eraserActiveTool === "box"
                ? "border-amber-500 bg-amber-500/20 text-white shadow-md ring-1 ring-amber-500/40"
                : "border-neutral-800 bg-neutral-900/60 text-neutral-300 hover:text-white hover:border-neutral-700"
            }`}
          >
            <Square className="h-4 w-4 text-amber-400" />
            <span>{isSk ? "🔲 Obdĺžnikový výber" : "🔲 Box Selector"}</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeSettings({ eraserActiveTool: "none" })}
            className={`col-span-2 sm:col-span-1 flex items-center justify-center gap-2 rounded-xl p-2.5 text-xs font-bold transition-all border ${
              settings.eraserActiveTool === "none"
                ? "border-neutral-700 bg-neutral-800 text-white"
                : "border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:text-white"
            }`}
          >
            <span>{isSk ? "👁️ Iba náhľad" : "👁️ Preview Only"}</span>
          </button>
        </div>

        {/* Brush Size slider if brush active */}
        {settings.eraserActiveTool === "brush" && (
          <div className="mt-2 pt-2 border-t border-neutral-800/80 flex items-center justify-between gap-3 text-xs">
            <span className="text-neutral-400 font-medium">
              {isSk ? "Veľkosť štetca:" : "Brush Radius:"}
            </span>
            <div className="flex items-center gap-2 flex-1 max-w-[200px]">
              <span className="text-[10px] text-neutral-500">10px</span>
              <input
                type="range"
                min="10"
                max="60"
                step="2"
                value={settings.eraserBrushRadius || 24}
                onChange={(e) =>
                  onChangeSettings({ eraserBrushRadius: parseInt(e.target.value, 10) })
                }
                className="w-full accent-rose-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
              />
              <span className="text-[10px] text-neutral-300 font-mono font-bold">
                {settings.eraserBrushRadius || 24}px
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 1-Click Fast Presets */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold text-neutral-300">
          {isSk ? "⚡ 1-Klikové Rýchle Predvoľby:" : "⚡ 1-Click Fast Presets:"}
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() =>
              handleAddPreset("watermark", isSk ? "TikTok Vodoznak (Vpravo dole)" : "TikTok Watermark (BR)", {
                x: 0.72,
                y: 0.88,
                w: 0.25,
                h: 0.08,
              })
            }
            className="flex items-center gap-1.5 p-2 rounded-xl border border-neutral-800 bg-neutral-950 hover:border-neutral-700 text-xs font-semibold text-neutral-200 transition-all text-left"
          >
            <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
            <span className="truncate">{isSk ? "TikTok Vpravo dole" : "TikTok Bottom-Right"}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              handleAddPreset("watermark", isSk ? "TikTok Vodoznak (Vľavo hore)" : "TikTok Watermark (TL)", {
                x: 0.04,
                y: 0.04,
                w: 0.24,
                h: 0.08,
              })
            }
            className="flex items-center gap-1.5 p-2 rounded-xl border border-neutral-800 bg-neutral-950 hover:border-neutral-700 text-xs font-semibold text-neutral-200 transition-all text-left"
          >
            <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
            <span className="truncate">{isSk ? "TikTok Vľavo hore" : "TikTok Top-Left"}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              handleAddPreset("subtitles", isSk ? "Spodné spálené titulky" : "Burned-in Subtitle Strip", {
                x: 0.1,
                y: 0.78,
                w: 0.8,
                h: 0.12,
              })
            }
            className="flex items-center gap-1.5 p-2 rounded-xl border border-neutral-800 bg-neutral-950 hover:border-neutral-700 text-xs font-semibold text-neutral-200 transition-all text-left"
          >
            <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
            <span className="truncate">{isSk ? "Spodné spálené titulky" : "Burned Subtitles"}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              handleAddPreset("watermark", isSk ? "Logo / Pečiatka v strede" : "Center Logo", {
                x: 0.35,
                y: 0.45,
                w: 0.3,
                h: 0.1,
              })
            }
            className="flex items-center gap-1.5 p-2 rounded-xl border border-neutral-800 bg-neutral-950 hover:border-neutral-700 text-xs font-semibold text-neutral-200 transition-all text-left"
          >
            <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
            <span className="truncate">{isSk ? "Logo v strede" : "Center Logo"}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              handleAddPreset("object", isSk ? "Objekt v pozadí" : "Background Object", {
                x: 0.05,
                y: 0.4,
                w: 0.22,
                h: 0.25,
              })
            }
            className="flex items-center gap-1.5 p-2 rounded-xl border border-neutral-800 bg-neutral-950 hover:border-neutral-700 text-xs font-semibold text-neutral-200 transition-all text-left"
          >
            <span className="h-2 w-2 rounded-full bg-purple-500 shrink-0" />
            <span className="truncate">{isSk ? "Objekt v pozadí" : "Background Object"}</span>
          </button>

          {zones.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="flex items-center gap-1.5 p-2 rounded-xl border border-red-500/30 bg-red-950/30 hover:bg-red-900/40 text-xs font-semibold text-red-300 transition-all text-left"
            >
              <Trash2 className="h-3.5 w-3.5 text-red-400 shrink-0" />
              <span className="truncate">{isSk ? "Zmazať všetky zóny" : "Clear All Zones"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Zones List */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-bold text-neutral-300">
          <span>
            {isSk ? "Označené Zóny Vymazania:" : "Active Eraser Zones:"} ({zones.length})
          </span>
          {zones.length > 0 && (
            <span className="text-[10px] text-neutral-400">
              {zones.filter((z) => z.enabled).length} {isSk ? "aktívnych" : "active"}
            </span>
          )}
        </div>

        {zones.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-950/40 p-4 text-center text-xs text-neutral-500">
            {isSk
              ? "Zatiaľ nie sú označené žiadne objekty ani vodoznaky. Vyberte štetec vyššie alebo kliknite na rýchlu šablónu."
              : "No objects or watermarks marked yet. Pick the brush above or click a fast preset."}
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
            {zones.map((zone) => (
              <div
                key={zone.id}
                className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all ${
                  zone.enabled
                    ? "border-neutral-800 bg-neutral-950/80 text-white"
                    : "border-neutral-900 bg-neutral-950/40 text-neutral-500 opacity-60"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => handleToggleZone(zone.id)}
                    className="shrink-0 p-1 text-neutral-400 hover:text-white transition-colors"
                  >
                    {zone.enabled ? (
                      <Eye className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-neutral-600" />
                    )}
                  </button>

                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold truncate">{zone.name}</span>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {zone.type === "watermark"
                        ? isSk ? "Vodoznak" : "Watermark"
                        : zone.type === "subtitles"
                        ? isSk ? "Titulky" : "Subtitles"
                        : isSk ? "Objekt štetcom" : "Object Brush"}
                      {zone.points ? ` • ${zone.points.length} bodov` : ""}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDeleteZone(zone.id)}
                    className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-950/30 transition-all"
                    title={isSk ? "Odstrániť" : "Delete"}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Advanced Quality & Sharpness Settings */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-3.5 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs font-bold text-neutral-200">
          <div className="flex items-center gap-1.5">
            <Sliders className="h-4 w-4 text-rose-400" />
            <span>{isSk ? "Nastavenia Ostrosti a Splynutia:" : "Sharpness & Blending Settings:"}</span>
          </div>
        </div>

        {/* Grain Match Toggle */}
        <label className="flex items-center justify-between gap-2 cursor-pointer text-xs">
          <div className="flex flex-col">
            <span className="font-semibold text-neutral-300">
              {isSk ? "Zachovať filmové zrno (Anti-Rozmazanie)" : "Preserve Film Grain (Anti-Blur)"}
            </span>
            <span className="text-[10px] text-neutral-500">
              {isSk
                ? "Syntetizuje prirodzenú štruktúru videa, čím eliminuje efekt rozmazaného skla"
                : "Synthesizes authentic video texture, eliminating blurry fog look"}
            </span>
          </div>
          <input
            type="checkbox"
            checked={settings.eraserGrainMatch !== false}
            onChange={(e) => onChangeSettings({ eraserGrainMatch: e.target.checked })}
            className="h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-rose-500 accent-rose-500 cursor-pointer"
          />
        </label>

        {/* Feather Slider */}
        <div className="flex flex-col gap-1 pt-2 border-t border-neutral-800/80 text-xs">
          <div className="flex items-center justify-between text-neutral-400">
            <span>{isSk ? "Zjemnenie okrajov (Feathering):" : "Edge Feathering:"}</span>
            <span className="font-mono text-white font-bold">{settings.eraserFeather || 3}px</span>
          </div>
          <input
            type="range"
            min="0"
            max="8"
            step="1"
            value={settings.eraserFeather || 3}
            onChange={(e) => onChangeSettings({ eraserFeather: parseInt(e.target.value, 10) })}
            className="w-full accent-rose-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};

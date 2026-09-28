import React from "react";
import {
  Type,
  ZoomIn,
  Volume2,
  Sparkles,
  Scissors,
  Layers,
  Palette,
  Eye,
  Sliders,
  CheckSquare,
  Square,
  Wand2,
  Zap,
  Activity,
  Video,
  Newspaper,
  Mic,
  Music,
  ShieldCheck,
  User,
  Eraser,
  Image as ImageIcon,
  Headphones,
} from "lucide-react";
import { VideoProjectSettings, BackgroundMode, SpeedRampPreset } from "../types";

interface FeatureTogglesProps {
  settings: VideoProjectSettings;
  onChangeSettings: (newSettings: Partial<VideoProjectSettings>) => void;
  onAutoDetectSubtitles?: () => void;
  language: "sk" | "en";
}

export const FeatureToggles: React.FC<FeatureTogglesProps> = ({
  settings,
  onChangeSettings,
  onAutoDetectSubtitles,
  language,
}) => {
  const isSk = language === "sk";

  const speedRampOptions: { id: SpeedRampPreset; labelSk: string; labelEn: string; desc: string }[] = [
    {
      id: "constant",
      labelSk: "Normálna 1.0x",
      labelEn: "Constant 1.0x",
      desc: "Štandardná rýchlosť bez zmeny",
    },
    {
      id: "fast-ramp",
      labelSk: "Fast Ramp (0.9x → 1.35x)",
      labelEn: "Fast Ramp Curve",
      desc: "Pomalý hook, rýchle vysvetlenie",
    },
    {
      id: "bullet-time",
      labelSk: "Bullet Time (Slo-Mo akcent)",
      labelEn: "Bullet Time Slo-Mo",
      desc: "Dramatické spomalenie na kľúčovom slove",
    },
    {
      id: "jump-cuts",
      labelSk: "Ultra Jump-Cuts 1.25x",
      labelEn: "Rapid Jump-Cuts",
      desc: "Blesková kadencia pre TikTok",
    },
  ];

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 sm:p-5 shadow-xl text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div>
          <h2 className="font-['Fraunces'] text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Sliders className="h-4 w-4 text-rose-400" />
            {isSk ? "Možnosti a Funkcie Zaškrtnutia" : "Feature Toggles & Modules"}
          </h2>
          <p className="text-neutral-400">
            {isSk
              ? "Kombinuj to najlepšie zo Submagic, CapCut, Opus a VN Editora bez platenia"
              : "Combine Submagic, CapCut, Opus & VN Editor tools with $0 cost"}
          </p>
        </div>
      </div>

      {/* Group 1: Submagic & CapCut Core Features */}
      <div className="flex flex-col gap-2.5">
        <h3 className="font-bold uppercase tracking-wider text-rose-400">
          {isSk ? "1. Animácie, Titulky & Zvuky (Submagic & CapCut)" : "1. Captions, Zoom & Audio"}
        </h3>

        {/* Captions Toggle with Position & Size options */}
        <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-3 hover:border-neutral-700 transition-all">
          <label
            id="toggle-captions-label"
            className="flex items-start justify-between gap-3 cursor-pointer"
          >
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 rounded-lg bg-indigo-500/10 p-1.5 text-indigo-400">
                <Type className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">
                  {isSk ? "Submagic Automatické Titulky" : "Submagic Auto-Captions"}
                </div>
                <div className="text-neutral-400">
                  {isSk
                    ? "Dynamické karaoke vysvecovanie slov, emoji a farby (SK / EN)"
                    : "Word-by-word karaoke highlight, emoji popups, customizable styles"}
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.captionsEnabled}
              onChange={(e) => onChangeSettings({ captionsEnabled: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-rose-500 accent-rose-500 cursor-pointer"
            />
          </label>

          {/* If captions are enabled, allow checking position & scale */}
          {settings.captionsEnabled && (
            <div className="mt-3 pt-3 border-t border-neutral-800/60 flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-neutral-300">
                  {isSk
                    ? "Pozícia titulkov (zaškrtnúť):"
                    : "Caption Position (check):"}
                </span>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {settings.captionPosition === "top"
                    ? isSk ? "Hore" : "Top"
                    : settings.captionPosition === "middle"
                    ? isSk ? "V strede" : "Middle"
                    : isSk ? "Dole pod tvárou" : "Under Face"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "top" as const, labelSk: "Hore", labelEn: "Top", note: "18%" },
                  { id: "middle" as const, labelSk: "V strede", labelEn: "Middle", note: "50%" },
                  { id: "bottom" as const, labelSk: "Dole pod tvárou", labelEn: "Under Face", note: "74%" },
                ].map((pos) => {
                  const isChecked = settings.captionPosition === pos.id;
                  return (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() => onChangeSettings({ captionPosition: pos.id })}
                      className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 text-xs font-bold transition-all border ${
                        isChecked
                          ? "border-rose-500/80 bg-rose-500/20 text-white shadow-xs ring-1 ring-rose-500/40"
                          : "border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:text-white"
                      }`}
                    >
                      <span
                        className={`h-3 w-3 rounded-xs border flex items-center justify-center text-[9px] font-bold ${
                          isChecked
                            ? "border-rose-400 bg-rose-500 text-white"
                            : "border-neutral-700 bg-neutral-800"
                        }`}
                      >
                        {isChecked ? "✓" : ""}
                      </span>
                      <span>{isSk ? pos.labelSk : pos.labelEn}</span>
                    </button>
                  );
                })}
              </div>

              {/* Caption Scale quick buttons */}
              <div className="flex items-center justify-between gap-2 text-xs text-neutral-400 pt-1">
                <span>{isSk ? "Veľkosť k videu:" : "Scale to video:"}</span>
                <div className="flex items-center gap-1">
                  {[0.85, 1.0, 1.2].map((sc) => (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => onChangeSettings({ captionScale: sc })}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                        Math.abs((settings.captionScale ?? 1.0) - sc) < 0.05
                          ? "bg-rose-500 text-white"
                          : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                      }`}
                    >
                      {Math.round(sc * 100)}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Auto-Zoom Toggle */}
        <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-3 hover:border-neutral-700 transition-all">
          <label className="flex items-start justify-between gap-3 cursor-pointer">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 rounded-lg bg-rose-500/10 p-1.5 text-rose-400">
                <ZoomIn className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">
                  {isSk ? "CapCut Smart Zooming (Punch-In)" : "CapCut Smart Auto-Zoom"}
                </div>
                <div className="text-neutral-400">
                  {isSk
                    ? "Automatické priblíženie na úderných slovách a zmenách tém"
                    : "Automatic punch-in zooms on high-energy words and sentence starts"}
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.autoZoomEnabled}
              onChange={(e) => onChangeSettings({ autoZoomEnabled: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-rose-500 accent-rose-500 cursor-pointer"
            />
          </label>

          {/* Zoom Intensity slider if active */}
          {settings.autoZoomEnabled && (
            <div className="mt-2.5 pt-2.5 border-t border-neutral-800/60 flex items-center justify-between gap-3">
              <span className="text-neutral-400">
                {isSk ? "Intenzita priblíženia:" : "Zoom Intensity:"}
              </span>
              <div className="flex items-center gap-2">
                {[1.15, 1.25, 1.35].map((scale) => (
                  <button
                    key={scale}
                    onClick={() => onChangeSettings({ zoomIntensity: scale })}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                      settings.zoomIntensity === scale
                        ? "bg-rose-500 text-white"
                        : "bg-neutral-800 text-neutral-400 hover:text-white"
                    }`}
                  >
                    {scale}x
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sound Effects (SFX) Toggle */}
        <label
          id="toggle-sfx-label"
          className="flex items-start justify-between gap-3 rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-3 hover:border-neutral-700 transition-all cursor-pointer"
        >
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 rounded-lg bg-amber-500/10 p-1.5 text-amber-400">
              <Volume2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">
                {isSk ? "Zvukové Efekty & 808 Boom (SFX)" : "Sound Effects & 808 Boom (SFX)"}
              </div>
              <div className="text-neutral-400">
                {isSk
                  ? "Synchrónne zvuky: Whoosh, Pop, Ding, Cash a virálny bass drop"
                  : "Audio cues: whoosh, pop, ding, cash, and 808 bass impact"}
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.sfxEnabled}
            onChange={(e) => onChangeSettings({ sfxEnabled: e.target.checked })}
            className="mt-1 h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-rose-500 accent-rose-500 cursor-pointer"
          />
        </label>

        {/* Voice Narration Sync Toggle */}
        <label className="flex items-start justify-between gap-3 rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-3 hover:border-neutral-700 transition-all cursor-pointer">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 rounded-lg bg-indigo-500/10 p-1.5 text-indigo-400">
              <Headphones className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">
                {isSk ? "AI Dabing & Synchronizácia Hlasu" : "AI Narration & Voice Sync"}
              </div>
              <div className="text-neutral-400">
                {isSk
                  ? "Automatický dabing zladený s textom titulkov v reálnom čase"
                  : "Automatic voice-over synced perfectly with captions in real-time"}
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.voiceNarrationSyncEnabled}
            onChange={(e) => onChangeSettings({ voiceNarrationSyncEnabled: e.target.checked })}
            className="mt-1 h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-indigo-500 accent-indigo-500 cursor-pointer"
          />
        </label>
      </div>

      {/* Group 2: VN Video Editor & Vmaker Velocity Engine */}
      <div className="flex flex-col gap-2.5">
        <h3 className="font-bold uppercase tracking-wider text-fuchsia-400">
          {isSk ? "2. VN Video Editor & Zvuková Štúdia" : "2. VN Editor & Audio Suite"}
        </h3>

        {/* Studio Color & Audio Enhance */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-2.5 hover:border-neutral-700 transition-all cursor-pointer">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-rose-400" />
              <span className="font-semibold text-white">{isSk ? "Štúdio Farby" : "Studio Color"}</span>
            </div>
            <input
              type="checkbox"
              checked={settings.studioEnhanceColor}
              onChange={(e) => onChangeSettings({ studioEnhanceColor: e.target.checked })}
              className="h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-rose-500 accent-rose-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-2.5 hover:border-neutral-700 transition-all cursor-pointer">
            <div className="flex items-center gap-2">
              <Volume2 className="h-3.5 w-3.5 text-amber-400" />
              <span className="font-semibold text-white">{isSk ? "Normalizácia" : "Normalize"}</span>
            </div>
            <input
              type="checkbox"
              checked={settings.studioNormalizeAudio}
              onChange={(e) => onChangeSettings({ studioNormalizeAudio: e.target.checked })}
              className="h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-rose-500 accent-rose-500 cursor-pointer"
            />
          </label>
        </div>

        {/* Voice Clarifier & Music Ducking */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-2.5 hover:border-neutral-700 transition-all cursor-pointer">
            <div className="flex items-center gap-2">
              <Mic className="h-3.5 w-3.5 text-indigo-400" />
              <span className="font-semibold text-white">{isSk ? "Čistič hlasu" : "Clarifier"}</span>
            </div>
            <input
              type="checkbox"
              checked={settings.voiceClarifierEnabled}
              onChange={(e) => onChangeSettings({ voiceClarifierEnabled: e.target.checked })}
              className="h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-indigo-500 accent-indigo-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-2.5 hover:border-neutral-700 transition-all cursor-pointer">
            <div className="flex items-center gap-2">
              <Music className="h-3.5 w-3.5 text-fuchsia-400" />
              <span className="font-semibold text-white">{isSk ? "Ducking hudby" : "Auto Ducking"}</span>
            </div>
            <input
              type="checkbox"
              checked={settings.bgMusicDucking}
              onChange={(e) => onChangeSettings({ bgMusicDucking: e.target.checked })}
              className="h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-fuchsia-500 accent-fuchsia-500 cursor-pointer"
            />
          </label>
        </div>

        {/* VN Screen Shake */}
        <label className="flex items-start justify-between gap-3 rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-3 hover:border-neutral-700 transition-all cursor-pointer">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 rounded-lg bg-fuchsia-500/10 p-1.5 text-fuchsia-400">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">
                {isSk ? "VN Screen Shake (Mikrootrasy kamery)" : "VN Screen Shake Impact"}
              </div>
              <div className="text-neutral-400">
                {isSk
                  ? "Energický mikrootras obrazu pri úderoch, zvukoch a zmenách scén"
                  : "Punchy camera shake impulses on bass drops and impactful words"}
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.screenShakeEnabled}
            onChange={(e) => onChangeSettings({ screenShakeEnabled: e.target.checked })}
            className="mt-1 h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-fuchsia-500 accent-fuchsia-500 cursor-pointer"
          />
        </label>

        {/* VN Speed Ramping Curve */}
        <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            <span className="font-bold text-white">
              {isSk ? "VN Speed Ramping (Krivka rýchlosti)" : "VN Speed Ramping Velocity"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {speedRampOptions.map((opt) => {
              const isSelected = settings.speedRampPreset === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => onChangeSettings({ speedRampPreset: opt.id })}
                  className={`flex flex-col text-left p-2 rounded-xl border transition-all ${
                    isSelected
                      ? "border-amber-500 bg-amber-500/10 text-white"
                      : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
                  }`}
                >
                  <span className="font-bold text-xs">
                    {isSk ? opt.labelSk : opt.labelEn}
                  </span>
                  <span className="text-[10px] text-neutral-500 mt-0.5">
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Vmaker Silence removal */}
        <label className="flex items-start justify-between gap-3 rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-3 hover:border-neutral-700 transition-all cursor-pointer">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 rounded-lg bg-emerald-500/10 p-1.5 text-emerald-400">
              <Scissors className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">
                {isSk ? "Vmaker Jump-Cuts (Vystrihnutie ticha)" : "Vmaker Jump-Cuts (Auto Silence Cut)"}
              </div>
              <div className="text-neutral-400">
                {isSk
                  ? "Automatické preskočenie hluchých miest a páuz dlhších ako 0.35s"
                  : "Automatically skips dead air gaps so speech is rapid and continuous"}
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.cutSilences}
            onChange={(e) => onChangeSettings({ cutSilences: e.target.checked })}
            className="mt-1 h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-emerald-500 accent-emerald-500 cursor-pointer"
          />
        </label>
      </div>

      {/* Group 3: Guma & Pozadie (Background FX) */}
      <div className="flex flex-col gap-2.5">
        <h3 className="font-bold uppercase tracking-wider text-indigo-400">
          {isSk ? "3. Guma, Pozadie & Odstránenie (Background FX)" : "3. Background Eraser & Bokeh"}
        </h3>

        {/* Object Eraser Toggle */}
        <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-3 hover:border-neutral-700 transition-all">
          <label className="flex items-start justify-between gap-3 cursor-pointer">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 rounded-lg bg-indigo-500/10 p-1.5 text-indigo-400">
                <Eraser className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">
                  {isSk ? "AI Guma na Staré Titulky & Logá" : "AI Eraser (Old Subs & Logos)"}
                </div>
                <div className="text-neutral-400">
                  {isSk
                    ? "Odstráni pôvodné vypálené titulky a vodoznaky bez rozmazania"
                    : "Removes original hardcoded subtitles & logos with zero-blur inpainting"}
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.eraserEnabled}
              onChange={(e) => onChangeSettings({ eraserEnabled: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-indigo-500 accent-indigo-500 cursor-pointer"
            />
          </label>

          {settings.eraserEnabled && (
            <div className="mt-3 pt-3 border-t border-neutral-800/60 flex flex-col gap-2">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                {isSk ? "Zóna na odstránenie:" : "Eraser Target Zone:"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={onAutoDetectSubtitles}
                  className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-[10px] font-bold hover:bg-amber-500/20"
                >
                  <Zap className="h-3 w-3" />
                  {isSk ? "Smart AI Detekcia" : "Smart AI Detect"}
                </button>
                {[
                  { id: "bottom", labelSk: "Spodné Titulky", labelEn: "Bottom Subs" },
                  { id: "top", labelSk: "Horné Logo", labelEn: "Top Logo" },
                  { id: "custom", labelSk: "Vlastná Zóna", labelEn: "Custom" },
                ].map((zone) => (
                  <button
                    key={zone.id}
                    onClick={() => {
                      // Logic to set a default zone if none exists or update existing
                      const newZones = [...(settings.eraserZones || [])];
                      if (newZones.length === 0) {
                        newZones.push({
                          id: "default-eraser",
                          name: zone.labelEn,
                          type: zone.id === "top" ? "watermark" : "subtitles",
                          x: 0,
                          y: zone.id === "bottom" ? 0.75 : zone.id === "top" ? 0.05 : 0.4,
                          width: 1,
                          height: 0.15,
                          enabled: true,
                        });
                      } else {
                        // Update first zone to preset
                        newZones[0] = {
                          ...newZones[0],
                          y: zone.id === "bottom" ? 0.75 : zone.id === "top" ? 0.05 : 0.4,
                          height: 0.15,
                        };
                      }
                      onChangeSettings({ eraserZones: newZones });
                    }}
                    className={`flex-1 py-1 px-2 rounded-md text-[10px] font-bold transition-all border ${
                      (settings.eraserZones?.[0]?.y || 0) > 0.6 && zone.id === "bottom"
                        ? "bg-indigo-500 text-white border-indigo-400"
                        : (settings.eraserZones?.[0]?.y || 0) < 0.2 && zone.id === "top"
                        ? "bg-indigo-500 text-white border-indigo-400"
                        : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white"
                    }`}
                  >
                    {isSk ? zone.labelSk : zone.labelEn}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between mt-1">
                 <span className="text-[10px] text-neutral-500">{isSk ? "Kvalita: 4K Inpaint s Grain Match" : "Quality: 4K Inpaint + Grain Match"}</span>
                 <div className="flex items-center gap-1.5">
                   <ShieldCheck className="h-3 w-3 text-emerald-400" />
                   <span className="text-[10px] text-emerald-400 font-bold">{isSk ? "100% Bezpečná" : "100% Safe"}</span>
                 </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { id: "none", labelSk: "Pôvodné", labelEn: "Original" },
            { id: "studio-blur", labelSk: "Štúdio Bokeh", labelEn: "Studio Blur" },
            { id: "dark-cinema", labelSk: "Tmavé Cinema", labelEn: "Dark Cinema" },
            { id: "neon-glow", labelSk: "Neon Glow", labelEn: "Neon Glow" },
          ].map((item) => {
            const isSelected = settings.backgroundMode === item.id;
            return (
              <button
                key={item.id}
                onClick={() =>
                  onChangeSettings({ backgroundMode: item.id as BackgroundMode })
                }
                className={`flex flex-col items-center justify-center rounded-xl border p-2.5 transition-all ${
                  isSelected
                    ? "border-indigo-500 bg-indigo-500/20 text-white font-bold shadow-sm"
                    : "border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700 hover:text-white"
                }`}
              >
                <span className="font-bold">
                  {isSk ? item.labelSk : item.labelEn}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Group 4: Viral Retention & Top Hook */}
      <div className="flex flex-col gap-2.5">
        <h3 className="font-bold uppercase tracking-wider text-amber-400">
          {isSk ? "4. Viralita, Hook & Progress" : "4. Retention & Hooks"}
        </h3>

        {/* Top Viral Hook Banner */}
        <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-3 flex flex-col gap-2">
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-rose-400" />
              <span className="font-bold text-white">
                {isSk ? "Vrchný Hook Banner (0-3s)" : "Top Hook Banner (0-3s)"}
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.viralHookEnabled}
              onChange={(e) => onChangeSettings({ viralHookEnabled: e.target.checked })}
              className="h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-rose-500 accent-rose-500 cursor-pointer"
            />
          </label>

          {settings.viralHookEnabled && (
            <input
              type="text"
              value={settings.viralHookText}
              onChange={(e) => onChangeSettings({ viralHookText: e.target.value })}
              placeholder={isSk ? "napr. ZASTAV SCROLLOVANIE! 🔥" : "e.g. STOP SCROLLING 🔥"}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-white placeholder-neutral-500 focus:border-rose-500 focus:outline-none font-bold"
            />
          )}
        </div>

        {/* Retention Progress Bar */}
        <label className="flex items-center justify-between gap-3 rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-2.5 hover:border-neutral-700 transition-all cursor-pointer">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-amber-400" />
            <span className="font-semibold text-white">
              {isSk ? "Spodný Retention Progress Bar" : "Bottom Retention Progress Bar"}
            </span>
          </div>
          <input
            type="checkbox"
            checked={settings.progressBarEnabled}
            onChange={(e) => onChangeSettings({ progressBarEnabled: e.target.checked })}
            className="h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-rose-500 accent-rose-500 cursor-pointer"
          />
        </label>
      </div>

      {/* Group 5: OmniStrih Taktilný Štýl (Aiktivista) */}
      <div className="flex flex-col gap-2.5">
        <h3 className="font-bold uppercase tracking-wider text-amber-300 flex items-center justify-between">
          <span>{isSk ? "5. OmniStrih Taktilný Papier & Washi Páska" : "5. OmniStrih Tactile & Washi Tape"}</span>
          <span className="text-[10px] lowercase font-normal px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
            Aiktivista štýl
          </span>
        </h3>

        {/* Washi tape stickers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="flex items-start justify-between gap-3 rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-3 hover:border-neutral-700 transition-all cursor-pointer">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 rounded-lg bg-indigo-500/10 p-1.5 text-indigo-400">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">
                  {isSk ? "B-Roll Prekrytia" : "B-Roll Overlays"}
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.bRollEnabled}
              onChange={(e) => onChangeSettings({ bRollEnabled: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-indigo-500 accent-indigo-500 cursor-pointer"
            />
          </label>

          <label className="flex items-start justify-between gap-3 rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-3 hover:border-neutral-700 transition-all cursor-pointer">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 rounded-lg bg-amber-500/10 p-1.5 text-amber-400">
                <Newspaper className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">
                  {isSk ? "Washi Páska" : "Washi Tape"}
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.omniWashiTapeEnabled !== false}
              onChange={(e) => onChangeSettings({ omniWashiTapeEnabled: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-amber-400 accent-amber-400 cursor-pointer"
            />
          </label>

          <label className="flex items-start justify-between gap-3 rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-3 hover:border-neutral-700 transition-all cursor-pointer">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 rounded-lg bg-amber-500/10 p-1.5 text-amber-400">
                <ImageIcon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">
                  {isSk ? "Papierová Textúra" : "Paper Texture"}
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.omniCollagePaperTexture}
              onChange={(e) => onChangeSettings({ omniCollagePaperTexture: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-amber-400 accent-amber-400 cursor-pointer"
            />
          </label>
        </div>

        {/* Highlighter Marker Color for Active Words */}
        <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <Palette className="h-4 w-4 text-amber-400" />
              <span>{isSk ? "Farba Zvýrazňovača (Fixka na text)" : "Highlighter Marker Color"}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            {[
              { color: "rgba(250, 204, 21, 0.88)", label: "Neón Žltá", bgClass: "bg-yellow-400" },
              { color: "rgba(74, 222, 128, 0.88)", label: "Limetková", bgClass: "bg-emerald-400" },
              { color: "rgba(56, 189, 248, 0.88)", label: "Azúrová", bgClass: "bg-sky-400" },
              { color: "rgba(244, 114, 182, 0.88)", label: "Ružová", bgClass: "bg-pink-400" },
              { color: "rgba(251, 146, 60, 0.88)", label: "Oranžová", bgClass: "bg-orange-400" },
            ].map((c) => (
              <button
                key={c.color}
                onClick={() => onChangeSettings({ highlighterColor: c.color })}
                className={`flex-1 py-1.5 px-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                  settings.highlighterColor === c.color
                    ? "border-white text-white bg-neutral-800 shadow-sm ring-1 ring-white/50"
                    : "border-neutral-800 text-neutral-400 hover:text-white bg-neutral-900"
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${c.bgClass}`}></span>
                <span className="hidden sm:inline">{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Group 6: AI Opus & Smart Framing */}
      <div className="flex flex-col gap-2.5">
        <h3 className="font-bold uppercase tracking-wider text-sky-400">
          {isSk ? "6. AI Opus & Smart Framing" : "6. AI Opus & Smart Framing"}
        </h3>

        <label className="flex items-start justify-between gap-3 rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-3 hover:border-neutral-700 transition-all cursor-pointer">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 rounded-lg bg-sky-500/10 p-1.5 text-sky-400">
              <User className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">
                {isSk ? "Face-safe reframe (namerané pozície tváre)" : "Face-safe reframe (measured face positions)"}
              </div>
              <div className="text-neutral-400">
                {isSk
                  ? "Pri 9:16 výreze posunie záber za nameranou tvárou. Pozície meria panel Detekcia tvárí cez FaceDetector v prehliadači — keď nič namerané nie je, záber ostáva vystredený a nič sa neodhaduje."
                  : "Shifts the 9:16 crop towards the measured face. Positions are measured by the Face detection panel via the browser FaceDetector — with no measurement the crop stays centred and nothing is guessed."}
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.autoReframeFace}
            onChange={(e) => onChangeSettings({ autoReframeFace: e.target.checked })}
            className="mt-1 h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-sky-500 accent-sky-500 cursor-pointer"
          />
        </label>
      </div>

      {/* Group 7: Pokročilé & Šetrenie Kvóty */}
      <div className="flex flex-col gap-2.5">
        <h3 className="font-bold uppercase tracking-wider text-emerald-400">
          {isSk ? "7. Pokročilé & Šetrenie Kvóty" : "7. Advanced & Quota Saver"}
        </h3>

        {/* Zero-Token Mode Toggle */}
        <label className="flex items-start justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 hover:border-emerald-500/50 transition-all cursor-pointer">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 rounded-lg bg-emerald-500/20 p-1.5 text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">
                {isSk ? "Zero-Token Režim (Bez platenia)" : "Zero-Token Mode ($0 Quota)"}
              </div>
              <div className="text-emerald-200/80">
                {isSk
                  ? "Vypne AI volania na server. Používa lokálne algoritmy a Web Speech API pre 100% úsporu tokenov."
                  : "Disables AI server calls. Uses local algorithms & Web Speech API for 100% token savings."}
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.zeroTokenMode}
            onChange={(e) => onChangeSettings({ zeroTokenMode: e.target.checked })}
            className="mt-1 h-4 w-4 rounded border-emerald-700 bg-neutral-800 text-emerald-500 accent-emerald-500 cursor-pointer"
          />
        </label>
      </div>
    </div>
  );
};

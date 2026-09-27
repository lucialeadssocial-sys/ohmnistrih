import React from "react";
import { 
  Zap, 
  Crown, 
  Flame, 
  Sparkles, 
  Star, 
  TrendingUp,
  Award,
  LucideIcon
} from "lucide-react";
import { VideoProjectSettings, CaptionStyle } from "../types";

interface ViralPreset {
  id: string;
  nameSk: string;
  nameEn: string;
  descriptionSk: string;
  descriptionEn: string;
  icon: LucideIcon;
  color: string;
  settings: Partial<VideoProjectSettings>;
}

const VIRAL_PRESETS: ViralPreset[] = [
  {
    id: "hormozi",
    nameSk: "Alex Hormozi",
    nameEn: "Hormozi Style",
    descriptionSk: "Agresívne titulky, silné zvýraznenie a rýchle zoomy.",
    descriptionEn: "Aggressive captions, strong highlights and fast zooms.",
    icon: Flame,
    color: "from-orange-500 to-rose-600",
    settings: {
      captionStyle: "submagic-viral",
      captionCase: "uppercase",
      autoZoomEnabled: true,
      zoomIntensity: 1.35,
      colorPalette: "hormozi",
      highlighterColor: "rgba(250, 204, 21, 0.9)",
      sfxEnabled: true,
      sfxVolume: 0.9,
    }
  },
  {
    id: "abdaal",
    nameSk: "Ali Abdaal",
    nameEn: "Minimalist",
    descriptionSk: "Čistá estetika, jemné prechody a elegantný text.",
    descriptionEn: "Clean aesthetics, soft transitions and elegant text.",
    icon: Star,
    color: "from-indigo-500 to-blue-600",
    settings: {
      captionStyle: "omnistrih-torn-paper",
      captionCase: "capitalize",
      autoZoomEnabled: true,
      zoomIntensity: 1.15,
      colorPalette: "cinematic",
      highlighterColor: "rgba(129, 140, 248, 0.6)",
      sfxEnabled: true,
      sfxVolume: 0.5,
    }
  },
  {
    id: "beast",
    nameSk: "MrBeast Viral",
    nameEn: "MrBeast Style",
    descriptionSk: "Maximálne udržanie pozornosti, veľa grafiky a SFX.",
    descriptionEn: "Maximum retention, lots of graphics and SFX.",
    icon: Zap,
    color: "from-cyan-500 to-blue-500",
    settings: {
      captionStyle: "submagic-viral",
      captionCase: "uppercase",
      autoZoomEnabled: true,
      zoomIntensity: 1.45,
      sfxEnabled: true,
      sfxVolume: 1.0,
      bgMusicVolume: 0.5,
      progressBarEnabled: true,
      progressBarColor: "#06b6d4",
    }
  },
  {
    id: "cinematic",
    nameSk: "Filmový Look",
    nameEn: "Cinematic",
    descriptionSk: "Širokouhlý formát, zrnitosť a hlboké farby.",
    descriptionEn: "Widescreen format, grain and deep colors.",
    icon: Award,
    color: "from-neutral-700 to-neutral-900",
    settings: {
      aspectRatio: "16:9",
      backgroundMode: "studio-blur",
      studioEnhanceColor: true,
      bgMusicTrack: "demo-ambient",
      bgMusicVolume: 0.3,
      captionStyle: "omnistrih-torn-paper",
      colorPalette: "cinematic" as any,
    }
  }
];

interface ViralPresetsProps {
  currentSettings: VideoProjectSettings;
  onChangeSettings: (settings: Partial<VideoProjectSettings>) => void;
  language: "sk" | "en";
}

export const ViralPresets: React.FC<ViralPresetsProps> = ({
  currentSettings,
  onChangeSettings,
  language,
}) => {
  const isSk = language === "sk";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-rose-500" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            {isSk ? "Viral Presety" : "Viral Presets"}
          </h3>
        </div>
        <span className="text-[10px] font-medium text-neutral-500 bg-neutral-900 px-2 py-0.5 rounded-full border border-neutral-800">
          {isSk ? "Aplikujte štýl 1-klikom" : "Apply style in 1-click"}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {VIRAL_PRESETS.map((preset) => {
          const Icon = preset.icon;
          // Simplified active check
          const isActive = currentSettings.colorPalette === preset.settings.colorPalette && 
                           currentSettings.captionStyle === preset.settings.captionStyle;

          return (
            <button
              key={preset.id}
              onClick={() => onChangeSettings(preset.settings)}
              className={`group relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all overflow-hidden ${
                isActive 
                  ? "border-rose-500/50 bg-rose-500/5 shadow-lg shadow-rose-500/10" 
                  : "border-neutral-800 bg-neutral-950/60 hover:border-neutral-700 hover:bg-neutral-900/40"
              }`}
            >
              {/* Background Glow */}
              <div className={`absolute -right-4 -top-4 h-12 w-12 bg-gradient-to-br ${preset.color} opacity-10 blur-xl transition-opacity group-hover:opacity-20`} />
              
              <div className={`rounded-lg bg-gradient-to-br ${preset.color} p-1.5 text-white shadow-sm transition-transform group-hover:scale-110`}>
                <Icon className="h-3.5 w-3.5" />
              </div>

              <div>
                <div className="text-[11px] font-bold text-white mb-0.5">
                  {isSk ? preset.nameSk : preset.nameEn}
                </div>
                <div className="text-[9px] leading-tight text-neutral-500 line-clamp-2">
                  {isSk ? preset.descriptionSk : preset.descriptionEn}
                </div>
              </div>

              {isActive && (
                <div className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

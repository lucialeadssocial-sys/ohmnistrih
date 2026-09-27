import React, { useState, useEffect } from "react";
import { VisualStyleDNA, STYLE_PRESETS, StylePresetId } from "../visual/VisualStyleDNA";
import { VisualStyleManager } from "../visual/VisualStyleManager";
import { ReferenceStyleAnalyzer } from "../visual/ReferenceStyleAnalyzer";
import { AIStoryboardPanel } from "./AIStoryboardPanel";
import { VisualReviewCenter } from "./VisualReviewCenter";
import { Sparkles, Sliders, Layers, Type, Film, Image as ImageIcon, Video, Move, FileText, CheckCircle, Upload } from "lucide-react";

interface AIVisualDirectorCenterProps {
  projectId: string;
  onStyleChanged?: (dna: VisualStyleDNA) => void;
}

export const AIVisualDirectorCenter: React.FC<AIVisualDirectorCenterProps> = ({
  projectId,
  onStyleChanged,
}) => {
  const [activeTab, setActiveTab] = useState<
    "style" | "density" | "scene" | "typography" | "collage" | "broll" | "motion" | "storyboard" | "reference" | "review"
  >("style");

  const [styleDNA, setStyleDNA] = useState<VisualStyleDNA>(() =>
    VisualStyleManager.getActiveStyle(projectId)
  );

  const [refFileName, setRefFileName] = useState("");
  const [refResult, setRefResult] = useState<string | null>(null);

  useEffect(() => {
    const dna = VisualStyleManager.getActiveStyle(projectId);
    setStyleDNA(dna);
  }, [projectId]);

  const selectPreset = (presetId: StylePresetId) => {
    const updated = VisualStyleManager.setPreset(projectId, presetId);
    setStyleDNA(updated);
    if (onStyleChanged) onStyleChanged(updated);
  };

  const updateDensity = (val: number) => {
    const updated = { ...styleDNA, visualDensity: val };
    VisualStyleManager.saveStyle(projectId, updated);
    setStyleDNA(updated);
    if (onStyleChanged) onStyleChanged(updated);
  };

  const handleRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setRefFileName(file.name);
      const res = ReferenceStyleAnalyzer.analyzeReferenceStyle(file.name, projectId);
      setStyleDNA(res.dna);
      VisualStyleManager.saveStyle(projectId, res.dna);
      setRefResult(res.explanationSk);
      if (onStyleChanged) onStyleChanged(res.dna);
    }
  };

  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 text-white space-y-6 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
              AI VISUAL DIRECTOR
            </h2>
            <p className="text-xs text-neutral-400">
              Inteligentné rozhodovanie o vizuálnom štýle, typografii, kolážach a rytme videa nad EDL
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs text-neutral-400">Aktívny štýl:</span>
          <p className="text-sm font-bold text-amber-400">{styleDNA.name}</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2 border-b border-neutral-800 scrollbar-none">
        {[
          { id: "style", label: "1. Style Presets", icon: Sliders },
          { id: "density", label: "2. Visual Density", icon: Layers },
          { id: "scene", label: "3. Scene Director", icon: Film },
          { id: "typography", label: "4. Typography", icon: Type },
          { id: "collage", label: "5. Collage & Paper", icon: ImageIcon },
          { id: "broll", label: "6. B-roll", icon: Video },
          { id: "motion", label: "7. Motion", icon: Move },
          { id: "storyboard", label: "8. Storyboard", icon: FileText },
          { id: "reference", label: "9. Reference Style", icon: Upload },
          { id: "review", label: "10. Visual Review", icon: CheckCircle },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-2 text-xs font-bold rounded-lg whitespace-nowrap flex items-center gap-1.5 transition ${
                activeTab === tab.id
                  ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                  : "bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-white"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="pt-2">
        {/* Tab 1: Style Presets */}
        {activeTab === "style" && (
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-neutral-300">Vyberte si profesionálny vizuálny profil:</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(STYLE_PRESETS).map(([key, preset]) => {
                const isSelected = styleDNA.id.startsWith(key);
                return (
                  <div
                    key={key}
                    onClick={() => selectPreset(key as StylePresetId)}
                    className={`p-4 border rounded-xl cursor-pointer transition relative ${
                      isSelected
                        ? "border-amber-500 bg-amber-500/10"
                        : "border-neutral-800 bg-neutral-900/60 hover:border-neutral-700"
                    }`}
                  >
                    {key === "OMNISTRIH_EDITORIAL" && (
                      <span className="absolute top-2 right-2 text-[10px] bg-amber-500 text-black font-extrabold px-2 py-0.5 rounded">
                        SIGNATURE PRESET
                      </span>
                    )}
                    <h5 className="font-bold text-sm text-white mb-1">{preset.name}</h5>
                    <p className="text-xs text-neutral-400 line-clamp-2">{preset.description}</p>
                    <div className="mt-3 flex items-center gap-2 text-[11px] text-neutral-500">
                      <span>Hustota: Math.round({preset.visualDensity * 100})%</span>
                      <span>•</span>
                      <span>Akcent: <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: preset.accentColor }} /></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Visual Density */}
        {activeTab === "density" && (
          <div className="space-y-6 max-w-xl">
            <div>
              <label className="text-sm font-bold text-neutral-200 block mb-2">
                Nastavenie vizuálnej hustoty (Visual Density): {(styleDNA.visualDensity * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={styleDNA.visualDensity}
                onChange={(e) => updateDensity(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-xs text-neutral-500 mt-1">
                <span>0% (Čistý obraz)</span>
                <span>50% (Podpora)</span>
                <span>100% (Intenzívna koláž)</span>
              </div>
            </div>

            <div className="p-4 bg-neutral-900 rounded-xl border border-neutral-800 space-y-2 text-xs">
              <h5 className="font-bold text-amber-400">Pravidlá Visual Density Engine:</h5>
              <p className="text-neutral-300">• 0.00–0.25: Čistý rámec bez rušivých prvkov</p>
              <p className="text-neutral-300">• 0.25–0.50: Jemná podpora (punch-in / minimal text)</p>
              <p className="text-neutral-300">• 0.50–0.75: Podporný B-roll / karta / ilustrácia</p>
              <p className="text-neutral-300">• 0.75–0.90: Silná editoriálna kompozícia (koláž, noviny, polaroid)</p>
              <p className="text-neutral-300">• 0.90–1.00: Peak visual moment (plná animovaná koláž)</p>
              <p className="text-amber-300/80 italic mt-2">Automatický VISUAL_RESET sa spustí po dvoch hustých sekvenciách za sebou.</p>
            </div>
          </div>
        )}

        {/* Tab 3: Scene Director */}
        {activeTab === "scene" && (
          <div className="space-y-4 text-xs text-neutral-300">
            <h4 className="font-bold text-sm text-neutral-100">AI Scene Director Status</h4>
            <p className="text-neutral-400">
              AI vyhodnocuje rečníka, sémantiku a dostupné médiá pre vygenerovanie plánu pre každú scénu. Ak chýba médiá, vygeneruje status <strong className="text-amber-400">NEEDS_ASSET</strong> (nikdy nevymýšľa neexistujúce súbory).
            </p>
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2">
              <div className="flex justify-between font-bold text-neutral-200">
                <span>Pomer Rečník vs Podporný vizuál:</span>
                <span className="text-amber-400">{Math.round(styleDNA.talkingHeadRatio * 100)}% / {Math.round(styleDNA.supportingVisualRatio * 100)}%</span>
              </div>
              <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden flex">
                <div className="bg-amber-500 h-full" style={{ width: `${styleDNA.talkingHeadRatio * 100}%` }} />
                <div className="bg-emerald-500 h-full" style={{ width: `${styleDNA.supportingVisualRatio * 100}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Typography */}
        {activeTab === "typography" && (
          <div className="space-y-4 text-xs">
            <h4 className="font-bold text-sm text-neutral-100">Kinetic Typography Engine</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2">
                <span className="text-neutral-400">Štýl písma:</span>
                <p className="font-bold text-amber-400 capitalize">{styleDNA.typographyStyle}</p>
                <span className="text-neutral-400">Váha:</span>
                <p className="font-bold text-white capitalize">{styleDNA.typographyWeight}</p>
              </div>
              <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2">
                <span className="text-neutral-400">Akcentová farba:</span>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded border border-neutral-700" style={{ backgroundColor: styleDNA.accentColor }} />
                  <span className="font-bold text-white">{styleDNA.accentColor}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Collage */}
        {activeTab === "collage" && (
          <div className="space-y-4 text-xs">
            <h4 className="font-bold text-sm text-neutral-100">Editorial Collage & Paper / Newspaper / Polaroid System</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg">
                <span className="text-neutral-400">Paper Style:</span>
                <p className="font-bold text-amber-400 capitalize">{styleDNA.paperStyle}</p>
              </div>
              <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg">
                <span className="text-neutral-400">Newspaper Clip:</span>
                <p className="font-bold text-amber-400 capitalize">{styleDNA.newspaperStyle}</p>
              </div>
              <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg">
                <span className="text-neutral-400">Polaroid Frame:</span>
                <p className="font-bold text-amber-400 capitalize">{styleDNA.polaroidStyle}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: B-roll */}
        {activeTab === "broll" && (
          <div className="space-y-2 text-xs text-neutral-300">
            <h4 className="font-bold text-sm text-neutral-100">B-roll Intelligence</h4>
            <p>Frekvencia B-rollu: <strong className="text-amber-400">{styleDNA.brollFrequency * 100}%</strong></p>
            <p>Napojené na BrollIntent v existujúcom B-roll systéme.</p>
          </div>
        )}

        {/* Tab 7: Motion */}
        {activeTab === "motion" && (
          <div className="space-y-2 text-xs text-neutral-300">
            <h4 className="font-bold text-sm text-neutral-100">Motion & Punch-In Engine</h4>
            <p>Intenzita pohybu: <strong className="text-amber-400">{styleDNA.motionIntensity * 100}%</strong></p>
            <p>Micro-motion: <strong className="text-amber-400 capitalize">{styleDNA.microMotion}</strong></p>
          </div>
        )}

        {/* Tab 8: Storyboard */}
        {activeTab === "storyboard" && (
          <AIStoryboardPanel projectId={projectId} styleDNA={styleDNA} />
        )}

        {/* Tab 9: Reference Style */}
        {activeTab === "reference" && (
          <div className="space-y-4 text-xs">
            <h4 className="font-bold text-sm text-neutral-100">Reference Image → Visual Style DNA</h4>
            <p className="text-neutral-400">
              Nahrajte referenčný obrázok pre extrakciu typografie, farebnosti, hustoty a kompozície.
            </p>
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-amber-400 font-semibold rounded-lg cursor-pointer transition border border-neutral-700">
              <Upload className="w-4 h-4" /> Nahrať referenčný obrázok
              <input type="file" accept="image/*" onChange={handleRefUpload} className="hidden" />
            </label>
            {refFileName && <p className="text-neutral-300">Vybraný súbor: <strong>{refFileName}</strong></p>}
            {refResult && (
              <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-xl text-emerald-300">
                {refResult}
              </div>
            )}
          </div>
        )}

        {/* Tab 10: Visual Review */}
        {activeTab === "review" && (
          <VisualReviewCenter projectId={projectId} />
        )}
      </div>
    </div>
  );
};

import React, { useState } from "react";
import { 
  Image as ImageIcon, 
  Sparkles, 
  Zap, 
  CheckCircle2, 
  Copy, 
  Download, 
  RefreshCcw, 
  TrendingUp, 
  Layout, 
  Star,
  Eye,
  Sliders,
  Share2
} from "lucide-react";
import { ThumbnailProject, ThumbnailConcept, RawAIAnalysis } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface AIThumbnailStudioProps {
  project: ThumbnailProject;
  rawAnalysis: RawAIAnalysis;
  isGenerating: boolean;
  onUpdateProject: (project: ThumbnailProject) => void;
  onGenerateConcepts: () => void;
  language: "sk" | "en";
  showToast: (msg: string) => void;
}

export const AIThumbnailStudio: React.FC<AIThumbnailStudioProps> = ({
  project,
  rawAnalysis,
  isGenerating,
  onUpdateProject,
  onGenerateConcepts,
  language,
  showToast
}) => {
  const isSk = language === "sk";
  const [selectedConcept, setSelectedConcept] = useState<ThumbnailConcept | null>(
    project.concepts.find(c => c.id === project.selectedConceptId) || project.concepts[0] || null
  );

  const handleSelectConcept = (concept: ThumbnailConcept) => {
    setSelectedConcept(concept);
    onUpdateProject({
      ...project,
      selectedConceptId: concept.id,
      concepts: project.concepts.map(c => ({ ...c, isApplied: c.id === concept.id }))
    });
    showToast(isSk ? `Zvolený koncept: ${concept.titleSk}` : `Selected concept: ${concept.titleEn}`);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast(isSk ? "Skopírované do schránky!" : "Copied to clipboard!");
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-600 text-white shadow-xl shadow-amber-600/20">
            <ImageIcon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-white uppercase tracking-wider">AI THUMBNAIL & CLICKBAIT STUDIO</h3>
            <p className="text-xs text-neutral-400 font-bold">
              {isSk ? "Generujte miniatúry s vysokým CTR (Click-Through Rate)" : "Generate High-CTR Thumbnails & Clickbait Titles"}
            </p>
          </div>
        </div>

        <button
          onClick={onGenerateConcepts}
          disabled={isGenerating}
          className="px-5 py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-amber-600/20 flex items-center gap-2 disabled:opacity-50"
        >
          <Sparkles className={`h-4 w-4 ${isGenerating ? "animate-spin" : ""}`} />
          <span>{isGenerating ? (isSk ? "GENERUJEM KONCEPTY..." : "GENERATING CONCEPTS...") : (isSk ? "GENEROVAŤ 3 AI KONCEPTY" : "GENERATE 3 AI CONCEPTS")}</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Preview & Customization */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="relative rounded-3xl overflow-hidden border border-neutral-800 bg-neutral-950 aspect-video shadow-2xl flex flex-col items-center justify-center p-8 text-center group">
            {/* Dynamic Background Preview */}
            <div className={`absolute inset-0 opacity-40 bg-gradient-to-br ${
              selectedConcept?.bgTheme === "neon-cyber" ? "from-fuchsia-600 via-purple-900 to-black" :
              selectedConcept?.bgTheme === "rich-sunset" ? "from-amber-600 via-rose-900 to-black" :
              selectedConcept?.bgTheme === "emerald-growth" ? "from-emerald-600 via-teal-900 to-black" :
              "from-neutral-800 via-neutral-900 to-black"
            }`} />

            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

            {/* Thumbnail Overlay Content */}
            <div className="relative z-10 flex flex-col items-center gap-4 max-w-lg">
              {selectedConcept ? (
                <>
                  <div className="px-4 py-1.5 rounded-full bg-amber-500 text-black font-black text-xs uppercase tracking-widest shadow-lg flex items-center gap-1.5 animate-bounce">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    <span>{isSk ? selectedConcept.badgeSk : selectedConcept.badgeEn}</span>
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
                    {isSk ? selectedConcept.titleSk : selectedConcept.titleEn}
                  </h2>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="px-3 py-1 rounded-xl bg-neutral-900/80 border border-white/10 text-emerald-400 text-xs font-black flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5" />
                      CTR ~{selectedConcept.ctrScore}%
                    </span>
                    <span className="px-3 py-1 rounded-xl bg-neutral-900/80 border border-white/10 text-neutral-300 text-xs font-bold">
                      YouTube / TikTok 16:9
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-neutral-500 text-sm font-bold uppercase tracking-wider">
                  {isSk ? "Kliknite na 'Generovať 3 AI Koncepty'" : "Click 'Generate 3 AI Concepts'"}
                </div>
              )}
            </div>

            {/* Action Bar inside Preview */}
            <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
              <button
                onClick={() => selectedConcept && copyToClipboard(isSk ? selectedConcept.titleSk : selectedConcept.titleEn)}
                className="p-2.5 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-white border border-white/10 backdrop-blur-md transition-all shadow-lg"
                title={isSk ? "Kopírovať názov" : "Copy Title"}
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                onClick={() => showToast(isSk ? "Miniatúra exportovaná!" : "Thumbnail exported!")}
                className="p-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-lg flex items-center gap-1.5 text-xs font-black uppercase tracking-wider"
              >
                <Download className="h-4 w-4" />
                <span>{isSk ? "Stiahnuť" : "Export"}</span>
              </button>
            </div>
          </div>

          {/* AI Insights & Metrics */}
          <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                <h4 className="text-xs font-black text-white uppercase tracking-wider">AI Clickbait Analysis</h4>
              </div>
              <span className="text-[10px] font-bold text-neutral-500 uppercase">Optimized for Algorithmic Reach</span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              {isSk
                ? "Tieto koncepty využívajú psychologické triggery zvedavosti, vysoký kontrast farieb a krátke 3-slovné nadpisy pre maximalizáciu prekliknutia (CTR) na YouTube a TikToku."
                : "These concepts leverage curiosity triggers, high color contrast, and concise 3-word titles to maximize click-through rate (CTR) on YouTube & TikTok."}
            </p>
          </div>
        </div>

        {/* Right Concepts List */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <h4 className="text-xs font-black text-neutral-400 uppercase tracking-widest px-1">
            {isSk ? "Dostupné AI Koncepty" : "Available AI Concepts"} ({project.concepts.length})
          </h4>

          <div className="flex flex-col gap-3">
            {project.concepts.map((concept) => (
              <motion.div
                key={concept.id}
                whileHover={{ scale: 1.01 }}
                onClick={() => handleSelectConcept(concept)}
                className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col gap-3 ${
                  selectedConcept?.id === concept.id
                    ? "bg-amber-600/10 border-amber-500/50 shadow-xl shadow-amber-600/10"
                    : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-lg bg-neutral-800 text-amber-400 text-[10px] font-black uppercase tracking-wider">
                    {isSk ? concept.badgeSk : concept.badgeEn}
                  </span>
                  <div className="flex items-center gap-1.5 text-emerald-400 font-black text-xs">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>+{concept.ctrScore}% CTR</span>
                  </div>
                </div>

                <div>
                  <h5 className="text-sm font-black text-white uppercase tracking-tight">
                    {isSk ? concept.titleSk : concept.titleEn}
                  </h5>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-neutral-800/60">
                  <span className="text-[10px] text-neutral-500 font-bold uppercase">
                    Theme: {concept.bgTheme}
                  </span>
                  {selectedConcept?.id === concept.id && (
                    <span className="flex items-center gap-1 text-xs font-black text-amber-400 uppercase">
                      <CheckCircle2 className="h-4 w-4" />
                      {isSk ? "Aktívny" : "Active"}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from "react";
import {
  Share2,
  Sparkles,
  Youtube,
  Instagram,
  Linkedin,
  FileText,
  Headphones,
  Copy,
  Check,
  Download,
  ArrowRight,
  TrendingUp,
  Layers,
  Zap,
  ExternalLink,
  Eye,
  Sliders
} from "lucide-react";
import { ContentGraphArtifact, ContentGraphManifest, ContentNodeType } from "../types";

interface ContentGraphStudioProps {
  language: "sk" | "en";
  showToast: (msg: string, type?: "success" | "info" | "warning") => void;
  videoTitle?: string;
  videoDuration?: number;
}

const INITIAL_ARTIFACTS: ContentGraphArtifact[] = [
  {
    id: "art-1",
    nodeType: "YOUTUBE_LONGFORM",
    title: "Master YouTube Cut (16:9 4K)",
    platform: "YouTube",
    aspectRatio: "16:9",
    durationSeconds: 742,
    hookStrengthScore: 94,
    status: "READY",
    summary: "Kompletné video s kapitolami, dynamic punch zoomami a optimalizovaným audiom (-14 LUFS).",
    contentPayload: {
      headline: "Ako vybudovať virálny video workflow za menej ako 15 minút (OmniStrih Guide)",
      captionDraft: "V tomto videu si krok po kroku ukážeme, ako prejsť od neupraveného RAW záznamu k finálnemu 4K exportu pripravenému na publikáciu bez hodín manuálneho strihania ticha a nastavovania titulkov.",
      timestamps: [
        { time: "00:00", label: "Úvod a Hook: Prečo starý strih zabíja retenciu" },
        { time: "01:15", label: "Automatický strih ticha a odstraňovanie výplňových slov" },
        { time: "04:30", label: "Smart B-Roll a dynamické punch zoomy" },
        { time: "08:45", label: "Profesionálny mastering zvuku a titulkovanie" },
        { time: "11:50", label: "Zhrnutie a exportný checklist" },
      ],
      suggestedHashtags: ["#VideoEditing", "#ContentCreator", "#YouTubeGrowth", "#OmniStrih"],
      thumbnailPrompt: "Close-up of expressive creator looking at high-tech holographic timeline with text '10x FASTER EDIT'",
    },
  },
  {
    id: "art-2",
    nodeType: "VIRAL_SHORT",
    title: "Viral Short #1: Najväčšia chyba pri strihu (9:16)",
    platform: "TikTok",
    aspectRatio: "9:16",
    durationSeconds: 42,
    hookStrengthScore: 98,
    status: "READY",
    summary: "Extrémne dynamický výsek zameraný na prvých 3.2 sekundy s kinetickými karaoke titulkami.",
    contentPayload: {
      headline: "Nikdy nestrihaj ticho ručne v roku 2026 🤯",
      scriptSnippet: "Ak stále tráviš hodiny označovaním medzier v zvuku na časovej osi, okrádaš sa o čas. Pozri sa, ako to OmniStrih urobí za 3 sekundy...",
      suggestedHashtags: ["#shorts", "#editingtips", "#creatorhack", "#fyp"],
      captionDraft: "Zastav manuálne mazanie ticha! ✂️ Pozri si tento jednoduchý trik, ktorý ti ušetrí 5 hodín týždenne.",
    },
  },
  {
    id: "art-3",
    nodeType: "VIRAL_SHORT",
    title: "Viral Short #2: Zvukový Mastering Trik (9:16)",
    platform: "Instagram Reels",
    aspectRatio: "9:16",
    durationSeconds: 34,
    hookStrengthScore: 91,
    status: "READY",
    summary: "Rýchly tip na odstránenie hluku z mikrofónu a 80Hz rumble filter.",
    contentPayload: {
      headline: "Tvoje video nikto nedopozerá kvôli zlému zvuku 🎧",
      scriptSnippet: "Nemusíš kupovať 500-eurový mikrofón. Stačí zapnúť 80Hz high-pass a sidechain ducking v OmniStrih...",
      suggestedHashtags: ["#reels", "#audiohacks", "#videotips", "#omnistrih"],
      captionDraft: "Tajomstvo kryštálového zvuku pre tvoje Reels bez drahého štúdia! 🎙️",
    },
  },
  {
    id: "art-4",
    nodeType: "LINKEDIN_CAROUSEL",
    title: "LinkedIn Thought-Leadership Carousel (10 Slides)",
    platform: "LinkedIn",
    aspectRatio: "4:5",
    status: "READY",
    summary: "Štruktúrovaná prezentácia s kľúčovými dátami a krokmi pripravená na PDF export.",
    contentPayload: {
      headline: "5 krokov, ako škálovať produkciu video obsahu bez najímania agentúry",
      keyTakeaways: [
        "Slide 1: Prečo manuálny strih blokuje rast firmy",
        "Slide 2: Pravidlo 3 sekúnd pre udržanie pozornosti (Hook DNA)",
        "Slide 3: Ako funguje automatický sidechain ducking pre čistý hlas",
        "Slide 4: Content Repurposing Matrix: 1 RAW = 7 Formátov",
        "Slide 5: Finálny checklist pred publikáciou",
      ],
      fullMarkdown: `# 5 Lekcií z Produkcie 100+ Videí
1. **Rýchlosť je nová kvalita**: Kto publikuje 4x rýchlejšie s 90% kvalitou, vyhráva distribúciu.
2. **Zvuk tvorí 50% vizuálu**: Diváci odpustia 1080p, ale neodpustia šum a kolísajúcu hlasitosť.
3. **Pravidlo jedného RAW**: Každé natočené video musí žiť na minimálne 4 platformách.`,
      captionDraft: "Ako sme skrátili čas editácie o 78% a znásobili zásah na sociálnych sieťach. Kompletný breakdown v galérii 👇",
    },
  },
  {
    id: "art-5",
    nodeType: "NEWSLETTER_DIGEST",
    title: "Newsletter & Blog Digest (Markdown)",
    platform: "Substack",
    aspectRatio: "Text/Markdown",
    status: "READY",
    summary: "Kompletný článok s citáciami, kľúčovými bodmi a výzvou k akcii.",
    contentPayload: {
      headline: "OmniStrih Týždenník: Ako moderní tvorcovia škálujú produkciu obsahu",
      fullMarkdown: `## Ahoj tvorcovia,\n\nTento týždeň sme sa v najnovšom videu pozreli na to, ako odstrániť najnudnejšiu časť tvorby – manuálne strihanie ticha a titulkovanie.\n\n### Kľúčové zistenia:\n- **Algoritmus uprednostňuje retenciu**: Prvých 5 sekúnd rozhoduje o 80% organického dosahu.\n- **Automatizovaný B-Roll**: Kontextové prestrihy zvyšujú priemernú dobu pozerania o 34%.\n\nPrečítajte si celý návod a vyskúšajte šablónu vo svojom editore.`,
      captionDraft: "Nový newsletter je vonku! Zhrnutie najlepších postupov pre video produkciu.",
    },
  },
  {
    id: "art-6",
    nodeType: "PODCAST_AUDIO_CUT",
    title: "Podcast Master Cut (-16 LUFS)",
    platform: "Spotify / Apple",
    aspectRatio: "Audio Only",
    durationSeconds: 710,
    status: "READY",
    summary: "Čistá zvuková stopa bez vizuálnych odkazov, optimalizovaná pre podcastové platformy.",
    contentPayload: {
      headline: "Epizóda 42: Budúcnosť video editačných workflowov",
      captionDraft: "Počúvajte novú epizódu na Spotify a Apple Podcasts. Preberáme automatizáciu strihu a optimalizáciu tvorby.",
    },
  },
];

export const ContentGraphStudio: React.FC<ContentGraphStudioProps> = ({
  language,
  showToast,
  videoTitle = "RAW Master Source",
  videoDuration = 742,
}) => {
  const isSk = language === "sk";
  const [artifacts, setArtifacts] = useState<ContentGraphArtifact[]>(INITIAL_ARTIFACTS);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string>("art-1");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const selectedArtifact = artifacts.find((a) => a.id === selectedArtifactId) || artifacts[0];

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    showToast(isSk ? "Skopírované do schránky" : "Copied to clipboard", "success");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getPlatformIcon = (platform: ContentGraphArtifact["platform"]) => {
    switch (platform) {
      case "YouTube":
        return <Youtube className="w-4 h-4 text-red-400" />;
      case "TikTok":
      case "Instagram Reels":
        return <Instagram className="w-4 h-4 text-pink-400" />;
      case "LinkedIn":
        return <Linkedin className="w-4 h-4 text-blue-400" />;
      case "Substack":
        return <FileText className="w-4 h-4 text-amber-400" />;
      case "Spotify / Apple":
        return <Headphones className="w-4 h-4 text-emerald-400" />;
      default:
        return <Share2 className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <div className="space-y-6 text-neutral-100">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-neutral-950 border border-neutral-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              {isSk ? "Content Graph (1 RAW Video → Kompletný Content Pack)" : "Content Graph (1 RAW Video → Full Content Pack)"}
            </h2>
            <p className="text-xs text-neutral-400">
              {isSk
                ? "Z jedného RAW záznamu okamžite vygeneruje YouTube Master, 2x Viral Shorts, LinkedIn Carousel, Newsletter a Podcast stopu."
                : "Instantly transforms a single master RAW cut into YouTube longform, 2x Viral Shorts, LinkedIn carousel, newsletter, and podcast."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-neutral-800/80 border border-neutral-700 text-xs font-mono text-neutral-300">
            <span className="text-neutral-500">{isSk ? "Potenciálny zásah:" : "Reach Multiplier:"}</span>{" "}
            <strong className="text-purple-400 font-bold">5.8x</strong>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-purple-500/20 border border-purple-500/40 text-xs font-mono text-purple-300 font-bold">
            {artifacts.length} {isSk ? "Formátov pripravených" : "Artifacts Ready"}
          </div>
        </div>
      </div>

      {/* Main Grid: Left side artifacts list, Right side detail preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Artifacts Selection */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              {isSk ? "Vygenerované Formáty" : "Generated Multi-Pack Formats"}
            </span>
            <span className="text-[11px] text-neutral-500 font-mono">
              1 RAW ({Math.round(videoDuration / 60)} min)
            </span>
          </div>

          <div className="space-y-2">
            {artifacts.map((art) => {
              const isSelected = art.id === selectedArtifactId;
              return (
                <button
                  key={art.id}
                  onClick={() => setSelectedArtifactId(art.id)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                    isSelected
                      ? "bg-neutral-800 border-purple-500 ring-1 ring-purple-500/40 shadow-lg shadow-purple-500/10"
                      : "bg-neutral-900/70 border-neutral-800 hover:bg-neutral-850 hover:border-neutral-700"
                  }`}
                >
                  <div className="p-2 rounded-xl bg-neutral-950 border border-neutral-800 shrink-0 mt-0.5">
                    {getPlatformIcon(art.platform)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-neutral-200 truncate">{art.title}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-neutral-400">
                        {art.aspectRatio}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 line-clamp-1">{art.summary}</p>
                    {art.hookStrengthScore && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[10px] text-neutral-500">Hook DNA:</span>
                        <div className="w-16 h-1 bg-neutral-950 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-cyan-400"
                            style={{ width: `${art.hookStrengthScore}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-purple-300 font-bold">
                          {art.hookStrengthScore}%
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Artifact Inspector */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-neutral-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {selectedArtifact.platform} • {selectedArtifact.aspectRatio}
                  </span>
                  {selectedArtifact.durationSeconds && (
                    <span className="text-xs font-mono text-neutral-400">
                      ⏱️ {Math.floor(selectedArtifact.durationSeconds / 60)}:
                      {String(selectedArtifact.durationSeconds % 60).padStart(2, "0")}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-neutral-100">{selectedArtifact.title}</h3>
                <p className="text-xs text-neutral-400">{selectedArtifact.summary}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const fullText = JSON.stringify(selectedArtifact.contentPayload, null, 2);
                    copyToClipboard(fullText, "full_json");
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 transition-colors"
                >
                  {copiedField === "full_json" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {isSk ? "Kopírovať všetko" : "Copy All"}
                </button>
              </div>
            </div>

            {/* Content Fields */}
            <div className="space-y-3 text-xs">
              {/* Headline */}
              {selectedArtifact.contentPayload.headline && (
                <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-neutral-400">
                    <span className="font-semibold">{isSk ? "Optimalizovaný Nadpis (Title)" : "Optimized Headline / Hook"}</span>
                    <button
                      onClick={() => copyToClipboard(selectedArtifact.contentPayload.headline!, "headline")}
                      className="text-neutral-500 hover:text-neutral-200 p-1"
                    >
                      {copiedField === "headline" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-neutral-100">
                    {selectedArtifact.contentPayload.headline}
                  </p>
                </div>
              )}

              {/* Timestamps (for YouTube longform) */}
              {selectedArtifact.contentPayload.timestamps && (
                <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-neutral-400">
                    <span className="font-semibold">{isSk ? "Kapitoly a Časové Značky (Timestamps)" : "Chapters & Timestamps"}</span>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          selectedArtifact.contentPayload.timestamps!
                            .map((t) => `${t.time} - ${t.label}`)
                            .join("\n"),
                          "timestamps"
                        )
                      }
                      className="text-neutral-500 hover:text-neutral-200 p-1"
                    >
                      {copiedField === "timestamps" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <div className="space-y-1 font-mono text-[11px] text-neutral-300">
                    {selectedArtifact.contentPayload.timestamps.map((t, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-purple-400 font-bold">{t.time}</span>
                        <span className="text-neutral-400">—</span>
                        <span>{t.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Script / Captions / Markdown */}
              {selectedArtifact.contentPayload.scriptSnippet && (
                <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-neutral-400">
                    <span className="font-semibold">{isSk ? "Skript & Kinetický Hook" : "Script & Kinetic Hook"}</span>
                    <button
                      onClick={() => copyToClipboard(selectedArtifact.contentPayload.scriptSnippet!, "script")}
                      className="text-neutral-500 hover:text-neutral-200 p-1"
                    >
                      {copiedField === "script" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <p className="text-neutral-300 italic">"{selectedArtifact.contentPayload.scriptSnippet}"</p>
                </div>
              )}

              {selectedArtifact.contentPayload.captionDraft && (
                <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-neutral-400">
                    <span className="font-semibold">{isSk ? "Návrh Popisu na Sociálne Siete" : "Social Media Caption Draft"}</span>
                    <button
                      onClick={() => copyToClipboard(selectedArtifact.contentPayload.captionDraft!, "caption")}
                      className="text-neutral-500 hover:text-neutral-200 p-1"
                    >
                      {copiedField === "caption" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <p className="text-neutral-300 whitespace-pre-line">
                    {selectedArtifact.contentPayload.captionDraft}
                  </p>
                </div>
              )}

              {selectedArtifact.contentPayload.fullMarkdown && (
                <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1 font-mono text-[11px]">
                  <div className="flex items-center justify-between text-[11px] text-neutral-400 font-sans">
                    <span className="font-semibold">{isSk ? "Kompletný Markdown Text" : "Full Markdown Body"}</span>
                    <button
                      onClick={() => copyToClipboard(selectedArtifact.contentPayload.fullMarkdown!, "markdown")}
                      className="text-neutral-500 hover:text-neutral-200 p-1"
                    >
                      {copiedField === "markdown" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <pre className="text-neutral-300 bg-neutral-900/60 p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap">
                    {selectedArtifact.contentPayload.fullMarkdown}
                  </pre>
                </div>
              )}

              {/* Hashtags */}
              {selectedArtifact.contentPayload.suggestedHashtags && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {selectedArtifact.contentPayload.suggestedHashtags.map((h, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-neutral-800 border border-neutral-700 text-neutral-300 text-[10px] font-mono"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

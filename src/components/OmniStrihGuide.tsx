import React from "react";
import {
  Wand2,
  CheckCircle2,
  Sparkles,
  Zap,
  Volume2,
  TrendingUp,
  Scissors,
  Layers,
  Flame,
  Type,
  Maximize2,
  ExternalLink,
  ShieldCheck,
  Play,
  RotateCcw,
} from "lucide-react";

interface OmniStrihGuideProps {
  onApplyFullOmniStrih: () => void;
  isProcessing: boolean;
  language: "sk" | "en";
}

export const OmniStrihGuide: React.FC<OmniStrihGuideProps> = ({
  onApplyFullOmniStrih,
  isProcessing,
  language,
}) => {
  const isSk = language === "sk";

  const steps = [
    {
      num: "01",
      title: isSk ? "3-sekundový Háčik (Viral Hook)" : "3-Second Viral Hook",
      desc: isSk
        ? "Žiadne úvody 'Ahojte'. Okamžitý úderný text na obrazovke, 808 sub-bass boom a dynamický punch-in zoom na tvár."
        : "No boring intros. Instant bold hook banner, 808 boom bass impact, and immediate punch-in camera zoom.",
      icon: Flame,
      color: "text-rose-400 bg-rose-500/10 border-rose-500/30",
    },
    {
      num: "02",
      title: isSk ? "Vystrihnutie ticha (Jump-Cuts)" : "Silence Removal (Jump-Cuts)",
      desc: isSk
        ? "Eliminácia všetkých páuz dlhších ako 0.3s. Žiadne 'ehm' ani nádychy — kadencia reči je 100% plynulá a rýchla."
        : "Automatic removal of all dead air over 0.3s. High-energy cadence keeps viewer retention peaked.",
      icon: Scissors,
      color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    },
    {
      num: "03",
      title: isSk ? "Submagic Karaoke Titulky" : "Submagic Karaoke Captions",
      desc: isSk
        ? "Maximálne 2-4 slová naraz. Žlté a zelené dynamické vysvecovanie kľúčových slov, čierny pill a vyskakujúce emoji."
        : "2-4 words per line. High-contrast yellow/green karaoke word highlight with animated contextual emojis.",
      icon: Type,
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    },
    {
      num: "04",
      title: isSk ? "B-Roll & Papierová Koláž (Editorial)" : "Editorial B-Roll & Collage",
      desc: isSk
        ? "Vkladanie taktilných grafík (grafy rastu, peniaze, polaroidy a novinové titulky) každé 3 sekundy pre reset dopamínu."
        : "Tactile cutaway graphics, growth charts, polaroids and newspaper banners resetting viewer dopamine.",
      icon: Layers,
      color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
    },
    {
      num: "05",
      title: isSk ? "VN Speed Ramping & Mikrootrasy" : "VN Speed Ramp & Camera Shake",
      desc: isSk
        ? "Krivka rýchlosti (Curve Velocity) zrýchľuje pasáže a jemný screen shake na úderoch dodáva hmatateľnú energiu."
        : "Velocity curve ramping speeding through transitions with subtle impulse screen shakes on punches.",
      icon: Zap,
      color: "text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/30",
    },
    {
      num: "06",
      title: isSk ? "Vrstvený Zvukový Dizajn (SFX)" : "Layered Sound Design (SFX)",
      desc: isSk
        ? "Synchronizácia zvukov: Whoosh na prechodoch, Pop na slovách, Cash pri hodnote a Ding na dôležitých faktoch."
        : "Synchronized zero-cost audio cues: Whoosh on cuts, Pop on keywords, Cash on value, Ding on insights.",
      icon: Volume2,
      color: "text-teal-400 bg-teal-500/10 border-teal-500/30",
    },
    {
      num: "07",
      title: isSk ? "Opus Virality Audit (98/100)" : "Opus Virality Audit (98/100)",
      desc: isSk
        ? "Umelá inteligencia overí skóre virality, tempo a vygeneruje pútavý nadpis a hashtagy pre TikTok a Reels."
        : "AI verifies pacing, hook retention score, and auto-generates hashtags and post captions.",
      icon: TrendingUp,
      color: "text-amber-300 bg-amber-400/10 border-amber-400/30",
    },
  ];

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 sm:p-5 shadow-xl text-xs">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-['Fraunces'] text-base sm:text-lg font-bold text-white">
              {isSk ? "OmniStrih™ Postup & Architektúra" : "OmniStrih™ Workflow & Masterclass"}
            </span>
            <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-black text-rose-300 border border-rose-500/40">
              {isSk ? "aiktivista.sk metodika" : "aiktivista.sk recipe"}
            </span>
          </div>
          <p className="text-neutral-400 text-xs mt-0.5">
            {isSk
              ? "Presný postup tvorby virálnych krátkych videí s 95% úsporou času a 0€ nákladmi."
              : "Step-by-step masterclass to craft viral shorts with 95% time savings and $0 cost."}
          </p>
        </div>

        <button
          onClick={onApplyFullOmniStrih}
          disabled={isProcessing}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500 bg-size-200 px-4 py-2 text-xs font-bold text-neutral-950 shadow-lg shadow-rose-500/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
        >
          <Wand2 className={`h-4 w-4 ${isProcessing ? "animate-spin" : ""}`} />
          <span>
            {isProcessing
              ? isSk
                ? "Spracúvam OmniStrih..."
                : "Applying OmniCut..."
              : isSk
              ? "Spustiť Plný OmniStrih (1-Klik)"
              : "Run Full OmniCut (1-Click)"}
          </span>
        </button>
      </div>

      {/* 0€ Guarantee Badge */}
      <div className="rounded-xl border border-emerald-800/80 bg-emerald-950/30 p-3 flex items-start gap-2.5">
        <ShieldCheck className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-emerald-300">
            {isSk ? "100% Zadarmo bez predplatného" : "100% Free Without Subscriptions"}
          </span>
          <p className="text-emerald-400/80 text-[11px] mt-0.5">
            {isSk
              ? "Bežný editor minie 50€/mes na Submagic + 25€ na CapCut + 30€ na OpusClip. OmniStrih robí všetko lokálne v prehliadači za 0€."
              : "Standard editors spend $100+/mo on Submagic, CapCut Pro & OpusClip. OmniStrih executes everything locally for $0."}
          </p>
        </div>
      </div>

      {/* Step by Step Breakdown */}
      <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.num}
              className="flex items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-950/60 p-3 hover:border-neutral-700 transition-all"
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg border font-mono font-bold text-xs flex-shrink-0 ${step.color}`}
              >
                {step.num}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-neutral-300" />
                  <span className="font-bold text-white text-xs">{step.title}</span>
                </div>
                <p className="text-neutral-400 text-[11px] mt-1 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Link to aiktivista article reference */}
      <div className="flex items-center justify-between pt-2 border-t border-neutral-800 text-[11px] text-neutral-400">
        <span>
          {isSk
            ? "Inšpirované OmniStrih postupom (Tomáš Jevčik / Aiktivista)"
            : "Inspired by OmniStrih workflow (Tomáš Jevčik / Aiktivista)"}
        </span>
        <a
          href="https://aiktivista.sk/omnistrih.html"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-rose-400 hover:text-rose-300 font-semibold"
        >
          <span>aiktivista.sk/omnistrih.html</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
};

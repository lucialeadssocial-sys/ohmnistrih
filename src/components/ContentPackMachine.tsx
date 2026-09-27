import React from "react";
import { 
  Box, 
  Zap, 
  Sparkles, 
  Flame, 
  Video, 
  FileText, 
  Share2, 
  Download, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  Smartphone, 
  Youtube, 
  Instagram, 
  Twitter, 
  Linkedin,
  Copy,
  Tag,
  ArrowRight,
  Info,
  Trophy,
  Rocket
} from "lucide-react";
import { 
  ContentPack, 
  ContentClip, 
  SocialAsset 
} from "../types";
import { motion, AnimatePresence } from "motion/react";

interface ContentPackMachineProps {
  pack: ContentPack;
  onGenerate: () => void;
  language: "sk" | "en";
  isGenerating: boolean;
}

export const ContentPackMachine: React.FC<ContentPackMachineProps> = ({
  pack,
  onGenerate,
  language,
  isGenerating
}) => {
  const isSk = language === "sk";

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // In a real app, show a toast here
  };

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Module Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-600 text-white shadow-lg shadow-orange-600/20">
            <Box className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">CONTENT PACK MACHINE</h3>
            <p className="text-[10px] text-neutral-500 font-bold uppercase">One Video → Entire Content Ecosystem</p>
          </div>
        </div>

        <button 
          onClick={onGenerate}
          disabled={isGenerating}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-orange-600/20 disabled:opacity-50"
        >
          {isGenerating ? <TrendingUp className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
          {isGenerating ? (isSk ? "ANALYZUJEM VIRALITU..." : "ANALYZING VIRALITY...") : (isSk ? "GENEROVAŤ CONTENT PACK" : "GENERATE CONTENT PACK")}
        </button>
      </div>

      {/* Intro Context */}
      <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20 flex items-start gap-4">
         <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-400 shrink-0">
            <Sparkles className="h-5 w-5" />
         </div>
         <div>
            <p className="text-[11px] font-black text-white uppercase tracking-wider mb-1">THE "CONTENT MACHINE" STRATEGY</p>
            <p className="text-[10px] text-neutral-400 leading-relaxed italic">
               {isSk 
                 ? "AI skenuje celé video a hľadá 'High-Hook' momenty. Z jedného 30-minútového videa automaticky vytvorí kompletnú sadu pre YouTube, TikTok, Reels a LinkedIn vrátane textov a popisov."
                 : "AI scans the entire video for 'High-Hook' moments. From a single 30-minute video, it automatically creates a complete set for YouTube, TikTok, Reels, and LinkedIn, including texts and descriptions."}
            </p>
         </div>
      </div>

      {!pack.isGenerated ? (
        <div className="p-20 rounded-3xl bg-neutral-900/50 border border-neutral-800 border-dashed flex flex-col items-center text-center gap-6">
           <div className="relative">
              <div className="h-24 w-24 rounded-full bg-orange-500/5 flex items-center justify-center border border-orange-500/10">
                 <Video className="h-10 w-10 text-orange-500/40" />
              </div>
              <div className="absolute -top-2 -right-2 h-10 w-10 rounded-full bg-orange-600 flex items-center justify-center text-white shadow-xl shadow-orange-600/30">
                 <Zap className="h-5 w-5" />
              </div>
           </div>
           <div className="space-y-2">
              <h4 className="text-sm font-black text-white uppercase tracking-widest">{isSk ? "PRIPRAVENÉ NA MULTIPLIKÁCIU" : "READY FOR MULTIPLICATION"}</h4>
              <p className="text-[10px] text-neutral-500 font-bold uppercase leading-relaxed max-w-[320px]">
                {isSk ? "Vaše 30-minútové video premeníme na 15+ kúskov unikátneho obsahu." : "We will turn your 30-minute video into 15+ pieces of unique content."}
              </p>
           </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           {/* Left: Viral Clips (8 cols) */}
           <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center justify-between px-1">
                 <h4 className="text-[12px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    {isSk ? "DETEGOVANÉ VIRÁLNE KLIPY" : "DETECTED VIRAL CLIPS"}
                 </h4>
                 <span className="text-[10px] font-black text-orange-400 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20 uppercase tracking-widest">
                    {pack.clips.length} {isSk ? "KLIPOV" : "CLIPS"}
                 </span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                 {pack.clips.map((clip, idx) => (
                   <motion.div 
                     key={clip.id}
                     initial={{ opacity: 0, x: -20 }}
                     animate={{ opacity: 1, x: 0 }}
                     transition={{ delay: idx * 0.1 }}
                     className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-orange-500/30 transition-all group"
                   >
                      <div className="flex gap-5">
                         <div className="w-32 h-44 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col items-center justify-center relative overflow-hidden group-hover:border-orange-500/50 transition-all shrink-0">
                            <Smartphone className="h-8 w-8 text-neutral-800 group-hover:text-orange-500/20 transition-all" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                            <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10">
                               <Trophy className="h-2.5 w-2.5 text-yellow-500" />
                               <span className="text-[9px] font-black text-white">#{idx + 1}</span>
                            </div>
                            <div className="absolute bottom-2 left-0 right-0 text-center">
                               <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest">{(clip.endTime - clip.startTime).toFixed(0)}s CLIP</span>
                            </div>
                         </div>

                         <div className="flex-1 space-y-4">
                            <div className="flex items-center justify-between">
                               <div className="flex items-center gap-3">
                                  <div className="px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-[9px] font-black text-orange-400 uppercase tracking-tighter">
                                     HOOK SCORE: {clip.viralityScore}%
                                  </div>
                                  <div className="flex items-center gap-1.5 text-neutral-500">
                                     <Clock className="h-3 w-3" />
                                     <span className="text-[10px] font-bold tracking-widest">{clip.startTime}s - {clip.endTime}s</span>
                                  </div>
                               </div>
                            </div>

                            <div className="space-y-1">
                               <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">VIRAL HOOK</p>
                               <p className="text-sm font-bold text-white italic leading-relaxed">
                                  "{isSk ? clip.hookSk : clip.hookEn}"
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                               {clip.platformOptimized.map(p => (
                                 <div key={p} className="p-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white transition-all">
                                    {p === "YOUTUBE" && <Youtube className="h-3.5 w-3.5" />}
                                    {p === "TIKTOK" && <Smartphone className="h-3.5 w-3.5" />}
                                    {p === "REELS" && <Instagram className="h-3.5 w-3.5" />}
                                    {p === "SHORTS" && <Zap className="h-3.5 w-3.5 text-rose-500" />}
                                 </div>
                               ))}
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                               <button className="flex-1 py-2 rounded-xl bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 transition-all">
                                  {isSk ? "UPRAVIŤ KLIP" : "EDIT CLIP"}
                               </button>
                               <button className="px-4 py-2 rounded-xl bg-neutral-800 text-white text-[10px] font-black uppercase tracking-widest hover:bg-neutral-700 transition-all">
                                  <Download className="h-4 w-4" />
                               </button>
                            </div>
                         </div>
                      </div>
                   </motion.div>
                 ))}
              </div>
           </div>

           {/* Right: Marketing Assets (4 cols) */}
           <div className="lg:col-span-5 space-y-6">
              <div className="flex items-center justify-between px-1">
                 <h4 className="text-[12px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <FileText className="h-4 w-4 text-neutral-500" />
                    {isSk ? "MARKETINGOVÉ ASSETY" : "MARKETING ASSETS"}
                 </h4>
              </div>

              {/* YouTube Pack */}
              <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-5">
                 <div className="flex items-center gap-3 pb-3 border-b border-neutral-800">
                    <Youtube className="h-5 w-5 text-rose-600" />
                    <span className="text-[11px] font-black text-white uppercase tracking-widest">YouTube Master Pack</span>
                 </div>

                 <div className="space-y-4">
                    <div className="space-y-1.5">
                       <div className="flex items-center justify-between">
                          <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Viral Title</label>
                          <button onClick={() => copyToClipboard(isSk ? pack.marketingData.ytTitleSk : pack.marketingData.ytTitleEn)} className="p-1 text-neutral-600 hover:text-white transition-all"><Copy className="h-3 w-3" /></button>
                       </div>
                       <p className="text-xs font-bold text-white bg-neutral-950 p-3 rounded-xl border border-neutral-800 leading-relaxed">
                          {isSk ? pack.marketingData.ytTitleSk : pack.marketingData.ytTitleEn}
                       </p>
                    </div>

                    <div className="space-y-1.5">
                       <div className="flex items-center justify-between">
                          <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Thumbnail Text</label>
                          <button onClick={() => copyToClipboard(isSk ? pack.marketingData.thumbnailTextSk : pack.marketingData.thumbnailTextEn)} className="p-1 text-neutral-600 hover:text-white transition-all"><Copy className="h-3 w-3" /></button>
                       </div>
                       <div className="bg-orange-600/10 border border-orange-500/20 p-3 rounded-xl">
                          <p className="text-xs font-black text-orange-400 uppercase italic text-center tracking-tighter">
                             {isSk ? pack.marketingData.thumbnailTextSk : pack.marketingData.thumbnailTextEn}
                          </p>
                       </div>
                    </div>

                    <div className="space-y-1.5">
                       <div className="flex items-center justify-between">
                          <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Smart Description</label>
                          <button onClick={() => copyToClipboard(isSk ? pack.marketingData.ytDescriptionSk : pack.marketingData.ytDescriptionEn)} className="p-1 text-neutral-600 hover:text-white transition-all"><Copy className="h-3 w-3" /></button>
                       </div>
                       <div className="text-[10px] font-bold text-neutral-400 bg-neutral-950 p-4 rounded-xl border border-neutral-800 leading-relaxed h-32 overflow-y-auto custom-scrollbar italic">
                          {isSk ? pack.marketingData.ytDescriptionSk : pack.marketingData.ytDescriptionEn}
                       </div>
                    </div>
                 </div>
              </div>

              {/* Social Posts */}
              <div className="space-y-4">
                 <div className="flex items-center justify-between px-1">
                    <h4 className="text-[11px] font-black text-neutral-500 uppercase tracking-widest">SOCIAL MULTIPLIER</h4>
                 </div>

                 {pack.assets.map((asset, idx) => (
                   <motion.div 
                     key={asset.id}
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ delay: 0.5 + idx * 0.1 }}
                     className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4"
                   >
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-neutral-800 flex items-center justify-center text-white">
                               {asset.platform === "TIKTOK" && <Smartphone className="h-4 w-4" />}
                               {asset.platform === "LINKEDIN" && <Linkedin className="h-4 w-4" />}
                               {asset.platform === "TWITTER" && <Twitter className="h-4 w-4" />}
                            </div>
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">{asset.platform} POST</span>
                         </div>
                         <button onClick={() => copyToClipboard(isSk ? asset.contentSk : asset.contentEn)} className="p-2 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white transition-all">
                            <Copy className="h-3.5 w-3.5" />
                         </button>
                      </div>

                      <p className="text-[10px] font-bold text-neutral-400 leading-relaxed italic">
                         {isSk ? asset.contentSk : asset.contentEn}
                      </p>

                      <div className="flex flex-wrap gap-1.5">
                         {asset.hashtags.map(tag => (
                           <span key={tag} className="text-[9px] font-black text-orange-500/70">{tag}</span>
                         ))}
                      </div>

                      <div className="pt-2 flex items-center gap-2">
                         <div className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-black text-emerald-400 uppercase tracking-widest">CTA: {isSk ? asset.ctaSk : asset.ctaEn}</div>
                      </div>
                   </motion.div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* Global Actions Footer */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/80 backdrop-blur-xl p-4 rounded-3xl border border-white/10 shadow-2xl z-50">
         <button className="flex items-center gap-3 px-8 py-3 rounded-2xl bg-orange-600 text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-orange-600/30 hover:bg-orange-500 transition-all active:scale-95">
            <Download className="h-5 w-5" />
            {isSk ? "STIAHNUŤ CELÝ BALÍK" : "DOWNLOAD FULL PACK"}
         </button>
         <button className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-neutral-800 text-white text-[11px] font-black uppercase tracking-[0.2em] hover:bg-neutral-700 transition-all active:scale-95 border border-white/5">
            <Share2 className="h-5 w-5" />
            {isSk ? "ZDIELAŤ TÍMU" : "SHARE WITH TEAM"}
         </button>
      </div>
    </div>
  );
};

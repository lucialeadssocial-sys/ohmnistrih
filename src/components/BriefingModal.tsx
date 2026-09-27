import React, { useState } from "react";
import { Sparkles, X, ChevronRight, Check } from "lucide-react";

export interface BriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: "sk" | "en";
  onConfirm: (brief: any) => void;
}

export const BriefingModal: React.FC<BriefingModalProps> = ({ isOpen, onClose, language, onConfirm }) => {
  const isSk = language === "sk";
  const [brief, setBrief] = useState({
    contentType: "Reel",
    objective: "Retention",
    audience: "General",
    platform: "TikTok",
    style: "Fast"
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl text-neutral-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-black text-white">{isSk ? "AI Director Briefing" : "AI Director Briefing"}</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white"><X className="w-5 h-5"/></button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-neutral-500 uppercase">{isSk ? "Typ Obsahu" : "Content Type"}</label>
            <select className="w-full mt-1 bg-neutral-950 border border-neutral-800 p-2 rounded-lg text-xs" 
                    value={brief.contentType} onChange={e => setBrief({...brief, contentType: e.target.value})}>
              <option>Reel</option><option>TikTok</option><option>YouTube</option>
            </select>
          </div>
          
          <button 
            onClick={() => onConfirm(brief)}
            className="w-full mt-6 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            {isSk ? "Spustiť analýzu" : "Run Analysis"}
          </button>
        </div>
      </div>
    </div>
  );
};

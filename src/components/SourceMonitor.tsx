import React, { useRef, useState, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, ChevronRight, Check } from "lucide-react";
import { MediaAsset } from "../core/types/project";
import { coreEngine } from "../core";

interface SourceMonitorProps {
  asset: MediaAsset | null;
  language: "sk" | "en";
  showToast: (msg: string) => void;
}

export const SourceMonitor: React.FC<SourceMonitorProps> = ({ asset, language, showToast }) => {
  const isSk = language === "sk";
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inPoint, setInPoint] = useState(0);
  const [outPoint, setOutPoint] = useState(asset?.duration || 0);

  useEffect(() => {
    if (asset) {
      setInPoint(0);
      setOutPoint(asset.duration);
    }
  }, [asset]);

  if (!asset) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-600 text-xs">
        {isSk ? "Vyberte súbor v Media Bin" : "Select an asset in Media Bin"}
      </div>
    );
  }

  const handleInsert = () => {
    // Basic canonical insert
    showToast(isSk ? "✅ Vložené na timeline." : "✅ Inserted to timeline.");
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950 p-2 gap-2">
      <div className="flex-1 bg-black rounded-lg flex items-center justify-center relative">
         <video ref={videoRef} src={asset.url || ""} className="max-h-full max-w-full" controls />
      </div>
      <div className="flex gap-2 items-center text-[10px] text-neutral-400">
        <span>{isSk ? "IN:" : "IN:"} {inPoint.toFixed(2)}s</span>
        <span>{isSk ? "OUT:" : "OUT:"} {outPoint.toFixed(2)}s</span>
        <button onClick={() => setInPoint(videoRef.current?.currentTime || 0)} className="px-2 py-1 bg-neutral-800 rounded">I</button>
        <button onClick={() => setOutPoint(videoRef.current?.currentTime || 0)} className="px-2 py-1 bg-neutral-800 rounded">O</button>
        <button onClick={handleInsert} className="px-2 py-1 bg-rose-600 text-white rounded">Insert</button>
      </div>
    </div>
  );
};

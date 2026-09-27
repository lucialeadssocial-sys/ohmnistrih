import React from "react";

export const ToolSuspenseFallback: React.FC<{ isSk?: boolean; label?: string }> = ({ isSk = true, label }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[240px] w-full rounded-2xl bg-neutral-900/60 border border-neutral-800 text-neutral-400 gap-3 animate-pulse">
      <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-mono font-medium tracking-wide">
        {label || (isSk ? "Pripravujem nástroj…" : "Preparing tool…")}
      </span>
    </div>
  );
};

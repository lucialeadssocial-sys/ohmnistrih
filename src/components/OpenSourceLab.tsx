import React from "react";

export const OpenSourceLab: React.FC = () => {
  const research = [
    { name: "Mediabunny", status: "USED", license: "MIT", why: "Core media architecture" },
    { name: "Web Animations API", status: "USED", license: "Native", why: "Performant UI animations" },
    { name: "Lottie-web", status: "ADAPT", license: "MIT", why: "Complex vector animation support" },
    { name: "OpenTimelineIO", status: "CONCEPT", license: "Apache 2.0", why: "Timeline interchange models" },
    { name: "WebCodecs/Audio", status: "USED", license: "Native", why: "Browser-native processing" },
    { name: "Shotcut/Kdenlive", status: "CONCEPT", license: "GPL", why: "Editing workflow concepts" },
    { name: "Remotion", status: "REJECTED", license: "MIT", why: "Duplicate rendering" }
  ];

  return (
    <div className="p-4 text-neutral-100 h-full overflow-auto">
      <h2 className="text-sm font-black mb-4">🧩 OPEN SOURCE LAB</h2>
      {research.map(r => (
        <div key={r.name} className="mb-4 p-3 bg-neutral-900 rounded border border-neutral-800">
          <h3 className="text-xs font-bold text-white">{r.name}</h3>
          <p className="text-[10px] text-neutral-400">Status: {r.status}</p>
          <p className="text-[10px] text-neutral-300">Why: {r.why}</p>
        </div>
      ))}
    </div>
  );
};

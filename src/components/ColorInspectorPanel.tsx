import React from 'react';
import { ClipModel } from '../core/types/project';

export const ColorInspectorPanel: React.FC<{ clip: ClipModel }> = ({ clip }) => {
  return (
    <div className="p-4 bg-neutral-900 border border-neutral-800 rounded text-[10px] text-white">
      <h3 className="font-bold mb-2">COLOR INSPECTOR: {clip.name}</h3>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-neutral-800 p-2 rounded">Exposure: {clip.colorCorrection?.exposure ?? 0}</div>
        <div className="bg-neutral-800 p-2 rounded">Contrast: {clip.colorCorrection?.contrast ?? 0}</div>
        <div className="bg-neutral-800 p-2 rounded">Temp: {clip.colorCorrection?.temperature ?? 6500}</div>
        <div className="bg-neutral-800 p-2 rounded">Sat: {clip.colorCorrection?.saturation ?? 100}</div>
      </div>
      <div className="mt-4 h-24 bg-black rounded border border-neutral-700 flex items-end">
        {/* Simplified Histogram visualization */}
        {clip.colorAnalysis?.histogram?.luminance.slice(0, 50).map((val, i) => (
            <div key={i} className="flex-1 bg-white" style={{ height: `${val}%` }} />
        ))}
      </div>
      <p className="text-[9px] text-neutral-500 mt-2">Technical Correction | Creative Look</p>
    </div>
  );
};

import React, { useState, Suspense, lazy } from 'react';
import { Sparkles, Mic, Image, Music, Zap, Layers } from 'lucide-react';

const CreativeHubUI = () => {
  const [activeTool, setActiveTool] = useState<string | null>(null);

  const tools = [
    { id: 'broll', name: 'B-Roll Generator', icon: Layers },
    { id: 'voice', name: 'Voiceover Studio', icon: Mic },
    { id: 'image', name: 'Image Studio', icon: Image },
    { id: 'sfx', name: 'SFX Generator', icon: Music },
  ];

  return (
    <div className="h-full bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-white">
      <h2 className="text-sm font-black mb-4">AI CREATIVE HUB</h2>
      <div className="grid grid-cols-2 gap-2">
        {tools.map(tool => (
          <button 
            key={tool.id} 
            onClick={() => setActiveTool(tool.id)}
            className="flex items-center gap-2 p-3 bg-neutral-950 hover:bg-neutral-800 rounded border border-neutral-800 text-xs"
          >
            <tool.icon className="w-4 h-4" />
            {tool.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export const CreativeHubPanel = () => (
  <Suspense fallback={<div>Loading Creative Hub...</div>}>
    <CreativeHubUI />
  </Suspense>
);

import React from 'react';
import { ClipModel } from '../core/types/project';
import { coreEngine } from '../core';
import { SetEQCommand } from '../core/command/commandSystem';

export const AudioInspectorPanel: React.FC<{ clip: ClipModel }> = ({ clip }) => {
  const handleEqToggle = () => {
    const newConfig = { 
      enabled: !clip.audioEffects?.eq?.enabled,
      lowShelf: { freq: 100, gain: 0 },
      mid: { freq: 1000, gain: 0, q: 1 },
      highShelf: { freq: 10000, gain: 0 },
      bypass: false
    };
    coreEngine.commandManager.executeCommand(new SetEQCommand(clip.id, newConfig));
  };

  return (
    <div className="p-4 bg-neutral-900 border border-neutral-800 rounded text-[10px] text-white">
      <h3 className="font-bold mb-2">AUDIO INSPECTOR: {clip.name}</h3>
      <button onClick={handleEqToggle} className="p-2 bg-neutral-800 rounded">
        EQ: {clip.audioEffects?.eq?.enabled ? 'ON' : 'OFF'}
      </button>
    </div>
  );
};

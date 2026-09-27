import React, { useState } from 'react';
import { ClipModel, Keyframe } from '../core/types/project';
import { coreEngine } from '../core';
import { SetTransformCommand, UpdateKeyframeCommand, RemoveKeyframeCommand, UpdateClipPropsCommand } from '../core/command/commandSystem';
import { Settings, Play, Plus, Trash2, Zap, BookOpen } from 'lucide-react';

export const MotionInspectorPanel: React.FC<{ clip: ClipModel }> = ({ clip }) => {
  const [activeParam, setActiveParam] = useState<'scale' | 'opacity' | 'positionX' | 'positionY' | 'rotation'>('scale');

  const applyPreset = (type: string) => {
    let cmd: SetTransformCommand | null = null;
    let description = '';
    
    if (type === 'punchIn') {
      description = 'Apply Punch-In';
      cmd = new SetTransformCommand(description, clip.id, { scale: 115 });
    } else if (type === 'pop') {
      description = 'Apply Pop';
      cmd = new SetTransformCommand(description, clip.id, { scale: 110 });
    } else if (type === 'reset') {
      description = 'Reset Transform';
      cmd = new SetTransformCommand(description, clip.id, { scale: 100, positionX: 0, positionY: 0, rotation: 0, opacity: 100 });
    } else if (type === 'wobble') {
      description = 'Add Wobble';
      const k1: Keyframe = { id: crypto.randomUUID(), timeOffset: 0, parameter: 'rotation', value: 0, easing: 'easeInOut' };
      const k2: Keyframe = { id: crypto.randomUUID(), timeOffset: 0.5, parameter: 'rotation', value: 5, easing: 'easeInOut' };
      const k3: Keyframe = { id: crypto.randomUUID(), timeOffset: 1.0, parameter: 'rotation', value: 0, easing: 'easeInOut' };
      
      coreEngine.commandManager.executeCommand(new UpdateKeyframeCommand('Add Wobble K1', clip.id, k1));
      coreEngine.commandManager.executeCommand(new UpdateKeyframeCommand('Add Wobble K2', clip.id, k2));
      coreEngine.commandManager.executeCommand(new UpdateKeyframeCommand('Add Wobble K3', clip.id, k3));
    } else if (type === 'kinetic-zoom') {
      description = 'Kinetic Zoom';
      const k1: Keyframe = { id: crypto.randomUUID(), timeOffset: 0, parameter: 'scale', value: 100, easing: 'easeOut' };
      const k2: Keyframe = { id: crypto.randomUUID(), timeOffset: 2.0, parameter: 'scale', value: 150, easing: 'easeOut' };
      coreEngine.commandManager.executeCommand(new UpdateKeyframeCommand('Kinetic Zoom Start', clip.id, k1));
      coreEngine.commandManager.executeCommand(new UpdateKeyframeCommand('Kinetic Zoom End', clip.id, k2));
    }

    if (cmd) {
      coreEngine.commandManager.executeCommand(cmd);
    }

    // Update Learning Brain
    if (description) {
      coreEngine.commandManager.executeCommand(new UpdateClipPropsCommand('Log Motion Pref', clip.id, {
        learningMeta: {
          what: `Applied Preset: ${description}`,
          why: 'User preference for specific motion behavior.',
          how: `Preset type: ${type}`,
          when: 'Now',
          category: 'MOTION'
        }
      } as any));
    }
  };

  const addKeyframeAtPlayhead = () => {
    const playhead = coreEngine.commandManager.getProject().playheadTime;
    const offset = Math.max(0, playhead - clip.timelineStart);
    
    // Get current value
    const currentValue = (clip as any)[activeParam] ?? (activeParam === 'opacity' || activeParam === 'scale' ? 100 : 0);

    const k: Keyframe = {
      id: crypto.randomUUID(),
      timeOffset: offset,
      parameter: activeParam as any,
      value: currentValue,
      easing: 'easeInOut'
    };

    if (coreEngine.commandManager.executeCommand(new UpdateKeyframeCommand(`Add ${activeParam} Keyframe`, clip.id, k))) {
      // Log custom keyframe action to brain
      coreEngine.commandManager.executeCommand(new UpdateClipPropsCommand('Log Manual Keyframe', clip.id, {
        learningMeta: {
          what: `Added Manual Keyframe: ${activeParam}`,
          why: 'User is manually refining motion curves.',
          how: `Value: ${currentValue} at ${offset.toFixed(2)}s`,
          when: 'Now',
          category: 'MOTION'
        }
      } as any));
    }
  };

  const removeKeyframe = (id: string) => {
    coreEngine.commandManager.executeCommand(new RemoveKeyframeCommand('Remove Keyframe', clip.id, id));
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-neutral-900 border border-neutral-800 rounded text-[10px] text-white">
      <div className="flex justify-between items-center">
        <h3 className="font-black text-rose-500 flex items-center gap-2">
          <Settings className="w-3 h-3" /> MOTION GRAPHICS STUDIO
        </h3>
        <button className="text-neutral-500 hover:text-white transition-colors">
          <BookOpen className="w-3 h-3" />
        </button>
      </div>

      {/* Presets */}
      <section>
        <p className="text-[9px] text-neutral-500 mb-2 uppercase font-bold tracking-widest">Presets</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => applyPreset('punchIn')} className="p-2 bg-neutral-850 border border-neutral-800 rounded hover:bg-neutral-800 transition-colors flex items-center gap-2">
            <Zap className="w-2 h-2 text-yellow-500" /> Punch-In
          </button>
          <button onClick={() => applyPreset('pop')} className="p-2 bg-neutral-850 border border-neutral-800 rounded hover:bg-neutral-800 transition-colors flex items-center gap-2">
            <Zap className="w-2 h-2 text-rose-500" /> Pop
          </button>
          <button onClick={() => applyPreset('wobble')} className="p-2 bg-neutral-850 border border-neutral-800 rounded hover:bg-neutral-800 transition-colors flex items-center gap-2">
            <Zap className="w-2 h-2 text-blue-500" /> Wobble
          </button>
          <button onClick={() => applyPreset('kinetic-zoom')} className="p-2 bg-neutral-850 border border-neutral-800 rounded hover:bg-neutral-800 transition-colors flex items-center gap-2">
            <Zap className="w-2 h-2 text-emerald-500" /> Kinetic Zoom
          </button>
          <button onClick={() => applyPreset('reset')} className="p-2 bg-rose-950/30 border border-rose-900/50 text-rose-400 rounded hover:bg-rose-900/50 transition-colors col-span-2">
            Reset
          </button>
        </div>
      </section>

      {/* Keyframe Editor */}
      <section className="bg-neutral-950 rounded border border-neutral-800 p-2">
        <div className="flex justify-between items-center mb-2">
          <select 
            value={activeParam} 
            onChange={(e) => setActiveParam(e.target.value as any)}
            className="bg-transparent border-none focus:ring-0 text-rose-400 font-bold p-0"
          >
            <option value="scale">Scale</option>
            <option value="opacity">Opacity</option>
            <option value="positionX">Pos X</option>
            <option value="positionY">Pos Y</option>
            <option value="rotation">Rotation</option>
          </select>
          <button 
            onClick={addKeyframeAtPlayhead}
            className="p-1 bg-neutral-800 rounded hover:bg-neutral-700 text-green-500"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <div className="space-y-1 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
          {clip.keyframes
            .filter(k => k.parameter === activeParam)
            .map(k => (
              <div key={k.id} className="flex justify-between items-center p-1 bg-neutral-900 border border-neutral-800 rounded group">
                <span className="text-neutral-400">{k.timeOffset.toFixed(2)}s</span>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    value={k.value}
                    onChange={(e) => {
                      coreEngine.commandManager.executeCommand(new UpdateKeyframeCommand('Update Keyframe Value', clip.id, { ...k, value: Number(e.target.value) }));
                    }}
                    className="w-10 bg-neutral-800 border-none rounded text-right p-0 focus:ring-0"
                  />
                  <button 
                    onClick={() => removeKeyframe(k.id)}
                    className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-rose-500 transition-opacity"
                  >
                    <Trash2 className="w-2 h-2" />
                  </button>
                </div>
              </div>
            ))}
          {clip.keyframes.filter(k => k.parameter === activeParam).length === 0 && (
            <p className="text-center text-neutral-600 py-4 italic">No keyframes for {activeParam}</p>
          )}
        </div>
      </section>

      <div className="p-2 bg-blue-900/10 border border-blue-900/30 rounded flex items-start gap-2">
        <Play className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" />
        <div>
          <p className="font-bold text-blue-400">AI MOTION INSIGHT</p>
          <p className="text-[9px] text-neutral-400 leading-tight">
            Use a 0.2s "Ease-In-Out" for professional organic feel. Avoid linear motion for non-technical subjects.
          </p>
        </div>
      </div>
    </div>
  );
};

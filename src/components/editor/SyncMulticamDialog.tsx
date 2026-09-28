import React, { useState } from 'react';
import { useCoreProject, coreEngine } from '../../core';
import { MediaAsset } from '../../core/types/project';
import { Layers, Check, X, Wand2, Music, Clock, Settings2 } from 'lucide-react';

/**
 * Cross-correlates two real waveform envelopes and returns the lag in seconds.
 *
 * The waveforms come from the media engine (one bucket per audio window), so the offset is
 * measured from actual audio instead of being guessed. Returns null when data is unusable.
 */
function estimateOffsetSeconds(
  reference: number[],
  target: number[],
  referenceDuration: number
): number | null {
  if (reference.length < 8 || target.length < 8) return null;

  const maxLag = Math.min(reference.length, target.length) - 1;
  let bestLag = 0;
  let bestScore = -Infinity;

  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < reference.length; i++) {
      const j = i + lag;
      if (j < 0 || j >= target.length) continue;
      sum += reference[i] * target[j];
      count++;
    }
    if (count < 8) continue;
    const score = sum / count;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  const bucketToSeconds = referenceDuration > 0 ? referenceDuration / reference.length : 0;
  return Number((bestLag * bucketToSeconds).toFixed(3));
}

export const SyncMulticamDialog: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { project } = useCoreProject();
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [syncMethod, setSyncMethod] = useState<'waveform' | 'timecode' | 'manual'>('waveform');
  const [groupName, setGroupName] = useState('New Multicam Group');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncReport, setSyncReport] = useState<{
    ok: boolean;
    method?: 'waveform' | 'timecode' | 'manual';
    verified?: boolean;
    offsets?: Record<string, number>;
    messageSk: string;
    messageEn: string;
  } | null>(null);

  if (!isOpen) return null;

  const toggleAsset = (id: string) => {
    setSelectedAssetIds(prev => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const handleSync = () => {
    setIsSyncing(true);
    setSyncReport(null);

    // Resolve the REAL clips that reference the selected assets — no synthetic clip ids.
    const allClips = project.tracks.flatMap(t => t.clips);
    const selectedClips = allClips.filter(c => c.assetId && selectedAssetIds.includes(c.assetId));

    if (selectedClips.length < 2) {
      setIsSyncing(false);
      setSyncReport({
        ok: false,
        messageSk: "Na časovej osi nie sú aspoň 2 klipy z vybraných médií — najprv ich pridajte na timeline.",
        messageEn: "The timeline has fewer than 2 clips from the selected media — add them to the timeline first.",
      });
      return;
    }

    const assets = selectedAssetIds
      .map(id => project.assets.find(a => a.id === id))
      .filter((a): a is NonNullable<typeof a> => !!a);

    const angleOffsets: Record<string, number> = {};
    let effectiveMethod: 'waveform' | 'timecode' | 'manual' = syncMethod;
    let verified = false;
    let noteSk = "";
    let noteEn = "";

    if (syncMethod === "waveform") {
      const reference = assets[0];
      const referenceWave = reference?.waveformData || [];
      const canCorrelate = referenceWave.length >= 8 && assets.length > 1;

      if (canCorrelate && reference) {
        assets.slice(1).forEach(asset => {
          const offset = estimateOffsetSeconds(referenceWave, asset.waveformData || [], reference.duration);
          if (offset !== null) angleOffsets[asset.id] = offset;
        });
        verified = Object.keys(angleOffsets).length > 0;
        noteSk = verified
          ? `Offsety vypočítané z reálnych waveformov (referencia: ${reference.name}).`
          : "Waveformy nemajú dosť vzoriek na koreláciu.";
        noteEn = verified
          ? `Offsets computed from real waveform data (reference: ${reference.name}).`
          : "Waveforms do not have enough samples for correlation.";
      } else {
        effectiveMethod = "manual";
        noteSk = "Waveformy nie sú v projekte k dispozícii → skupina vznikne s manuálnym zarovnaním (offset 0).";
        noteEn = "No waveform data available in the project → the group is created with manual alignment (offset 0).";
      }
    } else if (syncMethod === "timecode") {
      // The project stores no timecode metadata — do not pretend the angles were aligned.
      effectiveMethod = "manual";
      noteSk = "Zdrojové súbory nemajú uložený timecode → skupina vznikne s manuálnym zarovnaním (offset 0).";
      noteEn = "The source files carry no timecode metadata → the group is created with manual alignment (offset 0).";
    } else {
      noteSk = "Manuálne zarovnanie: offsety zostávajú 0 a nastavíte ich ručne.";
      noteEn = "Manual alignment: offsets stay 0 and are adjusted by hand.";
    }

    const ok = coreEngine.syncMulticam(
      selectedClips.map(c => c.id),
      groupName,
      effectiveMethod,
      angleOffsets,
      verified
    );

    setIsSyncing(false);
    setSyncReport({
      ok,
      method: effectiveMethod,
      verified,
      offsets: angleOffsets,
      messageSk: noteSk,
      messageEn: noteEn,
    });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-rose-500/10 rounded-lg text-rose-500 border border-rose-500/20">
               <Layers className="w-5 h-5" />
             </div>
             <div>
               <h2 className="text-lg font-black text-white uppercase tracking-tight">Create Multicam Group</h2>
               <p className="text-xs text-zinc-500 font-medium">Select angles and choose synchronization method</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Asset Selection */}
          <div className="space-y-3">
             <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Source Angles (Assets)</label>
             <div className="grid grid-cols-2 gap-2">
                {project.assets.map(asset => (
                  <button
                    key={asset.id}
                    onClick={() => toggleAsset(asset.id)}
                    className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                      selectedAssetIds.includes(asset.id)
                        ? 'bg-rose-500/5 border-rose-500/50 ring-1 ring-rose-500/20'
                        : 'bg-zinc-950/50 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="w-12 h-12 bg-zinc-900 rounded-lg overflow-hidden shrink-0 border border-zinc-800">
                       <img src={`https://picsum.photos/seed/${asset.id}/100/100`} className="w-full h-full object-cover opacity-60" />
                    </div>
                    <div className="flex-1 min-w-0">
                       <div className="text-[11px] font-bold text-zinc-200 truncate">{asset.name}</div>
                       <div className="text-[9px] text-zinc-500 font-mono uppercase">{asset.width}x{asset.height} • {asset.fps}fps</div>
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                      selectedAssetIds.includes(asset.id) ? 'bg-rose-500 border-rose-500 text-white' : 'border-zinc-800'
                    }`}>
                       {selectedAssetIds.includes(asset.id) && <Check className="w-3 h-3" />}
                    </div>
                  </button>
                ))}
                {project.assets.length === 0 && (
                   <div className="col-span-2 py-10 text-center border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-950/30">
                      <p className="text-zinc-600 text-xs">No assets available. Import media first.</p>
                   </div>
                )}
             </div>
          </div>

          {/* Sync Settings */}
          <div className="grid grid-cols-2 gap-6 pt-4 border-t border-zinc-800">
             <div className="space-y-3">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Sync Method</label>
                <div className="space-y-2">
                   {[
                     { id: 'waveform', icon: Music, label: 'Audio Waveform', desc: 'Auto-sync using audio' },
                     { id: 'timecode', icon: Clock, label: 'Timecode', desc: 'Use embedded metadata' },
                     { id: 'manual', icon: Settings2, label: 'Manual Marker', desc: 'Sync using sync-points' }
                   ].map(method => (
                     <button
                       key={method.id}
                       onClick={() => setSyncMethod(method.id as any)}
                       className={`w-full p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                         syncMethod === method.id
                           ? 'bg-indigo-500/5 border-indigo-500/50 ring-1 ring-indigo-500/20'
                           : 'bg-zinc-950/50 border-zinc-800 hover:border-zinc-700'
                       }`}
                     >
                       <method.icon className={`w-4 h-4 ${syncMethod === method.id ? 'text-indigo-400' : 'text-zinc-600'}`} />
                       <div>
                          <div className="text-[11px] font-bold text-zinc-200">{method.label}</div>
                          <div className="text-[9px] text-zinc-500">{method.desc}</div>
                       </div>
                     </button>
                   ))}
                </div>
             </div>

             <div className="space-y-4">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Group Name</label>
                   <input 
                     type="text"
                     value={groupName}
                     onChange={e => setGroupName(e.target.value)}
                     className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:border-rose-500 outline-none"
                   />
                </div>
                
                <div className="p-4 bg-amber-950/10 border border-amber-900/30 rounded-xl space-y-2">
                   <div className="flex items-center gap-2 text-amber-500">
                      <Wand2 className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-black uppercase tracking-widest">AI Intelligence</span>
                   </div>
                   <p className="text-[10px] text-zinc-400 leading-relaxed italic">
                     "Waveform sync is the most reliable method for UGC and smartphone footage where timecode might be inconsistent."
                   </p>
                </div>
             </div>
          </div>
        </div>

        {/* Real sync result — method, offsets and whether they came from analysis */}
        {syncReport && (
          <div className={`px-5 py-3 border-t text-[11px] font-bold space-y-1 ${
            syncReport.ok
              ? (syncReport.verified ? "bg-emerald-950/30 border-emerald-900/40 text-emerald-300" : "bg-amber-950/30 border-amber-900/40 text-amber-200")
              : "bg-rose-950/30 border-rose-900/40 text-rose-300"
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border border-current/40">
                {syncReport.ok
                  ? (syncReport.verified ? "OFFSETS MEASURED" : "MANUAL (offset 0)")
                  : "SYNC NOT PERFORMED"}
              </span>
              {syncReport.method && <span className="font-mono text-[10px] opacity-80">method: {syncReport.method}</span>}
            </div>
            <div>{syncReport.messageSk} / {syncReport.messageEn}</div>
            {syncReport.offsets && Object.keys(syncReport.offsets).length > 0 && (
              <div className="font-mono text-[10px] opacity-80">
                {Object.entries(syncReport.offsets).map(([assetId, off]) => `${assetId.slice(0, 10)}… → ${off}s`).join("  •  ")}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="p-5 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between">
           <span className="text-[10px] font-mono text-zinc-500 uppercase">
              {selectedAssetIds.length} Angles Selected
           </span>
           <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2 text-zinc-400 hover:text-white text-xs font-bold transition-colors">
                {syncReport?.ok ? "Close" : "Cancel"}
              </button>
              <button 
                onClick={handleSync}
                disabled={selectedAssetIds.length < 2 || isSyncing}
                className="px-6 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-xs font-bold rounded-lg transition-all shadow-xl shadow-rose-600/20 flex items-center gap-2"
              >
                {isSyncing ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Analyzing Waveforms...
                  </>
                ) : (
                  <>
                    <Layers className="w-3.5 h-3.5" />
                    Generate Multicam Group
                  </>
                )}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

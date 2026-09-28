import React, { useEffect, useMemo, useState } from 'react';
import { useCoreProject, coreEngine } from '../../core';
import { TimelineEngine } from '../../core/timeline/timelineEngine';
import { mediaEngineV1 } from '../../core/media-engine';
import { opfsManager } from '../../core/storage/opfs';
import { usePlayheadTime, playheadStore } from '../../core/playback/playheadStore';
import { Scissors, ArrowLeftRight, Move, SquareSplitVertical, Maximize2, MousePointer2, ImageOff } from 'lucide-react';

type TrimMode = 'ripple' | 'roll' | 'slip' | 'slide';

/**
 * Advanced Trim Studio.
 *
 * Every operation maps to a canonical command (ripple trim / roll / slip / slide) and reports what
 * really happened — including rejections (non-adjacent clips, no source material left, minimum
 * duration). The two preview windows show real frames decoded from the clip media, or an explicit
 * "no preview" placeholder when the media is not available locally.
 */
export const AdvancedTrimmingUI: React.FC = () => {
  const { project } = useCoreProject();
  const playheadTime = usePlayheadTime();
  const [trimMode, setTrimMode] = useState<TrimMode>('ripple');
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [appliedDelta, setAppliedDelta] = useState(0);
  const [outgoingThumb, setOutgoingThumb] = useState<string | null>(null);
  const [incomingThumb, setIncomingThumb] = useState<string | null>(null);
  const [thumbNotice, setThumbNotice] = useState<string | null>(null);

  const fps = project.settings?.fps || 30;
  const frameStep = 1 / fps;

  /** Clips sorted by time on every track, so the trim tools can reason about neighbours. */
  const sortedTracks = useMemo(
    () =>
      project.tracks.map(track => ({
        track,
        clips: [...track.clips].sort((a, b) => (a.timelineStart ?? a.start ?? 0) - (b.timelineStart ?? b.start ?? 0)),
      })),
    [project.tracks]
  );

  /** The clip under the playhead (fallback: first video clip) — this is what gets trimmed. */
  const selection = useMemo(() => {
    for (const { track, clips } of sortedTracks) {
      const hit = clips.find(
        c => playheadTime >= (c.timelineStart ?? c.start ?? 0) && playheadTime < (c.timelineStart ?? c.start ?? 0) + c.duration
      );
      if (hit) return { track, clip: hit, fromPlayhead: true };
    }
    const videoTrack = sortedTracks.find(t => t.track.type === 'video') || sortedTracks[0];
    if (videoTrack?.clips.length) return { track: videoTrack.track, clip: videoTrack.clips[0], fromPlayhead: false };
    return null;
  }, [sortedTracks, playheadTime]);

  /** Neighbours of the selected clip on its track (used by the roll edit). */
  const neighbours = useMemo(() => {
    if (!selection) return { previous: null, next: null };
    const clips = sortedTracks.find(t => t.track.id === selection.track.id)?.clips || [];
    const idx = clips.findIndex(c => c.id === selection.clip.id);
    return {
      previous: idx > 0 ? clips[idx - 1] : null,
      next: idx >= 0 && idx < clips.length - 1 ? clips[idx + 1] : null,
    };
  }, [selection, sortedTracks]);

  /** Real frames for the two preview windows (decoded from the clip media, not stock images). */
  useEffect(() => {
    let cancelled = false;

    const resolveThumb = async (clipId?: string, at?: (clip: any) => number): Promise<string | null> => {
      if (!clipId) return null;
      const clip = project.tracks.flatMap(t => t.clips).find(c => c.id === clipId);
      if (!clip?.assetId) return null;
      const asset = project.assets.find(a => a.id === clip.assetId || a.assetId === clip.assetId);
      if (!asset) return null;

      let source: File | string | null = null;
      try {
        source = await opfsManager.getFile(asset.opfsPath);
      } catch {
        source = null;
      }
      if (!source && asset.url) source = asset.url;
      if (!source) return null;

      const sourceTime = at ? at(clip) : TimelineEngine.timelineToSourceTime(clip, clip.timelineStart);
      const thumb = await mediaEngineV1.getThumbnail(asset.id, source as File | string, Math.max(0, sourceTime));
      return thumb || null;
    };

    void (async () => {
      const outgoingClip = neighbours.previous || selection?.clip;
      const incomingClip = selection?.clip || neighbours.next;

      const outgoing = await resolveThumb(
        outgoingClip?.id,
        clip => TimelineEngine.timelineToSourceTime(clip, (clip.timelineStart ?? clip.start ?? 0) + Math.max(0, clip.duration - frameStep))
      );
      const incoming = await resolveThumb(incomingClip?.id, clip => TimelineEngine.timelineToSourceTime(clip, clip.timelineStart ?? clip.start ?? 0));

      if (cancelled) return;
      setOutgoingThumb(outgoing);
      setIncomingThumb(incoming);
      setThumbNotice(
        outgoing || incoming
          ? null
          : 'Náhľad nie je k dispozícii — médium klipu nie je lokálne (OPFS/URL) alebo sa nedá dekódovať.'
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [project.tracks, project.assets, neighbours.previous, neighbours.next, selection, frameStep]);

  const handleTrim = (delta: number) => {
    if (!selection) {
      setResultMessage('Na timeline nie je žiadny klip — nie je čo trimovať.');
      return;
    }

    const clip = selection.clip;

    switch (trimMode) {
      case 'ripple': {
        const ok = coreEngine.trimClip(clip.id, 'right', delta, true);
        // Ripple trim of the last clip has nothing to ripple, so a plain trim is the honest fallback.
        const okPlain = ok || coreEngine.trimClip(clip.id, 'right', delta, false);
        setResultMessage(
          okPlain
            ? `Ripple trim aplikovaný (${delta > 0 ? '+' : ''}${delta.toFixed(3)}s na výstupnej hrane).`
            : 'Ripple trim zamietnutý — klip by bol kratší než minimum alebo nemá zdrojový materiál.'
        );
        if (okPlain) setAppliedDelta(prev => prev + delta);
        break;
      }
      case 'roll': {
        // Roll moves the cut point between this clip and its neighbour.
        const edge: 'in' | 'out' = neighbours.next ? 'out' : 'in';
        const ok = coreEngine.rollClip(clip.id, edge, delta);
        const boundary = edge === 'out'
          ? `medzi „${clip.name}" a „${neighbours.next?.name}"`
          : `medzi „${neighbours.previous?.name}" a „${clip.name}"`;
        setResultMessage(
          ok
            ? `Roll strih posunutý o ${delta > 0 ? '+' : ''}${delta.toFixed(3)}s (${boundary}). Celková dĺžka projektu sa nezmenila.`
            : `Roll strih zamietnutý — ${boundary} nie je spojitý bod strihu alebo jednému z klipov chýba zdrojový materiál.`
        );
        if (ok) setAppliedDelta(prev => prev + delta);
        break;
      }
      case 'slip': {
        const ok = coreEngine.slipClip(clip.id, delta);
        setResultMessage(
          ok
            ? `Slip edit aplikovaný (${delta > 0 ? '+' : ''}${delta.toFixed(3)}s vo vnútri klipu, pozícia nezmenená).`
            : 'Slip edit zamietnutý — posun by vytiahol zdrojový materiál mimo klipu.'
        );
        if (ok) setAppliedDelta(prev => prev + delta);
        break;
      }
      case 'slide': {
        const ok = coreEngine.slideClip(clip.id, delta);
        setResultMessage(
          ok
            ? `Slide edit aplikovaný (${delta > 0 ? '+' : ''}${delta.toFixed(3)}s; susedné klipy sa prispôsobili).`
            : 'Slide edit zamietnutý — susedné klipy nemajú dostatočný zdrojový materiál.'
        );
        if (ok) setAppliedDelta(prev => prev + delta);
        break;
      }
    }
  };

  const formatDelta = (seconds: number) => {
    const frames = Math.round(seconds * fps);
    return `${frames >= 0 ? '+' : '−'}${Math.abs(frames)} fr (${seconds >= 0 ? '+' : '−'}${Math.abs(seconds).toFixed(3)}s)`;
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2 uppercase tracking-tight">
          <Scissors className="w-4 h-4 text-rose-500" /> Advanced Trim Studio
        </h3>
        <div className="flex gap-1 bg-black/40 p-1 rounded-md border border-zinc-800">
          {[
            { id: 'ripple', icon: Scissors, label: 'Ripple' },
            { id: 'roll', icon: SquareSplitVertical, label: 'Roll' },
            { id: 'slip', icon: ArrowLeftRight, label: 'Slip' },
            { id: 'slide', icon: Move, label: 'Slide' }
          ].map(mode => (
            <button
              key={mode.id}
              onClick={() => {
                setTrimMode(mode.id as TrimMode);
                setResultMessage(null);
              }}
              className={`p-1.5 rounded transition-all flex items-center gap-1.5 ${
                trimMode === mode.id ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/20' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title={mode.label}
            >
              <mode.icon className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold px-0.5">{mode.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Double view preview — real frames from the neighbouring clips */}
      <div className="grid grid-cols-2 gap-2 flex-1">
        {[{ thumb: outgoingThumb, label: `Outgoing: ${neighbours.previous?.name || selection?.clip.name || '—'}` },
          { thumb: incomingThumb, label: `Incoming: ${neighbours.next?.name || selection?.clip.name || '—'}` }].map((pane, idx) => (
          <div key={idx} className="aspect-video bg-black rounded-lg border border-zinc-800 relative group overflow-hidden">
            <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 rounded text-[9px] font-mono text-zinc-400 z-10 border border-white/10 uppercase truncate max-w-[90%]">
              {pane.label}
            </div>
            {pane.thumb ? (
              <img src={pane.thumb} alt={pane.label} className="w-full h-full object-cover opacity-80" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 text-[10px] gap-1">
                <ImageOff className="w-5 h-5" />
                <span>žiadny náhľad</span>
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-0.5 h-full bg-rose-500/50" />
            </div>
          </div>
        ))}
      </div>

      {thumbNotice && <p className="text-[10px] text-amber-400">{thumbNotice}</p>}

      {/* Selected clip + real nudge readout */}
      <div className="flex items-center justify-center gap-4 bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50">
        <div className="flex gap-1">
          <button onClick={() => handleTrim(-5 * frameStep)} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-[10px] font-bold text-zinc-400">-5 fr</button>
          <button onClick={() => handleTrim(-frameStep)} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-[10px] font-bold text-zinc-400">-1 fr</button>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-[10px] font-mono text-rose-500 font-bold mb-1 uppercase tracking-widest">{trimMode} MODE</span>
          <div className="flex items-center gap-2">
            <MousePointer2 className="w-3.5 h-3.5 text-zinc-600" />
            <span className="text-lg font-mono font-black text-white tabular-nums">{formatDelta(appliedDelta)}</span>
          </div>
          <span className="text-[10px] text-zinc-500 mt-1">
            {selection
              ? `${selection.fromPlayhead ? 'Klip pod playheadom' : 'Prvý klip na timeline'}: ${selection.clip.name} @ ${(selection.clip.timelineStart ?? selection.clip.start ?? 0).toFixed(2)}s`
              : 'Žiadny klip'}
            {' · '}playhead {playheadTime.toFixed(2)}s @ {fps} fps
          </span>
        </div>

        <div className="flex gap-1">
          <button onClick={() => handleTrim(frameStep)} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-[10px] font-bold text-zinc-400">+1 fr</button>
          <button onClick={() => handleTrim(5 * frameStep)} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-[10px] font-bold text-zinc-400">+5 fr</button>
        </div>
      </div>

      {resultMessage && (
        <div
          className={`px-3 py-2 rounded-lg text-[11px] border ${
            resultMessage.includes('zamietnutý') || resultMessage.includes('nie je')
              ? 'bg-amber-950/40 border-amber-900/60 text-amber-300'
              : 'bg-emerald-950/30 border-emerald-900/60 text-emerald-300'
          }`}
        >
          {resultMessage}
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-zinc-500">
        <span>
          {sortedTracks.reduce((sum, t) => sum + t.clips.length, 0)} klipov · trvanie projektu{' '}
          {TimelineEngine.calculateProjectDuration(project).toFixed(2)}s
        </span>
        <button
          onClick={() => playheadStore.setTime(selection ? (selection.clip.timelineStart ?? 0) : 0, true)}
          className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300"
        >
          Playhead na výstup klipu
        </button>
      </div>

      {/* Logic Explanation (Learning Gate) */}
      <div className="p-3 bg-indigo-950/10 border border-indigo-900/30 rounded-xl">
        <div className="flex items-center gap-2 mb-1.5">
          <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Editing Principle</span>
        </div>
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          {trimMode === 'ripple' && 'Ripple trim mení dĺžku celého projektu. Použi ho, keď chceš odstrániť ticho alebo chybu a chceš, aby sa zvyšok videa posunul.'}
          {trimMode === 'slip' && 'Slip edit mení vnútorné časovanie klipu bez zmeny jeho pozície alebo dĺžky na timeline. Ideálne na doladenie akcie v zábere.'}
          {trimMode === 'slide' && 'Slide edit posúva klip medzi dvoma susednými klipmi. Dĺžka vybraného klipu ostáva, menia sa dĺžky klipov pred ním a za ním.'}
          {trimMode === 'roll' && 'Roll trim mení bod strihu medzi dvoma klipmi bez zmeny celkovej dĺžky projektu. Jeden klip sa skracuje, druhý predlžuje.'}
        </p>
      </div>
    </div>
  );
};

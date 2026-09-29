import React, { useMemo, useState } from 'react';
import { Film, Play, Download, CheckSquare, Square, AlertTriangle, Loader2, Info } from 'lucide-react';
import { ShortsEngineResult, ShortsProposal } from '../core/ai/shortsEngine';

export interface ShortsCaptionState {
  transcriptSegments: number;
  captionClips: number;
  burnCaptions: boolean;
  isApplying: boolean;
  onToggleBurn?: (value: boolean) => void;
  onApply?: () => void;
  /** Per-window result of the last export run: how many captions each Short really carried. */
  lastWindows?: { window: string; captions: number; coverage: number; unsafe?: number }[];
  /** Measured placement of every caption in the vertical export frame (project-wide, live). */
  safeZone?: { measured: number; unsafe: number; frameWidth: number; frameHeight: number };
}

interface ShortsEnginePanelProps {
  result: ShortsEngineResult;
  isExporting: boolean;
  progress: { current: number; total: number; label: string } | null;
  failures: string[];
  onExport: (proposals: ShortsProposal[]) => void;
  onSeek: (start: number, end: number) => void;
  language: 'sk' | 'en';
  /** Captions burned into the export (clips on the canonical caption track, from the transcript). */
  captions?: ShortsCaptionState;
}

/**
 * Long-form → Shorts.
 *
 * Every row is a real proposal from the Shorts engine (measured hooks + the real end of the
 * material); the export renders exactly that window through the same render backends as the normal
 * export. When there is nothing measured, the panel says so instead of showing suggestions.
 *
 * The export uses the 9:16 preset with COVER reframe (the frame is filled, no black bars). Subject
 * tracking is NOT implemented, so the media stays centred — the panel states that instead of
 * promising an auto-reframe to the face.
 */
export const ShortsEnginePanel: React.FC<ShortsEnginePanelProps> = ({
  result,
  isExporting,
  progress,
  failures,
  onExport,
  onSeek,
  language,
  captions,
}) => {
  const isSk = language === 'sk';
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selected = useMemo(
    () => result.proposals.filter(p => selectedIds.includes(p.id)),
    [result.proposals, selectedIds]
  );

  const toggle = (id: string) =>
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const selectAll = () => setSelectedIds(result.proposals.map(p => p.id));
  const selectNone = () => setSelectedIds([]);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 text-white space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-fuchsia-500/10 border border-fuchsia-500/30 rounded-xl text-fuchsia-400">
            <Film className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              Long-form → Shorts
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  result.measured
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                }`}
              >
                {result.measured ? 'MERANÉ DÁTA' : 'NEMERANÉ'}
              </span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              {isSk
                ? 'Návrhy Shorts z meraných hookov — 30/45/60 s okná z reálneho materiálu.'
                : 'Shorts proposals from measured hooks — 30/45/60 s windows from real material.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={selectAll}
            disabled={result.proposals.length === 0}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-300 text-xs font-semibold rounded-lg flex items-center gap-1.5"
          >
            <CheckSquare className="w-3.5 h-3.5" /> {isSk ? 'Označiť všetko' : 'Select all'}
          </button>
          <button
            onClick={selectNone}
            disabled={selectedIds.length === 0}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-300 text-xs font-semibold rounded-lg flex items-center gap-1.5"
          >
            <Square className="w-3.5 h-3.5" /> {isSk ? 'Odznačiť' : 'Clear'}
          </button>
          <button
            onClick={() => onExport(selected)}
            disabled={isExporting || selected.length === 0}
            className="px-4 py-1.5 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg flex items-center gap-1.5"
          >
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {isSk ? `Exportovať vybrané (${selected.length})` : `Export selected (${selected.length})`}
          </button>
        </div>
      </div>

      {result.notesSk.length > 0 && (
        <ul className="space-y-0.5">
          {(isSk ? result.notesSk : result.notesEn).map(note => (
            <li key={note} className="text-[11px] text-neutral-400">
              • {note}
            </li>
          ))}
        </ul>
      )}

      {result.proposals.length === 0 && result.measured === false && (
        <div className="bg-neutral-950 border border-dashed border-neutral-700 rounded-xl p-5 text-center space-y-1">
          <AlertTriangle className="w-5 h-5 text-amber-400 mx-auto" />
          <p className="text-sm text-neutral-300 font-semibold">
            {isSk ? 'Žiadne merané hooky — Shorts sa negenerujú.' : 'No measured hooks — no Shorts are generated.'}
          </p>
          <p className="text-[11px] text-neutral-500">
            {isSk
              ? 'Spusti najprv analýzu videa (detekcia hookov). Nič sa nevymýšľa naslepo.'
              : 'Run the video analysis (hook detection) first. Nothing is invented blindly.'}
          </p>
        </div>
      )}

      {progress && (
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <span>{progress.label}</span>
            <span className="font-mono">
              {progress.current}/{progress.total}
            </span>
          </div>
          <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-fuchsia-500 transition-all"
              style={{ width: `${progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      {failures.length > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 space-y-1">
          <span className="text-[11px] font-bold text-rose-300 uppercase">
            {isSk ? 'Nepodarilo sa vyexportovať' : 'Failed to export'}
          </span>
          {failures.map((f, i) => (
            <p key={`${f}-${i}`} className="text-[11px] text-rose-200/90">
              {f}
            </p>
          ))}
        </div>
      )}

      {result.proposals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1">
          {result.proposals.map(proposal => {
            const isSelected = selectedIds.includes(proposal.id);
            return (
              <div
                key={proposal.id}
                onClick={() => toggle(proposal.id)}
                className={`cursor-pointer border rounded-xl p-3.5 space-y-2 transition ${
                  isSelected ? 'border-fuchsia-500/60 bg-fuchsia-950/20' : 'border-neutral-800 bg-neutral-950'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-fuchsia-400 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-neutral-600 shrink-0" />
                    )}
                    <span className="text-xs font-bold text-white font-mono">
                      {proposal.start}s – {proposal.end}s
                    </span>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-neutral-800 text-neutral-200">
                    {proposal.duration}s
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300">
                    {Math.round(proposal.confidence * 100)}% {isSk ? 'hook' : 'hook'}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                    {isSk ? `okno ${proposal.requestedDuration}s` : `${proposal.requestedDuration}s window`}
                  </span>
                  {proposal.containsCta && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">CTA</span>
                  )}
                  {proposal.cappedByMaterial && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300">
                      {isSk ? 'kratší než okno' : 'shorter than window'}
                    </span>
                  )}
                </div>

                <p className="text-xs text-neutral-300 line-clamp-2">{isSk ? proposal.titleSk : proposal.titleEn}</p>
                <p className="text-[10px] text-neutral-500">{isSk ? proposal.evidenceSk : proposal.evidenceEn}</p>

                <button
                  onClick={e => {
                    e.stopPropagation();
                    onSeek(proposal.start, proposal.end);
                  }}
                  className="w-full mt-1 px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3 h-3" /> {isSk ? 'Prejsť na čas' : 'Go to time'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {captions && (
        <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2" id="omnistrih-shorts-captions">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
              captions.captionClips > 0
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
            }`}>
              {captions.captionClips > 0 ? (isSk ? 'TITULKY: PRIPRAVENÉ' : 'CAPTIONS: READY') : (isSk ? 'TITULKY: BEZ PREPISU' : 'CAPTIONS: NO TRANSCRIPT')}
            </span>
            <span className="text-[11px] text-neutral-400">
              {captions.captionClips > 0
                ? (isSk
                    ? `${captions.captionClips} titulkov na časovej osi · prepis ${captions.transcriptSegments} segmentov`
                    : `${captions.captionClips} caption clips on the timeline · transcript ${captions.transcriptSegments} segments`)
                : (isSk
                    ? `Prepis reči: ${captions.transcriptSegments} segmentov · titulky sa nevypália, kým nevygenerujete prepis`
                    : `Transcript: ${captions.transcriptSegments} segments · captions are not burned until a transcript exists`)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {captions.onApply && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  captions.onApply?.();
                }}
                disabled={captions.isApplying || captions.transcriptSegments === 0}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-bold disabled:opacity-40"
                id="omnistrih-shorts-captions-apply"
              >
                {captions.isApplying
                  ? (isSk ? 'Vypaľujem titulky…' : 'Burning captions…')
                  : (isSk ? 'Vypáliť titulky z prepisu' : 'Burn captions from the transcript')}
              </button>
            )}
            {captions.onToggleBurn && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  captions.onToggleBurn?.(!captions.burnCaptions);
                }}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
                  captions.burnCaptions
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                }`}
                id="omnistrih-shorts-captions-toggle"
              >
                {isSk ? 'Titulky v exporte' : 'Captions in the export'}: {captions.burnCaptions ? (isSk ? 'ZAP' : 'ON') : (isSk ? 'VYP' : 'OFF')}
              </button>
            )}
          </div>

          {captions.safeZone && captions.safeZone.measured > 0 && (
            <div
              className={`text-[10px] ${captions.safeZone.unsafe > 0 ? 'text-amber-300' : 'text-neutral-400'}`}
              id="omnistrih-shorts-captions-safezone"
            >
              {isSk
                ? `Bezpečná zóna v ${captions.safeZone.frameWidth}×${captions.safeZone.frameHeight} exporte: ${captions.safeZone.measured - captions.safeZone.unsafe} z ${captions.safeZone.measured} titulkov v zóne${captions.safeZone.unsafe > 0 ? `, ${captions.safeZone.unsafe} mimo (spodná UI lišta platforiem)` : ''}.`
                : `Safe area in the ${captions.safeZone.frameWidth}×${captions.safeZone.frameHeight} export: ${captions.safeZone.measured - captions.safeZone.unsafe} of ${captions.safeZone.measured} captions inside${captions.safeZone.unsafe > 0 ? `, ${captions.safeZone.unsafe} outside (platform bottom UI)` : ''}.`}
            </div>
          )}

          {captions.lastWindows && captions.lastWindows.length > 0 && (
            <div className="text-[10px] text-neutral-400 space-y-0.5" id="omnistrih-shorts-captions-windows">
              {captions.lastWindows.map(item => (
                <div key={item.window} className={item.unsafe ? 'text-amber-300' : undefined}>
                  {isSk
                    ? `Okno ${item.window}: ${item.captions} titulkov · pokrytie ${Math.round(item.coverage * 100)} % okna`
                    : `Window ${item.window}: ${item.captions} captions · ${Math.round(item.coverage * 100)} % of the window covered`}
                  {item.unsafe
                    ? isSk
                      ? ` · ${item.unsafe} mimo bezpečnej zóny v 9:16 exporte`
                      : ` · ${item.unsafe} outside the safe area in the 9:16 export`
                    : ''}
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px] text-neutral-500">
            {captions.captionClips > 0
              ? (isSk
                  ? 'Titulky sú na titulkovej stope projektu (dajú sa vrátiť cez Undo). Do exportu sa vypália — kontrola kvality zároveň meria, či nezasahujú do spodnej UI zóny platforiem.'
                  : 'The captions live on the project caption track (undoable). They are burned into the export — the quality check also measures whether they reach into the bottom UI zone of the platforms.')
              : (isSk
                  ? 'Bez reálneho prepisu sa titulky nevymýšľajú. Vygenerujte titulky v štúdiu (alebo prepis reči) a potom ich vypáľte.'
                  : 'Without a real transcript captions are not invented. Generate captions in the studio (or the transcript) and then burn them in.')}
          </p>
        </div>
      )}

      <div className="flex items-start gap-2 text-[10px] text-neutral-500 border-t border-neutral-800 pt-3">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          {isSk
            ? 'Export vykresľuje presne to okno (video aj zvuk) cez render backendy a sťahuje .webm. 9:16 rám sa vyplní (cover) — žiadne čierne pruhy. Ak si predtým spustila meranie tvárí v paneli Detekcia tvárí, výrez sa posunie za nameranou tvárou; bez merania (alebo bez podpory FaceDetector API) ostáva vystredený — pozícia sa nikdy neodhaduje. Beží v prehliadači — bez prehliadača (napr. v tomto sandboxe) ho nemožno overiť, takže stav exportu ber ako neoverený, kým si ho nespustíš.'
            : 'The export renders exactly that window (video and audio) through the render backends and downloads a .webm. The 9:16 frame is filled (cover) — no black bars; face tracking is not implemented, so the composition stays centred. It runs in the browser — without a browser (e.g. in this sandbox) it cannot be verified, so treat the export result as unverified until you run it.'}
        </span>
      </div>
    </div>
  );
};

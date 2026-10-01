/**
 * Media Intelligence Index Engine
 * Provides incremental, DAG-based, cached, cancelable, and resumable local media analysis.
 *
 * POCTIVOSŤ (krok 30b): tento index v minulosti obsahoval VYMYSLENÉ dáta —
 * transcript z pevného zoznamu slov, scény pevne na 25 % a 65 % dĺžky a snímky
 * s jasom/ostrosťou zo vzorcov (`brightness = 40 + (i * 45) % 185`). Director
 * nástroje (`getScenes`, `getThumbnails`, `searchMedia`) z toho robili závery.
 *
 * Dnes platí:
 *  • MEASURED = naozaj zmerané z média (metadata, waveform zo zvuku),
 *  • DERIVED  = odvodené z meraného (beats z peakov, ticho z prahu na vlne,
 *               strihy a snímky z REÁLNYCH pixelov cez `frameMetrics.ts`),
 *  • NOT_AVAILABLE = nemáme dáta (napr. prepis, keď nie je poskytnutý) —
 *    vtedy index vráti prázdno a DÔVOD, nikdy vymyslené čísla.
 */

import { idbManager } from '../storage/idb';
import { MediaAsset } from '../types/project';
import { mediaEngineV1 } from '../media-engine';
import {
  FrameMetrics,
  SceneBoundary,
  detectSceneBoundaries,
  frameDistance,
  frameMetricsFromPixels,
  sampleTimes,
  scenesFromBoundaries,
} from './frameMetrics';
import {
  SemanticIndex,
  SemanticMatch,
  buildSemanticIndex,
  findRedundantSegments,
  type SemanticEmbeddingFn,
} from './semanticSegments';

export interface DuplicateShot {
  shot1Timestamp: number;
  shot2Timestamp: number;
  similarityScore: number; // 0 to 1
}

export interface RepresentativeFrame {
  timestamp: number;
  thumbnailUrl: string;
  brightness: number; // 0 to 255 (namerané z pixelov)
  blurScore: number;   // ostrosť = priemerná sila hrán (namerané z pixelov)
  colorVector: number[];
  /** Histogram jasu (8 pásem) z nameraných pixelov — podklad pre porovnanie záberov. */
  lumaHistogram?: number[];
  /** Zmenšený raster jasu (32×18) — priestorové porovnanie záberov. */
  grayThumb?: number[];
  isBestShot?: boolean;
  isDuplicate?: boolean;
  isBlurry?: boolean;
  isVeryDark?: boolean;
  isStatic?: boolean;
  isSceneChange?: boolean;
  isHookCandidate?: boolean;
  isBRollCandidate?: boolean;
  similarFrameTimestamps?: number[];
}

/** Odkiaľ je daný údaj v indexe. */
export type DataQuality = 'MEASURED' | 'DERIVED' | 'NOT_AVAILABLE';

export interface MediaAnalysisIndex {
  assetId: string;
  assetHash: string;
  updatedAt: number;

  /** Kvalita dát pre každý uzol — aby UI ani Director netvrdili viac, než vieme. */
  dataQuality: Record<string, DataQuality>;
  /** Prečo údaj chýba (slovensky), keď je `NOT_AVAILABLE`. */
  unavailableSk: Record<string, string>;
  /** Koľko snímok sa naozaj prečítalo (0 = obrazová analýza neprebehla). */
  framesAnalysed: number;

  // Task Cache Manifest
  completedTasks: Record<string, { completedAt: number; version: number }>;

  // 1. Basic Metadata
  duration: number;
  resolution: { width: number; height: number; aspectRatio: string };
  fps: number;
  hasAudio: boolean;
  sampleRate?: number;
  channels?: number;

  // 2. Audio & Waveform Analysis
  waveformPeaks: number[];
  audioPeaks: { timestamp: number; volumeDb: number }[];
  beatPositions: number[];

  // 3. Silence & Speech (VAD)
  silentRanges: { start: number; end: number; duration: number }[];
  speechRanges: { start: number; end: number; duration: number }[];

  // 4. Transcript
  transcriptText: string;
  wordTimestamps: { word: string; start: number; end: number; confidence: number }[];

  // 5. Scenes & Scene Boundaries
  sceneBoundaries: { timestamp: number; score: number }[];
  scenes: { id: string; start: number; end: number; duration: number }[];

  // 6. Visual Analysis
  representativeFrames: RepresentativeFrame[];
  averageBrightness: number;
  averageBlurScore: number;

  // 7. Visual Similarity & Duplicates
  duplicateShots: DuplicateShot[];

  // 8. Sémantika (krok 1) — porovnanie VÝZNAMU viet, nie počtu slov.
  //    Prázdne + `dataQuality.semantic_units = NOT_AVAILABLE`, keď nie je
  //    prepis alebo lokálny embedding model. Nič sa nedomýšľa.
  semanticUnits: SemanticIndex['segments'];
  semanticRedundancy: SemanticMatch[];
}

export type InvalidationTag = 'file' | 'transcript' | 'crop' | 'audio';

export interface DAGTaskNode {
  id: string;
  name: string;
  deps: string[];
  version: number;
  invalidatesOn: InvalidationTag[];
  execute: (
    asset: MediaAsset,
    fileBlob: Blob | null,
    currentIndex: MediaAnalysisIndex,
    progressCallback: (pct: number) => void,
    signal: AbortSignal
  ) => Promise<Partial<MediaAnalysisIndex>>;
}

/**
 * Rozdelí slová s časmi na vety/pasáže. Delí na interpunkcii A na pauze,
 * ktorá v reči znamená hranicu myšlienky (nie „každé 2 sekundy“).
 */
export function splitIntoSentences(
  words: { word: string; start: number; end: number }[],
  pauseSec = 0.8,
  maxChars = 220,
): { text: string; start: number; end: number }[] {
  const out: { text: string; start: number; end: number }[] = [];
  let buf: string[] = [];
  let start = 0;
  let prevEnd = 0;

  const flush = (end: number) => {
    const text = buf.join(' ').trim();
    if (text.length > 0) out.push({ text, start: Number(start.toFixed(2)), end: Number(end.toFixed(2)) });
    buf = [];
  };

  words.forEach((w, i) => {
    if (buf.length === 0) start = w.start;
    buf.push(w.word);
    const endsSentence = /[.!?…]$/.test(w.word.trim());
    const next = words[i + 1];
    const longPause = next ? next.start - w.end >= pauseSec : false;
    if (endsSentence || longPause || buf.join(' ').length >= maxChars || i === words.length - 1) {
      flush(w.end);
    }
    prevEnd = w.end;
  });
  void prevEnd;
  return out;
}

export const INITIAL_MEDIA_INDEX = (assetId: string): MediaAnalysisIndex => ({
  assetId,
  assetHash: '',
  updatedAt: 0,
  dataQuality: {},
  unavailableSk: {},
  framesAnalysed: 0,
  completedTasks: {},
  duration: 0,
  resolution: { width: 0, height: 0, aspectRatio: '' },
  fps: 0,
  hasAudio: false,
  waveformPeaks: [],
  audioPeaks: [],
  beatPositions: [],
  silentRanges: [],
  speechRanges: [],
  transcriptText: '',
  wordTimestamps: [],
  sceneBoundaries: [],
  scenes: [],
  representativeFrames: [],
  // Priemer sa počíta z nameraných snímok; 0 = ešte nič (predtým tu bolo falošných 128/80).
  averageBrightness: 0,
  averageBlurScore: 0,
  duplicateShots: [],
  semanticUnits: [],
  semanticRedundancy: []
});

export class MediaIntelligenceEngine {
  private static instance: MediaIntelligenceEngine | null = null;
  private activeControllers: Map<string, AbortController> = new Map();
  private dagTasks: DAGTaskNode[] = [];
  /**
   * Skutočný prepis pre index. Keď nie je zaregistrovaný, index vráti prázdno
   * a dôvod (žiadne vymyslené slová). Registruje ho appka s reálnymi dátami
   * (projekt s titulkami alebo lokálny Whisper).
   */
  private transcriptProvider: ((asset: MediaAsset) => Promise<{ text: string; words: { word: string; start: number; end: number; confidence: number }[] } | null>) | null = null;

  /** Registrácia reálneho zdroja prepisu (appka / lokálny Whisper). */
  /** Vstreknutá funkcia embedovania (appka dodá lokálny model). Core na AI vrstve nezávisí. */
  private embeddingProvider: SemanticEmbeddingFn | null = null;

  public setEmbeddingProvider(provider: SemanticEmbeddingFn | null): void {
    this.embeddingProvider = provider;
  }

  public setTranscriptProvider(
    provider: ((asset: MediaAsset) => Promise<{ text: string; words: { word: string; start: number; end: number; confidence: number }[] } | null>) | null,
  ): void {
    this.transcriptProvider = provider;
  }

  /**
   * Prečíta REÁLNE snímky z média a zmeria z nich obrazové metriky.
   * Bez dekodéra vráti prázdne pole — volajúci musí dať `NOT_AVAILABLE`,
   * nikdy nie vymyslené čísla.
   */
  private async sampleFrames(
    asset: MediaAsset,
    maxSamples: number,
    progress?: (p: number) => void,
  ): Promise<FrameMetrics[]> {
    const duration = asset.duration || 0;
    if (!(duration > 0)) return [];
    const source = asset.url || asset.opfsPath;
    if (!source) return [];

    // Hustota vzorkovania: pri krátkych klipoch (do 90 s) ~2 vzorky za sekundu
    // (aby sme strih nezmeškali), inak rozložíme maxSamples po celej dĺžke.
    const desired = duration <= 90 ? Math.min(maxSamples * 2, Math.round(duration * 2) + 1) : maxSamples;
    const times = sampleTimes(duration, Math.max(2, desired));
    const out: FrameMetrics[] = [];
    for (let i = 0; i < times.length; i += 1) {
      try {
        const bitmap = await mediaEngineV1.getFrameAtTime(source, times[i]);
        if (!bitmap) continue;
        const metrics = this.metricsFromBitmap(bitmap, times[i]);
        if (metrics) out.push(metrics);
        // Snímky sa hneď uvoľňujú — nedržíme full-res v pamäti (2 GB RAM).
        (bitmap as any).close?.();
      } catch {
        // Jedna snímka zlyhá → pokračujeme; ak zlyhajú všetky, vrátime prázdno.
      }
      if (progress && i % 10 === 0) progress(30 + Math.round((i / times.length) * 60));
    }
    return out;
  }

  /**
   * Z `ImageBitmap` (čo vracia mediálny engine v prehliadači) spočíta metriky.
   * V prostredí bez canvasu (napr. testy v Node) vráti `null` — a to je správne:
   * lepšie nič, než vymyslené číslo.
   */
  private metricsFromBitmap(bitmap: ImageBitmap, t: number): FrameMetrics | null {
    const width = Math.min(320, (bitmap as any).width || 0);
    const height = Math.min(180, (bitmap as any).height || 0);
    if (!(width > 0) || !(height > 0)) return null;

    const anyGlobal = globalThis as any;

    // 1) OffscreenCanvas (worker / moderné prehliadače)
    try {
      const OffscreenCanvasCtor = anyGlobal.OffscreenCanvas;
      if (typeof OffscreenCanvasCtor === 'function') {
        const canvas = new OffscreenCanvasCtor(width, height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(bitmap as any, 0, 0, width, height);
          const data = ctx.getImageData(0, 0, width, height).data as Uint8ClampedArray;
          return frameMetricsFromPixels(data, width, height, t);
        }
      }
    } catch {
      // pokračujeme na <canvas>
    }

    // 2) Klasický <canvas> (hlavné vlákno)
    try {
      const doc = anyGlobal.document;
      if (doc?.createElement) {
        const canvas = doc.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(bitmap as any, 0, 0, width, height);
        const data = ctx.getImageData(0, 0, width, height).data as Uint8ClampedArray;
        return frameMetricsFromPixels(data, width, height, t);
      }
    } catch {
      return null;
    }

    // 3) Bez canvasu sa nič nemeria.
    return null;
  }

  public static getInstance(): MediaIntelligenceEngine {
    if (!MediaIntelligenceEngine.instance) {
      MediaIntelligenceEngine.instance = new MediaIntelligenceEngine();
    }
    return MediaIntelligenceEngine.instance;
  }

  /**
   * Initializes local DAG tasks for media processing.
   */
  private initDAGTasks(): void {
    this.dagTasks = [
      // Node 1: Basic Metadata
      {
        id: 'metadata',
        name: 'File & Video Properties',
        deps: [],
        version: 1,
        invalidatesOn: ['file'],
        execute: async (asset) => {
          const mediaSource = asset.url || asset.opfsPath;
          const metadata = await mediaEngineV1.getMetadata(mediaSource);
          const calcRatio = metadata.width && metadata.height ? `${metadata.width}:${metadata.height}` : '16:9';
          return {
            duration: metadata.duration,
            resolution: {
              width: metadata.width,
              height: metadata.height,
              aspectRatio: calcRatio
            },
            fps: metadata.fps,
            hasAudio: metadata.hasAudio
          };
        }
      },

      // Node 2: Waveform & Audio Volume Peaks
      {
        id: 'waveform_peaks',
        name: 'Audio Waveform & Peaks',
        deps: ['metadata'],
        version: 2,
        invalidatesOn: ['file', 'audio'],
        execute: async (asset, _, __, progress) => {
          progress(10);
          const mediaSource = asset.url || asset.opfsPath;
          const peaks = await mediaEngineV1.getWaveform(asset.id, mediaSource);
          progress(90);

          const audioPeaks: { timestamp: number; volumeDb: number }[] = [];
          const duration = asset.duration || 10;

          for (let i = 0; i < peaks.length; i++) {
            const peak = peaks[i] / 100;
            if (peak > 0.85) {
              const time = (i / peaks.length) * duration;
              audioPeaks.push({
                timestamp: Number(time.toFixed(2)),
                volumeDb: Number((20 * Math.log10(peak)).toFixed(1))
              });
            }
          }
          progress(100);
          if (peaks.length === 0) {
            return {
              waveformPeaks: [],
              audioPeaks: [],
              __quality: 'NOT_AVAILABLE' as const,
              __reason: 'Zvukovú vlnu sa nepodarilo prečítať — bez nej sa ticho ani beaty nedajú určiť.',
            };
          }
          return { waveformPeaks: peaks, audioPeaks, __quality: 'MEASURED' as const, __reason: '' };
        }
      },

      // Node 3: Rhythm Beat Detection
      {
        id: 'beat_positions',
        name: 'Audio Beat Positions',
        deps: ['waveform_peaks'],
        version: 1,
        invalidatesOn: ['file', 'audio'],
        execute: async (asset, _, currentIndex, progress) => {
          progress(30);
          const beats: number[] = [];
          const peaks = currentIndex.waveformPeaks;
          const duration = asset.duration || 10;

          // Local peak onset detection
          for (let i = 1; i < peaks.length - 1; i++) {
            if (peaks[i] > 0.6 && peaks[i] > peaks[i - 1] && peaks[i] > peaks[i + 1]) {
              const timestamp = (i / peaks.length) * duration;
              beats.push(Number(timestamp.toFixed(2)));
            }
          }
          progress(100);
          return { beatPositions: beats, __quality: 'DERIVED' as const, __reason: '' };
        }
      },

      // Node 4: Voice Activity & Silence Detection (VAD)
      {
        id: 'silence_speech_vad',
        name: 'Voice Activity (VAD)',
        deps: ['waveform_peaks'],
        version: 1,
        invalidatesOn: ['file', 'audio'],
        execute: async (asset, _, currentIndex, progress) => {
          progress(40);
          const silentRanges: { start: number; end: number; duration: number }[] = [];
          const speechRanges: { start: number; end: number; duration: number }[] = [];
          const duration = asset.duration || 10;
          const peaks = currentIndex.waveformPeaks;

          let inSilence = false;
          let rangeStart = 0;

          for (let i = 0; i < peaks.length; i++) {
            const time = (i / peaks.length) * duration;
            const isSilent = peaks[i] < 0.15;

            if (isSilent && !inSilence) {
              if (time > rangeStart) {
                speechRanges.push({ start: Number(rangeStart.toFixed(2)), end: Number(time.toFixed(2)), duration: Number((time - rangeStart).toFixed(2)) });
              }
              inSilence = true;
              rangeStart = time;
            } else if (!isSilent && inSilence) {
              silentRanges.push({ start: Number(rangeStart.toFixed(2)), end: Number(time.toFixed(2)), duration: Number((time - rangeStart).toFixed(2)) });
              inSilence = false;
              rangeStart = time;
            }
          }

          if (inSilence) {
            silentRanges.push({ start: Number(rangeStart.toFixed(2)), end: Number(duration.toFixed(2)), duration: Number((duration - rangeStart).toFixed(2)) });
          } else if (duration > rangeStart) {
            speechRanges.push({ start: Number(rangeStart.toFixed(2)), end: Number(duration.toFixed(2)), duration: Number((duration - rangeStart).toFixed(2)) });
          }

          progress(100);
          return {
            silentRanges,
            speechRanges,
            __quality: 'DERIVED' as const,
            __reason: '',
          };
        }
      },

      // Node 5: Local Speech Transcript
      {
        id: 'transcript',
        name: 'Speech Transcript',
        deps: ['silence_speech_vad'],
        version: 2,
        invalidatesOn: ['file', 'transcript'],
        execute: async (asset, _, __, progress) => {
          progress(50);
          // POCTIVOSŤ: predtým tu bol pevný zoznam slov
          // (['Vytvárame','inteligentný','index',…]) rovnomerne rozložený na dĺžku.
          // To nebol prepis — bol to vymyslený text. Dnes sa použije LEN skutočný
          // prepis, ktorý poskytne appka (projekt / lokálny Whisper). Ak nič
          // nepríde, index vráti prázdno a dôvod — žiadne vymyslené slová.
          const provided = this.transcriptProvider ? await this.transcriptProvider(asset) : null;
          progress(85);
          if (!provided || provided.words.length === 0) {
            return {
              transcriptText: '',
              wordTimestamps: [],
              __quality: 'NOT_AVAILABLE' as const,
              __reason:
                'Automatický prepis sa pri analýze média nespúšťa (v prehliadači je to dlhý beh). ' +
                'Použite prepis v projekte (titulky) alebo zapnite lokálny Whisper — potom sa slová načítajú sem.',
            };
          }
          progress(100);
          return {
            transcriptText: provided.text,
            wordTimestamps: provided.words,
            __quality: 'MEASURED' as const,
            __reason: '',
          };
        }
      },

      // Node 6: Scene Cut Detection (z REÁLNYCH snímok)
      {
        id: 'scene_boundaries',
        name: 'Scene Cut Detection (measured frames)',
        deps: ['metadata'],
        version: 2,
        invalidatesOn: ['file', 'crop'],
        execute: async (asset, _, __, progress) => {
          progress(20);
          // POCTIVOSŤ: predtým tu boli hranice pevne na 25 % a 65 % dĺžky
          // so skóre 0,88 / 0,94 — teda vymyslené „scény“, ktoré nikto nevidel.
          // Dnes: vzorky REÁLNYCH snímok z média (max 120), rozdiel jasu/farby
          // a ostré zmeny = strihy. Bez snímok = prázdno + dôvod.
          const samples = await this.sampleFrames(asset, 120, progress);
          if (samples.length === 0) {
            return {
              sceneBoundaries: [] as SceneBoundary[],
              scenes: [],
              __quality: 'NOT_AVAILABLE' as const,
              __reason:
                'Snímky sa z tohto média nepodarilo prečítať (v tomto prostredí nie je dekodér obrázkov), ' +
                'preto sa strihy NEMERALI. Žiadne scény sa nevymýšľajú.',
            };
          }
          const duration = samples[samples.length - 1].t || asset.duration || 0;
          const boundaries = detectSceneBoundaries(samples);
          const scenes = scenesFromBoundaries(boundaries, duration);
          progress(100);
          return {
            sceneBoundaries: boundaries,
            scenes,
            __quality: 'DERIVED' as const,
            __reason: '',
            __framesAnalysed: samples.length,
          };
        }
      },

      // Node 7: Representative Frames — LEN z REÁLNYCH pixelov
      {
        id: 'representative_frames',
        name: 'Frame Metrics (Brightness / Sharpness)',
        deps: ['scene_boundaries', 'silence_speech_vad'],
        version: 3,
        invalidatesOn: ['file', 'crop'],
        execute: async (asset, _, currentIndex, progress) => {
          progress(30);
          // POCTIVOSŤ: predtým tu boli jas a ostrosť zo vzorcov
          // (`brightness = 40 + (i * 45) % 185`, `blurScore = 30 + (i * 25) % 90`)
          // a farebný vektor pevný. Dnes sa merajú REÁLNE pixely.
          const samples = await this.sampleFrames(asset, 120, progress);
          if (samples.length === 0) {
            return {
              representativeFrames: [],
              averageBrightness: 0,
              averageBlurScore: 0,
              __quality: 'NOT_AVAILABLE' as const,
              __reason:
                'Obrazové metriky sa nemerajú — snímky z média sa nepodarilo prečítať ' +
                '(chýba dekodér obrázkov v tomto prostredí). Jas, ostrosť ani „najlepší záber“ sa nevymýšľajú.',
            };
          }

          const speechRanges = currentIndex.speechRanges || [];
          const frames: RepresentativeFrame[] = samples.map((m) => {
            const hasSpeech = speechRanges.some((sr) => m.t >= sr.start && m.t <= sr.end);
            return {
              timestamp: m.t,
              thumbnailUrl: '',
              brightness: Math.round(m.luma),
              // Ostrosť = rozptyl gradientu (čím viac hrán/detailov, tým vyššie).
              blurScore: Number(m.sharpness.toFixed(2)),
              colorVector: [
                Number((m.rgb[0] / 255).toFixed(3)),
                Number((m.rgb[1] / 255).toFixed(3)),
                Number((m.rgb[2] / 255).toFixed(3)),
                Number(m.darkShare.toFixed(3)),
              ],
              lumaHistogram: m.lumaHistogram,
              grayThumb: m.grayThumb,
              isVeryDark: m.luma < 50,
              isBlurry: m.sharpness < 2.5,
              isStatic: false, // statickosť bez porovnania susedných snímok netvrdíme
              isSceneChange: false, // vyplní sa nižšie z nameraných hraníc
              // B-roll kandidát = objektívne kritérium: obraz nie je tmavý ani rozmazaný a v čase nehovorí reč.
              isBRollCandidate: m.luma >= 50 && m.sharpness >= 2.5 && !hasSpeech,
            };
          });

          const boundaries = currentIndex.sceneBoundaries || [];
          for (const b of boundaries) {
            const nearest = frames.reduce<RepresentativeFrame | null>((best, f) => {
              if (Math.abs(f.timestamp - b.timestamp) > 0.75) return best;
              if (!best) return f;
              return Math.abs(f.timestamp - b.timestamp) < Math.abs(best.timestamp - b.timestamp) ? f : best;
            }, null);
            if (nearest) nearest.isSceneChange = true;
          }

          if (frames.length > 0) {
            // „Najjasnejší a najostrejší záber“ = merané kritérium, nie model.
            let bestIndex = 0;
            let bestScore = -1;
            frames.forEach((f, idx) => {
              if (f.isVeryDark || f.isBlurry) return;
              const score = (f.blurScore || 0) * (1 - Math.abs((f.brightness || 0) - 128) / 128);
              if (score > bestScore) {
                bestScore = score;
                bestIndex = idx;
              }
            });
            if (bestScore > 0) frames[bestIndex].isBestShot = true;
          }

          const avgBrightness = Math.round(frames.reduce((a, b) => a + (b.brightness || 0), 0) / frames.length);
          const avgBlur = Number((frames.reduce((a, b) => a + (b.blurScore || 0), 0) / frames.length).toFixed(2));

          progress(100);
          return {
            representativeFrames: frames,
            averageBrightness: avgBrightness,
            averageBlurScore: avgBlur,
            __quality: 'MEASURED' as const,
            __reason: '',
            __framesAnalysed: frames.length,
          };
        }
      },

      // Node 8: Visual Similarity & Duplicate Shots (z NAMERANÝCH snímok)
      {
        id: 'duplicate_shots',
        name: 'Duplicate Shot Detection (measured frames)',
        deps: ['representative_frames'],
        version: 3,
        invalidatesOn: ['file', 'crop'],
        execute: async (_, __, currentIndex, progress) => {
          progress(40);
          const frames = currentIndex.representativeFrames || [];
          if (frames.length < 2) {
            return {
              duplicateShots: [],
              __quality: 'NOT_AVAILABLE' as const,
              __reason:
                'Podobnosť záberov sa nedá určiť — v indexe nie sú namerané snímky (obrazová analýza neprebehla).',
            };
          }

          // POCTIVOSŤ: predtým sa tu počítal kosínus farebného vektora s prahom 0,88.
          // Pri nezáporných zložkách (R, G, B ≥ 0) je kosínus takmer vždy vysoký,
          // takže index hlásil „duplicity“ aj medzi úplne odlišnými zábermi.
          // Dnes používame vzdialenosť nameraných metrík (jas + farba) a označíme
          // len zábery, ktoré sú si naozaj podobné (vzdialenosť < 0,06).
          const toMetrics = (f: RepresentativeFrame): FrameMetrics => ({
            t: f.timestamp,
            luma: f.brightness,
            rgb: [
              (f.colorVector?.[0] ?? 0) * 255,
              (f.colorVector?.[1] ?? 0) * 255,
              (f.colorVector?.[2] ?? 0) * 255,
            ],
            darkShare: f.colorVector?.[3] ?? 0,
            lightShare: 0,
            sharpness: f.blurScore,
            lumaHistogram: f.lumaHistogram ?? [],
            grayThumb: f.grayThumb ?? [],
          });

          const metrics = frames.map(toMetrics);
          const duplicates: DuplicateShot[] = [];
          const DUPLICATE_DISTANCE = 0.06;

          for (let i = 0; i < metrics.length; i += 1) {
            for (let j = i + 1; j < metrics.length; j += 1) {
              const distance = frameDistance(metrics[i], metrics[j]);
              if (distance >= DUPLICATE_DISTANCE) continue;
              duplicates.push({
                shot1Timestamp: metrics[i].t,
                shot2Timestamp: metrics[j].t,
                similarityScore: Number((1 - distance).toFixed(2)),
              });
              frames[i].isDuplicate = true;
              frames[j].isDuplicate = true;
              (frames[i].similarFrameTimestamps ||= []).push(metrics[j].t);
              (frames[j].similarFrameTimestamps ||= []).push(metrics[i].t);
            }
          }

          progress(100);
          return {
            representativeFrames: frames,
            duplicateShots: duplicates,
            __quality: 'DERIVED' as const,
            __reason: '',
          };
        }
      },

      // Node 8: Sémantické jednotky (KROK 1) — porovnanie VÝZNAMU, nie slov
      {
        id: 'semantic_units',
        name: 'Semantic Units (real embeddings)',
        deps: ['transcript'],
        version: 1,
        invalidatesOn: ['file', 'transcript'],
        execute: async (_, __, currentIndex, progress) => {
          progress(20);
          const words = currentIndex.wordTimestamps || [];
          const text = currentIndex.transcriptText || '';

          // Bez prepisu niet čo porovnávať — žiadne vymyslené vety.
          if (!text || words.length === 0) {
            return {
              semanticUnits: [],
              semanticRedundancy: [],
              __quality: 'NOT_AVAILABLE' as const,
              __reason:
                'Porovnanie významu sa nemeria — v indexe nie je prepis (slová s časmi). ' +
                'Načítajte titulky z projektu alebo zapnite lokálny Whisper.',
            };
          }

          const sentence = splitIntoSentences(words);
          const built = await buildSemanticIndex(
            sentence.map((s, i) => ({
              id: `s${i}`,
              assetId: currentIndex.assetId,
              text: s.text,
              start: s.start,
              end: s.end,
            })),
            this.embeddingProvider,
          );

          if (built.quality !== 'MEASURED') {
            return {
              semanticUnits: [],
              semanticRedundancy: [],
              __quality: 'NOT_AVAILABLE' as const,
              __reason: built.reasonSk,
            };
          }

          progress(80);
          const redundancy = findRedundantSegments(built);
          return {
            semanticUnits: built.segments,
            semanticRedundancy: redundancy,
            __quality: 'MEASURED' as const,
            __reason: '',
          };
        }
      },
    ];
  }

  /**
   * Retrieves or builds the cached MediaAnalysisIndex from IndexedDB.
   */
  public async getOrCreateIndex(assetId: string): Promise<MediaAnalysisIndex> {
    const key = `mediaindex_${assetId}`;
    const db = await (idbManager as any).getDB();
    return new Promise((resolve) => {
      const tx = db.transaction('ai_cache', 'readonly');
      const store = tx.objectStore('ai_cache');
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result && req.result.data) {
          resolve(req.result.data as MediaAnalysisIndex);
        } else {
          resolve(INITIAL_MEDIA_INDEX(assetId));
        }
      };
      req.onerror = () => resolve(INITIAL_MEDIA_INDEX(assetId));
    });
  }

  /**
   * Saves updated MediaAnalysisIndex into IndexedDB.
   */
  public async saveIndex(index: MediaAnalysisIndex): Promise<void> {
    const key = `mediaindex_${index.assetId}`;
    index.updatedAt = Date.now();
    const db = await (idbManager as any).getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('ai_cache', 'readwrite');
      const store = tx.objectStore('ai_cache');
      const req = store.put({
        key,
        assetId: index.assetId,
        data: index,
        updatedAt: Date.now()
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Invalidates specific cache nodes by dependency tag without re-analyzing unaffected data.
   */
  public async invalidateByTag(assetId: string, tag: InvalidationTag): Promise<MediaAnalysisIndex> {
    const index = await this.getOrCreateIndex(assetId);

    // Find nodes to invalidate
    const invalidNodeIds = new Set<string>();
    for (const task of this.dagTasks) {
      if (task.invalidatesOn.includes(tag)) {
        invalidNodeIds.add(task.id);
      }
    }

    // Cascade downstream dependencies
    let added = true;
    while (added) {
      added = false;
      for (const task of this.dagTasks) {
        if (!invalidNodeIds.has(task.id)) {
          if (task.deps.some((dep) => invalidNodeIds.has(dep))) {
            invalidNodeIds.add(task.id);
            added = true;
          }
        }
      }
    }

    // Clear completed status for invalidated nodes
    for (const nodeId of invalidNodeIds) {
      delete index.completedTasks[nodeId];
    }

    await this.saveIndex(index);
    return index;
  }

  /**
   * Runs incremental DAG analysis.
   * Resumes from previously completed nodes, skips cached nodes, and supports cancellation via AbortController.
   */
  public async runAnalysis(
    asset: MediaAsset,
    fileBlob: Blob | null,
    onProgress?: (taskName: string, overallProgress: number) => void
  ): Promise<MediaAnalysisIndex> {
    this.cancelAnalysis(asset.id);

    const controller = new AbortController();
    this.activeControllers.set(asset.id, controller);

    let index = await this.getOrCreateIndex(asset.id);

    // Determine pending tasks in DAG topological order
    const pendingTasks = this.dagTasks.filter((task) => {
      const cached = index.completedTasks[task.id];
      return !cached || cached.version < task.version;
    });

    if (pendingTasks.length === 0) {
      if (onProgress) onProgress('Completing from cache', 100);
      return index;
    }

    const totalTasks = this.dagTasks.length;

    for (let i = 0; i < pendingTasks.length; i++) {
      if (controller.signal.aborted) {
        console.log(`[MediaIntelligenceEngine] Analysis canceled for asset ${asset.id}`);
        break;
      }

      const task = pendingTasks[i];
      const completedCount = totalTasks - pendingTasks.length + i;
      const baseProgress = Math.round((completedCount / totalTasks) * 100);

      if (onProgress) {
        onProgress(task.name, baseProgress);
      }

      // Check if dependencies are fulfilled
      const unfulfilled = task.deps.filter((dep) => !index.completedTasks[dep]);
      if (unfulfilled.length > 0) {
        console.warn(`[MediaIntelligenceEngine] Task ${task.id} waiting for unfulfilled deps: ${unfulfilled.join(', ')}`);
        continue;
      }

      try {
        const partialData = await task.execute(
          asset,
          fileBlob,
          index,
          (taskPct) => {
            if (onProgress) {
              const currentOverall = Math.min(99, Math.round(baseProgress + (taskPct / totalTasks)));
              onProgress(task.name, currentOverall);
            }
          },
          controller.signal
        );

        // Uzly vracajú aj `__quality` / `__reason` / `__framesAnalysed` — tie sa
        // nesmú rozliať do indexu ako polia, ale zapíšu sa do mapy kvality dát.
        const { __quality, __reason, __framesAnalysed, ...fields } = (partialData || {}) as any;

        index = {
          ...index,
          ...fields,
          dataQuality: {
            ...(index.dataQuality || {}),
            [task.id]: (__quality as DataQuality) || 'MEASURED',
          },
          unavailableSk: {
            ...(index.unavailableSk || {}),
            ...(__reason ? { [task.id]: String(__reason) } : {}),
          },
          framesAnalysed:
            typeof __framesAnalysed === 'number' ? Math.max(index.framesAnalysed || 0, __framesAnalysed) : index.framesAnalysed || 0,
          updatedAt: Date.now(),
          completedTasks: {
            ...index.completedTasks,
            [task.id]: { completedAt: Date.now(), version: task.version }
          }
        };

        // Incremental save after each completed node
        await this.saveIndex(index);
      } catch (e: any) {
        console.error(`[MediaIntelligenceEngine] Error executing DAG task ${task.id}:`, e);
      }
    }

    if (onProgress) onProgress('Analýza dokončená', 100);
    this.activeControllers.delete(asset.id);
    return index;
  }

  /**
   * Cancels active DAG analysis for a specific asset.
   */
  public cancelAnalysis(assetId: string): void {
    const controller = this.activeControllers.get(assetId);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(assetId);
    }
  }

  public isRunning(assetId: string): boolean {
    return this.activeControllers.has(assetId);
  }
}

export const mediaIntelligenceEngine = MediaIntelligenceEngine.getInstance();

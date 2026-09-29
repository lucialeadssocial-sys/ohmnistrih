/**
 * Smart Cut Renderer — z EDL spraví hotový súbor.
 *
 * Ako to funguje (a prečo takto):
 *  - **Neprekóduje.** Číta už zakódované packety zo zdroja a skladá ich do nového
 *    súboru. Výsledok je preto bez straty kvality a rádovo rýchlejší než render
 *    (nezávisí od dĺžky videa, len od počtu packetov, ktoré sa skopírujú).
 *  - **Rezy sedia na kľúčových snímkoch.** Video sa dá čisto začať len na kľúčovom
 *    snímku (keyframe). Ak je najbližší keyframe pred rezným bodom, segment začne
 *    o kúsok skôr — a renderer to vráti v `segmentOffsets`, aby to používateľ vedel.
 *    Presný rez na desatinu sekundy by vyžadoval prekódovanie (pomalejšie, so stratou).
 *  - **Zvuk sa kopíruje tak isto** (AAC/Opus/MP3 packety), takže strih neznie „chrastivo“.
 *
 * Čo renderer NIKDY nerobí: nemení obsah, nepridáva efekty, neposúva pointy.
 * Je to iba skladačka úsekov, ktoré mu dá EDL z RETENTION SHORT.
 */

import {
  Input,
  BlobSource,
  ALL_FORMATS,
  Output,
  BufferTarget,
  Mp4OutputFormat,
  WebMOutputFormat,
  EncodedVideoPacketSource,
  EncodedAudioPacketSource,
  EncodedPacket,
  EncodedPacketSink,
} from "mediabunny";

export interface SmartCutSegment {
  sourceStart: number;
  sourceEnd: number;
  timelineStart: number;
  duration: number;
  label?: string;
}

export interface SmartCutProgress {
  stage: "READY" | "COPYING" | "FINALIZING" | "DONE";
  percent: number;
  segmentIndex: number;
  totalSegments: number;
  copiedVideoPackets: number;
  copiedAudioPackets: number;
  messageSk: string;
}

export interface SmartCutWarning {
  text: string;
  hint?: string;
}

export interface SmartCutResult {
  blob: Blob;
  container: "mp4" | "webm";
  mimeType: string;
  /** Skutočná dĺžka výsledku (súčet skopírovaných úsekov). */
  durationSec: number;
  /** Koľko skopírovaných sekúnd sa líši od plánu (napr. kvôli keyframom). */
  durationDriftSec: number;
  videoCodec: string | null;
  audioCodec: string | null;
  copiedVideoPackets: number;
  copiedAudioPackets: number;
  /** Pre každý segment: o koľko sekúnd skôr musel začať kvôli kľúčovému snímku. */
  segmentOffsets: number[];
  warnings: SmartCutWarning[];
  /** Vždy false — tento renderer strihá kopírovaním, nie prekódovaním. */
  reencoded: boolean;
}

export interface SmartCutOptions {
  source: Blob;
  segments: SmartCutSegment[];
  container?: "mp4" | "webm" | "auto";
  onProgress?: (progress: SmartCutProgress) => void;
  shouldCancel?: () => boolean;
  /** Po koľkých packetoch hlásiť postup (kvôli výkonu). */
  progressEveryPackets?: number;
}

export class SmartCutCanceledError extends Error {
  constructor() {
    super("Render bol zrušený používateľom.");
    this.name = "SmartCutCanceledError";
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Kontajner podľa kodekov: MP4 je to, čo klient otvorí všade (H.264/HEVC/AV1).
 * Pre VP8/VP9 bez MP4 kompatibility radšej WebM.
 */
export function chooseContainer(
  videoCodec: string | null,
  audioCodec: string | null,
): "mp4" | "webm" {
  const mp4Video = ["avc", "hevc", "av1", "vp9"];
  const mp4Audio = ["aac", "opus", "mp3", "flac", null];
  const videoOk = videoCodec ? mp4Video.includes(videoCodec) : false;
  const audioOk = audioCodec ? mp4Audio.includes(audioCodec) : true;
  return videoOk && audioOk ? "mp4" : "webm";
}

/**
 * Skopíruje jeden úsek (video + zvuk) zo zdroja do výstupu.
 *
 * Dôležité: výstupný čas sa NEpočíta z plánovanej dĺžky, ale zo skutočne
 * zapísaných packetov. Keyframové posadenie totiž môže úsek o kúsok predĺžiť,
 * a keby sme naviazali plánovanou dĺžkou, segmenty by sa na výstupnej osi
 * prekryli — muxer to odmietne („timestamps cannot be smaller than the largest
 * timestamp of the previous GOP“). Preto vraciame presný koniec a kurzor
 * posúvame podľa reality.
 */
async function copySegment(
  args: {
    segment: SmartCutSegment;
    videoStart: number;
    audioStart: number;
    videoSink: EncodedPacketSink | null;
    audioSink: EncodedPacketSink | null;
    videoSource: EncodedVideoPacketSource | null;
    audioSource: EncodedAudioPacketSource | null;
    videoDecoderConfig: any;
    audioDecoderConfig: any;
  },
  state: {
    videoSeq: number;
    audioSeq: number;
    copiedVideo: number;
    copiedAudio: number;
    wroteVideoConfig: boolean;
    wroteAudioConfig: boolean;
    videoHeadOffset: number;
    audioHeadOffset: number;
    videoEnd: number;
    audioEnd: number;
  },
): Promise<void> {
  const { segment, videoSink, audioSink, videoSource, audioSource } = args;

  // ---- VIDEO ----
  // Každý úsek začína kľúčovým snímkom (bez neho by sa video nedalo dekódovať).
  if (videoSink && videoSource) {
    const key = await videoSink.getKeyPacket(segment.sourceStart, { verifyKeyPackets: true });
    const first =
      key ?? (await videoSink.getPacket(segment.sourceStart, { verifyKeyPackets: true }));

    if (first) {
      const shift = args.videoStart - first.timestamp;
      state.videoHeadOffset = Math.max(0, segment.sourceStart - first.timestamp);

      let maxWritten = args.videoStart;
      let packet: EncodedPacket | null = first;

      while (packet) {
        if (packet.timestamp >= segment.sourceEnd) break;

        const shiftedTimestamp = packet.timestamp + shift;
        const shifted = new EncodedPacket(
          packet.data,
          packet.type,
          shiftedTimestamp,
          packet.duration,
          state.videoSeq++,
          packet.byteLength,
          packet.sideData,
        );

        await videoSource.add(
          shifted,
          !state.wroteVideoConfig && args.videoDecoderConfig
            ? { decoderConfig: args.videoDecoderConfig }
            : undefined,
        );
        state.wroteVideoConfig = true;
        state.copiedVideo++;

        // Skutočný koniec = najväčší zapísaný čas + trvanie packetu
        maxWritten = Math.max(maxWritten, shiftedTimestamp + (packet.duration || 0));

        packet = await videoSink.getNextPacket(packet, { verifyKeyPackets: true });
      }

      state.videoEnd = maxWritten;
    } else {
      state.videoEnd = args.videoStart;
    }
  } else {
    state.videoEnd = args.videoStart;
  }

  // ---- ZVUK ----
  if (audioSink && audioSource) {
    const first = await audioSink.getPacket(segment.sourceStart);
    if (first) {
      const shift = args.audioStart - first.timestamp;
      state.audioHeadOffset = Math.max(0, segment.sourceStart - first.timestamp);

      let maxWritten = args.audioStart;
      let packet: EncodedPacket | null = first;

      while (packet) {
        if (packet.timestamp >= segment.sourceEnd) break;

        const shiftedTimestamp = packet.timestamp + shift;
        const shifted = new EncodedPacket(
          packet.data,
          packet.type,
          shiftedTimestamp,
          packet.duration,
          state.audioSeq++,
          packet.byteLength,
          packet.sideData,
        );

        await audioSource.add(
          shifted,
          !state.wroteAudioConfig && args.audioDecoderConfig
            ? { decoderConfig: args.audioDecoderConfig }
            : undefined,
        );
        state.wroteAudioConfig = true;
        state.copiedAudio++;

        maxWritten = Math.max(maxWritten, shiftedTimestamp + (packet.duration || 0));

        packet = await audioSink.getNextPacket(packet);
      }

      state.audioEnd = maxWritten;
    } else {
      state.audioEnd = args.audioStart;
    }
  } else {
    state.audioEnd = args.audioStart;
  }
}

/**
 * Zloží EDL do jedného súboru. Vracia Blob — používateľ si ho stiahne.
 * Nikdy nevyhadzuje „tichý“ výsledok: všetko, čo sa nepodarilo presne, je vo `warnings`.
 */
export async function smartCutRender(options: SmartCutOptions): Promise<SmartCutResult> {
  const { source, segments } = options;
  const progressEvery = options.progressEveryPackets ?? 120;
  const warnings: SmartCutWarning[] = [];

  if (!segments || segments.length === 0) {
    throw new Error("Nie sú zvolené žiadne úseky na render — nie je čo strihať.");
  }
  if (!source || source.size === 0) {
    throw new Error("Chýba zdrojové video. Nahraj video a skús znova.");
  }

  const report = (p: Partial<SmartCutProgress> & { stage: SmartCutProgress["stage"] }) =>
    options.onProgress?.({
      percent: 0,
      segmentIndex: 0,
      totalSegments: segments.length,
      copiedVideoPackets: 0,
      copiedAudioPackets: 0,
      messageSk: "",
      ...p,
    });

  const input = new Input({ source: new BlobSource(source), formats: ALL_FORMATS });

  try {
    const videoTrack = await input.getPrimaryVideoTrack();
    const audioTrack = await input.getPrimaryAudioTrack();

    if (!videoTrack) {
      throw new Error(
        "Zdroj nemá obrazovú stopu (alebo formát nie je podporovaný) — nedá sa z neho postaviť video.",
      );
    }

    const videoCodec = videoTrack.codec;
    if (!videoCodec) {
      throw new Error(
        "Nepodarilo sa zistiť kodek videa. Skús iný formát súboru (MP4/H.264 alebo WebM/VP9).",
      );
    }
    const audioCodec = audioTrack?.codec ?? null;

    const container =
      options.container && options.container !== "auto"
        ? options.container
        : chooseContainer(videoCodec, audioCodec);

    const videoDecoderConfig = await videoTrack.getDecoderConfig();
    const audioDecoderConfig = audioTrack ? await audioTrack.getDecoderConfig() : null;

    // Dĺžka zdroja: podľa nej orežeme segmenty. Bez toho by úsek za koncom videa
    // „skopíroval posledný keyframe a zvyšok“ — teda niečo, čo plán nechcel.
    let sourceDuration = 0;
    try {
      sourceDuration = await input.computeDuration();
    } catch {
      sourceDuration = 0; // neznáma dĺžka — potom sa spoliehame na packety
    }

    const effectiveSegments: SmartCutSegment[] = [];
    let droppedOutside = 0;
    for (const seg of segments) {
      const start = Math.max(0, seg.sourceStart);
      const end = Math.max(start, seg.sourceEnd);
      if (sourceDuration > 0 && start >= sourceDuration - 0.01) {
        droppedOutside++;
        continue;
      }
      const clampedEnd = sourceDuration > 0 ? Math.min(end, sourceDuration) : end;
      if (clampedEnd - start <= 0.01) {
        droppedOutside++;
        continue;
      }
      effectiveSegments.push({ ...seg, sourceStart: start, sourceEnd: clampedEnd });
    }

    if (droppedOutside > 0) {
      warnings.push({
        text: `${droppedOutside} ${droppedOutside === 1 ? "úsek je" : "úseky sú"} mimo dĺžky videa — preskočil som ${droppedOutside === 1 ? "ho" : "ich"}.`,
        hint:
          sourceDuration > 0
            ? `Zdroj má ${sourceDuration.toFixed(1)} s. Skontroluj, či EDL vzniklo pre toto video (napr. po výmene materiálu).`
            : "Nepodarilo sa zistiť dĺžku zdroja — skontroluj, či EDL patrí k tomuto videu.",
      });
    }

    if (effectiveSegments.length === 0) {
      throw new Error(
        `Všetky úseky (${segments.length}) sú mimo dĺžky videa${
          sourceDuration > 0 ? ` (${sourceDuration.toFixed(1)} s)` : ""
        }. EDL pravdepodobne patrí k inému videu.`,
      );
    }

    // Časy na výslednej osi prepočítame, aby klip nemal diery po preskočených úsekoch.
    let cursor = 0;
    const normalizedSegments = effectiveSegments.map((seg) => {
      const duration = round2(Math.max(0, seg.sourceEnd - seg.sourceStart));
      const normalized = { ...seg, timelineStart: round2(cursor), duration };
      cursor += duration;
      return normalized;
    });

    const target = new BufferTarget();
    const output = new Output({
      format: container === "mp4" ? new Mp4OutputFormat() : new WebMOutputFormat(),
      target,
    });

    const videoSource = new EncodedVideoPacketSource(videoCodec as any);
    output.addVideoTrack(videoSource, { rotation: videoTrack.rotation });

    let audioSource: EncodedAudioPacketSource | null = null;
    if (audioTrack && audioCodec) {
      audioSource = new EncodedAudioPacketSource(audioCodec as any);
      output.addAudioTrack(audioSource);
    }

    await output.start();
    report({ stage: "READY", percent: 1, messageSk: "Zdroj načítaný, začínam skladať strih…" });

    const state = {
      videoSeq: 0,
      audioSeq: 0,
      copiedVideo: 0,
      copiedAudio: 0,
      wroteVideoConfig: false,
      wroteAudioConfig: false,
      videoHeadOffset: 0,
      audioHeadOffset: 0,
      videoEnd: 0,
      audioEnd: 0,
    };

    const videoSink = new EncodedPacketSink(videoTrack);
    const audioSink = audioTrack ? new EncodedPacketSink(audioTrack) : null;

    const totalPlanned = normalizedSegments.reduce((sum, s) => sum + Math.max(0, s.duration), 0);
    const segmentOffsets: number[] = [];
    let processedPlanned = 0;
    let videoCursor = 0;
    let audioCursor = 0;

    for (let i = 0; i < normalizedSegments.length; i++) {
      if (options.shouldCancel?.()) throw new SmartCutCanceledError();

      state.videoHeadOffset = 0;
      state.audioHeadOffset = 0;

      await copySegment(
        {
          segment: normalizedSegments[i],
          videoStart: videoCursor,
          audioStart: audioCursor,
          videoSink,
          audioSink,
          videoSource,
          audioSource,
          videoDecoderConfig,
          audioDecoderConfig,
        },
        state,
      );

      // Kurzor posúvame podľa toho, čo sa naozaj zapísalo — nie podľa plánu.
      videoCursor = state.videoEnd;
      audioCursor = state.audioEnd;

      segmentOffsets.push(round2(state.videoHeadOffset));
      processedPlanned += Math.max(0, normalizedSegments[i].duration);

      const percent = Math.min(
        95,
        Math.round((processedPlanned / Math.max(0.001, totalPlanned)) * 90) + 5,
      );
      report({
        stage: "COPYING",
        percent,
        segmentIndex: i + 1,
        copiedVideoPackets: state.copiedVideo,
        copiedAudioPackets: state.copiedAudio,
        messageSk: `Skladám úsek ${i + 1} z ${normalizedSegments.length}…`,
      });
    }

    report({ stage: "FINALIZING", percent: 96, messageSk: "Uzatváram súbor…" });
    await output.finalize();

    if (state.copiedVideo > 0 && state.copiedVideo < progressEvery) {
      // (iba poznámka do histórie — krátke klipy majú málo packetov, to je v poriadku)
    }

    const buffer = target.buffer;
    if (!buffer) throw new Error("Výstup je prázdny — render nedopadol dobre.");

    const mimeType = container === "mp4" ? "video/mp4" : "video/webm";
    const blob = new Blob([buffer], { type: mimeType });

    // Kontrola: čo sme naozaj skopírovali vs. čo plánoval EDL
    const maxHeadOffset = segmentOffsets.length ? Math.max(...segmentOffsets) : 0;
    // Skutočná dĺžka = kam sa dostal výstupný kurzor (vrátane keyframových posunov).
    const createdDurationSec = round2(Math.max(videoCursor, audioCursor));
    const durationSec = createdDurationSec;
    const durationDriftSec = round2(createdDurationSec - totalPlanned);

    if (maxHeadOffset > 0.05) {
      warnings.push({
        text: `Strihy sú posadené na kľúčové snímky — najviac o ${maxHeadOffset.toFixed(2)} s skôr, než určoval plán.`,
        hint:
          "Preto je výsledok o pár desatín dlhší. Je to cena za to, že sa video NEPREKÓDOVALO: kvalita zostáva pôvodná a render je hotový za zlomok času. Presný rez na desatinu sekundy by vyžadoval prekódovanie celého klipu.",
      });
    }

    if (!audioTrack) {
      warnings.push({
        text: "Zdroj nemá zvukovú stopu — klip bude bez zvuku.",
        hint: "Ak video zvuk má, skontroluj, či je zvuk v pôvodnom súbore naozaj prítomný (niektoré exporty majú len video stopu).",
      });
    }

    if (state.copiedVideo === 0) {
      warnings.push({
        text: "Neskopíroval sa ani jeden obrazový packet — výsledok môže byť prázdny.",
        hint: "Skontroluj, či rezy v EDL sedia na reálne časy videa (nie za koncom súboru).",
      });
    }

    report({
      stage: "DONE",
      percent: 100,
      copiedVideoPackets: state.copiedVideo,
      copiedAudioPackets: state.copiedAudio,
      messageSk: "Hotovo — klip je vyrenderovaný.",
    });

    return {
      blob,
      container,
      mimeType,
      durationSec: createdDurationSec,
      durationDriftSec,
      videoCodec,
      audioCodec,
      copiedVideoPackets: state.copiedVideo,
      copiedAudioPackets: state.copiedAudio,
      segmentOffsets,
      warnings,
      reencoded: false,
    };
  } finally {
    try {
      (input as any).dispose?.();
    } catch {
      /* uvoľnenie nie je kritické */
    }
  }
}

/** Zhrnutie výsledku pre používateľa. */
export function smartCutSummarySk(result: SmartCutResult): string {
  const size = (result.blob.size / (1024 * 1024)).toFixed(1);
  const codecs = [result.videoCodec, result.audioCodec].filter(Boolean).join(" + ");
  return `${result.container.toUpperCase()} · ${result.durationSec.toFixed(1)} s · ${size} MB · ${codecs} · kvalita pôvodná (bez prekódovania)`;
}

/** Návrh názvu súboru. */
export function smartCutFileName(container: "mp4" | "webm", label?: string): string {
  const safe = (label || "klip")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `omnistrih-${safe || "klip"}-${Date.now()}.${container}`;
}

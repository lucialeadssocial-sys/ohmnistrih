import { EditDecisionList } from "../types";
import { EditDNAProfile } from "./editDNA";

export type ExportPresetId = "SOCIAL_VERTICAL" | "SOCIAL_SQUARE" | "SOCIAL_PORTRAIT" | "YOUTUBE_LANDSCAPE" | "YOUTUBE_4K" | "CUSTOM";

export interface ExportPresetConfig {
  id: ExportPresetId;
  name: string;
  width: number;
  height: number;
  fps: number;
  videoBitrate: number;
  aspectRatio: "9:16" | "1:1" | "4:5" | "16:9";
  description: string;
}

export type RenderJobStatus = 
  | "QUEUED"
  | "PREPARING"
  | "RENDERING_VIDEO"
  | "RENDERING_AUDIO"
  | "MUXING"
  | "QC"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED";

export type RenderErrorCode =
  | "MEDIA_NOT_FOUND"
  | "UNSUPPORTED_CODEC"
  | "DECODE_FAILED"
  | "ENCODE_FAILED"
  | "AUDIO_RENDER_FAILED"
  | "MUX_FAILED"
  | "OUT_OF_MEMORY"
  | "BROWSER_CAPABILITY"
  | "EDL_CHANGED"
  | "SOURCE_CHANGED"
  | "EXPORT_CANCELLED"
  | "QC_FAILED";

export interface RenderPlan {
  projectId: string;
  edlVersion: number;
  dnaVersion: number;
  sourceMediaReferences: string[];
  timelineDuration: number;
  outputWidth: number;
  outputHeight: number;
  fps: number;
  videoCodec: string;
  audioCodec: string;
  bitrate: number;
  audioSampleRate: number;
  audioChannels: number;
  presetId: ExportPresetId;
  createdAt: string;
  edlSnapshot: EditDecisionList;
  dnaSnapshot: EditDNAProfile;
}

export interface QCGateResult {
  passed: boolean;
  blackFramesDetected: boolean;
  audioClippingDetected: boolean;
  missingMediaDetected: boolean;
  captionOverflowDetected: boolean;
  safeZoneViolations: number;
  score: number; // 0 - 100, derived from the checks that were actually performed
  /**
   * Which checks were really performed. `false` means the value above is a placeholder,
   * not a measurement of the encoded output (pixel/bitstream inspection is not implemented).
   */
  measured: {
    missingMedia: boolean;
    captionOverflow: boolean;
    blackFrames: boolean;
    audioClipping: boolean;
    safeZones: boolean;
  };
  detailsSk: string;
  detailsEn: string;
}

export interface ExportHistoryItem {
  id: string;
  projectId: string;
  fileName: string;
  preset: ExportPresetId;
  resolution: string;
  fps: number;
  duration: number;
  edlVersion: number;
  dnaVersion: number;
  status: RenderJobStatus;
  qcStatus: "PASSED" | "FAILED" | "NOT_RUN";
  createdAt: string;
  fileUrl?: string;
  fileSize?: string;
  /** Measured loudness of the exported mix (null = not measured, never a placeholder number). */
  audioLoudness?: {
    integratedLufs: number | null;
    truePeakDbfs: number | null;
    targetLufs: number | null;
    appliedGainDb: number | null;
    normalizationApplied: boolean;
    audioTrackIncluded: boolean;
  };
  error?: {
    code: RenderErrorCode;
    messageSk: string;
    messageEn: string;
  };
}

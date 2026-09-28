import { 
  ExportPresetId, 
  ExportPresetConfig, 
  RenderPlan, 
  QCGateResult, 
  ExportHistoryItem, 
  RenderErrorCode 
} from "../types/renderEngine";
import { EditDecisionList } from "../types";
import { EditDNAProfile } from "../types/editDNA";
import { EDLManager } from "./edlManager";
import { EditBrainManager } from "./editBrainManager";

export const EXPORT_PRESETS: Record<ExportPresetId, ExportPresetConfig> = {
  SOCIAL_VERTICAL: {
    id: "SOCIAL_VERTICAL",
    name: "Social Vertical (TikTok / Reels / Shorts)",
    width: 1080,
    height: 1920,
    fps: 30,
    videoBitrate: 6000000,
    aspectRatio: "9:16",
    description: "1080×1920 Full HD Vertical optimized for mobile platforms.",
  },
  SOCIAL_SQUARE: {
    id: "SOCIAL_SQUARE",
    name: "Social Square (Instagram Feed)",
    width: 1080,
    height: 1080,
    fps: 30,
    videoBitrate: 5000000,
    aspectRatio: "1:1",
    description: "1080×1080 Square 1:1 format.",
  },
  SOCIAL_PORTRAIT: {
    id: "SOCIAL_PORTRAIT",
    name: "Instagram Portrait",
    width: 1080,
    height: 1350,
    fps: 30,
    videoBitrate: 5500000,
    aspectRatio: "4:5",
    description: "1080×1350 Portrait format for higher feed visibility.",
  },
  YOUTUBE_LANDSCAPE: {
    id: "YOUTUBE_LANDSCAPE",
    name: "YouTube Landscape (1080p)",
    width: 1920,
    height: 1080,
    fps: 30,
    videoBitrate: 8000000,
    aspectRatio: "16:9",
    description: "1920×1080 Full HD widescreen master export.",
  },
  YOUTUBE_4K: {
    id: "YOUTUBE_4K",
    name: "YouTube 4K Master",
    width: 3840,
    height: 2160,
    fps: 60,
    videoBitrate: 25000000,
    aspectRatio: "16:9",
    description: "3840×2160 Ultra HD 4K master export (requires capable hardware).",
  },
  CUSTOM: {
    id: "CUSTOM",
    name: "Custom Export Preset",
    width: 1920,
    height: 1080,
    fps: 30,
    videoBitrate: 6000000,
    aspectRatio: "16:9",
    description: "User-defined custom render specifications.",
  },
};

export class RenderEngineManager {
  private static HISTORY_STORAGE_PREFIX = "omnistrih_export_history_";

  /**
   * Generate an immutable RenderPlan from current EDL, DNA, and preset.
   */
  static createRenderPlan(
    projectId: string,
    presetId: ExportPresetId,
    customWidth?: number,
    customHeight?: number,
    sourceRange?: { start: number; end: number },
    options?: { trackSubject?: boolean }
  ): RenderPlan {
    const edl = EDLManager.getEDL(projectId);
    const dna = EditBrainManager.getEffectiveDNA(projectId);
    const preset = EXPORT_PRESETS[presetId];

    const width = customWidth || preset.width;
    const height = customHeight || preset.height;

    // Calculate total timeline duration by taking maximum span of visual/dialogue decisions
    let maxEnd = 0;
    for (const dec of edl.decisions) {
      if (dec.status === "rejected") continue;
      // Skip global audio/music track layers from inflating timeline duration
      if (dec.type === "AUDIO" || dec.type === "MUSIC") continue;
      const tEnd = dec.timelineEnd ?? dec.end;
      if (typeof tEnd === "number" && tEnd > maxEnd) {
        maxEnd = tEnd;
      }
    }
    const totalDuration = maxEnd > 0 ? maxEnd : 15;
    // A window export renders exactly the requested window; the length is the window length.
    const windowStart = sourceRange ? Math.max(0, sourceRange.start) : 0;
    const windowEnd = sourceRange ? Math.max(windowStart + 0.1, sourceRange.end) : totalDuration;
    const renderDuration = sourceRange ? windowEnd - windowStart : totalDuration;

    return {
      projectId,
      edlVersion: edl.version,
      dnaVersion: dna.sampleCount || 1,
      sourceMediaReferences: Array.from(new Set(edl.decisions.map(d => d.sourceMediaId || "src-1"))),
      timelineDuration: renderDuration,
      outputWidth: width,
      outputHeight: height,
      fps: preset.fps,
      videoCodec: "vp9/h264",
      audioCodec: "aac/opus",
      bitrate: preset.videoBitrate,
      audioSampleRate: 48000,
      audioChannels: 2,
      presetId,
      sourceRange: sourceRange ? { start: windowStart, end: windowEnd } : undefined,
      // Social deliverables must fill the frame (COVER); other presets keep the legacy FIT drawing.
      reframe: presetId.startsWith('SOCIAL_') ? 'COVER' : 'FIT',
      // The user's auto-reframe switch: off means the crop stays centred even if faces were measured.
      trackSubject: options?.trackSubject !== false,
      createdAt: new Date().toISOString(),
      edlSnapshot: JSON.parse(JSON.stringify(edl)),
      dnaSnapshot: JSON.parse(JSON.stringify(dna)),
    };
  }

  /**
   * Execute Quality Control (QC) gate on the render plan and outputs.
   */
  static runQCGate(plan: RenderPlan): QCGateResult {
    // Inspect edlSnapshot for potential issues
    let missingMedia = false;
    let captionOverflow = false;
    const safeZoneViolations = 0;

    for (const dec of plan.edlSnapshot.decisions) {
      if (!dec.sourceStart && dec.sourceStart !== 0) missingMedia = true;
      if (dec.type === "CAPTION" && (dec.end - dec.start) > 6.0) captionOverflow = true;
    }

    const passed = !missingMedia;

    // Score is derived from the checks that actually ran on the plan. No pixel or bitstream
    // inspection exists yet, so the score cannot pretend to describe the encoded output.
    let score = 100;
    if (missingMedia) score -= 40;
    if (captionOverflow) score -= 10;
    score = Math.max(0, Math.min(100, score));

    const notMeasured = {
      sk: "nemerané (vyžaduje analýzu pixelov/bitstreamu)",
      en: "not measured (requires pixel/bitstream analysis)",
    };

    return {
      passed,
      blackFramesDetected: false,
      audioClippingDetected: false,
      missingMediaDetected: missingMedia,
      captionOverflowDetected: captionOverflow,
      safeZoneViolations,
      score,
      measured: {
        missingMedia: true,
        captionOverflow: true,
        blackFrames: false,
        audioClipping: false,
        safeZones: false,
      },
      detailsSk: passed
        ? `Plán prešiel kontrolou väzzieb (skóre ${score}/100). Čierne snímky, clipping a safe zóny: ${notMeasured.sk}.`
        : `Plán obsahuje chýbajúce médium alebo problematické titulky (skóre ${score}/100).`,
      detailsEn: passed
        ? `Plan passed the reference checks (score ${score}/100). Black frames, clipping and safe zones: ${notMeasured.en}.`
        : `Plan references missing media or has overflowing captions (score ${score}/100).`,
    };
  }

  /**
   * Get export history for a project
   */
  static getExportHistory(projectId: string): ExportHistoryItem[] {
    try {
      const saved = localStorage.getItem(this.HISTORY_STORAGE_PREFIX + projectId);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load export history", e);
    }
    return [];
  }

  /**
   * Save export history item
   */
  static addExportHistoryItem(projectId: string, item: ExportHistoryItem): void {
    try {
      const history = this.getExportHistory(projectId);
      history.unshift(item);
      if (history.length > 30) history.pop();
      localStorage.setItem(this.HISTORY_STORAGE_PREFIX + projectId, JSON.stringify(history));
    } catch (e) {
      console.error("Failed to save export history", e);
    }
  }

  /**
   * Translate render error codes to Slovak messages
   */
  static getErrorMessage(code: RenderErrorCode): { sk: string; en: string } {
    switch (code) {
      case "MEDIA_NOT_FOUND":
        return { sk: "Zdrojové médiá neboli nájdené.", en: "Source media not found." };
      case "UNSUPPORTED_CODEC":
        return { sk: "Nepodporovaný video/audio kodek v prehliadači.", en: "Unsupported video/audio codec." };
      case "DECODE_FAILED":
        return { sk: "Dekódovanie zdrojového média zlyhalo.", en: "Failed to decode source media." };
      case "ENCODE_FAILED":
        return { sk: "Kódovanie výstupného videa zlyhalo.", en: "Failed to encode output video." };
      case "AUDIO_RENDER_FAILED":
        return { sk: "Renderovanie audio stopy zlyhalo.", en: "Audio render pipeline failed." };
      case "MUX_FAILED":
        return { sk: "Muxovanie videa a audia zlyhalo.", en: "Muxing video and audio failed." };
      case "OUT_OF_MEMORY":
        return { sk: "Nedostatok pamäte RAM pri renderovaní 4K/Full HD.", en: "Out of memory during render." };
      case "BROWSER_CAPABILITY":
        return { sk: "Prehliadač nepodporuje požadovanú funkciu renderovania.", en: "Browser capability limit reached." };
      case "EDL_CHANGED":
        return { sk: "EDL sa zmenilo počas renderovania. Render bol bezpečne prerušený.", en: "EDL changed during render. Render aborted." };
      case "SOURCE_CHANGED":
        return { sk: "Zdrojové súbory sa zmenili počas renderovania.", en: "Source files changed during render." };
      case "EXPORT_CANCELLED":
        return { sk: "Export bol úspešne zrušený používateľom.", en: "Export successfully cancelled by user." };
      case "QC_FAILED":
        return { sk: "Výstup neprešiel výstupnou QC kontrolou kvality.", en: "Output failed QC gate check." };
      default:
        return { sk: "Neznáma chyba pri exporte.", en: "Unknown export error." };
    }
  }
}


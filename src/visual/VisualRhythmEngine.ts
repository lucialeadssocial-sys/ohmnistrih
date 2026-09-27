export interface RhythmMarker {
  time: number; // timeline seconds
  type: "CHANGE_POINT" | "EMPHASIS_POINT" | "RESET_POINT" | "PEAK_MOMENT" | "CALM_MOMENT";
  intensity: number; // 0.0 to 1.0
  descriptionSk: string;
}

export interface VisualRhythmMap {
  projectId: string;
  markers: RhythmMarker[];
  averagePacingSeconds: number;
}

export class VisualRhythmEngine {
  static generateRhythmMap(
    projectId: string,
    transcriptData: { text: string; start: number; end: number; importance?: number }[],
    totalDuration: number
  ): VisualRhythmMap {
    const markers: RhythmMarker[] = [];

    let lastMarkerTime = 0;

    transcriptData.forEach((seg) => {
      const segDuration = seg.end - seg.start;
      const importance = seg.importance ?? 0.5;

      // Reset point if long pause
      if (seg.start - lastMarkerTime > 3.0) {
        markers.push({
          time: Number((seg.start - 0.2).toFixed(2)),
          type: "CALM_MOMENT",
          intensity: 0.2,
          descriptionSk: "Pauza v reči - uvoľnenie vizuálneho tlaku",
        });
        markers.push({
          time: Number(seg.start.toFixed(2)),
          type: "RESET_POINT",
          intensity: 0.3,
          descriptionSk: "Reset vizuálnej kompozície",
        });
      }

      if (importance >= 0.8) {
        markers.push({
          time: Number((seg.start + segDuration * 0.2).toFixed(2)),
          type: "PEAK_MOMENT",
          intensity: importance,
          descriptionSk: "Vrcholný moment vyhlásenia - vysoký vizuálny dôraz",
        });
      } else if (importance >= 0.5) {
        markers.push({
          time: Number((seg.start + 0.1).toFixed(2)),
          type: "EMPHASIS_POINT",
          intensity: importance,
          descriptionSk: "Bod dôrazu kľúčového slova",
        });
      }

      lastMarkerTime = seg.end;
    });

    const avgPacing = markers.length > 1 ? totalDuration / markers.length : 3.0;

    return {
      projectId,
      markers,
      averagePacingSeconds: Number(avgPacing.toFixed(2)),
    };
  }
}
